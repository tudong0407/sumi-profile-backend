/**
 * src/services/spiritVeinService.js
 * Hệ thống Chiếm Đoạt Linh Mạch (/linhmach):
 * - Mở vào 6 Khung Giờ Vàng cố định mỗi ngày (UTC+7): 08:00, 12:00, 18:00, 20:00, 21:00, 22:00 (mỗi đợt 60 phút).
 * - Mỗi đợt spawn 3 Linh Mạch ngẫu nhiên theo tỉ lệ F -> S+ (F 20%, E 19%, D 17%, C 14%, B 11%, A 8%, S 6%, S+ 5%).
 * - Boss lực chiến từ 25k (F) -> 5.2M (S) -> 8.5M+ (S+); sản lượng 6 -> 56 LT/phút.
 * - Chia ĐỀU Linh Thạch sản sinh theo số thành viên giữ mỏ (+15% bonus vào Ngân Khố Gia Tộc nếu cả đội cùng Gia Tộc).
 * - Fatigue (Mệt Mỏi): mỗi lần chiếm mỏ thắng cộng +25% mệt mỏi (tối đa 75%), giảm dần -10% mỗi giờ nghỉ.
 */

import crypto from 'crypto';
import { supabase } from '../config/supabase.js';
import { V14_SPIRIT_VEIN_TIERS } from '../data/v14ExpansionCatalog.js';
import { DOMAIN_BY_ID } from '../data/catalog.js';
import { em, uiEm } from '../config/emojiHelper.js';
import { sanitizeUserId, ensureUserInitialized } from './profileService.js';
import { getUserPartyRecord } from './partyService.js';
import { compileCombatant } from './battleEngine/statsCompiler.js';
import { applyFatigueToCombatant, simulateTeamBattle } from './battleEngine/teamBattleService.js';

export const GOLDEN_HOURS_VN = [8, 12, 18, 20, 21, 22];
export const VEIN_SLOTS_PER_HOUR = 3;
export const FATIGUE_GAIN_PER_CAPTURE = 25;
export const FATIGUE_MAX_PCT = 75;
export const FATIGUE_DECAY_PER_HOUR = 10;

const veinLocks = new Map();

async function withVeinLock(key, fn) {
  const prev = veinLocks.get(key) || Promise.resolve();
  let release;
  const cur = new Promise((r) => { release = r; });
  const queued = prev.then(() => cur);
  veinLocks.set(key, queued);
  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (veinLocks.get(key) === queued) veinLocks.delete(key);
  }
}

export function getVnHourInfo(date = new Date()) {
  const vn = new Date(date.getTime() + 7 * 3600 * 1000);
  const dateKey = vn.toISOString().slice(0, 10);
  const hour = vn.getUTCHours();
  const minute = vn.getUTCMinutes();
  const hourKey = `${dateKey}_${String(hour).padStart(2, '0')}`;
  const isGoldenHour = GOLDEN_HOURS_VN.includes(hour);

  // Start & end of current UTC+7 hour in real UTC timestamps
  const startUtcMs = Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate(), hour, 0, 0) - 7 * 3600 * 1000;
  const endUtcMs = startUtcMs + 60 * 60 * 1000;

  // Next golden hour label
  let nextHour = GOLDEN_HOURS_VN.find((h) => h > hour);
  const nextLabel = nextHour !== undefined ? `${String(nextHour).padStart(2, '0')}:00 hôm nay` : `${String(GOLDEN_HOURS_VN[0]).padStart(2, '0')}:00 ngày mai`;

  // Previous golden hour key (for consecutive fatigue check!)
  let prevHourKey = null;
  const curIdx = GOLDEN_HOURS_VN.indexOf(hour);
  if (curIdx > 0) {
    prevHourKey = `${dateKey}_${String(GOLDEN_HOURS_VN[curIdx - 1]).padStart(2, '0')}`;
  } else {
    const yesterdayVn = new Date(vn.getTime() - 24 * 3600 * 1000);
    const yKey = yesterdayVn.toISOString().slice(0, 10);
    prevHourKey = `${yKey}_${String(GOLDEN_HOURS_VN[GOLDEN_HOURS_VN.length - 1]).padStart(2, '0')}`;
  }

  return {
    dateKey,
    hour,
    minute,
    hourKey,
    prevHourKey,
    isGoldenHour,
    startsAtIso: new Date(startUtcMs).toISOString(),
    endsAtIso: new Date(endUtcMs).toISOString(),
    remainingMinutes: Math.max(0, Math.ceil((endUtcMs - date.getTime()) / 60000)),
    nextGoldenHourLabel: nextLabel,
  };
}

