/**
 * src/services/marryService.js
 * Hệ thống Tiên Lữ Kết Hôn (/marry & /divorce):
 * - 4 Cấp Nhẫn Cưới (Phàm -> Linh -> Tiên -> Thần Thoại).
 * - Lưu ngày kết hôn (marry_date) + Streak kết hôn & Ngày Kỷ Niệm tăng % EXP + % Chiến Lực đôi.
 * - Nâng cấp nhẫn giữ nguyên 100% marry_date & streak.
 * - Đồng bộ 2 chiều cho cả 2 tài khoản trong bảng users.
 */

import { supabase } from '../config/supabase.js';
import {
  MARRY_RINGS,
  MARRY_RING_BY_ID,
  MARRY_RING_RANK,
  PUBLIC_BASE_URL,
} from '../data/catalog.js';
import { em, ringEmoji, tierEmoji, uiEm } from '../config/emojiHelper.js';
import { resolvePublicAssetPath } from '../canvas/drawUtils.js';
import {
  sanitizeUserId,
  ensureUserInitialized,
  pickCleanDisplayValue,
} from './profileService.js';

const PROPOSAL_TTL_MS = 10 * 60 * 1000;
const marryLocks = new Map();

async function withMarryLock(key, fn) {
  const prev = marryLocks.get(key) || Promise.resolve();
  let release;
  const current = new Promise((res) => { release = res; });
  const queued = prev.then(() => current);
  marryLocks.set(key, queued);
  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (marryLocks.get(key) === queued) marryLocks.delete(key);
  }
}

