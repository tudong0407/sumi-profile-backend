/**
 * src/services/alchemyService.js
 * Hệ thống Lò Luyện Đan (/luyendan) — Ver 1.6.1:
 * - Tối đa 2 Lò song song (Lò #1 miễn phí; Lò #2 tự mở ở Lv.45 hoặc trả 2.500 LT).
 * - Nâng cấp Lò Lv.1 -> Lv.5 (+LT%, giảm thời gian nấu, tăng ân hạn 20p->60p, tăng tỉ lệ Thượng Phẩm/Đan Vân).
 * - 6 công thức (4 bậc LT thường + 2 công thức Tinh Hoa dùng 20/40 Linh Quả từ /farm).
 * - Giới hạn 5 mẻ/ngày (UTC+7), trừ lượt ngay lúc bắt đầu nấu.
 * - Quá ân hạn: cháy đan thu 30 LT + nổ khóa riêng lò đó 4 giờ (hỗ trợ Sửa Lò Nhanh 300 LT).
 * - DM nhắc tự động 2 mốc: khi chín & cảnh báo khẩn <=10 phút trước nổ lò.
 * Tuyệt đối KHÔNG dùng emoji Unicode Windows.
 */

import { supabase } from '../config/supabase.js';
import { em, uiEm, farmEmoji } from '../config/emojiHelper.js';
import {
  sanitizeUserId,
  ensureUserInitialized,
  pickCleanDisplayValue,
} from './profileService.js';
import { getVnDateKey, getEffectiveLuckAndFortune } from './luckAndFortuneService.js';
import { trackQuestActivity } from './questService.js';
import {
  ALCHEMY_DAILY_LIMIT,
  ALCHEMY_SLOT2_FREE_LEVEL,
  ALCHEMY_SLOT2_UNLOCK_COST,
  ALCHEMY_BURN_PAYOUT_LT,
  ALCHEMY_EXPLODE_LOCK_HOURS,
  ALCHEMY_INSTANT_REPAIR_COST,
  ALCHEMY_DM_WARN_MINUTES,
  ALCHEMY_EXPLODED_IMAGE,
  FURNACE_TIERS,
  ALCHEMY_RECIPES,
  ALCHEMY_RECIPE_BY_ID,
  PILL_QUALITIES,
  getFurnaceTier,
  computeBrewDurationMs,
  computeGraceMs,
  checkRecipeUnlock,
  resolveAlchemyImageUrl,
  alchemyIcon,
} from '../data/v161AlchemyCatalog.js';

const alchemyLocks = new Map();
let dmAlchemyQueue = Promise.resolve();

// In-memory store cho unit test offline (khi supabase === null)
const memProfiles = new Map();
const memFurnaces = new Map();
const memUsers = new Map();

export function __resetAlchemyTestStore(seedUsers = null) {
  memProfiles.clear();
  memFurnaces.clear();
  memUsers.clear();
  if (seedUsers && typeof seedUsers === 'object') {
    for (const [uid, data] of Object.entries(seedUsers)) {
      memUsers.set(String(uid), {
        user_id: String(uid),
        username: data.username || `TuSi_${uid}`,
        level: Number(data.level || 1),
        exp: Number(data.exp || 0),
        coins: Number(data.coins || 0),
        farm_essence: Number(data.farm_essence || 0),
        avatar_url: data.avatar_url || '',
        ...data,
      });
    }
  }
}

export function __getAlchemyTestUser(userId) {
  return memUsers.get(String(userId)) || null;
}

async function withAlchemyLock(userId, fn) {
  const prev = alchemyLocks.get(userId) || Promise.resolve();
  let release;
  const current = new Promise((res) => { release = res; });
  const queued = prev.then(() => current);
  alchemyLocks.set(userId, queued);
  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (alchemyLocks.get(userId) === queued) alchemyLocks.delete(userId);
  }
}

