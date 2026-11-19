import WebSocket from 'ws';
import LZString from 'lz-string';

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

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

  console.log('1. Navigating to customcommands...');
  await send('Page.navigate', { url: 'https://dashboard.botghost.com/dashboard/customcommands' });
  await sleep(4000);

  console.log('2. Opening /profile card...');
  const openCardRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const cardHeaders = Array.from(document.querySelectorAll('h3, h4, span, div'))
        .filter(el => el.textContent?.trim() === '/profile');
      if (cardHeaders.length === 0) return { error: 'profile card header not found' };
      // Click card header to expand accordion
      cardHeaders[0].click();
      return { clicked: true };
    })()`,
    returnByValue: true
  });
  console.log('Open card result:', openCardRes.result?.value);
  await sleep(1500);

  console.log('3. Clicking "Open builder"...');
  const openBuilderRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const btn = btns.find(b => b.textContent?.includes('Open builder') || b.textContent?.includes('builder'));
      if (!btn) return { error: 'Open builder button not found' };
      btn.click();
      return { clickedBuilder: true };
    })()`,
    returnByValue: true
  });
  console.log('Open builder result:', openBuilderRes.result?.value);
  await sleep(4000);

  console.log('4. Verifying CommandBuilder mounted & setting elements...');
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
          position: { x: -220, y: 400 },
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
          position: { x: 220, y: 400 },
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
          id: 'action_target_profile',
          type: 'action',
          width: 620,
          height: 110,
          position: { x: -380, y: 560 },
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
                      url: 'https://sumi-profile-backend.onrender.com/api/profile/{option_user}.png?username={user_name[option_user]}&avatar={user_icon[option_user]}'
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
          source: 'cond_child_has_user',
          sourceHandle: 'action',
          target: 'action_target_profile',
          targetHandle: 'action',
          type: 'custom',
          id: 'reactflow__edge-cond_child_has_user-action_target_profile'
        },
        {
          id: 'action_self_profile',
          type: 'action',
          width: 620,
          height: 110,
          position: { x: 280, y: 560 },
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
                      url: 'https://sumi-profile-backend.onrender.com/api/profile/{user_id}.png?username={user_name}&avatar={user_icon}'
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
      return {
        isValid,
        built: cb.buildCommand()
      };
    })()`,
    returnByValue: true
  });

  console.log('Inject elements result:', JSON.stringify(injectRes.result?.value, null, 2));

  // Trigger fitView
  await send('Runtime.evaluate', {
    expression: `document.querySelector('.react-flow__controls-fitview')?.click()`
  });

  await sleep(1500);

  // Check UI validation badge
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

  // Trigger Save
  console.log('5. Triggering save...');
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
        return { saveMethod: 'cb.save()' };
      }
      const btns = Array.from(document.querySelectorAll('button'));
      const saveBtn = btns.find(b => b.textContent?.includes('Save'));
      if (saveBtn) {
        saveBtn.click();
        return { saveMethod: 'saveBtn.click()' };
      }
      return { error: 'No save button' };
    })()`,
    awaitPromise: true,
    returnByValue: true
  });
  console.log('Save result:', saveRes.result?.value);

  console.log('Waiting 6s for cloud save to complete...');
  await sleep(6000);

  // Audit persisted cloud state
  const auditRes = await send('Runtime.evaluate', {
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
      const slashCmds = st?.data?.bot?.commands?.slash?.commands || [];
      const profileCmd = slashCmds.find(c => c.name === 'profile');

      return {
        lastSave: st?.data?.bot?.last_save,
        builderSaveRequired: st?.builder?.builderSaveRequired,
        profileCmd: profileCmd ? {
          name: profileCmd.name,
          description: profileCmd.description,
          hasTree: !!profileCmd.compressed_tree,
          compressedLen: profileCmd.compressed_tree?.length,
          compressed_tree: profileCmd.compressed_tree
        } : null
      };
    })()`,
    returnByValue: true
  });

  const audit = auditRes.result?.value;
  console.log('Audit result:', {
    lastSave: audit?.lastSave,
    builderSaveRequired: audit?.builderSaveRequired,
    profileCmdName: audit?.profileCmd?.name,
    compressedLen: audit?.profileCmd?.compressedLen
  });

  if (audit?.profileCmd?.compressed_tree) {
    const decompressed = JSON.parse(LZString.decompressFromBase64(audit.profileCmd.compressed_tree));
    console.log('Persisted nodes count:', decompressed.length);
    const actions = decompressed.filter(n => n.type === 'action');
    console.log('Persisted actions:');
    for (const a of actions) {
      console.log(`- Action ${a.id}: content="${a.data?.data?.message?.content}", description="${a.data?.data?.message?.embeds?.[0]?.description}", image.url="${a.data?.data?.message?.embeds?.[0]?.image?.url}"`);
    }
  }

  ws.close();
}

main().catch(console.error);
