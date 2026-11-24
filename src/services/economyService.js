/**
 * src/services/economyService.js
 * Hệ thống Kinh Tế Linh Thạch:
 * - /daily: Điểm danh nhận 40–60 Linh Thạch + Streak 7 ngày (theo ngày UTC+7).
 * - /doiqua: Phế Tu Vi Đổi Linh Bảo (1.000 EXP -> 10 Linh Thạch), CHO PHÉP TỤT CẤP đến tối thiểu Lv.1, 0 EXP.
 * - /roll: Gacha Pháp Bảo / Linh Thú / Role (50 Linh Thạch/lượt, 450/10 lượt, 60.5/25/14/0.5%, khóa 9 Thần Thoại Độc Nhất).
 */

import { supabase } from '../config/supabase.js';
import {
  EQUIPMENT_CATALOG,
  EQUIPMENT_BY_ID,
  PET_CATALOG,
  PET_BY_TYPE,
  LEVEL_ROLE_MILESTONES,
  MYTHIC_UNIQUE_ITEM_IDS,
  MYTHIC_UNIQUE_PET_TYPES,
  DOMAIN_CATALOG,
  DIVINE_SENSE_CATALOG,
  DIVINE_REALM_CATALOG,
  MYTHIC_UNIQUE_DOMAIN_IDS,
  MYTHIC_UNIQUE_SENSE_IDS,
  MYTHIC_UNIQUE_REALM_IDS,
  GACHA_ROLE_CATALOG,
  ROLE_GACHA_DURATION_TIERS,
  getClanLevelConfig,
  rollDefaultEnchantGrade,
} from '../data/catalog.js';
import {
  em,
  uiEm,
  tierEmoji,
  roleTierEmoji,
  itemEmoji,
  petEmoji,
  realmEmoji,
  gradeEmoji,
  domainEmoji,
  senseEmoji,
  realmEmojiById,
} from '../config/emojiHelper.js';
import {
  sanitizeUserId,
  getRealmByLevel,
  getExpForNextLevel,
  getMaxRoleSlotsByLevel,
  ensureUserInitialized,
  pickCleanDisplayValue,
  ROLE_PERKS_MAP,
  computeRoleBuffTotals,
} from './profileService.js';
import { invalidateUniqueItemCard } from './staticAssetCacheService.js';
import { getGachaDismantleValue } from './inventoryService.js';
import { DOMAIN_DISMANTLE_VALUES } from './domainService.js';
import { trackQuestActivity } from './questService.js';

export const DEFAULT_AUTOSELL_CONFIG = {
  common: false,
  rare: false,
  epic: false,
  keep_new: false,
};

export const MYTHIC_PITY_THRESHOLD = 350;
export const PITY_UNIQUE_CHANCE = 0.02;
export const PITY_ENABLED_POOLS = ['pet', 'equipment', 'domain'];

export function normalizePityState(raw) {
  let obj = raw;
  if (typeof raw === 'string') {
    try { obj = JSON.parse(raw); } catch { obj = {}; }
  }
  if (!obj || typeof obj !== 'object') obj = {};
  return {
    pet: Math.max(0, Math.floor(Number(obj.pet) || 0)),
    equipment: Math.max(0, Math.floor(Number(obj.equipment) || 0)),
    domain: Math.max(0, Math.floor(Number(obj.domain) || 0)),
  };
}

export function advanceMythicPityStep(pityObj, pool, naturalRarityKey, rng = Math.random) {
  const nextPity = normalizePityState(pityObj);
  if (!PITY_ENABLED_POOLS.includes(pool)) {
    return { nextPity, rarityKey: naturalRarityKey, pityTriggered: false, wantUnique: null };
  }
  nextPity[pool] += 1;
  if (nextPity[pool] >= MYTHIC_PITY_THRESHOLD) {
    nextPity[pool] = 0;
    const wantUnique = rng() < PITY_UNIQUE_CHANCE;
    return { nextPity, rarityKey: 'mythic', pityTriggered: true, wantUnique };
  }
  if (naturalRarityKey === 'mythic' || naturalRarityKey === 'supreme') {
    nextPity[pool] = 0;
  }
  return { nextPity, rarityKey: naturalRarityKey, pityTriggered: false, wantUnique: null };
}

export function normalizeAutoSellConfig(raw) {
  let obj = raw;
  if (typeof raw === 'string') {
    try { obj = JSON.parse(raw); } catch { obj = {}; }
  }
  if (!obj || typeof obj !== 'object') obj = {};
  return {
    common: Boolean(obj.common),
    rare: Boolean(obj.rare),
    epic: Boolean(obj.epic),
    keep_new: Boolean(obj.keep_new),
  };
}

function parseAutoSellToggle(val) {
  if (val === undefined || val === null) return undefined;
  if (typeof val === 'boolean') return val;
  const s = String(val).trim().toLowerCase();
  if (!s || /^\{/.test(s)) return undefined;
  if (['yes', 'true', '1', 'on', 'bat', 'bật', 'co', 'có'].includes(s)) return true;
  if (['no', 'false', '0', 'off', 'tat', 'tắt', 'khong', 'không'].includes(s)) return false;
  return undefined;
}

function formatAutoSellStatusLines(cfg) {
  const badge = (on) => (on ? `${uiEm('ui_toggle_on')} **BẬT** *(Tự bán)*` : `${uiEm('ui_toggle_off')} **TẮT** *(Giữ lại)*`);
  return [
    `• ${tierEmoji('common')} **Phàm Phẩm** (\`pham_pham\`): ${badge(cfg.common)}`,
    `• ${tierEmoji('rare')} **Linh Phẩm** (\`linh_pham\`): ${badge(cfg.rare)}`,
    `• ${tierEmoji('epic')} **Tiên Phẩm** (\`tien_pham\`): ${badge(cfg.epic)}`,
    `• ${tierEmoji('mythic')} **Thần Thoại:** ${uiEm('ui_lock')} **Luôn Bảo Vệ** *(Không bao giờ tự bán)*`,
    `• ${em('su_sparkle')} **Giữ Món Mới (\`giu_mon_moi\`):** ${cfg.keep_new ? `${uiEm('ui_toggle_on')} **BẬT** *(Giữ bản đầu tiên chưa sở hữu, chỉ bán khi trùng)*` : `${uiEm('ui_toggle_off')} **TẮT** *(Bán ngay cả khi chưa sở hữu)*`}`,
  ].join('\n');
}

export async function getAutoSellConfig(userId, options = {}) {
  return updateAutoSellConfig(userId, { ...options, viewOnly: true });
}

export async function updateAutoSellConfig(userId, options = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) {
    return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID người dùng không hợp lệ.' };
  }
  return withLock(cleanId, async () => {
    if (!supabase) {
      return { success: false, status: 503, error: 'DB_UNAVAILABLE', message: 'Supabase chưa sẵn sàng.' };
    }
    const { user } = await ensureUserInitialized(cleanId, {
      username: pickCleanDisplayValue(options.username, options.fallbackUsername),
      avatarUrl: pickCleanDisplayValue(options.avatarUrl),
    });
    if (!user) return { success: false, status: 500, error: 'USER_INIT_FAILED', message: 'Không thể khởi tạo hồ sơ.' };

    const cur = normalizeAutoSellConfig(user.autosell_config);
    const pCommon = parseAutoSellToggle(options.common ?? options.pham_pham ?? options.phampham);
    const pRare = parseAutoSellToggle(options.rare ?? options.linh_pham ?? options.linhpham);
    const pEpic = parseAutoSellToggle(options.epic ?? options.tien_pham ?? options.tienpham);
    const pKeepNew = parseAutoSellToggle(options.keep_new ?? options.keepNew ?? options.giu_mon_moi ?? options.giumonmoi);

    const hasChange = !options.viewOnly && (
      pCommon !== undefined || pRare !== undefined || pEpic !== undefined || pKeepNew !== undefined
    );

    const next = hasChange
      ? {
          common: pCommon !== undefined ? pCommon : cur.common,
          rare: pRare !== undefined ? pRare : cur.rare,
          epic: pEpic !== undefined ? pEpic : cur.epic,
          keep_new: pKeepNew !== undefined ? pKeepNew : cur.keep_new,
        }
      : cur;

    if (hasChange) {
      const { error } = await supabase
        .from('users')
        .update({ autosell_config: next, updated_at: new Date().toISOString() })
        .eq('user_id', cleanId);
      if (error) throw new Error(`AutoSell update failed: ${error.message}`);
    }

    return {
      success: true,
      mode: hasChange ? 'updated' : 'view',
      config: next,
      title: `${em('su_gacha_dice')} CẤU HÌNH TỰ ĐỘNG BÁN KHI /ROLL`,
      description: [
        hasChange
          ? 'Đã cập nhật quy tắc **AutoSell** áp dụng tự động cho cả **4 bể `/roll`** *(Pháp Bảo • Linh Thú • Linh Vực • Role)*:'
          : 'Trạng thái **AutoSell** hiện tại của bạn khi quay `/roll` *(chỉ giữ bậc Thần Thoại & tự kế thừa Tư Chất cao hơn trước khi bán)*:',
        '',
        formatAutoSellStatusLines(next),
        '',
        `${uiEm('ui_bulb_tip')} *Cách đổi nhanh:* \`/autosell pham_pham:Bật linh_pham:Bật giu_mon_moi:Tắt\``,
      ].join('\n'),
      message: `${hasChange ? 'Đã cập nhật' : 'Trạng thái'} AutoSell: Phàm=${next.common ? 'BẬT' : 'TẮT'} • Linh=${next.rare ? 'BẬT' : 'TẮT'} • Tiên=${next.epic ? 'BẬT' : 'TẮT'} • Giữ món mới=${next.keep_new ? 'BẬT' : 'TẮT'}`,
      footer: '',
    };
  });
}

