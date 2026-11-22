/**
 * src/data/v13ExpansionCatalog.js
 * Danh mục mở rộng Đại Đạo v1.3 cho SuMi Family:
 * - 31 Linh Vực (30 Công Khai + 1 Độc Tôn Fuyumi) + 16 Thần Thức + 16 Thần Cảnh
 * - 50 Linh Thú mới (10 Thần Thoại Độc Nhất + 30 Thần Thoại Không Độc Nhất + 10 Phàm/Linh/Tiên)
 * - 100 Pháp Bảo mới (34 Vũ Khí + 33 Bảo Ngọc + 33 Chiến Hồn; gồm 30 Thần Thoại Độc Nhất + 50 Thần Thoại Thường + 20 Phàm/Linh/Tiên)
 * - 17 Emoji Minigame (/coinflip, /slots 4 ô, /blackjack, /crash) + 7 Vật Phẩm Nông Trại Thời Gian Thực (/farm, /exchange)
 *
 * Quy tắc cân bằng: Chênh lệch tổng lực giữa Thần Thoại Độc Nhất và Thần Thoại Không Độc Nhất <= 15%
 * (không áp dụng giới hạn này đối với bộ Độc Tôn của Tiểu thư Fuyumi).
 */

import { V14_DAO_AP_CONFIG } from './v14ExpansionCatalog.js';

const CARD_STYLE_DIRECTIVE =
  '2D xianxia dark fantasy digital illustration icon, glowing ethereal energy particles, crisp ornate edges, rich depth and specular highlights, centered composition on clean dark slate vignette background suitable for both 128x128 Discord emoji and portrait card, no text, no watermark';

const EMOJI_ICON_STYLE_DIRECTIVE =
  '2D game UI icon, bold readable silhouette with crisp dark outer contour for 128x128 Discord emoji clarity, vibrant xianxia color palette, transparent background, no text, no watermark';

const ELEMENT_PALETTES = {
  Kim: 'gleaming platinum gold and sharp metallic silver swordlight',
  Mộc: 'emerald jade spirit vines, ancient glowing leaves and cyan mist',
  Thủy: 'sapphire glacial frost, swirling tidal crystal water and mist',
  Hỏa: 'crimson phoenix flames, molten gold embers and obsidian sparks',
  Thổ: 'warm amber monoliths, gilded earth runes and basalt stone dust',
  Lôi: 'crackling violet-cyan heavenly lightning arcs and storm clouds',
  Quang: 'radiant celestial sunlight, pearl gold halos and sacred feathers',
  Ám: 'abyssal violet-black shadow wisps, crimson moonlight and cursed seals',
  'Hư Không': 'cosmic astral void, fractured starlight rifts and nebula silver',
  'Hỗn Độn': 'primordial sakura-rose and imperial gold chaos flames with nine-tailed divine aura',
};

const DOMAIN_ELEMENT_PALETTES = {
  'Kiếm Vực': 'myriad floating ethereal spirit swords suspended in formation, silver-gold sword Qi slashes',
  'Huyễn Vực': 'dreamlike magenta-indigo mirage ripples, shattered mirror illusions and drifting cherry petals',
  'Trận Vực': 'intricate rotating golden-cyan daoist array runes and glowing geometric seal pillars',
  'Minh Vực': 'spectral underworld cyan-purple soul lanterns, ghostly mist and ancient abyssal gates',
  'Thánh Vực': 'sacred pearlescent lotus sanctum, radiant golden-white light pillars and purifying halos',
  'Hỗn Độn Vực': 'supreme imperial rose-gold nine-tailed fox throne, primordial chaos vortex shattering all realms',
};

function buildPetPrompt(element, rarityKey, visualScene) {
  const palette = ELEMENT_PALETTES[element] || ELEMENT_PALETTES['Hỗn Độn'];
  const tierMood = rarityKey === 'mythic'
    ? 'mythic divine guardian presence, intricate celestial ornaments, dramatic rim lighting'
    : rarityKey === 'epic'
      ? 'noble immortal spirit beast aura, luminous elemental halo'
      : 'clean stylized spirit beast silhouette, vibrant elemental glow';
  return `${visualScene}, infused with ${palette}, ${tierMood}, ${CARD_STYLE_DIRECTIVE}.`;
}

function buildEquipPrompt(slot, element, rarityKey, visualScene) {
  const palette = ELEMENT_PALETTES[element] || ELEMENT_PALETTES['Hỗn Độn'];
  const slotCue = slot === 'weapon'
    ? 'legendary xianxia weapon artifact angled dynamically'
    : slot === 'gem'
      ? 'floating sacred cultivator spirit orb and jade talisman gem'
      : 'ethereal roaring war-soul spirit totem wreathed in Qi';
  const tierMood = rarityKey === 'mythic'
    ? 'mythic relic craftsmanship with floating celestial seals and intense energy trail'
    : rarityKey === 'epic'
      ? 'refined immortal-grade artifact filigree'
      : 'distinct clean cultivator gear';
  return `${slotCue}: ${visualScene}, radiating ${palette}, ${tierMood}, ${CARD_STYLE_DIRECTIVE}.`;
}

function buildDomainPrompt(kindLabel, domainElement, visualScene, isSupreme = false) {
  const palette = DOMAIN_ELEMENT_PALETTES[domainElement] || DOMAIN_ELEMENT_PALETTES['Kiếm Vực'];
  const grandeur = isSupreme
    ? 'overwhelming supreme nine-tailed celestial fox sovereign majesty'
    : 'cinematic miniature cultivation realm crest badge';
  return `${kindLabel} emblem depicting ${visualScene}, surrounded by ${palette}, ${grandeur}, ${EMOJI_ICON_STYLE_DIRECTIVE}.`;
}

export const V13_DOMAIN_ELEMENTS = {
  cycle: ['Kiếm Vực', 'Huyễn Vực', 'Trận Vực', 'Minh Vực', 'Thánh Vực'],
  counters: {
    'Kiếm Vực': 'Huyễn Vực',
    'Huyễn Vực': 'Trận Vực',
    'Trận Vực': 'Minh Vực',
    'Minh Vực': 'Thánh Vực',
    'Thánh Vực': 'Kiếm Vực',
  },
  weakAgainst: {
    'Huyễn Vực': 'Kiếm Vực',
    'Trận Vực': 'Huyễn Vực',
    'Minh Vực': 'Trận Vực',
    'Thánh Vực': 'Minh Vực',
    'Kiếm Vực': 'Thánh Vực',
  },
  supreme: 'Hỗn Độn Vực',
};

