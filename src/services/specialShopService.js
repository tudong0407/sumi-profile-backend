/**
 * src/services/specialShopService.js
 * Shop Đặc Biệt Chủ Nhật (/shop_dacbiet) — SuMi Family Ver 1.7:
 * - Mở cố định Chủ Nhật 08:00–24:00 (UTC+7 / giờ Việt Nam, 16 tiếng).
 * - Quy đổi 1 chiều 750 LT = 1 Tinh Thể Đỏ Vàng (TT), tối thiểu 5 TT (3.750 LT), trần 200 TT/tuần (150.000 LT).
 * - 13 mặt hàng đặc biệt có giới hạn tuần / vĩnh viễn + Thẻ Chọn Thần Thoại ưu tiên món CHƯA SỞ HỮU.
 * Tuyệt đối KHÔNG dùng emoji Unicode Windows.
 */

import { supabase as _supabase } from '../config/supabase.js';
let supabase = _supabase;
import {
  PET_CATALOG,
  EQUIPMENT_CATALOG,
  DOMAIN_CATALOG,
  DIVINE_SENSE_CATALOG,
  DIVINE_REALM_CATALOG,
  AVATAR_FRAME_BY_ID,
  ALL_CONSUMABLE_BY_ID,
  PUBLIC_BASE_URL,
  rollDefaultEnchantGrade,
  ENCHANT_GRADE_ORDER,
  normalizeEnchantGrade,
} from '../data/catalog.js';
import { SUPREME_PICK_CATEGORIES } from '../data/v16ExpansionCatalog.js';
import { em, uiEm, petEmoji, itemEmoji, domainEmoji, tierEmoji } from '../config/emojiHelper.js';
import { sanitizeUserId, ensureUserInitialized, pickCleanDisplayValue } from './profileService.js';
import { invalidateInventoryCache } from './inventoryService.js';

export const SPECIAL_SHOP_EXCHANGE_RATE = 750;
export const SPECIAL_SHOP_MIN_TT = 5;
export const SPECIAL_SHOP_WEEKLY_TT_CAP = 200;
export const SPECIAL_SHOP_OPEN_HOUR_VN = 8;

const specialShopLocks = new Map();
const memSpecialStore = {
  users: new Map(),
  inventory: new Map(),
  purchases: new Map(),
  ownedFrames: new Map(),
  pets: new Map(),
  items: new Map(),
  domains: new Map(),
};

export function __resetSpecialShopTestStore(seedUsers = null) {
  supabase = seedUsers !== null ? null : _supabase;
  memSpecialStore.users.clear();
  memSpecialStore.inventory.clear();
  memSpecialStore.purchases.clear();
  memSpecialStore.ownedFrames.clear();
  memSpecialStore.pets.clear();
  memSpecialStore.items.clear();
  memSpecialStore.domains.clear();
  if (seedUsers && typeof seedUsers === 'object') {
    for (const [uid, data] of Object.entries(seedUsers)) {
      memSpecialStore.users.set(String(uid), {
        user_id: String(uid),
        username: data.username || `TuSi_${uid}`,
        linh_thach: Number(data.linh_thach ?? data.coins ?? 0),
        red_gold_crystals: Number(data.red_gold_crystals || 0),
        weekly_tt_converted: Number(data.weekly_tt_converted || 0),
        weekly_tt_week_key: data.weekly_tt_week_key || null,
        ...data,
      });
    }
  }
}

export function __getSpecialShopTestState(userId) {
  const uid = String(userId);
  return {
    user: memSpecialStore.users.get(uid) || null,
    inventory: memSpecialStore.inventory.get(uid) || {},
    purchases: memSpecialStore.purchases.get(uid) || {},
    frames: Array.from(memSpecialStore.ownedFrames.get(uid) || []),
    pets: memSpecialStore.pets.get(uid) || [],
    items: memSpecialStore.items.get(uid) || [],
    domains: memSpecialStore.domains.get(uid) || [],
  };
}

async function withSpecialShopLock(userId, fn) {
  const prev = specialShopLocks.get(userId) || Promise.resolve();
  let release;
  const cur = new Promise((r) => { release = r; });
  const queued = prev.then(() => cur);
  specialShopLocks.set(userId, queued);
  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (specialShopLocks.get(userId) === queued) specialShopLocks.delete(userId);
  }
}

function compareEnchantGrades(a, b) {
  return ENCHANT_GRADE_ORDER.indexOf(normalizeEnchantGrade(a)) - ENCHANT_GRADE_ORDER.indexOf(normalizeEnchantGrade(b));
}

/**
 * Trả về week_key cố định theo tuần thứ Hai → Chủ Nhật (giờ VN UTC+7), VD: '2026-11-23'.
 */
export function getVnWeekKey(now = new Date()) {
  const vnMs = now.getTime() + 7 * 3600000;
  const vnDate = new Date(vnMs);
  const vnDay = vnDate.getUTCDay(); // 0=Sun..6=Sat
  const daysSinceMonday = vnDay === 0 ? 6 : vnDay - 1;
  const mondayMs = vnMs - daysSinceMonday * 86400000;
  return new Date(mondayMs).toISOString().slice(0, 10);
}

/**
 * Kiểm tra trạng thái mở cửa Shop Đặc Biệt: Chủ Nhật 08:00–24:00 (UTC+7).
 */