export const DAILY_BASE_MIN = 40;
export const DAILY_BASE_MAX = 60;
export const DOIQUA_EXP_UNIT = 1000;
export const DOIQUA_LINH_THACH_PER_UNIT = 10;
export const ROLL_SINGLE_COST = 50;
export const ROLL_TEN_COST = 450;
export const GIFT_MAX_LT_PER_DAY = 5000;
export const GIFT_TAX_RATE = 0.05;
export const GIFT_MAX_ITEMS_PER_DAY = 5;
export const GIFT_MIN_SENDER_LEVEL = 10;
export const GIFT_ALLOWED_ITEMS = new Set(['gacha_ticket_equip', 'gacha_ticket_pet', 'pet_star_stone']);

export function getDailyLtGiftLimitByLevel(level) {
  const lvl = Math.max(0, Math.floor(Number(level) || 0));
  if (lvl < GIFT_MIN_SENDER_LEVEL) return 0;
  return Math.floor(lvl / 10) * GIFT_MAX_LT_PER_DAY;
}

const userLocks = new Map();

async function withLock(userId, fn) {
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
    if (userLocks.get(userId) === queued) userLocks.delete(userId);
  }
}

function getVnDateKey(date = new Date()) {
  const vnTime = new Date(date.getTime() + 7 * 3600 * 1000);
  return vnTime.toISOString().slice(0, 10);
}

function getPrevVnDateKey(date = new Date()) {
  return getVnDateKey(new Date(date.getTime() - 24 * 3600 * 1000));
}

function randomInt(min, max, rng = Math.random) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

/**
 * Tính tổng EXP tích lũy từ Lv.1 0 EXP đến trạng thái (level, exp)
 */
export function computeTotalAccumulatedExp(level, exp) {
  const lvl = Math.max(1, Number(level) || 1);
  let total = Math.max(0, Number(exp) || 0);
  for (let l = 1; l < lvl; l += 1) {
    total += getExpForNextLevel(l);
  }
  return total;
}

/**
 * Quy đổi ngược tổng EXP tích lũy thành (level, exp) mới (dừng tối thiểu ở Lv.1, 0 EXP)
 */
export function decomposeTotalExp(totalExp) {
  let remaining = Math.max(0, Math.floor(Number(totalExp) || 0));
  let level = 1;
  while (level < 100) {
    const needed = getExpForNextLevel(level);
    if (remaining >= needed) {
      remaining -= needed;
      level += 1;
    } else {
      break;
    }
  }
  if (level >= 100) {
    level = 100;
    remaining = Math.min(500000, remaining);
  }
  return {
    level,
    exp: remaining,
    nextLevelExp: getExpForNextLevel(level),
    realm: getRealmByLevel(level),
    maxRoleSlots: getMaxRoleSlotsByLevel(level),
  };
}

/**
 * Điểm danh hàng ngày (/daily)
 */
