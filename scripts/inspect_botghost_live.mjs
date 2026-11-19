import WebSocket from 'ws';

async function main() {
  const tabs = await fetch('http://127.0.0.1:9222/json').then(r => r.json());
  const bgTab = tabs.find(t => t.url?.includes('botghost.com') && t.type === 'page');
  if (!bgTab) {
    console.error('BotGhost tab not found');
    return;
  }
  console.log('Connecting to BotGhost tab:', bgTab.title, bgTab.url);
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

  const stateInfo = await send('Runtime.evaluate', {
    expression: `(() => {
      const root = document.getElementById('root');
      const containerKey = Object.keys(root || {}).find(k => k.startsWith('__reactContainer$'));
      const container = root?.[containerKey];
      const store = container?.memoizedProps?.store || window.store;
      const state = store?.getState?.();
      
      const commands = state?.data?.bot?.commands?.custom_commands?.commands || [];
      const events = state?.data?.bot?.commands?.custom_events?.events || [];
      
      return {
        botName: state?.data?.bot?.name,
        botId: state?.data?.bot?.id,
        commandNames: commands.map(c => ({ name: c.name, enabled: c.enabled, id: c.id })),
        eventNames: events.map(e => ({ name: e.name, enabled: e.enabled, id: e.id }))
      };
    })()`,
    returnByValue: true
  });
  console.log('BotGhost state info:\n', JSON.stringify(stateInfo.result?.value, null, 2));

  ws.close();
}

main().catch(console.error);
