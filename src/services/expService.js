/**
 * src/services/expService.js
 * Hệ thống tích lũy EXP Chat (15–25 EXP / 45s cooldown) & Voice (50–100 EXP / 5 phút).
 * Tự động khởi tạo hồ sơ tân thủ Lv.1 + Pet Phàm Phẩm mặc định (Hóa Thạch Nham Nham Thú) vào Supabase.
 */

import { supabase } from '../config/supabase.js';
import {
  FUYUMI_USER_ID,
  LEVEL_ROLE_MILESTONES,
  LEVEL_ROLE_BUFF_CONFIG,
  ROLE_BUFF_CONFIG,
  ROLE_BY_ID,
  STARTER_PET,
  getClanLevelConfig,
  computeCosmeticBuffTotals,
} from '../data/catalog.js';
import { em, realmEmoji, uiEm } from '../config/emojiHelper.js';
import { computeMarriageBuffs } from './marryService.js';
import { recordClanWarScore } from './clanService.js';
import { trackQuestActivity } from './questService.js';
import {
  sanitizeUserId,
  getRealmByLevel,
  getExpForNextLevel,
  getMaxRoleSlotsByLevel,
  ensureUserInitialized,
  pickCleanDisplayValue,
  computeRoleBuffTotals,
} from './profileService.js';

export const CHAT_COOLDOWN_MS = 45 * 1000;
export const CHAT_EXP_MIN = 23;
export const CHAT_EXP_MAX = 35;
export const VOICE_BLOCK_MINUTES = 5;
export const VOICE_EXP_MIN = 85;
export const VOICE_EXP_MAX = 135;
export const MAX_VOICE_SESSION_MINUTES = 240;

export function computeLevelUpLinhThachReward(highestClaimed, newLevel) {
  const prevClaimed = Math.max(1, Number(highestClaimed) || 1);
  const targetLvl = Math.min(100, Math.max(1, Number(newLevel) || 1));
  if (targetLvl <= prevClaimed) {
    return { totalReward: 0, newHighestClaimed: prevClaimed, newlyClaimedLevels: [] };
  }

  let totalReward = 0;
  const newlyClaimedLevels = [];
  for (let lvl = prevClaimed + 1; lvl <= targetLvl; lvl += 1) {
    const baseLt = lvl <= 19 ? 50 : lvl <= 39 ? 100 : lvl <= 59 ? 150 : lvl <= 79 ? 250 : 400;
    const milestoneBonus = lvl % 10 === 0 ? lvl * 20 : 0;
    totalReward += baseLt + milestoneBonus;
    newlyClaimedLevels.push({ level: lvl, reward: baseLt + milestoneBonus });
  }

  return {
    totalReward,
    newHighestClaimed: targetLvl,
    newlyClaimedLevels,
  };
}

const LOCKED_XP_ROLES = new Set([
  '1471111216423370792', // Locked XP
  '1474776271883079681', // Cách Ly
]);

// In-memory fallback store used ONLY when Supabase is unavailable
const memoryUsers = new Map();
export const memoryDailyActivityStats = new Map();
// Per-user async queue lock to prevent burst-message cooldown / starter-pet race conditions
const userLocks = new Map();

export function getVnDateKey(date = new Date()) {
  const vn = new Date(date.getTime() + 7 * 3600 * 1000);
  return vn.toISOString().slice(0, 10);
}

export function resetMemoryDailyActivityStats() {
  memoryDailyActivityStats.clear();
}

export async function recordDailyActivityStat(userId, {
  username = '',
  chatExp = 0,
  chatCount = 0,
  voiceExp = 0,
  voiceMinutes = 0,
  now = new Date(),
} = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return null;
  const cExp = Math.max(0, Math.floor(Number(chatExp) || 0));
  const cCnt = Math.max(0, Math.floor(Number(chatCount) || 0));
  const vExp = Math.max(0, Math.floor(Number(voiceExp) || 0));
  const vMin = Math.max(0, Math.floor(Number(voiceMinutes) || 0));
  if (cExp === 0 && cCnt === 0 && vExp === 0 && vMin === 0) return null;

  const dateKey = getVnDateKey(now instanceof Date ? now : new Date(now));
  const nowIso = (now instanceof Date ? now : new Date(now)).toISOString();

  // Always maintain in-memory fallback (for offline tests or fallback reads)
  let dayMap = memoryDailyActivityStats.get(dateKey);
  if (!dayMap) {
    dayMap = new Map();
    memoryDailyActivityStats.set(dateKey, dayMap);
  }
  const prevMem = dayMap.get(cleanId) || {
    date_key: dateKey,
    user_id: cleanId,
    username: username || cleanId,
    chat_exp: 0,
    chat_count: 0,
    voice_exp: 0,
    voice_minutes: 0,
  };
  const nextMem = {
    date_key: dateKey,
    user_id: cleanId,
    username: username || prevMem.username || cleanId,
    chat_exp: prevMem.chat_exp + cExp,
    chat_count: prevMem.chat_count + cCnt,
    voice_exp: prevMem.voice_exp + vExp,
    voice_minutes: prevMem.voice_minutes + vMin,
    updated_at: nowIso,
  };
  dayMap.set(cleanId, nextMem);

  if (!supabase) return nextMem;

  try {
    const { data: ex } = await supabase
      .from('daily_activity_stats')
      .select('chat_exp, chat_count, voice_exp, voice_minutes')
      .eq('date_key', dateKey)
      .eq('user_id', cleanId)
      .maybeSingle();

    const merged = {
      date_key: dateKey,
      user_id: cleanId,
      chat_exp: Number(ex?.chat_exp || 0) + cExp,
      chat_count: Number(ex?.chat_count || 0) + cCnt,
      voice_exp: Number(ex?.voice_exp || 0) + vExp,
      voice_minutes: Number(ex?.voice_minutes || 0) + vMin,
      updated_at: nowIso,
    };

    await supabase
      .from('daily_activity_stats')
      .upsert(merged, { onConflict: 'date_key,user_id' });

    return { ...merged, username: username || cleanId };
  } catch (err) {
    console.warn('[ExpService] recordDailyActivityStat failed:', err.message);
    return nextMem;
  }
}

