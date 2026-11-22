/**
 * scripts/deploy_v1_4_7_botghost.mjs
 * Triển khai toàn bộ cập nhật SuMi Family v1.4.7 lên BotGhost qua Edge CDP (9222):
 * 1. NEW /autosell — cấu hình tự động bán Phẩm Cấp khi /roll (+ Update Ack Gate +800 LT, 0 footer)
 * 2. REBUILD /updates — Dropdown chọn phiên bản edit tin nhắn tại chỗ (7 bước unrolled DAG, luôn giữ dropdown, v1.4.7 mới nhất)
 * 3. PATCH /battle — maxTurns:30, chuỗi H1 -> H5 -> H10 -> H15 -> H20 -> Final, giữ Web Logs, 0 footer, nút +800 LT
 * 4. REBUILD /wiki — 7 chuyên mục rút gọn v1.4.7, Pháp Bảo 3 nút Xám (SECONDARY) có emoji -> 3 dropdown/loại (57/54/54),
 *    Linh Thú 5 dropdown đủ 90/90 pet, ?v=1.4.7, 0 footer
 * 5. PATCH Nhiễm Nhiễm — AI Mention — khối kiến thức v1.4.7 (0 rò rỉ)
 * 6. GLOBAL SWEEP — Quét toàn bộ Slash Command & Custom Event Tu Tiên: bỏ footer non-Giveaway,
 *    đồng bộ nút 'Tôi Đã Đọc & Xác Nhận (+800 LT)', remap toàn bộ ID Emoji v1.3 HD mới nhất.
 */

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
import { EQUIPMENT_CATALOG, PET_CATALOG } from '../src/data/catalog.js';
import { WIKI_CATEGORIES } from '../src/services/wikiService.js';

const PROFILE_GROUP_ID = '1782127263978';
const BACKEND_BASE = 'https://sumi-profile-backend.onrender.com';
const AI_MENTION_INT_ID = '4cc5db30-029c-4a55-86e6-6e6850012afd';
const REMAP_PATH = 'C:/Users/Fuyumi-ASUSF16/.gemini/antigravity/brain/6c4e030b-fb59-4575-8414-9779337f61d9/scratch/emoji_id_remap_v147.json';

const CUSTOM_EMOJIS_RAW = JSON.parse(
  fs.readFileSync(new URL('../src/config/custom_emojis.json', import.meta.url), 'utf8'),
);

function loadRemapMap() {
  if (!fs.existsSync(REMAP_PATH)) return {};
  const raw = JSON.parse(fs.readFileSync(REMAP_PATH, 'utf8'));
  const out = {};
  for (const [k, v] of Object.entries(raw)) {
    if (/^\d{17,22}$/.test(k) && v && typeof v === 'object' && v.newId) {
      out[k] = v;
    }
  }
  return out;
}

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

