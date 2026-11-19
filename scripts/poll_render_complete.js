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

  for (let i = 0; i < 30; i++) {
    const res = await send('Runtime.evaluate', {
      expression: `(() => {
        const text = document.body.innerText;
        const isBuilding = text.includes('Status:Building') || text.includes('Building');
        const isLive = text.includes('22c3e10') && (text.includes('Live') || !text.includes('Status:Building'));
        return { isBuilding, isLive, snippet: text.slice(text.indexOf('Most recent deploy'), text.indexOf('Most recent deploy') + 200) };
      })()`,
      returnByValue: true
    });

    const info = res.result?.value;
    console.log(`[Poll ${i+1}] Building: ${info?.isBuilding}, Live: ${info?.isLive}`);
    if (!info?.isBuilding && info?.isLive) {
      console.log('Deploy completed successfully!');
      break;
    }
    await sleep(6000);
  }

  ws.close();
}

main().catch(console.error);