async function withUserLock(userId, fn) {
  const prev = userLocks.get(userId) || Promise.resolve();
  let release;
  const current = new Promise((res) => { release = res; });
  const queued = prev.then(() => current);
  userLocks.set(userId, queued);
  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (userLocks.get(userId) === queued) {
      userLocks.delete(userId);
    }
  }
}

export function resetMemoryExpStore() {
  memoryUsers.clear();
}

function randomInt(min, max, rng = Math.random) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function parseRoleIdSet(roleIds) {
  const set = new Set();
  if (!roleIds) return set;
  if (Array.isArray(roleIds)) {
    for (const r of roleIds) {
      const m = String(r).match(/[0-9]{17,20}/);
      if (m) set.add(m[0]);
    }
  } else if (typeof roleIds === 'string') {
    const matches = roleIds.match(/[0-9]{17,20}/g) || [];
    for (const m of matches) set.add(m);
  }
  return set;
}

/**
 * Tìm toàn bộ Level Role mà thành viên đã đủ cấp nhưng chưa có trên Discord (phục vụ tự động cấp bù).
 * Chỉ trả về khi `roleIdSet` có dữ liệu role thực tế từ BotGhost.
 */
export function computeMissingLevelRoleIds(level, roleIdSet) {
  if (!(roleIdSet instanceof Set) || roleIdSet.size === 0) return [];
  const lvl = Number(level) || 1;
  const missing = [];
  for (const m of LEVEL_ROLE_MILESTONES) {
    if (lvl >= m.level && !roleIdSet.has(m.roleId)) {
      missing.push(m.roleId);
    }
  }
  return missing;
}

function computeLevelProgression(startLevel, startExp, gainedExp) {
  let level = Math.max(1, Number(startLevel) || 1);
  let exp = Math.max(0, Number(startExp) || 0) + Math.max(0, Number(gainedExp) || 0);
  const previousLevel = level;

  while (level < 100) {
    const needed = getExpForNextLevel(level);
    if (exp >= needed) {
      exp -= needed;
      level += 1;
    } else {
      break;
    }
  }

  if (level >= 100) {
    level = 100;
    exp = Math.min(500000, exp);
  }

  const leveledUp = level > previousLevel;
  let unlockedRole = null;
  if (leveledUp) {
    for (const m of LEVEL_ROLE_MILESTONES) {
      if (m.level > previousLevel && m.level <= level) {
        unlockedRole = m;
      }
    }
  }

  return {
    previousLevel,
    level,
    exp,
    nextLevelExp: getExpForNextLevel(level),
    realm: getRealmByLevel(level),
    leveledUp,
    unlockedRole,
  };
}

async function computeExpMultiplier(userId, roleIdSet, userRow = null, now = new Date()) {
  // Chống bypass: Khi có Supabase, chỉ tính Buff từ Role do Bot cấp trong bảng user_roles (không đọc roleIdSet tự gắn ngoài Discord)
  const fallbackRoles = supabase ? [] : [...roleIdSet];
  const roleBuffs = await computeRoleBuffTotals(userId, Number(userRow?.level || 1), fallbackRoles, now);
  let bonus = (roleBuffs.expBonusPct || 0) / 100;

  // Buff Tiên Lữ (/marry): Nhẫn Cưới + Streak + Ngày Kỷ Niệm
  if (userRow?.marry_user_id) {
    const mBuffs = computeMarriageBuffs(userRow.marry_ring_id || 'ring_common', userRow.marry_date, now);
    bonus += (mBuffs.total_exp_bonus_pct || 0) / 100;
  }

  // Buff Gia Tộc (/giatoc) theo Clan Level 1..10
  if (userRow?.clan_id && supabase) {
    try {
      const { data: clan } = await supabase
        .from('clans')
        .select('clan_level')
        .eq('clan_id', userRow.clan_id)
        .maybeSingle();
      if (clan) {
        bonus += getClanLevelConfig(clan.clan_level).expBonusPct / 100;
      }
    } catch {
      // ignore clan buff lookup error
    }
  }

  // Buff Viền Avatar & Ảnh Nền đang trang bị (Phàm +2% • Linh +4% • Tiên +7% • Thần Thoại +10% mỗi món)
  const cosmeticBuffs = computeCosmeticBuffTotals(userRow?.avatar_frame, userRow?.background_url);
  bonus += (cosmeticBuffs.expPct || 0) / 100;

  return Number((1 + bonus).toFixed(2));
}

