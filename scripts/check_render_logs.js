import WebSocket from 'ws';

async function main() {
  const tabs = await fetch('http://127.0.0.1:9222/json').then(r => r.json());
  const renderTab = tabs.find(t => t.url?.includes('render.com/web/srv-dbvfq3h5efls73dmsa8g'));
  const ws = new WebSocket(renderTab.webSocketDebuggerUrl);
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

  await send('Page.navigate', { url: 'https://dashboard.render.com/web/srv-dbvfq3h5efls73dmsa8g/logs' });
  await new Promise(r => setTimeout(r, 4000));

  const logs = await send('Runtime.evaluate', {
    expression: `(() => {
      const text = document.body.innerText;
      return text.slice(text.indexOf('==>'), text.indexOf('==>') + 2000);
    })()`,
    returnByValue: true
  });

  console.log('Render logs:', logs.result?.value);
  ws.close();
}

main().catch(console.error);
