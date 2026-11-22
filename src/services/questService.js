/**
 * src/services/questService.js
 * Hệ thống Nhiệm Vụ Ngày & Tháp Thí Luyện / Săn Boss PvE (/nhiemvu):
 * - 3 Nhiệm Vụ Hàng Ngày (UTC+7):
 *   1. Điểm danh /daily hôm nay
 *   2. Tích lũy tối thiểu 50 EXP (Chat/Voice) trong ngày
 *   3. Tham gia ít nhất 1 trận /battle hoặc Tháp Thí Luyện trong ngày
 *   -> Hoàn tất đủ 3: Nhận +100 Linh Thạch + 1 Vé Rèn Pháp Bảo + 1 Tinh Thạch Nâng Sao
 * - 3 Hợp Đồng Tuần (Reset Thứ Hai 00:00 UTC+7):
 *   -> 15 ca Làm Việc (/job), 25 trận Thắng (/battle / Tháp), 10.000 EXP Tuần + Thưởng Hoàn Tất 3/3
 * - Tháp Thí Luyện PvE (Tầng 1 -> 200 chia 4 bậc x 50 tầng, tối đa 5 lượt mỗi ngày UTC+7):
 *   -> Toàn bộ 40 Linh Thú xoay vòng kèm 1->3 Pháp Bảo & 100% HAX. Boss mỗi 5 tầng rơi +1 Tinh Thạch Sao & +1 Đá Khắc Ấn.
 */

import { supabase } from '../config/supabase.js';
import {
  PET_CATALOG,
  EQUIPMENT_CATALOG,
  WEEKLY_CONTRACTS_CONFIG,
} from '../data/catalog.js';
import { em } from '../config/emojiHelper.js';
import { sanitizeUserId, ensureUserInitialized, pickCleanDisplayValue } from './profileService.js';
import { compileCombatant } from './battleEngine/statsCompiler.js';
import { simulateBattle } from './battleEngine/battleService.js';

export const DAILY_QUEST_EXP_TARGET = 150;
export const DAILY_QUEST_WINS_TARGET = 3;
export const DAILY_QUEST_BATTLE_TARGET = DAILY_QUEST_WINS_TARGET;
export const DAILY_QUEST_JOBS_TARGET = 2;
export const DAILY_QUEST_ACTIVITY_TARGET = 1;
export const DAILY_QUEST_REWARD_LT = 115;

export const DAILY_QUESTS_CONFIG = {
  q1: { id: 'daily', col: 'daily_claimed_q1', name: 'Điểm danh /daily hôm nay', target: 1, rewardLt: 15 },
  q2: { id: 'exp', col: 'daily_claimed_q2', name: `Tích lũy ${DAILY_QUEST_EXP_TARGET} EXP Chat/Voice`, target: DAILY_QUEST_EXP_TARGET, rewardLt: 20 },
  q3: { id: 'wins', col: 'daily_claimed_q3', name: `Chiến thắng ${DAILY_QUEST_WINS_TARGET} trận /battle hoặc Tháp`, target: DAILY_QUEST_WINS_TARGET, rewardLt: 25 },
  q4: { id: 'jobs', col: 'daily_claimed_q4', name: `Hoàn thành ${DAILY_QUEST_JOBS_TARGET} ca Làm Việc (/job)`, target: DAILY_QUEST_JOBS_TARGET, rewardLt: 20 },
  q5: { id: 'activity', col: 'daily_claimed_q5', name: `Chăm sóc /farm hoặc chơi ${DAILY_QUEST_ACTIVITY_TARGET} ván Minigame`, target: DAILY_QUEST_ACTIVITY_TARGET, rewardLt: 20 },
};
export const TOWER_MAX_FLOOR = 200;
export const TOWER_DAILY_ATTEMPTS_LIMIT = 5;
export const TOWER_WIN_BONUS_LT = 10;
export const TOWER_LOSS_PENALTY_LT = 5;

export const TOWER_MILESTONE_BONUSES = {
  50: { lt: 500, enchantStones: 5, tickets: 0 },
  100: { lt: 1000, enchantStones: 10, tickets: 1 },
  150: { lt: 2000, enchantStones: 15, tickets: 2 },
  200: { lt: 5000, enchantStones: 25, tickets: 3 },
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
};

