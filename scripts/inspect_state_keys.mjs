import WebSocket from 'ws';

async function main() {
  const tabs = await fetch('http://127.0.0.1:9222/json').then(r => r.json());
  const bgTab = tabs.find(t => t.url?.includes('botghost.com') && t.type === 'page');
  const ws = new WebSocket(bgTab.webSocketDebuggerUrl);
  await new Promise(r => ws.on('open', r));

  const send = (m, p = {}) => new Promise((resolve) => {
    const id = Math.floor(Math.random() * 100000);
    const h = (d) => {
      const msg = JSON.parse(d.toString());
      if (msg.id === id) { ws.off('message', h); resolve(msg.result); }
    };
    ws.on('message', h);
    ws.send(JSON.stringify({ id, method: m, params: p }));
  });

  const res = await send('Runtime.evaluate', {
    expression: `(() => {
      const root = document.querySelector("#root");
      const key = Object.keys(root).find(k => k.startsWith("__reactContainer$"));
      const container = root[key];
      let curr = container;
      while (curr && !curr.memoizedProps?.store) curr = curr.child;
      const store = curr?.memoizedProps?.store;
      const state = store?.getState();
      return {
        topKeys: Object.keys(state || {}),
        dataKeys: Object.keys(state?.data || {}),
        cbKeys: Object.keys(state?.commandBuilder || state?.builder || {})
      };
    })()`,
    returnByValue: true
  });

  console.log(JSON.stringify(res.result?.value, null, 2));
  ws.close();
}

main().catch(console.error);
