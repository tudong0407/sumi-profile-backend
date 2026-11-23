/**
 * src/services/partyService.js
 * Hệ thống Tổ Đội (/party — tối đa 3 người) phục vụ Chiếm Đoạt Linh Mạch 3v3 / 3vBoss.
 */

import { supabase } from '../config/supabase.js';
import { em, petEmoji, domainEmoji } from '../config/emojiHelper.js';
import { DOMAIN_BY_ID } from '../data/catalog.js';
import {
  sanitizeUserId,
  ensureUserInitialized,
  pickCleanDisplayValue,
} from './profileService.js';

export const PARTY_MAX_MEMBERS = 3;
const partyLocks = new Map();

async function withPartyLock(key, fn) {
  const prev = partyLocks.get(key) || Promise.resolve();
  let release;
  const cur = new Promise((r) => { release = r; });
  const queued = prev.then(() => cur);
  partyLocks.set(key, queued);
  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (partyLocks.get(key) === queued) partyLocks.delete(key);
  }
}

export async function getUserPartyRecord(userId) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId || !supabase) return null;

  const { data: mem } = await supabase
    .from('party_members')
    .select('party_id')
    .eq('user_id', cleanId)
    .maybeSingle();

  if (!mem?.party_id) return null;

  const [{ data: party }, { data: members }] = await Promise.all([
    supabase.from('parties').select('*').eq('party_id', mem.party_id).maybeSingle(),
    supabase.from('party_members').select('user_id, joined_at').eq('party_id', mem.party_id).order('joined_at', { ascending: true }),
  ]);

  if (!party) return null;
  const memberIds = (members || []).map((m) => m.user_id);
  // Put leader first
  memberIds.sort((a, b) => (a === party.leader_id ? -1 : b === party.leader_id ? 1 : 0));

  return {
    party_id: party.party_id,
    leader_id: party.leader_id,
    member_ids: memberIds,
    created_at: party.created_at,
  };
}

