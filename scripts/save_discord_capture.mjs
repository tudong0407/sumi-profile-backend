import fs from 'fs';
import path from 'path';
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

  // Scroll to bottom
  await send('Runtime.evaluate', {
    expression: `(() => {
      const scroller = document.querySelector('[class*="messagesWrapper"] [class*="scroller"]');
      if (scroller) scroller.scrollTop = scroller.scrollHeight;
    })()`
  });
  await new Promise(r => setTimeout(r, 1000));

  const screenshot = await send('Page.captureScreenshot', { format: 'png' });
  const buffer = Buffer.from(screenshot.data, 'base64');
  
  const docsDir = path.resolve('docs');
  if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });

  const outPath = path.join(docsDir, 'evidence_discord_live_profile_0527.png');
  fs.writeFileSync(outPath, buffer);
  console.log(`Saved Discord live screenshot to ${outPath} (${buffer.length} bytes)`);

  ws.close();
}

main().catch(console.error);
