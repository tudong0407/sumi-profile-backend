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
  const renderTab = tabs.find(t => t.url?.includes('render.com'));
  const ws = new WebSocket(renderTab.webSocketDebuggerUrl);
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

  console.log('Monitoring deploy dep-dbvfs6u7bikc738ge73g...');

  for (let i = 0; i < 20; i++) {
    const res = await send('Runtime.evaluate', {
      expression: `(() => {
        const text = document.body.innerText;
        const statusEl = document.querySelector('[data-testid="deploy-status"]') || 
          Array.from(document.querySelectorAll('*')).find(el => el.children.length === 0 && (el.textContent.trim() === 'Live' || el.textContent.trim() === 'Building...' || el.textContent.trim() === 'Deploying...' || el.textContent.trim() === 'Deploy failed'));
        
        const logs = Array.from(document.querySelectorAll('code, pre, [data-testid*="log"], .font-mono'))
          .map(el => el.textContent.trim())
          .filter(t => t.length > 5 && !t.includes('New log entries'));

        return {
          status: statusEl ? statusEl.textContent.trim() : 'Unknown',
          recentLogs: logs.slice(-10)
        };
      })()`,
      returnByValue: true
    });

    const data = res.result?.value;
    console.log(`[Check ${i + 1}] Status: ${data?.status}`);
    if (data?.recentLogs && data.recentLogs.length > 0) {
      console.log('Last log:', data.recentLogs[data.recentLogs.length - 1]);
    }

    if (data?.status === 'Live') {
      console.log('DEPLOY SUCCESSFUL! SERVICE IS LIVE!');
      break;
    }
    if (data?.status === 'Deploy failed') {
      console.log('DEPLOY FAILED!');
      console.log('Logs:\n', data.recentLogs.join('\n'));
      break;
    }

    await sleep(5000);
  }

  ws.close();
}

main().catch(console.error);
