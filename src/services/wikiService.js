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
  DOMAIN_CATALOG,
  DIVINE_SENSE_CATALOG,
  DIVINE_REALM_CATALOG,
  V17_PET_EVOLUTIONS,
  RARITY_TIERS,
  resolveEntityDisplayRarityKey,
  PUBLIC_BASE_URL,
  FUYUMI_USER_ID,
} from '../data/catalog.js';
import { V14_EXPLORER_MAPS } from '../data/v14ExpansionCatalog.js';
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
  roles_1: 'roles',
  roles_2: 'roles',
  roles_3: 'roles',
};

export const WIKI_METADATA = {
  title: 'Cẩm Nang Tu Tiên SuMi Family',
  subtitle: 'Cẩm nang v1.7 • 10 Chuyên Mục • 150 Linh Thú (40 Tiến Hóa Ultimate) • 264 Pháp Bảo • 161 Lãnh Địa • Shop Đặc Biệt • Luyện Đan',
  version: '1.7',
  guild: 'SuMi Family (1026096141273661450)',
  guild_id: '1026096141273661450',
  bot: 'Nhiễm Nhiễm (916469360401453067)',
  bot_id: '916469360401453067',
  owner: 'Fuyumi (757091869183311872)',
  owner_id: FUYUMI_USER_ID,
  theme_color: '#ec4899',
  theme_color_dec: 15485081,
  updated_at: '2026-11-27T00:00:00.000Z',
  total_categories: 10,
};

