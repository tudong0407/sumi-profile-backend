import WebSocket from 'ws';

async function main() {
  const tabs = await fetch('http://127.0.0.1:9222/json').then(r => r.json());
  const renderTab = tabs.find(t => t.url?.includes('render.com/web/srv-dbvfq3h5efls73dmsa8g/env'));
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

  const res = await send('Runtime.evaluate', {
    expression: `(() => {
      const showBtns = Array.from(document.querySelectorAll('button[aria-label="Show secret"]'));
      showBtns.forEach(b => b.click());
      const textareas = Array.from(document.querySelectorAll('textarea')).map((t, idx) => ({
        idx,
        val: t.value?.slice(0, 30),
        len: t.value?.length
      }));
      return textareas;
    })()`,
    returnByValue: true
  });

  console.log('Secrets revealed:', JSON.stringify(res.result?.value, null, 2));
  ws.close();
}

main().catch(console.error);
