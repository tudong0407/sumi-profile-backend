/**
 * src/services/luckAndFortuneService.js
 * Hệ thống 3 Lọ Luck Potion (tính theo lượt) & Gieo Quẻ Đầu Ngày /gieoque (6 bậc Khí Vận + Cầu An Giải Hạn).
 * Tuyệt đối KHÔNG dùng emoji Unicode Windows.
 */

import { supabase as _supabase } from '../config/supabase.js';
let supabase = _supabase;
import { PUBLIC_BASE_URL } from '../data/catalog.js';
import {
  LUCK_POTION_BY_ID,
  FORTUNE_TIERS,
  FORTUNE_TIER_BY_KEY,
  FORTUNE_REROLL_COST_LT,
  FORTUNE_POEMS,
} from '../data/v16ExpansionCatalog.js';
import { em, uiEm } from '../config/emojiHelper.js';
import {
  sanitizeUserId,
  ensureUserInitialized,
  pickCleanDisplayValue,
} from './profileService.js';

const luckLocks = new Map();
const memLuckBuffs = new Map();
const memDailyFortunes = new Map();
const memAbsCharmRuns = new Map();
const memLuckUsers = new Map();
let absCharmTestMode = false;

export const AUSPICIOUS_HOURS_VN = [11, 17, 21];
export const AUSPICIOUS_HOUR_LUCK_PCT = 10;
export const INCENSE_FEE_MIN_LT = 600;
export const INCENSE_FEE_MAX_LT = 800;
export const INCENSE_LUCK_MIN_PCT = 5;
export const INCENSE_LUCK_MAX_PCT = 15;
export const DAILY_STREAK_LUCK_STEP_DAYS = 7;
export const DAILY_STREAK_LUCK_STEP_PCT = 2;
export const DAILY_STREAK_LUCK_MAX_PCT = 40;

export function __setLuckTestStore(seedUsers = null) {
  supabase = seedUsers !== null ? null : _supabase;
  memLuckUsers.clear();
  memLuckBuffs.clear();
  memDailyFortunes.clear();
  if (seedUsers && typeof seedUsers === 'object') {
    for (const [uid, data] of Object.entries(seedUsers)) {
      memLuckUsers.set(String(uid), {
        user_id: String(uid),
        username: data.username || `TuSi_${uid}`,
        linh_thach: Number(data.linh_thach ?? data.coins ?? 0),
        streak: Number(data.streak || 0),
        last_daily: data.last_daily || null,
        incense_date: data.incense_date || null,
        incense_luck_pct: Number(data.incense_luck_pct || 0),
      });
      if (data.potion) memLuckBuffs.set(String(uid), { ...data.potion });
      if (data.fortune) memDailyFortunes.set(String(uid), { ...data.fortune });
    }
  }
}

export function __getLuckTestUser(userId) {
  return memLuckUsers.get(String(userId)) || null;
}

export function __setAbsCharmTestMode(enabled = true) {
  absCharmTestMode = Boolean(enabled);
  if (!enabled) memAbsCharmRuns.clear();
}

export const ABS_ENCHANT_CHARM_MAX_RUNS = 50;
export const ABS_ENCHANT_CHARM_RUNS_PER_ITEM = 5;

export async function getAbsEnchantCharmRuns(userId) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return 0;
  const db = absCharmTestMode ? null : supabase;
  if (db) {
    try {
      const { data } = await db
        .from('users')
        .select('abs_enchant_charm_runs')
        .eq('user_id', cleanId)
        .maybeSingle();
      if (data && data.abs_enchant_charm_runs !== undefined && data.abs_enchant_charm_runs !== null) {
        return Math.max(0, Number(data.abs_enchant_charm_runs || 0));
      }
    } catch { /* fallback */ }
  }
  return Math.max(0, Number(memAbsCharmRuns.get(cleanId) || 0));
}