export function getSpecialShopScheduleStatus(now = new Date()) {
  const vnMs = now.getTime() + 7 * 3600000;
  const vnDate = new Date(vnMs);
  const vnDay = vnDate.getUTCDay();
  const vnHour = vnDate.getUTCHours();
  const isOpen = vnDay === 0 && vnHour >= SPECIAL_SHOP_OPEN_HOUR_VN;

  let closesAtIso = null;
  let nextOpenIso = null;
  if (isOpen) {
    const midnightVnMs = Date.UTC(vnDate.getUTCFullYear(), vnDate.getUTCMonth(), vnDate.getUTCDate() + 1, 0, 0, 0) - 7 * 3600000;
    closesAtIso = new Date(midnightVnMs).toISOString();
  } else {
    const daysUntilSun = vnDay === 0 ? 0 : (7 - vnDay);
    const openVnMs = Date.UTC(vnDate.getUTCFullYear(), vnDate.getUTCMonth(), vnDate.getUTCDate() + daysUntilSun, SPECIAL_SHOP_OPEN_HOUR_VN, 0, 0) - 7 * 3600000;
    nextOpenIso = new Date(openVnMs).toISOString();
  }

  return {
    is_open: isOpen,
    vn_day: vnDay,
    vn_hour: vnHour,
    week_key: getVnWeekKey(now),
    closes_at_iso: closesAtIso,
    next_open_iso: nextOpenIso,
    schedule_text: 'Chủ Nhật 08:00–24:00 (UTC+7)',
  };
}

export const SPECIAL_SHOP_CATALOG = [
  {
    item_id: 'evo_crystal',
    name: 'Hồng Mông Tiến Hóa Tinh',
    category: 'consumable',
    price_tt: 120,
    weekly_limit: 1,
    lifetime_limit: null,
    icon: em('evo_crystal'),
    description: ALL_CONSUMABLE_BY_ID.evo_crystal?.description || 'Tinh thể tiến hóa 40 Pet Độc Nhất lên Tối Thượng Chân Thần (/tienhoa).',
  },
  {
    item_id: 'mythic_selector_card',
    name: 'Thẻ Chọn Thần Thoại',
    category: 'consumable',
    price_tt: 55,
    weekly_limit: 1,
    lifetime_limit: null,
    icon: em('mythic_selector_card'),
    description: ALL_CONSUMABLE_BY_ID.mythic_selector_card?.description || 'Chọn 1/7 nhóm nhận Thần Thoại KHÔNG Độc Nhất (ưu tiên món chưa có).',
  },
  {
    item_id: 'enchant_stone_absolute',
    name: 'Thiên Đạo Tuyệt Ấn Thạch',
    category: 'consumable',
    price_tt: 40,
    weekly_limit: 1,
    lifetime_limit: null,
    icon: em('enchant_stone_absolute'),
    description: 'Đảm bảo Khắc Ấn thành công 100% ở mọi bậc D→S.',
  },
  {
    item_id: 'frame_v17_06_crimson_raven',
    name: `Viền: ${AVATAR_FRAME_BY_ID.frame_v17_06_crimson_raven?.name || 'Huyết Nha Thâm Uyên'}`,
    category: 'frame',
    price_tt: 25,
    weekly_limit: null,
    lifetime_limit: 1,
    icon: em('su_tier_toithuong'),
    description: 'Khung kỷ niệm Cánh Quạ Đỏ Huyết Cầu cao quý (Mua 1 lần sở hữu vĩnh viễn).',
  },
  {
    item_id: 'abs_enchant_charm',
    name: 'Bùa Đá Tuyệt Ấn',
    category: 'consumable',
    price_tt: 20,
    weekly_limit: 2,
    lifetime_limit: null,
    icon: em('abs_enchant_charm'),
    description: ALL_CONSUMABLE_BY_ID.abs_enchant_charm?.description || 'Tăng tỷ lệ rơi Đá Tuyệt Ấn /explorer từ 5% -> 25% cho 5 chuyến.',
  },
  {
    item_id: 'chaos_essence_shard',
    name: 'Mảnh Tinh Hoa Hỗn Độn',
    category: 'consumable',
    price_tt: 16,
    weekly_limit: 3,
    lifetime_limit: null,
    icon: em('chaos_essence_shard'),
    description: ALL_CONSUMABLE_BY_ID.chaos_essence_shard?.description || '3 mảnh + 1 Pet Thần Thoại thường + 2.500 LT chế thành 1 Hồng Mông Tiến Hóa Tinh.',
  },
  {
    item_id: 'frame_v17_01_moon_fox',
    name: `Viền: ${AVATAR_FRAME_BY_ID.frame_v17_01_moon_fox?.name || 'Cửu Vĩ Nguyệt Hoa'}`,
    category: 'frame',
    price_tt: 20,
    weekly_limit: null,
    lifetime_limit: 1,
    icon: em('su_realm_star'),
    description: AVATAR_FRAME_BY_ID.frame_v17_01_moon_fox?.description || 'Khung Cửu Vĩ Nguyệt Hoa (Shop Đặc Biệt).',
  },
  {
    item_id: 'frame_v17_02_azure_dragon',
    name: `Viền: ${AVATAR_FRAME_BY_ID.frame_v17_02_azure_dragon?.name || 'Long Vân Thanh Sơn'}`,
    category: 'frame',
    price_tt: 18,
    weekly_limit: null,
    lifetime_limit: 1,
    icon: em('su_realm_star'),
    description: AVATAR_FRAME_BY_ID.frame_v17_02_azure_dragon?.description || 'Khung Long Vân Thanh Sơn (Shop Đặc Biệt).',
  },
  {
    item_id: 'frame_v17_04_lotus_feather',
    name: `Viền: ${AVATAR_FRAME_BY_ID.frame_v17_04_lotus_feather?.name || 'Liên Hoa Vũ Dực'}`,
    category: 'frame',
    price_tt: 14,
    weekly_limit: null,
    lifetime_limit: 1,
    icon: em('su_realm_star'),
    description: AVATAR_FRAME_BY_ID.frame_v17_04_lotus_feather?.description || 'Khung Liên Hoa Vũ Dực (Shop Đặc Biệt).',
  },
  {
    item_id: 'frame_v17_09_sapphire_butterfly',
    name: `Viền: ${AVATAR_FRAME_BY_ID.frame_v17_09_sapphire_butterfly?.name || 'Lam Điệp Tinh Lệ'}`,
    category: 'frame',
    price_tt: 10,
    weekly_limit: null,
    lifetime_limit: 1,
    icon: em('su_realm_star'),
    description: AVATAR_FRAME_BY_ID.frame_v17_09_sapphire_butterfly?.description || 'Khung Lam Điệp Tinh Lệ (Shop Đặc Biệt).',
  },
  {
    item_id: 'farm_auto_card',
    name: 'Thẻ Tự Động Chăm Farm 24h',
    category: 'consumable',
    price_tt: 4,
    weekly_limit: 3,
    lifetime_limit: null,
    icon: em('farm_auto_card'),
    description: ALL_CONSUMABLE_BY_ID.farm_auto_card?.description || 'Tự tưới & tự thu hoạch 24 giờ.',
  },
  {
    item_id: 'farm_growth_med',
    name: 'Thuốc Kích Thích Tăng Trưởng',
    category: 'consumable',
    price_tt: 4,
    weekly_limit: 4,
    lifetime_limit: null,
    icon: em('farm_growth_med'),
    description: ALL_CONSUMABLE_BY_ID.farm_growth_med?.description || 'Giảm -25% thời gian chín 1 chu kỳ /farm.',
  },
  {
    item_id: 'farm_yield_starch',
    name: 'Bột Tăng Sản Lượng',
    category: 'consumable',
    price_tt: 4,
    weekly_limit: 4,
    lifetime_limit: null,
    icon: em('farm_yield_starch'),
    description: ALL_CONSUMABLE_BY_ID.farm_yield_starch?.description || 'Tăng +30% LT & Linh Quả lần thu hoạch tới.',
  },
];

