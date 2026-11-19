import WebSocket from 'ws';
import LZString from 'lz-string';

const ws = new WebSocket('ws://127.0.0.1:9222/devtools/page/09AF917DBDF33A24B65C73CEF52FDF61');

ws.on('open', async () => {
  const send = (method, params = {}) => new Promise((resolve) => {
    const id = Math.floor(Math.random() * 1000000);
    const h = (d) => {
      const msg = JSON.parse(d);
      if (msg.id === id) {
        ws.off('message', h);
        resolve(msg.result);
      }
    };
    ws.on('message', h);
    ws.send(JSON.stringify({ id, method, params }));
  });

  // First fetch the current compressed trees
  const getTrees = await send('Runtime.evaluate', {
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
      const profile = slashCmds.find(c => c.name === 'profile');
      const rank = slashCmds.find(c => c.name === 'rank');
      return {
        profileTree: profile?.compressed_tree,
        rankTree: rank?.compressed_tree
      };
    })()`,
    returnByValue: true
  });

  const { profileTree, rankTree } = getTrees.result?.value;

  // Decompress and update profile in node
  let profileTreeObj = JSON.parse(LZString.decompressFromBase64(profileTree));
  let actionBlockP = profileTreeObj.find(n => n.id === 'action_profile' || n.type === 'action');
  if (actionBlockP) {
    actionBlockP.data.data.message.embeds[0].image.url = 
      'https://sumi-profile-backend.onrender.com/api/profile/{option_user}.png?fallback_id={user_id}&username={option_user_username}&fallback_name={user_name}&avatar={option_user_avatar}&fallback_avatar={user_icon}&v=2';
    actionBlockP.data.data.message.content = '';
    actionBlockP.data.data.message.embeds[0].description = '';
  }
  const newProfileTree = LZString.compressToBase64(JSON.stringify(profileTreeObj));

  // Decompress and update rank in node
  let rankTreeObj = JSON.parse(LZString.decompressFromBase64(rankTree));
  let actionBlockR = rankTreeObj.find(n => n.id === 'action_rank' || n.type === 'action');
  if (actionBlockR) {
    actionBlockR.data.data.message.embeds[0].image.url = 
      'https://sumi-profile-backend.onrender.com/api/rank/{option_user}.png?fallback_id={user_id}&username={option_user_username}&fallback_name={user_name}&avatar={option_user_avatar}&fallback_avatar={user_icon}&v=2';
    actionBlockR.data.data.message.content = '';
    actionBlockR.data.data.message.embeds[0].description = '';
  }
  const newRankTree = LZString.compressToBase64(JSON.stringify(rankTreeObj));

  // Now execute saveBot in browser
  const res = await send('Runtime.evaluate', {
    expression: `(async () => {
      const root = document.querySelector('#root');
      const key = Object.keys(root).find(k => k.startsWith('__reactContainer$'));
      let store = null;
      let targetFiber = null;
      function search(fiber) {
        if (!fiber) return;
        if (fiber.memoizedProps?.store) store = fiber.memoizedProps.store;
        if (typeof fiber.memoizedProps?.saveBot === 'function') targetFiber = fiber;
        search(fiber.child);
        search(fiber.sibling);
      }
      search(root[key]);

      if (!targetFiber) return { error: 'No targetFiber with saveBot' };

      const state = store.getState();
      const slashCmds = state.data.bot.commands.slash.commands;
      const profileIdx = slashCmds.findIndex(c => c.name === 'profile');
      const rankIdx = slashCmds.findIndex(c => c.name === 'rank');

      const newSlashCmds = [...slashCmds];
      newSlashCmds[profileIdx] = {
        ...newSlashCmds[profileIdx],
        compressed_tree: '${newProfileTree}'
      };
      newSlashCmds[rankIdx] = {
        ...newSlashCmds[rankIdx],
        compressed_tree: '${newRankTree}'
      };

      const updatedBot = {
        ...state.data.bot,
        commands: {
          ...state.data.bot.commands,
          slash: {
            ...state.data.bot.commands.slash,
            commands: newSlashCmds
          }
        }
      };

      // Call saveBot
      console.log('Calling saveBot...');
      const saveRes = await targetFiber.memoizedProps.saveBot(updatedBot);

      return {
        success: true,
        saveRes,
        lastSave: store.getState().data.bot.last_save
      };
    })()`,
    awaitPromise: true,
    returnByValue: true
  });

  console.log('Save result:', res.result?.value);
  ws.close();
});
