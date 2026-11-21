import WebSocket from 'ws';
globalThis.WebSocket = WebSocket;

import {
  GraphBuilder,
  GA_GROUP_ID,
  deployViaCDP,
  validateGraph
} from './ga_builder_lib.mjs';

const PROFILE_GROUP_ID = '1782127263978';

// 1. /profile
function buildProfileCmd() {
  const gb = new GraphBuilder();
  gb.rootSlash('profile', 'Xem thẻ hồ sơ tu tiên, linh thú xuất trận và role quyền năng', { ephemeral: false });
  gb.errorHandlerWait();
  gb.option('user', 'user', 'Tu sĩ cần xem hồ sơ (để trống để xem chính mình)', { required: false, x: 420, y: 0 });

  const cHas = gb.cmp('p_has_u', '{option_user}', '^[0-9]+$', 'matches_pattern', {}, { x: 0, y: 220 });
  gb.link('root', cHas.condId);

  gb.act('action_profile_opt', 'advanced_message', {
    messageType: 'basic',
    useComponentsV2: false,
    target: { reply: true },
    success_handles: false,
    message: {
      content: '',
      embeds: [{
        title: '🦊 SU MI FAMILY • HỒ SƠ TU TIÊN',
        description: '',
        color: '#ff75b5',
        url: '',
        thumbnail: { url: '' },
        image: {
          url: 'https://sumi-profile-backend.onrender.com/api/profile/{option_user}.png?fallback_id={option_user}&fallback_name={encode_text[{user_displayName[option_user]}]}&fallback_avatar={encode_text[{user_icon[option_user]}]}&t={time_now_unix}'
        },
        footer: { text: 'SuMi Family • Tu Tiên Giới', icon_url: '' }
      }]
    },
    components: [],
    componentsV2Data: null,
    reactions: ''
  }, { x: -240, y: 500 });

  gb.act('action_profile_self', 'advanced_message', {
    messageType: 'basic',
    useComponentsV2: false,
    target: { reply: true },
    success_handles: false,
    message: {
      content: '',
      embeds: [{
        title: '🦊 SU MI FAMILY • HỒ SƠ TU TIÊN',
        description: '',
        color: '#ff75b5',
        url: '',
        thumbnail: { url: '' },
        image: {
          url: 'https://sumi-profile-backend.onrender.com/api/profile/{user_id}.png?fallback_id={user_id}&fallback_name={encode_text[{user_displayName}]}&fallback_avatar={encode_text[{user_icon}]}&t={time_now_unix}'
        },
        footer: { text: 'SuMi Family • Tu Tiên Giới', icon_url: '' }
      }]
    },
    components: [],
    componentsV2Data: null,
    reactions: ''
  }, { x: 240, y: 500 });

  gb.link(cHas.yes, 'action_profile_opt');
  gb.link(cHas.no, 'action_profile_self');
  return gb.elements();
}

// 2. /rank
function buildRankCmd() {
  const gb = new GraphBuilder();
  gb.rootSlash('rank', 'Xem thẻ cảnh giới tu tiên mini và cấp độ', { ephemeral: false });
  gb.errorHandlerWait();
  gb.option('user', 'user', 'Tu sĩ cần xem cảnh giới (để trống để xem chính mình)', { required: false, x: 420, y: 0 });

  const cHas = gb.cmp('r_has_u', '{option_user}', '^[0-9]+$', 'matches_pattern', {}, { x: 0, y: 220 });
  gb.link('root', cHas.condId);

  gb.act('action_rank_opt', 'advanced_message', {
    messageType: 'basic',
    useComponentsV2: false,
    target: { reply: true },
    success_handles: false,
    message: {
      content: '',
      embeds: [{
        title: '🦊 SU MI FAMILY • THẺ CẢNH GIỚI TU TIÊN',
        description: '',
        color: '#ff75b5',
        url: '',
        thumbnail: { url: '' },
        image: {
          url: 'https://sumi-profile-backend.onrender.com/api/rank/{option_user}.png?fallback_id={option_user}&fallback_name={encode_text[{user_displayName[option_user]}]}&fallback_avatar={encode_text[{user_icon[option_user]}]}&t={time_now_unix}'
        },
        footer: { text: 'SuMi Family • Tu Tiên Giới', icon_url: '' }
      }]
    },
    components: [],
    componentsV2Data: null,
    reactions: ''
  }, { x: -240, y: 500 });

  gb.act('action_rank_self', 'advanced_message', {
    messageType: 'basic',
    useComponentsV2: false,
    target: { reply: true },
    success_handles: false,
    message: {
      content: '',
      embeds: [{
        title: '🦊 SU MI FAMILY • THẺ CẢNH GIỚI TU TIÊN',
        description: '',
        color: '#ff75b5',
        url: '',
        thumbnail: { url: '' },
        image: {
          url: 'https://sumi-profile-backend.onrender.com/api/rank/{user_id}.png?fallback_id={user_id}&fallback_name={encode_text[{user_displayName}]}&fallback_avatar={encode_text[{user_icon}]}&t={time_now_unix}'
        },
        footer: { text: 'SuMi Family • Tu Tiên Giới', icon_url: '' }
      }]
    },
    components: [],
    componentsV2Data: null,
    reactions: ''
  }, { x: 240, y: 500 });

  gb.link(cHas.yes, 'action_rank_opt');
  gb.link(cHas.no, 'action_rank_self');
  return gb.elements();
}

