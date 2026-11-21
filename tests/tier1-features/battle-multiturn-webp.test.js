import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { loadImage } from '@napi-rs/canvas';
import { createTestServer } from '../helpers/testServer.js';
import { FIXTURE_USERS, MOCK_ITEMS } from '../helpers/fixtures.js';
import { markUserAckedInCache, clearUpdateGateCache } from '../../src/services/updateGateService.js';

function assertWebpValid(buf, expectedWidth, expectedHeight) {
  assert.ok(buf && buf.length >= 16, 'WebP buffer must exist');
  assert.equal(buf.subarray(0, 4).toString('ascii'), 'RIFF', 'WebP must start with RIFF');
  assert.equal(buf.subarray(8, 12).toString('ascii'), 'WEBP', 'WebP must contain WEBP magic');
  return loadImage(buf).then((img) => {
    assert.equal(img.width, expectedWidth, `Expected WebP width ${expectedWidth}, got ${img.width}`);
    assert.equal(img.height, expectedHeight, `Expected WebP height ${expectedHeight}, got ${img.height}`);
    return img;
  });
}

describe('Tier 1 - Battle Multi-Turn Adaptive WebP & Fast Cache', () => {
  let testServer;

  before(async () => {
    markUserAckedInCache(FIXTURE_USERS.fuyumi.userId);
    markUserAckedInCache(FIXTURE_USERS.hanabiraMei.userId);
    testServer = await createTestServer();
  });

  after(async () => {
    clearUpdateGateCache(FIXTURE_USERS.fuyumi.userId);
    clearUpdateGateCache(FIXTURE_USERS.hanabiraMei.userId);
    if (testServer) await testServer.close();
  });

  it('1. 1-shot battle generates 2 adaptive frames (800x400 mid -> 1400x700 final WebP) and logs by channelId', async () => {
    const channelId = '1466390891399876668';
    const simRes = await testServer.fetch('/api/battle/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        attackerId: FIXTURE_USERS.fuyumi.userId,
        defenderId: FIXTURE_USERS.hanabiraMei.userId,
        channelId,
        options: { maxTurns: 20, seed: 42 },
      }),
    });

    assert.equal(simRes.status, 200);
    const json = await simRes.json();
    assert.equal(json.success, true);
    assert.equal(json.frameCount, 2);
    assert.equal(json.hasFrame3, false);
    assert.ok(json.frame1Url?.endsWith(`/api/battle/report/${json.battleId}/1.webp`));
    assert.ok(json.frame2Url?.endsWith(`/api/battle/report/${json.battleId}/2.webp`));
    assert.ok(json.finalImageWebpUrl?.endsWith(`/api/battle/report/${json.battleId}/2.webp`));

    const f1First = await testServer.fetch(`/api/battle/report/${json.battleId}/1.webp`);
    assert.equal(f1First.status, 200);
    assert.ok(f1First.headers.get('content-type')?.includes('image/webp'));
    await assertWebpValid(Buffer.from(await f1First.arrayBuffer()), 800, 400);

    const t0 = Date.now();
    const f1Res = await testServer.fetch(`/api/battle/report/${json.battleId}/1.webp`);
    const f1Ms = Date.now() - t0;
    assert.equal(f1Res.status, 200);
    assert.ok(f1Ms < 100, `Expected RAM-cached frame 1 under 100ms, got ${f1Ms}ms`);

    const f2Res = await testServer.fetch(`/api/battle/report/${json.battleId}/2.webp`);
    assert.equal(f2Res.status, 200);
    assert.ok(f2Res.headers.get('content-type')?.includes('image/webp'));
    await assertWebpValid(Buffer.from(await f2Res.arrayBuffer()), 1400, 700);

    // Logs lookup via channelId, userId, and battleId
    const logByCh = await testServer.fetch('/api/battle/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelId, userId: FIXTURE_USERS.fuyumi.userId }),
    });
    assert.equal(logByCh.status, 200);
    const logJson = await logByCh.json();
    assert.equal(logJson.success, true);
    assert.equal(logJson.found, true);
    assert.equal(logJson.battleId, json.battleId);
    assert.ok(logJson.description.length > 50 && logJson.description.length <= 4096);
    assert.ok(logJson.description.includes('Diễn Biến Chi Tiết'));
  });

  it('2. 5+ turn battle generates 3 adaptive frames (800x400 -> 800x400 -> 1400x700) cleanly', async () => {
    const tankA = {
      user_id: '900000000000000011',
      username: 'Đấu Sĩ Thanh Long',
      level: 65,
      avatar_frame: 'jade_lotus',
      pet: {
        name: 'Thanh Trúc Tiên Lộc',
        type: 'thanh_truc_tien_loc',
        rarity: 'Tiên Phẩm',
        element: 'Mộc',
        level: 60,
        star: 6,
        atk: 450,
        def: 500,
        spd: 320,
        equipment: {
          weapon: MOCK_ITEMS.weaponMythic,
          gem: MOCK_ITEMS.gemMythic,
          soul: MOCK_ITEMS.soulMythic,
        },
      },
    };
    const tankB = {
      user_id: '900000000000000022',
      username: 'Đấu Sĩ Bạch Hổ',
      level: 65,
      avatar_frame: 'frost_crystal',
      pet: {
        name: 'Thủy Tinh Huyền Ngao',
        type: 'thuy_tinh_huyen_ngao',
        rarity: 'Tiên Phẩm',
        element: 'Thủy',
        level: 60,
        star: 6,
        atk: 420,
        def: 540,
        spd: 300,
        equipment: {},
      },
    };

    const simRes = await testServer.fetch('/api/battle/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        attackerId: tankA,
        defenderId: tankB,
        options: { maxTurns: 20, seed: 7 },
      }),
    });
    assert.equal(simRes.status, 200);
    const json = await simRes.json();
    assert.ok(json.turnCount >= 5, `Expected 5+ turns for balanced duel, got ${json.turnCount}`);
    assert.equal(json.frameCount, 3);
    assert.equal(json.hasFrame3, true);

    const [r1, r2, r3] = await Promise.all([
      testServer.fetch(`/api/battle/report/${json.battleId}/1.webp`),
      testServer.fetch(`/api/battle/report/${json.battleId}/2.webp`),
      testServer.fetch(`/api/battle/report/${json.battleId}/3.webp`),
    ]);
    assert.equal(r1.status, 200);
    assert.equal(r2.status, 200);
    assert.equal(r3.status, 200);
    await assertWebpValid(Buffer.from(await r1.arrayBuffer()), 800, 400);
    await assertWebpValid(Buffer.from(await r2.arrayBuffer()), 800, 400);
    await assertWebpValid(Buffer.from(await r3.arrayBuffer()), 1400, 700);
  });

  it('3. Profile, Rank, and Wiki endpoints serve valid WebP when requested with .webp', async () => {
    const [pRes, rRes, wRes] = await Promise.all([
      testServer.fetch(`/api/profile/${FIXTURE_USERS.fuyumi.userId}.webp`),
      testServer.fetch(`/api/rank/${FIXTURE_USERS.fuyumi.userId}.webp`),
      testServer.fetch('/api/wiki/chart/elements.webp'),
    ]);

    assert.equal(pRes.status, 200);
    assert.ok(pRes.headers.get('content-type')?.includes('image/webp'));
    await assertWebpValid(Buffer.from(await pRes.arrayBuffer()), 2000, 1000);

    assert.equal(rRes.status, 200);
    assert.ok(rRes.headers.get('content-type')?.includes('image/webp'));
    await assertWebpValid(Buffer.from(await rRes.arrayBuffer()), 2000, 410);

    assert.equal(wRes.status, 200);
    assert.ok(wRes.headers.get('content-type')?.includes('image/webp'));
    await assertWebpValid(Buffer.from(await wRes.arrayBuffer()), 2000, 1000);
  });

  it('4. POST /api/battle/logs returns friendly message when battleId/channelId not found', async () => {
    const res = await testServer.fetch('/api/battle/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ battleId: 'nonexistent999', channelId: '000000000000000000' }),
    });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);
    assert.equal(json.found, false);
    assert.ok(json.description.includes('quá hạn'));
  });
});