export const WIKI_CATEGORIES = {
  overview: {
    id: 'overview',
    title: `${em('su_wiki_scroll')} Tổng Quan Tu Tiên`,
    icon: em('su_wiki_scroll'),
    description: 'Khởi đầu tu hành, bộ lệnh Tu Tiên & Tiện Ích Server (v1.7).',
    image_url: '',
    sections: [
      {
        heading: '1. Khởi Đầu Nhanh',
        content: '• Mặc định Lv.1 • 0 EXP • 0 LT • 1 Slot Role • Pet Hóa Thạch Nham Nham Thú (120 ATK / 180 DEF / 100 SPD).\n• Tích EXP tự động qua Chat (23–35 EXP/45s) & Voice (85–135 EXP/5p).',
      },
      {
        heading: '2. Bộ Lệnh Tu Tiên & Tiện Ích Server (v1.7)',
        content: '• Hồ sơ: /profile, /rank, /exp, /doiqua.\n• Chiến đấu & Tiến Hóa: /battle, /tienhoa, /linhvuc, /party, /linhmach, /nhiemvu.\n• Gacha & Kho: /roll, /autosell, /shop, /shop_dacbiet, /dothach, /gieoque, /inv, /phapbao, /linhthu, /pet, /roles, /equip, /unequip, /enchant, /dismantle.\n• Kinh tế & Cộng đồng: /daily, /job, /farm, /exchange, /luyendan, /explorer, /tangqua, /marry, /divorce, /giatoc, /top, /coinflip, /blackjack, /slots, /crash.\n• Tra cứu & Tiện ích: /wiki, /info, /updates • /play, /queue, /music, /sound • /giveaway_create, /giveaway_end, /giveaway_list, /giveaway_cancel, /giveaway_check • /sticky-set, /sticky-off.',
      },
    ],
    fields: [
      {
        name: `${em('su_sprout')} Khởi Đầu`,
        value: '• Tự tạo hồ sơ khi Chat (`23–35 EXP/45s`) hoặc Voice (`85–135 EXP/5p`).\n• Tặng sẵn Pet **Hóa Thạch Nham Nham Thú** *(120 ATK / 180 DEF / 100 SPD)* & 1 Slot Role.',
        inline: false,
      },
      {
        name: `${em('su_pin_sigil')} Lệnh Tu Tiên (v1.7)`,
        value: [
          '• **Hồ sơ:** `/profile` • `/rank` • `/exp` *(xem Boost)* • `/doiqua` *(đổi EXP→LT)*',
          '• **Chiến đấu & Tiến Hóa:** `/battle` • `/tienhoa` *(Tiến Hóa Chân Thần)* • `/linhvuc` • `/party` • `/linhmach` • `/nhiemvu` *(Tháp 500 tầng)*',
          '• **Kho & Gacha:** `/roll` • `/dothach` • `/gieoque` • `/autosell` • `/shop` • `/shop_dacbiet` *(Chủ Nhật)* • `/inv` • `/phapbao` • `/linhthu` • `/pet` • `/roles` • `/equip` • `/unequip` • `/enchant` • `/dismantle`',
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
    content: 'Hệ thống Tu Tiên SuMi Family v1.7: Tiến Hóa Chân Thần (/tienhoa) & 40 Ultimate, +260 món mới, Shop Đặc Biệt Chủ Nhật (/shop_dacbiet), Gacha 0.65%, Buff SET 2 tầng, Pity 350, Đổ Thạch, Lò Luyện Đan, Tháp 500 tầng, Nông Trại 8 ô & Khám Phá 12 địa danh.',
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
        content: '• Chat: 23–35 EXP/tin (45s) • Voice: 85–135 EXP/5p (chấm công 12p) • Công thức: 78 × Level^1.45 (max 500.000 EXP). Dùng /exp xem chi tiết Boost.\n• Mốc Level: Lv.5 (+3% EXP), Lv.10 (+5%), Lv.20 (+8% EXP/+5% Daily LT), Lv.35 (+12%/+10%), Lv.45 (+15%/+10%/+5% Pet), Lv.60 (+20%/+15%/+8%), Lv.80 (+30%/+25%/+12%), Lv.100 Hỗn Độn Chúa Tể (+50% EXP/+50% Daily LT/+20% Pet).\n• Lưu ý: EXP từ Role/Cảnh Giới áp dụng cho Chat, Voice & /job; Daily LT áp dụng 100% cho /daily & 25% hiệu lực cho /job. Viền & Ảnh Nền (/shop) áp dụng cho /daily, /job, /explorer & Tháp.',
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
        value: '• **Chat:** `23–35 EXP` / tin *(cooldown 45s)* • **Voice:** `85–135 EXP` / 5p *(chấm công 12p)*.\n• **Cần lên cấp:** `78 × Level^1.45` *(trần `500.000 EXP`)* • **Viền & Ảnh Nền (`/shop`):** `Phàm +2% • Linh +4% • Tiên +7% • Thần Thoại +10%` EXP & LT mỗi món *(max +20%, áp dụng cho /daily, /job, /explorer & Tháp)* • Tra tổng boost bằng `/exp`.',
        inline: false,
      },
      {
        name: `${em('su_medal_role')} Mốc Level Role & Quyền Cơ Bản Discord`,
        value: [
          `• ${levelMilestoneEmoji(5)} \`Lv.5\` (+3% EXP): Gửi ảnh/tệp • ${levelMilestoneEmoji(10)} \`Lv.10\` (+5% EXP): Phát trực tiếp (Stream)`,
          `• ${levelMilestoneEmoji(20)} \`Lv.20\` (+8% EXP, +5% Daily LT): Emoji Nitro liên server & Lập Gia Tộc • ${levelMilestoneEmoji(35)} \`Lv.35\` (+12% EXP, +10% Daily LT): Nhúng liên kết`,
          `• ${levelMilestoneEmoji(45)} \`Lv.45\` (+15% EXP, +10% Daily LT, +5% Pet): Sticker liên server • ${levelMilestoneEmoji(60)} \`Lv.60\` (+20% EXP, +15% Daily LT, +8% Pet): Voice Message`,
          `• ${levelMilestoneEmoji(80)} \`Lv.80\` (+30% EXP, +25% Daily LT, +12% Pet): Soundboard • ${levelMilestoneEmoji(100)} \`Lv.100\` **Hỗn Độn Chúa Tể** (+50% EXP, +50% Daily LT, +20% Pet): Âm thanh liên server`,
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
        content: '• Thứ tự: Lôi Quang Tốc > Final SPD; HP = (Lv × 1.000) + (Final DEF × 5) + Bonus HP; max 30 hiệp.\n• Sát thương thường đánh vào Khiên trước; Bạo kích ×1.75; Sát thương kỹ năng trừ DEF × 0.4 và đánh vào Khiên trước. Sát thương chuẩn trừ thẳng HP, bỏ qua DEF & Khiên (Phản Đòn trần tổng 85%, Nổ Hộ Thuẫn, DoT 28%, Hút Sinh Lực, Mị Hoặc Phản Phệ). Phản Công khi né đòn vẫn đánh vào Khiên trước.\n• Discord hiện Hiệp 1/5/10/15/20 & Kết; bấm Xem Nhật Ký Trận Đấu để xem đủ từng hiệp trên Web (lưu 48h).\n• Linh Vực (/linhvuc) vào trận từ Hiệp 2 (Kiếm → Huyễn → Trận → Minh → Thánh → Kiếm); Thần Thoại có Đạo Áp Cấp 2.\n• /party & /linhmach: Mở 6 khung giờ vàng (08/12/18/20/21/22h), chia 6–56 LT/phút.',
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
          '• **1v1 (`/battle [@user]`):** PvP `15 trận/ngày`, PvE Tự Do `25 trận/ngày` (`+10 / -5 LT`) • Max **30 hiệp**, cooldown `15s`.',
          '• **Sát Thương Trừ Thẳng Máu (Bỏ Qua Khiên):** **Phản Đòn** *(reflect, tổng tối đa `85%`)*, **Nổ Hộ Thuẫn**, **Độc / Thiêu Đốt (DoT 28%)**, **Hút Sinh Lực Định Kỳ** và **Mị Hoặc Phản Phệ** trừ **thẳng HP, bỏ qua Khiên & DEF**. Riêng **Sát Thương Thường / Kỹ Năng / Phản Công khi né** đều vào Khiên trước.',
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
    title: `${em('su_crossed_swords')} Trang Bị Loadout (264 Pháp Bảo)`,
    icon: em('su_crossed_swords'),
    description: '90 Vũ Khí • 87 Bảo Ngọc • 87 Chiến Hồn, tỉ lệ rớt 0.65%, 59 Độc Nhất & Khắc Ấn D→S.',
    image_url: '',
    sections: [
      {
        heading: '1. 3 Slot Pháp Bảo (264 Món)',
        content: '• Vũ Khí (90): ATK, SPD, CRIT & HAX công • Bảo Ngọc (87): DEF, HP, Khiên & kháng • Chiến Hồn (87): Chỉ số tổng & HAX đa tầng.',
      },
      {
        heading: '2. Tỉ Lệ Rớt (v1.7) & Quy Tắc Sở Hữu',
        content: '• Phàm 60.35% • Linh 25% • Tiên 14% • Thần Thoại+ 0.65% (tách cố định 0.0325% Độc Nhất miễn nhiễm Luck + 0.6175% × Luck Thần Thoại thường; 59 Độc Nhất toàn server).\n• Quay trùng cộng dồn & giữ tư chất Khắc Ấn cao nhất; hỗ trợ tự bán qua /autosell, xem kho /phapbao, tháo /unequip & nâng D→S qua /enchant.',
      },
    ],
    fields: [
      {
        name: `${em('su_shield_def')} 3 Nhóm Pháp Bảo (264 Món)`,
        value: `• ${em('su_crossed_swords')} **Vũ Khí** (90): \`ATK • SPD • CRIT\`\n• ${em('su_linhthach')} **Bảo Ngọc** (87): \`DEF • HP • Khiên\`\n• ${em('su_thunder_hax')} **Chiến Hồn** (87): \`ATK • DEF • SPD • HAX\``,
        inline: true,
      },
      {
        name: `${em('su_gacha_dice')} Tỉ Lệ Rớt (v1.7)`,
        value: `• ${tierEmoji('common')} Phàm: **60.35%**\n• ${tierEmoji('rare')} Linh: **25%**\n• ${tierEmoji('epic')} Tiên: **14%**\n• ${tierEmoji('mythic')} Thần Thoại+: **0.65%** *(59 Độc Nhất + 135 Tự Do)*`,
        inline: true,
      },
      {
        name: `${tierEmoji('supreme')} Quy Tắc, Khắc Ấn Mới & Pity 350`,
        value: '• **Khắc Ấn (`/enchant` D→S):** `D +0% • C +8% • B +18% • A +32% • S +50%` *(Pity +5%/lần trượt)*.\n• **Pity Thần Thoại 350:** Chạm 350 lượt `/roll` chắc chắn nổ Thần Thoại+ *(95% Thường / 5% Độc Nhất)*.\n• **Hiến Chế Hồng Mông (`/tienhoa` Tab 2):** Dùng **1 Vũ Khí / Bảo Ngọc / Chiến Hồn Thần Thoại thường** *(+3 Mảnh Hỗn Độn + 2.500 LT)* chế `1 Hồng Mông Tiến Hóa Tinh`.\n• Quay trùng tự cộng dồn & giữ `max(D..S)` • Xem kho `/phapbao`, tự bán `/autosell`, tháo `/unequip`, phá `/dismantle`.',
        inline: false,
      },
    ],
    content: '264 Pháp Bảo chia 3 Slot (90 Vũ Khí / 87 Bảo Ngọc / 87 Chiến Hồn), Gacha 0.65%, hỗ trợ /phapbao, /equip, /unequip, /enchant & /autosell.',
  },

  pets: {
    id: 'pets',
    title: `${em('su_pet_paw')} Linh Thú Tiên Giới (150 Chiến Pet • 40 Tiến Hóa Chân Thần)`,
    icon: em('su_pet_paw'),
    description: '150 Linh Thú công khai (13 Phàm / 13 Linh / 14 Tiên / 70 Thần Thoại / 40 Tối Thượng Độc Nhất), Tiến Hóa /tienhoa & 40 Ultimate.',
    image_url: '',
    sections: [
      {
        heading: '1. Tổng Quan Linh Thú & Tiến Hóa Chân Thần (/tienhoa)',
        content: '• Xuất trận /battle với Hệ Ngũ Hành, HAX & Khắc Ấn D→S riêng. Tân thủ nhận sẵn Hóa Thạch Nham Nham Thú.\n• Tiến Hóa Chân Thần (/tienhoa): Toàn bộ 40 Pet Tối Thượng Độc Nhất đạt Lv.40 & 8★ + 1 Hồng Mông Tiến Hóa Tinh (chế từ 3 Mảnh Hỗn Độn + 1 Đồ Thần Thoại thường: Pet / Pháp Bảo / Linh Vực / Thần Thức / Thần Cảnh + 2.500 LT) có thể tiến hóa tăng chỉ số, đổi ảnh & mở khóa 40 Skill Ultimate tái kích hoạt!\n• Công thức Chiến Lực: (ATK × 3) + (DEF × 2) + (SPD × 2) + (Lv × 50) + Trang Bị.',
      },
    ],
    fields: [
      {
        name: `${em('su_wiki_scroll')} Công Thức, Tiến Hóa (/tienhoa) & 40 Ultimate`,
        value: '• **Pet khởi đầu:** `Hóa Thạch Nham Nham Thú` *(Phàm • 120 ATK / 180 DEF / 100 SPD)*.\n• **Tăng trưởng Lv/Sao:** `Lv.1→100` tăng **`+550%`**, `1★→10★` tăng **`+135%`** *(tổng **`7.85×`** chỉ số gốc)*.\n• **Tiến Hóa Chân Thần (`/tienhoa`):** 40 Pet Độc Nhất (`Lv.40 & 8★` + `1 Hồng Mông Tiến Hóa Tinh`, trượt không mất Hồng Mông) mở khóa **Skill Ultimate tái kích hoạt** • Chế Hồng Mông (Tab 2): `3 Mảnh Hỗn Độn + 1 Đồ Thần Thoại thường (Pet / Pháp Bảo / Vực / Thức / Cảnh) + 2.500 LT`.',
        inline: false,
      },
      {
        name: `${em('su_gacha_dice')} Phân Bậc Phẩm Cấp (150 Linh Thú Công Khai)`,
        value: [
          `• ${tierEmoji('common')} **Phàm** *(13 loài)*: **60.35%** *(300 LT trong \`/shop\`)* • ${tierEmoji('rare')} **Linh** *(13 loài)*: **25%** *(900 LT trong \`/shop\`)*`,
          `• ${tierEmoji('epic')} **Tiên** *(14 loài)*: **14%** *(\`/roll\`)* • ${tierEmoji('mythic')} **Thần Thoại** *(70 loài)* & ${tierEmoji('unique_supreme')} **Tối Thượng Độc Nhất** *(40 loài)*: **0.65%** *(\`/roll\`)*`,
        ].join('\n'),
        inline: false,
      },
    ],
    content: '150 Linh Thú công khai (13 Phàm • 13 Linh • 14 Tiên • 70 Thần Thoại • 40 Tối Thượng Độc Nhất hỗ trợ Tiến Hóa /tienhoa & 40 Ultimate).',
  },

  domains: {
    id: 'domains',
    title: `${em('su_realm_star')} Linh Vực • Thần Thức • Thần Cảnh (161 Món Công Khai)`,
    icon: em('su_realm_star'),
    description: '65 Linh Vực • 48 Thần Thức • 48 Thần Cảnh công khai, cơ chế Linh Mạch, Khắc Vực & Gacha 0.65% /roll loai:domain.',
    image_url: '',
    sections: [
      {
        heading: '1. Hệ Thống 3 Slot Vực (161 Món Công Khai — Hiệp 2+)',
        content: '• Linh Vực (65 món: 15 Phàm/Linh/Tiên + 35 Thần Thoại Thường + 15 Tối Thượng Độc Nhất): cung cấp Linh Mạch (3→7), Buff phe ta, Debuff phe địch, Xuyên Kháng Vực (56%/60%) & Áp Chế Buff Vực Địch (5%).\n• Thần Thức (48 món): cộng +1→+6 Linh Mạch tối đa, Cường Hóa Buff Vực & Kháng Trừ Linh Mạch Khắc Vực.\n• Thần Cảnh (48 món): tăng Cường Hóa Debuff Vực + kèm Debuff phụ riêng (DoT Thần Cảnh chịu Kháng Độc/Đốt & Bất Tử).',
      },
      {
        heading: '2. Ngũ Hành Khắc Vực & Lệnh Quản Lý',
        content: '• Vòng Khắc Vực 5 hệ: Kiếm Vực → Huyễn Vực → Trận Vực → Minh Vực → Thánh Vực → Kiếm Vực (bên khắc chỉ mất 1 Mạch/hiệp, bên bị khắc mất 2 Mạch/hiệp).\n• Sở hữu qua /roll loai:domain (50 LT/lượt, 0.65% Thần Thoại+, Pity 350 riêng), trang bị qua /linhvuc.',
      },
    ],
    fields: [
      {
        name: `${em('su_realm_star')} 3 Thành Phần Bộ Vực (161 Món Công Khai)`,
        value: [
          '• **Linh Vực (65):** `15 Phàm/Linh/Tiên` • `35 Thần Thoại (6 Mạch, Xuyên Kháng Vực 56%)` • `15 Tối Thượng Độc Nhất (7 Mạch, Xuyên Kháng Vực 60%, Áp Chế 5% Buff Vực Địch)`.',
          '• **Thần Thức (48):** `9 Phàm/Linh/Tiên` • `32 Thần Thoại` • `7 Tối Thượng Độc Nhất` • Cộng **Linh Mạch**, **Cường Hóa Buff Vực** & **Kháng Trừ Linh Mạch Khắc Vực**.',
          '• **Thần Cảnh (48):** `9 Phàm/Linh/Tiên` • `32 Thần Thoại` • `7 Tối Thượng Độc Nhất` • Cộng **Cường Hóa Debuff Vực** + Debuff phụ riêng.',
        ].join('\n'),
        inline: false,
      },
      {
        name: `${em('dao_ap_crest')} Khắc Vực, Đạo Áp & Gacha /roll loai:domain`,
        value: [
          `• **Khắc Vực:** ${domainElementEmoji('Kiếm Vực')} Kiếm → ${domainElementEmoji('Huyễn Vực')} Huyễn → ${domainElementEmoji('Trận Vực')} Trận → ${domainElementEmoji('Minh Vực')} Minh → ${domainElementEmoji('Thánh Vực')} Thánh → Kiếm (\`-1\` vs \`-2 Mạch\`/hiệp).`,
          '• **Gacha & Quản Lý:** `/roll loai:domain` *(Phàm 60.35% • Linh 25% • Tiên 14% • Thần Thoại+ 0.65%, Pity 350)* • Trang bị & xem kho `/linhvuc` • Có thể dùng **Linh Vực / Thần Thức / Thần Cảnh Thần Thoại thường** làm phôi chế Hồng Mông (`/tienhoa` Tab 2).',
        ].join('\n'),
        inline: false,
      },
    ],
    content: '161 món Lãnh Địa công khai (65 Linh Vực, 48 Thần Thức, 48 Thần Cảnh), kích hoạt từ Hiệp 2 trong /battle.',
  },

  roles: {
    id: 'roles',
    title: `${em('su_medal_role')} Role Quyền Năng & Quyền Discord (40 Role + 8 Mốc Cấp)`,
    icon: em('su_medal_role'),
    description: 'Bố cục 3 trang: (1) Role Cao Cấp, (2) 21 Role Phàm & Cảnh Giới, (3) Giải thích chi tiết từng gói quyền & Buff.',
    image_url: '',
    sections: [
      {
        heading: '1. Hệ Thống 40 Role Quyền Năng & 8 Level Roles',
        content: '• Trang 1: 5 Thần Thoại (0.5%) + 6 Tiên Phẩm (14%) + 8 Linh Phẩm (25%).\n• Trang 2: 21 Phàm Phẩm (/shop & 60.5%) + 8 Level Roles (Lv.5–100).\n• Trang 3: Giải thích chi tiết Full Voice, Full Chat/Thread, Voice/Chat VIP & Phạm vi Buff Tu Tiên.',
      },
    ],
    pages: [
      {
        page: 1,
        subtitle: 'Trang 1/3 — Role Cao Cấp (5 Thần Thoại • 6 Tiên Phẩm • 8 Linh Phẩm)',
        fields: [
          {
            name: `${tierEmoji('mythic')} 5 Role Thần Thoại (0.5% /roll)`,
            value: [
              '• **« Cửu Vĩ Tối Thượng Thần Hồ »**',
              '-# ↳ Full Voice/Chat • +70% EXP & Daily LT • +25% Pet',
              '• **« SuMi Đệ Nhất Khách Tôn »**',
              '-# ↳ Full Voice/Chat • +60% EXP & Daily LT • +20% Pet',
              '• **« Vạn Cổ Chí Tôn »**',
              '-# ↳ Voice/Thread VIP • +50% EXP & Daily LT • +18% Pet',
              '• **« Sáng Thế Thần Quân »**',
              '-# ↳ Voice/Thread VIP • x2.5 Daily LT • -15% Shop',
              '• **« Cửu Vĩ Yêu Hậu »**',
              '-# ↳ Voice/Chat VIP • +80% EXP • +15% Pet',
            ].join('\n'),
            inline: false,
          },
          {
            name: `${tierEmoji('epic')} 6 Role Tiên Phẩm (14% /roll)`,
            value: [
              '• **« Cửu Tiêu Phong Vương »**',
              '-# ↳ Move/Mute Voice, Miễn Slowmode • +20% EXP',
              '• **« Thái Hư Chân Quân »**',
              '-# ↳ Quản Lý Nick, Ghim Tin, Thread Kín • +20% Daily LT',
              '• **« Vạn Bảo Tài Thần »**',
              '-# ↳ Nhúng Link/Ảnh, Emoji/Sticker Ngoại • +35% Daily LT • -10% Shop/Roll',
              '• **« Bát Hoang Chiến Thần »**',
              '-# ↳ Stream HD, Ghim Tin, Miễn Slowmode • +20% EXP • +15% Pet',
              '• **« Hồng Trần Tiên Lữ »**',
              '-# ↳ Stream/Sound/Emoji/Sticker Ngoại • +25% EXP • +10% Pet',
              '• **« Tinh Hà Pháp Vương »**',
              '-# ↳ Move/Mute/Deafen Voice, Ghim Tin • +25% EXP',
            ].join('\n'),
            inline: false,
          },
          {
            name: `${tierEmoji('rare')} 8 Role Linh Phẩm (25% /roll)`,
            value: [
              '• **« Song Tuyệt Kiếm Khách »**',
              '-# ↳ Ghim Tin Nhắn, Miễn Slowmode',
              '• **« Huyễn Ảnh Linh Tôn »**',
              '-# ↳ Tự Do Đổi Nick, Emoji/Sticker Ngoại • +10% EXP',
              '• **« Lôi Vũ Hộ Pháp »**',
              '-# ↳ Di Chuyển & Ưu Tiên Nói Voice',
              '• **« Hàn Ngọc Tiên Tử »**',
              '-# ↳ Stream HD, Soundboard & Âm Ngoại • +10% Daily LT',
              '• **« Mật Các Trưởng Lão »**',
              '-# ↳ Thread Mở/Kín, Đọc Kênh Lưu Trữ • +12% EXP',
              '• **« Kim Tiền Đạo Nhân »**',
              '-# ↳ Biểu Cảm & Emoji Ngoại • +25% Daily LT • -5% Shop',
              '• **« Chiến Hồn Tiên Phong »**',
              '-# ↳ Nhúng Link/Ảnh, Miễn Slowmode • +8% Pet',
              '• **« Thiên Âm Nhạc Sư »**',
              '-# ↳ Ưu Tiên Voice, Soundboard & Âm Ngoại • +12% EXP',
            ].join('\n'),
            inline: false,
          },
        ],
      },
      {
        page: 2,
        subtitle: 'Trang 2/3 — 21 Role Phàm Phẩm (/shop & 60.5% /roll) & 8 Mốc Cảnh Giới',
        fields: [
          {
            name: `${tierEmoji('common')} 8 Role Voice Phàm Phẩm`,
            value: [
              '• **« Linh Âm Hồ Ca »** — *Ưu Tiên Nói, Soundboard & Âm Ngoại*',
              '• **« Phong Thanh Hộ Pháp »** — *Di Chuyển Thành Viên Voice (Move)*',
              '• **« Lôi Âm Tôn Giả »** — *Ưu Tiên Nói Voice (Priority Speaker)*',
              '• **« Tịch Tĩnh Tán Nhân »** — *Tắt Mic Thành Viên Voice (Mute)*',
              '• **« Bế Tức Chân Nhân »** — *Tắt Tai Nghe Thành Viên Voice (Deafen)*',
              '• **« Huyễn Âm Tiên Cô »** — *Dùng Bảng Âm Thanh (Soundboard)*',
              '• **« Cửu Châu Diễn Âm »** — *Dùng Soundboard & Âm Ngoại Server*',
              '• **« Tiêu Dao Khách »** — *Phát Trực Tiếp Video HD 1080p (Stream)*',
            ].join('\n'),
            inline: false,
          },
          {
            name: `${tierEmoji('common')} 11 Role Chat/Nick/Thread & 2 Role Thuần Buff`,
            value: [
              '• **« Huyễn Diện Đạo Quân »** *(Đổi Nick)* • **« Định Danh Sứ Giả »** *(Quản Lý Nick)*',
              '• **« Thần Hành Cốt Cách »** *(Miễn Slowmode)* • **« Họa Đồ Linh Sư »** *(Link & Ảnh/File)*',
              '• **« Vạn Tượng Linh Hồ »** *(Emoji Ngoại)* • **« Thần Phù Thượng Quan »** *(Sticker Ngoại)*',
              '• **« Khai Sơn Tiên Phong »** *(Thread Mở)* • **« Mật Tàng Hộ Vệ »** *(Thread Kín)*',
              '• **« Trấn Thư Pháp Vương »** *(Ghim Tin)* • **« Trảm Phong Kiếm Khách »** *(TTS)* • **« Thần Thông Thấu Thị »** *(Đọc Lịch Sử)*',
              '• **« Linh Hồn Tu Luyện »** (`+15% EXP`) • **« Tài Vận Hanh Thông »** (`+20% Daily LT`)',
            ].join('\n'),
            inline: false,
          },
          {
            name: `${em('su_level_up')} 8 Mốc Role Cảnh Giới Tự Mở Theo Cấp`,
            value: [
              '• `Lv.5` Gửi Ảnh/File (`+3% EXP`) • `Lv.10` Stream (`+5% EXP`)',
              '• `Lv.20` Emoji Nitro & Lập Gia Tộc (`+8% EXP, +5% Daily LT`) • `Lv.35` Nhúng Link (`+12% EXP, +10% Daily LT`)',
              '• `Lv.45` Sticker Ngoại (`+15% EXP, +10% Daily LT, +5% Pet`) • `Lv.60` Voice Message (`+20% EXP, +15% Daily LT, +8% Pet`)',
              '• `Lv.80` Soundboard (`+30% EXP, +25% Daily LT, +12% Pet`) • `Lv.100` Âm Ngoại (`+50% EXP, +50% Daily LT, +20% Pet`)',
            ].join('\n'),
            inline: false,
          },
        ],
      },
      {
        page: 3,
        subtitle: 'Trang 3/3 — Giải Thích Chi Tiết Chức Năng & Phạm Vi Buff',
        fields: [
          {
            name: `${em('su_pin_sigil')} Chi Tiết Các Gói Quyền Discord`,
            value: [
              '• **`Full Voice`**: Di chuyển thành viên (`Move`), Tắt mic (`Mute`), Tắt tai nghe (`Deafen`), Ưu tiên nói (`Priority`), Stream HD 1080p, Soundboard & Âm thanh ngoại server.',
              '• **`Full Chat/Thread`**: Ghim tin (`Pin`), Miễn Slowmode, Tạo & Quản lý Thread công khai/kín, Quản lý biệt danh, Gửi TTS, Nhúng Link/Ảnh/File, Emoji & Sticker ngoại, Đọc lịch sử kênh.',
              '• **`Voice/Thread VIP (Vạn Cổ Chí Tôn)`**: Voice (`Move/Mute/Deafen/Ưu tiên/Stream HD`) + Chat/Thread (`Ghim, Miễn Slowmode, Tạo & Quản lý Thread, Quản lý Nick, Ảnh/Link, Emoji & Sticker ngoại`).',
              '• **`Voice/Thread VIP (Sáng Thế Thần Quân)`**: Voice (`Move/Ưu tiên/Stream HD`) + Chat/Thread (`Ghim, Miễn Slowmode, Tạo Thread, Quản lý Nick, Ảnh/Link, Emoji & Sticker ngoại`).',
              '• **`Voice/Chat VIP (Cửu Vĩ Yêu Hậu)`**: Voice (`Move/Mute/Stream HD/Soundboard & Âm ngoại`) + Chat/Thread (`Ghim, Miễn Slowmode, Tạo Thread, Đổi Nick, Ảnh/Link, Emoji & Sticker ngoại`).',
            ].join('\n'),
            inline: false,
          },
          {
            name: `${em('su_sparkle')} Phạm Vi Buff Tu Tiên & Quy Tắc Slot`,
            value: [
              '• **`EXP` (Role & Cảnh Giới)**: Cộng vào **Chat EXP, Voice EXP & `/job` EXP**.',
              '• **`Daily LT` (Role & Cảnh Giới)**: Cộng **`+100%` vào `/daily`** & **`+25%` hiệu lực vào `/job`** *(không cộng vào `/explorer`, Tháp, `/farm`, `/luyendan`; riêng Viền Avatar & Ảnh Nền `/shop` cộng vào `/daily`, `/job`, `/explorer` & Tháp)*.',
              '• **`Chiến Lực Pet`**: Cộng thẳng vào **ATK / DEF / SPD** của Linh Thú.',
              '• **`Giảm Giá`**: Cộng dồn tối đa **`-25% Giá Shop`** và **`-20% Giá /roll`**.',
              '• **`Slot & Gacha`**: Mở **1 → 5 Slot** theo Cảnh Giới (`/roles`, `/equip`, `/unequip`); Gacha ra `40% 7d • 30% 30d • 18% 60d • 10% 90d • 2% Vĩnh Viễn`. Tra chi tiết từng Role bằng **`/info <tên role>`**.',
            ].join('\n'),
            inline: false,
          },
        ],
      },
    ],
    fields: [],
    content: '40 Role Quyền Năng (5 Thần Thoại, 6 Tiên Phẩm, 8 Linh Phẩm, 21 Phàm Phẩm) & 8 Level Roles chia 3 trang rõ ràng.',
  },

  economy: {
    id: 'economy',
    title: `${em('su_linhthach')} Kinh Tế, Shop Đặc Biệt, Tháp 500 & Nông Trại (v1.7)`,
    icon: em('su_linhthach'),
    description: '/daily (55–80 LT), /job (+30%), /roll (0.65%), /shop_dacbiet Chủ Nhật, /nhiemvu (+30% & Tháp Mảnh Hỗn Độn), /farm (-30p), /luyendan & Minigame.',
    image_url: '',
    sections: [
      {
        heading: '1. Kiếm LT, Gacha 0.65%, Đổ Thạch & Shop Đặc Biệt',
        content: '• /daily (55–80 LT + Streak 7d) • /job (+30%, 6 nghề, 8 ca/ngày) • /doiqua (1.000 EXP → 10 LT) • Lên cấp +50..+400 LT.\n• /roll (50 LT/lượt, 450/10, 0.65% Thần Thoại+, Pity 350 với 5% Độc Nhất) hỗ trợ /autosell.\n• /shop_dacbiet (Chủ Nhật 08:00–24:00 UTC+7): Đổi 750 LT = 1 Xích Kim Tinh Thạch (TT, min 5 TT, max 200 TT/tuần) để mua Hồng Mông Tiến Hóa Tinh, Thẻ Chọn Thần Thoại (7 nhóm), Mảnh Hỗn Độn, Bùa Tuyệt Ấn, Thẻ Auto Farm & 5 Khung Đặc Biệt.\n• /dothach (40 Nguyên Thạch, 300 manh mối, giảm -10% xịt): Săn Linh Thạch, Đá Khắc Ấn, Tinh Thạch & Hộp Thần Thoại Cực Phẩm.\n• /gieoque (1 lần/ngày UTC+7): 6 bậc Khí Vận + Cầu An Giải Hạn 250 LT • /shop (7 quầy, phân trang 30 Khung Avatar + 3 Lọ Luck Potion).',
      },
      {
        heading: '2. Nhiệm Vụ (+30%), Tháp 500 Tầng, Nông Trại (-30p) & Lò Luyện Đan',
        content: '• /nhiemvu (+30%): Ngày 5/5 (+170 LT), Hợp Đồng Tuần (450/550/500/700 LT), Tháp 500 tầng mốc T100/200/300/400/500 tặng thêm +1 Mảnh Hỗn Độn.\n• /farm 8 ô (4 Linh Điền + 4 Linh Các): Tưới/cho ăn rút ngắn -30 phút chín; có Thẻ Tự Động Chăm Farm 24h, Bùa Bảo Vệ +2h, Thuốc Tốc Độ (-25%) & Bột Sản Lượng (+30%).\n• /luyendan: 6 mẻ/ngày trên 2 Lò song song (Lv.1–5), hỗ trợ Bùa Bảo Vệ Lò (+2h) & DM nhắc tự động • /inv 3 Loadout (Bộ 1/2/3) đồng bộ với /explorer.',
      },
    ],
    fields: [
      {
        name: `${em('su_linhthach')} Linh Thạch, /job, Gacha 0.65% & Shop Đặc Biệt`,
        value: [
          '• `/daily` *(55–80 LT)* • `/job` *(+30%, 6 nghề, 8 ca/ngày)* • `/doiqua` (`1.000 EXP → 10 LT`) • Đọc xác nhận `/updates` v1.7 nhận **+3.000 LT + 5 TT + 5 Thẻ Reset Tháp + 300 Linh Quả + 1 Ấn Khắc Tuyệt Đối**.',
          '• `/roll` (`50 LT/lượt`, `450/10`, **0.65% Thần Thoại+**, Pity **350**) • **`/dothach`** *(40 Nguyên Thạch, giảm `-10%` xịt, săn Hộp Thần Thoại Cực Phẩm)* • **`/gieoque`** *(6 bậc Khí Vận/ngày)*.',
          '• **`/shop_dacbiet` (Chủ Nhật `08:00–24:00`):** Đổi `750 LT = 1 TT` *(tối thiểu 5 TT, trần `200 TT/tuần`)* mua Hồng Mông, Thẻ Chọn Thần Thoại, Bùa Tuyệt Ấn, Thẻ Auto Farm & 5 Khung Đặc Biệt.',
        ].join('\n'),
        inline: false,
      },
      {
        name: `${em('su_tower_boss')} Nhiệm Vụ (+30%), Tháp 500 Tầng & Top Ngày`,
        value: [
          '• **5 Nhiệm Vụ Ngày (`/nhiemvu`):** Tăng **`+30%`** *(5/5: **+170 LT** + quà)* & 4 Hợp Đồng Tuần *(450 / 550 / 500 / 700 LT)*.',
          '• **Tháp 500 Tầng (`1k → ~205k` Lực):** Mốc **T100 / T200 / T300 / T400 / T500** thưởng thêm **`+1 Mảnh Tinh Hoa Hỗn Độn`**; Hộ Tháp dùng **Linh Vực (F45+)**, **Thần Thức (F90+)**, **Thần Cảnh (F160+)** & **Chân Thần + Ultimate** *(thử lửa T150, đại trà T200+, 100% Boss từ T400+)*.',
          '• **Top Chat & Voice Ngày (`00:00`):** `/top loai:chat` & `/top loai:voice` thưởng **500 / 400 / 300 LT** mỗi ngày.',
        ].join('\n'),
        inline: false,
      },
      {
        name: `${em('su_sprout')} Nông Trại (-30p), Luyện Đan, Giải Trí & Gia Tộc`,
        value: [
          '• **`/farm` & `/exchange`:** 8 ô (`4 Linh Điền + 4 Linh Các`), tưới/cho ăn giảm **`-30 phút`** chín; hỗ trợ **Thẻ Auto Farm 24h**, **Bùa Bảo Vệ +2h**, **Thuốc Tốc Độ (-25%)** & **Bột Sản Lượng (+30%)**.',
          '• **`/luyendan` (Lò Luyện Đan):** `6 mẻ/ngày` trên `2 Lò` song song (`Lv.1–5`), hỗ trợ **Bùa Bảo Vệ Lò (+2h)** & DM nhắc chín/trước nổ 10p.',
          '• **`/inv` (3 Loadout Tự Lưu):** Chuyển nhanh `Bộ 1 / Bộ 2 / Bộ 3` đồng bộ trực tiếp với `/explorer`.',
          '• **Minigame (`10–10.000 LT`):** `/coinflip` • `/blackjack` • `/slots` • `/crash` *(Ngự Kiếm)*.',
          `• ${em('ring_mythic')} **\`/marry\`** & ${em('su_clan_castle')} **\`/giatoc\`:** 4 cấp Nhẫn (+5%..+20% EXP & Lực + Streak) • Gia Tộc Lv.1–10 (+2%..+20% EXP & Daily LT, Clan Wars 24H).`,
        ].join('\n'),
        inline: false,
      },
    ],
    content: 'Kinh tế v1.7: Gói quà mở bản +3.000 LT + 5 TT + 5 Thẻ Reset Tháp + 300 Linh Quả + 1 Ấn Khắc Tuyệt Đối, /shop_dacbiet Chủ Nhật, Gacha 0.65%, +30% /job & /nhiemvu, Tháp mốc 100..500 +Mảnh Hỗn Độn & /farm -30p.',
  },

  explorer: {
    id: 'explorer',
    title: `${em('explorer_world_map_v14')} Khám Phá Đại Lục & Thuận Hệ Địa Hình (/explorer)`,
    icon: em('explorer_world_map_v14'),
    description: '12 địa danh (3.5k → 112k Lực), đồng bộ Bộ 1/2/3, Thuận Hệ Địa Hình (+6% Sống / +10% LT), Bùa Tuyệt Ấn 25% & Mảnh Hỗn Độn 0.5%.',
    image_url: `${PUBLIC_BASE_URL}/api/explorer/map.webp?v=1.4`,
    sections: [
      {
        heading: '1. 12 Địa Danh Đại Lục Cửu Châu (Kèm Hệ Địa Hình Thuận Lợi)',
        content: V14_EXPLORER_MAPS.map(
          (m) => `• #${m.order} ${m.name} (${m.difficulty} • ${(m.recommended_power / 1000).toLocaleString('vi-VN')}k • Hệ ${(m.favored_elements || []).join('/')} • ×${m.reward_multiplier})`,
        ).join('\n'),
      },
      {
        heading: '2. Bộ 1/2/3, Thuận Hệ Địa Hình & Bảng Rơi Đồ v1.7',
        content: '• Đồng bộ trực tiếp 3 Loadout (Bộ 1 / 2 / 3) từ /inv; khóa riêng bộ đang xuất hành để bạn chuyển bộ khác đi /battle bình thường.\n• Thưởng mốc 2/3/6/12h: 210–315 LT/giờ × hệ số + 5% Đá Khắc Ấn Tuyệt Đối (tăng lên 25% khi có Bùa Tuyệt Ấn — 3 lượt) + 0.5% Mảnh Tinh Hoa Hỗn Độn cố định + 5% Thẻ Auto Farm + 55% 1–2 gói nông trại.\n• Thuận Hệ Địa Hình: Pet hoặc Linh Vực khớp Hệ Map nhận +6% Sống Sót & +10% LT.',
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
        name: `${em('su_sparkle')} Đồng Bộ Bộ 1/2/3, Thuận Hệ & Rơi Đồ v1.7`,
        value: [
          '• **Thuận Hệ Địa Hình:** Khi **Pet** hoặc **Linh Vực** xuất hành khớp **Hệ của Map**, nhận ngay **+6% Tỉ Lệ Sống Sót** & **+10% Linh Thạch**!',
          '• **Bảng Rơi Đồ v1.7 (`2/3/6/12h`):** **`210–315 LT/giờ × hệ số`** + **`5%` (`25%` với Bùa Tuyệt Ấn)** Đá Khắc Ấn Tuyệt Đối + **`0.5%`** Mảnh Tinh Hoa Hỗn Độn + **`5%`** Thẻ Auto Farm + **`55%`** `1–2` gói nông trại.',
          '• **Sinh tử & Nhặt đồ:** Lực `>=` Map sống **90%→100%**; `<` Map rủi ro tử nạn tăng dần *(thua từ 2× lực = **0%**)*. Pháp Bảo thường rơi chờ người sau nhặt **60%**.',
        ].join('\n'),
        inline: false,
      },
      {
        name: `${em('food_survival_pill')} Thức Ăn & Hồi Sinh (/shop)`,
        value: `${em('food_survival_pill')} **Hộ Mệnh Đan** *(180 LT, +8% sống)* • ${em('food_yield_tea')} **Tụ Bảo Trà** *(220 LT, +18% LT)* • ${em('food_speed_fruit')} **Ngự Phong Quả** *(250 LT, -25% giờ)* • ${em('explorer_revive_elixir')} **Hoàn Hồn Lộ** *(2.500 LT, cứu Pet Độc Nhất)*`,
        inline: false,
      },
    ],
    content: 'Khám Phá /explorer v1.7 qua 12 địa danh (3.5k → 112k Lực), đồng bộ Bộ 1/2/3, Thuận Hệ Địa Hình, 5%/25% Đá Tuyệt Ấn & 0.5% Mảnh Hỗn Độn.',
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
        subtitle: 'Trang 1/4 — 4 Loại Sát Thương, Giáp, Phản Đòn & Hồi Phục',
        fields: [
          {
            name: `${em('su_crossed_swords')} Xuyên DEF vs Giảm DEF (Không Trùng Nhau)`,
            value: [
              '• **`Xuyên X% DEF`** *(`defPiercePct`, trần `90%`)*: Chỉ số **tự thân của người đánh** khi ra đòn, không gắn debuff lên địch.',
              '• **`Giảm X% DEF`** *(`defDebuffPct` / `defReductionPct`, trần `75%`)*: **Debuff gắn trực tiếp lên kẻ địch** từ kỹ năng hoặc Vực/Cảnh.',
              '• **Giáp hiệu dụng:** `DEF × (1 - Giảm DEF) × (1 - Xuyên DEF)` *(trừ `Giảm DEF` trước, rồi `Xuyên DEF`)*.',
            ].join('\n'),
            inline: false,
          },
          {
            name: `${em('su_arena')} 4 Loại Sát Thương Trong Giao Tranh`,
            value: [
              '• **Sát Thương Thường:** Đòn cơ bản `(ATK×1.5 - DEF hiệu dụng×0.5) × Ngũ Hành`; qua Giáp & Khiên trước rồi chịu **Giảm ST Nhận** *(tối đa giảm **`85%`**, luôn lọt tối thiểu `15%`)*.',
              '• **Bạo Kích (Crit):** Tỉ lệ `5%→100%`, sát thương mặc định **`×1.75`**, có thể kèm *Xuyên Giáp / Bỏ Qua Né khi Crit*.',
              '• **Sát Thương Kỹ Năng:** Đòn phụ / Truy kích / Phản Công khi Né / Ultimate tính theo `% ATK` hoặc `% MaxHP`, vẫn trừ `DEF×0.4` *(trừ khi Xuyên 100% DEF)* & đánh vào Khiên trước.',
              '• **Sát Thương Chuẩn:** Bỏ qua DEF & Khiên, trừ thẳng HP *(giảm bởi `Kháng ST Chuẩn`, trần **`65%`**)*.',
            ].join('\n'),
            inline: false,
          },
          {
            name: `${em('su_stats_chart')} Phản Đòn, Hút Máu, Hồi Phục & Giới Hạn HP`,
            value: [
              '• **ST Chuẩn Trừ Thẳng HP:** **Độc / Thiêu Đốt (DoT)**, **Phản Đòn**, **Nổ Hộ Thuẫn**, **Hút Sinh Lực định kỳ** & **Mị Hoặc Phản Phệ** đều bỏ qua Giáp & Khiên.',
              '• **`Phản Đòn`** *(`reflectPct`, tổng trần **`85%`**)*: Dội `%` ST vừa nhận thành ST Chuẩn *(chịu `Kháng Phản Đòn` từ Vực, trần **`80%`**)*.',
              '• **`Hút Máu`** *(`65%`)* • **`Giảm Hồi Máu`** *(`90%`, không giảm Khiên)* • **`Cắt Trần HP Tối Đa`** *(`48%`)*.',
            ].join('\n'),
            inline: false,
          },
        ],
      },
      {
        page: 2,
        subtitle: 'Trang 2/4 — Hệ Thống Khiên, Hấp Thụ & 5 Cơ Chế Khắc Chế',
        fields: [
          {
            name: `${em('su_shield_def')} Tạo Khiên, Độ Dày & Hấp Thụ Thành Khiên`,
            value: [
              '• **Khiên Chắn (Shield):** Thanh giáp ảo hấp thụ **Sát Thương Thường / Bạo Kích / Kỹ Năng** trước khi trừ vào HP thật.',
              '• **`Tăng +X% Độ Dày Khiên`** *(`shieldStrengthBonusPct`, trần **`+55%`**)*: Khuếch đại mọi lượng Khiên phe ta dựng lên.',
              '• **`Hấp Thụ ST thành Khiên`** *(`absorbDmgAsShieldPct`, trần **`60%`**)*: Chuyển `%` ST vừa nhận thành Khiên mới • **`Nổ Hộ Thuẫn`** *(trần **`40%` MaxHP**)*: Khiên vỡ nổ ST Chuẩn phản lại kẻ phá.',
            ].join('\n'),
            inline: false,
          },
          {
            name: `${em('su_thunder_hax')} 5 Cơ Chế Khắc Chế Khiên Riêng Biệt`,
            value: [
              '• **`Xuyên X% Khiên`** *(`shieldPiercePct`)*: Một phần sát thương đánh xuyên thẳng vào HP thật, phần còn lại vẫn đánh vào Khiên.',
              '• **`Phá Khiên (×2 / ×2.2 ST lên Khiên)`** *(`shieldDamageMult`)*: Gây gấp `2×` *(hoặc `2.2×`)* sát thương trực tiếp lên thanh Khiên địch để đập vỡ cực nhanh.',
              '• **`Bào Mòn X% Khiên/hiệp`** *(`shieldDecayPct`, trần **`58%`**)*: Cuối mỗi hiệp tự động gọt bớt `%` Khiên hiện có của địch.',
              '• **`Giảm X% Khiên Tạo Mới`** *(`enemyShieldCapReductionPct`, trần **`62%`**)*: Ép mọi Khiên mới địch dựng lên bị cắt giảm theo `%` này.',
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
            name: `${em('su_realm_star')} Linh Mạch, Khắc Vực & Chỉ Số Lãnh Địa`,
            value: [
              '• **Linh Mạch & Khắc Vực:** Linh Vực vào sân từ Hiệp 2. Khi 2 bên cùng bật Vực sẽ trừ Linh Mạch mỗi hiệp; bên bị Khắc Vực mất **2 Mạch/hiệp** thay vì **1 Mạch/hiệp**.',
              '• **`Kháng Trừ Linh Mạch Khắc Vực`** *(`clash_resist_chance`)*: Xác suất **`%` giữ nguyên không bị mất thêm Linh Mạch** khi bị Vực địch khắc hệ.',
              '• **`Cường Hóa Buff Vực`** *(`buff_boost_pct`)* & **`Cường Hóa Debuff Vực`** *(`debuff_boost_pct`)*: Khuếch đại chỉ số Vực & toàn bộ Debuff phụ từ Thần Cảnh.',
              '• **Kháng Đặc Biệt Lãnh Địa:** `Kháng ST Chuẩn` *(trần **`65%`**)* • `Kháng Phản Đòn` *(trần **`80%`**)* • `Kháng Bạo Kích` *(trần **`65%`**)*.',
            ].join('\n'),
            inline: false,
          },
          {
            name: `${em('dao_ap_crest')} Xuyên Kháng Vực, Áp Chế & Đạo Áp`,
            value: [
              '• **`Xuyên Kháng Vực`** *(`56% / 60% / 100%`)*: Khi 2 Linh Vực đang giằng co, bình thường Debuff Vực bị chặn; chỉ số này cho phép **ép một phần (`56%/60%`) hoặc toàn bộ (`100%`) Debuff Vực xuyên thẳng vào địch**.',
              '• **`Áp Chế Buff Vực Địch`** *(`5% / 100%`)*: Trừ trực tiếp hiệu lực Buff Vực phe địch đang nhận.',
              '• **`Đạo Áp` (`1–3 hiệp`):** Hiệu ứng đặc quyền của Linh Vực Thần Thoại/Tối Thượng, **chỉ kích hoạt ở hiệp kế tiếp sau khi đánh vỡ Linh Vực đang hoạt động của đối thủ** *(không kích nếu địch không mang Vực)*, áp thêm `-DEF`, `Bào Mòn Khiên`, `Giảm Hồi Máu`, `Cắt Trần HP`.',
            ].join('\n'),
            inline: false,
          },
        ],
      },
      {
        page: 4,
        subtitle: 'Trang 4/4 — Né, Khống Chế, Debuff, Bất Tử, Ultimate & SET',
        fields: [
          {
            name: `${em('su_sparkle')} Né Tránh, Khống Chế (CC) & Trần Debuff`,
            value: [
              '• **`Né Tránh`** *(trần **`65%`**)*: Né hoàn toàn đòn đánh; nếu có **Phản Công Khi Né** sẽ đánh trả bằng ST Kỹ Năng *(vẫn vào Khiên trước)*.',
              '• **`Kháng CC`** *(`92%`)* vs **`Miễn 100% CC`** *(chặn Choáng/Đóng Băng/Ngủ/Mị/Mù; không chặn Giảm Hồi Máu trừ Pet miễn toàn diện)*.',
              '• **Trần Debuff Lên Địch:** `Giảm ATK` (**`65%`**) • `Giảm SPD` (**`75%`**) • `Giảm ST Đầu Ra` (**`50%`**) • `Giảm Chính Xác / Mù` (**`45%`**) • `Giảm Tỉ Lệ HAX` *(còn tối thiểu `25%` hiệu lực)*.',
            ].join('\n'),
            inline: false,
          },
          {
            name: `${em('su_thunder_hax')} DoT, Bất Tử / Tịch Diệt, Khóa HAX & Ultimate`,
            value: [
              '• **DoT Đa Nguồn & Kháng:** Độc / Thiêu Đốt cộng dồn đa nguồn đến trần **`28%` MaxHP/hiệp**; giảm bởi **`Kháng Độc/Đốt`** *(trần **`95%`**)*.',
              '• **Bất Tử, Miễn Tử, Tái Sinh & `Tịch Diệt`:** **Bất Tử theo đòn** *(mất từng hit)* vs **Bất Tử theo hiệp** *(miễn 100% mọi đòn, DoT, Phản Đòn, Nổ Khiên trọn hiệp)*; **Miễn Tử** giữ HP khi chí tử; **Tái Sinh** hồi sinh; **`Tịch Diệt`** khóa cả Bất Tử & Hồi Sinh.',
              '• **`Khóa HAX` • `Cấm/Giải Buff` • `Liên Hoàn Đòn` • `Ultimate`:** Chặn nội tại/buff theo hiệp; 40 Chân Thần (`/tienhoa`) tích nạp & tung lại **Skill Ultimate** sau Cooldown (`4–6 hiệp`).',
            ].join('\n'),
            inline: false,
          },
          {
            name: `${em('explorer_world_map_v14')} Buff SET & Thuận Hệ Địa Hình`,
            value: [
              '• **Buff SET 2 Tầng (Không Cộng Dồn):** Đếm theo số món cùng Hệ `(1 Pet + 3 Pháp Bảo + 1 Linh Vực)`: Full Hệ Thường `4/4` (**+8%**), `5/5` (**+12%**); Set Thần Thoại `2/3/4/5` (**+6/+12/+18/+25%** toàn chỉ số, mốc `5/5` thêm **+10% Xuyên DEF** & **+1 Linh Mạch**).',
              '• **Thuận Hệ Địa Hình (`/explorer`):** Pet hoặc Linh Vực khớp Hệ của Map nhận **`+6%` Tỉ Lệ Sống Sót** & **`+10%` Linh Thạch**.',
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
export function getWikiSubHubList(categoryId, rawSubhub = 'all', page = 1) {
  const cat = String(categoryId || '').trim().toLowerCase();
  const sub = String(rawSubhub || 'all').trim().toLowerCase();
  const pageSize = 15;
  const lt = em('su_linhthach');

  if (cat === 'pets') {
    const publicPets = PET_CATALOG.filter((p) => !p.is_exclusive_fuyumi);
    let filtered = publicPets;
    let heading = 'TẤT CẢ LINH THÚ CÔNG KHAI';
    if (sub === 'unique' || sub === 'kemonomimi') {
      filtered = publicPets.filter((p) => p.is_unique);
      heading = '40 TỐI THƯỢNG ĐỘC NHẤT TOÀN SERVER (TIẾN HÓA CHÂN THẦN)';
    } else if (['mythic', 'epic', 'rare', 'common'].includes(sub)) {
      filtered = publicPets.filter((p) => p.rarity_key === sub && (sub !== 'mythic' || !p.is_unique));
      heading = `PHẨM CHẤT ${(RARITY_TIERS[sub]?.label || sub).toUpperCase()}`;
    }

    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const safePage = Math.min(Math.max(1, Math.floor(Number(page) || 1)), totalPages);
    const slice = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
    const lines = slice.map((p) => {
      const rKey = resolveEntityDisplayRarityKey(p, false);
      return `• ${petEmoji(p.pet_type, p.icon)} \`${p.pet_type}\` **${p.pet_name}** — ${tierEmoji(rKey)} *${p.rarity}* (${elementEmoji(p.element)} ${p.element})`;
    });
    return {
      success: true,
      category: 'pets',
      subhub: sub,
      heading,
      total_items: filtered.length,
      page: safePage,
      total_pages: totalPages,
      prev_page: safePage > 1 ? safePage - 1 : totalPages,
      next_page: safePage < totalPages ? safePage + 1 : 1,
      items: slice,
      embed_flat: {
        title: `${em('su_pet_paw')} CẨM NANG LINH THÚ — ${heading} (${safePage}/${totalPages})`,
        description: [
          `Tổng cộng **${filtered.length}** Linh Thú *(dùng \`/info\` hoặc menu chọn bên dưới để xem chi tiết & chỉ số)*:`,
          '',
          ...lines,
        ].join('\n'),
        color: '#ec4899',
        image_url: '',
      },
    };
  }

  if (cat === 'domains') {
    const pubs = [
      ...DOMAIN_CATALOG.filter((d) => !d.is_exclusive_fuyumi),
      ...DIVINE_SENSE_CATALOG.filter((s) => !s.is_exclusive_fuyumi),
      ...DIVINE_REALM_CATALOG.filter((r) => !r.is_exclusive_fuyumi),
    ];
    let filtered = pubs;
    let heading = 'LINH VỰC • THẦN THỨC • THẦN CẢNH';
    if (['domain', 'sense', 'realm'].includes(sub)) {
      filtered = pubs.filter((x) => x.entity_kind === sub);
      heading = sub === 'domain' ? 'LINH VỰC CHIẾN TRƯỜNG' : sub === 'sense' ? 'THẦN THỨC CẢNH GIỚI' : 'THẦN CẢNH ĐẠO VỰC';
    }
    const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
    const safePage = Math.min(Math.max(1, Math.floor(Number(page) || 1)), totalPages);
    const slice = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
    const lines = slice.map((d) => {
      const rKey = resolveEntityDisplayRarityKey(d, false);
      const kindTag = d.entity_kind === 'domain' ? 'Vực' : d.entity_kind === 'sense' ? 'Thức' : 'Cảnh';
      return `• ${d.icon} \`${d.id}\` **${d.name}** — ${tierEmoji(rKey)} *${d.rarity}* [${kindTag}]`;
    });
    return {
      success: true,
      category: 'domains',
      subhub: sub,
      heading,
      total_items: filtered.length,
      page: safePage,
      total_pages: totalPages,
      prev_page: safePage > 1 ? safePage - 1 : totalPages,
      next_page: safePage < totalPages ? safePage + 1 : 1,
      items: slice,
      embed_flat: {
        title: `${em('su_realm_star')} CẨM NANG LÃNH ĐỊA — ${heading} (${safePage}/${totalPages})`,
        description: [
          `Tổng cộng **${filtered.length}** món *(tỉ lệ \`/roll loai:domain\`: 34% Vực • 33% Thức • 33% Cảnh)* • Đọc giá ${lt}:`,
          '',
          ...lines,
        ].join('\n'),
        color: '#a855f7',
        image_url: '',
      },
    };
  }
  return null;
}

export function getWikiData(categoryId = null, page = 1, subhub = null) {
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

  if ((resolvedId === 'pets' || resolvedId === 'domains') && subhub) {
    const subRes = getWikiSubHubList(resolvedId, subhub, page);
    if (subRes) {
      return {
        ...subRes,
        ...WIKI_METADATA,
        data: WIKI_CATEGORIES[resolvedId],
      };
    }
  }

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
  if ((!Number.isFinite(requestedPage) || requestedPage < 1) && /^(glossary|roles)_(\d+)$/.test(raw)) {
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

  const prevPage = currentPage > 1 ? currentPage - 1 : totalPages;
  const nextPage = currentPage < totalPages ? currentPage + 1 : 1;

  let flatTitle = hasPages ? `${catObj.title} — Trang ${currentPage}/${totalPages}` : catObj.title;
  if (resolvedId === 'roles') {
    if (currentPage === 1) flatTitle = `${em('su_medal_role')} Role Quyền Năng — Trang 1/2: Role Cao Cấp`;
    else if (currentPage === 2) flatTitle = `${em('su_medal_role')} Role Quyền Năng — Trang 2/2: Role Phàm & Cảnh Giới`;
    else if (currentPage === 3) flatTitle = `${em('su_pin_sigil')} Chi Tiết Chức Năng Role & Phạm Vi Buff`;
  }

  return {
    success: true,
    ...WIKI_METADATA,
    category: resolvedId,
    page: currentPage,
    total_pages: totalPages,
    prev_page: prevPage,
    next_page: nextPage,
    pages: hasPages ? catObj.pages : undefined,
    data: catObj,
    embed_flat: {
      title: flatTitle,
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
  const publicDomains = DOMAIN_CATALOG.filter((d) => !d.is_exclusive_fuyumi);
  const publicSenses = DIVINE_SENSE_CATALOG.filter((s) => !s.is_exclusive_fuyumi);
  const publicRealms = DIVINE_REALM_CATALOG.filter((r) => !r.is_exclusive_fuyumi);
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
      unique: standardPets.filter((p) => p.is_unique),
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

  const descriptionLines = [
    `• **Mã ID:** \`${item.item_id}\` • **Trang bị:** \`/equip loai:item ma_id:${item.item_id}\``,
  ];
  if (item.is_unique && currentOwner) {
    descriptionLines.push(`${tierEmoji('supreme')} **Chủ sở hữu:** **${currentOwner.username}** (<@${currentOwner.user_id}>)`);
  }

  const imageUrl = `${PUBLIC_BASE_URL}/api/wiki/item/${item.item_id}.webp?v=1.7-s7`;

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

async function resolveMythicPetOwner(petType) {
  if (!supabase) return null;
  try {
    const { data: ownership } = await supabase
      .from('user_pets')
      .select('user_id, is_evolved')
      .eq('pet_type', petType)
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
      is_evolved: Boolean(ownership.is_evolved),
    };
  } catch (err) {
    console.warn(`[WikiService] Failed to query mythic pet owner for ${petType}:`, err.message);
    return null;
  }
}

/**
 * Tra cứu chi tiết 1 Linh Thú theo mã pet_type (ẩn pet độc quyền Fuyumi khỏi /wiki)
 */
export async function getWikiPetDetail(petType, options = {}) {
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
  const currentOwner = pet.is_unique ? await resolveMythicPetOwner(pet.pet_type) : null;
  const evoData = V17_PET_EVOLUTIONS[pet.pet_type] || null;
  const canToggleForm = Boolean(evoData);
  const isEvoForm = canToggleForm && String(options.form || '').toLowerCase() === 'evo';
  const activeForm = isEvoForm ? 'evo' : 'base';
  const nextForm = isEvoForm ? 'base' : 'evo';

  const dispKey = isEvoForm ? 'evolved_supreme' : resolveEntityDisplayRarityKey(pet, false);
  const tier = RARITY_TIERS[dispKey] || RARITY_TIERS[pet.rarity_key] || RARITY_TIERS.common;

  const dispAtk = isEvoForm ? Math.round(Number(pet.base_atk || 0) * Number(evoData?.stat_mult?.atk || 1)) : pet.base_atk;
  const dispDef = isEvoForm ? Math.round(Number(pet.base_def || 0) * Number(evoData?.stat_mult?.def || 1)) : pet.base_def;
  const dispSpd = isEvoForm ? Math.round(Number(pet.base_spd || 0) * Number(evoData?.stat_mult?.spd || 1)) : pet.base_spd;
  const dispHp = isEvoForm ? Math.round(Number(pet.base_hp || 0) * Number(evoData?.stat_mult?.hp || 1)) : pet.base_hp;
  const dispName = isEvoForm && evoData ? evoData.evolved_name : pet.pet_name;
  const dispRarity = isEvoForm ? 'Tối Thượng Chân Thần' : pet.rarity;

  const evoHint = canToggleForm && !isEvoForm && evoData
    ? `${tierEmoji('evolved_supreme')} **Tiến Hóa (\`/tienhoa\`):** **${evoData.evolved_name}** *(Bấm nút bên dưới để xem Splash & Ultimate)*`
    : null;

  const ownerMentionLine = pet.is_unique && currentOwner
    ? `${tierEmoji('unique_supreme')} **Chủ sở hữu:** **${currentOwner.username}** (<@${currentOwner.user_id}>)${currentOwner.is_evolved ? ' • *Đã Tiến Hóa Chân Thần*' : ''}`
    : null;

  const descriptionLines = [
    `• **Mã ID:** \`${pet.pet_type}\` • **Xuất trận:** \`/linhthu hanh_dong:active linh_thu:${pet.pet_type}\``,
  ];
  if (evoHint) descriptionLines.push(evoHint);
  if (ownerMentionLine) descriptionLines.push(ownerMentionLine);

  const imageUrl = canToggleForm
    ? `${PUBLIC_BASE_URL}/api/wiki/pet/${pet.pet_type}.webp?v=1.7-s7&form=${activeForm}`
    : `${PUBLIC_BASE_URL}/api/wiki/pet/${pet.pet_type}.webp?v=1.7-s7`;
  const formFooter = canToggleForm
    ? (isEvoForm
      ? 'Đang xem: Tiến Hóa Chân Thần • Bấm nút bên dưới để chuyển Bản Thường'
      : 'Đang xem: Bản Thường • Bấm nút bên dưới để xem Tiến Hóa Chân Thần')
    : '';

  return {
    success: true,
    can_toggle_form: String(canToggleForm),
    current_form: activeForm,
    toggle_target_form: nextForm,
    entity_id: pet.pet_type,
    data: {
      ...pet,
      current_owner: currentOwner,
      owner_label: pet.is_unique ? (currentOwner ? currentOwner.username : 'Chưa có chủ sở hữu') : null,
      evo_data: evoData,
      image_url: imageUrl,
    },
    embed: {
      title: `${petEmoji(pet.pet_type, pet.icon, isEvoForm || Boolean(currentOwner?.is_evolved))} ${dispName}`.trim(),
      description: descriptionLines.join('\n'),
      color: tier.color,
      color_dec: tier.colorDec,
      image_url: imageUrl,
      footer: formFooter,
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
  let item = DOMAIN_CATALOG.find((d) => d.domain_id === cleanId);
  if (item) {
    entityKind = 'domain';
  } else {
    item = DIVINE_SENSE_CATALOG.find((s) => s.sense_id === cleanId);
    if (item) {
      entityKind = 'sense';
    } else {
      item = DIVINE_REALM_CATALOG.find((r) => r.realm_id === cleanId);
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

  const dropRateMap = { common: '60.35%', rare: '25%', epic: '14%', mythic: '0.65%' };
  const dropRate = dropRateMap[item.rarity_key] || '0.65%';
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
      lines.push(`${em('dao_ap_crest')} **Đạo Áp (${item.is_unique ? 'Cấp 2+' : 'Cấp 2'} — ${item.dao_ap.durationTurns} hiệp):** Kích hoạt ở hiệp kế tiếp sau khi đánh vỡ Vực địch — ${item.dao_ap.label}`);
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
