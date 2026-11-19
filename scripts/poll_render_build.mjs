import WebSocket from 'ws';

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  const tabs = await fetch('http://127.0.0.1:9222/json').then(r => r.json());
  let targetTab = tabs.find(t => t.url?.includes('render.com'));
  const ws = new WebSocket(targetTab.webSocketDebuggerUrl);
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

  console.log('Monitoring Render build for commit e17773e...');
  const startTime = Date.now();

  for (let i = 0; i < 30; i++) {
    await sleep(8000);
    const elapsed = Math.round((Date.now() - startTime) / 1000);

    const info = await send('Runtime.evaluate', {
      expression: `(() => {
        const text = document.body.innerText;
        const lines = text.split('\\n').filter(Boolean);
        const idx = lines.findIndex(l => l.includes('Most recent deploy'));
        if (idx !== -1) {
          return lines.slice(idx, idx + 12).join(' | ');
        }
        return 'No "Most recent deploy" found. First 10: ' + lines.slice(0, 10).join(' | ');
      })()`,
      returnByValue: true
    });
    console.log(`[${elapsed}s] ${info.result?.value}`);

    // Check live endpoint /health and /api/wiki
    try {
      const wikiRes = await fetch('https://sumi-profile-backend.onrender.com/api/wiki');
      if (wikiRes.status === 200) {
        const wikiData = await wikiRes.json();
        console.log(`🎉 [${elapsed}s] DEPLOY COMPLETE! /api/wiki returned 200 OK with ${wikiData.categories?.length} categories!`);
        break;
      }
    } catch (e) {
      // ignore
    }
  }

  ws.close();
}

main().catch(console.error);
