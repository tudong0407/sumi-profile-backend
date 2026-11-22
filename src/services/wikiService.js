/**
 * src/services/wikiService.js
 * Dữ liệu Cẩm Nang Tu Tiên SuMi Family chuẩn hóa (6 chuyên mục độc lập + tra cứu chi tiết 165 Pháp Bảo & 90 Linh Thú tiêu chuẩn).
 * Văn phong trang trọng, chuyên nghiệp, chuẩn mực tu tiên.
 * Lưu ý: Không liệt kê hoặc nhắc đến vật phẩm/linh thú/lãnh địa độc quyền cá nhân trên /wiki.
 */

import { supabase } from '../config/supabase.js';
import {
  EQUIPMENT_CATALOG,
  EQUIPMENT_BY_ID,
  PET_CATALOG,
  PET_BY_TYPE,
  RARITY_TIERS,
  PUBLIC_BASE_URL,
  FUYUMI_USER_ID,
} from '../data/catalog.js';
import {
  em,
  tierEmoji,
  realmEmoji,
  elementEmoji,
  domainElementEmoji,
  itemEmoji,
  petEmoji,
  levelMilestoneEmoji,
} from '../config/emojiHelper.js';

export const VALID_CATEGORIES = ['overview', 'realms', 'battle', 'equipment', 'pets', 'economy'];

const CATEGORY_ALIASES = {
  beginner: 'overview',
  tong_quan: 'overview',
  canh_gioi: 'realms',
  dau_truong: 'battle',
  linh_vuc: 'battle',
  domain: 'battle',
  trang_bi: 'equipment',
  linh_thu: 'pets',
  kinh_te: 'economy',
  nong_trai: 'economy',
  farm: 'economy',
  minigame: 'economy',
};

export const WIKI_METADATA = {
  title: 'Cẩm Nang Tu Tiên SuMi Family',
  subtitle: 'Toàn thư hệ thống Tu Tiên • Linh Thú • Pháp Bảo • Linh Vực • Đấu Trường',
  version: '1.3.1',
  guild: 'SuMi Family (1026096141273661450)',
  guild_id: '1026096141273661450',
  bot: 'Nhiễm Nhiễm (916469360401453067)',
  bot_id: '916469360401453067',
  owner: 'Fuyumi (757091869183311872)',
  owner_id: FUYUMI_USER_ID,
  theme_color: '#ec4899',
  theme_color_dec: 15485081,
  updated_at: '2026-11-22T03:00:00.000Z',
  total_categories: 6,
};

