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
import { JOBS_CATALOG, SHOP_CONSUMABLES } from '../src/data/catalog.js';
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
  const cTwHasImg = gb.cmp('nv_tw_has_img', '{nv_t_res.response.image_url}', '^https://', 'matches_pattern', { option: '', not: false }, { x: -120, y: 800 });
  gb.link(nvTwOk, cTwHasImg.condId);

  embedMsg(gb, 'nv_msg_tw', {
    title: `${uidEm('su_arena')} THÁP THÍ LUYỆN 500 TẦNG`,
    description: '{nv_t_res.response.message}',
    imageUrl: '{nv_t_res.response.image_url}',
    color: '#3b82f6',
  }, { x: -250, y: 980 });
  gb.link(cTwHasImg.yes, 'nv_msg_tw');
  gb.advBtn('btn_nv_tw_weblog', 'nv_msg_tw', {
    style: 'LINK',
    label: 'Xem Chi Tiết Trên Web',
    emoji_id: uidId('su_realm_star'),
    URL: '{nv_t_res.response.webLogUrl}',
    orderComponent: true,
    row: '1',
    weight: '1',
    showReplies: 'hide',
  }, { x: -250, y: 1140 });

  embedMsg(gb, 'nv_msg_tw_noimg', {
    title: `${uidEm('su_arena')} THÁP THÍ LUYỆN 500 TẦNG`,
    description: '{nv_t_res.response.message}',
    imageUrl: '',
    color: '#3b82f6',
  }, { x: 20, y: 980 });
  gb.link(cTwHasImg.no, 'nv_msg_tw_noimg');

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
// 2. PATCH /shop (Edit-in-place toàn bộ + Khóa messageId + 3 Luck Potions rõ ràng)
// ============================================================================
function buildShopConsDescriptionV16() {
  const lt = uidEm('su_linhthach');
  return SHOP_CONSUMABLES.map((c) => {
    const icon = c.icon || uidEm('su_sparkle');
    return `• ${icon} **${c.name}** — **${Number(c.price || 0).toLocaleString('vi-VN')}** ${lt}\n  *${c.description}*`;
  }).join('\n');
}

