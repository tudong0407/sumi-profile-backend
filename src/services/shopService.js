/**
 * src/services/shopService.js
 * Hệ thống Cửa Hàng Tiên Giới (/shop):
 * - 6 Danh Mục: Nhẫn Cưới (4), Linh Thú Phàm/Linh (10), Pháp Bảo Phàm/Linh (24),
 *   Role Quyền Năng Tiện Ích (9 gói x 7d/30d/Vĩnh Viễn), Vật Phẩm Tiêu Hao (5), Background Profile/Rank (20).
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
  PUBLIC_BASE_URL,
} from '../data/catalog.js';
import {
  em,
  ringEmoji,
  tierEmoji,
  petEmoji,
  itemEmoji,
  elementEmoji,
} from '../config/emojiHelper.js';
import {
  ROLE_PERKS_MAP,
  sanitizeUserId,
  ensureUserInitialized,
  pickCleanDisplayValue,
  getMaxRoleSlotsByLevel,
} from './profileService.js';

export const SHOP_CATEGORIES = ['rings', 'pets', 'equipment', 'roles', 'consumables', 'backgrounds'];

const SHOP_PETS_BY_ID = Object.fromEntries(SHOP_PETS.map((p) => [p.pet_type, p]));
const SHOP_EQUIP_BY_ID = Object.fromEntries(SHOP_EQUIPMENT.map((e) => [e.item_id, e]));

const shopLocks = new Map();
const memSelections = new Map();

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
  }
  return null;
}

function buildCategorySummary(cat) {
  const lt = em('su_linhthach');
  if (cat === 'rings') {
    return MARRY_RINGS.map((r) =>
      `• ${ringEmoji(r.item_id)} **${r.name}** *(${r.rarity})* — **${r.price.toLocaleString('vi-VN')}** ${lt} • +${r.exp_bonus_pct}% EXP & +${r.power_bonus_pct}% Chiến Lực`
    ).join('\n');
  }
  if (cat === 'pets') {
    return SHOP_PETS.map((p) =>
      `• ${petEmoji(p.pet_type)} **${p.pet_name}** *(${p.rarity} • ${p.element})* — **${p.price.toLocaleString('vi-VN')}** ${lt} • \`${p.base_atk}/${p.base_def}/${p.base_spd}\``
    ).join('\n');
  }
  if (cat === 'equipment') {
    return SHOP_EQUIPMENT.slice(0, 12).map((e) =>
      `• ${itemEmoji(e.item_id)} **${e.item_name}** *(${e.rarity} • ${e.item_type})* — **${e.price.toLocaleString('vi-VN')}** ${lt}`
    ).join('\n') + `\n• *... và ${SHOP_EQUIPMENT.length - 12} Pháp Bảo Linh Phẩm khác trong danh sách*`;
  }
  if (cat === 'roles') {
    return SHOP_ROLE_PACKAGES.map((r) =>
      `• ${em('su_medal_role')} **${r.name}** — ${r.perk} • \`7d: ${r.prices['7d']}\` | \`30d: ${r.prices['30d']}\` | \`Vĩnh viễn: ${r.prices.permanent.toLocaleString('vi-VN')}\` ${lt}`
    ).join('\n');
  }
  if (cat === 'consumables') {
    return SHOP_CONSUMABLES.map((c) =>
      `• ${c.icon} **${c.name}** — **${c.price.toLocaleString('vi-VN')}** ${lt}\n  *${c.description}*`
    ).join('\n');
  }
  if (cat === 'backgrounds') {
    const bgs = BACKGROUND_CATALOG.filter((b) => b.price > 0);
    return bgs.slice(0, 10).map((b) =>
      `• ${em('su_frame_token')} **${b.name}** *(${b.rarity})* — **${b.price.toLocaleString('vi-VN')}** ${lt}`
    ).join('\n') + `\n• *... tổng cộng ${bgs.length} mẫu Background 2:1 & Pinterest*`;
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

  if (cleanUserId && supabase) {
    const { user } = await ensureUserInitialized(cleanUserId, {
      username: pickCleanDisplayValue(options.username, options.fallbackUsername),
      avatarUrl: pickCleanDisplayValue(options.avatarUrl),
    });
    if (user) balance = Number(user.linh_thach || 0);
  }

  const paidBgs = BACKGROUND_CATALOG.filter((b) => b.price > 0);
  const catalogData = {
    rings: MARRY_RINGS,
    pets: SHOP_PETS,
    equipment: SHOP_EQUIPMENT,
    roles: SHOP_ROLE_PACKAGES,
    consumables: SHOP_CONSUMABLES,
    backgrounds: paidBgs,
  };

  if (cat && cat !== 'all' && !SHOP_CATEGORIES.includes(cat)) {
    return { success: false, status: 404, error: 'CATEGORY_NOT_FOUND', message: `Danh mục '${category}' không tồn tại.` };
  }

  const summaryText = cat === 'all' || !cat
    ? [
        `${em('su_linhthach')} **CHÀO MỪNG ĐẾN VỚI TIÊN BẢO CÁC (SHOP SUMI FAMILY)**`,
        balance !== null ? `• Số dư hiện tại: **${balance.toLocaleString('vi-VN')}** ${em('su_linhthach')} **Linh Thạch**` : '',
        `• **Nhẫn Cưới (4 cấp)**: Kết duyên Tiên Lữ, tăng EXP & Chiến Lực đôi.`,
        `• **Linh Thú (10 loài)**: Mua thẳng Pet Phàm Phẩm & Linh Phẩm.`,
        `• **Pháp Bảo (24 món)**: Vũ Khí, Bảo Ngọc, Chiến Hồn Phàm & Linh Phẩm.`,
        `• **Role Quyền Năng (9 gói)**: Thuê \`7 Ngày\`, \`30 Ngày\` hoặc mua \`Vĩnh Viễn\`.`,
        `• **Vật Phẩm Tiêu Hao (5 món)**: Vé Gacha, Tinh Thạch Nâng Sao, Thẻ Đổi Danh Hiệu, Khung Viền.`,
        `• **Background Hồ Sơ (20 mẫu)**: Đổi ảnh nền thẻ \`/profile\` & \`/rank\`.`,
      ].filter(Boolean).join('\n')
    : buildCategorySummary(cat);

  return {
    success: true,
    category: cat || 'all',
    balance,
    balance_fmt: balance !== null ? balance.toLocaleString('vi-VN') : '',
    summary_text: summaryText,
    ...(cat && cat !== 'all' ? { items: catalogData[cat] } : { categories: catalogData }),
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

  if (supabase) {
    const { user } = await ensureUserInitialized(cleanId, {
      username: pickCleanDisplayValue(opts.username, opts.fallbackUsername),
      avatarUrl: pickCleanDisplayValue(opts.avatarUrl),
    });
    if (!user) return { success: false, status: 500, error: 'USER_INIT_FAILED', message: 'Không thể khởi tạo hồ sơ.' };
    balance = Number(user.linh_thach || 0);

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
      if (own) { alreadyOwned = true; ownedNote = '*(Đã mở khóa nền này — dùng `/equip background`)*'; }
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
    memSelections.set(cleanId, { category: resolved.category, item_id: resolved.item_id });
  }

  const lt = em('su_linhthach');
  const it = resolved.item;
  let title = '';
  let description = '';
  let imageUrl = '';
  let price = 0;
  let color = '#ec4899';

  if (resolved.category === 'rings') {
    price = it.price;
    title = `${ringEmoji(it.item_id)} ${it.name}`;
    imageUrl = `${PUBLIC_BASE_URL}/assets/rings/${it.item_id}.png`;
    color = it.rarity_key === 'mythic' ? '#f59e0b' : it.rarity_key === 'epic' ? '#a855f7' : it.rarity_key === 'rare' ? '#3b82f6' : '#94a3b8';
    description = [
      `${tierEmoji(it.rarity_key)} **Phẩm Cấp**: **${it.rarity}** ${ownedNote}`.trim(),
      `${lt} **Giá bán**: **${price.toLocaleString('vi-VN')} Linh Thạch** *(Số dư: ${balance.toLocaleString('vi-VN')})*`,
      `${em('su_sparkle')} **Hiệu ứng**: ${it.description}`,
      `${em('su_wiki_scroll')} Dùng cho \`/marry\` hoặc nâng cấp nhẫn đang đeo.`,
    ].join('\n');
  } else if (resolved.category === 'pets') {
    price = it.price;
    title = `${petEmoji(it.pet_type)} ${it.pet_name}`;
    imageUrl = `${PUBLIC_BASE_URL}/api/wiki/pet/${it.pet_type}.png`;
    color = it.rarity_key === 'rare' ? '#3b82f6' : '#94a3b8';
    description = [
      `${tierEmoji(it.rarity_key)} **${it.rarity}** • ${elementEmoji(it.element)} Hệ **${it.element}** ${ownedNote}`.trim(),
      `${lt} **Giá bán**: **${price.toLocaleString('vi-VN')} Linh Thạch** *(Số dư: ${balance.toLocaleString('vi-VN')})*`,
      `${em('su_stats_chart')} **Chỉ số gốc**: \`ATK ${it.base_atk} | DEF ${it.base_def} | SPD ${it.base_spd} | HP ${it.base_hp.toLocaleString('vi-VN')}\``,
      `${em('su_thunder_hax')} **HAX (${it.hax_skill})**: ${it.hax_description}`,
    ].join('\n');
  } else if (resolved.category === 'equipment') {
    price = it.price;
    title = `${itemEmoji(it.item_id)} ${it.item_name}`;
    imageUrl = `${PUBLIC_BASE_URL}/api/wiki/item/${it.item_id}.png`;
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
      `${lt} **Giá bán**: **${price.toLocaleString('vi-VN')} Linh Thạch** *(Số dư: ${balance.toLocaleString('vi-VN')})*`,
      `${em('su_stats_chart')} **Chỉ số**: \`${statParts}\``,
      `${em('su_sparkle')} ${it.hax_description}`,
    ].join('\n');
  } else if (resolved.category === 'roles') {
    price = it.prices['7d'];
    title = `${em('su_medal_role')} ${it.name}`;
    color = '#a855f7';
    description = [
      `${em('su_sparkle')} **Đặc quyền**: ${it.perk} ${ownedNote}`.trim(),
      `${lt} **Bảng giá gói Role** *(Số dư: ${balance.toLocaleString('vi-VN')})*:`,
      `• **7 Ngày**: \`${it.prices['7d'].toLocaleString('vi-VN')}\` Linh Thạch`,
      `• **30 Ngày**: \`${it.prices['30d'].toLocaleString('vi-VN')}\` Linh Thạch`,
      `• **Vĩnh Viễn**: \`${it.prices.permanent.toLocaleString('vi-VN')}\` Linh Thạch`,
      `${em('su_wiki_scroll')} Tự động đeo vào Slot trống & cấp Role trên Discord.`,
    ].join('\n');
  } else if (resolved.category === 'consumables') {
    price = it.price;
    title = `${it.icon} ${it.name}`;
    imageUrl = `${PUBLIC_BASE_URL}/assets/shop/${it.item_id}.png`;
    color = '#38bdf8';
    description = [
      `${em('su_star_stone')} **Vật Phẩm Tu Tiên** ${ownedNote}`.trim(),
      `${lt} **Giá bán**: **${price.toLocaleString('vi-VN')} Linh Thạch** *(Số dư: ${balance.toLocaleString('vi-VN')})*`,
      `${em('su_sparkle')} ${it.description}`,
    ].join('\n');
  } else if (resolved.category === 'backgrounds') {
    price = it.price;
    title = `${em('su_frame_token')} ${it.name}`;
    imageUrl = `${PUBLIC_BASE_URL}/assets/${it.file}`;
    color = it.rarity_key === 'mythic' ? '#f59e0b' : it.rarity_key === 'epic' ? '#a855f7' : '#3b82f6';
    description = [
      `${tierEmoji(it.rarity_key)} **${it.rarity}** • Ảnh Nền \`/profile\` & \`/rank\` ${ownedNote}`.trim(),
      `${lt} **Giá bán**: **${price.toLocaleString('vi-VN')} Linh Thạch** *(Số dư: ${balance.toLocaleString('vi-VN')})*`,
      `${em('su_wiki_scroll')} Mã trang bị sau khi mua: \`/equip loai:background ma_id:${it.bg_id}\``,
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
    price,
    balance,
    balance_fmt: balance.toLocaleString('vi-VN'),
    already_owned: alreadyOwned,
    can_afford: balance >= price,
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
      if (existingBg) {
        return { success: false, status: 400, error: 'ALREADY_OWNED', message: `Bạn đã mở khóa Ảnh Nền **${it.name}** rồi! Dùng \`/equip loai:background ma_id:${it.bg_id}\` để đổi.` };
      }
    } else {
      totalCost = it.price * quantity;
      displayName = it.name;
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

    const now = new Date();
    const nowIso = now.toISOString();
    const nextBalance = currentBal - totalCost;

    const { error: balErr } = await supabase
      .from('users')
      .update({ linh_thach: nextBalance, updated_at: nowIso })
      .eq('user_id', cleanId);
    if (balErr) throw new Error(`Balance deduction failed: ${balErr.message}`);

    let addRoleId = '';
    let extraNote = '';

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
      if (resolved.category === 'backgrounds') {
        extraNote = `\n• Dùng \`/equip loai:background ma_id:${resolved.item_id}\` để áp dụng ngay lên \`/profile\` & \`/rank\`!`;
      } else if (resolved.category === 'rings') {
        extraNote = `\n• Dùng \`/marry hanh_dong:propose nhan:${resolved.item_id}\` để cầu hôn hoặc \`/marry hanh_dong:upgrade_ring\` để nâng nhẫn!`;
      }
    } else if (resolved.category === 'pets') {
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
      });
      extraNote = `\n• Dùng \`/linhthu hanh_dong:active linh_thu:${it.pet_type}\` để cho Linh Thú xuất trận!`;
    } else if (resolved.category === 'equipment') {
      await supabase.from('user_pet_items').insert({
        user_id: cleanId,
        item_id: it.item_id,
        equipped_to_pet: null,
        slot: null,
      });
      extraNote = `\n• Dùng \`/equip loai:item ma_id:${it.item_id}\` để trang bị cho Linh Thú đang xuất trận!`;
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

      if (existing) {
        await supabase
          .from('user_roles')
          .update({
            role_name: it.name,
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
          role_id: it.role_id,
          role_name: it.name,
          role_perk: perk,
          is_permanent: isPermanent,
          expires_at: expiresAt,
          is_equipped: isEquipped,
          equipped_slot: equippedSlot,
        });
      }

      if (isEquipped) {
        addRoleId = it.role_id;
        extraNote = `\n• Đã tự động trang bị vào **Slot #${equippedSlot}/${maxSlots}** & kích hoạt Role trên Discord!`;
      } else {
        extraNote = `\n• Role đã được lưu vào \`/inv\`. Các Slot (${maxSlots}/${maxSlots}) đang đầy — hãy dùng \`/unequip\` rồi \`/equip loai:role ma_id:${it.role_id}\`.`;
      }
    }

    return {
      success: true,
      category: resolved.category,
      item_id: resolved.item_id,
      item_name: displayName,
      quantity,
      duration: resolved.category === 'roles' ? duration : null,
      cost: totalCost,
      linh_thach: nextBalance,
      linh_thach_fmt: nextBalance.toLocaleString('vi-VN'),
      add_role_id: addRoleId,
      message: `${em('su_sparkle')} Mua thành công **${displayName}**${quantity > 1 ? ` × **${quantity}**` : ''} với giá **-${totalCost.toLocaleString('vi-VN')}** ${em('su_linhthach')} **Linh Thạch**!\n• Số dư còn lại: **${nextBalance.toLocaleString('vi-VN')} Linh Thạch**${extraNote}`,
    };
  });
}
