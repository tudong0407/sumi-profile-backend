/**
 * scripts/deploy_farm_reminders_botghost.mjs
 * Triển khai BotGhost cho Hệ Thống Nông Trại (/farm):
 * 1. Tạo / cập nhật Timed Event `SuMi — Farm DM Reminder (1m)` (Every 1 Minute: 6pgymlt0ixnnzpvpqjf0f)
 *    gọi `POST /api/farm/notifications/next` trong vòng lặp (tối đa 15 người/phút, chờ 2s giữa các lượt)
 *    và gửi DM trực tiếp tới người chơi (`target: { dm_user_id }`) khi tới giờ tưới hoặc sắp héo 1h / 30p / 15p.
 * 2. Đồng bộ nhẹ mô tả `/farm` trong `Nhiễm Nhiễm — AI Mention`.
 *
 * Usage:
 *   node scripts/deploy_farm_reminders_botghost.mjs [--dry-run]
 */

import WebSocket from 'ws';
globalThis.WebSocket = WebSocket;

import LZString from 'lz-string';
import {
  GraphBuilder,
  cdpEval,
  deployViaCDP,
  validateGraph,
} from './ga_builder_lib.mjs';

const SUMI_GUILD_ID = '1026096141273661450';
const PROFILE_GROUP_ID = '1782127263978';
const BACKEND_BASE = 'https://sumi-profile-backend.onrender.com';
const EVERY_1_MIN_TIMER_ID = '6pgymlt0ixnnzpvpqjf0f';
const AI_MENTION_INT_ID = '4cc5db30-029c-4a55-86e6-6e6850012afd';

