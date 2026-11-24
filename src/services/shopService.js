/**
 * src/services/shopService.js
 * Hệ thống Cửa Hàng Tiên Giới (/shop):
 * - 6 Danh Mục: Nhẫn Cưới (4), Linh Thú Phàm/Linh (26), Pháp Bảo Phàm/Linh (45),
 *   Role Quyền Năng Tiện Ích (9 gói x 7d/30d/Vĩnh Viễn), Vật Phẩm Tiêu Hao (7), Background Profile/Rank (20).
 * - Lưu tạm lựa chọn vào Supabase shop_selections để Button [Mua Ngay] / [Thuê 7/30 Ngày / Vĩnh Viễn]
 *   thực thi chính xác theo {user_id}, kèm per-user async lock chống bấm đúp.
 */

import { supabase } from '../config/supabase.js';
import {
  MARRY_RINGS,
  MARRY_RING_BY_ID,
  SHOP_PETS,
  SHOP_EQUIPMENT,
  SHOP_CONSUMABLES,
  SHOP_CONSUMABLE_BY_ID,
  SHOP_ROLE_PACKAGES,
  SHOP_ROLE_BY_ID,
  BACKGROUND_CATALOG,
  BACKGROUND_BY_ID,
  AVATAR_FRAMES,
  AVATAR_FRAME_BY_ID,
  PUBLIC_BASE_URL,
  rollDefaultEnchantGrade,
  getCosmeticBuffByRarity,
} from '../data/catalog.js';
import {
  em,
  ringEmoji,
  tierEmoji,
  tierEmojiKey,
  roleTierEmoji,
  petEmoji,
  itemEmoji,
  elementEmoji,
  gradeEmoji,
} from '../config/emojiHelper.js';
import { resolvePublicAssetPath } from '../canvas/drawUtils.js';

function getVnDateKey(date = new Date()) {
  const vnTime = new Date(date.getTime() + 7 * 3600 * 1000);
  return vnTime.toISOString().slice(0, 10);
}
import {
  ROLE_PERKS_MAP,
  sanitizeUserId,
  ensureUserInitialized,
  pickCleanDisplayValue,
  getMaxRoleSlotsByLevel,
  computeRoleBuffTotals,
  sanitizeRolePerkForDb,
} from './profileService.js';
import { trackQuestActivity } from './questService.js';

function applyShopDiscount(price, discountPct) {
  const p = Number(price || 0);
  const pct = Number(discountPct || 0);
  if (p <= 0 || pct <= 0) return p;
  return Math.max(1, Math.round(p * (1 - pct / 100)));
}

export const SHOP_CATEGORIES = ['rings', 'pets', 'equipment', 'roles', 'consumables', 'backgrounds', 'frames'];

const SHOP_PETS_BY_ID = Object.fromEntries(SHOP_PETS.map((p) => [p.pet_type, p]));
const SHOP_EQUIP_BY_ID = Object.fromEntries(SHOP_EQUIPMENT.map((e) => [e.item_id, e]));

const shopLocks = new Map();
const memSelections = new Map();
const memMessageSelections = new Map();

function sanitizeShopMessageId(rawId) {
  const s = String(rawId || '').trim();
  if (!s || /^\{.+\}$/.test(s) || s.length > 64) return '';
  return s;
}

async function withShopLock(userId, fn) {
  const prev = shopLocks.get(userId) || Promise.resolve();
  let release;
  const current = new Promise((res) => { release = res; });
  const queued = prev.then(() => current);
  shopLocks.set(userId, queued);
  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (shopLocks.get(userId) === queued) shopLocks.delete(userId);
  }
}

function resolveShopEntry(category, itemId) {
  const rawCat = String(category || '').trim().toLowerCase();
  const rawId = String(itemId || '').trim();
  if (!rawId) return null;

  const tryCats = rawCat && SHOP_CATEGORIES.includes(rawCat) ? [rawCat] : SHOP_CATEGORIES;
  for (const c of tryCats) {
    if (c === 'rings' && MARRY_RING_BY_ID[rawId]) {
      return { category: 'rings', item_id: rawId, item: MARRY_RING_BY_ID[rawId] };
    }
    if (c === 'pets' && SHOP_PETS_BY_ID[rawId]) {
      return { category: 'pets', item_id: rawId, item: SHOP_PETS_BY_ID[rawId] };
    }
    if (c === 'equipment' && SHOP_EQUIP_BY_ID[rawId]) {
      return { category: 'equipment', item_id: rawId, item: SHOP_EQUIP_BY_ID[rawId] };
    }
    if (c === 'roles' && SHOP_ROLE_BY_ID[rawId]) {
      return { category: 'roles', item_id: rawId, item: SHOP_ROLE_BY_ID[rawId] };
    }
    if (c === 'consumables' && SHOP_CONSUMABLE_BY_ID[rawId]) {
      return { category: 'consumables', item_id: rawId, item: SHOP_CONSUMABLE_BY_ID[rawId] };
    }
    if (c === 'backgrounds' && BACKGROUND_BY_ID[rawId] && BACKGROUND_BY_ID[rawId].price > 0) {
      return { category: 'backgrounds', item_id: rawId, item: BACKGROUND_BY_ID[rawId] };
    }
    if (c === 'frames' && AVATAR_FRAME_BY_ID[rawId] && AVATAR_FRAME_BY_ID[rawId].price > 0) {
      return { category: 'frames', item_id: rawId, item: AVATAR_FRAME_BY_ID[rawId] };
    }
  }
  return null;
}

function normalizeEquippedBgId(rawBg) {
  const raw = String(rawBg || '').trim();
  if (!raw) return 'default_background.png';
  if (BACKGROUND_BY_ID[raw]) return raw;
  const matched = BACKGROUND_CATALOG.find((b) => b.file === raw || `assets/${b.file}` === raw);
  return matched?.bg_id || raw;
}

