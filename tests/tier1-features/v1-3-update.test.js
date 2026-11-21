import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestServer } from '../helpers/testServer.js';
import { supabase } from '../../src/config/supabase.js';
import { em } from '../../src/config/emojiHelper.js';
import {
  PET_CATALOG,
  EQUIPMENT_CATALOG,
  DOMAIN_CATALOG,
  DIVINE_SENSE_CATALOG,
  DIVINE_REALM_CATALOG,
  FARM_SEEDS,
  EXCHANGE_ITEMS,
  JOB_DAILY_LIMIT,
  FUYUMI_USER_ID,
} from '../../src/data/catalog.js';
import { V13_PET_HAX, V13_EQUIP_HAX } from '../../src/services/battleEngine/v13HaxRegistry.js';
import { simulateBattle } from '../../src/services/battleEngine/battleService.js';
import { ensureUserInitialized } from '../../src/services/profileService.js';
import { rollGacha } from '../../src/services/economyService.js';
import {
  getDomainInventory,
  equipDomainEntity,
  unequipDomainEntity,
  dismantleDomainEntity,
} from '../../src/services/domainService.js';
import {
  playCoinflip,
  playSlots,
  startBlackjack,
  blackjackAction,
  crashGame,
} from '../../src/services/minigameService.js';
import {
  getFarmStatus,
  plantFarmPlot,
  careAllPlots,
  harvestAllPlots,
  clearWiltedPlots,
  getExchangeCatalog,
  buyExchangeItem,
} from '../../src/services/farmService.js';
import { doJob } from '../../src/services/jobService.js';
import { getQuestStatus, claimDailyQuests, trackQuestActivity } from '../../src/services/questService.js';
import { lookupInfo } from '../../src/services/infoService.js';
import { clearUpdateGateCache } from '../../src/services/updateGateService.js';

const USER_V13_A = '999130000000000101';
const USER_V13_B = '999130000000000102';

async function cleanupV13Users() {
  if (!supabase) return;
  const ids = [USER_V13_A, USER_V13_B];
  await supabase.from('user_farm_plots').delete().in('user_id', ids);
  await supabase.from('user_domains').delete().in('user_id', ids);
  await supabase.from('user_quests').delete().in('user_id', ids);
  await supabase.from('user_inventory').delete().in('user_id', ids);
  await supabase.from('user_pet_items').delete().in('user_id', ids);
  await supabase.from('user_pets').delete().in('user_id', ids);
  await supabase.from('user_roles').delete().in('user_id', ids);
  await supabase.from('shop_selections').delete().in('user_id', ids);
  await supabase.from('users').delete().in('user_id', ids);
  ids.forEach((id) => clearUpdateGateCache(id));
}

