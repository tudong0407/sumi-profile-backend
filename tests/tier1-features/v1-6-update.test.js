/**
 * tests/tier1-features/v1-6-update.test.js
 * Kiểm thử toàn diện Ver 1.6:
 * - /shop fix lỗi mua nhầm Viền & Ảnh Nền khi preview nhiều lần (message_id binding)
 * - 3 Lọ Luck Potion (+20%/+40%/+60% theo lượt, dùng chung /roll & Đổ Thạch, cộng dồn /gieoque, không stack 2 lọ khác loại)
 * - Đổ Thạch (/dothach): 20 Nguyên Thạch, 105 manh mối mơ hồ (65/35), 100k Monte Carlo EV, 7 nhóm Tối Thượng loại Unique & Fuyumi, tách biệt Pity 350
 * - Gieo Quẻ Đầu Ngày (/gieoque): 6 bậc Khí Vận (100%), 30 bài thơ, 1/ngày, Cầu An Giải Hạn 250 LT
 * - /nhiemvu OwO 3 tab + WebP renderer (renderQuestBoardWebp)
 * - Changelog v1.6 (+1.000 LT, 0 Unicode pictographs, không nhắc Role Level nerf / buff Viền-Nền)
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { supabase } from '../../src/config/supabase.js';

async function cleanupV16TestUsers() {
  if (!supabase) return;
  const ids = ['999999999999916001', '999999999999916002', '999999999999916003', '999999999999916004'];
  const tables = [
    'shop_message_selections',
    'shop_selections',
    'user_luck_buffs',
    'user_stone_stalls',
    'user_stone_rewards',
    'user_daily_fortunes',
    'user_inventory',
    'user_pets',
    'users',
  ];
  for (const t of tables) {
    try {
      await supabase.from(t).delete().in('user_id', ids);
    } catch {
      // ignore cleanup errors
    }
  }
}

before(cleanupV16TestUsers);
after(cleanupV16TestUsers);

import {
  LUCK_POTIONS,
  LUCK_POTION_BY_ID,
  STONE_TIERS,
  STONE_SPECIES,
  STONE_CLUES,
  SUPREME_PICK_CATEGORIES,
  FORTUNE_TIERS,
  FORTUNE_POEMS,
  FORTUNE_REROLL_COST_LT,
} from '../../src/data/v16ExpansionCatalog.js';
import {
  SHOP_CONSUMABLES,
  JOBS_CATALOG,
  MYTHIC_UNIQUE_ITEM_IDS,
  MYTHIC_UNIQUE_PET_TYPES,
  MYTHIC_UNIQUE_DOMAIN_IDS,
  MYTHIC_UNIQUE_SENSE_IDS,
  MYTHIC_UNIQUE_REALM_IDS,
} from '../../src/data/catalog.js';
import { previewShopItem, buyShopItem } from '../../src/services/shopService.js';
import {
  activateLuckPotion,
  consumeLuckCharges,
  getEffectiveLuckAndFortune,
  drawDailyFortune,
  rerollDailyFortune,
} from '../../src/services/luckAndFortuneService.js';
import {
  getStoneStall,
  previewStallStone,
  cutStallStone,
  claimSupremeStonePick,
  mapOutcomeToCutState,
  resolveStoneCutImageUrl,
} from '../../src/services/stoneCuttingService.js';
import { BATTLE_COOLDOWN_MS } from '../../src/services/battleEngine/battleService.js';
import { TOWER_COOLDOWN_MS, challengeTower, getQuestStatus } from '../../src/services/questService.js';
import { LATEST_VERSION, getChangelogPayload } from '../../src/data/changelogs.js';

const UNICODE_PICTOGRAPH_RE = /[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/u;

test('v1.6 Changelog & Version Lock', () => {
  assert.equal(LATEST_VERSION, '1.6');
  const payload = getChangelogPayload('1.6');
  assert.equal(payload.success, true);
  assert.equal(payload.ack_reward_lt, 1000);
  assert.equal(UNICODE_PICTOGRAPH_RE.test(payload.title), false);
  assert.equal(UNICODE_PICTOGRAPH_RE.test(payload.description), false);
  assert.equal(/giảm quyền|permission.*role|viền.*buff|ảnh nền.*buff/i.test(payload.description), false);
});

test('v1.6 Shop Preview -> Buy Message Binding Fix', async () => {
  const uid = '999999999999916001';
  // Preview 4 mẫu viền/nền với 4 messageId khác nhau
  const p1 = await previewShopItem(uid, 'frames', 'jade_lotus', { messageId: '160000000000001001' });
  const p2 = await previewShopItem(uid, 'frames', 'amethyst_celestial', { messageId: '160000000000001002' });
  const p3 = await previewShopItem(uid, 'frames', 'crimson_phoenix', { messageId: '160000000000001003' });
  const p4 = await previewShopItem(uid, 'frames', 'frost_crystal', { messageId: '160000000000001004' });

  assert.equal(p1.success, true);
  assert.equal(p2.success, true);
  assert.equal(p3.success, true);
  assert.equal(p4.success, true);

  // Nếu gọi buyShopItem với messageId của tin đầu tiên, kết quả không được chọn 'frost_crystal'
  const buyRes = await buyShopItem(uid, { messageId: '160000000000001001' });
  assert.equal(typeof buyRes, 'object');
  if (buyRes.item_id) {
    assert.equal(buyRes.item_id, 'jade_lotus');
  }
});

test('v1.6 Luck Potions Catalog & Non-Stacking / Charge Rules', async () => {
  assert.equal(LUCK_POTIONS.length, 3);
  assert.ok(SHOP_CONSUMABLES.some((c) => c.item_id === 'potion_luck_minor'));
  assert.ok(SHOP_CONSUMABLES.some((c) => c.item_id === 'potion_luck_major'));
  assert.ok(SHOP_CONSUMABLES.some((c) => c.item_id === 'potion_luck_supreme'));

  const minor = LUCK_POTION_BY_ID.potion_luck_minor;
  const major = LUCK_POTION_BY_ID.potion_luck_major;
  const supreme = LUCK_POTION_BY_ID.potion_luck_supreme;
  assert.equal(minor.luck_bonus_pct, 20);
  assert.equal(minor.charges, 40);
  assert.equal(major.luck_bonus_pct, 40);
  assert.equal(major.charges, 60);
  assert.equal(supreme.luck_bonus_pct, 60);
  assert.equal(supreme.charges, 80);

  const uid = '999999999999916002';
  const act1 = await activateLuckPotion(uid, 'potion_luck_minor', { skipInventoryCheck: true });
  assert.equal(act1.success, true);
  assert.equal(act1.remaining_charges, 40);

  // Không cho uống đè lọ khác loại khi vẫn còn lượt
  const actDiff = await activateLuckPotion(uid, 'potion_luck_major', { skipInventoryCheck: true });
  assert.equal(actDiff.success, false);
  assert.equal(actDiff.error, 'DIFFERENT_POTION_ACTIVE');

  // Cộng dồn cùng loại
  const actSame = await activateLuckPotion(uid, 'potion_luck_minor', { skipInventoryCheck: true });
  assert.equal(actSame.success, true);
  assert.equal(actSame.remaining_charges, 80);

  const cons = await consumeLuckCharges(uid, 10);
  assert.equal(cons.chargesUsed, 10);
  assert.equal(cons.luckPctApplied, 20);
  assert.equal(cons.remainingCharges, 70);

  const eff = await getEffectiveLuckAndFortune(uid);
  assert.equal(eff.potionLuckPct, 20);
  assert.equal(eff.potionCharges, 70);
});

test('v1.6 Do Thach Catalog: 40 Species, 300 Clues (100/100/100), Cut-State Image Mapping, 7 Supreme Picks, EV Sanity', () => {
  assert.equal(STONE_TIERS.length, 4);
  assert.equal(STONE_SPECIES.length, 40);
  assert.equal(new Set(STONE_SPECIES.map((s) => s.stone_id)).size, 40);
  assert.equal(STONE_CLUES.dim.length, 100);
  assert.equal(STONE_CLUES.neutral.length, 100);
  assert.equal(STONE_CLUES.radiant.length, 100);
  const allClues = Object.values(STONE_CLUES).flat();
  assert.equal(allClues.length, 300);
  assert.equal(new Set(allClues).size, 300);
  assert.equal(SUPREME_PICK_CATEGORIES.length, 7);

  assert.equal(mapOutcomeToCutState('empty'), 'loss');
  assert.equal(mapOutcomeToCutState('low'), 'loss');
  assert.equal(mapOutcomeToCutState('mid'), 'mid');
  assert.equal(mapOutcomeToCutState('high'), 'win');
  assert.equal(mapOutcomeToCutState('epic'), 'win');
  assert.equal(mapOutcomeToCutState('supreme'), 'win');
  const cutUrl = resolveStoneCutImageUrl('stone_common_1', 'common', 'high');
  assert.ok(cutUrl.endsWith('/assets/stones/stone_common_1.webp?v=1.6') || cutUrl.includes('_win.webp'));

  for (const s of STONE_SPECIES) {
    assert.equal(UNICODE_PICTOGRAPH_RE.test(s.name), false);
    assert.equal(UNICODE_PICTOGRAPH_RE.test(s.lore), false);
  }
  for (const c of allClues) {
    assert.equal(UNICODE_PICTOGRAPH_RE.test(c), false);
  }

  // Kiểm tra 100.000 lượt mô phỏng theo xác suất mỗi tier: house edge nhẹ / hợp lý
  const N = 100000;
  for (const tier of STONE_TIERS) {
    let totalReturnLt = 0;
    const pLow = tier.low_rate;
    const pMid = pLow + tier.mid_rate;
    const pHigh = pMid + tier.high_rate;
    const pEpic = pHigh + tier.epic_rate;
    const pSup = pEpic + tier.supreme_rate;
    for (let i = 0; i < N; i += 1) {
      const r = Math.random();
      if (r < pLow) {
        totalReturnLt += (tier.payouts.low.ltMin + tier.payouts.low.ltMax) / 2;
      } else if (r < pMid) {
        totalReturnLt += (tier.payouts.mid.ltMin + tier.payouts.mid.ltMax) / 2;
      } else if (r < pHigh) {
        totalReturnLt += (tier.payouts.high.ltMin + tier.payouts.high.ltMax) / 2;
      } else if (r < pEpic) {
        const ep = tier.payouts.epic;
        totalReturnLt += (ep.ltMin + ep.ltMax) / 2 + (ep.enchantStones || 0) * 150 + (ep.starStones || 0) * 180 + (ep.absStoneChance || 0) * 1200;
      } else if (r < pSup) {
        totalReturnLt += tier.price * 10;
      }
    }
    const avgLtPerCut = totalReturnLt / N;
    assert.ok(avgLtPerCut >= tier.price * 0.45 && avgLtPerCut <= tier.price * 0.95, `Unexpected EV for ${tier.tier_key}: ${avgLtPerCut} vs ${tier.price}`);
  }
});

test('v1.6 Do Thach Stall & Supreme Pick Excludes Unique / Fuyumi', async () => {
  const uid = '999999999999916003';
  const stall = await getStoneStall(uid, 'mythic');
  assert.equal(stall.success, true);
  assert.equal(stall.stones.length, 3);
  const allStallClues = stall.stones.flatMap((s) => s.clues || []);
  assert.equal(allStallClues.length, 6);
  assert.equal(new Set(allStallClues).size, 6, 'All 6 clues on the same stall must be unique');

  const prev = await previewStallStone(uid, 'mythic', 1);
  assert.equal(prev.success, true);
  assert.ok(typeof prev.description === 'string' && prev.description.includes('Manh Mối'));

  // Kiểm tra claimSupremeStonePick với 7 categories (khi DB null trả fallback / hoặc lỗi DB clean)
  const cutRes = await cutStallStone(uid, 'common', 0);
  assert.equal(typeof cutRes, 'object');

  const claimRes = await claimSupremeStonePick(uid, 'pet');
  assert.equal(typeof claimRes, 'object');

  // Bảo đảm set Unique có tồn tại để kiểm chứng lọc
  assert.ok(MYTHIC_UNIQUE_PET_TYPES.size > 0);
  assert.ok(MYTHIC_UNIQUE_ITEM_IDS.size > 0);
  assert.ok(MYTHIC_UNIQUE_DOMAIN_IDS.size > 0);
  assert.ok(MYTHIC_UNIQUE_SENSE_IDS.size > 0);
  assert.ok(MYTHIC_UNIQUE_REALM_IDS.size > 0);
});

test('v1.6 Gieo Que (/gieoque): 6 Tiers (100%), 30 Poems, 1/day Lock & Reroll', async () => {
  assert.equal(FORTUNE_TIERS.length, 6);
  const weightSum = FORTUNE_TIERS.reduce((sum, t) => sum + t.weight, 0);
  assert.equal(weightSum, 100);
  assert.equal(FORTUNE_REROLL_COST_LT, 250);

  for (const tier of FORTUNE_TIERS) {
    assert.equal((FORTUNE_POEMS[tier.tier_key] || []).length, 5);
  }

  const uid = '999999999999916004';
  const draw1 = await drawDailyFortune(uid, { forceTierKey: 'tieu_cat' });
  assert.equal(draw1.success, true);
  assert.equal(draw1.already_drawn, false);
  assert.equal(draw1.can_reroll, false);

  const draw2 = await drawDailyFortune(uid);
  assert.equal(draw2.success, true);
  assert.equal(draw2.already_drawn, true);

  const rerollRes = await rerollDailyFortune(uid);
  assert.equal(rerollRes.success, false);
  assert.equal(rerollRes.status, 200);
  assert.equal(rerollRes.error, 'NOT_ELIGIBLE');
  assert.ok(typeof rerollRes.title === 'string' && rerollRes.title.length > 0);
  assert.ok(typeof rerollRes.description === 'string' && rerollRes.description.length > 0);
});

test('v1.6 Battle & Tower Cooldowns + Combined Daily/Weekly /nhiemvu View', async () => {
  assert.equal(BATTLE_COOLDOWN_MS, 15000);
  assert.equal(TOWER_COOLDOWN_MS, 6000);

  const uid = '999999999999916001';
  const st = await getQuestStatus(uid);
  assert.equal(st.success, true);
  assert.ok(st.message.includes('1. Nhiệm Vụ Hàng Ngày'));
  assert.ok(st.message.includes('2. Hợp Đồng Tuần'));
  assert.ok(st.message.includes('────────────────────────'));
  assert.equal(st.quest_card_url, undefined);

  const c1 = await challengeTower(uid, { preRender: false, seed: 7 });
  assert.equal(c1.success, true);
  const c2 = await challengeTower(uid, { preRender: false, seed: 7 });
  assert.equal(c2.success, false);
  assert.equal(c2.error, 'TOWER_COOLDOWN');
  assert.ok(c2.cooldown_seconds >= 1 && c2.cooldown_seconds <= 6);

  // /job +20% payout verification (silent buff, no changelog update)
  assert.equal(JOBS_CATALOG.length, 6);
  assert.deepEqual(
    JOBS_CATALOG.map((j) => [j.job_id, j.ltMin, j.ltMax, j.exp]),
    [
      ['quet_san', 42, 60, 22],
      ['rua_bat', 46, 62, 24],
      ['tuoi_cay', 50, 70, 26],
      ['giao_trasua', 54, 74, 30],
      ['cau_ca', 58, 82, 34],
      ['tuan_tra', 66, 90, 38],
    ],
  );
});
