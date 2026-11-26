/**
 * scripts/deploy_wiki_v1_6_4_buttons_botghost.mjs
 * Rebuild toàn bộ /wiki lên BotGhost qua Edge CDP (9222):
 * - 100% GraphBuilder chuẩn (đầy đủ sourceHandle/targetHandle/type, KHÔNG ghép edge tay).
 * - /wiki roles: Bỏ dropdown, dùng 3 Button riêng (Trang 1: Cao Cấp | Trang 2: Phàm & Cấp | Chi Tiết Chức Năng).
 * - /wiki glossary: Bỏ dropdown, dùng Button trực tiếp (1: Giáp & DEF | 2: Khiên | 3: Linh Vực | 4: CC & SET) + Trước/Sau.
 * - Bảo toàn đầy đủ 10 chuyên mục, Equipment Hub (165 món), Pets Hub (90 Pet), Domains Hub (60 thực thể).
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
} from './ga_builder_lib.mjs';
import { em, emId, tierEmojiKey } from '../src/config/emojiHelper.js';
import { EQUIPMENT_CATALOG, PET_CATALOG } from '../src/data/catalog.js';
import { V13_DOMAINS, V13_DIVINE_SENSES, V13_DIVINE_REALMS } from '../src/data/v13ExpansionCatalog.js';
import { WIKI_CATEGORIES } from '../src/services/wikiService.js';

const PROFILE_GROUP_ID = '1782127263978';
const BACKEND_BASE = 'https://sumi-profile-backend.onrender.com';
const AUTHOR_ONLY_MSG = 'Chỉ người gọi lệnh mới được thao tác trên bảng này! Hãy tự gọi lệnh của bạn nhé.';

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

function btnCfg(label, style, emojiKey, row, weight, showReplies = 'hide') {
  return {
    label,
    style,
    emoji_id: uidId(emojiKey),
    row: String(row),
    weight: String(weight),
    showReplies,
    ...(style !== 'LINK' ? { who_can_press: 'user', who_can_press_message: AUTHOR_ONLY_MSG } : {}),
  };
}

class WikiGraphBuilder extends GraphBuilder {
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
          who_can_press: 'user',
          who_can_press_message: AUTHOR_ONLY_MSG,
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

function embedMsg(gb, id, {
  title,
  description,
  color = '#ec4899',
  imageUrl = '',
  footer = '',
  fields = [],
  target = { reply: true },
  editId = undefined,
  action_id = undefined,
}, pos = { x: 0, y: 0 }) {
  const msgData = {
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
        image: { url: imageUrl || '' },
        footer: { text: footer || '', icon_url: '' },
        ...(fields.length ? { fields } : {}),
      }],
    },
    components: [],
    componentsV2Data: null,
    reactions: '',
  };
  if (editId) msgData.edit_id = editId;
  if (action_id) msgData.action_id = action_id;
  return gb.act(id, 'advanced_message', msgData, pos);
}

function apiAction(gb, id, variableName, method, url, rawBody = '', pos = { x: 0, y: 0 }) {
  return gb.act(id, 'api_action', {
    name: variableName,
    ephemeral: false,
    request_options: {
      method,
      url,
      headers: [],
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
        failOnError: false,
      },
    },
    success_handles: false,
  }, pos);
}

function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

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
    label: `${p.pet_name}`,
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

export function buildWikiV164Cmd() {
  const gb = new WikiGraphBuilder();
  gb.rootSlash('wiki', 'Cẩm nang tu tiên SuMi Family v1.6.1 — 10 mục, 60 Linh Vực, 90 Pet, 165 Pháp Bảo & Từ Điển', { ephemeral: false });
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
    { label: 'Tổng Quan & Toàn Bộ Lệnh', description: 'Tất cả lệnh Gameplay, Buff SET, Pity 350 & Tiện Ích', emoji_id: uidId('su_wiki_scroll'), value: 'overview' },
    { label: 'Cảnh Giới & Thăng Cấp EXP', description: '7 Đại Cảnh Giới, Chat/Voice EXP & 78 × Level^1.45', emoji_id: uidId('su_realm_7_hondondao'), value: 'realms' },
    { label: 'Đấu Trường, Buff SET & Khắc Vực', description: '1v1, Buff SET, Sát Thương Bỏ Qua Khiên & Ngũ Vực', emoji_id: uidId('su_arena'), value: 'battle' },
    { label: 'Kho Pháp Bảo Loadout (165 Món)', description: '57 Vũ Khí • 54 Bảo Ngọc • 54 Chiến Hồn + Khắc Ấn D->S', emoji_id: uidId('su_crossed_swords'), value: 'equipment' },
    { label: 'Linh Thú Tiên Giới (90 Chiến Pet)', description: 'Đầy đủ 90 Linh Thú & Nâng Cấp Nhanh /linhthu muc_dich', emoji_id: uidId('su_pet_paw'), value: 'pets' },
    { label: 'Linh Vực • Thần Thức • Thần Cảnh (60)', description: '30 Linh Vực • 15 Thần Thức • 15 Thần Cảnh & chủ Độc Nhất', emoji_id: uidId('su_realm_star'), value: 'domains' },
    { label: 'Role Quyền Năng & Chức Năng (Button)', description: '40 Role + 8 Cảnh Giới & Nút Chi Tiết Chức Năng', emoji_id: uidId('su_medal_role'), value: 'roles' },
    { label: 'Kinh Tế, Đổ Thạch, Luyện Đan & /farm', description: 'Pity 350, 40 Nguyên Thạch, Lò Luyện Đan, Tháp 500, /farm 8 ô', emoji_id: uidId('su_linhthach'), value: 'economy' },
    { label: 'Khám Phá Đại Lục & Bản Đồ 4K', description: '12 Địa Danh (3.5k->112k), +5% LT & Thuận Hệ', emoji_id: uidId('explorer_world_map_v14'), value: 'explorer' },
    { label: 'Từ Điển Thuật Ngữ (4 Trang • Button)', description: 'Giải thích chuẩn hóa Xuyên DEF, Khiên, Vực, Đạo Áp, CC', emoji_id: uidId('su_wiki_scroll'), value: 'glossary' },
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
  const brRootPets = gb.branch(cRoot, 'wr_pets', 'comparison', { type: 'equal_to', comparison_value: 'pets', ignoreCase: true }, { x: 1150, y: 340 });
  const brRootDomains = gb.branch(cRoot, 'wr_domains', 'comparison', { type: 'equal_to', comparison_value: 'domains', ignoreCase: true }, { x: 2250, y: 340 });
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

  // =========================================================================
  // Roles Hub (100% Button Pagination: Trang 1 | Trang 2 | Chi Tiết Chức Năng)
  // =========================================================================
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
    if (depth >= 3) return;
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

  // =========================================================================
  // Glossary Hub (100% Button Pagination: 4 Direct Page Buttons + Prev/Next)
  // =========================================================================
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
      if (depth === 0) {
        attachGlossaryDirectButtons(mId, sp.page, 1, bx + sp.dx, by + 600);
      } else {
        attachGlossaryPager(mId, rVar, bx + sp.dx, by + 600);
      }
    }
  }
  attachGlossaryDirectButtons('msg_wiki_glossary', 1, 0, -1150, 860);

  // =========================================================================
  // 6 unrolled edit-in-place category dropdown switches on msg_wiki_0
  // =========================================================================
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
    const brDom = `w_sw_dom_${k}`;
    const brRoles = `w_sw_roles_${k}`;
    const brGl = `w_sw_gl_${k}`;
    const brFlat = `w_sw_flat_${k}`;
    const apiId = `w_sw_api_${k}`;
    const resName = `w_sw_res_${k}`;
    const editMsgId = `msg_wiki_sw_${k}`;

    gb.advSelectMenu(selId, curMsgId, {
      placeholder: 'Chọn chuyên mục Cẩm Nang Tu Tiên (10 mục)...',
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
  // Equipment Hub (3 buttons -> 9 catalog dropdowns = 165 items)
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
    imageUrl: `${BACKEND_BASE}/api/wiki/item/{wiki_item_id}.webp?v=1.5`,
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

  // =========================================================================
  // Pets Hub (5 catalog dropdowns = 90 standard pets)
  // =========================================================================
  embedMsg(gb, 'msg_wiki_pets', {
    title: ptEmb.title,
    description: ptEmb.description,
    color: '#ec4899',
    fields: ptEmb.fields,
    footer: '',
    target: { reply: true },
  }, { x: 1500, y: 1200 });
  gb.link(brRootPets, 'msg_wiki_pets');

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

  // =========================================================================
  // Domains Hub (4 catalog dropdowns = 60 public domain entities)
  // =========================================================================
  embedMsg(gb, 'msg_wiki_domains', {
    title: domEmb.title,
    description: domEmb.description,
    color: '#a855f7',
    fields: domEmb.fields,
    footer: '',
    target: { reply: true },
  }, { x: 2450, y: 1200 });
  gb.link(brRootDomains, 'msg_wiki_domains');

  const pubDomains = V13_DOMAINS.filter((d) => !d.is_exclusive_fuyumi);
  const pubSenses = V13_DIVINE_SENSES.filter((s) => !s.is_exclusive_fuyumi);
  const pubRealms = V13_DIVINE_REALMS.filter((r) => !r.is_exclusive_fuyumi);
  const domainGroups = [
    { id: 'sel_dom_low', setId: 'set_dom_low', varName: 'picked_dom_low', row: '1', placeholder: 'Linh Vực Phàm / Linh / Tiên (15)', items: pubDomains.slice(0, 15), kind: 'domain', x: 2220 },
    { id: 'sel_dom_high', setId: 'set_dom_high', varName: 'picked_dom_high', row: '2', placeholder: 'Linh Vực Thần Thoại & Độc Nhất (15)', items: pubDomains.slice(15, 30), kind: 'domain', x: 2380 },
    { id: 'sel_dom_sense', setId: 'set_dom_sense', varName: 'picked_dom_sense', row: '3', placeholder: 'Thần Thức (15)', items: pubSenses, kind: 'sense', x: 2540 },
    { id: 'sel_dom_realm', setId: 'set_dom_realm', varName: 'picked_dom_realm', row: '4', placeholder: 'Thần Cảnh (15)', items: pubRealms, kind: 'realm', x: 2700 },
  ];

  embedMsg(gb, 'dom_detail_ack', {
    title: `${uidEm('su_realm_star')} Đang tải Thẻ Linh Vực...`,
    description: 'Đang tra cứu thông số, Linh Mạch, Đạo Áp và chủ sở hữu Độc Nhất...',
    color: '#a855f7',
    footer: '',
    target: { reply: true },
    editId: 'dom_detail_ack',
  }, { x: 2450, y: 1920 });

  apiAction(gb, 'dom_detail_api', 'dom_res', 'GET', `${BACKEND_BASE}/api/wiki/domain/{wiki_domain_id}`, '', { x: 2450, y: 2100 });
  gb.link('dom_detail_ack', 'dom_detail_api');

  embedMsg(gb, 'dom_detail_edit', {
    title: '{dom_res.response.embed.title}',
    description: '{dom_res.response.embed.description}',
    color: '#a855f7',
    imageUrl: '{dom_res.response.embed.image_url}',
    footer: '',
    target: { editId: 'dom_detail_ack' },
    action_id: 'dom_detail_ack',
  }, { x: 2450, y: 2280 });
  gb.link('dom_detail_api', 'dom_detail_edit');

  for (const dg of domainGroups) {
    gb.advSelectMenu(dg.id, 'msg_wiki_domains', {
      placeholder: dg.placeholder,
      customVariableName: dg.varName,
      basic_options: buildDomainDropdownOptions(dg.items, dg.kind),
      row: dg.row,
      weight: '1',
      showReplies: 'show',
    }, { x: dg.x, y: 1480 });

    gb.act(dg.setId, 'set_unique_variable', {
      reference: 'wiki_domain_id',
      value: `{${dg.varName}}`,
      success_handles: false,
    }, { x: dg.x, y: 1680 });
    gb.link(dg.id, dg.setId);
    gb.link(dg.setId, 'dom_detail_ack');
  }

  return gb.elements();
}

function assertStrictHandles(elements) {
  const errs = validateGraph(elements);
  if (errs.length) throw new Error(`validateGraph failed:\n- ${errs.join('\n- ')}`);

  const nodes = new Map(elements.filter((e) => !e.source && !e.target).map((n) => [n.id, n]));
  const edges = elements.filter((e) => e.source && e.target);
  for (const e of edges) {
    const src = nodes.get(e.source);
    const tgt = nodes.get(e.target);
    if (!src || !tgt) throw new Error(`Dangling edge ${e.id}`);
    if (tgt.type === 'advMessageButton' || tgt.type === 'advMessageSelectMenu') {
      if (e.sourceHandle !== 'components_source' || e.type !== 'step') {
        throw new Error(`Component edge ${e.id} missing components_source/step`);
      }
    } else if (src.type === 'condition' && tgt.type === 'conditionChild') {
      if (e.type !== 'step') throw new Error(`Condition edge ${e.id} missing type:step`);
    } else if (src.type !== 'error' && src.type !== 'option' && (e.sourceHandle !== 'action' || e.targetHandle !== 'action')) {
      throw new Error(`Action edge ${e.id} (${e.source}->${e.target}) missing action handles`);
    }
  }
  const badSelects = elements.filter((e) => e.type === 'advMessageSelectMenu' && /sel_rl_|sel_gl_/.test(e.id));
  if (badSelects.length) throw new Error(`Forbidden pagination dropdowns found: ${badSelects.map((s) => s.id).join(', ')}`);
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const els = buildWikiV164Cmd();
  assertStrictHandles(els);

  const nodeCount = els.filter((e) => !e.source && !e.target).length;
  const edgeCount = els.filter((e) => e.source && e.target).length;
  console.log(`[buildWikiV164Cmd] Validated cleanly: ${nodeCount} nodes, ${edgeCount} edges.`);

  if (dryRun) return;

  const res = await deployViaCDP({
    groupId: PROFILE_GROUP_ID,
    mode: 'command',
    name: 'wiki',
    elements: els,
    enabled: true,
  });
  console.log('DEPLOY_WIKI_V164:', JSON.stringify(res, null, 2));
  if (!res?.ok || res?.builderSaveRequired) {
    throw new Error(`Deploy failed: ${JSON.stringify(res)}`);
  }

  // Post-save cloud verification
  const raw = await cdpEval(`(() => {
    const r = document.getElementById('root') || document.body;
    const rk = Object.keys(r).find(k => k.startsWith('__reactContainer') || k.startsWith('__reactFiber'));
    const q = [r[rk]], s = new Set(); let st = null;
    while (q.length) { const n = q.shift(); if (!n || s.has(n)) continue; s.add(n); if (n.memoizedProps?.store?.getState) { st = n.memoizedProps.store; break; } if (n.child) q.push(n.child); if (n.sibling) q.push(n.sibling); }
    const w = (st.getState().data.bot.commands.slash?.commands || []).find(c => c.name === 'wiki');
    return w?.compressed_tree || '';
  })()`, 15000);
  const cloudEls = JSON.parse(LZString.decompressFromBase64(raw));
  assertStrictHandles(cloudEls);
  const rolesBtns = cloudEls.filter((e) => e.type === 'advMessageButton' && e.id.startsWith('btn_rl_')).length;
  const glBtns = cloudEls.filter((e) => e.type === 'advMessageButton' && e.id.startsWith('btn_gl_')).length;
  console.log(`CLOUD_VERIFY_OK: total=${cloudEls.length}, rolesButtons=${rolesBtns}, glossaryButtons=${glBtns}`);
}

main().catch((err) => {
  console.error('[deploy_wiki_v1_6_4_buttons_botghost] FATAL:', err);
  process.exit(1);
});
