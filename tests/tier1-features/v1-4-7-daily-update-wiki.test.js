import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestServer } from '../helpers/testServer.js';
import { supabase } from '../../src/config/supabase.js';
import { ensureUserInitialized } from '../../src/services/profileService.js';
import {
  ROTATING_DAILY_QUEST_POOL,
  DAILY_QUEST_REWARD_LT,
  FIXED_DAILY_QUESTS,
  selectDailyQuestIds,
  getQuestStatus,
} from '../../src/services/questService.js';
import { CHAT_EXP_MIN, CHAT_EXP_MAX } from '../../src/services/expService.js';
import {
  LATEST_VERSION,
  getUpdateAckReward,
  getChangelogPayload,
} from '../../src/data/changelogs.js';
import {
  acknowledgeUpdate,
  checkUpdateGate,
  clearUpdateGateCache,
} from '../../src/services/updateGateService.js';
import { WIKI_METADATA, getWikiData, getWikiCatalogSummary } from '../../src/services/wikiService.js';

const USER_UP = '999900000000014702';

async function cleanup() {
  if (!supabase) return;
  await supabase.from('user_quests').delete().eq('user_id', USER_UP);
  await supabase.from('user_pets').delete().eq('user_id', USER_UP);
  await supabase.from('users').delete().eq('user_id', USER_UP);
  clearUpdateGateCache(USER_UP);
}

describe('Tier 1 - v1.4.7 Daily Quests (+10% & 10-Pool), Chat EXP (+15%), Update Ack (+800 LT) & Concise Wiki', () => {
  let testServer;

  before(async () => {
    await cleanup();
    testServer = await createTestServer();
  });

  after(async () => {
    await cleanup();
    if (testServer) await testServer.close();
  });

  it('1. Daily Quests select 2 fixed + 3 deterministic rotating from 10-activity pool with +10% rewards & 130 LT 5/5 bonus', () => {
    assert.equal(ROTATING_DAILY_QUEST_POOL.length, 10);
    assert.equal(FIXED_DAILY_QUESTS.daily.rewardLt, 17);
    assert.equal(FIXED_DAILY_QUESTS.exp.rewardLt, 22);
    assert.equal(DAILY_QUEST_REWARD_LT, 130);

    const a = selectDailyQuestIds(USER_UP, '2026-11-23');
    const b = selectDailyQuestIds(USER_UP, '2026-11-23');
    const c = selectDailyQuestIds(USER_UP, '2026-11-24');
    assert.deepEqual(a, b, 'Quest selection must be deterministic within the same day');
    assert.equal(a.length, 5);
    assert.equal(a[0], 'daily');
    assert.equal(a[1], 'exp');
    assert.equal(new Set(a).size, 5, 'All 5 selected quests must be distinct');

    const diffDaySeen = a.slice(2).join(',') !== c.slice(2).join(',');
    assert.ok(diffDaySeen, 'Different dates should rotate different quest combinations');
  });

  it('2. Chat EXP base is +15% (23-35) and acknowledgeUpdate awards active version LT once (safe against double-click)', async () => {
    assert.equal(CHAT_EXP_MIN, 23);
    assert.equal(CHAT_EXP_MAX, 35);
    assert.ok(['1.5', '1.5.1'].includes(LATEST_VERSION));
    assert.equal(getUpdateAckReward('1.4.7'), 800);
    assert.equal(getUpdateAckReward('1.5'), 2000);

    if (!supabase) return;
    await ensureUserInitialized(USER_UP, { username: 'AckRewardTester' });
    await supabase
      .from('users')
      .update({ last_seen_update_version: '1.4.5', linh_thach: 100 })
      .eq('user_id', USER_UP);
    clearUpdateGateCache(USER_UP);

    const expectedReward = getUpdateAckReward(LATEST_VERSION);
    const gate = await checkUpdateGate(USER_UP);
    assert.equal(gate.blocked, true);
    assert.equal(gate.ack_reward_lt, expectedReward);
    assert.equal(gate.payload.footer, '');

    // Concurrent double-click must only award LT once!
    const [ack1, ack2] = await Promise.all([acknowledgeUpdate(USER_UP), acknowledgeUpdate(USER_UP)]);
    const totalGranted = (ack1.granted_lt || 0) + (ack2.granted_lt || 0);
    assert.equal(totalGranted, expectedReward, `Expected exactly +${expectedReward} LT granted once across double clicks, got ${totalGranted}`);

    const { data: userAfter } = await supabase
      .from('users')
      .select('linh_thach, last_seen_update_version')
      .eq('user_id', USER_UP)
      .single();
    assert.equal(userAfter.linh_thach, 100 + expectedReward);
    assert.equal(userAfter.last_seen_update_version, LATEST_VERSION);

    // Subsequent status call confirms 5-quest structure in live DB
    const qStatus = await getQuestStatus(USER_UP);
    assert.equal(qStatus.tower_max_floor, 500);
    assert.equal(qStatus.quests.length, 5);
    assert.equal(qStatus.footer, '');
  });

  it('3. /updates & /wiki are concise, updated to v1.5, include all missing commands, and catalog totals match 165/90', async () => {
    const ch = getChangelogPayload('1.4.7');
    assert.equal(ch.success, true);
    assert.equal(ch.ack_reward_lt, 800);
    assert.equal(ch.footer, '');
    assert.ok(ch.description.length <= 2500, `Expected concise changelog, got ${ch.description.length} chars`);
    assert.match(ch.description, /\/autosell/);
    assert.match(ch.description, /500/);
    assert.match(ch.description, /800/);

    assert.equal(WIKI_METADATA.version, '1.5');
    const ov = getWikiData('overview');
    const ovText = JSON.stringify(ov.data);
    for (const cmd of ['/autosell', '/unequip', '/pet', '/play', '/queue', '/music', '/sound', '/giveaway_create', '/sticky-set', '/sticky-off']) {
      assert.ok(ovText.includes(cmd), `Overview wiki must mention ${cmd}`);
    }

    const cat = getWikiCatalogSummary();
    assert.equal(cat.equipment.weapon.length, 57);
    assert.equal(cat.equipment.gem.length, 54);
    assert.equal(cat.equipment.soul.length, 54);
    assert.equal(
      cat.pets.common.length + cat.pets.rare.length + cat.pets.epic.length + cat.pets.mythic.length,
      90,
    );
  });
});
