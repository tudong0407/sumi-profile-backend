import http from 'http';
import WebSocket from 'ws';

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function main() {
  const tabs = await getJson('http://127.0.0.1:9222/json');
  const pageTarget = tabs.find(t => t.url?.includes('dashboard.botghost.com'));

  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
  await new Promise(r => ws.on('open', r));

  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 1000000);
    const timeout = setTimeout(() => reject(new Error('CDP Timeout')), 15000);
    const handler = (data) => {
      const parsed = JSON.parse(data.toString());
      if (parsed.id === id) {
        clearTimeout(timeout);
        ws.off('message', handler);
        if (parsed.error) reject(parsed.error);
        else resolve(parsed.result);
      }
    };
    ws.on('message', handler);
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
        if (fiber.stateNode?.validateSave && fiber.stateNode?.buildCommand) cb = fiber.stateNode;
        search(fiber.child);
        search(fiber.sibling);
      }
      search(root[key]);

      const buttons = Array.from(document.querySelectorAll('button')).map(b => ({
        text: b.textContent?.trim(),
        className: b.className,
        disabled: b.disabled
      }));

      const cbMethods = cb ? Object.getOwnPropertyNames(Object.getPrototypeOf(cb)) : [];

      return {
        url: window.location.href,
        hasCb: !!cb,
        cbMethods: cbMethods.filter(m => typeof cb[m] === 'function'),
        cbPropsKeys: cb ? Object.keys(cb.props) : [],
        saveButtons: buttons.filter(b => b.text?.includes('Save') || b.text?.includes('Lưu')),
        lastSave: store?.getState()?.data?.bot?.last_save
      };
    })()`,
    returnByValue: true
  });

  console.log('Builder Inspection:', JSON.stringify(res.result?.value, null, 2));
  ws.close();
}

main().catch(console.error);
