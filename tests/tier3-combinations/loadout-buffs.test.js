import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestServer } from '../helpers/testServer.js';
import { assertPngValid } from '../helpers/pngValidator.js';
import { FIXTURE_USERS, MOCK_ITEMS } from '../helpers/fixtures.js';

describe('Tier 3 - Loadout Item Buffs & Profile Card Integration', () => {
  let testServer;

  before(async () => {
    testServer = await createTestServer();
  });

  after(async () => {
    if (testServer) await testServer.close();
  });

  it('1. Equipped weapon bonuses (ATK, SPD, CRIT) are present in profile JSON and equipment mapping', async () => {
    const res = await testServer.fetch(`/api/profile/${FIXTURE_USERS.fuyumi.userId}?format=json`);
    assert.equal(res.status, 200);

    const json = await res.json();
    assert.ok(json.data.pet?.equipment?.weapon, 'Fuyumi must have equipped weapon');
    const weapon = json.data.pet.equipment.weapon;

    assert.equal(weapon.item_id, 'weapon_mythic_1');
    assert.equal(weapon.bonus_atk, MOCK_ITEMS.weaponMythic.bonus_atk);
    assert.equal(weapon.bonus_spd, MOCK_ITEMS.weaponMythic.bonus_spd);
    assert.equal(weapon.bonus_crit, MOCK_ITEMS.weaponMythic.bonus_crit);
    assert.equal(weapon.hax_skill, MOCK_ITEMS.weaponMythic.hax_skill);
  });

  it('2. Equipped gem bonuses (DEF, SPD, HP) are accurately represented in profile equipment', async () => {
    const res = await testServer.fetch(`/api/profile/${FIXTURE_USERS.fuyumi.userId}?format=json`);
    const json = await res.json();

    assert.ok(json.data.pet?.equipment?.gem, 'Fuyumi must have equipped gem');
    const gem = json.data.pet.equipment.gem;

    assert.equal(gem.item_id, 'gem_mythic_3');
    assert.equal(gem.bonus_def, MOCK_ITEMS.gemMythic.bonus_def);
    assert.equal(gem.bonus_spd, MOCK_ITEMS.gemMythic.bonus_spd);
    assert.equal(gem.bonus_hp, MOCK_ITEMS.gemMythic.bonus_hp);
    assert.equal(gem.hax_skill, MOCK_ITEMS.gemMythic.hax_skill);
  });

  it('3. All 3 Mythic loadout items (Weapon + Gem + Soul) render composite buffs onto HD profile PNG', async () => {
    const payload = {
      user_id: '777777777777777777',
      username: 'Tam Đại Thần Khí 🦊',
      level: 90,
      pet: {
        name: 'Thần Thú Hỗn Độn',
        level: 80,
        atk: 25000,
        def: 20000,
        spd: 22000,
        power: 250000,
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
    assertPngValid(buffer, 1000, 500);
  });

  it('4. User without equipped items displays null equipment and unbuffed base stats', async () => {
    const res = await testServer.fetch(`/api/profile/${FIXTURE_USERS.defaultUser.userId}?format=json`);
    const json = await res.json();

    assert.ok(json.data.pet, 'Default user has pet');
    const equip = json.data.pet.equipment;
    assert.equal(equip.weapon, null, 'Weapon slot should be empty');
    assert.equal(equip.gem, null, 'Gem slot should be empty');
    assert.equal(equip.soul, null, 'Soul slot should be empty');
  });
});
