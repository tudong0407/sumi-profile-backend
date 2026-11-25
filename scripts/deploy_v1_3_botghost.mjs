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
import {
  BACKGROUND_CATALOG,
  EQUIPMENT_CATALOG,
  EXCHANGE_ITEMS,
  FARM_SEEDS,
  JOBS_CATALOG,
  MARRY_RINGS,
  PET_CATALOG,
  SHOP_CONSUMABLES,
  SHOP_ROLE_PACKAGES,
} from '../src/data/catalog.js';
import { getWikiData } from '../src/services/wikiService.js';

const PROFILE_GROUP_ID = '1782127263978';
const BACKEND_BASE = 'https://sumi-profile-backend.onrender.com';

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

class V13GraphBuilder extends GraphBuilder {
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
  fields = undefined,
  footer = 'SuMi Family • Tu Tiên Giới',
  target = { reply: true },
  editId = undefined,
  action_id = undefined,
}, pos = { x: 0, y: 0 }) {
  const embed = {
    title,
    description,
    color,
    url: '',
    thumbnail: { url: '' },
    image: { url: imageUrl },
    footer: { text: footer, icon_url: '' },
  };
  if (Array.isArray(fields) && fields.length > 0) embed.fields = fields;
  const data = {
    messageType: 'basic',
    useComponentsV2: false,
    target,
    success_handles: false,
    message: {
      content: '',
      embeds: [embed],
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

// ============================================================================
// NEW v1.3 SLASH COMMANDS (7 COMMANDS)
// ============================================================================

// 1. /linhvuc [hanh_dong] [tab] [ma_id]
export function buildLinhVucCmd() {
  const gb = new V13GraphBuilder();
  gb.rootSlash('linhvuc', 'Quản lý & trang bị Linh Vực, Thần Thức, Thần Cảnh kích hoạt từ Hiệp 2 trong chiến đấu', { ephemeral: false });
  gb.errorHandlerWait();
  gb.option('hanh_dong', 'string', 'Chọn thao tác (mặc định: view)', {
    required: false,
    choices: ['view', 'equip', 'unequip', 'dismantle'],
    x: 420,
    y: 0,
  });
  gb.option('tab', 'string', 'Lọc kho theo loại khi xem (overview / domain / sense / realm)', {
    required: false,
    choices: ['overview', 'domain', 'sense', 'realm'],
    x: 700,
    y: 0,
  });
  gb.option('ma_id', 'string', 'Mã UID / Emoji cần trang bị, phân giải (hoặc slot tháo: domain/sense/realm/all)', {
    required: false,
    x: 980,
    y: 0,
  });

  gb.cond('lv_mode', 'comparison', { base_value: '{option_hanh_dong}', target: { self: true } }, { x: 0, y: 220 });
  gb.link('root', 'lv_mode');
  const brEq = gb.branch('lv_mode', 'lv_mode_eq', 'comparison', { type: 'equal_to', comparison_value: 'equip', ignoreCase: true, option: '', not: false }, { x: -520, y: 400 });
  const cModeUneq = gb.branch('lv_mode', 'lv_mode_unq', 'comparison', { type: 'equal_to', comparison_value: 'unequip', ignoreCase: true, option: '', not: false }, { x: -120, y: 400 });
  const cModeDism = gb.branch('lv_mode', 'lv_mode_dism', 'comparison', { type: 'equal_to', comparison_value: 'dismantle', ignoreCase: true, option: '', not: false }, { x: 240, y: 400 });
  const brView = gb.elseBranch('lv_mode', 'lv_mode_view', 'comparison', { x: 640, y: 400 });

  // Branch A: equip
  embedMsg(gb, 'lv_eq_ack', {
    title: `${uidEm('su_realm_star')} Đang khai mở Trận Đồ Linh Vực...`,
    description: 'Đang khắc ấn trang bị `{option_ma_id}`...',
    color: '#a855f7',
    editId: 'lv_eq_ack',
  }, { x: -520, y: 580 });
  gb.link(brEq, 'lv_eq_ack');
  apiAction(gb, 'lv_eq_api', 'lv_eq_res', 'POST', `${BACKEND_BASE}/api/domain/equip`,
    '{"userId":"{user_id}","username":"{user_displayName}","targetId":"{option_ma_id}"}', { x: -520, y: 760 });
  gb.link('lv_eq_ack', 'lv_eq_api');
  const eqNoAck = attachUpdateAckBranch(gb, 'lveq', 'lv_eq_api', 'lv_eq_res', { editId: 'lv_eq_ack', x: -520, y: 940 });
  embedMsg(gb, 'lv_eq_edit', {
    title: `${uidEm('su_realm_star')} TRANG BỊ LINH VỰC • THẦN THỨC • THẦN CẢNH`,
    description: '{lv_eq_res.response.message}',
    color: '#a855f7',
    target: { editId: 'lv_eq_ack' },
    action_id: 'lv_eq_ack',
  }, { x: -520, y: 1140 });
  gb.link(eqNoAck, 'lv_eq_edit');

  // Branch B: unequip
  embedMsg(gb, 'lv_unq_ack', {
    title: `${uidEm('su_realm_star')} Đang thu hồi Linh Vực...`,
    description: 'Đang thu hồi slot `{option_ma_id}` về kho...',
    color: '#64748b',
    editId: 'lv_unq_ack',
  }, { x: -120, y: 580 });
  gb.link(cModeUneq, 'lv_unq_ack');
  apiAction(gb, 'lv_unq_api', 'lv_unq_res', 'POST', `${BACKEND_BASE}/api/domain/unequip`,
    '{"userId":"{user_id}","slot":"{option_ma_id}"}', { x: -120, y: 760 });
  gb.link('lv_unq_ack', 'lv_unq_api');
  const unqNoAck = attachUpdateAckBranch(gb, 'lvunq', 'lv_unq_api', 'lv_unq_res', { editId: 'lv_unq_ack', x: -120, y: 940 });
  embedMsg(gb, 'lv_unq_edit', {
    title: `${uidEm('su_realm_star')} THU HỒI LINH VỰC`,
    description: '{lv_unq_res.response.message}',
    color: '#64748b',
    target: { editId: 'lv_unq_ack' },
    action_id: 'lv_unq_ack',
  }, { x: -120, y: 1140 });
  gb.link(unqNoAck, 'lv_unq_edit');

  // Branch C: dismantle
  embedMsg(gb, 'lv_dism_ack', {
    title: `${uidEm('su_linhthach')} Đang luyện hóa phân giải...`,
    description: 'Đang phân giải `{option_ma_id}` thành Linh Thạch...',
    color: '#f59e0b',
    editId: 'lv_dism_ack',
  }, { x: 240, y: 580 });
  gb.link(cModeDism, 'lv_dism_ack');
  apiAction(gb, 'lv_dism_api', 'lv_dism_res', 'POST', `${BACKEND_BASE}/api/domain/dismantle`,
    '{"userId":"{user_id}","targetId":"{option_ma_id}"}', { x: 240, y: 760 });
  gb.link('lv_dism_ack', 'lv_dism_api');
  const dismNoAck = attachUpdateAckBranch(gb, 'lvdm', 'lv_dism_api', 'lv_dism_res', { editId: 'lv_dism_ack', x: 240, y: 940 });
  embedMsg(gb, 'lv_dism_edit', {
    title: `${uidEm('su_linhthach')} PHÂN GIẢI LINH VỰC`,
    description: '{lv_dism_res.response.message}',
    color: '#f59e0b',
    target: { editId: 'lv_dism_ack' },
    action_id: 'lv_dism_ack',
  }, { x: 240, y: 1140 });
  gb.link(dismNoAck, 'lv_dism_edit');

  // Branch D: view inventory
  embedMsg(gb, 'lv_v_ack', {
    title: `${uidEm('su_realm_star')} Đang mở Kho Linh Vực...`,
    description: 'Đang thống kê Linh Vực, Thần Thức & Thần Cảnh của {user_displayName}...',
    color: '#ec4899',
    editId: 'lv_v_ack',
  }, { x: 640, y: 580 });
  gb.link(brView, 'lv_v_ack');
  apiAction(gb, 'lv_v_api', 'lv_v_res', 'GET',
    `${BACKEND_BASE}/api/domain/inventory/{user_id}?view={option_tab}&username={encode_text[{user_displayName}]}&avatar={encode_text[{user_icon}]}`,
    '', { x: 640, y: 760 });
  gb.link('lv_v_ack', 'lv_v_api');
  const vNoAck = attachUpdateAckBranch(gb, 'lvv', 'lv_v_api', 'lv_v_res', { editId: 'lv_v_ack', x: 640, y: 940 });
  const cVOk = gb.cmp('lv_v_ok', '{lv_v_res.response.success}', 'true', 'equal_to', { ignoreCase: true }, { x: 640, y: 1120 });
  gb.link(vNoAck, cVOk.condId);
  embedMsg(gb, 'lv_v_edit', {
    title: '{lv_v_res.response.title}',
    description: '{lv_v_res.response.description}',
    color: '#ec4899',
    footer: '{lv_v_res.response.footer}',
    target: { editId: 'lv_v_ack' },
    action_id: 'lv_v_ack',
  }, { x: 520, y: 1320 });
  gb.link(cVOk.yes, 'lv_v_edit');
  embedMsg(gb, 'lv_v_err', {
    title: `${uidEm('su_realm_star')} KHO LINH VỰC TIÊN GIỚI`,
    description: '{lv_v_res.response.message}',
    color: '#f43f5e',
    target: { editId: 'lv_v_ack' },
    action_id: 'lv_v_ack',
  }, { x: 820, y: 1320 });
  gb.link(cVOk.no, 'lv_v_err');

  return gb.elements();
}

// 2. /coinflip <cuoc> <mat>
export function buildCoinflipCmd() {
  const gb = new V13GraphBuilder();
  gb.rootSlash('coinflip', 'Tung Đồng Xu Tiên Giới (10 – 10.000 LT • Trả thưởng 1:2)', { ephemeral: false });
  gb.errorHandlerWait();
  gb.option('cuoc', 'int', 'Số Linh Thạch đặt cược (10 – 10.000 LT)', { required: true, x: 420, y: 0 });
  gb.option('mat', 'string', 'Chọn mặt đặt cược (Ngửa / Sấp)', { required: true, choices: ['heads', 'tails'], x: 700, y: 0 });

  embedMsg(gb, 'cf_ack', {
    title: `${uidEm('coin_spin')} Đang tung Đồng Xu Tiên Giới...`,
    description: 'Đang kiểm tra mức cược `{option_cuoc}` LT...',
    color: '#f59e0b',
    editId: 'cf_ack',
  }, { x: 0, y: 220 });
  gb.link('root', 'cf_ack');

  apiAction(gb, 'cf_api', 'cf_res', 'POST', `${BACKEND_BASE}/api/minigame/coinflip`,
    '{"userId":"{user_id}","bet":"{option_cuoc}","choice":"{option_mat}","username":"{user_displayName}","fallbackUsername":"{user_displayName}","avatarUrl":"{user_icon}"}',
    { x: 0, y: 400 });
  gb.link('cf_ack', 'cf_api');

  const cfNoAck = attachUpdateAckBranch(gb, 'cf', 'cf_api', 'cf_res', { editId: 'cf_ack', x: 0, y: 580 });
  const cCfOk = gb.cmp('cf_ok', '{cf_res.response.success}', 'true', 'equal_to', { ignoreCase: true }, { x: 0, y: 780 });
  gb.link(cfNoAck, cCfOk.condId);

  embedMsg(gb, 'cf_spin_edit', {
    title: '{cf_res.response.spin_embed.title}',
    description: '{cf_res.response.spin_embed.description}',
    color: '#f59e0b',
    target: { editId: 'cf_ack' },
    action_id: 'cf_ack',
  }, { x: -200, y: 980 });
  gb.link(cCfOk.yes, 'cf_spin_edit');

  gb.act('cf_wait', 'wait_action', { seconds: '2', success_handles: false }, { x: -200, y: 1160 });
  gb.link('cf_spin_edit', 'cf_wait');

  embedMsg(gb, 'cf_final_edit', {
    title: '{cf_res.response.result_embed.title}',
    description: '{cf_res.response.result_embed.description}',
    color: '#ec4899',
    target: { editId: 'cf_ack' },
    action_id: 'cf_ack',
  }, { x: -200, y: 1360 });
  gb.link('cf_wait', 'cf_final_edit');

  embedMsg(gb, 'cf_err_edit', {
    title: `${uidEm('coin_spin')} TUNG ĐỒNG XU TIÊN GIỚI`,
    description: '{cf_res.response.message}',
    color: '#f43f5e',
    target: { editId: 'cf_ack' },
    action_id: 'cf_ack',
  }, { x: 220, y: 980 });
  gb.link(cCfOk.no, 'cf_err_edit');

  return gb.elements();
}

// 3. /slots <cuoc>
export function buildSlotsCmd() {
  const gb = new V13GraphBuilder();
  gb.rootSlash('slots', 'Quay Máy Tứ Bảo 4 Ô Tiên Giới (10 – 10.000 LT • Tối đa 1:5)', { ephemeral: false });
  gb.errorHandlerWait();
  gb.option('cuoc', 'int', 'Số Linh Thạch đặt cược (10 – 10.000 LT)', { required: true, x: 420, y: 0 });

  embedMsg(gb, 'sl_ack', {
    title: `${uidEm('slot_spin')} Đang kéo Cần Quay Tứ Bảo...`,
    description: 'Đang nạp `{option_cuoc}` Linh Thạch...',
    color: '#a855f7',
    editId: 'sl_ack',
  }, { x: 0, y: 220 });
  gb.link('root', 'sl_ack');

  apiAction(gb, 'sl_api', 'sl_res', 'POST', `${BACKEND_BASE}/api/minigame/slots`,
    '{"userId":"{user_id}","bet":"{option_cuoc}","username":"{user_displayName}","fallbackUsername":"{user_displayName}","avatarUrl":"{user_icon}"}',
    { x: 0, y: 400 });
  gb.link('sl_ack', 'sl_api');

  const slNoAck = attachUpdateAckBranch(gb, 'sl', 'sl_api', 'sl_res', { editId: 'sl_ack', x: 0, y: 580 });
  const cSlOk = gb.cmp('sl_ok', '{sl_res.response.success}', 'true', 'equal_to', { ignoreCase: true }, { x: 0, y: 780 });
  gb.link(slNoAck, cSlOk.condId);

  embedMsg(gb, 'sl_spin_edit', {
    title: '{sl_res.response.spin_embed.title}',
    description: '{sl_res.response.spin_embed.description}',
    color: '#a855f7',
    target: { editId: 'sl_ack' },
    action_id: 'sl_ack',
  }, { x: -200, y: 980 });
  gb.link(cSlOk.yes, 'sl_spin_edit');

  gb.act('sl_wait', 'wait_action', { seconds: '2', success_handles: false }, { x: -200, y: 1160 });
  gb.link('sl_spin_edit', 'sl_wait');

  embedMsg(gb, 'sl_final_edit', {
    title: '{sl_res.response.result_embed.title}',
    description: '{sl_res.response.result_embed.description}',
    color: '#ec4899',
    target: { editId: 'sl_ack' },
    action_id: 'sl_ack',
  }, { x: -200, y: 1360 });
  gb.link('sl_wait', 'sl_final_edit');

  embedMsg(gb, 'sl_err_edit', {
    title: `${uidEm('slot_spin')} MÁY QUAY TỨ BẢO TIÊN GIỚI`,
    description: '{sl_res.response.message}',
    color: '#f43f5e',
    target: { editId: 'sl_ack' },
    action_id: 'sl_ack',
  }, { x: 220, y: 980 });
  gb.link(cSlOk.no, 'sl_err_edit');

  return gb.elements();
}

// 4. /blackjack <cuoc>
export function buildBlackjackCmd() {
  const gb = new V13GraphBuilder();
  gb.rootSlash('blackjack', 'Xì Dách Tiên Giới 21 Điểm (10 – 10.000 LT • Rút / Dừng / Gấp Đôi)', { ephemeral: false });
  gb.errorHandlerWait();
  gb.option('cuoc', 'int', 'Số Linh Thạch đặt cược (10 – 10.000 LT)', { required: true, x: 420, y: 0 });

  embedMsg(gb, 'bj_ack', {
    title: `${uidEm('card_deal')} Đang chia bài Xì Dách Tiên Giới...`,
    description: 'Đang mở ván bài cược `{option_cuoc}` LT...',
    color: '#f59e0b',
    editId: 'bj_ack',
  }, { x: 0, y: 220 });
  gb.link('root', 'bj_ack');

  apiAction(gb, 'bj_api', 'bj_res', 'POST', `${BACKEND_BASE}/api/minigame/blackjack`,
    '{"userId":"{user_id}","bet":"{option_cuoc}","username":"{user_displayName}","fallbackUsername":"{user_displayName}","avatarUrl":"{user_icon}"}',
    { x: 0, y: 400 });
  gb.link('bj_ack', 'bj_api');

  const bjNoAck = attachUpdateAckBranch(gb, 'bj', 'bj_api', 'bj_res', { editId: 'bj_ack', x: 0, y: 580 });
  const cBjOk = gb.cmp('bj_ok', '{bj_res.response.success}', 'true', 'equal_to', { ignoreCase: true }, { x: 0, y: 780 });
  gb.link(bjNoAck, cBjOk.condId);

  embedMsg(gb, 'bj_err_edit', {
    title: `${uidEm('card_deal')} XÌ DÁCH TIÊN GIỚI`,
    description: '{bj_res.response.message}',
    color: '#f43f5e',
    target: { editId: 'bj_ack' },
    action_id: 'bj_ack',
  }, { x: 380, y: 980 });
  gb.link(cBjOk.no, 'bj_err_edit');

  const cBjFin = gb.cmp('bj_fin', '{bj_res.response.finished}', 'true', 'equal_to', { ignoreCase: true }, { x: -160, y: 980 });
  gb.link(cBjOk.yes, cBjFin.condId);

  embedMsg(gb, 'bj_nat_edit', {
    title: '{bj_res.response.embed.title}',
    description: '{bj_res.response.embed.description}',
    color: '#10b981',
    target: { editId: 'bj_ack' },
    action_id: 'bj_ack',
  }, { x: -420, y: 1180 });
  gb.link(cBjFin.yes, 'bj_nat_edit');

  embedMsg(gb, 'bj_play_edit', {
    title: '{bj_res.response.embed.title}',
    description: '{bj_res.response.embed.description}',
    color: '#f59e0b',
    footer: 'Bấm Rút Bài / Dừng Bài / Gấp Đôi ngay bên dưới',
    target: { editId: 'bj_ack' },
    action_id: 'bj_ack',
  }, { x: 0, y: 1180 });
  gb.link(cBjFin.no, 'bj_play_edit');

  // Interactive Hit / Stand / Double buttons
  const actions = [
    { id: 'hit', label: 'Rút Bài', style: 'PRIMARY', emoji: 'card_deal', anim: true, weight: '1', x: -320 },
    { id: 'stand', label: 'Dừng Bài', style: 'SUCCESS', emoji: 'card_win', anim: false, weight: '2', x: 0 },
    { id: 'double', label: 'Gấp Đôi', style: 'DANGER', emoji: 'su_linhthach', anim: true, weight: '3', x: 320 },
  ];
  for (const a of actions) {
    const bId = `bj_btn_${a.id}`;
    const apiId = `bj_${a.id}_api`;
    const resName = `bj_${a.id}_res`;
    const okId = `bj_${a.id}_ok`;
    gb.advBtn(bId, 'bj_play_edit', btnCfg(a.label, a.style, a.emoji, '1', a.weight, a.anim), { x: a.x, y: 1380 });
    apiAction(gb, apiId, resName, 'POST', `${BACKEND_BASE}/api/minigame/blackjack`,
      `{"userId":"{user_id}","action":"${a.id}","username":"{user_displayName}","fallbackUsername":"{user_displayName}","avatarUrl":"{user_icon}"}`,
      { x: a.x, y: 1560 });
    gb.link(bId, apiId);
    const cAct = gb.cmp(okId, `{${resName}.response.success}`, 'true', 'equal_to', { ignoreCase: true }, { x: a.x, y: 1740 });
    gb.link(apiId, cAct.condId);
    embedMsg(gb, `bj_${a.id}_msg`, {
      title: `{${resName}.response.embed.title}`,
      description: `{${resName}.response.embed.description}`,
      color: '#ec4899',
    }, { x: a.x - 80, y: 1940 });
    gb.link(cAct.yes, `bj_${a.id}_msg`);
    embedMsg(gb, `bj_${a.id}_err`, {
      title: `${uidEm('card_deal')} XÌ DÁCH TIÊN GIỚI`,
      description: `{${resName}.response.message}`,
      color: '#f43f5e',
    }, { x: a.x + 80, y: 1940 });
    gb.link(cAct.no, `bj_${a.id}_err`);
  }

  return gb.elements();
}

// 5. /crash <cuoc> [muc_rut]
export function buildCrashCmd() {
  const gb = new V13GraphBuilder();
  gb.rootSlash('crash', 'Phi Kiếm Độ Kiếp — Chốt lời trước khi Lôi Kiếp đánh nổ (10 – 10.000 LT)', { ephemeral: false });
  gb.errorHandlerWait();
  gb.option('cuoc', 'int', 'Số Linh Thạch đặt cược (10 – 10.000 LT)', { required: true, x: 420, y: 0 });
  gb.option('muc_rut', 'string', 'Hệ số tự động chốt lời (vd: 1.5, 2.0 • bỏ trống để tự bấm bay từng bước)', { required: false, x: 700, y: 0 });

  embedMsg(gb, 'cr_ack', {
    title: `${uidEm('crash_fly')} Đang khai mở Phi Kiếm Độ Kiếp...`,
    description: 'Đang nạp `{option_cuoc}` Linh Thạch cho chuyến bay...',
    color: '#38bdf8',
    editId: 'cr_ack',
  }, { x: 0, y: 220 });
  gb.link('root', 'cr_ack');

  apiAction(gb, 'cr_api', 'cr_res', 'POST', `${BACKEND_BASE}/api/minigame/crash`,
    '{"userId":"{user_id}","bet":"{option_cuoc}","autoCashout":"{option_muc_rut}","username":"{user_displayName}","fallbackUsername":"{user_displayName}","avatarUrl":"{user_icon}"}',
    { x: 0, y: 400 });
  gb.link('cr_ack', 'cr_api');

  const crNoAck = attachUpdateAckBranch(gb, 'cr', 'cr_api', 'cr_res', { editId: 'cr_ack', x: 0, y: 580 });
  const cCrOk = gb.cmp('cr_ok', '{cr_res.response.success}', 'true', 'equal_to', { ignoreCase: true }, { x: 0, y: 780 });
  gb.link(crNoAck, cCrOk.condId);

  embedMsg(gb, 'cr_err_edit', {
    title: `${uidEm('crash_boom')} PHI KIẾM ĐỘ KIẾP`,
    description: '{cr_res.response.message}',
    color: '#f43f5e',
    target: { editId: 'cr_ack' },
    action_id: 'cr_ack',
  }, { x: 360, y: 980 });
  gb.link(cCrOk.no, 'cr_err_edit');

  const cCrFin = gb.cmp('cr_fin', '{cr_res.response.finished}', 'true', 'equal_to', { ignoreCase: true }, { x: -160, y: 980 });
  gb.link(cCrOk.yes, cCrFin.condId);

  embedMsg(gb, 'cr_auto_edit', {
    title: '{cr_res.response.embed.title}',
    description: '{cr_res.response.embed.description}',
    color: '#10b981',
    target: { editId: 'cr_ack' },
    action_id: 'cr_ack',
  }, { x: -400, y: 1180 });
  gb.link(cCrFin.yes, 'cr_auto_edit');

  embedMsg(gb, 'cr_play_edit', {
    title: '{cr_res.response.embed.title}',
    description: '{cr_res.response.embed.description}',
    color: '#38bdf8',
    footer: 'Bấm Bay Tiếp để tăng hệ số hoặc Rút Tiền Ngay để bảo toàn phần thưởng',
    target: { editId: 'cr_ack' },
    action_id: 'cr_ack',
  }, { x: 0, y: 1180 });
  gb.link(cCrFin.no, 'cr_play_edit');

  const crBtns = [
    { id: 'step', label: 'Bay Tiếp', style: 'PRIMARY', emoji: 'crash_fly', anim: true, weight: '1', x: -200 },
    { id: 'cashout', label: 'Rút Tiền Ngay', style: 'SUCCESS', emoji: 'su_winner_trophy', anim: true, weight: '2', x: 200 },
  ];
  for (const b of crBtns) {
    const bId = `cr_btn_${b.id}`;
    const apiId = `cr_${b.id}_api`;
    const resName = `cr_${b.id}_res`;
    const okId = `cr_${b.id}_ok`;
    gb.advBtn(bId, 'cr_play_edit', btnCfg(b.label, b.style, b.emoji, '1', b.weight, b.anim), { x: b.x, y: 1380 });
    apiAction(gb, apiId, resName, 'POST', `${BACKEND_BASE}/api/minigame/crash`,
      `{"userId":"{user_id}","action":"${b.id}","username":"{user_displayName}","fallbackUsername":"{user_displayName}","avatarUrl":"{user_icon}"}`,
      { x: b.x, y: 1560 });
    gb.link(bId, apiId);
    const cAct = gb.cmp(okId, `{${resName}.response.success}`, 'true', 'equal_to', { ignoreCase: true }, { x: b.x, y: 1740 });
    gb.link(apiId, cAct.condId);
    embedMsg(gb, `cr_${b.id}_msg`, {
      title: `{${resName}.response.embed.title}`,
      description: `{${resName}.response.embed.description}`,
      color: '#ec4899',
    }, { x: b.x - 90, y: 1940 });
    gb.link(cAct.yes, `cr_${b.id}_msg`);
    embedMsg(gb, `cr_${b.id}_err`, {
      title: `${uidEm('crash_boom')} PHI KIẾM ĐỘ KIẾP`,
      description: `{${resName}.response.message}`,
      color: '#f43f5e',
    }, { x: b.x + 90, y: 1940 });
    gb.link(cAct.no, `cr_${b.id}_err`);
  }

  return gb.elements();
}

// 6. /farm [hanh_dong] [hat_giong]
export function buildFarmCmd() {
  const gb = new V13GraphBuilder();
  gb.rootSlash('farm', 'Linh Điền & Linh Thú Các — Trồng cây / ấp trứng thời gian thực nhận Linh Thạch & Linh Quả', { ephemeral: false });
  gb.errorHandlerWait();
  gb.option('hanh_dong', 'string', 'Chọn thao tác (mặc định: status)', {
    required: false,
    choices: ['status', 'plant', 'care', 'harvest', 'clear'],
    x: 420,
    y: 0,
  });
  gb.option('hat_giong', 'string', 'Chọn hạt giống / trứng khi trồng (plant • tự chọn ô trống)', {
    required: false,
    choices: FARM_SEEDS.map((s) => s.seed_id),
    x: 700,
    y: 0,
  });

  gb.cond('fm_mode', 'comparison', { base_value: '{option_hanh_dong}', target: { self: true } }, { x: 0, y: 220 });
  gb.link('root', 'fm_mode');
  const brPlant = gb.branch('fm_mode', 'fm_plant', 'comparison', { type: 'equal_to', comparison_value: 'plant', ignoreCase: true, option: '', not: false }, { x: -580, y: 400 });
  const brCare = gb.branch('fm_mode', 'fm_care', 'comparison', { type: 'equal_to', comparison_value: 'care', ignoreCase: true, option: '', not: false }, { x: -240, y: 400 });
  const brHarv = gb.branch('fm_mode', 'fm_harv', 'comparison', { type: 'equal_to', comparison_value: 'harvest', ignoreCase: true, option: '', not: false }, { x: 100, y: 400 });
  const brClr = gb.branch('fm_mode', 'fm_clr', 'comparison', { type: 'equal_to', comparison_value: 'clear', ignoreCase: true, option: '', not: false }, { x: 440, y: 400 });
  const brStat = gb.elseBranch('fm_mode', 'fm_stat', 'comparison', { x: 880, y: 400 });

  // Plant branch
  embedMsg(gb, 'fm_p_ack', {
    title: `${uidEm('seed_linh_thao')} Đang gieo trồng Linh Điền...`,
    description: 'Đang tự chọn ô trống phù hợp và đặt `{option_hat_giong}`...',
    color: '#10b981',
    editId: 'fm_p_ack',
  }, { x: -580, y: 580 });
  gb.link(brPlant, 'fm_p_ack');
  apiAction(gb, 'fm_p_api', 'fm_p_res', 'POST', `${BACKEND_BASE}/api/farm/plant`,
    '{"userId":"{user_id}","seedId":"{option_hat_giong}","username":"{user_displayName}"}', { x: -580, y: 760 });
  gb.link('fm_p_ack', 'fm_p_api');
  const fmPNoAck = attachUpdateAckBranch(gb, 'fmp', 'fm_p_api', 'fm_p_res', { editId: 'fm_p_ack', x: -580, y: 940 });
  embedMsg(gb, 'fm_p_edit', {
    title: `${uidEm('seed_linh_thao')} LINH ĐIỀN & LINH THÚ CÁC`,
    description: '{fm_p_res.response.message}',
    color: '#10b981',
    target: { editId: 'fm_p_ack' },
    action_id: 'fm_p_ack',
  }, { x: -580, y: 1140 });
  gb.link(fmPNoAck, 'fm_p_edit');

  // Care / Harvest / Clear direct branches
  const simpleOps = [
    { key: 'care', br: brCare, ack: 'fm_c_ack', api: 'fm_c_api', res: 'fm_c_res', gate: 'fmc', url: `${BACKEND_BASE}/api/farm/care`, title: `${uidEm('seed_linh_thao')} TƯỚI NƯỚC & CHĂM SÓC`, x: -240 },
    { key: 'harvest', br: brHarv, ack: 'fm_h_ack', api: 'fm_h_api', res: 'fm_h_res', gate: 'fmh', url: `${BACKEND_BASE}/api/farm/harvest`, title: `${uidEm('farm_essence')} THU HOẠCH NÔNG TRẠI`, x: 100 },
    { key: 'clear', br: brClr, ack: 'fm_cl_ack', api: 'fm_cl_api', res: 'fm_cl_res', gate: 'fmcl', url: `${BACKEND_BASE}/api/farm/clear`, title: `${uidEm('tower_reset_card')} DỌN Ô BỊ HÉO`, x: 440 },
  ];
  for (const op of simpleOps) {
    embedMsg(gb, op.ack, {
      title: op.title,
      description: 'Đang xử lý nông trại của {user_displayName}...',
      color: '#10b981',
      editId: op.ack,
    }, { x: op.x, y: 580 });
    gb.link(op.br, op.ack);
    apiAction(gb, op.api, op.res, 'POST', op.url, '{"userId":"{user_id}","username":"{user_displayName}"}', { x: op.x, y: 760 });
    gb.link(op.ack, op.api);
    const noAck = attachUpdateAckBranch(gb, op.gate, op.api, op.res, { editId: op.ack, x: op.x, y: 940 });
    embedMsg(gb, `fm_${op.key}_edit`, {
      title: op.title,
      description: `{${op.res}.response.message}`,
      color: '#10b981',
      target: { editId: op.ack },
      action_id: op.ack,
    }, { x: op.x, y: 1140 });
    gb.link(noAck, `fm_${op.key}_edit`);
  }

  // Status branch + 3 quick action buttons
  embedMsg(gb, 'fm_s_ack', {
    title: `${uidEm('farm_essence')} Đang thăm Linh Điền & Linh Thú Các...`,
    description: 'Đang đồng bộ thời gian sinh trưởng từng ô...',
    color: '#10b981',
    editId: 'fm_s_ack',
  }, { x: 880, y: 580 });
  gb.link(brStat, 'fm_s_ack');
  apiAction(gb, 'fm_s_api', 'fm_s_res', 'GET',
    `${BACKEND_BASE}/api/farm/status/{user_id}?username={encode_text[{user_displayName}]}`, '', { x: 880, y: 760 });
  gb.link('fm_s_ack', 'fm_s_api');
  const sNoAck = attachUpdateAckBranch(gb, 'fms', 'fm_s_api', 'fm_s_res', { editId: 'fm_s_ack', x: 880, y: 940 });
  const cSOk = gb.cmp('fm_s_ok', '{fm_s_res.response.success}', 'true', 'equal_to', { ignoreCase: true }, { x: 880, y: 1120 });
  gb.link(sNoAck, cSOk.condId);

  embedMsg(gb, 'fm_s_edit', {
    title: '{fm_s_res.response.title}',
    description: '{fm_s_res.response.description}',
    color: '#10b981',
    footer: '{fm_s_res.response.footer}',
    target: { editId: 'fm_s_ack' },
    action_id: 'fm_s_ack',
  }, { x: 760, y: 1320 });
  gb.link(cSOk.yes, 'fm_s_edit');

  embedMsg(gb, 'fm_s_err', {
    title: `${uidEm('farm_essence')} NÔNG TRẠI TIÊN GIỚI`,
    description: '{fm_s_res.response.message}',
    color: '#f43f5e',
    target: { editId: 'fm_s_ack' },
    action_id: 'fm_s_ack',
  }, { x: 1120, y: 1320 });
  gb.link(cSOk.no, 'fm_s_err');

  const fmBtns = [
    { id: 'care', label: 'Tưới / Cho Ăn', style: 'PRIMARY', emoji: 'seed_linh_thao', weight: '1', url: `${BACKEND_BASE}/api/farm/care`, title: `${uidEm('seed_linh_thao')} TƯỚI NƯỚC & CHĂM SÓC`, x: 560 },
    { id: 'harv', label: 'Thu Hoạch', style: 'SUCCESS', emoji: 'farm_essence', weight: '2', url: `${BACKEND_BASE}/api/farm/harvest`, title: `${uidEm('farm_essence')} THU HOẠCH NÔNG TRẠI`, x: 780 },
    { id: 'clr', label: 'Dọn Ô Héo', style: 'SECONDARY', emoji: 'tower_reset_card', weight: '3', url: `${BACKEND_BASE}/api/farm/clear`, title: `${uidEm('tower_reset_card')} DỌN Ô BỊ HÉO`, x: 1000 },
  ];
  for (const b of fmBtns) {
    const bId = `fm_btn_${b.id}`;
    const apiId = `fm_b_${b.id}_api`;
    const resName = `fm_b_${b.id}_res`;
    gb.advBtn(bId, 'fm_s_edit', btnCfg(b.label, b.style, b.emoji, '1', b.weight, false), { x: b.x, y: 1520 });
    apiAction(gb, apiId, resName, 'POST', b.url, '{"userId":"{user_id}","username":"{user_displayName}"}', { x: b.x, y: 1700 });
    gb.link(bId, apiId);
    embedMsg(gb, `fm_b_${b.id}_msg`, {
      title: b.title,
      description: `{${resName}.response.message}`,
      color: '#10b981',
    }, { x: b.x, y: 1880 });
    gb.link(apiId, `fm_b_${b.id}_msg`);
  }

  return gb.elements();
}

// 7. /exchange [hanh_dong] [ma_qua] [so_luong]
export function buildExchangeCmd() {
  const gb = new V13GraphBuilder();
  gb.rootSlash('exchange', 'Quy đổi Linh Quả Tiên Giới lấy Linh Thạch, Đá Khắc Ấn, Vé Gacha & Mở Ô Nông Trại', { ephemeral: false });
  gb.errorHandlerWait();
  gb.option('hanh_dong', 'string', 'Chọn xem bảng hoặc đổi quà (mặc định: list)', {
    required: false,
    choices: ['list', 'buy'],
    x: 420,
    y: 0,
  });
  gb.option('ma_qua', 'string', 'Mã vật phẩm muốn quy đổi', {
    required: false,
    choices: EXCHANGE_ITEMS.map((x) => x.exchange_id),
    x: 700,
    y: 0,
  });
  gb.option('so_luong', 'int', 'Số lượng quy đổi (mặc định: 1)', {
    required: false,
    x: 980,
    y: 0,
  });

  const cMode = gb.cmp('ex_mode', '{option_hanh_dong}', 'buy', 'equal_to', { ignoreCase: true }, { x: 0, y: 220 });
  gb.link('root', cMode.condId);

  // Branch A: buy
  embedMsg(gb, 'ex_b_ack', {
    title: `${uidEm('farm_essence')} Đang thực hiện Quy Đổi Linh Quả...`,
    description: 'Đang kiểm tra số dư Linh Quả và vật phẩm `{option_ma_qua}`...',
    color: '#f59e0b',
    editId: 'ex_b_ack',
  }, { x: -240, y: 420 });
  gb.link(cMode.yes, 'ex_b_ack');
  apiAction(gb, 'ex_b_api', 'ex_b_res', 'POST', `${BACKEND_BASE}/api/exchange/buy`,
    '{"userId":"{user_id}","exchangeId":"{option_ma_qua}","quantity":"{option_so_luong}","username":"{user_displayName}"}',
    { x: -240, y: 600 });
  gb.link('ex_b_ack', 'ex_b_api');
  const exNoAck = attachUpdateAckBranch(gb, 'exb', 'ex_b_api', 'ex_b_res', { editId: 'ex_b_ack', x: -240, y: 780 });
  embedMsg(gb, 'ex_b_edit', {
    title: `${uidEm('farm_essence')} QUY ĐỔI LINH QUẢ TIÊN GIỚI`,
    description: '{ex_b_res.response.message}',
    color: '#10b981',
    target: { editId: 'ex_b_ack' },
    action_id: 'ex_b_ack',
  }, { x: -240, y: 980 });
  gb.link(exNoAck, 'ex_b_edit');

  // Branch B: list
  embedMsg(gb, 'ex_l_ack', {
    title: `${uidEm('farm_essence')} Đang mở Bảng Quy Đổi Linh Quả...`,
    description: 'Đang tải danh mục vật phẩm và số lượng Linh Quả hiện có...',
    color: '#f59e0b',
    editId: 'ex_l_ack',
  }, { x: 240, y: 420 });
  gb.link(cMode.no, 'ex_l_ack');
  apiAction(gb, 'ex_l_api', 'ex_l_res', 'GET', `${BACKEND_BASE}/api/exchange/catalog?userId={user_id}`, '', { x: 240, y: 600 });
  gb.link('ex_l_ack', 'ex_l_api');
  embedMsg(gb, 'ex_l_edit', {
    title: '{ex_l_res.response.title}',
    description: '{ex_l_res.response.description}',
    color: '#f59e0b',
    footer: '{ex_l_res.response.footer}',
    target: { editId: 'ex_l_ack' },
    action_id: 'ex_l_ack',
  }, { x: 240, y: 800 });
  gb.link('ex_l_api', 'ex_l_edit');

  return gb.elements();
}

// ============================================================================
// PATCHING EXISTING LIVE COMMANDS + AI MENTION + GLOBAL V1.3 UID CLEANUP
// ============================================================================

const JOB_BY_ID = Object.fromEntries(JOBS_CATALOG.map((j) => [j.job_id, j]));

const EMOJI_TAG_RENAMES = [
  ['su_enchant_stone', 'enchant_stone'],
  ['su_tower_reset_card', 'tower_reset_card'],
  ['su_frame_token', 'frame_unlock_token'],
  ['su_star_stone', 'pet_star_stone'],
  ['su_ring_thanthoai', 'ring_mythic'],
  ['su_ring_tien', 'ring_epic'],
  ['su_ring_linh', 'ring_rare'],
  ['su_ring_pham', 'ring_common'],
  ['su_ticket_equip', 'gacha_ticket_equip'],
  ['su_ticket_pet', 'gacha_ticket_pet'],
  ['su_title_card', 'title_rename_card'],
];

function patchTreeStringsInPlace(tree) {
  let json = JSON.stringify(tree);
  for (const [oldTag, newTag] of EMOJI_TAG_RENAMES) {
    json = json.split(oldTag).join(newTag);
  }
  json = json
    .split('Tôi Đã Đọc & Xác Nhận Cập Nhật v1.2').join('Tôi Đã Đọc & Xác Nhận Cập Nhật v1.3')
    .split('ĐÃ XÁC NHẬN CẬP NHẬT v1.2').join('ĐÃ XÁC NHẬN CẬP NHẬT v1.3')
    .split('Phiên bản v1.2 đã được mở khóa').join('Phiên bản v1.3 đã được mở khóa');
  return JSON.parse(json);
}

function patchSpecificCommand(name, tree) {
  let patched = patchTreeStringsInPlace(tree);
  const wikiData = name === 'wiki' ? getWikiData() : null;
  const shopPets = name === 'shop'
    ? PET_CATALOG.filter((p) => !p.is_exclusive_fuyumi && (p.rarity_key === 'common' || p.rarity_key === 'rare'))
    : [];
  const shopEquip = name === 'shop'
    ? EQUIPMENT_CATALOG.filter((e) => !e.is_exclusive_fuyumi && (e.rarity_key === 'common' || e.rarity_key === 'rare'))
    : [];

  if (name === 'roll') {
    const root = patched.find((n) => n.id === 'root');
    if (root?.data) {
      root.data.description = 'Quay Gacha Pháp Bảo, Linh Thú, Linh Vực hoặc Role Quyền Năng (50–60 LT/lượt)';
    }
    const optLoai = patched.find((n) => n.id === 'opt_loai');
    if (optLoai?.data?.data) {
      optLoai.data.data.description = 'Chọn bể quay Gacha (equipment / pet / domain / role)';
      optLoai.data.data.choices = ['equipment', 'pet', 'domain', 'role'];
    }
  }

  if (name === 'job') {
    const root = patched.find((n) => n.id === 'root');
    if (root?.data) {
      root.data.description = 'Làm việc vặt Tông Môn kiếm Linh Thạch & EXP (6 nghề • tối đa 8 ca/ngày • hồi chiêu 1 giờ)';
    }
    const workEdit = patched.find((n) => n.id === 'job_work_edit');
    if (workEdit?.data?.data?.message?.embeds?.[0]?.footer) {
      workEdit.data.data.message.embeds[0].footer.text = 'SuMi Family • Làm tối đa 8 ca/ngày (Reset 00:00 UTC+7)';
    }
    const statEdit = patched.find((n) => n.id === 'job_stat_edit');
    if (statEdit?.data?.data?.message?.embeds?.[0]) {
      statEdit.data.data.message.embeds[0].title = `${uidEm('su_linhthach')} BẢNG CÔNG VIỆC TÔNG MÔN (8 CA/NGÀY)`;
      if (statEdit.data.data.message.embeds[0].footer) {
        statEdit.data.data.message.embeds[0].footer.text = 'SuMi Family • Chọn nghề ở menu bên dưới hoặc gõ /job nghe:... (Max 8 ca/ngày • Cooldown 1 giờ)';
      }
    }
    const selJob = patched.find((n) => n.id === 'sel_job_pick');
    if (selJob?.data?.data?.basic_options) {
      selJob.data.data.basic_options = selJob.data.data.basic_options.map((opt) => {
        const meta = JOB_BY_ID[opt.value];
        if (!meta) return opt;
        return {
          ...opt,
          label: String(meta.name).slice(0, 95),
          description: `${meta.ltMin}–${meta.ltMax} LT + ${meta.exp} EXP • Cooldown 1 giờ`.slice(0, 95),
        };
      });
    }
  }

  if (name === 'nhiemvu') {
    const ack = patched.find((n) => n.id === 'nv_claim_ack');
    if (ack?.data?.data?.message?.embeds?.[0]) {
      ack.data.data.message.embeds[0].description = 'Đang xác nhận điều kiện hoàn tất 5/5 Nhiệm Vụ Ngày...';
    }
    const wEdit = patched.find((n) => n.id === 'nv_claim_edit');
    if (wEdit?.data?.data?.message?.embeds?.[0]?.footer) {
      wEdit.data.data.message.embeds[0].footer.text = 'SuMi Family • 5 Nhiệm Vụ Ngày & Khế Ước Tuần';
    }
  }

  if (name === 'updates') {
    const root = patched.find((n) => n.id === 'root');
    if (root?.data) {
      root.data.description = 'Xem bản cập nhật mới nhất (v1.3.1) và chọn xem lại lịch sử các phiên bản cũ qua menu';
    }
    const sel = patched.find((n) => n.id === 'sel_upds_ver');
    if (sel?.data?.data) {
      sel.data.data.placeholder = 'Chọn phiên bản cập nhật để xem chi tiết (v1.3.1 / v1.3 / v1.2 / v1.1)...';
      sel.data.data.basic_options = [
        {
          label: 'Phiên bản v1.3.1 (Mới nhất)',
          description: 'Linh Vực trên /profile & /battle, Emoji 5 Vực, Sơ đồ /wiki 3 cột & Kho Linh Thú',
          emoji_id: uidId('su_realm_star'),
          value: '1.3.1',
        },
        {
          label: 'Phiên bản v1.3',
          description: 'Linh Vực, 50 Pet, 100 Pháp Bảo, 4 Minigame, Nông Trại /farm & /exchange',
          emoji_id: uidId('domain_unique_1'),
          value: '1.3',
        },
        {
          label: 'Phiên bản v1.2',
          description: 'Khắc Ấn D→S, 6 Việc Làm /job, Tháp 200 Tầng, Khế Ước Tuần, Túi Đồ /inv mới',
          emoji_id: uidId('enchant_stone'),
          value: '1.2',
        },
        {
          label: 'Phiên bản v1.1',
          description: 'Mở rộng Gacha, /info, /phapbao, Thẻ Reset Tháp & cân bằng',
          emoji_id: uidId('su_wiki_scroll'),
          value: '1.1',
        },
      ];
    }
  }

  if (name === 'shop') {
    const paidBgs = BACKGROUND_CATALOG.filter((b) => b.price > 0);
    const publicPets = PET_CATALOG.filter((p) => !p.is_exclusive_fuyumi);
    const home = patched.find((n) => n.id === 'msg_shop_home');
    if (home?.data?.data?.message?.embeds?.[0]) {
      home.data.data.message.embeds[0].description = [
        `${uidEm('ring_mythic')} **Nhẫn Cưới (4 cấp)**: Phàm (500) • Linh (2.000) • Tiên (6.000) • Thần Thoại (18.000).`,
        `${uidEm('su_pet_paw')} **Linh Thú (${shopPets.length} loài)**: Bán thẳng Pet Phàm Phẩm (300) & Linh Phẩm (900).`,
        `${uidEm('su_crossed_swords')} **Pháp Bảo (${shopEquip.length} món)**: Bán thẳng Pháp Bảo Phàm (250) & Linh (750).`,
        `${uidEm('su_medal_role')} **Role Quyền Năng (${SHOP_ROLE_PACKAGES.length} gói)**: Thuê nhanh 7 Ngày, 30 Ngày hoặc mua Vĩnh Viễn.`,
        `${uidEm('pet_star_stone')} **Vật Phẩm (${SHOP_CONSUMABLES.length} món)**: Vé Pháp Bảo (50), Vé Pet (50), Vé Linh Vực (60), Đá Sao (100), Đá Khắc Ấn (150), Reset Tháp (200), Danh Hiệu (300), Khung (800).`,
        `${uidEm('frame_unlock_token')} **Background Hồ Sơ (${paidBgs.length} mẫu)**: Bộ sưu tập nền Trang Trí (300–4.000 Linh Thạch).`,
        '',
        `${uidEm('su_gacha_dice')} *Pet/Pháp Bảo/Linh Vực Tiên & Thần Thoại mở qua \`/roll\` (${publicPets.length} Pet • ${EQUIPMENT_CATALOG.length} Pháp Bảo).*`,
      ].join('\n');
    }

    const selCat = patched.find((n) => n.id === 'sel_shop_cat');
    if (selCat?.data?.data?.basic_options) {
      selCat.data.data.basic_options = [
        { label: `Nhẫn Cưới Tiên Lữ (${MARRY_RINGS.length} cấp)`, description: 'Mua nhẫn cầu hôn hoặc nâng cấp nhẫn đang đeo', emoji_id: uidId('ring_mythic'), value: 'rings' },
        { label: `Linh Thú Phàm & Linh (${shopPets.length} loài)`, description: '300 - 900 Linh Thạch (Tiên/Thần Thoại chỉ qua /roll)', emoji_id: uidId('su_pet_paw'), value: 'pets' },
        { label: `Pháp Bảo Phàm & Linh (${shopEquip.length} món)`, description: '250 - 750 Linh Thạch (Vũ Khí, Bảo Ngọc, Chiến Hồn)', emoji_id: uidId('su_crossed_swords'), value: 'equipment' },
        { label: `Role Quyền Năng (${SHOP_ROLE_PACKAGES.length} gói)`, description: 'Thuê 7 Ngày / 30 Ngày hoặc sở hữu Vĩnh Viễn', emoji_id: uidId('su_medal_role'), value: 'roles' },
        { label: `Vật Phẩm & Trang Trí (${SHOP_CONSUMABLES.length} món)`, description: 'Vé Gacha (Pháp Bảo/Pet/Linh Vực), Đá Sao, Đá Khắc Ấn, Reset Tháp, Khung', emoji_id: uidId('pet_star_stone'), value: 'consumables' },
        { label: `Background Profile & Rank (${paidBgs.length} mẫu)`, description: '20 mẫu nền trang trí thẻ /profile & /rank (300 - 4.000 LT)', emoji_id: uidId('frame_unlock_token'), value: 'backgrounds' },
      ];
    }

    const msgPets = patched.find((n) => n.id === 'msg_shop_pets');
    if (msgPets?.data?.data?.message?.embeds?.[0]) {
      const commonCnt = shopPets.filter((p) => p.rarity_key === 'common').length;
      const rareCnt = shopPets.filter((p) => p.rarity_key === 'rare').length;
      msgPets.data.data.message.embeds[0].title = `${uidEm('su_pet_paw')} QUẦY LINH THÚ PHÀM & LINH (${shopPets.length} LOÀI)`;
      msgPets.data.data.message.embeds[0].description = [
        `• **Phàm Phẩm (${commonCnt} loài)**: \`300\` ${uidEm('su_linhthach')}`,
        `• **Linh Phẩm (${rareCnt} loài)**: \`900\` ${uidEm('su_linhthach')}`,
        `• *Menu bên dưới hiển thị 25 mẫu đầu; dùng \`/info <mã>\` nếu muốn xem đầy đủ toàn kho.*`,
      ].join('\n');
    }
    const selPet = patched.find((n) => n.id === 'sel_shop_pet');
    if (selPet?.data?.data) {
      selPet.data.data.placeholder = `Chọn Linh Thú Phàm / Linh Phẩm (25/${shopPets.length} mẫu)`;
      selPet.data.data.basic_options = shopPets.slice(0, 25).map((p) => ({
        label: String(p.pet_name || p.name).slice(0, 95),
        description: `${p.rarity} • Hệ ${p.element} • ${p.price} LT`.slice(0, 95),
        emoji_id: uidId(p.emoji_key || p.pet_type, 'su_pet_paw'),
        value: p.pet_type,
      }));
    }

    const msgEq = patched.find((n) => n.id === 'msg_shop_equip');
    if (msgEq?.data?.data?.message?.embeds?.[0]) {
      const commonEq = shopEquip.filter((e) => e.rarity_key === 'common').length;
      const rareEq = shopEquip.filter((e) => e.rarity_key === 'rare').length;
      msgEq.data.data.message.embeds[0].title = `${uidEm('su_crossed_swords')} QUẦY PHÁP BẢO PHÀM & LINH (${shopEquip.length} MÓN)`;
      msgEq.data.data.message.embeds[0].description = [
        `• **Phàm Phẩm (${commonEq} món)**: \`250\` ${uidEm('su_linhthach')}`,
        `• **Linh Phẩm (${rareEq} món)**: \`750\` ${uidEm('su_linhthach')}`,
        `• *Pháp Bảo Tiên Phẩm & Thần Thoại mở khóa qua \`/roll\`.*`,
      ].join('\n');
    }
    const buildEqOpts = (type) => shopEquip
      .filter((e) => e.item_type === type)
      .slice(0, 25)
      .map((e) => ({
        label: String(e.item_name || e.name).slice(0, 95),
        description: `${e.rarity} • Hệ ${e.element} • ${e.price} LT`.slice(0, 95),
        emoji_id: uidId(e.emoji_key || e.item_id, 'su_crossed_swords'),
        value: e.item_id,
      }));
    const selW = patched.find((n) => n.id === 'sel_shop_eq_w');
    if (selW?.data?.data) {
      const wOpts = buildEqOpts('weapon');
      selW.data.data.placeholder = `Vũ Khí Phàm & Linh (${wOpts.length} món)`;
      selW.data.data.basic_options = wOpts;
    }
    const selG = patched.find((n) => n.id === 'sel_shop_eq_g');
    if (selG?.data?.data) {
      const gOpts = buildEqOpts('gem');
      selG.data.data.placeholder = `Bảo Ngọc Phàm & Linh (${gOpts.length} món)`;
      selG.data.data.basic_options = gOpts;
    }
    const selS = patched.find((n) => n.id === 'sel_shop_eq_s');
    if (selS?.data?.data) {
      const sOpts = buildEqOpts('soul');
      selS.data.data.placeholder = `Chiến Hồn Phàm & Linh (${sOpts.length} món)`;
      selS.data.data.basic_options = sOpts;
    }

    const msgCons = patched.find((n) => n.id === 'msg_shop_cons');
    if (msgCons?.data?.data?.message?.embeds?.[0]) {
      msgCons.data.data.message.embeds[0].title = `${uidEm('pet_star_stone')} QUẦY VẬT PHẨM & TRANG TRÍ (${SHOP_CONSUMABLES.length} MÓN)`;
      msgCons.data.data.message.embeds[0].description = SHOP_CONSUMABLES.map((c) => {
        const icon = uidEm(c.item_id, c.icon);
        return `• ${icon} **${c.name}** — **${c.price.toLocaleString('vi-VN')}** ${uidEm('su_linhthach')}\n  *${c.description}*`;
      }).join('\n');
    }
    const selCons = patched.find((n) => n.id === 'sel_shop_cons');
    if (selCons?.data?.data) {
      selCons.data.data.placeholder = `Chọn Vật Phẩm Tiêu Hao / Trang Trí (${SHOP_CONSUMABLES.length} món)`;
      selCons.data.data.basic_options = SHOP_CONSUMABLES.map((c) => ({
        label: String(c.name).slice(0, 95),
        description: `${c.price} LT • ${c.description}`.slice(0, 95),
        emoji_id: uidId(c.item_id === 'gacha_ticket_domain' ? 'su_gacha_dice' : c.item_id, 'su_gacha_dice'),
        value: c.item_id,
      }));
    }
  }

  if (name === 'wiki' && wikiData?.categories) {
    const catMap = Object.fromEntries(wikiData.categories.map((c) => [c.id, c]));
    const msgHome = patched.find((n) => n.id === 'msg_wiki_home');
    if (msgHome?.data?.data?.message?.embeds?.[0]) {
      msgHome.data.data.message.embeds[0].title = `${uidEm('su_wiki_scroll')} CẨM NANG TU TIÊN SUMI FAMILY v1.3.1`;
      msgHome.data.data.message.embeds[0].description = 'Hệ thống tu tiên SuMi Family v1.3.1: Cảnh Giới, EXP Chat/Voice, 90 Linh Thú, 165 Pháp Bảo, 30 Linh Vực / 15 Thần Thức / 15 Thần Cảnh, Khắc Ấn D→S, Nông Trại `/farm`, `/exchange`, 4 Minigame, `/job` 8 ca/ngày & 5 Nhiệm Vụ Ngày. Dùng `/info <mã>` để tra chi tiết từng bảo vật.';
    }
    const syncPairs = [
      ['msg_wiki_overview_leaf', 'overview'],
      ['msg_wiki_realms', 'realms'],
      ['msg_wiki_battle', 'battle'],
      ['msg_wiki_equip', 'equipment'],
      ['msg_wiki_pets', 'pets'],
      ['msg_wiki_economy', 'economy'],
    ];
    for (const [nodeId, catId] of syncPairs) {
      const node = patched.find((n) => n.id === nodeId);
      const cat = catMap[catId];
      if (node?.data?.data?.message?.embeds?.[0] && cat) {
        node.data.data.message.embeds[0].title = cat.title;
        node.data.data.message.embeds[0].description = cat.content;
        if (cat.image_url) node.data.data.message.embeds[0].image = { url: cat.image_url };
        if (Array.isArray(cat.fields)) node.data.data.message.embeds[0].fields = cat.fields;
      }
    }
    const selWiki = patched.find((n) => n.id === 'sel_wiki_cat');
    if (selWiki?.data?.data?.basic_options) {
      selWiki.data.data.basic_options = selWiki.data.data.basic_options.map((o) => {
        if (o.value === 'equipment') return { ...o, description: '165 Pháp Bảo (57 Vũ Khí • 54 Bảo Ngọc • 54 Chiến Hồn)' };
        if (o.value === 'pets') return { ...o, description: '90 Linh Thú công khai (Phàm → Thần Thoại) & Độ Hiếm' };
        if (o.value === 'battle') return { ...o, description: '1v1 PvP/PvE, Ngũ Hành, Dị Tố & Hệ Thống Linh Vực' };
        if (o.value === 'economy') return { ...o, description: '/daily, /job 8 ca, /farm, /exchange, Minigame & 5 Nhiệm Vụ' };
        return o;
      });
    }
  }

  return patched;
}

// ============================================================================
// AI MENTION KNOWLEDGE BASE SYNC TO v1.3
// ============================================================================
function buildV13KnowledgeBlock(includeFuyumiSecret) {
  const lines = [
    'KIẾN THỨC CHÍNH THỨC HỆ THỐNG BOT NHIỄM NHIỄM (SUMI FAMILY v1.3.1):',
    '• HỒ SƠ & EXP (/profile, /rank, /top): Thẻ /profile hiển thị đầy đủ Linh Thú, 3 Pháp Bảo, 5 Role và bộ Linh Vực • Thần Thức • Thần Cảnh đang trang bị. Chat nhận 20-30 EXP (cooldown 45s), Voice nhận 85-135 EXP/5 phút (có chấm công định kỳ nền mỗi 12 phút, chỉ tính khi có >= 2 người không AFK/mute và không bị Cách Ly/Locked XP). Lên cấp: 60*(Lv^1.45) (max Lv.100 = 500.000 EXP), lên cấp mới thưởng LT mỗi mốc Lv (mỗi Lv chỉ nhận 1 lần duy nhất). /top bang_xep_hang xem level, power, wealth, marry.',
    '• 7 CẢNH GIỚI & SLOT ROLE: I. Luyện Khí (Lv.1-19: 1 slot), II. Trúc Cơ (Lv.20-39: 2 slot), III. Kim Đan (Lv.40-59: 3 slot), IV. Nguyên Anh (Lv.60-79: 4 slot), V. Hóa Thần (Lv.80-89: 5 slot), VI. Đại Thừa (Lv.90-99: 5 slot), VII. Hỗn Độn Chúa Tể (Lv.100: 5 slot).',
    '• 8 LEVEL ROLES (Tự động nhận + Buff nội tại cộng dồn): Lv.5 (+3% EXP), Lv.15 (+5% EXP), Lv.20 (+8% EXP, +5% Daily LT), Lv.35 (+12% EXP, +10% Daily LT), Lv.45 (+15% EXP, +10% Daily LT, +5% Pet), Lv.60 (+20% EXP, +15% Daily LT, +8% Pet), Lv.80 (+30% EXP, +25% Daily LT, +12% Pet), Lv.100 (+50% EXP, +50% Daily LT, +20% Pet).',
    '• LINH VỰC • THẦN THỨC • THẦN CẢNH (/linhvuc, /roll loai:domain): Kho 30 Linh Vực (5 Độc Nhất Thần Thoại, 10 Thần Thoại thường, 15 Tiên/Linh/Phàm), 15 Thần Thức & 15 Thần Cảnh (gồm các bản Độc Nhất toàn server). Tự kích hoạt đấu Linh Vực từ Hiệp 2 trở đi: KHÔNG cộng thẳng ATK/DEF/SPD mà buff HAX/Xuyên Giáp cho phe mình & áp debuff lên phe địch khi còn Linh Mạch. 5 hệ Linh Vực tương khắc vòng tròn: Kiếm Vực > Huyễn Vực > Trận Vực > Minh Vực > Thánh Vực > Kiếm Vực (-1 Linh Mạch cho bên thắng hệ vs -2 cho bên bị khắc). Thần Thức tăng giới hạn Linh Mạch, Thần Cảnh cường hóa hoặc thêm loại debuff.',
    '• ĐẤU TRƯỜNG 1v1 (/battle [doi_thu]): Tối đa 30 hiệp, ảnh Chiến Báo (hiển thị cả Linh Vực kèm 2 biểu tượng Thần Thức / Thần Cảnh & khung Đối Đầu Linh Vực ở cột giữa) và nút xem Chi tiết Log. Bỏ trống doi_thu để đấu PvE Tự Do (+10 LT thắng / -5 LT thua, tối đa 25 trận có thưởng/ngày); thách đấu người chơi là PvP. Ngũ Hành: Kim > Mộc > Thổ > Thủy > Hỏa > Kim (+30% thắng hệ, -20% thua hệ). Dị tố: Lôi khắc Thủy & Kim (+30%), Ám <-> Quang (+25%), Hỗn Độn/Hư Không (+20% xuyên giáp, -15% nhận DMG).',
    '• LINH THÚ, PHÁP BẢO & GACHA (/roll, /enchant, /dismantle, /linhthu, /phapbao): Tổng cộng 90 Linh Thú công khai (13 Phàm, 13 Linh, 14 Tiên, 50 Thần Thoại gồm 10 bản Độc Nhất toàn server) & 165 Pháp Bảo (57 Vũ Khí, 54 Bảo Ngọc, 54 Chiến Hồn, gồm 39 Độc Nhất toàn server). /roll <loai: equipment|pet|domain|role> [so_luot: 1|10] [dung_ve]: 50 LT/lượt (450/10 lượt) cho Pháp Bảo/Pet/Role, 60 LT/lượt (540/10 lượt) cho Linh Vực. Quay trùng Pet/Pháp Bảo cộng số lượng +1 & tự kế thừa Tư Chất cao nhất max(D..S). /enchant nâng bậc Khắc Ấn D→C→B→A→S (+40% chỉ số bậc S, Pity +5%/lần trượt). Kho Linh Thú chi tiết (/inv & /linhthu) hiển thị đủ huy hiệu Phẩm Chất & Ngũ Hành.',
    '• MINIGAME TIÊN GIỚI (/coinflip, /blackjack, /slots, /crash): Cược 10 – 10.000 LT/ván (cooldown 5s). /coinflip trả thưởng 1:2, /blackjack đấu Xì Dách 21 điểm (Rút / Dừng / Gấp Đôi) trả thưởng 1:2, /slots 4 ô (tối đa 1:5), /crash Phi Kiếm Độ Kiếp rút đúng lúc trước khi Thiên Lôi nổ.',
    '• NÔNG TRẠI & ĐỔI QUÀ (/farm, /exchange): Mặc định 4 ô (2 Linh Điền + 2 Linh Thú Các), mở khóa tối đa 6 ô qua /exchange (farm_slot_unlock). Mua hạt giống hoặc trứng (chu kỳ 6h / 12h / 24h), quay lại tưới nước/cho ăn đúng khung giờ để tránh héo và thu hoạch lãi Linh Thạch + Linh Quả Tiên Giới (farm_essence). Dùng /exchange để đổi Linh Quả sang Túi 500 LT, Đá Khắc Ấn, Đá Sao, Vé Gacha, Thẻ Reset Tháp hoặc mở ô #5/#6.',
    '• KINH TẾ, VIỆC LÀM, NHIỆM VỤ & THÁP 200 TẦNG (/daily, /job, /nhiemvu, /shop, /doiqua, /tangqua): /job tối đa 8 ca/ngày (hồi chiêu 1 giờ, thưởng 35–75 LT & 18–32 EXP tùy nghề). /nhiemvu có 5 Nhiệm Vụ Ngày (Điểm danh /daily 15 LT, 150 EXP 20 LT, 3 trận thắng 25 LT, 2 ca /job 20 LT, 1 lượt /farm hoặc Minigame 20 LT) + Thưởng Hoàn Tất 5/5 (+115 LT, +1 Vé Pháp Bảo, +1 Đá Sao, +1 Đá Khắc Ấn), Khế Ước Tuần (+500 LT, +3 Đá Khắc Ấn), và Tháp Thí Luyện 200 Tầng (5 lượt/ngày). /shop bán Nhẫn Cưới 4 cấp, 26 Pet Phàm/Linh, 44 Pháp Bảo Phàm/Linh, 21 Role Đơn, 8 Vật Phẩm (gồm Vé Linh Vực 60 LT & Lệnh Bài Khung 800 LT), 20 Background.',
    '• TÚI ĐỒ, TRA CỨU & CẬP NHẬT (/inv, /info, /wiki, /updates, /roles, /equip, /unequip, /marry, /giatoc): /inv khôi phục icon Lệnh Bài Khung trước Ảnh Nền, hiển thị số lượng nhỏ (⁰⁰¹, ⁰⁰³), món đang trang bị đứng đầu trước dấu |, cùng Linh Vực đang kích hoạt và Linh Quả. Tất cả Emoji trong server đều đặt đúng tên UID (vd: han_bang_ky_lan, enchant_stone, frame_unlock_token) để copy thẳng vào /info, /equip, /enchant, /linhvuc, /dismantle. Dùng /updates (có s) xem chi tiết bản v1.3.1.',
  ];
  if (includeFuyumiSecret) {
    lines.push('• BỘ TỐI THƯỢNG THẦN THOẠI ĐỘC NHẤT (TIỂU THƯ FUYUMI SỞ HỮU — CHỈ TIỂU THƯ BIẾT): Tiểu thư sở hữu bộ Độc Nhất Tối Thượng gồm Cửu Vĩ Hồng Hồ (cuu_vi_hong_ho) cùng bộ Linh Vực Cửu Vĩ Hồng Mông (domain_fuyumi_cuu_vi_hong_mong), Thần Thức Thái Thượng Hồng Hồ (sense_fuyumi_thai_thuong_hong_ho) và Thần Cảnh Vạn Cổ Tuyệt Diệt (realm_fuyumi_van_co_tuyet_diet) miễn nhiễm khống chế, Mê Hoặc & debuff Linh Vực địch.');
  }
  return lines.join('\n');
}

function updateAiPromptText(oldPrompt, includeFuyumiSecret) {
  let text = String(oldPrompt || '');
  text = text.replace(/tài liệu(?: hệ thống)? v1\.[0-9]+(?:\.[0-9]+)? bên dưới/g, 'tài liệu hệ thống v1.3.1 bên dưới');
  const startMarker = 'KIẾN THỨC CHÍNH THỨC HỆ THỐNG BOT NHIỄM NHIỄM';
  const endMarker = '\n\nBỘ DANH SÁCH EMOTE ĐỘNG DISCORD CHÍNH THỨC:';
  const sIdx = text.indexOf(startMarker);
  const eIdx = text.indexOf(endMarker);
  if (sIdx === -1 || eIdx === -1 || eIdx <= sIdx) {
    throw new Error(`Could not locate knowledge markers inside AI prompt (s=${sIdx}, e=${eIdx})`);
  }
  const newBlock = buildV13KnowledgeBlock(includeFuyumiSecret);
  return text.slice(0, sIdx) + newBlock + text.slice(eIdx);
}

// ============================================================================
// MAIN ORCHESTRATION
// ============================================================================
const NEW_COMMANDS = [
  { name: 'linhvuc', build: buildLinhVucCmd },
  { name: 'coinflip', build: buildCoinflipCmd },
  { name: 'slots', build: buildSlotsCmd },
  { name: 'blackjack', build: buildBlackjackCmd },
  { name: 'crash', build: buildCrashCmd },
  { name: 'farm', build: buildFarmCmd },
  { name: 'exchange', build: buildExchangeCmd },
];

async function fetchLiveReduxCommands() {
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
    const aiEv = st.data.bot.commands.custom_events.events['21'];
    return JSON.stringify({
      cmds: Object.values(cmds).filter(c => c.groupId === '${PROFILE_GROUP_ID}' && c.name && !c.name.includes('giveaway') && !c.name.includes('reroll')).map(c => ({
        name: c.name,
        enabled: c.enabled !== false,
        groupId: c.groupId,
        compressed_tree: c.compressed_tree,
      })),
      aiEv: aiEv ? { name: aiEv.name, enabled: aiEv.enabled !== false, compressed_tree: aiEv.compressed_tree } : null,
    });
  })()`);
  return JSON.parse(raw);
}

const LEAK_RE = /house\s*edge|tỉ lệ[^.]{0,20}40%|winrate[^.]{0,20}40%|(?:minigame|coinflip|blackjack|slots|crash)[^.]{0,60}40%/i;

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const filterArg = process.argv.find((a) => a.startsWith('--only='));
  const onlyNames = filterArg ? new Set(filterArg.slice('--only='.length).split(',')) : null;

  // 1. Validate & optionally deploy 7 new slash commands
  for (const t of NEW_COMMANDS) {
    if (onlyNames && !onlyNames.has(t.name)) continue;
    const els = t.build();
    assertAcyclicDAG(els, t.name);
    assertUniqueApiActionNames(els, t.name);
    assertSelectLimitsAndRegex(els, t.name);
    const errs = validateGraph(els);
    if (errs.length) throw new Error(`Validation failed for /${t.name}: ${errs.join(', ')}`);
    const rawStr = JSON.stringify(els);
    if (LEAK_RE.test(rawStr)) throw new Error(`Confidential info leak in /${t.name}`);
    console.log(`[Offline OK] NEW /${t.name}: ${els.length} elements`);
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

  // 2. Patch existing commands & AI Mention from live BotGhost or baseline snapshot
  let live;
  if (dryRun) {
    try {
      live = await fetchLiveReduxCommands();
    } catch (e) {
      console.warn('[WARN] CDP Redux unavailable in dry-run, using baseline snapshot:', e.message);
      const baseline = JSON.parse(
        fs.readFileSync(
          'C:/Users/Fuyumi-ASUSF16/.gemini/antigravity/brain/6c4e030b-fb59-4575-8414-9779337f61d9/scratch/botghost_v12_baseline.json',
          'utf8',
        ),
      );
      live = {
        cmds: Object.entries(baseline.slashes).map(([name, s]) => ({
          name,
          enabled: true,
          groupId: s.groupId || PROFILE_GROUP_ID,
          compressed_tree: LZString.compressToBase64(JSON.stringify(s.tree)),
        })),
        aiEv: {
          name: baseline.aiEv.name,
          enabled: true,
          compressed_tree: LZString.compressToBase64(JSON.stringify(baseline.aiEv.tree)),
        },
      };
    }
  } else {
    live = await fetchLiveReduxCommands();
  }

  const ALWAYS_PATCH_NAMES = new Set(['roll', 'job', 'nhiemvu', 'updates', 'shop', 'wiki']);
  for (const c of live.cmds) {
    if (onlyNames && !onlyNames.has(c.name)) continue;
    const raw = LZString.decompressFromBase64(c.compressed_tree) || '';
    const needsGlobalFix = /v1\.2|su_enchant_stone|su_tower_reset_card|su_frame_token|su_star_stone|su_ring_|su_ticket_|su_title_card/i.test(raw);
    if (!ALWAYS_PATCH_NAMES.has(c.name) && !needsGlobalFix) continue;

    const origTree = JSON.parse(raw);
    const patchedTree = patchSpecificCommand(c.name, origTree);
    assertAcyclicDAG(patchedTree, c.name);
    assertUniqueApiActionNames(patchedTree, c.name);
    assertSelectLimitsAndRegex(patchedTree, c.name);
    const errs = validateGraph(patchedTree);
    if (errs.length) throw new Error(`Validation failed for patched /${c.name}: ${errs.join(', ')}`);
    const ser = JSON.stringify(patchedTree);
    if (LEAK_RE.test(ser)) throw new Error(`Confidential leak detected in /${c.name}`);
    if (c.name === 'wiki' && /cuu_vi_hong_ho|Cửu Vĩ Hồng Hồ|domain_fuyumi/i.test(ser)) {
      throw new Error(`Fuyumi exclusive leaked in /wiki!`);
    }
    console.log(`[Offline OK] PATCH /${c.name}: ${patchedTree.length} elements`);

    if (!dryRun) {
      const res = await deployViaCDP({
        groupId: c.groupId || PROFILE_GROUP_ID,
        mode: 'command',
        name: c.name,
        elements: patchedTree,
        enabled: c.enabled,
      });
      console.log(`[Patched] /${c.name}:`, JSON.stringify(res));
      if (!res?.ok) throw new Error(`Failed patching /${c.name}: ${JSON.stringify(res)}`);
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  // 3. Patch Nhiễm Nhiễm — AI Mention
  if (live.aiEv && (!onlyNames || onlyNames.has('ai_mention'))) {
    const aiTree = JSON.parse(LZString.decompressFromBase64(live.aiEv.compressed_tree) || '[]');
    for (const nodeId of ['act_fuyumi_api_gemini', 'act_other_api_gemini']) {
      const node = aiTree.find((n) => n.id === nodeId);
      if (!node?.data?.data?.request_options?.rawBody) {
        throw new Error(`Missing rawBody in ${nodeId}`);
      }
      const parsedBody = JSON.parse(node.data.data.request_options.rawBody);
      const oldSys = parsedBody.systemInstruction?.parts?.[0]?.text || '';
      const newSys = updateAiPromptText(oldSys, nodeId === 'act_fuyumi_api_gemini');
      parsedBody.systemInstruction.parts[0].text = newSys;
      if (LEAK_RE.test(newSys)) throw new Error(`Confidential leak in ${nodeId}`);
      if (nodeId === 'act_other_api_gemini' && /Cửu Vĩ Hồng Hồ|cuu_vi_hong_ho|domain_fuyumi/i.test(newSys)) {
        throw new Error(`Fuyumi secret leaked in act_other_api_gemini`);
      }
      node.data.data.request_options.rawBody = JSON.stringify(parsedBody);
    }
    assertAcyclicDAG(aiTree, live.aiEv.name);
    assertUniqueApiActionNames(aiTree, live.aiEv.name);
    assertSelectLimitsAndRegex(aiTree, live.aiEv.name);
    console.log(`[Offline OK] PATCH AI Mention (${live.aiEv.name}): ${aiTree.length} elements`);
    if (!dryRun) {
      const res = await deployAiMentionViaCDP(aiTree);
      console.log('[Patched AI Mention]:', JSON.stringify(res));
      if (!res?.ok) throw new Error(`Failed patching AI Mention: ${JSON.stringify(res)}`);
    }
  }

  process.exit(0);
}

async function deployAiMentionViaCDP(elements) {
  const b64 = Buffer.from(JSON.stringify(elements), 'utf8').toString('base64');
  const prevSave = await cdpEval(`(() => {
    const rootEl = document.getElementById('root');
    const rk = Object.keys(rootEl).find(k => k.startsWith('__reactContainer') || k.startsWith('__reactFiber'));
    const q = [rootEl[rk]?.current || rootEl[rk]], seen = new Set();
    let cb = null, store = null;
    while (q.length) {
      const n = q.shift(); if (!n || seen.has(n)) continue; seen.add(n);
      if (!cb && n.stateNode && typeof n.stateNode.saveBot === 'function') cb = n.stateNode;
      if (!store && n.memoizedProps?.store?.getState?.()?.data?.bot?.commands?.custom_events) store = n.memoizedProps.store;
      if (cb && store) break;
      if (n.child) q.push(n.child); if (n.sibling) q.push(n.sibling);
    }
    if (!cb || !store) throw new Error('Missing CommandBuilder or store');
    const events = store.getState().data.bot.commands.custom_events.events || [];
    const aiIdx = events.findIndex(e => e.int_id === '4cc5db30-029c-4a55-86e6-6e6850012afd');
    if (aiIdx < 0) throw new Error('Missing AI Mention event 4cc5db30-029c-4a55-86e6-6e6850012afd');
    const bin = atob('${b64}');
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const els = JSON.parse(new TextDecoder('utf-8').decode(bytes));
    cb.props.setBuilderMode({ mode: 'event', components: { Guild: true, Channel: true, User: true, Member: true, Message: true } });
    cb.props.setBuilderIndex(aiIdx);
    cb.setState({ saving: false, saveConflict: null });
    cb.props.setElements(els);
    cb.props.setSelected(null);
    return cb.props.bot.last_save;
  })()`);

  await new Promise((r) => setTimeout(r, 500));

  const trig = await cdpEval(`(async () => {
    const rootEl = document.getElementById('root');
    const rk = Object.keys(rootEl).find(k => k.startsWith('__reactContainer') || k.startsWith('__reactFiber'));
    const q = [rootEl[rk]?.current || rootEl[rk]], seen = new Set();
    let cb = null;
    while (q.length) {
      const n = q.shift(); if (!n || seen.has(n)) continue; seen.add(n);
      if (n.stateNode && typeof n.stateNode.saveBot === 'function') { cb = n.stateNode; break; }
      if (n.child) q.push(n.child); if (n.sibling) q.push(n.sibling);
    }
    const probBtn = [...document.querySelectorAll('button')].find(b => /Problems|No problems/i.test(b.innerText || ''));
    const probText = probBtn ? probBtn.innerText.trim().replace(/\\s+/g, ' ') : null;
    const canSave = cb.validateSave();
    if (!canSave || (probText && /Problems\\s+[1-9]/.test(probText))) {
      return JSON.stringify({ ok: false, error: 'Validation blocked save', canSave, probText });
    }
    const vars = cb.getCustomVariables ? cb.getCustomVariables() : [];
    await cb.buildCommand(vars, false);
    cb.save();
    return JSON.stringify({ ok: true, canSave, probText });
  })()`);
  const trigJson = JSON.parse(trig);
  if (!trigJson.ok) return trigJson;

  for (let i = 0; i < 25; i += 1) {
    await new Promise((r) => setTimeout(r, 1000));
    const cur = JSON.parse(await cdpEval(`(() => {
      const rootEl = document.getElementById('root');
      const rk = Object.keys(rootEl).find(k => k.startsWith('__reactContainer') || k.startsWith('__reactFiber'));
      const q = [rootEl[rk]?.current || rootEl[rk]], seen = new Set();
      let cb = null;
      while (q.length) {
        const n = q.shift(); if (!n || seen.has(n)) continue; seen.add(n);
        if (n.stateNode && typeof n.stateNode.saveBot === 'function') { cb = n.stateNode; break; }
        if (n.child) q.push(n.child); if (n.sibling) q.push(n.sibling);
      }
      return JSON.stringify({
        lastSave: cb?.props?.bot?.last_save,
        saving: cb?.state?.saving,
        builderSaveRequired: cb?.props?.builderSaveRequired,
      });
    })()`));
    if (cur.lastSave && cur.lastSave !== prevSave && cur.builderSaveRequired === false) {
      return { ok: true, canSave: trigJson.canSave, probText: trigJson.probText, beforeSave: prevSave, afterSave: cur.lastSave, builderSaveRequired: cur.builderSaveRequired };
    }
  }
  return { ok: false, error: 'AI Mention save timeout' };
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
