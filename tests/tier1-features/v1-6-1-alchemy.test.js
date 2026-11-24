/**
 * tests/tier1-features/v1-6-1-alchemy.test.js
 * Kiểm thử toàn diện Bản Cập Nhật Ver 1.6.1 — Lò Luyện Đan (/luyendan):
 * 1. Catalog 5 cấp Lò & 6 công thức (thời gian nấu, ân hạn 20->60p, mở khóa, 0 Unicode pictographs).
 * 2. Trừ vốn LT + Linh Quả (/farm) cho Tinh Hoa I/II, giới hạn 5 mẻ/ngày (UTC+7) trả HTTP 200 thân thiện.
 * 3. Lò #2: tự mở miễn phí tại Lv.45 vs mở sớm 2.500 LT, chạy 2 lò song song.
 * 4. Thu đan đúng hạn (Thường ×1.0, Thượng Phẩm ×1.25, Đan Vân ×1.50, bonus cấp Lò), nâng cấp Lò Lv.1->2.
 * 5. Quá ân hạn: cháy đan thu 30 LT (không cộng total_batches_completed) + nổ khóa riêng lò đó 4h + Sửa Lò Nhanh (300 LT).
 * 6. DM nhắc 2 mốc (ready & warn10 <=10p trước nổ), không gửi trùng, tích hợp claimNextFarmDmNotification fallback.
 * 7. Changelog v1.6.1 (+1.000 LT, 0 Unicode) & resolveAlchemyImageUrl an toàn khi chưa có WebP.
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { supabase } from '../../src/config/supabase.js';
import {
  ALCHEMY_DAILY_LIMIT,
  ALCHEMY_SLOT2_FREE_LEVEL,
  ALCHEMY_SLOT2_UNLOCK_COST,
  ALCHEMY_BURN_PAYOUT_LT,
  ALCHEMY_EXPLODE_LOCK_HOURS,
  ALCHEMY_INSTANT_REPAIR_COST,
  FURNACE_TIERS,
  ALCHEMY_RECIPES,
  ALCHEMY_RECIPE_BY_ID,
  computeBrewDurationMs,
  computeGraceMs,
  checkRecipeUnlock,
  resolveAlchemyImageUrl,
  resolveExplodedFurnaceImageUrl,
} from '../../src/data/v161AlchemyCatalog.js';
import {
  getAlchemyStatus,
  startBrew,
  harvestBatch,
  upgradeFurnace,
  unlockSecondFurnace,
  repairFurnace,
  claimNextAlchemyDmNotification,
  __resetAlchemyTestStore,
} from '../../src/services/alchemyService.js';
import { claimNextFarmDmNotification } from '../../src/services/farmService.js';
import { getChangelogPayload, LATEST_VERSION } from '../../src/data/changelogs.js';

const TEST_IDS = [
  '999999999999916101',
  '999999999999916102',
  '999999999999916103',
  '999999999999916104',
];

const UNICODE_PICTO_RE = /[\p{Extended_Pictographic}]/u;

async function cleanupTestUsers() {
  __resetAlchemyTestStore();
  if (!supabase) return;
  for (const table of ['user_alchemy_furnaces', 'user_alchemy_profiles', 'users']) {
    try {
      await supabase.from(table).delete().in('user_id', TEST_IDS);
    } catch {
      // ignore cleanup
    }
  }
}

async function seedUser(userId, { level = 1, coins = 5000, farm_essence = 100, exp = 0 } = {}) {
  if (!supabase) {
    __resetAlchemyTestStore({
      [userId]: { username: `Test_${userId.slice(-3)}`, level, linh_thach: coins, farm_essence, exp },
    });
    return;
  }
  const { error } = await supabase.from('users').upsert({
    user_id: userId,
    username: `Test_${userId.slice(-3)}`,
    level,
    linh_thach: coins,
    farm_essence,
    exp,
  }, { onConflict: 'user_id' });
  assert.equal(error, null, `Seed user failed: ${error?.message}`);
}

before(cleanupTestUsers);
after(cleanupTestUsers);

test('1. Catalog 5 cấp lò, 6 công thức & 0 Unicode pictographs', () => {
  assert.equal(FURNACE_TIERS.length, 5);
  assert.equal(ALCHEMY_RECIPES.length, 6);
  assert.equal(computeGraceMs(1), 20 * 60000);
  assert.equal(computeGraceMs(5), 60 * 60000);

  const t1 = ALCHEMY_RECIPE_BY_ID.pill_t1;
  assert.equal(computeBrewDurationMs(t1, 1), 60 * 60000);
  assert.equal(computeBrewDurationMs(t1, 5), 48 * 60000);

  const t4 = ALCHEMY_RECIPE_BY_ID.pill_t4;
  assert.equal(computeBrewDurationMs(t4, 5), 96 * 60000);

  assert.equal(checkRecipeUnlock(ALCHEMY_RECIPE_BY_ID.pill_t2, 1, 1).unlocked, false);
  assert.equal(checkRecipeUnlock(ALCHEMY_RECIPE_BY_ID.pill_t2, 15, 1).unlocked, true);
  assert.equal(checkRecipeUnlock(ALCHEMY_RECIPE_BY_ID.pill_t2, 1, 2).unlocked, true);

  for (const tier of FURNACE_TIERS) {
    assert.equal(UNICODE_PICTO_RE.test(tier.name), false, `Unicode in tier ${tier.name}`);
  }
  for (const r of ALCHEMY_RECIPES) {
    assert.equal(UNICODE_PICTO_RE.test(r.name), false, `Unicode in recipe ${r.name}`);
  }
});

test('2. Nấu đan trừ vốn LT + Linh Quả, giới hạn 5 mẻ/ngày & 2 lò song song', async () => {
  const uid = TEST_IDS[0];
  await cleanupTestUsers();
  await seedUser(uid, { level: 60, coins: 10000, farm_essence: 100 });

  const t0 = new Date('2026-11-25T02:00:00.000Z');
  const st0 = await getAlchemyStatus(uid, { now: t0 });
  assert.equal(st0.success, true);
  assert.equal(st0.state.slot2_unlocked, true, 'Lv.60 >= 45 tự mở Lò #2 miễn phí');
  assert.equal(UNICODE_PICTO_RE.test(st0.title), false);
  assert.equal(UNICODE_PICTO_RE.test(st0.description), false);

  // Nấu Tinh Hoa II trên Lò #1 (trừ 60 LT + 40 Linh Quả)
  const b1 = await startBrew(uid, 'pill_ess_2', { now: t0 });
  assert.equal(b1.success, true);
  assert.equal(b1.state.coins, 10000 - 60);
  assert.equal(b1.state.farm_essence, 100 - 40);
  assert.equal(b1.state.batches_today, 1);

  // Nấu song song Tinh Hoa I trên Lò #2 (105p nấu + 20p ân hạn = 125p cháy)
  const b2 = await startBrew(uid, 'pill_ess_1', { now: t0 });
  assert.equal(b2.success, true);
  assert.equal(b2.state.batches_today, 2);

  // Lò #1 và #2 đều bận -> từ chối thân thiện
  const bBusy = await startBrew(uid, 'pill_t1', { now: t0 });
  assert.equal(bBusy.success, false);

  // Thu khi chín sau 120 phút (còn trong ân hạn 20p -> chín cả 2 lò)
  const tHarvest = new Date(t0.getTime() + 120 * 60000 + 1000);
  const h1 = await harvestBatch(uid, { now: tHarvest, rng: () => 0.5 }); // Thành Đan 1.0x
  assert.equal(h1.success, true);
  assert.equal(h1.harvest_summary.completed_count, 2);
  assert.equal(h1.state.total_batches_completed, 2);

  // Đốt thêm 3 mẻ nữa để chạm ngưỡng 5/5 ngày
  for (let i = 0; i < 3; i += 1) {
    const startT = new Date(tHarvest.getTime() + i * 130 * 60000);
    const br = await startBrew(uid, 'pill_t1', { now: startT });
    assert.equal(br.success, true);
    const hv = await harvestBatch(uid, { now: new Date(startT.getTime() + 65 * 60000), rng: () => 0.01 }); // Đan Vân 1.5x
    assert.equal(hv.success, true);
  }

  // Mẻ thứ 6 trong ngày phải bị chặn (trả success: false thân thiện)
  const tCap = new Date(tHarvest.getTime() + 4 * 130 * 60000);
  const b6 = await startBrew(uid, 'pill_t1', { now: tCap });
  assert.equal(b6.success, false);
  assert.match(b6.description, /5\/5 mẻ/);
});

test('3. Mở Lò #2 sớm 2.500 LT trước Lv.45 & nâng cấp Lò Lv.1 -> Lv.2', async () => {
  const uid = TEST_IDS[1];
  await cleanupTestUsers();
  await seedUser(uid, { level: 10, coins: 4000, farm_essence: 0 });

  const t0 = new Date('2026-11-25T03:00:00.000Z');
  const st0 = await getAlchemyStatus(uid, { now: t0 });
  assert.equal(st0.state.slot2_unlocked, false);

  // Chưa đủ 5 mẻ -> chưa nâng cấp Lò Lv.2 được
  const upFail = await upgradeFurnace(uid, { now: t0 });
  assert.equal(upFail.success, false);

  // Mở sớm Lò #2 giá 2.500 LT
  const unl = await unlockSecondFurnace(uid, { now: t0 });
  assert.equal(unl.success, true);
  assert.equal(unl.state.slot2_unlocked, true);
  assert.equal(unl.state.coins, 4000 - ALCHEMY_SLOT2_UNLOCK_COST);

  // Hoàn thành 5 mẻ qua 2 ngày để đủ điều kiện nâng cấp Lò Lv.2 (cần 1.200 LT + 5 mẻ)
  let curT = t0;
  for (let i = 0; i < 5; i += 1) {
    curT = new Date(t0.getTime() + (i >= 4 ? 24 * 3600000 : 0) + i * 70 * 60000);
    const br = await startBrew(uid, 'pill_t1', { now: curT });
    assert.equal(br.success, true);
    const hv = await harvestBatch(uid, { now: new Date(curT.getTime() + 61 * 60000), rng: () => 0.5 });
    assert.equal(hv.success, true);
  }

  const upOk = await upgradeFurnace(uid, { now: new Date(curT.getTime() + 62 * 60000) });
  assert.equal(upOk.success, true);
  assert.equal(upOk.state.furnace_level, 2);
});

test('4. Cháy đan (30 LT) + Nổ lò khóa 4h + Sửa Lò Nhanh (300 LT) & DM nhắc 2 mốc', async () => {
  const uid = TEST_IDS[2];
  await cleanupTestUsers();
  await seedUser(uid, { level: 50, coins: 2000, farm_essence: 0 });

  const t0 = new Date('2026-11-25T04:00:00.000Z');
  const br1 = await startBrew(uid, 'pill_t1', { now: t0 });
  assert.equal(br1.success, true);

  // Mốc 1 DM: chín (sau 60 phút, còn 20p ân hạn)
  const tReady = new Date(t0.getTime() + 60 * 60000 + 1000);
  const dm1 = await claimNextAlchemyDmNotification({ now: tReady });
  assert.equal(dm1.has_notification, true);
  assert.equal(dm1.user_id, uid);
  assert.equal(dm1.alerts[0].type, 'ready');
  assert.equal(UNICODE_PICTO_RE.test(dm1.dm_title), false);
  assert.equal(UNICODE_PICTO_RE.test(dm1.dm_description), false);

  // Gọi lại lần 2 ngay lúc đó -> không gửi trùng
  const dmDup = await claimNextAlchemyDmNotification({ now: tReady });
  assert.equal(dmDup.has_notification, false);

  // Mốc 2 DM: cảnh báo khẩn <=10 phút trước nổ (phút 72) + test fallback qua claimNextFarmDmNotification
  const tWarn10 = new Date(t0.getTime() + 72 * 60000);
  const dm2 = await claimNextFarmDmNotification({ now: tWarn10 });
  assert.equal(dm2.has_notification, true);
  assert.equal(dm2.source, 'alchemy');
  assert.equal(dm2.alerts[0].type, 'warn10');

  // Quá hạn 85 phút (> 60 + 20 ân hạn) -> cháy đan 30 LT + nổ khóa Lò #1 trong 4h
  const tBurned = new Date(t0.getTime() + 85 * 60000);
  const hBurn = await harvestBatch(uid, { now: tBurned });
  assert.equal(hBurn.success, true);
  assert.equal(hBurn.harvest_summary.burned_count, 1);
  assert.equal(hBurn.harvest_summary.total_gain_lt, ALCHEMY_BURN_PAYOUT_LT);
  assert.equal(hBurn.state.total_batches_completed, 0, 'Cháy đan không cộng mẻ thành công');
  const slot1After = hBurn.state.slots.find((s) => Number(s.slot_index) === 1);
  assert.equal(slot1After.status, 'exploded');

  // Lò #2 vẫn nấu bình thường khi Lò #1 đang nổ
  const br2 = await startBrew(uid, 'pill_t1', { now: tBurned });
  assert.equal(br2.success, true);

  // Sửa Lò Nhanh (300 LT) mở ngay Lò #1
  const rep = await repairFurnace(uid, { now: tBurned });
  assert.equal(rep.success, true);
  const slot1Fixed = rep.state.slots.find((s) => Number(s.slot_index) === 1);
  assert.equal(slot1Fixed.status, 'idle');
  assert.equal(rep.state.coins, 2000 - 10 + ALCHEMY_BURN_PAYOUT_LT - 10 - ALCHEMY_INSTANT_REPAIR_COST);
});

test('5. Changelog v1.6.1 (+1.000 LT, 0 Unicode) & resolveAlchemyImageUrl an toàn', () => {
  assert.equal(LATEST_VERSION, '1.6.1');
  const payload = getChangelogPayload('1.6.1');
  assert.equal(payload.success, true);
  assert.equal(payload.ack_reward_lt, 1000);
  assert.equal(UNICODE_PICTO_RE.test(payload.title), false);
  assert.equal(UNICODE_PICTO_RE.test(payload.description), false);

  // Ảnh không tồn tại trả '' an toàn; ảnh đã cài đặt trả URL WebP + fallback exploded
  assert.equal(resolveAlchemyImageUrl('non_existent_furnace.webp'), '');
  assert.match(resolveAlchemyImageUrl('furnace_lv1.webp'), /\/assets\/alchemy\/furnace_lv1\.webp\?v=1\.6\.1$/);
  assert.match(resolveExplodedFurnaceImageUrl(1), /\/assets\/alchemy\/furnace_(?:lv1_)?exploded\.webp\?v=1\.6\.1$/);
});
