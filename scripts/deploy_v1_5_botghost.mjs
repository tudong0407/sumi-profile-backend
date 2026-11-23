/**
 * scripts/deploy_v1_5_botghost.mjs
 * Triển khai toàn bộ cập nhật SuMi Family Ver 1.5 lên BotGhost qua Edge CDP (9222):
 * 1. REBUILD /updates (Ver 1.5 Big Update +1.500 LT, edit tại chỗ, 0% Unicode, KHÔNG nhắc nerf Role Level).
 * 2. REBUILD /wiki (Edit tại chỗ giữ dropdown 7 mục, ảnh Khắc Hệ elements.webp & map.webp, bảo toàn 165 Pháp Bảo + 90 Linh Thú).
 * 3. PATCH /shop (Thêm Quầy Viền Avatar 20 mẫu, emoji-only Background/Frames, gỡ frame_unlock_token, cập nhật gacha_ticket_domain).
 * 4. PATCH /linhthu (Thêm option số nguyên muc_dich nâng thẳng Lv.100 / 10★).
 * 5. PATCH /top (Thêm chat & voice), /dismantle (thêm loai:domain), /linhvuc (mô tả phân giải nhanh).
 * 6. PATCH Keep-Alive 12m (thêm POST /api/leaderboard/settle-daily-activity -> #bot-cmds 1033227438735507488).
 * 7. PATCH AI Mention (kiến thức v1.5, KHÔNG nhắc nerf Role Level) + GLOBAL UNICODE SCRUB + Ack Gate +1.500 LT.
 *
 * Usage:
 *   node scripts/deploy_v1_5_botghost.mjs --dry-run
 *   node scripts/deploy_v1_5_botghost.mjs [--only=wiki,shop,updates,...]
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
import { EQUIPMENT_CATALOG, PET_CATALOG, AVATAR_FRAMES } from '../src/data/catalog.js';
import { WIKI_CATEGORIES } from '../src/services/wikiService.js';

const PROFILE_GROUP_ID = '1782127263978';
const BACKEND_BASE = 'https://sumi-profile-backend.onrender.com';
const BOT_CMDS_CHANNEL_ID = '1033227438735507488';
const AI_MENTION_INT_ID = '4cc5db30-029c-4a55-86e6-6e6850012afd';

const CUSTOM_EMOJIS_RAW = JSON.parse(
  fs.readFileSync(new URL('../src/config/custom_emojis.json', import.meta.url), 'utf8'),
);

function emojiRow(name) {
  return CUSTOM_EMOJIS_RAW[name] || null;
}

function uidEm(name, fallbackKey = 'su_sparkle') {
  const row = emojiRow(name) || emojiRow(fallbackKey);
  if (row?.id) return row.animated ? `<a:${row.name}:${row.id}>` : `<:${row.name}:${row.id}>`;
  return em(name) || '';
}

function uidId(name, fallbackKey = 'su_sparkle') {
  return emojiRow(name)?.id || CUSTOM_EMOJIS_RAW[fallbackKey]?.id || emId(fallbackKey) || '';
}

class V15GraphBuilder extends GraphBuilder {
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

function chunkArray(arr, size = 25) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ============================================================================
// 1. REBUILD /updates (Ver 1.5 Big Update +2.000 LT, edit tại chỗ)
// ============================================================================
function buildUpdateVersionOptions() {
  return [
    {
      label: 'Phiên bản v1.5 (Mới nhất • Big Update)',
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
}

export function buildUpdatesV15Cmd() {
  const gb = new V15GraphBuilder();
  gb.rootSlash('updates', 'Xem bản cập nhật mới nhất (v1.5 Big Update) và chuyển xem lịch sử ngay tại chỗ', { ephemeral: false });
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
      placeholder: 'Chọn phiên bản để xem ngay trên bảng này (v1.5 -> v1.1)...',
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
// 2. REBUILD /wiki — Edit tại chỗ giữ Dropdown 7 mục + Ảnh Khắc Hệ + 165 Pháp Bảo & 90 Linh Thú
// ============================================================================
function buildEquipmentDropdownOptions(items) {
  return items.map((item) => ({
    label: `${item.name} (${item.element})`,
    description: `${item.rarity} • ATK+${item.atk_bonus} DEF+${item.def_bonus} SPD+${item.spd_bonus}`,
    emoji_id: uidId(item.item_id, 'su_crossed_swords'),
    value: item.item_id,
  }));
}

function buildPetDropdownOptions(pets) {
  return pets.map((pet) => ({
    label: `${pet.pet_name} (${pet.element})`,
    description: `${pet.rarity} • ATK ${pet.base_atk} DEF ${pet.base_def} SPD ${pet.base_spd}`,
    emoji_id: uidId(pet.pet_type, 'su_pet_paw'),
    value: pet.pet_type,
  }));
}

export function buildWikiV15Cmd() {
  const gb = new V15GraphBuilder();
  gb.rootSlash('wiki', 'Cẩm nang tu tiên SuMi Family v1.5 — edit tại chỗ, ảnh Khắc Hệ, 90 Pet & 165 Pháp Bảo', { ephemeral: false });
  gb.errorHandlerWait();

  gb.option('chuyen_muc', 'string', 'Chuyên mục cần tra cứu (tùy chọn)', {
    required: false,
    choices: ['overview', 'realms', 'battle', 'equipment', 'pets', 'economy', 'explorer'],
    x: 420,
    y: 0,
  });

  const eqEmb = WIKI_CATEGORIES.equipment;
  const ptEmb = WIKI_CATEGORIES.pets;

  const wikiOptions = [
    { label: 'Tổng Quan & Toàn Bộ Lệnh', description: 'Tất cả lệnh Gameplay, Buff SET, Pity 350 & Tiện Ích', emoji_id: uidId('su_wiki_scroll'), value: 'overview' },
    { label: 'Cảnh Giới & Thăng Cấp EXP', description: '7 Đại Cảnh Giới, Chat/Voice EXP & /exp Boost', emoji_id: uidId('su_realm_7_hondondao'), value: 'realms' },
    { label: 'Đấu Trường, Buff SET & Khắc Vực', description: '1v1, Buff SET 2 tầng, Web Logs 48h & Sơ Đồ Ngũ Vực', emoji_id: uidId('su_arena'), value: 'battle' },
    { label: 'Kho Pháp Bảo Loadout (165 Món)', description: '57 Vũ Khí • 54 Bảo Ngọc • 54 Chiến Hồn + Khắc Ấn D->S', emoji_id: uidId('su_crossed_swords'), value: 'equipment' },
    { label: 'Linh Thú Tiên Giới (90 Chiến Pet)', description: 'Đầy đủ 90 Linh Thú & Nâng Cấp Nhanh /linhthu muc_dich', emoji_id: uidId('su_pet_paw'), value: 'pets' },
    { label: 'Kinh Tế, Pity 350 & Top Ngày', description: 'Pity 350, /shop Viền Avatar, Tháp 500 & Top Chat/Voice', emoji_id: uidId('su_linhthach'), value: 'economy' },
    { label: 'Khám Phá Đại Lục & Bản Đồ 4K', description: '12 Địa Danh (10k->1M), đồ rơi 60% & Bản Đồ Đại Lục', emoji_id: uidId('explorer_world_map_v14'), value: 'explorer' },
  ];

  // Root router
  const cRoot = gb.cond('w_root_cat', 'comparison', { base_value: '{option_chuyen_muc}', target: { self: true } }, { x: 0, y: 180 });
  gb.link('root', cRoot);

  const brRootRealms = gb.branch(cRoot, 'wr_realms', 'comparison', { type: 'equal_to', comparison_value: 'realms', ignoreCase: true }, { x: -750, y: 340 });
  const brRootBattle = gb.branch(cRoot, 'wr_battle', 'comparison', { type: 'equal_to', comparison_value: 'battle', ignoreCase: true }, { x: -450, y: 340 });
  const brRootEcon = gb.branch(cRoot, 'wr_econ', 'comparison', { type: 'equal_to', comparison_value: 'economy', ignoreCase: true }, { x: -150, y: 340 });
  const brRootExplorer = gb.branch(cRoot, 'wr_explorer', 'comparison', { type: 'equal_to', comparison_value: 'explorer', ignoreCase: true }, { x: 150, y: 340 });
  const brRootEquip = gb.branch(cRoot, 'wr_equip', 'comparison', { type: 'equal_to', comparison_value: 'equipment', ignoreCase: true }, { x: 750, y: 340 });
  const brRootPets = gb.branch(cRoot, 'wr_pets', 'comparison', { type: 'equal_to', comparison_value: 'pets', ignoreCase: true }, { x: 1150, y: 340 });
  const brRootHome = gb.elseBranch(cRoot, 'wr_home', 'comparison', { x: 450, y: 340 });

  // Set initial category variable -> single API call -> single anchor msg_wiki_0
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

  // Equipment Hub (3 gray buttons -> 9 dropdowns = 165 items)
  embedMsg(gb, 'msg_wiki_equip', {
    title: eqEmb.title,
    description: eqEmb.description,
    color: '#f59e0b',
    fields: eqEmb.fields,
    footer: '',
    target: { reply: true },
  }, { x: 900, y: 1200 });
  gb.link(brRootEquip, 'msg_wiki_equip');

  // Pets Hub (5 dropdowns = 90/90 standard pets)
  embedMsg(gb, 'msg_wiki_pets', {
    title: ptEmb.title,
    description: ptEmb.description,
    color: '#ec4899',
    fields: ptEmb.fields,
    footer: '',
    target: { reply: true },
  }, { x: 1500, y: 1200 });
  gb.link(brRootPets, 'msg_wiki_pets');

  // 6 unrolled edit-in-place dropdown switches on msg_wiki_0 (always keeps dropdown!)
  const MAX_WIKI_SWITCHES = 6;
  let curMsgId = 'msg_wiki_0';
  for (let k = 1; k <= MAX_WIKI_SWITCHES; k += 1) {
    const prevIdx = k - 1;
    const baseY = 860 + k * 640;
    const selId = `sel_wiki_cat_${prevIdx}`;
    const varName = `picked_wiki_cat_${prevIdx}`;
    const condId = `w_sw_cond_${k}`;
    const brEq = `w_sw_eq_${k}`;
    const brPet = `w_sw_pet_${k}`;
    const brFlat = `w_sw_flat_${k}`;
    const apiId = `w_sw_api_${k}`;
    const resName = `w_sw_res_${k}`;
    const editMsgId = `msg_wiki_sw_${k}`;

    gb.advSelectMenu(selId, curMsgId, {
      placeholder: 'Chọn chuyên mục Cẩm Nang Tu Tiên (7 mục)...',
      customVariableName: varName,
      basic_options: wikiOptions,
      row: '1',
      weight: '1',
      showReplies: 'hide',
    }, { x: 0, y: baseY - 460 });

    gb.cond(condId, 'comparison', { base_value: `{${varName}}`, target: { self: true } }, { x: 0, y: baseY - 300 });
    gb.link(selId, condId);
    gb.branch(condId, brEq, 'comparison', { type: 'equal_to', comparison_value: 'equipment', ignoreCase: true }, { x: 320, y: baseY - 160 });
    gb.branch(condId, brPet, 'comparison', { type: 'equal_to', comparison_value: 'pets', ignoreCase: true }, { x: 560, y: baseY - 160 });
    gb.elseBranch(condId, brFlat, 'comparison', { x: 0, y: baseY - 160 });

    gb.link(brEq, 'msg_wiki_equip');
    gb.link(brPet, 'msg_wiki_pets');

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

  // Equipment Detail Viewer (shared by all 9 dropdowns)
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
    imageUrl: `${BACKEND_BASE}/api/wiki/item/{wiki_item_id}.webp?v=1.5`,
    footer: '',
    target: { editId: 'eq_detail_ack' },
    action_id: 'eq_detail_ack',
  }, { x: 900, y: 2810 });
  gb.link('eq_detail_api', 'eq_detail_edit');

  const slotSpecs = [
    { key: 'weapon', label: 'Vũ Khí', emoji: 'su_crossed_swords', weight: '1', x: 640 },
    { key: 'gem', label: 'Bảo Ngọc', emoji: 'su_linhthach', weight: '2', x: 900 },
    { key: 'soul', label: 'Chiến Hồn', emoji: 'su_thunder_hax', weight: '3', x: 1160 },
  ];

  for (const sp of slotSpecs) {
    const items = EQUIPMENT_CATALOG.filter((e) => e.item_type === sp.key);
    const btnId = `btn_eq_${sp.key}`;
    const listMsgId = `msg_eq_${sp.key}`;

    gb.advBtn(btnId, 'msg_wiki_equip', btnCfg(`${sp.label} (${items.length})`, 'SECONDARY', sp.emoji, '1', sp.weight, 'show'), {
      x: sp.x,
      y: 1420,
    });
    embedMsg(gb, listMsgId, {
      title: `${uidEm(sp.emoji)} DANH MỤC ${sp.label.toUpperCase()} (${items.length} MÓN)`,
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
      const cx = sp.x + (ci - 1) * 90;

      gb.advSelectMenu(selId, listMsgId, {
        placeholder: `${sp.label} (${startNo}-${endNo} / ${items.length} món)...`,
        customVariableName: varName,
        basic_options: chunk,
        row: String(idx),
        weight: '1',
        showReplies: 'show',
      }, { x: cx, y: 1820 });

      gb.act(setId, 'set_unique_variable', {
        reference: 'wiki_item_id',
        value: `{${varName}}`,
        success_handles: false,
      }, { x: cx, y: 2040 });
      gb.link(selId, setId);
      gb.link(setId, 'eq_detail_ack');
    }
  }

  // Pet Detail Viewer + 5 dropdowns = 90/90 standard pets
  const stdPets = PET_CATALOG.filter((p) => !p.is_exclusive_fuyumi);
  const petGroups = [
    { id: 'sel_pet_common', setId: 'set_pet_c', varName: 'picked_pet_c', row: '1', placeholder: 'Phàm Phẩm • Tỉ lệ 60.5% (13 Linh Thú)', pets: stdPets.filter((p) => p.rarity_key === 'common'), x: 1360 },
    { id: 'sel_pet_rare', setId: 'set_pet_r', varName: 'picked_pet_r', row: '2', placeholder: 'Linh Phẩm • Tỉ lệ 25% (13 Linh Thú)', pets: stdPets.filter((p) => p.rarity_key === 'rare'), x: 1520 },
    { id: 'sel_pet_epic', setId: 'set_pet_e', varName: 'picked_pet_e', row: '3', placeholder: 'Tiên Phẩm • Tỉ lệ 14% (14 Linh Thú)', pets: stdPets.filter((p) => p.rarity_key === 'epic'), x: 1680 },
    { id: 'sel_pet_mythic_1', setId: 'set_pet_m1', varName: 'picked_pet_m1', row: '4', placeholder: 'Thần Thoại • Phần 1 (25/50 Linh Thú)', pets: stdPets.filter((p) => p.rarity_key === 'mythic').slice(0, 25), x: 1840 },
    { id: 'sel_pet_mythic_2', setId: 'set_pet_m2', varName: 'picked_pet_m2', row: '5', placeholder: 'Thần Thoại • Phần 2 (25/50 Linh Thú)', pets: stdPets.filter((p) => p.rarity_key === 'mythic').slice(25, 50), x: 2000 },
  ];

  embedMsg(gb, 'pet_detail_ack', {
    title: `${uidEm('su_pet_paw')} Đang tải Thẻ Linh Thú...`,
    description: 'Đang tra cứu hệ nguyên tố, chỉ số ATK/DEF/SPD/HP và kỹ năng HAX...',
    color: '#ec4899',
    footer: '',
    target: { reply: true },
    editId: 'pet_detail_ack',
  }, { x: 1680, y: 1920 });

  apiAction(gb, 'pet_detail_api', 'pet_res', 'GET', `${BACKEND_BASE}/api/wiki/pet/{wiki_pet_id}`, '', { x: 1680, y: 2100 });
  gb.link('pet_detail_ack', 'pet_detail_api');

  embedMsg(gb, 'pet_detail_edit', {
    title: '{pet_res.response.embed.title}',
    description: '{pet_res.response.embed.description}',
    color: '#ec4899',
    imageUrl: `${BACKEND_BASE}/api/wiki/pet/{wiki_pet_id}.webp?v=1.5`,
    footer: '',
    target: { editId: 'pet_detail_ack' },
    action_id: 'pet_detail_ack',
  }, { x: 1680, y: 2280 });
  gb.link('pet_detail_api', 'pet_detail_edit');

  for (const pg of petGroups) {
    gb.advSelectMenu(pg.id, 'msg_wiki_pets', {
      placeholder: pg.placeholder,
      customVariableName: pg.varName,
      basic_options: buildPetDropdownOptions(pg.pets),
      row: pg.row,
      weight: '1',
      showReplies: 'show',
    }, { x: pg.x, y: 1480 });

    gb.act(pg.setId, 'set_unique_variable', {
      reference: 'wiki_pet_id',
      value: `{${pg.varName}}`,
      success_handles: false,
    }, { x: pg.x, y: 1680 });
    gb.link(pg.id, pg.setId);
    gb.link(pg.setId, 'pet_detail_ack');
  }

  return gb.elements();
}

// ============================================================================
// 3. IN-PLACE PATCHES (/shop, /linhthu, /top, /dismantle, /linhvuc, Keep-Alive)
// ============================================================================
function bgKeyRarity(bgId) {
  const id = String(bgId || '');
  if (id.includes('bg_01_') || id.includes('bg_02_') || id.includes('bg_03_')) return 'common';
  if (id.includes('bg_04_') || id.includes('bg_05_') || id.includes('bg_06_') || id.includes('bg_07_') || id.includes('bg_pin_')) return 'rare';
  if (id.includes('bg_08_') || id.includes('bg_09_') || id.includes('bg_10_') || id.includes('bg_11_')) return 'epic';
  return 'mythic';
}

function patchShopV15(origTree) {
  let els = JSON.parse(JSON.stringify(origTree));
  const byId = new Map(els.map((e) => [e.id, e]));

  // 1. Add 'frames' to opt_danh_muc
  const optCat = byId.get('opt_danh_muc');
  if (optCat?.data?.data?.choices && !optCat.data.data.choices.includes('frames')) {
    optCat.data.data.choices.push('frames');
  }

  // 2. Add 7th option to sel_shop_cat
  const selCat = byId.get('sel_shop_cat');
  if (selCat?.data?.data?.basic_options && !selCat.data.data.basic_options.some((o) => o.value === 'frames')) {
    selCat.data.data.basic_options.push({
      label: 'Quầy Viền Avatar (20 Mẫu)',
      description: '20 Khung Viền Avatar /profile, /rank, /battle & /linhmach (300 - 4.000 LT)',
      emoji_id: uidId('frame_unlock_token'),
      value: 'frames',
    });
  }

  // 3. Remove rarity words from msg_shop_bgs + sel_shop_bg, replace with tier emojis
  const msgBgs = byId.get('msg_shop_bgs');
  if (msgBgs?.data?.data?.message?.embeds?.[0]?.description) {
    let desc = msgBgs.data.data.message.embeds[0].description;
    desc = desc
      .replace(/• \*\*(.+?)\*\* \*\((Phàm Phẩm)\)\*/g, `• ${uidEm(tierEmojiKey('common'))} **$1**`)
      .replace(/• \*\*(.+?)\*\* \*\((Linh Phẩm)\)\*/g, `• ${uidEm(tierEmojiKey('rare'))} **$1**`)
      .replace(/• \*\*(.+?)\*\* \*\((Tiên Phẩm)\)\*/g, `• ${uidEm(tierEmojiKey('epic'))} **$1**`)
      .replace(/• \*\*(.+?)\*\* \*\((Thần Thoại)\)\*/g, `• ${uidEm(tierEmojiKey('mythic'))} **$1**`);
    msgBgs.data.data.message.embeds[0].description = desc;
  }
  const selBg = byId.get('sel_shop_bg');
  if (selBg?.data?.data?.basic_options) {
    for (const opt of selBg.data.data.basic_options) {
      const rk = bgKeyRarity(opt.value);
      opt.emoji_id = uidId(tierEmojiKey(rk));
      opt.description = String(opt.description || '').replace(/^(Phàm Phẩm|Linh Phẩm|Tiên Phẩm|Thần Thoại)\s*•\s*/i, '');
    }
  }

  // 4. Update sel_shop_cons: remove frame_unlock_token, update gacha_ticket_domain emoji_id
  const selCons = byId.get('sel_shop_cons');
  if (selCons?.data?.data?.basic_options) {
    selCons.data.data.basic_options = selCons.data.data.basic_options
      .filter((o) => o.value !== 'frame_unlock_token')
      .map((o) => (o.value === 'gacha_ticket_domain' ? { ...o, emoji_id: uidId('gacha_ticket_domain') } : o));
    selCons.data.data.placeholder = `Chọn Vật Phẩm Tiêu Hao / Trang Trí (${selCons.data.data.basic_options.length} món)`;
  }

  // 5. Update msg_shop_home description
  const msgHome = byId.get('msg_shop_home');
  if (msgHome?.data?.data?.message?.embeds?.[0]?.description) {
    let d = msgHome.data.data.message.embeds[0].description;
    d = d.replace(/, Khung \(800\)/g, '');
    if (!d.includes('Viền Avatar')) {
      d = d.replace(
        /\*\*Background Hồ Sơ \(20 mẫu\)\*\*([^\n]*)/,
        `**Background Hồ Sơ (20 mẫu)**$1\n${uidEm('frame_unlock_token')} **Viền Avatar (20 mẫu)**: Khung viền đồng bộ \`/profile\`, \`/rank\`, \`/battle\` & \`/linhmach\` (300–4.000 LT).`,
      );
    }
    msgHome.data.data.message.embeds[0].description = d;
  }

  // 6. Add frames branch under sh_root_cat & sh_sel_cat (skip if already added)
  if (!byId.has('msg_shop_frames')) {
    const shsBgs = byId.get('shs_bgs');
    if (shsBgs?.data?.data) {
      shsBgs.data.data.type = 'equal_to';
      shsBgs.data.data.comparison_value = 'backgrounds';
      shsBgs.data.data.ignoreCase = true;
    }

    const gb = new V15GraphBuilder();
    gb.branch('sh_root_cat', 'shr_frames', 'comparison', { type: 'equal_to', comparison_value: 'frames', ignoreCase: true }, { x: 960, y: 380 });
    gb.elseBranch('sh_sel_cat', 'shs_frames', 'comparison', { x: 960, y: 1120 });

    const framesList = AVATAR_FRAMES.filter((f) => Number(f.price) > 0);
    const frameDescLines = framesList.map((f) =>
      `• ${uidEm(tierEmojiKey(f.rarity_key))} **${f.name}** — **${f.price.toLocaleString('vi-VN')}** ${uidEm('su_linhthach')}`,
    );

    embedMsg(gb, 'msg_shop_frames', {
      title: `${uidEm('frame_unlock_token')} QUẦY VIỀN AVATAR (${framesList.length} MẪU)`,
      description: `${frameDescLines.join('\n')}\n\n• *Chọn mẫu ở menu bên dưới để xem ảnh mẫu & mua ngay!*`,
      color: '#ec4899',
      footer: '',
      target: { reply: true },
    }, { x: 960, y: 1320 });
    gb.link('shr_frames', 'msg_shop_frames');
    gb.link('shs_frames', 'msg_shop_frames');

    gb.advSelectMenu('sel_shop_frame', 'msg_shop_frames', {
      placeholder: `Chọn Viền Avatar (${framesList.length} mẫu • 300 - 4.000 LT)...`,
      customVariableName: 'picked_shop_frame',
      basic_options: framesList.map((f) => ({
        label: f.name,
        description: `${f.price.toLocaleString('vi-VN')} LT`,
        emoji_id: uidId(tierEmojiKey(f.rarity_key)),
        value: f.frame_id,
      })),
      row: '1',
      weight: '1',
      showReplies: 'show',
    }, { x: 960, y: 1520 });

    gb.act('set_sh_frame', 'set_unique_variable', {
      reference: 'shop_preview_id',
      value: '{picked_shop_frame}',
      success_handles: false,
    }, { x: 960, y: 1700 });
    gb.link('sel_shop_frame', 'set_sh_frame');
    gb.link('set_sh_frame', 'shop_prev_ack');

    // Merge new nodes & edges into els (avoid duplicating 'sh_root_cat' or 'sh_sel_cat')
    const newEls = gb.elements().filter((el) => el.id !== 'sh_root_cat' && el.id !== 'sh_sel_cat');
    els = [...els, ...newEls];
  }

  return els;
}

