/**
 * src/services/teaHouseService.js
 * Trà Đạo Quán (/thuongtra) — SuMi Family Ver 1.7.1 Mini:
 * - Chủ ấm được pha trà miễn phí 3 ấm/ngày (UTC+7), nhận ngay 200–300 LT.
 * - Tối đa 2 khách khác nhau bấm [Ké Chén] trên tin nhắn trong vòng 2 phút (120s).
 * - Mỗi người tối đa Ké Chén 3 lần/ngày (không tự ké ấm mình, không ké trùng 1 ấm).
 * - Mỗi lượt Ké Chén thành công:
 *     + Khách nhận: (200–300 LT) + (%Luck khách × 5 LT)
 *     + Chủ ấm nhận thêm: (200–300 LT) + (%Luck chủ ấm × 5 LT)
 * Tuyệt đối KHÔNG dùng emoji Unicode Windows.
 */

import crypto from 'node:crypto';
import { supabase as _supabase } from '../config/supabase.js';
let supabase = _supabase;
import { em, uiEm } from '../config/emojiHelper.js';
import { sanitizeUserId, ensureUserInitialized, pickCleanDisplayValue } from './profileService.js';
import { getVnDateKey, getEffectiveLuckAndFortune, formatLuckSummaryLines } from './luckAndFortuneService.js';

export const TEA_MAX_BREWS_PER_DAY = 3;
export const TEA_MAX_GUEST_JOINS_PER_DAY = 3;
export const TEA_MAX_GUESTS_PER_POT = 2;
export const TEA_BASE_LT_MIN = 200;
export const TEA_BASE_LT_MAX = 300;
export const TEA_LUCK_LT_MULT = 5;
export const TEA_SESSION_TTL_MS = 2 * 60 * 1000;

const teaLocks = new Map();
const memTeaStore = {
  users: new Map(),
  daily: new Map(),
  sessions: new Map(),
};

export function __resetTeaHouseTestStore(seedUsers = null) {
  supabase = seedUsers !== null ? null : _supabase;
  memTeaStore.users.clear();
  memTeaStore.daily.clear();
  memTeaStore.sessions.clear();
  if (seedUsers && typeof seedUsers === 'object') {
    for (const [uid, data] of Object.entries(seedUsers)) {
      memTeaStore.users.set(String(uid), {
        user_id: String(uid),
        username: data.username || `TuSi_${uid}`,
        linh_thach: Number(data.linh_thach ?? data.coins ?? 0),
        streak: Number(data.streak || 0),
        last_daily: data.last_daily || null,
        incense_date: data.incense_date || null,
        incense_luck_pct: Number(data.incense_luck_pct || 0),
      });
    }
  }
}

export function __getTeaHouseTestState(userId) {
  return {
    user: memTeaStore.users.get(String(userId)) || null,
    daily: Array.from(memTeaStore.daily.values()).filter((d) => d.user_id === String(userId)),
    sessions: Array.from(memTeaStore.sessions.values()),
  };
}

async function withTeaLock(key, fn) {
  const k = String(key || '');
  const prev = teaLocks.get(k) || Promise.resolve();
  let release;
  const cur = new Promise((r) => { release = r; });
  const queued = prev.then(() => cur);
  teaLocks.set(k, queued);
  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (teaLocks.get(k) === queued) teaLocks.delete(k);
  }
}

function randomInt(min, max, rng = Math.random) {
  const lo = Math.ceil(min);
  const hi = Math.floor(max);
  return Math.floor(rng() * (hi - lo + 1)) + lo;
}

async function getDailyTeaRecord(userId, dateKey) {
  if (supabase) {
    const { data } = await supabase
      .from('user_tea_daily')
      .select('*')
      .eq('user_id', userId)
      .eq('date_key', dateKey)
      .maybeSingle();
    return data || { user_id: userId, date_key: dateKey, brew_count: 0, guest_join_count: 0, total_lt_earned: 0 };
  }
  const key = `${userId}:${dateKey}`;
  return memTeaStore.daily.get(key) || { user_id: userId, date_key: dateKey, brew_count: 0, guest_join_count: 0, total_lt_earned: 0 };
}

async function upsertDailyTeaRecord(record, nowIso) {
  if (supabase) {
    await supabase
      .from('user_tea_daily')
      .upsert({ ...record, updated_at: nowIso }, { onConflict: 'user_id,date_key' });
    return;
  }
  memTeaStore.daily.set(`${record.user_id}:${record.date_key}`, { ...record, updated_at: nowIso });
}

