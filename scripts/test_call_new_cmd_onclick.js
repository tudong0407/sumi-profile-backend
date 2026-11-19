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

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
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

  console.log('Invoking newCmd onClick directly...');
  const res = await send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const newCmdBtn = btns.find(b => b.textContent.includes('Build a new command') && b.textContent.includes('Start building'));
      if (!newCmdBtn) return { error: 'newCmdBtn not found' };

      const key = Object.keys(newCmdBtn).find(k => k.startsWith('__reactProps$'));
      if (!key) return { error: 'props key not found' };

      try {
        newCmdBtn[key].onClick({ preventDefault: () => {}, stopPropagation: () => {} });
        return { called: true };
      } catch (e) {
        return { error: e.message, stack: e.stack };
      }
    })()`,
    returnByValue: true
  });

  console.log('Invocation result:', res.result?.value);
  await sleep(3000);

  const check = await send('Runtime.evaluate', {
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

      return {
        url: window.location.href,
        hasCb: !!cb,
        cbPropsKeys: cb ? Object.keys(cb.props) : [],
        nameInput: !!document.getElementById('command-setup-name'),
        descInput: !!document.getElementById('command-setup-description'),
        reactFlow: !!document.querySelector('.react-flow')
      };
    })()`,
    returnByValue: true
  });

  console.log('Check after onClick:', JSON.stringify(check.result?.value, null, 2));
  ws.close();
}

main().catch(console.error);
