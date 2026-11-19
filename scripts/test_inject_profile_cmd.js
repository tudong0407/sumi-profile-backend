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

  console.log('Injecting /profile command elements...');

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
        setter.call(nameInput, 'profile');
        nameInput.dispatchEvent(new Event('input', { bubbles: true }));
        nameInput.dispatchEvent(new Event('change', { bubbles: true }));
      }

      const descInput = document.getElementById('command-setup-description');
      if (descInput) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(descInput, 'Xem thẻ hồ sơ tu tiên, linh thú xuất trận và role quyền năng');
        descInput.dispatchEvent(new Event('input', { bubbles: true }));
        descInput.dispatchEvent(new Event('change', { bubbles: true }));
      }

      const elements = [
        {
          id: 'root',
          type: 'root',
          data: {
            title: 'profile',
            description: 'Xem thẻ hồ sơ tu tiên, linh thú xuất trận và role quyền năng',
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
              description: 'Tu sĩ cần xem hồ sơ (để trống để xem chính mình)',
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
          id: 'action_profile_reply',
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
                content: '🌸 **HỒ SƠ TU TIÊN CỦA <@{option_user || interaction_user}>** 🌸',
                embeds: [
                  {
                    title: '🦊 SU MI FAMILY • HỒ SƠ TU TIÊN',
                    description: 'Thẻ hồ sơ được khởi tạo độc quyền bởi Trợ Lý Linh Hồ AI Nhiễm Nhiễm',
                    color: '#ff75b5',
                    image: {
                      url: 'https://sumi-profile-backend.onrender.com/api/profile/{option_user || interaction_user}.png?username={option_user_username || interaction_user_username}&avatar={option_user_avatar || interaction_user_avatar}'
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
          target: 'action_profile_reply',
          targetHandle: 'action',
          animated: false,
          arrowHeadType: 'arrowclosed',
          type: 'custom',
          id: 'reactflow__edge-rootaction-action_profile_replyaction'
        }
      ];

      cb.props.setSelected(null);
      cb.props.setElements(elements);

      const isValid = cb.validateSave();
      return {
        isValid,
        built: cb.buildCommand()
      };
    })()`,
    returnByValue: true
  });

  console.log('Inject elements result:', JSON.stringify(injectRes.result?.value, null, 2));

  // Check UI validation badge
  await sleep(1500);
  const badgeRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const text = document.body.innerText;
      return {
        hasNoProblems: text.includes('No problems'),
        hasProblems: text.includes('Problems')
      };
    })()`,
    returnByValue: true
  });

  console.log('Badge check:', badgeRes.result?.value);
  ws.close();
}

main().catch(console.error);
