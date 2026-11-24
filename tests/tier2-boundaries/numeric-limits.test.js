import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestServer } from '../helpers/testServer.js';
import { assertPngValid } from '../helpers/pngValidator.js';
import { getRealmByLevel, getExpForNextLevel } from '../../src/services/profileService.js';

describe('Tier 2 - Numeric Limits & Boundary Edge Cases', () => {
  let testServer;

  before(async () => {
    testServer = await createTestServer();
  });

  after(async () => {
    if (testServer) await testServer.close();
  });

  it('1. Level 1 minimum boundary computes correct realm and positive next_level_exp', async () => {
    const realmLvl1 = getRealmByLevel(1);
    const expLvl1 = getExpForNextLevel(1);

    assert.equal(realmLvl1, 'I. Luyện Khí Sơ Kỳ');
    assert.equal(expLvl1, 78);

    const payload = {
      user_id: '100000000000000001',
      username: 'Tân Thủ Cấp 1',
      level: 1,
      exp: 0,
      next_level_exp: expLvl1,
      realm: realmLvl1,
      linh_thach: 0,
    };

    const res = await testServer.fetch('/api/profile/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    assert.equal(res.status, 200);
    const buffer = Buffer.from(await res.arrayBuffer());
    assertPngValid(buffer, 2000, 1000);
  });

  it('2. High level boundary (Level 999) caps next_level_exp at 500,000 and realm to Hỗn Độn Chúa Tể', async () => {
    const realmLvl999 = getRealmByLevel(999);
    const expLvl999 = getExpForNextLevel(999);

    assert.equal(realmLvl999, 'VII. Hỗn Độn Chúa Tể');
    assert.equal(expLvl999, 500000);

    const payload = {
      user_id: '999999999999999999',
      username: 'Thượng Cổ Thần Tôn',
      level: 999,
      exp: 499999,
      next_level_exp: expLvl999,
      realm: realmLvl999,
      linh_thach: 999999999,
    };

    const res = await testServer.fetch('/api/profile/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    assert.equal(res.status, 200);
    const buffer = Buffer.from(await res.arrayBuffer());
    assertPngValid(buffer, 2000, 1000);
  });

  it('3. Zero stats (0 ATK, 0 DEF, 0 SPD, 0 Linh Thạch) do not produce NaN', async () => {
    const payload = {
      user_id: '200000000000000002',
      username: 'Phàm Nhân',
      level: 1,
      exp: 0,
      next_level_exp: 100,
      linh_thach: 0,
      pet: {
        name: 'Ấu Trùng Hồ',
        level: 1,
        atk: 0,
        def: 0,
        spd: 0,
        power: 0,
      },
    };

    const res = await testServer.fetch('/api/profile/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    assert.equal(res.status, 200);

    const buffer = Buffer.from(await res.arrayBuffer());
    assertPngValid(buffer, 2000, 1000);
  });

  it('4. Extreme upper bounds (999,999,999 Linh Thạch, 10M+ Power) render without formatting crash', async () => {
    const payload = {
      user_id: '300000000000000003',
      username: 'Tỷ Phú Tiên Giới',
      level: 100,
      exp: 500000,
      next_level_exp: 500000,
      linh_thach: 999999999,
      pet: {
        name: 'Chí Tôn Thần Thú',
        level: 100,
        atk: 999999,
        def: 999999,
        spd: 999999,
        power: 10000000,
      },
    };

    const res = await testServer.fetch('/api/profile/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    assert.equal(res.status, 200);

    const buffer = Buffer.from(await res.arrayBuffer());
    assertPngValid(buffer, 2000, 1000);
  });

  it('5. Negative numeric values in payload are clamped safely to non-negative limits', async () => {
    const payload = {
      user_id: '400000000000000004',
      username: 'Tu Sĩ Âm',
      level: -10,
      exp: -500,
      linh_thach: -9999,
    };

    const res = await testServer.fetch('/api/profile/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    assert.equal(res.status, 200);

    const buffer = Buffer.from(await res.arrayBuffer());
    assertPngValid(buffer, 2000, 1000);
  });
});
