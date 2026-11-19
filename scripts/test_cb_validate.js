import WebSocket from 'ws';

async function main() {
  const tabs = await fetch('http://127.0.0.1:9222/json').then(r => r.json());
  const bg = tabs.find(t => t.url?.includes('botghost.com'));
  const ws = new WebSocket(bg.webSocketDebuggerUrl);
  await new Promise(r => ws.on('open', r));

  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 1000000);
    const timeout = setTimeout(() => reject(new Error('CDP Timeout')), 20000);
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
          cooldown: { type: 'disabled', interval: 1, interval_type: 'minutes' },
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
      width: 320,
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
      id: 'action_profile',
      type: 'action',
      width: 620,
      height: 110,
      position: { x: 0, y: 220 },
      data: {
        node_options: {
          title: 'Send or Edit a Message',
          description: 'Send or edit a message',
          isActionBlock: false
        },
        data: {
          type: 'advanced_message',
          message: {
            content: '',
            embeds: [
              {
                title: '🦊 SU MI FAMILY • HỒ SƠ TU TIÊN',
                description: '',
                color: '#ff75b5',
                image: {
                  url: 'https://sumi-profile-backend.onrender.com/api/profile/{option_user}.png?fallback_id={interaction_user}&username={option_user_username}&fallback_name={interaction_user_username}&avatar={option_user_avatar}&fallback_avatar={interaction_user_avatar}'
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
          target: { reply: true },
          validated: true,
          linked: true
        }
      }
    },
    {
      source: 'root',
      sourceHandle: 'action',
      target: 'action_profile',
      targetHandle: 'action',
      type: 'custom',
      id: 'reactflow__edge-rootaction-action_profileaction'
    }
  ];

  const res = await send('Runtime.evaluate', {
    expression: `(() => {
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
      if (!cb) return { error: 'No cb' };

      cb.props.setSelected(null);
      cb.props.setElements(${JSON.stringify(elements)});
      const isValid = cb.validateSave();
      const built = cb.buildCommand();
      return { isValid, builtValid: !!built, builtName: built?.name };
    })()`,
    returnByValue: true
  });

  console.log('Validation test result:', res.result?.value);
  ws.close();
}

main().catch(console.error);