function buildCategorySummary(cat, page = 1, ownershipCtx = {}) {
  const lt = em('su_linhthach');
  const ownedBgSet = ownershipCtx.ownedBgSet || new Set();
  const equippedBgId = ownershipCtx.equippedBgId || '';
  const ownedFrameSet = ownershipCtx.ownedFrameSet || new Set();
  const equippedFrameId = ownershipCtx.equippedFrameId || '';

  if (cat === 'rings') {
    return MARRY_RINGS.map((r) =>
      `• ${ringEmoji(r.item_id)} **${r.name}** *(${r.rarity})* — **${r.price.toLocaleString('vi-VN')}** ${lt} • +${r.exp_bonus_pct}% EXP & +${r.power_bonus_pct}% Chiến Lực`
    ).join('\n');
  }
  if (cat === 'pets') {
    const pageSize = 24;
    const totalPages = Math.max(1, Math.ceil(SHOP_PETS.length / pageSize));
    const safePage = Math.min(Math.max(1, Number(page) || 1), totalPages);
    const slice = SHOP_PETS.slice((safePage - 1) * pageSize, safePage * pageSize);
    const footer = totalPages > 1 ? `\n• *Trang **${safePage}/${totalPages}** (tổng ${SHOP_PETS.length} Linh Thú • tối đa 24 mục/trang)*` : '';
    return slice.map((p) =>
      `• ${petEmoji(p.pet_type)} **${p.pet_name}** *(${p.rarity} • ${p.element})* — **${p.price.toLocaleString('vi-VN')}** ${lt} • \`${p.base_atk}/${p.base_def}/${p.base_spd}\``
    ).join('\n') + footer;
  }
  if (cat === 'equipment') {
    const pageSize = 12;
    const totalPages = Math.max(1, Math.ceil(SHOP_EQUIPMENT.length / pageSize));
    const safePage = Math.min(Math.max(1, Number(page) || 1), totalPages);
    const slice = SHOP_EQUIPMENT.slice((safePage - 1) * pageSize, safePage * pageSize);
    return slice.map((e) =>
      `• ${itemEmoji(e.item_id)} **${e.item_name}** *(${e.rarity} • ${e.item_type})* — **${e.price.toLocaleString('vi-VN')}** ${lt}`
    ).join('\n') + `\n• *Trang **${safePage}/${totalPages}** — tổng cộng ${SHOP_EQUIPMENT.length} Pháp Bảo Phàm & Linh Phẩm*`;
  }
  if (cat === 'roles') {
    return SHOP_ROLE_PACKAGES.map((r) =>
      `• ${roleTierEmoji(r.rarity_key)} **${r.name}** — ${r.perk} • \`7d: ${r.prices['7d']}\` | \`30d: ${r.prices['30d']}\` | \`Vĩnh viễn: ${r.prices.permanent.toLocaleString('vi-VN')}\` ${lt}`
    ).join('\n');
  }
  if (cat === 'consumables') {
    return SHOP_CONSUMABLES.map((c) =>
      `• ${c.icon} **${c.name}** — **${c.price.toLocaleString('vi-VN')}** ${lt}\n  *${c.description}*`
    ).join('\n');
  }
  if (cat === 'backgrounds') {
    const bgs = BACKGROUND_CATALOG.filter((b) => b.price > 0);
    const pageSize = 10;
    const totalPages = Math.max(1, Math.ceil(bgs.length / pageSize));
    const safePage = Math.min(Math.max(1, Number(page) || 1), totalPages);
    const slice = bgs.slice((safePage - 1) * pageSize, safePage * pageSize);
    return slice.map((b) => {
      const bBuff = getCosmeticBuffByRarity(b.rarity_key, true);
      const buffTag = ` (+${bBuff.expPct}% EXP/LT)`;
      const statusTag = b.bg_id === equippedBgId
        ? ' • **[Đang trang bị]**'
        : ownedBgSet.has(b.bg_id)
          ? ' • **[Đã sở hữu]**'
          : ` — **${b.price.toLocaleString('vi-VN')}** ${lt}`;
      return `• ${tierEmoji(b.rarity_key)} **${b.name}**${buffTag}${statusTag}`;
    }).join('\n') + `\n\n• *Trang **${safePage}/${totalPages}** — Buff trang bị: Phàm +2% • Linh +4% • Tiên +7% • Thần Thoại +10% EXP & LT (cộng dồn Viền + Nền tới +20%)*`;
  }
  if (cat === 'frames') {
    const frames = AVATAR_FRAMES.filter((f) => f.price > 0);
    const pageSize = 10;
    const totalPages = Math.max(1, Math.ceil(frames.length / pageSize));
    const safePage = Math.min(Math.max(1, Number(page) || 1), totalPages);
    const slice = frames.slice((safePage - 1) * pageSize, safePage * pageSize);
    return slice.map((f) => {
      const fBuff = getCosmeticBuffByRarity(f.rarity_key, true);
      const buffTag = ` (+${fBuff.expPct}% EXP/LT)`;
      const statusTag = f.frame_id === equippedFrameId
        ? ' • **[Đang trang bị]**'
        : ownedFrameSet.has(f.frame_id)
          ? ' • **[Đã sở hữu]**'
          : ` — **${f.price.toLocaleString('vi-VN')}** ${lt}`;
      return `• ${tierEmoji(f.rarity_key)} **${f.name}**${buffTag}${statusTag}`;
    }).join('\n') + `\n\n• *Trang **${safePage}/${totalPages}** — Buff trang bị: Phàm +2% • Linh +4% • Tiên +7% • Thần Thoại +10% EXP & LT (cộng dồn Viền + Nền tới +20%)*`;
  }
  return '';
}

/**
 * Lấy danh mục hàng hóa /shop
 */