function formatDurationShort(ms) {
  const totalMin = Math.max(1, Math.ceil(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0 && m > 0) return `${h}g ${m}p`;
  if (h > 0) return `${h}g`;
  return `${m}p`;
}

function getMidnightResetCountdown(now = new Date()) {
  const vnMs = now.getTime() + 7 * 3600000;
  const rem = 86400000 - (vnMs % 86400000);
  const h = Math.floor(rem / 3600000);
  const m = Math.floor((rem % 3600000) / 60000);
  return `${h}g ${String(m).padStart(2, '0')}p`;
}

async function loadUserRow(userId, opts = {}) {
  if (!supabase) {
    if (!memUsers.has(userId)) {
      memUsers.set(userId, {
        user_id: userId,
        username: pickCleanDisplayValue(opts.username, opts.fallbackUsername, `TuSi_${userId.slice(-4)}`),
        level: 1,
        exp: 0,
        linh_thach: 5000,
        farm_essence: 100,
        avatar_url: opts.avatarUrl || '',
      });
    }
    return memUsers.get(userId);
  }
  const initRes = await ensureUserInitialized(userId, {
    username: opts.username,
    fallbackUsername: opts.fallbackUsername,
    avatarUrl: opts.avatarUrl,
  });
  return initRes?.user || initRes;
}

async function updateUserRow(userId, patch) {
  if (!supabase) {
    const cur = memUsers.get(userId) || { user_id: userId, linh_thach: 0, exp: 0, farm_essence: 0, level: 1 };
    const next = { ...cur, ...patch };
    memUsers.set(userId, next);
    return next;
  }
  const { data, error } = await supabase
    .from('users')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data;
}

async function loadOrInitAlchemyState(userId, userLevel, now = new Date()) {
  const todayKey = getVnDateKey(now);
  const nowIso = now.toISOString();
  const autoSlot2 = Number(userLevel || 1) >= ALCHEMY_SLOT2_FREE_LEVEL;

  if (!supabase) {
    let prof = memProfiles.get(userId);
    if (!prof) {
      prof = {
        user_id: userId,
        furnace_level: 1,
        slot2_unlocked: autoSlot2,
        total_batches_completed: 0,
        daily_date: todayKey,
        batches_today: 0,
        updated_at: nowIso,
      };
    } else {
      if (prof.daily_date !== todayKey) {
        prof = { ...prof, daily_date: todayKey, batches_today: 0 };
      }
      if (autoSlot2 && !prof.slot2_unlocked) {
        prof = { ...prof, slot2_unlocked: true };
      }
    }
    memProfiles.set(userId, prof);

    let slots = memFurnaces.get(userId);
    if (!slots || slots.length === 0) {
      slots = [
        { user_id: userId, slot_index: 1, status: 'idle', recipe_id: null, started_at: null, ready_at: null, burn_at: null, repair_until: null, dm_ready_sent: false, dm_warn10_sent: false },
        { user_id: userId, slot_index: 2, status: 'idle', recipe_id: null, started_at: null, ready_at: null, burn_at: null, repair_until: null, dm_ready_sent: false, dm_warn10_sent: false },
      ];
    }
    slots = slots.map((s) => {
      if (s.status === 'exploded' && s.repair_until && new Date(s.repair_until).getTime() <= now.getTime()) {
        return { ...s, status: 'idle', recipe_id: null, started_at: null, ready_at: null, burn_at: null, repair_until: null, dm_ready_sent: false, dm_warn10_sent: false };
      }
      return s;
    });
    memFurnaces.set(userId, slots);
    return { profile: prof, slots };
  }

  let { data: prof } = await supabase
    .from('user_alchemy_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (!prof) {
    const { data: inserted, error } = await supabase
      .from('user_alchemy_profiles')
      .insert({
        user_id: userId,
        furnace_level: 1,
        slot2_unlocked: autoSlot2,
        total_batches_completed: 0,
        daily_date: todayKey,
        batches_today: 0,
        updated_at: nowIso,
      })
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    prof = inserted;
  } else {
    const patch = {};
    if (prof.daily_date !== todayKey) {
      patch.daily_date = todayKey;
      patch.batches_today = 0;
    }
    if (autoSlot2 && !prof.slot2_unlocked) {
      patch.slot2_unlocked = true;
    }
    if (Object.keys(patch).length > 0) {
      patch.updated_at = nowIso;
      const { data: updated } = await supabase
        .from('user_alchemy_profiles')
        .update(patch)
        .eq('user_id', userId)
        .select('*')
        .single();
      if (updated) prof = updated;
    }
  }

  let { data: slots } = await supabase
    .from('user_alchemy_furnaces')
    .select('*')
    .eq('user_id', userId)
    .order('slot_index', { ascending: true });

  const existingIndices = new Set((slots || []).map((s) => Number(s.slot_index)));
  const missing = [1, 2].filter((idx) => !existingIndices.has(idx));
  if (missing.length > 0) {
    await supabase.from('user_alchemy_furnaces').insert(
      missing.map((idx) => ({
        user_id: userId,
        slot_index: idx,
        status: 'idle',
        updated_at: nowIso,
      })),
    );
    const reloaded = await supabase
      .from('user_alchemy_furnaces')
      .select('*')
      .eq('user_id', userId)
      .order('slot_index', { ascending: true });
    slots = reloaded.data || [];
  }

  const normalizedSlots = [];
  for (const s of slots || []) {
    if (s.status === 'exploded' && s.repair_until && new Date(s.repair_until).getTime() <= now.getTime()) {
      const cleanPatch = {
        status: 'idle',
        recipe_id: null,
        started_at: null,
        ready_at: null,
        burn_at: null,
        repair_until: null,
        dm_ready_sent: false,
        dm_warn10_sent: false,
        updated_at: nowIso,
      };
      await supabase
        .from('user_alchemy_furnaces')
        .update(cleanPatch)
        .eq('user_id', userId)
        .eq('slot_index', s.slot_index);
      normalizedSlots.push({ ...s, ...cleanPatch });
    } else {
      normalizedSlots.push(s);
    }
  }

  return { profile: prof, slots: normalizedSlots };
}

async function saveProfile(userId, patch) {
  const nowIso = new Date().toISOString();
  if (!supabase) {
    const cur = memProfiles.get(userId) || {};
    const next = { ...cur, ...patch, updated_at: nowIso };
    memProfiles.set(userId, next);
    return next;
  }
  const { data, error } = await supabase
    .from('user_alchemy_profiles')
    .update({ ...patch, updated_at: nowIso })
    .eq('user_id', userId)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data;
}

async function saveFurnaceSlot(userId, slotIndex, patch) {
  const nowIso = new Date().toISOString();
  if (!supabase) {
    const list = memFurnaces.get(userId) || [];
    const next = list.map((s) => (Number(s.slot_index) === Number(slotIndex) ? { ...s, ...patch, updated_at: nowIso } : s));
    memFurnaces.set(userId, next);
    return next.find((s) => Number(s.slot_index) === Number(slotIndex));
  }
  const { data, error } = await supabase
    .from('user_alchemy_furnaces')
    .update({ ...patch, updated_at: nowIso })
    .eq('user_id', userId)
    .eq('slot_index', slotIndex)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data;
}

function describeSlotLine(slot, slot2Unlocked, now) {
  const nowMs = now.getTime();
  const idx = Number(slot.slot_index);
  const fireEm = em('su_el_hoa') || em('su_sparkle');
  const warnEm = uiEm('ui_warn') || em('su_sparkle');
  const clockEm = uiEm('ui_clock_timer') || em('su_sparkle');
  const checkEm = em('su_level_up') || em('su_sparkle');

  if (idx === 2 && !slot2Unlocked) {
    return `• **Lò #2:** *Đã khóa* *(Tự mở miễn phí tại **Lv.${ALCHEMY_SLOT2_FREE_LEVEL}** hoặc bấm **Mở Lò #2** với **${ALCHEMY_SLOT2_UNLOCK_COST.toLocaleString('vi-VN')} LT**)*`;
  }

  if (slot.status === 'exploded') {
    const repairSec = Math.floor(new Date(slot.repair_until).getTime() / 1000);
    return `• **Lò #${idx}:** ${warnEm} **ĐÃ NỔ LÒ** — Mở lại <t:${repairSec}:R> *(Bấm **Sửa Lò Nhanh ${ALCHEMY_INSTANT_REPAIR_COST} LT**)*`;
  }

  if (slot.status === 'brewing' && slot.recipe_id) {
    const recipe = ALCHEMY_RECIPE_BY_ID[slot.recipe_id];
    const rName = recipe ? recipe.name : slot.recipe_id;
    const readyMs = new Date(slot.ready_at).getTime();
    const burnMs = new Date(slot.burn_at).getTime();
    const readySec = Math.floor(readyMs / 1000);
    const burnSec = Math.floor(burnMs / 1000);

    if (nowMs >= burnMs) {
      return `• **Lò #${idx}:** ${warnEm} **${rName}** — **ĐÃ CHÁY THÀNH PHẾ ĐAN!** *(Bấm **Thu Đan / Dọn Lò** để thu ${ALCHEMY_BURN_PAYOUT_LT} LT & kiểm tra lò)*`;
    }
    if (nowMs >= readyMs) {
      return `• **Lò #${idx}:** ${checkEm} **${rName}** — **ĐÃ CHÍN!** *(Thu ngay, cháy sau <t:${burnSec}:R>)*`;
    }
    return `• **Lò #${idx}:** ${fireEm} Đang luyện **${rName}** — Chín <t:${readySec}:R> *(Cháy <t:${burnSec}:R>)*`;
  }

  return `• **Lò #${idx}:** ${clockEm} **Đang trống** *(Chọn công thức ở khung bên dưới để nấu)*`;
}

function buildAlchemyEmbed({
  user,
  profile,
  slots,
  now = new Date(),
  bannerText = '',
  overrideImage = null,
  overrideColor = null,
  success = true,
}) {
  const tier = getFurnaceTier(profile.furnace_level);
  const nextTier = getFurnaceTier(profile.furnace_level + 1);
  const hasNextTier = profile.furnace_level < 5;
  const ltEm = em('su_linhthach') || '';
  const essEm = farmEmoji('farm_essence') || em('su_sprout');
  const fireEm = em('su_el_hoa') || em('su_sparkle');

  const hasExplodedSlot = slots.some((s) => s.status === 'exploded');
  const defaultImgFile = hasExplodedSlot ? ALCHEMY_EXPLODED_IMAGE : tier.image;
  const imageUrl = overrideImage !== null
    ? resolveAlchemyImageUrl(overrideImage)
    : resolveAlchemyImageUrl(defaultImgFile);

  const displayName = pickCleanDisplayValue(user.username, `TuSi_${user.user_id}`);
  const userLevel = Number(user.level || 1);
  const coins = Number(user.linh_thach ?? user.coins ?? 0);
  const essence = Number(user.farm_essence || 0);

  const slotLines = slots.map((s) => describeSlotLine(s, profile.slot2_unlocked, now));
  const upgradeLine = hasNextTier
    ? `${em('su_level_up')} **Nâng Lò Lv.${nextTier.level} (${nextTier.name}):** Cần \`${nextTier.upgradeCostLt.toLocaleString('vi-VN')} LT\` & \`${profile.total_batches_completed}/${nextTier.minBatches} mẻ\``
    : `${em('su_level_up')} **Cấp Lò:** Đã đạt tối đa **Lv.5 (${tier.name})**`;

  const recipeSummaryLines = ALCHEMY_RECIPES.map((r) => {
    const u = checkRecipeUnlock(r, userLevel, profile.furnace_level);
    const lockTag = u.unlocked ? '' : ` *(Khóa: ${u.requirementText})*`;
    const costParts = [`${r.costLt} LT`];
    if (r.costEssence > 0) costParts.push(`${r.costEssence} Linh Quả`);
    const durMin = Math.round(computeBrewDurationMs(r, profile.furnace_level) / 60000);
    const mult = 1 + tier.ltBonusPct / 100;
    const minOut = Math.round(r.minLt * mult);
    const maxOut = Math.round(r.maxLt * mult);
    return `• **${r.tierLabel} — ${r.name}:** Vốn \`${costParts.join(' + ')}\` | \`${durMin}p\` | Thu \`${minOut}–${maxOut} LT\`${lockTag}`;
  });

  const descParts = [];
  if (bannerText) {
    descParts.push(bannerText, '');
  }
  descParts.push(
    `**Tu Sĩ:** **${displayName}** *(Lv.${userLevel})* | ${ltEm} **\`${coins.toLocaleString('vi-VN')}\` LT** | ${essEm} **\`${essence.toLocaleString('vi-VN')}\` Linh Quả**`,
    `**Lò Hiện Tại:** **Lv.${tier.level} — ${tier.name}** | **Hôm nay:** \`${profile.batches_today}/${ALCHEMY_DAILY_LIMIT} mẻ\` *(Reset sau ${getMidnightResetCountdown(now)})*`,
    `**Chỉ Số Lò:** \`+${tier.ltBonusPct}% LT\` | \`-${tier.timeReducePct}% Thời Gian\` | \`Ân hạn ${tier.graceMin}p\` | \`Thượng Phẩm ${tier.superiorPct}%\` | \`Đan Vân ${tier.cloudPct}%\``,
    upgradeLine,
    '',
    '**TRẠNG THÁI LÒ LUYỆN:**',
    ...slotLines,
    '',
    '**CÔNG THỨC ĐAN DƯỢC:**',
    ...recipeSummaryLines,
  );

  return {
    success,
    title: `${fireEm} ĐAN PHÒNG LUYỆN ĐAN — ${tier.name.toUpperCase()}`,
    description: descParts.join('\n'),
    color: overrideColor || (hasExplodedSlot ? '#ef4444' : '#ec4899'),
    image_url: imageUrl,
    footer: `Tổng mẻ thành công: ${profile.total_batches_completed} • DM nhắc tự động khi chín & trước nổ 10p`,
    state: {
      user_id: user.user_id,
      furnace_level: profile.furnace_level,
      slot2_unlocked: Boolean(profile.slot2_unlocked),
      total_batches_completed: Number(profile.total_batches_completed || 0),
      batches_today: Number(profile.batches_today || 0),
      daily_limit: ALCHEMY_DAILY_LIMIT,
      coins,
      farm_essence: essence,
      slots,
    },
  };
}

function buildFriendlyRejection(message, stateBundle, now = new Date()) {
  const warnEm = uiEm('ui_warn') || em('su_sparkle');
  return buildAlchemyEmbed({
    ...stateBundle,
    now,
    bannerText: `${warnEm} **Không thể thực hiện:** ${message}`,
    overrideColor: '#f59e0b',
    success: false,
  });
}

export async function getAlchemyStatus(userId, opts = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) {
    return {
      success: false,
      status: 200,
      error: 'INVALID_USER_ID',
      title: `${alchemyIcon('ui_warn')} ID tu sĩ không hợp lệ`,
      description: 'Vui lòng thử lại trong Discord.',
      color: '#ef4444',
      image_url: '',
    };
  }
  const now = opts.now instanceof Date ? opts.now : new Date();
  return withAlchemyLock(cleanId, async () => {
    const user = await loadUserRow(cleanId, opts);
    const { profile, slots } = await loadOrInitAlchemyState(cleanId, user.level, now);
    return buildAlchemyEmbed({ user, profile, slots, now });
  });
}

