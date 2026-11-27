/**
 * src/services/clanService.js
 * Hệ Thống Gia Tộc (/giatoc) & Gia Tộc Chiến 24H (Clan Wars):
 * - Điều kiện lập Gia Tộc: Lv.20+ & 1.000 Linh Thạch.
 * - Nâng cấp Gia Tộc Lv.1 -> Lv.10 (mở rộng 10 -> 50 thành viên, +2%..+20% EXP & Linh Thạch).
 * - Clan Wars 24H đặt cược Linh Thạch từ ngân khố, tự động tất toán khi hết 24H.
 */

import { supabase } from '../config/supabase.js';
import {
  CLAN_CREATE_MIN_LEVEL,
  CLAN_CREATE_COST,
  CLAN_WAR_MIN_BET,
  CLAN_WAR_DURATION_HOURS,
  getClanLevelConfig,
} from '../data/catalog.js';
import { em, uiEm } from '../config/emojiHelper.js';
import {
  sanitizeUserId,
  ensureUserInitialized,
  pickCleanDisplayValue,
} from './profileService.js';

const clanLocks = new Map();

async function withClanLock(key, fn) {
  const prev = clanLocks.get(key) || Promise.resolve();
  let release;
  const current = new Promise((res) => { release = res; });
  const queued = prev.then(() => current);
  clanLocks.set(key, queued);
  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (clanLocks.get(key) === queued) clanLocks.delete(key);
  }
}

function slugifyClanId(name) {
  const base = String(name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 36);
  return base || `clan_${Date.now().toString(36)}`;
}

async function resolveClanByQuery(query) {
  if (!query || !supabase) return null;
  const q = String(query).trim();
  if (!q) return null;

  const { data: allClans } = await supabase.from('clans').select('*');
  if (!allClans || allClans.length === 0) return null;

  const qLower = q.toLowerCase();
  return allClans.find((c) => c.clan_id.toLowerCase() === qLower)
    || allClans.find((c) => c.clan_name.toLowerCase() === qLower)
    || allClans.find((c) => (c.clan_tag || '').toLowerCase() === qLower)
    || allClans.find((c) => c.clan_name.toLowerCase().includes(qLower))
    || null;
}

/**
 * Tự động tất toán các trận Gia Tộc Chiến 24H đã hết thời gian (và hủy lời thách đấu pending quá hạn)
 */
export async function settleExpiredClanWars(opts = {}) {
  if (!supabase) return [];
  const nowIso = (opts.now instanceof Date ? opts.now : new Date()).toISOString();

  // Hủy lời thách đấu pending đã quá hạn
  await supabase
    .from('clan_wars')
    .update({ status: 'cancelled' })
    .eq('status', 'pending')
    .lte('end_time', nowIso);

  const { data: expiredActive } = await supabase
    .from('clan_wars')
    .select('*')
    .eq('status', 'active')
    .lte('end_time', nowIso);

  const settled = [];
  for (const war of expiredActive || []) {
    const cScore = Number(war.challenger_score || 0);
    const tScore = Number(war.target_score || 0);
    const winnerId = cScore > tScore
      ? war.challenger_clan_id
      : tScore > cScore
        ? war.target_clan_id
        : null;

    // Khóa trạng thái an toàn trước khi cộng thưởng để tránh nhân đôi phần thưởng
    const { data: lockedRow } = await supabase
      .from('clan_wars')
      .update({ status: 'completed', winner_clan_id: winnerId })
      .eq('war_id', war.war_id)
      .eq('status', 'active')
      .select('*')
      .maybeSingle();

    if (!lockedRow) continue;

    const bet = Number(war.bet_amount || 0);
    if (winnerId) {
      const { data: wClan } = await supabase.from('clans').select('clan_treasury, total_exp').eq('clan_id', winnerId).maybeSingle();
      if (wClan) {
        await supabase
          .from('clans')
          .update({
            clan_treasury: Number(wClan.clan_treasury || 0) + bet * 2,
            total_exp: Number(wClan.total_exp || 0) + 5000,
            updated_at: nowIso,
          })
          .eq('clan_id', winnerId);
      }
    } else if (bet > 0) {
      // Hòa: hoàn trả tiền cược cho cả 2 Gia Tộc
      for (const cid of [war.challenger_clan_id, war.target_clan_id]) {
        const { data: cRow } = await supabase.from('clans').select('clan_treasury').eq('clan_id', cid).maybeSingle();
        if (cRow) {
          await supabase
            .from('clans')
            .update({ clan_treasury: Number(cRow.clan_treasury || 0) + bet, updated_at: nowIso })
            .eq('clan_id', cid);
        }
      }
    }

    settled.push(lockedRow);
  }
  return settled;
}

/**
 * Cộng điểm chiến công vào trận Gia Tộc Chiến 24H đang diễn ra (non-blocking)
 */
export async function recordClanWarScore(clanId, points) {
  if (!clanId || !supabase) return false;
  const pts = Math.floor(Number(points) || 0);
  if (pts <= 0) return false;

  try {
    const nowIso = new Date().toISOString();
    const { data: war } = await supabase
      .from('clan_wars')
      .select('*')
      .eq('status', 'active')
      .gt('end_time', nowIso)
      .or(`challenger_clan_id.eq.${clanId},target_clan_id.eq.${clanId}`)
      .limit(1)
      .maybeSingle();

    if (!war) return false;

    const patch = war.challenger_clan_id === clanId
      ? { challenger_score: Number(war.challenger_score || 0) + pts }
      : { target_score: Number(war.target_score || 0) + pts };

    await supabase.from('clan_wars').update(patch).eq('war_id', war.war_id);
    return true;
  } catch {
    return false;
  }
}

function formatRemainingTime(endIso, now = new Date()) {
  const diffMs = Math.max(0, new Date(endIso).getTime() - now.getTime());
  const hrs = Math.floor(diffMs / 3600000);
  const mins = Math.floor((diffMs % 3600000) / 60000);
  return `${hrs} giờ ${mins} phút`;
}

/**
 * Xem thông tin Gia Tộc của người dùng hoặc theo tên/mã
 */
