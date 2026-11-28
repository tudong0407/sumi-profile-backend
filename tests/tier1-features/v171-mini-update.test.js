/**
 * tests/tier1-features/v171-mini-update.test.js
 * Comprehensive verification suite for SuMi Family Update Mini v1.7.1:
 * 1. /updates 1.7.1 (+800 LT), Tiến Hóa cost = 2 evo_crystal
 * 2. Tower reward (+15% & extra +10% on Boss T10, T20...)
 * 3. Gacha 0.60% (0.03% unique fixed + 0.57% × Luck)
 * 4. Explorer progress bar & multiline hub formatting
 * 5. Linh Mạch 4 mines, 90% Fatigue cap, SS..SSS+ tiers (SSS+ 1%, total 100%)
 * 6. /daily x2 LT (110–160) + 10-day LT stack (max 200%) + 7-day Luck stack (max 40%, reset on missed day)
 * 7. /thuongtra brew (3/day, 200-300 LT) & Ké Chén (<=2 guests, 2min, 3/day, +200-300 + Luck*5 LT)
 * 8. Giờ Hoàng Đạo (11h/17h/21h UTC+7, +10% Luck) & /thaplinhhuong (600-800 LT, +5..15% Luck) & Unified 5-Source Luck
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  LATEST_VERSION,
  getChangelogPayload,
  getUpdateAckReward,
} from '../../src/data/changelogs.js';
import { RARITY_TIERS } from '../../src/data/catalog.js';
import { V14_SPIRIT_VEIN_TIERS } from '../../src/data/v14ExpansionCatalog.js';
import { computeTowerFloorRewardLt } from '../../src/services/questService.js';
import {
  ROLL_FIXED_UNIQUE_PCT,
  ROLL_BASE_NON_UNIQUE_MYTHIC_PCT,
  rollRarityWithUniqueSplit,
  DAILY_BASE_MIN,
  DAILY_BASE_MAX,
  computeDailyLongStreakLtPct,
} from '../../src/services/economyService.js';
import {
  EVOLUTION_CRYSTAL_COST,
  __resetEvolutionTestStore,
  evolveUniquePet,
} from '../../src/services/evolutionService.js';
import {
  buildExplorerProgressBar,
} from '../../src/services/explorerService.js';
import {
  VEIN_SLOTS_PER_HOUR,
  FATIGUE_MAX_PCT,
  FATIGUE_GAIN_PER_CAPTURE,
  FATIGUE_PVP_ROBBED_HEAL,
} from '../../src/services/spiritVeinService.js';
import { applyFatigueToCombatant } from '../../src/services/battleEngine/teamBattleService.js';
import {
  __setLuckTestStore,
  getAuspiciousHourInfo,
  computeDailyStreakLuckPct,
  computeSpiritIncenseCostLt,
  getEffectiveLuckAndFortune,
  lightSpiritIncense,
  formatLuckSummaryLines,
} from '../../src/services/luckAndFortuneService.js';
import {
  __resetTeaHouseTestStore,
  brewTea,
  joinTeaPot,
  TEA_MAX_BREWS_PER_DAY,
  TEA_MAX_GUESTS_PER_POT,
  TEA_MAX_GUEST_JOINS_PER_DAY,
} from '../../src/services/teaHouseService.js';

test('1. Ver 1.7.1 changelog & ack reward (+800 LT) + Evolution cost = 2 crystals', async () => {
  assert.equal(LATEST_VERSION, '1.7.1');
  assert.equal(getUpdateAckReward('1.7.1'), 800);
  const log = getChangelogPayload('1.7.1');
  assert.equal(log.success, true);
  assert.equal(log.ack_reward_lt, 800);
  assert.ok(log.description.includes('2 Hồng Mông Tiến Hóa Tinh'));
  assert.equal(EVOLUTION_CRYSTAL_COST, 2);

  __resetEvolutionTestStore({
    evoUser1: {
      linh_thach: 50000,
      inventory: { evo_crystal: 1 },
      pets: [{
        pet_id: 'p_1',
        pet_type: 'hon_don_chi_to_long',
        pet_name: 'Hỗn Độn Chi Tổ Long',
        level: 40,
        star: 8,
        enchant_grade: 'S',
        status: 'ready',
        is_evolved: false,
      }],
    },
  });
  const missingCrystal = await evolveUniquePet('evoUser1', { petId: 'p_1', ltTier: 5, forceSuccess: true });
  assert.equal(missingCrystal.success, false);
  assert.equal(missingCrystal.error, 'MISSING_EVO_CRYSTAL');

  __resetEvolutionTestStore({
    evoUser2: {
      linh_thach: 50000,
      inventory: { evo_crystal: 3 },
      pets: [{
        pet_id: 'p_2',
        pet_type: 'hon_don_chi_to_long',
        pet_name: 'Hỗn Độn Chi Tổ Long',
        level: 40,
        star: 8,
        enchant_grade: 'S',
        status: 'ready',
        is_evolved: false,
      }],
    },
  });
  const okEvo = await evolveUniquePet('evoUser2', { petId: 'p_2', ltTier: 5, forceSuccess: true });
  assert.equal(okEvo.success, true);
  assert.equal(okEvo.evolved, true);
  assert.equal(okEvo.evo_crystal_remaining, 1);
  __resetEvolutionTestStore(null);
});

test('2. Tower floor LT keeps +15% & adds +10% on Boss floors divisible by 10', () => {
  // Floor 1: base 22 + 10 = 32 * 1.15 = 37
  assert.equal(computeTowerFloorRewardLt(1), 37);
  // Floor 5 (Boss, not % 10): ((20+10)*2 + 10)*1.15 = 70*1.15 = 81
  assert.equal(computeTowerFloorRewardLt(5), 81);
  // Floor 10 (Boss % 10): ((20+20)*2 + 10)*1.15*1.10 = 90*1.15*1.10 = 113.85 -> 114
  assert.equal(computeTowerFloorRewardLt(10), 114);
  // Floor 20 (Boss % 10): ((20+40)*2 + 10)*1.15*1.10 = 130*1.15*1.10 = 164.45 -> 164
  assert.equal(computeTowerFloorRewardLt(20), 164);
});

test('3. Gacha rate adjusted to 0.60% (0.03% unique fixed + 0.57% regular * Luck)', () => {
  assert.equal(RARITY_TIERS.mythic.dropRate, 0.6);
  assert.equal(RARITY_TIERS.common.dropRate, 60.4);
  assert.equal(ROLL_FIXED_UNIQUE_PCT, 0.03);
  assert.equal(ROLL_BASE_NON_UNIQUE_MYTHIC_PCT, 0.57);
  assert.equal(Number((ROLL_FIXED_UNIQUE_PCT + ROLL_BASE_NON_UNIQUE_MYTHIC_PCT).toFixed(4)), 0.6);

  // rng = 0.00025 => r = 0.025 < 0.03 => unique mythic regardless of luckMult
  const uRoll = rollRarityWithUniqueSplit(() => 0.00025, 3);
  assert.equal(uRoll.rarityKey, 'mythic');
  assert.equal(uRoll.naturalWantUnique, true);

  // rng = 0.0061 => r = 0.61 >= 0.60 at 1x luck => epic; at 2x luck (cut = 0.03 + 1.14 = 1.17) => mythic non-unique
  assert.equal(rollRarityWithUniqueSplit(() => 0.0061, 1).rarityKey, 'epic');
  const boosted = rollRarityWithUniqueSplit(() => 0.0061, 2);
  assert.equal(boosted.rarityKey, 'mythic');
  assert.equal(boosted.naturalWantUnique, false);
});

test('4. Explorer progress bar renders 0% idle, shaded mid-progress, and 100% claimable', () => {
  const idle = buildExplorerProgressBar(null);
  assert.equal(idle.pct, 0);
  assert.equal(idle.bar, '░░░░░░░░░░');

  const start = new Date('2026-11-28T05:00:00Z');
  const end = new Date('2026-11-28T07:00:00Z');
  const mid = buildExplorerProgressBar({ started_at: start.toISOString(), ends_at: end.toISOString(), duration_hours: 2 }, new Date('2026-11-28T06:00:00Z'));
  assert.equal(mid.pct, 50);
  assert.equal(mid.bar, '▓▓▓▓▓░░░░░');

  const done = buildExplorerProgressBar({ started_at: start.toISOString(), ends_at: end.toISOString(), duration_hours: 2 }, new Date('2026-11-28T07:05:00Z'));
  assert.equal(done.pct, 100);
  assert.equal(done.bar, '▓▓▓▓▓▓▓▓▓▓');
});

test('5. Linh Mach: 4 mines/hour, 90% Fatigue cap, SS..SSS+ bosses & weight sum = 100%', () => {
  assert.equal(VEIN_SLOTS_PER_HOUR, 4);
  assert.equal(FATIGUE_MAX_PCT, 90);
  assert.equal(FATIGUE_GAIN_PER_CAPTURE, 25);
  assert.equal(FATIGUE_PVP_ROBBED_HEAL, 15);

  const totalWeight = V14_SPIRIT_VEIN_TIERS.reduce((s, t) => s + t.spawn_weight, 0);
  assert.equal(totalWeight, 100);
  assert.equal(V14_SPIRIT_VEIN_TIERS.length, 12);

  const byCode = Object.fromEntries(V14_SPIRIT_VEIN_TIERS.map((t) => [t.tier_code, t]));
  assert.equal(byCode.F.boss_power, 8400);
  assert.equal(byCode['S+'].boss_power, 141750);
  assert.equal(byCode.SS.boss_power, 240000);
  assert.equal(byCode['SS+'].boss_power, 380000);
  assert.equal(byCode.SSS.boss_power, 560000);
  assert.equal(byCode['SSS+'].boss_power, 850000);
  assert.equal(byCode['SSS+'].spawn_weight, 1);

  const unit90 = applyFatigueToCombatant({ atk: 1000, def: 1000, spd: 1000, maxHp: 10000, powerScore: 10000 }, { fatiguePct: 90 });
  assert.equal(unit90.fatiguePct, 90);
  assert.equal(unit90.fatigueStacks, 4);
  assert.equal(unit90.atk, 100);
  assert.equal(unit90.powerScore, 1000);
});

test('6. /daily x2 base (110-160), +5% LT/10d (max 200%), +2% Luck/7d (max 40%, reset on break)', () => {
  assert.equal(DAILY_BASE_MIN, 110);
  assert.equal(DAILY_BASE_MAX, 160);
  assert.equal(computeDailyLongStreakLtPct(9), 0);
  assert.equal(computeDailyLongStreakLtPct(10), 5);
  assert.equal(computeDailyLongStreakLtPct(100), 50);
  assert.equal(computeDailyLongStreakLtPct(400), 200);
  assert.equal(computeDailyLongStreakLtPct(999), 200);

  // UTC+7 time check: 2026-11-28T10:00:00+07:00
  const now = new Date('2026-11-28T03:00:00Z');
  const yesterday = new Date('2026-11-27T10:00:00Z').toISOString();
  const missedDay = new Date('2026-11-26T10:00:00Z').toISOString();

  assert.equal(computeDailyStreakLuckPct({ streak: 7, last_daily: yesterday }, now), 2);
  assert.equal(computeDailyStreakLuckPct({ streak: 21, last_daily: now.toISOString() }, now), 6);
  assert.equal(computeDailyStreakLuckPct({ streak: 140, last_daily: yesterday }, now), 40);
  assert.equal(computeDailyStreakLuckPct({ streak: 200, last_daily: yesterday }, now), 40);
  assert.equal(computeDailyStreakLuckPct({ streak: 70, last_daily: missedDay }, now), 0);
});

test('7. Giờ Hoàng Đạo (+10%), /thaplinhhuong (600-800 LT, +5..15% Luck) & Unified 5-source Luck sync', async () => {
  // 11:15 UTC+7 = 04:15 UTC => active Auspicious Hour
  const auspiciousNow = new Date('2026-11-28T04:15:00Z');
  const normalNow = new Date('2026-11-28T06:15:00Z'); // 13:15 UTC+7 => inactive
  assert.equal(getAuspiciousHourInfo(auspiciousNow).isActive, true);
  assert.equal(getAuspiciousHourInfo(auspiciousNow).luckPct, 10);
  assert.equal(getAuspiciousHourInfo(normalNow).isActive, false);

  assert.equal(computeSpiritIncenseCostLt(0), 800);
  assert.equal(computeSpiritIncenseCostLt(50), 700);
  assert.equal(computeSpiritIncenseCostLt(100), 600);
  assert.equal(computeSpiritIncenseCostLt(150), 600);

  __setLuckTestStore({
    u_luck_1: {
      linh_thach: 5000,
      streak: 35, // +10% streak luck
      last_daily: normalNow.toISOString(),
      potion: { potion_id: 'potion_luck_minor', luck_bonus_pct: 20, remaining_charges: 10 },
      fortune: { fortune_date: '2026-11-28', tier_key: 'dai_cat', exp_pct: 15, lt_pct: 15, luck_pct: 25, rerolled: false },
    },
  });

  // Base luck during 11h Auspicious Hour: 20 (potion) + 25 (fortune) + 10 (streak 35d) + 10 (auspicious) = 65%
  const before = await getEffectiveLuckAndFortune('u_luck_1', auspiciousNow);
  assert.equal(before.totalLuckPct, 65);
  assert.equal(before.nonPotionLuckPct, 45);
  assert.equal(computeSpiritIncenseCostLt(before.totalLuckPct), 670); // 800 - 65*2 = 670

  const lit = await lightSpiritIncense('u_luck_1', { now: auspiciousNow, forceBonusPct: 12 });
  assert.equal(lit.success, true);
  assert.equal(lit.fee_lt, 670);
  assert.equal(lit.incense_luck_pct, 12);
  assert.equal(lit.total_luck_pct, 77);
  assert.ok(formatLuckSummaryLines(lit.luck_info).includes('+77%'));

  // Re-lighting same day returns already_lit
  const relit = await lightSpiritIncense('u_luck_1', { now: auspiciousNow });
  assert.equal(relit.success, true);
  assert.equal(relit.already_lit, true);
  assert.equal(relit.incense_luck_pct, 12);

  __setLuckTestStore(null);
});

test('8. /thuongtra Tea House: 3 brews/day, max 2 distinct guests within 2m, %Luck*5 bonus for both', async () => {
  const now = new Date('2026-11-28T06:00:00Z'); // 13:00 UTC+7 (no auspicious hour)
  __setLuckTestStore({
    host1: { linh_thach: 0, streak: 35, last_daily: now.toISOString(), fortune: { fortune_date: '2026-11-28', tier_key: 'cat_loi', exp_pct: 10, lt_pct: 10, luck_pct: 10 }, incense_date: '2026-11-28', incense_luck_pct: 10 }, // 10+10+10 = 30% Luck
    guest1: { linh_thach: 0, streak: 70, last_daily: now.toISOString() }, // 20% Luck
    guest2: { linh_thach: 0, streak: 0, last_daily: null }, // 0% Luck
    guest3: { linh_thach: 0, streak: 0, last_daily: null },
  });
  __resetTeaHouseTestStore({
    host1: { linh_thach: 0 },
    guest1: { linh_thach: 0 },
    guest2: { linh_thach: 0 },
    guest3: { linh_thach: 0 },
  });

  // Override RNG = 0 => 200 LT base
  const pot = await brewTea('host1', { now, rng: () => 0 });
  assert.equal(pot.success, true);
  assert.equal(pot.host_brew_lt, 200);
  assert.equal(pot.host_luck_pct, 30);

  // Self-join blocked
  const selfJoin = await joinTeaPot(pot.session_key, 'host1', { now });
  assert.equal(selfJoin.success, false);
  assert.equal(selfJoin.error, 'CANNOT_JOIN_OWN_TEA');

  // Guest 1 joins: base 200 + 20%*5=100 => 300 LT; Host gets 200 + 30%*5=150 => 350 LT
  const j1 = await joinTeaPot(pot.session_key, 'guest1', { now, rng: () => 0 });
  assert.equal(j1.success, true);
  assert.equal(j1.guest_reward.total_lt, 300);
  assert.equal(j1.host_reward.total_lt, 350);
  assert.equal(j1.should_disable_button, false);

  // Duplicate join blocked
  const dupJoin = await joinTeaPot(pot.session_key, 'guest1', { now });
  assert.equal(dupJoin.success, false);
  assert.equal(dupJoin.error, 'ALREADY_JOINED_POT');

  // Guest 2 joins => pot fills 2/2 and disables button
  const j2 = await joinTeaPot(pot.session_key, 'guest2', { now, rng: () => 0 });
  assert.equal(j2.success, true);
  assert.equal(j2.is_full, true);
  assert.equal(j2.should_disable_button, true);
  assert.equal(j2.guest_reward.total_lt, 200);
  assert.equal(j2.host_reward.total_lt, 350);

  // Guest 3 blocked because pot is full
  const j3 = await joinTeaPot(pot.session_key, 'guest3', { now });
  assert.equal(j3.success, false);
  assert.equal(j3.error, 'TEA_POT_FULL');

  // Expired pot blocked (> 2 mins)
  const pot2 = await brewTea('host1', { now, rng: () => 0 });
  const pot3 = await brewTea('host1', { now, rng: () => 0 });
  assert.equal(pot2.success, true);
  assert.equal(pot3.success, true);
  const pot4 = await brewTea('host1', { now });
  assert.equal(pot4.success, false);
  assert.equal(pot4.error, 'TEA_BREW_LIMIT_REACHED');

  const expiredJoin = await joinTeaPot(pot2.session_key, 'guest3', { now: new Date(now.getTime() + 125000) });
  assert.equal(expiredJoin.success, false);
  assert.equal(expiredJoin.error, 'TEA_SESSION_EXPIRED');

  // Verify max caps exist cleanly
  assert.equal(TEA_MAX_BREWS_PER_DAY, 3);
  assert.equal(TEA_MAX_GUESTS_PER_POT, 2);
  assert.equal(TEA_MAX_GUEST_JOINS_PER_DAY, 3);

  __resetTeaHouseTestStore(null);
  __setLuckTestStore(null);
});
