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
        const container = root[key];
        let curr = container;
        while (curr && !curr.memoizedProps?.store) {
          curr = curr.child;
        }
        const store = curr?.memoizedProps?.store;
        const slashCmds = store?.getState()?.data?.bot?.commands?.slash?.commands || [];
        const profileCmd = slashCmds.find(c => c.name === 'profile');
        
        // Find lz in window or modules
        let lz = window.LZString;
        if (!lz) {
          // find in webpack/vite chunk if exposed
          for (let k in window) {
            if (window[k]?.decompressFromBase64) {
              lz = window[k];
              break;
            }
          }
        }
        return {
          hasLz: !!lz,
          compressed_tree: profileCmd?.compressed_tree
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
