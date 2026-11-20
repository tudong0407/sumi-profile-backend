/**
 * src/services/wikiService.js
 * Dữ liệu Cẩm Nang Tu Tiên SuMi Family chuẩn hóa (6 chuyên mục độc lập + tra cứu chi tiết 45 Pháp Bảo & 20 Linh Thú tiêu chuẩn).
 * Văn phong chuyên nghiệp, súc tích, không lời chào hỏi rườm rà.
 * Lưu ý: Không liệt kê hoặc nhắc đến pet độc quyền Cửu Vĩ Hồng Hồ trên /wiki.
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

export const VALID_CATEGORIES = ['overview', 'realms', 'battle', 'equipment', 'pets', 'economy'];

const CATEGORY_ALIASES = {
  beginner: 'overview',
  tong_quan: 'overview',
  canh_gioi: 'realms',
  dau_truong: 'battle',
  trang_bi: 'equipment',
  linh_thu: 'pets',
  kinh_te: 'economy',
};

export const WIKI_METADATA = {
  title: 'Cẩm Nang Tu Tiên SuMi Family',
  subtitle: 'Toàn thư hệ thống Tu Tiên • Linh Thú • Pháp Bảo • Đấu Trường',
  version: '2.0.0',
  guild: '🦊𝗦𝘂𝗠𝗶 𝗙𝗮𝗺𝗶𝗹𝘆 (1026096141273661450)',
  guild_id: '1026096141273661450',
  bot: 'Nhiễm Nhiễm (916469360401453067)',
  bot_id: '916469360401453067',
  owner: 'Fuyumi (757091869183311872)',
  owner_id: FUYUMI_USER_ID,
  theme_color: '#ec4899',
  theme_color_dec: 15485081,
  updated_at: '2026-11-20T14:30:00.000Z',
  total_categories: 6,
};

export const WIKI_CATEGORIES = {
  overview: {
    id: 'overview',
    title: '📜 Tổng Quan Tu Tiên',
    icon: '📜',
    description: 'Giới thiệu nhanh hệ thống tu tiên, khởi đầu tân thủ và danh sách lệnh cốt lõi.',
    image_url: '',
    sections: [
      {
        heading: '1. Khởi Đầu Tân Thủ',
        content: '• Trạng thái mặc định: Cấp 1 • 0 EXP • 0 Linh Thạch • 1 Slot Role.\n• Linh Thú khởi đầu: Hóa Thạch Nham Nham Thú (Phàm Phẩm • Hệ Thổ • 120 ATK / 180 DEF / 100 SPD) cấp sẵn để tham chiến ngay.\n• Tích lũy EXP tự động khi nhắn tin và hoạt động trong kênh thoại.',
      },
      {
        heading: '2. Lệnh Cốt Lõi',
        content: '• /profile [user]: Thẻ hồ sơ Full HD+ (2000×1000) — Cảnh giới, Pet, 3 Slot Pháp Bảo, Role Quyền Năng.\n• /rank [user]: Thẻ tiến độ cấp độ Full HD+ (2000×410).\n• /battle [doi_thu]: Thách đấu Linh Thú 1v1, trả trực tiếp Ảnh Chiến Báo Full HD+.\n• /wiki: Tra cứu toàn thư tương tác qua Dropdown Menu.',
      },
    ],
    fields: [
      {
        name: '🌱 Khởi Đầu Tân Thủ',
        value: '• Mặc định: **Lv.1 • 0 EXP • 0 Linh Thạch • 1 Slot Role**.\n• Pet khởi đầu: **Hóa Thạch Nham Nham Thú** *(Phàm Phẩm • Hệ Thổ • 120 ATK / 180 DEF / 100 SPD)*.\n• Tự động khởi tạo hồ sơ khi tương tác Chat / Voice.',
        inline: false,
      },
      {
        name: '📌 Lệnh Cốt Lõi',
        value: '• `/profile [user]` — Thẻ hồ sơ Full HD+ (`2000×1000`).\n• `/rank [user]` — Thẻ cấp độ Mini (`2000×410`).\n• `/battle [doi_thu]` — Đấu trường 1v1 bằng Ảnh Chiến Báo.\n• `/wiki` — Cẩm nang tương tác theo chuyên mục.',
        inline: false,
      },
    ],
    content: 'Hệ thống tu tiên SuMi Family vận hành theo 4 trụ cột: Cày EXP đột phá cảnh giới, bồi dưỡng Linh Thú, săn 45 Pháp Bảo Loadout và tranh tài tại Đấu Trường 1v1. Chọn chuyên mục bên dưới để xem chi tiết.',
  },

  realms: {
    id: 'realms',
    title: '🌌 Hệ Thống Cảnh Giới & Thăng Cấp',
    icon: '🌌',
    description: '7 Đại Cảnh Giới (Lv.1–100), công thức EXP, mốc Role cấp độ và mở khóa Slot Role.',
    image_url: '',
    sections: [
      {
        heading: '1. Bảy Đại Cảnh Giới & Mở Khóa Slot Role',
        content: '• I. Luyện Khí Sơ Kỳ (Lv.1–19) — 1 Slot Role\n• II. Trúc Cơ Đạo Cảnh (Lv.20–39) — 2 Slot Role\n• III. Kim Đan Đại Đạo (Lv.40–59) — 3 Slot Role • Viền Tử Kim\n• IV. Nguyên Anh Chân Quân (Lv.60–79) — 4 Slot Role\n• V. Hóa Thần Tiên Tôn (Lv.80–89) — 5 Slot Role\n• VI. Đại Thừa Vô Cực (Lv.90–99) — 5 Slot Role\n• VII. Hỗn Độn Chúa Tể (Lv.100) — Đỉnh cao tối thượng',
      },
      {
        heading: '2. Cơ Chế Tích Lũy EXP & Công Thức',
        content: '• Chat: 15–25 EXP / tin nhắn hợp lệ (cooldown 45 giây).\n• Voice: 50–100 EXP mỗi 5 phút hoạt động trong kênh thoại.\n• Công thức thăng cấp: 100 × (Level ^ 1.8), trần 500.000 EXP tại Lv.100.\n• Buff EXP: « Linh Hồn Tu Luyện » (+15% EXP), « Cửu Vĩ Yêu Hậu » (+80% EXP).',
      },
      {
        heading: '3. Mốc Level Roles Tự Động',
        content: 'Lv.5 U Linh Chớm Nở → Lv.15 Linh Cáo Học Giả → Lv.20 Linh Cáo Tinh Anh → Lv.35 Yêu Hồ Nguyệt Ảnh → Lv.45 Huyễn Linh Thú → Lv.60 Thiên Hồ Viễn Cổ → Lv.80 Chi Linh Thánh Đế → Lv.100 Hỗn Độn Chúa Tể.',
      },
    ],
    fields: [
      {
        name: '🏔️ 7 Đại Cảnh Giới & Mở Khóa Slot Role',
        value: '• **I. Luyện Khí Sơ Kỳ** (`Lv.1–19`) • 1 Slot • Viền Bạch Ngọc\n• **II. Trúc Cơ Đạo Cảnh** (`Lv.20–39`) • 2 Slot\n• **III. Kim Đan Đại Đạo** (`Lv.40–59`) • 3 Slot • Viền Tử Kim\n• **IV. Nguyên Anh Chân Quân** (`Lv.60–79`) • 4 Slot\n• **V. Hóa Thần Tiên Tôn** (`Lv.80–89`) • 5 Slot\n• **VI. Đại Thừa Vô Cực** (`Lv.90–99`) • 5 Slot\n• **VII. Hỗn Độn Chúa Tể** (`Lv.100`) • Đỉnh cao tối thượng',
        inline: false,
      },
      {
        name: '⚡ Nguồn EXP & Công Thức',
        value: '• **Chat**: `15–25 EXP` / tin *(cooldown 45s)*.\n• **Voice**: `50–100 EXP` / `5 phút` hoạt động.\n• **Mốc EXP**: `100 × (Level ^ 1.8)` *(trần 500.000 ở Lv.100)*.\n• **Buff**: `Linh Hồn Tu Luyện` (+15%) • `Cửu Vĩ Yêu Hậu` (+80%).',
        inline: false,
      },
      {
        name: '🏅 Mốc Level Roles',
        value: '`Lv.5` → `Lv.15` → `Lv.20` → `Lv.35` → `Lv.45` → `Lv.60` → `Lv.80` → `Lv.100`',
        inline: false,
      },
    ],
    content: 'Lộ trình tu luyện gồm 7 đại cảnh giới từ Lv.1 đến Lv.100. Đạt mốc cảnh giới tự động mở khóa thêm Slot Role Quyền Năng và nâng cấp viền Avatar trên `/profile` & `/rank`.',
  },

  battle: {
    id: 'battle',
    title: '🥋 Đấu Trường & Ngũ Hành Tương Khắc',
    icon: '🥋',
    description: 'Quy tắc 1v1, sơ đồ vòng xoay Ngũ Hành và Tứ Đại Dị Tố đặc thù.',
    image_url: `${PUBLIC_BASE_URL}/api/wiki/chart/elements.png`,
    sections: [
      {
        heading: '1. Vòng Xoay Ngũ Hành',
        content: '• Kim ➜ Mộc ➜ Thổ ➜ Thủy ➜ Hỏa ➜ Kim.\n• Thuận khắc: +30% sát thương (×1.30).\n• Bị khắc: -20% sát thương gây ra (×0.80).',
      },
      {
        heading: '2. Tứ Đại Dị Tố Đặc Thù',
        content: '• Lôi: Khắc mạnh Thủy & Kim (+30% DMG); Thủy/Kim đánh Lôi giảm -20%.\n• Ám ⚔️ Quang: Tương sát lưỡng cực (+25% DMG hai chiều).\n• Hỗn Độn / Hư Không: Ngoài ngũ hành, không bị khắc, +20% sát thương chuẩn xuyên giáp & -15% sát thương nhận vào.',
      },
      {
        heading: '3. Quy Tắc 1v1 (/battle)',
        content: '• Ưu tiên ra đòn: HAX Lôi Quang Tốc > Final SPD cao hơn.\n• Công thức HP chiến đấu: (Lv × 1.000) + (Final DEF × 5) + Bonus HP.\n• Giới hạn 20 hiệp; hết hiệp bên còn nhiều HP hơn giành chiến thắng.',
      },
    ],
    fields: [
      {
        name: '🌀 Ngũ Hành Tương Khắc',
        value: '`Kim ➜ Mộc ➜ Thổ ➜ Thủy ➜ Hỏa ➜ Kim`\n• Thuận khắc: **+30% DMG** (`×1.30`) • Bị khắc: **-20% DMG** (`×0.80`).',
        inline: false,
      },
      {
        name: '⚡ Dị Tố Đặc Thù',
        value: '• **Lôi**: Khắc Thủy & Kim (`+30% DMG`).\n• **Ám ⚔️ Quang**: Tương sát lưỡng cực (`+25% DMG`).\n• **Hỗn Độn / Hư Không**: Ngoài ngũ hành, `+20%` xuyên giáp & `-15%` sát thương nhận vào.',
        inline: false,
      },
      {
        name: '⚔️ Luật Đấu Trường 1v1',
        value: '• Thứ tự đánh: `Lôi Quang Tốc` > `Final SPD` cao hơn.\n• `HP = (Lv × 1.000) + (DEF × 5) + Bonus HP` • Tối đa **20 hiệp**.',
        inline: false,
      },
    ],
    content: 'Dùng `/battle [doi_thu]` để khiêu chiến Linh Thú 1v1 và nhận trực tiếp Ảnh Chiến Báo Full HD+. Xem sơ đồ tương khắc nguyên tố trực quan bên dưới.',
  },

  equipment: {
    id: 'equipment',
    title: '⚔️ Trang Bị Loadout (45 Pháp Bảo)',
    icon: '⚔️',
    description: '3 Slot trang bị (15 Vũ Khí, 15 Bảo Ngọc, 15 Chiến Hồn), tỉ lệ rớt và quy tắc 9 Pháp Bảo Thần Thoại Độc Nhất.',
    image_url: '',
    sections: [
      {
        heading: '1. Cấu Trúc 3 Slot Loadout',
        content: '• Vũ Khí (15 món): Tăng ATK, SPD và tỉ lệ bạo kích CRIT.\n• Bảo Ngọc (15 món): Tăng DEF, HP tối đa và khiên hộ mệnh.\n• Chiến Hồn (15 món): Tăng chỉ số tổng hợp và kích hoạt thiên phú HAX.',
      },
      {
        heading: '2. Tỉ Lệ Rớt & Quy Tắc Độc Nhất Toàn Server',
        content: '• Phàm Phẩm: 60% • Linh Phẩm: 25% • Tiên Phẩm: 14% • Thần Thoại: 1%.\n• 9 Pháp Bảo Thần Thoại (1%) là Độc Nhất Toàn Server: mỗi món chỉ có duy nhất 1 chủ sở hữu tại một thời điểm.',
      },
    ],
    fields: [
      {
        name: '🛡️ 3 Nhóm Pháp Bảo',
        value: '• ⚔️ **Vũ Khí** (15 món): `ATK • SPD • CRIT`\n• 💎 **Bảo Ngọc** (15 món): `DEF • HP • Khiên`\n• 🦊 **Chiến Hồn** (15 món): `ATK • DEF • SPD • HAX`',
        inline: true,
      },
      {
        name: '🎲 Tỉ Lệ Rớt',
        value: '• ⚪ Phàm Phẩm: **60%**\n• 🔵 Linh Phẩm: **25%**\n• 🟣 Tiên Phẩm: **14%**\n• 🔴 Thần Thoại: **1%** *(Độc Nhất)*',
        inline: true,
      },
      {
        name: '👑 Quy Tắc Độc Nhất (9 Món Thần Thoại)',
        value: 'Mỗi pháp bảo Thần Thoại chỉ tồn tại **duy nhất 1 bản trên toàn server**. Chọn trực tiếp món đồ ở **3 Dropdown bên dưới** để xem thẻ chỉ số Full HD+ và Chủ Sở Hữu hiện tại.',
        inline: false,
      },
    ],
    content: 'Chọn một pháp bảo từ 3 danh mục **Vũ Khí / Bảo Ngọc / Chiến Hồn** bên dưới để xem thẻ chi tiết Full HD+ (chỉ số, HAX, tỉ lệ rớt và chủ sở hữu hiện tại).',
  },

  pets: {
    id: 'pets',
    title: '🐾 Linh Thú Tiên Giới (20 Chiến Pet)',
    icon: '🐾',
    description: 'Khái niệm Linh Thú, công thức Chiến Lực và 4 bậc phẩm cấp (Phàm / Linh / Tiên / Thần Thoại).',
    image_url: '',
    sections: [
      {
        heading: '1. Linh Thú Là Gì?',
        content: '• Linh Thú là chiến hữu đồng hành xuất trận trực tiếp trong /battle và hiển thị trên thẻ /profile.\n• Mọi tân thủ được cấp sẵn 1 Pet Phàm Phẩm mặc định: Hóa Thạch Nham Nham Thú (Hệ Thổ • 120 ATK / 180 DEF / 100 SPD).\n• Công thức Chiến Lực: (ATK × 3) + (DEF × 2) + (SPD × 2) + (Lv × 50) + Bonus Trang Bị.',
      },
      {
        heading: '2. Phân Chia 4 Bậc Phẩm Cấp',
        content: '• Phàm Phẩm (5 loài): Linh thú sơ khai, nền tảng tân thủ.\n• Linh Phẩm (5 loài): Khai mở linh trí, có hiệu ứng khống chế/xuyên giáp.\n• Tiên Phẩm (4 loài): Sở hữu kỹ năng HAX hút máu, khóa HAX, làm mù.\n• Thần Thoại (6 loài): Nắm giữ tuyệt kỹ HAX định đoạt trận đấu.',
      },
    ],
    fields: [
      {
        name: '📘 Khái Niệm & Công Thức',
        value: 'Linh Thú là chiến hữu xuất trận trong `/battle`, mang Hệ Ngũ Hành & Kỹ Năng HAX riêng.\n• **Pet khởi đầu**: `Hóa Thạch Nham Nham Thú` *(Phàm Phẩm • 120 ATK / 180 DEF / 100 SPD)*.\n• **Chiến Lực**: `(ATK × 3) + (DEF × 2) + (SPD × 2) + (Lv × 50) + Trang Bị`.',
        inline: false,
      },
      {
        name: '✨ 4 Bậc Phẩm Cấp',
        value: '• ⚪ **Phàm Phẩm** *(5 loài)* — Khởi đầu nền tảng\n• 🔵 **Linh Phẩm** *(5 loài)* — Khống chế & phá giáp\n• 🟣 **Tiên Phẩm** *(4 loài)* — Hút máu & phong ấn HAX\n• 🔴 **Thần Thoại** *(6 loài)* — Tuyệt kỹ HAX tối thượng',
        inline: false,
      },
    ],
    content: 'Chọn một Linh Thú từ **4 Dropdown theo Phẩm Cấp** bên dưới để xem thẻ chi tiết Full HD+ (Hệ nguyên tố, chỉ số `ATK/DEF/SPD/HP` và Kỹ năng HAX).',
  },

  economy: {
    id: 'economy',
    title: '💎 Kinh Tế Linh Thạch & Gia Tộc',
    icon: '💎',
    description: 'Tiền tệ Linh Thạch, nguồn thu nhập và hệ thống Gia Tộc / Bang Chiến 24H.',
    image_url: '',
    sections: [
      {
        heading: '1. Tiền Tệ Linh Thạch',
        content: '• Công dụng: Quay gacha Linh Thú, rèn 45 Pháp Bảo Loadout, nâng sao Pet và cống hiến ngân khố Gia Tộc.\n• Buff Role: « Tài Vận Hanh Thông » (+20% Linh Thạch), « Sáng Thế Thần Quân » (×2.5 Linh Thạch).',
      },
      {
        heading: '2. Gia Tộc & Clan Wars 24H',
        content: '• Gia Tộc cấp 1–10, quy mô 10–50 thành viên.\n• Clan Wars 24H: Hai gia tộc đặt cược Linh Thạch và thi đấu tổng điểm chiến lực trong 24 giờ.',
      },
    ],
    fields: [
      {
        name: '💎 Linh Thạch',
        value: '• Dùng để triệu hồi Linh Thú, rèn Pháp Bảo, nâng sao và đóng góp Gia Tộc.\n• **Buff**: `Tài Vận Hanh Thông` (+20%) • `Sáng Thế Thần Quân` (×2.5).',
        inline: false,
      },
      {
        name: '🏰 Gia Tộc & Clan Wars 24H',
        value: '• Quy mô cấp 1–10 (`10–50` thành viên).\n• Gia tộc tiêu biểu: **Thiên Hồ Thần Tộc (`🦊TH`)**.\n• **Clan Wars 24H**: Đặt cược Linh Thạch, tranh đoạt ngân khố trong 24 giờ.',
        inline: false,
      },
    ],
    content: 'Linh Thạch là đơn vị tài nguyên cốt lõi để cường hóa Linh Thú, trang bị Pháp Bảo và phát triển Gia Tộc tại SuMi Family.',
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
 * Trả về danh mục phân nhóm phục vụ Dropdown Trang Bị (3 nhóm) & Linh Thú (4 phẩm cấp — đúng 20 Linh Thú tiêu chuẩn)
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
 * Truy vấn chủ sở hữu thực tế từ Supabase cho 9 Pháp Bảo Thần Thoại Độc Nhất
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
    return { user_id: FUYUMI_USER_ID, username: 'Fuyumi 🌸' };
  }
  return null;
}

/**
 * Tra cứu chi tiết 1 Pháp Bảo Loadout (kèm Chủ Sở Hữu thời gian thực cho 9 món Thần Thoại Độc Nhất)
 */
