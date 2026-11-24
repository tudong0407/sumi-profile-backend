/**
 * src/services/questService.js
 * Hệ thống Nhiệm Vụ Ngày xoay vòng & Tháp Thí Luyện 500 Tầng (/nhiemvu):
 * - 5 Nhiệm Vụ Hàng Ngày (UTC+7): 2 cố định (/daily, 150 EXP) + 3 xoay vòng ngẫu nhiên từ Pool 10 hoạt động.
 *   Thưởng +10% (17/22/28... LT + mốc 5/5: +130 LT + 1 Vé Pháp Bảo + 1 Tinh Thạch + 1 Đá Khắc Ấn).
 * - 3 Hợp Đồng Tuần (Reset Thứ Hai 00:00 UTC+7).
 * - Tháp Thí Luyện PvE 500 Tầng: buff +10% nền, random chiến lực ±12%, Linh Vực từ F70 (+ Thần Thức F150, Thần Cảnh F250).
 */

import { supabase } from '../config/supabase.js';
import {
  PET_CATALOG,
  EQUIPMENT_CATALOG,
  DOMAIN_CATALOG,
  DIVINE_SENSE_CATALOG,
  DIVINE_REALM_CATALOG,
  WEEKLY_CONTRACTS_CONFIG,
  PUBLIC_BASE_URL,
  computeCosmeticBuffTotals,
} from '../data/catalog.js';
import { em, uiEm } from '../config/emojiHelper.js';
import { sanitizeUserId, ensureUserInitialized, pickCleanDisplayValue } from './profileService.js';
import { compileCombatant } from './battleEngine/statsCompiler.js';
import { simulateBattle } from './battleEngine/battleService.js';
import { getEffectiveLuckAndFortune } from './luckAndFortuneService.js';

export const DAILY_QUEST_EXP_TARGET = 150;
export const DAILY_QUEST_WINS_TARGET = 3;
export const DAILY_QUEST_BATTLE_TARGET = DAILY_QUEST_WINS_TARGET;
export const DAILY_QUEST_JOBS_TARGET = 2;
export const DAILY_QUEST_ACTIVITY_TARGET = 1;
export const DAILY_QUEST_REWARD_LT = 130;

export const FIXED_DAILY_QUESTS = {
  daily: { id: 'daily', name: 'Điểm danh /daily hôm nay', target: 1, rewardLt: 17 },
  exp: { id: 'exp', name: `Tích lũy ${DAILY_QUEST_EXP_TARGET} EXP Chat/Voice`, target: DAILY_QUEST_EXP_TARGET, rewardLt: 22 },
};

export const ROTATING_DAILY_QUEST_POOL = [
  { id: 'wins', name: `Chiến thắng ${DAILY_QUEST_WINS_TARGET} trận /battle hoặc Tháp`, target: DAILY_QUEST_WINS_TARGET, rewardLt: 28 },
  { id: 'tower', name: 'Khiêu chiến 2 lượt Tháp Thí Luyện', target: 2, rewardLt: 24 },
  { id: 'jobs', name: `Hoàn thành ${DAILY_QUEST_JOBS_TARGET} ca Làm Việc (/job)`, target: DAILY_QUEST_JOBS_TARGET, rewardLt: 22 },
  { id: 'roll', name: 'Triệu hồi /roll ít nhất 1 lượt', target: 1, rewardLt: 22 },
  { id: 'farm', name: 'Trồng hoặc chăm sóc /farm 1 lần', target: 1, rewardLt: 22 },
  { id: 'minigame', name: 'Chơi 2 ván Minigame bất kỳ', target: 2, rewardLt: 22 },
  { id: 'explorer', name: 'Khởi hành hoặc nhận quà /explorer 1 lần', target: 1, rewardLt: 26 },
  { id: 'craft', name: 'Thực hiện 1 lần /enchant hoặc /dismantle', target: 1, rewardLt: 22 },
  { id: 'shop', name: 'Mua 1 vật phẩm tại /shop (hoặc Shop Ngày)', target: 1, rewardLt: 22 },
  { id: 'battles', name: 'Tham gia 3 trận /battle bất kỳ', target: 3, rewardLt: 22 },
];

export const ALL_DAILY_QUESTS_BY_ID = Object.fromEntries([
  ...Object.values(FIXED_DAILY_QUESTS).map((q) => [q.id, q]),
  ...ROTATING_DAILY_QUEST_POOL.map((q) => [q.id, q]),
]);

export const DAILY_QUESTS_CONFIG = {
  q1: { id: 'daily', col: 'daily_claimed_q1', ...FIXED_DAILY_QUESTS.daily },
  q2: { id: 'exp', col: 'daily_claimed_q2', ...FIXED_DAILY_QUESTS.exp },
  q3: { id: 'wins', col: 'daily_claimed_q3', ...ROTATING_DAILY_QUEST_POOL[0] },
  q4: { id: 'jobs', col: 'daily_claimed_q4', ...ROTATING_DAILY_QUEST_POOL[2] },
  q5: { id: 'activity', col: 'daily_claimed_q5', name: 'Chăm sóc /farm hoặc chơi 1 ván Minigame', target: 1, rewardLt: 22 },
};