export const SPECIAL_SHOP_BY_ID = Object.fromEntries(SPECIAL_SHOP_CATALOG.map((it) => [it.item_id, it]));

async function loadUserRecord(cleanId, options = {}) {
  if (supabase) {
    const { user } = await ensureUserInitialized(cleanId, {
      username: pickCleanDisplayValue(options.username, options.fallbackUsername),
      avatarUrl: pickCleanDisplayValue(options.avatarUrl),
    });
    return user;
  }
  let u = memSpecialStore.users.get(cleanId);
  if (!u) {
    u = {
      user_id: cleanId,
      username: options.username || `TuSi_${cleanId.slice(-4)}`,
      linh_thach: 0,
      red_gold_crystals: 0,
      weekly_tt_converted: 0,
      weekly_tt_week_key: null,
    };
    memSpecialStore.users.set(cleanId, u);
  }
  return u;
}

async function loadPurchaseMap(cleanId, weekKey) {
  if (!supabase) {
    return memSpecialStore.purchases.get(cleanId) || {};
  }
  const { data } = await supabase
    .from('special_shop_purchases')
    .select('item_id, week_key, quantity')
    .eq('user_id', cleanId);
  const weekly = {};
  const lifetime = {};
  for (const row of data || []) {
    lifetime[row.item_id] = (lifetime[row.item_id] || 0) + Number(row.quantity || 0);
    if (row.week_key === weekKey) {
      weekly[row.item_id] = (weekly[row.item_id] || 0) + Number(row.quantity || 0);
    }
  }
  return { weekly, lifetime };
}

