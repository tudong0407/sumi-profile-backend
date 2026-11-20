/**
 * src/services/economyService.js
 * Hệ thống Kinh Tế Linh Thạch:
 * - /daily: Điểm danh nhận 40–60 Linh Thạch + Streak 7 ngày (theo ngày UTC+7).
 * - /doiqua: Phế Tu Vi Đổi Linh Bảo (1.000 EXP -> 10 Linh Thạch), CHO PHÉP TỤT CẤP đến tối thiểu Lv.1, 0 EXP.
 * - /roll: Gacha Pháp Bảo / Linh Thú (50 Linh Thạch/lượt, 450/10 lượt, 60/25/14/1%, khóa 9 Thần Thoại Độc Nhất).
 */

import { supabase } from '../config/supabase.js';
import {
  EQUIPMENT_CATALOG,
  EQUIPMENT_BY_ID,
  PET_CATALOG,
  PET_BY_TYPE,
  LEVEL_ROLE_MILESTONES,
  MYTHIC_UNIQUE_ITEM_IDS,
} from '../data/catalog.js';
import {
  sanitizeUserId,
  getRealmByLevel,
  getExpForNextLevel,
  getMaxRoleSlotsByLevel,
  ensureUserInitialized,
  pickCleanDisplayValue,
} from './profileService.js';

export const DAILY_BASE_MIN = 40;
export const DAILY_BASE_MAX = 60;
export const DOIQUA_EXP_UNIT = 1000;
export const DOIQUA_LINH_THACH_PER_UNIT = 10;
export const ROLL_SINGLE_COST = 50;
export const ROLL_TEN_COST = 450;

const userLocks = new Map();

async function withLock(userId, fn) {
  const prev = userLocks.get(userId) || Promise.resolve();
  let release;
  const current = new Promise((res) => { release = res; });
  const queued = prev.then(() => current);
  userLocks.set(userId, queued);
  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (userLocks.get(userId) === queued) userLocks.delete(userId);
  }
}

function getVnDateKey(date = new Date()) {
  const vnTime = new Date(date.getTime() + 7 * 3600 * 1000);
  return vnTime.toISOString().slice(0, 10);
}

function getPrevVnDateKey(date = new Date()) {
  return getVnDateKey(new Date(date.getTime() - 24 * 3600 * 1000));
}

function randomInt(min, max, rng = Math.random) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

/**
 * Tính tổng EXP tích lũy từ Lv.1 0 EXP đến trạng thái (level, exp)
 */
export function computeTotalAccumulatedExp(level, exp) {
  const lvl = Math.max(1, Number(level) || 1);
  let total = Math.max(0, Number(exp) || 0);
  for (let l = 1; l < lvl; l += 1) {
    total += getExpForNextLevel(l);
  }
  return total;
}

/**
 * Quy đổi ngược tổng EXP tích lũy thành (level, exp) mới (dừng tối thiểu ở Lv.1, 0 EXP)
 */
export function decomposeTotalExp(totalExp) {
  let remaining = Math.max(0, Math.floor(Number(totalExp) || 0));
  let level = 1;
  while (level < 100) {
    const needed = getExpForNextLevel(level);
    if (remaining >= needed) {
      remaining -= needed;
      level += 1;
    } else {
      break;
    }
  }
  if (level >= 100) {
    level = 100;
    remaining = Math.min(500000, remaining);
  }
  return {
    level,
    exp: remaining,
    nextLevelExp: getExpForNextLevel(level),
    realm: getRealmByLevel(level),
    maxRoleSlots: getMaxRoleSlotsByLevel(level),
  };
}

/**
 * Điểm danh hàng ngày (/daily)
 */