export async function claimDaily(userId, options = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) {
    return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID người dùng không hợp lệ.' };
  }

  return withLock(cleanId, async () => {
    const now = options.now instanceof Date ? options.now : new Date();
    const rng = typeof options.rng === 'function' ? options.rng : Math.random;
    const username = pickCleanDisplayValue(options.username, options.fallbackUsername);
    const avatarUrl = pickCleanDisplayValue(options.avatarUrl);

    if (!supabase) {
      return { success: false, status: 503, error: 'DB_UNAVAILABLE', message: 'Supabase chưa sẵn sàng.' };
    }

    const { user } = await ensureUserInitialized(cleanId, { username, avatarUrl });
    if (!user) return { success: false, status: 500, error: 'USER_INIT_FAILED', message: 'Không thể khởi tạo hồ sơ.' };
    const todayKey = getVnDateKey(now);
    const yesterdayKey = getPrevVnDateKey(now);
    const lastKey = user.last_daily ? getVnDateKey(new Date(user.last_daily)) : null;

    if (lastKey === todayKey) {
      return {
        success: true,
        already_claimed: true,
        streak: user.streak || 1,
        reward: 0,
        linh_thach: Number(user.linh_thach || 0),
        message: `${em('su_linhthach')} Hôm nay đạo hữu đã điểm danh rồi! Chuỗi hiện tại: **${user.streak || 1} ngày**.`,
      };
    }

    const newStreak = lastKey === yesterdayKey ? (Number(user.streak || 0) + 1) : 1;
    const cycleDay = ((newStreak - 1) % 7) + 1;
    const baseReward = randomInt(DAILY_BASE_MIN, DAILY_BASE_MAX, rng);
    const streakBonusPct = cycleDay === 7 ? 0.5 : (cycleDay - 1) * 0.05;
    let clanBonusPct = 0;
    if (user.clan_id) {
      const { data: clanRow } = await supabase.from('clans').select('clan_level').eq('clan_id', user.clan_id).maybeSingle();
      if (clanRow) clanBonusPct = getClanLevelConfig(clanRow.clan_level).ltBonusPct;
    }
    const roleBuffs = await computeRoleBuffTotals(cleanId, Number(user.level) || 1);
    const roleDailyLtPct = Number(roleBuffs?.dailyLtBonusPct || 0);
    const reward = Math.round(baseReward * (1 + streakBonusPct + clanBonusPct / 100 + roleDailyLtPct / 100));
    const newBalance = Number(user.linh_thach || 0) + reward;

    const { error } = await supabase
      .from('users')
      .update({
        linh_thach: newBalance,
        streak: newStreak,
        last_daily: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq('user_id', cleanId);

    if (error) throw new Error(`Daily update failed: ${error.message}`);

    const roleNote = roleDailyLtPct > 0 ? ` *(+${roleDailyLtPct}% Buff Role)*` : '';
    return {
      success: true,
      already_claimed: false,
      streak: newStreak,
      cycle_day: cycleDay,
      base_reward: baseReward,
      role_bonus_pct: roleDailyLtPct,
      reward,
      linh_thach: newBalance,
      message: `${em('su_sparkle')} Điểm danh ngày thứ **${newStreak}** (Chuỗi ${cycleDay}/7) thành công! Nhận **+${reward}** ${em('su_linhthach')} **Linh Thạch**${roleNote} (Số dư: **${newBalance.toLocaleString('vi-VN')}**).`,
    };
  });
}

/**
 * Phế Tu Vi Đổi Linh Bảo (/doiqua): 1.000 EXP -> 10 Linh Thạch (CHO PHÉP TỤT CẤP)
 */
export async function convertExpToLinhThach(userId, amountExp, options = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) {
    return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID người dùng không hợp lệ.' };
  }

  const parsedAmount = Math.floor(Number(amountExp) || 0);
  if (parsedAmount < DOIQUA_EXP_UNIT || parsedAmount % DOIQUA_EXP_UNIT !== 0) {
    return {
      success: false,
      status: 400,
      error: 'INVALID_EXP_AMOUNT',
      message: `Số EXP muốn phế phải là bội số của **${DOIQUA_EXP_UNIT.toLocaleString('vi-VN')}** (ví dụ: 1000, 2000, 5000).`,
    };
  }

  return withLock(cleanId, async () => {
    if (!supabase) {
      return { success: false, status: 503, error: 'DB_UNAVAILABLE', message: 'Supabase chưa sẵn sàng.' };
    }

    const { user } = await ensureUserInitialized(cleanId, {
      username: pickCleanDisplayValue(options.username, options.fallbackUsername),
      avatarUrl: pickCleanDisplayValue(options.avatarUrl),
    });
    if (!user) return { success: false, status: 500, error: 'USER_INIT_FAILED', message: 'Không thể khởi tạo hồ sơ.' };

    const oldLevel = Number(user.level || 1);
    const oldExp = Number(user.exp || 0);
    const totalAvailable = computeTotalAccumulatedExp(oldLevel, oldExp);

    if (parsedAmount > totalAvailable) {
      const maxConvertible = Math.floor(totalAvailable / DOIQUA_EXP_UNIT) * DOIQUA_EXP_UNIT;
      return {
        success: false,
        status: 400,
        error: 'INSUFFICIENT_EXP',
        total_available_exp: totalAvailable,
        max_convertible_exp: maxConvertible,
        message: `Tu vi tích lũy không đủ! Bạn chỉ có thể phế tối đa **${maxConvertible.toLocaleString('vi-VN')} EXP** (đổi được **${(maxConvertible / DOIQUA_EXP_UNIT) * DOIQUA_LINH_THACH_PER_UNIT} Linh Thạch**).`,
      };
    }

    const afterTotal = totalAvailable - parsedAmount;
    const nextState = decomposeTotalExp(afterTotal);
    const gainedLinhThach = (parsedAmount / DOIQUA_EXP_UNIT) * DOIQUA_LINH_THACH_PER_UNIT;
    const newBalance = Number(user.linh_thach || 0) + gainedLinhThach;
    const demoted = nextState.level < oldLevel;

    const revokedRoleIds = [];
    if (demoted) {
      for (const m of LEVEL_ROLE_MILESTONES) {
        if (m.level <= oldLevel && m.level > nextState.level) {
          revokedRoleIds.push(m.roleId);
        }
      }
    }

    const { error } = await supabase
      .from('users')
      .update({
        level: nextState.level,
        exp: nextState.exp,
        max_role_slots: nextState.maxRoleSlots,
        linh_thach: newBalance,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', cleanId);

    if (error) throw new Error(`Convert EXP update failed: ${error.message}`);

    return {
      success: true,
      spent_exp: parsedAmount,
      linh_thach_gained: gainedLinhThach,
      linh_thach: newBalance,
      demoted,
      old_level: oldLevel,
      new_level: nextState.level,
      old_exp: oldExp,
      new_exp: nextState.exp,
      next_level_exp: nextState.nextLevelExp,
      new_realm: nextState.realm,
      revoked_level_role_ids: revokedRoleIds,
      revoked_level_role_first: revokedRoleIds[0] || '',
      revoked_level_role_csv: revokedRoleIds.join(','),
      message: demoted
        ? `${em('su_level_up')} Phế **${parsedAmount.toLocaleString('vi-VN')} EXP** (Tụt cấp **Lv.${oldLevel} → Lv.${nextState.level}** • ${realmEmoji(nextState.level)} ${nextState.realm}), thu về **+${gainedLinhThach}** ${em('su_linhthach')} **Linh Thạch**!`
        : `${em('su_linhthach')} Phế **${parsedAmount.toLocaleString('vi-VN')} EXP** thành công (Lv.${nextState.level} • ${nextState.exp.toLocaleString('vi-VN')} EXP), thu về **+${gainedLinhThach}** ${em('su_linhthach')} **Linh Thạch**!`,
    };
  });
}

function rollRarityByRate(rng = Math.random) {
  const r = rng() * 100;
  if (r < 0.5) return 'mythic';
  if (r < 14.5) return 'epic';
  if (r < 39.5) return 'rare';
  return 'common';
}

function rollRoleDurationTier(rng = Math.random) {
  const r = rng() * 100;
  let acc = 0;
  for (const tier of ROLE_GACHA_DURATION_TIERS) {
    acc += Number(tier.pct || 0);
    if (r < acc) return tier;
  }
  return ROLE_GACHA_DURATION_TIERS[ROLE_GACHA_DURATION_TIERS.length - 1];
}

async function addInventoryQuantity(userId, itemId, category, delta) {
  const { data: existing } = await supabase
    .from('user_inventory')
    .select('quantity')
    .eq('user_id', userId)
    .eq('item_id', itemId)
    .maybeSingle();

  const nextQty = Math.max(0, Number(existing?.quantity || 0) + delta);
  if (existing) {
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

/**
 * Quay Gacha Pháp Bảo / Linh Thú (/roll)
 */
export async function rollGacha(userId, options = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) {
    return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID người dùng không hợp lệ.' };
  }

  const rawPool = String(options.pool || '').trim().toLowerCase();
  const pool = rawPool === 'pet'
    ? 'pet'
    : rawPool === 'role'
      ? 'role'
      : rawPool === 'domain'
        ? 'domain'
        : 'equipment';
  const count = Number(options.count) === 10 ? 10 : 1;
  const useTicket = Boolean(options.useTicket);
  const rng = typeof options.rng === 'function' ? options.rng : Math.random;

  return withLock(cleanId, async () => {
    if (!supabase) {
      return {
        success: false,
        status: 503,
        error: 'DB_UNAVAILABLE',
        pool,
        count,
        cost: 0,
        linh_thach: 0,
        linh_thach_fmt: '0',
        refund_linh_thach: 0,
        bonus_star_stones: 0,
        has_roles: 'false',
        add_role_csv: '',
        summary_results: '• Dịch vụ cơ sở dữ liệu tạm thời chưa sẵn sàng.',
        message: 'Supabase chưa sẵn sàng.',
      };
    }

    const { user } = await ensureUserInitialized(cleanId, {
      username: pickCleanDisplayValue(options.username, options.fallbackUsername),
      avatarUrl: pickCleanDisplayValue(options.avatarUrl),
    });
    if (!user) {
      return {
        success: false,
        status: 500,
        error: 'USER_INIT_FAILED',
        pool,
        count,
        cost: 0,
        linh_thach: 0,
        linh_thach_fmt: '0',
        refund_linh_thach: 0,
        bonus_star_stones: 0,
        has_roles: 'false',
        add_role_csv: '',
        summary_results: '• Không thể khởi tạo hồ sơ tu sĩ.',
        message: 'Không thể khởi tạo hồ sơ.',
      };
    }

    const ticketId = pool === 'pet'
      ? 'gacha_ticket_pet'
      : pool === 'equipment'
        ? 'gacha_ticket_equip'
        : pool === 'domain'
          ? 'gacha_ticket_domain'
          : null;
    const roleBuffs = await computeRoleBuffTotals(cleanId, Number(user.level) || 1);
    const gachaDiscountPct = Number(roleBuffs?.gachaDiscountPct || 0);
    const baseSingleCost = pool === 'domain' ? 60 : ROLL_SINGLE_COST;
    const baseTenCost = pool === 'domain' ? 540 : ROLL_TEN_COST;
    const baseCost = count === 10 ? baseTenCost : baseSingleCost;
    let paidWith = 'linh_thach';
    let cost = gachaDiscountPct > 0
      ? Math.max(1, Math.round(baseCost * (1 - gachaDiscountPct / 100)))
      : baseCost;

    if (useTicket && ticketId) {
      const { data: invTicket } = await supabase
        .from('user_inventory')
        .select('quantity')
        .eq('user_id', cleanId)
        .eq('item_id', ticketId)
        .maybeSingle();
      if (Number(invTicket?.quantity || 0) >= count) {
        await addInventoryQuantity(cleanId, ticketId, 'consumable', -count);
        paidWith = ticketId;
        cost = 0;
      }
    }

    if (paidWith === 'linh_thach') {
      const currentBal = Number(user.linh_thach || 0);
      if (currentBal < cost) {
        return {
          success: false,
          status: 400,
          error: 'INSUFFICIENT_LINH_THACH',
          pool,
          count,
          paid_with: paidWith,
          cost,
          required: cost,
          balance: currentBal,
          linh_thach: currentBal,
          linh_thach_fmt: currentBal.toLocaleString('vi-VN'),
          refund_linh_thach: 0,
          bonus_star_stones: 0,
          has_roles: 'false',
          add_role_ids: [],
          add_role_csv: '',
          results: [],
          summary_results: '• Chưa thể triệu hồi (không đủ Linh Thạch).',
          message: `${em('su_linhthach')} Không đủ Linh Thạch để triệu hồi! Cần **${cost.toLocaleString('vi-VN')} Linh Thạch** (hiện có **${currentBal.toLocaleString('vi-VN')}**).\n• *Mẹo tân thủ: Dùng \`/daily\` điểm danh, chat/voice tích EXP rồi \`/doiqua\`, hoặc làm \`/nhiemvu\` để nhận Linh Thạch & Vé Gacha!*`,
        };
      }
      await supabase
        .from('users')
        .update({ linh_thach: currentBal - cost, updated_at: new Date().toISOString() })
        .eq('user_id', cleanId);
      user.linh_thach = currentBal - cost;
    }

    const standardPets = PET_CATALOG.filter((p) => !p.is_exclusive_fuyumi);
    const autoSellCfg = normalizeAutoSellConfig(options.autosellOverride !== undefined ? options.autosellOverride : user.autosell_config);
    const shouldAutoSellRarity = (rk) => {
      const key = String(rk || '').toLowerCase();
      if (key === 'mythic' || key === 'supreme') return false;
      return Boolean(autoSellCfg[key]);
    };
    let pityState = normalizePityState(user.gacha_pity);
    let anyPityTriggered = false;
    const results = [];
    const addedDiscordRoleIds = new Set();
    let refundLinhThach = 0;
    let bonusStarStones = 0;
    let autoSellCount = 0;
    let autoSellLinhThach = 0;

    for (let i = 0; i < count; i += 1) {
      const naturalRarityKey = rollRarityByRate(rng);
      const pityStep = advanceMythicPityStep(pityState, pool, naturalRarityKey, rng);
      pityState = pityStep.nextPity;
      const rarityKey = pityStep.rarityKey;
      const isPityRoll = pityStep.pityTriggered;
      const wantUnique = pityStep.wantUnique;
      if (isPityRoll) anyPityTriggered = true;

      if (pool === 'role') {
        let roleCandidates = GACHA_ROLE_CATALOG.filter((r) => r.rarity_key === rarityKey);
        if (roleCandidates.length === 0) roleCandidates = GACHA_ROLE_CATALOG;
        const picked = roleCandidates[Math.floor(rng() * roleCandidates.length)];
        const durTier = rollRoleDurationTier(rng);
        const nowDate = new Date();

        const { data: userRoles } = await supabase
          .from('user_roles')
          .select('*')
          .eq('user_id', cleanId);
        const existing = (userRoles || []).find((r) => r.role_id === picked.role_id);

        if (shouldAutoSellRarity(picked.rarity_key) && (existing || !autoSellCfg.keep_new)) {
          const sellLt = getGachaDismantleValue('role', picked.rarity_key, {
            isPermanent: Boolean(durTier.isPermanent),
            remDays: durTier.days || 7,
          });
          autoSellCount += 1;
          autoSellLinhThach += sellLt;
          results.push({
            kind: 'autosell_role',
            emoji: roleTierEmoji(picked.rarity_key, tierEmoji(picked.rarity_key)),
            role_id: picked.role_id,
            name: `${picked.name} (${durTier.label})`,
            rarity: `${tierEmoji(picked.rarity_key)} ${picked.rarity}`.trim(),
            duration: durTier.key,
            sell_lt: sellLt,
          });
          continue;
        }

        if (existing?.is_permanent) {
          const dupRefund = picked.rarity_key === 'mythic' ? 250 : picked.rarity_key === 'epic' ? 100 : picked.rarity_key === 'rare' ? 35 : 15;
          const dupStone = picked.rarity_key === 'mythic' ? 3 : picked.rarity_key === 'epic' ? 2 : picked.rarity_key === 'rare' ? 1 : 0;
          refundLinhThach += dupRefund;
          bonusStarStones += dupStone;
          results.push({
            kind: 'duplicate_role_refund',
            emoji: roleTierEmoji(picked.rarity_key, tierEmoji(picked.rarity_key)),
            role_id: picked.role_id,
            name: `${picked.name} (${durTier.label})`,
            rarity: `${tierEmoji(picked.rarity_key)} ${picked.rarity}`.trim(),
            duration: durTier.key,
            refund_linh_thach: dupRefund,
            bonus_star_stones: dupStone,
          });
        } else {
          const isPermanent = Boolean(durTier.isPermanent);
          let expiresAt = null;
          if (!isPermanent) {
            const baseMs = existing?.expires_at && new Date(existing.expires_at) > nowDate
              ? new Date(existing.expires_at).getTime()
              : nowDate.getTime();
            expiresAt = new Date(baseMs + durTier.days * 86400000).toISOString();
          }

          const perk = ROLE_PERKS_MAP[picked.role_id] || picked.perk || `${em('su_sparkle')} Quyền Năng Tiên Giới`;
          const maxSlots = getMaxRoleSlotsByLevel(user.level || 1);
          const usedSlots = new Set((userRoles || [])
            .filter((r) => r.is_equipped && r.equipped_slot && (r.is_permanent || !r.expires_at || new Date(r.expires_at) > nowDate))
            .map((r) => Number(r.equipped_slot)));

          let isEquipped = Boolean(existing?.is_equipped);
          let equippedSlot = existing?.equipped_slot || null;
          if (!isEquipped) {
            for (let s = 1; s <= maxSlots; s += 1) {
              if (!usedSlots.has(s)) {
                isEquipped = true;
                equippedSlot = s;
                break;
              }
            }
          }

          if (existing) {
            await supabase
              .from('user_roles')
              .update({
                role_name: picked.name,
                role_perk: perk,
                is_permanent: isPermanent,
                expires_at: expiresAt,
                is_equipped: isEquipped,
                equipped_slot: equippedSlot,
              })
              .eq('id', existing.id);
          } else {
            await supabase.from('user_roles').insert({
              user_id: cleanId,
              role_id: picked.role_id,
              role_name: picked.name,
              role_perk: perk,
              is_permanent: isPermanent,
              expires_at: expiresAt,
              is_equipped: isEquipped,
              equipped_slot: equippedSlot,
              source: 'gacha',
              paid_price: 0,
            });
          }

          if (isEquipped) {
            addedDiscordRoleIds.add(picked.role_id);
          }

          const kind = existing && isPermanent
            ? 'upgrade_permanent'
            : existing
              ? 'stack_role'
              : 'new_role';

          results.push({
            kind,
            emoji: roleTierEmoji(picked.rarity_key, tierEmoji(picked.rarity_key)),
            role_id: picked.role_id,
            name: `${picked.name} (${durTier.label})`,
            rarity: `${tierEmoji(picked.rarity_key)} ${picked.rarity}`.trim(),
            duration: durTier.key,
            is_permanent: isPermanent,
            expires_at: expiresAt,
            equipped: isEquipped,
          });
        }
        continue;
      }

      if (pool === 'equipment') {
        let candidates = EQUIPMENT_CATALOG.filter((it) => it.rarity_key === rarityKey);
        if (rarityKey === 'mythic') {
          const { data: ownedMythics } = await supabase
            .from('user_pet_items')
            .select('item_id')
            .in('item_id', [...MYTHIC_UNIQUE_ITEM_IDS]);
          const takenSet = new Set((ownedMythics || []).map((r) => r.item_id));
          candidates = candidates.filter((c) => !(c.is_unique && takenSet.has(c.item_id)));
          if (isPityRoll) {
            const nonUniques = candidates.filter((c) => !c.is_unique);
            const availUniques = candidates.filter((c) => c.is_unique);
            if (wantUnique && availUniques.length > 0) {
              candidates = availUniques;
            } else if (nonUniques.length > 0) {
              candidates = nonUniques;
            }
          }
          if (candidates.length === 0) {
            refundLinhThach += 300;
            bonusStarStones += 5;
            results.push({
              kind: 'refund',
              emoji: tierEmoji('mythic'),
              rarity: 'Thần Thoại',
              name: 'Thần Thoại Độc Nhất Đã Hết — Hoàn Quà Bồi Thường',
              compensation: '+300 Linh Thạch & +5 Tinh Thạch Nâng Sao',
            });
            continue;
          }
        }

        const ENCHANT_GRADE_RANK = { D: 0, C: 1, B: 2, A: 3, S: 4 };
        const picked = candidates[Math.floor(rng() * candidates.length)];
        const rolledGrade = rollDefaultEnchantGrade(rng);
        const { data: ownItem } = await supabase
          .from('user_pet_items')
          .select('id, quantity, enchant_grade')
          .eq('user_id', cleanId)
          .eq('item_id', picked.item_id)
          .maybeSingle();

        if (shouldAutoSellRarity(picked.rarity_key) && (ownItem || !autoSellCfg.keep_new)) {
          let prevGrade = null;
          let upgradedGrade = false;
          if (ownItem) {
            prevGrade = String(ownItem.enchant_grade || 'D').toUpperCase();
            upgradedGrade = (ENCHANT_GRADE_RANK[rolledGrade] ?? 0) > (ENCHANT_GRADE_RANK[prevGrade] ?? 0);
            if (upgradedGrade) {
              await supabase
                .from('user_pet_items')
                .update({ enchant_grade: rolledGrade })
                .eq('id', ownItem.id);
            }
          }
          const sellLt = getGachaDismantleValue('item', picked.rarity_key);
          autoSellCount += 1;
          autoSellLinhThach += sellLt;
          results.push({
            kind: 'autosell_item',
            emoji: itemEmoji(picked.item_id, tierEmoji(picked.rarity_key)),
            grade_emoji: gradeEmoji(rolledGrade),
            enchant_grade: rolledGrade,
            prev_grade: prevGrade,
            grade_upgraded: upgradedGrade,
            item_id: picked.item_id,
            name: picked.item_name,
            rarity: `${tierEmoji(picked.rarity_key)} ${picked.rarity}`.trim(),
            slot: picked.item_type,
            sell_lt: sellLt,
          });
          continue;
        }

        if (ownItem) {
          const prevQty = Math.max(1, Number(ownItem.quantity) || 1);
          const nextQty = prevQty + 1;
          const prevGrade = String(ownItem.enchant_grade || 'D').toUpperCase();
          const upgradedGrade = (ENCHANT_GRADE_RANK[rolledGrade] ?? 0) > (ENCHANT_GRADE_RANK[prevGrade] ?? 0);
          const bestGrade = upgradedGrade ? rolledGrade : prevGrade;

          await supabase
            .from('user_pet_items')
            .update({
              quantity: nextQty,
              ...(upgradedGrade ? { enchant_grade: bestGrade } : {}),
            })
            .eq('id', ownItem.id);

          results.push({
            kind: 'duplicate_item',
            emoji: itemEmoji(picked.item_id, tierEmoji(picked.rarity_key)),
            grade_emoji: gradeEmoji(bestGrade),
            enchant_grade: bestGrade,
            rolled_grade: rolledGrade,
            prev_grade: prevGrade,
            grade_upgraded: upgradedGrade,
            quantity: nextQty,
            item_id: picked.item_id,
            name: picked.item_name,
            rarity: `${tierEmoji(picked.rarity_key)} ${picked.rarity}`.trim(),
            slot: picked.item_type,
          });
        } else {
          await supabase.from('user_pet_items').insert({
            user_id: cleanId,
            item_id: picked.item_id,
            equipped_to_pet: null,
            slot: null,
            source: 'gacha',
            paid_price: 0,
            enchant_grade: rolledGrade,
            enchant_pity: 0,
            quantity: 1,
          });
          if (picked.is_unique || MYTHIC_UNIQUE_ITEM_IDS.has(picked.item_id)) {
            invalidateUniqueItemCard(picked.item_id);
          }
          results.push({
            kind: 'new_item',
            emoji: itemEmoji(picked.item_id, tierEmoji(picked.rarity_key)),
            grade_emoji: gradeEmoji(rolledGrade),
            enchant_grade: rolledGrade,
            quantity: 1,
            item_id: picked.item_id,
            name: picked.item_name,
            rarity: `${tierEmoji(picked.rarity_key)} ${picked.rarity}`.trim(),
            slot: picked.item_type,
          });
        }
      } else if (pool === 'domain') {
        const subRoll = rng();
        const entityKind = subRoll < 0.50 ? 'domain' : subRoll < 0.75 ? 'sense' : 'realm';
        const fullPool = entityKind === 'domain' ? DOMAIN_CATALOG : entityKind === 'sense' ? DIVINE_SENSE_CATALOG : DIVINE_REALM_CATALOG;
        const uniqueSet = entityKind === 'domain' ? MYTHIC_UNIQUE_DOMAIN_IDS : entityKind === 'sense' ? MYTHIC_UNIQUE_SENSE_IDS : MYTHIC_UNIQUE_REALM_IDS;

        let candidates = fullPool.filter((x) => !x.is_exclusive_fuyumi && x.rarity_key === rarityKey);
        if (rarityKey === 'mythic') {
          const { data: takenUniqueRows } = await supabase
            .from('user_domains')
            .select('entity_id')
            .eq('entity_kind', entityKind)
            .in('entity_id', [...uniqueSet]);
          const takenSet = new Set((takenUniqueRows || []).map((r) => r.entity_id));
          candidates = candidates.filter((c) => !(c.is_unique && takenSet.has(c.id)));
          if (isPityRoll) {
            const nonUniques = candidates.filter((c) => !c.is_unique);
            const availUniques = candidates.filter((c) => c.is_unique);
            if (wantUnique && availUniques.length > 0) {
              candidates = availUniques;
            } else if (nonUniques.length > 0) {
              candidates = nonUniques;
            }
          }
          if (candidates.length === 0) {
            refundLinhThach += 300;
            bonusStarStones += 5;
            results.push({
              kind: 'refund',
              emoji: tierEmoji('mythic'),
              rarity: 'Thần Thoại',
              name: 'Linh Vực Thần Thoại Độc Nhất Đã Hết — Hoàn Quà Bồi Thường',
              compensation: '+300 Linh Thạch & +5 Tinh Thạch Nâng Sao',
            });
            continue;
          }
        }

        const picked = candidates[Math.floor(rng() * candidates.length)];
        const dIcon = entityKind === 'domain'
          ? domainEmoji(picked.id, tierEmoji(picked.rarity_key))
          : entityKind === 'sense'
            ? senseEmoji(picked.id, tierEmoji(picked.rarity_key))
            : realmEmojiById(picked.id, tierEmoji(picked.rarity_key));

        const { data: ownDomain } = await supabase
          .from('user_domains')
          .select('id, quantity')
          .eq('user_id', cleanId)
          .eq('entity_kind', entityKind)
          .eq('entity_id', picked.id)
          .maybeSingle();

        if (shouldAutoSellRarity(picked.rarity_key) && (ownDomain || !autoSellCfg.keep_new)) {
          const sellLt = DOMAIN_DISMANTLE_VALUES[picked.rarity_key] || 6;
          autoSellCount += 1;
          autoSellLinhThach += sellLt;
          results.push({
            kind: 'autosell_domain',
            emoji: dIcon,
            entity_kind: entityKind,
            entity_id: picked.id,
            name: picked.name,
            rarity: `${tierEmoji(picked.rarity_key)} ${picked.rarity}`.trim(),
            sell_lt: sellLt,
          });
          continue;
        }

        if (ownDomain) {
          const nextQty = Math.max(1, Number(ownDomain.quantity) || 1) + 1;
          await supabase
            .from('user_domains')
            .update({ quantity: nextQty, updated_at: new Date().toISOString() })
            .eq('id', ownDomain.id);
          results.push({
            kind: 'duplicate_domain',
            emoji: dIcon,
            quantity: nextQty,
            entity_kind: entityKind,
            entity_id: picked.id,
            name: picked.name,
            rarity: `${tierEmoji(picked.rarity_key)} ${picked.rarity}`.trim(),
          });
        } else {
          await supabase.from('user_domains').insert({
            user_id: cleanId,
            entity_kind: entityKind,
            entity_id: picked.id,
            quantity: 1,
            is_equipped: false,
            is_unique: Boolean(picked.is_unique),
            source: 'gacha',
          });
          results.push({
            kind: 'new_domain',
            emoji: dIcon,
            quantity: 1,
            entity_kind: entityKind,
            entity_id: picked.id,
            name: picked.name,
            rarity: `${tierEmoji(picked.rarity_key)} ${picked.rarity}`.trim(),
          });
        }
      } else {
        const ENCHANT_GRADE_RANK = { D: 0, C: 1, B: 2, A: 3, S: 4 };
        let candidates = standardPets.filter((p) => p.rarity_key === rarityKey);
        if (rarityKey === 'mythic') {
          const { data: ownedUniquePets } = await supabase
            .from('user_pets')
            .select('pet_type')
            .in('pet_type', [...MYTHIC_UNIQUE_PET_TYPES]);
          const takenPets = new Set((ownedUniquePets || []).map((r) => r.pet_type));
          candidates = candidates.filter((p) => !(p.is_unique && takenPets.has(p.pet_type)));
          if (isPityRoll) {
            const nonUniques = candidates.filter((p) => !p.is_unique);
            const availUniques = candidates.filter((p) => p.is_unique);
            if (wantUnique && availUniques.length > 0) {
              candidates = availUniques;
            } else if (nonUniques.length > 0) {
              candidates = nonUniques;
            }
          }
          if (candidates.length === 0) {
            refundLinhThach += 300;
            bonusStarStones += 5;
            results.push({
              kind: 'refund',
              emoji: tierEmoji('mythic'),
              rarity: 'Thần Thoại',
              name: 'Linh Thú Thần Thoại Độc Nhất Đã Hết — Hoàn Quà Bồi Thường',
              compensation: '+300 Linh Thạch & +5 Tinh Thạch Nâng Sao',
            });
            continue;
          }
        }
        const picked = candidates[Math.floor(rng() * candidates.length)];
        const rolledGrade = rollDefaultEnchantGrade(rng);
        const { data: ownPet } = await supabase
          .from('user_pets')
          .select('pet_id, quantity, enchant_grade')
          .eq('user_id', cleanId)
          .eq('pet_type', picked.pet_type)
          .maybeSingle();

        if (shouldAutoSellRarity(picked.rarity_key) && (ownPet || !autoSellCfg.keep_new)) {
          let prevGrade = null;
          let upgradedGrade = false;
          if (ownPet) {
            prevGrade = String(ownPet.enchant_grade || 'D').toUpperCase();
            upgradedGrade = (ENCHANT_GRADE_RANK[rolledGrade] ?? 0) > (ENCHANT_GRADE_RANK[prevGrade] ?? 0);
            if (upgradedGrade) {
              await supabase
                .from('user_pets')
                .update({ enchant_grade: rolledGrade })
                .eq('pet_id', ownPet.pet_id);
            }
          }
          const sellLt = getGachaDismantleValue('pet', picked.rarity_key);
          autoSellCount += 1;
          autoSellLinhThach += sellLt;
          results.push({
            kind: 'autosell_pet',
            emoji: petEmoji(picked.pet_type, tierEmoji(picked.rarity_key)),
            grade_emoji: gradeEmoji(rolledGrade),
            enchant_grade: rolledGrade,
            prev_grade: prevGrade,
            grade_upgraded: upgradedGrade,
            pet_type: picked.pet_type,
            name: picked.pet_name,
            rarity: `${tierEmoji(picked.rarity_key)} ${picked.rarity}`.trim(),
            element: picked.element,
            sell_lt: sellLt,
          });
          continue;
        }

        if (ownPet) {
          const prevQty = Math.max(1, Number(ownPet.quantity) || 1);
          const nextQty = prevQty + 1;
          const prevGrade = String(ownPet.enchant_grade || 'D').toUpperCase();
          const upgradedGrade = (ENCHANT_GRADE_RANK[rolledGrade] ?? 0) > (ENCHANT_GRADE_RANK[prevGrade] ?? 0);
          const bestGrade = upgradedGrade ? rolledGrade : prevGrade;

          await supabase
            .from('user_pets')
            .update({
              quantity: nextQty,
              ...(upgradedGrade ? { enchant_grade: bestGrade } : {}),
            })
            .eq('pet_id', ownPet.pet_id);

          results.push({
            kind: 'duplicate_pet',
            emoji: petEmoji(picked.pet_type, tierEmoji(picked.rarity_key)),
            grade_emoji: gradeEmoji(bestGrade),
            enchant_grade: bestGrade,
            rolled_grade: rolledGrade,
            prev_grade: prevGrade,
            grade_upgraded: upgradedGrade,
            quantity: nextQty,
            pet_type: picked.pet_type,
            name: picked.pet_name,
            rarity: `${tierEmoji(picked.rarity_key)} ${picked.rarity}`.trim(),
            element: picked.element,
          });
        } else {
          await supabase.from('user_pets').insert({
            user_id: cleanId,
            pet_name: picked.pet_name,
            pet_type: picked.pet_type,
            pet_rarity: picked.rarity,
            element: picked.element,
            hax_skill: picked.hax_skill,
            hax_description: picked.hax_description,
            level: 1,
            star: 1,
            atk: picked.base_atk,
            def: picked.base_def,
            spd: picked.base_spd,
            is_active: false,
            is_unique: Boolean(picked.is_unique),
            source: 'gacha',
            paid_price: 0,
            enchant_grade: rolledGrade,
            enchant_pity: 0,
            quantity: 1,
          });
          results.push({
            kind: 'new_pet',
            emoji: petEmoji(picked.pet_type, tierEmoji(picked.rarity_key)),
            grade_emoji: gradeEmoji(rolledGrade),
            enchant_grade: rolledGrade,
            quantity: 1,
            pet_type: picked.pet_type,
            name: picked.pet_name,
            rarity: `${tierEmoji(picked.rarity_key)} ${picked.rarity}`.trim(),
            element: picked.element,
          });
        }
      }
    }

    let finalBalance = Number(user.linh_thach || 0);
    const totalBonusLt = refundLinhThach + autoSellLinhThach;
    const nowIso = new Date().toISOString();
    const userPatch = {};
    if (totalBonusLt > 0) {
      finalBalance += totalBonusLt;
      userPatch.linh_thach = finalBalance;
    }
    if (PITY_ENABLED_POOLS.includes(pool)) {
      userPatch.gacha_pity = pityState;
    }
    if (Object.keys(userPatch).length > 0) {
      userPatch.updated_at = nowIso;
      await supabase
        .from('users')
        .update(userPatch)
        .eq('user_id', cleanId);
    }
    if (bonusStarStones > 0) {
      await addInventoryQuantity(cleanId, 'pet_star_stone', 'consumable', bonusStarStones);
    }

    const kindLabelMap = {
      new_item: 'Mới',
      new_pet: 'Mới',
      new_domain: 'Mới',
      new_role: 'Mới (Đeo/Lưu Túi)',
      stack_role: 'Cộng Dồn Ngày',
      upgrade_permanent: 'Thăng Hoa Vĩnh Viễn!',
      duplicate_item: 'Cộng Dồn Số Lượng',
      duplicate_pet: 'Cộng Dồn Số Lượng',
      duplicate_domain: 'Cộng Dồn Số Lượng',
      duplicate_role_refund: 'Đã Vĩnh Viễn (Hoàn Quà)',
      refund: 'Bồi thường',
    };
    const resultLines = results.map((r) => {
      if (r.kind === 'autosell_item' || r.kind === 'autosell_pet' || r.kind === 'autosell_domain' || r.kind === 'autosell_role') {
        const upgNote = r.grade_upgraded ? ` *(Kế thừa ${r.prev_grade} → ${r.enchant_grade}!)*` : '';
        return `• ${r.emoji || em('su_sparkle')}${r.grade_emoji ? ` ${r.grade_emoji}` : ''} **${r.name}** (${r.rarity}) — ${uiEm('ui_coin_gold')} **[AutoSell +${r.sell_lt} LT]**${upgNote}`;
      }
      if (r.kind === 'duplicate_domain') {
        return `• ${r.emoji || em('su_realm_star')} **${r.name}** (${r.rarity}) — Trùng +1 (Kho: **×${r.quantity}**)`;
      }
      if (r.kind === 'duplicate_item' || r.kind === 'duplicate_pet') {
        const gradeNote = r.grade_upgraded
          ? ` • **Kế thừa Tư Chất ${r.prev_grade} → ${r.enchant_grade}!**`
          : ` • Giữ Tư Chất ${r.enchant_grade}`;
        return `• ${r.emoji || em('su_sparkle')}${r.grade_emoji ? ` ${r.grade_emoji}` : ''} **${r.name}** (${r.rarity}) — Trùng +1 (Kho: **×${r.quantity}**)${gradeNote}`;
      }
      return `• ${r.emoji || em('su_sparkle')}${r.grade_emoji ? ` ${r.grade_emoji}` : ''} **${r.name}** (${r.rarity}) — ${kindLabelMap[r.kind] || r.kind}`;
    });
    const summaryResults = (() => {
      if (!resultLines.length) return '• Không có kết quả triệu hồi.';
      const safeLines = [];
      let totalLen = 0;
      for (const line of resultLines) {
        if (totalLen + line.length + 1 > 3500) break;
        safeLines.push(line);
        totalLen += line.length + 1;
      }
      return safeLines.join('\n');
    })();

    const roleIdsList = [...addedDiscordRoleIds];
    const poolLabel = pool === 'pet' ? 'Linh Thú' : pool === 'role' ? 'Role Quyền Năng' : pool === 'domain' ? 'Linh Vực • Thần Thức • Thần Cảnh' : 'Pháp Bảo';
    const costLabel = paidWith === 'linh_thach'
      ? `\`${cost}\` ${em('su_linhthach')}`
      : `\`${count}\` Vé Gacha (\`0\` ${em('su_linhthach')})`;
    const pityCur = PITY_ENABLED_POOLS.includes(pool) ? pityState[pool] : null;
    const pityLine = PITY_ENABLED_POOLS.includes(pool)
      ? `${em('su_realm_star')} **Pity Thần Thoại (${poolLabel})**: \`${pityCur}/${MYTHIC_PITY_THRESHOLD}\`${anyPityTriggered ? ` — ${em('su_sparkle')} **KÍCH HOẠT BẢO HIỂM THẦN THOẠI 350!**` : ''}`
      : null;
    const footerNote = roleIdsList.length > 0
      ? `${em('su_sparkle')} Đã gắn **${roleIdsList.length} Role** vào hồ sơ Discord.`
      : null;
    const dupHeaderLine = (pool === 'role' || refundLinhThach > 0 || bonusStarStones > 0)
      ? `${em('pet_star_stone')} **Hoàn trả trùng lặp**: \`+${refundLinhThach}\` Linh Thạch • \`+${bonusStarStones}\` Tinh Thạch Sao`
      : null;
    const autoSellHeaderLine = autoSellCount > 0
      ? `${uiEm('ui_coin_gold')} **AutoSell tự bán (\`/autosell\`)**: \`${autoSellCount}\` món → **+${autoSellLinhThach.toLocaleString('vi-VN')}** ${em('su_linhthach')} **Linh Thạch**`
      : null;
    const fullMessage = [
      `${em('su_gacha_dice')} **Bể quay**: \`${poolLabel}\` (\`${count}\` lượt • Chi phí ${costLabel})`,
      `${em('su_linhthach')} **Số dư còn lại**: \`${finalBalance.toLocaleString('vi-VN')}\` Linh Thạch`,
      pityLine,
      dupHeaderLine,
      autoSellHeaderLine,
      `${em('su_sparkle')} **Kết quả**:`,
      summaryResults,
      footerNote,
    ].filter(Boolean).join('\n');

    void trackQuestActivity(cleanId, { rollDelta: count });

    return {
      success: true,
      pool,
      count,
      paid_with: paidWith,
      cost,
      gacha_discount_pct: gachaDiscountPct,
      refund_linh_thach: refundLinhThach,
      autosell_count: autoSellCount,
      autosell_linh_thach: autoSellLinhThach,
      bonus_star_stones: bonusStarStones,
      pity_current: pityCur,
      pity_max: MYTHIC_PITY_THRESHOLD,
      pity_triggered: anyPityTriggered,
      gacha_pity: pityState,
      linh_thach: finalBalance,
      linh_thach_fmt: finalBalance.toLocaleString('vi-VN'),
      add_role_ids: roleIdsList,
      add_role_csv: roleIdsList.join(','),
      has_roles: roleIdsList.length > 0 ? 'true' : 'false',
      results,
      summary_results: summaryResults,
      message: fullMessage,
      footer: '',
    };
  });
}

function normalizeGiftType(rawType) {
  const s = String(rawType || '').trim().toLowerCase();
  if (s === 'linh_thach' || s === 'lt' || s === 'linhthach') return 'linh_thach';
  if (s === 'gacha_ticket_equip' || s === 've_phap_bao' || s === 'ticket_equip') return 'gacha_ticket_equip';
  if (s === 'gacha_ticket_pet' || s === 've_linh_thu' || s === 'ticket_pet') return 'gacha_ticket_pet';
  if (s === 'pet_star_stone' || s === 'tinh_thach_sao' || s === 'star_stone') return 'pet_star_stone';
  return '';
}

const GIFT_LABELS = {
  linh_thach: 'Linh Thạch',
  gacha_ticket_equip: 'Vé Rèn Pháp Bảo',
  gacha_ticket_pet: 'Vé Triệu Hồi Linh Thú',
  pet_star_stone: 'Tinh Thạch Nâng Sao',
};

/**
 * Tặng Linh Thạch hoặc Vật Phẩm cho đạo hữu khác (/tangqua)
 * - Yêu cầu người gửi đạt tối thiểu Lv.10
 * - Giới hạn Linh Thạch: 5.000 LT/ngày UTC+7 (thuế 5%)
 * - Giới hạn Vật Phẩm: 5 món/ngày UTC+7 (0% thuế)
 */
export async function sendGift(senderId, receiverId, rawGiftType, rawAmount, options = {}) {
  const cleanSender = sanitizeUserId(senderId);
  const cleanReceiver = sanitizeUserId(receiverId);
  if (!cleanSender || !cleanReceiver) {
    return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID người gửi hoặc người nhận không hợp lệ.' };
  }
  if (cleanSender === cleanReceiver) {
    return { success: false, status: 400, error: 'SELF_GIFT_FORBIDDEN', message: 'Không thể tự tặng quà cho chính mình!' };
  }

  const giftType = normalizeGiftType(rawGiftType);
  if (!giftType) {
    return {
      success: false,
      status: 400,
      error: 'INVALID_GIFT_TYPE',
      message: 'Loại quà không hợp lệ! Chỉ hỗ trợ `linh_thach`, `gacha_ticket_equip`, `gacha_ticket_pet`, `pet_star_stone`.',
    };
  }

  const amount = Math.floor(Number(rawAmount) || 0);
  if (amount <= 0) {
    return { success: false, status: 400, error: 'INVALID_AMOUNT', message: 'Số lượng quà tặng phải lớn hơn 0.' };
  }

  const [lockA, lockB] = [cleanSender, cleanReceiver].sort();
  return withLock(lockA, () => withLock(lockB, async () => {
    if (!supabase) {
      return { success: false, status: 503, error: 'DB_UNAVAILABLE', message: 'Supabase chưa sẵn sàng.' };
    }

    const now = options.now instanceof Date ? options.now : new Date();
    const giftDate = getVnDateKey(now);

    const [{ user: sender }, { user: receiver }] = await Promise.all([
      ensureUserInitialized(cleanSender, {
        username: pickCleanDisplayValue(options.senderName, options.fallbackSenderName),
        avatarUrl: pickCleanDisplayValue(options.senderAvatar),
      }),
      ensureUserInitialized(cleanReceiver, {
        username: pickCleanDisplayValue(options.receiverName, options.fallbackReceiverName),
        avatarUrl: pickCleanDisplayValue(options.receiverAvatar),
      }),
    ]);

    if (!sender || !receiver) {
      return { success: false, status: 500, error: 'USER_INIT_FAILED', message: 'Không thể khởi tạo hồ sơ tu sĩ.' };
    }

    if (Number(sender.level || 1) < GIFT_MIN_SENDER_LEVEL) {
      return {
        success: false,
        status: 400,
        error: 'LEVEL_TOO_LOW',
        required_level: GIFT_MIN_SENDER_LEVEL,
        current_level: Number(sender.level || 1),
        message: `Cần đạt tối thiểu **Lv.${GIFT_MIN_SENDER_LEVEL}** (hiện Lv.${Number(sender.level || 1)}) mới có thể sử dụng \`/tangqua\`!`,
      };
    }

    const { data: todayLogs, error: logErr } = await supabase
      .from('gift_logs')
      .select('gift_type, amount')
      .eq('sender_id', cleanSender)
      .eq('gift_date', giftDate);
    if (logErr) throw new Error(`Gift logs query failed: ${logErr.message}`);

    if (giftType === 'linh_thach') {
      const senderLevel = Number(sender.level || 1);
      const dailyLtLimit = getDailyLtGiftLimitByLevel(senderLevel);
      const sentLtToday = (todayLogs || [])
        .filter((l) => l.gift_type === 'linh_thach')
        .reduce((sum, l) => sum + Number(l.amount || 0), 0);

      if (sentLtToday + amount > dailyLtLimit) {
        const remaining = Math.max(0, dailyLtLimit - sentLtToday);
        return {
          success: false,
          status: 400,
          error: 'DAILY_LT_GIFT_LIMIT',
          sent_today: sentLtToday,
          daily_limit: dailyLtLimit,
          remaining,
          message: `Vượt hạn mức tặng Linh Thạch hôm nay (**Lv.${senderLevel}**)! Đã gửi **${sentLtToday.toLocaleString('vi-VN')}/${dailyLtLimit.toLocaleString('vi-VN')}**, còn lại **${remaining.toLocaleString('vi-VN')}** ${em('su_linhthach')}.`,
        };
      }

      const senderBal = Number(sender.linh_thach || 0);
      if (senderBal < amount) {
        return {
          success: false,
          status: 400,
          error: 'INSUFFICIENT_LINH_THACH',
          required: amount,
          balance: senderBal,
          message: `Không đủ Linh Thạch để tặng! Cần **${amount.toLocaleString('vi-VN')}**, hiện có **${senderBal.toLocaleString('vi-VN')}** ${em('su_linhthach')}.`,
        };
      }

      const taxAmount = Math.floor(amount * GIFT_TAX_RATE);
      const netReceived = amount - taxAmount;
      const nowIso = now.toISOString();
      const newSenderBal = senderBal - amount;
      const newReceiverBal = Number(receiver.linh_thach || 0) + netReceived;

      await Promise.all([
        supabase.from('users').update({ linh_thach: newSenderBal, updated_at: nowIso }).eq('user_id', cleanSender),
        supabase.from('users').update({ linh_thach: newReceiverBal, updated_at: nowIso }).eq('user_id', cleanReceiver),
        supabase.from('gift_logs').insert({
          sender_id: cleanSender,
          receiver_id: cleanReceiver,
          gift_type: 'linh_thach',
          amount,
          tax_amount: taxAmount,
          gift_date: giftDate,
        }),
      ]);

      return {
        success: true,
        gift_type: 'linh_thach',
        amount,
        tax_amount: taxAmount,
        received_amount: netReceived,
        sender_balance: newSenderBal,
        receiver_balance: newReceiverBal,
        sent_today: sentLtToday + amount,
        daily_limit: dailyLtLimit,
        message: `${em('su_sparkle')} **${sender.username}** đã tặng **${amount.toLocaleString('vi-VN')}** ${em('su_linhthach')} **Linh Thạch** cho **${receiver.username}**!\n• Thuế chuyển giao Tiên Giới (5%): **-${taxAmount.toLocaleString('vi-VN')}** • Thực nhận: **+${netReceived.toLocaleString('vi-VN')}** ${em('su_linhthach')}\n• Số dư còn lại: **${newSenderBal.toLocaleString('vi-VN')}** • Hạn mức ngày (Lv.${senderLevel}): \`${(sentLtToday + amount).toLocaleString('vi-VN')}/${dailyLtLimit.toLocaleString('vi-VN')}\``,
      };
    }

    const sentItemsToday = (todayLogs || [])
      .filter((l) => l.gift_type !== 'linh_thach')
      .reduce((sum, l) => sum + Number(l.amount || 0), 0);

    if (sentItemsToday + amount > GIFT_MAX_ITEMS_PER_DAY) {
      const remaining = Math.max(0, GIFT_MAX_ITEMS_PER_DAY - sentItemsToday);
      return {
        success: false,
        status: 400,
        error: 'DAILY_ITEM_GIFT_LIMIT',
        sent_today: sentItemsToday,
        daily_limit: GIFT_MAX_ITEMS_PER_DAY,
        remaining,
        message: `Vượt hạn mức tặng Vật Phẩm hôm nay! Đã tặng **${sentItemsToday}/${GIFT_MAX_ITEMS_PER_DAY}** món, còn lại **${remaining}** lượt.`,
      };
    }

    const { data: senderInv } = await supabase
      .from('user_inventory')
      .select('quantity')
      .eq('user_id', cleanSender)
      .eq('item_id', giftType)
      .maybeSingle();
    const senderQty = Number(senderInv?.quantity || 0);
    if (senderQty < amount) {
      return {
        success: false,
        status: 400,
        error: 'INSUFFICIENT_ITEM',
        required: amount,
        available: senderQty,
        message: `Trong túi không đủ **${GIFT_LABELS[giftType]}**! Cần **${amount}**, hiện có **${senderQty}**.`,
      };
    }

    const nextSenderQty = await addInventoryQuantity(cleanSender, giftType, 'consumable', -amount);
    const nextReceiverQty = await addInventoryQuantity(cleanReceiver, giftType, 'consumable', amount);
    await supabase.from('gift_logs').insert({
      sender_id: cleanSender,
      receiver_id: cleanReceiver,
      gift_type: giftType,
      amount,
      tax_amount: 0,
      gift_date: giftDate,
    });

    return {
      success: true,
      gift_type: giftType,
      item_name: GIFT_LABELS[giftType],
      amount,
      tax_amount: 0,
      received_amount: amount,
      sender_qty: nextSenderQty,
      receiver_qty: nextReceiverQty,
      sent_today: sentItemsToday + amount,
      daily_limit: GIFT_MAX_ITEMS_PER_DAY,
      message: `${em('su_sparkle')} **${sender.username}** đã tặng **×${amount} ${GIFT_LABELS[giftType]}** cho **${receiver.username}**!\n• Trong túi còn lại: **${nextSenderQty}** • Hạn mức vật phẩm ngày: \`${sentItemsToday + amount}/${GIFT_MAX_ITEMS_PER_DAY}\``,
    };
  }));
}

/**
 * Quét và thu hồi Role thuê hết hạn (dùng cho Cron Job 12 phút trong BotGhost):
 * - Mỗi lượt xử lý trọn bộ role hết hạn của 1 thành viên đầu tiên để BotGhost chạy `role_remove` chính xác trên Discord.
 * - Các thành viên kế tiếp sẽ được thu hồi ở các chu kỳ cron tiếp theo mà không bị sót role trên Discord.
 */
export async function cleanupExpiredRoles(options = {}) {
  if (!supabase) {
    return {
      success: false,
      status: 503,
      has_expired: 'false',
      expired_count: 0,
      target_user_id: '',
      remove_role_csv: '',
      error: 'DB_UNAVAILABLE',
      message: 'Supabase chưa sẵn sàng.',
    };
  }

  const now = options.now instanceof Date ? options.now : new Date();
  const nowIso = now.toISOString();

  const { data: expiredRows, error } = await supabase
    .from('user_roles')
    .select('id, user_id, role_id, role_name, expires_at')
    .eq('is_permanent', false)
    .not('expires_at', 'is', null)
    .lt('expires_at', nowIso)
    .order('expires_at', { ascending: true });

  if (error) throw new Error(`Cleanup expired roles query failed: ${error.message}`);

  if (!expiredRows || expiredRows.length === 0) {
    return {
      success: true,
      has_expired: 'false',
      expired_count: 0,
      remaining_users: 0,
      target_user_id: '',
      remove_role_ids: [],
      remove_role_csv: '',
      message: 'Không có Role hết hạn cần thu hồi.',
    };
  }

  const grouped = new Map();
  for (const row of expiredRows) {
    if (!grouped.has(row.user_id)) grouped.set(row.user_id, []);
    grouped.get(row.user_id).push(row);
  }

  const [targetUserId, targetRows] = grouped.entries().next().value;
  const rowIds = targetRows.map((r) => r.id).filter(Boolean);
  const removeRoleIds = [...new Set(targetRows.map((r) => String(r.role_id || '').trim()).filter(Boolean))];

  if (rowIds.length > 0) {
    const { error: delErr } = await supabase.from('user_roles').delete().in('id', rowIds);
    if (delErr) throw new Error(`Delete expired roles failed: ${delErr.message}`);
  }

  return {
    success: true,
    has_expired: removeRoleIds.length > 0 ? 'true' : 'false',
    expired_count: removeRoleIds.length,
    cleaned_rows: rowIds.length,
    remaining_users: Math.max(0, grouped.size - 1),
    target_user_id: String(targetUserId),
    remove_role_ids: removeRoleIds,
    remove_role_csv: removeRoleIds.join(','),
    message: `Đã thu hồi ${removeRoleIds.length} Role hết hạn của ${targetUserId}.`,
  };
}