const RAW_DOMAINS = [
  // 5 Phàm Phẩm (Linh Mạch 3, Pierce 0%)
  {
    domain_id: 'domain_common_1', name: 'Thanh Phong Kiếm Trủng', element: 'Kiếm Vực', rarity: 'Phàm Phẩm', rarity_key: 'common', is_unique: false,
    base_energy: 3, enemy_active_debuff_pierce: 0, enemy_buff_suppression: 0,
    buffs: { defPiercePct: 0.12 }, debuffs: { defReductionPct: 0.12 },
    buff_desc: 'Tăng +12% Xuyên Giáp cho đòn đánh Linh Thú phe mình.',
    debuff_desc: 'Giảm 12% Giáp hiệu dụng của Linh Thú địch.',
    scene: 'an ancient misty bamboo sword mound with bronze spirit blades planted in moss',
  },
  {
    domain_id: 'domain_common_2', name: 'Mộng Điệp Hoa Lâm', element: 'Huyễn Vực', rarity: 'Phàm Phẩm', rarity_key: 'common', is_unique: false,
    base_energy: 3, enemy_active_debuff_pierce: 0, enemy_buff_suppression: 0,
    buffs: { haxProcBonusPct: 0.08 }, debuffs: { accuracyDownPct: 0.10 },
    buff_desc: 'Tăng +8% xác suất kích hoạt hiệu ứng HAX của phe mình.',
    debuff_desc: 'Gây nhiễu ảo ảnh khiến địch giảm 10% chính xác đòn đánh.',
    scene: 'luminescent lavender dream butterflies fluttering through glowing lotus mist',
  },
  {
    domain_id: 'domain_common_3', name: 'Ngũ Hành Tiểu Trận', element: 'Trận Vực', rarity: 'Phàm Phẩm', rarity_key: 'common', is_unique: false,
    base_energy: 3, enemy_active_debuff_pierce: 0, enemy_buff_suppression: 0,
    buffs: { shieldStrengthBonusPct: 0.14 }, debuffs: { healReductionPct: 0.15 },
    buff_desc: 'Tăng +14% giá trị Khiên Chắn tạo ra bởi phe mình.',
    debuff_desc: 'Giảm 15% hiệu quả hồi phục HP của Linh Thú địch.',
    scene: 'five carved jade cornerstones linked by a golden protective talisman circle',
  },
  {
    domain_id: 'domain_common_4', name: 'U Tuyền Cổ Độ', element: 'Minh Vực', rarity: 'Phàm Phẩm', rarity_key: 'common', is_unique: false,
    base_energy: 3, enemy_active_debuff_pierce: 0, enemy_buff_suppression: 0,
    buffs: { lifestealPct: 0.10 }, debuffs: { dotMaxHpPct: 0.04 },
    buff_desc: 'Linh Thú phe mình nhận thêm 10% Hút Máu theo sát thương.',
    debuff_desc: 'Âm khí ăn mòn rút 4% HP tối đa của địch mỗi hiệp.',
    scene: 'a wooden lantern skiff floating across pale ghostly river ripples',
  },
  {
    domain_id: 'domain_common_5', name: 'Bạch Liên Tịnh Thổ', element: 'Thánh Vực', rarity: 'Phàm Phẩm', rarity_key: 'common', is_unique: false,
    base_energy: 3, enemy_active_debuff_pierce: 0, enemy_buff_suppression: 0,
    buffs: { critResistPct: 0.15 }, debuffs: { critTakenBonusPct: 0.10 },
    buff_desc: 'Giảm 15% sát thương Bạo Kích mà phe mình phải nhận.',
    debuff_desc: 'Khiến Linh Thú địch nhận thêm +10% sát thương từ đòn Bạo Kích.',
    scene: 'a pure white sacred lotus blossom resting upon calm pearl water',
  },

  // 5 Linh Phẩm (Linh Mạch 4, Pierce 0%)
  {
    domain_id: 'domain_rare_1', name: 'Lôi Minh Cổ Kiếm Các', element: 'Kiếm Vực', rarity: 'Linh Phẩm', rarity_key: 'rare', is_unique: false,
    base_energy: 4, enemy_active_debuff_pierce: 0, enemy_buff_suppression: 0,
    buffs: { defPiercePct: 0.18, shieldPiercePct: 0.18 }, debuffs: { defReductionPct: 0.18 },
    buff_desc: 'Tăng +18% Xuyên Giáp & +18% Xuyên Khiên cho phe mình.',
    debuff_desc: 'Kiếm khí chém nát -18% Giáp hiệu dụng của Linh Thú địch.',
    scene: 'pagoda pavilion ringed by hovering azure lightning swords',
  },
  {
    domain_id: 'domain_rare_2', name: 'Hải Thị Thận Lâu Cảnh', element: 'Huyễn Vực', rarity: 'Linh Phẩm', rarity_key: 'rare', is_unique: false,
    base_energy: 4, enemy_active_debuff_pierce: 0, enemy_buff_suppression: 0,
    buffs: { haxProcBonusPct: 0.14, dodgeBonusPct: 0.08 }, debuffs: { accuracyDownPct: 0.16 },
    buff_desc: 'Tăng +14% xác suất HAX và +8% Né Tránh cho phe mình.',
    debuff_desc: 'Ảo cảnh biển sâu khiến địch giảm 16% chính xác.',
    scene: 'an ethereal crystal mirage palace shimmering above ocean fog',
  },
  {
    domain_id: 'domain_rare_3', name: 'Bát Quái Khóa Linh Trận', element: 'Trận Vực', rarity: 'Linh Phẩm', rarity_key: 'rare', is_unique: false,
    base_energy: 4, enemy_active_debuff_pierce: 0, enemy_buff_suppression: 0,
    buffs: { shieldStrengthBonusPct: 0.20, controlResistPct: 0.15 }, debuffs: { healReductionPct: 0.22 },
    buff_desc: 'Tăng +20% độ dày Khiên và +15% Kháng Khống Chế.',
    debuff_desc: 'Bát Quái phong ấn giảm 22% hồi phục của địch.',
    scene: 'rotating bronze Bagua trigram disc sealing swirling cyan Qi',
  },
  {
    domain_id: 'domain_rare_4', name: 'Hoàng Tuyền Quỷ Vụ Vực', element: 'Minh Vực', rarity: 'Linh Phẩm', rarity_key: 'rare', is_unique: false,
    base_energy: 4, enemy_active_debuff_pierce: 0, enemy_buff_suppression: 0,
    buffs: { lifestealPct: 0.14 }, debuffs: { dotMaxHpPct: 0.06, shieldDecayPct: 0.15 },
    buff_desc: 'Cộng +14% Hút Máu toàn trận cho phe mình.',
    debuff_desc: 'Độc vụ rút 6% HP tối đa/hiệp và bào mòn 15% khiên địch.',
    scene: 'yellow springs stone archway wreathed in eerie violet soul mist',
  },
  {
    domain_id: 'domain_rare_5', name: 'Thiên Quang Tịnh Thế Đàn', element: 'Thánh Vực', rarity: 'Linh Phẩm', rarity_key: 'rare', is_unique: false,
    base_energy: 4, enemy_active_debuff_pierce: 0, enemy_buff_suppression: 0,
    buffs: { trueDmgResistPct: 0.18, cleansePerTurn: 1 }, debuffs: { critTakenBonusPct: 0.16 },
    buff_desc: 'Giảm 18% Sát Thương Chuẩn & thanh tẩy 1 trạng thái xấu mỗi hiệp.',
    debuff_desc: 'Thánh quang soi rọi khiến địch nhận +16% sát thương Bạo Kích.',
    scene: 'elevated marble sun altar radiating golden purification rings',
  },

  // 5 Tiên Phẩm (Linh Mạch 5, Pierce 0%)
  {
    domain_id: 'domain_epic_1', name: 'Thái Bạch Tru Ma Kiếm Vực', element: 'Kiếm Vực', rarity: 'Tiên Phẩm', rarity_key: 'epic', is_unique: false,
    base_energy: 5, enemy_active_debuff_pierce: 0, enemy_buff_suppression: 0,
    buffs: { defPiercePct: 0.25, shieldPiercePct: 0.25 }, debuffs: { defReductionPct: 0.24, shieldDecayPct: 0.18 },
    buff_desc: 'Tăng +25% Xuyên Giáp & +25% Xuyên Khiên cho đòn đánh phe mình.',
    debuff_desc: 'Giảm 24% Giáp hiệu dụng & bào mòn 18% khiên chắn địch mỗi hiệp.',
    scene: 'celestial white-gold sword vortex hovering over cloud peaks',
  },
  {
    domain_id: 'domain_epic_2', name: 'Nguyệt Hoa Thiên Huyễn Cảnh', element: 'Huyễn Vực', rarity: 'Tiên Phẩm', rarity_key: 'epic', is_unique: false,
    base_energy: 5, enemy_active_debuff_pierce: 0, enemy_buff_suppression: 0,
    buffs: { haxProcBonusPct: 0.20, dodgeBonusPct: 0.12 }, debuffs: { accuracyDownPct: 0.22, haxFailPct: 0.15 },
    buff_desc: 'Tăng +20% xác suất HAX và +12% Né Tránh cho phe mình.',
    debuff_desc: 'Làm địch giảm 22% chính xác & giảm 15% tỉ lệ kích HAX.',
    scene: 'crescent moon reflection surrounded by glowing pink illusion mirrors',
  },
  {
    domain_id: 'domain_epic_3', name: 'Cửu Cung Khóa Thiên Đại Trận', element: 'Trận Vực', rarity: 'Tiên Phẩm', rarity_key: 'epic', is_unique: false,
    base_energy: 5, enemy_active_debuff_pierce: 0, enemy_buff_suppression: 0,
    buffs: { shieldStrengthBonusPct: 0.26, controlResistPct: 0.25 }, debuffs: { healReductionPct: 0.30, enemyShieldCapReductionPct: 0.25 },
    buff_desc: 'Tăng +26% hiệu lực Khiên & +25% Kháng Khống Chế.',
    debuff_desc: 'Giảm 30% hồi phục và cắt 25% hiệu lực tạo khiên của địch.',
    scene: 'nine luminous jade pillars forming an interlocking star array',
  },
  {
    domain_id: 'domain_epic_4', name: 'Cửu U Huyết Sát Minh Vực', element: 'Minh Vực', rarity: 'Tiên Phẩm', rarity_key: 'epic', is_unique: false,
    base_energy: 5, enemy_active_debuff_pierce: 0, enemy_buff_suppression: 0,
    buffs: { lifestealPct: 0.18, reflectResistPct: 0.30 }, debuffs: { dotMaxHpPct: 0.08, maxHpCutPct: 0.10 },
    buff_desc: 'Tăng +18% Hút Máu & giảm 30% sát thương Phản Đòn nhận phải.',
    debuff_desc: 'Rút 8% HP tối đa/hiệp & cắt giảm 10% trần HP tối đa của địch.',
    scene: 'crimson eclipse gates dripping spectral violet flames over black jade',
  },
  {
    domain_id: 'domain_epic_5', name: 'Thái Ất Lưu Ly Thánh Vực', element: 'Thánh Vực', rarity: 'Tiên Phẩm', rarity_key: 'epic', is_unique: false,
    base_energy: 5, enemy_active_debuff_pierce: 0, enemy_buff_suppression: 0,
    buffs: { trueDmgResistPct: 0.25, cleansePerTurn: 1, critResistPct: 0.25 }, debuffs: { critTakenBonusPct: 0.22 },
    buff_desc: 'Giảm 25% Sát Thương Chuẩn & 25% ST Bạo Kích + Thanh tẩy 1 debuff/hiệp.',
    debuff_desc: 'Thánh ấn khiến địch chịu thêm +22% sát thương Bạo Kích.',
    scene: 'radiant glazed amber dome inlaid with sacred lotus mandala sigils',
  },

  // 10 Thần Thoại Không Độc Nhất (Linh Mạch 6, Pierce 56% khi Vực địch còn)
  {
    domain_id: 'domain_mythic_1', name: '« Vạn Kiếm Quy Khư Thần Vực »', element: 'Kiếm Vực', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: false,
    base_energy: 6, enemy_active_debuff_pierce: 0.56, enemy_buff_suppression: 0.0,
    buffs: { defPiercePct: 0.34, shieldPiercePct: 0.34 }, debuffs: { defReductionPct: 0.32, shieldDecayPct: 0.22 },
    buff_desc: '+34% Xuyên Giáp & +34% Xuyên Khiên cho toàn bộ đòn đánh phe mình.',
    debuff_desc: 'Giảm 32% Giáp hiệu dụng & phá 22% khiên địch/hiệp (Thẩm Thấu 56% dù Vực địch còn).',
    scene: 'colossal heavenly sword halo splitting dark storm clouds with ten thousand golden blades',
  },
  {
    domain_id: 'domain_mythic_2', name: '« Tru Tiên Tứ Tượng Kiếm Trận »', element: 'Kiếm Vực', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: false,
    base_energy: 6, enemy_active_debuff_pierce: 0.56, enemy_buff_suppression: 0.0,
    buffs: { defPiercePct: 0.32, haxDamageBonusPct: 0.22 }, debuffs: { defReductionPct: 0.30, critTakenBonusPct: 0.24 },
    buff_desc: '+32% Xuyên Giáp & tăng +22% uy lực sát thương kỹ năng HAX.',
    debuff_desc: 'Giảm 30% Giáp & khiến địch nhận +24% ST Bạo Kích (Thẩm Thấu 56%).',
    scene: 'four cosmic cardinal spirit swords hovering over a crimson-gold rune abyss',
  },
  {
    domain_id: 'domain_mythic_3', name: '« Vạn Tượng Mộng Điệp Huyễn Vực »', element: 'Huyễn Vực', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: false,
    base_energy: 6, enemy_active_debuff_pierce: 0.56, enemy_buff_suppression: 0.0,
    buffs: { haxProcBonusPct: 0.26, dodgeBonusPct: 0.16 }, debuffs: { accuracyDownPct: 0.26, haxFailPct: 0.20 },
    buff_desc: '+26% xác suất kích hoạt HAX & +16% tỉ lệ Né Tránh.',
    debuff_desc: 'Giảm 26% chính xác & khóa 20% tỉ lệ HAX địch (Thẩm Thấu 56%).',
    scene: 'kaleidoscope of iridescent spirit butterflies shattering dimensional glass',
  },
  {
    domain_id: 'domain_mythic_4', name: '« Thiên Cơ Kính Hoa Thủy Nguyệt »', element: 'Huyễn Vực', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: false,
    base_energy: 6, enemy_active_debuff_pierce: 0.56, enemy_buff_suppression: 0.0,
    buffs: { haxProcBonusPct: 0.24, reflectResistPct: 0.45 }, debuffs: { accuracyDownPct: 0.22, enemyShieldCapReductionPct: 0.30 },
    buff_desc: '+24% xác suất HAX & giảm 45% sát thương Phản Đòn nhận phải.',
    debuff_desc: 'Giảm 22% chính xác & cắt 30% lượng Khiên địch tạo ra (Thẩm Thấu 56%).',
    scene: 'silver celestial mirror reflecting a glowing crescent moon over lotus ripples',
  },
  {
    domain_id: 'domain_mythic_5', name: '« Chu Thiên Tinh Đẩu Đại Trận »', element: 'Trận Vực', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: false,
    base_energy: 6, enemy_active_debuff_pierce: 0.56, enemy_buff_suppression: 0.0,
    buffs: { shieldStrengthBonusPct: 0.34, controlResistPct: 0.35 }, debuffs: { healReductionPct: 0.36, defReductionPct: 0.22 },
    buff_desc: '+34% hiệu lực Khiên & +35% Kháng mọi Khống Chế.',
    debuff_desc: 'Giảm 36% hồi phục & 22% Giáp hiệu dụng địch (Thẩm Thấu 56%).',
    scene: 'starry constellation astrolabe spinning three concentric gold-sapphire seal rings',
  },
  {
    domain_id: 'domain_mythic_6', name: '« Thái Cực Lưỡng Nghi Thần Trận »', element: 'Trận Vực', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: false,
    base_energy: 6, enemy_active_debuff_pierce: 0.56, enemy_buff_suppression: 0.0,
    buffs: { trueDmgResistPct: 0.30, shieldStrengthBonusPct: 0.30 }, debuffs: { enemyShieldCapReductionPct: 0.34, haxFailPct: 0.18 },
    buff_desc: 'Giảm 30% ST Chuẩn & tăng +30% độ dày Khiên chắn.',
    debuff_desc: 'Cắt 34% Khiên tạo mới & giảm 18% xác suất HAX địch (Thẩm Thấu 56%).',
    scene: 'glowing jade and obsidian Yin-Yang orb encircled by celestial talismans',
  },
  {
    domain_id: 'domain_mythic_7', name: '« A Tỳ Lục Đạo Minh Vực »', element: 'Minh Vực', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: false,
    base_energy: 6, enemy_active_debuff_pierce: 0.56, enemy_buff_suppression: 0.0,
    buffs: { lifestealPct: 0.22, haxDamageBonusPct: 0.20 }, debuffs: { dotMaxHpPct: 0.10, healReductionPct: 0.35 },
    buff_desc: '+22% Hút Máu & +20% uy lực sát thương HAX.',
    debuff_desc: 'Độc minh rút 10% HP tối đa/hiệp & giảm 35% hồi phục địch (Thẩm Thấu 56%).',
    scene: 'six-spoke wheel of samsara radiating violet-crimson netherworld flames',
  },
  {
    domain_id: 'domain_mythic_8', name: '« Thôn Phệ Tinh Hải Ám Vực »', element: 'Minh Vực', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: false,
    base_energy: 6, enemy_active_debuff_pierce: 0.56, enemy_buff_suppression: 0.0,
    buffs: { lifestealPct: 0.20, shieldPiercePct: 0.32 }, debuffs: { maxHpCutPct: 0.14, dotMaxHpPct: 0.07 },
    buff_desc: '+20% Hút Máu & +32% Xuyên Khiên Chắn.',
    debuff_desc: 'Cắt 14% trần HP tối đa & rút 7% HP/hiệp (Thẩm Thấu 56%).',
    scene: 'devouring cosmic black lotus vortex pulling glowing blue star fragments',
  },
  {
    domain_id: 'domain_mythic_9', name: '« Đại Nhật Như Lai Thánh Vực »', element: 'Thánh Vực', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: false,
    base_energy: 6, enemy_active_debuff_pierce: 0.56, enemy_buff_suppression: 0.0,
    buffs: { trueDmgResistPct: 0.32, critResistPct: 0.35 }, debuffs: { critTakenBonusPct: 0.28, defReductionPct: 0.24 },
    buff_desc: 'Giảm 32% ST Chuẩn & 35% ST Bạo Kích nhận vào.',
    debuff_desc: 'Địch nhận +28% ST Bạo Kích & giảm 24% Giáp hiệu dụng (Thẩm Thấu 56%).',
    scene: 'imperial golden sun halo throne behind twelve radiant lotus petals',
  },
  {
    domain_id: 'domain_mythic_10', name: '« Cửu Tiêu Tịnh Thế Tiên Vực »', element: 'Thánh Vực', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: false,
    base_energy: 6, enemy_active_debuff_pierce: 0.56, enemy_buff_suppression: 0.0,
    buffs: { cleansePerTurn: 1, controlResistPct: 0.40 }, debuffs: { healReductionPct: 0.32, shieldDecayPct: 0.24 },
    buff_desc: 'Thanh tẩy 1 hiệu ứng xấu/hiệp & +40% Kháng Khống Chế.',
    debuff_desc: 'Giảm 32% hồi máu & bào mòn 24% khiên địch/hiệp (Thẩm Thấu 56%).',
    scene: 'ascending nine-tiered pearl waterfall framed by golden clouds and phoenix feathers',
  },

  // 5 Thần Thoại Độc Nhất Toàn Server (Linh Mạch 7, Pierce 60% + Áp Chế 5% Buff Vực Địch -> Chênh <= 15%)
  {
    domain_id: 'domain_unique_1', name: '« Hỗn Nguyên Vô Cực Kiếm Vực »', element: 'Kiếm Vực', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: true,
    base_energy: 7, enemy_active_debuff_pierce: 0.60, enemy_buff_suppression: 0.05,
    buffs: { defPiercePct: 0.36, shieldPiercePct: 0.36 }, debuffs: { defReductionPct: 0.35, shieldDecayPct: 0.25 },
    buff_desc: '+36% Xuyên Giáp & +36% Xuyên Khiên + Giảm 5% hiệu lực Buff Vực địch.',
    debuff_desc: 'Giảm 35% Giáp & phá 25% khiên/hiệp (Phá Vực xuyên 60% dù Vực địch còn).',
    scene: 'mythic platinum-gold sword galaxy spiraling around an imperial dragon-hilted core blade',
  },
  {
    domain_id: 'domain_unique_2', name: '« Bỉ Ngạn Hồng Trần Huyễn Vực »', element: 'Huyễn Vực', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: true,
    base_energy: 7, enemy_active_debuff_pierce: 0.60, enemy_buff_suppression: 0.05,
    buffs: { haxProcBonusPct: 0.28, dodgeBonusPct: 0.18 }, debuffs: { accuracyDownPct: 0.27, haxFailPct: 0.22 },
    buff_desc: '+28% xác suất HAX & +18% Né Tránh + Giảm 5% hiệu lực Buff Vực địch.',
    debuff_desc: 'Giảm 27% chính xác & khóa 22% tỉ lệ HAX địch (Phá Vực xuyên 60%).',
    scene: 'crimson spider-lily spirit field beneath twin floating violet moons and phantom ribbons',
  },
  {
    domain_id: 'domain_unique_3', name: '« Tiên Thiên Bát Quái Thần Trận »', element: 'Trận Vực', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: true,
    base_energy: 7, enemy_active_debuff_pierce: 0.60, enemy_buff_suppression: 0.05,
    buffs: { shieldStrengthBonusPct: 0.36, controlResistPct: 0.42 }, debuffs: { healReductionPct: 0.38, enemyShieldCapReductionPct: 0.35 },
    buff_desc: '+36% hiệu lực Khiên & +42% Kháng Khống Chế + Giảm 5% Buff Vực địch.',
    debuff_desc: 'Giảm 38% hồi phục & cắt 35% Khiên tạo mới (Phá Vực xuyên 60%).',
    scene: 'celestial golden octagonal seal dome projecting glowing ancient rune chains',
  },
  {
    domain_id: 'domain_unique_4', name: '« Vĩnh Dạ Thệ Hồn Minh Vực »', element: 'Minh Vực', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: true,
    base_energy: 7, enemy_active_debuff_pierce: 0.60, enemy_buff_suppression: 0.05,
    buffs: { lifestealPct: 0.24, reflectResistPct: 0.48 }, debuffs: { dotMaxHpPct: 0.105, maxHpCutPct: 0.15 },
    buff_desc: '+24% Hút Máu & giảm 48% Phản Đòn + Giảm 5% Buff Vực địch.',
    debuff_desc: 'Rút 10.5% HP tối đa/hiệp & cắt 15% trần HP tối đa (Phá Vực xuyên 60%).',
    scene: 'eternal obsidian bone-crown throne ringed by soul-devouring azure-crimson wisps',
  },
  {
    domain_id: 'domain_unique_5', name: '« Hồng Mông Thần Quang Tịnh Vực »', element: 'Thánh Vực', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: true,
    base_energy: 7, enemy_active_debuff_pierce: 0.60, enemy_buff_suppression: 0.05,
    buffs: { trueDmgResistPct: 0.34, cleansePerTurn: 1, critResistPct: 0.38 }, debuffs: { critTakenBonusPct: 0.30, defReductionPct: 0.26 },
    buff_desc: 'Giảm 34% ST Chuẩn, 38% ST Bạo Kích & Thanh tẩy/hiệp + Giảm 5% Buff Vực địch.',
    debuff_desc: 'Địch chịu +30% ST Bạo Kích & -26% Giáp hiệu dụng (Phá Vực xuyên 60%).',
    scene: 'radiant rainbow-gold sacred phoenix sanctum pillars purifying dark mist',
  },

  // ĐỘC TÔN TIỂU THƯ FUYUMI
  {
    domain_id: 'domain_fuyumi_cuu_vi_hong_mong', name: '« Cửu Vĩ Hồng Mông Tuyệt Vực »', element: 'Hỗn Độn Vực', rarity: 'Tối Thượng Thần Thoại', rarity_key: 'supreme', is_unique: true, is_exclusive_fuyumi: true,
    base_energy: 999, enemy_active_debuff_pierce: 1.0, enemy_buff_suppression: 1.0, lock_enemy_debuffs: true,
    buffs: { defPiercePct: 0.60, shieldPiercePct: 0.60, haxProcBonusPct: 0.50, trueDmgResistPct: 0.50, cleansePerTurn: 2 },
    debuffs: { defReductionPct: 0.50, dotMaxHpPct: 0.12, healReductionPct: 0.60, maxHpCutPct: 0.25 },
    buff_desc: 'Bất Hoại (∞ Linh Mạch), +60% Xuyên Giáp/Khiên, +50% xác suất HAX, giảm 50% ST Chuẩn & khóa 100% Debuff Vực địch.',
    debuff_desc: 'Xuyên Vực 100% từ Hiệp 2: Giảm 50% Giáp, cắt 25% trần HP, giảm 60% hồi phục & thiêu đốt 12% HP tối đa/hiệp.',
    scene: 'imperial cherry-blossom chaos vortex with nine luminous rose-gold fox tails encircling a floating crystal throne',
  },
];

export const V13_DOMAINS = RAW_DOMAINS.map((d) => ({
  ...d,
  is_domain: true,
  category: 'domain',
  dao_ap: V14_DAO_AP_CONFIG[d.domain_id] || null,
  visual_prompt: buildDomainPrompt('Linh Vực (Domain Crest)', d.element, d.scene, Boolean(d.is_exclusive_fuyumi)),
}));

const RAW_DIVINE_SENSES = [
  // 3 Phàm (+1 Linh Mạch)
  { sense_id: 'sense_common_1', name: 'Thanh Tâm Thần Thức', rarity: 'Phàm Phẩm', rarity_key: 'common', is_unique: false, bonus_energy: 1, buff_boost_pct: 0.05, clash_resist_chance: 0, extra_enemy_drain: 0, desc: '+1 Linh Mạch tối đa & tăng +5% hiệu lực Buff sân nhà.', scene: 'serene teal jade third-eye lotus sigil glowing softly' },
  { sense_id: 'sense_common_2', name: 'Ngưng Thần Ấn Ký', rarity: 'Phàm Phẩm', rarity_key: 'common', is_unique: false, bonus_energy: 1, buff_boost_pct: 0.06, clash_resist_chance: 0, extra_enemy_drain: 0, desc: '+1 Linh Mạch tối đa & tăng +6% hiệu lực Buff sân nhà.', scene: 'golden meditation spiral seal with faint azure sparks' },
  { sense_id: 'sense_common_3', name: 'Tụ Linh Nhãn Thức', rarity: 'Phàm Phẩm', rarity_key: 'common', is_unique: false, bonus_energy: 1, buff_boost_pct: 0.06, clash_resist_chance: 0, extra_enemy_drain: 0, desc: '+1 Linh Mạch tối đa & tăng +6% hiệu lực Buff sân nhà.', scene: 'luminescent spirit eye crystal collecting drifting mana motes' },

  // 3 Linh (+2 Linh Mạch)
  { sense_id: 'sense_rare_1', name: 'Linh Đài Thanh Minh Thức', rarity: 'Linh Phẩm', rarity_key: 'rare', is_unique: false, bonus_energy: 2, buff_boost_pct: 0.08, clash_resist_chance: 0.15, extra_enemy_drain: 0, desc: '+2 Linh Mạch tối đa, +8% Buff sân nhà & 15% kháng trừ thêm điểm khắc hệ.', scene: 'azure crystal lotus eye radiating twin crescent spirit waves' },
  { sense_id: 'sense_rare_2', name: 'Huyền Giác Linh Thức', rarity: 'Linh Phẩm', rarity_key: 'rare', is_unique: false, bonus_energy: 2, buff_boost_pct: 0.09, clash_resist_chance: 0.15, extra_enemy_drain: 0, desc: '+2 Linh Mạch tối đa, +9% Buff sân nhà & 15% kháng hao tổn khắc hệ.', scene: 'violet-cyan mystic eye encircled by twin silver ring runes' },
  { sense_id: 'sense_rare_3', name: 'Thiên Nhãn Thông U Thức', rarity: 'Linh Phẩm', rarity_key: 'rare', is_unique: false, bonus_energy: 2, buff_boost_pct: 0.10, clash_resist_chance: 0.12, extra_enemy_drain: 0, desc: '+2 Linh Mạch tối đa, +10% Buff sân nhà & 12% kháng hao tổn khắc hệ.', scene: 'sharp sapphire eye rune piercing dark ink clouds' },

  // 3 Tiên (+3 Linh Mạch)
  { sense_id: 'sense_epic_1', name: 'Tiên Thiên Đạo Thức', rarity: 'Tiên Phẩm', rarity_key: 'epic', is_unique: false, bonus_energy: 3, buff_boost_pct: 0.12, clash_resist_chance: 0.30, extra_enemy_drain: 0, desc: '+3 Linh Mạch tối đa, +12% Buff sân nhà & 30% kháng trừ điểm khắc hệ.', scene: 'purple-gold celestial eye mandala with rotating star rings' },
  { sense_id: 'sense_epic_2', name: 'Bất Động Minh Vương Thức', rarity: 'Tiên Phẩm', rarity_key: 'epic', is_unique: false, bonus_energy: 3, buff_boost_pct: 0.13, clash_resist_chance: 0.35, extra_enemy_drain: 0, desc: '+3 Linh Mạch tối đa, +13% Buff sân nhà & 35% kháng trừ điểm khắc hệ.', scene: 'blazing golden vajra halo crown eye amidst protective flames' },
  { sense_id: 'sense_epic_3', name: 'Thái Hư Quy Nguyên Thức', rarity: 'Tiên Phẩm', rarity_key: 'epic', is_unique: false, bonus_energy: 3, buff_boost_pct: 0.14, clash_resist_chance: 0.25, extra_enemy_drain: 0, desc: '+3 Linh Mạch tối đa, +14% Buff sân nhà & 25% kháng trừ điểm khắc hệ.', scene: 'astral silver infinity iris surrounded by drifting nebula dust' },

  // 4 Thần Thoại Không Độc Nhất (+4 Linh Mạch -> Vực Thần Thoại từ 6 lên 10)
  { sense_id: 'sense_mythic_1', name: '« Cửu Chuyển Nguyên Thần Thức »', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: false, bonus_energy: 4, buff_boost_pct: 0.16, clash_resist_chance: 0.50, extra_enemy_drain: 0, desc: '+4 Linh Mạch (nâng Vực 6→10), +16% Buff sân nhà & 50% kháng hao tổn khắc hệ.', scene: 'nine-ringed divine golden eye halo floating above a crystalline soul core' },
  { sense_id: 'sense_mythic_2', name: '« Hồng Mông Tử Tiêu Thức »', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: false, bonus_energy: 4, buff_boost_pct: 0.17, clash_resist_chance: 0.45, extra_enemy_drain: 0, desc: '+4 Linh Mạch, +17% Buff sân nhà & 45% kháng trừ điểm khắc hệ.', scene: 'imperial amethyst phoenix-eye crest bursting with purple-gold stardust' },
  { sense_id: 'sense_mythic_3', name: '« Thái Cổ Long Hồn Thức »', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: false, bonus_energy: 4, buff_boost_pct: 0.16, clash_resist_chance: 0.50, extra_enemy_drain: 0, desc: '+4 Linh Mạch, +16% Buff sân nhà & 50% kháng trừ điểm khắc hệ.', scene: 'vertical golden dragon pupil rune crowned with cyan lightning horns' },
  { sense_id: 'sense_mythic_4', name: '« Hư Không Phá Vọng Nhãn »', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: false, bonus_energy: 4, buff_boost_pct: 0.18, clash_resist_chance: 0.40, extra_enemy_drain: 0, desc: '+4 Linh Mạch, +18% Buff sân nhà & 40% kháng trừ điểm khắc hệ.', scene: 'fractured dimensional violet eye peering through starry void runes' },

  // 2 Thần Thoại Độc Nhất (+5 và +6 Linh Mạch -> Vực Thần Thoại lên tới 12-13, cách <= 15%)
  { sense_id: 'sense_unique_1', name: '« Hỗn Độn Đại Đạo Thần Thức »', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: true, bonus_energy: 5, buff_boost_pct: 0.19, clash_resist_chance: 0.65, extra_enemy_drain: 0, desc: '+5 Linh Mạch tối đa, +19% Buff sân nhà & 65% kháng trừ điểm khắc hệ.', scene: 'supreme rainbow-gold cosmic eye spinning twelve ancient dao runes' },
  { sense_id: 'sense_unique_2', name: '« Vạn Cổ Bất Diệt Thần Thức »', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: true, bonus_energy: 6, buff_boost_pct: 0.18, clash_resist_chance: 0.70, extra_enemy_drain: 0, desc: '+6 Linh Mạch tối đa (nâng Vực 6→12), +18% Buff sân nhà & 70% kháng khắc hệ.', scene: 'immortal golden sun-crown soul orb radiating unbreakable diamond aura' },

  // ĐỘC TÔN TIỂU THƯ FUYUMI
  { sense_id: 'sense_fuyumi_thai_thuong_hong_ho', name: '« Thái Thượng Hồng Hồ Thần Thức »', rarity: 'Tối Thượng Thần Thoại', rarity_key: 'supreme', is_unique: true, is_exclusive_fuyumi: true, bonus_energy: 999, buff_boost_pct: 0.35, clash_resist_chance: 1.0, extra_enemy_drain: 2, desc: 'Gia cố Linh Mạch ∞, +35% toàn bộ Buff sân nhà & ép Linh Mạch địch sụp nhanh gấp đôi (-4/hiệp).', scene: 'sacred rose-pink and gold nine-tailed kitsune third-eye halo surrounded by cherry blossoms' },
];

