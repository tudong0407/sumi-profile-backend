import WebSocket from 'ws';
globalThis.WebSocket = WebSocket;

import {
  GraphBuilder,
  deployViaCDP,
  validateGraph,
} from './ga_builder_lib.mjs';
import { em } from '../src/config/emojiHelper.js';

const PROFILE_GROUP_ID = '1782127263978';
const BACKEND_BASE = 'https://sumi-profile-backend.onrender.com';

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
// 1. /top — Bảng Xếp Hạng Server (level / power / wealth / marry)
// ============================================================================
export function buildTopCmd() {
  const gb = new GraphBuilder();
  gb.rootSlash('top', 'Xem Bảng Xếp Hạng Tu Tiên Giới SuMi Family (Cấp, Chiến Lực, Linh Thạch, Tiên Lữ)', { ephemeral: false });
  gb.errorHandlerWait();
  gb.option('bang_xep_hang', 'string', 'Chọn bảng xếp hạng muốn xem', {
    required: true,
    choices: ['level', 'power', 'wealth', 'marry'],
    x: 420,
    y: 0,
  });

  embedMsg(gb, 'top_ack', {
    title: `${em('su_winner_trophy')} Đang tổng hợp Thiên Bảng...`,
    description: 'Đang truy vấn Bảng Xếp Hạng `{option_bang_xep_hang}` toàn server...',
    color: '#38bdf8',
    editId: 'top_ack',
  }, { x: 0, y: 220 });
  gb.link('root', 'top_ack');

  apiAction(
    gb,
    'top_api',
    'top_res',
    'GET',
    `${BACKEND_BASE}/api/leaderboard?type={option_bang_xep_hang}&limit=10`,
    '',
    { x: 0, y: 400 },
  );
  gb.link('top_ack', 'top_api');

  embedMsg(gb, 'top_edit', {
    title: '{top_res.response.title}',
    description: '{top_res.response.summary_leaderboard}',
    color: '#f59e0b',
    target: { editId: 'top_ack' },
    action_id: 'top_ack',
    footer: 'SuMi Family • Thiên Bảng Danh Dự',
  }, { x: 0, y: 580 });
  gb.link('top_api', 'top_edit');

  return gb.elements();
}

// ============================================================================
// 2. /nhiemvu — 3 Nhiệm Vụ Ngày + Tháp Thí Luyện 100 Tầng PvE
// ============================================================================
export function buildNhiemVuCmd() {
  const gb = new GraphBuilder();
  gb.rootSlash('nhiemvu', 'Nhiệm Vụ Ngày (3/3 nhận thưởng) & Tháp Thí Luyện 100 Tầng PvE', { ephemeral: false });
  gb.errorHandlerWait();
  gb.option('hanh_dong', 'string', 'Chọn hành động', {
    required: true,
    choices: ['status', 'claim', 'tower'],
    x: 420,
    y: 0,
  });

  gb.cond('nv_mode', 'comparison', { base_value: '{option_hanh_dong}', target: { self: true } }, { x: 0, y: 220 });
  gb.link('root', 'nv_mode');

  const bClaim = gb.branch('nv_mode', 'nv_claim', 'comparison', { type: 'equal_to', comparison_value: 'claim', ignoreCase: true, option: '', not: false }, { x: -350, y: 400 });
  const bTower = gb.branch('nv_mode', 'nv_tower', 'comparison', { type: 'equal_to', comparison_value: 'tower', ignoreCase: true, option: '', not: false }, { x: 0, y: 400 });
  const bStat = gb.elseBranch('nv_mode', 'nv_stat', 'comparison', { x: 350, y: 400 });

  // Claim 3/3 Daily Quests
  embedMsg(gb, 'nv_claim_ack', {
    title: `${em('su_sparkle')} Đang kiểm tra tiến độ Nhiệm Vụ Ngày...`,
    description: 'Đang xác nhận điều kiện hoàn tất 3/3 nhiệm vụ...',
    color: '#10b981',
    editId: 'nv_claim_ack',
  }, { x: -350, y: 600 });
  gb.link(bClaim, 'nv_claim_ack');

  apiAction(
    gb,
    'nv_claim_api',
    'nv_claim_res',
    'POST',
    `${BACKEND_BASE}/api/quest/claim`,
    '{"userId":"{user_id}","username":"{user_displayName}","avatarUrl":"{user_icon}"}',
    { x: -350, y: 780 },
  );
  gb.link('nv_claim_ack', 'nv_claim_api');

  embedMsg(gb, 'nv_claim_edit', {
    title: `${em('su_winner_trophy')} NHẬN THƯỞNG NHIỆM VỤ NGÀY`,
    description: '{nv_claim_res.response.message}',
    color: '#10b981',
    target: { editId: 'nv_claim_ack' },
    action_id: 'nv_claim_ack',
  }, { x: -350, y: 960 });
  gb.link('nv_claim_api', 'nv_claim_edit');

  // Tower PvE Challenge
  embedMsg(gb, 'nv_tower_ack', {
    title: `${em('su_arena')} Đang tiến vào Tháp Thí Luyện...`,
    description: 'Linh Thú của {user_displayName} đang đối đầu Thủ Vệ Tháp!',
    color: '#f43f5e',
    editId: 'nv_tower_ack',
  }, { x: 0, y: 600 });
  gb.link(bTower, 'nv_tower_ack');

  apiAction(
    gb,
    'nv_tower_api',
    'nv_tower_res',
    'POST',
    `${BACKEND_BASE}/api/quest/tower`,
    '{"userId":"{user_id}","username":"{user_displayName}","avatarUrl":"{user_icon}"}',
    { x: 0, y: 780 },
  );
  gb.link('nv_tower_ack', 'nv_tower_api');

  embedMsg(gb, 'nv_tower_edit', {
    title: `${em('su_arena')} THÁP THÍ LUYỆN TIÊN GIỚI`,
    description: '{nv_tower_res.response.message}',
    color: '#f43f5e',
    imageUrl: '{nv_tower_res.response.image_url}',
    target: { editId: 'nv_tower_ack' },
    action_id: 'nv_tower_ack',
    footer: 'SuMi Family • Tối đa 5 lượt khiêu chiến mỗi ngày (UTC+7)',
  }, { x: 0, y: 960 });
  gb.link('nv_tower_api', 'nv_tower_edit');

  // Status
  embedMsg(gb, 'nv_stat_ack', {
    title: `${em('su_wiki_scroll')} Đang tải bảng Nhiệm Vụ & Tháp Thí Luyện...`,
    description: 'Đang đồng bộ dữ liệu ngày hôm nay...',
    color: '#38bdf8',
    editId: 'nv_stat_ack',
  }, { x: 350, y: 600 });
  gb.link(bStat, 'nv_stat_ack');

  apiAction(
    gb,
    'nv_stat_api',
    'nv_stat_res',
    'GET',
    `${BACKEND_BASE}/api/quest/status/{user_id}?username={encode_text[{user_displayName}]}&avatar={encode_text[{user_icon}]}`,
    '',
    { x: 350, y: 780 },
  );
  gb.link('nv_stat_ack', 'nv_stat_api');

  embedMsg(gb, 'nv_stat_edit', {
    title: `${em('su_wiki_scroll')} BẢNG NHIỆM VỤ & THÁP THÍ LUYỆN`,
    description: '{nv_stat_res.response.message}',
    color: '#38bdf8',
    target: { editId: 'nv_stat_ack' },
    action_id: 'nv_stat_ack',
    footer: 'SuMi Family • Reset 00:00 UTC+7 mỗi ngày',
  }, { x: 350, y: 960 });
  gb.link('nv_stat_api', 'nv_stat_edit');

  return gb.elements();
}

