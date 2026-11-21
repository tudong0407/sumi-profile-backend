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

  // Clear textbox
  await send('Runtime.evaluate', {
    expression: `(() => {
      const slate = document.querySelector('[role="textbox"][contenteditable="true"]');
      if (slate) {
        slate.focus();
        document.execCommand('selectAll', false, null);
        document.execCommand('delete', false, null);
      }
    })()`
  });

  await new Promise(r => setTimeout(r, 500));

  // Type /wiki
  for (const char of '/wiki') {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', text: char, unmodifiedText: char });
    await send('Input.dispatchKeyEvent', { type: 'keyUp' });
    await new Promise(r => setTimeout(r, 100));
  }

  await new Promise(r => setTimeout(r, 1500));

  // Check autocomplete popup
  const popout = await send('Runtime.evaluate', {
    expression: `(() => {
      const popout = document.querySelector('[class*="autocomplete"]');
      return popout?.innerText?.split('\\n').filter(Boolean);
    })()`,
    returnByValue: true
  });

  console.log('Autocomplete items:', popout.result?.value);
  ws.close();
}

main().catch(console.error);