export async function getShopCatalog(category = 'all', options = {}) {
  const cat = String(category || 'all').trim().toLowerCase();
  const cleanUserId = sanitizeUserId(options.userId || '');
  let balance = null;
  const ownershipCtx = {
    ownedBgSet: new Set(),
    equippedBgId: '',
    ownedFrameSet: new Set(),
    equippedFrameId: '',
  };

  if (cleanUserId && supabase) {
    const { user } = await ensureUserInitialized(cleanUserId, {
      username: pickCleanDisplayValue(options.username, options.fallbackUsername),
      avatarUrl: pickCleanDisplayValue(options.avatarUrl),
    });
    if (user) {
      balance = Number(user.linh_thach || 0);
      ownershipCtx.equippedBgId = normalizeEquippedBgId(user.background_url);
      ownershipCtx.equippedFrameId = String(user.avatar_frame || 'default').trim();
      if (cat === 'backgrounds') {
        const { data: bgRows } = await supabase
          .from('user_inventory')
          .select('item_id')
          .eq('user_id', cleanUserId)
          .gt('quantity', 0);
        for (const r of bgRows || []) {
          if (BACKGROUND_BY_ID[r.item_id]) ownershipCtx.ownedBgSet.add(r.item_id);
        }
        if (ownershipCtx.equippedBgId && ownershipCtx.equippedBgId !== 'default_background.png') {
          ownershipCtx.ownedBgSet.add(ownershipCtx.equippedBgId);
        }
      } else if (cat === 'frames') {
        const [{ data: frRows }, { data: tokRow }] = await Promise.all([
          supabase.from('user_frames').select('frame_id').eq('user_id', cleanUserId),
          supabase.from('user_inventory').select('quantity').eq('user_id', cleanUserId).eq('item_id', 'frame_unlock_token').gt('quantity', 0).maybeSingle(),
        ]);
        for (const r of frRows || []) {
          if (r.frame_id) ownershipCtx.ownedFrameSet.add(r.frame_id);
        }
        if (tokRow) {
          for (const lf of ['frame_royal_legacy', 'jade_lotus', 'amethyst_celestial', 'crimson_phoenix', 'frost_crystal']) {
            ownershipCtx.ownedFrameSet.add(lf);
          }
        }
        if (ownershipCtx.equippedFrameId && AVATAR_FRAME_BY_ID[ownershipCtx.equippedFrameId]) {
          ownershipCtx.ownedFrameSet.add(ownershipCtx.equippedFrameId);
        }
      }
    }
  }

  const paidBgs = BACKGROUND_CATALOG.filter((b) => b.price > 0);
  const paidFrames = AVATAR_FRAMES.filter((f) => f.price > 0);
  const catalogData = {
    rings: MARRY_RINGS,
    pets: SHOP_PETS,
    equipment: SHOP_EQUIPMENT,
    roles: SHOP_ROLE_PACKAGES,
    consumables: SHOP_CONSUMABLES,
    backgrounds: paidBgs,
    frames: paidFrames,
  };

  if (cat && cat !== 'all' && !SHOP_CATEGORIES.includes(cat)) {
    return { success: false, status: 404, error: 'CATEGORY_NOT_FOUND', message: `Danh mục '${category}' không tồn tại.` };
  }

  const pageSize = cat === 'equipment' ? 12 : (cat === 'backgrounds' || cat === 'frames') ? 10 : 24;
  const fullCatItems = (cat && cat !== 'all') ? (catalogData[cat] || []) : [];
  const totalPages = Math.max(1, Math.ceil(fullCatItems.length / pageSize));
  const safePage = Math.min(Math.max(1, parseInt(options.page || '1', 10) || 1), totalPages);
  const pageItems = fullCatItems.slice((safePage - 1) * pageSize, safePage * pageSize).slice(0, 25);

  const summaryText = cat === 'all' || !cat
    ? [
        `${em('su_linhthach')} **CHÀO MỪNG ĐẾN VỚI TIÊN BẢO CÁC (SHOP SUMI FAMILY)**`,
        balance !== null ? `• Số dư hiện tại: **${balance.toLocaleString('vi-VN')}** ${em('su_linhthach')} **Linh Thạch**` : '',
        '',
        `• **Nhẫn Cưới (4 cấp)**: Kết duyên Tiên Lữ, tăng EXP & Chiến Lực đôi.`,
        `• **Linh Thú (${SHOP_PETS.length} loài)**: Mua thẳng Pet Phàm Phẩm & Linh Phẩm.`,
        `• **Pháp Bảo (${SHOP_EQUIPMENT.length} món)**: Vũ Khí, Bảo Ngọc, Chiến Hồn Phàm & Linh Phẩm.`,
        `• **Role Quyền Năng (${SHOP_ROLE_PACKAGES.length} gói)**: Thuê \`7 Ngày\`, \`30 Ngày\` hoặc mua \`Vĩnh Viễn\`.`,
        `• **Vật Phẩm Tiêu Hao (${SHOP_CONSUMABLES.length} món)**: Vé Gacha, **3 Lọ Luck Potion**, Tinh Thạch Nâng Sao, Đá Khắc Ấn, Thẻ Reset Tháp, Thẻ Đổi Danh Hiệu.`,
        `• **Background Hồ Sơ (${paidBgs.length} mẫu)**: Đổi ảnh nền thẻ \`/profile\` & \`/rank\`.`,
        `• **Viền Avatar (${paidFrames.length} mẫu)**: Đổi khung viền trên \`/profile\`, \`/rank\`, \`/battle\` & \`/linhmach\`.`,
        `• **Phường Đổ Thạch (20 Nguyên Thạch)**: Mua & cắt Đá Thô săn Linh Thạch / Tối Thượng tại \`/dothach\`.`,
      ].filter((x) => x !== undefined).join('\n')
    : buildCategorySummary(cat, safePage, ownershipCtx);

  return {
    success: true,
    category: cat || 'all',
    balance,
    balance_fmt: balance !== null ? balance.toLocaleString('vi-VN') : '',
    summary_text: summaryText,
    ...(cat && cat !== 'all'
      ? {
          items: fullCatItems,
          page: safePage,
          total_pages: totalPages,
          page_items: pageItems,
          dropdown_options: pageItems.slice(0, 25).map((it) => ({
            label: String(it.name || it.item_name || it.pet_name || it.item_id || it.pet_type || '').slice(0, 100),
            value: String(it.item_id || it.pet_type || it.role_id || it.bg_id || it.frame_id || '').slice(0, 100),
            emoji_key: (cat === 'backgrounds' || cat === 'frames') ? tierEmojiKey(it.rarity_key) : undefined,
          })),
        }
      : { categories: catalogData }),
  };
}

/**
 * Xem trước chi tiết 1 vật phẩm trong /shop & lưu lựa chọn vào shop_selections
 */