export async function activateAbsEnchantCharm(userId, options = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID người dùng không hợp lệ.' };
  const db = absCharmTestMode ? null : supabase;

  return withLuckLock(cleanId, async () => {
    const curRuns = await getAbsEnchantCharmRuns(cleanId);
    if (curRuns >= ABS_ENCHANT_CHARM_MAX_RUNS && !options.force) {
      return {
        success: false,
        status: 409,
        error: 'CHARM_CAP_REACHED',
        message: `${em('abs_enchant_charm')} **Bùa Đá Tuyệt Ấn** đã đạt trần tối đa **${ABS_ENCHANT_CHARM_MAX_RUNS} lượt** (/explorer)! Hãy đi Khám Phá tiêu bớt trước khi bật thêm.`,
      };
    }

    if (db && !options.skipInventoryCheck) {
      const { data: invRow } = await db
        .from('user_inventory')
        .select('quantity')
        .eq('user_id', cleanId)
        .eq('item_id', 'abs_enchant_charm')
        .maybeSingle();
      const qty = Number(invRow?.quantity || 0);
      if (qty <= 0) {
        return {
          success: false,
          status: 400,
          error: 'NO_CHARM_IN_INVENTORY',
          message: `Bạn không có ${em('abs_enchant_charm')} **Bùa Đá Tuyệt Ấn** trong túi đồ! Hãy ghé \`/shop_dacbiet\` *(Chủ Nhật)* để mua.`,
        };
      }
      await db
        .from('user_inventory')
        .update({ quantity: Math.max(0, qty - 1), updated_at: new Date().toISOString() })
        .eq('user_id', cleanId)
        .eq('item_id', 'abs_enchant_charm');
    }

    const nextRuns = Math.min(ABS_ENCHANT_CHARM_MAX_RUNS, curRuns + ABS_ENCHANT_CHARM_RUNS_PER_ITEM);
    if (db) {
      await db
        .from('users')
        .update({ abs_enchant_charm_runs: nextRuns, updated_at: new Date().toISOString() })
        .eq('user_id', cleanId);
    } else {
      memAbsCharmRuns.set(cleanId, nextRuns);
    }

    return {
      success: true,
      item_id: 'abs_enchant_charm',
      remaining_runs: nextRuns,
      message: `${em('abs_enchant_charm')} Đã kích hoạt **Bùa Đá Tuyệt Ấn**! Tăng tỷ lệ rơi **Thiên Đạo Tuyệt Ấn Thạch** trong \`/explorer\` từ \`5%\` -> **\`25%\`** cho **${nextRuns} chuyến** *(Còn ${nextRuns} lượt)*!`,
    };
  });
}

export async function consumeAbsEnchantCharmRun(userId) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return { used: false, remaining: 0 };
  const db = absCharmTestMode ? null : supabase;

  return withLuckLock(cleanId, async () => {
    const curRuns = await getAbsEnchantCharmRuns(cleanId);
    if (curRuns <= 0) return { used: false, remaining: 0 };

    const remaining = Math.max(0, curRuns - 1);
    if (db) {
      await db
        .from('users')
        .update({ abs_enchant_charm_runs: remaining, updated_at: new Date().toISOString() })
        .eq('user_id', cleanId);
    } else {
      memAbsCharmRuns.set(cleanId, remaining);
    }
    return { used: true, remaining };
  });
}

async function withLuckLock(userId, fn) {
  const prev = luckLocks.get(userId) || Promise.resolve();
  let release;
  const current = new Promise((res) => { release = res; });
  const queued = prev.then(() => current);
  luckLocks.set(userId, queued);
  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (luckLocks.get(userId) === queued) luckLocks.delete(userId);
  }
}

export function getVnDateKey(date = new Date()) {
  const vnTime = new Date(date.getTime() + 7 * 3600 * 1000);
  return vnTime.toISOString().slice(0, 10);
}

export function getPrevVnDateKey(date = new Date()) {
  return getVnDateKey(new Date(date.getTime() - 24 * 3600 * 1000));
}

export function getAuspiciousHourInfo(now = new Date()) {
  const vnTime = new Date(now.getTime() + 7 * 3600 * 1000);
  const hour = vnTime.getUTCHours();
  const minute = vnTime.getUTCMinutes();
  const isActive = AUSPICIOUS_HOURS_VN.includes(hour);
  const nextHour = AUSPICIOUS_HOURS_VN.find((h) => h > hour) ?? AUSPICIOUS_HOURS_VN[0];
  const remainingMinutes = isActive ? Math.max(1, 60 - minute) : 0;
  return {
    isActive,
    hour,
    luckPct: isActive ? AUSPICIOUS_HOUR_LUCK_PCT : 0,
    remainingMinutes,
    hoursList: AUSPICIOUS_HOURS_VN,
    nextHourLabel: `${String(nextHour).padStart(2, '0')}:00${nextHour > hour ? ' hôm nay' : ' ngày mai'}`,
  };
}

export function isDailyStreakIntact(user, now = new Date()) {
  const streak = Math.max(0, Number(user?.streak || 0));
  if (streak <= 0) return false;
  if (!user?.last_daily) return false;
  const todayKey = getVnDateKey(now);
  const yesterdayKey = getPrevVnDateKey(now);
  const lastKey = getVnDateKey(new Date(user.last_daily));
  return lastKey === todayKey || lastKey === yesterdayKey;
}

export function computeDailyStreakLuckPct(user, now = new Date()) {
  if (!isDailyStreakIntact(user, now)) return 0;
  const streak = Math.max(0, Number(user?.streak || 0));
  return Math.min(
    DAILY_STREAK_LUCK_MAX_PCT,
    Math.floor(streak / DAILY_STREAK_LUCK_STEP_DAYS) * DAILY_STREAK_LUCK_STEP_PCT,
  );
}

export function computeSpiritIncenseCostLt(baseLuckPct = 0) {
  const safeLuck = Math.max(0, Number(baseLuckPct) || 0);
  return Math.max(INCENSE_FEE_MIN_LT, Math.min(INCENSE_FEE_MAX_LT, Math.round(INCENSE_FEE_MAX_LT - safeLuck * 2)));
}

