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

  console.log('1. Navigating to customevents...');
  await send('Page.navigate', { url: 'https://dashboard.botghost.com/dashboard/customevents' });
  await sleep(3500);

  console.log('2. Opening accordion for "Automod Fubel v2"...');
  let openBtnReady = false;
  for (let i = 0; i < 20; i++) {
    const stepRes = await send('Runtime.evaluate', {
      expression: `(() => {
        const h3 = Array.from(document.querySelectorAll('h3')).find(el => el.textContent?.trim() === 'Automod Fubel v2');
        if (!h3) return { status: 'h3_not_found' };

        // Check if an open builder button is already visible near this h3
        let openBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Open builder'));
        if (openBtn) {
          return { status: 'open_btn_ready' };
        }

        // Click the cursor-pointer header to open accordion
        let header = h3;
        while (header && !header.className?.includes('cursor-pointer') && header !== document.body) {
          header = header.parentElement;
        }
        if (header) {
          header.click();
          return { status: 'clicked_header' };
        }

        return { status: 'no_header' };
      })()`,
      returnByValue: true
    });

    console.log(`[Accordion check ${i+1}] status:`, stepRes.result?.value?.status);
    if (stepRes.result?.value?.status === 'open_btn_ready') {
      openBtnReady = true;
      break;
    }
    await sleep(1200);
  }

  if (!openBtnReady) {
    throw new Error('Không thể mở accordion cho Automod Fubel v2');
  }

  await sleep(1000);

  console.log('3. Clicking "Open builder"...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Open builder'));
      if (btn) btn.click();
    })()`,
    returnByValue: true
  });

  console.log('4. Waiting for CommandBuilder mount...');
  let cbReady = false;
  for (let i = 0; i < 25; i++) {
    await sleep(1000);
    const cbCheck = await send('Runtime.evaluate', {
      expression: `(() => {
        if (!window.location.href.includes('/dashboard/builder')) {
          return { ready: false, reason: 'url not builder yet' };
        }
        const root = document.querySelector('#root');
        if (!root) return { ready: false };
        const key = Object.keys(root).find(k => k.startsWith('__reactContainer$'));
        if (!key) return { ready: false };
        let cb = null;
        function search(fiber) {
          if (!fiber) return;
          if (fiber.stateNode?.validateSave && fiber.stateNode?.buildCommand) cb = fiber.stateNode;
          search(fiber.child);
          search(fiber.sibling);
        }
        search(root[key]);
        if (!cb) return { ready: false };
        return { ready: true, elementsCount: cb.props?.elements?.length };
      })()`,
      returnByValue: true
    });

    if (cbCheck.result?.value?.ready) {
      cbReady = true;
      console.log(`✅ CommandBuilder đã mount! Số element: ${cbCheck.result?.value?.elementsCount}`);
      break;
    }
  }

  if (!cbReady) {
    throw new Error('CommandBuilder không mount kịp!');
  }

  await sleep(1500);

  console.log('5. Injecting automod_fubel_v2_updated.json...');
  const newElementsJson = fs.readFileSync('C:/Users/Fuyumi-ASUSF16/.gemini/antigravity/scratch/sumi-profile-backend/automod_fubel_v2_updated.json', 'utf8');

  await send('Runtime.evaluate', {
    expression: `window.__newElementsJson = ${JSON.stringify(newElementsJson)}; window.__newElements = JSON.parse(window.__newElementsJson);`,
    returnByValue: true
  });

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
  if (!injectRes.result?.value?.isValid) {
    throw new Error('Validation thất bại!');
  }
  const lastSaveBefore = injectRes.result?.value?.lastSaveBefore;

  console.log('6. Calling cb.save() directly...');
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

  console.log('7. Waiting for cloud sync (checking modal and lastSave update)...');
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
      console.log('🎉 SỰ KIỆN "Automod Fubel v2" ĐÃ ĐƯỢC LƯU THÀNH CÔNG LÊN CLOUD!');
      break;
    }
  }

  console.log('8. Auditing Cloud state for Automod Fubel v2...');
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
      const ev = events.find(e => e.name === 'Automod Fubel v2');
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

  console.log('✅ AUDIT CLOUD RESULT for Automod Fubel v2:');
  console.log('   - Enabled:', cloudEv.enabled);
  console.log('   - Total Elements:', decompressed.length);
  console.log('   - conChild_fubel_1 length:', p1?.data?.data?.comparison_value?.length, 'verified:', p1?.data?.data?.comparison_value?.includes('zxх'));
  console.log('   - conChild_fubel_6 length:', p6?.data?.data?.comparison_value?.length, 'verified:', p6?.data?.data?.comparison_value?.includes('zxх'));
  console.log('   - conChild_fubel_8 length:', p8?.data?.data?.comparison_value?.length, 'verified:', p8?.data?.data?.comparison_value?.includes('zxх'));

  ws.close();
}

main().catch(console.error);