export async function previewShopItem(userId, category, itemId, opts = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID người dùng không hợp lệ.' };

  const resolved = resolveShopEntry(category, itemId);
  if (!resolved) {
    return {
      success: false,
      status: 404,
      error: 'SHOP_ITEM_NOT_FOUND',
      message: `Vật phẩm '${itemId}' không được bán trong Cửa Hàng (hoặc là vật phẩm độc quyền Gacha /roll).`,
    };
  }

  let balance = 0;
  let alreadyOwned = false;
  let ownedNote = '';
  let shopDiscountPct = 0;

  if (supabase) {
    const { user } = await ensureUserInitialized(cleanId, {
      username: pickCleanDisplayValue(opts.username, opts.fallbackUsername),
      avatarUrl: pickCleanDisplayValue(opts.avatarUrl),
    });
    if (!user) return { success: false, status: 500, error: 'USER_INIT_FAILED', message: 'Không thể khởi tạo hồ sơ.' };
    balance = Number(user.linh_thach || 0);
    const roleBuffs = await computeRoleBuffTotals(cleanId, Number(user.level || 1));
    shopDiscountPct = Number(roleBuffs?.shopDiscountPct || 0);

    const cleanMsgId = sanitizeShopMessageId(opts.messageId);
    if (cleanMsgId) {
      try {
        await supabase
          .from('shop_message_selections')
          .upsert({
            user_id: cleanId,
            message_id: cleanMsgId,
            category: resolved.category,
            item_id: resolved.item_id,
            created_at: new Date().toISOString(),
          }, { onConflict: 'user_id,message_id' });
      } catch {
        memMessageSelections.set(`${cleanId}:${cleanMsgId}`, { category: resolved.category, item_id: resolved.item_id });
      }
    }

    await supabase
      .from('shop_selections')
      .upsert({
        user_id: cleanId,
        category: resolved.category,
        item_id: resolved.item_id,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (resolved.category === 'pets') {
      const { data: own } = await supabase.from('user_pets').select('pet_id').eq('user_id', cleanId).eq('pet_type', resolved.item_id).maybeSingle();
      if (own) { alreadyOwned = true; ownedNote = '*(Đã sở hữu Linh Thú này)*'; }
    } else if (resolved.category === 'equipment') {
      const { data: own } = await supabase.from('user_pet_items').select('id').eq('user_id', cleanId).eq('item_id', resolved.item_id).maybeSingle();
      if (own) { alreadyOwned = true; ownedNote = '*(Đã sở hữu Pháp Bảo này)*'; }
    } else if (resolved.category === 'backgrounds') {
      const { data: own } = await supabase.from('user_inventory').select('quantity').eq('user_id', cleanId).eq('item_id', resolved.item_id).gt('quantity', 0).maybeSingle();
      const isEquipped = normalizeEquippedBgId(user.background_url) === resolved.item_id;
      if (isEquipped) {
        alreadyOwned = true;
        ownedNote = '*(Đang trang bị)*';
      } else if (own) {
        alreadyOwned = true;
        ownedNote = '*(Đã sở hữu — bấm Mua Ngay để Trang Bị 0 LT hoặc dùng `/equip`)*';
      }
    } else if (resolved.category === 'frames') {
      const [{ data: ownFrame }, { data: legacyTok }] = await Promise.all([
        supabase.from('user_frames').select('frame_id').eq('user_id', cleanId).eq('frame_id', resolved.item_id).maybeSingle(),
        supabase.from('user_inventory').select('quantity').eq('user_id', cleanId).eq('item_id', 'frame_unlock_token').gt('quantity', 0).maybeSingle(),
      ]);
      const LEGACY_GRANTED = new Set(['frame_royal_legacy', 'jade_lotus', 'amethyst_celestial', 'crimson_phoenix', 'frost_crystal']);
      const isEquipped = String(user.avatar_frame || '').trim() === resolved.item_id;
      if (isEquipped) {
        alreadyOwned = true;
        ownedNote = '*(Đang trang bị)*';
      } else if (ownFrame || (legacyTok && LEGACY_GRANTED.has(resolved.item_id))) {
        alreadyOwned = true;
        ownedNote = '*(Đã sở hữu — bấm Mua Ngay để Trang Bị 0 LT hoặc dùng `/equip`)*';
      }
    } else if (resolved.category === 'roles') {
      const { data: own } = await supabase.from('user_roles').select('*').eq('user_id', cleanId).eq('role_id', resolved.item_id).maybeSingle();
      if (own?.is_permanent) {
        alreadyOwned = true;
        ownedNote = '*(Đã sở hữu Vĩnh Viễn)*';
      } else if (own?.expires_at && new Date(own.expires_at) > new Date()) {
        const expDate = new Date(new Date(own.expires_at).getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10);
        ownedNote = `*(Đang có hiệu lực đến ${expDate} — mua thêm để cộng dồn)*`;
      }
    } else {
      const { data: own } = await supabase.from('user_inventory').select('quantity').eq('user_id', cleanId).eq('item_id', resolved.item_id).maybeSingle();
      if (own && own.quantity > 0) {
        ownedNote = `*(Trong túi đang có ×${own.quantity})*`;
      }
    }
  } else {
    const cleanMsgId = sanitizeShopMessageId(opts.messageId);
    if (cleanMsgId) {
      memMessageSelections.set(`${cleanId}:${cleanMsgId}`, { category: resolved.category, item_id: resolved.item_id });
    }
    memSelections.set(cleanId, { category: resolved.category, item_id: resolved.item_id });
  }

  const lt = em('su_linhthach');
  const it = resolved.item;
  const disc = (base) => applyShopDiscount(base, shopDiscountPct);
  const discTag = shopDiscountPct > 0 ? ` *(Giảm ${shopDiscountPct}% Role)*` : '';
  let title = '';
  let description = '';
  let imageUrl = '';
  let price = 0;
  let color = '#ec4899';

  if (resolved.category === 'rings') {
    price = disc(it.price);
    title = `${ringEmoji(it.item_id)} ${it.name}`;
    imageUrl = `${PUBLIC_BASE_URL}/assets/${resolvePublicAssetPath(`rings/${it.item_id}.png`)}`;
    color = it.rarity_key === 'mythic' ? '#f59e0b' : it.rarity_key === 'epic' ? '#a855f7' : it.rarity_key === 'rare' ? '#3b82f6' : '#94a3b8';
    description = [
      `${tierEmoji(it.rarity_key)} **Phẩm Cấp**: **${it.rarity}** ${ownedNote}`.trim(),
      `${lt} **Giá bán**: **${price.toLocaleString('vi-VN')} Linh Thạch**${discTag} *(Số dư: ${balance.toLocaleString('vi-VN')})*`,
      `${em('su_sparkle')} **Hiệu ứng**: ${it.description}`,
      `${em('su_wiki_scroll')} Dùng cho \`/marry\` hoặc nâng cấp nhẫn đang đeo.`,
    ].join('\n');
  } else if (resolved.category === 'pets') {
    price = disc(it.price);
    title = `${petEmoji(it.pet_type)} ${it.pet_name}`;
    imageUrl = `${PUBLIC_BASE_URL}/api/wiki/pet/${it.pet_type}.webp`;
    color = it.rarity_key === 'rare' ? '#3b82f6' : '#94a3b8';
    description = [
      `${tierEmoji(it.rarity_key)} **${it.rarity}** • ${elementEmoji(it.element)} Hệ **${it.element}** ${ownedNote}`.trim(),
      `${lt} **Giá bán**: **${price.toLocaleString('vi-VN')} Linh Thạch**${discTag} *(Số dư: ${balance.toLocaleString('vi-VN')})*`,
      `${em('su_stats_chart')} **Chỉ số gốc**: \`ATK ${it.base_atk} | DEF ${it.base_def} | SPD ${it.base_spd} | HP ${it.base_hp.toLocaleString('vi-VN')}\``,
      `${em('su_thunder_hax')} **HAX (${it.hax_skill})**: ${it.hax_description}`,
    ].join('\n');
  } else if (resolved.category === 'equipment') {
    price = disc(it.price);
    title = `${itemEmoji(it.item_id)} ${it.item_name}`;
    imageUrl = `${PUBLIC_BASE_URL}/api/wiki/item/${it.item_id}.webp`;
    color = it.rarity_key === 'rare' ? '#3b82f6' : '#94a3b8';
    const statParts = [
      it.bonus_atk ? `ATK+${it.bonus_atk}` : '',
      it.bonus_def ? `DEF+${it.bonus_def}` : '',
      it.bonus_spd ? `SPD${it.bonus_spd > 0 ? '+' : ''}${it.bonus_spd}` : '',
      it.bonus_hp ? `HP+${it.bonus_hp.toLocaleString('vi-VN')}` : '',
      it.bonus_crit ? `CRIT+${it.bonus_crit}%` : '',
    ].filter(Boolean).join(' • ');
    description = [
      `${tierEmoji(it.rarity_key)} **${it.rarity}** • ${elementEmoji(it.element)} Hệ **${it.element}** ${ownedNote}`.trim(),
      `${lt} **Giá bán**: **${price.toLocaleString('vi-VN')} Linh Thạch**${discTag} *(Số dư: ${balance.toLocaleString('vi-VN')})*`,
      `${em('su_stats_chart')} **Chỉ số**: \`${statParts}\``,
      `${em('su_sparkle')} ${it.hax_description}`,
    ].join('\n');
  } else if (resolved.category === 'roles') {
    price = disc(it.prices['7d']);
    title = `${roleTierEmoji(it.rarity_key)} ${it.name}`;
    color = '#a855f7';
    description = [
      `${roleTierEmoji(it.rarity_key)} **${it.rarity}** • **Đặc quyền**: ${it.perk} ${ownedNote}`.trim(),
      `${lt} **Bảng giá gói Role**${discTag} *(Số dư: ${balance.toLocaleString('vi-VN')})*:`,
      `• **7 Ngày**: \`${disc(it.prices['7d']).toLocaleString('vi-VN')}\` Linh Thạch`,
      `• **30 Ngày**: \`${disc(it.prices['30d']).toLocaleString('vi-VN')}\` Linh Thạch`,
      `• **Vĩnh Viễn**: \`${disc(it.prices.permanent).toLocaleString('vi-VN')}\` Linh Thạch`,
      `${em('su_wiki_scroll')} Tự động đeo vào Slot trống & cấp Role trên Discord.`,
    ].join('\n');
  } else if (resolved.category === 'consumables') {
    price = disc(it.price);
    title = `${it.icon} ${it.name}`;
    imageUrl = it.image_file
      ? `${PUBLIC_BASE_URL}/assets/${it.image_file}?v=1.6`
      : `${PUBLIC_BASE_URL}/assets/${resolvePublicAssetPath(`shop/${it.item_id}.png`)}`;
    color = '#38bdf8';
    description = [
      `${em('pet_star_stone')} **Vật Phẩm Tu Tiên** ${ownedNote}`.trim(),
      `${lt} **Giá bán**: **${price.toLocaleString('vi-VN')} Linh Thạch**${discTag} *(Số dư: ${balance.toLocaleString('vi-VN')})*`,
      `${em('su_sparkle')} ${it.description}`,
    ].join('\n');
  } else if (resolved.category === 'backgrounds') {
    const bgBuff = getCosmeticBuffByRarity(it.rarity_key, it.price > 0);
    price = disc(it.price);
    title = `${tierEmoji(it.rarity_key)} ${it.name}`;
    imageUrl = `${PUBLIC_BASE_URL}/assets/${resolvePublicAssetPath(it.file)}`;
    color = it.rarity_key === 'mythic' ? '#f59e0b' : it.rarity_key === 'epic' ? '#a855f7' : '#3b82f6';
    description = [
      `${tierEmoji(it.rarity_key)} Ảnh Nền \`/profile\` & \`/rank\` ${ownedNote}`.trim(),
      `${em('su_level_up')} **Buff khi trang bị**: **+${bgBuff.expPct}% EXP & +${bgBuff.ltPct}% Linh Thạch** *(cộng dồn với Viền Avatar)*`,
      alreadyOwned
        ? `${lt} **Trạng thái**: **Đã sở hữu** *(Bấm **Mua Ngay** để đổi sang mẫu này với giá **0 LT**)*`
        : `${lt} **Giá bán**: **${price.toLocaleString('vi-VN')} Linh Thạch**${discTag} *(Số dư: ${balance.toLocaleString('vi-VN')})*`,
      `${em('su_wiki_scroll')} Hoặc dùng lệnh: \`/equip ma_id:${it.bg_id}\``,
    ].join('\n');
  } else if (resolved.category === 'frames') {
    const frBuff = getCosmeticBuffByRarity(it.rarity_key, it.price > 0);
    price = disc(it.price);
    title = `${tierEmoji(it.rarity_key)} ${it.name}`;
    imageUrl = `${PUBLIC_BASE_URL}/api/shop/frame-preview/${it.frame_id}.png`;
    color = it.rarity_key === 'mythic' ? '#f59e0b' : it.rarity_key === 'epic' ? '#a855f7' : '#3b82f6';
    description = [
      `${tierEmoji(it.rarity_key)} Khung Viền Avatar \`/profile\`, \`/rank\`, \`/battle\`, \`/linhmach\` ${ownedNote}`.trim(),
      `${em('su_level_up')} **Buff khi trang bị**: **+${frBuff.expPct}% EXP & +${frBuff.ltPct}% Linh Thạch** *(cộng dồn với Ảnh Nền)*`,
      alreadyOwned
        ? `${lt} **Trạng thái**: **Đã sở hữu** *(Bấm **Mua Ngay** để đeo viền này với giá **0 LT**)*`
        : `${lt} **Giá bán**: **${price.toLocaleString('vi-VN')} Linh Thạch**${discTag} *(Số dư: ${balance.toLocaleString('vi-VN')})*`,
      `${em('su_sparkle')} ${it.description}`,
      `${em('su_wiki_scroll')} Hoặc dùng lệnh: \`/equip ma_id:${it.frame_id}\``,
    ].join('\n');
  }

  return {
    success: true,
    category: resolved.category,
    item_id: resolved.item_id,
    title,
    description,
    color,
    image_url: imageUrl,
    price: alreadyOwned && (resolved.category === 'backgrounds' || resolved.category === 'frames') ? 0 : price,
    shop_discount_pct: shopDiscountPct,
    balance,
    balance_fmt: balance.toLocaleString('vi-VN'),
    already_owned: alreadyOwned,
    can_afford: alreadyOwned && (resolved.category === 'backgrounds' || resolved.category === 'frames') ? true : balance >= price,
    is_role_package: resolved.category === 'roles',
  };
}

/**
 * Mua vật phẩm trong /shop (nhận itemId trực tiếp hoặc đọc từ shop_selections đã xem trước)
 */
export async function buyShopItem(userId, payload = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID người dùng không hợp lệ.' };
  if (!supabase) return { success: false, status: 503, error: 'DB_UNAVAILABLE', message: 'Supabase chưa sẵn sàng.' };

  return withShopLock(cleanId, async () => {
    const { user } = await ensureUserInitialized(cleanId, {
      username: pickCleanDisplayValue(payload.username, payload.fallbackUsername),
      avatarUrl: pickCleanDisplayValue(payload.avatarUrl),
    });
    if (!user) return { success: false, status: 500, error: 'USER_INIT_FAILED', message: 'Không thể khởi tạo hồ sơ.' };

    let targetCategory = payload.category || '';
    let targetItemId = payload.itemId || '';
    const cleanMsgId = sanitizeShopMessageId(payload.messageId);

    if (!targetItemId && cleanMsgId) {
      const { data: msgSel } = await supabase
        .from('shop_message_selections')
        .select('category, item_id')
        .eq('user_id', cleanId)
        .eq('message_id', cleanMsgId)
        .maybeSingle();
      if (msgSel?.item_id) {
        targetCategory = msgSel.category;
        targetItemId = msgSel.item_id;
      } else if (memMessageSelections.has(`${cleanId}:${cleanMsgId}`)) {
        const ms = memMessageSelections.get(`${cleanId}:${cleanMsgId}`);
        targetCategory = ms.category;
        targetItemId = ms.item_id;
      }
    }

    if (!targetItemId) {
      const { data: sel } = await supabase
        .from('shop_selections')
        .select('category, item_id')
        .eq('user_id', cleanId)
        .maybeSingle();
      if (sel?.item_id) {
        targetCategory = sel.category;
        targetItemId = sel.item_id;
      } else if (memSelections.has(cleanId)) {
        const ms = memSelections.get(cleanId);
        targetCategory = ms.category;
        targetItemId = ms.item_id;
      }
    }

    if (!targetItemId) {
      return {
        success: false,
        status: 400,
        error: 'NO_SELECTION',
        message: 'Bạn chưa chọn vật phẩm nào! Hãy chọn danh mục và món đồ ở menu phía trên trước.',
      };
    }

    const resolved = resolveShopEntry(targetCategory, targetItemId);
    if (!resolved) {
      return {
        success: false,
        status: 404,
        error: 'SHOP_ITEM_NOT_FOUND',
        message: `Vật phẩm '${targetItemId}' không được bán trong Cửa Hàng.`,
      };
    }

    const it = resolved.item;
    const isStackable = resolved.category === 'rings' || resolved.category === 'consumables';
    const quantity = isStackable ? Math.max(1, Math.min(20, Math.floor(Number(payload.quantity) || 1))) : 1;
    const durationRaw = String(payload.duration || '7d').trim().toLowerCase();
    const duration = ['7d', '30d', 'permanent'].includes(durationRaw) ? durationRaw : '7d';

    let totalCost = 0;
    let displayName = '';

    if (resolved.category === 'roles') {
      totalCost = it.prices[duration];
      displayName = `${it.name} (${duration === 'permanent' ? 'Vĩnh Viễn' : duration === '30d' ? '30 Ngày' : '7 Ngày'})`;

      const { data: existingRole } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', cleanId)
        .eq('role_id', it.role_id)
        .maybeSingle();

      if (existingRole?.is_permanent) {
        return { success: false, status: 400, error: 'ALREADY_OWNED', message: `Bạn đã sở hữu Role **${it.name}** Vĩnh Viễn rồi!` };
      }
    } else if (resolved.category === 'pets') {
      totalCost = it.price;
      displayName = it.pet_name;
      const { data: existingPet } = await supabase
        .from('user_pets')
        .select('pet_id')
        .eq('user_id', cleanId)
        .eq('pet_type', it.pet_type)
        .maybeSingle();
      if (existingPet) {
        return { success: false, status: 400, error: 'ALREADY_OWNED', message: `Bạn đã sở hữu Linh Thú **${it.pet_name}** trong kho rồi!` };
      }
    } else if (resolved.category === 'equipment') {
      totalCost = it.price;
      displayName = it.item_name;
      const { data: existingEq } = await supabase
        .from('user_pet_items')
        .select('id')
        .eq('user_id', cleanId)
        .eq('item_id', it.item_id)
        .maybeSingle();
      if (existingEq) {
        return { success: false, status: 400, error: 'ALREADY_OWNED', message: `Bạn đã sở hữu Pháp Bảo **${it.item_name}** rồi!` };
      }
    } else if (resolved.category === 'backgrounds') {
      totalCost = it.price;
      displayName = it.name;
      const { data: existingBg } = await supabase
        .from('user_inventory')
        .select('quantity')
        .eq('user_id', cleanId)
        .eq('item_id', it.bg_id)
        .gt('quantity', 0)
        .maybeSingle();
      if (existingBg || normalizeEquippedBgId(user.background_url) === it.bg_id) {
        const nowIsoEquip = new Date().toISOString();
        await supabase
          .from('users')
          .update({ background_url: it.bg_id, updated_at: nowIsoEquip })
          .eq('user_id', cleanId);
        const balNow = Number(user.linh_thach || 0);
        return {
          success: true,
          equipped: true,
          already_owned: true,
          category: 'backgrounds',
          item_id: it.bg_id,
          item_name: it.name,
          quantity: 1,
          cost: 0,
          linh_thach: balNow,
          linh_thach_fmt: balNow.toLocaleString('vi-VN'),
          message: `${em('su_sparkle')} Đã trang bị Ảnh Nền **${it.name}** lên \`/profile\` & \`/rank\` *(Miễn phí **0 LT** vì bạn đã sở hữu)*!\n• Số dư hiện tại: **${balNow.toLocaleString('vi-VN')} Linh Thạch**`,
        };
      }
    } else if (resolved.category === 'frames') {
      totalCost = it.price;
      displayName = it.name;
      const [{ data: existingFrame }, { data: legacyTok }] = await Promise.all([
        supabase.from('user_frames').select('frame_id').eq('user_id', cleanId).eq('frame_id', it.frame_id).maybeSingle(),
        supabase.from('user_inventory').select('quantity').eq('user_id', cleanId).eq('item_id', 'frame_unlock_token').gt('quantity', 0).maybeSingle(),
      ]);
      const LEGACY_GRANTED = new Set(['frame_royal_legacy', 'jade_lotus', 'amethyst_celestial', 'crimson_phoenix', 'frost_crystal']);
      if (existingFrame || (legacyTok && LEGACY_GRANTED.has(it.frame_id)) || String(user.avatar_frame || '').trim() === it.frame_id) {
        const nowIsoEquip = new Date().toISOString();
        await Promise.all([
          supabase.from('users').update({ avatar_frame: it.frame_id, updated_at: nowIsoEquip }).eq('user_id', cleanId),
          supabase.from('user_frames').upsert({ user_id: cleanId, frame_id: it.frame_id, purchased_at: nowIsoEquip }, { onConflict: 'user_id,frame_id' }),
        ]);
        const balNow = Number(user.linh_thach || 0);
        return {
          success: true,
          equipped: true,
          already_owned: true,
          category: 'frames',
          item_id: it.frame_id,
          item_name: it.name,
          quantity: 1,
          cost: 0,
          linh_thach: balNow,
          linh_thach_fmt: balNow.toLocaleString('vi-VN'),
          message: `${em('su_sparkle')} Đã trang bị Viền Avatar **${it.name}** lên \`/profile\`, \`/rank\`, \`/battle\` & \`/linhmach\` *(Miễn phí **0 LT** vì bạn đã sở hữu)*!\n• Số dư hiện tại: **${balNow.toLocaleString('vi-VN')} Linh Thạch**`,
        };
      }
    } else {
      totalCost = it.price * quantity;
      displayName = it.name;
    }

    const now = new Date();
    const todayKey = getVnDateKey(now);
    const CONSUMABLE_DAILY_CAPS = {
      tower_reset_card: {
        dateCol: 'tower_reset_buy_date',
        countCol: 'tower_reset_buys_today',
        defaultDaily: 5,
        defaultStack: 15,
      },
      enchant_stone: {
        dateCol: 'enchant_stone_buy_date',
        countCol: 'enchant_stone_buys_today',
        defaultDaily: 5,
        defaultStack: 99,
      },
    };
    const dailyCapCfg = resolved.category === 'consumables' ? CONSUMABLE_DAILY_CAPS[resolved.item_id] : null;
    let cappedBoughtToday = 0;

    if (dailyCapCfg) {
      const dailyLimit = Number(it.daily_limit || dailyCapCfg.defaultDaily);
      const maxStack = Number(it.max_stack || dailyCapCfg.defaultStack);

      const [{ data: qRow }, { data: invRow }] = await Promise.all([
        supabase.from('user_quests').select(`${dailyCapCfg.dateCol}, ${dailyCapCfg.countCol}`).eq('user_id', cleanId).maybeSingle(),
        supabase.from('user_inventory').select('quantity').eq('user_id', cleanId).eq('item_id', resolved.item_id).maybeSingle(),
      ]);

      cappedBoughtToday = qRow?.[dailyCapCfg.dateCol] === todayKey ? Number(qRow?.[dailyCapCfg.countCol] || 0) : 0;
      const ownedQty = Number(invRow?.quantity || 0);

      if (ownedQty + quantity > maxStack) {
        return {
          success: false,
          status: 400,
          error: 'INVENTORY_STACK_LIMIT',
          message: `Bạn chỉ có thể giữ tối đa **${maxStack}** **${it.name}** trong túi đồ (hiện có \`${ownedQty}/${maxStack}\`)!`,
        };
      }
      if (cappedBoughtToday + quantity > dailyLimit) {
        return {
          success: false,
          status: 400,
          error: 'DAILY_BUY_LIMIT',
          message: `Hôm nay chỉ được mua tối đa **${dailyLimit}** **${it.name}** mỗi ngày (đã mua \`${cappedBoughtToday}/${dailyLimit}\` — reset 00:00 UTC+7)!`,
        };
      }
    }

    const roleBuffs = await computeRoleBuffTotals(cleanId, Number(user.level || 1));
    const shopDiscountPct = Number(roleBuffs?.shopDiscountPct || 0);
    if (shopDiscountPct > 0) {
      totalCost = applyShopDiscount(totalCost, shopDiscountPct);
    }

    const currentBal = Number(user.linh_thach || 0);
    if (currentBal < totalCost) {
      return {
        success: false,
        status: 400,
        error: 'INSUFFICIENT_LINH_THACH',
        required: totalCost,
        balance: currentBal,
        message: `Không đủ Linh Thạch để mua **${displayName}**! Cần **${totalCost.toLocaleString('vi-VN')}**, hiện có **${currentBal.toLocaleString('vi-VN')}** ${em('su_linhthach')}.`,
      };
    }

    const nowIso = now.toISOString();
    const nextBalance = currentBal - totalCost;

    const { error: balErr } = await supabase
      .from('users')
      .update({ linh_thach: nextBalance, updated_at: nowIso })
      .eq('user_id', cleanId);
    if (balErr) throw new Error(`Balance deduction failed: ${balErr.message}`);

    let addRoleId = '';
    let extraNote = '';
    let rolledGrade = null;

    if (resolved.category === 'rings' || resolved.category === 'consumables' || resolved.category === 'backgrounds') {
      const invCat = resolved.category === 'rings' ? 'ring' : resolved.category === 'backgrounds' ? 'background' : 'consumable';
      const { data: ex } = await supabase
        .from('user_inventory')
        .select('quantity')
        .eq('user_id', cleanId)
        .eq('item_id', resolved.item_id)
        .maybeSingle();

      const nextQty = Number(ex?.quantity || 0) + quantity;
      if (ex) {
        await supabase
          .from('user_inventory')
          .update({ quantity: nextQty, item_category: invCat, updated_at: nowIso })
          .eq('user_id', cleanId)
          .eq('item_id', resolved.item_id);
      } else {
        await supabase.from('user_inventory').insert({
          user_id: cleanId,
          item_id: resolved.item_id,
          item_category: invCat,
          quantity: nextQty,
        });
      }
      if (dailyCapCfg) {
        const nextBuyCount = cappedBoughtToday + quantity;
        const dailyLimit = Number(it.daily_limit || dailyCapCfg.defaultDaily);
        const maxStack = Number(it.max_stack || dailyCapCfg.defaultStack);
        await supabase.from('user_quests').upsert({
          user_id: cleanId,
          [dailyCapCfg.dateCol]: todayKey,
          [dailyCapCfg.countCol]: nextBuyCount,
          updated_at: nowIso,
        }, { onConflict: 'user_id' });
        if (resolved.item_id === 'tower_reset_card') {
          extraNote = `\n• Dùng \`/nhiemvu hanh_dong:reset\` để hồi \`5/5\` lượt Tháp! *(Đã mua hôm nay: ${nextBuyCount}/${dailyLimit} • Túi: ${nextQty}/${maxStack})*`;
        } else if (resolved.item_id === 'enchant_stone') {
          extraNote = `\n• Dùng \`/enchant\` để cường hóa Phẩm Chất **D → S** cho Linh Thú & Pháp Bảo! *(Đã mua hôm nay: ${nextBuyCount}/${dailyLimit} • Túi: ${nextQty}/${maxStack})*`;
        }
      } else if (resolved.category === 'backgrounds') {
        extraNote = `\n• Dùng \`/equip loai:background ma_id:${resolved.item_id}\` để áp dụng ngay lên \`/profile\` & \`/rank\`!`;
      } else if (resolved.category === 'rings') {
        extraNote = `\n• Dùng \`/marry hanh_dong:propose nhan:${resolved.item_id}\` để cầu hôn hoặc \`/marry hanh_dong:upgrade_ring\` để nâng nhẫn!`;
      }
    } else if (resolved.category === 'frames') {
      await supabase.from('user_frames').upsert({
        user_id: cleanId,
        frame_id: resolved.item_id,
        purchased_at: nowIso,
      }, { onConflict: 'user_id,frame_id' });
      extraNote = `\n• Dùng \`/equip ma_id:${resolved.item_id}\` để đeo ngay lên \`/profile\`, \`/rank\`, \`/battle\` & \`/linhmach\`!`;
    } else if (resolved.category === 'pets') {
      rolledGrade = rollDefaultEnchantGrade();
      await supabase.from('user_pets').insert({
        user_id: cleanId,
        pet_name: it.pet_name,
        pet_type: it.pet_type,
        pet_rarity: it.rarity,
        element: it.element,
        hax_skill: it.hax_skill,
        hax_description: it.hax_description,
        level: 1,
        star: 1,
        atk: it.base_atk,
        def: it.base_def,
        spd: it.base_spd,
        power_score: it.base_power,
        is_active: false,
        source: 'shop',
        paid_price: totalCost,
        enchant_grade: rolledGrade,
        enchant_pity: 0,
      });
      extraNote = `\n• Phẩm Chất Khắc Ấn: ${gradeEmoji(rolledGrade)} **Hạng ${rolledGrade}**\n• Dùng \`/linhthu hanh_dong:active linh_thu:${it.pet_type}\` để cho Linh Thú xuất trận!`;
    } else if (resolved.category === 'equipment') {
      rolledGrade = rollDefaultEnchantGrade();
      await supabase.from('user_pet_items').insert({
        user_id: cleanId,
        item_id: it.item_id,
        equipped_to_pet: null,
        slot: null,
        source: 'shop',
        paid_price: totalCost,
        enchant_grade: rolledGrade,
        enchant_pity: 0,
      });
      extraNote = `\n• Phẩm Chất Khắc Ấn: ${gradeEmoji(rolledGrade)} **Hạng ${rolledGrade}**\n• Dùng \`/equip loai:item ma_id:${it.item_id}\` để trang bị cho Linh Thú đang xuất trận!`;
    } else if (resolved.category === 'roles') {
      const { data: userRoles } = await supabase.from('user_roles').select('*').eq('user_id', cleanId);
      const existing = (userRoles || []).find((r) => r.role_id === it.role_id);
      const isPermanent = duration === 'permanent';
      let expiresAt = null;
      if (!isPermanent) {
        const addDays = duration === '30d' ? 30 : 7;
        const baseTime = existing?.expires_at && new Date(existing.expires_at) > now
          ? new Date(existing.expires_at).getTime()
          : now.getTime();
        expiresAt = new Date(baseTime + addDays * 86400000).toISOString();
      }

      const perk = ROLE_PERKS_MAP[it.role_id] || it.perk;
      const dbPerk = sanitizeRolePerkForDb(perk);
      const maxSlots = getMaxRoleSlotsByLevel(user.level || 1);
      const usedSlots = new Set((userRoles || []).filter((r) => r.is_equipped && r.equipped_slot).map((r) => Number(r.equipped_slot)));

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

      const nextPaidPrice = existing?.source === 'shop'
        ? Number(existing.paid_price || 0) + totalCost
        : totalCost;

      if (existing) {
        const { error: roleWriteErr } = await supabase
          .from('user_roles')
          .update({
            role_name: it.name,
            role_perk: dbPerk,
            is_permanent: isPermanent,
            expires_at: expiresAt,
            is_equipped: isEquipped,
            equipped_slot: equippedSlot,
            source: 'shop',
            paid_price: nextPaidPrice,
          })
          .eq('id', existing.id);
        if (roleWriteErr) {
          console.error('[Shop] user_roles update failed:', roleWriteErr);
          throw new Error(`Lưu Role thất bại: ${roleWriteErr.message}`);
        }
      } else {
        const { error: roleWriteErr } = await supabase.from('user_roles').insert({
          user_id: cleanId,
          role_id: it.role_id,
          role_name: it.name,
          role_perk: dbPerk,
          is_permanent: isPermanent,
          expires_at: expiresAt,
          is_equipped: isEquipped,
          equipped_slot: equippedSlot,
          source: 'shop',
          paid_price: totalCost,
        });
        if (roleWriteErr) {
          console.error('[Shop] user_roles insert failed:', roleWriteErr);
          throw new Error(`Lưu Role thất bại: ${roleWriteErr.message}`);
        }
      }

      if (isEquipped) {
        addRoleId = it.role_id;
        extraNote = `\n• Đã tự động trang bị vào **Slot #${equippedSlot}/${maxSlots}** & kích hoạt Role trên Discord!`;
      } else {
        extraNote = `\n• Role đã được lưu vào \`/inv\`. Các Slot (${maxSlots}/${maxSlots}) đang đầy — hãy dùng \`/unequip\` rồi \`/equip loai:role ma_id:${it.role_id}\`.`;
      }
    }

    await trackQuestActivity(cleanId, { shopDelta: 1, now });

    return {
      success: true,
      category: resolved.category,
      item_id: resolved.item_id,
      item_name: displayName,
      quantity,
      duration: resolved.category === 'roles' ? duration : null,
      enchant_grade: rolledGrade,
      cost: totalCost,
      linh_thach: nextBalance,
      linh_thach_fmt: nextBalance.toLocaleString('vi-VN'),
      add_role_id: addRoleId,
      message: `${em('su_sparkle')} Mua thành công **${displayName}**${quantity > 1 ? ` × **${quantity}**` : ''} với giá **-${totalCost.toLocaleString('vi-VN')}** ${em('su_linhthach')} **Linh Thạch**!\n• Số dư còn lại: **${nextBalance.toLocaleString('vi-VN')} Linh Thạch**${extraNote}`,
    };
  });
}