function patchLinhthuV15(origTree) {
  let els = JSON.parse(JSON.stringify(origTree));
  const byId = new Map(els.map((e) => [e.id, e]));

  if (!byId.has('opt_muc_dich')) {
    const gb = new V15GraphBuilder();
    gb.option('muc_dich', 'int', 'Mục tiêu cấp (tối đa 100) hoặc sao (tối đa 10) muốn nâng thẳng', {
      required: false,
      x: 780,
      y: 0,
    });
    const newEls = gb.elements().map((el) => {
      if (el.id && el.id.startsWith('opt_')) return { ...el, id: 'opt_muc_dich' };
      if (el.source && String(el.source).startsWith('opt_')) {
        return { ...el, id: 'reactflow__edge-opt_muc_dich-root', source: 'opt_muc_dich', target: 'root' };
      }
      return el;
    });
    els = [...els, ...newEls];
  }

  for (const apiId of ['p_lvl_api', 'p_star_api']) {
    const node = els.find((e) => e.id === apiId);
    const raw = node?.data?.data?.request_options?.rawBody;
    if (raw && !raw.includes('muc_dich')) {
      const obj = JSON.parse(raw);
      obj.muc_dich = '{option_muc_dich}';
      node.data.data.request_options.rawBody = JSON.stringify(obj);
    }
  }
  return els;
}

