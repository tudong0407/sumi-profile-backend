import WebSocket from 'ws';

const ws = new WebSocket('ws://127.0.0.1:9222/devtools/page/09AF917DBDF33A24B65C73CEF52FDF61');
ws.on('open', () => {
  ws.send(JSON.stringify({
    id: 1,
    method: 'Runtime.evaluate',
    params: {
      expression: `(() => {
        const root = document.querySelector('#root');
        if (!root) return 'No #root';
        const key = Object.keys(root).find(k => k.startsWith('__reactContainer$'));
        if (!key) return 'No reactContainer';
        const container = root[key];
        const store = container?.memoizedProps?.store || container?.memoizedState?.element?.props?.store;
        if (!store) {
          // traverse children
          let curr = container;
          while (curr && !curr.memoizedProps?.store) {
            curr = curr.child;
          }
          if (curr?.memoizedProps?.store) return 'Found store in child!';
          return 'No store found in root';
        }
        const state = store.getState();
        const slashCmds = state?.data?.bot?.commands?.slash?.commands || [];
        const profileCmd = slashCmds.find(c => c.name === 'profile');
        const rankCmd = slashCmds.find(c => c.name === 'rank');
        return {
          profileBlocks: profileCmd?.blocks,
          profileActions: profileCmd?.actions,
          profileImage: profileCmd?.actions?.[0]?.embeds?.[0]?.image_url || profileCmd?.actions?.[0]?.embed?.image?.url
        };
      })()`,
      returnByValue: true
    }
  }));
});
ws.on('message', (d) => {
  const res = JSON.parse(d);
  if (res.id === 1) {
    console.log(JSON.stringify(res.result?.result?.value || res, null, 2));
    ws.close();
  }
});
