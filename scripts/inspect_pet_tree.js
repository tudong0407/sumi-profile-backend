import http from 'http';
import WebSocket from 'ws';
import LZString from 'lz-string';

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

async function main() {
  const tabs = await getJson('http://127.0.0.1:9222/json');
  const bg = tabs.find(t => t.url?.includes('dashboard.botghost.com'));
  const ws = new WebSocket(bg.webSocketDebuggerUrl);
  await new Promise(r => ws.on('open', r));

  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = 12345;
    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.id === id) resolve(msg.result);
    });
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

      const cmds = store?.getState()?.data?.bot?.commands?.slash?.commands || [];
      const pet = cmds.find(c => c.name === 'pet');
      return {
        petCommand: {
          id: pet.id,
          name: pet.name,
          description: pet.description,
          options: pet.options,
          actions: pet.actions,
          hasTree: !!pet.compressed_tree,
          compressed_tree: pet.compressed_tree
        }
      };
    })()`,
    returnByValue: true
  });

  const petCmd = res.result?.value?.petCommand;
  if (petCmd?.compressed_tree) {
    const decompressed = LZString.decompressFromBase64(petCmd.compressed_tree);
    const elements = JSON.parse(decompressed);
    console.log('Pet elements count:', elements.length);
    console.log('Pet root node:', elements.find(e => e.id === 'root'));
    console.log('Pet option nodes:', elements.filter(e => e.type === 'option'));
    console.log('Pet edges from option:', elements.filter(e => e.source?.includes('option') || e.target?.includes('option')));
    console.log('First 2 action nodes:', elements.filter(e => e.type === 'action').slice(0, 2));
  }

  ws.close();
}

main().catch(console.error);
