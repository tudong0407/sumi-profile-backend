/**
 * src/services/dailyShopService.js
 * Hệ thống Shop Ngày (Vạn Bảo Lưu Động Các — Reset 00:00 UTC+7 mỗi ngày):
 * - Dùng CHUNG toàn server (lưu trên public.daily_shop_rotations theo YYYY-MM-DD UTC+7).
 * - 10 gian hàng giảm giá 15% - 40%, hạn mức mua rộng hơn shop thường.
 * - Có thể mở bán Pet Thần Thoại & Pháp Bảo Thần Thoại KHÔNG Độc Nhất (kèm sẵn bậc Khắc Ấn B hoặc A!).
 * - TUYỆT ĐỐI KHÔNG bao giờ đưa vật phẩm / Pet Độc Nhất (is_unique) hoặc đồ Độc Tôn Fuyumi vào Shop Ngày.
 */

import crypto from 'crypto';
import { supabase } from '../config/supabase.js';
import {
  PET_CATALOG,
  EQUIPMENT_CATALOG,
  SHOP_CONSUMABLE_BY_ID,
  FUYUMI_USER_ID,
  getEnchantBonusPct,
  normalizeEnchantGrade,
} from '../data/catalog.js';
import { em, petEmoji, itemEmoji, gradeEmoji, tierEmoji } from '../config/emojiHelper.js';
import {
  sanitizeUserId,
  ensureUserInitialized,
  pickCleanDisplayValue,
  computeRoleBuffTotals,
} from './profileService.js';

const dailyShopLocks = new Map();
const memRotations = new Map();

async function withDailyShopLock(userId, fn) {
  const prev = dailyShopLocks.get(userId) || Promise.resolve();
  let release;
  const cur = new Promise((r) => { release = r; });
  const queued = prev.then(() => cur);
  dailyShopLocks.set(userId, queued);
  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (dailyShopLocks.get(userId) === queued) dailyShopLocks.delete(userId);
  }
}

export function getVnDateKey(date = new Date()) {
  const vn = new Date(date.getTime() + 7 * 3600 * 1000);
  return vn.toISOString().slice(0, 10);
}

function createSeededRng(seedStr) {
  let hash = crypto.createHash('sha256').update(String(seedStr)).digest();
  let idx = 0;
  return () => {
    if (idx + 4 > hash.length) {
      hash = crypto.createHash('sha256').update(hash).digest();
      idx = 0;
    }
    const val = hash.readUInt32BE(idx);
    idx += 4;
    return val / 0x100000000;
  };
}

function pickOne(arr, rng) {
  if (!arr || arr.length === 0) return null;
  return arr[Math.floor(rng() * arr.length) % arr.length];
}

function isEligibleNonUniquePet(p) {
  return Boolean(p && !p.is_unique && !p.is_exclusive_fuyumi && p.pet_type !== 'cuu_vi_hong_ho' && p.rarity_key !== 'supreme');
}

function isEligibleNonUniqueEquip(e) {
  return Boolean(e && !e.is_unique && !e.is_exclusive_fuyumi && e.rarity_key !== 'supreme');
}

/**
 * Sinh danh sách 10 gian hàng Shop Ngày (deterministic theo dateKey hoặc custom rng cho test).
 */
