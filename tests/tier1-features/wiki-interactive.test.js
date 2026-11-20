import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestServer } from '../helpers/testServer.js';
import { assertPngValid } from '../helpers/pngValidator.js';
import { FIXTURE_USERS } from '../helpers/fixtures.js';

describe('Tier 1 - Pillar 1 Interactive Wiki (Charts, 45 Items, 21 Pets, Unique Mythic Owners)', () => {
  let testServer;

  before(async () => {
    testServer = await createTestServer();
  });

  after(async () => {
    if (testServer) await testServer.close();
  });

  it('1. GET /api/wiki/catalog returns 45 items (15/15/15) and 21 pets across 4 canonical tiers (5/5/4/7)', async () => {
    const res = await testServer.fetch('/api/wiki/catalog');
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);

    assert.equal(json.equipment.weapon.length, 15);
    assert.equal(json.equipment.gem.length, 15);
    assert.equal(json.equipment.soul.length, 15);

    assert.equal(json.pets.common.length, 5, 'Must have 5 Phàm Phẩm pets');
    assert.equal(json.pets.rare.length, 5, 'Must have 5 Linh Phẩm pets');
    assert.equal(json.pets.epic.length, 4, 'Must have 4 Tiên Phẩm pets');
    assert.equal(json.pets.mythic.length, 7, 'Must have 6 Thần Thoại + 1 Cửu Vĩ Hồng Hồ');
  });

  it('2. Standalone realms category exists and all 6 wiki categories use concise non-greeting copy', async () => {
    const res = await testServer.fetch('/api/wiki');
    assert.equal(res.status, 200);
    const json = await res.json();
    const ids = json.categories.map((c) => c.id);
    assert.deepEqual(ids, ['overview', 'realms', 'battle', 'equipment', 'pets', 'economy']);

    for (const cat of json.categories) {
      assert.ok(!/chào mừng đạo hữu/i.test(cat.content), `Category ${cat.id} should not contain verbose greeting`);
    }

    const realmsRes = await testServer.fetch('/api/wiki?category=realms');
    assert.equal(realmsRes.status, 200);
    const realmsJson = await realmsRes.json();
    assert.equal(realmsJson.data.id, 'realms');
    assert.match(realmsJson.data.title, /Cảnh Giới/i);
  });

  it('3. GET /api/wiki/chart/elements.png renders Full HD+ 2000x1000 Ngũ Hành chart PNG', async () => {
    const res = await testServer.fetch('/api/wiki/chart/elements.png');
    assert.equal(res.status, 200);
    assert.ok(res.headers.get('content-type')?.includes('image/png'));
    const buffer = Buffer.from(await res.arrayBuffer());
    assertPngValid(buffer, 2000, 1000);
  });

  it('4. GET /api/wiki/item/weapon_mythic_1 reports live server owner Fuyumi 🌸 and renders 2000x1000 PNG card', async () => {
    const resJson = await testServer.fetch('/api/wiki/item/weapon_mythic_1');
    assert.equal(resJson.status, 200);
    const json = await resJson.json();
    assert.equal(json.success, true);
    assert.equal(json.data.is_unique, true);
    assert.equal(json.data.drop_rate, 1);
    assert.ok(json.data.current_owner, 'weapon_mythic_1 must report current unique owner');
    assert.equal(json.data.current_owner.user_id, FIXTURE_USERS.fuyumi.userId);
    assert.match(json.embed.description, /Fuyumi/);

    const resPng = await testServer.fetch('/api/wiki/item/weapon_mythic_1.png');
    assert.equal(resPng.status, 200);
    assertPngValid(Buffer.from(await resPng.arrayBuffer()), 2000, 1000);
  });

  it('5. GET /api/wiki/item/weapon_mythic_2 reports unowned Mythic item cleanly and renders 2000x1000 PNG', async () => {
    const resJson = await testServer.fetch('/api/wiki/item/weapon_mythic_2');
    assert.equal(resJson.status, 200);
    const json = await resJson.json();
    assert.equal(json.success, true);
    assert.equal(json.data.is_unique, true);
    assert.equal(json.data.current_owner, null);
    assert.match(json.data.owner_label, /Chưa có chủ sở hữu/);

    const resPng = await testServer.fetch('/api/wiki/item/weapon_mythic_2.png');
    assert.equal(resPng.status, 200);
    assertPngValid(Buffer.from(await resPng.arrayBuffer()), 2000, 1000);
  });

  it('6. GET /api/wiki/pet/hoa_thach_nham_nham reports starter pet (120/180/100 Phàm Phẩm) and renders 2000x1000 PNG', async () => {
    const resJson = await testServer.fetch('/api/wiki/pet/hoa_thach_nham_nham');
    assert.equal(resJson.status, 200);
    const json = await resJson.json();
    assert.equal(json.success, true);
    assert.equal(json.data.rarity, 'Phàm Phẩm');
    assert.equal(json.data.element, 'Thổ');
    assert.equal(json.data.is_starter, true);
    assert.equal(json.data.base_atk, 120);
    assert.equal(json.data.base_def, 180);
    assert.equal(json.data.base_spd, 100);
    assert.equal(json.data.base_hp, 1900);

    const resPng = await testServer.fetch('/api/wiki/pet/hoa_thach_nham_nham.png');
    assert.equal(resPng.status, 200);
    assertPngValid(Buffer.from(await resPng.arrayBuffer()), 2000, 1000);
  });

  it('7. Prototype pollution and invalid IDs on /api/wiki/item and /api/wiki/pet return 404', async () => {
    for (const bad of ['constructor', '__proto__', 'toString', 'nonexistent_xyz']) {
      const rItem = await testServer.fetch(`/api/wiki/item/${bad}`);
      assert.equal(rItem.status, 404, `Expected 404 for item ${bad}`);
      const rPet = await testServer.fetch(`/api/wiki/pet/${bad}`);
      assert.equal(rPet.status, 404, `Expected 404 for pet ${bad}`);
    }
  });
});
