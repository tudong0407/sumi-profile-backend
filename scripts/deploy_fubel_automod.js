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

async function createCdpClient() {
  const tabs = await getJson('http://127.0.0.1:9222/json');
  const pageTarget = tabs.find(t => t.url?.includes('dashboard.botghost.com'));
  if (!pageTarget) throw new Error('BotGhost tab not found');

  const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);
  await new Promise(r => ws.on('open', r));

  let msgId = 1;
  const pendingRequests = new Map();

  ws.on('message', data => {
    const parsed = JSON.parse(data.toString());
    if (parsed.id && pendingRequests.has(parsed.id)) {
      const { resolve, reject } = pendingRequests.get(parsed.id);
      pendingRequests.delete(parsed.id);
      if (parsed.error) reject(parsed.error);
      else resolve(parsed.result);
    }
  });

  const send = (method, params = {}) => {
    const id = msgId++;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        pendingRequests.delete(id);
        reject(new Error(`CDP Timeout on ${method}`));
      }, 35000);

      pendingRequests.set(id, {
        resolve: val => {
          clearTimeout(timeout);
          resolve(val);
        },
        reject: err => {
          clearTimeout(timeout);
          reject(err);
        }
      });

      ws.send(JSON.stringify({ id, method, params }));
    });
  };

  const close = () => ws.close();

  return { send, close };
}

