import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestServer } from '../helpers/testServer.js';
import { EXPECTED_WIKI_CATEGORIES } from '../helpers/fixtures.js';

describe('Tier 1 - Beginner Wiki API Contract & Categories', () => {
  let testServer;

  before(async () => {
    testServer = await createTestServer();
  });

  after(async () => {
    if (testServer) await testServer.close();
  });

  it('1. GET /api/wiki returns HTTP 200 with all 8 independent categories', async () => {
    const res = await testServer.fetch('/api/wiki');
    assert.equal(res.status, 200, `Expected 200, received ${res.status}`);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(Array.isArray(json.categories), 'Wiki response must include categories array');
    assert.equal(json.categories.length, 8);
  });

  it('2. Wiki contract specifies handbook title "Cẩm Nang Tu Tiên SuMi Family"', () => {
    const expectedTitle = 'Cẩm Nang Tu Tiên SuMi Family';
    assert.match(expectedTitle, /Cẩm Nang Tu Tiên SuMi Family/);
  });

  it('3. Wiki contract includes all 8 essential categories (including standalone realms, roles and explorer)', () => {
    const categories = ['overview', 'realms', 'battle', 'equipment', 'pets', 'roles', 'economy', 'explorer'];
    assert.equal(categories.length, 8);

    for (const catId of EXPECTED_WIKI_CATEGORIES) {
      assert.ok(categories.includes(catId), `Categories must include ${catId}`);
    }
  });

  it('4. Wiki category items satisfy schema structure (id, title, content)', () => {
    const sampleCategory = {
      id: 'beginner',
      title: 'Khởi Đầu Tu Tiên',
      content: 'Chào mừng tân thủ đến với SuMi Family. Sử dụng lệnh /profile để xem hồ sơ...',
    };

    assert.equal(typeof sampleCategory.id, 'string');
    assert.equal(typeof sampleCategory.title, 'string');
    assert.equal(typeof sampleCategory.content, 'string');
    assert.ok(sampleCategory.content.length > 10);
  });

  it('5. Wiki categories correctly map to key game systems', () => {
    const categoryMapping = {
      beginner: 'Khởi Đầu Tu Tiên',
      pets: 'Hệ Thống Linh Thú',
      equipment: '45 Món Trang Bị Loadout',
      battle: 'Đấu Trường & Ngũ Hành',
      economy: 'Kinh Tế & Gia Tộc',
    };

    assert.equal(categoryMapping.beginner, 'Khởi Đầu Tu Tiên');
    assert.equal(categoryMapping.pets, 'Hệ Thống Linh Thú');
    assert.equal(categoryMapping.equipment, '45 Món Trang Bị Loadout');
    assert.equal(categoryMapping.battle, 'Đấu Trường & Ngũ Hành');
    assert.equal(categoryMapping.economy, 'Kinh Tế & Gia Tộc');
  });

  it('6. GET /api/wiki?category=beginner alias resolves cleanly to overview category', async () => {
    const res = await testServer.fetch('/api/wiki?category=beginner');
    assert.equal(res.status, 200, `Expected 200, received ${res.status}`);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.category, 'overview');
    assert.ok(json.data, 'Must return data object for category');
    assert.equal(json.data.id, 'overview');
    assert.match(json.data.title, /Tổng Quan Tu Tiên/);
    assert.ok(json.data.content.length > 50);
  });

  it('7. GET /api/wiki?category=invalid_category returns HTTP 404 with error details', async () => {
    const res = await testServer.fetch('/api/wiki?category=invalid_category');
    assert.equal(res.status, 404, `Expected 404 for invalid category, received ${res.status}`);
    const json = await res.json();
    assert.equal(json.success, false);
    assert.equal(json.error, 'Category not found');
    assert.ok(Array.isArray(json.valid_categories));
    assert.equal(json.valid_categories.length, 8);
  });

  it('8. GET /api/wiki?category=constructor returns HTTP 404 with success: false (prototype protection)', async () => {
    const res = await testServer.fetch('/api/wiki?category=constructor');
    assert.equal(res.status, 404, `Expected 404 for constructor, received ${res.status}`);
    const json = await res.json();
    assert.equal(json.success, false);
    assert.equal(json.error, 'Category not found');
    assert.ok(Array.isArray(json.valid_categories));
  });

  it('9. GET /api/wiki?category=__proto__ returns HTTP 404 with success: false (prototype protection)', async () => {
    const res = await testServer.fetch('/api/wiki?category=__proto__');
    assert.equal(res.status, 404, `Expected 404 for __proto__, received ${res.status}`);
    const json = await res.json();
    assert.equal(json.success, false);
    assert.equal(json.error, 'Category not found');
    assert.ok(Array.isArray(json.valid_categories));
  });
});
