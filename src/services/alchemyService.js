/**
 * src/services/alchemyService.js
 * Hệ thống Lò Luyện Đan (/luyendan) — Ver 1.6.1:
 * - Tối đa 2 Lò song song (Lò #1 miễn phí; Lò #2 tự mở ở Lv.45 hoặc trả 2.500 LT).
 * - Nâng cấp Lò Lv.1 -> Lv.5 (+LT%, giảm thời gian nấu, tăng ân hạn 20p->60p, tăng tỉ lệ Thượng Phẩm/Đan Vân).
 * - 6 công thức (4 bậc LT thường + 2 công thức Tinh Hoa dùng 20/40 Linh Quả từ /farm).
 * - Giới hạn 6 mẻ/ngày (UTC+7), trừ lượt ngay lúc bắt đầu nấu.
 * - Quá ân hạn: cháy đan thu 30 LT + nổ khóa riêng lò đó 4 giờ (hỗ trợ Sửa Lò Nhanh 300 LT).
 * - DM nhắc tự động 2 mốc: khi chín & cảnh báo khẩn <=10 phút trước nổ lò.
 * Tuyệt đối KHÔNG dùng emoji Unicode Windows.
 */

import { supabase as _supabase } from '../config/supabase.js';
let supabase = _supabase;
import { em, uiEm, farmEmoji } from '../config/emojiHelper.js';
import {
  sanitizeUserId,
  ensureUserInitialized,
  pickCleanDisplayValue,
} from './profileService.js';
import { getVnDateKey, getEffectiveLuckAndFortune } from './luckAndFortuneService.js';
import { trackQuestActivity } from './questService.js';
import { invalidateInventoryCache } from './inventoryService.js';
import { applyAllSourceLtBonus } from './petBondService.js';
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
  resolveExplodedFurnaceImageUrl,
  alchemyIcon,
} from '../data/v161AlchemyCatalog.js';

const alchemyLocks = new Map();
let dmAlchemyQueue = Promise.resolve();

// In-memory store cho unit test offline (khi supabase === null)
const memProfiles = new Map();
const memFurnaces = new Map();
const memUsers = new Map();
const memInventory = new Map();

