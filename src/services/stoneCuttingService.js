/**
 * src/services/stoneCuttingService.js
 * Hệ thống Đổ Thạch (Cắt Nguyên Thạch) — Ver 1.6:
 * - Tách biệt 100% khỏi /roll (không dùng chung hay tăng Pity 350).
 * - 4 Phân khúc × 5 loài = 20 loại đá với Sạp Đá Phiên Cá Nhân 3 viên/lần.
 * - Manh mối Bán-Chân-Thật (65% phản ánh chất lượng ẩn, 35% bẫy/nhiễu).
 * - Tối Thượng Cực Phẩm (0.01%–0.05% gốc, tăng theo Luck Potion + /gieoque)
 *   lưu Hộp Chọn DB-persisted và cho chọn 1 trong 7 nhóm Thần Thoại không độc nhất.
 */

import { supabase } from '../config/supabase.js';
import {
  PET_CATALOG,
  EQUIPMENT_CATALOG,
  PUBLIC_BASE_URL,
  rollDefaultEnchantGrade,
  ENCHANT_GRADE_ORDER,
  normalizeEnchantGrade,
} from '../data/catalog.js';

function compareEnchantGrades(a, b) {
  return ENCHANT_GRADE_ORDER.indexOf(normalizeEnchantGrade(a)) - ENCHANT_GRADE_ORDER.indexOf(normalizeEnchantGrade(b));
}
import {
  V13_DOMAINS,
  V13_DIVINE_SENSES,
  V13_DIVINE_REALMS,
} from '../data/v13ExpansionCatalog.js';
import {
  STONE_TIERS,
  STONE_TIER_BY_KEY,
  STONE_SPECIES,
  STONE_SPECIES_BY_ID,
  STONE_CLUES,
  SUPREME_PICK_CATEGORIES,
} from '../data/v16ExpansionCatalog.js';
import { em, tierEmoji, petEmoji, itemEmoji, domainEmoji } from '../config/emojiHelper.js';
import {
  sanitizeUserId,
  ensureUserInitialized,
  pickCleanDisplayValue,
} from './profileService.js';
import {
  getEffectiveLuckAndFortune,
  consumeLuckCharges,
} from './luckAndFortuneService.js';
import { addInventoryItem, trackQuestActivity } from './questService.js';

const stoneLocks = new Map();
const memStalls = new Map();
const memRewards = new Map();

async function withStoneLock(userId, fn) {
  const prev = stoneLocks.get(userId) || Promise.resolve();
  let release;
  const current = new Promise((res) => { release = res; });
  const queued = prev.then(() => current);
  stoneLocks.set(userId, queued);
  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (stoneLocks.get(userId) === queued) stoneLocks.delete(userId);
  }
}

function randomInt(min, max, rng = Math.random) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

function pickUniqueClues(bucketName, count, rng = Math.random, usedSet = null) {
  const rawPool = STONE_CLUES[bucketName] || STONE_CLUES.neutral;
  const filtered = usedSet ? rawPool.filter((c) => !usedSet.has(c)) : rawPool;
  const pool = filtered.length >= count ? [...filtered] : [...rawPool];
  const out = [];
  while (out.length < count && pool.length > 0) {
    const idx = Math.floor(rng() * pool.length);
    const chosen = pool.splice(idx, 1)[0];
    out.push(chosen);
    if (usedSet) usedSet.add(chosen);
  }
  return out;
}

/**
 * Sinh 3 viên đá cá nhân hóa cho 1 phân khúc, kèm manh mối Bán-Chân-Thật (không trùng câu giữa 3 viên cùng sạp)
 */
