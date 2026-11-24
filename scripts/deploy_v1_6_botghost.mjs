/**
 * scripts/deploy_v1_6_botghost.mjs
 * Triển khai toàn bộ cập nhật SuMi Family Ver 1.6 lên BotGhost qua Edge CDP (9222):
 * 1. REBUILD /nhiemvu (Sửa 200->500 Tầng, giao diện OwO 3 Tab + [Hàng Ngày]/[Hợp Đồng Tuần]/[Tháp 500 Tầng] + [Nhận Thưởng]/[Leo Tháp]/[Xem Bản Ảnh WebP]).
 * 2. PATCH /shop (Khóa message_id vào shop_prev_api & shop_buy_api sửa triệt để lỗi mua nhầm Viền/Nền, thêm 3 Lọ Luck Potion & dẫn /dothach).
 * 3. CREATE/DEPLOY /dothach (4 phân khúc, sạp 3 đá, soi manh mối, Đổi Lô, Thiết Thạch & Chọn 7 nhóm Tối Thượng).
 * 4. CREATE/DEPLOY /gieoque (Lắc ống xăm oracle_shake.gif -> nghỉ 2s -> Thẻ Quẻ WebP & thơ + Cầu An Giải Hạn 250 LT).
 * 5. REBUILD /updates (v1.6 +1.000 LT), PATCH /wiki (cập nhật v1.6), PATCH AI Mention (kiến thức v1.6) & Global Ack Gate +1.000 LT + 0% Unicode.
 *
 * Usage:
 *   node scripts/deploy_v1_6_botghost.mjs --dry-run
 *   node scripts/deploy_v1_6_botghost.mjs [--only=nhiemvu,shop,dothach,gieoque,updates,wiki,ai,sweep]
 */

import WebSocket from 'ws';
globalThis.WebSocket = WebSocket;

import fs from 'node:fs';
import LZString from 'lz-string';
import {
  GraphBuilder,
  cdpEval,
  deployViaCDP,
  validateGraph,
  validateRegexSafety,
} from './ga_builder_lib.mjs';
import { em, emId } from '../src/config/emojiHelper.js';
import { LUCK_POTIONS, STONE_TIERS, SUPREME_PICK_CATEGORIES } from '../src/data/v16ExpansionCatalog.js';
import { WIKI_CATEGORIES } from '../src/services/wikiService.js';

const PROFILE_GROUP_ID = '1782127263978';
const BACKEND_BASE = 'https://sumi-profile-backend.onrender.com';
const AI_MENTION_INT_ID = '4cc5db30-029c-4a55-86e6-6e6850012afd';

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

class V16GraphBuilder extends GraphBuilder {
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
      target: id,
      animated: false,
      arrowHeadType: 'arrowclosed',
      type: 'custom',
      id: `reactflow__edge-${parentMsgId}-${id}`,
    });
    return id;
  }

  waitSeconds(id, seconds = '2', { x = 0, y = 0 } = {}) {
    return this.act(id, 'wait_action', {
      type: 'wait_action',
      seconds: String(seconds),
      success_handles: false,
      validated: true,
      linked: true,
    }, { x, y, actOptKey: 'wait_action' });
  }
}

function assertAcyclicDAG(elements, label) {
  const adj = new Map();
  const nodes = new Set();
  for (const el of elements) {
    if (el.source && el.target) {
      if (!adj.has(el.source)) adj.set(el.source, []);
      adj.get(el.source).push(el.target);
    } else {
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
  for (const n of nodes) {
    if (!state.get(n)) dfs(n, [n]);
  }
}

function assertUniqueApiActionNames(elements, label) {
  const seen = new Set();
  for (const el of elements) {
    if (el.type === 'action' && el.data?.data?.type === 'api_action') {
      const n = String(el.data.data.name || '').trim();
      if (!n) throw new Error(`Empty api_action name in ${label} (${el.id})`);
      if (seen.has(n)) throw new Error(`Duplicate api_action name "${n}" in ${label}`);
      seen.add(n);
    }
  }
}

function assertSelectLimitsAndRegex(elements, label) {
  for (const el of elements) {
    if (el.type === 'advMessageSelectMenu') {
      const opts = el.data?.data?.basic_options || [];
      if (opts.length < 1 || opts.length > 25) {
        throw new Error(`Select menu "${el.id}" in ${label} has invalid count ${opts.length}`);
      }
    }
    const str = JSON.stringify(el);
    if (str.includes('matches_pattern')) {
      const pats = el.data?.data?.type === 'matches_pattern' ? [el.data?.data?.comparison_value] : [];
      for (const p of pats) {
        if (typeof p === 'string') validateRegexSafety(p, `${label}.${el.id}`);
      }
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
  footer = '',
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
        timestamp: false,
        author: { name: '', iconURL: '', url: '' },
        footer: footer ? { text: footer, iconURL: '' } : { text: '', iconURL: '' },
        image: { url: imageUrl || '' },
        thumbnail: { url: '' },
        fields: [],
      }],
    },
  };
  if (editId) data.editId = editId;
  if (action_id) data.action_id = action_id;
  return gb.act(id, 'advanced_message', data, pos);
}

function btnCfg(label, style, emojiName, row = '1', weight = '1', showReplies = 'show') {
  const eid = uidId(emojiName);
  return {
    label,
    style,
    emoji_id: eid || undefined,
    orderComponent: true,
    row,
    weight,
    showReplies,
  };
}

function attachAckBranchV16(gb, prefix, apiNodeId, resVarName, { editId = undefined, x = 0, y = 0 } = {}) {
  const gate = gb.cmp(`${prefix}_gate`, `{${resVarName}.response.needs_update_ack}`, 'true', 'equal_to', { ignoreCase: true, option: '', not: false }, { x, y });
  gb.link(apiNodeId, gate.condId);

  const msgAck = `${prefix}_msg_ack`;
  const btnAck = `${prefix}_btn_ack`;
  const apiAck = `${prefix}_api_ack`;
  const msgDone = `${prefix}_msg_done`;

  embedMsg(gb, msgAck, {
    title: `{${resVarName}.response.update_title}`,
    description: `{${resVarName}.response.update_description}`,
    color: '#ec4899',
    footer: '',
    target: editId ? { editId } : { reply: true },
    action_id: editId || undefined,
  }, { x: x - 260, y: y + 170 });
  gb.link(gate.yes, msgAck);

  gb.advBtn(btnAck, msgAck, btnCfg('Tôi Đã Đọc & Xác Nhận (+1.000 LT)', 'SUCCESS', 'su_linhthach', '1', '1', 'show'), { x: x - 260, y: y + 340 });

  apiAction(gb, apiAck, `${prefix}_ack_res`, 'POST', `${BACKEND_BASE}/api/update/ack`,
    '{"userId":"{user_id}","username":"{user_displayName}","avatarUrl":"{user_icon}"}', { x: x - 260, y: y + 510 });
  gb.link(btnAck, apiAck);

  embedMsg(gb, msgDone, {
    title: `${uidEm('su_level_up')} XÁC NHẬN CẬP NHẬT THÀNH CÔNG!`,
    description: `{${prefix}_ack_res.response.message}`,
    color: '#10b981',
    footer: '',
  }, { x: x - 260, y: y + 680 });
  gb.link(apiAck, msgDone);

  return gate.no;
}