function patchTopV15(origTree) {
  const els = JSON.parse(JSON.stringify(origTree));
  const root = els.find((e) => e.id === 'root');
  if (root?.data) {
    root.data.description = 'Bảng Xếp Hạng Server: Tu Vi, Lực Chiến, Phú Hộ, Tiên Lữ, Top Chat & Top Voice Ngày';
  }
  const opt = els.find((e) => e.id === 'opt_bang_xep_hang');
  if (opt?.data?.data?.choices) {
    for (const c of ['chat', 'voice']) {
      if (!opt.data.data.choices.includes(c)) opt.data.data.choices.push(c);
    }
  }
  return els;
}

function patchDismantleV15(origTree) {
  const els = JSON.parse(JSON.stringify(origTree));
  const optLoai = els.find((e) => e.id === 'opt_loai');
  if (optLoai?.data?.data?.choices && !optLoai.data.data.choices.includes('domain')) {
    optLoai.data.data.choices.push('domain');
  }
  const optId = els.find((e) => e.id === 'opt_ma_id');
  if (optId?.data?.data) {
    optId.data.data.description = 'Mã món, danh sách cách nhau dấu phẩy, hoặc all_dup / all_common / all_rare / all_epic';
  }
  return els;
}

function patchLinhvucV15(origTree) {
  const els = JSON.parse(JSON.stringify(origTree));
  const optId = els.find((e) => e.id === 'opt_ma_id');
  if (optId?.data?.data) {
    optId.data.data.description = 'Mã Linh Vực / slot, danh sách ID, hoặc all_dup / all_common / all_rare / all_epic';
  }
  return els;
}