export async function startBrew(userId, recipeId, opts = {}) {
  const cleanId = sanitizeUserId(userId);
  const cleanRecipeId = String(recipeId || '').trim();
  if (!cleanId) {
    return { success: false, status: 200, title: `${alchemyIcon('ui_warn')} ID không hợp lệ`, description: 'Không xác định được tu sĩ.', color: '#ef4444', image_url: '' };
  }
  const now = opts.now instanceof Date ? opts.now : new Date();

  return withAlchemyLock(cleanId, async () => {
    const user = await loadUserRow(cleanId, opts);
    const { profile, slots } = await loadOrInitAlchemyState(cleanId, user.level, now);
    const recipe = ALCHEMY_RECIPE_BY_ID[cleanRecipeId];
    if (!recipe) {
      return buildFriendlyRejection('Công thức đan dược không tồn tại.', { user, profile, slots }, now);
    }

    if (Number(profile.batches_today || 0) >= ALCHEMY_DAILY_LIMIT) {
      return buildFriendlyRejection(
        `Đạo hữu đã luyện đủ **${ALCHEMY_DAILY_LIMIT}/${ALCHEMY_DAILY_LIMIT} mẻ** trong ngày hôm nay. Quay lại sau \`${getMidnightResetCountdown(now)}\` nhé!`,
        { user, profile, slots },
        now,
      );
    }

    const unlock = checkRecipeUnlock(recipe, user.level, profile.furnace_level);
    if (!unlock.unlocked) {
      return buildFriendlyRejection(
        `**${recipe.name}** yêu cầu **${unlock.requirementText}** *(hiện tại: Lv.${user.level || 1}, Lò Lv.${profile.furnace_level})*.`,
        { user, profile, slots },
        now,
      );
    }

    const availableSlot = slots.find((s) => {
      if (Number(s.slot_index) === 2 && !profile.slot2_unlocked) return false;
      return s.status === 'idle';
    });
    if (!availableSlot) {
      return buildFriendlyRejection(
        'Hiện không có lò trống nào! Hãy chờ đan chín, bấm **Thu Đan / Dọn Lò** hoặc **Mở Lò #2 / Sửa Lò Nhanh**.',
        { user, profile, slots },
        now,
      );
    }

    const coins = Number(user.linh_thach ?? user.coins ?? 0);
    const essence = Number(user.farm_essence || 0);
    if (coins < recipe.costLt) {
      return buildFriendlyRejection(
        `Không đủ **${recipe.costLt.toLocaleString('vi-VN')} LT** để khai lò **${recipe.name}** *(hiện có: \`${coins.toLocaleString('vi-VN')} LT\`)*!`,
        { user, profile, slots },
        now,
      );
    }
    if (essence < recipe.costEssence) {
      return buildFriendlyRejection(
        `Không đủ **${recipe.costEssence} Linh Quả** từ \`/farm\` để luyện **${recipe.name}** *(hiện có: \`${essence} Linh Quả\`)*!`,
        { user, profile, slots },
        now,
      );
    }

    const durationMs = computeBrewDurationMs(recipe, profile.furnace_level);
    const graceMs = computeGraceMs(profile.furnace_level);
    const startedMs = now.getTime();
    const readyMs = startedMs + durationMs;
    const burnMs = readyMs + graceMs;

    const nextUser = await updateUserRow(cleanId, {
      linh_thach: coins - recipe.costLt,
      farm_essence: essence - recipe.costEssence,
    });
    const nextProfile = await saveProfile(cleanId, {
      batches_today: Number(profile.batches_today || 0) + 1,
    });
    const updatedSlot = await saveFurnaceSlot(cleanId, availableSlot.slot_index, {
      status: 'brewing',
      recipe_id: recipe.id,
      started_at: new Date(startedMs).toISOString(),
      ready_at: new Date(readyMs).toISOString(),
      burn_at: new Date(burnMs).toISOString(),
      repair_until: null,
      dm_ready_sent: false,
      dm_warn10_sent: false,
    });

    const nextSlots = slots.map((s) => (Number(s.slot_index) === Number(availableSlot.slot_index) ? updatedSlot : s));
    const readySec = Math.floor(readyMs / 1000);
    const fireEm = em('su_el_hoa') || em('su_sparkle');

    return buildAlchemyEmbed({
      user: nextUser,
      profile: nextProfile,
      slots: nextSlots,
      now,
      bannerText: `${fireEm} **Đã nhóm lửa Lò #${availableSlot.slot_index}!** Đang luyện **${recipe.name}** — Chín <t:${readySec}:R> *(đã trừ ${recipe.costLt} LT${recipe.costEssence > 0 ? ` + ${recipe.costEssence} Linh Quả` : ''})*.`,
      overrideColor: '#f59e0b',
    });
  });
}

