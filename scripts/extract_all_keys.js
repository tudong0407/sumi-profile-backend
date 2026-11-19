import http from 'http';
import WebSocket from 'ws';

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  const tabs = await getJson('http://127.0.0.1:9222/json');
  const supa = tabs.find(t => t.url?.includes('supabase.com/dashboard/project/lfvtysacdoadtvskqgkt'));
  const ws = new WebSocket(supa.webSocketDebuggerUrl);
  await new Promise(r => ws.on('open', r));

  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 1000000);
    const h = (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.id === id) {
        ws.off('message', h);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      }
    };
    ws.on('message', h);
    ws.send(JSON.stringify({ id, method, params }));
  });

  // Click "Reveal API key"
  await send('Runtime.evaluate', {
    expression: `(() => {
      const revealBtn = document.querySelector('button[aria-label="Reveal API key"]');
      if (revealBtn) revealBtn.click();
    })()`
  });
  await sleep(1000);

  // Read the secret key text
  const keys = await send('Runtime.evaluate', {
    expression: `(() => {
      const texts = Array.from(document.querySelectorAll('code, span, div, td'))
        .map(e => e.textContent.trim())
        .filter(t => t.startsWith('sb_publishable_') || t.startsWith('sb_secret_') || t.startsWith('eyJ'));
      return [...new Set(texts)];
    })()`,
    returnByValue: true
  });

  console.log('Extracted keys:', keys.result?.value);

  // Also let's check legacy API keys
  await send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button, a'));
      const legacyBtn = btns.find(b => b.textContent.includes('View legacy API keys'));
      if (legacyBtn) legacyBtn.click();
    })()`
  });
  await sleep(1500);

  const legacyKeys = await send('Runtime.evaluate', {
    expression: `(() => {
      const allText = document.body.innerText;
      const jwts = Array.from(document.querySelectorAll('code, span, div, td, input'))
        .map(e => e.value || e.textContent.trim())
        .filter(t => t.startsWith('eyJ'));
      return { jwts: [...new Set(jwts)] };
    })()`,
    returnByValue: true
  });

  console.log('Legacy keys:', legacyKeys.result?.value);
  ws.close();
}

main().catch(console.error);