export function generateDailyShopSlots(dateKey, customRng = null) {
  const rng = typeof customRng === 'function' ? customRng : createSeededRng(`sumi-daily-shop-v14:${dateKey}`);

  const petsRareEpic = PET_CATALOG.filter((p) => isEligibleNonUniquePet(p) && ['rare', 'epic'].includes(p.rarity_key));
  const petsEpicMythic = PET_CATALOG.filter((p) => isEligibleNonUniquePet(p) && ['epic', 'mythic'].includes(p.rarity_key));
  const petsMythicOnly = PET_CATALOG.filter((p) => isEligibleNonUniquePet(p) && p.rarity_key === 'mythic');

  const equipRareEpic = EQUIPMENT_CATALOG.filter((e) => isEligibleNonUniqueEquip(e) && ['rare', 'epic'].includes(e.rarity_key));
  const equipMythicWeapons = EQUIPMENT_CATALOG.filter((e) => isEligibleNonUniqueEquip(e) && e.rarity_key === 'mythic' && e.item_type === 'weapon');
  const equipMythicAll = EQUIPMENT_CATALOG.filter((e) => isEligibleNonUniqueEquip(e) && e.rarity_key === 'mythic');

  const slots = [];

  // Slot 1: Đá Khắc Ấn giá rẻ, hạn mức cao (15/ngày)
  const stone = SHOP_CONSUMABLE_BY_ID.enchant_stone;
  slots.push({
    slot_index: 1,
    kind: 'consumable',
    item_id: 'enchant_stone',
    name: stone?.name || 'Đá Khắc Ấn',
    rarity: 'Vật Phẩm',
    rarity_key: 'rare',
    base_price: 150,
    discount_pct: 25,
    price: 112,
    daily_limit: 15,
    bundle_qty: 1,
    enchant_grade: null,
  });

  // Slot 2: Thức Ăn Khám Phá giảm 30% (10/ngày)
  const foodId = pickOne(['food_survival_pill', 'food_yield_tea', 'food_speed_fruit'], rng);
  const foodCfg = SHOP_CONSUMABLE_BY_ID[foodId];
  const foodBase = Number(foodCfg?.price || 200);
  slots.push({
    slot_index: 2,
    kind: 'consumable',
    item_id: foodId,
    name: foodCfg?.name || 'Lương Thảo Khám Phá',
    rarity: 'Khám Phá',
    rarity_key: 'rare',
    base_price: foodBase,
    discount_pct: 30,
    price: Math.max(1, Math.round(foodBase * 0.70)),
    daily_limit: 12,
    bundle_qty: 1,
    enchant_grade: null,
  });

  // Slot 3: Vé Roll (Pháp Bảo / Pet / Linh Vực) giảm 25% (8/ngày)
  const ticketId = pickOne(['gacha_ticket_equip', 'gacha_ticket_pet', 'gacha_ticket_domain'], rng);
  const ticketCfg = SHOP_CONSUMABLE_BY_ID[ticketId];
  const ticketBase = Number(ticketCfg?.price || 50);
  slots.push({
    slot_index: 3,
    kind: 'consumable',
    item_id: ticketId,
    name: ticketCfg?.name || 'Vé Triệu Hồi',
    rarity: 'Gacha',
    rarity_key: 'epic',
    base_price: ticketBase,
    discount_pct: 25,
    price: Math.max(1, Math.round(ticketBase * 0.75)),
    daily_limit: 8,
    bundle_qty: 1,
    enchant_grade: null,
  });

  // Slot 4: Elixir Hồi Sinh hoặc Thẻ Reset Tháp giảm 20%
  const utilId = rng() < 0.5 ? 'explorer_revive_elixir' : 'tower_reset_card';
  const utilCfg = SHOP_CONSUMABLE_BY_ID[utilId];
  const utilBase = Number(utilCfg?.price || 200);
  slots.push({
    slot_index: 4,
    kind: 'consumable',
    item_id: utilId,
    name: utilCfg?.name || utilId,
    rarity: utilId === 'explorer_revive_elixir' ? 'Tiên Dược' : 'Tiện Ích',
    rarity_key: 'epic',
    base_price: utilBase,
    discount_pct: 20,
    price: Math.max(1, Math.round(utilBase * 0.80)),
    daily_limit: utilId === 'explorer_revive_elixir' ? 2 : 5,
    bundle_qty: 1,
    enchant_grade: null,
  });

  // Slot 5: Linh Thú Linh/Tiên Phẩm giá ưu đãi
  const pet1 = pickOne(petsRareEpic, rng);
  if (pet1) {
    const baseP = pet1.rarity_key === 'epic' ? 2400 : 750;
    const disc = 25;
    slots.push({
      slot_index: 5,
      kind: 'pet',
      item_id: pet1.pet_type,
      name: pet1.pet_name,
      rarity: pet1.rarity,
      rarity_key: pet1.rarity_key,
      element: pet1.element,
      base_price: baseP,
      discount_pct: disc,
      price: Math.round(baseP * (1 - disc / 100)),
      daily_limit: 2,
      bundle_qty: 1,
      enchant_grade: 'C',
    });
  }

  // Slot 6: Linh Thú Cao Cấp (40% là Thần Thoại KHÔNG Độc Nhất!)
  const pet2 = (rng() < 0.40 && petsMythicOnly.length > 0) ? pickOne(petsMythicOnly, rng) : pickOne(petsEpicMythic, rng);
  if (pet2) {
    const isMythic = pet2.rarity_key === 'mythic';
    const baseP = isMythic ? 9500 : 2800;
    const disc = isMythic ? 20 : 25;
    slots.push({
      slot_index: 6,
      kind: 'pet',
      item_id: pet2.pet_type,
      name: pet2.pet_name,
      rarity: pet2.rarity,
      rarity_key: pet2.rarity_key,
      element: pet2.element,
      base_price: baseP,
      discount_pct: disc,
      price: Math.round(baseP * (1 - disc / 100)),
      daily_limit: 1,
      bundle_qty: 1,
      enchant_grade: isMythic ? (rng() < 0.35 ? 'B' : 'C') : 'B',
    });
  }

  // Slot 7 & 8: 2 Pháp Bảo Linh/Tiên Phẩm đã Khắc Ấn sẵn B hoặc C
  for (let sIdx = 7; sIdx <= 8; sIdx += 1) {
    const eq = pickOne(equipRareEpic, rng);
    if (!eq) continue;
    const preGrade = rng() < 0.45 ? 'B' : 'C';
    const baseP = eq.rarity_key === 'epic' ? (preGrade === 'B' ? 2200 : 1700) : (preGrade === 'B' ? 850 : 600);
    const disc = 25;
    slots.push({
      slot_index: sIdx,
      kind: 'equipment',
      item_id: eq.item_id,
      item_type: eq.item_type,
      name: eq.item_name,
      rarity: eq.rarity,
      rarity_key: eq.rarity_key,
      element: eq.element,
      base_price: baseP,
      discount_pct: disc,
      price: Math.round(baseP * (1 - disc / 100)),
      daily_limit: 2,
      bundle_qty: 1,
      enchant_grade: preGrade,
    });
  }

  // Slot 9: TÂM ĐIỂM — Vũ Khí / Pháp Bảo Thần Thoại KHÔNG Độc Nhất đã nâng Khắc Ấn sẵn bậc B hoặc A!
  const mythicPool = equipMythicWeapons.length > 0 && rng() < 0.65 ? equipMythicWeapons : equipMythicAll;
  const mythicEq = pickOne(mythicPool, rng);
  if (mythicEq) {
    const gradeRoll = rng();
    const preGrade = gradeRoll < 0.25 ? 'A' : (gradeRoll < 0.80 ? 'B' : 'C');
    const baseP = preGrade === 'A' ? 12000 : preGrade === 'B' ? 8800 : 6800;
    const disc = 20;
    slots.push({
      slot_index: 9,
      kind: 'equipment',
      item_id: mythicEq.item_id,
      item_type: mythicEq.item_type,
      name: mythicEq.item_name,
      rarity: mythicEq.rarity,
      rarity_key: mythicEq.rarity_key,
      element: mythicEq.element,
      base_price: baseP,
      discount_pct: disc,
      price: Math.round(baseP * (1 - disc / 100)),
      daily_limit: 1,
      bundle_qty: 1,
      enchant_grade: preGrade,
    });
  }

  // Slot 10: SIÊU SALE ĐỘC QUYỀN NGÀY (-40%): Gói 3 Tinh Thạch Nâng Sao hoặc 5 Đá Khắc Ấn
  const isStarBundle = rng() < 0.5;
  slots.push({
    slot_index: 10,
    kind: 'consumable',
    item_id: isStarBundle ? 'pet_star_stone' : 'enchant_stone',
    name: isStarBundle ? 'Gói ×3 Tinh Thạch Nâng Sao' : 'Gói ×5 Đá Khắc Ấn',
    rarity: 'Siêu Sale',
    rarity_key: 'mythic',
    base_price: isStarBundle ? 300 : 750,
    discount_pct: 40,
    price: isStarBundle ? 180 : 450,
    daily_limit: 2,
    bundle_qty: isStarBundle ? 3 : 5,
    enchant_grade: null,
  });

  return slots;
}

