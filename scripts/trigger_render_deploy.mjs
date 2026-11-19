import WebSocket from 'ws';

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

  // Re-click Manual Deploy if menu closed, then click Deploy latest commit
  const deployTrigger = await send('Runtime.evaluate', {
    expression: `(() => {
      let latestBtn = Array.from(document.querySelectorAll('*')).find(el => el.textContent.trim() === 'Deploy latest commit');
      if (!latestBtn) {
        const manualBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.trim() === 'Manual Deploy');
        if (manualBtn) manualBtn.click();
      }
      return { found: !!latestBtn };
    })()`,
    returnByValue: true
  });
  console.log('Deploy button check:', deployTrigger.result?.value);
  await new Promise(r => setTimeout(r, 1000));

  const clickLatest = await send('Runtime.evaluate', {
    expression: `(() => {
      const latestBtn = Array.from(document.querySelectorAll('*')).find(el => el.textContent.trim() === 'Deploy latest commit');
      if (latestBtn) {
        latestBtn.click();
        return { clicked: true };
      }
      return { clicked: false };
    })()`,
    returnByValue: true
  });
  console.log('Click latest commit result:', clickLatest.result?.value);

  // Now wait and poll the page for the new deploy
  console.log('Waiting for deploy to initiate...');
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 5000));
    const status = await send('Runtime.evaluate', {
      expression: `(() => {
        const text = document.body.innerText;
        const lines = text.split('\\n').filter(Boolean);
        // Find lines mentioning e17773e or in progress or building or live
        const deployLines = lines.filter(l => l.includes('e17773e') || l.includes('Building') || l.includes('Deploying') || l.includes('Live') || l.includes('feat: complete'));
        return {
          currentUrl: window.location.href,
          deployLines: deployLines.slice(0, 10)
        };
      })()`,
      returnByValue: true
    });
    console.log(`[${i * 5}s] Deploy status:`, JSON.stringify(status.result?.value?.deployLines));

    // Also check if /api/wiki responds 200
    try {
      const checkRes = await fetch('https://sumi-profile-backend.onrender.com/api/wiki');
      if (checkRes.status === 200) {
        console.log('SUCCESS! /api/wiki responded 200 OK!');
        break;
      } else {
        console.log(`Live /api/wiki returned HTTP ${checkRes.status}`);
      }
    } catch (e) {
      console.log('Fetch error:', e.message);
    }
  }

  ws.close();
}

main().catch(console.error);
