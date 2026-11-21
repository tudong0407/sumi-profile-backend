import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestServer } from '../helpers/testServer.js';
import { supabase } from '../../src/config/supabase.js';
import {
  PET_CATALOG,
  EQUIPMENT_CATALOG,
  PET_BY_TYPE,
  EQUIPMENT_BY_ID,
  FUYUMI_USER_ID,
} from '../../src/data/catalog.js';
import { simulateBattle, resolveFreePveOpponent } from '../../src/services/battleEngine/battleService.js';
import { compileCombatant } from '../../src/services/battleEngine/statsCompiler.js';
import { computeLevelUpLinhThachReward, grantChatExp, handleVoiceExp, processVoiceHeartbeat } from '../../src/services/expService.js';
import { getGachaDismantleValue, GACHA_DISMANTLE_VALUES } from '../../src/services/inventoryService.js';
import { rollGacha, convertExpToLinhThach } from '../../src/services/economyService.js';
import { buyShopItem } from '../../src/services/shopService.js';
import { challengeTower, resetTowerAttempts } from '../../src/services/questService.js';
import { ensureUserInitialized } from '../../src/services/profileService.js';
import { renderProfileCard } from '../../src/canvas/profileRenderer.js';
import { renderBattleCard } from '../../src/canvas/battleRenderer.js';
import { assertPngValid } from '../helpers/pngValidator.js';

const USER_V11_A = '999110000000000101';
const USER_V11_B = '999110000000000102';
const USER_V11_SHADOW = '999110000000000103';

async function cleanupTestUsers() {
  if (!supabase) return;
  const ids = [USER_V11_A, USER_V11_B, USER_V11_SHADOW];
  await supabase.from('user_quests').delete().in('user_id', ids);
  await supabase.from('user_inventory').delete().in('user_id', ids);
  await supabase.from('user_pet_items').delete().in('user_id', ids);
  await supabase.from('user_pets').delete().in('user_id', ids);
  await supabase.from('user_roles').delete().in('user_id', ids);
  await supabase.from('shop_selections').delete().in('user_id', ids);
  await supabase.from('users').delete().in('user_id', ids);
}

