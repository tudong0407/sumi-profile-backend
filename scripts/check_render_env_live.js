import WebSocket from 'ws';

async function main() {
  const tabs = await fetch('http://127.0.0.1:9222/json').then(r => r.json());
  const rTab = tabs.find(t => t.url?.includes('render.com/web/srv-dbvfq3h5efls73dmsa8g'));
  if (!rTab) {
    console.error('No Render tab found!');
    return;
  }
  const ws = new WebSocket(rTab.webSocketDebuggerUrl);
  await new Promise(r => ws.on('open', r));
  const send = (m, p = {}) => new Promise((resolve, reject) => {
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
  await new Promise(r => setTimeout(r, 4000));

  const info = await send('Runtime.evaluate', {
    expression: `(() => {
      const inputs = Array.from(document.querySelectorAll('input, textarea')).map(i => ({
        name: i.name,
        placeholder: i.placeholder,
        value: i.value ? i.value.slice(0, 30) : ''
      }));
      return {
        url: document.location.href,
        inputs
      };
    })()`,
    returnByValue: true
  });

  console.log('Env page live:', JSON.stringify(info.result?.value, null, 2));
  ws.close();
}

main().catch(console.error);