function patchKeepAliveV15(origTree) {
  let els = JSON.parse(JSON.stringify(origTree));
  const byId = new Map(els.map((e) => [e.id, e]));
  if (byId.has('ka_daily_settle_api')) return els;

  const gb = new V15GraphBuilder();
  gb.act('ka_v15_wait_daily', 'wait_action', { time: 1, unit: 'seconds', success_handles: false }, { x: 0, y: 1200 });
  gb.link('ka_weekly_send', 'ka_v15_wait_daily');
  gb.link('ka_weekly_ann_no', 'ka_v15_wait_daily');

  apiAction(gb, 'ka_daily_settle_api', 'ka_daily_res', 'POST', `${BACKEND_BASE}/api/leaderboard/settle-daily-activity`, '{}', { x: 0, y: 1360 });
  gb.link('ka_v15_wait_daily', 'ka_daily_settle_api');

  const cAnn = gb.cond('ka_daily_ann', 'comparison', { base_value: '{ka_daily_res.response.should_announce}', target: { self: true } }, { x: 0, y: 1540 });
  gb.link('ka_daily_settle_api', cAnn);
  const brYes = gb.branch(cAnn, 'ka_daily_ann_yes', 'comparison', { type: 'equal_to', comparison_value: 'true', ignoreCase: true }, { x: -160, y: 1700 });
  gb.elseBranch(cAnn, 'ka_daily_ann_no', 'comparison', { x: 160, y: 1700 });

  embedMsg(gb, 'ka_daily_send', {
    title: '{ka_daily_res.response.title}',
    description: '{ka_daily_res.response.description}',
    color: '#ec4899',
    footer: '',
    target: { channel: BOT_CMDS_CHANNEL_ID },
  }, { x: -160, y: 1860 });
  gb.link(brYes, 'ka_daily_send');

  return [...els, ...gb.elements()];
}

