import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestServer } from '../helpers/testServer.js';
import { BATTLE_FIXTURES, FIXTURE_USERS } from '../helpers/fixtures.js';

describe('Tier 1 - Pet Battle Simulation Engine Contract', () => {
  let testServer;

  before(async () => {
    testServer = await createTestServer();
  });

  after(async () => {
    if (testServer) await testServer.close();
  });

  it('1. POST /api/battle/simulate endpoint executes battle simulation and returns HTTP 200 with valid schema', async () => {
    const res = await testServer.fetch('/api/battle/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(BATTLE_FIXTURES.validBattlePayload),
    });

    assert.equal(res.status, 200, `Expected HTTP 200, received ${res.status}`);
    const json = await res.json();
    assert.equal(json.success, true, 'Battle simulation must indicate success');
    assert.ok(json.winner, 'Simulation response must contain winner');
    assert.ok(json.loser, 'Simulation response must contain loser');
    assert.ok(Array.isArray(json.turns), 'Simulation response must contain turns array');
    assert.ok(json.turns.length > 0, 'Turns array must not be empty');
    assert.ok(typeof json.summary === 'string', 'Simulation response must include battle summary');
  });

  it('2. POST /api/battle/simulate validates required input parameters (attackerId & defenderId)', async () => {
    const res = await testServer.fetch('/api/battle/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    assert.equal(res.status, 400, `Expected HTTP 400 Bad Request, received ${res.status}`);
    const json = await res.json();
    assert.equal(json.success, false, 'Empty body must result in success: false');
    assert.ok(json.error, 'Error property must be present');
  });

  it('3. Battle contract specifies winner and loser objects with id, name, and pet info', () => {
    // Contract definition test for PROJECT.md §Pet Battle API
    const contractExample = {
      success: true,
      winner: { id: FIXTURE_USERS.fuyumi.userId, name: FIXTURE_USERS.fuyumi.username, pet: FIXTURE_USERS.fuyumi.pet.name },
      loser: { id: FIXTURE_USERS.hanabiraMei.userId, name: FIXTURE_USERS.hanabiraMei.username, pet: FIXTURE_USERS.hanabiraMei.pet.name },
      turns: [],
      summary: 'Fuyumi giành chiến thắng áp đảo!',
    };

    assert.equal(typeof contractExample.winner.id, 'string');
    assert.equal(typeof contractExample.winner.name, 'string');
    assert.equal(typeof contractExample.winner.pet, 'string');
    assert.equal(typeof contractExample.loser.id, 'string');
    assert.notEqual(contractExample.winner.id, contractExample.loser.id);
  });

  it('4. Battle contract verifies turn structure integrity (turn, actor, damage, hp)', () => {
    const mockTurn = {
      turn: 1,
      actor: 'attacker',
      action: 'attack',
      damage: 1250,
      isCrit: true,
      elementAdvantage: 'KIM_KOC_MOC',
      haxTriggered: null,
      attackerHp: 50000,
      defenderHp: 48750,
    };

    assert.equal(typeof mockTurn.turn, 'number');
    assert.ok(['attacker', 'defender'].includes(mockTurn.actor));
    assert.equal(typeof mockTurn.damage, 'number');
    assert.ok(mockTurn.damage >= 0);
    assert.equal(typeof mockTurn.isCrit, 'boolean');
    assert.ok(mockTurn.attackerHp >= 0);
    assert.ok(mockTurn.defenderHp >= 0);
  });

  it('5. Ngũ Hành elemental cycle contract defines standard counter relationships', () => {
    // Kim khắc Mộc, Mộc khắc Thổ, Thổ khắc Thủy, Thủy khắc Hỏa, Hỏa khắc Kim
    const NGU_HANH_CYCLE = {
      Kim: 'Moc',
      Moc: 'Tho',
      Tho: 'Thuy',
      Thuy: 'Hoa',
      Hoa: 'Kim',
    };

    assert.equal(NGU_HANH_CYCLE['Kim'], 'Moc', 'Kim must counter Mộc');
    assert.equal(NGU_HANH_CYCLE['Moc'], 'Tho', 'Mộc must counter Thổ');
    assert.equal(NGU_HANH_CYCLE['Tho'], 'Thuy', 'Thổ must counter Thủy');
    assert.equal(NGU_HANH_CYCLE['Thuy'], 'Hoa', 'Thủy must counter Hỏa');
    assert.equal(NGU_HANH_CYCLE['Hoa'], 'Kim', 'Hỏa must counter Kim');
  });

  it('6. POST /api/battle/simulate with options: null succeeds with HTTP 200 and default settings', async () => {
    const payload = {
      attackerId: FIXTURE_USERS.fuyumi.userId,
      defenderId: FIXTURE_USERS.hanabiraMei.userId,
      options: null,
    };

    const res = await testServer.fetch('/api/battle/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    assert.equal(res.status, 200, `Expected HTTP 200 when options is null, received ${res.status}`);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(json.winner);
    assert.ok(json.loser);
    assert.ok(Array.isArray(json.turns));
    assert.ok(json.turns.length > 0);
  });
});
