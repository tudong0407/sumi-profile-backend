/**
 * src/services/expService.js
 * Hệ thống tích lũy EXP Chat (15–25 EXP / 45s cooldown) & Voice (50–100 EXP / 5 phút).
 * Tự động khởi tạo hồ sơ tân thủ Lv.1 + Pet Phàm Phẩm mặc định (Hóa Thạch Nham Nham Thú) vào Supabase.
 */

import { supabase } from '../config/supabase.js';
import {
  FUYUMI_USER_ID,
  LEVEL_ROLE_MILESTONES,
  STARTER_PET,
} from '../data/catalog.js';
import {
  sanitizeUserId,
  getRealmByLevel,
  getExpForNextLevel,
  getMaxRoleSlotsByLevel,
  ensureUserInitialized,
} from './profileService.js';

export const CHAT_COOLDOWN_MS = 45 * 1000;
export const CHAT_EXP_MIN = 15;
export const CHAT_EXP_MAX = 25;
export const VOICE_BLOCK_MINUTES = 5;
export const VOICE_EXP_MIN = 50;
export const VOICE_EXP_MAX = 100;
export const MAX_VOICE_SESSION_MINUTES = 240;

const LOCKED_XP_ROLES = new Set([
  '1471111216423370792', // Locked XP
  '1474776271883079681', // Cách Ly
]);

const EXP_BUFF_ROLES = {
  '1573186015785521265': 0.80, // « Cửu Vĩ Yêu Hậu » +80% EXP
  '1573186087088554085': 0.15, // « Linh Hồn Tu Luyện » +15% EXP
};

// In-memory fallback store used ONLY when Supabase is unavailable
const memoryUsers = new Map();

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

async function computeExpMultiplier(userId, roleIdSet) {
  let bonus = 0;
  const seen = new Set();

  for (const rid of roleIdSet) {
    if (EXP_BUFF_ROLES[rid] && !seen.has(rid)) {
      bonus += EXP_BUFF_ROLES[rid];
      seen.add(rid);
    }
  }

  if (supabase) {
    try {
      const { data: equipped } = await supabase
        .from('user_roles')
        .select('role_id')
        .eq('user_id', userId)
        .eq('is_equipped', true);

      for (const r of equipped || []) {
        if (EXP_BUFF_ROLES[r.role_id] && !seen.has(r.role_id)) {
          bonus += EXP_BUFF_ROLES[r.role_id];
          seen.add(r.role_id);
        }
      }
    } catch {
      // ignore role buff lookup error
    }
  }

  return Number((1 + bonus).toFixed(2));
}