export async function getPartyStatus(userId, opts = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return { success: false, status: 400, error: 'INVALID_USER_ID', title: '⚠️ LỖI TỔ ĐỘI', description: 'ID không hợp lệ.', message: 'ID không hợp lệ.' };
  if (!supabase) return { success: false, status: 503, error: 'DB_UNAVAILABLE', title: '⚠️ LỖI HỆ THỐNG', description: 'Supabase chưa sẵn sàng.', message: 'Supabase chưa sẵn sàng.' };

  await ensureUserInitialized(cleanId, {
    username: pickCleanDisplayValue(opts.username, opts.fallbackUsername),
    avatarUrl: pickCleanDisplayValue(opts.avatarUrl),
  });

  const nowIso = new Date().toISOString();
  const [party, { data: invites }] = await Promise.all([
    getUserPartyRecord(cleanId),
    supabase
      .from('party_invites')
      .select('invite_id, party_id, inviter_id, created_at, expires_at')
      .eq('invitee_id', cleanId)
      .eq('status', 'pending')
      .gt('expires_at', nowIso)
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  const pendingInvites = invites || [];

  if (!party) {
    const inviteLines = pendingInvites.map((inv, i) =>
      `• **#${i + 1}** Lời mời từ <@${inv.inviter_id}> *(hết hạn <t:${Math.floor(new Date(inv.expires_at).getTime() / 1000)}:R>)*`
    );
    return {
      success: true,
      has_party: false,
      is_leader: false,
      member_count: 0,
      pending_invites: pendingInvites,
      title: `${em('su_crossed_swords')} TRUNG TÂM TỔ ĐỘI (/party • Tối đa 3 Người)`,
      description: [
        '• Bạn hiện chưa tham gia Tổ Đội nào *(đi đơn lẻ vẫn có thể khiêu chiến Linh Mạch, nhưng ghép đội **3 người** sẽ dễ hạ Boss S/S+ hơn nhiều!)*',
        pendingInvites.length > 0 ? `\n**Lời Mời Đang Chờ (${pendingInvites.length}):**\n${inviteLines.join('\n')}` : '',
        '',
        '• Dùng `/party moi_dong_doi:@bạn` để mời đồng đội (tối đa 3 người), hoặc bấm **[✅ Chấp Nhận Lời Mời]** nếu có người vừa mời bạn!',
      ].filter(Boolean).join('\n'),
    };
  }

  const [{ data: users }, { data: activePets }, { data: leaderDomainRow }] = await Promise.all([
    supabase.from('users').select('user_id, username, level, clan_id').in('user_id', party.member_ids),
    supabase.from('user_pets').select('user_id, pet_name, pet_type, level, star, power_score, status').in('user_id', party.member_ids).eq('is_active', true),
    supabase.from('user_domains').select('entity_id').eq('user_id', party.leader_id).eq('entity_kind', 'domain').eq('is_equipped', true).maybeSingle(),
  ]);

  const uMap = new Map((users || []).map((u) => [u.user_id, u]));
  const pMap = new Map((activePets || []).map((p) => [p.user_id, p]));
  const leaderDomain = leaderDomainRow?.entity_id ? DOMAIN_BY_ID[leaderDomainRow.entity_id] : null;

  let totalPower = 0;
  const membersDetail = party.member_ids.map((uid, idx) => {
    const u = uMap.get(uid);
    const p = pMap.get(uid);
    const pwr = Number(p?.power_score || 0);
    totalPower += pwr;
    const isLeader = uid === party.leader_id;
    const statusTag = p?.status && p.status !== 'ready' ? ` ⚠️ *(${p.status === 'exploring' ? 'Đang Khám Phá' : 'Trọng Thương'})*` : '';
    return {
      slot: idx + 1,
      user_id: uid,
      username: u?.username || `Tu Sĩ #${uid.slice(-4)}`,
      clan_id: u?.clan_id || null,
      is_leader: isLeader,
      pet_name: p?.pet_name || 'Chưa có Pet',
      pet_type: p?.pet_type || null,
      power_score: pwr,
      pet_status: p?.status || 'ready',
      line: `• **#${idx + 1}** ${isLeader ? '👑 ' : ''}<@${uid}> — ${p ? `${petEmoji(p.pet_type)} **${p.pet_name}** *(Lv.${p.level} • ${p.star}★)* — **${pwr.toLocaleString('vi-VN')} Lực**` : '*Chưa có Linh Thú*'}${statusTag}`,
    };
  });

  const sameClanIds = new Set(membersDetail.map((m) => m.clan_id).filter(Boolean));
  const sameClanBonus = sameClanIds.size === 1 && membersDetail.every((m) => Boolean(m.clan_id));

  const desc = [
    `• **Đội Trưởng:** <@${party.leader_id}> • **Sĩ Số:** **${party.member_ids.length}/${PARTY_MAX_MEMBERS}**`,
    `• **Tổng Chiến Lực Đội:** **${totalPower.toLocaleString('vi-VN')} Lực**${sameClanBonus ? ' • 🏰 **Cùng Gia Tộc (+15% Ngân Khố Tộc)**' : ''}`,
    `• **Linh Vực Áp Dụng Toàn Đội (Của Đội Trưởng):** ${leaderDomain ? `${domainEmoji(leaderDomain.domain_id)} **${leaderDomain.name}** *(${leaderDomain.element})*` : '*Đội trưởng chưa trang bị Linh Vực*'}`,
    '',
    '**Danh Sách Thành Viên:**',
    ...membersDetail.map((m) => m.line),
  ].join('\n');

  return {
    success: true,
    has_party: true,
    is_leader: party.leader_id === cleanId,
    party_id: party.party_id,
    leader_id: party.leader_id,
    member_count: party.member_ids.length,
    total_power: totalPower,
    same_clan_bonus: sameClanBonus,
    members: membersDetail,
    pending_invites: pendingInvites,
    title: `${em('su_crossed_swords')} TỔ ĐỘI CHIẾN ĐẤU (${party.member_ids.length}/${PARTY_MAX_MEMBERS})`,
    description: desc,
    message: desc,
  };
}

export async function inviteToParty(inviterId, rawTargetId, opts = {}) {
  const cleanInviter = sanitizeUserId(inviterId);
  const cleanTarget = sanitizeUserId(String(rawTargetId || '').replace(/[<@!>]/g, ''));
  if (!cleanInviter || !cleanTarget) {
    return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID người mời hoặc đồng đội không hợp lệ.' };
  }
  if (cleanInviter === cleanTarget) {
    return { success: false, status: 400, error: 'SELF_INVITE', message: 'Bạn không thể tự mời chính mình vào tổ đội!' };
  }
  if (!supabase) return { success: false, status: 503, error: 'DB_UNAVAILABLE', title: '⚠️ LỖI HỆ THỐNG', description: 'Supabase chưa sẵn sàng.', message: 'Supabase chưa sẵn sàng.' };

  return withPartyLock(`party:${cleanInviter}`, async () => {
    await Promise.all([
      ensureUserInitialized(cleanInviter, { username: pickCleanDisplayValue(opts.username, opts.fallbackUsername) }),
      ensureUserInitialized(cleanTarget, {}),
    ]);

    let party = await getUserPartyRecord(cleanInviter);
    if (party && party.leader_id !== cleanInviter) {
      return { success: false, status: 403, error: 'NOT_PARTY_LEADER', message: 'Chỉ **Đội Trưởng** mới có quyền mời thêm thành viên!' };
    }

    const targetParty = await getUserPartyRecord(cleanTarget);
    if (targetParty) {
      return { success: false, status: 400, error: 'TARGET_IN_PARTY', message: `<@${cleanTarget}> hiện đã ở trong một Tổ Đội khác rồi!` };
    }

    if (!party) {
      const { data: newParty, error: pErr } = await supabase
        .from('parties')
        .insert({ leader_id: cleanInviter })
        .select('*')
        .single();
      if (pErr) throw new Error(`Create party failed: ${pErr.message}`);
      await supabase.from('party_members').insert({ party_id: newParty.party_id, user_id: cleanInviter });
      party = { party_id: newParty.party_id, leader_id: cleanInviter, member_ids: [cleanInviter] };
    }

    if (party.member_ids.length >= PARTY_MAX_MEMBERS) {
      return { success: false, status: 400, error: 'PARTY_FULL', message: `Tổ Đội đã đủ tối đa **${PARTY_MAX_MEMBERS}/${PARTY_MAX_MEMBERS}** người!` };
    }

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    // Expire previous pending invite between same party & target
    await supabase
      .from('party_invites')
      .update({ status: 'expired' })
      .eq('party_id', party.party_id)
      .eq('invitee_id', cleanTarget)
      .eq('status', 'pending');

    const { data: inv, error: invErr } = await supabase
      .from('party_invites')
      .insert({
        party_id: party.party_id,
        inviter_id: cleanInviter,
        invitee_id: cleanTarget,
        status: 'pending',
        expires_at: expiresAt,
      })
      .select('*')
      .single();
    if (invErr) throw new Error(`Invite failed: ${invErr.message}`);

    return {
      success: true,
      party_id: party.party_id,
      invite_id: inv.invite_id,
      invitee_id: cleanTarget,
      message: `${em('su_crossed_swords')} Đã gửi lời mời Tổ Đội tới <@${cleanTarget}>! *(Hiệu lực 15 phút — <@${cleanTarget}> có thể bấm **[Chấp Nhận Lời Mời]** hoặc **[Từ Chối Lời Mời]** ngay bên dưới, hoặc dùng \`/party\`)*`,
    };
  });
}

export async function respondPartyInvite(userId, decision = 'accept', inviteId = null) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return { success: false, status: 400, error: 'INVALID_USER_ID', title: '⚠️ LỖI TỔ ĐỘI', description: 'ID không hợp lệ.', message: 'ID không hợp lệ.' };
  if (!supabase) return { success: false, status: 503, error: 'DB_UNAVAILABLE', title: '⚠️ LỖI HỆ THỐNG', description: 'Supabase chưa sẵn sàng.', message: 'Supabase chưa sẵn sàng.' };

  return withPartyLock(`invite:${cleanId}`, async () => {
    const nowIso = new Date().toISOString();
    let q = supabase
      .from('party_invites')
      .select('*')
      .eq('invitee_id', cleanId)
      .eq('status', 'pending')
      .gt('expires_at', nowIso)
      .order('created_at', { ascending: false })
      .limit(1);
    if (inviteId) q = q.eq('invite_id', inviteId);
    const { data: rows } = await q;
    const inv = rows?.[0] || null;

    if (!inv) {
      return { success: false, status: 404, error: 'NO_PENDING_INVITE', message: 'Bạn hiện không có lời mời Tổ Đội nào còn hiệu lực.' };
    }

    const isDecline = ['decline', 'reject', 'no'].includes(String(decision || '').toLowerCase());
    if (isDecline) {
      await supabase.from('party_invites').update({ status: 'declined' }).eq('invite_id', inv.invite_id);
      return { success: true, accepted: false, message: `Đã từ chối lời mời Tổ Đội từ <@${inv.inviter_id}>.` };
    }

    const existingParty = await getUserPartyRecord(cleanId);
    if (existingParty) {
      return { success: false, status: 400, error: 'ALREADY_IN_PARTY', message: 'Bạn đang ở trong một Tổ Đội khác rồi! Hãy rời đội cũ trước khi gia nhập đội mới.' };
    }

    const { data: currentMembers } = await supabase
      .from('party_members')
      .select('user_id')
      .eq('party_id', inv.party_id);

    if (!currentMembers || currentMembers.length === 0) {
      await supabase.from('party_invites').update({ status: 'expired' }).eq('invite_id', inv.invite_id);
      return { success: false, status: 404, error: 'PARTY_DISBANDED', message: 'Tổ Đội này đã giải tán.' };
    }
    if (currentMembers.length >= PARTY_MAX_MEMBERS) {
      await supabase.from('party_invites').update({ status: 'expired' }).eq('invite_id', inv.invite_id);
      return { success: false, status: 400, error: 'PARTY_FULL', message: `Tổ Đội đã đủ **${PARTY_MAX_MEMBERS}/${PARTY_MAX_MEMBERS}** người!` };
    }

    const { error: joinErr } = await supabase.from('party_members').insert({
      party_id: inv.party_id,
      user_id: cleanId,
    });
    if (joinErr) throw new Error(`Join party failed: ${joinErr.message}`);

    await supabase.from('party_invites').update({ status: 'accepted' }).eq('invite_id', inv.invite_id);

    return {
      success: true,
      accepted: true,
      party_id: inv.party_id,
      message: `${em('su_sparkle')} <@${cleanId}> đã gia nhập Tổ Đội của <@${inv.inviter_id}> (**${currentMembers.length + 1}/${PARTY_MAX_MEMBERS}** thành viên)!`,
    };
  });
}

export async function leaveOrDisbandParty(userId) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return { success: false, status: 400, error: 'INVALID_USER_ID', title: '⚠️ LỖI TỔ ĐỘI', description: 'ID không hợp lệ.', message: 'ID không hợp lệ.' };
  if (!supabase) return { success: false, status: 503, error: 'DB_UNAVAILABLE', title: '⚠️ LỖI HỆ THỐNG', description: 'Supabase chưa sẵn sàng.', message: 'Supabase chưa sẵn sàng.' };

  const party = await getUserPartyRecord(cleanId);
  if (!party) {
    return { success: false, status: 400, error: 'NOT_IN_PARTY', message: 'Bạn hiện không ở trong Tổ Đội nào.' };
  }

  const remaining = party.member_ids.filter((id) => id !== cleanId);
  if (remaining.length === 0) {
    await supabase.from('parties').delete().eq('party_id', party.party_id);
    return { success: true, disbanded: true, message: '🚪 Bạn đã giải tán Tổ Đội.' };
  }

  await supabase.from('party_members').delete().eq('party_id', party.party_id).eq('user_id', cleanId);
  if (party.leader_id === cleanId) {
    const newLeader = remaining[0];
    await supabase.from('parties').update({ leader_id: newLeader, updated_at: new Date().toISOString() }).eq('party_id', party.party_id);
    return { success: true, disbanded: false, new_leader_id: newLeader, message: `🚪 Bạn đã rời Tổ Đội. Quyền Đội Trưởng được chuyển cho <@${newLeader}>!` };
  }

  return { success: true, disbanded: false, message: '🚪 Bạn đã rời khỏi Tổ Đội.' };
}

