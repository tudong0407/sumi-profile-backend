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

  await send('Network.enable');

  // Listen for network requests
  const networkLogs = [];
  ws.on('message', (data) => {
    const msg = JSON.parse(data.toString());
    if (msg.method === 'Network.requestWillBeSent') {
      networkLogs.push(msg.params.request.url);
    }
  });

  // Check how the Run button works
  const inspectBtn = await send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const runBtn = btns.find(b => b.textContent.includes('Run'));
      if (!runBtn) return { found: false };

      // Look at React props on runBtn
      const key = Object.keys(runBtn).find(k => k.startsWith('__reactFiber$') || k.startsWith('__reactProps$'));
      const props = key ? runBtn[key] : null;

      // Try triggering click with full event simulation
      runBtn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      runBtn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
      runBtn.click();

      return {
        found: true,
        text: runBtn.textContent,
        disabled: runBtn.disabled,
        hasOnClick: typeof runBtn.onclick === 'function' || !!props?.onClick || !!props?.memoizedProps?.onClick
      };
    })()`,
    returnByValue: true
  });

  console.log('Inspect button:', inspectBtn.result?.value);
  await sleep(4000);

  console.log('Network requests triggered during click:', networkLogs.slice(-10));

  // Also check if there is an error message on screen
  const pageErrors = await send('Runtime.evaluate', {
    expression: `(() => {
      const errEls = Array.from(document.querySelectorAll('[role="alert"], .text-destructive, .text-amber-500, .text-red-500'))
        .map(e => e.textContent.trim());
      return { errors: errEls };
    })()`,
    returnByValue: true
  });

  console.log('Page errors:', pageErrors.result?.value);
  ws.close();
}

main().catch(console.error);