async function loadOrInitUser(userId, { username, fallbackUsername, avatarUrl }) {
  if (supabase) {
    const { user, initializedNewUser } = await ensureUserInitialized(userId, { username, fallbackUsername, avatarUrl });
    if (user) {
      return { user, initializedNewUser, persisted: true };
    }
  }

  let mem = memoryUsers.get(userId);
  let initializedNewUser = false;
  const resolvedName = pickCleanDisplayValue(username, fallbackUsername);
  const resolvedAvatar = pickCleanDisplayValue(avatarUrl);
  if (!mem) {
    mem = {
      user_id: userId,
      username: resolvedName || `Tu Sĩ #${userId.slice(-4)}`,
      avatar_url: resolvedAvatar || 'assets/default_avatar.png',
      level: userId === FUYUMI_USER_ID ? 100 : 1,
      exp: userId === FUYUMI_USER_ID ? 450000 : 0,
      linh_thach: userId === FUYUMI_USER_ID ? 999999 : 0,
      max_role_slots: userId === FUYUMI_USER_ID ? 5 : 1,
      last_chat_exp_at: null,
      voice_joined_at: null,
      total_voice_minutes: 0,
      starter_pet: STARTER_PET.pet_type,
    };
    memoryUsers.set(userId, mem);
    initializedNewUser = userId !== FUYUMI_USER_ID;
  } else if (userId !== FUYUMI_USER_ID) {
    if (resolvedName && (!mem.username || mem.username.startsWith('Tu Sĩ '))) {
      mem.username = resolvedName;
    }
    if (resolvedAvatar && (!mem.avatar_url || mem.avatar_url === 'assets/default_avatar.png')) {
      mem.avatar_url = resolvedAvatar;
    }
  }
  return { user: mem, initializedNewUser, persisted: false };
}

async function persistUserExpUpdate(userId, patch, persisted) {
  if (persisted && supabase) {
    const { error } = await supabase
      .from('users')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('user_id', userId);
    if (error) {
      throw new Error(`Supabase update failed: ${error.message}`);
    }
  } else {
    const mem = memoryUsers.get(userId);
    if (mem) Object.assign(mem, patch);
  }
}

/**
 * Cộng EXP khi thành viên chat (15–25 EXP, cooldown 45s)
 */
