import WebSocket from 'ws';
globalThis.WebSocket = WebSocket;

import {
  GraphBuilder,
  SUMI_GUILD_ID,
  deployViaCDP,
  validateGraph,
} from './ga_builder_lib.mjs';
import { EQUIPMENT_CATALOG, PET_CATALOG } from '../src/data/catalog.js';
import { WIKI_CATEGORIES } from '../src/services/wikiService.js';
import { em, emId } from '../src/config/emojiHelper.js';

const PROFILE_GROUP_ID = '1782127263978';
const BACKEND_BASE = 'https://sumi-profile-backend.onrender.com';
const LEVEL_UP_NOTIFY_CHANNEL_ID = '1033227438735507488';

class ExtendedGraphBuilder extends GraphBuilder {
  advSelectMenu(id, parentMsgId, {
    placeholder,
    customVariableName,
    basic_options,
    row = '1',
    weight = '1',
    showReplies = 'show',
  }, { x = 0, y = 0 } = {}) {
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
    } else {
      nodes.add(el.id);
    }
  }
  const state = new Map(); // 0=unvisited, 1=visiting, 2=done
  const dfs = (u, stack) => {
    state.set(u, 1);
    for (const v of adj.get(u) || []) {
      if (state.get(v) === 1) {
        throw new Error(`Cycle detected in ${label}: ${[...stack, v].join(' -> ')}`);
      }
      if (!state.get(v)) dfs(v, [...stack, v]);
    }
    state.set(u, 2);
  };
  for (const n of nodes) {
    if (!state.get(n)) dfs(n, [n]);
  }
}

function makeEmbedAction(gb, id, { title, description = '', color = '#ec4899', imageUrl = '', fields = [], footerText = 'SuMi Family • Cẩm Nang Tu Tiên', target = { reply: true }, action_id = undefined, editId = undefined }, pos) {
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
        ...(fields && fields.length ? { fields } : {}),
        footer: { text: footerText, icon_url: '' },
      }],
    },
    components: [],
    componentsV2Data: null,
    reactions: '',
  };
  if (action_id) data.action_id = action_id;
  if (editId) data.editId = editId;
  return gb.act(id, 'advanced_message', data, pos);
}

// ============================================================================
// 1. /profile (Full HD+ 2000x1000)
// ============================================================================
export function buildProfileCmd() {
  const gb = new ExtendedGraphBuilder();
  gb.rootSlash('profile', 'Xem thẻ hồ sơ tu tiên Full HD+, linh thú xuất trận và role quyền năng', { ephemeral: false });
  gb.errorHandlerWait();
  gb.option('user', 'user', 'Tu sĩ cần xem hồ sơ (để trống để xem chính mình)', { required: false, x: 420, y: 0 });

  const cHas = gb.cmp('p_has_u', '{option_user}', '^[0-9]+$', 'matches_pattern', {}, { x: 0, y: 220 });
  gb.link('root', cHas.condId);

  makeEmbedAction(gb, 'action_profile_opt', {
    title: `${em('su_fox_mascot')} SUMI FAMILY • HỒ SƠ TU TIÊN`,
    color: '#ff75b5',
    imageUrl: `${BACKEND_BASE}/api/profile/{option_user}.png?fallback_id={option_user}&fallback_name={encode_text[{user_displayName[option_user]}]}&fallback_avatar={encode_text[{user_icon[option_user]}]}&t={time_now_unix}`,
    footerText: 'SuMi Family • Tu Tiên Giới Full HD+',
  }, { x: -240, y: 500 });

  makeEmbedAction(gb, 'action_profile_self', {
    title: `${em('su_fox_mascot')} SUMI FAMILY • HỒ SƠ TU TIÊN`,
    color: '#ff75b5',
    imageUrl: `${BACKEND_BASE}/api/profile/{user_id}.png?fallback_id={user_id}&fallback_name={encode_text[{user_displayName}]}&fallback_avatar={encode_text[{user_icon}]}&t={time_now_unix}`,
    footerText: 'SuMi Family • Tu Tiên Giới Full HD+',
  }, { x: 240, y: 500 });

  gb.link(cHas.yes, 'action_profile_opt');
  gb.link(cHas.no, 'action_profile_self');
  return gb.elements();
}