function getCountdownToMidnightVn(now = new Date()) {
  const vnMs = now.getTime() + 7 * 3600 * 1000;
  const msInDay = 86400000;
  const rem = msInDay - (vnMs % msInDay);
  const hrs = Math.floor(rem / 3600000);
  const mins = Math.floor((rem % 3600000) / 60000);
  return `${hrs}g ${String(mins).padStart(2, '0')}p`;
}

function pickWeightedFortuneTier(tiers, weightField, rng = Math.random) {
  const total = tiers.reduce((sum, t) => sum + Number(t[weightField] || 0), 0);
  let r = rng() * total;
  for (const t of tiers) {
    const w = Number(t[weightField] || 0);
    if (w <= 0) continue;
    if (r < w) return t;
    r -= w;
  }
  return tiers.find((t) => Number(t[weightField] || 0) > 0) || FORTUNE_TIERS[2];
}

export async function getUserLuckBuff(userId) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return null;
  if (supabase) {
    try {
      const { data } = await supabase
        .from('user_luck_buffs')
        .select('*')
        .eq('user_id', cleanId)
        .maybeSingle();
      if (!data || Number(data.remaining_charges || 0) <= 0) return null;
      return {
        potion_id: data.potion_id,
        luck_bonus_pct: Number(data.luck_bonus_pct || 0),
        remaining_charges: Number(data.remaining_charges || 0),
      };
    } catch {
      return null;
    }
  }
  const m = memLuckBuffs.get(cleanId);
  return (m && m.remaining_charges > 0) ? m : null;
}

export async function getUserDailyFortune(userId, now = new Date()) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return null;
  const todayKey = getVnDateKey(now);
  if (supabase) {
    try {
      const { data } = await supabase
        .from('user_daily_fortunes')
        .select('*')
        .eq('user_id', cleanId)
        .maybeSingle();
      if (!data || data.fortune_date !== todayKey) return null;
      return data;
    } catch {
      return null;
    }
  }
  const m = memDailyFortunes.get(cleanId);
  return (m && m.fortune_date === todayKey) ? m : null;
}

async function getUserLuckProfileFields(userId) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return null;
  if (supabase) {
    try {
      const { data } = await supabase
        .from('users')
        .select('user_id, username, linh_thach, streak, last_daily, incense_date, incense_luck_pct')
        .eq('user_id', cleanId)
        .maybeSingle();
      return data || null;
    } catch {
      return null;
    }
  }
  return memLuckUsers.get(cleanId) || null;
}

/**
 * Tổng hợp Buff Luck & Khí Vận đang có hiệu lực cho 1 user (5 nguồn Luck đồng bộ toàn server)
 */
export async function getEffectiveLuckAndFortune(userId, now = new Date()) {
  const [potion, fortune, userRow] = await Promise.all([
    getUserLuckBuff(userId),
    getUserDailyFortune(userId, now),
    getUserLuckProfileFields(userId),
  ]);

  const todayKey = getVnDateKey(now);
  const potionMeta = potion ? LUCK_POTION_BY_ID[potion.potion_id] : null;
  const potionLuckPct = potion ? Number(potion.luck_bonus_pct || 0) : 0;
  const potionCharges = potion ? Number(potion.remaining_charges || 0) : 0;

  const fTier = fortune ? (FORTUNE_TIER_BY_KEY[fortune.tier_key] || null) : null;
  const fortuneExpPct = fortune ? Number(fortune.exp_pct || 0) : 0;
  const fortuneLtPct = fortune ? Number(fortune.lt_pct || 0) : 0;
  const fortuneLuckPct = fortune ? Number(fortune.luck_pct || 0) : 0;

  const streakIntact = isDailyStreakIntact(userRow, now);
  const dailyStreak = streakIntact ? Math.max(0, Number(userRow?.streak || 0)) : 0;
  const dailyStreakLuckPct = computeDailyStreakLuckPct(userRow, now);

  const auspicious = getAuspiciousHourInfo(now);
  const auspiciousHourLuckPct = auspicious.luckPct;

  const incenseActiveToday = Boolean(
    userRow?.incense_date === todayKey && Number(userRow?.incense_luck_pct || 0) > 0,
  );
  const incenseLuckPct = incenseActiveToday ? Number(userRow.incense_luck_pct || 0) : 0;

  const nonPotionLuckPct = fortuneLuckPct + dailyStreakLuckPct + auspiciousHourLuckPct + incenseLuckPct;
  const totalLuckPct = potionLuckPct + nonPotionLuckPct;
  const luckMultiplier = Math.max(0.5, Number((1 + totalLuckPct / 100).toFixed(4)));

  return {
    potionId: potion?.potion_id || null,
    potionName: potionMeta?.name || null,
    potionLuckPct,
    potionCharges,
    fortuneTier: fTier?.tier_key || null,
    fortuneName: fTier?.name || null,
    fortuneExpPct,
    fortuneLtPct,
    fortuneLuckPct,
    fortuneRerolled: Boolean(fortune?.rerolled),
    dailyStreak,
    dailyStreakLuckPct,
    auspiciousHourActive: auspicious.isActive,
    auspiciousHourLuckPct,
    auspiciousHourRemainingMinutes: auspicious.remainingMinutes,
    auspiciousNextHour: auspicious.nextHourLabel,
    incenseActiveToday,
    incenseDate: incenseActiveToday ? userRow.incense_date : null,
    incenseLuckPct,
    nonPotionLuckPct,
    totalLuckPct,
    luckMultiplier,
  };
}

