/**
 * src/services/updateGateService.js
 * Cổng xác nhận Nhật Ký Cập Nhật lần đầu (First-Command Update Ack Gate — v1.2):
 * - Cache RAM `ackVersionCache` cho 0ms overhead sau khi user đã bấm Xác Nhận.
 * - Chỉ chặn 18 lệnh gameplay (KHÔNG bao giờ chặn Chat/Voice EXP, /updates, /wiki, /info, /profile, /rank, /top, /health).
 */

import { supabase } from '../config/supabase.js';
import { LATEST_VERSION, getChangelogPayload, getUpdateAckReward, getUpdateAckBundle } from '../data/changelogs.js';
import { em, farmEmoji } from '../config/emojiHelper.js';
import { sanitizeUserId, ensureUserInitialized } from './profileService.js';
import { invalidateInventoryCache } from './inventoryService.js';

const ackVersionCache = new Map();
const MAX_ACK_CACHE = 2000;
const ackLocks = new Map();

async function withAckLock(userId, fn) {
  const prev = ackLocks.get(userId) || Promise.resolve();
  let release;
  const cur = new Promise((res) => { release = res; });
  ackLocks.set(userId, prev.then(() => cur));
  await prev;
  try {
    return await fn();
  } finally {
    release();
  }
}

function setAckCache(userId, version) {
  if (!userId) return;
  if (ackVersionCache.has(userId)) ackVersionCache.delete(userId);
  ackVersionCache.set(userId, String(version || ''));
  while (ackVersionCache.size > MAX_ACK_CACHE) {
    const oldest = ackVersionCache.keys().next().value;
    if (!oldest) break;
    ackVersionCache.delete(oldest);
  }
}

export function clearUpdateGateCache(userId = null) {
  if (userId) {
    ackVersionCache.delete(String(userId).trim());
  } else {
    ackVersionCache.clear();
  }
}

export function markUserAckedInCache(userId, version = LATEST_VERSION) {
  const cleanId = sanitizeUserId(userId);
  if (cleanId) setAckCache(cleanId, version);
}

/**
 * Kiểm tra user đã xác nhận bản cập nhật LATEST_VERSION hay chưa.
 * Trả về `{ blocked: false }` nếu hợp lệ hoặc chưa tồn tại user (user mới tạo ở 1.2).
 */
export async function checkUpdateGate(userId) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId || !supabase) {
    return { blocked: false, version: LATEST_VERSION };
  }

  const cachedVer = ackVersionCache.get(cleanId);
  if (cachedVer === LATEST_VERSION) {
    return { blocked: false, version: cachedVer };
  }

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('last_seen_update_version')
      .eq('user_id', cleanId)
      .maybeSingle();

    if (error) {
      // Nếu lỗi transient DB, không chặn gameplay nhầm
      return { blocked: false, version: LATEST_VERSION };
    }

    if (!user) {
      // User hoàn toàn mới (sẽ được ensureUserInitialized khởi tạo ở LATEST_VERSION)
      setAckCache(cleanId, LATEST_VERSION);
      return { blocked: false, version: LATEST_VERSION };
    }

    const userVer = String(user.last_seen_update_version || '1.1').trim();
    if (userVer === LATEST_VERSION) {
      setAckCache(cleanId, LATEST_VERSION);
      return { blocked: false, version: userVer };
    }

    const logPayload = getChangelogPayload(LATEST_VERSION, 1);
    const rewardLt = getUpdateAckReward(LATEST_VERSION);
    const bundle = getUpdateAckBundle(LATEST_VERSION);
    return {
      blocked: true,
      user_version: userVer,
      latest_version: LATEST_VERSION,
      ack_reward_lt: rewardLt,
      ack_reward_summary: bundle.summary,
      payload: {
        success: false,
        status: 200,
        error: 'UPDATE_ACK_REQUIRED',
        needs_update_ack: 'true',
        update_version: LATEST_VERSION,
        ack_reward_lt: rewardLt,
        ack_reward_summary: bundle.summary,
        update_title: `${em('su_sparkle')} CẬP NHẬT MỚI v${LATEST_VERSION} — ĐỌC & NHẬN GÓI QUÀ LỚN!`,
        update_description: [
          `Tiên Giới SuMi vừa nâng cấp lên **v${LATEST_VERSION}**! Hãy đọc tóm tắt bên dưới rồi bấm nút **Xác Nhận Cập Nhật** để nhận ngay **${bundle.summary}** và mở khóa tiếp tục tu luyện.`,
          `*(Dùng \`/updates\` để xem đủ ${logPayload.total_pages} trang chi tiết)*`,
          '',
          logPayload.description,
        ].join('\n').slice(0, 3950),
        message: `Tiên Giới đã cập nhật lên **v${LATEST_VERSION}**! Hãy bấm nút **Tôi Đã Đọc & Xác Nhận Cập Nhật** để nhận **${bundle.summary}** và tiếp tục chơi.`,
        footer: '',
      },
    };
  } catch {
    return { blocked: false, version: LATEST_VERSION };
  }
}

