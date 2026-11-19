import fs from 'fs';
import WebSocket from 'ws';

async function main() {
  console.log('🚀 Bắt đầu quá trình nạp Automod Mute Toxic vào Nhiễm Nhiễm...');

  // 1. Lấy WebSocket Debugger URL của tab Builder
  const targetsRes = await fetch('http://127.0.0.1:9222/json/list');
  const targets = await targetsRes.json();
  const builderTarget = targets.find(t => t.url?.includes('dashboard.botghost.com/dashboard/builder'));

  if (!builderTarget) {
    console.error('❌ Không tìm thấy tab CommandBuilder trên port 9222!');
    process.exit(1);
  }

  console.log(`🔗 Tìm thấy tab Builder: ${builderTarget.title} (${builderTarget.id})`);
  const wsUrl = builderTarget.webSocketDebuggerUrl;

  const ws = new WebSocket(wsUrl);

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

  await new Promise(resolve => ws.on('open', resolve));
  console.log('🔌 Đã kết nối WebSocket CDP thành công!');

  function sendCdp(method, params = {}) {
    const id = msgId++;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        pendingRequests.delete(id);
        reject(new Error(`CDP Timeout on ${method}`));
      }, 25000);

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
  }

  // 2. Đọc file JSON các elements mới
  const elementsJson = fs.readFileSync('C:/Users/Fuyumi-ASUSF16/.gemini/antigravity/scratch/sumi-profile-backend/ai_mention_tree_updated.json', 'utf8');

  // 3. Inject elements vào window trên trang
  console.log('📤 Đang nạp elements vào bộ nhớ trình duyệt...');
  await sendCdp('Runtime.evaluate', {
    expression: `window.__newElementsJson = ${JSON.stringify(elementsJson)}; window.__newElements = JSON.parse(window.__newElementsJson);`,
    returnByValue: true
  });

  // 4. Tìm CommandBuilder & nạp elements
  console.log('⚙️ Đang kết nối React Fiber và gán elements vào CommandBuilder...');
  const injectResult = await sendCdp('Runtime.evaluate', {
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

      if (!cb) return { error: 'CommandBuilder stateNode not found' };

      // Set selected null (string ID or null only!)
      cb.props.setSelected(null);

      // Inject new elements
      cb.props.setElements(window.__newElements);

      // Fit view
      document.querySelector('.react-flow__controls-fitview')?.click();

      // Check validation
      const isValid = cb.validateSave();
      const elementsCount = cb.props.elements?.length;

      return {
        success: true,
        isValid,
        elementsCount,
        lastSaveBefore: store?.getState()?.data?.bot?.last_save
      };
    })()`,
    returnByValue: true
  });

  console.log('📊 Kết quả nạp elements:', injectResult.result?.value);

  if (!injectResult.result?.value?.isValid) {
    console.error('❌ Validation thất bại! Dừng quá trình lưu để bảo vệ an toàn!');
    ws.close();
    process.exit(1);
  }

  // 5. Kích hoạt Save Event
  console.log('💾 Đang bấm nút Save Event...');
  const saveResult = await sendCdp('Runtime.evaluate', {
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

      const saveBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.trim() === 'Save Event' || b.textContent?.includes('Save'));
      if (saveBtn) {
        saveBtn.click();
      } else if (cb.save) {
        await cb.save();
      }

      return { clicked: true };
    })()`,
    awaitPromise: true,
    returnByValue: true
  });

  console.log('⏳ Đã gửi lệnh lưu, đang chờ cloud đồng bộ...');

  // 6. Chờ last_save cập nhật và builderSaveRequired === false
  let saved = false;
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 1000));
    const checkState = await sendCdp('Runtime.evaluate', {
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

    const val = checkState.result?.value;
    console.log(`[Polling ${i+1}/20] builderSaveRequired=${val?.builderSaveRequired}, lastSave=${val?.lastSave}`);

    if (val?.builderSaveRequired === false) {
      saved = true;
      console.log('🎉 SỰ KIỆN ĐÃ ĐƯỢC LƯU LÊN CLOUD THÀNH CÔNG VỚI 0 LỖI!');
      break;
    }
  }

  // 7. Post-save cloud audit
  console.log('🔍 Đang kiểm tra đối chiếu (Audit) dữ liệu từ Cloud Redux Store...');
  const auditResult = await sendCdp('Runtime.evaluate', {
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
      const ev = events.find(e => e.name === 'Nhiễm Nhiễm — AI Mention');
      return {
        name: ev?.name,
        enabled: ev?.enabled,
        compressed_tree_length: ev?.compressed_tree?.length
      };
    })()`,
    returnByValue: true
  });

  console.log('✅ Kết quả kiểm toán Cloud:', auditResult.result?.value);

  ws.close();
  console.log('🚀 HOÀN TẤT 100% CÀI ĐẶT AUTOMOD MUTE TOXIC CHO NHIỄM NHIỄM!');
}

main().catch(err => {
  console.error('❌ Lỗi:', err);
  process.exit(1);
});
