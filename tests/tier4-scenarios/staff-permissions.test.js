import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createTestServer } from '../helpers/testServer.js';
import { FIXTURE_USERS } from '../helpers/fixtures.js';

describe('Tier 4 - Staff vs Non-Staff Permissions & Profile Flow', () => {
  let testServer;

  before(async () => {
    testServer = await createTestServer();
  });

  after(async () => {
    if (testServer) await testServer.close();
  });

  /**
   * Helper that evaluates whether a user role qualifies for Staff/Automod exemption.
   * Based on SuMi Family guardrails: Cutoff is pos >= 137 (« Huyền Thiên Hồ Sứ »)
   * or Owner (511187329889861651) or Fuyumi (757091869183311872).
   */
  function isStaffExempt(userId, rolePosition) {
    if (userId === '757091869183311872' || userId === '511187329889861651') {
      return true;
    }
    return Number(rolePosition) >= 137;
  }

  it('1. Fuyumi (757091869183311872) flow: Staff role pos>=137, max 5 role slots, full privileges', async () => {
    const res = await testServer.fetch(`/api/profile/${FIXTURE_USERS.fuyumi.userId}?format=json`);
    assert.equal(res.status, 200);

    const json = await res.json();
    assert.equal(json.data.user_id, FIXTURE_USERS.fuyumi.userId);
    assert.match(json.data.username, /Fuyumi/);
    assert.equal(json.data.max_role_slots, 5, 'Fuyumi must have 5 role slots');
    assert.equal(isStaffExempt(FIXTURE_USERS.fuyumi.userId, FIXTURE_USERS.fuyumi.staffRolePos), true);

    // Verify equipped roles contain staff/mythic perks
    assert.ok(Array.isArray(json.data.equipped_roles));
    assert.ok(json.data.equipped_roles.length > 0);
    const hasHighTierPerk = json.data.equipped_roles.some(r =>
      r.perk?.includes('Trảm Quyết') || r.perk?.includes('Kháng Timeout')
    );
    assert.ok(hasHighTierPerk, 'Fuyumi must hold high-tier staff role perks');
  });

  it('2. Hanabira Mei (1429509324845092875 / legacy 1172824949774360636) flow: Non-staff pos=124 (<137), standard role limits', async () => {
    const res = await testServer.fetch(`/api/profile/${FIXTURE_USERS.hanabiraMei.userId}?format=json`);
    assert.equal(res.status, 200);

    const json = await res.json();
    assert.equal(json.data.user_id, FIXTURE_USERS.hanabiraMei.userId);

    // Hanabira Mei pos=124 is strictly below 137 cutoff
    assert.equal(
      isStaffExempt(FIXTURE_USERS.hanabiraMei.userId, FIXTURE_USERS.hanabiraMei.staffRolePos),
      false,
      'Hanabira Mei (pos=124) must NOT qualify for staff exemption'
    );
    assert.ok(json.data.max_role_slots <= 3, 'Non-staff has standard role slot limits');
  });

  it('3. Permission boundary invariant: pos>=137 exempt, pos=124 strictly non-exempt', () => {
    // Exact SuMi Family role boundary definitions
    const ROLES = [
      { name: '« 100 • Hỗn Độn Chúa Tể »', pos: 141, expectedExempt: true },
      { name: '« Cửu Vĩ Tối Thượng Thần Hồ »', pos: 140, expectedExempt: true },
      { name: '« Huyền Thiên Hồ Sứ »', pos: 137, expectedExempt: true }, // exact cutoff
      { name: '« Chấp Pháp Linh Hồ »', pos: 124, expectedExempt: false }, // MODERATE_MEMBERS below 137
      { name: '« Tiểu Băng Hồ »', pos: 123, expectedExempt: false },
      { name: '« Đệ Tử Ngoại Môn »', pos: 10, expectedExempt: false },
    ];

    for (const role of ROLES) {
      const exempt = isStaffExempt('user_random_id', role.pos);
      assert.equal(
        exempt,
        role.expectedExempt,
        `Role ${role.name} at pos ${role.pos} exemption mismatch: expected ${role.expectedExempt}, got ${exempt}`
      );
    }
  });
});