export const V13_DIVINE_SENSES = RAW_DIVINE_SENSES.map((s) => ({
  ...s,
  is_sense: true,
  category: 'sense',
  visual_prompt: `2D cultivation Divine Sense (Thần Thức) emblem: ${s.scene}, ${EMOJI_ICON_STYLE_DIRECTIVE}.`,
}));

const RAW_DIVINE_REALMS = [
  // 3 Phàm (+8% Debuff gốc + 1 Debuff phụ)
  { realm_id: 'realm_common_1', name: 'Áp Hồn Thần Cảnh', rarity: 'Phàm Phẩm', rarity_key: 'common', is_unique: false, debuff_boost_pct: 0.08, extra_debuffs: { critTakenBonusPct: 0.08 }, desc: 'Tăng +8% hiệu lực Debuff Linh Vực & khiến địch nhận +8% ST Bạo Kích.', scene: 'glowing purple chain ring pressing down a cracked spirit stone' },
  { realm_id: 'realm_common_2', name: 'Trì Trệ Linh Cảnh', rarity: 'Phàm Phẩm', rarity_key: 'common', is_unique: false, debuff_boost_pct: 0.08, extra_debuffs: { accuracyDownPct: 0.08 }, desc: 'Tăng +8% hiệu lực Debuff Linh Vực & giảm 8% chính xác đòn đánh địch.', scene: 'swirling gray sand vortex hourglass wrapped in frost mist' },
  { realm_id: 'realm_common_3', name: 'Hấp Huyết Cảnh Giới', rarity: 'Phàm Phẩm', rarity_key: 'common', is_unique: false, debuff_boost_pct: 0.08, extra_debuffs: { healReductionPct: 0.12 }, desc: 'Tăng +8% hiệu lực Debuff Linh Vực & giảm 12% hồi máu của địch.', scene: 'crimson thorns twisting around a glowing red blood crystal' },

  // 3 Linh (+12% Debuff gốc + 1 Debuff phụ)
  { realm_id: 'realm_rare_1', name: 'Phệ Mệnh U Cảnh', rarity: 'Linh Phẩm', rarity_key: 'rare', is_unique: false, debuff_boost_pct: 0.12, extra_debuffs: { maxHpCutPct: 0.10 }, desc: 'Tăng +12% hiệu lực Debuff & cắt giảm trực tiếp 10% Máu tối đa của địch.', scene: 'cracked obsidian skull-moon sigil draining blue spirit threads' },
  { realm_id: 'realm_rare_2', name: 'Toái Giáp Lôi Cảnh', rarity: 'Linh Phẩm', rarity_key: 'rare', is_unique: false, debuff_boost_pct: 0.12, extra_debuffs: { shieldDecayPct: 0.15 }, desc: 'Tăng +12% hiệu lực Debuff & bào mòn 15% Khiên chắn địch mỗi hiệp.', scene: 'jagged azure lightning cracks shattering a golden spirit barrier' },
  { realm_id: 'realm_rare_3', name: 'Phong Ấn Trầm Luân Cảnh', rarity: 'Linh Phẩm', rarity_key: 'rare', is_unique: false, debuff_boost_pct: 0.12, extra_debuffs: { haxFailPct: 0.12 }, desc: 'Tăng +12% hiệu lực Debuff & giảm 12% tỉ lệ kích hoạt HAX của địch.', scene: 'heavy bronze seal bell wrapped in glowing violet binding ribbons' },

  // 3 Tiên (+18% Debuff gốc + 1 Debuff phụ)
  { realm_id: 'realm_epic_1', name: 'Khô Kiệt Huyết Hải Cảnh', rarity: 'Tiên Phẩm', rarity_key: 'epic', is_unique: false, debuff_boost_pct: 0.18, extra_debuffs: { maxHpCutPct: 0.15, healReductionPct: 0.15 }, desc: 'Tăng +18% hiệu lực Debuff, cắt 15% Máu tối đa & giảm 15% hồi phục địch.', scene: 'evaporating crimson lotus lake framed by scorching golden runes' },
  { realm_id: 'realm_epic_2', name: 'Phá Đạo Tuyệt Linh Cảnh', rarity: 'Tiên Phẩm', rarity_key: 'epic', is_unique: false, debuff_boost_pct: 0.18, extra_debuffs: { defReductionPct: 0.18 }, desc: 'Tăng +18% hiệu lực Debuff & giảm thêm 18% Giáp hiệu dụng của địch.', scene: 'floating silver guillotine runes cleaving through armored mist' },
  { realm_id: 'realm_epic_3', name: 'Thiên Hỏa Phần Thành Cảnh', rarity: 'Tiên Phẩm', rarity_key: 'epic', is_unique: false, debuff_boost_pct: 0.18, extra_debuffs: { dotMaxHpPct: 0.06 }, desc: 'Tăng +18% hiệu lực Debuff & thiêu đốt thêm 6% Máu tối đa địch mỗi hiệp.', scene: 'blazing crimson-gold phoenix flame pillar wreathing an ancient gate' },

  // 4 Thần Thoại Không Độc Nhất (+25% Debuff gốc + Debuff Thần Thoại -> VD giảm 20% Máu tối đa)
  { realm_id: 'realm_mythic_1', name: '« Đoạn Mệnh Vô Tận Thần Cảnh »', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: false, debuff_boost_pct: 0.25, extra_debuffs: { maxHpCutPct: 0.20 }, desc: 'Tăng +25% hiệu lực Debuff gốc & cắt giảm 20% Máu tối đa của đối thủ!', scene: 'crimson-violet celestial scythe halo slicing an orb of life force' },
  { realm_id: 'realm_mythic_2', name: '« Cấm Linh Tuyệt Diệt Thần Cảnh »', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: false, debuff_boost_pct: 0.25, extra_debuffs: { healReductionPct: 0.35, shieldDecayPct: 0.18 }, desc: 'Tăng +25% Debuff gốc, khóa 35% hồi máu & bào mòn 18% Khiên địch/hiệp.', scene: 'nine dark-gold sealing chains crushing a shimmering emerald chalice' },
  { realm_id: 'realm_mythic_3', name: '« Thiên Phạt Lôi Ngục Thần Cảnh »', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: false, debuff_boost_pct: 0.25, extra_debuffs: { defReductionPct: 0.24, critTakenBonusPct: 0.20 }, desc: 'Tăng +25% Debuff gốc, phá 24% Giáp & khiến địch nhận +20% ST Bạo Kích.', scene: 'heavenly violet thunder cage raining molten judgment bolts' },
  { realm_id: 'realm_mythic_4', name: '« Hư Vô Phệ Hồn Thần Cảnh »', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: false, debuff_boost_pct: 0.25, extra_debuffs: { dotMaxHpPct: 0.08, haxFailPct: 0.18 }, desc: 'Tăng +25% Debuff gốc, đốt 8% HP/hiệp & giảm 18% xác suất HAX địch.', scene: 'void black hole crystal tendrils consuming golden spirit sparks' },

  // 2 Thần Thoại Độc Nhất (+28% Debuff gốc + Debuff Thần Thoại Độc Nhất -> giữ chênh lệch <= 15%)
  { realm_id: 'realm_unique_1', name: '« Thái Sơ Vẫn Lạc Thần Cảnh »', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: true, debuff_boost_pct: 0.28, extra_debuffs: { maxHpCutPct: 0.23, shieldDecayPct: 0.22 }, desc: 'Tăng +28% hiệu lực Debuff gốc, cắt 23% Máu tối đa & phá 22% Khiên địch/hiệp!', scene: 'ancient falling meteor constellation shattering a golden shield sphere' },
  { realm_id: 'realm_unique_2', name: '« Vạn Kiếp Quy Khư Thần Cảnh »', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: true, debuff_boost_pct: 0.28, extra_debuffs: { defReductionPct: 0.27, healReductionPct: 0.40 }, desc: 'Tăng +28% hiệu lực Debuff gốc, giảm 27% Giáp & khóa 40% hồi phục địch!', scene: 'abyssal violet-gold maelstrom crown draining sacred jade flames' },

  // ĐỘC TÔN TIỂU THƯ FUYUMI
  { realm_id: 'realm_fuyumi_van_co_tuyet_diet', name: '« Vạn Cổ Tuyệt Diệt Thần Cảnh »', rarity: 'Tối Thượng Thần Thoại', rarity_key: 'supreme', is_unique: true, is_exclusive_fuyumi: true, debuff_boost_pct: 0.50, extra_debuffs: { maxHpCutPct: 0.35, healReductionPct: 0.70, shieldDecayPct: 0.45 }, desc: 'Tăng +50% hiệu lực mọi Debuff, chém bay 35% Máu tối đa địch ngay Hiệp 2, khóa 70% hồi phục & nghiền 45% Khiên/hiệp.', scene: 'supreme imperial crimson-rose lotus apocalypse crest with shattering golden judgment seals' },
];

export const V13_DIVINE_REALMS = RAW_DIVINE_REALMS.map((r) => ({
  ...r,
  is_realm: true,
  category: 'realm',
  visual_prompt: `2D cultivation Divine Realm (Thần Cảnh) emblem: ${r.scene}, ${EMOJI_ICON_STYLE_DIRECTIVE}.`,
}));

