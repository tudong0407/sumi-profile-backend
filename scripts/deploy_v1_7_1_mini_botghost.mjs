/**
 * scripts/deploy_v1_7_1_mini_botghost.mjs
 * Đồng bộ toàn bộ SuMi Family Ver 1.7.1 Mini lên BotGhost Dashboard qua Edge CDP (9222):
 * 1. /updates        — Bản v1.7.1 (+800 LT) lên đầu danh sách & chọn lịch sử v1.7.1..v1.1.
 * 2. /linhmach       — Nâng cấp lên 4 nút [Chiếm Mỏ #1..#4], Mỏ SS..SSS+, Mệt Mỏi 90%, cướp mỏ hồi -15%.
 * 3. /thuongtra      — MỚI: Trà Đạo Quán (pha 3 ấm/ngày 200-300 LT + unroll 2 lượt [Ké Chén] who_can_press='everyone').
 * 4. /thaplinhhuong  — MỚI: Thắp Linh Hương (600-800 LT theo Luck -> +5..+15% Luck đến 24:00 UTC+7).
 * 5. /explorer       — Vá triệt để Row 2 [Bộ 1] [Bộ 2] [Bộ 3] trên cả idle & injured, đồng bộ Bộ & thanh tiến độ.
 * 6. /tienhoa        — Cập nhật mô tả yêu cầu 2 Hồng Mông Tiến Hóa Tinh.
 * 7. AI Mention      — Cập nhật kiến thức Ver 1.7.1 cho Nhiễm Nhiễm.
 * 8. Global Sweep    — Đổi nhãn nút Cổng Xác Nhận Cập Nhật sang Xác Nhận v1.7.1 (+800 LT).
 *
 * Usage:
 *   node scripts/deploy_v1_7_1_mini_botghost.mjs --dry-run
 *   node scripts/deploy_v1_7_1_mini_botghost.mjs [--only=updates,linhmach,thuongtra,thaplinhhuong,explorer,tienhoa,ai,sweep]
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

class V171GraphBuilder extends GraphBuilder {
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
  title,
  description,
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
  gb.elseBranch(condId, noBr, { x, y: y + 140 });

  const gateMsgId = `${pfx}_gate_msg`;
  embedMsg(gb, gateMsgId, {
    title: `{${resVar}.response.update_title}`,
    description: `{${resVar}.response.update_description}`,
    color: '#f59e0b',
    footer: '',
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
    title: `${uidEm('su_level_up')} ĐÃ XÁC NHẬN CẬP NHẬT v1.7.1`,
    description: `{${ackResVar}.response.message}`,
    color: '#10b981',
    footer: '',
    target: { reply: true },
  }, { x: x + 640, y: y + 710 });
  gb.link(ackApiId, ackReplyId);

  return noBr;
}

// ============================================================================
// 1. /updates — v1.7.1 (+800 LT) + Lịch sử v1.7.1..v1.1
// ============================================================================
export function buildUpdatesV171Cmd() {
  const gb = new V171GraphBuilder();
  gb.rootSlash('updates', 'Xem bản cập nhật mới nhất (v1.7.1 • +800 LT) và lịch sử cập nhật', { ephemeral: false });
  gb.errorHandlerWait();

  apiAction(gb, 'upds_api', 'upds_res', 'GET', `${BACKEND_BASE}/api/update?page=1`, '', { x: 0, y: 200 });
  gb.link('root', 'upds_api');

  embedMsg(gb, 'upds_msg_0', {
    title: '{upds_res.response.title}',
    description: '{upds_res.response.description}',
    color: '#f59e0b',
    footer: '',
    target: { reply: true },
    editId: 'upds_msg_0',
  }, { x: 0, y: 380 });
  gb.link('upds_api', 'upds_msg_0');

  apiAction(gb, 'upds_claim_api', 'upds_claim_res', 'POST', `${BACKEND_BASE}/api/update/ack`,
    '{"userId":"{user_id}","username":"{user_displayName}","avatarUrl":"{user_icon}"}', { x: 420, y: 540 });
  embedMsg(gb, 'upds_claim_msg', {
    title: `${uidEm('su_level_up')} QUÀ CẬP NHẬT v1.7.1`,
    description: '{upds_claim_res.response.message}',
    color: '#10b981',
    footer: '',
    target: { reply: true },
  }, { x: 420, y: 720 });
  gb.link('upds_claim_api', 'upds_claim_msg');

  const claimBtnId = 'btn_upds_claim_1';
  gb.advBtn(claimBtnId, 'upds_msg_0', btnCfg('Nhận Quà v1.7.1 (+800 LT)', 'SUCCESS', 'su_linhthach', '1', '1', 'show'), { x: 240, y: 540 });
  gb.link(claimBtnId, 'upds_claim_api');

  const verOpts = [
    { label: 'Phiên bản v1.7.1 (Mới nhất • +800 LT)', description: 'Tháp +15% & T10 +10%, /linhmach 4 mỏ SS..SSS+, /daily x2, /thuongtra & /thaplinhhuong', emoji_id: uidId('tea_ceremony_pot', 'su_sparkle'), value: '1.7.1' },
    { label: 'Phiên bản v1.7 (Đại Cập Nhật)', description: 'Tiến Hóa Chân Thần (/tienhoa), +260 món, /shop_dacbiet Chủ Nhật', emoji_id: uidId('evo_crystal', 'su_sparkle'), value: '1.7' },
    { label: 'Phiên bản v1.6.1 (+1.500 LT)', description: 'Lò Luyện Đan 6 mẻ/ngày, /farm 8 ô, /inv 3 Loadouts', emoji_id: uidId('su_el_hoa', 'su_sparkle'), value: '1.6.1' },
    { label: 'Phiên bản v1.6 (+1.000 LT)', description: 'Đổ Thạch (/dothach), Gieo Quẻ (/gieoque), 3 Luck Potion & /nhiemvu mới', emoji_id: uidId('su_sparkle'), value: '1.6' },
    { label: 'Phiên bản v1.5.2 (+500 LT)', description: 'Chuẩn hóa thuật ngữ, /wiki Linh Vực & Từ Điển, /farm DM & EXP +30%', emoji_id: uidId('su_wiki_scroll'), value: '1.5.2' },
    { label: 'Phiên bản v1.5 (Big Update)', description: 'Cân bằng PvE, +550% Pet, Khắc Ấn mới, Buff SET, Pity 350 & Quà +2.000 LT', emoji_id: uidId('su_sparkle'), value: '1.5' },
    { label: 'Phiên bản v1.4.7', description: 'AutoSell, Tháp 500 tầng, Web Battle Logs 48h & Wiki rút gọn', emoji_id: uidId('su_gacha_dice'), value: '1.4.7' },
    { label: 'Phiên bản v1.4', description: 'Đạo Áp, Shop Ngày, Chiếm Đoạt Linh Mạch & Khám Phá 12 Map', emoji_id: uidId('explorer_world_map_v14'), value: '1.4' },
    { label: 'Phiên bản v1.3', description: 'Linh Vực, 50 Pet, 100 Pháp Bảo, Minigame, Nông Trại /farm & /exchange', emoji_id: uidId('su_thunder_hax'), value: '1.3' },
    { label: 'Phiên bản v1.2', description: 'Khắc Ấn D->S, 6 Việc Làm /job, Tháp Thí Luyện & Túi Đồ /inv mới', emoji_id: uidId('su_enchant_anvil'), value: '1.2' },
    { label: 'Phiên bản v1.1', description: 'Mở rộng Gacha, /info, /phapbao, Thẻ Reset Tháp & cân bằng', emoji_id: uidId('su_wiki_scroll'), value: '1.1' },
  ];

  gb.advSelectMenu('sel_upds_ver', 'upds_msg_0', {
    placeholder: 'Xem lại lịch sử các phiên bản cũ (v1.7.1 .. v1.1)...',
    customVariableName: 'sel_upds_ver',
    basic_options: verOpts,
    row: '2',
    weight: '1',
    showReplies: 'hide',
  }, { x: -240, y: 540 });

  apiAction(gb, 'upds_hist_api', 'upds_hres', 'GET', `${BACKEND_BASE}/api/update?version={sel_upds_ver}&page=1`, '', { x: -240, y: 720 });
  gb.link('sel_upds_ver', 'upds_hist_api');
  embedMsg(gb, 'upds_hist_msg', {
    title: '{upds_hres.response.title}',
    description: '{upds_hres.response.description}',
    color: '#a855f7',
    footer: '',
    target: { editId: 'upds_msg_0' },
    action_id: 'upds_msg_0',
  }, { x: -240, y: 900 });
  gb.link('upds_hist_api', 'upds_hist_msg');

  return gb.elements();
}

// ============================================================================
// 2. /linhmach — 4 Mines (#1..#4) + SS..SSS+ + 90% Fatigue + PvP Rob Heal
// ============================================================================
export function buildLinhMachV171Cmd() {
  const gb = new V171GraphBuilder();
  gb.rootSlash('linhmach', 'Chiếm Đoạt Linh Mạch Khung Giờ Vàng — 4 Mỏ F→SSS+ ngẫu nhiên (Mệt Mỏi trần 90%)', { ephemeral: false });
  gb.errorHandlerWait();

  gb.act('lm_set_owner', 'set_unique_variable', { reference: 'cmd_owner', value: '{user_id}', success_handles: false }, { x: 0, y: 120 });
  gb.link('root', 'lm_set_owner');

  embedMsg(gb, 'lm_ack', {
    title: `${uidEm('vein_mine_sssp', 'vein_mine_sp')} CHIẾM ĐOẠT LINH MẠCH`,
    description: 'Đang kiểm tra 4 Linh Mạch khung giờ hiện tại...',
    color: '#F1C40F',
    footer: '',
    target: { reply: true },
    editId: 'lm_ack',
  }, { x: 0, y: 260 });
  gb.link('lm_set_owner', 'lm_ack');

  apiAction(gb, 'lm_ov_api', 'lm_ov_res', 'GET', `${BACKEND_BASE}/api/vein/overview?userId={user_id}`, '', { x: 0, y: 380 });
  gb.link('lm_ack', 'lm_ov_api');

  const cOvOk = gb.cmp('lm_ov_ok', '{lm_ov_res.response.success}', 'true', 'equal_to', { ignoreCase: true }, { x: 0, y: 560 });
  gb.link('lm_ov_api', cOvOk.condId);

  embedMsg(gb, 'lm_ov_msg', {
    title: '{lm_ov_res.response.title}',
    description: '{lm_ov_res.response.description}',
    color: '#F1C40F',
    footer: '',
    target: { editId: 'lm_ack' },
    action_id: 'lm_ack',
  }, { x: -160, y: 760 });
  gb.link(cOvOk.yes, 'lm_ov_msg');

  embedMsg(gb, 'lm_ov_err', {
    title: `${uidEm('vein_mine_sp')} TẠM THỜI KHÔNG TẢI ĐƯỢC LINH MẠCH`,
    description: 'Máy chủ đang khởi động hoặc tạm gián đoạn. Vui lòng chạy lại `/linhmach` sau vài giây!',
    color: '#E74C3C',
    footer: '',
    target: { editId: 'lm_ack' },
    action_id: 'lm_ack',
  }, { x: 520, y: 760 });
  gb.link(cOvOk.no, 'lm_ov_err');

  const slots = [
    { idx: 1, label: 'Chiếm Mỏ #1', style: 'PRIMARY', emoji: 'vein_mine_f', weight: '4', x: -780 },
    { idx: 2, label: 'Chiếm Mỏ #2', style: 'SECONDARY', emoji: 'vein_mine_a', weight: '3', x: -260 },
    { idx: 3, label: 'Chiếm Mỏ #3', style: 'SECONDARY', emoji: 'vein_mine_sp', weight: '2', x: 260 },
    { idx: 4, label: 'Chiếm Mỏ #4', style: 'DANGER', emoji: 'vein_mine_sssp', weight: '1', x: 780 },
  ];

  for (const s of slots) {
    const pfx = `lm_s${s.idx}`;
    gb.advBtn(`lm_btn_${s.idx}`, 'lm_ov_msg', btnCfg(s.label, s.style, s.emoji, '1', s.weight, 'hide', 'everyone'), { x: s.x, y: 960 });
    const cOwn = gb.cmp(`${pfx}_own`, '{user_id}', '{cmd_owner}', 'equal_to', {}, { x: s.x, y: 1100 });
    gb.link(`lm_btn_${s.idx}`, cOwn.condId);

    embedMsg(gb, `${pfx}_denied`, {
      title: `${uidEm('vein_mine_sp')} KHÔNG THỂ BẤM LỆNH CỦA NGƯỜI KHÁC`,
      description: 'Bảng `/linhmach` này thuộc về <@{cmd_owner}>. Hãy tự gõ `/linhmach` để khiêu chiến Linh Mạch nhé!',
      color: '#f59e0b',
      footer: '',
      target: { reply: true },
    }, { x: s.x + 180, y: 1280 });
    gb.link(cOwn.no, `${pfx}_denied`);

    apiAction(gb, `${pfx}_api`, `${pfx}_res`, 'POST', `${BACKEND_BASE}/api/vein/challenge`,
      `{"userId":"{user_id}","slotIndex":${s.idx},"ownerId":"{cmd_owner}"}`, { x: s.x - 40, y: 1280 });
    gb.link(cOwn.yes, `${pfx}_api`);

    const noAck = attachUpdateAckBranch(gb, pfx, `${pfx}_api`, `${pfx}_res`, { editId: null, x: s.x - 40, y: 1460 });
    const cOk = gb.cmp(`${pfx}_ok`, `{${pfx}_res.response.success}`, 'true', 'equal_to', { ignoreCase: true }, { x: s.x - 40, y: 1640 });
    gb.link(noAck, cOk.condId);

    embedMsg(gb, `${pfx}_win`, {
      title: `{${pfx}_res.response.title}`,
      description: `{${pfx}_res.response.description}`,
      color: '#ec4899',
      footer: '',
      imageUrl: `{${pfx}_res.response.battle_image_url}`,
      target: { editId: 'lm_ack' },
      action_id: 'lm_ack',
    }, { x: s.x - 180, y: 1840 });
    gb.link(cOk.yes, `${pfx}_win`);

    gb.advBtn(`${pfx}_logs_btn`, `${pfx}_win`, btnCfg('Xem Nhật Ký Trận Đấu', 'SECONDARY', 'su_wiki_scroll', '1', '1', 'hide'), { x: s.x - 180, y: 2040 });
    apiAction(gb, `${pfx}_log_api`, `${pfx}_log_res`, 'POST', `${BACKEND_BASE}/api/vein/logs`,
      `{"battleId":"{${pfx}_res.response.battle_id}","userId":"{user_id}"}`, { x: s.x - 180, y: 2220 });
    gb.link(`${pfx}_logs_btn`, `${pfx}_log_api`);

    const cLogOk = gb.cmp(`${pfx}_log_ok`, `{${pfx}_log_res.response.success}`, 'true', 'equal_to', { ignoreCase: true }, { x: s.x - 180, y: 2400 });
    gb.link(`${pfx}_log_api`, cLogOk.condId);

    embedMsg(gb, `${pfx}_log_msg`, {
      title: `{${pfx}_log_res.response.title}`,
      description: `{${pfx}_log_res.response.description}`,
      color: '#38bdf8',
      footer: '',
      target: { reply: true },
    }, { x: s.x - 280, y: 2580 });
    gb.link(cLogOk.yes, `${pfx}_log_msg`);

    embedMsg(gb, `${pfx}_log_err`, {
      title: `${uidEm('su_wiki_scroll')} NHẬT KÝ CHIẾN BÁO LINH MẠCH`,
      description: 'Không thể tải nhật ký trận đấu lúc này. Vui lòng thử lại sau vài giây!',
      color: '#E74C3C',
      footer: '',
      target: { reply: true },
    }, { x: s.x - 80, y: 2580 });
    gb.link(cLogOk.no, `${pfx}_log_err`);

    embedMsg(gb, `${pfx}_err`, {
      title: `${uidEm('vein_mine_sp')} KHÔNG THỂ CHIẾM MỎ #${s.idx}`,
      description: `{${pfx}_res.response.message}`,
      color: '#E74C3C',
      footer: '',
      target: { reply: true },
    }, { x: s.x + 100, y: 1840 });
    gb.link(cOk.no, `${pfx}_err`);
  }

  return gb.elements();
}

// ============================================================================
// 3. /thuongtra — MỚI: Trà Đạo Quán (3 ấm/ngày + 2 lượt Ké Chén không tuần hoàn)
// ============================================================================
export function buildThuongTraCmd() {
  const gb = new V171GraphBuilder();
  gb.rootSlash('thuongtra', 'Pha ấm trà miễn phí tại Trà Đạo Quán (3 Điểm/ngày — pha & Ké Chén đều -1 điểm)', { ephemeral: false });
  gb.errorHandlerWait();

  apiAction(gb, 'tt_brew_api', 'tt_res', 'POST', `${BACKEND_BASE}/api/tea/brew`,
    '{"userId":"{user_id}","username":"{user_displayName}","avatarUrl":"{user_icon}"}', { x: 0, y: 200 });
  gb.link('root', 'tt_brew_api');

  const noAck = attachUpdateAckBranch(gb, 'tt', 'tt_brew_api', 'tt_res', { editId: null, x: 0, y: 380 });
  const cOk = gb.cmp('tt_ok', '{tt_res.response.success}', 'true', 'equal_to', { ignoreCase: true }, { x: 0, y: 560 });
  gb.link(noAck, cOk.condId);

  embedMsg(gb, 'tt_brew_err', {
    title: '{tt_res.response.title}',
    description: '{tt_res.response.description}',
    color: '#ef4444',
    footer: '',
    target: { reply: true },
  }, { x: 380, y: 740 });
  gb.link(cOk.no, 'tt_brew_err');

  embedMsg(gb, 'tt_msg_0', {
    title: '{tt_res.response.title}',
    description: '{tt_res.response.description}',
    imageUrl: '{tt_res.response.image_url}',
    color: '#f59e0b',
    footer: '',
    target: { reply: true },
    editId: 'tt_msg_0',
  }, { x: -160, y: 740 });
  gb.link(cOk.yes, 'tt_msg_0');

  // Helper unrolls 2 interactive guest joins (max 2 guests per pot -> strictly acyclic DAG!)
  function attachJoinStep(parentMsgId, depth, x, y) {
    if (depth > 2) return;
    const pfx = `tt_j${depth}`;
    const btnId = `${pfx}_btn`;
    const apiId = `${pfx}_api`;
    const rVar = `${pfx}_res`;

    gb.advBtn(btnId, parentMsgId, btnCfg('Ké Chén (+LT & Luck)', 'SUCCESS', 'tea_cup_cheers', '1', '1', 'show', 'everyone'), { x, y });
    apiAction(gb, apiId, rVar, 'POST', `${BACKEND_BASE}/api/tea/join`,
      '{"sessionKey":"{tt_res.response.session_key}","userId":"{user_id}","username":"{user_displayName}","avatarUrl":"{user_icon}"}',
      { x, y: y + 160 });
    gb.link(btnId, apiId);

    const cJoinOk = gb.cmp(`${pfx}_ok`, `{${rVar}.response.success}`, 'true', 'equal_to', { ignoreCase: true }, { x, y: y + 340 });
    gb.link(apiId, cJoinOk.condId);

    embedMsg(gb, `${pfx}_err`, {
      title: `${uidEm('tea_cup_cheers', 'su_warn')} KHÔNG THỂ KÉ CHÉN`,
      description: `{${rVar}.response.message}`,
      color: '#ef4444',
      footer: '',
      ephemeral: true,
      target: { reply: true },
    }, { x: x + 320, y: y + 520 });
    gb.link(cJoinOk.no, `${pfx}_err`);

    // Reply receipt to guest with large crisp Ké Chén image (0% Render load!)
    embedMsg(gb, `${pfx}_receipt`, {
      title: `${uidEm('tea_cup_cheers', 'su_sparkle')} KÉ CHÉN THÀNH CÔNG!`,
      description: `{${rVar}.response.guest_reply_message}`,
      imageUrl: `{${rVar}.response.guest_image_url}`,
      color: '#10b981',
      footer: '',
      target: { reply: true },
    }, { x: x - 180, y: y + 520 });
    gb.link(cJoinOk.yes, `${pfx}_receipt`);

    if (depth < 2) {
      // Còn chỗ khách #2 -> cập nhật bảng chính kèm nút Ké Chén lượt 2
      const nextPotMsg = `${pfx}_pot_open`;
      embedMsg(gb, nextPotMsg, {
        title: `{${rVar}.response.title}`,
        description: `{${rVar}.response.description}`,
        imageUrl: `{${rVar}.response.image_url}`,
        color: '#f59e0b',
        footer: '',
        target: { editId: 'tt_msg_0' },
        action_id: 'tt_msg_0',
      }, { x: x - 180, y: y + 700 });
      gb.link(`${pfx}_receipt`, nextPotMsg);
      attachJoinStep(nextPotMsg, depth + 1, x - 180, y + 880);
    } else {
      // Đủ 2/2 khách -> cập nhật bảng chính tắt hẳn nút Ké Chén
      embedMsg(gb, `${pfx}_pot_full`, {
        title: `{${rVar}.response.title}`,
        description: `{${rVar}.response.description}`,
        imageUrl: `{${rVar}.response.image_url}`,
        color: '#22c55e',
        footer: '',
        target: { editId: 'tt_msg_0' },
        action_id: 'tt_msg_0',
      }, { x: x - 180, y: y + 700 });
      gb.link(`${pfx}_receipt`, `${pfx}_pot_full`);
    }
  }

  attachJoinStep('tt_msg_0', 1, -160, 920);
  return gb.elements();
}

// ============================================================================
// 4. /thaplinhhuong — MỚI: Thắp Linh Hương (+5..+15% Luck)
// ============================================================================
export function buildThapLinhHuongCmd() {
  const gb = new V171GraphBuilder();
  gb.rootSlash('thaplinhhuong', 'Thắp Linh Hương (600–800 LT theo Luck) để nhận +5% đến +15% Luck đến 24:00 UTC+7', { ephemeral: false });
  gb.errorHandlerWait();

  apiAction(gb, 'tlh_api', 'tlh_res', 'POST', `${BACKEND_BASE}/api/luck/incense`,
    '{"userId":"{user_id}","username":"{user_displayName}","avatarUrl":"{user_icon}"}', { x: 0, y: 200 });
  gb.link('root', 'tlh_api');

  const noAck = attachUpdateAckBranch(gb, 'tlh', 'tlh_api', 'tlh_res', { editId: null, x: 0, y: 380 });
  const cOk = gb.cmp('tlh_ok', '{tlh_res.response.success}', 'true', 'equal_to', { ignoreCase: true }, { x: 0, y: 560 });
  gb.link(noAck, cOk.condId);

  embedMsg(gb, 'tlh_msg', {
    title: '{tlh_res.response.title}',
    description: '{tlh_res.response.description}',
    imageUrl: '{tlh_res.response.image_url}',
    color: '#ec4899',
    footer: '',
    target: { reply: true },
  }, { x: -200, y: 740 });
  gb.link(cOk.yes, 'tlh_msg');

  embedMsg(gb, 'tlh_err', {
    title: '{tlh_res.response.title}',
    description: '{tlh_res.response.description}',
    color: '#ef4444',
    footer: '',
    target: { reply: true },
  }, { x: 240, y: 740 });
  gb.link(cOk.no, 'tlh_err');

  return gb.elements();
}

// ============================================================================
// 5. Patch Live Trees: /explorer (force Row 2 Bộ 1/2/3), /tienhoa, AI, Global Sweep
// ============================================================================
function sweepTreeV171(tree) {
  const walk = (obj) => {
    if (typeof obj === 'string') {
      return obj
        .replace(/Xác Nhận v1\.7 \(Nhận Gói Quà Lớn!\)/g, ACK_BTN_LABEL_V171)
        .replace(/Xác Nhận Cập Nhật v1\.7/g, ACK_BTN_LABEL_V171)
        .replace(/Cập nhật thành công lên v1\.7/g, 'Cập nhật thành công lên v1.7.1');
    }
    if (Array.isArray(obj)) return obj.map(walk);
    if (obj && typeof obj === 'object') {
      for (const k of Object.keys(obj)) obj[k] = walk(obj[k]);
    }
    return obj;
  };
  return walk(tree);
}

function patchExplorerTreeV171(oldTree) {
  let tree = sweepTreeV171(JSON.parse(JSON.stringify(oldTree)));
  // Xóa sạch nút/cạnh Bộ 1/2/3 cũ bị lỗi binding rồi dựng mới hoàn chỉnh trên cả ex_hub_msg & ex_hub_inj_msg
  const removeSlotIds = new Set();
  for (const el of tree) {
    const id = String(el.id || '');
    if (/^ex_(?:btn|api|msg)_slot_/.test(id)) removeSlotIds.add(id);
  }
  tree = tree.filter((el) => {
    if (el.source && el.target) {
      return !removeSlotIds.has(el.source) && !removeSlotIds.has(el.target);
    }
    return !removeSlotIds.has(el.id);
  });

  const exHubMsg = tree.find((e) => e.id === 'ex_hub_msg');
  const exHubInjMsg = tree.find((e) => e.id === 'ex_hub_inj_msg');
  const apiNodeOpts = JSON.parse(JSON.stringify(tree.find((e) => e.id === 'ex_hub_api')?.data?.node_options || { __ACT_OPT__: 'api_action' }));
  const msgNodeOpts = JSON.parse(JSON.stringify(exHubMsg?.data?.node_options || { __ACT_OPT__: 'advanced_message' }));

  const addNode = (n) => tree.push(n);
  const addEdge = (source, target, { sh = 'action', th = 'action', type = 'custom' } = {}) => {
    tree.push({
      source,
      ...(sh ? { sourceHandle: sh } : {}),
      target,
      ...(th ? { targetHandle: th } : {}),
      animated: false,
      arrowHeadType: 'arrowclosed',
      type,
      id: `reactflow__edge-${source}${sh || ''}-${target}${th || ''}`,
    });
  };

  if (exHubMsg) {
    const baseX = exHubMsg.position?.x || 0;
    const baseY = (exHubMsg.position?.y || 600) + 280;
    const slotIcons = { 1: 'su_pet_paw', 2: 'su_crossed_swords', 3: 'su_realm_star' };

    for (const slot of [1, 2, 3]) {
      const bId = `ex_btn_slot_${slot}`;
      const aId = `ex_api_slot_${slot}`;
      const mId = `ex_msg_slot_${slot}`;
      const rVar = `ex_slot_res_${slot}`;
      const dx = (slot - 2) * 260;

      addNode({
        id: bId,
        type: 'advMessageButton',
        draggable: true,
        position: { x: baseX + dx, y: baseY },
        width: 240,
        height: 80,
        data: {
          node_options: {},
          data: {
            type: 'button',
            ...btnCfg(`Bộ ${slot}`, 'SECONDARY', slotIcons[slot], '2', String(4 - slot), 'hide', 'user'),
            validated: true,
          },
        },
      });
      addEdge('ex_hub_msg', bId, { sh: 'components_source', th: null, type: 'step' });

      addNode({
        id: aId,
        type: 'action',
        draggable: true,
        position: { x: baseX + dx, y: baseY + 160 },
        width: 280,
        height: 90,
        data: {
          node_options: JSON.parse(JSON.stringify(apiNodeOpts)),
          data: {
            type: 'api_action',
            name: rVar,
            ephemeral: false,
            request_options: {
              method: 'POST',
              url: `${BACKEND_BASE}/api/explorer/switch-loadout`,
              headers: [
                { key: 'Content-Type', value: 'application/json' },
                { key: 'x-api-key', value: '{SECRET_BACKEND_KEY}' },
              ],
              params: [],
              body: [],
              rawBody: `{"userId":"{user_id}","slotIndex":${slot}}`,
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
            },
            success_handles: false,
            validated: true,
          },
        },
      });
      addEdge(bId, aId);

      addNode({
        id: mId,
        type: 'action',
        draggable: true,
        position: { x: baseX + dx, y: baseY + 320 },
        width: 280,
        height: 90,
        data: {
          node_options: JSON.parse(JSON.stringify(msgNodeOpts)),
          data: {
            type: 'advanced_message',
            messageType: 'basic',
            useComponentsV2: false,
            target: { editId: 'ex_ack' },
            action_id: 'ex_ack',
            success_handles: false,
            message: {
              content: '',
              embeds: [{
                title: `{${rVar}.response.title}`,
                description: `{${rVar}.response.description}`,
                color: '#10b981',
                timestamp: false,
                author: { name: '', iconURL: '', url: '' },
                footer: { text: '', iconURL: '' },
                image: { url: `{${rVar}.response.map_image_url}` },
                thumbnail: { url: '' },
                fields: [],
              }],
            },
            validated: true,
          },
        },
      });
      addEdge(aId, mId);
    }

    if (exHubInjMsg) {
      const injX = exHubInjMsg.position?.x || -260;
      const injY = (exHubInjMsg.position?.y || 920) + 280;
      for (const slot of [1, 2, 3]) {
        const bId = `ex_btn_slot_inj_${slot}`;
        const dx = (slot - 2) * 240;
        addNode({
          id: bId,
          type: 'advMessageButton',
          draggable: true,
          position: { x: injX + dx, y: injY },
          width: 220,
          height: 80,
          data: {
            node_options: {},
            data: {
              type: 'button',
              ...btnCfg(`Bộ ${slot}`, 'SECONDARY', slotIcons[slot], '2', String(4 - slot), 'hide', 'user'),
              validated: true,
            },
          },
        });
        addEdge('ex_hub_inj_msg', bId, { sh: 'components_source', th: null, type: 'step' });
        addEdge(bId, `ex_api_slot_${slot}`);
      }
    }
  }
  return tree;
}

function patchTienHoaTreeV171(oldTree) {
  let tree = sweepTreeV171(JSON.parse(JSON.stringify(oldTree)));
  const s = JSON.stringify(tree)
    .replace(/1 Hồng Mông Tiến Hóa Tinh/g, '2 Hồng Mông Tiến Hóa Tinh')
    .replace(/Cần 1 Hồng Mông/g, 'Cần 2 Hồng Mông');
  return JSON.parse(s);
}

function patchShopTreeV171(oldTree) {
  let tree = sweepTreeV171(JSON.parse(JSON.stringify(oldTree)));
  const protectLines = [
    `• ${uidEm('farm_protect_card', 'su_shield_def')} **Thẻ Bảo Vệ Cây & Trứng** — **600** ${uidEm('su_linhthach')}\n  *Tự động kích hoạt khi ô /farm sắp héo: tiêu thụ 1 thẻ để gia hạn thêm +2 giờ (tối đa 16 thẻ).*`,
    `• ${uidEm('alchemy_protect_card', 'su_shield_def')} **Thẻ Bảo Vệ Đan** — **400** ${uidEm('su_linhthach')}\n  *Tự động kích hoạt khi Lò Luyện Đan sắp cháy/nổ: tiêu thụ 1 thẻ để gia hạn thêm +2 giờ ân hạn (tối đa 8 thẻ).*`,
  ].join('\n');

  for (const el of tree) {
    if (el.data?.data?.type === 'advanced_message' && Array.isArray(el.data.data.message?.embeds)) {
      for (const em0 of el.data.data.message.embeds) {
        if (typeof em0.title === 'string' && /VẬT PHẨM TIÊU HAO/i.test(em0.title)) {
          em0.title = em0.title.replace(/14 MÓN/g, '16 MÓN');
        }
        if (typeof em0.description === 'string') {
          if (em0.description.includes('Vật Phẩm Tiêu Hao & Luck Potion (14 món)')) {
            em0.description = em0.description
              .replace(/Vật Phẩm Tiêu Hao & Luck Potion \(14 món\)/g, 'Vật Phẩm Tiêu Hao, Bảo Vệ & Luck (16 món)')
              .replace(/Đan Dược\./g, 'Đan Dược, **Thẻ Bảo Vệ Cây & Đan**.');
          }
          if (el.id === 'msg_shop_cons' || el.id === 'msg_shop_cons_2') {
            em0.description = em0.description
              .replace(/0\.65% -> 1\.04%/g, '0.60% -> 0.94%');
            if (!em0.description.includes('Thẻ Bảo Vệ Cây & Trứng')) {
              em0.description = `${em0.description}\n${protectLines}`;
            }
          }
        }
      }
    } else if (el.type === 'advMessageSelectMenu' && Array.isArray(el.data?.data?.basic_options)) {
      for (const opt of el.data.data.basic_options) {
        if (opt.value === 'consumables') {
          opt.label = 'Vật Phẩm Tiêu Hao, Bảo Vệ & Luck (16 món)';
          opt.description = 'Vé Gacha, 3 Lọ Luck (+20/40/60%), Đá Sao, Khắc Ấn, Thẻ Bảo Vệ Cây/Đan';
        }
        if (typeof opt.description === 'string') {
          opt.description = opt.description.replace(/0\.65% -> 1\.04%/g, '0.60% -> 0.94%');
        }
      }
    }
  }
  return tree;
}

function patchWikiTreeV171(oldTree) {
  let tree = sweepTreeV171(JSON.parse(JSON.stringify(oldTree)));
  for (const el of tree) {
    if (el.type === 'advMessageSelectMenu' && Array.isArray(el.data?.data?.basic_options)) {
      if (typeof el.data.data.placeholder === 'string') {
        el.data.data.placeholder = el.data.data.placeholder.replace(/v1\.7\b/g, 'v1.7.1');
      }
      for (const opt of el.data.data.basic_options) {
        if (opt.value === 'overview') {
          opt.label = 'Tổng Quan & Toàn Bộ Lệnh (v1.7.1)';
          opt.description = '/thuongtra, /thaplinhhuong, /linhmach SS–SSS+, Gacha 0.60%, Tháp +15%';
        } else if (opt.value === 'battle') {
          opt.label = 'Đấu Trường, Ultimate & Linh Mạch SS–SSS+';
          opt.description = '40 Ultimate, Linh Mạch 4 Mỏ (trần 90%), Cộng Dồn HAX & Ngũ Vực';
        } else if (opt.value === 'pets') {
          opt.description = '40 Tối Thượng Tiến Hóa (2 Hồng Mông) & 110 Linh Thú';
        } else if (opt.value === 'economy') {
          opt.label = 'Kinh Tế, Trà Đạo Quán, Luck & Tháp 500';
          opt.description = '/daily ×2, /thuongtra, Hoàng Đạo, /thaplinhhuong, Gacha 0.60%, Tháp +15%';
        } else if (opt.value === 'explorer') {
          opt.description = '12 Địa Danh, Thanh Tiến Độ, Bộ 1/2/3 Độc Lập & Hủy Mỏ Giữ Mệt Mỏi';
        }
      }
    } else if (el.data?.data?.type === 'advanced_message') {
      let s = JSON.stringify(el.data.data.message || {})
        .replace(/60\.35%/g, '60.40%')
        .replace(/0\.65%/g, '0.60%')
        .replace(/1 Hồng Mông Tiến Hóa Tinh/g, '2 Hồng Mông Tiến Hóa Tinh')
        .replace(/\(v1\.7\)/g, '(v1.7.1)')
        .replace(/• v1\.7\)/g, '• v1.7.1)')
        .replace(/v1\.7 •/g, 'v1.7.1 •');
      el.data.data.message = JSON.parse(s);
    }
  }
  return tree;
}

function buildV171KnowledgeBlock(includeFuyumiSecret) {
  const lines = [
    'KIẾN THỨC CHÍNH THỨC TOÀN BỘ HỆ THỐNG BOT NHIỄM NHIỄM (SUMI FAMILY TỪ v1.1 ĐẾN v1.7.1):',
    '• [CẢNH GIỚI, LEVEL ROLES & EXP] (/profile, /rank, /exp, /doiqua, /top): 7 Đại Cảnh Giới từ Lv.1→Lv.100 mở dần 1→5 Slot Role. Chat nhận 23–35 EXP/45s, Voice nhận 85–135 EXP/5 phút; công thức lên cấp 78*(Lv^1.45) (max 500.000 EXP), lên cấp mới thưởng +50..+400 LT. Quyền 8 mốc Level Roles: Lv.5 Gửi Ảnh/File, Lv.10 Stream, Lv.20 Emoji Nitro & Lập Gia Tộc, Lv.35 Embed Links, Lv.45 Sticker Ngoại (+ mở Lò #2), Lv.60 Voice Message, Lv.80 Soundboard, Lv.100 External Sounds. /doiqua đổi 1.000 EXP lấy 10 LT. Top Chat/Voice Ngày trao 500/400/300 LT lúc 00:00 (UTC+7); 19:00 Chủ Nhật tổng kết Top Tuần Lực Chiến.',
    '• [TIẾN HÓA CHÂN THẦN & 40 SKILL ULTIMATE] (/tienhoa): Áp dụng cho toàn bộ 40 Pet Độc Nhất (Lv.40 & 8★). Cần 2 Hồng Mông Tiến Hóa Tinh (điều chỉnh từ 3 xuống 2) + phí LT (1.000 LT = 60% .. 9.000 LT = 100%; thất bại CHỈ mất LT, GIỮ NGUYÊN Hồng Mông) để nâng cấp thành Tối Thượng Chân Thần & mở Skill Ultimate tái kích hoạt. Tab 2 Chế Hồng Mông: 3 Mảnh Tinh Hoa Hỗn Độn + 1 Đồ Thần Thoại thường (Pet / Pháp Bảo / Vực / Thức / Cảnh — KHÔNG Độc Nhất) + 2.500 LT (KHÔNG có /hiente).',
    '• [TÚI ĐỒ 2×3, 3 LOADOUT & KHÁM PHÁ /explorer] (/inv, /linhthu, /equip, /unequip, /enchant, /explorer): /inv và /explorer dùng chung 3 bộ Bộ 1 / Bộ 2 / Bộ 3 độc lập hoàn toàn (khóa chống ghi đè chéo). /explorer 12 Địa Danh hiển thị dọc Pháp Bảo & Lương Thảo kèm thanh tiến độ %, tự vá kẹt trạng thái Đang Khám Phá; lưu ý vào /explorer khi đang giữ Linh Mạch sẽ hủy giữ mỏ nhưng vẫn giữ nguyên độ Mệt Mỏi.',
    '• [ĐẤU TRƯỜNG 1V1, THÁP 500 & LINH MẠCH SS–SSS+] (/battle, /party, /linhmach, /nhiemvu): Tháp 500 tầng (+15% LT/tầng, Boss chia hết cho 10 thưởng thêm +10% LT, mốc T100..500 +1 Mảnh Hỗn Độn). /linhmach mở 6 Giờ Vàng (08/12/18/20/21/22h) với 4 Mỏ/đợt (F→SSS+, Boss 8.4k→850k Lực, 6–125 LT/phút, tỉ lệ SSS+ 1%). Chiếm mỗi mỏ cộng +25% Mệt Mỏi (trần 90%, hồi -10%/giờ); bị người khác cướp mỏ hồi -15% Mệt Mỏi (từ 25% còn 10%).',
    '• [KINH TẾ v1.7.1, TRÀ ĐẠO QUÁN, LUCK 5 NGUỒN & SHOP ĐẶC BIỆT] (/daily, /thuongtra, /thaplinhhuong, /gieoque, /roll, /dothach, /shop_dacbiet, /updates): /daily gốc 110–160 LT + +5% LT mỗi 10 ngày chuỗi (max +200%) + +2% Luck mỗi 7 ngày chuỗi (max +40%, đứt chuỗi về 0%). /thuongtra mỗi ngày 3 Điểm Trà (pha ấm hoặc Ké Chén người khác đều tốn -1 điểm); pha nhận 200–300 LT & mời 1–2 khách Ké Chén trong 2 phút nhận thêm 200–300 LT + (%Luck×5 LT). Giờ Hoàng Đạo (11h/17h/21h UTC+7) +10% Luck toàn server; /thaplinhhuong (600–800 LT) +5..+15% Luck; Gacha Thần Thoại+ 0.60% (0.03% Độc Nhất + 0.57%×Luck); /updates v1.7.1 tặng +800 LT.',
  ];
  if (includeFuyumiSecret) {
    lines.push('• [BỘ TỐI THƯỢNG ĐỘC TÔN CỦA TIỂU THƯ FUYUMI]: Tiểu thư sở hữu Cửu Vĩ Hồng Hồ (cuu_vi_hong_ho — Hồng Mông Đế Nữ), Viền Cửu Vĩ Hồng Mông Ấn (frame_kitsune_mythic) cùng Linh Vực Cửu Vĩ Hồng Mông (Đạo Áp 3 hiệp +30%), Thần Thức Thái Thượng Hồng Hồ và Thần Cảnh Vạn Cổ Tuyệt Diệt.');
  }
  return lines.join('\n');
}

function updateAiPromptTextV171(oldPrompt, includeFuyumiSecret) {
  let text = String(oldPrompt || '');
  text = text.replace(/tài liệu(?: hệ thống)? v1\.[0-9]+(?:\.[0-9]+)? bên dưới/g, 'tài liệu hệ thống v1.7.1 bên dưới');
  const startMatch = text.match(/KIẾN THỨC CHÍNH THỨC (?:TOÀN BỘ )?HỆ THỐNG BOT NHIỄM NHIỄM/);
  const sIdx = startMatch ? startMatch.index : -1;
  const endMarker = '\n\nBỘ DANH SÁCH EMOTE ĐỘNG DISCORD CHÍNH THỨC:';
  const eIdx = text.indexOf(endMarker);
  if (sIdx === -1 || eIdx === -1 || eIdx <= sIdx) {
    throw new Error(`Could not locate knowledge markers inside AI prompt (s=${sIdx}, e=${eIdx})`);
  }
  return text.slice(0, sIdx) + buildV171KnowledgeBlock(includeFuyumiSecret) + text.slice(eIdx);
}

function validateTreeStrict(els, label) {
  for (const el of els) {
    if (el.type === 'advMessageSelectMenu') {
      const opts = el.data?.data?.basic_options || [];
      if (opts.length === 0 || opts.length > 25) {
        throw new Error(`Select menu "${el.id}" in ${label} has ${opts.length} options (must be 1..25)`);
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
      cmds: Object.values(rawCmds)
        .filter(c => c && c.name && c.compressed_tree)
        .map(c => ({ name: c.name, enabled: c.enabled !== false, groupId: c.groupId || '', compressed_tree: c.compressed_tree })),
      events: Object.values(rawEvents)
        .filter(e => e && e.name && e.compressed_tree)
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
  console.log(`SuMi Family Ver 1.7.1 Mini BotGhost Deployer (${dryRun ? 'DRY RUN' : 'LIVE CDP'})`);
  console.log(`============================================================\n`);

  const specs = [];
  const fullBuilders = [
    ['updates', buildUpdatesV171Cmd],
    ['linhmach', buildLinhMachV171Cmd],
    ['thuongtra', buildThuongTraCmd],
    ['thaplinhhuong', buildThapLinhHuongCmd],
  ];

  for (const [name, fn] of fullBuilders) {
    if (!shouldRun(name)) continue;
    const els = fn();
    validateTreeStrict(els, name);
    specs.push({ name, kind: 'slash', groupId: PROFILE_GROUP_ID, elements: els });
  }

  if (dryRun) {
    for (const sp of specs) {
      const json = JSON.stringify(sp.elements);
      const comp = LZString.compressToBase64(json);
      console.log(`[DRY-RUN OK] /${sp.name}: ${sp.elements.length} els, ${(json.length / 1024).toFixed(1)} KB -> ${(comp.length / 1024).toFixed(1)} KB LZ`);
    }
    console.log('\n[DRY-RUN] All Ver 1.7.1 Mini BotGhost graphs validated with 0 errors!');
    return;
  }

  const liveState = await fetchAllLiveReduxState();
  const cmdMap = new Map(liveState.cmds.map((c) => [c.name, c]));

  if (shouldRun('explorer') && cmdMap.has('explorer')) {
    const oldTree = JSON.parse(LZString.decompressFromBase64(cmdMap.get('explorer').compressed_tree));
    const newTree = patchExplorerTreeV171(oldTree);
    validateTreeStrict(newTree, 'explorer');
    specs.push({ name: 'explorer', kind: 'slash', groupId: cmdMap.get('explorer').groupId || PROFILE_GROUP_ID, elements: newTree });
  }

  if (shouldRun('tienhoa') && cmdMap.has('tienhoa')) {
    const oldTree = JSON.parse(LZString.decompressFromBase64(cmdMap.get('tienhoa').compressed_tree));
    const newTree = patchTienHoaTreeV171(oldTree);
    validateTreeStrict(newTree, 'tienhoa');
    specs.push({ name: 'tienhoa', kind: 'slash', groupId: cmdMap.get('tienhoa').groupId || PROFILE_GROUP_ID, elements: newTree });
  }

  if (shouldRun('wiki') && cmdMap.has('wiki')) {
    const oldTree = JSON.parse(LZString.decompressFromBase64(cmdMap.get('wiki').compressed_tree));
    const newTree = patchWikiTreeV171(oldTree);
    validateTreeStrict(newTree, 'wiki');
    specs.push({ name: 'wiki', kind: 'slash', groupId: cmdMap.get('wiki').groupId || PROFILE_GROUP_ID, enabled: cmdMap.get('wiki').enabled, elements: newTree });
  }

  if (shouldRun('shop') && cmdMap.has('shop')) {
    const oldTree = JSON.parse(LZString.decompressFromBase64(cmdMap.get('shop').compressed_tree));
    const newTree = patchShopTreeV171(oldTree);
    validateTreeStrict(newTree, 'shop');
    specs.push({ name: 'shop', kind: 'slash', groupId: cmdMap.get('shop').groupId || PROFILE_GROUP_ID, enabled: cmdMap.get('shop').enabled, elements: newTree });
  }

  if (shouldRun('ai')) {
    const aiEv = liveState.events.find((e) => e.id === AI_MENTION_INT_ID || e.int_id === AI_MENTION_INT_ID || /mention|nhi[eễ]m/i.test(e.name));
    if (aiEv) {
      const tree = JSON.parse(LZString.decompressFromBase64(aiEv.compressed_tree));
      let updatedAiNodes = 0;
      for (const el of tree) {
        if (el.type === 'action' && el.data?.data?.type === 'ai_prompt') {
          el.data.data.prompt = updateAiPromptTextV171(el.data.data.prompt, String(el.id).includes('fuyumi'));
          updatedAiNodes++;
        } else if (el.type === 'action' && el.data?.data?.type === 'api_action' && typeof el.data?.data?.request_options?.rawBody === 'string') {
          const raw = el.data.data.request_options.rawBody;
          if (/KIẾN THỨC CHÍNH THỨC/.test(raw)) {
            const bodyObj = JSON.parse(raw);
            if (bodyObj?.systemInstruction?.parts?.[0]?.text) {
              bodyObj.systemInstruction.parts[0].text = updateAiPromptTextV171(
                bodyObj.systemInstruction.parts[0].text,
                String(el.id).includes('fuyumi')
              );
              el.data.data.request_options.rawBody = JSON.stringify(bodyObj);
              updatedAiNodes++;
            }
          }
        }
      }
      if (updatedAiNodes === 0) {
        throw new Error(`No AI knowledge nodes updated inside ${aiEv.name}`);
      }
      validateTreeStrict(tree, aiEv.name);
      specs.push({ name: aiEv.name, kind: 'event', groupId: aiEv.groupId || PROFILE_GROUP_ID, enabled: aiEv.enabled, intId: aiEv.int_id || aiEv.id, elements: tree });
    }
  }

  if (shouldRun('sweep')) {
    const handled = new Set(specs.map((s) => `${s.kind}:${s.name}`));
    for (const c of liveState.cmds) {
      if (handled.has(`slash:${c.name}`)) continue;
      const oldTree = JSON.parse(LZString.decompressFromBase64(c.compressed_tree));
      const newTree = sweepTreeV171(JSON.parse(JSON.stringify(oldTree)));
      if (JSON.stringify(newTree) !== JSON.stringify(oldTree)) {
        validateTreeStrict(newTree, `sweep:${c.name}`);
        specs.push({ name: c.name, kind: 'slash', groupId: c.groupId || PROFILE_GROUP_ID, enabled: c.enabled, elements: newTree });
      }
    }
  }

  if (specs.length === 0) {
    console.log('Nothing matched to deploy.');
    return;
  }

  console.log(`Deploying ${specs.length} BotGhost command/event updates via Edge CDP...`);
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
  console.log('\n[DONE] Ver 1.7.1 Mini BotGhost deployed & verified cleanly!');
}

const isCli = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop());
if (isCli) {
  main().catch((err) => {
    console.error('[DEPLOY FAILED]', err);
    process.exit(1);
  });
}