export const WIKI_CATEGORIES = {
  overview: {
    id: 'overview',
    title: `${em('su_wiki_scroll')} Tổng Quan Tu Tiên`,
    icon: em('su_wiki_scroll'),
    description: 'Khái lược hệ thống tu tiên, lộ trình khởi đầu và danh mục lệnh trọng tâm.',
    image_url: '',
    sections: [
      {
        heading: '1. Khởi Đầu Tu Hành',
        content: '• Trạng thái mặc định: Cấp 1 • 0 EXP • 0 Linh Thạch • 1 Slot Role.\n• Linh Thú khởi đầu: Hóa Thạch Nham Nham Thú (Phàm Phẩm • Hệ Thổ • 120 ATK / 180 DEF / 100 SPD) cấp sẵn để tham chiến.\n• Tích lũy EXP tự động khi đàm đạo (Chat) và tu luyện trong phòng thoại (Voice EXP 85–135 EXP / 5 phút, chấm công định kỳ mỗi 12 phút).',
      },
      {
        heading: '2. Hệ Thống Lệnh Trọng Tâm (v1.3)',
        content: '• /profile & /rank: Thẻ hồ sơ tu sĩ & cảnh giới.\n• /battle & /linhvuc: Thách đấu PvP 1v1 hoặc PvE Tự Do, kèm trang bị Linh Vực • Thần Thức • Thần Cảnh kích hoạt từ Hiệp 2.\n• /daily, /job, /doiqua, /roll, /shop, /dismantle, /tangqua: Linh Thạch, 6 Nghề Tu Tiên (tối đa 8 ca/ngày), Gacha Pháp Bảo/Linh Thú/Linh Vực, Tiên Bảo Các, Phân Rã & Tặng Quà.\n• /farm & /exchange: Canh tác Linh Điền • ấp trứng Linh Các theo thời gian thực và quy đổi Linh Quả Tiên Giới.\n• /coinflip, /blackjack, /slots, /crash: Các thức giải trí tiêu khiển bằng Linh Thạch.\n• /enchant, /nhiemvu & /top: Khắc Ấn D→S, 5 Nhiệm Vụ Ngày, 3 Hợp Đồng Tuần, Tháp Thí Luyện 200 Tầng & Bảng Xếp Hạng.\n• /inv, /phapbao, /linhthu, /roles, /equip, /unequip: Túi Đồ, Kho Pháp Bảo, Linh Thú, Role & Trang Bị.\n• /marry, /divorce, /giatoc, /wiki, /info, /updates: Tiên Lữ, Gia Tộc Lv.1–10, Cẩm Nang, Tra Cứu UID/Emoji & Nhật Ký Phiên Bản.',
      },
    ],
    fields: [
      {
        name: `${em('su_sprout')} Khởi Đầu Tu Hành`,
        value: '• Mặc định: **Lv.1 • 0 EXP • 0 Linh Thạch • 1 Slot Role**.\n• Linh Thú khởi đầu: **Hóa Thạch Nham Nham Thú** *(Phàm Phẩm • Hệ Thổ • 120 ATK / 180 DEF / 100 SPD)*.\n• Tự động khởi tạo hồ sơ khi tương tác Chat / Voice (chấm công Voice định kỳ mỗi 12 phút).',
        inline: false,
      },
      {
        name: `${em('su_pin_sigil')} Hệ Thống Lệnh (v1.3)`,
        value: '• `/profile` • `/rank` • `/battle` • `/linhvuc` • `/top` — Hồ sơ, Đấu Trường, Linh Vực & BXH.\n• `/daily` • `/job` • `/farm` • `/exchange` • `/doiqua` — Linh Thạch, Nghề Nghiệp (8 ca/ngày) & Nông Trại.\n• `/roll` (`equipment`/`pet`/`role`/`domain`) • `/shop` • `/dismantle` • `/tangqua` — Triệu Hồi & Giao Thương.\n• `/coinflip` • `/blackjack` • `/slots` • `/crash` — Thức chơi Linh Thạch.\n• `/enchant` • `/nhiemvu` • `/inv` • `/phapbao` • `/linhthu` • `/roles` • `/equip` — Khắc Ấn D→S, 5 Nhiệm Vụ Ngày & Tháp 200 Tầng.\n• `/marry` • `/divorce` • `/giatoc` • `/wiki` • `/info` • `/updates` — Tiên Lữ, Gia Tộc, Tra UID/Emoji & Nhật Ký.',
        inline: false,
      },
    ],
    content: 'Hệ thống tu tiên SuMi Family v1.3 vận hành đồng bộ: Bồi dưỡng 90 Linh Thú & 165 Pháp Bảo, khai mở 30 Linh Vực • 15 Thần Thức • 15 Thần Cảnh, Khắc Ấn D→S, Nông Trại `/farm` và Tháp Thí Luyện 200 Tầng.',
  },

  realms: {
    id: 'realms',
    title: `${em('su_realm_7_hondondao')} Hệ Thống Cảnh Giới & Thăng Cấp`,
    icon: em('su_realm_7_hondondao'),
    description: '7 Đại Cảnh Giới (Lv.1–100), công thức EXP, mốc Role cấp độ và mở khóa Slot Role.',
    image_url: '',
    sections: [
      {
        heading: '1. Bảy Đại Cảnh Giới & Mở Khóa Slot Role',
        content: '• I. Luyện Khí Sơ Kỳ (Lv.1–19) — 1 Slot Role\n• II. Trúc Cơ Đạo Cảnh (Lv.20–39) — 2 Slot Role\n• III. Kim Đan Đại Đạo (Lv.40–59) — 3 Slot Role • Viền Tử Kim\n• IV. Nguyên Anh Chân Quân (Lv.60–79) — 4 Slot Role\n• V. Hóa Thần Tiên Tôn (Lv.80–89) — 5 Slot Role\n• VI. Đại Thừa Vô Cực (Lv.90–99) — 5 Slot Role\n• VII. Hỗn Độn Chúa Tể (Lv.100) — Đỉnh cao tối thượng',
      },
      {
        heading: '2. Cơ Chế Tích Lũy EXP & Công Thức',
        content: '• Chat: 20–30 EXP / tin nhắn hợp lệ (cooldown 45 giây).\n• Voice: 85–135 EXP mỗi 5 phút hoạt động trong kênh thoại (chấm công định kỳ mỗi 12 phút không cần rời phòng).\n• Công thức thăng cấp: 60 × (Level ^ 1.45), trần 500.000 EXP tại Lv.100.\n• Buff EXP: « Linh Hồn Tu Luyện » (+15% EXP), « Cửu Vĩ Yêu Hậu » (+80% EXP).',
      },
      {
        heading: '3. Mốc Level Roles Tự Động',
        content: 'Lv.5 U Linh Chớm Nở → Lv.15 Linh Cáo Học Giả → Lv.20 Linh Cáo Tinh Anh → Lv.35 Yêu Hồ Nguyệt Ảnh → Lv.45 Huyễn Linh Thú → Lv.60 Thiên Hồ Viễn Cổ → Lv.80 Chi Linh Thánh Đế → Lv.100 Hỗn Độn Chúa Tể.',
      },
    ],
    fields: [
      {
        name: `${em('su_mountain')} 7 Đại Cảnh Giới & Mở Khóa Slot Role`,
        value: `• ${realmEmoji(1)} **I. Luyện Khí Sơ Kỳ** (\`Lv.1–19\`) • 1 Slot • Viền Bạch Ngọc\n• ${realmEmoji(20)} **II. Trúc Cơ Đạo Cảnh** (\`Lv.20–39\`) • 2 Slot\n• ${realmEmoji(40)} **III. Kim Đan Đại Đạo** (\`Lv.40–59\`) • 3 Slot • Viền Tử Kim\n• ${realmEmoji(60)} **IV. Nguyên Anh Chân Quân** (\`Lv.60–79\`) • 4 Slot\n• ${realmEmoji(80)} **V. Hóa Thần Tiên Tôn** (\`Lv.80–89\`) • 5 Slot\n• ${realmEmoji(90)} **VI. Đại Thừa Vô Cực** (\`Lv.90–99\`) • 5 Slot\n• ${realmEmoji(100)} **VII. Hỗn Độn Chúa Tể** (\`Lv.100\`) • Đỉnh cao tối thượng`,
        inline: false,
      },
      {
        name: `${em('su_level_up')} Nguồn EXP & Công Thức`,
        value: '• **Chat**: `20–30 EXP` / tin nhắn *(cooldown 45 giây)*.\n• **Voice**: `85–135 EXP` / `5 phút` hoạt động *(+20% • chấm công định kỳ mỗi 12 phút)*.\n• **Công thức lên cấp**: `60 × (Level ^ 1.45)` *(tối đa `500.000 EXP` tại Lv.100)*.\n• **Buff**: `Linh Hồn Tu Luyện` (+15%) • `Cửu Vĩ Yêu Hậu` (+80%).',
        inline: false,
      },
      {
        name: `${em('su_medal_role')} Mốc Level Roles`,
        value: `${levelMilestoneEmoji(5)} \`Lv.5\` → ${levelMilestoneEmoji(15)} \`Lv.15\` → ${levelMilestoneEmoji(20)} \`Lv.20\` → ${levelMilestoneEmoji(35)} \`Lv.35\` → ${levelMilestoneEmoji(45)} \`Lv.45\` → ${levelMilestoneEmoji(60)} \`Lv.60\` → ${levelMilestoneEmoji(80)} \`Lv.80\` → ${levelMilestoneEmoji(100)} \`Lv.100\``,
        inline: false,
      },
    ],
    content: 'Lộ trình tu luyện gồm 7 đại cảnh giới từ Lv.1 đến Lv.100. Đạt mốc cảnh giới tự động mở khóa thêm Slot Role Quyền Năng và nâng cấp viền Avatar trên `/profile` & `/rank`.',
  },

  battle: {
    id: 'battle',
    title: `${em('su_arena')} Đấu Trường, Ngũ Hành & Linh Vực`,
    icon: em('su_arena'),
    description: 'Quy tắc 1v1, Ngũ Hành Tương Khắc, Tứ Đại Dị Tố và hệ thống Linh Vực • Thần Thức • Thần Cảnh (từ Hiệp 2).',
    image_url: `${PUBLIC_BASE_URL}/api/wiki/chart/elements.webp?v=1.3.1`,
    sections: [
      {
        heading: '1. Vòng Xoay Ngũ Hành',
        content: '• Kim → Mộc → Thổ → Thủy → Hỏa → Kim.\n• Thuận khắc: +30% sát thương (×1.30).\n• Bị khắc: -20% sát thương gây ra (×0.80).',
      },
      {
        heading: '2. Tứ Đại Dị Tố Đặc Thù',
        content: '• Lôi: Khắc mạnh Thủy & Kim (+30% DMG); Thủy/Kim đánh Lôi giảm -20%.\n• Ám vs Quang: Tương sát lưỡng cực (+25% DMG hai chiều).\n• Hỗn Độn / Hư Không: Ngoài ngũ hành, không bị khắc, +20% sát thương chuẩn xuyên giáp & -15% sát thương nhận vào.',
      },
      {
        heading: '3. Quy Tắc 1v1 (/battle)',
        content: '• Ưu tiên ra đòn: HAX Lôi Quang Tốc > Final SPD cao hơn.\n• Công thức HP chiến đấu: (Lv × 1.000) + (Final DEF × 5) + Bonus HP.\n• Giới hạn 30 hiệp; cooldown 5 giây/trận.',
      },
      {
        heading: '4. Linh Vực • Thần Thức • Thần Cảnh (/linhvuc)',
        content: '• Gồm 30 Linh Vực, 15 Thần Thức & 15 Thần Cảnh (mở qua /roll loai:domain). Thần Thoại Độc Nhất & Thường cân bằng trong biên độ chênh lệch tối đa 15%.\n• Kích hoạt từ Hiệp 2: Linh Vực không cộng thẳng ATK/DEF/SPD mà tập trung Buff xuyên giáp/HAX và áp đặt Debuff.\n• Tương Khắc 5 Hệ Vực: Kiếm Vực → Huyễn Vực → Trận Vực → Minh Vực → Thánh Vực → Kiếm Vực. Khi cả hai Linh Vực cùng tồn tại, hệ bị khắc tiêu hao -2 Linh Mạch/hiệp (phe khắc -1/hiệp) và đôi bên chỉ nhận Buff sân nhà (trừ Linh Vực Thần Thoại có thuộc tính Xuyên Kháng Lãnh Địa).\n• Thần Thức gia tăng giới hạn Linh Mạch & hiệu lực Buff; Thần Cảnh cường hóa Debuff & bổ sung hiệu ứng bất lợi mới.',
      },
    ],
    fields: [
      {
        name: `${em('su_element_wheel')} Ngũ Hành & Tứ Đại Dị Tố`,
        value: `${elementEmoji('Kim')} Kim → ${elementEmoji('Mộc')} Mộc → ${elementEmoji('Thổ')} Thổ → ${elementEmoji('Thủy')} Thủy → ${elementEmoji('Hỏa')} Hỏa → Kim (\`+30%\` / \`-20%\`)\n• ${elementEmoji('Lôi')} **Lôi** khắc Thủy/Kim (\`+30%\`) • ${elementEmoji('Ám')} **Ám** ${em('su_crossed_swords')} ${elementEmoji('Quang')} **Quang** (\`+25%\`) • ${elementEmoji('Hỗn Độn')} **Hỗn Độn/Hư Không** (\`+20%\` xuyên giáp, \`-15%\` ST nhận).`,
        inline: false,
      },
      {
        name: `${em('su_realm_star')} Linh Vực • Thần Thức • Thần Cảnh (Hiệp 2+)`,
        value: [
          `• **Tương Khắc Vực**: ${domainElementEmoji('Kiếm Vực')} Kiếm Vực → ${domainElementEmoji('Huyễn Vực')} Huyễn Vực → ${domainElementEmoji('Trận Vực')} Trận Vực → ${domainElementEmoji('Minh Vực')} Minh Vực → ${domainElementEmoji('Thánh Vực')} Thánh Vực → Kiếm Vực (\`-1\` vs \`-2 Linh Mạch\`/hiệp).`,
          '• **Cơ chế Giằng Co**: Khi hai Linh Vực cùng hoạt động, đôi bên chỉ kích hoạt Buff sân nhà (những Linh Vực Thần Thoại có *Xuyên Kháng* vẫn áp đặt Debuff). Khi Linh Mạch địch cạn, toàn bộ Debuff khai mở hoàn toàn.',
          '• **Thần Thức / Thần Cảnh**: Thần Thức tăng trần Linh Mạch & Buff; Thần Cảnh tăng độ sâu Debuff & hiệu ứng khống chế (`/linhvuc`).',
        ].join('\n'),
        inline: false,
      },
      {
        name: `${em('su_crossed_swords')} Luật Đấu Trường 1v1 & PvE Tự Do`,
        value: '• `/battle @doi_thu`: PvP (`15` trận tính LT/ngày) • `/battle` (bỏ trống): **PvE Tự Do** (`25` trận tính LT/ngày — 50% Ngang / 10% Yếu / 40% Mạnh).\n• Thắng **`+10 LT`** / Thua **`-5 LT`** (tối thiểu `0 LT`) • Thứ tự đánh: `Lôi Quang Tốc` > `SPD` cao hơn • Tối đa **30 hiệp**.',
        inline: false,
      },
    ],
    content: 'Đấu Trường 1v1 (`/battle [doi_thu]`) kết hợp Ngũ Hành, Dị Tố, kỹ năng HAX và giao tranh Linh Vực từ Hiệp 2, xuất trực tiếp Ảnh Chiến Báo đa lượt.',
  },

  equipment: {
    id: 'equipment',
    title: `${em('su_crossed_swords')} Trang Bị Loadout (165 Pháp Bảo)`,
    icon: em('su_crossed_swords'),
    description: '3 Slot trang bị (57 Vũ Khí, 54 Bảo Ngọc, 54 Chiến Hồn), tỉ lệ rớt và quy tắc 39 Pháp Bảo Thần Thoại Độc Nhất.',
    image_url: '',
    sections: [
      {
        heading: '1. Cấu Trúc 3 Slot Loadout (165 Pháp Bảo)',
        content: '• Vũ Khí (57 món): Tăng ATK, SPD, tỉ lệ bạo kích CRIT và hiệu ứng HAX công kích.\n• Bảo Ngọc (54 món): Tăng DEF, HP tối đa, khiên hộ mệnh và kháng hiệu ứng.\n• Chiến Hồn (54 món): Tăng chỉ số tổng hợp và kích hoạt thiên phú HAX đa tầng.',
      },
      {
        heading: '2. Tỉ Lệ Rớt & Quy Tắc Độc Nhất Toàn Server',
        content: '• Phàm Phẩm: 60.5% • Linh Phẩm: 25% • Tiên Phẩm: 14% • Thần Thoại: 0.5%.\n• Toàn kho gồm 39 Pháp Bảo Thần Thoại Độc Nhất Toàn Server (mỗi món chỉ 1 chủ nhân) và 56 Pháp Bảo Thần Thoại Tự Do cho toàn thể tu sĩ cùng săn; cân bằng tổng thể giữa Độc Nhất và Thường tối đa trong ngưỡng 15%.\n• Phẩm chất Khắc Ấn mặc định: D (40%) / C (32%) / B (20%) / A (8%) — S (+40%) chỉ nâng qua /enchant.',
      },
    ],
    fields: [
      {
        name: `${em('su_shield_def')} 3 Nhóm Pháp Bảo (165 Món)`,
        value: `• ${em('su_crossed_swords')} **Vũ Khí** (57 món): \`ATK • SPD • CRIT\`\n• ${em('su_linhthach')} **Bảo Ngọc** (54 món): \`DEF • HP • Khiên\`\n• ${em('su_thunder_hax')} **Chiến Hồn** (54 món): \`ATK • DEF • SPD • HAX\``,
        inline: true,
      },
      {
        name: `${em('su_gacha_dice')} Tỉ Lệ Rớt`,
        value: `• ${tierEmoji('common')} Phàm Phẩm: **60.5%**\n• ${tierEmoji('rare')} Linh Phẩm: **25%**\n• ${tierEmoji('epic')} Tiên Phẩm: **14%**\n• ${tierEmoji('mythic')} Thần Thoại: **0.5%** *(39 Độc Nhất + 56 Tự Do)*`,
        inline: true,
      },
      {
        name: `${tierEmoji('supreme')} Quy Tắc Độc Nhất, Kế Thừa Tư Chất & /phapbao`,
        value: '39 Pháp Bảo Thần Thoại Độc Nhất chỉ tồn tại **1 bản trên toàn server**; 56 Thần Thoại Tự Do cùng hàng chục Pháp Bảo mới sở hữu HAX riêng biệt và chênh lệch sức mạnh tối đa `<= 15%`. Quay trùng Pháp Bảo thường tự cộng số lượng & tự kế thừa tư chất `max(D..S)`. Dùng `/phapbao` xem toàn kho & `/enchant` nâng hạng **D → S**.',
        inline: false,
      },
    ],
    content: 'Hệ thống trang bị gồm **165 Pháp Bảo** chia đều 3 Slot **Vũ Khí • Bảo Ngọc • Chiến Hồn** (mỗi món sở hữu HAX riêng + Khắc Ấn **D → S**).',
  },

  pets: {
    id: 'pets',
    title: `${em('su_pet_paw')} Linh Thú Tiên Giới (90 Chiến Pet)`,
    icon: em('su_pet_paw'),
    description: 'Khái niệm Linh Thú, công thức Chiến Lực và 4 bậc phẩm cấp (13 Phàm / 13 Linh / 14 Tiên / 50 Thần Thoại).',
    image_url: '',
    sections: [
      {
        heading: '1. Linh Thú Là Gì?',
        content: '• Linh Thú là chiến hữu đồng hành xuất trận trực tiếp trong /battle và hiển thị trên thẻ /profile (kèm cấp Sao 1★–10★ & Hạng Khắc Ấn D–S).\n• Mọi tân thủ được cấp sẵn 1 Pet Phàm Phẩm mặc định: Hóa Thạch Nham Nham Thú (Hệ Thổ • 120 ATK / 180 DEF / 100 SPD).\n• Quay trùng Linh Thú không độc nhất sẽ cộng dồn số lượng và tự động giữ tư chất Khắc Ấn cao nhất (Auto-Best Grade).\n• Công thức Chiến Lực: (ATK × 3) + (DEF × 2) + (SPD × 2) + (Lv × 50) + Bonus Trang Bị.',
      },
      {
        heading: '2. Phân Chia 4 Bậc Phẩm Cấp & Tỉ Lệ Rớt',
        content: '• Phàm Phẩm (13 loài) — Tỉ lệ rớt: 60.5% (hoặc 300 LT trong /shop).\n• Linh Phẩm (13 loài) — Tỉ lệ rớt: 25% (hoặc 900 LT trong /shop).\n• Tiên Phẩm (14 loài) — Tỉ lệ rớt: 14% (chỉ mở từ /roll).\n• Thần Thoại (50 loài: 10 Độc Nhất Toàn Server + 40 Thần Thoại Tự Do) — Tỉ lệ rớt: 0.5% (chỉ mở từ /roll).',
      },
    ],
    fields: [
      {
        name: `${em('su_wiki_scroll')} Khái Niệm & Công Thức`,
        value: 'Linh Thú là chiến hữu xuất trận trong `/battle`, mang Hệ Ngũ Hành, Kỹ Năng HAX & Hạng Khắc Ấn (`D → S`) riêng.\n• **Pet khởi đầu**: `Hóa Thạch Nham Nham Thú` *(Phàm Phẩm • 120 ATK / 180 DEF / 100 SPD)*.\n• **Chiến Lực**: `(ATK × 3) + (DEF × 2) + (SPD × 2) + (Lv × 50) + Trang Bị`.',
        inline: false,
      },
      {
        name: `${em('su_gacha_dice')} 4 Bậc Phẩm Cấp & Tỉ Lệ Rớt (90 Linh Thú Tiêu Chuẩn)`,
        value: `• ${tierEmoji('common')} **Phàm Phẩm** *(13 loài)* — Tỉ lệ rớt: **60.5%** *(hoặc 300 LT trong \`/shop\`)*\n• ${tierEmoji('rare')} **Linh Phẩm** *(13 loài)* — Tỉ lệ rớt: **25%** *(hoặc 900 LT trong \`/shop\`)*\n• ${tierEmoji('epic')} **Tiên Phẩm** *(14 loài)* — Tỉ lệ rớt: **14%** *(chỉ mở từ \`/roll\`)*\n• ${tierEmoji('mythic')} **Thần Thoại** *(50 loài: 10 Độc Nhất + 40 Tự Do)* — Tỉ lệ rớt: **0.5%** *(chỉ mở từ \`/roll\`)*`,
        inline: false,
      },
    ],
    content: 'Bách khoa **90 Chiến Linh Thú tiêu chuẩn** phân chia 4 bậc Phẩm Cấp (**13 Phàm • 13 Linh • 14 Tiên • 50 Thần Thoại**), cân bằng chặt chẽ theo ma trận khắc chế HAX & Khắc Ấn **D → S**.',
  },

  economy: {
    id: 'economy',
    title: `${em('su_linhthach')} Kinh Tế, Nông Trại, Tiên Lữ & Gia Tộc`,
    icon: em('su_linhthach'),
    description: 'Kinh tế Linh Thạch, Công Việc /job (8 ca/ngày), Nông Trại /farm & /exchange, 4 Thức chơi Linh Thạch, Tiên Lữ /marry và Gia Tộc /giatoc.',
    image_url: '',
    sections: [
      {
        heading: '1. Linh Thạch, /job & Cửa Hàng (/daily, /job, /doiqua, /roll, /shop, /dismantle, /enchant, /tangqua, /nhiemvu, /top)',
        content: '• /daily: 40–60 LT + Streak 7 ngày • Lên cấp mới (1 lần/cấp): +50..+400 LT/cấp + thưởng mốc 10 cấp • Voice EXP: 85–135/5p chấm công mỗi 12 phút.\n• /job: 6 Công Việc Tu Tiên (Quét Sân, Rửa Bát, Tưới Cây, Giao Trà Sữa, Câu Cá, Tuần Tra — hồi 1 giờ/ca, tối đa 8 ca/ngày) nhận +35..+75 LT & +18..+32 EXP.\n• /doiqua: Phế 1.000 EXP -> 10 LT (không nhận lại thưởng level đã qua).\n• /roll: 50 LT/lượt (450/10 lượt). 4 Bể Gacha: Pháp Bảo (equipment), Linh Thú (pet), Role (role), Linh Vực/Thần Thức/Thần Cảnh (domain). Tỉ lệ chuẩn: Phàm 60.5% • Linh 25% • Tiên 14% • Thần Thoại 0.5%.\n• /shop: Nhẫn Cưới 4 cấp, 26 Pet & 44 Pháp Bảo Phàm/Linh, 21 Role Đơn (7d/30d/VV), Đá Khắc Ấn (150 LT, 5/ngày, max 99), Thẻ Reset Tháp (200 LT, 3/ngày, max 10 túi), 20 Background.\n• /dismantle: Mua Shop hoàn 20% (Pháp Bảo) hoặc 25% (Pet/Role) giá thực trả; đồ Gacha tính giá thu hồi chuẩn. Hỗ trợ phá hàng loạt all_common/all_rare/all_epic hoặc CSV cho cả Item, Pet và Role.\n• /enchant: Khắc Ấn nâng phẩm D -> C -> B -> A -> S (+0% -> +40% chỉ số) bằng Đá Khắc Ấn + LT (hụt tăng +5% Pity, không rớt cấp).\n• /nhiemvu: 5 Nhiệm Vụ Ngày (+15/+20/+25/+20/+20 LT; hoàn tất 5/5 thưởng thêm +115 LT + 1 Vé Triệu Hồi Pháp Bảo + 1 Tinh Thạch + 1 Đá Khắc Ấn) + 3 Hợp Đồng Tuần (reset Thứ 2) + Tháp Thí Luyện 200 Tầng (Boss tầng chia hết 5 thưởng thêm Đá Khắc Ấn).',
      },
      {
        heading: '2. Nông Trại Thời Gian Thực (/farm & /exchange)',
        content: '• Mặc định 4 ô (Ô 1–2 Linh Điền trồng Thảo Dược, Ô 3–4 Linh Các ấp Trứng Linh Thú; có thể mở tối đa 6 ô tại /exchange).\n• 3 Chu kỳ 6h / 12h / 24h: Quay lại Tưới nước / Cho ăn đúng khung giờ (2h / 4h / 6h) để giữ sinh khí; bỏ bê quá lâu (4.5h / 7h / 12h) sẽ héo úa.\n• Thu hoạch nhận Linh Thạch lãi lớn & Linh Quả Tiên Giới (farm_essence), quy đổi tại /exchange lấy Linh Thạch, Đá Khắc Ấn, Tinh Thạch, Vé Gacha (Pháp Bảo/Pet/Linh Vực), Thẻ Tẩy Tủy Tháp & Mở Ô Canh Tác.',
      },
      {
        heading: '3. Giải Trí Linh Thạch (/coinflip, /blackjack, /slots, /crash)',
        content: '• Mức cược 10–10.000 LT/ván (cooldown 5 giây): Tung Xu /coinflip (1:2), Thất Điểm 21 /blackjack (1:2), Tụ Bảo Bồn 4 Ô /slots (tối đa 1:5), Ngự Kiếm Phá Không /crash (rút trước khi nổ).',
      },
      {
        heading: '4. Tiên Lữ (/marry, /divorce) & Gia Tộc (/giatoc)',
        content: '• 4 Cấp Nhẫn: Phàm (+5%) -> Linh (+10%) -> Tiên (+15%) -> Thần Thoại (+20% EXP & Chiến Lực đôi); Streak kết hôn tới +25% (+10% EXP Ngày Kỷ Niệm).\n• Gia Tộc (/giatoc): Thành lập từ Lv.20 + 1.000 LT; nâng cấp Lv.1–10 (10–50 thành viên, buff +2%..+20% EXP & Daily LT); Clan Wars 24H từ 500 LT ngân khố.',
      },
    ],
    fields: [
      {
        name: `${em('su_linhthach')} Linh Thạch, /job, Gacha & Khắc Ấn`,
        value: [
          '• `/daily` • `/job` *(6 nghề, 8 ca/ngày, hồi 1h/ca, +35–75 LT & 18–32 EXP)* • `/doiqua` (`1.000 EXP → 10 LT`).',
          '• **4 Bể Gacha `/roll`** *(Pháp Bảo / Linh Thú / Role / Linh Vực)*: `50 LT/lượt` (`450 LT/10`) • `Phàm 60.5% • Linh 25% • Tiên 14% • Thần Thoại 0.5%`.',
          '• `/shop`: Nhẫn Cưới, **26 Pet / 44 Pháp Bảo** Phàm & Linh, **21 Role Đơn**, **Đá Khắc Ấn (150 LT)**, **Thẻ Reset Tháp (200 LT)**, 20 Background.',
          '• `/dismantle` & `/enchant`: Thu hồi Shop `20%–25%` / Gacha chuẩn • Khắc Ấn **D → S** (`+0%..+40%`).',
          '• `/nhiemvu`: **5 Nhiệm Vụ Ngày** *(thưởng từng mục + mốc 5/5 hậu hĩnh)* + **3 Hợp Đồng Tuần** + **Tháp 200 Tầng**.',
        ].join('\n'),
        inline: false,
      },
      {
        name: `${em('su_sprout')} Nông Trại (/farm • /exchange) & Giải Trí Linh Thạch`,
        value: [
          '• **`/farm`**: 4–6 ô **Linh Điền & Linh Các** (`6h/12h/24h`), chăm sóc đúng khung giờ nhận **Linh Thạch & Linh Quả** (`farm_essence`).',
          '• **`/exchange`**: Quy đổi **Linh Quả** lấy Linh Thạch, Đá Khắc Ấn, Tinh Thạch, Vé Gacha các loại, Thẻ Tẩy Tủy & Mở Ô #5/#6.',
          '• **Minigame (`10–10.000 LT`)**: `/coinflip` *(1:2)* • `/blackjack` *(1:2)* • `/slots` *(4 ô, tối đa 1:5)* • `/crash` *(Ngự Kiếm)* .',
        ].join('\n'),
        inline: false,
      },
      {
        name: `${em('ring_mythic')} Tiên Lữ Kết Hôn (/marry • /divorce)`,
        value: '• **4 Cấp Nhẫn**: Phàm (`+5%`) → Linh (`+10%`) → Tiên (`+15%`) → Thần Thoại (`+20%` EXP & Chiến Lực đôi).\n• **Streak Ngày Cưới**: `7d (+2%)` → `30d (+5%)` → `100d (+8%)` → `180d (+12%)` → `365d+ (+15%..+25%)` & `+10% EXP` đúng Ngày Kỷ Niệm.',
        inline: false,
      },
      {
        name: `${em('su_clan_castle')} Gia Tộc & Clan Wars 24H (/giatoc)`,
        value: '• Điều kiện lập: `Lv.20+` & `1.000 Linh Thạch` • Quy mô `Lv.1–10` (`10–50` thành viên).\n• Buff thành viên: `+2%` đến `+20% EXP` & Daily Linh Thạch.\n• **Clan Wars 24H**: Đặt cược từ `500` Linh Thạch từ ngân khố, tranh tài 24 giờ thắng nhận trọn `×2` tiền cược + `5.000 EXP Tộc`.',
        inline: false,
      },
    ],
    content: 'Hệ thống Kinh Tế, Nghề Tu Tiên `/job` (8 ca/ngày), Nông Trại `/farm`, Đổi Quà `/exchange`, 4 Thức chơi Linh Thạch, Tiên Lữ và Gia Tộc Chiến 24H liên kết chặt chẽ giúp cộng đồng SuMi Family phát triển bền vững.',
  },
};

