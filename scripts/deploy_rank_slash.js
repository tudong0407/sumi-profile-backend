import http from 'http';
import WebSocket from 'ws';
import LZString from 'lz-string';

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
  console.log('🚀 Bắt đầu quá trình tạo và lưu lệnh /rank...');

  const tabs = await getJson('http://127.0.0.1:9222/json');
  const bg = tabs.find(t => t.url?.includes('dashboard.botghost.com'));
  if (!bg) throw new Error('Không tìm thấy tab BotGhost!');

  const ws = new WebSocket(bg.webSocketDebuggerUrl);
  await new Promise(r => ws.on('open', r));

  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 1000000);
    const timeout = setTimeout(() => reject(new Error(`CDP Timeout on ${method}`)), 25000);
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

  console.log('1. Chuyển tới trang Custom Commands...');
  await send('Page.navigate', { url: 'https://dashboard.botghost.com/dashboard/customcommands' });
  await sleep(4000);

  console.log('2. Bấm nút "Build a new command"...');
  let clicked = false;
  for (let i = 0; i < 15; i++) {
    const clickRes = await send('Runtime.evaluate', {
      expression: `(() => {
        const allBtns = Array.from(document.querySelectorAll('button'));
        const btn = allBtns.find(b => b.textContent.includes('Build a new command'));
        if (btn) {
          btn.click();
          return { clicked: true };
        }
        return { clicked: false, count: allBtns.length };
      })()`,
      returnByValue: true
    });

    if (clickRes.result?.value?.clicked) {
      clicked = true;
      console.log('Đã click Build a new command!');
      break;
    }
    await sleep(1000);
  }

  if (!clicked) throw new Error('Không tìm thấy nút Build a new command!');

  console.log('3. Chờ CommandBuilder mount (tối đa 20s)...');
  let cbReady = false;
  for (let i = 0; i < 20; i++) {
    await sleep(1000);
    const cbCheck = await send('Runtime.evaluate', {
      expression: `(() => {
        if (!window.location.href.includes('/dashboard/builder')) return { ready: false, reason: 'url not builder' };
        const root = document.querySelector('#root');
        if (!root) return { ready: false };
        const key = Object.keys(root).find(k => k.startsWith('__reactContainer$'));
        if (!key) return { ready: false };
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
          ready: !!cb,
          mode: cb?.props?.mode,
          nameInput: !!document.getElementById('command-setup-name')
        };
      })()`,
      returnByValue: true
    });

    const val = cbCheck.result?.value;
    console.log(`[CB Check ${i+1}] ready:`, val?.ready, 'mode:', val?.mode, 'nameInput:', val?.nameInput);
    if (val?.ready && val?.nameInput) {
      cbReady = true;
      break;
    }
  }

  if (!cbReady) throw new Error('CommandBuilder không mount kịp!');

  console.log('4. Cấu hình thông tin lệnh /rank và inject elements...');
  const setupRes = await send('Runtime.evaluate', {
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
              description: 'Tu sĩ cần xem cấp độ (để trống để xem chính mình)',
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
                content: '🌸 **CẢNH GIỚI TU TIÊN CỦA <@{option_user || interaction_user}>** 🌸',
                embeds: [
                  {
                    title: '🦊 SU MI FAMILY • CẢNH GIỚI TU TIÊN',
                    description: 'Thẻ cấp độ tu vi được khởi tạo độc quyền bởi Trợ Lý Linh Hồ AI Nhiễm Nhiễm',
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
      cb.props.setBuilderSaveRequired(true);

      document.querySelector('.react-flow__controls-fitview')?.click();

      const lastSaveBefore = store?.getState()?.data?.bot?.last_save;
      return {
        isValid: cb.validateSave(),
        elementsCount: cb.props.elements?.length,
        lastSaveBefore
      };
    })()`,
    returnByValue: true
  });

  console.log('Setup result:', JSON.stringify(setupRes.result?.value, null, 2));
  if (!setupRes.result?.value?.isValid) {
    throw new Error('validateSave() failed!');
  }
  const lastSaveBefore = setupRes.result?.value?.lastSaveBefore;

  await sleep(1000);

  console.log('5. Gọi cb.save()...');
  const saveCall = await send('Runtime.evaluate', {
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

      try {
        await cb.save();
        return { success: true };
      } catch (e) {
        return { error: String(e) };
      }
    })()`,
    awaitPromise: true,
    returnByValue: true
  });
  console.log('Save call result:', saveCall.result?.value);

  console.log('6. Chờ cloud sync và kiểm tra lastSave...');
  let saved = false;
  for (let i = 0; i < 25; i++) {
    await sleep(1000);

    // Click modal Save anyway if present
    await send('Runtime.evaluate', {
      expression: `(() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const modalBtn = btns.find(b => b.textContent?.includes('Save anyway') || b.textContent?.includes('Save without'));
        if (modalBtn) modalBtn.click();
      })()`,
      returnByValue: true
    });

    const check = await send('Runtime.evaluate', {
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
        const rank = st?.data?.bot?.commands?.slash?.commands?.find(c => c.name === 'rank');
        return {
          lastSave: st?.data?.bot?.last_save,
          builderSaveRequired: st?.builder?.builderSaveRequired,
          hasRank: !!rank,
          rankTree: rank?.compressed_tree
        };
      })()`,
      returnByValue: true
    });

    const val = check.result?.value;
    console.log(`[Sync check ${i+1}] lastSave=${val?.lastSave}, builderSaveRequired=${val?.builderSaveRequired}, hasRank=${val?.hasRank}`);

    if (val?.hasRank && val?.lastSave && val?.lastSave !== lastSaveBefore && val?.builderSaveRequired === false) {
      saved = true;
      console.log('🎉 LỆNH /RANK ĐÃ ĐƯỢC LƯU LÊN CLOUD THÀNH CÔNG!');
      if (val?.rankTree) {
        const raw = LZString.decompressFromBase64(val.rankTree);
        const elements = JSON.parse(raw);
        console.log('Rank elements count in cloud tree:', elements.length);
        const actionNode = elements.find(e => e.type === 'action');
        console.log('Embed image url in cloud:', actionNode?.data?.data?.message?.embeds?.[0]?.image?.url);
      }
      break;
    }
  }

  ws.close();
  if (!saved) throw new Error('Lưu /rank thất bại hoặc timeout!');
}

main().catch(console.error);
