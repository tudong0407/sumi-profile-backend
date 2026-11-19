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
    const id = 123;
    ws.on('message', (d) => {
      const m = JSON.parse(d.toString());
      if (m.id === id) resolve(m.result);
    });
    ws.send(JSON.stringify({ id, method, params }));
  });

  const res = await send('Runtime.evaluate', {
    expression: `(() => {
      const span = Array.from(document.querySelectorAll('span'))
        .find(s => s.textContent.trim() === 'Open builder');
      if (!span) return { error: 'No span found' };
      // click span or parent
      (span.parentElement || span).click();
      return { clicked: true };
    })()`,
    returnByValue: true
  });

  console.log('Click result:', res.result?.value);
  await sleep(3500);

  const check = await send('Runtime.evaluate', {
    expression: `(() => {
      const root = document.querySelector('#root');
      const key = Object.keys(root).find(k => k.startsWith('__reactContainer$'));
      let cb = null;
      function search(fiber) {
        if (!fiber) return;
        if (fiber.stateNode?.validateSave && fiber.stateNode?.buildCommand) cb = fiber.stateNode;
        search(fiber.child);
        search(fiber.sibling);
      }
      search(root[key]);

      return {
        url: window.location.href,
        hasCb: !!cb,
        mode: cb?.props?.mode,
        index: cb?.props?.index,
        commandName: cb?.props?.command?.name || cb?.props?.elements?.find(e => e.type === 'root')?.data?.title
      };
    })()`,
    returnByValue: true
  });

  console.log('CB status after click:', check.result?.value);
  ws.close();
}

main().catch(console.error);
