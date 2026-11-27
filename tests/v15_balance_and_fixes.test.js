import test from 'node:test';
import assert from 'node:assert/strict';
import { createCanvas } from '@napi-rs/canvas';
import {
  ENCHANT_GRADES,
  getEnchantMultiplier,
  PET_BY_TYPE,
  EQUIPMENT_BY_ID,
  DOMAIN_BY_ID,
} from '../src/data/catalog.js';
import { V14_EXPLORER_MAPS, V14_SPIRIT_VEIN_TIERS } from '../src/data/v14ExpansionCatalog.js';
import { getChangelogPayload } from '../src/data/changelogs.js';
import { getWikiData } from '../src/services/wikiService.js';
import { computeScaledPetBaseStats } from '../src/services/inventoryService.js';
import {
  computeExplorerSurvival,
  computeExplorerLoadoutPower,
  evaluateExplorerTerrainBonus,
  EXPLORER_BASE_LT_PER_HOUR_MIN,
  EXPLORER_BASE_LT_PER_HOUR_MAX,
} from '../src/services/explorerService.js';
import { simulateTeamBattle } from '../src/services/battleEngine/teamBattleService.js';
import { computeTowerFloorRewardLt, TOWER_MILESTONE_BONUSES } from '../src/services/questService.js';
import { buildTowerGuardian } from '../src/services/questService.js';
import { preloadAvatarFrameOverlay, drawAntiAliasedAvatarWithBorder } from '../src/canvas/drawUtils.js';
import { triggerTurnStart } from '../src/services/battleEngine/haxEngine.js';
import { createInitialCombatState } from '../src/services/battleEngine/statsCompiler.js';
import { getInventory } from '../src/services/inventoryService.js';
import { buyShopItem, previewShopItem } from '../src/services/shopService.js';
import { FUYUMI_USER_ID } from '../src/data/catalog.js';

test('Ver 1.5 Rebalance: Enchant multipliers (+0/+8/+18/+32/+50%) and Pet Lv.100 +550% scaling', () => {
  assert.equal(getEnchantMultiplier('D'), 1.00);
  assert.equal(getEnchantMultiplier('C'), 1.08);
  assert.equal(getEnchantMultiplier('B'), 1.18);
  assert.equal(getEnchantMultiplier('A'), 1.32);
  assert.equal(getEnchantMultiplier('S'), 1.50);
  assert.equal(ENCHANT_GRADES.S.bonusPct, 50);

  const samplePet = PET_BY_TYPE.hoa_thach_nham_nham;
  const maxScaled = computeScaledPetBaseStats(samplePet, 100, 10);
  assert.ok(Math.abs(maxScaled.multiplier - 7.85) < 1e-6);
  assert.equal(maxScaled.atk, Math.round(samplePet.base_atk * 7.85));
});

test('Ver 1.5 Rebalance: /explorer 3.5k->112k, +5% LT base, Thuận Hệ Địa Hình (+6% survival) & Set Bonus power', () => {
  assert.equal(V14_EXPLORER_MAPS[0].recommended_power, 3500);
  assert.equal(V14_EXPLORER_MAPS[11].recommended_power, 112000);
  assert.equal(EXPLORER_BASE_LT_PER_HOUR_MIN, 210);
  assert.equal(EXPLORER_BASE_LT_PER_HOUR_MAX, 315);

  const map12 = V14_EXPLORER_MAPS[11];
  const terrainHit = evaluateExplorerTerrainBonus(map12, { element: 'Quang' }, null);
  assert.equal(terrainHit.active, true);
  assert.equal(terrainHit.survivalBonus, 0.06);
  assert.equal(terrainHit.yieldBonus, 0.10);

  const survNoTerrain = computeExplorerSurvival(81650, map12.recommended_power, null, 0);
  const survWithTerrain = computeExplorerSurvival(81650, map12.recommended_power, 'food_survival_pill', terrainHit.survivalBonus);
  assert.equal(survNoTerrain.tooWeak, false);
  assert.ok(survWithTerrain.survivalPct === survNoTerrain.survivalPct + 14);

  const pwrNoDom = computeExplorerLoadoutPower({ pet_type: 'hoa_diem_ho', element: 'Hỏa', level: 100, star: 10, atk: 3000, def: 3000, spd: 3000, enchant_grade: 'A' }, [
    { item_id: 'weapon_common_1', enchant_grade: 'A' },
  ], null, {});
  assert.ok(pwrNoDom > 10000);
});