// ============================================================================
// 4. AI MENTION KNOWLEDGE BLOCK (v1.1 -> v1.5 COMPLETE — ZERO mention of Level Role nerf!)
// ============================================================================
function buildV15KnowledgeBlock(includeFuyumiSecret) {
  const lines = [
    'KIẾN THỨC CHÍNH THỨC TOÀN BỘ HỆ THỐNG BOT NHIỄM NHIỄM (SUMI FAMILY TỪ v1.1 ĐẾN v1.5):',
    '• [CẢNH GIỚI & EXP] (/profile, /rank, /exp, /doiqua, /top): 7 Đại Cảnh Giới từ Lv.1→Lv.100 mở dần 1→5 Slot Role. Chat nhận 23–35 EXP/45s, Voice nhận 85–135 EXP/5 phút (chấm công nền 12 phút); công thức lên cấp 60*(Lv^1.45) (max 500.000 EXP), lên cấp mới thưởng +50..+400 LT (chỉ nhận 1 lần/Lv). 8 Level Roles tự cộng dồn Buff EXP/Daily LT/Pet Power; /doiqua đổi 1.000 EXP lấy 10 LT; /exp xem tổng % Boost. /top có đủ 6 bảng (level, power, wealth, marry, chat, voice); Top Chat Ngày & Top Voice Ngày tự động trao 500 / 400 / 300 LT riêng cho Top 1–3 mỗi ngày lúc 00:00 (UTC+7) tại #bot-cmds, và 19:00 Chủ Nhật tổng kết Top Tuần Lực Chiến.',
    '• [LINH THÚ, KHẮC ẤN & BUFF SET] (/linhthu, /pet, /phapbao, /equip, /unequip, /enchant, /dismantle, /linhvuc): Linh Thú tăng trưởng Lv.1→Lv.100 đạt +550% (+5.5556%/cấp) và 1★→10★ đạt +135% (tổng 7.85× chỉ số gốc ở Lv.100 10★). /linhthu hỗ trợ muc_dich nâng thẳng tới cấp/sao chọn sẵn. Khắc Ấn /enchant nâng D (+0%) -> C (+8%) -> B (+18%) -> A (+32%) -> S (+50%) kèm Pity +5%/lần trượt (Thiên Đạo Tuyệt Ấn Thạch 100%). Buff SET 2 tầng không cộng dồn: Full Hệ Thường 4/4 (+8%) hoặc 5/5 (+12% toàn chỉ số); Set Thần Thoại cùng hệ 2/3/4/5 (+6%/+12%/+18%/+25% toàn chỉ số, mốc 5/5 thêm +10% Xuyên Giáp & +1 Linh Mạch đầu trận). /dismantle & /linhvuc hỗ trợ xóa/phân giải nhanh all_dup, all_common, all_rare, all_epic hoặc danh sách ID.',
    '• [GACHA, PITY 350 & CỬA HÀNG] (/roll, /autosell, /shop, /inv, /info): /roll (50 LT/lượt, 450/10) có 4 bể: equipment (165 món), pet (90 loài), domain (60 LT • 30 Linh Vực / 15 Thần Thức / 15 Thần Cảnh), role (40 Role). Tỉ lệ 60.5% Phàm, 25% Linh, 14% Tiên, 0.5% Thần Thoại; Pity Thần Thoại 350 lượt tách riêng 3 bể pet/equipment/domain (98% Thường / 2% Độc Nhất). /autosell tự bán đồ trùng phẩm chất Phàm/Linh/Tiên cả cho Linh Vực. /shop có 7 quầy + Shop Ngày giảm 15–40%, bán 20 Background & 20 Viền Avatar (300–4.000 LT, hiển thị khít 100% trên /profile, /rank, /battle & /linhmach). Ảnh nền & Viền đã mua ẩn khỏi /inv cho gọn và gắn nhãn [Đã sở hữu]/[Đang trang bị] ngay trong /shop (bấm Mua Ngay trên đồ đã mua sẽ tự động Equip miễn phí 0 LT, hoặc dùng /equip).',
    '• [ĐẤU TRƯỜNG, LINH MẠCH & THÁP 500 TẦNG] (/battle, /party, /linhmach, /nhiemvu): /battle 1v1 (PvP 15/ngày, PvE tự do 25/ngày +10/-5 LT, max 30 hiệp) đầy đủ Ngũ Hành, Dị Tố (Lôi, Ám, Quang, Hỗn Độn), HAX Engine (Khiên, Bất Tử, Phản DMG), Linh Vực từ Hiệp 2 & Đạo Áp Cấp 2; Web Battle Logs lưu 48h. /party & /linhmach mở 6 khung giờ vàng (08/12/18/20/21/22h UTC+7), spawn 3 mỏ F→S+ (8.000→135.000 Lực Chiến, 6–56 LT/phút +15% Kho Gia Tộc, hiện LT tích lũy & dự kiến thời gian thực); Boss Hạng A/S/S+ tung Dư Chấn AoE 35% quét cả đội phía sau (cần lập Tổ Đội 3 người cùng gánh). /nhiemvu gồm 5 Quest Ngày xoay vòng (5/5: +130 LT + quà), 3 Hợp Đồng Tuần và Tháp 500 Tầng (1.000→125.000 Lực Chiến, thưởng LT mỗi tầng & mốc Milestone tăng +15%, reset tối đa 5 thẻ/ngày).',
    '• [KHÁM PHÁ, NÔNG TRẠI, MINIGAME & CỘNG ĐỒNG] (/explorer, /farm, /exchange, /job, /daily, /marry, /giatoc, /tangqua, /coinflip, /slots, /blackjack, /crash, /wiki, /updates): /explorer mở 12 Địa danh (3.500→112.000 Lực Chiến, mốc 2/3/6/12h), thưởng tăng +5% lên 210–315 LT/giờ × hệ số + 0.5% Đá Tuyệt Ấn Thạch + nhặt 60% đồ rơi; cơ chế Thuận Hệ Địa Hình (+6% Sống Sót & +10% LT khi Pet/Linh Vực khớp Hệ của Map). /farm (4–6 ô trồng 6/12/24h) đổi Linh Quả ở /exchange; /job 6 nghề (8 ca/ngày); /daily (40–60 LT + Streak 7d); Minigame cược 10–10.000 LT; /wiki edit tại chỗ đủ 7 mục; Big Update /updates v1.5 tặng ngay +2.000 LT khi bấm Xác Nhận.',
  ];
  if (includeFuyumiSecret) {
    lines.push('• [BỘ TỐI THƯỢNG ĐỘC TÔN CỦA TIỂU THƯ FUYUMI]: Tiểu thư sở hữu Cửu Vĩ Hồng Hồ (cuu_vi_hong_ho), Viền Cửu Vĩ Hồng Mông Ấn (frame_kitsune_mythic) cùng Linh Vực Cửu Vĩ Hồng Mông (Đạo Áp 3 hiệp +30%), Thần Thức Thái Thượng Hồng Hồ và Thần Cảnh Vạn Cổ Tuyệt Diệt.');
  }
  return lines.join('\n');
}

