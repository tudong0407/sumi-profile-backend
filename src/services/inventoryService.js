/**
 * src/services/inventoryService.js
 * Quản lý Túi Đồ (/inv), Mặc/Tháo Pháp Bảo, Role Quyền Năng & Background (/equip, /unequip),
 * và Quản lý/Nâng Cấp Linh Thú (/pet).
 */

import { supabase } from '../config/supabase.js';
import {
  EQUIPMENT_BY_ID,
  PET_BY_TYPE,
  SHOP_EQUIPMENT,
  SHOP_PETS,
  SHOP_ROLE_BY_ID,
  ROLE_BY_ID,
  ROLE_BUFF_CONFIG,
  LEVEL_ROLE_MILESTONES,
  LEVEL_ROLE_BUFF_CONFIG,
  LEVEL_ROLE_DISCORD_PERMS,
  formatRoleBuffDetailedText,
  BACKGROUND_CATALOG,
  BACKGROUND_BY_ID,
  SHOP_CONSUMABLES,
  MARRY_RING_BY_ID,
  AVATAR_FRAME_BY_ID,
  FUYUMI_USER_ID,
  MYTHIC_UNIQUE_ITEM_IDS,
  DOMAIN_BY_ID,
  DIVINE_SENSE_BY_ID,
  DIVINE_REALM_BY_ID,
  ENCHANT_GRADES,
  ENCHANT_UPGRADE_CONFIG,
  normalizeEnchantGrade,
  getEnchantBonusPct,
  getEnchantUpgradeQuote,
  formatRarityLabel,
  normalizeRarityKey,
} from '../data/catalog.js';
import { em, itemEmoji, petEmoji, tierEmoji, roleTierEmoji, elementEmoji, gradeEmoji, ringEmoji, domainEmoji, senseEmoji, realmEmojiById, farmEmoji, uiEm } from '../config/emojiHelper.js';
import { invalidateUniqueItemCard } from './staticAssetCacheService.js';
import { getEffectiveLuckAndFortune } from './luckAndFortuneService.js';
import { getUserBusyExplorationAssets } from './explorerService.js';
import { dismantleDomainEntity } from './domainService.js';
import { trackQuestActivity } from './questService.js';
import { computeRoleBuffTotalsFromList } from './profileService.js';

const RARITY_RANK = { supreme: 5, mythic: 4, epic: 3, rare: 2, common: 1 };

const CONSUMABLE_EMOJI_ALIASES = {
  su_ticket_equip: 'gacha_ticket_equip',
  su_ticket_pet: 'gacha_ticket_pet',
  su_star_stone: 'pet_star_stone',
  su_tower_reset_card: 'tower_reset_card',
  su_enchant_stone: 'enchant_stone',
  su_title_card: 'title_rename_card',
  su_frame_token: 'frame_unlock_token',
  su_fox_mascot: 'cuu_vi_hong_ho',
  su_ring_pham: 'ring_common',
  su_ring_linh: 'ring_rare',
  su_ring_tien: 'ring_epic',
  su_ring_thanthoai: 'ring_mythic',
};

/**
 * Chuẩn hóa truy vấn hỗ trợ Emoji Discord (`<a?:su_...:id>`, `:su_...:`, `su_pet_...`, `su_...`)
 * thành mã UID chuẩn (VD: `weapon_epic_4`, `bach_kim_ho_tu`, `enchant_stone`, `cuu_vi_hong_ho`).
 */
export function normalizeEmojiAwareQuery(raw) {
  let s = String(raw || '').trim();
  if (!s) return '';

  const fullEmojiMatch = s.match(/^<a?:([a-zA-Z0-9_]+):\d+>$/);
  if (fullEmojiMatch) {
    s = fullEmojiMatch[1];
  } else {
    const colonMatch = s.match(/^:([a-zA-Z0-9_]+):$/);
    if (colonMatch) s = colonMatch[1];
  }

  const lower = s.toLowerCase();
  if (CONSUMABLE_EMOJI_ALIASES[lower]) {
    return CONSUMABLE_EMOJI_ALIASES[lower];
  }
  if (lower.startsWith('su_pet_')) {
    return lower.slice('su_pet_'.length);
  }
  if (lower.startsWith('su_')) {
    const stripped = lower.slice('su_'.length);
    if (
      EQUIPMENT_BY_ID[stripped]
      || PET_BY_TYPE[stripped]
      || MARRY_RING_BY_ID[stripped]
      || DOMAIN_BY_ID[stripped]
      || DIVINE_SENSE_BY_ID[stripped]
      || DIVINE_REALM_BY_ID[stripped]
    ) {
      return stripped;
    }
    const matchedCons = SHOP_CONSUMABLES.find((c) => c.item_id === stripped);
    if (matchedCons) return matchedCons.item_id;
  }
  return s;
}

export const GACHA_DISMANTLE_VALUES = {
  item: { common: 3, rare: 8, epic: 22, mythic: 55 },
  pet: { common: 5, rare: 12, epic: 30, mythic: 75 },
  role: {
    permanent: { common: 10, rare: 22, epic: 55, mythic: 140 },
    timed_60d: { common: 6, rare: 15, epic: 38, mythic: 94 },
    timed_30d: { common: 5, rare: 12, epic: 30, mythic: 75 },
    timed_7d: { common: 3, rare: 7, epic: 18, mythic: 45 },
  },
};

export function getGachaDismantleValue(category, rarityKey = 'common', opts = {}) {
  const rk = ['common', 'rare', 'epic', 'mythic'].includes(String(rarityKey).toLowerCase())
    ? String(rarityKey).toLowerCase()
    : 'common';
  if (category === 'item') return GACHA_DISMANTLE_VALUES.item[rk];
  if (category === 'pet') return GACHA_DISMANTLE_VALUES.pet[rk];
  if (category === 'role') {
    if (opts.isPermanent) return GACHA_DISMANTLE_VALUES.role.permanent[rk];
    const remDays = Math.max(1, Number(opts.remDays) || 7);
    if (remDays <= 7) {
      return Math.max(2, Math.round(GACHA_DISMANTLE_VALUES.role.timed_7d[rk] * (remDays / 7)));
    }
    if (remDays <= 30) {
      return Math.max(2, Math.round(GACHA_DISMANTLE_VALUES.role.timed_30d[rk] * Math.max(0.4, remDays / 30)));
    }
    // 60d-90d: tối đa cap 1.25x mức 30d
    return Math.min(
      GACHA_DISMANTLE_VALUES.role.timed_60d[rk],
      Math.max(2, Math.round(GACHA_DISMANTLE_VALUES.role.timed_30d[rk] * Math.min(1.25, remDays / 30))),
    );
  }
  return 3;
}

export function getDismantleQuote(category, row, meta = {}, now = new Date()) {
  const rarityKey = meta.rarity_key || 'common';
  const paidPrice = Number(row?.paid_price || 0);
  const isShop = String(row?.source || '').toLowerCase() === 'shop' && paidPrice > 0;

  let remDays = 0;
  if (category === 'role' && !row?.is_permanent) {
    const remMs = row?.expires_at ? Math.max(0, new Date(row.expires_at).getTime() - now.getTime()) : 0;
    remDays = Math.max(1, Math.ceil(remMs / 86400000));
  }

  if (isShop) {
    let baseVal = paidPrice;
    if (category === 'role' && !row?.is_permanent) {
      const denomDays = remDays <= 7 ? 7 : 30;
      baseVal = Math.min(paidPrice, Math.max(2, Math.round(paidPrice * Math.min(1, remDays / denomDays))));
    }
    const shopRate = category === 'item' ? 0.20 : 0.25;
    const refund = Math.max(1, Math.floor(baseVal * shopRate));
    return { source: 'shop', baseValue: baseVal, refund, refundPct: Math.round(shopRate * 100), isShop: true };
  }

  const gachaRefund = getGachaDismantleValue(category, rarityKey, {
    isPermanent: Boolean(row?.is_permanent),
    remDays,
  });
  return { source: row?.source || 'gacha', baseValue: gachaRefund, refund: gachaRefund, refundPct: 0, isShop: false };
}

function sortPetList(pets, sort = 'power_desc') {
  const s = String(sort || 'power_desc').toLowerCase();
  const arr = [...pets];
  const rVal = (p) => RARITY_RANK[PET_BY_TYPE[p.pet_type]?.rarity_key || 'common'] || 1;
  arr.sort((a, b) => {
    if (s === 'rarity_desc') {
      return (rVal(b) - rVal(a)) || ((Number(b.power_score) || 0) - (Number(a.power_score) || 0));
    }
    if (s === 'rarity_asc') {
      return (rVal(a) - rVal(b)) || ((Number(b.power_score) || 0) - (Number(a.power_score) || 0));
    }
    if (s === 'level_desc') {
      return ((Number(b.level) || 1) - (Number(a.level) || 1)) || ((Number(b.power_score) || 0) - (Number(a.power_score) || 0));
    }
    if (s === 'star_desc') {
      return ((Number(b.star) || 1) - (Number(a.star) || 1)) || ((Number(b.power_score) || 0) - (Number(a.power_score) || 0));
    }
    if (s === 'element_asc') {
      return (String(a.element || 'Thổ').localeCompare(String(b.element || 'Thổ'), 'vi'))
        || (rVal(b) - rVal(a))
        || ((Number(b.power_score) || 0) - (Number(a.power_score) || 0));
    }
    return ((b.is_active ? 1 : 0) - (a.is_active ? 1 : 0)) || ((Number(b.power_score) || 0) - (Number(a.power_score) || 0));
  });
  return arr;
}
import {
  sanitizeUserId,
  ensureUserInitialized,
  pickCleanDisplayValue,
  getMaxRoleSlotsByLevel,
} from './profileService.js';

const SUPERSCRIPT_DIGITS = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];

const INVENTORY_RAM_TTL_MS = 15000;
const INVENTORY_RAM_MAX = 500;
const inventoryRamCache = new Map();

export function invalidateInventoryCache(userId) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return;
  inventoryRamCache.delete(cleanId);
}

function getCachedInventory(userId) {
  const entry = inventoryRamCache.get(userId);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    inventoryRamCache.delete(userId);
    return null;
  }
  return entry.payload;
}

function setCachedInventory(userId, payload) {
  if (!userId || !payload) return;
  if (inventoryRamCache.has(userId)) inventoryRamCache.delete(userId);
  inventoryRamCache.set(userId, { payload, expiresAt: Date.now() + INVENTORY_RAM_TTL_MS });
  while (inventoryRamCache.size > INVENTORY_RAM_MAX) {
    const oldest = inventoryRamCache.keys().next().value;
    if (!oldest) break;
    inventoryRamCache.delete(oldest);
  }
}

export function toSuperscriptCount(n, minDigits = 3) {
  const val = Math.max(1, Math.floor(Number(n) || 1));
  const str = String(val).padStart(minDigits, '0');
  return [...str].map((ch) => SUPERSCRIPT_DIGITS[Number(ch)] || ch).join('');
}

function chunkEmojiGrid(tokens = [], perRow = 5, emptyText = '• Trống', maxChars = 1500, sep = '\u2003 ') {
  if (!tokens.length) return emptyText;
  const rows = [];
  for (let i = 0; i < tokens.length; i += perRow) {
    rows.push(tokens.slice(i, i + perRow).join(sep));
  }
  const joined = [];
  let len = 0;
  let shownItems = 0;
  for (let r = 0; r < rows.length; r += 1) {
    const line = rows[r];
    if (len + line.length + 1 > maxChars && joined.length > 0) {
      const rem = tokens.length - shownItems;
      if (rem > 0) joined.push(`*... (+${rem} mục nữa)*`);
      break;
    }
    joined.push(line);
    len += line.length + 1;
    shownItems += Math.min(perRow, tokens.length - r * perRow);
  }
  return joined.join('\n');
}

function buildDividerEmojiGrid(equippedTokens = [], storageTokens = [], perRow = 5, emptyText = '• Trống', maxChars = 1400) {
  if (!equippedTokens.length && !storageTokens.length) return emptyText;
  if (!equippedTokens.length) return chunkEmojiGrid(storageTokens, perRow, emptyText, maxChars);
  if (!storageTokens.length) return chunkEmojiGrid(equippedTokens, perRow, emptyText, maxChars);

  const firstStorageSlots = Math.max(1, perRow - equippedTokens.length);
  const firstStorageChunk = storageTokens.slice(0, firstStorageSlots);
  const remainingStorage = storageTokens.slice(firstStorageSlots);

  const firstLine = `${equippedTokens.join('\u2003 ')}\u2003 **|**\u2003 ${firstStorageChunk.join('\u2003 ')}`;
  if (!remainingStorage.length) return firstLine;
  const restGrid = chunkEmojiGrid(remainingStorage, perRow, '', Math.max(200, maxChars - firstLine.length - 2));
  return `${firstLine}\n${restGrid}`;
}

function formatRoleDurationLabel(r, now) {
  if (r.is_permanent) return 'Vĩnh Viễn';
  if (!r.expires_at) return '7d';
  const remMs = new Date(r.expires_at).getTime() - now.getTime();
  const remDays = Math.max(1, Math.ceil(remMs / 86400000));
  return `${remDays} ngày`;
}

/**
 * Chia danh sách item thành từng trang thỏa mãn ĐỒNG THỜI `pageSize` và `maxChars`
 * để không bao giờ bị cắt mất item nào do giới hạn 4.096 ký tự của Discord Embed.
 */
export function paginateFormattedLines(items = [], formatFn, { page = 1, pageSize = 15, maxChars = 3350 } = {}) {
  const list = Array.isArray(items) ? items : [];
  if (list.length === 0) {
    return {
      page: 1,
      totalPages: 1,
      pageItems: [],
      lines: [],
      startIndex: 0,
      endIndex: 0,
    };
  }
  const safeSize = Math.max(1, Number(pageSize) || 15);
  const safeMaxChars = Math.max(200, Number(maxChars) || 3350);
  const pages = [];
  let curItems = [];
  let curLines = [];
  let curChars = 0;

  for (let i = 0; i < list.length; i += 1) {
    const item = list[i];
    const line = String(formatFn(item, i) || '');
    const addLen = curLines.length > 0 ? line.length + 1 : line.length;
    if (curItems.length > 0 && (curItems.length >= safeSize || curChars + addLen > safeMaxChars)) {
      pages.push({ items: curItems, lines: curLines });
      curItems = [];
      curLines = [];
      curChars = 0;
    }
    curItems.push(item);
    curLines.push(line);
    curChars += (curLines.length > 1 ? line.length + 1 : line.length);
  }
  if (curItems.length > 0) {
    pages.push({ items: curItems, lines: curLines });
  }

  const totalPages = Math.max(1, pages.length);
  const parsedPage = Number.parseInt(String(page || '1'), 10);
  const safePage = Number.isFinite(parsedPage) ? Math.min(totalPages, Math.max(1, parsedPage)) : 1;
  const bucket = pages[safePage - 1] || { items: [], lines: [] };
  let startIndex = 0;
  for (let p = 0; p < safePage - 1; p += 1) {
    startIndex += pages[p].items.length;
  }

  return {
    page: safePage,
    totalPages,
    pageItems: bucket.items,
    lines: bucket.lines,
    startIndex,
    endIndex: startIndex + bucket.items.length,
  };
}

function buildRoleListText(roles, now, { maxChars = 3750, maxItems = null, overflowHint = 'gõ `/roles` để xem tất cả' } = {}) {
  if (!roles.length) return '• Chưa có Role Quyền Năng nào.';
  const lines = [];
  let charCount = 0;
  let omitted = 0;
  for (let i = 0; i < roles.length; i += 1) {
    if (maxItems && i >= maxItems) {
      omitted = roles.length - i;
      break;
    }
    const r = roles[i];
    const durTag = formatRoleDurationLabel(r, now);
    const slotTag = r.is_equipped ? ` **[Slot #${r.equipped_slot}]**` : '';
    const line = `• ${r.icon} **${r.role_name}** (\`${r.role_id}\`) • ${durTag}${slotTag}`;
    if (charCount + line.length + 1 > maxChars) {
      omitted = roles.length - i;
      break;
    }
    lines.push(line);
    charCount += line.length + 1;
  }
  if (omitted > 0) {
    lines.push(`• *... và ${omitted} Role nữa (${overflowHint})*`);
  }
  return lines.join('\n');
}