test('Ver 1.5 Rebalance: Spirit Vein tiers 8k->135k and Boss AoE 35% backline splash', async () => {
  const fTier = V14_SPIRIT_VEIN_TIERS.find((t) => t.tier_code === 'F');
  const spTier = V14_SPIRIT_VEIN_TIERS.find((t) => t.tier_code === 'S+');
  assert.equal(fTier.boss_power, 8000);
  assert.equal(spTier.boss_power, 135000);
  assert.equal(spTier.aoe_splash_pct, 0.35);

  const unitTemplate = (id, name) => ({
    id,
    name,
    atk: 4000,
    def: 3500,
    spd: 2000,
    maxHp: 50000,
    currentHp: 50000,
    shield: 0,
    critRate: 0.1,
    powerScore: 30000,
    pet: { pet_type: 'hoa_thach_nham_nham', pet_name: name, element: 'Thổ', level: 50, star: 5, rarity: 'Linh Phẩm' },
    equipment: {},
    domainLoadout: {},
  });
  const teamA = [unitTemplate('u1', 'Tank1'), unitTemplate('u2', 'Back2'), unitTemplate('u3', 'Back3')];
  const boss = {
    id: 'boss_sp',
    name: 'Boss S+',
    isBoss: true,
    atk: 15000,
    def: 10000,
    spd: 9000,
    maxHp: 200000,
    currentHp: 200000,
    shield: 0,
    critRate: 0.2,
    aoeSplashPct: 0.35,
    powerScore: 135000,
    pet: { pet_type: 'vein_mine_sp', pet_name: 'Ma Tôn', element: 'Ám', level: 100, star: 10, rarity: 'Thần Thoại' },
    equipment: {},
    domainLoadout: {},
  };

  const sim = await simulateTeamBattle(teamA, [boss], { preRender: false, maxTurns: 1, rng: () => 0.4 });
  const back2Hp = sim.teamA[1].currentHp;
  const back3Hp = sim.teamA[2].currentHp;
  assert.ok(back2Hp < 50000 && back3Hp < 50000, 'AoE 35% must damage surviving backline teammates');
});

test('Ver 1.5 Rebalance: Tower +15% LT, smooth curve & /updates 2.000 LT + /wiki clarity', async () => {
  assert.equal(computeTowerFloorRewardLt(1), 37);
  assert.equal(TOWER_MILESTONE_BONUSES[50].lt, 575);
  assert.equal(TOWER_MILESTONE_BONUSES[500].lt, 17250);

  const g500 = await buildTowerGuardian(500, () => 0.5);
  assert.ok(g500.powerScore >= 180000 && g500.powerScore <= 265000, `Unexpected F500 power: ${g500.powerScore}`);
  assert.equal(g500.isEvolved, true, 'F500 Boss must be Chân Thần evolved');
  assert.ok(g500.ultimateDef, 'F500 Boss must have Ultimate skill');

  const upd = getChangelogPayload('1.5');
  assert.equal(upd.ack_reward_lt, 2000);
  assert.match(upd.description, /Thuận Hệ Địa Hình/i);

  const wikiExp = getWikiData('explorer');
  assert.match(wikiExp.embed_flat.description, /Thuận Hệ Địa Hình/i);
  assert.match(wikiExp.embed_flat.description, /210–315 LT/);
});

test('Ver 1.5 UI: Normalized Kitsune avatar frame composites cleanly with Exterior Silhouette Mask', async () => {
  const overlay = await preloadAvatarFrameOverlay('frame_kitsune_mythic');
  assert.ok(overlay && overlay.width === 512 && overlay.height === 512);
  const c = createCanvas(200, 200);
  const ctx = c.getContext('2d');
  drawAntiAliasedAvatarWithBorder(ctx, null, 100, 100, 56, {
    isOwner: true,
    level: 100,
    username: 'Fuyumi',
    avatarFrame: 'frame_kitsune_mythic',
    frameOverlayImg: overlay,
  });
  const buf = c.toBuffer('image/png');
  assert.ok(buf.length > 5000);
});

