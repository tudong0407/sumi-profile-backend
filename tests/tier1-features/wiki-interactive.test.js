import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestServer } from '../helpers/testServer.js';
import { assertPngValid } from '../helpers/pngValidator.js';
import { FIXTURE_USERS } from '../helpers/fixtures.js';
import { stripLeadingEmojis } from '../../src/canvas/drawUtils.js';
import { lookupInfo } from '../../src/services/infoService.js';
import { simulateBattle } from '../../src/services/battleEngine/battleService.js';

describe('Tier 1 - Pillar 1 Interactive Wiki (Charts, 45 Items, 20 Standard Pets, Unique Mythic Owners)', () => {
  let testServer;

  before(async () => {
    testServer = await createTestServer();
  });

  after(async () => {
    if (testServer) await testServer.close();
  });

  it('1. GET /api/wiki/catalog returns 165 items (57/54/54) and 90 standard pets (13/13/14/50), excluding Fuyumi exclusive pet', async () => {
    const res = await testServer.fetch('/api/wiki/catalog');
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.success, true);

    assert.equal(json.equipment.weapon.length, 57);
    assert.equal(json.equipment.gem.length, 54);
    assert.equal(json.equipment.soul.length, 54);

    assert.equal(json.pets.common.length, 13, 'Must have 13 Phàm Phẩm pets');
    assert.equal(json.pets.rare.length, 13, 'Must have 13 Linh Phẩm pets');
    assert.equal(json.pets.epic.length, 14, 'Must have 14 Tiên Phẩm pets');
    assert.equal(json.pets.mythic.length, 50, 'Must have 50 standard Thần Thoại pets');

    const allWikiPets = [
      ...json.pets.common,
      ...json.pets.rare,
      ...json.pets.epic,
      ...json.pets.mythic,
    ];
    assert.equal(allWikiPets.length, 90, 'Wiki catalog must expose exactly 90 standard pets');
    assert.ok(!allWikiPets.some((p) => p.pet_type === 'cuu_vi_hong_ho' || p.is_exclusive_fuyumi), 'Exclusive Fuyumi pet must NOT appear in wiki catalog');
  });

  it('2. Standalone realms, domains, roles & glossary categories exist, all 10 wiki categories use concise non-greeting copy, and zero mention of Fuyumi exclusives', async () => {
    const res = await testServer.fetch('/api/wiki');
    assert.equal(res.status, 200);
    const json = await res.json();
    const ids = json.categories.map((c) => c.id);
    assert.deepEqual(ids, ['overview', 'realms', 'battle', 'equipment', 'pets', 'domains', 'roles', 'economy', 'explorer', 'glossary']);

    const fullWikiText = JSON.stringify(json.categories);
    assert.ok(!/Cửu Vĩ Hồng Hồ|cuu_vi_hong_ho|domain_fuyumi_|sense_fuyumi_|realm_fuyumi_/i.test(fullWikiText), 'Wiki categories must NOT mention Fuyumi exclusive items');
    assert.ok(!/Dropdown|bên dưới|chọn chuyên mục|chọn trực tiếp/i.test(fullWikiText), 'Wiki categories must NOT contain redundant UI dropdown instructions');

    for (const cat of json.categories) {
      assert.ok(!/chào mừng đạo hữu/i.test(cat.content), `Category ${cat.id} should not contain verbose greeting`);
    }

    const realmsRes = await testServer.fetch('/api/wiki?category=realms');
    assert.equal(realmsRes.status, 200);
    const realmsJson = await realmsRes.json();
    assert.equal(realmsJson.data.id, 'realms');
    assert.match(realmsJson.data.title, /Cảnh Giới/i);
    assert.match(realmsJson.embed_flat.description, /78 × Level\^1\.45/);
  });

  it('3. GET /api/wiki/chart/elements.png renders Full HD+ 2000x1000 Ngũ Hành chart PNG', async () => {
    const res = await testServer.fetch('/api/wiki/chart/elements.png');
    assert.equal(res.status, 200);
    assert.ok(res.headers.get('content-type')?.includes('image/png'));
    const buffer = Buffer.from(await res.arrayBuffer());
    assertPngValid(buffer, 2000, 1000);
  });

  it('4. GET /api/wiki/item/weapon_mythic_1 reports live server owner Fuyumi 🌸 and renders 2000x1000 PNG card', async () => {
    const resJson = await testServer.fetch('/api/wiki/item/weapon_mythic_1');
    assert.equal(resJson.status, 200);
    const json = await resJson.json();
    assert.equal(json.success, true);
    assert.equal(json.data.is_unique, true);
    assert.equal(json.data.drop_rate, 0.5);
    assert.ok(json.data.current_owner, 'weapon_mythic_1 must report current unique owner');
    assert.equal(json.data.current_owner.user_id, FIXTURE_USERS.fuyumi.userId);
    assert.match(json.embed.description, /Fuyumi/);

    const resPng = await testServer.fetch('/api/wiki/item/weapon_mythic_1.png');
    assert.equal(resPng.status, 200);
    assertPngValid(Buffer.from(await resPng.arrayBuffer()), 2000, 1000);
  });

  it('5. GET /api/wiki/item/:uniqueId reports unowned Mythic item cleanly and renders 2000x1000 PNG', async () => {
    const candidates = ['weapon_mythic_2', 'weapon_mythic_3', 'gem_mythic_1', 'gem_mythic_2', 'soul_mythic_2', 'soul_mythic_3'];
    let targetId = 'weapon_mythic_2';
    let json = null;
    for (const cid of candidates) {
      const r = await testServer.fetch(`/api/wiki/item/${cid}`);
      assert.equal(r.status, 200);
      const j = await r.json();
      if (!j.data?.current_owner) {
        targetId = cid;
        json = j;
        break;
      }
      if (!json) json = j;
    }

    assert.equal(json.success, true);
    assert.equal(json.data.is_unique, true);
    if (json.data.current_owner === null) {
      assert.match(json.data.owner_label, /Chưa có chủ sở hữu/);
    } else {
      assert.ok(json.data.owner_label && json.data.owner_label.length > 0);
    }

    const resPng = await testServer.fetch(`/api/wiki/item/${targetId}.png`);
    assert.equal(resPng.status, 200);
    assertPngValid(Buffer.from(await resPng.arrayBuffer()), 2000, 1000);
  });

  it('6. GET /api/wiki/pet/hoa_thach_nham_nham reports starter pet (120/180/100 Phàm Phẩm) and renders 2000x1000 PNG', async () => {
    const resJson = await testServer.fetch('/api/wiki/pet/hoa_thach_nham_nham');
    assert.equal(resJson.status, 200);
    const json = await resJson.json();
    assert.equal(json.success, true);
    assert.equal(json.data.rarity, 'Phàm Phẩm');
    assert.equal(json.data.element, 'Thổ');
    assert.equal(json.data.is_starter, true);
    assert.equal(json.data.base_atk, 120);
    assert.equal(json.data.base_def, 180);
    assert.equal(json.data.base_spd, 100);
    assert.equal(json.data.base_hp, 1900);

    const resPng = await testServer.fetch('/api/wiki/pet/hoa_thach_nham_nham.png');
    assert.equal(resPng.status, 200);
    assertPngValid(Buffer.from(await resPng.arrayBuffer()), 2000, 1000);
  });

  it('7. Prototype pollution, invalid IDs, and Fuyumi exclusive pet (cuu_vi_hong_ho) return 404 on /api/wiki/pet while Fuyumi profile keeps it 100%', async () => {
    for (const bad of ['constructor', '__proto__', 'toString', 'nonexistent_xyz']) {
      const rItem = await testServer.fetch(`/api/wiki/item/${bad}`);
      assert.equal(rItem.status, 404, `Expected 404 for item ${bad}`);
      const rPet = await testServer.fetch(`/api/wiki/pet/${bad}`);
      assert.equal(rPet.status, 404, `Expected 404 for pet ${bad}`);
    }

    const rExclusiveJson = await testServer.fetch('/api/wiki/pet/cuu_vi_hong_ho');
    assert.equal(rExclusiveJson.status, 404, 'cuu_vi_hong_ho must be excluded from /api/wiki/pet JSON');
    const rExclusivePng = await testServer.fetch('/api/wiki/pet/cuu_vi_hong_ho.png');
    assert.equal(rExclusivePng.status, 404, 'cuu_vi_hong_ho must be excluded from /api/wiki/pet PNG');

    // Confirm Fuyumi's profile still retains Cửu Vĩ Hồng Hồ 100%
    const fuProf = await testServer.fetch(`/api/profile/${FIXTURE_USERS.fuyumi.userId}?format=json`);
    assert.equal(fuProf.status, 200);
    const fuJson = await fuProf.json();
    assert.equal(fuJson.data.pet?.pet_type, 'cuu_vi_hong_ho');
    assert.match(fuJson.data.pet?.name || '', /Cửu Vĩ Hồng Hồ/);
  });

  it('8. /wiki roles + battle shield-bypass, /info role perms, stripLeadingEmojis & reflect battle log clarity', async () => {
    const rolesRes = await testServer.fetch('/api/wiki?category=roles');
    assert.equal(rolesRes.status, 200);
    const rolesJson = await rolesRes.json();
    assert.equal(rolesJson.data.id, 'roles');
    assert.ok(rolesJson.embed_flat.description.length <= 3950);
    for (const expected of ['Cửu Vĩ Tối Thượng Thần Hồ', 'SuMi Đệ Nhất Khách Tôn', 'Cửu Tiêu Phong Vương', 'Song Tuyệt Kiếm Khách', 'Linh Âm Hồ Ca', '/info']) {
      assert.ok(rolesJson.embed_flat.description.includes(expected), `Wiki roles must include ${expected}`);
    }

    const battleRes = await testServer.fetch('/api/wiki?category=battle');
    assert.equal(battleRes.status, 200);
    const battleJson = await battleRes.json();
    assert.match(battleJson.embed_flat.description, /bỏ qua khiên/i);

    assert.equal(
      stripLeadingEmojis('<:ui_crown_king:1574471981275811850> Quản Trị Voice & Chat Danh Dự'),
      'Quản Trị Voice & Chat Danh Dự',
    );
    assert.equal(stripLeadingEmojis('<a:su_sparkle:123><:ui_crown_king:456> Test'), 'Test');

    const roleInfo = await lookupInfo('1573186003101941830');
    assert.equal(roleInfo.success, true);
    assert.match(roleInfo.description, /Quyền Discord:/);
    assert.match(roleInfo.description, /Buff Tu Tiên:/);
    assert.match(roleInfo.description, /\+60% EXP/);

    const reflectBattle = await simulateBattle(
      {
        user_id: 'reflect_a',
        username: 'Attacker',
        level: 30,
        pet: {
          name: 'Hỏa Linh Tiểu Hồ',
          pet_type: 'hoa_linh_tieu_ho',
          element: 'Hỏa',
          atk: 500,
          def: 200,
          spd: 400,
          level: 30,
          star: 1,
          equipment: {},
        },
      },
      {
        user_id: 'reflect_b',
        username: 'Defender',
        level: 30,
        pet: {
          name: 'Thủy Tinh Huyền Ngao',
          pet_type: 'thuy_tinh_huyen_ngao',
          element: 'Thủy',
          atk: 200,
          def: 300,
          spd: 150,
          level: 30,
          star: 1,
          equipment: {
            gem: { item_id: 'gem_mythic_2', item_name: '« Vạn Tượng Quy Nhất Châu »', item_type: 'gem', element: 'Quang', bonus_atk: 0, bonus_def: 730, bonus_spd: 250, bonus_hp: 4600 },
          },
        },
      },
      { seed: 7 },
    );
    const allLogs = JSON.stringify(reflectBattle.turnSnapshots || reflectBattle.logs || reflectBattle);
    assert.match(allLogs, /Phản Đòn .*thẳng máu, bỏ qua khiên/);
  });

  it('9. /api/wiki/catalog exposes 60 public domain entities (30/15/15), /api/wiki/domain/:id works and hides Fuyumi exclusives (404), glossary supports 4 pages & terms are synced', async () => {
    const catRes = await testServer.fetch('/api/wiki/catalog');
    assert.equal(catRes.status, 200);
    const catJson = await catRes.json();
    assert.equal(catJson.domains.domain.length, 30);
    assert.equal(catJson.domains.sense.length, 15);
    assert.equal(catJson.domains.realm.length, 15);

    const domRes = await testServer.fetch('/api/wiki/domain/domain_unique_1');
    assert.equal(domRes.status, 200);
    const domJson = await domRes.json();
    assert.equal(domJson.success, true);
    assert.match(domJson.embed.image_url, /\/assets\/domains\/domain_unique_1\.webp\?v=1\.5$/);
    assert.match(domJson.embed.description, /Xuyên Kháng Vực/);

    const realmRes = await testServer.fetch('/api/wiki/domain/realm_mythic_2');
    assert.equal(realmRes.status, 200);
    const realmJson = await realmRes.json();
    assert.match(realmJson.embed.description, /Cường Hóa Debuff Vực/);
    assert.ok(!/Debuff gốc/i.test(realmJson.embed.description));

    const senseRes = await testServer.fetch('/api/wiki/domain/sense_unique_2');
    assert.equal(senseRes.status, 200);
    const senseJson = await senseRes.json();
    assert.match(senseJson.embed.description, /Kháng Trừ Linh Mạch Khắc Vực/);

    for (const exclId of ['domain_fuyumi_cuu_vi_hong_mong', 'sense_fuyumi_thai_thuong_hong_ho', 'realm_fuyumi_van_co_tuyet_diet']) {
      const hiddenRes = await testServer.fetch(`/api/wiki/domain/${exclId}`);
      assert.equal(hiddenRes.status, 404, `Exclusive ${exclId} must return 404 on /wiki`);
    }

    for (let p = 1; p <= 4; p += 1) {
      const glRes = await testServer.fetch(`/api/wiki?category=glossary&page=${p}`);
      assert.equal(glRes.status, 200);
      const glJson = await glRes.json();
      assert.equal(glJson.category, 'glossary');
      assert.equal(glJson.page, p);
      assert.equal(glJson.total_pages, 4);
      assert.match(glJson.embed_flat.title, new RegExp(`Trang ${p}/4`));
    }

    const infoRealm = lookupInfo('realm_epic_3');
    assert.equal(infoRealm.success, true);
    assert.match(infoRealm.description || infoRealm.embed_flat?.description || '', /Cường Hóa Debuff Vực/);

    // Long battle log with full Mythic Domain + Sense + Realm must NEVER drop KẾT QUẢ or Web Log URL
    const longBattle = await simulateBattle(
      {
        user_id: 'long_a',
        username: 'LongAttacker',
        level: 80,
        pet: {
          name: 'Cửu Thiên Lôi Đế Hồ',
          pet_type: 'cuu_thien_loi_de_ho',
          element: 'Lôi',
          atk: 1800,
          def: 2400,
          spd: 1700,
          level: 80,
          star: 5,
          equipment: {
            weapon: { item_id: 'weapon_unique_4', item_name: '« Cửu Kiếp Thần Lôi Đế Cung »', item_type: 'weapon', element: 'Lôi', bonus_atk: 780, bonus_def: 60, bonus_spd: 360, bonus_crit: 20 },
            gem: { item_id: 'gem_unique_8', item_name: '« Cửu Tiêu Lôi Đình Hộ Tâm Kính »', item_type: 'gem', element: 'Lôi', bonus_atk: 195, bonus_def: 785, bonus_spd: 235, bonus_hp: 5200 },
            soul: { item_id: 'soul_unique_6', item_name: '« Cửu Thiên Lôi Đế Chiến Hồn »', item_type: 'soul', element: 'Lôi', bonus_atk: 410, bonus_def: 270, bonus_spd: 525 },
          },
          domainLoadout: {
            domain: { domain_id: 'domain_unique_1' },
            sense: { sense_id: 'sense_unique_2' },
            realm: { realm_id: 'realm_unique_1' },
          },
        },
      },
      {
        user_id: 'long_b',
        username: 'LongDefender',
        level: 80,
        pet: {
          name: 'Bắc Hải Huyền Vũ Đế',
          pet_type: 'bac_hai_huyen_vu_de',
          element: 'Thủy',
          atk: 1600,
          def: 2600,
          spd: 1400,
          level: 80,
          star: 5,
          equipment: {
            weapon: { item_id: 'weapon_unique_3', item_name: '« Thái Thủy Tuyệt Đống Thần Kích »', item_type: 'weapon', element: 'Thủy', bonus_atk: 770, bonus_def: 180, bonus_spd: 335, bonus_crit: 16 },
            gem: { item_id: 'gem_unique_3', item_name: '« Vĩnh Hằng Hàn Băng Thần Châu »', item_type: 'gem', element: 'Thủy', bonus_atk: 120, bonus_def: 820, bonus_spd: 195, bonus_hp: 5350 },
            soul: { item_id: 'soul_unique_5', item_name: '« Huyền Minh Đế Quy Thần Hồn »', item_type: 'soul', element: 'Thủy', bonus_atk: 335, bonus_def: 430, bonus_spd: 460 },
          },
          domainLoadout: {
            domain: { domain_id: 'domain_unique_3' },
            sense: { sense_id: 'sense_unique_1' },
            realm: { realm_id: 'realm_unique_2' },
          },
        },
      },
      { seed: 42, preRender: false },
    );
    assert.ok(longBattle.fullBattleLog.length <= 3950, `fullBattleLog too long: ${longBattle.fullBattleLog.length}`);
    assert.match(longBattle.fullBattleLog, /KẾT QUẢ:/);
    assert.match(longBattle.fullBattleLog, /Mở Xem Chi Tiết Trên Web/);
  });
});
