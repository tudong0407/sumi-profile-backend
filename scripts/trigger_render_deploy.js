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

  // Navigate to service overview
  console.log('Navigating to service overview...');
  await send('Page.navigate', { url: 'https://dashboard.render.com/web/srv-dbvfq3h5efls73dmsa8g' });
  await sleep(4000);

  const res = await send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim());
      const links = Array.from(document.querySelectorAll('a')).map(a => a.href);
      return {
        url: window.location.href,
        buttons: btns,
        publicUrl: links.find(l => l.includes('.onrender.com'))
      };
    })()`,
    returnByValue: true
  });

  console.log('Service page:', JSON.stringify(res.result?.value, null, 2));

  // Click Manual Deploy button
  console.log('Looking for Manual Deploy button...');
  const deployRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const manualBtn = btns.find(b => b.textContent.includes('Manual Deploy') || b.textContent.includes('Deploy'));
      if (manualBtn) {
        manualBtn.click();
        return { clicked: true, text: manualBtn.textContent };
      }
      return { clicked: false };
    })()`,
    returnByValue: true
  });
  console.log('Manual deploy click:', deployRes.result?.value);
  await sleep(1000);

  // Click "Deploy latest commit" or "Clear build cache & deploy"
  const commitRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const items = Array.from(document.querySelectorAll('[role="menuitem"], button, a, div[role="menu"] *'))
        .filter(el => el.textContent.includes('Clear build cache') || el.textContent.includes('latest commit'));
      if (items.length > 0) {
        items[0].click();
        return { clicked: true, text: items[0].textContent.trim() };
      }
      return { clicked: false };
    })()`,
    returnByValue: true
  });
  console.log('Deploy commit click:', commitRes.result?.value);

  ws.close();
}

main().catch(console.error);