export function __resetAlchemyTestStore(seedUsers = null) {
  supabase = seedUsers !== null ? null : _supabase;
  memProfiles.clear();
  memFurnaces.clear();
  memUsers.clear();
  memInventory.clear();
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

export function __getAlchemyTestInventory(userId) {
  return { ...(memInventory.get(String(userId)) || {}) };
}

async function grantInventoryItem(userId, itemId, qty, itemCategory = 'consumable', nowIso = new Date().toISOString()) {
  const addQty = Math.max(0, Math.floor(Number(qty) || 0));
  if (addQty <= 0 || !itemId) return 0;
  if (!supabase) {
    const bag = memInventory.get(userId) || {};
    const nextQty = Number(bag[itemId] || 0) + addQty;
    bag[itemId] = nextQty;
    memInventory.set(userId, bag);
    return nextQty;
  }
  const { data: ex } = await supabase
    .from('user_inventory')
    .select('quantity')
    .eq('user_id', userId)
    .eq('item_id', itemId)
    .maybeSingle();
  const nextQty = Number(ex?.quantity || 0) + addQty;
  if (ex) {
    await supabase
      .from('user_inventory')
      .update({ quantity: nextQty, item_category: itemCategory, updated_at: nowIso })
      .eq('user_id', userId)
      .eq('item_id', itemId);
  } else {
    await supabase.from('user_inventory').insert({
      user_id: userId,
      item_id: itemId,
      item_category: itemCategory,
      quantity: nextQty,
    });
  }
  return nextQty;
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

function buildFurnaceField(slot, tier, slot2Unlocked, now) {
  const nowMs = now.getTime();
  const idx = Number(slot.slot_index);
  const isExploded = slot.status === 'exploded';
  const slotIcon = isExploded
    ? alchemyIcon(tier.explodedEmojiKey || tier.badgeEm)
    : alchemyIcon(tier.emojiKey || tier.badgeEm);
  const name = `${slotIcon} Lò #${idx}`.trim().slice(0, 250) || `Lò #${idx}`;

  if (idx === 2 && !slot2Unlocked) {
    return {
      name,
      value: `**Đã khóa**\n*Tự mở ở Lv.${ALCHEMY_SLOT2_FREE_LEVEL} hoặc bấm Mở Lò #2 (${ALCHEMY_SLOT2_UNLOCK_COST.toLocaleString('vi-VN')} LT)*`,
    };
  }

  if (isExploded) {
    const repairSec = Math.floor(new Date(slot.repair_until).getTime() / 1000);
    return {
      name,
      value: `**ĐÃ NỔ LÒ**\nMở lại <t:${repairSec}:R>\n*Bấm Sửa Lò (${ALCHEMY_INSTANT_REPAIR_COST} LT)*`,
    };
  }

  if (slot.status === 'brewing' && slot.recipe_id) {
    const recipe = ALCHEMY_RECIPE_BY_ID[slot.recipe_id];
    const pillIcon = alchemyIcon(recipe?.iconKey || 'su_el_hoa');
    const rName = recipe ? recipe.name : slot.recipe_id;
    const readyMs = new Date(slot.ready_at).getTime();
    const burnMs = new Date(slot.burn_at).getTime();
    const readySec = Math.floor(readyMs / 1000);
    const burnSec = Math.floor(burnMs / 1000);

    if (nowMs >= burnMs) {
      return {
        name,
        value: `${pillIcon} **${rName}**\n**ĐÃ CHÁY PHẾ ĐAN**\n*Bấm Thu Đan / Dọn Lò (${ALCHEMY_BURN_PAYOUT_LT} LT)*`,
      };
    }
    if (nowMs >= readyMs) {
      return {
        name,
        value: `${pillIcon} **${rName}**\n**ĐÃ CHÍN!** • Cháy <t:${burnSec}:R>\n*Bấm Thu Đan ngay*`,
      };
    }
    return {
      name,
      value: `${pillIcon} **${rName}**\nChín <t:${readySec}:R> • Cháy <t:${burnSec}:R>`,
    };
  }

  return {
    name,
    value: '**Đang trống**\n*Chọn công thức ở khung bên dưới*',
  };
}

function buildAlchemyEmbed({
  user,
  profile,
  slots,
  now = new Date(),
  bannerText = '',
  overrideColor = null,
  success = true,
  harvestPayload = null,
}) {
  const tier = getFurnaceTier(profile.furnace_level);
  const nextTier = getFurnaceTier(profile.furnace_level + 1);
  const hasNextTier = profile.furnace_level < 5;
  const ltEm = em('su_linhthach') || '';
  const essEm = farmEmoji('farm_essence') || em('su_sprout');
  const furnaceIcon = alchemyIcon(tier.emojiKey || tier.badgeEm || 'su_el_hoa');

  const slot2Unlocked = Boolean(profile.slot2_unlocked);
  const hasExplodedSlot = slots.some((s) => s.status === 'exploded');
  const uiVariant = slot2Unlocked
    ? (hasExplodedSlot ? 's2_broken' : 's2_ok')
    : (hasExplodedSlot ? 's1_broken' : 's1_ok');

  const displayName = pickCleanDisplayValue(user.username, `TuSi_${user.user_id}`);
  const userLevel = Number(user.level || 1);
  const coins = Number(user.linh_thach ?? user.coins ?? 0);
  const essence = Number(user.farm_essence || 0);

  const slot1 = slots.find((s) => Number(s.slot_index) === 1) || { slot_index: 1, status: 'idle' };
  const slot2 = slots.find((s) => Number(s.slot_index) === 2) || { slot_index: 2, status: 'idle' };
  const f1 = buildFurnaceField(slot1, tier, slot2Unlocked, now);
  const f2 = buildFurnaceField(slot2, tier, slot2Unlocked, now);

  const upgradeLine = hasNextTier
    ? `${em('su_level_up')} **Nâng Lò Lv.${nextTier.level} (${nextTier.name}):** \`${nextTier.upgradeCostLt.toLocaleString('vi-VN')} LT\` & \`${profile.total_batches_completed}/${nextTier.minBatches} mẻ thành công\``
    : `${em('su_level_up')} **Cấp Lò:** Đã đạt tối đa **Lv.5 (${tier.name})** *(Tổng: \`${profile.total_batches_completed} mẻ thành công\`)*`;

  const descParts = [];
  if (bannerText) {
    descParts.push(bannerText, '');
  }
  descParts.push(
    `**Tu Sĩ:** **${displayName}** *(Lv.${userLevel})* | ${ltEm} **\`${coins.toLocaleString('vi-VN')}\` LT** | ${essEm} **\`${essence.toLocaleString('vi-VN')}\` Linh Quả**`,
    `**Lượt hôm nay:** \`${profile.batches_today}/${ALCHEMY_DAILY_LIMIT} mẻ\` *(Reset sau ${getMidnightResetCountdown(now)})*`,
    `**Chỉ Số Lò:** \`+${tier.ltBonusPct}% LT\` | \`-${tier.timeReducePct}% Giờ\` | \`Ân hạn ${tier.graceMin}p\` | \`TP ${tier.superiorPct}% / ĐV ${tier.cloudPct}%\``,
    upgradeLine,
  );

  return {
    success,
    title: `${furnaceIcon} ĐAN PHÒNG LUYỆN ĐAN — ${tier.name.toUpperCase()} (Lv.${tier.level})`,
    description: descParts.join('\n'),
    color: overrideColor || (hasExplodedSlot ? '#ef4444' : '#ec4899'),
    image_url: '',
    footer: `Tổng mẻ thành công: ${profile.total_batches_completed} • DM nhắc khi chín & trước nổ 10p`,
    f1_name: f1.name,
    f1_value: f1.value.slice(0, 1024),
    f2_name: f2.name,
    f2_value: f2.value.slice(0, 1024),
    slot2_unlocked: slot2Unlocked ? 'true' : 'false',
    show_repair_btn: hasExplodedSlot ? 'true' : 'false',
    ui_variant: uiVariant,
    has_harvest_msg: harvestPayload ? 'true' : 'false',
    harvest_title: harvestPayload?.title || '',
    harvest_description: harvestPayload?.description || '',
    harvest_color: harvestPayload?.color || '#10b981',
    has_error_msg: success ? 'false' : 'true',
    error_title: success ? '' : `${uiEm('ui_warn') || em('su_sparkle')} KHÔNG THỂ THỰC HIỆN`,
    error_message: success ? '' : bannerText,
    state: {
      user_id: user.user_id,
      furnace_level: profile.furnace_level,
      slot2_unlocked: slot2Unlocked,
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

    const reqSlot = Number(opts.slotIndex || 0);
    let availableSlot = null;
    if (reqSlot === 1 || reqSlot === 2) {
      if (reqSlot === 2 && !profile.slot2_unlocked) {
        return buildFriendlyRejection(
          `**Lò #2** chưa mở khóa! Đạt **Lv.${ALCHEMY_SLOT2_FREE_LEVEL}** hoặc bấm **Mở Lò #2 (${ALCHEMY_SLOT2_UNLOCK_COST.toLocaleString('vi-VN')} LT)**.`,
          { user, profile, slots },
          now,
        );
      }
      const exact = slots.find((s) => Number(s.slot_index) === reqSlot);
      if (!exact || exact.status !== 'idle') {
        return buildFriendlyRejection(
          `**Lò #${reqSlot}** hiện không trống! Hãy chọn lò khác hoặc bấm **Thu Đan / Dọn Lò** trước.`,
          { user, profile, slots },
          now,
        );
      }
      availableSlot = exact;
    } else {
      availableSlot = slots.find((s) => {
        if (Number(s.slot_index) === 2 && !profile.slot2_unlocked) return false;
        return s.status === 'idle';
      });
    }
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
    const slotPatch = {
      status: 'brewing',
      recipe_id: recipe.id,
      started_at: new Date(startedMs).toISOString(),
      ready_at: new Date(readyMs).toISOString(),
      burn_at: new Date(burnMs).toISOString(),
      repair_until: null,
      dm_ready_sent: false,
      dm_warn10_sent: false,
      protected_this_cycle: false,
    };

    // Khóa atomic ô lò trước để tránh trừ lượt ảo hoặc double-click
    let updatedSlot;
    if (supabase) {
      const { data: lockedRows, error: lockErr } = await supabase
        .from('user_alchemy_furnaces')
        .update({ ...slotPatch, updated_at: now.toISOString() })
        .eq('user_id', cleanId)
        .eq('slot_index', availableSlot.slot_index)
        .eq('status', 'idle')
        .select('*');
      if (lockErr) throw new Error(lockErr.message);
      if (!lockedRows || lockedRows.length === 0) {
        return buildFriendlyRejection(
          `**Lò #${availableSlot.slot_index}** vừa được thao tác trước đó. Vui lòng thử lại!`,
          { user, profile, slots },
          now,
        );
      }
      updatedSlot = lockedRows[0];
    } else {
      updatedSlot = await saveFurnaceSlot(cleanId, availableSlot.slot_index, slotPatch);
    }

    let nextUser;
    let nextProfile;
    try {
      nextUser = await updateUserRow(cleanId, {
        linh_thach: coins - recipe.costLt,
        farm_essence: essence - recipe.costEssence,
      });
      nextProfile = await saveProfile(cleanId, {
        batches_today: Number(profile.batches_today || 0) + 1,
      });
    } catch (err) {
      await saveFurnaceSlot(cleanId, availableSlot.slot_index, {
        status: 'idle',
        recipe_id: null,
        started_at: null,
        ready_at: null,
        burn_at: null,
        repair_until: null,
        dm_ready_sent: false,
        dm_warn10_sent: false,
      }).catch(() => {});
      throw err;
    }

    invalidateInventoryCache(cleanId);
    const nextSlots = slots.map((s) => (Number(s.slot_index) === Number(availableSlot.slot_index) ? updatedSlot : s));
    const readySec = Math.floor(readyMs / 1000);
    const pillIcon = alchemyIcon(recipe.iconKey || 'su_el_hoa');

    return buildAlchemyEmbed({
      user: nextUser,
      profile: nextProfile,
      slots: nextSlots,
      now,
      bannerText: `${pillIcon} **Đã nhóm lửa Lò #${availableSlot.slot_index}!** Đang luyện **${recipe.name}** — Chín <t:${readySec}:R> *(đã trừ ${recipe.costLt} LT${recipe.costEssence > 0 ? ` + ${recipe.costEssence} Linh Quả` : ''})*.`,
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
    const pillDrops = {};
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
        let ltEarned = Math.max(1, Math.round(baseRoll * furnaceMult * quality.multiplier));
        let expEarned = Number(recipe.exp || 20);
        let pillDropNote = '';

        if (recipe.isPetExpPill && recipe.dropItemId) {
          const yieldMult = Number(recipe.yieldMult ?? 0.5);
          ltEarned = Math.max(1, Math.round(ltEarned * yieldMult));
          expEarned = Math.max(1, Math.round(expEarned * yieldMult));
          const dropQty = quality.key === 'cloud' ? 3 : quality.key === 'superior' ? 2 : 1;
          await grantInventoryItem(cleanId, recipe.dropItemId, dropQty, 'consumable', now.toISOString());
          pillDrops[recipe.dropItemId] = Number(pillDrops[recipe.dropItemId] || 0) + dropQty;
          const petExpUnit = Number(recipe.petExpPerPill || 0).toLocaleString('vi-VN');
          pillDropNote = ` + **${dropQty}× Đan EXP Pet** *(+${petExpUnit} EXP/viên vào \`/inv\`)*`;
        }

        const ltBond = await applyAllSourceLtBonus(cleanId, ltEarned);
        ltEarned = ltBond.finalLt;

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

        resultLines.push(`${alchemyIcon(recipe.iconKey || 'su_level_up')} **Lò #${idx} — ${recipe.name} [${quality.label} ×${quality.multiplier}]:** Thu **+${ltEarned.toLocaleString('vi-VN')} LT** & **+${expEarned} EXP**${pillDropNote}!`);
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
    invalidateInventoryCache(cleanId);

    const displayName = pickCleanDisplayValue(nextUser.username, `TuSi_${cleanId}`);
    const newCoins = Number(nextUser.linh_thach ?? nextUser.coins ?? 0);
    const harvestColor = anyExplodedNow ? '#ef4444' : '#10b981';
    const harvestTitle = anyExplodedNow
      ? `${uiEm('ui_warn') || em('su_sparkle')} THU ĐAN & DỌN LÒ — ${displayName}`
      : `${em('su_level_up') || em('su_sparkle')} THU ĐAN HOÀN TẤT — ${displayName}`;
    const harvestDescription = [
      ...resultLines,
      '',
      `• **Tổng Thu:** **+${totalGainLt.toLocaleString('vi-VN')} LT** & **+${totalGainExp} EXP** *(Số dư mới: \`${newCoins.toLocaleString('vi-VN')} LT\`)*`,
    ].join('\n');

    const harvestBoardBanner = anyExplodedNow
      ? `${uiEm('ui_warn') || em('su_sparkle')} **Vừa thu & dọn lò:** **+${totalGainLt.toLocaleString('vi-VN')} LT**${totalGainExp > 0 ? ` & **+${totalGainExp} EXP**` : ''} *(xem chi tiết bên dưới)*`
      : `${em('su_level_up') || em('su_sparkle')} **Vừa thu đan:** **+${totalGainLt.toLocaleString('vi-VN')} LT**${totalGainExp > 0 ? ` & **+${totalGainExp} EXP**` : ''} *(xem chi tiết bên dưới)*`;

    return {
      ...buildAlchemyEmbed({
        user: nextUser,
        profile: nextProfile,
        slots: nextSlots,
        now,
        bannerText: harvestBoardBanner,
        overrideColor: anyExplodedNow ? '#ef4444' : '#ec4899',
        harvestPayload: {
          title: harvestTitle,
          description: harvestDescription,
          color: harvestColor,
        },
      }),
      harvest_summary: {
        completed_count: completedCount,
        burned_count: burnedCount,
        total_gain_lt: totalGainLt,
        total_gain_exp: totalGainExp,
        pills_dropped: pillDrops,
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
    invalidateInventoryCache(cleanId);

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
    invalidateInventoryCache(cleanId);

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
    invalidateInventoryCache(cleanId);
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

export const ALCHEMY_PROTECT_EXTENSION_MS = 2 * 3600000;
export const ALCHEMY_PROTECT_TRIGGER_WINDOW_MS = 5 * 60000;

export function evaluateAlchemyAutoProtect(slot, protectQty, now = new Date()) {
  if (!slot || slot.status !== 'brewing' || !slot.burn_at || slot.protected_this_cycle) {
    return { shouldProtect: false };
  }
  if (Number(protectQty || 0) <= 0) return { shouldProtect: false };
  const burnMs = new Date(slot.burn_at).getTime();
  const nowMs = now.getTime();
  if (burnMs - nowMs > ALCHEMY_PROTECT_TRIGGER_WINDOW_MS) {
    return { shouldProtect: false };
  }
  const recipe = ALCHEMY_RECIPE_BY_ID[slot.recipe_id] || { name: slot.recipe_id };
  const nextBurnIso = new Date(burnMs + ALCHEMY_PROTECT_EXTENSION_MS).toISOString();
  return {
    shouldProtect: true,
    recipeName: recipe.name,
    nextBurnIso,
  };
}

export async function runAlchemyAutoProtect({ now = new Date(), userIds = null } = {}) {
  const nowIso = now.toISOString();
  const scopedSet = Array.isArray(userIds) && userIds.length > 0 ? new Set(userIds.map(String)) : null;

  let rows = [];
  if (!supabase) {
    for (const list of memFurnaces.values()) {
      for (const s of list) {
        if (s.status === 'brewing' && !s.protected_this_cycle && (!scopedSet || scopedSet.has(String(s.user_id)))) {
          rows.push(s);
        }
      }
    }
  } else {
    let q = supabase.from('user_alchemy_furnaces').select('*').eq('status', 'brewing').eq('protected_this_cycle', false);
    if (scopedSet) q = q.in('user_id', [...scopedSet]);
    const { data } = await q;
    rows = data || [];
  }

  const candidateUsers = [...new Set(rows.filter((r) => evaluateAlchemyAutoProtect(r, 1, now).shouldProtect).map((r) => r.user_id))];
  for (const uid of candidateUsers) {
    const dmRes = await withAlchemyLock(uid, async () => {
      let qty = 0;
      if (supabase) {
        const { data: invRow } = await supabase
          .from('user_inventory')
          .select('quantity')
          .eq('user_id', uid)
          .eq('item_id', 'alchemy_protect_card')
          .maybeSingle();
        qty = Number(invRow?.quantity || 0);
      } else {
        qty = Number(memUsers.get(uid)?.alchemy_protect_card_qty || 0);
      }
      if (qty <= 0) return null;

      const slots = supabase
        ? ((await supabase.from('user_alchemy_furnaces').select('*').eq('user_id', uid).eq('status', 'brewing').eq('protected_this_cycle', false)).data || [])
        : (memFurnaces.get(uid) || []).filter((s) => s.status === 'brewing' && !s.protected_this_cycle);

      const rescued = [];
      for (const s of slots) {
        const ev = evaluateAlchemyAutoProtect(s, qty, now);
        if (!ev.shouldProtect) continue;
        qty -= 1;
        rescued.push({ slot_index: s.slot_index, recipeName: ev.recipeName });
        await saveFurnaceSlot(uid, s.slot_index, {
          burn_at: ev.nextBurnIso,
          protected_this_cycle: true,
          dm_warn10_sent: false,
          updated_at: nowIso,
        });
      }
      if (rescued.length === 0) return null;

      if (supabase) {
        await supabase
          .from('user_inventory')
          .update({ quantity: Math.max(0, qty), updated_at: nowIso })
          .eq('user_id', uid)
          .eq('item_id', 'alchemy_protect_card');
      } else if (memUsers.get(uid)) {
        memUsers.get(uid).alchemy_protect_card_qty = Math.max(0, qty);
      }

      return {
        success: true,
        has_notification: true,
        source: 'alchemy_protect',
        user_id: uid,
        dm_title: `${em('alchemy_protect_card')} BÙA BẢO VỆ LÒ ĐAN ĐÃ CỨU ${rescued.length} LÒ!`,
        dm_description: [
          ...rescued.map((r) => `• **Lò #${r.slot_index} — ${r.recipeName}:** Đã **gia hạn +2 giờ** trước khi cháy nổ!`),
          '',
          `${uiEm('ui_bulb_tip')} *Số Bùa Bảo Vệ Lò còn lại: **${qty}** (Tối đa 1 lần cứu / mẻ).*`,
        ].join('\n'),
        dm_color: '#10b981',
        remaining_users: Math.max(0, candidateUsers.length - 1),
      };
    });
    if (dmRes) return dmRes;
  }
  return null;
}

/**
 * Lấy & đánh dấu lô DM nhắc Lò Luyện Đan kế tiếp (chín đan / cảnh báo khẩn <=10p).
 */
export async function claimNextAlchemyDmNotification(options = {}) {
  const runTask = async () => {
    const now = options.now instanceof Date ? options.now : new Date();
    const nowIso = now.toISOString();
    const scopedUserIds = Array.isArray(options.userIds)
      ? options.userIds.map((id) => sanitizeUserId(id)).filter(Boolean)
      : null;
    const scopedSet = scopedUserIds && scopedUserIds.length > 0 ? new Set(scopedUserIds) : null;

    if (supabase && now.getTime() - Date.now() > 5 * 60000 && !scopedSet) {
      throw new Error('REFUSED_FUTURE_CLOCK_WITHOUT_USER_SCOPE');
    }

    const rescueDm = await runAlchemyAutoProtect({ now, userIds: scopedUserIds });
    if (rescueDm?.has_notification) return rescueDm;

    let rows = [];
    if (!supabase) {
      for (const list of memFurnaces.values()) {
        for (const s of list) {
          if (s.status === 'brewing' && (!scopedSet || scopedSet.has(String(s.user_id)))) {
            rows.push(s);
          }
        }
      }
      rows.sort((a, b) => String(a.user_id).localeCompare(String(b.user_id)) || a.slot_index - b.slot_index);
    } else {
      let query = supabase
        .from('user_alchemy_furnaces')
        .select('*')
        .eq('status', 'brewing')
        .order('user_id', { ascending: true })
        .order('slot_index', { ascending: true });
      if (scopedUserIds && scopedUserIds.length > 0) {
        query = query.in('user_id', scopedUserIds);
      }
      const { data, error } = await query;
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
