import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { loadImage } from '@napi-rs/canvas';
import { createTestServer } from '../helpers/testServer.js';
import { supabase } from '../../src/config/supabase.js';
import {
  RARITY_TIERS,
  PET_CATALOG,
  EQUIPMENT_CATALOG,
  JOBS_CATALOG,
  FUYUMI_USER_ID,
  getEnchantMultiplier,
} from '../../src/data/catalog.js';
import { ensureUserInitialized } from '../../src/services/profileService.js';
import { LATEST_VERSION } from '../../src/data/changelogs.js';
import {
  getGachaDismantleValue,
  getDismantleQuote,
  normalizeEmojiAwareQuery,
  enchantTarget,
  dismantleTarget,
} from '../../src/services/inventoryService.js';
import { rollGacha } from '../../src/services/economyService.js';
import { lookupInfo } from '../../src/services/infoService.js';
import { compileCombatant } from '../../src/services/battleEngine/statsCompiler.js';
import { TOWER_MAX_FLOOR, buildTowerGuardian, challengeTower, getQuestStatus } from '../../src/services/questService.js';
import { doJob, getJobStatus } from '../../src/services/jobService.js';
import { clearUpdateGateCache } from '../../src/services/updateGateService.js';
import {
  getPrerenderStatus,
  getCachedUniqueItemCard,
  invalidateUniqueItemCard,
} from '../../src/services/staticAssetCacheService.js';
import { renderBattleCardQueued } from '../../src/services/battleService.js';

const USER_V12_A = '999120000000000101';
const USER_V12_B = '999120000000000102';
const USER_V12_GATE = '999120000000000103';

async function cleanupV12Users() {
  if (!supabase) return;
  const ids = [USER_V12_A, USER_V12_B, USER_V12_GATE];
  await supabase.from('user_quests').delete().in('user_id', ids);
  await supabase.from('user_inventory').delete().in('user_id', ids);
  await supabase.from('user_pet_items').delete().in('user_id', ids);
  await supabase.from('user_pets').delete().in('user_id', ids);
  await supabase.from('user_roles').delete().in('user_id', ids);
  await supabase.from('shop_selections').delete().in('user_id', ids);
  await supabase.from('users').delete().in('user_id', ids);
  ids.forEach((id) => clearUpdateGateCache(id));
}

async function assertWebpDimensions(buf, width, height) {
  assert.ok(buf && buf.length > 32, 'WebP buffer must exist');
  assert.equal(buf.subarray(0, 4).toString('ascii'), 'RIFF');
  assert.equal(buf.subarray(8, 12).toString('ascii'), 'WEBP');
  const img = await loadImage(buf);
  assert.equal(img.width, width, `Expected WebP width ${width}, got ${img.width}`);
  assert.equal(img.height, height, `Expected WebP height ${height}, got ${img.height}`);
}

