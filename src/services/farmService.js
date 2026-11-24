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

const MAX_FARM_SLOTS = 6;
const DEFAULT_FARM_SLOTS = 4;

const SLOT_TYPES_BY_INDEX = {
  1: 'linh_dien',
  2: 'linh_dien',
  3: 'linh_cac',
  4: 'linh_cac',
  5: 'linh_dien',
  6: 'linh_cac',
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

function computePlotSnapshot(row, now) {
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
  const plantedMs = new Date(row.planted_at || now).getTime();
  const lastCaredMs = new Date(row.last_cared_at || row.planted_at || now).getTime();
  const matureMs = plantedMs + seed.growth_hours * 3600000;
  const wiltDeadlineMs = lastCaredMs + seed.wilt_hours * 3600000;
  const careDueMs = lastCaredMs + seed.care_interval_hours * 3600000;

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
  if (linhDienPlots.length < 3) {
    linhDienLines.push(`• ${lockEm} **Ô #5:** Chưa mở khóa *(Đổi tại \`/exchange\`)*`);
  }

  const linhCacLines = linhCacPlots.map((p) => `• ${p.summary}`);
  if (linhCacPlots.length < 3) {
    linhCacLines.push(`• ${lockEm} **Ô #6:** Chưa mở khóa *(Đổi tại \`/exchange\`)*`);
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
    plots,
    title: `${essenceIcon} LINH ĐIỀN & LINH THÚ CÁC — ${user.username}`,
    description: [
      `• **Số Dư:** **${bal.toLocaleString('vi-VN')}** ${ltIcon} • **Linh Quả Tiên Giới:** **${essence.toLocaleString('vi-VN')}** ${essenceIcon}`,
      `• **Linh Điền:** \`${linhDienPlots.length}/3\` • **Linh Các:** \`${linhCacPlots.length}/3\` *(Tổng \`${cap}/${MAX_FARM_SLOTS}\` ô • Tự động DM nhắc tưới & cảnh báo héo 1h/30p/15p)*`,
      '',
      `**${farmEmoji('seed_linh_thao')} KHU LINH ĐIỀN (${linhDienPlots.length}/3 ô):**`,
      ...linhDienLines,
      '────────────────────────',
      `**${farmEmoji('egg_linh_thu')} KHU LINH THÚ CÁC (${linhCacPlots.length}/3 ô):**`,
      ...linhCacLines,
      '────────────────────────',
      '**Bảng Giống & Trứng Thời Gian Thực (`/farm gieo <ma_giong>`):**',
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
    await Promise.all([
      supabase.from('users').update({ linh_thach: nextBal, updated_at: nowIso }).eq('user_id', cleanId),
      supabase.from('user_farm_plots').update({
        seed_id: seed.seed_id,
        status: 'growing',
        planted_at: nowIso,
        last_cared_at: nowIso,
        care_count: 0,
        dm_care_notified: false,
        dm_wilt_stage: 0,
        updated_at: nowIso,
      }).eq('id', targetPlot.id),
      trackQuestActivity(cleanId, { farmDelta: 1, now }),
    ]);

    return {
      success: true,
      slot_index: targetPlot.slot_index,
      seed_id: seed.seed_id,
      seed_name: seed.name,
      cost_lt: seed.cost_lt,
      linh_thach: nextBal,
      message: `${seed.icon} Đã đặt **${seed.name}** vào **Ô #${targetPlot.slot_index} (${seed.plot_label})**!\n• Thời gian trưởng thành: **${seed.growth_hours} giờ** • Nhắc chăm sóc: **${seed.care_window}**\n• Số dư còn lại: **${nextBal.toLocaleString('vi-VN')}** ${em('su_linhthach')}`,
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
    await Promise.all([
      ...duePlots.map((p) =>
        supabase.from('user_farm_plots').update({
          last_cared_at: nowIso,
          care_count: (Number(p.care_count) || 0) + 1,
          dm_care_notified: false,
          dm_wilt_stage: 0,
          updated_at: nowIso,
        }).eq('id', p.id),
      ),
      trackQuestActivity(cleanId, { farmDelta: 1, now }),
    ]);

    return {
      success: true,
      cared_count: duePlots.length,
      slots: duePlots.map((p) => p.slot_index),
      message: `${em('su_el_thuy')} Đã tưới Linh Tuyền & cho ăn thành công cho **${duePlots.length} ô** (${duePlots.map((p) => `#${p.slot_index}`).join(', ')})! Đồng hồ sinh trưởng được gia cố an toàn.`,
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

    const nextBal = Number(user.linh_thach || 0) + gainLt;
    const nextEssence = Number(user.farm_essence || 0) + gainEssence;
    const nowIso = now.toISOString();

    await Promise.all([
      supabase.from('users').update({
        linh_thach: nextBal,
        farm_essence: nextEssence,
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
          updated_at: nowIso,
        }).eq('id', p.id),
      ),
      trackQuestActivity(cleanId, { farmDelta: 1, now }),
    ]);

    const essIcon = farmEmoji('farm_essence');
    return {
      success: true,
      harvested_count: readyPlots.length,
      reward_linh_thach: gainLt,
      reward_essence: gainEssence,
      linh_thach: nextBal,
      farm_essence: nextEssence,
      message: `${essIcon} **THU HOẠCH NÔNG TRẠI THÀNH CÔNG (${readyPlots.length} Ô)!**\n• Thu về: **+${gainLt.toLocaleString('vi-VN')}** ${em('su_linhthach')} • **+${gainEssence.toLocaleString('vi-VN')}** ${essIcon} **Linh Quả Tiên Giới**\n• Kho hiện tại: **${nextBal.toLocaleString('vi-VN')} LT** • **${nextEssence.toLocaleString('vi-VN')} Linh Quả** *(Dùng tại \`/exchange\`)*`,
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

  const qty = Math.max(1, Math.min(20, Math.floor(Number(rawQty) || 1)));

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
  const plantedMs = new Date(row.planted_at || now).getTime();
  const lastCaredMs = new Date(row.last_cared_at || row.planted_at || now).getTime();
  const matureMs = plantedMs + seed.growth_hours * 3600000;
  const wiltDeadlineMs = lastCaredMs + seed.wilt_hours * 3600000;
  const careDueMs = lastCaredMs + seed.care_interval_hours * 3600000;

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

/**
 * Lấy & đánh dấu lô thông báo DM nông trại kế tiếp (gom theo từng người chơi).
 */
export async function claimNextFarmDmNotification(options = {}) {
  const runTask = async () => {
    if (!supabase) return { success: false, status: 503, error: 'DB_UNAVAILABLE', has_notification: false };
    const now = options.now instanceof Date ? options.now : new Date();
    const nowIso = now.toISOString();

    const { data: growingRows, error } = await supabase
      .from('user_farm_plots')
      .select('*')
      .eq('status', 'growing')
      .order('user_id', { ascending: true })
      .order('slot_index', { ascending: true });

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
