import { uiEm } from '../config/emojiHelper.js';
/**
 * src/data/v15AssetsCatalog.js
 * Danh mục 63 Tài Nguyên Đồ Họa Ver 1.5:
 * - 43 Application Emojis mới (1 gacha_ticket_domain + 42 ui_* thay thế 100% Unicode Windows)
 * - 20 Khung Viền Avatar (PNG nền trong suốt 512×512) chia 4 phẩm chất (300 / 800 / 1.800 / 4.000 LT)
 */

export const V15_NEW_EMOJI_PROMPTS = [
  {
    uid: 'gacha_ticket_domain',
    name: 'Vé Khai Mở Linh Vực',
    section: 'emoji',
    dimensions: '128×128 (PNG nền trong suốt)',
    role: 'Vật phẩm Vé Quay Gacha Linh Vực (/roll loai:domain, /explorer, /shop)',
    visual_prompt:
      'Ornate xianxia golden-jade domain summon scroll ticket tied with luminous violet silk ribbon and glowing eight-trigram spirit seal at center, subtle swirling stardust aura, 2D anime fantasy game UI icon, bold crisp silhouette with clean dark outer contour for 128x128 Discord emoji readability, vibrant colors, transparent background, no text, no watermark.',
  },
  {
    uid: 'ui_toggle_on',
    name: 'Nút Bật (ON)',
    section: 'emoji',
    dimensions: '128×128 (PNG nền trong suốt)',
    role: 'Trạng thái BẬT trong /autosell & cấu hình hệ thống',
    visual_prompt:
      'Glowing emerald jade spirit orb encased in a sleek golden xianxia ring bezel, radiant inner green energy core symbolizing active ON state, 2D game UI status icon, bold silhouette with dark contour for 128x128 Discord emoji clarity, transparent background, no text, no watermark.',
  },
  {
    uid: 'ui_toggle_off',
    name: 'Nút Tắt (OFF)',
    section: 'emoji',
    dimensions: '128×128 (PNG nền trong suốt)',
    role: 'Trạng thái TẮT trong /autosell & cấu hình hệ thống',
    visual_prompt:
      'Dormant dark obsidian stone spirit orb inside a muted silver-slate metallic ring bezel, subtle matte shading symbolizing inactive OFF state, 2D game UI status icon, bold clean silhouette for 128x128 Discord emoji clarity, transparent background, no text, no watermark.',
  },
  {
    uid: 'ui_lock',
    name: 'Ổ Khóa Bảo Vệ',
    section: 'emoji',
    dimensions: '128×128 (PNG nền trong suốt)',
    role: 'Biểu tượng khóa bảo vệ Thần Thoại / Độc Nhất trong /autosell & /dismantle',
    visual_prompt:
      'Ornate golden xianxia padlock with crimson spirit talisman clasp and glowing jade keyhole sigil, bold defensive silhouette, 2D fantasy game UI icon, crisp dark outer contour for 128x128 Discord emoji clarity, transparent background, no text, no watermark.',
  },
  {
    uid: 'ui_bulb_tip',
    name: 'Đèn Linh Quang Gợi Ý',
    section: 'emoji',
    dimensions: '128×128 (PNG nền trong suốt)',
    role: 'Biểu tượng mẹo / hướng dẫn nhanh trong các lệnh',
    visual_prompt:
      'Luminous warm amber-gold spirit lantern crystal shaped like a glowing lotus bulb radiating soft enlightenment sparks, 2D anime fantasy game UI icon, bold silhouette with dark outline for 128x128 Discord emoji clarity, transparent background, no text, no watermark.',
  },
  {
    uid: 'ui_check',
    name: 'Dấu Tích Xác Nhận',
    section: 'emoji',
    dimensions: '128×128 (PNG nền trong suốt)',
    role: 'Biểu tượng thành công / hoàn thành / chấp nhận',
    visual_prompt:
      'Glossy emerald-jade carved checkmark seal with subtle gold rim highlight and tiny spirit sparkle, 2D game UI icon, bold clean shape with crisp dark outer contour for 128x128 Discord emoji clarity, transparent background, no text, no watermark.',
  },
  {
    uid: 'ui_cross',
    name: 'Dấu Chéo Hủy / Thất Bại',
    section: 'emoji',
    dimensions: '128×128 (PNG nền trong suốt)',
    role: 'Biểu tượng từ chối / hủy bỏ / thất bại',
    visual_prompt:
      'Glossy crimson-ruby carved X cross seal with dark bronze bevel edge, sharp readable silhouette, 2D game UI icon, crisp dark outer contour for 128x128 Discord emoji clarity, transparent background, no text, no watermark.',
  },
  {
    uid: 'ui_warn',
    name: 'Biển Cảnh Báo',
    section: 'emoji',
    dimensions: '128×128 (PNG nền trong suốt)',
    role: 'Cảnh báo cooldown, mệt mỏi, giới hạn hoặc điều kiện chưa đạt',
    visual_prompt:
      'Golden-amber triangular xianxia warning talisman plaque with glowing exclamation spirit flame rune at center, 2D fantasy game UI icon, bold silhouette with dark outline for 128x128 Discord emoji clarity, transparent background, no text, no watermark.',
  },
  {
    uid: 'ui_clock_timer',
    name: 'Đồng Hồ Thời Gian',
    section: 'emoji',
    dimensions: '128×128 (PNG nền trong suốt)',
    role: 'Đếm ngược Khung Giờ Vàng, cooldown, thời gian khám phá',
    visual_prompt:
      'Ornate antique gold and azure-jade xianxia hourglass-pocketwatch hybrid with glowing cyan spirit sand, 2D anime fantasy game UI icon, bold silhouette with dark outline for 128x128 Discord emoji clarity, transparent background, no text, no watermark.',
  },
  {
    uid: 'ui_refresh',
    name: 'Vòng Xoay Làm Mới',
    section: 'emoji',
    dimensions: '128×128 (PNG nền trong suốt)',
    role: 'Nút làm mới trạng thái / reset lượt / cập nhật bảng',
    visual_prompt:
      'Two intertwined glowing cyan-sky and silver spirit energy arrows forming a circular refresh ring, 2D game UI icon, bold clean silhouette with crisp dark outer contour for 128x128 Discord emoji clarity, transparent background, no text, no watermark.',
  },
  {
    uid: 'ui_flag_capture',
    name: 'Cờ Chiếm Đóng Linh Mạch',
    section: 'emoji',
    dimensions: '128×128 (PNG nền trong suốt)',
    role: 'Trạng thái mỏ Linh Mạch đang có tổ đội chiếm giữ (/linhmach)',
    visual_prompt:
      'Crimson and gold imperial xianxia war banner flag fluttering on a jade spearhead pole with glowing flame tassel, 2D game UI icon, bold silhouette with dark outline for 128x128 Discord emoji clarity, transparent background, no text, no watermark.',
  },
  {
    uid: 'ui_skull_ko',
    name: 'Đầu Lâu Hạ Gục',
    section: 'emoji',
    dimensions: '128×128 (PNG nền trong suốt)',
    role: 'Trạng thái bị hạ gục / Boss / kết liễu trong chiến đấu & /explorer',
    visual_prompt:
      'Stylized dark violet-bone demonic skull emblem with glowing magenta eye sockets and subtle dark mist, 2D anime fantasy game UI icon, bold silhouette with dark outline for 128x128 Discord emoji clarity, transparent background, no text, no watermark.',
  },
  {
    uid: 'ui_heal_band',
    name: 'Linh Phù Hồi Phục',
    section: 'emoji',
    dimensions: '128×128 (PNG nền trong suốt)',
    role: 'Biểu tượng hồi máu, trị thương, thuốc hồi sinh',
    visual_prompt:
      'Glowing emerald-mint xianxia healing cross talisman wrapped with delicate golden herb leaves and soft healing sparkles, 2D game UI icon, bold silhouette with dark contour for 128x128 Discord emoji clarity, transparent background, no text, no watermark.',
  },
  {
    uid: 'ui_wind_spd',
    name: 'Phong Ấn Tốc Độ',
    section: 'emoji',
    dimensions: '128×128 (PNG nền trong suốt)',
    role: 'Biểu tượng Tốc Độ (SPD) & tăng tốc di chuyển',
    visual_prompt:
      'Dynamic swirling cyan-turquoise wind gust streaks with silver feather-light speed aura, 2D anime fantasy game UI icon, bold readable silhouette with dark outer contour for 128x128 Discord emoji clarity, transparent background, no text, no watermark.',
  },
  {
    uid: 'ui_crown_king',
    name: 'Vương Miện Tông Chủ',
    section: 'emoji',
    dimensions: '128×128 (PNG nền trong suốt)',
    role: 'Biểu tượng Đội Trưởng / Tộc Trưởng / Top 1 vinh danh',
    visual_prompt:
      'Imperial ornate golden xianxia crown studded with glowing crimson ruby and cyan jade gems, radiant sheen, 2D game UI icon, bold silhouette with dark contour for 128x128 Discord emoji clarity, transparent background, no text, no watermark.',
  },
  {
    uid: 'ui_nav_first',
    name: 'Nút Về Đầu Trang',
    section: 'emoji',
    dimensions: '128×128 (PNG nền trong suốt)',
    role: 'Điều hướng đầu trang / đầu nhật ký',
    visual_prompt:
      'Sleek golden-jade fantasy double-left chevron arrow with vertical bar button icon, clean beveled metallic look, 2D game UI navigation icon, bold silhouette with dark outer contour for 128x128 Discord emoji clarity, transparent background, no text, no watermark.',
  },
  {
    uid: 'ui_nav_prev',
    name: 'Nút Trang Trước',
    section: 'emoji',
    dimensions: '128×128 (PNG nền trong suốt)',
    role: 'Điều hướng trang trước / lượt trước',
    visual_prompt:
      'Sleek golden-jade fantasy left-pointing triangular arrow button icon with polished bevel edge, 2D game UI navigation icon, bold silhouette with dark outer contour for 128x128 Discord emoji clarity, transparent background, no text, no watermark.',
  },
  {
    uid: 'ui_nav_next',
    name: 'Nút Trang Sau',
    section: 'emoji',
    dimensions: '128×128 (PNG nền trong suốt)',
    role: 'Điều hướng trang tiếp theo / lượt sau',
    visual_prompt:
      'Sleek golden-jade fantasy right-pointing triangular arrow button icon with polished bevel edge, 2D game UI navigation icon, bold silhouette with dark outer contour for 128x128 Discord emoji clarity, transparent background, no text, no watermark.',
  },
  {
    uid: 'ui_nav_last',
    name: 'Nút Tới Cuối Trang',
    section: 'emoji',
    dimensions: '128×128 (PNG nền trong suốt)',
    role: 'Điều hướng cuối trang / cuối nhật ký',
    visual_prompt:
      'Sleek golden-jade fantasy double-right chevron arrow with vertical bar button icon, clean beveled metallic look, 2D game UI navigation icon, bold silhouette with dark outer contour for 128x128 Discord emoji clarity, transparent background, no text, no watermark.',
  },
  {
    uid: 'ui_clipboard_log',
    name: 'Bảng Nhật Ký Chiến Báo',
    section: 'emoji',
    dimensions: '128×128 (PNG nền trong suốt)',
    role: 'Xem danh sách chỉ số, nhật ký chiến đấu & tổng kết',
    visual_prompt:
      'Ornate wooden and gold xianxia jade-slate clipboard holding a crisp parchment battle report with subtle glowing ink lines, 2D game UI icon, bold silhouette with dark contour for 128x128 Discord emoji clarity, transparent background, no text, no watermark.',
  },
  {
    uid: 'ui_surrender_flag',
    name: 'Cờ Đầu Hàng / Rút Lui',
    section: 'emoji',
    dimensions: '128×128 (PNG nền trong suốt)',
    role: 'Nút đầu hàng / rút lui trong /battle hoặc minigame',
    visual_prompt:
      'Clean white-silver silk truce flag waving on a dark bronze staff with soft blue shading, 2D fantasy game UI icon, bold silhouette with dark outer contour for 128x128 Discord emoji clarity, transparent background, no text, no watermark.',
  },
  {
    uid: 'ui_compass_dir',
    name: 'La Bàn Định Hướng',
    section: 'emoji',
    dimensions: '128×128 (PNG nền trong suốt)',
    role: 'Biểu tượng khám phá / chọn địa danh (/explorer)',
    visual_prompt:
      'Antique brass and azure-jade xianxia feng-shui compass with glowing crimson north needle, 2D anime fantasy game UI icon, bold silhouette with dark contour for 128x128 Discord emoji clarity, transparent background, no text, no watermark.',
  },
  {
    uid: 'ui_medal_1',
    name: 'Huy Chương Hạng Nhất',
    section: 'emoji',
    dimensions: '128×128 (PNG nền trong suốt)',
    role: 'Hạng 1 trên tất cả bảng xếp hạng (/top)',
    visual_prompt:
      'Radiant pure gold championship medal hanging from crimson silk ribbon, glowing sunburst crest with central star gem, 2D game UI icon, bold silhouette with dark outer contour for 128x128 Discord emoji clarity, transparent background, no text, no watermark.',
  },
  {
    uid: 'ui_medal_2',
    name: 'Huy Chương Hạng Nhì',
    section: 'emoji',
    dimensions: '128×128 (PNG nền trong suốt)',
    role: 'Hạng 2 trên tất cả bảng xếp hạng (/top)',
    visual_prompt:
      'Polished sterling silver runner-up medal hanging from royal blue silk ribbon, subtle moonlight sheen crest, 2D game UI icon, bold silhouette with dark outer contour for 128x128 Discord emoji clarity, transparent background, no text, no watermark.',
  },
  {
    uid: 'ui_medal_3',
    name: 'Huy Chương Hạng Ba',
    section: 'emoji',
    dimensions: '128×128 (PNG nền trong suốt)',
    role: 'Hạng 3 trên tất cả bảng xếp hạng (/top)',
    visual_prompt:
      'Warm burnished bronze third-place medal hanging from deep emerald silk ribbon, ornate carved rim crest, 2D game UI icon, bold silhouette with dark outer contour for 128x128 Discord emoji clarity, transparent background, no text, no watermark.',
  },
  {
    uid: 'ui_chat_bubble',
    name: 'Bong Bóng Chat EXP',
    section: 'emoji',
    dimensions: '128×128 (PNG nền trong suốt)',
    role: 'Biểu tượng Top Chat & EXP Chat (/exp, /top chat)',
    visual_prompt:
      'Luminous sky-blue jade speech bubble emblem with three glowing golden spirit dots inside, 2D anime fantasy game UI icon, bold silhouette with dark outer contour for 128x128 Discord emoji clarity, transparent background, no text, no watermark.',
  },
  {
    uid: 'ui_voice_mic',
    name: 'Micro Voice EXP',
    section: 'emoji',
    dimensions: '128×128 (PNG nền trong suốt)',
    role: 'Biểu tượng Top Voice & EXP Voice (/exp, /top voice)',
    visual_prompt:
      'Sleek violet-gold fantasy crystal microphone with glowing soundwave arcs, 2D anime game UI icon, bold silhouette with dark outer contour for 128x128 Discord emoji clarity, transparent background, no text, no watermark.',
  },
  {
    uid: 'ui_speaker_sound',
    name: 'Loa Âm Thanh',
    section: 'emoji',
    dimensions: '128×128 (PNG nền trong suốt)',
    role: 'Biểu tượng quyền Soundboard / âm thanh Voice',
    visual_prompt:
      'Ornate golden-teal spirit horn speaker emitting vibrant cyan sound wave rings, 2D game UI icon, bold silhouette with dark contour for 128x128 Discord emoji clarity, transparent background, no text, no watermark.',
  },
  {
    uid: 'ui_music_note',
    name: 'Nốt Nhạc Tiên Âm',
    section: 'emoji',
    dimensions: '128×128 (PNG nền trong suốt)',
    role: 'Biểu tượng âm nhạc / hiệu ứng âm thanh Voice',
    visual_prompt:
      'Glowing pastel pink and gold double eighth music note floating with tiny spirit stardust sparkles, 2D anime game UI icon, bold silhouette with dark outer contour for 128x128 Discord emoji clarity, transparent background, no text, no watermark.',
  },
  {
    uid: 'ui_mute_voice',
    name: 'Biểu Tượng Tắt Tiếng',
    section: 'emoji',
    dimensions: '128×128 (PNG nền trong suốt)',
    role: 'Trạng thái khóa / tắt âm thanh hoặc kênh lặng',
    visual_prompt:
      'Muted slate-silver horn speaker crossed by a bold crimson diagonal slash bar, 2D game UI icon, crisp silhouette with dark outer contour for 128x128 Discord emoji clarity, transparent background, no text, no watermark.',
  },
  {
    uid: 'ui_announce_horn',
    name: 'Tù Và Thông Báo',
    section: 'emoji',
    dimensions: '128×128 (PNG nền trong suốt)',
    role: 'Thông báo sự kiện, vinh danh Top Chat/Voice & Gia Tộc',
    visual_prompt:
      'Festive crimson and gold xianxia herald megaphone trumpet radiating bright golden announcement sparks, 2D game UI icon, bold silhouette with dark outline for 128x128 Discord emoji clarity, transparent background, no text, no watermark.',
  },
  {
    uid: 'ui_user_avatar',
    name: 'Hồ Sơ Tu Sĩ',
    section: 'emoji',
    dimensions: '128×128 (PNG nền trong suốt)',
    role: 'Biểu tượng thành viên / người chơi / tổ đội',
    visual_prompt:
      'Minimalist stylized azure-jade cultivator silhouette bust inside a subtle golden circular emblem, 2D game UI icon, bold clean shape with dark outer contour for 128x128 Discord emoji clarity, transparent background, no text, no watermark.',
  },
  {
    uid: 'ui_kick_boot',
    name: 'Giày Đuổi Thành Viên',
    section: 'emoji',
    dimensions: '128×128 (PNG nền trong suốt)',
    role: 'Nút đuổi thành viên khỏi /party hoặc /giatoc',
    visual_prompt:
      'Dynamic crimson-bronze armored fantasy boot kicking forward with sharp orange motion slash trail, 2D game UI icon, bold silhouette with dark outer contour for 128x128 Discord emoji clarity, transparent background, no text, no watermark.',
  },
  {
    uid: 'ui_gift_box',
    name: 'Hộp Quà Tiên Bảo',
    section: 'emoji',
    dimensions: '128×128 (PNG nền trong suốt)',
    role: 'Quà thưởng cập nhật, nhiệm vụ ngày, rương quà sự kiện',
    visual_prompt:
      'Luxurious crimson and gold xianxia gift box tied with a shimmering jade silk bow slightly glowing from within, 2D anime fantasy game UI icon, bold silhouette with dark contour for 128x128 Discord emoji clarity, transparent background, no text, no watermark.',
  },
  {
    uid: 'ui_backpack_inv',
    name: 'Túi Càn Khôn (/inv)',
    section: 'emoji',
    dimensions: '128×128 (PNG nền trong suốt)',
    role: 'Biểu tượng Túi Đồ & kho vật phẩm (/inv)',
    visual_prompt:
      'Ornate embroidered indigo-gold xianxia Qiankun storage pouch-satchel closed with a glowing jade drawstring tassel, 2D game UI icon, bold silhouette with dark outline for 128x128 Discord emoji clarity, transparent background, no text, no watermark.',
  },
  {
    uid: 'ui_party_celebrate',
    name: 'Pháo Hoa Chúc Mừng',
    section: 'emoji',
    dimensions: '128×128 (PNG nền trong suốt)',
    role: 'Chúc mừng thăng cấp, thắng trận, mở quà thành công',
    visual_prompt:
      'Festive golden-crimson celebration popper bursting with vibrant pink, cyan, and gold confetti stars, 2D anime fantasy game UI icon, bold silhouette with dark outer contour for 128x128 Discord emoji clarity, transparent background, no text, no watermark.',
  },
  {
    uid: 'ui_coin_gold',
    name: 'Đồng Tiền Hoàng Kim',
    section: 'emoji',
    dimensions: '128×128 (PNG nền trong suốt)',
    role: 'Biểu tượng cược / hoàn trả / tài chính minigame',
    visual_prompt:
      'Gleaming ancient square-holed golden xianxia coin embossed with auspicious cloud swirl motifs, 2D game UI icon, bold silhouette with dark outer contour for 128x128 Discord emoji clarity, transparent background, no text, no watermark.',
  },
  {
    uid: 'ui_heart_couple',
    name: 'Tâm Ấn Tiên Lữ',
    section: 'emoji',
    dimensions: '128×128 (PNG nền trong suốt)',
    role: 'Biểu tượng kết duyên / điểm thân mật (/marry)',
    visual_prompt:
      'Two intertwined glowing rose-pink crystal hearts surrounded by delicate golden fate-thread ribbons, 2D anime romance game UI icon, bold silhouette with dark contour for 128x128 Discord emoji clarity, transparent background, no text, no watermark.',
  },
  {
    uid: 'ui_heart_broken',
    name: 'Tâm Ấn Rạn Nứt',
    section: 'emoji',
    dimensions: '128×128 (PNG nền trong suốt)',
    role: 'Biểu tượng ly hôn / hủy kết duyên (/marry)',
    visual_prompt:
      'Cracked dark-crimson crystal heart split cleanly down the middle with faint fading violet glow, 2D game UI icon, bold silhouette with dark outer contour for 128x128 Discord emoji clarity, transparent background, no text, no watermark.',
  },
  {
    uid: 'ui_suit_spade',
    name: `Chất Bích (${uiEm('ui_suit_spade')})`,
    section: 'emoji',
    dimensions: '128×128 (PNG nền trong suốt)',
    role: 'Bộ bài Blackjack chất Bích (/blackjack)',
    visual_prompt:
      'Ornate obsidian-black playing card spade emblem edged in fine polished silver filigree, 2D game UI icon, bold crisp silhouette with subtle highlight for 128x128 Discord emoji clarity, transparent background, no text, no watermark.',
  },
  {
    uid: 'ui_suit_heart',
    name: `Chất Cơ (${uiEm('ui_suit_heart')})`,
    section: 'emoji',
    dimensions: '128×128 (PNG nền trong suốt)',
    role: 'Bộ bài Blackjack chất Cơ (/blackjack)',
    visual_prompt:
      'Ornate ruby-crimson playing card heart emblem edged in fine polished gold filigree, 2D game UI icon, bold crisp silhouette with dark outer contour for 128x128 Discord emoji clarity, transparent background, no text, no watermark.',
  },
  {
    uid: 'ui_suit_diamond',
    name: `Chất Rô (${uiEm('ui_suit_diamond')})`,
    section: 'emoji',
    dimensions: '128×128 (PNG nền trong suốt)',
    role: 'Bộ bài Blackjack chất Rô (/blackjack)',
    visual_prompt:
      'Ornate faceted scarlet-ruby playing card diamond gem emblem edged in fine gold filigree, 2D game UI icon, bold crisp silhouette with dark outer contour for 128x128 Discord emoji clarity, transparent background, no text, no watermark.',
  },
  {
    uid: 'ui_suit_club',
    name: `Chất Chuồn (${uiEm('ui_suit_club')})`,
    section: 'emoji',
    dimensions: '128×128 (PNG nền trong suốt)',
    role: 'Bộ bài Blackjack chất Chuồn (/blackjack)',
    visual_prompt:
      'Ornate obsidian-charcoal playing card three-leaf club emblem edged in fine silver filigree, 2D game UI icon, bold crisp silhouette with subtle highlight for 128x128 Discord emoji clarity, transparent background, no text, no watermark.',
  },
];

