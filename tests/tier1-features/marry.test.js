import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestServer } from '../helpers/testServer.js';
import { assertPngValid } from '../helpers/pngValidator.js';
import { supabase } from '../../src/config/supabase.js';
import { computeMarriageBuffs } from '../../src/services/marryService.js';
import { grantChatExp } from '../../src/services/expService.js';

const USER_A = '999999999999999922';
const USER_B = '999999999999999923';
const USER_C = '999999999999999924';

async function cleanup() {
  if (!supabase) return;
  for (const uid of [USER_A, USER_B, USER_C]) {
    await supabase.from('marry_proposals').delete().or(`proposer_id.eq.${uid},target_id.eq.${uid}`);
    await supabase.from('user_inventory').delete().eq('user_id', uid);
    await supabase.from('user_pets').delete().eq('user_id', uid);
    await supabase.from('user_roles').delete().eq('user_id', uid);
    await supabase.from('user_pet_items').delete().eq('user_id', uid);
    await supabase.from('users').delete().eq('user_id', uid);
  }
}

describe('Tier 1 - Phase 2 Tiên Lữ Marriage System (/marry & /divorce)', () => {
  let testServer;

  before(async () => {
    testServer = await createTestServer();
    await cleanup();
  });

  after(async () => {
    await cleanup();
    if (testServer) await testServer.close();
  });

  it('1. computeMarriageBuffs calculates ring tier, streak milestones (0/7/30/100/180/365d), and anniversary bonus', () => {
    const now = new Date('2026-11-21T00:00:00Z');
    const day0 = computeMarriageBuffs('ring_common', new Date(now.getTime()), now);
    assert.equal(day0.streak_tier, 'Tân Hôn');
    assert.equal(day0.total_exp_bonus_pct, 5);
    assert.equal(day0.total_power_bonus_pct, 5);

    const day7 = computeMarriageBuffs('ring_common', new Date(now.getTime() - 7 * 86400000), now);
    assert.equal(day7.streak_tier, 'Đồng Tâm 7 Ngày');
    assert.equal(day7.is_anniversary_day, true);
    assert.equal(day7.total_exp_bonus_pct, 5 + 2 + 10);
    assert.equal(day7.total_power_bonus_pct, 7);

    const day30 = computeMarriageBuffs('ring_rare', new Date(now.getTime() - 31 * 86400000), now);
    assert.equal(day30.streak_tier, 'Nguyệt Hạ 30 Ngày');
    assert.equal(day30.is_anniversary_day, false);
    assert.equal(day30.total_exp_bonus_pct, 10 + 5);

    const day100 = computeMarriageBuffs('ring_epic', new Date(now.getTime() - 105 * 86400000), now);
    assert.equal(day100.streak_tier, 'Bách Nhật Tình Duyên');
    assert.equal(day100.total_exp_bonus_pct, 15 + 8);

    const day180 = computeMarriageBuffs('ring_epic', new Date(now.getTime() - 190 * 86400000), now);
    assert.equal(day180.streak_tier, 'Bán Niên Vĩnh Kết');
    assert.equal(day180.total_exp_bonus_pct, 15 + 12);

    const day365 = computeMarriageBuffs('ring_mythic', new Date(now.getTime() - 365 * 86400000), now);
    assert.equal(day365.streak_tier, 'Thiên Trường Địa Cửu');
    assert.equal(day365.is_anniversary_day, true);
    assert.equal(day365.total_exp_bonus_pct, 20 + 15 + 10);
    assert.equal(day365.total_power_bonus_pct, 20 + 15);
  });

  it('2. Propose -> non-target rejected (403) -> accept two-way sync -> Profile & Rank render with Ring & Date', async () => {
    if (!supabase) return;

    // Seed USER_A with ring_common & ring_epic in inventory
    await testServer.fetch('/api/shop/catalog?userId=' + USER_A + '&username=LangQuan');
    await testServer.fetch('/api/shop/catalog?userId=' + USER_B + '&username=NuongTu');
    await testServer.fetch('/api/shop/catalog?userId=' + USER_C + '&username=NguoiNgoai');
    await supabase.from('user_inventory').insert([
      { user_id: USER_A, item_id: 'ring_common', item_category: 'ring', quantity: 1 },
      { user_id: USER_A, item_id: 'ring_epic', item_category: 'ring', quantity: 1 },
    ]);

    const propRes = await testServer.fetch('/api/marry/propose', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proposerId: USER_A, targetId: USER_B, ringId: 'ring_common' }),
    });
    assert.equal(propRes.status, 200);
    const pj = await propRes.json();
    assert.equal(pj.success, true);

    // Bystander C tries clicking Accept -> must fail 403
    const bystanderRes = await testServer.fetch('/api/marry/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ responderId: USER_C, decision: 'accept', proposalId: pj.proposal_id }),
    });
    assert.equal(bystanderRes.status, 403);

    // Target B accepts
    const accRes = await testServer.fetch('/api/marry/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ responderId: USER_B, decision: 'accept', proposalId: pj.proposal_id }),
    });
    assert.equal(accRes.status, 200);
    const aj = await accRes.json();
    assert.equal(aj.accepted, true);

    const statusRes = await testServer.fetch(`/api/marry/status/${USER_B}`);
    assert.equal(statusRes.status, 200);
    const sj = await statusRes.json();
    assert.equal(sj.married, true);
    assert.equal(sj.ring_id, 'ring_common');
    assert.equal(sj.spouse.user_id, USER_A);

    // Profile JSON + 2000x1000 PNG & Rank 2000x410 PNG
    const profPng = await testServer.fetch(`/api/profile/${USER_A}.png`);
    assert.equal(profPng.status, 200);
    assertPngValid(Buffer.from(await profPng.arrayBuffer()), 2000, 1000);

    const rankPng = await testServer.fetch(`/api/rank/${USER_B}.png`);
    assert.equal(rankPng.status, 200);
    assertPngValid(Buffer.from(await rankPng.arrayBuffer()), 2000, 410);
  });

  it('3. Ring upgrade preserves original marry_date & boosts EXP multiplier', async () => {
    if (!supabase) return;

    const { data: beforeU } = await supabase.from('users').select('marry_date').eq('user_id', USER_A).single();
    const upgRes = await testServer.fetch('/api/marry/upgrade-ring', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: USER_A, ringId: 'ring_epic' }),
    });
    assert.equal(upgRes.status, 200);
    const uj = await upgRes.json();
    assert.equal(uj.new_ring_id, 'ring_epic');

    const { data: afterA } = await supabase.from('users').select('marry_date, marry_ring_id').eq('user_id', USER_A).single();
    const { data: afterB } = await supabase.from('users').select('marry_date, marry_ring_id').eq('user_id', USER_B).single();
    assert.equal(afterA.marry_ring_id, 'ring_epic');
    assert.equal(afterB.marry_ring_id, 'ring_epic');
    assert.equal(afterA.marry_date, beforeU.marry_date);

    // Check Chat EXP multiplier includes +15% epic ring bonus
    const expRes = await grantChatExp({ userId: USER_A }, { now: Date.now() + 60_000, rng: () => 0.5 });
    assert.equal(expRes.awarded, true);
    assert.ok(expRes.multiplier >= 1.15, `Expected multiplier >= 1.15, got ${expRes.multiplier}`);
  });

  it('4. POST /api/marry/divorce clears both spouses completely', async () => {
    if (!supabase) return;

    const divRes = await testServer.fetch('/api/marry/divorce', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: USER_B }),
    });
    assert.equal(divRes.status, 200);

    const { data: checkBoth } = await supabase.from('users').select('user_id, marry_user_id, marry_ring_id').in('user_id', [USER_A, USER_B]);
    for (const row of checkBoth) {
      assert.equal(row.marry_user_id, null);
      assert.equal(row.marry_ring_id, null);
    }
  });
});