export function selectDailyQuestIds(userId, dateKey) {
  const str = `${String(userId || '')}:${String(dateKey || '')}:v147`;
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const nextRand = () => {
    h = (Math.imul(h, 1664525) + 1013904223) >>> 0;
    return h / 4294967296;
  };
  const pool = ROTATING_DAILY_QUEST_POOL.map((q) => q.id);
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(nextRand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return ['daily', 'exp', pool[0], pool[1], pool[2]];
}

export const TOWER_MAX_FLOOR = 500;
export const TOWER_DAILY_ATTEMPTS_LIMIT = 5;
export const TOWER_WIN_BONUS_LT = 10;
export const TOWER_LOSS_PENALTY_LT = 5;
export const TOWER_COOLDOWN_MS = 20000;

const towerCooldowns = new Map();

function checkTowerCooldown(userId, nowMs = Date.now()) {
  const uid = String(userId || '').trim();
  if (!uid) return { blocked: false, waitSeconds: 0 };
  const lastAt = towerCooldowns.get(uid) || 0;
  const elapsed = nowMs - lastAt;
  if (lastAt > 0 && elapsed < TOWER_COOLDOWN_MS) {
    return { blocked: true, waitSeconds: Math.max(1, Math.ceil((TOWER_COOLDOWN_MS - elapsed) / 1000)) };
  }
  return { blocked: false, waitSeconds: 0 };
}

function markTowerCooldown(userId, nowMs = Date.now()) {
  const uid = String(userId || '').trim();
  if (!uid) return;
  towerCooldowns.set(uid, nowMs);
  if (towerCooldowns.size > 500) {
    const cutoff = nowMs - TOWER_COOLDOWN_MS * 2;
    for (const [k, ts] of towerCooldowns.entries()) {
      if (ts < cutoff) towerCooldowns.delete(k);
    }
  }
}

export function computeTowerFloorRewardLt(floor) {
  const f = Math.max(1, Number(floor) || 1);
  const isBoss = f % 5 === 0;
  const baseLt = (20 + Math.floor(f * 2)) * (isBoss ? 2 : 1) + TOWER_WIN_BONUS_LT;
  return Math.round(baseLt * 1.15);
}

export const TOWER_MILESTONE_BONUSES = {
  50: { lt: 575, enchantStones: 5, tickets: 0 },
  100: { lt: 1150, enchantStones: 10, tickets: 1 },
  150: { lt: 2300, enchantStones: 15, tickets: 2 },
  200: { lt: 4600, enchantStones: 22, tickets: 3 },
  250: { lt: 6325, enchantStones: 28, tickets: 4 },
  300: { lt: 8050, enchantStones: 35, tickets: 5 },
  350: { lt: 9775, enchantStones: 40, tickets: 6 },
  400: { lt: 12075, enchantStones: 46, tickets: 7 },
  450: { lt: 14375, enchantStones: 52, tickets: 8 },
  500: { lt: 17250, enchantStones: 60, tickets: 10, absoluteStones: 1 },
};

const TOWER_BOSS_NAMES = [
  'Thạch Khôi Lỗi Thủ Vệ',
  'Hắc Phong Lang Vương',
  'Xích Diễm Hỏa Sư',
  'Huyền Thủy Giao Long',
  'Cửu U Ma Viên',
  'Thái Cổ Lôi Ưng',
];

const PUBLIC_TOWER_PETS_BY_RARITY = {
  common: PET_CATALOG.filter((p) => !p.is_exclusive_fuyumi && p.rarity_key === 'common'),
  rare: PET_CATALOG.filter((p) => !p.is_exclusive_fuyumi && p.rarity_key === 'rare'),
  epic: PET_CATALOG.filter((p) => !p.is_exclusive_fuyumi && p.rarity_key === 'epic'),
  mythic: PET_CATALOG.filter((p) => !p.is_exclusive_fuyumi && p.rarity_key === 'mythic'),
  mythic_free: PET_CATALOG.filter((p) => !p.is_exclusive_fuyumi && p.rarity_key === 'mythic' && !p.is_unique),
  mythic_unique: PET_CATALOG.filter((p) => !p.is_exclusive_fuyumi && p.rarity_key === 'mythic' && p.is_unique),
};

const TOWER_EQUIP_BY_TIER_SLOT = {
  common: {
    weapon: EQUIPMENT_CATALOG.filter((e) => !e.is_exclusive_fuyumi && e.rarity_key === 'common' && e.item_type === 'weapon'),
    gem: EQUIPMENT_CATALOG.filter((e) => !e.is_exclusive_fuyumi && e.rarity_key === 'common' && e.item_type === 'gem'),
    soul: EQUIPMENT_CATALOG.filter((e) => !e.is_exclusive_fuyumi && e.rarity_key === 'common' && e.item_type === 'soul'),
  },
  rare: {
    weapon: EQUIPMENT_CATALOG.filter((e) => !e.is_exclusive_fuyumi && e.rarity_key === 'rare' && e.item_type === 'weapon'),
    gem: EQUIPMENT_CATALOG.filter((e) => !e.is_exclusive_fuyumi && e.rarity_key === 'rare' && e.item_type === 'gem'),
    soul: EQUIPMENT_CATALOG.filter((e) => !e.is_exclusive_fuyumi && e.rarity_key === 'rare' && e.item_type === 'soul'),
  },
  epic: {
    weapon: EQUIPMENT_CATALOG.filter((e) => !e.is_exclusive_fuyumi && e.rarity_key === 'epic' && e.item_type === 'weapon'),
    gem: EQUIPMENT_CATALOG.filter((e) => !e.is_exclusive_fuyumi && e.rarity_key === 'epic' && e.item_type === 'gem'),
    soul: EQUIPMENT_CATALOG.filter((e) => !e.is_exclusive_fuyumi && e.rarity_key === 'epic' && e.item_type === 'soul'),
  },
  mythic: {
    weapon: EQUIPMENT_CATALOG.filter((e) => !e.is_exclusive_fuyumi && e.rarity_key === 'mythic' && e.item_type === 'weapon'),
    gem: EQUIPMENT_CATALOG.filter((e) => !e.is_exclusive_fuyumi && e.rarity_key === 'mythic' && e.item_type === 'gem'),
    soul: EQUIPMENT_CATALOG.filter((e) => !e.is_exclusive_fuyumi && e.rarity_key === 'mythic' && e.item_type === 'soul'),
  },
  mythic_free: {
    weapon: EQUIPMENT_CATALOG.filter((e) => !e.is_exclusive_fuyumi && e.rarity_key === 'mythic' && !e.is_unique && e.item_type === 'weapon'),
    gem: EQUIPMENT_CATALOG.filter((e) => !e.is_exclusive_fuyumi && e.rarity_key === 'mythic' && !e.is_unique && e.item_type === 'gem'),
    soul: EQUIPMENT_CATALOG.filter((e) => !e.is_exclusive_fuyumi && e.rarity_key === 'mythic' && !e.is_unique && e.item_type === 'soul'),
  },
  mythic_unique: {
    weapon: EQUIPMENT_CATALOG.filter((e) => !e.is_exclusive_fuyumi && e.rarity_key === 'mythic' && e.is_unique && e.item_type === 'weapon'),
    gem: EQUIPMENT_CATALOG.filter((e) => !e.is_exclusive_fuyumi && e.rarity_key === 'mythic' && e.is_unique && e.item_type === 'gem'),
    soul: EQUIPMENT_CATALOG.filter((e) => !e.is_exclusive_fuyumi && e.rarity_key === 'mythic' && e.is_unique && e.item_type === 'soul'),
  },
};

const TOWER_DOMAIN_POOLS = {
  common: DOMAIN_CATALOG.filter((d) => !d.is_exclusive_fuyumi && d.rarity_key === 'common'),
  rare: DOMAIN_CATALOG.filter((d) => !d.is_exclusive_fuyumi && d.rarity_key === 'rare'),
  epic: DOMAIN_CATALOG.filter((d) => !d.is_exclusive_fuyumi && d.rarity_key === 'epic'),
  mythic: DOMAIN_CATALOG.filter((d) => !d.is_exclusive_fuyumi && d.rarity_key === 'mythic'),
  mythic_free: DOMAIN_CATALOG.filter((d) => !d.is_exclusive_fuyumi && d.rarity_key === 'mythic' && !d.is_unique),
  mythic_unique: DOMAIN_CATALOG.filter((d) => !d.is_exclusive_fuyumi && d.rarity_key === 'mythic' && d.is_unique),
};

const TOWER_SENSE_POOLS = {
  public: DIVINE_SENSE_CATALOG.filter((s) => !s.is_exclusive_fuyumi),
  mythic: DIVINE_SENSE_CATALOG.filter((s) => !s.is_exclusive_fuyumi && s.rarity_key === 'mythic'),
};

const TOWER_REALM_POOLS = {
  public: DIVINE_REALM_CATALOG.filter((r) => !r.is_exclusive_fuyumi),
  mythic: DIVINE_REALM_CATALOG.filter((r) => !r.is_exclusive_fuyumi && r.rarity_key === 'mythic'),
};

const questLocks = new Map();

async function withQuestLock(userId, fn) {
  const prev = questLocks.get(userId) || Promise.resolve();
  let release;
  const current = new Promise((res) => { release = res; });
  const queued = prev.then(() => current);
  questLocks.set(userId, queued);
  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (questLocks.get(userId) === queued) questLocks.delete(userId);
  }
}

export function getVnDateKey(date = new Date()) {
  const vnTime = new Date(date.getTime() + 7 * 3600 * 1000);
  return vnTime.toISOString().slice(0, 10);
}

/**
 * Khóa tuần theo Thứ Hai 00:00 UTC+7 (YYYY-MM-DD của ngày Thứ Hai trong tuần đó)
 */
export function getVnWeekKey(date = new Date()) {
  const vnMs = date.getTime() + 7 * 3600 * 1000;
  const vnDate = new Date(vnMs);
  const diffToMonday = (vnDate.getUTCDay() + 6) % 7;
  const monday = new Date(vnMs - diffToMonday * 86400000);
  return monday.toISOString().slice(0, 10);
}

