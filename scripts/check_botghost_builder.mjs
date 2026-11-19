import WebSocket from 'ws';

const ws = new WebSocket('ws://127.0.0.1:9222/devtools/page/09AF917DBDF33A24B65C73CEF52FDF61');
ws.on('open', () => {
  ws.send(JSON.stringify({
    id: 1,
    method: 'Runtime.evaluate',
    params: {
      expression: `(() => {
        const store = window.store || window.__REDUX_STORE__;
        if (!store) return 'No store';
        const slashCmds = store.getState()?.data?.bot?.commands?.slash?.commands || [];
        const profileCmd = slashCmds.find(c => c.name === 'profile');
        const rankCmd = slashCmds.find(c => c.name === 'rank');
        return {
          profileCmdAction: profileCmd?.actions?.[0],
          rankCmdAction: rankCmd?.actions?.[0]
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