export async function getOrCreateDailyShopRotation(date = new Date()) {
  const dateKey = getVnDateKey(date);

  if (supabase) {
    const { data: existing } = await supabase
      .from('daily_shop_rotations')
      .select('date_key, slots')
      .eq('date_key', dateKey)
      .maybeSingle();

    if (existing?.slots && Array.isArray(existing.slots) && existing.slots.length > 0) {
      return { date_key: dateKey, slots: existing.slots };
    }

    const slots = generateDailyShopSlots(dateKey);
    await supabase
      .from('daily_shop_rotations')
      .upsert({ date_key: dateKey, slots }, { onConflict: 'date_key' });
    return { date_key: dateKey, slots };
  }

  if (!memRotations.has(dateKey)) {
    memRotations.set(dateKey, generateDailyShopSlots(dateKey));
  }
  return { date_key: dateKey, slots: memRotations.get(dateKey) };
}

function formatSlotIcon(slot) {
  if (slot.kind === 'pet') return petEmoji(slot.item_id, em('su_pet_paw'));
  if (slot.kind === 'equipment') return itemEmoji(slot.item_id, em('su_crossed_swords'));
  return em(slot.item_id, '🎁');
}

export async function getDailyShopCatalog(userId = null, opts = {}) {
  const cleanId = sanitizeUserId(userId || '');
  const now = opts.now instanceof Date ? opts.now : new Date();
  const { date_key: dateKey, slots } = await getOrCreateDailyShopRotation(now);

  let balance = null;
  let buyMap = new Map();
  if (cleanId && supabase) {
    const [{ user }, { data: buys }] = await Promise.all([
      ensureUserInitialized(cleanId, {
        username: pickCleanDisplayValue(opts.username, opts.fallbackUsername),
        avatarUrl: pickCleanDisplayValue(opts.avatarUrl),
      }),
      supabase
        .from('daily_shop_purchases')
        .select('slot_index, bought_count')
        .eq('date_key', dateKey)
        .eq('user_id', cleanId),
    ]);
    if (user) balance = Number(user.linh_thach || 0);
    buyMap = new Map((buys || []).map((b) => [Number(b.slot_index), Number(b.bought_count || 0)]));
  }

  const lt = em('su_linhthach');
  const emblem = em('daily_shop_emblem', '🏮');
  const enrichedSlots = slots.map((s) => {
    const bought = buyMap.get(s.slot_index) || 0;
    const remaining = Math.max(0, Number(s.daily_limit || 1) - bought);
    const gradeTag = s.enchant_grade ? ` ${gradeEmoji(s.enchant_grade)} **[Bậc ${s.enchant_grade}]**` : '';
    const icon = formatSlotIcon(s);
    const tierBadge = ['mythic', 'epic'].includes(s.rarity_key) ? ` ${tierEmoji(s.rarity_key)}` : '';
    const line = `• **#${s.slot_index}** ${icon}${tierBadge} **${s.name}**${gradeTag} — **${Number(s.price).toLocaleString('vi-VN')}** ${lt} ~~${Number(s.base_price).toLocaleString('vi-VN')}~~ \`-${s.discount_pct}%\` • Còn \`${remaining}/${s.daily_limit}\``;
    return { ...s, bought_count: bought, remaining, line };
  });

  const summaryText = [
    `${emblem} **VẠN BẢO LƯU ĐỘNG CÁC — SHOP NGÀY (${dateKey})**`,
    balance !== null ? `• Số dư hiện tại: **${balance.toLocaleString('vi-VN')}** ${lt} • Reset mỗi ngày lúc **00:00 (UTC+7)**` : `• Reset mỗi ngày lúc **00:00 (UTC+7)**`,
    '',
    ...enrichedSlots.map((s) => s.line),
    '',
    `*Chọn số **#1 → #10** ở Dropdown bên dưới để mua ngay với giá ưu đãi!*`,
  ].join('\n');

  return {
    success: true,
    date_key: dateKey,
    balance,
    slots: enrichedSlots,
    title: `${emblem} SHOP NGÀY • VẠN BẢO LƯU ĐỘNG CÁC (${dateKey})`,
    summary_text: summaryText,
    message: summaryText,
  };
}