export async function getInventory(userId, options = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) {
    return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID người dùng không hợp lệ.' };
  }
  if (!supabase) {
    return { success: false, status: 503, error: 'DB_UNAVAILABLE', message: 'Supabase chưa sẵn sàng.' };
  }

  const includeRaw = Boolean(options.includeRaw);
  const bannerText = String(options.bannerText || '').trim();
  if (!includeRaw && !bannerText) {
    const cached = getCachedInventory(cleanId);
    if (cached) return cached;
  }

  const [userRes, petsRes, itemsRes, invRes, domainsRes, luckInfo] = await Promise.all([
    supabase.from('users').select('user_id, username, level, linh_thach, farm_essence, active_loadout_slot').eq('user_id', cleanId).maybeSingle(),
    supabase.from('user_pets').select('pet_id, pet_type, pet_name, pet_rarity, element, level, star, power_score, enchant_grade, is_active, status, quantity').eq('user_id', cleanId).order('is_active', { ascending: false }).order('power_score', { ascending: false }),
    supabase.from('v_user_equipped_items').select('item_id, item_type, enchant_grade, equipped_to_pet, slot, quantity').eq('user_id', cleanId),
    supabase.from('user_inventory').select('item_id, item_category, quantity').eq('user_id', cleanId).gt('quantity', 0),
    supabase.from('user_domains').select('entity_kind, entity_id, is_equipped').eq('user_id', cleanId).eq('is_equipped', true),
    getEffectiveLuckAndFortune(cleanId).catch(() => null),
  ]);

  let user = userRes?.data || null;
  if (!user) {
    const initRes = await ensureUserInitialized(cleanId, {
      username: pickCleanDisplayValue(options.username, options.fallbackUsername),
      avatarUrl: pickCleanDisplayValue(options.avatarUrl),
    });
    user = initRes?.user || null;
  }
  if (!user) return { success: false, status: 500, error: 'USER_INIT_FAILED', message: 'Không thể khởi tạo hồ sơ.' };

  const activePotionLine = luckInfo?.potionCharges > 0
    ? `${em(luckInfo.potionId || 'potion_luck_minor')} **Linh Lộ đang hiệu lực:** **${luckInfo.potionName}** (\`+${luckInfo.potionLuckPct}% Luck\` • còn **${luckInfo.potionCharges}** lượt)`
    : '';

  const equippedDomainsRaw = (domainsRes?.data || []).filter((d) => d && d.is_equipped !== false);
  const SHOP_CONS_BY_ID = Object.fromEntries(SHOP_CONSUMABLES.map((c) => [c.item_id, c]));

  const pets = sortPetList((petsRes?.data || []).map((p) => {
    const petMeta = PET_BY_TYPE[p.pet_type] || {};
    const grade = normalizeEnchantGrade(p.enchant_grade || 'D');
    return {
      ...p,
      enchant_grade: grade,
      grade_icon: gradeEmoji(grade),
      icon: petEmoji(p.pet_type, em('cuu_vi_hong_ho')),
      tier_icon: tierEmoji(petMeta.rarity_key || 'common'),
    };
  }), options.petSort || 'power_desc');

  const items = (itemsRes?.data || []).map((row) => {
    const catMeta = EQUIPMENT_BY_ID[row.item_id] || {};
    const grade = normalizeEnchantGrade(row.enchant_grade || 'D');
    return {
      ...row,
      ...catMeta,
      enchant_grade: grade,
      grade_icon: gradeEmoji(grade),
      icon: itemEmoji(row.item_id, em('su_crossed_swords')),
      tier_icon: tierEmoji(catMeta.rarity_key || 'common'),
    };
  });

  const consumables = (invRes?.data || [])
    .filter((inv) => {
      const id = String(inv.item_id || '').trim();
      const cat = String(inv.item_category || '').trim().toLowerCase();
      if (!id) return false;
      if (cat === 'background' || cat === 'frame') return false;
      if (BACKGROUND_BY_ID[id]) return false;
      if (id === 'frame_unlock_token' || id.startsWith('frame_')) return false;
      return true;
    })
    .map((inv) => {
      const cMeta = SHOP_CONS_BY_ID[inv.item_id] || MARRY_RING_BY_ID[inv.item_id];
      const domainMeta = DOMAIN_BY_ID[inv.item_id];
      const senseMeta = DIVINE_SENSE_BY_ID[inv.item_id];
      const realmMeta = DIVINE_REALM_BY_ID[inv.item_id];
      const icon = cMeta?.icon
        || (MARRY_RING_BY_ID[inv.item_id] ? ringEmoji(inv.item_id)
          : inv.item_id === 'farm_essence' ? farmEmoji('farm_essence', em('su_sprout'))
          : domainMeta ? domainEmoji(inv.item_id, em('su_arena'))
          : senseMeta ? senseEmoji(inv.item_id, em('su_sparkle'))
          : realmMeta ? realmEmojiById(inv.item_id, em('su_arena'))
          : em('su_pin_sigil'));
      return {
        ...inv,
        icon,
      };
    });

  const activePets = pets.filter((p) => p.is_active);
  const storagePets = pets.filter((p) => !p.is_active);
  const slotRank = { weapon: 1, gem: 2, soul: 3 };
  const equippedItems = items
    .filter((it) => it.equipped_to_pet || it.slot)
    .sort((a, b) => (slotRank[a.item_type] || 9) - (slotRank[b.item_type] || 9));
  const storageItems = items.filter((it) => !it.equipped_to_pet && !it.slot);

  const petGrid = chunkEmojiGrid(
    storagePets.map((p) => `${p.icon}${toSuperscriptCount(p.quantity || 1)}`),
    3,
    '• Trống',
    900,
    ' ',
  );
  const itemGrid = chunkEmojiGrid(
    storageItems.map((it) => `${it.icon}${toSuperscriptCount(it.quantity || 1)}`),
    3,
    '• Trống',
    900,
    ' ',
  );
  const consumableGrid = chunkEmojiGrid(
    consumables.map((c) => `${c.icon}${toSuperscriptCount(c.quantity || 1)}`),
    3,
    '• Trống',
    900,
    ' ',
  );

  const activeSlot = [1, 2, 3].includes(Number(user.active_loadout_slot)) ? Number(user.active_loadout_slot) : 1;
  const farmEssence = Math.max(0, Number(user.farm_essence || 0));
  const mainPet = activePets[0] || null;

  const equippedDomain = equippedDomainsRaw.find((d) => d.entity_kind === 'domain');
  const equippedSense = equippedDomainsRaw.find((d) => d.entity_kind === 'sense');
  const equippedRealm = equippedDomainsRaw.find((d) => d.entity_kind === 'realm');
  const domIcon = equippedDomain ? domainEmoji(equippedDomain.entity_id, em('su_arena')) : '*Trống*';
  const senseIcon = equippedSense ? senseEmoji(equippedSense.entity_id, em('su_sparkle')) : '*Trống*';
  const realmIcon = equippedRealm ? realmEmojiById(equippedRealm.entity_id, em('su_arena')) : '*Trống*';

  const f1Name = `${em('su_pet_paw')} Linh Thú`;
  const f1Value = mainPet
    ? `${mainPet.icon} ${mainPet.grade_icon} Lv.${mainPet.level} • **${mainPet.star}★**\nLực: \`${(Number(mainPet.power_score) || 0).toLocaleString('vi-VN')}\``
    : '*Chưa xuất trận*';

  const eqBySlot = {
    weapon: equippedItems.find((it) => it.item_type === 'weapon') || null,
    gem: equippedItems.find((it) => it.item_type === 'gem') || null,
    soul: equippedItems.find((it) => it.item_type === 'soul') || null,
  };
  const f2Name = `${em('su_crossed_swords')} Pháp Bảo`;
  const f2Value = [
    `**Vũ Khí:** ${eqBySlot.weapon ? `${eqBySlot.weapon.icon} | ${eqBySlot.weapon.grade_icon}` : '*Trống*'}`,
    `**Bảo Ngọc:** ${eqBySlot.gem ? `${eqBySlot.gem.icon} | ${eqBySlot.gem.grade_icon}` : '*Trống*'}`,
    `**Chiến Hồn:** ${eqBySlot.soul ? `${eqBySlot.soul.icon} | ${eqBySlot.soul.grade_icon}` : '*Trống*'}`,
  ].join('\n');

  const f3Name = `${em('su_realm_star')} Lãnh Địa`;
  const f3Value = [
    `**Linh Vực:** ${domIcon}`,
    `\u00A0\u00A0↳ **Thần Thức:** ${senseIcon}`,
    `\u00A0\u00A0↳ **Thần Cảnh:** ${realmIcon}`,
  ].join('\n');

  const f4Name = `${em('su_pet_paw')} Kho Linh Thú (${storagePets.length})`;
  const f4Value = petGrid.slice(0, 1020) || '• Trống';

  const f5Name = `${em('su_crossed_swords')} Kho Pháp Bảo (${storageItems.length})`;
  const f5Value = itemGrid.slice(0, 1020) || '• Trống';

  const f6Name = `${em('enchant_stone')} Tiêu Hao (${consumables.length})`;
  const f6Value = consumableGrid.slice(0, 1020) || '• Trống';

  const displayName = pickCleanDisplayValue(options.username, options.fallbackUsername, user.username, `TuSi_${cleanId.slice(-4)}`);
  const balFmt = Number(user.linh_thach || 0).toLocaleString('vi-VN');
  const descLines = [
    ...(bannerText ? [`${em('su_sparkle')} ${bannerText}`, ''] : []),
    `${em('su_linhthach')} \`${balFmt}\` • ${farmEmoji('farm_essence')} \`${farmEssence.toLocaleString('vi-VN')}\``,
    ...(activePotionLine ? [activePotionLine] : []),
  ];

  const payload = {
    success: true,
    active_loadout_slot: activeSlot,
    view_title: `${em('su_wiki_scroll')} TÚI ĐỒ TIÊN GIỚI — ${displayName} [Bộ ${activeSlot}]`,
    view_description: descLines.join('\n').slice(0, 3950),
    color: '#a855f7',
    footer: '',
    f1_name: f1Name,
    f1_value: f1Value.slice(0, 1024),
    f2_name: f2Name,
    f2_value: f2Value.slice(0, 1024),
    f3_name: f3Name,
    f3_value: f3Value.slice(0, 1024),
    f4_name: f4Name,
    f4_value: f4Value.slice(0, 1024),
    f5_name: f5Name,
    f5_value: f5Value.slice(0, 1024),
    f6_name: f6Name,
    f6_value: f6Value.slice(0, 1024),
    user: {
      user_id: cleanId,
      username: displayName,
      level: user.level,
      linh_thach: Number(user.linh_thach || 0),
      linh_thach_fmt: balFmt,
      farm_essence: farmEssence,
    },
  };

  if (includeRaw) {
    payload.pets = pets;
    payload.equipment_items = items;
    payload.consumables_and_unlocks = consumables;
  } else if (!bannerText) {
    setCachedInventory(cleanId, payload);
  }

  return payload;
}

/**
 * Kho Pháp Bảo chuyên biệt (/phapbao): Hiển thị đầy đủ không cắt ở dòng 12, hỗ trợ lọc & sắp xếp.
 */
export async function getUserEquipment(userId, options = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID người dùng không hợp lệ.' };
  if (!supabase) return { success: false, status: 503, error: 'DB_UNAVAILABLE', message: 'Supabase chưa sẵn sàng.' };

  const { user } = await ensureUserInitialized(cleanId, {
    username: pickCleanDisplayValue(options.username, options.fallbackUsername),
    avatarUrl: pickCleanDisplayValue(options.avatarUrl),
  });
  if (!user) return { success: false, status: 500, error: 'USER_INIT_FAILED', message: 'Không thể khởi tạo hồ sơ.' };

  const { data: rows, error } = await supabase
    .from('user_pet_items')
    .select('*')
    .eq('user_id', cleanId);
  if (error) throw new Error(`Failed loading equipment: ${error.message}`);

  const sortMode = String(options.sort || 'rarity_desc').toLowerCase();
  const slotFilter = String(options.slot || 'all').toLowerCase();

  let list = (rows || []).map((row) => {
    const meta = EQUIPMENT_BY_ID[row.item_id] || {};
    const grade = normalizeEnchantGrade(row.enchant_grade || 'D');
    return {
      ...row,
      item_name: meta.item_name || row.item_id,
      item_type: meta.item_type || row.slot || 'weapon',
      rarity: meta.rarity || 'Phàm Phẩm',
      rarity_key: meta.rarity_key || 'common',
      element: meta.element || 'Kim',
      enchant_grade: grade,
      enchant_bonus_pct: getEnchantBonusPct(grade),
      grade_icon: gradeEmoji(grade),
      bonus_atk: meta.bonus_atk || 0,
      bonus_def: meta.bonus_def || 0,
      bonus_spd: meta.bonus_spd || 0,
      bonus_hp: meta.bonus_hp || 0,
      is_equipped: Boolean(row.equipped_to_pet || row.slot),
      icon: itemEmoji(row.item_id, em('su_crossed_swords')),
      tier_icon: tierEmoji(meta.rarity_key || 'common'),
    };
  });

  if (['weapon', 'gem', 'soul'].includes(slotFilter)) {
    list = list.filter((it) => it.item_type === slotFilter);
  } else if (slotFilter === 'equipped') {
    list = list.filter((it) => it.is_equipped);
  }

  const itemScore = (it) => (Number(it.bonus_atk || 0) * 3) + (Number(it.bonus_def || 0) * 2) + (Number(it.bonus_spd || 0) * 2) + Math.floor(Number(it.bonus_hp || 0) / 5);
  const slotOrder = { weapon: 1, gem: 2, soul: 3 };
  list.sort((a, b) => {
    const ra = RARITY_RANK[a.rarity_key] || 1;
    const rb = RARITY_RANK[b.rarity_key] || 1;
    if (sortMode === 'rarity_asc') return (ra - rb) || a.item_name.localeCompare(b.item_name);
    if (sortMode === 'power_desc') return (itemScore(b) - itemScore(a)) || (rb - ra) || a.item_name.localeCompare(b.item_name);
    if (sortMode === 'slot') return ((slotOrder[a.item_type] || 9) - (slotOrder[b.item_type] || 9)) || (rb - ra) || a.item_name.localeCompare(b.item_name);
    if (sortMode === 'equipped') return ((b.is_equipped ? 1 : 0) - (a.is_equipped ? 1 : 0)) || (rb - ra);
    return (rb - ra) || ((b.is_equipped ? 1 : 0) - (a.is_equipped ? 1 : 0)) || a.item_name.localeCompare(b.item_name);
  });

  const filterLabelMap = {
    all: 'Tất Cả',
    weapon: 'Chỉ Vũ Khí',
    gem: 'Chỉ Bảo Ngọc',
    soul: 'Chỉ Chiến Hồn',
    equipped: 'Đang Trang Bị',
  };
  const sortLabelMap = {
    rarity_desc: 'Phẩm Cao → Thấp',
    rarity_asc: 'Phẩm Thấp → Cao',
    power_desc: 'Chiến Lực Cao → Thấp',
    slot: 'Theo Ô (Vũ Khí • Ngọc • Hồn)',
    equipped: 'Đang Trang Bị Lên Đầu',
  };

  const paged = paginateFormattedLines(
    list,
    (it) => {
      const slotTag = it.item_type === 'weapon' ? 'Vũ Khí' : it.item_type === 'gem' ? 'Bảo Ngọc' : 'Chiến Hồn';
      const eqTag = it.is_equipped ? ' **(Đang trang bị)**' : '';
      const qtyTag = (Number(it.quantity) || 1) > 1 ? ` ×**${it.quantity}**` : '';
      return `• ${it.icon} ${it.grade_icon} **${it.item_name}**${qtyTag} (\`${it.item_id}\`) • ${it.tier_icon} ${it.rarity} *(${slotTag})*${eqTag}`;
    },
    { page: options.page || 1, pageSize: 20, maxChars: 3350 },
  );

  const prevPage = paged.page > 1 ? paged.page - 1 : paged.totalPages;
  const nextPage = paged.page < paged.totalPages ? paged.page + 1 : 1;

  const summaryLines = [...paged.lines];
  if (paged.totalPages > 1) {
    summaryLines.push(`• *Trang ${paged.page}/${paged.totalPages} — Bấm nút **Trang Trước / Trang Sau** bên dưới hoặc gõ \`/phapbao trang:${nextPage}\` để xem tiếp!*`);
  }
  if (summaryLines.length === 0) {
    summaryLines.push('• Chưa có Pháp Bảo nào khớp bộ lọc. Hãy mua ở `/shop` hoặc quay `/roll loai:equipment`!');
  }

  return {
    success: true,
    user: {
      user_id: cleanId,
      username: user.username,
      level: user.level,
      linh_thach: Number(user.linh_thach || 0),
    },
    total_count: list.length,
    page: paged.page,
    total_pages: paged.totalPages,
    prev_page: prevPage,
    next_page: nextPage,
    page_size: 20,
    sort: sortMode,
    slot: slotFilter,
    items: list,
    filter_summary: `Bộ lọc: **${filterLabelMap[slotFilter] || 'Tất Cả'}** • Sắp xếp: **${sortLabelMap[sortMode] || 'Phẩm Cao → Thấp'}** • Tổng: **${list.length} món** • Trang **${paged.page}/${paged.totalPages}**`,
    summary_equipment: summaryLines.join('\n'),
  };
}

/**
 * Kho Linh Thú chuyên biệt (/linhthu hanh_dong:list & /api/pet/:userId).
 * Giữ nguyên định dạng chi tiết từng Linh Thú, hỗ trợ sắp xếp & phân trang độc lập khỏi /inv 2x3.
 */
