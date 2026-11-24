/**
 * src/services/luckAndFortuneService.js
 * Hệ thống 3 Lọ Luck Potion (tính theo lượt) & Gieo Quẻ Đầu Ngày /gieoque (6 bậc Khí Vận + Cầu An Giải Hạn).
 * Tuyệt đối KHÔNG dùng emoji Unicode Windows.
 */

import { supabase } from '../config/supabase.js';
import { PUBLIC_BASE_URL } from '../data/catalog.js';
import {
  LUCK_POTION_BY_ID,
  FORTUNE_TIERS,
  FORTUNE_TIER_BY_KEY,
  FORTUNE_REROLL_COST_LT,
  FORTUNE_POEMS,
} from '../data/v16ExpansionCatalog.js';
import { em } from '../config/emojiHelper.js';
import {
  sanitizeUserId,
  ensureUserInitialized,
  pickCleanDisplayValue,
} from './profileService.js';

const luckLocks = new Map();
const memLuckBuffs = new Map();
const memDailyFortunes = new Map();

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

/**
 * Tổng hợp Buff Luck & Khí Vận đang có hiệu lực cho 1 user
 */
export async function getEffectiveLuckAndFortune(userId, now = new Date()) {
  const [potion, fortune] = await Promise.all([
    getUserLuckBuff(userId),
    getUserDailyFortune(userId, now),
  ]);

  const potionMeta = potion ? LUCK_POTION_BY_ID[potion.potion_id] : null;
  const potionLuckPct = potion ? Number(potion.luck_bonus_pct || 0) : 0;
  const potionCharges = potion ? Number(potion.remaining_charges || 0) : 0;

  const fTier = fortune ? (FORTUNE_TIER_BY_KEY[fortune.tier_key] || null) : null;
  const fortuneExpPct = fortune ? Number(fortune.exp_pct || 0) : 0;
  const fortuneLtPct = fortune ? Number(fortune.lt_pct || 0) : 0;
  const fortuneLuckPct = fortune ? Number(fortune.luck_pct || 0) : 0;

  const totalLuckPct = potionLuckPct + fortuneLuckPct;
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
    totalLuckPct,
    luckMultiplier,
  };
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

function formatFortunePayload(row, user, { alreadyDrawn = false, rerolledJustNow = false, now = new Date() } = {}) {
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
    `• **Luck Gacha & Đổ Thạch:** \`${fmtPct(row.luck_pct)}\` *(cộng dồn với Luck Potion)*`,
    '',
    rerolledJustNow
      ? `${em('su_sparkle')} **Cầu An Giải Hạn thành công!** Quẻ mới đã ứng nghiệm cho hôm nay.`
      : canReroll
        ? `${em('su_linhthach')} Dính quẻ **${tier.name}** — có thể bấm **Cầu An Giải Hạn (${FORTUNE_REROLL_COST_LT} LT)** bên dưới *(1 lần/ngày)* để gieo lại!`
        : alreadyDrawn
          ? `${em('su_realm_star')} Hôm nay bạn đã gieo quẻ rồi • Quẻ mới mở lại sau \`${getCountdownToMidnightVn(now)}\` *(00:00 UTC+7)*.`
          : `${em('su_realm_star')} Chúc đạo hữu một ngày tu hành thuận lợi • Reset lúc \`00:00 UTC+7\`.`,
  ];

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
      return formatFortunePayload(existing, user, { alreadyDrawn: true, now });
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

    return formatFortunePayload(record, user, { alreadyDrawn: false, now });
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
      return { success: false, status: 400, error: 'NOT_DRAWN_YET', message: 'Hôm nay bạn chưa gieo quẻ! Hãy bấm `/gieoque` trước.' };
    }
    if (!['hung', 'dai_hung'].includes(existing.tier_key)) {
      return { success: false, status: 400, error: 'NOT_ELIGIBLE', message: 'Chỉ khi dính **Hung** hoặc **Đại Hung** mới cần Cầu An Giải Hạn!' };
    }
    if (existing.rerolled) {
      return { success: false, status: 400, error: 'ALREADY_REROLLED', message: 'Hôm nay bạn đã Cầu An Giải Hạn 1 lần rồi!' };
    }

    const bal = Number(user.linh_thach || 0);
    if (bal < FORTUNE_REROLL_COST_LT) {
      return {
        success: false,
        status: 400,
        error: 'INSUFFICIENT_FUNDS',
        message: `Cần **${FORTUNE_REROLL_COST_LT} LT** để Cầu An Giải Hạn (Số dư hiện tại: **${bal.toLocaleString('vi-VN')} LT**).`,
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

    return formatFortunePayload(updated, user, { alreadyDrawn: false, rerolledJustNow: true, now });
  });
}
