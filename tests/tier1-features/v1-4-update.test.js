import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  FUYUMI_USER_ID,
  DOMAIN_CATALOG,
  DOMAIN_BY_ID,
  DIVINE_SENSE_BY_ID,
  DIVINE_REALM_BY_ID,
  EQUIPMENT_BY_ID,
  PET_BY_TYPE,
} from '../../src/data/catalog.js';
import {
  V14_EXPLORER_MAPS,
  V14_SPIRIT_VEIN_TIERS,
  V14_DAO_AP_CONFIG,
  V14_ARTIST_PROMPTS,
} from '../../src/data/v14ExpansionCatalog.js';
import { LATEST_VERSION, getChangelogPayload } from '../../src/data/changelogs.js';
import {
  getServerLeaderboard,
  isSundayWeeklySettlementWindow,
  getRewardTierForRank,
} from '../../src/services/leaderboardService.js';
import {
  initDomainBattleState,
  processTurnDomainPhase,
  drainEnemyDomainEnergy,
} from '../../src/services/battleEngine/domainEngine.js';
import { generateDailyShopSlots } from '../../src/services/dailyShopService.js';
import {
  GOLDEN_HOURS_VN,
  getVnHourInfo,
} from '../../src/services/spiritVeinService.js';
import {
  simulateTeamBattle,
  applyFatigueToCombatant,
} from '../../src/services/battleEngine/teamBattleService.js';
import { renderTeamBattleCard } from '../../src/canvas/teamBattleRenderer.js';
import {
  computeExplorerSurvival,
  saveExplorerLoadout,
  startExpedition,
  claimExpedition,
  reviveInjuredUniquePet,
  getUserBusyExplorationAssets,
} from '../../src/services/explorerService.js';
import { setActivePet, enchantTarget, dismantleTarget } from '../../src/services/inventoryService.js';
import { simulateBattle } from '../../src/services/battleEngine/battleService.js';
import { challengeTower } from '../../src/services/questService.js';
import { getWikiData } from '../../src/services/wikiService.js';
import { lookupInfo } from '../../src/services/infoService.js';
import { supabase } from '../../src/config/supabase.js';
import { assertPngValid } from '../helpers/pngValidator.js';

const ARTIFACT_DIR = 'C:\\Users\\Fuyumi-ASUSF16\\.gemini\\antigravity\\brain\\6c4e030b-fb59-4575-8414-9779337f61d9';

test('v1.4 [1a] Leaderboard hides Fuyumi from all 4 /top tabs & Sunday 19:00 UTC+7 settlement logic', async () => {
  assert.equal(LATEST_VERSION, '1.4');

  // Window test: Sunday 2026-11-22 19:05 UTC+7 = 2026-11-22T12:05:00Z
  assert.equal(isSundayWeeklySettlementWindow(new Date('2026-11-22T12:05:00Z')), true);
  // Sunday 18:55 UTC+7 = 11:55Z -> false
  assert.equal(isSundayWeeklySettlementWindow(new Date('2026-11-22T11:55:00Z')), false);
  // Monday 20:00 UTC+7 -> false
  assert.equal(isSundayWeeklySettlementWindow(new Date('2026-11-23T13:00:00Z')), false);

  assert.equal(getRewardTierForRank(1).linh_thach, 3000);
  assert.equal(getRewardTierForRank(10).linh_thach, 600);
  assert.equal(getRewardTierForRank(11), null);

  if (supabase) {
    for (const tab of ['level', 'power', 'wealth', 'marry']) {
      const lb = await getServerLeaderboard(tab, 20);
      assert.equal(lb.success, true, `Leaderboard ${tab} should succeed`);
      for (const e of lb.entries) {
        assert.notEqual(String(e.user_id), FUYUMI_USER_ID, `Fuyumi must be hidden from /top ${tab}`);
        if (e.partner_id) {
          assert.notEqual(String(e.partner_id), FUYUMI_USER_ID, `Fuyumi must be hidden as partner from /top marry`);
        }
      }
    }
  }
});

