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
import { V14_EXPLORER_MAPS } from '../data/v14ExpansionCatalog.js';
import {
  V13_DOMAINS,
  V13_DIVINE_SENSES,
  V13_DIVINE_REALMS,
} from '../data/v13ExpansionCatalog.js';
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

export const VALID_CATEGORIES = [
  'overview',
  'realms',
  'battle',
  'equipment',
  'pets',
  'domains',
  'roles',
  'economy',
  'explorer',
  'glossary',
];

const CATEGORY_ALIASES = {
  beginner: 'overview',
  tong_quan: 'overview',
  canh_gioi: 'realms',
  dau_truong: 'battle',
  trang_bi: 'equipment',
  linh_thu: 'pets',
  linh_vuc: 'domains',
  linhvuc: 'domains',
  domain: 'domains',
  domains: 'domains',
  than_thuc: 'domains',
  thanthuc: 'domains',
  than_canh: 'domains',
  thancanh: 'domains',
  linh_vuc_than_thuc: 'domains',
  role: 'roles',
  quyen_nang: 'roles',
  chuc_nang: 'roles',
  discord_role: 'roles',
  quyen: 'roles',
  kinh_te: 'economy',
  nong_trai: 'economy',
  farm: 'economy',
  minigame: 'economy',
  kham_pha: 'explorer',
  ban_do: 'explorer',
  map: 'explorer',
  dai_luc: 'explorer',
  thuat_ngu: 'glossary',
  thuatngu: 'glossary',
  tu_dien: 'glossary',
  tudien: 'glossary',
  terms: 'glossary',
  mechanics: 'glossary',
  glossary: 'glossary',
  glossary_1: 'glossary',
  glossary_2: 'glossary',
  glossary_3: 'glossary',
  glossary_4: 'glossary',
};

export const WIKI_METADATA = {
  title: 'Cẩm Nang Tu Tiên SuMi Family',
  subtitle: 'Cẩm nang v1.6.1 • 10 Chuyên Mục • 165 Pháp Bảo • 90 Linh Thú • 60 Linh Vực • Từ Điển Thuật Ngữ',
  version: '1.6.1',
  guild: 'SuMi Family (1026096141273661450)',
  guild_id: '1026096141273661450',
  bot: 'Nhiễm Nhiễm (916469360401453067)',
  bot_id: '916469360401453067',
  owner: 'Fuyumi (757091869183311872)',
  owner_id: FUYUMI_USER_ID,
  theme_color: '#ec4899',
  theme_color_dec: 15485081,
  updated_at: '2026-11-24T00:00:00.000Z',
  total_categories: 10,
};

