/**
 * scripts/deploy_v1_7_full_botghost.mjs
 * Đồng bộ toàn bộ SuMi Family Ver 1.7 lên BotGhost Dashboard qua Edge CDP (9222):
 * 1. /updates     — Phân trang [Trang Trước] [Trang Sau] (3 trang v1.7, KHÔNG meta) + [Nhận Quà v1.7] + chọn lịch sử v1.7..v1.1.
 * 2. /tienhoa     — Điện Tiến Hóa Chân Thần (40 Pet Độc Nhất Lv.40 & 8★) & Tab 2 Chế Tạo Hồng Mông (xác nhận 2 bước, KHÔNG /hiente).
 * 3. /shop_dacbiet— Shop Đặc Biệt Chủ Nhật (08:00–24:00 UTC+7): Đổi 750 LT = 1 TT, mua 13 món hiếm, mở Thẻ Chọn Thần Thoại 7 nhóm.
 * 4. /wiki        — Nâng cấp full v1.7: 150 Pet (4 Sub-Hub nút), 264 Pháp Bảo (3 nút × 4 menu), 161 Lãnh Địa (3 Sub-Hub nút), Roles & Glossary nút.
 * 5. /shop        — Cập nhật 24 Viền Avatar LT (+4 khung mới v1.7) & 16 Vật Phẩm Tiêu Hao (+2 Thẻ Bảo Vệ Farm/Luyện Đan).
 * 6. /explorer    — Bổ sung 3 nút chuyển nhanh [Bộ 1] [Bộ 2] [Bộ 3] đồng bộ với /inv.
 * 7. /dothach     — Đổi nhãn Hộp Chọn Tối Thượng Cực Phẩm -> Hộp Thần Thoại Cực Phẩm.
 * 8. AI Mention   — Nạp đầy đủ kiến thức Ver 1.7 cho bé bot Nhiễm Nhiễm (4cc5db30-029c-4a55-86e6-6e6850012afd).
 * 9. Global Sweep — Cập nhật toàn bộ nhãn nút Cổng Xác Nhận Cập Nhật sang v1.7 (Gói Quà Lớn).
 *
 * Usage:
 *   node scripts/deploy_v1_7_full_botghost.mjs --dry-run
 *   node scripts/deploy_v1_7_full_botghost.mjs [--only=updates,tienhoa,shop_dacbiet,wiki,shop,explorer,dothach,ai,sweep]
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
import { em, emId, tierEmojiKey } from '../src/config/emojiHelper.js';
import {
  EQUIPMENT_CATALOG,
  PET_CATALOG,
  DOMAIN_CATALOG,
  DIVINE_SENSE_CATALOG,
  DIVINE_REALM_CATALOG,
  AVATAR_FRAMES,
  SHOP_CONSUMABLES,
} from '../src/data/catalog.js';
import { WIKI_CATEGORIES } from '../src/services/wikiService.js';
import { SPECIAL_SHOP_CATALOG } from '../src/services/specialShopService.js';

const PROFILE_GROUP_ID = '1782127263978';
const BACKEND_BASE = 'https://sumi-profile-backend.onrender.com';
const AI_MENTION_INT_ID = '4cc5db30-029c-4a55-86e6-6e6850012afd';
const AUTHOR_ONLY_MSG = 'Chỉ người gọi lệnh mới được thao tác trên bảng này! Hãy tự gọi lệnh của bạn nhé.';
const ACK_BTN_LABEL_V17 = 'Xác Nhận v1.7 (Nhận Gói Quà Lớn!)';

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

class V17GraphBuilder extends GraphBuilder {
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
  fields = [],
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
        fields,
      }],
    },
  };
  if (editId) data.editId = editId;
  if (action_id) data.action_id = action_id;
  return gb.act(id, 'advanced_message', data, pos);
}

function btnCfg(label, style, emojiName, row = '1', weight = '1', showReplies = 'hide', whoCanPress = 'user') {
  const eid = uidId(emojiName);
  return {
    label,
    style,
    emoji_id: eid || undefined,
    orderComponent: true,
    row: String(row),
    weight: String(weight),
    showReplies,
    ...(style !== 'LINK' && whoCanPress ? { who_can_press: whoCanPress, who_can_press_message: AUTHOR_ONLY_MSG } : {}),
  };
}

function attachAckBranchV17(gb, prefix, apiNodeId, resVarName, { editId = undefined, x = 0, y = 0 } = {}) {
  const gate = gb.cmp(`${prefix}_gate`, `{${resVarName}.response.needs_update_ack}`, 'true', 'equal_to', { ignoreCase: true, option: '', not: false }, { x, y });
  gb.link(apiNodeId, gate.condId);

  const msgAck = `${prefix}_msg_ack`;
  const btnAck = `${prefix}_btn_ack`;
  const apiAck = `${prefix}_api_ack`;
  const msgDone = `${prefix}_msg_done`;

  embedMsg(gb, msgAck, {
    title: `{${resVarName}.response.update_title}`,
    description: `{${resVarName}.response.update_description}`,
    color: '#f43f5e',
    footer: '',
    target: editId ? { editId } : { reply: true },
    action_id: editId || undefined,
  }, { x: x - 260, y: y + 170 });
  gb.link(gate.yes, msgAck);

  gb.advBtn(btnAck, msgAck, btnCfg(ACK_BTN_LABEL_V17, 'SUCCESS', 'red_gold_crystal', '1', '1', 'show'), { x: x - 260, y: y + 340 });

  apiAction(gb, apiAck, `${prefix}_ack_res`, 'POST', `${BACKEND_BASE}/api/update/ack`,
    '{"userId":"{user_id}","username":"{user_displayName}","avatarUrl":"{user_icon}"}', { x: x - 260, y: y + 510 });
  gb.link(btnAck, apiAck);

  embedMsg(gb, msgDone, {
    title: `${uidEm('su_level_up')} XÁC NHẬN CẬP NHẬT v1.7 THÀNH CÔNG!`,
    description: `{${prefix}_ack_res.response.message}`,
    color: '#10b981',
    footer: '',
  }, { x: x - 260, y: y + 680 });
  gb.link(apiAck, msgDone);

  return gate.no;
}

function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ============================================================================
// 1. /updates — Paginated (Trang Trước / Trang Sau) + Nhận Quà v1.7 + Lịch Sử
// ============================================================================
export function buildUpdatesV17Cmd() {
  const gb = new V17GraphBuilder();
  gb.rootSlash('updates', 'Xem bản cập nhật mới nhất (v1.7 • 3 trang gọn + Gói Quà Lớn) và lịch sử cập nhật', { ephemeral: false });
  gb.errorHandlerWait();

  apiAction(gb, 'upds_api', 'upds_res', 'GET', `${BACKEND_BASE}/api/update?page=1`, '', { x: 0, y: 200 });
  gb.link('root', 'upds_api');

  embedMsg(gb, 'upds_msg_0', {
    title: '{upds_res.response.title}',
    description: '{upds_res.response.description}',
    color: '#f43f5e',
    footer: '',
    target: { reply: true },
    editId: 'upds_msg_0',
  }, { x: 0, y: 380 });
  gb.link('upds_api', 'upds_msg_0');

  // Shared ack reply chain triggered from Row 1 [Nhận Quà v1.7] button
  apiAction(gb, 'upds_claim_api', 'upds_claim_res', 'POST', `${BACKEND_BASE}/api/update/ack`,
    '{"userId":"{user_id}","username":"{user_displayName}","avatarUrl":"{user_icon}"}', { x: 700, y: 380 });
  embedMsg(gb, 'upds_claim_msg', {
    title: `${uidEm('su_level_up')} QUÀ MỞ BẢN CẬP NHẬT v1.7`,
    description: '{upds_claim_res.response.message}',
    color: '#10b981',
    footer: '',
    target: { reply: true },
  }, { x: 700, y: 560 });
  gb.link('upds_claim_api', 'upds_claim_msg');

  const verOpts = [
    { label: 'Phiên bản v1.7 (Mới nhất • Quà Lớn!)', description: 'Tiến Hóa Chân Thần (/tienhoa), +260 món, /shop_dacbiet, Gacha 0.65%', emoji_id: uidId('evo_crystal', 'su_sparkle'), value: '1.7' },
    { label: 'Phiên bản v1.6.1 (+1.500 LT)', description: 'Lò Luyện Đan 6 mẻ/ngày, /farm 8 ô, /inv 3 Loadouts', emoji_id: uidId('su_el_hoa', 'su_sparkle'), value: '1.6.1' },
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

  // Unroll 3-level pagination buttons [Trang Trước] [Trang Sau] [Nhận Quà v1.7]
  // BotGhost orderComponent sorts weight DESCENDING (3 = left, 2 = middle, 1 = right)
  let pSeq = 0;
  function attachPager(parentMsgId, prevResVar, depth, bx, by) {
    // Row 1 Rightmost (weight=1): [Nhận Quà v1.7]
    pSeq += 1;
    const claimBtnId = `btn_upds_claim_${pSeq}`;
    gb.advBtn(claimBtnId, parentMsgId, btnCfg('Nhận Quà v1.7', 'SUCCESS', 'red_gold_crystal', '1', '1', 'show'), { x: bx + 280, y: by + 130 });
    gb.link(claimBtnId, 'upds_claim_api');

    if (depth >= 3) return;
    for (const c of [
      { key: 'prev', label: 'Trang Trước', style: 'SECONDARY', icon: 'su_arrow_left', weight: '3', pageExpr: `{${prevResVar}.response.prev_page}`, dx: -170 },
      { key: 'next', label: 'Trang Sau', style: 'PRIMARY', icon: 'su_arrow_right', weight: '2', pageExpr: `{${prevResVar}.response.next_page}`, dx: 110 },
    ]) {
      pSeq += 1;
      const bId = `btn_upds_${c.key}_${pSeq}`;
      const aId = `api_upds_${c.key}_${pSeq}`;
      const rVar = `upds_pres_${pSeq}`;
      const mId = `msg_upds_${c.key}_${pSeq}`;
      gb.advBtn(bId, parentMsgId, btnCfg(c.label, c.style, c.icon, '1', c.weight, 'hide'), { x: bx + c.dx, y: by + 130 });
      apiAction(gb, aId, rVar, 'GET', `${BACKEND_BASE}/api/update/{${prevResVar}.response.version}?page=${c.pageExpr}`, '', { x: bx + c.dx, y: by + 270 });
      gb.link(bId, aId);
      embedMsg(gb, mId, {
        title: `{${rVar}.response.title}`,
        description: `{${rVar}.response.description}`,
        color: '#f43f5e',
        footer: '',
        target: { editId: 'upds_msg_0' },
        action_id: 'upds_msg_0',
      }, { x: bx + c.dx, y: by + 410 });
      gb.link(aId, mId);
      attachPager(mId, rVar, depth + 1, bx + c.dx, by + 560);
    }
  }
  attachPager('upds_msg_0', 'upds_res', 0, 0, 380);

  // Row 2 version history selector (4 sequential hops on upds_msg_0)
  let curVerMsg = 'upds_msg_0';
  for (let k = 1; k <= 4; k += 1) {
    const prevIdx = k - 1;
    const baseY = 380 + k * 540;
    const selId = `sel_upds_ver_${prevIdx}`;
    const varName = `picked_upd_ver_${prevIdx}`;
    const apiId = `upds_ver_api_${k}`;
    const resName = `upds_vres_${k}`;
    const msgId = `upds_vmsg_${k}`;

    gb.advSelectMenu(selId, curVerMsg, {
      placeholder: 'Xem lịch sử các phiên bản trước (v1.7 -> v1.1)...',
      customVariableName: varName,
      basic_options: verOpts,
      row: '2',
      weight: '1',
      showReplies: 'hide',
    }, { x: -750, y: baseY - 360 });

    apiAction(gb, apiId, resName, 'GET', `${BACKEND_BASE}/api/update/{${varName}}?page=1`, '', { x: -750, y: baseY - 180 });
    gb.link(selId, apiId);

    embedMsg(gb, msgId, {
      title: `{${resName}.response.title}`,
      description: `{${resName}.response.description}`,
      color: '#ec4899',
      footer: '',
      target: { editId: 'upds_msg_0' },
      action_id: 'upds_msg_0',
    }, { x: -750, y: baseY });
    gb.link(apiId, msgId);
    // Attach 1-step pager on switched version too (so switching back to v1.7 still paginates!)
    attachPager(msgId, resName, 2, -1100, baseY);
    curVerMsg = msgId;
  }

  return gb.elements();
}

// ============================================================================
// 2. /tienhoa — Điện Tiến Hóa Chân Thần & Chế Tạo Hồng Mông (NO /hiente)
// ============================================================================
export function buildTienHoaV17Cmd() {
  const gb = new V17GraphBuilder();
  gb.rootSlash('tienhoa', 'Điện Tiến Hóa Chân Thần (40 Pet Độc Nhất Lv.40 & 8★) & Chế Tạo Hồng Mông Tiến Hóa Tinh', { ephemeral: false });
  gb.errorHandlerWait();

  gb.option('che_do', 'string', 'Chế độ: xem (mặc định), tienhoa (Tab 1), chetao (Tab 2)', {
    required: false,
    choices: ['xem', 'tienhoa', 'chetao'],
    x: 420,
    y: 0,
  });
  gb.option('linh_thu', 'string', 'Mã/tên Pet Độc Nhất (Tab 1) hoặc Pet Thần Thoại thường để hiến phôi (Tab 2)', {
    required: false,
    x: 700,
    y: 0,
  });
  gb.option('muc_phi', 'string', 'Mức phí LT Tiến Hóa (60% -> 100%, mặc định 9.000 LT = 100%)', {
    required: false,
    choices: ['1000', '3000', '5000', '7000', '9000'],
    x: 980,
    y: 0,
  });

  embedMsg(gb, 'th_ack', {
    title: `${uidEm('evo_crystal', 'su_tier_toithuong')} Đang mở Điện Tiến Hóa Chân Thần...`,
    description: 'Đang kết nối dữ liệu Linh Thú Độc Nhất, Hồng Mông Tiến Hóa Tinh & Mảnh Hỗn Độn...',
    color: '#fb7185',
    target: { reply: true },
    editId: 'th_ack',
  }, { x: 0, y: 170 });
  gb.link('root', 'th_ack');

  const cMode = gb.cond('th_mode_cond', 'comparison', { base_value: '{option_che_do}', target: { self: true } }, { x: 0, y: 340 });
  gb.link('th_ack', cMode);
  const brEvo = gb.branch(cMode, 'th_br_evo', 'comparison', { type: 'equal_to', comparison_value: 'tienhoa', ignoreCase: true }, { x: -420, y: 500 });
  const brCraft = gb.branch(cMode, 'th_br_craft', 'comparison', { type: 'equal_to', comparison_value: 'chetao', ignoreCase: true }, { x: 420, y: 500 });
  const brHub = gb.elseBranch(cMode, 'th_br_hub', 'comparison', { x: 0, y: 500 });

  // --- Branch A: Hub ---
  apiAction(gb, 'th_hub_api', 'th_hub_res', 'GET', `${BACKEND_BASE}/api/tienhoa/hub/{user_id}`, '', { x: 0, y: 660 });
  gb.link(brHub, 'th_hub_api');
  const hubOk = attachAckBranchV17(gb, 'thh', 'th_hub_api', 'th_hub_res', { editId: 'th_ack', x: 0, y: 820 });
  embedMsg(gb, 'th_hub_msg', {
    title: '{th_hub_res.response.title}',
    description: '{th_hub_res.response.description}',
    color: '#fb7185',
    footer: 'Dùng /tienhoa che_do:tienhoa linh_thu:<mã_pet> muc_phi:9000 hoặc /tienhoa che_do:chetao linh_thu:<mã_pet_thần_thoại>',
    target: { editId: 'th_ack' },
    action_id: 'th_ack',
  }, { x: 0, y: 1020 });
  gb.link(hubOk, 'th_hub_msg');

  // --- Branch B: Tab 1 Evolve ---
  apiAction(gb, 'th_evo_api', 'th_evo_res', 'POST', `${BACKEND_BASE}/api/tienhoa/evolve`,
    '{"userId":"{user_id}","petType":"{option_linh_thu}","ltTier":"{option_muc_phi}"}', { x: -420, y: 660 });
  gb.link(brEvo, 'th_evo_api');
  const evoOk = attachAckBranchV17(gb, 'the', 'th_evo_api', 'th_evo_res', { editId: 'th_ack', x: -420, y: 820 });
  embedMsg(gb, 'th_evo_msg', {
    title: `${uidEm('evo_crystal', 'su_tier_toithuong')} KẾT QUẢ TIẾN HÓA CHÂN THẦN`,
    description: '{th_evo_res.response.message}',
    imageUrl: '{th_evo_res.response.evolved_image_url}',
    color: '#f43f5e',
    footer: '',
    target: { editId: 'th_ack' },
    action_id: 'th_ack',
  }, { x: -420, y: 1020 });
  gb.link(evoOk, 'th_evo_msg');

  // --- Branch C: Tab 2 Craft Hồng Mông (2-step confirmation!) ---
  apiAction(gb, 'th_craft_prev_api', 'th_cp_res', 'POST', `${BACKEND_BASE}/api/tienhoa/craft-crystal`,
    '{"userId":"{user_id}","targetPetType":"{option_linh_thu}","confirmed":false}', { x: 420, y: 660 });
  gb.link(brCraft, 'th_craft_prev_api');
  const craftOk = attachAckBranchV17(gb, 'thc', 'th_craft_prev_api', 'th_cp_res', { editId: 'th_ack', x: 420, y: 820 });

  const cConfirmReq = gb.cmp('th_cp_need', '{th_cp_res.response.requires_confirmation}', 'true', 'equal_to', { ignoreCase: true, option: '', not: false }, { x: 420, y: 1000 });
  gb.link(craftOk, cConfirmReq.condId);

  embedMsg(gb, 'th_cp_preview_msg', {
    title: `${uidEm('chaos_essence_shard', 'su_sparkle')} XÁC NHẬN CHẾ TẠO HỒNG MÔNG TIẾN HÓA TINH (BƯỚC 1/2)`,
    description: '{th_cp_res.response.message}',
    color: '#f59e0b',
    footer: 'Thao tác tiêu hủy vĩnh viễn Pet Thần Thoại phôi đã chọn — hãy kiểm tra kỹ trước khi xác nhận!',
    target: { editId: 'th_ack' },
    action_id: 'th_ack',
  }, { x: 280, y: 1180 });
  gb.link(cConfirmReq.yes, 'th_cp_preview_msg');

  gb.advBtn('th_btn_confirm_craft', 'th_cp_preview_msg', btnCfg('Xác Nhận Chế Tạo Hồng Mông', 'DANGER', 'evo_crystal', '1', '1', 'hide'), { x: 280, y: 1360 });
  apiAction(gb, 'th_craft_exec_api', 'th_ce_res', 'POST', `${BACKEND_BASE}/api/tienhoa/craft-crystal`,
    '{"userId":"{user_id}","targetPetId":"{th_cp_res.response.target_pet_id}","targetPetType":"{option_linh_thu}","confirmed":true}', { x: 280, y: 1540 });
  gb.link('th_btn_confirm_craft', 'th_craft_exec_api');

  embedMsg(gb, 'th_craft_done_msg', {
    title: `${uidEm('evo_crystal', 'su_tier_toithuong')} CHẾ TẠO HỒNG MÔNG TIẾN HÓA TINH`,
    description: '{th_ce_res.response.message}',
    color: '#10b981',
    footer: '',
    target: { editId: 'th_ack' },
    action_id: 'th_ack',
  }, { x: 280, y: 1720 });
  gb.link('th_craft_exec_api', 'th_craft_done_msg');

  embedMsg(gb, 'th_cp_err_msg', {
    title: `${uidEm('chaos_essence_shard', 'su_sparkle')} CHẾ TẠO HỒNG MÔNG TIẾN HÓA TINH`,
    description: '{th_cp_res.response.message}',
    color: '#ef4444',
    footer: '',
    target: { editId: 'th_ack' },
    action_id: 'th_ack',
  }, { x: 640, y: 1180 });
  gb.link(cConfirmReq.no, 'th_cp_err_msg');

  return gb.elements();
}

// ============================================================================
// 3. /shop_dacbiet — Shop Đặc Biệt Chủ Nhật (08:00–24:00 UTC+7)
// ============================================================================
export function buildShopDacBietV17Cmd() {
  const gb = new V17GraphBuilder();
  gb.rootSlash('shop_dacbiet', 'Shop Đặc Biệt Chủ Nhật (08:00–24:00 UTC+7): Đổi 750 LT = 1 TT, mua 13 món hiếm & Thẻ Chọn Thần Thoại', { ephemeral: false });
  gb.errorHandlerWait();

  gb.option('thao_tac', 'string', 'Thao tác: xem (mặc định), doi_tt (đổi LT->TT), mo_the (mở Thẻ Chọn Thần Thoại)', {
    required: false,
    choices: ['xem', 'doi_tt', 'mo_the'],
    x: 420,
    y: 0,
  });
  gb.option('so_luong_tt', 'int', 'Số Tinh Thể Đỏ Vàng muốn đổi (tối thiểu 5 TT, tối đa 200 TT/tuần)', {
    required: false,
    x: 700,
    y: 0,
  });
  gb.option('nhom_the', 'string', 'Nhóm cho Thẻ Chọn Thần Thoại (pet/weapon/gem/soul/domain/sense/realm)', {
    required: false,
    choices: ['pet', 'weapon', 'gem', 'soul', 'domain', 'sense', 'realm'],
    x: 980,
    y: 0,
  });

  embedMsg(gb, 'ss_ack', {
    title: `${uidEm('red_gold_crystal', 'su_sparkle')} Đang mở Shop Đặc Biệt Chủ Nhật...`,
    description: 'Đang kiểm tra lịch mở cửa (Chủ Nhật 08:00–24:00 UTC+7), số dư TT và gian hàng hiếm...',
    color: '#f59e0b',
    target: { reply: true },
    editId: 'ss_ack',
  }, { x: 0, y: 170 });
  gb.link('root', 'ss_ack');

  const cOp = gb.cond('ss_op_cond', 'comparison', { base_value: '{option_thao_tac}', target: { self: true } }, { x: 0, y: 340 });
  gb.link('ss_ack', cOp);
  const brConv = gb.branch(cOp, 'ss_br_conv', 'comparison', { type: 'equal_to', comparison_value: 'doi_tt', ignoreCase: true }, { x: -460, y: 500 });
  const brSel = gb.branch(cOp, 'ss_br_sel', 'comparison', { type: 'equal_to', comparison_value: 'mo_the', ignoreCase: true }, { x: 460, y: 500 });
  const brView = gb.elseBranch(cOp, 'ss_br_view', 'comparison', { x: 0, y: 500 });

  // --- Direct Convert Option ---
  apiAction(gb, 'ss_conv_api', 'ss_conv_res', 'POST', `${BACKEND_BASE}/api/special-shop/convert`,
    '{"userId":"{user_id}","ttAmount":"{option_so_luong_tt}"}', { x: -460, y: 660 });
  gb.link(brConv, 'ss_conv_api');
  const convOk = attachAckBranchV17(gb, 'ssc', 'ss_conv_api', 'ss_conv_res', { editId: 'ss_ack', x: -460, y: 820 });
  embedMsg(gb, 'ss_conv_msg', {
    title: `${uidEm('red_gold_crystal', 'su_sparkle')} QUY ĐỔI TINH THỂ ĐỎ VÀNG (TT)`,
    description: '{ss_conv_res.response.message}',
    color: '#f59e0b',
    footer: '',
    target: { editId: 'ss_ack' },
    action_id: 'ss_ack',
  }, { x: -460, y: 1020 });
  gb.link(convOk, 'ss_conv_msg');

  // --- Direct Open Selector Option ---
  apiAction(gb, 'ss_sel_api', 'ss_sel_res', 'POST', `${BACKEND_BASE}/api/special-shop/open-selector`,
    '{"userId":"{user_id}","category":"{option_nhom_the}"}', { x: 460, y: 660 });
  gb.link(brSel, 'ss_sel_api');
  const selOk = attachAckBranchV17(gb, 'sss', 'ss_sel_api', 'ss_sel_res', { editId: 'ss_ack', x: 460, y: 820 });
  embedMsg(gb, 'ss_sel_msg', {
    title: `${uidEm('mythic_selector_card', 'su_tier_thanthoai')} MỞ THẺ CHỌN THẦN THOẠI`,
    description: '{ss_sel_res.response.message}',
    color: '#ec4899',
    footer: '',
    target: { editId: 'ss_ack' },
    action_id: 'ss_ack',
  }, { x: 460, y: 1020 });
  gb.link(selOk, 'ss_sel_msg');

  // --- Main Hub View ---
  apiAction(gb, 'ss_hub_api', 'ss_hub_res', 'GET', `${BACKEND_BASE}/api/special-shop/{user_id}`, '', { x: 0, y: 660 });
  gb.link(brView, 'ss_hub_api');
  const hubOk = attachAckBranchV17(gb, 'ssh', 'ss_hub_api', 'ss_hub_res', { editId: 'ss_ack', x: 0, y: 820 });
  embedMsg(gb, 'ss_hub_msg', {
    title: '{ss_hub_res.response.title}',
    description: '{ss_hub_res.response.description}',
    color: '#f59e0b',
    footer: 'Mở cửa Chủ Nhật 08:00–24:00 UTC+7 • Đổi số lượng tùy ý bằng /shop_dacbiet thao_tac:doi_tt so_luong_tt:<5..200>',
    target: { editId: 'ss_ack' },
    action_id: 'ss_ack',
  }, { x: 0, y: 1020 });
  gb.link(hubOk, 'ss_hub_msg');

  // Row 1: Select menu for all 13 special items
  const ssItemOpts = SPECIAL_SHOP_CATALOG.map((it) => ({
    label: `${it.name} (${it.price_tt} TT)`,
    description: `${it.lifetime_limit ? `Tối đa ${it.lifetime_limit}/vĩnh viễn` : `Tối đa ${it.weekly_limit}/tuần`} • ${String(it.description || '').slice(0, 60)}`,
    emoji_id: uidId(it.item_id, 'red_gold_crystal'),
    value: it.item_id,
  }));
  gb.advSelectMenu('sel_ss_buy', 'ss_hub_msg', {
    placeholder: 'Chọn 1 trong 13 vật phẩm Shop Đặc Biệt để mua bằng TT...',
    customVariableName: 'picked_ss_item',
    basic_options: ssItemOpts,
    row: '1',
    weight: '1',
    showReplies: 'show',
  }, { x: -240, y: 1200 });
  apiAction(gb, 'ss_buy_api', 'ss_buy_res', 'POST', `${BACKEND_BASE}/api/special-shop/buy`,
    '{"userId":"{user_id}","itemId":"{picked_ss_item}","qty":1}', { x: -240, y: 1380 });
  gb.link('sel_ss_buy', 'ss_buy_api');
  embedMsg(gb, 'ss_buy_msg', {
    title: `${uidEm('red_gold_crystal', 'su_sparkle')} GIAO DỊCH SHOP ĐẶC BIỆT`,
    description: '{ss_buy_res.response.message}',
    color: '#10b981',
    footer: '',
    target: { reply: true },
  }, { x: -240, y: 1560 });
  gb.link('ss_buy_api', 'ss_buy_msg');

  // Row 2: Quick Convert buttons (weight DESC: 10 TT = 3 left, 50 TT = 2 middle, 100 TT = 1 right)
  const quickConverts = [
    { key: '10', label: 'Đổi 10 TT (7.5k LT)', tt: 10, weight: '3', dx: 40 },
    { key: '50', label: 'Đổi 50 TT (37.5k LT)', tt: 50, weight: '2', dx: 260 },
    { key: '100', label: 'Đổi 100 TT (75k LT)', tt: 100, weight: '1', dx: 480 },
  ];
  for (const qc of quickConverts) {
    const bId = `btn_ss_conv_${qc.key}`;
    const aId = `api_ss_conv_${qc.key}`;
    const rVar = `ss_qc_res_${qc.key}`;
    const mId = `msg_ss_conv_${qc.key}`;
    gb.advBtn(bId, 'ss_hub_msg', btnCfg(qc.label, 'PRIMARY', 'red_gold_crystal', '2', qc.weight, 'show'), { x: qc.dx, y: 1200 });
    apiAction(gb, aId, rVar, 'POST', `${BACKEND_BASE}/api/special-shop/convert`,
      `{"userId":"{user_id}","ttAmount":${qc.tt}}`, { x: qc.dx, y: 1380 });
    gb.link(bId, aId);
    embedMsg(gb, mId, {
      title: `${uidEm('red_gold_crystal', 'su_sparkle')} QUY ĐỔI ${qc.tt} TINH THỂ ĐỎ VÀNG`,
      description: `{${rVar}.response.message}`,
      color: '#f59e0b',
      footer: '',
      target: { reply: true },
    }, { x: qc.dx, y: 1560 });
    gb.link(aId, mId);
  }

  // Row 3: Select group to open Mythic Selector Card
  const selectorGroupOpts = [
    { label: 'Linh Thú Thần Thoại', description: 'Ưu tiên Linh Thú Thần Thoại thường chưa sở hữu', emoji_id: uidId('su_pet_paw'), value: 'pet' },
    { label: 'Vũ Khí Thần Thoại', description: 'Ưu tiên Vũ Khí Thần Thoại thường chưa sở hữu', emoji_id: uidId('su_crossed_swords'), value: 'weapon' },
    { label: 'Bảo Ngọc Thần Thoại', description: 'Ưu tiên Bảo Ngọc Thần Thoại thường chưa sở hữu', emoji_id: uidId('su_linhthach'), value: 'gem' },
    { label: 'Chiến Hồn Thần Thoại', description: 'Ưu tiên Chiến Hồn Thần Thoại thường chưa sở hữu', emoji_id: uidId('su_thunder_hax'), value: 'soul' },
    { label: 'Linh Vực Thần Thoại', description: 'Ưu tiên Linh Vực Thần Thoại thường chưa sở hữu', emoji_id: uidId('su_realm_star'), value: 'domain' },
    { label: 'Thần Thức Thần Thoại', description: 'Ưu tiên Thần Thức Thần Thoại thường chưa sở hữu', emoji_id: uidId('su_realm_star'), value: 'sense' },
    { label: 'Thần Cảnh Thần Thoại', description: 'Ưu tiên Thần Cảnh Thần Thoại thường chưa sở hữu', emoji_id: uidId('dao_ap_crest', 'su_realm_star'), value: 'realm' },
  ];
  gb.advSelectMenu('sel_ss_open_card', 'ss_hub_msg', {
    placeholder: 'Mở Thẻ Chọn Thần Thoại — chọn 1/7 nhóm (ưu tiên món chưa có)...',
    customVariableName: 'picked_ss_card_group',
    basic_options: selectorGroupOpts,
    row: '3',
    weight: '1',
    showReplies: 'show',
  }, { x: 740, y: 1200 });
  apiAction(gb, 'ss_card_api', 'ss_card_res', 'POST', `${BACKEND_BASE}/api/special-shop/open-selector`,
    '{"userId":"{user_id}","category":"{picked_ss_card_group}"}', { x: 740, y: 1380 });
  gb.link('sel_ss_open_card', 'ss_card_api');
  embedMsg(gb, 'ss_card_msg', {
    title: `${uidEm('mythic_selector_card', 'su_tier_thanthoai')} KẾT QUẢ MỞ THẺ CHỌN THẦN THOẠI`,
    description: '{ss_card_res.response.message}',
    color: '#ec4899',
    footer: '',
    target: { reply: true },
  }, { x: 740, y: 1560 });
  gb.link('ss_card_api', 'ss_card_msg');

  return gb.elements();
}

// ============================================================================
// 4. /wiki — Upgraded 100% Ver 1.7 (150 Pets, 264 Equip, 161 Domains, Button Sub-Hubs)
// ============================================================================
function buildEquipmentDropdownOptions(items) {
  return items.map((it) => ({
    label: `${it.item_name}`,
    description: `${it.rarity} • ${it.element} • ${it.hax_skill || 'Nội tại cơ bản'}`,
    emoji_id: uidId(it.item_id, tierEmojiKey(it.rarity_key)),
    value: it.item_id,
  }));
}

function buildPetDropdownOptions(pets) {
  return pets.map((p) => ({
    label: `${p.pet_name}${p.is_kemonomimi ? ' (Thú Nhân)' : ''}`,
    description: `${p.rarity} • ${p.element} • ${p.hax_skill}`,
    emoji_id: uidId(p.pet_type, 'su_pet_paw'),
    value: p.pet_type,
  }));
}

function buildDomainDropdownOptions(items, kind) {
  return items.map((it) => {
    if (kind === 'domain') {
      return {
        label: `${it.name} (${it.element})`,
        description: `${it.rarity} • ${it.base_energy} Mạch${it.is_unique ? ' • Độc Nhất' : ''}`,
        emoji_id: uidId(it.domain_id, 'su_realm_star'),
        value: it.domain_id,
      };
    }
    if (kind === 'sense') {
      return {
        label: it.name,
        description: `${it.rarity} • +${it.bonus_energy} Mạch • +${Math.round((it.buff_boost_pct || 0) * 100)}% Buff Vực`,
        emoji_id: uidId(it.sense_id, 'su_realm_star'),
        value: it.sense_id,
      };
    }
    return {
      label: it.name,
      description: `${it.rarity} • +${Math.round((it.debuff_boost_pct || 0) * 100)}% Debuff Vực`,
      emoji_id: uidId(it.realm_id, 'dao_ap_crest'),
      value: it.realm_id,
    };
  });
}

export function buildWikiV17Cmd() {
  const gb = new V17GraphBuilder();
  gb.rootSlash('wiki', 'Cẩm nang tu tiên SuMi Family v1.7 — 10 mục, 161 Lãnh Địa, 150 Pet, 264 Pháp Bảo & 40 Ultimate', { ephemeral: false });
  gb.errorHandlerWait();

  gb.option('chuyen_muc', 'string', 'Chuyên mục cần tra cứu (tùy chọn)', {
    required: false,
    choices: ['overview', 'realms', 'battle', 'equipment', 'pets', 'domains', 'roles', 'economy', 'explorer', 'glossary'],
    x: 420,
    y: 0,
  });

  const eqEmb = WIKI_CATEGORIES.equipment;
  const ptEmb = WIKI_CATEGORIES.pets;
  const domEmb = WIKI_CATEGORIES.domains;

  const wikiOptions = [
    { label: 'Tổng Quan & Toàn Bộ Lệnh (v1.7)', description: '/tienhoa, /shop_dacbiet, Gacha 0.65%, Buff SET & Tiện Ích', emoji_id: uidId('su_wiki_scroll'), value: 'overview' },
    { label: 'Cảnh Giới & Thăng Cấp EXP', description: '7 Đại Cảnh Giới, Chat/Voice EXP & 78 × Level^1.45', emoji_id: uidId('su_realm_7_hondondao'), value: 'realms' },
    { label: 'Đấu Trường, Ultimate & Cộng Dồn HAX', description: '40 Skill Ultimate, Cộng Dồn DoT/Debuff, Bất Tử & Ngũ Vực', emoji_id: uidId('su_arena'), value: 'battle' },
    { label: 'Kho Pháp Bảo Loadout (264 Món)', description: '90 Vũ Khí • 87 Bảo Ngọc • 87 Chiến Hồn + Khắc Ấn D->S', emoji_id: uidId('su_crossed_swords'), value: 'equipment' },
    { label: 'Linh Thú Tiên Giới (150 Pet • 40 Ult)', description: '40 Độc Nhất Tiến Hóa Chân Thần, 10 Thú Nhân & 110 Linh Thú', emoji_id: uidId('su_pet_paw'), value: 'pets' },
    { label: 'Lãnh Địa • Thần Thức • Thần Cảnh (161)', description: '65 Linh Vực • 48 Thần Thức • 48 Thần Cảnh & Chủ Độc Nhất', emoji_id: uidId('su_realm_star'), value: 'domains' },
    { label: 'Role Quyền Năng & Chức Năng (Button)', description: '40 Role + 8 Cảnh Giới & Nút Chi Tiết Chức Năng', emoji_id: uidId('su_medal_role'), value: 'roles' },
    { label: 'Kinh Tế, /shop_dacbiet, Luyện Đan & /farm', description: 'Gacha 0.65%, 750 LT=1 TT, /dothach -10%, /farm -30p & Tháp 500', emoji_id: uidId('su_linhthach'), value: 'economy' },
    { label: 'Khám Phá Đại Lục & Bộ 1/2/3', description: '12 Địa Danh, Bùa Tuyệt Ấn 25%, Mảnh Hỗn Độn 0.5% & Đồng Bộ /inv', emoji_id: uidId('explorer_world_map_v14'), value: 'explorer' },
    { label: 'Từ Điển Thuật Ngữ (4 Trang • Button)', description: 'Giải thích chuẩn hóa Xuyên DEF, Khiên, Vực, Đạo Áp, CC & Stacking', emoji_id: uidId('su_wiki_scroll'), value: 'glossary' },
  ];

  // Root router
  const cRoot = gb.cond('w_root_cat', 'comparison', { base_value: '{option_chuyen_muc}', target: { self: true } }, { x: 0, y: 180 });
  gb.link('root', cRoot);

  const brRootRealms = gb.branch(cRoot, 'wr_realms', 'comparison', { type: 'equal_to', comparison_value: 'realms', ignoreCase: true }, { x: -750, y: 340 });
  const brRootBattle = gb.branch(cRoot, 'wr_battle', 'comparison', { type: 'equal_to', comparison_value: 'battle', ignoreCase: true }, { x: -450, y: 340 });
  const brRootRoles = gb.branch(cRoot, 'wr_roles', 'comparison', { type: 'equal_to', comparison_value: 'roles', ignoreCase: true }, { x: -1700, y: 340 });
  const brRootEcon = gb.branch(cRoot, 'wr_econ', 'comparison', { type: 'equal_to', comparison_value: 'economy', ignoreCase: true }, { x: -150, y: 340 });
  const brRootExplorer = gb.branch(cRoot, 'wr_explorer', 'comparison', { type: 'equal_to', comparison_value: 'explorer', ignoreCase: true }, { x: 150, y: 340 });
  const brRootEquip = gb.branch(cRoot, 'wr_equip', 'comparison', { type: 'equal_to', comparison_value: 'equipment', ignoreCase: true }, { x: 750, y: 340 });
  const brRootPets = gb.branch(cRoot, 'wr_pets', 'comparison', { type: 'equal_to', comparison_value: 'pets', ignoreCase: true }, { x: 1500, y: 340 });
  const brRootDomains = gb.branch(cRoot, 'wr_domains', 'comparison', { type: 'equal_to', comparison_value: 'domains', ignoreCase: true }, { x: 2550, y: 340 });
  const brRootGlossary = gb.branch(cRoot, 'wr_glossary', 'comparison', { type: 'equal_to', comparison_value: 'glossary', ignoreCase: true }, { x: -1150, y: 340 });
  const brRootHome = gb.elseBranch(cRoot, 'wr_home', 'comparison', { x: 450, y: 340 });

  // Flat categories -> msg_wiki_0
  const initSetSpecs = [
    { br: brRootRealms, id: 'set_wi_realms', val: 'realms', x: -750 },
    { br: brRootBattle, id: 'set_wi_battle', val: 'battle', x: -450 },
    { br: brRootEcon, id: 'set_wi_econ', val: 'economy', x: -150 },
    { br: brRootExplorer, id: 'set_wi_explorer', val: 'explorer', x: 150 },
    { br: brRootHome, id: 'set_wi_overview', val: 'overview', x: 450 },
  ];

  apiAction(gb, 'w_init_api', 'w_init_res', 'GET', `${BACKEND_BASE}/api/wiki?category={wiki_init_cat}`, '', { x: 0, y: 680 });
  for (const s of initSetSpecs) {
    gb.act(s.id, 'set_unique_variable', { reference: 'wiki_init_cat', value: s.val, success_handles: false }, { x: s.x, y: 500 });
    gb.link(s.br, s.id);
    gb.link(s.id, 'w_init_api');
  }

  embedMsg(gb, 'msg_wiki_0', {
    title: '{w_init_res.response.embed_flat.title}',
    description: '{w_init_res.response.embed_flat.description}',
    imageUrl: '{w_init_res.response.embed_flat.image_url}',
    color: '#ec4899',
    footer: '',
    target: { reply: true },
    editId: 'msg_wiki_0',
  }, { x: 0, y: 860 });
  gb.link('w_init_api', 'msg_wiki_0');

  // --- Roles Hub (100% Button Pagination) ---
  apiAction(gb, 'rl_init_api', 'rl_init_res', 'GET', `${BACKEND_BASE}/api/wiki?category=roles&page=1`, '', { x: -1700, y: 680 });
  gb.link(brRootRoles, 'rl_init_api');
  embedMsg(gb, 'msg_wiki_roles', {
    title: '{rl_init_res.response.embed_flat.title}',
    description: '{rl_init_res.response.embed_flat.description}',
    color: '#a855f7',
    footer: '',
    target: { reply: true },
    editId: 'msg_wiki_roles',
  }, { x: -1700, y: 860 });
  gb.link('rl_init_api', 'msg_wiki_roles');

  let rlSeq = 0;
  function attachRolesButtons(parentMsgId, activePage, depth, bx, by) {
    if (depth >= 2) return;
    const specs = [
      { page: 1, label: 'Trang 1: Cao Cấp', style: activePage === 1 ? 'PRIMARY' : 'SECONDARY', icon: 'su_tier_thanthoai', weight: '3', dx: -240 },
      { page: 2, label: 'Trang 2: Phàm & Cấp', style: activePage === 2 ? 'PRIMARY' : 'SECONDARY', icon: 'su_medal_role', weight: '2', dx: 0 },
      { page: 3, label: 'Chi Tiết Chức Năng', style: activePage === 3 ? 'SUCCESS' : 'SECONDARY', icon: 'su_pin_sigil', weight: '1', dx: 240 },
    ];
    for (const sp of specs) {
      rlSeq += 1;
      const bId = `btn_rl_p${sp.page}_${rlSeq}`;
      const aId = `api_rl_p${sp.page}_${rlSeq}`;
      const rVar = `rl_res_${rlSeq}`;
      const mId = `msg_rl_p${sp.page}_${rlSeq}`;
      gb.advBtn(bId, parentMsgId, btnCfg(sp.label, sp.style, sp.icon, '1', sp.weight, 'hide'), { x: bx + sp.dx, y: by + 150 });
      apiAction(gb, aId, rVar, 'GET', `${BACKEND_BASE}/api/wiki?category=roles&page=${sp.page}`, '', { x: bx + sp.dx, y: by + 300 });
      gb.link(bId, aId);
      embedMsg(gb, mId, {
        title: `{${rVar}.response.embed_flat.title}`,
        description: `{${rVar}.response.embed_flat.description}`,
        color: '#a855f7',
        footer: '',
        target: { editId: 'msg_wiki_roles' },
        action_id: 'msg_wiki_roles',
      }, { x: bx + sp.dx, y: by + 450 });
      gb.link(aId, mId);
      attachRolesButtons(mId, sp.page, depth + 1, bx + sp.dx, by + 600);
    }
  }
  attachRolesButtons('msg_wiki_roles', 1, 0, -1700, 860);

  // --- Glossary Hub (100% Button Pagination) ---
  apiAction(gb, 'gl_init_api', 'gl_init_res', 'GET', `${BACKEND_BASE}/api/wiki?category=glossary&page=1`, '', { x: -1150, y: 680 });
  gb.link(brRootGlossary, 'gl_init_api');
  embedMsg(gb, 'msg_wiki_glossary', {
    title: '{gl_init_res.response.embed_flat.title}',
    description: '{gl_init_res.response.embed_flat.description}',
    color: '#38bdf8',
    footer: '',
    target: { reply: true },
    editId: 'msg_wiki_glossary',
  }, { x: -1150, y: 860 });
  gb.link('gl_init_api', 'msg_wiki_glossary');

  let glSeq = 0;
  function attachGlossaryPager(parentMsgId, prevResVar, bx, by) {
    for (const c of [
      { key: 'prev', label: 'Trang Trước', icon: 'su_arrow_left', weight: '2', q: `{${prevResVar}.response.prev_page}`, dx: -130 },
      { key: 'next', label: 'Trang Sau', icon: 'su_arrow_right', weight: '1', q: `{${prevResVar}.response.next_page}`, dx: 130 },
    ]) {
      glSeq += 1;
      const bId = `btn_gl_${c.key}_${glSeq}`;
      const aId = `api_gl_${c.key}_${glSeq}`;
      const rVar = `gl_res_${glSeq}`;
      const mId = `msg_gl_${c.key}_${glSeq}`;
      gb.advBtn(bId, parentMsgId, btnCfg(c.label, 'SECONDARY', c.icon, '1', c.weight, 'hide'), { x: bx + c.dx, y: by + 150 });
      apiAction(gb, aId, rVar, 'GET', `${BACKEND_BASE}/api/wiki?category=glossary&page=${c.q}`, '', { x: bx + c.dx, y: by + 300 });
      gb.link(bId, aId);
      embedMsg(gb, mId, {
        title: `{${rVar}.response.embed_flat.title}`,
        description: `{${rVar}.response.embed_flat.description}`,
        color: '#38bdf8',
        footer: '',
        target: { editId: 'msg_wiki_glossary' },
        action_id: 'msg_wiki_glossary',
      }, { x: bx + c.dx, y: by + 450 });
      gb.link(aId, mId);
    }
  }

  function attachGlossaryDirectButtons(parentMsgId, activePage, depth, bx, by) {
    const specs = [
      { page: 1, label: '1: Giáp & DEF', icon: 'su_crossed_swords', weight: '4', dx: -330 },
      { page: 2, label: '2: Khiên', icon: 'su_shield_def', weight: '3', dx: -110 },
      { page: 3, label: '3: Linh Vực', icon: 'su_realm_star', weight: '2', dx: 110 },
      { page: 4, label: '4: CC & SET', icon: 'su_sparkle', weight: '1', dx: 330 },
    ];
    for (const sp of specs) {
      if (depth >= 1 && sp.page === activePage) continue;
      glSeq += 1;
      const bId = `btn_gl_p${sp.page}_${glSeq}`;
      const aId = `api_gl_p${sp.page}_${glSeq}`;
      const rVar = `gl_res_${glSeq}`;
      const mId = `msg_gl_p${sp.page}_${glSeq}`;
      const style = sp.page === activePage ? 'PRIMARY' : 'SECONDARY';
      gb.advBtn(bId, parentMsgId, btnCfg(sp.label, style, sp.icon, '1', sp.weight, 'hide'), { x: bx + sp.dx, y: by + 150 });
      apiAction(gb, aId, rVar, 'GET', `${BACKEND_BASE}/api/wiki?category=glossary&page=${sp.page}`, '', { x: bx + sp.dx, y: by + 300 });
      gb.link(bId, aId);
      embedMsg(gb, mId, {
        title: `{${rVar}.response.embed_flat.title}`,
        description: `{${rVar}.response.embed_flat.description}`,
        color: '#38bdf8',
        footer: '',
        target: { editId: 'msg_wiki_glossary' },
        action_id: 'msg_wiki_glossary',
      }, { x: bx + sp.dx, y: by + 450 });
      gb.link(aId, mId);
      if (depth === 0) attachGlossaryDirectButtons(mId, sp.page, 1, bx + sp.dx, by + 600);
      else attachGlossaryPager(mId, rVar, bx + sp.dx, by + 600);
    }
  }
  attachGlossaryDirectButtons('msg_wiki_glossary', 1, 0, -1150, 860);

  // --- 5 unrolled edit-in-place category switches on msg_wiki_0 ---
  let curMsgId = 'msg_wiki_0';
  for (let k = 1; k <= 5; k += 1) {
    const prevIdx = k - 1;
    const baseY = 860 + k * 640;
    const selId = `sel_wiki_cat_${prevIdx}`;
    const varName = `picked_wiki_cat_${prevIdx}`;
    const condId = `w_sw_cond_${k}`;
    const brEq = `w_sw_eq_${k}`;
    const brPet = `w_sw_pet_${k}`;
    const brDom = `w_sw_dom_${k}`;
    const brRoles = `w_sw_roles_${k}`;
    const brGl = `w_sw_gl_${k}`;
    const brFlat = `w_sw_flat_${k}`;
    const apiId = `w_sw_api_${k}`;
    const resName = `w_sw_res_${k}`;
    const editMsgId = `msg_wiki_sw_${k}`;

    gb.advSelectMenu(selId, curMsgId, {
      placeholder: 'Chọn chuyên mục Cẩm Nang Tu Tiên v1.7 (10 mục)...',
      customVariableName: varName,
      basic_options: wikiOptions,
      row: '1',
      weight: '1',
      showReplies: 'hide',
    }, { x: 0, y: baseY - 460 });

    gb.cond(condId, 'comparison', { base_value: `{${varName}}`, target: { self: true } }, { x: 0, y: baseY - 300 });
    gb.link(selId, condId);
    gb.branch(condId, brEq, 'comparison', { type: 'equal_to', comparison_value: 'equipment', ignoreCase: true }, { x: 240, y: baseY - 160 });
    gb.branch(condId, brPet, 'comparison', { type: 'equal_to', comparison_value: 'pets', ignoreCase: true }, { x: 420, y: baseY - 160 });
    gb.branch(condId, brDom, 'comparison', { type: 'equal_to', comparison_value: 'domains', ignoreCase: true }, { x: 600, y: baseY - 160 });
    gb.branch(condId, brRoles, 'comparison', { type: 'equal_to', comparison_value: 'roles', ignoreCase: true }, { x: -460, y: baseY - 160 });
    gb.branch(condId, brGl, 'comparison', { type: 'equal_to', comparison_value: 'glossary', ignoreCase: true }, { x: -260, y: baseY - 160 });
    gb.elseBranch(condId, brFlat, 'comparison', { x: 0, y: baseY - 160 });

    gb.link(brEq, 'msg_wiki_equip');
    gb.link(brPet, 'msg_wiki_pets');
    gb.link(brDom, 'msg_wiki_domains');
    gb.link(brRoles, 'rl_init_api');
    gb.link(brGl, 'gl_init_api');

    apiAction(gb, apiId, resName, 'GET', `${BACKEND_BASE}/api/wiki?category={${varName}}`, '', { x: 0, y: baseY - 20 });
    gb.link(brFlat, apiId);

    embedMsg(gb, editMsgId, {
      title: `{${resName}.response.embed_flat.title}`,
      description: `{${resName}.response.embed_flat.description}`,
      imageUrl: `{${resName}.response.embed_flat.image_url}`,
      color: '#ec4899',
      footer: '',
      target: { editId: 'msg_wiki_0' },
      action_id: 'msg_wiki_0',
    }, { x: 0, y: baseY + 140 });
    gb.link(apiId, editMsgId);
    curMsgId = editMsgId;
  }

  // =========================================================================
  // Equipment Hub (3 buttons -> 4 dropdowns each = ALL 264 items!)
  // =========================================================================
  embedMsg(gb, 'msg_wiki_equip', {
    title: eqEmb.title,
    description: eqEmb.description,
    color: '#f59e0b',
    fields: eqEmb.fields,
    footer: '',
    target: { reply: true },
  }, { x: 900, y: 1200 });
  gb.link(brRootEquip, 'msg_wiki_equip');

  embedMsg(gb, 'eq_detail_ack', {
    title: `${uidEm('su_crossed_swords')} Đang tải Thẻ Pháp Bảo...`,
    description: 'Đang tra cứu thông số, kỹ năng HAX và chủ sở hữu hiện tại từ Supabase...',
    color: '#f59e0b',
    footer: '',
    target: { reply: true },
    editId: 'eq_detail_ack',
  }, { x: 900, y: 2450 });
  apiAction(gb, 'eq_detail_api', 'item_res', 'GET', `${BACKEND_BASE}/api/wiki/item/{wiki_item_id}`, '', { x: 900, y: 2630 });
  gb.link('eq_detail_ack', 'eq_detail_api');
  embedMsg(gb, 'eq_detail_edit', {
    title: '{item_res.response.embed.title}',
    description: '{item_res.response.embed.description}',
    color: '#f59e0b',
    imageUrl: `${BACKEND_BASE}/api/wiki/item/{wiki_item_id}.webp?v=1.7`,
    footer: '',
    target: { editId: 'eq_detail_ack' },
    action_id: 'eq_detail_ack',
  }, { x: 900, y: 2810 });
  gb.link('eq_detail_api', 'eq_detail_edit');

  const slotSpecs = [
    { key: 'weapon', label: 'Vũ Khí', emoji: 'su_crossed_swords', weight: '3', x: 640 },
    { key: 'gem', label: 'Bảo Ngọc', emoji: 'su_linhthach', weight: '2', x: 900 },
    { key: 'soul', label: 'Chiến Hồn', emoji: 'su_thunder_hax', weight: '1', x: 1160 },
  ];
  for (const sp of slotSpecs) {
    const items = EQUIPMENT_CATALOG.filter((e) => e.item_type === sp.key);
    const btnId = `btn_eq_${sp.key}`;
    const listMsgId = `msg_eq_${sp.key}`;
    gb.advBtn(btnId, 'msg_wiki_equip', btnCfg(`${sp.label} (${items.length})`, 'SECONDARY', sp.emoji, '1', sp.weight, 'show'), { x: sp.x, y: 1420 });
    embedMsg(gb, listMsgId, {
      title: `${uidEm(sp.emoji)} DANH MỤC ${sp.label.toUpperCase()} (${items.length} MÓN • v1.7)`,
      description: `Chọn một **${sp.label}** từ ${Math.ceil(items.length / 25)} menu bên dưới để xem thẻ Full HD+ & kỹ năng HAX chi tiết.`,
      color: '#f59e0b',
      footer: '',
      target: { reply: true },
    }, { x: sp.x, y: 1600 });
    gb.link(btnId, listMsgId);

    const optChunks = chunkArray(buildEquipmentDropdownOptions(items), 25);
    let offset = 0;
    for (let ci = 0; ci < optChunks.length; ci += 1) {
      const chunk = optChunks[ci];
      const startNo = offset + 1;
      const endNo = offset + chunk.length;
      offset += chunk.length;
      const idx = ci + 1;
      const selId = `sel_eq_${sp.key}_${idx}`;
      const varName = `picked_${sp.key}_${idx}`;
      const setId = `set_item_${sp.key}_${idx}`;
      const cx = sp.x + (ci - 1.5) * 80;

      gb.advSelectMenu(selId, listMsgId, {
        placeholder: `${sp.label} (${startNo}-${endNo} / ${items.length} món)...`,
        customVariableName: varName,
        basic_options: chunk,
        row: String(idx),
        weight: '1',
        showReplies: 'show',
      }, { x: cx, y: 1820 });
      gb.act(setId, 'set_unique_variable', { reference: 'wiki_item_id', value: `{${varName}}`, success_handles: false }, { x: cx, y: 2040 });
      gb.link(selId, setId);
      gb.link(setId, 'eq_detail_ack');
    }
  }

  // =========================================================================
  // Pets Hub (4 Sub-Hub Buttons -> ALL 150 Public Pets!)
  // =========================================================================
  embedMsg(gb, 'msg_wiki_pets', {
    title: ptEmb.title,
    description: ptEmb.description,
    color: '#ec4899',
    fields: ptEmb.fields,
    footer: '',
    target: { reply: true },
  }, { x: 1700, y: 1200 });
  gb.link(brRootPets, 'msg_wiki_pets');

  embedMsg(gb, 'pet_detail_ack', {
    title: `${uidEm('su_pet_paw')} Đang tải Thẻ Linh Thú...`,
    description: 'Đang tra cứu hệ nguyên tố, chỉ số ATK/DEF/SPD/HP, HAX & Ultimate Tiến Hóa...',
    color: '#ec4899',
    footer: '',
    target: { reply: true },
    editId: 'pet_detail_ack',
  }, { x: 1700, y: 2450 });
  apiAction(gb, 'pet_detail_api', 'pet_res', 'GET', `${BACKEND_BASE}/api/wiki/pet/{wiki_pet_id}`, '', { x: 1700, y: 2630 });
  gb.link('pet_detail_ack', 'pet_detail_api');
  embedMsg(gb, 'pet_detail_edit', {
    title: '{pet_res.response.embed.title}',
    description: '{pet_res.response.embed.description}',
    color: '#ec4899',
    imageUrl: `${BACKEND_BASE}/api/wiki/pet/{wiki_pet_id}.webp?v=1.7`,
    footer: '',
    target: { editId: 'pet_detail_ack' },
    action_id: 'pet_detail_ack',
  }, { x: 1700, y: 2810 });
  gb.link('pet_detail_api', 'pet_detail_edit');

  const stdPets = PET_CATALOG.filter((p) => !p.is_exclusive_fuyumi);
  const lowPets = stdPets.filter((p) => ['common', 'rare', 'epic'].includes(p.rarity_key)); // 40
  const normMythicPets = stdPets.filter((p) => p.rarity_key === 'mythic' && !p.is_unique); // 70
  const uniqueAllPets = stdPets.filter((p) => p.is_unique); // 40
  const kemoPets = stdPets.filter((p) => p.is_kemonomimi); // 10

  const petSubHubs = [
    { key: 'low', label: `Phàm/Linh/Tiên (${lowPets.length})`, style: 'SECONDARY', icon: 'su_tier_tien', weight: '4', items: lowPets, x: 1420 },
    { key: 'mythic', label: `Thần Thoại (${normMythicPets.length})`, style: 'PRIMARY', icon: 'su_tier_thanthoai', weight: '3', items: normMythicPets, x: 1620 },
    { key: 'unique', label: `40 Tối Thượng & Ult`, style: 'DANGER', icon: 'evo_crystal', weight: '2', items: uniqueAllPets, x: 1820 },
    { key: 'kemo', label: `10 Thú Nhân (Mới)`, style: 'SUCCESS', icon: 'su_tier_toithuong', weight: '1', items: kemoPets, x: 2020 },
  ];

  for (const sh of petSubHubs) {
    const btnId = `btn_pet_sh_${sh.key}`;
    const listMsgId = `msg_pet_sh_${sh.key}`;
    gb.advBtn(btnId, 'msg_wiki_pets', btnCfg(sh.label, sh.style, sh.icon, '1', sh.weight, 'show'), { x: sh.x, y: 1420 });
    embedMsg(gb, listMsgId, {
      title: `${uidEm(sh.icon, 'su_pet_paw')} KHO LINH THÚ — ${sh.label.toUpperCase()}`,
      description: `Chọn một Linh Thú bên dưới để xem thẻ Full HD+, hệ nguyên tố, HAX & kỹ năng Ultimate Chân Thần (nếu có).`,
      color: '#ec4899',
      footer: '',
      target: { reply: true },
    }, { x: sh.x, y: 1600 });
    gb.link(btnId, listMsgId);

    const optChunks = chunkArray(buildPetDropdownOptions(sh.items), 25);
    let offset = 0;
    for (let ci = 0; ci < optChunks.length; ci += 1) {
      const chunk = optChunks[ci];
      const startNo = offset + 1;
      const endNo = offset + chunk.length;
      offset += chunk.length;
      const idx = ci + 1;
      const selId = `sel_pet_${sh.key}_${idx}`;
      const varName = `picked_pet_${sh.key}_${idx}`;
      const setId = `set_pet_${sh.key}_${idx}`;
      const cx = sh.x + (ci - 1) * 70;

      gb.advSelectMenu(selId, listMsgId, {
        placeholder: `${sh.label} (${startNo}-${endNo} / ${sh.items.length})...`,
        customVariableName: varName,
        basic_options: chunk,
        row: String(idx),
        weight: '1',
        showReplies: 'show',
      }, { x: cx, y: 1820 });
      gb.act(setId, 'set_unique_variable', { reference: 'wiki_pet_id', value: `{${varName}}`, success_handles: false }, { x: cx, y: 2040 });
      gb.link(selId, setId);
      gb.link(setId, 'pet_detail_ack');
    }
  }

  // =========================================================================
  // Domains Hub (3 Sub-Hub Buttons -> ALL 161 Public Entities!)
  // =========================================================================
  embedMsg(gb, 'msg_wiki_domains', {
    title: domEmb.title,
    description: domEmb.description,
    color: '#a855f7',
    fields: domEmb.fields,
    footer: '',
    target: { reply: true },
  }, { x: 2650, y: 1200 });
  gb.link(brRootDomains, 'msg_wiki_domains');

  embedMsg(gb, 'dom_detail_ack', {
    title: `${uidEm('su_realm_star')} Đang tải Thẻ Lãnh Địa...`,
    description: 'Đang tra cứu thông số Linh Mạch, Đạo Áp, hiệu ứng Vực/Thức/Cảnh & chủ Độc Nhất...',
    color: '#a855f7',
    footer: '',
    target: { reply: true },
    editId: 'dom_detail_ack',
  }, { x: 2650, y: 2450 });
  apiAction(gb, 'dom_detail_api', 'dom_res', 'GET', `${BACKEND_BASE}/api/wiki/domain/{wiki_domain_id}`, '', { x: 2650, y: 2630 });
  gb.link('dom_detail_ack', 'dom_detail_api');
  embedMsg(gb, 'dom_detail_edit', {
    title: '{dom_res.response.embed.title}',
    description: '{dom_res.response.embed.description}',
    color: '#a855f7',
    imageUrl: '{dom_res.response.embed.image_url}',
    footer: '',
    target: { editId: 'dom_detail_ack' },
    action_id: 'dom_detail_ack',
  }, { x: 2650, y: 2810 });
  gb.link('dom_detail_api', 'dom_detail_edit');

  const pubDomains = DOMAIN_CATALOG.filter((d) => !d.is_exclusive_fuyumi); // 65
  const pubSenses = DIVINE_SENSE_CATALOG.filter((s) => !s.is_exclusive_fuyumi); // 48
  const pubRealms = DIVINE_REALM_CATALOG.filter((r) => !r.is_exclusive_fuyumi); // 48
  const domSubHubs = [
    { key: 'domain', kind: 'domain', label: `Linh Vực (${pubDomains.length})`, style: 'PRIMARY', icon: 'su_realm_star', weight: '3', items: pubDomains, x: 2420 },
    { key: 'sense', kind: 'sense', label: `Thần Thức (${pubSenses.length})`, style: 'SECONDARY', icon: 'su_sparkle', weight: '2', items: pubSenses, x: 2650 },
    { key: 'realm', kind: 'realm', label: `Thần Cảnh (${pubRealms.length})`, style: 'DANGER', icon: 'dao_ap_crest', weight: '1', items: pubRealms, x: 2880 },
  ];

  for (const sh of domSubHubs) {
    const btnId = `btn_dom_sh_${sh.key}`;
    const listMsgId = `msg_dom_sh_${sh.key}`;
    gb.advBtn(btnId, 'msg_wiki_domains', btnCfg(sh.label, sh.style, sh.icon, '1', sh.weight, 'show'), { x: sh.x, y: 1420 });
    embedMsg(gb, listMsgId, {
      title: `${uidEm(sh.icon, 'su_realm_star')} KHO LÃNH ĐỊA — ${sh.label.toUpperCase()}`,
      description: `Chọn một **${sh.label}** bên dưới để xem thẻ Full HD+ & hiệu ứng chi tiết.`,
      color: '#a855f7',
      footer: '',
      target: { reply: true },
    }, { x: sh.x, y: 1600 });
    gb.link(btnId, listMsgId);

    const optChunks = chunkArray(buildDomainDropdownOptions(sh.items, sh.kind), 25);
    let offset = 0;
    for (let ci = 0; ci < optChunks.length; ci += 1) {
      const chunk = optChunks[ci];
      const startNo = offset + 1;
      const endNo = offset + chunk.length;
      offset += chunk.length;
      const idx = ci + 1;
      const selId = `sel_dom_${sh.key}_${idx}`;
      const varName = `picked_dom_${sh.key}_${idx}`;
      const setId = `set_dom_${sh.key}_${idx}`;
      const cx = sh.x + (ci - 1) * 75;

      gb.advSelectMenu(selId, listMsgId, {
        placeholder: `${sh.label} (${startNo}-${endNo} / ${sh.items.length})...`,
        customVariableName: varName,
        basic_options: chunk,
        row: String(idx),
        weight: '1',
        showReplies: 'show',
      }, { x: cx, y: 1820 });
      gb.act(setId, 'set_unique_variable', { reference: 'wiki_domain_id', value: `{${varName}}`, success_handles: false }, { x: cx, y: 2040 });
      gb.link(selId, setId);
      gb.link(setId, 'dom_detail_ack');
    }
  }

  return gb.elements();
}

// ============================================================================
// 5. Surgical Live Tree Upgrades: /shop, /explorer, /dothach, AI Mention, Sweep
// ============================================================================
function patchShopTreeV17(oldTree) {
  // Remove any previously injected v17_sh_* elements for 100% idempotency
  const baseTree = JSON.parse(JSON.stringify(oldTree)).filter((el) => {
    if (String(el.id || '').startsWith('v17_sh_')) return false;
    if (el.source && el.target && (String(el.source).startsWith('v17_sh_') || String(el.target).startsWith('v17_sh_'))) return false;
    return true;
  });

  const paidLtFrames = AVATAR_FRAMES.filter((f) => Number(f.price || 0) > 0 && !f.special_shop_only && !f.is_exclusive_fuyumi);
  const frameOpts = paidLtFrames.map((f) => ({
    label: String(f.name).slice(0, 95),
    description: `${Number(f.price).toLocaleString('vi-VN')} LT • ${f.rarity}`,
    emoji_id: uidId('frame_unlock_token', 'su_sparkle'),
    value: f.frame_id,
  }));
  const consOpts = SHOP_CONSUMABLES.map((c) => ({
    label: `${c.name} (${Number(c.price).toLocaleString('vi-VN')} LT)`.slice(0, 95),
    description: String(c.description || '').slice(0, 95),
    emoji_id: uidId(c.item_id, 'su_linhthach'),
    value: c.item_id,
  }));

  const frameAisleTitle = `${uidEm('frame_unlock_token')} QUẦY VIỀN AVATAR (${paidLtFrames.length} MẪU)`;
  const frameAisleDesc = `${paidLtFrames.map((f) => `• ${uidEm(tierEmojiKey(f.rarity_key), 'su_tier_pham')} **${f.name}** — **${Number(f.price).toLocaleString('vi-VN')}** ${uidEm('su_linhthach')}`).join('\n')}\n\n• *Chọn mẫu ở menu bên dưới để xem ảnh mẫu & mua ngay!*`;

  const bgMsgNode = baseTree.find((e) => e.id === 'msg_shop_bgs');
  const bgSelNode = baseTree.find((e) => e.id === 'sel_shop_bg');
  const bgAisleTitle = bgMsgNode?.data?.data?.message?.embeds?.[0]?.title || `${uidEm('frame_unlock_token')} QUẦY BACKGROUND PROFILE & RANK (20 MẪU)`;
  const bgAisleDesc = bgMsgNode?.data?.data?.message?.embeds?.[0]?.description || '• *Chọn mẫu ở menu bên dưới để xem ảnh mẫu & mua ngay!*';
  const bgOpts = JSON.parse(JSON.stringify(bgSelNode?.data?.data?.basic_options || []));
  const bgPlaceholder = bgSelNode?.data?.data?.placeholder || `Chọn Background Hồ Sơ (${bgOpts.length} mẫu • 300 - 4.000 LT)`;

  // Update list embeds & select options on both primary and secondary shop hubs
  for (const el of baseTree) {
    if (el.type === 'advMessageSelectMenu' && (el.id === 'sel_shop_frame' || el.id === 'sel_shop_frame_2')) {
      el.data.data.placeholder = `Chọn Viền Avatar (${paidLtFrames.length} mẫu • 300 - 4.000 LT)...`;
      el.data.data.basic_options = frameOpts;
    }
    if (el.type === 'advMessageSelectMenu' && (el.id === 'sel_shop_cons' || el.id === 'sel_shop_cons_2')) {
      el.data.data.placeholder = `Chọn Vật Phẩm Tiêu Hao / Bảo Vệ / Luck (${consOpts.length} món)...`;
      el.data.data.basic_options = consOpts;
    }
    if (el.type === 'action' && (el.id === 'msg_shop_frames' || el.id === 'msg_shop_frames_2') && el.data?.data?.message?.embeds?.[0]) {
      el.data.data.message.embeds[0].title = frameAisleTitle;
      el.data.data.message.embeds[0].description = frameAisleDesc;
    }
  }

  // Dedicated acyclic preview+buy+back-to-aisle chains for Frames & Backgrounds (no kicking back to Home!)
  const hasRewireTargets = ['set_sh_frame', 'set_sh_bg', 'set_sh2_sel_shop_frame', 'set_sh2_sel_shop_bg', 'msg_shop_home_2']
    .every((id) => baseTree.some((e) => e.id === id));

  if (hasRewireTargets && bgOpts.length > 0) {
    const sampleMsgOpts = JSON.parse(JSON.stringify(baseTree.find((e) => e.id === 'msg_shop_frames')?.data?.node_options || {}));
    const sampleApiOpts = JSON.parse(JSON.stringify(baseTree.find((e) => e.id === 'shop_prev_api')?.data?.node_options || {}));
    const sampleSetOpts = JSON.parse(JSON.stringify(baseTree.find((e) => e.id === 'set_sh_frame')?.data?.node_options || {}));

    // Remove the old 4 edges connecting Frame/BG sets to shared shop_prev_api / shop_prev_2_api
    const removedTargets = new Map([
      ['set_sh_frame', 'shop_prev_api'],
      ['set_sh_bg', 'shop_prev_api'],
      ['set_sh2_sel_shop_frame', 'shop_prev_2_api'],
      ['set_sh2_sel_shop_bg', 'shop_prev_2_api'],
    ]);
    const treeFiltered = baseTree.filter((el) => {
      if (el.source && el.target && removedTargets.get(el.source) === el.target) return false;
      return true;
    });

    const addNode = (node) => treeFiltered.push(node);
    const addEdge = (src, tgt, { sh = 'action', th = 'action', type = 'custom' } = {}) => {
      treeFiltered.push({
        source: src,
        ...(sh ? { sourceHandle: sh } : {}),
        target: tgt,
        ...(th ? { targetHandle: th } : {}),
        animated: false,
        arrowHeadType: 'arrowclosed',
        type,
        id: `reactflow__edge-${src}${sh || ''}-${tgt}${th || ''}`,
      });
    };

    const buildAisleChain = ({
      tag,
      startSetNodeId,
      initialVarName,
      aisleTitle,
      aisleDesc,
      aislePlaceholder,
      aisleOpts,
      backToAisleLabel,
      maxHops,
      allowBackHome,
      baseX,
      baseY,
    }) => {
      const apiHeaders = [
        { key: 'Content-Type', value: 'application/json' },
        { key: 'x-api-key', value: '{SECRET_BACKEND_KEY}' },
      ];
      const apiOptions = {
        excludeEmptyFields: true,
        replaceParams: true,
        replaceURL: true,
        replaceHeaders: true,
        replaceBody: true,
        jsonSafeVariables: true,
        bodyMode: 'raw',
        contentType: 'application/json',
        failOnError: false,
      };

      const makeMsgNode = (id, title, description, imageUrl, pos) => addNode({
        id,
        type: 'action',
        draggable: true,
        position: pos,
        width: 280,
        height: 90,
        data: {
          node_options: JSON.parse(JSON.stringify(sampleMsgOpts)),
          data: {
            type: 'advanced_message',
            validated: true,
            messageType: 'advanced',
            useComponentsV2: false,
            target: { editId: 'shop_main_msg' },
            action_id: 'shop_main_msg',
            success_handles: false,
            message: {
              content: '',
              embeds: [{
                title,
                description,
                color: '#ec4899',
                timestamp: false,
                author: { name: '', iconURL: '', url: '' },
                footer: { text: '', iconURL: '' },
                image: { url: imageUrl || '' },
                thumbnail: { url: '' },
                fields: [],
              }],
            },
          },
        },
      });

      const makeBtnNode = (id, parentMsgId, label, style, iconName, weight, row, pos) => {
        const eid = uidId(iconName);
        addNode({
          id,
          type: 'advMessageButton',
          draggable: true,
          position: pos,
          width: 240,
          height: 80,
          data: {
            node_options: {},
            data: {
              type: 'button',
              label,
              style,
              ...(eid ? { emoji_id: eid } : {}),
              orderComponent: true,
              row: String(row),
              weight: String(weight),
              showReplies: 'hide',
              who_can_press: 'user',
              who_can_press_message: AUTHOR_ONLY_MSG,
              validated: true,
            },
          },
        });
        addEdge(parentMsgId, id, { sh: 'components_source', th: null, type: 'step' });
      };

      let prevEntryNodeId = startSetNodeId;
      let prevVarName = initialVarName;

      for (let h = 1; h <= maxHops; h += 1) {
        const hx = baseX + (h - 1) * 520;
        const pApiId = `v17_sh_${tag}_prev_${h}_api`;
        const pVar = `v17_sh_${tag}_pf_${h}`;
        const pMsgId = `v17_sh_${tag}_prev_${h}_msg`;
        const buyBtnId = `v17_sh_${tag}_buy_${h}_btn`;
        const buyApiId = `v17_sh_${tag}_buy_${h}_api`;
        const buyVar = `v17_sh_${tag}_bf_${h}`;
        const buyMsgId = `v17_sh_${tag}_buy_${h}_msg`;

        addNode({
          id: pApiId,
          type: 'action',
          draggable: true,
          position: { x: hx, y: baseY + 180 },
          width: 280,
          height: 90,
          data: {
            node_options: JSON.parse(JSON.stringify(sampleApiOpts)),
            data: {
              type: 'api_action',
              name: pVar,
              ephemeral: false,
              request_options: {
                method: 'POST',
                url: `${BACKEND_BASE}/api/shop/preview`,
                headers: apiHeaders,
                params: [],
                body: [],
                rawBody: `{"userId":"{user_id}","username":"{user_displayName}","avatarUrl":"{user_icon}","itemId":"{${prevVarName}}","messageId":"{message_id}"}`,
                contentType: 'application/json',
                options: apiOptions,
              },
              success_handles: false,
              validated: true,
            },
          },
        });
        addEdge(prevEntryNodeId, pApiId);

        makeMsgNode(pMsgId, `{${pVar}.response.title}`, `{${pVar}.response.description}`, `{${pVar}.response.image_url}`, { x: hx, y: baseY + 340 });
        addEdge(pApiId, pMsgId);

        // Mua Ngay (RIGHT, weight=1)
        makeBtnNode(buyBtnId, pMsgId, 'Mua Ngay', 'SUCCESS', 'su_linhthach', '1', '1', { x: hx + 140, y: baseY + 500 });
        addNode({
          id: buyApiId,
          type: 'action',
          draggable: true,
          position: { x: hx + 140, y: baseY + 660 },
          width: 280,
          height: 90,
          data: {
            node_options: JSON.parse(JSON.stringify(sampleApiOpts)),
            data: {
              type: 'api_action',
              name: buyVar,
              ephemeral: false,
              request_options: {
                method: 'POST',
                url: `${BACKEND_BASE}/api/shop/buy`,
                headers: apiHeaders,
                params: [],
                body: [],
                rawBody: `{"userId":"{user_id}","username":"{user_displayName}","avatarUrl":"{user_icon}","category":"{${pVar}.response.category}","itemId":"{${pVar}.response.item_id}","messageId":"{message_id}"}`,
                contentType: 'application/json',
                options: apiOptions,
              },
              success_handles: false,
              validated: true,
            },
          },
        });
        addEdge(buyBtnId, buyApiId);
        makeMsgNode(buyMsgId, `${uidEm('su_sparkle')} GIAO DỊCH TIÊN BẢO CÁC`, `{${buyVar}.response.message}`, '', { x: hx + 140, y: baseY + 820 });
        addEdge(buyApiId, buyMsgId);

        if (h < maxHops) {
          const nextAisleId = `v17_sh_${tag}_aisle_${h + 1}`;
          const nextSelId = `v17_sh_${tag}_sel_${h + 1}`;
          const nextPicked = `v17_sh_${tag}_pk_${h + 1}`;
          const nextSetId = `v17_sh_${tag}_set_${h + 1}`;
          const nextVar = `v17_sh_${tag}_pid_${h + 1}`;

          const backBtnPrev = `v17_sh_${tag}_back_p_${h}`;
          const backBtnBuy = `v17_sh_${tag}_back_b_${h}`;
          makeBtnNode(backBtnPrev, pMsgId, backToAisleLabel, 'SECONDARY', 'su_arrow_left', '2', '1', { x: hx - 120, y: baseY + 500 });
          makeBtnNode(backBtnBuy, buyMsgId, backToAisleLabel, 'SECONDARY', 'su_arrow_left', '2', '1', { x: hx + 20, y: baseY + 980 });

          if (allowBackHome) {
            const backHomeBuy = `v17_sh_${tag}_home_b_${h}`;
            makeBtnNode(backHomeBuy, buyMsgId, 'Về Danh Mục Shop', 'SECONDARY', 'su_realm_star', '1', '1', { x: hx + 260, y: baseY + 980 });
            addEdge(backHomeBuy, 'msg_shop_home_2');
          }

          makeMsgNode(nextAisleId, aisleTitle, aisleDesc, '', { x: hx + 360, y: baseY + 520 });
          addEdge(backBtnPrev, nextAisleId);
          addEdge(backBtnBuy, nextAisleId);

          if (allowBackHome) {
            const aisleHomeBtn = `v17_sh_${tag}_ahome_${h + 1}`;
            makeBtnNode(aisleHomeBtn, nextAisleId, 'Về Danh Mục Shop', 'SECONDARY', 'su_realm_star', '1', '2', { x: hx + 460, y: baseY + 680 });
            addEdge(aisleHomeBtn, 'msg_shop_home_2');
          }

          addNode({
            id: nextSelId,
            type: 'advMessageSelectMenu',
            draggable: true,
            position: { x: hx + 520, y: baseY + 20 },
            width: 280,
            height: 90,
            data: {
              node_options: {},
              data: {
                type: 'adv_select_menu',
                menu_type: 'basic',
                placeholder: aislePlaceholder,
                multiselect: false,
                minOptions: '1',
                maxOptions: '1',
                basic_options: aisleOpts.map((o) => ({
                  label: String(o.label).slice(0, 95),
                  description: String(o.description || '').slice(0, 95),
                  emoji_id: o.emoji_id ? String(o.emoji_id) : '',
                  value: String(o.value).slice(0, 95),
                })),
                type_options: {},
                options: [],
                orderComponent: true,
                row: '1',
                weight: '1',
                showReplies: 'hide',
                who_can_press: 'user',
                who_can_press_message: AUTHOR_ONLY_MSG,
                validated: true,
                customVariableName: nextPicked,
              },
            },
          });
          addEdge(nextAisleId, nextSelId, { sh: 'components_source', th: null, type: 'step' });

          addNode({
            id: nextSetId,
            type: 'action',
            draggable: true,
            position: { x: hx + 520, y: baseY + 120 },
            width: 280,
            height: 90,
            data: {
              node_options: JSON.parse(JSON.stringify(sampleSetOpts)),
              data: {
                type: 'set_unique_variable',
                validated: true,
                reference: nextVar,
                value: `{${nextPicked}}`,
                success_handles: false,
              },
            },
          });
          addEdge(nextSelId, nextSetId);

          prevEntryNodeId = nextSetId;
          prevVarName = nextVar;
        } else if (allowBackHome) {
          // Final hop on primary branch -> safe return to msg_shop_home_2
          const backHomePrev = `v17_sh_${tag}_home_p_${h}`;
          const backHomeBuy = `v17_sh_${tag}_home_b_${h}`;
          makeBtnNode(backHomePrev, pMsgId, 'Về Danh Mục Shop', 'SECONDARY', 'su_realm_star', '2', '1', { x: hx - 120, y: baseY + 500 });
          addEdge(backHomePrev, 'msg_shop_home_2');
          makeBtnNode(backHomeBuy, buyMsgId, 'Về Danh Mục Shop', 'SECONDARY', 'su_realm_star', '2', '1', { x: hx + 140, y: baseY + 980 });
          addEdge(backHomeBuy, 'msg_shop_home_2');
        }
      }
    };

    buildAisleChain({
      tag: 'fr1',
      startSetNodeId: 'set_sh_frame',
      initialVarName: 'shop_preview_id',
      aisleTitle: frameAisleTitle,
      aisleDesc: frameAisleDesc,
      aislePlaceholder: `Chọn Viền Avatar (${paidLtFrames.length} mẫu • 300 - 4.000 LT)...`,
      aisleOpts: frameOpts,
      backToAisleLabel: 'Về Quầy Viền Avatar',
      maxHops: 4,
      allowBackHome: true,
      baseX: -2400,
      baseY: 2400,
    });

    buildAisleChain({
      tag: 'bg1',
      startSetNodeId: 'set_sh_bg',
      initialVarName: 'shop_preview_id',
      aisleTitle: bgAisleTitle,
      aisleDesc: bgAisleDesc,
      aislePlaceholder: bgPlaceholder,
      aisleOpts: bgOpts,
      backToAisleLabel: 'Về Quầy Ảnh Nền',
      maxHops: 4,
      allowBackHome: true,
      baseX: -2400,
      baseY: 3650,
    });

    buildAisleChain({
      tag: 'fr2',
      startSetNodeId: 'set_sh2_sel_shop_frame',
      initialVarName: 'shop_preview_2_id',
      aisleTitle: frameAisleTitle,
      aisleDesc: frameAisleDesc,
      aislePlaceholder: `Chọn Viền Avatar (${paidLtFrames.length} mẫu • 300 - 4.000 LT)...`,
      aisleOpts: frameOpts,
      backToAisleLabel: 'Về Quầy Viền Avatar',
      maxHops: 2,
      allowBackHome: false,
      baseX: 3300,
      baseY: 2200,
    });

    buildAisleChain({
      tag: 'bg2',
      startSetNodeId: 'set_sh2_sel_shop_bg',
      initialVarName: 'shop_preview_2_id',
      aisleTitle: bgAisleTitle,
      aisleDesc: bgAisleDesc,
      aislePlaceholder: bgPlaceholder,
      aisleOpts: bgOpts,
      backToAisleLabel: 'Về Quầy Ảnh Nền',
      maxHops: 2,
      allowBackHome: false,
      baseX: 3300,
      baseY: 3450,
    });

    return sweepTreeV17(treeFiltered);
  }

  return sweepTreeV17(baseTree);
}

function patchDothachTreeV17(oldTree) {
  const walk = (obj) => {
    if (typeof obj === 'string') {
      return obj
        .replace(/Hộp Chọn Tối Thượng Cực Phẩm/g, 'Hộp Thần Thoại Cực Phẩm')
        .replace(/Tối Thượng Cực Phẩm/g, 'Thần Thoại Cực Phẩm');
    }
    if (Array.isArray(obj)) return obj.map(walk);
    if (obj && typeof obj === 'object') {
      const out = {};
      for (const [k, v] of Object.entries(obj)) out[k] = walk(v);
      return out;
    }
    return obj;
  };
  return sweepTreeV17(walk(oldTree));
}

function patchExplorerTreeV17(oldTree) {
  const tree = sweepTreeV17(JSON.parse(JSON.stringify(oldTree)));
  // Fix Row 2 [Bộ 1] [Bộ 2] [Bộ 3] left-to-right weights (3 = Bộ 1 left, 2 = Bộ 2 mid, 1 = Bộ 3 right)
  for (const slot of [1, 2, 3]) {
    const existingBtn = tree.find((e) => e.id === `ex_btn_slot_${slot}` && e.type === 'advMessageButton');
    if (existingBtn?.data?.data) {
      existingBtn.data.data.weight = String(4 - slot);
      existingBtn.data.data.orderComponent = true;
    }
  }
  const existingIds = new Set(tree.map((e) => e.id));
  // Add [Bộ 1] [Bộ 2] [Bộ 3] quick loadout switcher on Row 2 of ex_hub_msg (idempotent!)
  if (existingIds.has('ex_hub_msg') && !existingIds.has('ex_btn_slot_1')) {
    const hub = tree.find((e) => e.id === 'ex_hub_msg');
    const baseX = hub?.position?.x || 0;
    const baseY = (hub?.position?.y || 600) + 260;

    for (const slot of [1, 2, 3]) {
      const bId = `ex_btn_slot_${slot}`;
      const aId = `ex_api_slot_${slot}`;
      const mId = `ex_msg_slot_${slot}`;
      const rVar = `ex_slot_res_${slot}`;
      const dx = (slot - 2) * 260;

      tree.push({
        id: bId,
        type: 'advMessageButton',
        draggable: true,
        position: { x: baseX + dx, y: baseY },
        width: 240,
        height: 80,
        data: {
          node_options: {},
          data: {
            type: 'adv_button',
            ...btnCfg(`Bộ ${slot}`, 'SECONDARY', 'su_crossed_swords', '2', String(4 - slot), 'show'),
            validated: true,
          },
        },
      });
      tree.push({
        source: 'ex_hub_msg',
        sourceHandle: 'components_source',
        target: bId,
        animated: false,
        arrowHeadType: 'arrowclosed',
        type: 'step',
        id: `reactflow__edge-ex_hub_msgcomponents_source-${bId}`,
      });

      tree.push({
        id: aId,
        type: 'action',
        draggable: true,
        position: { x: baseX + dx, y: baseY + 160 },
        width: 280,
        height: 90,
        data: {
          node_options: {},
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
      tree.push({
        source: bId,
        sourceHandle: 'action',
        target: aId,
        targetHandle: 'action',
        animated: false,
        arrowHeadType: 'arrowclosed',
        type: 'smoothstep',
        id: `reactflow__edge-${bId}action-${aId}action`,
      });

      tree.push({
        id: mId,
        type: 'action',
        draggable: true,
        position: { x: baseX + dx, y: baseY + 320 },
        width: 280,
        height: 90,
        data: {
          node_options: {},
          data: {
            type: 'advanced_message',
            messageType: 'basic',
            useComponentsV2: false,
            target: { reply: true },
            success_handles: false,
            message: {
              content: '',
              embeds: [{
                title: `${uidEm('explorer_world_map_v14', 'su_sparkle')} ĐỒNG BỘ BỘ TRANG BỊ #${slot} (/explorer)`,
                description: `{${rVar}.response.message}`,
                color: '#10b981',
                timestamp: false,
                author: { name: '', iconURL: '', url: '' },
                footer: { text: '', iconURL: '' },
                image: { url: '' },
                thumbnail: { url: '' },
                fields: [],
              }],
            },
            validated: true,
          },
        },
      });
      tree.push({
        source: aId,
        sourceHandle: 'action',
        target: mId,
        targetHandle: 'action',
        animated: false,
        arrowHeadType: 'arrowclosed',
        type: 'smoothstep',
        id: `reactflow__edge-${aId}action-${mId}action`,
      });
    }
  }
  return tree;
}

function buildV17KnowledgeBlock(includeFuyumiSecret) {
  const lines = [
    'KIẾN THỨC CHÍNH THỨC TOÀN BỘ HỆ THỐNG BOT NHIỄM NHIỄM (SUMI FAMILY TỪ v1.1 ĐẾN v1.7):',
    '• [CẢNH GIỚI, LEVEL ROLES & EXP] (/profile, /rank, /exp, /doiqua, /top): 7 Đại Cảnh Giới từ Lv.1→Lv.100 mở dần 1→5 Slot Role. Chat nhận 23–35 EXP/45s, Voice nhận 85–135 EXP/5 phút; công thức lên cấp 78*(Lv^1.45) (max 500.000 EXP), lên cấp mới thưởng +50..+400 LT (1 lần/Lv). Quyền 8 mốc Level Roles: Lv.5 Gửi Ảnh/File, Lv.10 Stream, Lv.20 Emoji Nitro Ngoại Server & Lập Gia Tộc, Lv.35 Embed Links, Lv.45 Sticker Ngoại Server (+ mở Lò #2), Lv.60 Voice Message, Lv.80 Soundboard, Lv.100 External Sounds. /doiqua đổi 1.000 EXP lấy 10 LT. Top Chat/Voice Ngày trao 500/400/300 LT lúc 00:00 (UTC+7); 19:00 Chủ Nhật tổng kết Top Tuần Lực Chiến.',
    '• [TIẾN HÓA CHÂN THẦN & 40 SKILL ULTIMATE] (/tienhoa — MỚI v1.7): Áp dụng cho toàn bộ 40 Pet Độc Nhất (10 gốc + 20 Linh Thú mới + 10 Tối Thượng Thú Nhân mới). Tab 1 Tiến Hóa cần Pet đạt Lv.40 & 8★ + 1 Hồng Mông Tiến Hóa Tinh + phí LT (1.000 LT = 60%, 3.000 = 70%, 5.000 = 80%, 7.000 = 90%, 9.000 LT = 100%; thất bại CHỈ mất LT, GIỮ NGUYÊN Hồng Mông) để nâng cấp thành Tối Thượng Chân Thần, đổi ảnh mới, tăng mạnh chỉ số & mở khóa Skill Ultimate tái kích hoạt trong /battle và /linhmach. Tab 2 Chế Tạo Hồng Mông: ghép từ 3 Mảnh Tinh Hoa Hỗn Độn + 1 Pet Thần Thoại thường + 2.500 LT (xác nhận 2 bước, KHÔNG có lệnh /hiente).',
    '• [TÚI ĐỒ 2×3, 3 LOADOUT & KHẮC ẤN] (/inv, /linhthu, /pet, /phapbao, /linhvuc, /roles, /equip, /unequip, /enchant, /dismantle): /inv hiển thị ngang 2×3 kèm 3 nút Bộ 1 / Bộ 2 / Bộ 3 tự lưu trọn bộ Linh Thú + 3 Pháp Bảo + Linh Vực/Thần Thức/Thần Cảnh (đồng bộ cả trong /explorer). Kho v1.7 mở rộng tổng cộng 150 Pet công khai (40 Độc Nhất trong đó 10 Thú Nhân), 264 Pháp Bảo (90 Vũ Khí, 87 Bảo Ngọc, 87 Chiến Hồn), 161 Lãnh Địa (65 Linh Vực, 48 Thần Thức, 48 Thần Cảnh) và 29 Khung Avatar. Khắc Ấn /enchant D→S (+0/+8/+18/+32/+50%, Pity +5%). Buff SET: Thường 4/5 (+8%/+12%); Thần Thoại 2/3/4/5 (+6/+12/+18/+25%, mốc 5 thêm +10% Xuyên DEF & +1 Linh Mạch).',
    '• [ĐẤU TRƯỜNG 1V1, LINH MẠCH GIỜ VÀNG & CHIẾN ĐẤU v1.7] (/battle, /party, /linhmach, /nhiemvu): /battle 1v1 (PvP 15/ngày, PvE 25/ngày, cooldown 15s, max 30 hiệp) đầy đủ Ngũ Hành, Dị Tố, HAX Engine, 40 Skill Ultimate, Linh Vực từ Hiệp 2 & Đạo Áp, kèm Web Battle Logs 48h (đã tách riêng dòng [Đầu lượt] và thẻ Ultimate). Cơ chế v1.7: Độc/Thiêu Đốt/Debuff từ nhiều nguồn khác nhau CỘNG DỒN (trần DoT 28%), Bất Tử bảo vệ trọn hiệp (chặn cả DoT/Vực/Phản Đòn/Ultimate), Thần Cảnh tôn trọng Kháng DoT. /linhmach & /party CHỈ mở vào 6 Khung Giờ Vàng (UTC+7): 08:00, 12:00, 18:00, 20:00, 21:00, 22:00 (60 phút/đợt). /nhiemvu tăng +30% thưởng (5/5 ngày: 170 LT, Tuần: 450–700 LT); Tháp 500 Tầng mốc T100/200/300/400/500 tặng thêm +1 Mảnh Tinh Hoa Hỗn Độn.',
    '• [SHOP ĐẶC BIỆT CHỦ NHẬT (/shop_dacbiet), GACHA 0.65% & ĐỔ THẠCH] (/shop_dacbiet, /roll, /dothach, /autosell, /shop, /info): /shop_dacbiet CHỈ mở Chủ Nhật 08:00–24:00 (UTC+7), quy đổi 1 chiều 750 LT = 1 Tinh Thể Đỏ Vàng (TT) (tối thiểu 5 TT, tối đa 200 TT/tuần) để mua Hồng Mông Tiến Hóa Tinh (120 TT), Thẻ Chọn Thần Thoại (55 TT — chọn 1/7 nhóm, ưu tiên món chưa có), Đá Tuyệt Ấn (40 TT), Mảnh Hỗn Độn, Bùa Tuyệt Ấn (+5 lượt nâng tỉ lệ Đá Tuyệt Ấn /explorer lên 25%), Thẻ Auto Farm 24h, Bùa Bảo Vệ & 5 Khung Đặc Biệt. Gacha /roll nâng tỉ lệ Thần Thoại+ lên 0.65% (tách cố định 0.0325% Độc Nhất miễn nhiễm Luck, Pity 350 ra 5% Độc Nhất). /dothach giảm -10% tỉ lệ xịt ở cả 4 sạp & đổi tên Hộp Thần Thoại Cực Phẩm. /daily tăng lên 55–80 LT, /job tăng +30%.',
    '• [LÒ LUYỆN ĐAN, NÔNG TRẠI, KHÁM PHÁ & QUÀ v1.7] (/luyendan, /farm, /exchange, /gieoque, /explorer, /wiki, /updates): /luyendan 2 Lò song song tối đa 6 mẻ/ngày + Thẻ Bảo Vệ Cháy Đan (+2h tự cứu). /farm tối đa 8 ô, tưới nước/cho ăn nay giảm -30 phút chín + có Thẻ Auto Farm 24h, Thẻ Bảo Vệ Cây & Trứng (+2h), Thuốc Tốc Độ (-25% giờ), Bột Sản Lượng (+30% Linh Quả). /explorer 12 Địa Danh có đồng bộ Bộ 1/2/3 & rơi Mảnh Hỗn Độn 0.5%. /updates v1.7 chia 3 trang (Trang Trước/Sau) tặng trọn gói quà mở bản: +3.000 LT + 5 Tinh Thể Đỏ Vàng (TT) + 5 Thẻ Reset Tháp (vượt trần 15 vẫn nhận đủ) + 300 Linh Quả + 1 Ấn Khắc Tuyệt Đối!',
  ];
  if (includeFuyumiSecret) {
    lines.push('• [BỘ TỐI THƯỢNG ĐỘC TÔN CỦA TIỂU THƯ FUYUMI]: Tiểu thư sở hữu Cửu Vĩ Hồng Hồ (cuu_vi_hong_ho), Viền Cửu Vĩ Hồng Mông Ấn (frame_kitsune_mythic) cùng Linh Vực Cửu Vĩ Hồng Mông (Đạo Áp 3 hiệp +30%), Thần Thức Thái Thượng Hồng Hồ và Thần Cảnh Vạn Cổ Tuyệt Diệt.');
  }
  return lines.join('\n');
}

function updateAiPromptTextV17(oldPrompt, includeFuyumiSecret) {
  let text = String(oldPrompt || '');
  text = text.replace(/tài liệu(?: hệ thống)? v1\.[0-9]+(?:\.[0-9]+)? bên dưới/g, 'tài liệu hệ thống v1.7 bên dưới');
  const startMatch = text.match(/KIẾN THỨC CHÍNH THỨC (?:TOÀN BỘ )?HỆ THỐNG BOT NHIỄM NHIỄM/);
  const sIdx = startMatch ? startMatch.index : -1;
  const endMarker = '\n\nBỘ DANH SÁCH EMOTE ĐỘNG DISCORD CHÍNH THỨC:';
  const eIdx = text.indexOf(endMarker);
  if (sIdx === -1 || eIdx === -1 || eIdx <= sIdx) {
    throw new Error(`Could not locate knowledge markers inside AI prompt (s=${sIdx}, e=${eIdx})`);
  }
  return text.slice(0, sIdx) + buildV17KnowledgeBlock(includeFuyumiSecret) + text.slice(eIdx);
}

function sweepTreeV17(tree) {
  const walk = (obj) => {
    if (typeof obj === 'string') {
      return obj
        .replace(/(?:Tôi Đã Đọc & )?Xác Nhận(?: Cập Nhật)?(?: v1\.[0-9]+)? \((?:\+[\d.,]+ LT|Nhận Gói Quà Lớn!)\)/g, ACK_BTN_LABEL_V17)
        .replace(/Cập nhật (?:SuMi )?v1\.[0-9]+(?:\.[0-9]+)?/g, 'Cập nhật v1.7');
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
  const dfs = (u) => {
    state.set(u, 1);
    for (const v of adj.get(u) || []) {
      const st = state.get(v) || 0;
      if (st === 1) throw new Error(`Cycle detected in ${label}: ${u} -> ${v}`);
      if (st === 0) dfs(v);
    }
    state.set(u, 2);
  };
  for (const n of nodes) if ((state.get(n) || 0) === 0) dfs(n);
}

function assertUniqueApiActionNames(elements, label) {
  const seen = new Set();
  for (const el of elements) {
    if (el.type === 'action' && el.data?.data?.type === 'api_action') {
      const n = el.data?.data?.name;
      if (!n) throw new Error(`Unnamed api_action in ${label}: ${el.id}`);
      if (seen.has(n)) throw new Error(`Duplicate api_action name "${n}" in ${label}`);
      seen.add(n);
    }
  }
}

function assertSelectLimitsAndRegex(elements, label) {
  for (const el of elements) {
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
}

function validateTreeStrict(els, label) {
  assertAcyclicDAG(els, label);
  assertUniqueApiActionNames(els, label);
  assertSelectLimitsAndRegex(els, label);
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
  console.log(`SuMi Family Ver 1.7 BotGhost Full Deployer (${dryRun ? 'DRY RUN' : 'LIVE CDP'})`);
  console.log(`============================================================\n`);

  const specs = [];
  const fullBuilders = [
    ['updates', buildUpdatesV17Cmd],
    ['tienhoa', buildTienHoaV17Cmd],
    ['shop_dacbiet', buildShopDacBietV17Cmd],
    ['wiki', buildWikiV17Cmd],
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
    console.log('\n[DRY-RUN] All Ver 1.7 BotGhost graphs validated with 0 errors!');
    return;
  }

  const liveState = await fetchAllLiveReduxState();
  const cmdMap = new Map(liveState.cmds.map((c) => [c.name, c]));

  if (shouldRun('shop') && cmdMap.has('shop')) {
    const oldTree = JSON.parse(LZString.decompressFromBase64(cmdMap.get('shop').compressed_tree));
    const newTree = patchShopTreeV17(oldTree);
    validateTreeStrict(newTree, 'shop');
    specs.push({ name: 'shop', kind: 'slash', groupId: cmdMap.get('shop').groupId || PROFILE_GROUP_ID, elements: newTree });
  }

  if (shouldRun('explorer') && cmdMap.has('explorer')) {
    const oldTree = JSON.parse(LZString.decompressFromBase64(cmdMap.get('explorer').compressed_tree));
    const newTree = patchExplorerTreeV17(oldTree);
    validateTreeStrict(newTree, 'explorer');
    specs.push({ name: 'explorer', kind: 'slash', groupId: cmdMap.get('explorer').groupId || PROFILE_GROUP_ID, elements: newTree });
  }

  if (shouldRun('dothach') && cmdMap.has('dothach')) {
    const oldTree = JSON.parse(LZString.decompressFromBase64(cmdMap.get('dothach').compressed_tree));
    const newTree = patchDothachTreeV17(oldTree);
    validateTreeStrict(newTree, 'dothach');
    specs.push({ name: 'dothach', kind: 'slash', groupId: cmdMap.get('dothach').groupId || PROFILE_GROUP_ID, elements: newTree });
  }

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
          parsed.systemInstruction.parts[0].text = updateAiPromptTextV17(curText, includeFuyumi);
          el.data.data.request_options.rawBody = JSON.stringify(parsed);
          updatedCount += 1;
        }
      }
    }
    if (updatedCount === 0) throw new Error('No AI prompt blocks updated');
    console.log(`[AI MENTION] Prepared ${updatedCount} prompt blocks with Ver 1.7 knowledge.`);
    specs.push({ name: aiEv.name, kind: 'event', int_id: AI_MENTION_INT_ID, elements: tree });
  }

  if (shouldRun('sweep')) {
    const alreadyHandled = new Set([
      'updates', 'tienhoa', 'shop_dacbiet', 'wiki', 'shop', 'explorer', 'dothach',
      'info', 'exp', 'giveaway_create', 'giveaway_end', 'giveaway_list', 'giveaway_cancel', 'giveaway_check',
      'play', 'queue', 'music', 'sound', 'sticky-set', 'sticky-off',
    ]);
    for (const [cmdName, cmdObj] of cmdMap.entries()) {
      if (alreadyHandled.has(cmdName) || !cmdObj.enabled) continue;
      const oldTree = JSON.parse(LZString.decompressFromBase64(cmdObj.compressed_tree));
      const newTree = sweepTreeV17(oldTree);
      if (JSON.stringify(oldTree) !== JSON.stringify(newTree)) {
        validateTreeStrict(newTree, `sweep:${cmdName}`);
        specs.push({ name: cmdName, kind: 'slash', groupId: cmdObj.groupId || PROFILE_GROUP_ID, elements: newTree });
      }
    }
  }

  console.log(`Deploying ${specs.length} Ver 1.7 command/event updates via Edge CDP...`);
  const deployedSummary = [];
  for (const sp of specs) {
    console.log(`\n--> Deploying ${sp.kind}:${sp.name} (${sp.elements.length} elements)...`);
    let res = await deployViaCDP({
      groupId: sp.groupId || PROFILE_GROUP_ID,
      mode: sp.kind === 'event' ? 'event' : 'command',
      name: sp.name,
      elements: sp.elements,
      enabled: true,
    });
    if (!res?.ok && res?.timeout && !res?.saveFailed) {
      console.log(`    [RETRY] Transient save timeout on ${sp.name} (likely BotGhost burst rate limit); resting 12s & retrying once...`);
      await new Promise((r) => setTimeout(r, 12000));
      res = await deployViaCDP({
        groupId: sp.groupId || PROFILE_GROUP_ID,
        mode: sp.kind === 'event' ? 'event' : 'command',
        name: sp.name,
        elements: sp.elements,
        enabled: true,
      });
    }
    console.log(`    [RESULT] ${sp.name}`, JSON.stringify(res || {}));
    if (!res?.ok) throw new Error(`Deploy failed for ${sp.name}: ${JSON.stringify(res)}`);
    if (res.beforeSave && res.afterSave && res.afterSave === res.beforeSave) {
      throw new Error(`Server save timestamp did not advance for ${sp.name} (beforeSave === afterSave === ${res.beforeSave}) — likely Save Failed / non-Owner!`);
    }
    if (res.builderSaveRequired) throw new Error(`builderSaveRequired still true after deploying ${sp.name}`);
    deployedSummary.push({ kind: sp.kind, name: sp.name, elements: sp.elements.length, ok: true });
    // Pacing 3.5s between BotGhost cloud saves to stay under burst rate limits
    await new Promise((r) => setTimeout(r, 3500));
  }

  // Mandatory Post-Save Full Page Reload + Cloud LZ-Decompressed Audit!
  console.log('\n[VERIFY] Reloading BotGhost dashboard from server to prove real cloud persistence...');
  await cdpEval(`(() => { location.reload(); return true; })()`, 15000).catch(() => {});
  await new Promise((r) => setTimeout(r, 6000));
  let postState = null;
  for (let attempt = 1; attempt <= 12; attempt += 1) {
    try {
      const candidate = await fetchAllLiveReduxState();
      if (candidate?.cmds?.length >= 50) {
        postState = candidate;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 2000));
  }
  if (!postState) throw new Error('Timed out waiting for BotGhost Redux to rehydrate after reload');
  const postCmds = new Map(postState.cmds.map((c) => [c.name, c]));
  let totalApiActionsAudited = 0;
  const auditApiActions = (els, label) => {
    const apis = els.filter((e) => e.type === 'action' && e.data?.data?.type === 'api_action');
    for (const a of apis) {
      const ro = a.data?.data?.request_options || {};
      const url = String(ro.url || '').trim();
      const method = String(ro.method || '').toUpperCase();
      const varName = String(a.data?.data?.name || '').trim();
      if (!url.startsWith('https://')) throw new Error(`API audit FAILED on ${label}.${a.id}: empty/invalid URL "${url}"`);
      if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) throw new Error(`API audit FAILED on ${label}.${a.id}: invalid method "${method}"`);
      if (!varName) throw new Error(`API audit FAILED on ${label}.${a.id}: missing response variable name`);
      if (a.data?.data?.validated === false) throw new Error(`API audit FAILED on ${label}.${a.id}: validated === false`);
      if (method === 'POST' && url.includes('sumi-profile-backend.onrender.com')) {
        const hdrs = Array.isArray(ro.headers) ? ro.headers : [];
        const hasKey = hdrs.some((h) => String(h.key || '').toLowerCase() === 'x-api-key' && String(h.value || '').trim().length > 0);
        if (!hasKey) throw new Error(`API audit FAILED on ${label}.${a.id}: missing x-api-key header on POST ${url}`);
        const hasBody = (typeof ro.rawBody === 'string' && ro.rawBody.trim().length > 2) || (Array.isArray(ro.body) && ro.body.length > 0);
        if (!hasBody) throw new Error(`API audit FAILED on ${label}.${a.id}: empty body on POST ${url}`);
      }
      totalApiActionsAudited += 1;
    }
    return apis.length;
  };

  for (const item of deployedSummary) {
    if (item.kind === 'slash') {
      const c = postCmds.get(item.name);
      if (!c?.compressed_tree) throw new Error(`Post-reload cloud verify missing /${item.name}`);
      if (c.enabled === false) throw new Error(`Post-reload cloud verify: /${item.name} is DISABLED!`);
      const els = JSON.parse(LZString.decompressFromBase64(c.compressed_tree));
      validateTreeStrict(els, `cloud:${item.name}`);
      if (els.length !== item.elements) {
        throw new Error(`Post-reload cloud element count mismatch on /${item.name}: expected ${item.elements}, got ${els.length}`);
      }
      const apiCnt = auditApiActions(els, `/${item.name}`);
      console.log(`  [CLOUD RELOAD OK] /${item.name}: ${els.length} els, ${apiCnt} api_action(s) verified 100% from server.`);
    } else {
      const ev = postState.events.find((e) => e.int_id === AI_MENTION_INT_ID || e.id === AI_MENTION_INT_ID);
      if (!ev?.compressed_tree) throw new Error('Post-reload cloud verify missing AI Mention event');
      const els = JSON.parse(LZString.decompressFromBase64(ev.compressed_tree));
      const txt = JSON.stringify(els);
      if (!txt.includes('/tienhoa') || !txt.includes('/shop_dacbiet') || !txt.includes('3.000 LT')) {
        throw new Error('Post-reload cloud verify AI Mention missing Ver 1.7 knowledge strings!');
      }
      const apiCnt = auditApiActions(els, `event:${ev.name}`);
      console.log(`  [CLOUD RELOAD OK] event:${ev.name}: ${els.length} els, ${apiCnt} api_action(s) & Ver 1.7 knowledge verified from server.`);
    }
  }
  console.log(`\n[DONE] Deployed & server-reload verified ${deployedSummary.length} Ver 1.7 BotGhost targets (${totalApiActionsAudited} api_action blocks 100% intact)!`);
}

main().catch((err) => {
  console.error('[deploy_v1_7_full_botghost] FAILED:', err);
  process.exit(1);
});
