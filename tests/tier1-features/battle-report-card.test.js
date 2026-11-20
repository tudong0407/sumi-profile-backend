import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestServer } from '../helpers/testServer.js';
import { assertPngValid } from '../helpers/pngValidator.js';
import { FIXTURE_USERS } from '../helpers/fixtures.js';

describe('Tier 1 - Pillar 3 Full HD+ Battle Report Image (2000x1000)', () => {
  let testServer;

  before(async () => {
    testServer = await createTestServer();
  });

  after(async () => {
    if (testServer) await testServer.close();
  });

  it('1. POST /api/battle/simulate returns battleId, concise headline, reportImagePath, and GET report PNG renders 2000x1000', async () => {
    const simRes = await testServer.fetch('/api/battle/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        attackerId: FIXTURE_USERS.fuyumi.userId,
        defenderId: FIXTURE_USERS.hanabiraMei.userId,
        options: { maxTurns: 20, seed: 42 },
      }),
    });

    assert.equal(simRes.status, 200);
    const json = await simRes.json();
    assert.equal(json.success, true);
    assert.ok(json.battleId && json.battleId.length >= 8, 'Must include battleId');
    assert.ok(json.headline && !json.headline.includes('\n'), 'Headline must be a single concise line');
    assert.ok(json.reportImageUrl?.includes(`/api/battle/report/${json.battleId}.png`));
    assert.ok(json.combatants?.attacker && json.combatants?.defender);
    assert.ok(Array.isArray(json.highlights) && json.highlights.length > 0);

    // Fetch cached PNG report
    const imgRes = await testServer.fetch(`/api/battle/report/${json.battleId}.png`);
    assert.equal(imgRes.status, 200);
    assert.ok(imgRes.headers.get('content-type')?.includes('image/png'));
    const buffer = Buffer.from(await imgRes.arrayBuffer());
    assertPngValid(buffer, 2000, 1000);
  });

  it('2. GET /api/battle/report.png stateless endpoint renders 2000x1000 PNG for two beginners', async () => {
    const imgRes = await testServer.fetch(
      `/api/battle/report.png?attacker=${FIXTURE_USERS.hanabiraMei.userId}&defender=${FIXTURE_USERS.defaultUser.userId}&seed=7`
    );
    assert.equal(imgRes.status, 200);
    assert.ok(imgRes.headers.get('content-type')?.includes('image/png'));
    const buffer = Buffer.from(await imgRes.arrayBuffer());
    assertPngValid(buffer, 2000, 1000);
  });

  it('3. GET /api/battle/report/:unknown.png returns 404 cleanly', async () => {
    const res = await testServer.fetch('/api/battle/report/doesnotexist999.png');
    assert.equal(res.status, 404);
    const json = await res.json();
    assert.equal(json.success, false);
  });
});
