/**
 * tests/tier1-features/catalog-sync-integrity.test.js
 * Permanent Catalog, Role, Linh Vực, Farm, Exchange, /info & /wiki Full-Sync Gate.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import * as cat from '../../src/data/catalog.js';
import { STONE_SPECIES, FORTUNE_TIERS } from '../../src/data/v16ExpansionCatalog.js';
import { ALCHEMY_RECIPES, FURNACE_TIERS } from '../../src/data/v161AlchemyCatalog.js';
import { ROLE_PERKS_MAP, getFuyumiProfileMock } from '../../src/services/profileService.js';
import { renderProfileCard } from '../../src/canvas/profileRenderer.js';
import {
  VALID_CATEGORIES,
  getWikiData,
  getWikiItemDetail,
  getWikiPetDetail,
  getWikiDomainDetail,
} from '../../src/services/wikiService.js';
import { lookupInfo } from '../../src/services/infoService.js';
import { computeEffectiveDomainEnergy } from '../../src/services/battleEngine/domainEngine.js';

function assertCleanText(text, label) {
  const s = String(text || '');
  assert.ok(!/\bundefined\b/i.test(s), `${label}: contains 'undefined' -> ${s.slice(0, 200)}`);
  assert.ok(!/\bNaN\b/.test(s), `${label}: contains 'NaN' -> ${s.slice(0, 200)}`);
  assert.ok(!/\[object Object\]/.test(s), `${label}: contains '[object Object]'`);
  const stripped = s.replace(/<a?:[a-zA-Z0-9_]+:\d+>/g, '');
  const hasRawEmoji = /\p{Extended_Pictographic}/u.test(stripped);
  assert.equal(hasRawEmoji, false, `${label}: contains raw Unicode emoji -> ${stripped.match(/\p{Extended_Pictographic}/u)?.[0]}`);
}

test('Wiki categories & glossary/roles pages contain zero undefined, NaN, or raw Unicode emojis', () => {
  for (const catId of VALID_CATEGORIES) {
    const maxPages = catId === 'glossary' ? 4 : catId === 'roles' ? 3 : 1;
    for (let page = 1; page <= maxPages; page += 1) {
      const res = getWikiData(catId, page);
      assert.equal(res.success, true, `getWikiData(${catId}, ${page}) failed`);
      assert.ok(Number.isInteger(res.prev_page) && res.prev_page >= 1 && res.prev_page <= res.total_pages, `Invalid prev_page on ${catId}:${page}`);
      assert.ok(Number.isInteger(res.next_page) && res.next_page >= 1 && res.next_page <= res.total_pages, `Invalid next_page on ${catId}:${page}`);
      const d = res.data;
      assertCleanText(res.embed_flat?.title || d.title, `wiki:${catId}:title`);
      assertCleanText(res.embed_flat?.description || d.description, `wiki:${catId}:description`);
      for (const f of d.fields || []) {
        assertCleanText(f.name, `wiki:${catId}:field.name`);
        assertCleanText(f.value, `wiki:${catId}:field.value`);
      }
      for (const sec of d.sections || []) {
        assertCleanText(sec.heading, `wiki:${catId}:sec.heading`);
        assertCleanText(sec.content, `wiki:${catId}:sec.content`);
      }
    }
  }
});

test('Wiki Pet (150 public), Item (264), and Domain/Sense/Realm (161 public) details have zero undefined/NaN', async () => {
  for (const pet of cat.PET_CATALOG.filter((p) => !p.is_exclusive_fuyumi)) {
    const res = await getWikiPetDetail(pet.pet_type);
    assert.equal(res.success, true, `getWikiPetDetail(${pet.pet_type}) failed`);
    assertCleanText(res.data.title, `wikiPet:${pet.pet_type}:title`);
    assertCleanText(res.data.description, `wikiPet:${pet.pet_type}:desc`);
  }

  for (const item of cat.EQUIPMENT_CATALOG) {
    const res = await getWikiItemDetail(item.item_id);
    assert.equal(res.success, true, `getWikiItemDetail(${item.item_id}) failed`);
    assertCleanText(res.data.title, `wikiItem:${item.item_id}:title`);
    assertCleanText(res.data.description, `wikiItem:${item.item_id}:desc`);
  }

  const publicDomains = cat.DOMAIN_CATALOG.filter((d) => !d.is_exclusive_fuyumi);
  const publicSenses = cat.DIVINE_SENSE_CATALOG.filter((s) => !s.is_exclusive_fuyumi);
  const publicRealms = cat.DIVINE_REALM_CATALOG.filter((r) => !r.is_exclusive_fuyumi);

  for (const d of publicDomains) {
    const res = await getWikiDomainDetail(d.domain_id);
    assert.equal(res.success, true, `getWikiDomainDetail(${d.domain_id}) failed`);
    assertCleanText(res.embed.title, `wikiDomain:${d.domain_id}:title`);
    assertCleanText(res.embed.description, `wikiDomain:${d.domain_id}:desc`);
    if (d.dao_ap) {
      assert.ok(res.embed.description.includes(`${d.dao_ap.durationTurns} hiệp`), `${d.domain_id} missing dao_ap durationTurns`);
      assert.ok(res.embed.description.includes(d.dao_ap.label), `${d.domain_id} missing dao_ap label`);
    }
  }
  for (const s of publicSenses) {
    const res = await getWikiDomainDetail(s.sense_id);
    assert.equal(res.success, true, `getWikiDomainDetail(${s.sense_id}) failed`);
    assertCleanText(res.embed.description, `wikiSense:${s.sense_id}:desc`);
  }
  for (const r of publicRealms) {
    const res = await getWikiDomainDetail(r.realm_id);
    assert.equal(res.success, true, `getWikiDomainDetail(${r.realm_id}) failed`);
    assertCleanText(res.embed.description, `wikiRealm:${r.realm_id}:desc`);
  }
});

test('/info lookupInfo succeeds cleanly across all catalogs (Pets, Equip, Roles, Domains, Farm, Stones, Alchemy, Fortunes)', () => {
  const queries = [
    ...cat.PET_CATALOG.map((p) => p.pet_type),
    ...cat.EQUIPMENT_CATALOG.map((i) => i.item_id),
    ...cat.GACHA_ROLE_CATALOG.map((r) => r.role_id),
    ...cat.LEVEL_ROLE_MILESTONES.map((m) => m.roleId),
    ...cat.ALL_CONSUMABLES.map((c) => c.item_id),
    ...cat.MARRY_RINGS.map((r) => r.item_id),
    ...cat.DOMAIN_CATALOG.map((d) => d.domain_id),
    ...cat.DIVINE_SENSE_CATALOG.map((s) => s.sense_id),
    ...cat.DIVINE_REALM_CATALOG.map((r) => r.realm_id),
    ...cat.FARM_SEEDS.map((s) => s.seed_id),
    ...cat.EXCHANGE_ITEMS.map((e) => e.exchange_id),
    ...cat.BACKGROUND_CATALOG.map((b) => b.bg_id),
    ...cat.AVATAR_FRAMES.map((f) => f.frame_id),
    ...STONE_SPECIES.map((s) => s.stone_id),
    ...ALCHEMY_RECIPES.map((r) => r.id),
    ...FURNACE_TIERS.map((f) => `furnace_lv${f.level}`),
    ...FORTUNE_TIERS.map((f) => f.tier_key),
  ];

  for (const q of queries) {
    const res = lookupInfo(q, { requesterId: cat.FUYUMI_USER_ID });
    assert.equal(res.success, true, `lookupInfo(${q}) failed`);
    assertCleanText(res.title, `info:${q}:title`);
    assertCleanText(res.description, `info:${q}:desc`);
  }
});

test('Role Single Source of Truth: ROLE_PERKS_MAP, compact perk labels, and detailed buffs match ROLE_BUFF_CONFIG', () => {
  for (const r of cat.GACHA_ROLE_CATALOG) {
    assert.equal(ROLE_PERKS_MAP[r.role_id], r.perk, `ROLE_PERKS_MAP drift on ${r.role_id}`);
    assertCleanText(r.perk, `role:${r.role_id}:perk`);
    assertCleanText(r.discord_perms, `role:${r.role_id}:discord_perms`);
    assert.ok(!/EXP Solo/i.test(r.perk), `${r.role_id} still has misleading 'EXP Solo'`);
    assert.ok(!/Kháng Timeout/i.test(r.perk), `${r.role_id} still has false 'Kháng Timeout'`);

    const cfg = cat.ROLE_BUFF_CONFIG[r.role_id];
    const detailed = cat.formatRoleBuffDetailedText(r.role_id);
    if (cfg?.expPct) assert.ok(detailed.includes(`+${cfg.expPct}% EXP (Chat, Voice & /job)`), `${r.role_id} detailed expPct mismatch`);
    if (cfg?.dailyLtPct) assert.ok(detailed.includes(`+${cfg.dailyLtPct}% Daily LT`), `${r.role_id} detailed dailyLtPct mismatch`);
    if (cfg?.petPowerPct) assert.ok(detailed.includes(`+${cfg.petPowerPct}% Chiến Lực Pet`), `${r.role_id} detailed petPowerPct mismatch`);
  }
});

test('Domain Linh Mạch calculator includes Sense + Equipment (gem_mythic_22, gem_unique_10, soul_unique_10) + 5/5 Mythic Set', () => {
  const domain = cat.DOMAIN_BY_ID.domain_mythic_1;
  const sense = cat.DIVINE_SENSE_BY_ID.sense_mythic_1;
  const res = computeEffectiveDomainEnergy({
    domain,
    sense,
    equipment: [
      { item_id: 'gem_unique_10' }, // +1 LM
      { item_id: 'soul_unique_10' }, // +2 LM
    ],
    setBonus: { bonusStartingLinhMach: 1 },
  });
  assert.equal(res.totalEnergy, Number(domain.base_energy) + Number(sense.bonus_energy) + 1 + 2 + 1);
});

test('Farm & Exchange catalog prices and caps stay 100% synced', () => {
  for (const seed of cat.FARM_SEEDS) {
    assert.ok(seed.reward_summary.includes(seed.cost_lt.toLocaleString('vi-VN')), `${seed.seed_id} reward_summary missing cost_lt`);
    assert.ok(seed.reward_summary.includes(seed.reward_lt.toLocaleString('vi-VN')), `${seed.seed_id} reward_summary missing reward_lt`);
    assert.ok(seed.reward_summary.includes(String(seed.reward_essence)), `${seed.seed_id} reward_summary missing reward_essence`);
  }
  const exTower = cat.EXCHANGE_ITEM_BY_ID.tower_reset_card;
  const shopTower = cat.SHOP_CONSUMABLE_BY_ID.tower_reset_card;
  assert.equal(exTower.max_stack, shopTower.max_stack);
  assert.equal(exTower.max_stack, 15);
});

test('renderProfileCard(getFuyumiProfileMock()) renders valid PNG buffer without ReferenceError', async () => {
  const buf = await renderProfileCard(getFuyumiProfileMock());
  assert.ok(Buffer.isBuffer(buf), 'renderProfileCard must return a Buffer');
  assert.ok(buf.length > 10000, `Rendered profile buffer too small: ${buf.length}`);
});
