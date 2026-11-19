import WebSocket from 'ws';

async function main() {
  const tabs = await fetch('http://127.0.0.1:9222/json').then(r => r.json());
  const discordTab = tabs.find(t => t.url?.includes('discord.com') && t.type === 'page');
  if (!discordTab) {
    console.error('Discord tab not found');
    return;
  }

  const ws = new WebSocket(discordTab.webSocketDebuggerUrl);
  await new Promise(r => ws.on('open', r));

  const send = (m, p = {}) => new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 100000);
    const timeout = setTimeout(() => reject(new Error('CDP Timeout')), 15000);
    const h = (d) => {
      const msg = JSON.parse(d.toString());
      if (msg.id === id) {
        clearTimeout(timeout);
        ws.off('message', h);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      }
    };
    ws.on('message', h);
    ws.send(JSON.stringify({ id, method: m, params: p }));
  });

  const chatInfo = await send('Runtime.evaluate', {
    expression: `(() => {
      const slate = document.querySelector('[role="textbox"][contenteditable="true"]');
      const channelHeader = document.querySelector('h1')?.innerText || document.title;
      return {
        hasSlate: !!slate,
        slateText: slate?.innerText,
        channel: channelHeader
      };
    })()`,
    returnByValue: true
  });
  console.log('Chat input state:', chatInfo.result?.value);

  ws.close();
}

main().catch(console.error);