// =========================================================================
// 50 LINH THÚ MỚI (10 Phàm/Linh/Tiên + 30 Thần Thoại Thường + 10 Độc Nhất)
// =========================================================================
const RAW_NEW_PETS = [
  // 3 Phàm Phẩm
  { pet_type: 'linh_ho_tieu_bach', pet_name: 'Linh Hồ Tiểu Bạch', element: 'Quang', rarity: 'Phàm Phẩm', rarity_key: 'common', is_unique: false, atk: 185, def: 175, spd: 220, hax_skill: 'Bạch Quang Hộ Thể', hax_desc: 'Đầu trận nhận khiên 18% HP tối đa & tăng +8% chính xác.', scene: 'a cute fluffy white spirit fox kit with glowing silver-gold tail tip' },
  { pet_type: 'xich_thach_tieu_quy', pet_name: 'Xích Thạch Tiểu Quy', element: 'Thổ', rarity: 'Phàm Phẩm', rarity_key: 'common', is_unique: false, atk: 145, def: 265, spd: 130, hax_skill: 'Thạch Giáp Nặng Nề', hax_desc: 'Giảm 14% sát thương vật lý nhận vào trong 3 hiệp đầu.', scene: 'an adorable moss-backed red basalt baby tortoise with glowing amber shell cracks' },
  { pet_type: 'thanh_lam_tieu_dieu', pet_name: 'Thanh Lam Tiểu Diều', element: 'Thủy', rarity: 'Phàm Phẩm', rarity_key: 'common', is_unique: false, atk: 195, def: 165, spd: 235, hax_skill: 'Thủy Tiễn Liên Kích', hax_desc: '18% xác suất bắn thêm mũi tên băng gây 35% ATK.', scene: 'a sleek turquoise water spirit hawk perched on a floating frost droplet' },

  // 3 Linh Phẩm
  { pet_type: 'kim_van_linh_bao', pet_name: 'Kim Văn Linh Báo', element: 'Kim', rarity: 'Linh Phẩm', rarity_key: 'rare', is_unique: false, atk: 355, def: 285, spd: 370, hax_skill: 'Kim Trảo Phá Phong', hax_desc: 'Đòn Bạo Kích xuyên 35% giáp DEF của đối thủ.', scene: 'an agile golden-striped spiritual leopard with gleaming metallic blade claws' },
  { pet_type: 'u_lam_linh_diep', pet_name: 'U Lam Linh Điệp', element: 'Mộc', rarity: 'Linh Phẩm', rarity_key: 'rare', is_unique: false, atk: 315, def: 325, spd: 355, hax_skill: 'Phấn Hoa Mê Hoặc', hax_desc: '20% xác suất gây Ngủ 1 hiệp & hồi 6% HP cho bản thân.', scene: 'a luminous sapphire-emerald spirit butterfly with glowing runes across its wings' },
  { pet_type: 'hac_diem_linh_nha', pet_name: 'Hắc Diễm Linh Nha', element: 'Ám', rarity: 'Linh Phẩm', rarity_key: 'rare', is_unique: false, atk: 365, def: 270, spd: 350, hax_skill: 'U Minh Ám Hỏa', hax_desc: 'Gây thiêu đốt bóng tối rút 6% HP hiện tại của địch mỗi hiệp.', scene: 'a mystical three-eyed obsidian spirit crow cloaked in violet-black flames' },

  // 4 Tiên Phẩm
  { pet_type: 'bach_ngoc_ky_lan', pet_name: 'Bạch Ngọc Kỳ Lân', element: 'Quang', rarity: 'Tiên Phẩm', rarity_key: 'epic', is_unique: false, atk: 430, def: 440, spd: 420, hax_skill: 'Thánh Ngọc Hộ Chủ', hax_desc: 'Đầu trận tạo khiên 45% HP tối đa & miễn nhiễm Choáng trong 2 hiệp.', scene: 'a majestic carved white-jade qilin with golden hooves and a luminous horn' },
  { pet_type: 'thien_loi_thach_vien', pet_name: 'Thiên Lôi Thạch Viên', element: 'Lôi', rarity: 'Tiên Phẩm', rarity_key: 'epic', is_unique: false, atk: 470, def: 390, spd: 430, hax_skill: 'Lôi Côn Chấn Địa', hax_desc: '25% tỉ lệ gây Choáng 1 hiệp & tăng +15% Crit toàn trận.', scene: 'a muscular celestial storm ape wielding crackling violet thunderstones' },
  { pet_type: 'huyen_bang_thuy_long', pet_name: 'Huyền Băng Thủy Long', element: 'Thủy', rarity: 'Tiên Phẩm', rarity_key: 'epic', is_unique: false, atk: 440, def: 430, spd: 425, hax_skill: 'Hàn Long Thổ Tức', hax_desc: '25% đóng băng địch 1 hiệp & giảm 15% SPD đối phương.', scene: 'a sinuous sapphire-ice dragon coiled around frozen frost lotus crystals' },
  { pet_type: 'huyet_sat_kiem_ho', pet_name: 'Huyết Sát Kiếm Hổ', element: 'Kim', rarity: 'Tiên Phẩm', rarity_key: 'epic', is_unique: false, atk: 485, def: 360, spd: 455, hax_skill: 'Bạch Hổ Kiếm Khí', hax_desc: 'Xuyên 40% DEF & tăng +20% sát thương khi máu địch trên 60%.', scene: 'a fierce crimson-armored white tiger surrounded by floating spirit blades' },

  // 30 Thần Thoại Không Độc Nhất (Sum Base Stats: 1620 - 1680)
  { pet_type: 'cuu_tieu_kim_long', pet_name: 'Cửu Tiêu Kim Long', element: 'Kim', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: false, atk: 560, def: 520, spd: 570, hax_skill: 'Long Hoàng Trấn Áp', hax_desc: 'Xuyên 50% giáp DEF & tăng +6% ATK mỗi hiệp (tối đa 5 tầng).', scene: 'an imperial golden sky dragon soaring through radiant cloud halos' },
  { pet_type: 'thai_co_bach_ho', pet_name: 'Thái Cổ Bạch Hổ', element: 'Kim', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: false, atk: 590, def: 470, spd: 590, hax_skill: 'Canh Kim Sát Lục', hax_desc: 'Tăng +20% Crit & đòn Bạo Kích xuyên 70% Khiên Chắn đối thủ.', scene: 'a primordial white saber-tiger wreathed in platinum sword Qi and gold runes' },
  { pet_type: 'huyen_minh_cuu_phuong', pet_name: 'Huyền Minh Cửu Phượng', element: 'Hỏa', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: false, atk: 575, def: 480, spd: 605, hax_skill: 'Cửu Vỹ Hỏa Vũ', hax_desc: 'Đòn đánh thiêu đốt 9% HP tối đa địch & hồi sinh 1 lần với 45% HP.', scene: 'a nine-plumed crimson-gold phoenix unleashing blazing celestial feathers' },
  { pet_type: 'tu_vi_huyen_quy', pet_name: 'Tử Vi Huyền Quy', element: 'Thủy', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: false, atk: 490, def: 640, spd: 510, hax_skill: 'Bắc Đẩu Giáp Thần', hax_desc: 'Giảm 28% mọi sát thương nhận vào & phản lại 40% sát thương.', scene: 'a cosmic purple starlight tortoise carrying a glowing constellation dome' },
  { pet_type: 'hon_nguyen_thanh_long', pet_name: 'Hỗn Nguyên Thanh Long', element: 'Mộc', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: false, atk: 530, def: 560, spd: 560, hax_skill: 'Thái Ất Trường Sinh', hax_desc: 'Hồi 7% HP tối đa mỗi hiệp & tự hóa giải 1 debuff/hiệp.', scene: 'an emerald celestial wood dragon entwined with luminous spirit vines' },
  { pet_type: 'loi_than_cuu_ung', pet_name: 'Lôi Thần Cửu Ưng', element: 'Lôi', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: false, atk: 570, def: 460, spd: 630, hax_skill: 'Thần Lôi Chiết Quang', hax_desc: '30% gây Tê Liệt & cướp 25% SPD địch chuyển thành ATK trong 4 hiệp.', scene: 'a storm-crowned nine-eyed thunder eagle crackling with violet plasma' },
  { pet_type: 'thien_co_ngoc_ho', pet_name: 'Thiên Cơ Ngọc Hồ', element: 'Quang', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: false, atk: 540, def: 520, spd: 590, hax_skill: 'Thiên Cơ Đảo Ảnh', hax_desc: '28% né hoàn toàn đòn đánh & phản công 90% ATK chuẩn.', scene: 'a graceful translucent white jade fox spirit orbited by golden astrolabe rings' },
  { pet_type: 'u_do_ma_lang', pet_name: 'U Đô Ma Lang', element: 'Ám', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: false, atk: 600, def: 460, spd: 590, hax_skill: 'Phệ Hồn Huyết Trảo', hax_desc: 'Hút 28% sát thương thành HP & giảm 45% hiệu lực hồi máu của địch.', scene: 'a fierce abyssal shadow wolf with crimson runes burning across obsidian fur' },
  { pet_type: 'van_nhac_than_ngu', pet_name: 'Vạn Nhạc Thần Ngưu', element: 'Thổ', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: false, atk: 510, def: 630, spd: 490, hax_skill: 'Trấn Nhạc Sơn Hà', hax_desc: 'Đầu trận tạo khiên 70% HP & giảm 35% sát thương Bạo Kích nhận vào.', scene: 'a colossal amber mountain ox armored in ancient golden monolith plates' },
  { pet_type: 'tinh_van_cuu_loc', pet_name: 'Tinh Vân Cửu Lộc', element: 'Hư Không', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: false, atk: 535, def: 545, spd: 580, hax_skill: 'Tinh Thần Độ Thế', hax_desc: 'Đầu trận miễn nhiễm 1 đòn chí tử & hồi 6% HP mỗi hiệp.', scene: 'a celestial nine-antlered starlight stag floating amidst glowing nebula dust' },
  { pet_type: 'xich_diem_ky_lan', pet_name: 'Xích Diễm Kỳ Lân', element: 'Hỏa', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: false, atk: 585, def: 505, spd: 560, hax_skill: 'Phần Thiên Thánh Hỏa', hax_desc: 'Xuyên 55% DEF & thiêu đốt 9% HP tối đa địch bỏ qua khiên.', scene: 'a blazing crimson fire qilin galloping across molten golden embers' },
  { pet_type: 'thuy_vu_thanh_phuong', pet_name: 'Thủy Vũ Thánh Phượng', element: 'Thủy', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: false, atk: 540, def: 530, spd: 580, hax_skill: 'Băng Tâm Tịnh Hóa', hax_desc: '28% Đóng Băng địch 1 hiệp & thanh tẩy hiệu ứng bất lợi mỗi 2 hiệp.', scene: 'an elegant ice-blue phoenix trailing sparkling crystalline frost ribbons' },
  { pet_type: 'cuu_u_huyen_xoa', pet_name: 'Cửu U Huyền Xà', element: 'Ám', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: false, atk: 575, def: 495, spd: 580, hax_skill: 'Thất Bộ Đoạt Mệnh Độc', hax_desc: 'Tẩm kịch độc cộng dồn 5%→11% HP tối đa địch mỗi hiệp.', scene: 'a coiled obsidian-purple abyssal serpent crowned with glowing ruby scales' },
  { pet_type: 'thien_khong_kim_dieu', pet_name: 'Thiên Khung Kim Điêu', element: 'Kim', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: false, atk: 580, def: 455, spd: 625, hax_skill: 'Thiên Nhận Trảm Phong', hax_desc: '30% tung liên kích phụ 65% ATK xuyên 45% DEF.', scene: 'a razor-winged golden roc diving through silver swordlight trails' },
  { pet_type: 'tu_tieu_loi_su', pet_name: 'Tử Tiêu Lôi Sư', element: 'Lôi', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: false, atk: 580, def: 510, spd: 570, hax_skill: 'Tử Lôi Phá Khiên', hax_desc: 'Đòn đánh xuyên 65% Khiên chắn & 25% tỉ lệ gây Choáng 1 hiệp.', scene: 'an imperial purple thunder lion with mane of crackling storm lightning' },
  { pet_type: 'moc_hoang_than_tuoc', pet_name: 'Mộc Hoàng Thần Tước', element: 'Mộc', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: false, atk: 525, def: 555, spd: 570, hax_skill: 'Vạn Mộc Triền Thân', hax_desc: 'Hút 12% HP hiện tại của địch ở hiệp 1 và mỗi 3 hiệp, khóa 25% ATK địch.', scene: 'a majestic emerald peacock guardian with living spirit blossom tail feathers' },
  { pet_type: 'hoang_tuyen_minh_ho', pet_name: 'Hoàng Tuyền Minh Hổ', element: 'Ám', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: false, atk: 590, def: 490, spd: 580, hax_skill: 'Minh Hổ Đoạt Hồn', hax_desc: 'Địch dưới 22% HP có 45% tỉ lệ kết liễu tức thì.', scene: 'a phantom dark-violet underworld tiger prowling through ghostly blue flames' },
  { pet_type: 'quang_linh_cuu_ho', pet_name: 'Quang Linh Cửu Hồ', element: 'Quang', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: false, atk: 550, def: 525, spd: 585, hax_skill: 'Thánh Hồ Mị Ảnh', hax_desc: '35% tỉ lệ Mị Hoặc khiến địch tự đánh mình & tạo khiên 35% HP.', scene: 'a celestial golden-white nine-tailed fox wrapped in luminous solar halos' },
  { pet_type: 'thai_at_than_trach', pet_name: 'Thái Ất Thần Trạch', element: 'Thổ', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: false, atk: 515, def: 615, spd: 510, hax_skill: 'Thần Trạch Tiên Tri', hax_desc: 'Đầu trận tạo khiên 60% HP & giảm 22% mọi sát thương nhận vào.', scene: 'a wise six-horned golden white mythical baize beast surrounded by jade scrolls' },
  { pet_type: 'huyen_thien_vo_cuc_ngao', pet_name: 'Huyền Thiên Vô Cực Ngao', element: 'Hư Không', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: false, atk: 545, def: 575, spd: 540, hax_skill: 'Thái Hư Thôn Phệ', hax_desc: 'Hấp thụ 35% khiên của địch chuyển thành khiên cho bản thân ở mỗi 2 hiệp.', scene: 'a colossal starry cosmic sky-whale turtle swimming through purple astral rifts' },
  { pet_type: 'kim_quang_toan_nghe', pet_name: 'Kim Quang Toan Nghê', element: 'Hỏa', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: false, atk: 580, def: 520, spd: 550, hax_skill: 'Tiên Hỏa Phản Chấn', hax_desc: 'Phản lại 35% sát thương nhận vào kèm thiêu đốt 6% HP địch.', scene: 'a mythical golden fire-dragon lion breathing sacred incense flames' },
  { pet_type: 'thanh_bang_hai_hoang', pet_name: 'Thanh Băng Hải Hoàng', element: 'Thủy', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: false, atk: 550, def: 560, spd: 550, hax_skill: 'Vạn Hải Băng Phong', hax_desc: '30% đóng băng địch & giảm 20% ATK đối phương trong 3 hiệp đầu.', scene: 'a deep-sea sapphire frost leviathan crowned with glowing ice coral' },
  { pet_type: 'loi_kiet_thien_long', pet_name: 'Lôi Kiếp Thiên Long', element: 'Lôi', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: false, atk: 585, def: 495, spd: 590, hax_skill: 'Cửu Trùng Thần Kiếp', hax_desc: 'Mỗi 2 hiệp giáng Lôi Kiếp gây 85% ATK sát thương xuyên 60% DEF.', scene: 'a storm-forged indigo thunder dragon descending from golden lightning clouds' },
  { pet_type: 'xich_nguyet_tue_ho', pet_name: 'Xích Nguyệt Tuế Hồ', element: 'Hỏa', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: false, atk: 570, def: 485, spd: 605, hax_skill: 'Huyết Nguyệt Hỏa Ấn', hax_desc: 'Tăng +18% Crit & hồi máu bằng 22% sát thương Bạo Kích gây ra.', scene: 'a scarlet blood-moon spirit fox shrouded in swirling vermilion embers' },
  { pet_type: 'thach_hoang_cu_linh', pet_name: 'Thạch Hoàng Cự Linh', element: 'Thổ', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: false, atk: 520, def: 625, spd: 495, hax_skill: 'Đại Địa Bất Bại', hax_desc: 'Chặn 1 đòn chí tử tại 15% HP (1 lần/trận) & nổ khiên 18% HP địch.', scene: 'an ancient obsidian-gold rune golem guardian pulsing with earth magma' },
  { pet_type: 'tinh_tu_thien_nga', pet_name: 'Tinh Tú Thiên Nga', element: 'Quang', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: false, atk: 530, def: 540, spd: 590, hax_skill: 'Tinh Hà Thánh Vũ', hax_desc: 'Miễn nhiễm Choáng/Đóng Băng & hồi 6% HP tối đa mỗi hiệp.', scene: 'a celestial silver-winged swan glowing with golden constellation trails' },
  { pet_type: 'u_linh_kiem_ma', pet_name: 'U Linh Kiếm Ma', element: 'Ám', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: false, atk: 595, def: 455, spd: 600, hax_skill: 'Quỷ Kiếm Tuyệt Sát', hax_desc: 'Xuyên 60% giáp DEF & đánh cắp 15% ATK địch cộng dồn 3 hiệp.', scene: 'a spectral phantom wolf knight holding cursed violet spirit blades' },
  { pet_type: 'vu_tru_khong_lo', pet_name: 'Vũ Trụ Không Lô', element: 'Hư Không', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: false, atk: 550, def: 540, spd: 580, hax_skill: 'Không Gian Đoạn Tầng', hax_desc: 'Đầu trận khóa HAX đối thủ 1 hiệp & xuyên 50% Khiên Chắn.', scene: 'a dimensional crystal spirit lynx stepping out of a glowing starry portal' },
  { pet_type: 'van_moc_xuan_long', pet_name: 'Vạn Mộc Xuân Long', element: 'Mộc', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: false, atk: 525, def: 570, spd: 565, hax_skill: 'Thiên Địa Hồi Xuân', hax_desc: 'Hồi 7% HP mỗi hiệp & tạo lá chắn 25% HP đầu trận.', scene: 'a spring blossom jade dragon adorned with glowing emerald petals' },
  { pet_type: 'thai_duong_than_su', pet_name: 'Thái Dương Thần Sư', element: 'Hỏa', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: false, atk: 590, def: 500, spd: 570, hax_skill: 'Nhật Diệm Phá Giáp', hax_desc: 'Mỗi đòn giảm 12% DEF địch (tối đa 4 tầng) & đốt 8% HP/hiệp.', scene: 'a blazing sun-maned golden lion guardian radiating solar flare halos' },

  // 10 Thần Thoại Độc Nhất Toàn Server (Base Stats sum 1685 - 1710, + HAX nhỉnh ~3% => Tổng chênh <= 15%)
  { pet_type: 'hon_don_chi_to_long', pet_name: '« Hỗn Độn Chi Tổ Long »', element: 'Hỗn Độn', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: true, atk: 575, def: 555, spd: 565, hax_skill: 'Tổ Long Khai Thiên', hax_desc: 'Xuyên 55% Giáp/Khiên & tăng +7% ATK mỗi hiệp (tối đa 5 tầng).', scene: 'the primordial ancestor dragon with rainbow-gold scales parting chaotic galaxies' },
  { pet_type: 'thai_so_cuu_phuong_hoang', pet_name: '« Thái Sơ Cửu Phượng Hoàng »', element: 'Hỏa', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: true, atk: 585, def: 510, spd: 595, hax_skill: 'Bất Tử Thần Diệm', hax_desc: 'Hồi sinh 1 lần với 48% HP & thiêu đốt 8% HP tối đa địch mỗi hiệp.', scene: 'primordial nine-crowned imperial phoenix rising from golden-rose nirvana embers' },
  { pet_type: 'van_kiem_de_ton_ho', pet_name: '« Vạn Kiếm Đế Tôn Hổ »', element: 'Kim', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: true, atk: 605, def: 495, spd: 590, hax_skill: 'Bạch Đế Tru Tiên', hax_desc: 'Xuyên 70% Khiên, +20% Crit & xuyên 52% DEF.', scene: 'imperial silver-armored white tiger emperor floating atop a halo of mythic swords' },
  { pet_type: 'bac_hai_huyen_vu_de', pet_name: '« Bắc Hải Huyền Vũ Đế »', element: 'Thủy', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: true, atk: 510, def: 655, spd: 525, hax_skill: 'Thái Thủy Bất Hoại', hax_desc: 'Giảm 30% mọi sát thương, phản đòn 42% & 25% đóng băng địch.', scene: 'colossal glacial sapphire dragon-turtle wearing a crown of northern aurora ice' },
  { pet_type: 'thoi_khong_than_tinh_ho', pet_name: '« Thời Không Thần Tinh Hồ »', element: 'Hư Không', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: true, atk: 570, def: 530, spd: 600, hax_skill: 'Thời Không Nghịch Chuyển', hax_desc: '1 lần/trận khi HP < 35% hồi ngay 32% HP, giải debuff & thêm 1 lượt.', scene: 'ethereal astral nine-tailed star fox walking across glowing clockwork cosmos rings' },
  { pet_type: 'thai_cuc_thanh_quang_thu', pet_name: '« Thái Cực Thánh Quang Thú »', element: 'Quang', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: true, atk: 535, def: 580, spd: 575, hax_skill: 'Vạn Pháp Quy Tông', hax_desc: 'Miễn nhiễm Khống Chế & hồi 8% HP tối đa + thanh tẩy 1 debuff/hiệp.', scene: 'luminous white-gold lion unicorn haloed by a spinning Taiji crystal mandala' },
  { pet_type: 'cuu_u_do_than_diem_lang', pet_name: '« Cửu U Đồ Thần Diễm Lang »', element: 'Ám', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: true, atk: 600, def: 500, spd: 590, hax_skill: 'Đoạn Hồn Huyết Sát', hax_desc: 'Hút 28% sát thương & kết liễu địch dưới 24% HP (tỉ lệ 45%).', scene: 'demon-god abyssal wolf wreathed in crimson eclipse lightning and dark chains' },
  { pet_type: 'thanh_de_van_co_long', pet_name: '« Thanh Đế Vạn Cổ Long »', element: 'Mộc', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: true, atk: 540, def: 580, spd: 570, hax_skill: 'Thần Mộc Bất Diệt', hax_desc: 'Hồi 9% HP/hiệp, miễn nhiễm độc/đốt & tạo khiên 35% HP đầu trận.', scene: 'ancient emerald world-tree dragon blossoming with luminous golden spirit flowers' },
  { pet_type: 'cuu_thien_loi_de_ho', pet_name: '« Cửu Thiên Lôi Đế Hồ »', element: 'Lôi', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: true, atk: 585, def: 485, spd: 625, hax_skill: 'Lôi Đế Thần Tốc', hax_desc: 'Ưu tiên đánh trước + cướp 28% SPD địch & 26% gây Choáng 1 hiệp.', scene: 'thunder-emperor golden spirit fox haloed by nine crackling lightning drums' },
  { pet_type: 'hoang_thien_ban_co_lan', pet_name: '« Hoàng Thiên Bàn Cổ Lân »', element: 'Thổ', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: true, atk: 525, def: 645, spd: 515, hax_skill: 'Bàn Cổ Trấn Thiên', hax_desc: 'Đầu trận khiên 72% HP; vỡ khiên nổ gây 20% HP tối đa ST chuẩn.', scene: 'primordial imperial amber qilin armored in glowing mountain-pillar runes' },
];

export const V13_NEW_PETS = RAW_NEW_PETS.map((p) => ({
  pet_type: p.pet_type,
  pet_name: p.pet_name,
  element: p.element,
  rarity: p.rarity,
  rarity_key: p.rarity_key,
  base_atk: p.atk,
  base_def: p.def,
  base_spd: p.spd,
  hax_skill: p.hax_skill,
  hax_description: p.hax_desc,
  image_file: `pets/${p.pet_type}.png`,
  is_starter: false,
  is_exclusive_fuyumi: false,
  is_unique: Boolean(p.is_unique),
  drop_rate: p.rarity_key === 'mythic' ? 0.5 : p.rarity_key === 'epic' ? 14.0 : p.rarity_key === 'rare' ? 25.0 : 60.5,
  base_hp: Math.max(500, 1000 + p.def * 5),
  base_power: p.atk * 3 + p.def * 2 + p.spd * 2 + 50,
  visual_prompt: buildPetPrompt(p.element, p.rarity_key, p.scene),
}));

