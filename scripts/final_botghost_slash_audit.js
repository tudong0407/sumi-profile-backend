import WebSocket from 'ws';
import LZString from 'lz-string';

async function main() {
  const tabs = await fetch('http://127.0.0.1:9222/json').then(r => r.json());
  const bg = tabs.find(t => t.url?.includes('botghost.com'));
  const ws = new WebSocket(bg.webSocketDebuggerUrl);
  await new Promise(r => ws.on('open', r));

  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = 123;
    ws.on('message', (d) => {
      const m = JSON.parse(d.toString());
      if (m.id === id) resolve(m.result);
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
      const slashCmds = st?.data?.bot?.commands?.slash?.commands || [];
      const profile = slashCmds.find(c => c.name === 'profile');
      const rank = slashCmds.find(c => c.name === 'rank');

      return {
        url: window.location.href,
        lastSave: st?.data?.bot?.last_save,
        builderSaveRequired: st?.builder?.builderSaveRequired,
        profileCmd: profile ? {
          name: profile.name,
          description: profile.description,
          compressed_tree: profile.compressed_tree
        } : null,
        rankCmd: rank ? {
          name: rank.name,
          description: rank.description,
          compressed_tree: rank.compressed_tree
        } : null,
        cbValidation: cb ? cb.validateSave() : null
      };
    })()`,
    returnByValue: true
  });

  const data = res.result?.value;
  console.log('=== BOTGHOST CLOUD AUDIT REPORT ===');
  console.log(`Cloud Last Save: ${data.lastSave}`);
  console.log(`Builder Save Required: ${data.builderSaveRequired}`);
  console.log(`CommandBuilder validateSave: ${data.cbValidation}`);

  function auditCommand(cmd, expectedImgUrlPrefix) {
    console.log(`\n--------------------------------------------`);
    console.log(`Command: /${cmd.name}`);
    console.log(`Description: ${cmd.description}`);
    if (!cmd.compressed_tree) {
      console.error(`ERROR: No compressed_tree found for /${cmd.name}!`);
      return false;
    }
    const nodes = JSON.parse(LZString.decompressFromBase64(cmd.compressed_tree));
    console.log(`Persisted React Flow Nodes Count: ${nodes.length}`);

    const rootNode = nodes.find(n => n.type === 'root');
    const optNode = nodes.find(n => n.type === 'option');
    const actionNode = nodes.find(n => n.type === 'action');

    console.log(`Root: name="${rootNode?.data?.title}", desc="${rootNode?.data?.description}"`);
    console.log(`Option: name="${optNode?.data?.data?.name}", type="${optNode?.data?.data?.type}", req=${optNode?.data?.data?.required}`);

    const content = actionNode?.data?.data?.message?.content;
    const embeds = actionNode?.data?.data?.message?.embeds || [];
    const emb = embeds[0];

    console.log(`Action Message Content: "${content}" (empty: ${content === ''})`);
    console.log(`Embed Count: ${embeds.length}`);
    console.log(`Embed Title: "${emb?.title}"`);
    console.log(`Embed Description: "${emb?.description}" (empty: ${emb?.description === ''})`);
    console.log(`Embed Image URL: "${emb?.image?.url}"`);

    const contentClean = content === '';
    const descClean = emb?.description === '';
    const urlMatches = emb?.image?.url?.includes(expectedImgUrlPrefix);

    console.log(`Audit Checks:`);
    console.log(`  - Outside message content clean: ${contentClean ? 'PASS' : 'FAIL'}`);
    console.log(`  - Embed description clean: ${descClean ? 'PASS' : 'FAIL'}`);
    console.log(`  - Image URL valid: ${urlMatches ? 'PASS' : 'FAIL'}`);

    return contentClean && descClean && urlMatches;
  }

  const profilePass = auditCommand(data.profileCmd, 'https://sumi-profile-backend.onrender.com/api/profile/');
  const rankPass = auditCommand(data.rankCmd, 'https://sumi-profile-backend.onrender.com/api/rank/');

  console.log(`\n============================================`);
  console.log(`FINAL VERIFICATION STATUS: ${profilePass && rankPass && !data.builderSaveRequired ? 'ALL PASS (PRODUCTION READY)' : 'FAILED'}`);
  console.log(`============================================\n`);

  ws.close();
}

main().catch(console.error);
