import WebSocket from 'ws';
import LZString from 'lz-string';

// The page navigated away and /wiki disappeared (total: 39 instead of 40).
// This means the /wiki command was not saved to the cloud properly.
// We need to re-deploy it. The correct approach:
// 1. Navigate to customcommands
// 2. Create /wiki via "Build a new command" 
// 3. Set elements via Redux store injection
// 4. Click the actual "Save" button in the builder UI (not cb.save() which didn't persist)

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  const tabs = await fetch('http://127.0.0.1:9222/json').then(r => r.json());
  const bgTab = tabs.find(t => t.url?.includes('botghost.com') && t.type === 'page');
  if (!bgTab) { console.error('No BotGhost tab'); return; }

  const ws = new WebSocket(bgTab.webSocketDebuggerUrl);
  await new Promise(r => ws.on('open', r));

  const send = (m, p = {}) => new Promise((resolve, reject) => {
    const id = Math.floor(Math.random() * 100000);
    const timeout = setTimeout(() => reject(new Error(`Timeout: ${m}`)), 25000);
    const h = (d) => {
      const msg = JSON.parse(d.toString());
      if (msg.id === id) {
        clearTimeout(timeout);
        ws.off('message', h);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      }
    };
    ws.on('message', h);
    ws.send(JSON.stringify({ id, method: m, params: p }));
  });

  // Navigate to customcommands
  console.log('Navigating to customcommands...');
  await send('Page.navigate', { url: 'https://dashboard.botghost.com/dashboard/customcommands' });
  await sleep(5000);

  // Check current state
  const initCheck = await send('Runtime.evaluate', {
    expression: `(() => {
      const root = document.querySelector("#root");
      const key = Object.keys(root).find(k => k.startsWith("__reactContainer$"));
      let curr = root[key];
      while (curr && !curr.memoizedProps?.store) curr = curr.child;
      const store = curr?.memoizedProps?.store;
      const state = store?.getState();
      const slash = state?.data?.bot?.commands?.slash?.commands || [];
      const wiki = slash.find(c => c.name === 'wiki');
      return { hasWiki: !!wiki, wikiId: wiki?.id, total: slash.length };
    })()`,
    returnByValue: true
  });
  console.log('Init check:', initCheck.result?.value);

  if (initCheck.result?.value?.hasWiki) {
    console.log('/wiki exists, clicking to open builder...');
    // Find and click /wiki card
    const clicked = await send('Runtime.evaluate', {
      expression: `(() => {
        const h3s = Array.from(document.querySelectorAll('h3, [class*="commandName"], [class*="command-name"]'))
          .filter(el => el.textContent.trim() === '/wiki' || el.textContent.trim() === 'wiki');
        if (h3s.length > 0) { h3s[0].click(); return true; }
        return false;
      })()`,
      returnByValue: true
    });
    console.log('Clicked wiki card:', clicked.result?.value);
    await sleep(1500);

    // Click Open builder button
    const openBtn = await send('Runtime.evaluate', {
      expression: `(() => {
        const spans = Array.from(document.querySelectorAll('span, button')).filter(el => 
          el.textContent.trim() === 'Open builder' || el.textContent.trim().includes('Open builder'));
        if (spans.length > 0) { (spans[0].closest('button') || spans[0]).click(); return true; }
        return false;
      })()`,
      returnByValue: true
    });
    console.log('Clicked Open builder:', openBtn.result?.value);
    await sleep(4000);
  } else {
    console.log('/wiki not found, creating new...');
    // Click "Build a new command"
    const buildBtn = await send('Runtime.evaluate', {
      expression: `(() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Build a new command') || b.textContent.includes('Start building'));
        if (btn) { btn.click(); return true; }
        return false;
      })()`,
      returnByValue: true
    });
    console.log('Clicked Build new:', buildBtn.result?.value);
    await sleep(3500);

    // Set command name and desc
    const setInputs = await send('Runtime.evaluate', {
      expression: `(() => {
        const nameInput = document.getElementById('command-setup-name');
        const descInput = document.getElementById('command-setup-description');
        if (nameInput) {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setter.call(nameInput, 'wiki');
          nameInput.dispatchEvent(new Event('input', { bubbles: true }));
          nameInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
        if (descInput) {
          const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
          setter.call(descInput, 'Cẩm nang tu tiên & Hướng dẫn tân thủ SuMi Family');
          descInput.dispatchEvent(new Event('input', { bubbles: true }));
          descInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
        return { nameSet: nameInput?.value, descSet: descInput?.value };
      })()`,
      returnByValue: true
    });
    console.log('Set inputs:', setInputs.result?.value);
    await sleep(1000);
  }

  // Now inject the elements
  const elements = [
    {
      id: 'root', type: 'root',
      data: {
        title: 'wiki',
        description: 'Cẩm nang tu tiên & Hướng dẫn tân thủ SuMi Family',
        data: {
          command_type: 'slash', ephemeral: false,
          permissions: { allowed_roles: [{ name: '@everyone', id: 'everyone' }], banned_roles: [], banned_channels: [], banned_users: [], required_permissions: [] },
          cooldown: { type: 'disabled', interval: 1, interval_type: 'minutes' },
          handleErrors: true, errors: [], error_mode: 'simple', error_reply: 'friendly'
        }
      },
      draggable: false, position: { x: 0, y: 0 }
    },
    {
      id: 'error_handler', type: 'error',
      position: { x: -420, y: 0 }, draggable: false,
      data: { node_options: { title: 'Error Handler', description: 'Handle errors that occur during the command execution' }, data: {} }
    },
    {
      id: 'option_chuyen_muc', type: 'option', width: 340, height: 110,
      data: {
        node_options: { title: 'String', description: 'Text option', isActionBlock: false },
        data: {
          type: 'string', name: 'chuyen_muc',
          description: 'Chọn chuyên mục tu tiên (để trống xem tổng quan)',
          required: false, validated: true, autocomplete_choices: [],
          choices: ['all', 'beginner', 'pets', 'equipment', 'battle', 'economy']
        }
      },
      position: { x: 360, y: 0 }
    },
    {
      source: 'option_chuyen_muc', target: 'root', type: 'step', animated: false,
      arrowHeadType: 'arrowclosed', id: 'reactflow__edge-option_chuyen_muc-root'
    },
    {
      id: 'action_wiki_reply', type: 'action', width: 650, height: 110,
      position: { x: 0, y: 240 },
      data: {
        node_options: { title: 'Send or Edit a Message', description: 'Send or edit a message', isActionBlock: false },
        data: {
          type: 'advanced_message',
          message: {
            content: '',
            embeds: [{
              title: '🦊 𝗦𝘂𝗠𝗶 𝗙𝗮𝗺𝗶𝗹𝘆 • CẨM NANG TU TIÊN TOÀN THƯ',
              description: 'Chào mừng đạo hữu đến với cõi tiên gia **🦊 𝗦𝘂𝗠𝗶 𝗙𝗮𝗺𝗶𝗹𝘆**! Dưới đây là toàn thư hướng dẫn chi tiết về lộ trình tu tiên, linh thú, trang bị và đấu trường.',
              color: '#ec4899',
              fields: [
                {
                  name: '📜 1. Khởi Đầu Tu Tiên (7 Cảnh Giới & EXP)',
                  value: '• **Cảnh giới**: Luyện Khí (Lv.1-19) ➜ Trúc Cơ (Lv.20-39) ➜ Kim Đan (Lv.40-59) ➜ Nguyên Anh (Lv.60-79) ➜ Hóa Thần (Lv.80-89) ➜ Đại Thừa (Lv.90-99) ➜ Hỗn Độn Chúa Tể (Lv.100+).\n• **Nhận EXP**: Chat tu luyện (15-25 EXP/tin, cd 45s), Voice thiền định (50-100 EXP/5p).\n• **Lệnh cốt lõi**: `/profile` (Thẻ hồ sơ HD 1000x500), `/rank` (Thẻ cấp độ mini), `/wiki` (Cẩm nang này).',
                  inline: false
                },
                {
                  name: '🐾 2. Hệ Thống Linh Thú (27+ Chiến Pet & HAX)',
                  value: '• **4 Phẩm cấp**: Phàm Phẩm ➜ Linh Phẩm ➜ Tiên Phẩm ➜ Thần Thoại.\n• **Chiến Pet tiêu biểu**: Cửu Vĩ Hồng Hồ (HAX Bất Tử 3 đòn đầu), Lôi Đình Kim Hồ (đánh trước +100%), Chu Tước Ấu Điểu (Niết Bàn hồi 50% HP), Hàn Băng Kỳ Lân (-40% crit dmg).\n• **Chiến lực**: ATK×3 + DEF×2 + SPD×2 + Lv×50 + Bonus Trang Bị.',
                  inline: false
                },
                {
                  name: '⚔️ 3. 45 Món Trang Bị Loadout (3 Slot)',
                  value: '• **3 Slot**: Vũ Khí (ATK+SPD+Crit) | Bảo Ngọc (DEF+HP+Giảm DMG) | Chiến Hồn (SPD+Thiên phú+Hút máu).\n• **Tỷ lệ rơi**: Phàm 60% | Linh 25% | Tiên 14% | **Thần Thoại 1%** siêu hiếm.\n• **9 Kỹ năng Thần Thoại**: Tru Tiên Diệt Thần Kiếm, Cửu Thiên Cổ Thần Thương, Bất Hủ Thần Hoàng Ngọc, Thái Sơ Ma Thần Hồn...',
                  inline: false
                },
                {
                  name: '🥋 4. Đấu Trường & Ngũ Hành Tương Khắc',
                  value: '• **Ngũ hành**: Kim ➜ Mộc ➜ Thổ ➜ Thủy ➜ Hỏa ➜ Kim (+30% DMG thuận khắc, -20% bị khắc).\n• **Dị tố đặc thù**: Lôi (khắc Thủy & Kim), Ám & Quang (+25% DMG tương sát), Hỗn Độn (+20% xuyên giáp).\n• **Quy tắc**: HAX Lôi Quang Tốc → SPD cao đi trước → Giới hạn 20 hiệp.',
                  inline: false
                },
                {
                  name: '💎 5. Kinh Tế Linh Thạch & Gia Tộc',
                  value: '• **Linh Thạch 💎**: Dùng gacha pet, đúc trang bị, nâng sao, cống hiến bang.\n• **Kiếm Linh Thạch**: Điểm danh daily (streak 7 ngày = rương bạo kích), chat & voice sinh hoạt.\n• **Gia Tộc**: Tông môn, Clan Wars cược Linh Thạch đọ chiến lực 24H.',
                  inline: false
                }
              ],
              footer: { text: '🦊 𝗦𝘂𝗠𝗶 𝗙𝗮𝗺𝗶𝗹𝘆 • Cẩm Nang Tu Tiên — /wiki để tra cứu bất kỳ lúc nào!' }
            }]
          },
          messageType: 'basic', components: [], componentsV2Data: null, useComponentsV2: false,
          target: { reply: true }, validated: true, linked: true
        }
      }
    },
    {
      source: 'root', sourceHandle: 'action', target: 'action_wiki_reply', targetHandle: 'action',
      type: 'custom', id: 'reactflow__edge-rootaction-action_wiki_replyaction'
    }
  ];

  console.log('\nInjecting elements into CommandBuilder...');
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
      if (!cb) return { error: 'CB not found' };
      
      const elements = ${JSON.stringify(elements)};
      cb.props.setSelected(null);
      cb.props.setElements(elements);
      
      return { isValid: cb.validateSave() };
    })()`,
    returnByValue: true
  });
  console.log('Inject result:', injectRes.result?.value);

  if (!injectRes.result?.value?.isValid) {
    console.error('validateSave() = false, aborting');
    ws.close();
    return;
  }

  await sleep(500);

  // Click the Save button in the builder UI (the actual button the user would click)
  const saveRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      // Look for the Save button in the builder toolbar
      const saveBtn = btns.find(b => {
        const t = b.textContent.trim();
        return t === 'Save' || t === 'Save Command' || t === 'Save Event' || t.includes('Save');
      });
      if (saveBtn) {
        saveBtn.click();
        return { clicked: true, text: saveBtn.textContent.trim() };
      }
      return { clicked: false, buttons: btns.map(b => b.textContent.trim()).filter(t => t.length > 0 && t.length < 30) };
    })()`,
    returnByValue: true
  });
  console.log('Save button click:', saveRes.result?.value);
  await sleep(5000);

  // Also try cb.save()
  const cbSave = await send('Runtime.evaluate', {
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
        return { savedViaCb: true };
      }
      return { error: 'no cb.save' };
    })()`,
    awaitPromise: true,
    returnByValue: true
  });
  console.log('cb.save() result:', cbSave.result?.value);
  await sleep(6000);

  // Verify persistence
  const verifyRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const root = document.querySelector('#root');
      const key = Object.keys(root).find(k => k.startsWith('__reactContainer$'));
      let curr = root[key];
      while (curr && !curr.memoizedProps?.store) curr = curr.child;
      const store = curr?.memoizedProps?.store;
      const state = store?.getState();
      const slash = state?.data?.bot?.commands?.slash?.commands || [];
      const wiki = slash.find(c => c.name === 'wiki');
      return {
        wikiId: wiki?.id,
        wikiEnabled: wiki?.enabled,
        hasCompressedTree: !!wiki?.compressed_tree,
        total: slash.length,
        builderSaveRequired: state?.builder?.builderSaveRequired,
        lastSave: state?.data?.bot?.last_save
      };
    })()`,
    returnByValue: true
  });
  console.log('\nVerification after save:', verifyRes.result?.value);

  ws.close();
}

main().catch(console.error);
