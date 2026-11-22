import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestServer } from '../helpers/testServer.js';
import { supabase } from '../../src/config/supabase.js';
import { EQUIPMENT_CATALOG, PET_CATALOG, DOMAIN_CATALOG } from '../../src/data/catalog.js';
import { ensureUserInitialized } from '../../src/services/profileService.js';
import {
  DEFAULT_AUTOSELL_CONFIG,
  normalizeAutoSellConfig,
  getAutoSellConfig,
  updateAutoSellConfig,
  rollGacha,
} from '../../src/services/economyService.js';
import { clearUpdateGateCache, markUserAckedInCache } from '../../src/services/updateGateService.js';

const USER_AS = '999900000000014701';

function seqRng(vals) {
  let i = 0;
  return () => {
    const v = vals[Math.min(i, vals.length - 1)];
    i += 1;
    return v;
  };
}

async function cleanup() {
  if (!supabase) return;
  await supabase.from('user_quests').delete().eq('user_id', USER_AS);
  await supabase.from('user_roles').delete().eq('user_id', USER_AS);
  await supabase.from('user_domains').delete().eq('user_id', USER_AS);
  await supabase.from('user_pet_items').delete().eq('user_id', USER_AS);
  await supabase.from('user_pets').delete().eq('user_id', USER_AS);
  await supabase.from('user_inventory').delete().eq('user_id', USER_AS);
  await supabase.from('users').delete().eq('user_id', USER_AS);
  clearUpdateGateCache(USER_AS);
}