test('Ver 1.5 UI: /inv hides backgrounds/frames/frame_unlock_token and /shop 0 LT auto-equips owned frames/backgrounds', async () => {
  const inv = await getInventory(FUYUMI_USER_ID, { view: 'overview' });
  assert.equal(inv.success, true);
  assert.match(inv.view_description, /\*\*Viền:\*\*/);
  for (const item of inv.consumables_and_unlocks || []) {
    assert.notEqual(item.item_category, 'background');
    assert.notEqual(item.item_id, 'frame_unlock_token');
    assert.ok(!String(item.item_id).startsWith('frame_'), `Cosmetic frame leaked into /inv: ${item.item_id}`);
  }

  const prev = await previewShopItem(FUYUMI_USER_ID, 'frames', 'frame_kitsune_mythic');
  assert.equal(prev.success, true);
  assert.equal(prev.already_owned, true);
  assert.equal(prev.price, 0);
  assert.equal(prev.can_afford, true);

  const equipRes = await buyShopItem(FUYUMI_USER_ID, { category: 'frames', itemId: 'frame_kitsune_mythic' });
  assert.equal(equipRes.success, true);
  assert.equal(equipRes.cost, 0);
  assert.equal(equipRes.equipped, true);
});

test('Ver 1.5 HAX: soul_mythic_1 converts resisted Charm into 10% maxHp true burn + -20% ATK (2 turns)', () => {
  const baseTarget = {
    id: 'fuyumi_test',
    petType: 'cuu_vi_hong_ho',
    atk: 1000,
    def: 1000,
    spd: 1000,
    maxHp: 50000,
    currentHp: 50000,
    equipment: { soul: { item_id: 'soul_mythic_1' } },
    domainLoadout: {},
    state: createInitialCombatState(),
  };

  // Case 1: CC-immune opponent (quang_minh_thanh_thu) resists Charm -> backlash 10% true HP + -20% ATK 2 turns
  const immuneActor = {
    id: 'immune_test',
    petType: 'quang_minh_thanh_thu',
    atk: 1000,
    def: 1000,
    spd: 1000,
    maxHp: 10000,
    currentHp: 10000,
    equipment: {},
    domainLoadout: {},
    state: createInitialCombatState(),
  };
  const resBacklash = triggerTurnStart(immuneActor, baseTarget, () => 0.01, 1);
  assert.equal(resBacklash.attackSelf, false);
  assert.equal(immuneActor.currentHp, 9000);
  assert.ok(immuneActor.state.atkDebuffPct >= 0.20);
  assert.ok(immuneActor.state.atkDebuffTurns >= 2);
  assert.ok(resBacklash.events.some((e) => e.action === 'charm_backlash'));

  // Case 2: Normal opponent (hoa_thach_nham_nham) gets charmed cleanly
  const normalActor = {
    id: 'normal_test',
    petType: 'hoa_thach_nham_nham',
    atk: 1000,
    def: 1000,
    spd: 1000,
    maxHp: 10000,
    currentHp: 10000,
    equipment: {},
    domainLoadout: {},
    state: createInitialCombatState(),
  };
  const resCharm = triggerTurnStart(normalActor, baseTarget, () => 0.01, 1);
  assert.equal(resCharm.attackSelf, true);
  assert.ok(resCharm.events.some((e) => e.action === 'charm'));
});

