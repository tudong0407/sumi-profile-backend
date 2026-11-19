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

  console.log('1. Verifying CommandBuilder mounted with profile context...');
  const initCheck = await send('Runtime.evaluate', {
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

      return {
        url: window.location.href,
        hasCb: !!cb,
        mode: cb?.props?.mode,
        index: cb?.props?.index,
        initialLastSave: store?.getState()?.data?.bot?.last_save
      };
    })()`,
    returnByValue: true
  });
  console.log('Initial CB check:', initCheck.result?.value);

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

  console.log('2. Injecting elements into CommandBuilder...');
  const injectRes = await send('Runtime.evaluate', {
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

      // Ensure name and description inputs match
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

      cb.props.setSelected(null);
      cb.props.setElements(${JSON.stringify(elements)});

      const isValid = cb.validateSave();
      return {
        isValid,
        built: cb.buildCommand()
      };
    })()`,
    returnByValue: true
  });
  console.log('Inject result:', injectRes.result?.value);

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
  console.log('Badge status:', badgeRes.result?.value);

  console.log('3. Triggering save via UI button and cb.props.saveBot()...');
  const saveRes = await send('Runtime.evaluate', {
    expression: `(async () => {
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

      if (cb && typeof cb.save === 'function') {
        await cb.save();
      }

      const btns = Array.from(document.querySelectorAll('button'));
      const saveBtn = btns.find(b => b.textContent?.includes('Save Command'));
      if (saveBtn) {
        saveBtn.click();
      }

      let saveBotRes = null;
      if (cb && typeof cb.props?.saveBot === 'function') {
        saveBotRes = await cb.props.saveBot();
      }

      return {
        savedCb: true,
        clickedBtn: !!saveBtn,
        saveBotRes
      };
    })()`,
    awaitPromise: true,
    returnByValue: true
  });
  console.log('Save execution result:', saveRes.result?.value);

  console.log('4. Waiting 6 seconds for cloud save sync...');
  await sleep(6000);

  console.log('5. Auditing persisted cloud state for /profile...');
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
  console.log('Audit info:', {
    lastSave: audit?.lastSave,
    builderSaveRequired: audit?.builderSaveRequired,
    profileCmdName: audit?.profileCmd?.name,
    compressedLen: audit?.profileCmd?.compressedLen
  });

  if (audit?.profileCmd?.compressed_tree) {
    const decompressed = JSON.parse(LZString.decompressFromBase64(audit.profileCmd.compressed_tree));
    console.log('Decompressed nodes count:', decompressed.length);
    for (const node of decompressed) {
      if (node.type === 'action') {
        console.log(`Action id=${node.id}:`);
        console.log(`  content: "${node.data?.data?.message?.content}"`);
        const emb = node.data?.data?.message?.embeds?.[0];
        console.log(`  embed title: "${emb?.title}"`);
        console.log(`  embed description: "${emb?.description}"`);
        console.log(`  embed image url: "${emb?.image?.url}"`);
      }
    }
  }

  ws.close();
}

main().catch(console.error);
