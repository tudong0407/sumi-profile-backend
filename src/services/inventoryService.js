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
} from '../data/catalog.js';
import {
  em,
  itemEmoji,
  petEmoji,
  tierEmoji,
} from '../config/emojiHelper.js';
import {
  sanitizeUserId,
  ensureUserInitialized,
  pickCleanDisplayValue,
  getMaxRoleSlotsByLevel,
} from './profileService.js';

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

  const [petsRes, itemsRes, rolesRes, invRes] = await Promise.all([
    supabase.from('user_pets').select('*').eq('user_id', cleanId).order('is_active', { ascending: false }).order('power_score', { ascending: false }),
    supabase.from('v_user_equipped_items').select('*').eq('user_id', cleanId),
    supabase.from('user_roles').select('*').eq('user_id', cleanId).order('is_equipped', { ascending: false }),
    supabase.from('user_inventory').select('*').eq('user_id', cleanId).gt('quantity', 0),
  ]);

  const SHOP_CONS_BY_ID = Object.fromEntries(SHOP_CONSUMABLES.map((c) => [c.item_id, c]));

  const pets = (petsRes.data || []).map((p) => ({
    ...p,
    icon: petEmoji(p.pet_type, em('su_fox_mascot')),
    tier_icon: tierEmoji((PET_BY_TYPE[p.pet_type]?.rarity_key) || 'common'),
  }));

  const items = (itemsRes.data || []).map((row) => ({
    ...row,
    ...(EQUIPMENT_BY_ID[row.item_id] || {}),
    icon: itemEmoji(row.item_id, em('su_crossed_swords')),
  }));

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

  const roles = activeRoles.map((r) => ({
    ...r,
    icon: em('su_realm_star'),
  }));

  const consumables = (invRes.data || []).map((inv) => {
    const cMeta = SHOP_CONS_BY_ID[inv.item_id] || MARRY_RING_BY_ID[inv.item_id];
    const bgMeta = BACKGROUND_BY_ID[inv.item_id];
    const frameMeta = inv.item_id.startsWith('frame_') ? AVATAR_FRAME_BY_ID[inv.item_id.slice(6)] : null;
    const icon = cMeta?.icon || ((bgMeta || frameMeta) ? em('su_frame_token') : em('su_pin_sigil'));
    const displayName = cMeta?.name || bgMeta?.name || (frameMeta ? `Khung ${frameMeta.name}` : inv.item_id);
    return {
      ...inv,
      icon,
      display_name: displayName,
    };
  });

  const capLines = (lines, emptyText, maxItems = 12) => {
    if (!lines.length) return emptyText;
    const shown = lines.slice(0, maxItems);
    const extra = lines.length - shown.length;
    return extra > 0 ? `${shown.join('\n')}\n• *... và ${extra} mục khác*` : shown.join('\n');
  };

  const bgRaw = user.background_url || 'default_background.png';
  const bgObj = BACKGROUND_BY_ID[bgRaw] || BACKGROUND_CATALOG.find((b) => b.file === bgRaw || `assets/${b.file}` === bgRaw);
  const bgName = bgObj?.name || (bgRaw.includes('celestial_palace_pink') ? 'Thiên Cung Cửu Vĩ' : 'Đạo Cảnh Mặc Định');

  const summaryPets = capLines(
    pets.map((p) => `• ${p.icon} **${p.pet_name}** (\`${p.pet_type}\`) — Lv.${p.level} • ${p.star} Sao${p.is_active ? ' *(Đang xuất trận)*' : ''}`),
    '• Chưa có Linh Thú nào.',
  );
  const summaryItems = capLines(
    items.map((it) => `• ${it.icon} **${it.item_name}** (\`${it.item_id}\`)${it.equipped_to_pet ? ' *(Đang trang bị)*' : ''}`),
    '• Chưa có Pháp Bảo nào.',
  );
  const summaryRoles = capLines(
    roles.map((r) => `• ${r.icon} ${r.role_name} (\`${r.role_id}\`)${r.is_equipped ? ` *(Slot #${r.equipped_slot})*` : ''}`),
    '• Chưa có Role Quyền Năng nào.',
  );
  const summaryConsumables = capLines(
    consumables.map((c) => `• ${c.icon} **${c.display_name}** (\`${c.item_id}\`) × **${c.quantity}**`),
    '• Chưa có vật phẩm mở khóa nào.',
  );

  return {
    success: true,
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
  };
}

export async function equipTarget(userId, payload = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID người dùng không hợp lệ.' };
  if (!supabase) return { success: false, status: 503, error: 'DB_UNAVAILABLE', message: 'Supabase chưa sẵn sàng.' };

  const category = String(payload.category || '').toLowerCase();
  const targetId = String(payload.targetId || '').trim();
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
  const targetId = String(payload.targetId || '').trim();

  if (category === 'item') {
    const query = supabase
      .from('user_pet_items')
      .update({ equipped_to_pet: null, slot: null })
      .eq('user_id', cleanId);

    if (['weapon', 'gem', 'soul'].includes(targetId.toLowerCase())) {
      await query.eq('slot', targetId.toLowerCase());
    } else {
      await query.eq('item_id', targetId);
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
    const cleanRoleId = rawTarget.replace(/^<@&(\d+)>$/, '$1').trim();
    const normTarget = normalizeTargetText(rawTarget);

    // Chặn phá nhầm Level Role (cần dùng /doiqua để tụt cấp)
    if (category === '' || category === 'role') {
      const matchedMilestone = LEVEL_ROLE_MILESTONES.find((m) =>
        m.roleId === cleanRoleId || normalizeTargetText(m.name) === normTarget);
      if (matchedMilestone) {
        return {
          success: false,
          status: 400,
          error: 'LEVEL_ROLE_CANNOT_DISMANTLE',
          remove_role_id: '',
          message: `**${matchedMilestone.name}** là **Role Cấp Độ (Level Role)**, không thể phá bằng \`/dismantle\`!\n• Nếu muốn gỡ Level Role và nhận Linh Thạch, hãy dùng \`/doiqua\` để phế Tu Vi tụt cấp.`,
        };
      }

      const { data: userRoles } = await supabase
        .from('user_roles')
        .select('*')
        .eq('user_id', cleanId);

      const slotNum = /^[1-5]$/.test(rawTarget) ? Number(rawTarget) : null;
      const targetRole = (userRoles || []).find((r) =>
        r.role_id === cleanRoleId
        || normalizeTargetText(r.role_name) === normTarget
        || (slotNum && r.is_equipped && Number(r.equipped_slot) === slotNum));

      if (targetRole) {
        if (!targetRole.is_permanent && targetRole.expires_at && new Date(targetRole.expires_at) <= now) {
          await supabase.from('user_roles').delete().eq('id', targetRole.id);
          return {
            success: false,
            status: 400,
            error: 'ROLE_EXPIRED',
            remove_role_id: targetRole.role_id,
            message: `Role **${targetRole.role_name}** đã hết hạn sử dụng nên không còn giá trị hoàn trả (đã dọn khỏi túi).`,
          };
        }

        const baseValue = getRoleBaseValue(targetRole, now);
        const refundLinhThach = Math.max(1, Math.floor(baseValue * 0.5));
        const newBalance = Number(user.linh_thach || 0) + refundLinhThach;

        await Promise.all([
          supabase.from('user_roles').delete().eq('id', targetRole.id),
          supabase.from('users').update({ linh_thach: newBalance, updated_at: now.toISOString() }).eq('user_id', cleanId),
        ]);

        return {
          success: true,
          category: 'role',
          role_id: targetRole.role_id,
          role_name: targetRole.role_name,
          remove_role_id: targetRole.role_id,
          base_value: baseValue,
          refund_linh_thach: refundLinhThach,
          linh_thach: newBalance,
          linh_thach_fmt: newBalance.toLocaleString('vi-VN'),
          message: `${em('su_sparkle')} Đã phân rã Role **${targetRole.role_name}**!\n• Giá trị định giá gốc: **${baseValue.toLocaleString('vi-VN')}** ${em('su_linhthach')} → Hoàn trả **50%**: **+${refundLinhThach.toLocaleString('vi-VN')}** ${em('su_linhthach')} **Linh Thạch**\n• Số dư hiện tại: **${newBalance.toLocaleString('vi-VN')} Linh Thạch**${targetRole.is_equipped ? '\n• Đã giải phóng Slot trang bị & gỡ Role khỏi hồ sơ Discord.' : ''}`,
        };
      }

      if (category === 'role') {
        return {
          success: false,
          status: 404,
          error: 'ROLE_NOT_OWNED',
          remove_role_id: '',
          message: `Không tìm thấy Role Quyền Năng \`${rawTarget}\` trong túi đồ \`/inv\` của bạn.`,
        };
      }
    }

    if (category === 'item' || category === '') {
      const { data: userItems } = await supabase
        .from('user_pet_items')
        .select('*')
        .eq('user_id', cleanId);

      const matchedItem = (userItems || []).find((row) =>
        row.item_id.toLowerCase() === normTarget
        || normalizeTargetText(EQUIPMENT_BY_ID[row.item_id]?.item_name) === normTarget);

      if (matchedItem) {
        const itemMeta = SHOP_EQUIP_BY_ID[matchedItem.item_id] || EQUIPMENT_BY_ID[matchedItem.item_id] || {};
        const fallbackByRarity = itemMeta.rarity_key === 'mythic' ? 6000 : itemMeta.rarity_key === 'epic' ? 2000 : itemMeta.rarity_key === 'rare' ? 750 : 250;
        const baseValue = Number(itemMeta.price || fallbackByRarity);
        const refundLinhThach = Math.max(1, Math.floor(baseValue * 0.5));
        const newBalance = Number(user.linh_thach || 0) + refundLinhThach;

        await Promise.all([
          supabase.from('user_pet_items').delete().eq('id', matchedItem.id),
          supabase.from('users').update({ linh_thach: newBalance, updated_at: now.toISOString() }).eq('user_id', cleanId),
        ]);

        return {
          success: true,
          category: 'item',
          item_id: matchedItem.item_id,
          item_name: itemMeta.item_name || matchedItem.item_id,
          remove_role_id: '',
          base_value: baseValue,
          refund_linh_thach: refundLinhThach,
          linh_thach: newBalance,
          linh_thach_fmt: newBalance.toLocaleString('vi-VN'),
          message: `${em('su_crossed_swords')} Đã phân rã Pháp Bảo **${itemMeta.item_name || matchedItem.item_id}**!\n• Giá trị gốc: **${baseValue.toLocaleString('vi-VN')}** ${em('su_linhthach')} → Hoàn trả **50%**: **+${refundLinhThach.toLocaleString('vi-VN')}** ${em('su_linhthach')} **Linh Thạch**\n• Số dư hiện tại: **${newBalance.toLocaleString('vi-VN')} Linh Thạch**`,
        };
      }

      if (category === 'item') {
        return {
          success: false,
          status: 404,
          error: 'ITEM_NOT_OWNED',
          remove_role_id: '',
          message: `Không tìm thấy Pháp Bảo \`${rawTarget}\` trong túi đồ \`/inv\` của bạn.`,
        };
      }
    }

    if (category === 'pet' || category === '') {
      const { data: userPets } = await supabase
        .from('user_pets')
        .select('*')
        .eq('user_id', cleanId);

      const matchedPet = (userPets || []).find((p) =>
        String(p.pet_id) === rawTarget
        || p.pet_type.toLowerCase() === normTarget
        || normalizeTargetText(p.pet_name) === normTarget);

      if (matchedPet) {
        if (matchedPet.pet_type === 'hoa_thach_nham_nham') {
          return { success: false, status: 400, error: 'STARTER_PET_PROTECTED', remove_role_id: '', message: 'Không thể phân rã Linh Thú khởi đầu **Hóa Thạch Nham Nham Thú**!' };
        }
        if (matchedPet.pet_type === 'cuu_vi_hong_ho') {
          return { success: false, status: 400, error: 'EXCLUSIVE_PET_PROTECTED', remove_role_id: '', message: 'Không thể phân rã Linh Thú độc tôn **Cửu Vĩ Hồng Hồ**!' };
        }
        if (matchedPet.is_active) {
          return { success: false, status: 400, error: 'ACTIVE_PET_PROTECTED', remove_role_id: '', message: `Không thể phân rã **${matchedPet.pet_name}** khi đang xuất trận! Hãy đổi sang Linh Thú khác bằng \`/linhthu hanh_dong:active\` trước.` };
        }
        if ((userPets || []).length <= 1) {
          return { success: false, status: 400, error: 'LAST_PET_PROTECTED', remove_role_id: '', message: 'Không thể phân rã Linh Thú cuối cùng trong kho!' };
        }

        const petMeta = SHOP_PET_BY_ID[matchedPet.pet_type] || PET_BY_TYPE[matchedPet.pet_type] || {};
        const fallbackByRarity = petMeta.rarity_key === 'mythic' ? 7000 : petMeta.rarity_key === 'epic' ? 2400 : petMeta.rarity_key === 'rare' ? 900 : 300;
        const baseValue = Number(petMeta.price || fallbackByRarity);
        const refundLinhThach = Math.max(1, Math.floor(baseValue * 0.5));
        const newBalance = Number(user.linh_thach || 0) + refundLinhThach;

        await Promise.all([
          supabase.from('user_pet_items').update({ equipped_to_pet: null, slot: null }).eq('user_id', cleanId).eq('equipped_to_pet', matchedPet.pet_type),
          supabase.from('user_pets').delete().eq('pet_id', matchedPet.pet_id),
          supabase.from('users').update({ linh_thach: newBalance, updated_at: now.toISOString() }).eq('user_id', cleanId),
        ]);

        return {
          success: true,
          category: 'pet',
          pet_type: matchedPet.pet_type,
          pet_name: matchedPet.pet_name,
          remove_role_id: '',
          base_value: baseValue,
          refund_linh_thach: refundLinhThach,
          linh_thach: newBalance,
          linh_thach_fmt: newBalance.toLocaleString('vi-VN'),
          message: `${em('su_pet_paw')} Đã giải phóng / phân rã Linh Thú **${matchedPet.pet_name}**!\n• Giá trị gốc: **${baseValue.toLocaleString('vi-VN')}** ${em('su_linhthach')} → Hoàn trả **50%**: **+${refundLinhThach.toLocaleString('vi-VN')}** ${em('su_linhthach')} **Linh Thạch**\n• Số dư hiện tại: **${newBalance.toLocaleString('vi-VN')} Linh Thạch**`,
        };
      }
    }

    return {
      success: false,
      status: 404,
      error: 'DISMANTLE_TARGET_NOT_FOUND',
      remove_role_id: '',
      message: `Không tìm thấy Role, Pháp Bảo hoặc Linh Thú nào khớp \`${rawTarget}\` trong túi đồ \`/inv\`.`,
    };
  });
}

export async function setActivePet(userId, petIdentifier) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID người dùng không hợp lệ.' };
  if (!supabase) return { success: false, status: 503, error: 'DB_UNAVAILABLE', message: 'Supabase chưa sẵn sàng.' };

  await ensureUserInitialized(cleanId);
  const { data: pets } = await supabase.from('user_pets').select('*').eq('user_id', cleanId);

  const needle = String(petIdentifier || '').trim().toLowerCase();
  const target = (pets || []).find((p) =>
    String(p.pet_id) === needle || p.pet_type.toLowerCase() === needle || p.pet_name.toLowerCase() === needle);

  if (!target) {
    return { success: false, status: 404, error: 'PET_NOT_FOUND', message: `Bạn không sở hữu Linh Thú '${petIdentifier}'.` };
  }

  await supabase.from('user_pets').update({ is_active: false }).eq('user_id', cleanId);
  await supabase.from('user_pets').update({ is_active: true }).eq('pet_id', target.pet_id);

  return {
    success: true,
    active_pet: { ...target, is_active: true },
    message: `${petEmoji(target.pet_type, em('su_pet_paw'))} Đã xuất trận Linh Thú **${target.pet_name}** (Lv.${target.level} • ${target.star} ${em('su_realm_star')})!`,
  };
}

export async function upgradePet(userId, petIdentifier, mode = 'level') {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID người dùng không hợp lệ.' };
  if (!supabase) return { success: false, status: 503, error: 'DB_UNAVAILABLE', message: 'Supabase chưa sẵn sàng.' };

  const { user } = await ensureUserInitialized(cleanId);
  if (!user) return { success: false, status: 500, error: 'USER_INIT_FAILED', message: 'Không thể khởi tạo hồ sơ.' };
  const { data: pets } = await supabase.from('user_pets').select('*').eq('user_id', cleanId);

  const needle = String(petIdentifier || '').trim().toLowerCase();
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
