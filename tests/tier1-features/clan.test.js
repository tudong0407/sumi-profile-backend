import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestServer } from '../helpers/testServer.js';
import { supabase } from '../../src/config/supabase.js';
import { settleExpiredClanWars, recordClanWarScore } from '../../src/services/clanService.js';

const LEADER_1 = '999999999999999925';
const MEMBER_1 = '999999999999999926';
const LEADER_2 = '999999999999999927';
const LOW_LVL_USER = '999999999999999928';

async function cleanup() {
  if (!supabase) return;
  const { data: testClans } = await supabase
    .from('clans')
    .select('clan_id')
    .in('leader_id', [LEADER_1, LEADER_2, MEMBER_1, LOW_LVL_USER]);
  const clanIds = (testClans || []).map((c) => c.clan_id);

  for (const uid of [LEADER_1, MEMBER_1, LEADER_2, LOW_LVL_USER]) {
    await supabase.from('users').update({ clan_id: null }).eq('user_id', uid);
  }
  for (const cid of clanIds) {
    await supabase.from('clan_wars').delete().or(`challenger_clan_id.eq.${cid},target_clan_id.eq.${cid}`);
    await supabase.from('clan_join_requests').delete().eq('clan_id', cid);
    await supabase.from('clans').delete().eq('clan_id', cid);
  }
  for (const uid of [LEADER_1, MEMBER_1, LEADER_2, LOW_LVL_USER]) {
    await supabase.from('clan_join_requests').delete().eq('user_id', uid);
    await supabase.from('user_pets').delete().eq('user_id', uid);
    await supabase.from('users').delete().eq('user_id', uid);
  }
}

describe('Tier 1 - Phase 3 Gia Tộc (/giatoc) & Clan Wars 24H', () => {
  let testServer;

  before(async () => {
    testServer = await createTestServer();
    await cleanup();
  });

  after(async () => {
    await cleanup();
    if (testServer) await testServer.close();
  });

  it('1. Rejects clan creation below Lv.20 and creates clan at Lv.20+ for 1,000 Linh Thach', async () => {
    if (!supabase) return;

    await testServer.fetch(`/api/clan/info/${LOW_LVL_USER}?username=LowLv`);
    await supabase.from('users').update({ linh_thach: 2000, level: 10 }).eq('user_id', LOW_LVL_USER);

    const lowRes = await testServer.fetch('/api/clan/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: LOW_LVL_USER, clanName: 'LowLevelSect', clanTag: 'LOW' }),
    });
    assert.equal(lowRes.status, 400);

    await testServer.fetch(`/api/clan/info/${LEADER_1}?username=ClanFounder1`);
    await supabase.from('users').update({ level: 25, linh_thach: 8000 }).eq('user_id', LEADER_1);

    const okRes = await testServer.fetch('/api/clan/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: LEADER_1, clanName: 'TestAlphaClan925', clanTag: 'TA925' }),
    });
    assert.equal(okRes.status, 200);
    const cj = await okRes.json();
    assert.equal(cj.success, true);
    assert.equal(cj.linh_thach, 7000);
    assert.equal(cj.clan.clan_level, 1);
  });

  it('2. Join request -> leader approve -> donate & upgrade Clan Lv.1 -> Lv.2', async () => {
    if (!supabase) return;

    await testServer.fetch(`/api/clan/info/${MEMBER_1}?username=Applicant1`);
    const joinRes = await testServer.fetch('/api/clan/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: MEMBER_1, clanQuery: 'TestAlphaClan925' }),
    });
    assert.equal(joinRes.status, 200);

    const reqListRes = await testServer.fetch(`/api/clan/requests/${LEADER_1}`);
    assert.equal(reqListRes.status, 200);
    const rlj = await reqListRes.json();
    assert.ok(rlj.requests.some((r) => r.user_id === MEMBER_1));

    const appRes = await testServer.fetch('/api/clan/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leaderId: LEADER_1, applicantId: MEMBER_1, decision: 'approve' }),
    });
    assert.equal(appRes.status, 200);
    assert.equal((await appRes.json()).approved, true);

    const donRes = await testServer.fetch('/api/clan/donate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: LEADER_1, amount: 3000 }),
    });
    assert.equal(donRes.status, 200);
    assert.equal((await donRes.json()).clan_treasury, 3000);

    const upRes = await testServer.fetch('/api/clan/upgrade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: LEADER_1 }),
    });
    assert.equal(upRes.status, 200);
    const uj = await upRes.json();
    assert.equal(uj.new_level, 2);
    assert.equal(uj.max_members, 15);
    assert.equal(uj.clan_treasury, 1000);
  });

  it('3. Clan Wars 24H declare -> accept escrow -> record score -> expired auto-settlement pays bet * 2', async () => {
    if (!supabase) return;

    await testServer.fetch(`/api/clan/info/${LEADER_2}?username=ClanFounder2`);
    await supabase.from('users').update({ level: 30, linh_thach: 5000 }).eq('user_id', LEADER_2);
    await testServer.fetch('/api/clan/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: LEADER_2, clanName: 'TestBetaClan927', clanTag: 'TB927' }),
    });
    await testServer.fetch('/api/clan/donate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: LEADER_2, amount: 2000 }),
    });

    const declRes = await testServer.fetch('/api/clan/war/declare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leaderId: LEADER_1, targetClan: 'TestBetaClan927', betAmount: 500 }),
    });
    assert.equal(declRes.status, 200);
    const warId = (await declRes.json()).war.war_id;

    const accRes = await testServer.fetch('/api/clan/war/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leaderId: LEADER_2, decision: 'accept' }),
    });
    assert.equal(accRes.status, 200);
    assert.equal((await accRes.json()).pot, 1000);

    // Record war score for Clan 1
    const { data: u1 } = await supabase.from('users').select('clan_id').eq('user_id', LEADER_1).single();
    await recordClanWarScore(u1.clan_id, 1200);

    // Force war expiration and settle
    await supabase
      .from('clan_wars')
      .update({ end_time: new Date(Date.now() - 60_000).toISOString() })
      .eq('war_id', warId);

    const settled = await settleExpiredClanWars();
    assert.ok(settled.some((w) => w.war_id === warId && w.winner_clan_id === u1.clan_id));

    const { data: winnerClan } = await supabase.from('clans').select('clan_treasury, total_exp').eq('clan_id', u1.clan_id).single();
    assert.equal(Number(winnerClan.clan_treasury), 1500); // 1000 - 500 escrow + 1000 pot

    const lbRes = await testServer.fetch('/api/clan/leaderboard?limit=10');
    assert.equal(lbRes.status, 200);
    assert.ok((await lbRes.json()).clans.length >= 2);
  });
});