export async function getClanInfo(userId, clanQuery = null, opts = {}) {
  if (!supabase) return { success: false, status: 503, error: 'DB_UNAVAILABLE', message: 'Supabase chưa sẵn sàng.' };
  await settleExpiredClanWars(opts);

  const cleanId = sanitizeUserId(userId || '');
  let user = null;
  if (cleanId) {
    const res = await ensureUserInitialized(cleanId, {
      username: pickCleanDisplayValue(opts.username, opts.fallbackUsername),
      avatarUrl: pickCleanDisplayValue(opts.avatarUrl),
    });
    user = res.user;
  }

  let clan = null;
  if (clanQuery) {
    clan = await resolveClanByQuery(clanQuery);
    if (!clan) {
      return { success: false, status: 404, error: 'CLAN_NOT_FOUND', message: `Không tìm thấy Gia Tộc '${clanQuery}'.` };
    }
  } else if (user?.clan_id) {
    const { data } = await supabase.from('clans').select('*').eq('clan_id', user.clan_id).maybeSingle();
    clan = data;
  }

  if (!clan) {
    return {
      success: true,
      has_clan: false,
      message: `${em('su_clan_castle')} Bạn chưa gia nhập Gia Tộc nào!\n• Đạt từ **Lv.${CLAN_CREATE_MIN_LEVEL}** + **${CLAN_CREATE_COST.toLocaleString('vi-VN')} Linh Thạch** để lập Gia Tộc (\`/giatoc hanh_dong:create\`).\n• Hoặc xem danh sách bang hội bằng \`/giatoc hanh_dong:top\` và xin gia nhập (\`/giatoc hanh_dong:join\`).`,
    };
  }

  const [{ data: members }, { data: pendingReqs }, { data: activeWars }] = await Promise.all([
    supabase.from('users').select('user_id, username, level, exp').eq('clan_id', clan.clan_id).order('level', { ascending: false }).order('exp', { ascending: false }),
    supabase.from('clan_join_requests').select('id').eq('clan_id', clan.clan_id).eq('status', 'pending'),
    supabase.from('clan_wars').select('*').or(`challenger_clan_id.eq.${clan.clan_id},target_clan_id.eq.${clan.clan_id}`).in('status', ['pending', 'active']).order('created_at', { ascending: false }).limit(1),
  ]);

  const memberList = members || [];
  const curLevel = Math.min(10, Math.max(1, Number(clan.clan_level) || 1));
  const cfg = getClanLevelConfig(curLevel);
  const nextCfg = curLevel < 10 ? getClanLevelConfig(curLevel + 1) : null;
  const upgradeCost = nextCfg && cfg.upgradeCost != null ? Number(cfg.upgradeCost) : null;
  const maxMembers = Math.max(Number(clan.max_members || 10), cfg.maxMembers);
  const isLeader = Boolean(cleanId && clan.leader_id === cleanId);

  const summaryMembers = memberList.slice(0, 12).map((m, idx) =>
    `• \`#${idx + 1}\` ${m.user_id === clan.leader_id ? `${uiEm('ui_crown_king')} ` : ''}**${m.username}** — Lv.${m.level}`
  ).join('\n') || '• Chưa có thành viên.';

  const war = activeWars?.[0] || null;
  const summaryWar = war
    ? war.status === 'active'
      ? `${em('su_crossed_swords')} **Đang Clan War 24H**: \`${war.challenger_clan_id}\` (**${war.challenger_score}**) vs \`${war.target_clan_id}\` (**${war.target_score}**) • Cược **${Number(war.bet_amount).toLocaleString('vi-VN')}** ${em('su_linhthach')} • Còn **${formatRemainingTime(war.end_time)}**`
      : `${em('su_arena')} **Lời thách đấu chờ duyệt**: \`${war.challenger_clan_id}\` ${em('su_crossed_swords')} \`${war.target_clan_id}\` • Cược **${Number(war.bet_amount).toLocaleString('vi-VN')}** ${em('su_linhthach')}`
    : '• Hiện chưa có trận Gia Tộc Chiến nào.';

  const message = [
    `${em('su_clan_castle')} **GIA TỘC ${clan.clan_name.toUpperCase()}** ${clan.clan_tag ? `\`[${clan.clan_tag}]\`` : ''}`,
    `• **Mã Tộc**: \`${clan.clan_id}\` • **Tộc Trưởng**: <@${clan.leader_id}>`,
    `• **Cấp Độ**: **Lv.${curLevel}/10** • **Thành Viên**: **${memberList.length}/${maxMembers}**${isLeader ? ` *(Đơn chờ duyệt: **${(pendingReqs || []).length}**)*` : ''}`,
    `• **Ngân Khố**: **${Number(clan.clan_treasury || 0).toLocaleString('vi-VN')}** ${em('su_linhthach')} • **Tổng EXP Tộc**: **${Number(clan.total_exp || 0).toLocaleString('vi-VN')}**`,
    `• **Buff Thành Viên**: **+${cfg.expBonusPct}% EXP** & **+${cfg.ltBonusPct}% Linh Thạch Daily**${nextCfg && upgradeCost != null ? ` *(Nâng Lv.${nextCfg.level} cần ${upgradeCost.toLocaleString('vi-VN')} Ngân Khố)*` : ' *(Cấp Tối Đa)*'}`,
    ``,
    `**Top Thành Viên:**\n${summaryMembers}`,
    ``,
    `**Chiến Sự Gia Tộc:**\n${summaryWar}`,
  ].join('\n');

  return {
    success: true,
    has_clan: true,
    is_leader: isLeader,
    clan: {
      ...clan,
      max_members: maxMembers,
      member_count: memberList.length,
      exp_bonus_pct: cfg.expBonusPct,
      lt_bonus_pct: cfg.ltBonusPct,
      next_upgrade_cost: upgradeCost,
    },
    members: memberList,
    pending_requests_count: (pendingReqs || []).length,
    war,
    summary_members: summaryMembers,
    summary_war: summaryWar,
    message,
  };
}

/**
 * Bảng Xếp Hạng Gia Tộc (/giatoc hanh_dong:top)
 */
export async function getClanLeaderboard(limit = 10, opts = {}) {
  if (!supabase) return { success: false, status: 503, error: 'DB_UNAVAILABLE', message: 'Supabase chưa sẵn sàng.' };
  await settleExpiredClanWars(opts);

  const cap = Math.min(20, Math.max(1, Number(limit) || 10));
  const { data: clans } = await supabase
    .from('clans')
    .select('*')
    .order('clan_level', { ascending: false })
    .order('clan_treasury', { ascending: false })
    .order('total_exp', { ascending: false })
    .limit(cap);

  const list = clans || [];
  const summaryLeaderboard = list.length
    ? list.map((c, idx) => {
        const cfg = getClanLevelConfig(c.clan_level);
        return `**#${idx + 1}** ${em('su_clan_castle')} **${c.clan_name}** \`[${c.clan_tag || c.clan_id}]\` (\`${c.clan_id}\`) — **Lv.${c.clan_level}** (+${cfg.expBonusPct}% EXP) • Ngân khố: **${Number(c.clan_treasury || 0).toLocaleString('vi-VN')}** ${em('su_linhthach')}`;
      }).join('\n')
    : '• Chưa có Gia Tộc nào được thành lập.';

  return {
    success: true,
    clans: list,
    summary_leaderboard: summaryLeaderboard,
    message: `${em('su_winner_trophy')} **BẢNG XẾP HẠNG GIA TỘC SUMI FAMILY**\n\n${summaryLeaderboard}`,
  };
}

/**
 * Thành lập Gia Tộc mới (/giatoc hanh_dong:create)
 */
