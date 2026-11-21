import WebSocket from 'ws';
import LZString from 'lz-string';

// The CommandBuilder (cb) stateNode is NOT present on the customcommands list page.
// When "Build a new command" is clicked, it navigates to a NEW builder page.
// We need to wait for the builder to fully mount AFTER the click.
// The correct flow:
// 1. Click "Build a new command"
// 2. WAIT for the page to transition to the builder (URL changes to /builder or the builder mounts)
// 3. Then inject elements into the mounted CommandBuilder

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function findCommandBuilder(send) {
  const result = await send('Runtime.evaluate', {
    expression: `(() => {
      const root = document.querySelector('#root');
      if (!root) return { found: false, reason: 'no root' };
      const key = Object.keys(root).find(k => k.startsWith('__reactContainer$'));
      if (!key) return { found: false, reason: 'no fiber key' };
      let cb = null;
      function search(fiber, depth = 0) {
        if (!fiber || depth > 100) return;
        if (fiber.stateNode && typeof fiber.stateNode.validateSave === 'function' && typeof fiber.stateNode.buildCommand === 'function') {
          cb = fiber.stateNode;
          return;
        }
        search(fiber.child, depth + 1);
        search(fiber.sibling, depth + 1);
      }
      search(root[key]);
      return { found: !!cb, url: window.location.href };
    })()`,
    returnByValue: true
  });
  return result.result?.value;
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
  console.log('[1] Navigating to customcommands...');
  await send('Page.navigate', { url: 'https://dashboard.botghost.com/dashboard/customcommands' });
  await sleep(5000);

  // Check current URL
  const urlCheck = await send('Runtime.evaluate', {
    expression: 'window.location.href',
    returnByValue: true
  });
  console.log('Current URL:', urlCheck.result?.value);

  // Click "Build a new command" or "Start building" button
  console.log('[2] Clicking Build new command...');
  const clickResult = await send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button, a'));
      const btn = btns.find(b => {
        const t = b.textContent.trim();
        return t === 'Build a new command' || t === 'Start building' || t.includes('Start building') || t.includes('Build a new');
      });
      if (btn) { btn.click(); return { clicked: true, text: btn.textContent.trim(), tag: btn.tagName }; }
      return { clicked: false, available: btns.map(b => b.textContent.trim()).filter(t => t.length > 3 && t.length < 50).slice(0, 20) };
    })()`,
    returnByValue: true
  });
  console.log('Click result:', clickResult.result?.value);

  // Wait for builder to mount — poll for up to 10 seconds
  console.log('[3] Waiting for CommandBuilder to mount...');
  let cbFound = false;
  for (let i = 0; i < 20; i++) {
    await sleep(500);
    const check = await findCommandBuilder(send);
    console.log(`  Poll ${i+1}: found=${check.found}, url=${check.url}`);
    if (check.found) {
      cbFound = true;
      break;
    }
  }

  if (!cbFound) {
    console.error('CommandBuilder not found after polling.');
    ws.close();
    return;
  }

  console.log('[4] Setting name and description...');
  const setInputs = await send('Runtime.evaluate', {
    expression: `(() => {
      const nameInput = document.getElementById('command-setup-name') || document.querySelector('input[name="name"], input[placeholder*="name"], input[placeholder*="Name"]');
      const descInput = document.getElementById('command-setup-description') || document.querySelector('input[name="description"], input[placeholder*="description"], textarea[placeholder*="description"]');
      const setValue = (el, val) => {
        if (!el) return;
        const setter = Object.getOwnPropertyDescriptor(el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype, 'value').set;
        setter.call(el, val);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      };
      setValue(nameInput, 'wiki');
      setValue(descInput, 'Cẩm nang tu tiên & Hướng dẫn tân thủ SuMi Family');
      return { nameSet: nameInput?.value, descSet: descInput?.value, nameId: nameInput?.id, descId: descInput?.id };
    })()`,
    returnByValue: true
  });
  console.log('Set inputs:', setInputs.result?.value);
  await sleep(500);

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
              description: 'Chào mừng đạo hữu đến với 🦊 𝗦𝘂𝗠𝗶 𝗙𝗮𝗺𝗶𝗹𝘆! Dưới đây là toàn thư hướng dẫn tu tiên, linh thú, trang bị và đấu trường.',
              color: '#ec4899',
              fields: [
                { name: '📜 1. Khởi Đầu Tu Tiên (7 Cảnh Giới)', value: '• **Cảnh giới**: Luyện Khí (Lv.1-19) ➜ Trúc Cơ ➜ Kim Đan ➜ Nguyên Anh ➜ Hóa Thần ➜ Đại Thừa ➜ Hỗn Độn Chúa Tể (Lv.100+).\n• **EXP**: Chat (15-25 EXP/tin, cd 45s), Voice (50-100 EXP/5p).\n• **Lệnh**: `/profile` (Thẻ hồ sơ HD), `/rank` (Cấp độ mini), `/wiki` (Cẩm nang).', inline: false },
                { name: '🐾 2. Linh Thú (27+ Pet & 21 HAX Skills)', value: '• **4 Phẩm**: Phàm ➜ Linh ➜ Tiên ➜ Thần Thoại.\n• **HAX tiêu biểu**: Cửu Vĩ Hồng Hồ (Bất Tử 3 đòn đầu), Lôi Đình Kim Hồ (đánh trước), Chu Tước (Niết Bàn hồi 50% HP).\n• **Chiến lực**: ATK×3 + DEF×2 + SPD×2 + Lv×50 + Trang Bị bonus.', inline: false },
                { name: '⚔️ 3. 45 Trang Bị Loadout (3 Slot)', value: '• **Slot**: Vũ Khí | Bảo Ngọc | Chiến Hồn.\n• **Tỷ lệ**: Phàm 60% | Linh 25% | Tiên 14% | **Thần Thoại 1%**.\n• **9 HAX Thần Thoại**: Tru Tiên Diệt Thần Kiếm, Cửu Thiên Cổ Thần Thương, Bất Hủ Thần Hoàng Ngọc...', inline: false },
                { name: '🥋 4. Đấu Trường & Ngũ Hành', value: '• **Vòng khắc**: Kim➜Mộc➜Thổ➜Thủy➜Hỏa➜Kim (+30%/-20% DMG).\n• **Hỗn Độn**: Xuyên giáp +20%, đứng ngoài ngũ hành.\n• **Quy tắc**: SPD cao đi trước → 20 hiệp tối đa.', inline: false },
                { name: '💎 5. Kinh Tế & Gia Tộc', value: '• **Linh Thạch**: Gacha pet, đúc trang bị, cống hiến Tông môn.\n• **Kiếm**: Điểm danh daily, chat & voice sinh hoạt.\n• **Clan Wars**: Cược Linh Thạch, đọ chiến lực 24H.', inline: false }
              ],
              footer: { text: '🦊 SuMi Family • Cẩm Nang Tu Tiên — /wiki để tra cứu bất kỳ lúc nào!' }
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

  console.log('[5] Injecting elements...');
  const injectRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const root = document.querySelector('#root');
      const key = Object.keys(root).find(k => k.startsWith('__reactContainer$'));
      let cb = null;
      function search(fiber, depth = 0) {
        if (!fiber || depth > 100) return;
        if (fiber.stateNode && typeof fiber.stateNode.validateSave === 'function' && typeof fiber.stateNode.buildCommand === 'function') { cb = fiber.stateNode; return; }
        search(fiber.child, depth + 1);
        search(fiber.sibling, depth + 1);
      }
      search(root[key]);
      if (!cb) return { error: 'CB not found', url: window.location.href };
      
      const elements = ${JSON.stringify(elements)};
      cb.props.setSelected(null);
      cb.props.setElements(elements);
      
      const isValid = cb.validateSave();
      return { isValid, url: window.location.href };
    })()`,
    returnByValue: true
  });
  console.log('Inject result:', injectRes.result?.value);

  if (!injectRes.result?.value?.isValid) {
    console.error('validateSave() = false!');
    ws.close();
    return;
  }

  await sleep(500);

  // Save via cb.save()
  console.log('[6] Saving via cb.save()...');
  const saveRes = await send('Runtime.evaluate', {
    expression: `(async () => {
      const root = document.querySelector('#root');
      const key = Object.keys(root).find(k => k.startsWith('__reactContainer$'));
      let cb = null;
      function search(fiber, depth = 0) {
        if (!fiber || depth > 100) return;
        if (fiber.stateNode && typeof fiber.stateNode.validateSave === 'function') { cb = fiber.stateNode; return; }
        search(fiber.child, depth + 1);
        search(fiber.sibling, depth + 1);
      }
      search(root[key]);
      if (cb && typeof cb.save === 'function') {
        await cb.save();
        return { saved: true };
      }
      return { error: 'no cb.save' };
    })()`,
    awaitPromise: true,
    returnByValue: true
  });
  console.log('Save result:', saveRes.result?.value);
  await sleep(7000);

  // Verify: check if /wiki now has an ID
  console.log('[7] Verifying persistence...');
  const verRes = await send('Runtime.evaluate', {
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
        hasTree: !!wiki?.compressed_tree,
        total: slash.length,
        builderSaveRequired: state?.builder?.builderSaveRequired,
        lastSave: state?.data?.bot?.last_save
      };
    })()`,
    returnByValue: true
  });
  console.log('Verification:', verRes.result?.value);

  ws.close();
}

main().catch(console.error);
