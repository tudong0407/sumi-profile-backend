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

  console.log('Finding Manual Deploy button...');
  const openMenu = await send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.textContent.trim() === 'Manual Deploy');
      if (btn) {
        btn.click();
        return { clicked: true };
      }
      return { clicked: false };
    })()`,
    returnByValue: true
  });
  console.log('Open menu:', openMenu.result?.value);
  await sleep(1000);

  // Find exact menu items
  const menuItems = await send('Runtime.evaluate', {
    expression: `(() => {
      const allEls = Array.from(document.querySelectorAll('button, a, div[role="menuitem"], li'));
      const deployCommitBtn = allEls.find(el => el.children.length <= 2 && el.textContent.trim().startsWith('Deploy latest commit'));
      const clearCacheBtn = allEls.find(el => el.children.length <= 2 && el.textContent.trim().startsWith('Clear build cache'));
      
      const target = clearCacheBtn || deployCommitBtn;
      if (target) {
        target.click();
        return { clicked: true, text: target.textContent.trim() };
      }
      return { clicked: false, available: allEls.map(e => e.textContent.trim()).filter(t => t.includes('commit') || t.includes('cache')) };
    })()`,
    returnByValue: true
  });
  console.log('Click item:', menuItems.result?.value);

  await sleep(4000);

  const check = await send('Runtime.evaluate', {
    expression: `(() => {
      return {
        url: window.location.href,
        textSnippet: document.body.innerText.slice(0, 1000)
      };
    })()`,
    returnByValue: true
  });

  console.log('After trigger state:', check.result?.value?.url);
  ws.close();
}

main().catch(console.error);