export function deterministicPickWeightedTier(hourKey, slotNum = 1) {
  const pool = V14_SPIRIT_VEIN_TIERS;
  const totalWeight = pool.reduce((sum, t) => sum + Math.max(0, Number(t.spawn_weight || 0)), 0) || 100;
  const hash = crypto.createHash('sha256').update(`sumi-vein-v147:${hourKey}:slot_${slotNum}`).digest();
  const roll = ((hash.readUInt32BE(0) % 10000) / 10000) * totalWeight;

  let acc = 0;
  for (const tier of pool) {
    acc += Math.max(0, Number(tier.spawn_weight || 0));
    if (roll < acc) return tier;
  }
  return pool[pool.length - 1];
}

export function computeCurrentFatigueInfo(fatRow, now = new Date()) {
  if (!fatRow) {
    return { fatiguePct: 0, remainingPowerPct: 100, nextDecayMinutes: 0, hoursToFullClear: 0 };
  }
  const hasStoredPct = fatRow.fatigue_pct !== undefined && fatRow.fatigue_pct !== null;
  const rawStored = hasStoredPct
    ? Number(fatRow.fatigue_pct)
    : Number(fatRow.consecutive_wins || 0) * FATIGUE_GAIN_PER_CAPTURE;
  const storedPct = Math.max(0, Math.min(FATIGUE_MAX_PCT, Math.round(Number(rawStored) || 0)));
  if (storedPct <= 0) {
    return { fatiguePct: 0, remainingPowerPct: 100, nextDecayMinutes: 0, hoursToFullClear: 0 };
  }

  const refRaw = fatRow.fatigue_updated_at || fatRow.updated_at || now;
  const refMs = new Date(refRaw).getTime();
  const nowMs = now instanceof Date ? now.getTime() : new Date(now).getTime();
  const elapsedMs = Number.isFinite(refMs) ? Math.max(0, nowMs - refMs) : 0;
  const elapsedHours = Math.floor(elapsedMs / 3600000);
  const fatiguePct = Math.max(0, Math.min(FATIGUE_MAX_PCT, storedPct - elapsedHours * FATIGUE_DECAY_PER_HOUR));
  const nextDecayMinutes = fatiguePct > 0
    ? Math.max(1, Math.ceil((3600000 - (elapsedMs % 3600000)) / 60000))
    : 0;
  const hoursToFullClear = fatiguePct > 0 ? Math.ceil(fatiguePct / FATIGUE_DECAY_PER_HOUR) : 0;

  return {
    fatiguePct,
    remainingPowerPct: Math.max(0, 100 - fatiguePct),
    nextDecayMinutes,
    hoursToFullClear,
  };
}

function buildBossCombatant(tier) {
  const bossDomain = tier.domain_id ? DOMAIN_BY_ID[tier.domain_id] : null;
  return {
    id: `boss_${tier.boss_id}`,
    name: `[BOSS ${tier.tier_code}] ${tier.boss_name}`,
    avatarUrl: null,
    isBoss: true,
    bossImageFile: `veins/${tier.boss_id}.png`,
    pet: {
      pet_type: tier.boss_id,
      pet_name: tier.boss_name,
      element: tier.element,
      rarity: tier.tier_group === 'high' ? 'Thần Thoại' : 'Tiên Phẩm',
      level: tier.tier_group === 'high' ? 100 : 60,
      star: tier.tier_group === 'high' ? 10 : 5,
    },
    equipment: {},
    domainLoadout: bossDomain ? { domain: bossDomain, sense: null, realm: null } : {},
    atk: tier.stats.atk,
    def: tier.stats.def,
    spd: tier.stats.spd,
    maxHp: tier.stats.hp,
    currentHp: tier.stats.hp,
    shield: 0,
    critRate: tier.tier_group === 'high' ? 0.22 : 0.12,
    aoeSplashPct: Number(tier.aoe_splash_pct || 0),
    powerScore: tier.boss_power,
  };
}

/**
 * Tất toán lượng Linh Thạch tích lũy cho đội đang giữ mỏ từ `last_settled_at` -> `settleUntil`.
 * Chia đều cho từng thành viên trong đội + thưởng thêm 15% vào Ngân Khố Gia Tộc nếu cả đội cùng Clan!
 */
