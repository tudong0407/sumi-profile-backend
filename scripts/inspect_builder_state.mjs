import WebSocket from 'ws';

const ws = new WebSocket('ws://127.0.0.1:9222/devtools/page/09AF917DBDF33A24B65C73CEF52FDF61');
ws.on('open', () => {
  ws.send(JSON.stringify({
    id: 1,
    method: 'Runtime.evaluate',
    params: {
      expression: `(() => {
        const root = document.querySelector('#root');
        const key = Object.keys(root).find(k => k.startsWith('__reactContainer$'));
        let store = null;
        let cb = null;
        function search(fiber) {
          if (!fiber) return;
          if (fiber.memoizedProps?.store) store = fiber.memoizedProps.store;
          if (fiber.stateNode?.validateSave) cb = fiber.stateNode;
          search(fiber.child);
          search(fiber.sibling);
        }
        search(root[key]);

        const st = store?.getState();
        return {
          hasStore: !!store,
          hasCb: !!cb,
          builderRoute: window.location.pathname,
          builderState: st?.builder,
          activeCommand: st?.data?.bot?.commands?.slash?.commands?.find(c => c.name === 'profile')
        };
      })()`,
      returnByValue: true
    }
  }));
});
ws.on('message', (d) => {
  const res = JSON.parse(d);
  if (res.id === 1) {
    console.log(JSON.stringify(res.result?.result?.value, null, 2));
    ws.close();
  }
});