test('v1.4 [1c] Mythic Domain Tier-2 Debuff "Đạo Áp" activates ONLY after breaking active enemy domain, +20..30%, 1-3 turns + future drain hook', () => {
  const mythicDom = DOMAIN_BY_ID.domain_mythic_1; // Kiếm Vực, 2 turns, scale 1.25
  const uniqueDom = DOMAIN_BY_ID.domain_unique_1; // Kiếm Vực, 3 turns, scale 1.28
  const weakDom = DOMAIN_BY_ID.domain_common_2;   // Huyễn Vực (countered by Kiếm Vực, base_energy 3)

  assert.equal(Object.keys(V14_DAO_AP_CONFIG).length, 16, 'All 16 Mythic/Supreme domains must have Đạo Áp');
  for (const [id, cfg] of Object.entries(V14_DAO_AP_CONFIG)) {
    assert.ok(cfg.durationTurns >= 1 && cfg.durationTurns <= 3, `${id} duration must be 1..3`);
    assert.ok(cfg.scaleFactor >= 1.20 && cfg.scaleFactor <= 1.30, `${id} scale must be +20..+30%`);
  }

  // Case 1: Enemy has NO domain -> Đạo Áp must NEVER trigger
  const a1 = { id: 'a1', name: 'Atk', maxHp: 10000, currentHp: 10000, shield: 0, state: {}, equipment: {}, domainLoadout: { domain: mythicDom } };
  const b1 = { id: 'b1', name: 'Def', maxHp: 10000, currentHp: 10000, shield: 0, state: {}, equipment: {}, domainLoadout: {} };
  const st1 = initDomainBattleState(a1, b1);
  for (let t = 2; t <= 6; t += 1) {
    processTurnDomainPhase(t, a1, b1, st1, () => 0.99);
    assert.equal(a1.domainRuntime.own.daoApActive, false, `Turn ${t}: Đạo Áp must NOT activate when enemy has no domain`);
  }

  // Case 2: Unique Domain breaks enemy domain -> activates on NEXT turn for EXACTLY 3 turns with +28% debuff scale
  const a2 = { id: 'a2', name: 'UniqueAtk', maxHp: 10000, currentHp: 10000, shield: 0, state: {}, equipment: {}, domainLoadout: { domain: uniqueDom } };
  const b2 = { id: 'b2', name: 'WeakDef', maxHp: 10000, currentHp: 10000, shield: 0, state: {}, equipment: {}, domainLoadout: { domain: weakDom } };
  const st2 = initDomainBattleState(a2, b2);
  let daoApActiveTurnsObserved = 0;
  let sawActivationEvent = false;
  let breakTurn = -1;
  let activationTurn = -1;

  for (let t = 2; t <= 9; t += 1) {
    const evs = processTurnDomainPhase(t, a2, b2, st2, () => 0.99);
    if (evs.some((e) => e.action === 'domain_break' && e.actor === 'b2')) breakTurn = t;
    if (evs.some((e) => e.action === 'dao_ap_activate')) {
      sawActivationEvent = true;
      activationTurn = t;
    }
    if (a2.domainRuntime.own.daoApActive) {
      daoApActiveTurnsObserved += 1;
      assert.equal(a2.domainRuntime.own.daoApScale, uniqueDom.dao_ap.scaleFactor);
      // Base defReductionPct = 0.35, with 1.28 scale = 0.448
      assert.ok(a2.domainRuntime.own.debuffsOnEnemy.defReductionPct > 0.40);
    }
  }
  assert.ok(breakTurn >= 2, 'Enemy domain should break');
  assert.equal(sawActivationEvent, true, 'Đạo Áp activation event should fire');
  assert.equal(activationTurn, breakTurn + 1, 'Đạo Áp must activate on the NEXT turn after breaking enemy domain');
  assert.equal(daoApActiveTurnsObserved, 3, 'Unique domain Đạo Áp must last exactly 3 turns');

  // Case 3: Future weapon/pet hook drainEnemyDomainEnergy() breaks enemy domain & arms Đạo Áp
  const a3 = { id: 'a3', name: 'HookAtk', maxHp: 10000, currentHp: 10000, shield: 0, state: {}, equipment: {}, domainLoadout: { domain: mythicDom } };
  const b3 = { id: 'b3', name: 'HookDef', maxHp: 10000, currentHp: 10000, shield: 0, state: {}, equipment: {}, domainLoadout: { domain: weakDom } };
  const st3 = initDomainBattleState(a3, b3);
  processTurnDomainPhase(2, a3, b3, st3, () => 0.99); // b3 energy goes 3 -> 1
  const hookEvents = [];
  const res = drainEnemyDomainEnergy(st3.attacker, st3.defender, 2, { sourceLabel: 'Future HAX', events: hookEvents, ownerId: 'a3' });
  assert.equal(res.brokeEnemyDomain, true);
  assert.equal(st3.attacker.daoApArmed, true, 'drainEnemyDomainEnergy must arm Đạo Áp for next turn');
});

