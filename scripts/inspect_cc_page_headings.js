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

  console.log('Navigating to customcommands...');
  await send('Page.navigate', { url: 'https://dashboard.botghost.com/dashboard/customcommands' });
  await sleep(4000);

  const check = await send('Runtime.evaluate', {
    expression: `(() => {
      const headings = Array.from(document.querySelectorAll('h1, h2, h3, h4, [data-testid*="command"], span'))
        .map(h => h.textContent?.trim())
        .filter(t => t && (t.startsWith('/') || t === 'profile' || t === 'rank'));
      return {
        url: window.location.href,
        headings: Array.from(new Set(headings))
      };
    })()`,
    returnByValue: true
  });

  console.log('Headings found:', check.result?.value);
  ws.close();
}

main().catch(console.error);