function rollQuality(furnaceTier, fortune, rng) {
  const fortuneLuck = Number(fortune?.luck_pct || 0);
  const extraCloud = fortuneLuck > 0 ? Math.min(5, Math.round(fortuneLuck * 0.25)) : 0;
  const extraSup = fortuneLuck > 0 ? Math.min(6, Math.round(fortuneLuck * 0.3)) : 0;

  const cloudChance = (Number(furnaceTier.cloudPct || 3) + extraCloud) / 100;
  const supChance = (Number(furnaceTier.superiorPct || 10) + extraSup) / 100;
  const roll = rng();
  if (roll < cloudChance) return PILL_QUALITIES.cloud;
  if (roll < cloudChance + supChance) return PILL_QUALITIES.superior;
  return PILL_QUALITIES.normal;
}

export async function harvestBatch(userId, opts = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) {
    return { success: false, status: 200, title: `${alchemyIcon('ui_warn')} ID không hợp lệ`, description: 'Không xác định được tu sĩ.', color: '#ef4444', image_url: '' };
  }
  const now = opts.now instanceof Date ? opts.now : new Date();
  const rng = typeof opts.rng === 'function' ? opts.rng : Math.random;

  return withAlchemyLock(cleanId, async () => {
    const user = await loadUserRow(cleanId, opts);
    const { profile, slots } = await loadOrInitAlchemyState(cleanId, user.level, now);
    const nowMs = now.getTime();
    const tier = getFurnaceTier(profile.furnace_level);

    const readyOrBurned = slots.filter((s) => (
      s.status === 'brewing' && s.recipe_id && new Date(s.ready_at).getTime() <= nowMs
    ));

    if (readyOrBurned.length === 0) {
      return buildFriendlyRejection(
        'Chưa có mẻ đan nào chín hoặc cháy để thu hoạch! Hãy chờ đồng hồ đếm ngược kết thúc.',
        { user, profile, slots },
        now,
      );
    }

    const eff = await getEffectiveLuckAndFortune(cleanId, now).catch(() => null);
    const fortune = eff?.fortune || null;

    let totalGainLt = 0;
    let totalGainExp = 0;
    let completedCount = 0;
    let burnedCount = 0;
    let lastPillImage = null;
    let anyExplodedNow = false;
    const resultLines = [];
    const nextSlots = [...slots];

    for (const slot of readyOrBurned) {
      const idx = Number(slot.slot_index);
      const recipe = ALCHEMY_RECIPE_BY_ID[slot.recipe_id] || ALCHEMY_RECIPES[0];
      const burnMs = new Date(slot.burn_at).getTime();

      if (nowMs >= burnMs) {
        burnedCount += 1;
        totalGainLt += ALCHEMY_BURN_PAYOUT_LT;
        const lockUntilMs = burnMs + ALCHEMY_EXPLODE_LOCK_HOURS * 3600000;
        const stillLocked = lockUntilMs > nowMs;
        if (stillLocked) anyExplodedNow = true;

        const patched = await saveFurnaceSlot(cleanId, idx, stillLocked
          ? {
            status: 'exploded',
            recipe_id: null,
            started_at: null,
            ready_at: null,
            burn_at: null,
            repair_until: new Date(lockUntilMs).toISOString(),
            dm_ready_sent: false,
            dm_warn10_sent: false,
          }
          : {
            status: 'idle',
            recipe_id: null,
            started_at: null,
            ready_at: null,
            burn_at: null,
            repair_until: null,
            dm_ready_sent: false,
            dm_warn10_sent: false,
          });
        const pos = nextSlots.findIndex((s) => Number(s.slot_index) === idx);
        if (pos >= 0) nextSlots[pos] = patched;

        const lockNote = stillLocked
          ? `Lò #${idx} phát nổ khóa đến <t:${Math.floor(lockUntilMs / 1000)}:R> *(Sửa nhanh: ${ALCHEMY_INSTANT_REPAIR_COST} LT)*`
          : `Đã dọn sạch tro Lò #${idx}`;
        resultLines.push(`${uiEm('ui_warn') || ''} **Lò #${idx} CHÁY ĐAN (${recipe.name}):** Thu **+${ALCHEMY_BURN_PAYOUT_LT} LT** phế đan • ${lockNote}`);
      } else {
        completedCount += 1;
        const quality = rollQuality(tier, fortune, rng);
        const baseRoll = recipe.minLt + rng() * (recipe.maxLt - recipe.minLt);
        const furnaceMult = 1 + Number(tier.ltBonusPct || 0) / 100;
        const ltEarned = Math.max(1, Math.round(baseRoll * furnaceMult * quality.multiplier));
        const expEarned = Number(recipe.exp || 20);

        totalGainLt += ltEarned;
        totalGainExp += expEarned;
        lastPillImage = recipe.image;

        const patched = await saveFurnaceSlot(cleanId, idx, {
          status: 'idle',
          recipe_id: null,
          started_at: null,
          ready_at: null,
          burn_at: null,
          repair_until: null,
          dm_ready_sent: false,
          dm_warn10_sent: false,
        });
        const pos = nextSlots.findIndex((s) => Number(s.slot_index) === idx);
        if (pos >= 0) nextSlots[pos] = patched;

        resultLines.push(`${em('su_level_up') || ''} **Lò #${idx} — ${recipe.name} [${quality.label} ×${quality.multiplier}]:** Thu **+${ltEarned.toLocaleString('vi-VN')} LT** & **+${expEarned} EXP**!`);
      }
    }

    const nextUser = await updateUserRow(cleanId, {
      linh_thach: Number(user.linh_thach ?? user.coins ?? 0) + totalGainLt,
      exp: Number(user.exp || 0) + totalGainExp,
    });
    const nextProfile = await saveProfile(cleanId, {
      total_batches_completed: Number(profile.total_batches_completed || 0) + completedCount,
    });

    if (supabase && completedCount > 0) {
      await trackQuestActivity(cleanId, { craft: completedCount }).catch(() => null);
    }

    const overrideImage = anyExplodedNow
      ? ALCHEMY_EXPLODED_IMAGE
      : (lastPillImage || (burnedCount > 0 ? ALCHEMY_EXPLODED_IMAGE : null));
    const overrideColor = anyExplodedNow ? '#ef4444' : '#10b981';

    return {
      ...buildAlchemyEmbed({
        user: nextUser,
        profile: nextProfile,
        slots: nextSlots,
        now,
        bannerText: resultLines.join('\n'),
        overrideImage,
        overrideColor,
      }),
      harvest_summary: {
        completed_count: completedCount,
        burned_count: burnedCount,
        total_gain_lt: totalGainLt,
        total_gain_exp: totalGainExp,
      },
    };
  });
}