export async function addInventoryItem(userId, itemId, category, delta) {
  const { data: ex } = await supabase
    .from('user_inventory')
    .select('quantity')
    .eq('user_id', userId)
    .eq('item_id', itemId)
    .maybeSingle();
  const nextQty = Math.max(0, Number(ex?.quantity || 0) + delta);
  if (ex) {
    await supabase
      .from('user_inventory')
      .update({ quantity: nextQty, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('item_id', itemId);
  } else if (nextQty > 0) {
    await supabase.from('user_inventory').insert({
      user_id: userId,
      item_id: itemId,
      item_category: category,
      quantity: nextQty,
    });
  }
  return nextQty;
}

async function loadNormalizedQuestRow(cleanId, now = new Date()) {
  const todayKey = getVnDateKey(now);
  const weekKey = getVnWeekKey(now);
  const { data: row } = await supabase
    .from('user_quests')
    .select('*')
    .eq('user_id', cleanId)
    .maybeSingle();

  const sameQuestDay = row?.quest_date === todayKey;
  const sameJobDay = row?.job_date === todayKey;
  const sameTowerDay = row?.tower_attempts_date === todayKey;
  const sameWeek = row?.weekly_week_key === weekKey;

  const activeIds = (sameQuestDay && Array.isArray(row?.daily_quest_ids) && row.daily_quest_ids.length === 5)
    ? row.daily_quest_ids.map((x) => String(x))
    : selectDailyQuestIds(cleanId, todayKey);
  const rawProg = (sameQuestDay && row?.daily_progress && typeof row.daily_progress === 'object')
    ? row.daily_progress
    : {};

  return {
    exists: Boolean(row),
    quest_date: todayKey,
    daily_claimed_at: sameQuestDay ? row?.daily_claimed_at || null : null,
    daily_quest_ids: activeIds,
    daily_progress: {
      tower: Number(rawProg.tower || 0),
      roll: Number(rawProg.roll || 0),
      farm: Number(rawProg.farm || 0),
      minigame: Number(rawProg.minigame || 0),
      explorer: Number(rawProg.explorer || 0),
      craft: Number(rawProg.craft || 0),
      shop: Number(rawProg.shop || 0),
    },
    chat_exp_today: sameQuestDay ? Number(row?.chat_exp_today || 0) : 0,
    battles_today: sameQuestDay ? Number(row?.battles_today || 0) : 0,
    wins_today: sameQuestDay ? Number(row?.wins_today || 0) : 0,
    farm_or_mg_today: sameQuestDay ? Number(row?.farm_or_mg_today || 0) : 0,
    jobs_today: sameJobDay ? Number(row?.jobs_today || 0) : 0,
    daily_claimed_q1: sameQuestDay ? Boolean(row?.daily_claimed_q1) : false,
    daily_claimed_q2: sameQuestDay ? Boolean(row?.daily_claimed_q2) : false,
    daily_claimed_q3: sameQuestDay ? Boolean(row?.daily_claimed_q3) : false,
    daily_claimed_q4: sameQuestDay ? Boolean(row?.daily_claimed_q4) : false,
    daily_claimed_q5: sameQuestDay ? Boolean(row?.daily_claimed_q5) : false,
    tower_floor: Number(row?.tower_floor || 0),
    tower_attempts_date: todayKey,
    tower_attempts_today: sameTowerDay ? Number(row?.tower_attempts_today || 0) : 0,
    weekly_week_key: weekKey,
    weekly_jobs_done: sameWeek ? Number(row?.weekly_jobs_done || 0) : 0,
    weekly_battle_wins: sameWeek ? Number(row?.weekly_battle_wins || 0) : 0,
    weekly_exp_earned: sameWeek ? Number(row?.weekly_exp_earned || 0) : 0,
    weekly_claimed_jobs: sameWeek ? Boolean(row?.weekly_claimed_jobs) : false,
    weekly_claimed_wins: sameWeek ? Boolean(row?.weekly_claimed_wins) : false,
    weekly_claimed_exp: sameWeek ? Boolean(row?.weekly_claimed_exp) : false,
    weekly_bonus_claimed: sameWeek ? Boolean(row?.weekly_bonus_claimed) : false,
  };
}

function buildQuestUpsertPayload(cleanId, state, overrides = {}, nowIso = new Date().toISOString()) {
  return {
    user_id: cleanId,
    quest_date: state.quest_date,
    daily_claimed_at: state.daily_claimed_at,
    daily_quest_ids: state.daily_quest_ids,
    daily_progress: state.daily_progress,
    chat_exp_today: state.chat_exp_today,
    battles_today: state.battles_today,
    wins_today: state.wins_today,
    farm_or_mg_today: state.farm_or_mg_today,
    daily_claimed_q1: state.daily_claimed_q1,
    daily_claimed_q2: state.daily_claimed_q2,
    daily_claimed_q3: state.daily_claimed_q3,
    daily_claimed_q4: state.daily_claimed_q4,
    daily_claimed_q5: state.daily_claimed_q5,
    tower_floor: state.tower_floor,
    tower_attempts_date: state.tower_attempts_date,
    tower_attempts_today: state.tower_attempts_today,
    weekly_week_key: state.weekly_week_key,
    weekly_jobs_done: state.weekly_jobs_done,
    weekly_battle_wins: state.weekly_battle_wins,
    weekly_exp_earned: state.weekly_exp_earned,
    weekly_claimed_jobs: state.weekly_claimed_jobs,
    weekly_claimed_wins: state.weekly_claimed_wins,
    weekly_claimed_exp: state.weekly_claimed_exp,
    weekly_bonus_claimed: state.weekly_bonus_claimed,
    updated_at: nowIso,
    ...overrides,
  };
}

function resolveDailyQuestProgress(qid, state, dailyDone) {
  switch (qid) {
    case 'daily': return dailyDone ? 1 : 0;
    case 'exp': return Number(state.chat_exp_today || 0);
    case 'wins': return Number(state.wins_today || 0);
    case 'jobs': return Number(state.jobs_today || 0);
    case 'battles': return Number(state.battles_today || 0);
    case 'activity': return Number(state.farm_or_mg_today || 0);
    default: return Number(state.daily_progress?.[qid] || 0);
  }
}

/**
 * Ghi nhận tiến độ nhiệm vụ hàng ngày & Hợp Đồng Tuần (non-blocking).
 */
export async function trackQuestActivity(
  userId,
  {
    expDelta = 0,
    battleDelta = 0,
    winDelta = 0,
    jobDelta = 0,
    activityDelta = 0,
    towerDelta = 0,
    rollDelta = 0,
    farmDelta = 0,
    minigameDelta = 0,
    explorerDelta = 0,
    craftDelta = 0,
    shopDelta = 0,
    now = new Date(),
  } = {},
) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId || !/^[0-9]{17,20}$/.test(cleanId) || !supabase) return null;

  try {
    return await withQuestLock(cleanId, async () => {
      const state = await loadNormalizedQuestRow(cleanId, now);
      const addExp = Math.max(0, Number(expDelta) || 0);
      const addBat = Math.max(0, Number(battleDelta) || 0);
      const addWin = Math.max(0, Number(winDelta) || 0);
      const addJob = Math.max(0, Number(jobDelta) || 0);
      const addAct = Math.max(0, Number(activityDelta) || 0);

      const nextProg = {
        tower: state.daily_progress.tower + Math.max(0, Number(towerDelta) || 0),
        roll: state.daily_progress.roll + Math.max(0, Number(rollDelta) || 0),
        farm: state.daily_progress.farm + Math.max(0, Number(farmDelta) || 0),
        minigame: state.daily_progress.minigame + Math.max(0, Number(minigameDelta) || 0),
        explorer: state.daily_progress.explorer + Math.max(0, Number(explorerDelta) || 0),
        craft: state.daily_progress.craft + Math.max(0, Number(craftDelta) || 0),
        shop: state.daily_progress.shop + Math.max(0, Number(shopDelta) || 0),
      };

      const nextExp = state.chat_exp_today + addExp;
      const nextBattles = state.battles_today + addBat;
      const nextWins = state.wins_today + addWin;
      const nextAct = state.farm_or_mg_today + addAct + Math.max(0, Number(farmDelta) || 0) + Math.max(0, Number(minigameDelta) || 0);
      const nextWeeklyExp = state.weekly_exp_earned + addExp;
      const nextWeeklyWins = state.weekly_battle_wins + addWin;
      const nextWeeklyJobs = state.weekly_jobs_done + addJob;
      const nowIso = now.toISOString();

      await supabase.from('user_quests').upsert(
        buildQuestUpsertPayload(cleanId, state, {
          daily_progress: nextProg,
          chat_exp_today: nextExp,
          battles_today: nextBattles,
          wins_today: nextWins,
          farm_or_mg_today: nextAct,
          weekly_jobs_done: nextWeeklyJobs,
          weekly_battle_wins: nextWeeklyWins,
          weekly_exp_earned: nextWeeklyExp,
        }, nowIso),
        { onConflict: 'user_id' },
      );

      return {
        daily_progress: nextProg,
        chat_exp_today: nextExp,
        battles_today: nextBattles,
        wins_today: nextWins,
        farm_or_mg_today: nextAct,
        weekly_jobs_done: nextWeeklyJobs,
        weekly_battle_wins: nextWeeklyWins,
        weekly_exp_earned: nextWeeklyExp,
      };
    });
  } catch {
    return null;
  }
}

