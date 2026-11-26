/**
 * tests/tier1-features/farm-care-speedup.test.js
 * Kiểm thử cơ chế ngầm: mỗi lần tưới nước / cho ăn (/farm) rút ngắn 30 phút thời gian chín
 * (chưa công bố lên /updates — giữ LATEST_VERSION = '1.6.1' cho Update 1.7 tương lai).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FARM_SEED_BY_ID } from '../../src/data/catalog.js';
import {
  FARM_CARE_SPEEDUP_MS,
  computePlotSnapshot,
  evaluatePlotReminder,
} from '../../src/services/farmService.js';
import { LATEST_VERSION } from '../../src/data/changelogs.js';

test('1. Tưới nước / cho ăn giảm 30 phút thời gian chín mỗi lần (care_count)', () => {
  const seed = FARM_SEED_BY_ID.seed_linh_thao;
  assert.ok(seed, 'seed_linh_thao must exist');
  assert.equal(FARM_CARE_SPEEDUP_MS, 30 * 60000);

  const plantedAt = new Date('2026-11-26T10:00:00.000Z');
  // Thời điểm còn 25 phút nữa mới tới growth_hours gốc
  const checkAt = new Date(plantedAt.getTime() + seed.growth_hours * 3600000 - 25 * 60000);
  const recentCareAt = new Date(checkAt.getTime() - 30 * 60000).toISOString();

  const baseRow = {
    id: 1,
    user_id: '757091869183311872',
    slot_index: 1,
    plot_type: 'linh_dien',
    seed_id: seed.seed_id,
    status: 'growing',
    planted_at: plantedAt.toISOString(),
    last_cared_at: recentCareAt,
    care_count: 0,
  };

  const snap0 = computePlotSnapshot(baseRow, checkAt);
  assert.equal(snap0.computed_status, 'growing', 'care_count=0 tại -25p vẫn đang lớn');

  const snap1 = computePlotSnapshot({ ...baseRow, care_count: 1 }, checkAt);
  assert.equal(snap1.computed_status, 'ready', 'care_count=1 (-30p) đã chín tại -25p');

  const rem1 = evaluatePlotReminder({ ...baseRow, care_count: 1 }, checkAt);
  assert.equal(rem1.transitionStatus, 'ready');
  assert.equal(rem1.alert, null);

  // care_count=2 giảm 60 phút
  const checkAt60 = new Date(plantedAt.getTime() + seed.growth_hours * 3600000 - 55 * 60000);
  const recentCare60 = new Date(checkAt60.getTime() - 30 * 60000).toISOString();
  const snap1At55 = computePlotSnapshot({ ...baseRow, last_cared_at: recentCare60, care_count: 1 }, checkAt60);
  const snap2At55 = computePlotSnapshot({ ...baseRow, last_cared_at: recentCare60, care_count: 2 }, checkAt60);
  assert.equal(snap1At55.computed_status, 'growing');
  assert.equal(snap2At55.computed_status, 'ready');
});

test('2. Không công bố sớm lên /updates (giữ nguyên 1.6.1 cho bản 1.7 tương lai)', () => {
  assert.equal(LATEST_VERSION, '1.6.1');
});