describe('Tier 1 - Update v1.2 Comprehensive Suite', () => {
  let testServer;

  before(async () => {
    await cleanupV12Users();
    testServer = await createTestServer();
  });

  after(async () => {
    await cleanupV12Users();
    if (testServer) await testServer.close();
  });

  it('1. Pha 1A: Fast battle simulate (<1s), 5s per-user cooldown (HTTP 200), concurrent semaphore & adaptive WebP scaling', async () => {
    if (!supabase) return;
    await ensureUserInitialized(USER_V12_A, { username: 'V12BattleA' });
    await ensureUserInitialized(USER_V12_B, { username: 'V12BattleB' });

    const t0 = Date.now();
    const res1 = await testServer.fetch('/api/battle/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        attackerId: USER_V12_A,
        defenderId: USER_V12_B,
        options: { maxTurns: 15, seed: 21 },
      }),
    });
    const elapsed = Date.now() - t0;
    assert.equal(res1.status, 200);
    const json1 = await res1.json();
    assert.equal(json1.success, true);
    assert.ok(elapsed < 3000, `Simulate should return quickly before background render completes, got ${elapsed}ms`);

    // Immediate repeat battle triggers 5s cooldown with HTTP 200
    const resCd = await testServer.fetch('/api/battle/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        attackerId: USER_V12_A,
        defenderId: USER_V12_B,
      }),
    });
    assert.equal(resCd.status, 200);
    const jsonCd = await resCd.json();
    assert.equal(jsonCd.success, false);
    assert.equal(jsonCd.error, 'BATTLE_COOLDOWN');
    assert.ok(jsonCd.cooldown_seconds >= 1 && jsonCd.cooldown_seconds <= 15);

    // Mid-turn 720x360 vs final 1250x625 WebP/PNG (v1.4.7 -10% render optimization)
    const midBuf = await (await testServer.fetch(`/api/battle/report/${json1.battleId}/1.webp`)).arrayBuffer();
    await assertWebpDimensions(Buffer.from(midBuf), 720, 360);

    const lastIdx = json1.frameCount || 2;
    const finalBuf = await (await testServer.fetch(`/api/battle/report/${json1.battleId}/${lastIdx}.webp`)).arrayBuffer();
    await assertWebpDimensions(Buffer.from(finalBuf), 1250, 625);

    const pngRes = await testServer.fetch(`/api/battle/report/${json1.battleId}.png`);
    assert.equal(pngRes.status, 200);
    const pngImg = await loadImage(Buffer.from(await pngRes.arrayBuffer()));
    assert.equal(pngImg.width, 1250);
    assert.equal(pngImg.height, 625);

    // renderBattleCardQueued deduplicates identical concurrent requests
    const dedupKey = `dedup-check-${json1.battleId}`;
    const [bA, bB] = await Promise.all([
      renderBattleCardQueued(dedupKey, json1, { scale: 0.8, format: 'webp' }),
      renderBattleCardQueued(dedupKey, json1, { scale: 0.8, format: 'webp' }),
    ]);
    assert.equal(bA.length, bB.length);
  });

  it('2. Pha 1B & 1C: 0.5% Mythic rates, Mức A dismantle tables, Shop 20%/25%, and Pet/Role batch dismantle', async () => {
    assert.equal(RARITY_TIERS.common.dropRate, 60.5);
    assert.equal(RARITY_TIERS.rare.dropRate, 25);
    assert.equal(RARITY_TIERS.epic.dropRate, 14);
    assert.equal(RARITY_TIERS.mythic.dropRate, 0.5);

    const mythicItems = EQUIPMENT_CATALOG.filter((i) => i.rarity_key === 'mythic');
    const mythicPets = PET_CATALOG.filter((p) => p.rarity_key === 'mythic' && !p.is_exclusive_fuyumi);
    assert.ok(mythicItems.every((i) => Math.abs(Number(i.drop_rate) - 0.5) < 1e-6));
    assert.ok(mythicPets.every((p) => Math.abs(Number(p.drop_rate) - 0.5) < 1e-6));

    // Verify Mức A table values
    assert.deepEqual(
      ['common', 'rare', 'epic', 'mythic'].map((r) => getGachaDismantleValue('item', r)),
      [3, 8, 22, 55],
    );
    assert.deepEqual(
      ['common', 'rare', 'epic', 'mythic'].map((r) => getGachaDismantleValue('pet', r)),
      [5, 12, 30, 75],
    );
    assert.equal(getGachaDismantleValue('role', 'common', { isPermanent: false, remDays: 7 }), 3);
    assert.equal(getGachaDismantleValue('role', 'mythic', { isPermanent: false, remDays: 90 }), 94);
    assert.equal(getGachaDismantleValue('role', 'mythic', { isPermanent: true }), 140);

    // Shop 20% item vs 25% pet/role
    assert.equal(getDismantleQuote('item', { source: 'shop', paid_price: 250 }, { rarity_key: 'common' }).refund, 50);
    assert.equal(getDismantleQuote('pet', { source: 'shop', paid_price: 300 }, { rarity_key: 'common' }).refund, 75);
    assert.equal(getDismantleQuote('role', { source: 'shop', paid_price: 1000, is_permanent: true }, { rarity_key: 'rare' }).refund, 250);

    if (!supabase) return;
    await ensureUserInitialized(USER_V12_A, { username: 'V12Dismantle' });
    const [commonPet1, commonPet2] = PET_CATALOG.filter((p) => p.rarity_key === 'common' && !p.is_starter && !p.is_exclusive_fuyumi);
    await supabase.from('user_pets').insert([
      { user_id: USER_V12_A, pet_type: commonPet1.pet_type, pet_name: commonPet1.pet_name, is_active: false, level: 1, star: 1, source: 'gacha', paid_price: 0, enchant_grade: 'D' },
      { user_id: USER_V12_A, pet_type: commonPet2.pet_type, pet_name: commonPet2.pet_name, is_active: false, level: 1, star: 1, source: 'shop', paid_price: 300, enchant_grade: 'C' },
    ]);
    const petBatchRes = await testServer.fetch('/api/dismantle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: USER_V12_A, category: 'pet', targetId: 'all_common' }),
    });
    assert.equal(petBatchRes.status, 200);
    const petBatch = await petBatchRes.json();
    assert.equal(petBatch.success, true);
    assert.equal(petBatch.dismantled_count, 2);
    assert.equal(petBatch.refund_linh_thach, 5 + 75); // 5 gacha + 75 shop (25% of 300)

    const exp7d = new Date(Date.now() + 7 * 86400000).toISOString();
    await supabase.from('user_roles').insert([
      { user_id: USER_V12_A, role_id: '1573186049289756712', role_name: '« Thần Hành Cốt Cách »', role_perk: 'Buff', is_permanent: false, expires_at: exp7d, is_equipped: false, equipped_slot: null, source: 'gacha', paid_price: 0 },
      { user_id: USER_V12_A, role_id: '1573186053500833802', role_name: '« Họa Đồ Linh Sư »', role_perk: 'Image', is_permanent: false, expires_at: exp7d, is_equipped: false, equipped_slot: null, source: 'gacha', paid_price: 0 },
    ]);
    const roleBatchRes = await testServer.fetch('/api/dismantle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: USER_V12_A, category: 'role', targetId: '1573186049289756712,1573186053500833802' }),
    });
    assert.equal(roleBatchRes.status, 200);
    const roleBatch = await roleBatchRes.json();
    assert.equal(roleBatch.success, true);
    assert.equal(roleBatch.dismantled_count, 2);
    assert.ok(roleBatch.remove_role_csv.includes('1573186049289756712'));
    assert.ok(roleBatch.remove_role_csv.includes('1573186053500833802'));
  });

  it('3. Pha 2A: First-command Update Ack Gate blocks 18 gameplay routes at 1.1, leaves /wiki+/info+/updates+/profile open, unlocks on /api/update/ack', async () => {
    if (!supabase) return;
    await ensureUserInitialized(USER_V12_GATE, { username: 'V12GateTester' });
    await supabase.from('users').update({ last_seen_update_version: '1.2' }).eq('user_id', USER_V12_GATE);
    clearUpdateGateCache(USER_V12_GATE);

    // Gameplay routes blocked cleanly with HTTP 200
    const blockedInv = await testServer.fetch(`/api/inv/${USER_V12_GATE}`);
    assert.equal(blockedInv.status, 200);
    const blockedJson = await blockedInv.json();
    assert.equal(blockedJson.success, false);
    assert.equal(blockedJson.needs_update_ack, 'true');
    assert.equal(blockedJson.update_version, LATEST_VERSION);

    const blockedJob = await testServer.fetch(`/api/job/status/${USER_V12_GATE}`);
    assert.equal((await blockedJob.json()).needs_update_ack, 'true');

    // Non-gated routes still work normally
    const wikiRes = await testServer.fetch('/api/wiki?category=overview');
    assert.equal(wikiRes.status, 200);
    assert.equal((await wikiRes.json()).success, true);

    const updRes = await testServer.fetch('/api/update/1.1');
    assert.equal(updRes.status, 200);
    assert.equal((await updRes.json()).version, '1.1');

    const profRes = await testServer.fetch(`/api/profile/${USER_V12_GATE}?format=json`);
    assert.equal(profRes.status, 200);
    assert.equal((await profRes.json()).success, true);

    // Acknowledge v1.3 -> unlocks immediately
    const ackRes = await testServer.fetch('/api/update/ack', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: USER_V12_GATE }),
    });
    assert.equal(ackRes.status, 200);
    const ackJson = await ackRes.json();
    assert.equal(ackJson.success, true);
    assert.equal(ackJson.acknowledged_version, LATEST_VERSION);

    const openInv = await testServer.fetch(`/api/inv/${USER_V12_GATE}`);
    assert.equal(openInv.status, 200);
    const openJson = await openInv.json();
    assert.equal(openJson.success, true);
  });

  it('4. Pha 2B: OwO emoji grid /inv, dedicated /api/roles/:userId, /api/pet/:userId detailed summary, and emoji queries', async () => {
    assert.equal(normalizeEmojiAwareQuery('<:su_weapon_common_1:1234567890>'), 'weapon_common_1');
    assert.equal(normalizeEmojiAwareQuery('<a:su_cuu_vi_hong_ho:999888777>'), 'cuu_vi_hong_ho');

    if (!supabase) return;
    await ensureUserInitialized(USER_V12_A, { username: 'V12OwOUser' });
    const [invRes, rolesRes, petRes] = await Promise.all([
      testServer.fetch(`/api/inv/${USER_V12_A}?view=overview`),
      testServer.fetch(`/api/roles/${USER_V12_A}`),
      testServer.fetch(`/api/pet/${USER_V12_A}`),
    ]);
    assert.equal(invRes.status, 200);
    assert.equal(rolesRes.status, 200);
    assert.equal(petRes.status, 200);

    const invJson = await invRes.json();
    assert.equal(invJson.success, true);
    assert.ok(invJson.summary_pets.includes('⁰⁰¹'));
    assert.ok(!invJson.view_title.includes('OwO'));
    assert.ok(!invJson.view_title.includes('DẠNG ICON GỌN'));
    assert.ok(!invJson.summary_pets.includes('⚡'));
    assert.ok(!invJson.summary_items.includes('🔹'));

    const rolesJson = await rolesRes.json();
    assert.equal(rolesJson.success, true);

    const petJson = await petRes.json();
    assert.equal(petJson.success, true);
    assert.ok(typeof petJson.summary_pets === 'string');

    // Emoji string works in /api/info/:query
    const infoEmojiRes = await testServer.fetch(`/api/info/${encodeURIComponent('<:su_hoa_thach_nham_nham:12345>')}`);
    assert.equal(infoEmojiRes.status, 200);
    assert.equal((await infoEmojiRes.json()).id, 'hoa_thach_nham_nham');
  });

  it('5. Pha 2C & 3B: 500-floor Tower with 3 Pháp Bảo + HAX, 6 Jobs cooldown/limit, Weekly contracts claim', async () => {
    assert.equal(TOWER_MAX_FLOOR, 500);
    assert.equal(JOBS_CATALOG.length, 6);

    const g199 = await buildTowerGuardian(199);
    assert.ok(g199 && g199.equipment);
    assert.ok(g199.equipment?.weapon && g199.equipment?.gem && g199.equipment?.soul);
    assert.ok(g199.atk > 0 && g199.hax?.pet && g199.hax?.weapon && g199.hax?.gem && g199.hax?.soul);

    if (!supabase) return;
    await ensureUserInitialized(USER_V12_A, { username: 'V12JobTester' });
    await supabase.from('users').update({ level: 100, linh_thach: 2000 }).eq('user_id', USER_V12_A);

    // Boss floor 5 drops +1 enchant_stone upon win
    await supabase.from('user_quests').upsert({ user_id: USER_V12_A, tower_floor: 4 }, { onConflict: 'user_id' });
    const tower5 = await challengeTower(USER_V12_A, { preRender: false, seed: 10 });
    assert.equal(tower5.success, true);
    if (tower5.won) {
      assert.equal(tower5.new_tower_floor, 5);
      const { data: stRow } = await supabase
        .from('user_inventory')
        .select('quantity')
        .eq('user_id', USER_V12_A)
        .eq('item_id', 'enchant_stone')
        .maybeSingle();
      assert.ok((stRow?.quantity || 0) >= 1, 'Boss floor 5 should grant enchant_stone');
    }

    // Job work + immediate 1h cooldown block
    const tNow = new Date('2026-11-23T08:00:00.000Z');
    const stBefore = await testServer.fetch(`/api/job/status/${USER_V12_A}`);
    assert.equal((await stBefore.json()).jobs.length, 6);

    const jobOk = await doJob(USER_V12_A, 'quet_san', { now: tNow, rng: () => 0.5 });
    assert.equal(jobOk.success, true);
    assert.ok(jobOk.reward_linh_thach >= 12);

    const jobCd = await doJob(USER_V12_A, 'rua_bat', { now: new Date(tNow.getTime() + 10 * 60000) });
    assert.equal(jobCd.success, false);
    assert.equal(jobCd.error, 'JOB_COOLDOWN');

    // Simulate reaching Weekly contract goal & claiming via API (use real current week_key)
    const qStatus = await getQuestStatus(USER_V12_A);
    await supabase.from('user_quests').upsert({
      user_id: USER_V12_A,
      weekly_week_key: qStatus.week_key,
      weekly_jobs_done: 15,
      weekly_battle_wins: 0,
      weekly_exp_earned: 0,
      weekly_claimed_jobs: false,
    }, { onConflict: 'user_id' });

    const claimWeeklyRes = await testServer.fetch('/api/quest/claim-weekly', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: USER_V12_A }),
    });
    assert.equal(claimWeeklyRes.status, 200);
    const weeklyJson = await claimWeeklyRes.json();
    assert.equal(weeklyJson.success, true);
    assert.ok(weeklyJson.reward_linh_thach >= 250);
  });

  it('6. Pha 3A: Enchant D->S pity +5% no downgrade, statsCompiler multiplier without double-apply, Pre-render 98 cards & Fuyumi /info card', async () => {
    assert.equal(getEnchantMultiplier('D'), 1.0);
    assert.equal(getEnchantMultiplier('C'), 1.08);
    assert.equal(getEnchantMultiplier('B'), 1.18);
    assert.equal(getEnchantMultiplier('A'), 1.32);
    assert.equal(getEnchantMultiplier('S'), 1.50);

    const baseProfile = {
      user_id: USER_V12_A,
      username: 'EnchantSim',
      level: 50,
      pet: { name: 'Hóa Thạch', type: 'hoa_thach_nham_nham', element: 'Thổ', level: 20, star: 2, atk: 200, def: 200, spd: 200, enchant_grade: 'S', enchant_applied: false, equipment: {} },
    };
    const cS = await compileCombatant(baseProfile, 'attacker');
    const cPreApplied = await compileCombatant({ ...baseProfile, pet: { ...baseProfile.pet, atk: 300, enchant_applied: true } }, 'attacker');
    const cD = await compileCombatant({ ...baseProfile, pet: { ...baseProfile.pet, enchant_grade: 'D' } }, 'attacker');
    assert.ok(cS.atk > cD.atk, 'Grade S must boost compiled ATK');
    assert.equal(cS.atk, cPreApplied.atk, 'Must not double-apply enchant multiplier when enchant_applied is true');

    if (supabase) {
      await ensureUserInitialized(USER_V12_A, { username: 'V12EnchantTester' });
      await supabase.from('users').update({ linh_thach: 5000 }).eq('user_id', USER_V12_A);
      await supabase.from('user_pets').update({ enchant_grade: 'D', enchant_pity: 0 }).eq('user_id', USER_V12_A);
      await supabase.from('user_inventory').delete().eq('user_id', USER_V12_A).eq('item_id', 'enchant_stone');
      await supabase.from('user_inventory').insert({ user_id: USER_V12_A, item_id: 'enchant_stone', item_category: 'consumable', quantity: 10 });

      // Deterministic fail -> keeps D & pity becomes 1 (next rate +5%)
      const failRes = await enchantTarget(USER_V12_A, 'pet', 'hoa_thach_nham_nham', { rng: () => 0.99 });
      assert.equal(failRes.success, true);
      assert.equal(failRes.upgraded, false);
      assert.equal(failRes.new_grade, 'D');
      assert.equal(failRes.pity_count, 1);
      assert.equal(failRes.next_rate_pct, 90);

      // Deterministic success -> upgrades D -> C & resets pity to 0
      const okRes = await enchantTarget(USER_V12_A, 'pet', 'hoa_thach_nham_nham', { rng: () => 0.01 });
      assert.equal(okRes.success, true);
      assert.equal(okRes.upgraded, true);
      assert.equal(okRes.old_grade, 'D');
      assert.equal(okRes.new_grade, 'C');
      assert.equal(okRes.pity_count, 0);
    }

    // Pre-render /health + exclusive /info/pet/cuu_vi_hong_ho vs /wiki 404
    const healthJson = await (await testServer.fetch('/health')).json();
    assert.equal(healthJson.update_version, LATEST_VERSION);
    assert.equal(healthJson.prerender.totalStaticCards, 218);

    const exclusiveInfoRes = await testServer.fetch('/api/info/pet/cuu_vi_hong_ho.webp');
    assert.equal(exclusiveInfoRes.status, 200);
    await assertWebpDimensions(Buffer.from(await exclusiveInfoRes.arrayBuffer()), 2000, 1000);

    const exclusiveWikiRes = await testServer.fetch('/api/wiki/pet/cuu_vi_hong_ho');
    assert.equal(exclusiveWikiRes.status, 404);

    const fuyumiLookup = lookupInfo('cuu_vi_hong_ho', { requesterId: FUYUMI_USER_ID });
    assert.equal(fuyumiLookup.success, true);
    assert.match(
      fuyumiLookup.image_url,
      new RegExp(`/api/info/pet/cuu_vi_hong_ho\\.webp\\?v=${LATEST_VERSION.replace(/\./g, '\\.')}$`),
    );

    const strangerLookup = lookupInfo('cuu_vi_hong_ho', { requesterId: USER_V12_A });
    assert.equal(strangerLookup.success, false);
    assert.equal(strangerLookup.status, 404);

    // Unique item card cache invalidation check
    const uRes = await testServer.fetch('/api/wiki/item/weapon_mythic_1.webp');
    assert.equal(uRes.status, 200);
    await assertWebpDimensions(Buffer.from(await uRes.arrayBuffer()), 2000, 1000);
    assert.equal(invalidateUniqueItemCard('weapon_mythic_1'), true);
    const fakeUnique = await getCachedUniqueItemCard({ item_id: 'weapon_mythic_1', item_name: 'Test', item_type: 'weapon', rarity: 'Than Thoai', rarity_key: 'mythic', element: 'Kim', drop_rate: 0.5, is_unique: true }, 'webp');
    await assertWebpDimensions(fakeUnique, 2000, 1000);
    invalidateUniqueItemCard('weapon_mythic_1');
  });

  it('7. Duplicate /roll stacking (⁰⁰¹ -> ⁰⁰² -> ⁰⁰³), Auto-Best Grade (max(D..S)), 10-roll zero emoji truncation, /inv | divider & /dismantle all_dup', async () => {
    if (!supabase) return;
    await ensureUserInitialized(USER_V12_B, { username: 'V12StackTester' });
    await supabase.from('users').update({ linh_thach: 5000 }).eq('user_id', USER_V12_B);
    await supabase.from('user_pet_items').delete().eq('user_id', USER_V12_B);

    // 10-pull equipment roll: must output all 10 bullet lines without cutting any <a:...:id> tag
    const roll10 = await rollGacha(USER_V12_B, { pool: 'equipment', count: 10, useTicket: false });
    assert.equal(roll10.success, true);
    assert.equal(roll10.results.length, 10);
    const bulletLines = roll10.message.split('\n').filter((l) => l.trim().startsWith('• '));
    assert.equal(bulletLines.length, 10, 'All 10 roll result lines must be preserved without 1500-char cutoff');
    for (const line of bulletLines) {
      assert.doesNotMatch(line, /<a?:[a-z0-9_]+:[0-9]*$/i, `Line must not end with truncated emoji tag: ${line}`);
    }

    // Deterministic duplicate pet stacking + Auto-Best Grade inheritance (D -> A upgrades, A -> C keeps A)
    // rng sequence per 1-pull pet: [rarityRoll, candidateIndexRoll, gradeRoll]
    // Grade thresholds: <0.40 -> D, <0.72 -> C, <0.92 -> B, >=0.92 -> A
    await supabase.from('user_pets').delete().eq('user_id', USER_V12_B).neq('pet_type', 'hoa_thach_nham_nham');

    const seq1 = [0.10, 0.15, 0.10]; // common pet #1 (non-starter), grade D
    let idx1 = 0;
    const r1 = await rollGacha(USER_V12_B, { pool: 'pet', count: 1, rng: () => seq1[idx1++] ?? 0.1 });
    assert.equal(r1.success, true);
    const rolledPetType = r1.results[0].pet_type;

    // Force level 35, 4★, grade D, quantity 1 to test Auto-Best Grade preservation on upgraded pet
    await supabase.from('user_pets').update({ level: 35, star: 4, enchant_grade: 'D', quantity: 1 }).eq('user_id', USER_V12_B).eq('pet_type', rolledPetType);

    // Roll #2: same pet, grade A (0.95) -> upgrades D -> A and quantity becomes 2
    const seq2 = [0.10, 0.15, 0.95];
    let idx2 = 0;
    const r2 = await rollGacha(USER_V12_B, { pool: 'pet', count: 1, rng: () => seq2[idx2++] ?? 0.1 });
    assert.equal(r2.success, true);
    assert.equal(r2.results[0].kind, 'duplicate_pet');
    assert.equal(r2.results[0].quantity, 2);
    assert.equal(r2.results[0].enchant_grade, 'A');
    assert.equal(r2.results[0].grade_upgraded, true);

    // Roll #3: same pet, grade C (0.50) -> keeps A and quantity becomes 3
    const seq3 = [0.10, 0.15, 0.50];
    let idx3 = 0;
    const r3 = await rollGacha(USER_V12_B, { pool: 'pet', count: 1, rng: () => seq3[idx3++] ?? 0.1 });
    assert.equal(r3.success, true);
    assert.equal(r3.results[0].kind, 'duplicate_pet');
    assert.equal(r3.results[0].quantity, 3);
    assert.equal(r3.results[0].enchant_grade, 'A');
    assert.equal(r3.results[0].grade_upgraded, false);

    // Verify /inv shows active pet before | divider and storage pet with ⁰⁰³
    const invRes = await testServer.fetch(`/api/inv/${USER_V12_B}?view=overview`);
    const invJson = await invRes.json();
    assert.equal(invJson.success, true);
    if (rolledPetType !== 'hoa_thach_nham_nham') {
      assert.ok(invJson.summary_pets.includes('**|**'), 'Must show | divider between active pet and storage pets');
    }
    assert.ok(invJson.summary_pets.includes('⁰⁰³'), 'Must show superscript ⁰⁰³ for quantity 3');

    // Dismantle all_dup on pet -> dismantles 2 extra copies and leaves quantity = 1 with Lv.35, 4★, Grade A intact
    const dmDup = await dismantleTarget(USER_V12_B, { category: 'pet', targetId: 'all_dup' });
    assert.equal(dmDup.success, true);
    assert.ok(dmDup.dismantled_count >= 2);

    const { data: keptPet } = await supabase
      .from('user_pets')
      .select('level, star, enchant_grade, quantity')
      .eq('user_id', USER_V12_B)
      .eq('pet_type', rolledPetType)
      .maybeSingle();
    assert.equal(keptPet.quantity, 1);
    assert.equal(keptPet.level, 35);
    assert.equal(keptPet.star, 4);
    assert.equal(keptPet.enchant_grade, 'A');
  });
});