export const WIKI_CATEGORIES = {
  overview: {
    id: 'overview',
    title: `${em('su_wiki_scroll')} Tổng Quan Tu Tiên`,
    icon: em('su_wiki_scroll'),
    description: 'Khởi đầu tu hành, bộ lệnh Tu Tiên & Tiện Ích Server (v1.5).',
    image_url: '',
    sections: [
      {
        heading: '1. Khởi Đầu Nhanh',
        content: '• Mặc định Lv.1 • 0 EXP • 0 LT • 1 Slot Role • Pet Hóa Thạch Nham Nham Thú (120 ATK / 180 DEF / 100 SPD).\n• Tích EXP tự động qua Chat (23–35 EXP/45s) & Voice (85–135 EXP/5p).',
      },
      {
        heading: '2. Bộ Lệnh Tu Tiên & Tiện Ích Server (v1.6)',
        content: '• Hồ sơ: /profile, /rank, /exp, /doiqua.\n• Chiến đấu: /battle, /linhvuc, /party, /linhmach, /nhiemvu.\n• Gacha & Kho: /roll, /autosell, /shop, /dothach, /gieoque, /inv, /phapbao, /linhthu, /pet, /roles, /equip, /unequip, /enchant, /dismantle.\n• Kinh tế & Cộng đồng: /daily, /job, /farm, /exchange, /luyendan, /explorer, /tangqua, /marry, /divorce, /giatoc, /top, /coinflip, /blackjack, /slots, /crash.\n• Tra cứu & Tiện ích: /wiki, /info, /updates • /play, /queue, /music, /sound • /giveaway_create, /giveaway_end, /giveaway_list, /giveaway_cancel, /giveaway_check • /sticky-set, /sticky-off.',
      },
    ],
    fields: [
      {
        name: `${em('su_sprout')} Khởi Đầu`,
        value: '• Tự tạo hồ sơ khi Chat (`23–35 EXP/45s`) hoặc Voice (`85–135 EXP/5p`).\n• Tặng sẵn Pet **Hóa Thạch Nham Nham Thú** *(120 ATK / 180 DEF / 100 SPD)* & 1 Slot Role.',
        inline: false,
      },
      {
        name: `${em('su_pin_sigil')} Lệnh Tu Tiên (v1.6)`,
        value: [
          '• **Hồ sơ:** `/profile` • `/rank` • `/exp` *(xem Boost)* • `/doiqua` *(đổi EXP→LT)*',
          '• **Chiến đấu:** `/battle` • `/linhvuc` • `/party` • `/linhmach` • `/nhiemvu` *(Tháp 500 tầng)*',
          '• **Kho & Gacha:** `/roll` • `/dothach` • `/gieoque` • `/autosell` • `/shop` • `/inv` • `/phapbao` • `/linhthu` • `/pet` • `/roles` • `/equip` • `/unequip` • `/enchant` • `/dismantle`',
          '• **Kinh tế & Xã hội:** `/daily` • `/job` • `/farm` • `/exchange` • `/luyendan` • `/explorer` • `/tangqua` • `/marry` • `/divorce` • `/giatoc` • `/top`',
          '• **Giải trí & Cẩm nang:** `/coinflip` • `/blackjack` • `/slots` • `/crash` • `/wiki` • `/info` • `/updates`',
        ].join('\n'),
        inline: false,
      },
      {
        name: `${em('su_sparkle')} Lệnh Tiện Ích Server`,
        value: '• **Âm nhạc:** `/play` • `/queue` • `/music` • `/sound`\n• **Giveaway & Ghim:** `/giveaway_create` • `/giveaway_end` • `/giveaway_list` • `/giveaway_cancel` • `/giveaway_check` • `/sticky-set` • `/sticky-off`',
        inline: false,
      },
    ],
    content: 'Hệ thống Tu Tiên SuMi Family v1.5: Buff SET 2 tầng, Pity 350, 20 Viền Avatar, Top Chat/Voice ngày, Tháp 500 tầng, Nông Trại, Khám Phá 12 địa danh & tiện ích Server.',
  },

  realms: {
    id: 'realms',
    title: `${em('su_realm_7_hondondao')} Hệ Thống Cảnh Giới & Thăng Cấp`,
    icon: em('su_realm_7_hondondao'),
    description: '7 Đại Cảnh Giới (Lv.1–100), EXP Chat/Voice & 8 mốc Level Roles.',
    image_url: '',
    sections: [
      {
        heading: '1. Bảy Cảnh Giới & Slot Role',
        content: '• Lv.1–19 Luyện Khí (1 Slot) → Lv.20–39 Trúc Cơ (2 Slot) → Lv.40–59 Kim Đan (3 Slot) → Lv.60–79 Nguyên Anh (4 Slot) → Lv.80–100 Hóa Thần / Đại Thừa / Hỗn Độn Chúa Tể (5 Slot).',
      },
      {
        heading: '2. Nguồn EXP & Mốc Level Role',
        content: '• Chat: 23–35 EXP/tin (45s) • Voice: 85–135 EXP/5p (chấm công 12p) • Công thức: 78 × Level^1.45 (max 500.000 EXP). Dùng /exp xem chi tiết Boost.\n• Mốc Level: Lv.5 (+3% EXP), Lv.10 (+5%), Lv.20 (+8% EXP/+5% LT), Lv.35 (+12%/+10%), Lv.45 (+15%/+10%/+5% Pet), Lv.60 (+20%/+15%/+8%), Lv.80 (+30%/+25%/+12%), Lv.100 Trảm Quyết Tối Thượng (+50%/+50%/+20%).\n• Buff Viền Avatar & Ảnh Nền (/shop): Phàm +2% • Linh +4% • Tiên +7% • Thần Thoại +10% EXP & LT mỗi món (cộng dồn tới +20% EXP & +20% LT).',
      },
    ],
    fields: [
      {
        name: `${em('su_mountain')} 7 Cảnh Giới & Slot Role`,
        value: `${realmEmoji(1)} **Lv.1–19** Luyện Khí *(1 Slot)* • ${realmEmoji(20)} **Lv.20–39** Trúc Cơ *(2)* • ${realmEmoji(40)} **Lv.40–59** Kim Đan *(3)*\n${realmEmoji(60)} **Lv.60–79** Nguyên Anh *(4)* • ${realmEmoji(80)} **Lv.80–89** Hóa Thần *(5)* • ${realmEmoji(90)} **Lv.90–99** Đại Thừa *(5)* • ${realmEmoji(100)} **Lv.100** Hỗn Độn Chúa Tể`,
        inline: false,
      },
      {
        name: `${em('su_level_up')} Nguồn EXP & Công Thức`,
        value: '• **Chat:** `23–35 EXP` / tin *(cooldown 45s)* • **Voice:** `85–135 EXP` / 5p *(chấm công 12p)*.\n• **Cần lên cấp:** `78 × Level^1.45` *(trần `500.000 EXP`)* • **Viền & Ảnh Nền (`/shop`):** `Phàm +2% • Linh +4% • Tiên +7% • Thần Thoại +10%` EXP & LT mỗi món *(max +20%)* • Tra tổng boost bằng `/exp`.',
        inline: false,
      },
      {
        name: `${em('su_medal_role')} Mốc Level Role & Quyền Cơ Bản Discord`,
        value: [
          `• ${levelMilestoneEmoji(5)} \`Lv.5\` (+3% EXP): Gửi ảnh/tệp • ${levelMilestoneEmoji(10)} \`Lv.10\` (+5% EXP): Phát trực tiếp (Stream)`,
          `• ${levelMilestoneEmoji(20)} \`Lv.20\` (+8% EXP, +5% LT): Emoji Nitro liên server & Lập Gia Tộc • ${levelMilestoneEmoji(35)} \`Lv.35\` (+12%/+10%): Nhúng liên kết`,
          `• ${levelMilestoneEmoji(45)} \`Lv.45\` (+15%/+10%/+5% Pet): Sticker liên server • ${levelMilestoneEmoji(60)} \`Lv.60\` (+20%/+15%/+8%): Voice Message`,
          `• ${levelMilestoneEmoji(80)} \`Lv.80\` (+30%/+25%/+12%): Soundboard • ${levelMilestoneEmoji(100)} \`Lv.100\` **Trảm Quyết Tối Thượng** (+50%/+50%/+20%): Âm thanh liên server`,
          `• *Đặc quyền nâng cao (Đổi nick, Thread, Ghim, Priority, Poll, Slowmode...) đến từ các Role Quyền Năng trong \`/roll loai:role\`!*`,
        ].join('\n'),
        inline: false,
      },
    ],
    content: '7 cảnh giới từ Lv.1 đến Lv.100 mở dần tới 5 Slot Role. Chat nhận 23–35 EXP/45s, Voice nhận 85–135 EXP/5p; dùng /exp xem chi tiết.',
  },

  battle: {
    id: 'battle',
    title: `${em('su_arena')} Đấu Trường, Ngũ Hành & Linh Vực`,
    icon: em('su_arena'),
    description: 'Luật 1v1 /battle, Buff SET 2 tầng, Web Logs 48h, Ngũ Hành • Dị Tố, Linh Vực (Hiệp 2+) & Tổ Đội Linh Mạch.',
    image_url: `${PUBLIC_BASE_URL}/api/wiki/chart/elements.webp?v=1.3.1`,
    sections: [
      {
        heading: '1. Ngũ Hành & Dị Tố',
        content: `• Kim → Mộc → Thổ → Thủy → Hỏa → Kim (+30% / -20%).\n• Lôi khắc Thủy & Kim (+30% / -20%); Ám <-> Quang (+25% hai chiều); Hỗn Độn/Hư Không (+20% xuyên giáp, -15% ST nhận).`,
      },
      {
        heading: '2. Đấu Trường 1v1, Web Logs 48h & Linh Vực',
        content: '• Thứ tự: Lôi Quang Tốc > Final SPD; HP = (Lv × 1.000) + (Final DEF × 5) + Bonus HP; max 30 hiệp.\n• Sát thương trừ thẳng máu (bỏ qua khiên): Phản Đòn (reflect), Nổ Hộ Thuẫn, Độc/Thiêu Đốt (DoT), Hút Sinh Lực định kỳ và Mị Hoặc Phản Phệ trừ thẳng HP, bỏ qua Khiên. Phản Công khi né đòn vẫn đánh vào Khiên trước.\n• Discord hiện Hiệp 1/5/10/15/20 & Kết; bấm Xem Nhật Ký Trận Đấu để xem đủ từng hiệp trên Web (lưu 48h).\n• Linh Vực (/linhvuc) vào trận từ Hiệp 2 (Kiếm → Huyễn → Trận → Minh → Thánh → Kiếm); Thần Thoại có Đạo Áp Cấp 2.\n• /party & /linhmach: Mở 6 khung giờ vàng (08/12/18/20/21/22h), chia 6–56 LT/phút.',
      },
    ],
    fields: [
      {
        name: `${em('su_element_wheel')} Ngũ Hành & Tứ Đại Dị Tố`,
        value: `${elementEmoji('Kim')} Kim → ${elementEmoji('Mộc')} Mộc → ${elementEmoji('Thổ')} Thổ → ${elementEmoji('Thủy')} Thủy → ${elementEmoji('Hỏa')} Hỏa → Kim (\`+30%\` / \`-20%\`)\n• ${elementEmoji('Lôi')} **Lôi** khắc Thủy/Kim (\`+30%\`) • ${elementEmoji('Ám')} **Ám** <-> ${elementEmoji('Quang')} **Quang** (\`+25%\`) • ${elementEmoji('Hỗn Độn')} **Hỗn Độn/Hư Không** (\`+20%\` xuyên giáp, \`-15%\` ST nhận)`,
        inline: false,
      },
      {
        name: `${em('su_realm_star')} Linh Vực • Thần Thức • Thần Cảnh (Hiệp 2+)`,
        value: [
          `• **Khắc Vực:** ${domainElementEmoji('Kiếm Vực')} Kiếm → ${domainElementEmoji('Huyễn Vực')} Huyễn → ${domainElementEmoji('Trận Vực')} Trận → ${domainElementEmoji('Minh Vực')} Minh → ${domainElementEmoji('Thánh Vực')} Thánh → Kiếm (\`-1\` vs \`-2 Mạch\`/hiệp).`,
          `• **Cơ chế:** Khi 2 Vực giằng co, mỗi bên nhận Cường Hóa Buff Vực sân nhà (trừ *Xuyên Kháng Vực*); **Thần Thức** tăng Linh Mạch / Cường Hóa Buff Vực / Kháng Trừ Linh Mạch Khắc Vực, **Thần Cảnh** tăng Cường Hóa Debuff Vực. ${em('dao_ap_crest')} **Đạo Áp (\`1–3 hiệp\`)** kích hoạt khi Vực Thần Thoại phá Vực địch.`,
          `• **Buff SET (2 Tầng Không Cộng Dồn):** Full Hệ \`4/4\` (**+8%**) • \`5/5\` (**+12%** toàn chỉ số); Set Thần Thoại cùng hệ \`2/3/4/5\` (**+6/+12/+18/+25%** toàn chỉ số, \`5/5\` thêm **+10% Xuyên DEF** & **+1 Linh Mạch**).`,
        ].join('\n'),
        inline: false,
      },
      {
        name: `${em('su_crossed_swords')} Luật /battle, Web Logs & /linhmach`,
        value: [
          '• **1v1 (`/battle [@user]`):** PvP `15 trận/ngày`, PvE Tự Do `25 trận/ngày` (`+10 / -5 LT`) • Max **30 hiệp**, cooldown `5s`.',
          '• **Sát Thương Trừ Thẳng Máu (Bỏ Qua Khiên):** **Phản Đòn** *(reflect)*, **Nổ Hộ Thuẫn** *(vỡ khiên)*, **Độc / Thiêu Đốt (DoT)**, **Hút Sinh Lực Định Kỳ** và **Mị Hoặc Phản Phệ** đều trừ **thẳng HP, bỏ qua Khiên**. Riêng **Phản Công khi né đòn** vẫn đánh vào Khiên trước.',
          '• **Discord & Web Logs (48h):** Discord hiện mốc **Hiệp `1/5/10/15/20` & Kết**; bấm **Xem Nhật Ký Trận Đấu** để tua lại đủ từng hiệp & HP trên web *(lưu 48h)*.',
          `• ${em('vein_mine_sp')} **Linh Mạch (\`/party\`, \`/linhmach\`):** Mở lúc \`08/12/18/20/21/22h\`, spawn **3 mỏ/đợt** (**F→S+: \`8k → 135k\` Lực**, \`6–56 LT/phút\` +15% Kho Clan); Boss Hạng **A / S / S+** tung **Dư Chấn AoE 35%** quét cả hậu phương (nên đi Tổ Đội 3 người); thắng cộng \`+25%\` Mệt Mỏi (tối đa \`75%\`, giảm \`-10%/giờ\`).`,
        ].join('\n'),
        inline: false,
      },
    ],
    content: 'Đấu Trường /battle kết hợp Ngũ Hành, HAX & Linh Vực (Hiệp 2+). Discord hiện các hiệp mốc 1/5/10/15/20 & Kết; xem từng hiệp chi tiết trên Web Logs (lưu 48h).',
  },

  equipment: {
    id: 'equipment',
    title: `${em('su_crossed_swords')} Trang Bị Loadout (165 Pháp Bảo)`,
    icon: em('su_crossed_swords'),
    description: '57 Vũ Khí • 54 Bảo Ngọc • 54 Chiến Hồn, tỉ lệ rớt, Độc Nhất & Khắc Ấn D→S.',
    image_url: '',
    sections: [
      {
        heading: '1. 3 Slot Pháp Bảo (165 Món)',
        content: '• Vũ Khí (57): ATK, SPD, CRIT & HAX công • Bảo Ngọc (54): DEF, HP, Khiên & kháng • Chiến Hồn (54): Chỉ số tổng & HAX đa tầng.',
      },
      {
        heading: '2. Tỉ Lệ Rớt & Quy Tắc Sở Hữu',
        content: '• Phàm 60.5% • Linh 25% • Tiên 14% • Thần Thoại 0.5% (39 Độc Nhất toàn server + 56 Thần Thoại Tự Do, cân bằng <= 15%).\n• Quay trùng cộng dồn & giữ tư chất Khắc Ấn cao nhất; hỗ trợ tự bán qua /autosell, xem kho /phapbao, tháo /unequip & nâng D→S qua /enchant.',
      },
    ],
    fields: [
      {
        name: `${em('su_shield_def')} 3 Nhóm Pháp Bảo (165 Món)`,
        value: `• ${em('su_crossed_swords')} **Vũ Khí** (57): \`ATK • SPD • CRIT\`\n• ${em('su_linhthach')} **Bảo Ngọc** (54): \`DEF • HP • Khiên\`\n• ${em('su_thunder_hax')} **Chiến Hồn** (54): \`ATK • DEF • SPD • HAX\``,
        inline: true,
      },
      {
        name: `${em('su_gacha_dice')} Tỉ Lệ Rớt`,
        value: `• ${tierEmoji('common')} Phàm: **60.5%**\n• ${tierEmoji('rare')} Linh: **25%**\n• ${tierEmoji('epic')} Tiên: **14%**\n• ${tierEmoji('mythic')} Thần Thoại: **0.5%** *(39 Độc Nhất + 56 Tự Do)*`,
        inline: true,
      },
      {
        name: `${tierEmoji('supreme')} Quy Tắc, Khắc Ấn Mới & Pity 350`,
        value: '• **Khắc Ấn (`/enchant` D→S):** `D +0% • C +8% • B +18% • A +32% • S +50%` *(Pity +5%/lần trượt)*.\n• **Pity Thần Thoại 350:** Chạm 350 lượt `/roll` chắc chắn nổ Thần Thoại *(98% Thường / 2% Độc Nhất)*.\n• Quay trùng tự cộng dồn & giữ `max(D..S)` • Xem kho `/phapbao`, tự bán `/autosell`, tháo `/unequip`, phá `/dismantle`.',
        inline: false,
      },
    ],
    content: '165 Pháp Bảo chia 3 Slot (57 Vũ Khí / 54 Bảo Ngọc / 54 Chiến Hồn), hỗ trợ /phapbao, /equip, /unequip, /enchant & /autosell.',
  },

  pets: {
    id: 'pets',
    title: `${em('su_pet_paw')} Linh Thú Tiên Giới (90 Chiến Pet)`,
    icon: em('su_pet_paw'),
    description: '90 Linh Thú tiêu chuẩn (13 Phàm / 13 Linh / 14 Tiên / 50 Thần Thoại), công thức Lực Chiến & lệnh quản lý.',
    image_url: '',
    sections: [
      {
        heading: '1. Tổng Quan Linh Thú',
        content: '• Xuất trận /battle với Hệ Ngũ Hành, HAX & Khắc Ấn D→S riêng. Tân thủ nhận sẵn Hóa Thạch Nham Nham Thú.\n• Công thức Chiến Lực: (ATK × 3) + (DEF × 2) + (SPD × 2) + (Lv × 50) + Trang Bị.\n• Quản lý & nâng sao qua /linhthu, /pet, /enchant; quay trùng tự giữ Khắc Ấn cao nhất hoặc tự bán bằng /autosell.',
      },
    ],
    fields: [
      {
        name: `${em('su_wiki_scroll')} Công Thức & Lệnh Quản Lý`,
        value: '• **Pet khởi đầu:** `Hóa Thạch Nham Nham Thú` *(Phàm • 120 ATK / 180 DEF / 100 SPD)*.\n• **Tăng trưởng Lv/Sao:** `Lv.1→100` tăng **`+550%`**, `1★→10★` tăng **`+135%`** *(tổng **`7.85×`** chỉ số gốc)*.\n• **Chiến Lực:** `(ATK × 3) + (DEF × 2) + (SPD × 2) + (Lv × 50) + Trang Bị` • Nâng nhanh qua `/linhthu muc_dich:<cấp|sao>`.',
        inline: false,
      },
      {
        name: `${em('su_gacha_dice')} 4 Bậc Phẩm Cấp (90 Linh Thú)`,
        value: [
          `• ${tierEmoji('common')} **Phàm** *(13 loài)*: **60.5%** *(300 LT trong \`/shop\`)* • ${tierEmoji('rare')} **Linh** *(13 loài)*: **25%** *(900 LT trong \`/shop\`)*`,
          `• ${tierEmoji('epic')} **Tiên** *(14 loài)*: **14%** *(\`/roll\`)* • ${tierEmoji('mythic')} **Thần Thoại** *(50 loài: 10 Độc Nhất + 40 Tự Do)*: **0.5%** *(\`/roll\`)*`,
        ].join('\n'),
        inline: false,
      },
    ],
    content: '90 Linh Thú tiêu chuẩn chia 4 bậc (13 Phàm • 13 Linh • 14 Tiên • 50 Thần Thoại), quản lý qua /linhthu, /pet & /autosell.',
  },

  domains: {
    id: 'domains',
    title: `${em('su_realm_star')} Linh Vực • Thần Thức • Thần Cảnh (60 Món Công Khai)`,
    icon: em('su_realm_star'),
    description: '30 Linh Vực • 15 Thần Thức • 15 Thần Cảnh công khai, cơ chế Linh Mạch, Khắc Vực & Gacha /roll loai:domain.',
    image_url: '',
    sections: [
      {
        heading: '1. Hệ Thống 3 Slot Vực (Hiệp 2+)',
        content: '• Linh Vực (30 món: 15 Phàm/Linh/Tiên + 10 Thần Thoại Thường + 5 Độc Nhất): cung cấp Linh Mạch (3→7), Buff phe ta, Debuff phe địch, Xuyên Kháng Vực (56%/60%) & Áp Chế Buff Vực Địch (5%).\n• Thần Thức (15 món): cộng +1→+6 Linh Mạch tối đa, +5%→+19% Cường Hóa Buff Vực & 0%→70% Kháng Trừ Linh Mạch Khắc Vực.\n• Thần Cảnh (15 món): tăng +8%→+28% Cường Hóa Debuff Vực (khuếch đại toàn bộ debuff Vực) + kèm Debuff phụ riêng.',
      },
      {
        heading: '2. Ngũ Hành Khắc Vực & Lệnh Quản Lý',
        content: '• Vòng Khắc Vực 5 hệ: Kiếm Vực → Huyễn Vực → Trận Vực → Minh Vực → Thánh Vực → Kiếm Vực (bên khắc chỉ mất 1 Mạch/hiệp, bên bị khắc mất 2 Mạch/hiệp).\n• Sở hữu qua /roll loai:domain (50 LT/lượt, Pity 350 riêng cho Vực), trang bị qua /linhvuc hanh_dong:equip hoặc thu hồi /linhvuc hanh_dong:dismantle.',
      },
    ],
    fields: [
      {
        name: `${em('su_realm_star')} 3 Thành Phần Bộ Vực (60 Món Công Khai)`,
        value: [
          '• **Linh Vực (30):** `5 Phàm (3 Mạch)` • `5 Linh (4 Mạch)` • `5 Tiên (5 Mạch)` • `10 Thần Thoại (6 Mạch, Xuyên Kháng Vực 56%)` • `5 Độc Nhất (7 Mạch, Xuyên Kháng Vực 60%, Áp Chế 5% Buff Vực Địch)`.',
          '• **Thần Thức (15):** `3 Phàm (+1)` • `3 Linh (+2)` • `3 Tiên (+3)` • `4 Thần Thoại (+4)` • `2 Độc Nhất (+5/+6 Mạch)` • Cộng **Cường Hóa Buff Vực** (`+5%→+19%`) & **Kháng Trừ Linh Mạch Khắc Vực** (`0%→70%`).',
          '• **Thần Cảnh (15):** `3 Phàm (+8%)` • `3 Linh (+12%)` • `3 Tiên (+18%)` • `4 Thần Thoại (+25%)` • `2 Độc Nhất (+28%)` **Cường Hóa Debuff Vực** + Debuff phụ.',
        ].join('\n'),
        inline: false,
      },
      {
        name: `${em('dao_ap_crest')} Khắc Vực, Đạo Áp & Gacha /roll loai:domain`,
        value: [
          `• **Khắc Vực:** ${domainElementEmoji('Kiếm Vực')} Kiếm → ${domainElementEmoji('Huyễn Vực')} Huyễn → ${domainElementEmoji('Trận Vực')} Trận → ${domainElementEmoji('Minh Vực')} Minh → ${domainElementEmoji('Thánh Vực')} Thánh → Kiếm (\`-1\` vs \`-2 Mạch\`/hiệp).`,
          '• **Gacha & Quản Lý:** `/roll loai:domain` *(Phàm 60.5% • Linh 25% • Tiên 14% • Thần Thoại 0.5%, Pity 350)* • Trang bị & xem kho qua `/linhvuc` • Dùng menu chọn từng món để xem ảnh & chủ sở hữu Độc Nhất.',
        ].join('\n'),
        inline: false,
      },
    ],
    content: '60 món công khai (30 Linh Vực, 15 Thần Thức, 15 Thần Cảnh), kích hoạt từ Hiệp 2 trong /battle.',
  },

  roles: {
    id: 'roles',
    title: `${em('su_medal_role')} Role Quyền Năng & Quyền Discord (40 Role + 8 Mốc Cấp)`,
    icon: em('su_medal_role'),
    description: 'Chi tiết quyền Discord & Buff Tu Tiên của 40 Role Quyền Năng (/shop, /roll) và 8 Level Roles. Dùng /info <tên role> để xem đầy đủ.',
    image_url: '',
    sections: [
      {
        heading: '1. Hệ Thống 40 Role Quyền Năng & 8 Level Roles',
        content: '• 5 Thần Thoại (0.5%) + 6 Tiên Phẩm (14%) + 8 Linh Phẩm (25%) + 21 Phàm Phẩm (Shop & 60.5%).\n• Mở tối đa 5 Slot Role theo Cảnh Giới (/roles, /equip, /unequip). Tra từng Role bằng /info <tên role>.',
      },
    ],
    fields: [
      {
        name: `${tierEmoji('mythic')} 5 Role Thần Thoại (0.5% /roll — Full Quyền + Siêu Buff)`,
        value: [
          '• **Cửu Vĩ Tối Thượng Thần Hồ:** Full Voice/Chat/Thread/Nick/TTS/Sound + Ưu tiên hộ thể (`+70% EXP/LT, +25% Pet`)',
          '• **SuMi Đệ Nhất Khách Tôn:** Full Voice (Move/Mute/Deafen/Ưu tiên/HD/Sound), Full Chat/Thread/Nick/TTS (`+60% EXP/LT, +20% Pet`)',
          '• **Vạn Cổ Chí Tôn:** Voice (Move/Mute/Deafen/Ưu tiên/HD), Chat/Thread/Nick/Emoji+Sticker ngoại (`+50% EXP/LT, +18% Pet`)',
          '• **Sáng Thế Thần Quân:** Voice (Move/Ưu tiên/HD), Ghim/Slowmode/Thread/Nick/Emoji+Sticker (`x2.5 Daily LT, -15% Shop`)',
          '• **Cửu Vĩ Yêu Hậu:** Voice (Move/Mute/HD/Sound ngoại), Ghim/Slowmode/Thread/Nick/Emoji+Sticker (`+80% EXP, +15% Pet`)',
        ].join('\n'),
        inline: false,
      },
      {
        name: `${tierEmoji('epic')} 6 Role Tiên Phẩm (14% /roll — 3–4 Chức Năng)`,
        value: [
          '• **Cửu Tiêu Phong Vương:** Move/Mute Voice, Miễn Slowmode (`+20% EXP`) • **Thái Hư Chân Quân:** Quản lý Nick, Ghim, Thread Kín (`+20% LT`)',
          '• **Vạn Bảo Tài Thần:** Nhúng Link/Ảnh, Emoji & Sticker Ngoại (`+35% LT, -10% Shop/Roll`) • **Bát Hoang Chiến Thần:** Stream HD, Ghim, Miễn Slowmode (`+20% EXP, +15% Pet`)',
          '• **Hồng Trần Tiên Lữ:** Stream HD, Sound/Emoji/Sticker Ngoại (`+25% EXP, +10% Pet`) • **Tinh Hà Pháp Vương:** Move/Mute/Deafen Voice, Ghim (`+25% EXP`)',
        ].join('\n'),
        inline: false,
      },
      {
        name: `${tierEmoji('rare')} 8 Role Linh Phẩm (25% /roll — 2–3 Chức Năng)`,
        value: [
          '• **Song Tuyệt Kiếm Khách:** Ghim Tin, Miễn Slowmode • **Huyễn Ảnh Linh Tôn:** Đổi Nick, Emoji/Sticker Ngoại (`+10% EXP`)',
          '• **Lôi Vũ Hộ Pháp:** Move & Ưu Tiên Voice • **Hàn Ngọc Tiên Tử:** Stream HD, Sound/Âm Ngoại (`+10% LT`)',
          '• **Mật Các Trưởng Lão:** Thread Mở/Kín, Đọc Kênh Ẩn (`+12% EXP`) • **Kim Tiền Đạo Nhân:** Biểu Cảm & Emoji Ngoại (`+25% LT, -5% Shop`)',
          '• **Chiến Hồn Tiên Phong:** Link/Ảnh, Miễn Slowmode (`+8% Pet`) • **Thiên Âm Nhạc Sư:** Ưu Tiên Voice, Sound/Âm Ngoại (`+12% EXP`)',
        ].join('\n'),
        inline: false,
      },
      {
        name: `${tierEmoji('common')} 21 Role Phàm Phẩm (/shop & 60.5% /roll — Chuyên Biệt)`,
        value: [
          '• **Voice (8):** `Linh Âm Hồ Ca` *(Ưu tiên+Âm ngoại)* • `Phong Thanh Hộ Pháp` *(Move)* • `Lôi Âm Tôn Giả` *(Ưu tiên nói)* • `Tịch Tĩnh Tán Nhân` *(Mute)* • `Bế Tức Chân Nhân` *(Deafen)* • `Huyễn Âm Tiên Cô` *(Soundboard)* • `Cửu Châu Diễn Âm` *(Âm ngoại)* • `Tiêu Dao Khách` *(Stream HD)*',
          '• **Chat/Nick/Thread (11):** `Huyễn Diện` *(Đổi Nick)* • `Định Danh` *(Quản lý Nick)* • `Thần Hành` *(Miễn Slowmode)* • `Họa Đồ` *(Link/Ảnh)* • `Vạn Tượng` *(Emoji ngoại)* • `Thần Phù` *(Sticker ngoại)* • `Khai Sơn` *(Thread mở)* • `Mật Tàng` *(Thread kín)* • `Trấn Thư` *(Ghim)* • `Trảm Phong` *(TTS)* • `Thần Thông` *(Đọc lịch sử)*',
          '• **Thuần Buff (2):** `Linh Hồn Tu Luyện` (`+15% EXP`) • `Tài Vận Hanh Thông` (`+20% Daily LT`)',
        ].join('\n'),
        inline: false,
      },
      {
        name: `${em('su_pin_sigil')} Quy Tắc Slot, Level Roles & Tra Cứu`,
        value: '• Mở **1→5 Slot** theo Cảnh Giới (`/roles`, `/equip`, `/unequip`). Gacha Role: `40% 7d • 30% 30d • 18% 60d • 10% 90d • 2% Vĩnh Viễn`. Giảm giá cộng dồn tối đa `-25% Shop / -20% Roll`. **8 Level Roles** tự mở theo cấp (xem mục Cảnh Giới) & tra từng Role bằng **`/info <tên role>`**.',
        inline: false,
      },
    ],
    content: '40 Role Quyền Năng (5 Thần Thoại, 6 Tiên Phẩm, 8 Linh Phẩm, 21 Phàm Phẩm) & 8 Level Roles kèm đầy đủ quyền Discord và Buff Tu Tiên.',
  },

  economy: {
    id: 'economy',
    title: `${em('su_linhthach')} Kinh Tế, Nhiệm Vụ, Tháp 500 & Nông Trại`,
    icon: em('su_linhthach'),
    description: '/daily, /job, /roll, /autosell, /shop, /nhiemvu (Tháp 500 tầng +15% LT), /farm, Minigame, /marry & /giatoc.',
    image_url: '',
    sections: [
      {
        heading: '1. Kiếm LT, Gacha, Đổ Thạch & Cửa Hàng',
        content: '• /daily (40–60 LT + Streak 7d) • /job (6 nghề, 8 ca/ngày, +35–75 LT) • /doiqua (1.000 EXP → 10 LT) • Lên cấp +50..+400 LT.\n• /roll (50 LT/lượt, 450/10, Pity Thần Thoại 350) hỗ trợ /autosell.\n• /dothach (Phường Đổ Thạch — tách biệt với /roll, không Pity 350): 4 phân khúc sạp đá thô (20 loài Nguyên Thạch) kèm manh mối mơ hồ, cắt đá săn Linh Thạch, Đá Khắc Ấn, Tinh Thạch & Tối Thượng Cực Phẩm (chọn Thần Thoại không Độc Nhất).\n• /gieoque (1 lần/ngày UTC+7): 6 bậc Khí Vận (Đại Hung → Đại Cát) cộng/trừ nhẹ % EXP, % LT & % Luck (hỗ trợ Cầu An Giải Hạn 250 LT khi gặp Hung/Đại Hung).\n• /shop (7 quầy + Shop Ngày giảm 15–40%): Mở bán thêm 3 Lọ Luck Potion (+20%/+40%/+60% Luck theo lượt cho cả /roll & /dothach, cộng dồn với /gieoque; uống qua /equip).',
      },
      {
        heading: '2. Nhiệm Vụ & Hợp Đồng Tuần, Tháp 500 Tầng, Nông Trại, Lò Luyện Đan & Cộng Đồng',
        content: '• /nhiemvu: Giao diện tinh gọn gộp Nhiệm Vụ Hàng Ngày + Hợp Đồng Tuần kèm bảng Tháp 500 Tầng (cooldown 6s/lượt).\n• /luyendan (Lò Luyện Đan): Tối đa 6 mẻ/ngày trên tối đa 2 Lò song song (Lò #2 tự mở ở Lv.45 hoặc 2.500 LT), nâng cấp Lò Lv.1–5 (+LT%, giảm giờ, ân hạn 20–60p, tăng tỉ lệ Thượng Phẩm ×1.25 / Đan Vân ×1.50). Hỗ trợ công thức Tinh Hoa dùng 28–56 Linh Quả từ /farm. Quá ân hạn bị cháy (30 LT) + nổ khóa lò 4h (Sửa nhanh 300 LT) & bot tự DM nhắc chín + trước nổ 10p.\n• /farm 8 ô (4 Linh Điền + 4 Linh Các, giá hạt/trứng 88–825 LT) & /exchange • /inv hỗ trợ 3 Loadout tự động lưu (Bộ 1 / Bộ 2 / Bộ 3) • /top loai:chat|voice trao 500/400/300 LT mỗi ngày lúc 00:00 UTC+7 • Minigame (10–10.000 LT) • /marry & /giatoc.',
      },
    ],
    fields: [
      {
        name: `${em('su_linhthach')} Linh Thạch, /job, Gacha, Đổ Thạch & Gieo Quẻ`,
        value: [
          '• `/daily` • `/job` *(6 nghề, 8 ca/ngày)* • `/doiqua` (`1.000 EXP → 10 LT`) • Đọc xác nhận `/updates` v1.6 nhận **+1.000 LT**.',
          '• `/roll` (`50 LT/lượt`, `450/10`, Pity **350**) kèm **`/autosell`** • **`/dothach`** *(20 Nguyên Thạch, không Pity, săn Tối Thượng)* • **`/gieoque`** *(6 bậc Khí Vận/ngày)*.',
          '• `/shop` *(7 quầy + Shop Ngày)*: Đá Khắc Ấn (`150 LT`, 5/ngày), Thẻ Reset Tháp (`200 LT`, 5/ngày, max 15) & **3 Lọ Luck Potion** *(Tiểu Vận `+20%` • Thiên Cơ `+40%` • Hồng Mông `+60%` cho `/roll` & `/dothach`)*.',
        ].join('\n'),
        inline: false,
      },
      {
        name: `${em('su_tower_boss')} Nhiệm Vụ Ngày, Tháp 500 Tầng (+15% LT) & Top Ngày`,
        value: [
          '• **5 Nhiệm Vụ Ngày (`/nhiemvu`):** 2 cố định + 3 xoay vòng *(5/5: **+130 LT** + quà)* & 3 Hợp Đồng Tuần.',
          '• **Tháp 500 Tầng (`1k → 125k` Lực):** Thưởng Linh Thạch mỗi tầng & mốc Milestone **tăng +15%**, NPC dùng **Linh Vực từ F70+**.',
          '• **Top Chat & Voice Ngày (`00:00`):** `/top loai:chat` & `/top loai:voice` thưởng **500 / 400 / 300 LT** mỗi ngày.',
        ].join('\n'),
        inline: false,
      },
      {
        name: `${em('su_sprout')} Nông Trại, Giải Trí, Tiên Lữ & Gia Tộc`,
        value: [
          '• **`/farm` & `/exchange`:** Tối đa **8 ô** (`4 Linh Điền + 4 Linh Các`, `6/12/24h`, mở ô #5–#8 tại `/exchange`), Bot **tự nhắn DM nhắc tới giờ tưới & cảnh báo sắp héo (1h / 30p / 15p)**.',
          '• **`/luyendan` (Lò Luyện Đan):** Tối đa `6 mẻ/ngày` trên `2 Lò` song song *(Lò #2 mở tại Lv.45 hoặc 2.500 LT)*, nâng Lò `Lv.1–5` & kết hợp `28–56 Linh Quả` săn `Thượng Phẩm (×1.25)` / `Đan Vân (×1.50)` kèm DM nhắc chín & trước nổ 10p.',
          '• **`/inv` (3 Loadout Tự Lưu):** Chuyển nhanh `Bộ 1 / Bộ 2 / Bộ 3` (Linh Thú + Pháp Bảo + Linh Vực/Thần Thức/Thần Cảnh); mọi `/equip`, `/pet`, `/linhvuc` tự lưu vào bộ đang chọn.',
          '• **Minigame (`10–10.000 LT`):** `/coinflip` • `/blackjack` • `/slots` • `/crash` *(Ngự Kiếm)*.',
          `• ${em('ring_mythic')} **\`/marry\`** & ${em('su_clan_castle')} **\`/giatoc\`:** 4 cấp Nhẫn (+5%..+20% EXP & Lực + Streak) • Gia Tộc Lv.1–10 (+2%..+20% EXP/LT, Clan Wars 24H).`,
        ].join('\n'),
        inline: false,
      },
    ],
    content: 'Kinh tế v1.5: +2.000 LT /updates, Tháp 500 tầng (+15% LT), Top Chat/Voice ngày, Pity 350, /shop tự Equip 0 LT, /farm & Minigame.',
  },

  explorer: {
    id: 'explorer',
    title: `${em('explorer_world_map_v14')} Khám Phá Đại Lục & Thuận Hệ Địa Hình (/explorer)`,
    icon: em('explorer_world_map_v14'),
    description: '12 địa danh cân bằng mới (3.5k → 112k Lực), +5% LT cơ bản (210–315 LT/h), Thuận Hệ Địa Hình (+6% Sống / +10% LT) & nhặt 60% đồ rơi.',
    image_url: `${PUBLIC_BASE_URL}/api/explorer/map.webp?v=1.4`,
    sections: [
      {
        heading: '1. 12 Địa Danh Đại Lục Cửu Châu (Kèm Hệ Địa Hình Thuận Lợi)',
        content: V14_EXPLORER_MAPS.map(
          (m) => `• #${m.order} ${m.name} (${m.difficulty} • ${(m.recommended_power / 1000).toLocaleString('vi-VN')}k • Hệ ${(m.favored_elements || []).join('/')} • ×${m.reward_multiplier})`,
        ).join('\n'),
      },
      {
        heading: '2. Thuận Hệ Địa Hình, Cơ Chế Sinh Tử & Phần Thưởng',
        content: '• Chọn 1 Pet + 3 Pháp Bảo + 1 Linh Vực đi mốc 2/3/6/12h; thưởng cơ bản 210–315 LT/giờ × hệ số (+5% mới) + 0.5% Đá Tuyệt Ấn Thạch + 0.01% Vũ Khí Thần Thoại.\n• Thuận Hệ Địa Hình: Nếu Linh Thú hoặc Linh Vực mang đi có Hệ trùng với Hệ thuận lợi của Map, tự động nhận thêm +6% Tỉ Lệ Sống Sót và +10% Linh Thạch thu hoạch!\n• Lực >= Map sống 90%–100%; yếu hơn map rủi ro tăng dần về 100% (thua từ 2× lực = 0% sống sót). Pet Độc Nhất trọng thương hồi sinh bằng Cửu Chuyển Hoàn Hồn Lộ, Pháp Bảo thường rơi tại map chờ người sau nhặt (60%).',
      },
    ],
    fields: [
      {
        name: `${em('explorer_world_map_v14')} 12 Địa Danh (3.5k → 112k • Hệ Thuận Lợi)`,
        value: V14_EXPLORER_MAPS.map(
          (m) => `• **#${m.order} ${m.name}** *(${m.difficulty} • ${(m.recommended_power / 1000).toLocaleString('vi-VN')}k • Hệ **${(m.favored_elements || []).join('/')}** • ×${m.reward_multiplier})*`,
        ).join('\n'),
        inline: false,
      },
      {
        name: `${em('su_sparkle')} Thuận Hệ Địa Hình (+6% Sống • +10% LT) & Quà (+5% LT)`,
        value: [
          '• **Thuận Hệ Địa Hình:** Khi **Pet** hoặc **Linh Vực** xuất hành khớp với **Hệ của Map** *(ví dụ Map #1 Hệ Mộc/Thổ)*, đội hình được cộng ngay **+6% Tỉ Lệ Sống Sót** và **+10% Linh Thạch**!',
          '• **Thưởng (`2/3/6/12h`):** **`210–315 LT/giờ × hệ số`** *(+5%)* + **0.5%** Đá Khắc Ấn Tuyệt Đối *(100% D→S)* + **0.01%** Vũ Khí Thần Thoại.',
          '• **Sinh tử & Nhặt đồ:** Lực `>=` Map sống **90%→100%**; `<` Map rủi ro tử nạn tăng dần *(thua từ 2× lực = **0%**, Đan không cứu được)*. Pháp Bảo thường rơi tại map chờ người đi sau nhặt **60%**.',
        ].join('\n'),
        inline: false,
      },
      {
        name: `${em('food_survival_pill')} Thức Ăn & Hồi Sinh (/shop)`,
        value: `${em('food_survival_pill')} **Hộ Mệnh Đan** *(180 LT, +8% sống)* • ${em('food_yield_tea')} **Tụ Bảo Trà** *(220 LT, +18% LT)* • ${em('food_speed_fruit')} **Ngự Phong Quả** *(250 LT, -25% giờ)* • ${em('explorer_revive_elixir')} **Hoàn Hồn Lộ** *(2.500 LT, cứu Pet Độc Nhất)*`,
        inline: false,
      },
    ],
    content: 'Khám Phá /explorer v1.5 qua 12 địa danh (3.5k → 112k Lực), +5% LT (210–315 LT/h), Thuận Hệ Địa Hình (+6% sống / +10% LT) & nhặt 60% bảo vật rơi.',
  },

  glossary: {
    id: 'glossary',
    title: `${em('su_wiki_scroll')} Từ Điển Thuật Ngữ Chiến Đấu (4 Trang)`,
    icon: em('su_wiki_scroll'),
    description: 'Chuẩn hóa 1 thuật ngữ = 1 hiệu ứng duy nhất trên toàn bộ Pháp Bảo, Linh Thú, Linh Vực, Thần Thức & Thần Cảnh.',
    image_url: '',
    pages: [
      {
        page: 1,
        subtitle: 'Trang 1/4 — Chỉ Số, Giáp, Xuyên DEF & Hồi Phục',
        fields: [
          {
            name: `${em('su_crossed_swords')} Xuyên DEF vs Giảm DEF (Không Trùng Nhau)`,
            value: [
              '• **`Xuyên X% DEF`** *(`defPiercePct`, trần `90%`)*: Chỉ số **tự thân của người đánh** khi ra đòn, không gắn debuff lên địch. Tính ở bước kết toán sát thương.',
              '• **`Giảm X% DEF`** *(`defDebuffPct` / `defReductionPct`, trần `75%`)*: **Debuff gắn trực tiếp lên kẻ địch** từ kỹ năng hoặc Linh Vực/Thần Cảnh.',
              '• **Công thức tính Giáp thực tế:** `DEF hiệu dụng = DEF × (1 - Giảm DEF) × (1 - Xuyên DEF)` *(nhân `Giảm DEF` trước, rồi mới `Xuyên DEF`)*.',
            ].join('\n'),
            inline: false,
          },
          {
            name: `${em('su_stats_chart')} Sát Thương Chuẩn, Hút Máu & Giới Hạn HP`,
            value: [
              '• **Sát Thương Chuẩn (Bỏ Qua DEF & Khiên):** Các hiệu ứng **Đốt HP / Trúng Độc (DoT)**, **Phản Đòn**, **Nổ Hộ Thuẫn**, **Hút Sinh Lực Định Kỳ** và **Mị Hoặc Phản Phệ** trừ **thẳng vào HP** mà không qua Giáp hay Khiên.',
              '• **`Giảm X% Hồi Máu`** *(`healReductionPct`, trần `90%`)*: Giảm tương ứng lượng HP hồi từ kỹ năng hồi máu, Hút Máu và tái sinh *(không giảm Khiên)*.',
              '• **`Cắt X% Trần HP Tối Đa`** *(`maxHpCutPct`, trần `48%`)*: Hạ trực tiếp trần HP tối đa của mục tiêu trong suốt trận *(vào từ Linh Vực / Thần Cảnh / Đạo Áp)*.',
            ].join('\n'),
            inline: false,
          },
        ],
      },
      {
        page: 2,
        subtitle: 'Trang 2/4 — Hệ Thống Khiên & 5 Cơ Chế Khắc Chế Khiên',
        fields: [
          {
            name: `${em('su_shield_def')} Tạo Khiên & Tăng Độ Dày Khiên`,
            value: [
              '• **Khiên Chắn (Shield):** Thanh giáp ảo hấp thụ sát thương thường/bạo kích trước khi trừ vào HP thật.',
              '• **`Tăng +X% Độ Dày Khiên`** *(`shieldStrengthBonusPct`, trần `+55%`)*: Khuếch đại mọi lượng Khiên phe ta tạo ra từ Pet, Pháp Bảo hoặc Linh Vực.',
            ].join('\n'),
            inline: false,
          },
          {
            name: `${em('su_thunder_hax')} 5 Cơ Chế Khắc Chế Khiên Riêng Biệt`,
            value: [
              '• **`Xuyên X% Khiên`** *(`shieldPiercePct`)*: Một phần sát thương đánh xuyên thẳng vào HP thật, phần còn lại vẫn đánh vào Khiên.',
              '• **`Phá Khiên (×2 / ×2.2 ST lên Khiên)`** *(`shieldDamageMult`)*: Gây gấp `2×` *(hoặc `2.2×`)* sát thương trực tiếp lên thanh Khiên địch để đập vỡ cực nhanh.',
              '• **`Bào Mòn X% Khiên/hiệp`** *(`shieldDecayPct`, trần `58%`)*: Cuối mỗi hiệp tự động gọt bớt `%` Khiên hiện có của địch.',
              '• **`Giảm X% Khiên Tạo Mới`** *(`enemyShieldCapReductionPct`, trần `62%`)*: Ép mọi Khiên mới địch dựng lên bị cắt giảm theo `%` này.',
              '• **Cấm / Cướp Khiên:** Chặn hoàn toàn việc tạo Khiên mới hoặc hút trực tiếp Khiên địch chuyển sang cho bản thân.',
            ].join('\n'),
            inline: false,
          },
        ],
      },
      {
        page: 3,
        subtitle: 'Trang 3/4 — Linh Vực, Thần Thức, Thần Cảnh & Đạo Áp',
        fields: [
          {
            name: `${em('su_realm_star')} Linh Mạch, Khắc Vực & Kháng Trừ Linh Mạch`,
            value: [
              '• **Linh Mạch & Khắc Vực:** Linh Vực vào sân từ Hiệp 2. Nếu 2 bên cùng bật Vực sẽ trừ Linh Mạch mỗi hiệp; bên bị Khắc Vực mất **2 Mạch/hiệp** thay vì **1 Mạch/hiệp**.',
              '• **`Kháng Trừ Linh Mạch Khắc Vực`** *(`clash_resist_chance`)*: Xác suất **`%` giữ nguyên không bị trừ thêm Linh Mạch** khi bị Vực địch khắc hệ *(không phải kháng sát thương nguyên tố)*.',
              '• **`Cường Hóa Buff Vực`** *(`buff_boost_pct`)*: Khuếch đại các chỉ số buff cho phe mình từ Linh Vực.',
              '• **`Cường Hóa Debuff Vực`** *(`debuff_boost_pct`)*: Khuếch đại **toàn bộ Debuff của Linh Vực lẫn Debuff phụ của Thần Cảnh** lên phe địch.',
            ].join('\n'),
            inline: false,
          },
          {
            name: `${em('dao_ap_crest')} Xuyên Kháng Vực, Áp Chế & Đạo Áp`,
            value: [
              '• **`Xuyên Kháng Vực`** *(`56% / 60% / 100%`)*: Khi 2 Linh Vực đang giằng co, bình thường Debuff Vực bị chặn; chỉ số này cho phép **ép một phần (`56%/60%`) hoặc toàn bộ (`100%`) Debuff Vực xuyên thẳng vào địch**.',
              '• **`Áp Chế Buff Vực Địch`** *(`5% / 100%`)*: Trừ trực tiếp hiệu lực Buff Vực phe địch đang nhận.',
              '• **`Đạo Áp` (`1–3 hiệp`):** Hiệu ứng đặc quyền khi Linh Vực Thần Thoại phá vỡ Vực địch (hoặc địch không có Vực), áp thêm `-DEF`, `Bào Mòn Khiên`, `Giảm Hồi Máu`, `Cắt Trần HP`.',
            ].join('\n'),
            inline: false,
          },
        ],
      },
      {
        page: 4,
        subtitle: 'Trang 4/4 — Khống Chế (CC), HAX, Kháng & Buff SET',
        fields: [
          {
            name: `${em('su_sparkle')} Khống Chế (CC), Miễn Nhiễm & Giảm Tỉ Lệ HAX`,
            value: [
              '• **`Kháng X% Khống Chế`** *(`ccResistPct`, trần `92%`)*: Xác suất kháng các hiệu ứng mất lượt *(Choáng, Đóng Băng, Ngủ, Mị Hoặc, Tê Liệt)*.',
              '• **`Miễn Nhiễm 100%`** *(`ccImmuneAll`)*: Miễn nhiễm tuyệt đối mọi trạng thái Khống Chế *(hoặc nhóm cụ thể như Độc/Đốt)*.',
              '• **`Giảm X% Tỉ Lệ HAX`** *(`haxFailPct`, trần `42%`)*: Làm giảm xác suất kích hoạt nội tại HAX chủ động của đối thủ.',
            ].join('\n'),
            inline: false,
          },
          {
            name: `${em('explorer_world_map_v14')} Buff SET & Thuận Hệ Địa Hình`,
            value: [
              '• **Buff SET 2 Tầng (Không Cộng Dồn):** Đếm theo số món cùng Hệ trong đội hình `(1 Pet + 3 Pháp Bảo + 1 Linh Vực)`: Full Hệ Thường `4/4` (**+8%**), `5/5` (**+12%**); Set Thần Thoại `2/3/4/5` (**+6/+12/+18/+25%** toàn chỉ số, mốc `5/5` thêm **+10% Xuyên DEF** & **+1 Linh Mạch**).',
              '• **Thuận Hệ Địa Hình (`/explorer`):** Pet hoặc Linh Vực khớp Hệ của Map được cộng **`+6%` Tỉ Lệ Sống Sót** & **`+10%` Linh Thạch**.',
            ].join('\n'),
            inline: false,
          },
        ],
      },
    ],
    sections: [
      {
        heading: 'Từ Điển Thuật Ngữ Chiến Đấu SuMi Family (4 Trang)',
        content: 'Trang 1: Chỉ Số, Xuyên DEF vs Giảm DEF, ST Chuẩn, Giảm Hồi Máu, Cắt Trần HP. Trang 2: Tăng Độ Dày Khiên & 5 cơ chế Khắc Chế Khiên. Trang 3: Linh Mạch, Kháng Trừ Linh Mạch Khắc Vực, Cường Hóa Buff/Debuff Vực, Xuyên Kháng Vực, Áp Chế & Đạo Áp. Trang 4: Kháng Khống Chế, Miễn Nhiễm 100%, Giảm Tỉ Lệ HAX, Buff SET & Thuận Hệ Địa Hình.',
      },
    ],
    content: 'Từ điển chuẩn hóa thuật ngữ chiến đấu SuMi Family (4 trang): 1 thuật ngữ = 1 hiệu ứng duy nhất.',
  },
};

