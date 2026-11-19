import WebSocket from 'ws';

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  const tabs = await fetch('http://127.0.0.1:9222/json').then(r => r.json());
  const renderTab = tabs.find(t => t.url?.includes('render.com/web/srv-dbvfq3h5efls73dmsa8g'));
  const ws = new WebSocket(renderTab.webSocketDebuggerUrl);
  await new Promise(r => ws.on('open', r));

  const send = (m, p = {}) => new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 100000);
    const h = (d) => {
      const msg = JSON.parse(d.toString());
      if (msg.id === id) { ws.off('message', h); resolve(msg.result); }
    };
    ws.on('message', h);
    ws.send(JSON.stringify({ id, method: m, params: p }));
  });

  for (let i = 0; i < 30; i++) {
    const res = await send('Runtime.evaluate', {
      expression: `(() => {
        const text = document.body.innerText;
        return {
          isBuilding: text.includes('Building') || text.includes('Deploy in progress') || text.includes('In progress'),
          isLive: text.includes('Live') && !text.includes('Building'),
          sample: text.slice(0, 400)
        };
      })()`,
      returnByValue: true
    });

    try {
      const hRes = await fetch('https://sumi-profile-backend.onrender.com/health').then(r => r.json());
      console.log(`[Poll ${i+1}] Health status:`, hRes.status, 'uptime:', Math.round(hRes.uptime), 'supabase_connected:', hRes.supabase_connected);
      if (hRes.supabase_connected === true) {
        console.log('🎉 SUCCESS! Render backend is live with supabase_connected: true!');
        break;
      }
    } catch (e) {
      console.log(`[Poll ${i+1}] Health fetch err:`, e.message);
    }

    await sleep(6000);
  }

  ws.close();
}

main().catch(console.error);