export async function claimDaily(userId, options = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) {
    return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID người dùng không hợp lệ.' };
  }

  return withLock(cleanId, async () => {
    const now = options.now instanceof Date ? options.now : new Date();
    const rng = typeof options.rng === 'function' ? options.rng : Math.random;
    const username = pickCleanDisplayValue(options.username, options.fallbackUsername);
    const avatarUrl = pickCleanDisplayValue(options.avatarUrl);

    if (!supabase) {
      return { success: false, status: 503, error: 'DB_UNAVAILABLE', message: 'Supabase chưa sẵn sàng.' };
    }

    const { user } = await ensureUserInitialized(cleanId, { username, avatarUrl });
    if (!user) return { success: false, status: 500, error: 'USER_INIT_FAILED', message: 'Không thể khởi tạo hồ sơ.' };
    const todayKey = getVnDateKey(now);
    const yesterdayKey = getPrevVnDateKey(now);
    const lastKey = user.last_daily ? getVnDateKey(new Date(user.last_daily)) : null;

    if (lastKey === todayKey) {
      return {
        success: true,
        already_claimed: true,
        streak: user.streak || 1,
        reward: 0,
        linh_thach: Number(user.linh_thach || 0),
        message: `Hôm nay đạo hữu đã điểm danh rồi! Chuỗi hiện tại: **${user.streak || 1} ngày**.`,
      };
    }

    const newStreak = lastKey === yesterdayKey ? (Number(user.streak || 0) + 1) : 1;
    const cycleDay = ((newStreak - 1) % 7) + 1;
    const baseReward = randomInt(DAILY_BASE_MIN, DAILY_BASE_MAX, rng);
    const streakBonusPct = cycleDay === 7 ? 0.5 : (cycleDay - 1) * 0.05;
    const reward = Math.round(baseReward * (1 + streakBonusPct));
    const newBalance = Number(user.linh_thach || 0) + reward;

    const { error } = await supabase
      .from('users')
      .update({
        linh_thach: newBalance,
        streak: newStreak,
        last_daily: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .eq('user_id', cleanId);

    if (error) throw new Error(`Daily update failed: ${error.message}`);

    return {
      success: true,
      already_claimed: false,
      streak: newStreak,
      cycle_day: cycleDay,
      base_reward: baseReward,
      reward,
      linh_thach: newBalance,
      message: `Điểm danh ngày thứ **${newStreak}** (Chuỗi ${cycleDay}/7) thành công! Nhận **+${reward} Linh Thạch** (Số dư: **${newBalance.toLocaleString('vi-VN')}**).`,
    };
  });
}

/**
 * Phế Tu Vi Đổi Linh Bảo (/doiqua): 1.000 EXP -> 10 Linh Thạch (CHO PHÉP TỤT CẤP)
 */
export async function convertExpToLinhThach(userId, amountExp, options = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) {
    return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID người dùng không hợp lệ.' };
  }

  const parsedAmount = Math.floor(Number(amountExp) || 0);
  if (parsedAmount < DOIQUA_EXP_UNIT || parsedAmount % DOIQUA_EXP_UNIT !== 0) {
    return {
      success: false,
      status: 400,
      error: 'INVALID_EXP_AMOUNT',
      message: `Số EXP muốn phế phải là bội số của **${DOIQUA_EXP_UNIT.toLocaleString('vi-VN')}** (ví dụ: 1000, 2000, 5000).`,
    };
  }

  return withLock(cleanId, async () => {
    if (!supabase) {
      return { success: false, status: 503, error: 'DB_UNAVAILABLE', message: 'Supabase chưa sẵn sàng.' };
    }

    const { user } = await ensureUserInitialized(cleanId, {
      username: pickCleanDisplayValue(options.username, options.fallbackUsername),
      avatarUrl: pickCleanDisplayValue(options.avatarUrl),
    });
    if (!user) return { success: false, status: 500, error: 'USER_INIT_FAILED', message: 'Không thể khởi tạo hồ sơ.' };

    const oldLevel = Number(user.level || 1);
    const oldExp = Number(user.exp || 0);
    const totalAvailable = computeTotalAccumulatedExp(oldLevel, oldExp);

    if (parsedAmount > totalAvailable) {
      const maxConvertible = Math.floor(totalAvailable / DOIQUA_EXP_UNIT) * DOIQUA_EXP_UNIT;
      return {
        success: false,
        status: 400,
        error: 'INSUFFICIENT_EXP',
        total_available_exp: totalAvailable,
        max_convertible_exp: maxConvertible,
        message: `Tu vi tích lũy không đủ! Bạn chỉ có thể phế tối đa **${maxConvertible.toLocaleString('vi-VN')} EXP** (đổi được **${(maxConvertible / DOIQUA_EXP_UNIT) * DOIQUA_LINH_THACH_PER_UNIT} Linh Thạch**).`,
      };
    }

    const afterTotal = totalAvailable - parsedAmount;
    const nextState = decomposeTotalExp(afterTotal);
    const gainedLinhThach = (parsedAmount / DOIQUA_EXP_UNIT) * DOIQUA_LINH_THACH_PER_UNIT;
    const newBalance = Number(user.linh_thach || 0) + gainedLinhThach;
    const demoted = nextState.level < oldLevel;

    const revokedRoleIds = [];
    if (demoted) {
      for (const m of LEVEL_ROLE_MILESTONES) {
        if (m.level <= oldLevel && m.level > nextState.level) {
          revokedRoleIds.push(m.roleId);
        }
      }
    }

    const { error } = await supabase
      .from('users')
      .update({
        level: nextState.level,
        exp: nextState.exp,
        max_role_slots: nextState.maxRoleSlots,
        linh_thach: newBalance,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', cleanId);

    if (error) throw new Error(`Convert EXP update failed: ${error.message}`);

    return {
      success: true,
      spent_exp: parsedAmount,
      linh_thach_gained: gainedLinhThach,
      linh_thach: newBalance,
      demoted,
      old_level: oldLevel,
      new_level: nextState.level,
      old_exp: oldExp,
      new_exp: nextState.exp,
      next_level_exp: nextState.nextLevelExp,
      new_realm: nextState.realm,
      revoked_level_role_ids: revokedRoleIds,
      message: demoted
        ? `Phế **${parsedAmount.toLocaleString('vi-VN')} EXP** (Tụt cấp **Lv.${oldLevel} → Lv.${nextState.level}** • ${nextState.realm}), thu về **+${gainedLinhThach} Linh Thạch**!`
        : `Phế **${parsedAmount.toLocaleString('vi-VN')} EXP** thành công (Lv.${nextState.level} • ${nextState.exp.toLocaleString('vi-VN')} EXP), thu về **+${gainedLinhThach} Linh Thạch**!`,
    };
  });
}

function rollRarityByRate(rng = Math.random) {
  const r = rng() * 100;
  if (r < 1.0) return 'mythic';
  if (r < 15.0) return 'epic';
  if (r < 40.0) return 'rare';
  return 'common';
}

async function addInventoryQuantity(userId, itemId, category, delta) {
  const { data: existing } = await supabase
    .from('user_inventory')
    .select('quantity')
    .eq('user_id', userId)
    .eq('item_id', itemId)
    .maybeSingle();

  const nextQty = Math.max(0, Number(existing?.quantity || 0) + delta);
  if (existing) {
    await supabase
      .from('user_inventory')
      .update({ quantity: nextQty, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('item_id', itemId);
  } else if (nextQty > 0) {
    await supabase.from('user_inventory').insert({
      user_id: userId,
      item_id: itemId,
      item_category: category,
      quantity: nextQty,
    });
  }
  return nextQty;
}

/**
 * Quay Gacha Pháp Bảo / Linh Thú (/roll)
 */
export async function rollGacha(userId, options = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) {
    return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID người dùng không hợp lệ.' };
  }

  const pool = options.pool === 'pet' ? 'pet' : 'equipment';
  const count = Number(options.count) === 10 ? 10 : 1;
  const useTicket = Boolean(options.useTicket);
  const rng = typeof options.rng === 'function' ? options.rng : Math.random;

  return withLock(cleanId, async () => {
    if (!supabase) {
      return { success: false, status: 503, error: 'DB_UNAVAILABLE', message: 'Supabase chưa sẵn sàng.' };
    }

    const { user } = await ensureUserInitialized(cleanId, {
      username: pickCleanDisplayValue(options.username, options.fallbackUsername),
      avatarUrl: pickCleanDisplayValue(options.avatarUrl),
    });
    if (!user) return { success: false, status: 500, error: 'USER_INIT_FAILED', message: 'Không thể khởi tạo hồ sơ.' };

    const ticketId = pool === 'pet' ? 'gacha_ticket_pet' : 'gacha_ticket_equip';
    let paidWith = 'linh_thach';
    let cost = count === 10 ? ROLL_TEN_COST : ROLL_SINGLE_COST;

    if (useTicket) {
      const { data: invTicket } = await supabase
        .from('user_inventory')
        .select('quantity')
        .eq('user_id', cleanId)
        .eq('item_id', ticketId)
        .maybeSingle();
      if (Number(invTicket?.quantity || 0) >= count) {
        await addInventoryQuantity(cleanId, ticketId, 'consumable', -count);
        paidWith = ticketId;
        cost = 0;
      }
    }

    if (paidWith === 'linh_thach') {
      const currentBal = Number(user.linh_thach || 0);
      if (currentBal < cost) {
        return {
          success: false,
          status: 400,
          error: 'INSUFFICIENT_LINH_THACH',
          required: cost,
          balance: currentBal,
          message: `Không đủ Linh Thạch! Cần **${cost} Linh Thạch** (hiện có **${currentBal}**).`,
        };
      }
      await supabase
        .from('users')
        .update({ linh_thach: currentBal - cost, updated_at: new Date().toISOString() })
        .eq('user_id', cleanId);
      user.linh_thach = currentBal - cost;
    }

    const standardPets = PET_CATALOG.filter((p) => !p.is_exclusive_fuyumi);
    const results = [];
    let refundLinhThach = 0;
    let bonusStarStones = 0;

    for (let i = 0; i < count; i += 1) {
      const rarityKey = rollRarityByRate(rng);

      if (pool === 'equipment') {
        let candidates = EQUIPMENT_CATALOG.filter((it) => it.rarity_key === rarityKey);
        if (rarityKey === 'mythic') {
          const { data: ownedMythics } = await supabase
            .from('user_pet_items')
            .select('item_id')
            .in('item_id', [...MYTHIC_UNIQUE_ITEM_IDS]);
          const takenSet = new Set((ownedMythics || []).map((r) => r.item_id));
          candidates = candidates.filter((c) => !takenSet.has(c.item_id));
          if (candidates.length === 0) {
            refundLinhThach += 500;
            bonusStarStones += 5;
            results.push({
              kind: 'refund',
              rarity: 'Thần Thoại',
              name: 'Thần Thoại Độc Nhất Đã Hết — Hoàn Quà Bồi Thường',
              compensation: '+500 Linh Thạch & +5 Tinh Thạch Nâng Sao',
            });
            continue;
          }
        }

        const picked = candidates[Math.floor(rng() * candidates.length)];
        const { data: ownItem } = await supabase
          .from('user_pet_items')
          .select('id')
          .eq('user_id', cleanId)
          .eq('item_id', picked.item_id)
          .maybeSingle();

        if (ownItem) {
          const dupRefund = picked.rarity_key === 'epic' ? 120 : picked.rarity_key === 'rare' ? 40 : 15;
          const dupStone = picked.rarity_key === 'epic' ? 2 : picked.rarity_key === 'rare' ? 1 : 0;
          refundLinhThach += dupRefund;
          bonusStarStones += dupStone;
          results.push({
            kind: 'duplicate_item',
            item_id: picked.item_id,
            name: picked.item_name,
            rarity: picked.rarity,
            refund_linh_thach: dupRefund,
            bonus_star_stones: dupStone,
          });
        } else {
          await supabase.from('user_pet_items').insert({
            user_id: cleanId,
            item_id: picked.item_id,
            equipped_to_pet: null,
            slot: null,
          });
          results.push({
            kind: 'new_item',
            item_id: picked.item_id,
            name: picked.item_name,
            rarity: picked.rarity,
            slot: picked.item_type,
          });
        }
      } else {
        const candidates = standardPets.filter((p) => p.rarity_key === rarityKey);
        const picked = candidates[Math.floor(rng() * candidates.length)];
        const { data: ownPet } = await supabase
          .from('user_pets')
          .select('pet_id')
          .eq('user_id', cleanId)
          .eq('pet_type', picked.pet_type)
          .maybeSingle();

        if (ownPet) {
          const dupRefund = picked.rarity_key === 'mythic' ? 300 : picked.rarity_key === 'epic' ? 120 : picked.rarity_key === 'rare' ? 45 : 15;
          const dupStone = picked.rarity_key === 'mythic' ? 3 : picked.rarity_key === 'epic' ? 2 : 1;
          refundLinhThach += dupRefund;
          bonusStarStones += dupStone;
          results.push({
            kind: 'duplicate_pet',
            pet_type: picked.pet_type,
            name: picked.pet_name,
            rarity: picked.rarity,
            refund_linh_thach: dupRefund,
            bonus_star_stones: dupStone,
          });
        } else {
          await supabase.from('user_pets').insert({
            user_id: cleanId,
            pet_name: picked.pet_name,
            pet_type: picked.pet_type,
            pet_rarity: picked.rarity,
            element: picked.element,
            hax_skill: picked.hax_skill,
            hax_description: picked.hax_description,
            level: 1,
            star: 1,
            atk: picked.base_atk,
            def: picked.base_def,
            spd: picked.base_spd,
            is_active: false,
          });
          results.push({
            kind: 'new_pet',
            pet_type: picked.pet_type,
            name: picked.pet_name,
            rarity: picked.rarity,
            element: picked.element,
          });
        }
      }
    }

    let finalBalance = Number(user.linh_thach || 0);
    if (refundLinhThach > 0) {
      finalBalance += refundLinhThach;
      await supabase
        .from('users')
        .update({ linh_thach: finalBalance, updated_at: new Date().toISOString() })
        .eq('user_id', cleanId);
    }
    if (bonusStarStones > 0) {
      await addInventoryQuantity(cleanId, 'pet_star_stone', 'consumable', bonusStarStones);
    }

    return {
      success: true,
      pool,
      count,
      paid_with: paidWith,
      cost,
      refund_linh_thach: refundLinhThach,
      bonus_star_stones: bonusStarStones,
      linh_thach: finalBalance,
      results,
    };
  });
}