// 3. /battle
function buildBattleCmd() {
  const gb = new GraphBuilder();
  gb.rootSlash('battle', 'Khiêu chiến Đấu Trường Linh Thú Ngũ Hành & Tuyệt Kỹ HAX', { ephemeral: false });
  gb.errorHandlerWait();
  gb.option('doi_thu', 'user', 'Đạo hữu muốn thách đấu Linh Thú (để trống để đấu thử với Chấp Pháp Linh Hồ)', { required: false, x: 420, y: 0 });

  const cHas = gb.cmp('b_has_u', '{option_doi_thu}', '^[0-9]+$', 'matches_pattern', {}, { x: 0, y: 220 });
  gb.link('root', cHas.condId);

  gb.act('b_set_opt', 'set_unique_variable', { reference: 'def_uid', value: '{option_doi_thu}', success_handles: false }, { x: -240, y: 400 });
  gb.link(cHas.yes, 'b_set_opt');

  const cIsHana = gb.cmp('b_is_hana', '{user_id}', '1429509324845092875', 'equal_to', {}, { x: 240, y: 400 });
  gb.link(cHas.no, cIsHana.condId);

  gb.act('b_set_fu', 'set_unique_variable', { reference: 'def_uid', value: '757091869183311872', success_handles: false }, { x: 100, y: 580 });
  gb.act('b_set_hana', 'set_unique_variable', { reference: 'def_uid', value: '1429509324845092875', success_handles: false }, { x: 380, y: 580 });
  gb.link(cIsHana.yes, 'b_set_fu');
  gb.link(cIsHana.no, 'b_set_hana');

  // Immediate reply ACK so Discord 3s interaction window is satisfied even during cold starts
  gb.act('battle_ack', 'advanced_message', {
    messageType: 'basic',
    useComponentsV2: false,
    target: { reply: true },
    editId: 'battle_ack',
    message_hidden: false,
    success_handles: false,
    message: {
      content: '',
      embeds: [{
        title: '⚔️ ĐẤU TRƯỜNG LINH THÚ • ĐANG GIAO CHIẾN...',
        description: '🌸 Đang triệu hồi Linh Thú, nạp 3 món trang bị Loadout và tính toán Ma Trận Ngũ Hành & Kỹ Năng HAX...',
        color: '#ff75b5',
        url: '',
        thumbnail: { url: '' },
        image: { url: '' },
        footer: { text: 'SuMi Family • Đấu Trường Tiên Giới', icon_url: '' }
      }]
    },
    components: [],
    componentsV2Data: null,
    reactions: ''
  }, { x: 0, y: 760 });

  gb.link('b_set_opt', 'battle_ack');
  gb.link('b_set_fu', 'battle_ack');
  gb.link('b_set_hana', 'battle_ack');

  // Call Backend POST /api/battle/simulate
  gb.act('battle_api', 'api_action', {
    name: 'battle_res',
    ephemeral: false,
    request_options: {
      method: 'POST',
      url: 'https://sumi-profile-backend.onrender.com/api/battle/simulate',
      headers: [{ key: 'Content-Type', value: 'application/json' }],
      params: [],
      body: [],
      rawBody: '{"attackerId":"{user_id}","defenderId":"{def_uid}","options":{"maxTurns":20}}',
      contentType: 'application/json',
      options: {
        excludeEmptyFields: true,
        replaceParams: true,
        replaceURL: true,
        replaceHeaders: true,
        replaceBody: true,
        bodyMode: 'raw',
        contentType: 'application/json',
        failOnError: false
      }
    },
    success_handles: false
  }, { x: 0, y: 940 });
  gb.link('battle_ack', 'battle_api');

  // Edit ACK message with full combat log
  gb.act('battle_edit', 'advanced_message', {
    messageType: 'basic',
    useComponentsV2: false,
    action_id: 'battle_ack',
    target: { editId: 'battle_ack' },
    success_handles: false,
    message: {
      content: '',
      embeds: [{
        title: '🦊 SU MI FAMILY • ĐẤU TRƯỜNG LINH THÚ',
        description: '{battle_res.response.discordReport}',
        color: '#ec4899',
        url: '',
        thumbnail: { url: '' },
        image: { url: '' },
        footer: { text: 'SuMi Family • Người chiến thắng: {battle_res.response.winner.name} ({battle_res.response.winner.pet})', icon_url: '' }
      }]
    },
    components: [],
    componentsV2Data: null,
    reactions: ''
  }, { x: 0, y: 1120 });
  gb.link('battle_api', 'battle_edit');

  return gb.elements();
}