/**
 * Tra cứu danh mục Wiki (tất cả 10 chuyên mục hoặc lọc 1 chuyên mục duy nhất, hỗ trợ phân trang)
 */
export function getWikiData(categoryId = null, page = 1) {
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

  const catObj = WIKI_CATEGORIES[resolvedId];
  const colorMap = {
    overview: '#ec4899',
    realms: '#a855f7',
    battle: '#f43f5e',
    equipment: '#f59e0b',
    pets: '#ec4899',
    domains: '#a855f7',
    roles: '#a855f7',
    economy: '#10b981',
    explorer: '#10b981',
    glossary: '#38bdf8',
  };

  let requestedPage = Number(page);
  if ((!Number.isFinite(requestedPage) || requestedPage < 1) && /^glossary_(\d+)$/.test(raw)) {
    requestedPage = Number(raw.split('_')[1]);
  }
  const hasPages = Array.isArray(catObj.pages) && catObj.pages.length > 0;
  const totalPages = hasPages ? catObj.pages.length : 1;
  const currentPage = hasPages
    ? Math.min(Math.max(1, Math.floor(requestedPage || 1)), totalPages)
    : 1;
  const activePageObj = hasPages ? catObj.pages[currentPage - 1] : null;
  const activeFields = activePageObj ? activePageObj.fields : catObj.fields;
  const activeSubtitle = activePageObj?.subtitle || catObj.description || '';

  const fieldLines = Array.isArray(activeFields) && activeFields.length > 0
    ? activeFields.map((f) => `**${f.name}**\n${f.value}`).join('\n\n')
    : '';
  let flatDesc = [activeSubtitle ? `*${activeSubtitle}*` : '', fieldLines].filter(Boolean).join('\n\n');
  if (flatDesc.length > 3950) flatDesc = `${flatDesc.slice(0, 3940)}\n…`;

  return {
    success: true,
    ...WIKI_METADATA,
    category: resolvedId,
    page: currentPage,
    total_pages: totalPages,
    pages: hasPages ? catObj.pages : undefined,
    data: catObj,
    embed_flat: {
      title: hasPages ? `${catObj.title} — Trang ${currentPage}/${totalPages}` : catObj.title,
      description: flatDesc,
      image_url: catObj.image_url || '',
      color: colorMap[resolvedId] || '#ec4899',
    },
  };
}

