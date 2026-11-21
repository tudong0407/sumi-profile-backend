import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestServer } from '../helpers/testServer.js';

describe('Tier 1 - Health & Root Metadata Endpoints', () => {
  let testServer;

  before(async () => {
    testServer = await createTestServer();
  });

  after(async () => {
    if (testServer) await testServer.close();
  });

  it('1. GET / returns 200 and root metadata with service, bot, and owner info', async () => {
    const res = await testServer.fetch('/');
    assert.equal(res.status, 200, `Expected HTTP 200, received ${res.status}`);

    const json = await res.json();
    assert.ok(json.service, 'Response must include service name');
    assert.match(json.service, /SuMi Family/i);
    assert.match(json.bot, /916469360401453067/, 'Response must reference Nhiễm Nhiễm bot ID');
    assert.match(json.owner, /757091869183311872/, 'Response must reference Fuyumi owner ID');
  });

  it('2. GET / exposes a valid endpoint directory map with all core routes', async () => {
    const res = await testServer.fetch('/');
    const json = await res.json();

    assert.ok(json.endpoints, 'Root response must include endpoints object');
    assert.equal(typeof json.endpoints, 'object');
    assert.ok(json.endpoints.health, 'Must document health endpoint');
    assert.ok(json.endpoints.profile_png, 'Must document profile_png endpoint');
    assert.ok(json.endpoints.profile_json, 'Must document profile_json endpoint');
    assert.ok(json.endpoints.rank_png, 'Must document rank_png endpoint');
    assert.ok(json.endpoints.rank_json, 'Must document rank_json endpoint');
    assert.ok(json.endpoints.profile_render_custom, 'Must document profile_render_custom endpoint');
    assert.ok(json.endpoints.rank_render_custom, 'Must document rank_render_custom endpoint');
  });

  it('3. GET /health returns 200 OK with healthy status and service name', async () => {
    const res = await testServer.fetch('/health');
    assert.equal(res.status, 200, `Expected HTTP 200, received ${res.status}`);

    const json = await res.json();
    assert.equal(json.status, 'healthy', 'Health check status must be "healthy"');
    assert.equal(json.service, 'sumi-profile-backend', 'Service name must match');
    assert.equal(json.version, '1.0.0', 'Version should match 1.0.0');
  });

  it('4. GET /health reports non-negative uptime and valid ISO-8601 timestamp', async () => {
    const res = await testServer.fetch('/health');
    const json = await res.json();

    assert.equal(typeof json.uptime, 'number', 'Uptime must be a numeric value');
    assert.ok(json.uptime >= 0, 'Uptime must be greater than or equal to 0');
    assert.equal(typeof json.timestamp, 'string', 'Timestamp must be a string');

    const parsedDate = new Date(json.timestamp);
    assert.ok(!isNaN(parsedDate.getTime()), 'Timestamp must be a parseable ISO date');
  });

  it('5. GET /health reports Supabase connectivity flag as boolean', async () => {
    const res = await testServer.fetch('/health');
    const json = await res.json();

    assert.ok('supabase_connected' in json, 'Response must have supabase_connected property');
    assert.equal(typeof json.supabase_connected, 'boolean', 'supabase_connected must be boolean');
  });

  it('6. requireBackendApiKey enforces x-api-key on write routes while keeping /health public', async () => {
    const prevKey = process.env.BACKEND_API_KEY;
    process.env.BACKEND_API_KEY = 'test-secret-key-sumi-123';
    try {
      const noKeyRes = await testServer.fetch('/api/economy/daily', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      assert.equal(noKeyRes.status, 401);

      const wrongKeyRes = await testServer.fetch('/api/economy/daily', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': 'wrong-key' },
        body: JSON.stringify({}),
      });
      assert.equal(wrongKeyRes.status, 401);

      const validKeyRes = await testServer.fetch('/api/economy/daily', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': 'test-secret-key-sumi-123' },
        body: JSON.stringify({}),
      });
      assert.notEqual(validKeyRes.status, 401);
      assert.equal(validKeyRes.status, 400);

      const healthRes = await testServer.fetch('/health');
      assert.equal(healthRes.status, 200);
    } finally {
      if (prevKey === undefined) delete process.env.BACKEND_API_KEY;
      else process.env.BACKEND_API_KEY = prevKey;
    }
  });
});
