import WebSocket from 'ws';

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

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
      const allTextNodes = Array.from(document.querySelectorAll('*'))
        .filter(el => el.children.length === 0 && (el.textContent.includes('/profile') || el.textContent.includes('/rank')));
      return allTextNodes.map(el => ({
        tag: el.tagName,
        text: el.textContent.trim(),
        parentTag: el.parentElement?.tagName,
        parentClass: el.parentElement?.className
      }));
    })()`,
    returnByValue: true
  });

  console.log('Search for /profile and /rank:', res.result?.value);
  ws.close();
}

main().catch(console.error);
