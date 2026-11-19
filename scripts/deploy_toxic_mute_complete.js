import http from 'http';
import WebSocket from 'ws';
import fs from 'fs';

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
  console.log('🚀 Bắt đầu quá trình nạp Automod Mute Toxic vào Nhiễm Nhiễm...');

  const tabs = await getJson('http://127.0.0.1:9222/json');
  const pageTarget = tabs.find(t => t.url?.includes('dashboard.botghost.com'));
  if (!pageTarget) {
    throw new Error('Không tìm thấy tab BotGhost!');
  }

  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
  await new Promise(r => ws.on('open', r));

  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 1000000);
    const timeout = setTimeout(() => reject(new Error(`CDP Timeout on ${method}`)), 25000);
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

  console.log('1. Đang kiểm tra vị trí hiện tại và chuyển tới customevents...');
  const currentUrl = (await send('Runtime.evaluate', { expression: 'window.location.href' })).result?.value;
  if (!currentUrl.includes('/customevents')) {
    await send('Page.navigate', { url: 'https://dashboard.botghost.com/dashboard/customevents' });
    await sleep(4000);
  }

  console.log('2. Mở accordion cho sự kiện "Nhiễm Nhiễm — AI Mention"...');
  let openBtnReady = false;
  for (let i = 0; i < 20; i++) {
    const stepRes = await send('Runtime.evaluate', {
      expression: `(() => {
        const h3 = Array.from(document.querySelectorAll('h3')).find(el => el.textContent?.includes('Nhiễm Nhiễm — AI Mention'));
        if (!h3) return { status: 'h3_not_found' };

        // Check if Open builder button is already visible in this accordion
        const openBtn = Array.from(document.querySelectorAll('button')).find(b => 
          b.textContent?.includes('Open builder') && b.textContent?.includes('Nhiễm Nhiễm — AI Mention')
        );
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

    const status = stepRes.result?.value?.status;
    console.log(`[Accordion check ${i+1}] status:`, status);
    if (status === 'open_btn_ready') {
      openBtnReady = true;
      break;
    }
    await sleep(1200);
  }

  if (!openBtnReady) {
    throw new Error('Không thể mở accordion cho Nhiễm Nhiễm — AI Mention');
  }

  await sleep(1000);

  console.log('3. Bấm nút "Open builder"...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => 
        b.textContent?.includes('Open builder') && b.textContent?.includes('Nhiễm Nhiễm — AI Mention')
      );
      if (btn) btn.click();
    })()`,
    returnByValue: true
  });

  console.log('4. Chờ CommandBuilder mount (tối đa 25s)...');
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

        return {
          ready: !!cb,
          elementsCount: cb?.props?.elements?.length
        };
      })()`,
      returnByValue: true
    });

    const val = cbCheck.result?.value;
    console.log(`[CB check ${i+1}] ready:`, val?.ready, 'elementsCount:', val?.elementsCount);
    if (val?.ready) {
      cbReady = true;
      break;
    }
  }

  if (!cbReady) {
    throw new Error('CommandBuilder không mount kịp!');
  }

  // 5. Đọc file JSON các elements mới
  const elementsJson = fs.readFileSync('C:/Users/Fuyumi-ASUSF16/.gemini/antigravity/scratch/sumi-profile-backend/ai_mention_tree_updated.json', 'utf8');

  console.log('5. Nạp elements mới vào CommandBuilder...');
  await send('Runtime.evaluate', {
    expression: `window.__newElementsJson = ${JSON.stringify(elementsJson)}; window.__newElements = JSON.parse(window.__newElementsJson);`,
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
    throw new Error('Validation thất bại! Status: ' + injectRes.result?.value?.isValid);
  }
  const lastSaveBefore = injectRes.result?.value?.lastSaveBefore;

  console.log('6. Gọi cb.save()...');
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

  console.log('7. Chờ cloud sync và kiểm tra lastSave...');
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
    console.log(`[Sync check ${i+1}] lastSave=${val?.lastSave}, builderSaveRequired=${val?.builderSaveRequired}`);

    if (val?.lastSave && val?.lastSave !== lastSaveBefore && val?.builderSaveRequired === false) {
      saved = true;
      console.log('🎉 NHIỄM NHIỄM — AI MENTION ĐÃ ĐƯỢC LƯU LÊN CLOUD THÀNH CÔNG VỚI TOXIC MUTE!');
      break;
    }
  }

  ws.close();
  if (!saved) {
    throw new Error('Save verification timeout!');
  }
}

main().catch(console.error);
