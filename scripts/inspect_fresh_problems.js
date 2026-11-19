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
  const bg = tabs.find(t => t.url?.includes('dashboard.botghost.com'));
  const ws = new WebSocket(bg.webSocketDebuggerUrl);
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

  console.log('Clicking "Build a new command"...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.textContent.includes('Build a new command'));
      if (btn) btn.click();
    })()`
  });
  await sleep(4000);

  // If there is an onboarding/modal, dismiss it
  await send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const skipBtn = btns.find(b => b.textContent.includes('Skip for now'));
      if (skipBtn) skipBtn.click();
    })()`
  });
  await sleep(1000);

  // Click Problems button
  const probInfo = await send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const probBtn = btns.find(b => b.textContent.includes('Problem'));
      if (probBtn) probBtn.click();

      const dialogs = Array.from(document.querySelectorAll('[role="dialog"], [class*="popover"], [class*="dropdown"]'))
        .map(d => d.innerText);

      return {
        probBtnText: probBtn ? probBtn.textContent.trim() : null,
        dialogs
      };
    })()`,
    returnByValue: true
  });

  console.log('Problems dialog info:', JSON.stringify(probInfo.result?.value, null, 2));
  ws.close();
}

main().catch(console.error);
