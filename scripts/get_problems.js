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
        problems: cb?.problems,
        stateProblems: cb?.state?.problems,
        validationErrors: cb?.validationErrors,
        elementsCount: cb?.props?.elements?.length,
        isValid: cb ? cb.validateSave() : null
      };
    })()`,
    returnByValue: true
  });

  console.log('Problems check:', JSON.stringify(res.result?.value, null, 2));
  ws.close();
}

main().catch(console.error);
