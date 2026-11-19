import http from 'http';
import WebSocket from 'ws';

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

async function main() {
  const tabs = await getJson('http://127.0.0.1:9222/json');
  const bg = tabs.find(t => t.url?.includes('botghost.com'));
  const ws = new WebSocket(bg.webSocketDebuggerUrl);
  await new Promise(r => ws.on('open', r));

  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 1000000);
    const h = (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.id === id) {
        ws.off('message', h);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      }
    };
    ws.on('message', h);
    ws.send(JSON.stringify({ id, method, params }));
  });

  const res = await send('Runtime.evaluate', {
    expression: `(() => {
      const root = document.getElementById('root');
      if (!root) return { error: 'no root' };
      const key = Object.keys(root).find(k => k.startsWith('__reactContainer$'));
      if (!key) return { error: 'no reactContainer' };
      const store = root[key]?.memoizedProps?.store;
      if (!store) return { error: 'no store' };
      const st = store.getState();
      const bot = st.data?.bot;
      return {
        botName: bot?.name,
        botId: bot?.id,
        commandKeys: Object.keys(bot?.commands || {}),
        customCommands: bot?.commands?.custom_commands,
        customEventsCount: bot?.commands?.custom_events?.events?.length
      };
    })()`,
    returnByValue: true
  });

  console.log('BotGhost Redux state:', JSON.stringify(res.result?.value, null, 2));
  ws.close();
}

main().catch(console.error);