export async function getWikiItemDetail(itemId) {
  if (!itemId || typeof itemId !== 'string') {
    return { success: false, error: 'Item not found', message: 'Thiếu mã trang bị.' };
  }

  const cleanId = itemId.trim().toLowerCase().replace(/\.png$/i, '');
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
      ? `👑 **Độc Nhất Toàn Server** — Chủ sở hữu: **${currentOwner.username}** (<@${currentOwner.user_id}>)`
      : '👑 **Độc Nhất Toàn Server** — Chưa có chủ sở hữu')
    : null;

  const effectLine = item.hax_skill
    ? `⚡ **${item.hax_skill}**: ${item.hax_description}`
    : (item.hax_description ? `✨ ${item.hax_description}` : 'Tăng trực tiếp chỉ số chiến đấu cho Linh Thú.');

  const descriptionLines = [
    `${tier.emoji} **${item.rarity}** • ${slotLabel} • Hệ **${item.element}** • Tỉ lệ rớt **${item.drop_rate}%**`,
    `📊 **Chỉ số**: \`${statParts.join(' | ') || 'Không có'}\``,
    effectLine,
  ];
  if (ownerLine) descriptionLines.push(ownerLine);

  const imageUrl = `${PUBLIC_BASE_URL}/api/wiki/item/${item.item_id}.png`;

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
      title: `${item.icon} ${item.item_name}`,
      description: descriptionLines.join('\n'),
      color: tier.color,
      color_dec: tier.colorDec,
      image_url: imageUrl,
      footer: `SuMi Family • Kho Pháp Bảo (${slotLabel} • ${item.rarity})`,
    },
  };
}

