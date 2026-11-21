import WebSocket from 'ws';
globalThis.WebSocket = WebSocket;

import {
  GraphBuilder,
  deployViaCDP,
  validateGraph,
} from './ga_builder_lib.mjs';
import {
  MARRY_RINGS,
  SHOP_PETS,
  SHOP_EQUIPMENT,
  SHOP_CONSUMABLES,
  SHOP_ROLE_PACKAGES,
  BACKGROUND_CATALOG,
} from '../src/data/catalog.js';
import { em, emId, getEmojiEntry } from '../src/config/emojiHelper.js';

const PROFILE_GROUP_ID = '1782127263978';
const BACKEND_BASE = 'https://sumi-profile-backend.onrender.com';

class Phase23GraphBuilder extends GraphBuilder {
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

  styledBtn(id, parentMsgId, {
    label,
    style = 'PRIMARY',
    emojiKey = null,
    row = '1',
    weight = '1',
    showReplies = 'show',
  }, pos = { x: 0, y: 0 }) {
    const entry = emojiKey ? getEmojiEntry(emojiKey) : null;
    return this.advBtn(id, parentMsgId, {
      label: String(label).slice(0, 78),
      style,
      ...(entry ? {
        emoji: {
          id: entry.id,
          name: entry.name,
          animated: Boolean(entry.animated),
        },
        emoji_id: entry.id,
      } : { emoji_id: '' }),
      orderComponent: true,
      row: String(row),
      weight: String(weight),
      showReplies,
    }, pos);
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
  footer = 'SuMi Family • Tu Tiên Giới',
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
        footer: { text: footer, icon_url: '' },
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

// ============================================================================
// 1. /shop (Interactive Storefront: 6 Danh Mục • Dropdown + Button Mua Ngay / Gacha / Thuê Role)
// ============================================================================
export function buildShopCmd() {
  const gb = new Phase23GraphBuilder();
  gb.rootSlash('shop', 'Cửa hàng Tiên Bảo Các: Nhẫn Cưới, Linh Thú, Pháp Bảo, Role, Vật Phẩm & Background', { ephemeral: false });
  gb.errorHandlerWait();
  gb.option('danh_muc', 'string', 'Mở nhanh danh mục cửa hàng (tùy chọn)', {
    required: false,
    choices: ['rings', 'pets', 'equipment', 'roles', 'consumables', 'backgrounds'],
    x: 420,
    y: 0,
  });

  gb.cond('sh_root_cat', 'comparison', { base_value: '{option_danh_muc}', target: { self: true } }, { x: 0, y: 220 });
  gb.link('root', 'sh_root_cat');

  const rRings = gb.branch('sh_root_cat', 'shr_rings', 'comparison', { type: 'equal_to', comparison_value: 'rings', ignoreCase: true, option: '', not: false }, { x: -750, y: 400 });
  const rPets = gb.branch('sh_root_cat', 'shr_pets', 'comparison', { type: 'equal_to', comparison_value: 'pets', ignoreCase: true, option: '', not: false }, { x: -450, y: 400 });
  const rEquip = gb.branch('sh_root_cat', 'shr_equip', 'comparison', { type: 'equal_to', comparison_value: 'equipment', ignoreCase: true, option: '', not: false }, { x: -150, y: 400 });
  const rRoles = gb.branch('sh_root_cat', 'shr_roles', 'comparison', { type: 'equal_to', comparison_value: 'roles', ignoreCase: true, option: '', not: false }, { x: 150, y: 400 });
  const rCons = gb.branch('sh_root_cat', 'shr_cons', 'comparison', { type: 'equal_to', comparison_value: 'consumables', ignoreCase: true, option: '', not: false }, { x: 450, y: 400 });
  const rBgs = gb.branch('sh_root_cat', 'shr_bgs', 'comparison', { type: 'equal_to', comparison_value: 'backgrounds', ignoreCase: true, option: '', not: false }, { x: 750, y: 400 });
  const rHome = gb.elseBranch('sh_root_cat', 'shr_home', 'comparison', { x: 1100, y: 400 });

  // Home Storefront
  embedMsg(gb, 'msg_shop_home', {
    title: `${em('su_linhthach')} TIÊN BẢO CÁC • CỬA HÀNG SUMI FAMILY`,
    description: [
      `${em('su_ring_thanthoai')} **Nhẫn Cưới (4 cấp)**: Phàm (500) • Linh (2.000) • Tiên (6.000) • Thần Thoại (18.000).`,
      `${em('su_pet_paw')} **Linh Thú (10 loài)**: Bán thẳng toàn bộ Pet Phàm Phẩm (300) & Linh Phẩm (900).`,
      `${em('su_crossed_swords')} **Pháp Bảo (24 món)**: Bán thẳng 12 món Phàm (250) & 12 món Linh (750).`,
      `${em('su_medal_role')} **Role Quyền Năng (21 gói)**: Thuê nhanh 7 Ngày, 30 Ngày hoặc mua Vĩnh Viễn.`,
      `${em('su_star_stone')} **Vật Phẩm (5 món)**: Vé Gacha (50), Tinh Thạch Sao (100), Thẻ Đổi Danh Hiệu (300), Lệnh Bài Khung (800).`,
      `${em('su_frame_token')} **Background Hồ Sơ (20 mẫu)**: Bộ sưu tập nền Full HD+ (300–4.000 Linh Thạch).`,
      ``,
      `${em('su_gacha_dice')} *Pet Tiên/Thần Thoại, Role Đa Năng & 9 Pháp Bảo Độc Nhất 1% mở khóa qua Gacha \`/roll\` hoặc nút Quay Nhanh.*`,
    ].join('\n'),
    color: '#ec4899',
    footer: 'SuMi Family • Tiên Bảo Các',
  }, { x: 1100, y: 620 });
  gb.link(rHome, 'msg_shop_home');

  gb.advSelectMenu('sel_shop_cat', 'msg_shop_home', {
    placeholder: 'Danh mục Cửa Hàng Tiên Giới',
    customVariableName: 'shop_pick_cat',
    row: '1',
    weight: '1',
    basic_options: [
      { label: 'Nhẫn Cưới Tiên Lữ (4 cấp)', description: 'Mua nhẫn cầu hôn hoặc nâng cấp nhẫn đang đeo', emoji_id: emId('su_ring_thanthoai'), value: 'rings' },
      { label: 'Linh Thú Phàm & Linh (10 loài)', description: '300 - 900 Linh Thạch (Tiên/Thần Thoại chỉ qua /roll)', emoji_id: emId('su_pet_paw'), value: 'pets' },
      { label: 'Pháp Bảo Phàm & Linh (24 món)', description: '250 - 750 Linh Thạch (Vũ Khí, Bảo Ngọc, Chiến Hồn)', emoji_id: emId('su_crossed_swords'), value: 'equipment' },
      { label: 'Role Quyền Năng (21 gói)', description: 'Thuê 7 Ngày / 30 Ngày hoặc sở hữu Vĩnh Viễn', emoji_id: emId('su_medal_role'), value: 'roles' },
      { label: 'Vật Phẩm & Trang Trí (5 món)', description: 'Vé Gacha, Tinh Thạch Sao, Thẻ Danh Hiệu, Khung Avatar', emoji_id: emId('su_star_stone'), value: 'consumables' },
      { label: 'Background Profile & Rank (20 mẫu)', description: '20 mẫu nền trang trí thẻ /profile & /rank (300 - 4.000 LT)', emoji_id: emId('su_frame_token'), value: 'backgrounds' },
    ],
  }, { x: 1000, y: 820 });

  gb.styledBtn('btn_home_gacha_eq', 'msg_shop_home', {
    label: 'Quay Gacha Pháp Bảo (1 Lượt)',
    style: 'PRIMARY',
    emojiKey: 'su_gacha_dice',
    row: '2',
    weight: '1',
  }, { x: 1320, y: 820 });

  gb.styledBtn('btn_home_gacha_pet', 'msg_shop_home', {
    label: 'Quay Gacha Linh Thú (1 Lượt)',
    style: 'PRIMARY',
    emojiKey: 'su_ticket_pet',
    row: '2',
    weight: '2',
  }, { x: 1620, y: 820 });

  // Quick Gacha Handlers
  apiAction(gb, 'api_qroll_eq', 'qr_eq_res', 'POST', `${BACKEND_BASE}/api/economy/roll`,
    '{"userId":"{user_id}","username":"{user_displayName}","avatarUrl":"{user_icon}","pool":"equipment","count":"1","useTicket":"true"}', { x: 1320, y: 1020 });
  gb.link('btn_home_gacha_eq', 'api_qroll_eq');
  embedMsg(gb, 'msg_qroll_eq', {
    title: `${em('su_gacha_dice')} KẾT QUẢ RÈN PHÁP BẢO (1 LƯỢT)`,
    description: '{qr_eq_res.response.message}',
    color: '#f59e0b',
  }, { x: 1320, y: 1200 });
  gb.link('api_qroll_eq', 'msg_qroll_eq');

  apiAction(gb, 'api_qroll_pet', 'qr_pet_res', 'POST', `${BACKEND_BASE}/api/economy/roll`,
    '{"userId":"{user_id}","username":"{user_displayName}","avatarUrl":"{user_icon}","pool":"pet","count":"1","useTicket":"true"}', { x: 1620, y: 1020 });
  gb.link('btn_home_gacha_pet', 'api_qroll_pet');
  embedMsg(gb, 'msg_qroll_pet', {
    title: `${em('su_ticket_pet')} KẾT QUẢ TRIỆU HỒI LINH THÚ (1 LƯỢT)`,
    description: '{qr_pet_res.response.message}',
    color: '#ec4899',
  }, { x: 1620, y: 1200 });
  gb.link('api_qroll_pet', 'msg_qroll_pet');

  // Category Select Routing
  gb.cond('sh_sel_cat', 'comparison', { base_value: '{shop_pick_cat}', target: { self: true } }, { x: 1000, y: 1000 });
  gb.link('sel_shop_cat', 'sh_sel_cat');

  const sRings = gb.branch('sh_sel_cat', 'shs_rings', 'comparison', { type: 'equal_to', comparison_value: 'rings', ignoreCase: true, option: '', not: false }, { x: -750, y: 1180 });
  const sPets = gb.branch('sh_sel_cat', 'shs_pets', 'comparison', { type: 'equal_to', comparison_value: 'pets', ignoreCase: true, option: '', not: false }, { x: -450, y: 1180 });
  const sEquip = gb.branch('sh_sel_cat', 'shs_equip', 'comparison', { type: 'equal_to', comparison_value: 'equipment', ignoreCase: true, option: '', not: false }, { x: -150, y: 1180 });
  const sRoles = gb.branch('sh_sel_cat', 'shs_roles', 'comparison', { type: 'equal_to', comparison_value: 'roles', ignoreCase: true, option: '', not: false }, { x: 150, y: 1180 });
  const sCons = gb.branch('sh_sel_cat', 'shs_cons', 'comparison', { type: 'equal_to', comparison_value: 'consumables', ignoreCase: true, option: '', not: false }, { x: 450, y: 1180 });
  const sBgs = gb.elseBranch('sh_sel_cat', 'shs_bgs', 'comparison', { x: 750, y: 1180 });

  // Category 1: Rings
  embedMsg(gb, 'msg_shop_rings', {
    title: `${em('su_ring_thanthoai')} QUẦY NHẪN CƯỚI TIÊN LỮ (4 CẤP)`,
    description: MARRY_RINGS.map((r) => `• **${r.name}** *(${r.rarity})* — **${r.price.toLocaleString('vi-VN')}** ${em('su_linhthach')} • +${r.exp_bonus_pct}% EXP & +${r.power_bonus_pct}% Chiến Lực`).join('\n'),
    color: '#fb7185',
  }, { x: -750, y: 1380 });
  gb.link(rRings, 'msg_shop_rings');
  gb.link(sRings, 'msg_shop_rings');
  gb.advSelectMenu('sel_shop_ring', 'msg_shop_rings', {
    placeholder: 'Chọn Nhẫn Cưới để xem chi tiết & mua',
    customVariableName: 'picked_shop_ring',
    basic_options: MARRY_RINGS.map((r) => ({
      label: r.name,
      description: `${r.rarity} • ${r.price.toLocaleString('vi-VN')} LT • +${r.exp_bonus_pct}% EXP/Lực`,
      emoji_id: emId(r.item_id === 'ring_mythic' ? 'su_ring_thanthoai' : r.item_id === 'ring_epic' ? 'su_ring_tien' : r.item_id === 'ring_rare' ? 'su_ring_linh' : 'su_ring_pham'),
      value: r.item_id,
    })),
  }, { x: -750, y: 1580 });

  // Category 2: Pets (10 Phàm & Linh)
  embedMsg(gb, 'msg_shop_pets', {
    title: `${em('su_pet_paw')} QUẦY LINH THÚ PHÀM & LINH (10 LOÀI)`,
    description: `• **Phàm Phẩm (5 loài)**: \`300\` ${em('su_linhthach')}\n• **Linh Phẩm (5 loài)**: \`900\` ${em('su_linhthach')}\n• *Linh Thú Tiên Phẩm & Thần Thoại chỉ mở từ \`/roll\`.*`,
    color: '#ec4899',
  }, { x: -450, y: 1380 });
  gb.link(rPets, 'msg_shop_pets');
  gb.link(sPets, 'msg_shop_pets');
  gb.advSelectMenu('sel_shop_pet', 'msg_shop_pets', {
    placeholder: 'Chọn Linh Thú Phàm / Linh Phẩm (10 loài)',
    customVariableName: 'picked_shop_pet',
    basic_options: SHOP_PETS.map((p) => ({
      label: p.pet_name,
      description: `${p.rarity} • Hệ ${p.element} • ${p.price} LT • ${p.hax_skill}`,
      emoji_id: emId(p.emoji_key),
      value: p.pet_type,
    })),
  }, { x: -450, y: 1580 });

  // Category 3: Equipment (24 items in 3 dropdowns: 8 weapons, 8 gems, 8 souls)
  embedMsg(gb, 'msg_shop_equip', {
    title: `${em('su_crossed_swords')} QUẦY PHÁP BẢO PHÀM & LINH (24 MÓN)`,
    description: `• **Phàm Phẩm (12 món)**: \`250\` ${em('su_linhthach')}\n• **Linh Phẩm (12 món)**: \`750\` ${em('su_linhthach')}\n• *Pháp Bảo Tiên Phẩm & 9 món Thần Thoại Độc Nhất chỉ mở từ \`/roll\`.*`,
    color: '#f59e0b',
  }, { x: -150, y: 1380 });
  gb.link(rEquip, 'msg_shop_equip');
  gb.link(sEquip, 'msg_shop_equip');
  const eqOpts = (type) => SHOP_EQUIPMENT.filter((e) => e.item_type === type).map((e) => ({
    label: e.item_name,
    description: `${e.rarity} • Hệ ${e.element} • ${e.price} LT`,
    emoji_id: emId(e.emoji_key),
    value: e.item_id,
  }));
  gb.advSelectMenu('sel_shop_eq_w', 'msg_shop_equip', { placeholder: 'Vũ Khí Phàm & Linh (8 món)', customVariableName: 'picked_shop_eq_w', row: '1', weight: '1', basic_options: eqOpts('weapon') }, { x: -240, y: 1580 });
  gb.advSelectMenu('sel_shop_eq_g', 'msg_shop_equip', { placeholder: 'Bảo Ngọc Phàm & Linh (8 món)', customVariableName: 'picked_shop_eq_g', row: '2', weight: '1', basic_options: eqOpts('gem') }, { x: -80, y: 1580 });
  gb.advSelectMenu('sel_shop_eq_s', 'msg_shop_equip', { placeholder: 'Chiến Hồn Phàm & Linh (8 món)', customVariableName: 'picked_shop_eq_s', row: '3', weight: '1', basic_options: eqOpts('soul') }, { x: 80, y: 1580 });

  // Category 5: Consumables
  embedMsg(gb, 'msg_shop_cons', {
    title: `${em('su_star_stone')} QUẦY VẬT PHẨM & TRANG TRÍ (5 MÓN)`,
    description: SHOP_CONSUMABLES.map((c) => `• ${c.icon} **${c.name}** — **${c.price.toLocaleString('vi-VN')}** ${em('su_linhthach')}\n  *${c.description}*`).join('\n'),
    color: '#38bdf8',
  }, { x: 450, y: 1380 });
  gb.link(rCons, 'msg_shop_cons');
  gb.link(sCons, 'msg_shop_cons');
  gb.advSelectMenu('sel_shop_cons', 'msg_shop_cons', {
    placeholder: 'Chọn Vật Phẩm Tiêu Hao / Trang Trí (5 món)',
    customVariableName: 'picked_shop_cons',
    basic_options: SHOP_CONSUMABLES.map((c) => ({
      label: c.name,
      description: `${c.price} LT • ${c.description}`,
      emoji_id: emId(c.item_id === 'gacha_ticket_equip' ? 'su_ticket_equip' : c.item_id === 'gacha_ticket_pet' ? 'su_ticket_pet' : c.item_id === 'pet_star_stone' ? 'su_star_stone' : c.item_id === 'title_rename_card' ? 'su_title_card' : 'su_frame_token'),
      value: c.item_id,
    })),
  }, { x: 450, y: 1580 });

  // Category 6: Backgrounds (20 paid sorted by price asc — unified 1 frame & 1 dropdown)
  const paidBgs = BACKGROUND_CATALOG.filter((b) => b.price > 0).sort((a, b) => a.price - b.price);
  const bgPriceLines = paidBgs.map((b) =>
    `• **${b.name}** *(${b.rarity})* — **${b.price.toLocaleString('vi-VN')}** ${em('su_linhthach')}`
  ).join('\n');
  embedMsg(gb, 'msg_shop_bgs', {
    title: `${em('su_frame_token')} QUẦY BACKGROUND PROFILE & RANK (${paidBgs.length} MẪU)`,
    description: `${bgPriceLines}\n\n• Chọn mẫu nền ở menu bên dưới để xem trước & mua ngay cho \`/profile\` + \`/rank\` (\`/equip\`).`,
    color: '#a855f7',
  }, { x: 750, y: 1380 });
  gb.link(rBgs, 'msg_shop_bgs');
  gb.link(sBgs, 'msg_shop_bgs');
  const bgOpts = (arr) => arr.map((b) => ({
    label: b.name,
    description: `${b.rarity} • ${b.price.toLocaleString('vi-VN')} LT`,
    emoji_id: emId('su_frame_token'),
    value: b.bg_id,
  }));
  gb.advSelectMenu('sel_shop_bg', 'msg_shop_bgs', {
    placeholder: `Chọn Background Hồ Sơ (${paidBgs.length} mẫu • 300 - 4.000 LT)`,
    customVariableName: 'picked_shop_bg',
    row: '1',
    weight: '1',
    basic_options: bgOpts(paidBgs),
  }, { x: 750, y: 1580 });

  // Shared Preview -> Buy Now Flow for all non-role items
  const setters = [
    ['set_sh_ring', 'sel_shop_ring', '{picked_shop_ring}', -750],
    ['set_sh_pet', 'sel_shop_pet', '{picked_shop_pet}', -450],
    ['set_sh_eq_w', 'sel_shop_eq_w', '{picked_shop_eq_w}', -240],
    ['set_sh_eq_g', 'sel_shop_eq_g', '{picked_shop_eq_g}', -80],
    ['set_sh_eq_s', 'sel_shop_eq_s', '{picked_shop_eq_s}', 80],
    ['set_sh_cons', 'sel_shop_cons', '{picked_shop_cons}', 450],
    ['set_sh_bg', 'sel_shop_bg', '{picked_shop_bg}', 750],
  ];
  for (const [sid, src, refVal, x] of setters) {
    gb.act(sid, 'set_unique_variable', { reference: 'shop_preview_id', value: refVal, success_handles: false }, { x, y: 1760 });
    gb.link(src, sid);
  }

  embedMsg(gb, 'shop_prev_ack', {
    title: `${em('su_sparkle')} Đang tải thông tin vật phẩm...`,
    description: 'Đang kiểm tra kho đồ và số dư Linh Thạch...',
    color: '#38bdf8',
    editId: 'shop_prev_ack',
  }, { x: 0, y: 1960 });
  for (const [sid] of setters) gb.link(sid, 'shop_prev_ack');

  apiAction(gb, 'shop_prev_api', 'sh_prev_res', 'POST', `${BACKEND_BASE}/api/shop/preview`,
    '{"userId":"{user_id}","username":"{user_displayName}","avatarUrl":"{user_icon}","itemId":"{shop_preview_id}"}', { x: 0, y: 2140 });
  gb.link('shop_prev_ack', 'shop_prev_api');

  embedMsg(gb, 'shop_prev_edit', {
    title: '{sh_prev_res.response.title}',
    description: '{sh_prev_res.response.description}',
    color: '#ec4899',
    imageUrl: '{sh_prev_res.response.image_url}',
    target: { editId: 'shop_prev_ack' },
    action_id: 'shop_prev_ack',
    footer: 'SuMi Family • Nhấn Mua Ngay để xác nhận giao dịch',
  }, { x: 0, y: 2320 });
  gb.link('shop_prev_api', 'shop_prev_edit');

  gb.styledBtn('btn_shop_buy_now', 'shop_prev_edit', {
    label: 'Mua Ngay',
    style: 'SUCCESS',
    emojiKey: 'su_linhthach',
    row: '1',
    weight: '1',
  }, { x: 0, y: 2520 });

  apiAction(gb, 'shop_buy_api', 'sh_buy_res', 'POST', `${BACKEND_BASE}/api/shop/buy`,
    '{"userId":"{user_id}","username":"{user_displayName}","avatarUrl":"{user_icon}"}', { x: 0, y: 2700 });
  gb.link('btn_shop_buy_now', 'shop_buy_api');

  embedMsg(gb, 'shop_buy_msg', {
    title: `${em('su_sparkle')} GIAO DỊCH TIÊN BẢO CÁC`,
    description: '{sh_buy_res.response.message}',
    color: '#10b981',
  }, { x: 0, y: 2880 });
  gb.link('shop_buy_api', 'shop_buy_msg');

  // Category 4: Roles (21 Single-Perk Packages with 7d / 30d / Permanent Buttons + wait 1s + role_add)
  embedMsg(gb, 'msg_shop_roles', {
    title: `${em('su_medal_role')} QUẦY ROLE QUYỀN NĂNG TIỆN ÍCH (${SHOP_ROLE_PACKAGES.length} GÓI)`,
    description: SHOP_ROLE_PACKAGES.map((r) => `• **${r.name}** — ${r.perk} (\`${r.prices['7d']}\`/\`${r.prices['30d']}\`/\`${r.prices.permanent.toLocaleString('vi-VN')}\`)`).join('\n'),
    color: '#a855f7',
  }, { x: 150, y: 1380 });
  gb.link(rRoles, 'msg_shop_roles');
  gb.link(sRoles, 'msg_shop_roles');

  gb.advSelectMenu('sel_shop_role', 'msg_shop_roles', {
    placeholder: `Chọn Role Quyền Năng (${SHOP_ROLE_PACKAGES.length} gói • 7d/30d/Vĩnh Viễn)`,
    customVariableName: 'picked_shop_role',
    basic_options: SHOP_ROLE_PACKAGES.map((r) => ({
      label: r.name,
      description: `7d: ${r.prices['7d']} | 30d: ${r.prices['30d']} | Vĩnh Viễn: ${r.prices.permanent.toLocaleString('vi-VN')} LT`,
      emoji_id: emId('su_medal_role'),
      value: r.role_id,
    })),
  }, { x: 240, y: 1580 });

  embedMsg(gb, 'shop_role_ack', {
    title: `${em('su_medal_role')} Đang tải gói Role Quyền Năng...`,
    description: 'Đang kiểm tra thời hạn Role và Slot trang bị...',
    color: '#a855f7',
    editId: 'shop_role_ack',
  }, { x: 240, y: 1760 });
  gb.link('sel_shop_role', 'shop_role_ack');

  apiAction(gb, 'shop_role_prev_api', 'sh_rprev_res', 'POST', `${BACKEND_BASE}/api/shop/preview`,
    '{"userId":"{user_id}","username":"{user_displayName}","avatarUrl":"{user_icon}","category":"roles","itemId":"{picked_shop_role}"}', { x: 240, y: 1960 });
  gb.link('shop_role_ack', 'shop_role_prev_api');

  embedMsg(gb, 'shop_role_prev_edit', {
    title: '{sh_rprev_res.response.title}',
    description: '{sh_rprev_res.response.description}',
    color: '#a855f7',
    target: { editId: 'shop_role_ack' },
    action_id: 'shop_role_ack',
    footer: 'SuMi Family • Chọn thời hạn thuê hoặc mua Vĩnh Viễn',
  }, { x: 240, y: 2140 });
  gb.link('shop_role_prev_api', 'shop_role_prev_edit');

  gb.styledBtn('btn_role_7d', 'shop_role_prev_edit', { label: 'Thuê 7 Ngày', style: 'PRIMARY', emojiKey: 'su_linhthach', row: '1', weight: '1' }, { x: 40, y: 2340 });
  gb.styledBtn('btn_role_30d', 'shop_role_prev_edit', { label: 'Thuê 30 Ngày', style: 'PRIMARY', emojiKey: 'su_linhthach', row: '1', weight: '2' }, { x: 260, y: 2340 });
  gb.styledBtn('btn_role_perm', 'shop_role_prev_edit', { label: 'Mua Vĩnh Viễn', style: 'SUCCESS', emojiKey: 'su_winner_trophy', row: '1', weight: '3' }, { x: 480, y: 2340 });

  gb.act('set_role_7d', 'set_unique_variable', { reference: 'shop_role_dur', value: '7d', success_handles: false }, { x: 40, y: 2520 });
  gb.act('set_role_30d', 'set_unique_variable', { reference: 'shop_role_dur', value: '30d', success_handles: false }, { x: 260, y: 2520 });
  gb.act('set_role_perm', 'set_unique_variable', { reference: 'shop_role_dur', value: 'permanent', success_handles: false }, { x: 480, y: 2520 });
  gb.link('btn_role_7d', 'set_role_7d');
  gb.link('btn_role_30d', 'set_role_30d');
  gb.link('btn_role_perm', 'set_role_perm');

  apiAction(gb, 'api_role_buy', 'sh_rbuy_res', 'POST', `${BACKEND_BASE}/api/shop/buy`,
    '{"userId":"{user_id}","username":"{user_displayName}","avatarUrl":"{user_icon}","duration":"{shop_role_dur}"}', { x: 260, y: 2700 });
  gb.link('set_role_7d', 'api_role_buy');
  gb.link('set_role_30d', 'api_role_buy');
  gb.link('set_role_perm', 'api_role_buy');

  embedMsg(gb, 'shop_role_buy_msg', {
    title: `${em('su_medal_role')} MUA / THUÊ ROLE QUYỀN NĂNG`,
    description: '{sh_rbuy_res.response.message}',
    color: '#10b981',
  }, { x: 260, y: 2880 });
  gb.link('api_role_buy', 'shop_role_buy_msg');

  gb.act('sh_role_wait', 'wait_action', { seconds: '1', success_handles: false }, { x: 260, y: 3060 });
  gb.link('shop_role_buy_msg', 'sh_role_wait');

  const cAddRole = gb.cmp('sh_has_role', '{sh_rbuy_res.response.add_role_id}', '^[0-9]+$', 'matches_pattern', {}, { x: 260, y: 3240 });
  gb.link('sh_role_wait', cAddRole.condId);

  gb.act('sh_add_role', 'role_add', {
    roles: [],
    additional_roles: '{sh_rbuy_res.response.add_role_id}',
    success_handles: false,
    target: { variable: '{user_id}' },
    server_id: '',
  }, { x: 100, y: 3440 });
  gb.link(cAddRole.yes, 'sh_add_role');

  return gb.elements();
}

// ============================================================================
// 2. /marry (Tiên Lữ Kết Hôn: Cầu Hôn Button + Trạng Thái + Nâng Cấp Nhẫn)
// ============================================================================
export function buildMarryCmd() {
  const gb = new Phase23GraphBuilder();
  gb.rootSlash('marry', 'Hệ thống Tiên Lữ Kết Hôn: cầu hôn, xem kỷ niệm & nâng cấp Nhẫn Cưới', { ephemeral: false });
  gb.errorHandlerWait();
  gb.option('hanh_dong', 'string', 'Chọn thao tác Tiên Lữ', { required: true, choices: ['propose', 'status', 'upgrade_ring'], x: 420, y: 0 });
  gb.option('nguoi_thuong', 'user', 'Người bạn muốn cầu hôn (khi chọn propose)', { required: false, x: 700, y: 0 });
  gb.option('nhan', 'string', 'Loại nhẫn dùng để cầu hôn hoặc nâng cấp', {
    required: false,
    choices: ['ring_common', 'ring_rare', 'ring_epic', 'ring_mythic'],
    x: 980,
    y: 0,
  });

  gb.cond('m_mode', 'comparison', { base_value: '{option_hanh_dong}', target: { self: true } }, { x: 0, y: 220 });
  gb.link('root', 'm_mode');

  const bProp = gb.branch('m_mode', 'mm_prop', 'comparison', { type: 'equal_to', comparison_value: 'propose', ignoreCase: true, option: '', not: false }, { x: -350, y: 400 });
  const bUpd = gb.branch('m_mode', 'mm_upd', 'comparison', { type: 'equal_to', comparison_value: 'upgrade_ring', ignoreCase: true, option: '', not: false }, { x: 100, y: 400 });
  const bStat = gb.elseBranch('m_mode', 'mm_stat', 'comparison', { x: 500, y: 400 });

  // Propose
  apiAction(gb, 'm_prop_api', 'm_prop_res', 'POST', `${BACKEND_BASE}/api/marry/propose`,
    '{"proposerId":"{user_id}","proposerName":"{user_displayName}","proposerAvatar":"{user_icon}","targetId":"{option_nguoi_thuong}","targetName":"{user_displayName[option_nguoi_thuong]}","targetAvatar":"{user_icon[option_nguoi_thuong]}","ringId":"{option_nhan}"}',
    { x: -350, y: 600 });
  gb.link(bProp, 'm_prop_api');

  const cPropOk = gb.cmp('m_prop_ok', '{m_prop_res.response.proposal_id}', '^[0-9]+$', 'matches_pattern', {}, { x: -350, y: 800 });
  gb.link('m_prop_api', cPropOk.condId);

  embedMsg(gb, 'msg_marry_prop', {
    title: `${em('su_ring_thanthoai')} LỜI CẦU HÔN TIÊN LỮ`,
    description: '{m_prop_res.response.message}',
    color: '#ec4899',
    imageUrl: '{m_prop_res.response.image_url}',
    footer: 'SuMi Family • Chỉ người được cầu hôn mới có thể xác nhận',
  }, { x: -520, y: 1000 });
  gb.link(cPropOk.yes, 'msg_marry_prop');

  embedMsg(gb, 'msg_marry_prop_err', {
    title: `${em('su_ring_pham')} KHÔNG THỂ CẦU HÔN`,
    description: '{m_prop_res.response.message}',
    color: '#ef4444',
  }, { x: -180, y: 1000 });
  gb.link(cPropOk.no, 'msg_marry_prop_err');

  gb.styledBtn('btn_marry_accept', 'msg_marry_prop', { label: 'Đồng Ý Kết Hôn', style: 'SUCCESS', emojiKey: 'su_ring_thanthoai', row: '1', weight: '1' }, { x: -660, y: 1200 });
  gb.styledBtn('btn_marry_reject', 'msg_marry_prop', { label: 'Từ Chối', style: 'DANGER', row: '1', weight: '2' }, { x: -380, y: 1200 });

  gb.act('set_m_acc', 'set_unique_variable', { reference: 'marry_decision', value: 'accept', success_handles: false }, { x: -660, y: 1380 });
  gb.act('set_m_rej', 'set_unique_variable', { reference: 'marry_decision', value: 'reject', success_handles: false }, { x: -380, y: 1380 });
  gb.link('btn_marry_accept', 'set_m_acc');
  gb.link('btn_marry_reject', 'set_m_rej');

  apiAction(gb, 'm_resp_api', 'm_resp_res', 'POST', `${BACKEND_BASE}/api/marry/respond`,
    '{"responderId":"{user_id}","decision":"{marry_decision}"}', { x: -520, y: 1560 });
  gb.link('set_m_acc', 'm_resp_api');
  gb.link('set_m_rej', 'm_resp_api');

  embedMsg(gb, 'msg_marry_resp', {
    title: `${em('su_sparkle')} HỒI ÂM LỜI CẦU HÔN`,
    description: '{m_resp_res.response.message}',
    color: '#f43f5e',
    imageUrl: '{m_resp_res.response.image_url}',
  }, { x: -520, y: 1740 });
  gb.link('m_resp_api', 'msg_marry_resp');

  // Upgrade Ring
  apiAction(gb, 'm_upd_api', 'm_upd_res', 'POST', `${BACKEND_BASE}/api/marry/upgrade-ring`,
    '{"userId":"{user_id}","ringId":"{option_nhan}"}', { x: 100, y: 600 });
  gb.link(bUpd, 'm_upd_api');
  embedMsg(gb, 'msg_marry_upd', {
    title: `${em('su_ring_thanthoai')} NÂNG CẤP NHẪN CƯỚI TIÊN LỮ`,
    description: '{m_upd_res.response.message}',
    color: '#fbbf24',
    imageUrl: '{m_upd_res.response.image_url}',
  }, { x: 100, y: 800 });
  gb.link('m_upd_api', 'msg_marry_upd');

  // Status
  apiAction(gb, 'm_stat_api', 'm_stat_res', 'GET',
    `${BACKEND_BASE}/api/marry/status/{user_id}?username={encode_text[{user_displayName}]}&avatar={encode_text[{user_icon}]}`, '', { x: 500, y: 600 });
  gb.link(bStat, 'm_stat_api');
  embedMsg(gb, 'msg_marry_stat', {
    title: `${em('su_ring_thanthoai')} HỒ SƠ TIÊN LỮ KẾT DUYÊN`,
    description: '{m_stat_res.response.message}',
    color: '#ec4899',
    imageUrl: '{m_stat_res.response.image_url}',
  }, { x: 500, y: 800 });
  gb.link('m_stat_api', 'msg_marry_stat');

  return gb.elements();
}

// ============================================================================
// 3. /divorce (Ly Hôn Có Nút Xác Nhận An Toàn)
// ============================================================================
export function buildDivorceCmd() {
  const gb = new Phase23GraphBuilder();
  gb.rootSlash('divorce', 'Ly hôn Tiên Lữ hiện tại (thu hồi Nhẫn Cưới & buff cặp đôi)', { ephemeral: false });
  gb.errorHandlerWait();

  embedMsg(gb, 'msg_div_confirm', {
    title: '💔 XÁC NHẬN LY HÔN TIÊN LỮ',
    description: `**{user_displayName}**, bạn có chắc chắn muốn đoạn tuyệt Tiên Duyên hiện tại không?\n• Mối liên kết cặp đôi và Nhẫn Cưới sẽ bị thu hồi khỏi cả hai hồ sơ.`,
    color: '#ef4444',
    footer: 'SuMi Family • Hãy cân nhắc kỹ trước khi xác nhận',
  }, { x: 0, y: 220 });
  gb.link('root', 'msg_div_confirm');

  gb.styledBtn('btn_div_yes', 'msg_div_confirm', { label: 'Xác Nhận Ly Hôn', style: 'DANGER', row: '1', weight: '1' }, { x: -180, y: 420 });
  gb.styledBtn('btn_div_no', 'msg_div_confirm', { label: 'Hủy Bỏ', style: 'SECONDARY', row: '1', weight: '2' }, { x: 180, y: 420 });

  apiAction(gb, 'div_api', 'div_res', 'POST', `${BACKEND_BASE}/api/marry/divorce`, '{"userId":"{user_id}"}', { x: -180, y: 600 });
  gb.link('btn_div_yes', 'div_api');

  embedMsg(gb, 'msg_div_done', {
    title: '💔 KẾT QUẢ LY HÔN',
    description: '{div_res.response.message}',
    color: '#64748b',
  }, { x: -180, y: 780 });
  gb.link('div_api', 'msg_div_done');

  embedMsg(gb, 'msg_div_cancel', {
    title: `${em('su_sparkle')} ĐÃ HỦY BỎ`,
    description: 'Đã giữ nguyên mối nhân duyên Tiên Lữ của bạn!',
    color: '#10b981',
  }, { x: 180, y: 600 });
  gb.link('btn_div_no', 'msg_div_cancel');

  return gb.elements();
}

// ============================================================================
// 4. /giatoc (Hệ Thống Gia Tộc Lv.1–10 & Bang Chiến 24H)
// ============================================================================
export function buildGiatocCmd() {
  const gb = new Phase23GraphBuilder();
  gb.rootSlash('giatoc', 'Quản lý Gia Tộc Lv.1-10, Cống Hiến & Gia Tộc Chiến 24H', { ephemeral: false });
  gb.errorHandlerWait();

  gb.option('hanh_dong', 'string', 'Chọn thao tác Gia Tộc', {
    required: true,
    choices: ['info', 'top', 'create', 'join', 'requests', 'approve', 'reject', 'leave', 'kick', 'donate', 'upgrade', 'war_declare', 'war_accept', 'war_reject', 'war_status'],
    x: 420,
    y: 0,
  });
  gb.option('ten_hoac_ma', 'string', 'Tên / Mã Gia Tộc (khi tạo, xin vào, xem hoặc tuyên chiến)', { required: false, x: 700, y: 0 });
  gb.option('tag', 'string', 'Tag ngắn 2-8 ký tự khi tạo Gia Tộc (vd: TH)', { required: false, x: 980, y: 0 });
  gb.option('thanh_vien', 'user', 'Thành viên cần duyệt hoặc trục xuất', { required: false, x: 1260, y: 0 });
  gb.option('so_linh_thach', 'int', 'Số Linh Thạch cống hiến hoặc đặt cược Bang Chiến', { required: false, x: 1540, y: 0 });

  gb.cond('gt_mode', 'comparison', { base_value: '{option_hanh_dong}', target: { self: true } }, { x: 0, y: 240 });
  gb.link('root', 'gt_mode');

  const specs = [
    { key: 'top', method: 'GET', url: `${BACKEND_BASE}/api/clan/leaderboard?limit=10`, body: '', title: `${em('su_winner_trophy')} BẢNG XẾP HẠNG GIA TỘC`, msgVar: 'gt_top_res', color: '#fbbf24' },
    { key: 'create', method: 'POST', url: `${BACKEND_BASE}/api/clan/create`, body: '{"userId":"{user_id}","username":"{user_displayName}","avatarUrl":"{user_icon}","clanName":"{option_ten_hoac_ma}","clanTag":"{option_tag}"}', title: `${em('su_clan_castle')} THÀNH LẬP GIA TỘC`, msgVar: 'gt_cr_res', color: '#10b981' },
    { key: 'join', method: 'POST', url: `${BACKEND_BASE}/api/clan/join`, body: '{"userId":"{user_id}","username":"{user_displayName}","avatarUrl":"{user_icon}","clanQuery":"{option_ten_hoac_ma}"}', title: `${em('su_wiki_scroll')} XIN GIA NHẬP GIA TỘC`, msgVar: 'gt_jn_res', color: '#38bdf8' },
    { key: 'requests', method: 'GET', url: `${BACKEND_BASE}/api/clan/requests/{user_id}`, body: '', title: `${em('su_wiki_scroll')} ĐƠN XIN GIA NHẬP`, msgVar: 'gt_rq_res', color: '#38bdf8' },
    { key: 'approve', method: 'POST', url: `${BACKEND_BASE}/api/clan/approve`, body: '{"leaderId":"{user_id}","applicantId":"{option_thanh_vien}","decision":"approve"}', title: `${em('su_sparkle')} DUYỆT THÀNH VIÊN GIA TỘC`, msgVar: 'gt_ap_res', color: '#10b981' },
    { key: 'reject', method: 'POST', url: `${BACKEND_BASE}/api/clan/approve`, body: '{"leaderId":"{user_id}","applicantId":"{option_thanh_vien}","decision":"reject"}', title: `${em('su_wiki_scroll')} TỪ CHỐI ĐƠN GIA NHẬP`, msgVar: 'gt_rj_res', color: '#64748b' },
    { key: 'leave', method: 'POST', url: `${BACKEND_BASE}/api/clan/leave`, body: '{"userId":"{user_id}"}', title: `${em('su_clan_castle')} RỜI GIA TỘC`, msgVar: 'gt_lv_res', color: '#f43f5e' },
    { key: 'kick', method: 'POST', url: `${BACKEND_BASE}/api/clan/kick`, body: '{"leaderId":"{user_id}","targetId":"{option_thanh_vien}"}', title: `${em('su_clan_castle')} TRỤC XUẤT THÀNH VIÊN`, msgVar: 'gt_kk_res', color: '#ef4444' },
    { key: 'donate', method: 'POST', url: `${BACKEND_BASE}/api/clan/donate`, body: '{"userId":"{user_id}","amount":"{option_so_linh_thach}"}', title: `${em('su_linhthach')} CỐNG HIẾN NGÂN KHỐ`, msgVar: 'gt_dn_res', color: '#38bdf8' },
    { key: 'upgrade', method: 'POST', url: `${BACKEND_BASE}/api/clan/upgrade`, body: '{"userId":"{user_id}"}', title: `${em('su_level_up')} NÂNG CẤP GIA TỘC`, msgVar: 'gt_up_res', color: '#a855f7' },
    { key: 'war_declare', method: 'POST', url: `${BACKEND_BASE}/api/clan/war/declare`, body: '{"leaderId":"{user_id}","targetClan":"{option_ten_hoac_ma}","betAmount":"{option_so_linh_thach}"}', title: `${em('su_crossed_swords')} TUYÊN CHIẾN GIA TỘC 24H`, msgVar: 'gt_wd_res', color: '#f43f5e' },
    { key: 'war_accept', method: 'POST', url: `${BACKEND_BASE}/api/clan/war/respond`, body: '{"leaderId":"{user_id}","decision":"accept"}', title: `${em('su_arena')} KHAI HỎA BANG CHIẾN 24H`, msgVar: 'gt_wa_res', color: '#f59e0b' },
    { key: 'war_reject', method: 'POST', url: `${BACKEND_BASE}/api/clan/war/respond`, body: '{"leaderId":"{user_id}","decision":"reject"}', title: '🏳️ TỪ CHỐI CHIẾN THƯ', msgVar: 'gt_wr_res', color: '#64748b' },
    { key: 'war_status', method: 'GET', url: `${BACKEND_BASE}/api/clan/war/status/{user_id}`, body: '', title: `${em('su_crossed_swords')} CHIẾN BÁO BANG CHIẾN 24H`, msgVar: 'gt_ws_res', color: '#ec4899' },
  ];

  specs.forEach((sp, idx) => {
    const x = -2100 + idx * 300;
    const br = gb.branch('gt_mode', `gtb_${sp.key}`, 'comparison', { type: 'equal_to', comparison_value: sp.key, ignoreCase: true, option: '', not: false }, { x, y: 440 });
    apiAction(gb, `gta_${sp.key}`, sp.msgVar, sp.method, sp.url, sp.body, { x, y: 640 });
    gb.link(br, `gta_${sp.key}`);
    embedMsg(gb, `gtm_${sp.key}`, {
      title: sp.title,
      description: `{${sp.msgVar}.response.message}`,
      color: sp.color,
    }, { x, y: 840 });
    gb.link(`gta_${sp.key}`, `gtm_${sp.key}`);
  });

  const bInfo = gb.elseBranch('gt_mode', 'gtb_info', 'comparison', { x: 2100, y: 440 });
  apiAction(gb, 'gta_info', 'gt_in_res', 'GET',
    `${BACKEND_BASE}/api/clan/info/{user_id}?clan={encode_text[{option_ten_hoac_ma}]}&username={encode_text[{user_displayName}]}&avatar={encode_text[{user_icon}]}`, '', { x: 2100, y: 640 });
  gb.link(bInfo, 'gta_info');
  embedMsg(gb, 'gtm_info', {
    title: `${em('su_clan_castle')} THÔNG TIN GIA TỘC`,
    description: '{gt_in_res.response.message}',
    color: '#ec4899',
  }, { x: 2100, y: 840 });
  gb.link('gta_info', 'gtm_info');

  return gb.elements();
}

const TARGETS = [
  { name: 'shop', build: buildShopCmd },
  { name: 'marry', build: buildMarryCmd },
  { name: 'divorce', build: buildDivorceCmd },
  { name: 'giatoc', build: buildGiatocCmd },
];

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

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const filterArg = process.argv.find((a) => a.startsWith('--only='));
  const onlyNames = filterArg ? new Set(filterArg.slice('--only='.length).split(',')) : null;

  for (const t of TARGETS) {
    if (onlyNames && !onlyNames.has(t.name)) continue;
    const els = t.build();
    assertAcyclicDAG(els, t.name);
    assertUniqueApiActionNames(els, t.name);
    const errs = validateGraph(els);
    if (errs.length) throw new Error(`Validation failed for ${t.name}: ${errs.join(', ')}`);
    console.log(`[Offline OK] command "${t.name}": ${els.length} elements (DAG acyclic + schema valid)`);
    if (!dryRun) {
      const res = await deployViaCDP({
        groupId: PROFILE_GROUP_ID,
        mode: 'command',
        name: t.name,
        elements: els,
        enabled: true,
      });
      console.log(`[Deployed] /${t.name}:`, JSON.stringify(res, null, 2));
      if (!res?.ok) throw new Error(`Failed deploying /${t.name}`);
      await new Promise((r) => setTimeout(r, 1200));
    }
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