export function formatVnDate(dateInput) {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (Number.isNaN(d.getTime())) return '';
  const vn = new Date(d.getTime() + 7 * 3600 * 1000);
  const dd = String(vn.getUTCDate()).padStart(2, '0');
  const mm = String(vn.getUTCMonth() + 1).padStart(2, '0');
  const yyyy = vn.getUTCFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

/**
 * Tính toàn bộ buff EXP & Chiến Lực đôi từ cấp Nhẫn Cưới + Streak ngày kết hôn + Ngày Kỷ Niệm
 * @param {string|null} marryRingId
 * @param {string|Date|null} marryDate
 * @param {Date} now
 */
export function computeMarriageBuffs(marryRingId, marryDate, now = new Date()) {
  const ring = MARRY_RING_BY_ID[marryRingId] || MARRY_RING_BY_ID.ring_common;
  const marriedDays = marryDate
    ? Math.max(0, Math.floor((now.getTime() - new Date(marryDate).getTime()) / 86400000))
    : 0;
  const dateFormatted = formatVnDate(marryDate);

  let streakTier = 'Tân Hôn';
  let streakExpPct = 0;
  let streakPowerPct = 0;
  let nextMilestoneDays = 7;

  if (marriedDays >= 365) {
    const years = Math.floor(marriedDays / 365);
    const bonus = 15 + Math.min(10, Math.max(0, years - 1) * 2);
    streakTier = 'Thiên Trường Địa Cửu';
    streakExpPct = bonus;
    streakPowerPct = bonus;
    nextMilestoneDays = (years + 1) * 365;
  } else if (marriedDays >= 180) {
    streakTier = 'Bán Niên Vĩnh Kết';
    streakExpPct = 12;
    streakPowerPct = 12;
    nextMilestoneDays = 365;
  } else if (marriedDays >= 100) {
    streakTier = 'Bách Nhật Tình Duyên';
    streakExpPct = 8;
    streakPowerPct = 8;
    nextMilestoneDays = 180;
  } else if (marriedDays >= 30) {
    streakTier = 'Nguyệt Hạ 30 Ngày';
    streakExpPct = 5;
    streakPowerPct = 5;
    nextMilestoneDays = 100;
  } else if (marriedDays >= 7) {
    streakTier = 'Đồng Tâm 7 Ngày';
    streakExpPct = 2;
    streakPowerPct = 2;
    nextMilestoneDays = 30;
  }

  const isAnniversaryDay = marriedDays > 0 && ([7, 30, 100, 180].includes(marriedDays) || marriedDays % 365 === 0);
  const anniversaryBonusExpPct = isAnniversaryDay ? 10 : 0;

  return {
    ring,
    ring_id: ring.item_id,
    ring_name: ring.name,
    ring_rarity: ring.rarity,
    ring_exp_bonus_pct: ring.exp_bonus_pct,
    ring_power_bonus_pct: ring.power_bonus_pct,
    married_days: marriedDays,
    date_formatted: dateFormatted,
    streak_tier: streakTier,
    streak_exp_pct: streakExpPct,
    streak_power_pct: streakPowerPct,
    next_milestone_days: nextMilestoneDays,
    is_anniversary_day: isAnniversaryDay,
    anniversary_bonus_exp_pct: anniversaryBonusExpPct,
    total_exp_bonus_pct: ring.exp_bonus_pct + streakExpPct + anniversaryBonusExpPct,
    total_power_bonus_pct: ring.power_bonus_pct + streakPowerPct,
  };
}

/**
 * Xem tình trạng Tiên Lữ & Buff Kết Hôn hiện tại
 */
export async function getMarriageStatus(userId, opts = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) {
    return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID người dùng không hợp lệ.' };
  }
  if (!supabase) {
    return { success: false, status: 503, error: 'DB_UNAVAILABLE', message: 'Supabase chưa sẵn sàng.' };
  }

  const { user } = await ensureUserInitialized(cleanId, {
    username: pickCleanDisplayValue(opts.username, opts.fallbackUsername),
    avatarUrl: pickCleanDisplayValue(opts.avatarUrl),
  });
  if (!user) return { success: false, status: 500, error: 'USER_INIT_FAILED', message: 'Không thể khởi tạo hồ sơ.' };

  if (!user.marry_user_id) {
    return {
      success: true,
      married: false,
      user_id: cleanId,
      username: user.username,
      image_url: '',
      message: `${ringEmoji('ring_common')} **${user.username}** hiện đang **Độc thân tu đạo**.\nHãy mua Nhẫn Cưới trong \`/shop\` và dùng \`/marry hanh_dong:propose\` để kết duyên Tiên Lữ!`,
    };
  }

  const now = opts.now instanceof Date ? opts.now : new Date();
  const buffs = computeMarriageBuffs(user.marry_ring_id || 'ring_common', user.marry_date, now);
  const ringTag = ringEmoji(buffs.ring_id);
  const tierTag = tierEmoji(buffs.ring.rarity_key);
  const anniversaryNote = buffs.is_anniversary_day
    ? `\n${em('su_sparkle')} **NGÀY KỶ NIỆM ĐẶC BIỆT!** Đang nhận thêm **+10% EXP** hôm nay!`
    : '';

  const imageUrl = `${PUBLIC_BASE_URL}/assets/${resolvePublicAssetPath(`rings/${buffs.ring_id}.png`)}`;
  const lines = [
    `${ringTag} **Tiên Lữ Kết Duyên**: **${user.username}** ${em('su_sparkle')} **${user.marry_username || user.marry_user_id}**`,
    `${tierTag} **Nhẫn Đang Đeo**: **${buffs.ring_name}** *(${buffs.ring_rarity})*`,
    `${em('su_wiki_scroll')} **Ngày Kết Hôn**: \`${buffs.date_formatted || 'Chưa rõ'}\` • **Chuỗi Kết Hôn**: **${buffs.married_days} ngày**`,
    `${em('su_realm_star')} **Danh Hiệu Tình Duyên**: **${buffs.streak_tier}** *(Mốc tiếp theo: ${buffs.next_milestone_days} ngày)*`,
    `${em('su_level_up')} **Tổng Buff Cặp Đôi**: **+${buffs.total_exp_bonus_pct}% EXP** & **+${buffs.total_power_bonus_pct}% Chiến Lực đôi**` +
      ` *(Nhẫn +${buffs.ring_exp_bonus_pct}% / Streak +${buffs.streak_exp_pct}%${buffs.is_anniversary_day ? ' / Kỷ Niệm +10%' : ''})*` +
      anniversaryNote,
  ];

  return {
    success: true,
    married: true,
    user_id: cleanId,
    username: user.username,
    spouse: {
      user_id: user.marry_user_id,
      username: user.marry_username || `ID: ${user.marry_user_id}`,
    },
    ring: buffs.ring,
    ring_id: buffs.ring_id,
    ring_name: buffs.ring_name,
    ring_rarity: buffs.ring_rarity,
    date_formatted: buffs.date_formatted,
    married_days: buffs.married_days,
    streak_tier: buffs.streak_tier,
    next_milestone_days: buffs.next_milestone_days,
    is_anniversary_day: buffs.is_anniversary_day,
    total_exp_bonus_pct: buffs.total_exp_bonus_pct,
    total_power_bonus_pct: buffs.total_power_bonus_pct,
    image_url: imageUrl,
    message: lines.join('\n'),
  };
}

