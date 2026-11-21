import WebSocket from 'ws';

async function main() {
  const tabs = await fetch('http://127.0.0.1:9222/json/list').then(r => r.json());
  const dTab = tabs.find(t => t.url?.includes('discord.com') && t.type === 'page');
  if (!dTab) throw new Error('No Discord tab');
  const ws = new WebSocket(dTab.webSocketDebuggerUrl);
  await new Promise(r => ws.once('open', r));
  const send = (method, params = {}) => new Promise(res => {
    const id = Math.floor(Math.random() * 100000);
    const h = d => { const m = JSON.parse(d); if (m.id === id) { ws.off('message', h); res(m.result); } };
    ws.on('message', h);
    ws.send(JSON.stringify({ id, method, params }));
  });
  const info = await send('Runtime.evaluate', {
    expression: `(() => {
      const msgs = [...document.querySelectorAll('li[class*="messageListItem"]')].slice(-6);
      return msgs.map(m => ({
        id: m.id,
        text: (m.innerText || '').replace(/\\n+/g, ' | ').slice(0, 180),
        imgs: [...m.querySelectorAll('img')].filter(i => i.naturalWidth > 100 || (i.src || '').includes('onrender') || (i.src || '').includes('api/')).map(i => ({ src: i.src, complete: i.complete, w: i.naturalWidth, h: i.naturalHeight }))
      }));
    })()`,
    returnByValue: true
  });
  console.log(JSON.stringify(info.result?.value, null, 2));
  ws.close();
}

main().catch(e => { console.error(e); process.exit(1); });
