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

  // Click "Start building" or "Skip for now"
  const clickRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const skipBtn = btns.find(b => b.textContent.includes('Skip for now'));
      const startBtn = btns.find(b => b.textContent.includes('Start building'));
      if (skipBtn) {
        skipBtn.click();
        return { clicked: 'Skip for now' };
      }
      if (startBtn) {
        startBtn.click();
        return { clicked: 'Start building' };
      }
      return { clicked: null };
    })()`,
    returnByValue: true
  });

  console.log('Modal dismiss click:', clickRes.result?.value);
  await sleep(1500);

  // Check save button state
  const saveCheck = await send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const saveBtn = btns.find(b => b.textContent.includes('Save'));
      return {
        saveText: saveBtn ? saveBtn.textContent.trim() : null,
        disabled: saveBtn ? saveBtn.disabled : null
      };
    })()`,
    returnByValue: true
  });
  console.log('Save button after dismiss:', saveCheck.result?.value);

  // If save button says "Save", click it!
  const saveClick = await send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const saveBtn = btns.find(b => b.textContent.includes('Save') && !b.disabled);
      if (saveBtn) {
        saveBtn.click();
        return { clicked: true, text: saveBtn.textContent.trim() };
      }
      return { clicked: false };
    })()`,
    returnByValue: true
  });
  console.log('Save click result:', saveClick.result?.value);

  await sleep(4000);

  const finalState = await send('Runtime.evaluate', {
    expression: `(() => {
      const root = document.querySelector('#root');
      const key = Object.keys(root).find(k => k.startsWith('__reactContainer$'));
      let store = null;
      function search(fiber) {
        if (!fiber) return;
        if (fiber.memoizedProps?.store) store = fiber.memoizedProps.store;
        search(fiber.child);
        search(fiber.sibling);
      }
      search(root[key]);
      const st = store?.getState();
      return {
        lastSave: st?.data?.bot?.last_save,
        builderSaveRequired: st?.builder?.builderSaveRequired,
        cmds: st?.data?.bot?.commands?.slash?.commands?.map(c => c.name)
      };
    })()`,
    returnByValue: true
  });

  console.log('Final state:\n', JSON.stringify(finalState.result?.value, null, 2));
  ws.close();
}

main().catch(console.error);
