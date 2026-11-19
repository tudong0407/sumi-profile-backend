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
    const id = 12345;
    ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.id === id) resolve(msg.result);
    });
    ws.send(JSON.stringify({ id, method, params }));
  });

  const res = await send('Runtime.evaluate', {
    expression: `(() => {
      const root = document.querySelector('#root');
      const key = Object.keys(root).find(k => k.startsWith('__reactContainer$'));
      let store = null;
      let cb = null;
      function search(fiber) {
        if (!fiber) return;
        if (fiber.memoizedProps?.store) store = fiber.memoizedProps.store;
        if (fiber.stateNode?.validateSave && fiber.stateNode?.buildCommand) cb = fiber.stateNode;
        search(fiber.child);
        search(fiber.sibling);
      }
      search(root[key]);

      const st = store?.getState();
      const profile = st?.data?.bot?.commands?.slash?.commands?.find(c => c.name === 'profile');

      return {
        builderSaveRequired: st?.builder?.builderSaveRequired,
        lastSave: st?.data?.bot?.last_save,
        profile: profile ? {
          name: profile.name,
          int_id: profile.int_id,
          description: profile.description,
          options: profile.options,
          hasTree: !!profile.compressed_tree,
          compressed_tree: profile.compressed_tree
        } : null
      };
    })()`,
    returnByValue: true
  });

  const val = res.result?.value;
  console.log('Profile Cloud Audit:');
  console.log('builderSaveRequired:', val?.builderSaveRequired);
  console.log('lastSave:', val?.lastSave);
  console.log('profile meta:', {
    name: val?.profile?.name,
    int_id: val?.profile?.int_id,
    desc: val?.profile?.description,
    options: val?.profile?.options,
    hasTree: val?.profile?.hasTree
  });

  if (val?.profile?.compressed_tree) {
    const raw = LZString.decompressFromBase64(val.profile.compressed_tree);
    const elements = JSON.parse(raw);
    console.log('Profile elements in tree:', elements.length);
    const actionNode = elements.find(e => e.type === 'action');
    console.log('Embed URL in action:', actionNode?.data?.data?.message?.embeds?.[0]?.image?.url);
  }

  ws.close();
}

main().catch(console.error);
