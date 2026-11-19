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

  console.log('Saving /profile command in BotGhost...');

  const saveRes = await send('Runtime.evaluate', {
    expression: `(async () => {
      const root = document.querySelector('#root');
      const key = Object.keys(root).find(k => k.startsWith('__reactContainer$'));
      let cb = null;
      let store = null;
      function search(fiber) {
        if (!fiber) return;
        if (fiber.memoizedProps?.store) store = fiber.memoizedProps.store;
        if (fiber.stateNode?.validateSave && fiber.stateNode?.buildCommand) cb = fiber.stateNode;
        search(fiber.child);
        search(fiber.sibling);
      }
      search(root[key]);

      const initialLastSave = store?.getState()?.data?.bot?.last_save;

      let saveMethod = null;
      if (cb && typeof cb.save === 'function') {
        saveMethod = 'cb.save()';
        await cb.save();
      } else {
        const btns = Array.from(document.querySelectorAll('button'));
        const saveBtn = btns.find(b => b.textContent.includes('Save Command') || b.textContent.includes('Save'));
        if (saveBtn) {
          saveMethod = 'saveBtn.click()';
          saveBtn.click();
        }
      }

      return {
        saveMethod,
        initialLastSave
      };
    })()`,
    awaitPromise: true,
    returnByValue: true
  });

  console.log('Save triggered:', saveRes.result?.value);
  console.log('Waiting 6 seconds for cloud sync...');
  await sleep(6000);

  const verifyRes = await send('Runtime.evaluate', {
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
      const lastSave = st?.data?.bot?.last_save;
      const cmds = st?.data?.bot?.commands?.slash?.commands || [];
      const savedProfile = cmds.find(c => c.name === 'profile');

      return {
        lastSave,
        builderSaveRequired: st?.builder?.builderSaveRequired,
        savedProfile: savedProfile ? {
          name: savedProfile.name,
          desc: savedProfile.description,
          optionsCount: savedProfile.options?.length,
          compressedLength: savedProfile.compressed_tree?.length
        } : null
      };
    })()`,
    returnByValue: true
  });

  console.log('Verify saved state:', JSON.stringify(verifyRes.result?.value, null, 2));
  ws.close();
}

main().catch(console.error);