/**
 * Gửi lời cầu hôn (/marry hanh_dong:propose)
 */
export async function proposeMarriage(proposerId, targetId, ringId = 'ring_common', opts = {}) {
  const cleanProposerId = sanitizeUserId(proposerId);
  const cleanTargetId = sanitizeUserId(targetId);

  if (!cleanProposerId || !/^[0-9]{17,20}$/.test(cleanProposerId)) {
    return { success: false, status: 400, error: 'INVALID_PROPOSER', message: 'ID người cầu hôn không hợp lệ.' };
  }
  if (!cleanTargetId || !/^[0-9]{17,20}$/.test(cleanTargetId)) {
    return { success: false, status: 400, error: 'INVALID_TARGET', message: 'Vui lòng chọn đúng người bạn muốn cầu hôn (`nguoi_thuong`).' };
  }
  if (cleanProposerId === cleanTargetId) {
    return { success: false, status: 400, error: 'SELF_MARRY', message: 'Không thể tự cầu hôn chính bản thân mình!' };
  }

  const resolvedRingId = String(ringId || 'ring_common').trim().toLowerCase();
  const ring = MARRY_RING_BY_ID[resolvedRingId];
  if (!ring) {
    return { success: false, status: 400, error: 'INVALID_RING', message: `Mã nhẫn '${ringId}' không hợp lệ.` };
  }
  if (!supabase) {
    return { success: false, status: 503, error: 'DB_UNAVAILABLE', message: 'Supabase chưa sẵn sàng.' };
  }

  return withMarryLock(cleanProposerId, async () => {
    const [{ user: proposer }, { user: target }] = await Promise.all([
      ensureUserInitialized(cleanProposerId, {
        username: pickCleanDisplayValue(opts.proposerName, opts.username),
        avatarUrl: pickCleanDisplayValue(opts.proposerAvatar, opts.avatarUrl),
      }),
      ensureUserInitialized(cleanTargetId, {
        username: pickCleanDisplayValue(opts.targetName),
        avatarUrl: pickCleanDisplayValue(opts.targetAvatar),
      }),
    ]);

    if (!proposer || !target) {
      return { success: false, status: 500, error: 'USER_INIT_FAILED', message: 'Không thể khởi tạo hồ sơ tu sĩ.' };
    }
    if (proposer.marry_user_id) {
      return { success: false, status: 400, error: 'ALREADY_MARRIED', message: `Bạn đã kết hôn cùng **${proposer.marry_username || proposer.marry_user_id}** rồi!` };
    }
    if (target.marry_user_id) {
      return { success: false, status: 400, error: 'TARGET_ALREADY_MARRIED', message: `**${target.username}** đã có Tiên Lữ rồi!` };
    }

    const { data: ownRing } = await supabase
      .from('user_inventory')
      .select('quantity')
      .eq('user_id', cleanProposerId)
      .eq('item_id', resolvedRingId)
      .maybeSingle();

    if (!ownRing || Number(ownRing.quantity || 0) < 1) {
      return {
        success: false,
        status: 400,
        error: 'RING_NOT_OWNED',
        message: `Bạn chưa có ${ringEmoji(resolvedRingId)} **${ring.name}** trong túi đồ! Hãy vào \`/shop\` mục **Nhẫn Cưới** để mua trước.`,
      };
    }

    // Hủy các lời cầu hôn cũ chưa trả lời của người cầu hôn
    await supabase
      .from('marry_proposals')
      .update({ status: 'cancelled' })
      .eq('proposer_id', cleanProposerId)
      .eq('status', 'pending');

    const now = opts.now instanceof Date ? opts.now : new Date();
    const expiresAt = new Date(now.getTime() + PROPOSAL_TTL_MS).toISOString();

    const { data: inserted, error: insErr } = await supabase
      .from('marry_proposals')
      .insert({
        proposer_id: cleanProposerId,
        proposer_name: proposer.username,
        target_id: cleanTargetId,
        target_name: target.username,
        ring_id: resolvedRingId,
        status: 'pending',
        expires_at: expiresAt,
      })
      .select('*')
      .single();

    if (insErr) throw new Error(`Create proposal failed: ${insErr.message}`);

    const ringTag = ringEmoji(resolvedRingId);
    const imageUrl = `${PUBLIC_BASE_URL}/assets/${resolvePublicAssetPath(`rings/${resolvedRingId}.png`)}`;

    return {
      success: true,
      proposal_id: inserted.id,
      proposer_id: cleanProposerId,
      proposer_name: proposer.username,
      target_id: cleanTargetId,
      target_name: target.username,
      ring_id: resolvedRingId,
      ring_name: ring.name,
      ring_rarity: ring.rarity,
      ring_icon: ringTag,
      image_url: imageUrl,
      expires_at: expiresAt,
      message: `${ringTag} **<@${cleanProposerId}>** nâng trên tay **${ring.name}** *(${ring.rarity} • +${ring.exp_bonus_pct}% EXP & +${ring.power_bonus_pct}% Chiến Lực đôi)*, trang trọng cầu hôn **<@${cleanTargetId}>**!\n\n${em('su_sparkle')} Mời **<@${cleanTargetId}>** bấm **[Đồng Ý Kết Hôn]** hoặc **[Từ Chối]** bên dưới *(hiệu lực 10 phút)*.`,
    };
  });
}

