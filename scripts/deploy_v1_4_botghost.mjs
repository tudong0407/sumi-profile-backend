/**
 * scripts/deploy_v1_4_botghost.mjs
 * Xây dựng, kiểm định offline DAG & bảo mật, và deploy toàn bộ lệnh & event v1.4 lên BotGhost qua Edge CDP (9222):
 * - NEW /party (0 tham số bắt buộc • Tổ Đội 3 người • Button + Dropdown)
 * - NEW /linhmach (0 tham số bắt buộc • Chiếm Đoạt Linh Mạch • Chiến Báo Canvas 3v3/3vBoss)
 * - NEW /explorer (0 tham số bắt buộc • Bản Đồ 4K 12 địa danh • Dropdown Thời Gian -> Map -> Thức Ăn + Chỉnh Loadout)
 * - UPGRADED /slots (dừng từng ô trái -> phải 4 khung hình cách 1s)
 * - FIXED /crash & /blackjack (Unrolled In-Place Edit giữ nguyên nút bấm, không gửi tin nhắn mới)
 * - OVERHAULED /giatoc (Overview + Nút & Dropdown Duyệt Đơn / Quản Lý Thành Viên edit tại chỗ)
 * - PATCHED /shop (thêm nút Shop Ngày #1..#10 + 4 vật phẩm Khám Phá), /enchant (Đá Khắc Ấn Tuyệt Đối),
 *   /updates (v1.4), /wiki (v1.4), Nhiễm Nhiễm — AI Mention (v1.4, 0 rò rỉ tỉ lệ minigame),
 *   SuMi — Render Keep-Alive (12m) (tự tất toán Linh Mạch + tự vinh danh Top 10 Lực Chiến 19:00 Chủ Nhật vào 1033227438735507488).
 */

import WebSocket from 'ws';
globalThis.WebSocket = WebSocket;

import fs from 'node:fs';
import LZString from 'lz-string';
import {
  GraphBuilder,
  attachUpdateAckBranch,
  cdpEval,
  deployViaCDP,
  validateGraph,
  validateRegexSafety,
} from './ga_builder_lib.mjs';
import { em, emId } from '../src/config/emojiHelper.js';
import { SHOP_CONSUMABLES } from '../src/data/catalog.js';
import { V14_EXPLORER_MAPS } from '../src/data/v14ExpansionCatalog.js';

const PROFILE_GROUP_ID = '1782127263978';
const BACKEND_BASE = 'https://sumi-profile-backend.onrender.com';
const WEEKLY_ANNOUNCE_CHANNEL_ID = '1033227438735507488';

const CUSTOM_EMOJIS_RAW = JSON.parse(
  fs.readFileSync(new URL('../src/config/custom_emojis.json', import.meta.url), 'utf8'),
);

function uidEm(name, fallback = '') {
  const row = CUSTOM_EMOJIS_RAW[name];
  if (row?.id) return row.animated ? `<a:${row.name}:${row.id}>` : `<:${row.name}:${row.id}>`;
  return em(name) || fallback;
}

function uidId(name, fallbackKey = 'su_sparkle') {
  return CUSTOM_EMOJIS_RAW[name]?.id || emId(fallbackKey);
}

class V14GraphBuilder extends GraphBuilder {
  advSelectMenu(id, parentMsgId, {
    placeholder,
    customVariableName,
    basic_options,
    row = '1',
    weight = '1',
    showReplies = 'show',
  }, { x = 0, y = 0 } = {}) {
    if (!Array.isArray(basic_options) || basic_options.length === 0 || basic_options.length > 25) {
      throw new Error(`Select menu "${id}" must have 1..25 options (got ${basic_options?.length})`);
    }
    this._addNode({
      id,
      type: 'advMessageSelectMenu',
      draggable: true,
      position: { x, y },
      width: 280,
      height: 90,
      data: {
        node_options: {},
        data: {
          type: 'adv_select_menu',
          menu_type: 'basic',
          placeholder: String(placeholder || 'Chọn một mục...').slice(0, 140),
          multiselect: false,
          minOptions: '1',
          maxOptions: '1',
          basic_options: basic_options.map((opt) => ({
            label: String(opt.label).slice(0, 95),
            description: String(opt.description || '').slice(0, 95),
            emoji_id: opt.emoji_id ? String(opt.emoji_id) : '',
            value: String(opt.value).slice(0, 95),
          })),
          type_options: {},
          options: [],
          orderComponent: true,
          row: String(row),
          weight: String(weight),
          showReplies,
          validated: true,
          customVariableName,
        },
      },
    });
    this._addEdge({
      source: parentMsgId,
      sourceHandle: 'components_source',
      target: id,
      type: 'step',
      animated: false,
      arrowHeadType: 'arrowclosed',
      id: `reactflow__edge-${parentMsgId}components_source-${id}`,
    });
    return id;
  }
}

function assertAcyclicDAG(elements, label) {
  const adj = new Map();
  const nodes = new Set();
  for (const el of elements) {
    if (el.source && el.target) {
      if (!adj.has(el.source)) adj.set(el.source, []);
      adj.get(el.source).push(el.target);
    } else if (el?.id) {
      nodes.add(el.id);
    }
  }
  const state = new Map();
  const dfs = (u, stack) => {
    state.set(u, 1);
    for (const v of adj.get(u) || []) {
      if (state.get(v) === 1) throw new Error(`Cycle detected in ${label}: ${[...stack, v].join(' -> ')}`);
      if (!state.get(v)) dfs(v, [...stack, v]);
    }
    state.set(u, 2);
  };
  for (const n of nodes) if (!state.get(n)) dfs(n, [n]);
}

function assertUniqueApiActionNames(elements, label) {
  const seen = new Map();
  for (const el of elements) {
    if (el.type === 'api_action' || el.data?.data?.type === 'api_action' || (el.data?.data?.request_options && el.data?.data?.name)) {
      const name = String(el.data?.data?.name || '').trim();
      if (!name) throw new Error(`Empty api_action variable name in ${label} (${el.id})`);
      if (seen.has(name)) throw new Error(`Duplicate api_action variable name "${name}" in ${label}: ${seen.get(name)} and ${el.id}`);
      seen.set(name, el.id);
    }
  }
}

function assertSelectLimitsAndRegex(elements, label) {
  for (const el of elements) {
    const dt = el?.data?.data;
    if (dt?.type === 'adv_select_menu') {
      const opts = dt.basic_options || [];
      if (opts.length > 25) throw new Error(`Select "${el.id}" in ${label} exceeds 25 options (${opts.length})`);
    }
    if (dt?.type === 'matches_pattern') {
      const pat = String(dt.comparison_value ?? '');
      if (!validateRegexSafety(pat)) throw new Error(`Unsafe/invalid matches_pattern regex in ${label} (${el.id}): ${pat}`);
    }
  }
}

function apiAction(gb, id, name, method, url, rawBody = '', pos = { x: 0, y: 0 }) {
  const isPost = method === 'POST';
  return gb.act(id, 'api_action', {
    name,
    ephemeral: false,
    request_options: {
      method,
      url,
      headers: isPost
        ? [{ key: 'Content-Type', value: 'application/json' }, { key: 'x-api-key', value: '{SECRET_BACKEND_KEY}' }]
        : [],
      params: [],
      body: [],
      rawBody,
      contentType: 'application/json',
      options: {
        excludeEmptyFields: true,
        replaceParams: true,
        replaceURL: true,
        replaceHeaders: true,
        replaceBody: true,
        ...(isPost ? { jsonSafeVariables: true, bodyMode: 'raw', contentType: 'application/json' } : {}),
        failOnError: false,
      },
    },
    success_handles: false,
  }, pos);
}

function embedMsg(gb, id, {
  title,
  description = '',
  color = '#ec4899',
  imageUrl = '',
  footer = 'SuMi Family • Tu Tiên Giới v1.4',
  target = { reply: true },
  editId = undefined,
  action_id = undefined,
}, pos = { x: 0, y: 0 }) {
  const data = {
    messageType: 'basic',
    useComponentsV2: false,
    target,
    success_handles: false,
    message: {
      content: '',
      embeds: [{
        title,
        description,
        color,
        url: '',
        thumbnail: { url: '' },
        image: { url: imageUrl },
        footer: { text: footer, icon_url: '' },
      }],
    },
    components: [],
    componentsV2Data: null,
    reactions: '',
  };
  if (editId) data.editId = editId;
  if (action_id) data.action_id = action_id;
  return gb.act(id, 'advanced_message', data, pos);
}

function btnCfg(label, style, emojiName, row = '1', weight = '1', animated = false) {
  return {
    label,
    style,
    emoji: { id: uidId(emojiName), name: emojiName, animated },
    emoji_id: uidId(emojiName),
    orderComponent: true,
    row,
    weight,
    showReplies: 'show',
  };
}

function makeSlotOptions(count = 15, prefix = 'Mục', includeClear = false) {
  const opts = [];
  if (includeClear) {
    opts.push({ label: '0 • Tháo / Bỏ Trống', description: 'Gỡ trang bị khỏi ô này', value: '0', emoji_id: uidId('su_sparkle') });
  }
  for (let i = 1; i <= count; i += 1) {
    opts.push({
      label: `#${i} • Chọn ${prefix} số ${i}`,
      description: `Chọn đúng dòng #${i} hiển thị trong bảng phía trên`,
      value: String(i),
      emoji_id: uidId('su_sparkle'),
    });
  }
  return opts;
}

