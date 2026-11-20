import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestServer } from '../helpers/testServer.js';
import { assertPngValid } from '../helpers/pngValidator.js';
import { FIXTURE_USERS } from '../helpers/fixtures.js';

describe('Tier 1 - Mini Rank Card Rendering (PNG & JSON)', () => {
  let testServer;

  before(async () => {
    testServer = await createTestServer();
  });

  after(async () => {
    if (testServer) await testServer.close();
  });

  it('1. GET /api/rank/:userId renders 2000x410 Full HD+ Mini Rank PNG card for Fuyumi', async () => {
    const res = await testServer.fetch(`/api/rank/${FIXTURE_USERS.fuyumi.userId}`);
    assert.equal(res.status, 200, `Expected 200, received ${res.status}`);

    const contentType = res.headers.get('content-type');
    assert.ok(contentType?.includes('image/png'), `Expected image/png, received ${contentType}`);

    const buffer = Buffer.from(await res.arrayBuffer());
    assertPngValid(buffer, 2000, 410);
  });

  it('2. GET /api/rank/:userId.png extension resolves cleanly to 2000x410 PNG', async () => {
    const res = await testServer.fetch(`/api/rank/${FIXTURE_USERS.fuyumi.userId}.png`);
    assert.equal(res.status, 200, `Expected 200, received ${res.status}`);

    const contentType = res.headers.get('content-type');
    assert.ok(contentType?.includes('image/png'), `Expected image/png, received ${contentType}`);

    const buffer = Buffer.from(await res.arrayBuffer());
    assertPngValid(buffer, 2000, 410);
  });

  it('3. GET /api/rank/:userId?format=json returns compact rank data structure', async () => {
    const res = await testServer.fetch(`/api/rank/${FIXTURE_USERS.fuyumi.userId}?format=json`);
    assert.equal(res.status, 200, `Expected 200, received ${res.status}`);

    const json = await res.json();
    assert.equal(json.success, true);
    assert.ok(json.data, 'Must return data object');
    assert.equal(json.data.user_id, FIXTURE_USERS.fuyumi.userId);
    assert.match(json.data.username, /Fuyumi/);
    assert.equal(json.data.level, 100);
    assert.equal(typeof json.data.exp, 'number');
    assert.equal(typeof json.data.next_level_exp, 'number');
    assert.ok('realm' in json.data);
    assert.ok('linh_thach' in json.data);
  });

  it('4. POST /api/rank/render renders custom rank payload to 2000x410 Full HD+ PNG', async () => {
    const customPayload = {
      user_id: '998877665544332211',
      username: 'Đạo Hữu Tu Tiên 🌸',
      level: 35,
      exp: 12000,
      next_level_exp: 20000,
      realm: 'II. Trúc Cơ Đạo Cảnh',
      custom_title: 'Tu Tiên Giả',
      linh_thach: 4500,
    };

    const res = await testServer.fetch('/api/rank/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(customPayload),
    });
    assert.equal(res.status, 200, `Expected 200, received ${res.status}`);

    const contentType = res.headers.get('content-type');
    assert.ok(contentType?.includes('image/png'), `Expected image/png, received ${contentType}`);

    const buffer = Buffer.from(await res.arrayBuffer());
    assertPngValid(buffer, 2000, 410);
  });

  it('5. GET /api/rank/:userId?format=json returns clean Lv.1 beginner rank data for new user', async () => {
    const res = await testServer.fetch(`/api/rank/${FIXTURE_USERS.defaultUser.userId}?format=json`);
    assert.equal(res.status, 200, `Expected 200, received ${res.status}`);

    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.user_id, FIXTURE_USERS.defaultUser.userId);
    assert.ok(json.data.username.startsWith('Tu Sĩ #'));
    assert.equal(json.data.level, 1);
    assert.equal(json.data.exp, 0);
    assert.equal(json.data.realm, 'I. Luyện Khí Sơ Kỳ');
    assert.equal(json.data.linh_thach, 0);
  });
});
