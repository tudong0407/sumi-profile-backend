import WebSocket from 'ws';

async function main() {
  const tabs = await fetch('http://127.0.0.1:9222/json').then(r => r.json());
  const bg = tabs.find(t => t.url?.includes('botghost.com'));
  const ws = new WebSocket(bg.webSocketDebuggerUrl);
  await new Promise(r => ws.on('open', r));

  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 1000000);
    const timeout = setTimeout(() => reject(new Error('CDP Timeout')), 20000);
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

  const res = await send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button')).map(b => ({
        text: b.textContent?.trim(),
        className: b.className,
        id: b.id,
        disabled: b.disabled
      }));
      return btns.filter(b => b.text.toLowerCase().includes('save') || b.text.toLowerCase().includes('problem'));
    })()`,
    returnByValue: true
  });

  console.log('Save / Problem buttons:', res.result?.value);
  ws.close();
}

main().catch(console.error);
