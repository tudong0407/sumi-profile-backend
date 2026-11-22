/**
 * src/services/leaderboardService.js
 * Bảng Xếp Hạng Server (/top) — v1.4:
 * - Ẩn hoàn toàn Tiểu thư Fuyumi (757091869183311872) khỏi mọi BXH cá nhân (level, power, wealth, marry);
 *   vẫn giữ nguyên Fuyumi trong bảng Gia Tộc (/giatoc).
 * - Tổng kết & tự động trao quà Top 10 Lực Chiến vào 19:00 Chủ Nhật hàng tuần (UTC+7).
 */

import { supabase } from '../config/supabase.js';
import { MARRY_RING_RANK, FUYUMI_USER_ID } from '../data/catalog.js';
import { em, ringEmoji, realmEmoji, petEmoji } from '../config/emojiHelper.js';
import { getRealmByLevel } from './profileService.js';
import { computeMarriageBuffs } from './marryService.js';

export const VALID_LEADERBOARD_TYPES = ['level', 'power', 'wealth', 'marry'];
export const WEEKLY_ANNOUNCEMENT_CHANNEL_ID = '1033227438735507488';

export const WEEKLY_POWER_REWARD_TIERS = [
  {
    minRank: 1,
    maxRank: 1,
    linh_thach: 3000,
    items: [
      { item_id: 'tower_reset_card', qty: 2 },
      { item_id: 'enchant_stone', qty: 8 },
      { item_id: 'food_survival_pill', qty: 3 },
      { item_id: 'food_yield_tea', qty: 2 },
      { item_id: 'food_speed_fruit', qty: 2 },
      { item_id: 'gacha_ticket_domain', qty: 3 },
    ],
  },
  {
    minRank: 2,
    maxRank: 2,
    linh_thach: 2200,
    items: [
      { item_id: 'tower_reset_card', qty: 2 },
      { item_id: 'enchant_stone', qty: 6 },
      { item_id: 'food_survival_pill', qty: 2 },
      { item_id: 'food_yield_tea', qty: 2 },
      { item_id: 'food_speed_fruit', qty: 1 },
      { item_id: 'gacha_ticket_domain', qty: 2 },
    ],
  },
  {
    minRank: 3,
    maxRank: 3,
    linh_thach: 1600,
    items: [
      { item_id: 'tower_reset_card', qty: 1 },
      { item_id: 'enchant_stone', qty: 5 },
      { item_id: 'food_survival_pill', qty: 2 },
      { item_id: 'food_yield_tea', qty: 1 },
      { item_id: 'food_speed_fruit', qty: 1 },
      { item_id: 'gacha_ticket_domain', qty: 2 },
    ],
  },
  {
    minRank: 4,
    maxRank: 5,
    linh_thach: 1000,
    items: [
      { item_id: 'tower_reset_card', qty: 1 },
      { item_id: 'enchant_stone', qty: 3 },
      { item_id: 'food_survival_pill', qty: 1 },
      { item_id: 'food_yield_tea', qty: 1 },
      { item_id: 'gacha_ticket_equip', qty: 1 },
    ],
  },
  {
    minRank: 6,
    maxRank: 10,
    linh_thach: 600,
    items: [
      { item_id: 'enchant_stone', qty: 2 },
      { item_id: 'food_survival_pill', qty: 1 },
      { item_id: 'food_speed_fruit', qty: 1 },
    ],
  },
];

function rankBadge(idx) {
  if (idx === 0) return '🥇';
  if (idx === 1) return '🥈';
  if (idx === 2) return '🥉';
  return `\`#${idx + 1}\``;
}

export function getRewardTierForRank(rank) {
  const r = Number(rank) || 0;
  return WEEKLY_POWER_REWARD_TIERS.find((t) => r >= t.minRank && r <= t.maxRank) || null;
}