async function creditUserLt(userId, deltaLt, nowIso, displayOpts = {}) {
  const gain = Math.max(0, Math.round(Number(deltaLt) || 0));
  if (supabase) {
    const { user } = await ensureUserInitialized(userId, displayOpts);
    const nextBal = Number(user?.linh_thach || 0) + gain;
    await supabase
      .from('users')
      .update({ linh_thach: nextBal, updated_at: nowIso })
      .eq('user_id', userId);
    return { balance: nextBal, username: user?.username || displayOpts.username || `Tu sĩ ${userId}` };
  }
  const cur = memTeaStore.users.get(userId) || { user_id: userId, username: displayOpts.username || `TuSi_${userId}`, linh_thach: 0 };
  cur.linh_thach = Number(cur.linh_thach || 0) + gain;
  memTeaStore.users.set(userId, cur);
  return { balance: cur.linh_thach, username: cur.username };
}

function buildTeaSessionEmbedPayload(session, dailyRow, luckInfo, now = new Date()) {
  const lt = em('su_linhthach');
  const potEm = em('tea_ceremony_pot', em('su_sprout'));
  const cupEm = em('tea_cup_cheers', em('su_sparkle'));
  const guests = Array.isArray(session.guests_json) ? session.guests_json : [];
  const expiresMs = new Date(session.expires_at).getTime();
  const remSec = Math.max(0, Math.ceil((expiresMs - now.getTime()) / 1000));
  const isExpired = remSec <= 0 && guests.length < TEA_MAX_GUESTS_PER_POT;
  const isFull = guests.length >= TEA_MAX_GUESTS_PER_POT;

  const statusLine = isFull
    ? `${uiEm('ui_check')} **Ấm trà đã đủ ${TEA_MAX_GUESTS_PER_POT}/${TEA_MAX_GUESTS_PER_POT} khách đối ẩm — viên mãn!**`
    : isExpired
      ? `${uiEm('ui_clock_timer')} **Ấm trà đã nguội (hết 2 phút chờ khách).**`
      : `${uiEm('ui_clock_timer')} **Đang mở mời khách [Ké Chén]:** Còn **${remSec}s** *(tối đa ${guests.length}/${TEA_MAX_GUESTS_PER_POT} khách)*`;

  const guestLines = guests.length > 0
    ? guests.map((g, idx) => (
      `  ${idx + 1}. ${cupEm} <@${g.user_id}>: nhận **+${Number(g.guest_total_lt).toLocaleString('vi-VN')}** ${lt} *(${g.guest_base_lt} gốc + ${g.guest_luck_bonus_lt} từ \`${g.guest_luck_pct}% Luck\`)* — Chủ ấm thêm **+${Number(g.host_total_lt).toLocaleString('vi-VN')}** ${lt}`
    ))
    : [`  ◦ *Chưa có đạo hữu nào ghé ké chén — bấm nút **Ké Chén** bên dưới để cùng thưởng trà!*`];

  const hostTotalInPot = Number(session.host_brew_lt || 0) + guests.reduce((s, g) => s + Number(g.host_total_lt || 0), 0);

  const lines = [
    `${potEm} **Chủ Ấm:** <@${session.host_user_id}> *(Pha ấm **${dailyRow.brew_count}/${TEA_MAX_BREWS_PER_DAY}** hôm nay)*`,
    `• **Thưởng Pha Ấm:** **+${Number(session.host_brew_lt).toLocaleString('vi-VN')}** ${lt} *(Tổng ấm hiện thu về: **${hostTotalInPot.toLocaleString('vi-VN')}** ${lt})*`,
    `• ${statusLine}`,
    '',
    `**${cupEm} Bàn Trà Đối Ẩm (${guests.length}/${TEA_MAX_GUESTS_PER_POT}):**`,
    ...guestLines,
    '',
    luckInfo ? formatLuckSummaryLines(luckInfo) : '',
    `> *Mỗi lượt Ké Chén trong 2 phút giúp cả Khách & Chủ Ấm nhận thêm \`200–300 LT + (%Luck × 5 LT)\`!*`,
  ].filter(Boolean);

  return {
    title: `${potEm} TRÀ ĐẠO QUÁN — ĐỐI ẨM THƯỞNG TRÀ (/thuongtra)`,
    description: lines.join('\n'),
    message: lines.join('\n'),
    color: isFull ? '#22c55e' : isExpired ? '#64748b' : '#f59e0b',
    can_join: !isFull && !isExpired,
    should_disable_button: isFull || isExpired,
  };
}

