/**
 * scripts/patch_ai_cosmetic_buffs.mjs
 * Cập nhật tri thức Bot Nhiễm Nhiễm — AI Mention (4cc5db30-029c-4a55-86e6-6e6850012afd)
 * bổ sung Buff Viền Avatar & Ảnh Nền (+2%/+4%/+7%/+10% EXP & LT mỗi món, max +20%)
 * và phân trang Trang 1/2/3+. Không đụng /updates, không gửi thông báo.
 */

import WebSocket from 'ws';
globalThis.WebSocket = WebSocket;

import LZString from 'lz-string';
import { cdpEval, deployViaCDP, validateGraph } from './ga_builder_lib.mjs';

const AI_MENTION_INT_ID = '4cc5db30-029c-4a55-86e6-6e6850012afd';

const COSMETIC_KNOWLEDGE_SENTENCE =
  'Mỗi Viền Avatar & Ảnh Nền trong /shop đều cộng thêm Buff EXP & Linh Thạch khi trang bị (Phàm +2%, Linh +4%, Tiên +7%, Thần Thoại +10% EXP & LT mỗi món; đeo cả Viền + Ảnh Nền cộng dồn tối đa +20% EXP & +20% LT cho Chat/Voice EXP, /daily, /job, /explorer & Tháp; xem chi tiết qua /exp, /shop, /info).';

const PAGINATION_KNOWLEDGE_SENTENCE =
  '/roles, /phapbao, /linhvuc và /inv hỗ trợ phân trang Trang 1/2/3+ qua tham số trang và menu chọn trang tại chỗ.';

function updateSystemText(text) {
  let out = String(text || '');
  if (!out.includes('KIẾN THỨC CHÍNH THỨC')) return out;

  // Cập nhật mục [CẢNH GIỚI & EXP]
  if (!out.includes('Buff EXP & Linh Thạch khi trang bị')) {
    out = out.replace(
      /(\/exp xem tổng % Boost\.)/,
      `$1 ${COSMETIC_KNOWLEDGE_SENTENCE}`,
    );
  } else {
    out = out.replace(
      /Mỗi Viền Avatar & Ảnh Nền[^.]*\./,
      COSMETIC_KNOWLEDGE_SENTENCE.replace(/\.$/, '') + '.',
    );
  }

  // Cập nhật mục [GACHA, PITY 350 & CỬA HÀNG]
  if (!out.includes('hỗ trợ phân trang Trang 1/2/3+')) {
    out = out.replace(
      /(hoặc dùng \/equip\)\.)/,
      `$1 ${PAGINATION_KNOWLEDGE_SENTENCE}`,
    );
  }

  // Kiểm tra tuyệt đối không chứa emoji Unicode Windows
  const bad = out.match(/[\p{Extended_Pictographic}]/gu);
  if (bad) {
    throw new Error(`Windows Unicode pictograph found in AI prompt: ${[...new Set(bad)].join(' ')}`);
  }
  return out;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const events = await cdpEval(`(() => {
    const root = document.querySelector('#root');
    const rk = Object.keys(root).find(k => k.startsWith('__reactContainer') || k.startsWith('__reactFiber'));
    let f = root[rk], store = null;
    const seen = new Set();
    const walk = (n) => {
      if (!n || seen.has(n) || store) return;
      seen.add(n);
      if (n.memoizedProps?.store?.getState) { store = n.memoizedProps.store; return; }
      if (n.child) walk(n.child);
      if (n.sibling) walk(n.sibling);
    };
    walk(f);
    return store.getState().data.bot.commands.custom_events.events.map(e => ({
      name: e.name,
      int_id: e.int_id,
      groupId: e.groupId,
      enabled: e.enabled,
      compressed_tree: e.compressed_tree,
    }));
  })()`, 15000);

  const ev = events.find((e) => e.int_id === AI_MENTION_INT_ID || /AI Mention/i.test(e.name || ''));
  if (!ev) throw new Error('AI Mention event not found in BotGhost Redux');

  const tree = JSON.parse(LZString.decompressFromBase64(ev.compressed_tree) || '[]');
  let patchedCount = 0;
  for (const el of tree) {
    const ro = el?.data?.data?.request_options;
    if (!ro?.rawBody || !String(ro.url || '').includes('generativelanguage.googleapis.com')) continue;
    const bodyObj = JSON.parse(ro.rawBody);
    const sysText = bodyObj?.systemInstruction?.parts?.[0]?.text || '';
    if (!sysText.includes('KIẾN THỨC CHÍNH THỨC')) continue;
    const nextText = updateSystemText(sysText);
    if (nextText !== sysText) {
      bodyObj.systemInstruction.parts[0].text = nextText;
      ro.rawBody = JSON.stringify(bodyObj);
      patchedCount += 1;
    }
  }

  const errs = validateGraph(tree);
  if (errs.length) throw new Error(`validateGraph failed: ${errs.join(', ')}`);
  console.log(`[Offline OK] Event "${ev.name}": ${tree.length} els, patchedPrompts=${patchedCount}`);
  if (patchedCount === 0) {
    console.log('AI prompt already up to date.');
    return;
  }
  if (dryRun) return;

  const res = await deployViaCDP({
    groupId: ev.groupId,
    mode: 'event',
    name: ev.name,
    elements: tree,
    enabled: ev.enabled,
  });
  console.log('[Deployed AI Mention]:', JSON.stringify(res));
  if (!res?.ok) throw new Error(`Failed deploying AI Mention: ${JSON.stringify(res)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
