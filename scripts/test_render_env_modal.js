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

  // Click Free plan
  const freeClick = await send('Runtime.evaluate', {
    expression: `(() => {
      const allEls = Array.from(document.querySelectorAll('*'));
      const freeEl = allEls.find(e => e.children.length === 0 && e.textContent.trim() === 'Free');
      if (freeEl) {
        const card = freeEl.closest('div[tabindex], div[role="radio"], button') || freeEl.parentElement;
        card.click();
        return { clicked: true, text: card.textContent.slice(0, 50) };
      }
      return { clicked: false };
    })()`,
    returnByValue: true
  });
  console.log('Free plan click:', freeClick.result?.value);
  await sleep(500);

  // Click "Add from .env"
  const addEnvClick = await send('Runtime.evaluate', {
    expression: `(() => {
      const addEnvBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Add from .env'));
      if (addEnvBtn) {
        addEnvBtn.click();
        return { clicked: true };
      }
      return { clicked: false };
    })()`,
    returnByValue: true
  });
  console.log('Add from .env click:', addEnvClick.result?.value);
  await sleep(1000);

  // Check what appeared (e.g. textarea, dialog, etc.)
  const dialogRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const textareas = Array.from(document.querySelectorAll('textarea')).map(t => ({
        placeholder: t.placeholder,
        name: t.name,
        id: t.id
      }));
      const dialog = document.querySelector('[role="dialog"]');
      const dialogBtns = dialog ? Array.from(dialog.querySelectorAll('button')).map(b => b.textContent.trim()) : [];
      return {
        textareas,
        hasDialog: !!dialog,
        dialogBtns
      };
    })()`,
    returnByValue: true
  });

  console.log('Dialog state:', JSON.stringify(dialogRes.result?.value, null, 2));
  ws.close();
}

main().catch(console.error);