export async function createClan(userId, { clanName, clanTag, description } = {}, opts = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID người dùng không hợp lệ.' };
  if (!supabase) return { success: false, status: 503, error: 'DB_UNAVAILABLE', message: 'Supabase chưa sẵn sàng.' };

  const cleanName = String(clanName || '').replace(/[<>`\r\n]/g, '').replace(/\s+/g, ' ').trim();
  if (cleanName.length < 3 || cleanName.length > 50) {
    return { success: false, status: 400, error: 'INVALID_CLAN_NAME', message: 'Tên Gia Tộc phải từ **3 đến 50 ký tự** (`ten_hoac_ma`).' };
  }

  const cleanTag = String(clanTag || cleanName.replace(/\s+/g, '').slice(0, 4).toUpperCase())
    .replace(/[<>`\r\n]/g, '')
    .trim()
    .slice(0, 8);
  if (cleanTag.length < 2) {
    return { success: false, status: 400, error: 'INVALID_CLAN_TAG', message: 'Tag Gia Tộc phải từ **2 đến 8 ký tự**.' };
  }

  return withClanLock(`create:${cleanId}`, async () => {
    const { user } = await ensureUserInitialized(cleanId, {
      username: pickCleanDisplayValue(opts.username, opts.fallbackUsername),
      avatarUrl: pickCleanDisplayValue(opts.avatarUrl),
    });
    if (!user) return { success: false, status: 500, error: 'USER_INIT_FAILED', message: 'Không thể khởi tạo hồ sơ.' };

    if (Number(user.level || 1) < CLAN_CREATE_MIN_LEVEL) {
      return {
        success: false,
        status: 400,
        error: 'LEVEL_TOO_LOW',
        message: `Cần đạt từ **Lv.${CLAN_CREATE_MIN_LEVEL}** *(II. Trúc Cơ Đạo Cảnh)* mới có thể lập Gia Tộc (hiện tại: **Lv.${user.level}**).`,
      };
    }
    if (user.clan_id) {
      return { success: false, status: 400, error: 'ALREADY_IN_CLAN', message: 'Bạn đang thuộc một Gia Tộc khác rồi!' };
    }
    if (Number(user.linh_thach || 0) < CLAN_CREATE_COST) {
      return {
        success: false,
        status: 400,
        error: 'INSUFFICIENT_LINH_THACH',
        message: `Cần **${CLAN_CREATE_COST.toLocaleString('vi-VN')}** ${em('su_linhthach')} **Linh Thạch** để lập Gia Tộc (hiện có **${Number(user.linh_thach || 0).toLocaleString('vi-VN')}**).`,
      };
    }

    const { data: dupName } = await supabase.from('clans').select('clan_id').ilike('clan_name', cleanName).maybeSingle();
    if (dupName) {
      return { success: false, status: 400, error: 'CLAN_NAME_TAKEN', message: `Tên Gia Tộc **${cleanName}** đã tồn tại!` };
    }

    let clanId = slugifyClanId(cleanName);
    const { data: idHit } = await supabase.from('clans').select('clan_id').eq('clan_id', clanId).maybeSingle();
    if (idHit) {
      clanId = `${clanId.slice(0, 30)}_${Math.random().toString(36).slice(2, 6)}`;
    }

    const nowIso = (opts.now instanceof Date ? opts.now : new Date()).toISOString();
    const { data: created, error: insErr } = await supabase
      .from('clans')
      .insert({
        clan_id: clanId,
        clan_name: cleanName,
        clan_tag: cleanTag,
        leader_id: cleanId,
        clan_level: 1,
        clan_treasury: 0,
        total_exp: 0,
        max_members: 10,
        description: description || 'Một gia tộc tu tiên tại SuMi Family',
      })
      .select('*')
      .single();

    if (insErr) throw new Error(`Create clan failed: ${insErr.message}`);

    await Promise.all([
      supabase
        .from('users')
        .update({
          linh_thach: Number(user.linh_thach || 0) - CLAN_CREATE_COST,
          clan_id: created.clan_id,
          updated_at: nowIso,
        })
        .eq('user_id', cleanId),
      supabase
        .from('clan_join_requests')
        .update({ status: 'cancelled', updated_at: nowIso })
        .eq('user_id', cleanId)
        .eq('status', 'pending'),
    ]);

    return {
      success: true,
      clan: created,
      linh_thach: Number(user.linh_thach || 0) - CLAN_CREATE_COST,
      message: `${em('su_clan_castle')} Chúc mừng **${user.username}** đã khai sơn lập phái **${created.clan_name}** \`[${created.clan_tag}]\` *(Mã: \`${created.clan_id}\`)*!\n• Chi phí: **-${CLAN_CREATE_COST.toLocaleString('vi-VN')}** ${em('su_linhthach')} • Sức chứa: **1/10** thành viên • Buff: **+2% EXP & +2% Daily Linh Thạch**.`,
    };
  });
}

/**
 * Nộp đơn xin gia nhập Gia Tộc (/giatoc hanh_dong:join)
 */
export async function requestJoinClan(userId, clanQuery, opts = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID người dùng không hợp lệ.' };
  if (!supabase) return { success: false, status: 503, error: 'DB_UNAVAILABLE', message: 'Supabase chưa sẵn sàng.' };

  const { user } = await ensureUserInitialized(cleanId, {
    username: pickCleanDisplayValue(opts.username, opts.fallbackUsername),
    avatarUrl: pickCleanDisplayValue(opts.avatarUrl),
  });
  if (!user) return { success: false, status: 500, error: 'USER_INIT_FAILED', message: 'Không thể khởi tạo hồ sơ.' };
  if (user.clan_id) return { success: false, status: 400, error: 'ALREADY_IN_CLAN', message: 'Bạn đang ở trong một Gia Tộc rồi!' };

  const clan = await resolveClanByQuery(clanQuery);
  if (!clan) return { success: false, status: 404, error: 'CLAN_NOT_FOUND', message: `Không tìm thấy Gia Tộc '${clanQuery}'.` };

  const [{ count: memberCount }, { data: dupReq }] = await Promise.all([
    supabase.from('users').select('user_id', { count: 'exact', head: true }).eq('clan_id', clan.clan_id),
    supabase.from('clan_join_requests').select('id').eq('clan_id', clan.clan_id).eq('user_id', cleanId).eq('status', 'pending').maybeSingle(),
  ]);

  const maxMembers = Math.max(Number(clan.max_members || 10), getClanLevelConfig(clan.clan_level).maxMembers);
  if ((memberCount || 0) >= maxMembers) {
    return { success: false, status: 400, error: 'CLAN_FULL', message: `Gia Tộc **${clan.clan_name}** đã đủ **${memberCount}/${maxMembers}** thành viên.` };
  }
  if (dupReq) {
    return { success: false, status: 400, error: 'REQUEST_ALREADY_PENDING', message: `Bạn đã gửi đơn xin vào **${clan.clan_name}** trước đó rồi, hãy chờ Tộc Trưởng duyệt.` };
  }

  await supabase.from('clan_join_requests').insert({
    clan_id: clan.clan_id,
    user_id: cleanId,
    username: user.username,
    status: 'pending',
  });

  return {
    success: true,
    clan_id: clan.clan_id,
    clan_name: clan.clan_name,
    message: `${em('su_wiki_scroll')} Đã gửi đơn xin gia nhập **${clan.clan_name}**! Tộc Trưởng <@${clan.leader_id}> có thể duyệt bằng \`/giatoc hanh_dong:approve thanh_vien:@${user.username}\`.`,
  };
}

/**
 * Tộc Trưởng xem danh sách đơn xin gia nhập (/giatoc hanh_dong:requests)
 */
export async function listJoinRequests(leaderId) {
  const cleanLeader = sanitizeUserId(leaderId);
  if (!cleanLeader) return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID không hợp lệ.' };
  if (!supabase) return { success: false, status: 503, error: 'DB_UNAVAILABLE', message: 'Supabase chưa sẵn sàng.' };

  const { data: clan } = await supabase.from('clans').select('*').eq('leader_id', cleanLeader).maybeSingle();
  if (!clan) return { success: false, status: 403, error: 'NOT_CLAN_LEADER', message: 'Chỉ Tộc Trưởng mới có thể xem danh sách đơn gia nhập!' };

  const { data: reqs } = await supabase
    .from('clan_join_requests')
    .select('*')
    .eq('clan_id', clan.clan_id)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  const list = reqs || [];
  const summaryRequests = list.length
    ? list.map((r, i) => `• \`#${i + 1}\` **${r.username}** (<@${r.user_id}>)`).join('\n')
    : '• Hiện không có đơn xin gia nhập nào đang chờ duyệt.';

  return {
    success: true,
    clan_id: clan.clan_id,
    requests: list,
    summary_requests: summaryRequests,
    message: `${em('su_clan_castle')} **ĐƠN XIN GIA NHẬP — ${clan.clan_name}**\n\n${summaryRequests}`,
  };
}