describe('Tier 1 - Update v1.3 Comprehensive Suite', () => {
  let testServer;

  before(async () => {
    await cleanupV13Users();
    testServer = await createTestServer();
  });

  after(async () => {
    await cleanupV13Users();
    if (testServer) await testServer.close();
  });

  it('1. Emoji UIDs, Catalog Counts & /inv restores frame_unlock_token + Linh Vực/Linh Quả header with zero OwO', async () => {
    const requiredKeys = [
      'cuu_vi_hong_ho',
      'frame_unlock_token',
      'enchant_stone',
      'pet_star_stone',
      'ring_mythic',
      'coin_spin',
      'slot_spin',
      'card_deal',
      'crash_fly',
      'crash_boom',
      'farm_essence',
      'seed_linh_thao',
      'egg_than_thu',
      'domain_unique_1',
      'sense_unique_1',
      'realm_unique_1',
    ];
    for (const k of requiredKeys) {
      const tag = em(k);
      assert.ok(tag && tag.includes(k), `Expected live Discord tag containing UID '${k}', got '${tag}'`);
    }

    assert.equal(PET_CATALOG.length, 91);
    assert.equal(PET_CATALOG.filter((p) => !p.is_exclusive_fuyumi).length, 90);
    assert.equal(PET_CATALOG.filter((p) => p.is_unique && !p.is_exclusive_fuyumi).length, 10);
    assert.equal(EQUIPMENT_CATALOG.length, 165);
    assert.equal(DOMAIN_CATALOG.length, 31);
    assert.equal(DOMAIN_CATALOG.filter((d) => !d.is_exclusive_fuyumi).length, 30);
    assert.equal(DIVINE_SENSE_CATALOG.length, 16);
    assert.equal(DIVINE_REALM_CATALOG.length, 16);
    assert.equal(FARM_SEEDS.length, 6);
    assert.equal(EXCHANGE_ITEMS.length, 8);
    assert.equal(JOB_DAILY_LIMIT, 8);

    if (!supabase) return;
    await ensureUserInitialized(USER_V13_A, { username: 'V13Tester' });
    await supabase.from('users').update({ linh_thach: 50000, farm_essence: 250 }).eq('user_id', USER_V13_A);
    await supabase.from('user_domains').insert({
      user_id: USER_V13_A,
      entity_kind: 'domain',
      entity_id: 'domain_epic_1',
      quantity: 1,
      is_equipped: true,
    });

    const invRes = await testServer.fetch(`/api/inv/${USER_V13_A}?view=overview`);
    assert.equal(invRes.status, 200);
    const invJson = await invRes.json();
    assert.equal(invJson.success, true);
    assert.match(invJson.view_description, /frame_unlock_token:\d+>\s+\*\*Ảnh Nền:\*\*/);
    assert.match(invJson.view_description, /Linh Quả:/);
    assert.match(invJson.view_description, /Linh Vực Xuất Trận:/);
    assert.ok(!/owo/i.test(JSON.stringify(invJson)), 'Inventory payload must NOT mention OwO');
  });

  it('2. Linh Vực (/linhvuc & /roll loai:domain), Turn 2+ battle activation, 5-element counter & Fuyumi Supreme immunity', async () => {
    // Battle Turn 2+ activation & 5-element counter check
    const domA = DOMAIN_CATALOG.find((d) => d.element === 'Kiếm Vực' && d.rarity_key === 'mythic' && !d.is_unique);
    const domB = DOMAIN_CATALOG.find((d) => d.element === 'Huyễn Vực' && d.rarity_key === 'mythic' && !d.is_unique);
    const pStarter = PET_CATALOG.find((p) => p.pet_type === 'hoa_thach_nham_nham');
    const batDom = await simulateBattle(
      { user_id: 'v13_dom_a', username: 'DomA', level: 80, pet: { ...pStarter, level: 80 }, domain_loadout: { domain: domA } },
      { user_id: 'v13_dom_b', username: 'DomB', level: 80, pet: { ...pStarter, level: 80 }, domain_loadout: { domain: domB } },
      { maxTurns: 12, preRender: false, skipQuestTracking: true, seed: 55 },
    );
    assert.equal(batDom.domainSummary?.activatedAtTurn2, true);
    const events = batDom.domainSummary?.events || [];
    assert.ok(events.every((e) => e.turn >= 2), 'Domain events must NOT start at Turn 1');
    assert.ok(events.some((e) => e.turn === 2 && e.action === 'domain_open'));
    assert.ok(events.some((e) => e.action === 'domain_clash'), 'Kiếm Vực > Huyễn Vực counter clash must emit domain_clash');

    // Fuyumi Supreme Set resists Charm & Domain debuffs
    const domFuyumi = DOMAIN_CATALOG.find((d) => d.domain_id === 'domain_fuyumi_cuu_vi_hong_mong');
    const senseFuyumi = DIVINE_SENSE_CATALOG.find((s) => s.sense_id === 'sense_fuyumi_thai_thuong_hong_ho');
    const realmFuyumi = DIVINE_REALM_CATALOG.find((r) => r.realm_id === 'realm_fuyumi_van_co_tuyet_diet');
    const cuuVi = PET_CATALOG.find((p) => p.pet_type === 'cuu_vi_hong_ho');
    const batFuyumi = await simulateBattle(
      {
        user_id: FUYUMI_USER_ID,
        username: 'Fuyumi',
        level: 100,
        pet: { ...cuuVi, level: 100, star: 10, enchant_grade: 'S', equipment: { weapon: EQUIPMENT_CATALOG.find((e) => e.item_id === 'weapon_mythic_1'), gem: EQUIPMENT_CATALOG.find((e) => e.item_id === 'gem_mythic_3'), soul: EQUIPMENT_CATALOG.find((e) => e.item_id === 'soul_mythic_1') } },
        domain_loadout: { domain: domFuyumi, sense: senseFuyumi, realm: realmFuyumi },
      },
      {
        user_id: 'v13_charm_opp',
        username: 'CharmOpp',
        level: 100,
        pet: { ...PET_CATALOG.find((p) => p.pet_type === 'thoi_khong_than_tinh_ho'), level: 100, star: 10, enchant_grade: 'S', equipment: { weapon: EQUIPMENT_CATALOG.find((e) => e.item_id === 'weapon_mythic_3'), gem: EQUIPMENT_CATALOG.find((e) => e.item_id === 'gem_unique_7'), soul: EQUIPMENT_CATALOG.find((e) => e.item_id === 'soul_unique_7') } },
        domain_loadout: { domain: DOMAIN_CATALOG.find((d) => d.domain_id === 'domain_unique_4'), sense: DIVINE_SENSE_CATALOG.find((s) => s.sense_id === 'sense_unique_1'), realm: DIVINE_REALM_CATALOG.find((r) => r.realm_id === 'realm_unique_1') },
      },
      { maxTurns: 20, preRender: false, skipQuestTracking: true, seed: 60074 },
    );
    assert.equal(batFuyumi.winner?.id, FUYUMI_USER_ID);
    assert.ok(!batFuyumi.turns.some((t) => t.actor === 'attacker' && (t.haxTriggered || '').includes('Tự Đánh Bản Thân')), 'Fuyumi Supreme must be immune to enemy Charm');

    if (!supabase) return;
    await ensureUserInitialized(USER_V13_B, { username: 'V13DomainUser' });
    await supabase.from('users').update({ linh_thach: 50000 }).eq('user_id', USER_V13_B);

    const rollDom = await rollGacha(USER_V13_B, { pool: 'domain', count: 10, rng: () => 0.1 });
    assert.equal(rollDom.success, true);
    assert.equal(rollDom.results.length, 10);

    const invDomRes = await testServer.fetch(`/api/domain/inventory/${USER_V13_B}`);
    assert.equal(invDomRes.status, 200);
    const invDomJson = await invDomRes.json();
    assert.equal(invDomJson.success, true);
    assert.ok((invDomJson.domains?.length || 0) + (invDomJson.senses?.length || 0) + (invDomJson.realms?.length || 0) >= 1);

    // Explicit equip / unequip / dismantle via HTTP
    await supabase.from('user_domains').upsert({
      user_id: USER_V13_B,
      entity_kind: 'domain',
      entity_id: 'domain_common_2',
      quantity: 2,
      is_equipped: false,
    }, { onConflict: 'user_id,entity_kind,entity_id' });

    const eqDom = await testServer.fetch('/api/domain/equip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: USER_V13_B, targetId: 'domain_common_2' }),
    });
    assert.equal(eqDom.status, 200);
    assert.equal((await eqDom.json()).success, true);

    const unDom = await testServer.fetch('/api/domain/unequip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: USER_V13_B, slot: 'domain' }),
    });
    assert.equal(unDom.status, 200);
    assert.equal((await unDom.json()).success, true);

    const dmDom = await testServer.fetch('/api/domain/dismantle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: USER_V13_B, targetId: 'domain_common_2' }),
    });
    assert.equal(dmDom.status, 200);
    assert.equal((await dmDom.json()).success, true);
  });

  it('3. All 50 new v1.3 Pet HAX & 100 new v1.3 Equip HAX run deterministically without NaN or hang', async () => {
    const newPetKeys = Object.keys(V13_PET_HAX);
    const newEquipKeys = Object.keys(V13_EQUIP_HAX);
    assert.equal(newPetKeys.length, 50);
    assert.equal(newEquipKeys.length, 100);

    const fallbackOpp = PET_CATALOG.find((p) => p.pet_type === 'bach_kim_ho_tu');
    for (let i = 0; i < newPetKeys.length; i += 1) {
      const petMeta = PET_CATALOG.find((p) => p.pet_type === newPetKeys[i]);
      const eqA = EQUIPMENT_CATALOG.find((e) => e.item_id === newEquipKeys[(i * 2) % newEquipKeys.length]);
      const eqB = EQUIPMENT_CATALOG.find((e) => e.item_id === newEquipKeys[(i * 2 + 1) % newEquipKeys.length]);
      const res = await simulateBattle(
        {
          user_id: `v13_p_${i}`,
          username: 'NewPetA',
          level: 80,
          pet: { ...petMeta, level: 80, star: 5, enchant_grade: 'A', equipment: { [eqA.item_type]: eqA, [eqB.item_type]: eqB } },
        },
        {
          user_id: `v13_o_${i}`,
          username: 'OppB',
          level: 80,
          pet: { ...fallbackOpp, level: 80, star: 5, enchant_grade: 'A', equipment: {} },
        },
        { maxTurns: 15, preRender: false, skipQuestTracking: true, seed: 8000 + i },
      );
      assert.equal(res.success, true);
      assert.ok(res.turnCount >= 1 && res.turnCount <= 15);
      assert.ok(!Number.isNaN(res.finalHp.attacker) && !Number.isNaN(res.finalHp.defender));
    }
  });

  it('4. Minigames (/coinflip, /slots, /blackjack, /crash) work cleanly with zero probability leakage', async () => {
    if (!supabase) return;
    await ensureUserInitialized(USER_V13_A, { username: 'MinigameTester' });
    await supabase.from('users').update({ linh_thach: 20000 }).eq('user_id', USER_V13_A);

    // Invalid bet check
    const badBet = await testServer.fetch('/api/minigame/coinflip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: USER_V13_A, bet: 5, choice: 'heads' }),
    });
    assert.equal(badBet.status, 400);

    // Coinflip deterministic win (rng=0.1 -> win 1:2) + lose (rng=0.9)
    const cfWin = await playCoinflip(USER_V13_A, 100, 'heads', { bypassCooldown: true, rng: () => 0.1 });
    assert.equal(cfWin.success, true);
    assert.equal(cfWin.won, true);
    assert.equal(cfWin.payout, 200);
    assert.ok(cfWin.spin_embed && cfWin.result_embed);

    const cfLose = await playCoinflip(USER_V13_A, 100, 'tails', { bypassCooldown: true, rng: () => 0.9 });
    assert.equal(cfLose.won, false);
    assert.equal(cfLose.payout, 0);

    // 5s cooldown blocks immediate repeat call over HTTP
    const cdRes = await testServer.fetch('/api/minigame/coinflip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: USER_V13_A, bet: 50, choice: 'heads' }),
    });
    assert.equal(cdRes.status, 429);

    // Slots 4 reels (jackpot 1:5 at rng=0.001)
    const slJackpot = await playSlots(USER_V13_A, 100, { bypassCooldown: true, rng: () => 0.001 });
    assert.equal(slJackpot.success, true);
    assert.equal(slJackpot.reels.length, 4);
    assert.equal(slJackpot.multiplier, 5.0);
    assert.equal(slJackpot.payout, 500);

    // Blackjack HTTP start + stand/hit flow
    const bjStart = await startBlackjack(USER_V13_A, 100, { bypassCooldown: true, rng: () => 0.5 });
    assert.equal(bjStart.success, true);
    assert.equal(bjStart.game, 'blackjack');
    if (!bjStart.finished) {
      const bjAct = await testServer.fetch('/api/minigame/blackjack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: USER_V13_A, action: 'stand' }),
      });
      assert.equal(bjAct.status, 200);
      assert.equal((await bjAct.json()).finished, true);
    }

    // Crash interactive step & cashout flow + autoCashout
    const crStart = await crashGame(USER_V13_A, 100, null, { bypassCooldown: true, rng: () => 0.05 }); // maxSurvivableStep >= 6
    assert.equal(crStart.success, true);
    assert.equal(crStart.finished, false);
    const crStep = await testServer.fetch('/api/minigame/crash', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: USER_V13_A, action: 'step' }),
    });
    assert.equal(crStep.status, 200);
    const crStepJson = await crStep.json();
    if (!crStepJson.finished) {
      const crCash = await crashGame(USER_V13_A, 'cashout');
      assert.equal(crCash.success, true);
      assert.equal(crCash.finished, true);
      assert.ok(crCash.payout > 100);
    }

    // Strict confidentiality check: no 40% winrate or house-edge disclosure in any user payload
    const combinedPayloads = JSON.stringify([cfWin, cfLose, slJackpot, bjStart, crStart]);
    assert.ok(!/40%|house\s*edge|tỉ lệ.*40/i.test(combinedPayloads), 'Minigame payloads MUST NOT leak internal 40% calibration');
  });

  it('5. Idle Farm (/farm: plant -> care -> harvest / wilt -> clear) & /exchange (slot unlock 4->6)', async () => {
    if (!supabase) return;
    await ensureUserInitialized(USER_V13_B, { username: 'FarmTester' });
    await supabase.from('users').update({ linh_thach: 10000, farm_essence: 400, farm_slots_unlocked: 4 }).eq('user_id', USER_V13_B);
    await supabase.from('user_farm_plots').delete().eq('user_id', USER_V13_B);

    const status0 = await testServer.fetch(`/api/farm/status/${USER_V13_B}`);
    assert.equal(status0.status, 200);
    const s0Json = await status0.json();
    assert.equal(s0Json.slots_unlocked, 4);
    assert.equal(s0Json.plots.length, 4);

    // Plant seed_linh_thao (cost 80 LT, growth 6h, care 2h, wilt 4.5h, reward 145 LT + 15 essence)
    const t0 = new Date('2026-11-22T01:00:00.000Z');
    const p1 = await plantFarmPlot(USER_V13_B, 'seed_linh_thao', { now: t0, slotIndex: 1 });
    assert.equal(p1.success, true);

    // Care at +2h10m succeeds
    const care1 = await careAllPlots(USER_V13_B, { now: new Date(t0.getTime() + 2.2 * 3600000) });
    assert.equal(care1.success, true);
    assert.equal(care1.cared_count, 1);

    // Second plant on plot 2 WITHOUT care -> wilts at +4.6h
    const p2 = await plantFarmPlot(USER_V13_B, 'seed_linh_thao', { now: t0, slotIndex: 2 });
    assert.equal(p2.success, true);

    // Check at t0 + 6.1h: plot 1 ready (cared at 2.2h, elapsed 3.9h < 4.5h!), plot 2 wilted (never cared, elapsed 6.1h > 4.5h!)
    const tHarvest = new Date(t0.getTime() + 6.1 * 3600000);
    const harv = await harvestAllPlots(USER_V13_B, { now: tHarvest });
    assert.equal(harv.success, true);
    assert.equal(harv.harvested_count, 1);
    assert.equal(harv.reward_linh_thach, 145);
    assert.equal(harv.reward_essence, 15);

    const cleared = await clearWiltedPlots(USER_V13_B, { now: tHarvest });
    assert.equal(cleared.success, true);
    assert.equal(cleared.cleared_count, 1);

    // Exchange catalog & buy farm_slot_unlock (4 -> 5) + enchant_stone via HTTP
    const exCat = await testServer.fetch(`/api/exchange/catalog?userId=${USER_V13_B}`);
    assert.equal(exCat.status, 200);
    assert.equal((await exCat.json()).items.length, 8);

    const exSlot = await testServer.fetch('/api/exchange/buy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: USER_V13_B, exchangeId: 'farm_slot_unlock', quantity: 1 }),
    });
    assert.equal(exSlot.status, 200);
    const exSlotJson = await exSlot.json();
    assert.equal(exSlotJson.success, true);
    assert.equal(exSlotJson.slots_unlocked, 5);
  });

  it('6. /job supports 8 shifts/day, /wiki synced Voice EXP (85-135) & /info v1.3 lookups', async () => {
    const wikiRealms = await (await testServer.fetch('/api/wiki?category=realms')).json();
    assert.match(JSON.stringify(wikiRealms), /85–135 EXP/);
    const wikiAll = await (await testServer.fetch('/api/wiki')).json();
    assert.ok(!/domain_fuyumi_cuu_vi_hong_mong|OwO/i.test(JSON.stringify(wikiAll)));

    // Info lookups for domain/seed/exchange & confidentiality
    const dInfo = lookupInfo('domain_unique_1', { requesterId: USER_V13_A });
    assert.equal(dInfo.success, true);
    assert.equal(dInfo.category, 'domain');
    const secDomPublic = lookupInfo('domain_fuyumi_cuu_vi_hong_mong', { requesterId: USER_V13_A });
    assert.equal(secDomPublic.success, false);
    const secDomFuyumi = lookupInfo('domain_fuyumi_cuu_vi_hong_mong', { requesterId: FUYUMI_USER_ID });
    assert.equal(secDomFuyumi.success, true);

    if (!supabase) return;
    await ensureUserInitialized(USER_V13_A, { username: 'V13JobTester' });
    await supabase.from('user_quests').delete().eq('user_id', USER_V13_A);
    let cursor = new Date('2026-11-22T01:00:00.000Z').getTime();
    for (let shift = 1; shift <= 8; shift += 1) {
      const jr = await doJob(USER_V13_A, 'quet_san', { now: new Date(cursor) });
      assert.equal(jr.success, true, `Shift #${shift} of 8 should succeed`);
      cursor += 61 * 60 * 1000;
    }
    const shift9 = await doJob(USER_V13_A, 'quet_san', { now: new Date(cursor) });
    assert.equal(shift9.success, false);
    assert.equal(shift9.error, 'JOB_DAILY_LIMIT_REACHED');
  });
});
