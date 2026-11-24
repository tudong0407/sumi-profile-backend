import test from 'node:test';
import assert from 'node:assert/strict';
import { GACHA_ROLE_CATALOG } from '../src/data/catalog.js';
import { LATEST_VERSION, getChangelogPayload, getUpdateAckReward } from '../src/data/changelogs.js';
import { sanitizeRolePerkForDb } from '../src/services/profileService.js';
import {
  paginateFormattedLines,
  getUserRoles,
  getUserEquipment,
  getInventory,
} from '../src/services/inventoryService.js';
import { getDomainInventory } from '../src/services/domainService.js';

test('sanitizeRolePerkForDb strips custom emojis and keeps all 40 role perks <= 100 chars', () => {
  assert.equal(typeof sanitizeRolePerkForDb, 'function');
  for (const role of GACHA_ROLE_CATALOG) {
    const cleaned = sanitizeRolePerkForDb(role.perk);
    assert.ok(cleaned.length > 0, `Role ${role.name} cleaned perk must be non-empty`);
    assert.ok(
      cleaned.length <= 100,
      `Role ${role.name} (${role.role_id}) cleaned perk length ${cleaned.length} > 100: ${cleaned}`,
    );
    assert.equal(
      /<a?:[a-zA-Z0-9_]+:\d+>/.test(cleaned),
      false,
      `Role ${role.name} cleaned perk still contains custom emoji tag: ${cleaned}`,
    );
  }
});

test('paginateFormattedLines splits 35 items cleanly with zero dropped items and respects maxChars', () => {
  const items = Array.from({ length: 35 }, (_, i) => ({ idx: i + 1, label: `Item #${i + 1}` }));
  const fmt = (it) => `• ${it.label} — ${'x'.repeat(20)}`;

  const p1 = paginateFormattedLines(items, fmt, { page: 1, pageSize: 15, maxChars: 3350 });
  const p2 = paginateFormattedLines(items, fmt, { page: 2, pageSize: 15, maxChars: 3350 });
  const p3 = paginateFormattedLines(items, fmt, { page: 3, pageSize: 15, maxChars: 3350 });
  const pClamped = paginateFormattedLines(items, fmt, { page: 99, pageSize: 15, maxChars: 3350 });

  assert.equal(p1.totalPages, 3);
  assert.equal(p1.page, 1);
  assert.equal(p1.pageItems.length, 15);
  assert.equal(p2.page, 2);
  assert.equal(p2.pageItems.length, 15);
  assert.equal(p3.page, 3);
  assert.equal(p3.pageItems.length, 5);
  assert.equal(pClamped.page, 3);

  const combined = [...p1.pageItems, ...p2.pageItems, ...p3.pageItems].map((x) => x.idx);
  assert.deepEqual(combined, items.map((x) => x.idx));

  // Also verify maxChars splitting when lines are long
  const longItems = Array.from({ length: 10 }, (_, i) => ({ idx: i + 1 }));
  const longFmt = (it) => `• Long-${it.idx}-${'A'.repeat(120)}`;
  const lp1 = paginateFormattedLines(longItems, longFmt, { page: 1, pageSize: 15, maxChars: 300 });
  assert.ok(lp1.totalPages > 1, 'Should split into multiple pages when maxChars is tight');
  assert.ok(lp1.lines.join('\n').length <= 300, 'Page 1 must respect maxChars');
});

test('inventory and domain pagination service functions are exported cleanly', () => {
  assert.equal(typeof getUserRoles, 'function');
  assert.equal(typeof getUserEquipment, 'function');
  assert.equal(typeof getInventory, 'function');
  assert.equal(typeof getDomainInventory, 'function');
});

test('Hotfix v1.5.1 changelog is latest, awards +1.000 LT, and has zero Windows Unicode pictographs', () => {
  assert.equal(LATEST_VERSION, '1.5.1');
  assert.equal(getUpdateAckReward('1.5.1'), 1000);
  const payload = getChangelogPayload('1.5.1');
  assert.equal(payload.success, true);
  assert.match(payload.title, /HOTFIX v1\.5\.1/);
  const bad = `${payload.title}\n${payload.description}`.match(/[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/gu);
  assert.equal(bad, null);
});
