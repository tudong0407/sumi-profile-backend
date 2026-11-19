import WebSocket from 'ws';

async function main() {
  const tabs = await fetch('http://127.0.0.1:9222/json').then(r => r.json());
  const bg = tabs.find(t => t.url?.includes('botghost.com'));
  const ws = new WebSocket(bg.webSocketDebuggerUrl);
  await new Promise(r => ws.on('open', r));

  const send = (method, params = {}) => new Promise((res, rej) => {
    const id = Math.floor(Math.random() * 1000000);
    const timeout = setTimeout(() => rej(new Error('CDP Timeout')), 15000);
    const h = (d) => {
      const m = JSON.parse(d.toString());
      if (m.id === id) {
        clearTimeout(timeout);
        ws.off('message', h);
        if (m.error) rej(m.error); else res(m.result);
      }
    };
    ws.on('message', h);
    ws.send(JSON.stringify({ id, method, params }));
  });

  const res = await send('Runtime.evaluate', {
    expression: `(() => {
      try {
        const root = document.querySelector('#root');
        const key = Object.keys(root).find(k => k.startsWith('__reactContainer$'));
        let cb = null;
        function search(fiber) {
          if (!fiber) return;
          if (fiber.stateNode?.validateSave) cb = fiber.stateNode;
          search(fiber.child);
          search(fiber.sibling);
        }
        search(root[key]);

        return {
          cbExists: !!cb,
          cbValidate: cb?.validateSave ? cb.validateSave() : null,
          commandTitle: cb?.state?.name || cb?.props?.command?.name,
          elements: cb?.props?.elements?.map(e => ({
            id: e.id,
            type: e.type,
            validated: e.data?.data?.validated,
            isValid: e.data?.isValid
          }))
        };
      } catch (err) {
        return { error: err.message, stack: err.stack };
      }
    })()`,
    returnByValue: true
  });

  console.log('Errors Check:', JSON.stringify(res.result?.value, null, 2));
  ws.close();
}

main().catch(console.error);