// ============================================================================
// 1. REBUILD /nhiemvu (OwO 3 Tabs + 500 Tầng + WebP Card + Buttons)
// ============================================================================
export function buildNhiemvuV16Cmd() {
  const gb = new V16GraphBuilder();
  gb.rootSlash('nhiemvu', 'Xem Bảng Nhiệm Vụ (Hàng Ngày / Hợp Đồng Tuần / Tháp 500 Tầng) & Leo Tháp', { ephemeral: false });
  gb.errorHandlerWait();

  gb.option('hanh_dong', 'string', 'Chọn hành động hoặc bỏ trống để xem Bảng Nhiệm Vụ', {
    required: false,
    choices: ['status', 'weekly', 'tower_view', 'claim', 'claim_weekly', 'tower', 'reset'],
    x: 420,
    y: 0,
  });

  gb.cond('nv_mode', 'comparison', { base_value: '{option_hanh_dong}', target: { self: true } }, { x: 0, y: 180 });
  gb.link('root', 'nv_mode');

  // Direct action branches: claim, claim_weekly, tower, reset
  gb.branch('nv_mode', 'nv_br_claim', 'comparison', { type: 'equal_to', comparison_value: 'claim', ignoreCase: true, option: '', not: false }, { x: -720, y: 320 });
  gb.branch('nv_mode', 'nv_br_weekly', 'comparison', { type: 'equal_to', comparison_value: 'claim_weekly', ignoreCase: true, option: '', not: false }, { x: -420, y: 320 });
  gb.branch('nv_mode', 'nv_br_tower', 'comparison', { type: 'equal_to', comparison_value: 'tower', ignoreCase: true, option: '', not: false }, { x: -120, y: 320 });
  gb.branch('nv_mode', 'nv_br_reset', 'comparison', { type: 'equal_to', comparison_value: 'reset', ignoreCase: true, option: '', not: false }, { x: 180, y: 320 });
  gb.branch('nv_mode', 'nv_br_tw_view', 'comparison', { type: 'equal_to', comparison_value: 'tower_view', ignoreCase: true, option: '', not: false }, { x: 520, y: 320 });
  gb.elseBranch('nv_mode', 'nv_br_status', 'comparison', { x: 880, y: 320 });

  // Direct POST branches
  apiAction(gb, 'nv_api_claim', 'nv_c_res', 'POST', `${BACKEND_BASE}/api/quest/claim`,
    '{"userId":"{user_id}","username":"{user_displayName}","avatarUrl":"{user_icon}"}', { x: -720, y: 460 });
  gb.link('nv_br_claim', 'nv_api_claim');
  const nvClaimOk = attachAckBranchV16(gb, 'nvc', 'nv_api_claim', 'nv_c_res', { x: -720, y: 620 });
  embedMsg(gb, 'nv_msg_claim', { title: `${uidEm('su_quest_scroll')} NHẬN THƯỞNG NHIỆM VỤ NGÀY`, description: '{nv_c_res.response.message}', color: '#10b981' }, { x: -720, y: 840 });
  gb.link(nvClaimOk, 'nv_msg_claim');

  apiAction(gb, 'nv_api_cwk', 'nv_w_res', 'POST', `${BACKEND_BASE}/api/quest/claim-weekly`,
    '{"userId":"{user_id}","username":"{user_displayName}","avatarUrl":"{user_icon}"}', { x: -420, y: 460 });
  gb.link('nv_br_weekly', 'nv_api_cwk');
  const nvWkOk = attachAckBranchV16(gb, 'nvw', 'nv_api_cwk', 'nv_w_res', { x: -420, y: 620 });
  embedMsg(gb, 'nv_msg_cwk', { title: `${uidEm('su_quest_scroll')} NHẬN THƯỞNG HỢP ĐỒNG TUẦN`, description: '{nv_w_res.response.message}', color: '#a855f7' }, { x: -420, y: 840 });
  gb.link(nvWkOk, 'nv_msg_cwk');

  apiAction(gb, 'nv_api_tw', 'nv_t_res', 'POST', `${BACKEND_BASE}/api/quest/tower`,
    '{"userId":"{user_id}","username":"{user_displayName}","avatarUrl":"{user_icon}"}', { x: -120, y: 460 });
  gb.link('nv_br_tower', 'nv_api_tw');
  const nvTwOk = attachAckBranchV16(gb, 'nvt', 'nv_api_tw', 'nv_t_res', { x: -120, y: 620 });
  embedMsg(gb, 'nv_msg_tw', { title: `${uidEm('su_arena')} THÁP THÍ LUYỆN 500 TẦNG`, description: '{nv_t_res.response.message}', color: '#3b82f6' }, { x: -120, y: 840 });
  gb.link(nvTwOk, 'nv_msg_tw');

  apiAction(gb, 'nv_api_rst', 'nv_r_res', 'POST', `${BACKEND_BASE}/api/quest/tower/reset`,
    '{"userId":"{user_id}","username":"{user_displayName}","avatarUrl":"{user_icon}"}', { x: 180, y: 460 });
  gb.link('nv_br_reset', 'nv_api_rst');
  const nvRstOk = attachAckBranchV16(gb, 'nvr', 'nv_api_rst', 'nv_r_res', { x: 180, y: 620 });
  embedMsg(gb, 'nv_msg_rst', { title: `${uidEm('tower_reset_card')} HỒI LƯỢT THÁP THÍ LUYỆN`, description: '{nv_r_res.response.message}', color: '#f59e0b' }, { x: 180, y: 840 });
  gb.link(nvRstOk, 'nv_msg_rst');

  // Tower view branch (/nhiemvu hanh_dong:tower_view) -> hardcoded tab=tower
  apiAction(gb, 'nv_api_tw_view', 'nv_tv_res', 'GET', `${BACKEND_BASE}/api/quest/status/{user_id}?tab=tower&username={user_displayName}&avatar={user_icon}`, '', { x: 520, y: 460 });
  gb.link('nv_br_tw_view', 'nv_api_tw_view');
  const nvTvOk = attachAckBranchV16(gb, 'nvtv', 'nv_api_tw_view', 'nv_tv_res', { x: 520, y: 620 });
  embedMsg(gb, 'nv_tv_msg', { title: '{nv_tv_res.response.embed_title}', description: '{nv_tv_res.response.message}', color: '#f59e0b', footer: '' }, { x: 520, y: 840 });
  gb.link(nvTvOk, 'nv_tv_msg');

  // Default combined board view (Ngày + ─── + Hợp Đồng Tuần) -> hardcoded tab=daily
  apiAction(gb, 'nv_api_status', 'nv_res', 'GET', `${BACKEND_BASE}/api/quest/status/{user_id}?tab=daily&username={user_displayName}&avatar={user_icon}`, '', { x: 880, y: 460 });
  gb.link('nv_br_status', 'nv_api_status');

  const nvStatusOk = attachAckBranchV16(gb, 'nvs', 'nv_api_status', 'nv_res', { x: 880, y: 620 });
  embedMsg(gb, 'nv_board_msg', {
    title: '{nv_res.response.embed_title}',
    description: '{nv_res.response.message}',
    color: '#06b6d4',
    footer: '',
    target: { reply: true },
    editId: 'nv_board_msg',
  }, { x: 880, y: 840 });
  gb.link(nvStatusOk, 'nv_board_msg');

  // Helper unroll các nút Edit-in-place (KHÔNG spawn tin mới, KHÔNG có Leo Tháp / WebP, luôn giữ nút!)
  let uidCounter = 0;
  const nextTag = (pfx) => `${pfx}_${++uidCounter}`;

  function attachHomeButtons(parentMsgId, depth, { includeClaimDaily = true, includeClaimWeekly = true, x = 880, y = 1040 } = {}) {
    if (depth > 2) return;
    let weight = 1;

    if (includeClaimDaily) {
      const t = nextTag('nvcd');
      const bId = `btn_${t}`;
      const apiClaim = `api_${t}_c`;
      const apiStat = `api_${t}_s`;
      const msgEdit = `msg_${t}`;
      const bx = x - 340;

      gb.advBtn(bId, parentMsgId, btnCfg('Nhận Thưởng Ngày', 'SUCCESS', 'su_linhthach', '1', String(weight++), 'hide'), { x: bx, y });
      apiAction(gb, apiClaim, `${t}_cres`, 'POST', `${BACKEND_BASE}/api/quest/claim`, '{"userId":"{user_id}","username":"{user_displayName}","avatarUrl":"{user_icon}"}', { x: bx, y: y + 140 });
      gb.link(bId, apiClaim);
      apiAction(gb, apiStat, `${t}_sres`, 'GET', `${BACKEND_BASE}/api/quest/status/{user_id}?tab=daily&username={user_displayName}&avatar={user_icon}`, '', { x: bx, y: y + 280 });
      gb.link(apiClaim, apiStat);
      embedMsg(gb, msgEdit, {
        title: `{${t}_sres.response.embed_title}`,
        description: `{${t}_cres.response.message}\n────────────────────────\n{${t}_sres.response.message}`,
        color: '#10b981',
        target: { editId: 'nv_board_msg' },
        action_id: 'nv_board_msg',
      }, { x: bx, y: y + 420 });
      gb.link(apiStat, msgEdit);

      attachHomeButtons(msgEdit, depth + 1, { includeClaimDaily: false, includeClaimWeekly, x: bx, y: y + 580 });
    }

    if (includeClaimWeekly) {
      const t = nextTag('nvcw');
      const bId = `btn_${t}`;
      const apiClaim = `api_${t}_c`;
      const apiStat = `api_${t}_s`;
      const msgEdit = `msg_${t}`;
      const bx = x;

      gb.advBtn(bId, parentMsgId, btnCfg('Nhận Thưởng Tuần', 'PRIMARY', 'su_wiki_scroll', '1', String(weight++), 'hide'), { x: bx, y });
      apiAction(gb, apiClaim, `${t}_cres`, 'POST', `${BACKEND_BASE}/api/quest/claim-weekly`, '{"userId":"{user_id}","username":"{user_displayName}","avatarUrl":"{user_icon}"}', { x: bx, y: y + 140 });
      gb.link(bId, apiClaim);
      apiAction(gb, apiStat, `${t}_sres`, 'GET', `${BACKEND_BASE}/api/quest/status/{user_id}?tab=daily&username={user_displayName}&avatar={user_icon}`, '', { x: bx, y: y + 280 });
      gb.link(apiClaim, apiStat);
      embedMsg(gb, msgEdit, {
        title: `{${t}_sres.response.embed_title}`,
        description: `{${t}_cres.response.message}\n────────────────────────\n{${t}_sres.response.message}`,
        color: '#a855f7',
        target: { editId: 'nv_board_msg' },
        action_id: 'nv_board_msg',
      }, { x: bx, y: y + 420 });
      gb.link(apiStat, msgEdit);

      attachHomeButtons(msgEdit, depth + 1, { includeClaimDaily, includeClaimWeekly: false, x: bx, y: y + 580 });
    }

    // Nút xem Tháp 500 Tầng (Edit tại chỗ)
    {
      const t = nextTag('nvtw');
      const bId = `btn_${t}`;
      const apiStat = `api_${t}_s`;
      const msgEdit = `msg_${t}`;
      const bx = x + 340;

      gb.advBtn(bId, parentMsgId, btnCfg('Tháp 500 Tầng', 'SECONDARY', 'su_arena', '1', String(weight++), 'hide'), { x: bx, y });
      apiAction(gb, apiStat, `${t}_tres`, 'GET', `${BACKEND_BASE}/api/quest/status/{user_id}?tab=tower&username={user_displayName}&avatar={user_icon}`, '', { x: bx, y: y + 140 });
      gb.link(bId, apiStat);
      embedMsg(gb, msgEdit, {
        title: `{${t}_tres.response.embed_title}`,
        description: `{${t}_tres.response.message}`,
        color: '#f59e0b',
        target: { editId: 'nv_board_msg' },
        action_id: 'nv_board_msg',
      }, { x: bx, y: y + 280 });
      gb.link(apiStat, msgEdit);

      attachTowerButtons(msgEdit, depth + 1, { x: bx, y: y + 440 });
    }
  }

  function attachTowerButtons(parentMsgId, depth, { includeReset = true, x = 1220, y = 1480 } = {}) {
    if (depth > 2) return;
    let weight = 1;

    // Quay lại Ngày & Hợp Đồng Tuần (Edit tại chỗ)
    {
      const t = nextTag('nvbk');
      const bId = `btn_${t}`;
      const apiStat = `api_${t}_s`;
      const msgEdit = `msg_${t}`;

      gb.advBtn(bId, parentMsgId, btnCfg('Ngày & Hợp Đồng Tuần', 'PRIMARY', 'su_quest_scroll', '1', String(weight++), 'hide'), { x: x - 160, y });
      apiAction(gb, apiStat, `${t}_sres`, 'GET', `${BACKEND_BASE}/api/quest/status/{user_id}?tab=daily&username={user_displayName}&avatar={user_icon}`, '', { x: x - 160, y: y + 140 });
      gb.link(bId, apiStat);
      embedMsg(gb, msgEdit, {
        title: `{${t}_sres.response.embed_title}`,
        description: `{${t}_sres.response.message}`,
        color: '#06b6d4',
        target: { editId: 'nv_board_msg' },
        action_id: 'nv_board_msg',
      }, { x: x - 160, y: y + 280 });
      gb.link(apiStat, msgEdit);

      attachHomeButtons(msgEdit, depth + 1, { includeClaimDaily: true, includeClaimWeekly: true, x: x - 160, y: y + 440 });
    }

    if (includeReset) {
      const t = nextTag('nvrs');
      const bId = `btn_${t}`;
      const apiRst = `api_${t}_r`;
      const apiStat = `api_${t}_s`;
      const msgEdit = `msg_${t}`;

      gb.advBtn(bId, parentMsgId, btnCfg('Hồi Lượt Tháp', 'SECONDARY', 'tower_reset_card', '1', String(weight++), 'hide'), { x: x + 160, y });
      apiAction(gb, apiRst, `${t}_rres`, 'POST', `${BACKEND_BASE}/api/quest/tower/reset`, '{"userId":"{user_id}","username":"{user_displayName}","avatarUrl":"{user_icon}"}', { x: x + 160, y: y + 140 });
      gb.link(bId, apiRst);
      apiAction(gb, apiStat, `${t}_sres`, 'GET', `${BACKEND_BASE}/api/quest/status/{user_id}?tab=tower&username={user_displayName}&avatar={user_icon}`, '', { x: x + 160, y: y + 280 });
      gb.link(apiRst, apiStat);
      embedMsg(gb, msgEdit, {
        title: `{${t}_sres.response.embed_title}`,
        description: `{${t}_rres.response.message}\n────────────────────────\n{${t}_sres.response.message}`,
        color: '#f59e0b',
        target: { editId: 'nv_board_msg' },
        action_id: 'nv_board_msg',
      }, { x: x + 160, y: y + 420 });
      gb.link(apiStat, msgEdit);

      attachTowerButtons(msgEdit, depth + 1, { includeReset: false, x: x + 160, y: y + 580 });
    }
  }

  attachHomeButtons('nv_board_msg', 0, { includeClaimDaily: true, includeClaimWeekly: true, x: 880, y: 1040 });

  return gb.elements();
}

