import WebSocket from 'ws';

const ws = new WebSocket('ws://127.0.0.1:9222/devtools/page/09AF917DBDF33A24B65C73CEF52FDF61');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

ws.on('open', async () => {
  const send = (method, params = {}) => new Promise((resolve) => {
    const id = Math.floor(Math.random() * 1000000);
    const h = (d) => {
      const msg = JSON.parse(d);
      if (msg.id === id) {
        ws.off('message', h);
        resolve(msg.result);
      }
    };
    ws.on('message', h);
    ws.send(JSON.stringify({ id, method, params }));
  });

  console.log('Triggering React onClick for /profile...');
  const res = await send('Runtime.evaluate', {
    expression: `(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('/profile') && b.textContent.includes('Open builder'));
      if (!btn) return { error: 'No btn' };
      const key = Object.keys(btn).find(k => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$') || k.startsWith('__reactProps$'));
      if (!key) return { error: 'No react key on btn' };
      
      const props = btn[key];
      const onClick = props.onClick || props.memoizedProps?.onClick;
      if (onClick) {
        onClick({ preventDefault: () => {}, stopPropagation: () => {} });
        return { success: true, method: 'called onClick directly' };
      }

      // try dispatching synthetic event
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      return { success: true, method: 'dispatched MouseEvent' };
    })()`,
    returnByValue: true
  });
  console.log('Result:', res.result?.value);
  await sleep(4000);

  const check = await send('Runtime.evaluate', {
    expression: `(() => {
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
        url: window.location.href,
        hasCb: !!cb,
        cmdTitle: cb?.props?.command?.name || cb?.state?.name,
        elementsCount: cb?.props?.elements?.length
      };
    })()`,
    returnByValue: true
  });
  console.log('After React click check:', check.result?.value);

  ws.close();
});
