import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestServer } from '../helpers/testServer.js';
import { assertPngValid } from '../helpers/pngValidator.js';
import { MOCK_ITEMS } from '../helpers/fixtures.js';

describe('Tier 2 - Loadout & Equipment Boundary Conditions', () => {
  let testServer;

  before(async () => {
    testServer = await createTestServer();
  });

  after(async () => {
    if (testServer) await testServer.close();
  });

  it('1. User with 0 equipped loadout items (all slots null) renders clean card without missing asset error', async () => {
    const payload = {
      user_id: '500000000000000001',
      username: 'Tu Sĩ Không Trang Bị',
      level: 10,
      pet: {
        name: 'Tiểu Hồ Ly',
        level: 5,
        equipment: {
          weapon: null,
          gem: null,
          soul: null,
        },
      },
    };

    const res = await testServer.fetch('/api/profile/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    assert.equal(res.status, 200);

    const buffer = Buffer.from(await res.arrayBuffer());
    assertPngValid(buffer, 1000, 500);
  });

  it('2. User with 1 equipped item (weapon only, gem and soul empty) renders accurately', async () => {
    const payload = {
      user_id: '500000000000000002',
      username: 'Kiếm Sĩ Cô Độc',
      level: 20,
      pet: {
        name: 'Hắc Báo',
        level: 15,
        equipment: {
          weapon: MOCK_ITEMS.weaponEpic,
          gem: null,
          soul: null,
        },
      },
    };

    const res = await testServer.fetch('/api/profile/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    assert.equal(res.status, 200);

    const buffer = Buffer.from(await res.arrayBuffer());
    assertPngValid(buffer, 1000, 500);
  });

  it('3. Loadout item with missing asset path uses procedural or fallback icon gracefully', async () => {
    const payload = {
      user_id: '500000000000000003',
      username: 'Đạo Sĩ Dị Giới',
      level: 30,
      pet: {
        name: 'Hỏa Kỳ Lân',
        level: 20,
        equipment: {
          weapon: {
            item_id: 'non_existent_weapon_9999',
            item_name: '« Vũ Khí Vô Danh »',
            item_type: 'weapon',
            rarity: 'Than Thoai',
            bonus_atk: 500,
            icon: '⚔️',
          },
          gem: null,
          soul: null,
        },
      },
    };

    const res = await testServer.fetch('/api/profile/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    assert.equal(res.status, 200);

    const buffer = Buffer.from(await res.arrayBuffer());
    assertPngValid(buffer, 1000, 500);
  });

  it('4. Malformed item data (missing stats, null fields) is handled safely', async () => {
    const payload = {
      user_id: '500000000000000004',
      username: 'Tu Sĩ Test Lỗi',
      level: 15,
      pet: {
        name: 'Tiểu Linh Thú',
        level: 10,
        equipment: {
          weapon: {
            item_id: 'broken_item',
            // item_name missing, bonus stats missing or undefined
          },
          gem: {
            item_id: 'corrupt_gem',
            bonus_def: 'not-a-number',
          },
          soul: null,
        },
      },
    };

    const res = await testServer.fetch('/api/profile/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    assert.equal(res.status, 200);

    const buffer = Buffer.from(await res.arrayBuffer());
    assertPngValid(buffer, 1000, 500);
  });

  it('5. User with 0 equipped roles (empty array) renders card cleanly without role slot errors', async () => {
    const payload = {
      user_id: '500000000000000005',
      username: 'Tán Tu Tự Do',
      level: 12,
      max_role_slots: 3,
      equipped_roles: [],
    };

    const res = await testServer.fetch('/api/profile/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    assert.equal(res.status, 200);

    const buffer = Buffer.from(await res.arrayBuffer());
    assertPngValid(buffer, 1000, 500);
  });
});