export async function getQuestStatus(userId, options = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID người dùng không hợp lệ.' };
  if (!supabase) return { success: false, status: 503, error: 'DB_UNAVAILABLE', message: 'Supabase chưa sẵn sàng.' };

  const now = options.now instanceof Date ? options.now : new Date();
  const { user } = await ensureUserInitialized(cleanId, {
    username: pickCleanDisplayValue(options.username, options.fallbackUsername),
    avatarUrl: pickCleanDisplayValue(options.avatarUrl),
  });
  if (!user) return { success: false, status: 500, error: 'USER_INIT_FAILED', message: 'Không thể khởi tạo hồ sơ.' };

  const [state, resetCardRes, stoneRes] = await Promise.all([
    loadNormalizedQuestRow(cleanId, now),
    supabase.from('user_inventory').select('quantity').eq('user_id', cleanId).eq('item_id', 'tower_reset_card').maybeSingle(),
    supabase.from('user_inventory').select('quantity').eq('user_id', cleanId).eq('item_id', 'enchant_stone').maybeSingle(),
  ]);
  const ownedResetCards = Number(resetCardRes?.data?.quantity || 0);
  const ownedEnchantStones = Number(stoneRes?.data?.quantity || 0);
  const dailyDone = Boolean(user.last_daily && getVnDateKey(new Date(user.last_daily)) === state.quest_date);
  const claimedCols = ['daily_claimed_q1', 'daily_claimed_q2', 'daily_claimed_q3', 'daily_claimed_q4', 'daily_claimed_q5'];
  const quests = state.daily_quest_ids.map((qid, idx) => {
    const meta = ALL_DAILY_QUESTS_BY_ID[qid] || FIXED_DAILY_QUESTS.daily;
    const rawProg = resolveDailyQuestProgress(qid, state, dailyDone);
    const done = rawProg >= meta.target;
    const colKey = claimedCols[idx] || 'daily_claimed_q5';
    return {
      id: qid,
      slot_index: idx + 1,
      col: colKey,
      is_fixed: idx < 2,
      name: meta.name,
      progress: Math.min(rawProg, meta.target),
      target: meta.target,
      done,
      claimed: Boolean(state[colKey]) || Boolean(state.daily_claimed_at),
      reward_lt: meta.rewardLt,
    };
  });
  const allCompleted = quests.every((q) => q.done);
  const alreadyClaimed = Boolean(state.daily_claimed_at);
  const canClaimDaily = quests.some((q) => q.done && !q.claimed) || (allCompleted && !alreadyClaimed);

  const weeklyContracts = [
    {
      id: 'jobs',
      label: WEEKLY_CONTRACTS_CONFIG.jobs.label,
      progress: Math.min(state.weekly_jobs_done, WEEKLY_CONTRACTS_CONFIG.jobs.target),
      target: WEEKLY_CONTRACTS_CONFIG.jobs.target,
      done: state.weekly_jobs_done >= WEEKLY_CONTRACTS_CONFIG.jobs.target,
      claimed: state.weekly_claimed_jobs,
      rewardLt: WEEKLY_CONTRACTS_CONFIG.jobs.rewardLt,
      rewardStones: WEEKLY_CONTRACTS_CONFIG.jobs.rewardStones,
    },
    {
      id: 'wins',
      label: WEEKLY_CONTRACTS_CONFIG.wins.label,
      progress: Math.min(state.weekly_battle_wins, WEEKLY_CONTRACTS_CONFIG.wins.target),
      target: WEEKLY_CONTRACTS_CONFIG.wins.target,
      done: state.weekly_battle_wins >= WEEKLY_CONTRACTS_CONFIG.wins.target,
      claimed: state.weekly_claimed_wins,
      rewardLt: WEEKLY_CONTRACTS_CONFIG.wins.rewardLt,
      rewardStones: WEEKLY_CONTRACTS_CONFIG.wins.rewardStones,
    },
    {
      id: 'exp',
      label: WEEKLY_CONTRACTS_CONFIG.exp.label,
      progress: Math.min(state.weekly_exp_earned, WEEKLY_CONTRACTS_CONFIG.exp.target),
      target: WEEKLY_CONTRACTS_CONFIG.exp.target,
      done: state.weekly_exp_earned >= WEEKLY_CONTRACTS_CONFIG.exp.target,
      claimed: state.weekly_claimed_exp,
      rewardLt: WEEKLY_CONTRACTS_CONFIG.exp.rewardLt,
      rewardStones: WEEKLY_CONTRACTS_CONFIG.exp.rewardStones,
    },
  ];
  const weeklyAllDone = weeklyContracts.every((c) => c.done);
  const weeklyClaimable = weeklyContracts.some((c) => c.done && !c.claimed) || (weeklyAllDone && !state.weekly_bonus_claimed);

  const rawTab = String(options.tab || 'daily').trim().toLowerCase();
  const normalizedTab = rawTab === 'tower_view' ? 'tower' : rawTab;
  const activeTab = ['daily', 'weekly', 'tower', 'all'].includes(normalizedTab) ? normalizedTab : 'daily';

  const nowDate = new Date();
  const vnMs = nowDate.getTime() + 7 * 3600 * 1000;
  const dailyRemMs = 86400000 - (vnMs % 86400000);
  const dailyH = Math.floor(dailyRemMs / 3600000);
  const dailyM = Math.floor((dailyRemMs % 3600000) / 60000);
  const dailyResetIn = `${dailyH}G ${String(dailyM).padStart(2, '0')}P`;

  const vnDateObj = new Date(vnMs);
  const utcDay = vnDateObj.getUTCDay();
  const daysUntilMon = utcDay === 0 ? 1 : (8 - utcDay);
  const weeklyRemMs = (daysUntilMon - 1) * 86400000 + dailyRemMs;
  const weekD = Math.floor(weeklyRemMs / 86400000);
  const weekH = Math.floor((weeklyRemMs % 86400000) / 3600000);
  const weekM = Math.floor((weeklyRemMs % 3600000) / 60000);
  const weeklyResetIn = `${weekD}N ${weekH}G ${String(weekM).padStart(2, '0')}P`;

  const mark = (done, claimed = false) => (claimed ? `${em('su_medal_role')}` : done ? `${uiEm('ui_check')}` : `[ ]`);
  const nextFloor = Math.min(TOWER_MAX_FLOOR, state.tower_floor + 1);
  const bandStart = Math.floor((nextFloor - 1) / 100) * 100 + 1;
  const bandEnd = Math.min(TOWER_MAX_FLOOR, bandStart + 99);
  const nextTierName = nextFloor < 100
    ? 'Luyện Tháp Sơ Đỉnh (1–99)'
    : `Thần Cảnh Tầng ${bandStart}–${bandEnd}`;

  const dailyLines = [
    `**1. Nhiệm Vụ Hàng Ngày (${state.quest_date} • Làm mới sau \`${dailyResetIn}\`)**`,
    ...quests.map((q, idx) =>
      `${idx + 1}. ${mark(q.done, q.claimed)} **${q.name}**\n> \`▸ Thưởng:\` \`+${q.reward_lt}\` ${em('su_linhthach')}  •  \`▸ Tiến độ:\` \`[${q.progress}/${q.target}]\`${q.claimed ? ' — *Đã nhận*' : q.done ? ' — *Sẵn sàng nhận!*' : ''}`,
    ),
    `• **Thưởng Hoàn Tất 5/5:** \`+${DAILY_QUEST_REWARD_LT}\` ${em('su_linhthach')} • \`+1\` ${em('gacha_ticket_equip')} • \`+1\` ${em('pet_star_stone')} • \`+1\` ${em('enchant_stone')}`,
    alreadyClaimed
      ? `${em('su_sparkle')} **Trạng thái Ngày:** Đã nhận trọn bộ thưởng hôm nay!`
      : canClaimDaily
        ? `${em('su_sparkle')} **Trạng thái Ngày:** Đã hoàn tất! Bấm **Nhận Thưởng Ngày** ngay.`
        : '',
  ].filter(Boolean);

  const weeklyLines = [
    `**2. Hợp Đồng Tuần (Tuần từ ${state.weekly_week_key} • Reset T2 00:00 • Còn \`${weeklyResetIn}\`)**`,
    ...weeklyContracts.map((c, idx) =>
      `${idx + 1}. ${mark(c.done, c.claimed)} **${c.label}**\n> \`▸ Thưởng:\` \`+${c.rewardLt}\` ${em('su_linhthach')} • \`+${c.rewardStones}\` ${em('enchant_stone')}  •  \`▸ Tiến độ:\` \`[${c.progress.toLocaleString('vi-VN')}/${c.target.toLocaleString('vi-VN')}]\`${c.claimed ? ' — *Đã nhận*' : c.done ? ' — *Sẵn sàng nhận!*' : ''}`,
    ),
    `${mark(weeklyAllDone, state.weekly_bonus_claimed)} **Thưởng Hoàn Tất 3/3:** \`+${WEEKLY_CONTRACTS_CONFIG.bonus.rewardLt}\` ${em('su_linhthach')} • \`+${WEEKLY_CONTRACTS_CONFIG.bonus.rewardStones}\` ${em('enchant_stone')}` + (weeklyClaimable ? ' → Bấm **Nhận Thưởng Tuần**!' : ''),
  ];

  const towerLines = [
    `**Tháp Thí Luyện ${TOWER_MAX_FLOOR} Tầng (${nextTierName})**`,
    `${em('su_arena')} **Tầng đã vượt:** \`Tầng ${state.tower_floor}/${TOWER_MAX_FLOOR}\` • **Lượt hôm nay:** \`${state.tower_attempts_today}/${TOWER_DAILY_ATTEMPTS_LIMIT}\``,
    `> \`▸ Thưởng tầng ${nextFloor}:\` Win \`+${TOWER_WIN_BONUS_LT} LT\` • Lose \`-${TOWER_LOSS_PENALTY_LT} LT\``,
    `> \`▸ Tài nguyên:\` \`${ownedResetCards}/15\` ${em('tower_reset_card')} Thẻ Reset • \`${ownedEnchantStones}\` ${em('enchant_stone')} Đá Khắc Ấn`,
    `• Dùng \`/nhiemvu hanh_dong:tower\` hoặc bấm **Leo Tháp** để khiêu chiến **Tầng ${nextFloor}**!`,
    state.tower_attempts_today > 0 ? `• Bấm **Hồi Lượt Tháp** hoặc dùng \`/nhiemvu hanh_dong:reset\` để tiêu **1 Thẻ Reset Tháp** hồi ngay \`5/5\` lượt.` : '',
  ].filter(Boolean);

  const SEP = '────────────────────────';
  const lines = activeTab === 'weekly'
    ? weeklyLines
    : activeTab === 'tower'
      ? towerLines
      : activeTab === 'all'
        ? [...dailyLines, SEP, ...weeklyLines, SEP, ...towerLines]
        : [...dailyLines, SEP, ...weeklyLines];

  const embedTitle = activeTab === 'weekly'
    ? `${em('su_quest_scroll')} HỢP ĐỒNG TUẦN — ${user.username}`
    : activeTab === 'tower'
      ? `${em('su_arena')} THÁP THÍ LUYỆN ${TOWER_MAX_FLOOR} TẦNG — ${user.username}`
      : `${em('su_quest_scroll')} BẢNG NHIỆM VỤ & HỢP ĐỒNG — ${user.username}`;

  return {
    success: true,
    user_id: cleanId,
    username: user.username,
    tab: activeTab,
    embed_title: embedTitle,
    quest_date: state.quest_date,
    week_key: state.weekly_week_key,
    daily_reset_in: dailyResetIn,
    weekly_reset_in: weeklyResetIn,
    quests,
    all_completed: allCompleted,
    already_claimed: alreadyClaimed,
    can_claim: canClaimDaily,
    weekly_contracts: weeklyContracts,
    weekly_bonus_claimed: state.weekly_bonus_claimed,
    weekly_can_claim: weeklyClaimable,
    tower_floor: state.tower_floor,
    tower_max_floor: TOWER_MAX_FLOOR,
    tower_attempts_used: state.tower_attempts_today,
    tower_attempts_limit: TOWER_DAILY_ATTEMPTS_LIMIT,
    tower_reset_cards: ownedResetCards,
    enchant_stones: ownedEnchantStones,
    quest_card_url: `${PUBLIC_BASE_URL}/api/quest/card/${cleanId}.webp?tab=${activeTab}`,
    message: lines.join('\n'),
    footer: '',
  };
}

