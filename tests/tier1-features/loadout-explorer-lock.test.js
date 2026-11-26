/**
 * tests/tier1-features/loadout-explorer-lock.test.js
 * Kiểm thử quy tắc khóa Loadout (Bộ 1 / Bộ 2 / Bộ 3) khi có Pet hoặc trang bị đang đi /explorer.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluateLoadoutExplorerLock } from '../../src/services/loadoutService.js';

const UNICODE_PICTO_RE = /[\p{Extended_Pictographic}]/u;

test('1. Không đi /explorer -> mở khóa hoàn toàn', () => {
  const res = evaluateLoadoutExplorerLock({
    slotIndex: 1,
    pet: { pet_id: 'p1', status: 'ready' },
    equippedItems: [{ item_id: 'weapon_mythic_1', quantity: 1 }],
    equippedDomains: [{ entity_id: 'domain_mythic_1', quantity: 1 }],
    busyExp: { isExploring: false, busyPetId: null, busyEquipIds: new Set(), busyDomainIds: new Set() },
  });
  assert.equal(res.locked, false);
});

test('2. Bộ 1 có Linh Thú đang đi /explorer -> khóa nguyên Bộ 1, gợi ý sang Bộ 2/3 & 0 Unicode', () => {
  const res = evaluateLoadoutExplorerLock({
    slotIndex: 1,
    pet: { pet_id: 'p1', status: 'exploring' },
    equippedItems: [],
    equippedDomains: [],
    busyExp: { isExploring: true, busyPetId: 'p1', busyEquipIds: new Set(), busyDomainIds: new Set() },
  });
  assert.equal(res.locked, true);
  assert.equal(res.error, 'LOADOUT_LOCKED_BY_EXPLORER');
  assert.match(res.message, /\*\*Bộ 1\*\*/);
  assert.match(res.message, /\*\*Bộ 2\*\*/);
  assert.match(res.message, /\*\*Bộ 3\*\*/);
  assert.equal(UNICODE_PICTO_RE.test(res.message), false);
});

test('3. Bộ 1 có Pháp Bảo hoặc Linh Vực duy nhất (qty=1) đang đi /explorer -> khóa nguyên Bộ 1', () => {
  const resItem = evaluateLoadoutExplorerLock({
    slotIndex: 1,
    pet: { pet_id: 'p2', status: 'ready' },
    equippedItems: [{ item_id: 'weapon_mythic_1', quantity: 1 }],
    equippedDomains: [],
    busyExp: { isExploring: true, busyPetId: 'p1', busyEquipIds: new Set(['weapon_mythic_1']), busyDomainIds: new Set() },
  });
  assert.equal(resItem.locked, true);

  const resDom = evaluateLoadoutExplorerLock({
    slotIndex: 2,
    pet: { pet_id: 'p2', status: 'ready' },
    equippedItems: [],
    equippedDomains: [{ entity_id: 'domain_mythic_1', quantity: 1 }],
    busyExp: { isExploring: true, busyPetId: 'p1', busyEquipIds: new Set(), busyDomainIds: new Set(['domain_mythic_1']) },
  });
  assert.equal(resDom.locked, true);
  assert.match(resDom.message, /\*\*Bộ 2\*\*/);
});

test('4. Có bản sao dự phòng (qty=2) hoặc Pet/đồ ở Bộ 2 hoàn toàn rảnh -> KHÔNG khóa Bộ 2', () => {
  const resSpare = evaluateLoadoutExplorerLock({
    slotIndex: 2,
    pet: { pet_id: 'p2', status: 'ready' },
    equippedItems: [{ item_id: 'weapon_mythic_1', quantity: 2 }],
    equippedDomains: [{ entity_id: 'domain_mythic_1', quantity: 2 }],
    busyExp: {
      isExploring: true,
      busyPetId: 'p1',
      busyEquipIds: new Set(['weapon_mythic_1']),
      busyDomainIds: new Set(['domain_mythic_1']),
    },
  });
  assert.equal(resSpare.locked, false);

  const resFree = evaluateLoadoutExplorerLock({
    slotIndex: 2,
    pet: { pet_id: 'p2', status: 'ready' },
    equippedItems: [{ item_id: 'weapon_epic_2', quantity: 1 }],
    equippedDomains: [{ entity_id: 'domain_epic_3', quantity: 1 }],
    busyExp: {
      isExploring: true,
      busyPetId: 'p1',
      busyEquipIds: new Set(['weapon_mythic_1']),
      busyDomainIds: new Set(['domain_mythic_1']),
    },
  });
  assert.equal(resFree.locked, false);
});
