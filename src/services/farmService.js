/**
 * src/services/farmService.js
 * Hệ thống Nuôi Trồng Thời Gian Thực (/farm) & Đổi Quà Nông Sản (/exchange) cho SuMi Family v1.3.
 */

import { supabase } from '../config/supabase.js';
import {
  FARM_SEEDS,
  FARM_SEED_BY_ID,
  EXCHANGE_ITEMS,
  EXCHANGE_ITEM_BY_ID,
} from '../data/catalog.js';
import { em, farmEmoji, uiEm } from '../config/emojiHelper.js';
import { ensureUserInitialized } from './profileService.js';
import { addInventoryItem, trackQuestActivity } from './questService.js';
import { claimNextAlchemyDmNotification, runAlchemyAutoProtect } from './alchemyService.js';
import { invalidateInventoryCache } from './inventoryService.js';

const MAX_FARM_SLOTS = 8;
const DEFAULT_FARM_SLOTS = 4;
export const FARM_CARE_SPEEDUP_MS = 30 * 60000; // Rút ngắn 30 phút thời gian chín mỗi lần tưới/cho ăn đúng giờ (công bố Ver 1.7)
export const FARM_PROTECT_EXTENSION_MS = 2 * 3600000;
export const FARM_PROTECT_TRIGGER_WINDOW_MS = 5 * 60000;
export const FARM_AUTO_CARD_DURATION_MS = 24 * 3600000;
export const FARM_GROWTH_MED_REDUCTION_RATE = 0.25;
export const FARM_YIELD_STARCH_BONUS_RATE = 0.30;

const SLOT_TYPES_BY_INDEX = {
  1: 'linh_dien',
  2: 'linh_dien',
  3: 'linh_cac',
  4: 'linh_cac',
  5: 'linh_dien',
  6: 'linh_cac',
  7: 'linh_dien',
  8: 'linh_cac',
};

const farmLocks = new Map();
async function withFarmLock(userId, fn) {
  const prev = farmLocks.get(userId) || Promise.resolve();
  let release;
  const cur = new Promise((r) => { release = r; });
  farmLocks.set(userId, prev.then(() => cur));
  await prev;
  try {
    return await fn();
  } finally {
    release();
    if (farmLocks.get(userId) === cur) farmLocks.delete(userId);
  }
}

function sanitizeUserId(id) {
  if (!id) return null;
  const s = String(id).trim();
  return /^[0-9]{15,22}$/.test(s) ? s : null;
}