export async function claimDailyQuests(userId, options = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID người dùng không hợp lệ.' };
  if (!supabase) return { success: false, status: 503, error: 'DB_UNAVAILABLE', message: 'Supabase chưa sẵn sàng.' };

  return withQuestLock(cleanId, async () => {
    const now = options.now instanceof Date ? options.now : new Date();
    const { user } = await ensureUserInitialized(cleanId, {
      username: pickCleanDisplayValue(options.username, options.fallbackUsername),
      avatarUrl: pickCleanDisplayValue(options.avatarUrl),
    });
    if (!user) return { success: false, status: 500, error: 'USER_INIT_FAILED', message: 'Không thể khởi tạo hồ sơ.' };

    const state = await loadNormalizedQuestRow(cleanId, now);
    const dailyDone = Boolean(user.last_daily && getVnDateKey(new Date(user.last_daily)) === state.quest_date);
    const claimedCols = ['daily_claimed_q1', 'daily_claimed_q2', 'daily_claimed_q3', 'daily_claimed_q4', 'daily_claimed_q5'];

    const nextFlags = {
      daily_claimed_q1: state.daily_claimed_q1,
      daily_claimed_q2: state.daily_claimed_q2,
      daily_claimed_q3: state.daily_claimed_q3,
      daily_claimed_q4: state.daily_claimed_q4,
      daily_claimed_q5: state.daily_claimed_q5,
    };

    let rewardLt = 0;
    const claimedNames = [];
    let completedCount = 0;
    const incompleteSummary = [];

    for (let idx = 0; idx < state.daily_quest_ids.length; idx += 1) {
      const qid = state.daily_quest_ids[idx];
      const meta = ALL_DAILY_QUESTS_BY_ID[qid] || FIXED_DAILY_QUESTS.daily;
      const col = claimedCols[idx] || 'daily_claimed_q5';
      const prog = resolveDailyQuestProgress(qid, state, dailyDone);
      const isDone = prog >= meta.target;
      if (isDone) completedCount += 1;
      else incompleteSummary.push(`${meta.name} (${Math.min(prog, meta.target)}/${meta.target})`);

      if (isDone && !nextFlags[col]) {
        nextFlags[col] = true;
        rewardLt += meta.rewardLt;
        claimedNames.push(`${meta.name} (+${meta.rewardLt} LT)`);
      }
    }

    const allDone = completedCount === state.daily_quest_ids.length;
    let claimedBonus = false;
    if (allDone && !state.daily_claimed_at) {
      claimedBonus = true;
      rewardLt += DAILY_QUEST_REWARD_LT;
    }

    if (claimedNames.length === 0 && !claimedBonus) {
      if (allDone && state.daily_claimed_at) {
        return {
          success: false,
          status: 400,
          error: 'ALREADY_CLAIMED',
          message: `${em('su_sparkle')} Bạn đã nhận trọn bộ thưởng Nhiệm Vụ Hàng Ngày hôm nay rồi!`,
        };
      }
      return {
        success: false,
        status: 400,
        error: 'QUESTS_INCOMPLETE',
        message: `Chưa có nhiệm vụ ngày mới nào hoàn thành để nhận thưởng! Còn thiếu: ${incompleteSummary.slice(0, 3).join(' • ')}.`,
      };
    }

    const nowIso = now.toISOString();
    const newBal = Number(user.linh_thach || 0) + rewardLt;
    const dbTasks = [
      supabase.from('users').update({ linh_thach: newBal, updated_at: nowIso }).eq('user_id', cleanId),
      supabase.from('user_quests').upsert(
        buildQuestUpsertPayload(cleanId, state, {
          ...nextFlags,
          daily_claimed_at: claimedBonus ? nowIso : state.daily_claimed_at,
        }, nowIso),
        { onConflict: 'user_id' },
      ),
    ];

    if (claimedBonus) {
      dbTasks.push(addInventoryItem(cleanId, 'gacha_ticket_equip', 'consumable', 1));
      dbTasks.push(addInventoryItem(cleanId, 'pet_star_stone', 'consumable', 1));
      dbTasks.push(addInventoryItem(cleanId, 'enchant_stone', 'consumable', 1));
    }
    await Promise.all(dbTasks);

    const summaryLines = [
      claimedBonus
        ? `${em('su_winner_trophy')} **HOÀN TẤT 5/5 NHIỆM VỤ HÀNG NGÀY!**`
        : `${em('su_sparkle')} **NHẬN THƯỞNG NHIỆM VỤ HÀNG NGÀY**`,
      ...claimedNames.map((n) => `• ${uiEm('ui_check')} ${n}`),
      claimedBonus
        ? `• ${em('su_winner_trophy')} **Thưởng Tổng 5/5:** **+${DAILY_QUEST_REWARD_LT}** ${em('su_linhthach')} • **+1** ${em('gacha_ticket_equip')} • **+1** ${em('pet_star_stone')} • **+1** ${em('enchant_stone')}`
        : null,
      `• **Tổng Linh Thạch Nhận:** **+${rewardLt.toLocaleString('vi-VN')}** ${em('su_linhthach')} • **Số dư:** **${newBal.toLocaleString('vi-VN')} LT**`,
    ].filter(Boolean);

    return {
      success: true,
      claimed_quests: claimedNames,
      claimed_bonus: claimedBonus,
      reward_linh_thach: rewardLt,
      linh_thach: newBal,
      message: summaryLines.join('\n'),
      footer: '',
    };
  });
}

function pickRandomFrom(arr, rng = Math.random) {
  if (!arr || !arr.length) return null;
  return arr[Math.floor(rng() * arr.length)];
}

function pickWeightedCount(dist, rng = Math.random) {
  const r = rng();
  let acc = 0;
  for (const row of dist) {
    acc += row.w;
    if (r < acc) return row.count;
  }
  return dist[dist.length - 1].count;
}