describe('Tier 1 - v1.4.7 /autosell Config & 4-Pool /roll Integration', () => {
  let testServer;

  before(async () => {
    await cleanup();
    markUserAckedInCache(USER_AS);
    testServer = await createTestServer();
  });

  after(async () => {
    await cleanup();
    if (testServer) await testServer.close();
  });

  it('1. normalizeAutoSellConfig & HTTP GET/POST /api/economy/autosell persist config and handle unresolved BotGhost vars', async () => {
    assert.deepEqual(DEFAULT_AUTOSELL_CONFIG, { common: false, rare: false, epic: false, keep_new: false });
    assert.deepEqual(normalizeAutoSellConfig('{"common":true,"keep_new":1}'), {
      common: true,
      rare: false,
      epic: false,
      keep_new: true,
    });

    if (!supabase) return;
    await ensureUserInitialized(USER_AS, { username: 'AutoSellTester' });

    const rGet = await testServer.fetch(`/api/economy/autosell/${USER_AS}`);
    assert.equal(rGet.status, 200);
    const jGet = await rGet.json();
    assert.equal(jGet.success, true);
    assert.equal(jGet.mode, 'view');
    assert.equal(jGet.footer, '');
    assert.deepEqual(jGet.config, { common: false, rare: false, epic: false, keep_new: false });

    const headers = { 'Content-Type': 'application/json' };
    if (process.env.BACKEND_API_KEY) headers['x-api-key'] = process.env.BACKEND_API_KEY;

    const rPost = await testServer.fetch('/api/economy/autosell', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        userId: USER_AS,
        pham_pham: 'yes',
        linh_pham: 'yes',
        tien_pham: '{option_tien_pham}', // unresolved optional arg must preserve cur value (false)
        giu_mon_moi: 'yes',
      }),
    });
    assert.equal(rPost.status, 200);
    const jPost = await rPost.json();
    assert.equal(jPost.success, true);
    assert.equal(jPost.mode, 'updated');
    assert.equal(jPost.footer, '');
    assert.deepEqual(jPost.config, { common: true, rare: true, epic: false, keep_new: true });

    const reloaded = await getAutoSellConfig(USER_AS);
    assert.deepEqual(reloaded.config, { common: true, rare: true, epic: false, keep_new: true });
  });

  it('2. AutoSell sells common/rare across all 4 pools when keep_new=false, keeps new when keep_new=true, upgrades grade, and NEVER sells mythic', async () => {
    if (!supabase) return;
    await cleanup();
    markUserAckedInCache(USER_AS);
    await ensureUserInitialized(USER_AS, { username: 'AutoSellRollTester' });
    await supabase.from('users').update({ linh_thach: 5000 }).eq('user_id', USER_AS);
    await updateAutoSellConfig(USER_AS, { common: 'yes', rare: 'yes', epic: 'no', keep_new: 'yes' });

    const commonEquips = EQUIPMENT_CATALOG.filter((e) => e.rarity_key === 'common');
    assert.ok(commonEquips.length > 0);
    const firstCommonEq = commonEquips[0];

    // Roll 1 with keep_new=true: unowned common item -> KEPT at grade D (rng=[0.8(common), 0.0(first), 0.1(grade D)])
    const rKeepFirst = await rollGacha(USER_AS, {
      pool: 'equipment',
      count: 1,
      rng: seqRng([0.8, 0.0, 0.1]),
    });
    assert.equal(rKeepFirst.success, true);
    assert.equal(rKeepFirst.results[0].kind, 'new_item');
    assert.equal(rKeepFirst.results[0].item_id, firstCommonEq.item_id);
    assert.equal(rKeepFirst.results[0].enchant_grade, 'D');
    assert.equal(rKeepFirst.autosell_count, 0);

    // Roll 2 with keep_new=true: SAME common item owned (grade D), now rolls A (0.95 -> A)!
    // Must upgrade owned item grade D -> A BEFORE auto-selling!
    const rUpgradeSell = await rollGacha(USER_AS, {
      pool: 'equipment',
      count: 1,
      rng: seqRng([0.8, 0.0, 0.95]),
    });
    assert.equal(rUpgradeSell.success, true);
    assert.equal(rUpgradeSell.results[0].kind, 'autosell_item');
    assert.equal(rUpgradeSell.results[0].grade_upgraded, true);
    assert.equal(rUpgradeSell.autosell_count, 1);
    assert.ok(rUpgradeSell.autosell_linh_thach > 0);

    const { data: ownRow } = await supabase
      .from('user_pet_items')
      .select('quantity, enchant_grade')
      .eq('user_id', USER_AS)
      .eq('item_id', firstCommonEq.item_id)
      .single();
    assert.equal(ownRow.quantity, 1, 'Auto-sold duplicate must not increment quantity');
    assert.equal(ownRow.enchant_grade, 'A', 'Auto-sell must preserve & upgrade higher rolled enchant_grade');

    // Switch keep_new=false + enable epic: verify unowned common Pet, unowned Domain, unowned Role are auto-sold immediately
    await updateAutoSellConfig(USER_AS, { common: 'yes', rare: 'yes', epic: 'yes', keep_new: 'no' });
    const unownedCommonPet = PET_CATALOG.filter((p) => !p.is_exclusive_fuyumi && p.rarity_key === 'common')[1];
    assert.ok(unownedCommonPet);

    const petIdxRatio = (1 + 0.01) / PET_CATALOG.filter((p) => !p.is_exclusive_fuyumi && p.rarity_key === 'common').length;
    const rSellPet = await rollGacha(USER_AS, {
      pool: 'pet',
      count: 1,
      rng: seqRng([0.8, petIdxRatio, 0.1]),
    });
    assert.equal(rSellPet.success, true);
    assert.equal(rSellPet.results[0].kind, 'autosell_pet');
    assert.ok(rSellPet.autosell_linh_thach > 0);

    const domainCommons = DOMAIN_CATALOG.filter((d) => !d.is_exclusive_fuyumi && d.rarity_key === 'common');
    assert.ok(domainCommons.length > 0);
    const rSellDomain = await rollGacha(USER_AS, {
      pool: 'domain',
      count: 1,
      rng: seqRng([0.8, 0.0, 0.0]), // 0.0 -> domain kind, common[0]
    });
    assert.equal(rSellDomain.success, true);
    assert.equal(rSellDomain.results[0].kind, 'autosell_domain');

    const rSellRole = await rollGacha(USER_AS, {
      pool: 'role',
      count: 1,
      rng: seqRng([0.8, 0.0, 0.5]),
    });
    assert.equal(rSellRole.success, true);
    assert.equal(rSellRole.results[0].kind, 'autosell_role');

    // Mythic protection: r = 0.001 -> mythic MUST NEVER be auto-sold!
    const rMythicPet = await rollGacha(USER_AS, {
      pool: 'pet',
      count: 1,
      rng: seqRng([0.001, 0.0, 0.1]),
    });
    assert.equal(rMythicPet.success, true);
    assert.notEqual(rMythicPet.results[0].kind, 'autosell_pet');
    assert.equal(rMythicPet.autosell_count, 0);
  });
});