// ============================================================================
// 1. /slots — Dừng từng ô từ trái sang phải (4 khung hình cách 1s)
// ============================================================================
export function buildSlotsV14Cmd() {
  const gb = new V14GraphBuilder();
  gb.rootSlash('slots', 'Quay Máy Tứ Bảo 4 Ô Tiên Giới — dừng từng ô trái sang phải (10 – 10.000 LT)', { ephemeral: false });
  gb.errorHandlerWait();
  gb.option('cuoc', 'int', 'Số Linh Thạch đặt cược (10 – 10.000 LT)', { required: true, x: 420, y: 0 });

  embedMsg(gb, 'sl_ack', {
    title: `${uidEm('slot_spin')} Đang kéo Cần Quay Tứ Bảo...`,
    description: 'Đang nạp `{option_cuoc}` Linh Thạch...',
    color: '#a855f7',
    editId: 'sl_ack',
  }, { x: 0, y: 200 });
  gb.link('root', 'sl_ack');

  apiAction(gb, 'sl_api', 'sl_res', 'POST', `${BACKEND_BASE}/api/minigame/slots`,
    '{"userId":"{user_id}","bet":"{option_cuoc}","username":"{user_displayName}","fallbackUsername":"{user_displayName}","avatarUrl":"{user_icon}"}',
    { x: 0, y: 380 });
  gb.link('sl_ack', 'sl_api');

  const slNoAck = attachUpdateAckBranch(gb, 'sl', 'sl_api', 'sl_res', { editId: 'sl_ack', x: 0, y: 560 });
  const cSlOk = gb.cmp('sl_ok', '{sl_res.response.success}', 'true', 'equal_to', { ignoreCase: true }, { x: 0, y: 740 });
  gb.link(slNoAck, cSlOk.condId);

  const frames = [
    { id: 'sl_f0', waitId: 'sl_w0', key: 'spin_embed', y: 920 },
    { id: 'sl_f1', waitId: 'sl_w1', key: 'frame_1_embed', y: 1200 },
    { id: 'sl_f2', waitId: 'sl_w2', key: 'frame_2_embed', y: 1480 },
    { id: 'sl_f3', waitId: 'sl_w3', key: 'frame_3_embed', y: 1760 },
  ];

  let prevId = cSlOk.yes;
  for (const f of frames) {
    embedMsg(gb, f.id, {
      title: `{sl_res.response.${f.key}.title}`,
      description: `{sl_res.response.${f.key}.description}`,
      color: '#a855f7',
      target: { editId: 'sl_ack' },
      action_id: 'sl_ack',
    }, { x: -200, y: f.y });
    gb.link(prevId, f.id);

    gb.act(f.waitId, 'wait_action', { seconds: '1', success_handles: false }, { x: -200, y: f.y + 140 });
    gb.link(f.id, f.waitId);
    prevId = f.waitId;
  }

  embedMsg(gb, 'sl_final_edit', {
    title: '{sl_res.response.result_embed.title}',
    description: '{sl_res.response.result_embed.description}',
    color: '#ec4899',
    target: { editId: 'sl_ack' },
    action_id: 'sl_ack',
  }, { x: -200, y: 2040 });
  gb.link(prevId, 'sl_final_edit');

  embedMsg(gb, 'sl_err_edit', {
    title: `${uidEm('slot_spin')} MÁY QUAY TỨ BẢO TIÊN GIỚI`,
    description: '{sl_res.response.message}',
    color: '#f43f5e',
    target: { editId: 'sl_ack' },
    action_id: 'sl_ack',
  }, { x: 240, y: 920 });
  gb.link(cSlOk.no, 'sl_err_edit');

  return gb.elements();
}

// ============================================================================
// 2. /crash — Edit tại chỗ giữ nguyên nút [Rút Tiền Ngay] + [Bay Tiếp] (5 bậc unrolled)
// ============================================================================
export function buildCrashV14Cmd() {
  const gb = new V14GraphBuilder();
  gb.rootSlash('crash', 'Phi Kiếm Độ Kiếp — Chốt lời tại chỗ không spam tin mới (10 – 10.000 LT)', { ephemeral: false });
  gb.errorHandlerWait();
  gb.option('cuoc', 'int', 'Số Linh Thạch đặt cược (10 – 10.000 LT)', { required: true, x: 420, y: 0 });
  gb.option('muc_rut', 'string', 'Hệ số tự động chốt lời (vd: 1.5, 2.0 • bỏ trống để tự bấm)', { required: false, x: 700, y: 0 });

  embedMsg(gb, 'cr_ack', {
    title: `${uidEm('crash_fly')} Đang khai mở Phi Kiếm Độ Kiếp...`,
    description: 'Đang nạp `{option_cuoc}` Linh Thạch cho chuyến bay...',
    color: '#38bdf8',
    editId: 'cr_ack',
  }, { x: 0, y: 200 });
  gb.link('root', 'cr_ack');

  apiAction(gb, 'cr_api', 'cr_res', 'POST', `${BACKEND_BASE}/api/minigame/crash`,
    '{"userId":"{user_id}","bet":"{option_cuoc}","autoCashout":"{option_muc_rut}","username":"{user_displayName}","fallbackUsername":"{user_displayName}","avatarUrl":"{user_icon}"}',
    { x: 0, y: 380 });
  gb.link('cr_ack', 'cr_api');

  const crNoAck = attachUpdateAckBranch(gb, 'cr', 'cr_api', 'cr_res', { editId: 'cr_ack', x: 0, y: 560 });
  const cCrOk = gb.cmp('cr_ok', '{cr_res.response.success}', 'true', 'equal_to', { ignoreCase: true }, { x: 0, y: 740 });
  gb.link(crNoAck, cCrOk.condId);

  embedMsg(gb, 'cr_err_edit', {
    title: `${uidEm('crash_boom')} PHI KIẾM ĐỘ KIẾP`,
    description: '{cr_res.response.message}',
    color: '#f43f5e',
    target: { editId: 'cr_ack' },
    action_id: 'cr_ack',
  }, { x: 380, y: 920 });
  gb.link(cCrOk.no, 'cr_err_edit');

  const cCrFin = gb.cmp('cr_fin', '{cr_res.response.finished}', 'true', 'equal_to', { ignoreCase: true }, { x: -160, y: 920 });
  gb.link(cCrOk.yes, cCrFin.condId);

  embedMsg(gb, 'cr_auto_edit', {
    title: '{cr_res.response.embed.title}',
    description: '{cr_res.response.embed.description}',
    color: '#10b981',
    target: { editId: 'cr_ack' },
    action_id: 'cr_ack',
  }, { x: -420, y: 1120 });
  gb.link(cCrFin.yes, 'cr_auto_edit');

  // Unroll 5 flight steps so every click edits cr_ack IN-PLACE and keeps both buttons alive!
  embedMsg(gb, 'cr_play_0', {
    title: '{cr_res.response.embed.title}',
    description: '{cr_res.response.embed.description}',
    color: '#38bdf8',
    footer: 'Bấm Bay Tiếp để tăng hệ số hoặc Rút Tiền Ngay (cập nhật ngay tại bảng này)',
    target: { editId: 'cr_ack' },
    action_id: 'cr_ack',
  }, { x: 0, y: 1120 });
  gb.link(cCrFin.no, 'cr_play_0');

  let curPlayMsg = 'cr_play_0';
  const MAX_STEPS = 5;
  for (let s = 1; s <= MAX_STEPS; s += 1) {
    const baseY = 1120 + s * 620;

    // Cashout button on curPlayMsg -> edit cr_ack in-place & remove buttons
    const bCash = `cr_s${s}_cash_btn`;
    const apiCash = `cr_s${s}_cash_api`;
    const resCash = `cr_s${s}_cash_res`;
    gb.advBtn(bCash, curPlayMsg, btnCfg('Rút Tiền Ngay', 'SUCCESS', 'su_winner_trophy', '1', '1', true), { x: 260, y: baseY - 420 });
    apiAction(gb, apiCash, resCash, 'POST', `${BACKEND_BASE}/api/minigame/crash`,
      '{"userId":"{user_id}","action":"cashout","username":"{user_displayName}","fallbackUsername":"{user_displayName}","avatarUrl":"{user_icon}"}',
      { x: 260, y: baseY - 260 });
    gb.link(bCash, apiCash);
    embedMsg(gb, `cr_s${s}_cash_edit`, {
      title: `{${resCash}.response.embed.title}`,
      description: `{${resCash}.response.embed.description}`,
      color: '#10b981',
      target: { editId: 'cr_ack' },
      action_id: 'cr_ack',
    }, { x: 260, y: baseY - 100 });
    gb.link(apiCash, `cr_s${s}_cash_edit`);

    // Step button on curPlayMsg -> edit cr_ack in-place (with buttons if still flying, without if finished!)
    const bStep = `cr_s${s}_step_btn`;
    const apiStep = `cr_s${s}_step_api`;
    const resStep = `cr_s${s}_step_res`;
    gb.advBtn(bStep, curPlayMsg, btnCfg('Bay Tiếp', 'PRIMARY', 'crash_fly', '1', '2', true), { x: -200, y: baseY - 420 });
    apiAction(gb, apiStep, resStep, 'POST', `${BACKEND_BASE}/api/minigame/crash`,
      '{"userId":"{user_id}","action":"step","username":"{user_displayName}","fallbackUsername":"{user_displayName}","avatarUrl":"{user_icon}"}',
      { x: -200, y: baseY - 260 });
    gb.link(bStep, apiStep);

    const cFin = gb.cmp(`cr_s${s}_fin`, `{${resStep}.response.finished}`, 'true', 'equal_to', { ignoreCase: true }, { x: -200, y: baseY - 100 });
    gb.link(apiStep, cFin.condId);

    embedMsg(gb, `cr_s${s}_end_edit`, {
      title: `{${resStep}.response.embed.title}`,
      description: `{${resStep}.response.embed.description}`,
      color: '#f43f5e',
      target: { editId: 'cr_ack' },
      action_id: 'cr_ack',
    }, { x: -440, y: baseY + 60 });
    gb.link(cFin.yes, `cr_s${s}_end_edit`);

    const nextPlayMsg = `cr_play_${s}`;
    embedMsg(gb, nextPlayMsg, {
      title: `{${resStep}.response.embed.title}`,
      description: `{${resStep}.response.embed.description}`,
      color: '#38bdf8',
      footer: 'Bấm Bay Tiếp để tăng hệ số hoặc Rút Tiền Ngay (cập nhật ngay tại bảng này)',
      target: { editId: 'cr_ack' },
      action_id: 'cr_ack',
    }, { x: 0, y: baseY + 60 });
    gb.link(cFin.no, nextPlayMsg);
    curPlayMsg = nextPlayMsg;
  }

  return gb.elements();
}