/**
 * Trả về danh mục phân nhóm phục vụ Dropdown Trang Bị (3 nhóm), Linh Thú (4 phẩm cấp — 90 Linh Thú tiêu chuẩn) & Linh Vực (60 món công khai)
 */
export function getWikiCatalogSummary() {
  const standardPets = PET_CATALOG.filter((p) => !p.is_exclusive_fuyumi);
  const publicDomains = V13_DOMAINS.filter((d) => !d.is_exclusive_fuyumi);
  const publicSenses = V13_DIVINE_SENSES.filter((s) => !s.is_exclusive_fuyumi);
  const publicRealms = V13_DIVINE_REALMS.filter((r) => !r.is_exclusive_fuyumi);
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
    domains: {
      domain: publicDomains.map((d) => ({ id: d.domain_id, name: d.name, rarity: d.rarity, rarity_key: d.rarity_key, element: d.element, is_unique: d.is_unique })),
      sense: publicSenses.map((s) => ({ id: s.sense_id, name: s.name, rarity: s.rarity, rarity_key: s.rarity_key, is_unique: s.is_unique })),
      realm: publicRealms.map((r) => ({ id: r.realm_id, name: r.name, rarity: r.rarity, rarity_key: r.rarity_key, is_unique: r.is_unique })),
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

  const imageUrl = `${PUBLIC_BASE_URL}/api/wiki/item/${item.item_id}.webp?v=1.4.7`;

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
      footer: '',
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

  const imageUrl = `${PUBLIC_BASE_URL}/api/wiki/pet/${pet.pet_type}.webp?v=1.4.7`;

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
      footer: '',
    },
  };
}

