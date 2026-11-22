/**
 * src/services/spiritVeinService.js
 * Hệ thống Chiếm Đoạt Linh Mạch (/linhmach):
 * - Mở vào 6 Khung Giờ Vàng cố định mỗi ngày (UTC+7): 08:00, 12:00, 18:00, 20:00, 21:00, 22:00 (mỗi đợt 60 phút).
 * - Mỗi đợt mở 2 Linh Mạch: 1 Cấp Thấp (F / E / D / C) & 1 Cấp Cao (B / A / S / S+).
 * - Boss lực chiến từ 25k (F) -> 5.2M (S) -> 8.5M+ (S+); sản lượng 6 -> 56 LT/phút.
 * - Chia ĐỀU Linh Thạch sản sinh theo số thành viên giữ mỏ (+15% bonus vào Ngân Khố Gia Tộc nếu cả đội cùng Gia Tộc).
 * - Fatigue (Mệt Mỏi): chiếm thành công ở khung giờ trước đi tiếp sẽ dính -25% lực chiến/stack (tối đa -75%), nghỉ 1 khung giờ tự reset.
 */

import crypto from 'crypto';
import { supabase } from '../config/supabase.js';
import { V14_SPIRIT_VEIN_TIERS } from '../data/v14ExpansionCatalog.js';
import { DOMAIN_BY_ID } from '../data/catalog.js';
import { em } from '../config/emojiHelper.js';
import { sanitizeUserId, ensureUserInitialized } from './profileService.js';
import { getUserPartyRecord } from './partyService.js';
import { compileCombatant } from './battleEngine/statsCompiler.js';
import { applyFatigueToCombatant, simulateTeamBattle } from './battleEngine/teamBattleService.js';

export const GOLDEN_HOURS_VN = [8, 12, 18, 20, 21, 22];

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