class V147GraphBuilder extends GraphBuilder {
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
      if (opts.length < 1 || opts.length > 25) {
        throw new Error(`Select "${el.id}" in ${label} has invalid option count (${opts.length})`);
      }
    }
    if (dt?.type === 'matches_pattern' || dt?.type === 'not_matches_pattern') {
      const pat = String(dt.comparison_value ?? '');
      const errs = validateRegexSafety(pat);
      if (errs.length) {
        throw new Error(`Unsafe/invalid matches_pattern regex in ${label} (${el.id}): ${errs.join('; ')}`);
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
  fields = undefined,
  footer = '',
  target = { reply: true },
  editId = undefined,
  action_id = undefined,
}, pos = { x: 0, y: 0 }) {
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

function btnCfg(label, style, emojiName, row = '1', weight = '1', showReplies = 'show') {
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
// 1. NEW /autosell — Tự động bán đồ phẩm chất thấp khi /roll
// ============================================================================
export function buildAutosellV147Cmd() {
  const gb = new V147GraphBuilder();
  gb.rootSlash('autosell', 'Cài đặt tự động bán Phàm/Linh/Tiên Phẩm khi /roll (luôn bảo vệ Thần Thoại)', { ephemeral: false });
  gb.errorHandlerWait();

  gb.option('pham_pham', 'string', 'Tự động bán Phàm Phẩm khi /roll (yes/no)', {
    required: false,
    choices: ['yes', 'no'],
    x: 420,
    y: 0,
  });
  gb.option('linh_pham', 'string', 'Tự động bán Linh Phẩm khi /roll (yes/no)', {
    required: false,
    choices: ['yes', 'no'],
    x: 700,
    y: 0,
  });
  gb.option('tien_pham', 'string', 'Tự động bán Tiên Phẩm khi /roll (yes/no)', {
    required: false,
    choices: ['yes', 'no'],
    x: 980,
    y: 0,
  });
  gb.option('giu_mon_moi', 'string', 'Giữ bản đầu tiên chưa sở hữu, chỉ bán khi trùng (yes/no)', {
    required: false,
    choices: ['yes', 'no'],
    x: 1260,
    y: 0,
  });

  embedMsg(gb, 'as_ack', {
    title: `${uidEm('su_gacha_dice')} Đang cập nhật cấu hình AutoSell...`,
    description: 'Đang đồng bộ quy tắc tự động bán khi `/roll`...',
    color: '#10b981',
    footer: '',
    target: { reply: true },
    editId: 'as_ack',
  }, { x: 0, y: 200 });
  gb.link('root', 'as_ack');

  apiAction(gb, 'as_api', 'as_res', 'POST', `${BACKEND_BASE}/api/economy/autosell`,
    '{"userId":"{user_id}","pham_pham":"{option_pham_pham}","linh_pham":"{option_linh_pham}","tien_pham":"{option_tien_pham}","giu_mon_moi":"{option_giu_mon_moi}","username":"{user_displayName}","fallbackUsername":"{user_name}","avatarUrl":"{user_avatar}"}',
    { x: 0, y: 380 });
  gb.link('as_ack', 'as_api');

  const asNoAck = attachUpdateAckBranch(gb, 'as', 'as_api', 'as_res', { editId: 'as_ack', x: 0, y: 560 });

  const cOk = gb.cmp('as_ok', '{as_res.response.success}', 'true', 'equal_to', { ignoreCase: true }, { x: 0, y: 740 });
  gb.link(asNoAck, cOk.condId);

  embedMsg(gb, 'as_edit_ok', {
    title: '{as_res.response.title}',
    description: '{as_res.response.description}',
    color: '#10b981',
    footer: '',
    target: { editId: 'as_ack' },
    action_id: 'as_ack',
  }, { x: -240, y: 940 });
  gb.link(cOk.yes, 'as_edit_ok');

  embedMsg(gb, 'as_edit_err', {
    title: `${uidEm('su_gacha_dice')} KHÔNG THỂ CẬP NHẬT AUTOSELL`,
    description: '{as_res.response.message}',
    color: '#ef4444',
    footer: '',
    target: { editId: 'as_ack' },
    action_id: 'as_ack',
  }, { x: 240, y: 940 });
  gb.link(cOk.no, 'as_edit_err');

  return gb.elements();
}

// ============================================================================
// 2. REBUILD /updates — Edit tin nhắn tại chỗ + luôn giữ Dropdown (7 bước unrolled DAG)
// ============================================================================
function buildUpdateVersionOptions() {
  return [
    {
      label: 'Phiên bản v1.4.7 (Mới nhất)',
      description: 'AutoSell, Tháp 500 tầng, Web Battle Logs 48h, Wiki rút gọn & HD 512×512',
      emoji_id: uidId('su_sparkle'),
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
      description: 'Khắc Ấn D→S, 6 Việc Làm /job, Tháp Thí Luyện & Túi Đồ /inv mới',
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
}

export function buildUpdatesV147Cmd() {
  const gb = new V147GraphBuilder();
  gb.rootSlash('updates', 'Xem bản cập nhật mới nhất (v1.4.7) và chuyển xem lịch sử ngay tại chỗ', { ephemeral: false });
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

  const verOpts = buildUpdateVersionOptions();
  const MAX_SWITCHES = 7;

  let curMsgId = 'upds_msg_0';
  for (let k = 1; k <= MAX_SWITCHES; k += 1) {
    const prevIdx = k - 1;
    const baseY = 400 + k * 540;
    const selId = `sel_upds_${prevIdx}`;
    const varName = `picked_upd_ver_${prevIdx}`;
    const apiId = `upds_ver_api_${k}`;
    const resName = `upds_vres_${k}`;
    const msgId = `upds_msg_${k}`;

    gb.advSelectMenu(selId, curMsgId, {
      placeholder: 'Chọn phiên bản để xem ngay trên bảng này (v1.4.7 → v1.1)...',
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
// 3. PATCH /battle — maxTurns 30, H1->H5->H10->H15->H20->Final, giữ Web Logs, 0 footer
// ============================================================================
export function patchBattleV147(origTree) {
  const REMOVE_IDS = new Set([
    'battle_edit_f1',
    'battle_wait_1',
    'b_has_f3',
    'b_has_f3_yes',
    'b_has_f3_no',
    'battle_edit_f2_mid',
    'battle_wait_2',
  ]);

  let els = JSON.parse(JSON.stringify(origTree)).filter((el) => {
    if (el.id && REMOVE_IDS.has(el.id)) return false;
    if (el.source && el.target) {
      if (REMOVE_IDS.has(el.source) || REMOVE_IDS.has(el.target)) return false;
      if (el.source === 'b_is_ok_yes' && el.target === 'battle_edit_f1') return false;
    }
    return true;
  });

  for (const el of els) {
    if (el.id === 'battle_api' && el.data?.data?.request_options?.rawBody) {
      el.data.data.request_options.rawBody = el.data.data.request_options.rawBody
        .replace(/"maxTurns"\s*:\s*\d+/, '"maxTurns":30');
    }
  }

  const gb = new V147GraphBuilder();
  embedMsg(gb, 'battle_edit_f1', {
    title: '{battle_res.response.frame1Title}',
    description: '',
    color: '#f472b6',
    imageUrl: '{battle_res.response.frame1Url}',
    footer: '',
    target: { editId: 'battle_ack' },
    action_id: 'battle_ack',
  }, { x: 0, y: 1480 });
  gb.link('b_is_ok_yes', 'battle_edit_f1');

  gb.act('battle_wait_1', 'wait_action', { seconds: '2', success_handles: false }, { x: 0, y: 1660 });
  gb.link('battle_edit_f1', 'battle_wait_1');

  let prevWaitId = 'battle_wait_1';
  const frameNums = [3, 4, 5, 6];
  for (let idx = 0; idx < frameNums.length; idx += 1) {
    const fn = frameNums[idx];
    const midIdx = fn - 1;
    const baseY = 1840 + idx * 540;

    const c = gb.cmp(`b_has_f${fn}`, `{battle_res.response.hasFrame${fn}}`, 'true', 'equal_to', { ignoreCase: true }, { x: 0, y: baseY });
    gb.link(prevWaitId, c.condId);

    const midMsgId = `battle_edit_f${midIdx}_mid`;
    const midWaitId = `battle_wait_${midIdx}`;

    embedMsg(gb, midMsgId, {
      title: `{battle_res.response.frame${midIdx}Title}`,
      description: '',
      color: '#c084fc',
      imageUrl: `{battle_res.response.frame${midIdx}Url}`,
      footer: '',
      target: { editId: 'battle_ack' },
      action_id: 'battle_ack',
    }, { x: -240, y: baseY + 180 });
    gb.link(c.yes, midMsgId);

    gb.act(midWaitId, 'wait_action', { seconds: '2', success_handles: false }, { x: -240, y: baseY + 360 });
    gb.link(midMsgId, midWaitId);

    gb.link(c.no, 'battle_edit_final');
    prevWaitId = midWaitId;
  }

  gb.link(prevWaitId, 'battle_edit_final');

  // Reposition battle_edit_final and downstream web logs cleanly
  const finalNode = els.find((e) => e.id === 'battle_edit_final');
  if (finalNode) finalNode.position = { x: 240, y: 4060 };
  const btnLogs = els.find((e) => e.id === 'btn_battle_logs');
  if (btnLogs) btnLogs.position = { x: 240, y: 4260 };
  const apiLogs = els.find((e) => e.id === 'api_battle_logs');
  if (apiLogs) apiLogs.position = { x: 240, y: 4440 };
  const msgLogs = els.find((e) => e.id === 'msg_battle_logs');
  if (msgLogs) msgLogs.position = { x: 240, y: 4620 };

  return [...els, ...gb.elements()];
}

// ============================================================================
// 4. REBUILD /wiki — 7 chuyên mục rút gọn, Pháp Bảo 3 nút Xám (57/54/54), Linh Thú 90/90
// ============================================================================
const RARITY_ORDER = { common: 0, rare: 1, epic: 2, mythic: 3, supreme: 4 };

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

function buildEquipmentDropdownOptions(items) {
  return [...items]
    .sort((a, b) => {
      const ra = RARITY_ORDER[a.rarity_key] ?? 9;
      const rb = RARITY_ORDER[b.rarity_key] ?? 9;
      if (ra !== rb) return ra - rb;
      if (Boolean(a.is_unique) !== Boolean(b.is_unique)) return a.is_unique ? 1 : -1;
      return String(a.item_id).localeCompare(String(b.item_id));
    })
    .map((e) => ({
      label: String(e.item_name || e.item_id).slice(0, 95),
      description: `[${e.rarity}${e.is_unique ? ' • Độc Nhất' : ''}] ${e.element} • ${e.hax_skill || 'Chỉ số thuần'}`.slice(0, 95),
      emoji_id: uidId(e.emoji_key || e.item_id),
      value: e.item_id,
    }));
}

function buildPetDropdownOptions(pets) {
  return [...pets]
    .sort((a, b) => {
      if (Boolean(a.is_unique) !== Boolean(b.is_unique)) return a.is_unique ? 1 : -1;
      return String(a.pet_name).localeCompare(String(b.pet_name), 'vi');
    })
    .map((p) => ({
      label: String(p.pet_name || p.pet_type).slice(0, 95),
      description: `[Hệ ${p.element}${p.is_unique ? ' • Độc Nhất' : ''}] ${p.hax_skill || 'Chiến Hồn'}`.slice(0, 95),
      emoji_id: uidId(p.emoji_key || p.pet_type),
      value: p.pet_type,
    }));
}

export function buildWikiV147Cmd() {
  const gb = new V147GraphBuilder();
  gb.rootSlash('wiki', 'Cẩm nang tu tiên SuMi Family v1.4.7 — rút gọn rõ ràng, tra 90 Linh Thú & 165 Pháp Bảo', { ephemeral: false });
  gb.errorHandlerWait();

  gb.option('chuyen_muc', 'string', 'Chuyên mục cần tra cứu (tùy chọn)', {
    required: false,
    choices: ['overview', 'realms', 'battle', 'equipment', 'pets', 'economy', 'explorer'],
    x: 420,
    y: 0,
  });

  const ovEmb = WIKI_CATEGORIES.overview?.embed || WIKI_CATEGORIES.overview;
  const rlEmb = WIKI_CATEGORIES.realms?.embed || WIKI_CATEGORIES.realms;
  const btEmb = WIKI_CATEGORIES.battle?.embed || WIKI_CATEGORIES.battle;
  const eqEmb = WIKI_CATEGORIES.equipment?.embed || WIKI_CATEGORIES.equipment;
  const ptEmb = WIKI_CATEGORIES.pets?.embed || WIKI_CATEGORIES.pets;
  const ecEmb = WIKI_CATEGORIES.economy?.embed || WIKI_CATEGORIES.economy;

  // Root category router
  const cRoot = gb.cond('w_root_cat', 'comparison', { base_value: '{option_chuyen_muc}', target: { self: true } }, { x: 0, y: 200 });
  gb.link('root', cRoot);

  const brRootRealms = gb.branch(cRoot, 'wr_realms', 'comparison', { type: 'equal_to', comparison_value: 'realms', ignoreCase: true }, { x: -750, y: 380 });
  const brRootBattle = gb.branch(cRoot, 'wr_battle', 'comparison', { type: 'equal_to', comparison_value: 'battle', ignoreCase: true }, { x: -450, y: 380 });
  const brRootEquip = gb.branch(cRoot, 'wr_equip', 'comparison', { type: 'equal_to', comparison_value: 'equipment', ignoreCase: true }, { x: -150, y: 380 });
  const brRootPets = gb.branch(cRoot, 'wr_pets', 'comparison', { type: 'equal_to', comparison_value: 'pets', ignoreCase: true }, { x: 150, y: 380 });
  const brRootEcon = gb.branch(cRoot, 'wr_econ', 'comparison', { type: 'equal_to', comparison_value: 'economy', ignoreCase: true }, { x: 450, y: 380 });
  const brRootExplorer = gb.branch(cRoot, 'wr_explorer', 'comparison', { type: 'equal_to', comparison_value: 'explorer', ignoreCase: true }, { x: 750, y: 380 });
  const brRootOverview = gb.branch(cRoot, 'wr_overview', 'comparison', { type: 'equal_to', comparison_value: 'overview', ignoreCase: true }, { x: 1050, y: 380 });
  const brRootHome = gb.elseBranch(cRoot, 'wr_home', 'comparison', { x: 1350, y: 380 });

  // Home + select category menu
  embedMsg(gb, 'msg_wiki_home', {
    title: `${uidEm('su_wiki_scroll')} CẨM NANG TU TIÊN SUMI FAMILY v1.4.7`,
    description: 'Bách khoa tu tiên **v1.4.7**: AutoSell, Tháp 500 tầng, Web Battle Logs 48h, **90 Linh Thú**, **165 Pháp Bảo**, **30 Linh Vực** & **12 Map Khám Phá**. Chọn chuyên mục bên dưới:',
    color: '#ec4899',
    fields: ovEmb.fields,
    footer: '',
    target: { reply: true },
  }, { x: 1350, y: 580 });
  gb.link(brRootHome, 'msg_wiki_home');

  gb.advSelectMenu('sel_wiki_cat', 'msg_wiki_home', {
    placeholder: 'Chọn chuyên mục Cẩm Nang Tu Tiên (7 mục)...',
    customVariableName: 'wiki_cat',
    basic_options: [
      { label: 'Tổng Quan & Toàn Bộ Lệnh', description: 'Tất cả lệnh Gameplay, AutoSell, Nhạc & Tiện Ích', emoji_id: uidId('su_wiki_scroll'), value: 'overview' },
      { label: 'Cảnh Giới & Thăng Cấp EXP', description: '7 Đại Cảnh Giới, Chat 23-35 EXP (+15%) & /exp Boost', emoji_id: uidId('su_realm_7_hondondao'), value: 'realms' },
      { label: 'Đấu Trường & Hệ Thống Linh Vực', description: '1v1 H1/5/10/15/20, Web Logs 48h & Đạo Áp Thần Thoại', emoji_id: uidId('su_arena'), value: 'battle' },
      { label: 'Kho Pháp Bảo Loadout (165 Món)', description: '57 Vũ Khí • 54 Bảo Ngọc • 54 Chiến Hồn + Khắc Ấn D→S', emoji_id: uidId('su_crossed_swords'), value: 'equipment' },
      { label: 'Linh Thú Tiên Giới (90 Chiến Pet)', description: 'Đầy đủ 90 Linh Thú (13 Phàm • 13 Linh • 14 Tiên • 50 TT)', emoji_id: uidId('su_pet_paw'), value: 'pets' },
      { label: 'Kinh Tế, Tháp 500 & Daily Xoay Vòng', description: '/autosell, Tháp 500 tầng, Daily +10%, /farm & /job', emoji_id: uidId('su_linhthach'), value: 'economy' },
      { label: 'Khám Phá Đại Lục & Bản Đồ 4K', description: '12 Địa Danh (10k→1M), đồ rơi 60% & quy tắc /explorer', emoji_id: uidId('explorer_world_map_v14'), value: 'explorer' },
    ],
    row: '1',
    weight: '1',
    showReplies: 'show',
  }, { x: 1350, y: 780 });

  const cSel = gb.cond('w_sel_cat', 'comparison', { base_value: '{wiki_cat}', target: { self: true } }, { x: 1350, y: 980 });
  gb.link('sel_wiki_cat', cSel);

  const brSelOverview = gb.branch(cSel, 'ws_overview', 'comparison', { type: 'equal_to', comparison_value: 'overview', ignoreCase: true }, { x: 1050, y: 1160 });
  const brSelRealms = gb.branch(cSel, 'ws_realms', 'comparison', { type: 'equal_to', comparison_value: 'realms', ignoreCase: true }, { x: -750, y: 1160 });
  const brSelBattle = gb.branch(cSel, 'ws_battle', 'comparison', { type: 'equal_to', comparison_value: 'battle', ignoreCase: true }, { x: -450, y: 1160 });
  const brSelEquip = gb.branch(cSel, 'ws_equip', 'comparison', { type: 'equal_to', comparison_value: 'equipment', ignoreCase: true }, { x: -150, y: 1160 });
  const brSelPets = gb.branch(cSel, 'ws_pets', 'comparison', { type: 'equal_to', comparison_value: 'pets', ignoreCase: true }, { x: 150, y: 1160 });
  const brSelExplorer = gb.branch(cSel, 'ws_explorer', 'comparison', { type: 'equal_to', comparison_value: 'explorer', ignoreCase: true }, { x: 750, y: 1160 });
  const brSelEcon = gb.elseBranch(cSel, 'ws_econ', 'comparison', { x: 450, y: 1160 });

  // Category embeds
  embedMsg(gb, 'msg_wiki_overview_leaf', {
    title: ovEmb.title,
    description: ovEmb.description,
    color: '#ec4899',
    fields: ovEmb.fields,
    footer: '',
    target: { reply: true },
  }, { x: 1050, y: 1360 });
  gb.link(brRootOverview, 'msg_wiki_overview_leaf');
  gb.link(brSelOverview, 'msg_wiki_overview_leaf');

  embedMsg(gb, 'msg_wiki_realms', {
    title: rlEmb.title,
    description: rlEmb.description,
    color: '#a855f7',
    fields: rlEmb.fields,
    footer: '',
    target: { reply: true },
  }, { x: -750, y: 1360 });
  gb.link(brRootRealms, 'msg_wiki_realms');
  gb.link(brSelRealms, 'msg_wiki_realms');

  embedMsg(gb, 'msg_wiki_battle', {
    title: btEmb.title,
    description: btEmb.description,
    color: '#f43f5e',
    fields: btEmb.fields,
    footer: '',
    target: { reply: true },
  }, { x: -450, y: 1360 });
  gb.link(brRootBattle, 'msg_wiki_battle');
  gb.link(brSelBattle, 'msg_wiki_battle');

  embedMsg(gb, 'msg_wiki_economy', {
    title: ecEmb.title,
    description: ecEmb.description,
    color: '#10b981',
    fields: ecEmb.fields,
    footer: '',
    target: { reply: true },
  }, { x: 450, y: 1360 });
  gb.link(brRootEcon, 'msg_wiki_economy');
  gb.link(brSelEcon, 'msg_wiki_economy');

  apiAction(gb, 'wiki_exp_api', 'wiki_exp_res', 'GET', `${BACKEND_BASE}/api/explorer/map-board?userId={user_id}`, '', { x: 750, y: 1360 });
  gb.link(brRootExplorer, 'wiki_exp_api');
  gb.link(brSelExplorer, 'wiki_exp_api');
  embedMsg(gb, 'msg_wiki_explorer', {
    title: '{wiki_exp_res.response.title}',
    description: '{wiki_exp_res.response.description}',
    imageUrl: `${BACKEND_BASE}/api/explorer/map.webp?v=1.4.7`,
    color: '#10b981',
    footer: '',
    target: { reply: true },
  }, { x: 750, y: 1540 });
  gb.link('wiki_exp_api', 'msg_wiki_explorer');

  // Shared Equipment Detail Viewer (for all 9 dropdowns across 3 slots = 165 items)
  embedMsg(gb, 'eq_detail_ack', {
    title: `${uidEm('su_crossed_swords')} Đang tải Thẻ Pháp Bảo...`,
    description: 'Đang tra cứu thông số, kỹ năng HAX và chủ sở hữu hiện tại từ Supabase...',
    color: '#f59e0b',
    footer: '',
    target: { reply: true },
    editId: 'eq_detail_ack',
  }, { x: -180, y: 2740 });

  apiAction(gb, 'eq_detail_api', 'item_res', 'GET', `${BACKEND_BASE}/api/wiki/item/{wiki_item_id}`, '', { x: -180, y: 2920 });
  gb.link('eq_detail_ack', 'eq_detail_api');

  embedMsg(gb, 'eq_detail_edit', {
    title: '{item_res.response.embed.title}',
    description: '{item_res.response.embed.description}',
    color: '#f59e0b',
    imageUrl: `${BACKEND_BASE}/api/wiki/item/{wiki_item_id}.webp?v=1.4.7`,
    footer: '',
    target: { editId: 'eq_detail_ack' },
    action_id: 'eq_detail_ack',
  }, { x: -180, y: 3100 });
  gb.link('eq_detail_api', 'eq_detail_edit');

  // Equipment hub + 3 GRAY (SECONDARY) buttons with custom emojis -> 3 dropdowns per slot
  embedMsg(gb, 'msg_wiki_equip', {
    title: eqEmb.title,
    description: eqEmb.description,
    color: '#f59e0b',
    fields: eqEmb.fields,
    footer: '',
    target: { reply: true },
  }, { x: -150, y: 1360 });
  gb.link(brRootEquip, 'msg_wiki_equip');
  gb.link(brSelEquip, 'msg_wiki_equip');

  const slotSpecs = [
    { key: 'weapon', label: 'Vũ Khí', emoji: 'su_crossed_swords', count: 57, weight: '1', x: -580 },
    { key: 'gem', label: 'Bảo Ngọc', emoji: 'su_linhthach', count: 54, weight: '2', x: -180 },
    { key: 'soul', label: 'Chiến Hồn', emoji: 'su_thunder_hax', count: 54, weight: '3', x: 220 },
  ];

  for (const sp of slotSpecs) {
    const items = EQUIPMENT_CATALOG.filter((e) => e.item_type === sp.key);
    const btnId = `btn_eq_${sp.key}`;
    const listMsgId = `msg_eq_${sp.key}`;

    gb.advBtn(btnId, 'msg_wiki_equip', btnCfg(`${sp.label} (${items.length})`, 'SECONDARY', sp.emoji, '1', sp.weight, 'show'), {
      x: sp.x,
      y: 1560,
    });
    embedMsg(gb, listMsgId, {
      title: `${uidEm(sp.emoji)} DANH MỤC ${sp.label.toUpperCase()} (${items.length} MÓN)`,
      description: `Chọn một **${sp.label}** từ ${Math.ceil(items.length / 25)} menu bên dưới để xem thẻ Full HD+ & kỹ năng HAX chi tiết.`,
      color: '#f59e0b',
      footer: '',
      target: { reply: true },
    }, { x: sp.x, y: 1740 });
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
      const cx = sp.x + (ci - 1) * 120;

      gb.advSelectMenu(selId, listMsgId, {
        placeholder: `${sp.label} (${startNo}–${endNo} / ${items.length} món)...`,
        customVariableName: varName,
        basic_options: chunk,
        row: String(idx),
        weight: '1',
        showReplies: 'show',
      }, { x: cx, y: 1960 });

      gb.act(setId, 'set_unique_variable', {
        reference: 'wiki_item_id',
        value: `{${varName}}`,
        success_handles: false,
      }, { x: cx, y: 2180 });
      gb.link(selId, setId);
      gb.link(setId, 'eq_detail_ack');
    }
  }

  // Pets hub -> 5 dropdowns covering ALL 90/90 standard pets
  const stdPets = PET_CATALOG.filter((p) => !p.is_exclusive_fuyumi);
  const petGroups = [
    {
      id: 'sel_pet_common',
      setId: 'set_pet_c',
      varName: 'picked_pet_c',
      row: '1',
      placeholder: 'Phàm Phẩm • Tỉ lệ 60.5% (13 Linh Thú)',
      pets: stdPets.filter((p) => p.rarity_key === 'common'),
      x: 560,
    },
    {
      id: 'sel_pet_rare',
      setId: 'set_pet_r',
      varName: 'picked_pet_r',
      row: '2',
      placeholder: 'Linh Phẩm • Tỉ lệ 25% (13 Linh Thú)',
      pets: stdPets.filter((p) => p.rarity_key === 'rare'),
      x: 840,
    },
    {
      id: 'sel_pet_epic',
      setId: 'set_pet_e',
      varName: 'picked_pet_e',
      row: '3',
      placeholder: 'Tiên Phẩm • Tỉ lệ 14% (14 Linh Thú)',
      pets: stdPets.filter((p) => p.rarity_key === 'epic'),
      x: 1120,
    },
    {
      id: 'sel_pet_mythic_1',
      setId: 'set_pet_m1',
      varName: 'picked_pet_m1',
      row: '4',
      placeholder: 'Thần Thoại • Phần 1 (25/50 Linh Thú)',
      pets: stdPets.filter((p) => p.rarity_key === 'mythic').slice(0, 25),
      x: 1400,
    },
    {
      id: 'sel_pet_mythic_2',
      setId: 'set_pet_m2',
      varName: 'picked_pet_m2',
      row: '5',
      placeholder: 'Thần Thoại • Phần 2 (25/50 Linh Thú)',
      pets: stdPets.filter((p) => p.rarity_key === 'mythic').slice(25, 50),
      x: 1680,
    },
  ];

  embedMsg(gb, 'msg_wiki_pets', {
    title: ptEmb.title,
    description: ptEmb.description,
    color: '#ec4899',
    fields: ptEmb.fields,
    footer: '',
    target: { reply: true },
  }, { x: 1120, y: 1360 });
  gb.link(brRootPets, 'msg_wiki_pets');
  gb.link(brSelPets, 'msg_wiki_pets');

  embedMsg(gb, 'pet_detail_ack', {
    title: `${uidEm('su_pet_paw')} Đang tải Thẻ Linh Thú...`,
    description: 'Đang tra cứu hệ nguyên tố, chỉ số ATK/DEF/SPD/HP và kỹ năng HAX...',
    color: '#ec4899',
    footer: '',
    target: { reply: true },
    editId: 'pet_detail_ack',
  }, { x: 1120, y: 2040 });

  apiAction(gb, 'pet_detail_api', 'pet_res', 'GET', `${BACKEND_BASE}/api/wiki/pet/{wiki_pet_id}`, '', { x: 1120, y: 2220 });
  gb.link('pet_detail_ack', 'pet_detail_api');

  embedMsg(gb, 'pet_detail_edit', {
    title: '{pet_res.response.embed.title}',
    description: '{pet_res.response.embed.description}',
    color: '#ec4899',
    imageUrl: `${BACKEND_BASE}/api/wiki/pet/{wiki_pet_id}.webp?v=1.4.7`,
    footer: '',
    target: { editId: 'pet_detail_ack' },
    action_id: 'pet_detail_ack',
  }, { x: 1120, y: 2400 });
  gb.link('pet_detail_api', 'pet_detail_edit');

  for (const pg of petGroups) {
    gb.advSelectMenu(pg.id, 'msg_wiki_pets', {
      placeholder: pg.placeholder,
      customVariableName: pg.varName,
      basic_options: buildPetDropdownOptions(pg.pets),
      row: pg.row,
      weight: '1',
      showReplies: 'show',
    }, { x: pg.x, y: 1620 });

    gb.act(pg.setId, 'set_unique_variable', {
      reference: 'wiki_pet_id',
      value: `{${pg.varName}}`,
      success_handles: false,
    }, { x: pg.x, y: 1820 });
    gb.link(pg.id, pg.setId);
    gb.link(pg.setId, 'pet_detail_ack');
  }

  return gb.elements();
}

// ============================================================================
// 5. PATCH AI MENTION KNOWLEDGE BLOCK (v1.4.7)
// ============================================================================
function buildV147KnowledgeBlock(includeFuyumiSecret) {
  const lines = [
    'KIẾN THỨC CHÍNH THỨC HỆ THỐNG BOT NHIỄM NHIỄM (SUMI FAMILY v1.4.7):',
    '• HỒ SƠ, /EXP BOOST & THĂNG CẤP (/profile, /rank, /exp, /top): Thẻ /profile hiển thị Linh Thú, 3 Pháp Bảo, 5 Role và bộ Linh Vực • Thần Thức • Thần Cảnh. Từ v1.4.7 Chat nhận 23–35 EXP (TB 29, cooldown 45s, tăng +15%), Voice nhận 85–135 EXP/5 phút (TB 110, chấm công 12 phút). Dùng /exp [user] để xem tổng % Boost EXP Chat & Voice. Lên cấp: 60*(Lv^1.45) (max Lv.100 = 500.000 EXP). Mỗi 19:00 Chủ Nhật (UTC+7) tự động vinh danh & phát quà Top 10 Lực Chiến.',
    '• ĐẤU TRƯỜNG NHANH & WEB LOGS 48H (/battle, /linhvuc, /party, /linhmach): /battle giảm 10% dung lượng render để tăng tốc tối đa, phát các khung H1 → H5 → H10 → H15 → H20 → Kết Thúc trên Discord (thắng sớm dừng sớm), kèm nút Xem Nhật Ký Trận Đấu dẫn tới Web Battle Logs lưu trữ 48 giờ (render từng lượt theo yêu cầu khi bấm xem Web). 30 Linh Vực, 15 Thần Thức & 15 Thần Cảnh kích hoạt từ Hiệp 2 với Đạo Áp Thần Thoại. /party lập Tổ Đội 3 người chiếm Mỏ Linh Mạch 6 khung giờ vàng.',
    '• THÁP THÍ LUYỆN 500 TẦNG & NHIỆM VỤ XOAY VÒNG (/nhiemvu, /shop, /daily, /job): Tháp mở rộng tối đa 500 tầng, buff nền +10% với ±12% ngẫu nhiên chiến lực; thẻ Reset Tháp mua tối đa 5 thẻ/ngày (kho tối đa 15); từ F70+ NPC dùng Linh Vực (F150+ Thần Thức, F250+ Thần Cảnh), tỉ lệ Pet/Vũ Khí Thần Thoại, Độc Nhất & Khắc Ấn D→S tăng dần theo tầng. Nhiệm Vụ Ngày xoay vòng 2 cố định + 3 từ 10 hoạt động, thưởng +10%, bonus 5/5 +130 LT. Xác nhận cập nhật v1.4.7 tặng ngay +800 LT.',
    '• AUTOSELL & GACHA KẾ THỪA (/autosell, /roll, /enchant, /dismantle): Dùng /autosell để tự động bán Phàm/Linh/Tiên Phẩm ngay khi /roll cả 4 bể (có tùy chọn Giữ Món Mới, tự kế thừa Tư Chất D→S cao hơn trước khi bán, luôn bảo vệ Thần Thoại). /enchant hỗ trợ Đá thường (Pity +5%) & Thiên Đạo Tuyệt Ấn Thạch (100% A→S).',
    '• KHÁM PHÁ ĐẠI LỤC, KINH TẾ & TRA CỨU (/explorer, /farm, /exchange, /coinflip, /slots, /blackjack, /crash, /giatoc, /equip, /wiki, /updates): /explorer mở 12 map (10k→1M, 2–12h). /equip 1 chạm tự nhận diện UID/Emoji/Role/Tên (title:Tên Mới). /wiki v1.4.7 rút gọn 7 chuyên mục đủ 90 Linh Thú & 165 Pháp Bảo trong menu; /updates chuyển phiên bản tại chỗ.',
  ];
  if (includeFuyumiSecret) {
    lines.push('• BỘ TỐI THƯỢNG THẦN THOẠI ĐỘC NHẤT (TIỂU THƯ FUYUMI SỞ HỮU — CHỈ TIỂU THƯ BIẾT): Tiểu thư sở hữu Cửu Vĩ Hồng Hồ (cuu_vi_hong_ho) cùng bộ Linh Vực Cửu Vĩ Hồng Mông (Đạo Áp 3 hiệp +30%), Thần Thức Thái Thượng Hồng Hồ và Thần Cảnh Vạn Cổ Tuyệt Diệt.');
  }
  return lines.join('\n');
}

function updateAiPromptTextV147(oldPrompt, includeFuyumiSecret) {
  let text = String(oldPrompt || '');
  text = text.replace(/tài liệu(?: hệ thống)? v1\.[0-9]+(?:\.[0-9]+)? bên dưới/g, 'tài liệu hệ thống v1.4.7 bên dưới');
  const startMarker = 'KIẾN THỨC CHÍNH THỨC HỆ THỐNG BOT NHIỄM NHIỄM';
  const endMarker = '\n\nBỘ DANH SÁCH EMOTE ĐỘNG DISCORD CHÍNH THỨC:';
  const sIdx = text.indexOf(startMarker);
  const eIdx = text.indexOf(endMarker);
  if (sIdx === -1 || eIdx === -1 || eIdx <= sIdx) {
    throw new Error(`Could not locate knowledge markers inside AI prompt (s=${sIdx}, e=${eIdx})`);
  }
  return text.slice(0, sIdx) + buildV147KnowledgeBlock(includeFuyumiSecret) + text.slice(eIdx);
}

// ============================================================================
// 6. GLOBAL SWEEP: Remap v1.3 Emoji IDs, Clear Footers, Sync +800 LT Ack Button
// ============================================================================
function replaceEmojiStringsAndSnowflakes(str, remap) {
  if (typeof str !== 'string' || !str) return str;
  let out = str.replace(/<a?:([a-zA-Z0-9_]+):(\d{17,22})>/g, (full, name, id) => {
    const rm = remap[id];
    if (rm?.newTag) return rm.newTag;
    const byName = emojiRow(name);
    if (byName?.id) return byName.animated ? `<a:${byName.name}:${byName.id}>` : `<:${byName.name}:${byName.id}>`;
    return full;
  });
  out = out.replace(/\b(\d{17,22})\b/g, (id) => (remap[id]?.newId ? remap[id].newId : id));
  return out;
}

function walkAndSweepNode(obj, { clearFooter, remap }) {
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i += 1) {
      if (typeof obj[i] === 'string') {
        obj[i] = replaceEmojiStringsAndSnowflakes(obj[i], remap);
      } else if (obj[i] && typeof obj[i] === 'object') {
        walkAndSweepNode(obj[i], { clearFooter, remap });
      }
    }
    return;
  }
  if (!obj || typeof obj !== 'object') return;

  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (typeof val === 'string') {
      obj[key] = replaceEmojiStringsAndSnowflakes(val, remap);
    } else if (val && typeof val === 'object') {
      walkAndSweepNode(val, { clearFooter, remap });
    }
  }

  // Sync animated boolean on component emoji objects if remapped
  if (obj.emoji && typeof obj.emoji === 'object' && obj.emoji.id) {
    const byName = obj.emoji.name ? emojiRow(obj.emoji.name) : null;
    if (byName && obj.emoji.id === byName.id) {
      obj.emoji.animated = Boolean(byName.animated);
    }
  }

  // Sync +800 LT Update Ack button label & done embed title
  if (obj.type === 'button' && typeof obj.label === 'string' && /Tôi Đã Đọc & Xác Nhận/i.test(obj.label)) {
    obj.label = 'Tôi Đã Đọc & Xác Nhận (+800 LT)';
  }
  if (typeof obj.title === 'string' && /ĐÃ XÁC NHẬN CẬP NHẬT v1\.[0-9]+/i.test(obj.title)) {
    obj.title = obj.title.replace(/ĐÃ XÁC NHẬN CẬP NHẬT v1\.[0-9]+(?:\.[0-9]+)?/i, 'ĐÃ XÁC NHẬN CẬP NHẬT (+800 LT)');
  }

  // Clear non-Giveaway embed footers
  if (clearFooter && Array.isArray(obj.embeds)) {
    for (const emb of obj.embeds) {
      if (!emb || typeof emb !== 'object') continue;
      const ft = String(emb.footer?.text || '');
      if (/Giveaway\s*V2/i.test(ft)) continue;
      emb.footer = { text: '', icon_url: '' };
    }
  }
}

function sweepTree(tree, { clearFooter = true, remap = {} }) {
  const cloned = JSON.parse(JSON.stringify(tree));
  walkAndSweepNode(cloned, { clearFooter, remap });
  return cloned;
}

const LEAK_RE = /house\s*edge|tỉ lệ[^.]{0,20}(?:40|45|48)%|winrate[^.]{0,20}(?:40|45|48)%|(?:minigame|coinflip|blackjack|slots|crash)[^.]{0,60}(?:40|45|48)%/i;

function validateTreeStrict(els, label) {
  assertAcyclicDAG(els, label);
  assertUniqueApiActionNames(els, label);
  assertSelectLimitsAndRegex(els, label);
  const errs = validateGraph(els);
  if (errs.length) throw new Error(`Validation failed for ${label}: ${errs.join(', ')}`);
  if (LEAK_RE.test(JSON.stringify(els))) throw new Error(`Confidential leak detected in ${label}`);
}

async function fetchLiveReduxState() {
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
        .filter(c => c && c.groupId === '${PROFILE_GROUP_ID}' && c.name && c.compressed_tree)
        .map(c => ({ name: c.name, enabled: c.enabled !== false, groupId: c.groupId, compressed_tree: c.compressed_tree })),
      events: Object.values(rawEvents)
        .filter(e => e && e.compressed_tree && (e.groupId === '${PROFILE_GROUP_ID}' || /SuMi|Nhiễm Nhiễm|GA —/i.test(e.name || '')))
        .map(e => ({ name: e.name, int_id: e.int_id, enabled: e.enabled !== false, groupId: e.groupId, compressed_tree: e.compressed_tree })),
    });
  })()`, 25000);
  return JSON.parse(raw);
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const filterArg = process.argv.find((a) => a.startsWith('--only='));
  const onlyNames = filterArg ? new Set(filterArg.slice('--only='.length).split(',')) : null;
  const remap = loadRemapMap();

  console.log(`[v1.4.7 Deploy] Mode=${dryRun ? 'DRY-RUN' : 'LIVE'}, EmojiRemaps=${Object.keys(remap).length}`);

  // Offline verify full-build commands
  const builtCmds = [
    { name: 'autosell', els: sweepTree(buildAutosellV147Cmd(), { clearFooter: true, remap }) },
    { name: 'updates', els: sweepTree(buildUpdatesV147Cmd(), { clearFooter: true, remap }) },
    { name: 'wiki', els: sweepTree(buildWikiV147Cmd(), { clearFooter: true, remap }) },
  ];

  for (const item of builtCmds) {
    if (onlyNames && !onlyNames.has(item.name)) continue;
    validateTreeStrict(item.els, `/${item.name}`);
    console.log(`[Offline OK] BUILD /${item.name}: ${item.els.length} elements`);
    if (!dryRun) {
      const res = await deployViaCDP({
        groupId: PROFILE_GROUP_ID,
        mode: 'command',
        name: item.name,
        elements: item.els,
        enabled: true,
      });
      console.log(`[Deployed] /${item.name}:`, JSON.stringify(res));
      if (!res?.ok) throw new Error(`Failed deploying /${item.name}: ${JSON.stringify(res)}`);
      await new Promise((r) => setTimeout(r, 1200));
    }
  }

  if (dryRun) {
    // Also validate /battle patch & AI prompt offline against scratch dumps if available
    const dir = 'C:/Users/Fuyumi-ASUSF16/.gemini/antigravity/brain/6c4e030b-fb59-4575-8414-9779337f61d9/scratch';
    if (fs.existsSync(`${dir}/bg_slash_battle.json`)) {
      const batDump = JSON.parse(fs.readFileSync(`${dir}/bg_slash_battle.json`, 'utf8'));
      const batPatched = sweepTree(patchBattleV147(batDump.els), { clearFooter: true, remap });
      validateTreeStrict(batPatched, '/battle (dump)');
      console.log(`[Offline OK] PATCH /battle (dump): ${batPatched.length} elements`);
    }
    if (fs.existsSync(`${dir}/bg_ev_4cc5db30-029c-4a55-86e6-6e6850012afd.json`)) {
      const aiDump = JSON.parse(fs.readFileSync(`${dir}/bg_ev_4cc5db30-029c-4a55-86e6-6e6850012afd.json`, 'utf8'));
      const aiPatched = sweepTree(aiDump.els, { clearFooter: true, remap });
      for (const el of aiPatched) {
        const ro = el?.data?.data?.request_options;
        if (!ro?.rawBody || !String(ro.url || '').includes('generativelanguage.googleapis.com')) continue;
        const bodyObj = JSON.parse(ro.rawBody);
        const sysText = bodyObj?.systemInstruction?.parts?.[0]?.text || '';
        if (!sysText.includes('KIẾN THỨC CHÍNH THỨC HỆ THỐNG BOT NHIỄM NHIỄM')) continue;
        const isFuyumi = el.id.toLowerCase().includes('fuyumi') || sysText.includes('TIỂU THƯ FUYUMI SỞ HỮU');
        bodyObj.systemInstruction.parts[0].text = updateAiPromptTextV147(sysText, isFuyumi);
        ro.rawBody = JSON.stringify(bodyObj);
      }
      if (LEAK_RE.test(JSON.stringify(aiPatched))) throw new Error('Confidential leak in AI Mention!');
      console.log(`[Offline OK] PATCH AI Mention (dump): ${aiPatched.length} elements`);
    }
    console.log('[DryRun] All offline checks passed cleanly!');
    return;
  }

  // Live fetch all group commands & events for /battle + AI Mention + Global Sweep
  const live = await fetchLiveReduxState();
  const REBUILT_SET = new Set(['autosell', 'updates', 'wiki']);

  for (const c of live.cmds) {
    if (REBUILT_SET.has(c.name)) continue;
    if (onlyNames && !onlyNames.has(c.name)) continue;
    if (/giveaway|^ga_/i.test(c.name)) continue;

    const origTree = JSON.parse(LZString.decompressFromBase64(c.compressed_tree) || '[]');
    let nextTree = c.name === 'battle' ? patchBattleV147(origTree) : origTree;
    nextTree = sweepTree(nextTree, { clearFooter: true, remap });

    if (JSON.stringify(origTree) === JSON.stringify(nextTree)) {
      console.log(`[Skip Unchanged] /${c.name}`);
      continue;
    }

    validateTreeStrict(nextTree, `/${c.name}`);
    console.log(`[Offline OK] SWEEP /${c.name}: ${nextTree.length} elements`);
    const res = await deployViaCDP({
      groupId: c.groupId || PROFILE_GROUP_ID,
      mode: 'command',
      name: c.name,
      elements: nextTree,
      enabled: c.enabled,
    });
    console.log(`[Deployed] /${c.name}:`, JSON.stringify(res));
    if (!res?.ok) throw new Error(`Failed deploying /${c.name}: ${JSON.stringify(res)}`);
    await new Promise((r) => setTimeout(r, 1000));
  }

  for (const ev of live.events) {
    const isAi = ev.int_id === AI_MENTION_INT_ID || /AI Mention/i.test(ev.name || '');
    if (onlyNames && !(onlyNames.has(ev.name) || (isAi && onlyNames.has('ai_mention')))) continue;
    if (/giveaway|GA\s*—/i.test(ev.name || '')) continue;

    const origTree = JSON.parse(LZString.decompressFromBase64(ev.compressed_tree) || '[]');
    let nextTree = JSON.parse(JSON.stringify(origTree));

    if (isAi) {
      for (const el of nextTree) {
        const ro = el?.data?.data?.request_options;
        if (!ro?.rawBody || !String(ro.url || '').includes('generativelanguage.googleapis.com')) continue;
        const bodyObj = JSON.parse(ro.rawBody);
        const sysText = bodyObj?.systemInstruction?.parts?.[0]?.text || '';
        if (!sysText.includes('KIẾN THỨC CHÍNH THỨC HỆ THỐNG BOT NHIỄM NHIỄM')) continue;
        const isFuyumi = el.id.toLowerCase().includes('fuyumi') || sysText.includes('TIỂU THƯ FUYUMI SỞ HỮU');
        bodyObj.systemInstruction.parts[0].text = updateAiPromptTextV147(sysText, isFuyumi);
        ro.rawBody = JSON.stringify(bodyObj);
      }
    }

    nextTree = sweepTree(nextTree, { clearFooter: true, remap });

    if (JSON.stringify(origTree) === JSON.stringify(nextTree)) {
      console.log(`[Skip Unchanged] Event "${ev.name}"`);
      continue;
    }

    validateTreeStrict(nextTree, `Event:${ev.name}`);
    console.log(`[Offline OK] SWEEP Event "${ev.name}": ${nextTree.length} elements`);
    const res = await deployViaCDP({
      groupId: ev.groupId || PROFILE_GROUP_ID,
      mode: 'event',
      name: ev.name,
      elements: nextTree,
      enabled: ev.enabled,
    });
    console.log(`[Deployed] Event "${ev.name}":`, JSON.stringify(res));
    if (!res?.ok) throw new Error(`Failed deploying Event "${ev.name}": ${JSON.stringify(res)}`);
    await new Promise((r) => setTimeout(r, 1000));
  }

  console.log('[v1.4.7 BotGhost Deploy] ALL COMPLETE CLEANLY!');
}

main().catch((err) => {
  console.error('[v1.4.7 BotGhost Deploy] FATAL:', err);
  process.exit(1);
});
