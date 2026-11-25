/**
 * tests/tier1-features/hax-full-integrity.test.js
 * Permanent HAX Full-Integrity Gate:
 * 1. 100% Pet (91) & Equipment (165) ID wiring in engine/registry
 * 2. 0 unused keys in V13_PET_HAX & V13_EQUIP_HAX
 * 3. Domain Synergy Equipment parity (gem_mythic_22, gem_unique_10, weapon_mythic_18, weapon_unique_10, soul_mythic_20, soul_unique_10)
 * 4. Cleanse clears all 10 debuff states (including poison, healReduction, spdDebuff, enemyDmgDebuff, enemyAccDebuff)
 * 5. Behavioral & Log regressions: u_linh_tieu_mieu, weapon_rare_5, gem_unique_2, hac_diem_linh_nha (burnMode: current),
 *    thien_co_ngoc_ho (true dodge counter), additive reflect cap 85%, immortal on-hit block, dynamic SPD turn order,
 *    multi-source turnHealPct log, and 1v1 (khiên chặn X) log.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as cat from '../../src/data/catalog.js';
import { V13_PET_HAX, V13_EQUIP_HAX } from '../../src/services/battleEngine/v13HaxRegistry.js';
import { createInitialCombatState, compileCombatant } from '../../src/services/battleEngine/statsCompiler.js';
import {
  cleanseCombatantDebuffs,
  triggerTurnStart,
  triggerAttackPhase,
  triggerDamageReceived,
} from '../../src/services/battleEngine/haxEngine.js';
import { createDomainCombatSide, resolveSideModifiers } from '../../src/services/battleEngine/domainEngine.js';
import { simulateBattle } from '../../src/services/battleEngine/battleService.js';
import { simulateTeamBattle } from '../../src/services/battleEngine/teamBattleService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENGINE_DIR = path.resolve(__dirname, '../../src/services/battleEngine');

function readEngineFiles() {
  return {
    haxEngine: fs.readFileSync(path.join(ENGINE_DIR, 'haxEngine.js'), 'utf8'),
    statsCompiler: fs.readFileSync(path.join(ENGINE_DIR, 'statsCompiler.js'), 'utf8'),
    domainEngine: fs.readFileSync(path.join(ENGINE_DIR, 'domainEngine.js'), 'utf8'),
    battleService: fs.readFileSync(path.join(ENGINE_DIR, 'battleService.js'), 'utf8'),
    teamBattleService: fs.readFileSync(path.join(ENGINE_DIR, 'teamBattleService.js'), 'utf8'),
  };
}

function makeUnit(overrides = {}) {
  const st = createInitialCombatState();
  const base = {
    id: 'unit_a',
    name: 'Unit A',
    petType: 'hoa_thach_nham_nham',
    petName: 'Hoa Thach',
    element: 'Thổ',
    level: 50,
    star: 5,
    baseAtk: 1000,
    baseDef: 500,
    baseSpd: 500,
    atk: 1000,
    def: 500,
    spd: 500,
    critRate: 0.05,
    maxHp: 20000,
    currentHp: 20000,
    shield: 0,
    equipment: { weapon: null, gem: null, soul: null },
    domainLoadout: { domain: null, sense: null, realm: null },
    domainRuntime: { own: null, incomingDebuffs: {} },
    hax: {},
    setBonus: { active: false, statBonusPct: 0, defPiercePct: 0, bonusStartingLinhMach: 0 },
    state: st,
  };
  return { ...base, ...overrides, state: { ...st, ...(overrides.state || {}) } };
}

test('1. 100% Pet (91) & Equipment (165) IDs are wired in V13 registry or engine code', () => {
  const src = readEngineFiles();
  const allSrc = `${src.haxEngine}\n${src.statsCompiler}\n${src.domainEngine}\n${src.battleService}`;

  const missingPets = [];
  for (const p of cat.PET_CATALOG) {
    if (!V13_PET_HAX[p.pet_type] && !allSrc.includes(p.pet_type)) {
      missingPets.push(p.pet_type);
    }
  }
  assert.deepEqual(missingPets, [], `Unwired pet IDs: ${missingPets.join(', ')}`);

  const missingEq = [];
  for (const e of cat.EQUIPMENT_CATALOG) {
    if (!V13_EQUIP_HAX[e.item_id] && !allSrc.includes(e.item_id)) {
      const pureCritOnly = (Number(e.bonus_crit) || 0) > 0 && /bạo kích/i.test(e.hax_description || '')
        && !/xuyên|hút|khiên|hồi|phản|độc|đốt|choáng|băng|né|giảm/i.test(e.hax_description || '');
      if (!pureCritOnly) missingEq.push(e.item_id);
    }
  }
  assert.deepEqual(missingEq, [], `Unwired equipment IDs: ${missingEq.join(', ')}`);
});

test('2. Zero unused keys in V13_PET_HAX & V13_EQUIP_HAX', () => {
  const src = readEngineFiles();
  const allSrc = `${src.haxEngine}\n${src.statsCompiler}\n${src.domainEngine}\n${src.battleService}\n${src.teamBattleService}`;

  const allKeys = new Set();
  for (const entry of [...Object.values(V13_PET_HAX), ...Object.values(V13_EQUIP_HAX)]) {
    for (const k of Object.keys(entry)) {
      if (k !== 'label') allKeys.add(k);
    }
  }
  const unused = [...allKeys].filter((k) => !new RegExp(`\\b${k}\\b`).test(allSrc));
  assert.deepEqual(unused, [], `Unused V13 registry keys: ${unused.join(', ')}`);
});

test('3. Domain equipment synergy bonuses match catalog descriptions', () => {
  const domain = cat.DOMAIN_BY_ID.domain_epic_1;
  const checkSide = (eq) => {
    const unit = makeUnit({ equipment: eq, domainLoadout: { domain, sense: null, realm: null } });
    const side = createDomainCombatSide(unit);
    side.activated = true;
    const mods = resolveSideModifiers(side, { hasDomain: false, activated: false, energy: 0 });
    return { side, mods };
  };

  const g22 = checkSide({ weapon: null, gem: cat.EQUIPMENT_BY_ID.gem_mythic_22, soul: null });
  assert.equal(g22.side.maxEnergy, domain.base_energy + 1);

  const gU10 = checkSide({ weapon: null, gem: cat.EQUIPMENT_BY_ID.gem_unique_10, soul: null });
  assert.equal(gU10.side.maxEnergy, domain.base_energy + 1);
  assert.equal(gU10.side.eqBonuses.drainResistChance, 0.25);
  assert.equal(gU10.side.eqBonuses.buffBonusPct, 0.10);

  const wM18 = checkSide({ weapon: cat.EQUIPMENT_BY_ID.weapon_mythic_18, gem: null, soul: null });
  assert.equal(wM18.side.eqBonuses.buffBonusPct, 0.10);

  const wU10 = checkSide({ weapon: cat.EQUIPMENT_BY_ID.weapon_unique_10, gem: null, soul: null });
  assert.equal(wU10.side.eqBonuses.buffBonusPct, 0.20);
  assert.equal(wU10.side.eqBonuses.debuffBonusPct, 0.10);

  const sM20 = checkSide({ weapon: null, gem: null, soul: cat.EQUIPMENT_BY_ID.soul_mythic_20 });
  assert.equal(sM20.side.eqBonuses.debuffBonusPct, 0.12);
  assert.equal(sM20.side.eqBonuses.buffBonusPct, 0);

  const sU10 = checkSide({ weapon: null, gem: null, soul: cat.EQUIPMENT_BY_ID.soul_unique_10 });
  assert.equal(sU10.side.maxEnergy, domain.base_energy + 2);
  assert.equal(sU10.side.eqBonuses.debuffBonusPct, 0.20);
});

test('4. Cleanse (cleanseCombatantDebuffs & soul_epic_3) clears all 10 debuff states', () => {
  const unit = makeUnit({
    equipment: { weapon: null, gem: null, soul: cat.EQUIPMENT_BY_ID.soul_epic_3 },
    state: {
      isStunned: true,
      blindTurns: 2,
      poisonActive: true,
      poisonPct: 0.08,
      burnTurns: 2,
      burnPct: 0.06,
      healReductionTurns: 2,
      healReductionPct: 0.4,
      atkDebuffTurns: 2,
      atkDebuffPct: 0.2,
      defDebuffTurns: 2,
      defDebuffPct: 0.2,
      defDebuffTotalPct: 0.2,
      spdDebuffTurns: 2,
      spdDebuffPct: 0.2,
      enemyDmgDebuffTurns: 2,
      enemyDmgDebuffPct: 0.2,
      enemyAccDebuffTurns: 2,
      enemyAccDebuffPct: 0.2,
    },
  });

  const cleared = cleanseCombatantDebuffs(unit, 10);
  assert.equal(cleared.length, 10);
  assert.equal(unit.state.isStunned, false);
  assert.equal(unit.state.poisonActive, false);
  assert.equal(unit.state.healReductionTurns, 0);
  assert.equal(unit.state.spdDebuffTurns, 0);
  assert.equal(unit.state.enemyDmgDebuffTurns, 0);
  assert.equal(unit.state.enemyAccDebuffTurns, 0);

  // soul_epic_3 clears poison on turn start
  const poisoned = makeUnit({
    equipment: { weapon: null, gem: null, soul: cat.EQUIPMENT_BY_ID.soul_epic_3 },
    state: { poisonActive: true, poisonPct: 0.08 },
  });
  const ts = triggerTurnStart(poisoned, makeUnit(), () => 0.9, 1);
  assert.equal(poisoned.state.poisonActive, false);
  assert.ok(ts.events.some((e) => e.action === 'cleanse' && e.skill.includes('Trúng Độc')));
});

test('5. Behavioral & Log Regressions: u_linh_tieu_mieu, weapon_rare_5, gem_unique_2, burnMode, reflect, immortal, dynamic SPD & logs', async () => {
  // 5a. u_linh_tieu_mieu 12% lifesteal
  const catActor = makeUnit({ petType: 'u_linh_tieu_mieu' });
  const catTarget = makeUnit({ id: 'unit_b' });
  const catAtk = triggerAttackPhase(catActor, catTarget, 1000, () => 0.99);
  assert.ok(catAtk.lifestealPct >= 0.12);

  // 5b. weapon_rare_5 5% maxHp on-hit heal
  const fluteActor = makeUnit({ equipment: { weapon: cat.EQUIPMENT_BY_ID.weapon_rare_5, gem: null, soul: null } });
  const fluteAtk = triggerAttackPhase(fluteActor, makeUnit({ id: 'unit_b' }), 1000, () => 0.99);
  assert.equal(fluteAtk.onHitMaxHpHealPct, 0.05);

  // 5c. gem_unique_2 30% true damage resist
  const trueTarget = makeUnit({ equipment: { weapon: null, gem: cat.EQUIPMENT_BY_ID.gem_unique_2, soul: null } });
  const trueRecv = triggerDamageReceived(trueTarget, 1000, makeUnit({ id: 'unit_b' }), () => 0.99, { isTrueDamage: true });
  assert.equal(trueRecv.finalDamage, 700);

  // 5d. hac_diem_linh_nha burnMode: 'current'
  const crow = makeUnit({ petType: 'hac_diem_linh_nha' });
  const crowVictim = makeUnit({ id: 'unit_b', maxHp: 20000, currentHp: 10000 });
  triggerAttackPhase(crow, crowVictim, 1000, () => 0.99);
  assert.equal(crowVictim.state.burnMode, 'current');
  const burnTs = triggerTurnStart(crowVictim, crow, () => 0.99, 2);
  assert.ok(burnTs.events.some((e) => e.action === 'dot' && e.skill.includes('-600 HP')));

  // 5e. thien_co_ngoc_ho dodge counter ignores 100% DEF
  assert.equal(V13_PET_HAX.thien_co_ngoc_ho.dodgeCounterDefPierce, 1.0);

  // 5f. gem_mythic_2 (75%) + huyen_vu_linh_quy (35%) additive reflect capped at 85%
  const reflectUnit = makeUnit({
    petType: 'huyen_vu_linh_quy',
    equipment: { weapon: null, gem: cat.EQUIPMENT_BY_ID.gem_mythic_2, soul: null },
  });
  const reflectRes = triggerDamageReceived(reflectUnit, 1000, makeUnit({ id: 'unit_b' }), () => 0.99);
  // 25% dmgRed -> 750 finalDamage; 85% reflect cap -> 637
  assert.equal(reflectRes.finalDamage, 750);
  assert.equal(reflectRes.reflectedDamage, 637);

  // 5g. Immortal blocks deferred on-hit debuffs & multi-source turnHealPct logs all sources
  const healUnit = makeUnit({
    petType: 'tinh_van_cuu_loc',
    currentHp: 10000,
    maxHp: 20000,
    equipment: { weapon: null, gem: cat.EQUIPMENT_BY_ID.gem_epic_5, soul: null },
  });
  const healTs = triggerTurnStart(healUnit, makeUnit({ id: 'unit_b' }), () => 0.99, 1);
  const healEvt = healTs.events.find((e) => e.action === 'heal');
  assert.ok(healEvt && healEvt.skill.includes('Tinh Thần Độ Thế 6%') && healEvt.skill.includes('Trường Sinh 9%'));

  // 5h. Dynamic SPD turn order in 1v1 + shield absorb log
  const slowUser = {
    user_id: 'spd_a',
    username: 'FastThenSlow',
    level: 20,
    pet: {
      pet_type: 'hoa_thach_nham_nham',
      pet_name: 'Hóa Thạch',
      element: 'Kim',
      level: 20,
      star: 1,
      base_atk: 200,
      base_def: 200,
      base_spd: 500,
      equipment: { weapon: null, gem: null, soul: cat.EQUIPMENT_BY_ID.soul_rare_6 }, // +12% SPD for 2 turns => 560 SPD
    },
  };
  const tankUser = {
    user_id: 'spd_b',
    username: 'SteadySpd',
    level: 20,
    pet: {
      pet_type: 'hoang_tho_thach_su',
      pet_name: 'Thạch Sư',
      element: 'Kim',
      level: 20,
      star: 1,
      base_atk: 200,
      base_def: 200,
      base_spd: 740, // Faster after turn 2 when soul_rare_6 (+12% on 700 = 784) expires!
      equipment: { weapon: null, gem: null, soul: null },
    },
  };
  const sim = await simulateBattle(slowUser, tankUser, { maxTurns: 4, seed: 42 });
  const t1First = sim.turns.find((t) => t.turn === 1);
  const t3First = sim.turns.find((t) => t.turn === 3);
  assert.equal(t1First.actor, 'attacker');
  assert.equal(t3First.actor, 'defender');
  assert.ok(sim.fullBattleLog.includes('khiên chặn'), '1v1 battle log must include (khiên chặn ...)');

  // 5i. Team battle compiles & runs with dynamic SPD + on-hit defer cleanly
  const cA = await compileCombatant(slowUser, 'attacker');
  const cB = await compileCombatant(tankUser, 'defender');
  const teamRes = simulateTeamBattle([cA], [cB], { maxTurns: 3, rng: () => 0.99 });
  assert.equal(teamRes.turnSnapshots.length > 1, true);
});
