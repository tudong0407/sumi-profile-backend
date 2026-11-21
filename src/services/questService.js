/**
 * src/services/questService.js
 * Hệ thống Nhiệm Vụ Ngày & Tháp Thí Luyện / Săn Boss PvE (/nhiemvu):
 * - 3 Nhiệm Vụ Hàng Ngày (UTC+7):
 *   1. Điểm danh /daily hôm nay
 *   2. Tích lũy tối thiểu 50 EXP (Chat/Voice) trong ngày
 *   3. Tham gia ít nhất 1 trận /battle hoặc Tháp Thí Luyện trong ngày
 *   -> Hoàn tất đủ 3: Nhận +100 Linh Thạch + 1 Vé Rèn Pháp Bảo + 1 Tinh Thạch Nâng Sao
 * - Tháp Thí Luyện PvE (Tầng 1 -> 100, tối đa 5 lượt mỗi ngày UTC+7):
 *   -> Mỗi tầng 5 là Boss Yêu Vương (thưởng x2 Linh Thạch + Tinh Thạch Sao + Vé Gacha mỗi 10 tầng).
 */

import { supabase } from '../config/supabase.js';
import { em } from '../config/emojiHelper.js';
import { sanitizeUserId, ensureUserInitialized, pickCleanDisplayValue } from './profileService.js';
import { simulateBattle } from './battleEngine/battleService.js';

export const DAILY_QUEST_EXP_TARGET = 50;
export const DAILY_QUEST_BATTLE_TARGET = 1;
export const DAILY_QUEST_REWARD_LT = 100;
export const TOWER_MAX_FLOOR = 100;
export const TOWER_DAILY_ATTEMPTS_LIMIT = 5;

const TOWER_ELEMENTS = ['Kim', 'Mộc', 'Thổ', 'Thủy', 'Hỏa', 'Lôi', 'Quang', 'Ám'];
const TOWER_BOSS_NAMES = [
  'Thạch Khôi Lỗi Thủ Vệ',
  'Hắc Phong Lang Vương',
  'Xích Diễm Hỏa Sư',
  'Huyền Thủy Giao Long',
  'Cửu U Ma Viên',
  'Thái Cổ Lôi Ưng',
];

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

async function addInventoryItem(userId, itemId, category, delta) {
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
  const { data: row } = await supabase
    .from('user_quests')
    .select('*')
    .eq('user_id', cleanId)
    .maybeSingle();

  const sameQuestDay = row?.quest_date === todayKey;
  const sameTowerDay = row?.tower_attempts_date === todayKey;

  return {
    exists: Boolean(row),
    quest_date: todayKey,
    daily_claimed_at: sameQuestDay ? row?.daily_claimed_at || null : null,
    chat_exp_today: sameQuestDay ? Number(row?.chat_exp_today || 0) : 0,
    battles_today: sameQuestDay ? Number(row?.battles_today || 0) : 0,
    tower_floor: Number(row?.tower_floor || 0),
    tower_attempts_date: todayKey,
    tower_attempts_today: sameTowerDay ? Number(row?.tower_attempts_today || 0) : 0,
  };
}

/**
 * Ghi nhận tiến độ nhiệm vụ hàng ngày không làm nghẽn luồng chính (non-blocking).
 */
