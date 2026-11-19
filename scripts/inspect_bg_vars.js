import http from 'http';
import WebSocket from 'ws';

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
      // Find all script tags or look at React fiber tree for variable drawer / autocomplete
      // Let's search inside fiber tree for props containing 'variables'
      const root = document.querySelector('#root');
      const key = Object.keys(root).find(k => k.startsWith('__reactContainer$'));
      let vars = [];
      function search(fiber) {
        if (!fiber) return;
        if (fiber.memoizedProps?.variables && Array.isArray(fiber.memoizedProps.variables)) {
          vars.push(...fiber.memoizedProps.variables);
        }
        if (fiber.memoizedProps?.commandVariables) {
          vars.push(fiber.memoizedProps.commandVariables);
        }
        search(fiber.child);
        search(fiber.sibling);
      }
      search(root[key]);

      return {
        varsCount: vars.length,
        sampleVars: vars.slice(0, 30)
      };
    })()`,
    returnByValue: true
  });

  console.log('Result:', JSON.stringify(res, null, 2));
  ws.close();
}

main().catch(console.error);