// ============================================================================
// 3. /giatoc — Tái cấu trúc gọn sang Nút + Dropdown Edit Tại Chỗ
// ============================================================================
export function buildGiatocV14Cmd() {
  const gb = new V14GraphBuilder();
  gb.rootSlash('giatoc', 'Trung Tâm Gia Tộc — Quản lý Thành Viên, Duyệt Đơn & Bang Chiến trực quan bằng nút bấm', { ephemeral: false });
  gb.errorHandlerWait();
  gb.option('hanh_dong', 'string', '(Tùy chọn nhanh) Lập tộc / Góp quỹ / Gửi chiến thư — bỏ trống để mở bảng điều khiển', {
    required: false,
    choices: ['overview', 'create', 'donate', 'join', 'war_declare'],
    x: 420,
    y: 0,
  });
  gb.option('ten_hoac_ma', 'string', 'Tên/Mã Gia Tộc (khi lập tộc, xin vào hoặc gửi chiến thư)', { required: false, x: 700, y: 0 });
  gb.option('so_luong', 'int', 'Số Linh Thạch (khi góp quỹ hoặc đặt cược Bang Chiến)', { required: false, x: 980, y: 0 });

  embedMsg(gb, 'gt_ack', {
    title: `${uidEm('su_clan_castle')} Đang tải Trung Tâm Gia Tộc...`,
    description: 'Vui lòng chờ trong giây lát...',
    color: '#a855f7',
    editId: 'gt_ack',
  }, { x: 0, y: 200 });
  gb.link('root', 'gt_ack');

  const cMode = gb.cond('gt_mode', 'comparison', { base_value: '{option_hanh_dong}', target: { self: true } }, { x: 0, y: 380 });
  gb.link('gt_ack', cMode);

  // Quick slash branches: create, donate, join, war_declare
  const quickSpecs = [
    { val: 'create', id: 'gt_cr', url: `${BACKEND_BASE}/api/clan/create`, body: '{"userId":"{user_id}","clanName":"{option_ten_hoac_ma}","username":"{user_displayName}"}', x: -750 },
    { val: 'donate', id: 'gt_dn', url: `${BACKEND_BASE}/api/clan/donate`, body: '{"userId":"{user_id}","amount":"{option_so_luong}","username":"{user_displayName}"}', x: -450 },
    { val: 'join', id: 'gt_jn', url: `${BACKEND_BASE}/api/clan/join`, body: '{"userId":"{user_id}","clanQuery":"{option_ten_hoac_ma}","username":"{user_displayName}"}', x: -150 },
    { val: 'war_declare', id: 'gt_wd', url: `${BACKEND_BASE}/api/clan/war/declare`, body: '{"userId":"{user_id}","targetClan":"{option_ten_hoac_ma}","betAmount":"{option_so_luong}"}', x: 150 },
  ];
  for (const q of quickSpecs) {
    const br = gb.branch(cMode, `${q.id}_br`, 'comparison', { type: 'equal_to', comparison_value: q.val, ignoreCase: true }, { x: q.x, y: 540 });
    apiAction(gb, `${q.id}_api`, `${q.id}_res`, 'POST', q.url, q.body, { x: q.x, y: 700 });
    gb.link(br, `${q.id}_api`);
    embedMsg(gb, `${q.id}_edit`, {
      title: `${uidEm('su_clan_castle')} GIA TỘC SUMI FAMILY`,
      description: `{${q.id}_res.response.message}`,
      color: '#ec4899',
      target: { editId: 'gt_ack' },
      action_id: 'gt_ack',
    }, { x: q.x, y: 860 });
    gb.link(`${q.id}_api`, `${q.id}_edit`);
  }

  // Default interactive Overview Hub
  const brOv = gb.elseBranch(cMode, 'gt_ov_br', 'comparison', { x: 520, y: 540 });
  apiAction(gb, 'gt_ov_api', 'gt_ov_res', 'GET', `${BACKEND_BASE}/api/clan/panel/{user_id}?view=overview&username={encode_text[{user_displayName}]}`, '', { x: 520, y: 700 });
  gb.link(brOv, 'gt_ov_api');
  const gtNoAck = attachUpdateAckBranch(gb, 'gt', 'gt_ov_api', 'gt_ov_res', { editId: 'gt_ack', x: 520, y: 860 });

  embedMsg(gb, 'gt_ov_msg', {
    title: '{gt_ov_res.response.title}',
    description: '{gt_ov_res.response.description}',
    color: '#ec4899',
    footer: 'Bấm các nút bên dưới để Duyệt Đơn, Quản Lý Thành Viên, Nâng Cấp & Bang Chiến',
    target: { editId: 'gt_ack' },
    action_id: 'gt_ack',
  }, { x: 520, y: 1040 });
  gb.link(gtNoAck, 'gt_ov_msg');

  // Button 1: Duyệt Đơn Xin Vào -> Dropdown #1..#15 -> Edit hiện [Duyệt] / [Từ Chối]
  gb.advBtn('gt_btn_req', 'gt_ov_msg', btnCfg('Duyệt Đơn', 'PRIMARY', 'su_wiki_scroll', '1', '1', false), { x: 100, y: 1220 });
  apiAction(gb, 'gt_req_api', 'gt_req_res', 'GET', `${BACKEND_BASE}/api/clan/panel/{user_id}?view=requests`, '', { x: 100, y: 1380 });
  gb.link('gt_btn_req', 'gt_req_api');
  embedMsg(gb, 'gt_req_msg', {
    title: '{gt_req_res.response.title}',
    description: '{gt_req_res.response.description}',
    color: '#38bdf8',
    target: { editId: 'gt_ack' },
    action_id: 'gt_ack',
  }, { x: 100, y: 1540 });
  gb.link('gt_req_api', 'gt_req_msg');

  gb.advSelectMenu('gt_req_sel', 'gt_req_msg', {
    placeholder: 'Chọn số thứ tự ứng viên (#1 → #15) để Duyệt / Từ Chối...',
    customVariableName: 'gt_req_slot',
    basic_options: makeSlotOptions(15, 'ứng viên'),
    row: '1',
    weight: '1',
  }, { x: 100, y: 1700 });
  apiAction(gb, 'gt_req_pick_api', 'gt_req_pick_res', 'POST', `${BACKEND_BASE}/api/clan/ui/select`,
    '{"userId":"{user_id}","view":"requests","slot":"{gt_req_slot}"}', { x: 100, y: 1860 });
  gb.link('gt_req_sel', 'gt_req_pick_api');
  embedMsg(gb, 'gt_req_pick_msg', {
    title: '{gt_req_pick_res.response.title}',
    description: '{gt_req_pick_res.response.description}',
    color: '#f59e0b',
    target: { editId: 'gt_ack' },
    action_id: 'gt_ack',
  }, { x: 100, y: 2020 });
  gb.link('gt_req_pick_api', 'gt_req_pick_msg');

  for (const [actKey, lbl, sty, wx, xPos] of [
    ['approve', 'Duyệt Vào Tộc', 'SUCCESS', '1', -40],
    ['reject', 'Từ Chối Đơn', 'DANGER', '2', 220],
  ]) {
    gb.advBtn(`gt_req_${actKey}_btn`, 'gt_req_pick_msg', btnCfg(lbl, sty, 'su_sparkle', '1', wx, false), { x: xPos, y: 2180 });
    apiAction(gb, `gt_req_${actKey}_api`, `gt_req_${actKey}_res`, 'POST', `${BACKEND_BASE}/api/clan/ui/action`,
      `{"userId":"{user_id}","action":"${actKey}"}`, { x: xPos, y: 2340 });
    gb.link(`gt_req_${actKey}_btn`, `gt_req_${actKey}_api`);
    embedMsg(gb, `gt_req_${actKey}_edit`, {
      title: `${uidEm('su_clan_castle')} KẾT QUẢ DUYỆT ĐƠN`,
      description: `{gt_req_${actKey}_res.response.message}`,
      color: actKey === 'approve' ? '#10b981' : '#f43f5e',
      target: { editId: 'gt_ack' },
      action_id: 'gt_ack',
    }, { x: xPos, y: 2500 });
    gb.link(`gt_req_${actKey}_api`, `gt_req_${actKey}_edit`);
  }

  // Button 2: Quản Lý Thành Viên -> Dropdown #1..#15 -> Edit hiện [Kick] / [Nhường Tộc Trưởng]
  gb.advBtn('gt_btn_mem', 'gt_ov_msg', btnCfg('Thành Viên', 'PRIMARY', 'su_clan_castle', '1', '2', false), { x: 520, y: 1220 });
  apiAction(gb, 'gt_mem_api', 'gt_mem_res', 'GET', `${BACKEND_BASE}/api/clan/panel/{user_id}?view=members`, '', { x: 520, y: 1380 });
  gb.link('gt_btn_mem', 'gt_mem_api');
  embedMsg(gb, 'gt_mem_msg', {
    title: '{gt_mem_res.response.title}',
    description: '{gt_mem_res.response.description}',
    color: '#a855f7',
    target: { editId: 'gt_ack' },
    action_id: 'gt_ack',
  }, { x: 520, y: 1540 });
  gb.link('gt_mem_api', 'gt_mem_msg');

  gb.advSelectMenu('gt_mem_sel', 'gt_mem_msg', {
    placeholder: 'Chọn thành viên (#1 → #15) để Kick hoặc Nhường Tộc Trưởng...',
    customVariableName: 'gt_mem_slot',
    basic_options: makeSlotOptions(15, 'thành viên'),
    row: '1',
    weight: '1',
  }, { x: 520, y: 1700 });
  apiAction(gb, 'gt_mem_pick_api', 'gt_mem_pick_res', 'POST', `${BACKEND_BASE}/api/clan/ui/select`,
    '{"userId":"{user_id}","view":"members","slot":"{gt_mem_slot}"}', { x: 520, y: 1860 });
  gb.link('gt_mem_sel', 'gt_mem_pick_api');
  embedMsg(gb, 'gt_mem_pick_msg', {
    title: '{gt_mem_pick_res.response.title}',
    description: '{gt_mem_pick_res.response.description}',
    color: '#f59e0b',
    target: { editId: 'gt_ack' },
    action_id: 'gt_ack',
  }, { x: 520, y: 2020 });
  gb.link('gt_mem_pick_api', 'gt_mem_pick_msg');

  for (const [actKey, lbl, sty, wx, xPos] of [
    ['kick', 'Trục Xuất (Kick)', 'DANGER', '1', 420],
    ['transfer_leader', 'Nhường Tộc Trưởng', 'PRIMARY', '2', 660],
  ]) {
    gb.advBtn(`gt_mem_${actKey}_btn`, 'gt_mem_pick_msg', btnCfg(lbl, sty, 'su_crossed_swords', '1', wx, false), { x: xPos, y: 2180 });
    apiAction(gb, `gt_mem_${actKey}_api`, `gt_mem_${actKey}_res`, 'POST', `${BACKEND_BASE}/api/clan/ui/action`,
      `{"userId":"{user_id}","action":"${actKey}"}`, { x: xPos, y: 2340 });
    gb.link(`gt_mem_${actKey}_btn`, `gt_mem_${actKey}_api`);
    embedMsg(gb, `gt_mem_${actKey}_edit`, {
      title: `${uidEm('su_clan_castle')} QUẢN LÝ THÀNH VIÊN`,
      description: `{gt_mem_${actKey}_res.response.message}`,
      color: '#ec4899',
      target: { editId: 'gt_ack' },
      action_id: 'gt_ack',
    }, { x: xPos, y: 2500 });
    gb.link(`gt_mem_${actKey}_api`, `gt_mem_${actKey}_edit`);
  }

  // Buttons 3, 4, 5: Nâng Cấp / Bang Chiến / Top Gia Tộc
  const extraBtns = [
    { id: 'upg', label: 'Nâng Cấp Tộc', style: 'SUCCESS', emoji: 'su_level_up', row: '1', w: '3', method: 'POST', url: `${BACKEND_BASE}/api/clan/ui/action`, body: '{"userId":"{user_id}","action":"upgrade"}', x: 860 },
    { id: 'war', label: 'Chiến Sự 24H', style: 'DANGER', emoji: 'su_crossed_swords', row: '2', w: '1', method: 'GET', url: `${BACKEND_BASE}/api/clan/panel/{user_id}?view=war`, body: '', x: 1120 },
    { id: 'top', label: 'Top Gia Tộc', style: 'SECONDARY', emoji: 'su_winner_trophy', row: '2', w: '2', method: 'GET', url: `${BACKEND_BASE}/api/clan/panel/{user_id}?view=top`, body: '', x: 1380 },
  ];
  for (const b of extraBtns) {
    gb.advBtn(`gt_btn_${b.id}`, 'gt_ov_msg', btnCfg(b.label, b.style, b.emoji, b.row, b.w, false), { x: b.x, y: 1220 });
    apiAction(gb, `gt_${b.id}_api`, `gt_${b.id}_res`, b.method, b.url, b.body, { x: b.x, y: 1380 });
    gb.link(`gt_btn_${b.id}`, `gt_${b.id}_api`);
    embedMsg(gb, `gt_${b.id}_edit`, {
      title: b.method === 'GET' ? `{gt_${b.id}_res.response.title}` : `${uidEm('su_clan_castle')} GIA TỘC SUMI`,
      description: b.method === 'GET' ? `{gt_${b.id}_res.response.description}` : `{gt_${b.id}_res.response.message}`,
      color: '#ec4899',
      target: { editId: 'gt_ack' },
      action_id: 'gt_ack',
    }, { x: b.x, y: 1540 });
    gb.link(`gt_${b.id}_api`, `gt_${b.id}_edit`);
  }

  return gb.elements();
}

