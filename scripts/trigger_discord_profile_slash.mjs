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

  // Focus textbox
  await send('Runtime.evaluate', {
    expression: `(() => {
      const slate = document.querySelector('[role="textbox"][contenteditable="true"]');
      if (slate) {
        slate.focus();
        return true;
      }
      return false;
    })()`
  });
  await new Promise(r => setTimeout(r, 500));

  // Type /profile
  console.log('Typing /profile...');
  for (const char of '/profile') {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', text: char, unmodifiedText: char });
    await send('Input.dispatchKeyEvent', { type: 'keyUp' });
    await new Promise(r => setTimeout(r, 100));
  }

  await new Promise(r => setTimeout(r, 1500));

  // Check if autocomplete popup is visible
  const autocomplete = await send('Runtime.evaluate', {
    expression: `(() => {
      const popout = document.querySelector('[class*="autocomplete"]');
      return {
        hasPopout: !!popout,
        text: popout?.innerText?.split('\\n').filter(Boolean).slice(0, 10)
      };
    })()`,
    returnByValue: true
  });
  console.log('Autocomplete state:', autocomplete.result?.value);

  // Press Enter to select command
  console.log('Pressing Enter to select slash command...');
  await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', windowsVirtualKeyCode: 13, unmodifiedText: '\r', text: '\r' });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', windowsVirtualKeyCode: 13 });
  await new Promise(r => setTimeout(r, 1000));

  // Press Enter again to execute
  console.log('Pressing Enter to execute command...');
  await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', windowsVirtualKeyCode: 13, unmodifiedText: '\r', text: '\r' });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', windowsVirtualKeyCode: 13 });

  // Wait 6 seconds for response
  console.log('Waiting 6 seconds for Nhiễm Nhiễm response...');
  await new Promise(r => setTimeout(r, 6000));

  // Check messages
  const lastMsg = await send('Runtime.evaluate', {
    expression: `(() => {
      const msgs = Array.from(document.querySelectorAll('li[class*="messageListItem"]')).slice(-3);
      return msgs.map(m => {
        const imgs = Array.from(m.querySelectorAll('img')).map(i => ({ src: i.src, alt: i.alt }));
        return {
          text: m.innerText,
          imgs
        };
      });
    })()`,
    returnByValue: true
  });
  console.log('Last messages:', JSON.stringify(lastMsg.result?.value, null, 2));

  // Capture screenshot of new message
  const screenshot = await send('Page.captureScreenshot', { format: 'png' });
  const buffer = Buffer.from(screenshot.data, 'base64');
  fs.writeFileSync('docs/evidence_discord_profile_executed.png', buffer);
  console.log('Captured screenshot docs/evidence_discord_profile_executed.png');

  ws.close();
}

main().catch(console.error);
