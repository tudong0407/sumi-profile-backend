import test from 'node:test';
import assert from 'node:assert/strict';
import {
  COSMETIC_BUFF_BY_RARITY,
  computeCosmeticBuffTotals,
  getCosmeticBuffByRarity,
} from '../src/data/catalog.js';
import { LATEST_VERSION } from '../src/data/changelogs.js';
import { lookupInfo } from '../src/services/infoService.js';
import { WIKI_CATEGORIES } from '../src/services/wikiService.js';

test('COSMETIC_BUFF_BY_RARITY matches tier scaling up to Mythic +10% EXP & +10% LT', () => {
  assert.deepEqual(COSMETIC_BUFF_BY_RARITY.common, { expPct: 2, ltPct: 2 });
  assert.deepEqual(COSMETIC_BUFF_BY_RARITY.rare, { expPct: 4, ltPct: 4 });
  assert.deepEqual(COSMETIC_BUFF_BY_RARITY.epic, { expPct: 7, ltPct: 7 });
  assert.deepEqual(COSMETIC_BUFF_BY_RARITY.mythic, { expPct: 10, ltPct: 10 });
  assert.deepEqual(getCosmeticBuffByRarity('mythic', false), { expPct: 0, ltPct: 0 });
});

test('computeCosmeticBuffTotals stacks frame and background buffs cleanly', () => {
  const def = computeCosmeticBuffTotals('default', 'default_background.png');
  assert.equal(def.expPct, 0);
  assert.equal(def.ltPct, 0);

  const mythicFrameOnly = computeCosmeticBuffTotals('frame_kitsune_mythic', 'default_background.png');
  assert.equal(mythicFrameOnly.frameExpPct, 10);
  assert.equal(mythicFrameOnly.bgExpPct, 0);
  assert.equal(mythicFrameOnly.expPct, 10);
  assert.equal(mythicFrameOnly.ltPct, 10);

  const bothMythic = computeCosmeticBuffTotals('frame_kitsune_mythic', 'bg_12_kitsune_shrine.png');
  assert.equal(bothMythic.expPct, 20);
  assert.equal(bothMythic.ltPct, 20);

  const mixed = computeCosmeticBuffTotals('amethyst_celestial', 'bg_04_moonlit_lake.png');
  assert.equal(mixed.frameExpPct, 7);
  assert.equal(mixed.bgExpPct, 4);
  assert.equal(mixed.expPct, 11);
  assert.equal(mixed.ltPct, 11);

  const fuyumiLegacy = computeCosmeticBuffTotals('celestial_fox_gold', 'assets/celestial_palace_pink.png');
  assert.equal(fuyumiLegacy.expPct, 20);
  assert.equal(fuyumiLegacy.ltPct, 20);
});

test('/info and /wiki document cosmetic buffs cleanly with 0 Windows Unicode and silent version', () => {
  assert.equal(LATEST_VERSION, '1.5.1');

  const frInfo = lookupInfo('frame_kitsune_mythic');
  assert.equal(frInfo.success, true);
  assert.match(frInfo.description, /\+10% EXP & \+10% Linh Thạch/);

  const bgInfo = lookupInfo('bg_12_kitsune_shrine.png');
  assert.equal(bgInfo.success, true);
  assert.match(bgInfo.description, /\+10% EXP & \+10% Linh Thạch/);

  const realmsStr = JSON.stringify(WIKI_CATEGORIES.realms);
  const econStr = JSON.stringify(WIKI_CATEGORIES.economy);
  assert.match(realmsStr, /Thần Thoại \+10%/);
  assert.match(econStr, /\+10%/);
  assert.equal(/[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/u.test(realmsStr), false);
  assert.equal(/[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/u.test(econStr), false);
});
