import WebSocket from 'ws';
globalThis.WebSocket = WebSocket;

import {
  GraphBuilder,
  deployViaCDP,
  validateGraph,
} from './ga_builder_lib.mjs';
import { em, emId } from '../src/config/emojiHelper.js';

const PROFILE_GROUP_ID = '1782127263978';
const BACKEND_BASE = 'https://sumi-profile-backend.onrender.com';

class V11GraphBuilder extends GraphBuilder {
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

// 1. /info <ma_id> — Tra cứu trực tiếp Linh Thú, Pháp Bảo, Role, Vật Phẩm, Nhẫn, Background
export function buildInfoCmd() {
  const gb = new V11GraphBuilder();
  gb.rootSlash('info', 'Tra cứu trực tiếp Linh Thú, Pháp Bảo, Role, Vật Phẩm theo Mã UID hoặc Tên', { ephemeral: false });
  gb.errorHandlerWait();
  gb.option('ma_id', 'string', 'Mã UID hoặc tên (vd: weapon_epic_4, bach_kim_ho_tu, tower_reset_card, role_id)', { required: true, x: 420, y: 0 });

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

  embedMsg(gb, 'info_edit', {
    title: '{info_res.response.title}',
    description: '{info_res.response.description}',
    color: '#ec4899',
    imageUrl: '{info_res.response.image_url}',
    footer: '{info_res.response.footer}',
    target: { editId: 'info_ack' },
    action_id: 'info_ack',
  }, { x: 0, y: 580 });
  gb.link('info_api', 'info_edit');

  return gb.elements();
}

// 2. /phapbao [o_trang_bi] [sap_xep] — Kho Pháp Bảo đầy đủ + Dropdown Lọc & Sắp xếp ở trên
export function buildPhapBaoCmd() {
  const gb = new V11GraphBuilder();
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

  embedMsg(gb, 'pb_edit', {
    title: '{pb_res.response.title}',
    description: '{pb_res.response.summary_equipment}',
    color: '#f59e0b',
    footer: 'SuMi Family • Kho Pháp Bảo Tu Tiên (/dismantle hỗ trợ xóa hàng loạt)',
    target: { editId: 'pb_ack' },
    action_id: 'pb_ack',
  }, { x: 0, y: 580 });
  gb.link('pb_api', 'pb_edit');

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
  }, { x: 0, y: 780 });

  apiAction(
    gb,
    'pb_filter_api',
    'pb_fres',
    'GET',
    `${BACKEND_BASE}/api/equipment/{user_id}?filter={picked_pb_filter}&username={encode_text[{user_displayName}]}&avatar={encode_text[{user_icon}]}`,
    '',
    { x: 0, y: 980 },
  );
  gb.link('sel_pb_filter', 'pb_filter_api');

  embedMsg(gb, 'pb_filter_msg', {
    title: '{pb_fres.response.title}',
    description: '{pb_fres.response.summary_equipment}',
    color: '#f59e0b',
    footer: 'SuMi Family • Kho Pháp Bảo Tu Tiên',
  }, { x: 0, y: 1180 });
  gb.link('pb_filter_api', 'pb_filter_msg');

  return gb.elements();
}

// 3. /update [phien_ban] — Nhật ký cập nhật hệ thống Tu Tiên Giới
export function buildUpdateCmd() {
  const gb = new V11GraphBuilder();
  gb.rootSlash('update', 'Xem tóm tắt tính năng mới và cân bằng theo từng phiên bản (v1.1, v1.0...)', { ephemeral: false });
  gb.errorHandlerWait();
  gb.option('phien_ban', 'string', 'Phiên bản muốn xem (mặc định mới nhất: 1.1)', {
    required: false,
    choices: ['1.1', '1.0'],
    x: 420,
    y: 0,
  });

  apiAction(
    gb,
    'upd_api',
    'upd_res',
    'GET',
    `${BACKEND_BASE}/api/update?version={encode_text[{option_phien_ban}]}`,
    '',
    { x: 0, y: 240 },
  );
  gb.link('root', 'upd_api');

  embedMsg(gb, 'upd_msg', {
    title: '{upd_res.response.title}',
    description: '{upd_res.response.description}',
    color: '#ec4899',
    footer: '{upd_res.response.footer}',
  }, { x: 0, y: 440 });
  gb.link('upd_api', 'upd_msg');

  return gb.elements();
}

const TARGETS = [
  { name: 'info', build: buildInfoCmd },
  { name: 'phapbao', build: buildPhapBaoCmd },
  { name: 'update', build: buildUpdateCmd },
];

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const filterArg = process.argv.find((a) => a.startsWith('--only='));
  const onlyNames = filterArg ? new Set(filterArg.slice('--only='.length).split(',')) : null;

  for (const t of TARGETS) {
    if (onlyNames && !onlyNames.has(t.name)) continue;
    const els = t.build();
    const errs = validateGraph(els);
    if (errs.length) throw new Error(`Validation failed for ${t.name}: ${errs.join(', ')}`);
    console.log(`[Offline OK] command "${t.name}": ${els.length} elements`);
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