function patchShopV16(origTree) {
  let els = JSON.parse(JSON.stringify(origTree));
  const byId = new Map(els.map((e) => [e.id, e]));

  // 1. Lock messageId into shop_prev_api & shop_buy_api
  const prevApi = byId.get('shop_prev_api');
  if (prevApi?.data?.data?.request_options) {
    prevApi.data.data.request_options.rawBody = '{"userId":"{user_id}","username":"{user_displayName}","avatarUrl":"{user_icon}","itemId":"{shop_preview_id}","messageId":"{message_id}"}';
  }

  const buyApi = byId.get('shop_buy_api');
  if (buyApi?.data?.data?.request_options) {
    buyApi.data.data.request_options.rawBody = '{"userId":"{user_id}","username":"{user_displayName}","avatarUrl":"{user_icon}","category":"{sh_prev_res.response.category}","itemId":"{sh_prev_res.response.item_id}","messageId":"{message_id}"}';
  }

  // 2. Cập nhật dropdown danh mục + Thêm mô tả rõ ràng cho Quầy Tiêu Hao & 3 Lọ Luck Potion
  const selCat = byId.get('sel_shop_cat');
  if (selCat?.data?.data?.basic_options) {
    selCat.data.data.showReplies = 'hide';
    selCat.data.data.placeholder = 'Chọn Quầy Cửa Hàng Tiên Giới (7 danh mục)...';
    for (const opt of selCat.data.data.basic_options) {
      if (opt.value === 'consumables') {
        opt.label = `Vật Phẩm Tiêu Hao & Luck Potion (${SHOP_CONSUMABLES.length} món)`;
        opt.description = 'Vé Gacha, 3 Lọ Luck Potion (+20/40/60%), Đá Sao, Đá Khắc Ấn, Đan Dược';
        opt.emoji_id = uidId('su_sparkle');
      }
    }
  }

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

  // 3. Cập nhật nội dung msg_shop_home & msg_shop_cons (đủ 14 món + Luck Potion)
  const msgHome = byId.get('msg_shop_home');
  if (msgHome?.data?.data?.message?.embeds?.[0]?.description) {
    let d = msgHome.data.data.message.embeds[0].description;
    d = d.replace(/\*\*Vật Phẩm \(8 món\)\*\*[^\n]*/g,
      `**Vật Phẩm Tiêu Hao & Luck Potion (${SHOP_CONSUMABLES.length} món)**: Vé Gacha, **3 Lọ Luck Potion (+20%/+40%/+60% Luck)**, Đá Sao, Đá Khắc Ấn, Reset Tháp, Đan Dược.`);
    if (!d.includes('Luck Potion')) {
      d += `\n${uidEm('su_sparkle')} **3 Lọ Luck Potion**: Mở bán ở Quầy Tiêu Hao *(+20%/+40%/+60% Luck theo lượt cho \`/roll\` & \`/dothach\`)*.\n${uidEm('su_realm_star')} **Phường Đổ Thạch**: Dùng \`/dothach\` để mua & cắt 20 Nguyên Thạch!`;
    }
    msgHome.data.data.message.embeds[0].description = d;
  }

  const msgCons = byId.get('msg_shop_cons');
  if (msgCons?.data?.data?.message?.embeds?.[0]) {
    msgCons.data.data.message.embeds[0].title = `${uidEm('pet_star_stone')} QUẦY VẬT PHẨM TIÊU HAO & LUCK POTION (${SHOP_CONSUMABLES.length} MÓN)`;
    msgCons.data.data.message.embeds[0].description = buildShopConsDescriptionV16();
  }

  // 4. Ép edit-in-place toàn bộ /shop (1 tin nhắn duy nhất qua shop_boot_msg -> editId: shop_main_msg)
  const gb = new V16GraphBuilder();
  for (const el of els) {
    if (el.source && el.target) {
      gb.edges.push(el);
      gb._edgeIds.add(el.id);
    } else {
      gb.nodes.push(el);
      gb._nodeIds.add(el.id);
    }
  }

  // Redirect root -> shop_boot_msg -> sh_root_cat (only if not already patched)
  if (!byId.has('shop_boot_msg')) {
    embedMsg(gb, 'shop_boot_msg', {
      title: `${uidEm('su_linhthach')} ĐANG MỞ TIÊN BẢO CÁC...`,
      description: 'Đang tải danh mục Cửa Hàng & Quầy Tiêu Hao (Luck Potion)...',
      color: '#ec4899',
      target: { reply: true },
      editId: 'shop_main_msg',
    }, { x: 0, y: 110 });
    gb.edges = gb.edges.filter((e) => {
      if (e.source === 'root' && e.target === 'sh_root_cat') {
        gb._edgeIds.delete(e.id);
        return false;
      }
      return true;
    });
    gb.link('root', 'shop_boot_msg');
    gb.link('shop_boot_msg', 'sh_root_cat');
  }

  // Gỡ shop_prev_ack & shop_role_ack để KHÔNG spawn tin nhắn trung gian thứ 2
  const rerouteEdge = (fromSrc, oldTgt, newTgt) => {
    for (const e of gb.edges) {
      if (e.source === fromSrc && e.target === oldTgt) {
        gb._edgeIds.delete(e.id);
        e.target = newTgt;
        e.id = `reactflow__edge-${fromSrc}-${newTgt}`;
        gb._edgeIds.add(e.id);
      }
    }
  };
  for (const s of ['set_sh_ring', 'set_sh_pet', 'set_sh_eq_w', 'set_sh_eq_g', 'set_sh_eq_s', 'set_sh_cons', 'set_sh_bg', 'set_sh_frame']) {
    rerouteEdge(s, 'shop_prev_ack', 'shop_prev_api');
  }
  rerouteEdge('sel_shop_role', 'shop_role_ack', 'shop_role_prev_api');
  gb.nodes = gb.nodes.filter((e) => {
    if (e.id === 'shop_prev_ack' || e.id === 'shop_role_ack') {
      gb._nodeIds.delete(e.id);
      return false;
    }
    return true;
  });
  gb.edges = gb.edges.filter((e) => {
    if ((e.source === 'shop_prev_ack' && e.target === 'shop_prev_api')
      || (e.source === 'shop_role_ack' && e.target === 'shop_role_prev_api')) {
      gb._edgeIds.delete(e.id);
      return false;
    }
    return true;
  });

  // Chuyển toàn bộ messages của /shop sang editId: 'shop_main_msg', showReplies: 'hide'
  const editIds = [
    'msg_shop_home', 'msg_shop_rings', 'msg_shop_pets', 'msg_shop_equip',
    'msg_shop_roles', 'msg_shop_cons', 'msg_shop_bgs', 'msg_shop_frames',
    'msg_qroll_eq', 'msg_qroll_pet', 'shop_prev_edit', 'shop_buy_msg',
    'shop_role_prev_edit', 'shop_role_buy_msg', 'shop_daily_msg', 'shop_daily_buy_edit',
    'qreq_gate_msg', 'qrpet_gate_msg', 'shpr_gate_msg', 'shby_gate_msg',
    'shrp_gate_msg', 'shrb_gate_msg',
  ];
  for (const el of gb.nodes) {
    if (editIds.includes(el.id) && el.data?.data) {
      el.data.data.target = { editId: 'shop_main_msg' };
      el.data.data.action_id = 'shop_main_msg';
      delete el.data.data.editId;
    }
    if ((el.type === 'advMessageButton' || el.type === 'advMessageSelectMenu') && el.data?.data) {
      el.data.data.showReplies = 'hide';
    }
  }

  // Nút truy cập nhanh [Tiêu Hao & Luck Potion] ngay tại Row 2 trang chủ /shop
  if (!gb._nodeIds.has('btn_home_cons')) {
    gb.advBtn('btn_home_cons', 'msg_shop_home', btnCfg('Tiêu Hao & Luck Potion', 'PRIMARY', 'su_sparkle', '2', '3', 'hide'), { x: 700, y: 1180 });
    gb.link('btn_home_cons', 'msg_shop_cons');
  }

  // Layer 2: Nút [Về Danh Mục Shop] ở mọi màn hình + đầy đủ 7 danh mục -> chọn/mua không bao giờ mất menu
  if (!gb._nodeIds.has('msg_shop_home_2')) {
    const baseMsgHome = gb.nodes.find((e) => e.id === 'msg_shop_home');
    const homeDesc = baseMsgHome?.data?.data?.message?.embeds?.[0]?.description || '';
    const homeTitle = baseMsgHome?.data?.data?.message?.embeds?.[0]?.title || `${uidEm('su_linhthach')} TIÊN BẢO CÁC • CỬA HÀNG SUMI FAMILY`;

    embedMsg(gb, 'msg_shop_home_2', {
      title: homeTitle,
      description: homeDesc,
      color: '#ec4899',
      target: { editId: 'shop_main_msg' },
      action_id: 'shop_main_msg',
    }, { x: 2400, y: 800 });

    const backSpecs = [
      { pid: 'msg_shop_rings', row: '2', w: '1' },
      { pid: 'msg_shop_pets', row: '2', w: '1' },
      { pid: 'msg_shop_equip', row: '4', w: '1' },
      { pid: 'msg_shop_roles', row: '2', w: '1' },
      { pid: 'msg_shop_cons', row: '2', w: '1' },
      { pid: 'msg_shop_bgs', row: '2', w: '1' },
      { pid: 'msg_shop_frames', row: '2', w: '1' },
      { pid: 'shop_prev_edit', row: '1', w: '2' },
      { pid: 'shop_buy_msg', row: '1', w: '1' },
      { pid: 'shop_role_prev_edit', row: '2', w: '1' },
      { pid: 'shop_role_buy_msg', row: '1', w: '1' },
      { pid: 'msg_qroll_eq', row: '1', w: '1' },
      { pid: 'msg_qroll_pet', row: '1', w: '1' },
      { pid: 'shop_daily_msg', row: '2', w: '1' },
      { pid: 'shop_daily_buy_edit', row: '1', w: '1' },
    ];
    for (const bs of backSpecs) {
      const bId = `btn_sh_back_${bs.pid}`;
      gb.advBtn(bId, bs.pid, btnCfg('Về Danh Mục Shop', 'SECONDARY', 'ui_refresh', bs.row, bs.w, 'hide'), { x: 2150, y: 800 });
      gb.link(bId, 'msg_shop_home_2');
    }

    const cloneCatOpts = selCat?.data?.data?.basic_options || [];
    gb.advSelectMenu('sel_shop_cat_2', 'msg_shop_home_2', {
      placeholder: 'Chọn Quầy Cửa Hàng Tiên Giới (7 danh mục)...',
      customVariableName: 'shop_pick_cat_2',
      basic_options: cloneCatOpts,
      row: '1',
      weight: '1',
      showReplies: 'hide',
    }, { x: 2400, y: 1000 });

    gb.cond('sh_sel_cat_2', 'comparison', { base_value: '{shop_pick_cat_2}', target: { self: true } }, { x: 2400, y: 1180 });
    gb.link('sel_shop_cat_2', 'sh_sel_cat_2');

    // Clone Layer-2 preview & buy pipeline (shop_prev_2_api -> shop_prev_2_edit -> btn_shop_buy_2 -> shop_buy_2_api -> shop_buy_2_msg)
    apiAction(gb, 'shop_prev_2_api', 'sh_p2_res', 'POST', `${BACKEND_BASE}/api/shop/preview`,
      '{"userId":"{user_id}","username":"{user_displayName}","avatarUrl":"{user_icon}","itemId":"{shop_preview_2_id}","messageId":"{message_id}"}', { x: 2400, y: 2050 });
    embedMsg(gb, 'shop_prev_2_edit', {
      title: '{sh_p2_res.response.title}',
      description: '{sh_p2_res.response.description}',
      color: '#ec4899',
      imageUrl: '{sh_p2_res.response.image_url}',
      target: { editId: 'shop_main_msg' },
      action_id: 'shop_main_msg',
    }, { x: 2400, y: 2230 });
    gb.link('shop_prev_2_api', 'shop_prev_2_edit');

    gb.advBtn('btn_shop_buy_2', 'shop_prev_2_edit', btnCfg('Mua Ngay', 'SUCCESS', 'su_linhthach', '1', '1', 'hide'), { x: 2400, y: 2410 });
    apiAction(gb, 'shop_buy_2_api', 'sh_b2_res', 'POST', `${BACKEND_BASE}/api/shop/buy`,
      '{"userId":"{user_id}","username":"{user_displayName}","avatarUrl":"{user_icon}","category":"{sh_p2_res.response.category}","itemId":"{sh_p2_res.response.item_id}","messageId":"{message_id}"}', { x: 2400, y: 2590 });
    gb.link('btn_shop_buy_2', 'shop_buy_2_api');
    embedMsg(gb, 'shop_buy_2_msg', {
      title: `${uidEm('su_sparkle')} GIAO DỊCH TIÊN BẢO CÁC`,
      description: '{sh_b2_res.response.message}',
      color: '#10b981',
      target: { editId: 'shop_main_msg' },
      action_id: 'shop_main_msg',
    }, { x: 2400, y: 2770 });
    gb.link('shop_buy_2_api', 'shop_buy_2_msg');

    const cloneCatDefs = [
      { key: 'rings', srcMsg: 'msg_shop_rings', sels: ['sel_shop_ring'], x: 1850 },
      { key: 'pets', srcMsg: 'msg_shop_pets', sels: ['sel_shop_pet'], x: 2050 },
      { key: 'equipment', srcMsg: 'msg_shop_equip', sels: ['sel_shop_eq_w', 'sel_shop_eq_g', 'sel_shop_eq_s'], x: 2250 },
      { key: 'roles', srcMsg: 'msg_shop_roles', sels: ['sel_shop_role'], x: 2450, isRole: true },
      { key: 'consumables', srcMsg: 'msg_shop_cons', sels: ['sel_shop_cons'], x: 2650 },
      { key: 'backgrounds', srcMsg: 'msg_shop_bgs', sels: ['sel_shop_bg'], x: 2850 },
      { key: 'frames', srcMsg: 'msg_shop_frames', sels: ['sel_shop_frame'], x: 3050, isElse: true },
    ];
    for (const cd of cloneCatDefs) {
      const brId = `shs2_${cd.key}`;
      if (cd.isElse) gb.elseBranch('sh_sel_cat_2', brId, 'comparison', { x: cd.x, y: 1320 });
      else gb.branch('sh_sel_cat_2', brId, 'comparison', { type: 'equal_to', comparison_value: cd.key, ignoreCase: true, option: '', not: false }, { x: cd.x, y: 1320 });

      const srcNode = gb.nodes.find((e) => e.id === cd.srcMsg);
      const srcEmb = srcNode?.data?.data?.message?.embeds?.[0] || {};
      const m2Id = `${cd.srcMsg}_2`;
      embedMsg(gb, m2Id, {
        title: srcEmb.title || cd.key,
        description: srcEmb.description || '',
        color: srcEmb.color || '#ec4899',
        target: { editId: 'shop_main_msg' },
        action_id: 'shop_main_msg',
      }, { x: cd.x, y: 1480 });
      gb.link(brId, m2Id);

      if (cd.isRole) {
        const srcSel = gb.nodes.find((e) => e.id === 'sel_shop_role');
        if (srcSel) {
          gb.advSelectMenu('sel_shop_role_2', m2Id, {
            placeholder: srcSel.data.data.placeholder,
            customVariableName: 'picked_shop_role_2',
            basic_options: srcSel.data.data.basic_options || [],
            row: '1',
            weight: '1',
            showReplies: 'hide',
          }, { x: cd.x, y: 1660 });
          apiAction(gb, 'shop_role2_prev_api', 'sh_rp2_res', 'POST', `${BACKEND_BASE}/api/shop/preview`,
            '{"userId":"{user_id}","username":"{user_displayName}","avatarUrl":"{user_icon}","category":"roles","itemId":"{picked_shop_role_2}","messageId":"{message_id}"}', { x: cd.x, y: 1840 });
          gb.link('sel_shop_role_2', 'shop_role2_prev_api');
          embedMsg(gb, 'shop_role2_prev_edit', {
            title: '{sh_rp2_res.response.title}',
            description: '{sh_rp2_res.response.description}',
            color: '#a855f7',
            target: { editId: 'shop_main_msg' },
            action_id: 'shop_main_msg',
          }, { x: cd.x, y: 2020 });
          gb.link('shop_role2_prev_api', 'shop_role2_prev_edit');
          const durs = [
            { id: '7d', label: 'Thuê 7 Ngày', dur: '7d', style: 'PRIMARY', w: '1', dx: -110 },
            { id: '30d', label: 'Thuê 30 Ngày', dur: '30d', style: 'PRIMARY', w: '2', dx: 0 },
            { id: 'perm', label: 'Mua Vĩnh Viễn', dur: 'permanent', style: 'SUCCESS', w: '3', dx: 110 },
          ];
          apiAction(gb, 'api_role2_buy', 'sh_rb2_res', 'POST', `${BACKEND_BASE}/api/shop/buy`,
            '{"userId":"{user_id}","username":"{user_displayName}","avatarUrl":"{user_icon}","duration":"{shop_role_dur_2}","messageId":"{message_id}"}', { x: cd.x, y: 2380 });
          for (const dOpt of durs) {
            const bR = `btn_role2_${dOpt.id}`;
            const sR = `set_role2_${dOpt.id}`;
            gb.advBtn(bR, 'shop_role2_prev_edit', btnCfg(dOpt.label, dOpt.style, 'su_medal_role', '1', dOpt.w, 'hide'), { x: cd.x + dOpt.dx, y: 2180 });
            gb.act(sR, 'set_unique_variable', { reference: 'shop_role_dur_2', value: dOpt.dur, success_handles: false }, { x: cd.x + dOpt.dx, y: 2280 });
            gb.link(bR, sR);
            gb.link(sR, 'api_role2_buy');
          }
          embedMsg(gb, 'shop_role2_buy_msg', {
            title: `${uidEm('su_medal_role')} MUA / THUÊ ROLE QUYỀN NĂNG`,
            description: '{sh_rb2_res.response.message}',
            color: '#10b981',
            target: { editId: 'shop_main_msg' },
            action_id: 'shop_main_msg',
          }, { x: cd.x, y: 2540 });
          gb.link('api_role2_buy', 'shop_role2_buy_msg');
        }
        continue;
      }

      if (cd.key === 'consumables') {
        gb.advBtn('btn_home_cons_2', 'msg_shop_home_2', btnCfg('Tiêu Hao & Luck Potion', 'PRIMARY', 'su_sparkle', '2', '1', 'hide'), { x: cd.x, y: 1180 });
        gb.link('btn_home_cons_2', m2Id);
        gb.advBtn('btn_b2_cons', 'shop_buy_2_msg', btnCfg('Quầy Tiêu Hao & Potion', 'PRIMARY', 'su_sparkle', '1', '1', 'hide'), { x: 2400, y: 2940 });
        gb.act('shop_cons_reread_api', 'api_action', {
          name: 'sh_c2_res',
          ephemeral: false,
          request_options: {
            method: 'GET',
            url: `${BACKEND_BASE}/api/shop/catalog?category=consumables&userId={user_id}`,
            headers: [],
            params: [],
            body: [],
            rawBody: '',
            contentType: 'application/json',
            options: { excludeEmptyFields: true, replaceParams: true, replaceURL: true, replaceHeaders: true, replaceBody: true, failOnError: false },
          },
          success_handles: false,
        }, { x: 2400, y: 3100 });
        gb.link('btn_b2_cons', 'shop_cons_reread_api');
        embedMsg(gb, 'shop_cons_leaf_msg', {
          title: `${uidEm('pet_star_stone')} QUẦY VẬT PHẨM TIÊU HAO & LUCK POTION (${SHOP_CONSUMABLES.length} MÓN)`,
          description: '{sh_c2_res.response.summary_text}',
          color: '#ec4899',
          target: { editId: 'shop_main_msg' },
          action_id: 'shop_main_msg',
        }, { x: 2400, y: 3260 });
        gb.link('shop_cons_reread_api', 'shop_cons_leaf_msg');
      }

      cd.sels.forEach((sId, idx) => {
        const srcSel = gb.nodes.find((e) => e.id === sId);
        if (!srcSel) return;
        const s2Id = `${sId}_2`;
        const var2 = `${srcSel.data.data.customVariableName}_2`;
        gb.advSelectMenu(s2Id, m2Id, {
          placeholder: srcSel.data.data.placeholder,
          customVariableName: var2,
          basic_options: srcSel.data.data.basic_options || [],
          row: srcSel.data.data.row || String(idx + 1),
          weight: '1',
          showReplies: 'hide',
        }, { x: cd.x + idx * 90, y: 1660 });
        const set2Id = `set_sh2_${sId}`;
        gb.act(set2Id, 'set_unique_variable', { reference: 'shop_preview_2_id', value: `{${var2}}`, success_handles: false }, { x: cd.x + idx * 90, y: 1840 });
        gb.link(s2Id, set2Id);
        gb.link(set2Id, 'shop_prev_2_api');
      });
    }
  }

  return gb.elements();
}

