/**
 * scripts/deploy_info_toggle_botghost.mjs
 * Cập nhật lệnh BotGhost /info:
 * - Giữ nguyên toàn bộ luồng tra cứu cũ (item/domain/role/pet không tiến hóa không thay đổi).
 * - Khi pet có thể Tiến Hóa Chân Thần (can_toggle_form === 'true': 40 Pet Độc Nhất + Cửu Vĩ Hồng Hồ):
 *   thêm nút [Đổi Splash (Thường ↔ Tiến Hóa)] cho phép chuyển đổi qua lại 6 lần liên tiếp
 *   ngay trên cùng tin nhắn info_ack (who_can_press: 'user').
 *
 * Usage:
 *   node scripts/deploy_info_toggle_botghost.mjs --dry-run
 *   node scripts/deploy_info_toggle_botghost.mjs --apply
 */

import LZString from 'lz-string';
import { GraphBuilder, GA_GROUP_ID, validateGraph, deployViaCDP } from './ga_builder_lib.mjs';
import { em, emId } from '../src/config/emojiHelper.js';

const BACKEND_BASE = 'https://sumi-profile-backend.onrender.com';
const AUTHOR_ONLY_MSG = `${em('ui_warn') || '⚠️'} Chỉ người dùng lệnh \`/info\` mới có thể bấm nút chuyển Splash Art này.`;

function emojiByKey(name, fallbackKey = 'su_sparkle') {
  return em(name) || em(fallbackKey) || '';
}

function emojiIdByKey(name, fallbackKey = 'su_sparkle') {
  return emId(name) || emId(fallbackKey) || '';
}

function addApiGet(gb, id, resVar, url, pos) {
  return gb.act(id, 'api_action', {
    name: resVar,
    ephemeral: false,
    request_options: {
      method: 'GET',
      url,
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
  }, pos);
}

function addEmbed(gb, id, { title, description, imageUrl = '', footer = '', target, editId, action_id }, pos) {
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
        color: '#ec4899',
        timestamp: false,
        author: { name: '', iconURL: '', url: '' },
        footer: footer ? { text: footer, iconURL: '' } : { text: '', iconURL: '' },
        image: { url: imageUrl || '' },
        thumbnail: { url: '' },
        fields: [],
      }],
    },
  };
  if (editId) data.editId = editId;
  if (action_id) data.action_id = action_id;
  return gb.act(id, 'advanced_message', data, pos);
}

