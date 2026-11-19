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
      if (msg.id === id) { ws.off('message', h); resolve(msg.result); }
    };
    ws.on('message', h);
    ws.send(JSON.stringify({ id, method: m, params: p }));
  });

  // 1. Click Manual Deploy button
  const manual = await send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.textContent.trim() === 'Manual Deploy');
      if (btn) {
        btn.click();
        return { clicked: true, text: btn.textContent.trim() };
      }
      return { clicked: false };
    })()`,
    returnByValue: true
  });
  console.log('Manual Deploy Click:', manual.result?.value);

  await new Promise(r => setTimeout(r, 600));

  // 2. Click button[role='menuitem'] containing 'Clear build cache & deploy'
  const clear = await send('Runtime.evaluate', {
    expression: `(() => {
      const items = Array.from(document.querySelectorAll('button[role="menuitem"]'));
      const clearBtn = items.find(b => b.textContent.includes('Clear build cache & deploy'));
      if (clearBtn) {
        clearBtn.click();
        return { clicked: true, text: clearBtn.textContent.trim() };
      }
      return { clicked: false, items: items.map(b => b.textContent.trim()) };
    })()`,
    returnByValue: true
  });
  console.log('Clear & Deploy Click:', clear.result?.value);

  ws.close();
}

main().catch(console.error);
