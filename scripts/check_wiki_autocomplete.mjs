import WebSocket from 'ws';
import fs from 'fs';

// Check /wiki autocomplete by typing /wiki in Discord
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

  // Clear textbox first
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
  await new Promise(r => setTimeout(r, 300));

  // Type /wiki slowly
  for (const char of '/wiki') {
    await send('Input.dispatchKeyEvent', { type: 'keyDown', text: char, unmodifiedText: char });
    await send('Input.dispatchKeyEvent', { type: 'keyUp' });
    await new Promise(r => setTimeout(r, 120));
  }

  await new Promise(r => setTimeout(r, 2000));

  // Check autocomplete - look specifically for Nhiễm Nhiễm's /wiki
  const popout = await send('Runtime.evaluate', {
    expression: `(() => {
      const popout = document.querySelector('[class*="autocomplete"]');
      if (!popout) return { found: false };
      const items = Array.from(popout.querySelectorAll('[class*="autocompleteRow"], [class*="result"]'))
        .map(el => el.innerText);
      const allText = popout.innerText;
      return {
        found: true,
        hasNhiemNhiem: allText.includes('Nhiễm') || allText.includes('wiki') && !allText.includes('Wick') && !allText.includes('Arcane'),
        allItems: items.slice(0, 15),
        fullText: allText.split('\\n').filter(Boolean).slice(0, 20)
      };
    })()`,
    returnByValue: true
  });

  console.log('Wiki autocomplete:', JSON.stringify(popout.result?.value, null, 2));

  // Take screenshot of the autocomplete
  const screenshot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(
    'C:/Users/Fuyumi-ASUSF16/.gemini/antigravity/brain/6c4e030b-fb59-4575-8414-9779337f61d9/discord_wiki_autocomplete.png',
    Buffer.from(screenshot.data, 'base64')
  );
  console.log('Screenshot saved.');

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

  ws.close();
}

main().catch(console.error);
