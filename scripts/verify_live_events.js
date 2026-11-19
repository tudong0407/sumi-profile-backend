import http from 'http';
import WebSocket from 'ws';
import LZString from 'lz-string';

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
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

  const res = await send('Runtime.evaluate', {
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
      const aiMention = events.find(e => e.name?.includes('AI Mention'));
      const fubelV2 = events.find(e => e.name === 'Automod Fubel v2');

      return {
        aiMentionTree: aiMention?.compressed_tree,
        fubelV2Tree: fubelV2?.compressed_tree
      };
    })()`,
    returnByValue: true
  });

  const val = res.result?.value;
  if (val?.aiMentionTree) {
    const decompressed = LZString.decompressFromBase64(val.aiMentionTree);
    const parsed = JSON.parse(decompressed);
    console.log('AI Mention Elements count:', parsed.length);
    const hasTimeout = parsed.some(n => n.data?.type === 'timeout_action' || n.data?.data?.type === 'timeout_action');
    const toxicNode = parsed.find(n => n.id === 'act_toxic_timeout');
    console.log('AI Mention has timeout action:', hasTimeout, 'toxicNode found:', !!toxicNode);
  }

  if (val?.fubelV2Tree) {
    const decompressed = LZString.decompressFromBase64(val.fubelV2Tree);
    const parsed = JSON.parse(decompressed);
    console.log('Fubel V2 Elements count:', parsed.length);
    const condNode = parsed.find(n => n.id === 'cond_fubel_regex');
    console.log('Fubel V2 cond_fubel_regex exists:', !!condNode);
    if (condNode) {
      console.log('Fubel V2 conChild count:', condNode.data?.data?.conditions?.length);
    }
  }

  ws.close();
}

main().catch(console.error);
