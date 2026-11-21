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
  LEVEL_ROLE_MILESTONES,
  BACKGROUND_CATALOG,
  BACKGROUND_BY_ID,
  SHOP_CONSUMABLES,
  MARRY_RING_BY_ID,
  AVATAR_FRAME_BY_ID,
  FUYUMI_USER_ID,
  MYTHIC_UNIQUE_ITEM_IDS,
  ENCHANT_GRADES,
  ENCHANT_UPGRADE_CONFIG,
  normalizeEnchantGrade,
  getEnchantBonusPct,
  getEnchantUpgradeQuote,
  formatRarityLabel,
  normalizeRarityKey,
} from '../data/catalog.js';
import {
  em,
  itemEmoji,
  petEmoji,
  tierEmoji,
  roleTierEmoji,
  gradeEmoji,
  ringEmoji,
} from '../config/emojiHelper.js';
import { invalidateUniqueItemCard } from './staticAssetCacheService.js';

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
    if (EQUIPMENT_BY_ID[stripped] || PET_BY_TYPE[stripped] || MARRY_RING_BY_ID[stripped]) {
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

export function toSuperscriptCount(n, minDigits = 3) {
  const val = Math.max(1, Math.floor(Number(n) || 1));
  const str = String(val).padStart(minDigits, '0');
  return [...str].map((ch) => SUPERSCRIPT_DIGITS[Number(ch)] || ch).join('');
}

function chunkEmojiGrid(tokens = [], perRow = 5, emptyText = '• Trống', maxChars = 1500) {
  if (!tokens.length) return emptyText;
  const rows = [];
  for (let i = 0; i < tokens.length; i += perRow) {
    rows.push(tokens.slice(i, i + perRow).join('\u2003 '));
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

  const { user } = await ensureUserInitialized(cleanId, {
    username: pickCleanDisplayValue(options.username, options.fallbackUsername),
    avatarUrl: pickCleanDisplayValue(options.avatarUrl),
  });
  if (!user) return { success: false, status: 500, error: 'USER_INIT_FAILED', message: 'Không thể khởi tạo hồ sơ.' };

  const viewRaw = String(options.view || 'overview').trim().toLowerCase();
  const view = ['overview', 'roles', 'items', 'pets', 'consumables'].includes(viewRaw) ? viewRaw : 'overview';

  const [petsRes, itemsRes, rolesRes, invRes] = await Promise.all([
    supabase.from('user_pets').select('*').eq('user_id', cleanId).order('is_active', { ascending: false }).order('power_score', { ascending: false }),
    supabase.from('v_user_equipped_items').select('*').eq('user_id', cleanId),
    supabase.from('user_roles').select('*').eq('user_id', cleanId).order('is_equipped', { ascending: false }),
    supabase.from('user_inventory').select('*').eq('user_id', cleanId).gt('quantity', 0),
  ]);

  const SHOP_CONS_BY_ID = Object.fromEntries(SHOP_CONSUMABLES.map((c) => [c.item_id, c]));

  const pets = sortPetList((petsRes.data || []).map((p) => {
    const grade = normalizeEnchantGrade(p.enchant_grade || 'D');
    return {
      ...p,
      enchant_grade: grade,
      enchant_bonus_pct: getEnchantBonusPct(grade),
      grade_icon: gradeEmoji(grade),
      icon: petEmoji(p.pet_type, em('su_fox_mascot')),
      tier_icon: tierEmoji((PET_BY_TYPE[p.pet_type]?.rarity_key) || 'common'),
    };
  }), options.petSort || 'power_desc');

  const items = (itemsRes.data || []).map((row) => {
    const catMeta = EQUIPMENT_BY_ID[row.item_id] || {};
    const grade = normalizeEnchantGrade(row.enchant_grade || 'D');
    return {
      ...row,
      ...catMeta,
      enchant_grade: grade,
      enchant_bonus_pct: getEnchantBonusPct(grade),
      grade_icon: gradeEmoji(grade),
      icon: itemEmoji(row.item_id, em('su_crossed_swords')),
      tier_icon: tierEmoji(catMeta.rarity_key || 'common'),
    };
  });

  const now = new Date();
  const rawRoles = rolesRes.data || [];
  const expiredEquippedIds = rawRoles
    .filter((r) => !r.is_permanent && r.expires_at && new Date(r.expires_at) <= now && r.is_equipped)
    .map((r) => r.id);

  if (expiredEquippedIds.length > 0) {
    await supabase
      .from('user_roles')
      .update({ is_equipped: false, equipped_slot: null })
      .in('id', expiredEquippedIds);
  }

  const activeRoles = rawRoles.filter((r) => r.is_permanent || !r.expires_at || new Date(r.expires_at) > now);

  const roles = activeRoles.map((r) => {
    const roleMeta = ROLE_BY_ID[r.role_id];
    const rarityKey = roleMeta?.rarity_key || 'common';
    return {
      ...r,
      rarity_key: rarityKey,
      rarity: roleMeta?.rarity || 'Phàm Phẩm',
      icon: roleTierEmoji(rarityKey),
      duration_label: formatRoleDurationLabel(r, now),
    };
  });

  const consumables = (invRes.data || []).map((inv) => {
    const cMeta = SHOP_CONS_BY_ID[inv.item_id] || MARRY_RING_BY_ID[inv.item_id];
    const bgMeta = BACKGROUND_BY_ID[inv.item_id];
    const frameMeta = inv.item_id.startsWith('frame_') ? AVATAR_FRAME_BY_ID[inv.item_id.slice(6)] : null;
    const icon = cMeta?.icon || (MARRY_RING_BY_ID[inv.item_id] ? ringEmoji(inv.item_id) : (bgMeta || frameMeta) ? em('su_frame_token') : em('su_pin_sigil'));
    const displayName = cMeta?.name || bgMeta?.name || (frameMeta ? `Khung ${frameMeta.name}` : inv.item_id);
    return {
      ...inv,
      icon,
      display_name: displayName,
    };
  });

  const bgRaw = user.background_url || 'default_background.png';
  const bgObj = BACKGROUND_BY_ID[bgRaw] || BACKGROUND_CATALOG.find((b) => b.file === bgRaw || `assets/${b.file}` === bgRaw);
  const bgName = bgObj?.name || (bgRaw.includes('celestial_palace_pink') ? 'Thiên Cung Cửu Vĩ' : 'Đạo Cảnh Mặc Định');

  const activePets = pets.filter((p) => p.is_active);
  const storagePets = pets.filter((p) => !p.is_active);
  const slotRank = { weapon: 1, gem: 2, soul: 3 };
  const equippedItems = items
    .filter((it) => it.equipped_to_pet || it.slot)
    .sort((a, b) => (slotRank[a.item_type] || 9) - (slotRank[b.item_type] || 9));
  const storageItems = items.filter((it) => !it.equipped_to_pet && !it.slot);

  const petGrid = buildDividerEmojiGrid(
    activePets.map((p) => `${p.icon}${toSuperscriptCount(p.quantity || 1)}`),
    storagePets.map((p) => `${p.icon}${toSuperscriptCount(p.quantity || 1)}`),
    5,
    '• Chưa có Linh Thú nào.',
    1400,
  );
  const itemGrid = buildDividerEmojiGrid(
    equippedItems.map((it) => `${it.icon}${toSuperscriptCount(it.quantity || 1)}`),
    storageItems.map((it) => `${it.icon}${toSuperscriptCount(it.quantity || 1)}`),
    5,
    '• Chưa có Pháp Bảo nào.',
    1400,
  );
  const consumableGrid = chunkEmojiGrid(
    consumables.map((c) => `${c.icon}${toSuperscriptCount(c.quantity || 1)}`),
    5,
    '• Chưa có vật phẩm tiêu hao nào.',
    1400,
  );

  const summaryPetsDetailed = pets.length
    ? (() => {
      const out = [];
      let totalLen = 0;
      let omitted = 0;
      for (const p of pets) {
        const qtyTag = (Number(p.quantity) || 1) > 1 ? ` ×**${p.quantity}**` : '';
        const line = `• ${p.icon} ${p.grade_icon} **${p.pet_name}**${qtyTag} (\`${p.pet_type}\`) — Lv.${p.level} • **${p.star}★** • Lực ${(Number(p.power_score) || 0).toLocaleString('vi-VN')}${p.is_active ? ' *(Đang xuất trận)*' : ''}`;
        if (totalLen + line.length + 1 > 3700) { omitted += 1; continue; }
        out.push(line);
        totalLen += line.length + 1;
      }
      if (omitted > 0) out.push(`• *... và ${omitted} Linh Thú nữa*`);
      return out.join('\n');
    })()
    : '• Chưa có Linh Thú nào.';

  const summaryItemsDetailed = items.length
    ? (() => {
      const out = [];
      let totalLen = 0;
      let omitted = 0;
      for (const it of items) {
        const qtyTag = (Number(it.quantity) || 1) > 1 ? ` ×**${it.quantity}**` : '';
        const line = `• ${it.icon} ${it.grade_icon} **${it.item_name}**${qtyTag} (\`${it.item_id}\`) • ${it.tier_icon} ${it.rarity}${it.equipped_to_pet ? ' *(Đang trang bị)*' : ''}`;
        if (totalLen + line.length + 1 > 3700) { omitted += 1; continue; }
        out.push(line);
        totalLen += line.length + 1;
      }
      if (omitted > 0) out.push(`• *... và ${omitted} Pháp Bảo nữa (gõ \`/phapbao\` để lọc)*`);
      return out.join('\n');
    })()
    : '• Chưa có Pháp Bảo nào.';

  const summaryConsumablesDetailed = consumables.length
    ? consumables.map((c) => `• ${c.icon} **${c.display_name}** (\`${c.item_id}\`) × **${c.quantity}**`).join('\n').slice(0, 3750)
    : '• Chưa có vật phẩm mở khóa nào.';

  const summaryRolesCompact = buildRoleListText(roles, now, { maxChars: 950, maxItems: 10, overflowHint: 'gõ `/roles` để xem đầy đủ' });
  const summaryRolesFull = buildRoleListText(roles, now, { maxChars: 3750 });

  const summaryPets = `${petGrid}\n*Ghi chú: Trước dấu **|** là Linh Thú xuất trận • Dùng \`/linhthu\` hoặc \`/info <emoji>\`*`;
  const summaryItems = `${itemGrid}\n*Ghi chú: Trước dấu **|** là Pháp Bảo đang trang bị • Dùng \`/phapbao\` hoặc \`/info <emoji>\`*`;
  const summaryConsumables = consumableGrid;
  const summaryRoles = summaryRolesCompact;

  const headerLine = `${em('su_linhthach')} **Linh Thạch:** \`${Number(user.linh_thach || 0).toLocaleString('vi-VN')}\` • **Ảnh Nền:** ${bgName} • **Slot Role:** \`${getMaxRoleSlotsByLevel(user.level || 1)}\``;

  let viewTitle = `${em('su_wiki_scroll')} TÚI ĐỒ TIÊN GIỚI`;
  let viewDescription = '';
  if (view === 'pets') {
    viewTitle = `${em('su_pet_paw')} KHO LINH THÚ (${pets.length})`;
    viewDescription = summaryPetsDetailed;
  } else if (view === 'items') {
    viewTitle = `${em('su_crossed_swords')} KHO PHÁP BẢO (${items.length})`;
    viewDescription = summaryItemsDetailed;
  } else if (view === 'roles') {
    viewTitle = `${em('su_medal_role')} KHO ROLE QUYỀN NĂNG (${roles.length})`;
    viewDescription = summaryRolesFull;
  } else if (view === 'consumables') {
    viewTitle = `${em('su_enchant_stone')} VẬT PHẨM TIÊU HAO & MỞ KHÓA (${consumables.length})`;
    viewDescription = summaryConsumablesDetailed;
  } else {
    const sections = [
      headerLine,
      '',
      `**${em('su_pet_paw')} Linh Thú (${pets.length})**`,
      petGrid,
      '',
      `**${em('su_crossed_swords')} Pháp Bảo (${items.length})**`,
      itemGrid,
      '',
      `**${em('su_enchant_stone')} Vật Phẩm Tiêu Hao & Mở Khóa (${consumables.length})**`,
      consumableGrid,
      '',
      `**${em('su_medal_role')} Role Quyền Năng (${roles.length})**`,
      summaryRolesCompact,
      '',
      `*Mẹo: Chọn Menu trên để chuyển tab chi tiết, hoặc copy thẳng emoji vào \`/info\`, \`/equip\`, \`/enchant\`, \`/dismantle\`!*`,
    ];
    viewDescription = sections.join('\n').slice(0, 3950);
  }

  return {
    success: true,
    view,
    view_title: viewTitle,
    view_description: viewDescription,
    user: {
      user_id: cleanId,
      username: user.username,
      level: user.level,
      linh_thach: Number(user.linh_thach || 0),
      linh_thach_fmt: Number(user.linh_thach || 0).toLocaleString('vi-VN'),
      max_role_slots: getMaxRoleSlotsByLevel(user.level || 1),
      background_url: bgRaw,
      background_name: bgName,
      marry_ring_id: user.marry_ring_id || null,
    },
    pets,
    equipment_items: items,
    roles,
    consumables_and_unlocks: consumables,
    summary_pets: summaryPets,
    summary_items: summaryItems,
    summary_roles: summaryRoles,
    summary_consumables: summaryConsumables,
    summary_pets_detailed: summaryPetsDetailed,
    summary_items_detailed: summaryItemsDetailed,
    summary_roles_full: summaryRolesFull,
  };
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

  let summaryLines = [];
  let charCount = 0;
  let omitted = 0;
  for (const it of list) {
    const slotTag = it.item_type === 'weapon' ? 'Vũ Khí' : it.item_type === 'gem' ? 'Bảo Ngọc' : 'Chiến Hồn';
    const eqTag = it.is_equipped ? ' **(Đang trang bị)**' : '';
    const qtyTag = (Number(it.quantity) || 1) > 1 ? ` ×**${it.quantity}**` : '';
    const line = `• ${it.icon} ${it.grade_icon} **${it.item_name}**${qtyTag} (\`${it.item_id}\`) • ${it.tier_icon} ${it.rarity} *(${slotTag})*${eqTag}`;
    if (charCount + line.length + 1 > 3750) {
      omitted += 1;
    } else {
      summaryLines.push(line);
      charCount += line.length + 1;
    }
  }
  if (omitted > 0) {
    summaryLines.push(`• *... và ${omitted} Pháp Bảo nữa (dùng bộ lọc ở trên để xem chi tiết từng loại)*`);
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
    sort: sortMode,
    slot: slotFilter,
    items: list,
    filter_summary: `Bộ lọc: **${filterLabelMap[slotFilter] || 'Tất Cả'}** • Sắp xếp: **${sortLabelMap[sortMode] || 'Phẩm Cao → Thấp'}** • Tổng: **${list.length} món**`,
    summary_equipment: summaryLines.join('\n'),
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
      const rarityKey = roleMeta?.rarity_key || 'common';
      const remMs = r.is_permanent ? Infinity : (r.expires_at ? Math.max(0, new Date(r.expires_at).getTime() - now.getTime()) : 0);
      return {
        ...r,
        rarity_key: rarityKey,
        rarity: roleMeta?.rarity || 'Phàm Phẩm',
        perk: r.role_perk || roleMeta?.perk || '',
        icon: roleTierEmoji(rarityKey),
        duration_label: formatRoleDurationLabel(r, now),
        remaining_ms: remMs,
      };
    });

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
  const lines = [];
  let charCount = 0;
  let omitted = 0;
  for (const r of roles) {
    const slotTag = r.is_equipped ? ` • **Slot #${r.equipped_slot}/${maxSlots}**` : '';
    const line = `• ${r.icon} **${r.role_name}** (\`${r.role_id}\`) • ${r.rarity} • ${r.duration_label}${slotTag}${r.perk ? `\n  *${r.perk}*` : ''}`;
    if (charCount + line.length + 1 > 3750) {
      omitted += 1;
    } else {
      lines.push(line);
      charCount += line.length + 1;
    }
  }
  if (omitted > 0) lines.push(`• *... và ${omitted} Role khác (dùng bộ lọc ở trên để xem chi tiết)*`);
  if (!lines.length) lines.push('• Chưa có Role Quyền Năng nào khớp bộ lọc. Mua tại `/shop` hoặc quay `/roll loai:role`!');

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
    total_count: roles.length,
    equipped_count: equippedCount,
    max_role_slots: maxSlots,
    roles,
    filter_summary: `Slot đang đeo: **${equippedCount}/${maxSlots}** • Bộ lọc: **${filterMode}** • Tổng: **${roles.length} Role**`,
    summary: lines.join('\n'),
  };
}

