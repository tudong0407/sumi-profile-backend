/**
 * scripts/deploy_v1_8b_botghost.mjs
 * Đồng bộ SuMi Family Ver 1.8B lên BotGhost Dashboard qua Edge CDP (9222):
 *   1. /pet_role [CLONE]  — Bảo tồn toàn bộ lệnh /pet cấp role cũ (38 els) sang tên /pet_role.
 *   2. /pet      [NEW]    — Hệ thống Thiện Cảm & Tâm Tình Linh Thú:
 *                           • 6 nút tương tác trực tiếp (Xoa Đầu, Ôm Ấp, Cho Ăn, Chải Lông, Chơi Đùa, Ngủ Cùng)
 *                           • Nút Trò Chuyện -> Modal -> AI Chat (dùng cùng Gemini config với AI Mention) / Kho Thoại
 *                           • Nút Tặng Quà -> Dropdown 6 món -> Modal Số lượng -> /api/pet/gift
 *   3. AI Mention [PATCH] — Cập nhật tri thức Ver 1.8B (/pet Thiện Cảm, Tự Thu Hoạch Farm, 41 Viền Chân Thần, /pet_role).
 *
 * Usage:
 *   node scripts/deploy_v1_8b_botghost.mjs --dry-run
 *   node scripts/deploy_v1_8b_botghost.mjs [--only=pet_role,pet,ai]
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
import { PET_BOND_GIFT_CATALOG } from '../src/data/v18PetBondCatalog.js';

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

class V18BGraphBuilder extends GraphBuilder {
  advSelectMenu(id, parentMsgId, {
    placeholder,
    customVariableName,
    basic_options,
    row = '1',
    weight = '1',
    showReplies = 'show',
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

  modal(id, {
    modalId,
    title,
    label,
    variable,
    placeholder = '',
    defaultValue = '',
    minLength = '1',
    maxLength = '100',
    required = true,
    inputStyle = 'SHORT',
    x = 0,
    y = 0,
  }) {
    return this._addNode({
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
              required,
              inputStyle,
              defaultValue: String(defaultValue),
              hidden: '',
            }],
          },
          ephemeral: false,
          validated: true,
          linked: true,
        },
      },
    });
  }
}

function apiAction(gb, id, name, method, url, rawBody = '', pos = { x: 0, y: 0 }, extraOpts = null) {
  const isPost = method === 'POST';
  return gb.act(id, 'api_action', {
    name,
    ephemeral: false,
    request_options: extraOpts || {
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
  return gb.act(id, 'advanced_message', {
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
  }, pos);
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

function attachUpdateAckBranch(gb, pfx, apiNodeId, resVar, { x = 0, y = 420 } = {}) {
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
    target: { reply: true },
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
// 1. /pet [NEW] — Hub Tương Tác & Trò Chuyện Tâm Tình Linh Thú (Ver 1.8B)
// ============================================================================
export function buildPetBondCmd(geminiApiCfg = null) {
  const gb = new V18BGraphBuilder();
  gb.rootSlash('pet', 'Chăm sóc, tặng quà, trò chuyện AI & nâng Thiện Cảm Linh Thú', { ephemeral: false });
  gb.errorHandlerWait();

  apiAction(
    gb,
    'pet_hub_api',
    'pet_hub_res',
    'POST',
    `${BACKEND_BASE}/api/pet/hub`,
    '{"userId":"{user_id}","username":"{user_displayName}","avatarUrl":"{user_icon}"}',
    { x: 0, y: 240 },
  );
  gb.link('root', 'pet_hub_api');

  const noAckBr = attachUpdateAckBranch(gb, 'pb', 'pet_hub_api', 'pet_hub_res', { x: 0, y: 400 });

  embedMsg(gb, 'pet_msg_hub', {
    action_id: 'pet_msg_hub',
    title: '{pet_hub_res.response.title}',
    description: '{pet_hub_res.response.description}',
    color: '#ec4899',
    target: { reply: true },
  }, { x: 0, y: 740 });
  gb.link(noAckBr, 'pet_msg_hub');

  // Row 1: 5 nút tương tác trực tiếp (Xoa Đầu, Ôm Ấp, Cho Ăn, Chải Lông, Chơi Đùa)
  const row1Acts = [
    { key: 'pat', label: 'Xoa Đầu', style: 'PRIMARY', emoji: 'pet_act_pat', w: '1', x: -720 },
    { key: 'hug', label: 'Ôm Ấp', style: 'SUCCESS', emoji: 'pet_act_hug', w: '2', x: -360 },
    { key: 'snack', label: 'Cho Ăn', style: 'PRIMARY', emoji: 'pet_act_snack', w: '3', x: 0 },
    { key: 'brush', label: 'Chải Lông', style: 'SECONDARY', emoji: 'pet_act_brush', w: '4', x: 360 },
    { key: 'play', label: 'Chơi Đùa', style: 'SUCCESS', emoji: 'pet_act_play', w: '5', x: 720 },
  ];

  // Row 2: Ngủ Cùng + Trò Chuyện + Tặng Quà
  const directActs = [
    ...row1Acts.map((a) => ({ ...a, row: '1', y: 940 })),
    { key: 'sleep', label: 'Ngủ Cùng', style: 'SECONDARY', emoji: 'pet_act_sleep', row: '2', w: '1', x: -360, y: 1460 },
  ];

  for (const act of directActs) {
    const btnId = `btn_pet_${act.key}`;
    const apiId = `api_pet_${act.key}`;
    const msgId = `msg_pet_${act.key}`;
    const resVar = `pet_${act.key}_res`;

    gb.advBtn(btnId, 'pet_msg_hub', btnCfg(act.label, act.style, act.emoji, act.row, act.w, 'hide', 'user'), { x: act.x, y: act.y });
    apiAction(
      gb,
      apiId,
      resVar,
      'POST',
      `${BACKEND_BASE}/api/pet/interact`,
      `{"userId":"{user_id}","action":"${act.key}","username":"{user_displayName}","avatarUrl":"{user_icon}"}`,
      { x: act.x, y: act.y + 150 },
    );
    gb.link(btnId, apiId);
    embedMsg(gb, msgId, {
      title: `{${resVar}.response.title}`,
      description: `{${resVar}.response.description}`,
      color: '#ec4899',
      target: { editId: 'pet_msg_hub' },
    }, { x: act.x, y: act.y + 300 });
    gb.link(apiId, msgId);
  }

  // Row 2 Button 2: Trò Chuyện -> Modal -> prepare -> [AI Gemini -> save] / [Sample]
  gb.advBtn('btn_pet_chat', 'pet_msg_hub', btnCfg('Trò Chuyện', 'PRIMARY', 'pet_act_chat', '2', '2', 'show', 'user'), { x: 240, y: 1460 });
  gb.modal('pet_chat_modal', {
    modalId: 'pet_chat_input',
    title: 'Trò Chuyện Cùng Linh Thú',
    label: 'Lời nhắn gửi đến Linh Thú',
    variable: 'msg',
    placeholder: 'VD: Hôm nay bạn cảm thấy thế nào?',
    defaultValue: '',
    minLength: '1',
    maxLength: '300',
    required: true,
    inputStyle: 'SHORT',
    x: 240,
    y: 1620,
  });
  gb.link('btn_pet_chat', 'pet_chat_modal');

  apiAction(
    gb,
    'pet_chat_prep_api',
    'pet_chat_prep',
    'POST',
    `${BACKEND_BASE}/api/pet/chat/prepare`,
    '{"userId":"{user_id}","message":"{pet_chat_input.msg}","username":"{user_displayName}","avatarUrl":"{user_icon}"}',
    { x: 240, y: 1770 },
  );
  gb.link('pet_chat_modal', 'pet_chat_prep_api');

  gb.cond('pet_chat_ai_cond', 'comparison', { base_value: '{pet_chat_prep.response.mode}', target: { self: true } }, { x: 240, y: 1930 });
  gb.link('pet_chat_prep_api', 'pet_chat_ai_cond');
  gb.branch('pet_chat_ai_cond', 'pet_chat_ai_yes', 'comparison', { type: 'equal_to', comparison_value: 'ai', ignoreCase: true }, { x: 620, y: 2070 });
  gb.elseBranch('pet_chat_ai_cond', 'pet_chat_ai_no', 'comparison', { x: -120, y: 2070 });

  // Sample fallback branch (Phàm/Linh/Tiên hoặc hết quota AI)
  embedMsg(gb, 'msg_pet_chat_sample', {
    title: '{pet_chat_prep.response.title}',
    description: '{pet_chat_prep.response.description}',
    color: '#ec4899',
    target: { reply: true },
  }, { x: -120, y: 2220 });
  gb.link('pet_chat_ai_no', 'msg_pet_chat_sample');

  // AI branch: dùng URL & API Key trực tiếp từ Gemini config của AI Mention
  const gemUrl = geminiApiCfg?.url || 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent';
  const gemHeaders = geminiApiCfg?.headers || [{ key: 'Content-Type', value: 'application/json' }];
  const gemBody = JSON.stringify({
    systemInstruction: { parts: [{ text: '{pet_chat_prep.response.gemini_system_prompt}' }] },
    contents: [{
      role: 'user',
      parts: [{
        text: 'Lịch sử trò chuyện gần đây:\n{pet_chat_prep.response.gemini_history_text}\n\nLời nhắn mới từ chủ nhân:\n{pet_chat_prep.response.user_message}',
      }],
    }],
    generationConfig: { temperature: 0.85, maxOutputTokens: 220 },
  });

  apiAction(gb, 'pet_chat_gemini_api', 'pet_ai_res', 'POST', gemUrl, gemBody, { x: 620, y: 2220 }, {
    method: 'POST',
    url: gemUrl,
    headers: gemHeaders,
    params: [],
    body: [],
    rawBody: gemBody,
    contentType: 'application/json',
    options: {
      excludeEmptyFields: true,
      replaceParams: true,
      replaceURL: true,
      replaceHeaders: true,
      replaceBody: true,
      jsonSafeVariables: true,
      bodyMode: 'raw',
      contentType: 'application/json',
      failOnError: false,
    },
  });
  gb.link('pet_chat_ai_yes', 'pet_chat_gemini_api');

  apiAction(
    gb,
    'pet_chat_save_api',
    'pet_chat_save',
    'POST',
    `${BACKEND_BASE}/api/pet/chat/save`,
    '{"userId":"{user_id}","userMessage":"{pet_chat_prep.response.user_message}","petReply":"{pet_ai_res.response.candidates.0.content.parts.0.text}","usedAi":true,"petId":"{pet_chat_prep.response.pet_id}","username":"{user_displayName}","avatarUrl":"{user_icon}"}',
    { x: 620, y: 2370 },
  );
  gb.link('pet_chat_gemini_api', 'pet_chat_save_api');

  embedMsg(gb, 'msg_pet_chat_ai', {
    title: '{pet_chat_save.response.title}',
    description: '{pet_chat_save.response.description}',
    color: '#ec4899',
    target: { reply: true },
  }, { x: 620, y: 2520 });
  gb.link('pet_chat_save_api', 'msg_pet_chat_ai');

  // Row 2 Button 3: Tặng Quà -> Chọn Quà (SelectMenu) -> Modal Số Lượng -> /api/pet/gift
  gb.advBtn('btn_pet_gift', 'pet_msg_hub', btnCfg('Tặng Quà', 'SUCCESS', 'pet_act_gift', '2', '3', 'show', 'user'), { x: 1080, y: 1460 });
  const giftLines = Object.values(PET_BOND_GIFT_CATALOG)
    .map((g) => `• ${uidEm(g.emoji_key, 'bond_gift_box')} **${g.name}:** ${g.desc}`)
    .join('\n');
  embedMsg(gb, 'msg_pet_gift_pick', {
    title: `${uidEm('pet_act_gift', 'bond_gift_box')} TẶNG QUÀ LINH THÚ`,
    description: `Chọn 1 vật phẩm ở menu bên dưới rồi nhập số lượng muốn tặng:\n\n${giftLines}`,
    color: '#f59e0b',
    target: { reply: true },
  }, { x: 1080, y: 1620 });
  gb.link('btn_pet_gift', 'msg_pet_gift_pick');

  const giftOptions = Object.values(PET_BOND_GIFT_CATALOG).map((g) => ({
    label: g.name,
    description: g.desc,
    emoji_id: uidId(g.emoji_key, 'bond_gift_box'),
    value: g.item_id,
  }));
  gb.advSelectMenu('sel_pet_gift', 'msg_pet_gift_pick', {
    placeholder: 'Chọn quà tặng cho Linh Thú...',
    customVariableName: 'picked_pet_gift',
    basic_options: giftOptions,
    row: '1',
    weight: '1',
    showReplies: 'show',
  }, { x: 1080, y: 1770 });

  gb.modal('pet_gift_qty_modal', {
    modalId: 'pet_gift_qty',
    title: 'Nhập Số Lượng Quà Tặng',
    label: 'Số lượng muốn tặng (Min: 1)',
    variable: 'qty',
    placeholder: 'Nhập số lượng (VD: 1, 5, 10...)',
    defaultValue: '1',
    minLength: '1',
    maxLength: '4',
    required: true,
    inputStyle: 'SHORT',
    x: 1080,
    y: 1930,
  });
  gb.link('sel_pet_gift', 'pet_gift_qty_modal');

  apiAction(
    gb,
    'pet_gift_api',
    'pet_gift_res',
    'POST',
    `${BACKEND_BASE}/api/pet/gift`,
    '{"userId":"{user_id}","itemId":"{picked_pet_gift}","quantity":"{pet_gift_qty.qty}","username":"{user_displayName}","avatarUrl":"{user_icon}"}',
    { x: 1080, y: 2090 },
  );
  gb.link('pet_gift_qty_modal', 'pet_gift_api');

  gb.cond('pet_gift_ok_cond', 'comparison', { base_value: '{pet_gift_res.response.success}', target: { self: true } }, { x: 1080, y: 2240 });
  gb.link('pet_gift_api', 'pet_gift_ok_cond');
  gb.branch('pet_gift_ok_cond', 'pet_gift_ok_yes', 'comparison', { type: 'equal_to', comparison_value: 'true', ignoreCase: true }, { x: 900, y: 2380 });
  gb.elseBranch('pet_gift_ok_cond', 'pet_gift_ok_no', 'comparison', { x: 1260, y: 2380 });

  embedMsg(gb, 'msg_pet_gift_ok', {
    title: '{pet_gift_res.response.title}',
    description: '{pet_gift_res.response.description}',
    color: '#10b981',
    target: { reply: true },
  }, { x: 900, y: 2530 });
  gb.link('pet_gift_ok_yes', 'msg_pet_gift_ok');

  embedMsg(gb, 'msg_pet_gift_err', {
    title: `${uidEm('su_warn', 'ui_warn')} KHÔNG THỂ TẶNG QUÀ`,
    description: '{pet_gift_res.response.message}',
    color: '#ef4444',
    target: { reply: true },
  }, { x: 1260, y: 2530 });
  gb.link('pet_gift_ok_no', 'msg_pet_gift_err');

  return [...gb.nodes, ...gb.edges];
}

function updateAiPromptV18B(oldPrompt) {
  let text = String(oldPrompt || '');
  text = text.replace(/v1\.8A/g, 'v1.8B');
  if (!text.includes('Thiện Cảm Linh Thú')) {
    text = text.replace(
      '/shop, /shop_dacbiet, /exchange hỗ trợ Modal nhập số lượng trực tiếp (tới 50×/lần).',
      '/shop, /shop_dacbiet, /exchange hỗ trợ Modal nhập số lượng trực tiếp (tới 50×/lần). Mới Ver 1.8B: /pet là hub Thiện Cảm & Tâm Tình AI với Linh Thú (lệnh chọn role Pet đổi tên thành /pet_role) gồm 5 thang bậc (3/5/7/8/10), tối đa +40% Lực Pet, +30% EXP /upgrade, +15% Sống /explorer, +50% EXP Tu Sĩ, +15% LT toàn nguồn (trừ minigames/tách/đổi), Tự Thu Hoạch Farm (Bậc 5-10), Quà Đồng Hành (Bậc 4+), và 41 Khung Avatar Chân Thần độc quyền (+50% LT Điểm danh/Nghề & +50% EXP Chat/Voice).',
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

async function fetchLiveState() {
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
  console.log(`SuMi Family Ver 1.8B BotGhost Deployer (${dryRun ? 'DRY RUN' : 'LIVE CDP'})`);
  console.log(`============================================================\n`);

  if (dryRun) {
    const els = buildPetBondCmd(null);
    validateTreeStrict(els, 'pet');
    const json = JSON.stringify(els);
    const comp = LZString.compressToBase64(json);
    console.log(`[DRY-RUN OK] /pet: ${els.length} els, ${(json.length / 1024).toFixed(1)} KB -> ${(comp.length / 1024).toFixed(1)} KB LZ`);
    return;
  }

  const liveState = await fetchLiveState();
  const cmdMap = new Map(liveState.cmds.map((c) => [c.name, c]));
  const aiEv = liveState.events.find((e) => e.id === AI_MENTION_INT_ID || e.int_id === AI_MENTION_INT_ID);
  if (!aiEv) throw new Error('AI Mention event not found in live BotGhost state!');

  const aiTree = JSON.parse(LZString.decompressFromBase64(aiEv.compressed_tree));
  const gemNode = aiTree.find((el) => el.id === 'act_other_api_gemini' || (el.data?.data?.type === 'api_action' && String(el.data?.data?.request_options?.url || '').includes('generativelanguage.googleapis.com')));
  const gemCfg = gemNode?.data?.data?.request_options
    ? { url: gemNode.data.data.request_options.url, headers: gemNode.data.data.request_options.headers }
    : null;
  if (!gemCfg) throw new Error('Could not read Gemini API config from live AI Mention event!');

  const specs = [];

  // 1. /pet_role [CLONE of old /pet] (CHỈ clone nếu /pet cũ chưa phải là Pet Bond Hub)
  if (shouldRun('pet_role')) {
    const oldPet = cmdMap.get('pet');
    const oldPetRole = cmdMap.get('pet_role');
    if (oldPet && !oldPetRole) {
      const oldTree = JSON.parse(LZString.decompressFromBase64(oldPet.compressed_tree));
      const rootNode = oldTree.find((e) => e.id === 'root');
      if (rootNode?.data && !oldTree.some((e) => e.id === 'pet_hub_api')) {
        rootNode.data.title = 'pet_role';
        validateTreeStrict(oldTree, 'pet_role');
        specs.push({ name: 'pet_role', kind: 'slash', groupId: oldPet.groupId || PROFILE_GROUP_ID, enabled: oldPet.enabled, elements: oldTree });
      }
    } else if (oldPetRole) {
      console.log('  [SKIP] /pet_role already exists cleanly.');
    }
  }

  // 2. /pet [Ver 1.8B Bond Hub]
  if (shouldRun('pet')) {
    const els = buildPetBondCmd(gemCfg);
    validateTreeStrict(els, 'pet');
    specs.push({ name: 'pet', kind: 'slash', groupId: PROFILE_GROUP_ID, enabled: true, elements: els });
  }

  // 3. AI Mention [PATCH Ver 1.8B]
  if (shouldRun('ai')) {
    let patchedCount = 0;
    for (const el of aiTree) {
      if (el.type === 'action' && el.data?.data?.type === 'api_action' && typeof el.data?.data?.request_options?.rawBody === 'string') {
        const raw = el.data.data.request_options.rawBody;
        if (!/KIẾN THỨC CHÍNH THỨC/.test(raw)) continue;
        const bodyObj = JSON.parse(raw);
        if (bodyObj?.systemInstruction?.parts?.[0]?.text) {
          bodyObj.systemInstruction.parts[0].text = updateAiPromptV18B(bodyObj.systemInstruction.parts[0].text);
          el.data.data.request_options.rawBody = JSON.stringify(bodyObj);
          patchedCount += 1;
        }
      }
    }
    if (patchedCount > 0) {
      validateTreeStrict(aiTree, aiEv.name);
      specs.push({ name: aiEv.name, kind: 'event', groupId: aiEv.groupId || PROFILE_GROUP_ID, enabled: aiEv.enabled, elements: aiTree });
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
  console.log('\n[DONE] Ver 1.8B BotGhost deployed & verified!');
}

const isCli = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop());
if (isCli) {
  main().catch((err) => {
    console.error('[DEPLOY FAILED]', err);
    process.exit(1);
  });
}