test('Ver 1.5 HAX Audit: stunned DoT ticks, team firstStrike, charm attackSelf, doubleTurn & ally start poison', () => {
  // 1. Stunned actor still takes Poison + Burn DoT while skipping turn
  const stunnedVictim = {
    id: 'victim_stun_dot',
    petType: 'hoa_thach_nham_nham',
    atk: 1000,
    def: 1000,
    spd: 1000,
    maxHp: 10000,
    currentHp: 10000,
    equipment: {},
    domainLoadout: {},
    state: {
      ...createInitialCombatState(),
      isStunned: true,
      poisonActive: true,
      poisonPct: 0.08,
      burnTurns: 2,
      burnPct: 0.06,
    },
  };
  const dummyTarget = {
    id: 'dummy_target',
    petType: 'hoa_thach_nham_nham',
    atk: 1000,
    def: 1000,
    spd: 1000,
    maxHp: 10000,
    currentHp: 10000,
    equipment: {},
    domainLoadout: {},
    state: createInitialCombatState(),
  };
  const stunRes = triggerTurnStart(stunnedVictim, dummyTarget, () => 0.99, 4);
  assert.equal(stunRes.skipTurn, true);
  assert.equal(stunnedVictim.currentHp, 8600, 'Poison 8% (800) + Burn 6% (600) must tick even when stunned');
  assert.ok(stunRes.events.some((e) => e.action === 'dot' && e.skill.includes('Trúng Độc')));
  assert.ok(stunRes.events.some((e) => e.action === 'dot' && e.skill.includes('Thiêu Đốt')));
  assert.ok(stunRes.events.some((e) => e.action === 'turn_skip'));

  // 2. Team battle: v1.3 firstStrike pet acts before faster Boss + slot #2 ally soul_epic_2 poisons Boss
  const resTeam = simulateTeamBattle(
    [
      {
        id: 'p1',
        name: 'SlowFirstStrike',
        pet: { pet_type: 'cuu_thien_loi_de_ho', pet_name: 'Cửu Thiên Lôi Đế Hồ', element: 'Lôi', level: 3, star: 4 },
        equipment: {},
        atk: 2000,
        def: 1000,
        spd: 1200,
        maxHp: 15000,
      },
      {
        id: 'p2',
        name: 'AllyPoison',
        pet: { pet_type: 'hoa_thach_nham_nham', pet_name: 'Nham Nham', element: 'Thổ', level: 10, star: 2 },
        equipment: { soul: { item_id: 'soul_epic_2' } },
        atk: 1500,
        def: 1000,
        spd: 1000,
        maxHp: 12000,
      },
    ],
    [
      {
        id: 'boss1',
        name: 'FastBoss',
        isBoss: true,
        pet: { pet_type: 'vein_mine_d', pet_name: 'Thanh Mộc Cổ Mãng', element: 'Mộc', level: 60, star: 5 },
        equipment: {},
        atk: 3000,
        def: 2000,
        spd: 1800,
        maxHp: 65000,
      },
    ],
    { maxTurns: 1, rng: () => 0.99 },
  );
  const turn1Attacks = resTeam.turnSnapshots[1]?.events || [];
  const firstAttackIdx = turn1Attacks.findIndex((e) => e.includes('**SlowFirstStrike** →') || e.includes('**FastBoss** →'));
  assert.ok(firstAttackIdx >= 0 && turn1Attacks[firstAttackIdx].includes('**SlowFirstStrike** →'), 'firstStrike pet must strike before faster Boss');
  assert.ok(turn1Attacks.some((e) => e.includes('Trúng Độc (-5.200 HP, bỏ qua khiên)')), 'Slot #2 teammate soul_epic_2 must poison Boss');

  // 3a. Team battle: charm attackSelf makes actor hit itself
  const resCharmTeam = simulateTeamBattle(
    [
      {
        id: 'charmed_a',
        name: 'CharmedAttacker',
        pet: { pet_type: 'hoa_thach_nham_nham', pet_name: 'Nham', element: 'Thổ', level: 20, star: 3 },
        equipment: {},
        atk: 2500,
        def: 1000,
        spd: 3000,
        maxHp: 20000,
      },
    ],
    [
      {
        id: 'charmer_b',
        name: 'CharmerBoss',
        pet: { pet_type: 'hoa_thach_nham_nham', pet_name: 'Mị', element: 'Thổ', level: 20, star: 3 },
        equipment: { soul: { item_id: 'soul_mythic_1' } },
        atk: 1000,
        def: 1000,
        spd: 500,
        maxHp: 50000,
      },
    ],
    { maxTurns: 1, rng: () => 0.01 },
  );
  const charmEvents = resCharmTeam.turnSnapshots[1]?.events || [];
  assert.ok(charmEvents.some((e) => e.includes('CharmedAttacker') && e.includes('→ **CharmedAttacker**')), 'Charmed unit must hit itself in team battle');

  // 3b. Team battle: soul_mythic_2 doubleTurn strikes twice
  const resDoubleTeam = simulateTeamBattle(
    [
      {
        id: 'double_a',
        name: 'DoubleAttacker',
        pet: { pet_type: 'hoa_thach_nham_nham', pet_name: 'Nham', element: 'Thổ', level: 20, star: 3 },
        equipment: { soul: { item_id: 'soul_mythic_2' } },
        atk: 2500,
        def: 1000,
        spd: 3000,
        maxHp: 20000,
      },
    ],
    [
      {
        id: 'dummy_b',
        name: 'DummyBoss',
        pet: { pet_type: 'hoa_thach_nham_nham', pet_name: 'Mộc', element: 'Thổ', level: 20, star: 3 },
        equipment: {},
        atk: 1000,
        def: 1000,
        spd: 500,
        maxHp: 50000,
      },
    ],
    { maxTurns: 1, rng: () => 0.99 },
  );
  const doubleEvents = resDoubleTeam.turnSnapshots[1]?.events || [];
  assert.ok(doubleEvents.some((e) => e.includes('Liên Hoàn Đòn (Thêm Lượt)')), 'soul_mythic_2 must trigger double turn in team battle');
});