async function grantInventoryItemIgnoreCap(userId, itemId, itemCategory, deltaQty, nowIso) {
  const addQty = Math.max(0, Math.floor(Number(deltaQty || 0)));
  if (!supabase || addQty <= 0) return addQty;
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
      .update({ quantity: nextQty, item_category: itemCategory || 'consumable', updated_at: nowIso })
      .eq('user_id', userId)
      .eq('item_id', itemId);
  } else {
    await supabase.from('user_inventory').insert({
      user_id: userId,
      item_id: itemId,
      item_category: itemCategory || 'consumable',
      quantity: nextQty,
      updated_at: nowIso,
    });
  }
  return nextQty;
}

export async function acknowledgeUpdate(userId) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) {
    return { success: false, status: 400, error: 'INVALID_USER_ID', needs_update_ack: 'false', message: 'ID người dùng không hợp lệ.' };
  }

  return withAckLock(cleanId, async () => {
    const bundle = getUpdateAckBundle(LATEST_VERSION);
    const rewardLt = bundle.linh_thach;
    const rewardTt = bundle.red_gold_crystals;
    const rewardEssence = bundle.farm_essence;
    const rewardItems = bundle.items || [];
    const lt = em('su_linhthach');

    if (!supabase) {
      setAckCache(cleanId, LATEST_VERSION);
      return {
        success: true,
        acknowledged_version: LATEST_VERSION,
        needs_update_ack: 'false',
        granted_lt: rewardLt,
        granted_tt: rewardTt,
        granted_farm_essence: rewardEssence,
        granted_items: rewardItems.map((i) => ({ item_id: i.item_id, quantity: i.quantity, ignore_cap: Boolean(i.ignore_cap) })),
        already_acknowledged: false,
        message: `${em('su_sparkle')} Đã xác nhận cập nhật **v${LATEST_VERSION}** & nhận thưởng **${bundle.summary}**!`,
      };
    }

    await ensureUserInitialized(cleanId);
    const { data: user } = await supabase
      .from('users')
      .select('linh_thach, red_gold_crystals, farm_essence, last_seen_update_version')
      .eq('user_id', cleanId)
      .maybeSingle();

    const currentVer = String(user?.last_seen_update_version || '').trim();
    const currentBal = Number(user?.linh_thach || 0);
    if (currentVer === LATEST_VERSION) {
      setAckCache(cleanId, LATEST_VERSION);
      return {
        success: true,
        acknowledged_version: LATEST_VERSION,
        needs_update_ack: 'false',
        granted_lt: 0,
        granted_tt: 0,
        granted_farm_essence: 0,
        granted_items: [],
        already_acknowledged: true,
        linh_thach: currentBal,
        message: `${em('su_sparkle')} Bạn đã xác nhận bản cập nhật **v${LATEST_VERSION}** trước đó rồi! *(Số dư: **${currentBal.toLocaleString('vi-VN')}** ${lt})*`,
      };
    }

    const nextBal = currentBal + rewardLt;
    const nextTt = Number(user?.red_gold_crystals || 0) + rewardTt;
    const nextEssence = Number(user?.farm_essence || 0) + rewardEssence;
    const nowIso = new Date().toISOString();
    const { data: updatedRows, error: updErr } = await supabase
      .from('users')
      .update({
        last_seen_update_version: LATEST_VERSION,
        linh_thach: nextBal,
        red_gold_crystals: nextTt,
        farm_essence: nextEssence,
        updated_at: nowIso,
      })
      .eq('user_id', cleanId)
      .or(`last_seen_update_version.is.null,last_seen_update_version.neq.${LATEST_VERSION}`)
      .select('linh_thach, red_gold_crystals, farm_essence, last_seen_update_version');

    setAckCache(cleanId, LATEST_VERSION);

    if (updErr) {
      throw new Error(`Update ack failed: ${updErr.message}`);
    }

    const updatedRow = Array.isArray(updatedRows) ? updatedRows[0] : updatedRows;
    if (!updatedRow) {
      return {
        success: true,
        acknowledged_version: LATEST_VERSION,
        needs_update_ack: 'false',
        granted_lt: 0,
        granted_tt: 0,
        granted_farm_essence: 0,
        granted_items: [],
        already_acknowledged: true,
        linh_thach: currentBal,
        message: `${em('su_sparkle')} Bạn đã xác nhận bản cập nhật **v${LATEST_VERSION}** trước đó rồi!`,
      };
    }

    // Cấp vật phẩm quà tặng — BỎ QUA GIỚI HẠN TRẦN (ví dụ +5 Thẻ Reset Tháp đẩy thẳng lên bất kể túi đang có 15/15!)
    const grantedItems = [];
    for (const it of rewardItems) {
      const nextQty = await grantInventoryItemIgnoreCap(cleanId, it.item_id, it.item_category || 'consumable', it.quantity, nowIso);
      grantedItems.push({ item_id: it.item_id, quantity: it.quantity, total_now: nextQty, label: it.label });
    }
    invalidateInventoryCache(cleanId);

    const finalBal = Number(updatedRow.linh_thach ?? nextBal);
    const finalTt = Number(updatedRow.red_gold_crystals ?? nextTt);
    const finalEss = Number(updatedRow.farm_essence ?? nextEssence);
    const rewardLines = [
      `• **+${rewardLt.toLocaleString('vi-VN')}** ${lt} Linh Thạch *(Ví: **${finalBal.toLocaleString('vi-VN')} LT**)*`,
      ...(rewardTt > 0 ? [`• **+${rewardTt}** ${em('red_gold_crystal', em('su_sparkle'))} Xích Kim Tinh Thạch (TT) *(Hiện có: **${finalTt} TT**)*`] : []),
      ...(rewardEssence > 0 ? [`• **+${rewardEssence.toLocaleString('vi-VN')}** ${farmEmoji('farm_essence') || em('su_sprout')} Linh Quả *(Hiện có: **${finalEss.toLocaleString('vi-VN')}**)*`] : []),
      ...grantedItems.map((gi) => `• **+${gi.quantity}** ${em(gi.item_id, em('su_sparkle'))} **${gi.label || gi.item_id}** *(Hiện có trong túi: **${gi.total_now}** — quà không giới hạn trần)*`),
    ];

    return {
      success: true,
      acknowledged_version: LATEST_VERSION,
      needs_update_ack: 'false',
      granted_lt: rewardLt,
      granted_tt: rewardTt,
      granted_farm_essence: rewardEssence,
      granted_items: grantedItems,
      already_acknowledged: false,
      linh_thach: finalBal,
      red_gold_crystals: finalTt,
      farm_essence: finalEss,
      message: `${em('su_sparkle')} **Xác nhận cập nhật v${LATEST_VERSION} thành công & nhận trọn gói quà mở bản!**\n${rewardLines.join('\n')}\nToàn bộ lệnh tu luyện đã sẵn sàng — chúc đạo hữu tu luyện vui vẻ!`,
    };
  });
}