/**
 * Tra cứu chi tiết 1 Linh Thú theo mã pet_type (chỉ trả 20 Linh Thú tiêu chuẩn, ẩn pet độc quyền Fuyumi khỏi /wiki)
 */
export async function getWikiPetDetail(petType) {
  if (!petType || typeof petType !== 'string') {
    return { success: false, error: 'Pet not found', message: 'Thiếu mã Linh Thú.' };
  }

  const cleanType = petType.trim().toLowerCase().replace(/\.png$/i, '');
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
  if (pet.is_starter) tagNotes.push('🌱 Linh Thú Khởi Đầu Mặc Định');

  const descriptionLines = [
    `${tier.emoji} **${pet.rarity}** • Hệ **${pet.element}**${tagNotes.length ? ` • ${tagNotes.join(' • ')}` : ''}`,
    `📊 **Chỉ số gốc (Lv.1)**: \`ATK ${pet.base_atk.toLocaleString('vi-VN')} | DEF ${pet.base_def.toLocaleString('vi-VN')} | SPD ${pet.base_spd.toLocaleString('vi-VN')} | HP ${pet.base_hp.toLocaleString('vi-VN')}\``,
    `⚡ **Nội tại (${pet.hax_skill})**: ${pet.hax_description}`,
  ];

  const imageUrl = `${PUBLIC_BASE_URL}/api/wiki/pet/${pet.pet_type}.png`;

  return {
    success: true,
    data: {
      ...pet,
      image_url: imageUrl,
    },
    embed: {
      title: `${pet.icon} ${pet.pet_name}`,
      description: descriptionLines.join('\n'),
      color: tier.color,
      color_dec: tier.colorDec,
      image_url: imageUrl,
      footer: `SuMi Family • Bách Khoa Linh Thú (${pet.rarity} • Hệ ${pet.element})`,
    },
  };
}