export async function settleVeinIncomeSegment(session, settleUntilDate = new Date(), markSettled = false) {
  if (!supabase || !session) return { paidTotal: 0, perMember: 0, clanBonus: 0, minutes: 0 };

  const endCap = Math.min(settleUntilDate.getTime(), new Date(session.ends_at).getTime());
  const startMs = session.last_settled_at
    ? new Date(session.last_settled_at).getTime()
    : (session.captured_at ? new Date(session.captured_at).getTime() : endCap);

  const minutes = Math.max(0, Math.floor((endCap - startMs) / 60000));
  const members = Array.isArray(session.holder_member_ids) ? session.holder_member_ids.filter(Boolean) : [];
  let paidTotal = 0;
  let perMember = 0;
  let clanBonus = 0;

  if (minutes > 0 && members.length > 0) {
    paidTotal = minutes * Number(session.lt_per_min || 6);
    perMember = Math.floor(paidTotal / members.length);

    const nowIso = new Date().toISOString();
    if (perMember > 0) {
      for (const uid of members) {
        const { data: u } = await supabase.from('users').select('linh_thach').eq('user_id', uid).maybeSingle();
        if (u) {
          await supabase
            .from('users')
            .update({ linh_thach: Number(u.linh_thach || 0) + perMember, updated_at: nowIso })
            .eq('user_id', uid);
        }
      }
    }

    // Bonus +15% vào Ngân Khố Gia Tộc nếu có holder_clan_id (cả đội chung Gia Tộc)
    if (session.holder_clan_id) {
      clanBonus = Math.floor(paidTotal * 0.15);
      if (clanBonus > 0) {
        const { data: clan } = await supabase
          .from('clans')
          .select('clan_treasury')
          .eq('clan_id', session.holder_clan_id)
          .maybeSingle();
        if (clan) {
          await supabase
            .from('clans')
            .update({ clan_treasury: Number(clan.clan_treasury || 0) + clanBonus, updated_at: nowIso })
            .eq('clan_id', session.holder_clan_id);
        }
      }
    }
  }

  const nextSettledIso = minutes > 0
    ? new Date(startMs + minutes * 60000).toISOString()
    : (session.last_settled_at || new Date(endCap).toISOString());

  await supabase
    .from('spirit_vein_sessions')
    .update({
      last_settled_at: nextSettledIso,
      total_lt_paid: Number(session.total_lt_paid || 0) + paidTotal,
      status: markSettled ? 'settled' : session.status,
      updated_at: new Date().toISOString(),
    })
    .eq('session_id', session.session_id);

  return { paidTotal, perMember, clanBonus, minutes };
}

/**
 * Tự động tất toán mọi phiên Linh Mạch đã hết hạn (dùng bởi Cron 12m & trước mọi thao tác /linhmach).
 */
export async function settleExpiredSpiritVeins(now = new Date()) {
  if (!supabase) return [];
  const nowIso = now.toISOString();
  const { data: expired } = await supabase
    .from('spirit_vein_sessions')
    .select('*')
    .eq('status', 'active')
    .lte('ends_at', nowIso);

  const settled = [];
  for (const s of expired || []) {
    const res = await settleVeinIncomeSegment(s, now, true);
    settled.push({ session_id: s.session_id, slot_key: s.slot_key, tier_code: s.tier_code, ...res });
  }
  return settled;
}

/**
 * Lấy trạng thái 3 Linh Mạch hiện tại (tự mở nếu đang trong 6 Khung Giờ Vàng hoặc forceOpen).
 */
