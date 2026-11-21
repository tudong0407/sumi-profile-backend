import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestServer } from '../helpers/testServer.js';
import { supabase } from '../../src/config/supabase.js';
import {
  MULTI_PERK_ROLES,
  GACHA_ROLE_CATALOG,
} from '../../src/data/catalog.js';
import {
  computeRoleBuffTotalsFromList,
  ensureUserInitialized,
} from '../../src/services/profileService.js';
import {
  rollGacha,
  claimDaily,
  sendGift,
  cleanupExpiredRoles,
  getDailyLtGiftLimitByLevel,
} from '../../src/services/economyService.js';
import { trackQuestActivity } from '../../src/services/questService.js';
import { compileCombatant } from '../../src/services/battleEngine/statsCompiler.js';

const USER_A = '999999999999999941';
const USER_B = '999999999999999942';

async function cleanup() {
  if (!supabase) return;
  for (const uid of [USER_A, USER_B]) {
    await supabase.from('gift_logs').delete().or(`sender_id.eq.${uid},receiver_id.eq.${uid}`);
    await supabase.from('user_quests').delete().eq('user_id', uid);
    await supabase.from('user_inventory').delete().eq('user_id', uid);
    await supabase.from('user_pets').delete().eq('user_id', uid);
    await supabase.from('user_roles').delete().eq('user_id', uid);
    await supabase.from('user_pet_items').delete().eq('user_id', uid);
    await supabase.from('shop_selections').delete().eq('user_id', uid);
    await supabase.from('users').delete().eq('user_id', uid);
  }
}