export async function buildTowerGuardian(floor, rng = Math.random) {
  const f = Math.min(TOWER_MAX_FLOOR, Math.max(1, Number(floor) || 1));
  const isBoss = f % 5 === 0;
  const isMilestoneBoss = Boolean(TOWER_MILESTONE_BONUSES[f]);
  const bossTitle = TOWER_BOSS_NAMES[(f - 1) % TOWER_BOSS_NAMES.length];

  // Level & Star tăng dần mượt từ F1 -> F500
  const level = f <= 250
    ? Math.max(1, Math.round(1 + (f - 1) * (99 / 249)))
    : Math.round(100 + (f - 250) * (50 / 250));
  const star = Math.min(10, Math.max(1, 1 + Math.floor((f - 1) / 48)));

  // Hạng Khắc Ấn phân tầng mượt D -> S
  let enchantGrade = 'D';
  if (f < 80) {
    enchantGrade = f < 50 ? 'D' : (rng() < 0.45 ? 'C' : 'D');
  } else if (f < 180) {
    enchantGrade = rng() < 0.45 ? 'B' : 'C';
  } else if (f < 280) {
    enchantGrade = rng() < 0.45 ? 'A' : 'B';
  } else if (f < 350) {
    enchantGrade = (isBoss && rng() < 0.25) ? 'S' : 'A';
  } else if (f < 420) {
    enchantGrade = (isBoss || rng() < 0.55) ? 'S' : 'A';
  } else {
    enchantGrade = 'S';
  }

  // Pet Mythic rate: F1 = 0%, +10% mỗi 10 tầng -> F100+ = 100%
  const mythicPetChance = f <= 1 ? 0 : Math.min(1, Math.floor(f / 10) * 0.10);
  const isMythicPet = rng() < mythicPetChance;
  const uniquePetChance = f >= 100 ? Math.min(1, (Math.floor((f - 100) / 10) + 1) * 0.05) : 0;

  let pickedPet = null;
  if (isMythicPet) {
    const useUnique = f >= 100 && rng() < uniquePetChance;
    const pool = useUnique ? PUBLIC_TOWER_PETS_BY_RARITY.mythic_unique : PUBLIC_TOWER_PETS_BY_RARITY.mythic_free;
    pickedPet = pickRandomFrom(pool, rng) || pickRandomFrom(PUBLIC_TOWER_PETS_BY_RARITY.mythic, rng);
  } else {
    const r = rng();
    let petTier = 'common';
    if (f <= 5) petTier = 'common';
    else if (f <= 30) petTier = r < 0.70 ? 'common' : 'rare';
    else if (f <= 69) petTier = r < 0.15 ? 'common' : r < 0.75 ? 'rare' : 'epic';
    else petTier = r < 0.35 ? 'rare' : 'epic';
    pickedPet = pickRandomFrom(PUBLIC_TOWER_PETS_BY_RARITY[petTier], rng) || PUBLIC_TOWER_PETS_BY_RARITY.common[0];
  }

  // 4 Slot Trang Bị (3 Loadout + 1 Linh Vực từ F70) tách biệt với Pet
  const unlockedSlots = [];
  if (f >= 5) unlockedSlots.push('weapon');
  if (f >= 20) unlockedSlots.push('gem');
  if (f >= 35) unlockedSlots.push('soul');
  if (f >= 70) unlockedSlots.push('domain');

  const equipMythicChance = f < 50 ? 0 : Math.min(1, (Math.floor((f - 50) / 10) + 1) * 0.20);
  const equipUniqueChance = f < 100 ? 0 : Math.min(1, (Math.floor((f - 100) / 10) + 1) * 0.20);

  let mythicSlotCount = 0;
  if (unlockedSlots.length > 0 && equipMythicChance > 0 && rng() < equipMythicChance) {
    let dist;
    if (f < 100) dist = [{ count: 4, w: 0.05 }, { count: 3, w: 0.15 }, { count: 2, w: 0.25 }, { count: 1, w: 0.55 }];
    else if (f < 200) dist = [{ count: 4, w: 0.10 }, { count: 3, w: 0.20 }, { count: 2, w: 0.30 }, { count: 1, w: 0.40 }];
    else if (f < 300) dist = [{ count: 4, w: 0.15 }, { count: 3, w: 0.25 }, { count: 2, w: 0.35 }, { count: 1, w: 0.25 }];
    else if (f < 400) dist = [{ count: 4, w: 0.20 }, { count: 3, w: 0.30 }, { count: 2, w: 0.40 }, { count: 1, w: 0.10 }];
    else dist = [{ count: 4, w: 0.45 }, { count: 3, w: 0.35 }, { count: 2, w: 0.20 }, { count: 1, w: 0.00 }];

    mythicSlotCount = Math.min(unlockedSlots.length, pickWeightedCount(dist, rng));
  }

  const shuffledSlots = [...unlockedSlots];
  for (let i = shuffledSlots.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [shuffledSlots[i], shuffledSlots[j]] = [shuffledSlots[j], shuffledSlots[i]];
  }
  const mythicSlotSet = new Set(shuffledSlots.slice(0, mythicSlotCount));

  const fallbackGearTier = f <= 30 ? 'common' : f <= 69 ? 'rare' : 'epic';
  const pickSlotItem = (slotName) => {
    if (!unlockedSlots.includes(slotName)) return null;
    if (mythicSlotSet.has(slotName)) {
      const useUni = f >= 100 && rng() < equipUniqueChance;
      const pool = useUni ? TOWER_EQUIP_BY_TIER_SLOT.mythic_unique[slotName] : TOWER_EQUIP_BY_TIER_SLOT.mythic_free[slotName];
      const picked = pickRandomFrom(pool, rng) || pickRandomFrom(TOWER_EQUIP_BY_TIER_SLOT.mythic[slotName], rng);
      return picked ? { ...picked, slot: slotName, enchant_grade: enchantGrade } : null;
    }
    const picked = pickRandomFrom(TOWER_EQUIP_BY_TIER_SLOT[fallbackGearTier][slotName], rng) || TOWER_EQUIP_BY_TIER_SLOT.common[slotName][0];
    return picked ? { ...picked, slot: slotName, enchant_grade: enchantGrade } : null;
  };

  const equipObj = {
    weapon: pickSlotItem('weapon'),
    gem: pickSlotItem('gem'),
    soul: pickSlotItem('soul'),
  };

  let pickedDomain = null;
  let pickedSense = null;
  let pickedRealm = null;
  if (unlockedSlots.includes('domain')) {
    if (mythicSlotSet.has('domain')) {
      const useUni = f >= 100 && rng() < equipUniqueChance;
      const dPool = useUni ? TOWER_DOMAIN_POOLS.mythic_unique : TOWER_DOMAIN_POOLS.mythic_free;
      pickedDomain = pickRandomFrom(dPool, rng) || pickRandomFrom(TOWER_DOMAIN_POOLS.mythic, rng);
    } else {
      pickedDomain = pickRandomFrom(TOWER_DOMAIN_POOLS[fallbackGearTier] || TOWER_DOMAIN_POOLS.rare, rng);
    }
    if (f >= 150) {
      pickedSense = pickRandomFrom(f >= 250 ? TOWER_SENSE_POOLS.mythic : TOWER_SENSE_POOLS.public, rng);
    }
    if (f >= 250) {
      pickedRealm = pickRandomFrom(f >= 350 ? TOWER_REALM_POOLS.mythic : TOWER_REALM_POOLS.public, rng);
    }
  }

  // Buff tổng +10% & Random chiến lực ±12% mỗi lượt leo, cân mượt hướng tới ~125k ở F500 (phù hợp trần người thường 150k)
  const baseCurve = f <= 4
    ? (0.68 + (f - 1) * 0.08)
    : (0.78 + Math.pow((f - 1) / (TOWER_MAX_FLOOR - 1), 1.52) * 11.75);
  const buff10 = 1.10;
  const randomVariance = 0.88 + rng() * 0.24;
  const bossMult = isMilestoneBoss ? 1.14 : (isBoss ? 1.09 : 1.0);
  const statScale = baseCurve * buff10 * randomVariance * bossMult;

  const baseAtk = Math.round(pickedPet.base_atk * statScale);
  const baseDef = Math.round(pickedPet.base_def * statScale);
  const baseSpd = Math.round(pickedPet.base_spd * statScale);

  const npcProfile = {
    user_id: `tower_guardian_${f}`,
    username: isBoss ? `Boss Tầng ${f} • ${bossTitle}` : `Hộ Tháp Tầng ${f}`,
    avatar_url: 'assets/default_avatar.png',
    avatar_frame: pickedPet.rarity_key === 'mythic' ? 'crimson_phoenix' : pickedPet.rarity_key === 'epic' ? 'amethyst_celestial' : 'default',
    level,
    domain_loadout: pickedDomain ? { domain: pickedDomain, sense: pickedSense, realm: pickedRealm } : null,
    pet: {
      pet_type: pickedPet.pet_type,
      pet_name: isBoss ? `[BOSS] ${pickedPet.pet_name}` : pickedPet.pet_name,
      rarity: pickedPet.rarity,
      rarity_key: pickedPet.rarity_key,
      element: pickedPet.element,
      level,
      star,
      enchant_grade: enchantGrade,
      base_atk: baseAtk,
      base_def: baseDef,
      base_spd: baseSpd,
      bonus_atk: 0,
      bonus_def: 0,
      bonus_spd: 0,
      hax_skill: pickedPet.hax_skill,
      hax_description: pickedPet.hax_description,
      equipment: equipObj,
    },
  };

  const combatant = await compileCombatant(npcProfile, 'defender');
  if (isBoss) {
    combatant.critRate = Math.max(combatant.critRate, 0.14);
  }
  combatant.towerMeta = {
    floor: f,
    randomVariance: Number(randomVariance.toFixed(3)),
    mythicSlotCount,
    enchantGrade,
    hasDomain: Boolean(pickedDomain),
  };
  return combatant;
}

