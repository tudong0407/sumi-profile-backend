import WebSocket from 'ws';
import LZString from 'lz-string';

async function main() {
  const tabs = await fetch('http://127.0.0.1:9222/json').then(r => r.json());
  const bg = tabs.find(t => t.url?.includes('botghost.com'));
  if (!bg) {
    console.error('No BotGhost tab found!');
    process.exit(1);
  }
  const ws = new WebSocket(bg.webSocketDebuggerUrl);
  await new Promise(r => ws.on('open', r));

  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 1000000);
    const timeout = setTimeout(() => reject(new Error('CDP Timeout')), 20000);
    const h = (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.id === id) {
        clearTimeout(timeout);
        ws.off('message', h);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      }
    };
    ws.on('message', h);
    ws.send(JSON.stringify({ id, method, params }));
  });

  const res = await send('Runtime.evaluate', {
    expression: `(() => {
      const root = document.querySelector('#root');
      const key = Object.keys(root).find(k => k.startsWith('__reactContainer$'));
      let store = null;
      let cb = null;
      function search(fiber) {
        if (!fiber) return;
        if (fiber.memoizedProps?.store) store = fiber.memoizedProps.store;
        if (fiber.stateNode?.validateSave && fiber.stateNode?.buildCommand) cb = fiber.stateNode;
        search(fiber.child);
        search(fiber.sibling);
      }
      search(root[key]);

      const st = store?.getState();
      const slashCmds = st?.data?.bot?.commands?.slash?.commands || [];
      const currentUrl = window.location.href;

      return {
        currentUrl,
        hasCb: !!cb,
        lastSave: st?.data?.bot?.last_save,
        builderSaveRequired: st?.builder?.builderSaveRequired,
        slashCmds: slashCmds.map(c => ({
          name: c.name,
          description: c.description,
          hasTree: !!c.compressed_tree,
          compressedLen: c.compressed_tree?.length,
          compressed_tree: c.compressed_tree
        }))
      };
    })()`,
    returnByValue: true
  });

  const data = res.result?.value;
  console.log('Current URL:', data?.currentUrl);
  console.log('Has CommandBuilder mounted:', data?.hasCb);
  console.log('Last save:', data?.lastSave);
  console.log('builderSaveRequired:', data?.builderSaveRequired);
  console.log('Slash commands count:', data?.slashCmds?.length);

  for (const cmd of (data?.slashCmds || [])) {
    console.log(`\n=== Command: /${cmd.name} ===`);
    console.log(`Description: ${cmd.description}`);
    if (cmd.compressed_tree) {
      try {
        const decompressed = JSON.parse(LZString.decompressFromBase64(cmd.compressed_tree));
        console.log(`Nodes count: ${decompressed.length}`);
        for (const n of decompressed) {
          if (n.type === 'action') {
            console.log(`  [Action] id=${n.id}`);
            console.log(`    Content: "${n.data?.data?.message?.content}"`);
            const embeds = n.data?.data?.message?.embeds || [];
            embeds.forEach((emb, i) => {
              console.log(`    Embed[${i}] Title: "${emb.title}"`);
              console.log(`    Embed[${i}] Desc: "${emb.description}"`);
              console.log(`    Embed[${i}] Image URL: "${emb.image?.url}"`);
            });
          } else if (n.type === 'root') {
            console.log(`  [Root] name=${n.data?.title}, desc=${n.data?.description}`);
          } else if (n.type === 'option') {
            console.log(`  [Option] name=${n.data?.data?.name}, desc=${n.data?.data?.description}, type=${n.data?.data?.type}`);
          } else if (n.type === 'condition' || n.type === 'conditionChild') {
            console.log(`  [${n.type}] id=${n.id}`);
          }
        }
      } catch (e) {
        console.error('Error decompressing tree:', e.message);
      }
    }
  }

  ws.close();
}

main().catch(console.error);