export async function grantChatExp(params = {}, opts = {}) {
  const cleanId = sanitizeUserId(params.userId || params.user_id || '');
  if (!cleanId || !/^[0-9]{17,20}$/.test(cleanId)) {
    return {
      success: false,
      status: 400,
      error: 'Invalid userId',
      message: 'Thiếu hoặc sai định dạng Discord userId (17-20 chữ số).',
    };
  }

  if (params.isBot === true || String(params.isBot).toLowerCase() === 'true') {
    return {
      success: true,
      awarded: false,
      reason: 'bot_ignored',
      leveled_up: false,
      user_id: cleanId,
    };
  }

  const roleIdSet = parseRoleIdSet(params.roleIds || params.role_ids);
  for (const locked of LOCKED_XP_ROLES) {
    if (roleIdSet.has(locked)) {
      return {
        success: true,
        awarded: false,
        reason: 'locked_xp',
        leveled_up: false,
        user_id: cleanId,
      };
    }
  }

  const nowMs = opts.now instanceof Date ? opts.now.getTime() : (typeof opts.now === 'number' ? opts.now : Date.now());
  const nowIso = new Date(nowMs).toISOString();
  const rng = typeof opts.rng === 'function' ? opts.rng : Math.random;

  return withUserLock(cleanId, async () => {
    const { user, initializedNewUser, persisted } = await loadOrInitUser(cleanId, {
      username: params.username || params.displayName || null,
      fallbackUsername: params.fallbackUsername || params.fallback_username || null,
      avatarUrl: params.avatarUrl || params.avatar_url || null,
    });

    const currentLevel = Number(user.level) || 1;
    const currentExp = Number(user.exp) || 0;

    if (user.last_chat_exp_at) {
      const lastMs = Date.parse(user.last_chat_exp_at);
      if (!Number.isNaN(lastMs)) {
        const elapsed = nowMs - lastMs;
        if (elapsed >= 0 && elapsed < CHAT_COOLDOWN_MS) {
          const missingIds = computeMissingLevelRoleIds(currentLevel, roleIdSet);
          return {
            success: true,
            awarded: false,
            reason: 'cooldown',
            cooldown_remaining_sec: Math.ceil((CHAT_COOLDOWN_MS - elapsed) / 1000),
            user_id: cleanId,
            username: user.username,
            level: currentLevel,
            exp: currentExp,
            next_level_exp: getExpForNextLevel(currentLevel),
            realm: getRealmByLevel(currentLevel),
            leveled_up: false,
            unlocked_level_role_id: missingIds[missingIds.length - 1] || '',
            sync_level_role_ids: missingIds.join(','),
            initialized_new_user: initializedNewUser,
          };
        }
      }
    }

    const multiplier = await computeExpMultiplier(cleanId, roleIdSet, user, new Date(nowMs));
    const rawGain = randomInt(CHAT_EXP_MIN, CHAT_EXP_MAX, rng);
    const expGained = Math.max(1, Math.round(rawGain * multiplier));

    const prog = computeLevelProgression(currentLevel, currentExp, expGained);
    const newMaxSlots = Math.max(Number(user.max_role_slots) || 1, getMaxRoleSlotsByLevel(prog.level));
    const currentHighestClaimed = Math.max(currentLevel, Number(user.highest_level_claimed) || 1);
    const ltReward = computeLevelUpLinhThachReward(currentHighestClaimed, prog.level);
    const newBalance = Number(user.linh_thach || 0) + ltReward.totalReward;

    const patch = {
      level: prog.level,
      exp: prog.exp,
      max_role_slots: newMaxSlots,
      last_chat_exp_at: nowIso,
    };
    if (ltReward.totalReward > 0) {
      patch.linh_thach = newBalance;
    }
    if (ltReward.newHighestClaimed > (Number(user.highest_level_claimed) || 1) && persisted) {
      patch.highest_level_claimed = ltReward.newHighestClaimed;
    }

    await persistUserExpUpdate(cleanId, patch, persisted);

    if (expGained > 0) {
      await recordDailyActivityStat(cleanId, {
        username: user.username,
        chatExp: expGained,
        chatCount: 1,
        now: new Date(nowMs),
      });
    }

    if (user.clan_id && expGained > 0) {
      await recordClanWarScore(user.clan_id, expGained);
    }
    if (persisted && expGained > 0) {
      await trackQuestActivity(cleanId, { expDelta: expGained, now: new Date(nowMs) });
    }

    const missingIds = computeMissingLevelRoleIds(prog.level, roleIdSet);
    const syncSet = new Set(missingIds);
    if (prog.unlockedRole?.roleId) syncSet.add(prog.unlockedRole.roleId);
    const syncIds = [...syncSet];

    const ltNote = ltReward.totalReward > 0
      ? ` Nhận **+${ltReward.totalReward.toLocaleString('vi-VN')}** ${em('su_linhthach')} **Linh Thạch** vượt cấp!`
      : '';

    return {
      success: true,
      awarded: true,
      source: 'chat',
      user_id: cleanId,
      username: user.username,
      exp_gained: expGained,
      multiplier,
      previous_level: prog.previousLevel,
      level: prog.level,
      exp: prog.exp,
      next_level_exp: prog.nextLevelExp,
      realm: prog.realm,
      max_role_slots: newMaxSlots,
      leveled_up: prog.leveledUp,
      level_up_linh_thach: ltReward.totalReward,
      highest_level_claimed: ltReward.newHighestClaimed,
      linh_thach: newBalance,
      unlocked_level_role_id: prog.unlockedRole?.roleId || syncIds[syncIds.length - 1] || '',
      unlocked_level_role_name: prog.unlockedRole?.name || '',
      sync_level_role_ids: syncIds.join(','),
      initialized_new_user: initializedNewUser,
      level_up_message: prog.leveledUp
        ? `${em('su_level_up')} <@${cleanId}> đột phá lên **Cấp ${prog.level}** — ${realmEmoji(prog.level)} Cảnh giới **${prog.realm}**!${ltNote}${prog.unlockedRole ? ` Mở khóa danh hiệu **${prog.unlockedRole.name}**.` : ''}`
        : '',
    };
  });
}

/**
 * Ghi nhận & cộng EXP khi thành viên hoạt động trong Voice Channel (50–100 EXP mỗi 5 phút)
 */
