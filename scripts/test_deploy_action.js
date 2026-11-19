import WebSocket from 'ws';

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

  // Get coords of Manual Deploy button
  const coords = await send('Runtime.evaluate', {
    expression: `(() => {
      const b = Array.from(document.querySelectorAll('button')).find(btn => btn.textContent.trim() === 'Manual Deploy');
      if (!b) return null;
      const r = b.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    })()`,
    returnByValue: true
  });

  console.log('Button Coords:', coords.result?.value);
  if (!coords.result?.value) {
    ws.close();
    return;
  }

  const { x, y } = coords.result.value;

  // Dispatch mouse click at x, y
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });

  await new Promise(r => setTimeout(r, 600));

  // Check if aria-expanded changed to true
  const state = await send('Runtime.evaluate', {
    expression: `(() => {
      const b = Array.from(document.querySelectorAll('button')).find(btn => btn.textContent.trim() === 'Manual Deploy');
      const items = Array.from(document.querySelectorAll('[role="menuitem"]')).map(el => {
        const r = el.getBoundingClientRect();
        return { text: el.textContent.trim(), x: r.x + r.width / 2, y: r.y + r.height / 2 };
      });
      return { ariaExpanded: b?.getAttribute('aria-expanded'), items };
    })()`,
    returnByValue: true
  });

  console.log('Menu State after click:', JSON.stringify(state.result?.value, null, 2));

  const clearItem = state.result?.value?.items?.find(i => i.text.includes('Clear build cache & deploy'));
  if (clearItem) {
    console.log('Clicking Clear build cache at:', clearItem.x, clearItem.y);
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: clearItem.x, y: clearItem.y, button: 'left', clickCount: 1 });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: clearItem.x, y: clearItem.y, button: 'left', clickCount: 1 });
  }

  await new Promise(r => setTimeout(r, 2000));
  ws.close();
}

main().catch(console.error);
