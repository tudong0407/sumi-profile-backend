import WebSocket from 'ws';

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  const tabs = await fetch('http://127.0.0.1:9222/json').then(r => r.json());
  const rTab = tabs.find(t => t.type === 'page' && t.url?.includes('dashboard.render.com'));
  const ws = new WebSocket(rTab.webSocketDebuggerUrl);
  await new Promise(r => ws.on('open', r));
  const send = (m, p = {}) => new Promise((resolve) => {
    const id = Math.floor(Math.random() * 100000);
    const h = (d) => {
      const msg = JSON.parse(d.toString());
      if (msg.id === id) { ws.off('message', h); resolve(msg.result); }
    };
    ws.on('message', h);
    ws.send(JSON.stringify({ id, method: m, params: p }));
  });

  console.log('Navigating to env page...');
  await send('Page.navigate', { url: 'https://dashboard.render.com/web/srv-dbvfq3h5efls73dmsa8g/env' });
  await sleep(4000);

  const res = await send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim());
      const inputs = Array.from(document.querySelectorAll('input, textarea')).map(i => ({ name: i.name, id: i.id, placeholder: i.placeholder, val: i.value?.slice(0, 20) }));
      return { btns, inputs };
    })()`,
    returnByValue: true
  });

  console.log('Env page state:', JSON.stringify(res.result?.value, null, 2));
  ws.close();
}

main().catch(console.error);