function buildFarmDmReminderEvent() {
  const gb = new GraphBuilder();
  gb.rootEvent('SuMi — Farm DM Reminder (1m)', 'timedEvent', {
    timer_id: EVERY_1_MIN_TIMER_ID,
    guild_id: SUMI_GUILD_ID,
  });
  gb.errorHandlerWait();

  const lp = gb.loopCount('fm_dm_loop', '15', { x: 0, y: 240, timeout: '2' });
  gb.link('root', lp.loopId);

  gb.act('fm_dm_api', 'api_action', {
    name: 'fm_dm_res',
    ephemeral: false,
    request_options: {
      method: 'POST',
      url: `${BACKEND_BASE}/api/farm/notifications/next`,
      headers: [
        { key: 'Content-Type', value: 'application/json' },
        { key: 'x-api-key', value: '{SECRET_BACKEND_KEY}' },
      ],
      params: [],
      body: [],
      rawBody: '{}',
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
  }, { x: 220, y: 400 });
  gb.link(lp.actsId, 'fm_dm_api');

  const cHas = gb.cmp('fm_dm_has', '{fm_dm_res.response.has_notification}', 'true', 'equal_to', { ignoreCase: true }, { x: 220, y: 580 });
  gb.link('fm_dm_api', cHas.condId);

  gb.act('fm_dm_wait', 'wait_action', { seconds: '1', success_handles: false }, { x: 20, y: 760 });
  gb.link(cHas.yes, 'fm_dm_wait');

  gb.act('fm_dm_send', 'advanced_message', {
    messageType: 'basic',
    useComponentsV2: false,
    target: { dm_user_id: '{fm_dm_res.response.user_id}' },
    success_handles: true,
    message: {
      content: '',
      embeds: [{
        title: '{fm_dm_res.response.dm_title}',
        description: '{fm_dm_res.response.dm_description}',
        color: '{fm_dm_res.response.dm_color}',
        url: '',
        thumbnail: { url: '' },
        image: { url: '' },
        footer: { text: '', icon_url: '' },
      }],
    },
    components: [],
    componentsV2Data: null,
    reactions: '',
  }, { x: 20, y: 940 });
  gb.link('fm_dm_wait', 'fm_dm_send');

  gb.act('fm_dm_break', 'break_loop', { success_handles: false }, { x: 420, y: 760 });
  gb.link(cHas.no, 'fm_dm_break');

  return gb.elements();
}

function patchAiMentionFarmKnowledge(origTree) {
  const tree = JSON.parse(JSON.stringify(origTree));
  for (const el of tree) {
    const body = el.data?.data?.request_options?.rawBody || el.data?.data?.message?.content;
    if (el.type === 'action' && el.data?.data?.type === 'api_action' && typeof el.data?.data?.request_options?.rawBody === 'string') {
      const oldFragment = '/farm (4–6 ô trồng 6/12/24h) đổi Linh Quả ở /exchange';
      const newFragment = '/farm (tách 2 khu Linh Điền & Linh Các, 4–6 ô trồng 6/12/24h, Bot tự DM nhắc tới giờ tưới & cảnh báo héo 1h/30p/15p) đổi Linh Quả ở /exchange';
      if (el.data.data.request_options.rawBody.includes(oldFragment)) {
        el.data.data.request_options.rawBody = el.data.data.request_options.rawBody.replace(oldFragment, newFragment);
      }
    }
    if (typeof body === 'string' && body.includes('/farm (4–6 ô trồng 6/12/24h)') && el.data?.data?.message?.content) {
      el.data.data.message.content = el.data.data.message.content.replace(
        '/farm (4–6 ô trồng 6/12/24h) đổi Linh Quả ở /exchange',
        '/farm (tách 2 khu Linh Điền & Linh Các, 4–6 ô trồng 6/12/24h, Bot tự DM nhắc tới giờ tưới & cảnh báo héo 1h/30p/15p) đổi Linh Quả ở /exchange',
      );
    }
  }
  return tree;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const dmEls = buildFarmDmReminderEvent();
  const errs = validateGraph(dmEls);
  if (errs.length) throw new Error(`Offline validation failed: ${errs.join('; ')}`);
  console.log(`[Offline OK] SuMi — Farm DM Reminder (1m): ${dmEls.length} elements`);

  if (dryRun) return;

  const dmRes = await deployViaCDP({
    groupId: PROFILE_GROUP_ID,
    mode: 'event',
    name: 'SuMi — Farm DM Reminder (1m)',
    elements: dmEls,
    enabled: true,
  });
  console.log('[Deployed] SuMi — Farm DM Reminder (1m):', JSON.stringify(dmRes));
  if (!dmRes?.ok) throw new Error(`Failed deploying Farm DM Reminder: ${JSON.stringify(dmRes)}`);

  await new Promise((r) => setTimeout(r, 1500));

  const aiRaw = await cdpEval(`(() => {
    const rootEl = document.getElementById('root');
    const rk = Object.keys(rootEl).find(k => k.startsWith('__reactContainer'));
    let f = rootEl[rk], store = null, q = [f], seen = new Set();
    while (q.length) {
      const n = q.shift();
      if (!n || seen.has(n)) continue; seen.add(n);
      if (n.memoizedProps?.store?.getState) { store = n.memoizedProps.store; break; }
      if (n.child) q.push(n.child);
      if (n.sibling) q.push(n.sibling);
    }
    const ev = (store.getState().data.bot.commands.custom_events?.events || []).find(e => e.int_id === '${AI_MENTION_INT_ID}');
    return ev ? JSON.stringify({ name: ev.name, ct: ev.compressed_tree }) : '';
  })()`, 15000);

  if (aiRaw) {
    const aiInfo = JSON.parse(aiRaw);
    const patchedAi = patchAiMentionFarmKnowledge(JSON.parse(LZString.decompressFromBase64(aiInfo.ct) || '[]'));
    const aiRes = await deployViaCDP({
      groupId: PROFILE_GROUP_ID,
      mode: 'event',
      name: aiInfo.name,
      elements: patchedAi,
      enabled: true,
    });
    console.log('[Patched] AI Mention:', JSON.stringify(aiRes));
    if (!aiRes?.ok) throw new Error(`Failed patching AI Mention: ${JSON.stringify(aiRes)}`);
  }

  console.log('[deploy_farm_reminders_botghost] COMPLETE!');
}

main().catch((err) => {
  console.error('[deploy_farm_reminders_botghost] FATAL:', err);
  process.exit(1);
});