export async function handleVoiceExp(params = {}, opts = {}) {
  const cleanId = sanitizeUserId(params.userId || params.user_id || '');
  if (!cleanId || !/^[0-9]{17,20}$/.test(cleanId)) {
    return {
      success: false,
      status: 400,
      error: 'Invalid userId',
      message: 'Thiếu hoặc sai định dạng Discord userId (17-20 chữ số).',
    };
  }

  if (params.isBot === true || String(params.isBot).toLowerCase() === 'true') {
    return {
      success: true,
      awarded: false,
      reason: 'bot_ignored',
      leveled_up: false,
      user_id: cleanId,
    };
  }

  const roleIdSet = parseRoleIdSet(params.roleIds || params.role_ids);
  for (const locked of LOCKED_XP_ROLES) {
    if (roleIdSet.has(locked)) {
      return {
        success: true,
        awarded: false,
        reason: 'locked_xp',
        leveled_up: false,
        user_id: cleanId,
      };
    }
  }

  const action = String(params.action || 'heartbeat').trim().toLowerCase();
  if (!['join', 'leave', 'heartbeat', 'switch'].includes(action)) {
    return {
      success: false,
      status: 400,
      error: 'Invalid action',
      message: 'Hành động voice phải là một trong: join, leave, heartbeat, switch.',
    };
  }

  const nowMs = opts.now instanceof Date ? opts.now.getTime() : (typeof opts.now === 'number' ? opts.now : Date.now());
  const nowIso = new Date(nowMs).toISOString();
  const rng = typeof opts.rng === 'function' ? opts.rng : Math.random;

  return withUserLock(cleanId, async () => {
    const { user, initializedNewUser, persisted } = await loadOrInitUser(cleanId, {
      username: params.username || params.displayName || null,
      fallbackUsername: params.fallbackUsername || params.fallback_username || null,
      avatarUrl: params.avatarUrl || params.avatar_url || null,
    });

    const currentLevel = Number(user.level) || 1;
    const currentExp = Number(user.exp) || 0;

    if (action === 'join') {
      await persistUserExpUpdate(cleanId, { voice_joined_at: nowIso }, persisted);
      const joinMissing = computeMissingLevelRoleIds(currentLevel, roleIdSet);
      return {
        success: true,
        action: 'join',
        awarded: false,
        user_id: cleanId,
        username: user.username,
        level: currentLevel,
        exp: currentExp,
        next_level_exp: getExpForNextLevel(currentLevel),
        realm: getRealmByLevel(currentLevel),
        leveled_up: false,
        unlocked_level_role_id: joinMissing[joinMissing.length - 1] || '',
        sync_level_role_ids: joinMissing.join(','),
        initialized_new_user: initializedNewUser,
        voice_joined_at: nowIso,
      };
    }

    // leave / heartbeat / switch: compute elapsed minutes
    let elapsedMinutes = 0;
    let joinedMs = user.voice_joined_at ? Date.parse(user.voice_joined_at) : NaN;

    if (!Number.isNaN(joinedMs)) {
      elapsedMinutes = Math.max(0, Math.floor((nowMs - joinedMs) / 60000));
    } else if (params.minutes !== undefined && params.minutes !== null && Number.isFinite(Number(params.minutes))) {
      elapsedMinutes = Math.max(0, Math.floor(Number(params.minutes)));
    }

    elapsedMinutes = Math.min(MAX_VOICE_SESSION_MINUTES, elapsedMinutes);
    const blocks = Math.floor(elapsedMinutes / VOICE_BLOCK_MINUTES);

    let expGained = 0;
    const multiplier = blocks > 0 ? await computeExpMultiplier(cleanId, roleIdSet, user, new Date(nowMs)) : 1;
    if (blocks > 0) {
      let rawTotal = 0;
      for (let i = 0; i < blocks; i++) {
        rawTotal += randomInt(VOICE_EXP_MIN, VOICE_EXP_MAX, rng);
      }
      expGained = Math.max(1, Math.round(rawTotal * multiplier));
    }

    const prog = computeLevelProgression(currentLevel, currentExp, expGained);
    const newMaxSlots = Math.max(Number(user.max_role_slots) || 1, getMaxRoleSlotsByLevel(prog.level));
    const currentHighestClaimed = Math.max(currentLevel, Number(user.highest_level_claimed) || 1);
    const ltReward = computeLevelUpLinhThachReward(currentHighestClaimed, prog.level);
    const newBalance = Number(user.linh_thach || 0) + ltReward.totalReward;

    const rewardedMinutes = blocks * VOICE_BLOCK_MINUTES;
    const newTotalVoiceMinutes = (Number(user.total_voice_minutes) || 0) + (action === 'leave' ? elapsedMinutes : rewardedMinutes);

    let nextVoiceJoinedAt = null;
    if (action === 'leave') {
      nextVoiceJoinedAt = null;
    } else if (action === 'switch' || action === 'heartbeat') {
      if (!Number.isNaN(joinedMs) && rewardedMinutes > 0) {
        const advancedMs = joinedMs + rewardedMinutes * 60000;
        nextVoiceJoinedAt = advancedMs < nowMs - MAX_VOICE_SESSION_MINUTES * 60000
          ? nowIso
          : new Date(advancedMs).toISOString();
      } else if (!Number.isNaN(joinedMs)) {
        nextVoiceJoinedAt = user.voice_joined_at;
      } else {
        nextVoiceJoinedAt = nowIso;
      }
    }

    const patch = {
      level: prog.level,
      exp: prog.exp,
      max_role_slots: newMaxSlots,
      voice_joined_at: nextVoiceJoinedAt,
      total_voice_minutes: newTotalVoiceMinutes,
    };
    if (ltReward.totalReward > 0) {
      patch.linh_thach = newBalance;
    }
    if (ltReward.newHighestClaimed > (Number(user.highest_level_claimed) || 1) && persisted) {
      patch.highest_level_claimed = ltReward.newHighestClaimed;
    }

    await persistUserExpUpdate(cleanId, patch, persisted);

    if (expGained > 0 || elapsedMinutes > 0) {
      await recordDailyActivityStat(cleanId, {
        username: user.username,
        voiceExp: expGained,
        voiceMinutes: elapsedMinutes,
        now: new Date(nowMs),
      });
    }

    if (user.clan_id && expGained > 0) {
      await recordClanWarScore(user.clan_id, expGained);
    }
    if (persisted && expGained > 0) {
      await trackQuestActivity(cleanId, { expDelta: expGained, now: new Date(nowMs) });
    }

    const missingIds = computeMissingLevelRoleIds(prog.level, roleIdSet);
    const syncSet = new Set(missingIds);
    if (prog.unlockedRole?.roleId) syncSet.add(prog.unlockedRole.roleId);
    const syncIds = [...syncSet];

    const ltNote = ltReward.totalReward > 0
      ? ` Nhận **+${ltReward.totalReward.toLocaleString('vi-VN')}** ${em('su_linhthach')} **Linh Thạch** vượt cấp!`
      : '';

    return {
      success: true,
      action,
      source: 'voice',
      awarded: expGained > 0,
      user_id: cleanId,
      username: user.username,
      elapsed_minutes: elapsedMinutes,
      blocks_rewarded: blocks,
      total_voice_minutes: newTotalVoiceMinutes,
      exp_gained: expGained,
      multiplier,
      previous_level: prog.previousLevel,
      level: prog.level,
      exp: prog.exp,
      next_level_exp: prog.nextLevelExp,
      realm: prog.realm,
      max_role_slots: newMaxSlots,
      leveled_up: prog.leveledUp,
      level_up_linh_thach: ltReward.totalReward,
      highest_level_claimed: ltReward.newHighestClaimed,
      linh_thach: newBalance,
      unlocked_level_role_id: prog.unlockedRole?.roleId || syncIds[syncIds.length - 1] || '',
      unlocked_level_role_name: prog.unlockedRole?.name || '',
      sync_level_role_ids: syncIds.join(','),
      initialized_new_user: initializedNewUser,
      level_up_message: prog.leveledUp
        ? `${em('su_level_up')} <@${cleanId}> thiền định Voice đột phá lên **Cấp ${prog.level}** — ${realmEmoji(prog.level)} Cảnh giới **${prog.realm}**!${ltNote}${prog.unlockedRole ? ` Mở khóa danh hiệu **${prog.unlockedRole.name}**.` : ''}`
        : '',
    };
  });
}