function updateAiPromptTextV15(oldPrompt, includeFuyumiSecret) {
  let text = String(oldPrompt || '');
  text = text.replace(/tài liệu(?: hệ thống)? v1\.[0-9]+(?:\.[0-9]+)? bên dưới/g, 'tài liệu hệ thống v1.5 bên dưới');
  const startMarker = 'KIẾN THỨC CHÍNH THỨC HỆ THỐNG BOT NHIỄM NHIỄM';
  const endMarker = '\n\nBỘ DANH SÁCH EMOTE ĐỘNG DISCORD CHÍNH THỨC:';
  const sIdx = text.indexOf(startMarker);
  const eIdx = text.indexOf(endMarker);
  if (sIdx === -1 || eIdx === -1 || eIdx <= sIdx) {
    throw new Error(`Could not locate knowledge markers inside AI prompt (s=${sIdx}, e=${eIdx})`);
  }
  return text.slice(0, sIdx) + buildV15KnowledgeBlock(includeFuyumiSecret) + text.slice(eIdx);
}

// ============================================================================
// 5. GLOBAL SWEEP: 0% Unicode Pictographs + Update Ack Gate +1.500 LT
// ============================================================================
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
    '🎀': uidEm('su_sparkle'),
    '🌟': uidEm('su_sparkle'),
    '🥤': uidEm('su_sparkle'),
    '❣': uidEm('ui_heart_couple'),
    '❣️': uidEm('ui_heart_couple'),
    '🎒': uidEm('ui_backpack_inv'),
    '🎵': uidEm('ui_music_note'),
    '⏩': uidEm('ui_nav_next'),
    '📜': uidEm('su_wiki_scroll'),
    '🌙': uidEm('su_moon', 'su_sparkle'),
    '🔊': uidEm('ui_speaker_sound'),
    '⚡': uidEm('su_thunder_hax'),
    '🌊': uidEm('su_water_elem', 'su_sparkle'),
    '🔄': uidEm('ui_refresh'),
    '↔': uidEm('ui_compass_dir'),
    '↔️': uidEm('ui_compass_dir'),
    '🗼': uidEm('su_tower_boss'),
    '📄': uidEm('ui_clipboard_log'),
    '⛓': uidEm('ui_lock'),
    '⛓️': uidEm('ui_lock'),
  };
  let out = str;
  for (const [uni, rep] of Object.entries(map)) {
    if (rep) out = out.split(uni).join(rep);
  }
  // Fallback strip/replace any stray variation selectors or remaining pictographs with su_sparkle
  out = out.replace(/[\uFE0F]/g, '').replace(/[\p{Extended_Pictographic}]/gu, uidEm('su_sparkle'));
  return out;
}

