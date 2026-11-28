/**
 * scripts/deploy_v1_8_final_botghost.mjs
 * Chốt phát hành chính thức SuMi Family Ver 1.8 lên BotGhost Dashboard qua Edge CDP (9222):
 *   1. /updates     — Đặt v1.8 (+1.500 LT • +200 LQ • +3 Thanh Tâm Đan • +1 Tạo Hóa Đan) lên đầu (12 mốc v1.8..v1.1).
 *   2. /wiki        — Đồng bộ v1.8 (/pet Thiện Cảm, /upgrade EXP, 41 Viền Chân Thần, Loadout Sync).
 *   3. AI Mention   — Chuẩn hóa tài liệu sang v1.8.
 *   4. Global Sweep — Cập nhật nút Cổng Xác Nhận Cập Nhật trên toàn bộ ~39 lệnh sang "Xác Nhận v1.8 (+Quà)".
 *
 * Usage:
 *   node scripts/deploy_v1_8_final_botghost.mjs --dry-run
 *   node scripts/deploy_v1_8_final_botghost.mjs
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

const PROFILE_GROUP_ID = '1782127263978';
const BACKEND_BASE = 'https://sumi-profile-backend.onrender.com';
const AI_MENTION_INT_ID = '4cc5db30-029c-4a55-86e6-6e6850012afd';
const AUTHOR_ONLY_MSG = 'Chỉ người gọi lệnh mới được thao tác trên bảng này! Hãy tự gọi lệnh của bạn nhé.';
const ACK_BTN_LABEL_V18 = 'Xác Nhận v1.8 (+Quà)';

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

class V18FinalGraphBuilder extends GraphBuilder {
  advSelectMenu(id, parentMsgId, {
    placeholder,
    customVariableName,
    basic_options,
    row = '1',
    weight = '1',
    showReplies = 'show',
    who_can_press = 'user',
    who_can_press_message = AUTHOR_ONLY_MSG,
  }, { x = 0, y = 0 } = {}) {
    if (!Array.isArray(basic_options) || basic_options.length === 0 || basic_options.length > 25) {
      throw new Error(`Select menu "${id}" must have 1..25 options`);
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
          ...(who_can_press ? { who_can_press, who_can_press_message } : {}),
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
        jsonSafeVariables: true,
        ...(isPost ? { bodyMode: 'raw', contentType: 'application/json' } : {}),
        failOnError: false,
      },
    },
  }, pos);
}

function embedMsg(gb, id, {
  title = '',
  description = '',
  color = '#ec4899',
  footer = '',
  fields = [],
  ephemeral = false,
  target = { reply: true },
  action_id = '',
  editId = '',
} = {}, pos = { x: 0, y: 0 }) {
  return gb.act(id, 'advanced_message', {
    messageType: 'basic',
    useComponentsV2: false,
    ephemeral,
    ...(action_id ? { action_id } : {}),
    ...(editId ? { editId } : {}),
    target,
    message: {
      content: '',
      embeds: [{
        title: title || '',
        description: description || '',
        color,
        timestamp: false,
        author: { name: '', iconURL: '', url: '' },
        footer: footer ? { text: footer, iconURL: '' } : { text: '', iconURL: '' },
        image: { url: '' },
        thumbnail: { url: '' },
        fields,
      }],
    },
  }, pos);
}

function btnCfg(label, style, emojiKey, row = '1', weight = '1', showReplies = 'hide', whoCanPress = 'user') {
  const emoji_id = emojiKey ? uidId(emojiKey, 'su_sparkle') : '';
  return {
    label,
    style,
    emoji_id: emoji_id || undefined,
    row: String(row),
    weight: String(weight),
    orderComponent: true,
    showReplies,
    who_can_press: whoCanPress,
    ...(whoCanPress === 'user' ? { who_can_press_message: AUTHOR_ONLY_MSG } : {}),
  };
}

export function buildUpdatesV18Cmd() {
  const gb = new V18FinalGraphBuilder();
  gb.rootSlash('updates', 'Xem bản cập nhật mới nhất (v1.8 • +1.5k LT & Đan) và lịch sử cập nhật', { ephemeral: false });
  gb.errorHandlerWait();

  apiAction(gb, 'upds_api', 'upds_res', 'GET', `${BACKEND_BASE}/api/update?page=1`, '', { x: 0, y: 200 });
  gb.link('root', 'upds_api');

  embedMsg(gb, 'upds_msg_0', {
    title: '{upds_res.response.title}',
    description: '{upds_res.response.description}',
    color: '#ec4899',
    footer: '',
    target: { reply: true },
    editId: 'upds_msg_0',
  }, { x: 0, y: 380 });
  gb.link('upds_api', 'upds_msg_0');

  gb.advBtn('btn_upds_p1', 'upds_msg_0', btnCfg('Trang 1/2', 'SECONDARY', 'pet_act_hug', '1', '3', 'hide'), { x: -480, y: 540 });
  apiAction(gb, 'upds_p1_api', 'upds_p1_res', 'GET', `${BACKEND_BASE}/api/update?version=1.8&page=1`, '', { x: -480, y: 720 });
  gb.link('btn_upds_p1', 'upds_p1_api');
  embedMsg(gb, 'upds_p1_msg', {
    title: '{upds_p1_res.response.title}',
    description: '{upds_p1_res.response.description}',
    color: '#ec4899',
    target: { editId: 'upds_msg_0' },
    action_id: 'upds_msg_0',
  }, { x: -480, y: 900 });
  gb.link('upds_p1_api', 'upds_p1_msg');

  gb.advBtn('btn_upds_p2', 'upds_msg_0', btnCfg('Trang 2/2', 'SECONDARY', 'upgrade_exp_orb', '1', '2', 'hide'), { x: -200, y: 540 });
  apiAction(gb, 'upds_p2_api', 'upds_p2_res', 'GET', `${BACKEND_BASE}/api/update?version=1.8&page=2`, '', { x: -200, y: 720 });
  gb.link('btn_upds_p2', 'upds_p2_api');
  embedMsg(gb, 'upds_p2_msg', {
    title: '{upds_p2_res.response.title}',
    description: '{upds_p2_res.response.description}',
    color: '#ec4899',
    target: { editId: 'upds_msg_0' },
    action_id: 'upds_msg_0',
  }, { x: -200, y: 900 });
  gb.link('upds_p2_api', 'upds_p2_msg');

  apiAction(gb, 'upds_claim_api', 'upds_claim_res', 'POST', `${BACKEND_BASE}/api/update/ack`,
    '{"userId":"{user_id}","username":"{user_displayName}","avatarUrl":"{user_icon}"}', { x: 420, y: 540 });
  embedMsg(gb, 'upds_claim_msg', {
    title: `${uidEm('su_level_up')} QUÀ CẬP NHẬT v1.8`,
    description: '{upds_claim_res.response.message}',
    color: '#10b981',
    footer: '',
    target: { reply: true },
  }, { x: 420, y: 720 });
  gb.link('upds_claim_api', 'upds_claim_msg');

  gb.advBtn('btn_upds_claim_1', 'upds_msg_0', btnCfg('Nhận Quà v1.8 (+1.5k LT & Đan)', 'SUCCESS', 'su_linhthach', '1', '1', 'show'), { x: 240, y: 540 });
  gb.link('btn_upds_claim_1', 'upds_claim_api');

  const verOpts = [
    { label: 'Phiên bản v1.8 (Mới nhất • +1.5k LT & Đan)', description: 'Thiện Cảm /pet + AI Chat, Tự Thu Hoạch Farm, 41 Viền Chân Thần & /upgrade', emoji_id: uidId('pet_act_hug', 'su_sparkle'), value: '1.8' },
    { label: 'Phiên bản v1.7.1 (+800 LT)', description: 'Tháp +15% & T10 +10%, /linhmach 4 mỏ SS..SSS+, /daily x2, /thuongtra & /thaplinhhuong', emoji_id: uidId('tea_ceremony_pot', 'su_sparkle'), value: '1.7.1' },
    { label: 'Phiên bản v1.7 (Đại Cập Nhật)', description: 'Tiến Hóa Chân Thần (/tienhoa), +260 món, /shop_dacbiet Chủ Nhật', emoji_id: uidId('evo_crystal', 'su_sparkle'), value: '1.7' },
    { label: 'Phiên bản v1.6.1 (+1.500 LT)', description: 'Lò Luyện Đan 6 mẻ/ngày, /farm 8 ô, /inv 3 Loadouts', emoji_id: uidId('su_el_hoa', 'su_sparkle'), value: '1.6.1' },
    { label: 'Phiên bản v1.6 (+1.000 LT)', description: 'Đổ Thạch (/dothach), Gieo Quẻ (/gieoque), 3 Luck Potion & /nhiemvu mới', emoji_id: uidId('su_sparkle'), value: '1.6' },
    { label: 'Phiên bản v1.5.2 (+500 LT)', description: 'Chuẩn hóa thuật ngữ, /wiki Linh Vực & Từ Điển, /farm DM & EXP +30%', emoji_id: uidId('su_wiki_scroll'), value: '1.5.2' },
    { label: 'Phiên bản v1.5 (Big Update)', description: 'Cân bằng PvE, +550% Pet, Khắc Ấn mới, Buff SET, Pity 350 & Quà +2.000 LT', emoji_id: uidId('su_sparkle'), value: '1.5' },
    { label: 'Phiên bản v1.4.7', description: 'AutoSell, Tháp 500 tầng, Web Battle Logs 48h & Wiki rút gọn', emoji_id: uidId('su_gacha_dice'), value: '1.4.7' },
    { label: 'Phiên bản v1.4', description: 'Đạo Áp, Shop Ngày, Chiếm Đoạt Linh Mạch & Khám Phá 12 Map', emoji_id: uidId('explorer_world_map_v14'), value: '1.4' },
    { label: 'Phiên bản v1.3', description: 'Linh Vực, 50 Pet, 100 Pháp Bảo, Minigame, Nông Trại /farm & /exchange', emoji_id: uidId('su_thunder_hax'), value: '1.3' },
    { label: 'Phiên bản v1.2', description: 'Khắc Ấn D->S, 6 Việc Làm /job, Tháp Thí Luyện & Túi Đồ /inv mới', emoji_id: uidId('su_enchant_anvil'), value: '1.2' },
    { label: 'Phiên bản v1.1', description: 'Mở rộng Gacha, /info, /phapbao, Thẻ Reset Tháp & cân bằng', emoji_id: uidId('su_wiki_scroll'), value: '1.1' },
  ];

  gb.advSelectMenu('sel_upds_ver', 'upds_msg_0', {
    placeholder: 'Xem lại lịch sử các phiên bản (v1.8 .. v1.1)...',
    customVariableName: 'sel_upds_ver',
    basic_options: verOpts,
    row: '2',
    weight: '1',
    showReplies: 'hide',
  }, { x: 100, y: 740 });

  apiAction(gb, 'upds_hist_api', 'upds_hres', 'GET', `${BACKEND_BASE}/api/update?version={sel_upds_ver}&page=1`, '', { x: 100, y: 920 });
  gb.link('sel_upds_ver', 'upds_hist_api');
  embedMsg(gb, 'upds_hist_msg', {
    title: '{upds_hres.response.title}',
    description: '{upds_hres.response.description}',
    color: '#a855f7',
    footer: '',
    target: { editId: 'upds_msg_0' },
    action_id: 'upds_msg_0',
  }, { x: 100, y: 1100 });
  gb.link('upds_hist_api', 'upds_hist_msg');

  return gb.elements();
}

function sweepTreeV18(tree) {
  const walk = (obj) => {
    if (typeof obj === 'string') {
      return obj
        .replace(/Xác Nhận v1\.7\.1 \(\+800 LT\)/g, ACK_BTN_LABEL_V18)
        .replace(/Xác Nhận v1\.7 \(Nhận Gói Quà Lớn!\)/g, ACK_BTN_LABEL_V18)
        .replace(/Xác Nhận Cập Nhật v1\.7/g, ACK_BTN_LABEL_V18)
        .replace(/Cập nhật thành công lên v1\.7\.1/g, 'Cập nhật thành công lên v1.8')
        .replace(/Cập nhật thành công lên v1\.7/g, 'Cập nhật thành công lên v1.8');
    }
    if (Array.isArray(obj)) return obj.map(walk);
    if (obj && typeof obj === 'object') {
      for (const k of Object.keys(obj)) obj[k] = walk(obj[k]);
    }
    return obj;
  };
  return walk(tree);
}

function patchWikiTreeV18(oldTree) {
  const tree = sweepTreeV18(JSON.parse(JSON.stringify(oldTree)));
  for (const el of tree) {
    if (el.type === 'advMessageSelectMenu' && Array.isArray(el.data?.data?.basic_options)) {
      if (typeof el.data.data.placeholder === 'string') {
        el.data.data.placeholder = el.data.data.placeholder.replace(/v1\.7\.1\b/g, 'v1.8');
      }
      for (const opt of el.data.data.basic_options) {
        if (opt.value === 'overview') {
          opt.label = 'Tổng Quan & Toàn Bộ Lệnh (v1.8)';
          opt.description = '/pet Thiện Cảm & AI, /upgrade EXP, 41 Viền Chân Thần, /thuongtra & Linh Mạch SS+';
        } else if (opt.value === 'pets') {
          opt.description = '150 Pet, /upgrade EXP, /pet Thiện Cảm (41 Viền Chân Thần) & 40 Ultimate';
        } else if (opt.value === 'economy') {
          opt.label = 'Kinh Tế, Thiện Cảm, Trà Đạo & Tháp 500';
          opt.description = '/pet Tự Thu Hoạch, /upgrade, Shop Modal, /daily ×2, /thuongtra & Tháp +15%';
        }
      }
    } else if (el.data?.data?.type === 'advanced_message') {
      const s = JSON.stringify(el.data.data.message || {})
        .replace(/v1\.7\.1/g, 'v1.8');
      el.data.data.message = JSON.parse(s);
    }
  }
  return tree;
}

function updateAiPromptV18(oldText) {
  let text = String(oldText || '');
  text = text.replace(/v1\.8B/g, 'v1.8').replace(/v1\.8A/g, 'v1.8').replace(/v1\.7\.1/g, 'v1.8');
  text = text.replace(/\/updates v1\.8\b[^\n.]*/g, '/updates v1.8 tặng +1.500 LT, +200 Linh Quả, +3 Thanh Tâm Đan & +1 Tạo Hóa Đan');
  return text;
}