export async function getSpecialShopCatalog(userId, options = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID người dùng không hợp lệ.' };

  const now = options.now instanceof Date ? options.now : new Date();
  const schedule = getSpecialShopScheduleStatus(now);
  const isOpen = options.bypassSchedule === true ? true : schedule.is_open;
  const user = await loadUserRecord(cleanId, options);
  if (!user) return { success: false, status: 500, error: 'USER_INIT_FAILED', message: 'Không thể khởi tạo hồ sơ.' };

  const crystals = Number(user.red_gold_crystals || 0);
  const balance = Number(user.linh_thach || 0);
  const convertedThisWeek = user.weekly_tt_week_key === schedule.week_key ? Number(user.weekly_tt_converted || 0) : 0;

  let weeklyMap = {};
  let lifetimeMap = {};
  let ownedFrames = new Set();
  let selectorQty = 0;

  if (supabase) {
    const [pMap, { data: frames }, { data: selRow }] = await Promise.all([
      loadPurchaseMap(cleanId, schedule.week_key),
      supabase.from('user_frames').select('frame_id').eq('user_id', cleanId),
      supabase.from('user_inventory').select('quantity').eq('user_id', cleanId).eq('item_id', 'mythic_selector_card').maybeSingle(),
    ]);
    weeklyMap = pMap.weekly;
    lifetimeMap = pMap.lifetime;
    ownedFrames = new Set((frames || []).map((f) => f.frame_id));
    selectorQty = Number(selRow?.quantity || 0);
  } else {
    const memPurch = memSpecialStore.purchases.get(cleanId) || {};
    weeklyMap = memPurch[schedule.week_key] || {};
    for (const wk of Object.values(memPurch)) {
      for (const [k, v] of Object.entries(wk)) lifetimeMap[k] = (lifetimeMap[k] || 0) + Number(v || 0);
    }
    ownedFrames = memSpecialStore.ownedFrames.get(cleanId) || new Set();
    selectorQty = Number((memSpecialStore.inventory.get(cleanId) || {}).mythic_selector_card || 0);
  }

  const items = SPECIAL_SHOP_CATALOG.map((it) => {
    const boughtWeek = Number(weeklyMap[it.item_id] || 0);
    const boughtLifetime = Number(lifetimeMap[it.item_id] || 0);
    const frameOwned = it.category === 'frame' && ownedFrames.has(it.item_id);
    const remainingWeek = it.weekly_limit ? Math.max(0, it.weekly_limit - boughtWeek) : null;
    const soldOut = frameOwned || (it.lifetime_limit && boughtLifetime >= it.lifetime_limit) || (it.weekly_limit && remainingWeek <= 0);
    return {
      ...it,
      bought_week: boughtWeek,
      bought_lifetime: boughtLifetime,
      remaining_week: remainingWeek,
      owned: frameOwned,
      sold_out: Boolean(soldOut),
    };
  });

  const ttIcon = em('red_gold_crystal');
  const ltIcon = em('su_linhthach');
  const statusBanner = isOpen
    ? `${em('su_sparkle')} **ĐANG MỞ CỬA** *(Chủ Nhật 08:00–24:00 UTC+7)*`
    : `${uiEm('ui_clock_timer')} **CHƯA TỚI GIỜ MỞ CỬA** — Chỉ mở **Chủ Nhật \`08:00–24:00\` (UTC+7)**!`;

  const lines = [
    statusBanner,
    `• ${ttIcon} **Tinh Thể Đỏ Vàng (TT):** **${crystals.toLocaleString('vi-VN')} TT** • ${ltIcon} **Linh Thạch:** **${balance.toLocaleString('vi-VN')} LT**`,
    `• ${uiEm('ui_refresh')} **Quy Đổi Tuần Này:** \`${convertedThisWeek}/${SPECIAL_SHOP_WEEKLY_TT_CAP} TT\` *(Tỷ giá: \`${SPECIAL_SHOP_EXCHANGE_RATE} LT = 1 TT\`, tối thiểu \`${SPECIAL_SHOP_MIN_TT} TT\`, 1 chiều)*`,
    selectorQty > 0 ? `• ${em('mythic_selector_card')} **Bạn đang có \`${selectorQty}\` Thẻ Chọn Thần Thoại chờ mở!**` : '',
    '',
    '**Danh Sách Hàng Đặc Biệt:**',
    ...items.map((it) => {
      const limitTxt = it.category === 'frame'
        ? (it.owned ? '**[ĐÃ SỞ HỮU]**' : '*(Giới hạn: 1 lần)*')
        : `*(Còn tuần: \`${it.remaining_week}/${it.weekly_limit}\`)*`;
      return `• ${it.icon} \`${it.item_id}\` — **${it.name}**: **${it.price_tt} TT** ${limitTxt}`;
    }),
  ].filter(Boolean);

  return {
    success: true,
    is_open: isOpen,
    schedule,
    crystals,
    linh_thach: balance,
    converted_this_week: convertedThisWeek,
    weekly_cap: SPECIAL_SHOP_WEEKLY_TT_CAP,
    exchange_rate: SPECIAL_SHOP_EXCHANGE_RATE,
    min_exchange_tt: SPECIAL_SHOP_MIN_TT,
    selector_card_qty: selectorQty,
    items,
    title: `${ttIcon} SHOP ĐẶC BIỆT CHỦ NHẬT (/shop_dacbiet)`,
    description: lines.join('\n'),
    color: isOpen ? '#f43f5e' : '#64748b',
    footer: '',
  };
}