/**
 * Phản hồi lời cầu hôn (Đồng Ý hoặc Từ Chối)
 */
export async function respondMarriage(responderId, decision = 'accept', opts = {}) {
  const cleanResponderId = sanitizeUserId(responderId);
  if (!cleanResponderId) {
    return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID người phản hồi không hợp lệ.' };
  }
  if (!supabase) {
    return { success: false, status: 503, error: 'DB_UNAVAILABLE', message: 'Supabase chưa sẵn sàng.' };
  }

  const normalizedDecision = ['reject', 'decline', 'no', 'deny'].includes(String(decision || '').toLowerCase())
    ? 'reject'
    : 'accept';

  const now = opts.now instanceof Date ? opts.now : new Date();
  const nowIso = now.toISOString();

  let proposal = null;
  if (opts.proposalId) {
    const { data: byId } = await supabase
      .from('marry_proposals')
      .select('*')
      .eq('id', opts.proposalId)
      .maybeSingle();
    if (!byId || byId.status !== 'pending') {
      return { success: false, status: 404, error: 'NO_PENDING_PROPOSAL', message: 'Lời cầu hôn này không còn hiệu lực hoặc đã được xử lý.' };
    }
    if (byId.target_id !== cleanResponderId) {
      return { success: false, status: 403, error: 'NOT_PROPOSAL_TARGET', message: 'Chỉ người được cầu hôn mới có thể bấm xác nhận hoặc từ chối!' };
    }
    if (new Date(byId.expires_at).getTime() <= now.getTime()) {
      await supabase.from('marry_proposals').update({ status: 'expired' }).eq('id', byId.id);
      return { success: false, status: 400, error: 'PROPOSAL_EXPIRED', message: 'Lời cầu hôn đã quá hạn 10 phút!' };
    }
    proposal = byId;
  } else {
    const { data: rows } = await supabase
      .from('marry_proposals')
      .select('*')
      .eq('target_id', cleanResponderId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(1);

    const candidate = rows?.[0] || null;
    if (!candidate) {
      const { data: anyPending } = await supabase
        .from('marry_proposals')
        .select('id, expires_at')
        .eq('status', 'pending')
        .gt('expires_at', nowIso)
        .limit(1);

      if (anyPending && anyPending.length > 0) {
        return { success: false, status: 403, error: 'NOT_PROPOSAL_TARGET', message: 'Chỉ người được cầu hôn mới có thể bấm xác nhận hoặc từ chối!' };
      }
      return { success: false, status: 404, error: 'NO_PENDING_PROPOSAL', message: 'Bạn không có lời cầu hôn nào đang chờ phản hồi.' };
    }

    if (new Date(candidate.expires_at).getTime() <= now.getTime()) {
      await supabase.from('marry_proposals').update({ status: 'expired' }).eq('id', candidate.id);
      return { success: false, status: 400, error: 'PROPOSAL_EXPIRED', message: 'Lời cầu hôn đã hết hạn 10 phút rồi!' };
    }
    proposal = candidate;
  }

  return withMarryLock(`${proposal.proposer_id}:${proposal.target_id}`, async () => {
    if (normalizedDecision === 'reject') {
      await supabase.from('marry_proposals').update({ status: 'rejected' }).eq('id', proposal.id);
      return {
        success: true,
        accepted: false,
        rejected: true,
        proposal_id: proposal.id,
        proposer_id: proposal.proposer_id,
        target_id: proposal.target_id,
        image_url: '',
        message: `${uiEm('ui_heart_broken')} **<@${proposal.target_id}>** đã khéo léo từ chối lời cầu hôn của **<@${proposal.proposer_id}>**.`,
      };
    }

    const [{ data: proposer }, { data: target }, { data: ownRing }] = await Promise.all([
      supabase.from('users').select('*').eq('user_id', proposal.proposer_id).single(),
      supabase.from('users').select('*').eq('user_id', proposal.target_id).single(),
      supabase.from('user_inventory').select('quantity').eq('user_id', proposal.proposer_id).eq('item_id', proposal.ring_id).maybeSingle(),
    ]);

    if (!proposer || !target) {
      return { success: false, status: 404, error: 'USER_NOT_FOUND', message: 'Không tìm thấy hồ sơ cặp đôi.' };
    }
    if (proposer.marry_user_id || target.marry_user_id) {
      await supabase.from('marry_proposals').update({ status: 'cancelled' }).eq('id', proposal.id);
      return { success: false, status: 400, error: 'ALREADY_MARRIED', message: 'Một trong hai người đã kết hôn với người khác trước đó!' };
    }
    if (!ownRing || Number(ownRing.quantity || 0) < 1) {
      await supabase.from('marry_proposals').update({ status: 'cancelled' }).eq('id', proposal.id);
      return { success: false, status: 400, error: 'RING_MISSING', message: 'Nhẫn cưới trong túi của người cầu hôn không còn nữa!' };
    }

    const ring = MARRY_RING_BY_ID[proposal.ring_id] || MARRY_RING_BY_ID.ring_common;

    // Tiêu hao 1 nhẫn của người cầu hôn & ghi nhận kết hôn 2 chiều
    await Promise.all([
      supabase
        .from('user_inventory')
        .update({ quantity: Number(ownRing.quantity) - 1, updated_at: nowIso })
        .eq('user_id', proposal.proposer_id)
        .eq('item_id', proposal.ring_id),
      supabase
        .from('users')
        .update({
          marry_user_id: target.user_id,
          marry_username: target.username,
          marry_date: nowIso,
          marry_ring_id: ring.item_id,
          updated_at: nowIso,
        })
        .eq('user_id', proposer.user_id),
      supabase
        .from('users')
        .update({
          marry_user_id: proposer.user_id,
          marry_username: proposer.username,
          marry_date: nowIso,
          marry_ring_id: ring.item_id,
          updated_at: nowIso,
        })
        .eq('user_id', target.user_id),
      supabase.from('marry_proposals').update({ status: 'accepted' }).eq('id', proposal.id),
    ]);

    const dateFmt = formatVnDate(nowIso);
    const ringTag = ringEmoji(ring.item_id);
    const imageUrl = `${PUBLIC_BASE_URL}/assets/${resolvePublicAssetPath(`rings/${ring.item_id}.png`)}`;

    return {
      success: true,
      accepted: true,
      rejected: false,
      proposal_id: proposal.id,
      proposer_id: proposer.user_id,
      target_id: target.user_id,
      married_date: nowIso,
      date_formatted: dateFmt,
      ring,
      image_url: imageUrl,
      message: `${em('su_sparkle')} **CHÚC MỪNG HỶ SỰ TIÊN LỮ!** ${ringTag}\n**<@${proposer.user_id}>** và **<@${target.user_id}>** chính thức kết duyên phu thê ngày \`${dateFmt}\` với **${ring.name}** *(${ring.rarity})*!\n• Buff kích hoạt: **+${ring.exp_bonus_pct}% EXP** & **+${ring.power_bonus_pct}% Chiến Lực đôi** *(càng gắn bó lâu dài càng tăng buff theo Streak & Ngày Kỷ Niệm)*.`,
    };
  });
}

/**
 * Nâng cấp Nhẫn Cưới cho cặp đôi đã kết hôn — GIỮ NGUYÊN 100% marry_date & streak
 */
export async function upgradeMarriageRing(userId, newRingId, opts = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID người dùng không hợp lệ.' };

  const targetRingId = String(newRingId || '').trim().toLowerCase();
  const nextRing = MARRY_RING_BY_ID[targetRingId];
  if (!nextRing) {
    return { success: false, status: 400, error: 'INVALID_RING', message: `Mã nhẫn '${newRingId}' không hợp lệ.` };
  }
  if (!supabase) return { success: false, status: 503, error: 'DB_UNAVAILABLE', message: 'Supabase chưa sẵn sàng.' };

  return withMarryLock(cleanId, async () => {
    const { data: user } = await supabase.from('users').select('*').eq('user_id', cleanId).maybeSingle();
    if (!user || !user.marry_user_id) {
      return { success: false, status: 400, error: 'NOT_MARRIED', message: 'Bạn chưa kết hôn nên không thể nâng cấp nhẫn cưới!' };
    }

    const currentRingId = user.marry_ring_id || 'ring_common';
    const currentRank = MARRY_RING_RANK[currentRingId] || 1;
    const nextRank = MARRY_RING_RANK[targetRingId] || 1;

    if (nextRank <= currentRank) {
      const currentRing = MARRY_RING_BY_ID[currentRingId] || MARRY_RINGS[0];
      return {
        success: false,
        status: 400,
        error: 'RING_TIER_NOT_HIGHER',
        message: `Cặp đôi đang đeo **${currentRing.name}** (${currentRing.rarity}). Chỉ có thể nâng lên phẩm cấp nhẫn cao hơn!`,
      };
    }

    const { data: ownRing } = await supabase
      .from('user_inventory')
      .select('quantity')
      .eq('user_id', cleanId)
      .eq('item_id', targetRingId)
      .maybeSingle();

    if (!ownRing || Number(ownRing.quantity || 0) < 1) {
      return {
        success: false,
        status: 400,
        error: 'RING_NOT_OWNED',
        message: `Bạn chưa sở hữu ${ringEmoji(targetRingId)} **${nextRing.name}** trong túi đồ! Hãy vào \`/shop\` mua trước.`,
      };
    }

    const nowIso = (opts.now instanceof Date ? opts.now : new Date()).toISOString();

    // Chỉ cập nhật marry_ring_id — GIỮ NGUYÊN marry_date & streak
    await Promise.all([
      supabase
        .from('user_inventory')
        .update({ quantity: Number(ownRing.quantity) - 1, updated_at: nowIso })
        .eq('user_id', cleanId)
        .eq('item_id', targetRingId),
      supabase
        .from('users')
        .update({ marry_ring_id: targetRingId, updated_at: nowIso })
        .in('user_id', [cleanId, user.marry_user_id]),
    ]);

    const dateFmt = formatVnDate(user.marry_date);
    return {
      success: true,
      old_ring_id: currentRingId,
      new_ring_id: targetRingId,
      ring: nextRing,
      marry_date: user.marry_date,
      image_url: `${PUBLIC_BASE_URL}/assets/${resolvePublicAssetPath(`rings/${targetRingId}.png`)}`,
      message: `${ringEmoji(targetRingId)} Nâng cấp nhẫn thành công lên **${nextRing.name}** *(${nextRing.rarity})*!\n• Buff nhẫn mới: **+${nextRing.exp_bonus_pct}% EXP** & **+${nextRing.power_bonus_pct}% Chiến Lực đôi**.\n• Ngày kết hôn \`${dateFmt || 'cũ'}\` và chuỗi Streak được giữ nguyên trọn vẹn!`,
    };
  });
}

/**
 * Ly hôn (/divorce) — xóa liên kết 2 chiều & thu hồi nhẫn cưới
 */
export async function divorceMarriage(userId, opts = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID người dùng không hợp lệ.' };
  if (!supabase) return { success: false, status: 503, error: 'DB_UNAVAILABLE', message: 'Supabase chưa sẵn sàng.' };

  return withMarryLock(cleanId, async () => {
    const { data: user } = await supabase.from('users').select('*').eq('user_id', cleanId).maybeSingle();
    if (!user || !user.marry_user_id) {
      return { success: false, status: 400, error: 'NOT_MARRIED', message: 'Bạn đang độc thân tu đạo, chưa kết hôn với ai.' };
    }

    const formerSpouseId = user.marry_user_id;
    const formerSpouseName = user.marry_username || formerSpouseId;
    const nowIso = (opts.now instanceof Date ? opts.now : new Date()).toISOString();

    await supabase
      .from('users')
      .update({
        marry_user_id: null,
        marry_username: null,
        marry_date: null,
        marry_ring_id: null,
        updated_at: nowIso,
      })
      .in('user_id', [cleanId, formerSpouseId]);

    return {
      success: true,
      user_id: cleanId,
      former_spouse_id: formerSpouseId,
      former_spouse_name: formerSpouseName,
      message: `${uiEm('ui_heart_broken')} **ĐOẠN TUYỆT TIÊN DUYÊN** — **${user.username}** và **${formerSpouseName}** đã chính thức ly hôn. Nhẫn cưới và toàn bộ buff cặp đôi đã được thu hồi.`,
    };
  });
}
