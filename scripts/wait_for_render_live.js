import WebSocket from 'ws';

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  const tabs = await fetch('http://127.0.0.1:9222/json').then(r => r.json());
  const rTab = tabs.find(t => t.type === 'page' && t.url?.includes('dashboard.render.com'));
  const ws = new WebSocket(rTab.webSocketDebuggerUrl);
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

  console.log('Monitoring deploy status...');
  for (let i = 0; i < 30; i++) {
    const res = await send('Runtime.evaluate', {
      expression: `(() => {
        const text = document.body.innerText;
        const building = text.includes('Building') || text.includes('Deploying');
        const live = text.includes('84fdd07') && text.includes('Live');
        const lines = text.split('\\n').map(l => l.trim()).filter(Boolean);
        const deployIdx = lines.findIndex(l => l.includes('feat: integrate 20 high-res transparent pet assets'));
        const slice = deployIdx >= 0 ? lines.slice(deployIdx - 5, deployIdx + 15) : lines.slice(30, 60);
        return { building, live, slice };
      })()`,
      returnByValue: true
    });

    const val = res.result?.value;
    console.log(`[${i+1}] Building: ${val?.building}, Live: ${val?.live}`);
    if (val?.slice) {
      console.log('Sample:', val.slice.slice(0, 6).join(' | '));
    }

    if (val?.live && !val?.building) {
      console.log('>>> DEPLOY 84fdd07 IS LIVE! <<<');
      break;
    }
    await sleep(5000);
  }

  ws.close();
}

main().catch(console.error);