/**
 * Tộc Trưởng duyệt hoặc từ chối đơn gia nhập (/giatoc hanh_dong:approve | reject)
 */
export async function respondJoinRequest(leaderId, applicantId, decision = 'approve', opts = {}) {
  const cleanLeader = sanitizeUserId(leaderId);
  const cleanApplicant = sanitizeUserId(applicantId);
  if (!cleanLeader || !cleanApplicant) {
    return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'Cần chọn thành viên hợp lệ (`thanh_vien`).' };
  }
  if (!supabase) return { success: false, status: 503, error: 'DB_UNAVAILABLE', message: 'Supabase chưa sẵn sàng.' };

  const { data: clan } = await supabase.from('clans').select('*').eq('leader_id', cleanLeader).maybeSingle();
  if (!clan) return { success: false, status: 403, error: 'NOT_CLAN_LEADER', message: 'Chỉ Tộc Trưởng mới có quyền duyệt thành viên!' };

  const { data: reqRow } = await supabase
    .from('clan_join_requests')
    .select('*')
    .eq('clan_id', clan.clan_id)
    .eq('user_id', cleanApplicant)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!reqRow) {
    return { success: false, status: 404, error: 'REQUEST_NOT_FOUND', message: `Không tìm thấy đơn xin gia nhập đang chờ của <@${cleanApplicant}>.` };
  }

  const nowIso = (opts.now instanceof Date ? opts.now : new Date()).toISOString();
  const isReject = ['reject', 'decline', 'no'].includes(String(decision || '').toLowerCase());
  if (isReject) {
    await supabase.from('clan_join_requests').update({ status: 'rejected', updated_at: nowIso }).eq('id', reqRow.id);
    return {
      success: true,
      approved: false,
      clan_id: clan.clan_id,
      user_id: cleanApplicant,
      message: `${em('su_wiki_scroll')} Đã từ chối đơn gia nhập của <@${cleanApplicant}>.`,
    };
  }

  const [{ count: memberCount }, { data: applicant }] = await Promise.all([
    supabase.from('users').select('user_id', { count: 'exact', head: true }).eq('clan_id', clan.clan_id),
    supabase.from('users').select('clan_id, username').eq('user_id', cleanApplicant).maybeSingle(),
  ]);

  if (!applicant) return { success: false, status: 404, error: 'USER_NOT_FOUND', message: 'Không tìm thấy người nộp đơn.' };
  if (applicant.clan_id) {
    await supabase.from('clan_join_requests').update({ status: 'cancelled', updated_at: nowIso }).eq('id', reqRow.id);
    return { success: false, status: 400, error: 'ALREADY_IN_CLAN', message: 'Người này đã gia nhập một Gia Tộc khác rồi!' };
  }

  const maxMembers = Math.max(Number(clan.max_members || 10), getClanLevelConfig(clan.clan_level).maxMembers);
  if ((memberCount || 0) >= maxMembers) {
    return { success: false, status: 400, error: 'CLAN_FULL', message: `Gia Tộc đã đạt tối đa **${memberCount}/${maxMembers}** thành viên.` };
  }

  await Promise.all([
    supabase.from('users').update({ clan_id: clan.clan_id, updated_at: nowIso }).eq('user_id', cleanApplicant),
    supabase.from('clan_join_requests').update({ status: 'approved', updated_at: nowIso }).eq('id', reqRow.id),
    supabase.from('clan_join_requests').update({ status: 'cancelled', updated_at: nowIso }).eq('user_id', cleanApplicant).eq('status', 'pending').neq('id', reqRow.id),
  ]);

  return {
    success: true,
    approved: true,
    clan_id: clan.clan_id,
    clan_name: clan.clan_name,
    user_id: cleanApplicant,
    message: `${em('su_sparkle')} Chào mừng **${applicant.username}** (<@${cleanApplicant}>) chính thức gia nhập **${clan.clan_name}**!`,
  };
}

/**
 * Rời Gia Tộc (/giatoc hanh_dong:leave)
 */
export async function leaveClan(userId, opts = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID không hợp lệ.' };
  if (!supabase) return { success: false, status: 503, error: 'DB_UNAVAILABLE', message: 'Supabase chưa sẵn sàng.' };

  const { data: user } = await supabase.from('users').select('user_id, username, clan_id').eq('user_id', cleanId).maybeSingle();
  if (!user || !user.clan_id) return { success: false, status: 400, error: 'NOT_IN_CLAN', message: 'Bạn chưa gia nhập Gia Tộc nào.' };

  const { data: clan } = await supabase.from('clans').select('*').eq('clan_id', user.clan_id).maybeSingle();
  const nowIso = (opts.now instanceof Date ? opts.now : new Date()).toISOString();

  if (clan && clan.leader_id === cleanId) {
    if (clan.clan_id === 'thien_ho_than_toc') {
      return { success: false, status: 403, error: 'CANNOT_DISBAND_ROYAL_CLAN', message: 'Không thể giải tán **Thiên Hồ Thần Tộc**!' };
    }
    const { count: memberCount } = await supabase.from('users').select('user_id', { count: 'exact', head: true }).eq('clan_id', clan.clan_id);
    if ((memberCount || 0) > 1) {
      return {
        success: false,
        status: 400,
        error: 'LEADER_MUST_KICK_FIRST',
        message: 'Tộc Trưởng chỉ có thể rời/giải tán Gia Tộc khi không còn thành viên nào khác trong tộc.',
      };
    }
    await supabase.from('users').update({ clan_id: null, updated_at: nowIso }).eq('user_id', cleanId);
    await supabase.from('clans').delete().eq('clan_id', clan.clan_id);
    return { success: true, disbanded: true, message: `${em('su_clan_castle')} Đã giải tán Gia Tộc **${clan.clan_name}**.` };
  }

  await supabase.from('users').update({ clan_id: null, updated_at: nowIso }).eq('user_id', cleanId);
  return { success: true, disbanded: false, message: `${em('su_clan_castle')} **${user.username}** đã rời khỏi Gia Tộc **${clan?.clan_name || user.clan_id}**.` };
}

/**
 * Tộc Trưởng trục xuất thành viên (/giatoc hanh_dong:kick)
 */
export async function kickClanMember(leaderId, targetId, opts = {}) {
  const cleanLeader = sanitizeUserId(leaderId);
  const cleanTarget = sanitizeUserId(targetId);
  if (!cleanLeader || !cleanTarget) return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID không hợp lệ.' };
  if (cleanLeader === cleanTarget) return { success: false, status: 400, error: 'CANNOT_KICK_SELF', message: 'Không thể tự trục xuất chính mình!' };
  if (!supabase) return { success: false, status: 503, error: 'DB_UNAVAILABLE', message: 'Supabase chưa sẵn sàng.' };

  const { data: clan } = await supabase.from('clans').select('*').eq('leader_id', cleanLeader).maybeSingle();
  if (!clan) return { success: false, status: 403, error: 'NOT_CLAN_LEADER', message: 'Chỉ Tộc Trưởng mới có quyền trục xuất thành viên!' };

  const { data: target } = await supabase.from('users').select('user_id, username, clan_id').eq('user_id', cleanTarget).maybeSingle();
  if (!target || target.clan_id !== clan.clan_id) {
    return { success: false, status: 404, error: 'MEMBER_NOT_IN_CLAN', message: 'Người này không thuộc Gia Tộc của bạn.' };
  }

  await supabase.from('users').update({ clan_id: null, updated_at: (opts.now instanceof Date ? opts.now : new Date()).toISOString() }).eq('user_id', cleanTarget);
  return { success: true, kicked_user_id: cleanTarget, message: `${em('su_clan_castle')} Đã trục xuất **${target.username}** khỏi **${clan.clan_name}**.` };
}

