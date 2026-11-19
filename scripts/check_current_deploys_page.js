import WebSocket from 'ws';

async function main() {
  const tabs = await fetch('http://127.0.0.1:9222/json').then(r => r.json());
  const pageTab = tabs.find(t => t.type === 'page' && t.url?.includes('dashboard.render.com'));
  const ws = new WebSocket(pageTab.webSocketDebuggerUrl);
  await new Promise(r => ws.on('open', r));

  const send = (m, p = {}) => new Promise((resolve) => {
    const id = Math.floor(Math.random() * 100000);
    const h = (d) => {
      const msg = JSON.parse(d.toString());
      if (msg.id === id) {
        ws.off('message', h);
        resolve(msg.result);
      }
    };
    ws.on('message', h);
    ws.send(JSON.stringify({ id, method: m, params: p }));
  });

  const res = await send('Runtime.evaluate', {
    expression: `(() => {
      const text = document.body.innerText;
      const lines = text.split('\\n').map(l => l.trim()).filter(Boolean);
      return lines.slice(30, 80);
    })()`,
    returnByValue: true
  });

  console.log('Deploys page summary:\n' + res.result?.value?.join('\n'));
  ws.close();
}

main().catch(console.error);
