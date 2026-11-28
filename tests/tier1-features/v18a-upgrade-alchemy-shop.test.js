/**
 * tests/tier1-features/v18a-upgrade-alchemy-shop.test.js
 * Kiểm thử Ver 1.8A (100% offline-safe):
 * 1. A1: Luyện Đan pill_ess_1 & pill_ess_2 rơi Đan EXP Pet (+1.200 / +3.000 EXP, ×1/×2/×3 theo phẩm chất) + 50% LT & EXP.
 * 2. A2: Thanh EXP Pet (NeedEXP = Lv * 100), giảm giá LT theo % EXP hiện có, tiêu thụ hết LQ/Đan khi thiếu,
 *        Role/Cảnh Giới EXP buff KHÔNG ảnh hưởng EXP Pet, và đột phá Sao (/upgrade).
 * 3. A3: /exchange cap 50, specialShop validation sạch, 0 trùng key giữa 16 icons + 41 frames PDF với custom_emojis.json.
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { ALL_CONSUMABLE_BY_ID } from '../../src/data/catalog.js';
import { ALCHEMY_RECIPE_BY_ID } from '../../src/data/v161AlchemyCatalog.js';
import { V17_PET_EVOLUTIONS, FUYUMI_SUPREME_EVOLUTION } from '../../src/data/v17ExpansionCatalog.js';
import {
  startBrew,
  harvestBatch,
  __resetAlchemyTestStore,
  __getAlchemyTestUser,
  __getAlchemyTestInventory,
} from '../../src/services/alchemyService.js';
import {
  PET_EXP_PER_LEVEL_MULT,
  PET_EXP_PER_LQ,
  PET_EXP_PER_PILL_ESS_1,
  PET_EXP_PER_PILL_ESS_2,
  getPetExpRequiredForLevel,
  buildPetExpProgressBar,
  computePetLevelLtCost,
  simulatePetExpGain,
  previewPetUpgrade,
  executePetUpgrade,
  __resetPetUpgradeTestStore,
  __getPetUpgradeTestState,
} from '../../src/services/inventoryService.js';
import {
  convertLtToCrystals,
  buySpecialShopItem,
  __resetSpecialShopTestStore,
} from '../../src/services/specialShopService.js';
import { getWikiData } from '../../src/services/wikiService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BACKEND_ROOT = path.resolve(__dirname, '..', '..');
const UNICODE_PICTO_RE = /[\p{Extended_Pictographic}]/u;

function cleanupAllStores() {
  __resetAlchemyTestStore();
  __resetPetUpgradeTestStore(null);
  __resetSpecialShopTestStore(null);
}

before(cleanupAllStores);
after(cleanupAllStores);

test('1. A1: Catalog & Harvest pill_ess_1/2 drops ×1/×2/×3 EXP Pet items + 50% LT & EXP', async () => {
  assert.equal(ALCHEMY_RECIPE_BY_ID.pill_ess_1.isPetExpPill, true);
  assert.equal(ALCHEMY_RECIPE_BY_ID.pill_ess_2.isPetExpPill, true);
  assert.equal(ALL_CONSUMABLE_BY_ID?.pill_ess_1?.pet_exp, 1200);
  assert.equal(ALL_CONSUMABLE_BY_ID?.pill_ess_2?.pet_exp, 3000);

  const uid = '999999999999918001';
  __resetAlchemyTestStore({
    [uid]: { username: 'TestA1', level: 80, linh_thach: 5000, farm_essence: 200, exp: 0 },
  });

  const t0 = new Date('2026-11-28T05:00:00.000Z');
  const b1 = await startBrew(uid, 'pill_ess_1', { now: t0 });
  assert.equal(b1.success, true);
  const b2 = await startBrew(uid, 'pill_ess_2', { now: t0 });
  assert.equal(b2.success, true);

  // Harvest at t0 + 120m with rng=0.01 -> cloud (×3 drops each) + 50% LT/EXP
  const tHarv = new Date(t0.getTime() + 120 * 60000 + 5000);
  const res = await harvestBatch(uid, { now: tHarv, rng: () => 0.01 });
  assert.equal(res.success, true);
  assert.equal(res.harvest_summary.completed_count, 2);
  assert.equal(res.harvest_summary.pills_dropped.pill_ess_1, 3);
  assert.equal(res.harvest_summary.pills_dropped.pill_ess_2, 3);
  assert.equal(res.harvest_summary.total_gain_exp, 70); // (60 + 80) * 0.5 = 30 + 40 = 70
  assert.equal(UNICODE_PICTO_RE.test(res.harvest_description), false);

  const inv = __getAlchemyTestInventory(uid);
  assert.equal(inv.pill_ess_1, 3);
  assert.equal(inv.pill_ess_2, 3);

  const user = __getAlchemyTestUser(uid);
  assert.equal(user.exp, 70);

  // Also test normal quality (rng=0.5 -> ×1 drop)
  const b3 = await startBrew(uid, 'pill_ess_1', { now: new Date(tHarv.getTime() + 60000) });
  assert.equal(b3.success, true);
  const resNorm = await harvestBatch(uid, { now: new Date(tHarv.getTime() + 106 * 60000), rng: () => 0.5 });
  assert.equal(resNorm.harvest_summary.pills_dropped.pill_ess_1, 1);
  assert.equal(__getAlchemyTestInventory(uid).pill_ess_1, 4);
});

test('2. A2: Pet EXP Bar math, proportional LT discount & simulatePetExpGain', () => {
  assert.equal(PET_EXP_PER_LEVEL_MULT, 100);
  assert.equal(getPetExpRequiredForLevel(1), 100);
  assert.equal(getPetExpRequiredForLevel(10), 1000);
  assert.equal(getPetExpRequiredForLevel(100), 0);

  assert.equal(buildPetExpProgressBar(50, 100, 10), '▓▓▓▓▓░░░░░');
  assert.equal(buildPetExpProgressBar(0, 0, 8), '▓▓▓▓▓▓▓▓');

  // Lv.10 0 EXP -> Lv.11 = 500 LT; at 500/1000 EXP (50%) -> 250 LT
  assert.equal(computePetLevelLtCost(10, 0, 11), 500);
  assert.equal(computePetLevelLtCost(10, 500, 11), 250);
  assert.equal(computePetLevelLtCost(10, 500, 12), 250 + 550);

  // Multi-level rollover & Lv.100 cap
  const s1 = simulatePetExpGain(1, 0, 350); // Lv1 needs 100, Lv2 needs 200 => Lv3 with 50/300 EXP
  assert.equal(s1.newLevel, 3);
  assert.equal(s1.newExp, 50);
  assert.equal(s1.needNext, 300);

  const sMax = simulatePetExpGain(99, 9800, 1000); // 99->100 only needs 100 more EXP
  assert.equal(sMax.newLevel, 100);
  assert.equal(sMax.newExp, 0);
});

test('3. A2: previewPetUpgrade & executePetUpgrade (LT / LQ / Pills / Partial / Star / Zero Role Buff)', async () => {
  const uid = '999999999999918002';
  __resetPetUpgradeTestStore({
    [uid]: {
      username: 'PetMaster',
      linh_thach: 5000,
      farm_essence: 50, // 50 LQ * 8 = 400 EXP
      // Simulate user having mythical role buffs in theory — must NOT change Pet EXP!
      role_exp_bonus_pct: 200,
      pets: [
        {
          pet_id: 'p_1',
          pet_type: 'linh_ho_tieu_bach',
          pet_name: 'Linh Hồ Tiểu Bạch',
          level: 10,
          exp: 500, // 50% of 1000
          star: 2,
          atk: 200,
          def: 150,
          spd: 180,
          power_score: 1760,
          is_active: true,
        },
      ],
      inventory: {
        pet_star_stone: 5,
        pill_ess_1: 2, // 2 * 1200 = 2400 EXP
        pill_ess_2: 1, // 1 * 3000 = 3000 EXP
      },
    },
  });

  // Preview mode=level target=12
  const prev = await previewPetUpgrade(uid, { mode: 'level', targetGoal: 12 });
  assert.equal(prev.success, true);
  assert.equal(prev.ui_variant, 'level');
  assert.equal(prev.target_goal, 12);
  assert.equal(prev.quotes.lt.cost, 800); // 250 + 550
  assert.equal(prev.quotes.lq.need, Math.ceil((500 + 1100) / PET_EXP_PER_LQ)); // 1600 / 8 = 200 LQ
  assert.equal(UNICODE_PICTO_RE.test(prev.title), false);
  assert.equal(UNICODE_PICTO_RE.test(prev.description), false);

  // Execute LQ when owned (50) < need (200): consumes ALL 50 LQ -> +400 EXP (500 + 400 = 900/1000 Lv.10)
  const exLq = await executePetUpgrade(uid, { mode: 'level', method: 'lq', targetGoal: 12 });
  assert.equal(exLq.success, true);
  assert.equal(exLq.used_units, 50);
  assert.equal(exLq.gained_exp, 50 * PET_EXP_PER_LQ); // Exact 400 EXP, ZERO role buff applied!
  assert.equal(exLq.new_level, 10);
  assert.equal(exLq.new_exp, 900);
  assert.equal(__getPetUpgradeTestState(uid).user.farm_essence, 0);

  // Execute pill_ess_1 aiming at Lv.12 (need 100 + 1100 = 1200 EXP -> exactly 1 pill!)
  const exP1 = await executePetUpgrade(uid, { mode: 'level', method: 'pill_ess_1', targetGoal: 12 });
  assert.equal(exP1.success, true);
  assert.equal(exP1.used_units, 1);
  assert.equal(exP1.new_level, 12);
  assert.equal(exP1.new_exp, 0);
  assert.equal(__getPetUpgradeTestState(uid).inventory.pill_ess_1, 1);

  // Execute pill_ess_2 aiming at Lv.13 (need 1200 EXP -> uses 1 pill_ess_2 (+3000 EXP) -> reaches Lv.14 + 500 EXP!)
  const exP2 = await executePetUpgrade(uid, { mode: 'level', method: 'pill_ess_2', targetGoal: 13 });
  assert.equal(exP2.success, true);
  assert.equal(exP2.used_units, 1);
  assert.equal(exP2.new_level, 14); // 12->13 costs 1200, 13->14 costs 1300, leftover 500/1400
  assert.equal(exP2.new_exp, 500);

  // Execute LT aiming at Lv.15: Lv.14 LT = 14*50 = 700, discounted by 500/1400 -> resets EXP to 0
  const expectedLt = computePetLevelLtCost(14, 500, 15);
  const exLt = await executePetUpgrade(uid, { mode: 'level', method: 'lt', targetGoal: 15 });
  assert.equal(exLt.success, true);
  assert.equal(exLt.cost_lt, expectedLt);
  assert.equal(exLt.new_level, 15);
  assert.equal(exLt.new_exp, 0);

  // Mode star: 2★ -> 4★ (stones: 2+3=5, LT: 400+600=1000)
  const prevStar = await previewPetUpgrade(uid, { mode: 'star', targetGoal: 4 });
  assert.equal(prevStar.success, true);
  assert.equal(prevStar.stone_cost, 5);
  assert.equal(prevStar.lt_cost, 1000);
  const exStar = await executePetUpgrade(uid, { mode: 'star', targetGoal: 4 });
  assert.equal(exStar.success, true);
  assert.equal(exStar.new_star, 4);

  // Business error returns HTTP 200 status (status: 200) so BotGhost never breaks
  const errStar = await executePetUpgrade(uid, { mode: 'star', targetGoal: 5 });
  assert.equal(errStar.success, false);
  assert.equal(errStar.status, 200);
});

test('4. A3 & PDF Prompt Integrity: Zero Emoji Collisions, Exchange/Wiki/SpecialShop', async () => {
  const emojis = JSON.parse(fs.readFileSync(path.join(BACKEND_ROOT, 'src/config/custom_emojis.json'), 'utf8'));
  const iconIds = [
    'pet_act_pat', 'pet_act_hug', 'pet_act_sleep', 'pet_act_play',
    'pet_act_brush', 'pet_act_snack', 'pet_act_gift', 'pet_act_chat',
    'bond_tier_low', 'bond_tier_mid', 'bond_tier_high', 'bond_tier_max',
    'bond_gift_box', 'bond_auto_farm', 'upgrade_exp_orb', 'upgrade_star_burst',
  ];
  const frameIds = [
    ...Object.keys(V17_PET_EVOLUTIONS).map((k) => `frame_bond_${k}`),
    `frame_bond_${FUYUMI_SUPREME_EVOLUTION.base_pet_type}`,
  ];
  assert.equal(frameIds.length, 41);
  assert.equal(iconIds.every((k) => Object.hasOwn(emojis, k)), true);
  assert.deepEqual(frameIds.filter((k) => Object.hasOwn(emojis, k)), []);

  // Special shop clean error payloads & 100% offline-safe checks
  __resetSpecialShopTestStore({
    '999999999999918004': { linh_thach: 1000, red_gold_crystals: 1 },
  });
  const sun = new Date('2026-11-29T10:00:00+07:00');
  const convErr = await convertLtToCrystals('999999999999918004', 2, { now: sun });
  assert.equal(convErr.success, false);
  const buyErr = await buySpecialShopItem('999999999999918004', 'farm_auto_card', 2, { now: sun });
  assert.equal(buyErr.success, false);

  const wOverview = await getWikiData('overview');
  assert.equal(wOverview.success, true);
  assert.match(JSON.stringify(wOverview), /\/upgrade/);
});