// =========================================================================
// 100 PHÁP BẢO MỚI: 34 VŨ KHÍ + 33 BẢO NGỌC + 33 CHIẾN HỒN
// (20 Phàm/Linh/Tiên + 50 Thần Thoại Thường + 30 Thần Thoại Độc Nhất)
// =========================================================================
const RAW_NEW_EQUIPMENT = [
  // ---- 34 VŨ KHÍ (7 Phàm/Linh/Tiên + 17 Thần Thoại Thường + 10 Độc Nhất) ----
  { item_id: 'weapon_common_7', item_name: 'Thanh Ngọc Đoản Kiếm', item_type: 'weapon', rarity: 'Phàm Phẩm', rarity_key: 'common', element: 'Mộc', bonus_atk: 155, bonus_def: 20, bonus_spd: 40, bonus_hp: 0, bonus_crit: 4, hax_skill: null, hax_desc: 'Hồi nhẹ 4% HP khi tung đòn Bạo Kích.', scene: 'a carved emerald jade shortsword wrapped with silk tassels' },
  { item_id: 'weapon_common_8', item_name: 'Huyền Thiết Chiến Kích', item_type: 'weapon', rarity: 'Phàm Phẩm', rarity_key: 'common', element: 'Kim', bonus_atk: 165, bonus_def: 40, bonus_spd: 15, bonus_hp: 0, bonus_crit: 5, hax_skill: null, hax_desc: 'Phá 12% phòng thủ DEF của đối thủ.', scene: 'a heavy black-iron halberd etched with silver rune lines' },
  { item_id: 'weapon_rare_7', item_name: 'Lưu Ly Nguyệt Luân', item_type: 'weapon', rarity: 'Linh Phẩm', rarity_key: 'rare', element: 'Quang', bonus_atk: 340, bonus_def: 60, bonus_spd: 110, bonus_hp: 0, bonus_crit: 9, hax_skill: null, hax_desc: 'Đòn đánh làm giảm 10% chính xác địch trong 2 hiệp.', scene: 'a floating crescent moon chakram glowing with golden-white radiance' },
  { item_id: 'weapon_rare_8', item_name: 'Xích Lân Đoản Thương', item_type: 'weapon', rarity: 'Linh Phẩm', rarity_key: 'rare', element: 'Hỏa', bonus_atk: 365, bonus_def: 0, bonus_spd: 90, bonus_hp: 0, bonus_crit: 8, hax_skill: null, hax_desc: '20% tỉ lệ đốt thêm 6% HP địch.', scene: 'a crimson dragon-scale short spear trailing molten sparks' },
  { item_id: 'weapon_epic_7', item_name: 'Băng Phách Tuyệt Mệnh Cung', item_type: 'weapon', rarity: 'Tiên Phẩm', rarity_key: 'epic', element: 'Thủy', bonus_atk: 645, bonus_def: 0, bonus_spd: 240, bonus_hp: 0, bonus_crit: 14, hax_skill: null, hax_desc: '25% đóng băng địch 1 hiệp & xuyên 25% khiên chắn.', scene: 'a crystalline ice-spirit recurve bow nocking a glowing frost arrow' },
  { item_id: 'weapon_epic_8', item_name: 'Tử Lôi Chấn Thiên Phủ', item_type: 'weapon', rarity: 'Tiên Phẩm', rarity_key: 'epic', element: 'Lôi', bonus_atk: 675, bonus_def: 120, bonus_spd: 160, bonus_hp: 0, bonus_crit: 12, hax_skill: null, hax_desc: '25% gây Choáng & giảm 20% DEF địch trong 2 hiệp.', scene: 'a twin-edged storm battleaxe surging with violet thunder arcs' },
  { item_id: 'weapon_epic_9', item_name: 'Cửu U Đoạt Hồn Tiêu', item_type: 'weapon', rarity: 'Tiên Phẩm', rarity_key: 'epic', element: 'Ám', bonus_atk: 630, bonus_def: 90, bonus_spd: 250, bonus_hp: 0, bonus_crit: 15, hax_skill: null, hax_desc: 'Hút 18% sát thương & giảm 30% hồi máu đối thủ.', scene: 'an obsidian spirit flute-blade emitting eerie purple smoke wisps' },

  // 17 Vũ Khí Thần Thoại Không Độc Nhất
  { item_id: 'weapon_mythic_6', item_name: '« Thiên Cương Trảm Vực Kiếm »', item_type: 'weapon', rarity: 'Thần Thoại', rarity_key: 'mythic', element: 'Kim', bonus_atk: 745, bonus_def: 60, bonus_spd: 295, bonus_hp: 0, bonus_crit: 16, hax_skill: 'Trảm Vực Xuyên Giáp', hax_desc: 'Xuyên 60% Khiên Chắn & +15% sát thương khi Linh Vực bản thân đang kích hoạt.', scene: 'an imperial golden-silver great sword bisecting floating seal runes' },
  { item_id: 'weapon_mythic_7', item_name: '« Phần Nhật Viêm Long Thương »', item_type: 'weapon', rarity: 'Thần Thoại', rarity_key: 'mythic', element: 'Hỏa', bonus_atk: 750, bonus_def: 0, bonus_spd: 300, bonus_hp: 0, bonus_crit: 15, hax_skill: 'Viêm Long Thiêu Hồn', hax_desc: 'Xuyên 50% DEF & thiêu đốt 9% HP tối đa địch mỗi hiệp (bỏ qua khiên).', scene: 'a blazing red-gold dragon lance spiraled with sacred solar flames' },
  { item_id: 'weapon_mythic_8', item_name: '« Huyền Băng Phá Lãng Kích »', item_type: 'weapon', rarity: 'Thần Thoại', rarity_key: 'mythic', element: 'Thủy', bonus_atk: 730, bonus_def: 150, bonus_spd: 310, bonus_hp: 0, bonus_crit: 14, hax_skill: 'Băng Phong Tịch Diệt', hax_desc: '28% đóng băng địch 1 hiệp & giảm 20% SPD đối phương.', scene: 'a glacial sapphire halberd forged from eternal northern sea ice' },
  { item_id: 'weapon_mythic_9', item_name: '« Tử Tiêu Thần Lôi Cung »', item_type: 'weapon', rarity: 'Thần Thoại', rarity_key: 'mythic', element: 'Lôi', bonus_atk: 735, bonus_def: 0, bonus_spd: 335, bonus_hp: 0, bonus_crit: 18, hax_skill: 'Lôi Tiễn Liên Hoàn', hax_desc: '30% tung mũi tên sét phụ 65% ATK xuyên 50% Khiên.', scene: 'a glowing amethyst lightning longbow charged with crackling starlight bolts' },
  { item_id: 'weapon_mythic_10', item_name: '« Thái Ất Thần Mộc Trượng »', item_type: 'weapon', rarity: 'Thần Thoại', rarity_key: 'mythic', element: 'Mộc', bonus_atk: 720, bonus_def: 190, bonus_spd: 290, bonus_hp: 0, bonus_crit: 12, hax_skill: 'Thanh Mộc Phản Phệ', hax_desc: 'Hút 22% sát thương thành HP & thanh tẩy 1 hiệu ứng bất lợi mỗi 2 hiệp.', scene: 'an ancient emerald dragon-wood staff crowned with blooming glowing lotus' },
  { item_id: 'weapon_mythic_11', item_name: '« Bàn Cổ Khai Sơn Cự Phủ »', item_type: 'weapon', rarity: 'Thần Thoại', rarity_key: 'mythic', element: 'Thổ', bonus_atk: 760, bonus_def: 180, bonus_spd: 250, bonus_hp: 0, bonus_crit: 14, hax_skill: 'Liệt Địa Phá Thuẫn', hax_desc: 'Đòn đánh gây 2x sát thương lên Khiên & xuyên 55% DEF.', scene: 'a monumental obsidian-gold rune waraxe radiating earth shockwaves' },
  { item_id: 'weapon_mythic_12', item_name: '« Thánh Quang Phán Quyết Kiếm »', item_type: 'weapon', rarity: 'Thần Thoại', rarity_key: 'mythic', element: 'Quang', bonus_atk: 735, bonus_def: 140, bonus_spd: 305, bonus_hp: 0, bonus_crit: 16, hax_skill: 'Thánh Quang Tẩy Uế', hax_desc: 'Xóa 1 tầng Buff của địch mỗi 2 hiệp & tăng +18% ST chuẩn phụ.', scene: 'a radiant white-gold judgment broadsword haloed by feathered light wings' },
  { item_id: 'weapon_mythic_13', item_name: '« Huyết Hải Tu La Ma Đao »', item_type: 'weapon', rarity: 'Thần Thoại', rarity_key: 'mythic', element: 'Ám', bonus_atk: 755, bonus_def: 50, bonus_spd: 300, bonus_hp: 0, bonus_crit: 18, hax_skill: 'Tu La Đoạn Hồi', hax_desc: 'Giảm 50% hiệu lực hồi máu của địch & hút 22% sát thương.', scene: 'a curved crimson-black Asura odachi enveloped in blood-moon mist' },
  { item_id: 'weapon_mythic_14', item_name: '« Tinh Hà Thứ Nguyên Đao »', item_type: 'weapon', rarity: 'Thần Thoại', rarity_key: 'mythic', element: 'Hư Không', bonus_atk: 740, bonus_def: 80, bonus_spd: 325, bonus_hp: 0, bonus_crit: 17, hax_skill: 'Tinh Hà Trảm Không', hax_desc: 'Bỏ qua 45% DEF + 45% tỉ lệ né của mục tiêu khi Bạo Kích.', scene: 'a starry dimensional katana slicing through glowing purple cosmic rifts' },
  { item_id: 'weapon_mythic_15', item_name: '« Cửu Thiên Phượng Vũ Phiến »', item_type: 'weapon', rarity: 'Thần Thoại', rarity_key: 'mythic', element: 'Hỏa', bonus_atk: 725, bonus_def: 160, bonus_spd: 320, bonus_hp: 0, bonus_crit: 15, hax_skill: 'Phượng Vũ Loạn Vũ', hax_desc: 'Tăng +18% Né Tránh & đốt 7% HP tối đa địch mỗi hiệp.', scene: 'an ornate gilded war fan woven from blazing scarlet phoenix feathers' },
  { item_id: 'weapon_mythic_16', item_name: '« Bạch Đế Lăng Phong Thương »', item_type: 'weapon', rarity: 'Thần Thoại', rarity_key: 'mythic', element: 'Kim', bonus_atk: 745, bonus_def: 90, bonus_spd: 315, bonus_hp: 0, bonus_crit: 16, hax_skill: 'Thương Ý Thấu Cốt', hax_desc: 'Mỗi đòn giảm 10% DEF địch cộng dồn 4 tầng & xuyên 45% Khiên.', scene: 'a platinum wind-piercing lance ribboned in glowing golden silk' },
  { item_id: 'weapon_mythic_17', item_name: '« Minh Vương Phệ Linh Liêm »', item_type: 'weapon', rarity: 'Thần Thoại', rarity_key: 'mythic', element: 'Ám', bonus_atk: 750, bonus_def: 80, bonus_spd: 305, bonus_hp: 0, bonus_crit: 16, hax_skill: 'Tử Thần Thu Hoạch', hax_desc: 'Địch dưới 22% HP có 40% tỉ lệ kết liễu & hút 25% ST gây ra.', scene: 'an underworld scythe with a ghostly cyan skull lantern hanging on the shaft' },
  { item_id: 'weapon_mythic_18', item_name: '« Càn Khôn Nhật Nguyệt Luân »', item_type: 'weapon', rarity: 'Thần Thoại', rarity_key: 'mythic', element: 'Quang', bonus_atk: 730, bonus_def: 150, bonus_spd: 315, bonus_hp: 0, bonus_crit: 15, hax_skill: 'Nhật Nguyệt Luân Chuyển', hax_desc: 'Phản công 70% ATK khi né thành công & tăng +15% hiệu lực Linh Vực.', scene: 'interlocking sun-and-moon golden chakram wheels glowing with astral fire' },
  { item_id: 'weapon_mythic_19', item_name: '« Thanh Đế Đằng Xà Tiêu »', item_type: 'weapon', rarity: 'Thần Thoại', rarity_key: 'mythic', element: 'Mộc', bonus_atk: 725, bonus_def: 150, bonus_spd: 310, bonus_hp: 0, bonus_crit: 14, hax_skill: 'Độc Đằng Triền Kích', hax_desc: 'Gây độc rút 8% HP tối đa/hiệp & giảm 30% hồi máu của địch.', scene: 'an emerald coiled-serpent jade flute-staff blooming with spirit vines' },
  { item_id: 'weapon_mythic_20', item_name: '« Vạn Lôi Phá Giới Chùy »', item_type: 'weapon', rarity: 'Thần Thoại', rarity_key: 'mythic', element: 'Lôi', bonus_atk: 755, bonus_def: 140, bonus_spd: 280, bonus_hp: 0, bonus_crit: 15, hax_skill: 'Lôi Chùy Oanh Kích', hax_desc: '26% gây Choáng 1 hiệp & gây thêm 10% ST chuẩn khi phá khiên.', scene: 'a massive floating celestial thunder mace sparking with cyan-purple arcs' },
  { item_id: 'weapon_mythic_21', item_name: '« Thương Hải Long Lân Kiếm »', item_type: 'weapon', rarity: 'Thần Thoại', rarity_key: 'mythic', element: 'Thủy', bonus_atk: 735, bonus_def: 130, bonus_spd: 310, bonus_hp: 0, bonus_crit: 15, hax_skill: 'Long Triều Hộ Kiếm', hax_desc: 'Giảm 20% sát thương địch trong 2 hiệp sau mỗi đòn & hồi 6% HP/hiệp.', scene: 'a sea-dragon scale crystal sword dripping luminescent ocean mist' },
  { item_id: 'weapon_mythic_22', item_name: '« Hư Không Phá Vực Cung »', item_type: 'weapon', rarity: 'Thần Thoại', rarity_key: 'mythic', element: 'Hư Không', bonus_atk: 745, bonus_def: 70, bonus_spd: 325, bonus_hp: 0, bonus_crit: 17, hax_skill: 'Xuyên Vực Tiễn', hax_desc: 'Gây thêm +25% ST lên địch có Khiên & bào mòn 1 Linh Mạch địch mỗi 3 hiệp.', scene: 'an astral crystal bow framed by fractured violet dimensional shards' },

  // 10 Vũ Khí Thần Thoại Độc Nhất (Hơn bản Mythic thường ~6% stats + ~6% HAX => <= 15%)
  { item_id: 'weapon_unique_1', item_name: '« Khai Thiên Phá Vạn Pháp Kiếm »', item_type: 'weapon', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: true, element: 'Kim', bonus_atk: 785, bonus_def: 110, bonus_spd: 325, bonus_hp: 0, bonus_crit: 19, hax_skill: 'Vạn Pháp Quy Không', hax_desc: 'Xuyên 70% Khiên, 55% DEF & giảm 15% hiệu lực giảm ST của địch.', scene: 'imperial silver-gold supreme sword cleaving floating law seal tablets' },
  { item_id: 'weapon_unique_2', item_name: '« Cửu Diệu Phần Thế Thần Thương »', item_type: 'weapon', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: true, element: 'Hỏa', bonus_atk: 790, bonus_def: 90, bonus_spd: 330, bonus_hp: 0, bonus_crit: 17, hax_skill: 'Cửu Nhật Phần Thiên', hax_desc: 'Xuyên 58% DEF & thiêu đốt 11% HP tối đa địch mỗi hiệp (bỏ qua khiên).', scene: 'a mythical spear ringed by nine miniature burning suns and golden runes' },
  { item_id: 'weapon_unique_3', item_name: '« Thái Thủy Tuyệt Đống Thần Kích »', item_type: 'weapon', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: true, element: 'Thủy', bonus_atk: 770, bonus_def: 180, bonus_spd: 335, bonus_hp: 0, bonus_crit: 16, hax_skill: 'Vĩnh Đống Cấm Chế', hax_desc: '32% Đóng Băng 1 hiệp, giảm 24% SPD & khóa 25% hồi phục địch.', scene: 'an absolute-zero celestial sapphire halberd trailed by aurora frost trails' },
  { item_id: 'weapon_unique_4', item_name: '« Cửu Kiếp Thần Lôi Đế Cung »', item_type: 'weapon', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: true, element: 'Lôi', bonus_atk: 780, bonus_def: 60, bonus_spd: 360, bonus_hp: 0, bonus_crit: 20, hax_skill: 'Thần Kiếp Xuyên Vân', hax_desc: '35% bắn đòn sét phụ 75% ATK xuyên 60% Khiên & cướp 25% SPD.', scene: 'a divine golden-violet dragon-rib bow firing pure lightning spears' },
  { item_id: 'weapon_unique_5', item_name: '« Hỗn Độn Sinh Diệt Thần Trượng »', item_type: 'weapon', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: true, element: 'Mộc', bonus_atk: 765, bonus_def: 220, bonus_spd: 315, bonus_hp: 0, bonus_crit: 15, hax_skill: 'Luân Hồi Sinh Tức', hax_desc: 'Hút 26% ST thành HP, thanh tẩy debuff & đốt 7% HP địch/hiệp.', scene: 'a world-tree jade scepter blooming with glowing emerald lotus spirits' },
  { item_id: 'weapon_unique_6', item_name: '« Trấn Nhạc Thần Hoàng Đại Phủ »', item_type: 'weapon', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: true, element: 'Thổ', bonus_atk: 795, bonus_def: 210, bonus_spd: 275, bonus_hp: 0, bonus_crit: 16, hax_skill: 'Hoàng Thiên Trấn Sát', hax_desc: 'Xuyên 60% DEF & gây +120% sát thương trực tiếp lên Khiên chắn.', scene: 'an imperial dragon-engraved amber battleaxe dripping golden molten lava' },
  { item_id: 'weapon_unique_7', item_name: '« Vạn Quang Thái Dương Thánh Kiếm »', item_type: 'weapon', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: true, element: 'Quang', bonus_atk: 775, bonus_def: 170, bonus_spd: 335, bonus_hp: 0, bonus_crit: 18, hax_skill: 'Thái Dương Phá Ám', hax_desc: 'Xóa 1 buff địch mỗi 2 hiệp & tăng +20% sát thương Bạo Kích chuẩn.', scene: 'an immaculate pearl-gold sunblade encircled by rotating angel-wing halos' },
  { item_id: 'weapon_unique_8', item_name: '« Thệ Hồn Đoạn Tuyệt Ma Đao »', item_type: 'weapon', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: true, element: 'Ám', bonus_atk: 790, bonus_def: 100, bonus_spd: 325, bonus_hp: 0, bonus_crit: 19, hax_skill: 'Tuyệt Mệnh Hấp Huyết', hax_desc: 'Giảm 58% hồi máu địch, hút 26% ST & kết liễu dưới 22% HP (38%).', scene: 'a cursed obsidian-crimson greatsword bound with glowing phantom spirit chains' },
  { item_id: 'weapon_unique_9', item_name: '« Thời Không Vạn Tượng Thần Nhận »', item_type: 'weapon', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: true, element: 'Hư Không', bonus_atk: 780, bonus_def: 120, bonus_spd: 350, bonus_hp: 0, bonus_crit: 19, hax_skill: 'Thời Không Trảm', hax_desc: 'Bỏ qua 55% DEF + 35% tung thêm nhát chém phụ 55% ATK chuẩn.', scene: 'a crystalline crescent twin-blade distorting space-time starlight' },
  { item_id: 'weapon_unique_10', item_name: '« Hồng Mông Đế Tôn Kiếm »', item_type: 'weapon', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: true, element: 'Hỗn Độn', bonus_atk: 785, bonus_def: 160, bonus_spd: 335, bonus_hp: 0, bonus_crit: 18, hax_skill: 'Hồng Mông Khai Vực', hax_desc: 'Xuyên 68% Khiên & tăng +20% uy lực toàn bộ hiệu ứng Linh Vực.', scene: 'a primordial rainbow-gold chaos sword wreathed in swirling sakura nebula' },

  // ---- 33 BẢO NGỌC (6 Phàm/Linh/Tiên + 17 Thần Thoại Thường + 10 Độc Nhất) ----
  { item_id: 'gem_common_6', item_name: 'Linh Tuyền Thanh Châu', item_type: 'gem', rarity: 'Phàm Phẩm', rarity_key: 'common', element: 'Thủy', bonus_atk: 0, bonus_def: 135, bonus_spd: 15, bonus_hp: 620, bonus_crit: 0, hax_skill: null, hax_desc: 'Hồi phục 3% HP & giảm 5% sát thương nhận vào.', scene: 'a translucent sky-blue spring pearl cradling a floating droplet' },
  { item_id: 'gem_common_7', item_name: 'Kim Thạch Hộ Tâm', item_type: 'gem', rarity: 'Phàm Phẩm', rarity_key: 'common', element: 'Kim', bonus_atk: 45, bonus_def: 145, bonus_spd: 0, bonus_hp: 520, bonus_crit: 0, hax_skill: null, hax_desc: 'Đầu trận tạo khiên 400 HP.', scene: 'an octagonal brushed-gold chest talisman gem' },
  { item_id: 'gem_rare_6', item_name: 'Hỏa Phượng Linh Ngọc', item_type: 'gem', rarity: 'Linh Phẩm', rarity_key: 'rare', element: 'Hỏa', bonus_atk: 90, bonus_def: 310, bonus_spd: 30, bonus_hp: 1750, bonus_crit: 0, hax_skill: null, hax_desc: 'Phản 20% sát thương & kháng 25% thiêu đốt.', scene: 'a fiery amber-ruby spirit gem carved with rising phoenix wings' },
  { item_id: 'gem_rare_7', item_name: 'Thánh Quang Bạch Châu', item_type: 'gem', rarity: 'Linh Phẩm', rarity_key: 'rare', element: 'Quang', bonus_atk: 0, bonus_def: 340, bonus_spd: 40, bonus_hp: 1850, bonus_crit: 0, hax_skill: null, hax_desc: 'Thanh tẩy 1 hiệu ứng bất lợi ở hiệp 2 và giảm 10% ST Bạo Kích.', scene: 'a luminous pearl orb wrapped in delicate golden light ribbons' },
  { item_id: 'gem_epic_7', item_name: 'Lôi Vực Trấn Hồn Thạch', item_type: 'gem', rarity: 'Tiên Phẩm', rarity_key: 'epic', element: 'Lôi', bonus_atk: 120, bonus_def: 650, bonus_spd: 120, bonus_hp: 4150, bonus_crit: 0, hax_skill: null, hax_desc: 'Đầu trận khiên 45% HP & 20% phản giật gây Choáng 1 hiệp.', scene: 'a faceted amethyst thunder crystal pulsing inside a brass halo ring' },
  { item_id: 'gem_epic_8', item_name: 'Thái Hư Huyền Băng Kính', item_type: 'gem', rarity: 'Tiên Phẩm', rarity_key: 'epic', element: 'Thủy', bonus_atk: 0, bonus_def: 670, bonus_spd: 90, bonus_hp: 4300, bonus_crit: 0, hax_skill: null, hax_desc: 'Giảm 24% ST thường & 30% ST Bạo Kích nhận vào.', scene: 'an ancient octagonal frost mirror reflecting icy aurora rays' },

  // 17 Bảo Ngọc Thần Thoại Không Độc Nhất
  { item_id: 'gem_mythic_6', item_name: '« Cửu Long Hộ Chủ Thần Châu »', item_type: 'gem', rarity: 'Thần Thoại', rarity_key: 'mythic', element: 'Kim', bonus_atk: 160, bonus_def: 760, bonus_spd: 140, bonus_hp: 4950, bonus_crit: 0, hax_skill: 'Cửu Long Kim Thuẫn', hax_desc: 'Đầu trận tạo khiên 85% HP tối đa & giảm 26% sát thương nhận vào.', scene: 'a glowing golden imperial dragon orb coiled by nine carved miniature dragons' },
  { item_id: 'gem_mythic_7', item_name: '« Bất Diệt Thần Mộc Tâm Châu »', item_type: 'gem', rarity: 'Thần Thoại', rarity_key: 'mythic', element: 'Mộc', bonus_atk: 80, bonus_def: 740, bonus_spd: 160, bonus_hp: 5150, bonus_crit: 0, hax_skill: 'Thần Mộc Tái Sinh', hax_desc: 'Hồi 12% HP tối đa/hiệp & miễn nhiễm 75% sát thương Độc/Đốt.', scene: 'a heart-shaped emerald crystal pulsing with ancient golden lifeblood sap' },
  { item_id: 'gem_mythic_8', item_name: '« Thái Cực Hỗn Nguyên Kính »', item_type: 'gem', rarity: 'Thần Thoại', rarity_key: 'mythic', element: 'Quang', bonus_atk: 100, bonus_def: 750, bonus_spd: 180, bonus_hp: 4900, bonus_crit: 0, hax_skill: 'Hỗn Nguyên Phản Chiếu', hax_desc: 'Phản hồi 65% sát thương nhận vào & kháng 60% Khống Chế.', scene: 'a radiant yin-yang diamond mirror surrounded by golden scripture rings' },
  { item_id: 'gem_mythic_9', item_name: '« Huyền Vũ Bất Phá Ấn »', item_type: 'gem', rarity: 'Thần Thoại', rarity_key: 'mythic', element: 'Thủy', bonus_atk: 60, bonus_def: 790, bonus_spd: 110, bonus_hp: 5200, bonus_crit: 0, hax_skill: 'Huyền Vũ Đạo Giáp', hax_desc: 'Giảm 30% sát thương & chặn đòn chí tử tại 15% HP (1 lần/trận).', scene: 'a dark sapphire tortoise-shell seal stone encased in frost runework' },
  { item_id: 'gem_mythic_10', item_name: '« Phượng Hoàng Niết Bàn Ngọc »', item_type: 'gem', rarity: 'Thần Thoại', rarity_key: 'mythic', element: 'Hỏa', bonus_atk: 180, bonus_def: 720, bonus_spd: 190, bonus_hp: 4850, bonus_crit: 0, hax_skill: 'Chân Hỏa Trùng Sinh', hax_desc: 'Khi tử trận hồi sinh ngay với 50% HP (1 lần/trận) & đốt 6% HP địch.', scene: 'a crimson-gold teardrop jewel burning with eternal phoenix rebirth aura' },
  { item_id: 'gem_mythic_11', item_name: '« Cửu U Minh Hỏa Tinh Thạch »', item_type: 'gem', rarity: 'Thần Thoại', rarity_key: 'mythic', element: 'Ám', bonus_atk: 200, bonus_def: 730, bonus_spd: 160, bonus_hp: 4800, bonus_crit: 0, hax_skill: 'Minh Hỏa Phệ Giáp', hax_desc: 'Khi bị đánh giảm 12% ATK kẻ địch & phản đốt 7% HP tối đa địch.', scene: 'a floating obsidian soulstone weeping ghostly azure-violet flames' },
  { item_id: 'gem_mythic_12', item_name: '« Tử Lôi Tịch Tà Bảo Châu »', item_type: 'gem', rarity: 'Thần Thoại', rarity_key: 'mythic', element: 'Lôi', bonus_atk: 170, bonus_def: 740, bonus_spd: 210, bonus_hp: 4850, bonus_crit: 0, hax_skill: 'Lôi Giáp Hộ Thân', hax_desc: 'Đầu trận khiên 70% HP & 25% phản giật Choáng kẻ tấn công.', scene: 'an electric purple plasma pearl caged in floating golden thunder rings' },
  { item_id: 'gem_mythic_13', item_name: '« Hoàng Thiên Hậu Thổ Bích »', item_type: 'gem', rarity: 'Thần Thoại', rarity_key: 'mythic', element: 'Thổ', bonus_atk: 120, bonus_def: 785, bonus_spd: 100, bonus_hp: 5150, bonus_crit: 0, hax_skill: 'Hậu Thổ Nham Thuẫn', hax_desc: 'Đầu trận khiên 90% HP & giảm 45% sát thương Bạo Kích nhận vào.', scene: 'an imperial square jade-and-amber bi disc carved with mountain runes' },
  { item_id: 'gem_mythic_14', item_name: '« Tinh Không Hư Ảnh Châu »', item_type: 'gem', rarity: 'Thần Thoại', rarity_key: 'mythic', element: 'Hư Không', bonus_atk: 150, bonus_def: 735, bonus_spd: 220, bonus_hp: 4900, bonus_crit: 0, hax_skill: 'Không Gian Né Ảnh', hax_desc: 'Tăng +24% Né Tránh đòn đánh & tạo khiên 55% HP đầu trận.', scene: 'a miniature galaxy locked inside a crystal glass sphere' },
  { item_id: 'gem_mythic_15', item_name: '« Bạch Ngọc Vô Cấu Thánh Kính »', item_type: 'gem', rarity: 'Thần Thoại', rarity_key: 'mythic', element: 'Quang', bonus_atk: 90, bonus_def: 760, bonus_spd: 170, bonus_hp: 5000, bonus_crit: 0, hax_skill: 'Thanh Tẩy Thánh Thuẫn', hax_desc: 'Miễn nhiễm Khống Chế 75% & tự xóa 1 debuff cuối mỗi hiệp.', scene: 'an immaculate white diamond lotus pendant sparkling with prism halos' },
  { item_id: 'gem_mythic_16', item_name: '« Băng Tâm Tuyết Liên Ngọc »', item_type: 'gem', rarity: 'Thần Thoại', rarity_key: 'mythic', element: 'Thủy', bonus_atk: 110, bonus_def: 755, bonus_spd: 185, bonus_hp: 5050, bonus_crit: 0, hax_skill: 'Băng Liên Hồi Sinh', hax_desc: 'Giảm 28% ST nhận vào & hồi 9% HP tối đa mỗi hiệp.', scene: 'a frozen crystal snow-lotus jewel suspended in pale sapphire mist' },
  { item_id: 'gem_mythic_17', item_name: '« Vạn Độc Bất Xâm Bảo Châu »', item_type: 'gem', rarity: 'Thần Thoại', rarity_key: 'mythic', element: 'Mộc', bonus_atk: 130, bonus_def: 750, bonus_spd: 165, bonus_hp: 5000, bonus_crit: 0, hax_skill: 'Bất Xâm Độc Mạch', hax_desc: 'Miễn nhiễm 100% Độc/Thiêu Đốt & phản lại 35% sát thương thường.', scene: 'a vivid emerald serpent-coiled jade orb glowing with purifying runes' },
  { item_id: 'gem_mythic_18', item_name: '« Thái Bạch Kim Tinh Thuẫn »', item_type: 'gem', rarity: 'Thần Thoại', rarity_key: 'mythic', element: 'Kim', bonus_atk: 190, bonus_def: 770, bonus_spd: 150, bonus_hp: 4950, bonus_crit: 0, hax_skill: 'Kim Tinh Phản Kích', hax_desc: 'Khi còn khiên (75% HP đầu trận), tăng +18% ATK & phản 30% ST.', scene: 'a golden celestial star-crest shield gem edged in razor swordlight' },
  { item_id: 'gem_mythic_19', item_name: '« Hắc Diệu Thôn Linh Ấn »', item_type: 'gem', rarity: 'Thần Thoại', rarity_key: 'mythic', element: 'Ám', bonus_atk: 180, bonus_def: 745, bonus_spd: 170, bonus_hp: 4950, bonus_crit: 0, hax_skill: 'Hắc Diệu Hấp Khiên', hax_desc: 'Chuyển 30% sát thương địch đánh vào mình thành khiên hồi phục.', scene: 'a faceted black diamond seal orb pulling purple spectral motes inward' },
  { item_id: 'gem_mythic_20', item_name: '« Xích Dương Lưu Ly Bội »', item_type: 'gem', rarity: 'Thần Thoại', rarity_key: 'mythic', element: 'Hỏa', bonus_atk: 165, bonus_def: 735, bonus_spd: 185, bonus_hp: 4950, bonus_crit: 0, hax_skill: 'Lưu Ly Hộ Chủ', hax_desc: 'HP < 40% tự hồi 40% HP & tăng +20% DEF suốt trận (1 lần/trận).', scene: 'a warm glazed amber solar pendant etched with golden sunbirds' },
  { item_id: 'gem_mythic_21', item_name: '« Lôi Đình Bất Hoại Tâm Thạch »', item_type: 'gem', rarity: 'Thần Thoại', rarity_key: 'mythic', element: 'Lôi', bonus_atk: 155, bonus_def: 750, bonus_spd: 205, bonus_hp: 4950, bonus_crit: 0, hax_skill: 'Lôi Tâm Bất Diệt', hax_desc: 'Chặn đòn chí tử tại 1 HP + miễn nhiễm sát thương 1 hiệp (1 lần/trận).', scene: 'a core-pulsing violet thunderstone shielded by golden lightning arcs' },
  { item_id: 'gem_mythic_22', item_name: '« Hỗn Nguyên Định Vực Châu »', item_type: 'gem', rarity: 'Thần Thoại', rarity_key: 'mythic', element: 'Thổ', bonus_atk: 140, bonus_def: 770, bonus_spd: 150, bonus_hp: 5050, bonus_crit: 0, hax_skill: 'Định Vực Hộ Tâm', hax_desc: 'Đầu trận tạo khiên 65% HP & tăng +1 Linh Mạch cho Linh Vực.', scene: 'a heavy golden-obsidian compass orb steadying a glowing domain seal' },

  // 10 Bảo Ngọc Thần Thoại Độc Nhất
  { item_id: 'gem_unique_1', item_name: '« Thái Cổ Long Hoàng Ngọc Tỷ »', item_type: 'gem', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: true, element: 'Kim', bonus_atk: 200, bonus_def: 810, bonus_spd: 180, bonus_hp: 5300, bonus_crit: 0, hax_skill: 'Đế Hoàng Kim Thân', hax_desc: 'Khiên 95% HP đầu trận & giảm 30% toàn bộ sát thương khi còn khiên.', scene: 'an imperial golden jade dragon seal pulsing with royal rune brilliance' },
  { item_id: 'gem_unique_2', item_name: '« Vạn Pháp Bất Xâm Đạo Châu »', item_type: 'gem', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: true, element: 'Quang', bonus_atk: 140, bonus_def: 800, bonus_spd: 210, bonus_hp: 5250, bonus_crit: 0, hax_skill: 'Đạo Pháp Thanh Tẩy', hax_desc: 'Miễn nhiễm 85% Khống Chế, giảm 30% ST Chuẩn & hồi 8% HP/hiệp.', scene: 'a pearlescent heavenly dao pearl circled by interlocking golden light bands' },
  { item_id: 'gem_unique_3', item_name: '« Vĩnh Hằng Hàn Băng Thần Châu »', item_type: 'gem', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: true, element: 'Thủy', bonus_atk: 120, bonus_def: 820, bonus_spd: 195, bonus_hp: 5350, bonus_crit: 0, hax_skill: 'Hàn Băng Bất Hoại', hax_desc: 'Giảm 34% ST nhận vào & 30% đóng băng kẻ tấn công 1 hiệp.', scene: 'an absolute-zero glacier lotus crystal framed in silver frost filigree' },
  { item_id: 'gem_unique_4', item_name: '« Bất Tử Phượng Hoàng Tâm Ngọc »', item_type: 'gem', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: true, element: 'Hỏa', bonus_atk: 210, bonus_def: 765, bonus_spd: 220, bonus_hp: 5150, bonus_crit: 0, hax_skill: 'Phượng Hoàng Tái Tạo', hax_desc: 'Hồi sinh 1 lần với 60% HP tối đa + nhận khiên 40% HP sau tái sinh.', scene: 'a radiant crimson-gold phoenix heart emerald floating in nirvana sparks' },
  { item_id: 'gem_unique_5', item_name: '« Cửu Chuyển Sinh Tử Đan Châu »', item_type: 'gem', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: true, element: 'Mộc', bonus_atk: 130, bonus_def: 790, bonus_spd: 195, bonus_hp: 5350, bonus_crit: 0, hax_skill: 'Thảo Mộc Bất Diệt', hax_desc: 'Hồi 14% HP tối đa/hiệp, miễn độc/đốt & thanh tẩy 1 debuff/hiệp.', scene: 'a nine-ringed emerald life orb cradling a miniature glowing spirit tree' },
  { item_id: 'gem_unique_6', item_name: '« Vô Cực Bàn Cổ Sơn Hà Ấn »', item_type: 'gem', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: true, element: 'Thổ', bonus_atk: 160, bonus_def: 830, bonus_spd: 120, bonus_hp: 5400, bonus_crit: 0, hax_skill: 'Sơn Hà Bất Động', hax_desc: 'Đầu trận khiên 105% HP & chặn kết liễu tức thì (1 lần/trận).', scene: 'a golden mountain-and-river bronze seal monolith pulsing earth aura' },
  { item_id: 'gem_unique_7', item_name: '« Thái Hư Phản Kính Thần Châu »', item_type: 'gem', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: true, element: 'Hư Không', bonus_atk: 180, bonus_def: 780, bonus_spd: 240, bonus_hp: 5200, bonus_crit: 0, hax_skill: 'Hư Không Phản Chấn', hax_desc: 'Phản lại 78% sát thương nhận vào & +20% tỉ lệ né tránh.', scene: 'a shimmering void mirror prism bending purple nebula light beams' },
  { item_id: 'gem_unique_8', item_name: '« Cửu Tiêu Lôi Đình Hộ Tâm Kính »', item_type: 'gem', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: true, element: 'Lôi', bonus_atk: 195, bonus_def: 785, bonus_spd: 235, bonus_hp: 5200, bonus_crit: 0, hax_skill: 'Lôi Thần Giáng Phạt', hax_desc: 'Chặn đòn chí tử tại 1 HP + miễn ST 2 lượt & phản Choáng 30%.', scene: 'an imperial purple storm mirror ringed by nine floating thunder drums' },
  { item_id: 'gem_unique_9', item_name: '« Hoàng Tuyền Bất Diệt Hồn Thạch »', item_type: 'gem', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: true, element: 'Ám', bonus_atk: 210, bonus_def: 775, bonus_spd: 195, bonus_hp: 5200, bonus_crit: 0, hax_skill: 'Minh Hồn Hấp Thụ', hax_desc: 'Hấp thụ 35% sát thương địch thành Khiên & đốt 8% HP địch/hiệp.', scene: 'a cursed purple-gold underworld soul crystal wrapped in ghostly mist' },
  { item_id: 'gem_unique_10', item_name: '« Hồng Mông Thiên Cơ Đạo Ấn »', item_type: 'gem', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: true, element: 'Hỗn Độn', bonus_atk: 190, bonus_def: 805, bonus_spd: 210, bonus_hp: 5300, bonus_crit: 0, hax_skill: 'Hồng Mông Hộ Vực', hax_desc: 'Khiên 90% HP + tăng 1 Linh Mạch & +20% kháng trừ Linh Mạch.', scene: 'a supreme rose-gold primordial chaos seal orb ringed by sakura petals' },

  // ---- 33 CHIẾN HỒN (7 Phàm/Linh/Tiên + 16 Thần Thoại Thường + 10 Độc Nhất) ----
  { item_id: 'soul_common_6', item_name: 'Xích Khuyển Chiến Hồn', item_type: 'soul', rarity: 'Phàm Phẩm', rarity_key: 'common', element: 'Hỏa', bonus_atk: 65, bonus_def: 15, bonus_spd: 60, bonus_hp: 0, bonus_crit: 0, hax_skill: null, hax_desc: 'HP < 45% tăng +12% sát thương.', scene: 'a fierce crimson spirit hound phantom surging with orange embers' },
  { item_id: 'soul_common_7', item_name: 'Bạch Lộ Linh Hồn', item_type: 'soul', rarity: 'Phàm Phẩm', rarity_key: 'common', element: 'Thủy', bonus_atk: 20, bonus_def: 45, bonus_spd: 85, bonus_hp: 0, bonus_crit: 0, hax_skill: null, hax_desc: 'Tăng +6% tỉ lệ né tránh.', scene: 'a graceful translucent water-egret spirit silhouette with mist wings' },
  { item_id: 'soul_rare_6', item_name: 'Lôi Báo Tốc Hồn', item_type: 'soul', rarity: 'Linh Phẩm', rarity_key: 'rare', element: 'Lôi', bonus_atk: 130, bonus_def: 0, bonus_spd: 200, bonus_hp: 0, bonus_crit: 0, hax_skill: null, hax_desc: 'Tăng +12% SPD đầu trận trong 2 hiệp.', scene: 'a glowing violet lightning leopard war-soul mid-pounce' },
  { item_id: 'soul_rare_7', item_name: 'Thanh Quy Thủ Hồn', item_type: 'soul', rarity: 'Linh Phẩm', rarity_key: 'rare', element: 'Mộc', bonus_atk: 60, bonus_def: 140, bonus_spd: 140, bonus_hp: 0, bonus_crit: 0, hax_skill: null, hax_desc: 'Hồi phục 5% HP tối đa mỗi hiệp.', scene: 'an emerald moss spirit tortoise phantom radiating calm healing rings' },
  { item_id: 'soul_epic_7', item_name: 'Thiên Cương Bạch Hổ Hồn', item_type: 'soul', rarity: 'Tiên Phẩm', rarity_key: 'epic', element: 'Kim', bonus_atk: 315, bonus_def: 180, bonus_spd: 390, bonus_hp: 0, bonus_crit: 0, hax_skill: null, hax_desc: 'Xuyên 30% giáp DEF & tăng +10% Crit.', scene: 'a roaring platinum white-tiger spirit wreathed in gold sword halos' },
  { item_id: 'soul_epic_8', item_name: 'Huyền Minh Giao Long Hồn', item_type: 'soul', rarity: 'Tiên Phẩm', rarity_key: 'epic', element: 'Thủy', bonus_atk: 270, bonus_def: 240, bonus_spd: 400, bonus_hp: 0, bonus_crit: 0, hax_skill: null, hax_desc: '25% đóng băng địch & hút 14% sát thương.', scene: 'a coiled sapphire ice-flood dragon soul breathing mist waves' },
  { item_id: 'soul_epic_9', item_name: 'Thái Cổ Huyết Dực Hồn', item_type: 'soul', rarity: 'Tiên Phẩm', rarity_key: 'epic', element: 'Ám', bonus_atk: 300, bonus_def: 160, bonus_spd: 425, bonus_hp: 0, bonus_crit: 0, hax_skill: null, hax_desc: 'Hút 24% sát thương & giảm 25% hồi máu địch.', scene: 'a crimson-black vampire bat-dragon soul haloed by blood runes' },

  // 16 Chiến Hồn Thần Thoại Không Độc Nhất
  { item_id: 'soul_mythic_6', item_name: '« Thanh Long Chiến Đế Hồn »', item_type: 'soul', rarity: 'Thần Thoại', rarity_key: 'mythic', element: 'Mộc', bonus_atk: 365, bonus_def: 280, bonus_spd: 465, bonus_hp: 0, bonus_crit: 0, hax_skill: 'Thanh Long Hồi Sinh', hax_desc: 'Mỗi hiệp tăng +6% ATK (max 5 tầng) & hồi 8% HP tối đa.', scene: 'an imperial azure-emerald azure dragon war-soul swirling with celestial Qi' },
  { item_id: 'soul_mythic_7', item_name: '« Chu Tước Phần Thiên Hồn »', item_type: 'soul', rarity: 'Thần Thoại', rarity_key: 'mythic', element: 'Hỏa', bonus_atk: 390, bonus_def: 230, bonus_spd: 470, bonus_hp: 0, bonus_crit: 0, hax_skill: 'Chu Tước Tái Sinh', hax_desc: 'Hồi sinh 1 lần với 48% HP & đốt 8% HP tối đa địch mỗi hiệp.', scene: 'a blazing vermilion phoenix war-spirit bursting from golden solar flames' },
  { item_id: 'soul_mythic_8', item_name: '« Bạch Hổ Sát Thần Hồn »', item_type: 'soul', rarity: 'Thần Thoại', rarity_key: 'mythic', element: 'Kim', bonus_atk: 405, bonus_def: 210, bonus_spd: 475, bonus_hp: 0, bonus_crit: 0, hax_skill: 'Bạch Hổ Trảm Khiên', hax_desc: 'Xuyên 60% Khiên & tăng +16% tỉ lệ Bạo Kích.', scene: 'a fierce platinum saber-tiger war-spirit clad in razor swordlight' },
  { item_id: 'soul_mythic_9', item_name: '« Huyền Vũ Trường Thọ Hồn »', item_type: 'soul', rarity: 'Thần Thoại', rarity_key: 'mythic', element: 'Thủy', bonus_atk: 300, bonus_def: 390, bonus_spd: 430, bonus_hp: 0, bonus_crit: 0, hax_skill: 'Huyền Vũ Phản Sát', hax_desc: 'Giảm 26% sát thương nhận vào & phản đòn 42% sát thương.', scene: 'a deep-sea sapphire dragon-turtle soul haloed by frozen constellation runes' },
  { item_id: 'soul_mythic_10', item_name: '« Cửu Thiên Lôi Hoàng Hồn »', item_type: 'soul', rarity: 'Thần Thoại', rarity_key: 'mythic', element: 'Lôi', bonus_atk: 375, bonus_def: 240, bonus_spd: 495, bonus_hp: 0, bonus_crit: 0, hax_skill: 'Lôi Hoàng Cướp Tốc', hax_desc: 'Cướp 30% SPD địch thành ATK & 25% gây Choáng 1 hiệp.', scene: 'a thunder-winged golden kirin war-soul crackling with purple plasma' },
  { item_id: 'soul_mythic_11', item_name: '« Hư Không Tinh Hồ Hồn »', item_type: 'soul', rarity: 'Thần Thoại', rarity_key: 'mythic', element: 'Hư Không', bonus_atk: 355, bonus_def: 260, bonus_spd: 485, bonus_hp: 0, bonus_crit: 0, hax_skill: 'Tinh Hồ Hoán Ảnh', hax_desc: '30% Né hoàn toàn & phản công ngay 80% ATK xuyên 40% DEF.', scene: 'a starry dimensional nine-tailed fox spirit woven from silver nebulae' },
  { item_id: 'soul_mythic_12', item_name: '« Minh Giới Tu La Đế Hồn »', item_type: 'soul', rarity: 'Thần Thoại', rarity_key: 'mythic', element: 'Ám', bonus_atk: 395, bonus_def: 230, bonus_spd: 465, bonus_hp: 0, bonus_crit: 0, hax_skill: 'Tu La Phệ Huyết', hax_desc: 'Hút 28% sát thương & giảm 45% hồi phục của địch suốt trận.', scene: 'a dark-violet armored Asura phantom spirit wielding dual shadow glaives' },
  { item_id: 'soul_mythic_13', item_name: '« Thái Dương Kim Ô Chiến Hồn »', item_type: 'soul', rarity: 'Thần Thoại', rarity_key: 'mythic', element: 'Hỏa', bonus_atk: 395, bonus_def: 225, bonus_spd: 470, bonus_hp: 0, bonus_crit: 0, hax_skill: 'Kim Ô Chân Hỏa', hax_desc: 'Xuyên 55% DEF & thiêu đốt 9% HP tối đa địch mỗi hiệp.', scene: 'a three-legged golden sun-crow war-soul blazing inside a solar ring' },
  { item_id: 'soul_mythic_14', item_name: '« Hậu Thổ Sơn Thần Chiến Hồn »', item_type: 'soul', rarity: 'Thần Thoại', rarity_key: 'mythic', element: 'Thổ', bonus_atk: 330, bonus_def: 375, bonus_spd: 425, bonus_hp: 0, bonus_crit: 0, hax_skill: 'Thần Sơn Hộ Thuẫn', hax_desc: 'Đầu trận tạo khiên 65% HP & giảm 35% sát thương Bạo Kích.', scene: 'an ancient amber mountain titan war-soul wrapped in golden rune pillars' },
  { item_id: 'soul_mythic_15', item_name: '« Thánh Nữ Quang Minh Hồn »', item_type: 'soul', rarity: 'Thần Thoại', rarity_key: 'mythic', element: 'Quang', bonus_atk: 325, bonus_def: 345, bonus_spd: 460, bonus_hp: 0, bonus_crit: 0, hax_skill: 'Thánh Quang Bất Khuất', hax_desc: 'Miễn nhiễm Khống Chế & hồi 10% HP mỗi hiệp.', scene: 'a radiant golden seraph spirit haloed by luminous pearl lotus petals' },
  { item_id: 'soul_mythic_16', item_name: '« Thiên Ma Huyễn Mị Chiến Hồn »', item_type: 'soul', rarity: 'Thần Thoại', rarity_key: 'mythic', element: 'Ám', bonus_atk: 365, bonus_def: 270, bonus_spd: 475, bonus_hp: 0, bonus_crit: 0, hax_skill: 'Huyễn Mị Đoạt Tâm', hax_desc: '36% xác suất Mị Hoặc ép đối thủ tự đánh mình mỗi hiệp.', scene: 'a bewitching violet-pink phantom fox spirit veiled in floating lotus mist' },
  { item_id: 'soul_mythic_17', item_name: '« Kiếm Tiên Độc Cô Chiến Hồn »', item_type: 'soul', rarity: 'Thần Thoại', rarity_key: 'mythic', element: 'Kim', bonus_atk: 390, bonus_def: 240, bonus_spd: 475, bonus_hp: 0, bonus_crit: 0, hax_skill: 'Kiếm Ý Cửu Thiên', hax_desc: 'Mỗi 2 hiệp tung thêm kiếm khí 75% ATK xuyên 55% DEF.', scene: 'a solitary azure-gold sword immortal spirit floating above misty blades' },
  { item_id: 'soul_mythic_18', item_name: '« Băng Hoàng Tuyết Vực Hồn »', item_type: 'soul', rarity: 'Thần Thoại', rarity_key: 'mythic', element: 'Thủy', bonus_atk: 345, bonus_def: 310, bonus_spd: 465, bonus_hp: 0, bonus_crit: 0, hax_skill: 'Băng Hoàng Đông Kết', hax_desc: '28% Đóng Băng địch 1 hiệp & giảm 18% ATK địch trong 3 hiệp.', scene: 'a crystal snow-phoenix war-soul trailing glittering diamond frost wings' },
  { item_id: 'soul_mythic_19', item_name: '« Vạn Độc Minh Xà Hồn »', item_type: 'soul', rarity: 'Thần Thoại', rarity_key: 'mythic', element: 'Mộc', bonus_atk: 360, bonus_def: 265, bonus_spd: 470, bonus_hp: 0, bonus_crit: 0, hax_skill: 'Kịch Độc Phệ Tâm', hax_desc: 'Tẩm độc rút 9% HP tối đa/hiệp & giảm 35% hồi phục địch.', scene: 'an abyssal jade-purple viper war-soul dripping luminescent venom orbs' },
  { item_id: 'soul_mythic_20', item_name: '« Lôi Công Phá Trận Hồn »', item_type: 'soul', rarity: 'Thần Thoại', rarity_key: 'mythic', element: 'Lôi', bonus_atk: 380, bonus_def: 255, bonus_spd: 470, bonus_hp: 0, bonus_crit: 0, hax_skill: 'Lôi Phạt Phá Vực', hax_desc: '26% gây Choáng & tăng +18% hiệu lực Buff Linh Vực phe mình.', scene: 'a muscular celestial thunder-god spirit beating glowing plasma drums' },
  { item_id: 'soul_mythic_21', item_name: '« Thái Ất Đảo Nghịch Hồn »', item_type: 'soul', rarity: 'Thần Thoại', rarity_key: 'mythic', element: 'Hư Không', bonus_atk: 355, bonus_def: 310, bonus_spd: 465, bonus_hp: 0, bonus_crit: 0, hax_skill: 'Sinh Mệnh Đổi Chỗ', hax_desc: 'Khi HP < 22% hoán đổi % máu với địch (1 lần/trận) & +12% Né.', scene: 'twin silver-violet celestial spirit rings rotating in cosmic symmetry' },

  // 10 Chiến Hồn Thần Thoại Độc Nhất
  { item_id: 'soul_unique_1', item_name: '« Hỗn Nguyên Tổ Long Đế Hồn »', item_type: 'soul', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: true, element: 'Hỗn Độn', bonus_atk: 420, bonus_def: 320, bonus_spd: 495, bonus_hp: 0, bonus_crit: 0, hax_skill: 'Tổ Long Hộ Đạo', hax_desc: 'Mỗi hiệp +7% ATK (max 5 tầng), xuyên 50% DEF & hồi 6% HP/hiệp.', scene: 'a primordial rainbow-gold ancestor dragon soul wreathed in chaos seals' },
  { item_id: 'soul_unique_2', item_name: '« Bất Tử Thần Hoàng Chiến Hồn »', item_type: 'soul', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: true, element: 'Hỏa', bonus_atk: 425, bonus_def: 265, bonus_spd: 500, bonus_hp: 0, bonus_crit: 0, hax_skill: 'Thần Hoàng Niết Bàn', hax_desc: 'Hồi sinh 1 lần với 58% HP & đốt 10% HP tối đa địch bỏ qua khiên.', scene: 'an imperial golden-scarlet phoenix war-soul blooming with sun halos' },
  { item_id: 'soul_unique_3', item_name: '« Thái Cổ Bạch Đế Kiếm Hồn »', item_type: 'soul', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: true, element: 'Kim', bonus_atk: 435, bonus_def: 255, bonus_spd: 500, bonus_hp: 0, bonus_crit: 0, hax_skill: 'Đế Kiếm Quy Nhất', hax_desc: 'Mỗi 2 hiệp chém kiếm khí 85% ATK xuyên 65% DEF & 60% Khiên.', scene: 'a sovereign white-tiger sword-emperor phantom ringed by mythic blades' },
  { item_id: 'soul_unique_4', item_name: '« Thời Không Thần Vương Hồn »', item_type: 'soul', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: true, element: 'Hư Không', bonus_atk: 400, bonus_def: 310, bonus_spd: 515, bonus_hp: 0, bonus_crit: 0, hax_skill: 'Thời Gian Đình Trệ', hax_desc: '1 lần/trận ngưng đọng thời gian tung liên hoàn 2 lượt & +15% Né.', scene: 'an astral time-god spirit floating inside rotating golden starlight clocks' },
  { item_id: 'soul_unique_5', item_name: '« Huyền Minh Đế Quy Thần Hồn »', item_type: 'soul', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: true, element: 'Thủy', bonus_atk: 335, bonus_def: 430, bonus_spd: 460, bonus_hp: 0, bonus_crit: 0, hax_skill: 'Bắc Minh Thần Giáp', hax_desc: 'Giảm 32% sát thương, phản đòn 50% & 25% đóng băng kẻ tấn công.', scene: 'a colossal frost sapphire dragon-turtle phantom wearing an ice crown' },
  { item_id: 'soul_unique_6', item_name: '« Cửu Thiên Lôi Đế Chiến Hồn »', item_type: 'soul', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: true, element: 'Lôi', bonus_atk: 410, bonus_def: 270, bonus_spd: 525, bonus_hp: 0, bonus_crit: 0, hax_skill: 'Cửu Lôi Chấn Tốc', hax_desc: 'Cướp 36% SPD địch thành ATK & 30% tỉ lệ gây Choáng 1 hiệp.', scene: 'a sovereign purple storm-emperor war-soul wielding twin thunder halberds' },
  { item_id: 'soul_unique_7', item_name: '« Thiên Hồ Độc Tôn Mị Hồn »', item_type: 'soul', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: true, element: 'Quang', bonus_atk: 385, bonus_def: 330, bonus_spd: 500, bonus_hp: 0, bonus_crit: 0, hax_skill: 'Tuyệt Thế Mị Ảnh', hax_desc: '42% Mị Hoặc địch tự đánh mình & miễn nhiễm Choáng/Đóng Băng.', scene: 'a luminous golden-rose celestial nine-tailed fox phantom crowned in divine light' },
  { item_id: 'soul_unique_8', item_name: '« Vô Tận Minh Hoàng Chiến Hồn »', item_type: 'soul', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: true, element: 'Ám', bonus_atk: 430, bonus_def: 265, bonus_spd: 495, bonus_hp: 0, bonus_crit: 0, hax_skill: 'Minh Hoàng Đoạt Mệnh', hax_desc: 'Hút 32% ST thành HP, giảm 55% hồi máu địch & kết liễu < 22% HP (35%).', scene: 'an abyssal violet-gold nether emperor war-soul in tattered spirit robes' },
  { item_id: 'soul_unique_9', item_name: '« Thanh Đế Thái Ất Thần Hồn »', item_type: 'soul', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: true, element: 'Mộc', bonus_atk: 365, bonus_def: 385, bonus_spd: 480, bonus_hp: 0, bonus_crit: 0, hax_skill: 'Vạn Mộc Hồi Sinh', hax_desc: 'Hồi 14% HP tối đa/hiệp, hóa giải 1 debuff & miễn nhiễm Độc/Đốt.', scene: 'a sacred emerald spring sovereign spirit blooming with floating lotus petals' },
  { item_id: 'soul_unique_10', item_name: '« Bàn Cổ Khai Thiên Chiến Hồn »', item_type: 'soul', rarity: 'Thần Thoại', rarity_key: 'mythic', is_unique: true, element: 'Thổ', bonus_atk: 380, bonus_def: 410, bonus_spd: 455, bonus_hp: 0, bonus_crit: 0, hax_skill: 'Khai Thiên Vực Hộ', hax_desc: 'Khiên 72% HP đầu trận & tăng +22% hiệu lực Buff + Debuff Linh Vực.', scene: 'a primordial colossal giant spirit phantom holding glowing sky-and-earth seals' },
];