// ============================================================================
// 2. /rank (Full HD+ 2000x410)
// ============================================================================
export function buildRankCmd() {
  const gb = new ExtendedGraphBuilder();
  gb.rootSlash('rank', 'Xem thẻ cảnh giới tu tiên mini Full HD+ và tiến độ cấp độ', { ephemeral: false });
  gb.errorHandlerWait();
  gb.option('user', 'user', 'Tu sĩ cần xem cảnh giới (để trống để xem chính mình)', { required: false, x: 420, y: 0 });

  const cHas = gb.cmp('r_has_u', '{option_user}', '^[0-9]+$', 'matches_pattern', {}, { x: 0, y: 220 });
  gb.link('root', cHas.condId);

  makeEmbedAction(gb, 'action_rank_opt', {
    title: `${em('su_fox_mascot')} SUMI FAMILY • THẺ CẢNH GIỚI TU TIÊN`,
    color: '#ff75b5',
    imageUrl: `${BACKEND_BASE}/api/rank/{option_user}.png?fallback_id={option_user}&fallback_name={encode_text[{user_displayName[option_user]}]}&fallback_avatar={encode_text[{user_icon[option_user]}]}&t={time_now_unix}`,
    footerText: 'SuMi Family • Tu Tiên Giới Full HD+',
  }, { x: -240, y: 500 });

  makeEmbedAction(gb, 'action_rank_self', {
    title: `${em('su_fox_mascot')} SUMI FAMILY • THẺ CẢNH GIỚI TU TIÊN`,
    color: '#ff75b5',
    imageUrl: `${BACKEND_BASE}/api/rank/{user_id}.png?fallback_id={user_id}&fallback_name={encode_text[{user_displayName}]}&fallback_avatar={encode_text[{user_icon}]}&t={time_now_unix}`,
    footerText: 'SuMi Family • Tu Tiên Giới Full HD+',
  }, { x: 240, y: 500 });

  gb.link(cHas.yes, 'action_rank_opt');
  gb.link(cHas.no, 'action_rank_self');
  return gb.elements();
}

// ============================================================================
// 3. /battle (1v1 Cơ Bản — Trả Trực Tiếp Ảnh Chiến Báo Full HD+ + 1 Dòng Tiêu Đề Kết Quả)
// ============================================================================
export function buildBattleCmd() {
  const gb = new ExtendedGraphBuilder();
  gb.rootSlash('battle', 'Thách đấu Linh Thú 1v1 — Xuất Ảnh Chiến Báo Full HD+', { ephemeral: false });
  gb.errorHandlerWait();
  gb.option('doi_thu', 'user', 'Đạo hữu muốn thách đấu (để trống để đấu thử với Hanabira Mei)', { required: false, x: 420, y: 0 });

  const cHas = gb.cmp('b_has_u', '{option_doi_thu}', '^[0-9]+$', 'matches_pattern', {}, { x: 0, y: 220 });
  gb.link('root', cHas.condId);

  gb.act('b_set_opt', 'set_unique_variable', { reference: 'def_uid', value: '{option_doi_thu}', success_handles: false }, { x: -240, y: 400 });
  gb.link(cHas.yes, 'b_set_opt');

  const cIsHana = gb.cmp('b_is_hana', '{user_id}', '1429509324845092875', 'equal_to', {}, { x: 240, y: 400 });
  gb.link(cHas.no, cIsHana.condId);

  gb.act('b_set_fu', 'set_unique_variable', { reference: 'def_uid', value: '757091869183311872', success_handles: false }, { x: 100, y: 580 });
  gb.act('b_set_hana', 'set_unique_variable', { reference: 'def_uid', value: '1429509324845092875', success_handles: false }, { x: 380, y: 580 });
  gb.link(cIsHana.yes, 'b_set_fu');
  gb.link(cIsHana.no, 'b_set_hana');

  // Immediate ACK to satisfy Discord 3s interaction window
  makeEmbedAction(gb, 'battle_ack', {
    title: `${em('su_crossed_swords')} ĐẤU TRƯỜNG LINH THÚ 1V1 • ĐANG GIAO CHIẾN...`,
    description: 'Đang mô phỏng trận đấu và kết xuất Ảnh Chiến Báo Full HD+...',
    color: '#ff75b5',
    editId: 'battle_ack',
    footerText: 'SuMi Family • Đấu Trường Tiên Giới',
  }, { x: 0, y: 760 });

  gb.link('b_set_opt', 'battle_ack');
  gb.link('b_set_fu', 'battle_ack');
  gb.link('b_set_hana', 'battle_ack');

  gb.act('battle_api', 'api_action', {
    name: 'battle_res',
    ephemeral: false,
    request_options: {
      method: 'POST',
      url: `${BACKEND_BASE}/api/battle/simulate`,
      headers: [{ key: 'Content-Type', value: 'application/json' }],
      params: [],
      body: [],
      rawBody: '{"attackerId":"{user_id}","defenderId":"{def_uid}","options":{"maxTurns":20}}',
      contentType: 'application/json',
      options: {
        excludeEmptyFields: true,
        replaceParams: true,
        replaceURL: true,
        replaceHeaders: true,
        replaceBody: true,
        bodyMode: 'raw',
        contentType: 'application/json',
        failOnError: false,
      },
    },
    success_handles: false,
  }, { x: 0, y: 940 });
  gb.link('battle_ack', 'battle_api');

  // Trả trực tiếp Ảnh Chiến Báo Full HD+ (2000x1000) kèm 1 dòng tiêu đề kết quả ngắn gọn (bỏ log dài)
  makeEmbedAction(gb, 'battle_edit', {
    title: '{battle_res.response.headline}',
    description: '',
    color: '#ec4899',
    imageUrl: '{battle_res.response.reportImageUrl}',
    target: { editId: 'battle_ack' },
    action_id: 'battle_ack',
    footerText: 'SuMi Family • Ảnh Chiến Báo 1v1 Full HD+ (2000×1000)',
  }, { x: 0, y: 1120 });
  gb.link('battle_api', 'battle_edit');

  return gb.elements();
}

