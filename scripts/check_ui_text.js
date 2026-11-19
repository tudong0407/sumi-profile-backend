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
      const btns = Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim());
      return {
        saveBtns: btns.filter(t => t.includes('Save') || t.includes('Problem') || t.includes('problem')),
        builderSaveRequired: (() => {
          const root = document.querySelector('#root');
          const key = Object.keys(root).find(k => k.startsWith('__reactContainer$'));
          let store = null;
          function search(fiber) {
            if (!fiber) return;
            if (fiber.memoizedProps?.store) store = fiber.memoizedProps.store;
            search(fiber.child);
            search(fiber.sibling);
          }
          search(root[key]);
          return store?.getState()?.builder?.builderSaveRequired;
        })()
      };
    })()`,
    returnByValue: true
  });

  console.log('UI text check:', res.result?.value);
  ws.close();
}

main().catch(console.error);