export async function getUserPets(userId, options = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID người dùng không hợp lệ.' };
  if (!supabase) return { success: false, status: 503, error: 'DB_UNAVAILABLE', message: 'Supabase chưa sẵn sàng.' };

  const { user } = await ensureUserInitialized(cleanId, {
    username: pickCleanDisplayValue(options.username, options.fallbackUsername),
    avatarUrl: pickCleanDisplayValue(options.avatarUrl),
  });
  if (!user) return { success: false, status: 500, error: 'USER_INIT_FAILED', message: 'Không thể khởi tạo hồ sơ.' };

  const { data: petRows, error } = await supabase
    .from('user_pets')
    .select('pet_id, pet_type, pet_name, pet_rarity, element, level, star, power_score, enchant_grade, is_active, status, quantity')
    .eq('user_id', cleanId)
    .order('is_active', { ascending: false })
    .order('power_score', { ascending: false });
  if (error) throw new Error(`Failed loading user pets: ${error.message}`);

  const sortMode = String(options.sort || 'power_desc').trim().toLowerCase() || 'power_desc';
  const mappedPets = sortPetList((petRows || []).map((p) => {
    const petMeta = PET_BY_TYPE[p.pet_type] || {};
    const grade = normalizeEnchantGrade(p.enchant_grade || 'D');
    const elemName = p.element || petMeta.element || 'Thổ';
    const rarityLabel = formatRarityLabel(p.pet_rarity || petMeta.rarity || 'Phàm Phẩm');
    return {
      ...p,
      pet_name: p.pet_name || petMeta.name || p.pet_type,
      element: elemName,
      element_icon: elementEmoji(elemName),
      rarity_label: rarityLabel,
      enchant_grade: grade,
      grade_icon: gradeEmoji(grade),
      icon: petEmoji(p.pet_type, em('cuu_vi_hong_ho')),
      tier_icon: tierEmoji(petMeta.rarity_key || 'common'),
    };
  }), sortMode);

  const formatPetDetailLine = (p) => {
    const qtyTag = (Number(p.quantity) || 1) > 1 ? ` ×**${p.quantity}**` : '';
    const statusTag = p.status === 'exploring'
      ? ` *[${uiEm('ui_compass_dir')} Đang Khám Phá]*`
      : p.status === 'injured'
        ? ` *[${uiEm('ui_heal_band')} Trọng Thương]*`
        : '';
    return `• ${p.icon} ${p.grade_icon} **${p.pet_name}**${qtyTag} (\`${p.pet_type}\`) • ${p.tier_icon} ${p.rarity_label} • ${p.element_icon} ${p.element} — Lv.${p.level} • **${p.star}★** • Lực ${(Number(p.power_score) || 0).toLocaleString('vi-VN')}${p.is_active ? ' *(Đang xuất trận)*' : ''}${statusTag}`;
  };

  const petsPaged = paginateFormattedLines(mappedPets, formatPetDetailLine, {
    page: options.page || 1,
    pageSize: 15,
    maxChars: 3350,
  });
  const prevPage = petsPaged.page > 1 ? petsPaged.page - 1 : petsPaged.totalPages;
  const nextPage = petsPaged.page < petsPaged.totalPages ? petsPaged.page + 1 : 1;

  const summaryPetsDetailed = mappedPets.length > 0
    ? [
        ...petsPaged.lines,
        ...(petsPaged.totalPages > 1 ? [`• *Trang ${petsPaged.page}/${petsPaged.totalPages} — Đổi bộ lọc sắp xếp bên dưới để xem thêm!*`] : []),
      ].join('\n')
    : '• Chưa có Linh Thú nào.';

  const summaryPetsCompact = mappedPets.length > 0
    ? `${chunkEmojiGrid(mappedPets.map((p) => `${p.icon}${toSuperscriptCount(p.quantity || 1)}`), 5, '• Trống', 900, ' ')}`
    : '• Chưa có Linh Thú nào.';

  const displayName = pickCleanDisplayValue(options.username, options.fallbackUsername, user.username, `TuSi_${cleanId.slice(-4)}`);
  const bal = Number(user.linh_thach || 0);

  return {
    success: true,
    sort: sortMode,
    page: petsPaged.page,
    total_pages: petsPaged.totalPages,
    prev_page: prevPage,
    next_page: nextPage,
    total_count: mappedPets.length,
    user: {
      user_id: cleanId,
      username: displayName,
      level: user.level,
      linh_thach: bal,
      linh_thach_fmt: bal.toLocaleString('vi-VN'),
      farm_essence: Math.max(0, Number(user.farm_essence || 0)),
    },
    pets: mappedPets,
    summary_pets: summaryPetsDetailed,
    summary_pets_detailed: summaryPetsDetailed,
    summary_pets_compact: summaryPetsCompact,
  };
}

/**
 * Kho Role Quyền Năng chuyên biệt (/roles): Hiển thị đầy đủ danh sách Role, slot, thời hạn còn lại & filter/sort.
 */
export async function getUserRoles(userId, options = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID người dùng không hợp lệ.' };
  if (!supabase) return { success: false, status: 503, error: 'DB_UNAVAILABLE', message: 'Supabase chưa sẵn sàng.' };

  const { user } = await ensureUserInitialized(cleanId, {
    username: pickCleanDisplayValue(options.username, options.fallbackUsername),
    avatarUrl: pickCleanDisplayValue(options.avatarUrl),
  });
  if (!user) return { success: false, status: 500, error: 'USER_INIT_FAILED', message: 'Không thể khởi tạo hồ sơ.' };

  const { data: rawRoles, error } = await supabase
    .from('user_roles')
    .select('*')
    .eq('user_id', cleanId);
  if (error) throw new Error(`Failed loading user roles: ${error.message}`);

  const now = new Date();
  const expiredEquippedIds = (rawRoles || [])
    .filter((r) => !r.is_permanent && r.expires_at && new Date(r.expires_at) <= now && r.is_equipped)
    .map((r) => r.id);
  if (expiredEquippedIds.length > 0) {
    await supabase.from('user_roles').update({ is_equipped: false, equipped_slot: null }).in('id', expiredEquippedIds);
  }

  let roles = (rawRoles || [])
    .filter((r) => r.is_permanent || !r.expires_at || new Date(r.expires_at) > now)
    .map((r) => {
      const roleMeta = ROLE_BY_ID[r.role_id];
      const lvlMilestone = !roleMeta ? LEVEL_ROLE_MILESTONES.find((m) => m.roleId === r.role_id) : null;
      const lvlCfg = lvlMilestone ? LEVEL_ROLE_BUFF_CONFIG.find((c) => c.level === lvlMilestone.level) : null;
      let rarityKey = roleMeta?.rarity_key || 'common';
      let rarity = roleMeta?.rarity || 'Phàm Phẩm';
      let discordPerms = roleMeta?.discord_perms || null;
      let detailedBuff = roleMeta ? (ROLE_BUFF_CONFIG[r.role_id] ? formatRoleBuffDetailedText(r.role_id) : null) : null;

      if (lvlMilestone) {
        const lvl = lvlMilestone.level;
        rarityKey = lvl >= 100 ? 'mythic' : lvl >= 60 ? 'epic' : lvl >= 20 ? 'rare' : 'common';
        rarity = `Cảnh Giới (Lv.${lvl})`;
        discordPerms = LEVEL_ROLE_DISCORD_PERMS[lvl] || null;
        if (lvlCfg) {
          const bParts = [];
          if (lvlCfg.expPct) bParts.push(`+${lvlCfg.expPct}% EXP (Chat, Voice & /job)`);
          if (lvlCfg.dailyLtPct) bParts.push(`+${lvlCfg.dailyLtPct}% Daily LT (+${lvlCfg.dailyLtPct}% /daily & +${Math.round(lvlCfg.dailyLtPct * 0.25)}% /job)`);
          if (lvlCfg.petPowerPct) bParts.push(`+${lvlCfg.petPowerPct}% Chiến Lực Pet (ATK/DEF/SPD)`);
          detailedBuff = bParts.length ? bParts.join(' • ') : null;
        }
      }

      const hasDiscordPerms = Boolean(discordPerms && !discordPerms.startsWith('Không cấp quyền'));
      const remMs = r.is_permanent ? Infinity : (r.expires_at ? Math.max(0, new Date(r.expires_at).getTime() - now.getTime()) : 0);
      return {
        ...r,
        role_name: roleMeta?.name || lvlMilestone?.name || r.role_name,
        rarity_key: rarityKey,
        rarity,
        perk: roleMeta?.perk || r.role_perk || '',
        discord_perms: hasDiscordPerms ? discordPerms : null,
        detailed_buff: detailedBuff,
        icon: roleTierEmoji(rarityKey),
        duration_label: formatRoleDurationLabel(r, now),
        remaining_ms: remMs,
      };
    });

  const equippedRoleIds = roles.filter((r) => r.is_equipped).map((r) => r.role_id);
  const activeBuffs = computeRoleBuffTotalsFromList(equippedRoleIds, user.level || 1);

  const filterMode = String(options.filter || 'all').trim().toLowerCase();
  const sortMode = String(options.sort || 'equipped_desc').trim().toLowerCase();

  if (filterMode === 'equipped') roles = roles.filter((r) => r.is_equipped);
  else if (filterMode === 'unequipped') roles = roles.filter((r) => !r.is_equipped);
  else if (filterMode === 'permanent') roles = roles.filter((r) => r.is_permanent);
  else if (filterMode === 'timed') roles = roles.filter((r) => !r.is_permanent);

  roles.sort((a, b) => {
    const ra = RARITY_RANK[a.rarity_key] || 1;
    const rb = RARITY_RANK[b.rarity_key] || 1;
    if (sortMode === 'rarity_desc') {
      return (rb - ra) || ((b.is_equipped ? 1 : 0) - (a.is_equipped ? 1 : 0)) || String(a.role_name).localeCompare(String(b.role_name));
    }
    if (sortMode === 'expiry_asc') {
      return (a.remaining_ms - b.remaining_ms) || (rb - ra);
    }
    return ((b.is_equipped ? 1 : 0) - (a.is_equipped ? 1 : 0)) || ((Number(a.equipped_slot) || 99) - (Number(b.equipped_slot) || 99)) || (rb - ra);
  });

  const maxSlots = getMaxRoleSlotsByLevel(user.level || 1);
  const equippedCount = roles.filter((r) => r.is_equipped).length;
  const paged = paginateFormattedLines(
    roles,
    (r) => {
      const slotTag = r.is_equipped ? ` • **Slot #${r.equipped_slot}/${maxSlots}**` : '';
      const head = `• ${r.icon} **${r.role_name}** \`${r.role_id}\`${slotTag}`;
      const sub = [];
      if (r.discord_perms && r.detailed_buff) {
        sub.push(`-# ↳ ${r.rarity} • ${r.duration_label}`);
        sub.push(`-# ↳ Quyền: ${r.discord_perms}`);
        sub.push(`-# ↳ Buff: ${r.detailed_buff}`);
      } else if (r.discord_perms) {
        sub.push(`-# ↳ ${r.rarity} • ${r.duration_label} • Quyền: ${r.discord_perms}`);
      } else if (r.detailed_buff) {
        sub.push(`-# ↳ ${r.rarity} • ${r.duration_label} • Buff: ${r.detailed_buff}`);
      } else {
        sub.push(`-# ↳ ${r.rarity} • ${r.duration_label}${r.perk ? ` • ${r.perk}` : ''}`);
      }
      return [head, ...sub].join('\n');
    },
    { page: options.page || 1, pageSize: 7, maxChars: 3350 },
  );

  const prevPage = paged.page > 1 ? paged.page - 1 : paged.totalPages;
  const nextPage = paged.page < paged.totalPages ? paged.page + 1 : 1;

  const lines = [...paged.lines];
  if (paged.totalPages > 1) {
    lines.push(`-# *Trang ${paged.page}/${paged.totalPages} — Bấm nút **Trang Trước / Trang Sau** bên dưới hoặc gõ \`/roles trang:${nextPage}\` để xem tiếp!*`);
  }
  if (!lines.length) lines.push('• Chưa có Role Quyền Năng nào khớp bộ lọc. Mua tại `/shop` hoặc quay `/roll loai:role`!');

  const activeBuffParts = [];
  if (activeBuffs.expBonusPct) activeBuffParts.push(`+${activeBuffs.expBonusPct}% EXP (Chat/Voice/Job)`);
  if (activeBuffs.dailyLtBonusPct) activeBuffParts.push(`+${activeBuffs.dailyLtBonusPct}% Daily LT (+${Math.round(activeBuffs.dailyLtBonusPct * 0.25)}% /job)`);
  if (activeBuffs.petPowerBonusPct) activeBuffParts.push(`+${activeBuffs.petPowerBonusPct}% Chiến Lực Pet`);
  if (activeBuffs.shopDiscountPct) activeBuffParts.push(`-${activeBuffs.shopDiscountPct}% Shop`);
  if (activeBuffs.gachaDiscountPct) activeBuffParts.push(`-${activeBuffs.gachaDiscountPct}% /roll`);
  const activeBuffSummary = activeBuffParts.length ? activeBuffParts.join(' • ') : 'Chưa kích hoạt buff số';

  return {
    success: true,
    user: {
      user_id: cleanId,
      username: user.username,
      level: user.level,
      max_role_slots: maxSlots,
    },
    filter: filterMode,
    sort: sortMode,
    page: paged.page,
    total_pages: paged.totalPages,
    prev_page: prevPage,
    next_page: nextPage,
    page_size: 7,
    total_count: roles.length,
    equipped_count: equippedCount,
    max_role_slots: maxSlots,
    active_buffs: activeBuffs,
    roles,
    filter_summary: `Slot đang đeo: **${equippedCount}/${maxSlots}** • Bộ lọc: **${filterMode}** • Tổng: **${roles.length} Role** • Trang **${paged.page}/${paged.totalPages}**\n-# ↳ Tổng Buff Role (gồm Cảnh Giới): ${activeBuffSummary}`,
    summary: lines.join('\n'),
  };
}

