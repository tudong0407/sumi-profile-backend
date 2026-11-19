import WebSocket from 'ws';
import LZString from 'lz-string';

const ws = new WebSocket('ws://127.0.0.1:9222/devtools/page/09AF917DBDF33A24B65C73CEF52FDF61');

ws.on('open', () => {
  ws.send(JSON.stringify({
    id: 1,
    method: 'Runtime.evaluate',
    params: {
      expression: `(() => {
        const root = document.querySelector('#root');
        const key = Object.keys(root).find(k => k.startsWith('__reactContainer$'));
        const container = root[key];
        let curr = container;
        while (curr && !curr.memoizedProps?.store) {
          curr = curr.child;
        }
        const store = curr?.memoizedProps?.store;
        if (!store) return { error: 'No store found' };

        const slashCmds = store.getState()?.data?.bot?.commands?.slash?.commands || [];
        const profileIdx = slashCmds.findIndex(c => c.name === 'profile');
        const rankIdx = slashCmds.findIndex(c => c.name === 'rank');

        return {
          profileIdx,
          rankIdx,
          profileTree: slashCmds[profileIdx]?.compressed_tree,
          rankTree: slashCmds[rankIdx]?.compressed_tree
        };
      })()`,
      returnByValue: true
    }
  }));
});

ws.on('message', async (d) => {
  const res = JSON.parse(d);
  if (res.id === 1) {
    const val = res.result?.result?.value;
    if (!val || val.error) {
      console.error(val?.error);
      ws.close();
      return;
    }

    // Decompress profile tree
    let profileTreeObj = JSON.parse(LZString.decompressFromBase64(val.profileTree));
    let actionBlockP = profileTreeObj.find(n => n.id === 'action_profile');
    if (actionBlockP) {
      actionBlockP.data.data.message.embeds[0].image.url = 
        'https://sumi-profile-backend.onrender.com/api/profile/{option_user}.png?fallback_id={user_id}&username={option_user_username}&fallback_name={user_name}&avatar={option_user_avatar}&fallback_avatar={user_icon}&v=2';
    }
    const newProfileTree = LZString.compressToBase64(JSON.stringify(profileTreeObj));

    // Decompress rank tree
    let rankTreeObj = JSON.parse(LZString.decompressFromBase64(val.rankTree));
    let actionBlockR = rankTreeObj.find(n => n.id === 'action_rank');
    if (actionBlockR) {
      actionBlockR.data.data.message.embeds[0].image.url = 
        'https://sumi-profile-backend.onrender.com/api/rank/{option_user}.png?fallback_id={user_id}&username={option_user_username}&fallback_name={user_name}&avatar={option_user_avatar}&fallback_avatar={user_icon}&v=2';
    }
    const newRankTree = LZString.compressToBase64(JSON.stringify(rankTreeObj));

    // Dispatch updates to store and trigger save
    ws.send(JSON.stringify({
      id: 2,
      method: 'Runtime.evaluate',
      params: {
        expression: `(async () => {
          const root = document.querySelector('#root');
          const key = Object.keys(root).find(k => k.startsWith('__reactContainer$'));
          const container = root[key];
          let curr = container;
          while (curr && !curr.memoizedProps?.store) {
            curr = curr.child;
          }
          const store = curr?.memoizedProps?.store;
          
          // Dispatch new tree
          store.dispatch({
            type: 'UPDATE_SLASH_COMMAND',
            payload: {
              index: ${val.profileIdx},
              command: {
                ...store.getState().data.bot.commands.slash.commands[${val.profileIdx}],
                compressed_tree: '${newProfileTree}'
              }
            }
          });

          store.dispatch({
            type: 'UPDATE_SLASH_COMMAND',
            payload: {
              index: ${val.rankIdx},
              command: {
                ...store.getState().data.bot.commands.slash.commands[${val.rankIdx}],
                compressed_tree: '${newRankTree}'
              }
            }
          });

          // Save via cb if available or save button
          let saveResult = 'no cb';
          if (window.cb && window.cb.save) {
            saveResult = await window.cb.save();
          } else {
            // click Save Changes button
            const saveBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Save'));
            if (saveBtn) {
              saveBtn.click();
              saveResult = 'clicked save button';
            }
          }

          return {
            success: true,
            saveResult,
            builderSaveRequired: store.getState()?.builder?.builderSaveRequired
          };
        })()`,
        awaitPromise: true,
        returnByValue: true
      }
    }));
  }

  if (res.id === 2) {
    console.log('Update result:', res.result?.result?.value);
    ws.close();
  }
});
