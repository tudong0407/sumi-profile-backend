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
      const btns = Array.from(document.querySelectorAll('button'));
      const petBtn = btns.find(b => b.textContent.includes('Open builder') && b.textContent.includes('/pet'));
      if (!petBtn) return { error: 'petBtn not found' };

      const key = Object.keys(petBtn).find(k => k.startsWith('__reactFiber$') || k.startsWith('__reactProps$'));
      const props = petBtn[key];

      // Also let's inspect the "Build a new command" button
      const newCmdBtn = btns.find(b => b.textContent.includes('Build a new command') && b.textContent.includes('Start building'));
      const newKey = newCmdBtn ? Object.keys(newCmdBtn).find(k => k.startsWith('__reactProps$')) : null;

      return {
        petBtnText: petBtn.textContent.trim(),
        petBtnProps: props ? Object.keys(props) : null,
        hasOnClick: typeof props?.onClick === 'function',
        newCmdProps: newKey ? Object.keys(newCmdBtn[newKey]) : null,
        newCmdHasOnClick: typeof newCmdBtn?.[newKey]?.onClick === 'function'
      };
    })()`,
    returnByValue: true
  });

  console.log('Button fiber:', JSON.stringify(res.result?.value, null, 2));
  ws.close();
}

main().catch(console.error);
