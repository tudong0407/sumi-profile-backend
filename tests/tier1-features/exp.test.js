import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestServer } from '../helpers/testServer.js';
import { supabase } from '../../src/config/supabase.js';
import { grantChatExp, handleVoiceExp, CHAT_COOLDOWN_MS } from '../../src/services/expService.js';

const TEMP_TEST_USER_ID = '999999999999999901';
const TEMP_BURST_USER_ID = '999999999999999902';
const TEMP_DECO_USER_ID = '999999999999999903';

async function cleanupTestUsers() {
  if (!supabase) return;
  for (const uid of [TEMP_TEST_USER_ID, TEMP_BURST_USER_ID, TEMP_DECO_USER_ID]) {
    await supabase.from('user_pets').delete().eq('user_id', uid);
    await supabase.from('user_roles').delete().eq('user_id', uid);
    await supabase.from('user_pet_items').delete().eq('user_id', uid);
    await supabase.from('users').delete().eq('user_id', uid);
  }
}

describe('Tier 1 - Pillar 2 Chat & Voice EXP Progression + Beginner Auto-Seeding', () => {
  let testServer;

  before(async () => {
    testServer = await createTestServer();
    await cleanupTestUsers();
  });

  after(async () => {
    await cleanupTestUsers();
    if (testServer) await testServer.close();
  });

  it('1. POST /api/exp/chat rejects invalid userId with HTTP 400', async () => {
    const res = await testServer.fetch('/api/exp/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: 'not-a-snowflake' }),
    });
    assert.equal(res.status, 400);
    const json = await res.json();
    assert.equal(json.success, false);
  });

  it('2. POST /api/exp/chat ignores bots and Locked XP users cleanly', async () => {
    const botRes = await testServer.fetch('/api/exp/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: TEMP_TEST_USER_ID, isBot: true }),
    });
    assert.equal(botRes.status, 200);
    const botJson = await botRes.json();
    assert.equal(botJson.awarded, false);
    assert.equal(botJson.reason, 'bot_ignored');

    const lockedRes = await testServer.fetch('/api/exp/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: TEMP_TEST_USER_ID, roleIds: ['1471111216423370792'] }),
    });
    assert.equal(lockedRes.status, 200);
    const lockedJson = await lockedRes.json();
    assert.equal(lockedJson.awarded, false);
    assert.equal(lockedJson.reason, 'locked_xp');
  });

  it('3. First Chat EXP auto-seeds beginner profile (Lv.1 + Hóa Thạch Nham Nham Thú) and awards 15-25 EXP, then enforces 45s cooldown', async () => {
    const t0 = Date.now();
    const first = await grantChatExp(
      { userId: TEMP_TEST_USER_ID, username: 'Tân Thủ Kiểm Thử' },
      { now: t0, rng: () => 0.5 }
    );
    assert.equal(first.success, true);
    assert.equal(first.awarded, true);
    assert.ok(first.exp_gained >= 15 && first.exp_gained <= 25, `Expected 15-25 EXP, got ${first.exp_gained}`);
    assert.equal(first.level, 1);

    // Verify starter pet was seeded in profile
    const profRes = await testServer.fetch(`/api/profile/${TEMP_TEST_USER_ID}?format=json`);
    const profJson = await profRes.json();
    assert.equal(profJson.data.level, 1);
    assert.equal(profJson.data.linh_thach, 0);
    assert.equal(profJson.data.pet.pet_type, 'hoa_thach_nham_nham');
    assert.equal(profJson.data.pet.atk, 120);
    assert.equal(profJson.data.pet.def, 180);
    assert.equal(profJson.data.pet.spd, 100);

    // Immediate second message within 45s must hit cooldown
    const second = await grantChatExp(
      { userId: TEMP_TEST_USER_ID, username: 'Tân Thủ Kiểm Thử' },
      { now: t0 + 10_000, rng: () => 0.5 }
    );
    assert.equal(second.success, true);
    assert.equal(second.awarded, false);
    assert.equal(second.reason, 'cooldown');
    assert.ok(second.cooldown_remaining_sec > 0 && second.cooldown_remaining_sec <= 45);

    // After 45s cooldown expires, EXP is awarded again
    const third = await grantChatExp(
      { userId: TEMP_TEST_USER_ID, username: 'Tân Thủ Kiểm Thử' },
      { now: t0 + CHAT_COOLDOWN_MS + 1000, rng: () => 0.5 }
    );
    assert.equal(third.success, true);
    assert.equal(third.awarded, true);
    assert.equal(third.exp, first.exp + third.exp_gained);
  });

  it('4. Voice EXP join -> 10 minutes -> leave awards 2 blocks (100-200 EXP) and triggers Lv.2 level-up', async () => {
    const tJoin = Date.now() + 120_000;
    const joined = await handleVoiceExp(
      { userId: TEMP_TEST_USER_ID, username: 'Tân Thủ Kiểm Thử', action: 'join' },
      { now: tJoin }
    );
    assert.equal(joined.success, true);
    assert.equal(joined.action, 'join');
    assert.equal(joined.awarded, false);

    // Leave after 10 minutes -> 2 blocks of 50-100 EXP -> guaranteed to cross Lv.1 (100 EXP) into Lv.2
    const left = await handleVoiceExp(
      { userId: TEMP_TEST_USER_ID, username: 'Tân Thủ Kiểm Thử', action: 'leave' },
      { now: tJoin + 10 * 60 * 1000, rng: () => 0.5 }
    );
    assert.equal(left.success, true);
    assert.equal(left.action, 'leave');
    assert.equal(left.awarded, true);
    assert.equal(left.blocks_rewarded, 2);
    assert.ok(left.exp_gained >= 100 && left.exp_gained <= 200);
    assert.equal(left.leveled_up, true);
    assert.ok(left.level >= 2, `Expected level >= 2, got ${left.level}`);
    assert.ok(left.level_up_message.includes('Cấp'), 'Must generate concise level-up announcement');
  });

  it('5. POST /api/exp/voice rejects invalid action with HTTP 400 and ignores bots / Locked XP / Cách Ly', async () => {
    const res = await testServer.fetch('/api/exp/voice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: TEMP_TEST_USER_ID, action: 'explode' }),
    });
    assert.equal(res.status, 400);

    const botRes = await testServer.fetch('/api/exp/voice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: TEMP_TEST_USER_ID, action: 'join', isBot: 'true' }),
    });
    assert.equal(botRes.status, 200);
    const botJson = await botRes.json();
    assert.equal(botJson.awarded, false);
    assert.equal(botJson.reason, 'bot_ignored');

    const lockedRes = await testServer.fetch('/api/exp/voice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: TEMP_TEST_USER_ID, action: 'leave', minutes: 10, roleIds: '1474776271883079681' }),
    });
    assert.equal(lockedRes.status, 200);
    const lockedJson = await lockedRes.json();
    assert.equal(lockedJson.awarded, false);
    assert.equal(lockedJson.reason, 'locked_xp');
  });

  it('6. Unresolved BotGhost variables fallback cleanly to fallbackUsername while decorative {Kitsune} usernames are preserved', async () => {
    const t0 = Date.now();
    // Simulate unresolved {event_user_display_name} falling back to {event_user_name} = 'RealDiscordName'
    const r1 = await grantChatExp(
      { userId: TEMP_DECO_USER_ID, username: '{event_user_display_name}', fallbackUsername: 'RealDiscordName' },
      { now: t0, rng: () => 0.5 }
    );
    assert.equal(r1.success, true);
    assert.equal(r1.username, 'RealDiscordName');

    // Decorative {Kitsune} must be accepted by GET /api/profile override (not stripped as BotGhost var)
    const profRes = await testServer.fetch(`/api/profile/${TEMP_DECO_USER_ID}?format=json&username=${encodeURIComponent('{Kitsune}')}`);
    assert.equal(profRes.status, 200);
    const profJson = await profRes.json();
    assert.equal(profJson.data.username, '{Kitsune}');
  });

  it('7. Concurrent burst Chat EXP calls for a brand-new user award EXP once and seed exactly one starter pet', async () => {
    const tBurst = Date.now();
    const [a, b] = await Promise.all([
      grantChatExp({ userId: TEMP_BURST_USER_ID, username: '{Kitsune}' }, { now: tBurst, rng: () => 0.5 }),
      grantChatExp({ userId: TEMP_BURST_USER_ID, username: '{Kitsune}' }, { now: tBurst + 200, rng: () => 0.5 }),
    ]);
    assert.equal(a.success, true);
    assert.equal(b.success, true);
    const awardedCount = [a, b].filter((x) => x.awarded).length;
    assert.equal(awardedCount, 1, 'Exactly one burst message should award EXP; the second must hit cooldown');
    assert.equal(a.username, '{Kitsune}', 'Decorative {Kitsune} username must be preserved on auto-init');

    if (supabase) {
      const { data: pets } = await supabase.from('user_pets').select('pet_id').eq('user_id', TEMP_BURST_USER_ID);
      assert.equal(pets?.length, 1, 'Must seed exactly 1 starter pet even under concurrent requests');
    }
  });
});