export async function equipTarget(userId, payload = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID người dùng không hợp lệ.' };
  if (!supabase) return { success: false, status: 503, error: 'DB_UNAVAILABLE', message: 'Supabase chưa sẵn sàng.' };

  const category = String(payload.category || '').toLowerCase();
  const rawTargetId = String(payload.targetId || '').trim();
  const normalizedInput = (category === 'role' || category === 'title') ? rawTargetId : normalizeEmojiAwareQuery(rawTargetId);
  let targetId = normalizedInput;
  if (category === 'item' && !EQUIPMENT_BY_ID[targetId]) {
    const normIn = normalizeTargetText(normalizedInput);
    const byName = Object.values(EQUIPMENT_BY_ID).find((x) => x.item_id.toLowerCase() === normIn || normalizeTargetText(x.item_name) === normIn);
    if (byName) targetId = byName.item_id;
  }
  const { user } = await ensureUserInitialized(cleanId);
  if (!user) return { success: false, status: 500, error: 'USER_INIT_FAILED', message: 'Không thể khởi tạo hồ sơ.' };

  if (category === 'item') {
    const itemMeta = EQUIPMENT_BY_ID[targetId];
    if (!itemMeta) return { success: false, status: 404, error: 'ITEM_NOT_FOUND', message: `Không tìm thấy pháp bảo '${targetId}'.` };

    const { data: own } = await supabase
      .from('user_pet_items')
      .select('id, equipped_to_pet, slot')
      .eq('user_id', cleanId)
      .eq('item_id', targetId)
      .maybeSingle();

    if (!own) return { success: false, status: 404, error: 'ITEM_NOT_OWNED', message: `Bạn chưa sở hữu **${itemMeta.item_name}**.` };

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

    const targetRole = (userRoles || []).find((r) => r.role_id === targetId || r.role_name === targetId);
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
      message: `${em('su_frame_token')} Đã đổi ảnh nền Profile & Rank sang **${bg.name}**!`,
    };
  }

  if (category === 'frame') {
    const frameKey = targetId.toLowerCase();
    if (frameKey === 'celestial_fox_gold') {
      if (cleanId !== FUYUMI_USER_ID) {
        return { success: false, status: 403, error: 'EXCLUSIVE_FRAME', message: 'Khung viền **Cửu Vĩ Hoàng Kim** là đặc quyền độc tôn của Tiểu thư Fuyumi!' };
      }
      await supabase.from('users').update({ avatar_frame: 'celestial_fox_gold', updated_at: new Date().toISOString() }).eq('user_id', cleanId);
      return { success: true, category: 'frame', avatar_frame: 'celestial_fox_gold', message: `${em('su_frame_token')} Đã trang bị khung viền **Cửu Vĩ Hoàng Kim**!` };
    }

    const frameMeta = AVATAR_FRAME_BY_ID[frameKey];
    if (!frameMeta) {
      const validIds = Object.keys(AVATAR_FRAME_BY_ID).join('`, `');
      return { success: false, status: 404, error: 'FRAME_NOT_FOUND', message: `Không tìm thấy khung viền '${targetId}'. Mã hợp lệ: \`${validIds}\`.` };
    }

    if (frameKey === 'default') {
      await supabase.from('users').update({ avatar_frame: 'default', updated_at: new Date().toISOString() }).eq('user_id', cleanId);
      return { success: true, category: 'frame', avatar_frame: 'default', message: `${em('su_frame_token')} Đã khôi phục khung viền Avatar mặc định theo cảnh giới.` };
    }

    const unlockItemId = `frame_${frameKey}`;
    const { data: unlocked } = await supabase
      .from('user_inventory')
      .select('quantity')
      .eq('user_id', cleanId)
      .eq('item_id', unlockItemId)
      .maybeSingle();

    if (!unlocked || Number(unlocked.quantity || 0) < 1) {
      const { data: tokenRow } = await supabase
        .from('user_inventory')
        .select('quantity')
        .eq('user_id', cleanId)
        .eq('item_id', 'frame_unlock_token')
        .maybeSingle();

      if (!tokenRow || Number(tokenRow.quantity || 0) < 1) {
        return {
          success: false,
          status: 403,
          error: 'FRAME_TOKEN_REQUIRED',
          message: `Bạn cần **1 Lệnh Bài Khung Viền Độc Bản** (\`frame_unlock_token\`) trong \`/shop\` để mở khóa khung **${frameMeta.name}**!`,
        };
      }

      const nowIso = new Date().toISOString();
      await Promise.all([
        supabase
          .from('user_inventory')
          .update({ quantity: Number(tokenRow.quantity) - 1, updated_at: nowIso })
          .eq('user_id', cleanId)
          .eq('item_id', 'frame_unlock_token'),
        supabase.from('user_inventory').upsert({
          user_id: cleanId,
          item_id: unlockItemId,
          item_category: 'frame_unlock',
          quantity: 1,
          updated_at: nowIso,
        }, { onConflict: 'user_id,item_id' }),
      ]);
    }

    await supabase
      .from('users')
      .update({ avatar_frame: frameKey, updated_at: new Date().toISOString() })
      .eq('user_id', cleanId);

    return {
      success: true,
      category: 'frame',
      avatar_frame: frameKey,
      message: `${em('su_frame_token')} Đã mở khóa và trang bị khung Avatar **${frameMeta.name}**!`,
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
      message: `${em('su_title_card')} Đã đổi Danh Hiệu Tu Tiên thành **« ${cleanTitle} »**!`,
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
      message: `${em('su_frame_token')} Đã khôi phục ảnh nền Đạo Cảnh Mặc Định.`,
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
      message: `${em('su_frame_token')} Đã tháo khung viền, khôi phục về khung mặc định theo cảnh giới.`,
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
  const category = ['role', 'item', 'pet'].includes(rawCat) ? rawCat : '';
  const rawTarget = String(payload.targetId || payload.maId || '').trim();
  if (!rawTarget) {
    return {
      success: false,
      status: 400,
      error: 'MISSING_TARGET',
      remove_role_id: '',
      message: 'Vui lòng nhập Mã ID, tên Role/Pháp Bảo/Linh Thú hoặc số Slot #1–5 muốn phá (xem trong `/inv`).',
    };
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
          const isBaseProtected = Boolean(p.is_active || p.pet_type === 'hoa_thach_nham_nham' || p.pet_type === 'cuu_vi_hong_ho');
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
          || allUserPets.length <= 1
        );

        if (qty <= 1) {
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

  await supabase.from('user_pets').update({ is_active: false }).eq('user_id', cleanId);
  await supabase.from('user_pets').update({ is_active: true }).eq('pet_id', target.pet_id);

  const grade = normalizeEnchantGrade(target.enchant_grade || 'D');
  return {
    success: true,
    active_pet: { ...target, enchant_grade: grade, is_active: true },
    message: `${petEmoji(target.pet_type, em('su_pet_paw'))} ${gradeEmoji(grade)} Đã xuất trận Linh Thú **${target.pet_name}** (Lv.${target.level} • ${target.star} ${em('su_realm_star')})!`,
  };
}

export async function upgradePet(userId, petIdentifier, mode = 'level') {
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

  if (mode === 'star') {
    const currentStar = Number(target.star || 1);
    if (currentStar >= 10) {
      return { success: false, status: 400, error: 'MAX_STAR', message: `**${target.pet_name}** đã đạt tối đa **10 Sao** ${em('su_realm_star')}!` };
    }
    const stoneCost = currentStar;
    const ltCost = currentStar * 200;
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
        message: `Cần **${stoneCost}** ${em('su_star_stone')} **Tinh Thạch Nâng Sao** (có ${ownedStones}) và **${ltCost}** ${em('su_linhthach')} **Linh Thạch** (có ${currentBal}) để đột phá **${currentStar + 1} Sao** ${em('su_realm_star')}!`,
      };
    }

    const nextStar = currentStar + 1;
    const newAtk = Math.round(target.atk + baseMeta.base_atk * 0.15);
    const newDef = Math.round(target.def + baseMeta.base_def * 0.15);
    const newSpd = Math.round(target.spd + baseMeta.base_spd * 0.15);
    const oldPower = Number(target.power_score || 0);
    const deltaPower = (newAtk - Number(target.atk || 0)) * 3
      + (newDef - Number(target.def || 0)) * 2
      + (newSpd - Number(target.spd || 0)) * 2;
    const calcPower = newAtk * 3 + newDef * 2 + newSpd * 2 + Number(target.level || 1) * 50;
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
      linh_thach: currentBal - ltCost,
      power_score: newPower,
      message: `${em('su_star_stone')} Đột phá sao thành công! ${petEmoji(target.pet_type, em('su_pet_paw'))} **${target.pet_name}** lên **${nextStar} Sao** ${em('su_realm_star')} (Chiến Lực: **${newPower.toLocaleString('vi-VN')}**).`,
    };
  }

  // mode === 'level'
  const currentLvl = Number(target.level || 1);
  if (currentLvl >= 100) {
    return { success: false, status: 400, error: 'MAX_PET_LEVEL', message: `**${target.pet_name}** đã đạt cấp tối đa **Lv.100**!` };
  }
  const ltCost = currentLvl * 50;
  const currentBal = Number(user.linh_thach || 0);
  if (currentBal < ltCost) {
    return {
      success: false,
      status: 400,
      error: 'INSUFFICIENT_LINH_THACH',
      message: `Cần **${ltCost}** ${em('su_linhthach')} **Linh Thạch** để nâng **${target.pet_name}** lên Lv.${currentLvl + 1} (hiện có ${currentBal}).`,
    };
  }

  const nextLvl = currentLvl + 1;
  const newAtk = Math.round(target.atk + Math.max(5, baseMeta.base_atk * 0.05));
  const newDef = Math.round(target.def + Math.max(5, baseMeta.base_def * 0.05));
  const newSpd = Math.round(target.spd + Math.max(4, baseMeta.base_spd * 0.05));
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
    linh_thach: currentBal - ltCost,
    power_score: newPower,
    message: `${em('su_level_up')} Thăng cấp thành công! ${petEmoji(target.pet_type, em('su_pet_paw'))} **${target.pet_name}** đạt **Lv.${nextLvl}** (Chiến Lực: **${newPower.toLocaleString('vi-VN')}**).`,
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

    const [{ data: userPets }, { data: userItems }, { data: stoneRow }] = await Promise.all([
      supabase.from('user_pets').select('*').eq('user_id', cleanId),
      supabase.from('user_pet_items').select('*').eq('user_id', cleanId),
      supabase.from('user_inventory').select('quantity').eq('user_id', cleanId).eq('item_id', 'enchant_stone').maybeSingle(),
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
          `• Cần: **${quote.stones}** ${em('su_enchant_stone')} **Đá Khắc Ấn** *(hiện có ${ownedStones})* & **${quote.lt.toLocaleString('vi-VN')}** ${em('su_linhthach')} **Linh Thạch** *(hiện có ${currentBal.toLocaleString('vi-VN')})*`,
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
    await Promise.all(dbTasks);

    const oldBonus = getEnchantBonusPct(currentGrade);
    const newBonus = getEnchantBonusPct(newGrade);

    const message = upgraded
      ? [
          `${em('su_sparkle')} **KHẮC ẤN ĐỘT PHÁ THÀNH CÔNG!**`,
          `• ${targetIcon} **${targetName}**: ${gradeEmoji(currentGrade)} **Hạng ${currentGrade}** (+${oldBonus}%) → ${gradeEmoji(newGrade)} **Hạng ${newGrade}** (**+${newBonus}% chỉ số gốc**)!`,
          `• Tiêu hao: **-${quote.stones}** ${em('su_enchant_stone')} (${remainingStones} còn lại) • **-${quote.lt.toLocaleString('vi-VN')}** ${em('su_linhthach')} (${remainingLt.toLocaleString('vi-VN')} LT)`,
          nextQuote ? `• Lượt kế (**${newGrade} → ${nextQuote.to}**): Tỉ lệ **${nextQuote.effectiveRate}%** (${nextQuote.stones} Đá + ${nextQuote.lt} LT).` : `• ${gradeEmoji('S')} **ĐÃ ĐẠT ĐỈNH CAO HẠNG S (+40%)!**`,
        ].join('\n')
      : [
          `${em('su_enchant_stone')} **Khắc Ấn Thất Bại — Không Tụt Hạng!**`,
          `• ${targetIcon} **${targetName}** giữ nguyên ${gradeEmoji(currentGrade)} **Hạng ${currentGrade}** *(tỉ lệ vừa quay: ${quote.effectiveRate}%)*`,
          `• Tích lũy **Pity +5%** → Tỉ lệ lần kế (${quote.from} → ${quote.to}): **${nextQuote?.effectiveRate || quote.effectiveRate}%** *(Pity ×${newPity})*`,
          `• Tiêu hao: **-${quote.stones}** ${em('su_enchant_stone')} (${remainingStones} còn lại) • **-${quote.lt.toLocaleString('vi-VN')}** ${em('su_linhthach')} (${remainingLt.toLocaleString('vi-VN')} LT)`,
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
