import http from 'http';
import WebSocket from 'ws';
import LZString from 'lz-string';
import fs from 'fs';

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
  const pageTarget = tabs.find(t => t.url?.includes('dashboard.botghost.com'));

  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
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

  console.log('1. Reading automod_fubel_edit_updated.json...');
  const newElementsJson = fs.readFileSync('C:/Users/Fuyumi-ASUSF16/.gemini/antigravity/scratch/sumi-profile-backend/automod_fubel_edit_updated.json', 'utf8');

  console.log('2. Uploading elements to browser memory...');
  await send('Runtime.evaluate', {
    expression: `window.__newElementsJson = ${JSON.stringify(newElementsJson)}; window.__newElements = JSON.parse(window.__newElementsJson);`,
    returnByValue: true
  });

  console.log('3. Injecting elements into CommandBuilder & checking validation...');
  const injectRes = await send('Runtime.evaluate', {
    expression: `(() => {
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

      cb.props.setSelected(null);
      cb.props.setElements(window.__newElements);
      cb.props.setBuilderSaveRequired(true);

      document.querySelector('.react-flow__controls-fitview')?.click();

      return {
        isValid: cb.validateSave(),
        elementsCount: cb.props.elements?.length,
        lastSaveBefore: store?.getState()?.data?.bot?.last_save
      };
    })()`,
    returnByValue: true
  });

  console.log('Inject Result:', injectRes.result?.value);
  const lastSaveBefore = injectRes.result?.value?.lastSaveBefore;

  console.log('4. Triggering cb.save() directly...');
  const saveCall = await send('Runtime.evaluate', {
    expression: `(async () => {
      const root = document.querySelector('#root');
      const key = Object.keys(root).find(k => k.startsWith('__reactContainer$'));
      let cb = null;
      function search(fiber) {
        if (!fiber) return;
        if (fiber.stateNode?.validateSave && fiber.stateNode?.buildCommand) cb = fiber.stateNode;
        search(fiber.child);
        search(fiber.sibling);
      }
      search(root[key]);

      // Call cb.save()
      try {
        await cb.save();
        return { success: true };
      } catch (err) {
        return { error: String(err) };
      }
    })()`,
    awaitPromise: true,
    returnByValue: true
  });

  console.log('Save call result:', saveCall.result?.value);

  console.log('5. Waiting for cloud sync (checking modal and lastSave update)...');
  let saved = false;
  for (let i = 0; i < 30; i++) {
    await sleep(1000);

    // Click modal Save anyway if present
    await send('Runtime.evaluate', {
      expression: `(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Save anyway'));
        if (btn) btn.click();
      })()`,
      returnByValue: true
    });

    const check = await send('Runtime.evaluate', {
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
          builderSaveRequired: st?.builder?.builderSaveRequired,
          lastSave: st?.data?.bot?.last_save
        };
      })()`,
      returnByValue: true
    });

    const val = check.result?.value;
    console.log(`[Polling ${i+1}/30] builderSaveRequired=${val?.builderSaveRequired}, lastSave=${val?.lastSave}`);

    if (val?.lastSave && val?.lastSave !== lastSaveBefore && val?.builderSaveRequired === false) {
      saved = true;
      console.log('🎉 SỰ KIỆN ĐÃ ĐƯỢC LƯU LÊN CLOUD THÀNH CÔNG!');
      break;
    }
  }

  console.log('6. Auditing Cloud state...');
  const audit = await send('Runtime.evaluate', {
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
      const events = store?.getState()?.data?.bot?.commands?.custom_events?.events || [];
      const ev = events.find(e => e.name === 'Automod Fubel (Edit)');
      return {
        name: ev?.name,
        enabled: ev?.enabled,
        compressed_tree: ev?.compressed_tree
      };
    })()`,
    returnByValue: true
  });

  const cloudEv = audit.result?.value;
  const decompressed = JSON.parse(LZString.decompressFromBase64(cloudEv.compressed_tree));

  const p1 = decompressed.find(e => e.id === 'conChild_fubel_1');
  const p6 = decompressed.find(e => e.id === 'conChild_fubel_6');
  const p8 = decompressed.find(e => e.id === 'conChild_fubel_8');

  console.log('✅ AUDIT CLOUD RESULT for Automod Fubel (Edit):');
  console.log('   - Enabled:', cloudEv.enabled);
  console.log('   - Total Elements:', decompressed.length);
  console.log('   - conChild_fubel_1 length:', p1?.data?.data?.comparison_value?.length, 'verified:', p1?.data?.data?.comparison_value?.includes('zxх'));
  console.log('   - conChild_fubel_6 length:', p6?.data?.data?.comparison_value?.length, 'verified:', p6?.data?.data?.comparison_value?.includes('zxх'));
  console.log('   - conChild_fubel_8 length:', p8?.data?.data?.comparison_value?.length, 'verified:', p8?.data?.data?.comparison_value?.includes('zxх'));

  ws.close();
}

main().catch(console.error);
