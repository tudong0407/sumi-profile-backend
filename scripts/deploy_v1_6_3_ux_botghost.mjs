/**
 * scripts/deploy_v1_6_3_ux_botghost.mjs
 * Triển khai Bản Nâng Cấp SuMi Family Ver 1.6.3 (Gộp ngầm v1.6.1) lên BotGhost qua Edge CDP (9222):
 * 1. /luyendan: UI ngang OwO (2 inline fields, bỏ ảnh lớn, bỏ nút Làm Mới, 1 Dropdown/Lò, ẩn/hiện nút động theo ui_variant, gửi thêm 1 tin kết quả khi thu đan).
 * 2. /inv: UI ngang 2x3 (6 inline fields), bỏ Dropdown & bỏ Row 2 tabs, chỉ giữ Row 1 [Bộ 1] [Bộ 2] [Bộ 3] tự động lưu.
 * 3. /linhvuc: Bỏ Dropdown, Row 1 [Tổng Quan] [Linh Vực] [Thần Thức] [Thần Cảnh], Row 2 [Trang Trước] [Trang Sau].
 * 4. /phapbao & /roles: Bỏ Dropdown, thay bằng [Trang Trước] [Trang Sau].
 * 5. /updates: Nâng nhãn v1.6.1 -> +1.500 LT.
 * 6. AI Mention & Global Ack Gate Sweep (+1.500 LT).
 *
 * Usage:
 *   node scripts/deploy_v1_6_3_ux_botghost.mjs --dry-run
 *   node scripts/deploy_v1_6_3_ux_botghost.mjs [--only=luyendan,inv,linhvuc,phapbao,roles,updates,ai,sweep]
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
import { em, emId } from '../src/config/emojiHelper.js';
import { ALCHEMY_RECIPES } from '../src/data/v161AlchemyCatalog.js';

const PROFILE_GROUP_ID = '1782127263978';
const BACKEND_BASE = 'https://sumi-profile-backend.onrender.com';
const AI_MENTION_INT_ID = '4cc5db30-029c-4a55-86e6-6e6850012afd';

const CUSTOM_EMOJIS_RAW = JSON.parse(
  fs.readFileSync(new URL('../src/config/custom_emojis.json', import.meta.url), 'utf8'),
);

function uidEm(name, fallbackKey = 'su_sparkle') {
  const row = CUSTOM_EMOJIS_RAW[name] || CUSTOM_EMOJIS_RAW[fallbackKey];
  if (row?.id) return row.animated ? `<a:${row.name}:${row.id}>` : `<:${row.name}:${row.id}>`;
  return em(name) || '';
}

function uidId(name, fallbackKey = 'su_sparkle') {
  return CUSTOM_EMOJIS_RAW[name]?.id || CUSTOM_EMOJIS_RAW[fallbackKey]?.id || emId(fallbackKey) || '';
}

class V163GraphBuilder extends GraphBuilder {
  advSelectMenu(id, parentMsgId, {
    placeholder,
    customVariableName,
    basic_options,
    row = '1',
    weight = '1',
    showReplies = 'hide',
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
      target: id,
      animated: false,
      arrowHeadType: 'arrowclosed',
      type: 'custom',
      id: `reactflow__edge-${parentMsgId}-${id}`,
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

function assertSelectLimitsAndRegex(elements, label) {
  for (const el of elements) {
    if (el.type === 'advMessageSelectMenu') {
      const opts = el.data?.data?.basic_options || [];
      if (opts.length < 1 || opts.length > 25) {
        throw new Error(`Select menu "${el.id}" in ${label} has invalid count ${opts.length}`);
      }
    }
    const str = JSON.stringify(el);
    if (str.includes('matches_pattern')) {
      const pats = el.data?.data?.type === 'matches_pattern' ? [el.data?.data?.comparison_value] : [];
      for (const p of pats) {
        if (typeof p === 'string') validateRegexSafety(p, `${label}.${el.id}`);
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
  footer = '',
  fields = [],
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
        timestamp: false,
        author: { name: '', iconURL: '', url: '' },
        footer: footer ? { text: footer, iconURL: '' } : { text: '', iconURL: '' },
        image: { url: imageUrl || '' },
        thumbnail: { url: '' },
        fields,
      }],
    },
  };
  if (editId) data.editId = editId;
  if (action_id) data.action_id = action_id;
  return gb.act(id, 'advanced_message', data, pos);
}

function btnCfg(label, style, emojiName, row = '1', weight = '1', showReplies = 'hide') {
  const eid = uidId(emojiName);
  return {
    label,
    style,
    emoji_id: eid || undefined,
    orderComponent: true,
    row,
    weight,
    showReplies,
  };
}

function attachAckBranchV163(gb, prefix, apiNodeId, resVarName, { editId = undefined, x = 0, y = 0 } = {}) {
  const gate = gb.cmp(`${prefix}_gate`, `{${resVarName}.response.needs_update_ack}`, 'true', 'equal_to', { ignoreCase: true, option: '', not: false }, { x, y });
  gb.link(apiNodeId, gate.condId);

  const msgAck = `${prefix}_msg_ack`;
  const btnAck = `${prefix}_btn_ack`;
  const apiAck = `${prefix}_api_ack`;
  const msgDone = `${prefix}_msg_done`;

  embedMsg(gb, msgAck, {
    title: `{${resVarName}.response.update_title}`,
    description: `{${resVarName}.response.update_description}`,
    color: '#ec4899',
    footer: '',
    target: editId ? { editId } : { reply: true },
    action_id: editId || undefined,
  }, { x: x - 260, y: y + 170 });
  gb.link(gate.yes, msgAck);

  gb.advBtn(btnAck, msgAck, btnCfg('Tôi Đã Đọc & Xác Nhận (+1.500 LT)', 'SUCCESS', 'su_linhthach', '1', '1', 'show'), { x: x - 260, y: y + 340 });

  apiAction(gb, apiAck, `${prefix}_ack_res`, 'POST', `${BACKEND_BASE}/api/update/ack`,
    '{"userId":"{user_id}","username":"{user_displayName}","avatarUrl":"{user_icon}"}', { x: x - 260, y: y + 510 });
  gb.link(btnAck, apiAck);

  embedMsg(gb, msgDone, {
    title: `${uidEm('su_level_up')} XÁC NHẬN CẬP NHẬT THÀNH CÔNG!`,
    description: `{${prefix}_ack_res.response.message}`,
    color: '#10b981',
    footer: '',
  }, { x: x - 260, y: y + 680 });
  gb.link(apiAck, msgDone);

  return gate.no;
}

// ============================================================================
// 1. /luyendan — UI Ngang OwO + 1 Dropdown/Lò + Ẩn/Hiện Nút Động + Tin Thu Đan
// ============================================================================
export function buildLuyendanV163Cmd() {
  const gb = new V163GraphBuilder();
  gb.rootSlash('luyendan', 'Lò Luyện Đan — 2 Lò song song (6 mẻ/ngày), nâng cấp Lò Lv.1–5, dùng Linh Quả (/farm)', { ephemeral: false });
  gb.errorHandlerWait();

  embedMsg(gb, 'ld_board_msg', {
    title: `${uidEm('furnace_lv1', 'su_el_hoa')} Đang mở Đan Phòng Luyện Đan...`,
    description: 'Đang kiểm tra trạng thái Lò #1 và Lò #2 của {user_displayName}...',
    color: '#ec4899',
    target: { reply: true },
    editId: 'ld_board_msg',
  }, { x: 0, y: 150 });
  gb.link('root', 'ld_board_msg');

  apiAction(gb, 'ld_init_api', 'ld_init_res', 'GET',
    `${BACKEND_BASE}/api/alchemy/status/{user_id}?username={encode_text[{user_displayName}]}&avatar={encode_text[{user_icon}]}`, '', { x: 0, y: 310 });
  gb.link('ld_board_msg', 'ld_init_api');

  const ldOk = attachAckBranchV163(gb, 'ld', 'ld_init_api', 'ld_init_res', { editId: 'ld_board_msg', x: 0, y: 470 });

  const recipeOptions = ALCHEMY_RECIPES.map((r) => {
    const costTxt = r.costEssence > 0 ? `${r.costLt} LT + ${r.costEssence} LQ` : `${r.costLt} LT`;
    return {
      label: `${r.tierLabel}: ${r.name}`,
      description: `Vốn ${costTxt} | ${r.durationMin}p | ${r.minLt}-${r.maxLt} LT (Lv.${r.minLevel}+)`,
      emoji_id: uidId(r.iconKey, 'su_el_hoa'),
      value: r.id,
    };
  });

  let seq = 0;
  const uid = (p) => `${p}_${++seq}`;

  function renderBoardFields(resVar) {
    return [
      { name: `{${resVar}.response.f1_name}`, value: `{${resVar}.response.f1_value}`, inline: true },
      { name: `{${resVar}.response.f2_name}`, value: `{${resVar}.response.f2_value}`, inline: true },
    ];
  }

  function attachVariantControls(parentMsgId, variant, resVar, depth, x, y) {
    const hasSlot2 = variant === 's2_ok' || variant === 's2_broken';
    const isBroken = variant === 's1_broken' || variant === 's2_broken';
    const btnRow = hasSlot2 ? '3' : '2';

    const emitEditAndContinue = (apiId, outResVar, actionKey, cx, cy) => {
      const mId = uid('ld_msg');
      embedMsg(gb, mId, {
        title: `{${outResVar}.response.title}`,
        description: `{${outResVar}.response.description}`,
        color: '#ec4899',
        imageUrl: '',
        footer: `{${outResVar}.response.footer}`,
        fields: renderBoardFields(outResVar),
        target: { editId: 'ld_board_msg' },
        action_id: 'ld_board_msg',
      }, { x: cx, y: cy });
      gb.link(apiId, mId);

      // Nếu thao tác bị từ chối (has_error_msg == "true"), gửi thêm 1 embed đỏ mới vào kênh (depth 0 để giữ DAG <= 1.000 els)
      if (depth === 0) {
        const eGate = gb.cmp(uid('ld_egate'), `{${outResVar}.response.has_error_msg}`, 'true', 'equal_to', { ignoreCase: true, option: '', not: false }, { x: cx - 180, y: cy + 150 });
        gb.link(mId, eGate.condId);
        const eReply = uid('ld_ereply');
        embedMsg(gb, eReply, {
          title: `{${outResVar}.response.error_title}`,
          description: `{${outResVar}.response.error_message}`,
          color: '#ef4444',
          footer: '',
          target: { id: '{channel_id}' },
        }, { x: cx - 280, y: cy + 300 });
        gb.link(eGate.yes, eReply);
      }

      const isHarvest = actionKey === 'harvest';
      let nextParent = mId;
      if (isHarvest) {
        const hGate = gb.cmp(uid('ld_hgate'), `{${outResVar}.response.has_harvest_msg}`, 'true', 'equal_to', { ignoreCase: true, option: '', not: false }, { x: cx, y: cy + 150 });
        gb.link(mId, hGate.condId);
        const hReply = uid('ld_hreply');
        embedMsg(gb, hReply, {
          title: `{${outResVar}.response.harvest_title}`,
          description: `{${outResVar}.response.harvest_description}`,
          color: '#10b981',
          footer: '',
          target: { id: '{channel_id}' },
        }, { x: cx - 150, y: cy + 300 });
        gb.link(hGate.yes, hReply);

        if (depth < 1) {
          if (!isBroken) {
            // Nếu thu đan bị nổ -> hiện ngay nút Sửa Lò; ngược lại giữ variant hiện tại
            const bGate = gb.cmp(uid('ld_bgate'), `{${outResVar}.response.show_repair_btn}`, 'true', 'equal_to', { ignoreCase: true, option: '', not: false }, { x: cx + 150, y: cy + 300 });
            gb.link(mId, bGate.condId);
            const brokenVariant = hasSlot2 ? 's2_broken' : 's1_broken';
            const mBroken = uid('ld_msg_br');
            embedMsg(gb, mBroken, {
              title: `{${outResVar}.response.title}`,
              description: `{${outResVar}.response.description}`,
              color: '#ef4444',
              imageUrl: '',
              footer: `{${outResVar}.response.footer}`,
              fields: renderBoardFields(outResVar),
              target: { editId: 'ld_board_msg' },
              action_id: 'ld_board_msg',
            }, { x: cx + 80, y: cy + 450 });
            gb.link(bGate.yes, mBroken);
            attachVariantControls(mBroken, brokenVariant, outResVar, depth + 1, cx + 80, cy + 600);
            attachVariantControls(hGate.no, variant, outResVar, depth + 1, cx + 260, cy + 450);
          } else {
            attachVariantControls(mId, variant, outResVar, depth + 1, cx, cy + 320);
          }
        }
        return;
      }

      if (depth >= 1) return;

      if (actionKey === 'slot2' && !hasSlot2) {
        const s2Gate = gb.cmp(uid('ld_s2gate'), `{${outResVar}.response.slot2_unlocked}`, 'true', 'equal_to', { ignoreCase: true, option: '', not: false }, { x: cx, y: cy + 150 });
        gb.link(mId, s2Gate.condId);
        const s2Variant = isBroken ? 's2_broken' : 's2_ok';
        const mS2 = uid('ld_msg_s2');
        embedMsg(gb, mS2, {
          title: `{${outResVar}.response.title}`,
          description: `{${outResVar}.response.description}`,
          color: '#ec4899',
          imageUrl: '',
          footer: `{${outResVar}.response.footer}`,
          fields: renderBoardFields(outResVar),
          target: { editId: 'ld_board_msg' },
          action_id: 'ld_board_msg',
        }, { x: cx - 140, y: cy + 300 });
        gb.link(s2Gate.yes, mS2);
        attachVariantControls(mS2, s2Variant, outResVar, depth + 1, cx - 140, cy + 450);
        attachVariantControls(s2Gate.no, variant, outResVar, depth + 1, cx + 140, cy + 300);
        return;
      }

      if (actionKey === 'repair' && isBroken) {
        const rGate = gb.cmp(uid('ld_rgate'), `{${outResVar}.response.show_repair_btn}`, 'false', 'equal_to', { ignoreCase: true, option: '', not: false }, { x: cx, y: cy + 150 });
        gb.link(mId, rGate.condId);
        const okVariant = hasSlot2 ? 's2_ok' : 's1_ok';
        const mOk = uid('ld_msg_ok');
        embedMsg(gb, mOk, {
          title: `{${outResVar}.response.title}`,
          description: `{${outResVar}.response.description}`,
          color: '#ec4899',
          imageUrl: '',
          footer: `{${outResVar}.response.footer}`,
          fields: renderBoardFields(outResVar),
          target: { editId: 'ld_board_msg' },
          action_id: 'ld_board_msg',
        }, { x: cx - 140, y: cy + 300 });
        gb.link(rGate.yes, mOk);
        attachVariantControls(mOk, okVariant, outResVar, depth + 1, cx - 140, cy + 450);
        attachVariantControls(rGate.no, variant, outResVar, depth + 1, cx + 140, cy + 300);
        return;
      }

      attachVariantControls(nextParent, variant, outResVar, depth + 1, cx, cy + 160);
    };

    // Dropdown Lò #1 (Row 1)
    const sel1 = uid('sel_ld_s1');
    const var1 = `ld_p1_${seq}`;
    const api1 = uid('api_ld_b1');
    const rVar1 = `ld_r1_${seq}`;
    gb.advSelectMenu(sel1, parentMsgId, {
      placeholder: 'Lò #1 — Chọn công thức đan dược...',
      customVariableName: var1,
      basic_options: recipeOptions,
      row: '1',
      weight: '1',
      showReplies: 'hide',
    }, { x: x - 420, y: y + 140 });
    apiAction(gb, api1, rVar1, 'POST', `${BACKEND_BASE}/api/alchemy/brew`,
      `{"userId":"{user_id}","recipeId":"{${var1}}","slotIndex":1,"username":"{user_displayName}","avatarUrl":"{user_icon}"}`,
      { x: x - 420, y: y + 290 });
    gb.link(sel1, api1);
    emitEditAndContinue(api1, rVar1, 'brew1', x - 420, y + 440);

    // Dropdown Lò #2 (Row 2) nếu Lò #2 đã mở
    if (hasSlot2) {
      const sel2 = uid('sel_ld_s2');
      const var2 = `ld_p2_${seq}`;
      const api2 = uid('api_ld_b2');
      const rVar2 = `ld_r2_${seq}`;
      gb.advSelectMenu(sel2, parentMsgId, {
        placeholder: 'Lò #2 — Chọn công thức đan dược...',
        customVariableName: var2,
        basic_options: recipeOptions,
        row: '2',
        weight: '1',
        showReplies: 'hide',
      }, { x: x - 140, y: y + 140 });
      apiAction(gb, api2, rVar2, 'POST', `${BACKEND_BASE}/api/alchemy/brew`,
        `{"userId":"{user_id}","recipeId":"{${var2}}","slotIndex":2,"username":"{user_displayName}","avatarUrl":"{user_icon}"}`,
        { x: x - 140, y: y + 290 });
      gb.link(sel2, api2);
      emitEditAndContinue(api2, rVar2, 'brew2', x - 140, y + 440);
    }

    // Nút chức năng động (depth 1 giữ gọn: Thu Đan + Sửa Lò nếu hỏng)
    const buttons = [
      { key: 'harvest', label: 'Thu Đan / Dọn Lò', style: 'SUCCESS', icon: 'su_level_up', weight: '1', url: `${BACKEND_BASE}/api/alchemy/harvest`, dx: 140 },
    ];
    if (depth === 0) {
      buttons.push({ key: 'upgrade', label: 'Nâng Cấp Lò', style: 'PRIMARY', icon: 'su_el_hoa', weight: '2', url: `${BACKEND_BASE}/api/alchemy/upgrade`, dx: 380 });
      if (!hasSlot2) {
        buttons.push({ key: 'slot2', label: 'Mở Lò #2', style: 'SECONDARY', icon: 'su_sparkle', weight: '3', url: `${BACKEND_BASE}/api/alchemy/unlock-slot2`, dx: 620 });
      }
    }
    if (isBroken) {
      buttons.push({ key: 'repair', label: 'Sửa Lò (300 LT)', style: 'DANGER', icon: 'ui_warn', weight: depth === 0 ? (hasSlot2 ? '3' : '4') : '2', url: `${BACKEND_BASE}/api/alchemy/repair`, dx: 860 });
    }

    for (const b of buttons) {
      const bId = uid(`btn_ld_${b.key}`);
      const aId = uid(`api_ld_${b.key}`);
      const rVar = `ld_rb_${seq}`;
      gb.advBtn(bId, parentMsgId, btnCfg(b.label, b.style, b.icon, btnRow, b.weight, 'hide'), { x: x + b.dx, y: y + 140 });
      apiAction(gb, aId, rVar, 'POST', b.url,
        '{"userId":"{user_id}","username":"{user_displayName}","avatarUrl":"{user_icon}"}',
        { x: x + b.dx, y: y + 290 });
      gb.link(bId, aId);
      emitEditAndContinue(aId, rVar, b.key, x + b.dx, y + 440);
    }
  }

  // Nhánh 4 biến thể ui_variant từ ld_init_res
  gb.cond('ld_var_cond', 'comparison', { base_value: '{ld_init_res.response.ui_variant}', target: { self: true } }, { x: 0, y: 660 });
  gb.link(ldOk, 'ld_var_cond');

  const variants = [
    { name: 's1_ok', dx: -1500, isElse: false },
    { name: 's1_broken', dx: -500, isElse: false },
    { name: 's2_broken', dx: 500, isElse: false },
    { name: 's2_ok', dx: 1500, isElse: true },
  ];

  for (const v of variants) {
    const br = v.isElse
      ? gb.elseBranch('ld_var_cond', `ld_br_${v.name}`, 'comparison', { x: v.dx, y: 840 })
      : gb.branch('ld_var_cond', `ld_br_${v.name}`, 'comparison', { type: 'equal_to', comparison_value: v.name, ignoreCase: true, option: '', not: false }, { x: v.dx, y: 840 });

    const editId = `ld_init_edit_${v.name}`;
    embedMsg(gb, editId, {
      title: '{ld_init_res.response.title}',
      description: '{ld_init_res.response.description}',
      color: '#ec4899',
      imageUrl: '',
      footer: '{ld_init_res.response.footer}',
      fields: renderBoardFields('ld_init_res'),
      target: { editId: 'ld_board_msg' },
      action_id: 'ld_board_msg',
    }, { x: v.dx, y: 1020 });
    gb.link(br, editId);

    attachVariantControls(editId, v.name, 'ld_init_res', 0, v.dx, 1180);
  }

  return gb.elements();
}

// ============================================================================
// 2. /inv — UI Ngang 2x3 + Chỉ Row 1 [Bộ 1] [Bộ 2] [Bộ 3]
// ============================================================================
export function buildInvV163Cmd() {
  const gb = new V163GraphBuilder();
  gb.rootSlash('inv', 'Xem Túi Đồ Tiên Giới (Giao diện ngang 2×3 & chuyển nhanh Bộ 1 / Bộ 2 / Bộ 3)', { ephemeral: false });
  gb.errorHandlerWait();

  embedMsg(gb, 'inv_ack', {
    title: `${uidEm('su_wiki_scroll')} Đang mở Túi Đồ Tiên Giới...`,
    description: 'Đang đồng bộ hành trang của {user_displayName}...',
    color: '#a855f7',
    target: { reply: true },
    editId: 'inv_ack',
  }, { x: 0, y: 160 });
  gb.link('root', 'inv_ack');

  apiAction(
    gb,
    'inv_api',
    'inv_res',
    'GET',
    `${BACKEND_BASE}/api/inv/{user_id}?view=overview&username={encode_text[{user_displayName}]}&avatar={encode_text[{user_icon}]}`,
    '',
    { x: 0, y: 320 },
  );
  gb.link('inv_ack', 'inv_api');

  const invNoAck = attachAckBranchV163(gb, 'inv', 'inv_api', 'inv_res', { editId: 'inv_ack', x: 0, y: 480 });

  function invFields(resVar) {
    return [
      { name: `{${resVar}.response.f1_name}`, value: `{${resVar}.response.f1_value}`, inline: true },
      { name: `{${resVar}.response.f2_name}`, value: `{${resVar}.response.f2_value}`, inline: true },
      { name: `{${resVar}.response.f3_name}`, value: `{${resVar}.response.f3_value}`, inline: true },
      { name: `{${resVar}.response.f4_name}`, value: `{${resVar}.response.f4_value}`, inline: true },
      { name: `{${resVar}.response.f5_name}`, value: `{${resVar}.response.f5_value}`, inline: true },
      { name: `{${resVar}.response.f6_name}`, value: `{${resVar}.response.f6_value}`, inline: true },
    ];
  }

  let seq = 0;
  function attachLoadoutButtons(parentMsgId, activeSlot, depth, x, y) {
    if (depth >= 2) return;
    // BotGhost renders higher weight further LEFT -> weight 3 = Bộ 1 (leftmost), 2 = Bộ 2, 1 = Bộ 3 (rightmost)
    const slots = [
      { slot: 1, label: 'Bộ 1', icon: 'su_pet_paw', weight: '3', dx: -260 },
      { slot: 2, label: 'Bộ 2', icon: 'su_crossed_swords', weight: '2', dx: 0 },
      { slot: 3, label: 'Bộ 3', icon: 'su_realm_star', weight: '1', dx: 260 },
    ];
    for (const s of slots) {
      seq += 1;
      const bId = `btn_inv_s${s.slot}_${seq}`;
      const aId = `api_inv_s${s.slot}_${seq}`;
      const rVar = `inv_sres_${seq}`;
      const mId = `msg_inv_s${s.slot}_${seq}`;
      const style = s.slot === activeSlot ? 'PRIMARY' : 'SECONDARY';

      gb.advBtn(bId, parentMsgId, btnCfg(s.label, style, s.icon, '1', s.weight, 'hide'), { x: x + s.dx, y: y + 140 });
      apiAction(gb, aId, rVar, 'POST', `${BACKEND_BASE}/api/inv/loadout/switch`,
        `{"userId":"{user_id}","slot":${s.slot},"username":"{user_displayName}","avatarUrl":"{user_icon}"}`,
        { x: x + s.dx, y: y + 290 });
      gb.link(bId, aId);
      embedMsg(gb, mId, {
        title: `{${rVar}.response.view_title}`,
        description: `{${rVar}.response.view_description}`,
        color: '#a855f7',
        footer: '',
        fields: invFields(rVar),
        target: { editId: 'inv_ack' },
        action_id: 'inv_ack',
      }, { x: x + s.dx, y: y + 440 });
      gb.link(aId, mId);
      attachLoadoutButtons(mId, s.slot, depth + 1, x + s.dx, y + 580);
    }
  }

  gb.cond('inv_slot_cond', 'comparison', { base_value: '{inv_res.response.active_loadout_slot}', target: { self: true } }, { x: 240, y: 660 });
  gb.link(invNoAck, 'inv_slot_cond');

  const brS2 = gb.branch('inv_slot_cond', 'inv_br_s2', 'comparison', { type: 'equal_to', comparison_value: '2', ignoreCase: true, option: '', not: false }, { x: 240, y: 820 });
  const brS3 = gb.branch('inv_slot_cond', 'inv_br_s3', 'comparison', { type: 'equal_to', comparison_value: '3', ignoreCase: true, option: '', not: false }, { x: 1140, y: 820 });
  const brS1 = gb.elseBranch('inv_slot_cond', 'inv_br_s1', 'comparison', { x: -660, y: 820 });

  for (const [slotNum, brNode, bx] of [[1, brS1, -660], [2, brS2, 240], [3, brS3, 1140]]) {
    const editId = `inv_edit_s${slotNum}`;
    embedMsg(gb, editId, {
      title: '{inv_res.response.view_title}',
      description: '{inv_res.response.view_description}',
      color: '#a855f7',
      footer: '',
      fields: invFields('inv_res'),
      target: { editId: 'inv_ack' },
      action_id: 'inv_ack',
    }, { x: bx, y: 980 });
    gb.link(brNode, editId);
    attachLoadoutButtons(editId, slotNum, 0, bx, 980);
  }

  return gb.elements();
}

// ============================================================================
// 3. /linhvuc — Bỏ Dropdown, Row 1 Tabs + Row 2 [Trang Trước] [Trang Sau]
// ============================================================================
export function buildLinhVucV163Cmd() {
  const gb = new V163GraphBuilder();
  gb.rootSlash('linhvuc', 'Quản lý & trang bị Linh Vực, Thần Thức, Thần Cảnh', { ephemeral: false });
  gb.errorHandlerWait();
  gb.option('hanh_dong', 'string', 'Chọn thao tác (mặc định: view)', {
    required: false,
    choices: ['view', 'equip', 'unequip', 'dismantle'],
    x: 420,
    y: 0,
  });
  gb.option('tab', 'string', 'Lọc kho theo loại khi xem (overview / domain / sense / realm)', {
    required: false,
    choices: ['overview', 'domain', 'sense', 'realm'],
    x: 700,
    y: 0,
  });
  gb.option('ma_id', 'string', 'Mã UID / Emoji cần trang bị, phân giải (hoặc slot tháo: domain/sense/realm/all)', {
    required: false,
    x: 980,
    y: 0,
  });
  gb.option('trang', 'int', 'Số trang muốn xem (1, 2, 3...)', {
    required: false,
    x: 1260,
    y: 0,
  });

  gb.cond('lv_mode', 'comparison', { base_value: '{option_hanh_dong}', target: { self: true } }, { x: 0, y: 220 });
  gb.link('root', 'lv_mode');
  const brEq = gb.branch('lv_mode', 'lv_mode_eq', 'comparison', { type: 'equal_to', comparison_value: 'equip', ignoreCase: true, option: '', not: false }, { x: -520, y: 400 });
  const cModeUneq = gb.branch('lv_mode', 'lv_mode_unq', 'comparison', { type: 'equal_to', comparison_value: 'unequip', ignoreCase: true, option: '', not: false }, { x: -120, y: 400 });
  const cModeDism = gb.branch('lv_mode', 'lv_mode_dism', 'comparison', { type: 'equal_to', comparison_value: 'dismantle', ignoreCase: true, option: '', not: false }, { x: 240, y: 400 });
  const brView = gb.elseBranch('lv_mode', 'lv_mode_view', 'comparison', { x: 640, y: 400 });

  // equip
  embedMsg(gb, 'lv_eq_ack', {
    title: `${uidEm('su_realm_star')} Đang khai mở Trận Đồ Linh Vực...`,
    description: 'Đang khắc ấn trang bị `{option_ma_id}`...',
    color: '#a855f7',
    target: { reply: true },
    editId: 'lv_eq_ack',
  }, { x: -520, y: 580 });
  gb.link(brEq, 'lv_eq_ack');
  apiAction(gb, 'lv_eq_api', 'lv_eq_res', 'POST', `${BACKEND_BASE}/api/domain/equip`,
    '{"userId":"{user_id}","username":"{user_displayName}","targetId":"{option_ma_id}"}', { x: -520, y: 760 });
  gb.link('lv_eq_ack', 'lv_eq_api');
  const eqNoAck = attachAckBranchV163(gb, 'lveq', 'lv_eq_api', 'lv_eq_res', { editId: 'lv_eq_ack', x: -520, y: 940 });
  embedMsg(gb, 'lv_eq_edit', {
    title: `${uidEm('su_realm_star')} TRANG BỊ LINH VỰC • THẦN THỨC • THẦN CẢNH`,
    description: '{lv_eq_res.response.message}',
    color: '#a855f7',
    footer: '',
    target: { editId: 'lv_eq_ack' },
    action_id: 'lv_eq_ack',
  }, { x: -520, y: 1140 });
  gb.link(eqNoAck, 'lv_eq_edit');

  // unequip
  embedMsg(gb, 'lv_unq_ack', {
    title: `${uidEm('su_realm_star')} Đang thu hồi Linh Vực...`,
    description: 'Đang thu hồi slot `{option_ma_id}` về kho...',
    color: '#64748b',
    target: { reply: true },
    editId: 'lv_unq_ack',
  }, { x: -120, y: 580 });
  gb.link(cModeUneq, 'lv_unq_ack');
  apiAction(gb, 'lv_unq_api', 'lv_unq_res', 'POST', `${BACKEND_BASE}/api/domain/unequip`,
    '{"userId":"{user_id}","slot":"{option_ma_id}"}', { x: -120, y: 760 });
  gb.link('lv_unq_ack', 'lv_unq_api');
  const unqNoAck = attachAckBranchV163(gb, 'lvunq', 'lv_unq_api', 'lv_unq_res', { editId: 'lv_unq_ack', x: -120, y: 940 });
  embedMsg(gb, 'lv_unq_edit', {
    title: `${uidEm('su_realm_star')} THU HỒI LINH VỰC`,
    description: '{lv_unq_res.response.message}',
    color: '#64748b',
    footer: '',
    target: { editId: 'lv_unq_ack' },
    action_id: 'lv_unq_ack',
  }, { x: -120, y: 1140 });
  gb.link(unqNoAck, 'lv_unq_edit');

  // dismantle
  embedMsg(gb, 'lv_dism_ack', {
    title: `${uidEm('su_linhthach')} Đang luyện hóa phân giải...`,
    description: 'Đang phân giải `{option_ma_id}` thành Linh Thạch...',
    color: '#f59e0b',
    target: { reply: true },
    editId: 'lv_dism_ack',
  }, { x: 240, y: 580 });
  gb.link(cModeDism, 'lv_dism_ack');
  apiAction(gb, 'lv_dism_api', 'lv_dism_res', 'POST', `${BACKEND_BASE}/api/domain/dismantle`,
    '{"userId":"{user_id}","targetId":"{option_ma_id}"}', { x: 240, y: 760 });
  gb.link('lv_dism_ack', 'lv_dism_api');
  const dismNoAck = attachAckBranchV163(gb, 'lvdm', 'lv_dism_api', 'lv_dism_res', { editId: 'lv_dism_ack', x: 240, y: 940 });
  embedMsg(gb, 'lv_dism_edit', {
    title: `${uidEm('su_linhthach')} PHÂN GIẢI LINH VỰC`,
    description: '{lv_dism_res.response.message}',
    color: '#f59e0b',
    footer: '',
    target: { editId: 'lv_dism_ack' },
    action_id: 'lv_dism_ack',
  }, { x: 240, y: 1140 });
  gb.link(dismNoAck, 'lv_dism_edit');

  // view
  embedMsg(gb, 'lv_v_ack', {
    title: `${uidEm('su_realm_star')} Đang mở Kho Linh Vực...`,
    description: 'Đang thống kê Linh Vực, Thần Thức & Thần Cảnh của {user_displayName}...',
    color: '#ec4899',
    target: { reply: true },
    editId: 'lv_v_ack',
  }, { x: 640, y: 580 });
  gb.link(brView, 'lv_v_ack');
  apiAction(gb, 'lv_v_api', 'lv_v_res', 'GET',
    `${BACKEND_BASE}/api/domain/inventory/{user_id}?view={option_tab}&page={option_trang}&username={encode_text[{user_displayName}]}&avatar={encode_text[{user_icon}]}`,
    '', { x: 640, y: 760 });
  gb.link('lv_v_ack', 'lv_v_api');
  const vNoAck = attachAckBranchV163(gb, 'lvv', 'lv_v_api', 'lv_v_res', { editId: 'lv_v_ack', x: 640, y: 940 });
  embedMsg(gb, 'lv_v_edit_0', {
    title: '{lv_v_res.response.title}',
    description: '{lv_v_res.response.description}',
    color: '#ec4899',
    footer: '',
    target: { editId: 'lv_v_ack' },
    action_id: 'lv_v_ack',
  }, { x: 640, y: 1140 });
  gb.link(vNoAck, 'lv_v_edit_0');

  let seq = 0;
  function attachLinhVucControls(parentMsgId, prevResVar, depth, x, y) {
    if (depth >= 2) return;
    const ctrls = [
      { key: 'ov', label: 'Tổng Quan', style: 'SECONDARY', icon: 'su_realm_star', row: '1', weight: '1', q: 'view=overview&page=1', dx: -620 },
      { key: 'dom', label: 'Linh Vực', style: 'PRIMARY', icon: 'su_arena', row: '1', weight: '2', q: 'view=domain&page=1', dx: -370 },
      { key: 'sen', label: 'Thần Thức', style: 'PRIMARY', icon: 'su_sparkle', row: '1', weight: '3', q: 'view=sense&page=1', dx: -120 },
      { key: 'rlm', label: 'Thần Cảnh', style: 'PRIMARY', icon: 'su_tier_epic', row: '1', weight: '4', q: 'view=realm&page=1', dx: 130 },
      { key: 'prev', label: 'Trang Trước', style: 'SECONDARY', icon: 'su_arrow_left', row: '2', weight: '1', q: `view={${prevResVar}.response.view}&page={${prevResVar}.response.prev_page}`, dx: 380 },
      { key: 'next', label: 'Trang Sau', style: 'SECONDARY', icon: 'su_arrow_right', row: '2', weight: '2', q: `view={${prevResVar}.response.view}&page={${prevResVar}.response.next_page}`, dx: 630 },
    ];
    for (const c of ctrls) {
      seq += 1;
      const bId = `btn_lv_${c.key}_${seq}`;
      const aId = `api_lv_${c.key}_${seq}`;
      const rVar = `lv_res_${seq}`;
      const mId = `msg_lv_${c.key}_${seq}`;
      gb.advBtn(bId, parentMsgId, btnCfg(c.label, c.style, c.icon, c.row, c.weight, 'hide'), { x: x + c.dx, y: y + 140 });
      apiAction(gb, aId, rVar, 'GET',
        `${BACKEND_BASE}/api/domain/inventory/{user_id}?${c.q}&username={encode_text[{user_displayName}]}&avatar={encode_text[{user_icon}]}`,
        '', { x: x + c.dx, y: y + 290 });
      gb.link(bId, aId);
      embedMsg(gb, mId, {
        title: `{${rVar}.response.title}`,
        description: `{${rVar}.response.description}`,
        color: '#ec4899',
        footer: '',
        target: { editId: 'lv_v_ack' },
        action_id: 'lv_v_ack',
      }, { x: x + c.dx, y: y + 440 });
      gb.link(aId, mId);
      if (depth + 1 < 2) {
        // Chỉ nối tiếp nút Trước/Sau ở depth 1 để giữ DAG gọn nhẹ
        attachPrevNextOnly(mId, rVar, x + c.dx, y + 580);
      }
    }
  }

  function attachPrevNextOnly(parentMsgId, prevResVar, x, y) {
    for (const c of [
      { key: 'prev', label: 'Trang Trước', icon: 'su_arrow_left', weight: '1', q: `view={${prevResVar}.response.view}&page={${prevResVar}.response.prev_page}`, dx: -140 },
      { key: 'next', label: 'Trang Sau', icon: 'su_arrow_right', weight: '2', q: `view={${prevResVar}.response.view}&page={${prevResVar}.response.next_page}`, dx: 140 },
    ]) {
      seq += 1;
      const bId = `btn_lv_${c.key}_${seq}`;
      const aId = `api_lv_${c.key}_${seq}`;
      const rVar = `lv_res_${seq}`;
      const mId = `msg_lv_${c.key}_${seq}`;
      gb.advBtn(bId, parentMsgId, btnCfg(c.label, 'SECONDARY', c.icon, '1', c.weight, 'hide'), { x: x + c.dx, y: y + 140 });
      apiAction(gb, aId, rVar, 'GET',
        `${BACKEND_BASE}/api/domain/inventory/{user_id}?${c.q}&username={encode_text[{user_displayName}]}&avatar={encode_text[{user_icon}]}`,
        '', { x: x + c.dx, y: y + 290 });
      gb.link(bId, aId);
      embedMsg(gb, mId, {
        title: `{${rVar}.response.title}`,
        description: `{${rVar}.response.description}`,
        color: '#ec4899',
        footer: '',
        target: { editId: 'lv_v_ack' },
        action_id: 'lv_v_ack',
      }, { x: x + c.dx, y: y + 440 });
      gb.link(aId, mId);
    }
  }

  attachLinhVucControls('lv_v_edit_0', 'lv_v_res', 0, 640, 1140);
  return gb.elements();
}

// ============================================================================
// 4. /phapbao & /roles — Thay Dropdown bằng 2 nút [Trang Trước] [Trang Sau]
// ============================================================================
export function buildPhapBaoV163Cmd() {
  const gb = new V163GraphBuilder();
  gb.rootSlash('phapbao', 'Xem Kho Pháp Bảo + lọc Vũ Khí, Bảo Ngọc, Chiến Hồn', { ephemeral: false });
  gb.errorHandlerWait();
  gb.option('o_trang_bi', 'string', 'Lọc theo ô trang bị (mặc định: all)', {
    required: false,
    choices: ['all', 'weapon', 'gem', 'soul', 'equipped'],
    x: 420,
    y: 0,
  });
  gb.option('sap_xep', 'string', 'Sắp xếp (mặc định: phẩm cao -> thấp)', {
    required: false,
    choices: ['rarity_desc', 'rarity_asc', 'power_desc', 'slot'],
    x: 700,
    y: 0,
  });
  gb.option('trang', 'int', 'Số trang muốn xem (1, 2, 3...)', {
    required: false,
    x: 980,
    y: 0,
  });

  embedMsg(gb, 'pb_ack', {
    title: `${uidEm('su_crossed_swords')} Đang mở Kho Pháp Bảo...`,
    description: 'Đang kiểm kê toàn bộ Vũ Khí, Bảo Ngọc và Chiến Hồn của {user_displayName}...',
    color: '#f59e0b',
    target: { reply: true },
    editId: 'pb_ack',
  }, { x: 0, y: 160 });
  gb.link('root', 'pb_ack');

  apiAction(gb, 'pb_api', 'pb_res', 'GET',
    `${BACKEND_BASE}/api/equipment/{user_id}?slot={option_o_trang_bi}&sort={option_sap_xep}&page={option_trang}&username={encode_text[{user_displayName}]}&avatar={encode_text[{user_icon}]}`,
    '', { x: 0, y: 320 });
  gb.link('pb_ack', 'pb_api');

  const pbNoAck = attachAckBranchV163(gb, 'pb', 'pb_api', 'pb_res', { editId: 'pb_ack', x: 0, y: 480 });
  embedMsg(gb, 'pb_edit_0', {
    title: `${uidEm('su_crossed_swords')} KHO PHÁP BẢO CỦA {pb_res.response.user.username}`,
    description: '{pb_res.response.filter_summary}\n\n{pb_res.response.summary_equipment}',
    color: '#f59e0b',
    footer: '',
    target: { editId: 'pb_ack' },
    action_id: 'pb_ack',
  }, { x: 240, y: 680 });
  gb.link(pbNoAck, 'pb_edit_0');

  let seq = 0;
  function attachPager(parentMsgId, prevResVar, depth, x, y) {
    if (depth >= 3) return;
    for (const c of [
      { key: 'prev', label: 'Trang Trước', icon: 'su_arrow_left', weight: '1', pageExpr: `{${prevResVar}.response.prev_page}`, dx: -160 },
      { key: 'next', label: 'Trang Sau', icon: 'su_arrow_right', weight: '2', pageExpr: `{${prevResVar}.response.next_page}`, dx: 160 },
    ]) {
      seq += 1;
      const bId = `btn_pb_${c.key}_${seq}`;
      const aId = `api_pb_${c.key}_${seq}`;
      const rVar = `pb_pres_${seq}`;
      const mId = `msg_pb_${c.key}_${seq}`;
      gb.advBtn(bId, parentMsgId, btnCfg(c.label, 'SECONDARY', c.icon, '1', c.weight, 'hide'), { x: x + c.dx, y: y + 140 });
      apiAction(gb, aId, rVar, 'GET',
        `${BACKEND_BASE}/api/equipment/{user_id}?slot={${prevResVar}.response.slot}&sort={${prevResVar}.response.sort}&page=${c.pageExpr}&username={encode_text[{user_displayName}]}&avatar={encode_text[{user_icon}]}`,
        '', { x: x + c.dx, y: y + 290 });
      gb.link(bId, aId);
      embedMsg(gb, mId, {
        title: `${uidEm('su_crossed_swords')} KHO PHÁP BẢO CỦA {${rVar}.response.user.username}`,
        description: `{${rVar}.response.filter_summary}\n\n{${rVar}.response.summary_equipment}`,
        color: '#f59e0b',
        footer: '',
        target: { editId: 'pb_ack' },
        action_id: 'pb_ack',
      }, { x: x + c.dx, y: y + 440 });
      gb.link(aId, mId);
      attachPager(mId, rVar, depth + 1, x + c.dx, y + 580);
    }
  }

  attachPager('pb_edit_0', 'pb_res', 0, 240, 680);
  return gb.elements();
}

export function buildRolesV163Cmd() {
  const gb = new V163GraphBuilder();
  gb.rootSlash('roles', 'Xem toàn bộ Role Quyền Năng + lọc trạng thái đeo/vĩnh viễn/tạm thời', { ephemeral: false });
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
  gb.option('trang', 'int', 'Số trang muốn xem (1, 2, 3...)', {
    required: false,
    x: 980,
    y: 0,
  });

  embedMsg(gb, 'ro_ack', {
    title: `${uidEm('su_medal_role')} Đang mở Kho Role Quyền Năng...`,
    description: 'Đang kiểm kê toàn bộ Role Quyền Năng và thời hạn của {user_displayName}...',
    color: '#a855f7',
    target: { reply: true },
    editId: 'ro_ack',
  }, { x: 0, y: 160 });
  gb.link('root', 'ro_ack');

  apiAction(gb, 'ro_api', 'ro_res', 'GET',
    `${BACKEND_BASE}/api/roles/{user_id}?filter={option_loc}&sort={option_sap_xep}&page={option_trang}&username={encode_text[{user_displayName}]}&avatar={encode_text[{user_icon}]}`,
    '', { x: 0, y: 320 });
  gb.link('ro_ack', 'ro_api');

  const roNoAck = attachAckBranchV163(gb, 'ro', 'ro_api', 'ro_res', { editId: 'ro_ack', x: 0, y: 480 });
  embedMsg(gb, 'ro_edit_0', {
    title: `${uidEm('su_medal_role')} KHO ROLE QUYỀN NĂNG CỦA {ro_res.response.user.username}`,
    description: '{ro_res.response.filter_summary}\n\n{ro_res.response.summary}',
    color: '#a855f7',
    footer: '',
    target: { editId: 'ro_ack' },
    action_id: 'ro_ack',
  }, { x: 240, y: 680 });
  gb.link(roNoAck, 'ro_edit_0');

  let seq = 0;
  function attachPager(parentMsgId, prevResVar, depth, x, y) {
    if (depth >= 3) return;
    for (const c of [
      { key: 'prev', label: 'Trang Trước', icon: 'su_arrow_left', weight: '1', pageExpr: `{${prevResVar}.response.prev_page}`, dx: -160 },
      { key: 'next', label: 'Trang Sau', icon: 'su_arrow_right', weight: '2', pageExpr: `{${prevResVar}.response.next_page}`, dx: 160 },
    ]) {
      seq += 1;
      const bId = `btn_ro_${c.key}_${seq}`;
      const aId = `api_ro_${c.key}_${seq}`;
      const rVar = `ro_pres_${seq}`;
      const mId = `msg_ro_${c.key}_${seq}`;
      gb.advBtn(bId, parentMsgId, btnCfg(c.label, 'SECONDARY', c.icon, '1', c.weight, 'hide'), { x: x + c.dx, y: y + 140 });
      apiAction(gb, aId, rVar, 'GET',
        `${BACKEND_BASE}/api/roles/{user_id}?filter={${prevResVar}.response.filter}&sort={${prevResVar}.response.sort}&page=${c.pageExpr}&username={encode_text[{user_displayName}]}&avatar={encode_text[{user_icon}]}`,
        '', { x: x + c.dx, y: y + 290 });
      gb.link(bId, aId);
      embedMsg(gb, mId, {
        title: `${uidEm('su_medal_role')} KHO ROLE QUYỀN NĂNG CỦA {${rVar}.response.user.username}`,
        description: `{${rVar}.response.filter_summary}\n\n{${rVar}.response.summary}`,
        color: '#a855f7',
        footer: '',
        target: { editId: 'ro_ack' },
        action_id: 'ro_ack',
      }, { x: x + c.dx, y: y + 440 });
      gb.link(aId, mId);
      attachPager(mId, rVar, depth + 1, x + c.dx, y + 580);
    }
  }

  attachPager('ro_edit_0', 'ro_res', 0, 240, 680);
  return gb.elements();
}

// ============================================================================
// 5. /updates (v1.6.1 -> +1.500 LT)
// ============================================================================
export function buildUpdatesV163Cmd() {
  const gb = new V163GraphBuilder();
  gb.rootSlash('updates', 'Xem bản cập nhật mới nhất (v1.6.1 +1.500 LT) và lịch sử cập nhật', { ephemeral: false });
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

  const verOpts = [
    { label: 'Phiên bản v1.6.1 (Mới nhất • +1.500 LT)', description: 'Lò Luyện Đan 6 mẻ/ngày, /farm 8 ô, /inv 3 Loadouts', emoji_id: uidId('su_el_hoa', 'su_sparkle'), value: '1.6.1' },
    { label: 'Phiên bản v1.6 (+1.000 LT)', description: 'Đổ Thạch (/dothach), Gieo Quẻ (/gieoque), 3 Luck Potion & /nhiemvu mới', emoji_id: uidId('su_sparkle'), value: '1.6' },
    { label: 'Phiên bản v1.5.2 (+500 LT)', description: 'Chuẩn hóa thuật ngữ, /wiki Linh Vực & Từ Điển, /farm DM & EXP +30%', emoji_id: uidId('su_wiki_scroll'), value: '1.5.2' },
    { label: 'Phiên bản v1.5.1 (Hotfix)', description: 'Sửa lỗi lưu Role Gacha, Phân trang Trang 1/2/3 & Đền bù +1.000 LT', emoji_id: uidId('su_medal_role'), value: '1.5.1' },
    { label: 'Phiên bản v1.5 (Big Update)', description: 'Cân bằng PvE, +550% Pet, Khắc Ấn mới, Buff SET, Pity 350 & Quà +2.000 LT', emoji_id: uidId('su_sparkle'), value: '1.5' },
    { label: 'Phiên bản v1.4.7', description: 'AutoSell, Tháp 500 tầng, Web Battle Logs 48h & Wiki rút gọn', emoji_id: uidId('su_gacha_dice'), value: '1.4.7' },
    { label: 'Phiên bản v1.4.5', description: 'Lệnh /exp Boost Chat/Voice, Role Gradient 2 màu & cân bằng', emoji_id: uidId('su_level_up'), value: '1.4.5' },
    { label: 'Phiên bản v1.4', description: 'Đạo Áp, Shop Ngày, Chiếm Đoạt Linh Mạch & Khám Phá 12 Map', emoji_id: uidId('explorer_world_map_v14'), value: '1.4' },
    { label: 'Phiên bản v1.3.1', description: 'Linh Vực trên /profile & /battle, Emoji 5 Vực & Kho Linh Thú', emoji_id: uidId('su_realm_star'), value: '1.3.1' },
    { label: 'Phiên bản v1.3', description: 'Linh Vực, 50 Pet, 100 Pháp Bảo, Minigame, Nông Trại /farm & /exchange', emoji_id: uidId('su_thunder_hax'), value: '1.3' },
    { label: 'Phiên bản v1.2', description: 'Khắc Ấn D->S, 6 Việc Làm /job, Tháp Thí Luyện & Túi Đồ /inv mới', emoji_id: uidId('su_enchant_anvil'), value: '1.2' },
    { label: 'Phiên bản v1.1', description: 'Mở rộng Gacha, /info, /phapbao, Thẻ Reset Tháp & cân bằng', emoji_id: uidId('su_wiki_scroll'), value: '1.1' },
  ];

  let curMsgId = 'upds_msg_0';
  for (let k = 1; k <= 7; k += 1) {
    const prevIdx = k - 1;
    const baseY = 400 + k * 540;
    const selId = `sel_upds_${prevIdx}`;
    const varName = `picked_upd_ver_${prevIdx}`;
    const apiId = `upds_ver_api_${k}`;
    const resName = `upds_vres_${k}`;
    const msgId = `upds_msg_${k}`;

    gb.advSelectMenu(selId, curMsgId, {
      placeholder: 'Chọn phiên bản để xem ngay trên bảng này (v1.6.1 -> v1.1)...',
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
// 6. AI MENTION & GLOBAL ACK GATE SWEEP (+1.500 LT)
// ============================================================================
function buildV163KnowledgeBlock(includeFuyumiSecret) {
  const lines = [
    'KIẾN THỨC CHÍNH THỨC TOÀN BỘ HỆ THỐNG BOT NHIỄM NHIỄM (SUMI FAMILY TỪ v1.1 ĐẾN v1.6.1/v1.6.3):',
    '• [CẢNH GIỚI & EXP] (/profile, /rank, /exp, /doiqua, /top): 7 Đại Cảnh Giới từ Lv.1→Lv.100 mở dần 1→5 Slot Role. Chat nhận 23–35 EXP/45s, Voice nhận 85–135 EXP/5 phút; công thức lên cấp 78*(Lv^1.45) (max 500.000 EXP), lên cấp mới thưởng +50..+400 LT. Top Chat Ngày & Top Voice Ngày tự động trao 500 / 400 / 300 LT lúc 00:00 (UTC+7), 19:00 Chủ Nhật tổng kết Top Tuần Lực Chiến.',
    '• [TÚI ĐỒ NGANG & 3 LOADOUT /inv] (/inv, /linhthu, /pet, /phapbao, /linhvuc, /roles, /equip, /unequip, /enchant, /dismantle): /inv hiển thị ngang 2×3 kèm 3 nút Bộ 1 / Bộ 2 / Bộ 3 tự động lưu trọn bộ Linh Thú + 3 Pháp Bảo + Linh Vực/Thần Thức/Thần Cảnh mỗi khi dùng /equip, /unequip, /pet, /linhvuc (lần đầu mở Bộ 2/3 giữ nguyên Linh Thú và tháo Pháp Bảo/Lãnh Địa để tự phối bộ). Khắc Ấn /enchant D→S (+0/+8/+18/+32/+50%). Buff SET 4/5 món.',
    '• [GACHA, LUCK POTION & ĐỔ THẠCH] (/roll, /dothach, /autosell, /shop, /info): /roll (50 LT/lượt, 450/10, Pity 350 tách riêng pet/equipment/domain). /shop có 3 Lọ Luck Potion (+20%/+40%/+60% Luck cho /roll & /dothach). /dothach (4 phân khúc Phàm/Linh/Tiên/Thần Thoại, 40 loài Nguyên Thạch, không Pity).',
    '• [LÒ LUYỆN ĐAN /luyendan] (Mới v1.6.1/v1.6.3): Giao diện ngang 2 Lò song song (mỗi Lò 1 Dropdown chọn đan riêng), tối đa 6 mẻ/ngày (UTC+7). Lò #2 tự mở ở Lv.45 hoặc trả 2.500 LT. Nâng cấp Lò Lv.1→Lv.5 (+6%..+25% LT, giảm 5%..20% giờ, ân hạn 20p→60p, tăng tỉ lệ Thượng Phẩm ×1.25 / Đan Vân ×1.50). 6 công thức (vốn 14–84 LT; Tinh Hoa I/II dùng 28–56 Linh Quả từ /farm). Quá ân hạn cháy còn 30 LT + nổ khóa lò 4h (Sửa nhanh 300 LT); Bot tự DM nhắc chín & trước nổ 10p.',
    '• [NÔNG TRẠI 8 Ô, GIEO QUẺ & NHIỆM VỤ] (/farm, /exchange, /gieoque, /nhiemvu, /explorer, /job, /daily, /marry, /giatoc, /wiki, /updates): /farm mở rộng tối đa 8 ô (4 Linh Điền + 4 Linh Các, mở ô #5–#8 tại /exchange 300 LQ/ô), giá hạt/trứng 88–825 LT, DM nhắc tưới & sắp héo 1h/30p/15p. /gieoque 1 lần/ngày (6 bậc Khí Vận). /nhiemvu gộp Ngày + Tuần + Tháp 500 Tầng. Bản cập nhật /updates v1.6.1 tặng ngay +1.500 LT khi bấm Xác Nhận.',
  ];
  if (includeFuyumiSecret) {
    lines.push('• [BỘ TỐI THƯỢNG ĐỘC TÔN CỦA TIỂU THƯ FUYUMI]: Tiểu thư sở hữu Cửu Vĩ Hồng Hồ (cuu_vi_hong_ho), Viền Cửu Vĩ Hồng Mông Ấn (frame_kitsune_mythic) cùng Linh Vực Cửu Vĩ Hồng Mông (Đạo Áp 3 hiệp +30%), Thần Thức Thái Thượng Hồng Hồ và Thần Cảnh Vạn Cổ Tuyệt Diệt.');
  }
  return lines.join('\n');
}

function updateAiPromptTextV163(oldPrompt, includeFuyumiSecret) {
  let text = String(oldPrompt || '');
  text = text.replace(/tài liệu(?: hệ thống)? v1\.[0-9]+(?:\.[0-9]+)? bên dưới/g, 'tài liệu hệ thống v1.6.1 bên dưới');
  const startMatch = text.match(/KIẾN THỨC CHÍNH THỨC (?:TOÀN BỘ )?HỆ THỐNG BOT NHIỄM NHIỄM/);
  const sIdx = startMatch ? startMatch.index : -1;
  const endMarker = '\n\nBỘ DANH SÁCH EMOTE ĐỘNG DISCORD CHÍNH THỨC:';
  const eIdx = text.indexOf(endMarker);
  if (sIdx === -1 || eIdx === -1 || eIdx <= sIdx) {
    throw new Error(`Could not locate knowledge markers inside AI prompt (s=${sIdx}, e=${eIdx})`);
  }
  return text.slice(0, sIdx) + buildV163KnowledgeBlock(includeFuyumiSecret) + text.slice(eIdx);
}

function sweepTreeV163(tree) {
  const walk = (obj) => {
    if (typeof obj === 'string') {
      return obj
        .replace(/(?:Tôi Đã Đọc & )?Xác Nhận(?: Cập Nhật)? \(\+[\d.,]+ LT\)/g, 'Tôi Đã Đọc & Xác Nhận (+1.500 LT)')
        .replace(/Cập nhật (?:SuMi )?v1\.[0-9]+(?:\.[0-9]+)?/g, 'Cập nhật v1.6.1');
    }
    if (Array.isArray(obj)) return obj.map(walk);
    if (obj && typeof obj === 'object') {
      const out = {};
      for (const [k, v] of Object.entries(obj)) out[k] = walk(v);
      return out;
    }
    return obj;
  };
  return walk(tree);
}

function validateTreeStrict(els, label) {
  assertAcyclicDAG(els, label);
  assertUniqueApiActionNames(els, label);
  assertSelectLimitsAndRegex(els, label);
  const v = validateGraph(els);
  if (v && (v.ok === false || v.valid === false || (Array.isArray(v.errors) && v.errors.length > 0))) {
    throw new Error(`validateGraph failed for ${label}: ${JSON.stringify(v)}`);
  }
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
        .filter(e => e && e.name && e.compressed_tree)
        .map(e => ({ id: e.id || e.int_id, int_id: e.int_id || e.id, name: e.name, enabled: e.enabled !== false, compressed_tree: e.compressed_tree })),
    });
  })()`, 30000);
  return JSON.parse(raw);
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const onlyArg = args.find((a) => a.startsWith('--only='));
  const onlySet = onlyArg ? new Set(onlyArg.slice(7).split(',').map((s) => s.trim().toLowerCase())) : null;
  const shouldRun = (k) => !onlySet || onlySet.has(k);

  console.log(`\n============================================================`);
  console.log(`SuMi Family Ver 1.6.3 BotGhost Deployer (${dryRun ? 'DRY RUN' : 'LIVE CDP'})`);
  console.log(`============================================================\n`);

  const specs = [];
  const builders = [
    ['luyendan', buildLuyendanV163Cmd],
    ['inv', buildInvV163Cmd],
    ['linhvuc', buildLinhVucV163Cmd],
    ['phapbao', buildPhapBaoV163Cmd],
    ['roles', buildRolesV163Cmd],
    ['updates', buildUpdatesV163Cmd],
  ];

  for (const [name, fn] of builders) {
    if (!shouldRun(name)) continue;
    const els = fn();
    validateTreeStrict(els, name);
    specs.push({ name, kind: 'slash', groupId: PROFILE_GROUP_ID, elements: els });
  }

  if (dryRun) {
    for (const sp of specs) {
      const json = JSON.stringify(sp.elements);
      const comp = LZString.compressToBase64(json);
      console.log(`[DRY-RUN OK] ${sp.name}: ${sp.elements.length} els, ${(json.length / 1024).toFixed(1)} KB -> ${(comp.length / 1024).toFixed(1)} KB LZ`);
    }
    console.log('\n[DRY-RUN] Structural validation PASSED!');
    return;
  }

  const liveState = await fetchAllLiveReduxState();
  const cmdMap = new Map(liveState.cmds.map((c) => [c.name, c]));

  if (shouldRun('ai')) {
    const aiEv = liveState.events.find((e) => e.int_id === AI_MENTION_INT_ID || e.id === AI_MENTION_INT_ID);
    if (!aiEv) throw new Error(`AI Mention event ${AI_MENTION_INT_ID} not found`);
    const tree = JSON.parse(LZString.decompressFromBase64(aiEv.compressed_tree));
    let updatedCount = 0;
    for (const el of tree) {
      const rawBody = el?.data?.data?.request_options?.rawBody;
      if (el.type === 'action' && el.data?.data?.type === 'api_action' && typeof rawBody === 'string' && rawBody.includes('KIẾN THỨC CHÍNH THỨC')) {
        const parsed = JSON.parse(rawBody);
        const curText = parsed?.systemInstruction?.parts?.[0]?.text;
        if (typeof curText === 'string' && /KIẾN THỨC CHÍNH THỨC/.test(curText)) {
          const includeFuyumi = /Fuyumi|Cửu Vĩ Hồng Hồ/i.test(curText);
          parsed.systemInstruction.parts[0].text = updateAiPromptTextV163(curText, includeFuyumi);
          el.data.data.request_options.rawBody = JSON.stringify(parsed);
          updatedCount += 1;
        }
      }
    }
    if (updatedCount === 0) throw new Error('No AI prompt blocks updated');
    specs.push({ name: aiEv.name, kind: 'event', int_id: AI_MENTION_INT_ID, elements: tree });
  }

  if (shouldRun('sweep')) {
    const skipNames = new Set([
      'luyendan', 'inv', 'linhvuc', 'phapbao', 'roles', 'updates', 'wiki', 'info', 'exp',
      'giveaway_create', 'giveaway_end', 'giveaway_list', 'giveaway_cancel', 'giveaway_check',
      'play', 'queue', 'music', 'sound', 'sticky-set', 'sticky-off',
    ]);
    for (const [cmdName, cmdObj] of cmdMap.entries()) {
      if (skipNames.has(cmdName) || !cmdObj.enabled) continue;
      const oldTree = JSON.parse(LZString.decompressFromBase64(cmdObj.compressed_tree));
      const newTree = sweepTreeV163(oldTree);
      if (JSON.stringify(oldTree) !== JSON.stringify(newTree)) {
        validateTreeStrict(newTree, `sweep:${cmdName}`);
        specs.push({ name: cmdName, kind: 'slash', groupId: cmdObj.groupId || PROFILE_GROUP_ID, elements: newTree });
      }
    }
  }

  console.log(`Deploying ${specs.length} command/event updates via Edge CDP...`);
  for (const sp of specs) {
    console.log(`\n--> Deploying ${sp.kind}:${sp.name} (${sp.elements.length} elements)...`);
    const res = await deployViaCDP({
      groupId: sp.groupId || PROFILE_GROUP_ID,
      mode: sp.kind === 'event' ? 'event' : 'command',
      name: sp.name,
      elements: sp.elements,
      enabled: true,
    });
    console.log(`    [RESULT] ${sp.name}`, JSON.stringify(res || {}));
    if (!res?.ok) {
      throw new Error(`Deploy failed for ${sp.name}: ${JSON.stringify(res)}`);
    }
    if (res.builderSaveRequired) {
      throw new Error(`builderSaveRequired still true after deploying ${sp.name}`);
    }
  }
  console.log('\n[DONE] All Ver 1.6.3 BotGhost updates deployed cleanly!');
}

main().catch((err) => {
  console.error('[deploy_v1_6_3_ux_botghost] FAILED:', err);
  process.exit(1);
});
