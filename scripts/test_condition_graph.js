import WebSocket from 'ws';

async function main() {
  const tabs = await fetch('http://127.0.0.1:9222/json').then(r => r.json());
  const bg = tabs.find(t => t.url?.includes('botghost.com'));
  const ws = new WebSocket(bg.webSocketDebuggerUrl);
  await new Promise(r => ws.on('open', r));

  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 1000000);
    const timeout = setTimeout(() => reject(new Error('CDP Timeout')), 10000);
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

  const testGraphRes = await send('Runtime.evaluate', {
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
      if (!cb) return { error: 'CommandBuilder not found' };

      // Let's test building elements for a command with condition
      const elements = [
        {
          id: 'root',
          type: 'root',
          data: {
            title: 'test_cmd',
            description: 'Test command',
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
          id: 'option_user',
          type: 'option',
          width: 300,
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
              description: 'Tu sĩ cần xem (để trống để xem chính mình)',
              required: false,
              validated: true,
              autocomplete_choices: []
            }
          },
          position: { x: 360, y: 0 }
        },
        {
          source: 'option_user',
          target: 'root',
          type: 'step',
          animated: false,
          arrowHeadType: 'arrowclosed',
          id: 'reactflow__edge-option_user-root'
        },
        {
          id: 'cond_check_user',
          type: 'condition',
          width: 280,
          height: 110,
          position: { x: 0, y: 220 },
          data: {
            node_options: {
              title: 'Comparison Condition',
              description: 'Run actions based on the difference between two values.',
              isActionBlock: false
            },
            data: {
              type: 'condition',
              condition_type: 'comparison',
              base_value: '{option_user}',
              multiple: false,
              target: { self: true },
              validated: true,
              linked: true
            }
          }
        },
        {
          source: 'root',
          sourceHandle: 'action',
          target: 'cond_check_user',
          targetHandle: 'action',
          type: 'custom',
          id: 'reactflow__edge-rootaction-cond_check_useraction'
        },
        {
          id: 'cond_child_has_user',
          type: 'conditionChild',
          width: 260,
          height: 90,
          position: { x: -200, y: 400 },
          data: {
            node_options: { type: 'comparison' },
            data: {
              type: 'matches_pattern',
              comparison_value: '^[0-9]+$',
              ignoreCase: false
            }
          }
        },
        {
          source: 'cond_check_user',
          target: 'cond_child_has_user',
          type: 'step',
          id: 'reactflow__edge-cond_check_user-cond_child_has_user'
        },
        {
          id: 'cond_child_else',
          type: 'conditionChild',
          width: 260,
          height: 90,
          position: { x: 200, y: 400 },
          data: {
            node_options: { type: 'comparison' },
            data: {
              type: 'else'
            }
          }
        },
        {
          source: 'cond_check_user',
          target: 'cond_child_else',
          type: 'step',
          id: 'reactflow__edge-cond_check_user-cond_child_else'
        },
        {
          id: 'action_user_profile',
          type: 'action',
          width: 600,
          height: 110,
          position: { x: -350, y: 560 },
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
                embeds: [{
                  title: '🦊 SU MI FAMILY • HỒ SƠ TU TIÊN',
                  description: '',
                  color: '#ff75b5',
                  image: {
                    url: 'https://sumi-profile-backend.onrender.com/api/profile/{option_user}.png?username={user_name[option_user]}&avatar={user_icon[option_user]}'
                  },
                  footer: { text: 'SuMi Family • Tu Tiên Giới' }
                }]
              },
              messageType: 'basic',
              components: [],
              target: { reply: true },
              validated: true,
              linked: true
            }
          }
        },
        {
          source: 'cond_child_has_user',
          sourceHandle: 'action',
          target: 'action_user_profile',
          targetHandle: 'action',
          type: 'custom',
          id: 'reactflow__edge-cond_child_has_user-action_user_profile'
        },
        {
          id: 'action_self_profile',
          type: 'action',
          width: 600,
          height: 110,
          position: { x: 300, y: 560 },
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
                embeds: [{
                  title: '🦊 SU MI FAMILY • HỒ SƠ TU TIÊN',
                  description: '',
                  color: '#ff75b5',
                  image: {
                    url: 'https://sumi-profile-backend.onrender.com/api/profile/{user_id}.png?username={user_name}&avatar={user_icon}'
                  },
                  footer: { text: 'SuMi Family • Tu Tiên Giới' }
                }]
              },
              messageType: 'basic',
              components: [],
              target: { reply: true },
              validated: true,
              linked: true
            }
          }
        },
        {
          source: 'cond_child_else',
          sourceHandle: 'action',
          target: 'action_self_profile',
          targetHandle: 'action',
          type: 'custom',
          id: 'reactflow__edge-cond_child_else-action_self_profile'
        }
      ];

      cb.props.setSelected(null);
      cb.props.setElements(elements);

      const isValid = cb.validateSave();
      let built = null;
      try {
        built = cb.buildCommand();
      } catch (e) {
        built = { error: e.message };
      }

      return {
        isValid,
        builtHasActions: !!built?.actions,
        builtKeys: built ? Object.keys(built) : null
      };
    })()`,
    returnByValue: true
  });

  console.log('Test Graph Validation:', JSON.stringify(testGraphRes.result?.value, null, 2));
  ws.close();
}

main().catch(console.error);