export async function getSpiritVeinsOverview(userId = null, opts = {}) {
  if (!supabase) return { success: false, status: 503, error: 'DB_UNAVAILABLE', message: 'Supabase chưa sẵn sàng.' };

  const now = opts.now instanceof Date ? opts.now : new Date();
  await settleExpiredSpiritVeins(now);

  const info = getVnHourInfo(now);
  const canOpen = info.isGoldenHour || Boolean(opts.forceOpen);
  const activeVeins = [];

  if (canOpen) {
    const { data: existingRows } = await supabase
      .from('spirit_vein_sessions')
      .select('*')
      .eq('hour_key', info.hourKey);

    const bySlotKey = new Map((existingRows || []).map((r) => [r.slot_key, r]));
    const legacyLow = bySlotKey.get(`${info.hourKey}_low`) || null;
    const legacyHigh = bySlotKey.get(`${info.hourKey}_high`) || null;

    const slotSpecs = (legacyLow || legacyHigh)
      ? [
          { slotIndex: 1, slotKey: legacyLow ? `${info.hourKey}_low` : `${info.hourKey}_slot_1`, existing: legacyLow || bySlotKey.get(`${info.hourKey}_slot_1`) },
          { slotIndex: 2, slotKey: legacyHigh ? `${info.hourKey}_high` : `${info.hourKey}_slot_2`, existing: legacyHigh || bySlotKey.get(`${info.hourKey}_slot_2`) },
          { slotIndex: 3, slotKey: `${info.hourKey}_slot_3`, existing: bySlotKey.get(`${info.hourKey}_slot_3`) },
        ]
      : [1, 2, 3].map((idx) => ({
          slotIndex: idx,
          slotKey: `${info.hourKey}_slot_${idx}`,
          existing: bySlotKey.get(`${info.hourKey}_slot_${idx}`) || null,
        }));

    for (const sp of slotSpecs) {
      let row = sp.existing;
      if (!row) {
        const forcedCode = opts.forceTiers?.[sp.slotIndex] || opts.forceTiers?.[String(sp.slotIndex)];
        const tier = (forcedCode ? V14_SPIRIT_VEIN_TIERS.find((t) => t.tier_code === forcedCode) : null)
          || deterministicPickWeightedTier(info.hourKey, sp.slotIndex);

        const { data: inserted } = await supabase
          .from('spirit_vein_sessions')
          .upsert({
            slot_key: sp.slotKey,
            hour_key: info.hourKey,
            tier_group: tier.tier_group,
            tier_code: tier.tier_code,
            boss_id: tier.boss_id,
            boss_name: tier.boss_name,
            boss_power: tier.boss_power,
            lt_per_min: tier.lt_per_min,
            starts_at: info.startsAtIso,
            ends_at: info.endsAtIso,
            holder_member_ids: [],
            status: 'active',
          }, { onConflict: 'slot_key' })
          .select('*')
          .single();
        row = inserted;
      }
      if (row) activeVeins.push({ ...row, slot_index: sp.slotIndex });
    }
  }

  // Tính Fatigue theo giờ (-10%/giờ)
  let userFatigueInfo = computeCurrentFatigueInfo(null, now);
  const cleanId = sanitizeUserId(userId || '');
  if (cleanId) {
    const { data: fat } = await supabase
      .from('spirit_vein_fatigue')
      .select('consecutive_wins, fatigue_pct, fatigue_updated_at, last_hour_key, last_slot_hour, updated_at')
      .eq('user_id', cleanId)
      .maybeSingle();
    userFatigueInfo = computeCurrentFatigueInfo(fat, now);
  }
  const userFatiguePct = userFatigueInfo.fatiguePct;
  const userFatigueStacks = userFatiguePct > 0 ? Math.min(3, Math.ceil(userFatiguePct / FATIGUE_GAIN_PER_CAPTURE)) : 0;

  const lt = em('su_linhthach');
  if (!canOpen) {
    return {
      success: true,
      is_open: false,
      hour_key: info.hourKey,
      golden_hours: GOLDEN_HOURS_VN,
      next_golden_hour: info.nextGoldenHourLabel,
      user_fatigue_pct: userFatiguePct,
      user_fatigue_info: userFatigueInfo,
      user_fatigue_stacks: userFatigueStacks,
      veins: [],
      title: `${em('vein_mine_sp')} CHIẾM ĐOẠT LINH MẠCH — NGOÀI KHUNG GIỜ VÀNG`,
      description: [
        `• Hiện tại đang ngoài khung giờ mở Linh Mạch.`,
        `• **6 Khung Giờ Vàng mỗi ngày (UTC+7):** \`08:00\`, \`12:00\`, \`18:00\`, \`20:00\`, \`21:00\`, \`22:00\` *(mỗi đợt mở 60 phút gồm **3 Mỏ** xuất hiện theo tỉ lệ Hạng F → S+)*.`,
        `• **Đợt tiếp theo:** **${info.nextGoldenHourLabel}**`,
        `• **Tỉ lệ ra mỏ:** F \`20%\` • E \`19%\` • D \`17%\` • C \`14%\` • B \`11%\` • A \`8%\` • S \`6%\` • S+ \`5%\``,
        userFatiguePct > 0
          ? `• ${uiEm('ui_warn')} **Mệt mỏi hiện tại:** **-${userFatiguePct}%** *(giảm **-10%/giờ**, giảm tiếp sau **${userFatigueInfo.nextDecayMinutes} phút**, hồi sạch sau ~**${userFatigueInfo.hoursToFullClear} giờ**)*.`
          : `• Hãy tranh thủ lập Tổ Đội 3 người bằng \`/party\` trước giờ mở mỏ nhé!`,
      ].join('\n'),
    };
  }

  const nowMs = now.getTime();
  const enrichedVeins = activeVeins.map((v) => {
    const members = Array.isArray(v.holder_member_ids) ? v.holder_member_ids.filter(Boolean) : [];
    const memberCount = members.length;
    let accruedPerMember = 0;
    let projectedPerMember = 0;

    if (v.holder_leader_id && memberCount > 0) {
      const capMs = v.captured_at ? new Date(v.captured_at).getTime() : nowMs;
      const endMs = v.ends_at ? new Date(v.ends_at).getTime() : nowMs;
      const effectiveNowMs = Math.min(nowMs, endMs);
      const heldMins = Math.max(0, Math.floor((effectiveNowMs - capMs) / 60000));
      const totalProjectedMins = Math.max(0, Math.floor((endMs - capMs) / 60000));
      const rate = Number(v.lt_per_min || 6);
      accruedPerMember = Math.floor((heldMins * rate) / memberCount);
      projectedPerMember = Math.floor((totalProjectedMins * rate) / memberCount);
    }

    return {
      ...v,
      accrued_per_member: accruedPerMember,
      projected_per_member: projectedPerMember,
    };
  });

  const mineBlocks = enrichedVeins.map((v) => {
    const icon = em(v.boss_id || 'vein_mine_f', em('vein_mine_f'));
    const memberCount = (v.holder_member_ids || []).length;
    const holderTxt = v.holder_leader_id
      ? `${uiEm('ui_flag_capture')} Đang chiếm bởi đội <@${v.holder_leader_id}> (${memberCount} người${v.holder_clan_id ? ` • ${em('su_clan_castle')} Gia Tộc \`${v.holder_clan_id}\`` : ''})`
      : `${em('su_shield_def')} **Chưa có chủ** *(Đánh Boss 3v1 để chiếm ngay!)*`;
    const incomeTxt = v.holder_leader_id
      ? `• Đã tích lũy: **+${v.accrued_per_member.toLocaleString('vi-VN')}** ${lt}/người • Dự kiến hết giờ: **~${v.projected_per_member.toLocaleString('vi-VN')}** ${lt}/người`
      : null;

    return [
      `${icon} **[MỎ #${v.slot_index} — HẠNG ${v.tier_code}] ${v.boss_name}**`,
      `• Lực Chiến Boss: **${Number(v.boss_power).toLocaleString('vi-VN')}** • Sản Lượng: **${v.lt_per_min} ${lt}/phút** *(chia đều đội +15% Ngân Khố Tộc nếu cùng Clan)*`,
      `• Trạng Thái: ${holderTxt}`,
      incomeTxt,
    ].filter(Boolean).join('\n');
  });

  const fatigueLine = userFatiguePct > 0
    ? `${uiEm('ui_warn')} **Mệt Mỏi Hiện Tại:** **-${userFatiguePct}% Chiến Lực** *(Còn **${userFatigueInfo.remainingPowerPct}%** sức mạnh • Tự giảm **-10%/giờ**, giảm tiếp sau **${userFatigueInfo.nextDecayMinutes} phút**, hồi sạch sau ~**${userFatigueInfo.hoursToFullClear} giờ**)*`
    : `${em('su_sparkle')} **Trạng Thái Chiến Đấu:** Sung mãn (**100% Chiến Lực**, 0% Mệt Mỏi • chiếm thành công +25%, giảm **-10%/giờ**).`;

  const description = [
    `${uiEm('ui_clock_timer')} **Khung Giờ Vàng:** \`${String(info.hour).padStart(2, '0')}:00 – ${String((info.hour + 1) % 24).padStart(2, '0')}:00\` *(Còn **${info.remainingMinutes} phút** • Tỉ lệ S+ **5%**)*`,
    '',
    mineBlocks.join('\n\n───────────────────\n\n'),
    '',
    fatigueLine,
    '',
    `*Bấm **[${em('su_crossed_swords')} Chiếm Mỏ #1]**, **[${em('su_crossed_swords')} Chiếm Mỏ #2]** hoặc **[${em('su_el_hoa')} Chiếm Mỏ #3]** bên dưới (hỗ trợ cả đi lẻ hoặc Tổ Đội 3 người \`/party\`)!*`,
  ].join('\n');

  return {
    success: true,
    is_open: true,
    hour_key: info.hourKey,
    remaining_minutes: info.remainingMinutes,
    user_fatigue_pct: userFatiguePct,
    user_fatigue_info: userFatigueInfo,
    user_fatigue_stacks: userFatigueStacks,
    veins: enrichedVeins,
    title: `${em('vein_mine_sp')} CHIẾM ĐOẠT LINH MẠCH — ĐANG MỞ (${String(info.hour).padStart(2, '0')}:00)`,
    description,
    message: description,
  };
}