function validateTreeStrict(els, label) {
  for (const el of els) {
    if (el.type === 'advMessageSelectMenu') {
      const opts = el.data?.data?.basic_options || [];
      if (opts.length === 0 || opts.length > 25) {
        throw new Error(`Select menu "${el.id}" in ${label} has ${opts.length} options`);
      }
    }
    if (el.type === 'conditionChild') {
      const d = el.data?.data || {};
      if (d.type === 'matches_pattern') {
        const p = d.comparison_value ?? d.value;
        if (typeof p === 'string') validateRegexSafety(p, `${label}.${el.id}`);
      }
    }
  }
  const v = validateGraph(els);
  if (Array.isArray(v) && v.length > 0) {
    throw new Error(`validateGraph failed for ${label}: ${v.join('; ')}`);
  }
  if (v && !Array.isArray(v) && (v.ok === false || v.valid === false || (Array.isArray(v.errors) && v.errors.length > 0))) {
    throw new Error(`validateGraph failed for ${label}: ${JSON.stringify(v)}`);
  }
}

async function fetchLiveState() {
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
      cmds: Object.values(rawCmds).filter(c => c && c.name && c.compressed_tree)
        .map(c => ({ name: c.name, enabled: c.enabled !== false, groupId: c.groupId || '', compressed_tree: c.compressed_tree })),
      events: Object.values(rawEvents).filter(e => e && e.name && e.compressed_tree)
        .map(e => ({ id: e.id || e.int_id, int_id: e.int_id || e.id, name: e.name, enabled: e.enabled !== false, groupId: e.groupId || '', compressed_tree: e.compressed_tree })),
    });
  })()`, 30000);
  return JSON.parse(raw);
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  console.log(`\n============================================================`);
  console.log(`SuMi Family Ver 1.8 Final BotGhost Deployer (${dryRun ? 'DRY RUN' : 'LIVE CDP'})`);
  console.log(`============================================================\n`);

  if (dryRun) {
    const els = buildUpdatesV18Cmd();
    validateTreeStrict(els, 'updates');
    console.log(`[DRY-RUN OK] /updates: ${els.length} els`);
    return;
  }

  const liveState = await fetchLiveState();
  const cmdMap = new Map(liveState.cmds.map((c) => [c.name, c]));
  const specs = [];

  // 1. /updates
  const updEls = buildUpdatesV18Cmd();
  validateTreeStrict(updEls, 'updates');
  specs.push({ name: 'updates', kind: 'slash', groupId: PROFILE_GROUP_ID, enabled: true, elements: updEls });

  // 2. /wiki
  if (cmdMap.has('wiki')) {
    const oldWiki = JSON.parse(LZString.decompressFromBase64(cmdMap.get('wiki').compressed_tree));
    const newWiki = patchWikiTreeV18(oldWiki);
    validateTreeStrict(newWiki, 'wiki');
    specs.push({ name: 'wiki', kind: 'slash', groupId: cmdMap.get('wiki').groupId || PROFILE_GROUP_ID, enabled: cmdMap.get('wiki').enabled, elements: newWiki });
  }

  // 3. AI Mention
  const aiEv = liveState.events.find((e) => e.id === AI_MENTION_INT_ID || e.int_id === AI_MENTION_INT_ID);
  if (aiEv) {
    const aiTree = JSON.parse(LZString.decompressFromBase64(aiEv.compressed_tree));
    let patched = 0;
    for (const el of aiTree) {
      if (el.type === 'action' && el.data?.data?.type === 'api_action' && typeof el.data?.data?.request_options?.rawBody === 'string') {
        const raw = el.data.data.request_options.rawBody;
        if (!/KIẾN THỨC CHÍNH THỨC/.test(raw)) continue;
        const bodyObj = JSON.parse(raw);
        if (bodyObj?.systemInstruction?.parts?.[0]?.text) {
          bodyObj.systemInstruction.parts[0].text = updateAiPromptV18(bodyObj.systemInstruction.parts[0].text);
          el.data.data.request_options.rawBody = JSON.stringify(bodyObj);
          patched += 1;
        }
      }
    }
    if (patched > 0) {
      validateTreeStrict(aiTree, aiEv.name);
      specs.push({ name: aiEv.name, kind: 'event', groupId: aiEv.groupId || PROFILE_GROUP_ID, enabled: aiEv.enabled, elements: aiTree });
    }
  }

  // 4. Global Sweep ACK buttons across all commands
  const handled = new Set(specs.map((s) => `${s.kind}:${s.name}`));
  for (const c of liveState.cmds) {
    if (handled.has(`slash:${c.name}`)) continue;
    const oldTree = JSON.parse(LZString.decompressFromBase64(c.compressed_tree));
    const newTree = sweepTreeV18(JSON.parse(JSON.stringify(oldTree)));
    if (JSON.stringify(newTree) !== JSON.stringify(oldTree)) {
      validateTreeStrict(newTree, `sweep:${c.name}`);
      specs.push({ name: c.name, kind: 'slash', groupId: c.groupId || PROFILE_GROUP_ID, enabled: c.enabled, elements: newTree });
    }
  }

  console.log(`Deploying ${specs.length} BotGhost updates via Edge CDP...`);
  for (let i = 0; i < specs.length; i++) {
    const sp = specs[i];
    console.log(`[${i + 1}/${specs.length}] Deploying ${sp.kind} "${sp.name}" (${sp.elements.length} els)...`);
    const res = await deployViaCDP({
      groupId: sp.groupId || PROFILE_GROUP_ID,
      mode: sp.kind,
      name: sp.name,
      elements: sp.elements,
      enabled: sp.enabled ?? true,
    });
    if (!res?.ok) {
      throw new Error(`Deploy failed for ${sp.kind}:${sp.name} -> ${JSON.stringify(res)}`);
    }
    console.log(`  [OK] ${sp.kind}:${sp.name} | prob=${res.probText} | canSave=${res.canSave} | builderSaveRequired=${res.builderSaveRequired} | nodes=${res.savedSummary?.decompressedCount}`);
    if (i + 1 < specs.length) await new Promise((r) => setTimeout(r, 700));
  }
  console.log('\n[DONE] Ver 1.8 Final BotGhost deployed & verified cleanly!');
}

const isCli = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop());
if (isCli) {
  main().catch((err) => {
    console.error('[DEPLOY FAILED]', err);
    process.exit(1);
  });
}