// ============================================================================
// 2. PATCH /shop (messageId Lock Fix + 3 Luck Potions + Đổ Thạch Shortcut)
// ============================================================================
function patchShopV16(origTree) {
  const els = JSON.parse(JSON.stringify(origTree));
  const byId = new Map(els.map((e) => [e.id, e]));

  // 1. Lock messageId into shop_prev_api & shop_buy_api (fix 4-preview buy-wrong-item bug)
  const prevApi = byId.get('shop_prev_api');
  if (prevApi?.data?.data?.request_options) {
    prevApi.data.data.request_options.rawBody = '{"userId":"{user_id}","username":"{user_displayName}","avatarUrl":"{user_icon}","itemId":"{shop_preview_id}","messageId":"{message_id}"}';
  }

  const buyApi = byId.get('shop_buy_api');
  if (buyApi?.data?.data?.request_options) {
    buyApi.data.data.request_options.rawBody = '{"userId":"{user_id}","username":"{user_displayName}","avatarUrl":"{user_icon}","category":"{sh_prev_res.response.category}","itemId":"{sh_prev_res.response.item_id}","messageId":"{message_id}"}';
  }

  // 2. Add 3 Luck Potions into sel_shop_cons (max 25 options)
  const selCons = byId.get('sel_shop_cons');
  if (selCons?.data?.data?.basic_options) {
    for (const p of LUCK_POTIONS) {
      if (!selCons.data.data.basic_options.some((o) => o.value === p.item_id) && selCons.data.data.basic_options.length < 25) {
        selCons.data.data.basic_options.push({
          label: `${p.name} (+${p.luck_bonus_pct}% Luck • ${p.charges} lượt)`,
          description: `${p.price.toLocaleString('vi-VN')} LT • Dùng /equip để uống`,
          emoji_id: uidId('su_sparkle'),
          value: p.item_id,
        });
      }
    }
    selCons.data.data.placeholder = `Chọn Vật Phẩm Tiêu Hao / Luck Potion (${selCons.data.data.basic_options.length} món)`;
  }

  // 3. Update msg_shop_home description to mention Luck Potions & /dothach
  const msgHome = byId.get('msg_shop_home');
  if (msgHome?.data?.data?.message?.embeds?.[0]?.description) {
    let d = msgHome.data.data.message.embeds[0].description;
    if (!d.includes('Luck Potion')) {
      d += `\n${uidEm('su_sparkle')} **3 Lọ Luck Potion**: Mở bán ở Quầy Tiêu Hao *(+20%/+40%/+60% Luck theo lượt cho \`/roll\` & \`/dothach\`)*.\n${uidEm('su_realm_star')} **Phường Đổ Thạch**: Dùng \`/dothach\` để mua & cắt 20 Nguyên Thạch!`;
      msgHome.data.data.message.embeds[0].description = d;
    }
  }

  return els;
}

