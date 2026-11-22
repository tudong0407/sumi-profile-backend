/**
 * src/services/minigameService.js
 * Xử lý 4 Minigame Giải Trí Tiên Giới: /coinflip, /blackjack, /slots (4 ô), /crash.
 * Hạn mức cược 10 - 10.000 Linh Thạch/ván • Cooldown 5 giây • Chống race condition theo User ID.
 */

import crypto from 'crypto';
import { supabase } from '../config/supabase.js';
import { em, minigameEmoji } from '../config/emojiHelper.js';
import { ensureUserInitialized } from './profileService.js';
import { trackQuestActivity } from './questService.js';

export const MINIGAME_MIN_BET = 10;
export const MINIGAME_MAX_BET = 10000;
export const MINIGAME_COOLDOWN_MS = 5000;

const CRASH_LADDER = [1.00, 1.35, 1.75, 2.00, 2.60, 3.50, 5.00];
// Survival probability from start through each step index 1..6 (Step 3 = 2.00x)
const CRASH_STEP_REACH_PROB = [1.0, 0.63, 0.53, 0.45, 0.34, 0.25, 0.18];

const SLOT_SYMBOLS = [
  { id: 'slot_fox', label: 'Cửu Vĩ Kim Hồ', jackpot4: 5.0 },
  { id: 'slot_jade', label: 'Cực Phẩm Linh Thạch', jackpot4: 4.0 },
  { id: 'slot_sword', label: 'Tiên Kiếm', jackpot4: 3.0 },
  { id: 'slot_pill', label: 'Kim Đan', jackpot4: 3.0 },
  { id: 'slot_lotus', label: 'Huyết Liên', jackpot4: 2.5 },
  { id: 'slot_scroll', label: 'Cổ Phù', jackpot4: 2.5 },
];

const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = [
  { rank: 'A', val: 11 },
  { rank: '2', val: 2 },
  { rank: '3', val: 3 },
  { rank: '4', val: 4 },
  { rank: '5', val: 5 },
  { rank: '6', val: 6 },
  { rank: '7', val: 7 },
  { rank: '8', val: 8 },
  { rank: '9', val: 9 },
  { rank: '10', val: 10 },
  { rank: 'J', val: 10 },
  { rank: 'Q', val: 10 },
  { rank: 'K', val: 10 },
];

const userLocks = new Map();
const lastPlayMap = new Map();
const activeBlackjackSessions = new Map();
const activeCrashSessions = new Map();

function sanitizeUserId(id) {
  if (!id) return null;
  const s = String(id).trim();
  return /^[0-9]{15,22}$/.test(s) ? s : null;
}

async function withMinigameLock(userId, fn) {
  const prev = userLocks.get(userId) || Promise.resolve();
  let release;
  const cur = new Promise((r) => { release = r; });
  userLocks.set(userId, prev.then(() => cur));
  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (userLocks.get(userId) === cur) userLocks.delete(userId);
  }
}

function validateBetAndCooldown(userId, rawBet, userBalance, options = {}) {
  const bet = Math.floor(Number(rawBet) || 0);
  if (!Number.isFinite(bet) || bet < MINIGAME_MIN_BET || bet > MINIGAME_MAX_BET) {
    return {
      ok: false,
      status: 400,
      error: 'INVALID_BET_AMOUNT',
      message: `Số tiền cược phải nằm trong khoảng **${MINIGAME_MIN_BET.toLocaleString('vi-VN')} – ${MINIGAME_MAX_BET.toLocaleString('vi-VN')}** ${em('su_linhthach')} Linh Thạch!`,
    };
  }
  if (!options.bypassCooldown) {
    const prevMs = lastPlayMap.get(userId) || 0;
    const elapsed = Date.now() - prevMs;
    if (elapsed < MINIGAME_COOLDOWN_MS) {
      const waitSec = Math.ceil((MINIGAME_COOLDOWN_MS - elapsed) / 1000);
      return {
        ok: false,
        status: 429,
        error: 'MINIGAME_COOLDOWN',
        cooldown_seconds: waitSec,
        message: `${em('su_thunder_hax')} Thao tác quá nhanh! Vui lòng chờ **${waitSec} giây** trước khi bắt đầu ván mới.`,
      };
    }
  }
  const bal = Number(userBalance || 0);
  if (bal < bet) {
    return {
      ok: false,
      status: 400,
      error: 'INSUFFICIENT_LINH_THACH',
      message: `Ví Linh Thạch không đủ! Cần **${bet.toLocaleString('vi-VN')}** ${em('su_linhthach')}, hiện có **${bal.toLocaleString('vi-VN')}**.`,
    };
  }
  return { ok: true, bet, bal };
}

function slotIcon(id) {
  return minigameEmoji(id, '💠');
}

