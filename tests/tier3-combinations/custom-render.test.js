import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestServer } from '../helpers/testServer.js';
import { assertPngValid } from '../helpers/pngValidator.js';
import { MOCK_ITEMS } from '../helpers/fixtures.js';

describe('Tier 3 - Custom Payload Canvas Rendering (Profile & Rank)', () => {
  let testServer;

  before(async () => {
    testServer = await createTestServer();
  });

  after(async () => {
    if (testServer) await testServer.close();
  });

  it('1. POST /api/profile/render with 3 custom equipped loadout items produces valid 2000x1000 Full HD+ PNG', async () => {
    const payload = {
      user_id: '600000000000000001',
      username: 'Hiệp Sĩ Hoàng Gia',
      level: 45,
      pet: {
        name: 'Chiến Giáp Hồ',
        level: 40,
        equipment: {
          weapon: MOCK_ITEMS.weaponMythic,
          gem: MOCK_ITEMS.gemMythic,
          soul: MOCK_ITEMS.soulMythic,
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
    assertPngValid(buffer, 2000, 1000);
  });

  it('2. POST /api/profile/render with custom pet metadata (element, HAX skill, power) renders correctly', async () => {
    const payload = {
      user_id: '600000000000000002',
      username: 'Hỏa Thần Đại Hiệp',
      level: 60,
      realm: 'IV. Nguyên Anh Chân Quân',
      pet: {
        name: 'Hỏa Diễm Thần Hồ',
        rarity: 'Thần Thoại',
        element: 'Hỏa',
        hax_skill: 'Thiêu Hồn Trảm',
        hax_desc: 'Bỏ qua 70% giáp đối thủ',
        level: 55,
        star: 5,
        atk: 8500,
        def: 6000,
        spd: 7500,
        power: 95000,
        icon: '🔥',
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

  it('3. POST /api/rank/render with custom clan, title, and level produces valid 2000x410 Full HD+ PNG', async () => {
    const payload = {
      user_id: '600000000000000003',
      username: 'Trưởng Lão Gia Tộc',
      level: 70,
      exp: 30000,
      next_level_exp: 50000,
      realm: 'V. Hóa Thần Tiên Tôn',
      custom_title: 'Đại Trưởng Lão',
      linh_thach: 88888,
      clan: {
        clan_id: 'clan_dragon',
        clan_name: 'Thần Long Các',
        clan_tag: '🐉TL',
        clan_level: 4,
        is_leader: true,
      },
    };

    const res = await testServer.fetch('/api/rank/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    assert.equal(res.status, 200);

    const buffer = Buffer.from(await res.arrayBuffer());
    assertPngValid(buffer, 2000, 410);
  });

  it('4. POST /api/profile/render with fully loaded profile (pet, 3 items, 5 roles, married, clan) renders cleanly', async () => {
    const fullPayload = {
      user_id: '600000000000000004',
      username: 'Chí Tôn Toàn Năng 🦊',
      bio: 'Thống lĩnh vạn giới, chân đạp hư không.',
      custom_title: 'Vô Địch Thần Vương',
      realm: 'VII. Hỗn Độn Chúa Tể',
      level: 100,
      exp: 490000,
      next_level_exp: 500000,
      linh_thach: 777777,
      max_role_slots: 5,
      streak: 99,
      clan: {
        clan_id: 'clan_fox',
        clan_name: 'Thiên Hồ Thần Tộc',
        clan_tag: '🦊TH',
        clan_level: 5,
        is_leader: true,
      },
      married: {
        user_id: '511187329889861651',
        username: 'Đạo Lữ Đồng Tu 💍',
      },
      pet: {
        name: 'Cửu Vĩ Hồng Hồ',
        rarity: 'Tối Thượng Thần Thoại',
        element: 'Hỗn Độn',
        hax_skill: 'Cửu Vĩ Hộ Thể',
        level: 99,
        star: 10,
        atk: 90000,
        def: 85000,
        spd: 92000,
        power: 9000000,
        equipment: {
          weapon: MOCK_ITEMS.weaponMythic,
          gem: MOCK_ITEMS.gemMythic,
          soul: MOCK_ITEMS.soulMythic,
        },
      },
      equipped_roles: [
        { slot: 1, name: '« Hỗn Độn Chúa Tể »', perk: '⚔️ Trảm Quyết Tối Thượng' },
        { slot: 2, name: '« Cửu Vĩ Thần Hồ »', perk: '🛡️ Kháng Timeout & Hộ Thể' },
        { slot: 3, name: '« Phong Thanh Hộ Pháp »', perk: '🎙️ Di Chuyển Voice' },
        { slot: 4, name: '« Thần Hành Cốt Cách »', perk: '⚡ Miễn Chờ Chat Chậm' },
        { slot: 5, name: '« Trấn Thư Pháp Vương »', perk: '📌 Ghim Tin Nhắn' },
      ],
    };

    const res = await testServer.fetch('/api/profile/render', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fullPayload),
    });
    assert.equal(res.status, 200);

    const buffer = Buffer.from(await res.arrayBuffer());
    assertPngValid(buffer, 2000, 1000);
  });
});
