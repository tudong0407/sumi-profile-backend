/**
 * scripts/deploy_hotfix_v1_4_7b_botghost.mjs
 * Hotfix BotGhost commands for SuMi v1.4.7b via Edge CDP (9222):
 * 1. /party:
 *    - Remove `?username={encode_text[{user_displayName}]}` from GET /api/party/status/{user_id}
 *      and guard `{pt_st_res.response.success} == 'true'` so raw `{pt_st_res.response.*}` never leaks.
 *    - Attach [Chấp Nhận Lời Mời] & [Từ Chối Lời Mời] buttons directly onto the quick-invite card
 *      (`pt_inv_edit`) so invitees can accept/decline right away; non-invitees get ephemeral error
 *      without wiping the invite buttons.
 *    - Zero footers, live custom_emojis.json IDs, unique api_action variable names.
 * 2. /linhmach:
 *    - Upgrade from 2 fixed buttons (Thấp/Cao) to 3 slot buttons: [Chiếm Mỏ #1], [Chiếm Mỏ #2], [Chiếm Mỏ #3]
 *      calling POST /api/vein/challenge with `"slotIndex": 1|2|3`.
 *    - Preserve Update Ack gate +800 LT, ephemeral error on failed challenge (keeps 3 buttons usable),
 *      and [Xem Nhật Ký Trận Đấu] ephemeral battle log viewer on wins/losses, 0 footers.
 */

import WebSocket from 'ws';
globalThis.WebSocket = WebSocket;

import fs from 'node:fs';
import {
  GraphBuilder,
  attachUpdateAckBranch,
  deployViaCDP,
  validateGraph,
  validateRegexSafety,
} from './ga_builder_lib.mjs';
import { em, emId } from '../src/config/emojiHelper.js';

const PROFILE_GROUP_ID = '1782127263978';
const BACKEND_BASE = 'https://sumi-profile-backend.onrender.com';

const CUSTOM_EMOJIS_RAW = JSON.parse(
  fs.readFileSync(new URL('../src/config/custom_emojis.json', import.meta.url), 'utf8'),
);

function emojiRow(name) {
  return CUSTOM_EMOJIS_RAW[name] || null;
}

function uidEm(name, fallback = '') {
  const row = emojiRow(name);
  if (row?.id) return row.animated ? `<a:${row.name}:${row.id}>` : `<:${row.name}:${row.id}>`;
  return em(name) || fallback;
}

