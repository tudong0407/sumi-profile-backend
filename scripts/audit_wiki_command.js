import WebSocket from 'ws';
import LZString from 'lz-string';

async function main() {
  const tabs = await fetch('http://127.0.0.1:9222/json').then(r => r.json());
  const bg = tabs.find(t => t.url?.includes('botghost.com'));
  const ws = new WebSocket(bg.webSocketDebuggerUrl);
  await new Promise(r => ws.on('open', r));

  const send = (method, params = {}) => new Promise((res, rej) => {
    const id = Math.floor(Math.random() * 1000000);
    const timeout = setTimeout(() => rej(new Error('CDP Timeout')), 15000);
    const h = (d) => {
      const m = JSON.parse(d.toString());
      if (m.id === id) {
        clearTimeout(timeout);
        ws.off('message', h);
        if (m.error) rej(m.error); else res(m.result);
      }
    };
    ws.on('message', h);
    ws.send(JSON.stringify({ id, method, params }));
  });

  const res = await send('Runtime.evaluate', {
    expression: `(() => {
      const root = document.querySelector('#root');
      const key = Object.keys(root).find(k => k.startsWith('__reactContainer$'));
      let cb = null;
      let store = null;
      function search(fiber) {
        if (!fiber) return;
        if (fiber.memoizedProps?.store) store = fiber.memoizedProps.store;
        if (fiber.stateNode?.validateSave) cb = fiber.stateNode;
        search(fiber.child);
        search(fiber.sibling);
      }
      search(root[key]);

      const st = store?.getState();
      const slashCmds = st?.data?.bot?.commands?.slash?.commands || [];
      const wiki = slashCmds.find(c => c.name === 'wiki');

      const problemSpans = Array.from(document.querySelectorAll('*'))
        .filter(el => el.children.length === 0 && (el.textContent.includes('problem') || el.textContent.includes('Problem')))
        .map(el => ({ tag: el.tagName, text: el.textContent.trim(), parent: el.parentElement?.innerText?.slice(0, 100) }));

      return {
        url: window.location.href,
        hasCb: !!cb,
        cbValidateSave: cb?.validateSave ? cb.validateSave() : null,
        problemTexts: problemSpans,
        builderSaveRequired: st?.builder?.builderSaveRequired,
        wikiInStore: wiki ? {
          id: wiki.id,
          name: wiki.name,
          description: wiki.description,
          options: wiki.options,
          hasCompressedTree: !!wiki.compressed_tree,
          compressedTreeLen: wiki.compressed_tree?.length
        } : null,
        compressed_tree_raw: wiki?.compressed_tree
      };
    })()`,
    returnByValue: true
  });

  const data = res.result?.value;
  console.log('Builder & Store Audit:', JSON.stringify({
    url: data.url,
    hasCb: data.hasCb,
    cbValidateSave: data.cbValidateSave,
    problemTexts: data.problemTexts,
    builderSaveRequired: data.builderSaveRequired,
    wikiInStore: data.wikiInStore
  }, null, 2));

  if (data.compressed_tree_raw) {
    const decompressed = LZString.decompressFromBase64(data.compressed_tree_raw);
    const parsed = JSON.parse(decompressed);
    console.log('\n--- DECOMPRESSED TREE SUMMARY ---');
    console.log('Is Array?', Array.isArray(parsed));
    const elements = Array.isArray(parsed) ? parsed : (parsed.elements || []);
    console.log('Total Elements:', elements.length);
    for (const el of elements) {
      console.log(`- Element [${el.id}] type=${el.type} source=${el.source} target=${el.target}`);
      if (el.id === 'root') {
        console.log('  Root data:', el.data?.title, '|', el.data?.description);
      }
      if (el.id === 'option_chuyen_muc') {
        console.log('  Option data:', el.data?.data?.name, '| choices:', el.data?.data?.choices);
      }
      if (el.id === 'action_wiki_reply') {
        const emb = el.data?.data?.message?.embeds?.[0];
        console.log('  Embed Title:', emb?.title);
        console.log('  Embed Color:', emb?.color);
        console.log('  Embed Fields Count:', emb?.fields?.length);
        console.log('  Embed Footer:', emb?.footer?.text);
      }
    }
  }

  ws.close();
}

main().catch(console.error);
