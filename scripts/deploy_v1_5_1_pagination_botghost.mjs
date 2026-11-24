/**
 * scripts/deploy_v1_5_1_pagination_botghost.mjs
 * Cập nhật 5 lệnh BotGhost (/roles, /phapbao, /linhvuc, /inv, /updates v1.5.1)
 * dùng chuẩn `advanced_message` & `api_action` (name + request_options.options + SECRET_BACKEND_KEY)
 * kèm `attachUpdateAckBranch` từ ga_builder_lib.mjs (nút +1.000 LT).
 *
 * Usage:
 *   node scripts/deploy_v1_5_1_pagination_botghost.mjs --dry-run
 *   node scripts/deploy_v1_5_1_pagination_botghost.mjs [--only=roles,phapbao,linhvuc,inv,updates]
 */

import WebSocket from 'ws';
globalThis.WebSocket = WebSocket;

import fs from 'node:fs';
import {
  GraphBuilder,
  attachUpdateAckBranch,
  deployViaCDP,
  validateGraph,
} from './ga_builder_lib.mjs';
import { em, emId } from '../src/config/emojiHelper.js';

const PROFILE_GROUP_ID = '1782127263978';
const BACKEND_BASE = 'https://sumi-profile-backend.onrender.com';

const CUSTOM_EMOJIS_RAW = JSON.parse(
  fs.readFileSync(new URL('../src/config/custom_emojis.json', import.meta.url), 'utf8'),
);

function uidEm(name, fallbackKey = 'su_sparkle') {
  const row = CUSTOM_EMOJIS_RAW[name] || CUSTOM_EMOJIS_RAW[fallbackKey];
  if (row?.id) return row.animated ? `<a:${row.name}:${row.id}>` : `<:${row.name}:${row.id}>`;
  return em(name) || '';
}

function uidId(name, fallbackKey = 'su_sparkle') {
  return CUSTOM_EMOJIS_RAW[name]?.id || CUSTOM_EMOJIS_RAW[fallbackKey]?.id || emId(fallbackKey) || '';
}