// ============================================================================
// 3. /tangqua — Tặng Linh Thạch (thuế 5%, max 5.000/ngày) / Vật Phẩm (max 5/ngày)
// ============================================================================
export function buildTangQuaCmd() {
  const gb = new GraphBuilder();
  gb.rootSlash('tangqua', 'Tặng Linh Thạch (+5.000/ngày mỗi 10 Cấp, thuế 5%) hoặc Vé Gacha/Đá Sao (5/ngày) — Từ Lv.10+', { ephemeral: false });
  gb.errorHandlerWait();
  gb.option('nguoi_nhan', 'user', 'Đạo hữu nhận quà', { required: true, x: 420, y: 0 });
  gb.option('loai_qua', 'string', 'Loại quà muốn tặng', {
    required: true,
    choices: ['linh_thach', 'gacha_ticket_equip', 'gacha_ticket_pet', 'pet_star_stone'],
    x: 700,
    y: 0,
  });
  gb.option('so_luong', 'int', 'Số lượng muốn tặng', { required: true, x: 980, y: 0 });

  embedMsg(gb, 'tq_ack', {
    title: `${em('su_linhthach')} Đang chuyển giao Lễ Vật Tiên Giới...`,
    description: 'Đang kiểm tra cấp độ, số dư và hạn mức hôm nay...',
    color: '#ec4899',
    editId: 'tq_ack',
  }, { x: 0, y: 220 });
  gb.link('root', 'tq_ack');

  apiAction(
    gb,
    'tq_api',
    'gift_res',
    'POST',
    `${BACKEND_BASE}/api/economy/gift`,
    '{"senderId":"{user_id}","senderName":"{user_displayName}","senderAvatar":"{user_icon}","receiverId":"{option_nguoi_nhan}","receiverName":"{user_displayName[option_nguoi_nhan]}","receiverAvatar":"{user_icon[option_nguoi_nhan]}","giftType":"{option_loai_qua}","amount":"{option_so_luong}"}',
    { x: 0, y: 400 },
  );
  gb.link('tq_ack', 'tq_api');

  embedMsg(gb, 'tq_edit', {
    title: `${em('su_sparkle')} TRAO TẶNG LỄ VẬT`,
    description: '{gift_res.response.message}',
    color: '#10b981',
    target: { editId: 'tq_ack' },
    action_id: 'tq_ack',
    footer: 'SuMi Family • Hạn mức +5.000 LT/ngày mỗi 10 Cấp (tối đa 50.000 ở Lv.100) & 5 Vật Phẩm/ngày',
  }, { x: 0, y: 580 });
  gb.link('tq_api', 'tq_edit');

  return gb.elements();
}

const TARGETS = [
  { name: 'top', build: buildTopCmd },
  { name: 'nhiemvu', build: buildNhiemVuCmd },
  { name: 'tangqua', build: buildTangQuaCmd },
];

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