function pickDistinctSymbols(count, rng, excludeIds = new Set()) {
  const pool = SLOT_SYMBOLS.filter((s) => !excludeIds.has(s.id));
  const out = [];
  while (out.length < count && pool.length > 0) {
    const idx = Math.floor(rng() * pool.length) % pool.length;
    out.push(pool.splice(idx, 1)[0]);
  }
  return out;
}

function shuffleArr(arr, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// =========================================================================
// 1. /coinflip (Tiên Ấn vs Liên Ấn • Tỷ lệ thưởng 1:2)
// =========================================================================
export async function playCoinflip(userId, rawBet, rawChoice = 'heads', options = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID người dùng không hợp lệ.' };
  if (!supabase) return { success: false, status: 503, error: 'DB_UNAVAILABLE', message: 'Cơ sở dữ liệu chưa sẵn sàng.' };

  const rng = typeof options.rng === 'function' ? options.rng : Math.random;

  return withMinigameLock(cleanId, async () => {
    const { user } = await ensureUserInitialized(cleanId, {
      username: options.username,
      fallbackUsername: options.fallbackUsername,
      avatarUrl: options.avatarUrl,
    });
    if (!user) return { success: false, status: 500, error: 'USER_INIT_FAILED', message: 'Không thể khởi tạo hồ sơ.' };

    const check = validateBetAndCooldown(cleanId, rawBet, user.linh_thach, options);
    if (!check.ok) return { success: false, status: check.status, error: check.error, message: check.message };

    const choiceNorm = String(rawChoice || 'heads').trim().toLowerCase();
    const playerChoice = (choiceNorm === 'tails' || choiceNorm === 'up' || choiceNorm === 'úp' || choiceNorm === 'lien') ? 'tails' : 'heads';
    const oppositeSide = playerChoice === 'heads' ? 'tails' : 'heads';

    const win = rng() < 0.45;
    const outcome = win ? playerChoice : oppositeSide;
    const payout = win ? check.bet * 2 : 0;
    const netDelta = payout - check.bet;
    const nextBal = Math.max(0, check.bal + netDelta);

    lastPlayMap.set(cleanId, Date.now());
    await Promise.all([
      supabase.from('users').update({ linh_thach: nextBal, updated_at: new Date().toISOString() }).eq('user_id', cleanId),
      trackQuestActivity(cleanId, { activityDelta: 1 }),
    ]);

    const sideLabel = (s) => (s === 'heads' ? `${minigameEmoji('coin_heads', '🪙')} Ngửa (Tiên Ấn)` : `${minigameEmoji('coin_tails', '🌙')} Úp (Liên Ấn)`);
    const coinSpin = minigameEmoji('coin_spin', '🪙');
    const lt = em('su_linhthach');

    return {
      success: true,
      game: 'coinflip',
      bet: check.bet,
      choice: playerChoice,
      outcome,
      won: win,
      payout,
      net_delta: netDelta,
      linh_thach: nextBal,
      spin_embed: {
        title: `${coinSpin} ĐANG TUNG ĐỒNG XU TIÊN GIỚI...`,
        description: [
          `• **Tu Sĩ:** **${user.username}**`,
          `• **Đặt Cược:** **${check.bet.toLocaleString('vi-VN')}** ${lt} vào **${sideLabel(playerChoice)}**`,
          `• ${coinSpin} *Đồng xu đang xoay giữa linh khí...*`,
        ].join('\n'),
        color: '#f59e0b',
      },
      result_embed: {
        title: win
          ? `${minigameEmoji(outcome === 'heads' ? 'coin_heads' : 'coin_tails', '🪙')} TUNG XU THẮNG LỚN (1:2)!`
          : `${minigameEmoji(outcome === 'heads' ? 'coin_heads' : 'coin_tails', '🪙')} TUNG XU — CHƯA MAY MẮN`,
        description: [
          `• **Tu Sĩ Chọn:** **${sideLabel(playerChoice)}**`,
          `• **Kết Quả Ra:** **${sideLabel(outcome)}**`,
          win
            ? `• **Nhận Thưởng:** **+${payout.toLocaleString('vi-VN')}** ${lt} *(Lãi ròng +${check.bet.toLocaleString('vi-VN')} LT)*`
            : `• **Khấu Trừ:** **-${check.bet.toLocaleString('vi-VN')}** ${lt}`,
          `• **Số Dư Hiện Tại:** **${nextBal.toLocaleString('vi-VN')}** ${lt}`,
        ].join('\n'),
        color: win ? '#10b981' : '#f43f5e',
      },
    };
  });
}

// =========================================================================
// 2. /slots (4 Ô Quay • Jackpot Tối Đa 1:5)
// =========================================================================
export async function playSlots(userId, rawBet, options = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID người dùng không hợp lệ.' };
  if (!supabase) return { success: false, status: 503, error: 'DB_UNAVAILABLE', message: 'Cơ sở dữ liệu chưa sẵn sàng.' };

  const rng = typeof options.rng === 'function' ? options.rng : Math.random;

  return withMinigameLock(cleanId, async () => {
    const { user } = await ensureUserInitialized(cleanId, {
      username: options.username,
      fallbackUsername: options.fallbackUsername,
      avatarUrl: options.avatarUrl,
    });
    if (!user) return { success: false, status: 500, error: 'USER_INIT_FAILED', message: 'Không thể khởi tạo hồ sơ.' };

    const check = validateBetAndCooldown(cleanId, rawBet, user.linh_thach, options);
    if (!check.ok) return { success: false, status: check.status, error: check.error, message: check.message };

    const roll = rng();
    let reels = [];
    let multiplier = 0;
    let tierLabel = 'Chưa Trúng Thưởng';

    if (roll < 0.005) {
      // 4x Jackpot Cửu Vĩ Kim Hồ = 1:5
      const fox = SLOT_SYMBOLS[0];
      reels = [fox, fox, fox, fox];
      multiplier = 5.0;
      tierLabel = 'ĐẠI JACKPOT TỨ QUÝ CỬU VĨ (1:5)';
    } else if (roll < 0.015) {
      // 4x Cực Phẩm Linh Thạch = 1:4
      const jade = SLOT_SYMBOLS[1];
      reels = [jade, jade, jade, jade];
      multiplier = 4.0;
      tierLabel = 'TỨ QUÝ LINH THẠCH (1:4)';
    } else if (roll < 0.085) {
      // 3-of-a-kind = 1:2.5
      const [mainSym, filler] = pickDistinctSymbols(2, rng);
      reels = shuffleArr([mainSym, mainSym, mainSym, filler], rng);
      multiplier = 2.5;
      tierLabel = 'TAM LIÊN HỢP BẢO (1:2.5)';
    } else if (roll < 0.45) {
      // Two pairs = 1:2
      const [symA, symB] = pickDistinctSymbols(2, rng);
      reels = shuffleArr([symA, symA, symB, symB], rng);
      multiplier = 2.0;
      tierLabel = 'SONG ĐÔI CÁT TƯỜNG (1:2)';
    } else {
      // Lose: 4 distinct or single pair (AABC / ABCD) - guaranteed zero winning pattern
      const [s1, s2, s3, s4] = pickDistinctSymbols(4, rng);
      reels = rng() < 0.45 ? shuffleArr([s1, s1, s2, s3], rng) : [s1, s2, s3, s4];
      multiplier = 0;
    }

    const won = multiplier > 0;
    const payout = won ? Math.round(check.bet * multiplier) : 0;
    const netDelta = payout - check.bet;
    const nextBal = Math.max(0, check.bal + netDelta);

    lastPlayMap.set(cleanId, Date.now());
    await Promise.all([
      supabase.from('users').update({ linh_thach: nextBal, updated_at: new Date().toISOString() }).eq('user_id', cleanId),
      trackQuestActivity(cleanId, { activityDelta: 1 }),
    ]);

    const spinGif = minigameEmoji('slot_spin', '🎰');
    const reelBar = reels.map((s) => slotIcon(s.id)).join('  |  ');
    const lt = em('su_linhthach');

    return {
      success: true,
      game: 'slots',
      bet: check.bet,
      won,
      multiplier,
      tier_label: tierLabel,
      reels: reels.map((r) => r.id),
      payout,
      net_delta: netDelta,
      linh_thach: nextBal,
      spin_embed: {
        title: `${spinGif} MÁY QUAY TỨ BẢO TIÊN GIỚI (4 Ô)...`,
        description: [
          `**[ ${spinGif}  |  ${spinGif}  |  ${spinGif}  |  ${spinGif} ]**`,
          `• **Tu Sĩ:** **${user.username}** • **Đặt Cược:** **${check.bet.toLocaleString('vi-VN')}** ${lt}`,
          `• *Các cuộn bảo vật đang xoay...*`,
        ].join('\n'),
        color: '#a855f7',
      },
      result_embed: {
        title: won
          ? `${minigameEmoji('slot_fox', '🦊')} KẾT QUẢ TỨ BẢO — ${tierLabel}`
          : `${slotIcon(reels[0].id)} KẾT QUẢ TỨ BẢO — CHƯA MAY MẮN`,
        description: [
          `**[ ${reelBar} ]**`,
          `• **Tu Sĩ:** **${user.username}** • **Mức Cược:** **${check.bet.toLocaleString('vi-VN')}** ${lt}`,
          won
            ? `• **Thưởng Thắng (×${multiplier}):** **+${payout.toLocaleString('vi-VN')}** ${lt} *(Lãi ròng +${netDelta.toLocaleString('vi-VN')} LT)*`
            : `• **Khấu Trừ:** **-${check.bet.toLocaleString('vi-VN')}** ${lt}`,
          `• **Số Dư Hiện Tại:** **${nextBal.toLocaleString('vi-VN')}** ${lt}`,
        ].join('\n'),
        color: won ? (multiplier >= 4 ? '#f59e0b' : '#10b981') : '#f43f5e',
      },
    };
  });
}

// =========================================================================
// 3. /blackjack (Xì Dách Tiên Giới • Hit / Stand / Double • Trả thưởng 1:2)
// =========================================================================
function createBlackjackDeck(rng) {
  const deck = [];
  for (const suit of SUITS) {
    for (const r of RANKS) {
      deck.push({ rank: r.rank, suit, val: r.val, label: `${r.rank}${suit}` });
    }
  }
  return shuffleArr(deck, rng);
}

function handValue(cards) {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    total += c.val;
    if (c.rank === 'A') aces += 1;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  return total;
}

function formatHand(cards, hideSecond = false) {
  if (hideSecond && cards.length >= 2) {
    const back = minigameEmoji('card_back', '🂠');
    return `\`${cards[0].label}\` ${back}`;
  }
  return cards.map((c) => `\`${c.label}\``).join(' ');
}

function drawBiasedCard(deck, rng, biasMode = 'normal') {
  if (deck.length === 0) return { rank: '7', suit: '♠', val: 7, label: '7♠' };
  if (biasMode === 'dealer_strong' && rng() < 0.08) {
    const idx = deck.findIndex((c) => c.val >= 9);
    if (idx !== -1) return deck.splice(idx, 1)[0];
  }
  if (biasMode === 'player_stiff' && rng() < 0.06) {
    const idx = deck.findIndex((c) => c.val >= 4 && c.val <= 7);
    if (idx !== -1) return deck.splice(idx, 1)[0];
  }
  return deck.shift();
}

function resolveDealerDraw(session) {
  const rng = session.rng || Math.random;
  while (handValue(session.dealerHand) < 17) {
    const cur = handValue(session.dealerHand);
    const mode = cur >= 7 && cur <= 11 ? 'dealer_strong' : 'normal';
    session.dealerHand.push(drawBiasedCard(session.deck, rng, mode));
  }
}

function settleBlackjackOutcome(playerHand, dealerHand, bet, isDouble = false) {
  const pScore = handValue(playerHand);
  const dScore = handValue(dealerHand);
  const effectiveBet = isDouble ? bet * 2 : bet;

  if (pScore > 21) {
    return { status: 'bust', won: false, push: false, payout: 0, netDelta: -effectiveBet, pScore, dScore };
  }
  if (dScore > 21 || pScore > dScore) {
    return { status: 'win', won: true, push: false, payout: effectiveBet * 2, netDelta: effectiveBet, pScore, dScore };
  }
  if (pScore === dScore) {
    // Push refunds stake cleanly, keeping netDelta 0
    return { status: 'push', won: false, push: true, payout: effectiveBet, netDelta: 0, pScore, dScore };
  }
  return { status: 'lose', won: false, push: false, payout: 0, netDelta: -effectiveBet, pScore, dScore };
}

function buildBlackjackEmbed(session, username, balance, settled = null) {
  const lt = em('su_linhthach');
  const dealGif = minigameEmoji('card_deal', '🃏');
  const winIcon = minigameEmoji('card_win', '🏆');
  const bustIcon = minigameEmoji('card_bust', '💥');

  if (!settled) {
    const pScore = handValue(session.playerHand);
    return {
      title: `${dealGif} XÌ DÁCH TIÊN GIỚI — ĐANG CHIA BÀI`,
      description: [
        `• **Tu Sĩ:** **${username}** (${formatHand(session.playerHand)}) → **${pScore} Điểm**`,
        `• **Nhà Cái:** ${formatHand(session.dealerHand, true)} *(1 lá úp)*`,
        `• **Cược Hiện Tại:** **${session.bet.toLocaleString('vi-VN')}** ${lt} • **Trả thưởng:** \`1:2\``,
        `• Chọn **Rút Bài (Hit)**, **Dừng (Stand)** hoặc **Nhân Đôi (Double)** ở nút phía dưới.`,
      ].join('\n'),
      color: '#6366f1',
    };
  }

  const headIcon = settled.won ? winIcon : bustIcon;
  const headerTxt = settled.status === 'bust'
    ? 'QUẮC BÀI (> 21 ĐIỂM)'
    : settled.status === 'win'
      ? (settled.pScore === 21 && session.playerHand.length === 2 ? 'XÌ DÁCH HOÀN HẢO (1:2)!' : 'CHIẾN THẮNG NHÀ CÁI (1:2)!')
      : settled.status === 'push'
        ? 'HÒA ĐIỂM — HOÀN CƯỢC'
        : 'NHÀ CÁI THẮNG';

  return {
    title: `${headIcon} XÌ DÁCH — ${headerTxt}`,
    description: [
      `• **Bài Của Bạn:** ${formatHand(session.playerHand)} → **${settled.pScore} Điểm**`,
      `• **Bài Nhà Cái:** ${formatHand(session.dealerHand, false)} → **${settled.dScore} Điểm**`,
      settled.won
        ? `• **Nhận Thưởng:** **+${settled.payout.toLocaleString('vi-VN')}** ${lt}`
        : settled.push
          ? `• **Hoàn Cược:** **+${settled.payout.toLocaleString('vi-VN')}** ${lt}`
          : `• **Thất Bại:** **-${(session.bet).toLocaleString('vi-VN')}** ${lt}`,
      `• **Số Dư Hiện Tại:** **${balance.toLocaleString('vi-VN')}** ${lt}`,
    ].join('\n'),
    color: settled.won ? '#10b981' : settled.push ? '#f59e0b' : '#f43f5e',
  };
}

export async function startBlackjack(userId, rawBet, options = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID người dùng không hợp lệ.' };
  if (!supabase) return { success: false, status: 503, error: 'DB_UNAVAILABLE', message: 'Cơ sở dữ liệu chưa sẵn sàng.' };

  const rng = typeof options.rng === 'function' ? options.rng : Math.random;

  return withMinigameLock(cleanId, async () => {
    const { user } = await ensureUserInitialized(cleanId, {
      username: options.username,
      fallbackUsername: options.fallbackUsername,
      avatarUrl: options.avatarUrl,
    });
    if (!user) return { success: false, status: 500, error: 'USER_INIT_FAILED', message: 'Không thể khởi tạo hồ sơ.' };

    const check = validateBetAndCooldown(cleanId, rawBet, user.linh_thach, options);
    if (!check.ok) return { success: false, status: check.status, error: check.error, message: check.message };

    const afterBetBal = check.bal - check.bet;
    const deck = createBlackjackDeck(rng);
    const dealerHand = [drawBiasedCard(deck, rng, 'dealer_strong'), drawBiasedCard(deck, rng, 'dealer_strong')];
    const playerHand = [drawBiasedCard(deck, rng, 'player_stiff'), drawBiasedCard(deck, rng, 'normal')];

    lastPlayMap.set(cleanId, Date.now());
    const sessionId = crypto.randomBytes(6).toString('hex');
    const session = {
      sessionId,
      userId: cleanId,
      username: user.username,
      bet: check.bet,
      deck,
      playerHand,
      dealerHand,
      finished: false,
      rng,
      createdAt: Date.now(),
    };

    const initScore = handValue(playerHand);
    if (initScore === 21) {
      resolveDealerDraw(session);
      const settled = settleBlackjackOutcome(playerHand, session.dealerHand, check.bet, false);
      const finalBal = afterBetBal + settled.payout;
      session.finished = true;
      await Promise.all([
        supabase.from('users').update({ linh_thach: finalBal, updated_at: new Date().toISOString() }).eq('user_id', cleanId),
        trackQuestActivity(cleanId, { activityDelta: 1 }),
      ]);
      return {
        success: true,
        game: 'blackjack',
        session_id: sessionId,
        finished: true,
        ...settled,
        bet: check.bet,
        linh_thach: finalBal,
        embed: buildBlackjackEmbed(session, user.username, finalBal, settled),
      };
    }

    activeBlackjackSessions.set(cleanId, session);
    await Promise.all([
      supabase.from('users').update({ linh_thach: afterBetBal, updated_at: new Date().toISOString() }).eq('user_id', cleanId),
      trackQuestActivity(cleanId, { activityDelta: 1 }),
    ]);

    return {
      success: true,
      game: 'blackjack',
      session_id: sessionId,
      finished: false,
      bet: check.bet,
      player_score: initScore,
      player_hand: playerHand.map((c) => c.label),
      dealer_visible: dealerHand[0].label,
      can_double: afterBetBal >= check.bet,
      linh_thach: afterBetBal,
      embed: buildBlackjackEmbed(session, user.username, afterBetBal, null),
    };
  });
}

export async function blackjackAction(userId, rawAction = 'hit', options = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID người dùng không hợp lệ.' };
  if (!supabase) return { success: false, status: 503, error: 'DB_UNAVAILABLE', message: 'Cơ sở dữ liệu chưa sẵn sàng.' };

  return withMinigameLock(cleanId, async () => {
    const session = activeBlackjackSessions.get(cleanId);
    if (!session || session.finished) {
      return {
        success: false,
        status: 404,
        error: 'NO_ACTIVE_BLACKJACK',
        message: 'Bạn chưa có ván Xì Dách nào đang mở. Hãy dùng `/blackjack cuoc:<số LT>` để mở bàn mới!',
      };
    }

    const { user } = await ensureUserInitialized(cleanId);
    const curBal = Number(user?.linh_thach || 0);
    const act = String(rawAction || 'stand').trim().toLowerCase();
    const rng = options.rng || session.rng || Math.random;

    if (act === 'double') {
      if (session.playerHand.length !== 2) {
        return { success: false, status: 400, error: 'DOUBLE_NOT_ALLOWED', message: 'Chỉ được Nhân Đôi ở 2 lá bài đầu!' };
      }
      if (curBal < session.bet) {
        return { success: false, status: 400, error: 'INSUFFICIENT_LINH_THACH', message: 'Không đủ Linh Thạch để Nhân Đôi cược!' };
      }
      const nextBalAfterDouble = curBal - session.bet;
      session.bet *= 2;
      session.playerHand.push(drawBiasedCard(session.deck, rng, 'player_stiff'));
      if (handValue(session.playerHand) <= 21) {
        resolveDealerDraw(session);
      }
      const settled = settleBlackjackOutcome(session.playerHand, session.dealerHand, session.bet / 2, true);
      session.finished = true;
      activeBlackjackSessions.delete(cleanId);
      const finalBal = nextBalAfterDouble + settled.payout;
      await supabase.from('users').update({ linh_thach: finalBal, updated_at: new Date().toISOString() }).eq('user_id', cleanId);
      return {
        success: true,
        game: 'blackjack',
        session_id: session.sessionId,
        finished: true,
        ...settled,
        bet: session.bet,
        linh_thach: finalBal,
        embed: buildBlackjackEmbed(session, session.username, finalBal, settled),
      };
    }

    if (act === 'hit') {
      session.playerHand.push(drawBiasedCard(session.deck, rng, handValue(session.playerHand) >= 12 ? 'normal' : 'player_stiff'));
      const pScore = handValue(session.playerHand);
      if (pScore > 21) {
        const settled = settleBlackjackOutcome(session.playerHand, session.dealerHand, session.bet, false);
        session.finished = true;
        activeBlackjackSessions.delete(cleanId);
        return {
          success: true,
          game: 'blackjack',
          session_id: session.sessionId,
          finished: true,
          ...settled,
          bet: session.bet,
          linh_thach: curBal,
          embed: buildBlackjackEmbed(session, session.username, curBal, settled),
        };
      }
      if (pScore === 21) {
        resolveDealerDraw(session);
        const settled = settleBlackjackOutcome(session.playerHand, session.dealerHand, session.bet, false);
        session.finished = true;
        activeBlackjackSessions.delete(cleanId);
        const finalBal = curBal + settled.payout;
        if (settled.payout > 0) {
          await supabase.from('users').update({ linh_thach: finalBal, updated_at: new Date().toISOString() }).eq('user_id', cleanId);
        }
        return {
          success: true,
          game: 'blackjack',
          session_id: session.sessionId,
          finished: true,
          ...settled,
          bet: session.bet,
          linh_thach: finalBal,
          embed: buildBlackjackEmbed(session, session.username, finalBal, settled),
        };
      }
      return {
        success: true,
        game: 'blackjack',
        session_id: session.sessionId,
        finished: false,
        bet: session.bet,
        player_score: pScore,
        player_hand: session.playerHand.map((c) => c.label),
        dealer_visible: session.dealerHand[0].label,
        can_double: false,
        linh_thach: curBal,
        embed: buildBlackjackEmbed(session, session.username, curBal, null),
      };
    }

    // stand
    resolveDealerDraw(session);
    const settled = settleBlackjackOutcome(session.playerHand, session.dealerHand, session.bet, false);
    session.finished = true;
    activeBlackjackSessions.delete(cleanId);
    const finalBal = curBal + settled.payout;
    if (settled.payout > 0) {
      await supabase.from('users').update({ linh_thach: finalBal, updated_at: new Date().toISOString() }).eq('user_id', cleanId);
    }
    return {
      success: true,
      game: 'blackjack',
      session_id: session.sessionId,
      finished: true,
      ...settled,
      bet: session.bet,
      linh_thach: finalBal,
      embed: buildBlackjackEmbed(session, session.username, finalBal, settled),
    };
  });
}

// =========================================================================
// 4. /crash (Phi Kiếm Độ Kiếp • Thang hệ số 1.00x -> 5.00x)
// =========================================================================
function sampleMaxSurvivableStepIndex(rng) {
  const r = rng();
  for (let idx = CRASH_LADDER.length - 1; idx >= 1; idx -= 1) {
    if (r < CRASH_STEP_REACH_PROB[idx]) return idx;
  }
  return 0;
}

function buildCrashEmbed(session, username, balance, stateTag = 'flying') {
  const lt = em('su_linhthach');
  const flyGif = minigameEmoji('crash_fly', '🚀');
  const boomGif = minigameEmoji('crash_boom', '💥');
  const winIcon = minigameEmoji('crash_cashout', '💰');

  const curMult = CRASH_LADDER[session.stepIndex];
  const nextMult = CRASH_LADDER[session.stepIndex + 1] || null;
  const curPayout = Math.round(session.bet * curMult);

  if (stateTag === 'boom') {
    const failMult = CRASH_LADDER[Math.min(CRASH_LADDER.length - 1, session.stepIndex + 1)];
    return {
      title: `${boomGif} THIÊN LÔI ĐÁNH NỔ PHI KIẾM TẠI ${failMult.toFixed(2)}×!`,
      description: [
        `• **Tu Sĩ:** **${username}** • **Đặt Cược:** **${session.bet.toLocaleString('vi-VN')}** ${lt}`,
        `• ${boomGif} *Phi kiếm đã tan vỡ trước khi kịp thu hồi!*`,
        `• **Số Dư Hiện Tại:** **${balance.toLocaleString('vi-VN')}** ${lt}`,
      ].join('\n'),
      color: '#f43f5e',
    };
  }

  if (stateTag === 'cashout') {
    return {
      title: `${winIcon} ĐỘ KIẾP THÀNH CÔNG — RÚT TẠI ${curMult.toFixed(2)}×!`,
      description: [
        `• **Tu Sĩ:** **${username}** • **Đặt Cược:** **${session.bet.toLocaleString('vi-VN')}** ${lt}`,
        `• **Nhận Thưởng (×${curMult.toFixed(2)}):** **+${curPayout.toLocaleString('vi-VN')}** ${lt}`,
        `• **Số Dư Hiện Tại:** **${balance.toLocaleString('vi-VN')}** ${lt}`,
      ].join('\n'),
      color: '#10b981',
    };
  }

  return {
    title: `${flyGif} PHI KIẾM ĐỘ KIẾM ĐANG BAY — ${curMult.toFixed(2)}×`,
    description: [
      `• **Tu Sĩ:** **${username}** • **Đặt Cược:** **${session.bet.toLocaleString('vi-VN')}** ${lt}`,
      `• **Hệ Số Hiện Tại:** \`${curMult.toFixed(2)}×\` → **Có thể rút ngay:** **${curPayout.toLocaleString('vi-VN')}** ${lt}`,
      nextMult ? `• **Bậc Kế Tiếp:** \`${nextMult.toFixed(2)}×\` *(+nút **Bay Tiếp** hoặc **Rút Linh Thạch**)*` : `• **ĐÃ ĐẠT ĐỈNH TỐI ĐA ${curMult.toFixed(2)}×!**`,
    ].join('\n'),
    color: '#06b6d4',
  };
}

export async function crashGame(userId, rawActionOrBet, rawExtra = null, options = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID người dùng không hợp lệ.' };
  if (!supabase) return { success: false, status: 503, error: 'DB_UNAVAILABLE', message: 'Cơ sở dữ liệu chưa sẵn sàng.' };

  const actStr = String(rawActionOrBet || '').trim().toLowerCase();
  const isButtonAction = actStr === 'step' || actStr === 'cashout';
  const rng = typeof options.rng === 'function' ? options.rng : Math.random;

  return withMinigameLock(cleanId, async () => {
    const { user } = await ensureUserInitialized(cleanId, {
      username: options.username,
      fallbackUsername: options.fallbackUsername,
      avatarUrl: options.avatarUrl,
    });
    if (!user) return { success: false, status: 500, error: 'USER_INIT_FAILED', message: 'Không thể khởi tạo hồ sơ.' };

    if (isButtonAction) {
      const session = activeCrashSessions.get(cleanId);
      if (!session || session.finished) {
        return {
          success: false,
          status: 404,
          error: 'NO_ACTIVE_CRASH',
          message: 'Bạn chưa có ván Phi Kiếm Độ Kiếp nào đang bay. Hãy dùng `/crash cuoc:<số LT>` để khởi động!',
        };
      }

      const curBal = Number(user.linh_thach || 0);
      if (actStr === 'cashout') {
        const curMult = CRASH_LADDER[session.stepIndex];
        const payout = Math.round(session.bet * curMult);
        session.finished = true;
        activeCrashSessions.delete(cleanId);
        const finalBal = curBal + payout;
        await supabase.from('users').update({ linh_thach: finalBal, updated_at: new Date().toISOString() }).eq('user_id', cleanId);
        return {
          success: true,
          game: 'crash',
          session_id: session.sessionId,
          finished: true,
          crashed: false,
          multiplier: curMult,
          payout,
          net_delta: payout - session.bet,
          linh_thach: finalBal,
          embed: buildCrashEmbed(session, session.username, finalBal, 'cashout'),
        };
      }

      // actStr === 'step': climb 1 step
      const nextIdx = session.stepIndex + 1;
      if (nextIdx > session.maxSurvivableStep || nextIdx >= CRASH_LADDER.length) {
        session.finished = true;
        activeCrashSessions.delete(cleanId);
        return {
          success: true,
          game: 'crash',
          session_id: session.sessionId,
          finished: true,
          crashed: true,
          multiplier: 0,
          payout: 0,
          net_delta: -session.bet,
          linh_thach: curBal,
          embed: buildCrashEmbed(session, session.username, curBal, 'boom'),
        };
      }

      session.stepIndex = nextIdx;
      const curMult = CRASH_LADDER[nextIdx];
      // Auto cashout cleanly if reached top step 5.00x
      if (nextIdx === CRASH_LADDER.length - 1) {
        const payout = Math.round(session.bet * curMult);
        session.finished = true;
        activeCrashSessions.delete(cleanId);
        const finalBal = curBal + payout;
        await supabase.from('users').update({ linh_thach: finalBal, updated_at: new Date().toISOString() }).eq('user_id', cleanId);
        return {
          success: true,
          game: 'crash',
          session_id: session.sessionId,
          finished: true,
          crashed: false,
          multiplier: curMult,
          payout,
          net_delta: payout - session.bet,
          linh_thach: finalBal,
          embed: buildCrashEmbed(session, session.username, finalBal, 'cashout'),
        };
      }

      return {
        success: true,
        game: 'crash',
        session_id: session.sessionId,
        finished: false,
        crashed: false,
        step_index: nextIdx,
        multiplier: curMult,
        potential_payout: Math.round(session.bet * curMult),
        linh_thach: curBal,
        embed: buildCrashEmbed(session, session.username, curBal, 'flying'),
      };
    }

    // Start new Crash session
    const rawBet = rawActionOrBet === 'start' ? (options.bet ?? rawExtra) : rawActionOrBet;
    const check = validateBetAndCooldown(cleanId, rawBet, user.linh_thach, options);
    if (!check.ok) return { success: false, status: check.status, error: check.error, message: check.message };

    const afterBetBal = check.bal - check.bet;
    const maxStep = sampleMaxSurvivableStepIndex(rng);
    const sessionId = crypto.randomBytes(6).toString('hex');
    const session = {
      sessionId,
      userId: cleanId,
      username: user.username,
      bet: check.bet,
      stepIndex: 0,
      maxSurvivableStep: maxStep,
      finished: false,
      createdAt: Date.now(),
    };

    lastPlayMap.set(cleanId, Date.now());
    await Promise.all([
      supabase.from('users').update({ linh_thach: afterBetBal, updated_at: new Date().toISOString() }).eq('user_id', cleanId),
      trackQuestActivity(cleanId, { activityDelta: 1 }),
    ]);

    // If auto-cashout multiplier is supplied (e.g. muc_rut: 2.0)
    const autoTarget = Number(options.autoCashout || rawExtra || 0);
    if (autoTarget >= 1.35) {
      const targetIdx = CRASH_LADDER.findIndex((m) => m >= autoTarget);
      const desiredIdx = targetIdx === -1 ? CRASH_LADDER.length - 1 : targetIdx;
      const reached = maxStep >= desiredIdx;
      session.stepIndex = reached ? desiredIdx : maxStep;
      session.finished = true;
      const payout = reached ? Math.round(check.bet * CRASH_LADDER[desiredIdx]) : 0;
      const finalBal = afterBetBal + payout;
      if (payout > 0) {
        await supabase.from('users').update({ linh_thach: finalBal, updated_at: new Date().toISOString() }).eq('user_id', cleanId);
      }
      return {
        success: true,
        game: 'crash',
        session_id: sessionId,
        finished: true,
        crashed: !reached,
        multiplier: reached ? CRASH_LADDER[desiredIdx] : 0,
        payout,
        net_delta: payout - check.bet,
        linh_thach: finalBal,
        embed: buildCrashEmbed(session, user.username, finalBal, reached ? 'cashout' : 'boom'),
      };
    }

    activeCrashSessions.set(cleanId, session);
    return {
      success: true,
      game: 'crash',
      session_id: sessionId,
      finished: false,
      crashed: false,
      step_index: 0,
      multiplier: 1.00,
      potential_payout: check.bet,
      linh_thach: afterBetBal,
      embed: buildCrashEmbed(session, user.username, afterBetBal, 'flying'),
    };
  });
}