// ============================================================================
// 4. NEW /party — Tổ Đội 3 Người (0 tham số bắt buộc)
// ============================================================================
export function buildPartyV14Cmd() {
  const gb = new V14GraphBuilder();
  gb.rootSlash('party', 'Lập & Quản Lý Tổ Đội tối đa 3 người chinh chiến Chiếm Đoạt Linh Mạch', { ephemeral: false });
  gb.errorHandlerWait();
  gb.option('moi_dong_doi', 'user', '(Tùy chọn) Chọn đồng đội để gửi lời mời vào Tổ Đội ngay', { required: false, x: 420, y: 0 });
  gb.option('duoi_hoac_chuyen', 'user', '(Tùy chọn) Chọn đồng đội trong đội để Chuyển Đội Trưởng / Đuổi', { required: false, x: 700, y: 0 });

  embedMsg(gb, 'pt_ack', {
    title: `${uidEm('su_crossed_swords')} Đang tải Trung Tâm Tổ Đội...`,
    description: 'Đang kiểm tra trạng thái Tổ Đội (tối đa 3 người)...',
    color: '#38bdf8',
    editId: 'pt_ack',
  }, { x: 0, y: 200 });
  gb.link('root', 'pt_ack');

  const cInv = gb.cmp('pt_has_inv', '{option_moi_dong_doi}', '', 'not', {}, { x: 0, y: 380 });
  gb.link('pt_ack', cInv.condId);

  // Quick invite when moi_dong_doi supplied
  apiAction(gb, 'pt_inv_api', 'pt_inv_res', 'POST', `${BACKEND_BASE}/api/party/invite`,
    '{"userId":"{user_id}","targetUserId":"{option_moi_dong_doi}","username":"{user_displayName}"}', { x: -340, y: 560 });
  gb.link(cInv.yes, 'pt_inv_api');
  embedMsg(gb, 'pt_inv_edit', {
    title: `${uidEm('su_crossed_swords')} MỜI ĐỒNG ĐỘI VÀO TỔ ĐỘI`,
    description: '{pt_inv_res.response.message}',
    color: '#10b981',
    target: { editId: 'pt_ack' },
    action_id: 'pt_ack',
  }, { x: -340, y: 740 });
  gb.link('pt_inv_api', 'pt_inv_edit');

  // Interactive Party Overview
  apiAction(gb, 'pt_st_api', 'pt_st_res', 'GET', `${BACKEND_BASE}/api/party/status/{user_id}?username={encode_text[{user_displayName}]}`, '', { x: 200, y: 560 });
  gb.link(cInv.no, 'pt_st_api');
  const ptNoAck = attachUpdateAckBranch(gb, 'pt', 'pt_st_api', 'pt_st_res', { editId: 'pt_ack', x: 200, y: 740 });

  embedMsg(gb, 'pt_st_msg', {
    title: '{pt_st_res.response.title}',
    description: '{pt_st_res.response.description}',
    color: '#38bdf8',
    footer: 'Dùng /party moi_dong_doi:@ban để mời thêm người (tối đa 3) hoặc bấm nút bên dưới',
    target: { editId: 'pt_ack' },
    action_id: 'pt_ack',
  }, { x: 200, y: 920 });
  gb.link(ptNoAck, 'pt_st_msg');

  const ptBtns = [
    { id: 'acc', label: 'Chấp Nhận Lời Mời', style: 'SUCCESS', emoji: 'su_sparkle', row: '1', w: '1', url: `${BACKEND_BASE}/api/party/respond`, body: '{"userId":"{user_id}","decision":"accept"}', x: -160 },
    { id: 'dec', label: 'Từ Chối Lời Mời', style: 'SECONDARY', emoji: 'su_wiki_scroll', row: '1', w: '2', url: `${BACKEND_BASE}/api/party/respond`, body: '{"userId":"{user_id}","decision":"decline"}', x: 100 },
    { id: 'lv', label: 'Rời / Giải Tán Đội', style: 'DANGER', emoji: 'su_crossed_swords', row: '1', w: '3', url: `${BACKEND_BASE}/api/party/leave`, body: '{"userId":"{user_id}"}', x: 360 },
    { id: 'tr', label: 'Chuyển Đội Trưởng', style: 'PRIMARY', emoji: 'su_winner_trophy', row: '2', w: '1', url: `${BACKEND_BASE}/api/party/transfer`, body: '{"userId":"{user_id}","targetUserId":"{option_duoi_hoac_chuyen}"}', x: 620 },
    { id: 'kk', label: 'Đuổi Thành Viên', style: 'DANGER', emoji: 'su_arena', row: '2', w: '2', url: `${BACKEND_BASE}/api/party/kick`, body: '{"userId":"{user_id}","targetUserId":"{option_duoi_hoac_chuyen}"}', x: 880 },
  ];
  for (const b of ptBtns) {
    gb.advBtn(`pt_btn_${b.id}`, 'pt_st_msg', btnCfg(b.label, b.style, b.emoji, b.row, b.w, false), { x: b.x, y: 1120 });
    apiAction(gb, `pt_${b.id}_api`, `pt_${b.id}_res`, 'POST', b.url, b.body, { x: b.x, y: 1280 });
    gb.link(`pt_btn_${b.id}`, `pt_${b.id}_api`);
    embedMsg(gb, `pt_${b.id}_edit`, {
      title: `${uidEm('su_crossed_swords')} TỔ ĐỘI CHIẾN ĐẤU`,
      description: `{pt_${b.id}_res.response.message}`,
      color: '#ec4899',
      target: { editId: 'pt_ack' },
      action_id: 'pt_ack',
    }, { x: b.x, y: 1440 });
    gb.link(`pt_${b.id}_api`, `pt_${b.id}_edit`);
  }

  return gb.elements();
}

// ============================================================================
// 5. NEW /linhmach — Chiếm Đoạt Linh Mạch (0 tham số, Canvas 3v3 / 3vBoss)
// ============================================================================
export function buildLinhMachV14Cmd() {
  const gb = new V14GraphBuilder();
  gb.rootSlash('linhmach', 'Chiếm Đoạt Linh Mạch Khung Giờ Vàng (08/12/18/20/21/22h) — Tổ Đội 3 người sinh LT mỗi phút!', { ephemeral: false });
  gb.errorHandlerWait();

  embedMsg(gb, 'lm_ack', {
    title: `${uidEm('vein_mine_sp')} Đang dò tìm Linh Mạch đang mở...`,
    description: 'Đang kiểm tra 2 mỏ Linh Mạch (Cấp Thấp F–C & Cấp Cao B–S+)...',
    color: '#f59e0b',
    editId: 'lm_ack',
  }, { x: 0, y: 200 });
  gb.link('root', 'lm_ack');

  apiAction(gb, 'lm_ov_api', 'lm_ov_res', 'GET', `${BACKEND_BASE}/api/vein/overview?userId={user_id}`, '', { x: 0, y: 380 });
  gb.link('lm_ack', 'lm_ov_api');

  embedMsg(gb, 'lm_ov_msg', {
    title: '{lm_ov_res.response.title}',
    description: '{lm_ov_res.response.description}',
    color: '#f59e0b',
    footer: 'Khung Giờ Vàng: 08:00 • 12:00 • 18:00 • 20:00 • 21:00 • 22:00 (UTC+7)',
    target: { editId: 'lm_ack' },
    action_id: 'lm_ack',
  }, { x: 0, y: 560 });
  gb.link('lm_ov_api', 'lm_ov_msg');

  for (const [grp, lbl, sty, emName, w, xPos] of [
    ['low', 'Chiếm Mỏ Thấp (F–C)', 'PRIMARY', 'vein_mine_f', '1', -260],
    ['high', 'Chiếm Mỏ Cao (B–S+)', 'DANGER', 'vein_mine_sp', '2', 260],
  ]) {
    gb.advBtn(`lm_btn_${grp}`, 'lm_ov_msg', btnCfg(lbl, sty, emName, '1', w, false), { x: xPos, y: 760 });
    apiAction(gb, `lm_${grp}_api`, `lm_${grp}_res`, 'POST', `${BACKEND_BASE}/api/vein/challenge`,
      `{"userId":"{user_id}","tierGroup":"${grp}"}`, { x: xPos, y: 920 });
    gb.link(`lm_btn_${grp}`, `lm_${grp}_api`);

    const cOk = gb.cmp(`lm_${grp}_ok`, `{lm_${grp}_res.response.success}`, 'true', 'equal_to', { ignoreCase: true }, { x: xPos, y: 1080 });
    gb.link(`lm_${grp}_api`, cOk.condId);

    embedMsg(gb, `lm_${grp}_win`, {
      title: `${uidEm(emName)} CHIẾN BÁO TRANH ĐOẠT LINH MẠCH`,
      description: `{lm_${grp}_res.response.message}`,
      imageUrl: `{lm_${grp}_res.response.image_url}`,
      color: '#ec4899',
      target: { editId: 'lm_ack' },
      action_id: 'lm_ack',
    }, { x: xPos - 100, y: 1260 });
    gb.link(cOk.yes, `lm_${grp}_win`);

    embedMsg(gb, `lm_${grp}_err`, {
      title: `${uidEm(emName)} CHIẾM ĐOẠT LINH MẠCH`,
      description: `{lm_${grp}_res.response.message}`,
      color: '#f43f5e',
      target: { editId: 'lm_ack' },
      action_id: 'lm_ack',
    }, { x: xPos + 100, y: 1260 });
    gb.link(cOk.no, `lm_${grp}_err`);
  }

  return gb.elements();
}

