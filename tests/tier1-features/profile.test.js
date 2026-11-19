import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestServer } from '../helpers/testServer.js';
import { assertPngValid } from '../helpers/pngValidator.js';
import { FIXTURE_USERS } from '../helpers/fixtures.js';

describe('Tier 1 - Profile Card Rendering (PNG & JSON)', () => {
  let testServer;

  before(async () => {
    testServer = await createTestServer();
  });

  after(async () => {
    if (testServer) await testServer.close();
  });

  it('1. GET /api/profile/:userId renders standard 1000x500 HD PNG card for Fuyumi', async () => {
    const res = await testServer.fetch(`/api/profile/${FIXTURE_USERS.fuyumi.userId}`);
    assert.equal(res.status, 200, `Expected 200, received ${res.status}`);

    const contentType = res.headers.get('content-type');
    assert.ok(contentType?.includes('image/png'), `Expected image/png, received ${contentType}`);

    const buffer = Buffer.from(await res.arrayBuffer());
    assertPngValid(buffer, 1000, 500);
  });

  it('2. GET /api/profile/:userId.png extension resolves cleanly to 1000x500 HD PNG', async () => {
    const res = await testServer.fetch(`/api/profile/${FIXTURE_USERS.fuyumi.userId}.png`);
    assert.equal(res.status, 200, `Expected 200, received ${res.status}`);

    const contentType = res.headers.get('content-type');
    assert.ok(contentType?.includes('image/png'), `Expected image/png, received ${contentType}`);

    const buffer = Buffer.from(await res.arrayBuffer());
    assertPngValid(buffer, 1000, 500);
  });

  it('3. GET /api/profile/:userId?format=json returns full user profile structure for Fuyumi', async () => {
    const res = await testServer.fetch(`/api/profile/${FIXTURE_USERS.fuyumi.userId}?format=json`);
    assert.equal(res.status, 200, `Expected 200, received ${res.status}`);

    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(json.data, 'Must return data object');
    assert.equal(json.data.user_id, FIXTURE_USERS.fuyumi.userId);
    assert.match(json.data.username, /Fuyumi/);
    assert.equal(json.data.level, FIXTURE_USERS.fuyumi.level);
    assert.ok(json.data.pet, 'Fuyumi profile must include active pet');
    assert.match(json.data.pet.name, /Cửu Vĩ Hồng Hồ/);
    assert.match(json.data.realm, /Cửu Vĩ Tiên Chủ|Hỗn Độn Chúa Tể/);
  });

  it('4. GET /api/profile/:userId.json extension route returns JSON payload', async () => {
    const res = await testServer.fetch(`/api/profile/${FIXTURE_USERS.fuyumi.userId}.json`);
    assert.equal(res.status, 200, `Expected 200, received ${res.status}`);

    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.user_id, FIXTURE_USERS.fuyumi.userId);
    assert.equal(typeof json.data.exp, 'number');
    assert.equal(typeof json.data.next_level_exp, 'number');
  });

  it('5. GET /api/profile/:userId?format=json returns default mock user schema for new user', async () => {
    const res = await testServer.fetch(`/api/profile/${FIXTURE_USERS.defaultUser.userId}?format=json`);
    assert.equal(res.status, 200, `Expected 200, received ${res.status}`);

    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.user_id, FIXTURE_USERS.defaultUser.userId);
    assert.ok(json.data.username.startsWith('Tu Sĩ #'));
    assert.equal(json.data.level, 18);
    assert.equal(json.data.realm, 'I. Luyện Khí Sơ Kỳ');
    assert.ok(json.data.pet, 'Default user should receive beginner pet');
    assert.equal(json.data.pet.name, 'Băng Tuyết Hồ');
    assert.ok(Array.isArray(json.data.equipped_roles), 'equipped_roles should be an array');
  });
});