/**
 * Tra cứu danh mục Wiki (tất cả 6 chuyên mục hoặc lọc 1 chuyên mục duy nhất)
 */
export function getWikiData(categoryId = null) {
  if (!categoryId || typeof categoryId !== 'string') {
    return {
      success: true,
      ...WIKI_METADATA,
      categories: VALID_CATEGORIES.map((k) => WIKI_CATEGORIES[k]),
    };
  }

  const raw = categoryId.trim().toLowerCase();
  if (!raw || raw === 'all') {
    return {
      success: true,
      ...WIKI_METADATA,
      categories: VALID_CATEGORIES.map((k) => WIKI_CATEGORIES[k]),
    };
  }

  const resolvedId = Object.prototype.hasOwnProperty.call(CATEGORY_ALIASES, raw)
    ? CATEGORY_ALIASES[raw]
    : raw;

  if (!VALID_CATEGORIES.includes(resolvedId) || !Object.prototype.hasOwnProperty.call(WIKI_CATEGORIES, resolvedId)) {
    return {
      success: false,
      error: 'Category not found',
      message: `Chuyên mục wiki '${categoryId}' không tồn tại.`,
      valid_categories: VALID_CATEGORIES,
    };
  }

  return {
    success: true,
    ...WIKI_METADATA,
    category: resolvedId,
    data: WIKI_CATEGORIES[resolvedId],
  };
}

