/**
 * scripts/deploy_v1_8a_botghost.mjs
 * Đồng bộ SuMi Family Ver 1.8A lên BotGhost Dashboard qua Edge CDP (9222):
 *   1. /upgrade     [NEW] — Tách nâng cấp Level (LT / Linh Quả / 2 Đan Tinh Hoa EXP) & Sao ra khỏi /linhthu.
 *   2. /linhthu     [PATCH] — Xóa lựa chọn upgrade_level / upgrade_star & option muc_dich (giữ list + active).
 *   3. /shop        [PATCH] — Chọn vật phẩm tiêu hao -> mở Modal nhập số lượng (Min 1 • Max 50).
 *   4. /shop_dacbiet [PATCH] — Chọn món -> mở Modal nhập số lượng + nút [Nhập Số TT...] -> Modal đổi TT (Min 5 • Max 200).
 *   5. /exchange    [PATCH] — Gắn dropdown chọn gói đổi + Modal nhập số lượng (Min 1 • Max 50) trên bảng /exchange.
 *   6. /nhiemvu     [PATCH] — Xóa dòng tiêu đề "THÁP THÍ LUYỆN 500 TẦNG" khỏi nv_msg_tw & nv_msg_tw_noimg.
 *   7. AI Mention   [PATCH] — Cập nhật kiến thức Ver 1.8A (/upgrade, EXP Pet, Shop Modals).
 *
 * Usage:
 *   node scripts/deploy_v1_8a_botghost.mjs --dry-run
 *   node scripts/deploy_v1_8a_botghost.mjs [--only=upgrade,linhthu,shop,shop_dacbiet,exchange,nhiemvu,ai]
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
import { EXCHANGE_ITEMS } from '../src/data/catalog.js';

const PROFILE_GROUP_ID = '1782127263978';
const BACKEND_BASE = 'https://sumi-profile-backend.onrender.com';
const AI_MENTION_INT_ID = '4cc5db30-029c-4a55-86e6-6e6850012afd';
const AUTHOR_ONLY_MSG = 'Chỉ người gọi lệnh mới được thao tác trên bảng này! Hãy tự gọi lệnh của bạn nhé.';
const ACK_BTN_LABEL_V171 = 'Xác Nhận v1.7.1 (+800 LT)';

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

class V18AGraphBuilder extends GraphBuilder {
  advSelectMenu(id, parentMsgId, {
    placeholder,
    customVariableName,
    basic_options,
    row = '1',
    weight = '1',
    showReplies = 'hide',
    who_can_press = 'user',
    who_can_press_message = AUTHOR_ONLY_MSG,
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
          ...(who_can_press ? { who_can_press, who_can_press_message } : {}),
          validated: true,
          customVariableName,
        },
      },
    });
    this._addEdge({
      source: parentMsgId,
      sourceHandle: 'components_source',
      target: id,
      animated: false,
      arrowHeadType: 'arrowclosed',
      type: 'step',
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
        jsonSafeVariables: true,
        ...(isPost ? { bodyMode: 'raw', contentType: 'application/json' } : {}),
        failOnError: false,
      },
    },
  }, pos);
}

function embedMsg(gb, id, {
  title = '',
  description = '',
  color = '#ec4899',
  imageUrl = '',
  thumbnailUrl = '',
  footer = '',
  fields = [],
  ephemeral = false,
  target = { reply: true },
  action_id = '',
  editId = '',
} = {}, pos = { x: 0, y: 0 }) {
  const actData = {
    messageType: 'basic',
    useComponentsV2: false,
    ephemeral,
    ...(action_id ? { action_id } : {}),
    ...(editId ? { editId } : {}),
    target,
    message: {
      content: '',
      embeds: [{
        title: title || '',
        description: description || '',
        color,
        timestamp: false,
        author: { name: '', iconURL: '', url: '' },
        footer: footer ? { text: footer, iconURL: '' } : { text: '', iconURL: '' },
        image: { url: imageUrl || '' },
        thumbnail: { url: thumbnailUrl || '' },
        fields,
      }],
    },
  };
  return gb.act(id, 'advanced_message', actData, pos);
}

function modalActionNode(id, {
  modalId,
  title,
  label,
  variable = 'qty',
  placeholder = 'Min: 1 • Max: 50',
  defaultValue = '1',
  minLength = '1',
  maxLength = '3',
  x = 0,
  y = 0,
}) {
  return {
    id,
    type: 'action',
    draggable: true,
    position: { x, y },
    width: 396,
    height: 93,
    data: {
      node_options: { __ACT_OPT__: 'modal' },
      data: {
        type: 'modal',
        modal_id: modalId,
        modal_settings: {
          title: String(title).slice(0, 45),
          components: [{
            label: String(label).slice(0, 45),
            variable,
            maxLength: String(maxLength),
            minLength: String(minLength),
            placeholder: String(placeholder).slice(0, 100),
            required: true,
            inputStyle: 'SHORT',
            defaultValue: String(defaultValue),
            hidden: '',
          }],
        },
        ephemeral: false,
        validated: true,
        linked: true,
      },
    },
  };
}

function rawApiActionNode(id, name, method, url, rawBody = '', pos = { x: 0, y: 0 }) {
  const gb = new V18AGraphBuilder();
  apiAction(gb, id, name, method, url, rawBody, pos);
  return gb.nodes[0];
}

function rawEmbedMsgNode(id, opts, pos = { x: 0, y: 0 }) {
  const gb = new V18AGraphBuilder();
  embedMsg(gb, id, opts, pos);
  return gb.nodes[0];
}

function btnCfg(label, style, emojiKey, row = '1', weight = '1', showReplies = 'hide', whoCanPress = 'user') {
  const emoji_id = emojiKey ? uidId(emojiKey, 'su_sparkle') : '';
  return {
    label,
    style,
    emoji_id: emoji_id || undefined,
    row: String(row),
    weight: String(weight),
    orderComponent: true,
    showReplies,
    who_can_press: whoCanPress,
    ...(whoCanPress === 'user' ? { who_can_press_message: AUTHOR_ONLY_MSG } : {}),
  };
}

function attachUpdateAckBranch(gb, pfx, apiNodeId, resVar, { editId = null, x = 0, y = 420 } = {}) {
  const condId = `${pfx}_gate_cond`;
  const yesBr = `${pfx}_gate_yes`;
  const noBr = `${pfx}_gate_no`;
  gb.cond(condId, 'comparison', { base_value: `{${resVar}.response.needs_update_ack}`, target: { self: true } }, { x: x + 300, y });
  gb.link(apiNodeId, condId);
  gb.branch(condId, yesBr, 'comparison', { type: 'equal_to', comparison_value: 'true', ignoreCase: true }, { x: x + 640, y: y + 140 });
  gb.elseBranch(condId, noBr, 'comparison', { x, y: y + 140 });

  const gateMsgId = `${pfx}_gate_msg`;
  embedMsg(gb, gateMsgId, {
    title: `{${resVar}.response.update_title}`,
    description: `{${resVar}.response.update_description}`,
    color: '#f59e0b',
    target: editId ? { editId } : { reply: true },
    ...(editId ? { action_id: editId } : {}),
  }, { x: x + 640, y: y + 290 });
  gb.link(yesBr, gateMsgId);

  const ackBtnId = `${pfx}_ack_btn`;
  gb.advBtn(ackBtnId, gateMsgId, btnCfg(ACK_BTN_LABEL_V171, 'SUCCESS', 'su_sparkle', '1', '1', 'show'), { x: x + 640, y: y + 430 });

  const ackApiId = `${pfx}_ack_api`;
  const ackResVar = `${pfx}_ack_res`;
  apiAction(gb, ackApiId, ackResVar, 'POST', `${BACKEND_BASE}/api/update/ack`,
    '{"userId":"{user_id}","username":"{user_displayName}","avatarUrl":"{user_icon}"}', { x: x + 640, y: y + 570 });
  gb.link(ackBtnId, ackApiId);

  const ackReplyId = `${pfx}_ack_reply`;
  embedMsg(gb, ackReplyId, {
    title: `${uidEm('su_level_up')} ĐÃ XÁC NHẬN CẬP NHẬT`,
    description: `{${ackResVar}.response.message}`,
    color: '#10b981',
    target: { reply: true },
  }, { x: x + 640, y: y + 710 });
  gb.link(ackApiId, ackReplyId);

  return noBr;
}

// ============================================================================
// 1. /upgrade [NEW] — Nâng cấp Level (LT/Linh Quả/2 Đan EXP) & Đột Phá Sao
// ============================================================================
export function buildUpgradeCmd() {
  const gb = new V18AGraphBuilder();
  gb.rootSlash('upgrade', 'Nâng cấp Level (LT / Linh Quả / Đan Tinh Hoa) hoặc Đột Phá Sao cho Linh Thú', { ephemeral: false });
  gb.errorHandlerWait();

  gb.option('loai', 'string', 'Loại nâng cấp: level (Cấp) hoặc star (Sao)', {
    required: true,
    choices: ['level', 'star'],
    x: 420,
    y: -40,
  });
  gb.option('muc_tieu', 'int', 'Cấp hoặc Sao mục tiêu (tùy chọn, mặc định +1)', {
    required: false,
    x: 420,
    y: 70,
  });
  gb.option('linh_thu', 'string', 'Tên hoặc mã ID Linh Thú (tùy chọn, mặc định Pet xuất trận)', {
    required: false,
    x: 420,
    y: 180,
  });

  apiAction(
    gb,
    'up_prev_api',
    'up_prev_res',
    'POST',
    `${BACKEND_BASE}/api/pet/upgrade/preview`,
    '{"userId":"{user_id}","mode":"{option_loai}","targetGoal":"{option_muc_tieu}","petType":"{option_linh_thu}"}',
    { x: 0, y: 200 },
  );
  gb.link('root', 'up_prev_api');

  const afterGate = attachUpdateAckBranch(gb, 'up', 'up_prev_api', 'up_prev_res', { x: 0, y: 360 });

  gb.cond('up_mode_cond', 'comparison', { base_value: '{up_prev_res.response.ui_variant}', target: { self: true } }, { x: 0, y: 660 });
  gb.link(afterGate, 'up_mode_cond');

  gb.branch('up_mode_cond', 'up_br_lvl', 'comparison', { type: 'equal_to', comparison_value: 'level', ignoreCase: true }, { x: -340, y: 800 });
  gb.branch('up_mode_cond', 'up_br_star', 'comparison', { type: 'equal_to', comparison_value: 'star', ignoreCase: true }, { x: 140, y: 800 });
  gb.elseBranch('up_mode_cond', 'up_br_err', 'comparison', { x: 540, y: 800 });

  // Nhánh Level: 4 nút (LT / LQ / Thanh Tâm Đan / Tạo Hóa Đan)
  embedMsg(gb, 'up_msg_lvl', {
    title: '{up_prev_res.response.title}',
    description: '{up_prev_res.response.description}',
    color: '#38bdf8',
    target: { reply: true },
  }, { x: -340, y: 950 });
  gb.link('up_br_lvl', 'up_msg_lvl');

  const methods = [
    { id: 'lt', label: 'Dùng Linh Thạch', style: 'PRIMARY', emKey: 'su_linhthach', w: '1', xOff: -680 },
    { id: 'lq', label: 'Dùng Linh Quả', style: 'SUCCESS', emKey: 'farm_essence', w: '2', xOff: -340 },
    { id: 'p1', method: 'pill_ess_1', label: 'Thanh Tâm Đan', style: 'PRIMARY', emKey: 'pill_ess_1', w: '3', xOff: 0 },
    { id: 'p2', method: 'pill_ess_2', label: 'Tạo Hóa Đan', style: 'SECONDARY', emKey: 'pill_ess_2', w: '4', xOff: 340 },
  ];

  for (const m of methods) {
    const mName = m.method || m.id;
    const btnId = `btn_up_${m.id}`;
    const apiId = `api_up_${m.id}`;
    const msgId = `msg_up_${m.id}`;
    const resVar = `up_ex_${m.id}_res`;

    gb.advBtn(btnId, 'up_msg_lvl', btnCfg(m.label, m.style, m.emKey, '1', m.w, 'show', 'user'), { x: m.xOff, y: 1120 });
    apiAction(
      gb,
      apiId,
      resVar,
      'POST',
      `${BACKEND_BASE}/api/pet/upgrade/execute`,
      `{"userId":"{user_id}","mode":"level","method":"${mName}","targetGoal":"{up_prev_res.response.target_goal}","petType":"{up_prev_res.response.pet_type}"}`,
      { x: m.xOff, y: 1270 },
    );
    gb.link(btnId, apiId);
    embedMsg(gb, msgId, {
      title: `{${resVar}.response.title}`,
      description: `{${resVar}.response.description}`,
      color: '#10b981',
      target: { reply: true },
    }, { x: m.xOff, y: 1420 });
    gb.link(apiId, msgId);
  }

  // Nhánh Star: 1 nút Đột Phá Sao
  embedMsg(gb, 'up_msg_star', {
    title: '{up_prev_res.response.title}',
    description: '{up_prev_res.response.description}',
    color: '#f59e0b',
    target: { reply: true },
  }, { x: 700, y: 950 });
  gb.link('up_br_star', 'up_msg_star');

  gb.advBtn('btn_up_star', 'up_msg_star', btnCfg('Đột Phá Sao', 'SUCCESS', 'pet_star_stone', '1', '1', 'show', 'user'), { x: 700, y: 1120 });
  apiAction(
    gb,
    'api_up_star',
    'up_ex_star_res',
    'POST',
    `${BACKEND_BASE}/api/pet/upgrade/execute`,
    '{"userId":"{user_id}","mode":"star","targetGoal":"{up_prev_res.response.target_goal}","petType":"{up_prev_res.response.pet_type}"}',
    { x: 700, y: 1270 },
  );
  gb.link('btn_up_star', 'api_up_star');
  embedMsg(gb, 'msg_up_star_res', {
    title: '{up_ex_star_res.response.title}',
    description: '{up_ex_star_res.response.description}',
    color: '#10b981',
    target: { reply: true },
  }, { x: 700, y: 1420 });
  gb.link('api_up_star', 'msg_up_star_res');

  // Nhánh Error
  embedMsg(gb, 'up_msg_err', {
    title: '{up_prev_res.response.title}',
    description: '{up_prev_res.response.description}',
    color: '#ef4444',
    target: { reply: true },
  }, { x: 1060, y: 950 });
  gb.link('up_br_err', 'up_msg_err');

  return [...gb.nodes, ...gb.edges];
}

// ============================================================================
// 2. PATCH /linhthu — Xóa upgrade_level / upgrade_star & option muc_dich
// ============================================================================
function patchLinhThuTree(oldEls) {
  const dropPrefixes = ['pm_uplvl', 'pm_upstar', 'p_lvl_', 'pl_gate', 'p_star_', 'ps_gate', 'opt_muc_dich'];
  const dropIds = new Set();
  for (const el of oldEls) {
    if (el.id && dropPrefixes.some((p) => el.id === p || el.id.startsWith(p))) {
      dropIds.add(el.id);
    }
  }
  const kept = oldEls.filter((el) => {
    if (el.position) return !dropIds.has(el.id);
    return !dropIds.has(el.source) && !dropIds.has(el.target);
  });
  for (const el of kept) {
    if (el.id === 'root' && el.data) {
      el.data.description = 'Quản lý kho Linh Thú: xem, sắp xếp & chọn Pet xuất trận (Nâng Lv/Sao: dùng /upgrade)';
    }
    if (el.id === 'opt_hanh_dong' && el.data?.data) {
      el.data.data.choices = ['list', 'active'];
      el.data.data.description = 'Chọn thao tác: list (Xem Kho & Thanh EXP) hoặc active (Xuất trận)';
    }
  }
  return kept;
}

// ============================================================================
// 3. PATCH /shop — Chọn món ở Quầy Vật Phẩm Tiêu Hao -> Modal nhập số lượng
// ============================================================================
function patchShopTree(oldEls) {
  const dropIds = new Set(['set_sh_cons', 'set_sh2_sel_shop_cons']);
  const tree = oldEls.filter((el) => {
    if (el.position) return !dropIds.has(el.id);
    if (el.source === 'sel_shop_cons' || el.source === 'sel_shop_cons_2') return false;
    return !dropIds.has(el.source) && !dropIds.has(el.target);
  });

  const sel1 = tree.find((el) => el.id === 'sel_shop_cons');
  const sel2 = tree.find((el) => el.id === 'sel_shop_cons_2');
  if (sel1?.data?.data) {
    sel1.data.data.customVariableName = 'picked_cons_1';
    sel1.data.data.showReplies = 'show';
    sel1.data.data.who_can_press = 'user';
    sel1.data.data.who_can_press_message = AUTHOR_ONLY_MSG;
  }
  if (sel2?.data?.data) {
    sel2.data.data.customVariableName = 'picked_cons_2';
    sel2.data.data.showReplies = 'show';
    sel2.data.data.who_can_press = 'user';
    sel2.data.data.who_can_press_message = AUTHOR_ONLY_MSG;
  }

  const branches = [
    { selId: 'sel_shop_cons', varName: 'picked_cons_1', modalId: 'shop_cons_qty_1', pfx: 'shc1', x: (sel1?.position?.x || 0), y: (sel1?.position?.y || 900) + 150 },
    { selId: 'sel_shop_cons_2', varName: 'picked_cons_2', modalId: 'shop_cons_qty_2', pfx: 'shc2', x: (sel2?.position?.x || 600), y: (sel2?.position?.y || 900) + 150 },
  ];

  for (const b of branches) {
    if (!tree.some((e) => e.id === b.selId)) continue;
    const modNodeId = `${b.pfx}_modal`;
    const apiNodeId = `${b.pfx}_buy_api`;
    const msgNodeId = `${b.pfx}_buy_msg`;
    const resVar = `${b.pfx}_res`;

    tree.push(
      modalActionNode(modNodeId, {
        modalId: b.modalId,
        title: 'Mua Vật Phẩm Tiêu Hao',
        label: 'Số lượng cần mua (Min: 1 • Max: 50)',
        variable: 'qty',
        placeholder: 'Min: 1 • Max: 50 (riêng Thẻ/Đá theo giới hạn túi/ngày)',
        defaultValue: '1',
        maxLength: '2',
        x: b.x,
        y: b.y,
      }),
      rawApiActionNode(
        apiNodeId,
        resVar,
        'POST',
        `${BACKEND_BASE}/api/shop/buy`,
        `{"userId":"{user_id}","username":"{user_displayName}","avatarUrl":"{user_icon}","category":"consumables","itemId":"{${b.varName}}","quantity":"{${b.modalId}.qty}"}`,
        { x: b.x, y: b.y + 150 },
      ),
      rawEmbedMsgNode(
        msgNodeId,
        {
          title: `${uidEm('su_sparkle')} CỬA HÀNG VẬT PHẨM`,
          description: `{${resVar}.response.message}`,
          color: '#10b981',
          target: { reply: true },
        },
        { x: b.x, y: b.y + 310 },
      ),
      {
        source: b.selId,
        sourceHandle: 'action',
        target: modNodeId,
        targetHandle: 'action',
        animated: false,
        arrowHeadType: 'arrowclosed',
        type: 'custom',
        id: `reactflow__edge-${b.selId}action-${modNodeId}action`,
      },
      {
        source: modNodeId,
        sourceHandle: 'action',
        target: apiNodeId,
        targetHandle: 'action',
        animated: false,
        arrowHeadType: 'arrowclosed',
        type: 'custom',
        id: `reactflow__edge-${modNodeId}action-${apiNodeId}action`,
      },
      {
        source: apiNodeId,
        sourceHandle: 'action',
        target: msgNodeId,
        targetHandle: 'action',
        animated: false,
        arrowHeadType: 'arrowclosed',
        type: 'custom',
        id: `reactflow__edge-${apiNodeId}action-${msgNodeId}action`,
      },
    );
  }
  return tree;
}

// ============================================================================
// 4. PATCH /shop_dacbiet — Modal số lượng khi chọn món & nút [Nhập Số TT...]
// ============================================================================
function patchSpecialShopTree(oldEls) {
  const tree = oldEls.filter((el) => !(el.source === 'sel_ss_buy' && el.target === 'ss_buy_api'));

  const selBuy = tree.find((el) => el.id === 'sel_ss_buy');
  if (selBuy?.data?.data) {
    selBuy.data.data.customVariableName = 'picked_ss_item';
    selBuy.data.data.showReplies = 'show';
    selBuy.data.data.who_can_press = 'user';
    selBuy.data.data.who_can_press_message = AUTHOR_ONLY_MSG;
  }

  const buyApi = tree.find((el) => el.id === 'ss_buy_api');
  if (buyApi?.data?.data?.request_options) {
    buyApi.data.data.request_options.rawBody = '{"userId":"{user_id}","itemId":"{picked_ss_item}","qty":"{ss_buy_qty.qty}"}';
  }

  const bx = selBuy?.position?.x || 0;
  const by = selBuy?.position?.y || 600;
  tree.push(
    modalActionNode('ss_buy_modal', {
      modalId: 'ss_buy_qty',
      title: 'Mua Shop Đặc Biệt (TT)',
      label: 'Số lượng muốn mua',
      variable: 'qty',
      placeholder: 'Min: 1 • Max: theo hạn mức tuần (Viền Avatar = 1)',
      defaultValue: '1',
      maxLength: '2',
      x: bx,
      y: by + 130,
    }),
    {
      source: 'sel_ss_buy',
      sourceHandle: 'action',
      target: 'ss_buy_modal',
      targetHandle: 'action',
      animated: false,
      arrowHeadType: 'arrowclosed',
      type: 'custom',
      id: 'reactflow__edge-sel_ss_buyaction-ss_buy_modalaction',
    },
    {
      source: 'ss_buy_modal',
      sourceHandle: 'action',
      target: 'ss_buy_api',
      targetHandle: 'action',
      animated: false,
      arrowHeadType: 'arrowclosed',
      type: 'custom',
      id: 'reactflow__edge-ss_buy_modalaction-ss_buy_apiaction',
    },
  );

  // Nút thứ 4 trên Row 2: [Nhập Số TT...]
  const hubMsg = tree.find((el) => el.id === 'ss_hub_msg');
  if (hubMsg && !tree.some((el) => el.id === 'btn_ss_conv_custom')) {
    const hx = (hubMsg.position?.x || 0) + 520;
    const hy = (hubMsg.position?.y || 400) + 150;
    tree.push(
      {
        id: 'btn_ss_conv_custom',
        type: 'advMessageButton',
        draggable: true,
        position: { x: hx, y: hy },
        width: 240,
        height: 80,
        data: {
          node_options: {},
          data: btnCfg('Nhập Số TT...', 'SECONDARY', 'red_gold_crystal', '2', '6', 'show', 'user'),
        },
      },
      {
        source: 'ss_hub_msg',
        sourceHandle: 'components_source',
        target: 'btn_ss_conv_custom',
        animated: false,
        arrowHeadType: 'arrowclosed',
        type: 'step',
        id: 'reactflow__edge-ss_hub_msgcomponents_source-btn_ss_conv_custom',
      },
      modalActionNode('ss_conv_custom_modal', {
        modalId: 'ss_conv_qty',
        title: 'Quy Đổi LT -> Xích Kim Tinh Thạch',
        label: 'Số lượng TT muốn đổi (Min 5 • Max 200)',
        variable: 'tt_amount',
        placeholder: 'Min: 5 TT • Max: 200 TT/tuần (750 LT = 1 TT)',
        defaultValue: '5',
        maxLength: '3',
        x: hx,
        y: hy + 140,
      }),
      rawApiActionNode(
        'api_ss_conv_custom',
        'ss_conv_custom_res',
        'POST',
        `${BACKEND_BASE}/api/special-shop/convert`,
        '{"userId":"{user_id}","ttAmount":"{ss_conv_qty.tt_amount}"}',
        { x: hx, y: hy + 290 },
      ),
      rawEmbedMsgNode(
        'msg_ss_conv_custom',
        {
          title: `${uidEm('red_gold_crystal')} QUY ĐỔI XÍCH KIM TINH THẠCH`,
          description: '{ss_conv_custom_res.response.message}',
          color: '#f59e0b',
          target: { reply: true },
        },
        { x: hx, y: hy + 440 },
      ),
      {
        source: 'btn_ss_conv_custom',
        sourceHandle: 'action',
        target: 'ss_conv_custom_modal',
        targetHandle: 'action',
        animated: false,
        arrowHeadType: 'arrowclosed',
        type: 'custom',
        id: 'reactflow__edge-btn_ss_conv_customaction-ss_conv_custom_modalaction',
      },
      {
        source: 'ss_conv_custom_modal',
        sourceHandle: 'action',
        target: 'api_ss_conv_custom',
        targetHandle: 'action',
        animated: false,
        arrowHeadType: 'arrowclosed',
        type: 'custom',
        id: 'reactflow__edge-ss_conv_custom_modalaction-api_ss_conv_customaction',
      },
      {
        source: 'api_ss_conv_custom',
        sourceHandle: 'action',
        target: 'msg_ss_conv_custom',
        targetHandle: 'action',
        animated: false,
        arrowHeadType: 'arrowclosed',
        type: 'custom',
        id: 'reactflow__edge-api_ss_conv_customaction-msg_ss_conv_customaction',
      },
    );
  }
  return tree;
}

// ============================================================================
// 5. PATCH /exchange — Dropdown chọn gói + Modal nhập số lượng (Min 1 • Max 50)
// ============================================================================
function patchExchangeTree(oldEls) {
  const tree = JSON.parse(JSON.stringify(oldEls));
  const listMsg = tree.find((el) => el.id === 'ex_l_edit');
  if (!listMsg || tree.some((el) => el.id === 'sel_ex_pack')) return tree;

  const opts = EXCHANGE_ITEMS.map((x) => ({
    label: `${x.name} (${x.cost_essence} LQ)`,
    description: x.exchange_id === 'farm_slot_unlock' ? 'Min: 1 • Max: 4 ô canh tác' : 'Min: 1 • Max: 50/lần',
    emoji_id: uidId('farm_essence', 'su_sprout'),
    value: x.exchange_id,
  }));

  const gx = (listMsg.position?.x || 0) + 360;
  const gy = (listMsg.position?.y || 400);

  const gbTmp = new V18AGraphBuilder();
  gbTmp.nodes.push({ id: 'ex_l_edit' });
  gbTmp._nodeIds.add('ex_l_edit');
  gbTmp.advSelectMenu('sel_ex_pack', 'ex_l_edit', {
    placeholder: 'Chọn vật phẩm đổi bằng Linh Quả (nhập số lượng)...',
    customVariableName: 'picked_ex_item',
    basic_options: opts,
    row: '1',
    weight: '1',
    showReplies: 'show',
    who_can_press: 'user',
  }, { x: gx, y: gy });

  const selNode = gbTmp.nodes.find((n) => n.id === 'sel_ex_pack');
  const selEdge = gbTmp.edges.find((e) => e.target === 'sel_ex_pack');

  tree.push(
    selNode,
    selEdge,
    modalActionNode('ex_buy_modal', {
      modalId: 'ex_buy_qty',
      title: 'Quy Đổi Linh Quả Tiên Giới',
      label: 'Số lượng muốn đổi (Min: 1 • Max: 50)',
      variable: 'qty',
      placeholder: 'Min: 1 • Max: 50 (Mở Ô Canh Tác tối đa 4)',
      defaultValue: '1',
      maxLength: '2',
      x: gx,
      y: gy + 150,
    }),
    rawApiActionNode(
      'ex_sel_buy_api',
      'ex_sel_res',
      'POST',
      `${BACKEND_BASE}/api/exchange/buy`,
      '{"userId":"{user_id}","exchangeId":"{picked_ex_item}","quantity":"{ex_buy_qty.qty}","username":"{user_displayName}"}',
      { x: gx, y: gy + 300 },
    ),
    rawEmbedMsgNode(
      'ex_sel_buy_msg',
      {
        title: `${uidEm('farm_essence', 'su_sprout')} QUY ĐỔI LINH QUẢ`,
        description: '{ex_sel_res.response.message}',
        color: '#10b981',
        target: { reply: true },
      },
      { x: gx, y: gy + 450 },
    ),
    {
      source: 'sel_ex_pack',
      sourceHandle: 'action',
      target: 'ex_buy_modal',
      targetHandle: 'action',
      animated: false,
      arrowHeadType: 'arrowclosed',
      type: 'custom',
      id: 'reactflow__edge-sel_ex_packaction-ex_buy_modalaction',
    },
    {
      source: 'ex_buy_modal',
      sourceHandle: 'action',
      target: 'ex_sel_buy_api',
      targetHandle: 'action',
      animated: false,
      arrowHeadType: 'arrowclosed',
      type: 'custom',
      id: 'reactflow__edge-ex_buy_modalaction-ex_sel_buy_apiaction',
    },
    {
      source: 'ex_sel_buy_api',
      sourceHandle: 'action',
      target: 'ex_sel_buy_msg',
      targetHandle: 'action',
      animated: false,
      arrowHeadType: 'arrowclosed',
      type: 'custom',
      id: 'reactflow__edge-ex_sel_buy_apiaction-ex_sel_buy_msgaction',
    },
  );
  return tree;
}

// ============================================================================
// 6. PATCH /nhiemvu — Xóa "THÁP THÍ LUYỆN 500 TẦNG" khỏi nv_msg_tw & nv_msg_tw_noimg
// ============================================================================
function patchNhiemVuTree(oldEls) {
  const tree = JSON.parse(JSON.stringify(oldEls));
  for (const id of ['nv_msg_tw', 'nv_msg_tw_noimg']) {
    const node = tree.find((el) => el.id === id);
    if (node?.data?.data?.message?.embeds?.[0]) {
      node.data.data.message.embeds[0].title = '';
    }
  }
  return tree;
}

// ============================================================================
// 7. PATCH AI Mention — Cập nhật kiến thức Ver 1.8A
// ============================================================================
function updateAiPromptV18A(oldPrompt) {
  let text = String(oldPrompt || '');
  text = text.replace(/v1\.7\.1/g, 'v1.8A');
  if (!text.includes('/upgrade')) {
    text = text.replace(
      '/linhthu, /equip',
      '/linhthu, /upgrade (LT / Linh Quả 8 EXP / Đan Thanh Tâm 1.200 EXP / Đan Tạo Hóa 3.000 EXP — không buff Role EXP) & Đột Phá Sao, /equip',
    );
  }
  if (!text.includes('Modal nhập số lượng')) {
    text = text.replace(
      '/updates v1.8A tặng +800 LT.',
      '/shop, /shop_dacbiet, /exchange hỗ trợ Modal nhập số lượng trực tiếp (tới 50×/lần). /updates v1.8A.',
    );
  }
  return text;
}

function validateTreeStrict(els, label) {
  for (const el of els) {
    if (el.type === 'advMessageSelectMenu') {
      const opts = el.data?.data?.basic_options || [];
      if (opts.length === 0 || opts.length > 25) {
        throw new Error(`Select menu "${el.id}" in ${label} has ${opts.length} options`);
      }
    }
    if (el.type === 'conditionChild') {
      const d = el.data?.data || {};
      if (d.type === 'matches_pattern') {
        const p = d.comparison_value ?? d.value;
        if (typeof p === 'string') validateRegexSafety(p, `${label}.${el.id}`);
      }
    }
  }
  const v = validateGraph(els);
  if (Array.isArray(v) && v.length > 0) {
    throw new Error(`validateGraph failed for ${label}: ${v.join('; ')}`);
  }
  if (v && !Array.isArray(v) && (v.ok === false || v.valid === false || (Array.isArray(v.errors) && v.errors.length > 0))) {
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
      cmds: Object.values(rawCmds).filter(c => c && c.name && c.compressed_tree)
        .map(c => ({ name: c.name, enabled: c.enabled !== false, groupId: c.groupId || '', compressed_tree: c.compressed_tree })),
      events: Object.values(rawEvents).filter(e => e && e.name && e.compressed_tree)
        .map(e => ({ id: e.id || e.int_id, int_id: e.int_id || e.id, name: e.name, enabled: e.enabled !== false, groupId: e.groupId || '', compressed_tree: e.compressed_tree })),
    });
  })()`, 30000);
  return JSON.parse(raw);
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const onlyArg = args.find((a) => a.startsWith('--only='));
  const onlySet = onlyArg ? new Set(onlyArg.slice(7).split(',').map((s) => s.trim().toLowerCase())) : null;
  const shouldRun = (k) => !onlySet || onlySet.has(k);

  console.log(`\n============================================================`);
  console.log(`SuMi Family Ver 1.8A BotGhost Deployer (${dryRun ? 'DRY RUN' : 'LIVE CDP'})`);
  console.log(`============================================================\n`);

  const specs = [];
  if (shouldRun('upgrade')) {
    const els = buildUpgradeCmd();
    validateTreeStrict(els, 'upgrade');
    specs.push({ name: 'upgrade', kind: 'slash', groupId: PROFILE_GROUP_ID, elements: els });
  }

  if (dryRun) {
    for (const sp of specs) {
      const json = JSON.stringify(sp.elements);
      const comp = LZString.compressToBase64(json);
      console.log(`[DRY-RUN OK] /${sp.name}: ${sp.elements.length} els, ${(json.length / 1024).toFixed(1)} KB -> ${(comp.length / 1024).toFixed(1)} KB LZ`);
    }
    console.log('\n[DRY-RUN] Ver 1.8A /upgrade graph validated cleanly!');
    return;
  }

  const liveState = await fetchAllLiveReduxState();
  const cmdMap = new Map(liveState.cmds.map((c) => [c.name, c]));

  const patchers = [
    ['linhthu', patchLinhThuTree],
    ['shop', patchShopTree],
    ['shop_dacbiet', patchSpecialShopTree],
    ['exchange', patchExchangeTree],
    ['nhiemvu', patchNhiemVuTree],
  ];

  for (const [cmdName, patchFn] of patchers) {
    if (!shouldRun(cmdName) || !cmdMap.has(cmdName)) continue;
    const oldTree = JSON.parse(LZString.decompressFromBase64(cmdMap.get(cmdName).compressed_tree));
    const newTree = patchFn(oldTree);
    validateTreeStrict(newTree, cmdName);
    specs.push({
      name: cmdName,
      kind: 'slash',
      groupId: cmdMap.get(cmdName).groupId || PROFILE_GROUP_ID,
      enabled: cmdMap.get(cmdName).enabled,
      elements: newTree,
    });
  }

  if (shouldRun('ai')) {
    const aiEv = liveState.events.find((e) => e.id === AI_MENTION_INT_ID || e.int_id === AI_MENTION_INT_ID);
    if (aiEv) {
      const tree = JSON.parse(LZString.decompressFromBase64(aiEv.compressed_tree));
      let patchedCount = 0;
      for (const el of tree) {
        if (el.type === 'action' && el.data?.data?.type === 'api_action' && typeof el.data?.data?.request_options?.rawBody === 'string') {
          const bodyObj = JSON.parse(el.data.data.request_options.rawBody);
          if (bodyObj?.systemInstruction?.parts?.[0]?.text) {
            bodyObj.systemInstruction.parts[0].text = updateAiPromptV18A(bodyObj.systemInstruction.parts[0].text);
            el.data.data.request_options.rawBody = JSON.stringify(bodyObj);
            patchedCount += 1;
          }
        }
      }
      if (patchedCount > 0) {
        validateTreeStrict(tree, aiEv.name);
        specs.push({ name: aiEv.name, kind: 'event', groupId: aiEv.groupId || PROFILE_GROUP_ID, enabled: aiEv.enabled, elements: tree });
      }
    }
  }

  console.log(`Deploying ${specs.length} BotGhost updates via Edge CDP...`);
  for (let i = 0; i < specs.length; i++) {
    const sp = specs[i];
    console.log(`[${i + 1}/${specs.length}] Deploying ${sp.kind} "${sp.name}" (${sp.elements.length} els)...`);
    const res = await deployViaCDP({
      groupId: sp.groupId || PROFILE_GROUP_ID,
      mode: sp.kind,
      name: sp.name,
      elements: sp.elements,
      enabled: sp.enabled ?? true,
    });
    if (!res?.ok) {
      throw new Error(`Deploy failed for ${sp.kind}:${sp.name} -> ${JSON.stringify(res)}`);
    }
    console.log(`  [OK] ${sp.kind}:${sp.name} | prob=${res.probText} | canSave=${res.canSave} | builderSaveRequired=${res.builderSaveRequired} | nodes=${res.savedSummary?.decompressedCount}`);
    if (i + 1 < specs.length) await new Promise((r) => setTimeout(r, 800));
  }
  console.log('\n[DONE] Ver 1.8A BotGhost deployed & verified!');
}

const isCli = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop());
if (isCli) {
  main().catch((err) => {
    console.error('[DEPLOY FAILED]', err);
    process.exit(1);
  });
}