export async function convertLtToCrystals(userId, rawTtAmount, options = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID người dùng không hợp lệ.' };

  const now = options.now instanceof Date ? options.now : new Date();
  const schedule = getSpecialShopScheduleStatus(now);
  if (!options.bypassSchedule && !schedule.is_open) {
    return {
      success: false,
      status: 403,
      error: 'SPECIAL_SHOP_CLOSED',
      message: `${uiEm('ui_clock_timer')} **Shop Đặc Biệt** chỉ mở vào **Chủ Nhật 08:00–24:00 (UTC+7)**! Hiện tại chưa thể quy đổi Tinh Thể Đỏ Vàng.`,
    };
  }

  const ttAmount = Math.floor(Number(rawTtAmount) || 0);
  if (!Number.isFinite(ttAmount) || ttAmount < SPECIAL_SHOP_MIN_TT) {
    return {
      success: false,
      status: 400,
      error: 'BELOW_MIN_EXCHANGE',
      message: `Mỗi lần quy đổi cần tối thiểu **${SPECIAL_SHOP_MIN_TT} TT** (**${(SPECIAL_SHOP_MIN_TT * SPECIAL_SHOP_EXCHANGE_RATE).toLocaleString('vi-VN')} LT**).`,
    };
  }

  return withSpecialShopLock(cleanId, async () => {
    const user = await loadUserRecord(cleanId, options);
    const convertedThisWeek = user.weekly_tt_week_key === schedule.week_key ? Number(user.weekly_tt_converted || 0) : 0;
    if (convertedThisWeek + ttAmount > SPECIAL_SHOP_WEEKLY_TT_CAP) {
      return {
        success: false,
        status: 400,
        error: 'WEEKLY_EXCHANGE_CAP_EXCEEDED',
        message: `Vượt quá giới hạn quy đổi tuần! Bạn đã đổi **${convertedThisWeek}/${SPECIAL_SHOP_WEEKLY_TT_CAP} TT** tuần này *(tối đa còn **${Math.max(0, SPECIAL_SHOP_WEEKLY_TT_CAP - convertedThisWeek)} TT**)*!`,
      };
    }

    const ltCost = ttAmount * SPECIAL_SHOP_EXCHANGE_RATE;
    const bal = Number(user.linh_thach || 0);
    if (bal < ltCost) {
      return {
        success: false,
        status: 400,
        error: 'INSUFFICIENT_FUNDS',
        message: `Cần **${ltCost.toLocaleString('vi-VN')}** ${em('su_linhthach')} **LT** để đổi **${ttAmount} TT** *(Hiện có: ${bal.toLocaleString('vi-VN')} LT)*!`,
      };
    }

    const nextBal = bal - ltCost;
    const nextCrystals = Number(user.red_gold_crystals || 0) + ttAmount;
    const nextConverted = convertedThisWeek + ttAmount;
    const nowIso = now.toISOString();

    if (supabase) {
      const { error } = await supabase
        .from('users')
        .update({
          linh_thach: nextBal,
          red_gold_crystals: nextCrystals,
          weekly_tt_converted: nextConverted,
          weekly_tt_week_key: schedule.week_key,
          updated_at: nowIso,
        })
        .eq('user_id', cleanId);
      if (error) throw new Error(`Convert TT update failed: ${error.message}`);
    } else {
      user.linh_thach = nextBal;
      user.red_gold_crystals = nextCrystals;
      user.weekly_tt_converted = nextConverted;
      user.weekly_tt_week_key = schedule.week_key;
    }

    return {
      success: true,
      tt_gained: ttAmount,
      lt_spent: ltCost,
      red_gold_crystals: nextCrystals,
      linh_thach: nextBal,
      converted_this_week: nextConverted,
      weekly_cap: SPECIAL_SHOP_WEEKLY_TT_CAP,
      message: `${em('red_gold_crystal')} Quy đổi thành công **+${ttAmount} TT** *(trừ **-${ltCost.toLocaleString('vi-VN')} LT**)*!\n• Số dư: **${nextCrystals.toLocaleString('vi-VN')} TT** • **${nextBal.toLocaleString('vi-VN')} LT** • Hạn mức tuần: \`${nextConverted}/${SPECIAL_SHOP_WEEKLY_TT_CAP} TT\``,
    };
  });
}