describe('Tier 1 - Phase 4+ Multi-Perk Roles, Role Gacha, Quests/Tower, Leaderboard, Gift & Cron Cleanup', () => {
  let testServer;

  before(async () => {
    testServer = await createTestServer();
    await cleanup();
  });

  after(async () => {
    await cleanup();
    if (testServer) await testServer.close();
  });

  it('1. Catalog integrity: 14 Multi-Perk Roles + 40-Role Gacha Pool + Level/Role Buff computation', async () => {
    assert.equal(MULTI_PERK_ROLES.length, 14);
    assert.equal(GACHA_ROLE_CATALOG.length, 40);

    // Lv.100 Level Role + « Vạn Bảo Tài Thần » + « Chiến Hồn Tiên Phong »
    const buffs = computeRoleBuffTotalsFromList(['1573577808867762186', '1573577794091225108'], 100);
    assert.equal(buffs.expBonusPct, 50);
    assert.equal(buffs.dailyLtBonusPct, 50 + 35);
    assert.equal(buffs.petPowerBonusPct, 20 + 8);
    assert.equal(buffs.shopDiscountPct, 10);
    assert.equal(buffs.gachaDiscountPct, 10);

    // statsCompiler applies role_pet_power_bonus_pct cleanly
    const baseCompiled = await compileCombatant({
      user_id: USER_A,
      username: 'Tester',
      level: 10,
      role_pet_power_bonus_pct: 0,
      pet: { pet_name: 'TestPet', pet_type: 'starter_rock', element: 'Thổ', atk: 100, def: 100, spd: 100 },
    });
    const buffedCompiled = await compileCombatant({
      user_id: USER_A,
      username: 'Tester',
      level: 10,
      role_pet_power_bonus_pct: 20,
      pet: { pet_name: 'TestPet', pet_type: 'starter_rock', element: 'Thổ', atk: 100, def: 100, spd: 100 },
    });
    assert.equal(buffedCompiled.atk, Math.round(baseCompiled.atk * 1.2));
    assert.equal(buffedCompiled.def, Math.round(baseCompiled.def * 1.2));
    assert.equal(buffedCompiled.spd, Math.round(baseCompiled.spd * 1.2));
  });

  it('2. /roll loai:role supports 2-tier rarity×duration, day-stacking, permanent upgrade & duplicate refund', async () => {
    if (!supabase) return;
    await ensureUserInitialized(USER_A, { username: 'RoleTesterA' });
    await supabase.from('users').update({ level: 25, max_role_slots: 2, linh_thach: 2000 }).eq('user_id', USER_A);

    // Seed RNG sequence helper (each roll uses: rarityRoll, candidatePickRoll, durationRoll)
    const seq = (vals) => {
      let i = 0;
      return () => vals[Math.min(i++, vals.length - 1)];
    };

    // Roll 1: common (0.8 -> r=80), index 0 (0.0), duration 7d (0.95 -> dRoll=95)
    const r1 = await rollGacha(USER_A, { pool: 'role', count: 1, rng: seq([0.8, 0.0, 0.95]) });
    assert.equal(r1.success, true);
    assert.equal(r1.cost, 50);
    assert.equal(r1.results[0].kind, 'new_role');
    assert.equal(r1.results[0].duration, '7d');
    const rolledRoleId = r1.results[0].role_id;
    const firstExpMs = new Date(r1.results[0].expires_at).getTime();

    // Roll 2: SAME role (0.8, 0.0), duration 30d (0.5 -> dRoll=50 -> 30d) => MUST stack +30d!
    const r2 = await rollGacha(USER_A, { pool: 'role', count: 1, rng: seq([0.8, 0.0, 0.5]) });
    assert.equal(r2.success, true);
    assert.equal(r2.results[0].kind, 'stack_role');
    assert.equal(r2.results[0].role_id, rolledRoleId);
    const stackedExpMs = new Date(r2.results[0].expires_at).getTime();
    const diffDays = Math.round((stackedExpMs - firstExpMs) / 86400000);
    assert.equal(diffDays, 30, `Expected +30 days stacked, got ${diffDays}`);

    // Roll 3: SAME role, duration Permanent (0.01 -> dRoll=1 -> < 2 => permanent) => MUST upgrade to permanent!
    const r3 = await rollGacha(USER_A, { pool: 'role', count: 1, rng: seq([0.8, 0.0, 0.01]) });
    assert.equal(r3.success, true);
    assert.equal(r3.results[0].kind, 'upgrade_permanent');
    assert.equal(r3.results[0].is_permanent, true);

    // Roll 4: SAME role again when already permanent => MUST refund Linh Thạch!
    const r4 = await rollGacha(USER_A, { pool: 'role', count: 1, rng: seq([0.8, 0.0, 0.5]) });
    assert.equal(r4.success, true);
    assert.equal(r4.results[0].kind, 'duplicate_role_refund');
    assert.ok(r4.refund_linh_thach > 0);
  });

  it('3. Buff Roles discount Shop & Roll and boost /daily Linh Thạch', async () => {
    if (!supabase) return;
    // Equip « Vạn Bảo Tài Thần » (1573577808867762186: +35% Daily LT, -10% Shop, -10% Gacha)
    await ensureUserInitialized(USER_B, { username: 'RoleTesterB' });
    await supabase.from('users').update({ level: 40, max_role_slots: 3, linh_thach: 5000 }).eq('user_id', USER_B);
    await supabase.from('user_roles').insert({
      user_id: USER_B,
      role_id: '1573577808867762186',
      role_name: '« Vạn Bảo Tài Thần »',
      role_perk: 'Buff',
      is_permanent: true,
      is_equipped: true,
      equipped_slot: 1,
    });

    // Daily with Lv.35(+10% level) + Vạn Bảo Tài Thần(+35%) = +45% over base (rng=0 -> base=40 => 58 LT)
    const dailyRes = await claimDaily(USER_B, { rng: () => 0 });
    assert.equal(dailyRes.success, true);
    assert.equal(dailyRes.role_bonus_pct, 45);
    assert.equal(dailyRes.reward, Math.round(40 * (1 + 0.45)));

    // Roll cost -10%: 50 -> 45 LT
    const rollRes = await rollGacha(USER_B, { pool: 'equipment', count: 1, rng: () => 0.8 });
    assert.equal(rollRes.success, true);
    assert.equal(rollRes.cost, 45);

    // Shop preview & buy ring_common (base 500 -> -10% = 450 LT)
    const prevRes = await testServer.fetch('/api/shop/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: USER_B, category: 'rings', itemId: 'ring_common' }),
    });
    assert.equal(prevRes.status, 200);
    const pj = await prevRes.json();
    assert.equal(pj.price, 450);

    const buyRes = await testServer.fetch('/api/shop/buy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: USER_B, category: 'rings', itemId: 'ring_common' }),
    });
    assert.equal(buyRes.status, 200);
    assert.equal((await buyRes.json()).cost, 450);
  });

  it('4. GET /api/leaderboard returns valid data for all 4 ranking types', async () => {
    if (!supabase) return;
    for (const type of ['level', 'power', 'wealth', 'marry']) {
      const res = await testServer.fetch(`/api/leaderboard?type=${type}&limit=5`);
      assert.equal(res.status, 200);
      const j = await res.json();
      assert.equal(j.success, true);
      assert.equal(j.type, type);
      assert.ok(Array.isArray(j.entries));
    }
  });

  it('5. /nhiemvu: status, Tower PvE challenge, attempt cap (5/day), and Claim 3/3 quests', async () => {
    if (!supabase) return;
    // Ensure USER_B checked in today (/daily done in test 3) & has quest row reset cleanly
    await supabase.from('user_quests').delete().eq('user_id', USER_B);

    const statusBefore = await testServer.fetch(`/api/quest/status/${USER_B}`);
    assert.equal(statusBefore.status, 200);
    const sbj = await statusBefore.json();
    assert.equal(sbj.tower_floor, 0);
    assert.equal(sbj.can_claim, false);

    // Claim before completing all 3 quests must fail 400
    const prematureClaim = await testServer.fetch('/api/quest/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: USER_B }),
    });
    assert.equal(prematureClaim.status, 400);

    // Challenge Tower floor 1 (Lv.40 user beats Floor 1 easily!)
    const towerRes = await testServer.fetch('/api/quest/tower', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: USER_B }),
    });
    assert.equal(towerRes.status, 200);
    const tj = await towerRes.json();
    assert.equal(tj.success, true);
    assert.equal(tj.floor, 1);
    assert.equal(tj.won, true);
    assert.equal(tj.new_tower_floor, 1);
    assert.ok(tj.reward_linh_thach > 0);
    assert.equal(tj.attempts_used, 1);

    // Add 60 chat EXP deterministically for 3/3 quest verification
    await trackQuestActivity(USER_B, { expDelta: 60 });

    const statusReady = await testServer.fetch(`/api/quest/status/${USER_B}`);
    const srj = await statusReady.json();
    assert.equal(srj.all_completed, true);
    assert.equal(srj.can_claim, true);

    const claimOk = await testServer.fetch('/api/quest/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: USER_B }),
    });
    assert.equal(claimOk.status, 200);
    const cj = await claimOk.json();
    assert.equal(cj.reward_linh_thach, 100);

    // Double claim rejected
    const claimAgain = await testServer.fetch('/api/quest/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: USER_B }),
    });
    assert.equal(claimAgain.status, 400);

    // Simulate 5 tower attempts reached -> 6th blocked with 400 TOWER_LIMIT_REACHED
    await supabase.from('user_quests').update({ tower_attempts_today: 5 }).eq('user_id', USER_B);
    const cappedTower = await testServer.fetch('/api/quest/tower', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: USER_B }),
    });
    assert.equal(cappedTower.status, 400);
  });

  it('6. /tangqua enforces Lv.10+, 5% tax, +5000 LT/day per 10 levels scaling & 5 items/day cap', async () => {
    if (!supabase) return;
    assert.equal(getDailyLtGiftLimitByLevel(9), 0);
    assert.equal(getDailyLtGiftLimitByLevel(10), 5000);
    assert.equal(getDailyLtGiftLimitByLevel(19), 5000);
    assert.equal(getDailyLtGiftLimitByLevel(20), 10000);
    assert.equal(getDailyLtGiftLimitByLevel(100), 50000);

    // Lower USER_A below Lv.10 -> blocked!
    await supabase.from('users').update({ level: 5, linh_thach: 20000 }).eq('user_id', USER_A);
    const lowRes = await sendGift(USER_A, USER_B, 'linh_thach', 100);
    assert.equal(lowRes.success, false);
    assert.equal(lowRes.error, 'LEVEL_TOO_LOW');

    // Raise USER_A to Lv.10 -> daily cap 5,000 LT (send 1000 ok, another 4001 fails!)
    await supabase.from('users').update({ level: 10, linh_thach: 20000 }).eq('user_id', USER_A);
    const { data: recBefore } = await supabase.from('users').select('linh_thach').eq('user_id', USER_B).single();
    const okRes = await testServer.fetch('/api/economy/gift', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ senderId: USER_A, receiverId: USER_B, giftType: 'linh_thach', amount: 1000 }),
    });
    assert.equal(okRes.status, 200);
    const gj = await okRes.json();
    assert.equal(gj.tax_amount, 50);
    assert.equal(gj.received_amount, 950);
    assert.equal(gj.daily_limit, 5000);
    assert.equal(gj.sender_balance, 19000);
    assert.equal(gj.receiver_balance, Number(recBefore.linh_thach) + 950);

    const overLt = await sendGift(USER_A, USER_B, 'linh_thach', 4001);
    assert.equal(overLt.success, false);
    assert.equal(overLt.error, 'DAILY_LT_GIFT_LIMIT');
    assert.equal(overLt.daily_limit, 5000);

    // Raise USER_A to Lv.20 -> cap increases to 10,000 LT/day -> sending another 5,000 succeeds (6,000/10,000)
    await supabase.from('users').update({ level: 20 }).eq('user_id', USER_A);
    const lv20Ok = await sendGift(USER_A, USER_B, 'linh_thach', 5000);
    assert.equal(lv20Ok.success, true);
    assert.equal(lv20Ok.daily_limit, 10000);
    assert.equal(lv20Ok.sent_today, 6000);

    // Item gift: give USER_A 6 star stones, send 5 succeeds, 1 more hits DAILY_ITEM_GIFT_LIMIT
    await supabase.from('user_inventory').upsert({
      user_id: USER_A,
      item_id: 'pet_star_stone',
      item_category: 'consumable',
      quantity: 6,
    }, { onConflict: 'user_id,item_id' });
    const itemOk = await sendGift(USER_A, USER_B, 'pet_star_stone', 5);
    assert.equal(itemOk.success, true);
    assert.equal(itemOk.tax_amount, 0);
    const itemCap = await sendGift(USER_A, USER_B, 'pet_star_stone', 1);
    assert.equal(itemCap.success, false);
    assert.equal(itemCap.error, 'DAILY_ITEM_GIFT_LIMIT');
  });

  it('7. POST /api/roles/cleanup-expired enforces x-api-key (401) and cleans expired timed roles cleanly', async () => {
    if (!supabase) return;

    const prevKey = process.env.BACKEND_API_KEY;
    process.env.BACKEND_API_KEY = 'sumi-cron-secret-test';
    try {
      const noKey = await testServer.fetch('/api/roles/cleanup-expired', { method: 'POST' });
      assert.equal(noKey.status, 401);

      // Insert 1 expired timed role (oldest timestamp so it sorts first) & 1 permanent role on USER_A
      const expiredIso = '2000-01-01T00:00:00.000Z';
      await supabase.from('user_roles').delete().eq('user_id', USER_A);
      await supabase.from('user_roles').insert([
        {
          user_id: USER_A,
          role_id: '1573186049289756712',
          role_name: '« Phong Thanh Sứ Giả »',
          role_perk: 'Test Expired',
          is_permanent: false,
          expires_at: expiredIso,
          is_equipped: true,
          equipped_slot: 1,
        },
        {
          user_id: USER_A,
          role_id: '1573186091094245416',
          role_name: '« Tài Vận Hanh Thông »',
          role_perk: 'Test Perm',
          is_permanent: true,
          expires_at: null,
          is_equipped: true,
          equipped_slot: 2,
        },
      ]);

      const cronRes = await testServer.fetch('/api/roles/cleanup-expired', {
        method: 'POST',
        headers: { 'x-api-key': 'sumi-cron-secret-test' },
      });
      assert.equal(cronRes.status, 200);
      const cj = await cronRes.json();
      assert.equal(cj.has_expired, 'true');
      assert.equal(cj.target_user_id, USER_A);
      assert.equal(cj.remove_role_csv, '1573186049289756712');

      // Ensure permanent role stayed untouched in DB
      const { data: remRoles } = await supabase.from('user_roles').select('*').eq('user_id', USER_A);
      assert.equal(remRoles.length, 1);
      assert.equal(remRoles[0].role_id, '1573186091094245416');
      assert.equal(remRoles[0].is_permanent, true);
    } finally {
      if (prevKey === undefined) delete process.env.BACKEND_API_KEY;
      else process.env.BACKEND_API_KEY = prevKey;
    }
  });

  it('8. /roll with 0 Linh Thạch returns safe fallback fields and beginner tip message', async () => {
    if (!supabase) return;
    await ensureUserInitialized(USER_A, { username: 'NewbieRollTest' });
    await supabase.from('users').update({ linh_thach: 0 }).eq('user_id', USER_A);

    const res = await testServer.fetch('/api/economy/roll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: USER_A, pool: 'pet', count: 1 }),
    });
    assert.equal(res.status, 400);
    const j = await res.json();
    assert.equal(j.error, 'INSUFFICIENT_LINH_THACH');
    assert.equal(j.count, 1);
    assert.equal(j.cost, 50);
    assert.equal(j.linh_thach_fmt, '0');
    assert.equal(j.refund_linh_thach, 0);
    assert.equal(j.bonus_star_stones, 0);
    assert.equal(j.has_roles, 'false');
    assert.ok(typeof j.summary_results === 'string' && j.summary_results.length > 0);
    assert.ok(j.message.includes('/daily') && j.message.includes('/nhiemvu'));
  });

  it('9. POST /api/dismantle refunds exactly 50% for timed Role, permanent Role & Equipment', async () => {
    if (!supabase) return;
    await ensureUserInitialized(USER_A, { username: 'DismantleTester' });
    await supabase.from('users').update({ linh_thach: 100 }).eq('user_id', USER_A);
    await supabase.from('user_roles').delete().eq('user_id', USER_A);

    // Level Role cannot be dismantled via /dismantle (direct ID or via equipped slot #1)
    const lvlRes = await testServer.fetch('/api/dismantle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: USER_A, category: 'role', targetId: '1038406122417176586' }),
    });
    assert.equal(lvlRes.status, 400);
    assert.equal((await lvlRes.json()).error, 'LEVEL_ROLE_CANNOT_DISMANTLE');

    // Anti-bypass: A user who manually self-assigns a Discord Role outside the bot (not in Supabase user_roles) CANNOT dismantle it
    const selfAddedBypass = await testServer.fetch('/api/dismantle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: USER_A, category: 'role', targetId: '1573186011478102096' }),
    });
    assert.equal(selfAddedBypass.status, 404);
    assert.equal((await selfAddedBypass.json()).error, 'ROLE_NOT_OWNED');

    // Insert 7d timed Shop Role (« Thần Hành Cốt Cách » 7d = 150 -> 50% = 75 LT) & permanent Multi-Perk Role (« Vạn Bảo Tài Thần » permanent = 10000 -> 50% = 5000 LT)
    const exp7d = new Date(Date.now() + 7 * 86400000 - 1000).toISOString();
    await supabase.from('user_roles').insert([
      {
        user_id: USER_A,
        role_id: '1573186049289756712',
        role_name: '« Thần Hành Cốt Cách »',
        role_perk: 'Slowmode',
        is_permanent: false,
        expires_at: exp7d,
        is_equipped: true,
        equipped_slot: 1,
      },
      {
        user_id: USER_A,
        role_id: '1573577808867762186',
        role_name: '« Vạn Bảo Tài Thần »',
        role_perk: 'Multi',
        is_permanent: true,
        expires_at: null,
        is_equipped: false,
        equipped_slot: null,
      },
    ]);

    const d7 = await testServer.fetch('/api/dismantle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: USER_A, category: 'role', targetId: '1573186049289756712' }),
    });
    assert.equal(d7.status, 200);
    const j7 = await d7.json();
    assert.equal(j7.base_value, 150);
    assert.equal(j7.refund_linh_thach, 75);
    assert.equal(j7.remove_role_id, '1573186049289756712');
    assert.equal(j7.linh_thach, 175);

    const dPerm = await testServer.fetch('/api/dismantle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: USER_A, targetId: 'Vạn Bảo Tài Thần' }),
    });
    assert.equal(dPerm.status, 200);
    const jp = await dPerm.json();
    assert.equal(jp.base_value, 10000);
    assert.equal(jp.refund_linh_thach, 5000);
    assert.equal(jp.linh_thach, 5175);

    // Equipment dismantle: weapon_common_1 (250 -> 50% = 125 LT)
    await supabase.from('user_pet_items').delete().eq('user_id', USER_A);
    await supabase.from('user_pet_items').insert({
      user_id: USER_A,
      item_id: 'weapon_common_1',
      equipped_to_pet: null,
      slot: null,
    });
    const dItem = await testServer.fetch('/api/dismantle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: USER_A, category: 'item', targetId: 'weapon_common_1' }),
    });
    assert.equal(dItem.status, 200);
    const ji = await dItem.json();
    assert.equal(ji.base_value, 250);
    assert.equal(ji.refund_linh_thach, 125);
    assert.equal(ji.remove_role_id, '');
    assert.equal(ji.linh_thach, 5300);
  });
});
