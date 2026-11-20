import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestServer } from '../helpers/testServer.js';
import { assertPngValid } from '../helpers/pngValidator.js';
import { FIXTURE_USERS } from '../helpers/fixtures.js';
import { renderProfileCard } from '../../src/canvas/profileRenderer.js';
import { getFuyumiProfileMock } from '../../src/services/profileService.js';
import { EQUIPMENT_BY_ID } from '../../src/data/catalog.js';

describe('Tier 1 - Profile Card Rendering (PNG & JSON)', () => {
  let testServer;

  before(async () => {
    testServer = await createTestServer();
  });

  after(async () => {
    if (testServer) await testServer.close();
  });

  it('1. GET /api/profile/:userId renders Full HD+ 2000x1000 PNG card for Fuyumi', async () => {
    const res = await testServer.fetch(`/api/profile/${FIXTURE_USERS.fuyumi.userId}`);
    assert.equal(res.status, 200, `Expected 200, received ${res.status}`);

    const contentType = res.headers.get('content-type');
    assert.ok(contentType?.includes('image/png'), `Expected image/png, received ${contentType}`);

    const buffer = Buffer.from(await res.arrayBuffer());
    assertPngValid(buffer, 2000, 1000);
  });

  it('2. GET /api/profile/:userId.png extension resolves cleanly to 2000x1000 Full HD+ PNG', async () => {
    const res = await testServer.fetch(`/api/profile/${FIXTURE_USERS.fuyumi.userId}.png`);
    assert.equal(res.status, 200, `Expected 200, received ${res.status}`);

    const contentType = res.headers.get('content-type');
    assert.ok(contentType?.includes('image/png'), `Expected image/png, received ${contentType}`);

    const buffer = Buffer.from(await res.arrayBuffer());
    assertPngValid(buffer, 2000, 1000);
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

  it('5. GET /api/profile/:userId?format=json returns clean Lv.1 beginner schema + starter pet for new user', async () => {
    const res = await testServer.fetch(`/api/profile/${FIXTURE_USERS.defaultUser.userId}?format=json`);
    assert.equal(res.status, 200, `Expected 200, received ${res.status}`);

    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.data.user_id, FIXTURE_USERS.defaultUser.userId);
    assert.ok(json.data.username.startsWith('Tu Sĩ #'));
    assert.equal(json.data.level, 1);
    assert.equal(json.data.exp, 0);
    assert.equal(json.data.linh_thach, 0);
    assert.equal(json.data.realm, 'I. Luyện Khí Sơ Kỳ');
    assert.ok(json.data.pet, 'Beginner user must receive default Phàm Phẩm starter pet');
    assert.equal(json.data.pet.name, 'Hóa Thạch Nham Nham Thú');
    assert.equal(json.data.pet.rarity, 'Phàm Phẩm');
    assert.equal(json.data.pet.atk, 120);
    assert.equal(json.data.pet.def, 180);
    assert.equal(json.data.pet.spd, 100);
    assert.ok(Array.isArray(json.data.equipped_roles), 'equipped_roles should be an array');
    assert.equal(json.data.equipped_roles.length, 0);
  });

  it('6. renderProfileCard renders longest weapon (weapon_mythic_2) + AI background bg_15_fuyumi_paradise.png at 2000x1000', async () => {
    const mock = getFuyumiProfileMock();
    mock.background_url = 'backgrounds/bg_15_fuyumi_paradise.png';
    mock.pet.equipment = {
      weapon: EQUIPMENT_BY_ID.weapon_mythic_2,
      gem: EQUIPMENT_BY_ID.gem_epic_3,
      soul: EQUIPMENT_BY_ID.soul_mythic_2,
    };
    const buf = await renderProfileCard(mock);
    assertPngValid(buf, 2000, 1000);
  });
});
