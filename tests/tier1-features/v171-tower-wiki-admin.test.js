import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { supabase } from '../../src/config/supabase.js';
import { buildTowerGuardian } from '../../src/services/questService.js';
import { getWikiData } from '../../src/services/wikiService.js';
import { ensureUserInitialized } from '../../src/services/profileService.js';
import { claimExpedition } from '../../src/services/explorerService.js';

const TEST_UID = '999999999999999990';

async function cleanupTestUser() {
  if (!supabase) return;
  await supabase.from('explorer_map_drops').delete().eq('dropped_by_user_id', TEST_UID);
  await supabase.from('explorer_expeditions').delete().eq('user_id', TEST_UID);
  await supabase.from('user_loadouts').delete().eq('user_id', TEST_UID);
  await supabase.from('user_inventory').delete().eq('user_id', TEST_UID);
  await supabase.from('user_domains').delete().eq('user_id', TEST_UID);
  await supabase.from('user_pet_items').delete().eq('user_id', TEST_UID);
  await supabase.from('user_roles').delete().eq('user_id', TEST_UID);
  await supabase.from('user_pets').delete().eq('user_id', TEST_UID);
  await supabase.from('user_quests').delete().eq('user_id', TEST_UID);
  await supabase.from('spirit_vein_fatigue').delete().eq('user_id', TEST_UID);
  await supabase.from('users').delete().eq('user_id', TEST_UID);
}