export async function upgradeFurnace(userId, opts = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) {
    return { success: false, status: 200, title: `${alchemyIcon('ui_warn')} ID không hợp lệ`, description: 'Không xác định được tu sĩ.', color: '#ef4444', image_url: '' };
  }
  const now = opts.now instanceof Date ? opts.now : new Date();

  return withAlchemyLock(cleanId, async () => {
    const user = await loadUserRow(cleanId, opts);
    const { profile, slots } = await loadOrInitAlchemyState(cleanId, user.level, now);

    if (profile.furnace_level >= 5) {
      return buildFriendlyRejection(
        `Lò luyện đã đạt cấp tối đa **Lv.5 (${FURNACE_TIERS[4].name})**!`,
        { user, profile, slots },
        now,
      );
    }

    const nextTier = getFurnaceTier(profile.furnace_level + 1);
    const completed = Number(profile.total_batches_completed || 0);
    if (completed < nextTier.minBatches) {
      return buildFriendlyRejection(
        `Cần luyện thành công tối thiểu **${nextTier.minBatches} mẻ** để nâng lên **Lv.${nextTier.level} (${nextTier.name})** *(hiện tại: \`${completed}/${nextTier.minBatches} mẻ\`)*!`,
        { user, profile, slots },
        now,
      );
    }

    const coins = Number(user.linh_thach ?? user.coins ?? 0);
    if (coins < nextTier.upgradeCostLt) {
      return buildFriendlyRejection(
        `Cần **${nextTier.upgradeCostLt.toLocaleString('vi-VN')} LT** để nâng lên **Lv.${nextTier.level} (${nextTier.name})** *(hiện có: \`${coins.toLocaleString('vi-VN')} LT\`)*!`,
        { user, profile, slots },
        now,
      );
    }

    const nextUser = await updateUserRow(cleanId, {
      linh_thach: coins - nextTier.upgradeCostLt,
    });
    const nextProfile = await saveProfile(cleanId, {
      furnace_level: nextTier.level,
    });

    return buildAlchemyEmbed({
      user: nextUser,
      profile: nextProfile,
      slots,
      now,
      bannerText: `${em('su_level_up')} **Nâng cấp thành công!** Chào đón **Lv.${nextTier.level} — ${nextTier.name}** (\`+${nextTier.ltBonusPct}% LT\`, \`-${nextTier.timeReducePct}% Thời Gian\`, \`Ân hạn ${nextTier.graceMin}p\`)!`,
      overrideImage: nextTier.image,
      overrideColor: '#a855f7',
    });
  });
}

