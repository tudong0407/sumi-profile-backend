/**
 * tests/tier1-features/v1-7-update.test.js
 * Comprehensive Ver 1.7 Regression & Feature Gate (100% offline-safe, zero live DB/API mutations).
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import * as cat from '../../src/data/catalog.js';
import { STONE_TIERS } from '../../src/data/v16ExpansionCatalog.js';
import {
  LATEST_VERSION,
  V17_CHANGELOG,
  getChangelogPayload,
  getUpdateAckBundle,
} from '../../src/data/changelogs.js';
import { DOMAIN_TO_PET_ELEMENTS, evaluateSetBonus } from '../../src/services/battleEngine/setBonusEngine.js';
import { rollRarityWithUniqueSplit, PITY_UNIQUE_CHANCE, DAILY_BASE_MIN, DAILY_BASE_MAX } from '../../src/services/economyService.js';
import { claimSupremeStonePick } from '../../src/services/stoneCuttingService.js';
import { DAILY_QUEST_REWARD_LT, FIXED_DAILY_QUESTS, ROTATING_DAILY_QUEST_POOL, TOWER_MILESTONE_BONUSES } from '../../src/services/questService.js';
import { computeScaledPetBaseStats } from '../../src/services/inventoryService.js';
import { activateAbsEnchantCharm, consumeAbsEnchantCharmRun, __setAbsCharmTestMode } from '../../src/services/luckAndFortuneService.js';
import { evaluateFarmAutoProtect } from '../../src/services/farmService.js';
import { evaluateAlchemyAutoProtect, runAlchemyAutoProtect, __resetAlchemyTestStore } from '../../src/services/alchemyService.js';
import {
  getSpecialShopScheduleStatus,
  getSpecialShopCatalog,
  convertLtToCrystals,
  buySpecialShopItem,
  openMythicSelectorCard,
  __resetSpecialShopTestStore,
  __getSpecialShopTestState,
} from '../../src/services/specialShopService.js';
import { getShopCatalog } from '../../src/services/shopService.js';
import {
  getEvolutionHub,
  evolveUniquePet,
  craftEvoCrystal,
  __resetEvolutionTestStore,
  __getEvolutionTestState,
} from '../../src/services/evolutionService.js';
import { createUltimateState, tickUltimateTurn, isUltimateReadyToFire, tryTriggerUltimate } from '../../src/services/battleEngine/ultimateEngine.js';
import { compileCombatant } from '../../src/services/battleEngine/statsCompiler.js';
import { simulateBattle, simulateBattleFast, renderBattleLogHtml } from '../../src/services/battleEngine/battleService.js';
import { simulateTeamBattle, renderTeamBattleLogHtml } from '../../src/services/battleEngine/teamBattleService.js';
import { getWikiData, getWikiPetDetail } from '../../src/services/wikiService.js';
import { petEmojiKey } from '../../src/config/emojiHelper.js';
import { resolvePetSplashAsset } from '../../src/canvas/drawUtils.js';
import { getServerLeaderboard } from '../../src/services/leaderboardService.js';
import { lookupInfo } from '../../src/services/infoService.js';
import { renderProfileCard } from '../../src/canvas/profileRenderer.js';
import { renderBattleCard } from '../../src/canvas/battleRenderer.js';
import { renderWikiPetCard } from '../../src/canvas/wikiRenderer.js';
import { renderFramePreviewBuffer } from '../../src/canvas/drawUtils.js';
import { buildV17DdlStatements, runMigration } from '../../scripts/migrate_v1_7.mjs';
import { validateBotGhostPatterns } from '../../scripts/deploy_v1_7_botghost.mjs';

test('Ver 1.7 Catalog counts, 7-tier rarity ladder, SetBonus & Economy config', () => {
  assert.equal(cat.PET_CATALOG.length, 151);
  assert.equal(cat.MYTHIC_UNIQUE_PET_TYPES.size, 40);
  assert.equal(cat.PET_CATALOG.filter((p) => p.is_kemonomimi).length, 10);
  assert.equal(cat.EQUIPMENT_CATALOG.length, 264);
  assert.equal(cat.MYTHIC_UNIQUE_ITEM_IDS.size, 59);
  assert.equal(cat.DOMAIN_CATALOG.length, 66);
  assert.equal(cat.DIVINE_SENSE_CATALOG.length, 49);
  assert.equal(cat.DIVINE_REALM_CATALOG.length, 49);
  assert.equal(cat.AVATAR_FRAMES.length, 71); // 30 base (default + 29 v15/v17) + 41 Ver 1.8B Bond frames
  assert.equal(cat.AVATAR_FRAMES.filter((f) => !f.is_bond_exclusive).length, 30);
  assert.equal(Object.keys(cat.V17_PET_EVOLUTIONS).length, 40);

  assert.equal(LATEST_VERSION, '1.7.1');
  assert.equal(V17_CHANGELOG.ack_reward_lt, 3000);

  // Verify Ver 1.7 full gift bundle (3000 LT + 5 TT + 5 Tower Reset Cards [ignore_cap] + 300 Linh Quả + 1 Ấn Khắc Tuyệt Đối)
  const bundle = getUpdateAckBundle('1.7');
  assert.equal(bundle.linh_thach, 3000);
  assert.equal(bundle.red_gold_crystals, 5);
  assert.equal(bundle.farm_essence, 300);
  const trCard = bundle.items.find((i) => i.item_id === 'tower_reset_card');
  const absStone = bundle.items.find((i) => i.item_id === 'enchant_stone_absolute');
  assert.ok(trCard && trCard.quantity === 5 && trCard.ignore_cap === true, 'Must grant +5 tower_reset_card ignoring cap');
  assert.ok(absStone && absStone.quantity === 1 && absStone.ignore_cap === true, 'Must grant +1 enchant_stone_absolute');

  // Verify /updates 3-page pagination & ZERO Meta leaks & ZERO raw Unicode
  for (let p = 1; p <= 3; p += 1) {
    const pl = getChangelogPayload('1.7', p);
    assert.equal(pl.success, true);
    assert.equal(pl.page, p);
    assert.equal(pl.total_pages, 3);
    assert.equal(pl.has_pagination, 'true');
    assert.equal(pl.prev_page, p > 1 ? p - 1 : 3);
    assert.equal(pl.next_page, p < 3 ? p + 1 : 1);
    assert.ok(pl.description.length > 100 && pl.description.length < 3800);
    assert.ok(!/\bmeta\b|tier\s*list|win\s*rate/i.test(pl.description), `Page ${p} must NOT expose Meta analysis`);
    const stripped = `${pl.title}\n${pl.description}`.replace(/<a?:[a-zA-Z0-9_]+:\d+>/g, '');
    assert.equal(/\p{Extended_Pictographic}/u.test(stripped), false, `Page ${p} contains raw Unicode emoji`);
  }

  assert.equal(cat.normalizeRarityKey('Phàm Phẩm'), 'common');
  assert.equal(cat.normalizeRarityKey('Linh Phẩm'), 'rare');
  assert.equal(cat.normalizeRarityKey('Tiên Phẩm'), 'epic');
  assert.equal(cat.normalizeRarityKey('Thần Thoại'), 'mythic');
  assert.equal(cat.normalizeRarityKey('Tối Thượng'), 'unique_supreme');
  assert.equal(cat.normalizeRarityKey('Tối Thượng Chân Thần'), 'evolved_supreme');
  assert.equal(cat.normalizeRarityKey('Tối Thượng Thần Thoại'), 'supreme');

  assert.ok(DOMAIN_TO_PET_ELEMENTS['Huyễn Vực'].includes('Hư Không'));
  const sb = evaluateSetBonus({
    pet: { element: 'Hư Không', rarity_key: 'mythic' },
    equipment: {
      weapon: { element: 'Hư Không', rarity_key: 'mythic' },
      gem: { element: 'Hư Không', rarity_key: 'mythic' },
      soul: { element: 'Hư Không', rarity_key: 'mythic' },
    },
    domainLoadout: { domain: { element: 'Hư Không', name: 'Test Vực' } },
  });
  assert.ok(sb.statBonusPct >= 5, 'Set bonus for Hư Không must trigger');

  assert.equal(cat.JOBS_CATALOG.find((j) => j.job_id === 'quet_san').ltMin, 55);
  assert.equal(cat.JOBS_CATALOG.find((j) => j.job_id === 'tuan_tra').ltMax, 120);
  assert.equal(cat.WEEKLY_CONTRACTS_CONFIG.bonus.rewardLt, 700);
});

test('Ver 1.7 -> 1.7.1 Gacha 0.60% split & Stone Cutting -10pp empty + Quest/Tower milestones', async () => {
  assert.equal(DAILY_BASE_MIN, 110);
  assert.equal(DAILY_BASE_MAX, 160);
  assert.equal(PITY_UNIQUE_CHANCE, 0.05);

  // 0.03% cố định Độc Nhất, miễn nhiễm hoàn toàn Luck Potion / gieoque
  const uHitLowLuck = rollRarityWithUniqueSplit(() => 0.00025, 1.0);
  assert.deepEqual(uHitLowLuck, { rarityKey: 'mythic', naturalWantUnique: true });
  const uMissHighLuck = rollRarityWithUniqueSplit(() => 0.00033, 5.0);
  assert.deepEqual(uMissHighLuck, { rarityKey: 'mythic', naturalWantUnique: false });

  // Stone cutting rates -10pp empty
  assert.deepEqual(STONE_TIERS.map((t) => t.empty_rate), [0.38, 0.34, 0.32, 0.30]);
  const noBox = await claimSupremeStonePick('123456789012345678', 'pet');
  assert.match(noBox.title, /HỘP THẦN THOẠI CỰC PHẨM/i);

  // Quest +30% & Tower F100..500 +1 chaos_essence_shard
  assert.equal(DAILY_QUEST_REWARD_LT, 170);
  assert.equal(FIXED_DAILY_QUESTS.daily.rewardLt, 25);
  assert.equal(FIXED_DAILY_QUESTS.exp.rewardLt, 30);
  assert.equal(ROTATING_DAILY_QUEST_POOL.find((q) => q.id === 'wins').rewardLt, 40);
  for (const f of [100, 200, 300, 400, 500]) {
    assert.equal(TOWER_MILESTONE_BONUSES[f].chaosShards, 1);
  }
});

test('Ver 1.7 Farm/Alchemy Auto-Rescue & Abs Enchant Charm', async () => {
  __setAbsCharmTestMode(true);
  try {
    // Abs charm +5 runs, cap 50, consume 1
    const uid = '990011223344556677';
    const act = await activateAbsEnchantCharm(uid, { skipInventoryCheck: true });
    assert.equal(act.success, true);
    assert.equal(act.remaining_runs, 5);
    const con = await consumeAbsEnchantCharmRun(uid);
    assert.deepEqual(con, { used: true, remaining: 4 });
  } finally {
    __setAbsCharmTestMode(false);
  }

  // Pure Farm Auto-Protect helper (wilt_hours = 4.5)
  const t0 = new Date('2026-11-29T00:00:00Z');
  const almostWilted = new Date(t0.getTime() + 4.5 * 3600000 - 3 * 60000); // còn 3 phút trước héo
  const farmEv = evaluateFarmAutoProtect({
    seed_id: 'seed_linh_thao',
    status: 'growing',
    planted_at: t0.toISOString(),
    last_cared_at: t0.toISOString(),
    care_count: 0,
    protected_this_cycle: false,
  }, 1, almostWilted);
  assert.equal(farmEv.shouldProtect, true);
  const alreadyProtected = evaluateFarmAutoProtect({
    seed_id: 'seed_linh_thao',
    status: 'growing',
    planted_at: t0.toISOString(),
    last_cared_at: t0.toISOString(),
    care_count: 0,
    protected_this_cycle: true,
  }, 1, almostWilted);
  assert.equal(alreadyProtected.shouldProtect, false);

  // Alchemy Auto-Protect pure check
  const burnAt = new Date('2026-11-29T02:00:00Z');
  const nearBurn = new Date(burnAt.getTime() - 2 * 60000);
  const alEv = evaluateAlchemyAutoProtect({
    status: 'brewing',
    recipe_id: 'dan_bat_pham',
    burn_at: burnAt.toISOString(),
    protected_this_cycle: false,
  }, 1, nearBurn);
  assert.equal(alEv.shouldProtect, true);
});

test('Ver 1.7 Special Shop (/shop_dacbiet) schedule, exchange, buy, selector & /shop frames pagination', async () => {
  // Sunday 08:30 UTC+7 = 01:30 UTC on Sunday (2026-11-29 is Sunday)
  const sunOpen = new Date('2026-11-29T01:30:00Z');
  const sunClosedEarly = new Date('2026-11-29T00:59:00Z');
  const monClosed = new Date('2026-11-30T05:00:00Z');
  assert.equal(getSpecialShopScheduleStatus(sunOpen).is_open, true);
  assert.equal(getSpecialShopScheduleStatus(sunClosedEarly).is_open, false);
  assert.equal(getSpecialShopScheduleStatus(monClosed).is_open, false);

  const uid = '880011223344556677';
  __resetSpecialShopTestStore({
    [uid]: {
      linh_thach: 200000,
      red_gold_crystals: 0,
    },
  });
  try {
    // Closed rejects
    const closedRes = await convertLtToCrystals(uid, 10, { now: monClosed });
    assert.equal(closedRes.success, false);
    assert.equal(closedRes.error, 'SPECIAL_SHOP_CLOSED');

    // Min 5 TT enforced
    const minRes = await convertLtToCrystals(uid, 4, { now: sunOpen });
    assert.equal(minRes.success, false);

    // Convert 150 TT (112,500 LT)
    const okConv = await convertLtToCrystals(uid, 150, { now: sunOpen });
    assert.equal(okConv.success, true);
    assert.equal(okConv.red_gold_crystals, 150);

    // Cap 200 TT/week enforced (150 + 51 > 200)
    const capRes = await convertLtToCrystals(uid, 51, { now: sunOpen });
    assert.equal(capRes.success, false);
    assert.equal(capRes.error, 'WEEKLY_EXCHANGE_CAP_EXCEEDED');

    // Buy evo_crystal (120 TT, 1/wk) & frame_v17_06_crimson_raven (25 TT, 1x lifetime)
    const buyEvo = await buySpecialShopItem(uid, 'evo_crystal', 1, { now: sunOpen });
    assert.equal(buyEvo.success, true);
    const dupEvo = await buySpecialShopItem(uid, 'evo_crystal', 1, { now: sunOpen });
    assert.equal(dupEvo.success, false);

    const buyFrame = await buySpecialShopItem(uid, 'frame_v17_06_crimson_raven', 1, { now: sunOpen });
    assert.equal(buyFrame.success, true);
    const dupFrame = await buySpecialShopItem(uid, 'frame_v17_06_crimson_raven', 1, { now: sunOpen });
    assert.equal(dupFrame.success, false);

    // Convert 50 TT + buy mythic_selector_card (55 TT)
    await convertLtToCrystals(uid, 50, { now: sunOpen });
    const buySel = await buySpecialShopItem(uid, 'mythic_selector_card', 1, { now: sunOpen });
    assert.equal(buySel.success, true);
    const openSel = await openMythicSelectorCard(uid, 'pet', { now: sunOpen });
    assert.equal(openSel.success, true);
    assert.equal(openSel.was_unowned, true);

    const catRes = await getSpecialShopCatalog(uid, { now: sunOpen });
    assert.equal(catRes.success, true);
    assert.equal(catRes.items.length, 13);
  } finally {
    __resetSpecialShopTestStore(null);
  }

  // /shop frames pagination (24 paid LT frames => 3 pages)
  const shopF1 = await getShopCatalog('frames', { page: 1 });
  assert.equal(shopF1.success, true);
  assert.equal(shopF1.total_pages, 3);
  assert.equal(shopF1.next_page, 2);
  assert.equal(shopF1.prev_page, 3);
});

test('Ver 1.7 /tienhoa Tab 1 Evolve & Tab 2 Craft Hồng Mông (NO /hiente)', async () => {
  const uid = '770011223344556677';
  __resetEvolutionTestStore({
    [uid]: {
      linh_thach: 25000,
      inventory: {
        chaos_essence_shard: 3,
        evo_crystal: 1,
      },
      pets: [
        {
          pet_id: 'p_unique_1',
          pet_type: 'hon_don_chi_to_long',
          pet_name: '« Hỗn Độn Chi Tổ Long »',
          level: 40,
          star: 8,
          atk: 1200,
          def: 1100,
          spd: 1100,
          enchant_grade: 'S',
          is_active: true,
          is_unique: true,
          is_evolved: false,
          status: 'ready',
          quantity: 1,
        },
        {
          pet_id: 'p_mythic_sac',
          pet_type: 'chu_tuoc_au_dieu',
          pet_name: 'Chu Tước Ấu Điểu',
          level: 1,
          star: 1,
          atk: 530,
          def: 450,
          spd: 530,
          is_active: false,
          is_unique: false,
          is_evolved: false,
          status: 'ready',
          quantity: 1,
        },
      ],
      loadouts: [{ slot_index: 1, pet_id: 'p_mythic_sac', pet_type: 'chu_tuoc_au_dieu' }],
    },
  });

  try {
    // Tab 2: 2-step confirmation required
    const preview = await craftEvoCrystal(uid, { targetPetId: 'p_mythic_sac', confirmed: false });
    assert.equal(preview.success, true);
    assert.equal(preview.requires_confirmation, true);

    // Confirm Tab 2 Craft: 3 shards + 1 Normal Mythic + 2,500 LT -> +1 evo_crystal (now 2 total) + cleans loadout
    const crafted = await craftEvoCrystal(uid, { targetPetId: 'p_mythic_sac', confirmed: true });
    assert.equal(crafted.success, true);
    assert.equal(crafted.evo_crystal, 2);
    assert.equal(crafted.chaos_essence_shard, 0);
    const stAfterCraft = __getEvolutionTestState(uid);
    assert.equal(stAfterCraft.pets.length, 1);
    assert.equal(stAfterCraft.loadouts[0].pet_id, null);

    // Tab 1 Evolve Failure preserves evo_crystal and deducts only LT!
    const failEvo = await evolveUniquePet(uid, { petType: 'hon_don_chi_to_long', ltTier: 1, forceFail: true });
    assert.equal(failEvo.success, true);
    assert.equal(failEvo.evolved, false);
    assert.equal(failEvo.evo_crystal_remaining, 2);
    assert.equal(failEvo.lt_spent, 1000);

    // Tab 1 Evolve Success (9000 LT = 100%)
    const okEvo = await evolveUniquePet(uid, { petType: 'hon_don_chi_to_long', ltTier: 5, rng: () => 0.1 });
    assert.equal(okEvo.success, true);
    assert.equal(okEvo.evolved, true);
    assert.equal(okEvo.evo_crystal_remaining, 0);
    assert.equal(okEvo.level, 40);
    assert.equal(okEvo.star, 8);
    assert.equal(okEvo.enchant_grade, 'S');
    assert.ok(okEvo.ultimate?.id);

    // Tab 2 multi-category Mythic crafting: Weapon / Domain / Sense / Realm support + protections
    const uid2 = '770011223344556688';
    __resetEvolutionTestStore({
      [uid2]: {
        linh_thach: 20000,
        inventory: { chaos_essence_shard: 6, evo_crystal: 0 },
        pets: [
          { pet_id: 'p_keep', pet_type: 'hoa_thach_nham_nham', pet_name: 'Hóa Thạch', level: 1, star: 1, is_active: true, status: 'ready', quantity: 1 },
        ],
        items: [
          { id: 'it_eq', item_id: 'weapon_mythic_4', slot: 'weapon', equipped_to_pet: 'hoa_thach_nham_nham', quantity: 1 },
          { id: 'it_free', item_id: 'weapon_mythic_5', slot: null, equipped_to_pet: null, quantity: 1 },
          { id: 'it_uniq', item_id: 'weapon_mythic_1', slot: null, equipped_to_pet: null, quantity: 1 },
        ],
        domains: [
          { id: 'dom_free', entity_kind: 'domain', entity_id: 'domain_mythic_1', is_equipped: false, quantity: 1 },
        ],
        loadouts: [{ slot_index: 1, weapon_id: 'weapon_mythic_5', domain_id: 'domain_mythic_1' }],
      },
    });
    const hub2 = await getEvolutionHub(uid2);
    assert.equal(hub2.sacrifice_counts.items, 1);
    assert.equal(hub2.sacrifice_counts.domains, 1);

    const errEq = await craftEvoCrystal(uid2, { targetAsset: 'weapon_mythic_4', confirmed: true });
    assert.equal(errEq.success, false);
    assert.equal(errEq.error, 'ITEM_EQUIPPED');

    const errUniq = await craftEvoCrystal(uid2, { targetAsset: 'weapon_mythic_1', confirmed: true });
    assert.equal(errUniq.success, false);
    assert.equal(errUniq.error, 'INVALID_SACRIFICE_RARITY');

    const prevItem = await craftEvoCrystal(uid2, { targetAsset: 'weapon_mythic_5', confirmed: false });
    assert.equal(prevItem.success, true);
    assert.equal(prevItem.requires_confirmation, true);
    assert.equal(prevItem.target_kind, 'item');

    const okItem = await craftEvoCrystal(uid2, { targetPetId: prevItem.target_pet_id, confirmed: true });
    assert.equal(okItem.success, true);
    assert.equal(okItem.evo_crystal, 1);
    assert.equal(__getEvolutionTestState(uid2).items.length, 2);
    assert.equal(__getEvolutionTestState(uid2).loadouts[0].weapon_id, null);

    const okDom = await craftEvoCrystal(uid2, { targetAsset: 'domain_mythic_1', confirmed: true });
    assert.equal(okDom.success, true);
    assert.equal(okDom.evo_crystal, 2);
    assert.equal(__getEvolutionTestState(uid2).domains.length, 0);
    assert.equal(__getEvolutionTestState(uid2).loadouts[0].domain_id, null);
  } finally {
    __resetEvolutionTestStore(null);
  }

  // computeScaledPetBaseStats respects isEvolved
  const meta = cat.PET_BY_TYPE.hon_don_chi_to_long;
  const base40 = computeScaledPetBaseStats(meta, 40, 8, false);
  const evo40 = computeScaledPetBaseStats(meta, 40, 8, true);
  assert.ok(evo40.atk > base40.atk && evo40.power_score > base40.power_score);
});

test('Ver 1.7 All 40 Ultimates repeatable trigger & 1v1 / Team battle integration', async () => {
  // Verify all 40 Ultimates compile, fill trigger, fire cleanly, enter cooldown, and fire a 2nd time!
  for (const [petType, evo] of Object.entries(cat.V17_PET_EVOLUTIONS)) {
    const cActor = await compileCombatant({
      user_id: 'test_ult_a',
      username: 'TesterA',
      pet: { pet_type: petType, level: 40, star: 8, is_evolved: true },
    });
    const cTarget = await compileCombatant({
      user_id: 'test_ult_b',
      username: 'TesterB',
      pet: { pet_type: 'hoa_thach_nham_nham', level: 40, star: 8 },
    });
    cTarget.maxHp = 500000;
    cTarget.currentHp = 500000;
    cActor.state.ultimate.cooldown = 0;

    const u = cActor.state.ultimate;
    const fill = () => {
      u.dmgDealt = cActor.maxHp * 10;
      u.dmgTaken = cActor.maxHp * 10;
      u.crits = 10;
      u.dodges = 10;
      u.burnTicksApplied = 10;
      u.healsPctAccum = 5.0;
      u.healEvents = 10;
      u.cleanses = 10;
      u.turnsLived = 10;
      u.shieldTurns = 10;
      u.firstStrikes = 10;
      u.stunsApplied = 10;
      u.reviveTriggered = true;
    };
    fill();
    assert.equal(isUltimateReadyToFire(cActor, cTarget), true, `${petType} ult should be ready`);
    const r1 = tryTriggerUltimate(cActor, cTarget, { rng: () => 0.1, turnNumber: 2 });
    assert.equal(r1.triggered, true, `${petType} ult failed to trigger`);
    assert.equal(r1.triggerCount, 1);

    for (let i = 0; i < (evo.ultimate.cooldownTurns || 6); i += 1) {
      tickUltimateTurn(cActor, 3 + i);
    }
    fill();
    const r2 = tryTriggerUltimate(cActor, cTarget, { rng: () => 0.1, turnNumber: 10 });
    assert.equal(r2.triggered, true, `${petType} ult should repeat trigger`);
    assert.equal(r2.triggerCount, 2);
  }

  // Full 1v1 combat integration (dmgOrLowEnemyHp guaranteed to trigger & repeat when enemy drops < 45% HP)
  const p1 = {
    user_id: 'test_p1',
    username: 'EvolvedMain',
    level: 50,
    pet: { pet_type: 'cuu_u_do_than_diem_lang', level: 40, star: 8, is_evolved: true },
    weapon: 'weapon_unique_10',
    armor: 'armor_unique_10',
    jewel: 'jewel_unique_10',
    relic: 'relic_unique_10',
    soul: 'soul_unique_10',
  };
  const p2 = {
    user_id: 'test_p2',
    username: 'TankDummy',
    level: 50,
    pet: { pet_type: 'hoa_thach_nham_nham', level: 30, star: 5 },
  };
  const battle = await simulateBattle(p1, p2, { seed: 424242, isTest: true, skipQuestTracking: true });
  assert.equal(battle.success, true);
  assert.ok(battle.turns.some((t) => t.action === 'ultimate'), '1v1 Battle should record ultimate actions');

  // Full Team 3v3 integration
  const teamA = [await compileCombatant(p1, 'attacker')];
  const teamB = [await compileCombatant(p2, 'defender')];
  const teamRes = await simulateTeamBattle(teamA, teamB, { mode: '3v3', seed: 424242 });
  assert.ok(teamRes?.battleId);
  assert.ok(teamRes.turnCount >= 1);
  assert.ok(
    (teamRes.untruncatedLogLines || []).some((l) => l.includes('[ULTIMATE #')),
    'Team battle should trigger & log Ultimate in untruncatedLogLines',
  );
});

test('Ver 1.7 Wiki Sub-Hubs, Canvas Renderers, Fuyumi Pill, 9 Frames & Migration Dry-Run', async () => {
  const subUnique = getWikiData('pets', 1, 'unique');
  assert.equal(subUnique.success, true);
  assert.equal(subUnique.total_items, 40);

  const subKemo = getWikiData('pets', 1, 'kemonomimi');
  assert.equal(subKemo.success, true);
  assert.equal(subKemo.total_items, 40);

  const subDom = getWikiData('domains', 1, 'domain');
  assert.equal(subDom.success, true);

  const petDetail = await getWikiPetDetail('hon_don_chi_to_long');
  assert.equal(petDetail.success, true);
  assert.ok(petDetail.data.evo_data?.ultimate?.id);

  const kemoUnifiedDetail = await getWikiPetDetail('hong_mong_cuu_vy_tien');
  assert.equal(kemoUnifiedDetail.success, true);
  assert.equal(kemoUnifiedDetail.data.rarity_key, 'mythic');
  assert.equal(kemoUnifiedDetail.data.is_unique, true);
  assert.ok(!/Thú Nhân|Kemonomimi/i.test(kemoUnifiedDetail.embed?.description || ''));

  const infoCons = await lookupInfo('evo_crystal', '757091869183311872');
  assert.equal(infoCons.success, true);

  // Frame previews for all 9 v17 frames
  const v17Frames = cat.AVATAR_FRAMES.filter((f) => String(f.frame_id).startsWith('frame_v17_'));
  assert.equal(v17Frames.length, 9);
  for (const fr of v17Frames) {
    const buf = await renderFramePreviewBuffer(fr.frame_id);
    assert.ok(Buffer.isBuffer(buf) && buf.length > 1000, `Preview render failed for ${fr.frame_id}`);
  }

  // Profile card + Wiki Pet card + Battle card with Fuyumi full pill
  const profPng = await renderProfileCard({
    user_id: '757091869183311872',
    username: 'Fuyumi',
    level: 100,
    exp: 500000,
    linh_thach: 999999,
    avatar_frame: 'frame_v17_01_moon_fox',
    pet: {
      pet_type: 'hon_don_chi_to_long',
      name: 'Hỗn Độn Chi Tổ Long (Chân Thần)',
      rarity: 'Tối Thượng Chân Thần',
      element: 'Hỗn Độn',
      is_evolved: true,
      level: 40,
      star: 8,
      atk: 2000,
      def: 1900,
      spd: 1900,
      power: 20000,
    },
  });
  assert.ok(Buffer.isBuffer(profPng) && profPng.length > 5000);

  const wikiPetPng = await renderWikiPetCard({
    ...cat.PET_BY_TYPE.hon_don_chi_to_long,
    display_rarity_key: 'unique_supreme',
    current_owner: { user_id: '757091869183311872', username: 'Fuyumi' },
  });
  assert.ok(Buffer.isBuffer(wikiPetPng) && wikiPetPng.length > 5000);

  const fuyumiUnit = await compileCombatant({
    user_id: '757091869183311872',
    username: 'Fuyumi',
    pet: { pet_type: 'cuu_vi_hong_ho', rarity: 'Tối Thượng Thần Thoại', level: 100, star: 10 },
  });
  const oppUnit = await compileCombatant({
    user_id: '333000333000333003',
    username: 'Challenger',
    pet: { pet_type: 'hon_don_chi_to_long', rarity: 'Tối Thượng Chân Thần', level: 40, star: 8, is_evolved: true },
  });
  const bPng = await renderBattleCard({
    turn: 5,
    isFinal: true,
    attacker: fuyumiUnit,
    defender: oppUnit,
    winnerRole: 'attacker',
    turns: [],
    highlights: ['H1 • Test'],
  });
  assert.ok(Buffer.isBuffer(bPng) && bPng.length > 5000);

  // Migration dry-run & BotGhost pattern validation
  const ddl = buildV17DdlStatements().join('\n');
  assert.ok(ddl.includes('user_farm_plots') && ddl.includes('user_alchemy_furnaces') && ddl.includes('uq_user_pet_items_unique_item'));
  const dry = await runMigration(['--dry-run']);
  assert.equal(dry.mode, 'dry-run');
  assert.equal(dry.pets_upsert_count, 151);
  assert.equal(dry.items_upsert_count, 264);
  assert.equal(validateBotGhostPatterns().valid, true);

  // Every SHOP_CONSUMABLES + SPECIAL_CONSUMABLES must resolve its own icon cleanly (never su_pin_sigil hairpin fallback)
  const { em } = await import('../../src/config/emojiHelper.js');
  const pinTag = em('su_pin_sigil');
  const allCons = [...cat.SHOP_CONSUMABLES, ...cat.SPECIAL_CONSUMABLES];
  for (const item of allCons) {
    const resolvedIcon = item.icon || em(item.item_id);
    assert.ok(resolvedIcon && resolvedIcon.trim().length > 0, `Consumable ${item.item_id} missing icon`);
    assert.notEqual(resolvedIcon, pinTag, `Consumable ${item.item_id} unexpectedly uses su_pin_sigil`);
  }
});

test('Ver 1.7 Fuyumi Supreme Ultimate: 100% Nullify & Steal Compatibility Across All 40 Ultimates, Emoji/Splash Separation & Nhiễm Nhiễm Anti-Farm', async () => {
  // Helper to fill any ultimate trigger condition
  const fillUltGauge = (unit) => {
    const u = unit.state.ultimate;
    u.cooldown = 0;
    u.dmgDealt = unit.maxHp * 10;
    u.dmgTaken = unit.maxHp * 10;
    u.crits = 10;
    u.dodges = 10;
    u.burnTicksApplied = 10;
    u.healsPctAccum = 5.0;
    u.healEvents = 10;
    u.cleanses = 10;
    u.turnsLived = 10;
    u.shieldTurns = 10;
    u.firstStrikes = 10;
    u.stunsApplied = 10;
    u.reviveTriggered = true;
  };

  // 1. Intercept, Nullify & Steal ALL 40/40 V17_PET_EVOLUTIONS Ultimates
  for (const [petType, evo] of Object.entries(cat.V17_PET_EVOLUTIONS)) {
    const enemy = await compileCombatant({
      user_id: `enemy_${petType}`,
      username: `Enemy_${petType}`,
      pet: { pet_type: petType, level: 40, star: 8, is_evolved: true },
      domain_loadout: { domain: 'domain_mythic_1' },
    });
    const fuyumi = await compileCombatant({
      user_id: cat.FUYUMI_USER_ID,
      username: 'Fuyumi',
      level: 100,
      pet: { pet_type: 'cuu_vi_hong_ho', rarity: 'Tối Thượng Thần Thoại', level: 100, star: 10 },
      domain_loadout: { domain: 'domain_fuyumi_cuu_vi_hong_mong' },
    });
    assert.equal(fuyumi.state.ultimate.active, true, 'Fuyumi Supreme Ultimate must be active even when is_evolved=false in DB');
    assert.equal(fuyumi.ultimateDef?.id, cat.FUYUMI_SUPREME_ULTIMATE.id);

    enemy.maxHp = 500000;
    enemy.currentHp = 500000;
    fuyumi.domainRuntime = { side: { hasDomain: true, indestructible: true, energy: 999, maxEnergy: 999 }, own: { energy: 999 } };
    enemy.domainRuntime = { side: { hasDomain: true, indestructible: false, energy: 4, maxEnergy: 4 }, own: { energy: 4 } };

    fillUltGauge(enemy);
    const fuyumiHpBefore = fuyumi.currentHp;
    const enemyHpBefore = enemy.currentHp;
    const res = tryTriggerUltimate(enemy, fuyumi, { rng: () => 0.1, turnNumber: 3 });

    assert.equal(res.triggered, true, `${petType}: interception failed to trigger`);
    assert.equal(res.nullifiedAndStolen, true, `${petType}: must be marked nullifiedAndStolen`);
    assert.equal(res.interceptorId, cat.FUYUMI_USER_ID);
    assert.equal(enemy.state.ultimate.triggerCount, 0, `${petType}: enemy Ultimate must remain unexecuted (triggerCount=0)`);
    assert.equal(enemy.state.ultimate.nullifiedCount, 1, `${petType}: enemy nullifiedCount must increment`);
    assert.ok(enemy.state.ultimate.cooldown >= 1, `${petType}: enemy Ult must enter cooldown after nullify`);
    assert.equal(fuyumi.currentHp, fuyumiHpBefore, `${petType}: Fuyumi must take zero damage from nullified enemy Ult`);
    assert.equal(fuyumi.state.ultimate.triggerCount, 1, `${petType}: Fuyumi steal counter must increment`);
    assert.ok(Number.isFinite(enemy.currentHp) && enemy.currentHp >= 0, `${petType}: enemy HP must remain valid finite`);
    assert.ok(Number.isFinite(fuyumi.currentHp) && Number.isFinite(fuyumi.shield), `${petType}: Fuyumi stats must stay finite`);
    if (evo.ultimate.effect.trueMaxHpDmgPct || evo.ultimate.effect.atkDmgPct || evo.ultimate.effect.drainEnemyCurrHpPct) {
      assert.ok(enemy.currentHp < enemyHpBefore, `${petType}: stolen offensive Ultimate must damage enemy`);
    }
  }

  // 2. Mirror match safety (`cuu_vi_hong_ho` vs `cuu_vi_hong_ho`) — zero infinite recursion!
  const foxA = await compileCombatant({
    user_id: 'fox_a',
    username: 'FoxA',
    pet: { pet_type: 'cuu_vi_hong_ho', level: 100, star: 10 },
  });
  const foxB = await compileCombatant({
    user_id: 'fox_b',
    username: 'FoxB',
    pet: { pet_type: 'cuu_vi_hong_ho', level: 100, star: 10 },
  });
  foxB.maxHp = 2000000;
  foxB.currentHp = 2000000;
  fillUltGauge(foxA);
  const mirrorRes = tryTriggerUltimate(foxA, foxB, { rng: () => 0.1, turnNumber: 2 });
  assert.equal(mirrorRes.triggered, true);
  assert.notEqual(mirrorRes.nullifiedAndStolen, true, 'Mirror cuu_vi_hong_ho must not infinitely intercept');
  assert.ok(foxB.currentHp < 2000000);

  // 3. Full 1v1, Fast, and Team 3v3 integration with Fuyumi Steal Ult
  const pFuyumi = {
    user_id: cat.FUYUMI_USER_ID,
    username: 'Fuyumi',
    level: 100,
    pet: { pet_type: 'cuu_vi_hong_ho', rarity: 'Tối Thượng Thần Thoại', level: 100, star: 10 },
    weapon: 'weapon_mythic_1',
    gem: 'gem_mythic_3',
    soul: 'soul_mythic_1',
    domain_loadout: { domain: 'domain_fuyumi_cuu_vi_hong_mong', sense: 'sense_fuyumi_thai_thuong_hong_ho', realm: 'realm_fuyumi_van_co_tuyet_diet' },
  };
  const pBoss = {
    user_id: 'boss_40_ult',
    username: 'Chân Thần Địch',
    level: 100,
    pet: { pet_type: 'hon_don_chi_to_long', rarity: 'Tối Thượng Chân Thần', level: 40, star: 8, is_evolved: true },
    weapon: 'weapon_unique_10',
    gem: 'gem_unique_10',
    soul: 'soul_unique_10',
    domain_loadout: { domain: 'domain_unique_1' },
  };
  const sim1 = await simulateBattle(pFuyumi, pBoss, { seed: 777, isTest: true, skipQuestTracking: true, preRender: false });
  assert.equal(sim1.success, true);
  assert.equal(sim1.winnerRole, 'attacker');
  const html1 = await renderBattleLogHtml(sim1.battleId);
  assert.equal(html1.found, true);
  assert.ok(!html1.html.split('<script>')[0].includes('NaN'));

  const fastRes = simulateBattleFast(
    await compileCombatant(pFuyumi, 'attacker'),
    await compileCombatant(pBoss, 'defender'),
    { seed: 777 },
  );
  assert.equal(fastRes.attackerWon, true);

  const teamRes = simulateTeamBattle(
    [await compileCombatant(pFuyumi, 'attacker')],
    [await compileCombatant(pBoss, 'defender')],
    { mode: '3v3', seed: 777 },
  );
  assert.ok(teamRes?.battleId);
  const tHtml = await renderTeamBattleLogHtml(teamRes.battleId);
  assert.equal(tHtml.found, true);

  // 4. Emoji Thú Nhân Hồng Mông Đế Nữ & Splash Art Thú Nhân resolution
  assert.equal(petEmojiKey('cuu_vi_hong_ho', false), 'cuu_vi_hong_ho_evo');
  assert.equal(petEmojiKey('cuu_vi_hong_ho', true), 'cuu_vi_hong_ho_evo');
  const foxSplash = resolvePetSplashAsset('cuu_vi_hong_ho', true);
  assert.ok(
    foxSplash === 'pets/cuu_vi_hong_ho_evo.webp'
    || foxSplash === 'pets/cuu_vi_hong_ho_evo.png'
    || foxSplash === 'pets/cuu_vi_hong_ho_transparent.png',
  );

  // 5. Nhiễm Nhiễm Bot Guardian Anti-Farm & Leaderboard Exclusion
  const botUnit = await compileCombatant({
    user_id: cat.NHIEM_NHIEM_BOT_ID,
    username: 'Nhiễm Nhiễm',
    level: 100,
    pet: { pet_type: 'minh_diep_huyen_ho', level: 100, star: 10, enchant_grade: 'S' },
    weapon: 'weapon_mythic_45',
    gem: 'gem_mythic_45',
    soul: 'soul_mythic_45',
    domain_loadout: { domain: 'domain_mythic_8', sense: 'sense_mythic_32', realm: 'realm_mythic_32' },
  });
  assert.ok(botUnit.atk >= 14500 && botUnit.def >= 12500 && botUnit.spd >= 13000 && botUnit.maxHp >= 120000);
  assert.ok(botUnit.powerScore >= 95000);
  assert.equal(botUnit.state.ultimate.active, true);

  const farmer = await compileCombatant({
    user_id: '887916221239025695',
    username: 'Top1Challenger',
    level: 15,
    pet: { pet_type: 'hoa_thach_nham_nham', level: 15, star: 7, enchant_grade: 'A' },
  });
  const farmBattle = await simulateBattle(farmer, botUnit, { seed: 99, isTest: true, skipQuestTracking: true, preRender: false });
  assert.equal(farmBattle.winnerRole, 'defender', 'Challenger trying to farm Nhiễm Nhiễm must lose cleanly');

  const fuyumiVsBot = await simulateBattle(pFuyumi, botUnit, { seed: 99, isTest: true, skipQuestTracking: true, preRender: false });
  assert.equal(fuyumiVsBot.winnerRole, 'attacker', 'Master Fuyumi must still beat Guardian Nhiễm Nhiễm');

  const lbMem = await getServerLeaderboard('chat', 5);
  assert.ok(!(lbMem.entries || []).some((e) => e.user_id === cat.NHIEM_NHIEM_BOT_ID || e.user_id === cat.FUYUMI_USER_ID));

  // 6. /inv header currency order includes Xích Kim Tinh Thạch (TT) right beside Linh Quả
  const { getInventory } = await import('../../src/services/inventoryService.js');
  const invBao = await getInventory('1010756221600546946');
  assert.equal(invBao.success, true);
  assert.ok(invBao.view_description.includes('red_gold_crystal'), '/inv header must show red_gold_crystal emoji');
  assert.ok(invBao.user.red_gold_crystals >= 100, '/inv user payload must include red_gold_crystals');
});