describe('Ver 1.7.1 — Tower Balance, Wiki Glossary & Explorer Admin Override', () => {
  before(cleanupTestUser);
  after(cleanupTestUser);

  it('1. Tower F50-80 gate, early Domains/Senses/Realms & Chân Thần F150 / F400+ Boss 100%', async () => {
    const g50 = await buildTowerGuardian(50, () => 0.5);
    assert.ok(g50.powerScore >= 15000 && g50.powerScore <= 26000, `F50 pow=${g50.powerScore}`);
    assert.ok(g50.domainLoadout.domain, 'F50 must have Linh Vực');

    const g150 = await buildTowerGuardian(150, () => 0.5);
    assert.equal(g150.isEvolved, true);
    assert.ok(g150.ultimateDef);

    const g400 = await buildTowerGuardian(400, () => 0.99);
    assert.equal(g400.isEvolved, true);
    assert.ok(g400.domainLoadout.realm);

    const g500 = await buildTowerGuardian(500, () => 0.5);
    assert.ok(g500.powerScore >= 180000 && g500.powerScore <= 250000, `F500 pow=${g500.powerScore}`);
  });

  it('2. Wiki Glossary covers Sát Thương Thường, Phản Đòn 85%, Hấp Thụ Khiên 60% & debuff caps', () => {
    const gl = getWikiData('glossary');
    const txt = gl.pages.flatMap((p) => p.fields.map((f) => `${f.name} ${f.value}`)).join('\n');
    for (const kw of ['Sát Thương Thường', 'Sát Thương Kỹ Năng', 'Phản Đòn', '85%', 'Hấp Thụ ST thành Khiên', '60%', 'Kháng ST Chuẩn', '65%', 'Tịch Diệt']) {
      assert.ok(txt.includes(kw), `Missing wiki glossary term: ${kw}`);
    }
  });

  it('3. explorerService claimExpedition honors outcome_json.admin_override (survive custom loot & die stealth)', async () => {
    if (!supabase) return;
    await ensureUserInitialized(TEST_UID, { username: 'AdminOverrideTester' });
    const { data: petRow } = await supabase.from('user_pets').select('*').eq('user_id', TEST_UID).limit(1).single();
    await supabase.from('user_pets').update({ status: 'exploring' }).eq('pet_id', petRow.pet_id);

    const futureEnd = new Date(Date.now() + 6 * 3600 * 1000).toISOString();
    const { data: exp1 } = await supabase.from('explorer_expeditions').insert({
      user_id: TEST_UID,
      map_id: 'map_01_linh_khong_coc',
      duration_hours: 6,
      effective_seconds: 21600,
      pet_id: petRow.pet_id,
      pet_type: petRow.pet_type,
      pet_name: petRow.pet_name,
      pet_is_unique: false,
      locked_equip_ids: [],
      locked_domain_ids: [],
      pet_power: 1000,
      map_power: 999999, // Normally 95% death rate!
      started_at: new Date().toISOString(),
      ends_at: futureEnd,
      status: 'active',
      outcome_json: {
        admin_override: {
          mode: 'survive',
          force_complete: true,
          custom_lt: 12345,
          replace_loot: true,
          extra_items: { chaos_essence_shard: 2, enchant_stone_absolute: 1 },
        },
      },
    }).select('*').single();

    const res1 = await claimExpedition(TEST_UID);
    assert.equal(res1.success, true);
    assert.equal(res1.survived, true);
    assert.equal(res1.outcome.earnedLt, 12345);
    assert.equal(res1.outcome.gainedItems.chaos_essence_shard, 2);
    assert.equal(res1.outcome.gainedItems.enchant_stone_absolute, 1);
    assert.ok(!res1.description.toLowerCase().includes('admin'));

    // Verify DB inventory updated & outcome_json scrubbed of admin_override
    const { data: invRow } = await supabase.from('user_inventory').select('quantity').eq('user_id', TEST_UID).eq('item_id', 'chaos_essence_shard').maybeSingle();
    assert.equal(Number(invRow?.quantity || 0), 2);
    const { data: exp1After } = await supabase.from('explorer_expeditions').select('outcome_json').eq('expedition_id', exp1.expedition_id).single();
    assert.equal(exp1After.outcome_json?.admin_override, undefined);

    // Second expedition: bonus_lt (+300 on top of map LT), multiple grant_equip_ids + grant_domain_ids
    const { data: pet2b } = await supabase.from('user_pets').select('*').eq('user_id', TEST_UID).limit(1).single();
    await supabase.from('user_pets').update({ status: 'exploring' }).eq('pet_id', pet2b.pet_id);
    const fixedRng = () => 0.5;
    await supabase.from('explorer_expeditions').insert({
      user_id: TEST_UID,
      map_id: 'map_01_linh_khong_coc',
      duration_hours: 3,
      effective_seconds: 10800,
      pet_id: pet2b.pet_id,
      pet_type: pet2b.pet_type,
      pet_name: pet2b.pet_name,
      pet_is_unique: false,
      locked_equip_ids: [],
      locked_domain_ids: [],
      pet_power: 5000,
      map_power: 1000,
      started_at: new Date().toISOString(),
      ends_at: futureEnd,
      status: 'active',
      outcome_json: {
        admin_override: {
          mode: 'survive',
          force_complete: true,
          bonus_lt: 300,
          replace_loot: true,
          grant_equip_ids: [
            { item_id: 'weapon_common_1', enchant_grade: 'S' },
            { item_id: 'weapon_common_2', enchant_grade: 'A' },
          ],
          grant_domain_ids: [{ entity_kind: 'domain', entity_id: 'domain_common_1' }],
        },
      },
    });
    const resBonus = await claimExpedition(TEST_UID, { rng: fixedRng });
    assert.equal(resBonus.success, true);
    assert.equal(resBonus.survived, true);
    // Natural LT at rng=0.5, 3h, map_01 (reward_multiplier 1.0) = round(3 * 250 * 1.05 * 1.0 * 1.0) = 788, + 300 = 1088
    assert.ok(resBonus.outcome.earnedLt > 800, `Expected natural LT + 300, got ${resBonus.outcome.earnedLt}`);
    assert.equal(resBonus.outcome.grantedDomains.length, 1);
    assert.ok(!resBonus.description.toLowerCase().includes('admin'));

    const { data: eqRows } = await supabase.from('user_pet_items').select('item_id').eq('user_id', TEST_UID).in('item_id', ['weapon_common_1', 'weapon_common_2']);
    assert.equal(eqRows.length, 2);

    // Third expedition: force stealth death even at high pet power
    const { data: pet2 } = await supabase.from('user_pets').select('*').eq('user_id', TEST_UID).limit(1).single();
    await supabase.from('user_pets').update({ status: 'exploring' }).eq('pet_id', pet2.pet_id);
    await supabase.from('explorer_expeditions').insert({
      user_id: TEST_UID,
      map_id: 'map_01_linh_khong_coc',
      duration_hours: 1,
      effective_seconds: 3600,
      pet_id: pet2.pet_id,
      pet_type: pet2.pet_type,
      pet_name: pet2.pet_name,
      pet_is_unique: false,
      locked_equip_ids: [],
      locked_domain_ids: [],
      pet_power: 999999, // Normally 95%+ survival
      map_power: 1000,
      started_at: new Date().toISOString(),
      ends_at: futureEnd,
      status: 'active',
      outcome_json: {
        admin_override: { mode: 'die', force_complete: true, skip_equip_drop: true },
      },
    });
    const res2 = await claimExpedition(TEST_UID);
    assert.equal(res2.success, true);
    assert.equal(res2.survived, false);
    assert.ok(!res2.description.toLowerCase().includes('admin'));
  });
});