export async function brewTea(userId, opts = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID người dùng không hợp lệ.' };

  const now = opts.now instanceof Date ? opts.now : new Date();
  const rng = typeof opts.rng === 'function' ? opts.rng : Math.random;
  const dateKey = getVnDateKey(now);
  const nowIso = now.toISOString();

  return withTeaLock(`user:${cleanId}`, async () => {
    const daily = await getDailyTeaRecord(cleanId, dateKey);
    if (Number(daily.brew_count || 0) >= TEA_MAX_BREWS_PER_DAY) {
      return {
        success: false,
        status: 400,
        error: 'TEA_BREW_LIMIT_REACHED',
        brews_used: daily.brew_count,
        brews_remaining: 0,
        title: `${em('tea_ceremony_pot', em('su_warn'))} ĐÃ HẾT LƯỢT PHA TRÀ HÔM NAY`,
        description: `Hôm nay đạo hữu đã pha đủ **${TEA_MAX_BREWS_PER_DAY}/${TEA_MAX_BREWS_PER_DAY}** ấm trà miễn phí rồi! Hãy ghé ké chén ấm của người khác *(tối đa ${TEA_MAX_GUEST_JOINS_PER_DAY} lần/ngày)* hoặc chờ qua \`00:00\` UTC+7 nhé!`,
        message: `Hôm nay đạo hữu đã pha đủ **${TEA_MAX_BREWS_PER_DAY}/${TEA_MAX_BREWS_PER_DAY}** ấm trà miễn phí rồi!`,
      };
    }

    const displayOpts = {
      username: pickCleanDisplayValue(opts.username, opts.fallbackUsername),
      avatarUrl: pickCleanDisplayValue(opts.avatarUrl),
    };
    const luckInfo = await getEffectiveLuckAndFortune(cleanId, now);
    const hostBrewLt = randomInt(TEA_BASE_LT_MIN, TEA_BASE_LT_MAX, rng);
    const creditRes = await creditUserLt(cleanId, hostBrewLt, nowIso, displayOpts);

    const nextDaily = {
      ...daily,
      brew_count: Number(daily.brew_count || 0) + 1,
      total_lt_earned: Number(daily.total_lt_earned || 0) + hostBrewLt,
    };
    await upsertDailyTeaRecord(nextDaily, nowIso);

    const sessionKey = `tea_${crypto.randomBytes(6).toString('hex')}`;
    const expiresAt = new Date(now.getTime() + TEA_SESSION_TTL_MS).toISOString();
    const sessionRow = {
      session_key: sessionKey,
      host_user_id: cleanId,
      host_brew_lt: hostBrewLt,
      host_luck_pct: Math.max(0, Math.round(Number(luckInfo.totalLuckPct || 0))),
      max_guests: TEA_MAX_GUESTS_PER_POT,
      expires_at: expiresAt,
      guests_json: [],
      status: 'open',
      created_at: nowIso,
      updated_at: nowIso,
    };

    if (supabase) {
      const { data: inserted, error } = await supabase
        .from('tea_sessions')
        .insert(sessionRow)
        .select('*')
        .single();
      if (error) throw new Error(`Create tea session failed: ${error.message}`);
      Object.assign(sessionRow, inserted);
    } else {
      sessionRow.id = memTeaStore.sessions.size + 1;
      memTeaStore.sessions.set(sessionKey, sessionRow);
    }

    const embed = buildTeaSessionEmbedPayload(sessionRow, nextDaily, luckInfo, now);
    return {
      success: true,
      session_key: sessionRow.session_key,
      session_id: sessionRow.id || sessionRow.session_key,
      host_user_id: cleanId,
      host_brew_lt: hostBrewLt,
      host_luck_pct: sessionRow.host_luck_pct,
      linh_thach: creditRes.balance,
      brews_used: nextDaily.brew_count,
      brews_remaining: Math.max(0, TEA_MAX_BREWS_PER_DAY - nextDaily.brew_count),
      expires_at: expiresAt,
      luck_info: luckInfo,
      ...embed,
    };
  });
}

