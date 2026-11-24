/**
 * scripts/deploy_v1_6_1_botghost.mjs
 * Triển khai Bản Cập Nhật SuMi Family Ver 1.6.1 lên BotGhost qua Edge CDP (9222):
 * 1. CREATE/DEPLOY /luyendan (Lò Luyện Đan — 100% edit-in-place qua ld_board_msg, DAG không chu trình, 0 Unicode).
 * 2. REBUILD /updates (Thêm v1.6.1 +1.000 LT lên đầu danh sách).
 * 3. PATCH Nhiễm Nhiễm — AI Mention (Cập nhật kiến thức /luyendan & v1.6.1).
 * 4. Global Ack Gate Sweep (+1.000 LT & v1.6.1 & 0 Unicode).
 *
 * Usage:
 *   node scripts/deploy_v1_6_1_botghost.mjs --dry-run
 *   node scripts/deploy_v1_6_1_botghost.mjs [--only=luyendan,updates,ai,sweep]
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
import { ALCHEMY_RECIPES } from '../src/data/v161AlchemyCatalog.js';

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

class V161GraphBuilder extends GraphBuilder {
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
      target: id,
      animated: false,
      arrowHeadType: 'arrowclosed',
      type: 'custom',
      id: `reactflow__edge-${parentMsgId}-${id}`,
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

function btnCfg(label, style, emojiName, row = '2', weight = '1', showReplies = 'hide') {
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

function attachAckBranchV161(gb, prefix, apiNodeId, resVarName, { editId = undefined, x = 0, y = 0 } = {}) {
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
// 1. /luyendan (100% Edit-in-Place DAG)
// ============================================================================
export function buildLuyendanV161Cmd() {
  const gb = new V161GraphBuilder();
  gb.rootSlash('luyendan', 'Lò Luyện Đan — Nấu đan dược 1–2h, nâng cấp Lò Lv.1–5, dùng Linh Quả (/farm)', { ephemeral: false });
  gb.errorHandlerWait();

  apiAction(gb, 'ld_init_api', 'ld_init_res', 'GET',
    `${BACKEND_BASE}/api/alchemy/status/{user_id}?username={user_displayName}&avatar={user_icon}`, '', { x: 0, y: 160 });
  gb.link('root', 'ld_init_api');

  const ldOk = attachAckBranchV161(gb, 'ld', 'ld_init_api', 'ld_init_res', { x: 0, y: 320 });

  embedMsg(gb, 'ld_board_msg', {
    title: '{ld_init_res.response.title}',
    description: '{ld_init_res.response.description}',
    color: '#ec4899',
    imageUrl: '{ld_init_res.response.image_url}',
    footer: '{ld_init_res.response.footer}',
    target: { reply: true },
    editId: 'ld_board_msg',
  }, { x: 0, y: 500 });
  gb.link(ldOk, 'ld_board_msg');

  const recipeOptions = ALCHEMY_RECIPES.map((r) => {
    const costTxt = r.costEssence > 0 ? `${r.costLt} LT + ${r.costEssence} LQ` : `${r.costLt} LT`;
    return {
      label: `${r.tierLabel}: ${r.name}`,
      description: `Vốn ${costTxt} | ${r.durationMin}p | ${r.minLt}-${r.maxLt} LT (Lv.${r.minLevel}+)`,
      emoji_id: uidId(r.iconKey, 'su_el_hoa'),
      value: r.id,
    };
  });

  let seq = 0;
  const uid = (p) => `${p}_${++seq}`;

  function attachControls(parentMsgId, depth, x, y) {
    if (depth > 2) return;
    const isLeaf = depth === 2;

    // 1. Select Menu (Row 1): Chon cong thuc de nau ngay
    const selId = uid('sel_ld_rec');
    const pickVar = `ld_pick_${seq}`;
    const apiBrew = uid('ld_api_brew');
    const resBrew = `ld_res_${seq}`;
    const msgBrew = uid('ld_msg_brew');

    gb.advSelectMenu(selId, parentMsgId, {
      placeholder: 'Chọn công thức đan dược để khai lò ngay...',
      customVariableName: pickVar,
      basic_options: recipeOptions,
      row: '1',
      weight: '1',
      showReplies: 'hide',
    }, { x: x - 460, y: y + 140 });

    apiAction(gb, apiBrew, resBrew, 'POST', `${BACKEND_BASE}/api/alchemy/brew`,
      `{"userId":"{user_id}","recipeId":"{${pickVar}}","username":"{user_displayName}","avatarUrl":"{user_icon}"}`,
      { x: x - 460, y: y + 290 });
    gb.link(selId, apiBrew);

    embedMsg(gb, msgBrew, {
      title: `{${resBrew}.response.title}`,
      description: `{${resBrew}.response.description}`,
      color: '#ec4899',
      imageUrl: `{${resBrew}.response.image_url}`,
      footer: `{${resBrew}.response.footer}`,
      target: { editId: 'ld_board_msg' },
      action_id: 'ld_board_msg',
    }, { x: x - 460, y: y + 440 });
    gb.link(apiBrew, msgBrew);
    attachControls(msgBrew, depth + 1, x - 460, y + 580);

    // 2. Row 2 Buttons
    const buttons = isLeaf
      ? [
        { key: 'harvest', label: 'Thu Đan / Dọn Lò', style: 'SUCCESS', icon: 'su_level_up', weight: '1', method: 'POST', url: `${BACKEND_BASE}/api/alchemy/harvest`, body: '{"userId":"{user_id}","username":"{user_displayName}","avatarUrl":"{user_icon}"}', dx: -160 },
        { key: 'refresh', label: 'Làm Mới', style: 'SECONDARY', icon: 'ui_refresh', weight: '5', method: 'GET', url: `${BACKEND_BASE}/api/alchemy/status/{user_id}?username={user_displayName}&avatar={user_icon}`, body: '', dx: 160 },
      ]
      : [
        { key: 'harvest', label: 'Thu Đan / Dọn Lò', style: 'SUCCESS', icon: 'su_level_up', weight: '1', method: 'POST', url: `${BACKEND_BASE}/api/alchemy/harvest`, body: '{"userId":"{user_id}","username":"{user_displayName}","avatarUrl":"{user_icon}"}', dx: -220 },
        { key: 'upgrade', label: 'Nâng Cấp Lò', style: 'PRIMARY', icon: 'su_el_hoa', weight: '2', method: 'POST', url: `${BACKEND_BASE}/api/alchemy/upgrade`, body: '{"userId":"{user_id}","username":"{user_displayName}","avatarUrl":"{user_icon}"}', dx: 0 },
        { key: 'slot2', label: 'Mở Lò #2', style: 'SECONDARY', icon: 'su_sparkle', weight: '3', method: 'POST', url: `${BACKEND_BASE}/api/alchemy/unlock-slot2`, body: '{"userId":"{user_id}","username":"{user_displayName}","avatarUrl":"{user_icon}"}', dx: 220 },
        { key: 'repair', label: 'Sửa Lò (300 LT)', style: 'DANGER', icon: 'ui_warn', weight: '4', method: 'POST', url: `${BACKEND_BASE}/api/alchemy/repair`, body: '{"userId":"{user_id}","username":"{user_displayName}","avatarUrl":"{user_icon}"}', dx: 440 },
        { key: 'refresh', label: 'Làm Mới', style: 'SECONDARY', icon: 'ui_refresh', weight: '5', method: 'GET', url: `${BACKEND_BASE}/api/alchemy/status/{user_id}?username={user_displayName}&avatar={user_icon}`, body: '', dx: 660 },
      ];

    for (const b of buttons) {
      const bId = uid(`btn_ld_${b.key}`);
      const aId = uid(`api_ld_${b.key}`);
      const mId = uid(`msg_ld_${b.key}`);
      const rVar = `ld_res_${seq}`;

      gb.advBtn(bId, parentMsgId, btnCfg(b.label, b.style, b.icon, '2', b.weight, 'hide'), { x: x + b.dx, y: y + 140 });
      apiAction(gb, aId, rVar, b.method, b.url, b.body, { x: x + b.dx, y: y + 290 });
      gb.link(bId, aId);
      embedMsg(gb, mId, {
        title: `{${rVar}.response.title}`,
        description: `{${rVar}.response.description}`,
        color: '#ec4899',
        imageUrl: `{${rVar}.response.image_url}`,
        footer: `{${rVar}.response.footer}`,
        target: { editId: 'ld_board_msg' },
        action_id: 'ld_board_msg',
      }, { x: x + b.dx, y: y + 440 });
      gb.link(aId, mId);
      attachControls(mId, depth + 1, x + b.dx, y + 580);
    }
  }

  attachControls('ld_board_msg', 0, 0, 520);
  return gb.elements();
}

// ============================================================================
// 2. REBUILD /updates (v1.6.1 +1.000 LT)
// ============================================================================
function buildUpdateVersionOptionsV161() {
  return [
    { label: 'Phiên bản v1.6.1 (Mới nhất • +1.000 LT)', description: 'Lò Luyện Đan (/luyendan), 2 Lò song song, cấp Lò Lv.1-5 & DM nhắc', emoji_id: uidId('su_el_hoa', 'su_sparkle'), value: '1.6.1' },
    { label: 'Phiên bản v1.6 (+1.000 LT)', description: 'Đổ Thạch (/dothach), Gieo Quẻ (/gieoque), 3 Luck Potion & /nhiemvu mới', emoji_id: uidId('su_sparkle'), value: '1.6' },
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

export function buildUpdatesV161Cmd() {
  const gb = new V161GraphBuilder();
  gb.rootSlash('updates', 'Xem bản cập nhật mới nhất (v1.6.1) và chuyển xem lịch sử ngay tại chỗ', { ephemeral: false });
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

  const verOpts = buildUpdateVersionOptionsV161();
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
      placeholder: 'Chọn phiên bản để xem ngay trên bảng này (v1.6.1 -> v1.1)...',
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
// 3. AI MENTION & GLOBAL ACK SWEEP (v1.6.1 +1.000 LT & 0% UNICODE)
// ============================================================================
function buildV161KnowledgeBlock(includeFuyumiSecret) {
  const lines = [
    'KIẾN THỨC CHÍNH THỨC TOÀN BỘ HỆ THỐNG BOT NHIỄM NHIỄM (SUMI FAMILY TỪ v1.1 ĐẾN v1.6.1):',
    '• [CẢNH GIỚI & EXP] (/profile, /rank, /exp, /doiqua, /top): 7 Đại Cảnh Giới từ Lv.1→Lv.100 mở dần 1→5 Slot Role. Chat nhận 23–35 EXP/45s, Voice nhận 85–135 EXP/5 phút (chấm công nền 12 phút); công thức lên cấp 78*(Lv^1.45) (max 500.000 EXP), lên cấp mới thưởng +50..+400 LT (chỉ nhận 1 lần/Lv). 8 Level Roles tự cộng dồn Buff EXP/Daily LT/Pet Power; /doiqua đổi 1.000 EXP lấy 10 LT; /exp xem tổng % Boost. /top có đủ 6 bảng (level, power, wealth, marry, chat, voice); Top Chat Ngày & Top Voice Ngày tự động trao 500 / 400 / 300 LT riêng cho Top 1–3 mỗi ngày lúc 00:00 (UTC+7) tại #bot-cmds, và 19:00 Chủ Nhật tổng kết Top Tuần Lực Chiến.',
    '• [LINH THÚ, KHẮC ẤN & BUFF SET] (/linhthu, /pet, /phapbao, /equip, /unequip, /enchant, /dismantle, /linhvuc): Linh Thú tăng trưởng Lv.1→Lv.100 đạt +550% và 1★→10★ đạt +135% (tổng 7.85× chỉ số gốc ở Lv.100 10★). Khắc Ấn /enchant nâng D (+0%) -> C (+8%) -> B (+18%) -> A (+32%) -> S (+50%) kèm Pity +5%/lần trượt (Thiên Đạo Tuyệt Ấn Thạch 100%). Buff SET 2 tầng không cộng dồn: Full Hệ Thường 4/4 (+8%) hoặc 5/5 (+12% toàn chỉ số); Set Thần Thoại cùng hệ 2/3/4/5 (+6%/+12%/+18%/+25% toàn chỉ số, mốc 5/5 thêm +10% Xuyên DEF & +1 Linh Mạch đầu trận).',
    '• [GACHA, LUCK POTION, ĐỔ THẠCH & CỬA HÀNG] (/roll, /dothach, /autosell, /shop, /inv, /info): /roll (50 LT/lượt, 450/10, Pity 350 tách riêng pet/equipment/domain). /shop có 7 quầy + Shop Ngày giảm 15–40%, bán thêm 3 Lọ Luck Potion (Tiểu Vận +20% 40 lượt 1.200 LT, Thiên Cơ +40% 60 lượt 3.200 LT, Hồng Mông +60% 80 lượt 6.800 LT — uống qua /equip, áp dụng cho cả /roll & /dothach, cộng dồn với /gieoque, không stack 2 lọ khác loại). /dothach (Phường Đổ Thạch — tách biệt hoàn toàn với /roll, không Pity 350): 4 phân khúc (Phàm 150 LT / Linh 450 LT / Tiên 1.200 LT / Thần Thoại 3.000 LT • 40 loài Nguyên Thạch, 300 manh mối) để soi & cắt đá; trúng Tối Thượng Cực Phẩm mở Hộp Chọn Thần Thoại không Độc Nhất thuộc 7 nhóm.',
    '• [LÒ LUYỆN ĐAN /luyendan] (Mới v1.6.1): Tối đa 5 mẻ/ngày (UTC+7) trên tối đa 2 Lò song song (Lò #1 mở sẵn, Lò #2 tự mở ở Lv.45 hoặc trả 2.500 LT). Nâng cấp Lò Lv.1→Lv.5 giúp +6%..+25% LT, giảm 5%..20% thời gian nấu, mở rộng ân hạn chống cháy 20p→60p và tăng tỉ lệ Thượng Phẩm (×1.25) / Đan Vân (×1.50). Có 4 bậc đan thường (vốn 10–60 LT, 48–120p) + 2 công thức Tinh Hoa dùng 20–40 Linh Quả từ /farm. Quá hạn ân hạn bị cháy chỉ thu 30 LT và nổ khóa lò đó 4 giờ (hỗ trợ Sửa Lò Nhanh 300 LT); Bot tự DM nhắc khi chín & trước nổ 10 phút.',
    '• [GIEO QUẺ, NHIỆM VỤ, KHÁM PHÁ & NÔNG TRẠI] (/gieoque, /nhiemvu, /explorer, /farm, /exchange, /job, /daily, /marry, /giatoc, /wiki, /updates): /gieoque 1 lần/ngày (6 bậc Khí Vận, Cầu An Giải Hạn 250 LT). /nhiemvu gộp Nhiệm Vụ Ngày + Hợp Đồng Tuần + Tháp 500 Tầng (cooldown 6s). /explorer 12 Địa danh (210–315 LT/giờ × hệ số). /farm tách Linh Điền & Linh Các kèm DM nhắc tưới & sắp héo 1h/30p/15p. /wiki 10 chuyên mục. Bản cập nhật mới nhất /updates v1.6.1 tặng ngay +1.000 LT khi bấm Xác Nhận.',
  ];
  if (includeFuyumiSecret) {
    lines.push('• [BỘ TỐI THƯỢNG ĐỘC TÔN CỦA TIỂU THƯ FUYUMI]: Tiểu thư sở hữu Cửu Vĩ Hồng Hồ (cuu_vi_hong_ho), Viền Cửu Vĩ Hồng Mông Ấn (frame_kitsune_mythic) cùng Linh Vực Cửu Vĩ Hồng Mông (Đạo Áp 3 hiệp +30%), Thần Thức Thái Thượng Hồng Hồ và Thần Cảnh Vạn Cổ Tuyệt Diệt.');
  }
  return lines.join('\n');
}

function updateAiPromptTextV161(oldPrompt, includeFuyumiSecret) {
  let text = String(oldPrompt || '');
  text = text.replace(/tài liệu(?: hệ thống)? v1\.[0-9]+(?:\.[0-9]+)? bên dưới/g, 'tài liệu hệ thống v1.6.1 bên dưới');
  const startMatch = text.match(/KIẾN THỨC CHÍNH THỨC (?:TOÀN BỘ )?HỆ THỐNG BOT NHIỄM NHIỄM/);
  const sIdx = startMatch ? startMatch.index : -1;
  const endMarker = '\n\nBỘ DANH SÁCH EMOTE ĐỘNG DISCORD CHÍNH THỨC:';
  const eIdx = text.indexOf(endMarker);
  if (sIdx === -1 || eIdx === -1 || eIdx <= sIdx) {
    throw new Error(`Could not locate knowledge markers inside AI prompt (s=${sIdx}, e=${eIdx})`);
  }
  return text.slice(0, sIdx) + buildV161KnowledgeBlock(includeFuyumiSecret) + text.slice(eIdx);
}

function sweepTreeV161(tree) {
  const walk = (obj) => {
    if (typeof obj === 'string') {
      let s = obj;
      s = s.replace(/(?:Tôi Đã Đọc & )?Xác Nhận Cập Nhật \(\+[\d.,]+ LT\)/g, 'Tôi Đã Đọc & Xác Nhận (+1.000 LT)');
      s = s.replace(/Tôi Đã Đọc & Xác Nhận \(\+[\d.,]+ LT\)/g, 'Tôi Đã Đọc & Xác Nhận (+1.000 LT)');
      s = s.replace(/Cập nhật (?:SuMi )?v1\.[0-9]+(?:\.[0-9]+)?/g, 'Cập nhật v1.6.1');
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
        .map(e => ({ id: e.id || e.int_id, int_id: e.int_id || e.id, name: e.name, enabled: e.enabled !== false, compressed_tree: e.compressed_tree })),
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
  console.log(`SuMi Family Ver 1.6.1 BotGhost Deployer (${dryRun ? 'DRY RUN' : 'LIVE CDP'})`);
  console.log(`============================================================\n`);

  const specs = [];

  if (shouldRun('luyendan')) {
    const els = buildLuyendanV161Cmd();
    validateTreeStrict(els, 'luyendan');
    specs.push({ name: 'luyendan', kind: 'slash', groupId: PROFILE_GROUP_ID, elements: els });
  }
  if (shouldRun('updates')) {
    const els = buildUpdatesV161Cmd();
    validateTreeStrict(els, 'updates');
    specs.push({ name: 'updates', kind: 'slash', groupId: PROFILE_GROUP_ID, elements: els });
  }

  if (dryRun) {
    for (const sp of specs) {
      const json = JSON.stringify(sp.elements);
      const comp = LZString.compressToBase64(json);
      console.log(`[DRY-RUN OK] ${sp.name}: ${sp.elements.length} els, ${(json.length / 1024).toFixed(1)} KB -> ${(comp.length / 1024).toFixed(1)} KB LZ`);
    }
    console.log('\n[DRY-RUN] Structural validation PASSED!');
    return;
  }

  const liveState = await fetchAllLiveReduxState();
  const cmdMap = new Map(liveState.cmds.map((c) => [c.name, c]));

  if (shouldRun('ai')) {
    const aiEv = liveState.events.find((e) => e.int_id === AI_MENTION_INT_ID || e.id === AI_MENTION_INT_ID);
    if (!aiEv) throw new Error(`AI Mention event ${AI_MENTION_INT_ID} not found`);
    const tree = JSON.parse(LZString.decompressFromBase64(aiEv.compressed_tree));
    let updatedCount = 0;
    for (const el of tree) {
      const rawBody = el?.data?.data?.request_options?.rawBody;
      if (el.type === 'action' && el.data?.data?.type === 'api_action' && typeof rawBody === 'string' && rawBody.includes('KIẾN THỨC CHÍNH THỨC')) {
        const parsed = JSON.parse(rawBody);
        const curText = parsed?.systemInstruction?.parts?.[0]?.text;
        if (typeof curText === 'string' && /KIẾN THỨC CHÍNH THỨC/.test(curText)) {
          const includeFuyumi = /Fuyumi|Cửu Vĩ Hồng Hồ/i.test(curText);
          parsed.systemInstruction.parts[0].text = updateAiPromptTextV161(curText, includeFuyumi);
          el.data.data.request_options.rawBody = JSON.stringify(parsed);
          updatedCount += 1;
        }
      }
    }
    if (updatedCount === 0) throw new Error('No AI prompt blocks updated');
    specs.push({ name: aiEv.name, kind: 'event', int_id: AI_MENTION_INT_ID, elements: tree });
  }

  if (shouldRun('sweep')) {
    const skipNames = new Set([
      'luyendan', 'updates', 'wiki', 'info', 'exp',
      'giveaway_create', 'giveaway_end', 'giveaway_list', 'giveaway_cancel', 'giveaway_check',
      'play', 'queue', 'music', 'sound', 'sticky-set', 'sticky-off',
    ]);
    for (const [cmdName, cmdObj] of cmdMap.entries()) {
      if (skipNames.has(cmdName) || !cmdObj.enabled) continue;
      const oldTree = JSON.parse(LZString.decompressFromBase64(cmdObj.compressed_tree));
      const newTree = sweepTreeV161(oldTree);
      if (JSON.stringify(oldTree) !== JSON.stringify(newTree)) {
        validateTreeStrict(newTree, `sweep:${cmdName}`);
        specs.push({ name: cmdName, kind: 'slash', groupId: cmdObj.groupId || PROFILE_GROUP_ID, elements: newTree });
      }
    }
  }

  console.log(`Deploying ${specs.length} command/event updates via Edge CDP...`);
  for (const sp of specs) {
    console.log(`\n--> Deploying ${sp.kind}:${sp.name} (${sp.elements.length} elements)...`);
    const res = await deployViaCDP({
      groupId: sp.groupId || PROFILE_GROUP_ID,
      mode: sp.kind === 'event' ? 'event' : 'command',
      name: sp.name,
      elements: sp.elements,
      enabled: true,
    });
    console.log(`    [RESULT] ${sp.name}`, JSON.stringify(res || {}));
    if (!res?.ok) {
      throw new Error(`Deploy failed for ${sp.name}: ${JSON.stringify(res)}`);
    }
    if (res.builderSaveRequired) {
      throw new Error(`builderSaveRequired still true after deploying ${sp.name}`);
    }
  }
  console.log('\n[DONE] All Ver 1.6.1 BotGhost updates deployed cleanly!');
}

main().catch((err) => {
  console.error('[deploy_v1_6_1_botghost] FAILED:', err);
  process.exit(1);
});