/**
 * Quét toàn bộ tu sĩ đang treo trong phòng thoại (voice_joined_at != null) để cộng EXP định kỳ mỗi 12 phút
 */
export async function processVoiceHeartbeat(opts = {}) {
  if (!supabase) {
    return {
      success: true,
      scanned: 0,
      awarded_count: 0,
      total_exp_awarded: 0,
      total_lt_awarded: 0,
      leveled_up_users: [],
      role_grants: [],
      first_role_user_id: '',
      first_role_id: '',
      first_level_up_message: '',
    };
  }

  const { data: rows, error } = await supabase
    .from('users')
    .select('user_id')
    .not('voice_joined_at', 'is', null);

  if (error) {
    throw new Error(`Voice heartbeat scan failed: ${error.message}`);
  }

  let awardedCount = 0;
  let totalExp = 0;
  let totalLt = 0;
  const leveledUpUsers = [];

  for (const row of (rows || [])) {
    try {
      const r = await handleVoiceExp({ userId: row.user_id, action: 'heartbeat' }, opts);
      if (r.awarded) {
        awardedCount += 1;
        totalExp += Number(r.exp_gained || 0);
      }
      if (Number(r.level_up_linh_thach || 0) > 0) {
        totalLt += Number(r.level_up_linh_thach || 0);
      }
      if (r.leveled_up) {
        leveledUpUsers.push({
          user_id: r.user_id,
          level: r.level,
          level_up_message: r.level_up_message,
          unlocked_level_role_id: r.unlocked_level_role_id,
        });
      }
    } catch {
      // keep scanning other voice users
    }
  }

  const roleGrants = leveledUpUsers
    .filter((u) => u.unlocked_level_role_id)
    .map((u) => ({ user_id: u.user_id, role_id: u.unlocked_level_role_id, level: u.level }));

  return {
    success: true,
    scanned: (rows || []).length,
    awarded_count: awardedCount,
    total_exp_awarded: totalExp,
    total_lt_awarded: totalLt,
    leveled_up_users: leveledUpUsers,
    role_grants: roleGrants,
    first_role_user_id: roleGrants[0]?.user_id || '',
    first_role_id: roleGrants[0]?.role_id || '',
    first_level_up_message: leveledUpUsers[0]?.level_up_message || '',
  };
}