// ============================================================================
// 6. NEW /explorer — Khám Phá Bản Đồ 12 Địa Danh (0 tham số, 100% Button + Dropdown)
// ============================================================================
export function buildExplorerV14Cmd() {
  const gb = new V14GraphBuilder();
  gb.rootSlash('explorer', 'Khám Phá Đại Lục Cửu Châu — 12 Địa Danh (10k→1M), Loadout riêng & Nhặt bảo vật rơi 60%!', { ephemeral: false });
  gb.errorHandlerWait();

  embedMsg(gb, 'ex_ack', {
    title: `${uidEm('explorer_world_map_v14')} Đang mở Bản Đồ Khám Phá Đại Lục SuMi...`,
    description: 'Đang nạp Đội Hình Khám Phá & trạng thái hành trình...',
    color: '#10b981',
    editId: 'ex_ack',
  }, { x: 0, y: 200 });
  gb.link('root', 'ex_ack');

  apiAction(gb, 'ex_hub_api', 'ex_hub_res', 'GET', `${BACKEND_BASE}/api/explorer/hub/{user_id}?username={encode_text[{user_displayName}]}`, '', { x: 0, y: 380 });
  gb.link('ex_ack', 'ex_hub_api');
  const exNoAck = attachUpdateAckBranch(gb, 'ex', 'ex_hub_api', 'ex_hub_res', { editId: 'ex_ack', x: 0, y: 560 });

  embedMsg(gb, 'ex_hub_msg', {
    title: '{ex_hub_res.response.title}',
    description: '{ex_hub_res.response.description}',
    imageUrl: `${BACKEND_BASE}/api/explorer/map.webp?v=1.4`,
    color: '#10b981',
    footer: 'Chọn Xuất Phát, Chỉnh Loadout (Pet + 3 Pháp Bảo + Linh Vực), Nhận Quà hoặc Hồi Sinh bên dưới',
    target: { editId: 'ex_ack' },
    action_id: 'ex_ack',
  }, { x: 0, y: 740 });
  gb.link(exNoAck, 'ex_hub_msg');

  // --- FLOW A: [🧭 Xuất Phát] -> Dropdown Giờ (2/3/6/12h) -> Dropdown 12 Map -> Dropdown Thức Ăn + Nút Xác Nhận ---
  gb.advBtn('ex_btn_go', 'ex_hub_msg', btnCfg('Xuất Phát Khám Phá', 'SUCCESS', 'explorer_world_map_v14', '1', '1', false), { x: -600, y: 940 });
  embedMsg(gb, 'ex_step1_msg', {
    title: `${uidEm('explorer_world_map_v14')} BƯỚC 1/3 — CHỌN THỜI GIAN KHÁM PHÁ`,
    description: '• Chọn mốc thời gian chuyến đi (`2 / 3 / 6 / 12 giờ`) ở Dropdown bên dưới.\n• Mỗi giờ thu hoạch **200–300 LT × hệ số map** + quà shop + **0.5% Thiên Đạo Tuyệt Ấn Thạch** + **60% nhặt đồ rơi**!',
    color: '#38bdf8',
    target: { editId: 'ex_ack' },
    action_id: 'ex_ack',
  }, { x: -600, y: 1100 });
  gb.link('ex_btn_go', 'ex_step1_msg');

  gb.advSelectMenu('ex_sel_dur', 'ex_step1_msg', {
    placeholder: 'Chọn thời gian khám phá (2 / 3 / 6 / 12 giờ)...',
    customVariableName: 'ex_dur_val',
    basic_options: [
      { label: '2 Giờ • Chuyến Thám Thính Ngắn', description: '400–600 LT cơ bản + 1 lượt rơi quà', value: '2', emoji_id: uidId('food_speed_fruit') },
      { label: '3 Giờ • Tuần Tra Ngoại Vi', description: '600–900 LT cơ bản + 2 lượt rơi quà', value: '3', emoji_id: uidId('food_speed_fruit') },
      { label: '6 Giờ • Viễn Chinh Trung Cảnh', description: '1.200–1.800 LT cơ bản + 3 lượt rơi quà', value: '6', emoji_id: uidId('food_yield_tea') },
      { label: '12 Giờ • Đại Thám Hiểm Cấm Địa', description: '2.400–3.600 LT cơ bản + 5 lượt rơi quà + nhặt mọi mốc đồ rơi!', value: '12', emoji_id: uidId('enchant_stone_absolute') },
    ],
    row: '1',
    weight: '1',
  }, { x: -600, y: 1260 });

  apiAction(gb, 'ex_dur_api', 'ex_dur_res', 'POST', `${BACKEND_BASE}/api/explorer/select-step`,
    '{"userId":"{user_id}","step":"duration","value":"{ex_dur_val}"}', { x: -600, y: 1420 });
  gb.link('ex_sel_dur', 'ex_dur_api');

  embedMsg(gb, 'ex_step2_msg', {
    title: '{ex_dur_res.response.title}',
    description: '{ex_dur_res.response.description}',
    imageUrl: `${BACKEND_BASE}/api/explorer/map.webp?v=1.4`,
    color: '#f59e0b',
    target: { editId: 'ex_ack' },
    action_id: 'ex_ack',
  }, { x: -600, y: 1580 });
  gb.link('ex_dur_api', 'ex_step2_msg');

  gb.advSelectMenu('ex_sel_map', 'ex_step2_msg', {
    placeholder: 'Chọn 1 trong 12 Địa Danh trên Bản Đồ Đại Lục...',
    customVariableName: 'ex_map_val',
    basic_options: V14_EXPLORER_MAPS.map((m) => ({
      label: `#${m.order} ${m.name} (${m.difficulty})`,
      description: `Khuyến nghị ${(m.recommended_power / 1000).toLocaleString('vi-VN')}k Lực • Quà ×${m.reward_multiplier}`,
      value: m.map_id,
      emoji_id: uidId('explorer_world_map_v14'),
    })),
    row: '1',
    weight: '1',
  }, { x: -600, y: 1740 });

  apiAction(gb, 'ex_map_api', 'ex_map_res', 'POST', `${BACKEND_BASE}/api/explorer/select-step`,
    '{"userId":"{user_id}","step":"map","value":"{ex_map_val}"}', { x: -600, y: 1900 });
  gb.link('ex_sel_map', 'ex_map_api');

  embedMsg(gb, 'ex_step3_msg', {
    title: '{ex_map_res.response.title}',
    description: '{ex_map_res.response.description}',
    color: '#ec4899',
    target: { editId: 'ex_ack' },
    action_id: 'ex_ack',
  }, { x: -600, y: 2060 });
  gb.link('ex_map_api', 'ex_step3_msg');

  gb.advSelectMenu('ex_sel_food', 'ex_step3_msg', {
    placeholder: '(Tùy chọn) Chọn Thức Ăn Khám Phá mang theo...',
    customVariableName: 'ex_food_val',
    basic_options: [
      { label: 'Không Mang Thức Ăn', description: 'Khởi hành với chỉ số gốc của Đội Hình', value: 'none', emoji_id: uidId('su_sparkle') },
      { label: 'Hộ Mệnh Linh Đan (Loại A)', description: '+8% Tỉ lệ sống sót cho chuyến đi', value: 'food_survival_pill', emoji_id: uidId('food_survival_pill') },
      { label: 'Tụ Bảo Tiên Trà (Loại B)', description: '+18% Tổng Linh Thạch thu hoạch', value: 'food_yield_tea', emoji_id: uidId('food_yield_tea') },
      { label: 'Ngự Phong Tốc Quả (Loại C)', description: 'Rút gọn -25% thời gian di chuyển', value: 'food_speed_fruit', emoji_id: uidId('food_speed_fruit') },
    ],
    row: '1',
    weight: '1',
  }, { x: -720, y: 2220 });

  apiAction(gb, 'ex_food_api', 'ex_food_res', 'POST', `${BACKEND_BASE}/api/explorer/select-step`,
    '{"userId":"{user_id}","step":"food","value":"{ex_food_val}"}', { x: -720, y: 2380 });
  gb.link('ex_sel_food', 'ex_food_api');

  embedMsg(gb, 'ex_food_ready_msg', {
    title: '{ex_food_res.response.title}',
    description: '{ex_food_res.response.description}',
    color: '#10b981',
    target: { editId: 'ex_ack' },
    action_id: 'ex_ack',
  }, { x: -720, y: 2540 });
  gb.link('ex_food_api', 'ex_food_ready_msg');

  // Launch button on BOTH step3 (without food) AND food_ready (with chosen food)
  for (const [bId, parentId, xP, yP] of [
    ['ex_launch_btn1', 'ex_step3_msg', -420, 2220],
    ['ex_launch_btn2', 'ex_food_ready_msg', -720, 2700],
  ]) {
    gb.advBtn(bId, parentId, btnCfg('Xác Nhận Xuất Phát', 'SUCCESS', 'crash_fly', '2', '1', true), { x: xP, y: yP });
    apiAction(gb, `${bId}_api`, `${bId}_res`, 'POST', `${BACKEND_BASE}/api/explorer/start`, '{"userId":"{user_id}"}', { x: xP, y: yP + 160 });
    gb.link(bId, `${bId}_api`);
    embedMsg(gb, `${bId}_edit`, {
      title: `{${bId}_res.response.title}`,
      description: `{${bId}_res.response.description}`,
      color: '#10b981',
      target: { editId: 'ex_ack' },
      action_id: 'ex_ack',
    }, { x: xP, y: yP + 320 });
    gb.link(`${bId}_api`, `${bId}_edit`);
  }

  // --- FLOW B: [🎒 Chỉnh Loadout] -> 5 Slot Tabs (Pet, Weapon, Gem, Soul, Domain) + Dropdown #1..#15 ---
  gb.advBtn('ex_btn_lo', 'ex_hub_msg', btnCfg('Chỉnh Loadout', 'PRIMARY', 'su_crossed_swords', '1', '2', false), { x: 0, y: 940 });
  embedMsg(gb, 'ex_lo_menu', {
    title: '🎒 THIẾT LẬP ĐỘI HÌNH KHÁM PHÁ (1 Pet + 3 Pháp Bảo + 1 Linh Vực)',
    description: 'Bấm vào từng ô bên dưới để mở danh sách và chọn trang bị cho Đội Hình Khám Phá (có thể dùng Pet phụ + đồ phụ hoặc chính Pet chính):',
    color: '#a855f7',
    target: { editId: 'ex_ack' },
    action_id: 'ex_ack',
  }, { x: 0, y: 1100 });
  gb.link('ex_btn_lo', 'ex_lo_menu');

  const loTabs = [
    { key: 'pet', label: 'Chọn Linh Thú', emoji: 'su_pet_paw', row: '1', w: '1', x: -160, clear: false },
    { key: 'weapon', label: 'Vũ Khí', emoji: 'su_crossed_swords', row: '1', w: '2', x: 100, clear: true },
    { key: 'gem', label: 'Bảo Ngọc', emoji: 'su_linhthach', row: '1', w: '3', x: 360, clear: true },
    { key: 'soul', label: 'Chiến Hồn', emoji: 'su_sparkle', row: '2', w: '1', x: 620, clear: true },
    { key: 'domain', label: 'Linh Vực', emoji: 'su_realm_star', row: '2', w: '2', x: 880, clear: true },
  ];
  for (const t of loTabs) {
    gb.advBtn(`ex_lo_btn_${t.key}`, 'ex_lo_menu', btnCfg(t.label, 'PRIMARY', t.emoji, t.row, t.w, false), { x: t.x, y: 1260 });
    apiAction(gb, `ex_lo_get_${t.key}`, `ex_lo_${t.key}_res`, 'GET', `${BACKEND_BASE}/api/explorer/loadout/{user_id}?tab=${t.key}`, '', { x: t.x, y: 1420 });
    gb.link(`ex_lo_btn_${t.key}`, `ex_lo_get_${t.key}`);
    embedMsg(gb, `ex_lo_list_${t.key}`, {
      title: `{ex_lo_${t.key}_res.response.title}`,
      description: `{ex_lo_${t.key}_res.response.description}`,
      color: '#a855f7',
      target: { editId: 'ex_ack' },
      action_id: 'ex_ack',
    }, { x: t.x, y: 1580 });
    gb.link(`ex_lo_get_${t.key}`, `ex_lo_list_${t.key}`);

    gb.advSelectMenu(`ex_lo_sel_${t.key}`, `ex_lo_list_${t.key}`, {
      placeholder: `Chọn ${t.label} (#1 → #15)...`,
      customVariableName: `ex_pick_${t.key}`,
      basic_options: makeSlotOptions(15, t.label, t.clear),
      row: '1',
      weight: '1',
    }, { x: t.x, y: 1740 });
    apiAction(gb, `ex_lo_save_${t.key}`, `ex_lo_sv_${t.key}_res`, 'POST', `${BACKEND_BASE}/api/explorer/loadout`,
      `{"userId":"{user_id}","slotType":"${t.key}","slotValue":"{ex_pick_${t.key}}"}`, { x: t.x, y: 1900 });
    gb.link(`ex_lo_sel_${t.key}`, `ex_lo_save_${t.key}`);
    embedMsg(gb, `ex_lo_done_${t.key}`, {
      title: '✅ ĐÃ CẬP NHẬT LOADOUT KHÁM PHÁ',
      description: `{ex_lo_sv_${t.key}_res.response.message}`,
      color: '#10b981',
      target: { editId: 'ex_ack' },
      action_id: 'ex_ack',
    }, { x: t.x, y: 2060 });
    gb.link(`ex_lo_save_${t.key}`, `ex_lo_done_${t.key}`);
  }

  // --- FLOW C, D, E: [🎁 Nhận Quà], [💊 Hồi Sinh Pet Độc Nhất], [🗺️ Bản Đồ & Đồ Rơi] ---
  const quickHubBtns = [
    { id: 'claim', label: 'Nhận Quà / Tiến Độ', style: 'PRIMARY', emoji: 'su_winner_trophy', row: '1', w: '3', method: 'POST', url: `${BACKEND_BASE}/api/explorer/claim`, body: '{"userId":"{user_id}"}', x: 520 },
    { id: 'revive', label: 'Hồi Sinh Pet Độc Nhất', style: 'DANGER', emoji: 'explorer_revive_elixir', row: '2', w: '1', method: 'POST', url: `${BACKEND_BASE}/api/explorer/revive`, body: '{"userId":"{user_id}"}', x: 820 },
    { id: 'mapboard', label: 'Bản Đồ 4K & Đồ Rơi', style: 'SECONDARY', emoji: 'explorer_world_map_v14', row: '2', w: '2', method: 'GET', url: `${BACKEND_BASE}/api/explorer/map-board?userId={user_id}`, body: '', x: 1120 },
  ];
  for (const b of quickHubBtns) {
    gb.advBtn(`ex_btn_${b.id}`, 'ex_hub_msg', btnCfg(b.label, b.style, b.emoji, b.row, b.w, false), { x: b.x, y: 940 });
    apiAction(gb, `ex_${b.id}_api`, `ex_${b.id}_res`, b.method, b.url, b.body, { x: b.x, y: 1100 });
    gb.link(`ex_btn_${b.id}`, `ex_${b.id}_api`);
    embedMsg(gb, `ex_${b.id}_edit`, {
      title: b.id === 'revive' ? `${uidEm('explorer_revive_elixir')} HỒI SINH LINH THÚ ĐỘC NHẤT` : `{ex_${b.id}_res.response.title}`,
      description: b.id === 'revive' ? `{ex_${b.id}_res.response.message}` : `{ex_${b.id}_res.response.description}`,
      imageUrl: b.id === 'mapboard' ? `${BACKEND_BASE}/api/explorer/map.webp?v=1.4` : '',
      color: '#ec4899',
      target: { editId: 'ex_ack' },
      action_id: 'ex_ack',
    }, { x: b.x, y: 1260 });
    gb.link(`ex_${b.id}_api`, `ex_${b.id}_edit`);
  }

  return gb.elements();
}

