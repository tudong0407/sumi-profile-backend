import WebSocket from 'ws';

async function main() {
  const tabs = await fetch('http://127.0.0.1:9222/json').then(r => r.json());
  const discordTab = tabs.find(t => t.url?.includes('discord.com') && t.type === 'page');
  const ws = new WebSocket(discordTab.webSocketDebuggerUrl);
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
      const slate = document.querySelector('[role="textbox"][contenteditable="true"]');
      const messages = Array.from(document.querySelectorAll('li[class*="messageListItem"]')).slice(-5).map(m => {
        const header = m.querySelector('h3')?.innerText || '';
        const content = m.querySelector('[id*="message-content"]')?.innerText || '';
        const embeds = Array.from(m.querySelectorAll('[class*="embed"]')).map(e => ({
          title: e.querySelector('[class*="embedTitle"]')?.innerText || '',
          desc: e.querySelector('[class*="embedDescription"]')?.innerText || '',
          img: e.querySelector('img')?.src || ''
        }));
        return { header, content, embeds };
      });
      return {
        textbox: slate ? slate.innerText : null,
        messages
      };
    })()`,
    returnByValue: true
  });

  console.log(JSON.stringify(res.result?.value, null, 2));
  ws.close();
}

main().catch(console.error);