export const V13_NEW_EQUIPMENT = RAW_NEW_EQUIPMENT.map((it) => ({
  item_id: it.item_id,
  item_name: it.item_name,
  item_type: it.item_type,
  rarity: it.rarity,
  rarity_key: it.rarity_key,
  element: it.element,
  bonus_atk: it.bonus_atk,
  bonus_def: it.bonus_def,
  bonus_spd: it.bonus_spd,
  bonus_hp: it.bonus_hp,
  bonus_crit: it.bonus_crit,
  hax_skill: it.hax_skill,
  hax_description: it.hax_desc,
  drop_rate: it.rarity_key === 'mythic' ? 0.5 : it.rarity_key === 'epic' ? 14.0 : it.rarity_key === 'rare' ? 25.0 : 60.5,
  is_unique: Boolean(it.is_unique),
  file: `items/${it.item_id}.png`,
  visual_prompt: buildEquipPrompt(it.item_type, it.element, it.rarity_key, it.scene),
}));

// =========================================================================
// 17 EMOJI MINIGAMES (/coinflip, /slots 4 ô, /blackjack, /crash)
// (Tuyệt đối KHÔNG ghi chú logic tỷ lệ thắng nội bộ trong file này)
// =========================================================================
export const V13_MINIGAME_EMOJI_PROMPTS = [
  // Coinflip (3)
  {
    uid: 'coin_spin',
    game: '/coinflip',
    type: 'Animated GIF (8 frames • 70ms/frame • ~14 FPS • 128x128px • < 256 KB)',
    name: 'Đồng Xu Linh Thạch Đang Xoay',
    usage: 'Hiển thị ở Pha 1 ngay khi bấm /coinflip, tự động Edit tin nhắn dừng kết quả sau 2 giây.',
    visual_prompt: '2D game icon animation sprite sheet of a mystical cultivation gold and cyan jade coin spinning rapidly on its vertical axis, 8 seamless loop frames arranged horizontally, glowing nine-tailed fox emblem on one side and celestial lotus sigil on the other, golden spark particles trailing around the spinning edge, crisp dark outline for Discord 128x128 emoji visibility, transparent background, vibrant fantasy mobile RPG UI style, high contrast, no text, seamless loop.',
  },
  {
    uid: 'coin_heads',
    game: '/coinflip',
    type: 'Static PNG / Light Sparkle (128x128px)',
    name: 'Mặt Ngửa — Tiên Hồ Ấn',
    usage: 'Kết quả mặt Ngửa (Tiên Ấn) khi đồng xu ngừng xoay.',
    visual_prompt: '2D game icon of a luxurious celestial gold-rimmed cyan jade coin facing front, engraved with a glowing golden nine-tailed fox spirit crest in the center, subtle magical sparkle aura, thick dark outer contour optimized for 128x128 Discord emoji, transparent background, fantasy cultivation game UI asset, sharp vector-like details, no text.',
  },
  {
    uid: 'coin_tails',
    game: '/coinflip',
    type: 'Static PNG / Light Sparkle (128x128px)',
    name: 'Mặt Úp — Nguyệt Liên Ấn',
    usage: 'Kết quả mặt Úp (Liên Ấn) khi đồng xu ngừng xoay.',
    visual_prompt: '2D game icon of a luxurious celestial silver-rimmed purple jade coin facing front, engraved with a radiant mystic lotus and crescent moon sigil in the center, subtle violet aura particles, thick dark outer contour optimized for 128x128 Discord emoji, transparent background, fantasy cultivation game UI asset, sharp details, no text.',
  },

  // Slots 4 ô (7)
  {
    uid: 'slot_spin',
    game: '/slots (4 Ô Quay)',
    type: 'Animated GIF (6 frames • 65ms/frame • ~15 FPS • 128x128px • < 256 KB)',
    name: 'Cuộn Slot Tiên Giới Đang Quay',
    usage: 'Hiển thị đồng thời ở 4 ô Slot trong Pha 1 đang quay, sau đó dừng tuần tự từng ô sang kết quả.',
    visual_prompt: '2D game icon animation sprite sheet of a vertical glowing cultivation slot reel spinning rapidly downwards with motion blur streaks of cyan jade, golden talisman, pink fox spirit, and purple flame symbols, 6 seamless loop frames inside a sleek ornate gold-trimmed dark frame, 128x128 Discord emoji style, transparent background, high contrast neon fantasy glow, no text.',
  },
  {
    uid: 'slot_fox',
    game: '/slots (4 Ô Quay)',
    type: 'Static PNG (128x128px) — Biểu tượng Jackpot 1:5',
    name: 'Cửu Vĩ Kim Hồ (Jackpot 4x = 1:5)',
    usage: 'Biểu tượng trả thưởng cao nhất của máy quay Slots 4 ô (trúng 4 ô liên tiếp ăn 1:5).',
    visual_prompt: '2D game icon of a radiant golden nine-tailed fox head emblem with glowing pink eyes and celestial crown, surrounded by golden aura sparks, bold silhouette for 128x128 Discord emoji, transparent background, premium xianxia gacha UI style, no text.',
  },
  {
    uid: 'slot_jade',
    game: '/slots (4 Ô Quay)',
    type: 'Static PNG (128x128px) — Biểu tượng Cực Phẩm 1:4',
    name: 'Cực Phẩm Linh Thạch (4x = 1:4)',
    usage: 'Biểu tượng pha lê Linh Thạch cao cấp trong Slots 4 ô.',
    visual_prompt: '2D game icon of a brilliant faceted cyan-blue spiritual crystal cluster glowing with intense inner energy, floating golden runes, bold dark outline for 128x128 Discord emoji, transparent background, xianxia RPG icon, no text.',
  },
  {
    uid: 'slot_sword',
    game: '/slots (4 Ô Quay)',
    type: 'Static PNG (128x128px)',
    name: 'Tiên Kiếm Phi Hành',
    usage: 'Biểu tượng Tiên Kiếm trong Slots 4 ô.',
    visual_prompt: '2D game icon of a diagonal glowing golden-jade flying immortal sword with lightning arcs around the blade, bold dark contour for 128x128 Discord emoji, transparent background, xianxia RPG icon, no text.',
  },
  {
    uid: 'slot_pill',
    game: '/slots (4 Ô Quay)',
    type: 'Static PNG (128x128px)',
    name: 'Cửu Chuyển Kim Đan',
    usage: 'Biểu tượng Kim Đan trong Slots 4 ô.',
    visual_prompt: '2D game icon of a radiant golden alchemy elixir pill floating above a small jade dish with swirling purple and gold medicinal Qi aura, bold dark contour for 128x128 Discord emoji, transparent background, xianxia RPG icon, no text.',
  },
  {
    uid: 'slot_lotus',
    game: '/slots (4 Ô Quay)',
    type: 'Static PNG (128x128px)',
    name: 'Huyết Liên Tiên Hoa',
    usage: 'Biểu tượng Hoa Sen trong Slots 4 ô.',
    visual_prompt: '2D game icon of a blooming crimson-pink celestial lotus flower emitting warm golden starlight particles, bold dark contour for 128x128 Discord emoji, transparent background, xianxia RPG icon, no text.',
  },
  {
    uid: 'slot_scroll',
    game: '/slots (4 Ô Quay)',
    type: 'Static PNG (128x128px)',
    name: 'Cổ Phù Đạo Quyển',
    usage: 'Biểu tượng Phù Chú trong Slots 4 ô.',
    visual_prompt: '2D game icon of an ancient floating golden talisman scroll inscribed with glowing cinnabar red seal runes, bold dark contour for 128x128 Discord emoji, transparent background, xianxia RPG icon, no text.',
  },

  // Blackjack (4)
  {
    uid: 'card_deal',
    game: '/blackjack',
    type: 'Animated GIF (6 frames • 80ms/frame • 128x128px • < 256 KB)',
    name: 'Linh Bài Đang Xào & Lật',
    usage: 'Hiệu ứng xào/lật bài khi khởi tạo ván hoặc khi bấm nút Hit / Stand.',
    visual_prompt: '2D game icon animation sprite sheet of an ornate dark-purple and gold cultivation tarot card flipping 180 degrees in mid-air with magical pink and cyan sparkles bursting on flip, 6 seamless frames, crisp 128x128 Discord emoji silhouette, transparent background, no text.',
  },
  {
    uid: 'card_back',
    game: '/blackjack',
    type: 'Static PNG (128x128px)',
    name: 'Mặt Úp Linh Bài Nhà Cái',
    usage: 'Hiển thị lá bài đang úp của Nhà Cái trước khi người chơi bấm Dừng (Stand).',
    visual_prompt: '2D game icon of the back of a mystical cultivation playing card, deep royal purple enamel with an intricate golden nine-tailed fox mandala border and glowing gem center, bold outline for 128x128 Discord emoji, transparent background, no text.',
  },
  {
    uid: 'card_win',
    game: '/blackjack',
    type: 'Static PNG (128x128px)',
    name: 'Xì Dách / Chiến Thắng 21',
    usage: 'Biểu tượng ăn mừng khi thắng Nhà Cái hoặc nổ Blackjack 21 điểm (tỷ lệ 1:2).',
    visual_prompt: '2D game icon of two overlapping glowing golden playing cards showing an Ace and a Celestial Crown with a burst of golden coins and sparkles, bold outline for 128x128 Discord emoji, transparent background, no text.',
  },
  {
    uid: 'card_bust',
    game: '/blackjack',
    type: 'Static PNG (128x128px)',
    name: 'Quắc Bài (> 21 Điểm)',
    usage: 'Biểu tượng thông báo khi điểm vượt quá 21.',
    visual_prompt: '2D game icon of a cracked dark playing card burning with purple spirit flames and a red X slash across it, bold outline for 128x128 Discord emoji, transparent background, no text.',
  },

  // Crash (3)
  {
    uid: 'crash_fly',
    game: '/crash (Phi Kiếm Độ Kiếp)',
    type: 'Animated GIF (6 frames • 70ms/frame • 128x128px • < 256 KB)',
    name: 'Phi Kiếm Vượt Kiếp Đang Bay',
    usage: 'Hiển thị liên tục trong lúc hệ số nhân đang leo dốc chờ người chơi bấm Rút Linh Thạch.',
    visual_prompt: '2D game icon animation sprite sheet of a radiant cyan-and-gold immortal flying sword soaring diagonally upward at 45 degrees with a blazing golden comet tail and speed lines, 6 seamless loop frames, high contrast 128x128 Discord emoji style, transparent background, no text.',
  },
  {
    uid: 'crash_boom',
    game: '/crash (Phi Kiếm Độ Kiếp)',
    type: 'Animated GIF (6 frames • 75ms/frame • 128x128px • < 256 KB)',
    name: 'Thiên Lôi Đánh Nổ Phi Kiếm',
    usage: 'Hiển thị khi hệ số nhân nổ trước khi người chơi kịp bấm Rút Linh Thạch.',
    visual_prompt: '2D game icon animation sprite sheet of a dramatic crimson-and-purple heavenly lightning explosion shattering a flying sword into glowing fragments, 6 frames burst loop, bold silhouette for 128x128 Discord emoji, transparent background, no text.',
  },
  {
    uid: 'crash_cashout',
    game: '/crash (Phi Kiếm Độ Kiếp)',
    type: 'Static PNG (128x128px)',
    name: 'Độ Kiếp Thành Công (Thu Lợi)',
    usage: 'Hiển thị khi người chơi bấm Rút Linh Thạch thành công trước lúc nổ.',
    visual_prompt: '2D game icon of a glowing golden treasure chest overflowing with cyan spirit crystals and a soaring golden immortal sword above it, triumphant aura, bold outline for 128x128 Discord emoji, transparent background, no text.',
  },
];

