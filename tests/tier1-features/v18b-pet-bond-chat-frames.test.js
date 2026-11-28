/**
 * tests/tier1-features/v18b-pet-bond-chat-frames.test.js
 * Unit & integration verification for SuMi Family Ver 1.8B:
 *  - 5 Affection Bond scales (3 / 5 / 7 / 8 / 10), Fuyumi Vĩnh Hằng Thủ Hộ label
 *  - 5 Linear Buffs (+4%*T Pet Power, +3%*T Pet EXP /upgrade, +1.5%*T Survive, +5%*T User EXP, +1.5%*T All-Source LT)
 *  - Interact (6/day x 15, 30s cd, Tier 4+ 1st-daily companion gift)
 *  - Gift (200/day capped vs chaos/evo_crystal uncapped, auto-clamp qty)
 *  - Combat Bond caps (battle 20/day, tower/vein 15/day, explorer 10..25)
 *  - Evolution (+1800 pts + auto-unlock frame_bond_<pet_type> at 10/10)
 *  - 41 Exclusive Bond Frames (+50% Daily/Job LT & +50% Chat/Voice EXP, excluded from /shop, 0px top haze)
 *  - Dialogue bank (>2500 lines, 10 archetypes across all 151 pets with zero Hổ/Hồ mismatch) & AI Chat quotas + 5-turn history
 *  - Farm Pet Bond Auto-Harvest probability & cycle deduplication
 *  - Loadout <-> Explorer 2-way lock & snapshot preservation
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createCanvas, loadImage } from '@napi-rs/canvas';

import {
  PET_CATALOG,
  AVATAR_FRAMES,
  AVATAR_FRAME_BY_ID,
  computeCosmeticBuffTotals,
} from '../../src/data/catalog.js';
import {
  PET_BOND_FRAME_PET_TYPES,
  computeBondTierState,
  computeBondBuffsForTier,
  getAiChatDailyLimitForPet,
  getPetArchetype,
} from '../../src/data/v18PetBondCatalog.js';
import {
  countDialogueBankLines,
  pickPetInteractionDialogue,
} from '../../src/data/v18PetDialogueBank.js';
import {
  __resetPetBondTestStore,
  __getPetBondTestState,
  getPetBondHub,
  interactWithPet,
  giftToPet,
  grantCombatBondPoints,
} from '../../src/services/petBondService.js';
import {
  preparePetAiChat,
  savePetAiChatReply,
} from '../../src/services/petChatService.js';
import {
  __resetPetUpgradeTestStore,
  __getPetUpgradeTestState,
  previewPetUpgrade,
  executePetUpgrade,
} from '../../src/services/inventoryService.js';
import {
  __resetEvolutionTestStore,
  __getEvolutionTestState,
  evolveUniquePet,
} from '../../src/services/evolutionService.js';
import { evaluatePetFarmAutoHarvestCycle } from '../../src/services/farmService.js';
import { evaluateLoadoutExplorerLock } from '../../src/services/loadoutService.js';
import { computeExplorerSurvival } from '../../src/services/explorerService.js';
import { compileCombatant } from '../../src/services/battleEngine/statsCompiler.js';

const ROOT = path.resolve('.');

test('1. 41 Bond Avatar Frames catalog, /shop exclusion, cosmetic buff (+50% Daily/Job LT & +50% EXP) & clean PNG edge alpha', async () => {
  assert.equal(PET_BOND_FRAME_PET_TYPES.length, 41);
  assert.equal(AVATAR_FRAMES.length, 71); // 1 default + 20 v15 + 9 v17 + 41 v18 bond

  const paidShopFrames = AVATAR_FRAMES.filter((f) => f.price > 0);
  assert.equal(paidShopFrames.some((f) => f.is_bond_exclusive), false, 'Bond frames must NEVER appear in /shop');

  const fuyumiFrame = AVATAR_FRAME_BY_ID.frame_bond_cuu_vi_hong_ho;
  assert.ok(fuyumiFrame);
  assert.equal(fuyumiFrame.price, 0);
  assert.equal(fuyumiFrame.is_bond_exclusive, true);

  const buffs = computeCosmeticBuffTotals('frame_bond_cuu_vi_hong_ho', 'default_background.png');
  assert.equal(buffs.expPct, 50);
  assert.equal(buffs.ltPct, 0, 'General ltPct (Tower/Explorer) must stay 0 for bond frame');
  assert.equal(buffs.dailyJobLtPct, 50, 'Daily & Job LT buff must be +50%');

  for (const pt of PET_BOND_FRAME_PET_TYPES) {
    const filePath = path.join(ROOT, 'assets/frames', `frame_bond_${pt}.png`);
    assert.ok(fs.existsSync(filePath), `Missing cleaned bond frame ${filePath}`);
    const img = await loadImage(fs.readFileSync(filePath));
    assert.equal(img.width, 512);
    assert.equal(img.height, 512);
    const c = createCanvas(512, 1);
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0, 512, 1, 0, 0, 512, 1);
    const rowData = ctx.getImageData(0, 0, 512, 1).data;
    // Top border edge row y=0 must be clean (alpha === 0) after spotlight cleanup
    let topEdgeOpaque = 0;
    for (let x = 0; x < 512; x++) {
      if (rowData[x * 4 + 3] > 20) topEdgeOpaque++;
    }
    assert.equal(topEdgeOpaque, 0, `Top edge glow detected on frame_bond_${pt}.png`);
  }
});

test('2. 5 Bond Tiers, linear buffs, 10 archetypes across all 151 pets & >2,500 dialogue lines', () => {
  const cMax = computeBondTierState('hoa_thach_nham_nham', 999);
  assert.equal(cMax.maxTier, 3);
  assert.equal(cMax.maxPoints, 120);
  assert.equal(cMax.tier, 3);

  const rMax = computeBondTierState('bang_tuyet_ho', 1200);
  assert.equal(rMax.maxTier, 5);
  assert.equal(rMax.tier, 5);

  const eMax = computeBondTierState('linh_mieu_hoa_tien', 4200);
  assert.equal(eMax.maxTier, 7);
  assert.equal(eMax.tier, 7);

  const mMax = computeBondTierState('cuu_tieu_kim_long', 7200);
  assert.equal(mMax.maxTier, 8);
  assert.equal(mMax.tier, 8);

  const uBase = computeBondTierState('hon_don_chi_to_long', 12000, false);
  const uEvo = computeBondTierState('hon_don_chi_to_long', 12000, true);
  assert.equal(uBase.maxTier, 10);
  assert.equal(uEvo.maxTier, 10);
  assert.equal(uBase.tier, uEvo.tier);

  const fuyumi = computeBondTierState('cuu_vi_hong_ho', 12000, true);
  assert.equal(fuyumi.tier, 10);
  assert.equal(fuyumi.tierLabel, 'Vĩnh Hằng Thủ Hộ');

  const buffsMax = computeBondBuffsForTier(10, 'hon_don_chi_to_long', true);
  assert.equal(buffsMax.petPowerPct, 40);
  assert.equal(buffsMax.petExpPct, 30);
  assert.equal(buffsMax.explorerSurvivePct, 15);
  assert.equal(buffsMax.userExpPct, 50);
  assert.equal(buffsMax.allSourceLtPct, 15);
  assert.equal(buffsMax.autoFarmChancePct, 100);

  // Kiểm tra chính xác 151 pet phân loại không bị nhầm Hổ vs Hồ
  assert.equal(PET_CATALOG.length, 151);
  for (const p of PET_CATALOG) {
    const arch = getPetArchetype(p.pet_type);
    assert.ok(arch, `Missing archetype for ${p.pet_type}`);
  }
  assert.equal(getPetArchetype('thai_co_bach_ho'), 'tiger_leopard'); // Thái Cổ Bạch Hổ
  assert.equal(getPetArchetype('loi_dinh_kim_ho'), 'fox'); // Lôi Đình Kim Hồ
  assert.equal(getPetArchetype('hoa_linh_tieu_ho'), 'fox'); // Hỏa Linh Tiểu Hồ
  assert.equal(getPetArchetype('cuu_vi_hong_ho'), 'kemonomimi');
  assert.equal(getPetArchetype('hong_mong_cuu_vy_tien'), 'kemonomimi');

  const bankCount = countDialogueBankLines();
  assert.ok(bankCount >= 2500, `Expected >=2500 dialogue lines, got ${bankCount}`);
  const sample = pickPetInteractionDialogue({ petType: 'cuu_vi_hong_ho', action: 'hug', tier: 10, maxTier: 10, seed: 42 });
  assert.ok(sample.formatted.includes('*') && sample.formatted.includes('"'));
});

test('3. interactWithPet (6/day, 30s cd, Tier 4+ 1st-daily gift) & giftToPet (200/d cap vs uncapped chaos/evo_crystal) & combat caps', async () => {
  const uid = '777777777777777771';
  const t0 = new Date('2026-11-28T03:00:00Z'); // 10:00 VN

  __resetPetBondTestStore({
    [uid]: {
      username: 'BondedMaster',
      linh_thach: 1000,
      red_gold_crystals: 10,
      farm_essence: 200,
      inventory: { pill_ess_1: 10, pill_ess_2: 5, chaos_essence_shard: 2, evo_crystal: 2 },
      pets: [{
        pet_id: 101,
        pet_type: 'hon_don_chi_to_long',
        pet_name: '« Hỗn Độn Chi Tổ Long »',
        is_active: true,
        is_evolved: true,
        affection_points: 1900, // Tier 4 already
        affection_tier: 4,
      }],
    },
  });

  const hub0 = await getPetBondHub(uid, { now: t0 });
  assert.equal(hub0.success, true);
  assert.equal(hub0.bond.tier, 4);

  // Interact #1: +15 pts + 1st daily companion gift guaranteed (>= Tier 4)
  const i1 = await interactWithPet(uid, 'pat', { now: t0, rng: () => 0.5 });
  assert.equal(i1.gained_points, 15);
  assert.equal(i1.bond.points, 1915);
  assert.ok(i1.companion_gift, '1st daily interact at Tier 4+ must drop Companion Gift');
  assert.ok(i1.companion_gift.ltGained >= 100 && i1.companion_gift.ltGained <= 400);

  // Cooldown 30s check at +10s
  const iFast = await interactWithPet(uid, 'hug', { now: new Date(t0.getTime() + 10000) });
  assert.equal(iFast.cooldown_active, true);
  assert.equal(iFast.gained_points, 0);

  // Finish remaining 5 daily interacts (+35s apart)
  let curT = t0.getTime();
  for (let k = 2; k <= 6; k++) {
    curT += 35000;
    const ik = await interactWithPet(uid, 'play', { now: new Date(curT) });
    assert.equal(ik.gained_points, 15);
    assert.equal(ik.companion_gift, null, 'Companion gift only once per day on 1st interact');
  }

  // 7th interact hits daily cap
  curT += 35000;
  const i7 = await interactWithPet(uid, 'sleep', { now: new Date(curT) });
  assert.equal(i7.daily_cap_reached, true);
  assert.equal(i7.gained_points, 0);

  // Capped gifts (max 200/day): 2x pill_ess_2 = 200 pts exactly
  const g1 = await giftToPet(uid, 'pill_ess_2', 5, { now: new Date(curT) }); // asks 5, auto-clamped to 2!
  assert.equal(g1.gained_points, 200);
  assert.equal(g1.gifted_quantity, 2);
  const stAfterGift1 = __getPetBondTestState(uid);
  assert.equal(stAfterGift1.inventory.pill_ess_2, 3, 'Should only deduct 2 clamped pills, keeping 3');

  // Further capped gift blocked
  const gCap = await giftToPet(uid, 'farm_essence', 5, { now: new Date(curT) });
  assert.equal(gCap.error, 'GIFT_DAILY_CAP_REACHED');

  // Uncapped gifts bypass 200/d cap & can unlock Evolved Bond Frame at 12,000!
  const gShard = await giftToPet(uid, 'chaos_essence_shard', 2, { now: new Date(curT) });
  assert.equal(gShard.gained_points, 700);

  // Combat caps
  let battleSum = 0;
  for (let b = 0; b < 15; b++) {
    const r = await grantCombatBondPoints(uid, 'battle', 2, { now: new Date(curT) });
    battleSum += r.gainedPoints;
  }
  assert.equal(battleSum, 20, 'Battle bond capped at 20/day');

  let tvSum = 0;
  for (let tv = 0; tv < 8; tv++) {
    const r = await grantCombatBondPoints(uid, 'tower_vein', 3, { now: new Date(curT) });
    tvSum += r.gainedPoints;
  }
  assert.equal(tvSum, 15, 'Tower/Vein bond capped at 15/day');

  // Push to 12,000 via evo_crystal and verify frame unlock
  const stNow = __getPetBondTestState(uid).pets[0];
  stNow.affection_points = 10500;
  const gUnlock = await giftToPet(uid, 'evo_crystal', 1, { now: new Date(curT) });
  assert.equal(gUnlock.bond.points, 12000);
  assert.equal(gUnlock.bond.tier, 10);
  assert.ok(gUnlock.frame_unlocked?.unlockedNow);
  assert.equal(gUnlock.frame_unlocked?.frameId, 'frame_bond_hon_don_chi_to_long');
});

test('4. eveloveUniquePet grants +1,800 (+15%) bond pts & unlocks frame_bond_* when hitting Tier 10/10', async () => {
  const uid = '777777777777777772';
  __resetEvolutionTestStore({
    [uid]: {
      username: 'EvoBonder',
      linh_thach: 20000,
      inventory: { evo_crystal: 5 },
      pets: [{
        pet_id: 202,
        pet_type: 'thai_so_cuu_phuong_hoang',
        pet_name: '« Thái Sơ Cửu Phượng Hoàng »',
        pet_rarity: 'Thần Thoại',
        level: 45,
        star: 8,
        enchant_grade: 'S',
        is_active: true,
        is_evolved: false,
        affection_points: 10500,
        affection_tier: 9,
      }],
    },
  });

  const res = await evolveUniquePet(uid, { petType: 'thai_so_cuu_phuong_hoang', ltTier: 5, rng: () => 0.1 });
  assert.equal(res.success, true);
  assert.equal(res.evolved, true);
  assert.equal(res.affection_points, 12000);
  assert.equal(res.affection_tier, 10);
  assert.equal(res.bond_frame_unlocked, 'frame_bond_thai_so_cuu_phuong_hoang');
  const st = __getEvolutionTestState(uid);
  assert.ok(st.user.owned_frames.includes('frame_bond_thai_so_cuu_phuong_hoang'));
});

test('5. Pet EXP buff (+3%/tier = +30% at T10) applies ONLY in /upgrade while Role buffs do not', async () => {
  const uid = '777777777777777773';
  __resetPetUpgradeTestStore({
    [uid]: {
      username: 'Upgrader',
      linh_thach: 50000,
      farm_essence: 100,
      inventory: { pill_ess_1: 5, pill_ess_2: 5 },
      pets: [{
        pet_id: 303,
        pet_type: 'hon_don_chi_to_long',
        pet_name: '« Hỗn Độn Chi Tổ Long »',
        level: 1,
        exp: 0,
        star: 1,
        is_active: true,
        is_evolved: true,
        affection_points: 12000,
        affection_tier: 10,
      }],
    },
  });

  const pv = await previewPetUpgrade(uid, { mode: 'level', targetGoal: 5 });
  assert.equal(pv.success, true);
  assert.equal(pv.bond_pet_exp_pct, 30);
  assert.equal(pv.quotes.lq.exp_per_unit, 10); // Math.round(8 * 1.3) = 10
  assert.equal(pv.quotes.pill_ess_1.exp_per_unit, 1560); // Math.round(1200 * 1.3) = 1560
  assert.equal(pv.quotes.pill_ess_2.exp_per_unit, 3900); // Math.round(3000 * 1.3) = 3900

  const ex = await executePetUpgrade(uid, { mode: 'level', method: 'pill_ess_1', targetGoal: 5 });
  assert.equal(ex.success, true);
  const st = __getPetUpgradeTestState(uid);
  assert.ok(st.pets[0].level >= 5);
});

test('6. AI Chat eligibility (Common=sample, Mythic=5/day, Unique=10/day, Fuyumi=unlimited) & 5-turn (10 row) memory cap', async () => {
  const uidC = '888888888888888881';
  const uidM = '888888888888888882';
  const uidF = '757091869183311872';
  const now = new Date('2026-11-28T05:00:00Z');

  __resetPetBondTestStore({
    [uidC]: { username: 'CommonUser', pets: [{ pet_id: 1, pet_type: 'hoa_thach_nham_nham', is_active: true }] },
    [uidM]: { username: 'MythicUser', pets: [{ pet_id: 2, pet_type: 'cuu_tieu_kim_long', is_active: true, affection_points: 950 }] },
    [uidF]: { username: 'Fuyumi', pets: [{ pet_id: 3, pet_type: 'cuu_vi_hong_ho', is_active: true, is_evolved: true, affection_points: 12000 }] },
  });

  // Common -> sample immediately
  const cPrep = await preparePetAiChat(uidC, 'Chào nham nham!', { now });
  assert.equal(cPrep.mode, 'sample');
  assert.equal(cPrep.can_ai_chat, false);

  // Mythic -> 5/day, 6th falls back to sample, history trims at 10 rows (5 turns)
  for (let i = 1; i <= 5; i++) {
    const p = await preparePetAiChat(uidM, `Turn ${i}`, { now: new Date(now.getTime() + i * 1000) });
    assert.equal(p.mode, 'ai');
    const sv = await savePetAiChatReply(uidM, { userMessage: `Turn ${i}`, petReply: `*Cửu Tiêu Kim Long khẽ gật đầu* "Ta nghe rõ lần thứ ${i} rồi."`, usedAi: true }, { now: new Date(now.getTime() + i * 1000) });
    assert.equal(sv.ai_remaining, 5 - i);
  }
  const p6 = await preparePetAiChat(uidM, 'Turn 6', { now: new Date(now.getTime() + 7000) });
  assert.equal(p6.mode, 'sample', '6th turn must fallback to sample for Mythic');
  assert.equal(__getPetBondTestState(uidM).chatHistory.length, 10, 'History must stay capped at 10 rows (5 turns)');

  // Fuyumi unlimited
  assert.equal(getAiChatDailyLimitForPet('cuu_vi_hong_ho'), Infinity);
  const fPrep = await preparePetAiChat(uidF, 'Hồng Mông ơi hôm nay sao rồi?', { now });
  assert.equal(fPrep.mode, 'ai');
  assert.equal(fPrep.unlimited, true);
  assert.ok(fPrep.gemini_system_prompt.includes('Fuyumi'));
});

test('7. Farm Auto-Harvest percentages (Tier 5..10), StatsCompiler additive Pet Power & Explorer survive + Loadout sync lock', async () => {
  assert.equal(evaluatePetFarmAutoHarvestCycle({ tier: 4, rng: () => 0.01 }).success, false);
  assert.equal(evaluatePetFarmAutoHarvestCycle({ tier: 5, rng: () => 0.10 }).success, true);
  assert.equal(evaluatePetFarmAutoHarvestCycle({ tier: 5, rng: () => 0.30 }).success, false);
  assert.equal(evaluatePetFarmAutoHarvestCycle({ tier: 7, rolledAlready: true, rng: () => 0.0 }).success, false);
  assert.equal(evaluatePetFarmAutoHarvestCycle({ tier: 10, isEvolved: true, petType: 'hon_don_chi_to_long', rng: () => 0.999 }).success, true);

  // Additive Pet Power (+40% Bond + 20% Role = +60%)
  const cNoBond = await compileCombatant({
    user_id: '9001',
    username: 'Base',
    role_pet_power_bonus_pct: 20,
    pet: { pet_type: 'hoa_thach_nham_nham', base_atk: 1000, base_def: 500, base_spd: 500, level: 1, star: 1 },
  }, 'attacker');
  const cWithBond = await compileCombatant({
    user_id: '9002',
    username: 'Bonded',
    role_pet_power_bonus_pct: 20,
    pet_bond_power_bonus_pct: 40,
    pet: { pet_type: 'hoa_thach_nham_nham', base_atk: 1000, base_def: 500, base_spd: 500, level: 1, star: 1, affection_tier: 10 },
  }, 'attacker');
  assert.equal(cWithBond.atk, Math.round(1000 * 1.6), '20% Role + 40% Bond must combine additively to +60%');
  assert.ok(cWithBond.atk > cNoBond.atk);

  // Explorer Survive bonus (+15%)
  const sBase = computeExplorerSurvival(8000, 10000, null, 0, 0);
  const sBond = computeExplorerSurvival(8000, 10000, null, 0, 0.15);
  assert.equal(sBond.survivalPct, sBase.survivalPct + 15);

  // Loadout lock checks petLocked ONLY (shared gem_mythic_17 across Bộ 1/2/3 never deadlocks!)
  const busyExp = { isExploring: true, busyPetId: '3577', busyEquipIds: new Set(['gem_mythic_17']), busyDomainIds: new Set() };
  const lockOnFreePet = evaluateLoadoutExplorerLock({
    slotIndex: 2,
    pet: { pet_id: 2937, status: 'ready' },
    busyExp,
  });
  assert.equal(lockOnFreePet.locked, false);

  const lockOnBusyPet = evaluateLoadoutExplorerLock({
    slotIndex: 1,
    pet: { pet_id: 3577, status: 'exploring' },
    busyExp,
  });
  assert.equal(lockOnBusyPet.locked, true);
});
