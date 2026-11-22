/**
 * src/services/updateGateService.js
 * Cổng xác nhận Nhật Ký Cập Nhật lần đầu (First-Command Update Ack Gate — v1.2):
 * - Cache RAM `ackVersionCache` cho 0ms overhead sau khi user đã bấm Xác Nhận.
 * - Chỉ chặn 18 lệnh gameplay (KHÔNG bao giờ chặn Chat/Voice EXP, /updates, /wiki, /info, /profile, /rank, /top, /health).
 */

import { supabase } from '../config/supabase.js';
import { LATEST_VERSION, getChangelogPayload, getUpdateAckReward } from '../data/changelogs.js';
import { em } from '../config/emojiHelper.js';
import { sanitizeUserId, ensureUserInitialized } from './profileService.js';

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

    const logPayload = getChangelogPayload(LATEST_VERSION);
    const rewardLt = getUpdateAckReward(LATEST_VERSION);
    return {
      blocked: true,
      user_version: userVer,
      latest_version: LATEST_VERSION,
      ack_reward_lt: rewardLt,
      payload: {
        success: false,
        status: 200,
        error: 'UPDATE_ACK_REQUIRED',
        needs_update_ack: 'true',
        update_version: LATEST_VERSION,
        ack_reward_lt: rewardLt,
        update_title: `${em('su_sparkle')} CẬP NHẬT MỚI v${LATEST_VERSION} — ĐỌC & NHẬN +${rewardLt.toLocaleString('vi-VN')} LT`,
        update_description: [
          `Tiên Giới SuMi vừa nâng cấp lên **v${LATEST_VERSION}**! Hãy đọc tóm tắt bên dưới rồi bấm nút **Xác Nhận Cập Nhật** để nhận ngay **+${rewardLt.toLocaleString('vi-VN')} Linh Thạch** và mở khóa tiếp tục tu luyện.`,
          '',
          logPayload.description,
        ].join('\n').slice(0, 3950),
        message: `Tiên Giới đã cập nhật lên **v${LATEST_VERSION}**! Hãy bấm nút **Tôi Đã Đọc & Xác Nhận Cập Nhật** để nhận **+${rewardLt.toLocaleString('vi-VN')} Linh Thạch** và tiếp tục chơi.`,
        footer: '',
      },
    };
  } catch {
    return { blocked: false, version: LATEST_VERSION };
  }
}

export async function acknowledgeUpdate(userId) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) {
    return { success: false, status: 400, error: 'INVALID_USER_ID', needs_update_ack: 'false', message: 'ID người dùng không hợp lệ.' };
  }

  return withAckLock(cleanId, async () => {
    const rewardLt = getUpdateAckReward(LATEST_VERSION);
    const lt = em('su_linhthach');

    if (!supabase) {
      setAckCache(cleanId, LATEST_VERSION);
      return {
        success: true,
        acknowledged_version: LATEST_VERSION,
        needs_update_ack: 'false',
        granted_lt: rewardLt,
        already_acknowledged: false,
        message: `${em('su_sparkle')} Đã xác nhận cập nhật **v${LATEST_VERSION}** & nhận thưởng **+${rewardLt.toLocaleString('vi-VN')}** ${lt}!`,
      };
    }

    await ensureUserInitialized(cleanId);
    const { data: user } = await supabase
      .from('users')
      .select('linh_thach, last_seen_update_version')
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
        already_acknowledged: true,
        linh_thach: currentBal,
        message: `${em('su_sparkle')} Bạn đã xác nhận bản cập nhật **v${LATEST_VERSION}** trước đó rồi! *(Số dư: **${currentBal.toLocaleString('vi-VN')}** ${lt})*`,
      };
    }

    const nextBal = currentBal + rewardLt;
    const nowIso = new Date().toISOString();
    const { data: updatedRows, error: updErr } = await supabase
      .from('users')
      .update({
        last_seen_update_version: LATEST_VERSION,
        linh_thach: nextBal,
        updated_at: nowIso,
      })
      .eq('user_id', cleanId)
      .or(`last_seen_update_version.is.null,last_seen_update_version.neq.${LATEST_VERSION}`)
      .select('linh_thach, last_seen_update_version');

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
        already_acknowledged: true,
        linh_thach: currentBal,
        message: `${em('su_sparkle')} Bạn đã xác nhận bản cập nhật **v${LATEST_VERSION}** trước đó rồi!`,
      };
    }

    const finalBal = Number(updatedRow.linh_thach ?? nextBal);
    return {
      success: true,
      acknowledged_version: LATEST_VERSION,
      needs_update_ack: 'false',
      granted_lt: rewardLt,
      already_acknowledged: false,
      linh_thach: finalBal,
      message: `${em('su_sparkle')} **Xác nhận cập nhật v${LATEST_VERSION} thành công & nhận thưởng +${rewardLt.toLocaleString('vi-VN')}** ${lt}!\n• Số dư hiện tại: **${finalBal.toLocaleString('vi-VN')} LT**. Toàn bộ lệnh tu luyện đã sẵn sàng — chúc đạo hữu tu luyện vui vẻ!`,
    };
  });
}