export async function unlockSecondFurnace(userId, opts = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) {
    return { success: false, status: 200, title: `${alchemyIcon('ui_warn')} ID không hợp lệ`, description: 'Không xác định được tu sĩ.', color: '#ef4444', image_url: '' };
  }
  const now = opts.now instanceof Date ? opts.now : new Date();

  return withAlchemyLock(cleanId, async () => {
    const user = await loadUserRow(cleanId, opts);
    const { profile, slots } = await loadOrInitAlchemyState(cleanId, user.level, now);

    if (profile.slot2_unlocked) {
      return buildFriendlyRejection('**Lò #2** đã được mở khóa từ trước rồi!', { user, profile, slots }, now);
    }

    const isFree = Number(user.level || 1) >= ALCHEMY_SLOT2_FREE_LEVEL;
    const cost = isFree ? 0 : ALCHEMY_SLOT2_UNLOCK_COST;
    const coins = Number(user.linh_thach ?? user.coins ?? 0);

    if (coins < cost) {
      return buildFriendlyRejection(
        `Chưa đủ **${cost.toLocaleString('vi-VN')} LT** để mở sớm **Lò #2** *(hoặc đạt **Lv.${ALCHEMY_SLOT2_FREE_LEVEL}** để tự mở miễn phí!)*`,
        { user, profile, slots },
        now,
      );
    }

    const nextUser = cost > 0 ? await updateUserRow(cleanId, { linh_thach: coins - cost }) : user;
    const nextProfile = await saveProfile(cleanId, { slot2_unlocked: true });

    return buildAlchemyEmbed({
      user: nextUser,
      profile: nextProfile,
      slots,
      now,
      bannerText: `${em('su_sparkle')} **Đã khai mở Lò #2!** Nay đạo hữu có thể luyện song song 2 lò cùng lúc!`,
      overrideColor: '#10b981',
    });
  });
}