export async function kickPartyMember(leaderId, rawTargetId) {
  const cleanLeader = sanitizeUserId(leaderId);
  const cleanTarget = sanitizeUserId(String(rawTargetId || '').replace(/[<@!>]/g, ''));
  if (!cleanLeader || !cleanTarget) return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID không hợp lệ.' };
  if (cleanLeader === cleanTarget) return { success: false, status: 400, error: 'SELF_KICK', message: 'Không thể tự đuổi chính mình — hãy dùng nút Rời Đội!' };
  if (!supabase) return { success: false, status: 503, error: 'DB_UNAVAILABLE', title: '⚠️ LỖI HỆ THỐNG', description: 'Supabase chưa sẵn sàng.', message: 'Supabase chưa sẵn sàng.' };

  const party = await getUserPartyRecord(cleanLeader);
  if (!party || party.leader_id !== cleanLeader) {
    return { success: false, status: 403, error: 'NOT_PARTY_LEADER', message: 'Chỉ Đội Trưởng mới có quyền đuổi thành viên!' };
  }
  if (!party.member_ids.includes(cleanTarget)) {
    return { success: false, status: 404, error: 'NOT_IN_THIS_PARTY', message: 'Người này không nằm trong Tổ Đội của bạn.' };
  }

  await supabase.from('party_members').delete().eq('party_id', party.party_id).eq('user_id', cleanTarget);
  return { success: true, kicked_id: cleanTarget, message: `👢 Đội Trưởng đã mời <@${cleanTarget}> rời khỏi Tổ Đội.` };
}

