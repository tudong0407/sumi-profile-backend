/**
 * src/services/updateGateService.js
 * Cổng xác nhận Nhật Ký Cập Nhật lần đầu (First-Command Update Ack Gate — v1.2):
 * - Cache RAM `ackVersionCache` cho 0ms overhead sau khi user đã bấm Xác Nhận.
 * - Chỉ chặn 18 lệnh gameplay (KHÔNG bao giờ chặn Chat/Voice EXP, /updates, /wiki, /info, /profile, /rank, /top, /health).
 */

import { supabase } from '../config/supabase.js';
import { LATEST_VERSION, getChangelogPayload } from '../data/changelogs.js';
import { em } from '../config/emojiHelper.js';
import { sanitizeUserId } from './profileService.js';

const ackVersionCache = new Map();
const MAX_ACK_CACHE = 2000;

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
    return {
      blocked: true,
      user_version: userVer,
      latest_version: LATEST_VERSION,
      payload: {
        success: false,
        status: 200,
        error: 'UPDATE_ACK_REQUIRED',
        needs_update_ack: 'true',
        update_version: LATEST_VERSION,
        update_title: `${em('su_sparkle')} CẬP NHẬT MỚI v${LATEST_VERSION} — VUI LÒNG ĐỌC & XÁC NHẬN`,
        update_description: [
          `Tiên Giới SuMi vừa nâng cấp lên **v${LATEST_VERSION}**! Hãy đọc tóm tắt bên dưới rồi bấm nút **Xác Nhận Cập Nhật** để mở khóa tiếp tục tu luyện.`,
          '',
          logPayload.description,
        ].join('\n').slice(0, 3950),
        message: `Tiên Giới đã cập nhật lên **v${LATEST_VERSION}**! Vui lòng bấm nút **Tôi Đã Đọc & Xác Nhận Cập Nhật** bên dưới để tiếp tục chơi.`,
        footer: `SuMi Family • Xác nhận phiên bản v${LATEST_VERSION}`,
      },
    };
  } catch {
    return { blocked: false, version: LATEST_VERSION };
  }
}

export async function acknowledgeUpdate(userId) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) {
    return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID người dùng không hợp lệ.' };
  }

  setAckCache(cleanId, LATEST_VERSION);
  if (supabase) {
    await supabase
      .from('users')
      .update({
        last_seen_update_version: LATEST_VERSION,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', cleanId);
  }

  return {
    success: true,
    acknowledged_version: LATEST_VERSION,
    needs_update_ack: 'false',
    message: `${em('su_sparkle')} **Xác nhận cập nhật v${LATEST_VERSION} thành công!**\n• Toàn bộ lệnh tu luyện, Đấu Trường, Tháp 200 Tầng, \`/enchant\` và \`/job\` đã được mở khóa. Chúc đạo hữu tu luyện vui vẻ!`,
  };
}
