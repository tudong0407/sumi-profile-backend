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
  em,
  tierEmoji,
  realmEmoji,
  elementEmoji,
  domainElementEmoji,
  itemEmoji,
  petEmoji,
  levelMilestoneEmoji,
} from '../config/emojiHelper.js';

export const VALID_CATEGORIES = ['overview', 'realms', 'battle', 'equipment', 'pets', 'economy', 'explorer'];

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
  kham_pha: 'explorer',
  ban_do: 'explorer',
  map: 'explorer',
  dai_luc: 'explorer',
};

export const WIKI_METADATA = {
  title: 'Cẩm Nang Tu Tiên SuMi Family',
  subtitle: 'Cẩm nang v1.5 • Tu Tiên • Linh Thú • Pháp Bảo • Set Buff • Pity 350 • Top Chat/Voice',
  version: '1.5',
  guild: 'SuMi Family (1026096141273661450)',
  guild_id: '1026096141273661450',
  bot: 'Nhiễm Nhiễm (916469360401453067)',
  bot_id: '916469360401453067',
  owner: 'Fuyumi (757091869183311872)',
  owner_id: FUYUMI_USER_ID,
  theme_color: '#ec4899',
  theme_color_dec: 15485081,
  updated_at: '2026-11-24T00:00:00.000Z',
  total_categories: 7,
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
        heading: '2. Bộ Lệnh Tu Tiên & Tiện Ích Server (v1.5)',
        content: '• Hồ sơ: /profile, /rank, /exp, /doiqua.\n• Chiến đấu: /battle, /linhvuc, /party, /linhmach, /nhiemvu.\n• Gacha & Kho: /roll, /autosell, /shop, /inv, /phapbao, /linhthu, /pet, /roles, /equip, /unequip, /enchant, /dismantle.\n• Kinh tế & Cộng đồng: /daily, /job, /farm, /exchange, /explorer, /tangqua, /marry, /divorce, /giatoc, /top, /coinflip, /blackjack, /slots, /crash.\n• Tra cứu & Tiện ích: /wiki, /info, /updates • /play, /queue, /music, /sound • /giveaway_create, /giveaway_end, /giveaway_list, /giveaway_cancel, /giveaway_check • /sticky-set, /sticky-off.',
      },
    ],
    fields: [
      {
        name: `${em('su_sprout')} Khởi Đầu`,
        value: '• Tự tạo hồ sơ khi Chat (`23–35 EXP/45s`) hoặc Voice (`85–135 EXP/5p`).\n• Tặng sẵn Pet **Hóa Thạch Nham Nham Thú** *(120 ATK / 180 DEF / 100 SPD)* & 1 Slot Role.',
        inline: false,
      },
      {
        name: `${em('su_pin_sigil')} Lệnh Tu Tiên (v1.5)`,
        value: [
          '• **Hồ sơ:** `/profile` • `/rank` • `/exp` *(xem Boost)* • `/doiqua` *(đổi EXP→LT)*',
          '• **Chiến đấu:** `/battle` • `/linhvuc` • `/party` • `/linhmach` • `/nhiemvu` *(Tháp 500 tầng)*',
          '• **Kho & Gacha:** `/roll` • `/autosell` • `/shop` • `/inv` • `/phapbao` • `/linhthu` • `/pet` • `/roles` • `/equip` • `/unequip` • `/enchant` • `/dismantle`',
          '• **Kinh tế & Xã hội:** `/daily` • `/job` • `/farm` • `/exchange` • `/explorer` • `/tangqua` • `/marry` • `/divorce` • `/giatoc` • `/top`',
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
        content: '• Chat: 23–35 EXP/tin (45s) • Voice: 85–135 EXP/5p (chấm công 12p) • Công thức: 60 × Level^1.45 (max 500.000 EXP). Dùng /exp xem chi tiết Boost.\n• Mốc Level: Lv.5 (+3% EXP), Lv.15 (+5%), Lv.20 (+8% EXP/+5% LT), Lv.35 (+12%/+10%), Lv.45 (+15%/+10%/+5% Pet), Lv.60 (+20%/+15%/+8%), Lv.80 (+30%/+25%/+12%), Lv.100 Trảm Quyết Tối Thượng (+50%/+50%/+20%).',
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
        value: '• **Chat:** `23–35 EXP` / tin *(cooldown 45s)* • **Voice:** `85–135 EXP` / 5p *(chấm công 12p)*.\n• **Cần lên cấp:** `60 × Level^1.45` *(trần `500.000 EXP`)* • Tra tổng boost bằng `/exp`.',
        inline: false,
      },
      {
        name: `${em('su_medal_role')} Mốc Level Role & Quyền Cơ Bản Discord`,
        value: [
          `• ${levelMilestoneEmoji(5)} \`Lv.5\` (+3% EXP): Gửi ảnh/tệp • ${levelMilestoneEmoji(15)} \`Lv.15\` (+5% EXP): Emoji Nitro liên server`,
          `• ${levelMilestoneEmoji(20)} \`Lv.20\` (+8% EXP, +5% LT): Nhúng liên kết & Lập Gia Tộc • ${levelMilestoneEmoji(35)} \`Lv.35\` (+12%/+10%): Stream`,
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
        content: '• Thứ tự: Lôi Quang Tốc > Final SPD; HP = (Lv × 1.000) + (Final DEF × 5) + Bonus HP; max 30 hiệp.\n• Discord hiện Hiệp 1/5/10/15/20 & Kết; bấm Xem Nhật Ký Trận Đấu để xem đủ từng hiệp trên Web (lưu 48h).\n• Linh Vực (/linhvuc) vào trận từ Hiệp 2 (Kiếm → Huyễn → Trận → Minh → Thánh → Kiếm); Thần Thoại có Đạo Áp Cấp 2.\n• /party & /linhmach: Mở 6 khung giờ vàng (08/12/18/20/21/22h), chia 6–56 LT/phút.',
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
          `• **Cơ chế:** Khi 2 Vực giằng co, mỗi bên nhận Buff sân nhà (trừ *Xuyên Kháng*); **Thần Thức** tăng Mạch/Buff, **Thần Cảnh** tăng Debuff. ${em('dao_ap_crest')} **Đạo Áp (\`1–3 hiệp\`)** kích hoạt khi Vực Thần Thoại phá Vực địch.`,
          `• **Buff SET (2 Tầng Không Cộng Dồn):** Full Hệ \`4/4\` (**+8%**) • \`5/5\` (**+12%** toàn chỉ số); Set Thần Thoại cùng hệ \`2/3/4/5\` (**+6/+12/+18/+25%** toàn chỉ số, \`5/5\` thêm **+10% Xuyên Giáp** & **+1 Linh Mạch**).`,
        ].join('\n'),
        inline: false,
      },
      {
        name: `${em('su_crossed_swords')} Luật /battle, Web Logs & /linhmach`,
        value: [
          '• **1v1 (`/battle [@user]`):** PvP `15 trận/ngày`, PvE Tự Do `25 trận/ngày` (`+10 / -5 LT`) • Max **30 hiệp**, cooldown `5s`.',
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

  economy: {
    id: 'economy',
    title: `${em('su_linhthach')} Kinh Tế, Nhiệm Vụ, Tháp 500 & Nông Trại`,
    icon: em('su_linhthach'),
    description: '/daily, /job, /roll, /autosell, /shop, /nhiemvu (Tháp 500 tầng +15% LT), /farm, Minigame, /marry & /giatoc.',
    image_url: '',
    sections: [
      {
        heading: '1. Kiếm LT, Gacha & Cửa Hàng',
        content: '• /daily (40–60 LT + Streak 7d) • /job (6 nghề, 8 ca/ngày, +35–75 LT) • /doiqua (1.000 EXP → 10 LT) • Lên cấp +50..+400 LT.\n• /roll (50 LT/lượt, 450/10, Pity Thần Thoại 350) hỗ trợ /autosell.\n• /shop (7 quầy + Shop Ngày giảm 15–40%): Nền & Viền đã sở hữu tự Equip 0 LT ngay trong /shop (ẩn khỏi /inv). Xác nhận /updates v1.5 nhận +2.000 LT!',
      },
      {
        heading: '2. Nhiệm Vụ Ngày, Tháp 500 Tầng (+15% LT), Nông Trại & Cộng Đồng',
        content: '• /nhiemvu: 5 Quest Ngày xoay vòng (mốc 5/5 +130 LT + quà), 3 Hợp Đồng Tuần & Tháp 500 Tầng (1k → 125k Lực, thưởng LT mỗi tầng tăng +15%, NPC mở Linh Vực từ F70).\n• /top loai:chat|voice trao 500/400/300 LT mỗi ngày lúc 00:00 UTC+7 • /farm & /exchange • Minigame (10–10.000 LT) • /marry & /giatoc.',
      },
    ],
    fields: [
      {
        name: `${em('su_linhthach')} Linh Thạch, /job, Gacha & Cửa Hàng`,
        value: [
          '• `/daily` • `/job` *(6 nghề, 8 ca/ngày)* • `/doiqua` (`1.000 EXP → 10 LT`) • Đọc xác nhận `/updates` v1.5 nhận **+2.000 LT**.',
          '• `/roll` (`50 LT/lượt`, `450/10`, Pity **350**) kèm **`/autosell`** • `/dismantle` • `/enchant` (`+0/+8/+18/+32/+50%`).',
          '• `/shop` *(7 quầy + Shop Ngày)*: Đá Khắc Ấn (`150 LT`, 5/ngày), Thẻ Reset Tháp (`200 LT`, 5/ngày, max 15) • Nền & Viền đã mua đổi **0 LT** ngay trong `/shop`.',
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
          '• **`/farm` & `/exchange`:** 4–6 ô (`6/12/24h`), đổi Linh Quả lấy LT, Đá Khắc Ấn, Tinh Thạch, Vé Gacha, Thẻ Reset.',
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

  const catObj = WIKI_CATEGORIES[resolvedId];
  const colorMap = {
    overview: '#ec4899',
    realms: '#a855f7',
    battle: '#f43f5e',
    equipment: '#f59e0b',
    pets: '#ec4899',
    economy: '#10b981',
    explorer: '#10b981',
  };
  const fieldLines = Array.isArray(catObj.fields) && catObj.fields.length > 0
    ? catObj.fields.map((f) => `**${f.name}**\n${f.value}`).join('\n\n')
    : '';
  let flatDesc = [catObj.description ? `*${catObj.description}*` : '', fieldLines].filter(Boolean).join('\n\n');
  if (flatDesc.length > 3950) flatDesc = `${flatDesc.slice(0, 3940)}\n…`;

  return {
    success: true,
    ...WIKI_METADATA,
    category: resolvedId,
    data: catObj,
    embed_flat: {
      title: catObj.title,
      description: flatDesc,
      image_url: catObj.image_url || '',
      color: colorMap[resolvedId] || '#ec4899',
    },
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
