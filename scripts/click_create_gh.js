import http from 'http';
import WebSocket from 'ws';

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  const tabs = await getJson('http://127.0.0.1:9222/json');
  const ghTarget = tabs.find(t => t.url?.includes('github.com/new'));

  const ws = new WebSocket(ghTarget.webSocketDebuggerUrl);
  await new Promise(r => ws.on('open', r));

  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 1000000);
    const timeout = setTimeout(() => reject(new Error('CDP Timeout')), 25000);
    const handler = (data) => {
      const parsed = JSON.parse(data.toString());
      if (parsed.id === id) {
        clearTimeout(timeout);
        ws.off('message', handler);
        if (parsed.error) reject(parsed.error);
        else resolve(parsed.result);
      }
    };
    ws.on('message', handler);
    ws.send(JSON.stringify({ id, method, params }));
  });

  console.log('Clicking Create repository...');
  const clickRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.trim() === 'Create repository');
      if (!btn) return { error: 'no btn' };
      btn.click();
      return { clicked: true };
    })()`,
    returnByValue: true
  });

  console.log('Click result:', clickRes.result?.value);

  let repoUrl = null;
  for (let i = 0; i < 20; i++) {
    await sleep(1000);
    const check = await send('Runtime.evaluate', {
      expression: `window.location.href`,
      returnByValue: true
    });
    const url = check.result?.value;
    console.log(`[URL Check ${i+1}] ${url}`);
    if (url && !url.includes('/new') && url.includes('github.com')) {
      repoUrl = url;
      break;
    }
  }

  console.log('Final Repository URL:', repoUrl);
  ws.close();
}

main().catch(console.error);