export async function challengeTower(userId, options = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID người dùng không hợp lệ.' };
  if (!supabase) return { success: false, status: 503, error: 'DB_UNAVAILABLE', message: 'Supabase chưa sẵn sàng.' };

  return withQuestLock(cleanId, async () => {
    const now = options.now instanceof Date ? options.now : new Date();
    const { user } = await ensureUserInitialized(cleanId, {
      username: pickCleanDisplayValue(options.username, options.fallbackUsername),
      avatarUrl: pickCleanDisplayValue(options.avatarUrl),
    });
    if (!user) return { success: false, status: 500, error: 'USER_INIT_FAILED', message: 'Không thể khởi tạo hồ sơ.' };

    // Chặn leo tháp nếu Linh Thú chính đang đi Khám Phá (/explorer) hoặc Trọng Thương
    const { data: activePetRow } = await supabase
      .from('user_pets')
      .select('pet_name, status')
      .eq('user_id', cleanId)
      .eq('is_active', true)
      .maybeSingle();
    if (activePetRow?.status === 'exploring') {
      return {
        success: false,
        status: 400,
        error: 'PET_BUSY_EXPLORING',
        message: `${uiEm('ui_compass_dir')} Linh Thú chính **${activePetRow.pet_name}** đang đi **Khám Phá Bản Đồ** (\`/explorer\`), tạm khóa leo Tháp Thí Luyện! Hãy đổi sang Linh Thú phụ khác bằng \`/linhthu\` để tiếp tục leo tháp.`,
      };
    }
    if (activePetRow?.status === 'injured') {
      return {
        success: false,
        status: 400,
        error: 'PET_INJURED',
        message: `${uiEm('ui_heal_band')} Linh Thú chính **${activePetRow.pet_name}** đang bị **Trọng Thương** — hãy dùng **Cửu Chuyển Hoàn Hồn Lộ** trong \`/explorer\` hoặc đổi Linh Thú khác.`,
      };
    }

    const state = await loadNormalizedQuestRow(cleanId, now);
    if (state.tower_floor >= TOWER_MAX_FLOOR) {
      return {
        success: false,
        status: 400,
        error: 'TOWER_MAXED',
        message: `${em('su_winner_trophy')} Chúc mừng đạo hữu đã chinh phục đỉnh cao **Tầng ${TOWER_MAX_FLOOR}/${TOWER_MAX_FLOOR}** của Tháp Thí Luyện!`,
      };
    }

    if (state.tower_attempts_today >= TOWER_DAILY_ATTEMPTS_LIMIT) {
      return {
        success: false,
        status: 400,
        error: 'TOWER_LIMIT_REACHED',
        message: `Hôm nay đã dùng hết **${TOWER_DAILY_ATTEMPTS_LIMIT}/${TOWER_DAILY_ATTEMPTS_LIMIT}** lượt khiêu chiến Tháp Thí Luyện. Hãy quay lại vào ngày mai (UTC+7)!`,
      };
    }

    if (options.enforceCooldown !== false) {
      const cd = checkTowerCooldown(cleanId, now.getTime());
      if (cd.blocked) {
        return {
          success: false,
          status: 200,
          error: 'TOWER_COOLDOWN',
          cooldown_seconds: cd.waitSeconds,
          message: `${em('su_arena')} Linh Thú vừa giao chiến tại Tháp Thí Luyện! Vui lòng nghỉ **${cd.waitSeconds} giây** rồi hãy khiêu chiến tầng tiếp theo.`,
        };
      }
      markTowerCooldown(cleanId, now.getTime());
    }

    const targetFloor = state.tower_floor + 1;
    const isBoss = targetFloor % 5 === 0;
    const milestone = TOWER_MILESTONE_BONUSES[targetFloor] || null;
    const rngFn = typeof options.rng === 'function' ? options.rng : Math.random;
    const guardian = await buildTowerGuardian(targetFloor, rngFn);
    const battleRes = await simulateBattle(cleanId, guardian, {
      mode: 'tower',
      battleKind: 'tower',
      maxTurns: 30,
      preRender: options.preRender !== false,
      preRenderMode: 'final_only',
      skipQuestTracking: true,
      seed: options.seed,
    });

    const won = battleRes.winner?.id === cleanId || battleRes.winnerRole === 'attacker';
    const nextFloor = won ? targetFloor : state.tower_floor;
    const nextAttempts = state.tower_attempts_today + 1;
    const nextBattles = state.battles_today + 1;
    const nextWins = state.wins_today + (won ? 1 : 0);
    const nextWeeklyWins = state.weekly_battle_wins + (won ? 1 : 0);
    const nextProg = {
      ...state.daily_progress,
      tower: state.daily_progress.tower + 1,
    };

    let rewardLt = 0;
    let rewardStarStones = 0;
    let rewardEnchantStones = 0;
    let rewardTickets = 0;
    let rewardAbsoluteStones = 0;

    if (won) {
      const cosmeticBuffs = computeCosmeticBuffTotals(user.avatar_frame, user.background_url);
      const fortuneInfo = await getEffectiveLuckAndFortune(cleanId);
      const baseFloorLt = computeTowerFloorRewardLt(targetFloor);
      rewardLt = Math.round(baseFloorLt * Math.max(0.5, 1 + (Number(cosmeticBuffs.ltPct || 0) + Number(fortuneInfo?.fortuneLtPct || 0)) / 100));
      if (isBoss) {
        rewardStarStones += 1;
        rewardEnchantStones += 1;
      }
      if (targetFloor % 10 === 0) rewardTickets += 1;
      if (milestone) {
        rewardLt += milestone.lt;
        rewardEnchantStones += milestone.enchantStones;
        rewardTickets += milestone.tickets;
        rewardAbsoluteStones += Number(milestone.absoluteStones || 0);
      }
    }

    const nowIso = now.toISOString();
    const currentBal = Number(user.linh_thach || 0);
    const newBal = won ? currentBal + rewardLt : Math.max(0, currentBal - TOWER_LOSS_PENALTY_LT);
    const actualLtDelta = newBal - currentBal;

    const dbTasks = [
      supabase.from('user_quests').upsert(
        buildQuestUpsertPayload(cleanId, state, {
          daily_progress: nextProg,
          battles_today: nextBattles,
          wins_today: nextWins,
          tower_floor: nextFloor,
          tower_attempts_today: nextAttempts,
          weekly_battle_wins: nextWeeklyWins,
        }, nowIso),
        { onConflict: 'user_id' },
      ),
    ];

    if (actualLtDelta !== 0) {
      dbTasks.push(supabase.from('users').update({ linh_thach: newBal, updated_at: nowIso }).eq('user_id', cleanId));
    }
    if (rewardStarStones > 0) {
      dbTasks.push(addInventoryItem(cleanId, 'pet_star_stone', 'consumable', rewardStarStones));
    }
    if (rewardEnchantStones > 0) {
      dbTasks.push(addInventoryItem(cleanId, 'enchant_stone', 'consumable', rewardEnchantStones));
    }
    if (rewardTickets > 0) {
      dbTasks.push(addInventoryItem(cleanId, 'gacha_ticket_pet', 'consumable', rewardTickets));
    }
    if (rewardAbsoluteStones > 0) {
      dbTasks.push(addInventoryItem(cleanId, 'enchant_stone_absolute', 'consumable', rewardAbsoluteStones));
    }
    await Promise.all(dbTasks);

    const rewardSummary = [
      rewardLt > 0 ? `+${rewardLt.toLocaleString('vi-VN')} ${em('su_linhthach')} *(gồm +${TOWER_WIN_BONUS_LT} LT thắng trận)*` : '',
      rewardStarStones > 0 ? `+${rewardStarStones} ${em('pet_star_stone')}` : '',
      rewardEnchantStones > 0 ? `+${rewardEnchantStones} ${em('enchant_stone')}` : '',
      rewardTickets > 0 ? `+${rewardTickets} ${em('gacha_ticket_pet')}` : '',
      rewardAbsoluteStones > 0 ? `+${rewardAbsoluteStones} ${em('enchant_stone_absolute')}` : '',
    ].filter(Boolean).join(' • ');

    return {
      success: true,
      won,
      floor: targetFloor,
      is_boss: isBoss,
      is_milestone: Boolean(milestone),
      new_tower_floor: nextFloor,
      attempts_used: nextAttempts,
      attempts_limit: TOWER_DAILY_ATTEMPTS_LIMIT,
      reward_linh_thach: won ? rewardLt : actualLtDelta,
      reward_star_stones: rewardStarStones,
      reward_enchant_stones: rewardEnchantStones,
      reward_tickets: rewardTickets,
      reward_absolute_stones: rewardAbsoluteStones,
      linh_thach: newBal,
      battle_id: battleRes.battleId,
      webLogUrl: battleRes.webLogUrl,
      image_url: battleRes.finalImageWebpUrl || battleRes.reportImageUrl,
      message: won
        ? `${em('su_winner_trophy')} **VƯỢT THÁP TẦNG ${targetFloor} THÀNH CÔNG!**${milestone ? ` *(CHINH PHỤC MỐC TẦNG ${targetFloor}!)*` : isBoss ? ' *(Hạ gục Yêu Vương Boss!)*' : ''}\n• Giao chiến với **${guardian.petName}** (Hệ ${guardian.element} • Lv.${guardian.level}) thắng sau **${battleRes.turnCount} hiệp**.\n• Phần thưởng: **${rewardSummary}**\n• Tiến độ Tháp: \`Tầng ${nextFloor}/${TOWER_MAX_FLOOR}\` • Lượt hôm nay: \`${nextAttempts}/${TOWER_DAILY_ATTEMPTS_LIMIT}\``
        : `${em('su_arena')} **KHIÊU CHIẾN THÁP TẦNG ${targetFloor} THẤT BẠI!**\n• **${guardian.petName}** (Hệ ${guardian.element} • Lv.${guardian.level}) quá mạnh sau **${battleRes.turnCount} hiệp**.\n• Phạt thất bại: **${actualLtDelta} ${em('su_linhthach')} Linh Thạch** *(Ví còn: ${newBal.toLocaleString('vi-VN')} LT)*.\n• Hãy nâng cấp Linh Thú (\`/linhthu\`), Khắc Ấn (\`/enchant\`) hoặc mặc thêm Pháp Bảo (\`/equip\`) rồi thử lại!\n• Lượt hôm nay: \`${nextAttempts}/${TOWER_DAILY_ATTEMPTS_LIMIT}\``,
      footer: '',
    };
  });
}