// ============================================================================
// 3. CREATE /dothach (20 Nguyên Thạch, Edit-in-place toàn bộ, giữ nút mọi bước)
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
    editId: 'dt_stall_msg',
  }, { x: 0, y: 720 });
  gb.link(dtOk, 'dt_stall_msg');

  let seq = 0;
  const uid = (p) => `${p}_${++seq}`;

  function attachSupremeSelect(parentMsgId, depth, x, y) {
    const sId = uid('sel_dt_sup');
    const apiId = uid('dt_api_sup');
    const msgId = uid('dt_msg_sup');
    const resVar = `dt_sres_${seq}`;
    const pickVar = `picked_dt_sup_${seq}`;

    gb.advSelectMenu(sId, parentMsgId, {
      placeholder: 'Mở Hộp Tối Thượng Cực Phẩm (Chọn 1 trong 7 nhóm Thần Thoại)...',
      customVariableName: pickVar,
      basic_options: SUPREME_PICK_CATEGORIES.map((c) => ({
        label: c.label,
        description: c.desc,
        emoji_id: uidId('dao_ap_crest'),
        value: c.key,
      })),
      row: '2',
      weight: '1',
      showReplies: 'hide',
    }, { x: x + 420, y });

    apiAction(gb, apiId, resVar, 'POST', `${BACKEND_BASE}/api/stones/claim-supreme`,
      `{"userId":"{user_id}","category":"{${pickVar}}","username":"{user_displayName}","avatarUrl":"{user_icon}"}`, { x: x + 420, y: y + 150 });
    gb.link(sId, apiId);

    embedMsg(gb, msgId, {
      title: `{${resVar}.response.title}`,
      description: `{${resVar}.response.description}`,
      color: '#f59e0b',
      imageUrl: `{${resVar}.response.image_url}`,
      target: { editId: 'dt_stall_msg' },
      action_id: 'dt_stall_msg',
    }, { x: x + 420, y: y + 300 });
    gb.link(apiId, msgId);

    if (depth < 2) {
      const bBack = uid('btn_dt_sup_back');
      const aBack = uid('dt_api_sup_bk');
      const mBack = uid('dt_msg_sup_bk');
      const rBack = `dt_sbk_${seq}`;
      gb.advBtn(bBack, msgId, btnCfg('Quay Lại Sạp Đá', 'SECONDARY', 'ui_refresh', '1', '1', 'hide'), { x: x + 420, y: y + 450 });
      apiAction(gb, aBack, rBack, 'GET', `${BACKEND_BASE}/api/stones/stall/{user_id}?tier={dt_res.response.tier_key}&username={user_displayName}&avatar={user_icon}`, '', { x: x + 420, y: y + 600 });
      gb.link(bBack, aBack);
      embedMsg(gb, mBack, {
        title: `{${rBack}.response.title}`,
        description: `{${rBack}.response.description}`,
        color: '#a855f7',
        imageUrl: `{${rBack}.response.image_url}`,
        target: { editId: 'dt_stall_msg' },
        action_id: 'dt_stall_msg',
      }, { x: x + 420, y: y + 750 });
      gb.link(aBack, mBack);
      attachRerollChain(mBack, 2, x + 420, y + 900);
    }
  }

  function attachRerollChain(parentMsgId, remRerolls, x, y) {
    if (remRerolls <= 0) return;
    const bRr = uid('btn_dt_rr');
    const aRr = uid('dt_api_rr');
    const mRr = uid('dt_msg_rr');
    const rRr = `dt_rr_${seq}`;
    gb.advBtn(bRr, parentMsgId, btnCfg('Đổi Lô Mới', 'SECONDARY', 'ui_refresh', '1', '4', 'hide'), { x, y });
    apiAction(gb, aRr, rRr, 'POST', `${BACKEND_BASE}/api/stones/reroll`,
      '{"userId":"{user_id}","tier":"{dt_res.response.tier_key}","username":"{user_displayName}","avatarUrl":"{user_icon}"}', { x, y: y + 140 });
    gb.link(bRr, aRr);
    embedMsg(gb, mRr, {
      title: `{${rRr}.response.title}`,
      description: `{${rRr}.response.description}`,
      color: '#a855f7',
      imageUrl: `{${rRr}.response.image_url}`,
      target: { editId: 'dt_stall_msg' },
      action_id: 'dt_stall_msg',
    }, { x, y: y + 280 });
    gb.link(aRr, mRr);
    attachRerollChain(mRr, remRerolls - 1, x, y + 420);
  }

  function attachStallLayer(parentMsgId, depth, x, y) {
    // 3 nút Soi Đá #1/#2/#3 gom chung vào 1 api_action + 1 preview embed bằng set_unique_variable
    const apiPrevId = uid('dt_api_prev');
    const resPrevVar = `dt_pr_${seq}`;
    const slotVar = `dt_slot_${seq}`;
    const msgPrevId = uid('dt_msg_prev');

    for (let slot = 1; slot <= 3; slot += 1) {
      const bx = x + (slot - 2) * 180;
      const bId = uid(`btn_dt_prev${slot}`);
      const setId = uid(`set_dt_sl${slot}`);
      gb.advBtn(bId, parentMsgId, btnCfg(`Soi Đá #${slot}`, 'PRIMARY', 'su_realm_star', '1', String(slot), 'hide'), { x: bx, y });
      gb.act(setId, 'set_unique_variable', { reference: slotVar, value: String(slot), success_handles: false }, { x: bx, y: y + 130 });
      gb.link(bId, setId);
      gb.link(setId, apiPrevId);
    }

    apiAction(gb, apiPrevId, resPrevVar, 'POST', `${BACKEND_BASE}/api/stones/preview`,
      `{"userId":"{user_id}","tier":"{dt_res.response.tier_key}","slotIndex":"{${slotVar}}","username":"{user_displayName}","avatarUrl":"{user_icon}"}`, { x, y: y + 260 });

    embedMsg(gb, msgPrevId, {
      title: `{${resPrevVar}.response.title}`,
      description: `{${resPrevVar}.response.description}`,
      color: '#ec4899',
      imageUrl: `{${resPrevVar}.response.image_url}`,
      target: { editId: 'dt_stall_msg' },
      action_id: 'dt_stall_msg',
    }, { x, y: y + 400 });
    gb.link(apiPrevId, msgPrevId);

    // Trên màn Soi Đá: [Thiết Thạch] | [Quay Lại Sạp Đá] | [Đổi Lô Mới] (tất cả edit tại chỗ + giữ nút)
    const bCut = uid('btn_dt_cut');
    const aCut = uid('dt_api_cut');
    const mCut = uid('dt_msg_cut');
    const rCut = `dt_ct_${seq}`;
    gb.advBtn(bCut, msgPrevId, btnCfg('Thiết Thạch', 'SUCCESS', 'su_sparkle', '1', '1', 'hide'), { x: x - 240, y: y + 540 });
    apiAction(gb, aCut, rCut, 'POST', `${BACKEND_BASE}/api/stones/cut`,
      `{"userId":"{user_id}","tier":"{dt_res.response.tier_key}","slotIndex":"{${resPrevVar}.response.slot}","username":"{user_displayName}","avatarUrl":"{user_icon}"}`, { x: x - 240, y: y + 680 });
    gb.link(bCut, aCut);
    embedMsg(gb, mCut, {
      title: `{${rCut}.response.title}`,
      description: `{${rCut}.response.description}`,
      color: '#10b981',
      imageUrl: `{${rCut}.response.image_url}`,
      target: { editId: 'dt_stall_msg' },
      action_id: 'dt_stall_msg',
    }, { x: x - 240, y: y + 820 });
    gb.link(aCut, mCut);

    const bBack = uid('btn_dt_back');
    const aBack = uid('dt_api_back');
    const mBack = uid('dt_msg_back');
    const rBack = `dt_bk_${seq}`;
    gb.advBtn(bBack, msgPrevId, btnCfg('Quay Lại Sạp Đá', 'PRIMARY', 'su_realm_star', '1', '2', 'hide'), { x: x - 20, y: y + 540 });
    apiAction(gb, aBack, rBack, 'GET', `${BACKEND_BASE}/api/stones/stall/{user_id}?tier={dt_res.response.tier_key}&username={user_displayName}&avatar={user_icon}`, '', { x: x - 20, y: y + 680 });
    gb.link(bBack, aBack);
    embedMsg(gb, mBack, {
      title: `{${rBack}.response.title}`,
      description: `{${rBack}.response.description}`,
      color: '#a855f7',
      imageUrl: `{${rBack}.response.image_url}`,
      target: { editId: 'dt_stall_msg' },
      action_id: 'dt_stall_msg',
    }, { x: x - 20, y: y + 820 });
    gb.link(aBack, mBack);

    const bPrevRr = uid('btn_dt_prr');
    const aPrevRr = uid('dt_api_prr');
    const mPrevRr = uid('dt_msg_prr');
    const rPrevRr = `dt_prr_${seq}`;
    gb.advBtn(bPrevRr, msgPrevId, btnCfg('Đổi Lô Mới', 'SECONDARY', 'ui_refresh', '1', '3', 'hide'), { x: x + 200, y: y + 540 });
    apiAction(gb, aPrevRr, rPrevRr, 'POST', `${BACKEND_BASE}/api/stones/reroll`,
      '{"userId":"{user_id}","tier":"{dt_res.response.tier_key}","username":"{user_displayName}","avatarUrl":"{user_icon}"}', { x: x + 200, y: y + 680 });
    gb.link(bPrevRr, aPrevRr);
    embedMsg(gb, mPrevRr, {
      title: `{${rPrevRr}.response.title}`,
      description: `{${rPrevRr}.response.description}`,
      color: '#a855f7',
      imageUrl: `{${rPrevRr}.response.image_url}`,
      target: { editId: 'dt_stall_msg' },
      action_id: 'dt_stall_msg',
    }, { x: x + 200, y: y + 820 });
    gb.link(aPrevRr, mPrevRr);

    attachSupremeSelect(msgPrevId, depth, x + 120, y + 540);

    // Nút [Đổi Lô Mới] chính trên Sạp Đá
    const bRr = uid('btn_dt_reroll');
    const aRr = uid('dt_api_reroll');
    const mRr = uid('dt_msg_reroll');
    const rRr = `dt_rrs_${seq}`;
    gb.advBtn(bRr, parentMsgId, btnCfg('Đổi Lô Mới', 'SECONDARY', 'ui_refresh', '1', '4', 'hide'), { x: x + 360, y });
    apiAction(gb, aRr, rRr, 'POST', `${BACKEND_BASE}/api/stones/reroll`,
      '{"userId":"{user_id}","tier":"{dt_res.response.tier_key}","username":"{user_displayName}","avatarUrl":"{user_icon}"}', { x: x + 360, y: y + 140 });
    gb.link(bRr, aRr);
    embedMsg(gb, mRr, {
      title: `{${rRr}.response.title}`,
      description: `{${rRr}.response.description}`,
      color: '#a855f7',
      imageUrl: `{${rRr}.response.image_url}`,
      target: { editId: 'dt_stall_msg' },
      action_id: 'dt_stall_msg',
    }, { x: x + 360, y: y + 280 });
    gb.link(aRr, mRr);

    attachSupremeSelect(parentMsgId, depth, x, y + 80);

    // Đệ quy giữ nguyên đầy đủ nút cho các bước tiếp theo
    if (depth < 1) {
      attachStallLayer(mCut, depth + 1, x - 900, y + 1020);
      attachStallLayer(mBack, depth + 1, x - 100, y + 1020);
      attachStallLayer(mPrevRr, depth + 1, x + 700, y + 1020);
      attachStallLayer(mRr, depth + 1, x + 1500, y + 1020);
    } else {
      // Ở lớp ngoài cùng: giữ trọn Soi/Cut/Quay Lại hoặc Đổi Lô thêm 3 lượt liên tiếp
      attachRerollChain(mRr, 3, x + 360, y + 430);
      attachRerollChain(mPrevRr, 2, x + 200, y + 980);
      attachSupremeSelect(mCut, depth + 1, x - 240, y + 980);
      const bCutBack = uid('btn_dt_cback');
      const aCutBack = uid('dt_api_cbk');
      const mCutBack = uid('dt_msg_cbk');
      const rCutBack = `dt_cbk_${seq}`;
      gb.advBtn(bCutBack, mCut, btnCfg('Quay Lại Sạp Đá', 'PRIMARY', 'su_realm_star', '1', '1', 'hide'), { x: x - 380, y: y + 980 });
      apiAction(gb, aCutBack, rCutBack, 'GET', `${BACKEND_BASE}/api/stones/stall/{user_id}?tier={dt_res.response.tier_key}&username={user_displayName}&avatar={user_icon}`, '', { x: x - 380, y: y + 1120 });
      gb.link(bCutBack, aCutBack);
      embedMsg(gb, mCutBack, {
        title: `{${rCutBack}.response.title}`,
        description: `{${rCutBack}.response.description}`,
        color: '#a855f7',
        imageUrl: `{${rCutBack}.response.image_url}`,
        target: { editId: 'dt_stall_msg' },
        action_id: 'dt_stall_msg',
      }, { x: x - 380, y: y + 1260 });
      gb.link(aCutBack, mCutBack);
      attachRerollChain(mCutBack, 2, x - 380, y + 1400);
      attachRerollChain(mBack, 2, x - 20, y + 980);
    }
  }

  attachStallLayer('dt_stall_msg', 0, 0, 920);

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

  const cCanReroll = gb.cmp('gq_can_reroll', '{gq_res.response.can_reroll}', 'true', 'equal_to', { ignoreCase: true, option: '', not: false }, { x: 0, y: 860 });
  gb.link(gqOk, cCanReroll.condId);

  // Nhánh Hung / Đại Hung (chưa giải hạn): Hiện nút [Cầu An Giải Hạn (250 LT)]
  embedMsg(gb, 'gq_draw_msg', {
    title: '{gq_res.response.title}',
    description: '{gq_res.response.description}',
    color: '#ec4899',
    imageUrl: '{gq_res.response.image_url}',
    target: { editId: 'gq_shake_msg' },
    action_id: 'gq_shake_msg',
  }, { x: -240, y: 1040 });
  gb.link(cCanReroll.yes, 'gq_draw_msg');

  // Nhánh Bình An / Tiểu Cát / Trung Cát / Đại Cát / Đã giải hạn: KHÔNG hiện nút Cầu An Giải Hạn
  embedMsg(gb, 'gq_draw_msg_clean', {
    title: '{gq_res.response.title}',
    description: '{gq_res.response.description}',
    color: '#ec4899',
    imageUrl: '{gq_res.response.image_url}',
    target: { editId: 'gq_shake_msg' },
    action_id: 'gq_shake_msg',
  }, { x: 260, y: 1040 });
  gb.link(cCanReroll.no, 'gq_draw_msg_clean');

  // Button Cầu An Giải Hạn (250 LT) — chỉ gắn trên gq_draw_msg
  gb.advBtn('btn_gq_reroll', 'gq_draw_msg', btnCfg('Cầu An Giải Hạn (250 LT)', 'PRIMARY', 'su_sparkle', '1', '1', 'hide'), { x: -240, y: 1220 });
  apiAction(gb, 'gq_api_reroll', 'gqr_res', 'POST', `${BACKEND_BASE}/api/fortune/reroll`,
    '{"userId":"{user_id}","username":"{user_displayName}","avatarUrl":"{user_icon}"}', { x: -240, y: 1380 });
  gb.link('btn_gq_reroll', 'gq_api_reroll');

  const cRrHasImg = gb.cmp('gq_rr_has_img', '{gqr_res.response.image_url}', '^https://', 'matches_pattern', { option: '', not: false }, { x: -240, y: 1540 });
  gb.link('gq_api_reroll', cRrHasImg.condId);

  embedMsg(gb, 'gq_msg_reroll', {
    title: '{gqr_res.response.title}',
    description: '{gqr_res.response.description}',
    color: '#10b981',
    imageUrl: '{gqr_res.response.image_url}',
    target: { editId: 'gq_shake_msg' },
    action_id: 'gq_shake_msg',
  }, { x: -380, y: 1720 });
  gb.link(cRrHasImg.yes, 'gq_msg_reroll');

  embedMsg(gb, 'gq_msg_reroll_err', {
    title: '{gqr_res.response.title}',
    description: '{gqr_res.response.description}',
    color: '#f43f5e',
    imageUrl: '',
    target: { editId: 'gq_shake_msg' },
    action_id: 'gq_shake_msg',
  }, { x: -60, y: 1720 });
  gb.link(cRrHasImg.no, 'gq_msg_reroll_err');

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
    '• [GIEO QUẺ ĐẦU NGÀY & NHIỆM VỤ] (/gieoque, /nhiemvu, /battle, /party, /linhmach): /gieoque mỗi ngày 1 lần (UTC+7) lắc ống xăm nhận 6 bậc Khí Vận (Đại Hung → Đại Cát, cộng/trừ nhẹ % EXP, % LT & % Luck) kèm thơ ứng nghiệm; gặp Hung/Đại Hung có thể Cầu An Giải Hạn (250 LT, 1/ngày). /nhiemvu giao diện gọn nhẹ gộp Nhiệm Vụ Ngày + Hợp Đồng Tuần (cách biệt rõ ràng) kèm Tháp 500 Tầng (cooldown 6s/lượt, /battle cooldown 15s).',
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

  if (want('job') && cmdMap.has('job')) {
    let els = sweepTreeV16(decomp(cmdMap.get('job').compressed_tree));
    const jobById = Object.fromEntries(JOBS_CATALOG.map((j) => [j.job_id, j]));
    for (const el of els) {
      if (el.id === 'sel_job_pick' && el.data?.data) {
        el.data.data.showReplies = 'hide';
        for (const opt of el.data.data.basic_options || []) {
          const j = jobById[opt.value];
          if (j) opt.description = `${j.ltMin}–${j.ltMax} LT + ${j.exp} EXP • Cooldown 1 giờ`;
        }
      }
      if (el.id === 'job_stat_ack' && el.data?.data) {
        el.data.data.editId = 'job_stat_msg';
      }
      if ((el.id === 'job_stat_edit' || el.id === 'job_pick_msg') && el.data?.data) {
        el.data.data.target = { editId: 'job_stat_msg' };
        el.data.data.action_id = 'job_stat_msg';
      }
    }
    validateTreeStrict(els, '/job');
    toDeploy.push({ name: 'job', type: 'slash', groupId: cmdMap.get('job').groupId || PROFILE_GROUP_ID, elements: els });
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
