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
      const events = st?.data?.bot?.commands?.custom_events?.events || [];
      const aiMention = events.find(e => e.name?.includes('AI Mention'));

      return {
        currentBuilderMode: st?.builder?.mode,
        currentBuilderIndex: st?.builder?.index,
        builderSaveRequired: st?.builder?.builderSaveRequired,
        validateSave: cb ? cb.validateSave() : null,
        aiMentionCloud: aiMention ? {
          name: aiMention.name,
          int_id: aiMention.int_id,
          enabled: aiMention.enabled,
          last_save: aiMention.last_save,
          compressed_tree: aiMention.compressed_tree
        } : null
      };
    })()`,
    returnByValue: true
  });

  const val = res.result?.value;
  console.log('Builder status:', {
    currentBuilderMode: val?.currentBuilderMode,
    currentBuilderIndex: val?.currentBuilderIndex,
    builderSaveRequired: val?.builderSaveRequired,
    validateSave: val?.validateSave
  });

  if (val?.aiMentionCloud?.compressed_tree) {
    const raw = LZString.decompressFromBase64(val.aiMentionCloud.compressed_tree);
    const elements = JSON.parse(raw);
    console.log('Cloud AI Mention elements:', elements.length);
    const toxicCond = elements.find(n => n.id === 'conChild_other_toxic_true');
    console.log('Toxic regex pattern:', toxicCond?.data?.data?.comparison_value);
    console.log('Regex length:', toxicCond?.data?.data?.comparison_value?.length);
    const hasBraces = /[{}]/.test(toxicCond?.data?.data?.comparison_value || '');
    console.log('Has braces {}:', hasBraces);

    const guardOwner = elements.find(n => n.id === 'conChild_toxic_guard_owner');
    console.log('Guard owner ID:', guardOwner?.data?.data?.comparison_value);

    const guardPerms = elements.find(n => n.id === 'conChild_toxic_guard_perms');
    console.log('Guard perms:', guardPerms?.data?.data?.permissions);

    const guardRoles = elements.find(n => n.id === 'conChild_toxic_guard_roles');
    console.log('Guard roles:', guardRoles?.data?.data?.id);
  }

  ws.close();
}

main().catch(console.error);
