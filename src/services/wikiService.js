/**
 * src/services/wikiService.js
 * Cung cấp dữ liệu Cẩm Nang Tu Tiên SuMi Family cho lệnh /wiki và API GET /api/wiki
 * Bản quyền: 🦊𝗦𝘂𝗠𝗶 𝗙𝗮𝗺𝗶𝗹𝘆 (Guild ID: 1026096141273661450)
 * Bot: Nhiễm Nhiễm (916469360401453067) - Tiên Chủ: Fuyumi (757091869183311872)
 */

export const VALID_CATEGORIES = ['beginner', 'pets', 'equipment', 'battle', 'economy'];

export const WIKI_METADATA = {
  title: '🦊 Cẩm Nang Tu Tiên SuMi Family',
  subtitle: 'Hướng dẫn tân thủ & Toàn thư tiên giới - Bot Nhiễm Nhiễm',
  version: '1.0.0',
  guild: '🦊𝗦𝘂𝗠𝗶 𝗙𝗮𝗺𝗶𝗹𝘆 (1026096141273661450)',
  guild_id: '1026096141273661450',
  bot: 'Nhiễm Nhiễm (916469360401453067)',
  bot_id: '916469360401453067',
  owner: 'Fuyumi (757091869183311872)',
  owner_id: '757091869183311872',
  theme_color: '#ec4899',
  theme_color_dec: 15485081,
  updated_at: '2026-11-20T02:25:00.000Z',
  total_categories: 5,
};