/**
 * Cống hiến Linh Thạch vào ngân khố Gia Tộc (/giatoc hanh_dong:donate)
 */
export async function donateToClan(userId, amount, opts = {}) {
  const cleanId = sanitizeUserId(userId);
  const parsed = Math.floor(Number(amount) || 0);
  if (!cleanId) return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID không hợp lệ.' };
  if (parsed < 100) return { success: false, status: 400, error: 'MIN_DONATE', message: 'Số Linh Thạch cống hiến tối thiểu là **100**.' };
  if (!supabase) return { success: false, status: 503, error: 'DB_UNAVAILABLE', message: 'Supabase chưa sẵn sàng.' };

  return withClanLock(`donate:${cleanId}`, async () => {
    const { data: user } = await supabase.from('users').select('user_id, username, linh_thach, clan_id').eq('user_id', cleanId).maybeSingle();
    if (!user || !user.clan_id) return { success: false, status: 400, error: 'NOT_IN_CLAN', message: 'Bạn chưa gia nhập Gia Tộc nào!' };

    const bal = Number(user.linh_thach || 0);
    if (bal < parsed) {
      return { success: false, status: 400, error: 'INSUFFICIENT_LINH_THACH', message: `Không đủ Linh Thạch! Hiện có **${bal.toLocaleString('vi-VN')}** ${em('su_linhthach')}.` };
    }

    const { data: clan } = await supabase.from('clans').select('*').eq('clan_id', user.clan_id).single();
    const nowIso = (opts.now instanceof Date ? opts.now : new Date()).toISOString();
    const nextTreasury = Number(clan.clan_treasury || 0) + parsed;
    const nextTotalExp = Number(clan.total_exp || 0) + parsed;

    await Promise.all([
      supabase.from('users').update({ linh_thach: bal - parsed, updated_at: nowIso }).eq('user_id', cleanId),
      supabase.from('clans').update({ clan_treasury: nextTreasury, total_exp: nextTotalExp, updated_at: nowIso }).eq('clan_id', clan.clan_id),
    ]);

    return {
      success: true,
      donated: parsed,
      linh_thach: bal - parsed,
      clan_treasury: nextTreasury,
      message: `${em('su_linhthach')} **${user.username}** đã cống hiến **+${parsed.toLocaleString('vi-VN')} Linh Thạch** vào ngân khố **${clan.clan_name}**!\n• Ngân khố hiện tại: **${nextTreasury.toLocaleString('vi-VN')}** ${em('su_linhthach')}`,
    };
  });
}

/**
 * Nâng cấp Gia Tộc Lv.1 -> Lv.10 bằng Ngân Khố (/giatoc hanh_dong:upgrade)
 */
export async function upgradeClan(leaderId, opts = {}) {
  const cleanLeader = sanitizeUserId(leaderId);
  if (!cleanLeader) return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID không hợp lệ.' };
  if (!supabase) return { success: false, status: 503, error: 'DB_UNAVAILABLE', message: 'Supabase chưa sẵn sàng.' };

  const { data: clan } = await supabase.from('clans').select('*').eq('leader_id', cleanLeader).maybeSingle();
  if (!clan) return { success: false, status: 403, error: 'NOT_CLAN_LEADER', message: 'Chỉ Tộc Trưởng mới có quyền nâng cấp Gia Tộc!' };

  const curLevel = Number(clan.clan_level || 1);
  if (curLevel >= 10) return { success: false, status: 400, error: 'MAX_CLAN_LEVEL', message: `Gia Tộc **${clan.clan_name}** đã đạt cấp tối đa **Lv.10**!` };

  const curCfg = getClanLevelConfig(curLevel);
  const nextCfg = getClanLevelConfig(curLevel + 1);
  const cost = curCfg.upgradeCost;
  const treasury = Number(clan.clan_treasury || 0);

  if (treasury < cost) {
    return {
      success: false,
      status: 400,
      error: 'INSUFFICIENT_TREASURY',
      message: `Ngân khố **${clan.clan_name}** chưa đủ **${cost.toLocaleString('vi-VN')}** ${em('su_linhthach')} để lên **Lv.${curLevel + 1}** (hiện có **${treasury.toLocaleString('vi-VN')}**).`,
    };
  }

  const nextTreasury = treasury - cost;
  const nextMaxMembers = Math.max(Number(clan.max_members || 10), nextCfg.maxMembers);
  await supabase
    .from('clans')
    .update({
      clan_level: curLevel + 1,
      clan_treasury: nextTreasury,
      max_members: nextMaxMembers,
      updated_at: (opts.now instanceof Date ? opts.now : new Date()).toISOString(),
    })
    .eq('clan_id', clan.clan_id);

  return {
    success: true,
    old_level: curLevel,
    new_level: curLevel + 1,
    max_members: nextMaxMembers,
    clan_treasury: nextTreasury,
    message: `${em('su_level_up')} Nâng cấp thành công **${clan.clan_name}** lên **Lv.${curLevel + 1}**!\n• Sức chứa mới: **${nextMaxMembers} thành viên** • Buff mới: **+${nextCfg.expBonusPct}% EXP & +${nextCfg.ltBonusPct}% Daily Linh Thạch** • Ngân khố còn: **${nextTreasury.toLocaleString('vi-VN')}** ${em('su_linhthach')}.`,
  };
}

/**
 * Tuyên chiến Gia Tộc 24H (/giatoc hanh_dong:war_declare)
 */