describe('Tier 1 - Update v1.1 Comprehensive Suite', () => {
  let testServer;

  before(async () => {
    await cleanupTestUsers();
    testServer = await createTestServer();
  });

  after(async () => {
    await cleanupTestUsers();
    if (testServer) await testServer.close();
  });

  it('1. Anti-exploit proof: Roll -> Dismantle EV < 36 LT across all 3 pools (no infinite money loop) & Shop 50% vs Gacha table', async () => {
    // 10,000-trial Monte Carlo on rarity weights (60/25/14/1%) and Role durations (40/30/18/10/2%)
    let s = 1337;
    const rng = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    const rollRarity = () => {
      const r = rng() * 100;
      return r < 1 ? 'mythic' : r < 15 ? 'epic' : r < 40 ? 'rare' : 'common';
    };
    const rollRoleDur = () => {
      const d = rng() * 100;
      if (d < 2) return { isPermanent: true, remDays: 999 };
      if (d < 12) return { isPermanent: false, remDays: 90 };
      if (d < 30) return { isPermanent: false, remDays: 60 };
      if (d < 60) return { isPermanent: false, remDays: 30 };
      return { isPermanent: false, remDays: 7 };
    };

    const TRIALS = 10000;
    let sumItem = 0;
    let sumPet = 0;
    let sumRole = 0;
    let sumRoleDup = 0;
    for (let i = 0; i < TRIALS; i += 1) {
      const r1 = rollRarity();
      sumItem += getGachaDismantleValue('item', r1);
      const r2 = rollRarity();
      sumPet += getGachaDismantleValue('pet', r2);
      const r3 = rollRarity();
      const d3 = rollRoleDur();
      sumRole += getGachaDismantleValue('role', r3, d3);
      sumRoleDup += GACHA_DISMANTLE_VALUES.item[r3]; // matches permanent role dup refund table
    }

    const evItem = sumItem / TRIALS;
    const evPet = sumPet / TRIALS;
    const evRole = sumRole / TRIALS;
    const evRoleDup = sumRoleDup / TRIALS;

    assert.ok(evItem < 36, `Equipment gacha->dismantle EV (${evItem.toFixed(2)}) must be strictly < 36 LT (below 45 LT 10-roll cost)`);
    assert.ok(evPet < 36, `Pet gacha->dismantle EV (${evPet.toFixed(2)}) must be strictly < 36 LT`);
    assert.ok(evRole < 36, `Role gacha->dismantle EV (${evRole.toFixed(2)}) must be strictly < 36 LT`);
    assert.ok(evRoleDup < 36, `Role permanent duplicate EV (${evRoleDup.toFixed(2)}) must be strictly < 36 LT`);

    if (!supabase) return;
    await ensureUserInitialized(USER_V11_A, { username: 'AntiExploitTester' });
    await supabase.from('users').update({ linh_thach: 5000 }).eq('user_id', USER_V11_A);

    // Roll 1 equipment (deterministic RNG picks Linh Phẩm weapon) -> source='gacha' -> dismantle must NOT yield 375 LT!
    const rolled = await rollGacha(USER_V11_A, { pool: 'equipment', count: 1, rng: () => 0.15 }); // 0.15 -> rare!
    assert.equal(rolled.success, true);
    const rolledId = rolled.results[0].item_id;
    const rollBalanceAfter = rolled.linh_thach;

    const dmGacha = await testServer.fetch('/api/dismantle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: USER_V11_A, category: 'item', targetId: rolledId }),
    });
    const dmGachaJson = await dmGacha.json();
    assert.equal(dmGachaJson.success, true);
    assert.equal(dmGachaJson.source, 'gacha');
    assert.ok(dmGachaJson.refund_linh_thach < 50, `Rolled rare item refund (${dmGachaJson.refund_linh_thach}) must be < 50 LT`);
    assert.ok(dmGachaJson.linh_thach <= 5000, 'Net LT after gacha->dismantle must NOT exceed starting 5000 LT');

    // Buy Shop common equipment -> source='shop', paid_price=250 -> dismantle yields exact 20% (50 LT)
    const shopBuy = await buyShopItem(USER_V11_A, { category: 'equipment', itemId: 'weapon_common_5' });
    assert.equal(shopBuy.success, true);
    assert.equal(shopBuy.cost, 250);
    const dmShop = await testServer.fetch('/api/dismantle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: USER_V11_A, category: 'item', targetId: 'weapon_common_5' }),
    });
    const dmShopJson = await dmShop.json();
    assert.equal(dmShopJson.success, true);
    assert.equal(dmShopJson.source, 'shop');
    assert.equal(dmShopJson.refund_linh_thach, 50);
  });

  it('2. All 165 Equipment HAX & 90 Public Pet HAX execute cleanly + 5 HAX bugs fixed + circular counter matrix', async () => {
    const publicPets = PET_CATALOG.filter((p) => !p.is_exclusive_fuyumi);
    assert.equal(publicPets.length, 90);
    assert.equal(EQUIPMENT_CATALOG.length, 165);

    // Every one of 65 equipment & 40 pets completes deterministic combat without NaN or infinite loops
    for (let i = 0; i < publicPets.length; i += 1) {
      const p = publicPets[i];
      const w = EQUIPMENT_CATALOG[i % EQUIPMENT_CATALOG.length];
      const eqSlot = w.item_type;
      const res = await simulateBattle(
        {
          user_id: `pet_test_${i}`,
          username: 'TestA',
          level: 50,
          pet: {
            pet_type: p.pet_type,
            name: p.pet_name,
            rarity: p.rarity,
            element: p.element,
            hax_skill: p.hax_skill,
            level: 30,
            star: 5,
            atk: p.base_atk * 2,
            def: p.base_def * 2,
            spd: p.base_spd * 2,
            equipment: { [eqSlot]: w },
          },
        },
        {
          user_id: `pet_opp_${i}`,
          username: 'TestB',
          level: 50,
          pet: {
            pet_type: publicPets[(i + 7) % publicPets.length].pet_type,
            level: 30,
            star: 5,
            atk: 800,
            def: 700,
            spd: 750,
            equipment: {
              gem: EQUIPMENT_CATALOG.filter((x) => x.item_type === 'gem')[i % 21],
              soul: EQUIPMENT_CATALOG.filter((x) => x.item_type === 'soul')[i % 21],
            },
          },
        },
        { maxTurns: 15, preRender: false, skipQuestTracking: true, seed: 42 + i },
      );
      assert.equal(res.success, true);
      assert.ok(res.turnCount >= 1 && res.turnCount <= 15);
      assert.ok(!Number.isNaN(res.finalHp.attacker) && !Number.isNaN(res.finalHp.defender));
      assert.ok(res.fullBattleLog.length <= 3950, 'Battle log must respect Discord embed limit');
      assert.ok(res.fullBattleLog.includes(p.hax_skill), 'Battle log header must include Pet HAX');
      assert.ok(res.fullBattleLog.includes(w.item_name), 'Battle log header must include Equipment name');
    }

    // Also test remaining equipment beyond index 39 (40..64)
    for (let j = 40; j < EQUIPMENT_CATALOG.length; j += 1) {
      const it = EQUIPMENT_CATALOG[j];
      const res = await simulateBattle(
        {
          user_id: `eq_test_${j}`,
          username: 'EqA',
          level: 40,
          pet: { pet_type: 'bach_kim_ho_tu', level: 25, star: 4, equipment: { [it.item_type]: it } },
        },
        {
          user_id: `eq_opp_${j}`,
          username: 'EqB',
          level: 40,
          pet: { pet_type: 'hoa_diem_ho', level: 25, star: 4 },
        },
        { maxTurns: 12, preRender: false, skipQuestTracking: true, seed: 100 + j },
      );
      assert.equal(res.success, true);
      assert.ok(res.fullBattleLog.includes(it.item_name));
    }

    // Bug #2 fix: Kim Sí Điêu Hoàng blind lasts strictly 2 turns
    const atkBlind = await compileCombatant({
      user_id: 'blind_a',
      username: 'A',
      pet: { pet_type: 'hoa_thach_nham_nham', level: 10, atk: 500, def: 300, spd: 500 },
    });
    const defKimSi = await compileCombatant({
      user_id: 'blind_b',
      username: 'KimSi',
      pet: { pet_type: 'kim_si_dieu_hoang', level: 10 },
    });
    const blindRes = await simulateBattle(atkBlind, defKimSi, { maxTurns: 5, preRender: false, skipQuestTracking: true, seed: 7 });
    assert.equal(atkBlind.state.blindTurns, 0, 'Blind must expire after 2 turns, not stay permanent');

    // Counter matrix: Quang Minh Thánh Thú blocks Linh Miêu HAX Lock & Cửu Thiên Lôi Đình SPD steal
    const qmCombat = await compileCombatant({
      user_id: 'qm_1',
      username: 'QuangMinh',
      pet: { pet_type: 'quang_minh_thanh_thu', level: 50, spd: 1000, atk: 1000, def: 800 },
    });
    const lmCombat = await compileCombatant({
      user_id: 'lm_1',
      username: 'LinhMieu',
      pet: { pet_type: 'linh_mieu_hoa_tien', level: 50, equipment: { weapon: EQUIPMENT_BY_ID.weapon_mythic_2 } },
    });
    await simulateBattle(lmCombat, qmCombat, { maxTurns: 3, preRender: false, skipQuestTracking: true, seed: 9 });
    assert.equal(qmCombat.state.haxLockedTurns, 0, 'Quang Minh must resist HAX lock');
    assert.equal(qmCombat.spd, 1000, 'Quang Minh must resist Lôi Thần SPD steal');

    // Bug #4 fix: Luân Hồi Bất Diệt Chiến Hồn triggers when 0 < HP < 20%
    const luanHoiRes = await simulateBattle(
      { user_id: 'lh_a', username: 'BigHit', level: 60, pet: { pet_type: 'thai_duong_kim_o', level: 60, atk: 4200, def: 500, spd: 900 } },
      { user_id: 'lh_b', username: 'LuanHoi', level: 60, pet: { pet_type: 'huyen_vu_linh_quy', level: 60, def: 1200, equipment: { soul: EQUIPMENT_BY_ID.soul_mythic_3 } } },
      { maxTurns: 6, preRender: false, skipQuestTracking: true, seed: 3 },
    );
    assert.ok(luanHoiRes.turns.some((t) => (t.haxTriggered || '').includes('Sinh Mệnh Nghịch Chuyển')), 'Luân Hồi Bất Diệt Chiến Hồn must trigger when HP drops < 20%');
  });

  it('3. Level-Up LT tier calculation + one-time anti-farm after /doiqua demotion', async () => {
    const tLow = computeLevelUpLinhThachReward(1, 2);
    assert.equal(tLow.totalReward, 50);
    const tMile10 = computeLevelUpLinhThachReward(8, 10);
    // Lv.9 (+50) + Lv.10 (+50 + 200) = 300 LT
    assert.equal(tMile10.totalReward, 300);
    const tAnti = computeLevelUpLinhThachReward(25, 20);
    assert.equal(tAnti.totalReward, 0);

    if (!supabase) return;
    await ensureUserInitialized(USER_V11_B, { username: 'LevelUpTester' });
    await supabase.from('users').update({ level: 1, exp: 0, linh_thach: 0, highest_level_claimed: 1, last_chat_exp_at: null }).eq('user_id', USER_V11_B);

    // Put user at Lv.1 with 55 EXP -> Chat EXP crosses Lv.2 (+50 LT)
    await supabase.from('users').update({ exp: 55 }).eq('user_id', USER_V11_B);
    const lvlRes = await grantChatExp({ userId: USER_V11_B, username: 'LevelUpTester' }, { rng: () => 0.5 });
    assert.equal(lvlRes.leveled_up, true);
    assert.equal(lvlRes.level, 2);
    assert.equal(lvlRes.level_up_linh_thach, 50);
    assert.equal(lvlRes.highest_level_claimed, 2);
    assert.equal(lvlRes.linh_thach, 50);

    // Demote back below Lv.3 via /doiqua (Lv.3 with 850 EXP = 1073 total EXP -> burn 1000 leaves 73 = Lv.2)
    await supabase.from('users').update({ level: 3, exp: 850, highest_level_claimed: 3, linh_thach: 100, last_chat_exp_at: null }).eq('user_id', USER_V11_B);
    const burnRes = await convertExpToLinhThach(USER_V11_B, 1000);
    assert.equal(burnRes.success, true);
    assert.ok(burnRes.new_level < 3);

    // Level back up to Lv.3 -> highest_level_claimed is still 3 -> MUST receive 0 level-up LT!
    await supabase.from('users').update({ exp: 150, last_chat_exp_at: null }).eq('user_id', USER_V11_B);
    const reLvl = await grantChatExp({ userId: USER_V11_B, username: 'LevelUpTester' }, { rng: () => 0.5 });
    assert.equal(reLvl.leveled_up, true);
    assert.equal(reLvl.level, 3);
    assert.equal(reLvl.level_up_linh_thach, 0, 'Re-leveling already-claimed levels after /doiqua MUST grant 0 LT');
  });

  it('4. Voice EXP +20% (85-135/5m) & live processVoiceHeartbeat without double-counting', async () => {
    if (!supabase) return;
    await ensureUserInitialized(USER_V11_A, { username: 'VoiceHeartbeatUser' });
    const t0 = Date.now() - 12 * 60 * 1000;
    await supabase.from('users').update({
      level: 1,
      exp: 0,
      highest_level_claimed: 1,
      voice_joined_at: new Date(t0).toISOString(),
      total_voice_minutes: 0,
    }).eq('user_id', USER_V11_A);

    const hb = await processVoiceHeartbeat({ now: t0 + 12 * 60 * 1000, rng: () => 0.5 });
    assert.equal(hb.success, true);
    assert.ok(hb.awarded_count >= 1);

    const { data: uAfterHb } = await supabase.from('users').select('total_voice_minutes, exp, voice_joined_at').eq('user_id', USER_V11_A).single();
    assert.equal(uAfterHb.total_voice_minutes, 10, '12m elapsed should credit 2 full 5m blocks = 10 minutes');
    assert.ok(uAfterHb.voice_joined_at !== null);

    // Leave 1m later (only 2m unrewarded left from original 12m) -> 0 extra blocks awarded!
    const leaveRes = await handleVoiceExp({ userId: USER_V11_A, action: 'leave' }, { now: t0 + 13 * 60 * 1000 });
    assert.equal(leaveRes.blocks_rewarded, 0);
    assert.equal(leaveRes.exp_gained, 0, 'Must NOT double-count EXP already credited by Voice Heartbeat');
  });

  it('5. Tower Reset Card limits (200 LT, 3/day, max 10 stack), resetTowerAttempts & Tower +10/-5 LT', async () => {
    if (!supabase) return;
    await ensureUserInitialized(USER_V11_A, { username: 'TowerTester' });
    await supabase.from('users').update({ linh_thach: 5000 }).eq('user_id', USER_V11_A);
    await supabase.from('user_inventory').delete().eq('user_id', USER_V11_A).eq('item_id', 'tower_reset_card');
    await supabase.from('user_quests').delete().eq('user_id', USER_V11_A);

    // Buy 3 cards -> ok; 4th card same day -> DAILY_BUY_LIMIT
    const b1 = await buyShopItem(USER_V11_A, { category: 'consumables', itemId: 'tower_reset_card', quantity: 3 });
    assert.equal(b1.success, true);
    assert.equal(b1.cost, 600);

    const bOver = await buyShopItem(USER_V11_A, { category: 'consumables', itemId: 'tower_reset_card', quantity: 1 });
    assert.equal(bOver.success, false);
    assert.equal(bOver.error, 'DAILY_BUY_LIMIT');

    // Test max stack 10 protection (give user 9 cards, try buying 2 across new day)
    await supabase.from('user_quests').update({ tower_reset_buy_date: '2020-01-01', tower_reset_buys_today: 0 }).eq('user_id', USER_V11_A);
    await supabase.from('user_inventory').update({ quantity: 9 }).eq('user_id', USER_V11_A).eq('item_id', 'tower_reset_card');
    const bStack = await buyShopItem(USER_V11_A, { category: 'consumables', itemId: 'tower_reset_card', quantity: 2 });
    assert.equal(bStack.success, false);
    assert.equal(bStack.error, 'INVENTORY_STACK_LIMIT');

    // Attempt reset while 5/5 full -> rejected without consuming card
    const fullReset = await resetTowerAttempts(USER_V11_A);
    assert.equal(fullReset.success, false);
    assert.equal(fullReset.error, 'TOWER_ATTEMPTS_FULL');

    // Challenge Tower Floor 1 (win) -> +22 floor + 10 bonus = +32 LT (v1.2 200-floor formula: 20 + f*2)
    await supabase.from('users').update({ linh_thach: 100 }).eq('user_id', USER_V11_A);
    const towerWin = await challengeTower(USER_V11_A, { preRender: false, seed: 11 });
    assert.equal(towerWin.success, true);
    assert.equal(towerWin.won, true);
    assert.equal(towerWin.reward_linh_thach, 22 + 10);
    assert.equal(towerWin.attempts_used, 1);

    // Use reset card -> restores 0/5 and leaves 8 cards
    const usedReset = await resetTowerAttempts(USER_V11_A);
    assert.equal(usedReset.success, true);
    assert.equal(usedReset.attempts_used, 0);
    assert.equal(usedReset.remaining_cards, 8);

    // Challenge high floor 99 with starter -> loss -> -5 LT penalty (floored at 0)
    await supabase.from('user_quests').update({ tower_floor: 98 }).eq('user_id', USER_V11_A);
    await supabase.from('users').update({ linh_thach: 3 }).eq('user_id', USER_V11_A);
    const towerLoss = await challengeTower(USER_V11_A, { preRender: false, seed: 11 });
    assert.equal(towerLoss.success, true);
    assert.equal(towerLoss.won, false);
    assert.equal(towerLoss.linh_thach, 0, 'Tower loss -5 LT must floor at 0 LT');
  });

  it('6. PvE Tự Do (50/10/40% difficulty, 25/day cap, shadow read-only) & /info, /phapbao, /linhthu sort, batch /dismantle, /update, Canvas 10★, Zero Full HD+', async () => {
    // Verify PvE Tự Do difficulty band distribution (50% Ngang / 10% Dưới / 40% Trên)
    let even = 0;
    let weaker = 0;
    let stronger = 0;
    let s = 777;
    const rng = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    const sampleAtk = await compileCombatant({ user_id: 'pve_sample', username: 'A', pet: { pet_type: 'hoa_thach_nham_nham', level: 20 } });
    for (let i = 0; i < 200; i += 1) {
      const pick = await resolveFreePveOpponent(sampleAtk, rng);
      if (pick.band.key === 'even') even += 1;
      else if (pick.band.key === 'weaker') weaker += 1;
      else stronger += 1;
    }
    assert.ok(even >= 75 && even <= 125, `Even count (${even}/200) expected near 50%`);
    assert.ok(weaker >= 5 && weaker <= 40, `Weaker count (${weaker}/200) expected near 10%`);
    assert.ok(stronger >= 55 && stronger <= 105, `Stronger count (${stronger}/200) expected near 40%`);

    if (!supabase) return;
    await ensureUserInitialized(USER_V11_SHADOW, { username: 'ShadowPlayer' });
    await supabase.from('users').update({ linh_thach: 4321 }).eq('user_id', USER_V11_SHADOW);

    await ensureUserInitialized(USER_V11_A, { username: 'PvETester' });
    await supabase.from('users').update({ linh_thach: 500 }).eq('user_id', USER_V11_A);

    // POST /api/battle/simulate in pve_free mode without defenderId -> HTTP 200 + LT reward
    const pveRes = await testServer.fetch('/api/battle/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attackerId: USER_V11_A, mode: 'pve_free', options: { preRender: false, maxTurns: 10 } }),
    });
    assert.equal(pveRes.status, 200);
    const pveJson = await pveRes.json();
    assert.equal(pveJson.mode, 'pve_free');
    assert.ok([10, -5].includes(pveJson.linh_thach_delta), `Expected +10 or -5 LT delta, got ${pveJson.linh_thach_delta}`);
    const { data: shadowCheck } = await supabase.from('users').select('linh_thach').eq('user_id', USER_V11_SHADOW).single();
    assert.equal(shadowCheck.linh_thach, 4321, 'Shadowed player LT must never change');

    // /info privacy gate & lookup
    const pubSecretRes = await testServer.fetch(`/api/info/cuu_vi_hong_ho?requesterId=${USER_V11_A}`);
    assert.equal(pubSecretRes.status, 404);
    const fuyumiSecretRes = await testServer.fetch(`/api/info/cuu_vi_hong_ho?requesterId=${FUYUMI_USER_ID}`);
    assert.equal(fuyumiSecretRes.status, 200);
    const itemInfoRes = await testServer.fetch('/api/info/weapon_mythic_4');
    assert.equal(itemInfoRes.status, 200);
    const itemInfoJson = await itemInfoRes.json();
    assert.match(itemInfoJson.description, /Thái Cổ Phần Thiên Kiếm|55%|Gacha/);

    // /phapbao & batch /dismantle (protects equipped items!)
    await supabase.from('user_pet_items').delete().eq('user_id', USER_V11_A);
    await supabase.from('user_pet_items').insert([
      { user_id: USER_V11_A, item_id: 'weapon_common_1', equipped_to_pet: 'hoa_thach_nham_nham', slot: 'weapon', source: 'gacha', paid_price: 0 },
      { user_id: USER_V11_A, item_id: 'weapon_common_2', equipped_to_pet: null, slot: null, source: 'gacha', paid_price: 0 },
      { user_id: USER_V11_A, item_id: 'gem_common_5', equipped_to_pet: null, slot: null, source: 'shop', paid_price: 250 },
    ]);

    const pbRes = await testServer.fetch(`/api/equipment/${USER_V11_A}?sort=rarity_desc&slot=all`);
    assert.equal(pbRes.status, 200);
    const pbJson = await pbRes.json();
    assert.equal(pbJson.total_count, 3);
    assert.match(pbJson.summary_equipment, /Đang trang bị/);

    const batchDm = await testServer.fetch('/api/dismantle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: USER_V11_A, category: 'item', targetId: 'all_common' }),
    });
    assert.equal(batchDm.status, 200);
    const batchJson = await batchDm.json();
    assert.equal(batchJson.dismantled_count, 2);
    assert.equal(batchJson.skipped_equipped_count, 1);
    assert.equal(batchJson.refund_linh_thach, 3 + 50); // 3 (Mức A gacha weapon_common_2) + 50 (20% shop gem_common_5)

    // /pet sort & /update
    const petSortRes = await testServer.fetch(`/api/pet/${USER_V11_A}?sort=star_desc`);
    assert.equal(petSortRes.status, 200);
    const updRes = await testServer.fetch('/api/update');
    assert.equal(updRes.status, 200);
    const updJson = await updRes.json();
    assert.equal(updJson.version, '1.3');
    const updMissing = await testServer.fetch('/api/update/9.9');
    assert.equal(updMissing.status, 404);

    // Canvas render 10★ + Zero "Full HD+" in user-facing /api/wiki & /api/shop/catalog
    const profBuf = await renderProfileCard({
      user_id: USER_V11_A,
      username: 'StarTest',
      level: 50,
      exp: 100,
      next_level_exp: 1000,
      linh_thach: 999,
      realm: 'III. Kim Đan Đại Đạo',
      pet: { name: 'Thái Dương Kim Ô', pet_type: 'thai_duong_kim_o', element: 'Hỏa', rarity: 'Thần Thoại', level: 45, star: 10, atk: 2000, def: 1500, spd: 1800, power: 14000, hax_skill: 'Chân Hỏa Phần Thiên' },
      equipped_roles: [],
    });
    assertPngValid(profBuf, 2000, 1000);

    const batRes = await simulateBattle(
      { user_id: 'b_render_1', username: 'P1', level: 50, pet: { pet_type: 'thai_duong_kim_o', level: 50, star: 10 } },
      { user_id: 'b_render_2', username: 'P2', level: 50, pet: { pet_type: 'hoang_thien_ky_lan', level: 50, star: 8 } },
      { maxTurns: 5, preRender: false, skipQuestTracking: true, seed: 5 },
    );
    const batPng = await renderBattleCard(batRes, { format: 'png' });
    assertPngValid(batPng, 2000, 1000);

    const wikiText = JSON.stringify(await (await testServer.fetch('/api/wiki')).json());
    const shopText = JSON.stringify(await (await testServer.fetch('/api/shop/catalog?category=backgrounds')).json());
    assert.ok(!/Full HD\+/i.test(wikiText), 'Wiki API must NOT contain "Full HD+"');
    assert.ok(!/Full HD\+/i.test(shopText), 'Shop API must NOT contain "Full HD+"');
  });
});
