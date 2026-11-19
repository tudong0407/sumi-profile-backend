import fs from 'fs';
import path from 'path';
import WebSocket from 'ws';

async function main() {
  const tabs = await fetch('http://127.0.0.1:9222/json').then(r => r.json());
  const bgTab = tabs.find(t => t.url?.includes('botghost.com') && t.type === 'page');
  if (!bgTab) {
    console.error('BotGhost tab not found');
    return;
  }

  const ws = new WebSocket(bgTab.webSocketDebuggerUrl);
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

  // Navigate to customcommands to show /wiki card
  await send('Page.navigate', { url: 'https://dashboard.botghost.com/dashboard/customcommands' });
  await new Promise(r => setTimeout(r, 4000));

  // Expand /wiki card
  await send('Runtime.evaluate', {
    expression: `(() => {
      const h3 = Array.from(document.querySelectorAll('h3')).find(h => h.textContent.trim() === '/wiki');
      if (h3) {
        h3.scrollIntoView({ behavior: 'smooth', block: 'center' });
        h3.click();
      }
    })()`
  });
  await new Promise(r => setTimeout(r, 1500));

  const screenshot = await send('Page.captureScreenshot', { format: 'png' });
  const buffer = Buffer.from(screenshot.data, 'base64');
  
  const docsDir = path.resolve('docs');
  if (!fs.existsSync(docsDir)) fs.mkdirSync(docsDir, { recursive: true });

  const outPath = path.join(docsDir, 'evidence_botghost_wiki_live.png');
  fs.writeFileSync(outPath, buffer);
  console.log(`Saved BotGhost live screenshot to ${outPath} (${buffer.length} bytes)`);

  ws.close();
}

main().catch(console.error);