export function getVnIsoWeekKey(date = new Date()) {
  const vn = new Date(date.getTime() + 7 * 3600 * 1000);
  const d = new Date(Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

export function isSundayWeeklySettlementWindow(date = new Date()) {
  const vn = new Date(date.getTime() + 7 * 3600 * 1000);
  return vn.getUTCDay() === 0 && vn.getUTCHours() >= 19;
}

async function grantInventoryItem(userId, itemId, qty) {
  if (!supabase || !userId || !itemId || qty <= 0) return;
  const nowIso = new Date().toISOString();
  const { data: ex } = await supabase
    .from('user_inventory')
    .select('quantity')
    .eq('user_id', userId)
    .eq('item_id', itemId)
    .maybeSingle();

  if (ex) {
    await supabase
      .from('user_inventory')
      .update({ quantity: Number(ex.quantity || 0) + qty, item_category: 'consumable', updated_at: nowIso })
      .eq('user_id', userId)
      .eq('item_id', itemId);
  } else {
    await supabase.from('user_inventory').insert({
      user_id: userId,
      item_id: itemId,
      item_category: 'consumable',
      quantity: qty,
    });
  }
}

export async function getServerLeaderboard(rawType = 'level', limitRaw = 10) {
  const cleanType = String(rawType || 'level').trim().toLowerCase();
  const type = VALID_LEADERBOARD_TYPES.includes(cleanType) ? cleanType : 'level';
  const limit = Math.max(1, Math.min(20, Number(limitRaw) || 10));

  if (!supabase) {
    return {
      success: false,
      status: 503,
      error: 'DB_UNAVAILABLE',
      message: 'Supabase chưa sẵn sàng.',
    };
  }

  let title = '';
  let entries = [];

  if (type === 'level') {
    title = `${em('su_level_up')} BẢNG XẾP HẠNG • CAO THỦ TU VI (TOP ${limit})`;
    const { data, error } = await supabase
      .from('users')
      .select('user_id, username, level, exp')
      .neq('user_id', FUYUMI_USER_ID)
      .order('level', { ascending: false })
      .order('exp', { ascending: false })
      .limit(limit);
    if (error) throw new Error(`Leaderboard level query failed: ${error.message}`);

    entries = (data || [])
      .filter((u) => String(u.user_id) !== FUYUMI_USER_ID)
      .slice(0, limit)
      .map((u, idx) => ({
        rank: idx + 1,
        user_id: u.user_id,
        username: u.username,
        level: Number(u.level) || 1,
        exp: Number(u.exp) || 0,
        realm: getRealmByLevel(Number(u.level) || 1),
        line: `${rankBadge(idx)} **${u.username}** — ${realmEmoji(u.level)} **Lv.${u.level}** *(${u.realm || getRealmByLevel(u.level)} • ${Number(u.exp || 0).toLocaleString('vi-VN')} EXP)*`,
      }));
  } else if (type === 'wealth') {
    title = `${em('su_linhthach')} BẢNG XẾP HẠNG • PHÚ HỘ LINH THẠCH (TOP ${limit})`;
    const { data, error } = await supabase
      .from('users')
      .select('user_id, username, level, linh_thach')
      .neq('user_id', FUYUMI_USER_ID)
      .order('linh_thach', { ascending: false })
      .order('level', { ascending: false })
      .limit(limit);
    if (error) throw new Error(`Leaderboard wealth query failed: ${error.message}`);

    entries = (data || [])
      .filter((u) => String(u.user_id) !== FUYUMI_USER_ID)
      .slice(0, limit)
      .map((u, idx) => ({
        rank: idx + 1,
        user_id: u.user_id,
        username: u.username,
        level: Number(u.level) || 1,
        linh_thach: Number(u.linh_thach) || 0,
        line: `${rankBadge(idx)} **${u.username}** — **${Number(u.linh_thach || 0).toLocaleString('vi-VN')}** ${em('su_linhthach')} *(Lv.${Number(u.level) || 1})*`,
      }));
  } else if (type === 'power') {
    title = `${em('su_crossed_swords')} BẢNG XẾP HẠNG • CHIẾN THẦN LINH THÚ (TOP ${limit})`;
    const { data: pets, error } = await supabase
      .from('user_pets')
      .select('user_id, pet_name, pet_type, level, star, power_score')
      .eq('is_active', true)
      .neq('user_id', FUYUMI_USER_ID)
      .order('power_score', { ascending: false })
      .limit(limit * 2);
    if (error) throw new Error(`Leaderboard power query failed: ${error.message}`);

    // Deduplicate by user_id (keep highest active pet power) & strictly exclude Fuyumi
    const seenUsers = new Set();
    const filteredPets = [];
    for (const p of pets || []) {
      const uid = String(p.user_id || '');
      if (!uid || uid === FUYUMI_USER_ID || seenUsers.has(uid)) continue;
      seenUsers.add(uid);
      filteredPets.push(p);
      if (filteredPets.length >= limit) break;
    }

    const uids = filteredPets.map((p) => p.user_id).filter(Boolean);
    const { data: users } = uids.length
      ? await supabase.from('users').select('user_id, username, level').in('user_id', uids)
      : { data: [] };
    const userMap = new Map((users || []).map((u) => [u.user_id, u]));

    entries = filteredPets.map((p, idx) => {
      const owner = userMap.get(p.user_id);
      const ownerName = owner?.username || `Tu Sĩ #${String(p.user_id || '').slice(-4)}`;
      const pwr = Number(p.power_score) || 0;
      return {
        rank: idx + 1,
        user_id: p.user_id,
        username: ownerName,
        pet_name: p.pet_name,
        pet_type: p.pet_type,
        power_score: pwr,
        line: `${rankBadge(idx)} **${ownerName}** — ${petEmoji(p.pet_type, em('su_pet_paw'))} **${p.pet_name}** *(Lv.${p.level} • ${p.star}★)* — **${pwr.toLocaleString('vi-VN')} Lực**`,
      };
    });
  } else {
    title = `${em('ring_mythic')} BẢNG XẾP HẠNG • TIÊN LỮ VĨNH KẾT (TOP ${limit})`;
    const { data: marriedUsers, error } = await supabase
      .from('users')
      .select('user_id, username, marry_user_id, marry_username, marry_ring_id, marry_date')
      .not('marry_user_id', 'is', null);
    if (error) throw new Error(`Leaderboard marry query failed: ${error.message}`);

    const seenPairs = new Set();
    const pairs = [];
    const now = new Date();
    for (const u of marriedUsers || []) {
      if (String(u.user_id) === FUYUMI_USER_ID || String(u.marry_user_id) === FUYUMI_USER_ID) continue;
      const pairKey = [String(u.user_id), String(u.marry_user_id)].sort().join(':');
      if (seenPairs.has(pairKey)) continue;
      seenPairs.add(pairKey);

      const mBuffs = computeMarriageBuffs(u.marry_ring_id || 'ring_common', u.marry_date, now);
      pairs.push({
        user_id: u.user_id,
        username: u.username,
        partner_id: u.marry_user_id,
        partner_name: u.marry_username || `Tu Sĩ #${String(u.marry_user_id).slice(-4)}`,
        ring_id: mBuffs.ring_id,
        ring_name: mBuffs.ring_name,
        ring_rank: MARRY_RING_RANK[mBuffs.ring_id] || 1,
        married_days: mBuffs.married_days,
        exp_bonus_pct: mBuffs.total_exp_bonus_pct,
      });
    }

    pairs.sort((a, b) => (b.married_days - a.married_days) || (b.ring_rank - a.ring_rank));
    entries = pairs.slice(0, limit).map((cp, idx) => ({
      rank: idx + 1,
      ...cp,
      line: `${rankBadge(idx)} **${cp.username}** 💞 **${cp.partner_name}** — ${ringEmoji(cp.ring_id)} *${cp.ring_name}* (**${cp.married_days} ngày** • +${cp.exp_bonus_pct}% EXP)`,
    }));
  }

  const summaryLeaderboard = entries.length > 0
    ? entries.map((e) => e.line).join('\n').slice(0, 1900)
    : '• Chưa có dữ liệu xếp hạng cho mục này.';

  return {
    success: true,
    type,
    limit,
    title,
    entries,
    summary_leaderboard: summaryLeaderboard,
    message: `${title}\n\n${summaryLeaderboard}`,
  };
}

/**
 * Tổng kết & tự động trao quà Top 10 Lực Chiến lúc 19:00 Chủ Nhật (UTC+7).
 * Idempotent theo week_key trong bảng public.weekly_leaderboard_runs.
 */
export async function settleWeeklyPowerLeaderboard(opts = {}) {
  if (!supabase) {
    return { success: false, status: 503, error: 'DB_UNAVAILABLE', message: 'Supabase chưa sẵn sàng.' };
  }

  const now = opts.now instanceof Date ? opts.now : new Date();
  const force = Boolean(opts.force);
  const weekKey = opts.weekKey || getVnIsoWeekKey(now);

  if (!force && !isSundayWeeklySettlementWindow(now)) {
    return {
      success: true,
      settled: false,
      should_announce: false,
      reason: 'NOT_SETTLEMENT_WINDOW',
      week_key: weekKey,
      message: 'Chưa tới khung giờ tổng kết 19:00 Chủ Nhật (UTC+7).',
    };
  }

  // Atomic check/lock
  const { data: existingRun } = await supabase
    .from('weekly_leaderboard_runs')
    .select('week_key, distributed_at')
    .eq('week_key', weekKey)
    .maybeSingle();

  if (existingRun) {
    return {
      success: true,
      settled: false,
      already_settled: true,
      should_announce: false,
      week_key: weekKey,
      message: `Bảng xếp hạng tuần ${weekKey} đã được phát quà trước đó.`,
    };
  }

  const lb = await getServerLeaderboard('power', 10);
  if (!lb.success) return lb;

  const topEntries = (lb.entries || []).filter((e) => String(e.user_id) !== FUYUMI_USER_ID);
  const rewardLines = [];
  const distributedRecords = [];

  // Lock row first to prevent duplicate payout on concurrent cron calls
  const { error: lockErr } = await supabase
    .from('weekly_leaderboard_runs')
    .insert({
      week_key: weekKey,
      distributed_at: now.toISOString(),
      top_entries: [],
      announcement_text: '',
    });

  if (lockErr) {
    return {
      success: true,
      settled: false,
      already_settled: true,
      should_announce: false,
      week_key: weekKey,
      message: `Tuần ${weekKey} đang hoặc đã được tổng kết (${lockErr.message}).`,
    };
  }

  const ltIcon = em('su_linhthach', '💎');
  for (const entry of topEntries) {
    const tier = getRewardTierForRank(entry.rank);
    if (!tier) continue;

    if (!opts.dryRun) {
      const { data: uRow } = await supabase
        .from('users')
        .select('linh_thach')
        .eq('user_id', entry.user_id)
        .maybeSingle();
      if (uRow) {
        await supabase
          .from('users')
          .update({
            linh_thach: Number(uRow.linh_thach || 0) + tier.linh_thach,
            updated_at: now.toISOString(),
          })
          .eq('user_id', entry.user_id);
      }
      for (const it of tier.items) {
        await grantInventoryItem(entry.user_id, it.item_id, it.qty);
      }
    }

    const itemBadgeStr = tier.items
      .map((it) => `${em(it.item_id, '🎁')}×${it.qty}`)
      .join(' ');
    rewardLines.push(
      `${rankBadge(entry.rank - 1)} <@${entry.user_id}> (**${Number(entry.power_score).toLocaleString('vi-VN')} Lực**) → **+${tier.linh_thach.toLocaleString('vi-VN')}** ${ltIcon} + ${itemBadgeStr}`,
    );
    distributedRecords.push({
      rank: entry.rank,
      user_id: entry.user_id,
      username: entry.username,
      power_score: entry.power_score,
      linh_thach: tier.linh_thach,
      items: tier.items,
    });
  }

  const announcementTitle = `${em('su_winner_trophy', '🏆')} TỔNG KẾT TOP 10 LỰC CHIẾN TUẦN ${weekKey} (19:00 CHỦ NHẬT)`;
  const announcementDesc = [
    `Chúc mừng các Cao Thủ đã xưng bá Bảng Xếp Hạng Chiến Lực Tu Tiên Giới tuần **${weekKey}**! Toàn bộ Linh Thạch, Đá Khắc Ấn, Thẻ Reset Tháp & Lương Thảo Khám Phá đã tự động gửi thẳng vào túi đồ:`,
    '',
    ...(rewardLines.length > 0 ? rewardLines : ['• Tuần này chưa có tu sĩ ghi danh bảng lực chiến.']),
    '',
    `*${em('su_sparkle', '✨')} Hẹn gặp lại vào **19:00 Chủ Nhật tuần tới** — dùng \`/top loai:power\` để theo dõi thứ hạng mỗi ngày!*`,
  ].join('\n');

  await supabase
    .from('weekly_leaderboard_runs')
    .update({
      top_entries: distributedRecords,
      announcement_text: announcementDesc,
    })
    .eq('week_key', weekKey);

  return {
    success: true,
    settled: true,
    should_announce: topEntries.length > 0,
    channel_id: WEEKLY_ANNOUNCEMENT_CHANNEL_ID,
    week_key: weekKey,
    winners_count: distributedRecords.length,
    distributed: distributedRecords,
    announcement_embed: {
      title: announcementTitle,
      description: announcementDesc.slice(0, 3900),
      color: '#f59e0b',
      footer: 'SuMi Family • Vinh Danh Top Lực Chiến 19:00 Chủ Nhật',
    },
  };
}