export async function declareClanWar(leaderId, targetClanQuery, betAmount, opts = {}) {
  const cleanLeader = sanitizeUserId(leaderId);
  if (!cleanLeader) return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID không hợp lệ.' };
  if (!supabase) return { success: false, status: 503, error: 'DB_UNAVAILABLE', message: 'Supabase chưa sẵn sàng.' };

  await settleExpiredClanWars(opts);

  const { data: myClan } = await supabase.from('clans').select('*').eq('leader_id', cleanLeader).maybeSingle();
  if (!myClan) return { success: false, status: 403, error: 'NOT_CLAN_LEADER', message: 'Chỉ Tộc Trưởng mới có quyền tuyên chiến Gia Tộc!' };

  const targetClan = await resolveClanByQuery(targetClanQuery);
  if (!targetClan) return { success: false, status: 404, error: 'TARGET_CLAN_NOT_FOUND', message: `Không tìm thấy Gia Tộc đối thủ '${targetClanQuery}'.` };
  if (targetClan.clan_id === myClan.clan_id) return { success: false, status: 400, error: 'SELF_WAR', message: 'Không thể tự tuyên chiến với chính Gia Tộc của mình!' };

  const bet = Math.floor(Number(betAmount) || CLAN_WAR_MIN_BET);
  if (bet < CLAN_WAR_MIN_BET) {
    return { success: false, status: 400, error: 'BET_TOO_LOW', message: `Tiền cược Bang Chiến tối thiểu là **${CLAN_WAR_MIN_BET} Linh Thạch**.` };
  }
  if (Number(myClan.clan_treasury || 0) < bet) {
    return { success: false, status: 400, error: 'INSUFFICIENT_TREASURY', message: `Ngân khố **${myClan.clan_name}** không đủ **${bet.toLocaleString('vi-VN')}** ${em('su_linhthach')} để đặt cược.` };
  }
  if (Number(targetClan.clan_treasury || 0) < bet) {
    return { success: false, status: 400, error: 'TARGET_INSUFFICIENT_TREASURY', message: `Ngân khố đối thủ **${targetClan.clan_name}** chưa đủ **${bet.toLocaleString('vi-VN')}** ${em('su_linhthach')} để đối ứng.` };
  }

  const { data: busyWars } = await supabase
    .from('clan_wars')
    .select('war_id')
    .in('status', ['pending', 'active'])
    .or(`challenger_clan_id.in.(${myClan.clan_id},${targetClan.clan_id}),target_clan_id.in.(${myClan.clan_id},${targetClan.clan_id})`)
    .limit(1);

  if (busyWars && busyWars.length > 0) {
    return { success: false, status: 400, error: 'CLAN_BUSY_IN_WAR', message: 'Một trong hai Gia Tộc đang có trận Bang Chiến hoặc lời thách đấu chưa giải quyết!' };
  }

  const now = opts.now instanceof Date ? opts.now : new Date();
  const endTime = new Date(now.getTime() + CLAN_WAR_DURATION_HOURS * 3600 * 1000).toISOString();

  const { data: war, error: warErr } = await supabase
    .from('clan_wars')
    .insert({
      challenger_clan_id: myClan.clan_id,
      target_clan_id: targetClan.clan_id,
      bet_amount: bet,
      status: 'pending',
      start_time: now.toISOString(),
      end_time: endTime,
      challenger_score: 0,
      target_score: 0,
    })
    .select('*')
    .single();

  if (warErr) throw new Error(`Declare war failed: ${warErr.message}`);

  return {
    success: true,
    war,
    message: `${em('su_crossed_swords')} **CHIẾN THƯ GIA TỘC 24H!**\n• **${myClan.clan_name}** chính thức gửi chiến thư tới **${targetClan.clan_name}** với mức cược **${bet.toLocaleString('vi-VN')}** ${em('su_linhthach')} mỗi bên!\n• Mời Tộc Trưởng <@${targetClan.leader_id}> dùng \`/giatoc hanh_dong:war_accept\` hoặc \`war_reject\` để phản hồi.`,
  };
}

/**
 * Tộc Trưởng bên bị thách đấu chấp nhận hoặc từ chối Chiến Thư 24H
 */
export async function respondClanWar(leaderId, decision = 'accept', opts = {}) {
  const cleanLeader = sanitizeUserId(leaderId);
  if (!cleanLeader) return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID không hợp lệ.' };
  if (!supabase) return { success: false, status: 503, error: 'DB_UNAVAILABLE', message: 'Supabase chưa sẵn sàng.' };

  await settleExpiredClanWars(opts);

  const { data: myClan } = await supabase.from('clans').select('*').eq('leader_id', cleanLeader).maybeSingle();
  if (!myClan) return { success: false, status: 403, error: 'NOT_CLAN_LEADER', message: 'Chỉ Tộc Trưởng mới có quyền chấp nhận hoặc từ chối Bang Chiến!' };

  const { data: pendingWar } = await supabase
    .from('clan_wars')
    .select('*')
    .eq('target_clan_id', myClan.clan_id)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!pendingWar) {
    return { success: false, status: 404, error: 'NO_PENDING_WAR', message: `Gia Tộc **${myClan.clan_name}** hiện không có chiến thư nào đang chờ.` };
  }

  const isReject = ['reject', 'decline', 'no'].includes(String(decision || '').toLowerCase());
  if (isReject) {
    await supabase.from('clan_wars').update({ status: 'cancelled' }).eq('war_id', pendingWar.war_id);
    return { success: true, accepted: false, war_id: pendingWar.war_id, message: `${uiEm('ui_surrender_flag')} Tộc Trưởng **${myClan.clan_name}** đã từ chối chiến thư Bang Chiến.` };
  }

  const { data: challClan } = await supabase.from('clans').select('*').eq('clan_id', pendingWar.challenger_clan_id).single();
  const bet = Number(pendingWar.bet_amount || 0);
  if (!challClan || Number(challClan.clan_treasury || 0) < bet || Number(myClan.clan_treasury || 0) < bet) {
    return { success: false, status: 400, error: 'INSUFFICIENT_TREASURY', message: 'Ngân khố một trong hai Gia Tộc hiện không còn đủ tiền cược để khai chiến!' };
  }

  const now = opts.now instanceof Date ? opts.now : new Date();
  const nowIso = now.toISOString();
  const endIso = new Date(now.getTime() + CLAN_WAR_DURATION_HOURS * 3600 * 1000).toISOString();

  await Promise.all([
    supabase.from('clans').update({ clan_treasury: Number(challClan.clan_treasury) - bet, updated_at: nowIso }).eq('clan_id', challClan.clan_id),
    supabase.from('clans').update({ clan_treasury: Number(myClan.clan_treasury) - bet, updated_at: nowIso }).eq('clan_id', myClan.clan_id),
    supabase.from('clan_wars').update({ status: 'active', start_time: nowIso, end_time: endIso, challenger_score: 0, target_score: 0 }).eq('war_id', pendingWar.war_id),
  ]);

  return {
    success: true,
    accepted: true,
    war_id: pendingWar.war_id,
    start_time: nowIso,
    end_time: endIso,
    pot: bet * 2,
    message: `${em('su_arena')} **BANG CHIẾN 24H CHÍNH THỨC KHAI HỎA!**\n• **${challClan.clan_name}** ${em('su_crossed_swords')} **${myClan.clan_name}**\n• Quỹ thưởng: **${(bet * 2).toLocaleString('vi-VN')}** ${em('su_linhthach')} (+5.000 EXP Tộc)\n• Tính điểm qua Chat/Voice EXP & thắng \`/battle\` trong suốt **24 giờ**!`,
  };
}

/**
 * Xem trạng thái Chiến Sự Gia Tộc 24H (/giatoc hanh_dong:war_status)
 */
export async function getClanWarStatus(userId, opts = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID không hợp lệ.' };
  if (!supabase) return { success: false, status: 503, error: 'DB_UNAVAILABLE', message: 'Supabase chưa sẵn sàng.' };

  await settleExpiredClanWars(opts);

  const { data: user } = await supabase.from('users').select('clan_id').eq('user_id', cleanId).maybeSingle();
  if (!user || !user.clan_id) {
    return { success: false, status: 400, error: 'NOT_IN_CLAN', message: 'Bạn chưa gia nhập Gia Tộc nào!' };
  }

  const { data: wars } = await supabase
    .from('clan_wars')
    .select('*')
    .or(`challenger_clan_id.eq.${user.clan_id},target_clan_id.eq.${user.clan_id}`)
    .order('created_at', { ascending: false })
    .limit(1);

  const war = wars?.[0] || null;
  if (!war) {
    return { success: true, has_war: false, war: null, summary_war: '• Chưa có lịch sử Bang Chiến.', message: `${em('su_arena')} Gia Tộc của bạn hiện chưa có trận Bang Chiến nào.` };
  }

  const pot = Number(war.bet_amount || 0) * 2;
  const remaining = war.status === 'active' ? formatRemainingTime(war.end_time) : 'Đã kết thúc';
  const summaryWar = [
    `${em('su_crossed_swords')} **Chiến Báo Bang Chiến #${war.war_id}** *(${war.status.toUpperCase()})*`,
    `• \`${war.challenger_clan_id}\`: **${Number(war.challenger_score || 0).toLocaleString('vi-VN')} điểm**`,
    `• \`${war.target_clan_id}\`: **${Number(war.target_score || 0).toLocaleString('vi-VN')} điểm**`,
    `• Tổng giải thưởng: **${pot.toLocaleString('vi-VN')}** ${em('su_linhthach')} • Thời gian còn lại: **${remaining}**`,
    war.winner_clan_id ? `• ${em('su_winner_trophy')} **Gia Tộc Thắng Cuộc**: \`${war.winner_clan_id}\`` : '',
  ].filter(Boolean).join('\n');

  return {
    success: true,
    has_war: true,
    war,
    pot,
    summary_war: summaryWar,
    message: summaryWar,
  };
}