function fmtExpNum(v) {
  const n = Number(v || 0);
  if (Number.isInteger(n)) return n.toLocaleString('vi-VN');
  return n.toLocaleString('vi-VN', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/**
 * Thống kê toàn bộ % Boost EXP (Chat & Voice) đang hiệu lực của thành viên (/exp)
 * và tính EXP nhận được trung bình mỗi 1 tin nhắn (cooldown 45s) & mỗi 5 phút Voice.
 */
export async function getUserExpBoostSummary(rawUserId, opts = {}) {
  const now = opts.now instanceof Date ? opts.now : new Date();
  let cleanId = sanitizeUserId(rawUserId || '');
  if (!cleanId || !/^[0-9]{17,20}$/.test(cleanId)) {
    cleanId = sanitizeUserId(opts.fallbackUserId || '');
  }
  if (!cleanId || !/^[0-9]{17,20}$/.test(cleanId)) {
    return {
      success: false,
      status: 400,
      error: 'INVALID_USER_ID',
      title: `${uiEm('ui_warn')} KHÔNG THỂ TRA CỨU EXP BOOST`,
      description: 'ID thành viên không hợp lệ. Vui lòng chọn đúng thành viên hoặc bỏ trống để xem của bản thân.',
      footer: '',
    };
  }

  const fallbackName = pickCleanDisplayValue(opts.username, opts.fallbackName);
  const loaded = await loadOrInitUser(cleanId, { username: fallbackName });
  const user = loaded.user || { user_id: cleanId, level: 1, exp: 0 };
  const level = Math.max(1, Number(user.level || 1));
  const currentExp = Math.max(0, Number(user.exp || 0));
  const displayName = pickCleanDisplayValue(user.username, fallbackName) || `Tu Sĩ #${cleanId.slice(-4)}`;

  const [rolesRes, clanRes] = await Promise.all([
    supabase
      ? supabase.from('user_roles').select('role_id, role_name, is_permanent, expires_at').eq('user_id', cleanId).eq('is_equipped', true)
      : Promise.resolve({ data: [] }),
    supabase && user.clan_id
      ? supabase.from('clans').select('clan_id, clan_name, clan_tag, clan_level').eq('clan_id', user.clan_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const levelBuff = LEVEL_ROLE_BUFF_CONFIG.find((c) => level >= c.level) || null;
  const nextLevelBuff = [...LEVEL_ROLE_BUFF_CONFIG].reverse().find((c) => c.level > level) || null;
  const levelExpPct = Number(levelBuff?.expPct || 0);

  const seenRoleIds = new Set();
  const equippedRoleItems = [];
  let equippedRolesExpPct = 0;
  for (const r of (rolesRes?.data || [])) {
    const rid = String(r.role_id || '').trim();
    if (!rid || seenRoleIds.has(rid)) continue;
    const isAlive = r.is_permanent || !r.expires_at || new Date(r.expires_at) > now;
    if (!isAlive) continue;
    seenRoleIds.add(rid);
    const pct = Number(ROLE_BUFF_CONFIG[rid]?.expPct || 0);
    equippedRolesExpPct += pct;
    if (pct > 0) {
      const meta = ROLE_BY_ID[rid];
      equippedRoleItems.push({ role_id: rid, name: meta?.name || r.role_name || rid, expPct: pct });
    }
  }

  let marriageExpPct = 0;
  let marriageDetail = 'Chưa kết hôn (`/marry`)';
  if (user.marry_user_id) {
    const mBuffs = computeMarriageBuffs(user.marry_ring_id || 'ring_common', user.marry_date, now);
    marriageExpPct = Number(mBuffs?.total_exp_bonus_pct || 0);
    marriageDetail = `${mBuffs?.ring_name || 'Nhẫn Cưới'} • ${mBuffs?.married_days || 0} ngày${mBuffs?.is_anniversary_day ? ` • ${uiEm('ui_party_celebrate')} Ngày Kỷ Niệm (+10%)` : ''}`;
  }

  let clanExpPct = 0;
  let clanDetail = 'Chưa gia nhập Gia Tộc (`/giatoc`)';
  const clanRow = clanRes?.data || null;
  if (clanRow) {
    const cfg = getClanLevelConfig(clanRow.clan_level);
    clanExpPct = Number(cfg.expBonusPct || 0);
    clanDetail = `[${clanRow.clan_tag}] ${clanRow.clan_name} *(Lv.${clanRow.clan_level})*`;
  }

  const cosmeticBuffs = computeCosmeticBuffTotals(user.avatar_frame, user.background_url);
  const cosmeticExpPct = Number(cosmeticBuffs.expPct || 0);
  const cosmeticLtPct = Number(cosmeticBuffs.ltPct || 0);

  const totalChatBoostPct = levelExpPct + equippedRolesExpPct + marriageExpPct + clanExpPct + cosmeticExpPct;
  const totalVoiceBoostPct = totalChatBoostPct;
  const chatMultiplier = Number((1 + totalChatBoostPct / 100).toFixed(2));
  const voiceMultiplier = Number((1 + totalVoiceBoostPct / 100).toFixed(2));

  const baseChatAvg = (CHAT_EXP_MIN + CHAT_EXP_MAX) / 2;
  const baseVoiceAvg = (VOICE_EXP_MIN + VOICE_EXP_MAX) / 2;
  const chatMin = Math.round(CHAT_EXP_MIN * chatMultiplier);
  const chatMax = Math.round(CHAT_EXP_MAX * chatMultiplier);
  const chatAvg = Number((baseChatAvg * chatMultiplier).toFixed(1));
  const voiceMin = Math.round(VOICE_EXP_MIN * voiceMultiplier);
  const voiceMax = Math.round(VOICE_EXP_MAX * voiceMultiplier);
  const voiceAvg = Number((baseVoiceAvg * voiceMultiplier).toFixed(1));
  const voiceHourAvg = Math.round(voiceAvg * (60 / VOICE_BLOCK_MINUTES));

  const nextLevelExp = getExpForNextLevel(level);
  const remainingExp = level >= 100 ? 0 : Math.max(0, nextLevelExp - currentExp);
  const estMessages = remainingExp > 0 ? Math.ceil(remainingExp / Math.max(1, chatAvg)) : 0;
  const estVoiceMinutes = remainingExp > 0 ? Math.ceil(remainingExp / Math.max(1, voiceAvg)) * VOICE_BLOCK_MINUTES : 0;

  const realm = getRealmByLevel(level);
  const rolesText = equippedRoleItems.length > 0
    ? equippedRoleItems.map((x) => `${x.name} **(+${x.expPct}%)**`).join(', ')
    : 'Chưa đeo Role cộng EXP *(xem `/shop` / `/roll loai:role`)*';

  const desc = [
    `• **Tu Sĩ:** **${displayName}** — ${realmEmoji(level)} **Lv.${level}** *(${realm.name})*`,
    `• **Tổng Buff EXP Chat:** **+${totalChatBoostPct}%** *(Hệ số **${chatMultiplier}×**)*`,
    `• **Tổng Buff EXP Voice:** **+${totalVoiceBoostPct}%** *(Hệ số **${voiceMultiplier}×**)*`,
    '',
    `**${em('su_stats_chart')} EXP Trung Bình Thực Nhận Sau Khi Cộng Buff:**`,
    `• ${em('su_chat')} **1 Tin Nhắn Hợp Lệ** *(cooldown 45s • gốc 23–35, TB 29)*: **${chatMin} – ${chatMax} EXP** *(TB: **${fmtExpNum(chatAvg)} EXP / tin**)*`,
    `• ${em('su_voice')} **5 Phút Voice** *(chấm công 12p • gốc 85–135, TB 110)*: **${voiceMin} – ${voiceMax} EXP** *(TB: **${fmtExpNum(voiceAvg)} EXP / 5 phút** ≈ **${voiceHourAvg.toLocaleString('vi-VN')} EXP / giờ**)*`,
    '',
    `**${em('su_pin_sigil')} Chi Tiết Nguồn Buff Hiện Tại:**`,
    `• **Mốc Level Role:** ${levelBuff ? `${levelBuff.label} **(+${levelExpPct}%)**` : `**+0%** *(Cần **Lv.${nextLevelBuff?.level || 5}** để mở +${nextLevelBuff?.expPct || 3}%)*`}`,
    `• **Role Quyền Năng Đang Đeo:** ${equippedRolesExpPct > 0 ? `**+${equippedRolesExpPct}%** (${rolesText})` : `**+0%** (${rolesText})`}`,
    `• **Tiên Lữ Song Tu:** **+${marriageExpPct}%** *(${marriageDetail})*`,
    `• **Gia Tộc:** **+${clanExpPct}%** *(${clanDetail})*`,
    `• **Viền & Ảnh Nền:** **+${cosmeticExpPct}% EXP • +${cosmeticLtPct}% LT** *(Viền: ${cosmeticBuffs.frameName} +${cosmeticBuffs.frameExpPct}% • Nền: ${cosmeticBuffs.bgName} +${cosmeticBuffs.bgExpPct}%)*`,
    '',
    level >= 100
      ? `${em('su_sparkle')} **Đã đạt Cảnh Giới tối cao Lv.100!**`
      : `${uiEm('ui_clock_timer')} **Tiến độ lên Lv.${level + 1}:** Còn **${remainingExp.toLocaleString('vi-VN')} EXP** *(≈ **${estMessages.toLocaleString('vi-VN')} tin nhắn** hoặc **${estVoiceMinutes.toLocaleString('vi-VN')} phút Voice**)*`,
  ].join('\n');

  return {
    success: true,
    user_id: cleanId,
    username: displayName,
    level,
    exp: currentExp,
    next_level_exp: nextLevelExp,
    remaining_exp: remainingExp,
    chat_boost_pct: totalChatBoostPct,
    voice_boost_pct: totalVoiceBoostPct,
    chat_multiplier: chatMultiplier,
    voice_multiplier: voiceMultiplier,
    chat_exp_min: chatMin,
    chat_exp_max: chatMax,
    chat_exp_avg: chatAvg,
    voice_exp_min: voiceMin,
    voice_exp_max: voiceMax,
    voice_exp_avg: voiceAvg,
    voice_exp_hour_avg: voiceHourAvg,
    est_messages_to_next: estMessages,
    est_voice_minutes_to_next: estVoiceMinutes,
    breakdown: {
      level_exp_pct: levelExpPct,
      level_role_label: levelBuff?.label || null,
      next_level_milestone: nextLevelBuff ? { level: nextLevelBuff.level, expPct: nextLevelBuff.expPct, label: nextLevelBuff.label } : null,
      equipped_roles_exp_pct: equippedRolesExpPct,
      equipped_exp_roles: equippedRoleItems,
      marriage_exp_pct: marriageExpPct,
      clan_exp_pct: clanExpPct,
      cosmetic_exp_pct: cosmeticExpPct,
      cosmetic_lt_pct: cosmeticLtPct,
      frame_exp_pct: cosmeticBuffs.frameExpPct,
      bg_exp_pct: cosmeticBuffs.bgExpPct,
    },
    title: `${em('su_level_up')} CHỈ SỐ BOOST EXP — ${displayName.toUpperCase()}`,
    description: desc,
    footer: '',
  };
}