export async function repairFurnace(userId, opts = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) {
    return { success: false, status: 200, title: `${alchemyIcon('ui_warn')} ID không hợp lệ`, description: 'Không xác định được tu sĩ.', color: '#ef4444', image_url: '' };
  }
  const now = opts.now instanceof Date ? opts.now : new Date();
  const nowMs = now.getTime();

  return withAlchemyLock(cleanId, async () => {
    const user = await loadUserRow(cleanId, opts);
    const { profile, slots } = await loadOrInitAlchemyState(cleanId, user.level, now);

    const brokenSlots = slots.filter((s) => (
      s.status === 'exploded'
      || (s.status === 'brewing' && s.burn_at && new Date(s.burn_at).getTime() <= nowMs)
    ));

    if (brokenSlots.length === 0) {
      return buildFriendlyRejection('Hiện không có lò nào bị nổ hay cần sửa chữa!', { user, profile, slots }, now);
    }

    const overdueAshCount = brokenSlots.filter((s) => s.status === 'brewing').length;
    const ashGainLt = overdueAshCount * ALCHEMY_BURN_PAYOUT_LT;
    const repairCostLt = brokenSlots.length * ALCHEMY_INSTANT_REPAIR_COST;
    const coins = Number(user.linh_thach ?? user.coins ?? 0);

    if (coins + ashGainLt < repairCostLt) {
      return buildFriendlyRejection(
        `Cần **${repairCostLt.toLocaleString('vi-VN')} LT** để sửa **${brokenSlots.length} lò** *(hiện có: \`${coins.toLocaleString('vi-VN')} LT\`)*!`,
        { user, profile, slots },
        now,
      );
    }

    const nextSlots = [...slots];
    for (const s of brokenSlots) {
      const idx = Number(s.slot_index);
      const patched = await saveFurnaceSlot(cleanId, idx, {
        status: 'idle',
        recipe_id: null,
        started_at: null,
        ready_at: null,
        burn_at: null,
        repair_until: null,
        dm_ready_sent: false,
        dm_warn10_sent: false,
      });
      const pos = nextSlots.findIndex((item) => Number(item.slot_index) === idx);
      if (pos >= 0) nextSlots[pos] = patched;
    }

    const nextUser = await updateUserRow(cleanId, {
      linh_thach: coins + ashGainLt - repairCostLt,
    });
    const tier = getFurnaceTier(profile.furnace_level);

    return buildAlchemyEmbed({
      user: nextUser,
      profile,
      slots: nextSlots,
      now,
      bannerText: `${em('su_level_up')} **Đã sửa xong ${brokenSlots.length} lò!** Tiêu tốn \`${repairCostLt.toLocaleString('vi-VN')} LT\`${ashGainLt > 0 ? ` *(đã tự thu +${ashGainLt} LT phế đan)*` : ''} — Sẵn sàng khai lò tiếp!`,
      overrideImage: tier.image,
      overrideColor: '#10b981',
    });
  });
}

