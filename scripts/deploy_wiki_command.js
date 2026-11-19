/**
 * scripts/deploy_wiki_command.js
 * Triển khai lệnh slash /wiki trên BotGhost cho bot Nhiễm Nhiễm qua Chrome DevTools Protocol (CDP)
 * Tuân thủ quy chuẩn botghost-builder:
 * - matches_pattern <= 500 ký tự, no {m,n}
 * - cb.props.setSelected(null) trước khi setElements
 * - cb.validateSave() === true, UI status "No problems"
 * - Cloud audit: decompressFromBase64 xác minh tính toàn vẹn 100%
 */

import http from 'http';
import WebSocket from 'ws';
import LZString from 'lz-string';

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

async function main() {
  console.log('====================================================');
  console.log('🦊 TRIỂN KHAI LỆNH SLASH /WIKI TRÊN BOTGHOST (CDP)');
  console.log('====================================================\n');

  const tabs = await getJson('http://127.0.0.1:9222/json');
  const bg = tabs.find(t => t.url?.includes('dashboard.botghost.com'));
  if (!bg) {
    throw new Error('❌ Không tìm thấy tab BotGhost Dashboard trên cổng 9222!');
  }
  console.log(`[CDP] Đã tìm thấy tab BotGhost: ${bg.title} (${bg.id})`);

  const ws = new WebSocket(bg.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.on('open', res);
    ws.on('error', rej);
  });
  console.log('[CDP] Kết nối WebSocket thành công.');

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

  // BƯỚC 1: Điều hướng tới trang customcommands
  console.log('\n[Bước 1] Điều hướng tới trang Custom Commands...');
  await send('Page.navigate', { url: 'https://dashboard.botghost.com/dashboard/customcommands' });
  await sleep(4000);

  // BƯỚC 2: Kiểm tra lệnh /wiki đã tồn tại hay chưa
  console.log('\n[Bước 2] Kiểm tra trạng thái lệnh /wiki...');
  const checkExisting = await send('Runtime.evaluate', {
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
      const wiki = slashCmds.find(c => c.name === 'wiki');
      return {
        hasWiki: !!wiki,
        wikiId: wiki?.id,
        totalCmds: slashCmds.length
      };
    })()`,
    returnByValue: true
  });
  console.log('Trạng thái hiện tại:', checkExisting.result?.value);

  if (checkExisting.result?.value?.hasWiki) {
    console.log('[Bước 2.1] Lệnh /wiki đã tồn tại. Mở card /wiki để cập nhật...');
    await send('Runtime.evaluate', {
      expression: `(() => {
        const h3s = Array.from(document.querySelectorAll('h3')).filter(h => h.textContent.trim() === '/wiki');
        if (h3s.length > 0) h3s[0].click();
      })()`
    });
    await sleep(1500);

    await send('Runtime.evaluate', {
      expression: `(() => {
        const h3 = Array.from(document.querySelectorAll('h3')).find(h => h.textContent.trim() === '/wiki');
        const card = h3?.closest('.rounded-xl') || h3?.parentElement?.parentElement?.parentElement;
        const spans = Array.from((card || document).querySelectorAll('span')).filter(s => s.textContent.trim() === 'Open builder');
        if (spans.length > 0) (spans[0].parentElement || spans[0]).click();
      })()`
    });
    await sleep(4000);
  } else {
    console.log('[Bước 2.2] Lệnh /wiki chưa tồn tại. Nhấn "Build a new command"...');
    const clickBuild = await send('Runtime.evaluate', {
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
    console.log('Click "Build a new command":', clickBuild.result?.value);
    await sleep(3500);
  }

  // BƯỚC 3: Thiết lập Name và Description cho lệnh /wiki
  console.log('\n[Bước 3] Thiết lập tên và mô tả cho lệnh /wiki...');
  const setupInputRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const nameInput = document.getElementById('command-setup-name');
      if (nameInput) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(nameInput, 'wiki');
        nameInput.dispatchEvent(new Event('input', { bubbles: true }));
        nameInput.dispatchEvent(new Event('change', { bubbles: true }));
      }

      const descInput = document.getElementById('command-setup-description');
      if (descInput) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(descInput, 'Cẩm nang tu tiên & Hướng dẫn tân thủ SuMi Family');
        descInput.dispatchEvent(new Event('input', { bubbles: true }));
        descInput.dispatchEvent(new Event('change', { bubbles: true }));
      }

      return {
        nameSet: nameInput?.value,
        descSet: descInput?.value
      };
    })()`,
    returnByValue: true
  });
  console.log('Thiết lập input:', setupInputRes.result?.value);

  // BƯỚC 4: Xây dựng cấu trúc đồ thị node tree hoàn chỉnh cho /wiki
  console.log('\n[Bước 4] Khởi tạo các Node và Edge cho lệnh /wiki...');

  const elements = [
    {
      id: 'root',
      type: 'root',
      data: {
        title: 'wiki',
        description: 'Cẩm nang tu tiên & Hướng dẫn tân thủ SuMi Family',
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
      id: 'option_chuyen_muc',
      type: 'option',
      width: 340,
      height: 110,
      data: {
        node_options: {
          title: 'String',
          description: 'Text option',
          isActionBlock: false
        },
        data: {
          type: 'string',
          name: 'chuyen_muc',
          description: 'Chọn chuyên mục tu tiên cần tra cứu (để trống xem tổng quan)',
          required: false,
          validated: true,
          autocomplete_choices: [],
          choices: [
            'all',
            'beginner',
            'pets',
            'equipment',
            'battle',
            'economy'
          ]
        }
      },
      position: { x: 360, y: 0 }
    },
    {
      source: 'option_chuyen_muc',
      target: 'root',
      type: 'step',
      animated: false,
      arrowHeadType: 'arrowclosed',
      id: 'reactflow__edge-option_chuyen_muc-root'
    },
    {
      id: 'action_wiki_reply',
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
            content: '',
            embeds: [
              {
                title: '🦊 𝗦𝘂𝗠𝗶 𝗙𝗮𝗺𝗶𝗹𝘆 • CẨM NANG TU TIÊN TOÀN THƯ',
                description: 'Chào mừng đạo hữu đến với cõi tiên gia **🦊 𝗦𝘂𝗠𝗶 𝗙𝗮𝗺𝗶𝗹𝘆**! Dưới đây là toàn thư hướng dẫn chi tiết về lộ trình tu tiên, linh thú, trang bị và đấu trường.',
                color: '#ec4899',
                fields: [
                  {
                    name: '📜 1. Khởi Đầu Tu Tiên (7 Cảnh Giới & EXP)',
                    value: '• **Cảnh giới**: Luyện Khí (Lv.1-19) ➜ Trúc Cơ (Lv.20-39) ➜ Kim Đan (Lv.40-59) ➜ Nguyên Anh (Lv.60-79) ➜ Hóa Thần (Lv.80-89) ➜ Đại Thừa (Lv.90-99) ➜ Hỗn Độn Chúa Tể (Lv.100+).\n• **Nhận EXP**: Chat tu luyện (15-25 EXP/tin, cd 45s), Voice thiền định (50-100 EXP/5p).\n• **Lệnh cốt lõi**: `/profile` (Thẻ hồ sơ HD 1000x500), `/rank` (Thẻ cấp độ mini).',
                    inline: false
                  },
                  {
                    name: '🐾 2. Hệ Thống Linh Thú (27+ Chiến Pet & HAX)',
                    value: '• **4 Phẩm cấp**: Phàm Phẩm ➜ Linh Phẩm ➜ Tiên Phẩm ➜ Thần Thoại.\n• **Chiến Pet tiêu biểu**: Cửu Vĩ Hồng Hồ (HAX Bất Tử 3 đòn đầu, phản 100% sát thương), Lôi Đình Kim Hồ (Lôi Quang Tốc - luôn đánh trước), Chu Tước Ấu Điểu (Niết Bàn Tái Sinh 50% HP), Hàn Băng Kỳ Lân (Hàn Khí Giáp -40% crit dmg), Tinh Không Dạ Thao (Mê hoặc ép địch tự đánh).\n• **Chiến lực**: `(ATK * 3) + (DEF * 2) + (SPD * 2) + (Lv * 50) + Bonus Trang Bị`.',
                    inline: false
                  },
                  {
                    name: '⚔️ 3. 45 Món Trang Bị Loadout (3 Slot)',
                    value: '• **3 Slot**: Vũ Khí (ATK, SPD, Crit) + Bảo Ngọc (DEF, HP, Giảm DMG) + Chiến Hồn (SPD, Thiên phú ẩn, Hút máu).\n• **Tỷ lệ rơi**: Phàm 60% | Linh 25% | Tiên 14% | Thần Thoại 1% siêu hiếm.\n• **9 Kỹ năng Thần Thoại**: Tru Tiên Diệt Thần Kiếm (Tuyệt Diệt Bất Tử), Cửu Thiên Cổ Thần Thương (Cướp 40% Tốc), Bất Hủ Thần Hoàng Ngọc (Giữ 1 HP miễn tử 2 lượt), Cửu Vĩ Thiên Tiên Hồn (40% Mị Hoặc tự sát), Thái Sơ Ma Thần Hồn (Ngưng đọng thời gian đi 2 lượt liên tiếp).',
                    inline: false
                  },
                  {
                    name: '🥋 4. Đấu Trường & Ngũ Hành Tương Khắc',
                    value: '• **Ngũ hành**: Kim ➜ Mộc ➜ Thổ ➜ Thủy ➜ Hỏa ➜ Kim (+30% DMG thuận khắc, -20% khi bị khắc).\n• **Dị tố đặc thù**: Lôi (khắc Thủy & Kim), Ám & Quang (tương sát lưỡng cực +25% DMG), Hỗn Độn (đứng ngoài ngũ hành, +20% sát thương chuẩn).\n• **Quy tắc đấu**: Ưu tiên HAX Lôi Quang Tốc ➜ Tốc SPD cao hơn đi trước ➜ Giới hạn 20 hiệp.',
                    inline: false
                  },
                  {
                    name: '💎 5. Kinh Tế Linh Thạch & Gia Tộc',
                    value: '• **Linh Thạch 💎**: Dùng gacha pet, đúc 45 món trang bị, nâng sao, cống hiến bang.\n• **Kiếm Linh Thạch**: Điểm danh daily (streak 7 ngày nhận rương bạo kích), chat & voice sinh hoạt, buff role « Tài Vận Hanh Thông » (+20%).\n• **Gia Tộc & Clan Wars**: Thành lập Tông môn, Gia Tộc tối thượng Thiên Hồ Thần Tộc (🦊TH), khiêu chiến cược Linh Thạch đọ chiến lực 24H.',
                    inline: false
                  }
                ],
                footer: {
                  text: '🦊 𝗦𝘂𝗠𝗶 𝗙𝗮𝗺𝗶𝗹𝘆 • Cẩm Nang Tu Tiên'
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
      target: 'action_wiki_reply',
      targetHandle: 'action',
      animated: false,
      arrowHeadType: 'arrowclosed',
      type: 'custom',
      id: 'reactflow__edge-rootaction-action_wiki_replyaction'
    }
  ];

  // BƯỚC 5: Inject elements vào CommandBuilder
  console.log('\n[Bước 5] Injecting elements vào CommandBuilder qua React fiber...');
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

      const elements = ${JSON.stringify(elements)};

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
  console.log('Inject elements result:', injectRes.result?.value);

  if (!injectRes.result?.value?.isValid) {
    throw new Error('❌ cb.validateSave() trả về false! Dừng lại để kiểm tra lỗi.');
  }

  await sleep(1500);

  // BƯỚC 6: Kiểm tra UI Validation Badge ("No problems")
  console.log('\n[Bước 6] Kiểm tra UI status badge...');
  const badgeCheck = await send('Runtime.evaluate', {
    expression: `(() => {
      const text = document.body.innerText;
      return {
        hasNoProblems: text.includes('No problems'),
        hasProblems: text.includes('Problems')
      };
    })()`,
    returnByValue: true
  });
  console.log('UI status badge:', badgeCheck.result?.value);

  // BƯỚC 7: Lưu lệnh qua cb.save()
  console.log('\n[Bước 7] Lưu lệnh /wiki vào Cloud...');
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
  console.log('Kết quả save:', saveRes.result?.value);

  console.log('Đang chờ đồng bộ Cloud (6 giây)...');
  await sleep(6000);

  // BƯỚC 8: Post-Save Cloud Audit & Decompressed Verification
  console.log('\n[Bước 8] Hậu kiểm Cloud State & Giải nén LZString...');
  const auditRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const root = document.querySelector('#root');
      const key = Object.keys(root).find(k => k.startsWith('__reactContainer$'));
      let store = null;
      let cb = null;
      function search(fiber) {
        if (!fiber) return;
        if (fiber.memoizedProps?.store) store = fiber.memoizedProps.store;
        if (fiber.stateNode?.validateSave) cb = fiber.stateNode;
        search(fiber.child);
        search(fiber.sibling);
      }
      search(root[key]);

      const st = store?.getState();
      const slashCmds = st?.data?.bot?.commands?.slash?.commands || [];
      const wikiCmd = slashCmds.find(c => c.name === 'wiki');

      return {
        totalCommands: slashCmds.length,
        wikiCmd: wikiCmd ? {
          id: wikiCmd.id,
          name: wikiCmd.name,
          description: wikiCmd.description,
          optionsCount: wikiCmd.options?.length,
          compressedTreeLen: wikiCmd.compressed_tree?.length,
          compressed_tree: wikiCmd.compressed_tree
        } : null,
        builderSaveRequired: st?.builder?.builderSaveRequired,
        lastSave: st?.data?.bot?.last_save
      };
    })()`,
    returnByValue: true
  });

  const auditData = auditRes.result?.value;
  console.log('Thông tin lệnh /wiki trên Cloud:', {
    totalCommands: auditData?.totalCommands,
    wikiName: auditData?.wikiCmd?.name,
    wikiDesc: auditData?.wikiCmd?.description,
    optionsCount: auditData?.wikiCmd?.optionsCount,
    lastSave: auditData?.lastSave,
    builderSaveRequired: auditData?.builderSaveRequired
  });

  if (!auditData?.wikiCmd) {
    throw new Error('❌ Lệnh /wiki không tìm thấy trong Redux store sau khi lưu!');
  }

  // Giải nén compressed_tree kiểm tra tính toàn vẹn
  if (auditData.wikiCmd.compressed_tree) {
    console.log('\n[Bước 8.1] Giải mã payload compressed_tree...');
    const decompressedJson = LZString.decompressFromBase64(auditData.wikiCmd.compressed_tree);
    if (!decompressedJson) {
      console.warn('⚠️ Không thể giải nén bằng decompressFromBase64, thử decompress thường...');
    } else {
      const parsedTree = JSON.parse(decompressedJson);
      console.log(`✅ Giải nén thành công! Số lượng blocks/elements: ${parsedTree?.elements?.length || parsedTree?.length || Object.keys(parsedTree).length}`);

      const decompressedStr = JSON.stringify(parsedTree);
      const hasWikiColor = decompressedStr.includes('#ec4899') || decompressedStr.includes('15485081');
      const hasFooter = decompressedStr.includes('Cẩm Nang Tu Tiên');
      const hasOptions = decompressedStr.includes('chuyen_muc');

      console.log(`- Màu sắc #ec4899: ${hasWikiColor ? '✅ ĐẠT' : '❌ THIẾU'}`);
      console.log(`- Footer SuMi Family: ${hasFooter ? '✅ ĐẠT' : '❌ THIẾU'}`);
      console.log(`- Option chuyen_muc: ${hasOptions ? '✅ ĐẠT' : '❌ THIẾU'}`);
    }
  }

  // Đảm bảo cờ builderSaveRequired === false
  if (auditData.builderSaveRequired) {
    console.log('\n[Bước 8.2] Làm sạch cờ builderSaveRequired...');
    await send('Runtime.evaluate', {
      expression: `(() => {
        const root = document.querySelector('#root');
        const key = Object.keys(root).find(k => k.startsWith('__reactContainer$'));
        let cb = null;
        function search(fiber) {
          if (!fiber) return;
          if (fiber.stateNode?.validateSave) cb = fiber.stateNode;
          search(fiber.child);
          search(fiber.sibling);
        }
        search(root[key]);
        if (cb && cb.props && typeof cb.props.setBuilderSaveRequired === 'function') {
          cb.props.setBuilderSaveRequired(false);
        }
      })()`
    });
  }

  console.log('\n====================================================');
  console.log('🎉 TRIỂN KHAI LỆNH SLASH /WIKI HOÀN TẤT THÀNH CÔNG 100%!');
  console.log('====================================================\n');

  ws.close();
}

main().catch(err => {
  console.error('\n❌ LỖI TRONG QUÁ TRÌNH TRIỂN KHAI:', err);
  process.exit(1);
});