class PaginatedGraphBuilder extends GraphBuilder {
  advSelectMenu(id, parentMsgId, {
    placeholder,
    customVariableName,
    basic_options,
    row = '1',
    weight = '1',
    showReplies = 'hide',
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
  title = '',
  description = '',
  color = '#a855f7',
  imageUrl = '',
  fields = undefined,
  footer = '',
  target = { reply: true },
  editId = undefined,
  action_id = undefined,
} = {}, pos = { x: 0, y: 0 }) {
  const hasFields = Array.isArray(fields) && fields.length > 0;
  const embedObj = {
    title,
    description,
    color,
    url: '',
    thumbnail: { url: '' },
    image: { url: imageUrl },
    footer: { text: footer || '', icon_url: '' },
  };
  if (hasFields) {
    embedObj.fields = fields.map((f) => ({
      name: String(f.name || '').slice(0, 256),
      value: String(f.value || '').slice(0, 1024),
      inline: Boolean(f.inline),
    }));
  }
  const data = {
    messageType: hasFields ? 'advanced' : 'basic',
    useComponentsV2: false,
    target,
    success_handles: false,
    message: {
      content: '',
      embeds: [embedObj],
    },
    components: [],
    componentsV2Data: null,
    reactions: '',
  };
  if (editId) data.editId = editId;
  if (action_id) data.action_id = action_id;
  return gb.act(id, 'advanced_message', data, pos);
}

function patchAckRewardText(elements) {
  for (const el of elements) {
    const dt = el?.data?.data;
    if (!dt) continue;
    if (el.type === 'advMessageButton' && typeof dt.label === 'string') {
      dt.label = dt.label.replace(/\+\s*(800|1[.,]500|2[.,]000)\s*LT/gi, '+1.000 LT');
    }
    const embeds = dt.message?.embeds;
    if (Array.isArray(embeds)) {
      for (const emb of embeds) {
        if (typeof emb.title === 'string') {
          emb.title = emb.title.replace(/\+\s*(800|1[.,]500|2[.,]000)\s*LT/gi, '+1.000 LT');
        }
      }
    }
  }
  return elements;
}

function assertCleanAndAcyclic(elements, label) {
  const errs = validateGraph(elements);
  if (errs.length) throw new Error(`Validation failed for ${label}: ${errs.join(', ')}`);

  const seenApiNames = new Map();
  const adj = new Map();
  const nodes = new Set();

  for (const el of elements) {
    if (el.source && el.target) {
      if (!adj.has(el.source)) adj.set(el.source, []);
      adj.get(el.source).push(el.target);
    } else if (el.id) {
      nodes.add(el.id);
      if (el.type === 'message') {
        throw new Error(`Invalid raw "message" node in ${label} (${el.id}); must use advanced_message action`);
      }
      if (el.type === 'action' && el.data?.data?.type === 'api_action') {
        const d = el.data.data;
        const name = String(d.name || '').trim();
        if (!name) throw new Error(`api_action missing data.name in ${label} (${el.id})`);
        if (seenApiNames.has(name)) {
          throw new Error(`Duplicate api_action name "${name}" in ${label}: ${seenApiNames.get(name)} & ${el.id}`);
        }
        seenApiNames.set(name, el.id);
        if (!d.request_options?.options?.replaceURL) {
          throw new Error(`api_action "${el.id}" in ${label} missing request_options.options.replaceURL=true`);
        }
      }
      if (el.type === 'action' && el.data?.data?.type === 'advanced_message') {
        const embeds = el.data.data.message?.embeds;
        if (!Array.isArray(embeds) || embeds.length === 0) {
          throw new Error(`advanced_message "${el.id}" in ${label} missing message.embeds`);
        }
      }
    }
  }

  const color = new Map();
  const dfs = (u) => {
    color.set(u, 1);
    for (const v of adj.get(u) || []) {
      if (color.get(v) === 1) throw new Error(`Cycle detected in ${label}: ${u} -> ${v}`);
      if (!color.get(v)) dfs(v);
    }
    color.set(u, 2);
  };
  for (const n of nodes) if (!color.get(n)) dfs(n);

  const json = JSON.stringify(elements);
  const badUnicode = json.match(/[\u{1F300}-\u{1FAFF}\u2600-\u27BF]/gu);
  if (badUnicode) {
    throw new Error(`Windows Unicode pictograph found in ${label}: ${[...new Set(badUnicode)].join(' ')}`);
  }
}

// ============================================================================
// 1. /roles [loc] [sap_xep] [trang]
// ============================================================================
export function buildRolesPaginatedCmd() {
  const gb = new PaginatedGraphBuilder();
  gb.rootSlash('roles', 'Xem toàn bộ Role Quyền Năng (Trang 1/2/3) + lọc trạng thái đeo/vĩnh viễn/tạm thời', { ephemeral: false });
  gb.errorHandlerWait();
  gb.option('loc', 'string', 'Lọc Role theo trạng thái (mặc định: all)', {
    required: false,
    choices: ['all', 'equipped', 'unequipped', 'permanent', 'timed'],
    x: 420,
    y: 0,
  });
  gb.option('sap_xep', 'string', 'Sắp xếp Role (mặc định: ưu tiên đang đeo)', {
    required: false,
    choices: ['equipped_desc', 'rarity_desc', 'expiry_asc'],
    x: 700,
    y: 0,
  });
  gb.option('trang', 'int', 'Số trang muốn xem (1, 2, 3...)', {
    required: false,
    x: 980,
    y: 0,
  });

  embedMsg(gb, 'ro_ack', {
    title: `${uidEm('su_medal_role')} Đang mở Kho Role Quyền Năng...`,
    description: 'Đang kiểm kê toàn bộ Role Quyền Năng và thời hạn của {user_displayName}...',
    color: '#a855f7',
    target: { reply: true },
    editId: 'ro_ack',
  }, { x: 0, y: 220 });
  gb.link('root', 'ro_ack');

  apiAction(
    gb,
    'ro_api',
    'ro_res',
    'GET',
    `${BACKEND_BASE}/api/roles/{user_id}?filter={option_loc}&sort={option_sap_xep}&page={option_trang}&username={encode_text[{user_displayName}]}&avatar={encode_text[{user_icon}]}`,
    '',
    { x: 0, y: 400 },
  );
  gb.link('ro_ack', 'ro_api');

  const roNoAck = attachUpdateAckBranch(gb, 'ro', 'ro_api', 'ro_res', { editId: 'ro_ack', x: 0, y: 580 });

  embedMsg(gb, 'ro_edit_0', {
    title: `${uidEm('su_medal_role')} KHO ROLE QUYỀN NĂNG CỦA {ro_res.response.user.username}`,
    description: '{ro_res.response.filter_summary}\n\n{ro_res.response.summary}',
    color: '#a855f7',
    footer: '',
    target: { editId: 'ro_ack' },
    action_id: 'ro_ack',
  }, { x: 240, y: 780 });
  gb.link(roNoAck, 'ro_edit_0');

  const roleOpts = [
    { label: 'Trang 1 (Role #1 - #15)', description: 'Xem trang đầu tiên của Kho Role', emoji_id: uidId('su_medal_role'), value: 'page:1' },
    { label: 'Trang 2 (Role #16 - #30)', description: 'Xem trang 2 của Kho Role', emoji_id: uidId('su_medal_role'), value: 'page:2' },
    { label: 'Trang 3 (Role #31 - #45)', description: 'Xem trang 3 của Kho Role', emoji_id: uidId('su_medal_role'), value: 'page:3' },
    { label: 'Tất Cả Role (Mặc định)', description: 'Hiện toàn bộ Role đang sở hữu', emoji_id: uidId('su_wiki_scroll'), value: 'all' },
    { label: 'Đang Trang Bị (Equipped)', description: 'Chỉ hiện các Role đang gắn vào Slot hiệu lực', emoji_id: uidId('su_sparkle'), value: 'equipped' },
    { label: 'Chưa Trang Bị (Unequipped)', description: 'Các Role đang cất trong kho dự trữ', emoji_id: uidId('su_wiki_scroll'), value: 'unequipped' },
    { label: 'Role Vĩnh Viễn', description: 'Lọc các Role sở hữu Vĩnh Viễn', emoji_id: uidId('su_tier_mythic'), value: 'permanent' },
    { label: 'Role Có Thời Hạn (7d/30d)', description: 'Lọc các Role thuê theo ngày', emoji_id: uidId('su_tier_rare'), value: 'timed' },
    { label: 'Sắp Xếp: Phẩm Cao -> Thấp', description: 'Thần Thoại -> Tiên -> Linh -> Phàm', emoji_id: uidId('su_winner_trophy'), value: 'rarity_desc' },
    { label: 'Sắp Xếp: Sắp Hết Hạn Trước', description: 'Ưu tiên Role còn ít thời gian nhất lên đầu', emoji_id: uidId('su_level_up'), value: 'expiry_asc' },
  ];

  let curMsg = 'ro_edit_0';
  for (let k = 1; k <= 4; k += 1) {
    const baseY = 780 + k * 540;
    const selId = `sel_ro_${k}`;
    const varName = `picked_role_${k}`;
    const apiId = `ro_fapi_${k}`;
    const resName = `ro_fres_${k}`;
    const msgId = `ro_edit_${k}`;

    gb.advSelectMenu(selId, curMsg, {
      placeholder: 'Chuyển Trang (1/2/3) hoặc Lọc / Sắp Xếp Role...',
      customVariableName: varName,
      basic_options: roleOpts,
      row: '1',
      weight: '1',
      showReplies: 'hide',
    }, { x: 240, y: baseY - 360 });

    apiAction(
      gb,
      apiId,
      resName,
      'GET',
      `${BACKEND_BASE}/api/roles/{user_id}?filter={${varName}}&sort={${varName}}&username={encode_text[{user_displayName}]}&avatar={encode_text[{user_icon}]}`,
      '',
      { x: 240, y: baseY - 180 },
    );
    gb.link(selId, apiId);

    embedMsg(gb, msgId, {
      title: `${uidEm('su_medal_role')} KHO ROLE QUYỀN NĂNG CỦA {${resName}.response.user.username}`,
      description: `{${resName}.response.filter_summary}\n\n{${resName}.response.summary}`,
      color: '#a855f7',
      footer: '',
      target: { editId: 'ro_ack' },
      action_id: 'ro_ack',
    }, { x: 240, y: baseY });
    gb.link(apiId, msgId);
    curMsg = msgId;
  }

  return patchAckRewardText(gb.elements());
}

// ============================================================================
// 2. /phapbao [o_trang_bi] [sap_xep] [trang]
// ============================================================================
export function buildPhapBaoPaginatedCmd() {
  const gb = new PaginatedGraphBuilder();
  gb.rootSlash('phapbao', 'Xem Kho Pháp Bảo (Trang 1/2/3+) + lọc Vũ Khí, Bảo Ngọc, Chiến Hồn', { ephemeral: false });
  gb.errorHandlerWait();
  gb.option('o_trang_bi', 'string', 'Lọc theo ô trang bị (mặc định: all)', {
    required: false,
    choices: ['all', 'weapon', 'gem', 'soul', 'equipped'],
    x: 420,
    y: 0,
  });
  gb.option('sap_xep', 'string', 'Sắp xếp (mặc định: phẩm cao -> thấp)', {
    required: false,
    choices: ['rarity_desc', 'rarity_asc', 'power_desc', 'slot'],
    x: 700,
    y: 0,
  });
  gb.option('trang', 'int', 'Số trang muốn xem (1, 2, 3...)', {
    required: false,
    x: 980,
    y: 0,
  });

  embedMsg(gb, 'pb_ack', {
    title: `${uidEm('su_crossed_swords')} Đang mở Kho Pháp Bảo...`,
    description: 'Đang kiểm kê toàn bộ Vũ Khí, Bảo Ngọc và Chiến Hồn của {user_displayName}...',
    color: '#f59e0b',
    target: { reply: true },
    editId: 'pb_ack',
  }, { x: 0, y: 220 });
  gb.link('root', 'pb_ack');

  apiAction(
    gb,
    'pb_api',
    'pb_res',
    'GET',
    `${BACKEND_BASE}/api/equipment/{user_id}?slot={option_o_trang_bi}&sort={option_sap_xep}&page={option_trang}&username={encode_text[{user_displayName}]}&avatar={encode_text[{user_icon}]}`,
    '',
    { x: 0, y: 400 },
  );
  gb.link('pb_ack', 'pb_api');

  const pbNoAck = attachUpdateAckBranch(gb, 'pb', 'pb_api', 'pb_res', { editId: 'pb_ack', x: 0, y: 580 });

  embedMsg(gb, 'pb_edit_0', {
    title: `${uidEm('su_crossed_swords')} KHO PHÁP BẢO CỦA {pb_res.response.user.username}`,
    description: '{pb_res.response.filter_summary}\n\n{pb_res.response.summary_equipment}',
    color: '#f59e0b',
    footer: '',
    target: { editId: 'pb_ack' },
    action_id: 'pb_ack',
  }, { x: 240, y: 780 });
  gb.link(pbNoAck, 'pb_edit_0');

  const pbOpts = [
    { label: 'Trang 1 (Món #1 - #20)', description: 'Xem trang 1 Kho Pháp Bảo', emoji_id: uidId('su_crossed_swords'), value: 'page:1' },
    { label: 'Trang 2 (Món #21 - #40)', description: 'Xem trang 2 Kho Pháp Bảo', emoji_id: uidId('su_crossed_swords'), value: 'page:2' },
    { label: 'Trang 3 (Món #41 - #60)', description: 'Xem trang 3 Kho Pháp Bảo', emoji_id: uidId('su_crossed_swords'), value: 'page:3' },
    { label: 'Trang 4 (Món #61 - #80)', description: 'Xem trang 4 Kho Pháp Bảo', emoji_id: uidId('su_crossed_swords'), value: 'page:4' },
    { label: 'Trang 5 (Món #81 - #100)', description: 'Xem trang 5 Kho Pháp Bảo', emoji_id: uidId('su_crossed_swords'), value: 'page:5' },
    { label: 'Phẩm Cao -> Thấp (Mặc định)', description: 'Thần Thoại -> Tiên -> Linh -> Phàm', emoji_id: uidId('su_tier_mythic'), value: 'rarity_desc' },
    { label: 'Phẩm Thấp -> Cao', description: 'Phàm -> Linh -> Tiên -> Thần Thoại', emoji_id: uidId('su_tier_common'), value: 'rarity_asc' },
    { label: 'Chiến Lực Cao -> Thấp', description: 'Xếp theo điểm chỉ số cộng mạnh nhất', emoji_id: uidId('su_stats_chart'), value: 'power_desc' },
    { label: 'Chỉ Hiện Vũ Khí', description: 'Lọc toàn bộ Vũ Khí đang có trong túi', emoji_id: uidId('su_crossed_swords'), value: 'weapon' },
    { label: 'Chỉ Hiện Bảo Ngọc', description: 'Lọc toàn bộ Bảo Ngọc đang có trong túi', emoji_id: uidId('su_gem_slot'), value: 'gem' },
    { label: 'Chỉ Hiện Chiến Hồn', description: 'Lọc toàn bộ Chiến Hồn đang có trong túi', emoji_id: uidId('su_soul_slot'), value: 'soul' },
    { label: 'Đang Trang Bị', description: 'Chỉ hiện Pháp Bảo đang gắn cho Linh Thú', emoji_id: uidId('su_sparkle'), value: 'equipped' },
  ];

  let curMsg = 'pb_edit_0';
  for (let k = 1; k <= 4; k += 1) {
    const baseY = 780 + k * 540;
    const selId = `sel_pb_${k}`;
    const varName = `picked_pb_${k}`;
    const apiId = `pb_fapi_${k}`;
    const resName = `pb_fres_${k}`;
    const msgId = `pb_edit_${k}`;

    gb.advSelectMenu(selId, curMsg, {
      placeholder: 'Chuyển Trang (1..5) hoặc Lọc / Sắp Xếp Pháp Bảo...',
      customVariableName: varName,
      basic_options: pbOpts,
      row: '1',
      weight: '1',
      showReplies: 'hide',
    }, { x: 240, y: baseY - 360 });

    apiAction(
      gb,
      apiId,
      resName,
      'GET',
      `${BACKEND_BASE}/api/equipment/{user_id}?filter={${varName}}&username={encode_text[{user_displayName}]}&avatar={encode_text[{user_icon}]}`,
      '',
      { x: 240, y: baseY - 180 },
    );
    gb.link(selId, apiId);

    embedMsg(gb, msgId, {
      title: `${uidEm('su_crossed_swords')} KHO PHÁP BẢO CỦA {${resName}.response.user.username}`,
      description: `{${resName}.response.filter_summary}\n\n{${resName}.response.summary_equipment}`,
      color: '#f59e0b',
      footer: '',
      target: { editId: 'pb_ack' },
      action_id: 'pb_ack',
    }, { x: 240, y: baseY });
    gb.link(apiId, msgId);
    curMsg = msgId;
  }

  return patchAckRewardText(gb.elements());
}

// ============================================================================
// 3. /linhvuc [hanh_dong] [tab] [ma_id] [trang]
// ============================================================================
export function buildLinhVucPaginatedCmd() {
  const gb = new PaginatedGraphBuilder();
  gb.rootSlash('linhvuc', 'Quản lý & trang bị Linh Vực, Thần Thức, Thần Cảnh (có Trang 1/2/3)', { ephemeral: false });
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
  gb.option('trang', 'int', 'Số trang muốn xem (1, 2, 3...)', {
    required: false,
    x: 1260,
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
    target: { reply: true },
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
    footer: '',
    target: { editId: 'lv_eq_ack' },
    action_id: 'lv_eq_ack',
  }, { x: -520, y: 1140 });
  gb.link(eqNoAck, 'lv_eq_edit');

  // Branch B: unequip
  embedMsg(gb, 'lv_unq_ack', {
    title: `${uidEm('su_realm_star')} Đang thu hồi Linh Vực...`,
    description: 'Đang thu hồi slot `{option_ma_id}` về kho...',
    color: '#64748b',
    target: { reply: true },
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
    footer: '',
    target: { editId: 'lv_unq_ack' },
    action_id: 'lv_unq_ack',
  }, { x: -120, y: 1140 });
  gb.link(unqNoAck, 'lv_unq_edit');

  // Branch C: dismantle
  embedMsg(gb, 'lv_dism_ack', {
    title: `${uidEm('su_linhthach')} Đang luyện hóa phân giải...`,
    description: 'Đang phân giải `{option_ma_id}` thành Linh Thạch...',
    color: '#f59e0b',
    target: { reply: true },
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
    footer: '',
    target: { editId: 'lv_dism_ack' },
    action_id: 'lv_dism_ack',
  }, { x: 240, y: 1140 });
  gb.link(dismNoAck, 'lv_dism_edit');

  // Branch D: view inventory (with Trang 1/2/3 pagination)
  embedMsg(gb, 'lv_v_ack', {
    title: `${uidEm('su_realm_star')} Đang mở Kho Linh Vực...`,
    description: 'Đang thống kê Linh Vực, Thần Thức & Thần Cảnh của {user_displayName}...',
    color: '#ec4899',
    target: { reply: true },
    editId: 'lv_v_ack',
  }, { x: 640, y: 580 });
  gb.link(brView, 'lv_v_ack');
  apiAction(gb, 'lv_v_api', 'lv_v_res', 'GET',
    `${BACKEND_BASE}/api/domain/inventory/{user_id}?view={option_tab}&page={option_trang}&username={encode_text[{user_displayName}]}&avatar={encode_text[{user_icon}]}`,
    '', { x: 640, y: 760 });
  gb.link('lv_v_ack', 'lv_v_api');
  const vNoAck = attachUpdateAckBranch(gb, 'lvv', 'lv_v_api', 'lv_v_res', { editId: 'lv_v_ack', x: 640, y: 940 });
  const cVOk = gb.cmp('lv_v_ok', '{lv_v_res.response.success}', 'true', 'equal_to', { ignoreCase: true }, { x: 640, y: 1120 });
  gb.link(vNoAck, cVOk.condId);
  embedMsg(gb, 'lv_v_edit_0', {
    title: '{lv_v_res.response.title}',
    description: '{lv_v_res.response.description}',
    color: '#ec4899',
    footer: '',
    target: { editId: 'lv_v_ack' },
    action_id: 'lv_v_ack',
  }, { x: 520, y: 1320 });
  gb.link(cVOk.yes, 'lv_v_edit_0');
  embedMsg(gb, 'lv_v_err', {
    title: `${uidEm('su_realm_star')} KHO LINH VỰC TIÊN GIỚI`,
    description: '{lv_v_res.response.message}',
    color: '#f43f5e',
    footer: '',
    target: { editId: 'lv_v_ack' },
    action_id: 'lv_v_ack',
  }, { x: 860, y: 1320 });
  gb.link(cVOk.no, 'lv_v_err');

  const lvOpts = [
    { label: 'Tổng Quan — Trang 1', description: 'Linh Vực • Thần Thức • Thần Cảnh (Trang 1)', emoji_id: uidId('su_realm_star'), value: 'overview:1' },
    { label: 'Tổng Quan — Trang 2', description: 'Xem tiếp Trang 2 Kho Linh Vực', emoji_id: uidId('su_realm_star'), value: 'overview:2' },
    { label: 'Tổng Quan — Trang 3', description: 'Xem tiếp Trang 3 Kho Linh Vực', emoji_id: uidId('su_realm_star'), value: 'overview:3' },
    { label: 'Chỉ Linh Vực — Trang 1', description: 'Danh sách Linh Vực (Trang 1)', emoji_id: uidId('su_arena'), value: 'domain:1' },
    { label: 'Chỉ Linh Vực — Trang 2', description: 'Danh sách Linh Vực (Trang 2)', emoji_id: uidId('su_arena'), value: 'domain:2' },
    { label: 'Chỉ Thần Thức — Trang 1', description: 'Danh sách Thần Thức (Trang 1)', emoji_id: uidId('su_sparkle'), value: 'sense:1' },
    { label: 'Chỉ Thần Thức — Trang 2', description: 'Danh sách Thần Thức (Trang 2)', emoji_id: uidId('su_sparkle'), value: 'sense:2' },
    { label: 'Chỉ Thần Cảnh — Trang 1', description: 'Danh sách Thần Cảnh (Trang 1)', emoji_id: uidId('su_tier_epic'), value: 'realm:1' },
    { label: 'Chỉ Thần Cảnh — Trang 2', description: 'Danh sách Thần Cảnh (Trang 2)', emoji_id: uidId('su_tier_epic'), value: 'realm:2' },
  ];

  let curLvMsg = 'lv_v_edit_0';
  for (let k = 1; k <= 4; k += 1) {
    const baseY = 1320 + k * 540;
    const selId = `sel_lv_${k}`;
    const varName = `picked_lv_${k}`;
    const apiId = `lv_fapi_${k}`;
    const resName = `lv_fres_${k}`;
    const msgId = `lv_v_edit_${k}`;

    gb.advSelectMenu(selId, curLvMsg, {
      placeholder: 'Chuyển Tab / Trang (1/2/3) Kho Linh Vực...',
      customVariableName: varName,
      basic_options: lvOpts,
      row: '1',
      weight: '1',
      showReplies: 'hide',
    }, { x: 520, y: baseY - 360 });

    apiAction(
      gb,
      apiId,
      resName,
      'GET',
      `${BACKEND_BASE}/api/domain/inventory/{user_id}?view={${varName}}&username={encode_text[{user_displayName}]}&avatar={encode_text[{user_icon}]}`,
      '',
      { x: 520, y: baseY - 180 },
    );
    gb.link(selId, apiId);

    embedMsg(gb, msgId, {
      title: `{${resName}.response.title}`,
      description: `{${resName}.response.description}`,
      color: '#ec4899',
      footer: '',
      target: { editId: 'lv_v_ack' },
      action_id: 'lv_v_ack',
    }, { x: 520, y: baseY });
    gb.link(apiId, msgId);
    curLvMsg = msgId;
  }

  return patchAckRewardText(gb.elements());
}

// ============================================================================
// 4. /inv — Túi Đồ Tiên Giới + Phân Trang (Roles / Pháp Bảo / Linh Thú)
// ============================================================================
export function buildInvPaginatedCmd() {
  const gb = new PaginatedGraphBuilder();
  gb.rootSlash('inv', 'Xem Túi Đồ Tiên Giới (Linh Thú, Pháp Bảo, Role, Tiêu Hao — có Trang 1/2/3)', { ephemeral: false });
  gb.errorHandlerWait();

  embedMsg(gb, 'inv_ack', {
    title: `${uidEm('su_wiki_scroll')} Đang mở Túi Đồ Tiên Giới...`,
    description: 'Đang đồng bộ hành trang của {user_displayName}...',
    color: '#38bdf8',
    target: { reply: true },
    editId: 'inv_ack',
  }, { x: 0, y: 220 });
  gb.link('root', 'inv_ack');

  apiAction(
    gb,
    'inv_api',
    'inv_res',
    'GET',
    `${BACKEND_BASE}/api/inv/{user_id}?view=overview&username={encode_text[{user_displayName}]}&avatar={encode_text[{user_icon}]}`,
    '',
    { x: 0, y: 400 },
  );
  gb.link('inv_ack', 'inv_api');

  const invNoAck = attachUpdateAckBranch(gb, 'inv', 'inv_api', 'inv_res', { editId: 'inv_ack', x: 0, y: 580 });

  embedMsg(gb, 'inv_edit_0', {
    title: '{inv_res.response.view_title}',
    description: '{inv_res.response.view_description}',
    color: '#a855f7',
    footer: '',
    target: { editId: 'inv_ack' },
    action_id: 'inv_ack',
  }, { x: 240, y: 780 });
  gb.link(invNoAck, 'inv_edit_0');

  const invOpts = [
    { label: 'Tổng Quan Túi Đồ', description: 'Hiển thị nhanh toàn bộ kho bằng biểu tượng & số lượng', emoji_id: uidId('su_wiki_scroll'), value: 'overview' },
    { label: 'Kho Role — Trang 1', description: 'Role Quyền Năng đang giữ (Trang 1)', emoji_id: uidId('su_medal_role'), value: 'roles:1' },
    { label: 'Kho Role — Trang 2', description: 'Role Quyền Năng đang giữ (Trang 2)', emoji_id: uidId('su_medal_role'), value: 'roles:2' },
    { label: 'Kho Role — Trang 3', description: 'Role Quyền Năng đang giữ (Trang 3)', emoji_id: uidId('su_medal_role'), value: 'roles:3' },
    { label: 'Kho Pháp Bảo — Trang 1', description: 'Vũ Khí, Bảo Ngọc, Chiến Hồn (Trang 1)', emoji_id: uidId('su_crossed_swords'), value: 'items:1' },
    { label: 'Kho Pháp Bảo — Trang 2', description: 'Vũ Khí, Bảo Ngọc, Chiến Hồn (Trang 2)', emoji_id: uidId('su_crossed_swords'), value: 'items:2' },
    { label: 'Kho Pháp Bảo — Trang 3', description: 'Vũ Khí, Bảo Ngọc, Chiến Hồn (Trang 3)', emoji_id: uidId('su_crossed_swords'), value: 'items:3' },
    { label: 'Kho Linh Thú — Trang 1', description: 'Danh sách Linh Thú chi tiết (Trang 1)', emoji_id: uidId('su_pet_paw'), value: 'pets:1' },
    { label: 'Kho Linh Thú — Trang 2', description: 'Danh sách Linh Thú chi tiết (Trang 2)', emoji_id: uidId('su_pet_paw'), value: 'pets:2' },
    { label: 'Vật Phẩm Tiêu Hao & Mở Khóa', description: 'Đá Khắc Ấn, Vé Gacha, Đá Đột Phá & Khung Viền', emoji_id: uidId('su_enchant_stone'), value: 'consumables:1' },
  ];

  let curMsg = 'inv_edit_0';
  for (let k = 1; k <= 4; k += 1) {
    const baseY = 780 + k * 540;
    const selId = `sel_inv_${k}`;
    const varName = `picked_inv_${k}`;
    const apiId = `inv_vapi_${k}`;
    const resName = `inv_vres_${k}`;
    const msgId = `inv_edit_${k}`;

    gb.advSelectMenu(selId, curMsg, {
      placeholder: 'Chuyển Tab & Trang (1/2/3) Túi Đồ Tiên Giới...',
      customVariableName: varName,
      basic_options: invOpts,
      row: '1',
      weight: '1',
      showReplies: 'hide',
    }, { x: 240, y: baseY - 360 });

    apiAction(
      gb,
      apiId,
      resName,
      'GET',
      `${BACKEND_BASE}/api/inv/{user_id}?view={${varName}}&username={encode_text[{user_displayName}]}&avatar={encode_text[{user_icon}]}`,
      '',
      { x: 240, y: baseY - 180 },
    );
    gb.link(selId, apiId);

    embedMsg(gb, msgId, {
      title: `{${resName}.response.view_title}`,
      description: `{${resName}.response.view_description}`,
      color: '#a855f7',
      footer: '',
      target: { editId: 'inv_ack' },
      action_id: 'inv_ack',
    }, { x: 240, y: baseY });
    gb.link(apiId, msgId);
    curMsg = msgId;
  }

  return patchAckRewardText(gb.elements());
}

// ============================================================================
// 5. /updates — Hotfix v1.5.1 (+1.000 LT) + Dropdown chọn v1.5.1 -> v1.1
// ============================================================================
export function buildUpdatesV151Cmd() {
  const gb = new PaginatedGraphBuilder();
  gb.rootSlash('updates', 'Xem bản cập nhật mới nhất (Hotfix v1.5.1) và chuyển xem lịch sử ngay tại chỗ', { ephemeral: false });
  gb.errorHandlerWait();

  apiAction(gb, 'upds_api', 'upds_res', 'GET', `${BACKEND_BASE}/api/update`, '', { x: 0, y: 220 });
  gb.link('root', 'upds_api');

  embedMsg(gb, 'upds_msg_0', {
    title: '{upds_res.response.title}',
    description: '{upds_res.response.description}',
    color: '#ec4899',
    footer: '',
    target: { reply: true },
    editId: 'upds_msg_0',
  }, { x: 0, y: 400 });
  gb.link('upds_api', 'upds_msg_0');

  const verOpts = [
    {
      label: 'Phiên bản v1.5.1 (Mới nhất • Hotfix +1.000 LT)',
      description: 'Sửa lỗi lưu Role Gacha, Phân trang Trang 1/2/3 & Đền bù +1.000 LT',
      emoji_id: uidId('su_medal_role'),
      value: '1.5.1',
    },
    {
      label: 'Phiên bản v1.5 (Big Update)',
      description: 'Cân bằng PvE, +550% Pet, Khắc Ấn mới, Buff SET, Pity 350 & Quà +2.000 LT',
      emoji_id: uidId('su_sparkle'),
      value: '1.5',
    },
    {
      label: 'Phiên bản v1.4.7',
      description: 'AutoSell, Tháp 500 tầng, Web Battle Logs 48h & Wiki rút gọn',
      emoji_id: uidId('su_gacha_dice'),
      value: '1.4.7',
    },
    {
      label: 'Phiên bản v1.4.5',
      description: 'Lệnh /exp Boost Chat/Voice, Role Gradient 2 màu & cân bằng',
      emoji_id: uidId('su_level_up'),
      value: '1.4.5',
    },
    {
      label: 'Phiên bản v1.4',
      description: 'Đạo Áp, Shop Ngày, Chiếm Đoạt Linh Mạch & Khám Phá 12 Map',
      emoji_id: uidId('explorer_world_map_v14'),
      value: '1.4',
    },
    {
      label: 'Phiên bản v1.3.1',
      description: 'Linh Vực trên /profile & /battle, Emoji 5 Vực & Kho Linh Thú',
      emoji_id: uidId('su_realm_star'),
      value: '1.3.1',
    },
    {
      label: 'Phiên bản v1.3',
      description: 'Linh Vực, 50 Pet, 100 Pháp Bảo, Minigame, Nông Trại /farm & /exchange',
      emoji_id: uidId('su_thunder_hax'),
      value: '1.3',
    },
    {
      label: 'Phiên bản v1.2',
      description: 'Khắc Ấn D->S, 6 Việc Làm /job, Tháp Thí Luyện & Túi Đồ /inv mới',
      emoji_id: uidId('su_enchant_anvil'),
      value: '1.2',
    },
    {
      label: 'Phiên bản v1.1',
      description: 'Mở rộng Gacha, /info, /phapbao, Thẻ Reset Tháp & cân bằng',
      emoji_id: uidId('su_wiki_scroll'),
      value: '1.1',
    },
  ];

  let curMsgId = 'upds_msg_0';
  for (let k = 1; k <= 7; k += 1) {
    const prevIdx = k - 1;
    const baseY = 400 + k * 540;
    const selId = `sel_upds_${prevIdx}`;
    const varName = `picked_upd_ver_${prevIdx}`;
    const apiId = `upds_ver_api_${k}`;
    const resName = `upds_vres_${k}`;
    const msgId = `upds_msg_${k}`;

    gb.advSelectMenu(selId, curMsgId, {
      placeholder: 'Chọn phiên bản để xem ngay trên bảng này (v1.5.1 -> v1.1)...',
      customVariableName: varName,
      basic_options: verOpts,
      row: '1',
      weight: '1',
      showReplies: 'hide',
    }, { x: 0, y: baseY - 360 });

    apiAction(gb, apiId, resName, 'GET', `${BACKEND_BASE}/api/update/{${varName}}`, '', { x: 0, y: baseY - 180 });
    gb.link(selId, apiId);

    embedMsg(gb, msgId, {
      title: `{${resName}.response.title}`,
      description: `{${resName}.response.description}`,
      color: '#ec4899',
      footer: '',
      target: { editId: 'upds_msg_0' },
      action_id: 'upds_msg_0',
    }, { x: 0, y: baseY });
    gb.link(apiId, msgId);
    curMsgId = msgId;
  }

  return gb.elements();
}

const TARGETS = [
  { name: 'roles', build: buildRolesPaginatedCmd },
  { name: 'phapbao', build: buildPhapBaoPaginatedCmd },
  { name: 'linhvuc', build: buildLinhVucPaginatedCmd },
  { name: 'inv', build: buildInvPaginatedCmd },
  { name: 'updates', build: buildUpdatesV151Cmd },
];

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const filterArg = process.argv.find((a) => a.startsWith('--only='));
  const onlyNames = filterArg ? new Set(filterArg.slice('--only='.length).split(',')) : null;

  for (const t of TARGETS) {
    if (onlyNames && !onlyNames.has(t.name)) continue;
    const els = t.build();
    assertCleanAndAcyclic(els, `/${t.name}`);
    console.log(`[Offline OK] /${t.name}: ${els.length} elements`);
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
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  console.log('[v1.5.1 Pagination BotGhost Deploy] COMPLETE!');
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
