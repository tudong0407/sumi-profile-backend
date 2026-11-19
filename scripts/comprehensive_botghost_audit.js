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
  if (!bg) throw new Error('Không tìm thấy tab BotGhost!');

  const ws = new WebSocket(bg.webSocketDebuggerUrl);
  await new Promise(r => ws.on('open', r));

  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 1000000);
    const timeout = setTimeout(() => reject(new Error(`CDP Timeout on ${method}`)), 20000);
    const h = (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.id === id) {
        clearTimeout(timeout);
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
      const slash = st?.data?.bot?.commands?.slash?.commands || [];
      const events = st?.data?.bot?.commands?.custom_events?.events || [];

      const profile = slash.find(c => c.name === 'profile');
      const rank = slash.find(c => c.name === 'rank');
      const aiMention = events.find(e => e.name?.includes('AI Mention'));

      return {
        botName: st?.data?.bot?.name,
        botId: st?.data?.bot?.id,
        lastSave: st?.data?.bot?.last_save,
        builderSaveRequired: st?.builder?.builderSaveRequired,
        cbValidateSave: cb ? cb.validateSave() : null,
        profile: profile ? {
          name: profile.name,
          int_id: profile.int_id,
          description: profile.description,
          options: profile.options,
          compressed_tree: profile.compressed_tree
        } : null,
        rank: rank ? {
          name: rank.name,
          int_id: rank.int_id,
          description: rank.description,
          options: rank.options,
          compressed_tree: rank.compressed_tree
        } : null,
        aiMention: aiMention ? {
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

  const data = res.result?.value;
  console.log('================ COMPREHENSIVE AUDIT REPORT ================');
  console.log('Bot:', data.botName, `(${data.botId})`);
  console.log('Cloud last_save:', data.lastSave);
  console.log('builderSaveRequired:', data.builderSaveRequired);
  console.log('CB validateSave():', data.cbValidateSave);
  console.log('------------------------------------------------------------');

  // Audit 1: /profile
  console.log('1. /profile Command:');
  if (data.profile) {
    console.log('   - Name:', data.profile.name);
    console.log('   - Description:', data.profile.description);
    console.log('   - Options:', JSON.stringify(data.profile.options));
    const tree = JSON.parse(LZString.decompressFromBase64(data.profile.compressed_tree));
    console.log('   - Nodes in tree:', tree.length);
    const action = tree.find(e => e.type === 'action');
    console.log('   - Embed Image URL:', action?.data?.data?.message?.embeds?.[0]?.image?.url);
  } else {
    console.log('   - NOT FOUND!');
  }
  console.log('------------------------------------------------------------');

  // Audit 2: /rank
  console.log('2. /rank Command:');
  if (data.rank) {
    console.log('   - Name:', data.rank.name);
    console.log('   - Description:', data.rank.description);
    console.log('   - Options:', JSON.stringify(data.rank.options));
    const tree = JSON.parse(LZString.decompressFromBase64(data.rank.compressed_tree));
    console.log('   - Nodes in tree:', tree.length);
    const action = tree.find(e => e.type === 'action');
    console.log('   - Embed Image URL:', action?.data?.data?.message?.embeds?.[0]?.image?.url);
  } else {
    console.log('   - NOT FOUND!');
  }
  console.log('------------------------------------------------------------');

  // Audit 3: AI Mention Event
  console.log('3. Nhiễm Nhiễm — AI Mention Event:');
  if (data.aiMention) {
    console.log('   - Name:', data.aiMention.name);
    console.log('   - Enabled:', data.aiMention.enabled);
    const tree = JSON.parse(LZString.decompressFromBase64(data.aiMention.compressed_tree));
    console.log('   - Nodes in tree:', tree.length);
    const timeoutNode = tree.find(e => e.id === 'act_toxic_timeout');
    console.log('   - Toxic Timeout Node exists:', !!timeoutNode);
    console.log('   - Timeout duration:', timeoutNode?.data?.data?.duration);
    console.log('   - Timeout reason:', timeoutNode?.data?.data?.reason);
    const regexCond = tree.find(e => e.id === 'conChild_other_toxic_true');
    console.log('   - Toxic Regex Pattern:', regexCond?.data?.data?.comparison_value);
    console.log('   - Regex length:', regexCond?.data?.data?.comparison_value?.length);
    console.log('   - Has curly braces {}:', /[{}]/.test(regexCond?.data?.data?.comparison_value || ''));
    const guardRoles = tree.find(e => e.id === 'conChild_toxic_guard_roles');
    console.log('   - Exempt Roles:', guardRoles?.data?.data?.id);
  } else {
    console.log('   - NOT FOUND!');
  }
  console.log('============================================================');

  ws.close();
}

main().catch(console.error);