// ============================================================================
// 3. CREATE /dothach (20 Nguyên Thạch, Manh Mối Mơ Hồ, Thiết Thạch & 7 Tối Thượng)
// ============================================================================
export function buildDothachV16Cmd() {
  const gb = new V16GraphBuilder();
  gb.rootSlash('dothach', 'Phường Đổ Thạch — Chọn Đá Thô, Soi Manh Mối & Thiết Thạch (Tách biệt Pity /roll)', { ephemeral: false });
  gb.errorHandlerWait();

  gb.option('phan_khuc', 'string', 'Chọn phân khúc sạp đá (Phàm / Linh / Tiên / Thần Thoại)', {
    required: false,
    choices: STONE_TIERS.map((t) => t.tier_key),
    x: 420,
    y: 0,
  });

  gb.cond('dt_tier_cond', 'comparison', { base_value: '{option_phan_khuc}', target: { self: true } }, { x: 0, y: 120 });
  gb.link('root', 'dt_tier_cond');

  const dtTierBranches = [
    { key: 'rare', x: -360 },
    { key: 'epic', x: -120 },
    { key: 'mythic', x: 120 },
  ];
  for (const tb of dtTierBranches) {
    const bId = `dt_br_${tb.key}`;
    const sId = `dt_set_${tb.key}`;
    gb.branch('dt_tier_cond', bId, 'comparison', { type: 'equal_to', comparison_value: tb.key, ignoreCase: true, option: '', not: false }, { x: tb.x, y: 220 });
    gb.act(sId, 'set_unique_variable', { reference: 'dt_tier_val', value: tb.key, success_handles: false }, { x: tb.x, y: 310 });
    gb.link(bId, sId);
  }
  gb.elseBranch('dt_tier_cond', 'dt_br_common', 'comparison', { x: 360, y: 220 });
  gb.act('dt_set_common', 'set_unique_variable', { reference: 'dt_tier_val', value: 'common', success_handles: false }, { x: 360, y: 310 });
  gb.link('dt_br_common', 'dt_set_common');

  apiAction(gb, 'dt_api_stall', 'dt_res', 'GET', `${BACKEND_BASE}/api/stones/stall/{user_id}?tier={dt_tier_val}&username={user_displayName}&avatar={user_icon}`, '', { x: 0, y: 410 });
  gb.link('dt_set_rare', 'dt_api_stall');
  gb.link('dt_set_epic', 'dt_api_stall');
  gb.link('dt_set_mythic', 'dt_api_stall');
  gb.link('dt_set_common', 'dt_api_stall');

  const dtOk = attachAckBranchV16(gb, 'dt', 'dt_api_stall', 'dt_res', { x: 0, y: 540 });

  embedMsg(gb, 'dt_stall_msg', {
    title: '{dt_res.response.title}',
    description: '{dt_res.response.description}',
    color: '#a855f7',
    imageUrl: '{dt_res.response.image_url}',
    target: { reply: true },
  }, { x: 0, y: 720 });
  gb.link(dtOk, 'dt_stall_msg');

  // Row 1 Buttons: Soi Đá #1 / #2 / #3 + Đổi Lô Mới
  for (let slot = 1; slot <= 3; slot += 1) {
    const bx = (slot - 2) * 320;
    const btnId = `btn_dt_prev_${slot}`;
    const apiPrevId = `dt_api_prev_${slot}`;
    const resPrev = `dt_p_res_${slot}`;
    const msgPrevId = `dt_msg_prev_${slot}`;
    const btnCutId = `btn_dt_cut_${slot}`;
    const apiCutId = `dt_api_cut_${slot}`;
    const resCut = `dt_c_res_${slot}`;
    const msgCutId = `dt_msg_cut_${slot}`;

    gb.advBtn(btnId, 'dt_stall_msg', btnCfg(`Soi Đá #${slot}`, 'PRIMARY', 'su_realm_star', '1', String(5 - slot), 'show'), { x: bx, y: 920 });
    apiAction(gb, apiPrevId, resPrev, 'POST', `${BACKEND_BASE}/api/stones/preview`,
      `{"userId":"{user_id}","tier":"{dt_res.response.tier_key}","slotIndex":${slot},"username":"{user_displayName}","avatarUrl":"{user_icon}"}`, { x: bx, y: 1080 });
    gb.link(btnId, apiPrevId);

    embedMsg(gb, msgPrevId, {
      title: `{${resPrev}.response.title}`,
      description: `{${resPrev}.response.description}`,
      color: '#ec4899',
      imageUrl: `{${resPrev}.response.image_url}`,
    }, { x: bx, y: 1240 });
    gb.link(apiPrevId, msgPrevId);

    gb.advBtn(btnCutId, msgPrevId, btnCfg(`Thiết Thạch #${slot}`, 'SUCCESS', 'su_sparkle', '1', '1', 'show'), { x: bx, y: 1400 });
    apiAction(gb, apiCutId, resCut, 'POST', `${BACKEND_BASE}/api/stones/cut`,
      `{"userId":"{user_id}","tier":"{dt_res.response.tier_key}","slotIndex":${slot},"username":"{user_displayName}","avatarUrl":"{user_icon}"}`, { x: bx, y: 1560 });
    gb.link(btnCutId, apiCutId);

    embedMsg(gb, msgCutId, {
      title: `{${resCut}.response.title}`,
      description: `{${resCut}.response.description}`,
      color: '#10b981',
      imageUrl: `{${resCut}.response.image_url}`,
    }, { x: bx, y: 1720 });
    gb.link(apiCutId, msgCutId);
  }

  // Đổi Lô Mới button (Row 1, Weight 1, showReplies: 'show' để giữ nguyên các nút trên bảng)
  gb.advBtn('btn_dt_reroll', 'dt_stall_msg', btnCfg('Đổi Lô Mới', 'SECONDARY', 'ui_refresh', '1', '1', 'show'), { x: 640, y: 920 });
  apiAction(gb, 'dt_api_reroll', 'dt_rr_res', 'POST', `${BACKEND_BASE}/api/stones/reroll`,
    '{"userId":"{user_id}","tier":"{dt_res.response.tier_key}","username":"{user_displayName}","avatarUrl":"{user_icon}"}', { x: 640, y: 1080 });
  gb.link('btn_dt_reroll', 'dt_api_reroll');
  embedMsg(gb, 'dt_msg_reroll', {
    title: '{dt_rr_res.response.title}',
    description: '{dt_rr_res.response.description}',
    color: '#a855f7',
    imageUrl: '{dt_rr_res.response.image_url}',
    target: { reply: true },
  }, { x: 640, y: 1240 });
  gb.link('dt_api_reroll', 'dt_msg_reroll');

  // Row 2 Select Menu: Chọn Quà Tối Thượng (7 nhóm)
  gb.advSelectMenu('sel_dt_supreme', 'dt_stall_msg', {
    placeholder: 'Mở Hộp Tối Thượng Cực Phẩm (Chọn 1 trong 7 nhóm Thần Thoại)...',
    customVariableName: 'picked_dt_supreme',
    basic_options: SUPREME_PICK_CATEGORIES.map((c) => ({
      label: c.label,
      description: c.desc,
      emoji_id: uidId('dao_ap_crest'),
      value: c.key,
    })),
    row: '2',
    weight: '1',
    showReplies: 'show',
  }, { x: 960, y: 860 });

  apiAction(gb, 'dt_api_sup', 'dt_sup_res', 'POST', `${BACKEND_BASE}/api/stones/claim-supreme`,
    '{"userId":"{user_id}","category":"{picked_dt_supreme}","username":"{user_displayName}","avatarUrl":"{user_icon}"}', { x: 960, y: 1040 });
  gb.link('sel_dt_supreme', 'dt_api_sup');

  embedMsg(gb, 'dt_msg_sup', {
    title: `{${'dt_sup_res'}.response.title}`,
    description: `{${'dt_sup_res'}.response.description}`,
    color: '#f59e0b',
    imageUrl: `{${'dt_sup_res'}.response.image_url}`,
  }, { x: 960, y: 1220 });
  gb.link('dt_api_sup', 'dt_msg_sup');

  return gb.elements();
}