export async function transferPartyLeader(leaderId, rawTargetId) {
  const cleanLeader = sanitizeUserId(leaderId);
  const cleanTarget = sanitizeUserId(String(rawTargetId || '').replace(/[<@!>]/g, ''));
  if (!cleanLeader || !cleanTarget) return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID không hợp lệ.' };
  if (!supabase) return { success: false, status: 503, error: 'DB_UNAVAILABLE', title: '⚠️ LỖI HỆ THỐNG', description: 'Supabase chưa sẵn sàng.', message: 'Supabase chưa sẵn sàng.' };

  const party = await getUserPartyRecord(cleanLeader);
  if (!party || party.leader_id !== cleanLeader) {
    return { success: false, status: 403, error: 'NOT_PARTY_LEADER', message: 'Chỉ Đội Trưởng mới có quyền chuyển giao chức Đội Trưởng!' };
  }
  if (!party.member_ids.includes(cleanTarget) || cleanTarget === cleanLeader) {
    return { success: false, status: 400, error: 'INVALID_TARGET', message: 'Hãy chọn một đồng đội hợp lệ trong Tổ Đội của bạn.' };
  }

  await supabase.from('parties').update({ leader_id: cleanTarget, updated_at: new Date().toISOString() }).eq('party_id', party.party_id);
  return { success: true, new_leader_id: cleanTarget, message: `👑 Đã chuyển quyền Đội Trưởng (cùng Linh Vực chủ lực) sang <@${cleanTarget}>!` };
}