// ============================================================================
// 4. /wiki (Dropdown Tương Tác: 6 Chuyên Mục • 3 Dropdown Trang Bị • 4 Dropdown Linh Thú)
// ============================================================================
function buildItemOptions(itemType) {
  return EQUIPMENT_CATALOG.filter((i) => i.item_type === itemType).map((i) => {
    const statSummary = [
      i.bonus_atk ? `ATK+${i.bonus_atk}` : '',
      i.bonus_def ? `DEF+${i.bonus_def}` : '',
      i.bonus_spd ? `SPD${i.bonus_spd > 0 ? '+' : ''}${i.bonus_spd}` : '',
      i.bonus_hp ? `HP+${i.bonus_hp}` : '',
      i.bonus_crit ? `CRIT+${i.bonus_crit}%` : '',
    ].filter(Boolean).join(' • ');
    const uniqueTag = i.is_unique ? ' • Độc Nhất 1%' : ` • ${i.drop_rate}%`;
    return {
      label: String(i.item_name).slice(0, 95),
      description: `${i.rarity} • ${statSummary}${uniqueTag}`,
      emoji_id: emId(i.emoji_key),
      value: i.item_id,
    };
  });
}

function buildPetOptions(rarityKeys) {
  return PET_CATALOG.filter((p) => !p.is_exclusive_fuyumi && rarityKeys.includes(p.rarity_key)).map((p) => {
    const tag = p.is_starter ? 'Khởi đầu tân thủ' : p.hax_skill;
    return {
      label: String(p.pet_name).slice(0, 95),
      description: `Hệ ${p.element} • ${p.base_atk}/${p.base_def}/${p.base_spd} • ${tag}`,
      emoji_id: emId(p.emoji_key),
      value: p.pet_type,
    };
  });
}