// ============================================================================
// v1.4 INTERACTIVE COMPONENT V2 UI PANEL (/giatoc Buttons & Dropdowns)
// ============================================================================

const clanUiMemorySelections = new Map();

async function saveClanUiSelection(userId, patch) {
  const rec = {
    user_id: userId,
    view_mode: patch.view_mode || 'overview',
    selected_target_id: patch.selected_target_id ?? null,
    selected_slot_index: patch.selected_slot_index ?? null,
    updated_at: new Date().toISOString(),
  };
  clanUiMemorySelections.set(userId, rec);
  if (supabase) {
    try {
      await supabase.from('clan_ui_selections').upsert(rec, { onConflict: 'user_id' });
    } catch { /* non-blocking fallback to memory */ }
  }
  return rec;
}

async function loadClanUiSelection(userId) {
  if (supabase) {
    try {
      const { data } = await supabase
        .from('clan_ui_selections')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      if (data) return data;
    } catch { /* fallback */ }
  }
  return clanUiMemorySelections.get(userId) || null;
}

/**
 * Tộc Trưởng nhường chức Tộc Trưởng cho 1 thành viên khác trong cùng Gia Tộc.
 */
export async function transferClanLeader(leaderId, targetUserId) {
  const cleanLeader = sanitizeUserId(leaderId);
  const cleanTarget = sanitizeUserId(targetUserId);
  if (!cleanLeader || !cleanTarget) {
    return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID người dùng không hợp lệ.' };
  }
  if (cleanLeader === cleanTarget) {
    return { success: false, status: 400, error: 'SELF_TRANSFER', message: 'Bạn đang là Tộc Trưởng rồi!' };
  }
  if (!supabase) return { success: false, status: 503, error: 'DB_UNAVAILABLE', message: 'Supabase chưa sẵn sàng.' };

  const { data: clan } = await supabase.from('clans').select('*').eq('leader_id', cleanLeader).maybeSingle();
  if (!clan) {
    return { success: false, status: 403, error: 'NOT_CLAN_LEADER', message: 'Chỉ Tộc Trưởng mới có quyền nhường vị!' };
  }

  const { data: member } = await supabase
    .from('users')
    .select('user_id, username, clan_id')
    .eq('user_id', cleanTarget)
    .maybeSingle();

  if (!member || member.clan_id !== clan.clan_id) {
    return { success: false, status: 404, error: 'TARGET_NOT_IN_CLAN', message: 'Người này không phải thành viên trong Gia Tộc của bạn.' };
  }

  await supabase
    .from('clans')
    .update({ leader_id: cleanTarget, updated_at: new Date().toISOString() })
    .eq('clan_id', clan.clan_id);

  return {
    success: true,
    clan_id: clan.clan_id,
    new_leader_id: cleanTarget,
    message: `${uiEm('ui_crown_king')} Tộc Trưởng <@${cleanLeader}> đã chính thức truyền ấn tín Gia Tộc **${clan.clan_name}** cho **${member.username}** (<@${cleanTarget}>)!`,
  };
}

/**
 * Lấy dữ liệu giao diện Component V2 cho /giatoc (overview | requests | members | treasury | war | top).
 */
export async function getClanUiPanel(userId, rawView = 'overview', opts = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID không hợp lệ.' };
  if (!supabase) return { success: false, status: 503, error: 'DB_UNAVAILABLE', message: 'Supabase chưa sẵn sàng.' };

  const view = String(rawView || 'overview').trim().toLowerCase();
  if (view === 'top') {
    const lb = await getClanLeaderboard(10);
    return {
      success: true,
      view: 'top',
      has_clan: true,
      title: `${em('su_clan_castle')} BẢNG XẾP HẠNG GIA TỘC`,
      description: lb.summary_leaderboard || lb.message,
      entries: lb.clans || [],
    };
  }

  const info = await getClanInfo(cleanId, null, opts);
  if (!info.success) return info;

  if (!info.has_clan) {
    const lb = await getClanLeaderboard(10);
    const joinList = (lb.clans || []).slice(0, 10).map((c, idx) =>
      `\`#${idx + 1}\` **${c.clan_name}** (\`${c.clan_id}\`) • Lv.${c.clan_level} • ${c.member_count}/${c.max_members} TV`
    ).join('\n');
    return {
      success: true,
      view: 'no_clan',
      has_clan: false,
      is_leader: false,
      title: `${em('su_clan_castle')} TRUNG TÂM GIA TỘC SUMI`,
      description: `${info.message}\n\n**Top Gia Tộc Đang Tuyển Thành Viên:**\n${joinList || '• Chưa có Gia Tộc nào.'}`,
      dropdown_items: (lb.clans || []).slice(0, 15).map((c, idx) => ({
        slot: idx + 1,
        id: c.clan_id,
        label: `#${idx + 1} ${c.clan_name} (Lv.${c.clan_level})`,
      })),
    };
  }

  const clan = info.clan;
  const isLeader = clan.leader_id === cleanId;

  if (view === 'requests') {
    const { data: reqs } = await supabase
      .from('clan_join_requests')
      .select('id, user_id, created_at')
      .eq('clan_id', clan.clan_id)
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(15);

    const rows = reqs || [];
    const uids = rows.map((r) => r.user_id);
    const { data: users } = uids.length
      ? await supabase.from('users').select('user_id, username, level').in('user_id', uids)
      : { data: [] };
    const uMap = new Map((users || []).map((u) => [u.user_id, u]));

    const lines = rows.map((r, idx) => {
      const u = uMap.get(r.user_id);
      return `• **#${idx + 1}** — **${u?.username || r.user_id}** (<@${r.user_id}>) • Lv.${u?.level || 1}`;
    });

    await saveClanUiSelection(cleanId, { view_mode: 'requests', selected_target_id: null, selected_slot_index: null });

    return {
      success: true,
      view: 'requests',
      has_clan: true,
      is_leader: isLeader,
      pending_count: rows.length,
      title: `${uiEm('ui_clipboard_log')} DUYỆT ĐƠN XIN GIA NHẬP — ${clan.clan_name.toUpperCase()} (${rows.length})`,
      description: rows.length > 0
        ? [
            isLeader
              ? 'Chọn số thứ tự ứng viên ở **Dropdown bên dưới** để hiện nút **Duyệt / Từ Chối**:'
              : '*(Chỉ Tộc Trưởng mới có quyền duyệt đơn gia nhập)*',
            '',
            ...lines,
          ].join('\n')
        : '• Hiện không có đơn xin gia nhập nào đang chờ duyệt.',
      dropdown_items: rows.map((r, idx) => {
        const u = uMap.get(r.user_id);
        return { slot: idx + 1, id: r.user_id, label: `#${idx + 1} ${u?.username || r.user_id} (Lv.${u?.level || 1})` };
      }),
    };
  }

  if (view === 'members') {
    const { data: members } = await supabase
      .from('users')
      .select('user_id, username, level, exp')
      .eq('clan_id', clan.clan_id)
      .order('level', { ascending: false })
      .order('exp', { ascending: false })
      .limit(15);

    const rows = members || [];
    const lines = rows.map((m, idx) =>
      `• **#${idx + 1}** — ${m.user_id === clan.leader_id ? `${uiEm('ui_crown_king')} ` : ''}**${m.username}** (<@${m.user_id}>) • Lv.${m.level}`
    );

    await saveClanUiSelection(cleanId, { view_mode: 'members', selected_target_id: null, selected_slot_index: null });

    return {
      success: true,
      view: 'members',
      has_clan: true,
      is_leader: isLeader,
      member_count: rows.length,
      title: `${uiEm('ui_clipboard_log')} DANH SÁCH THÀNH VIÊN — ${clan.clan_name.toUpperCase()} (${rows.length})`,
      description: [
        isLeader
          ? 'Chọn thành viên ở **Dropdown bên dưới** để quản lý (**Kick** / **Nhường Tộc Trưởng**):'
          : 'Danh sách thành viên tiêu biểu trong Gia Tộc:',
        '',
        ...(lines.length > 0 ? lines : ['• Chưa có thành viên.']),
      ].join('\n'),
      dropdown_items: rows.map((m, idx) => ({
        slot: idx + 1,
        id: m.user_id,
        label: `#${idx + 1} ${m.username} (Lv.${m.level})`,
      })),
    };
  }

  if (view === 'war') {
    const warRes = await getClanWarStatus(cleanId, opts);
    return {
      success: true,
      view: 'war',
      has_clan: true,
      is_leader: isLeader,
      title: `${em('su_crossed_swords')} CHIẾN SỰ GIA TỘC — ${clan.clan_name.toUpperCase()}`,
      description: warRes.summary_war || warRes.message,
      has_pending_war: Boolean(warRes.war?.status === 'pending' && warRes.war?.target_clan_id === clan.clan_id),
    };
  }

  // Default: Overview
  await saveClanUiSelection(cleanId, { view_mode: 'overview', selected_target_id: null, selected_slot_index: null });
  return {
    success: true,
    view: 'overview',
    has_clan: true,
    is_leader: isLeader,
    clan_id: clan.clan_id,
    clan_name: clan.clan_name,
    pending_count: info.pending_requests_count || 0,
    title: `${em('su_clan_castle')} TỔNG QUAN GIA TỘC ${clan.clan_name.toUpperCase()}`,
    description: info.message,
  };
}