function findBackgroundMatch(rawQuery) {
  const q = String(rawQuery || '').trim();
  if (!q) return null;
  if (BACKGROUND_BY_ID[q]) return BACKGROUND_BY_ID[q];
  const normQ = normalizeTargetText(q);
  const stripPathExt = (s) => String(s || '').replace(/^backgrounds\//i, '').replace(/\.[a-z0-9]+$/i, '').toLowerCase();
  const normStrip = stripPathExt(q).toLowerCase();
  return BACKGROUND_CATALOG.find((b) =>
    b.bg_id.toLowerCase() === normQ
    || b.file.toLowerCase() === normQ
    || stripPathExt(b.bg_id) === normStrip
    || stripPathExt(b.file) === normStrip
    || normalizeTargetText(b.name) === normQ) || null;
}

function findFrameKeyMatch(rawQuery) {
  const normQ = normalizeTargetText(rawQuery);
  if (!normQ) return null;
  const candidate = normQ.replace(/^frame_/, '');
  if (candidate === 'celestial_fox_gold') return 'celestial_fox_gold';
  if (AVATAR_FRAME_BY_ID[candidate]) return candidate;
  const byName = Object.entries(AVATAR_FRAME_BY_ID).find(([, meta]) => normalizeTargetText(meta.name) === normQ);
  return byName ? byName[0] : null;
}

function findDomainEntityMatch(rawQuery) {
  const q = String(rawQuery || '').trim();
  if (!q) return null;
  if (DOMAIN_BY_ID[q]) return DOMAIN_BY_ID[q];
  if (DIVINE_SENSE_BY_ID[q]) return DIVINE_SENSE_BY_ID[q];
  if (DIVINE_REALM_BY_ID[q]) return DIVINE_REALM_BY_ID[q];
  const normQ = normalizeTargetText(q);
  const all = [
    ...Object.values(DOMAIN_BY_ID),
    ...Object.values(DIVINE_SENSE_BY_ID),
    ...Object.values(DIVINE_REALM_BY_ID),
  ];
  return all.find((x) => x.id.toLowerCase() === normQ || normalizeTargetText(x.name) === normQ) || null;
}

function findCatalogRoleId(rawQuery) {
  const cleaned = String(rawQuery || '').trim().replace(/^<@&(\d+)>$/, '$1');
  if (!cleaned) return null;
  if (/^[0-9]{15,22}$/.test(cleaned)) return cleaned;
  const normQ = normalizeTargetText(cleaned);
  const pools = [...Object.values(ROLE_BY_ID), ...Object.values(SHOP_ROLE_BY_ID)];
  const matched = pools.find((r) => r.role_id === cleaned || normalizeTargetText(r.name) === normQ);
  return matched ? matched.role_id : null;
}

export async function equipTarget(userId, payload = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID người dùng không hợp lệ.' };
  if (!supabase) return { success: false, status: 503, error: 'DB_UNAVAILABLE', message: 'Supabase chưa sẵn sàng.' };

  const rawCategory = String(payload.category || '').trim().toLowerCase();
  let category = rawCategory === 'auto' ? '' : rawCategory;
  const rawTargetId = String(payload.targetId || '').trim();
  if (!rawTargetId) {
    return {
      success: false,
      status: 400,
      error: 'MISSING_TARGET_ID',
      message: 'Vui lòng nhập **UID**, **Emoji**, **Role ID** hoặc **Tên** món muốn trang bị!',
    };
  }

  const emojiNormalized = normalizeEmojiAwareQuery(rawTargetId);
  const normEmoji = normalizeTargetText(emojiNormalized);
  let targetId = (!category || category === 'role' || category === 'title') ? rawTargetId : emojiNormalized;

  const { user } = await ensureUserInitialized(cleanId);
  if (!user) return { success: false, status: 500, error: 'USER_INIT_FAILED', message: 'Không thể khởi tạo hồ sơ.' };

  if (category === 'consumable') {
    const { LUCK_POTION_BY_ID } = await import('../data/v16ExpansionCatalog.js');
    const matchedPotion = LUCK_POTION_BY_ID[emojiNormalized]
      || Object.values(LUCK_POTION_BY_ID).find(
        (p) => p.item_id.toLowerCase() === normEmoji || normalizeTargetText(p.name) === normEmoji,
      );
    if (matchedPotion) {
      const { activateLuckPotion } = await import('./luckAndFortuneService.js');
      const potRes = await activateLuckPotion(cleanId, matchedPotion.item_id);
      return { ...potRes, category: 'consumable' };
    }
  }

  if (!category) {
    const { LUCK_POTION_BY_ID } = await import('../data/v16ExpansionCatalog.js');
    const matchedPotion = LUCK_POTION_BY_ID[emojiNormalized]
      || Object.values(LUCK_POTION_BY_ID).find(
        (p) => p.item_id.toLowerCase() === normEmoji || normalizeTargetText(p.name) === normEmoji,
      );
    if (matchedPotion) {
      const { activateLuckPotion } = await import('./luckAndFortuneService.js');
      const potRes = await activateLuckPotion(cleanId, matchedPotion.item_id);
      return { ...potRes, category: 'consumable' };
    }
    const titleMatch = rawTargetId.match(/^title\s*:\s*(.+)$/i);
    if (titleMatch) {
      category = 'title';
      targetId = titleMatch[1].trim();
    } else if (EQUIPMENT_BY_ID[emojiNormalized]) {
      category = 'item';
      targetId = emojiNormalized;
    } else {
      const matchedItem = Object.values(EQUIPMENT_BY_ID).find(
        (x) => x.item_id.toLowerCase() === normEmoji || normalizeTargetText(x.item_name) === normEmoji,
      );
      if (matchedItem) {
        category = 'item';
        targetId = matchedItem.item_id;
      } else {
        const matchedDom = findDomainEntityMatch(emojiNormalized);
        if (matchedDom) {
          const { equipDomainEntity } = await import('./domainService.js');
          const domRes = await equipDomainEntity(cleanId, matchedDom.id);
          return { ...domRes, category: 'domain' };
        }
        const matchedPet = PET_BY_TYPE[emojiNormalized] || Object.values(PET_BY_TYPE).find(
          (p) => p.pet_type.toLowerCase() === normEmoji || normalizeTargetText(p.pet_name) === normEmoji,
        );
        if (matchedPet) {
          const petRes = await setActivePet(cleanId, matchedPet.pet_type);
          return { ...petRes, category: 'pet' };
        }
        const matchedBg = findBackgroundMatch(emojiNormalized) || findBackgroundMatch(rawTargetId);
        if (matchedBg) {
          category = 'background';
          targetId = matchedBg.bg_id;
        } else {
          const matchedFrame = findFrameKeyMatch(emojiNormalized) || findFrameKeyMatch(rawTargetId);
          if (matchedFrame) {
            category = 'frame';
            targetId = matchedFrame;
          } else {
            const matchedRoleId = findCatalogRoleId(rawTargetId);
            if (matchedRoleId) {
              category = 'role';
              targetId = matchedRoleId;
            } else {
              const { data: userRoles } = await supabase.from('user_roles').select('role_id, role_name').eq('user_id', cleanId);
              const normRaw = normalizeTargetText(rawTargetId);
              const dbRole = (userRoles || []).find((r) => r.role_id === rawTargetId || normalizeTargetText(r.role_name) === normRaw);
              if (dbRole) {
                category = 'role';
                targetId = dbRole.role_id;
              } else {
                return {
                  success: false,
                  status: 404,
                  error: 'TARGET_NOT_FOUND',
                  message: `Không tìm thấy UID / Emoji / Tên \`${rawTargetId}\` khớp Pháp Bảo, Linh Vực, Linh Thú, Role, Ảnh Nền hay Khung Viền nào.\n• *(Muốn đổi danh hiệu, hãy gõ \`/equip ma_id:title:Tên Mới\`)*`,
                };
              }
            }
          }
        }
      }
    }
  } else {
    if (category === 'item' && !EQUIPMENT_BY_ID[targetId]) {
      const byName = Object.values(EQUIPMENT_BY_ID).find((x) => x.item_id.toLowerCase() === normEmoji || normalizeTargetText(x.item_name) === normEmoji);
      if (byName) targetId = byName.item_id;
    } else if (category === 'background') {
      const bg = findBackgroundMatch(targetId) || findBackgroundMatch(rawTargetId);
      if (bg) targetId = bg.bg_id;
    } else if (category === 'frame') {
      const fk = findFrameKeyMatch(targetId) || findFrameKeyMatch(rawTargetId);
      if (fk) targetId = fk;
    } else if (category === 'domain') {
      const { equipDomainEntity } = await import('./domainService.js');
      const domRes = await equipDomainEntity(cleanId, emojiNormalized);
      return { ...domRes, category: 'domain' };
    } else if (category === 'pet') {
      const petRes = await setActivePet(cleanId, emojiNormalized);
      return { ...petRes, category: 'pet' };
    } else if (category === 'role') {
      const resolvedRole = findCatalogRoleId(targetId);
      if (resolvedRole) targetId = resolvedRole;
    }
  }

  if (category === 'item') {
    const itemMeta = EQUIPMENT_BY_ID[targetId];
    if (!itemMeta) return { success: false, status: 404, error: 'ITEM_NOT_FOUND', message: `Không tìm thấy pháp bảo '${targetId}'.` };

    const { data: own } = await supabase
      .from('user_pet_items')
      .select('id, equipped_to_pet, slot, quantity')
      .eq('user_id', cleanId)
      .eq('item_id', targetId)
      .maybeSingle();

    if (!own) return { success: false, status: 404, error: 'ITEM_NOT_OWNED', message: `Bạn chưa sở hữu **${itemMeta.item_name}**.` };

    const busyExp = await getUserBusyExplorationAssets(cleanId);
    if (busyExp?.isExploring && busyExp.busyEquipIds.has(targetId) && Number(own.quantity || 1) <= 1) {
      return {
        success: false,
        status: 400,
        error: 'ITEM_BUSY_EXPLORING',
        message: `${uiEm('ui_compass_dir')} Pháp bảo **${itemMeta.item_name}** hiện đang theo Linh Thú đi **Khám Phá Bản Đồ** (\`/explorer\`) nên tạm khóa! Hãy gắn món khác đang rảnh hoặc chờ chuyến khám phá hoàn tất.`,
      };
    }

    const { data: activePet } = await supabase
      .from('user_pets')
      .select('pet_type, pet_name')
      .eq('user_id', cleanId)
      .eq('is_active', true)
      .limit(1)
      .maybeSingle();

    const targetPetType = activePet?.pet_type || 'hoa_thach_nham_nham';

    // Tháo mọi món cùng slot (weapon/gem/soul) trước
    const sameTypeIds = Object.values(EQUIPMENT_BY_ID)
      .filter((x) => x.item_type === itemMeta.item_type)
      .map((x) => x.item_id);

    await supabase
      .from('user_pet_items')
      .update({ equipped_to_pet: null, slot: null })
      .eq('user_id', cleanId)
      .in('item_id', sameTypeIds);

    await supabase
      .from('user_pet_items')
      .update({ equipped_to_pet: targetPetType, slot: itemMeta.item_type })
      .eq('id', own.id);

    const { syncActiveLoadoutFromCurrentGear } = await import('./loadoutService.js');
    await syncActiveLoadoutFromCurrentGear(cleanId).catch(() => {});
    invalidateInventoryCache(cleanId);

    return {
      success: true,
      category: 'item',
      equipped_id: targetId,
      slot: itemMeta.item_type,
      equipped_to_pet: targetPetType,
      message: `${itemEmoji(targetId, em('su_crossed_swords'))} Đã trang bị **${itemMeta.item_name}** vào ô **${itemMeta.item_type.toUpperCase()}** cho **${activePet?.pet_name || targetPetType}**!`.trim(),
    };
  }

  if (category === 'role') {
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select('*')
      .eq('user_id', cleanId);

    const now = new Date();
    const expiredEquippedIds = (userRoles || [])
      .filter((r) => !r.is_permanent && r.expires_at && new Date(r.expires_at) <= now && r.is_equipped)
      .map((r) => r.id);
    if (expiredEquippedIds.length > 0) {
      await supabase.from('user_roles').update({ is_equipped: false, equipped_slot: null }).in('id', expiredEquippedIds);
    }

    const normTarget = normalizeTargetText(targetId);
    const targetRole = (userRoles || []).find((r) =>
      r.role_id === targetId || r.role_name === targetId || normalizeTargetText(r.role_name) === normTarget);
    if (!targetRole) {
      return { success: false, status: 404, error: 'ROLE_NOT_OWNED', message: 'Bạn chưa sở hữu Role Quyền Năng này trong túi.' };
    }
    if (!targetRole.is_permanent && targetRole.expires_at && new Date(targetRole.expires_at) <= now) {
      return { success: false, status: 400, error: 'ROLE_EXPIRED', message: `Role **${targetRole.role_name}** đã hết hạn sử dụng.` };
    }
    if (targetRole.is_equipped) {
      return { success: true, category: 'role', already_equipped: true, add_role_id: targetRole.role_id, message: `Role **${targetRole.role_name}** đang được trang bị sẵn ở slot #${targetRole.equipped_slot}.` };
    }

    const maxSlots = getMaxRoleSlotsByLevel(user.level || 1);
    const usedSlots = new Set(
      (userRoles || [])
        .filter((r) => r.is_equipped && r.equipped_slot && (r.is_permanent || !r.expires_at || new Date(r.expires_at) > now))
        .map((r) => Number(r.equipped_slot)),
    );
    let freeSlot = null;
    for (let s = 1; s <= maxSlots; s += 1) {
      if (!usedSlots.has(s)) { freeSlot = s; break; }
    }
    if (!freeSlot) {
      return {
        success: false,
        status: 400,
        error: 'NO_FREE_ROLE_SLOT',
        message: `Đã dùng hết **${maxSlots}/${maxSlots}** Slot Role của cảnh giới hiện tại. Hãy tháo bớt bằng \`/unequip\`!`,
      };
    }

    await supabase
      .from('user_roles')
      .update({ is_equipped: true, equipped_slot: freeSlot })
      .eq('id', targetRole.id);

    return {
      success: true,
      category: 'role',
      slot: freeSlot,
      add_role_id: targetRole.role_id,
      role_name: targetRole.role_name,
      message: `${em('su_medal_role')} Đã trang bị **${targetRole.role_name}** vào Slot #${freeSlot}/${maxSlots}!`,
    };
  }

  if (category === 'background') {
    const bg = BACKGROUND_BY_ID[targetId];
    if (!bg) return { success: false, status: 404, error: 'BG_NOT_FOUND', message: `Không tìm thấy Background '${targetId}'.` };

    if (bg.price > 0) {
      const { data: ownBg } = await supabase
        .from('user_inventory')
        .select('quantity')
        .eq('user_id', cleanId)
        .eq('item_id', bg.bg_id)
        .maybeSingle();
      if (!ownBg || ownBg.quantity < 1) {
        return { success: false, status: 403, error: 'BG_NOT_OWNED', message: `Bạn chưa mở khóa nền **${bg.name}**. Hãy mua trong \`/shop\`!` };
      }
    }

    await supabase
      .from('users')
      .update({ background_url: bg.file, updated_at: new Date().toISOString() })
      .eq('user_id', cleanId);

    return {
      success: true,
      category: 'background',
      background_url: bg.file,
      message: `${em('frame_unlock_token')} Đã đổi ảnh nền Profile & Rank sang **${bg.name}**!`,
    };
  }

  if (category === 'frame') {
    const frameKey = targetId.toLowerCase();
    if (frameKey === 'celestial_fox_gold') {
      if (cleanId !== FUYUMI_USER_ID) {
        return { success: false, status: 403, error: 'EXCLUSIVE_FRAME', message: 'Khung viền **Cửu Vĩ Hoàng Kim** là đặc quyền độc tôn của Tiểu thư Fuyumi!' };
      }
      await supabase.from('users').update({ avatar_frame: 'celestial_fox_gold', updated_at: new Date().toISOString() }).eq('user_id', cleanId);
      return { success: true, category: 'frame', avatar_frame: 'celestial_fox_gold', message: `${em('frame_unlock_token')} Đã trang bị khung viền **Cửu Vĩ Hoàng Kim**!` };
    }

    const frameMeta = AVATAR_FRAME_BY_ID[frameKey];
    if (!frameMeta) {
      const validIds = Object.keys(AVATAR_FRAME_BY_ID).join('`, `');
      return { success: false, status: 404, error: 'FRAME_NOT_FOUND', message: `Không tìm thấy khung viền '${targetId}'. Mã hợp lệ: \`${validIds}\`.` };
    }

    if (frameKey === 'default') {
      await supabase.from('users').update({ avatar_frame: 'default', updated_at: new Date().toISOString() }).eq('user_id', cleanId);
      return { success: true, category: 'frame', avatar_frame: 'default', message: `${em('frame_unlock_token', em('su_sparkle'))} Đã khôi phục khung viền Avatar mặc định theo cảnh giới.` };
    }

    const LEGACY_GRANTED_FRAMES = new Set(['frame_royal_legacy', 'jade_lotus', 'amethyst_celestial', 'crimson_phoenix', 'frost_crystal']);
    const isOwnerBypass = cleanId === FUYUMI_USER_ID;

    if (!isOwnerBypass) {
      const [{ data: ownedFrame }, { data: legacyUnlock }, { data: legacyToken }] = await Promise.all([
        supabase.from('user_frames').select('frame_id').eq('user_id', cleanId).eq('frame_id', frameKey).maybeSingle(),
        supabase.from('user_inventory').select('quantity').eq('user_id', cleanId).eq('item_id', `frame_${frameKey}`).gt('quantity', 0).maybeSingle(),
        supabase.from('user_inventory').select('quantity').eq('user_id', cleanId).eq('item_id', 'frame_unlock_token').gt('quantity', 0).maybeSingle(),
      ]);

      const hasAccess = Boolean(ownedFrame || legacyUnlock || (legacyToken && LEGACY_GRANTED_FRAMES.has(frameKey)));
      if (!hasAccess) {
        return {
          success: false,
          status: 403,
          error: 'FRAME_NOT_OWNED',
          message: `Bạn chưa sở hữu Viền Avatar **${frameMeta.name}**! Hãy vào \`/shop\` → **Quầy Viền Avatar** để mua (${Number(frameMeta.price || 0).toLocaleString('vi-VN')} ${em('su_linhthach')}).`,
        };
      }
      if (!ownedFrame) {
        await supabase.from('user_frames').upsert({
          user_id: cleanId,
          frame_id: frameKey,
          purchased_at: new Date().toISOString(),
        }, { onConflict: 'user_id,frame_id' });
      }
    }

    await supabase
      .from('users')
      .update({ avatar_frame: frameKey, updated_at: new Date().toISOString() })
      .eq('user_id', cleanId);

    return {
      success: true,
      category: 'frame',
      avatar_frame: frameKey,
      message: `${em('frame_unlock_token', em('su_sparkle'))} Đã trang bị khung Avatar **${frameMeta.name}** trên \`/profile\`, \`/rank\`, \`/battle\` & \`/linhmach\`!`,
    };
  }

  if (category === 'title') {
    const cleanTitle = targetId.replace(/[<>`\r\n]/g, '').replace(/\s+/g, ' ').trim();
    if (cleanTitle.length < 2 || cleanTitle.length > 36) {
      return { success: false, status: 400, error: 'INVALID_TITLE', message: 'Danh hiệu phải dài từ **2 đến 36 ký tự**.' };
    }

    const { data: cardRow } = await supabase
      .from('user_inventory')
      .select('quantity')
      .eq('user_id', cleanId)
      .eq('item_id', 'title_rename_card')
      .maybeSingle();

    if (!cardRow || Number(cardRow.quantity || 0) < 1) {
      return {
        success: false,
        status: 403,
        error: 'TITLE_CARD_REQUIRED',
        message: 'Bạn cần **1 Thẻ Đổi Danh Hiệu Tu Tiên** (`title_rename_card`) trong `/shop` để đổi danh hiệu!',
      };
    }

    const nowIso = new Date().toISOString();
    await Promise.all([
      supabase
        .from('user_inventory')
        .update({ quantity: Number(cardRow.quantity) - 1, updated_at: nowIso })
        .eq('user_id', cleanId)
        .eq('item_id', 'title_rename_card'),
      supabase
        .from('users')
        .update({ custom_title: cleanTitle, updated_at: nowIso })
        .eq('user_id', cleanId),
    ]);

    return {
      success: true,
      category: 'title',
      custom_title: cleanTitle,
      message: `${em('title_rename_card')} Đã đổi Danh Hiệu Tu Tiên thành **« ${cleanTitle} »**!`,
    };
  }

  return { success: false, status: 400, error: 'INVALID_CATEGORY', message: 'Loại trang bị phải là `item`, `role`, `background`, `frame`, hoặc `title`.' };
}

export async function unequipTarget(userId, payload = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID người dùng không hợp lệ.' };
  if (!supabase) return { success: false, status: 503, error: 'DB_UNAVAILABLE', message: 'Supabase chưa sẵn sàng.' };

  const category = String(payload.category || '').toLowerCase();
  const rawTargetId = String(payload.targetId || '').trim();
  const targetId = category === 'item' ? normalizeEmojiAwareQuery(rawTargetId) : rawTargetId;

  if (category === 'item') {
    let itemMatchId = targetId;
    if (!['weapon', 'gem', 'soul'].includes(targetId.toLowerCase()) && !EQUIPMENT_BY_ID[targetId]) {
      const normIn = normalizeTargetText(targetId);
      const byName = Object.values(EQUIPMENT_BY_ID).find((x) => x.item_id.toLowerCase() === normIn || normalizeTargetText(x.item_name) === normIn);
      if (byName) itemMatchId = byName.item_id;
    }
    const query = supabase
      .from('user_pet_items')
      .update({ equipped_to_pet: null, slot: null })
      .eq('user_id', cleanId);

    if (['weapon', 'gem', 'soul'].includes(itemMatchId.toLowerCase())) {
      await query.eq('slot', itemMatchId.toLowerCase());
    } else {
      await query.eq('item_id', itemMatchId);
    }

    const { syncActiveLoadoutFromCurrentGear } = await import('./loadoutService.js');
    await syncActiveLoadoutFromCurrentGear(cleanId).catch(() => {});
    invalidateInventoryCache(cleanId);

    return {
      success: true,
      category: 'item',
      message: `${em('su_crossed_swords')} Đã tháo pháp bảo **${targetId}** khỏi Linh Thú xuất trận.`,
    };
  }

  if (category === 'role') {
    const { data: userRoles } = await supabase
      .from('user_roles')
      .select('*')
      .eq('user_id', cleanId)
      .eq('is_equipped', true);

    const slotNum = Number(targetId);
    const targetRole = (userRoles || []).find((r) =>
      r.role_id === targetId || r.role_name === targetId || (Number.isInteger(slotNum) && r.equipped_slot === slotNum));

    if (!targetRole) {
      return { success: false, status: 404, error: 'ROLE_NOT_EQUIPPED', message: 'Không tìm thấy Role đang đeo khớp yêu cầu.' };
    }

    await supabase
      .from('user_roles')
      .update({ is_equipped: false, equipped_slot: null })
      .eq('id', targetRole.id);

    return {
      success: true,
      category: 'role',
      remove_role_id: targetRole.role_id,
      role_name: targetRole.role_name,
      message: `${em('su_medal_role')} Đã tháo Role **${targetRole.role_name}** khỏi hồ sơ!`,
    };
  }

  if (category === 'background') {
    await supabase
      .from('users')
      .update({ background_url: 'default_background.png', updated_at: new Date().toISOString() })
      .eq('user_id', cleanId);

    return {
      success: true,
      category: 'background',
      background_url: 'default_background.png',
      message: `${em('frame_unlock_token')} Đã khôi phục ảnh nền Đạo Cảnh Mặc Định.`,
    };
  }

  if (category === 'frame') {
    await supabase
      .from('users')
      .update({ avatar_frame: 'default', updated_at: new Date().toISOString() })
      .eq('user_id', cleanId);

    return {
      success: true,
      category: 'frame',
      avatar_frame: 'default',
      message: `${em('frame_unlock_token')} Đã tháo khung viền, khôi phục về khung mặc định theo cảnh giới.`,
    };
  }

  return { success: false, status: 400, error: 'INVALID_CATEGORY', message: 'Loại cần tháo phải là `item`, `role`, `background`, hoặc `frame`.' };
}

const SHOP_EQUIP_BY_ID = Object.fromEntries(SHOP_EQUIPMENT.map((e) => [e.item_id, e]));
const SHOP_PET_BY_ID = Object.fromEntries(SHOP_PETS.map((p) => [p.pet_type, p]));
const dismantleLocks = new Map();

async function withDismantleLock(userId, fn) {
  const prev = dismantleLocks.get(userId) || Promise.resolve();
  let release;
  const current = new Promise((res) => { release = res; });
  const queued = prev.then(() => current);
  dismantleLocks.set(userId, queued);
  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (dismantleLocks.get(userId) === queued) dismantleLocks.delete(userId);
  }
}

function normalizeTargetText(str) {
  return String(str || '')
    .replace(/[«»"'`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function getRoleBaseValue(roleRow, now) {
  const roleMeta = SHOP_ROLE_BY_ID[roleRow.role_id] || ROLE_BY_ID[roleRow.role_id];
  const prices = roleMeta?.prices || { '7d': 200, '30d': 650, permanent: 2000 };
  if (roleRow.is_permanent) {
    return Number(prices.permanent || 2000);
  }
  const remMs = roleRow.expires_at ? new Date(roleRow.expires_at).getTime() - now.getTime() : 0;
  const remDays = Math.max(1, Math.ceil(remMs / 86400000));
  if (remDays <= 7) {
    return Math.max(2, Math.round(Number(prices['7d'] || 200) * (remDays / 7)));
  }
  return Math.min(
    Number(prices.permanent || 2000),
    Math.max(2, Math.round(Number(prices['30d'] || 650) * (remDays / 30))),
  );
}

/**
 * Chủ động phân rã / hủy Role Quyền Năng, Pháp Bảo hoặc Linh Thú (/dismantle)
 * để thu hồi đúng 50% giá trị gốc dưới dạng Linh Thạch.
 */
export async function dismantleTarget(userId, payload = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return { success: false, status: 400, error: 'INVALID_USER_ID', remove_role_id: '', message: 'ID người dùng không hợp lệ.' };
  if (!supabase) return { success: false, status: 503, error: 'DB_UNAVAILABLE', remove_role_id: '', message: 'Supabase chưa sẵn sàng.' };

  const rawCat = String(payload.category || payload.loai || '').trim().toLowerCase();
  const normalizedCat = rawCat === 'linhvuc' ? 'domain' : rawCat;
  const category = ['role', 'item', 'pet', 'domain'].includes(normalizedCat) ? normalizedCat : '';
  const rawTarget = String(payload.targetId || payload.maId || '').trim();
  if (!rawTarget) {
    return {
      success: false,
      status: 400,
      error: 'MISSING_TARGET',
      remove_role_id: '',
      message: 'Vui lòng nhập Mã ID, tên Role/Pháp Bảo/Linh Thú/Linh Vực hoặc từ khóa (`all_dup`, `all_common`, `all_rare`, `all_epic`) muốn phá.',
    };
  }

  if (category === 'domain') {
    const domRes = await dismantleDomainEntity(cleanId, rawTarget);
    return { remove_role_id: '', ...domRes };
  }

  return withDismantleLock(cleanId, async () => {
    const { user } = await ensureUserInitialized(cleanId, {
      username: pickCleanDisplayValue(payload.username, payload.fallbackUsername),
      avatarUrl: pickCleanDisplayValue(payload.avatarUrl),
    });
    if (!user) {
      return { success: false, status: 500, error: 'USER_INIT_FAILED', remove_role_id: '', message: 'Không thể khởi tạo hồ sơ.' };
    }

    const now = payload.now instanceof Date ? payload.now : new Date();
    const resolvedSingle = rawTarget.includes(',') ? rawTarget : normalizeEmojiAwareQuery(rawTarget);
    const cleanRoleId = resolvedSingle.replace(/^<@&(\d+)>$/, '$1').trim();
    const normTarget = normalizeTargetText(resolvedSingle);
    const batchRarityMap = { all_common: 'common', all_rare: 'rare', all_epic: 'epic' };
    const isAllDup = normTarget === 'all_dup' || normTarget === 'all_duplicates';
    const isBatchMode = isAllDup || rawTarget.includes(',') || Object.prototype.hasOwnProperty.call(batchRarityMap, normTarget);

    // Chặn phá nhầm Level Role (cần dùng /doiqua để tụt cấp)
    if ((category === '' || category === 'role') && !isAllDup) {
      const matchedMilestone = LEVEL_ROLE_MILESTONES.find((m) =>
        m.roleId === cleanRoleId || normalizeTargetText(m.name) === normTarget);
      if (matchedMilestone) {
        return {
          success: false,
          status: 400,
          error: 'LEVEL_ROLE_CANNOT_DISMANTLE',
          remove_role_id: '',
          remove_role_csv: '',
          message: `**${matchedMilestone.name}** là **Role Cấp Độ (Level Role)**, không thể phá bằng \`/dismantle\`!\n• Nếu muốn gỡ Level Role và nhận Linh Thạch, hãy dùng \`/doiqua\` để phế Tu Vi tụt cấp.`,
        };
      }

      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', cleanId);
      const validBotRoles = (userRoles || []).filter((r) =>
        !LEVEL_ROLE_MILESTONES.some((m) => m.roleId === r.role_id)
        && Object.prototype.hasOwnProperty.call(ROLE_BY_ID, r.role_id)
        && (r.is_permanent || !r.expires_at || new Date(r.expires_at) > now));

      if (isBatchMode && (category === 'role' || (category === '' && !Object.prototype.hasOwnProperty.call(batchRarityMap, normTarget)))) {
        let matchedRoleRows = [];
        if (Object.prototype.hasOwnProperty.call(batchRarityMap, normTarget)) {
          const rkTarget = batchRarityMap[normTarget];
          matchedRoleRows = validBotRoles.filter((r) => (ROLE_BY_ID[r.role_id]?.rarity_key || 'common') === rkTarget);
        } else {
          const tokens = rawTarget.split(',').map((t) => normalizeTargetText(t.trim().replace(/^<@&(\d+)>$/, '$1'))).filter(Boolean);
          const seenIds = new Set();
          for (const tok of tokens) {
            const hit = validBotRoles.find((r) =>
              !seenIds.has(r.id)
              && (r.role_id === tok || normalizeTargetText(r.role_name) === tok));
            if (hit) {
              seenIds.add(hit.id);
              matchedRoleRows.push(hit);
            }
          }
        }

        if (matchedRoleRows.length > 0 || category === 'role') {
          if (matchedRoleRows.length === 0) {
            return {
              success: false,
              status: 404,
              error: 'ROLE_NOT_OWNED',
              remove_role_id: '',
              remove_role_csv: '',
              message: `Không tìm thấy Role Quyền Năng nào khớp \`${rawTarget}\` trong túi đồ \`/roles\` để phân rã.`,
            };
          }

          const equippedRoles = matchedRoleRows.filter((r) => r.is_equipped);
          const unequippedRoles = matchedRoleRows.filter((r) => !r.is_equipped);
          if (unequippedRoles.length === 0) {
            return {
              success: false,
              status: 400,
              error: 'EQUIPPED_ROLES_PROTECTED',
              remove_role_id: '',
              remove_role_csv: '',
              skipped_equipped_count: equippedRoles.length,
              message: `Toàn bộ **${equippedRoles.length}** Role khớp yêu cầu hiện **đang được trang bị**, hệ thống đã tự động giữ lại! Hãy tháo bằng \`/unequip loai:role\` trước nếu muốn phá.`,
            };
          }

          let totalRefund = 0;
          let shopCount = 0;
          let gachaCount = 0;
          for (const row of unequippedRoles) {
            const meta = ROLE_BY_ID[row.role_id] || {};
            const q = getDismantleQuote('role', row, meta, now);
            totalRefund += q.refund;
            if (q.isShop) shopCount += 1;
            else gachaCount += 1;
          }

          const newBalance = Number(user.linh_thach || 0) + totalRefund;
          await Promise.all([
            supabase.from('user_roles').delete().in('id', unequippedRoles.map((r) => r.id)),
            supabase.from('users').update({ linh_thach: newBalance, updated_at: now.toISOString() }).eq('user_id', cleanId),
          ]);

          const removeRoleIds = [...new Set(unequippedRoles.map((r) => String(r.role_id || '').trim()).filter(Boolean))];
          await trackQuestActivity(cleanId, { craftDelta: 1, now });

          const previewNames = unequippedRoles.slice(0, 6).map((r) => `**${r.role_name}**`).join(', ');
          const moreTxt = unequippedRoles.length > 6 ? ` *... (+${unequippedRoles.length - 6} role)*` : '';
          return {
            success: true,
            category: 'role',
            batch: true,
            dismantled_count: unequippedRoles.length,
            skipped_equipped_count: equippedRoles.length,
            remove_role_id: removeRoleIds[0] || '',
            remove_role_ids: removeRoleIds,
            remove_role_csv: removeRoleIds.join(','),
            refund_linh_thach: totalRefund,
            linh_thach: newBalance,
            linh_thach_fmt: newBalance.toLocaleString('vi-VN'),
            message: [
              `${em('su_medal_role')} Đã phân rã hàng loạt **${unequippedRoles.length} Role Quyền Năng**: ${previewNames}${moreTxt}`,
              `• Tổng thu hồi: **+${totalRefund.toLocaleString('vi-VN')}** ${em('su_linhthach')} **Linh Thạch** *(Mua Shop 25%: ${shopCount} • Gacha chuẩn: ${gachaCount})*`,
              equippedRoles.length > 0 ? `• Đã tự động **giữ lại ${equippedRoles.length} Role đang trang bị**.` : '',
              `• Số dư hiện tại: **${newBalance.toLocaleString('vi-VN')} Linh Thạch**`,
            ].filter(Boolean).join('\n'),
          };
        }
      }

      const slotNum = /^[1-5]$/.test(rawTarget) ? Number(rawTarget) : null;
      const targetRole = (userRoles || []).find((r) =>
        r.role_id === cleanRoleId
        || normalizeTargetText(r.role_name) === normTarget
        || (slotNum && r.is_equipped && Number(r.equipped_slot) === slotNum));

      if (targetRole) {
        const milestoneByRow = LEVEL_ROLE_MILESTONES.find((m) => m.roleId === targetRole.role_id);
        if (milestoneByRow) {
          return {
            success: false,
            status: 400,
            error: 'LEVEL_ROLE_CANNOT_DISMANTLE',
            remove_role_id: '',
            remove_role_csv: '',
            message: `**${milestoneByRow.name}** là **Role Cấp Độ (Level Role)**, không thể phá bằng \`/dismantle\`!\n• Nếu muốn gỡ Level Role và nhận Linh Thạch, hãy dùng \`/doiqua\` để phế Tu Vi tụt cấp.`,
          };
        }

        if (!Object.prototype.hasOwnProperty.call(ROLE_BY_ID, targetRole.role_id)) {
          return {
            success: false,
            status: 400,
            error: 'NON_BOT_ROLE_CANNOT_DISMANTLE',
            remove_role_id: '',
            remove_role_csv: '',
            message: `Role **${targetRole.role_name}** không thuộc danh mục Role Quyền Năng do Bot cấp qua \`/shop\` hoặc \`/roll\` nên không thể phân rã!`,
          };
        }

        if (!targetRole.is_permanent && targetRole.expires_at && new Date(targetRole.expires_at) <= now) {
          await supabase.from('user_roles').delete().eq('id', targetRole.id);
          return {
            success: false,
            status: 400,
            error: 'ROLE_EXPIRED',
            remove_role_id: targetRole.role_id,
            remove_role_csv: targetRole.role_id,
            message: `Role **${targetRole.role_name}** đã hết hạn sử dụng nên không còn giá trị hoàn trả (đã dọn khỏi túi).`,
          };
        }

        const quote = getDismantleQuote('role', targetRole, ROLE_BY_ID[targetRole.role_id], now);
        const baseValue = quote.baseValue;
        const refundLinhThach = quote.refund;
        const newBalance = Number(user.linh_thach || 0) + refundLinhThach;

        await Promise.all([
          supabase.from('user_roles').delete().eq('id', targetRole.id),
          supabase.from('users').update({ linh_thach: newBalance, updated_at: now.toISOString() }).eq('user_id', cleanId),
          trackQuestActivity(cleanId, { craftDelta: 1, now }),
        ]);

        const quoteLine = quote.isShop
          ? `• Giá trị mua Shop: **${baseValue.toLocaleString('vi-VN')}** ${em('su_linhthach')} → Hoàn trả **${quote.refundPct}%**: **+${refundLinhThach.toLocaleString('vi-VN')}** ${em('su_linhthach')} **Linh Thạch**`
          : `• Nguồn **Gacha / Quà** *(giá phân rã chuẩn chống farm)*: **+${refundLinhThach.toLocaleString('vi-VN')}** ${em('su_linhthach')} **Linh Thạch**`;

        return {
          success: true,
          category: 'role',
          source: quote.source,
          role_id: targetRole.role_id,
          role_name: targetRole.role_name,
          remove_role_id: targetRole.role_id,
          remove_role_csv: targetRole.role_id,
          base_value: baseValue,
          refund_linh_thach: refundLinhThach,
          linh_thach: newBalance,
          linh_thach_fmt: newBalance.toLocaleString('vi-VN'),
          message: `${em('su_sparkle')} Đã phân rã Role **${targetRole.role_name}**!\n${quoteLine}\n• Số dư hiện tại: **${newBalance.toLocaleString('vi-VN')} Linh Thạch**${targetRole.is_equipped ? '\n• Đã giải phóng Slot trang bị & gỡ Role khỏi hồ sơ Discord.' : ''}`,
        };
      }

      if (category === 'role') {
        return {
          success: false,
          status: 404,
          error: 'ROLE_NOT_OWNED',
          remove_role_id: '',
          remove_role_csv: '',
          message: `Không tìm thấy Role Quyền Năng \`${rawTarget}\` trong túi đồ \`/roles\` của bạn.\n• *Lưu ý chống Bypass: Hệ thống chỉ cho phép phân rã những Role do chính Bot cấp và lưu trong cơ sở dữ liệu (\`/shop\` hoặc \`/roll loai:role\`). Mọi Role tự gắn tay ngoài Discord đều không có hiệu lực!*`,
        };
      }
    }

    const isBatchEquip = isBatchMode;

    if (category === 'item' || (category === '' && isBatchEquip && Object.prototype.hasOwnProperty.call(batchRarityMap, normTarget)) || category === '' || (category === '' && isBatchMode)) {
      const { data: userItems } = await supabase
        .from('user_pet_items')
        .select('*')
        .eq('user_id', cleanId);

      const allUserItems = userItems || [];

      if (isBatchEquip && (category === 'item' || category === '')) {
        let matchedRows = [];
        if (isAllDup) {
          matchedRows = allUserItems.filter((row) => (Number(row.quantity) || 1) > 1);
        } else if (Object.prototype.hasOwnProperty.call(batchRarityMap, normTarget)) {
          const rkTarget = batchRarityMap[normTarget];
          matchedRows = allUserItems.filter((row) => (EQUIPMENT_BY_ID[row.item_id]?.rarity_key || 'common') === rkTarget);
        } else {
          const tokens = rawTarget.split(',').map((t) => normalizeTargetText(normalizeEmojiAwareQuery(t))).filter(Boolean);
          const seenIds = new Set();
          for (const tok of tokens) {
            const hit = allUserItems.find((row) =>
              !seenIds.has(row.id)
              && (row.item_id.toLowerCase() === tok || normalizeTargetText(EQUIPMENT_BY_ID[row.item_id]?.item_name) === tok));
            if (hit) {
              seenIds.add(hit.id);
              matchedRows.push(hit);
            }
          }
        }

        if (matchedRows.length === 0 && category === 'item') {
          return {
            success: false,
            status: 404,
            error: 'ITEM_NOT_OWNED',
            remove_role_id: '',
            remove_role_csv: '',
            message: isAllDup
              ? 'Hiện không có Pháp Bảo nào có bản trùng (`> 1`) trong túi đồ `/phapbao` để phân rã.'
              : `Không tìm thấy Pháp Bảo nào khớp \`${rawTarget}\` trong túi đồ \`/phapbao\` để phân rã.`,
          };
        }

        if (matchedRows.length > 0) {
          const deleteEntries = [];
          const reduceEntries = [];
          let skippedEquippedCount = 0;

          for (const row of matchedRows) {
            const qty = Math.max(1, Number(row.quantity) || 1);
            const isEq = Boolean(row.equipped_to_pet || row.slot);
            if (isAllDup || isEq) {
              const extraCopies = Math.max(0, qty - 1);
              if (extraCopies > 0) {
                reduceEntries.push({ row, copies: extraCopies });
              } else if (isEq) {
                skippedEquippedCount += 1;
              }
            } else {
              deleteEntries.push({ row, copies: qty });
            }
          }

          const allOps = [...deleteEntries, ...reduceEntries];
          if (allOps.length === 0) {
            if (category === 'item' || !isAllDup) {
              return {
                success: false,
                status: 400,
                error: 'EQUIPPED_ITEMS_PROTECTED',
                remove_role_id: '',
                remove_role_csv: '',
                skipped_equipped_count: skippedEquippedCount,
                message: `Toàn bộ **${skippedEquippedCount}** Pháp Bảo khớp yêu cầu hiện **đang được trang bị** (không có bản trùng dư), hệ thống đã tự động giữ lại! Hãy dùng \`/unequip loai:item\` trước nếu muốn phá.`,
              };
            }
          } else {
            let totalRefund = 0;
            let totalCopies = 0;
            let shopCount = 0;
            let gachaCount = 0;
            for (const { row, copies } of allOps) {
              const meta = EQUIPMENT_BY_ID[row.item_id] || {};
              const q = getDismantleQuote('item', row, meta, now);
              totalRefund += q.refund * copies;
              totalCopies += copies;
              if (q.isShop) shopCount += copies;
              else gachaCount += copies;
            }

            const newBalance = Number(user.linh_thach || 0) + totalRefund;
            const dbPromises = [
              supabase.from('users').update({ linh_thach: newBalance, updated_at: now.toISOString() }).eq('user_id', cleanId),
            ];
            if (deleteEntries.length > 0) {
              dbPromises.push(supabase.from('user_pet_items').delete().in('id', deleteEntries.map((e) => e.row.id)));
            }
            for (const { row } of reduceEntries) {
              dbPromises.push(supabase.from('user_pet_items').update({ quantity: 1 }).eq('id', row.id));
            }
            await Promise.all(dbPromises);
            await trackQuestActivity(cleanId, { craftDelta: 1, now });

            for (const { row } of deleteEntries) {
              if (EQUIPMENT_BY_ID[row.item_id]?.is_unique || MYTHIC_UNIQUE_ITEM_IDS.has(row.item_id)) {
                invalidateUniqueItemCard(row.item_id);
              }
            }

            const previewNames = allOps.slice(0, 6).map(({ row, copies }) => `**${EQUIPMENT_BY_ID[row.item_id]?.item_name || row.item_id}**${copies > 1 ? ` ×${copies}` : ''}`).join(', ');
            const moreTxt = allOps.length > 6 ? ` *... (+${allOps.length - 6} món)*` : '';
            return {
              success: true,
              category: 'item',
              batch: true,
              dismantled_count: totalCopies,
              skipped_equipped_count: skippedEquippedCount,
              remove_role_id: '',
              remove_role_csv: '',
              refund_linh_thach: totalRefund,
              linh_thach: newBalance,
              linh_thach_fmt: newBalance.toLocaleString('vi-VN'),
              message: [
                `${em('su_crossed_swords')} Đã phân rã hàng loạt **${totalCopies} Pháp Bảo**: ${previewNames}${moreTxt}`,
                `• Tổng thu hồi: **+${totalRefund.toLocaleString('vi-VN')}** ${em('su_linhthach')} **Linh Thạch** *(Mua Shop 20%: ${shopCount} • Gacha chuẩn: ${gachaCount})*`,
                (skippedEquippedCount > 0 || reduceEntries.length > 0) ? `• Đã tự động **giữ lại 1 bản gốc** cho các món đang trang bị / sưu tầm.` : '',
                `• Số dư hiện tại: **${newBalance.toLocaleString('vi-VN')} Linh Thạch**`,
              ].filter(Boolean).join('\n'),
            };
          }
        }
      }

      const matchedItem = allUserItems.find((row) =>
        row.item_id.toLowerCase() === normTarget
        || normalizeTargetText(EQUIPMENT_BY_ID[row.item_id]?.item_name) === normTarget);

      if (matchedItem) {
        const qty = Math.max(1, Number(matchedItem.quantity) || 1);
        const isEq = Boolean(matchedItem.equipped_to_pet || matchedItem.slot);
        if (isEq && qty <= 1) {
          return {
            success: false,
            status: 400,
            error: 'EQUIPPED_ITEM_PROTECTED',
            remove_role_id: '',
            message: `Pháp Bảo **${EQUIPMENT_BY_ID[matchedItem.item_id]?.item_name || matchedItem.item_id}** hiện **đang được trang bị**! Hãy tháo ra bằng \`/unequip loai:item ma_id:${matchedItem.item_id}\` trước khi phá.`,
          };
        }

        const copiesToDismantle = isEq ? (qty - 1) : qty;
        const itemMeta = EQUIPMENT_BY_ID[matchedItem.item_id] || SHOP_EQUIP_BY_ID[matchedItem.item_id] || {};
        const quote = getDismantleQuote('item', matchedItem, itemMeta, now);
        const baseValue = quote.baseValue;
        const refundLinhThach = quote.refund * copiesToDismantle;
        const newBalance = Number(user.linh_thach || 0) + refundLinhThach;

        await Promise.all([
          isEq
            ? supabase.from('user_pet_items').update({ quantity: 1 }).eq('id', matchedItem.id)
            : supabase.from('user_pet_items').delete().eq('id', matchedItem.id),
          supabase.from('users').update({ linh_thach: newBalance, updated_at: now.toISOString() }).eq('user_id', cleanId),
          trackQuestActivity(cleanId, { craftDelta: 1, now }),
        ]);

        const quoteLine = quote.isShop
          ? `• Giá trị mua Shop: **${baseValue.toLocaleString('vi-VN')}** ${em('su_linhthach')} → Hoàn trả **${quote.refundPct}%**${copiesToDismantle > 1 ? ` (×${copiesToDismantle} bản)` : ''}: **+${refundLinhThach.toLocaleString('vi-VN')}** ${em('su_linhthach')} **Linh Thạch**`
          : `• Nguồn **Gacha / Quà** *(giá phân rã chuẩn chống farm${copiesToDismantle > 1 ? ` ×${copiesToDismantle} bản` : ''})*: **+${refundLinhThach.toLocaleString('vi-VN')}** ${em('su_linhthach')} **Linh Thạch**`;
        if (!isEq && (itemMeta.is_unique || MYTHIC_UNIQUE_ITEM_IDS.has(matchedItem.item_id))) {
          invalidateUniqueItemCard(matchedItem.item_id);
        }

        return {
          success: true,
          category: 'item',
          source: quote.source,
          item_id: matchedItem.item_id,
          item_name: itemMeta.item_name || matchedItem.item_id,
          dismantled_count: copiesToDismantle,
          remove_role_id: '',
          remove_role_csv: '',
          base_value: baseValue,
          refund_linh_thach: refundLinhThach,
          linh_thach: newBalance,
          linh_thach_fmt: newBalance.toLocaleString('vi-VN'),
          message: `${em('su_crossed_swords')} Đã phân rã **${copiesToDismantle > 1 ? `${copiesToDismantle}× ` : ''}${itemMeta.item_name || matchedItem.item_id}**${isEq ? ' *(giữ lại 1 bản đang trang bị)*' : ''}!\n${quoteLine}\n• Số dư hiện tại: **${newBalance.toLocaleString('vi-VN')} Linh Thạch**`,
        };
      }

      if (category === 'item') {
        return {
          success: false,
          status: 404,
          error: 'ITEM_NOT_OWNED',
          remove_role_id: '',
          remove_role_csv: '',
          message: `Không tìm thấy Pháp Bảo \`${rawTarget}\` trong túi đồ \`/phapbao\` của bạn.`,
        };
      }
    }

    if (category === 'pet' || category === '') {
      const { data: userPets } = await supabase
        .from('user_pets')
        .select('*')
        .eq('user_id', cleanId);

      const allUserPets = userPets || [];

      if (isBatchMode) {
        let matchedPets = [];
        if (isAllDup) {
          matchedPets = allUserPets.filter((p) => (Number(p.quantity) || 1) > 1);
        } else if (Object.prototype.hasOwnProperty.call(batchRarityMap, normTarget)) {
          const rkTarget = batchRarityMap[normTarget];
          matchedPets = allUserPets.filter((p) => (PET_BY_TYPE[p.pet_type]?.rarity_key || 'common') === rkTarget);
        } else {
          const tokens = rawTarget.split(',').map((t) => normalizeTargetText(normalizeEmojiAwareQuery(t))).filter(Boolean);
          const seenPetIds = new Set();
          for (const tok of tokens) {
            const hit = allUserPets.find((p) =>
              !seenPetIds.has(p.pet_id)
              && (String(p.pet_id) === tok || p.pet_type.toLowerCase() === tok || normalizeTargetText(p.pet_name) === tok));
            if (hit) {
              seenPetIds.add(hit.pet_id);
              matchedPets.push(hit);
            }
          }
        }

        if (matchedPets.length === 0) {
          return {
            success: false,
            status: 404,
            error: 'PET_NOT_OWNED',
            remove_role_id: '',
            remove_role_csv: '',
            message: isAllDup
              ? 'Hiện không có Linh Thú hay Pháp Bảo nào có bản trùng (`> 1`) trong kho để phân rã.'
              : `Không tìm thấy Linh Thú nào khớp \`${rawTarget}\` trong kho \`/linhthu\` để phân rã.`,
          };
        }

        const deleteEntries = [];
        const reduceEntries = [];
        let skippedProtectedCount = 0;
        let remainingPetRows = allUserPets.length;

        for (const p of matchedPets) {
          const qty = Math.max(1, Number(p.quantity) || 1);
          const isBaseProtected = Boolean(p.is_active || p.status === 'exploring' || p.status === 'injured' || p.pet_type === 'hoa_thach_nham_nham' || p.pet_type === 'cuu_vi_hong_ho');
          if (isAllDup || isBaseProtected || remainingPetRows <= 1) {
            const extraCopies = Math.max(0, qty - 1);
            if (extraCopies > 0) {
              reduceEntries.push({ row: p, copies: extraCopies });
            } else {
              skippedProtectedCount += 1;
            }
          } else {
            deleteEntries.push({ row: p, copies: qty });
            remainingPetRows -= 1;
          }
        }

        const allOps = [...deleteEntries, ...reduceEntries];
        if (allOps.length === 0) {
          return {
            success: false,
            status: 400,
            error: 'PROTECTED_PETS_ONLY',
            remove_role_id: '',
            remove_role_csv: '',
            skipped_equipped_count: skippedProtectedCount,
            message: `Toàn bộ **${skippedProtectedCount}** Linh Thú khớp yêu cầu đều được bảo vệ *(đang xuất trận, Pet khởi đầu \`hoa_thach_nham_nham\`, Cửu Vĩ Hồng Hồ hoặc Pet cuối cùng và không có bản trùng dư)*!`,
          };
        }

        let totalRefund = 0;
        let totalCopies = 0;
        let shopCount = 0;
        let gachaCount = 0;
        for (const { row, copies } of allOps) {
          const petMeta = PET_BY_TYPE[row.pet_type] || SHOP_PET_BY_ID[row.pet_type] || {};
          const q = getDismantleQuote('pet', row, petMeta, now);
          totalRefund += q.refund * copies;
          totalCopies += copies;
          if (q.isShop) shopCount += copies;
          else gachaCount += copies;
        }

        const newBalance = Number(user.linh_thach || 0) + totalRefund;
        const dbPromises = [
          supabase.from('users').update({ linh_thach: newBalance, updated_at: now.toISOString() }).eq('user_id', cleanId),
        ];
        if (deleteEntries.length > 0) {
          const delPetIds = deleteEntries.map((e) => e.row.pet_id);
          const delPetTypes = deleteEntries.map((e) => e.row.pet_type);
          dbPromises.push(supabase.from('user_pet_items').update({ equipped_to_pet: null, slot: null }).eq('user_id', cleanId).in('equipped_to_pet', delPetTypes));
          dbPromises.push(supabase.from('user_pets').delete().in('pet_id', delPetIds));
        }
        for (const { row } of reduceEntries) {
          dbPromises.push(supabase.from('user_pets').update({ quantity: 1 }).eq('pet_id', row.pet_id));
        }
        await Promise.all(dbPromises);
        await trackQuestActivity(cleanId, { craftDelta: 1, now });

        const previewNames = allOps.slice(0, 6).map(({ row, copies }) => `**${row.pet_name}**${copies > 1 ? ` ×${copies}` : ''}`).join(', ');
        const moreTxt = allOps.length > 6 ? ` *... (+${allOps.length - 6} pet)*` : '';
        return {
          success: true,
          category: 'pet',
          batch: true,
          dismantled_count: totalCopies,
          skipped_equipped_count: skippedProtectedCount,
          remove_role_id: '',
          remove_role_csv: '',
          refund_linh_thach: totalRefund,
          linh_thach: newBalance,
          linh_thach_fmt: newBalance.toLocaleString('vi-VN'),
          message: [
            `${em('su_pet_paw')} Đã giải phóng / phân rã hàng loạt **${totalCopies} Linh Thú**: ${previewNames}${moreTxt}`,
            `• Tổng thu hồi: **+${totalRefund.toLocaleString('vi-VN')}** ${em('su_linhthach')} **Linh Thạch** *(Mua Shop 25%: ${shopCount} • Gacha chuẩn: ${gachaCount})*`,
            (skippedProtectedCount > 0 || reduceEntries.length > 0) ? `• Đã tự động **giữ lại bản chính** cho các Linh Thú đang xuất trận / tân thủ / sưu tầm.` : '',
            `• Số dư hiện tại: **${newBalance.toLocaleString('vi-VN')} Linh Thạch**`,
          ].filter(Boolean).join('\n'),
        };
      }

      const matchedPet = allUserPets.find((p) =>
        String(p.pet_id) === resolvedSingle
        || p.pet_type.toLowerCase() === normTarget
        || normalizeTargetText(p.pet_name) === normTarget);

      if (matchedPet) {
        const qty = Math.max(1, Number(matchedPet.quantity) || 1);
        const isBaseProtected = Boolean(
          matchedPet.pet_type === 'hoa_thach_nham_nham'
          || matchedPet.pet_type === 'cuu_vi_hong_ho'
          || matchedPet.is_active
          || matchedPet.status === 'exploring'
          || matchedPet.status === 'injured'
          || allUserPets.length <= 1
        );

        if (qty <= 1) {
          if (matchedPet.status === 'exploring') {
            return { success: false, status: 400, error: 'PET_BUSY_EXPLORING', remove_role_id: '', remove_role_csv: '', message: `${uiEm('ui_compass_dir')} Không thể phân rã **${matchedPet.pet_name}** khi đang đi Khám Phá Bản Đồ (\`/explorer\`)!` };
          }
          if (matchedPet.status === 'injured') {
            return { success: false, status: 400, error: 'PET_INJURED', remove_role_id: '', remove_role_csv: '', message: `${uiEm('ui_heal_band')} Không thể phân rã **${matchedPet.pet_name}** khi đang Trọng Thương!` };
          }
          if (matchedPet.pet_type === 'hoa_thach_nham_nham') {
            return { success: false, status: 400, error: 'STARTER_PET_PROTECTED', remove_role_id: '', remove_role_csv: '', message: 'Không thể phân rã Linh Thú khởi đầu **Hóa Thạch Nham Nham Thú**!' };
          }
          if (matchedPet.pet_type === 'cuu_vi_hong_ho') {
            return { success: false, status: 400, error: 'EXCLUSIVE_PET_PROTECTED', remove_role_id: '', remove_role_csv: '', message: 'Không thể phân rã Linh Thú độc tôn **Cửu Vĩ Hồng Hồ**!' };
          }
          if (matchedPet.is_active) {
            return { success: false, status: 400, error: 'ACTIVE_PET_PROTECTED', remove_role_id: '', remove_role_csv: '', message: `Không thể phân rã **${matchedPet.pet_name}** khi đang xuất trận! Hãy đổi sang Linh Thú khác bằng \`/linhthu hanh_dong:active\` trước.` };
          }
          if (allUserPets.length <= 1) {
            return { success: false, status: 400, error: 'LAST_PET_PROTECTED', remove_role_id: '', remove_role_csv: '', message: 'Không thể phân rã Linh Thú cuối cùng trong kho!' };
          }
        }

        const copiesToDismantle = isBaseProtected ? (qty - 1) : qty;
        const petMeta = PET_BY_TYPE[matchedPet.pet_type] || SHOP_PET_BY_ID[matchedPet.pet_type] || {};
        const quote = getDismantleQuote('pet', matchedPet, petMeta, now);
        const baseValue = quote.baseValue;
        const refundLinhThach = quote.refund * copiesToDismantle;
        const newBalance = Number(user.linh_thach || 0) + refundLinhThach;

        const dbOps = [
          supabase.from('users').update({ linh_thach: newBalance, updated_at: now.toISOString() }).eq('user_id', cleanId),
        ];
        if (isBaseProtected) {
          dbOps.push(supabase.from('user_pets').update({ quantity: 1 }).eq('pet_id', matchedPet.pet_id));
        } else {
          dbOps.push(supabase.from('user_pet_items').update({ equipped_to_pet: null, slot: null }).eq('user_id', cleanId).eq('equipped_to_pet', matchedPet.pet_type));
          dbOps.push(supabase.from('user_pets').delete().eq('pet_id', matchedPet.pet_id));
        }
        dbOps.push(trackQuestActivity(cleanId, { craftDelta: 1, now }));
        await Promise.all(dbOps);

        const quoteLine = quote.isShop
          ? `• Giá trị mua Shop: **${baseValue.toLocaleString('vi-VN')}** ${em('su_linhthach')} → Hoàn trả **${quote.refundPct}%**${copiesToDismantle > 1 ? ` (×${copiesToDismantle} bản)` : ''}: **+${refundLinhThach.toLocaleString('vi-VN')}** ${em('su_linhthach')} **Linh Thạch**`
          : `• Nguồn **Gacha / Quà** *(giá phân rã chuẩn chống farm${copiesToDismantle > 1 ? ` ×${copiesToDismantle} bản` : ''})*: **+${refundLinhThach.toLocaleString('vi-VN')}** ${em('su_linhthach')} **Linh Thạch**`;

        return {
          success: true,
          category: 'pet',
          source: quote.source,
          pet_type: matchedPet.pet_type,
          pet_name: matchedPet.pet_name,
          dismantled_count: copiesToDismantle,
          remove_role_id: '',
          remove_role_csv: '',
          base_value: baseValue,
          refund_linh_thach: refundLinhThach,
          linh_thach: newBalance,
          linh_thach_fmt: newBalance.toLocaleString('vi-VN'),
          message: `${em('su_pet_paw')} Đã giải phóng / phân rã **${copiesToDismantle > 1 ? `${copiesToDismantle}× ` : ''}${matchedPet.pet_name}**${isBaseProtected ? ' *(giữ lại 1 bản chính đang dùng)*' : ''}!\n${quoteLine}\n• Số dư hiện tại: **${newBalance.toLocaleString('vi-VN')} Linh Thạch**`,
        };
      }
    }

    return {
      success: false,
      status: 404,
      error: 'DISMANTLE_TARGET_NOT_FOUND',
      remove_role_id: '',
      remove_role_csv: '',
      message: `Không tìm thấy Role, Pháp Bảo hoặc Linh Thú nào khớp \`${rawTarget}\` trong túi đồ \`/inv\`.\n• *Lưu ý: Chỉ những Role/Vật phẩm do Bot cấp qua \`/shop\` hoặc \`/roll\` (có trong \`/inv\`) mới có thể phân rã!*`,
    };
  });
}

export async function setActivePet(userId, petIdentifier) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID người dùng không hợp lệ.' };
  if (!supabase) return { success: false, status: 503, error: 'DB_UNAVAILABLE', message: 'Supabase chưa sẵn sàng.' };

  await ensureUserInitialized(cleanId);
  const { data: pets } = await supabase.from('user_pets').select('*').eq('user_id', cleanId);

  const needle = normalizeEmojiAwareQuery(String(petIdentifier || '').trim()).toLowerCase();
  const target = (pets || []).find((p) =>
    String(p.pet_id) === needle || p.pet_type.toLowerCase() === needle || p.pet_name.toLowerCase() === needle);

  if (!target) {
    return { success: false, status: 404, error: 'PET_NOT_FOUND', message: `Bạn không sở hữu Linh Thú '${petIdentifier}'.` };
  }
  if (target.status === 'exploring') {
    return {
      success: false,
      status: 400,
      error: 'PET_BUSY_EXPLORING',
      message: `${uiEm('ui_compass_dir')} Linh Thú **${target.pet_name}** hiện đang đi **Khám Phá Bản Đồ** (\`/explorer\`) nên chưa thể chọn làm Linh Thú xuất trận! Hãy chọn một Linh Thú khác đang rảnh.`,
    };
  }
  if (target.status === 'injured') {
    return {
      success: false,
      status: 400,
      error: 'PET_INJURED',
      message: `${uiEm('ui_heal_band')} Linh Thú Độc Nhất **${target.pet_name}** đang bị **Trọng Thương**! Hãy dùng **Cửu Chuyển Hoàn Hồn Lộ** trong \`/explorer\` để hồi sinh trước khi xuất trận.`,
    };
  }

  await supabase.from('user_pets').update({ is_active: false }).eq('user_id', cleanId);
  await supabase.from('user_pets').update({ is_active: true }).eq('pet_id', target.pet_id);

  const { syncActiveLoadoutFromCurrentGear } = await import('./loadoutService.js');
  await syncActiveLoadoutFromCurrentGear(cleanId).catch(() => {});
  invalidateInventoryCache(cleanId);

  const grade = normalizeEnchantGrade(target.enchant_grade || 'D');
  return {
    success: true,
    active_pet: { ...target, enchant_grade: grade, is_active: true },
    message: `${petEmoji(target.pet_type, em('su_pet_paw'))} ${gradeEmoji(grade)} Đã xuất trận Linh Thú **${target.pet_name}** (Lv.${target.level} • ${target.star} ${em('su_realm_star')})!`,
  };
}

export const PET_LEVEL_MAX_BONUS_PCT = 5.50; // Lv.1 -> Lv.100 = +550%
export const PET_LEVEL_GROWTH_STEP = PET_LEVEL_MAX_BONUS_PCT / 99; // ~+5.5556%/cấp
export const PET_STAR_GROWTH_STEP = 0.15; // 1★ -> 10★ = +135%

export function computeScaledPetBaseStats(baseMeta = {}, level = 1, star = 1) {
  const lvl = Math.min(100, Math.max(1, Number(level) || 1));
  const st = Math.min(10, Math.max(1, Number(star) || 1));
  const baseAtk = Math.max(10, Number(baseMeta.base_atk ?? baseMeta.atk ?? 100));
  const baseDef = Math.max(10, Number(baseMeta.base_def ?? baseMeta.def ?? 100));
  const baseSpd = Math.max(10, Number(baseMeta.base_spd ?? baseMeta.spd ?? 100));
  const mult = 1 + (lvl - 1) * PET_LEVEL_GROWTH_STEP + (st - 1) * PET_STAR_GROWTH_STEP;
  const atk = Math.max(baseAtk + (lvl - 1) * 5, Math.round(baseAtk * mult));
  const def = Math.max(baseDef + (lvl - 1) * 5, Math.round(baseDef * mult));
  const spd = Math.max(baseSpd + (lvl - 1) * 4, Math.round(baseSpd * mult));
  const power_score = atk * 3 + def * 2 + spd * 2 + lvl * 50;
  return { atk, def, spd, power_score, multiplier: mult };
}

export async function upgradePet(userId, petIdentifier, mode = 'level', targetGoal = null) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID người dùng không hợp lệ.' };
  if (!supabase) return { success: false, status: 503, error: 'DB_UNAVAILABLE', message: 'Supabase chưa sẵn sàng.' };

  const { user } = await ensureUserInitialized(cleanId);
  if (!user) return { success: false, status: 500, error: 'USER_INIT_FAILED', message: 'Không thể khởi tạo hồ sơ.' };
  const { data: pets } = await supabase.from('user_pets').select('*').eq('user_id', cleanId);

  const needle = normalizeEmojiAwareQuery(String(petIdentifier || '').trim()).toLowerCase();
  const target = needle
    ? (pets || []).find((p) => String(p.pet_id) === needle || p.pet_type.toLowerCase() === needle || p.pet_name.toLowerCase() === needle)
    : (pets || []).find((p) => p.is_active) || (pets || [])[0];

  if (!target) {
    return { success: false, status: 404, error: 'PET_NOT_FOUND', message: 'Không tìm thấy Linh Thú để nâng cấp.' };
  }

  const baseMeta = PET_BY_TYPE[target.pet_type] || { base_atk: target.atk, base_def: target.def, base_spd: target.spd };
  const parsedGoal = targetGoal !== null && targetGoal !== undefined && String(targetGoal).trim() !== ''
    ? Math.floor(Number(targetGoal))
    : null;

  if (mode === 'star') {
    const currentStar = Number(target.star || 1);
    const currentLvl = Number(target.level || 1);
    if (currentStar >= 10) {
      return { success: false, status: 400, error: 'MAX_STAR', message: `**${target.pet_name}** đã đạt tối đa **10 Sao** ${em('su_realm_star')}!` };
    }
    const nextStar = parsedGoal !== null
      ? Math.min(10, Math.max(currentStar + 1, parsedGoal))
      : currentStar + 1;

    if (parsedGoal !== null && parsedGoal <= currentStar) {
      return { success: false, status: 400, error: 'INVALID_TARGET_STAR', message: `Mục tiêu Sao (\`${parsedGoal}\`) phải lớn hơn bậc sao hiện tại (**${currentStar}★**)!` };
    }

    let stoneCost = 0;
    let ltCost = 0;
    for (let s = currentStar; s < nextStar; s += 1) {
      stoneCost += s;
      ltCost += s * 200;
    }
    const curScaled = computeScaledPetBaseStats(baseMeta, currentLvl, currentStar);
    const nextScaled = computeScaledPetBaseStats(baseMeta, currentLvl, nextStar);
    const newAtk = Math.max(nextScaled.atk, Number(target.atk || 0) + Math.max(0, nextScaled.atk - curScaled.atk));
    const newDef = Math.max(nextScaled.def, Number(target.def || 0) + Math.max(0, nextScaled.def - curScaled.def));
    const newSpd = Math.max(nextScaled.spd, Number(target.spd || 0) + Math.max(0, nextScaled.spd - curScaled.spd));

    const currentBal = Number(user.linh_thach || 0);
    const { data: stoneRow } = await supabase
      .from('user_inventory')
      .select('quantity')
      .eq('user_id', cleanId)
      .eq('item_id', 'pet_star_stone')
      .maybeSingle();

    const ownedStones = Number(stoneRow?.quantity || 0);
    if (ownedStones < stoneCost || currentBal < ltCost) {
      return {
        success: false,
        status: 400,
        error: 'INSUFFICIENT_MATERIALS',
        message: `Cần **${stoneCost.toLocaleString('vi-VN')}** ${em('pet_star_stone')} **Tinh Thạch Nâng Sao** (có ${ownedStones}) và **${ltCost.toLocaleString('vi-VN')}** ${em('su_linhthach')} **Linh Thạch** (có ${currentBal.toLocaleString('vi-VN')}) để đột phá **${currentStar}★ → ${nextStar}★** ${em('su_realm_star')}!`,
      };
    }

    const oldPower = Number(target.power_score || 0);
    const deltaPower = (newAtk - Number(target.atk || 0)) * 3
      + (newDef - Number(target.def || 0)) * 2
      + (newSpd - Number(target.spd || 0)) * 2;
    const calcPower = newAtk * 3 + newDef * 2 + newSpd * 2 + currentLvl * 50;
    const newPower = Math.max(calcPower, oldPower + Math.max(0, deltaPower));

    await Promise.all([
      supabase.from('user_inventory').update({ quantity: ownedStones - stoneCost }).eq('user_id', cleanId).eq('item_id', 'pet_star_stone'),
      supabase.from('users').update({ linh_thach: currentBal - ltCost }).eq('user_id', cleanId),
      supabase.from('user_pets').update({ star: nextStar, atk: newAtk, def: newDef, spd: newSpd, power_score: newPower }).eq('pet_id', target.pet_id),
    ]);

    return {
      success: true,
      mode: 'star',
      pet_name: target.pet_name,
      old_star: currentStar,
      new_star: nextStar,
      cost_lt: ltCost,
      cost_stones: stoneCost,
      linh_thach: currentBal - ltCost,
      power_score: newPower,
      message: `${em('pet_star_stone')} Đột phá sao thành công! ${petEmoji(target.pet_type, em('su_pet_paw'))} **${target.pet_name}** (**${currentStar}★ → ${nextStar}★** ${em('su_realm_star')}) • Tiêu hao **${ltCost.toLocaleString('vi-VN')}** ${em('su_linhthach')} + **${stoneCost}** ${em('pet_star_stone')} • Chiến Lực: **${newPower.toLocaleString('vi-VN')}**.`,
    };
  }

  // mode === 'level'
  const currentLvl = Number(target.level || 1);
  const currentStar = Number(target.star || 1);
  if (currentLvl >= 100) {
    return { success: false, status: 400, error: 'MAX_PET_LEVEL', message: `**${target.pet_name}** đã đạt cấp tối đa **Lv.100**!` };
  }
  const nextLvl = parsedGoal !== null
    ? Math.min(100, Math.max(currentLvl + 1, parsedGoal))
    : currentLvl + 1;

  if (parsedGoal !== null && parsedGoal <= currentLvl) {
    return { success: false, status: 400, error: 'INVALID_TARGET_LEVEL', message: `Mục tiêu Cấp (\`${parsedGoal}\`) phải lớn hơn cấp hiện tại (**Lv.${currentLvl}**)!` };
  }

  let ltCost = 0;
  for (let lvl = currentLvl; lvl < nextLvl; lvl += 1) {
    ltCost += lvl * 50;
  }
  const curScaled = computeScaledPetBaseStats(baseMeta, currentLvl, currentStar);
  const nextScaled = computeScaledPetBaseStats(baseMeta, nextLvl, currentStar);
  const newAtk = Math.max(nextScaled.atk, Number(target.atk || 0) + Math.max(0, nextScaled.atk - curScaled.atk));
  const newDef = Math.max(nextScaled.def, Number(target.def || 0) + Math.max(0, nextScaled.def - curScaled.def));
  const newSpd = Math.max(nextScaled.spd, Number(target.spd || 0) + Math.max(0, nextScaled.spd - curScaled.spd));

  const currentBal = Number(user.linh_thach || 0);
  if (currentBal < ltCost) {
    return {
      success: false,
      status: 400,
      error: 'INSUFFICIENT_LINH_THACH',
      message: `Cần **${ltCost.toLocaleString('vi-VN')}** ${em('su_linhthach')} **Linh Thạch** để nâng **${target.pet_name}** (**Lv.${currentLvl} → Lv.${nextLvl}**) *(hiện có ${currentBal.toLocaleString('vi-VN')})*.`,
    };
  }

  const oldPower = Number(target.power_score || 0);
  const deltaPower = (newAtk - Number(target.atk || 0)) * 3
    + (newDef - Number(target.def || 0)) * 2
    + (newSpd - Number(target.spd || 0)) * 2
    + (nextLvl - currentLvl) * 50;
  const calcPower = newAtk * 3 + newDef * 2 + newSpd * 2 + nextLvl * 50;
  const newPower = Math.max(calcPower, oldPower + Math.max(0, deltaPower));

  await Promise.all([
    supabase.from('users').update({ linh_thach: currentBal - ltCost }).eq('user_id', cleanId),
    supabase.from('user_pets').update({ level: nextLvl, atk: newAtk, def: newDef, spd: newSpd, power_score: newPower }).eq('pet_id', target.pet_id),
  ]);

  return {
    success: true,
    mode: 'level',
    pet_name: target.pet_name,
    old_level: currentLvl,
    new_level: nextLvl,
    cost_lt: ltCost,
    linh_thach: currentBal - ltCost,
    power_score: newPower,
    message: `${em('su_level_up')} Thăng cấp thành công! ${petEmoji(target.pet_type, em('su_pet_paw'))} **${target.pet_name}** (**Lv.${currentLvl} → Lv.${nextLvl}**) • Tổng chi phí: **-${ltCost.toLocaleString('vi-VN')}** ${em('su_linhthach')} • Chiến Lực: **${newPower.toLocaleString('vi-VN')}**!`,
  };
}

/**
 * Cường hóa Phẩm Chất Khắc Ấn D -> C -> B -> A -> S cho Linh Thú hoặc Pháp Bảo (/enchant)
 * - Dùng Đá Khắc Ấn (enchant_stone) + Linh Thạch
 * - Pity +5%/lần thất bại, KHÔNG BAO GIỜ rớt hạng khi thất bại
 */
export async function enchantTarget(userId, rawTypeOrPayload, rawTargetArg = '', optionsArg = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID người dùng không hợp lệ.' };
  if (!supabase) return { success: false, status: 503, error: 'DB_UNAVAILABLE', message: 'Supabase chưa sẵn sàng.' };

  let targetType = '';
  let rawTarget = '';
  let options = optionsArg || {};
  if (rawTypeOrPayload && typeof rawTypeOrPayload === 'object') {
    targetType = String(rawTypeOrPayload.targetType || rawTypeOrPayload.loai || rawTypeOrPayload.category || '').trim().toLowerCase();
    rawTarget = String(rawTypeOrPayload.targetId || rawTypeOrPayload.mucTieu || rawTypeOrPayload.maId || '').trim();
    options = rawTypeOrPayload;
  } else {
    targetType = String(rawTypeOrPayload || '').trim().toLowerCase();
    rawTarget = String(rawTargetArg || '').trim();
  }

  if (['item', 'equip', 'equipment', 'phapbao', 'weapon', 'gem', 'soul'].includes(targetType)) targetType = 'item';
  else if (['pet', 'linhthu'].includes(targetType)) targetType = 'pet';
  else if (targetType !== '') {
    return { success: false, status: 400, error: 'INVALID_ENCHANT_TYPE', message: 'Loại khắc ấn phải là `pet` (Linh Thú) hoặc `item` (Pháp Bảo).' };
  }

  const normalizedQuery = normalizeEmojiAwareQuery(rawTarget);
  const normLower = normalizeTargetText(normalizedQuery);
  const rng = typeof options.rng === 'function' ? options.rng : Math.random;

  return withDismantleLock(cleanId, async () => {
    const { user } = await ensureUserInitialized(cleanId, {
      username: pickCleanDisplayValue(options.username, options.fallbackUsername),
      avatarUrl: pickCleanDisplayValue(options.avatarUrl),
    });
    if (!user) return { success: false, status: 500, error: 'USER_INIT_FAILED', message: 'Không thể khởi tạo hồ sơ.' };

    const [{ data: userPets }, { data: userItems }, { data: stoneRow }, { data: absStoneRow }, busyExp] = await Promise.all([
      supabase.from('user_pets').select('*').eq('user_id', cleanId),
      supabase.from('user_pet_items').select('*').eq('user_id', cleanId),
      supabase.from('user_inventory').select('quantity').eq('user_id', cleanId).eq('item_id', 'enchant_stone').maybeSingle(),
      supabase.from('user_inventory').select('quantity').eq('user_id', cleanId).eq('item_id', 'enchant_stone_absolute').maybeSingle(),
      getUserBusyExplorationAssets(cleanId),
    ]);

    const pets = userPets || [];
    const items = userItems || [];

    let matchedKind = targetType;
    let targetRow = null;
    let targetName = '';
    let targetIcon = '';

    if (matchedKind === 'pet' || matchedKind === '') {
      const hit = normLower
        ? pets.find((p) =>
          String(p.pet_id) === normalizedQuery
          || p.pet_type.toLowerCase() === normLower
          || normalizeTargetText(p.pet_name) === normLower)
        : (pets.find((p) => p.is_active) || pets[0]);

      if (hit) {
        matchedKind = 'pet';
        targetRow = hit;
        targetName = hit.pet_name;
        targetIcon = petEmoji(hit.pet_type, em('su_pet_paw'));
      }
    }

    if (!targetRow && (matchedKind === 'item' || matchedKind === '')) {
      const hit = normLower
        ? items.find((it) =>
          String(it.id) === normalizedQuery
          || it.item_id.toLowerCase() === normLower
          || normalizeTargetText(EQUIPMENT_BY_ID[it.item_id]?.item_name) === normLower)
        : items[0];

      if (hit) {
        matchedKind = 'item';
        targetRow = hit;
        const meta = EQUIPMENT_BY_ID[hit.item_id] || {};
        targetName = meta.item_name || hit.item_id;
        targetIcon = itemEmoji(hit.item_id, em('su_crossed_swords'));
      }
    }

    if (!targetRow) {
      return {
        success: false,
        status: 404,
        error: 'ENCHANT_TARGET_NOT_FOUND',
        message: `Không tìm thấy Linh Thú hay Pháp Bảo nào khớp \`${rawTarget}\` trong kho của bạn để Khắc Ấn.`,
      };
    }

    // Chặn khắc ấn tài sản đang bận đi Khám Phá (/explorer)
    if (busyExp?.isExploring) {
      if (matchedKind === 'pet' && String(targetRow.pet_id) === String(busyExp.busyPetId)) {
        return { success: false, status: 400, error: 'PET_BUSY_EXPLORING', message: `${uiEm('ui_compass_dir')} Linh Thú **${targetName}** đang đi Khám Phá Bản Đồ — vui lòng chờ hoàn thành rồi mới Khắc Ấn!` };
      }
      if (matchedKind === 'item' && busyExp.busyEquipIds.has(String(targetRow.item_id))) {
        return { success: false, status: 400, error: 'ITEM_BUSY_EXPLORING', message: `${uiEm('ui_compass_dir')} Pháp Bảo **${targetName}** đang được trang bị cho chuyến Khám Phá — vui lòng chờ hoàn thành rồi mới Khắc Ấn!` };
      }
    }

    const currentGrade = normalizeEnchantGrade(targetRow.enchant_grade || 'D');
    const pityCount = Math.max(0, Number(targetRow.enchant_pity) || 0);
    const quote = getEnchantUpgradeQuote(currentGrade, pityCount);

    if (!quote) {
      return {
        success: false,
        status: 400,
        error: 'ALREADY_MAX_GRADE',
        enchant_grade: currentGrade,
        message: `${targetIcon} ${gradeEmoji('S')} **${targetName}** đã đạt Phẩm Chất Khắc Ấn tối thượng **Hạng S (+40% chỉ số)** rồi!`,
      };
    }

    // Hỗ trợ dùng Thiên Đạo Tuyệt Ấn Thạch (enchant_stone_absolute — 100% mọi bậc D->S, khuyến cáo giữ dùng A->S!)
    const wantAbsolute = Boolean(
      options.useAbsoluteStone
      || options.use_absolute
      || ['absolute', 'tuyet_doi', '100', 'true', 'yes'].includes(String(options.stoneType || options.loai_da || options.da_tuyet_doi || '').trim().toLowerCase()),
    );
    const ownedAbsStones = Number(absStoneRow?.quantity || 0);

    if (wantAbsolute) {
      if (ownedAbsStones < 1) {
        return {
          success: false,
          status: 400,
          error: 'NO_ABSOLUTE_STONE',
          message: `Bạn hiện không có ${em('enchant_stone_absolute')} **Thiên Đạo Tuyệt Ấn Thạch** nào trong túi! *(Rơi 0.5% khi đi khám phá \`/explorer\`)*`,
        };
      }
      const newGrade = quote.to;
      const remainingAbs = ownedAbsStones - 1;
      const nowIso = new Date().toISOString();
      const dbTasks = [
        supabase.from('user_inventory').update({ quantity: remainingAbs, updated_at: nowIso }).eq('user_id', cleanId).eq('item_id', 'enchant_stone_absolute'),
      ];
      if (matchedKind === 'pet') {
        dbTasks.push(supabase.from('user_pets').update({ enchant_grade: newGrade, enchant_pity: 0 }).eq('pet_id', targetRow.pet_id));
      } else {
        dbTasks.push(supabase.from('user_pet_items').update({ enchant_grade: newGrade, enchant_pity: 0 }).eq('id', targetRow.id));
      }
      dbTasks.push(trackQuestActivity(cleanId, { craftDelta: 1 }));
      await Promise.all(dbTasks);

      const oldBonus = getEnchantBonusPct(currentGrade);
      const newBonus = getEnchantBonusPct(newGrade);
      const advisory = currentGrade !== 'A'
        ? `\n• ${uiEm('ui_bulb_tip')} *Khuyến cáo: ${em('enchant_stone_absolute')} **Thiên Đạo Tuyệt Ấn Thạch** cực hiếm (0.5%) — lần sau đạo hữu nên ưu tiên giữ lại để đột phá bậc **A → S** nhé!*`
        : '';

      return {
        success: true,
        upgraded: true,
        used_absolute_stone: true,
        target_type: matchedKind,
        target_id: matchedKind === 'pet' ? targetRow.pet_type : targetRow.item_id,
        target_name: targetName,
        old_grade: currentGrade,
        new_grade: newGrade,
        enchant_grade: newGrade,
        enchant_bonus_pct: newBonus,
        pity_count: 0,
        applied_rate_pct: 100,
        remaining_absolute_stones: remainingAbs,
        message: [
          `${em('enchant_stone_absolute')} **THIÊN ĐẠO TUYỆT ẤN — ĐỘT PHÁ 100% THÀNH CÔNG!**`,
          `• ${targetIcon} **${targetName}**: ${gradeEmoji(currentGrade)} **Hạng ${currentGrade}** (+${oldBonus}%) → ${gradeEmoji(newGrade)} **Hạng ${newGrade}** (**+${newBonus}% chỉ số gốc**)!`,
          `• Tiêu hao: **-1** ${em('enchant_stone_absolute')} **Thiên Đạo Tuyệt Ấn Thạch** *(còn ${remainingAbs})* — Miễn phí Linh Thạch!`,
        ].join('\n') + advisory,
      };
    }

    const ownedStones = Number(stoneRow?.quantity || 0);
    const currentBal = Number(user.linh_thach || 0);
    if (ownedStones < quote.stones || currentBal < quote.lt) {
      return {
        success: false,
        status: 400,
        error: 'INSUFFICIENT_MATERIALS',
        required_stones: quote.stones,
        owned_stones: ownedStones,
        required_lt: quote.lt,
        linh_thach: currentBal,
        message: [
          `Không đủ nguyên liệu Khắc Ấn **${targetName}** (${gradeEmoji(currentGrade)} **${currentGrade}** → ${gradeEmoji(quote.to)} **${quote.to}** • Tỉ lệ **${quote.effectiveRate}%**)!`,
          `• Cần: **${quote.stones}** ${em('enchant_stone')} **Đá Khắc Ấn** *(hiện có ${ownedStones})* & **${quote.lt.toLocaleString('vi-VN')}** ${em('su_linhthach')} **Linh Thạch** *(hiện có ${currentBal.toLocaleString('vi-VN')})*`,
          `• Mua thêm Đá Khắc Ấn trong \`/shop\` (` + '`150 LT`' + `, tối đa 5/ngày) hoặc săn **Boss Tháp mỗi 5 tầng**!`,
        ].join('\n'),
      };
    }

    const rollPct = rng() * 100;
    const upgraded = rollPct < quote.effectiveRate;
    const newGrade = upgraded ? quote.to : currentGrade;
    const newPity = upgraded ? 0 : (pityCount + 1);
    const nextQuote = getEnchantUpgradeQuote(newGrade, newPity);

    const remainingStones = ownedStones - quote.stones;
    const remainingLt = currentBal - quote.lt;
    const nowIso = new Date().toISOString();

    const dbTasks = [
      supabase.from('user_inventory').update({ quantity: remainingStones, updated_at: nowIso }).eq('user_id', cleanId).eq('item_id', 'enchant_stone'),
      supabase.from('users').update({ linh_thach: remainingLt, updated_at: nowIso }).eq('user_id', cleanId),
    ];

    if (matchedKind === 'pet') {
      dbTasks.push(
        supabase.from('user_pets').update({ enchant_grade: newGrade, enchant_pity: newPity }).eq('pet_id', targetRow.pet_id),
      );
    } else {
      dbTasks.push(
        supabase.from('user_pet_items').update({ enchant_grade: newGrade, enchant_pity: newPity }).eq('id', targetRow.id),
      );
    }
    dbTasks.push(trackQuestActivity(cleanId, { craftDelta: 1 }));
    await Promise.all(dbTasks);

    const oldBonus = getEnchantBonusPct(currentGrade);
    const newBonus = getEnchantBonusPct(newGrade);

    const message = upgraded
      ? [
          `${em('su_sparkle')} **KHẮC ẤN ĐỘT PHÁ THÀNH CÔNG!**`,
          `• ${targetIcon} **${targetName}**: ${gradeEmoji(currentGrade)} **Hạng ${currentGrade}** (+${oldBonus}%) → ${gradeEmoji(newGrade)} **Hạng ${newGrade}** (**+${newBonus}% chỉ số gốc**)!`,
          `• Tiêu hao: **-${quote.stones}** ${em('enchant_stone')} (${remainingStones} còn lại) • **-${quote.lt.toLocaleString('vi-VN')}** ${em('su_linhthach')} (${remainingLt.toLocaleString('vi-VN')} LT)`,
          nextQuote ? `• Lượt kế (**${newGrade} → ${nextQuote.to}**): Tỉ lệ **${nextQuote.effectiveRate}%** (${nextQuote.stones} Đá + ${nextQuote.lt} LT).` : `• ${gradeEmoji('S')} **ĐÃ ĐẠT ĐỈNH CAO HẠNG S (+40%)!**`,
        ].join('\n')
      : [
          `${em('enchant_stone')} **Khắc Ấn Thất Bại — Không Tụt Hạng!**`,
          `• ${targetIcon} **${targetName}** giữ nguyên ${gradeEmoji(currentGrade)} **Hạng ${currentGrade}** *(tỉ lệ vừa quay: ${quote.effectiveRate}%)*`,
          `• Tích lũy **Pity +5%** → Tỉ lệ lần kế (${quote.from} → ${quote.to}): **${nextQuote?.effectiveRate || quote.effectiveRate}%** *(Pity ×${newPity})*`,
          `• Tiêu hao: **-${quote.stones}** ${em('enchant_stone')} (${remainingStones} còn lại) • **-${quote.lt.toLocaleString('vi-VN')}** ${em('su_linhthach')} (${remainingLt.toLocaleString('vi-VN')} LT)`,
        ].join('\n');

    return {
      success: true,
      upgraded,
      target_type: matchedKind,
      target_id: matchedKind === 'pet' ? targetRow.pet_type : targetRow.item_id,
      target_name: targetName,
      old_grade: currentGrade,
      new_grade: newGrade,
      enchant_grade: newGrade,
      enchant_bonus_pct: newBonus,
      pity_count: newPity,
      applied_rate_pct: quote.effectiveRate,
      next_rate_pct: nextQuote ? nextQuote.effectiveRate : 100,
      stones_used: quote.stones,
      lt_spent: quote.lt,
      remaining_stones: remainingStones,
      linh_thach: remainingLt,
      linh_thach_fmt: remainingLt.toLocaleString('vi-VN'),
      message,
    };
  });
}
