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
  const bg = tabs.find(t => t.url?.includes('dashboard.botghost.com'));
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
      const classInstances = [];
      function search(fiber) {
        if (!fiber) return;
        if (fiber.stateNode && typeof fiber.stateNode === 'object' && !(fiber.stateNode instanceof Element)) {
          const proto = Object.getPrototypeOf(fiber.stateNode);
          const methods = Object.getOwnPropertyNames(proto || {});
          classInstances.push({
            name: fiber.elementType?.name || fiber.elementType?.displayName || 'UnknownClass',
            methods: methods.filter(m => m !== 'constructor')
          });
        }
        search(fiber.child);
        search(fiber.sibling);
      }
      search(root[key]);

      // Also check if React Flow exists in DOM
      const reactFlow = !!document.querySelector('.react-flow');

      return {
        hasReactFlow: reactFlow,
        classInstances
      };
    })()`,
    returnByValue: true
  });

  console.log('Class instances in React tree:', JSON.stringify(res.result?.value, null, 2));
  ws.close();
}

main().catch(console.error);