function uidId(name, fallbackKey = 'su_sparkle') {
  return emojiRow(name)?.id || CUSTOM_EMOJIS_RAW[fallbackKey]?.id || emId(fallbackKey) || '';
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

function validateTreeStrict(els, label) {
  assertAcyclicDAG(els, label);
  assertUniqueApiActionNames(els, label);
  for (const el of els) {
    const dt = el?.data?.data;
    if (dt?.type === 'matches_pattern' || dt?.type === 'not_matches_pattern') {
      const errs = validateRegexSafety(String(dt.comparison_value ?? ''));
      if (errs.length) throw new Error(`Unsafe regex in ${label} (${el.id}): ${errs.join('; ')}`);
    }
  }
  const errs = validateGraph(els);
  if (errs.length) throw new Error(`validateGraph failed for ${label}: ${errs.join(', ')}`);
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
        footer: { text: '', icon_url: '' },
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

function btnCfg(label, style, emojiName, row = '1', weight = '1', showReplies = 'hide') {
  const id = uidId(emojiName, '');
  const anim = Boolean(emojiRow(emojiName)?.animated);
  return {
    label,
    style,
    ...(id ? { emoji: { id, name: emojiName, animated: anim }, emoji_id: id } : { emoji_id: '' }),
    orderComponent: true,
    row: String(row),
    weight: String(weight),
    showReplies,
  };
}

// ============================================================================
// 1. HOTFIX /party — Inline invite accept/decline buttons + remove ?username= bug
// ============================================================================
export function buildPartyHotfixCmd() {
  const gb = new GraphBuilder();
  gb.rootSlash('party', 'Lập & Quản Lý Tổ Đội tối đa 3 người chinh chiến Chiếm Đoạt Linh Mạch', { ephemeral: false });
  gb.errorHandlerWait();

  gb.option('moi_dong_doi', 'user', '(Tùy chọn) Chọn đồng đội để gửi lời mời vào Tổ Đội ngay', {
    required: false,
    x: 420,
    y: 0,
  });
  gb.option('duoi_hoac_chuyen', 'user', '(Tùy chọn) Chọn đồng đội trong đội để Chuyển Đội Trưởng / Đuổi', {
    required: false,
    x: 700,
    y: 0,
  });

  embedMsg(gb, 'pt_ack', {
    title: `${uidEm('su_crossed_swords')} TỔ ĐỘI CHIẾN ĐẤU`,
    description: 'Đang kết nối dữ liệu Tổ Đội...',
    color: '#3498DB',
    target: { reply: true },
    editId: 'pt_ack',
  }, { x: 0, y: 200 });
  gb.link('root', 'pt_ack');

  const hasInv = gb.cmp('pt_has_inv', '{option_moi_dong_doi}', '', 'not', {}, { x: 0, y: 380 });
  gb.link('pt_ack', hasInv.condId);

  // --- BRANCH A: Quick Invite (/party moi_dong_doi:@user) ---
  apiAction(
    gb,
    'pt_inv_api',
    'pt_inv_res',
    'POST',
    `${BACKEND_BASE}/api/party/invite`,
    '{"userId":"{user_id}","targetUserId":"{option_moi_dong_doi}","username":"{user_displayName}"}',
    { x: -460, y: 560 },
  );
  gb.link(hasInv.yes, 'pt_inv_api');

  const ptInvNoAck = attachUpdateAckBranch(gb, 'pt_inv', 'pt_inv_api', 'pt_inv_res', { editId: 'pt_ack', x: -460, y: 740 });
  const cInvOk = gb.cmp('pt_inv_ok', '{pt_inv_res.response.success}', 'true', 'equal_to', { ignoreCase: true }, { x: -460, y: 920 });
  gb.link(ptInvNoAck, cInvOk.condId);

  embedMsg(gb, 'pt_inv_edit', {
    title: `${uidEm('su_crossed_swords')} MỜI ĐỒNG ĐỘI VÀO TỔ ĐỘI`,
    description: '{pt_inv_res.response.message}',
    color: '#2ECC71',
    target: { editId: 'pt_ack' },
    action_id: 'pt_ack',
  }, { x: -640, y: 1120 });
  gb.link(cInvOk.yes, 'pt_inv_edit');

  // Inline Accept button right on the invite card (never wipes buttons if non-invitee clicks)
  gb.advBtn('pt_inv_btn_acc', 'pt_inv_edit', btnCfg('Chấp Nhận Lời Mời', 'SUCCESS', 'su_sparkle', '1', '1', 'hide'), { x: -820, y: 1320 });
  apiAction(gb, 'pt_inv_acc_api', 'pt_inv_acc_res', 'POST', `${BACKEND_BASE}/api/party/respond`, '{"userId":"{user_id}","decision":"accept"}', { x: -820, y: 1500 });
  gb.link('pt_inv_btn_acc', 'pt_inv_acc_api');
  const ptInvAccNoAck = attachUpdateAckBranch(gb, 'pt_inv_acc', 'pt_inv_acc_api', 'pt_inv_acc_res', { editId: null, x: -820, y: 1680 });
  const cInvAccOk = gb.cmp('pt_inv_acc_ok', '{pt_inv_acc_res.response.success}', 'true', 'equal_to', { ignoreCase: true }, { x: -820, y: 1860 });
  gb.link(ptInvAccNoAck, cInvAccOk.condId);
  embedMsg(gb, 'pt_inv_acc_edit', {
    title: `${uidEm('su_crossed_swords')} GIA NHẬP TỔ ĐỘI THÀNH CÔNG`,
    description: '{pt_inv_acc_res.response.message}',
    color: '#2ECC71',
    target: { editId: 'pt_ack' },
    action_id: 'pt_ack',
  }, { x: -980, y: 2060 });
  gb.link(cInvAccOk.yes, 'pt_inv_acc_edit');
  embedMsg(gb, 'pt_inv_acc_err', {
    title: `${uidEm('su_crossed_swords')} CHƯA THỂ CHẤP NHẬN`,
    description: '{pt_inv_acc_res.response.message}',
    color: '#E74C3C',
    target: { reply: true },
  }, { x: -660, y: 2060 });
  gb.link(cInvAccOk.no, 'pt_inv_acc_err');

  // Inline Decline button right on the invite card (never wipes buttons if non-invitee clicks)
  gb.advBtn('pt_inv_btn_dec', 'pt_inv_edit', btnCfg('Từ Chối Lời Mời', 'SECONDARY', 'su_wiki_scroll', '1', '2', 'hide'), { x: -460, y: 1320 });
  apiAction(gb, 'pt_inv_dec_api', 'pt_inv_dec_res', 'POST', `${BACKEND_BASE}/api/party/respond`, '{"userId":"{user_id}","decision":"decline"}', { x: -460, y: 1500 });
  gb.link('pt_inv_btn_dec', 'pt_inv_dec_api');
  const ptInvDecNoAck = attachUpdateAckBranch(gb, 'pt_inv_dec', 'pt_inv_dec_api', 'pt_inv_dec_res', { editId: null, x: -460, y: 1680 });
  const cInvDecOk = gb.cmp('pt_inv_dec_ok', '{pt_inv_dec_res.response.success}', 'true', 'equal_to', { ignoreCase: true }, { x: -460, y: 1860 });
  gb.link(ptInvDecNoAck, cInvDecOk.condId);
  embedMsg(gb, 'pt_inv_dec_edit', {
    title: `${uidEm('su_wiki_scroll')} ĐÃ TỪ CHỐI LỜI MỜI`,
    description: '{pt_inv_dec_res.response.message}',
    color: '#95A5A6',
    target: { editId: 'pt_ack' },
    action_id: 'pt_ack',
  }, { x: -580, y: 2060 });
  gb.link(cInvDecOk.yes, 'pt_inv_dec_edit');
  embedMsg(gb, 'pt_inv_dec_err', {
    title: `${uidEm('su_wiki_scroll')} KHÔNG THỂ TỪ CHỐI`,
    description: '{pt_inv_dec_res.response.message}',
    color: '#E74C3C',
    target: { reply: true },
  }, { x: -340, y: 2060 });
  gb.link(cInvDecOk.no, 'pt_inv_dec_err');

  embedMsg(gb, 'pt_inv_fail_edit', {
    title: `${uidEm('su_crossed_swords')} KHÔNG THỂ GỬI LỜI MỜI`,
    description: '{pt_inv_res.response.message}',
    color: '#E74C3C',
    target: { editId: 'pt_ack' },
    action_id: 'pt_ack',
  }, { x: -240, y: 1120 });
  gb.link(cInvOk.no, 'pt_inv_fail_edit');

  // --- BRANCH B: Party Overview Status (/party) — NO ?username= query param! ---
  apiAction(
    gb,
    'pt_st_api',
    'pt_st_res',
    'GET',
    `${BACKEND_BASE}/api/party/status/{user_id}`,
    '',
    { x: 360, y: 560 },
  );
  gb.link(hasInv.no, 'pt_st_api');

  const ptNoAck = attachUpdateAckBranch(gb, 'pt', 'pt_st_api', 'pt_st_res', { editId: 'pt_ack', x: 360, y: 740 });
  const cStOk = gb.cmp('pt_st_ok', '{pt_st_res.response.success}', 'true', 'equal_to', { ignoreCase: true }, { x: 360, y: 920 });
  gb.link(ptNoAck, cStOk.condId);

  embedMsg(gb, 'pt_st_msg', {
    title: '{pt_st_res.response.title}',
    description: '{pt_st_res.response.description}',
    color: '#3498DB',
    target: { editId: 'pt_ack' },
    action_id: 'pt_ack',
  }, { x: 240, y: 1120 });
  gb.link(cStOk.yes, 'pt_st_msg');

  embedMsg(gb, 'pt_st_err', {
    title: `${uidEm('su_crossed_swords')} TẠM THỜI KHÔNG TẢI ĐƯỢC TỔ ĐỘI`,
    description: 'Máy chủ đang khởi động hoặc phản hồi chậm. Vui lòng thử lại `/party` sau vài giây!',
    color: '#E74C3C',
    target: { editId: 'pt_ack' },
    action_id: 'pt_ack',
  }, { x: 760, y: 1120 });
  gb.link(cStOk.no, 'pt_st_err');

  const statusButtons = [
    {
      id: 'acc',
      label: 'Chấp Nhận Lời Mời',
      style: 'SUCCESS',
      emoji: 'su_sparkle',
      row: '1',
      weight: '1',
      url: `${BACKEND_BASE}/api/party/respond`,
      rawBody: '{"userId":"{user_id}","decision":"accept"}',
      okTitle: `${uidEm('su_crossed_swords')} TỔ ĐỘI CHIẾN ĐẤU`,
      okColor: '#2ECC71',
      x: 40,
    },
    {
      id: 'dec',
      label: 'Từ Chối Lời Mời',
      style: 'SECONDARY',
      emoji: 'su_wiki_scroll',
      row: '1',
      weight: '2',
      url: `${BACKEND_BASE}/api/party/respond`,
      rawBody: '{"userId":"{user_id}","decision":"decline"}',
      okTitle: `${uidEm('su_wiki_scroll')} ĐÃ TỪ CHỐI LỜI MỜI`,
      okColor: '#95A5A6',
      x: 340,
    },
    {
      id: 'lv',
      label: 'Rời / Giải Tán Đội',
      style: 'DANGER',
      emoji: 'su_crossed_swords',
      row: '1',
      weight: '3',
      url: `${BACKEND_BASE}/api/party/leave`,
      rawBody: '{"userId":"{user_id}"}',
      okTitle: `${uidEm('su_crossed_swords')} CẬP NHẬT TỔ ĐỘI`,
      okColor: '#ec4899',
      x: 640,
    },
    {
      id: 'tr',
      label: 'Chuyển Đội Trưởng',
      style: 'PRIMARY',
      emoji: 'su_winner_trophy',
      row: '2',
      weight: '1',
      url: `${BACKEND_BASE}/api/party/transfer`,
      rawBody: '{"userId":"{user_id}","targetUserId":"{option_duoi_hoac_chuyen}"}',
      okTitle: `${uidEm('su_winner_trophy')} ĐÃ CHUYỂN ĐỘI TRƯỞNG`,
      okColor: '#3498DB',
      x: 940,
    },
    {
      id: 'kk',
      label: 'Đuổi Thành Viên',
      style: 'DANGER',
      emoji: 'su_crit_boom',
      row: '2',
      weight: '2',
      url: `${BACKEND_BASE}/api/party/kick`,
      rawBody: '{"userId":"{user_id}","targetUserId":"{option_duoi_hoac_chuyen}"}',
      okTitle: `${uidEm('su_crit_boom')} ĐÃ CẬP NHẬT THÀNH VIÊN`,
      okColor: '#E74C3C',
      x: 1240,
    },
  ];

  for (const b of statusButtons) {
    gb.advBtn(`pt_btn_${b.id}`, 'pt_st_msg', btnCfg(b.label, b.style, b.emoji, b.row, b.weight, 'hide'), { x: b.x, y: 1320 });
    apiAction(gb, `pt_${b.id}_api`, `pt_${b.id}_res`, 'POST', b.url, b.rawBody, { x: b.x, y: 1500 });
    gb.link(`pt_btn_${b.id}`, `pt_${b.id}_api`);

    const btnNoAck = attachUpdateAckBranch(gb, `pt_b_${b.id}`, `pt_${b.id}_api`, `pt_${b.id}_res`, { editId: null, x: b.x, y: 1680 });
    const cAct = gb.cmp(`pt_${b.id}_ok`, `{pt_${b.id}_res.response.success}`, 'true', 'equal_to', { ignoreCase: true }, { x: b.x, y: 1860 });
    gb.link(btnNoAck, cAct.condId);

    embedMsg(gb, `pt_${b.id}_edit`, {
      title: b.okTitle,
      description: `{pt_${b.id}_res.response.message}`,
      color: b.okColor,
      target: { editId: 'pt_ack' },
      action_id: 'pt_ack',
    }, { x: b.x - 110, y: 2060 });
    gb.link(cAct.yes, `pt_${b.id}_edit`);

    embedMsg(gb, `pt_${b.id}_err`, {
      title: `${uidEm('su_crossed_swords')} THAO TÁC CHƯA THỰC HIỆN ĐƯỢC`,
      description: `{pt_${b.id}_res.response.message}`,
      color: '#E74C3C',
      target: { reply: true },
    }, { x: b.x + 110, y: 2060 });
    gb.link(cAct.no, `pt_${b.id}_err`);
  }

  return gb.elements();
}

// ============================================================================
// 2. HOTFIX /linhmach — 3 Weighted Vein Slots (#1, #2, #3) + -10%/h Fatigue
// ============================================================================
export function buildLinhMachHotfixCmd() {
  const gb = new GraphBuilder();
  gb.rootSlash('linhmach', 'Chiếm Đoạt Linh Mạch Khung Giờ Vàng — 3 Mỏ F→S+ ngẫu nhiên, giảm -10% Mệt Mỏi/giờ', { ephemeral: false });
  gb.errorHandlerWait();

  embedMsg(gb, 'lm_ack', {
    title: `${uidEm('vein_mine_sp')} CHIẾM ĐOẠT LINH MẠCH`,
    description: 'Đang kiểm tra 3 Linh Mạch khung giờ hiện tại...',
    color: '#F1C40F',
    target: { reply: true },
    editId: 'lm_ack',
  }, { x: 0, y: 200 });
  gb.link('root', 'lm_ack');

  apiAction(
    gb,
    'lm_ov_api',
    'lm_ov_res',
    'GET',
    `${BACKEND_BASE}/api/vein/overview?userId={user_id}`,
    '',
    { x: 0, y: 380 },
  );
  gb.link('lm_ack', 'lm_ov_api');

  const cOvOk = gb.cmp('lm_ov_ok', '{lm_ov_res.response.success}', 'true', 'equal_to', { ignoreCase: true }, { x: 0, y: 560 });
  gb.link('lm_ov_api', cOvOk.condId);

  embedMsg(gb, 'lm_ov_msg', {
    title: '{lm_ov_res.response.title}',
    description: '{lm_ov_res.response.description}',
    color: '#F1C40F',
    target: { editId: 'lm_ack' },
    action_id: 'lm_ack',
  }, { x: -160, y: 760 });
  gb.link(cOvOk.yes, 'lm_ov_msg');

  embedMsg(gb, 'lm_ov_err', {
    title: `${uidEm('vein_mine_sp')} TẠM THỜI KHÔNG TẢI ĐƯỢC LINH MẠCH`,
    description: 'Máy chủ đang khởi động hoặc tạm gián đoạn. Vui lòng chạy lại `/linhmach` sau vài giây!',
    color: '#E74C3C',
    target: { editId: 'lm_ack' },
    action_id: 'lm_ack',
  }, { x: 520, y: 760 });
  gb.link(cOvOk.no, 'lm_ov_err');

  const slots = [
    { idx: 1, label: 'Chiếm Mỏ #1', style: 'PRIMARY', emoji: 'vein_mine_f', weight: '1', x: -560 },
    { idx: 2, label: 'Chiếm Mỏ #2', style: 'SECONDARY', emoji: 'vein_mine_a', weight: '2', x: 0 },
    { idx: 3, label: 'Chiếm Mỏ #3', style: 'DANGER', emoji: 'vein_mine_sp', weight: '3', x: 560 },
  ];

  for (const s of slots) {
    const pfx = `lm_s${s.idx}`;
    gb.advBtn(`lm_btn_${s.idx}`, 'lm_ov_msg', btnCfg(s.label, s.style, s.emoji, '1', s.weight, 'hide'), { x: s.x, y: 960 });
    apiAction(
      gb,
      `${pfx}_api`,
      `${pfx}_res`,
      'POST',
      `${BACKEND_BASE}/api/vein/challenge`,
      `{"userId":"{user_id}","slotIndex":${s.idx}}`,
      { x: s.x, y: 1140 },
    );
    gb.link(`lm_btn_${s.idx}`, `${pfx}_api`);

    const noAck = attachUpdateAckBranch(gb, pfx, `${pfx}_api`, `${pfx}_res`, { editId: null, x: s.x, y: 1320 });
    const cOk = gb.cmp(`${pfx}_ok`, `{${pfx}_res.response.success}`, 'true', 'equal_to', { ignoreCase: true }, { x: s.x, y: 1500 });
    gb.link(noAck, cOk.condId);

    embedMsg(gb, `${pfx}_win`, {
      title: `{${pfx}_res.response.title}`,
      description: `{${pfx}_res.response.description}`,
      color: '#ec4899',
      imageUrl: `{${pfx}_res.response.battle_image_url}`,
      target: { editId: 'lm_ack' },
      action_id: 'lm_ack',
    }, { x: s.x - 140, y: 1700 });
    gb.link(cOk.yes, `${pfx}_win`);

    gb.advBtn(`${pfx}_logs_btn`, `${pfx}_win`, btnCfg('Xem Nhật Ký Trận Đấu', 'SECONDARY', 'su_wiki_scroll', '1', '1', 'hide'), { x: s.x - 140, y: 1900 });
    apiAction(
      gb,
      `${pfx}_log_api`,
      `${pfx}_log_res`,
      'POST',
      `${BACKEND_BASE}/api/vein/logs`,
      `{"battleId":"{${pfx}_res.response.battle_id}","userId":"{user_id}"}`,
      { x: s.x - 140, y: 2080 },
    );
    gb.link(`${pfx}_logs_btn`, `${pfx}_log_api`);

    const cLogOk = gb.cmp(`${pfx}_log_ok`, `{${pfx}_log_res.response.success}`, 'true', 'equal_to', { ignoreCase: true }, { x: s.x - 140, y: 2260 });
    gb.link(`${pfx}_log_api`, cLogOk.condId);

    embedMsg(gb, `${pfx}_log_msg`, {
      title: `{${pfx}_log_res.response.title}`,
      description: `{${pfx}_log_res.response.description}`,
      color: '#38bdf8',
      target: { reply: true },
    }, { x: s.x - 240, y: 2440 });
    gb.link(cLogOk.yes, `${pfx}_log_msg`);

    embedMsg(gb, `${pfx}_log_err`, {
      title: `${uidEm('su_wiki_scroll')} NHẬT KÝ CHIẾN BÁO LINH MẠCH`,
      description: 'Không thể tải nhật ký trận đấu lúc này. Vui lòng thử lại sau vài giây!',
      color: '#E74C3C',
      target: { reply: true },
    }, { x: s.x - 40, y: 2440 });
    gb.link(cLogOk.no, `${pfx}_log_err`);

    embedMsg(gb, `${pfx}_err`, {
      title: `${uidEm('vein_mine_sp')} KHÔNG THỂ CHIẾM MỎ #${s.idx}`,
      description: `{${pfx}_res.response.message}`,
      color: '#E74C3C',
      target: { reply: true },
    }, { x: s.x + 140, y: 1700 });
    gb.link(cOk.no, `${pfx}_err`);
  }

  return gb.elements();
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const cmds = [
    { name: 'party', els: buildPartyHotfixCmd() },
    { name: 'linhmach', els: buildLinhMachHotfixCmd() },
  ];

  for (const cmd of cmds) {
    validateTreeStrict(cmd.els, `/${cmd.name}`);
    console.log(`[Offline OK] /${cmd.name}: ${cmd.els.length} elements`);
  }

  if (dryRun) {
    console.log('[DryRun] v1.4.7b BotGhost hotfix validation passed cleanly!');
    return;
  }

  for (const cmd of cmds) {
    const res = await deployViaCDP({
      groupId: PROFILE_GROUP_ID,
      mode: 'command',
      name: cmd.name,
      elements: cmd.els,
      enabled: true,
    });
    console.log(`[Deployed] /${cmd.name}:`, JSON.stringify(res));
    if (!res?.ok || !res.canSave || (res.probText && !/No problems/i.test(res.probText)) || res.builderSaveRequired !== false) {
      throw new Error(`BotGhost deploy failed validation for /${cmd.name}: ${JSON.stringify(res)}`);
    }
    await new Promise((r) => setTimeout(r, 1200));
  }

  console.log('[v1.4.7b BotGhost Hotfix] ALL COMPLETE CLEANLY!');
}

main().catch((err) => {
  console.error('[v1.4.7b BotGhost Hotfix] FATAL:', err);
  process.exit(1);
});
