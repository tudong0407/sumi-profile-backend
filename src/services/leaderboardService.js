/**
 * src/services/leaderboardService.js
 * Bảng Xếp Hạng Server (/top):
 * - level: Top Cao Thủ Tu Vi (Level & EXP)
 * - power: Top Chiến Thần Linh Thú (Chiến Lực Pet xuất trận)
 * - wealth: Top Phú Hộ Linh Thạch
 * - marry: Top Tiên Lữ Vĩnh Kết (Streak Ngày Cưới & Nhẫn Cưới)
 */

import { supabase } from '../config/supabase.js';
import { MARRY_RING_RANK } from '../data/catalog.js';
import { em, ringEmoji, realmEmoji, petEmoji } from '../config/emojiHelper.js';
import { getRealmByLevel } from './profileService.js';
import { computeMarriageBuffs } from './marryService.js';

export const VALID_LEADERBOARD_TYPES = ['level', 'power', 'wealth', 'marry'];

function rankBadge(idx) {
  if (idx === 0) return '🥇';
  if (idx === 1) return '🥈';
  if (idx === 2) return '🥉';
  return `\`#${idx + 1}\``;
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
      .order('level', { ascending: false })
      .order('exp', { ascending: false })
      .limit(limit);
    if (error) throw new Error(`Leaderboard level query failed: ${error.message}`);

    entries = (data || []).map((u, idx) => ({
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
      .order('linh_thach', { ascending: false })
      .order('level', { ascending: false })
      .limit(limit);
    if (error) throw new Error(`Leaderboard wealth query failed: ${error.message}`);

    entries = (data || []).map((u, idx) => ({
      rank: idx + 1,
      user_id: u.user_id,
      username: u.username,
      level: Number(u.level) || 1,
      linh_thach: Number(u.linh_thach) || 0,
      line: `${rankBadge(idx)} **${u.username}** — **${Number(u.linh_thach || 0).toLocaleString('vi-VN')}** ${em('su_linhthach')} *(${`Lv.${Number(u.level) || 1}`})*`,
    }));
  } else if (type === 'power') {
    title = `${em('su_crossed_swords')} BẢNG XẾP HẠNG • CHIẾN THẦN LINH THÚ (TOP ${limit})`;
    const { data: pets, error } = await supabase
      .from('user_pets')
      .select('user_id, pet_name, pet_type, level, star, power_score')
      .eq('is_active', true)
      .order('power_score', { ascending: false })
      .limit(limit);
    if (error) throw new Error(`Leaderboard power query failed: ${error.message}`);

    const uids = (pets || []).map((p) => p.user_id).filter(Boolean);
    const { data: users } = uids.length
      ? await supabase.from('users').select('user_id, username, level').in('user_id', uids)
      : { data: [] };
    const userMap = new Map((users || []).map((u) => [u.user_id, u]));

    entries = (pets || []).map((p, idx) => {
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
    title = `${em('su_ring_thanthoai')} BẢNG XẾP HẠNG • TIÊN LỮ VĨNH KẾT (TOP ${limit})`;
    const { data: marriedUsers, error } = await supabase
      .from('users')
      .select('user_id, username, marry_user_id, marry_username, marry_ring_id, marry_date')
      .not('marry_user_id', 'is', null);
    if (error) throw new Error(`Leaderboard marry query failed: ${error.message}`);

    const seenPairs = new Set();
    const pairs = [];
    const now = new Date();
    for (const u of marriedUsers || []) {
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