export async function buySpecialShopItem(userId, rawItemId, rawQty = 1, options = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID người dùng không hợp lệ.' };

  const now = options.now instanceof Date ? options.now : new Date();
  const schedule = getSpecialShopScheduleStatus(now);
  if (!options.bypassSchedule && !schedule.is_open) {
    return {
      success: false,
      status: 403,
      error: 'SPECIAL_SHOP_CLOSED',
      message: `${uiEm('ui_clock_timer')} **Shop Đặc Biệt** chỉ mở vào **Chủ Nhật 08:00–24:00 (UTC+7)**!`,
    };
  }

  const itemId = String(rawItemId || '').trim().toLowerCase();
  const item = SPECIAL_SHOP_BY_ID[itemId];
  if (!item) {
    return { success: false, status: 404, error: 'ITEM_NOT_FOUND', message: `Không tìm thấy mặt hàng \`${rawItemId}\` trong Shop Đặc Biệt.` };
  }

  const qty = Math.max(1, Math.floor(Number(rawQty) || 1));

  return withSpecialShopLock(cleanId, async () => {
    const user = await loadUserRecord(cleanId, options);
    const nowIso = now.toISOString();

    let boughtWeek = 0;
    let boughtLifetime = 0;
    let frameAlreadyOwned = false;

    if (supabase) {
      const pMap = await loadPurchaseMap(cleanId, schedule.week_key);
      boughtWeek = Number(pMap.weekly[itemId] || 0);
      boughtLifetime = Number(pMap.lifetime[itemId] || 0);
      if (item.category === 'frame') {
        const { data: fRow } = await supabase
          .from('user_frames')
          .select('frame_id')
          .eq('user_id', cleanId)
          .eq('frame_id', itemId)
          .maybeSingle();
        frameAlreadyOwned = Boolean(fRow);
      }
    } else {
      const memPurch = memSpecialStore.purchases.get(cleanId) || {};
      boughtWeek = Number((memPurch[schedule.week_key] || {})[itemId] || 0);
      for (const wk of Object.values(memPurch)) boughtLifetime += Number(wk[itemId] || 0);
      frameAlreadyOwned = (memSpecialStore.ownedFrames.get(cleanId) || new Set()).has(itemId);
    }

    if (item.category === 'frame' && (frameAlreadyOwned || (item.lifetime_limit && boughtLifetime + qty > item.lifetime_limit))) {
      return {
        success: false,
        status: 409,
        error: 'FRAME_ALREADY_OWNED',
        message: `${item.icon} Bạn đã sở hữu vĩnh viễn **${item.name}** rồi!`,
      };
    }

    if (item.weekly_limit && boughtWeek + qty > item.weekly_limit) {
      return {
        success: false,
        status: 400,
        error: 'WEEKLY_LIMIT_REACHED',
        message: `${item.icon} **${item.name}** chỉ được mua tối đa **${item.weekly_limit} lần/tuần** *(đã mua: \`${boughtWeek}/${item.weekly_limit}\`)*!`,
      };
    }

    const totalCostTt = item.price_tt * qty;
    const crystals = Number(user.red_gold_crystals || 0);
    if (crystals < totalCostTt) {
      return {
        success: false,
        status: 400,
        error: 'INSUFFICIENT_CRYSTALS',
        message: `Cần **${totalCostTt} TT** ${em('red_gold_crystal')} để mua **${qty}× ${item.name}** *(Hiện có: **${crystals} TT** — Hãy quy đổi LT → TT trước!)*`,
      };
    }

    const nextCrystals = crystals - totalCostTt;
    if (supabase) {
      await supabase
        .from('users')
        .update({ red_gold_crystals: nextCrystals, updated_at: nowIso })
        .eq('user_id', cleanId);

      await supabase.from('special_shop_purchases').upsert({
        user_id: cleanId,
        item_id: itemId,
        week_key: schedule.week_key,
        quantity: boughtWeek + qty,
        updated_at: nowIso,
      }, { onConflict: 'user_id,item_id,week_key' });

      if (item.category === 'frame') {
        await supabase.from('user_frames').upsert({
          user_id: cleanId,
          frame_id: itemId,
          purchased_at: nowIso,
        }, { onConflict: 'user_id,frame_id' });
      } else {
        const { data: invRow } = await supabase
          .from('user_inventory')
          .select('quantity')
          .eq('user_id', cleanId)
          .eq('item_id', itemId)
          .maybeSingle();
        if (invRow) {
          await supabase
            .from('user_inventory')
            .update({ quantity: Number(invRow.quantity || 0) + qty, updated_at: nowIso })
            .eq('user_id', cleanId)
            .eq('item_id', itemId);
        } else {
          await supabase.from('user_inventory').insert({
            user_id: cleanId,
            item_id: itemId,
            item_category: 'consumable',
            quantity: qty,
            updated_at: nowIso,
          });
        }
      }
      invalidateInventoryCache(cleanId);
    } else {
      user.red_gold_crystals = nextCrystals;
      if (!memSpecialStore.purchases.has(cleanId)) memSpecialStore.purchases.set(cleanId, {});
      const uP = memSpecialStore.purchases.get(cleanId);
      if (!uP[schedule.week_key]) uP[schedule.week_key] = {};
      uP[schedule.week_key][itemId] = boughtWeek + qty;

      if (item.category === 'frame') {
        if (!memSpecialStore.ownedFrames.has(cleanId)) memSpecialStore.ownedFrames.set(cleanId, new Set());
        memSpecialStore.ownedFrames.get(cleanId).add(itemId);
      } else {
        if (!memSpecialStore.inventory.has(cleanId)) memSpecialStore.inventory.set(cleanId, {});
        const inv = memSpecialStore.inventory.get(cleanId);
        inv[itemId] = Number(inv[itemId] || 0) + qty;
      }
    }

    return {
      success: true,
      item_id: itemId,
      quantity: qty,
      cost_tt: totalCostTt,
      red_gold_crystals: nextCrystals,
      bought_week: boughtWeek + qty,
      weekly_limit: item.weekly_limit,
      message: `${item.icon} Mua thành công **${qty}× ${item.name}** với giá **${totalCostTt} TT** ${em('red_gold_crystal')} *(còn **${nextCrystals.toLocaleString('vi-VN')} TT**)*!`,
    };
  });
}

/**
 * Mở Thẻ Chọn Thần Thoại (chọn 1/7 nhóm nhận Thần Thoại KHÔNG Độc Nhất, ƯU TIÊN món CHƯA SỞ HỮU trước).
 */