// ============================================================================
// 4. CREATE /gieoque (Lắc ống xăm GIF -> 2s -> Quẻ Card WebP + Cầu An Giải Hạn)
// ============================================================================
export function buildGieoqueV16Cmd() {
  const gb = new V16GraphBuilder();
  gb.rootSlash('gieoque', 'Gieo Quẻ Đầu Ngày — Nhận Khí Vận (Đại Hung -> Đại Cát) & Thơ Ứng Nghiệm', { ephemeral: false });
  gb.errorHandlerWait();

  embedMsg(gb, 'gq_shake_msg', {
    title: `${uidEm('su_sparkle')} ĐANG THÀNH TÂM LẮC ỐNG XĂM...`,
    description: 'Xin Tu Sĩ chờ trong giây lát để quẻ linh ứng hiện hình...',
    color: '#f59e0b',
    imageUrl: `${BACKEND_BASE}/assets/fortune/oracle_shake.gif?v=1.6`,
    target: { reply: true },
    editId: 'gq_shake_msg',
  }, { x: 0, y: 180 });
  gb.link('root', 'gq_shake_msg');

  gb.waitSeconds('gq_wait', '2', { x: 0, y: 340 });
  gb.link('gq_shake_msg', 'gq_wait');

  apiAction(gb, 'gq_api_draw', 'gq_res', 'POST', `${BACKEND_BASE}/api/fortune/draw`,
    '{"userId":"{user_id}","username":"{user_displayName}","avatarUrl":"{user_icon}"}', { x: 0, y: 500 });
  gb.link('gq_wait', 'gq_api_draw');

  const gqOk = attachAckBranchV16(gb, 'gq', 'gq_api_draw', 'gq_res', { editId: 'gq_shake_msg', x: 0, y: 660 });

  embedMsg(gb, 'gq_draw_msg', {
    title: '{gq_res.response.title}',
    description: '{gq_res.response.description}',
    color: '#ec4899',
    imageUrl: '{gq_res.response.image_url}',
    target: { editId: 'gq_shake_msg' },
    action_id: 'gq_shake_msg',
  }, { x: 0, y: 900 });
  gb.link(gqOk, 'gq_draw_msg');

  // Button Cầu An Giải Hạn (250 LT)
  gb.advBtn('btn_gq_reroll', 'gq_draw_msg', btnCfg('Cầu An Giải Hạn (250 LT)', 'PRIMARY', 'su_sparkle', '1', '1', 'show'), { x: 0, y: 1080 });
  apiAction(gb, 'gq_api_reroll', 'gqr_res', 'POST', `${BACKEND_BASE}/api/fortune/reroll`,
    '{"userId":"{user_id}","username":"{user_displayName}","avatarUrl":"{user_icon}"}', { x: 0, y: 1240 });
  gb.link('btn_gq_reroll', 'gq_api_reroll');

  embedMsg(gb, 'gq_msg_reroll', {
    title: '{gqr_res.response.title}',
    description: '{gqr_res.response.description}',
    color: '#10b981',
    imageUrl: '{gqr_res.response.image_url}',
  }, { x: 0, y: 1400 });
  gb.link('gq_api_reroll', 'gq_msg_reroll');

  return gb.elements();
}