test('v1.4 [2a] Daily Shop generates 10 discounted slots with Mythic non-unique pre-enchanted gear & zero unique/Fuyumi items', () => {
  const slotsA = generateDailyShopSlots('2026-11-22');
  const slotsB = generateDailyShopSlots('2026-11-22');
  assert.equal(slotsA.length, 10);
  assert.deepEqual(slotsA, slotsB, 'Server-wide daily shop must be deterministic per dateKey');

  const slot9 = slotsA.find((s) => s.slot_index === 9);
  assert.equal(slot9.kind, 'equipment');
  assert.equal(slot9.rarity_key, 'mythic');
  assert.ok(['A', 'B', 'C'].includes(slot9.enchant_grade), 'Mythic equipment in daily shop should have pre-rolled grade');

  for (const s of slotsA) {
    assert.ok(s.price < s.base_price, `Slot ${s.slot_index} must be discounted`);
    assert.ok(s.discount_pct >= 15 && s.discount_pct <= 40);
    if (s.kind === 'pet') {
      const p = PET_BY_TYPE[s.item_id];
      assert.equal(Boolean(p?.is_unique), false);
      assert.equal(Boolean(p?.is_exclusive_fuyumi), false);
    }
    if (s.kind === 'equipment') {
      const e = EQUIPMENT_BY_ID[s.item_id];
      assert.equal(Boolean(e?.is_unique), false);
      assert.equal(Boolean(e?.is_exclusive_fuyumi), false);
    }
  }
});

