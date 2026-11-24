import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestServer } from '../helpers/testServer.js';
import { supabase } from '../../src/config/supabase.js';

const TEMP_SHOP_USER = '999999999999999921';

async function cleanup() {
  if (!supabase) return;
  await supabase.from('shop_selections').delete().eq('user_id', TEMP_SHOP_USER);
  await supabase.from('user_frames').delete().eq('user_id', TEMP_SHOP_USER);
  await supabase.from('user_inventory').delete().eq('user_id', TEMP_SHOP_USER);
  await supabase.from('user_pets').delete().eq('user_id', TEMP_SHOP_USER);
  await supabase.from('user_roles').delete().eq('user_id', TEMP_SHOP_USER);
  await supabase.from('user_pet_items').delete().eq('user_id', TEMP_SHOP_USER);
  await supabase.from('users').delete().eq('user_id', TEMP_SHOP_USER);
}

describe('Tier 1 - Phase 2 Shop (/shop catalog, preview, buy, frame/title equip)', () => {
  let testServer;

  before(async () => {
    testServer = await createTestServer();
    await cleanup();
  });

  after(async () => {
    await cleanup();
    if (testServer) await testServer.close();
  });

  it('1. GET /api/shop/catalog returns 6 categories and excludes exclusive/gacha-only items', async () => {
    const res = await testServer.fetch(`/api/shop/catalog?category=all&userId=${TEMP_SHOP_USER}&username=ShopTester`);
    assert.equal(res.status, 200);
    const j = await res.json();
    assert.equal(j.success, true);
    assert.equal(j.categories.rings.length, 4);
    assert.equal(j.categories.pets.length, 26);
    assert.equal(j.categories.equipment.length, 44);
    assert.equal(j.categories.roles.length, 21);
    assert.equal(j.categories.consumables.length, 14);
    assert.equal(j.categories.backgrounds.length, 20);
    assert.equal(j.categories.frames.length, 20);
    assert.ok(!j.categories.pets.some((p) => p.pet_type === 'cuu_vi_hong_ho' || p.rarity_key === 'epic' || p.rarity_key === 'mythic'));
    assert.ok(!j.categories.equipment.some((e) => e.rarity_key === 'epic' || e.rarity_key === 'mythic'));
    assert.ok(typeof j.summary_text === 'string' && j.summary_text.length > 0);
  });

  it('2. POST /api/shop/preview rejects exclusive/mythic items and persists valid selection for buy', async () => {
    const badRes = await testServer.fetch('/api/shop/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: TEMP_SHOP_USER, category: 'pets', itemId: 'cuu_vi_hong_ho' }),
    });
    assert.equal(badRes.status, 404);

    if (!supabase) return;
    await supabase.from('users').update({ linh_thach: 15000, level: 25, max_role_slots: 2 }).eq('user_id', TEMP_SHOP_USER);

    const prevRes = await testServer.fetch('/api/shop/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: TEMP_SHOP_USER, category: 'rings', itemId: 'ring_rare' }),
    });
    assert.equal(prevRes.status, 200);
    const pj = await prevRes.json();
    assert.equal(pj.success, true);
    assert.equal(pj.price, 2000);
    assert.match(pj.image_url, /assets\/rings\/ring_rare\.(webp|png|gif)/);

    // Buy without itemId reads from shop_selections
    const buyFromSel = await testServer.fetch('/api/shop/buy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: TEMP_SHOP_USER }),
    });
    assert.equal(buyFromSel.status, 200);
    const bj = await buyFromSel.json();
    assert.equal(bj.success, true);
    assert.equal(bj.item_id, 'ring_rare');
    assert.equal(bj.cost, 2000);
    assert.equal(bj.linh_thach, 13000);
  });

  it('3. POST /api/shop/buy handles pets, equipment, duplicates, and insufficient Linh Thach', async () => {
    if (!supabase) return;

    const buyPet = await testServer.fetch('/api/shop/buy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: TEMP_SHOP_USER, category: 'pets', itemId: 'bang_tuyet_ho' }),
    });
    assert.equal(buyPet.status, 200);
    assert.equal((await buyPet.json()).cost, 900);

    // Duplicate pet blocked
    const dupPet = await testServer.fetch('/api/shop/buy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: TEMP_SHOP_USER, category: 'pets', itemId: 'bang_tuyet_ho' }),
    });
    assert.equal(dupPet.status, 400);

    const buyEq = await testServer.fetch('/api/shop/buy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: TEMP_SHOP_USER, category: 'equipment', itemId: 'weapon_rare_1' }),
    });
    assert.equal(buyEq.status, 200);
    assert.equal((await buyEq.json()).cost, 750);

    // Duplicate equip blocked
    const dupEq = await testServer.fetch('/api/shop/buy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: TEMP_SHOP_USER, category: 'equipment', itemId: 'weapon_rare_1' }),
    });
    assert.equal(dupEq.status, 400);

    // Too expensive check
    const tooPoor = await testServer.fetch('/api/shop/buy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: TEMP_SHOP_USER, category: 'rings', itemId: 'ring_mythic', quantity: 2 }),
    });
    assert.equal(tooPoor.status, 400);
  });

  it('4. POST /api/shop/buy role package (7d + permanent) auto-equips slot & returns add_role_id', async () => {
    if (!supabase) return;

    const role7d = await testServer.fetch('/api/shop/buy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: TEMP_SHOP_USER, category: 'roles', itemId: '1573186049289756712', duration: '7d' }),
    });
    assert.equal(role7d.status, 200);
    const r7j = await role7d.json();
    assert.equal(r7j.cost, 150);
    assert.equal(r7j.add_role_id, '1573186049289756712');

    // Upgrade same role to permanent
    const rolePerm = await testServer.fetch('/api/shop/buy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: TEMP_SHOP_USER, category: 'roles', itemId: '1573186049289756712', duration: 'permanent' }),
    });
    assert.equal(rolePerm.status, 200);

    // Buying again when already permanent fails
    const roleDup = await testServer.fetch('/api/shop/buy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: TEMP_SHOP_USER, category: 'roles', itemId: '1573186049289756712', duration: '7d' }),
    });
    assert.equal(roleDup.status, 400);
  });

  it('5. Frames shop & title_rename_card unlock custom frame and rename title', async () => {
    if (!supabase) return;

    await testServer.fetch('/api/shop/buy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: TEMP_SHOP_USER, category: 'frames', itemId: 'jade_lotus' }),
    });
    await testServer.fetch('/api/shop/buy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: TEMP_SHOP_USER, category: 'consumables', itemId: 'title_rename_card' }),
    });

    const eqFrame = await testServer.fetch('/api/equip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: TEMP_SHOP_USER, category: 'frame', targetId: 'jade_lotus' }),
    });
    assert.equal(eqFrame.status, 200);
    assert.equal((await eqFrame.json()).avatar_frame, 'jade_lotus');

    // Exclusive owner frame blocked for normal users
    const badFrame = await testServer.fetch('/api/equip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: TEMP_SHOP_USER, category: 'frame', targetId: 'celestial_fox_gold' }),
    });
    assert.equal(badFrame.status, 403);

    const eqTitle = await testServer.fetch('/api/equip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: TEMP_SHOP_USER, category: 'title', targetId: 'Thiên Kiếm Tông Sư' }),
    });
    assert.equal(eqTitle.status, 200);
    assert.equal((await eqTitle.json()).custom_title, 'Thiên Kiếm Tông Sư');
  });
});