/**
 * Trả về danh mục phân nhóm phục vụ Dropdown Trang Bị (3 nhóm) & Linh Thú (4 phẩm cấp — 90 Linh Thú tiêu chuẩn)
 */
export function getWikiCatalogSummary() {
  const standardPets = PET_CATALOG.filter((p) => !p.is_exclusive_fuyumi);
  return {
    success: true,
    equipment: {
      weapon: EQUIPMENT_CATALOG.filter((i) => i.item_type === 'weapon'),
      gem: EQUIPMENT_CATALOG.filter((i) => i.item_type === 'gem'),
      soul: EQUIPMENT_CATALOG.filter((i) => i.item_type === 'soul'),
    },
    pets: {
      common: standardPets.filter((p) => p.rarity_key === 'common'),
      rare: standardPets.filter((p) => p.rarity_key === 'rare'),
      epic: standardPets.filter((p) => p.rarity_key === 'epic'),
      mythic: standardPets.filter((p) => p.rarity_key === 'mythic'),
    },
  };
}

/**
 * Truy vấn chủ sở hữu thực tế từ Supabase cho các Pháp Bảo Thần Thoại Độc Nhất
 */
async function resolveMythicItemOwner(itemId) {
  if (supabase) {
    try {
      const { data: ownership } = await supabase
        .from('user_pet_items')
        .select('user_id')
        .eq('item_id', itemId)
        .limit(1)
        .maybeSingle();

      if (!ownership?.user_id) return null;

      const { data: user } = await supabase
        .from('users')
        .select('user_id, username')
        .eq('user_id', ownership.user_id)
        .maybeSingle();

      return {
        user_id: ownership.user_id,
        username: user?.username || `Tu Sĩ #${String(ownership.user_id).slice(-4)}`,
      };
    } catch (err) {
      console.warn(`[WikiService] Failed to query mythic owner for ${itemId}:`, err.message);
      return null;
    }
  }

  // Fallback chỉ khi chạy offline không kết nối Supabase
  if (['weapon_mythic_1', 'gem_mythic_3', 'soul_mythic_1'].includes(itemId)) {
    return { user_id: FUYUMI_USER_ID, username: `Fuyumi ${em('su_sakura')}` };
  }
  return null;
}