// ============================================================================
// 7. PATCH EXISTING COMMANDS (/updates, /enchant, /shop, /wiki, AI Mention, Keep-Alive Cron)
// ============================================================================
function patchExistingCommand(name, elements) {
  let patched = JSON.parse(JSON.stringify(elements));

  if (name === 'updates') {
    for (const el of patched) {
      const dt = el?.data?.data;
      if (dt?.type === 'adv_select_menu' && Array.isArray(dt.basic_options)) {
        const hasV14 = dt.basic_options.some((o) => o.value === '1.4');
        if (!hasV14) {
          dt.basic_options = [
            { label: 'Phiên bản v1.4 (Mới nhất)', description: 'Đạo Áp, Shop Ngày, Chiếm Đoạt Linh Mạch & Khám Phá 12 Map', emoji_id: uidId('dao_ap_crest'), value: '1.4' },
            ...dt.basic_options.map((o) => ({
              ...o,
              label: String(o.label || '').replace(/\s*\(Mới nhất\)/gi, ''),
            })),
          ].slice(0, 25);
        }
      }
    }
  }

  if (name === 'enchant') {
    // Add optional `loai_da` choice ('thuong' | 'tuyet_doi') and forward stoneType to /api/enchant
    const hasStoneOpt = patched.some((n) => n.id === 'opt_loai_da' || n.data?.data?.name === 'loai_da');
    if (!hasStoneOpt) {
      patched.push({
        id: 'opt_loai_da',
        type: 'option',
        draggable: true,
        position: { x: 980, y: 0 },
        width: 280,
        height: 90,
        data: {
          node_options: { __OPT_TYPE__: 'string' },
          data: {
            type: 'string',
            name: 'loai_da',
            description: 'Chọn loại đá: thuong (mặc định) hoặc tuyet_doi (100% Thiên Đạo Tuyệt Ấn Thạch — khuyên dùng A→S)',
            required: false,
            validated: true,
            choices: ['thuong', 'tuyet_doi'],
          },
        },
      });
      patched.push({
        source: 'root',
        sourceHandle: 'options',
        target: 'opt_loai_da',
        type: 'step',
        animated: false,
        arrowHeadType: 'arrowclosed',
        id: 'reactflow__edge-rootoptions-opt_loai_da',
      });
    }
    for (const el of patched) {
      const ro = el?.data?.data?.request_options;
      if (ro?.url && String(ro.url).includes('/api/enchant') && typeof ro.rawBody === 'string' && !ro.rawBody.includes('stoneType')) {
        ro.rawBody = ro.rawBody.replace(/\}\s*$/, ',"stoneType":"{option_loai_da}"}');
      }
    }
  }

  if (name === 'shop') {
    // Update consumables dropdown with the 4 new v1.4 shop items (food A/B/C + Elixir)
    for (const el of patched) {
      const dt = el?.data?.data;
      if (dt?.type === 'adv_select_menu' && Array.isArray(dt.basic_options)) {
        if (dt.basic_options.some((o) => o.value === 'enchant_stone')) {
          dt.basic_options = SHOP_CONSUMABLES.slice(0, 25).map((c) => ({
            label: `${c.name} (${c.price} LT)`.slice(0, 95),
            description: c.description.slice(0, 95),
            emoji_id: uidId(c.item_id),
            value: c.item_id,
          }));
        }
      }
    }
    // Attach Daily Shop button on the shop overview message if not already attached
    const hasDailyBtn = patched.some((n) => n.id === 'shop_btn_daily');
    const overviewMsg = patched.find((n) => n.id === 'shop_ov_edit' || n.id === 'sh_ov_edit' || (n.data?.data?.type === 'advanced_message' && JSON.stringify(n.data?.data).includes('summary_text')));
    if (!hasDailyBtn && overviewMsg) {
      const gb = new V14GraphBuilder();
      gb.advBtn('shop_btn_daily', overviewMsg.id, btnCfg('Shop Ngày (-40%)', 'SUCCESS', 'daily_shop_emblem', '2', '4', false), { x: 960, y: 1180 });
      apiAction(gb, 'shop_daily_get', 'shop_daily_res', 'GET', `${BACKEND_BASE}/api/shop/daily?userId={user_id}`, '', { x: 960, y: 1340 });
      gb.link('shop_btn_daily', 'shop_daily_get');
      embedMsg(gb, 'shop_daily_msg', {
        title: '{shop_daily_res.response.title}',
        description: '{shop_daily_res.response.summary_text}',
        color: '#f59e0b',
        footer: 'Reset 00:00 (UTC+7) mỗi ngày • Chọn gian hàng #1 → #10 bên dưới để mua ngay!',
        target: { editId: overviewMsg.data?.data?.target?.editId || 'shop_ack' },
        action_id: overviewMsg.data?.data?.action_id || 'shop_ack',
      }, { x: 960, y: 1500 });
      gb.link('shop_daily_get', 'shop_daily_msg');

      gb.advSelectMenu('shop_daily_sel', 'shop_daily_msg', {
        placeholder: 'Chọn gian hàng Shop Ngày (#1 → #10) để mua ngay...',
        customVariableName: 'daily_slot_pick',
        basic_options: makeSlotOptions(10, 'gian hàng Shop Ngày'),
        row: '1',
        weight: '1',
      }, { x: 960, y: 1660 });
      apiAction(gb, 'shop_daily_buy', 'shop_daily_buy_res', 'POST', `${BACKEND_BASE}/api/shop/daily/buy`,
        '{"userId":"{user_id}","slotIndex":"{daily_slot_pick}","username":"{user_displayName}"}', { x: 960, y: 1820 });
      gb.link('shop_daily_sel', 'shop_daily_buy');
      embedMsg(gb, 'shop_daily_buy_edit', {
        title: `${uidEm('daily_shop_emblem')} SHOP NGÀY — VẠN BẢO LƯU ĐỘNG CÁC`,
        description: '{shop_daily_buy_res.response.message}',
        color: '#10b981',
        target: { editId: overviewMsg.data?.data?.target?.editId || 'shop_ack' },
        action_id: overviewMsg.data?.data?.action_id || 'shop_ack',
      }, { x: 960, y: 1980 });
      gb.link('shop_daily_buy', 'shop_daily_buy_edit');

      patched = [...patched, ...gb.elements()];
    }
  }

  return patched;
}