function deterministicPickTier(group, hourKey) {
  const pool = V14_SPIRIT_VEIN_TIERS.filter((t) => t.tier_group === group);
  const hash = crypto.createHash('sha256').update(`sumi-vein-v14:${hourKey}:${group}`).digest();
  const idx = hash.readUInt32BE(0) % pool.length;
  return pool[idx];
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
    critRate: tier.tier_group === 'high' ? 22 : 12,
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
 * Lấy trạng thái 2 Linh Mạch hiện tại (tự mở nếu đang trong 6 Khung Giờ Vàng hoặc forceOpen).
 */
export async function getSpiritVeinsOverview(userId = null, opts = {}) {
  if (!supabase) return { success: false, status: 503, error: 'DB_UNAVAILABLE', message: 'Supabase chưa sẵn sàng.' };

  const now = opts.now instanceof Date ? opts.now : new Date();
  await settleExpiredSpiritVeins(now);

  const info = getVnHourInfo(now);
  const canOpen = info.isGoldenHour || Boolean(opts.forceOpen);
  const activeVeins = [];

  if (canOpen) {
    for (const group of ['low', 'high']) {
      const slotKey = `${info.hourKey}_${group}`;
      let { data: row } = await supabase
        .from('spirit_vein_sessions')
        .select('*')
        .eq('slot_key', slotKey)
        .maybeSingle();

      if (!row) {
        const tier = opts.forceTiers?.[group]
          ? V14_SPIRIT_VEIN_TIERS.find((t) => t.tier_code === opts.forceTiers[group]) || deterministicPickTier(group, info.hourKey)
          : deterministicPickTier(group, info.hourKey);

        const { data: inserted } = await supabase
          .from('spirit_vein_sessions')
          .upsert({
            slot_key: slotKey,
            hour_key: info.hourKey,
            tier_group: group,
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
      if (row) activeVeins.push(row);
    }
  }

  // Tính Fatigue của user nếu có userId
  let userFatigueStacks = 0;
  const cleanId = sanitizeUserId(userId || '');
  if (cleanId) {
    const { data: fat } = await supabase
      .from('spirit_vein_fatigue')
      .select('consecutive_wins, last_hour_key, last_slot_hour')
      .eq('user_id', cleanId)
      .maybeSingle();
    const lastHk = fat?.last_hour_key || fat?.last_slot_hour || null;
    if (lastHk && (lastHk === info.prevHourKey || lastHk === info.hourKey)) {
      userFatigueStacks = Math.min(3, Number(fat.consecutive_wins || 0));
    }
  }

  const lt = em('su_linhthach');
  if (!canOpen) {
    return {
      success: true,
      is_open: false,
      hour_key: info.hourKey,
      golden_hours: GOLDEN_HOURS_VN,
      next_golden_hour: info.nextGoldenHourLabel,
      veins: [],
      title: `${em('vein_mine_sp', '⛰️')} CHIẾM ĐOẠT LINH MẠCH — NGOÀI KHUNG GIỜ VÀNG`,
      description: [
        `• Hiện tại đang ngoài khung giờ mở Linh Mạch.`,
        `• **6 Khung Giờ Vàng mỗi ngày (UTC+7):** \`08:00\`, \`12:00\`, \`18:00\`, \`20:00\`, \`21:00\`, \`22:00\` *(mỗi đợt mở 60 phút với 2 mỏ: 1 Cấp Thấp F–C & 1 Cấp Cao B–S+)*.`,
        `• **Đợt tiếp theo:** **${info.nextGoldenHourLabel}**`,
        `• Hãy tranh thủ lập Tổ Đội 3 người bằng \`/party\` trước giờ mở mỏ nhé!`,
      ].join('\n'),
    };
  }

  const lines = activeVeins.map((v) => {
    const icon = em(v.boss_id || 'vein_mine_f', '⛰️');
    const holderTxt = v.holder_leader_id
      ? `🚩 Đang chiếm bởi đội <@${v.holder_leader_id}> (${(v.holder_member_ids || []).length} người${v.holder_clan_id ? ` • 🏰 Gia Tộc \`${v.holder_clan_id}\`` : ''})`
      : `🛡️ **Chưa có chủ** *(Đánh Boss 3v1 để chiếm ngay!)*`;
    return [
      `${icon} **[${v.tier_group === 'low' ? 'MỎ THẤP' : 'MỎ CAO'} — HẠNG ${v.tier_code}] ${v.boss_name}**`,
      `• Lực Chiến Boss: **${Number(v.boss_power).toLocaleString('vi-VN')}** • Sản Lượng: **${v.lt_per_min} ${lt}/phút** *(chia đều đội +15% Ngân Khố Tộc nếu cùng Clan)*`,
      `• Trạng Thái: ${holderTxt}`,
    ].join('\n');
  });

  const fatigueLine = userFatigueStacks > 0
    ? `\n⚠️ **Trạng Thái Mệt Mỏi của bạn:** **Stack ×${userFatigueStacks} (-${userFatigueStacks * 25}% Chiến Lực)** do chiếm mỏ liên tiếp! *(Bỏ qua 1 khung giờ sẽ tự hồi phục)*`
    : `\n✨ **Trạng Thái Chiến Đấu:** Sung mãn (**100% Chiến Lực**, 0 Mệt Mỏi).`;

  const description = [
    `⏰ **Khung Giờ Vàng:** \`${String(info.hour).padStart(2, '0')}:00 – ${String((info.hour + 1) % 24).padStart(2, '0')}:00\` *(Còn **${info.remainingMinutes} phút**)*`,
    '',
    ...lines,
    fatigueLine,
    '',
    `*Bấm **[⚔️ Chiếm Mỏ Thấp]** hoặc **[🔥 Chiếm Mỏ Cao]** bên dưới (hỗ trợ cả đi lẻ hoặc Tổ Đội 3 người \`/party\`)!*`,
  ].join('\n');

  return {
    success: true,
    is_open: true,
    hour_key: info.hourKey,
    remaining_minutes: info.remainingMinutes,
    user_fatigue_stacks: userFatigueStacks,
    veins: activeVeins,
    title: `${em('vein_mine_sp', '⛰️')} CHIẾM ĐOẠT LINH MẠCH — ĐANG MỞ (${String(info.hour).padStart(2, '0')}:00)`,
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
 * Tổ đội (hoặc cá nhân) khiêu chiến Mỏ Thấp ('low') hoặc Mỏ Cao ('high').
 */
export async function challengeSpiritVein(userId, rawTierGroup = 'low', opts = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID không hợp lệ.' };
  if (!supabase) return { success: false, status: 503, error: 'DB_UNAVAILABLE', message: 'Supabase chưa sẵn sàng.' };

  const tierGroup = String(rawTierGroup || 'low').trim().toLowerCase() === 'high' ? 'high' : 'low';
  const now = opts.now instanceof Date ? opts.now : new Date();

  return withVeinLock(`vein:${tierGroup}`, async () => {
    const overview = await getSpiritVeinsOverview(cleanId, { now, forceOpen: opts.forceOpen, forceTiers: opts.forceTiers });
    if (!overview.success) return overview;
    if (!overview.is_open) {
      return { success: false, status: 400, error: 'VEIN_CLOSED', message: overview.description };
    }

    const vein = (overview.veins || []).find((v) => v.tier_group === tierGroup);
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
        message: `Đội của bạn đang trấn giữ **Linh Mạch Hạng ${vein.tier_code}** rồi!`,
      };
    }

    // Kiểm tra trạng thái Pet đang bận khám phá / trọng thương
    const readyCheck = await checkTeamPetsReady(memberIds);
    if (!readyCheck.ok) {
      return { success: false, status: 400, error: readyCheck.error || 'TEAM_NOT_READY', message: readyCheck.message };
    }

    const info = getVnHourInfo(now);

    // Đọc Fatigue stacks cho từng thành viên (nếu thắng khung giờ trước thì stack hiện tại áp dụng giảm 25%/stack)
    const { data: fatRows } = await supabase
      .from('spirit_vein_fatigue')
      .select('user_id, consecutive_wins, last_hour_key, last_slot_hour')
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
      const fRow = fatMap.get(uid);
      const lastHk = fRow?.last_hour_key || fRow?.last_slot_hour || null;
      const stacks = (lastHk && (lastHk === info.prevHourKey || lastHk === info.hourKey))
        ? Math.min(3, Number(fRow.consecutive_wins || 0))
        : 0;
      challengerUnits.push(applyFatigueToCombatant(compiled, stacks));
    }

    // Xác định phe Thủ: BOSS Linh Mạch (nếu mỏ trống) HOẶC Snapshot đội đang giữ mỏ (3v3!)
    let defenderUnits = [];
    let isPvpTakeover = false;
    if (vein.holder_leader_id && Array.isArray(vein.holder_snapshot) && vein.holder_snapshot.length > 0) {
      isPvpTakeover = true;
      defenderUnits = vein.holder_snapshot.map((u) => applyFatigueToCombatant(u, u.fatigueStacks || 0));
    } else {
      const tierDef = V14_SPIRIT_VEIN_TIERS.find((t) => t.tier_code === vein.tier_code) || V14_SPIRIT_VEIN_TIERS[0];
      defenderUnits = [buildBossCombatant(tierDef)];
    }

    // Chạy mô phỏng trận chiến Tổ Đội!
    const battle = simulateTeamBattle(challengerUnits, defenderUnits, {
      mode: isPvpTakeover ? '3v3' : '3vBoss',
      veinLabel: `LINH MẠCH HẠNG ${vein.tier_code} • ${vein.boss_name}`,
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

      // Cập nhật Fatigue stack cho từng thành viên (chỉ tăng +1 mỗi khung giờ mới)
      for (const uid of memberIds) {
        const fRow = fatMap.get(uid);
        const lastHk = fRow?.last_hour_key || fRow?.last_slot_hour || null;
        if (lastHk === info.hourKey) continue; // Đã ghi nhận trong khung giờ này
        const nextStacks = lastHk === info.prevHourKey
          ? Math.min(3, Number(fRow?.consecutive_wins || 0) + 1)
          : 1;
        await supabase.from('spirit_vein_fatigue').upsert({
          user_id: uid,
          consecutive_wins: nextStacks,
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
        ? `🚩 **CHIẾM MỎ THÀNH CÔNG!** Đội của <@${cleanId}> (**${memberIds.length} người**) đã tiếp quản **Linh Mạch Hạng ${vein.tier_code}** (**${vein.lt_per_min} ${lt}/phút**, chia đều ~**${perMinEach} ${lt}/phút/người**${sharedClanId ? ' + **15% vào Ngân Khố Gia Tộc**' : ''})!`
        : `💔 **KHIÊU CHIẾN THẤT BẠI!** ${isPvpTakeover ? `Đội của <@${vein.holder_leader_id}> vẫn giữ vững Linh Mạch Hạng ${vein.tier_code}!` : `BOSS **${vein.boss_name}** quá hùng mạnh — hãy rủ đủ Tổ Đội 3 người bằng \`/party\` nhé!`}`,
      oldHolderSettlement?.paidTotal > 0
        ? `• *(Đội cũ đã được tất toán **${oldHolderSettlement.paidTotal.toLocaleString('vi-VN')}** ${lt} cho **${oldHolderSettlement.minutes} phút** giữ mỏ trước đó)*`
        : '',
      battle.highlights.length > 0 ? `\n**Diễn Biến Tiêu Biểu:**\n${battle.highlights.slice(0, 4).map((h) => `• ${h}`).join('\n')}` : '',
      battle.webLogUrl ? `• 📜 [Xem Full Nhật Ký Chiến Báo Trên Web](${battle.webLogUrl})` : '',
    ].filter(Boolean).join('\n');

    return {
      success: true,
      won,
      is_pvp_takeover: isPvpTakeover,
      vein_tier: vein.tier_code,
      battle_id: battle.battleId,
      image_url: battle.imageUrl,
      web_log_url: battle.webLogUrl,
      battle,
      message: outcomeMsg,
    };
  });
}