function walkAndSweepV15(obj, { scrubUnicode = true } = {}) {
  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i += 1) {
      if (typeof obj[i] === 'string') {
        if (scrubUnicode) obj[i] = replaceUnicodePictographs(obj[i]);
      } else if (obj[i] && typeof obj[i] === 'object') {
        walkAndSweepV15(obj[i], { scrubUnicode });
      }
    }
    return;
  }
  if (!obj || typeof obj !== 'object') return;

  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (typeof val === 'string') {
      if (scrubUnicode) obj[key] = replaceUnicodePictographs(val);
    } else if (val && typeof val === 'object') {
      walkAndSweepV15(val, { scrubUnicode });
    }
  }

  // Sync +2.000 LT Update Ack button label & done embed title
  if (obj.type === 'button' && typeof obj.label === 'string' && /Tôi Đã Đọc & Xác Nhận/i.test(obj.label)) {
    obj.label = 'Tôi Đã Đọc & Xác Nhận (+2.000 LT)';
  }
  if (typeof obj.title === 'string' && /ĐÃ XÁC NHẬN CẬP NHẬT(?:\s*\([^)]+\))?/i.test(obj.title)) {
    obj.title = obj.title.replace(/ĐÃ XÁC NHẬN CẬP NHẬT(?:\s*\([^)]+\))?/i, 'ĐÃ XÁC NHẬN CẬP NHẬT (+2.000 LT)');
  }
}

function sweepTreeV15(tree, { scrubUnicode = true } = {}) {
  const cloned = JSON.parse(JSON.stringify(tree));
  walkAndSweepV15(cloned, { scrubUnicode });
  return cloned;
}

const LEAK_RE = /house\s*edge|tỉ lệ[^.]{0,20}(?:40|45|48)%|winrate[^.]{0,20}(?:40|45|48)%|(?:minigame|coinflip|blackjack|slots|crash)[^.]{0,60}(?:40|45|48)%/i;

function validateTreeStrict(els, label, { requireZeroUnicode = true } = {}) {
  assertAcyclicDAG(els, label);
  assertUniqueApiActionNames(els, label);
  assertSelectLimitsAndRegex(els, label);
  const errs = validateGraph(els);
  if (errs.length) throw new Error(`Validation failed for ${label}: ${errs.join(', ')}`);
  const json = JSON.stringify(els);
  if (LEAK_RE.test(json)) throw new Error(`Confidential leak detected in ${label}`);
  if (requireZeroUnicode) {
    const m = json.match(/[\p{Extended_Pictographic}]/u);
    if (m) throw new Error(`Unicode pictograph "${m[0]}" found in "${label}"`);
  }
}