function buildV14KnowledgeBlock(includeFuyumiSecret) {
  const lines = [
    'KIẾN THỨC CHÍNH THỨC HỆ THỐNG BOT NHIỄM NHIỄM (SUMI FAMILY v1.4):',
    '• HỒ SƠ, EXP & VINH DANH CHỦ NHẬT (/profile, /rank, /top): Thẻ /profile hiển thị Linh Thú, 3 Pháp Bảo, 5 Role và bộ Linh Vực • Thần Thức • Thần Cảnh. Chat nhận 20-30 EXP (cooldown 45s), Voice nhận 85-135 EXP/5 phút (chấm công 12 phút). Lên cấp: 60*(Lv^1.45) (max Lv.100 = 500.000 EXP). /top xem level, power, wealth, marry; mỗi 19:00 Chủ Nhật (UTC+7) tự động tổng kết và phát quà Linh Thạch, Đá Khắc Ấn, Thẻ Reset Tháp, Thức Ăn Khám Phá & Vé Roll cho Top 10 Lực Chiến.',
    '• LINH VỰC • THẦN THỨC • THẦN CẢNH & ĐẠO ÁP (/linhvuc, /roll loai:domain): 30 Linh Vực, 15 Thần Thức & 15 Thần Cảnh kích hoạt từ Hiệp 2 theo vòng 5 Hệ (Kiếm > Huyễn > Trận > Minh > Thánh > Kiếm). Toàn bộ Linh Vực Thần Thoại sở hữu Debuff Cấp 2 « Đạo Áp »: tự kích hoạt ở hiệp kế tiếp sau khi đánh vỡ Linh Vực đang hoạt động của địch (duy trì 1–2 lượt cho Thần Thoại Thường, 3 lượt cho Độc Nhất; tăng +20%–30% uy lực Debuff gốc).',
    '• CHIẾM ĐOẠT LINH MẠCH & TỔ ĐỘI (/party, /linhmach): Lập Tổ Đội tối đa 3 người bằng /party. Mở 6 Khung Giờ Vàng mỗi ngày (08:00, 12:00, 18:00, 20:00, 21:00, 22:00 UTC+7), mỗi đợt 1 giờ gồm 1 Mỏ Thấp (F–C, Boss 25k–750k, 6–22 LT/phút) và 1 Mỏ Cao (B–S+, Boss 1.8M–8.5M+, 30–56 LT/phút). Mỏ trống đấu 3vBoss, mỏ có chủ đấu 3v3 theo thứ tự SPD cao nhất, chỉ dùng Linh Vực của Đội Trưởng. Sản lượng LT chia đều cho đội (+15% vào Ngân Khố Gia Tộc nếu cùng Clan). Đi chiếm liên tiếp khung giờ kế tiếp dính Mệt Mỏi (-25% lực chiến/stack, tối đa -75%).',
    '• KHÁM PHÁ BẢN ĐỒ ĐẠI LỤC (/explorer): Bản đồ 12 địa danh từ Dễ (10k lực) đến Nightmare (1M lực), chọn mốc 2 / 3 / 6 / 12 giờ cùng Đội Hình Khám Phá riêng (1 Pet chính/phụ + 3 Pháp Bảo + 1 Linh Vực) và 3 loại Thức Ăn (Hộ Mệnh Linh Đan +8% sống sót, Tụ Bảo Tiên Trà +18% LT, Ngự Phong Tốc Quả -25% thời gian). Vượt ải nhận 200–300 LT/giờ × hệ số map + quà shop + 0.5% Thiên Đạo Tuyệt Ấn Thạch (Khắc Ấn 100% mọi bậc, khuyên dùng A→S) + 0.01% Vũ Khí Thần Thoại + 60% nhặt Pháp Bảo người đi trước làm rơi tại đúng tọa độ! Nếu tử nạn: Pet không Độc Nhất mất vĩnh viễn, Pet Độc Nhất trọng thương hồi sinh bằng Cửu Chuyển Hoàn Hồn Lộ, Pháp Bảo không Độc Nhất rớt tại vị trí đó trên bản đồ, Pháp Bảo Độc Nhất & Linh Vực an toàn.',
    '• SHOP NGÀY, KINH TẾ & MINIGAME (/shop, /daily, /job, /nhiemvu, /farm, /exchange, /coinflip, /slots, /blackjack, /crash, /giatoc): /shop tích hợp nút Shop Ngày (Vạn Bảo Lưu Động Các, reset 00:00 mỗi ngày chung toàn server với 10 gian hàng giảm 15–40%, có cả Pet & Pháp Bảo Thần Thoại sẵn Khắc Ấn bậc B/A) cùng 4 vật phẩm Khám Phá mới. /giatoc dùng nút bấm & Dropdown duyệt đơn / quản lý thành viên trực quan. /slots quay dừng từng ô trái sang phải; /crash & /blackjack cập nhật trực tiếp tại chỗ.',
    '• LINH THÚ, PHÁP BẢO, KHẮC ẤN & TRA CỨU (/roll, /enchant, /inv, /info, /wiki, /updates): 90 Linh Thú công khai & 165 Pháp Bảo. /enchant hỗ trợ cả Đá Khắc Ấn thường (Pity +5%) và Thiên Đạo Tuyệt Ấn Thạch (loai_da:tuyet_doi — 100% mọi bậc D→S, khuyên dùng A→S). Dùng /updates xem chi tiết v1.4.',
  ];
  if (includeFuyumiSecret) {
    lines.push('• BỘ TỐI THƯỢNG THẦN THOẠI ĐỘC NHẤT (TIỂU THƯ FUYUMI SỞ HỮU — CHỈ TIỂU THƯ BIẾT): Tiểu thư sở hữu Cửu Vĩ Hồng Hồ (cuu_vi_hong_ho) cùng bộ Linh Vực Cửu Vĩ Hồng Mông (Đạo Áp 3 hiệp +30%), Thần Thức Thái Thượng Hồng Hồ và Thần Cảnh Vạn Cổ Tuyệt Diệt.');
  }
  return lines.join('\n');
}

function updateAiPromptTextV14(oldPrompt, includeFuyumiSecret) {
  let text = String(oldPrompt || '');
  text = text.replace(/tài liệu(?: hệ thống)? v1\.[0-9]+(?:\.[0-9]+)? bên dưới/g, 'tài liệu hệ thống v1.4 bên dưới');
  const startMarker = 'KIẾN THỨC CHÍNH THỨC HỆ THỐNG BOT NHIỄM NHIỄM';
  const endMarker = '\n\nBỘ DANH SÁCH EMOTE ĐỘNG DISCORD CHÍNH THỨC:';
  const sIdx = text.indexOf(startMarker);
  const eIdx = text.indexOf(endMarker);
  if (sIdx === -1 || eIdx === -1 || eIdx <= sIdx) {
    throw new Error(`Could not locate knowledge markers inside AI prompt (s=${sIdx}, e=${eIdx})`);
  }
  return text.slice(0, sIdx) + buildV14KnowledgeBlock(includeFuyumiSecret) + text.slice(eIdx);
}