export async function joinTeaPot(sessionKeyOrId, guestUserId, opts = {}) {
  const cleanGuestId = sanitizeUserId(guestUserId);
  const rawKey = String(sessionKeyOrId || '').trim();
  if (!cleanGuestId) return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID khách không hợp lệ.' };
  if (!rawKey) return { success: false, status: 400, error: 'INVALID_SESSION_ID', message: 'Không tìm thấy mã ấm trà.' };

  const now = opts.now instanceof Date ? opts.now : new Date();
  const rng = typeof opts.rng === 'function' ? opts.rng : Math.random;
  const dateKey = getVnDateKey(now);
  const nowIso = now.toISOString();

  return withTeaLock(`pot:${rawKey}`, async () => {
    let session = null;
    if (supabase) {
      const q = /^\d+$/.test(rawKey)
        ? supabase.from('tea_sessions').select('*').eq('id', Number(rawKey)).maybeSingle()
        : supabase.from('tea_sessions').select('*').eq('session_key', rawKey).maybeSingle();
      const { data } = await q;
      session = data || null;
    } else {
      session = memTeaStore.sessions.get(rawKey)
        || Array.from(memTeaStore.sessions.values()).find((s) => String(s.id) === rawKey)
        || null;
    }

    if (!session) {
      return { success: false, status: 404, error: 'TEA_SESSION_NOT_FOUND', message: 'Không tìm thấy ấm trà này hoặc phiên đã đóng.' };
    }

    if (String(session.host_user_id) === cleanGuestId) {
      return {
        success: false,
        status: 400,
        error: 'CANNOT_JOIN_OWN_TEA',
        message: `${em('tea_cup_cheers', em('su_warn'))} Đây là ấm trà của chính bạn! Hãy để **1–2 đạo hữu khác** bấm **Ké Chén** để cả hai cùng nhận thưởng nhé!`,
      };
    }

    const guests = Array.isArray(session.guests_json) ? [...session.guests_json] : [];
    if (guests.some((g) => String(g.user_id) === cleanGuestId)) {
      return {
        success: false,
        status: 400,
        error: 'ALREADY_JOINED_POT',
        message: `${em('tea_cup_cheers', em('su_warn'))} Bạn đã **Ké Chén** ấm trà này rồi!`,
      };
    }

    if (session.status === 'full' || guests.length >= Number(session.max_guests || TEA_MAX_GUESTS_PER_POT)) {
      return {
        success: false,
        status: 400,
        error: 'TEA_POT_FULL',
        should_disable_button: true,
        message: `${em('tea_ceremony_pot', em('su_warn'))} Ấm trà này đã đủ **2/2 khách** rồi!`,
      };
    }

    if (now.getTime() > new Date(session.expires_at).getTime() || session.status === 'expired') {
      if (supabase && session.status !== 'expired') {
        await supabase.from('tea_sessions').update({ status: 'expired', updated_at: nowIso }).eq('session_key', session.session_key);
      } else {
        session.status = 'expired';
      }
      return {
        success: false,
        status: 400,
        error: 'TEA_SESSION_EXPIRED',
        should_disable_button: true,
        message: `${uiEm('ui_clock_timer')} Ấm trà đã hết hạn **2 phút** rồi — hẹn đạo hữu ở ấm sau nhé!`,
      };
    }

    const guestDaily = await getDailyTeaRecord(cleanGuestId, dateKey);
    if (Number(guestDaily.guest_join_count || 0) >= TEA_MAX_GUEST_JOINS_PER_DAY) {
      return {
        success: false,
        status: 400,
        error: 'TEA_GUEST_LIMIT_REACHED',
        message: `${em('tea_cup_cheers', em('su_warn'))} Hôm nay bạn đã **Ké Chén** đủ **${TEA_MAX_GUEST_JOINS_PER_DAY}/${TEA_MAX_GUEST_JOINS_PER_DAY} lần** rồi! Hãy pha ấm riêng hoặc chờ qua \`00:00\` UTC+7 nhé.`,
      };
    }

    const [guestLuck, hostLuck] = await Promise.all([
      getEffectiveLuckAndFortune(cleanGuestId, now),
      getEffectiveLuckAndFortune(session.host_user_id, now),
    ]);

    const guestLuckPct = Math.max(0, Math.round(Number(guestLuck.totalLuckPct || 0)));
    const hostLuckPct = Math.max(0, Math.round(Number(hostLuck.totalLuckPct || 0)));

    const guestBaseLt = randomInt(TEA_BASE_LT_MIN, TEA_BASE_LT_MAX, rng);
    const guestLuckBonusLt = Math.max(0, Math.round(guestLuckPct * TEA_LUCK_LT_MULT));
    const guestTotalLt = guestBaseLt + guestLuckBonusLt;

    const hostBaseLt = randomInt(TEA_BASE_LT_MIN, TEA_BASE_LT_MAX, rng);
    const hostLuckBonusLt = Math.max(0, Math.round(hostLuckPct * TEA_LUCK_LT_MULT));
    const hostTotalLt = hostBaseLt + hostLuckBonusLt;

    const displayOpts = {
      username: pickCleanDisplayValue(opts.username, opts.fallbackUsername),
      avatarUrl: pickCleanDisplayValue(opts.avatarUrl),
    };

    const [guestBalRes, hostBalRes, hostDaily] = await Promise.all([
      creditUserLt(cleanGuestId, guestTotalLt, nowIso, displayOpts),
      creditUserLt(session.host_user_id, hostTotalLt, nowIso),
      getDailyTeaRecord(session.host_user_id, dateKey),
    ]);

    const nextGuestDaily = {
      ...guestDaily,
      guest_join_count: Number(guestDaily.guest_join_count || 0) + 1,
      total_lt_earned: Number(guestDaily.total_lt_earned || 0) + guestTotalLt,
    };
    const nextHostDaily = {
      ...hostDaily,
      total_lt_earned: Number(hostDaily.total_lt_earned || 0) + hostTotalLt,
    };
    await Promise.all([
      upsertDailyTeaRecord(nextGuestDaily, nowIso),
      upsertDailyTeaRecord(nextHostDaily, nowIso),
    ]);

    const guestEntry = {
      user_id: cleanGuestId,
      username: guestBalRes.username,
      guest_base_lt: guestBaseLt,
      guest_luck_pct: guestLuckPct,
      guest_luck_bonus_lt: guestLuckBonusLt,
      guest_total_lt: guestTotalLt,
      host_base_lt: hostBaseLt,
      host_luck_pct: hostLuckPct,
      host_luck_bonus_lt: hostLuckBonusLt,
      host_total_lt: hostTotalLt,
      joined_at: nowIso,
    };
    guests.push(guestEntry);
    const nextStatus = guests.length >= Number(session.max_guests || TEA_MAX_GUESTS_PER_POT) ? 'full' : 'open';
    session.guests_json = guests;
    session.status = nextStatus;
    session.updated_at = nowIso;

    if (supabase) {
      await supabase
        .from('tea_sessions')
        .update({ guests_json: guests, status: nextStatus, updated_at: nowIso })
        .eq('session_key', session.session_key);
    }

    const embed = buildTeaSessionEmbedPayload(session, nextHostDaily, hostLuck, now);
    const lt = em('su_linhthach');
    const cupEm = em('tea_cup_cheers', em('su_sparkle'));
    const guestReplyMsg = [
      `${cupEm} <@${cleanGuestId}> vừa **Ké Chén** ấm trà của <@${session.host_user_id}>!`,
      `• **Bạn nhận:** **+${guestTotalLt.toLocaleString('vi-VN')}** ${lt} *(${guestBaseLt} gốc + ${guestLuckBonusLt} từ \`${guestLuckPct}% Luck\` • Còn **${TEA_MAX_GUEST_JOINS_PER_DAY - nextGuestDaily.guest_join_count}** lượt ké hôm nay)*`,
      `• **Chủ ấm nhận thêm:** **+${hostTotalLt.toLocaleString('vi-VN')}** ${lt} *(${hostBaseLt} gốc + ${hostLuckBonusLt} từ \`${hostLuckPct}% Luck\`)*`,
    ].join('\n');

    return {
      success: true,
      session_key: session.session_key,
      session_status: nextStatus,
      guests_count: guests.length,
      max_guests: Number(session.max_guests || TEA_MAX_GUESTS_PER_POT),
      is_full: nextStatus === 'full',
      should_disable_button: embed.should_disable_button,
      guest_reward: {
        user_id: cleanGuestId,
        base_lt: guestBaseLt,
        luck_pct: guestLuckPct,
        luck_bonus_lt: guestLuckBonusLt,
        total_lt: guestTotalLt,
        linh_thach: guestBalRes.balance,
        guest_joins_used: nextGuestDaily.guest_join_count,
        guest_joins_remaining: Math.max(0, TEA_MAX_GUEST_JOINS_PER_DAY - nextGuestDaily.guest_join_count),
      },
      host_reward: {
        user_id: session.host_user_id,
        base_lt: hostBaseLt,
        luck_pct: hostLuckPct,
        luck_bonus_lt: hostLuckBonusLt,
        total_lt: hostTotalLt,
        linh_thach: hostBalRes.balance,
      },
      guest_reply_message: guestReplyMsg,
      updated_embed: embed,
      ...embed,
    };
  });
}
