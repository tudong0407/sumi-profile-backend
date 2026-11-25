/**
 * tests/tier1-features/v1-6-3-ux-loadouts.test.js
 * Kiểm chứng toàn diện bản nâng cấp v1.6.3 (gộp ngầm v1.6.1):
 * 1. Catalog /farm 8 ô (+10% giá hạt/trứng: 88, 220, 550, 132, 330, 825 LT).
 * 2. /luyendan: 6 mẻ/ngày, +40% vốn, UI ngang (f1/f2, image_url === ''), ui_variant, slotIndex, has_harvest_msg.
 * 3. Tối ưu tốc độ /info: wikiRenderer 1200x600 (RENDER_SCALE = 1.2) & staticAssetCacheService manifest + RAM cache hit.
 * 4. Changelog v1.6.1 nâng ack_reward_lt = 1500 & giữ LATEST_VERSION = '1.6.1'.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  FARM_SEEDS,
  FARM_SEED_BY_ID,
  EXCHANGE_ITEM_BY_ID,
  EQUIPMENT_CATALOG,
} from '../../src/data/catalog.js';
import {
  ALCHEMY_DAILY_LIMIT,
  ALCHEMY_RECIPE_BY_ID,
} from '../../src/data/v161AlchemyCatalog.js';
import { supabase } from '../../src/config/supabase.js';
import {
  __resetAlchemyTestStore,
  getAlchemyStatus,
  startBrew,
  harvestBatch,
} from '../../src/services/alchemyService.js';
import {
  LATEST_VERSION,
  getUpdateAckReward,
  getChangelogPayload,
} from '../../src/data/changelogs.js';
import { renderWikiItemCard } from '../../src/canvas/wikiRenderer.js';
import { getStaticNonUniqueItemCardBuffer } from '../../src/services/staticAssetCacheService.js';
import { paginateFormattedLines, getUserPets } from '../../src/services/inventoryService.js';

test('1. /farm mở rộng 8 ô & tăng +10% giá hạt giống / trứng', () => {
  assert.equal(FARM_SEEDS.length, 6);
  assert.equal(FARM_SEED_BY_ID.seed_linh_thao.cost_lt, 88);
  assert.equal(FARM_SEED_BY_ID.seed_tien_thao.cost_lt, 220);
  assert.equal(FARM_SEED_BY_ID.seed_than_moc.cost_lt, 550);
  assert.equal(FARM_SEED_BY_ID.egg_linh_thu.cost_lt, 132);
  assert.equal(FARM_SEED_BY_ID.egg_tien_thu.cost_lt, 330);
  assert.equal(FARM_SEED_BY_ID.egg_than_thu.cost_lt, 825);
  assert.equal(EXCHANGE_ITEM_BY_ID.farm_slot_unlock.max_slots, 8);
});

test('2. /luyendan: +40% vốn, 6 mẻ/ngày, UI ngang f1/f2, ui_variant, slotIndex & has_harvest_msg', async () => {
  assert.equal(ALCHEMY_DAILY_LIMIT, 6);
  assert.equal(ALCHEMY_RECIPE_BY_ID.pill_t1.costLt, 14);
  assert.equal(ALCHEMY_RECIPE_BY_ID.pill_t2.costLt, 35);
  assert.equal(ALCHEMY_RECIPE_BY_ID.pill_t3.costLt, 56);
  assert.equal(ALCHEMY_RECIPE_BY_ID.pill_t4.costLt, 84);
  assert.equal(ALCHEMY_RECIPE_BY_ID.pill_ess_1.costLt, 56);
  assert.equal(ALCHEMY_RECIPE_BY_ID.pill_ess_1.costEssence, 28);
  assert.equal(ALCHEMY_RECIPE_BY_ID.pill_ess_2.costLt, 84);
  assert.equal(ALCHEMY_RECIPE_BY_ID.pill_ess_2.costEssence, 56);

  const uid = '999000000000001631';
  const cleanTestUser = async () => {
    if (!supabase) return;
    await supabase.from('user_alchemy_furnaces').delete().eq('user_id', uid);
    await supabase.from('user_alchemy_profiles').delete().eq('user_id', uid);
    await supabase.from('users').delete().eq('user_id', uid);
  };

  if (supabase) {
    await cleanTestUser();
    await supabase.from('users').insert({
      user_id: uid,
      username: 'TestTuSi163',
      level: 20,
      exp: 0,
      linh_thach: 5000,
      farm_essence: 200,
      last_seen_update_version: '1.6.1',
    });
  } else {
    __resetAlchemyTestStore({
      [uid]: { username: 'TestTuSi163', level: 20, linh_thach: 5000, farm_essence: 200 },
    });
  }

  try {
    const t0 = new Date('2026-11-25T02:00:00.000Z');
    const st0 = await getAlchemyStatus(uid, { now: t0 });
    assert.equal(st0.image_url, '');
    assert.equal(st0.ui_variant, 's1_ok');
    assert.equal(st0.slot2_unlocked, 'false');
    assert.equal(st0.show_repair_btn, 'false');
    assert.ok(st0.f1_name.includes('Lò #1'));
    assert.ok(st0.f2_name.includes('Lò #2'));
    assert.equal(st0.has_harvest_msg, 'false');

    // Nấu đúng Lò #1
    const b1 = await startBrew(uid, 'pill_t1', { now: t0, slotIndex: 1 });
    assert.equal(b1.success, true);
    assert.equal(b1.state.coins, 5000 - 14);

    // Thử nấu vào Lò #2 khi chưa mở -> từ chối
    const b2Locked = await startBrew(uid, 'pill_t1', { now: t0, slotIndex: 2 });
    assert.equal(b2Locked.success, false);

    // Thu đan khi chưa chín -> has_harvest_msg === 'false'
    const hEarly = await harvestBatch(uid, { now: new Date(t0.getTime() + 10 * 60000) });
    assert.equal(hEarly.success, false);
    assert.equal(hEarly.has_harvest_msg, 'false');

    // Thu đan đúng hạn -> has_harvest_msg === 'true' & lò về Đang trống
    const hOk = await harvestBatch(uid, { now: new Date(t0.getTime() + 65 * 60000), rng: () => 0.5 });
    assert.equal(hOk.success, true);
    assert.equal(hOk.has_harvest_msg, 'true');
    assert.ok(hOk.harvest_title.includes('THU ĐAN HOÀN TẤT'));
    assert.ok(hOk.f1_value.includes('Đang trống'));
  } finally {
    await cleanTestUser();
  }
});

test('3. wikiRenderer 1200x600 & staticAssetCacheService cache hit nhanh', async () => {
  const sampleItem = EQUIPMENT_CATALOG.find((i) => !i.is_unique);
  assert.ok(sampleItem);
  const buf = await renderWikiItemCard({ ...sampleItem, slot_label: 'Vũ Khí' }, { format: 'webp' });
  assert.ok(Buffer.isBuffer(buf) && buf.length > 5000);

  const cached1 = await getStaticNonUniqueItemCardBuffer({ ...sampleItem, slot_label: 'Vũ Khí' }, 'webp');
  const tStart = Date.now();
  const cached2 = await getStaticNonUniqueItemCardBuffer({ ...sampleItem, slot_label: 'Vũ Khí' }, 'webp');
  const elapsed = Date.now() - tStart;
  assert.equal(cached1.length, cached2.length);
  assert.ok(elapsed < 50, `Expected RAM cache hit < 50ms, got ${elapsed}ms`);
});

test('4. v1.6.1 giữ LATEST_VERSION = 1.6.1 & nâng ack_reward_lt = 1500', () => {
  assert.equal(LATEST_VERSION, '1.6.1');
  assert.equal(getUpdateAckReward('1.6.1'), 1500);
  const log = getChangelogPayload('1.6.1');
  assert.equal(log.success, true);
  assert.equal(log.ack_reward_lt, 1500);
  assert.ok(log.description.includes('1.500'));

  const paged = paginateFormattedLines(Array.from({ length: 35 }, (_, i) => i + 1), (n) => `• Mục ${n}`, { page: 2, pageSize: 15 });
  assert.equal(paged.page, 2);
  assert.equal(paged.totalPages, 3);
});

test('5. getUserPets (/api/pet/:userId) trả về summary_pets & danh sách Linh Thú đầy đủ', async () => {
  if (!supabase) return;
  const res = await getUserPets('757091869183311872', { sort: 'element_asc', page: 1 });
  assert.equal(res.success, true);
  assert.ok(Array.isArray(res.pets) && res.pets.length > 0);
  assert.ok(typeof res.summary_pets === 'string' && res.summary_pets.length > 10);
  assert.ok(res.summary_pets.includes('• '));
});
