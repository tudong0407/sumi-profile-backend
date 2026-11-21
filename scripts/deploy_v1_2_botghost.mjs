import WebSocket from 'ws';
globalThis.WebSocket = WebSocket;

import {
  GraphBuilder,
  attachUpdateAckBranch,
  cdpEval,
  deployViaCDP,
  ensureBuilderMounted,
  validateGraph,
} from './ga_builder_lib.mjs';
import { em, emId } from '../src/config/emojiHelper.js';

const PROFILE_GROUP_ID = '1782127263978';
const BACKEND_BASE = 'https://sumi-profile-backend.onrender.com';

class V12GraphBuilder extends GraphBuilder {
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
// 1. /info <ma_id> — Tra cứu trực tiếp (UNGATED + ^https:// guard cho image_url)
// ============================================================================
export function buildInfoCmd() {
  const gb = new V12GraphBuilder();
  gb.rootSlash('info', 'Tra cứu trực tiếp Linh Thú, Pháp Bảo, Role, Vật Phẩm theo Mã UID, Emoji hoặc Tên', { ephemeral: false });
  gb.errorHandlerWait();
  gb.option('ma_id', 'string', 'Mã UID, Emoji hoặc tên (vd: weapon_epic_4, bach_kim_ho_tu, enchant_stone, role_id)', { required: true, x: 420, y: 0 });

  embedMsg(gb, 'info_ack', {
    title: `${em('su_wiki_scroll')} Đang tra cứu Bách Khoa Tu Tiên...`,
    description: 'Đang tìm thông số, HAX và nguồn gốc của `{option_ma_id}`...',
    color: '#38bdf8',
    editId: 'info_ack',
  }, { x: 0, y: 220 });
  gb.link('root', 'info_ack');

  apiAction(
    gb,
    'info_api',
    'info_res',
    'GET',
    `${BACKEND_BASE}/api/info/{encode_text[{option_ma_id}]}?requesterId={user_id}`,
    '',
    { x: 0, y: 400 },
  );
  gb.link('info_ack', 'info_api');

  const cHasImg = gb.cmp('info_has_img', '{info_res.response.image_url}', '^https://', 'matches_pattern', {}, { x: 0, y: 580 });
  gb.link('info_api', cHasImg.condId);

  embedMsg(gb, 'info_edit_img', {
    title: '{info_res.response.title}',
    description: '{info_res.response.description}',
    color: '#ec4899',
    imageUrl: '{info_res.response.image_url}',
    footer: '{info_res.response.footer}',
    target: { editId: 'info_ack' },
    action_id: 'info_ack',
  }, { x: -180, y: 780 });
  gb.link(cHasImg.yes, 'info_edit_img');

  embedMsg(gb, 'info_edit_noimg', {
    title: '{info_res.response.title}',
    description: '{info_res.response.description}',
    color: '#ec4899',
    imageUrl: '',
    footer: '{info_res.response.footer}',
    target: { editId: 'info_ack' },
    action_id: 'info_ack',
  }, { x: 180, y: 780 });
  gb.link(cHasImg.no, 'info_edit_noimg');

  return gb.elements();
}

// ============================================================================
// 2. /phapbao [o_trang_bi] [sap_xep] — Kho Pháp Bảo đầy đủ + Dropdown Lọc (GATED)
// ============================================================================
export function buildPhapBaoCmd() {
  const gb = new V12GraphBuilder();
  gb.rootSlash('phapbao', 'Xem toàn bộ Pháp Bảo sở hữu (Vũ Khí, Bảo Ngọc, Chiến Hồn) + lọc phẩm chất/ô trang bị', { ephemeral: false });
  gb.errorHandlerWait();
  gb.option('o_trang_bi', 'string', 'Lọc theo ô trang bị (mặc định: all)', {
    required: false,
    choices: ['all', 'weapon', 'gem', 'soul'],
    x: 420,
    y: 0,
  });
  gb.option('sap_xep', 'string', 'Sắp xếp (mặc định: phẩm cao -> thấp)', {
    required: false,
    choices: ['rarity_desc', 'rarity_asc', 'power_desc', 'slot'],
    x: 700,
    y: 0,
  });

  embedMsg(gb, 'pb_ack', {
    title: `${em('su_crossed_swords')} Đang mở Kho Pháp Bảo...`,
    description: 'Đang kiểm kê toàn bộ Vũ Khí, Bảo Ngọc và Chiến Hồn của {user_displayName}...',
    color: '#f59e0b',
    editId: 'pb_ack',
  }, { x: 0, y: 220 });
  gb.link('root', 'pb_ack');

  apiAction(
    gb,
    'pb_api',
    'pb_res',
    'GET',
    `${BACKEND_BASE}/api/equipment/{user_id}?slot={option_o_trang_bi}&sort={option_sap_xep}&username={encode_text[{user_displayName}]}&avatar={encode_text[{user_icon}]}`,
    '',
    { x: 0, y: 400 },
  );
  gb.link('pb_ack', 'pb_api');

  const pbNoAck = attachUpdateAckBranch(gb, 'pb', 'pb_api', 'pb_res', { editId: 'pb_ack', x: 0, y: 580 });

  embedMsg(gb, 'pb_edit', {
    title: `${em('su_crossed_swords')} KHO PHÁP BẢO CỦA {pb_res.response.user.username}`,
    description: '{pb_res.response.filter_summary}\n\n{pb_res.response.summary_equipment}',
    color: '#f59e0b',
    footer: 'SuMi Family • Kho Pháp Bảo Tu Tiên (/enchant khắc ấn • /dismantle xóa nhanh)',
    target: { editId: 'pb_ack' },
    action_id: 'pb_ack',
  }, { x: 240, y: 780 });
  gb.link(pbNoAck, 'pb_edit');

  gb.advSelectMenu('sel_pb_filter', 'pb_edit', {
    placeholder: 'Lọc / Sắp xếp Pháp Bảo (Cao -> Thấp / Theo Ô)',
    customVariableName: 'picked_pb_filter',
    row: '1',
    weight: '1',
    showReplies: 'show',
    basic_options: [
      { label: 'Phẩm Cao → Thấp (Mặc định)', description: 'Thần Thoại → Tiên → Linh → Phàm', emoji_id: emId('su_tier_mythic'), value: 'rarity_desc' },
      { label: 'Phẩm Thấp → Cao', description: 'Phàm → Linh → Tiên → Thần Thoại', emoji_id: emId('su_tier_common'), value: 'rarity_asc' },
      { label: 'Chiến Lực Cao → Thấp', description: 'Xếp theo điểm chỉ số cộng mạnh nhất', emoji_id: emId('su_stats_chart'), value: 'power_desc' },
      { label: 'Chỉ Hiện Vũ Khí', description: 'Lọc toàn bộ Vũ Khí đang có trong túi', emoji_id: emId('su_crossed_swords'), value: 'weapon' },
      { label: 'Chỉ Hiện Bảo Ngọc', description: 'Lọc toàn bộ Bảo Ngọc đang có trong túi', emoji_id: emId('su_gem_slot'), value: 'gem' },
      { label: 'Chỉ Hiện Chiến Hồn', description: 'Lọc toàn bộ Chiến Hồn đang có trong túi', emoji_id: emId('su_soul_slot'), value: 'soul' },
    ],
  }, { x: 240, y: 980 });

  apiAction(
    gb,
    'pb_filter_api',
    'pb_fres',
    'GET',
    `${BACKEND_BASE}/api/equipment/{user_id}?filter={picked_pb_filter}&username={encode_text[{user_displayName}]}&avatar={encode_text[{user_icon}]}`,
    '',
    { x: 240, y: 1180 },
  );
  gb.link('sel_pb_filter', 'pb_filter_api');

  const pbfNoAck = attachUpdateAckBranch(gb, 'pbf', 'pb_filter_api', 'pb_fres', { x: 240, y: 1360 });

  embedMsg(gb, 'pb_filter_msg', {
    title: `${em('su_crossed_swords')} KHO PHÁP BẢO CỦA {pb_fres.response.user.username}`,
    description: '{pb_fres.response.filter_summary}\n\n{pb_fres.response.summary_equipment}',
    color: '#f59e0b',
    footer: 'SuMi Family • Kho Pháp Bảo Tu Tiên',
  }, { x: 480, y: 1560 });
  gb.link(pbfNoAck, 'pb_filter_msg');

  return gb.elements();
}

// ============================================================================
// 3. /roles [loc] [sap_xep] — Kho Role Quyền Năng Đầy Đủ + Dropdown Lọc (GATED)
// ============================================================================
export function buildRolesCmd() {
  const gb = new V12GraphBuilder();
  gb.rootSlash('roles', 'Xem toàn bộ Role Quyền Năng sở hữu (không rút gọn) + lọc trạng thái đeo/vĩnh viễn/tạm thời', { ephemeral: false });
  gb.errorHandlerWait();
  gb.option('loc', 'string', 'Lọc Role theo trạng thái (mặc định: all)', {
    required: false,
    choices: ['all', 'equipped', 'unequipped', 'permanent', 'timed'],
    x: 420,
    y: 0,
  });
  gb.option('sap_xep', 'string', 'Sắp xếp Role (mặc định: ưu tiên đang đeo)', {
    required: false,
    choices: ['equipped_desc', 'rarity_desc', 'expiry_asc'],
    x: 700,
    y: 0,
  });

  embedMsg(gb, 'ro_ack', {
    title: `${em('su_medal_role')} Đang mở Kho Role Quyền Năng...`,
    description: 'Đang kiểm kê toàn bộ Role Quyền Năng và thời hạn của {user_displayName}...',
    color: '#a855f7',
    editId: 'ro_ack',
  }, { x: 0, y: 220 });
  gb.link('root', 'ro_ack');

  apiAction(
    gb,
    'ro_api',
    'ro_res',
    'GET',
    `${BACKEND_BASE}/api/roles/{user_id}?filter={option_loc}&sort={option_sap_xep}&username={encode_text[{user_displayName}]}&avatar={encode_text[{user_icon}]}`,
    '',
    { x: 0, y: 400 },
  );
  gb.link('ro_ack', 'ro_api');

  const roNoAck = attachUpdateAckBranch(gb, 'ro', 'ro_api', 'ro_res', { editId: 'ro_ack', x: 0, y: 580 });

  embedMsg(gb, 'ro_edit', {
    title: `${em('su_medal_role')} KHO ROLE QUYỀN NĂNG CỦA {ro_res.response.user.username}`,
    description: '{ro_res.response.filter_summary}\n\n{ro_res.response.summary}',
    color: '#a855f7',
    footer: 'SuMi Family • Kho Role Quyền Năng (/equip role • /dismantle role)',
    target: { editId: 'ro_ack' },
    action_id: 'ro_ack',
  }, { x: 240, y: 780 });
  gb.link(roNoAck, 'ro_edit');

  gb.advSelectMenu('sel_ro_filter', 'ro_edit', {
    placeholder: 'Lọc / Sắp xếp Role Quyền Năng...',
    customVariableName: 'picked_role_filter',
    row: '1',
    weight: '1',
    showReplies: 'show',
    basic_options: [
      { label: 'Tất Cả Role (Mặc định)', description: 'Hiện toàn bộ Role đang sở hữu', emoji_id: emId('su_medal_role'), value: 'all' },
      { label: 'Đang Trang Bị (Equipped)', description: 'Chỉ hiện các Role đang gắn vào Slot hiệu lực', emoji_id: emId('su_sparkle'), value: 'equipped' },
      { label: 'Chưa Trang Bị (Unequipped)', description: 'Các Role đang cất trong kho dự trữ', emoji_id: emId('su_wiki_scroll'), value: 'unequipped' },
      { label: 'Role Vĩnh Viễn', description: 'Lọc các Role sở hữu Vĩnh Viễn', emoji_id: emId('su_tier_mythic'), value: 'permanent' },
      { label: 'Role Có Thời Hạn (7d/30d)', description: 'Lọc các Role thuê theo ngày', emoji_id: emId('su_tier_rare'), value: 'timed' },
      { label: 'Sắp Xếp: Phẩm Cao → Thấp', description: 'Thần Thoại → Tiên → Linh → Phàm', emoji_id: emId('su_winner_trophy'), value: 'rarity_desc' },
      { label: 'Sắp Xếp: Sắp Hết Hạn Trước', description: 'Ưu tiên Role còn ít thời gian nhất lên đầu', emoji_id: emId('su_level_up'), value: 'expiry_asc' },
    ],
  }, { x: 240, y: 980 });

  apiAction(
    gb,
    'ro_filter_api',
    'ro_fres',
    'GET',
    `${BACKEND_BASE}/api/roles/{user_id}?filter={picked_role_filter}&sort={picked_role_filter}&username={encode_text[{user_displayName}]}&avatar={encode_text[{user_icon}]}`,
    '',
    { x: 240, y: 1180 },
  );
  gb.link('sel_ro_filter', 'ro_filter_api');

  const rofNoAck = attachUpdateAckBranch(gb, 'rof', 'ro_filter_api', 'ro_fres', { x: 240, y: 1360 });

  embedMsg(gb, 'ro_filter_msg', {
    title: `${em('su_medal_role')} KHO ROLE QUYỀN NĂNG CỦA {ro_fres.response.user.username}`,
    description: '{ro_fres.response.filter_summary}\n\n{ro_fres.response.summary}',
    color: '#a855f7',
    footer: 'SuMi Family • Kho Role Quyền Năng',
  }, { x: 480, y: 1560 });
  gb.link(rofNoAck, 'ro_filter_msg');

  return gb.elements();
}

// ============================================================================
// 4. /updates — Nhật ký cập nhật 0-arg + Row-1 Dropdown chọn v1.2 / v1.1 (UNGATED)
// ============================================================================
export function buildUpdatesCmd() {
  const gb = new V12GraphBuilder();
  gb.rootSlash('updates', 'Xem bản cập nhật mới nhất (v1.2) và chọn xem lại lịch sử các phiên bản cũ qua menu', { ephemeral: false });
  gb.errorHandlerWait();

  apiAction(
    gb,
    'upds_api',
    'upds_res',
    'GET',
    `${BACKEND_BASE}/api/update`,
    '',
    { x: 0, y: 240 },
  );
  gb.link('root', 'upds_api');

  embedMsg(gb, 'upds_msg', {
    title: '{upds_res.response.title}',
    description: '{upds_res.response.description}',
    color: '#ec4899',
    footer: '{upds_res.response.footer}',
  }, { x: 0, y: 440 });
  gb.link('upds_api', 'upds_msg');

  gb.advSelectMenu('sel_upds_ver', 'upds_msg', {
    placeholder: 'Chọn phiên bản cập nhật để xem chi tiết (v1.2 / v1.1)...',
    customVariableName: 'picked_upd_ver',
    row: '1',
    weight: '1',
    showReplies: 'show',
    basic_options: [
      { label: 'Phiên bản v1.2 (Mới nhất)', description: 'Khắc Ấn D→S, 6 Việc Làm /job, Tháp 200 Tầng, Khế Ước Tuần, Túi Đồ /inv mới', emoji_id: emId('su_enchant_stone'), value: '1.2' },
      { label: 'Phiên bản v1.1', description: 'Mở rộng Gacha, /info, /phapbao, Thẻ Reset Tháp & cân bằng', emoji_id: emId('su_wiki_scroll'), value: '1.1' },
    ],
  }, { x: 0, y: 640 });

  apiAction(
    gb,
    'upds_ver_api',
    'upds_vres',
    'GET',
    `${BACKEND_BASE}/api/update/{picked_upd_ver}`,
    '',
    { x: 0, y: 840 },
  );
  gb.link('sel_upds_ver', 'upds_ver_api');

  embedMsg(gb, 'upds_ver_msg', {
    title: '{upds_vres.response.title}',
    description: '{upds_vres.response.description}',
    color: '#ec4899',
    footer: '{upds_vres.response.footer}',
  }, { x: 0, y: 1040 });
  gb.link('upds_ver_api', 'upds_ver_msg');

  return gb.elements();
}

// ============================================================================
// 5. /enchant <loai> <muc_tieu> — Khắc Ấn Linh Thú & Pháp Bảo D -> S (GATED)
// ============================================================================
export function buildEnchantCmd() {
  const gb = new V12GraphBuilder();
  gb.rootSlash('enchant', 'Khắc Ấn Linh Thú hoặc Pháp Bảo từ bậc D → C → B → A → S (tăng +0% đến +25% toàn chỉ số)', { ephemeral: false });
  gb.errorHandlerWait();
  gb.option('loai', 'string', 'Chọn loại mục tiêu muốn Khắc Ấn', {
    required: true,
    choices: ['pet', 'item'],
    x: 420,
    y: 0,
  });
  gb.option('muc_tieu', 'string', 'Mã ID, Emoji hoặc tên Linh Thú / Pháp Bảo (vd: active, weapon, hoa_thach_nham_nham)', {
    required: true,
    x: 700,
    y: 0,
  });

  embedMsg(gb, 'enc_ack', {
    title: `${em('su_enchant_stone')} Đang vận chuyển Đá Khắc Ấn...`,
    description: 'Đang khắc ấn `{option_muc_tieu}` ({option_loai})...',
    color: '#a855f7',
    editId: 'enc_ack',
  }, { x: 0, y: 220 });
  gb.link('root', 'enc_ack');

  apiAction(
    gb,
    'enc_api',
    'enc_res',
    'POST',
    `${BACKEND_BASE}/api/enchant`,
    '{"userId":"{user_id}","username":"{user_displayName}","avatarUrl":"{user_icon}","targetType":"{option_loai}","targetId":"{option_muc_tieu}"}',
    { x: 0, y: 400 },
  );
  gb.link('enc_ack', 'enc_api');

  const encNoAck = attachUpdateAckBranch(gb, 'enc', 'enc_api', 'enc_res', { editId: 'enc_ack', x: 0, y: 580 });

  embedMsg(gb, 'enc_edit', {
    title: `${em('su_enchant_stone')} LÒ KHẮC ẤN TIÊN GIỚI (D → S)`,
    description: '{enc_res.response.message}',
    color: '#a855f7',
    target: { editId: 'enc_ack' },
    action_id: 'enc_ack',
    footer: 'SuMi Family • Bậc S cần Đá Khắc Ấn + Linh Thạch (Bảo hiểm Pity +5%/lần trượt, Bậc A→S không tụt bậc)',
  }, { x: 240, y: 780 });
  gb.link(encNoAck, 'enc_edit');

  return gb.elements();
}

// ============================================================================
// 6. /job [nghe] — Bảng Công Việc Tông Môn (6 nghề, tối đa 4 ca/ngày, GATED)
// ============================================================================
export function buildJobCmd() {
  const gb = new V12GraphBuilder();
  gb.rootSlash('job', 'Làm việc vặt Tông Môn kiếm Linh Thạch & EXP (6 nghề • tối đa 4 ca/ngày • chọn trực tiếp hoặc qua menu)', { ephemeral: false });
  gb.errorHandlerWait();
  gb.option('nghe', 'string', 'Chọn nghề làm ngay (bỏ trống để xem bảng việc làm & cooldown)', {
    required: false,
    choices: ['quet_san', 'rua_bat', 'tuoi_cay', 'giao_trasua', 'cau_ca', 'tuan_tra'],
    x: 420,
    y: 0,
  });

  const cHasJob = gb.cmp('job_has_arg', '{option_nghe}', '^(quet_san|rua_bat|tuoi_cay|giao_trasua|cau_ca|tuan_tra)$', 'matches_pattern', {}, { x: 0, y: 220 });
  gb.link('root', cHasJob.condId);

  // Branch A: Execute job immediately when option_nghe is provided
  embedMsg(gb, 'job_work_ack', {
    title: `${em('su_linhthach')} Đang nhận ca làm việc Tông Môn...`,
    description: 'Đang thực hiện công việc `{option_nghe}`...',
    color: '#10b981',
    editId: 'job_work_ack',
  }, { x: -320, y: 420 });
  gb.link(cHasJob.yes, 'job_work_ack');

  apiAction(
    gb,
    'job_work_api',
    'job_wres',
    'POST',
    `${BACKEND_BASE}/api/job/work`,
    '{"userId":"{user_id}","username":"{user_displayName}","avatarUrl":"{user_icon}","jobId":"{option_nghe}"}',
    { x: -320, y: 600 },
  );
  gb.link('job_work_ack', 'job_work_api');

  const jwNoAck = attachUpdateAckBranch(gb, 'jw', 'job_work_api', 'job_wres', { editId: 'job_work_ack', x: -320, y: 780 });

  embedMsg(gb, 'job_work_edit', {
    title: `${em('su_linhthach')} HOÀN THÀNH CÔNG VIỆC TÔNG MÔN`,
    description: '{job_wres.response.message}',
    color: '#10b981',
    target: { editId: 'job_work_ack' },
    action_id: 'job_work_ack',
    footer: 'SuMi Family • Làm tối đa 4 ca/ngày (Reset 00:00 UTC+7)',
  }, { x: -160, y: 980 });
  gb.link(jwNoAck, 'job_work_edit');

  // Branch B: Show Job Status Board + Row-1 Select Menu
  embedMsg(gb, 'job_stat_ack', {
    title: `${em('su_wiki_scroll')} Đang mở Bảng Việc Làm Tông Môn...`,
    description: 'Đang kiểm tra số ca làm trong ngày và thời gian nghỉ của từng việc...',
    color: '#38bdf8',
    editId: 'job_stat_ack',
  }, { x: 320, y: 420 });
  gb.link(cHasJob.no, 'job_stat_ack');

  apiAction(
    gb,
    'job_stat_api',
    'job_sres',
    'GET',
    `${BACKEND_BASE}/api/job/status/{user_id}?username={encode_text[{user_displayName}]}&avatar={encode_text[{user_icon}]}`,
    '',
    { x: 320, y: 600 },
  );
  gb.link('job_stat_ack', 'job_stat_api');

  const jsNoAck = attachUpdateAckBranch(gb, 'js', 'job_stat_api', 'job_sres', { editId: 'job_stat_ack', x: 320, y: 780 });

  embedMsg(gb, 'job_stat_edit', {
    title: `${em('su_linhthach')} BẢNG CÔNG VIỆC TÔNG MÔN (4 CA/NGÀY)`,
    description: '{job_sres.response.message}',
    color: '#38bdf8',
    target: { editId: 'job_stat_ack' },
    action_id: 'job_stat_ack',
    footer: 'SuMi Family • Chọn ngay 1 công việc từ menu bên dưới để bắt đầu làm!',
  }, { x: 480, y: 980 });
  gb.link(jsNoAck, 'job_stat_edit');

  gb.advSelectMenu('sel_job_pick', 'job_stat_edit', {
    placeholder: 'Chọn Công Việc Tông Môn muốn làm ngay...',
    customVariableName: 'picked_job_id',
    row: '1',
    weight: '1',
    showReplies: 'show',
    basic_options: [
      { label: 'Quét Dọn Sân Tông Môn', description: '20–30 LT + 80 EXP • Cooldown 30 phút', emoji_id: emId('su_sparkle'), value: 'quet_san' },
      { label: 'Rửa Bát Tiên Trù', description: '25–35 LT + 100 EXP • Cooldown 45 phút', emoji_id: emId('su_linhthach'), value: 'rua_bat' },
      { label: 'Tưới Cây Linh Dược Viên', description: '30–40 LT + 120 EXP • Cooldown 60 phút', emoji_id: emId('su_elem_moc'), value: 'tuoi_cay' },
      { label: 'Ship Trà Sữa Tiên Giới', description: '35–50 LT + 150 EXP • Cooldown 90 phút', emoji_id: emId('su_elem_thuy'), value: 'giao_trasua' },
      { label: 'Câu Cá Hồ Linh Tuyền', description: '40–60 LT + 180 EXP • Cooldown 2 giờ', emoji_id: emId('su_pet_paw'), value: 'cau_ca' },
      { label: 'Tuần Tra Sơn Môn', description: '50–75 LT + 220 EXP • Cooldown 3 giờ', emoji_id: emId('su_crossed_swords'), value: 'tuan_tra' },
    ],
  }, { x: 480, y: 1180 });

  apiAction(
    gb,
    'job_pick_api',
    'job_pres',
    'POST',
    `${BACKEND_BASE}/api/job/work`,
    '{"userId":"{user_id}","username":"{user_displayName}","avatarUrl":"{user_icon}","jobId":"{picked_job_id}"}',
    { x: 480, y: 1360 },
  );
  gb.link('sel_job_pick', 'job_pick_api');

  const jpNoAck = attachUpdateAckBranch(gb, 'jp', 'job_pick_api', 'job_pres', { x: 480, y: 1540 });

  embedMsg(gb, 'job_pick_msg', {
    title: `${em('su_linhthach')} HOÀN THÀNH CÔNG VIỆC TÔNG MÔN`,
    description: '{job_pres.response.message}',
    color: '#10b981',
    footer: 'SuMi Family • Làm tối đa 4 ca/ngày (Reset 00:00 UTC+7)',
  }, { x: 700, y: 1740 });
  gb.link(jpNoAck, 'job_pick_msg');

  return gb.elements();
}

const TARGETS = [
  { name: 'info', build: buildInfoCmd },
  { name: 'phapbao', build: buildPhapBaoCmd },
  { name: 'roles', build: buildRolesCmd },
  { name: 'updates', build: buildUpdatesCmd },
  { name: 'enchant', build: buildEnchantCmd },
  { name: 'job', build: buildJobCmd },
];

async function disableLegacyUpdateCommand() {
  await ensureBuilderMounted();
  const res = await cdpEval(`(async () => {
    const root = document.getElementById('root');
    const rKey = Object.keys(root).find(k => k.startsWith('__reactContainer$'));
    let f = root[rKey];
    let store = null, cb = null;
    const seen = new Set();
    const walk = (n) => {
      if (!n || seen.has(n)) return;
      seen.add(n);
      if (n.memoizedProps?.store?.getState) store = n.memoizedProps.store;
      if (n.stateNode?.validateSave && n.stateNode?.buildCommand) cb = n.stateNode;
      if (n.child) walk(n.child);
      if (n.sibling) walk(n.sibling);
    };
    walk(f);
    if (!store || !cb) return JSON.stringify({ ok: false, error: 'Missing store or cb' });
    const st = store.getState();
    const list = st.data.bot.commands.slash.commands;
    const legacy = list.find(c => c.name === 'update');
    if (!legacy) return JSON.stringify({ ok: true, status: 'not_found' });
    const wasEnabled = legacy.enabled;
    legacy.enabled = false;
    const beforeSave = st.data.bot.last_save;
    await cb.save();
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 300));
      const cur = store.getState();
      if (cur.data.bot.last_save !== beforeSave && cur.builder.builderSaveRequired === false) break;
    }
    const afterSt = store.getState();
    return JSON.stringify({
      ok: true,
      wasEnabled,
      nowEnabled: legacy.enabled,
      builderSaveRequired: afterSt.builder.builderSaveRequired,
      totalSlash: list.length,
      enabledSlash: list.filter(c => c.enabled !== false).length
    });
  })()`);
  return JSON.parse(res);
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
    console.log(`[Offline OK] command "${t.name}": ${els.length} elements (DAG acyclic + unique api_action + schema valid)`);
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

  if (!dryRun && (!onlyNames || onlyNames.has('updates'))) {
    const disRes = await disableLegacyUpdateCommand();
    console.log('[Legacy /update disabled]:', JSON.stringify(disRes));
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