async function deploySingleEvent(eventName, jsonFilePath) {
  console.log(`\n======================================================`);
  console.log(`🚀 BẮT ĐẦU TRIỂN KHAI CHO SỰ KIỆN: "${eventName}"`);
  console.log(`======================================================`);

  const client = await createCdpClient();
  const { send, close } = client;

  try {
    // 1. Kiểm tra URL hiện tại
    const pageInfo = await send('Runtime.evaluate', {
      expression: `window.location.href`,
      returnByValue: true
    });
    console.log('Current URL:', pageInfo.result?.value);

    // Nếu không ở customevents, điều hướng về customevents
    if (!pageInfo.result?.value?.includes('/dashboard/customevents')) {
      console.log('Navigating to /dashboard/customevents...');
      await send('Page.navigate', { url: 'https://dashboard.botghost.com/dashboard/customevents' });
      await sleep(3500);
    }

    // 2. Chờ trang tải hoàn tất và mở accordion
    console.log(`Đang tìm kiếm card "${eventName}"...`);
    let openBtnReady = false;

    for (let i = 0; i < 20; i++) {
      const stepRes = await send('Runtime.evaluate', {
        expression: `(() => {
          const h3 = Array.from(document.querySelectorAll('h3')).find(el => el.textContent?.trim() === ${JSON.stringify(eventName)});
          if (!h3) return { status: 'h3_not_found' };

          // Check if an open builder button is already visible near this h3
          let container = h3;
          while (container && !container.className?.includes('rounded-') && container !== document.body) {
            container = container.parentElement;
          }

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
      // One more check for open btn
      const finalCheck = await send('Runtime.evaluate', {
        expression: `!!Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Open builder'))`,
        returnByValue: true
      });
      if (!finalCheck.result?.value) {
        throw new Error(`Không thể mở accordion cho "${eventName}"!`);
      }
    }

    await sleep(1000);

    // 3. Click nút Open builder
    console.log('Đang click nút "Open builder"...');
    const openRes = await send('Runtime.evaluate', {
      expression: `(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Open builder'));
        if (!btn) return { clicked: false };
        btn.click();
        return { clicked: true };
      })()`,
      returnByValue: true
    });
    console.log('Open builder click result:', openRes.result?.value);

    // 4. Chờ URL chuyển sang /dashboard/builder và CommandBuilder mount
    console.log('Đang chờ CommandBuilder mount...');
    let cbReady = false;
    for (let i = 0; i < 25; i++) {
      await sleep(1000);
      const cbCheck = await send('Runtime.evaluate', {
        expression: `(() => {
          if (!window.location.href.includes('/dashboard/builder')) {
            return { ready: false, reason: 'url not builder yet' };
          }
          const root = document.querySelector('#root');
          if (!root) return { ready: false, reason: 'no root' };
          const key = Object.keys(root).find(k => k.startsWith('__reactContainer$'));
          if (!key) return { ready: false, reason: 'no reactContainer' };
          let cb = null;
          function search(fiber) {
            if (!fiber) return;
            if (fiber.stateNode?.validateSave && fiber.stateNode?.buildCommand) cb = fiber.stateNode;
            search(fiber.child);
            search(fiber.sibling);
          }
          search(root[key]);
          if (!cb) return { ready: false, reason: 'no cb' };
          return { ready: true, elementsCount: cb.props?.elements?.length };
        })()`,
        returnByValue: true
      });

      if (cbCheck.result?.value?.ready) {
        cbReady = true;
        console.log(`✅ CommandBuilder đã mount thành công! Số block hiện tại: ${cbCheck.result?.value?.elementsCount}`);
        break;
      }
    }

    if (!cbReady) {
      throw new Error(`CommandBuilder không mount kịp trong thời gian quy định cho "${eventName}"!`);
    }

    await sleep(1500);

    // 5. Đọc file JSON và nạp elements
    const newElementsJson = fs.readFileSync(jsonFilePath, 'utf8');
    console.log(`📤 Đang nạp ${jsonFilePath} vào CommandBuilder...`);

    await send('Runtime.evaluate', {
      expression: `window.__newElementsJson = ${JSON.stringify(newElementsJson)}; window.__newElements = JSON.parse(window.__newElementsJson);`,
      returnByValue: true
    });

    const injectRes = await send('Runtime.evaluate', {
      expression: `(() => {
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

        // Clear selection to avoid dangling reference
        cb.props.setSelected(null);
        cb.props.setElements(window.__newElements);

        // Fit view
        document.querySelector('.react-flow__controls-fitview')?.click();

        return {
          isValid: cb.validateSave(),
          elementsCount: cb.props.elements?.length
        };
      })()`,
      returnByValue: true
    });

    console.log('Inject Result:', injectRes.result?.value);
    if (!injectRes.result?.value?.isValid) {
      throw new Error('Validation thất bại sau khi nạp elements!');
    }

    await sleep(1000);

    // 6. Nhấn nút Save Event
    console.log('💾 Đang bấm nút Save Event...');
    await send('Runtime.evaluate', {
      expression: `(async () => {
        const saveBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.trim() === 'Save Event' || b.textContent?.includes('Save'));
        if (saveBtn) saveBtn.click();
      })()`,
      returnByValue: true
    });

    // 7. Xử lý modal cảnh báo nếu có (Save anyway) và chờ save xong
    console.log('⏳ Đang đợi Cloud đồng bộ...');
    let saveCompleted = false;

    for (let i = 0; i < 30; i++) {
      await sleep(1000);

      // Check modal "Save anyway"
      await send('Runtime.evaluate', {
        expression: `(() => {
          const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Save anyway'));
          if (btn) {
            console.log('Found modal Save anyway, clicking...');
            btn.click();
          }
        })()`,
        returnByValue: true
      });

      const stCheck = await send('Runtime.evaluate', {
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

      const val = stCheck.result?.value;
      console.log(`[Polling ${i+1}/30] builderSaveRequired=${val?.builderSaveRequired}, lastSave=${val?.lastSave}`);

      if (val?.builderSaveRequired === false) {
        saveCompleted = true;
        console.log(`🎉 SỰ KIỆN "${eventName}" ĐÃ ĐƯỢC LƯU THÀNH CÔNG LÊN CLOUD!`);
        break;
      }
    }

    if (!saveCompleted) {
      throw new Error(`Quá thời gian chờ lưu cho "${eventName}"!`);
    }

    // 8. Post-save Cloud Audit
    console.log(`🔍 Đang kiểm tra đối chiếu (Audit) "${eventName}" từ Cloud Redux Store...`);
    const auditRes = await send('Runtime.evaluate', {
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
        const ev = events.find(e => e.name === ${JSON.stringify(eventName)});
        return {
          name: ev?.name,
          enabled: ev?.enabled,
          compressed_tree: ev?.compressed_tree
        };
      })()`,
      returnByValue: true
    });

    const cloudEv = auditRes.result?.value;
    const decompressed = JSON.parse(LZString.decompressFromBase64(cloudEv.compressed_tree));

    const p1Node = decompressed.find(e => e.id === 'conChild_fubel_1');
    const p6Node = decompressed.find(e => e.id === 'conChild_fubel_6');
    const p8Node = decompressed.find(e => e.id === 'conChild_fubel_8');

    console.log(`✅ [AUDIT CLOUD] Event "${eventName}":`);
    console.log(`   - Enabled: ${cloudEv.enabled}`);
    console.log(`   - Elements Count: ${decompressed.length}`);
    console.log(`   - conChild_fubel_1 length: ${p1Node?.data?.data?.comparison_value?.length} (Pattern verified: ${p1Node?.data?.data?.comparison_value?.includes('zxх')})`);
    console.log(`   - conChild_fubel_6 length: ${p6Node?.data?.data?.comparison_value?.length} (Pattern verified: ${p6Node?.data?.data?.comparison_value?.includes('zxх')})`);
    console.log(`   - conChild_fubel_8 length: ${p8Node?.data?.data?.comparison_value?.length} (Pattern verified: ${p8Node?.data?.data?.comparison_value?.includes('zxх')})`);

  } finally {
    close();
  }
}

async function main() {
  console.log('🌟 BẮT ĐẦU QUÁ TRÌNH TRIỂN KHAI VÁ AUTOMOD FUBEL...');
  
  // 1. Triển khai Automod Fubel v2
  await deploySingleEvent('Automod Fubel v2', 'C:/Users/Fuyumi-ASUSF16/.gemini/antigravity/scratch/sumi-profile-backend/automod_fubel_v2_updated.json');

  // Chờ 3 giây
  await sleep(3000);

  // 2. Triển khai Automod Fubel (Edit)
  await deploySingleEvent('Automod Fubel (Edit)', 'C:/Users/Fuyumi-ASUSF16/.gemini/antigravity/scratch/sumi-profile-backend/automod_fubel_edit_updated.json');

  console.log('\n✨✨✨ HOÀN TẤT TRIỂN KHAI CẢ 2 SỰ KIỆN AUTOMOD FUBEL THÀNH CÔNG 100%! ✨✨✨');
}

main().catch(err => {
  console.error('❌ Lỗi triển khai:', err);
  process.exit(1);
});