async function loadOrInitUser(userId, { username, avatarUrl }) {
  if (supabase) {
    const { user, initializedNewUser } = await ensureUserInitialized(userId, { username, avatarUrl });
    if (user) {
      return { user, initializedNewUser, persisted: true };
    }
  }

  let mem = memoryUsers.get(userId);
  let initializedNewUser = false;
  if (!mem) {
    mem = {
      user_id: userId,
      username: username || `Tu Sĩ #${userId.slice(-4)}`,
      avatar_url: avatarUrl || 'assets/default_avatar.png',
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

  const { user, initializedNewUser, persisted } = await loadOrInitUser(cleanId, {
    username: params.username || params.displayName || null,
    avatarUrl: params.avatarUrl || params.avatar_url || null,
  });

  const currentLevel = Number(user.level) || 1;
  const currentExp = Number(user.exp) || 0;

  if (user.last_chat_exp_at) {
    const lastMs = Date.parse(user.last_chat_exp_at);
    if (!Number.isNaN(lastMs)) {
      const elapsed = nowMs - lastMs;
      if (elapsed >= 0 && elapsed < CHAT_COOLDOWN_MS) {
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
          initialized_new_user: initializedNewUser,
        };
      }
    }
  }

  const multiplier = await computeExpMultiplier(cleanId, roleIdSet);
  const rawGain = randomInt(CHAT_EXP_MIN, CHAT_EXP_MAX, rng);
  const expGained = Math.max(1, Math.round(rawGain * multiplier));

  const prog = computeLevelProgression(currentLevel, currentExp, expGained);
  const newMaxSlots = Math.max(Number(user.max_role_slots) || 1, getMaxRoleSlotsByLevel(prog.level));

  await persistUserExpUpdate(
    cleanId,
    {
      level: prog.level,
      exp: prog.exp,
      max_role_slots: newMaxSlots,
      last_chat_exp_at: nowIso,
    },
    persisted
  );

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
    unlocked_level_role_id: prog.unlockedRole?.roleId || '',
    unlocked_level_role_name: prog.unlockedRole?.name || '',
    initialized_new_user: initializedNewUser,
    level_up_message: prog.leveledUp
      ? `🎉 <@${cleanId}> đột phá lên **Cấp ${prog.level}** — Cảnh giới **${prog.realm}**!${prog.unlockedRole ? ` Mở khóa danh hiệu **${prog.unlockedRole.name}**.` : ''}`
      : '',
  };
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

  const { user, initializedNewUser, persisted } = await loadOrInitUser(cleanId, {
    username: params.username || params.displayName || null,
    avatarUrl: params.avatarUrl || params.avatar_url || null,
  });

  const currentLevel = Number(user.level) || 1;
  const currentExp = Number(user.exp) || 0;

  if (action === 'join') {
    await persistUserExpUpdate(cleanId, { voice_joined_at: nowIso }, persisted);
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
  const multiplier = blocks > 0 ? await computeExpMultiplier(cleanId, roleIdSet) : 1;
  if (blocks > 0) {
    let rawTotal = 0;
    for (let i = 0; i < blocks; i++) {
      rawTotal += randomInt(VOICE_EXP_MIN, VOICE_EXP_MAX, rng);
    }
    expGained = Math.max(1, Math.round(rawTotal * multiplier));
  }

  const prog = computeLevelProgression(currentLevel, currentExp, expGained);
  const newMaxSlots = Math.max(Number(user.max_role_slots) || 1, getMaxRoleSlotsByLevel(prog.level));
  const rewardedMinutes = blocks * VOICE_BLOCK_MINUTES;
  const newTotalVoiceMinutes = (Number(user.total_voice_minutes) || 0) + (action === 'leave' ? elapsedMinutes : rewardedMinutes);

  let nextVoiceJoinedAt = null;
  if (action === 'leave') {
    nextVoiceJoinedAt = null;
  } else if (action === 'switch' || action === 'heartbeat') {
    if (!Number.isNaN(joinedMs) && rewardedMinutes > 0) {
      nextVoiceJoinedAt = new Date(joinedMs + rewardedMinutes * 60000).toISOString();
    } else if (!Number.isNaN(joinedMs)) {
      nextVoiceJoinedAt = user.voice_joined_at;
    } else {
      nextVoiceJoinedAt = nowIso;
    }
  }

  await persistUserExpUpdate(
    cleanId,
    {
      level: prog.level,
      exp: prog.exp,
      max_role_slots: newMaxSlots,
      voice_joined_at: nextVoiceJoinedAt,
      total_voice_minutes: newTotalVoiceMinutes,
    },
    persisted
  );

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
    unlocked_level_role_id: prog.unlockedRole?.roleId || '',
    unlocked_level_role_name: prog.unlockedRole?.name || '',
    initialized_new_user: initializedNewUser,
    level_up_message: prog.leveledUp
      ? `🎉 <@${cleanId}> thiền định Voice đột phá lên **Cấp ${prog.level}** — Cảnh giới **${prog.realm}**!${prog.unlockedRole ? ` Mở khóa danh hiệu **${prog.unlockedRole.name}**.` : ''}`
      : '',
  };
}