export function formatLuckSummaryLines(luckInfo = {}, { compact = false } = {}) {
  const total = Number(luckInfo.totalLuckPct || 0);
  const totalLabel = `${total >= 0 ? '+' : ''}${total}%`;
  const spark = em('su_sparkle');
  const bell = em('auspicious_hour_bell', spark);
  const incense = em('spirit_incense_burner', spark);

  const parts = [];
  if (Number(luckInfo.potionCharges || 0) > 0) {
    parts.push(`${em(luckInfo.potionId || 'potion_luck_minor')} Linh Lộ **+${luckInfo.potionLuckPct}%** *(${luckInfo.potionCharges} lượt)*`);
  }
  if (luckInfo.fortuneName) {
    const fSign = luckInfo.fortuneLuckPct >= 0 ? '+' : '';
    parts.push(`Quẻ ${luckInfo.fortuneName} **${fSign}${luckInfo.fortuneLuckPct}%**`);
  }
  if (Number(luckInfo.dailyStreakLuckPct || 0) > 0) {
    parts.push(`Chuỗi \`${luckInfo.dailyStreak}\` ngày **+${luckInfo.dailyStreakLuckPct}%**`);
  }
  if (luckInfo.auspiciousHourActive) {
    parts.push(`${bell} Giờ Hoàng Đạo **+${luckInfo.auspiciousHourLuckPct}%** *(còn ${luckInfo.auspiciousHourRemainingMinutes}p)*`);
  }
  if (Number(luckInfo.incenseLuckPct || 0) > 0) {
    parts.push(`${incense} Linh Hương **+${luckInfo.incenseLuckPct}%**`);
  }

  if (compact) {
    return parts.length > 0
      ? `${spark} **Tổng Luck:** \`${totalLabel}\` *(${parts.join(' • ')})*`
      : `${spark} **Tổng Luck:** \`+0%\` *(Uống Linh Lộ, \`/gieoque\`, \`/thaplinhhuong\` hoặc chờ Giờ Hoàng Đạo \`11h/17h/21h\`)*`;
  }

  const lines = [
    `${spark} **Tổng Luck Hiện Tại:** \`${totalLabel}\` *(Nhân \`×${Number(luckInfo.luckMultiplier || 1).toFixed(2)}\` cho Gacha, Đổ Thạch & Ké Chén Trà)*`,
  ];
  if (parts.length > 0) {
    lines.push(`• **Chi tiết 5 nguồn:** ${parts.join(' • ')}`);
  } else {
    lines.push(`• *Chưa kích hoạt nguồn Luck nào — thử \`/daily\`, \`/gieoque\`, \`/thaplinhhuong\` hoặc săn Giờ Hoàng Đạo \`11h • 17h • 21h\`!*`);
  }
  return lines.join('\n');
}

/**
 * Kích hoạt / uống 1 Lọ Luck Potion từ kho đồ (trừ 1 bình trong user_inventory, cộng lượt tối đa 200)
 */