// ============================================================================
// 5. REBUILD /updates (v1.6 +1.000 LT)
// ============================================================================
function buildUpdateVersionOptionsV16() {
  return [
    { label: 'Phiên bản v1.6 (Mới nhất • +1.000 LT)', description: 'Đổ Thạch (/dothach), Gieo Quẻ (/gieoque), 3 Luck Potion & /nhiemvu mới', emoji_id: uidId('su_sparkle'), value: '1.6' },
    { label: 'Phiên bản v1.5.2 (+500 LT)', description: 'Chuẩn hóa thuật ngữ, /wiki Linh Vực & Từ Điển, /farm DM & EXP +30%', emoji_id: uidId('su_wiki_scroll'), value: '1.5.2' },
    { label: 'Phiên bản v1.5.1 (Hotfix)', description: 'Sửa lỗi lưu Role Gacha, Phân trang Trang 1/2/3 & Đền bù +1.000 LT', emoji_id: uidId('su_medal_role'), value: '1.5.1' },
    { label: 'Phiên bản v1.5 (Big Update)', description: 'Cân bằng PvE, +550% Pet, Khắc Ấn mới, Buff SET, Pity 350 & Quà +2.000 LT', emoji_id: uidId('su_sparkle'), value: '1.5' },
    { label: 'Phiên bản v1.4.7', description: 'AutoSell, Tháp 500 tầng, Web Battle Logs 48h & Wiki rút gọn', emoji_id: uidId('su_gacha_dice'), value: '1.4.7' },
    { label: 'Phiên bản v1.4.5', description: 'Lệnh /exp Boost Chat/Voice, Role Gradient 2 màu & cân bằng', emoji_id: uidId('su_level_up'), value: '1.4.5' },
    { label: 'Phiên bản v1.4', description: 'Đạo Áp, Shop Ngày, Chiếm Đoạt Linh Mạch & Khám Phá 12 Map', emoji_id: uidId('explorer_world_map_v14'), value: '1.4' },
    { label: 'Phiên bản v1.3.1', description: 'Linh Vực trên /profile & /battle, Emoji 5 Vực & Kho Linh Thú', emoji_id: uidId('su_realm_star'), value: '1.3.1' },
    { label: 'Phiên bản v1.3', description: 'Linh Vực, 50 Pet, 100 Pháp Bảo, Minigame, Nông Trại /farm & /exchange', emoji_id: uidId('su_thunder_hax'), value: '1.3' },
    { label: 'Phiên bản v1.2', description: 'Khắc Ấn D->S, 6 Việc Làm /job, Tháp Thí Luyện & Túi Đồ /inv mới', emoji_id: uidId('su_enchant_anvil'), value: '1.2' },
    { label: 'Phiên bản v1.1', description: 'Mở rộng Gacha, /info, /phapbao, Thẻ Reset Tháp & cân bằng', emoji_id: uidId('su_wiki_scroll'), value: '1.1' },
  ];
}