export function generateStallStones(tierKey, rng = Math.random) {
  const speciesPool = STONE_SPECIES.filter((s) => s.tier_key === tierKey);
  const shuffled = [...speciesPool].sort(() => rng() - 0.5).slice(0, 3);
  const usedClues = new Set();

  return shuffled.map((sp, idx) => {
    const bandRoll = rng();
    const hiddenBand = bandRoll < 0.44 ? 'dim' : bandRoll < 0.78 ? 'neutral' : 'radiant';

    // 65% manh mối khớp sắc thái thật, 35% nhiễu/bẫy ngược
    const truthful = rng() < 0.65;
    let clueBucket = hiddenBand;
    if (!truthful) {
      const alt = ['dim', 'neutral', 'radiant'].filter((b) => b !== hiddenBand);
      clueBucket = alt[Math.floor(rng() * alt.length)];
    }
    const clues = pickUniqueClues(clueBucket, 2, rng, usedClues);

    return {
      slot: idx + 1,
      stone_id: sp.stone_id,
      name: sp.name,
      lore: sp.lore,
      hidden_band: hiddenBand,
      clues,
    };
  });
}

async function loadOrCreateStall(userId, tierKey, rng = Math.random, forceNew = false) {
  const memKey = `${userId}:${tierKey}`;
  if (!forceNew) {
    if (supabase) {
      const { data } = await supabase
        .from('user_stone_stalls')
        .select('stones_json')
        .eq('user_id', userId)
        .eq('tier_key', tierKey)
        .maybeSingle();
      if (Array.isArray(data?.stones_json) && data.stones_json.length === 3) {
        return data.stones_json;
      }
    } else if (memStalls.has(memKey)) {
      return memStalls.get(memKey);
    }
  }

  const fresh = generateStallStones(tierKey, rng);
  if (supabase) {
    await supabase
      .from('user_stone_stalls')
      .upsert({
        user_id: userId,
        tier_key: tierKey,
        stones_json: fresh,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,tier_key' });
  } else {
    memStalls.set(memKey, fresh);
  }
  return fresh;
}

async function getStoneRewardsRow(userId) {
  if (supabase) {
    const { data } = await supabase
      .from('user_stone_rewards')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    return {
      pending_supreme_picks: Number(data?.pending_supreme_picks || 0),
      total_cuts: Number(data?.total_cuts || 0),
      total_supreme_hits: Number(data?.total_supreme_hits || 0),
    };
  }
  return memRewards.get(userId) || { pending_supreme_picks: 0, total_cuts: 0, total_supreme_hits: 0 };
}

async function saveStoneRewardsRow(userId, patch) {
  const cur = await getStoneRewardsRow(userId);
  const next = { ...cur, ...patch };
  if (supabase) {
    await supabase
      .from('user_stone_rewards')
      .upsert({ user_id: userId, ...next, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  } else {
    memRewards.set(userId, next);
  }
  return next;
}

function formatLuckLine(luck) {
  const parts = [];
  if (luck.potionName && luck.potionCharges > 0) {
    parts.push(`**${luck.potionName}** (+${luck.potionLuckPct}%, còn **${luck.potionCharges}** lượt)`);
  }
  if (luck.fortuneName) {
    parts.push(`Quẻ **${luck.fortuneName}** (${luck.fortuneLuckPct >= 0 ? '+' : ''}${luck.fortuneLuckPct}% Luck)`);
  }
  return parts.length > 0
    ? `${em('su_sparkle')} **Luck Hiện Tại:** \`${luck.totalLuckPct >= 0 ? '+' : ''}${luck.totalLuckPct}%\` (${parts.join(' • ')})`
    : `${em('su_sparkle')} **Luck Hiện Tại:** \`+0%\` *(Uống Linh Lộ hoặc \`/gieoque\` để tăng tỉ lệ!)*`;
}

export async function getStoneStall(userId, rawTier = 'common', options = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID người dùng không hợp lệ.' };

  const tierKey = STONE_TIER_BY_KEY[String(rawTier || 'common').trim().toLowerCase()] ? String(rawTier).trim().toLowerCase() : 'common';
  const tier = STONE_TIER_BY_KEY[tierKey];
  const rng = typeof options.rng === 'function' ? options.rng : Math.random;

  return withStoneLock(cleanId, async () => {
    let balance = 0;
    if (supabase) {
      const { user } = await ensureUserInitialized(cleanId, {
        username: pickCleanDisplayValue(options.username, options.fallbackUsername),
        avatarUrl: pickCleanDisplayValue(options.avatarUrl),
      });
      balance = Number(user?.linh_thach || 0);
    }

    const [stones, luck, rw] = await Promise.all([
      loadOrCreateStall(cleanId, tierKey, rng, false),
      getEffectiveLuckAndFortune(cleanId),
      getStoneRewardsRow(cleanId),
    ]);

    const effSupremePct = (tier.supreme_rate * 100 * luck.luckMultiplier).toFixed(4).replace(/\.?0+$/, '');
    const lt = em('su_linhthach');

    const lines = [
      `${lt} **Số dư:** **${balance.toLocaleString('vi-VN')} LT** • **Giá cắt/viên:** **${tier.price.toLocaleString('vi-VN')} LT** • **Đổi lô mới:** \`${tier.reroll_cost} LT\``,
      formatLuckLine(luck),
      `${em('dao_ap_crest')} **Tối Thượng Cực Phẩm:** \`${effSupremePct}%\` *(tự chọn 1 Thần Thoại không độc nhất ở 7 nhóm)*`,
      rw.pending_supreme_picks > 0
        ? `${em('su_winner_trophy')} **BẠN ĐANG CÓ \`${rw.pending_supreme_picks}\` HỘP TỐI THƯỢNG CHỜ MỞ!** Hãy chọn nhóm quà ở menu bên dưới!`
        : '',
      '',
      `**3 Viên Đá Đang Bày Tại Sạp (${tier.short_name}):**`,
      ...stones.map((st) => [
        `• **Đá #${st.slot} — ${st.name}**`,
        `  *Manh mối 1:* ${st.clues[0]}`,
        `  *Manh mối 2:* ${st.clues[1]}`,
      ].join('\n')),
      '',
      `*Bấm **Xem Đá #1/#2/#3** để soi ảnh cận cảnh & cắt Thiết Thạch! (Tách biệt hoàn toàn khỏi Pity /roll)*`,
    ].filter(Boolean);

    return {
      success: true,
      tier_key: tierKey,
      tier_name: tier.name,
      price: tier.price,
      reroll_cost: tier.reroll_cost,
      balance,
      pending_supreme_picks: rw.pending_supreme_picks,
      stones: stones.map(({ slot, stone_id, name, lore, clues }) => ({ slot, stone_id, name, lore, clues })),
      title: `${em('su_realm_star')} PHƯỜNG ĐỔ THẠCH — ${tier.name.toUpperCase()}`,
      description: lines.join('\n'),
      color: tier.color,
      image_url: `${PUBLIC_BASE_URL}/assets/stones/${stones[0].stone_id}.webp?v=1.6`,
      footer: '',
    };
  });
}

export async function previewStallStone(userId, rawTier = 'common', slotIndex = 1, options = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID người dùng không hợp lệ.' };

  const tierKey = STONE_TIER_BY_KEY[String(rawTier || 'common').trim().toLowerCase()] ? String(rawTier).trim().toLowerCase() : 'common';
  const tier = STONE_TIER_BY_KEY[tierKey];
  const slot = Math.min(3, Math.max(1, Math.floor(Number(slotIndex) || 1)));

  return withStoneLock(cleanId, async () => {
    const [stones, luck, rw] = await Promise.all([
      loadOrCreateStall(cleanId, tierKey),
      getEffectiveLuckAndFortune(cleanId),
      getStoneRewardsRow(cleanId),
    ]);
    const st = stones.find((s) => s.slot === slot) || stones[0];
    const effSupremePct = (tier.supreme_rate * 100 * luck.luckMultiplier).toFixed(4).replace(/\.?0+$/, '');

    const lines = [
      `${tierEmoji(tierKey)} **Phân khúc:** ${tier.name} • **Giá Thiết Thạch:** **${tier.price.toLocaleString('vi-VN')}** ${em('su_linhthach')}`,
      formatLuckLine(luck),
      `${em('dao_ap_crest')} **Tỉ lệ Tối Thượng Cực Phẩm:** \`${effSupremePct}%\``,
      '',
      `**Đặc Điểm Bề Mặt:** *${st.lore}*`,
      `**Manh Mối Giám Định:**`,
      `• ${st.clues[0]}`,
      `• ${st.clues[1]}`,
      '',
      `*Bấm **Thiết Thạch #${st.slot}** để cắt ngay viên đá này!*`,
    ];

    return {
      success: true,
      tier_key: tierKey,
      slot: st.slot,
      stone_id: st.stone_id,
      stone_name: st.name,
      pending_supreme_picks: rw.pending_supreme_picks,
      title: `${em('su_realm_star')} ĐÁ #${st.slot}: ${st.name.toUpperCase()}`,
      description: lines.join('\n'),
      color: tier.color,
      image_url: `${PUBLIC_BASE_URL}/assets/stones/${st.stone_id}.webp?v=1.6`,
      footer: '',
    };
  });
}

export async function rerollStoneStall(userId, rawTier = 'common', options = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID người dùng không hợp lệ.' };

  const tierKey = STONE_TIER_BY_KEY[String(rawTier || 'common').trim().toLowerCase()] ? String(rawTier).trim().toLowerCase() : 'common';
  const tier = STONE_TIER_BY_KEY[tierKey];
  const rng = typeof options.rng === 'function' ? options.rng : Math.random;

  return withStoneLock(cleanId, async () => {
    if (supabase) {
      const { user } = await ensureUserInitialized(cleanId, {
        username: pickCleanDisplayValue(options.username, options.fallbackUsername),
        avatarUrl: pickCleanDisplayValue(options.avatarUrl),
      });
      const bal = Number(user?.linh_thach || 0);
      if (bal < tier.reroll_cost) {
        const msg = `Cần **${tier.reroll_cost} LT** để đổi lô đá mới (Số dư: **${bal.toLocaleString('vi-VN')} LT**).`;
        return {
          success: false,
          status: 200,
          error: 'INSUFFICIENT_FUNDS',
          title: `${em('su_linhthach')} KHÔNG ĐỦ LINH THẠCH`,
          description: msg,
          image_url: '',
          message: msg,
        };
      }
      await supabase
        .from('users')
        .update({ linh_thach: bal - tier.reroll_cost, updated_at: new Date().toISOString() })
        .eq('user_id', cleanId);
    }
    await loadOrCreateStall(cleanId, tierKey, rng, true);
    return null;
  }).then(async (errRes) => {
    if (errRes) return errRes;
    const stall = await getStoneStall(cleanId, tierKey, options);
    stall.description = `${em('su_sparkle')} *Đã chi **${tier.reroll_cost} LT** đổi lô 3 viên đá mới!*\n\n${stall.description}`;
    return stall;
  });
}

/**
 * Quyết định kết quả cắt 1 viên đá dựa trên phân khúc, Luck Multiplier & hidden_band (65/35 semi-signal)
 */
export function resolveStoneCutOutcome(tier, hiddenBand, luckMultiplier, rng = Math.random, forceOutcome = null) {
  if (forceOutcome) return forceOutcome;

  // Hệ số nhẹ từ hidden_band (tổng kỳ vọng giữ cân bằng vì 44% dim, 34% neutral, 22% radiant)
  const bandBias = hiddenBand === 'radiant' ? 1.12 : hiddenBand === 'dim' ? 0.90 : 1.00;
  const effMult = Math.max(0.5, luckMultiplier * bandBias);

  const supremeProb = Math.min(0.01, tier.supreme_rate * effMult);
  const epicProb = Math.min(0.08, tier.epic_rate * effMult);
  const highProb = Math.min(0.16, tier.high_rate * (1 + (effMult - 1) * 0.45));
  const midProb = tier.mid_rate;
  const lowProb = tier.low_rate;

  const r = rng();
  if (r < supremeProb) return 'supreme';
  if (r < supremeProb + epicProb) return 'epic';
  if (r < supremeProb + epicProb + highProb) return 'high';
  if (r < supremeProb + epicProb + highProb + midProb) return 'mid';
  if (r < supremeProb + epicProb + highProb + midProb + lowProb) return 'low';
  return 'empty';
}

export async function cutStallStone(userId, rawTier = 'common', slotIndex = 1, options = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID người dùng không hợp lệ.' };

  const tierKey = STONE_TIER_BY_KEY[String(rawTier || 'common').trim().toLowerCase()] ? String(rawTier).trim().toLowerCase() : 'common';
  const tier = STONE_TIER_BY_KEY[tierKey];
  const slot = Math.min(3, Math.max(1, Math.floor(Number(slotIndex) || 1)));
  const rng = typeof options.rng === 'function' ? options.rng : Math.random;

  return withStoneLock(cleanId, async () => {
    let balance = 10000;
    if (supabase) {
      const { user } = await ensureUserInitialized(cleanId, {
        username: pickCleanDisplayValue(options.username, options.fallbackUsername),
        avatarUrl: pickCleanDisplayValue(options.avatarUrl),
      });
      if (!user) return { success: false, status: 500, error: 'USER_INIT_FAILED', message: 'Không thể khởi tạo hồ sơ.' };
      balance = Number(user.linh_thach || 0);
      if (balance < tier.price) {
        const msg = `Không đủ Linh Thạch! Cần **${tier.price.toLocaleString('vi-VN')} LT** để cắt **${tier.short_name}** (Số dư: **${balance.toLocaleString('vi-VN')} LT**).`;
        return {
          success: false,
          status: 200,
          error: 'INSUFFICIENT_FUNDS',
          title: `${em('su_linhthach')} KHÔNG ĐỦ LINH THẠCH`,
          description: msg,
          image_url: '',
          message: msg,
        };
      }
      await supabase
        .from('users')
        .update({ linh_thach: balance - tier.price, updated_at: new Date().toISOString() })
        .eq('user_id', cleanId);
      balance -= tier.price;
    }

    const stones = await loadOrCreateStall(cleanId, tierKey, rng, false);
    const pickedStone = stones.find((s) => s.slot === slot) || stones[0];

    const luckInfo = await getEffectiveLuckAndFortune(cleanId);
    const chargeRes = await consumeLuckCharges(cleanId, 1);

    const outcome = resolveStoneCutOutcome(
      tier,
      pickedStone.hidden_band,
      luckInfo.luckMultiplier,
      rng,
      options.forceOutcome || null,
    );

    let gainedLt = 0;
    let gainedEnchant = 0;
    let gainedStar = 0;
    let gainedAbs = 0;
    let triggeredSupreme = false;

    if (outcome === 'low') {
      gainedLt = randomInt(tier.payouts.low.ltMin, tier.payouts.low.ltMax, rng);
    } else if (outcome === 'mid') {
      gainedLt = randomInt(tier.payouts.mid.ltMin, tier.payouts.mid.ltMax, rng);
    } else if (outcome === 'high') {
      gainedLt = randomInt(tier.payouts.high.ltMin, tier.payouts.high.ltMax, rng);
    } else if (outcome === 'epic') {
      const ep = tier.payouts.epic;
      gainedLt = randomInt(ep.ltMin, ep.ltMax, rng);
      gainedEnchant = ep.enchantStones || 0;
      gainedStar = ep.starStones || 0;
      if (ep.doubleAbsChance && rng() < ep.doubleAbsChance) gainedAbs = 2;
      else if (ep.absStoneChance && rng() < ep.absStoneChance) gainedAbs = 1;
    } else if (outcome === 'supreme') {
      triggeredSupreme = true;
    }

    if (supabase) {
      if (gainedLt > 0) {
        await supabase
          .from('users')
          .update({ linh_thach: balance + gainedLt, updated_at: new Date().toISOString() })
          .eq('user_id', cleanId);
        balance += gainedLt;
      }
      if (gainedEnchant > 0) await addInventoryItem(cleanId, 'enchant_stone', 'consumable', gainedEnchant);
      if (gainedStar > 0) await addInventoryItem(cleanId, 'pet_star_stone', 'consumable', gainedStar);
      if (gainedAbs > 0) await addInventoryItem(cleanId, 'enchant_stone_absolute', 'consumable', gainedAbs);
      await trackQuestActivity(cleanId, 'minigame', 1);
    }

    const curRw = await getStoneRewardsRow(cleanId);
    const updatedRw = await saveStoneRewardsRow(cleanId, {
      total_cuts: curRw.total_cuts + 1,
      total_supreme_hits: curRw.total_supreme_hits + (triggeredSupreme ? 1 : 0),
      pending_supreme_picks: curRw.pending_supreme_picks + (triggeredSupreme ? 1 : 0),
    });

    // Tự làm mới sạp 3 viên mới miễn phí sau khi cắt
    await loadOrCreateStall(cleanId, tierKey, rng, true);

    const lt = em('su_linhthach');
    let outcomeTitle = '';
    let outcomeLine = '';
    let color = tier.color;

    if (outcome === 'empty') {
      outcomeTitle = 'THIẾT THẠCH — ĐÁ RỖNG (MẤT VỐN)';
      outcomeLine = `Lưỡi cưa xẻ đôi **${pickedStone.name}** — bên trong chỉ là tạp thạch xám đục, không thấy tia ngọc nào! *(-${tier.price.toLocaleString('vi-VN')} LT)*`;
      color = '#64748b';
    } else if (outcome === 'low' || outcome === 'mid' || outcome === 'high') {
      const tierLabel = outcome === 'high' ? 'CỰC HƯNG THỦY NGỌC (ĐẠI LÃI!)' : outcome === 'mid' ? 'TRUNG PHẨM LINH NGỌC' : 'HẠ PHẨM TẠP NGỌC';
      outcomeTitle = `THIẾT THẠCH — ${tierLabel}`;
      outcomeLine = `Ánh ngọc bừng sáng từ lõi **${pickedStone.name}**! Thu về **+${gainedLt.toLocaleString('vi-VN')}** ${lt} **Linh Thạch**!`;
      color = outcome === 'high' ? '#10b981' : '#38bdf8';
    } else if (outcome === 'epic') {
      outcomeTitle = 'THIẾT THẠCH — CỰC / THẦN PHẨM BẢO KHOÁNG!';
      const rewardParts = [`**+${gainedLt.toLocaleString('vi-VN')}** ${lt}`];
      if (gainedEnchant > 0) rewardParts.push(`**+${gainedEnchant}** ${em('enchant_stone')} Đá Khắc Ấn`);
      if (gainedStar > 0) rewardParts.push(`**+${gainedStar}** ${em('pet_star_stone')} Tinh Thạch`);
      if (gainedAbs > 0) rewardParts.push(`**+${gainedAbs}** ${em('enchant_stone_absolute')} **Thiên Đạo Tuyệt Ấn Thạch**`);
      outcomeLine = `Mạch khoáng thuần khiết vỡ òa trong **${pickedStone.name}**! Nhận ngay: ${rewardParts.join(' • ')}!`;
      color = '#a855f7';
    } else {
      outcomeTitle = `${em('su_winner_trophy')} TỐI THƯỢNG CỰC PHẨM XUẤT THẾ!!`;
      outcomeLine = `Thiên địa dị tượng! Lõi **${pickedStone.name}** bộc phát kim quang **TỐI THƯỢNG CỰC PHẨM**! Bạn nhận được **1 Hộp Chọn Thần Thoại** *(chọn ngay bên dưới trong 7 nhóm: Linh Thú / 3 Pháp Bảo / Linh Vực / Thần Thức / Thần Cảnh — không độc nhất)*!`;
      color = '#f59e0b';
    }

    const luckNote = chargeRes.chargesUsed > 0
      ? `\n• ${em('su_sparkle')} Đã dùng 1 lượt **${chargeRes.potionName}** *(còn **${chargeRes.remainingCharges}** lượt • Tổng Luck: **+${luckInfo.totalLuckPct}%**)*`
      : luckInfo.fortuneName
        ? `\n• ${em('su_sparkle')} Quẻ **${luckInfo.fortuneName}** (*${luckInfo.fortuneLuckPct >= 0 ? '+' : ''}${luckInfo.fortuneLuckPct}% Luck*)`
        : '';

    return {
      success: true,
      outcome,
      triggered_supreme: triggeredSupreme,
      pending_supreme_picks: updatedRw.pending_supreme_picks,
      tier_key: tierKey,
      stone_id: pickedStone.stone_id,
      stone_name: pickedStone.name,
      gained_lt: gainedLt,
      gained_enchant: gainedEnchant,
      gained_star: gainedStar,
      gained_abs: gainedAbs,
      balance,
      title: outcomeTitle,
      description: [
        outcomeLine,
        `• ${lt} **Số dư hiện tại:** **${balance.toLocaleString('vi-VN')} LT** • Sạp đá đã tự bày **3 viên mới**!`,
        luckNote,
      ].filter(Boolean).join('\n'),
      color,
      image_url: `${PUBLIC_BASE_URL}/assets/stones/${pickedStone.stone_id}.webp?v=1.6`,
      footer: '',
    };
  });
}

/**
 * Mở Hộp Chọn Tối Thượng Cực Phẩm (random 1 Thần Thoại KHÔNG độc nhất theo đúng nhóm đã chọn)
 */
export async function claimSupremeStonePick(userId, pickCategory = 'pet', options = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID người dùng không hợp lệ.' };

  const catKey = String(pickCategory || '').trim().toLowerCase();
  if (!SUPREME_PICK_CATEGORIES.some((c) => c.key === catKey)) {
    return { success: false, status: 400, error: 'INVALID_CATEGORY', message: `Nhóm '${pickCategory}' không hợp lệ.` };
  }
  const rng = typeof options.rng === 'function' ? options.rng : Math.random;

  return withStoneLock(cleanId, async () => {
    const rw = await getStoneRewardsRow(cleanId);
    if (rw.pending_supreme_picks <= 0) {
      const msg = 'Bạn chưa có Hộp Chọn Tối Thượng Cực Phẩm nào đang chờ mở! Hãy cắt Nguyên Thạch để săn **Tối Thượng Cực Phẩm** trước.';
      return {
        success: false,
        status: 200,
        error: 'NO_PENDING_PICK',
        title: `${em('dao_ap_crest')} CHƯA CÓ HỘP TỐI THƯỢNG`,
        description: msg,
        image_url: '',
        message: msg,
      };
    }

    let pool = [];
    if (catKey === 'pet') {
      pool = PET_CATALOG.filter((p) => p.rarity_key === 'mythic' && !p.is_unique && !p.is_exclusive_fuyumi);
    } else if (['weapon', 'gem', 'soul'].includes(catKey)) {
      pool = EQUIPMENT_CATALOG.filter((e) => e.item_type === catKey && e.rarity_key === 'mythic' && !e.is_unique);
    } else if (catKey === 'domain') {
      pool = V13_DOMAINS.filter((d) => d.rarity_key === 'mythic' && !d.is_unique && !d.is_exclusive_fuyumi);
    } else if (catKey === 'sense') {
      pool = V13_DIVINE_SENSES.filter((s) => s.rarity_key === 'mythic' && !s.is_unique && !s.is_exclusive_fuyumi);
    } else if (catKey === 'realm') {
      pool = V13_DIVINE_REALMS.filter((r) => r.rarity_key === 'mythic' && !r.is_unique && !r.is_exclusive_fuyumi);
    }

    if (pool.length === 0) {
      return { success: false, status: 500, error: 'EMPTY_POOL', message: 'Không tìm thấy vật phẩm Thần Thoại phù hợp.' };
    }

    const picked = pool[Math.floor(rng() * pool.length)];
    await saveStoneRewardsRow(cleanId, {
      pending_supreme_picks: Math.max(0, rw.pending_supreme_picks - 1),
    });

    let label = '';
    let imageUrl = '';

    if (catKey === 'pet') {
      label = `${petEmoji(picked.pet_type)} **${picked.pet_name}**`;
      imageUrl = `${PUBLIC_BASE_URL}/api/wiki/pet/${picked.pet_type}.webp`;
      if (supabase) {
        const grade = rollDefaultEnchantGrade(rng);
        const { data: ex } = await supabase.from('user_pets').select('pet_id, quantity, enchant_grade').eq('user_id', cleanId).eq('pet_type', picked.pet_type).maybeSingle();
        if (ex) {
          const bestGrade = compareEnchantGrades(grade, ex.enchant_grade) > 0 ? grade : ex.enchant_grade;
          await supabase.from('user_pets').update({ quantity: Number(ex.quantity || 1) + 1, enchant_grade: bestGrade }).eq('pet_id', ex.pet_id);
        } else {
          await supabase.from('user_pets').insert({
            user_id: cleanId,
            pet_type: picked.pet_type,
            pet_name: picked.pet_name,
            element: picked.element,
            rarity: picked.rarity,
            level: 1,
            star: 1,
            atk: picked.base_atk,
            def: picked.base_def,
            spd: picked.base_spd,
            power_score: picked.base_power,
            hax_skill: picked.hax_skill,
            hax_description: picked.hax_description,
            enchant_grade: grade,
            quantity: 1,
          });
        }
      }
    } else if (['weapon', 'gem', 'soul'].includes(catKey)) {
      label = `${itemEmoji(picked.item_id)} **${picked.item_name}**`;
      imageUrl = `${PUBLIC_BASE_URL}/api/wiki/item/${picked.item_id}.webp`;
      if (supabase) {
        const grade = rollDefaultEnchantGrade(rng);
        const { data: ex } = await supabase.from('user_pet_items').select('id, quantity, enchant_grade').eq('user_id', cleanId).eq('item_id', picked.item_id).maybeSingle();
        if (ex) {
          const bestGrade = compareEnchantGrades(grade, ex.enchant_grade) > 0 ? grade : ex.enchant_grade;
          await supabase.from('user_pet_items').update({ quantity: Number(ex.quantity || 1) + 1, enchant_grade: bestGrade }).eq('id', ex.id);
        } else {
          await supabase.from('user_pet_items').insert({
            user_id: cleanId,
            item_id: picked.item_id,
            item_name: picked.item_name,
            item_type: picked.item_type,
            rarity: picked.rarity,
            element: picked.element,
            bonus_atk: picked.bonus_atk || 0,
            bonus_def: picked.bonus_def || 0,
            bonus_spd: picked.bonus_spd || 0,
            bonus_hp: picked.bonus_hp || 0,
            bonus_crit: picked.bonus_crit || 0,
            hax_skill: picked.hax_skill || null,
            hax_description: picked.hax_description || null,
            enchant_grade: grade,
            quantity: 1,
          });
        }
      }
    } else {
      const entityId = picked.domain_id || picked.sense_id || picked.realm_id;
      label = `${domainEmoji(entityId, em('su_realm_star'))} **${picked.name}**`;
      imageUrl = `${PUBLIC_BASE_URL}/assets/domains/${entityId}.webp?v=1.5`;
      if (supabase) {
        const { data: ex } = await supabase.from('user_domains').select('id, quantity').eq('user_id', cleanId).eq('entity_kind', catKey).eq('entity_id', entityId).maybeSingle();
        if (ex) {
          await supabase.from('user_domains').update({ quantity: Number(ex.quantity || 1) + 1 }).eq('id', ex.id);
        } else {
          await supabase.from('user_domains').insert({
            user_id: cleanId,
            entity_kind: catKey,
            entity_id: entityId,
            quantity: 1,
            is_equipped: false,
            is_unique: false,
          });
        }
      }
    }

    return {
      success: true,
      category: catKey,
      picked_id: picked.pet_type || picked.item_id || picked.domain_id || picked.sense_id || picked.realm_id,
      picked_name: picked.pet_name || picked.item_name || picked.name,
      is_unique: Boolean(picked.is_unique),
      is_exclusive_fuyumi: Boolean(picked.is_exclusive_fuyumi),
      pending_supreme_picks: Math.max(0, rw.pending_supreme_picks - 1),
      title: `${em('su_winner_trophy')} MỞ HỘP TỐI THƯỢNG CỰC PHẨM THÀNH CÔNG!`,
      description: `${tierEmoji('mythic')} Chúc mừng đạo hữu đã nhận được ${label} *(Thần Thoại)* vào kho đồ!`,
      image_url: imageUrl,
      color: '#f59e0b',
      footer: '',
    };
  });
}