export const V15_AVATAR_FRAME_SPECS = [
  // PHÀM PHẨM (300 LT) — 4 mẫu
  {
    frame_id: 'frame_bamboo_ink',
    name: 'Trúc Thanh Tĩnh Mặc',
    rarity: 'Phàm Phẩm',
    rarity_key: 'common',
    price: 300,
    file: 'frames/frame_bamboo_ink.png',
    palette: ['#4ade80', '#166534', '#d1fae5'],
    description: 'Khung trúc xanh thanh nhã điểm xuyết giọt sương đêm.',
    visual_prompt:
      'Circular 512x512 transparent PNG avatar frame border ONLY: slender emerald bamboo stalks curving into an elegant circle with a few dew-kissed bamboo leaves on the lower left and upper right corners, ink-wash xianxia style. Completely transparent empty center circle (at least 72% inner circle clear), NO face, NO character inside, NO background, no text, no watermark.',
  },
  {
    frame_id: 'frame_plum_blossom',
    name: 'Hoa Đào Sơ Khai',
    rarity: 'Phàm Phẩm',
    rarity_key: 'common',
    price: 300,
    file: 'frames/frame_plum_blossom.png',
    palette: ['#f9a8d4', '#be185d', '#fde68a'],
    description: 'Cành đào hồng phấn nhẹ nhàng quấn quanh khung ảnh đại diện.',
    visual_prompt:
      'Circular 512x512 transparent PNG avatar frame border ONLY: delicate dark plum wood ring adorned with soft pastel pink sakura blossom clusters and falling petals along the outer rim, gentle warm gold accents. Completely transparent empty center circle (at least 72% inner circle clear), NO face, NO character inside, NO background, no text, no watermark.',
  },
  {
    frame_id: 'frame_lantern_glow',
    name: 'Đèn Lồng Chu Sa',
    rarity: 'Phàm Phẩm',
    rarity_key: 'common',
    price: 300,
    file: 'frames/frame_lantern_glow.png',
    palette: ['#fb7185', '#9f1239', '#fcd34d'],
    description: 'Viền gỗ sơn son thếp vàng mang không khí phố đêm cổ trang.',
    visual_prompt:
      'Circular 512x512 transparent PNG avatar frame border ONLY: lacquered vermilion wood circle frame with antique brass corners and two tiny glowing red paper lanterns dangling symmetrically on the lower sides. Completely transparent empty center circle (at least 72% inner circle clear), NO face, NO character inside, NO background, no text, no watermark.',
  },
  {
    frame_id: 'frame_obsidian_ring',
    name: 'Hắc Ngọc Cổ Điển',
    rarity: 'Phàm Phẩm',
    rarity_key: 'common',
    price: 300,
    file: 'frames/frame_obsidian_ring.png',
    palette: ['#94a3b8', '#334155', '#cbd5e1'],
    description: 'Vòng hắc ngọc khắc hoa văn mây tối giản mà sắc nét.',
    visual_prompt:
      'Circular 512x512 transparent PNG avatar frame border ONLY: sleek carved dark obsidian stone ring inlaid with fine brushed silver xianxia cloud fretwork patterns. Completely transparent empty center circle (at least 72% inner circle clear), NO face, NO character inside, NO background, no text, no watermark.',
  },

  // LINH PHẨM (800 LT) — 6 mẫu (bao gồm frame_royal_legacy thay thế Lệnh Bài Khung Viền cũ + jade_lotus + frost_crystal)
  {
    frame_id: 'frame_royal_legacy',
    name: 'Khung Viền Độc Bản Hoàng Kim',
    rarity: 'Linh Phẩm',
    rarity_key: 'rare',
    price: 800,
    file: 'frames/frame_royal_legacy.png',
    palette: ['#fbbf24', '#d97706', '#f472b6'],
    description: 'Phiên bản nâng cấp từ Lệnh Bài Khung Viền Độc Bản — hoa văn hoàng kim quý phái.',
    visual_prompt:
      'Circular 512x512 transparent PNG avatar frame border ONLY: royal ornate filigree gold circular ring studded with small sakura-pink spirit gems and symmetric auspicious knot crests at top and bottom. Completely transparent empty center circle (at least 72% inner circle clear), NO face, NO character inside, NO background, no text, no watermark.',
  },
  {
    frame_id: 'jade_lotus',
    name: 'Ngọc Bích Liên Hoa',
    rarity: 'Linh Phẩm',
    rarity_key: 'rare',
    price: 800,
    file: 'frames/jade_lotus.png',
    palette: ['#34d399', '#059669', '#a7f3d0'],
    description: 'Viền ngọc bích phát sáng dịu kèm đài hoa sen thanh khiết.',
    visual_prompt:
      'Circular 512x512 transparent PNG avatar frame border ONLY: luminous translucent green nephrite jade ring accented with delicate blooming jade lotus petals at bottom and silver spirit filigree along the rim. Completely transparent empty center circle (at least 72% inner circle clear), NO face, NO character inside, NO background, no text, no watermark.',
  },
  {
    frame_id: 'frost_crystal',
    name: 'Hàn Băng Lưu Ly',
    rarity: 'Linh Phẩm',
    rarity_key: 'rare',
    price: 800,
    file: 'frames/frost_crystal.png',
    palette: ['#38bdf8', '#0284c7', '#e0f2fe'],
    description: 'Viền băng tinh pha lê xanh ngọc lạnh lẽo sắc bén.',
    visual_prompt:
      'Circular 512x512 transparent PNG avatar frame border ONLY: crystalline glacier-blue ice shards and intricate silver snowflake filigree forming a sharp luminous circular border. Completely transparent empty center circle (at least 72% inner circle clear), NO face, NO character inside, NO background, no text, no watermark.',
  },
  {
    frame_id: 'frame_moon_ripple',
    name: 'Nguyệt Ảnh Thủy Ba',
    rarity: 'Linh Phẩm',
    rarity_key: 'rare',
    price: 800,
    file: 'frames/frame_moon_ripple.png',
    palette: ['#60a5fa', '#1d4ed8', '#fef08a'],
    description: 'Gợn sóng ánh trăng xanh thẫm hòa cùng vầng trăng khuyết bạc.',
    visual_prompt:
      'Circular 512x512 transparent PNG avatar frame border ONLY: deep sapphire water ripple ring crowned by a slender glowing silver crescent moon at the top and gentle luminous wave crests below. Completely transparent empty center circle (at least 72% inner circle clear), NO face, NO character inside, NO background, no text, no watermark.',
  },
  {
    frame_id: 'frame_thunder_seal',
    name: 'Lôi Vân Cổ Ấn',
    rarity: 'Linh Phẩm',
    rarity_key: 'rare',
    price: 800,
    file: 'frames/frame_thunder_seal.png',
    palette: ['#a78bfa', '#6d28d9', '#fde047'],
    description: 'Tia lôi điện tử sắc lẹm quấn quanh vòng ấn cổ.',
    visual_prompt:
      'Circular 512x512 transparent PNG avatar frame border ONLY: dark bronze-violet rune ring crackling with crisp golden-purple lightning arcs hugging the circular rim. Completely transparent empty center circle (at least 72% inner circle clear), NO face, NO character inside, NO background, no text, no watermark.',
  },
  {
    frame_id: 'frame_crimson_cloud',
    name: 'Đan Hà Lưu Vân',
    rarity: 'Linh Phẩm',
    rarity_key: 'rare',
    price: 800,
    file: 'frames/frame_crimson_cloud.png',
    palette: ['#fb923c', '#c2410c', '#fef3c7'],
    description: 'Áng mây ráng chiều đỏ rực lượn quanh viền đồng cổ.',
    visual_prompt:
      'Circular 512x512 transparent PNG avatar frame border ONLY: warm copper-gold circular ring wrapped in stylized sunset vermilion auspicious clouds and soft golden mist swirls. Completely transparent empty center circle (at least 72% inner circle clear), NO face, NO character inside, NO background, no text, no watermark.',
  },

  // TIÊN PHẨM (1.800 LT) — 6 mẫu (bao gồm amethyst_celestial + crimson_phoenix)
  {
    frame_id: 'amethyst_celestial',
    name: 'Tử Tinh Huyền Nguyệt',
    rarity: 'Tiên Phẩm',
    rarity_key: 'epic',
    price: 1800,
    file: 'frames/amethyst_celestial.png',
    palette: ['#c084fc', '#7e22ce', '#f5d0fe'],
    description: 'Viền tử tinh tím thẫm điểm xuyết tinh tú huyền ảo.',
    visual_prompt:
      'Circular 512x512 transparent PNG avatar frame border ONLY: opulent violet-amethyst crystal ring with platinum-gold celestial astrolabe markings, floating purple starlight dust and twin crescent emblems. Completely transparent empty center circle (at least 72% inner circle clear), NO face, NO character inside, NO background, no text, no watermark.',
  },
  {
    frame_id: 'crimson_phoenix',
    name: 'Phượng Hoàng Xích Diệm',
    rarity: 'Tiên Phẩm',
    rarity_key: 'epic',
    price: 1800,
    file: 'frames/crimson_phoenix.png',
    palette: ['#f97316', '#dc2626', '#fde047'],
    description: 'Viền xích diệm rực cháy ánh lửa phượng hoàng vàng cam.',
    visual_prompt:
      'Circular 512x512 transparent PNG avatar frame border ONLY: blazing golden-crimson phoenix tail feathers curving symmetrically around a molten gold ring with floating ember sparks. Completely transparent empty center circle (at least 72% inner circle clear), NO face, NO character inside, NO background, no text, no watermark.',
  },
  {
    frame_id: 'frame_star_nebula',
    name: 'Cửu Thiên Tinh Hà',
    rarity: 'Tiên Phẩm',
    rarity_key: 'epic',
    price: 1800,
    file: 'frames/frame_star_nebula.png',
    palette: ['#818cf8', '#312e81', '#e0e7ff'],
    description: 'Dải ngân hà sâu thẳm điểm sao băng bạc quay quanh viền.',
    visual_prompt:
      'Circular 512x512 transparent PNG avatar frame border ONLY: cosmic indigo-violet nebula ribbon forming an ornate ring inlaid with glowing silver stars and delicate golden constellation lines. Completely transparent empty center circle (at least 72% inner circle clear), NO face, NO character inside, NO background, no text, no watermark.',
  },
  {
    frame_id: 'frame_white_lotus',
    name: 'Bạch Liên Tiên Đài',
    rarity: 'Tiên Phẩm',
    rarity_key: 'epic',
    price: 1800,
    file: 'frames/frame_white_lotus.png',
    palette: ['#f8fafc', '#93c5fd', '#fde68a'],
    description: 'Đài sen trắng tinh khôi tỏa hào quang vàng nhạt thuần khiết.',
    visual_prompt:
      'Circular 512x512 transparent PNG avatar frame border ONLY: pure luminous white-pearl lotus petals layered gracefully with delicate champagne-gold filigree halo and glowing dewdrops. Completely transparent empty center circle (at least 72% inner circle clear), NO face, NO character inside, NO background, no text, no watermark.',
  },
  {
    frame_id: 'frame_solar_crow',
    name: 'Kim Ô Nhật Luân',
    rarity: 'Tiên Phẩm',
    rarity_key: 'epic',
    price: 1800,
    file: 'frames/frame_solar_crow.png',
    palette: ['#facc15', '#b45309', '#fef08a'],
    description: 'Nhật luân rực sáng mang uy nghi Thái Dương Chân Hỏa.',
    visual_prompt:
      'Circular 512x512 transparent PNG avatar frame border ONLY: radiant golden solar sun-wheel ring featuring sharp sun-ray spikes and ancient bronze sun-bird crest ornaments along the rim. Completely transparent empty center circle (at least 72% inner circle clear), NO face, NO character inside, NO background, no text, no watermark.',
  },
  {
    frame_id: 'frame_azure_dragon',
    name: 'Thanh Long Đằng Vân',
    rarity: 'Tiên Phẩm',
    rarity_key: 'epic',
    price: 1800,
    file: 'frames/frame_azure_dragon.png',
    palette: ['#2dd4bf', '#0f766e', '#fde047'],
    description: 'Vảy Thanh Long xanh biếc cùng mây lành lượn quanh viền.',
    visual_prompt:
      'Circular 512x512 transparent PNG avatar frame border ONLY: majestic teal-emerald dragon scales and sculpted eastern dragon horn motifs wrapped in luminous gold cloud curls around the outer rim. Completely transparent empty center circle (at least 72% inner circle clear), NO face, NO character inside, NO background, no text, no watermark.',
  },

  // THẦN THOẠI (4.000 LT) — 4 mẫu
  {
    frame_id: 'frame_kitsune_mythic',
    name: 'Cửu Vĩ Hồng Mông Ấn',
    rarity: 'Thần Thoại',
    rarity_key: 'mythic',
    price: 4000,
    file: 'frames/frame_kitsune_mythic.png',
    palette: ['#f472b6', '#be185d', '#fde047'],
    description: 'Chín dải hồ hỏa hồng anh đào quấn quanh ấn ký Thần Hồ tối thượng.',
    visual_prompt:
      'Circular 512x512 transparent PNG avatar frame border ONLY: grand mythic nine-tailed fox spirit aura in sakura-pink and radiant rose-gold flames curving majestically around a jewel-inlaid platinum halo with tiny kitsune-fire wisps. Completely transparent empty center circle (at least 72% inner circle clear), NO face, NO character inside, NO background, no text, no watermark.',
  },
  {
    frame_id: 'frame_chaos_primordial',
    name: 'Hỗn Độn Thái Sơ Hoàn',
    rarity: 'Thần Thoại',
    rarity_key: 'mythic',
    price: 4000,
    file: 'frames/frame_chaos_primordial.png',
    palette: ['#a855f7', '#ec4899', '#38bdf8'],
    description: 'Vòng xoáy Hỗn Độn đa sắc thái sơ khai dung hợp Âm Dương ngũ hành.',
    visual_prompt:
      'Circular 512x512 transparent PNG avatar frame border ONLY: transcendent primordial chaos cosmic halo swirling with iridescent violet, magenta, and cyan stardust energy, anchored by ancient celestial jade-gold runes. Completely transparent empty center circle (at least 72% inner circle clear), NO face, NO character inside, NO background, no text, no watermark.',
  },
  {
    frame_id: 'frame_emperor_dragon',
    name: 'Đế Tôn Kim Long Quyền',
    rarity: 'Thần Thoại',
    rarity_key: 'mythic',
    price: 4000,
    file: 'frames/frame_emperor_dragon.png',
    palette: ['#fbbf24', '#92400e', '#fef08a'],
    description: 'Kim Long chín móng uốn lượn bảo hộ vương tọa Chí Tôn.',
    visual_prompt:
      'Circular 512x512 transparent PNG avatar frame border ONLY: imperial mythic golden eastern dragon coiled tightly along the outer circular rim clutching a luminous pearl at the top, gilded imperial armor filigree. Completely transparent empty center circle (at least 72% inner circle clear), NO face, NO character inside, NO background, no text, no watermark.',
  },
  {
    frame_id: 'frame_eternal_aurora',
    name: 'Vĩnh Kết Thiên Hồ Quang',
    rarity: 'Thần Thoại',
    rarity_key: 'mythic',
    price: 4000,
    file: 'frames/frame_eternal_aurora.png',
    palette: ['#f9a8d4', '#fde047', '#fbcfe8'],
    description: 'Ánh cực quang hồng ngọc giao thoa linh văn vĩnh hằng tuyệt mỹ.',
    visual_prompt:
      'Circular 512x512 transparent PNG avatar frame border ONLY: ethereal mythic celestial aurora ribbons in pastel rose, pearl gold, and ice cyan weaving around a divine crystalline tiara crown at the top. Completely transparent empty center circle (at least 72% inner circle clear), NO face, NO character inside, NO background, no text, no watermark.',
  },
];