export async function activateLuckPotion(userId, potionId, options = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID người dùng không hợp lệ.' };

  const potion = LUCK_POTION_BY_ID[String(potionId || '').trim().toLowerCase()];
  if (!potion) {
    return { success: false, status: 404, error: 'POTION_NOT_FOUND', message: `Không tìm thấy Linh Lộ '${potionId}'.` };
  }

  return withLuckLock(cleanId, async () => {
    const existing = await getUserLuckBuff(cleanId);
    if (existing && existing.remaining_charges > 0 && existing.potion_id !== potion.item_id && !options.forceReplace) {
      const curMeta = LUCK_POTION_BY_ID[existing.potion_id];
      return {
        success: false,
        status: 409,
        error: 'DIFFERENT_POTION_ACTIVE',
        message: `${em('su_sparkle')} Bạn đang bật **${curMeta?.name || existing.potion_id}** (**+${existing.luck_bonus_pct}% Luck**, còn **${existing.remaining_charges} lượt**). Hãy dùng hết lượt trước khi uống loại khác để tránh lãng phí!`,
      };
    }

    if (supabase) {
      const { data: invRow } = await supabase
        .from('user_inventory')
        .select('quantity')
        .eq('user_id', cleanId)
        .eq('item_id', potion.item_id)
        .maybeSingle();

      const qty = Number(invRow?.quantity || 0);
      if (qty <= 0 && !options.skipInventoryCheck) {
        return {
          success: false,
          status: 400,
          error: 'NO_POTION_IN_INVENTORY',
          message: `Bạn không có **${potion.name}** trong túi đồ! Hãy ghé \`/shop\` *(Quầy Vật Phẩm Tiêu Hao)* để mua.`,
        };
      }

      if (!options.skipInventoryCheck) {
        await supabase
          .from('user_inventory')
          .update({ quantity: Math.max(0, qty - 1), updated_at: new Date().toISOString() })
          .eq('user_id', cleanId)
          .eq('item_id', potion.item_id);
      }

      const nextCharges = existing && existing.potion_id === potion.item_id
        ? Math.min(200, existing.remaining_charges + potion.charges)
        : potion.charges;

      await supabase
        .from('user_luck_buffs')
        .upsert({
          user_id: cleanId,
          potion_id: potion.item_id,
          luck_bonus_pct: potion.luck_bonus_pct,
          remaining_charges: nextCharges,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

      return {
        success: true,
        potion_id: potion.item_id,
        potion_name: potion.name,
        luck_bonus_pct: potion.luck_bonus_pct,
        remaining_charges: nextCharges,
        image_url: `${PUBLIC_BASE_URL}/assets/${potion.image_file}?v=1.6`,
        message: `${potion.icon} Đã uống **${potion.name}**! Kích hoạt **+${potion.luck_bonus_pct}% Luck** cho **${nextCharges} lượt** \`/roll\` hoặc \`/dothach\` *(cộng dồn với Quẻ \`/gieoque\`)*!`,
      };
    }

    const nextCharges = existing && existing.potion_id === potion.item_id
      ? Math.min(200, existing.remaining_charges + potion.charges)
      : potion.charges;
    memLuckBuffs.set(cleanId, {
      potion_id: potion.item_id,
      luck_bonus_pct: potion.luck_bonus_pct,
      remaining_charges: nextCharges,
    });
    return {
      success: true,
      potion_id: potion.item_id,
      potion_name: potion.name,
      luck_bonus_pct: potion.luck_bonus_pct,
      remaining_charges: nextCharges,
      image_url: `${PUBLIC_BASE_URL}/assets/${potion.image_file}?v=1.6`,
      message: `${potion.icon} Đã uống **${potion.name}**! Kích hoạt **+${potion.luck_bonus_pct}% Luck** cho **${nextCharges} lượt** \`/roll\` hoặc \`/dothach\`!`,
    };
  });
}

/**
 * Tiêu hao số lượt Luck Potion khi /roll hoặc /dothach
 */
export async function consumeLuckCharges(userId, requestedCount = 1) {
  const cleanId = sanitizeUserId(userId);
  const count = Math.max(1, Math.floor(Number(requestedCount) || 1));
  if (!cleanId) return { chargesUsed: 0, luckPctApplied: 0, remainingCharges: 0, potionName: null };

  return withLuckLock(cleanId, async () => {
    const existing = await getUserLuckBuff(cleanId);
    if (!existing || existing.remaining_charges <= 0) {
      return { chargesUsed: 0, luckPctApplied: 0, remainingCharges: 0, potionName: null };
    }

    const used = Math.min(existing.remaining_charges, count);
    const remaining = Math.max(0, existing.remaining_charges - used);
    const meta = LUCK_POTION_BY_ID[existing.potion_id];

    if (supabase) {
      await supabase
        .from('user_luck_buffs')
        .update({ remaining_charges: remaining, updated_at: new Date().toISOString() })
        .eq('user_id', cleanId);
    } else {
      memLuckBuffs.set(cleanId, { ...existing, remaining_charges: remaining });
    }

    return {
      chargesUsed: used,
      luckPctApplied: Number(existing.luck_bonus_pct || 0),
      remainingCharges: remaining,
      potionName: meta?.name || existing.potion_id,
    };
  });
}

function formatFortunePayload(row, user, { alreadyDrawn = false, rerolledJustNow = false, now = new Date(), luckInfo = null } = {}) {
  const tier = FORTUNE_TIER_BY_KEY[row.tier_key] || FORTUNE_TIERS[2];
  const poems = FORTUNE_POEMS[tier.tier_key] || FORTUNE_POEMS.binh_an;
  const poem = poems[Number(row.poem_idx || 0) % poems.length];
  const fmtPct = (v) => (v > 0 ? `+${v}%` : `${v}%`);
  const canReroll = Boolean(tier.can_reroll) && !row.rerolled;

  const lines = [
    `${em('su_wiki_scroll')} *Thiên cơ ứng nghiệm ngày **${row.fortune_date}** — dành cho **${user?.username || 'Đạo Hữu'}***`,
    '',
    `> *${poem.split('\n').join('*\n> *')}*`,
    '',
    `**Khí Vận Hôm Nay (${tier.name}):**`,
    `• **EXP Tu Luyện:** \`${fmtPct(row.exp_pct)}\` *(Chat & Voice)*`,
    `• **Linh Thạch Nhận:** \`${fmtPct(row.lt_pct)}\` *(/daily, /job, /explorer, Tháp)*`,
    `• **Luck Gacha & Đổ Thạch:** \`${fmtPct(row.luck_pct)}\` *(cộng dồn với 4 nguồn Luck còn lại)*`,
    luckInfo ? formatLuckSummaryLines(luckInfo, { compact: true }) : '',
    '',
    rerolledJustNow
      ? `${em('su_sparkle')} **Cầu An Giải Hạn thành công!** Quẻ mới đã ứng nghiệm cho hôm nay.`
      : canReroll
        ? `${em('su_linhthach')} Dính quẻ **${tier.name}** — có thể bấm **Cầu An Giải Hạn (${FORTUNE_REROLL_COST_LT} LT)** bên dưới *(1 lần/ngày)* để gieo lại!`
        : alreadyDrawn
          ? `${em('su_realm_star')} Hôm nay bạn đã gieo quẻ rồi • Quẻ mới mở lại sau \`${getCountdownToMidnightVn(now)}\` *(00:00 UTC+7)*.`
          : `${em('su_realm_star')} Chúc đạo hữu một ngày tu hành thuận lợi • Reset lúc \`00:00 UTC+7\`.`,
  ].filter((x, i, arr) => x !== '' || (i > 0 && arr[i - 1] !== ''));

  return {
    success: true,
    already_drawn: alreadyDrawn,
    rerolled_just_now: rerolledJustNow,
    can_reroll: canReroll,
    reroll_cost_lt: FORTUNE_REROLL_COST_LT,
    fortune_date: row.fortune_date,
    tier_key: tier.tier_key,
    tier_name: tier.name,
    exp_pct: Number(row.exp_pct || 0),
    lt_pct: Number(row.lt_pct || 0),
    luck_pct: Number(row.luck_pct || 0),
    title: `${em('su_realm_star')} QUẺ KHÍ VẬN HÔM NAY: ${tier.name.toUpperCase()}`,
    description: lines.join('\n'),
    color: tier.color,
    shake_gif_url: `${PUBLIC_BASE_URL}/assets/fortune/oracle_shake.gif?v=1.6`,
    image_url: `${PUBLIC_BASE_URL}/assets/${tier.image_file}?v=1.6`,
    footer: '',
  };
}

/**
 * Gieo Quẻ Đầu Ngày (/gieoque)
 */
export async function drawDailyFortune(userId, options = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID người dùng không hợp lệ.' };

  const now = options.now instanceof Date ? options.now : new Date();
  const rng = typeof options.rng === 'function' ? options.rng : Math.random;

  return withLuckLock(cleanId, async () => {
    let user = { user_id: cleanId, username: pickCleanDisplayValue(options.username, options.fallbackUsername) || 'Đạo Hữu' };
    if (supabase) {
      const init = await ensureUserInitialized(cleanId, {
        username: pickCleanDisplayValue(options.username, options.fallbackUsername),
        avatarUrl: pickCleanDisplayValue(options.avatarUrl),
      });
      if (init.user) user = init.user;
    }

    const existing = await getUserDailyFortune(cleanId, now);
    if (existing) {
      const curLuck = await getEffectiveLuckAndFortune(cleanId, now).catch(() => null);
      return formatFortunePayload(existing, user, { alreadyDrawn: true, now, luckInfo: curLuck });
    }

    const todayKey = getVnDateKey(now);
    const tier = options.forceTierKey && FORTUNE_TIER_BY_KEY[options.forceTierKey]
      ? FORTUNE_TIER_BY_KEY[options.forceTierKey]
      : pickWeightedFortuneTier(FORTUNE_TIERS, 'weight', rng);
    const poems = FORTUNE_POEMS[tier.tier_key] || FORTUNE_POEMS.binh_an;
    const poemIdx = Math.floor(rng() * poems.length);

    const record = {
      user_id: cleanId,
      fortune_date: todayKey,
      tier_key: tier.tier_key,
      poem_idx: poemIdx,
      exp_pct: tier.exp_pct,
      lt_pct: tier.lt_pct,
      luck_pct: tier.luck_pct,
      rerolled: false,
    };

    if (supabase) {
      await supabase
        .from('user_daily_fortunes')
        .upsert({ ...record, created_at: now.toISOString() }, { onConflict: 'user_id' });
    } else {
      memDailyFortunes.set(cleanId, record);
    }

    const curLuck = await getEffectiveLuckAndFortune(cleanId, now).catch(() => null);
    return formatFortunePayload(record, user, { alreadyDrawn: false, now, luckInfo: curLuck });
  });
}

/**
 * Cầu An Giải Hạn (250 LT — chỉ áp dụng khi dính Hung hoặc Đại Hung, tối đa 1 lần/ngày)
 */
export async function rerollDailyFortune(userId, options = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID người dùng không hợp lệ.' };

  const now = options.now instanceof Date ? options.now : new Date();
  const rng = typeof options.rng === 'function' ? options.rng : Math.random;

  return withLuckLock(cleanId, async () => {
    let user = { user_id: cleanId, username: pickCleanDisplayValue(options.username, options.fallbackUsername) || 'Đạo Hữu', linh_thach: 99999 };
    if (supabase) {
      const init = await ensureUserInitialized(cleanId, {
        username: pickCleanDisplayValue(options.username, options.fallbackUsername),
        avatarUrl: pickCleanDisplayValue(options.avatarUrl),
      });
      if (!init.user) return { success: false, status: 500, error: 'USER_INIT_FAILED', message: 'Không thể khởi tạo hồ sơ.' };
      user = init.user;
    }

    const existing = await getUserDailyFortune(cleanId, now);
    if (!existing) {
      const msg = 'Hôm nay bạn chưa gieo quẻ! Hãy bấm `/gieoque` trước.';
      return {
        success: false,
        status: 200,
        error: 'NOT_DRAWN_YET',
        title: `${em('su_sparkle')} CHƯA GIEO QUẺ HÔM NAY`,
        description: msg,
        image_url: '',
        message: msg,
      };
    }
    if (!['hung', 'dai_hung'].includes(existing.tier_key)) {
      const msg = 'Chỉ khi dính **Hung** hoặc **Đại Hung** mới cần Cầu An Giải Hạn!';
      return {
        success: false,
        status: 200,
        error: 'NOT_ELIGIBLE',
        title: `${em('su_realm_star')} KHÔNG CẦN GIẢI HẠN`,
        description: msg,
        image_url: '',
        message: msg,
      };
    }
    if (existing.rerolled) {
      const msg = 'Hôm nay bạn đã Cầu An Giải Hạn 1 lần rồi!';
      return {
        success: false,
        status: 200,
        error: 'ALREADY_REROLLED',
        title: `${em('su_realm_star')} ĐÃ GIẢI HẠN HÔM NAY`,
        description: msg,
        image_url: '',
        message: msg,
      };
    }

    const bal = Number(user.linh_thach || 0);
    if (bal < FORTUNE_REROLL_COST_LT) {
      const msg = `Cần **${FORTUNE_REROLL_COST_LT} LT** để Cầu An Giải Hạn (Số dư hiện tại: **${bal.toLocaleString('vi-VN')} LT**).`;
      return {
        success: false,
        status: 200,
        error: 'INSUFFICIENT_FUNDS',
        title: `${em('su_linhthach')} KHÔNG ĐỦ LINH THẠCH`,
        description: msg,
        image_url: '',
        message: msg,
      };
    }

    const nextTier = options.forceTierKey && FORTUNE_TIER_BY_KEY[options.forceTierKey]
      ? FORTUNE_TIER_BY_KEY[options.forceTierKey]
      : pickWeightedFortuneTier(FORTUNE_TIERS, 'reroll_weight', rng);
    const poems = FORTUNE_POEMS[nextTier.tier_key] || FORTUNE_POEMS.binh_an;
    const poemIdx = Math.floor(rng() * poems.length);

    if (supabase) {
      await supabase
        .from('users')
        .update({ linh_thach: bal - FORTUNE_REROLL_COST_LT, updated_at: now.toISOString() })
        .eq('user_id', cleanId);
      await supabase
        .from('user_daily_fortunes')
        .update({
          tier_key: nextTier.tier_key,
          poem_idx: poemIdx,
          exp_pct: nextTier.exp_pct,
          lt_pct: nextTier.lt_pct,
          luck_pct: nextTier.luck_pct,
          rerolled: true,
        })
        .eq('user_id', cleanId);
    }

    const updated = {
      ...existing,
      tier_key: nextTier.tier_key,
      poem_idx: poemIdx,
      exp_pct: nextTier.exp_pct,
      lt_pct: nextTier.lt_pct,
      luck_pct: nextTier.luck_pct,
      rerolled: true,
    };
    if (!supabase) memDailyFortunes.set(cleanId, updated);

    const curLuck = await getEffectiveLuckAndFortune(cleanId, now).catch(() => null);
    return formatFortunePayload(updated, user, { alreadyDrawn: false, rerolledJustNow: true, now, luckInfo: curLuck });
  });
}

/**
 * Thắp Linh Hương (/thaplinhhuong): 1 lần/ngày (hiệu lực đến 24:00 UTC+7).
 * Chi phí: 800 → 600 LT (tỉ lệ nghịch với tổng Luck nền hiện có trước khi thắp hương).
 * Tăng ngẫu nhiên từ +5% đến +15% Luck cho toàn bộ tính năng Luck trong ngày.
 */
export async function lightSpiritIncense(userId, options = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID người dùng không hợp lệ.' };

  const now = options.now instanceof Date ? options.now : new Date();
  const rng = typeof options.rng === 'function' ? options.rng : Math.random;
  const todayKey = getVnDateKey(now);
  const nowIso = now.toISOString();
  const ltIcon = em('su_linhthach');
  const incenseEm = em('spirit_incense_burner', em('su_sparkle'));

  return withLuckLock(cleanId, async () => {
    let user = null;
    if (supabase) {
      const init = await ensureUserInitialized(cleanId, {
        username: pickCleanDisplayValue(options.username, options.fallbackUsername),
        avatarUrl: pickCleanDisplayValue(options.avatarUrl),
      });
      user = init.user;
    } else {
      user = memLuckUsers.get(cleanId) || {
        user_id: cleanId,
        username: pickCleanDisplayValue(options.username, options.fallbackUsername) || `TuSi_${cleanId}`,
        linh_thach: 0,
        streak: 0,
        last_daily: null,
        incense_date: null,
        incense_luck_pct: 0,
      };
      memLuckUsers.set(cleanId, user);
    }

    if (!user) {
      return { success: false, status: 500, error: 'USER_INIT_FAILED', message: 'Không thể khởi tạo hồ sơ tu sĩ.' };
    }

    if (user.incense_date === todayKey && Number(user.incense_luck_pct || 0) > 0) {
      const curLuck = await getEffectiveLuckAndFortune(cleanId, now);
      return {
        success: true,
        already_lit: true,
        incense_date: todayKey,
        incense_luck_pct: Number(user.incense_luck_pct),
        linh_thach: Number(user.linh_thach || 0),
        luck_info: curLuck,
        title: `${incenseEm} LINH HƯƠNG HÔM NAY ĐANG CHÁY`,
        description: [
          `• Hôm nay bạn đã thắp **Linh Hương** rồi (**+${user.incense_luck_pct}% Luck**)!`,
          `• Hiệu lực còn lại đến \`24:00\` UTC+7 *(còn **${getCountdownToMidnightVn(now)}**)*.`,
          '',
          formatLuckSummaryLines(curLuck),
        ].join('\n'),
        color: '#f59e0b',
        footer: '',
      };
    }

    const baseLuck = await getEffectiveLuckAndFortune(cleanId, now);
    const feeLt = computeSpiritIncenseCostLt(baseLuck.totalLuckPct);
    const bal = Number(user.linh_thach || 0);
    if (bal < feeLt) {
      return {
        success: false,
        status: 400,
        error: 'INSUFFICIENT_FUNDS',
        required_lt: feeLt,
        linh_thach: bal,
        title: `${ltIcon} KHÔNG ĐỦ LINH THẠCH THẮP LINH HƯƠNG`,
        description: `Phí thắp **Linh Hương** theo Luck hiện tại (**${baseLuck.totalLuckPct}%**) là **${feeLt.toLocaleString('vi-VN')} ${ltIcon}** *(Số dư hiện có: **${bal.toLocaleString('vi-VN')} ${ltIcon}**)*.`,
        message: `Cần **${feeLt.toLocaleString('vi-VN')} LT** để thắp Linh Hương!`,
      };
    }

    const lo = INCENSE_LUCK_MIN_PCT;
    const hi = INCENSE_LUCK_MAX_PCT;
    const bonusLuckPct = Number.isFinite(Number(options.forceBonusPct))
      ? Math.max(lo, Math.min(hi, Math.round(Number(options.forceBonusPct))))
      : (Math.floor(rng() * (hi - lo + 1)) + lo);
    const nextBal = bal - feeLt;

    if (supabase) {
      await supabase
        .from('users')
        .update({
          linh_thach: nextBal,
          incense_date: todayKey,
          incense_luck_pct: bonusLuckPct,
          updated_at: nowIso,
        })
        .eq('user_id', cleanId);
    } else {
      user.linh_thach = nextBal;
      user.incense_date = todayKey;
      user.incense_luck_pct = bonusLuckPct;
    }

    const afterLuck = await getEffectiveLuckAndFortune(cleanId, now);
    return {
      success: true,
      already_lit: false,
      incense_date: todayKey,
      fee_lt: feeLt,
      base_luck_before_pct: baseLuck.totalLuckPct,
      incense_luck_pct: bonusLuckPct,
      total_luck_pct: afterLuck.totalLuckPct,
      linh_thach: nextBal,
      luck_info: afterLuck,
      title: `${incenseEm} THẮP LINH HƯƠNG THÀNH CÔNG! (+${bonusLuckPct}% LUCK)`,
      description: [
        `Làn khói **Linh Hương** lan tỏa cầu may mắn cho **${user.username || 'Đạo Hữu'}**!`,
        `• **Chi phí (theo Luck nền \`${baseLuck.totalLuckPct}%\`):** **-${feeLt.toLocaleString('vi-VN')}** ${ltIcon} *(Còn **${nextBal.toLocaleString('vi-VN')}** ${ltIcon})*`,
        `• **Khí Vận Hương Hôm Nay:** **+${bonusLuckPct}% Luck** *(hiệu lực đến \`24:00\` UTC+7 — còn **${getCountdownToMidnightVn(now)}**)*`,
        '',
        formatLuckSummaryLines(afterLuck),
      ].join('\n'),
      color: '#ec4899',
      footer: '',
    };
  });
}
