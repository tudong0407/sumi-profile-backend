import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SHOP_CONSUMABLE_BY_ID } from '../../src/data/catalog.js';
import {
  TOWER_MAX_FLOOR,
  TOWER_MILESTONE_BONUSES,
  buildTowerGuardian,
} from '../../src/services/questService.js';

function makeSeededRng(seed = 123456) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

describe('Tier 1 - v1.4.7 Tower 500 Floors, Probabilities & Domain Unlock', () => {
  it('1. Constants: max floor 500, tower_reset_card 5/day & max_stack 15, and 10 milestones 50..500', () => {
    assert.equal(TOWER_MAX_FLOOR, 500);
    const card = SHOP_CONSUMABLE_BY_ID.tower_reset_card;
    assert.equal(card.daily_limit, 5);
    assert.equal(card.max_stack, 15);
    for (let m = 50; m <= 500; m += 50) {
      assert.ok(TOWER_MILESTONE_BONUSES[m], `Missing milestone at floor ${m}`);
    }
    assert.equal(TOWER_MILESTONE_BONUSES[500].absoluteStones, 1);
  });

  it('2. Mythic Pet 0% at F1, +10%/10f to 100% at F100+, escalating Unique Pet F100+, never spawns Fuyumi pet', async () => {
    const rng = makeSeededRng(77);
    for (let i = 0; i < 20; i += 1) {
      const g1 = await buildTowerGuardian(1, rng);
      assert.notEqual(g1.petRarityKey, 'mythic', 'F1 must have 0% mythic pet rate');
      assert.equal(g1.domainLoadout?.domain, null, 'F1 must not have Domain unlocked');
    }

    let f50Mythic = 0;
    const f50Runs = 120;
    for (let i = 0; i < f50Runs; i += 1) {
      const g50 = await buildTowerGuardian(50, rng);
      assert.notEqual(g50.petType, 'cuu_vi_hong_ho');
      if (g50.petRarityKey === 'mythic') f50Mythic += 1;
    }
    const f50Pct = f50Mythic / f50Runs;
    assert.ok(f50Pct >= 0.30 && f50Pct <= 0.70, `Expected ~50% mythic pet at F50, got ${(f50Pct * 100).toFixed(1)}%`);

    for (const f of [100, 150, 300, 500]) {
      for (let i = 0; i < 15; i += 1) {
        const gf = await buildTowerGuardian(f, rng);
        assert.notEqual(gf.petType, 'cuu_vi_hong_ho', 'Must never spawn exclusive Fuyumi pet in Tower');
        assert.equal(gf.petRarityKey, 'mythic', `Floor ${f} must always spawn a Mythic pet (100%)`);
      }
    }

    // Domain unlocks at F70+, Sense F150+, Realm F250+
    const g69 = await buildTowerGuardian(69, () => 0.5);
    assert.equal(g69.domainLoadout?.domain, null, 'F69 must NOT have Domain');
    const g70 = await buildTowerGuardian(70, () => 0.5);
    assert.ok(g70.domainLoadout?.domain, 'F70+ must unlock Linh Vực');
    assert.equal(g70.domainLoadout?.sense, null);

    const g150 = await buildTowerGuardian(150, () => 0.5);
    assert.ok(g150.domainLoadout?.domain && g150.domainLoadout?.sense, 'F150+ must have Domain + Thần Thức');
    assert.equal(g150.domainLoadout?.realm, null);

    const g250 = await buildTowerGuardian(250, () => 0.5);
    assert.ok(g250.domainLoadout?.domain && g250.domainLoadout?.sense && g250.domainLoadout?.realm, 'F250+ must have Domain + Sense + Realm');
  });

  it('3. Equipment Mythic count tiers, D->S Enchant grade progression, and ±12% random power variance', async () => {
    const g50 = await buildTowerGuardian(50, () => 0.5);
    assert.ok(['D', 'C'].includes(g50.enchantGrade), `F50 grade should be D/C, got ${g50.enchantGrade}`);

    const g450 = await buildTowerGuardian(450, () => 0.5);
    assert.equal(g450.enchantGrade, 'S', 'F450+ should consistently have Grade S');

    // Verify random variance ±12% produces distinct power scores across calls on same floor
    const lowRoll = await buildTowerGuardian(120, () => 0.01);
    const highRoll = await buildTowerGuardian(120, () => 0.99);
    assert.notEqual(lowRoll.towerMeta.randomVariance, highRoll.towerMeta.randomVariance);
    assert.ok(lowRoll.towerMeta.randomVariance < 0.90 && highRoll.towerMeta.randomVariance > 1.10);
  });
});