function patchKeepAliveCron(elements) {
  let patched = JSON.parse(JSON.stringify(elements));
  if (patched.some((n) => n.id === 'ka_weekly_settle_api')) return patched;

  // Find terminal node in keep-alive chain (usually voice heartbeat or last api_action)
  const outEdges = new Set(patched.filter((e) => e.source).map((e) => e.source));
  const tailNode = patched.find((n) => n.type === 'action' && !outEdges.has(n.id) && n.id !== 'err_wait');
  if (!tailNode) return patched;

  const gb = new V14GraphBuilder();
  gb.act('ka_v14_wait1', 'wait_action', { seconds: '1', success_handles: false }, { x: 400, y: 1200 });
  apiAction(gb, 'ka_vein_settle_api', 'ka_vein_res', 'POST', `${BACKEND_BASE}/api/vein/settle-expired`, '{}', { x: 400, y: 1360 });
  gb.link('ka_v14_wait1', 'ka_vein_settle_api');

  gb.act('ka_v14_wait2', 'wait_action', { seconds: '1', success_handles: false }, { x: 400, y: 1520 });
  gb.link('ka_vein_settle_api', 'ka_v14_wait2');

  apiAction(gb, 'ka_weekly_settle_api', 'ka_weekly_res', 'POST', `${BACKEND_BASE}/api/leaderboard/weekly-settle`, '{}', { x: 400, y: 1680 });
  gb.link('ka_v14_wait2', 'ka_weekly_settle_api');

  const cAnn = gb.cmp('ka_weekly_ann', '{ka_weekly_res.response.should_announce}', 'true', 'equal_to', { ignoreCase: true }, { x: 400, y: 1840 });
  gb.link('ka_weekly_settle_api', cAnn.condId);

  embedMsg(gb, 'ka_weekly_send', {
    title: '{ka_weekly_res.response.announcement_embed.title}',
    description: '{ka_weekly_res.response.announcement_embed.description}',
    color: '#f59e0b',
    footer: 'SuMi Family • Vinh Danh Top 10 Lực Chiến 19:00 Chủ Nhật',
    target: { channel: WEEKLY_ANNOUNCE_CHANNEL_ID },
  }, { x: 240, y: 2020 });
  gb.link(cAnn.yes, 'ka_weekly_send');

  patched.push(...gb.elements(), {
    source: tailNode.id,
    sourceHandle: 'action',
    target: 'ka_v14_wait1',
    type: 'custom',
    animated: false,
    arrowHeadType: 'arrowclosed',
    id: `reactflow__edge-${tailNode.id}action-ka_v14_wait1`,
  });
  return patched;
}

const LEAK_RE = /house\s*edge|tỉ lệ[^.]{0,20}(?:40|45|48)%|winrate[^.]{0,20}(?:40|45|48)%|(?:minigame|coinflip|blackjack|slots|crash)[^.]{0,60}(?:40|45|48)%/i;

const FULL_BUILD_COMMANDS = [
  { name: 'slots', build: buildSlotsV14Cmd },
  { name: 'crash', build: buildCrashV14Cmd },
  { name: 'giatoc', build: buildGiatocV14Cmd },
  { name: 'party', build: buildPartyV14Cmd },
  { name: 'linhmach', build: buildLinhMachV14Cmd },
  { name: 'explorer', build: buildExplorerV14Cmd },
];

async function fetchLiveReduxState() {
  const raw = await cdpEval(`(() => {
    const root = document.querySelector('#root');
    if (!root) throw new Error('No #root (not on BotGhost tab?)');
    const rk = Object.keys(root).find(k => k.startsWith('__reactContainer') || k.startsWith('__reactFiber'));
    let f = root[rk], store = null;
    const seen = new Set();
    const walk = (n) => {
      if (!n || seen.has(n) || store) return;
      seen.add(n);
      const s1 = n.memoizedProps?.store;
      if (s1?.getState?.()?.data?.bot?.commands?.slash) store = s1;
      const s2 = n.stateNode?.store;
      if (!store && s2?.getState?.()?.data?.bot?.commands?.slash) store = s2;
      if (n.child) walk(n.child);
      if (n.sibling) walk(n.sibling);
    };
    walk(f);
    if (!store) throw new Error('BotGhost Redux store not found');
    const st = store.getState();
    const cmds = st.data.bot.commands.slash.commands;
    const events = st.data.bot.commands.custom_events.events;
    const evList = Object.values(events || {});
    const aiEv = evList.find(e => e.int_id === '4cc5db30-029c-4a55-86e6-6e6850012afd') || events['21'];
    const kaEv = evList.find(e => e.int_id === '71c549b1-b532-4afb-958a-8e47b168f96b');
    return JSON.stringify({
      cmds: Object.values(cmds).filter(c => c.groupId === '${PROFILE_GROUP_ID}' && c.name).map(c => ({
        name: c.name,
        enabled: c.enabled !== false,
        groupId: c.groupId,
        compressed_tree: c.compressed_tree,
      })),
      aiEv: aiEv ? { name: aiEv.name, enabled: aiEv.enabled !== false, compressed_tree: aiEv.compressed_tree } : null,
      kaEv: kaEv ? { name: kaEv.name, enabled: kaEv.enabled !== false, compressed_tree: kaEv.compressed_tree } : null,
    });
  })()`);
  return JSON.parse(raw);
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const filterArg = process.argv.find((a) => a.startsWith('--only='));
  const onlyNames = filterArg ? new Set(filterArg.slice('--only='.length).split(',')) : null;

  // 1. Validate & deploy 6 full-build commands (slots, crash, giatoc, party, linhmach, explorer)
  for (const t of FULL_BUILD_COMMANDS) {
    if (onlyNames && !onlyNames.has(t.name)) continue;
    const els = t.build();
    assertAcyclicDAG(els, t.name);
    assertUniqueApiActionNames(els, t.name);
    assertSelectLimitsAndRegex(els, t.name);
    const errs = validateGraph(els);
    if (errs.length) throw new Error(`Validation failed for /${t.name}: ${errs.join(', ')}`);
    if (LEAK_RE.test(JSON.stringify(els))) throw new Error(`Confidential leak detected in /${t.name}`);
    console.log(`[Offline OK] BUILD /${t.name}: ${els.length} elements`);

    if (!dryRun) {
      const res = await deployViaCDP({
        groupId: PROFILE_GROUP_ID,
        mode: 'command',
        name: t.name,
        elements: els,
        enabled: true,
      });
      console.log(`[Deployed] /${t.name}:`, JSON.stringify(res));
      if (!res?.ok) throw new Error(`Failed deploying /${t.name}: ${JSON.stringify(res)}`);
      await new Promise((r) => setTimeout(r, 1200));
    }
  }

  if (dryRun) {
    console.log('[DryRun] All 6 full-build v1.4 commands validated cleanly!');
    return;
  }

  // 2. Patch existing commands (/updates, /enchant, /shop) + AI Mention + Keep-Alive Cron
  const live = await fetchLiveReduxState();
  const PATCH_TARGETS = new Set(['updates', 'enchant', 'shop']);

  for (const c of live.cmds) {
    if (!PATCH_TARGETS.has(c.name)) continue;
    if (onlyNames && !onlyNames.has(c.name)) continue;
    const origTree = JSON.parse(LZString.decompressFromBase64(c.compressed_tree) || '[]');
    const patchedTree = patchExistingCommand(c.name, origTree);
    assertAcyclicDAG(patchedTree, c.name);
    assertUniqueApiActionNames(patchedTree, c.name);
    assertSelectLimitsAndRegex(patchedTree, c.name);
    const errs = validateGraph(patchedTree);
    if (errs.length) throw new Error(`Validation failed for patched /${c.name}: ${errs.join(', ')}`);
    if (LEAK_RE.test(JSON.stringify(patchedTree))) throw new Error(`Confidential leak detected in /${c.name}`);
    console.log(`[Offline OK] PATCH /${c.name}: ${patchedTree.length} elements`);

    const res = await deployViaCDP({
      groupId: c.groupId || PROFILE_GROUP_ID,
      mode: 'command',
      name: c.name,
      elements: patchedTree,
      enabled: c.enabled,
    });
    console.log(`[Patched] /${c.name}:`, JSON.stringify(res));
    if (!res?.ok) throw new Error(`Failed patching /${c.name}: ${JSON.stringify(res)}`);
    await new Promise((r) => setTimeout(r, 1200));
  }

  // 3. Patch AI Mention v1.4
  if ((!onlyNames || onlyNames.has('ai_mention')) && live.aiEv?.compressed_tree) {
    const aiTree = JSON.parse(LZString.decompressFromBase64(live.aiEv.compressed_tree) || '[]');
    for (const el of aiTree) {
      const ro = el?.data?.data?.request_options;
      if (!ro?.rawBody || !String(ro.url || '').includes('generativelanguage.googleapis.com')) continue;
      const bodyObj = JSON.parse(ro.rawBody);
      const sysText = bodyObj?.systemInstruction?.parts?.[0]?.text || '';
      if (!sysText.includes('KIẾN THỨC CHÍNH THỨC HỆ THỐNG BOT NHIỄM NHIỄM')) continue;
      const isFuyumiBranch = el.id.toLowerCase().includes('fuyumi') || sysText.includes('TIỂU THƯ FUYUMI SỞ HỮU');
      bodyObj.systemInstruction.parts[0].text = updateAiPromptTextV14(sysText, isFuyumiBranch);
      ro.rawBody = JSON.stringify(bodyObj);
    }
    if (LEAK_RE.test(JSON.stringify(aiTree))) throw new Error('Confidential leak detected in AI Mention!');
    console.log(`[Offline OK] PATCH AI Mention: ${aiTree.length} elements`);
    const res = await deployViaCDP({
      mode: 'event',
      name: live.aiEv.name,
      elements: aiTree,
      enabled: live.aiEv.enabled,
    });
    console.log('[Patched] AI Mention:', JSON.stringify(res));
    if (!res?.ok) throw new Error(`Failed patching AI Mention: ${JSON.stringify(res)}`);
    await new Promise((r) => setTimeout(r, 1200));
  }

  // 4. Patch Keep-Alive Cron (12m) with Spirit Vein Settlement + Sunday 19:00 Top 10 Weekly Announcement
  if ((!onlyNames || onlyNames.has('keepalive')) && live.kaEv?.compressed_tree) {
    const kaTree = patchKeepAliveCron(JSON.parse(LZString.decompressFromBase64(live.kaEv.compressed_tree) || '[]'));
    assertAcyclicDAG(kaTree, 'keepalive');
    assertUniqueApiActionNames(kaTree, 'keepalive');
    const errs = validateGraph(kaTree);
    if (errs.length) throw new Error(`Validation failed for Keep-Alive: ${errs.join(', ')}`);
    console.log(`[Offline OK] PATCH Keep-Alive Cron: ${kaTree.length} elements`);
    const res = await deployViaCDP({
      mode: 'event',
      name: live.kaEv.name,
      elements: kaTree,
      enabled: live.kaEv.enabled,
    });
    console.log('[Patched] Keep-Alive Cron:', JSON.stringify(res));
    if (!res?.ok) throw new Error(`Failed patching Keep-Alive Cron: ${JSON.stringify(res)}`);
  }

  console.log('[v1.4 BotGhost Deploy] ALL COMPLETE cleanly!');
}

main().catch((err) => {
  console.error('[v1.4 BotGhost Deploy] FATAL:', err);
  process.exit(1);
});