/**
 * Kiểm tra xem có thành viên nào trong đội đang có Pet chính bận đi /explorer hoặc bị trọng thương không.
 */
async function checkTeamPetsReady(memberIds) {
  const { data: activePets } = await supabase
    .from('user_pets')
    .select('user_id, pet_name, status')
    .in('user_id', memberIds)
    .eq('is_active', true);

  const petMap = new Map((activePets || []).map((p) => [p.user_id, p]));
  for (const uid of memberIds) {
    const p = petMap.get(uid);
    if (!p) return { ok: false, message: `<@${uid}> chưa có Linh Thú xuất trận nào!` };
    if (p.status === 'exploring') {
      return {
        ok: false,
        error: 'PET_BUSY_EXPLORING',
        message: `Linh Thú chính **${p.pet_name}** của <@${uid}> đang đi **Khám Phá Bản Đồ** (\`/explorer\`)! Hãy đổi sang Linh Thú phụ khác bằng \`/linhthu\` trước khi đi Địa Mạch.`,
      };
    }
    if (p.status === 'injured') {
      return {
        ok: false,
        error: 'PET_INJURED',
        message: `Linh Thú chính **${p.pet_name}** của <@${uid}> đang bị **Trọng Thương**! Hãy dùng **Cửu Chuyển Hoàn Hồn Lộ** trong \`/explorer\` hoặc đổi Linh Thú khác.`,
      };
    }
  }
  return { ok: true };
}

