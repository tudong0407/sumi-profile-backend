import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestServer } from '../helpers/testServer.js';
import { supabase } from '../../src/config/supabase.js';

const TEMP_INV_USER = '999999999999999912';

async function cleanup() {
  if (!supabase) return;
  await supabase.from('user_inventory').delete().eq('user_id', TEMP_INV_USER);
  await supabase.from('user_pets').delete().eq('user_id', TEMP_INV_USER);
  await supabase.from('user_roles').delete().eq('user_id', TEMP_INV_USER);
  await supabase.from('user_pet_items').delete().eq('user_id', TEMP_INV_USER);
  await supabase.from('users').delete().eq('user_id', TEMP_INV_USER);
}

describe('Tier 1 - Phase 1 Inventory (/inv), Equip/Unequip & Pet Upgrade (/pet)', () => {
  let testServer;

  before(async () => {
    testServer = await createTestServer();
    await cleanup();
  });

  after(async () => {
    await cleanup();
    if (testServer) await testServer.close();
  });

  it('1. GET /api/inv/:userId auto-initializes beginner inventory with starter pet', async () => {
    const res = await testServer.fetch(`/api/inv/${TEMP_INV_USER}?username=InvTester`);
    assert.equal(res.status, 200);
    const j = await res.json();
    assert.equal(j.success, true);
    assert.equal(j.pets.length, 1);
    assert.equal(j.pets[0].pet_type, 'hoa_thach_nham_nham');
    assert.equal(j.pets[0].is_active, true);
    assert.equal(typeof j.summary_pets, 'string');
    assert.ok(j.summary_pets.length > 0);
    assert.equal(typeof j.summary_items, 'string');
    assert.equal(typeof j.summary_roles, 'string');
    assert.equal(typeof j.summary_consumables, 'string');
  });

  it('2. POST /api/equip & /api/unequip supports items, roles, and unlocked backgrounds', async () => {
    if (!supabase) return;
    await supabase.from('user_pet_items').insert({ user_id: TEMP_INV_USER, item_id: 'weapon_common_1' });
    await supabase.from('user_inventory').insert({ user_id: TEMP_INV_USER, item_id: 'bg_pin_1_starry_cloud.jpg', item_category: 'background', quantity: 1 });
    await supabase.from('user_roles').insert({ user_id: TEMP_INV_USER, role_id: '1573186049289756712', role_name: '« Thần Hành Cốt Cách »', is_permanent: true });

    const eqItem = await testServer.fetch('/api/equip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: TEMP_INV_USER, category: 'item', targetId: 'weapon_common_1' }),
    });
    assert.equal(eqItem.status, 200);
    assert.equal((await eqItem.json()).slot, 'weapon');

    const eqRole = await testServer.fetch('/api/equip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: TEMP_INV_USER, category: 'role', targetId: '1573186049289756712' }),
    });
    assert.equal(eqRole.status, 200);
    const eqRoleJson = await eqRole.json();
    assert.equal(eqRoleJson.add_role_id, '1573186049289756712');

    const eqBg = await testServer.fetch('/api/equip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: TEMP_INV_USER, category: 'background', targetId: 'bg_pin_1_starry_cloud.jpg' }),
    });
    assert.equal(eqBg.status, 200);
    assert.equal((await eqBg.json()).background_url, 'backgrounds/bg_pin_1_starry_cloud.jpg');

    const unRole = await testServer.fetch('/api/unequip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: TEMP_INV_USER, category: 'role', targetId: '1573186049289756712' }),
    });
    assert.equal(unRole.status, 200);
    assert.equal((await unRole.json()).remove_role_id, '1573186049289756712');
  });

  it('3. POST /api/pet/upgrade upgrades level with Linh Thach and star with Star Stones', async () => {
    if (!supabase) return;
    await supabase.from('users').update({ linh_thach: 1000 }).eq('user_id', TEMP_INV_USER);
    await supabase.from('user_inventory').upsert({ user_id: TEMP_INV_USER, item_id: 'pet_star_stone', item_category: 'consumable', quantity: 3 }, { onConflict: 'user_id,item_id' });

    const upLvl = await testServer.fetch('/api/pet/upgrade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: TEMP_INV_USER, petType: 'hoa_thach_nham_nham', mode: 'level' }),
    });
    assert.equal(upLvl.status, 200);
    const lvlJson = await upLvl.json();
    assert.equal(lvlJson.new_level, 2);

    const upStar = await testServer.fetch('/api/pet/upgrade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: TEMP_INV_USER, petType: 'hoa_thach_nham_nham', mode: 'star' }),
    });
    assert.equal(upStar.status, 200);
    const starJson = await upStar.json();
    assert.equal(starJson.new_star, 2);
  });
});