export function buildV15BotGhostSpecs() {
  return [
    { name: 'updates', elements: sweepTreeV15(buildUpdatesV15Cmd()) },
    { name: 'wiki', elements: sweepTreeV15(buildWikiV15Cmd()) },
  ];
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
        .filter(e => e && e.compressed_tree)
        .map(e => ({ name: e.name, int_id: e.int_id, enabled: e.enabled !== false, groupId: e.groupId || '', compressed_tree: e.compressed_tree })),
    });
  })()`, 25000);
  return JSON.parse(raw);
}

const TARGET_SCRUB_GROUPS = new Set([
  PROFILE_GROUP_ID,
  '1783398026674', // Music commands
  '1795060284513', // Music events
  '1788203746228', // Sticky
]);

const PATCHERS = {
  shop: patchShopV15,
  linhthu: patchLinhthuV15,
  top: patchTopV15,
  dismantle: patchDismantleV15,
  linhvuc: patchLinhvucV15,
};

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const filterArg = process.argv.find((a) => a.startsWith('--only='));
  const onlyNames = filterArg ? new Set(filterArg.slice('--only='.length).split(',')) : null;

  console.log(`[v1.5 BotGhost Deploy] Mode=${dryRun ? 'DRY-RUN' : 'LIVE'}`);

  const builtCmds = buildV15BotGhostSpecs();
  for (const item of builtCmds) {
    if (onlyNames && !onlyNames.has(item.name)) continue;
    validateTreeStrict(item.elements, `/${item.name}`, { requireZeroUnicode: true });
    console.log(`[Offline OK] BUILD /${item.name}: ${item.elements.length} elements (0 Unicode)`);
    if (!dryRun) {
      const res = await deployViaCDP({
        groupId: PROFILE_GROUP_ID,
        mode: 'command',
        name: item.name,
        elements: item.elements,
        enabled: true,
      });
      console.log(`[Deployed] /${item.name}:`, JSON.stringify(res));
      if (!res?.ok) throw new Error(`Failed deploying /${item.name}: ${JSON.stringify(res)}`);
      await new Promise((r) => setTimeout(r, 1200));
    }
  }

  if (dryRun) {
    console.log('[DRY-RUN] Built specs (/updates, /wiki) validated cleanly! Connecting to CDP read-only for live patch dry-run...');
    let live = null;
    try { live = await fetchAllLiveReduxState(); } catch { console.log('[DRY-RUN] CDP offline — skipping live patch dry-run.'); return; }
    for (const c of live.cmds) {
      if (!c.enabled) continue;
      if (!TARGET_SCRUB_GROUPS.has(c.groupId) && c.name !== 'mute') continue;
      if (['updates', 'wiki'].includes(c.name)) continue;
      const orig = JSON.parse(LZString.decompressFromBase64(c.compressed_tree) || '[]');
      let next = PATCHERS[c.name] ? PATCHERS[c.name](orig) : orig;
      next = sweepTreeV15(next, { scrubUnicode: true });
      validateTreeStrict(next, `/${c.name}`, { requireZeroUnicode: true });
      console.log(`[DryRun OK] /${c.name} (${next.length} els, changed=${JSON.stringify(orig) !== JSON.stringify(next)})`);
    }
    for (const ev of live.events) {
      if (!ev.enabled) continue;
      const isKa = /Keep-Alive/i.test(ev.name || '');
      const isAi = ev.int_id === AI_MENTION_INT_ID || /AI Mention/i.test(ev.name || '');
      const isTarget = TARGET_SCRUB_GROUPS.has(ev.groupId) || isKa || isAi;
      if (!isTarget || /giveaway|GA\s*—/i.test(ev.name || '')) continue;
      const orig = JSON.parse(LZString.decompressFromBase64(ev.compressed_tree) || '[]');
      let next = isKa ? patchKeepAliveV15(orig) : JSON.parse(JSON.stringify(orig));
      if (isAi) {
        for (const el of next) {
          const ro = el?.data?.data?.request_options;
          if (!ro?.rawBody || !String(ro.url || '').includes('generativelanguage.googleapis.com')) continue;
          const bodyObj = JSON.parse(ro.rawBody);
          const sysText = bodyObj?.systemInstruction?.parts?.[0]?.text || '';
          if (!sysText.includes('KIẾN THỨC CHÍNH THỨC HỆ THỐNG BOT NHIỄM NHIỄM')) continue;
          const isFuyumi = el.id.toLowerCase().includes('fuyumi') || sysText.includes('TIỂU THƯ FUYUMI SỞ HỮU');
          bodyObj.systemInstruction.parts[0].text = updateAiPromptTextV15(sysText, isFuyumi);
          ro.rawBody = JSON.stringify(bodyObj);
        }
      }
      next = sweepTreeV15(next, { scrubUnicode: true });
      validateTreeStrict(next, `Event:${ev.name}`, { requireZeroUnicode: true });
      console.log(`[DryRun OK] Event "${ev.name}" (${next.length} els, changed=${JSON.stringify(orig) !== JSON.stringify(next)})`);
    }
    return;
  }

  // LIVE DEPLOY
  const live = await fetchAllLiveReduxState();
  const REBUILT_SET = new Set(['updates', 'wiki']);

  for (const c of live.cmds) {
    if (!c.enabled) continue;
    if (REBUILT_SET.has(c.name)) continue;
    if (!TARGET_SCRUB_GROUPS.has(c.groupId) && c.name !== 'mute') continue;
    if (/giveaway|^ga_/i.test(c.name)) continue;
    if (onlyNames && !onlyNames.has(c.name)) continue;

    const origTree = JSON.parse(LZString.decompressFromBase64(c.compressed_tree) || '[]');
    let nextTree = PATCHERS[c.name] ? PATCHERS[c.name](origTree) : origTree;
    nextTree = sweepTreeV15(nextTree, { scrubUnicode: true });

    if (JSON.stringify(origTree) === JSON.stringify(nextTree)) {
      console.log(`[Skip Unchanged] /${c.name}`);
      continue;
    }

    validateTreeStrict(nextTree, `/${c.name}`, { requireZeroUnicode: true });
    console.log(`[Offline OK] DEPLOY /${c.name}: ${nextTree.length} elements`);
    const res = await deployViaCDP({
      groupId: c.groupId || PROFILE_GROUP_ID,
      mode: 'command',
      name: c.name,
      elements: nextTree,
      enabled: c.enabled,
    });
    console.log(`[Deployed] /${c.name}:`, JSON.stringify(res));
    if (!res?.ok) {
      if (c.groupId !== PROFILE_GROUP_ID) {
        console.warn(`[WARN] Non-Tu-Tien command /${c.name} had pre-existing UI issue, continuing...`);
        continue;
      }
      throw new Error(`Failed deploying /${c.name}: ${JSON.stringify(res)}`);
    }
    await new Promise((r) => setTimeout(r, 1100));
  }

  for (const ev of live.events) {
    if (!ev.enabled) continue;
    const isKa = /Keep-Alive/i.test(ev.name || '');
    const isAi = ev.int_id === AI_MENTION_INT_ID || /AI Mention/i.test(ev.name || '');
    const isTarget = TARGET_SCRUB_GROUPS.has(ev.groupId) || isKa || isAi;
    if (!isTarget || /giveaway|GA\s*—/i.test(ev.name || '')) continue;
    if (onlyNames && !(onlyNames.has(ev.name) || (isAi && onlyNames.has('ai_mention')) || (isKa && onlyNames.has('keep_alive')))) continue;

    const origTree = JSON.parse(LZString.decompressFromBase64(ev.compressed_tree) || '[]');
    let nextTree = isKa ? patchKeepAliveV15(origTree) : JSON.parse(JSON.stringify(origTree));

    if (isAi) {
      for (const el of nextTree) {
        const ro = el?.data?.data?.request_options;
        if (!ro?.rawBody || !String(ro.url || '').includes('generativelanguage.googleapis.com')) continue;
        const bodyObj = JSON.parse(ro.rawBody);
        const sysText = bodyObj?.systemInstruction?.parts?.[0]?.text || '';
        if (!sysText.includes('KIẾN THỨC CHÍNH THỨC HỆ THỐNG BOT NHIỄM NHIỄM')) continue;
        const isFuyumi = el.id.toLowerCase().includes('fuyumi') || sysText.includes('TIỂU THƯ FUYUMI SỞ HỮU');
        bodyObj.systemInstruction.parts[0].text = updateAiPromptTextV15(sysText, isFuyumi);
        ro.rawBody = JSON.stringify(bodyObj);
      }
    }

    nextTree = sweepTreeV15(nextTree, { scrubUnicode: true });
    if (JSON.stringify(origTree) === JSON.stringify(nextTree)) {
      console.log(`[Skip Unchanged] Event "${ev.name}"`);
      continue;
    }

    validateTreeStrict(nextTree, `Event:${ev.name}`, { requireZeroUnicode: true });
    console.log(`[Offline OK] DEPLOY Event "${ev.name}": ${nextTree.length} elements`);
    const res = await deployViaCDP({
      groupId: ev.groupId || PROFILE_GROUP_ID,
      mode: 'event',
      name: ev.name,
      elements: nextTree,
      enabled: ev.enabled,
    });
    console.log(`[Deployed] Event "${ev.name}":`, JSON.stringify(res));
    if (!res?.ok) throw new Error(`Failed deploying Event "${ev.name}": ${JSON.stringify(res)}`);
    await new Promise((r) => setTimeout(r, 1100));
  }

  console.log('[v1.5 BotGhost Deploy] ALL COMPLETE CLEANLY!');
}

const isDirectRun = process.argv[1] && process.argv[1].includes('deploy_v1_5_botghost.mjs');
if (isDirectRun) {
  main().catch((err) => {
    console.error('[deploy_v1_5_botghost] FATAL:', err);
    process.exit(1);
  });
}