export function buildInfoCommandTree(toggleHops = 6) {
  const gb = new GraphBuilder();
  gb.rootSlash('info', 'Tra cứu trực tiếp Linh Thú, Pháp Bảo, Lãnh Địa, Role, Hạt Giống hoặc Mã UID', { ephemeral: false });
  gb.errorHandlerWait('err_wait');
  gb.option('ma_id', 'string', 'Nhập Mã UID hoặc tên vật phẩm / linh thú / role / lãnh địa', { required: true, x: 420, y: 0 });

  addEmbed(gb, 'info_ack', {
    title: `${emojiByKey('su_wiki_scroll')} Đang tra cứu Bách Khoa Tu Tiên...`,
    description: 'Đang tìm thông số, HAX và nguồn gốc của `{option_ma_id}`...',
    target: { reply: true },
    editId: 'info_ack',
  }, { x: 0, y: 180 });
  gb.link('root', 'info_ack');

  addApiGet(gb, 'info_api', 'info_res', `${BACKEND_BASE}/api/info/{encode_text[{option_ma_id}]}?requesterId={user_id}`, { x: 0, y: 360 });
  gb.link('info_ack', 'info_api');

  const hasImg = gb.cmp('info_has_img', '{info_res.response.image_url}', '^https://', 'matches_pattern', { ignoreCase: true }, { x: 0, y: 540 });
  gb.link('info_api', hasImg.condId);

  // Branch NO image
  addEmbed(gb, 'info_edit_noimg', {
    title: '{info_res.response.title}',
    description: '{info_res.response.description}',
    imageUrl: '',
    footer: '{info_res.response.footer}',
    target: { editId: 'info_ack' },
    action_id: 'info_ack',
  }, { x: 320, y: 740 });
  gb.link(hasImg.no, 'info_edit_noimg');

  // Branch HAS image -> check if evolvable pet toggle applies
  const canToggle = gb.cmp('info_can_toggle', '{info_res.response.can_toggle_form}', 'true', 'equal_to', { ignoreCase: true }, { x: -240, y: 740 });
  gb.link(hasImg.yes, canToggle.condId);

  addEmbed(gb, 'info_edit_img', {
    title: '{info_res.response.title}',
    description: '{info_res.response.description}',
    imageUrl: '{info_res.response.image_url}',
    footer: '{info_res.response.footer}',
    target: { editId: 'info_ack' },
    action_id: 'info_ack',
  }, { x: -60, y: 940 });
  gb.link(canToggle.no, 'info_edit_img');

  const firstEvoMsgId = 'info_edit_img_evo';
  addEmbed(gb, firstEvoMsgId, {
    title: '{info_res.response.title}',
    description: '{info_res.response.description}',
    imageUrl: '{info_res.response.image_url}',
    footer: '{info_res.response.footer}',
    target: { editId: 'info_ack' },
    action_id: 'info_ack',
  }, { x: -460, y: 940 });
  gb.link(canToggle.yes, firstEvoMsgId);

  let prevMsgId = firstEvoMsgId;
  let prevResVar = 'info_res';
  const btnEmojiId = emojiIdByKey('su_tier_toithuong', 'su_sparkle');

  for (let hop = 1; hop <= toggleHops; hop += 1) {
    const baseY = 940 + hop * 360;
    const btnId = `btn_info_toggle_${hop}`;
    const apiId = `info_tgl_${hop}_api`;
    const resVar = `info_tgl_${hop}_res`;
    const msgId = `info_tgl_${hop}_msg`;

    gb.advBtn(btnId, prevMsgId, {
      label: 'Đổi Splash (Thường ↔ Tiến Hóa)',
      style: 'PRIMARY',
      ...(btnEmojiId ? { emoji_id: btnEmojiId } : {}),
      orderComponent: true,
      row: '1',
      weight: '1',
      showReplies: 'hide',
      who_can_press: 'user',
      who_can_press_message: AUTHOR_ONLY_MSG,
    }, { x: -460, y: baseY - 220 });

    addApiGet(
      gb,
      apiId,
      resVar,
      `${BACKEND_BASE}/api/info/{info_res.response.entity_id}?requesterId={user_id}&form={${prevResVar}.response.toggle_target_form}`,
      { x: -460, y: baseY - 100 },
    );
    gb.link(btnId, apiId);

    addEmbed(gb, msgId, {
      title: `{${resVar}.response.title}`,
      description: `{${resVar}.response.description}`,
      imageUrl: `{${resVar}.response.image_url}`,
      footer: `{${resVar}.response.footer}`,
      target: { editId: 'info_ack' },
      action_id: 'info_ack',
    }, { x: -460, y: baseY + 40 });
    gb.link(apiId, msgId);

    prevMsgId = msgId;
    prevResVar = resVar;
  }

  return gb.elements();
}

const isCli = process.argv[1] && process.argv[1].endsWith('deploy_info_toggle_botghost.mjs');
if (isCli) {
  const apply = process.argv.includes('--apply');
  const els = buildInfoCommandTree(6);
  const errs = validateGraph(els);
  if (errs.length) {
    console.error('[OFFLINE VALIDATION FAILED]', errs);
    process.exit(1);
  }
  // Enforce <= 500 regex chars & valid RegExp(p.trim(), 'i') & zero curly braces in patterns
  for (const el of els) {
    if (el.type === 'conditionChild' && el.data?.data?.type === 'matches_pattern') {
      const p = String(el.data.data.comparison_value || '');
      if (p.length > 500 || /[{}]/.test(p)) throw new Error(`Invalid matches_pattern in ${el.id}: ${p}`);
      new RegExp(p.trim(), 'i');
    }
  }
  const comp = LZString.compressToBase64(JSON.stringify(els));
  console.log(`[info_toggle] Validated ${els.length} elements cleanly (compressed ${(comp.length / 1024).toFixed(1)} KB).`);

  if (!apply) {
    console.log('[DRY-RUN] Pass --apply to deploy /info onto live BotGhost via CDP 9222.');
    process.exit(0);
  }

  const res = await deployViaCDP({
    groupId: GA_GROUP_ID,
    mode: 'command',
    name: 'info',
    elements: els,
    enabled: true,
  });
  console.log('[DEPLOY /info RESULT]', res);
  if (!res?.ok) process.exit(1);
}
