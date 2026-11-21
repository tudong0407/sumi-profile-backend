import WebSocket from 'ws';

async function main() {
  const tabs = await fetch('http://127.0.0.1:9222/json').then(r => r.json());
  let targetTab = tabs.find(t => t.url?.includes('render.com'));
  const ws = new WebSocket(targetTab.webSocketDebuggerUrl);
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

  await send('Page.bringToFront');
  const manualRect = await send('Runtime.evaluate', {
    expression: `(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim().includes('Manual Deploy'));
      if (btn) {
        const r = btn.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2, found: true };
      }
      return { found: false };
    })()`,
    returnByValue: true
  });
  console.log('Manual Deploy rect:', manualRect.result?.value);
  if (manualRect.result?.value?.found) {
    const { x, y } = manualRect.result.value;
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await new Promise(r => setTimeout(r, 100));
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    await new Promise(r => setTimeout(r, 1000));
  }

  const rectRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const btn = Array.from(document.querySelectorAll('button, [role="menuitem"], div, span')).find(b => b.textContent.trim() === 'Deploy latest commit');
      if (btn) {
        const r = btn.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2, found: true };
      }
      return { found: false };
    })()`,
    returnByValue: true
  });
  console.log('Rect result:', rectRes.result?.value);

  if (rectRes.result?.value?.found) {
    const { x, y } = rectRes.result.value;
    console.log(`Clicking at (${x}, ${y})...`);
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await new Promise(r => setTimeout(r, 100));
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    console.log('Dispatched native click!');
  }

  await new Promise(r => setTimeout(r, 3000));

  const deploys = await send('Runtime.evaluate', {
    expression: `document.body.innerText.split('\\n').filter(Boolean).slice(40, 65)`,
    returnByValue: true
  });
  console.log('Deploys text after click:\n', deploys.result?.value?.join('\n'));

  ws.close();
}

main().catch(console.error);
