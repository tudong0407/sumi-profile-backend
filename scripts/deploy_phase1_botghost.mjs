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

function embedMsg(gb, id, { title, description = '', color = '#ec4899', footer = 'SuMi Family • Tu Tiên Giới', target = { reply: true }, editId = undefined, action_id = undefined }, pos = { x: 0, y: 0 }) {
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
        image: { url: '' },
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

export function buildDailyCmd() {
  const gb = new GraphBuilder();
  gb.rootSlash('daily', 'Điểm danh tu tiên hàng ngày nhận 40–60 Linh Thạch + Streak 7 ngày', { ephemeral: false });
  gb.errorHandlerWait();

  embedMsg(gb, 'd_ack', {
    title: `${em('su_linhthach')} Đang điểm danh Tiên Giới...`,
    description: 'Đang kết nối Linh Mạch SuMi Family...',
    color: '#38bdf8',
    editId: 'd_ack',
  }, { x: 0, y: 220 });
  gb.link('root', 'd_ack');

  apiAction(
    gb,
    'd_api',
    'daily_res',
    'POST',
    `${BACKEND_BASE}/api/economy/daily`,
    '{"userId":"{user_id}","username":"{user_displayName}","avatarUrl":"{user_icon}"}',
    { x: 0, y: 400 },
  );
  gb.link('d_ack', 'd_api');

  embedMsg(gb, 'd_edit', {
    title: `${em('su_sparkle')} ĐIỂM DANH HÀNG NGÀY`,
    description: '{daily_res.response.message}',
    color: '#fbbf24',
    target: { editId: 'd_ack' },
    action_id: 'd_ack',
  }, { x: 0, y: 580 });
  gb.link('d_api', 'd_edit');
  return gb.elements();
}

export function buildDoiquaCmd() {
  const gb = new GraphBuilder();
  gb.rootSlash('doiqua', 'Phế Tu Vi Đổi Linh Bảo: 1.000 EXP -> 10 Linh Thạch (cho phép tụt cấp)', { ephemeral: false });
  gb.errorHandlerWait();
  gb.option('so_exp', 'int', 'Số EXP muốn phế (bội số của 1000, ví dụ: 1000, 2000)', { required: true, x: 420, y: 0 });

  embedMsg(gb, 'dq_ack', {
    title: `${em('su_level_up')} Đang luyện hóa Tu Vi thành Linh Thạch...`,
    description: 'Đang xử lý phế {option_so_exp} EXP...',
    color: '#a855f7',
    editId: 'dq_ack',
  }, { x: 0, y: 220 });
  gb.link('root', 'dq_ack');

  apiAction(
    gb,
    'dq_api',
    'dq_res',
    'POST',
    `${BACKEND_BASE}/api/economy/doiqua`,
    '{"userId":"{user_id}","username":"{user_displayName}","avatarUrl":"{user_icon}","amountExp":"{option_so_exp}"}',
    { x: 0, y: 400 },
  );
  gb.link('dq_ack', 'dq_api');

  embedMsg(gb, 'dq_edit', {
    title: `${em('su_linhthach')} PHẾ TU VI ĐỔI LINH BẢO`,
    description: '{dq_res.response.message}',
    color: '#ec4899',
    target: { editId: 'dq_ack' },
    action_id: 'dq_ack',
  }, { x: 0, y: 580 });
  gb.link('dq_api', 'dq_edit');

  gb.act('dq_wait', 'wait_action', { seconds: '1', success_handles: false }, { x: 0, y: 760 });
  gb.link('dq_edit', 'dq_wait');

  const cRevoke = gb.cmp('dq_has_revoke', '{dq_res.response.revoked_level_role_csv}', '^[0-9,]+$', 'matches_pattern', {}, { x: 0, y: 940 });
  gb.link('dq_wait', cRevoke.condId);

  gb.act('dq_rem_roles', 'role_remove', {
    roles: [],
    additional_roles: '{dq_res.response.revoked_level_role_csv}',
    success_handles: false,
    target: { variable: '{user_id}' },
    server_id: '',
  }, { x: -180, y: 1140 });
  gb.link(cRevoke.yes, 'dq_rem_roles');
  return gb.elements();
}

export function buildRollCmd() {
  const gb = new GraphBuilder();
  gb.rootSlash('roll', 'Quay Gacha Pháp Bảo hoặc Linh Thú (50 Linh Thạch/lượt • 450/10 lượt)', { ephemeral: false });
  gb.errorHandlerWait();
  gb.option('loai', 'string', 'Chọn bể quay Gacha', { required: true, choices: ['equipment', 'pet'], x: 420, y: 0 });
  gb.option('so_luot', 'string', 'Số lượt quay (1 hoặc 10)', { required: false, choices: ['1', '10'], x: 700, y: 0 });
  gb.option('dung_ve', 'boolean', 'Ưu tiên dùng Vé Gacha trong túi nếu có?', { required: false, x: 980, y: 0 });

  embedMsg(gb, 'rl_ack', {
    title: `${em('su_gacha_dice')} Đang khởi động Trận Pháp Triệu Hồi...`,
    description: 'Đang quay Gacha ({option_loai})...',
    color: '#ec4899',
    editId: 'rl_ack',
  }, { x: 0, y: 220 });
  gb.link('root', 'rl_ack');

  apiAction(
    gb,
    'rl_api',
    'roll_res',
    'POST',
    `${BACKEND_BASE}/api/economy/roll`,
    '{"userId":"{user_id}","username":"{user_displayName}","avatarUrl":"{user_icon}","pool":"{option_loai}","count":"{option_so_luot}","useTicket":"{option_dung_ve}"}',
    { x: 0, y: 400 },
  );
  gb.link('rl_ack', 'rl_api');

  embedMsg(gb, 'rl_edit', {
    title: `${em('su_sparkle')} KẾT QUẢ TRIỆU HỒI GACHA`,
    description: `${em('su_gacha_dice')} **Bể quay**: \`{option_loai}\` (\`{roll_res.response.count}\` lượt • Chi phí \`{roll_res.response.cost}\` ${em('su_linhthach')})\n${em('su_linhthach')} **Số dư còn lại**: \`{roll_res.response.linh_thach_fmt}\` Linh Thạch\n${em('su_star_stone')} **Hoàn trả trùng lặp**: \`+{roll_res.response.refund_linh_thach}\` Linh Thạch • \`+{roll_res.response.bonus_star_stones}\` Tinh Thạch Sao\n${em('su_sparkle')} **Kết quả**:\n{roll_res.response.summary_results}\n{roll_res.response.message}`,
    color: '#f59e0b',
    target: { editId: 'rl_ack' },
    action_id: 'rl_ack',
  }, { x: 0, y: 580 });
  gb.link('rl_api', 'rl_edit');
  return gb.elements();
}

export function buildInvCmd() {
  const gb = new GraphBuilder();
  gb.rootSlash('inv', 'Xem túi đồ tu tiên (Linh Thú, Pháp Bảo, Role Quyền Năng, Vật Phẩm & Background)', { ephemeral: false });
  gb.errorHandlerWait();

  embedMsg(gb, 'inv_ack', {
    title: `${em('su_sparkle')} Đang mở Túi Trữ Vật...`,
    description: 'Đang kiểm kê kho báu của {user_displayName}...',
    color: '#38bdf8',
    editId: 'inv_ack',
  }, { x: 0, y: 220 });
  gb.link('root', 'inv_ack');

  apiAction(
    gb,
    'inv_api',
    'inv_res',
    'GET',
    `${BACKEND_BASE}/api/inv/{user_id}?username={encode_text[{user_displayName}]}&avatar={encode_text[{user_icon}]}`,
    '',
    { x: 0, y: 400 },
  );
  gb.link('inv_ack', 'inv_api');

  embedMsg(gb, 'inv_edit', {
    title: `${em('su_sparkle')} TÚI TRỮ VẬT CỦA {inv_res.response.user.username}`,
    description: `${em('su_linhthach')} **Linh Thạch**: \`{inv_res.response.user.linh_thach_fmt}\` • ${em('su_frame_token')} **Nền hiện tại**: \`{inv_res.response.user.background_name}\`\n\n${em('su_pet_paw')} **Linh Thú sở hữu**:\n{inv_res.response.summary_pets}\n\n${em('su_crossed_swords')} **Pháp Bảo Loadout**:\n{inv_res.response.summary_items}\n\n${em('su_realm_star')} **Role Quyền Năng**:\n{inv_res.response.summary_roles}\n\n${em('su_star_stone')} **Vật Phẩm & Mở Khóa**:\n{inv_res.response.summary_consumables}`,
    color: '#a855f7',
    target: { editId: 'inv_ack' },
    action_id: 'inv_ack',
  }, { x: 0, y: 580 });
  gb.link('inv_api', 'inv_edit');
  return gb.elements();
}

export function buildEquipCmd() {
  const gb = new GraphBuilder();
  gb.rootSlash('equip', 'Trang bị Pháp Bảo, Role Quyền Năng, Ảnh Nền, Khung Viền hoặc Danh Hiệu', { ephemeral: false });
  gb.errorHandlerWait();
  gb.option('loai', 'string', 'Loại muốn trang bị', { required: true, choices: ['item', 'role', 'background', 'frame', 'title'], x: 420, y: 0 });
  gb.option('ma_id', 'string', 'Mã ID / Tên Danh Hiệu (vd: weapon_common_1, role_id, bg_pin_1_starry_cloud.jpg, jade_lotus)', { required: true, x: 700, y: 0 });

  embedMsg(gb, 'eq_ack', {
    title: `${em('su_crossed_swords')} Đang trang bị...`,
    description: 'Đang cập nhật `{option_ma_id}`...',
    color: '#3b82f6',
    editId: 'eq_ack',
  }, { x: 0, y: 220 });
  gb.link('root', 'eq_ack');

  apiAction(
    gb,
    'eq_api',
    'eq_res',
    'POST',
    `${BACKEND_BASE}/api/equip`,
    '{"userId":"{user_id}","category":"{option_loai}","targetId":"{option_ma_id}"}',
    { x: 0, y: 400 },
  );
  gb.link('eq_ack', 'eq_api');

  embedMsg(gb, 'eq_edit', {
    title: `${em('su_crossed_swords')} TRANG BỊ HỒ SƠ`,
    description: '{eq_res.response.message}',
    color: '#10b981',
    target: { editId: 'eq_ack' },
    action_id: 'eq_ack',
  }, { x: 0, y: 580 });
  gb.link('eq_api', 'eq_edit');

  gb.act('eq_wait', 'wait_action', { seconds: '1', success_handles: false }, { x: 0, y: 760 });
  gb.link('eq_edit', 'eq_wait');

  const cAddRole = gb.cmp('eq_has_role', '{eq_res.response.add_role_id}', '^[0-9]+$', 'matches_pattern', {}, { x: 0, y: 940 });
  gb.link('eq_wait', cAddRole.condId);

  gb.act('eq_add_role', 'role_add', {
    roles: [],
    additional_roles: '{eq_res.response.add_role_id}',
    success_handles: false,
    target: { variable: '{user_id}' },
    server_id: '',
  }, { x: -180, y: 1140 });
  gb.link(cAddRole.yes, 'eq_add_role');
  return gb.elements();
}

export function buildUnequipCmd() {
  const gb = new GraphBuilder();
  gb.rootSlash('unequip', 'Tháo Pháp Bảo, Role Quyền Năng, Ảnh Nền hoặc Khung Viền về mặc định', { ephemeral: false });
  gb.errorHandlerWait();
  gb.option('loai', 'string', 'Loại muốn tháo', { required: true, choices: ['item', 'role', 'background', 'frame'], x: 420, y: 0 });
  gb.option('ma_id', 'string', 'Mã ID hoặc tên slot (vd: weapon, role_id, default)', { required: true, x: 700, y: 0 });

  embedMsg(gb, 'uq_ack', {
    title: `${em('su_crossed_swords')} Đang tháo trang bị...`,
    description: 'Đang gỡ `{option_ma_id}`...',
    color: '#64748b',
    editId: 'uq_ack',
  }, { x: 0, y: 220 });
  gb.link('root', 'uq_ack');

  apiAction(
    gb,
    'uq_api',
    'uq_res',
    'POST',
    `${BACKEND_BASE}/api/unequip`,
    '{"userId":"{user_id}","category":"{option_loai}","targetId":"{option_ma_id}"}',
    { x: 0, y: 400 },
  );
  gb.link('uq_ack', 'uq_api');

  embedMsg(gb, 'uq_edit', {
    title: `${em('su_crossed_swords')} THÁO TRANG BỊ`,
    description: '{uq_res.response.message}',
    color: '#f43f5e',
    target: { editId: 'uq_ack' },
    action_id: 'uq_ack',
  }, { x: 0, y: 580 });
  gb.link('uq_api', 'uq_edit');

  gb.act('uq_wait', 'wait_action', { seconds: '1', success_handles: false }, { x: 0, y: 760 });
  gb.link('uq_edit', 'uq_wait');

  const cRemRole = gb.cmp('uq_has_role', '{uq_res.response.remove_role_id}', '^[0-9]+$', 'matches_pattern', {}, { x: 0, y: 940 });
  gb.link('uq_wait', cRemRole.condId);

  gb.act('uq_rem_role', 'role_remove', {
    roles: [],
    additional_roles: '{uq_res.response.remove_role_id}',
    success_handles: false,
    target: { variable: '{user_id}' },
    server_id: '',
  }, { x: -180, y: 1140 });
  gb.link(cRemRole.yes, 'uq_rem_role');
  return gb.elements();
}

export function buildPetCmd() {
  const gb = new GraphBuilder();
  gb.rootSlash('linhthu', 'Quản lý kho Linh Thú: xem danh sách, đổi Pet xuất trận, nâng cấp Lv & nâng Sao', { ephemeral: false });
  gb.errorHandlerWait();
  gb.option('hanh_dong', 'string', 'Chọn thao tác', { required: true, choices: ['list', 'active', 'upgrade_level', 'upgrade_star'], x: 420, y: 0 });
  gb.option('linh_thu', 'string', 'Mã hoặc tên Linh Thú (vd: hoa_thach_nham_nham)', { required: false, x: 700, y: 0 });

  gb.cond('pet_mode', 'comparison', { base_value: '{option_hanh_dong}', target: { self: true } }, { x: 0, y: 220 });
  gb.link('root', 'pet_mode');

  const bActive = gb.branch('pet_mode', 'pm_active', 'comparison', { type: 'equal_to', comparison_value: 'active', ignoreCase: true, option: '', not: false }, { x: -300, y: 400 });
  const bUpLvl = gb.branch('pet_mode', 'pm_uplvl', 'comparison', { type: 'equal_to', comparison_value: 'upgrade_level', ignoreCase: true, option: '', not: false }, { x: 0, y: 400 });
  const bUpStar = gb.branch('pet_mode', 'pm_upstar', 'comparison', { type: 'equal_to', comparison_value: 'upgrade_star', ignoreCase: true, option: '', not: false }, { x: 300, y: 400 });
  const bList = gb.elseBranch('pet_mode', 'pm_list', 'comparison', { x: 600, y: 400 });

  // Active
  apiAction(gb, 'p_act_api', 'pet_act_res', 'POST', `${BACKEND_BASE}/api/pet/active`, '{"userId":"{user_id}","petType":"{option_linh_thu}"}', { x: -300, y: 600 });
  gb.link(bActive, 'p_act_api');
  embedMsg(gb, 'p_act_msg', { title: `${em('su_pet_paw')} XUẤT TRẬN LINH THÚ`, description: '{pet_act_res.response.message}', color: '#10b981' }, { x: -300, y: 800 });
  gb.link('p_act_api', 'p_act_msg');

  // Upgrade Level
  apiAction(gb, 'p_lvl_api', 'pet_lvl_res', 'POST', `${BACKEND_BASE}/api/pet/upgrade`, '{"userId":"{user_id}","petType":"{option_linh_thu}","mode":"level"}', { x: 0, y: 600 });
  gb.link(bUpLvl, 'p_lvl_api');
  embedMsg(gb, 'p_lvl_msg', { title: `${em('su_level_up')} THĂNG CẤP LINH THÚ`, description: '{pet_lvl_res.response.message}', color: '#3b82f6' }, { x: 0, y: 800 });
  gb.link('p_lvl_api', 'p_lvl_msg');

  // Upgrade Star
  apiAction(gb, 'p_star_api', 'pet_star_res', 'POST', `${BACKEND_BASE}/api/pet/upgrade`, '{"userId":"{user_id}","petType":"{option_linh_thu}","mode":"star"}', { x: 300, y: 600 });
  gb.link(bUpStar, 'p_star_api');
  embedMsg(gb, 'p_star_msg', { title: `${em('su_star_stone')} ĐỘT PHÁ SAO LINH THÚ`, description: '{pet_star_res.response.message}', color: '#f59e0b' }, { x: 300, y: 800 });
  gb.link('p_star_api', 'p_star_msg');

  // List
  apiAction(gb, 'p_list_api', 'pet_list_res', 'GET', `${BACKEND_BASE}/api/pet/{user_id}`, '', { x: 600, y: 600 });
  gb.link(bList, 'p_list_api');
  embedMsg(gb, 'p_list_msg', {
    title: `${em('su_pet_paw')} KHO LINH THÚ CỦA {pet_list_res.response.user.username}`,
    description: '{pet_list_res.response.summary_pets}',
    color: '#ec4899',
  }, { x: 600, y: 800 });
  gb.link('p_list_api', 'p_list_msg');

  return gb.elements();
}

const TARGETS = [
  { name: 'daily', build: buildDailyCmd },
  { name: 'doiqua', build: buildDoiquaCmd },
  { name: 'roll', build: buildRollCmd },
  { name: 'inv', build: buildInvCmd },
  { name: 'equip', build: buildEquipCmd },
  { name: 'unequip', build: buildUnequipCmd },
  { name: 'linhthu', build: buildPetCmd },
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
