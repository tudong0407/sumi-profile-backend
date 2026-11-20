import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestServer } from '../helpers/testServer.js';
import { supabase } from '../../src/config/supabase.js';
import {
  computeTotalAccumulatedExp,
  decomposeTotalExp,
} from '../../src/services/economyService.js';

const TEMP_ECON_USER = '999999999999999911';

async function cleanup() {
  if (!supabase) return;
  await supabase.from('user_inventory').delete().eq('user_id', TEMP_ECON_USER);
  await supabase.from('user_pets').delete().eq('user_id', TEMP_ECON_USER);
  await supabase.from('user_roles').delete().eq('user_id', TEMP_ECON_USER);
  await supabase.from('user_pet_items').delete().eq('user_id', TEMP_ECON_USER);
  await supabase.from('users').delete().eq('user_id', TEMP_ECON_USER);
}

describe('Tier 1 - Phase 1 Economy (/daily, /doiqua demote, /roll gacha)', () => {
  let testServer;

  before(async () => {
    testServer = await createTestServer();
    await cleanup();
  });

  after(async () => {
    await cleanup();
    if (testServer) await testServer.close();
  });

  it('1. computeTotalAccumulatedExp & decomposeTotalExp round-trip cleanly across levels', () => {
    const total = computeTotalAccumulatedExp(6, 50);
    assert.ok(total > 1000);
    const back = decomposeTotalExp(total);
    assert.equal(back.level, 6);
    assert.equal(back.exp, 50);

    const floorZero = decomposeTotalExp(0);
    assert.equal(floorZero.level, 1);
    assert.equal(floorZero.exp, 0);
  });

  it('2. POST /api/economy/daily grants 40-60 Linh Thach once per day and rejects repeat claim', async () => {
    const res1 = await testServer.fetch('/api/economy/daily', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: TEMP_ECON_USER, username: 'EconTester' }),
    });
    assert.equal(res1.status, 200);
    const j1 = await res1.json();
    assert.equal(j1.success, true);
    assert.equal(j1.already_claimed, false);
    assert.ok(j1.reward >= 40 && j1.reward <= 60, `Expected 40..60, got ${j1.reward}`);
    assert.equal(j1.streak, 1);

    const res2 = await testServer.fetch('/api/economy/daily', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: TEMP_ECON_USER }),
    });
    assert.equal(res2.status, 200);
    const j2 = await res2.json();
    assert.equal(j2.already_claimed, true);
    assert.equal(j2.reward, 0);
  });

  it('3. POST /api/economy/doiqua converts 1000 EXP -> 10 Linh Thach and allows level demotion', async () => {
    if (!supabase) return;
    // Seed user at Lv.7 with 100 EXP (~2,489 total EXP >= 2,000 under 60 * lv^1.45)
    await supabase.from('users').update({ level: 7, exp: 100, linh_thach: 500 }).eq('user_id', TEMP_ECON_USER);

    const res = await testServer.fetch('/api/economy/doiqua', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: TEMP_ECON_USER, amountExp: 2000 }),
    });
    assert.equal(res.status, 200);
    const j = await res.json();
    assert.equal(j.success, true);
    assert.equal(j.spent_exp, 2000);
    assert.equal(j.linh_thach_gained, 20);
    assert.equal(j.demoted, true);
    assert.equal(j.old_level, 7);
    assert.ok(j.new_level < 5);
    assert.ok(Array.isArray(j.revoked_level_role_ids));
    assert.ok(j.revoked_level_role_ids.includes('1038406122417176586'));
    assert.ok(String(j.revoked_level_role_csv).includes('1038406122417176586'));
  });

  it('4. POST /api/economy/doiqua rejects non-multiples of 1000 and excessive EXP', async () => {
    const badRes = await testServer.fetch('/api/economy/doiqua', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: TEMP_ECON_USER, amountExp: 500 }),
    });
    assert.equal(badRes.status, 400);

    const overRes = await testServer.fetch('/api/economy/doiqua', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: TEMP_ECON_USER, amountExp: 999000 }),
    });
    assert.equal(overRes.status, 400);
  });

  it('5. POST /api/economy/roll deducts 50 Linh Thach and awards item or pet cleanly', async () => {
    if (!supabase) return;
    await supabase.from('users').update({ linh_thach: 200 }).eq('user_id', TEMP_ECON_USER);

    const res = await testServer.fetch('/api/economy/roll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: TEMP_ECON_USER, pool: 'equipment', count: 1 }),
    });
    assert.equal(res.status, 200);
    const j = await res.json();
    assert.equal(j.success, true);
    assert.equal(j.cost, 50);
    assert.equal(j.results.length, 1);
    assert.ok(j.linh_thach >= 150);
  });
});
