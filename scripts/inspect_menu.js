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
      if (msg.id === id) {
        ws.off('message', h);
        resolve(msg.result);
      }
    };
    ws.on('message', h);
    ws.send(JSON.stringify({ id, method: m, params: p }));
  });

  // Find and click Manual Deploy button
  await send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.textContent.includes('Manual Deploy'));
      if (btn) btn.click();
    })()`
  });

  await new Promise(r => setTimeout(r, 1000));

  // Inspect what popover / menu appeared
  const menuInfo = await send('Runtime.evaluate', {
    expression: `(() => {
      const all = Array.from(document.querySelectorAll('*'));
      const menu = all.filter(el => {
        const text = el.textContent || '';
        return text.includes('Deploy latest commit') || text.includes('Clear build cache');
      });
      return menu.map(m => ({
        tag: m.tagName,
        text: m.textContent,
        role: m.getAttribute('role'),
        classes: m.className,
        childrenCount: m.children.length
      })).slice(0, 15);
    })()`,
    returnByValue: true
  });

  console.log('Menu info:', JSON.stringify(menuInfo.result?.value, null, 2));

  ws.close();
}

main().catch(console.error);
