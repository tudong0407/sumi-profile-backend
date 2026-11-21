import WebSocket from 'ws';
import LZString from 'lz-string';

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
      const slash = store?.getState()?.data?.bot?.commands?.slash?.commands || [];
      const prof = slash.find(c => c.name === "profile");
      return prof ? prof.compressed_tree : null;
    })()`,
    returnByValue: true
  });
  const raw = LZString.decompressFromBase64(res.result?.value);
  console.log(raw);
  ws.close();
}

main().catch(console.error);
