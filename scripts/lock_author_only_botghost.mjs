/**
 * scripts/lock_author_only_botghost.mjs
 * Khóa quyền tương tác (who_can_press: 'user') cho các lệnh cá nhân trên BotGhost qua Edge CDP (9222):
 * - Chỉ người gọi lệnh mới bấm được Button / chọn Dropdown trên bảng của mình.
 * - Các lệnh cộng đồng/đối kháng (giveaway_create, marry, battle, music, staff) giữ nguyên 'anyone'.
 * - Các lệnh bán tương tác (linhmach, party) chỉ khóa nút hành động riêng / ack, giữ nguyên nút Nhận Mời / Xem Log.
 *
 * Usage:
 *   node scripts/lock_author_only_botghost.mjs --dry-run
 *   node scripts/lock_author_only_botghost.mjs --only=inv
 *   node scripts/lock_author_only_botghost.mjs --skip=luyendan,inv
 */

import WebSocket from 'ws';
globalThis.WebSocket = WebSocket;

import LZString from 'lz-string';
import { cdpEval, deployViaCDP } from './ga_builder_lib.mjs';

export const AUTHOR_ONLY_MSG = 'Chỉ người gọi lệnh mới được thao tác trên bảng này! Hãy tự gọi lệnh của bạn nhé.';

export const FULL_LOCK_COMMANDS = [
  'inv', 'luyendan', 'linhvuc', 'phapbao', 'roles', 'shop', 'farm', 'dothach',
  'gieoque', 'nhiemvu', 'explorer', 'linhthu', 'giatoc', 'wiki', 'updates',
  'blackjack', 'crash', 'job', 'divorce', 'daily', 'doiqua', 'roll', 'equip',
  'unequip', 'tangqua', 'dismantle', 'enchant', 'coinflip', 'slots', 'exchange',
  'autosell',
];

export const SELECTIVE_RULES = {
  linhmach: (node) => {
    if (node.type !== 'advMessageButton') return false;
    if (node.data?.data?.style === 'LINK') return false;
    return /^lm_btn_[123]$/.test(node.id) || /_gate_btn$/.test(node.id);
  },
  party: (node) => {
    if (node.type !== 'advMessageButton') return false;
    if (node.data?.data?.style === 'LINK') return false;
    return /^pt_btn_(lv|tr|kk)$/.test(node.id) || /_gate_btn$/.test(node.id);
  },
};

export function patchAuthorOnlyTree(cmdName, elements) {
  const isFull = FULL_LOCK_COMMANDS.includes(cmdName);
  const selectiveFn = SELECTIVE_RULES[cmdName];
  if (!isFull && !selectiveFn) return { changed: false, patchedCount: 0, elements };

  let patchedCount = 0;
  const next = elements.map((el) => {
    const isBtn = el.type === 'advMessageButton' && el.data?.data?.style !== 'LINK';
    const isSel = el.type === 'advMessageSelectMenu';
    if (!isBtn && !isSel) return el;

    const shouldLock = isFull ? true : selectiveFn(el);
    if (!shouldLock) return el;

    const cur = el.data?.data || {};
    if (cur.who_can_press === 'user' && cur.who_can_press_message === AUTHOR_ONLY_MSG) {
      return el;
    }

    patchedCount += 1;
    return {
      ...el,
      data: {
        ...el.data,
        data: {
          ...cur,
          who_can_press: 'user',
          who_can_press_message: AUTHOR_ONLY_MSG,
        },
      },
    };
  });

  return { changed: patchedCount > 0, patchedCount, elements: next };
}

async function fetchSlashCommands() {
  const raw = await cdpEval(`(() => {
    const root = document.querySelector('#root');
    if (!root) throw new Error('No #root (not on BotGhost tab?)');
    const rk = Object.keys(root).find(k => k.startsWith('__reactContainer') || k.startsWith('__reactFiber'));
    let f = root[rk], store = null;
    const seen = new Set();
    const q = [f];
    while (q.length && !store) {
      const n = q.shift();
      if (!n || seen.has(n)) continue;
      seen.add(n);
      if (n.memoizedProps?.store?.getState?.()?.data?.bot?.commands?.slash) {
        store = n.memoizedProps.store;
        break;
      }
      if (n.child) q.push(n.child);
      if (n.sibling) q.push(n.sibling);
    }
    if (!store) throw new Error('BotGhost Redux store not found');
    const cmds = store.getState().data.bot.commands.slash.commands || [];
    return JSON.stringify(
      cmds
        .filter(c => c && c.name && c.compressed_tree)
        .map(c => ({ name: c.name, enabled: c.enabled !== false, groupId: c.groupId || '1782127263978', compressed_tree: c.compressed_tree }))
    );
  })()`, 30000);
  return JSON.parse(raw);
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const onlyArg = args.find((a) => a.startsWith('--only='));
  const skipArg = args.find((a) => a.startsWith('--skip='));
  const onlySet = onlyArg ? new Set(onlyArg.slice(7).split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)) : null;
  const skipSet = skipArg ? new Set(skipArg.slice(7).split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)) : new Set();

  const targets = [...FULL_LOCK_COMMANDS, ...Object.keys(SELECTIVE_RULES)]
    .filter((name) => (!onlySet || onlySet.has(name)) && !skipSet.has(name));

  console.log(`\n============================================================`);
  console.log(`BotGhost Author-Only Lock (${dryRun ? 'DRY RUN' : 'LIVE CDP'}) — ${targets.length} commands`);
  console.log(`============================================================\n`);

  const liveCmds = await fetchSlashCommands();
  const byName = new Map(liveCmds.map((c) => [c.name, c]));

  const queue = [];
  for (const name of targets) {
    const cmd = byName.get(name);
    if (!cmd) {
      console.log(`[SKIP] ${name}: not found in Redux slash commands`);
      continue;
    }
    const els = JSON.parse(LZString.decompressFromBase64(cmd.compressed_tree));
    const { changed, patchedCount, elements } = patchAuthorOnlyTree(name, els);
    if (!changed) {
      console.log(`[ALREADY OK] ${name}: 0 changes needed`);
      continue;
    }
    console.log(`[PLAN] ${name}: lock ${patchedCount} components (${elements.length} total els)`);
    queue.push({ name, groupId: cmd.groupId, elements, enabled: cmd.enabled, patchedCount });
  }

  if (dryRun) {
    console.log(`\n[DRY-RUN] ${queue.length} commands queued for author-only lock.`);
    return;
  }

  for (const item of queue) {
    console.log(`\n--> Deploying ${item.name} (+${item.patchedCount} locked)...`);
    const res = await deployViaCDP({
      groupId: item.groupId,
      mode: 'command',
      name: item.name,
      elements: item.elements,
      enabled: item.enabled,
    });
    console.log(`    [RESULT] ${item.name}`, JSON.stringify(res || {}));
    if (!res?.ok || res?.builderSaveRequired) {
      throw new Error(`Deploy failed for ${item.name}: ${JSON.stringify(res)}`);
    }
  }

  console.log(`\n[DONE] Author-only lock applied cleanly to ${queue.length} commands!`);
}

main().catch((err) => {
  console.error('[lock_author_only_botghost] FAILED:', err);
  process.exit(1);
});
