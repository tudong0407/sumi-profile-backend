import WebSocket from 'ws';

async function main() {
  const tabs = await fetch('http://127.0.0.1:9222/json').then(r => r.json());
  const bg = tabs.find(t => t.url?.includes('botghost.com'));
  const ws = new WebSocket(bg.webSocketDebuggerUrl);
  await new Promise(r => ws.on('open', r));

  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = 123;
    ws.on('message', (d) => {
      const m = JSON.parse(d.toString());
      if (m.id === id) resolve(m.result);
    });
    ws.send(JSON.stringify({ id, method, params }));
  });

  const res = await send('Runtime.evaluate', {
    expression: `(() => {
      const h3 = Array.from(document.querySelectorAll('h3')).find(h => h.textContent.trim() === '/profile');
      if (!h3) return { error: 'No /profile H3' };
      // find the accordion / card root
      let card = h3;
      while (card && !card.className?.includes('rounded') && card.parentElement) {
        card = card.parentElement;
      }
      // Or go up a few levels
      let container = h3.closest('.rounded-xl') || h3.closest('.rounded-lg') || h3.parentElement.parentElement.parentElement;
      
      const allBtns = Array.from(container ? container.querySelectorAll('button, a') : []).map(b => ({
        tag: b.tagName,
        text: b.textContent.trim(),
        className: b.className
      }));

      return {
        containerTag: container?.tagName,
        containerClass: container?.className,
        buttons: allBtns
      };
    })()`,
    returnByValue: true
  });

  console.log('Card inspection:', JSON.stringify(res.result?.value, null, 2));
  ws.close();
}

main().catch(console.error);