const TOWER_EQUIP_BY_TIER_SLOT = {
  common: {
    weapon: EQUIPMENT_CATALOG.filter((e) => e.rarity_key === 'common' && e.item_type === 'weapon'),
    gem: EQUIPMENT_CATALOG.filter((e) => e.rarity_key === 'common' && e.item_type === 'gem'),
    soul: EQUIPMENT_CATALOG.filter((e) => e.rarity_key === 'common' && e.item_type === 'soul'),
  },
  rare: {
    weapon: EQUIPMENT_CATALOG.filter((e) => e.rarity_key === 'rare' && e.item_type === 'weapon'),
    gem: EQUIPMENT_CATALOG.filter((e) => e.rarity_key === 'rare' && e.item_type === 'gem'),
    soul: EQUIPMENT_CATALOG.filter((e) => e.rarity_key === 'rare' && e.item_type === 'soul'),
  },
  epic: {
    weapon: EQUIPMENT_CATALOG.filter((e) => e.rarity_key === 'epic' && e.item_type === 'weapon'),
    gem: EQUIPMENT_CATALOG.filter((e) => e.rarity_key === 'epic' && e.item_type === 'gem'),
    soul: EQUIPMENT_CATALOG.filter((e) => e.rarity_key === 'epic' && e.item_type === 'soul'),
  },
  mythic: {
    weapon: EQUIPMENT_CATALOG.filter((e) => e.rarity_key === 'mythic' && e.item_type === 'weapon'),
    gem: EQUIPMENT_CATALOG.filter((e) => e.rarity_key === 'mythic' && e.item_type === 'gem'),
    soul: EQUIPMENT_CATALOG.filter((e) => e.rarity_key === 'mythic' && e.item_type === 'soul'),
  },
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

  return {
    exists: Boolean(row),
    quest_date: todayKey,
    daily_claimed_at: sameQuestDay ? row?.daily_claimed_at || null : null,
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

/**
 * Ghi nhận tiến độ nhiệm vụ hàng ngày & Hợp Đồng Tuần (non-blocking).
 */
export async function trackQuestActivity(userId, { expDelta = 0, battleDelta = 0, winDelta = 0, jobDelta = 0, activityDelta = 0, now = new Date() } = {}) {
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

      const nextExp = state.chat_exp_today + addExp;
      const nextBattles = state.battles_today + addBat;
      const nextWins = state.wins_today + addWin;
      const nextAct = state.farm_or_mg_today + addAct;
      const nextWeeklyExp = state.weekly_exp_earned + addExp;
      const nextWeeklyWins = state.weekly_battle_wins + addWin;
      const nextWeeklyJobs = state.weekly_jobs_done + addJob;
      const nowIso = now.toISOString();

      await supabase.from('user_quests').upsert(
        buildQuestUpsertPayload(cleanId, state, {
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
  const quests = [
    {
      id: 'daily',
      name: DAILY_QUESTS_CONFIG.q1.name,
      progress: dailyDone ? 1 : 0,
      target: 1,
      done: dailyDone,
      claimed: state.daily_claimed_q1 || Boolean(state.daily_claimed_at),
      reward_lt: DAILY_QUESTS_CONFIG.q1.rewardLt,
    },
    {
      id: 'exp',
      name: DAILY_QUESTS_CONFIG.q2.name,
      progress: Math.min(state.chat_exp_today, DAILY_QUEST_EXP_TARGET),
      target: DAILY_QUEST_EXP_TARGET,
      done: state.chat_exp_today >= DAILY_QUEST_EXP_TARGET,
      claimed: state.daily_claimed_q2 || Boolean(state.daily_claimed_at),
      reward_lt: DAILY_QUESTS_CONFIG.q2.rewardLt,
    },
    {
      id: 'wins',
      name: DAILY_QUESTS_CONFIG.q3.name,
      progress: Math.min(state.wins_today, DAILY_QUEST_WINS_TARGET),
      target: DAILY_QUEST_WINS_TARGET,
      done: state.wins_today >= DAILY_QUEST_WINS_TARGET,
      claimed: state.daily_claimed_q3 || Boolean(state.daily_claimed_at),
      reward_lt: DAILY_QUESTS_CONFIG.q3.rewardLt,
    },
    {
      id: 'jobs',
      name: DAILY_QUESTS_CONFIG.q4.name,
      progress: Math.min(state.jobs_today, DAILY_QUEST_JOBS_TARGET),
      target: DAILY_QUEST_JOBS_TARGET,
      done: state.jobs_today >= DAILY_QUEST_JOBS_TARGET,
      claimed: state.daily_claimed_q4 || Boolean(state.daily_claimed_at),
      reward_lt: DAILY_QUESTS_CONFIG.q4.rewardLt,
    },
    {
      id: 'activity',
      name: DAILY_QUESTS_CONFIG.q5.name,
      progress: Math.min(state.farm_or_mg_today, DAILY_QUEST_ACTIVITY_TARGET),
      target: DAILY_QUEST_ACTIVITY_TARGET,
      done: state.farm_or_mg_today >= DAILY_QUEST_ACTIVITY_TARGET,
      claimed: state.daily_claimed_q5 || Boolean(state.daily_claimed_at),
      reward_lt: DAILY_QUESTS_CONFIG.q5.rewardLt,
    },
  ];
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

  const mark = (done, claimed = false) => (claimed ? '🏅' : done ? '✅' : '⬜');
  const nextFloor = Math.min(TOWER_MAX_FLOOR, state.tower_floor + 1);
  const nextTierName = nextFloor <= 50 ? 'Phàm Cảnh (1–50)' : nextFloor <= 100 ? 'Linh Cảnh (51–100)' : nextFloor <= 150 ? 'Tiên Cảnh (101–150)' : 'Thần Thoại (151–200)';

  const lines = [
    `**1. Nhiệm Vụ Hàng Ngày (${state.quest_date})**`,
    ...quests.map((q) => `${mark(q.done, q.claimed)} **${q.name}** — \`${q.progress}/${q.target}\` *(+${q.reward_lt} LT)*`),
    `• **Thưởng Hoàn Tất 5/5:** \`+${DAILY_QUEST_REWARD_LT}\` ${em('su_linhthach')} • \`+1\` ${em('gacha_ticket_equip')} • \`+1\` ${em('pet_star_stone')} • \`+1\` ${em('enchant_stone')}`,
    alreadyClaimed
      ? `${em('su_sparkle')} **Trạng thái:** Đã nhận trọn bộ thưởng Nhiệm Vụ Ngày hôm nay!`
      : canClaimDaily
        ? `${em('su_sparkle')} **Trạng thái:** Có nhiệm vụ đã hoàn tất! Dùng \`/nhiemvu hanh_dong:claim\` để nhận thưởng ngay.`
        : `• *Hoàn thành từng nhiệm vụ để nhận thưởng lẻ và mở thưởng 5/5 qua \`/nhiemvu hanh_dong:claim\`.*`,
    ``,
    `**2. Hợp Đồng Tuần (Tuần từ ${state.weekly_week_key} • Reset T2 00:00)**`,
    ...weeklyContracts.map((c) => `${mark(c.done, c.claimed)} **${c.label}** — \`${c.progress.toLocaleString('vi-VN')}/${c.target.toLocaleString('vi-VN')}\` *(+${c.rewardLt} LT + ${c.rewardStones} ${em('enchant_stone')})*`),
    `${mark(weeklyAllDone, state.weekly_bonus_claimed)} **Thưởng 3/3:** \`+${WEEKLY_CONTRACTS_CONFIG.bonus.rewardLt} LT + ${WEEKLY_CONTRACTS_CONFIG.bonus.rewardStones}\` ${em('enchant_stone')}` + (weeklyClaimable ? ' → Dùng `/nhiemvu hanh_dong:claim_weekly`!' : ''),
    ``,
    `**3. Tháp Thí Luyện 200 Tầng (${nextTierName})**`,
    `${em('su_arena')} **Tầng đã vượt:** \`Tầng ${state.tower_floor}/${TOWER_MAX_FLOOR}\` • **Lượt hôm nay:** \`${state.tower_attempts_today}/${TOWER_DAILY_ATTEMPTS_LIMIT}\` • **Thẻ Reset:** \`${ownedResetCards}/10\` ${em('tower_reset_card', '🗼')} • **Đá Khắc Ấn:** \`${ownedEnchantStones}\` ${em('enchant_stone')}`,
    `• Dùng \`/nhiemvu hanh_dong:tower\` để khiêu chiến **Tầng ${nextFloor}** *(Win +${TOWER_WIN_BONUS_LT} LT / Lose -${TOWER_LOSS_PENALTY_LT} LT • Boss 5 tầng rơi +1 Tinh Thạch & +1 Đá Khắc Ấn)*!`,
    state.tower_attempts_today > 0 ? `• Dùng \`/nhiemvu hanh_dong:reset\` để tiêu **1 Thẻ Reset Tháp** hồi ngay \`5/5\` lượt.` : '',
  ].filter(Boolean);

  return {
    success: true,
    user_id: cleanId,
    username: user.username,
    quest_date: state.quest_date,
    week_key: state.weekly_week_key,
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
    message: lines.join('\n'),
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
    const statusMap = {
      q1: dailyDone,
      q2: state.chat_exp_today >= DAILY_QUEST_EXP_TARGET,
      q3: state.wins_today >= DAILY_QUEST_WINS_TARGET,
      q4: state.jobs_today >= DAILY_QUEST_JOBS_TARGET,
      q5: state.farm_or_mg_today >= DAILY_QUEST_ACTIVITY_TARGET,
    };

    const nextFlags = {
      daily_claimed_q1: state.daily_claimed_q1,
      daily_claimed_q2: state.daily_claimed_q2,
      daily_claimed_q3: state.daily_claimed_q3,
      daily_claimed_q4: state.daily_claimed_q4,
      daily_claimed_q5: state.daily_claimed_q5,
    };

    let rewardLt = 0;
    const claimedNames = [];
    for (const key of ['q1', 'q2', 'q3', 'q4', 'q5']) {
      const cfg = DAILY_QUESTS_CONFIG[key];
      if (statusMap[key] && !nextFlags[cfg.col]) {
        nextFlags[cfg.col] = true;
        rewardLt += cfg.rewardLt;
        claimedNames.push(`${cfg.name} (+${cfg.rewardLt} LT)`);
      }
    }

    const allDone = Object.values(statusMap).every(Boolean);
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
        message: `Chưa có nhiệm vụ ngày mới nào hoàn thành để nhận thưởng! (/daily: ${dailyDone ? '1/1' : '0/1'}, EXP: ${state.chat_exp_today}/${DAILY_QUEST_EXP_TARGET}, Thắng trận: ${state.wins_today}/${DAILY_QUEST_WINS_TARGET}, /job: ${state.jobs_today}/${DAILY_QUEST_JOBS_TARGET}, /farm/Minigame: ${state.farm_or_mg_today}/${DAILY_QUEST_ACTIVITY_TARGET}).`,
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
      ...claimedNames.map((n) => `• ✅ ${n}`),
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
    };
  });
}

export async function buildTowerGuardian(floor) {
  const f = Math.min(TOWER_MAX_FLOOR, Math.max(1, Number(floor) || 1));
  const isBoss = f % 5 === 0;
  const isMilestoneBoss = Boolean(TOWER_MILESTONE_BONUSES[f]);
  const bossTitle = TOWER_BOSS_NAMES[(f - 1) % TOWER_BOSS_NAMES.length];

  let tierKey = 'common';
  let equipSlotsCount = 1;
  let enchantGrade = 'D';
  let level = 1;
  let star = 1;
  let statScale = 1.0;

  if (f <= 50) {
    tierKey = 'common';
    equipSlotsCount = f >= 5 ? 1 : 0;
    enchantGrade = 'D';
    level = Math.max(1, Math.round(1 + (f - 1) * 0.55));
    star = f >= 26 ? 2 : 1;
    statScale = f <= 4 ? (0.68 + (f - 1) * 0.08) : (0.72 + (f - 1) * 0.024);
  } else if (f <= 100) {
    tierKey = 'rare';
    equipSlotsCount = 2;
    enchantGrade = f >= 75 ? 'C' : 'D';
    level = Math.round(29 + (f - 51) * 0.55);
    star = 3 + Math.floor((f - 51) / 18);
    statScale = 1.08 + (f - 51) * 0.032;
  } else if (f <= 150) {
    tierKey = 'epic';
    equipSlotsCount = 3;
    enchantGrade = f >= 125 ? 'B' : 'C';
    level = Math.round(57 + (f - 101) * 0.52);
    star = 5 + Math.floor((f - 101) / 18);
    statScale = 1.55 + (f - 101) * 0.042;
  } else {
    tierKey = 'mythic';
    equipSlotsCount = 3;
    enchantGrade = f >= 200 ? 'S' : f >= 185 ? 'A' : 'B';
    level = Math.min(100, Math.round(83 + (f - 151) * 0.35));
    star = Math.min(10, 8 + Math.floor((f - 151) / 18));
    statScale = 2.25 + (f - 151) * 0.055;
  }

  const bossMult = isMilestoneBoss ? 1.18 : (isBoss ? 1.12 : 1.0);
  const tierPets = PUBLIC_TOWER_PETS_BY_RARITY[tierKey] || PUBLIC_TOWER_PETS_BY_RARITY.common;
  const pickedPet = tierPets[(f - 1) % tierPets.length];
  const tierPool = TOWER_EQUIP_BY_TIER_SLOT[tierKey] || TOWER_EQUIP_BY_TIER_SLOT.common;

  const pickEquip = (slotName, offset) => {
    const arr = tierPool[slotName] || [];
    if (!arr.length) return null;
    const picked = arr[(f - 1 + offset) % arr.length];
    return { ...picked, slot: slotName, enchant_grade: enchantGrade };
  };

  const equipObj = {
    weapon: equipSlotsCount >= 1 ? pickEquip('weapon', 0) : null,
    gem: equipSlotsCount >= 2 ? pickEquip('gem', 2) : null,
    soul: equipSlotsCount >= 3 ? pickEquip('soul', 4) : null,
  };

  const baseAtk = Math.round(pickedPet.base_atk * statScale * bossMult);
  const baseDef = Math.round(pickedPet.base_def * statScale * bossMult);
  const baseSpd = Math.round(pickedPet.base_spd * statScale * bossMult);

  const npcProfile = {
    user_id: `tower_guardian_${f}`,
    username: isBoss ? `Boss Tầng ${f} • ${bossTitle}` : `Hộ Tháp Tầng ${f}`,
    avatar_url: 'assets/default_avatar.png',
    avatar_frame: tierKey === 'mythic' ? 'crimson_phoenix' : tierKey === 'epic' ? 'amethyst_celestial' : 'default',
    level,
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
    combatant.critRate = Math.max(combatant.critRate, 0.12);
  }
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
        message: `🧭 Linh Thú chính **${activePetRow.pet_name}** đang đi **Khám Phá Bản Đồ** (\`/explorer\`), tạm khóa leo Tháp Thí Luyện! Hãy đổi sang Linh Thú phụ khác bằng \`/linhthu\` để tiếp tục leo tháp.`,
      };
    }
    if (activePetRow?.status === 'injured') {
      return {
        success: false,
        status: 400,
        error: 'PET_INJURED',
        message: `🩹 Linh Thú chính **${activePetRow.pet_name}** đang bị **Trọng Thương** — hãy dùng **Cửu Chuyển Hoàn Hồn Lộ** trong \`/explorer\` hoặc đổi Linh Thú khác.`,
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

    const targetFloor = state.tower_floor + 1;
    const isBoss = targetFloor % 5 === 0;
    const milestone = TOWER_MILESTONE_BONUSES[targetFloor] || null;
    const guardian = await buildTowerGuardian(targetFloor);
    const battleRes = await simulateBattle(cleanId, guardian, {
      maxTurns: 25,
      preRender: options.preRender !== false,
      skipQuestTracking: true,
      seed: options.seed,
    });

    const won = battleRes.winner?.id === cleanId || battleRes.winnerRole === 'attacker';
    const nextFloor = won ? targetFloor : state.tower_floor;
    const nextAttempts = state.tower_attempts_today + 1;
    const nextBattles = state.battles_today + 1;
    const nextWins = state.wins_today + (won ? 1 : 0);
    const nextWeeklyWins = state.weekly_battle_wins + (won ? 1 : 0);

    let rewardLt = 0;
    let rewardStarStones = 0;
    let rewardEnchantStones = 0;
    let rewardTickets = 0;

    if (won) {
      rewardLt = (20 + Math.floor(targetFloor * 2)) * (isBoss ? 2 : 1) + TOWER_WIN_BONUS_LT;
      if (isBoss) {
        rewardStarStones += 1;
        rewardEnchantStones += 1;
      }
      if (targetFloor % 10 === 0) rewardTickets += 1;
      if (milestone) {
        rewardLt += milestone.lt;
        rewardEnchantStones += milestone.enchantStones;
        rewardTickets += milestone.tickets;
      }
    }

    const nowIso = now.toISOString();
    const currentBal = Number(user.linh_thach || 0);
    const newBal = won ? currentBal + rewardLt : Math.max(0, currentBal - TOWER_LOSS_PENALTY_LT);
    const actualLtDelta = newBal - currentBal;

    const dbTasks = [
      supabase.from('user_quests').upsert(
        buildQuestUpsertPayload(cleanId, state, {
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
    await Promise.all(dbTasks);

    const rewardSummary = [
      rewardLt > 0 ? `+${rewardLt.toLocaleString('vi-VN')} ${em('su_linhthach')} *(gồm +${TOWER_WIN_BONUS_LT} LT thắng trận)*` : '',
      rewardStarStones > 0 ? `+${rewardStarStones} ${em('pet_star_stone')}` : '',
      rewardEnchantStones > 0 ? `+${rewardEnchantStones} ${em('enchant_stone')}` : '',
      rewardTickets > 0 ? `+${rewardTickets} ${em('gacha_ticket_pet')}` : '',
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
      linh_thach: newBal,
      battle_id: battleRes.battleId,
      image_url: battleRes.finalImageWebpUrl || battleRes.reportImageUrl,
      message: won
        ? `${em('su_winner_trophy')} **VƯỢT THÁP TẦNG ${targetFloor} THÀNH CÔNG!**${milestone ? ` *(CHINH PHỤC MỐC TẦNG ${targetFloor}!)*` : isBoss ? ' *(Hạ gục Yêu Vương Boss!)*' : ''}\n• Giao chiến với **${guardian.petName}** (Hệ ${guardian.element} • Lv.${guardian.level}) thắng sau **${battleRes.turnCount} hiệp**.\n• Phần thưởng: **${rewardSummary}**\n• Tiến độ Tháp: \`Tầng ${nextFloor}/${TOWER_MAX_FLOOR}\` • Lượt hôm nay: \`${nextAttempts}/${TOWER_DAILY_ATTEMPTS_LIMIT}\``
        : `${em('su_arena')} **KHIÊU CHIẾN THÁP TẦNG ${targetFloor} THẤT BẠI!**\n• **${guardian.petName}** (Hệ ${guardian.element} • Lv.${guardian.level}) quá mạnh sau **${battleRes.turnCount} hiệp**.\n• Phạt thất bại: **${actualLtDelta} ${em('su_linhthach')} Linh Thạch** *(Ví còn: ${newBal.toLocaleString('vi-VN')} LT)*.\n• Hãy nâng cấp Linh Thú (\`/linhthu\`), Khắc Ấn (\`/enchant\`) hoặc mặc thêm Pháp Bảo (\`/equip\`) rồi thử lại!\n• Lượt hôm nay: \`${nextAttempts}/${TOWER_DAILY_ATTEMPTS_LIMIT}\``,
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
        ...claimedLabels.map((lbl) => `• ✅ ${lbl}`),
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
        message: `${em('tower_reset_card', '🗼')} Lượt đi Tháp hôm nay của bạn đang đầy **${TOWER_DAILY_ATTEMPTS_LIMIT}/${TOWER_DAILY_ATTEMPTS_LIMIT}**, không cần reset *(chưa tiêu hao thẻ)*!`,
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
        message: `${em('tower_reset_card', '🗼')} Bạn chưa có **Thẻ Reset Lượt Đi Tháp** trong túi đồ! Hãy mua trong \`/shop\` với giá **200 Linh Thạch** *(giới hạn 3 thẻ/ngày)*.`,
      };
    }

    const nowIso = now.toISOString();
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
      message: `${em('tower_reset_card', '🗼')} Đã tiêu **1 Thẻ Reset Lượt Đi Tháp**!\n• Lượt khiêu chiến Tháp hôm nay đã hồi đầy **0/${TOWER_DAILY_ATTEMPTS_LIMIT}** *(sẵn sàng đánh tiếp 5 lượt)*.\n• Thẻ còn lại trong túi: **${remainingCards}/10**`,
    };
  });
}
