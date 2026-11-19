import WebSocket from 'ws';
import LZString from 'lz-string';

async function verify() {
  const targetsRes = await fetch('http://127.0.0.1:9222/json/list');
  const targets = await targetsRes.json();
  const builderTarget = targets.find(t => t.url?.includes('dashboard.botghost.com'));

  const ws = new WebSocket(builderTarget.webSocketDebuggerUrl);
  await new Promise(r => ws.on('open', r));

  const res = await new Promise(resolve => {
    ws.on('message', data => {
      const parsed = JSON.parse(data.toString());
      if (parsed.id === 1) resolve(parsed.result);
    });
    ws.send(JSON.stringify({
      id: 1,
      method: 'Runtime.evaluate',
      params: {
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
          const ev = store?.getState()?.data?.bot?.commands?.custom_events?.events?.find(e => e.name === 'Nhiễm Nhiễm — AI Mention');
          return ev?.compressed_tree;
        })()`,
        returnByValue: true
      }
    }));
  });

  ws.close();

  const compressed = res?.value;
  console.log('Retrieved cloud compressed_tree length:', compressed?.length);
  const decompressed = LZString.decompressFromBase64(compressed);
  const elements = JSON.parse(decompressed);

  const timeoutNode = elements.find(e => e.id === 'act_toxic_timeout');
  const condNode = elements.find(e => e.id === 'cond_other_check_toxic');
  const condChild = elements.find(e => e.id === 'conChild_other_toxic_true');
  const successReply = elements.find(e => e.id === 'act_toxic_reply_success');

  console.log('✅ act_toxic_timeout exists in Cloud:', !!timeoutNode, 'duration:', timeoutNode?.data?.data?.duration);
  console.log('✅ cond_other_check_toxic exists in Cloud:', !!condNode);
  console.log('✅ conChild_other_toxic_true pattern exists:', !!condChild, 'pattern length:', condChild?.data?.data?.comparison_value?.length);
  console.log('✅ act_toxic_reply_success messages count:', successReply?.data?.data?.messages?.length);
}

verify().catch(console.error);
