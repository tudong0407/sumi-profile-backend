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
      const interestingNames = ['pet', 'warn', 'getorder', 'mute', 'checkwarn'];
      const found = slashCmds.filter(c => interestingNames.includes(c.name));
      return found.map(c => ({
        name: c.name,
        compressed_tree: c.compressed_tree
      }));
    })()`,
    returnByValue: true
  });

  const commands = res.result.value;
  for (const cmd of commands) {
    if (cmd.compressed_tree) {
      const decompressed = LZString.decompressFromBase64(cmd.compressed_tree);
      console.log(`\n=================== COMMAND: ${cmd.name} ===================`);
      // Find all options and action blocks
      const elements = JSON.parse(decompressed);
      for (const el of elements) {
        if (el.type === 'option') {
          console.log(`[Option] id=${el.id}, name=${el.data?.data?.name}, type=${el.data?.data?.type}, required=${el.data?.data?.required}`);
        } else if (el.type === 'action') {
          const content = el.data?.data?.message?.content;
          const embeds = el.data?.data?.message?.embeds;
          console.log(`[Action] id=${el.id}, type=${el.data?.data?.type}, content=${content}`);
          if (embeds) {
            console.log(`[Action Embeds]:`, JSON.stringify(embeds, null, 2));
          }
        } else if (el.type === 'condition') {
          console.log(`[Condition] id=${el.id}, conditionType=${el.data?.data?.condition_type || el.data?.condition_type}, data=`, JSON.stringify(el.data?.data || el.data));
        }
      }
    }
  }

  ws.close();
}

main().catch(console.error);