/**
 * Khi Tộc Trưởng/thành viên chọn 1 mục trong Dropdown (/giatoc) -> lưu lựa chọn & trả card xác nhận có nút Duyệt/Từ Chối hoặc Kick/Nhường Tộc Trưởng.
 */
export async function selectClanUiSlot(userId, rawView, rawSlotOrId) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID không hợp lệ.' };
  if (!supabase) return { success: false, status: 503, error: 'DB_UNAVAILABLE', message: 'Supabase chưa sẵn sàng.' };

  const view = String(rawView || 'requests').trim().toLowerCase();
  const panel = await getClanUiPanel(cleanId, view);
  if (!panel.success) return panel;

  const rawVal = String(rawSlotOrId || '').trim();
  const items = panel.dropdown_items || [];
  let picked = null;
  if (/^\d{1,2}$/.test(rawVal)) {
    const idx = parseInt(rawVal, 10) - 1;
    picked = items[idx] || null;
  } else {
    picked = items.find((it) => String(it.id) === rawVal) || null;
  }

  if (!picked) {
    return {
      success: false,
      status: 404,
      error: 'SLOT_NOT_FOUND',
      message: `Không tìm thấy mục #${rawVal} trong danh sách hiện tại. Hãy bấm làm mới rồi chọn lại!`,
    };
  }

  await saveClanUiSelection(cleanId, {
    view_mode: view,
    selected_target_id: String(picked.id),
    selected_slot_index: picked.slot,
  });

  if (view === 'requests') {
    return {
      success: true,
      view: 'request_selected',
      selected_target_id: picked.id,
      title: `${uiEm('ui_clipboard_log')} XỬ LÝ ĐƠN GIA NHẬP — ${picked.label}`,
      description: [
        `• **Ứng viên đang chọn:** <@${picked.id}> (${picked.label})`,
        `• Bấm **[${uiEm('ui_check')} Duyệt Vào Tộc]** để kết nạp hoặc **[${uiEm('ui_cross')} Từ Chối]** để hủy đơn.`,
      ].join('\n'),
    };
  }

  if (view === 'members') {
    return {
      success: true,
      view: 'member_selected',
      selected_target_id: picked.id,
      title: `${uiEm('ui_user_avatar')} QUẢN LÝ THÀNH VIÊN — ${picked.label}`,
      description: [
        `• **Thành viên đang chọn:** <@${picked.id}> (${picked.label})`,
        `• Tộc Trưởng có thể bấm **[${uiEm('ui_kick_boot')} Trục Xuất (Kick)]** hoặc **[${uiEm('ui_crown_king')} Nhường Tộc Trưởng]** bên dưới.`,
      ].join('\n'),
    };
  }

  // view === 'no_clan': selected a clan to request join
  const joinRes = await requestJoinClan(cleanId, picked.id);
  return {
    ...joinRes,
    view: 'join_submitted',
    title: `${em('su_clan_castle')} XIN GIA NHẬP GIA TỘC`,
    description: joinRes.message,
  };
}

/**
 * Thực thi nút bấm hành động trên đối tượng đã chọn ở Dropdown /giatoc.
 */
export async function executeClanUiAction(userId, rawAction) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID không hợp lệ.' };

  const action = String(rawAction || '').trim().toLowerCase();
  const sel = await loadClanUiSelection(cleanId);
  const targetId = sel?.selected_target_id || null;

  if (action === 'approve' || action === 'reject') {
    if (!targetId) {
      return { success: false, status: 400, error: 'NO_SELECTION', message: 'Chưa chọn ứng viên nào từ Dropdown!' };
    }
    return respondJoinRequest(cleanId, targetId, action === 'approve' ? 'approve' : 'reject');
  }
  if (action === 'kick') {
    if (!targetId) {
      return { success: false, status: 400, error: 'NO_SELECTION', message: 'Chưa chọn thành viên nào từ Dropdown!' };
    }
    return kickClanMember(cleanId, targetId);
  }
  if (action === 'transfer_leader') {
    if (!targetId) {
      return { success: false, status: 400, error: 'NO_SELECTION', message: 'Chưa chọn thành viên nào từ Dropdown!' };
    }
    return transferClanLeader(cleanId, targetId);
  }
  if (action === 'upgrade') return upgradeClan(cleanId);
  if (action === 'leave') return leaveClan(cleanId);
  if (action === 'war_accept') return respondClanWar(cleanId, 'accept');
  if (action === 'war_reject') return respondClanWar(cleanId, 'reject');

  return { success: false, status: 400, error: 'UNKNOWN_ACTION', message: `Hành động '${action}' không hợp lệ.` };
}