export async function claimWeeklyQuests(userId, options = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID người dùng không hợp lệ.' };
  if (!supabase) return { success: false, status: 503, error: 'DB_UNAVAILABLE', message: 'Supabase chưa sẵn sàng.' };

  return withQuestLock(cleanId, async () => {
    const now = options.now instanceof Date ? options.now : new Date();
    const { user } = await ensureUserInitialized(cleanId, {
      username: pickCleanDisplayValue(options.username, options.fallbackUsername),
      avatarUrl: pickCleanDisplayValue(options.avatarUrl),
    });
    if (!user) return { success: false, status: 500, error: 'USER_INIT_FAILED', message: 'Không thể khởi tạo hồ sơ.' };

    const state = await loadNormalizedQuestRow(cleanId, now);
    const jobsDone = state.weekly_jobs_done >= WEEKLY_CONTRACTS_CONFIG.jobs.target;
    const winsDone = state.weekly_battle_wins >= WEEKLY_CONTRACTS_CONFIG.wins.target;
    const expDone = state.weekly_exp_earned >= WEEKLY_CONTRACTS_CONFIG.exp.target;
    const allDone = jobsDone && winsDone && expDone;

    let totalLt = 0;
    let totalStones = 0;
    const claimedLabels = [];

    let nextClaimedJobs = state.weekly_claimed_jobs;
    let nextClaimedWins = state.weekly_claimed_wins;
    let nextClaimedExp = state.weekly_claimed_exp;
    let nextBonusClaimed = state.weekly_bonus_claimed;

    if (jobsDone && !nextClaimedJobs) {
      nextClaimedJobs = true;
      totalLt += WEEKLY_CONTRACTS_CONFIG.jobs.rewardLt;
      totalStones += WEEKLY_CONTRACTS_CONFIG.jobs.rewardStones;
      claimedLabels.push(WEEKLY_CONTRACTS_CONFIG.jobs.label);
    }
    if (winsDone && !nextClaimedWins) {
      nextClaimedWins = true;
      totalLt += WEEKLY_CONTRACTS_CONFIG.wins.rewardLt;
      totalStones += WEEKLY_CONTRACTS_CONFIG.wins.rewardStones;
      claimedLabels.push(WEEKLY_CONTRACTS_CONFIG.wins.label);
    }
    if (expDone && !nextClaimedExp) {
      nextClaimedExp = true;
      totalLt += WEEKLY_CONTRACTS_CONFIG.exp.rewardLt;
      totalStones += WEEKLY_CONTRACTS_CONFIG.exp.rewardStones;
      claimedLabels.push(WEEKLY_CONTRACTS_CONFIG.exp.label);
    }
    if (allDone && !nextBonusClaimed) {
      nextBonusClaimed = true;
      totalLt += WEEKLY_CONTRACTS_CONFIG.bonus.rewardLt;
      totalStones += WEEKLY_CONTRACTS_CONFIG.bonus.rewardStones;
      claimedLabels.push(WEEKLY_CONTRACTS_CONFIG.bonus.label);
    }

    if (claimedLabels.length === 0) {
      if (nextClaimedJobs && nextClaimedWins && nextClaimedExp && nextBonusClaimed) {
        return {
          success: false,
          status: 400,
          error: 'WEEKLY_ALREADY_CLAIMED',
          message: `${em('su_sparkle')} Bạn đã nhận trọn bộ thưởng **Hợp Đồng Tuần (${state.weekly_week_key})** rồi! Chờ Thứ Hai \`00:00 UTC+7\` nhé.`,
        };
      }
      return {
        success: false,
        status: 400,
        error: 'WEEKLY_NOT_READY',
        message: [
          `Chưa có Hợp Đồng Tuần mới nào đủ điều kiện nhận thưởng!`,
          `• Làm việc: \`${state.weekly_jobs_done}/${WEEKLY_CONTRACTS_CONFIG.jobs.target}\` ${nextClaimedJobs ? '(Đã nhận)' : ''}`,
          `• Thắng trận: \`${state.weekly_battle_wins}/${WEEKLY_CONTRACTS_CONFIG.wins.target}\` ${nextClaimedWins ? '(Đã nhận)' : ''}`,
          `• EXP Tuần: \`${state.weekly_exp_earned.toLocaleString('vi-VN')}/${WEEKLY_CONTRACTS_CONFIG.exp.target.toLocaleString('vi-VN')}\` ${nextClaimedExp ? '(Đã nhận)' : ''}`,
        ].join('\n'),
      };
    }

    const nowIso = now.toISOString();
    const newBal = Number(user.linh_thach || 0) + totalLt;

    const tasks = [
      supabase.from('users').update({ linh_thach: newBal, updated_at: nowIso }).eq('user_id', cleanId),
      supabase.from('user_quests').upsert(
        buildQuestUpsertPayload(cleanId, state, {
          weekly_claimed_jobs: nextClaimedJobs,
          weekly_claimed_wins: nextClaimedWins,
          weekly_claimed_exp: nextClaimedExp,
          weekly_bonus_claimed: nextBonusClaimed,
        }, nowIso),
        { onConflict: 'user_id' },
      ),
    ];
    if (totalStones > 0) {
      tasks.push(addInventoryItem(cleanId, 'enchant_stone', 'consumable', totalStones));
    }
    await Promise.all(tasks);

    return {
      success: true,
      week_key: state.weekly_week_key,
      claimed_contracts: claimedLabels,
      reward_linh_thach: totalLt,
      reward_enchant_stones: totalStones,
      linh_thach: newBal,
      linh_thach_fmt: newBal.toLocaleString('vi-VN'),
      message: [
        `${em('su_winner_trophy')} **NHẬN THƯỞNG HỢP ĐỒNG TUẦN THÀNH CÔNG!**`,
        ...claimedLabels.map((lbl) => `• ${uiEm('ui_check')} ${lbl}`),
        `• Tổng nhận: **+${totalLt.toLocaleString('vi-VN')}** ${em('su_linhthach')} **Linh Thạch** • **+${totalStones}** ${em('enchant_stone')} **Đá Khắc Ấn**`,
        `• Số dư hiện tại: **${newBal.toLocaleString('vi-VN')} Linh Thạch**`,
      ].join('\n'),
    };
  });
}

export async function resetTowerAttempts(userId, options = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID người dùng không hợp lệ.' };
  if (!supabase) return { success: false, status: 503, error: 'DB_UNAVAILABLE', message: 'Supabase chưa sẵn sàng.' };

  return withQuestLock(cleanId, async () => {
    const now = options.now instanceof Date ? options.now : new Date();
    const { user } = await ensureUserInitialized(cleanId, {
      username: pickCleanDisplayValue(options.username, options.fallbackUsername),
      avatarUrl: pickCleanDisplayValue(options.avatarUrl),
    });
    if (!user) return { success: false, status: 500, error: 'USER_INIT_FAILED', message: 'Không thể khởi tạo hồ sơ.' };

    const state = await loadNormalizedQuestRow(cleanId, now);
    if (state.tower_attempts_today <= 0) {
      return {
        success: false,
        status: 400,
        error: 'TOWER_ATTEMPTS_FULL',
        message: `${em('tower_reset_card')} Lượt đi Tháp hôm nay của bạn đang đầy **${TOWER_DAILY_ATTEMPTS_LIMIT}/${TOWER_DAILY_ATTEMPTS_LIMIT}**, không cần reset *(chưa tiêu hao thẻ)*!`,
      };
    }

    const { data: cardRow } = await supabase
      .from('user_inventory')
      .select('quantity')
      .eq('user_id', cleanId)
      .eq('item_id', 'tower_reset_card')
      .maybeSingle();

    const ownedCards = Number(cardRow?.quantity || 0);
    if (ownedCards < 1) {
      return {
        success: false,
        status: 400,
        error: 'NO_TOWER_RESET_CARD',
        message: `${em('tower_reset_card')} Bạn chưa có **Thẻ Reset Lượt Đi Tháp** trong túi đồ! Hãy mua trong \`/shop\` với giá **200 Linh Thạch** *(giới hạn 5 thẻ/ngày)*.`,
      };
    }

    const nowIso = now.toISOString();
    towerCooldowns.delete(cleanId);
    const [remainingCards] = await Promise.all([
      addInventoryItem(cleanId, 'tower_reset_card', 'consumable', -1),
      supabase.from('user_quests').upsert(
        buildQuestUpsertPayload(cleanId, state, { tower_attempts_today: 0 }, nowIso),
        { onConflict: 'user_id' },
      ),
    ]);

    return {
      success: true,
      attempts_used: 0,
      attempts_limit: TOWER_DAILY_ATTEMPTS_LIMIT,
      remaining_cards: remainingCards,
      message: `${em('tower_reset_card')} Đã tiêu **1 Thẻ Reset Lượt Đi Tháp**!\n• Lượt khiêu chiến Tháp hôm nay đã hồi đầy **0/${TOWER_DAILY_ATTEMPTS_LIMIT}** *(sẵn sàng đánh tiếp 5 lượt)*.\n• Thẻ còn lại trong túi: **${remainingCards}/15**`,
      footer: '',
    };
  });
}
