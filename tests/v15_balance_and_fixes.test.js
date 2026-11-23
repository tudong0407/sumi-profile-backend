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
  assert.ok(g500.powerScore >= 110000 && g500.powerScore <= 150000, `Unexpected F500 power: ${g500.powerScore}`);

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