export async function openMythicSelectorCard(userId, pickCategory = 'pet', options = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID người dùng không hợp lệ.' };

  const catKey = String(pickCategory || '').trim().toLowerCase();
  if (!SUPREME_PICK_CATEGORIES.some((c) => c.key === catKey)) {
    return { success: false, status: 400, error: 'INVALID_CATEGORY', message: `Nhóm '${pickCategory}' không hợp lệ.` };
  }
  const rng = typeof options.rng === 'function' ? options.rng : Math.random;
  const nowIso = (options.now instanceof Date ? options.now : new Date()).toISOString();

  return withSpecialShopLock(cleanId, async () => {
    await loadUserRecord(cleanId, options);

    let cardQty = 0;
    if (supabase) {
      const { data: cardRow } = await supabase
        .from('user_inventory')
        .select('quantity')
        .eq('user_id', cleanId)
        .eq('item_id', 'mythic_selector_card')
        .maybeSingle();
      cardQty = Number(cardRow?.quantity || 0);
    } else {
      cardQty = Number((memSpecialStore.inventory.get(cleanId) || {}).mythic_selector_card || 0);
    }

    if (cardQty <= 0) {
      return {
        success: false,
        status: 400,
        error: 'NO_SELECTOR_CARD',
        message: `Bạn chưa có ${em('mythic_selector_card')} **Thẻ Chọn Thần Thoại** trong túi! Hãy mua tại \`/shop_dacbiet\` (55 TT).`,
      };
    }

    let fullPool = [];
    if (catKey === 'pet') {
      fullPool = PET_CATALOG.filter((p) => p.rarity_key === 'mythic' && !p.is_unique && !p.is_exclusive_fuyumi);
    } else if (['weapon', 'gem', 'soul'].includes(catKey)) {
      fullPool = EQUIPMENT_CATALOG.filter((e) => e.item_type === catKey && e.rarity_key === 'mythic' && !e.is_unique);
    } else if (catKey === 'domain') {
      fullPool = DOMAIN_CATALOG.filter((d) => d.rarity_key === 'mythic' && !d.is_unique && !d.is_exclusive_fuyumi);
    } else if (catKey === 'sense') {
      fullPool = DIVINE_SENSE_CATALOG.filter((s) => s.rarity_key === 'mythic' && !s.is_unique && !s.is_exclusive_fuyumi);
    } else if (catKey === 'realm') {
      fullPool = DIVINE_REALM_CATALOG.filter((r) => r.rarity_key === 'mythic' && !r.is_unique && !r.is_exclusive_fuyumi);
    }

    if (fullPool.length === 0) {
      return { success: false, status: 500, error: 'EMPTY_POOL', message: 'Không tìm thấy pool Thần Thoại phù hợp.' };
    }

    // Lấy danh sách đã sở hữu để ƯU TIÊN món chưa có trước!
    let ownedSet = new Set();
    if (supabase) {
      if (catKey === 'pet') {
        const { data } = await supabase.from('user_pets').select('pet_type').eq('user_id', cleanId);
        ownedSet = new Set((data || []).map((r) => r.pet_type));
      } else if (['weapon', 'gem', 'soul'].includes(catKey)) {
        const { data } = await supabase.from('user_pet_items').select('item_id').eq('user_id', cleanId);
        ownedSet = new Set((data || []).map((r) => r.item_id));
      } else {
        const { data } = await supabase.from('user_domains').select('entity_id').eq('user_id', cleanId).eq('entity_kind', catKey);
        ownedSet = new Set((data || []).map((r) => r.entity_id));
      }
    } else {
      if (catKey === 'pet') {
        ownedSet = new Set((memSpecialStore.pets.get(cleanId) || []).map((r) => r.pet_type));
      } else if (['weapon', 'gem', 'soul'].includes(catKey)) {
        ownedSet = new Set((memSpecialStore.items.get(cleanId) || []).map((r) => r.item_id));
      } else {
        ownedSet = new Set((memSpecialStore.domains.get(cleanId) || []).filter((d) => d.entity_kind === catKey).map((d) => d.entity_id));
      }
    }

    const unownedPool = fullPool.filter((x) => {
      const id = x.pet_type || x.item_id || x.domain_id || x.sense_id || x.realm_id;
      return !ownedSet.has(id);
    });
    const candidatePool = unownedPool.length > 0 ? unownedPool : fullPool;
    const picked = candidatePool[Math.floor(rng() * candidatePool.length) % candidatePool.length];
    const wasUnowned = unownedPool.length > 0;

    let label = '';
    let imageUrl = '';
    const pickedId = picked.pet_type || picked.item_id || picked.domain_id || picked.sense_id || picked.realm_id;

    if (catKey === 'pet') {
      label = `${petEmoji(picked.pet_type)} **${picked.pet_name}**`;
      imageUrl = `${PUBLIC_BASE_URL}/api/wiki/pet/${picked.pet_type}.webp`;
      const grade = rollDefaultEnchantGrade(rng);
      if (supabase) {
        const { data: ex } = await supabase.from('user_pets').select('pet_id, quantity, enchant_grade').eq('user_id', cleanId).eq('pet_type', picked.pet_type).maybeSingle();
        if (ex) {
          const bestGrade = compareEnchantGrades(grade, ex.enchant_grade) > 0 ? grade : ex.enchant_grade;
          const { error: e } = await supabase.from('user_pets').update({ quantity: Number(ex.quantity || 1) + 1, enchant_grade: bestGrade }).eq('pet_id', ex.pet_id);
          if (e) throw new Error(`Selector pet update failed: ${e.message}`);
        } else {
          const { error: e } = await supabase.from('user_pets').insert({
            user_id: cleanId,
            pet_type: picked.pet_type,
            pet_name: picked.pet_name,
            pet_rarity: picked.rarity,
            element: picked.element,
            level: 1,
            star: 1,
            atk: picked.base_atk,
            def: picked.base_def,
            spd: picked.base_spd,
            is_active: false,
            is_unique: false,
            source: 'mythic_selector_card',
            paid_price: 0,
            hax_skill: picked.hax_skill,
            hax_description: picked.hax_description,
            enchant_grade: grade,
            enchant_pity: 0,
            quantity: 1,
          });
          if (e) throw new Error(`Selector pet insert failed: ${e.message}`);
        }
      } else {
        if (!memSpecialStore.pets.has(cleanId)) memSpecialStore.pets.set(cleanId, []);
        memSpecialStore.pets.get(cleanId).push({ pet_type: picked.pet_type, pet_name: picked.pet_name, enchant_grade: grade, quantity: 1 });
      }
    } else if (['weapon', 'gem', 'soul'].includes(catKey)) {
      label = `${itemEmoji(picked.item_id)} **${picked.item_name}**`;
      imageUrl = `${PUBLIC_BASE_URL}/api/wiki/item/${picked.item_id}.webp`;
      const grade = rollDefaultEnchantGrade(rng);
      if (supabase) {
        const { data: ex } = await supabase.from('user_pet_items').select('id, quantity, enchant_grade').eq('user_id', cleanId).eq('item_id', picked.item_id).maybeSingle();
        if (ex) {
          const bestGrade = compareEnchantGrades(grade, ex.enchant_grade) > 0 ? grade : ex.enchant_grade;
          const { error: e } = await supabase.from('user_pet_items').update({ quantity: Number(ex.quantity || 1) + 1, enchant_grade: bestGrade }).eq('id', ex.id);
          if (e) throw new Error(`Selector item update failed: ${e.message}`);
        } else {
          const { error: e } = await supabase.from('user_pet_items').insert({
            user_id: cleanId,
            item_id: picked.item_id,
            equipped_to_pet: null,
            slot: null,
            source: 'mythic_selector_card',
            paid_price: 0,
            enchant_grade: grade,
            enchant_pity: 0,
            quantity: 1,
            is_unique: false,
          });
          if (e) throw new Error(`Selector item insert failed: ${e.message}`);
        }
      } else {
        if (!memSpecialStore.items.has(cleanId)) memSpecialStore.items.set(cleanId, []);
        memSpecialStore.items.get(cleanId).push({ item_id: picked.item_id, enchant_grade: grade, quantity: 1 });
      }
    } else {
      label = `${domainEmoji(pickedId, em('su_realm_star'))} **${picked.name}**`;
      imageUrl = `${PUBLIC_BASE_URL}/assets/domains/${pickedId}.webp?v=1.5`;
      if (supabase) {
        const { data: ex } = await supabase.from('user_domains').select('id, quantity').eq('user_id', cleanId).eq('entity_kind', catKey).eq('entity_id', pickedId).maybeSingle();
        if (ex) {
          const { error: e } = await supabase.from('user_domains').update({ quantity: Number(ex.quantity || 1) + 1, updated_at: nowIso }).eq('id', ex.id);
          if (e) throw new Error(`Selector domain update failed: ${e.message}`);
        } else {
          const { error: e } = await supabase.from('user_domains').insert({
            user_id: cleanId,
            entity_kind: catKey,
            entity_id: pickedId,
            quantity: 1,
            is_equipped: false,
            is_unique: false,
            source: 'mythic_selector_card',
          });
          if (e) throw new Error(`Selector domain insert failed: ${e.message}`);
        }
      } else {
        if (!memSpecialStore.domains.has(cleanId)) memSpecialStore.domains.set(cleanId, []);
        memSpecialStore.domains.get(cleanId).push({ entity_kind: catKey, entity_id: pickedId, quantity: 1 });
      }
    }

    // Chỉ trừ thẻ sau khi đã ghi đồ thành công
    if (supabase) {
      await supabase
        .from('user_inventory')
        .update({ quantity: Math.max(0, cardQty - 1), updated_at: nowIso })
        .eq('user_id', cleanId)
        .eq('item_id', 'mythic_selector_card');
      invalidateInventoryCache(cleanId);
    } else {
      memSpecialStore.inventory.get(cleanId).mythic_selector_card = Math.max(0, cardQty - 1);
    }

    return {
      success: true,
      category: catKey,
      picked_id: pickedId,
      picked_name: picked.pet_name || picked.item_name || picked.name,
      was_unowned: wasUnowned,
      remaining_cards: Math.max(0, cardQty - 1),
      title: `${em('mythic_selector_card')} MỞ THẺ CHỌN THẦN THOẠI THÀNH CÔNG!`,
      description: `${tierEmoji('mythic')} Nhận được ${label} *(Thần Thoại • ${wasUnowned ? 'Món Mới Chưa Sở Hữu' : 'Đã full nhóm → cộng dồn'})*!`,
      image_url: imageUrl,
      color: '#f59e0b',
      footer: '',
    };
  });
}
