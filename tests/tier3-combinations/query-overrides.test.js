import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestServer } from '../helpers/testServer.js';
import { assertPngValid } from '../helpers/pngValidator.js';
import { FIXTURE_USERS } from '../helpers/fixtures.js';

describe('Tier 3 - Query Parameter Precedence & Overrides', () => {
  let testServer;

  before(async () => {
    testServer = await createTestServer();
  });

  after(async () => {
    if (testServer) await testServer.close();
  });

  it('1. ?username query parameter overrides database username in JSON response', async () => {
    const overrideName = 'TuSĩGhost_GhiĐè';
    const res = await testServer.fetch(
      `/api/profile/${FIXTURE_USERS.defaultUser.userId}?format=json&username=${encodeURIComponent(overrideName)}`
    );
    assert.equal(res.status, 200);

    const json = await res.json();
    assert.equal(json.data.username, overrideName);
  });

  it('2. ?title query parameter overrides default title in JSON response', async () => {
    const overrideTitle = 'Đệ Nhất Kiếm Thần';
    const res = await testServer.fetch(
      `/api/profile/${FIXTURE_USERS.defaultUser.userId}?format=json&title=${encodeURIComponent(overrideTitle)}`
    );
    assert.equal(res.status, 200);

    const json = await res.json();
    assert.equal(json.data.custom_title, overrideTitle);
  });

  it('3. ?avatar query parameter override accepts external/local avatar URL for rendering', async () => {
    const res = await testServer.fetch(
      `/api/profile/${FIXTURE_USERS.defaultUser.userId}?avatar=assets/fuyumi_avatar.png`
    );
    assert.equal(res.status, 200);

    const buffer = Buffer.from(await res.arrayBuffer());
    assertPngValid(buffer, 2000, 1000);
  });

  it('4. Combined overrides (username + title + bg) take precedence simultaneously', async () => {
    const overrideName = 'Bách Chiến Tiên Vương 🦊';
    const overrideTitle = 'Chủ Tọa Hội Đồng';
    const overrideBg = 'assets/celestial_palace_pink.png';

    const url = `/api/profile/${FIXTURE_USERS.defaultUser.userId}?format=json&username=${encodeURIComponent(overrideName)}&title=${encodeURIComponent(overrideTitle)}&bg=${encodeURIComponent(overrideBg)}`;
    const res = await testServer.fetch(url);
    assert.equal(res.status, 200);

    const json = await res.json();
    assert.equal(json.data.username, overrideName);
    assert.equal(json.data.custom_title, overrideTitle);
    assert.equal(json.data.background_url, overrideBg);

    // Also verify PNG rendering with combined overrides
    const pngUrl = `/api/profile/${FIXTURE_USERS.defaultUser.userId}?username=${encodeURIComponent(overrideName)}&title=${encodeURIComponent(overrideTitle)}&bg=${encodeURIComponent(overrideBg)}`;
    const resPng = await testServer.fetch(pngUrl);
    assert.equal(resPng.status, 200);
    const buffer = Buffer.from(await resPng.arrayBuffer());
    assertPngValid(buffer, 2000, 1000);
  });
});
