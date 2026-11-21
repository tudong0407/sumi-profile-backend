import WebSocket from 'ws';
import LZString from 'lz-string';

// Check if /wiki command needs to be enabled in BotGhost
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
      let curr = root[key];
      while (curr && !curr.memoizedProps?.store) curr = curr.child;
      const store = curr?.memoizedProps?.store;
      const state = store?.getState();
      const slash = state?.data?.bot?.commands?.slash?.commands || [];
      const wiki = slash.find(c => c.name === 'wiki');
      const profile = slash.find(c => c.name === 'profile');
      const rank = slash.find(c => c.name === 'rank');
      return {
        wikiEnabled: wiki?.enabled,
        wikiId: wiki?.id,
        wikiHasTree: !!wiki?.compressed_tree,
        profileEnabled: profile?.enabled,
        rankEnabled: rank?.enabled,
        // Check if bot is online
        botStatus: state?.data?.bot?.online,
        // last_save to detect if save was recent
        lastSave: state?.data?.bot?.last_save
      };
    })()`,
    returnByValue: true
  });

  console.log('Command status:', JSON.stringify(res.result?.value, null, 2));
  ws.close();
}

main().catch(console.error);