/**
 * Tra cứu chi tiết 1 Pháp Bảo Loadout (kèm Chủ Sở Hữu thời gian thực cho 39 món Thần Thoại Độc Nhất)
 */
export async function getWikiItemDetail(itemId) {
  if (!itemId || typeof itemId !== 'string') {
    return { success: false, error: 'Item not found', message: 'Thiếu mã trang bị.' };
  }

  const cleanId = itemId.trim().toLowerCase().replace(/\.(png|webp)$/i, '');
  if (!Object.prototype.hasOwnProperty.call(EQUIPMENT_BY_ID, cleanId)) {
    return {
      success: false,
      error: 'Item not found',
      message: `Trang bị '${itemId}' không tồn tại.`,
    };
  }

  const item = EQUIPMENT_BY_ID[cleanId];
  const tier = RARITY_TIERS[item.rarity_key] || RARITY_TIERS.common;
  const slotLabel = item.item_type === 'weapon' ? 'Vũ Khí' : item.item_type === 'gem' ? 'Bảo Ngọc' : 'Chiến Hồn';
  const currentOwner = item.is_unique ? await resolveMythicItemOwner(item.item_id) : null;

  const statParts = [];
  if (item.bonus_atk) statParts.push(`ATK ${item.bonus_atk > 0 ? '+' : ''}${item.bonus_atk}`);
  if (item.bonus_def) statParts.push(`DEF ${item.bonus_def > 0 ? '+' : ''}${item.bonus_def}`);
  if (item.bonus_spd) statParts.push(`SPD ${item.bonus_spd > 0 ? '+' : ''}${item.bonus_spd}`);
  if (item.bonus_hp) statParts.push(`HP +${item.bonus_hp.toLocaleString('vi-VN')}`);
  if (item.bonus_crit) statParts.push(`CRIT +${item.bonus_crit}%`);

  const ownerLine = item.is_unique
    ? (currentOwner
      ? `${tierEmoji('supreme')} **Độc Nhất Toàn Server** — Chủ sở hữu: **${currentOwner.username}** (<@${currentOwner.user_id}>)`
      : `${tierEmoji('supreme')} **Độc Nhất Toàn Server** — Chưa có chủ sở hữu`)
    : null;

  const effectLine = item.hax_skill
    ? `${em('su_thunder_hax')} **${item.hax_skill}**: ${item.hax_description}`
    : (item.hax_description ? `${em('su_sparkle')} ${item.hax_description}` : 'Tăng trực tiếp chỉ số chiến đấu cho Linh Thú.');

  const descriptionLines = [
    `${tier.emoji} **${item.rarity}** • ${slotLabel} • ${elementEmoji(item.element)} Hệ **${item.element}** • Tỉ lệ rớt **${item.drop_rate}%**`,
    `${em('su_stats_chart')} **Chỉ số**: \`${statParts.join(' | ') || 'Không có'}\``,
    effectLine,
  ];
  if (ownerLine) descriptionLines.push(ownerLine);

  const imageUrl = `${PUBLIC_BASE_URL}/api/wiki/item/${item.item_id}.webp?v=1.3`;

  return {
    success: true,
    data: {
      ...item,
      slot_label: slotLabel,
      current_owner: currentOwner,
      owner_label: item.is_unique
        ? (currentOwner ? currentOwner.username : 'Chưa có chủ sở hữu')
        : null,
      image_url: imageUrl,
      asset_path: `items/${item.item_id}.png`,
    },
    embed: {
      title: `${itemEmoji(item.item_id, item.icon)} ${item.item_name}`.trim(),
      description: descriptionLines.join('\n'),
      color: tier.color,
      color_dec: tier.colorDec,
      image_url: imageUrl,
      footer: `SuMi Family • Kho Pháp Bảo (${slotLabel} • ${item.rarity})`,
    },
  };
}