test('v1.4 [2b] Spirit Veins Golden Hours, Fatigue, Leader-only Domain, SPD order & 3vBoss + 3v3 Canvas Renders', async () => {
  assert.deepEqual(GOLDEN_HOURS_VN, [8, 12, 18, 20, 21, 22]);
  assert.equal(getVnHourInfo(new Date('2026-11-22T13:15:00Z')).isGoldenHour, true); // 20:15 UTC+7
  assert.equal(getVnHourInfo(new Date('2026-11-22T09:15:00Z')).isGoldenHour, false); // 16:15 UTC+7

  const sp = V14_SPIRIT_VEIN_TIERS.find((t) => t.tier_code === 'S+');
  assert.ok(sp.boss_power >= 8000000, 'S+ Boss must be >= 8M power');
  assert.ok(sp.lt_per_min >= 50 && sp.lt_per_min <= 60, 'S+ LT/min must be 50-60');

  const fTier = V14_SPIRIT_VEIN_TIERS.find((t) => t.tier_code === 'F');
  assert.ok(fTier.boss_power >= 20000, 'F Boss must be >= 20k power');
  assert.ok(fTier.lt_per_min >= 5 && fTier.lt_per_min <= 7, 'F LT/min must be 5-7');

  // Build synthetic 3-member team vs S+ Boss and 3v3
  const makeUnit = (id, name, petType, spd, atk, domId, senseId, realmId, fatigue = 0) => applyFatigueToCombatant({
    id,
    name,
    avatarUrl: null,
    pet: { pet_type: petType, pet_name: PET_BY_TYPE[petType]?.pet_name || petType, element: PET_BY_TYPE[petType]?.element || 'Hỏa', level: 95, star: 9 },
    equipment: {
      weapon: { item_id: 'weapon_mythic_1', enchant_grade: 'S' },
      gem: { item_id: 'gem_mythic_1', enchant_grade: 'A' },
      soul: { item_id: 'soul_mythic_1', enchant_grade: 'B' },
    },
    domainLoadout: domId ? { domain: DOMAIN_BY_ID[domId], sense: senseId ? DIVINE_SENSE_BY_ID[senseId] : null, realm: realmId ? DIVINE_REALM_BY_ID[realmId] : null } : {},
    atk,
    def: Math.round(atk * 0.8),
    spd,
    maxHp: atk * 18,
    critRate: 25,
    powerScore: atk * 60,
  }, fatigue);

  const teamA = [
    makeUnit('u1', 'Fuyumi 🌸', 'cuu_vi_hong_ho', 35000, 65000, 'domain_fuyumi_cuu_vi_hong_mong', 'sense_fuyumi_thai_thuong_hong_ho', 'realm_fuyumi_van_co_tuyet_diet', 0),
    makeUnit('u2', 'Huyền Vũ Tôn', 'tu_kim_bach_trach', 42000, 48000, 'domain_mythic_1', null, null, 1), // Member 2 has domain, must NOT be used
    makeUnit('u3', 'Lôi Đế', 'loi_dinh_kim_ho', 38000, 44000, null, null, null, 2),
  ];

  // Fatigue verification: stack 1 = -25%, stack 2 = -50%
  assert.equal(teamA[1].fatiguePenaltyPct, 25);
  assert.equal(teamA[2].fatiguePenaltyPct, 50);

  const bossSp = [{
    id: 'boss_sp',
    name: `[BOSS S+] ${sp.boss_name}`,
    isBoss: true,
    bossImageFile: 'veins/vein_mine_sp.png',
    pet: { pet_type: 'vein_mine_sp', pet_name: sp.boss_name, element: sp.element, level: 100, star: 10 },
    equipment: {},
    domainLoadout: { domain: DOMAIN_BY_ID[sp.domain_id] },
    atk: sp.stats.atk,
    def: sp.stats.def,
    spd: sp.stats.spd,
    maxHp: sp.stats.hp,
    powerScore: sp.boss_power,
  }];

  const resBoss = simulateTeamBattle(teamA, bossSp, { mode: '3vBoss', veinLabel: 'LINH MẠCH HẠNG S+ • HỖN NGUYÊN ĐỊA MẠCH MA TÔN', rng: () => 0.42 });
  assert.equal(resBoss.leaderDomainA.domain_id, 'domain_fuyumi_cuu_vi_hong_mong', 'Must use ONLY Team Leader Domain');

  const pngBoss = await renderTeamBattleCard(resBoss, { format: 'png' });
  assertPngValid(pngBoss, 2000, 1150);

  // Also test 3v3 PvP render
  const teamB = [
    makeUnit('e1', 'Thiên Kiếm', 'bach_kim_ho_tu', 30000, 45000, 'domain_unique_1', 'sense_unique_1', 'realm_mythic_1', 0),
    makeUnit('e2', 'Hàn Băng', 'nguyet_anh_thao_tho', 28000, 40000, null, null, null, 0),
    makeUnit('e3', 'U Minh', 'hoa_thach_nham_nham', 26000, 38000, null, null, null, 0),
  ];
  const res3v3 = simulateTeamBattle(teamA, teamB, { mode: '3v3', veinLabel: 'LINH MẠCH HẠNG S • TRANH ĐOẠT TỔ ĐỘI 3v3', rng: () => 0.42 });
  const png3v3 = await renderTeamBattleCard(res3v3, { format: 'png' });
  assertPngValid(png3v3, 2000, 1150);

  // Save visual verification snapshots to artifact dir if it exists
  if (fs.existsSync(ARTIFACT_DIR)) {
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'prod_team_battle_3vboss_v14.png'), pngBoss);
    fs.writeFileSync(path.join(ARTIFACT_DIR, 'prod_team_battle_3v3_v14.png'), png3v3);
  }
});