export function buildWikiCmd() {
  const gb = new ExtendedGraphBuilder();
  gb.rootSlash('wiki', 'Cẩm nang tu tiên SuMi Family — Cảnh giới, Ngũ Hành, 45 Pháp Bảo & 20 Linh Thú', { ephemeral: false });
  gb.errorHandlerWait();
  gb.option('chuyen_muc', 'string', 'Chuyên mục cần tra cứu (tùy chọn)', {
    required: false,
    choices: ['overview', 'realms', 'battle', 'equipment', 'pets', 'economy'],
    x: 420,
    y: 0,
  });

  // --- Shared Leaf Messages cho các chuyên mục ---
  const ov = WIKI_CATEGORIES.overview;
  const rl = WIKI_CATEGORIES.realms;
  const bt = WIKI_CATEGORIES.battle;
  const eq = WIKI_CATEGORIES.equipment;
  const pt = WIKI_CATEGORIES.pets;
  const ec = WIKI_CATEGORIES.economy;

  // Root branch theo option_chuyen_muc (nếu trống -> msg_wiki_home)
  gb.cond('w_root_cat', 'comparison', { base_value: '{option_chuyen_muc}', target: { self: true } }, { x: 0, y: 220 });
  gb.link('root', 'w_root_cat');

  const rRealms = gb.branch('w_root_cat', 'wr_realms', 'comparison', { type: 'equal_to', comparison_value: 'realms', ignoreCase: true, option: '', not: false }, { x: -750, y: 400 });
  const rBattle = gb.branch('w_root_cat', 'wr_battle', 'comparison', { type: 'equal_to', comparison_value: 'battle', ignoreCase: true, option: '', not: false }, { x: -450, y: 400 });
  const rEquip = gb.branch('w_root_cat', 'wr_equip', 'comparison', { type: 'equal_to', comparison_value: 'equipment', ignoreCase: true, option: '', not: false }, { x: -150, y: 400 });
  const rPets = gb.branch('w_root_cat', 'wr_pets', 'comparison', { type: 'equal_to', comparison_value: 'pets', ignoreCase: true, option: '', not: false }, { x: 150, y: 400 });
  const rEcon = gb.branch('w_root_cat', 'wr_econ', 'comparison', { type: 'equal_to', comparison_value: 'economy', ignoreCase: true, option: '', not: false }, { x: 450, y: 400 });
  const rHome = gb.elseBranch('w_root_cat', 'wr_home', 'comparison', { x: 800, y: 400 });

  // --- Trang Chủ Wiki Tổng Quan + Dropdown Chọn 6 Chuyên Mục ---
  makeEmbedAction(gb, 'msg_wiki_home', {
    title: `${em('su_fox_mascot')} CẨM NANG TU TIÊN • TỔNG QUAN`,
    description: ov.content,
    color: '#ec4899',
    fields: ov.fields,
    footerText: 'SuMi Family • Cẩm Nang Tu Tiên',
  }, { x: 800, y: 620 });
  gb.link(rHome, 'msg_wiki_home');

  gb.advSelectMenu('sel_wiki_cat', 'msg_wiki_home', {
    placeholder: 'Chuyên mục Cẩm Nang Tu Tiên',
    customVariableName: 'wiki_cat',
    row: '1',
    weight: '1',
    showReplies: 'show',
    basic_options: [
      { label: 'Tổng Quan Tu Tiên', description: 'Khởi đầu tân thủ & danh sách lệnh cốt lõi', emoji_id: emId('su_wiki_scroll'), value: 'overview' },
      { label: 'Hệ Thống Cảnh Giới & Thăng Cấp', description: '7 Đại Cảnh Giới, công thức EXP, mốc Role & Slot', emoji_id: emId('su_realm_7_hondondao'), value: 'realms' },
      { label: 'Đấu Trường & Ngũ Hành Tương Khắc', description: 'Luật 1v1 & sơ đồ Vòng Xoay Ngũ Hành Full HD+', emoji_id: emId('su_arena'), value: 'battle' },
      { label: 'Trang Bị Loadout (45 Pháp Bảo)', description: '45 Pháp Bảo: Vũ Khí, Bảo Ngọc, Chiến Hồn & Quy tắc Độc Nhất', emoji_id: emId('su_crossed_swords'), value: 'equipment' },
      { label: 'Linh Thú Tiên Giới (20 Chiến Pet)', description: '20 Chiến Linh Thú theo 4 bậc Phẩm Cấp & kỹ năng HAX', emoji_id: emId('su_pet_paw'), value: 'pets' },
      { label: 'Kinh Tế Linh Thạch & Gia Tộc', description: 'Linh Thạch, Gia Tộc & Clan Wars 24H', emoji_id: emId('su_linhthach'), value: 'economy' },
    ],
  }, { x: 800, y: 820 });

  gb.cond('w_sel_cat', 'comparison', { base_value: '{wiki_cat}', target: { self: true } }, { x: 800, y: 1000 });
  gb.link('sel_wiki_cat', 'w_sel_cat');

  const sOverview = gb.branch('w_sel_cat', 'ws_overview', 'comparison', { type: 'equal_to', comparison_value: 'overview', ignoreCase: true, option: '', not: false }, { x: 1150, y: 1180 });
  const sRealms = gb.branch('w_sel_cat', 'ws_realms', 'comparison', { type: 'equal_to', comparison_value: 'realms', ignoreCase: true, option: '', not: false }, { x: -750, y: 1180 });
  const sBattle = gb.branch('w_sel_cat', 'ws_battle', 'comparison', { type: 'equal_to', comparison_value: 'battle', ignoreCase: true, option: '', not: false }, { x: -450, y: 1180 });
  const sEquip = gb.branch('w_sel_cat', 'ws_equip', 'comparison', { type: 'equal_to', comparison_value: 'equipment', ignoreCase: true, option: '', not: false }, { x: -150, y: 1180 });
  const sPets = gb.branch('w_sel_cat', 'ws_pets', 'comparison', { type: 'equal_to', comparison_value: 'pets', ignoreCase: true, option: '', not: false }, { x: 150, y: 1180 });
  const sEcon = gb.elseBranch('w_sel_cat', 'ws_econ', 'comparison', { x: 450, y: 1180 });

  // Leaf Overview (khi bấm lại Tổng Quan từ Dropdown — không tạo cycle về msg_wiki_home)
  makeEmbedAction(gb, 'msg_wiki_overview_leaf', {
    title: ov.title,
    description: ov.content,
    color: '#ec4899',
    fields: ov.fields,
    footerText: 'SuMi Family • Chuyên mục: Tổng Quan',
  }, { x: 1150, y: 1380 });
  gb.link(sOverview, 'msg_wiki_overview_leaf');

  // 1. Chuyên mục Cảnh Giới (Độc lập)
  makeEmbedAction(gb, 'msg_wiki_realms', {
    title: rl.title,
    description: rl.content,
    color: '#a855f7',
    fields: rl.fields,
    footerText: 'SuMi Family • Chuyên mục: Cảnh Giới & Thăng Cấp',
  }, { x: -750, y: 1380 });
  gb.link(rRealms, 'msg_wiki_realms');
  gb.link(sRealms, 'msg_wiki_realms');

  // 2. Chuyên mục Đấu Trường & Sơ Đồ Vòng Xoay Ngũ Hành Full HD+
  makeEmbedAction(gb, 'msg_wiki_battle', {
    title: bt.title,
    description: bt.content,
    color: '#f43f5e',
    imageUrl: `${BACKEND_BASE}/api/wiki/chart/elements.png`,
    fields: bt.fields,
    footerText: 'SuMi Family • Sơ Đồ Ngũ Hành & Dị Tố Full HD+ (2000×1000)',
  }, { x: -450, y: 1380 });
  gb.link(rBattle, 'msg_wiki_battle');
  gb.link(sBattle, 'msg_wiki_battle');

  // 3. Chuyên mục Kinh Tế & Gia Tộc
  makeEmbedAction(gb, 'msg_wiki_economy', {
    title: ec.title,
    description: ec.content,
    color: '#38bdf8',
    fields: ec.fields,
    footerText: 'SuMi Family • Chuyên mục: Kinh Tế & Gia Tộc',
  }, { x: 450, y: 1380 });
  gb.link(rEcon, 'msg_wiki_economy');
  gb.link(sEcon, 'msg_wiki_economy');

  // 4. Chuyên mục Trang Bị Loadout + 3 Dropdown Riêng Biệt (Vũ Khí • Bảo Ngọc • Chiến Hồn)
  makeEmbedAction(gb, 'msg_wiki_equip', {
    title: eq.title,
    description: eq.content,
    color: '#f59e0b',
    fields: eq.fields,
    footerText: 'SuMi Family • Kho Pháp Bảo Loadout',
  }, { x: -150, y: 1380 });
  gb.link(rEquip, 'msg_wiki_equip');
  gb.link(sEquip, 'msg_wiki_equip');

  gb.advSelectMenu('sel_eq_weapon', 'msg_wiki_equip', {
    placeholder: 'Vũ Khí (15 món)',
    customVariableName: 'picked_weapon',
    row: '1',
    weight: '1',
    showReplies: 'show',
    basic_options: buildItemOptions('weapon'),
  }, { x: -450, y: 1620 });

  gb.advSelectMenu('sel_eq_gem', 'msg_wiki_equip', {
    placeholder: 'Bảo Ngọc (15 món)',
    customVariableName: 'picked_gem',
    row: '2',
    weight: '1',
    showReplies: 'show',
    basic_options: buildItemOptions('gem'),
  }, { x: -150, y: 1620 });

  gb.advSelectMenu('sel_eq_soul', 'msg_wiki_equip', {
    placeholder: 'Chiến Hồn (15 món)',
    customVariableName: 'picked_soul',
    row: '3',
    weight: '1',
    showReplies: 'show',
    basic_options: buildItemOptions('soul'),
  }, { x: 150, y: 1620 });

  gb.act('set_item_w', 'set_unique_variable', { reference: 'wiki_item_id', value: '{picked_weapon}', success_handles: false }, { x: -450, y: 1800 });
  gb.act('set_item_g', 'set_unique_variable', { reference: 'wiki_item_id', value: '{picked_gem}', success_handles: false }, { x: -150, y: 1800 });
  gb.act('set_item_s', 'set_unique_variable', { reference: 'wiki_item_id', value: '{picked_soul}', success_handles: false }, { x: 150, y: 1800 });
  gb.link('sel_eq_weapon', 'set_item_w');
  gb.link('sel_eq_gem', 'set_item_g');
  gb.link('sel_eq_soul', 'set_item_s');

  makeEmbedAction(gb, 'eq_detail_ack', {
    title: `${em('su_crossed_swords')} Đang tải Thẻ Pháp Bảo Full HD+...`,
    description: 'Đang tra cứu thông số, kỹ năng HAX và chủ sở hữu hiện tại từ Supabase...',
    color: '#f59e0b',
    editId: 'eq_detail_ack',
    footerText: 'SuMi Family • Kho Pháp Bảo Loadout',
  }, { x: -150, y: 1980 });
  gb.link('set_item_w', 'eq_detail_ack');
  gb.link('set_item_g', 'eq_detail_ack');
  gb.link('set_item_s', 'eq_detail_ack');

  gb.act('eq_detail_api', 'api_action', {
    name: 'item_res',
    ephemeral: false,
    request_options: {
      method: 'GET',
      url: `${BACKEND_BASE}/api/wiki/item/{wiki_item_id}`,
      headers: [],
      params: [],
      body: [],
      rawBody: '',
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
  }, { x: -150, y: 2160 });
  gb.link('eq_detail_ack', 'eq_detail_api');

  makeEmbedAction(gb, 'eq_detail_edit', {
    title: '{item_res.response.embed.title}',
    description: '{item_res.response.embed.description}',
    color: '#f59e0b',
    imageUrl: `${BACKEND_BASE}/api/wiki/item/{wiki_item_id}.png?t={time_now_unix}`,
    target: { editId: 'eq_detail_ack' },
    action_id: 'eq_detail_ack',
    footerText: '{item_res.response.embed.footer}',
  }, { x: -150, y: 2340 });
  gb.link('eq_detail_api', 'eq_detail_edit');

  // 5. Chuyên mục Linh Thú + 4 Dropdown Riêng Biệt Theo Phẩm Cấp (Phàm / Linh / Tiên / Thần Thoại)
  makeEmbedAction(gb, 'msg_wiki_pets', {
    title: pt.title,
    description: pt.content,
    color: '#ec4899',
    fields: pt.fields,
    footerText: 'SuMi Family • Bách Khoa Linh Thú',
  }, { x: 850, y: 1380 });
  gb.link(rPets, 'msg_wiki_pets');
  gb.link(sPets, 'msg_wiki_pets');

  gb.advSelectMenu('sel_pet_common', 'msg_wiki_pets', {
    placeholder: 'Phàm Phẩm (5 Linh Thú)',
    customVariableName: 'picked_pet_c',
    row: '1',
    weight: '1',
    showReplies: 'show',
    basic_options: buildPetOptions(['common']),
  }, { x: 450, y: 1620 });

  gb.advSelectMenu('sel_pet_rare', 'msg_wiki_pets', {
    placeholder: 'Linh Phẩm (5 Linh Thú)',
    customVariableName: 'picked_pet_r',
    row: '2',
    weight: '1',
    showReplies: 'show',
    basic_options: buildPetOptions(['rare']),
  }, { x: 750, y: 1620 });

  gb.advSelectMenu('sel_pet_epic', 'msg_wiki_pets', {
    placeholder: 'Tiên Phẩm (4 Linh Thú)',
    customVariableName: 'picked_pet_e',
    row: '3',
    weight: '1',
    showReplies: 'show',
    basic_options: buildPetOptions(['epic']),
  }, { x: 1050, y: 1620 });

  gb.advSelectMenu('sel_pet_mythic', 'msg_wiki_pets', {
    placeholder: 'Thần Thoại (6 Linh Thú)',
    customVariableName: 'picked_pet_m',
    row: '4',
    weight: '1',
    showReplies: 'show',
    basic_options: buildPetOptions(['mythic']),
  }, { x: 1350, y: 1620 });

  gb.act('set_pet_c', 'set_unique_variable', { reference: 'wiki_pet_id', value: '{picked_pet_c}', success_handles: false }, { x: 450, y: 1800 });
  gb.act('set_pet_r', 'set_unique_variable', { reference: 'wiki_pet_id', value: '{picked_pet_r}', success_handles: false }, { x: 750, y: 1800 });
  gb.act('set_pet_e', 'set_unique_variable', { reference: 'wiki_pet_id', value: '{picked_pet_e}', success_handles: false }, { x: 1050, y: 1800 });
  gb.act('set_pet_m', 'set_unique_variable', { reference: 'wiki_pet_id', value: '{picked_pet_m}', success_handles: false }, { x: 1350, y: 1800 });
  gb.link('sel_pet_common', 'set_pet_c');
  gb.link('sel_pet_rare', 'set_pet_r');
  gb.link('sel_pet_epic', 'set_pet_e');
  gb.link('sel_pet_mythic', 'set_pet_m');

  makeEmbedAction(gb, 'pet_detail_ack', {
    title: `${em('su_pet_paw')} Đang tải Thẻ Linh Thú Full HD+...`,
    description: 'Đang tra cứu hệ nguyên tố, bộ chỉ số ATK/DEF/SPD/HP và kỹ năng HAX...',
    color: '#ec4899',
    editId: 'pet_detail_ack',
    footerText: 'SuMi Family • Bách Khoa Linh Thú',
  }, { x: 900, y: 1980 });
  gb.link('set_pet_c', 'pet_detail_ack');
  gb.link('set_pet_r', 'pet_detail_ack');
  gb.link('set_pet_e', 'pet_detail_ack');
  gb.link('set_pet_m', 'pet_detail_ack');

  gb.act('pet_detail_api', 'api_action', {
    name: 'pet_res',
    ephemeral: false,
    request_options: {
      method: 'GET',
      url: `${BACKEND_BASE}/api/wiki/pet/{wiki_pet_id}`,
      headers: [],
      params: [],
      body: [],
      rawBody: '',
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
  }, { x: 900, y: 2160 });
  gb.link('pet_detail_ack', 'pet_detail_api');

  makeEmbedAction(gb, 'pet_detail_edit', {
    title: '{pet_res.response.embed.title}',
    description: '{pet_res.response.embed.description}',
    color: '#ec4899',
    imageUrl: `${BACKEND_BASE}/api/wiki/pet/{wiki_pet_id}.png?t={time_now_unix}`,
    target: { editId: 'pet_detail_ack' },
    action_id: 'pet_detail_ack',
    footerText: '{pet_res.response.embed.footer}',
  }, { x: 900, y: 2340 });
  gb.link('pet_detail_api', 'pet_detail_edit');

  return gb.elements();
}

// ============================================================================
// 5. Custom Events — Cộng EXP Chat & Voice (Tự Khởi Tạo Tân Thủ + Đồng Bộ Level Roles)
// ============================================================================
export function buildChatExpEvent() {
  const gb = new ExtendedGraphBuilder();
  gb.rootEvent('SuMi — Chat EXP', 'messageCreate');
  gb.errorHandlerWait();

  // Chỉ chạy trong SuMi Family
  const cSrv = gb.cmp('ce_srv', '{server_id}', SUMI_GUILD_ID, 'equal_to', {}, { x: 0, y: 200 });
  gb.link('root', cSrv.condId);

  // Bỏ qua tin nhắn bot
  const cBot = gb.cmp('ce_bot', '{isBot}', 'true', 'equal_to', { ignoreCase: true }, { x: -180, y: 400 });
  gb.link(cSrv.yes, cBot.condId);

  // Gọi Backend POST /api/exp/chat
  // Lưu ý: messageCreate của BotGhost KHÔNG định nghĩa {event_user_display_name}; dùng {user_displayName} + fallback {event_user_name}
  gb.act('ce_api', 'api_action', {
    name: 'exp_res',
    ephemeral: false,
    request_options: {
      method: 'POST',
      url: `${BACKEND_BASE}/api/exp/chat`,
      headers: [{ key: 'Content-Type', value: 'application/json' }],
      params: [],
      body: [],
      rawBody: '{"userId":"{event_user_id}","username":"{user_displayName}","fallbackUsername":"{event_user_name}","avatarUrl":"{event_user_avatar}","roleIds":"{user_role_ids[{event_user_id}]},{user_role_ids}","isBot":"{isBot}"}',
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
  }, { x: 0, y: 620 });
  gb.link(cBot.no, 'ce_api');

  // Chỉ thông báo & cấp Level Role khi thực sự lên cấp (leveled_up == true)
  const cLvl = gb.cmp('ce_lvl', '{exp_res.response.leveled_up}', 'true', 'equal_to', { ignoreCase: true }, { x: 0, y: 820 });
  gb.link('ce_api', cLvl.condId);

  makeEmbedAction(gb, 'ce_notify', {
    title: `${em('su_level_up')} ĐỘT PHÁ CẢNH GIỚI TU TIÊN`,
    description: '{exp_res.response.level_up_message}',
    color: '#fbbf24',
    target: { id: LEVEL_UP_NOTIFY_CHANNEL_ID },
    footerText: 'SuMi Family • Chat EXP Tu Luyện',
  }, { x: -180, y: 1040 });
  gb.link(cLvl.yes, 'ce_notify');

  // Pacing 1s trước khi cấp Discord Role (tuân thủ guardrail chống HTTP 429)
  gb.act('ce_wait_role', 'wait_action', { seconds: '1', success_handles: false }, { x: -180, y: 1220 });
  gb.link('ce_notify', 'ce_wait_role');

  const cRole = gb.cmp('ce_has_role', '{exp_res.response.unlocked_level_role_id}', '^[0-9]+$', 'matches_pattern', {}, { x: -180, y: 1400 });
  gb.link('ce_wait_role', cRole.condId);

  gb.act('ce_add_role', 'role_add', {
    roles: [],
    additional_roles: '{exp_res.response.unlocked_level_role_id}',
    success_handles: false,
    target: { variable: '{event_user_id}' },
    server_id: '',
  }, { x: -340, y: 1620 });
  gb.link(cRole.yes, 'ce_add_role');

  return gb.elements();
}

export function buildVoiceExpEvent(eventName, eventType, action) {
  const gb = new ExtendedGraphBuilder();
  gb.rootEvent(eventName, eventType);
  gb.errorHandlerWait();

  const cSrv = gb.cmp('ve_srv', '{server_id}', SUMI_GUILD_ID, 'equal_to', {}, { x: 0, y: 200 });
  gb.link('root', cSrv.condId);

  // Bỏ qua bot vào/ra phòng thoại
  const cBot = gb.cmp('ve_bot', '{isBot}', 'true', 'equal_to', { ignoreCase: true }, { x: -180, y: 380 });
  gb.link(cSrv.yes, cBot.condId);

  gb.act('ve_api', 'api_action', {
    name: 'vexp_res',
    ephemeral: false,
    request_options: {
      method: 'POST',
      url: `${BACKEND_BASE}/api/exp/voice`,
      headers: [{ key: 'Content-Type', value: 'application/json' }],
      params: [],
      body: [],
      rawBody: `{"userId":"{event_user_id}","username":"{event_user_display_name}","fallbackUsername":"{event_user_name}","avatarUrl":"{user_icon}","roleIds":"{user_role_ids[{event_user_id}]},{user_role_ids}","isBot":"{isBot}","action":"${action}"}`,
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
  }, { x: 0, y: 580 });
  gb.link(cBot.no, 've_api');

  if (action === 'leave' || action === 'switch') {
    const cLvl = gb.cmp('ve_lvl', '{vexp_res.response.leveled_up}', 'true', 'equal_to', { ignoreCase: true }, { x: 0, y: 780 });
    gb.link('ve_api', cLvl.condId);

    gb.act('ve_wait_role', 'wait_action', { seconds: '1', success_handles: false }, { x: -180, y: 980 });
    gb.link(cLvl.yes, 've_wait_role');

    const cRole = gb.cmp('ve_has_role', '{vexp_res.response.unlocked_level_role_id}', '^[0-9]+$', 'matches_pattern', {}, { x: -180, y: 1160 });
    gb.link('ve_wait_role', cRole.condId);

    gb.act('ve_add_role', 'role_add', {
      roles: [],
      additional_roles: '{vexp_res.response.unlocked_level_role_id}',
      success_handles: false,
      target: { variable: '{event_user_id}' },
      server_id: '',
    }, { x: -340, y: 1380 });
    gb.link(cRole.yes, 've_add_role');
  }

  return gb.elements();
}

const TARGETS = [
  { mode: 'command', name: 'profile', build: buildProfileCmd },
  { mode: 'command', name: 'rank', build: buildRankCmd },
  { mode: 'command', name: 'battle', build: buildBattleCmd },
  { mode: 'command', name: 'wiki', build: buildWikiCmd },
  { mode: 'event', name: 'SuMi — Chat EXP', build: buildChatExpEvent },
  { mode: 'event', name: 'SuMi — Voice EXP (Join)', build: () => buildVoiceExpEvent('SuMi — Voice EXP (Join)', 'voiceChannelJoin', 'join') },
  { mode: 'event', name: 'SuMi — Voice EXP (Leave)', build: () => buildVoiceExpEvent('SuMi — Voice EXP (Leave)', 'voiceChannelLeave', 'leave') },
  { mode: 'event', name: 'SuMi — Voice EXP (Switch)', build: () => buildVoiceExpEvent('SuMi — Voice EXP (Switch)', 'voiceChannelSwitch', 'switch') },
];

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const filterArg = process.argv.find((a) => a.startsWith('--only='));
  const onlyNames = filterArg ? new Set(filterArg.slice('--only='.length).split(',')) : null;

  for (const t of TARGETS) {
    if (onlyNames && !onlyNames.has(t.name)) continue;
    const els = t.build();
    const errs = validateGraph(els);
    if (errs.length) throw new Error(`Offline validateGraph failed for ${t.name}:\n- ${errs.join('\n- ')}`);
    assertAcyclicDAG(els, t.name);
    if (t.name === 'wiki') {
      const serialized = JSON.stringify(els);
      if (/cuu_vi_hong_ho|Cửu Vĩ Hồng Hồ/i.test(serialized)) {
        throw new Error('Wiki graph must NOT contain Fuyumi exclusive pet (cuu_vi_hong_ho / Cửu Vĩ Hồng Hồ)');
      }
    }
    console.log(`[Offline OK] ${t.mode} "${t.name}": ${els.length} elements (acyclic DAG, regex & schema valid)`);

    if (!dryRun) {
      const res = await deployViaCDP({
        groupId: PROFILE_GROUP_ID,
        mode: t.mode,
        name: t.name,
        elements: els,
        enabled: true,
      });
      console.log(`[Deployed] ${t.mode} "${t.name}":`, JSON.stringify(res, null, 2));
      if (!res || !res.ok) {
        throw new Error(`Deployment failed for ${t.name}: ${JSON.stringify(res)}`);
      }
      await new Promise((r) => setTimeout(r, 1200));
    }
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