function formatDurationHm(ms) {
  const totalMin = Math.max(1, Math.ceil(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0 && m > 0) return `${h}g ${m}p`;
  if (h > 0) return `${h}g`;
  return `${m}p`;
}

export function resolveSeedQuery(raw) {
  let s = String(raw || '').trim();
  const emojiM = s.match(/^<a?:([a-zA-Z0-9_]+):\d+>$/) || s.match(/^:([a-zA-Z0-9_]+):$/);
  if (emojiM) s = emojiM[1];
  const lower = s.toLowerCase();
  if (FARM_SEED_BY_ID[lower]) return FARM_SEED_BY_ID[lower];
  const clean = lower.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  return FARM_SEEDS.find((sd) => sd.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(clean)) || null;
}

function computePlotTimings(row, seed, now) {
  const plantedMs = new Date(row.planted_at || now).getTime();
  const lastCaredMs = new Date(row.last_cared_at || row.planted_at || now).getTime();
  const careCount = Math.max(0, Number(row.care_count || 0));
  const matureMs = Math.max(plantedMs, plantedMs + seed.growth_hours * 3600000 - careCount * FARM_CARE_SPEEDUP_MS);
  const wiltDeadlineMs = lastCaredMs + seed.wilt_hours * 3600000;
  const careDueMs = lastCaredMs + seed.care_interval_hours * 3600000;
  return { plantedMs, lastCaredMs, careCount, matureMs, wiltDeadlineMs, careDueMs };
}

export function computePlotSnapshot(row, now) {
  const isCac = row.plot_type === 'linh_cac';
  const plotLabel = isCac ? 'Linh Các' : 'Linh Điền';
  if (!row.seed_id || row.status === 'empty') {
    const emptyDesc = isCac
      ? '**Đang Trống** — Sẵn sàng ấp trứng linh thú.'
      : '**Đang Trống** — Sẵn sàng gieo hạt giống.';
    return {
      ...row,
      plot_label: plotLabel,
      computed_status: 'empty',
      needs_care: false,
      summary: `Ô #${row.slot_index}: ${emptyDesc}`,
    };
  }

  const seed = FARM_SEED_BY_ID[row.seed_id];
  if (!seed) {
    return { ...row, plot_label: plotLabel, computed_status: 'empty', needs_care: false, summary: `Ô #${row.slot_index}: Trống` };
  }

  if (row.status === 'wilted') {
    return {
      ...row,
      seed,
      plot_label: plotLabel,
      computed_status: 'wilted',
      needs_care: false,
      summary: `Ô #${row.slot_index}: ${seed.icon} **${seed.name}** — **ĐÃ HÉO / BỎ ĐI** *(Bấm Dọn Ô Héo để dọn)*`,
    };
  }

  const nowMs = now.getTime();
  const { matureMs, wiltDeadlineMs, careDueMs } = computePlotTimings(row, seed, now);

  if (row.status === 'ready' || (nowMs >= matureMs && matureMs <= wiltDeadlineMs)) {
    return {
      ...row,
      seed,
      plot_label: plotLabel,
      computed_status: 'ready',
      needs_care: false,
      summary: `Ô #${row.slot_index}: ${seed.icon} **${seed.name}** — **CHÍN MUỒI** *(Thu +${seed.reward_lt} LT & +${seed.reward_essence} ${farmEmoji('farm_essence')})*`,
    };
  }

  if (nowMs >= wiltDeadlineMs) {
    return {
      ...row,
      seed,
      plot_label: plotLabel,
      computed_status: 'wilted',
      needs_care: false,
      summary: `Ô #${row.slot_index}: ${seed.icon} **${seed.name}** — **ĐÃ HÉO / BỎ ĐI** *(Quá ${seed.wilt_hours}h chưa chăm sóc)*`,
    };
  }

  const needsCare = nowMs >= careDueMs;
  const remMatureTxt = formatDurationHm(Math.max(60000, matureMs - nowMs));
  const remWiltTxt = formatDurationHm(Math.max(60000, wiltDeadlineMs - nowMs));
  const careLabel = isCac ? 'ĐẾN GIỜ CHO ĂN!' : 'ĐẾN GIỜ TƯỚI NƯỚC!';
  const remCareTxt = needsCare ? careLabel : `Chăm sau ${formatDurationHm(careDueMs - nowMs)}`;

  return {
    ...row,
    seed,
    plot_label: plotLabel,
    computed_status: 'growing',
    needs_care: needsCare,
    summary: `Ô #${row.slot_index}: ${seed.icon} **${seed.name}** • Chín sau \`${remMatureTxt}\` • \`${remCareTxt}\` *(Héo sau ${remWiltTxt})*`,
  };
}

async function loadAndSyncPlots(cleanId, unlockedCount, now) {
  const cap = Math.max(DEFAULT_FARM_SLOTS, Math.min(MAX_FARM_SLOTS, Number(unlockedCount) || DEFAULT_FARM_SLOTS));
  const { data: existing } = await supabase
    .from('user_farm_plots')
    .select('*')
    .eq('user_id', cleanId)
    .order('slot_index', { ascending: true });

  const existingByIdx = new Map((existing || []).map((r) => [r.slot_index, r]));
  const missing = [];
  for (let i = 1; i <= cap; i += 1) {
    if (!existingByIdx.has(i)) {
      missing.push({
        user_id: cleanId,
        slot_index: i,
        plot_type: SLOT_TYPES_BY_INDEX[i] || 'linh_dien',
        status: 'empty',
        care_count: 0,
      });
    }
  }
  if (missing.length > 0) {
    await supabase.from('user_farm_plots').upsert(missing, { onConflict: 'user_id,slot_index' });
    const { data: reloaded } = await supabase
      .from('user_farm_plots')
      .select('*')
      .eq('user_id', cleanId)
      .order('slot_index', { ascending: true });
    existing?.splice(0, existing.length, ...(reloaded || []));
  }

  const plots = (existing || []).slice(0, cap).map((r) => computePlotSnapshot(r, now));
  const statusUpdates = [];
  for (const p of plots) {
    if (p.computed_status !== p.status && p.id) {
      statusUpdates.push(
        supabase.from('user_farm_plots').update({ status: p.computed_status, updated_at: now.toISOString() }).eq('id', p.id),
      );
      p.status = p.computed_status;
    }
  }
  if (statusUpdates.length > 0) await Promise.all(statusUpdates);
  return { cap, plots };
}

export async function getFarmStatus(userId, options = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID tu sĩ không hợp lệ.' };
  if (!supabase) return { success: false, status: 503, error: 'DB_UNAVAILABLE', message: 'Cơ sở dữ liệu chưa sẵn sàng.' };

  const now = options.now instanceof Date ? options.now : new Date();
  const { user } = await ensureUserInitialized(cleanId, {
    username: options.username,
    fallbackUsername: options.fallbackUsername,
    avatarUrl: options.avatarUrl,
  });
  if (!user) return { success: false, status: 500, error: 'USER_INIT_FAILED', message: 'Không thể khởi tạo hồ sơ.' };

  const { cap, plots } = await loadAndSyncPlots(cleanId, user.farm_slots_unlocked, now);
  const { data: farmInvRows } = await supabase
    .from('user_inventory')
    .select('item_id, quantity')
    .eq('user_id', cleanId)
    .in('item_id', ['farm_auto_card', 'farm_protect_card', 'farm_growth_med', 'farm_yield_starch']);
  const farmInvMap = new Map((farmInvRows || []).map((r) => [r.item_id, Number(r.quantity || 0)]));
  const autoMs = user.farm_auto_until ? new Date(user.farm_auto_until).getTime() : 0;
  const autoRemainMs = Math.max(0, autoMs - now.getTime());
  const formatRemainShort = (ms) => {
    const mins = Math.max(1, Math.ceil(ms / 60000));
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h${m > 0 ? `${m}p` : ''}` : `${m}p`;
  };
  const activeBuffParts = [];
  if (autoRemainMs > 0) activeBuffParts.push(`${em('farm_auto_card')} Auto 24h (**còn ${formatRemainShort(autoRemainMs)}**)`);
  if (user.farm_growth_med_active) activeBuffParts.push(`${em('farm_growth_med')} Thuốc -25% Giờ (**đã bật**)`);
  if (user.farm_yield_starch_active) activeBuffParts.push(`${em('farm_yield_starch')} Bột +30% Sản Lượng (**đã bật**)`);
  const farmBagLine = [
    `${em('farm_auto_card')} Auto \`x${farmInvMap.get('farm_auto_card') || 0}\``,
    `${em('farm_protect_card')} Bảo Vệ \`x${farmInvMap.get('farm_protect_card') || 0}\``,
    `${em('farm_growth_med')} Thuốc \`x${farmInvMap.get('farm_growth_med') || 0}\``,
    `${em('farm_yield_starch')} Bột \`x${farmInvMap.get('farm_yield_starch') || 0}\``,
  ].join(' • ');
  const activeBuffLine = activeBuffParts.length > 0 ? activeBuffParts.join(' • ') : 'Chưa kích hoạt buff nào';
  const essenceIcon = farmEmoji('farm_essence');
  const ltIcon = em('su_linhthach');
  const essence = Number(user.farm_essence || 0);
  const bal = Number(user.linh_thach || 0);

  const readyCount = plots.filter((p) => p.computed_status === 'ready').length;
  const careCount = plots.filter((p) => p.needs_care).length;
  const wiltedCount = plots.filter((p) => p.computed_status === 'wilted').length;

  const linhDienPlots = plots.filter((p) => p.plot_type !== 'linh_cac');
  const linhCacPlots = plots.filter((p) => p.plot_type === 'linh_cac');
  const lockEm = uiEm('ui_lock');

  const linhDienLines = linhDienPlots.map((p) => `• ${p.summary}`);
  for (const lockedIdx of [5, 7]) {
    if (cap < lockedIdx) {
      linhDienLines.push(`• ${lockEm} **Ô #${lockedIdx}:** Chưa mở khóa *(Đổi tại \`/exchange\`)*`);
    }
  }

  const linhCacLines = linhCacPlots.map((p) => `• ${p.summary}`);
  for (const lockedIdx of [6, 8]) {
    if (cap < lockedIdx) {
      linhCacLines.push(`• ${lockEm} **Ô #${lockedIdx}:** Chưa mở khóa *(Đổi tại \`/exchange\`)*`);
    }
  }

  const formatSeedLine = (s) =>
    `• ${s.icon} **${s.name}** (\`${s.seed_id}\`) — Giá \`${s.cost_lt} LT\` → Thu \`${s.reward_lt} LT + ${s.reward_essence}\` ${essenceIcon} *(${s.care_window})*`;
  const linhDienSeeds = FARM_SEEDS.filter((s) => s.plot_type !== 'linh_cac').map(formatSeedLine);
  const linhCacSeeds = FARM_SEEDS.filter((s) => s.plot_type === 'linh_cac').map(formatSeedLine);

  return {
    success: true,
    user_id: cleanId,
    username: user.username,
    linh_thach: bal,
    farm_essence: essence,
    slots_unlocked: cap,
    max_slots: MAX_FARM_SLOTS,
    linh_dien_slots: linhDienPlots.length,
    linh_cac_slots: linhCacPlots.length,
    ready_count: readyCount,
    care_due_count: careCount,
    wilted_count: wiltedCount,
    farm_items: {
      farm_auto_card: farmInvMap.get('farm_auto_card') || 0,
      farm_protect_card: farmInvMap.get('farm_protect_card') || 0,
      farm_growth_med: farmInvMap.get('farm_growth_med') || 0,
      farm_yield_starch: farmInvMap.get('farm_yield_starch') || 0,
    },
    active_buffs: {
      farm_auto_until: autoRemainMs > 0 ? user.farm_auto_until : null,
      farm_growth_med_active: Boolean(user.farm_growth_med_active),
      farm_yield_starch_active: Boolean(user.farm_yield_starch_active),
    },
    plots,
    title: `${essenceIcon} LINH ĐIỀN & LINH THÚ CÁC — ${user.username}`,
    description: [
      `• **Số Dư:** **${bal.toLocaleString('vi-VN')}** ${ltIcon} • **Linh Quả Tiên Giới:** **${essence.toLocaleString('vi-VN')}** ${essenceIcon}`,
      `• **Linh Điền:** \`${linhDienPlots.length}/4\` • **Linh Các:** \`${linhCacPlots.length}/4\` *(Tổng \`${cap}/${MAX_FARM_SLOTS}\` ô • Tự động DM nhắc tưới & cảnh báo héo 1h/30p/15p)*`,
      `• **Buff /farm:** ${activeBuffLine}`,
      `• **Vật Phẩm Hiện Có:** ${farmBagLine}`,
      '',
      `**${farmEmoji('seed_linh_thao')} KHU LINH ĐIỀN (${linhDienPlots.length}/4 ô):**`,
      ...linhDienLines,
      '────────────────────────',
      `**${farmEmoji('egg_linh_thu')} KHU LINH THÚ CÁC (${linhCacPlots.length}/4 ô):**`,
      ...linhCacLines,
      '────────────────────────',
      '**Bảng Giống & Trứng Thời Gian Thực (Chọn menu bên dưới hoặc \`/farm hanh_dong:plant\` — tự chọn ô trống):**',
      ...linhDienSeeds,
      ...linhCacSeeds,
    ].join('\n'),
    footer: '',
  };
}

export async function plantFarmPlot(userId, rawSeedId, options = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID tu sĩ không hợp lệ.' };
  if (!supabase) return { success: false, status: 503, error: 'DB_UNAVAILABLE', message: 'Cơ sở dữ liệu chưa sẵn sàng.' };

  const seed = resolveSeedQuery(rawSeedId);
  if (!seed) {
    return {
      success: false,
      status: 404,
      error: 'SEED_NOT_FOUND',
      message: `Không tìm thấy Hạt Giống hay Trứng nào khớp \`${rawSeedId}\`. Các mã chuẩn: \`seed_linh_thao\`, \`seed_tien_thao\`, \`seed_than_moc\`, \`egg_linh_thu\`, \`egg_tien_thu\`, \`egg_than_thu\`.`,
    };
  }

  return withFarmLock(cleanId, async () => {
    const now = options.now instanceof Date ? options.now : new Date();
    const { user } = await ensureUserInitialized(cleanId, { username: options.username });
    if (!user) return { success: false, status: 500, error: 'USER_INIT_FAILED', message: 'Không thể khởi tạo hồ sơ.' };

    const bal = Number(user.linh_thach || 0);
    if (bal < seed.cost_lt) {
      return {
        success: false,
        status: 400,
        error: 'INSUFFICIENT_LINH_THACH',
        message: `Cần **${seed.cost_lt.toLocaleString('vi-VN')}** ${em('su_linhthach')} để mua **${seed.name}** (hiện có **${bal.toLocaleString('vi-VN')}**).`,
      };
    }

    const { plots } = await loadAndSyncPlots(cleanId, user.farm_slots_unlocked, now);
    const reqSlot = Number(options.slotIndex) || null;
    const targetPlot = plots.find((p) =>
      p.computed_status === 'empty'
      && p.plot_type === seed.plot_type
      && (!reqSlot || p.slot_index === reqSlot),
    );

    if (!targetPlot) {
      return {
        success: false,
        status: 400,
        error: 'NO_EMPTY_MATCHING_PLOT',
        message: `Hiện không có ô **${seed.plot_label}** nào trống để ${seed.plot_type === 'linh_cac' ? 'ấp trứng' : 'gieo giống'} **${seed.name}**!`,
      };
    }

    const nextBal = bal - seed.cost_lt;
    const nowIso = now.toISOString();
    const growthMedActive = Boolean(user.farm_growth_med_active);
    const medShiftMs = growthMedActive ? Math.round(seed.growth_hours * 3600000 * FARM_GROWTH_MED_REDUCTION_RATE) : 0;
    const effectivePlantedIso = new Date(now.getTime() - medShiftMs).toISOString();
    const userPatch = {
      linh_thach: nextBal,
      ...(growthMedActive ? { farm_growth_med_active: false } : {}),
      updated_at: nowIso,
    };

    await Promise.all([
      supabase.from('users').update(userPatch).eq('user_id', cleanId),
      supabase.from('user_farm_plots').update({
        seed_id: seed.seed_id,
        status: 'growing',
        planted_at: effectivePlantedIso,
        last_cared_at: nowIso,
        care_count: 0,
        dm_care_notified: false,
        dm_wilt_stage: 0,
        protected_this_cycle: false,
        updated_at: nowIso,
      }).eq('id', targetPlot.id),
      trackQuestActivity(cleanId, { farmDelta: 1, now }),
    ]);

    const medNote = growthMedActive ? ` *(Đã tiêu hao ${em('farm_growth_med')} Thuốc Kích Thích -25% thời gian chín!)*` : '';
    return {
      success: true,
      slot_index: targetPlot.slot_index,
      seed_id: seed.seed_id,
      seed_name: seed.name,
      cost_lt: seed.cost_lt,
      linh_thach: nextBal,
      message: `${seed.icon} Đã đặt **${seed.name}** vào **Ô #${targetPlot.slot_index} (${seed.plot_label})**!${medNote}\n• Thời gian trưởng thành: **${growthMedActive ? (seed.growth_hours * (1 - FARM_GROWTH_MED_REDUCTION_RATE)).toFixed(1) : seed.growth_hours} giờ** • Nhắc chăm sóc: **${seed.care_window}**\n• Số dư còn lại: **${nextBal.toLocaleString('vi-VN')}** ${em('su_linhthach')}`,
    };
  });
}

export async function careAllPlots(userId, options = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID tu sĩ không hợp lệ.' };
  if (!supabase) return { success: false, status: 503, error: 'DB_UNAVAILABLE', message: 'Cơ sở dữ liệu chưa sẵn sàng.' };

  return withFarmLock(cleanId, async () => {
    const now = options.now instanceof Date ? options.now : new Date();
    const { user } = await ensureUserInitialized(cleanId, { username: options.username });
    const { plots } = await loadAndSyncPlots(cleanId, user?.farm_slots_unlocked, now);

    const duePlots = plots.filter((p) => p.needs_care);
    if (duePlots.length === 0) {
      const growingPlots = plots.filter((p) => p.computed_status === 'growing');
      return {
        success: true,
        cared_count: 0,
        message: growingPlots.length > 0
          ? `${em('su_el_thuy')} Tất cả các ô đang sinh trưởng đều đã đủ linh khí. Vui lòng quay lại khi tới khung giờ tưới nước / cho ăn!`
          : `Hiện không có ô nào đang sinh trưởng cần chăm sóc.`,
      };
    }

    const nowIso = now.toISOString();
    let ripenedNowCount = 0;
    await Promise.all([
      ...duePlots.map((p) => {
        const nextCareCount = (Number(p.care_count) || 0) + 1;
        const plantedMs = new Date(p.planted_at || now).getTime();
        const growthHours = Number(p.seed?.growth_hours || 0);
        const nextMatureMs = growthHours > 0
          ? Math.max(plantedMs, plantedMs + growthHours * 3600000 - nextCareCount * FARM_CARE_SPEEDUP_MS)
          : Infinity;
        const ripenedNow = now.getTime() >= nextMatureMs;
        if (ripenedNow) ripenedNowCount += 1;
        return supabase.from('user_farm_plots').update({
          last_cared_at: nowIso,
          care_count: nextCareCount,
          status: ripenedNow ? 'ready' : 'growing',
          dm_care_notified: false,
          dm_wilt_stage: 0,
          updated_at: nowIso,
        }).eq('id', p.id);
      }),
      trackQuestActivity(cleanId, { farmDelta: 1, now }),
    ]);

    const readyNote = ripenedNowCount > 0 ? ` (${ripenedNowCount} ô đã chín muồi, có thể thu hoạch ngay!)` : '';
    return {
      success: true,
      cared_count: duePlots.length,
      ripened_now_count: ripenedNowCount,
      slots: duePlots.map((p) => p.slot_index),
      message: `${em('su_el_thuy')} Đã tưới Linh Tuyền & cho ăn thành công cho **${duePlots.length} ô** (${duePlots.map((p) => `#${p.slot_index}`).join(', ')})! Đồng hồ sinh trưởng được gia cố an toàn.${readyNote}`,
    };
  });
}

export async function harvestAllPlots(userId, options = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID tu sĩ không hợp lệ.' };
  if (!supabase) return { success: false, status: 503, error: 'DB_UNAVAILABLE', message: 'Cơ sở dữ liệu chưa sẵn sàng.' };

  return withFarmLock(cleanId, async () => {
    const now = options.now instanceof Date ? options.now : new Date();
    const { user } = await ensureUserInitialized(cleanId, { username: options.username });
    if (!user) return { success: false, status: 500, error: 'USER_INIT_FAILED', message: 'Không thể khởi tạo hồ sơ.' };

    const { plots } = await loadAndSyncPlots(cleanId, user.farm_slots_unlocked, now);
    const readyPlots = plots.filter((p) => p.computed_status === 'ready' && p.seed);
    if (readyPlots.length === 0) {
      return {
        success: false,
        status: 400,
        error: 'NO_READY_PLOTS',
        message: 'Chưa có ô Linh Điền hoặc Linh Các nào chín muồi để thu hoạch!',
      };
    }

    let gainLt = 0;
    let gainEssence = 0;
    for (const p of readyPlots) {
      gainLt += Number(p.seed.reward_lt) || 0;
      gainEssence += Number(p.seed.reward_essence) || 0;
    }

    const yieldStarchActive = Boolean(user.farm_yield_starch_active);
    if (yieldStarchActive) {
      gainLt = Math.round(gainLt * (1 + FARM_YIELD_STARCH_BONUS_RATE));
      gainEssence = Math.round(gainEssence * (1 + FARM_YIELD_STARCH_BONUS_RATE));
    }

    const nextBal = Number(user.linh_thach || 0) + gainLt;
    const nextEssence = Number(user.farm_essence || 0) + gainEssence;
    const nowIso = now.toISOString();

    await Promise.all([
      supabase.from('users').update({
        linh_thach: nextBal,
        farm_essence: nextEssence,
        ...(yieldStarchActive ? { farm_yield_starch_active: false } : {}),
        updated_at: nowIso,
      }).eq('user_id', cleanId),
      ...readyPlots.map((p) =>
        supabase.from('user_farm_plots').update({
          seed_id: null,
          status: 'empty',
          planted_at: null,
          last_cared_at: null,
          care_count: 0,
          dm_care_notified: false,
          dm_wilt_stage: 0,
          protected_this_cycle: false,
          updated_at: nowIso,
        }).eq('id', p.id),
      ),
      trackQuestActivity(cleanId, { farmDelta: 1, now }),
    ]);

    const essIcon = farmEmoji('farm_essence');
    const starchNote = yieldStarchActive ? ` *(Đã kích hoạt ${em('farm_yield_starch')} Bột Tăng Sản Lượng +30%!)*` : '';
    return {
      success: true,
      harvested_count: readyPlots.length,
      yield_starch_applied: yieldStarchActive,
      reward_linh_thach: gainLt,
      reward_essence: gainEssence,
      linh_thach: nextBal,
      farm_essence: nextEssence,
      message: `${essIcon} **THU HOẠCH NÔNG TRẠI THÀNH CÔNG (${readyPlots.length} Ô)!**${starchNote}\n• Thu về: **+${gainLt.toLocaleString('vi-VN')}** ${em('su_linhthach')} • **+${gainEssence.toLocaleString('vi-VN')}** ${essIcon} **Linh Quả Tiên Giới**\n• Kho hiện tại: **${nextBal.toLocaleString('vi-VN')} LT** • **${nextEssence.toLocaleString('vi-VN')} Linh Quả** *(Dùng tại \`/exchange\` & \`/luyendan\`)*`,
    };
  });
}

export async function clearWiltedPlots(userId, options = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID tu sĩ không hợp lệ.' };
  if (!supabase) return { success: false, status: 503, error: 'DB_UNAVAILABLE', message: 'Cơ sở dữ liệu chưa sẵn sàng.' };

  return withFarmLock(cleanId, async () => {
    const now = options.now instanceof Date ? options.now : new Date();
    const { user } = await ensureUserInitialized(cleanId);
    const { plots } = await loadAndSyncPlots(cleanId, user?.farm_slots_unlocked, now);
    const wilted = plots.filter((p) => p.computed_status === 'wilted');
    if (wilted.length === 0) {
      return { success: true, cleared_count: 0, message: 'Không có ô nào bị héo để dọn dẹp.' };
    }
    const nowIso = now.toISOString();
    await Promise.all(
      wilted.map((p) =>
        supabase.from('user_farm_plots').update({
          seed_id: null,
          status: 'empty',
          planted_at: null,
          last_cared_at: null,
          care_count: 0,
          dm_care_notified: false,
          dm_wilt_stage: 0,
          updated_at: nowIso,
        }).eq('id', p.id),
      ),
    );
    return {
      success: true,
      cleared_count: wilted.length,
      message: `${uiEm('ui_refresh')} Đã dọn dẹp **${wilted.length} ô bị héo** về trạng thái trống.`,
    };
  });
}

export async function getExchangeCatalog(userId) {
  const cleanId = sanitizeUserId(userId);
  let essence = 0;
  let slots = DEFAULT_FARM_SLOTS;
  if (cleanId && supabase) {
    const { user } = await ensureUserInitialized(cleanId);
    essence = Number(user?.farm_essence || 0);
    slots = Number(user?.farm_slots_unlocked || DEFAULT_FARM_SLOTS);
  }

  const essIcon = farmEmoji('farm_essence');
  const lines = EXCHANGE_ITEMS.map((it) =>
    `• ${it.icon} **${it.name}** (\`${it.exchange_id}\`) — Giá: **${it.cost_essence}** ${essIcon} *(${it.description})*`,
  );

  return {
    success: true,
    farm_essence: essence,
    slots_unlocked: slots,
    max_slots: MAX_FARM_SLOTS,
    items: EXCHANGE_ITEMS,
    title: `${essIcon} CỬA HÀNG QUY ĐỔI LINH QUẢ TIÊN GIỚI (/exchange)`,
    description: [
      `• **Linh Quả Đang Có:** **${essence.toLocaleString('vi-VN')}** ${essIcon} • **Ô Canh Tác:** \`${slots}/${MAX_FARM_SLOTS}\``,
      '',
      ...lines,
    ].join('\n'),
    footer: '',
  };
}

export async function buyExchangeItem(userId, rawExchangeId, rawQty = 1, options = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID tu sĩ không hợp lệ.' };
  if (!supabase) return { success: false, status: 503, error: 'DB_UNAVAILABLE', message: 'Cơ sở dữ liệu chưa sẵn sàng.' };

  const needle = normalizeEssenceItemKey(rawExchangeId);
  const item = EXCHANGE_ITEM_BY_ID[needle];
  if (!item) {
    return {
      success: false,
      status: 404,
      error: 'EXCHANGE_ITEM_NOT_FOUND',
      message: `Không tìm thấy vật phẩm quy đổi '${rawExchangeId}'. Dùng \`/exchange\` để xem danh sách hợp lệ.`,
    };
  }

  const qty = Math.max(1, Math.min(50, Math.floor(Number(rawQty) || 1)));

  return withFarmLock(cleanId, async () => {
    const now = options.now instanceof Date ? options.now : new Date();
    const { user } = await ensureUserInitialized(cleanId, { username: options.username });
    if (!user) return { success: false, status: 500, error: 'USER_INIT_FAILED', message: 'Không thể khởi tạo hồ sơ.' };

    const curEssence = Number(user.farm_essence || 0);
    const totalCost = item.cost_essence * qty;
    if (curEssence < totalCost) {
      return {
        success: false,
        status: 400,
        error: 'INSUFFICIENT_FARM_ESSENCE',
        message: `Cần **${totalCost.toLocaleString('vi-VN')}** ${farmEmoji('farm_essence')} **Linh Quả Tiên Giới** để đổi **${qty}× ${item.name}** (hiện có **${curEssence.toLocaleString('vi-VN')}**).`,
      };
    }

    const nowIso = now.toISOString();
    const nextEssence = curEssence - totalCost;

    if (item.reward_kind === 'farm_slot') {
      const curSlots = Number(user.farm_slots_unlocked || DEFAULT_FARM_SLOTS);
      if (curSlots + qty > MAX_FARM_SLOTS) {
        return {
          success: false,
          status: 400,
          error: 'MAX_FARM_SLOTS',
          message: `Bạn đang mở **${curSlots}/${MAX_FARM_SLOTS}** ô canh tác (tối đa ${MAX_FARM_SLOTS} ô)!`,
        };
      }
      const nextSlots = curSlots + qty;
      await supabase.from('users').update({
        farm_essence: nextEssence,
        farm_slots_unlocked: nextSlots,
        updated_at: nowIso,
      }).eq('user_id', cleanId);
      await loadAndSyncPlots(cleanId, nextSlots, now);
      invalidateInventoryCache(cleanId);
      return {
        success: true,
        exchange_id: item.exchange_id,
        quantity: qty,
        farm_essence: nextEssence,
        slots_unlocked: nextSlots,
        message: `${item.icon} Đã mở khóa thêm **${qty} Ô Canh Tác** (Tổng: \`${nextSlots}/${MAX_FARM_SLOTS}\` ô) • Linh Quả còn lại: **${nextEssence.toLocaleString('vi-VN')}**!`,
      };
    }

    if (item.reward_kind === 'linh_thach') {
      const gainLt = item.reward_amount * qty;
      const nextBal = Number(user.linh_thach || 0) + gainLt;
      await supabase.from('users').update({
        farm_essence: nextEssence,
        linh_thach: nextBal,
        updated_at: nowIso,
      }).eq('user_id', cleanId);
      invalidateInventoryCache(cleanId);
      return {
        success: true,
        exchange_id: item.exchange_id,
        quantity: qty,
        reward_linh_thach: gainLt,
        linh_thach: nextBal,
        farm_essence: nextEssence,
        message: `${em('su_linhthach')} Quy đổi thành công **+${gainLt.toLocaleString('vi-VN')} Linh Thạch**! (Ví: **${nextBal.toLocaleString('vi-VN')} LT** • Linh Quả còn: **${nextEssence.toLocaleString('vi-VN')}**)`,
      };
    }

    // Inventory item (check stack cap if set)
    if (item.max_stack) {
      const { data: invRow } = await supabase
        .from('user_inventory')
        .select('quantity')
        .eq('user_id', cleanId)
        .eq('item_id', item.item_id)
        .maybeSingle();
      const curOwned = Number(invRow?.quantity || 0);
      if (curOwned + item.reward_amount * qty > item.max_stack) {
        return {
          success: false,
          status: 400,
          error: 'INVENTORY_STACK_LIMIT',
          message: `Bạn chỉ có thể giữ tối đa **${item.max_stack}** **${item.name}** trong túi (hiện có \`${curOwned}/${item.max_stack}\`)!`,
        };
      }
    }

    const totalGain = item.reward_amount * qty;
    const [, nextQty] = await Promise.all([
      supabase.from('users').update({ farm_essence: nextEssence, updated_at: nowIso }).eq('user_id', cleanId),
      addInventoryItem(cleanId, item.item_id, 'consumable', totalGain),
    ]);
    invalidateInventoryCache(cleanId);

    return {
      success: true,
      exchange_id: item.exchange_id,
      item_id: item.item_id,
      quantity: totalGain,
      inventory_quantity: nextQty,
      farm_essence: nextEssence,
      message: `${item.icon} Quy đổi thành công **+${totalGain} ${item.name}**! (Trong túi: \`${nextQty}\` • Linh Quả còn: **${nextEssence.toLocaleString('vi-VN')}**)`,
    };
  });
}

function normalizeEssenceItemKey(raw) {
  let s = String(raw || '').trim();
  const m = s.match(/^<a?:([a-zA-Z0-9_]+):\d+>$/) || s.match(/^:([a-zA-Z0-9_]+):$/);
  if (m) s = m[1];
  const lower = s.toLowerCase();
  if (EXCHANGE_ITEM_BY_ID[lower]) return lower;
  const clean = lower.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const found = EXCHANGE_ITEMS.find((it) => it.name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').includes(clean));
  return found ? found.exchange_id : lower;
}

const WILT_STAGE_META = {
  1: { type: 'wilt_60', label: 'Còn 1 giờ nữa là héo!' },
  2: { type: 'wilt_30', label: 'Còn 30 phút nữa là héo!' },
  3: { type: 'wilt_15', label: 'Còn 15 phút nữa là héo!' },
};

/**
 * Đánh giá trạng thái chuyển đổi & cảnh báo DM cho 1 ô Linh Điền / Linh Các đang trồng.
 */
export function evaluatePlotReminder(row, now = new Date()) {
  if (!row || !row.seed_id || row.status !== 'growing') {
    return { transitionStatus: null, alert: null };
  }

  const seed = FARM_SEED_BY_ID[row.seed_id];
  if (!seed) {
    return { transitionStatus: null, alert: null };
  }

  const nowMs = now.getTime();
  const { matureMs, wiltDeadlineMs, careDueMs } = computePlotTimings(row, seed, now);

  if (nowMs >= matureMs && matureMs <= wiltDeadlineMs) {
    return { transitionStatus: 'ready', alert: null };
  }
  if (nowMs >= wiltDeadlineMs) {
    return { transitionStatus: 'wilted', alert: null };
  }

  const remWiltMs = wiltDeadlineMs - nowMs;
  const remMatureMs = matureMs - nowMs;
  const isCac = row.plot_type === 'linh_cac';
  const plotLabel = isCac ? 'Linh Các' : 'Linh Điền';
  const curWiltStage = Number(row.dm_wilt_stage || 0);
  const careNotified = Boolean(row.dm_care_notified);
  const canWiltBeforeMature = wiltDeadlineMs < matureMs;

  if (canWiltBeforeMature && nowMs >= careDueMs) {
    let targetStage = 0;
    if (remWiltMs <= 15 * 60000) targetStage = 3;
    else if (remWiltMs <= 30 * 60000) targetStage = 2;
    else if (remWiltMs <= 60 * 60000) targetStage = 1;

    if (targetStage > curWiltStage) {
      const meta = WILT_STAGE_META[targetStage];
      return {
        transitionStatus: null,
        alert: {
          row_id: row.id,
          user_id: row.user_id,
          slot_index: row.slot_index,
          plot_type: row.plot_type,
          plot_label: plotLabel,
          type: meta.type,
          stage: targetStage,
          urgency_label: meta.label,
          next_dm_care_notified: true,
          next_dm_wilt_stage: targetStage,
          seed,
          rem_wilt_ms: remWiltMs,
          rem_mature_ms: remMatureMs,
        },
      };
    }
  }

  if (!careNotified && nowMs >= careDueMs) {
    return {
      transitionStatus: null,
      alert: {
        row_id: row.id,
        user_id: row.user_id,
        slot_index: row.slot_index,
        plot_type: row.plot_type,
        plot_label: plotLabel,
        type: 'care_due',
        stage: curWiltStage,
        urgency_label: isCac ? 'Đã tới giờ cho ăn / tưới chăm!' : 'Đã tới giờ tưới nước!',
        next_dm_care_notified: true,
        next_dm_wilt_stage: curWiltStage,
        seed,
        rem_wilt_ms: remWiltMs,
        rem_mature_ms: remMatureMs,
      },
    };
  }

  return { transitionStatus: null, alert: null };
}

function formatFarmDmPayload(userId, alerts, remainingUsers) {
  const hasUrgentWilt = alerts.some((a) => a.stage >= 2);
  const hasAnyWilt = alerts.some((a) => a.stage >= 1);
  const warnEm = uiEm('ui_warn');
  const clockEm = uiEm('ui_clock_timer');
  const sproutEm = farmEmoji('seed_linh_thao');

  const dmTitle = hasAnyWilt
    ? `${warnEm} CẢNH BÁO LINH ĐIỀN & LINH CÁC SẮP HÉO!`
    : `${sproutEm} ĐÃ TỚI GIỜ TƯỚI NƯỚC / CHĂM SÓC!`;

  const dmColor = hasUrgentWilt ? '#ef4444' : (hasAnyWilt ? '#f59e0b' : '#10b981');

  const lines = alerts.map((a) => {
    const remWiltTxt = formatDurationHm(Math.max(60000, a.rem_wilt_ms));
    const remMatureTxt = formatDurationHm(Math.max(60000, a.rem_mature_ms));
    const icon = a.seed?.icon || sproutEm;
    const name = a.seed?.name || a.plot_label;
    if (a.stage >= 1) {
      return `• **Ô #${a.slot_index} (${a.plot_label}):** ${icon} **${name}** — **${a.urgency_label}** *(Còn \`${remWiltTxt}\` • Chín sau \`${remMatureTxt}\`)*`;
    }
    return `• **Ô #${a.slot_index} (${a.plot_label}):** ${icon} **${name}** — **${a.urgency_label}** *(Héo sau \`${remWiltTxt}\` • Chín sau \`${remMatureTxt}\`)*`;
  });

  const dmDescription = [
    ...lines,
    '',
    `${clockEm} Dùng lệnh \`/farm\` (bấm nút **Tưới / Cho Ăn**) hoặc \`/farm hanh_dong:care\` trong server để chăm sóc ngay nhé!`,
  ].join('\n');

  return {
    success: true,
    has_notification: true,
    user_id: userId,
    dm_title: dmTitle,
    dm_description: dmDescription,
    dm_color: dmColor,
    remaining_users: remainingUsers,
    alerts: alerts.map((a) => ({
      slot_index: a.slot_index,
      plot_type: a.plot_type,
      plot_label: a.plot_label,
      type: a.type,
      stage: a.stage,
      seed_id: a.seed?.seed_id || null,
      seed_name: a.seed?.name || null,
    })),
  };
}

let dmClaimQueue = Promise.resolve();

export function evaluateFarmAutoProtect(row, protectQty, now = new Date()) {
  if (!row || row.status !== 'growing' || !row.seed_id || row.protected_this_cycle) {
    return { shouldProtect: false };
  }
  if (Number(protectQty || 0) <= 0) return { shouldProtect: false };
  const seed = FARM_SEED_BY_ID[row.seed_id];
  if (!seed) return { shouldProtect: false };
  const nowMs = now.getTime();
  const { matureMs, wiltDeadlineMs } = computePlotTimings(row, seed, now);
  if (nowMs >= matureMs) return { shouldProtect: false };
  const remWiltMs = wiltDeadlineMs - nowMs;
  if (remWiltMs > FARM_PROTECT_TRIGGER_WINDOW_MS) return { shouldProtect: false };
  const newLastCaredIso = new Date(new Date(row.last_cared_at || row.planted_at || now).getTime() + FARM_PROTECT_EXTENSION_MS).toISOString();
  return {
    shouldProtect: true,
    seed,
    newLastCaredIso,
  };
}

export async function activateFarmAutoCard(userId, options = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID không hợp lệ.' };
  if (!supabase) return { success: false, status: 503, error: 'DB_UNAVAILABLE', message: 'Cơ sở dữ liệu chưa sẵn sàng.' };

  return withFarmLock(cleanId, async () => {
    const now = options.now instanceof Date ? options.now : new Date();
    const { user } = await ensureUserInitialized(cleanId, { username: options.username });
    if (!options.skipInventoryCheck) {
      const { data: invRow } = await supabase
        .from('user_inventory')
        .select('quantity')
        .eq('user_id', cleanId)
        .eq('item_id', 'farm_auto_card')
        .maybeSingle();
      const qty = Number(invRow?.quantity || 0);
      if (qty <= 0) {
        return {
          success: false,
          status: 400,
          error: 'NO_ITEM',
          message: `Bạn không có ${em('farm_auto_card')} **Thẻ Tự Động Chăm Farm 24h**! Hãy mua ở \`/shop_dacbiet\` hoặc đi \`/explorer\`.`,
        };
      }
      await supabase
        .from('user_inventory')
        .update({ quantity: Math.max(0, qty - 1), updated_at: now.toISOString() })
        .eq('user_id', cleanId)
        .eq('item_id', 'farm_auto_card');
    }
    const baseMs = user?.farm_auto_until && new Date(user.farm_auto_until).getTime() > now.getTime()
      ? new Date(user.farm_auto_until).getTime()
      : now.getTime();
    const nextUntil = new Date(baseMs + FARM_AUTO_CARD_DURATION_MS).toISOString();
    await supabase.from('users').update({ farm_auto_until: nextUntil, updated_at: now.toISOString() }).eq('user_id', cleanId);
    const remHours = Math.round((new Date(nextUntil).getTime() - now.getTime()) / 3600000);
    return {
      success: true,
      item_id: 'farm_auto_card',
      farm_auto_until: nextUntil,
      message: `${em('farm_auto_card')} Đã kích hoạt **Thẻ Tự Động Chăm Farm 24h**! Bot sẽ tự tưới/cho ăn \`-30p\` và tự thu hoạch khi chín *(còn ~**${remHours} giờ** • Không tự trồng lại)*!`,
    };
  });
}

export async function useFarmGrowthMed(userId, options = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID không hợp lệ.' };
  if (!supabase) return { success: false, status: 503, error: 'DB_UNAVAILABLE', message: 'Cơ sở dữ liệu chưa sẵn sàng.' };

  return withFarmLock(cleanId, async () => {
    const now = options.now instanceof Date ? options.now : new Date();
    const nowIso = now.toISOString();
    const { user } = await ensureUserInitialized(cleanId, { username: options.username });
    if (!options.skipInventoryCheck) {
      const { data: invRow } = await supabase
        .from('user_inventory')
        .select('quantity')
        .eq('user_id', cleanId)
        .eq('item_id', 'farm_growth_med')
        .maybeSingle();
      const qty = Number(invRow?.quantity || 0);
      if (qty <= 0) {
        return { success: false, status: 400, error: 'NO_ITEM', message: `Bạn không có ${em('farm_growth_med')} **Thuốc Kích Thích Tăng Trưởng**!` };
      }
      await supabase
        .from('user_inventory')
        .update({ quantity: Math.max(0, qty - 1), updated_at: nowIso })
        .eq('user_id', cleanId)
        .eq('item_id', 'farm_growth_med');
    }

    const { plots } = await loadAndSyncPlots(cleanId, user?.farm_slots_unlocked, now);
    const growing = plots.filter((p) => p.computed_status === 'growing' && p.seed);
    if (growing.length > 0) {
      await Promise.all(growing.map((p) => {
        const shiftMs = Math.round(p.seed.growth_hours * 3600000 * FARM_GROWTH_MED_REDUCTION_RATE);
        const newPlantedMs = new Date(p.planted_at || nowIso).getTime() - shiftMs;
        const { careCount } = computePlotTimings(p, p.seed, now);
        const nextMatureMs = newPlantedMs + p.seed.growth_hours * 3600000 - careCount * FARM_CARE_SPEEDUP_MS;
        return supabase.from('user_farm_plots').update({
          planted_at: new Date(newPlantedMs).toISOString(),
          status: now.getTime() >= nextMatureMs ? 'ready' : 'growing',
          updated_at: nowIso,
        }).eq('id', p.id);
      }));
      return {
        success: true,
        item_id: 'farm_growth_med',
        affected_plots: growing.length,
        message: `${em('farm_growth_med')} Đã rải **Thuốc Kích Thích Tăng Trưởng (-25% thời gian chín)** lên **${growing.length} ô** đang phát triển!`,
      };
    }

    await supabase.from('users').update({ farm_growth_med_active: true, updated_at: nowIso }).eq('user_id', cleanId);
    return {
      success: true,
      item_id: 'farm_growth_med',
      queued_next_plant: true,
      message: `${em('farm_growth_med')} Đã chuẩn bị **Thuốc Kích Thích Tăng Trưởng (-25% thời gian chín)** cho vụ trồng/ấp trứng kế tiếp!`,
    };
  });
}

export async function useFarmYieldStarch(userId, options = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId) return { success: false, status: 400, error: 'INVALID_USER_ID', message: 'ID không hợp lệ.' };
  if (!supabase) return { success: false, status: 503, error: 'DB_UNAVAILABLE', message: 'Cơ sở dữ liệu chưa sẵn sàng.' };

  return withFarmLock(cleanId, async () => {
    const now = options.now instanceof Date ? options.now : new Date();
    const nowIso = now.toISOString();
    const { user } = await ensureUserInitialized(cleanId, { username: options.username });
    if (user?.farm_yield_starch_active) {
      return {
        success: false,
        status: 409,
        error: 'ALREADY_ACTIVE',
        message: `${em('farm_yield_starch')} Bạn đã bật sẵn **Bột Tăng Sản Lượng (+30% LT & Linh Quả)** cho lần thu hoạch tới rồi!`,
      };
    }
    if (!options.skipInventoryCheck) {
      const { data: invRow } = await supabase
        .from('user_inventory')
        .select('quantity')
        .eq('user_id', cleanId)
        .eq('item_id', 'farm_yield_starch')
        .maybeSingle();
      const qty = Number(invRow?.quantity || 0);
      if (qty <= 0) {
        return { success: false, status: 400, error: 'NO_ITEM', message: `Bạn không có ${em('farm_yield_starch')} **Bột Tăng Sản Lượng**!` };
      }
      await supabase
        .from('user_inventory')
        .update({ quantity: Math.max(0, qty - 1), updated_at: nowIso })
        .eq('user_id', cleanId)
        .eq('item_id', 'farm_yield_starch');
    }
    await supabase.from('users').update({ farm_yield_starch_active: true, updated_at: nowIso }).eq('user_id', cleanId);
    return {
      success: true,
      item_id: 'farm_yield_starch',
      message: `${em('farm_yield_starch')} Đã bật **Bột Tăng Sản Lượng**! Lần thu hoạch \`/farm\` kế tiếp nhận **+30% Linh Thạch & +30% Linh Quả**!`,
    };
  });
}

async function runFarmAutoProtectAndAutomation({ now = new Date(), userIds = null } = {}) {
  if (!supabase) return null;
  const nowIso = now.toISOString();
  const scopedSet = Array.isArray(userIds) && userIds.length > 0 ? new Set(userIds) : null;

  // 1. Auto-Rescue (Bùa Bảo Vệ Nông Trại +2h, tối đa 1 lần/chu kỳ)
  let growQ = supabase.from('user_farm_plots').select('*').eq('status', 'growing').eq('protected_this_cycle', false);
  if (scopedSet) growQ = growQ.in('user_id', [...scopedSet]);
  const { data: protectCandidates } = await growQ;
  const nearWiltUsers = [...new Set((protectCandidates || [])
    .filter((r) => evaluateFarmAutoProtect(r, 1, now).shouldProtect)
    .map((r) => r.user_id))];

  for (const uid of nearWiltUsers) {
    const rescuedDm = await withFarmLock(uid, async () => {
      const { data: invRow } = await supabase
        .from('user_inventory')
        .select('quantity')
        .eq('user_id', uid)
        .eq('item_id', 'farm_protect_card')
        .maybeSingle();
      let qty = Number(invRow?.quantity || 0);
      if (qty <= 0) return null;

      const { data: plots } = await supabase
        .from('user_farm_plots')
        .select('*')
        .eq('user_id', uid)
        .eq('status', 'growing')
        .eq('protected_this_cycle', false);

      const rescued = [];
      for (const p of plots || []) {
        const res = evaluateFarmAutoProtect(p, qty, now);
        if (!res.shouldProtect) continue;
        qty -= 1;
        rescued.push({ slot_index: p.slot_index, seed: res.seed });
        await supabase.from('user_farm_plots').update({
          last_cared_at: res.newLastCaredIso,
          protected_this_cycle: true,
          dm_wilt_stage: 0,
          updated_at: nowIso,
        }).eq('id', p.id);
      }
      if (rescued.length === 0) return null;
      await supabase
        .from('user_inventory')
        .update({ quantity: Math.max(0, qty), updated_at: nowIso })
        .eq('user_id', uid)
        .eq('item_id', 'farm_protect_card');

      return {
        success: true,
        has_notification: true,
        source: 'farm_protect',
        user_id: uid,
        dm_title: `${em('farm_protect_card')} BÙA BẢO VỆ NÔNG TRẠI ĐÃ CỨU ${rescued.length} Ô!`,
        dm_description: [
          ...rescued.map((r) => `• **Ô #${r.slot_index}:** ${r.seed.icon} **${r.seed.name}** đã được **gia hạn +2 giờ** trước khi héo!`),
          '',
          `${uiEm('ui_bulb_tip')} *Số Bùa Bảo Vệ còn lại: **${qty}** (Tối đa 1 lần cứu / chu kỳ).*`,
        ].join('\n'),
        dm_color: '#10b981',
        remaining_users: Math.max(0, nearWiltUsers.length - 1),
      };
    });
    if (rescuedDm) return rescuedDm;
  }

  // 2. Auto-Protect Lò Luyện Đan (nhanh tay cứu +2h trước cháy nổ)
  const alchemyRescue = await runAlchemyAutoProtect({ now, userIds }).catch(() => null);
  if (alchemyRescue?.has_notification) return alchemyRescue;

  // 3. Thẻ Tự Động Chăm Farm 24h (auto-tưới -30p & auto-thu hoạch, KHÔNG tự trồng lại)
  let autoQ = supabase.from('users').select('user_id, linh_thach, farm_essence, farm_slots_unlocked, farm_auto_until, farm_yield_starch_active').gt('farm_auto_until', nowIso);
  if (scopedSet) autoQ = autoQ.in('user_id', [...scopedSet]);
  const { data: autoUsers } = await autoQ;

  for (const au of autoUsers || []) {
    const autoDm = await withFarmLock(au.user_id, async () => {
      const { plots } = await loadAndSyncPlots(au.user_id, au.farm_slots_unlocked, now);
      const duePlots = plots.filter((p) => p.needs_care);
      let wateredSlots = [];
      if (duePlots.length > 0) {
        await Promise.all(duePlots.map((p) => {
          const nextCareCount = (Number(p.care_count) || 0) + 1;
          const plantedMs = new Date(p.planted_at || nowIso).getTime();
          const growthHours = Number(p.seed?.growth_hours || 0);
          const nextMatureMs = growthHours > 0
            ? Math.max(plantedMs, plantedMs + growthHours * 3600000 - nextCareCount * FARM_CARE_SPEEDUP_MS)
            : Infinity;
          return supabase.from('user_farm_plots').update({
            last_cared_at: nowIso,
            care_count: nextCareCount,
            status: now.getTime() >= nextMatureMs ? 'ready' : 'growing',
            dm_care_notified: false,
            dm_wilt_stage: 0,
            updated_at: nowIso,
          }).eq('id', p.id);
        }));
        wateredSlots = duePlots.map((p) => `#${p.slot_index}`);
      }

      const freshSnap = await loadAndSyncPlots(au.user_id, au.farm_slots_unlocked, now);
      const readyPlots = freshSnap.plots.filter((p) => p.computed_status === 'ready' && p.seed);
      let gainLt = 0;
      let gainEss = 0;
      if (readyPlots.length > 0) {
        for (const p of readyPlots) {
          gainLt += Number(p.seed.reward_lt) || 0;
          gainEss += Number(p.seed.reward_essence) || 0;
        }
        const starchActive = Boolean(au.farm_yield_starch_active);
        if (starchActive) {
          gainLt = Math.round(gainLt * (1 + FARM_YIELD_STARCH_BONUS_RATE));
          gainEss = Math.round(gainEss * (1 + FARM_YIELD_STARCH_BONUS_RATE));
        }
        await Promise.all([
          supabase.from('users').update({
            linh_thach: Number(au.linh_thach || 0) + gainLt,
            farm_essence: Number(au.farm_essence || 0) + gainEss,
            ...(starchActive ? { farm_yield_starch_active: false } : {}),
            updated_at: nowIso,
          }).eq('user_id', au.user_id),
          ...readyPlots.map((p) => supabase.from('user_farm_plots').update({
            seed_id: null,
            status: 'empty',
            planted_at: null,
            last_cared_at: null,
            care_count: 0,
            dm_care_notified: false,
            dm_wilt_stage: 0,
            protected_this_cycle: false,
            updated_at: nowIso,
          }).eq('id', p.id)),
        ]);
      }

      if (wateredSlots.length === 0 && readyPlots.length === 0) return null;
      const lines = [];
      if (wateredSlots.length > 0) {
        lines.push(`• ${em('su_el_thuy')} **Đã tự tưới/cho ăn (-30p):** Ô ${wateredSlots.join(', ')}`);
      }
      if (readyPlots.length > 0) {
        lines.push(`• ${farmEmoji('farm_essence')} **Đã tự thu hoạch (${readyPlots.length} ô):** **+${gainLt.toLocaleString('vi-VN')}** ${em('su_linhthach')} • **+${gainEss.toLocaleString('vi-VN')}** Linh Quả *(Vào \`/farm\` để gieo vụ mới)*`);
      }
      return {
        success: true,
        has_notification: true,
        source: 'farm_auto_card',
        user_id: au.user_id,
        dm_title: `${em('farm_auto_card')} QUẢN GIA NÔNG TRẠI TỰ ĐỘNG BÁO CÁO`,
        dm_description: lines.join('\n'),
        dm_color: '#10b981',
        remaining_users: 0,
      };
    });
    if (autoDm) return autoDm;
  }

  return null;
}

/**
 * Lấy & đánh dấu lô thông báo DM nông trại kế tiếp (gom theo từng người chơi).
 */
export async function claimNextFarmDmNotification(options = {}) {
  const runTask = async () => {
    if (!supabase) return { success: false, status: 503, error: 'DB_UNAVAILABLE', has_notification: false };
    const now = options.now instanceof Date ? options.now : new Date();
    const nowIso = now.toISOString();
    const scopedUserIds = Array.isArray(options.userIds)
      ? options.userIds.map((id) => String(id || '').trim()).filter((id) => /^\d{17,20}$/.test(id))
      : null;

    if (now.getTime() - Date.now() > 5 * 60000 && (!scopedUserIds || scopedUserIds.length === 0)) {
      throw new Error('REFUSED_FUTURE_CLOCK_WITHOUT_USER_SCOPE');
    }

    const preHookDm = await runFarmAutoProtectAndAutomation({ now, userIds: scopedUserIds });
    if (preHookDm?.has_notification) {
      return preHookDm;
    }

    let query = supabase
      .from('user_farm_plots')
      .select('*')
      .eq('status', 'growing')
      .order('user_id', { ascending: true })
      .order('slot_index', { ascending: true });
    if (scopedUserIds && scopedUserIds.length > 0) {
      query = query.in('user_id', scopedUserIds);
    }

    const { data: growingRows, error } = await query;

    if (error) {
      return { success: false, status: 500, error: error.message, has_notification: false };
    }

    const transitions = [];
    const candidateUsers = new Set();

    for (const row of growingRows || []) {
      const ev = evaluatePlotReminder(row, now);
      if (ev.transitionStatus && row.id) {
        transitions.push(
          supabase
            .from('user_farm_plots')
            .update({ status: ev.transitionStatus, updated_at: nowIso })
            .eq('id', row.id),
        );
      } else if (ev.alert) {
        candidateUsers.add(row.user_id);
      }
    }

    if (transitions.length > 0) {
      await Promise.all(transitions);
    }

    const userIds = Array.from(candidateUsers);
    for (let idx = 0; idx < userIds.length; idx += 1) {
      const targetUid = userIds[idx];
      const claimed = await withFarmLock(targetUid, async () => {
        const { data: userRows } = await supabase
          .from('user_farm_plots')
          .select('*')
          .eq('user_id', targetUid)
          .eq('status', 'growing')
          .order('slot_index', { ascending: true });

        const freshAlerts = [];
        for (const r of userRows || []) {
          const ev = evaluatePlotReminder(r, now);
          if (ev.alert) freshAlerts.push(ev.alert);
        }
        if (freshAlerts.length === 0) return null;

        await Promise.all(
          freshAlerts.map((a) =>
            supabase
              .from('user_farm_plots')
              .update({
                dm_care_notified: a.next_dm_care_notified,
                dm_wilt_stage: a.next_dm_wilt_stage,
                updated_at: nowIso,
              })
              .eq('id', a.row_id),
          ),
        );

        return formatFarmDmPayload(targetUid, freshAlerts, Math.max(0, userIds.length - idx - 1));
      });

      if (claimed) return claimed;
    }

    const alchemyDm = await claimNextAlchemyDmNotification({
      now,
      ...(scopedUserIds && scopedUserIds.length > 0 ? { userIds: scopedUserIds } : {}),
    }).catch(() => null);
    if (alchemyDm?.has_notification) {
      return {
        ...alchemyDm,
        synced_transitions: transitions.length,
      };
    }

    return {
      success: true,
      has_notification: false,
      synced_transitions: transitions.length,
      remaining_users: 0,
    };
  };

  const nextRun = dmClaimQueue.then(runTask, runTask);
  dmClaimQueue = nextRun.catch(() => null);
  return nextRun;
}