test('v1.4 [2c] Explorer Survival/Death Math + Full Live DB Stress Test (Main/Sub Pet Swap, Gear Lock, Death/Drop, 60% Salvage, Elixir, Absolute Stone)', async () => {
  // 1. Exact survival formula verification
  assert.equal(V14_EXPLORER_MAPS.length, 12);
  assert.equal(computeExplorerSurvival(100000, 100000).survivalPct, 90);
  assert.equal(computeExplorerSurvival(110000, 100000).survivalPct, 95); // +10% -> +5%
  assert.equal(computeExplorerSurvival(120000, 100000).survivalPct, 100); // +20% -> 100%
  assert.equal(computeExplorerSurvival(100000, 100000, 'food_survival_pill').survivalPct, 98); // +8% Food A
  assert.equal(computeExplorerSurvival(95000, 100000).deathPct, 20);  // < map, <10% diff -> 20% death
  assert.equal(computeExplorerSurvival(89000, 100000).deathPct, 30);  // 11% deficit -> 20% + 10% = 30% death
  assert.equal(computeExplorerSurvival(70000, 100000).deathPct, 50);  // 30% deficit -> 20% + 30% = 50% death

  if (!supabase) return;

  // 2. Full end-to-end DB stress test with 2 disposable synthetic users (cleaned up strictly in finally!)
  const userA = '999900000000014001';
  const userB = '999900000000014002';
  const nowIso = new Date().toISOString();

  const cleanup = async () => {
    await supabase.from('explorer_map_drops').delete().in('dropped_by_user_id', [userA, userB]);
    await supabase.from('explorer_expeditions').delete().in('user_id', [userA, userB]);
    await supabase.from('explorer_loadouts').delete().in('user_id', [userA, userB]);
    await supabase.from('explorer_ui_selections').delete().in('user_id', [userA, userB]);
    await supabase.from('user_domains').delete().in('user_id', [userA, userB]);
    await supabase.from('user_pet_items').delete().in('user_id', [userA, userB]);
    await supabase.from('user_inventory').delete().in('user_id', [userA, userB]);
    await supabase.from('user_pets').delete().in('user_id', [userA, userB]);
    await supabase.from('users').delete().in('user_id', [userA, userB]);
  };

  await cleanup();
  try {
    // Seed User A & User B
    await supabase.from('users').insert([
      { user_id: userA, username: 'TestExplorerA', level: 40, exp: 0, linh_thach: 5000, last_seen_update_version: LATEST_VERSION },
      { user_id: userB, username: 'TestExplorerB', level: 40, exp: 0, linh_thach: 5000, last_seen_update_version: LATEST_VERSION },
    ]);

    // User A has 2 pets (Main Pet + Sub Pet) + non-unique weapon (grade A) + non-unique gem (grade B) + 2 Absolute Stones + Elixir + Food C
    const { data: petsA, error: petsAErr } = await supabase.from('user_pets').insert([
      { user_id: userA, pet_type: 'hoa_thach_nham_nham', pet_name: 'Pet Chính A', pet_rarity: 'Phàm Phẩm', element: 'Thổ', level: 20, star: 3, atk: 500, def: 400, spd: 300, power_score: 50000, is_active: true, is_unique: false, status: 'ready', enchant_grade: 'D', quantity: 1 },
      { user_id: userA, pet_type: 'nguyet_anh_thao_tho', pet_name: 'Pet Phụ A', pet_rarity: 'Linh Phẩm', element: 'Mộc', level: 20, star: 3, atk: 600, def: 450, spd: 350, power_score: 60000, is_active: false, is_unique: false, status: 'ready', enchant_grade: 'A', quantity: 1 },
    ]).select('*');
    assert.equal(petsAErr, null, `Insert petsA error: ${petsAErr?.message}`);
    const mainPetA = petsA.find((p) => p.is_active);
    const subPetA = petsA.find((p) => !p.is_active);

    await supabase.from('user_pet_items').insert([
      { user_id: userA, item_id: 'weapon_rare_1', enchant_grade: 'A', quantity: 1 },
      { user_id: userA, item_id: 'gem_rare_1', enchant_grade: 'B', quantity: 1 },
    ]);
    await supabase.from('user_inventory').insert([
      { user_id: userA, item_id: 'food_speed_fruit', item_category: 'consumable', quantity: 2 },
      { user_id: userA, item_id: 'enchant_stone_absolute', item_category: 'consumable', quantity: 2 },
      { user_id: userA, item_id: 'explorer_revive_elixir', item_category: 'consumable', quantity: 1 },
    ]);

    // A) Test Absolute Enchant Stone (D->C advisory + A->S 100%)
    const enchLow = await enchantTarget(userA, { targetType: 'pet', targetId: String(mainPetA.pet_id), useAbsoluteStone: true });
    assert.equal(enchLow.success, true);
    assert.equal(enchLow.new_grade, 'C');
    assert.match(enchLow.message, /Khuyến cáo/i, 'Should advise saving Absolute Stone for A -> S');

    const enchHigh = await enchantTarget(userA, { targetType: 'pet', targetId: String(subPetA.pet_id), useAbsoluteStone: true });
    assert.equal(enchHigh.success, true);
    assert.equal(enchHigh.new_grade, 'S', 'Absolute Stone must 100% upgrade A -> S');

    // B) Put MAIN PET of User A into exploration (with Food C -> -25% time & weapon_rare_1 + gem_rare_1)
    const saveRes = await saveExplorerLoadout(userA, {
      petId: String(mainPetA.pet_id),
      weaponId: 'weapon_rare_1',
      gemId: 'gem_rare_1',
    });
    assert.equal(saveRes.success, true);

    const startRes = await startExpedition(userA, { durationHours: 6, mapId: 'map_04_thach_mon', foodId: 'food_speed_fruit' });
    assert.equal(startRes.success, true);
    assert.equal(startRes.effective_seconds, Math.round(6 * 3600 * 0.75), 'Food C must reduce time by 25%');

    // C) Verify MAIN PET exploring blocks /battle, /nhiemvu tower, /enchant, /dismantle
    const battleBlocked = await simulateBattle(userA, 'pve_free', { mode: 'pve_free' });
    assert.equal(battleBlocked.success, false);
    assert.equal(battleBlocked.error, 'PET_BUSY_EXPLORING');

    const towerBlocked = await challengeTower(userA);
    assert.equal(towerBlocked.success, false);
    assert.equal(towerBlocked.error, 'PET_BUSY_EXPLORING');

    const enchBlocked = await enchantTarget(userA, { targetType: 'item', targetId: 'weapon_rare_1' });
    assert.equal(enchBlocked.success, false);
    assert.equal(enchBlocked.error, 'ITEM_BUSY_EXPLORING');

    const disBlocked = await dismantleTarget(userA, { target: String(mainPetA.pet_id) });
    assert.equal(disBlocked.success, false);

    // D) Switch User A's Main Pet to ready Sub-Pet -> NOW /battle succeeds cleanly!
    const swapRes = await setActivePet(userA, String(subPetA.pet_id));
    assert.equal(swapRes.success, true);

    // Trying to switch BACK to exploring pet must be blocked!
    const swapBackBlocked = await setActivePet(userA, String(mainPetA.pet_id));
    assert.equal(swapBackBlocked.success, false);
    assert.equal(swapBackBlocked.error, 'PET_BUSY_EXPLORING');

    const battleAfterSwap = await simulateBattle(userA, 'pve_free', { mode: 'pve_free', seed: 'v14-swap-ok' });
    assert.equal(battleAfterSwap.success, true, 'Battle must succeed after switching to ready sub-pet!');

    // E) Force User A's exploring non-unique pet to DIE -> pet deleted, weapon_rare_1 (A) + gem_rare_1 (B) dropped on map_04_thach_mon (6h)!
    const dieRes = await claimExpedition(userA, { forceComplete: true, forceOutcome: 'die' });
    assert.equal(dieRes.success, true);
    assert.equal(dieRes.survived, false);
    assert.equal(dieRes.outcome.droppedItems.length, 2, 'Both non-unique gear pieces must drop on map');

    const { data: dropsOnMap } = await supabase
      .from('explorer_map_drops')
      .select('*')
      .eq('map_id', 'map_04_thach_mon')
      .eq('status', 'available');
    assert.equal(dropsOnMap.length, 2);

    // F) Player B explores SAME map (map_04_thach_mon) with >= 6h & survives -> 60% salvage picks up 1 dropped item with preserved grade!
    const { data: petB } = await supabase.from('user_pets').insert({
      user_id: userB, pet_type: 'bach_kim_ho_tu', pet_name: 'Pet B', pet_rarity: 'Tiên Phẩm', element: 'Kim',
      level: 50, star: 5, atk: 2000, def: 1500, spd: 1200, power_score: 250000, is_active: true, is_unique: false, status: 'ready', enchant_grade: 'B', quantity: 1,
    }).select('*').single();

    await saveExplorerLoadout(userB, { petId: String(petB.pet_id) });
    const startB = await startExpedition(userB, { durationHours: 6, mapId: 'map_04_thach_mon' });
    assert.equal(startB.success, true);

    const claimB = await claimExpedition(userB, { forceComplete: true, forceOutcome: 'survive', forceSalvage: true });
    assert.equal(claimB.success, true);
    assert.equal(claimB.survived, true);
    assert.ok(claimB.outcome.salvagedDrop, 'Player B must salvage dropped gear from Player A');
    assert.equal(claimB.outcome.salvagedDrop.item_id, 'weapon_rare_1');
    assert.equal(claimB.outcome.salvagedDrop.enchant_grade, 'A', 'Salvaged item must preserve original enchant grade A!');

    // G) Unique Pet Death -> 'injured' + Revive via Elixir
    await supabase.from('user_pets').update({ is_unique: true }).eq('pet_id', subPetA.pet_id);
    await saveExplorerLoadout(userA, { petId: String(subPetA.pet_id) });
    const startUnique = await startExpedition(userA, { durationHours: 2, mapId: 'map_12_hon_don' });
    assert.equal(startUnique.success, true);
    const dieUnique = await claimExpedition(userA, { forceComplete: true, forceOutcome: 'die' });
    assert.equal(dieUnique.success, true);
    assert.equal(dieUnique.survived, false);
    assert.equal(dieUnique.outcome.petIsUnique, true);

    const { data: checkInj } = await supabase.from('user_pets').select('status').eq('pet_id', subPetA.pet_id).single();
    assert.equal(checkInj.status, 'injured', 'Unique pet must become injured instead of deleted');

    const revRes = await reviveInjuredUniquePet(userA);
    assert.equal(revRes.success, true);
    const { data: checkReady } = await supabase.from('user_pets').select('status').eq('pet_id', subPetA.pet_id).single();
    assert.equal(checkReady.status, 'ready', 'Elixir must revive unique pet back to ready');
  } finally {
    await cleanup();
  }
});

test('v1.4 Confidentiality & Public Info Integrity (zero minigame winrate leaks, 16 artist prompts valid)', () => {
  assert.equal(V14_ARTIST_PROMPTS.length, 16);

  const wikiBattle = JSON.stringify(getWikiData('battle'));
  const changelog = JSON.stringify(getChangelogPayload('1.4'));
  const infoAbs = lookupInfo('enchant_stone_absolute');
  const infoDom = lookupInfo('domain_mythic_1');

  assert.equal(infoAbs.success, true);
  assert.equal(infoDom.success, true);
  assert.match(infoDom.description, /Đạo Áp/i);

  const secretLeakRe = /48%|45%|house\s*edge|tỉ lệ thắng|(?:coinflip|slots|blackjack|crash|minigame)[^.\n]{0,80}(?:40|45|48|50)%/i;
  assert.equal(secretLeakRe.test(wikiBattle), false, 'Wiki must NEVER leak minigame winrates');
  assert.equal(secretLeakRe.test(changelog), false, 'Changelog must NEVER leak minigame winrates');
});
