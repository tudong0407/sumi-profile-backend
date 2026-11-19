import WebSocket from 'ws';
import LZString from 'lz-string';

async function main() {
  const tabs = await fetch('http://127.0.0.1:9222/json').then(r => r.json());
  const bg = tabs.find(t => t.url?.includes('botghost.com'));
  const ws = new WebSocket(bg.webSocketDebuggerUrl);
  await new Promise(r => ws.on('open', r));

  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 1000000);
    const h = (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.id === id) {
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
      function search(fiber) {
        if (!fiber) return;
        if (fiber.memoizedProps?.store) store = fiber.memoizedProps.store;
        search(fiber.child);
        search(fiber.sibling);
      }
      search(root[key]);
      
      const st = store ? store.getState() : null;
      const slashCmds = st?.data?.bot?.commands?.slash?.commands || [];
      const pet = slashCmds.find(c => c.name === 'pet');
      return pet ? pet.compressed_tree : null;
    })()`,
    returnByValue: true
  });

  const petElements = JSON.parse(LZString.decompressFromBase64(res.result.value));
  const interestingIds = ['condition_23_8c6e_f6ae', '$else_23_e03d_560b', 'conChild26_e7d6'];
  const nodes = petElements.filter(e => interestingIds.includes(e.id));
  console.log('Nodes:', JSON.stringify(nodes, null, 2));

  ws.close();
}

main().catch(console.error);