// =========================================================================
// 7 ASSET NÔNG TRẠI THỜI GIAN THỰC (/farm) & ĐỔI QUÀ (/exchange)
// =========================================================================
export const V13_FARM_ASSETS = [
  {
    uid: 'farm_essence',
    name: 'Linh Quả Tiên Giới',
    slot_type: 'Tiền tệ /exchange',
    growth_hours: null,
    care_window: 'Thu hoạch từ /farm & tiêu tại /exchange',
    reward_summary: 'Đổi Linh Thạch, Đá Khắc Ấn, Tinh Thạch Sao, Vé Reset Tháp & Vé Gacha',
    visual_prompt: `A glowing celestial peach-shaped crystal fruit dripping rainbow golden nectar droplets with two emerald leaves, ${EMOJI_ICON_STYLE_DIRECTIVE}.`,
  },
  {
    uid: 'seed_linh_thao',
    name: 'Hạt Giống Linh Thảo (6h)',
    slot_type: 'Linh Điền (6 giờ)',
    growth_hours: 6,
    care_window: 'Tưới mỗi 2h • Quá 4.5h bỏ quên sẽ héo',
    reward_summary: 'Giá 80 LT -> Thu 145 LT + 15 Linh Quả',
    visual_prompt: `A glowing emerald herbal seed sprouting two luminous cyan dew-kissed leaves in rich golden soil pouch, ${EMOJI_ICON_STYLE_DIRECTIVE}.`,
  },
  {
    uid: 'seed_tien_thao',
    name: 'Hạt Giống Tiên Thảo (12h)',
    slot_type: 'Linh Điền (12 giờ)',
    growth_hours: 12,
    care_window: 'Tưới mỗi 4h • Quá 7h bỏ quên sẽ héo',
    reward_summary: 'Giá 200 LT -> Thu 390 LT + 40 Linh Quả',
    visual_prompt: `A luminous amethyst-gold immortal lotus bulb with swirling starry spirit petals ready to bloom, ${EMOJI_ICON_STYLE_DIRECTIVE}.`,
  },
  {
    uid: 'seed_than_moc',
    name: 'Hạt Giống Thần Mộc (24h)',
    slot_type: 'Linh Điền (24 giờ)',
    growth_hours: 24,
    care_window: 'Tưới mỗi 6h • Quá 12h bỏ quên sẽ héo',
    reward_summary: 'Giá 500 LT -> Thu 1.050 LT + 110 Linh Quả',
    visual_prompt: `A sacred golden world-tree acorn inlaid with ancient glowing jade runes and shimmering divine sprouts, ${EMOJI_ICON_STYLE_DIRECTIVE}.`,
  },
  {
    uid: 'egg_linh_thu',
    name: 'Trứng Linh Thú (6h)',
    slot_type: 'Linh Các (6 giờ)',
    growth_hours: 6,
    care_window: 'Cho ăn mỗi 2h • Quá 4.5h bỏ đói sẽ bỏ đi',
    reward_summary: 'Giá 120 LT -> Thu 220 LT + 22 Linh Quả',
    visual_prompt: `A pastel cyan speckled spirit beast egg nestled in a warm golden nest pulsing with gentle aura, ${EMOJI_ICON_STYLE_DIRECTIVE}.`,
  },
  {
    uid: 'egg_tien_thu',
    name: 'Trứng Tiên Thú (12h)',
    slot_type: 'Linh Các (12 giờ)',
    growth_hours: 12,
    care_window: 'Cho ăn mỗi 4h • Quá 7h bỏ đói sẽ bỏ đi',
    reward_summary: 'Giá 300 LT -> Thu 580 LT + 60 Linh Quả',
    visual_prompt: `An ornate purple-and-silver dragon-scaled immortal beast egg ringed by glowing celestial feathers, ${EMOJI_ICON_STYLE_DIRECTIVE}.`,
  },
  {
    uid: 'egg_than_thu',
    name: 'Trứng Thần Thú (24h)',
    slot_type: 'Linh Các (24 giờ)',
    growth_hours: 24,
    care_window: 'Cho ăn mỗi 6h • Quá 12h bỏ đói sẽ bỏ đi',
    reward_summary: 'Giá 750 LT -> Thu 1.600 LT + 165 Linh Quả',
    visual_prompt: `A majestic radiant gold-and-crimson mythic nine-tailed beast egg haloed by ancient runes and phoenix fire, ${EMOJI_ICON_STYLE_DIRECTIVE}.`,
  },
];