export function buildUpdatesV16Cmd() {
  const gb = new V16GraphBuilder();
  gb.rootSlash('updates', 'Xem bản cập nhật mới nhất (v1.6) và chuyển xem lịch sử ngay tại chỗ', { ephemeral: false });
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

  const verOpts = buildUpdateVersionOptionsV16();
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
      placeholder: 'Chọn phiên bản để xem ngay trên bảng này (v1.6 -> v1.1)...',
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

// ============================================================================
// 6. AI MENTION & GLOBAL SWEEP (+1.000 LT & 0% UNICODE)
// ============================================================================
function buildV16KnowledgeBlock(includeFuyumiSecret) {
  const lines = [
    'KIẾN THỨC CHÍNH THỨC TOÀN BỘ HỆ THỐNG BOT NHIỄM NHIỄM (SUMI FAMILY TỪ v1.1 ĐẾN v1.6):',
    '• [CẢNH GIỚI & EXP] (/profile, /rank, /exp, /doiqua, /top): 7 Đại Cảnh Giới từ Lv.1→Lv.100 mở dần 1→5 Slot Role. Chat nhận 23–35 EXP/45s, Voice nhận 85–135 EXP/5 phút (chấm công nền 12 phút); công thức lên cấp 78*(Lv^1.45) (max 500.000 EXP), lên cấp mới thưởng +50..+400 LT (chỉ nhận 1 lần/Lv). 8 Level Roles tự cộng dồn Buff EXP/Daily LT/Pet Power; /doiqua đổi 1.000 EXP lấy 10 LT; /exp xem tổng % Boost. /top có đủ 6 bảng (level, power, wealth, marry, chat, voice); Top Chat Ngày & Top Voice Ngày tự động trao 500 / 400 / 300 LT riêng cho Top 1–3 mỗi ngày lúc 00:00 (UTC+7) tại #bot-cmds, và 19:00 Chủ Nhật tổng kết Top Tuần Lực Chiến.',
    '• [LINH THÚ, KHẮC ẤN & BUFF SET] (/linhthu, /pet, /phapbao, /equip, /unequip, /enchant, /dismantle, /linhvuc): Linh Thú tăng trưởng Lv.1→Lv.100 đạt +550% và 1★→10★ đạt +135% (tổng 7.85× chỉ số gốc ở Lv.100 10★). Khắc Ấn /enchant nâng D (+0%) -> C (+8%) -> B (+18%) -> A (+32%) -> S (+50%) kèm Pity +5%/lần trượt (Thiên Đạo Tuyệt Ấn Thạch 100%). Buff SET 2 tầng không cộng dồn: Full Hệ Thường 4/4 (+8%) hoặc 5/5 (+12% toàn chỉ số); Set Thần Thoại cùng hệ 2/3/4/5 (+6%/+12%/+18%/+25% toàn chỉ số, mốc 5/5 thêm +10% Xuyên DEF & +1 Linh Mạch đầu trận).',
    '• [GACHA, LUCK POTION, ĐỔ THẠCH & CỬA HÀNG] (/roll, /dothach, /autosell, /shop, /inv, /info): /roll (50 LT/lượt, 450/10, Pity 350 tách riêng pet/equipment/domain). /shop có 7 quầy + Shop Ngày giảm 15–40%, bán thêm 3 Lọ Luck Potion (Tiểu Vận +20% 40 lượt 1.200 LT, Thiên Cơ +40% 60 lượt 3.200 LT, Hồng Mông +60% 80 lượt 6.800 LT — uống qua /equip, áp dụng cho cả /roll & /dothach, cộng dồn với /gieoque, không stack 2 lọ khác loại). /dothach (Phường Đổ Thạch — tách biệt hoàn toàn với /roll, không Pity 350): 4 phân khúc (Phàm 150 LT / Linh 450 LT / Tiên 1.200 LT / Thần Thoại 3.000 LT • 20 loài Nguyên Thạch) kèm manh mối mơ hồ để soi & cắt đá; trúng Tối Thượng Cực Phẩm mở Hộp Chọn Thần Thoại không Độc Nhất thuộc 7 nhóm.',
    '• [GIEO QUẺ ĐẦU NGÀY & NHIỆM VỤ] (/gieoque, /nhiemvu, /battle, /party, /linhmach): /gieoque mỗi ngày 1 lần (UTC+7) lắc ống xăm nhận 6 bậc Khí Vận (Đại Hung → Đại Cát, cộng/trừ nhẹ % EXP, % LT & % Luck) kèm thơ ứng nghiệm; gặp Hung/Đại Hung có thể Cầu An Giải Hạn (250 LT, 1/ngày). /nhiemvu giao diện gọn nhẹ gộp Nhiệm Vụ Ngày + Hợp Đồng Tuần (cách biệt rõ ràng) kèm Tháp 500 Tầng (cooldown 20s/lượt, /battle cooldown 15s).',
    '• [KHÁM PHÁ, NÔNG TRẠI DM, /WIKI 10 MỤC & /UPDATES] (/explorer, /farm, /exchange, /job, /daily, /marry, /giatoc, /tangqua, /coinflip, /slots, /blackjack, /crash, /wiki, /updates): /explorer 12 Địa danh (210–315 LT/giờ × hệ số + 0.5% Đá Tuyệt Ấn Thạch). /farm tách Linh Điền & Linh Các kèm DM nhắc tưới & sắp héo 1h/30p/15p. /wiki 10 chuyên mục. Bản cập nhật mới nhất /updates v1.6 tặng ngay +1.000 LT khi bấm Xác Nhận.',
  ];
  if (includeFuyumiSecret) {
    lines.push('• [BỘ TỐI THƯỢNG ĐỘC TÔN CỦA TIỂU THƯ FUYUMI]: Tiểu thư sở hữu Cửu Vĩ Hồng Hồ (cuu_vi_hong_ho), Viền Cửu Vĩ Hồng Mông Ấn (frame_kitsune_mythic) cùng Linh Vực Cửu Vĩ Hồng Mông (Đạo Áp 3 hiệp +30%), Thần Thức Thái Thượng Hồng Hồ và Thần Cảnh Vạn Cổ Tuyệt Diệt.');
  }
  return lines.join('\n');
}

function updateAiPromptTextV16(oldPrompt, includeFuyumiSecret) {
  let text = String(oldPrompt || '');
  text = text.replace(/tài liệu(?: hệ thống)? v1\.[0-9]+(?:\.[0-9]+)? bên dưới/g, 'tài liệu hệ thống v1.6 bên dưới');
  const startMatch = text.match(/KIẾN THỨC CHÍNH THỨC (?:TOÀN BỘ )?HỆ THỐNG BOT NHIỄM NHIỄM/);
  const sIdx = startMatch ? startMatch.index : -1;
  const endMarker = '\n\nBỘ DANH SÁCH EMOTE ĐỘNG DISCORD CHÍNH THỨC:';
  const eIdx = text.indexOf(endMarker);
  if (sIdx === -1 || eIdx === -1 || eIdx <= sIdx) {
    throw new Error(`Could not locate knowledge markers inside AI prompt (s=${sIdx}, e=${eIdx})`);
  }
  return text.slice(0, sIdx) + buildV16KnowledgeBlock(includeFuyumiSecret) + text.slice(eIdx);
}

function replaceUnicodePictographs(str) {
  if (typeof str !== 'string' || !str) return str;
  const map = {
    '✨': uidEm('su_sparkle'),
    '✅': uidEm('ui_check'),
    '❌': uidEm('ui_cross'),
    '⚠': uidEm('ui_warn'),
    '⚠️': uidEm('ui_warn'),
    '⛔': uidEm('ui_cross'),
    '👑': uidEm('ui_crown_king'),
    '💔': uidEm('ui_heart_broken'),
    '💕': uidEm('su_heart_pink', 'ui_heart_couple'),
    '💖': uidEm('su_heart_pink', 'ui_heart_couple'),
    '🌸': uidEm('su_sakura_petal', 'su_sparkle'),
    '🦊': uidEm('su_fox_mascot', 'su_pet_paw'),
    '📜': uidEm('su_wiki_scroll'),
    '🔄': uidEm('ui_refresh'),
    '🗼': uidEm('su_tower_boss'),
  };
  let out = str;
  for (const [uni, rep] of Object.entries(map)) {
    if (rep) out = out.split(uni).join(rep);
  }
  return out.replace(/[\uFE0F]/g, '').replace(/[\p{Extended_Pictographic}]/gu, uidEm('su_sparkle'));
}

function sweepTreeV16(tree) {
  const walk = (obj) => {
    if (typeof obj === 'string') {
      let s = replaceUnicodePictographs(obj);
      s = s.replace(/(?:Tôi Đã Đọc & )?Xác Nhận Cập Nhật \(\+[\d.,]+ LT\)/g, 'Tôi Đã Đọc & Xác Nhận (+1.000 LT)');
      s = s.replace(/Tôi Đã Đọc & Xác Nhận \(\+[\d.,]+ LT\)/g, 'Tôi Đã Đọc & Xác Nhận (+1.000 LT)');
      s = s.replace(/Cập nhật (?:SuMi )?v1\.[0-9]+(?:\.[0-9]+)?/g, 'Cập nhật v1.6');
      return s;
    }
    if (Array.isArray(obj)) return obj.map(walk);
    if (obj && typeof obj === 'object') {
      const out = {};
      for (const [k, v] of Object.entries(obj)) out[k] = walk(v);
      return out;
    }
    return obj;
  };
  return walk(tree);
}

function validateTreeStrict(els, label) {
  assertAcyclicDAG(els, label);
  assertUniqueApiActionNames(els, label);
  assertSelectLimitsAndRegex(els, label);
  const v = validateGraph(els);
  if (v && (v.ok === false || v.valid === false || (Array.isArray(v.errors) && v.errors.length > 0))) {
    throw new Error(`validateGraph failed for ${label}: ${JSON.stringify(v)}`);
  }
}

async function fetchAllLiveReduxState() {
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
    const rawCmds = st.data.bot.commands.slash.commands || {};
    const rawEvents = st.data.bot.commands.custom_events.events || {};
    return JSON.stringify({
      cmds: Object.values(rawCmds)
        .filter(c => c && c.name && c.compressed_tree)
        .map(c => ({ name: c.name, enabled: c.enabled !== false, groupId: c.groupId || '', compressed_tree: c.compressed_tree })),
      events: Object.values(rawEvents)
        .filter(e => e && e.name && e.compressed_tree)
        .map(e => ({ id: e.id, name: e.name, enabled: e.enabled !== false, compressed_tree: e.compressed_tree })),
    });
  })()`, 30000);
  return JSON.parse(raw);
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const onlyArg = args.find((a) => a.startsWith('--only='));
  const onlySet = onlyArg ? new Set(onlyArg.replace('--only=', '').split(',').map((s) => s.trim()).filter(Boolean)) : null;
  const want = (k) => !onlySet || onlySet.has(k);

  console.log(`=== SuMi v1.6 BotGhost Deployer (dryRun=${dryRun}, only=${onlyArg || 'ALL'}) ===`);

  const live = await fetchAllLiveReduxState();
  const cmdMap = new Map(live.cmds.map((c) => [c.name, c]));
  const eventMap = new Map(live.events.map((e) => [e.name, e]));

  const decomp = (ct) => JSON.parse(LZString.decompressFromBase64(ct));
  const toDeploy = [];

  if (want('nhiemvu')) {
    const els = sweepTreeV16(buildNhiemvuV16Cmd());
    validateTreeStrict(els, '/nhiemvu');
    toDeploy.push({ name: 'nhiemvu', type: 'slash', groupId: PROFILE_GROUP_ID, elements: els });
  }

  if (want('dothach')) {
    const els = sweepTreeV16(buildDothachV16Cmd());
    validateTreeStrict(els, '/dothach');
    toDeploy.push({ name: 'dothach', type: 'slash', groupId: PROFILE_GROUP_ID, elements: els });
  }

  if (want('gieoque')) {
    const els = sweepTreeV16(buildGieoqueV16Cmd());
    validateTreeStrict(els, '/gieoque');
    toDeploy.push({ name: 'gieoque', type: 'slash', groupId: PROFILE_GROUP_ID, elements: els });
  }

  if (want('updates')) {
    const els = sweepTreeV16(buildUpdatesV16Cmd());
    validateTreeStrict(els, '/updates');
    toDeploy.push({ name: 'updates', type: 'slash', groupId: PROFILE_GROUP_ID, elements: els });
  }

  if (want('shop') && cmdMap.has('shop')) {
    const els = sweepTreeV16(patchShopV16(decomp(cmdMap.get('shop').compressed_tree)));
    validateTreeStrict(els, '/shop');
    toDeploy.push({ name: 'shop', type: 'slash', groupId: cmdMap.get('shop').groupId || PROFILE_GROUP_ID, elements: els });
  }

  if (want('wiki') && cmdMap.has('wiki')) {
    let els = decomp(cmdMap.get('wiki').compressed_tree);
    els = sweepTreeV16(els).map((el) => {
      if (el.id === 'msg_wiki_cat_economy' && el.data?.data?.message?.embeds?.[0]) {
        const econ = WIKI_CATEGORIES.economy;
        el.data.data.message.embeds[0].title = econ.title;
        el.data.data.message.embeds[0].description = econ.description;
      }
      return el;
    });
    validateTreeStrict(els, '/wiki');
    toDeploy.push({ name: 'wiki', type: 'slash', groupId: cmdMap.get('wiki').groupId || PROFILE_GROUP_ID, elements: els });
  }

  if (want('ai')) {
    for (const [evName, evObj] of eventMap.entries()) {
      let els = decomp(evObj.compressed_tree);
      let touched = false;
      for (const el of els) {
        if (el.type === 'action' && el.data?.data?.type === 'ai_generate_text' && typeof el.data.data.prompt === 'string') {
          if (el.data.data.prompt.includes('KIẾN THỨC CHÍNH THỨC')) {
            const isFuyumiBranch = el.data.data.prompt.includes('Cửu Vĩ Hồng Hồ') || el.data.data.prompt.includes('TIỂU THƯ FUYUMI');
            el.data.data.prompt = updateAiPromptTextV16(el.data.data.prompt, isFuyumiBranch);
            touched = true;
          }
        }
      }
      if (touched) {
        els = sweepTreeV16(els);
        validateTreeStrict(els, `event:${evName}`);
        toDeploy.push({ name: evName, type: 'custom_event', id: evObj.id, elements: els });
      }
    }
  }

  if (want('sweep')) {
    const skip = new Set(['sticky-set', 'sticky-off', ...toDeploy.map((d) => d.name)]);
    for (const c of live.cmds) {
      if (!c.enabled || skip.has(c.name)) continue;
      const before = JSON.stringify(decomp(c.compressed_tree));
      if ((before.includes('Xác Nhận Cập Nhật') || before.includes('Tôi Đã Đọc & Xác Nhận')) && !before.includes('+1.000 LT')) {
        const swept = sweepTreeV16(decomp(c.compressed_tree));
        validateTreeStrict(swept, `sweep:/${c.name}`);
        toDeploy.push({ name: c.name, type: 'slash', groupId: c.groupId || PROFILE_GROUP_ID, elements: swept });
      }
    }
  }

  console.log(`Prepared ${toDeploy.length} targets: ${toDeploy.map((t) => `${t.type}:${t.name}`).join(', ')}`);

  if (dryRun) {
    console.log('[DRY RUN] All trees validated cleanly! Zero errors.');
    return;
  }

  for (const target of toDeploy) {
    console.log(`\n-> Deploying ${target.type} "${target.name}" (${target.elements.length} nodes)...`);
    const res = await deployViaCDP(target);
    console.log(`   Result:`, JSON.stringify(res));
    if (!res?.ok) {
      throw new Error(`Deploy failed for ${target.name}: ${JSON.stringify(res)}`);
    }
  }

  console.log(`\n=== ALL ${toDeploy.length} BOTGHOST v1.6 TARGETS DEPLOYED & VALIDATED ===`);
}

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});