export const WIKI_CATEGORIES = {
  beginner: {
    id: 'beginner',
    title: '📜 Khởi Đầu Tu Tiên',
    icon: '📜',
    description: '7 Cảnh giới tu tiên, cấp độ, EXP chat/voice, cách xem profile & rank',
    sections: [
      {
        heading: '1. Hệ Thống 7 Cảnh Giới Tu Tiên',
        content: '• I. Luyện Khí Sơ Kỳ (Lv.1-19): Khai mở linh mạch, ngưng tụ linh khí.\n• II. Trúc Cơ Đạo Cảnh (Lv.20-39): Đúc thành tiên cơ, ngự linh thú cấp thấp.\n• III. Kim Đan Đại Đạo (Lv.40-59): Kết tụ kim đan nội phủ, linh lực cuồn cuộn.\n• IV. Nguyên Anh Chân Quân (Lv.60-79): Xuất khiếu cửu tiêu, mở khóa slot role 3.\n• V. Hóa Thần Tiên Tôn (Lv.80-89): Thiên nhân hợp nhất, uy áp hư không.\n• VI. Đại Thừa Vô Cực (Lv.90-99): Nửa bước vào tiên tịch, thấu triệt càn khôn.\n• VII. Hỗn Độn Chúa Tể (Lv.100+): Cảnh giới tối thượng Cửu Vĩ, 5 slot role toàn năng.'
      },
      {
        heading: '2. Cơ Chế Nhận EXP & Công Thức Cấp Độ',
        content: '• Chat Tu Luyện: 15-25 EXP/tin nhắn (cooldown 45s).\n• Voice Thiền Định: 50-100 EXP mỗi 5 phút hoạt động.\n• Công thức EXP cần thăng cấp: 100 * (Level ^ 1.8), tối đa 500.000 EXP tại Lv.100.\n• Role Buff: « Thần Hành Cốt Cách » miễn chờ chat chậm; « Linh Hồn Tu Luyện » +15% EXP Solo.'
      },
      {
        heading: '3. Các Lệnh Thẻ Hồ Sơ Tu Tiên',
        content: '• /profile [user]: Xuất Thẻ Tiên Đạo 6 tầng HD (1000x500) hiển thị Cảnh Giới, Pet, 3 Slot Trang Bị Loadout, Role Đeo và Tình Duyên.\n• /rank [user]: Xuất Thẻ Mini Rank HD (1000x205) tóm lược vị thế tu tiên, thứ hạng server, cấp độ và thanh tiến trình EXP.'
      }
    ],
    fields: [
      {
        name: '🌟 7 Tầng Cảnh Giới Tu Tiên',
        value: '• **I. Luyện Khí Sơ Kỳ** (Lv.1-19): Khai mở linh mạch\n• **II. Trúc Cơ Đạo Cảnh** (Lv.20-39): Đúc thành tiên cơ\n• **III. Kim Đan Đại Đạo** (Lv.40-59): Kết tụ kim đan nội phủ\n• **IV. Nguyên Anh Chân Quân** (Lv.60-79): Xuất khiếu cửu tiêu\n• **V. Hóa Thần Tiên Tôn** (Lv.80-89): Thiên nhân hợp nhất\n• **VI. Đại Thừa Vô Cực** (Lv.90-99): Nửa bước vào tiên tịch\n• **VII. Hỗn Độn Chúa Tể** (Lv.100+): Đỉnh cao tối thượng Cửu Vĩ',
        inline: false
      },
      {
        name: '⚡ Cách Nhận EXP & Cày Cấp',
        value: '• **Chat Tu Luyện**: 15-25 EXP/tin nhắn (cooldown 45s).\n• **Voice Thiền Định**: 50-100 EXP/5 phút treo voice.\n• **Role Buff**: « Thần Hành Cốt Cách » miễn chờ chat chậm; « Linh Hồn Tu Luyện » +15% EXP Solo.',
        inline: true
      },
      {
        name: '🎴 Lệnh Thẻ Tiên Đạo',
        value: '• `/profile [user]`: Thẻ hồ sơ đa tầng 1000x500 HD sắc nét.\n• `/rank [user]`: Thẻ tiến độ Mini 1000x205 HD.',
        inline: true
      }
    ],
    content: 'Tu tiên tại SuMi Family là con đường rèn luyện từ phàm nhân thành Hỗn Độn Chúa Tể. Tích cực đàm đạo tại các kênh chat, điểm danh hàng ngày và tham chiến để nhận EXP thăng cấp và đột phá cảnh giới.'
  },

  pets: {
    id: 'pets',
    title: '🐾 Hệ Thống Linh Thú',
    icon: '🐾',
    description: '27+ Chiến Pet Ngũ Hành, 4 Phẩm Cấp & Tuyệt Kỹ HAX Lật Kèo',
    sections: [
      {
        heading: '1. Bốn Phẩm Cấp Linh Thú',
        content: '• Phàm Phẩm (Trắng): Thú cưng hoang dã sơ khai, tư chất bình dị.\n• Linh Phẩm (Lam): Đã khai mở linh trí, có năng lực khống chế hoặc phá giáp.\n• Tiên Phẩm (Tím): Hấp thu nhật nguyệt tinh hoa, sở hữu tuyệt chiêu hút máu, trói chân, phong ấn chiêu thức.\n• Thần Thoại (Đỏ Vàng): Thượng cổ thần thú cái thế, nắm giữ kỹ năng HAX phá vỡ quy tắc.'
      },
      {
        heading: '2. Linh Thú Tiêu Biểu & Kỹ Năng HAX',
        content: '• Cửu Vĩ Hồng Hồ (Hỗn Độn - Tối Thượng Thần Thoại): Bất tử 3 đòn đầu, phản 100% sát thương gốc (Độc quyền Fuyumi).\n• Cửu Vĩ Thiên Hồ (Quang/Hỗn Độn): Thiên Hồ Hàng Thế tăng 50% toàn bộ chỉ số trong 3 hiệp đầu.\n• Lôi Đình Kim Hồ (Lôi): Lôi Quang Tốc, luôn giành quyền xuất chiêu trước.\n• Chu Tước Ấu Điểu (Hỏa): Niết Bàn Tái Sinh với 50% HP khi tử trận.\n• Hàn Băng Kỳ Lân (Thủy): Hàn Khí Giáp, giảm 40% sát thương bạo kích gánh chịu.\n• U Minh Lang Vương (Ám): Tuyệt Mệnh Trảm, địch dưới 25% máu 50% bị kết liễu ngay.\n• Tinh Không Dạ Thao (Hư Không): Hỗn Loạn, ép đối thủ tự đánh chính mình.'
      },
      {
        heading: '3. Ba Chỉ Số Cốt Lõi & Lực Chiến',
        content: '• Công (ATK): Sức sát thương cơ bản khi ra đòn.\n• Thủ (DEF): Khả năng triệt tiêu sát thương gánh chịu.\n• Tốc (SPD): Quyết định quyền xuất chiêu trước và khả năng né tránh.\n• Công thức Chiến Lực: (ATK * 3) + (DEF * 2) + (SPD * 2) + (Level * 50) + Bonus Trang Bị.'
      }
    ],
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
        name: '⚔️ Công Thức Lực Chiến',
        value: '`Chiến Lực = (ATK × 3) + (DEF × 2) + (SPD × 2) + (Lv × 50) + Bonus Trang Bị`',
        inline: false
      }
    ],
    content: 'Linh thú không chỉ gia tăng lực chiến tổng mà còn đồng hành cùng tu sĩ trong mọi trận đấu trường pet. Nâng cấp cấp độ và bồi dưỡng sao linh thú để mở khóa tiềm năng vô hạn.'
  },

  equipment: {
    id: 'equipment',
    title: '⚔️ 45 Món Trang Bị Loadout',
    icon: '⚔️',
    description: '15 Vũ khí, 15 Bảo ngọc, 15 Chiến hồn & 9 Tuyệt Kỹ Thần Thoại',
    sections: [
      {
        heading: '1. Cấu Trúc 3 Slot Loadout',
        content: '• ⚔️ Vũ Khí (Weapon): Tăng mạnh Công kích (ATK), Tốc xuất chiêu (SPD) và Bạo kích (Crit Rate / Crit DMG).\n• 💎 Bảo Ngọc (Gem): Tăng Sinh lực (HP), Phòng thủ cứng (DEF), Khiên hộ mệnh và Kháng hiệu ứng.\n• 🦊 Chiến Hồn (Soul): Kích hoạt Thiên Phú Ẩn, Tăng Tốc (SPD), Hút máu, Ru ngủ hoặc Ngưng đọng thời gian.'
      },
      {
        heading: '2. Tỷ Lệ Rơi & 4 Bậc Phẩm Cấp',
        content: '• Phàm Phẩm (Common): 60.0% tỷ lệ rơi.\n• Linh Phẩm (Rare): 25.0% tỷ lệ rơi.\n• Tiên Phẩm (Epic): 14.0% tỷ lệ rơi.\n• Thần Thoại (Mythic): 1.0% tỷ lệ rơi siêu hiếm.'
      },
      {
        heading: '3. 9 Kỹ Năng HAX Trang Bị Thần Thoại',
        content: '• Tru Tiên Diệt Thần Kiếm (Vũ Khí 1): Tuyệt Diệt Bất Tử - Xuyên 100% khiên chắn, vô hiệu hóa Bất Tử / Trùng Sinh trong 3 lượt đầu.\n• Cửu Thiên Lôi Đình Cổ Thần Thương (Vũ Khí 2): Lôi Thần Trấn Áp - Cướp 40% Tốc SPD của đối thủ chuyển thành ATK suốt trận.\n• Hồng Mông Hỗn Độn Trượng (Vũ Khí 3): Hỗn Độn Nghịch Đảo - 35% biến đòn đánh của địch thành máu và phản 100%.\n• Bất Hủ Thần Hoàng Ngọc (Bảo Ngọc 1): Kim Thân Hộ Mệnh - Giữ lại 1 HP khi chết, miễn nhiễm sát thương 2 lượt.\n• Vạn Tượng Quy Nhất Châu (Bảo Ngọc 2): Kính Hoa Thủy Nguyệt - Phản 75% sát thương dội ngược lại địch (bỏ qua giáp).\n• Thiên Hồ Hóa Thần Ngọc (Bảo Ngọc 3): Thần Hồ Diễm Hộ - Khiên hộ mệnh 100% HP, giảm 50% uy lực công kích của địch.\n• Cửu Vĩ Thiên Tiên Hồn (Chiến Hồn 1): Mị Hoặc Chúng Sinh - 40% mỗi lượt ép đối thủ tự tung sát chiêu tự sát.\n• Thái Sơ Thời Không Ma Thần Hồn (Chiến Hồn 2): Thời Không Đình Chỉ - Đóng băng thời gian, đánh liên tiếp 2 lượt.\n• Luân Hồi Bất Diệt Chiến Hồn (Chiến Hồn 3): Sinh Mệnh Nghịch Chuyển - Đổi % máu cho địch khi rơi xuống dưới 20% HP.'
      }
    ],
    fields: [
      {
        name: '🛡️ 3 Slot Trang Bị Loadout',
        value: '• ⚔️ **Vũ Khí**: Tăng Công (ATK), Tốc (SPD) & Bạo Kích (Crit).\n• 💎 **Bảo Ngọc**: Tăng Thủ (DEF), Sinh Lực (HP) & Khiên Chắn.\n• 🦊 **Chiến Hồn**: Kích hoạt Thiên Phú Ẩn, Hút Máu, Tốc Độ & HAX.',
        inline: false
      },
      {
        name: '👑 9 Tuyệt Kỹ HAX Trang Bị Thần Thoại',
        value: '1. `« Tru Tiên Diệt Thần Kiếm »`: Xuyên khiên 100%, khóa Bất Tử/Trùng Sinh 3 lượt đầu.\n2. `« Cửu Thiên Lôi Đình Cổ Thần Thương »`: Cướp 40% Tốc của địch chuyển thành Công.\n3. `« Hồng Mông Hỗn Độn Trượng »`: 35% biến đòn đánh của địch thành máu và phản 100%.\n4. `« Bất Hủ Thần Hoàng Ngọc »`: Giữ lại 1 HP khi chết, miễn nhiễm sát thương 2 lượt.\n5. `« Vạn Tượng Quy Nhất Châu »`: Phản 75% sát thương dội ngược lại địch (bỏ qua giáp).\n6. `« Thiên Hồ Hóa Thần Ngọc »`: Khiên hộ mệnh 100% HP, giảm 50% uy lực công kích của địch.\n7. `« Cửu Vĩ Thiên Tiên Hồn »`: 40% mỗi lượt Mị Hoặc ép địch tự tung sát chiêu tự sát.\n8. `« Thái Sơ Thời Không Ma Thần Hồn »`: Đóng băng thời gian, đánh liên tiếp 2 lượt.\n9. `« Luân Hồi Bất Diệt Chiến Hồn »`: Đổi % máu cho địch khi rơi xuống dưới 20% HP.',
        inline: false
      }
    ],
    content: 'Hệ thống 45 trang bị mang đến chiều sâu chiến thuật không giới hạn, cho phép xây dựng các build Đấu Sĩ Phản Đòn, Bạo Kích Sát Thương, Tốc Độ Khống Chế hoặc Sinh Lực Hộ Mệnh.'
  },

  battle: {
    id: 'battle',
    title: '🥋 Đấu Trường & Ngũ Hành',
    icon: '🥋',
    description: 'Tương sinh tương khắc 9 hệ, hệ Hỗn Độn & tính toán sát thương',
    sections: [
      {
        heading: '1. Quy Luật Tương Khắc Ngũ Hành',
        content: '• Chu kỳ tương khắc: Kim -> Mộc -> Thổ -> Thủy -> Hỏa -> Kim.\n• Thuận Khắc Hệ: Gây thêm +30% Sát thương (x1.30).\n• Bị Khắc Hệ: Bị giảm -20% Sát thương gây ra (x0.80).'
      },
      {
        heading: '2. Tứ Đại Dị Tố Đặc Thù',
        content: '• Lôi: Tương sinh Kim & Thủy, khắc chế cực mạnh Thủy & Kim (+30% bonus damage).\n• Ám & Quang: Tương sát lưỡng cực, gây thêm +25% sát thương chí mạng lẫn nhau.\n• Hỗn Độn / Hư Không: Đứng ngoài ngũ hành, không bị khắc chế, gây +20% sát thương chuẩn xuyên giáp lên toàn hệ và giảm 15% sát thương nhận vào.'
      },
      {
        heading: '3. Thứ Tự Xuất Chiêu & Độ Bền Trận Đấu',
        content: '• Ưu tiên tuyệt đối: Kỹ năng HAX Lôi Quang Tốc luôn ra đòn trước tiên.\n• So sánh Tốc độ: Final SPD bên nào cao hơn sẽ chiếm thế chủ động.\n• Giới hạn 20 lượt: Nếu sau 20 lượt chưa ngã ngũ, bên có % máu cao hơn sẽ chiến thắng.'
      }
    ],
    fields: [
      {
        name: '🌀 Vòng Tương Khắc Ngũ Hành',
        value: '`Kim ➜ Mộc ➜ Thổ ➜ Thủy ➜ Hỏa ➜ Kim`\n• **Thuận Khắc**: Gây thêm `+30% Sát Thương` (x1.30).\n• **Bị Khắc**: Giảm `-20% Sát Thương` gây ra (x0.80).',
        inline: true
      },
      {
        name: '⚡ Tứ Đại Dị Tố',
        value: '• **Lôi**: Khắc mạnh Thủy & Kim (+30% DMG).\n• **Ám ⚔️ Quang**: Tương sát lưỡng cực (+25% DMG lẫn nhau).\n• **Hỗn Độn / Hư Không**: Đứng ngoài ngũ hành, không bị khắc, +20% sát thương chuẩn.',
        inline: true
      },
      {
        name: '⏱️ Thứ Tự Ra Đòn',
        value: 'Ưu tiên HAX `Lôi Quang Tốc` > So sánh `Final SPD` cao hơn > Trận đấu tối đa 20 hiệp.',
        inline: false
      }
    ],
    content: 'Đấu trường pet là nơi phân tài cao thấp giữa các tu sĩ SuMi Family. Chiến thắng phụ thuộc vào khả năng phối hợp khắc chế nguyên tố và kích hoạt combo HAX của 3 món trang bị.'
  },

  economy: {
    id: 'economy',
    title: '💎 Kinh Tế & Gia Tộc',
    icon: '💎',
    description: 'Linh Thạch, điểm danh tu luyện, Bang phái & Gia Tộc Chiến 24H',
    sections: [
      {
        heading: '1. Tiền Tệ Linh Thạch',
        content: 'Linh Thạch là huyết mạch giao thương của tiên giới. Dùng để mở gacha triệu hồi pet, đúc 45 món trang bị loadout, cường hóa pháp bảo, nâng cấp gia tộc và cống hiến bang.'
      },
      {
        heading: '2. Cách Tích Lũy Linh Thạch Hàng Ngày',
        content: '• Điểm danh hằng ngày: Nhận 100 - 500 Linh Thạch mỗi ngày. Duy trì streak 7 ngày nhận rương quà bạo kích chứa bảo vật quý hiếm.\n• Giao lưu server: Trò chuyện và thiền định voice để tích lũy Linh Thạch tự động.\n• Role Buff: « Tài Vận Hanh Thông » tăng vĩnh viễn +20% Linh Thạch từ mọi nguồn.'
      },
      {
        heading: '3. Gia Tộc & Đại Chiến Bang Phái 24H',
        content: '• Lập bang: Đạt cảnh giới Kim Đan trở lên có thể thành lập Gia Tộc (cấp 1-10, quy mô 10-50 người).\n• Gia tộc tối thượng: Thiên Hồ Thần Tộc (🦊TH) do Tiên Chủ Fuyumi thống lĩnh (Cấp 5, Ngân khố 99.999.999 Linh Thạch).\n• Clan Wars 24H: Khiêu chiến đặt cược Linh Thạch, thi đấu điểm số chiến lực trong 24 giờ để đoạt toàn bộ ngân khố cược của đối phương.'
      }
    ],
    fields: [
      {
        name: '💎 Linh Thạch & Điểm Danh',
        value: '• **Linh Thạch**: Dùng quay gacha pet, đúc trang bị, nâng sao, cống hiến bang.\n• **Điểm Danh Hằng Ngày**: Nhận 100-500 Linh Thạch/ngày. Duy trì streak nhận rương quà bạo kích.\n• **Role Buff**: « Tài Vận Hanh Thông » tăng vĩnh viễn +20% Linh Thạch.',
        inline: false
      },
      {
        name: '🦊 Gia Tộc & Bang Chiến 24H',
        value: '• **Gia Tộc Tiêu Biểu**: `Thiên Hồ Thần Tộc (🦊TH)` do Tiên Chủ Fuyumi thống lĩnh (Cấp 5, Ngân khố 99.999.999 Linh Thạch).\n• **Clan Wars 24H**: Tuyên chiến đặt cược Linh Thạch, thi đấu chiến lực 24 giờ đoạt toàn bộ ngân khố cược.',
        inline: false
      }
    ],
    content: 'Một nền kinh tế phồn vinh tạo nền tảng vững chắc cho mọi tu sĩ trên con đường phi thăng tiên giới.'
  }
};

/**
 * Trích xuất dữ liệu Cẩm Nang Tu Tiên
 * @param {string|null} categoryId - Mã chuyên mục (beginner, pets, equipment, battle, economy, all)
 * @returns {object} Payload kết quả
 */
export function getWikiData(categoryId = null) {
  if (!categoryId || typeof categoryId !== 'string') {
    return {
      success: true,
      ...WIKI_METADATA,
      categories: Object.values(WIKI_CATEGORIES)
    };
  }

  const cleanId = categoryId.trim().toLowerCase();

  if (!cleanId || cleanId === 'all') {
    return {
      success: true,
      ...WIKI_METADATA,
      categories: Object.values(WIKI_CATEGORIES)
    };
  }

  if (!VALID_CATEGORIES.includes(cleanId)) {
    return {
      success: false,
      error: 'Category not found',
      message: `Chuyên mục wiki '${categoryId}' không tồn tại.`,
      valid_categories: VALID_CATEGORIES
    };
  }

  const category = WIKI_CATEGORIES[cleanId];

  return {
    success: true,
    ...WIKI_METADATA,
    category: cleanId,
    data: category
  };
}