/**
 * Tra cứu chi tiết 1 Linh Thú theo mã pet_type (chỉ trả 90 Linh Thú tiêu chuẩn, ẩn pet độc quyền Fuyumi khỏi /wiki)
 */
export async function getWikiPetDetail(petType) {
  if (!petType || typeof petType !== 'string') {
    return { success: false, error: 'Pet not found', message: 'Thiếu mã Linh Thú.' };
  }

  const cleanType = petType.trim().toLowerCase().replace(/\.(png|webp)$/i, '');
  if (!Object.prototype.hasOwnProperty.call(PET_BY_TYPE, cleanType) || PET_BY_TYPE[cleanType].is_exclusive_fuyumi) {
    return {
      success: false,
      error: 'Pet not found',
      message: `Linh Thú '${petType}' không tồn tại.`,
    };
  }

  const pet = PET_BY_TYPE[cleanType];
  const tier = RARITY_TIERS[pet.rarity_key] || RARITY_TIERS.common;

  const tagNotes = [];
  if (pet.is_starter) tagNotes.push(`${em('su_sprout')} Linh Thú Khởi Đầu Mặc Định`);

  const descriptionLines = [
    `${tier.emoji} **${pet.rarity}** • ${elementEmoji(pet.element)} Hệ **${pet.element}** • Tỉ lệ rớt **${pet.drop_rate}%**${tagNotes.length ? ` • ${tagNotes.join(' • ')}` : ''}`,
    `${em('su_stats_chart')} **Chỉ số gốc (Lv.1)**: \`ATK ${pet.base_atk.toLocaleString('vi-VN')} | DEF ${pet.base_def.toLocaleString('vi-VN')} | SPD ${pet.base_spd.toLocaleString('vi-VN')} | HP ${pet.base_hp.toLocaleString('vi-VN')}\``,
    `${em('su_thunder_hax')} **Nội tại (${pet.hax_skill})**: ${pet.hax_description}`,
  ];

  const imageUrl = `${PUBLIC_BASE_URL}/api/wiki/pet/${pet.pet_type}.webp?v=1.3`;

  return {
    success: true,
    data: {
      ...pet,
      image_url: imageUrl,
    },
    embed: {
      title: `${petEmoji(pet.pet_type, pet.icon)} ${pet.pet_name}`.trim(),
      description: descriptionLines.join('\n'),
      color: tier.color,
      color_dec: tier.colorDec,
      image_url: imageUrl,
      footer: `SuMi Family • Bách Khoa Linh Thú (${pet.rarity} • Hệ ${pet.element})`,
    },
  };
}