export async function buyDailyShopSlot(userId, rawSlotIndex, opts = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID không hợp lệ.' };
  if (!supabase) return { success: false, status: 503, error: 'DB_UNAVAILABLE', message: 'Supabase chưa sẵn sàng.' };

  const slotIndex = parseInt(String(rawSlotIndex || '').replace(/^#/, '').trim(), 10);
  if (!Number.isFinite(slotIndex) || slotIndex < 1 || slotIndex > 10) {
    return { success: false, status: 400, error: 'INVALID_SLOT', message: 'Gian hàng Shop Ngày phải từ `#1` đến `#10`.' };
  }

  return withDailyShopLock(cleanId, async () => {
    const now = opts.now instanceof Date ? opts.now : new Date();
    const nowIso = now.toISOString();
    const { date_key: dateKey, slots } = await getOrCreateDailyShopRotation(now);
    const slot = slots.find((s) => Number(s.slot_index) === slotIndex);
    if (!slot) {
      return { success: false, status: 404, error: 'SLOT_NOT_FOUND', message: `Không tìm thấy gian hàng #${slotIndex} hôm nay.` };
    }

    const { user } = await ensureUserInitialized(cleanId, {
      username: pickCleanDisplayValue(opts.username, opts.fallbackUsername),
      avatarUrl: pickCleanDisplayValue(opts.avatarUrl),
    });
    if (!user) return { success: false, status: 500, error: 'USER_INIT_FAILED', message: 'Không thể khởi tạo hồ sơ.' };

    // Kiểm tra hạn mức mua trong ngày
    const { data: buyRow } = await supabase
      .from('daily_shop_purchases')
      .select('bought_count')
      .eq('date_key', dateKey)
      .eq('user_id', cleanId)
      .eq('slot_index', slotIndex)
      .maybeSingle();

    const boughtCount = Number(buyRow?.bought_count || 0);
    const dailyLimit = Number(slot.daily_limit || 1);
    if (boughtCount >= dailyLimit) {
      return {
        success: false,
        status: 400,
        error: 'DAILY_SHOP_LIMIT_REACHED',
        message: `Bạn đã mua tối đa **${dailyLimit}/${dailyLimit}** lượt cho gian hàng **#${slotIndex} (${slot.name})** hôm nay! Quay lại sau **00:00** ngày mai nhé.`,
      };
    }

    // Áp thêm giảm giá Role (nếu có)
    const roleBuffs = await computeRoleBuffTotals(cleanId, Number(user.level || 1));
    const discountPct = Number(roleBuffs?.shopDiscountPct || 0);
    const finalPrice = discountPct > 0
      ? Math.max(1, Math.round(Number(slot.price) * (1 - discountPct / 100)))
      : Number(slot.price);

    const curBal = Number(user.linh_thach || 0);
    if (curBal < finalPrice) {
      return {
        success: false,
        status: 400,
        error: 'INSUFFICIENT_LINH_THACH',
        message: `Không đủ Linh Thạch! Cần **${finalPrice.toLocaleString('vi-VN')}** ${em('su_linhthach')}, hiện có **${curBal.toLocaleString('vi-VN')}**.`,
      };
    }

    // Trừ Linh Thạch & tăng lượt mua trước
    const nextBal = curBal - finalPrice;
    await Promise.all([
      supabase.from('users').update({ linh_thach: nextBal, updated_at: nowIso }).eq('user_id', cleanId),
      supabase.from('daily_shop_purchases').upsert({
        date_key: dateKey,
        user_id: cleanId,
        slot_index: slotIndex,
        bought_count: boughtCount + 1,
        updated_at: nowIso,
      }, { onConflict: 'date_key,user_id,slot_index' }),
    ]);

    // Trao vật phẩm / Pet / Pháp Bảo (giữ nguyên bậc Khắc Ấn sẵn nếu có!)
    const grantQty = Math.max(1, Number(slot.bundle_qty || 1));
    const gradeOrder = { D: 1, C: 2, B: 3, A: 4, S: 5 };
    let grantNote = '';
    if (slot.kind === 'consumable') {
      const { data: ex } = await supabase
        .from('user_inventory')
        .select('quantity')
        .eq('user_id', cleanId)
        .eq('item_id', slot.item_id)
        .maybeSingle();
      const nextQty = Number(ex?.quantity || 0) + grantQty;
      if (ex) {
        await supabase.from('user_inventory').update({ quantity: nextQty, item_category: 'consumable', updated_at: nowIso }).eq('user_id', cleanId).eq('item_id', slot.item_id);
      } else {
        await supabase.from('user_inventory').insert({ user_id: cleanId, item_id: slot.item_id, item_category: 'consumable', quantity: nextQty });
      }
      grantNote = `• Đã nhận **×${grantQty} ${slot.name}** (trong túi hiện có ×${nextQty}).`;
    } else if (slot.kind === 'pet') {
      const petDef = PET_CATALOG.find((p) => p.pet_type === slot.item_id);
      if (petDef) {
        const grade = normalizeEnchantGrade(slot.enchant_grade || 'C');
        const { data: exPet } = await supabase
          .from('user_pets')
          .select('pet_id, quantity, enchant_grade')
          .eq('user_id', cleanId)
          .eq('pet_type', petDef.pet_type)
          .maybeSingle();
        if (exPet) {
          const bestGrade = (gradeOrder[grade] || 1) > (gradeOrder[normalizeEnchantGrade(exPet.enchant_grade)] || 1)
            ? grade
            : normalizeEnchantGrade(exPet.enchant_grade);
          await supabase
            .from('user_pets')
            .update({ quantity: Number(exPet.quantity || 1) + 1, enchant_grade: bestGrade })
            .eq('pet_id', exPet.pet_id);
        } else {
          const mult = 1 + getEnchantBonusPct(grade) / 100;
          const pwr = Math.round(Number(petDef.base_power || ((petDef.base_atk || 100) + (petDef.base_def || 100) + (petDef.base_spd || 100)) * 10) * mult);
          await supabase.from('user_pets').insert({
            user_id: cleanId,
            pet_type: petDef.pet_type,
            pet_name: petDef.pet_name,
            pet_rarity: petDef.rarity,
            element: petDef.element,
            hax_skill: petDef.hax_skill || null,
            hax_description: petDef.hax_description || '',
            level: 1,
            star: 1,
            atk: Number(petDef.base_atk || 100),
            def: Number(petDef.base_def || 100),
            spd: Number(petDef.base_spd || 100),
            power_score: pwr,
            is_active: false,
            is_unique: false,
            status: 'ready',
            source: 'daily_shop',
            paid_price: finalPrice,
            enchant_grade: grade,
            enchant_pity: 0,
            quantity: 1,
          });
        }
        grantNote = `• Linh Thú ${petEmoji(petDef.pet_type)} **${petDef.pet_name}** (${gradeEmoji(grade)} Bậc **${grade}**) đã gia nhập Kho Linh Thú!`;
      }
    } else if (slot.kind === 'equipment') {
      const eqDef = EQUIPMENT_CATALOG.find((e) => e.item_id === slot.item_id);
      if (eqDef) {
        const grade = normalizeEnchantGrade(slot.enchant_grade || 'B');
        const { data: exEq } = await supabase
          .from('user_pet_items')
          .select('id, quantity, enchant_grade')
          .eq('user_id', cleanId)
          .eq('item_id', eqDef.item_id)
          .maybeSingle();
        if (exEq) {
          const bestGrade = (gradeOrder[grade] || 1) > (gradeOrder[normalizeEnchantGrade(exEq.enchant_grade)] || 1)
            ? grade
            : normalizeEnchantGrade(exEq.enchant_grade);
          await supabase
            .from('user_pet_items')
            .update({ quantity: Number(exEq.quantity || 1) + 1, enchant_grade: bestGrade })
            .eq('id', exEq.id);
        } else {
          await supabase.from('user_pet_items').insert({
            user_id: cleanId,
            item_id: eqDef.item_id,
            equipped_to_pet: null,
            slot: null,
            source: 'daily_shop',
            paid_price: finalPrice,
            enchant_grade: grade,
            enchant_pity: 0,
            quantity: 1,
          });
        }
        grantNote = `• Pháp Bảo ${itemEmoji(eqDef.item_id)} **${eqDef.item_name}** (${gradeEmoji(grade)} Bậc **${grade}** • +${getEnchantBonusPct(grade)}%) đã vào Kho Pháp Bảo!`;
      }
    }

    const lt = em('su_linhthach');
    return {
      success: true,
      date_key: dateKey,
      slot_index: slotIndex,
      item_name: slot.name,
      price_paid: finalPrice,
      linh_thach: nextBal,
      bought_count: boughtCount + 1,
      daily_limit: dailyLimit,
      message: [
        `${em('daily_shop_emblem', '🏮')} **MUA THÀNH CÔNG TẠI SHOP NGÀY!**`,
        grantNote,
        `• **Thanh toán:** **-${finalPrice.toLocaleString('vi-VN')}** ${lt} *(Giảm ${slot.discount_pct}%${discountPct > 0 ? ` + Role -${discountPct}%` : ''})*`,
        `• **Số dư còn lại:** **${nextBal.toLocaleString('vi-VN')}** ${lt} • Hạn mức hôm nay: \`${boughtCount + 1}/${dailyLimit}\``,
      ].join('\n'),
    };
  });
}