// 4. /wiki
function buildWikiCmd() {
  const gb = new GraphBuilder();
  gb.rootSlash('wiki', 'Cẩm nang tu tiên & Hướng dẫn tân thủ SuMi Family', { ephemeral: false });
  gb.errorHandlerWait();
  gb.option('chuyen_muc', 'string', 'Chọn chuyên mục tu tiên (all, beginner, pets, equipment, battle, economy)', {
    required: false,
    choices: ['all', 'beginner', 'pets', 'equipment', 'battle', 'economy'],
    x: 420,
    y: 0
  });

  gb.cond('w_cat', 'comparison', { base_value: '{option_chuyen_muc}', target: { self: true } }, { x: 0, y: 220 });
  gb.link('root', 'w_cat');

  const bBeg = gb.branch('w_cat', 'w_cat_beginner', 'comparison', {
    type: 'equal_to', comparison_value: 'beginner', ignoreCase: true, option: '', not: false
  }, { x: -750, y: 400 });
  const bPet = gb.branch('w_cat', 'w_cat_pets', 'comparison', {
    type: 'equal_to', comparison_value: 'pets', ignoreCase: true, option: '', not: false
  }, { x: -450, y: 400 });
  const bEqp = gb.branch('w_cat', 'w_cat_equipment', 'comparison', {
    type: 'equal_to', comparison_value: 'equipment', ignoreCase: true, option: '', not: false
  }, { x: -150, y: 400 });
  const bBat = gb.branch('w_cat', 'w_cat_battle', 'comparison', {
    type: 'equal_to', comparison_value: 'battle', ignoreCase: true, option: '', not: false
  }, { x: 150, y: 400 });
  const bEco = gb.branch('w_cat', 'w_cat_economy', 'comparison', {
    type: 'equal_to', comparison_value: 'economy', ignoreCase: true, option: '', not: false
  }, { x: 450, y: 400 });
  const bAll = gb.elseBranch('w_cat', 'w_cat_all', 'comparison', { x: 750, y: 400 });

  gb.act('action_wiki_beginner', 'advanced_message', {
    messageType: 'basic',
    useComponentsV2: false,
    target: { reply: true },
    success_handles: false,
    message: {
      content: '',
      embeds: [{
        title: '📜 Khởi Đầu Tu Tiên • SuMi Family',
        description: 'Tu tiên tại SuMi Family là con đường rèn luyện từ phàm nhân thành Hỗn Độn Chúa Tể. Tích cực đàm đạo tại các kênh chat, điểm danh hàng ngày và tham chiến để nhận EXP thăng cấp và đột phá cảnh giới.',
        color: '#ec4899',
        url: '',
        thumbnail: { url: '' },
        image: { url: '' },
        fields: [
          {
            name: '🌟 7 Tầng Cảnh Giới Tu Tiên',
            value: '• **I. Luyện Khí Sơ Kỳ** (Lv.1-19): Khai mở linh mạch\n• **II. Trúc Cơ Đạo Cảnh** (Lv.20-39): Đúc thành tiên cơ\n• **III. Kim Đan Đại Đạo** (Lv.40-59): Kết tụ kim đan nội phủ\n• **IV. Nguyên Anh Chân Quân** (Lv.60-79): Xuất khiếu cửu tiêu\n• **V. Hóa Thần Tiên Tôn** (Lv.80-89): Thiên nhân hợp nhất\n• **VI. Đại Thừa Vô Cực** (Lv.90-99): Nửa bước vào tiên tịch\n• **VII. Hỗn Độn Chúa Tể** (Lv.100+): Đỉnh cao tối thượng Cửu Vĩ',
            inline: false
          },
          {
            name: '⚡ Cách Nhận EXP & Cày Cấp',
            value: '• **Chat Tu Luyện**: 15-25 EXP/tin nhắn (cooldown 45s).\n• **Voice Thiền Định**: 50-100 EXP/5 phút treo voice.\n• **Công thức EXP**: `100 * (Level ^ 1.8)`, tối đa 500.000 EXP tại Lv.100.\n• **Role Buff**: « Thần Hành Cốt Cách » miễn chờ chat chậm; « Linh Hồn Tu Luyện » +15% EXP Solo.',
            inline: false
          },
          {
            name: '🎴 Lệnh Thẻ Tiên Đạo',
            value: '• `/profile [user]`: Thẻ hồ sơ đa tầng 1000x500 HD sắc nét.\n• `/rank [user]`: Thẻ tiến độ Mini 1000x205 HD.\n• `/battle [doi_thu]`: Đấu trường Linh Thú Ngũ Hành & HAX.',
            inline: false
          }
        ],
        footer: { text: '🦊 𝗦𝘂𝗠𝗶 𝗙𝗮𝗺𝗶𝗹𝘆 • Chuyên mục: beginner — /wiki để xem toàn thư!', icon_url: '' }
      }]
    },
    components: [],
    componentsV2Data: null,
    reactions: ''
  }, { x: -750, y: 620 });
  gb.link(bBeg, 'action_wiki_beginner');

  gb.act('action_wiki_pets', 'advanced_message', {
    messageType: 'basic',
    useComponentsV2: false,
    target: { reply: true },
    success_handles: false,
    message: {
      content: '',
      embeds: [{
        title: '🐾 Hệ Thống Linh Thú • SuMi Family',
        description: 'Linh thú không chỉ gia tăng lực chiến tổng mà còn đồng hành cùng tu sĩ trong mọi trận đấu trường pet. Nâng cấp cấp độ và bồi dưỡng sao linh thú để mở khóa tiềm năng vô hạn.',
        color: '#ec4899',
        url: '',
        thumbnail: { url: '' },
        image: { url: '' },
        fields: [
          {
            name: '✨ 4 Phẩm Cấp Linh Thú',
            value: '• ⚪ **Phàm Phẩm**: Hoang dã sơ khai\n• 🔵 **Linh Phẩm**: Khai mở linh trí, khống chế đối thủ\n• 🟣 **Tiên Phẩm**: Hấp thu nhật nguyệt, hút máu & phong ấn chiêu\n• 🔴 **Thần Thoại**: HAX phá vỡ quy tắc sinh tử',
            inline: false
          },
          {
            name: '🦊 Linh Thú Tiêu Biểu & Tuyệt Kỹ HAX',
            value: '• **Cửu Vĩ Hồng Hồ** (Hỗn Độn): Bất tử 3 đòn đầu, phản 100% sát thương gốc.\n• **Lôi Đình Kim Hồ** (Lôi): Lôi Quang Tốc, luôn đánh trước mọi đối thủ.\n• **Chu Tước Ấu Điểu** (Hỏa): Niết Bàn Tái Sinh với 50% HP.\n• **Hàn Băng Kỳ Lân** (Thủy): Hàn Khí Giáp, giảm 40% sát thương bạo kích.\n• **U Minh Lang Vương** (Ám): Tuyệt Mệnh Trảm, địch dưới 25% máu 50% bị kết liễu ngay.\n• **Tinh Không Dạ Thao** (Hư Không): Hỗn Loạn, ép địch tự đánh chính mình.',
            inline: false
          },
          {
            name: '⚔️ Ba Chỉ Số Cốt Lõi & Công Thức Lực Chiến',
            value: '• **ATK**: Sức sát thương cơ bản khi ra đòn.\n• **DEF**: Khả năng triệt tiêu sát thương gánh chịu.\n• **SPD**: Quyết định quyền xuất chiêu trước và né tránh.\n• `Chiến Lực = (ATK × 3) + (DEF × 2) + (SPD × 2) + (Lv × 50) + Bonus Trang Bị`',
            inline: false
          }
        ],
        footer: { text: '🦊 𝗦𝘂𝗠𝗶 𝗙𝗮𝗺𝗶𝗹𝘆 • Chuyên mục: pets — /wiki để xem toàn thư!', icon_url: '' }
      }]
    },
    components: [],
    componentsV2Data: null,
    reactions: ''
  }, { x: -450, y: 620 });
  gb.link(bPet, 'action_wiki_pets');

  gb.act('action_wiki_equipment', 'advanced_message', {
    messageType: 'basic',
    useComponentsV2: false,
    target: { reply: true },
    success_handles: false,
    message: {
      content: '',
      embeds: [{
        title: '⚔️ 45 Món Trang Bị Loadout • SuMi Family',
        description: 'Hệ thống 45 trang bị mang đến chiều sâu chiến thuật không giới hạn, cho phép xây dựng các build Đấu Sĩ Phản Đòn, Bạo Kích Sát Thương, Tốc Độ Khống Chế hoặc Sinh Lực Hộ Mệnh.',
        color: '#ec4899',
        url: '',
        thumbnail: { url: '' },
        image: { url: '' },
        fields: [
          {
            name: '🛡️ 3 Slot Trang Bị Loadout & Tỷ Lệ Rơi',
            value: '• ⚔️ **Vũ Khí**: Tăng ATK, SPD & CRIT.\n• 💎 **Bảo Ngọc**: Tăng DEF, HP & Khiên Chắn.\n• 🦊 **Chiến Hồn**: Kích hoạt Thiên Phú Ẩn, Hút Máu, SPD & HAX.\n• **Tỷ lệ rơi**: Phàm Phẩm 60% | Linh Phẩm 25% | Tiên Phẩm 14% | **Thần Thoại 1%**.',
            inline: false
          },
          {
            name: '👑 9 Tuyệt Kỹ HAX Trang Bị Thần Thoại',
            value: '1. `« Tru Tiên Diệt Thần Kiếm »`: Xuyên khiên 100%, khóa Bất Tử/Trùng Sinh 3 lượt đầu.\n2. `« Cửu Thiên Lôi Đình Cổ Thần Thương »`: Cướp 40% SPD của địch chuyển thành ATK.\n3. `« Hồng Mông Hỗn Độn Trượng »`: 35% biến đòn đánh của địch thành máu và phản 100%.\n4. `« Bất Hủ Thần Hoàng Ngọc »`: Giữ lại 1 HP khi chết, miễn nhiễm sát thương 2 lượt.\n5. `« Vạn Tượng Quy Nhất Châu »`: Phản 75% sát thương dội ngược lại địch (bỏ qua giáp).\n6. `« Thiên Hồ Hóa Thần Ngọc »`: Khiên hộ mệnh 100% HP, giảm 50% uy lực công kích của địch.\n7. `« Cửu Vĩ Thiên Tiên Hồn »`: 40% mỗi lượt Mị Hoặc ép địch tự tung sát chiêu tự sát.\n8. `« Thái Sơ Thời Không Ma Thần Hồn »`: Đóng băng thời gian, đánh liên tiếp 2 lượt.\n9. `« Luân Hồi Bất Diệt Chiến Hồn »`: Đổi % máu cho địch khi rơi xuống dưới 20% HP.',
            inline: false
          }
        ],
        footer: { text: '🦊 𝗦𝘂𝗠𝗶 𝗙𝗮𝗺𝗶𝗹𝘆 • Chuyên mục: equipment — /wiki để xem toàn thư!', icon_url: '' }
      }]
    },
    components: [],
    componentsV2Data: null,
    reactions: ''
  }, { x: -150, y: 620 });
  gb.link(bEqp, 'action_wiki_equipment');

  gb.act('action_wiki_battle', 'advanced_message', {
    messageType: 'basic',
    useComponentsV2: false,
    target: { reply: true },
    success_handles: false,
    message: {
      content: '',
      embeds: [{
        title: '🥋 Đấu Trường & Ngũ Hành • SuMi Family',
        description: 'Đấu trường pet là nơi phân tài cao thấp giữa các tu sĩ SuMi Family. Chiến thắng phụ thuộc vào khả năng phối hợp khắc chế nguyên tố và kích hoạt combo HAX của 3 món trang bị.',
        color: '#ec4899',
        url: '',
        thumbnail: { url: '' },
        image: { url: '' },
        fields: [
          {
            name: '🌀 Vòng Tương Khắc Ngũ Hành',
            value: '`Kim ➜ Mộc ➜ Thổ ➜ Thủy ➜ Hỏa ➜ Kim`\n• **Thuận Khắc**: Gây thêm `+30% Sát Thương` (x1.30).\n• **Bị Khắc**: Giảm `-20% Sát Thương` gây ra (x0.80).',
            inline: false
          },
          {
            name: '⚡ Tứ Đại Dị Tố Đặc Thù',
            value: '• **Lôi**: Khắc mạnh Thủy & Kim (+30% DMG).\n• **Ám ⚔️ Quang**: Tương sát lưỡng cực (+25% DMG lẫn nhau).\n• **Hỗn Độn / Hư Không**: Đứng ngoài ngũ hành, không bị khắc, +20% sát thương chuẩn xuyên giáp.',
            inline: false
          },
          {
            name: '⏱️ Thứ Tự Ra Đòn & Quy Tắc Đấu Trường',
            value: '• Ưu tiên HAX `Lôi Quang Tốc` > So sánh `Final SPD` cao hơn.\n• Trận đấu tối đa 20 hiệp; nếu hết 20 hiệp, bên còn nhiều HP hơn giành chiến thắng.',
            inline: false
          }
        ],
        footer: { text: '🦊 𝗦𝘂𝗠𝗶 𝗙𝗮𝗺𝗶𝗹𝘆 • Chuyên mục: battle — /wiki để xem toàn thư!', icon_url: '' }
      }]
    },
    components: [],
    componentsV2Data: null,
    reactions: ''
  }, { x: 150, y: 620 });
  gb.link(bBat, 'action_wiki_battle');

  gb.act('action_wiki_economy', 'advanced_message', {
    messageType: 'basic',
    useComponentsV2: false,
    target: { reply: true },
    success_handles: false,
    message: {
      content: '',
      embeds: [{
        title: '💎 Kinh Tế & Gia Tộc • SuMi Family',
        description: 'Một nền kinh tế phồn vinh tạo nền tảng vững chắc cho mọi tu sĩ trên con đường phi thăng tiên giới.',
        color: '#ec4899',
        url: '',
        thumbnail: { url: '' },
        image: { url: '' },
        fields: [
          {
            name: '💎 Linh Thạch & Điểm Danh',
            value: '• **Linh Thạch**: Dùng quay gacha pet, đúc trang bị, nâng sao, cống hiến bang.\n• **Điểm Danh Hằng Ngày**: Nhận 100-500 Linh Thạch/ngày. Duy trì streak 7 ngày nhận rương quà bạo kích.\n• **Role Buff**: « Tài Vận Hanh Thông » tăng vĩnh viễn +20% Linh Thạch.',
            inline: false
          },
          {
            name: '🦊 Gia Tộc & Bang Chiến 24H',
            value: '• **Gia Tộc Tiêu Biểu**: `Thiên Hồ Thần Tộc (🦊TH)` do Tiên Chủ Fuyumi thống lĩnh (Cấp 5, Ngân khố 99.999.999 Linh Thạch).\n• **Clan Wars 24H**: Tuyên chiến đặt cược Linh Thạch, thi đấu chiến lực 24 giờ đoạt toàn bộ ngân khố cược.',
            inline: false
          }
        ],
        footer: { text: '🦊 𝗦𝘂𝗠𝗶 𝗙𝗮𝗺𝗶𝗹𝘆 • Chuyên mục: economy — /wiki để xem toàn thư!', icon_url: '' }
      }]
    },
    components: [],
    componentsV2Data: null,
    reactions: ''
  }, { x: 450, y: 620 });
  gb.link(bEco, 'action_wiki_economy');

  gb.act('action_wiki_reply', 'advanced_message', {
    messageType: 'basic',
    useComponentsV2: false,
    target: { reply: true },
    success_handles: false,
    message: {
      content: '',
      embeds: [{
        title: '🦊 𝗦𝘂𝗠𝗶 𝗙𝗮𝗺𝗶𝗹𝘆 • CẨM NANG TU TIÊN TOÀN THƯ',
        description: 'Chào mừng đạo hữu đến với cõi tiên gia **🦊 𝗦𝘂𝗠𝗶 𝗙𝗮𝗺𝗶𝗹𝘆**! Dưới đây là toàn thư hướng dẫn chi tiết về lộ trình tu tiên, linh thú, trang bị và đấu trường.',
        color: '#ec4899',
        url: '',
        thumbnail: { url: '' },
        image: { url: '' },
        fields: [
          {
            name: '📜 1. Khởi Đầu Tu Tiên (7 Cảnh Giới & EXP)',
            value: '• **Cảnh giới**: Luyện Khí (Lv.1-19) ➜ Trúc Cơ (Lv.20-39) ➜ Kim Đan (Lv.40-59) ➜ Nguyên Anh (Lv.60-79) ➜ Hóa Thần (Lv.80-89) ➜ Đại Thừa (Lv.90-99) ➜ Hỗn Độn Chúa Tể (Lv.100+).\n• **Nhận EXP**: Chat tu luyện (15-25 EXP/tin, cd 45s), Voice thiền định (50-100 EXP/5p).\n• **Lệnh cốt lõi**: `/profile` (Thẻ hồ sơ HD 1000x500), `/rank` (Thẻ cấp độ mini), `/battle` (Đấu trường Pet), `/wiki` (Cẩm nang).',
            inline: false
          },
          {
            name: '🐾 2. Hệ Thống Linh Thú (27+ Chiến Pet & HAX)',
            value: '• **4 Phẩm cấp**: Phàm Phẩm ➜ Linh Phẩm ➜ Tiên Phẩm ➜ Thần Thoại.\n• **Chiến Pet tiêu biểu**: Cửu Vĩ Hồng Hồ (HAX Bất Tử 3 đòn đầu), Lôi Đình Kim Hồ (đánh trước +100%), Chu Tước Ấu Điểu (Niết Bàn hồi 50% HP), Hàn Băng Kỳ Lân (-40% crit dmg).\n• **Chiến lực**: `ATK × 3 + DEF × 2 + SPD × 2 + Lv × 50 + Bonus Trang Bị`.',
            inline: false
          },
          {
            name: '⚔️ 3. 45 Món Trang Bị Loadout (3 Slot)',
            value: '• **3 Slot**: Vũ Khí (`ATK + SPD + CRIT`) | Bảo Ngọc (`DEF + HP + Khiên`) | Chiến Hồn (`ATK + DEF + SPD + HAX`).\n• **Tỷ lệ rơi**: Phàm 60% | Linh 25% | Tiên 14% | **Thần Thoại 1%** siêu hiếm.\n• **9 Kỹ năng Thần Thoại**: Tru Tiên Diệt Thần Kiếm, Cửu Thiên Cổ Thần Thương, Bất Hủ Thần Hoàng Ngọc, Thái Sơ Ma Thần Hồn...',
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
        footer: { text: '🦊 𝗦𝘂𝗠𝗶 𝗙𝗮𝗺𝗶𝗹𝘆 • Cẩm Nang Tu Tiên — /wiki để tra cứu bất kỳ lúc nào!', icon_url: '' }
      }]
    },
    components: [],
    componentsV2Data: null,
    reactions: ''
  }, { x: 750, y: 620 });
  gb.link(bAll, 'action_wiki_reply');
  return gb.elements();
}

async function main() {
  for (const [name, builder] of [
    ['profile', buildProfileCmd],
    ['rank', buildRankCmd],
    ['battle', buildBattleCmd],
    ['wiki', buildWikiCmd]
  ]) {
    const els = builder();
    const errs = validateGraph(els);
    if (errs.length) throw new Error(`Validation failed for ${name}: ${errs.join(', ')}`);
    const res = await deployViaCDP({
      groupId: PROFILE_GROUP_ID,
      mode: 'command',
      name,
      elements: els
    });
    console.log(`Deployed /${name}:`, JSON.stringify(res, null, 2));
  }
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
