import http from 'http';
import WebSocket from 'ws';

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
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

  console.log('1. Navigating to Custom Commands page...');
  await send('Page.navigate', { url: 'https://dashboard.botghost.com/dashboard/customcommands' });
  await sleep(4000);

  console.log('2. Clicking Build a new command...');
  const clickRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.textContent.includes('Build a new command'));
      if (btn) {
        btn.click();
        return { clicked: true };
      }
      return { clicked: false };
    })()`,
    returnByValue: true
  });
  console.log('Click result:', clickRes.result?.value);
  await sleep(3500);

  console.log('3. Injecting /rank elements...');
  const injectRes = await send('Runtime.evaluate', {
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

      if (!cb) return { error: 'CommandBuilder not found' };

      // Set command name and description inputs
      const nameInput = document.getElementById('command-setup-name');
      if (nameInput) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(nameInput, 'rank');
        nameInput.dispatchEvent(new Event('input', { bubbles: true }));
        nameInput.dispatchEvent(new Event('change', { bubbles: true }));
      }

      const descInput = document.getElementById('command-setup-description');
      if (descInput) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(descInput, 'Xem thẻ cảnh giới tu tiên mini và cấp độ');
        descInput.dispatchEvent(new Event('input', { bubbles: true }));
        descInput.dispatchEvent(new Event('change', { bubbles: true }));
      }

      const elements = [
        {
          id: 'root',
          type: 'root',
          data: {
            title: 'rank',
            description: 'Xem thẻ cảnh giới tu tiên mini và cấp độ',
            data: {
              command_type: 'slash',
              ephemeral: false,
              permissions: {
                allowed_roles: [{ name: '@everyone', id: 'everyone' }],
                banned_roles: [],
                banned_channels: [],
                banned_users: [],
                required_permissions: []
              },
              cooldown: {
                type: 'disabled',
                interval: 1,
                interval_type: 'minutes'
              },
              handleErrors: true,
              errors: [],
              error_mode: 'simple',
              error_reply: 'friendly'
            }
          },
          draggable: false,
          position: { x: 0, y: 0 }
        },
        {
          id: 'error_handler',
          type: 'error',
          position: { x: -420, y: 0 },
          draggable: false,
          data: {
            node_options: {
              title: 'Error Handler',
              description: 'Handle errors that occur during the command execution'
            },
            data: {}
          }
        },
        {
          id: 'option_target_user',
          type: 'option',
          width: 260,
          height: 110,
          data: {
            node_options: {
              title: 'User',
              description: 'Select a member from the server',
              isActionBlock: false
            },
            data: {
              type: 'user',
              name: 'user',
              description: 'Tu sĩ cần xem cảnh giới (để trống để xem chính mình)',
              required: false,
              validated: true,
              autocomplete_choices: []
            }
          },
          position: { x: 360, y: 0 }
        },
        {
          source: 'option_target_user',
          target: 'root',
          type: 'step',
          animated: false,
          arrowHeadType: 'arrowclosed',
          id: 'reactflow__edge-option_target_user-root'
        },
        {
          id: 'action_rank_reply',
          type: 'action',
          width: 650,
          height: 110,
          position: { x: 0, y: 240 },
          data: {
            node_options: {
              title: 'Send or Edit a Message',
              description: 'Send or edit a message with optional buttons and select menus.',
              isActionBlock: false
            },
            data: {
              type: 'advanced_message',
              message: {
                content: '⚡ **CẢNH GIỚI TU HÀNH CỦA <@{option_user || interaction_user}>** ⚡',
                embeds: [
                  {
                    title: '⚡ SU MI FAMILY • CẢNH GIỚI TU TIÊN',
                    description: 'Thẻ cảnh giới mini xác thực cấp độ và linh thạch tu hành',
                    color: '#ff75b5',
                    image: {
                      url: 'https://sumi-profile-backend.onrender.com/api/rank/{option_user || interaction_user}.png?username={option_user_username || interaction_user_username}&avatar={option_user_avatar || interaction_user_avatar}'
                    },
                    footer: {
                      text: 'SuMi Family • Tu Tiên Giới'
                    }
                  }
                ]
              },
              messageType: 'basic',
              components: [],
              componentsV2Data: null,
              useComponentsV2: false,
              target: {
                reply: true
              },
              validated: true,
              linked: true
            }
          }
        },
        {
          source: 'root',
          sourceHandle: 'action',
          target: 'action_rank_reply',
          targetHandle: 'action',
          animated: false,
          arrowHeadType: 'arrowclosed',
          type: 'custom',
          id: 'reactflow__edge-rootaction-action_rank_replyaction'
        }
      ];

      cb.props.setSelected(null);
      cb.props.setElements(elements);

      const isValid = cb.validateSave();
      return {
        isValid
      };
    })()`,
    returnByValue: true
  });

  console.log('Inject /rank result:', JSON.stringify(injectRes.result?.value, null, 2));
  await sleep(1500);

  console.log('4. Saving /rank command...');
  const saveRes = await send('Runtime.evaluate', {
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

      if (cb && typeof cb.save === 'function') {
        await cb.save();
        return { savedVia: 'cb.save()' };
      }
      return { error: 'cannot save' };
    })()`,
    awaitPromise: true,
    returnByValue: true
  });
  console.log('Save result:', saveRes.result?.value);

  console.log('Waiting 6 seconds for cloud sync...');
  await sleep(6000);

  // Final verification of both commands
  const finalCheck = await send('Runtime.evaluate', {
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
      const cmds = st?.data?.bot?.commands?.slash?.commands || [];
      const profileCmd = cmds.find(c => c.name === 'profile');
      const rankCmd = cmds.find(c => c.name === 'rank');

      return {
        totalCommands: cmds.length,
        profile: profileCmd ? { name: profileCmd.name, desc: profileCmd.description, opt: profileCmd.options?.length } : null,
        rank: rankCmd ? { name: rankCmd.name, desc: rankCmd.description, opt: rankCmd.options?.length } : null,
        builderSaveRequired: st?.builder?.builderSaveRequired
      };
    })()`,
    returnByValue: true
  });

  console.log('\n====================================================');
  console.log('FINAL BOTGHOST SLASH COMMANDS AUDIT:');
  console.log(JSON.stringify(finalCheck.result?.value, null, 2));
  console.log('====================================================\n');

  ws.close();
}

main().catch(console.error);
