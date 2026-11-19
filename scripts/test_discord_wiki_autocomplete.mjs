import WebSocket from 'ws';

async function main() {
  const tabs = await fetch('http://127.0.0.1:9222/json').then(r => r.json());
  const discordTab = tabs.find(t => t.url?.includes('discord.com') && t.type === 'page');
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

  // Focus textbox
  await send('Runtime.evaluate', {
    expression: `(() => {
      const slate = document.querySelector('[role="textbox"][contenteditable="true"]');
      if (slate) slate.focus();
    })()`
  });
  await new Promise(r => setTimeout(r, 400));

  // Type /wiki
  console.log('Typing /wiki...');
  for (const char of '/wiki') {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', text: char, unmodifiedText: char });
    await send('Input.dispatchKeyEvent', { type: 'keyUp' });
    await new Promise(r => setTimeout(r, 100));
  }
  await new Promise(r => setTimeout(r, 1500));

  const autocomplete = await send('Runtime.evaluate', {
    expression: `(() => {
      const popout = document.querySelector('[class*="autocomplete"]');
      return {
        hasPopout: !!popout,
        text: popout?.innerText?.split('\\n').filter(Boolean).slice(0, 15)
      };
    })()`,
    returnByValue: true
  });
  console.log('Autocomplete for /wiki:', JSON.stringify(autocomplete.result?.value, null, 2));

  // Clear slate
  await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', windowsVirtualKeyCode: 27 }); // Escape
  await send('Input.dispatchKeyEvent', { type: 'keyUp', windowsVirtualKeyCode: 27 });

  ws.close();
}

main().catch(console.error);