test('Ver 1.7.1 Tower Balance: early Domains/Senses/Realms, Chân Thần milestones (F150, F200-399, 100% Boss F400+), ±8% variance & F50-80 gate', async () => {
  const g1 = await buildTowerGuardian(1, () => 0.5);
  assert.equal(g1.domainLoadout.domain, null);
  assert.equal(g1.towerMeta.enchantGrade, 'D');

  const g45 = await buildTowerGuardian(45, () => 0.5);
  assert.ok(g45.domainLoadout.domain, 'F45+ must unlock Linh Vực');
  assert.equal(g45.towerMeta.enchantGrade, 'C');

  const g90 = await buildTowerGuardian(90, () => 0.5);
  assert.ok(g90.domainLoadout.sense, 'F90+ must unlock Thần Thức');
  assert.equal(g90.towerMeta.enchantGrade, 'B');

  const g150 = await buildTowerGuardian(150, () => 0.99);
  assert.equal(g150.isEvolved, true, 'F150 Boss must be guaranteed Chân Thần trial');
  assert.ok(g150.ultimateDef, 'F150 Chân Thần Boss must have Ultimate');

  const g160 = await buildTowerGuardian(160, () => 0.5);
  assert.ok(g160.domainLoadout.realm, 'F160+ must unlock Thần Cảnh');

  // Variance ±8% bounds: normal [0.92..1.08], boss [0.96..1.08]
  const gNormalLow = await buildTowerGuardian(101, () => 0.0);
  const gNormalHigh = await buildTowerGuardian(101, () => 0.9999);
  assert.ok(gNormalLow.towerMeta.randomVariance >= 0.92 && gNormalLow.towerMeta.randomVariance <= 0.921);
  assert.ok(gNormalHigh.towerMeta.randomVariance <= 1.08 && gNormalHigh.towerMeta.randomVariance >= 1.079);

  const gBoss405Low = await buildTowerGuardian(405, () => 0.0);
  assert.equal(gBoss405Low.isEvolved, true, 'F400+ Boss must be 100% Chân Thần even at rng=0');
  assert.ok(gBoss405Low.towerMeta.randomVariance >= 0.96, 'Boss variance min must be 0.96');

  const gBoss405High = await buildTowerGuardian(405, () => 0.9999);
  assert.equal(gBoss405High.isEvolved, true, 'F400+ Boss must be 100% Chân Thần even at rng=0.9999');
  assert.ok(gBoss405High.powerScore >= 145000, `F405 Boss power too low: ${gBoss405High.powerScore}`);
});

test('Ver 1.7.1 Wiki Glossary covers Sát Thương Thường, Phản Đòn 85% cap, Shield & Debuff caps within Discord embed limits', () => {
  const gl = getWikiData('glossary');
  assert.equal(gl.pages.length, 4);
  const allText = gl.pages.map((p) => {
    let totalLen = (p.subtitle || '').length;
    for (const f of p.fields) {
      assert.ok(f.name.length <= 256, `Glossary field name too long: ${f.name.length}`);
      assert.ok(f.value.length <= 1024, `Glossary field value exceeds 1024 (${f.value.length}): ${f.name}`);
      totalLen += f.name.length + f.value.length;
    }
    assert.ok(totalLen <= 5500, `Glossary page ${p.page} total length too high: ${totalLen}`);
    return p.fields.map((f) => `${f.name}\n${f.value}`).join('\n');
  }).join('\n');

  for (const kw of [
    'Sát Thương Thường',
    'Sát Thương Kỹ Năng',
    'Sát Thương Chuẩn',
    '85%',
    'Phản Đòn',
    'Kháng Phản Đòn',
    'Kháng ST Chuẩn',
    'Hấp Thụ ST thành Khiên',
    'Né Tránh',
    'Giảm ATK',
    'Giảm SPD',
    'Tịch Diệt',
    'Khóa HAX',
  ]) {
    assert.ok(allText.includes(kw), `Glossary missing keyword: ${kw}`);
  }
});