/**
 * Truy vấn chủ sở hữu thực tế từ Supabase cho 9 Linh Vực / Thần Thức / Thần Cảnh Độc Nhất công khai
 */
async function resolveMythicDomainOwner(entityKind, entityId) {
  if (!supabase) return null;
  try {
    const { data: ownership } = await supabase
      .from('user_domains')
      .select('user_id')
      .eq('entity_kind', entityKind)
      .eq('entity_id', entityId)
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
    console.warn(`[WikiService] Failed to query mythic domain owner for ${entityKind}/${entityId}:`, err.message);
    return null;
  }
}

/**
 * Tra cứu chi tiết 1 Linh Vực / Thần Thức / Thần Cảnh (ẩn 3 món độc quyền Fuyumi khỏi /wiki)
 */
export async function getWikiDomainDetail(entityId) {
  if (!entityId || typeof entityId !== 'string') {
    return { success: false, error: 'Domain not found', message: 'Thiếu mã Linh Vực / Thần Thức / Thần Cảnh.' };
  }

  const cleanId = entityId.trim().toLowerCase().replace(/\.(png|webp)$/i, '');
  let entityKind = null;
  let item = V13_DOMAINS.find((d) => d.domain_id === cleanId);
  if (item) {
    entityKind = 'domain';
  } else {
    item = V13_DIVINE_SENSES.find((s) => s.sense_id === cleanId);
    if (item) {
      entityKind = 'sense';
    } else {
      item = V13_DIVINE_REALMS.find((r) => r.realm_id === cleanId);
      if (item) entityKind = 'realm';
    }
  }

  if (!item || item.is_exclusive_fuyumi) {
    return {
      success: false,
      error: 'Domain not found',
      message: `Linh Vực '${entityId}' không tồn tại.`,
    };
  }

  const tier = RARITY_TIERS[item.rarity_key] || RARITY_TIERS.common;
  const currentOwner = item.is_unique ? await resolveMythicDomainOwner(entityKind, cleanId) : null;
  const ownerLine = item.is_unique
    ? (currentOwner
      ? `${tierEmoji('supreme')} **Độc Nhất Toàn Server** — Chủ sở hữu: **${currentOwner.username}** (<@${currentOwner.user_id}>)`
      : `${tierEmoji('supreme')} **Độc Nhất Toàn Server** — Chưa có chủ sở hữu`)
    : null;

  const dropRateMap = { common: '60.5%', rare: '25%', epic: '14%', mythic: '0.5%' };
  const dropRate = dropRateMap[item.rarity_key] || '0.5%';
  const kindLabel = entityKind === 'domain' ? 'Linh Vực' : entityKind === 'sense' ? 'Thần Thức' : 'Thần Cảnh';

  const lines = [];
  if (entityKind === 'domain') {
    const piercePct = Math.round((item.enemy_active_debuff_pierce || 0) * 100);
    const suppressPct = Math.round((item.enemy_buff_suppression || 0) * 100);
    lines.push(`${tier.emoji} **${item.rarity}** • ${kindLabel} • ${domainElementEmoji(item.element)} Hệ **${item.element}** • Tỉ lệ rớt **${dropRate}**`);
    lines.push(`${em('su_realm_star')} **Linh Mạch gốc:** \`${item.base_energy}\`${piercePct ? ` • **Xuyên Kháng Vực:** \`${piercePct}%\`` : ''}${suppressPct ? ` • **Áp Chế Buff Vực Địch:** \`${suppressPct}%\`` : ''}`);
    lines.push(`${em('su_sparkle')} **Buff Phe Ta:** ${item.buff_desc}`);
    lines.push(`${em('su_crossed_swords')} **Debuff Phe Địch:** ${item.debuff_desc}`);
    if (item.dao_ap) {
      lines.push(`${em('dao_ap_crest')} **Đạo Áp (${item.dao_ap.tier === 'unique' ? 'Cấp 2+' : 'Cấp 2'} — ${item.dao_ap.duration_turns} hiệp):** ${item.dao_ap.summary}`);
    }
  } else if (entityKind === 'sense') {
    const boostPct = Math.round((item.buff_boost_pct || 0) * 100);
    const resistPct = Math.round((item.clash_resist_chance || 0) * 100);
    lines.push(`${tier.emoji} **${item.rarity}** • ${kindLabel} • Tỉ lệ rớt **${dropRate}**`);
    lines.push(`${em('su_realm_star')} **Linh Mạch tối đa:** \`+${item.bonus_energy}\` • **Cường Hóa Buff Vực:** \`+${boostPct}%\` • **Kháng Trừ Linh Mạch Khắc Vực:** \`${resistPct}%\``);
    lines.push(`${em('su_sparkle')} **Hiệu ứng:** ${item.desc}`);
  } else {
    const debuffPct = Math.round((item.debuff_boost_pct || 0) * 100);
    lines.push(`${tier.emoji} **${item.rarity}** • ${kindLabel} • Tỉ lệ rớt **${dropRate}**`);
    lines.push(`${em('su_thunder_hax')} **Cường Hóa Debuff Vực:** \`+${debuffPct}%\``);
    lines.push(`${em('su_crossed_swords')} **Hiệu ứng:** ${item.desc}`);
  }

  lines.push(`${em('su_gacha_dice')} **Nguồn & Lệnh:** \`/roll loai:domain\` • Trang bị: \`/linhvuc hanh_dong:equip ma_id:${cleanId}\``);
  if (ownerLine) lines.push(ownerLine);

  const imageUrl = `${PUBLIC_BASE_URL}/assets/domains/${cleanId}.webp?v=1.5`;
  const titlePrefix = entityKind === 'domain'
    ? domainElementEmoji(item.element)
    : entityKind === 'sense'
      ? em('su_realm_star')
      : em('dao_ap_crest');

  return {
    success: true,
    data: {
      ...item,
      entity_kind: entityKind,
      entity_id: cleanId,
      kind_label: kindLabel,
      current_owner: currentOwner,
      owner_label: item.is_unique ? (currentOwner ? currentOwner.username : 'Chưa có chủ sở hữu') : null,
      image_url: imageUrl,
    },
    embed: {
      title: `${titlePrefix} ${kindLabel.toUpperCase()}: ${item.name}`.trim(),
      description: lines.join('\n'),
      color: tier.color,
      color_dec: tier.colorDec,
      image_url: imageUrl,
      footer: '',
    },
  };
}