function evaluateFurnaceReminder(slot, now) {
  if (slot.status !== 'brewing' || !slot.recipe_id || !slot.ready_at || !slot.burn_at) return null;
  const nowMs = now.getTime();
  const readyMs = new Date(slot.ready_at).getTime();
  const burnMs = new Date(slot.burn_at).getTime();
  if (nowMs < readyMs || nowMs >= burnMs) return null;

  const remMs = burnMs - nowMs;
  const warnWindowMs = ALCHEMY_DM_WARN_MINUTES * 60000;
  const recipe = ALCHEMY_RECIPE_BY_ID[slot.recipe_id] || { name: slot.recipe_id };

  if (remMs <= warnWindowMs && !slot.dm_warn10_sent) {
    return {
      slot_index: Number(slot.slot_index),
      user_id: slot.user_id,
      type: 'warn10',
      recipe_name: recipe.name,
      rem_ms: remMs,
      patch: { dm_ready_sent: true, dm_warn10_sent: true },
    };
  }
  if (!slot.dm_ready_sent) {
    return {
      slot_index: Number(slot.slot_index),
      user_id: slot.user_id,
      type: 'ready',
      recipe_name: recipe.name,
      rem_ms: remMs,
      patch: { dm_ready_sent: true },
    };
  }
  return null;
}

function formatAlchemyDmPayload(userId, alerts, remainingUsers) {
  const hasUrgent = alerts.some((a) => a.type === 'warn10');
  const warnEm = uiEm('ui_warn') || em('su_sparkle');
  const fireEm = em('su_el_hoa') || em('su_sparkle');
  const clockEm = uiEm('ui_clock_timer') || em('su_sparkle');

  const dmTitle = hasUrgent
    ? `${warnEm} CẢNH BÁO LÒ ĐAN SẮP CHÁY NỔ (<10 PHÚT)!`
    : `${fireEm} MẺ ĐAN ĐÃ CHÍN — THU NGAY ĐỂ KHÔNG BỊ NỔ LÒ!`;
  const dmColor = hasUrgent ? '#ef4444' : '#10b981';

  const lines = alerts.map((a) => {
    const remTxt = formatDurationShort(a.rem_ms);
    const tag = a.type === 'warn10' ? 'SẮP NỔ LÒ!' : 'Đã chín!';
    return `• **Lò #${a.slot_index} — ${a.recipe_name}:** **${tag}** *(Còn \`${remTxt}\` trước khi cháy & khóa lò 4 giờ)*`;
  });

  const dmDescription = [
    ...lines,
    '',
    `${clockEm} Dùng lệnh \`/luyendan\` và bấm **Thu Đan / Dọn Lò** trong server ngay nhé!`,
  ].join('\n');

  return {
    success: true,
    has_notification: true,
    source: 'alchemy',
    user_id: userId,
    dm_title: dmTitle,
    dm_description: dmDescription,
    dm_color: dmColor,
    remaining_users: remainingUsers,
    alerts: alerts.map((a) => ({
      slot_index: a.slot_index,
      type: a.type,
      recipe_name: a.recipe_name,
    })),
  };
}

/**
 * Lấy & đánh dấu lô DM nhắc Lò Luyện Đan kế tiếp (chín đan / cảnh báo khẩn <=10p).
 */
export async function claimNextAlchemyDmNotification(options = {}) {
  const runTask = async () => {
    const now = options.now instanceof Date ? options.now : new Date();
    const nowIso = now.toISOString();

    let rows = [];
    if (!supabase) {
      for (const list of memFurnaces.values()) {
        for (const s of list) {
          if (s.status === 'brewing') rows.push(s);
        }
      }
      rows.sort((a, b) => String(a.user_id).localeCompare(String(b.user_id)) || a.slot_index - b.slot_index);
    } else {
      const { data, error } = await supabase
        .from('user_alchemy_furnaces')
        .select('*')
        .eq('status', 'brewing')
        .order('user_id', { ascending: true })
        .order('slot_index', { ascending: true });
      if (error) return { success: false, has_notification: false, error: error.message };
      rows = data || [];
    }

    const alertsByUser = new Map();
    for (const row of rows) {
      const al = evaluateFurnaceReminder(row, now);
      if (al) {
        if (!alertsByUser.has(row.user_id)) alertsByUser.set(row.user_id, []);
        alertsByUser.get(row.user_id).push(al);
      }
    }

    const userIds = Array.from(alertsByUser.keys());
    for (let idx = 0; idx < userIds.length; idx += 1) {
      const uid = userIds[idx];
      const alerts = alertsByUser.get(uid) || [];
      if (alerts.length === 0) continue;

      for (const al of alerts) {
        await saveFurnaceSlot(uid, al.slot_index, { ...al.patch, updated_at: nowIso });
      }
      return formatAlchemyDmPayload(uid, alerts, Math.max(0, userIds.length - idx - 1));
    }

    return { success: true, has_notification: false, remaining_users: 0 };
  };

  const nextRun = dmAlchemyQueue.then(runTask, runTask);
  dmAlchemyQueue = nextRun.catch(() => null);
  return nextRun;
}
