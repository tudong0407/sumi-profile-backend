import WebSocket from 'ws';
import LZString from 'lz-string';

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  const tabs = await fetch('http://127.0.0.1:9222/json').then(r => r.json());
  const bg = tabs.find(t => t.url?.includes('dashboard.botghost.com'));
  const ws = new WebSocket(bg.webSocketDebuggerUrl);
  await new Promise(r => ws.on('open', r));

  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 1000000);
    const timeout = setTimeout(() => reject(new Error(`CDP Timeout on ${method}`)), 25000);
    const h = (d) => {
      const msg = JSON.parse(d);
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

  console.log('--- SAVING /profile VIA MOUNTED CB ---');
  // First, extract profile command from store
  const getProfile = await send('Runtime.evaluate', {
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

      const slashCmds = store?.getState()?.data?.bot?.commands?.slash?.commands || [];
      const idx = slashCmds.findIndex(c => c.name === 'profile');
      return {
        idx,
        cmd: slashCmds[idx],
        tree: slashCmds[idx]?.compressed_tree
      };
    })()`,
    returnByValue: true
  });

  const { idx: profileIdx, cmd: profileCmd, tree: profileTree } = getProfile.result?.value;
  console.log(`Found /profile at index ${profileIdx}`);

  // Decompress and modify
  let pTreeObj = JSON.parse(LZString.decompressFromBase64(profileTree));
  let pAction = pTreeObj.find(n => n.id === 'action_profile' || n.type === 'action');
  if (pAction) {
    pAction.data.data.message.embeds[0].image.url = 
      'https://sumi-profile-backend.onrender.com/api/profile/{option_user}.png?fallback_id={user_id}&username={option_user_username}&fallback_name={user_name}&avatar={option_user_avatar}&fallback_avatar={user_icon}&v=2';
    pAction.data.data.message.content = '';
    pAction.data.data.message.embeds[0].description = '';
  }

  // Inject elements, set index, and save
  const saveP = await send('Runtime.evaluate', {
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

      const elements = ${JSON.stringify(pTreeObj)};
      cb.props.setBuilderIndex(${profileIdx});
      if (cb.props.setSelected) cb.props.setSelected(null);
      cb.props.setElements(elements);

      const isValid = cb.validateSave();
      let saveRes = null;
      if (isValid) {
        saveRes = await cb.save();
      }
      return { isValid, saveRes };
    })()`,
    awaitPromise: true,
    returnByValue: true
  });
  console.log('Saved /profile:', saveP.result?.value);
  await sleep(4000);

  console.log('\n--- SAVING /rank VIA MOUNTED CB ---');
  const getRank = await send('Runtime.evaluate', {
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

      const slashCmds = store?.getState()?.data?.bot?.commands?.slash?.commands || [];
      const idx = slashCmds.findIndex(c => c.name === 'rank');
      return {
        idx,
        cmd: slashCmds[idx],
        tree: slashCmds[idx]?.compressed_tree
      };
    })()`,
    returnByValue: true
  });

  const { idx: rankIdx, cmd: rankCmd, tree: rankTree } = getRank.result?.value;
  console.log(`Found /rank at index ${rankIdx}`);

  let rTreeObj = JSON.parse(LZString.decompressFromBase64(rankTree));
  let rAction = rTreeObj.find(n => n.id === 'action_rank' || n.type === 'action');
  if (rAction) {
    rAction.data.data.message.embeds[0].image.url = 
      'https://sumi-profile-backend.onrender.com/api/rank/{option_user}.png?fallback_id={user_id}&username={option_user_username}&fallback_name={user_name}&avatar={option_user_avatar}&fallback_avatar={user_icon}&v=2';
    rAction.data.data.message.content = '';
    rAction.data.data.message.embeds[0].description = '';
  }

  const saveR = await send('Runtime.evaluate', {
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

      const elements = ${JSON.stringify(rTreeObj)};
      cb.props.setBuilderIndex(${rankIdx});
      if (cb.props.setSelected) cb.props.setSelected(null);
      cb.props.setElements(elements);

      const isValid = cb.validateSave();
      let saveRes = null;
      if (isValid) {
        saveRes = await cb.save();
      }
      return { isValid, saveRes };
    })()`,
    awaitPromise: true,
    returnByValue: true
  });
  console.log('Saved /rank:', saveR.result?.value);
  await sleep(4000);

  // Final check of last_save in cloud
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
      const st = store?.getState();
      return {
        lastSave: st?.data?.bot?.last_save,
        builderSaveRequired: st?.builder?.builderSaveRequired
      };
    })()`,
    returnByValue: true
  });
  console.log('Cloud audit result:', audit.result?.value);

  ws.close();
}

main().catch(console.error);