export async function trackQuestActivity(userId, { expDelta = 0, battleDelta = 0, now = new Date() } = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId || !/^[0-9]{17,20}$/.test(cleanId) || !supabase) return null;

  try {
    return await withQuestLock(cleanId, async () => {
      const state = await loadNormalizedQuestRow(cleanId, now);
      const nextExp = state.chat_exp_today + Math.max(0, Number(expDelta) || 0);
      const nextBattles = state.battles_today + Math.max(0, Number(battleDelta) || 0);
      const nowIso = now.toISOString();

      await supabase.from('user_quests').upsert({
        user_id: cleanId,
        quest_date: state.quest_date,
        daily_claimed_at: state.daily_claimed_at,
        chat_exp_today: nextExp,
        battles_today: nextBattles,
        tower_floor: state.tower_floor,
        tower_attempts_date: state.tower_attempts_date,
        tower_attempts_today: state.tower_attempts_today,
        updated_at: nowIso,
      }, { onConflict: 'user_id' });

      return { chat_exp_today: nextExp, battles_today: nextBattles };
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

  const state = await loadNormalizedQuestRow(cleanId, now);
  const dailyDone = Boolean(user.last_daily && getVnDateKey(new Date(user.last_daily)) === state.quest_date);
  const expDone = state.chat_exp_today >= DAILY_QUEST_EXP_TARGET;
  const battleDone = state.battles_today >= DAILY_QUEST_BATTLE_TARGET;
  const allCompleted = dailyDone && expDone && battleDone;
  const alreadyClaimed = Boolean(state.daily_claimed_at);

  const quests = [
    { id: 'daily', name: 'Điểm danh Tu Tiên (`/daily`)', progress: dailyDone ? 1 : 0, target: 1, done: dailyDone },
    { id: 'exp', name: 'Tích lũy EXP ngày (Chat / Voice)', progress: Math.min(state.chat_exp_today, DAILY_QUEST_EXP_TARGET), target: DAILY_QUEST_EXP_TARGET, done: expDone },
    { id: 'battle', name: 'Tham gia `/battle` hoặc Tháp Thí Luyện', progress: Math.min(state.battles_today, DAILY_QUEST_BATTLE_TARGET), target: DAILY_QUEST_BATTLE_TARGET, done: battleDone },
  ];

  const mark = (done) => (done ? '✅' : '⬜');
  const lines = [
    `**1. Nhiệm Vụ Hàng Ngày (${state.quest_date})**`,
    ...quests.map((q) => `${mark(q.done)} **${q.name}** — \`${q.progress}/${q.target}\``),
    `• **Phần thưởng hoàn tất 3/3:** \`+${DAILY_QUEST_REWARD_LT}\` ${em('su_linhthach')} • \`+1\` ${em('su_ticket_equip')} Vé Pháp Bảo • \`+1\` ${em('su_star_stone')} Tinh Thạch Sao`,
    alreadyClaimed
      ? `${em('su_sparkle')} **Trạng thái:** Đã nhận thưởng Nhiệm Vụ Ngày hôm nay!`
      : allCompleted
        ? `${em('su_sparkle')} **Trạng thái:** Đã hoàn thành 3/3! Dùng \`/nhiemvu hanh_dong:claim\` để nhận thưởng.`
        : `• *Hoàn thành đủ 3 nhiệm vụ rồi dùng \`/nhiemvu hanh_dong:claim\`.*`,
    ``,
    `**2. Tháp Thí Luyện & Săn Boss PvE**`,
    `${em('su_arena')} **Tầng đã vượt:** \`Tầng ${state.tower_floor}/${TOWER_MAX_FLOOR}\` • **Lượt hôm nay:** \`${state.tower_attempts_today}/${TOWER_DAILY_ATTEMPTS_LIMIT}\``,
    `• Dùng \`/nhiemvu hanh_dong:tower\` để khiêu chiến **Tầng ${Math.min(TOWER_MAX_FLOOR, state.tower_floor + 1)}**!`,
  ];

  return {
    success: true,
    user_id: cleanId,
    username: user.username,
    quest_date: state.quest_date,
    quests,
    all_completed: allCompleted,
    already_claimed: alreadyClaimed,
    can_claim: allCompleted && !alreadyClaimed,
    tower_floor: state.tower_floor,
    tower_attempts_used: state.tower_attempts_today,
    tower_attempts_limit: TOWER_DAILY_ATTEMPTS_LIMIT,
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
    if (state.daily_claimed_at) {
      return {
        success: false,
        status: 400,
        error: 'ALREADY_CLAIMED',
        message: `${em('su_sparkle')} Bạn đã nhận thưởng Nhiệm Vụ Hàng Ngày hôm nay rồi!`,
      };
    }

    const dailyDone = Boolean(user.last_daily && getVnDateKey(new Date(user.last_daily)) === state.quest_date);
    const expDone = state.chat_exp_today >= DAILY_QUEST_EXP_TARGET;
    const battleDone = state.battles_today >= DAILY_QUEST_BATTLE_TARGET;
    if (!dailyDone || !expDone || !battleDone) {
      return {
        success: false,
        status: 400,
        error: 'QUESTS_INCOMPLETE',
        message: `Chưa hoàn thành đủ 3 nhiệm vụ ngày! (/daily: ${dailyDone ? 'xong' : 'chưa'}, EXP: ${state.chat_exp_today}/${DAILY_QUEST_EXP_TARGET}, Giao đấu: ${state.battles_today}/${DAILY_QUEST_BATTLE_TARGET}).`,
      };
    }

    const nowIso = now.toISOString();
    const newBal = Number(user.linh_thach || 0) + DAILY_QUEST_REWARD_LT;

    await Promise.all([
      supabase.from('users').update({ linh_thach: newBal, updated_at: nowIso }).eq('user_id', cleanId),
      addInventoryItem(cleanId, 'gacha_ticket_equip', 'consumable', 1),
      addInventoryItem(cleanId, 'pet_star_stone', 'consumable', 1),
      supabase.from('user_quests').upsert({
        user_id: cleanId,
        quest_date: state.quest_date,
        daily_claimed_at: nowIso,
        chat_exp_today: state.chat_exp_today,
        battles_today: state.battles_today,
        tower_floor: state.tower_floor,
        tower_attempts_date: state.tower_attempts_date,
        tower_attempts_today: state.tower_attempts_today,
        updated_at: nowIso,
      }, { onConflict: 'user_id' }),
    ]);

    return {
      success: true,
      reward_linh_thach: DAILY_QUEST_REWARD_LT,
      linh_thach: newBal,
      message: `${em('su_winner_trophy')} Hoàn thành xuất sắc **3/3 Nhiệm Vụ Ngày**!\n• Nhận: **+${DAILY_QUEST_REWARD_LT}** ${em('su_linhthach')} • **+1** ${em('su_ticket_equip')} Vé Rèn Pháp Bảo • **+1** ${em('su_star_stone')} Tinh Thạch Nâng Sao\n• Số dư hiện tại: **${newBal.toLocaleString('vi-VN')} Linh Thạch**.`,
    };
  });
}

function buildTowerGuardian(floor) {
  const isBoss = floor % 5 === 0;
  const mult = isBoss ? 1.25 : 1.0;
  const element = TOWER_ELEMENTS[(floor - 1) % TOWER_ELEMENTS.length];
  const bossTitle = TOWER_BOSS_NAMES[(floor - 1) % TOWER_BOSS_NAMES.length];
  const atk = Math.round((85 + (floor - 1) * 28) * mult);
  const def = Math.round((75 + (floor - 1) * 25) * mult);
  const spd = Math.round((75 + (floor - 1) * 20) * mult);
  const maxHp = Math.max(1000, Math.round((1100 + (floor - 1) * 900) * mult));

  return {
    id: `tower_guardian_${floor}`,
    name: isBoss ? `Boss Tầng ${floor}` : `Hộ Tháp Tầng ${floor}`,
    avatarUrl: null,
    userLevel: floor,
    avatarFrame: 'default',
    petName: isBoss ? `[BOSS] ${bossTitle}` : bossTitle,
    petType: 'hoa_thach_nham_nham',
    petRarity: isBoss ? 'Tiên Phẩm' : floor >= 20 ? 'Linh Phẩm' : 'Phàm Phẩm',
    petIcon: em('su_arena'),
    element,
    level: floor,
    star: Math.min(10, Math.max(1, Math.ceil(floor / 10))),
    atk,
    def,
    spd,
    critRate: isBoss ? 0.12 : 0.05,
    bonusCrit: 0,
    maxHp,
    currentHp: maxHp,
    shield: 0,
    equipment: { weapon: null, gem: null, soul: null },
    hax: { pet: null, weapon: null, gem: null, soul: null },
    state: {
      isImmortalTurns: 0,
      antiImmortalityTurns: 0,
      antiShieldTurns: 0,
      isStunned: false,
      isCharmed: false,
      isDoubleTurn: false,
      reviveUsed: false,
      cheatDeathUsed: false,
      hpSwapUsed: false,
      doubleTurnUsed: false,
      missChanceTurns: 0,
      pierceDefNext: false,
      haxLockedTurns: 0,
    },
  };
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
    const guardian = buildTowerGuardian(targetFloor);
    const battleRes = await simulateBattle(cleanId, guardian, {
      maxTurns: 20,
      preRender: options.preRender !== false,
      skipQuestTracking: true,
      seed: options.seed,
    });

    const won = battleRes.winner?.id === cleanId || battleRes.winnerRole === 'attacker';
    const nextFloor = won ? targetFloor : state.tower_floor;
    const nextAttempts = state.tower_attempts_today + 1;
    const nextBattles = state.battles_today + 1;

    let rewardLt = 0;
    let rewardStarStones = 0;
    let rewardTickets = 0;

    if (won) {
      rewardLt = (40 + targetFloor * 8) * (isBoss ? 2 : 1);
      if (isBoss) rewardStarStones = 1;
      if (targetFloor % 10 === 0) rewardTickets = 1;
    }

    const nowIso = now.toISOString();
    const newBal = Number(user.linh_thach || 0) + rewardLt;
    const dbTasks = [
      supabase.from('user_quests').upsert({
        user_id: cleanId,
        quest_date: state.quest_date,
        daily_claimed_at: state.daily_claimed_at,
        chat_exp_today: state.chat_exp_today,
        battles_today: nextBattles,
        tower_floor: nextFloor,
        tower_attempts_date: state.tower_attempts_date,
        tower_attempts_today: nextAttempts,
        updated_at: nowIso,
      }, { onConflict: 'user_id' }),
    ];

    if (rewardLt > 0) {
      dbTasks.push(supabase.from('users').update({ linh_thach: newBal, updated_at: nowIso }).eq('user_id', cleanId));
    }
    if (rewardStarStones > 0) {
      dbTasks.push(addInventoryItem(cleanId, 'pet_star_stone', 'consumable', rewardStarStones));
    }
    if (rewardTickets > 0) {
      dbTasks.push(addInventoryItem(cleanId, 'gacha_ticket_pet', 'consumable', rewardTickets));
    }
    await Promise.all(dbTasks);

    const rewardSummary = [
      rewardLt > 0 ? `+${rewardLt.toLocaleString('vi-VN')} ${em('su_linhthach')}` : '',
      rewardStarStones > 0 ? `+${rewardStarStones} ${em('su_star_stone')}` : '',
      rewardTickets > 0 ? `+${rewardTickets} ${em('su_ticket_pet')}` : '',
    ].filter(Boolean).join(' • ');

    return {
      success: true,
      won,
      floor: targetFloor,
      is_boss: isBoss,
      new_tower_floor: nextFloor,
      attempts_used: nextAttempts,
      attempts_limit: TOWER_DAILY_ATTEMPTS_LIMIT,
      reward_linh_thach: rewardLt,
      reward_star_stones: rewardStarStones,
      reward_tickets: rewardTickets,
      linh_thach: newBal,
      battle_id: battleRes.battleId,
      image_url: battleRes.finalImageWebpUrl || battleRes.reportImageUrl,
      message: won
        ? `${em('su_winner_trophy')} **VƯỢT THÁP TẦNG ${targetFloor} THÀNH CÔNG!**${isBoss ? ' *(Hạ gục Yêu Vương Boss!)*' : ''}\n• Giao chiến với **${guardian.petName}** (Hệ ${guardian.element}) thắng sau **${battleRes.turnCount} hiệp**.\n• Phần thưởng: **${rewardSummary}**\n• Tiến độ Tháp: \`Tầng ${nextFloor}/${TOWER_MAX_FLOOR}\` • Lượt hôm nay: \`${nextAttempts}/${TOWER_DAILY_ATTEMPTS_LIMIT}\``
        : `${em('su_arena')} **KHIÊU CHIẾN THÁP TẦNG ${targetFloor} THẤT BẠI!**\n• **${guardian.petName}** quá mạnh sau **${battleRes.turnCount} hiệp**.\n• Hãy nâng cấp Linh Thú (\`/linhthu\`) hoặc mặc thêm Pháp Bảo (\`/equip\`) rồi thử lại!\n• Lượt hôm nay: \`${nextAttempts}/${TOWER_DAILY_ATTEMPTS_LIMIT}\``,
    };
  });
}
