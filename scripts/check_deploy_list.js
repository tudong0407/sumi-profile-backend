import WebSocket from 'ws';

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  const tabs = await fetch('http://127.0.0.1:9222/json').then(r => r.json());
  const renderTab = tabs.find(t => t.url?.includes('render.com/web/srv-dbvfq3h5efls73dmsa8g'));
  const ws = new WebSocket(renderTab.webSocketDebuggerUrl);
  await new Promise(r => ws.on('open', r));

  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 1000000);
    const timeout = setTimeout(() => reject(new Error('CDP Timeout')), 15000);
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

  await send('Page.navigate', { url: 'https://dashboard.render.com/web/srv-dbvfq3h5efls73dmsa8g/deploys' });
  await sleep(3000);

  const res = await send('Runtime.evaluate', {
    expression: `(() => {
      const deploys = Array.from(document.querySelectorAll('a, div, span'))
        .map(el => el.textContent?.trim())
        .filter(t => t && (t.includes('commit') || t.includes('fix:') || t.includes('feat:') || t.includes('Building') || t.includes('Live')));
      return Array.from(new Set(deploys)).slice(0, 20);
    })()`,
    returnByValue: true
  });

  console.log('Recent Deploys:', JSON.stringify(res.result?.value, null, 2));
  ws.close();
}

main().catch(console.error);