/**
 * Tổ đội (hoặc cá nhân) khiêu chiến Mỏ #1 / #2 / #3 (hoặc tham số cũ 'low'/'high').
 */
export async function challengeSpiritVein(userId, rawSlotOrGroup = 1, opts = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID không hợp lệ.' };
  const cleanOwner = opts.ownerId ? sanitizeUserId(opts.ownerId) : null;
  if (cleanOwner && cleanOwner !== cleanId) {
    return {
      success: false,
      status: 403,
      error: 'NOT_COMMAND_OWNER',
      message: `${uiEm('ui_warn')} Bảng \`/linhmach\` này thuộc về <@${cleanOwner}>. Hãy tự gõ \`/linhmach\` để khiêu chiến Linh Mạch nhé!`,
    };
  }
  if (!supabase) return { success: false, status: 503, error: 'DB_UNAVAILABLE', message: 'Supabase chưa sẵn sàng.' };

  const targetStr = String(rawSlotOrGroup ?? '1').trim().toLowerCase();
  const slotMatch = targetStr.match(/^(?:slot_)?([1-3])$/);
  const requestedSlot = slotMatch ? Number(slotMatch[1]) : null;
  const legacyGroup = targetStr === 'high' ? 'high' : (targetStr === 'low' ? 'low' : null);
  const lockKey = requestedSlot ? `vein:slot_${requestedSlot}` : `vein:${legacyGroup || 'slot_1'}`;
  const now = opts.now instanceof Date ? opts.now : new Date();

  return withVeinLock(lockKey, async () => {
    const overview = await getSpiritVeinsOverview(cleanId, { now, forceOpen: opts.forceOpen, forceTiers: opts.forceTiers });
    if (!overview.success) return overview;
    if (!overview.is_open) {
      return { success: false, status: 400, error: 'VEIN_CLOSED', message: overview.description };
    }

    const veins = overview.veins || [];
    let vein = null;
    if (requestedSlot) {
      vein = veins.find((v) => Number(v.slot_index) === requestedSlot) || veins[requestedSlot - 1] || null;
    } else if (legacyGroup === 'high') {
      vein = veins.find((v) => v.tier_group === 'high') || veins[veins.length - 1] || null;
    } else {
      vein = veins.find((v) => v.tier_group === 'low') || veins[0] || null;
    }
    if (!vein) {
      return { success: false, status: 404, error: 'VEIN_NOT_FOUND', message: 'Không tìm thấy mỏ Linh Mạch hiện tại.' };
    }

    // Xác định tổ đội (hoặc cá nhân nếu chưa có party)
    const party = await getUserPartyRecord(cleanId);
    if (party && party.leader_id !== cleanId) {
      return {
        success: false,
        status: 403,
        error: 'ONLY_LEADER_CAN_CHALLENGE',
        message: `Chỉ **Đội Trưởng** (<@${party.leader_id}>) mới có thể phát lệnh dẫn cả Tổ Đội đi chiếm Linh Mạch!`,
      };
    }

    const memberIds = party ? party.member_ids.slice(0, 3) : [cleanId];
    if (vein.holder_leader_id && memberIds.includes(vein.holder_leader_id)) {
      return {
        success: false,
        status: 400,
        error: 'ALREADY_HOLDING_VEIN',
        message: `Đội của bạn đang trấn giữ **Mỏ #${vein.slot_index || 1} — Linh Mạch Hạng ${vein.tier_code}** rồi!`,
      };
    }

    // Kiểm tra trạng thái Pet đang bận khám phá / trọng thương
    const readyCheck = await checkTeamPetsReady(memberIds);
    if (!readyCheck.ok) {
      return { success: false, status: 400, error: readyCheck.error || 'TEAM_NOT_READY', message: readyCheck.message };
    }

    const info = getVnHourInfo(now);

    // Đọc Fatigue (% mệt mỏi hồi phục -10%/giờ) cho từng thành viên
    const { data: fatRows } = await supabase
      .from('spirit_vein_fatigue')
      .select('user_id, consecutive_wins, fatigue_pct, fatigue_updated_at, last_hour_key, last_slot_hour, updated_at')
      .in('user_id', memberIds);
    const fatMap = new Map((fatRows || []).map((f) => [f.user_id, f]));

    // Compile chiến sĩ phe Công
    const challengerUnits = [];
    const { data: memberUsers } = await supabase.from('users').select('user_id, clan_id').in('user_id', memberIds);
    const clanSet = new Set((memberUsers || []).map((u) => u.clan_id).filter(Boolean));
    const sharedClanId = (clanSet.size === 1 && (memberUsers || []).length === memberIds.length)
      ? Array.from(clanSet)[0]
      : null;

    for (const uid of memberIds) {
      await ensureUserInitialized(uid, {});
      const compiled = await compileCombatant(uid, 'attacker');
      const fi = computeCurrentFatigueInfo(fatMap.get(uid), now);
      challengerUnits.push(applyFatigueToCombatant(compiled, { fatiguePct: fi.fatiguePct }));
    }

    // Xác định phe Thủ: BOSS Linh Mạch (nếu mỏ trống) HOẶC Snapshot đội đang giữ mỏ (3v3!)
    let defenderUnits = [];
    let isPvpTakeover = false;
    if (vein.holder_leader_id && Array.isArray(vein.holder_snapshot) && vein.holder_snapshot.length > 0) {
      isPvpTakeover = true;
      defenderUnits = vein.holder_snapshot.map((u) => {
        const snapPct = u.fatiguePct ?? u.fatiguePenaltyPct ?? ((Number(u.fatigueStacks || 0)) * FATIGUE_GAIN_PER_CAPTURE);
        return applyFatigueToCombatant(u, { fatiguePct: snapPct });
      });
    } else {
      const tierDef = V14_SPIRIT_VEIN_TIERS.find((t) => t.tier_code === vein.tier_code) || V14_SPIRIT_VEIN_TIERS[0];
      defenderUnits = [buildBossCombatant(tierDef)];
    }

    // Chạy mô phỏng trận chiến Tổ Đội!
    const battle = simulateTeamBattle(challengerUnits, defenderUnits, {
      mode: isPvpTakeover ? '3v3' : '3vBoss',
      veinLabel: `MỎ #${vein.slot_index || 1} • HẠNG ${vein.tier_code} • ${vein.boss_name}`,
      rng: opts.rng,
    });

    const won = battle.winnerSide === 'A';
    let oldHolderSettlement = null;

    if (won) {
      // Nếu cướp từ đội khác -> tất toán phần LT đội cũ đã tích lũy trước lúc bị cướp
      if (vein.holder_leader_id) {
        oldHolderSettlement = await settleVeinIncomeSegment(vein, now, false);
      }

      const nowIso = now.toISOString();
      const snapshotPayload = challengerUnits.map((u) => ({
        id: u.id,
        name: u.name,
        avatarUrl: u.avatarUrl || null,
        pet: u.pet,
        equipment: u.equipment || {},
        domainLoadout: u.slotIndex === 0 || u.id === challengerUnits[0].id ? (u.domainLoadout || {}) : {},
        atk: u.atk,
        def: u.def,
        spd: u.spd,
        maxHp: u.maxHp,
        critRate: u.critRate || 0,
        powerScore: u.powerScore || 0,
        fatigueStacks: u.fatigueStacks || 0,
        fatiguePct: u.fatiguePct ?? u.fatiguePenaltyPct ?? 0,
      }));

      await supabase
        .from('spirit_vein_sessions')
        .update({
          holder_party_id: party?.party_id || null,
          holder_leader_id: cleanId,
          holder_clan_id: sharedClanId,
          holder_member_ids: memberIds,
          holder_snapshot: snapshotPayload,
          captured_at: nowIso,
          last_settled_at: nowIso,
          updated_at: nowIso,
        })
        .eq('session_id', vein.session_id);

      // Cộng +25% Mệt Mỏi (trần 75%) mỗi khung giờ mới chiếm thành công, tự giảm -10%/giờ
      for (const uid of memberIds) {
        const fRow = fatMap.get(uid);
        const lastHk = fRow?.last_hour_key || fRow?.last_slot_hour || null;
        if (lastHk === info.hourKey) continue; // Đã ghi nhận trong khung giờ này
        const curInfo = computeCurrentFatigueInfo(fRow, now);
        const nextPct = Math.min(FATIGUE_MAX_PCT, curInfo.fatiguePct + FATIGUE_GAIN_PER_CAPTURE);
        await supabase.from('spirit_vein_fatigue').upsert({
          user_id: uid,
          fatigue_pct: nextPct,
          fatigue_updated_at: nowIso,
          consecutive_wins: nextPct > 0 ? Math.min(3, Math.ceil(nextPct / FATIGUE_GAIN_PER_CAPTURE)) : 0,
          last_slot_hour: info.hourKey,
          last_hour_key: info.hourKey,
          updated_at: nowIso,
        }, { onConflict: 'user_id' });
      }
    }

    const lt = em('su_linhthach');
    const perMinEach = Math.floor(Number(vein.lt_per_min) / memberIds.length);
    const outcomeMsg = [
      battle.summaryLine,
      won
        ? `${uiEm('ui_flag_capture')} **CHIẾM MỎ THÀNH CÔNG!** Đội của <@${cleanId}> (**${memberIds.length} người**) đã tiếp quản **Linh Mạch Hạng ${vein.tier_code}** (**${vein.lt_per_min} ${lt}/phút**, chia đều ~**${perMinEach} ${lt}/phút/người**${sharedClanId ? ' + **15% vào Ngân Khố Gia Tộc**' : ''})!`
        : `${uiEm('ui_heart_broken')} **KHIÊU CHIẾN THẤT BẠI!** ${isPvpTakeover ? `Đội của <@${vein.holder_leader_id}> vẫn giữ vững Linh Mạch Hạng ${vein.tier_code}!` : `BOSS **${vein.boss_name}** quá hùng mạnh — hãy rủ đủ Tổ Đội 3 người bằng \`/party\` nhé!`}`,
      oldHolderSettlement?.paidTotal > 0
        ? `• *(Đội cũ đã được tất toán **${oldHolderSettlement.paidTotal.toLocaleString('vi-VN')}** ${lt} cho **${oldHolderSettlement.minutes} phút** giữ mỏ trước đó)*`
        : '',
      battle.highlights.length > 0 ? `\n**Diễn Biến Tiêu Biểu:**\n${battle.highlights.slice(0, 4).map((h) => `• ${h}`).join('\n')}` : '',
      battle.webLogUrl ? `• ${em('su_wiki_scroll')} [Xem Full Nhật Ký Chiến Báo Trên Web](${battle.webLogUrl})` : '',
    ].filter(Boolean).join('\n');

    const outcomeTitle = `${em('vein_mine_sp')} CHIẾN BÁO MỎ #${vein.slot_index || 1} — HẠNG ${vein.tier_code}`;
    return {
      success: true,
      won,
      is_pvp_takeover: isPvpTakeover,
      vein_tier: vein.tier_code,
      battle_id: battle.battleId,
      title: outcomeTitle,
      description: outcomeMsg,
      battle_image_url: battle.imageUrl,
      image_url: battle.imageUrl,
      web_log_url: battle.webLogUrl,
      battle,
      message: outcomeMsg,
    };
  });
}
