/**
 * src/data/catalog.js
 * Danh mục chuẩn (Single Source of Truth) cho 165 Pháp Bảo Loadout, 91 Linh Thú (v1.3 + Độc Quyền Fuyumi),
 * 31 Linh Vực + 16 Thần Thức + 16 Thần Cảnh, Nông Trại (/farm, /exchange), và hệ thống SuMi Family (Update v1.3).
 */

import { em, tierEmoji, tierEmojiKey, roleTierEmoji, roleTierEmojiKey, itemEmoji, itemEmojiKey, petEmoji, petEmojiKey, ringEmoji, elementEmoji, gradeEmoji, gradeEmojiKey, domainEmoji, domainEmojiKey, senseEmoji, senseEmojiKey, realmEmojiById, realmEmojiKeyById, farmEmoji, uiEm } from '../config/emojiHelper.js';
import { V15_AVATAR_FRAME_SPECS } from './v15AssetsCatalog.js';
import {
  V13_DOMAIN_ELEMENTS,
  V13_DOMAINS,
  V13_DIVINE_SENSES,
  V13_DIVINE_REALMS,
  V13_NEW_PETS,
  V13_NEW_EQUIPMENT,
  V13_FARM_ASSETS,
} from './v13ExpansionCatalog.js';
import {
  V17_NEW_PETS,
  V17_PET_EVOLUTIONS,
  FUYUMI_SUPREME_ULTIMATE,
  FUYUMI_SUPREME_EVOLUTION,
  V17_NEW_EQUIPMENT,
  V17_DOMAINS,
  V17_DIVINE_SENSES,
  V17_DIVINE_REALMS,
  V17_AVATAR_FRAMES,
  buildV17ShopConsumables,
  buildV17SpecialConsumables,
} from './v17ExpansionCatalog.js';

export { V17_PET_EVOLUTIONS, FUYUMI_SUPREME_ULTIMATE, FUYUMI_SUPREME_EVOLUTION };

export const FUYUMI_USER_ID = '757091869183311872';
export const NHIEM_NHIEM_BOT_ID = '916469360401453067';
export const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || 'https://sumi-profile-backend.onrender.com').replace(/\/$/, '');

export const RARITY_TIERS = {
  common: { key: 'common', label: 'Phàm Phẩm', dbKey: 'Pham Pham', dropRate: 60.4, color: '#94a3b8', colorDec: 9741496, emoji: tierEmoji('common'), emoji_key: tierEmojiKey('common') },
  rare: { key: 'rare', label: 'Linh Phẩm', dbKey: 'Linh Pham', dropRate: 25.0, color: '#3b82f6', colorDec: 3900150, emoji: tierEmoji('rare'), emoji_key: tierEmojiKey('rare') },
  epic: { key: 'epic', label: 'Tiên Phẩm', dbKey: 'Tien Pham', dropRate: 14.0, color: '#a855f7', colorDec: 11032055, emoji: tierEmoji('epic'), emoji_key: tierEmojiKey('epic') },
  mythic: { key: 'mythic', label: 'Thần Thoại', dbKey: 'Than Thoai', dropRate: 0.6, color: '#f59e0b', colorDec: 16096779, emoji: tierEmoji('mythic'), emoji_key: tierEmojiKey('mythic') },
  unique_supreme: { key: 'unique_supreme', label: 'Tối Thượng', dbKey: 'Tối Thượng', dropRate: 0.03, color: '#f43f5e', colorDec: 16007006, emoji: tierEmoji('unique_supreme'), emoji_key: tierEmojiKey('unique_supreme') },
  evolved_supreme: { key: 'evolved_supreme', label: 'Tối Thượng Chân Thần', dbKey: 'Tối Thượng Chân Thần', dropRate: 0.0, color: '#fb7185', colorDec: 16478597, emoji: tierEmoji('evolved_supreme'), emoji_key: tierEmojiKey('evolved_supreme') },
  supreme: { key: 'supreme', label: 'Tối Thượng Thần Thoại', dbKey: 'Tối Thượng Thần Thoại', dropRate: 0.0, color: '#ec4899', colorDec: 15485081, emoji: tierEmoji('supreme'), emoji_key: tierEmojiKey('supreme') },
};

export function normalizeRarityKey(raw) {
  if (!raw) return 'common';
  const s = String(raw).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').trim();
  if (s === 'evolved_supreme' || s.includes('chan than') || s.includes('evolved')) return 'evolved_supreme';
  if (s === 'unique_supreme') return 'unique_supreme';
  if (s === 'supreme' || (s.includes('toi thuong') && s.includes('than thoai'))) return 'supreme';
  if (s.includes('toi thuong')) return 'unique_supreme';
  if (s.includes('than thoai') || s.includes('mythic')) return 'mythic';
  if (s.includes('tien pham') || s.includes('cuc pham') || s.includes('epic')) return 'epic';
  if (s.includes('linh pham') || s.includes('hiem') || s.includes('rare')) return 'rare';
  return 'common';
}

export function isMythicBandRarity(raw) {
  const rk = normalizeRarityKey(raw);
  return rk === 'mythic' || rk === 'unique_supreme' || rk === 'evolved_supreme' || rk === 'supreme';
}

export function resolveEntityDisplayRarityKey(entity = {}, isEvolved = false) {
  if (entity?.is_exclusive_fuyumi || entity?.rarity_key === 'supreme') return 'supreme';
  if (isEvolved || entity?.is_evolved) return 'evolved_supreme';
  if (entity?.is_unique) return 'unique_supreme';
  return normalizeRarityKey(entity?.rarity_key || entity?.rarity || 'common');
}

export function formatRarityLabel(raw) {
  const key = normalizeRarityKey(raw);
  return RARITY_TIERS[key]?.label || 'Phàm Phẩm';
}

export const LEVEL_ROLE_MILESTONES = [
  { level: 5, roleId: '1038406122417176586', name: '« 5・U Linh Chớm Nở »' },
  { level: 10, roleId: '1038405196662976562', name: '« 10・Linh Cáo Học Giả »' },
  { level: 20, roleId: '1032988544874061836', name: '« 20・ Linh Cáo Tinh Anh »' },
  { level: 35, roleId: '1375446293119369331', name: '« 35・Yêu Hồ Nguyệt Ảnh »' },
  { level: 45, roleId: '1375451249952161903', name: '« 45・Huyễn Linh Thú »' },
  { level: 60, roleId: '1375446809408962620', name: '« 60・Thiên Hồ Viễn Cổ »' },
  { level: 80, roleId: '1473419954379554967', name: '« 80・Chi Linh Thánh Đế »' },
  { level: 100, roleId: '1473419957655175169', name: '« 100・Hỗn Độn Chúa Tể »' },
];

export const MYTHIC_UNIQUE_ITEM_IDS = new Set([
  'weapon_mythic_1', 'weapon_mythic_2', 'weapon_mythic_3',
  'gem_mythic_1', 'gem_mythic_2', 'gem_mythic_3',
  'soul_mythic_1', 'soul_mythic_2', 'soul_mythic_3',
  ...V13_NEW_EQUIPMENT.filter((it) => it.is_unique).map((it) => it.item_id),
  ...V17_NEW_EQUIPMENT.filter((it) => it.is_unique).map((it) => it.item_id),
]);

export const MYTHIC_UNIQUE_PET_TYPES = new Set([
  ...V13_NEW_PETS.filter((p) => p.is_unique).map((p) => p.pet_type),
  ...V17_NEW_PETS.filter((p) => p.is_unique).map((p) => p.pet_type),
]);

export const MYTHIC_UNIQUE_DOMAIN_IDS = new Set([
  ...V13_DOMAINS.filter((d) => d.is_unique && !d.is_exclusive_fuyumi).map((d) => d.domain_id),
  ...V17_DOMAINS.filter((d) => d.is_unique && !d.is_exclusive_fuyumi).map((d) => d.domain_id),
]);

export const MYTHIC_UNIQUE_SENSE_IDS = new Set([
  ...V13_DIVINE_SENSES.filter((s) => s.is_unique && !s.is_exclusive_fuyumi).map((s) => s.sense_id),
  ...V17_DIVINE_SENSES.filter((s) => s.is_unique && !s.is_exclusive_fuyumi).map((s) => s.sense_id),
]);

export const MYTHIC_UNIQUE_REALM_IDS = new Set([
  ...V13_DIVINE_REALMS.filter((r) => r.is_unique && !r.is_exclusive_fuyumi).map((r) => r.realm_id),
  ...V17_DIVINE_REALMS.filter((r) => r.is_unique && !r.is_exclusive_fuyumi).map((r) => r.realm_id),
]);

/**
 * Toàn bộ 165 Pháp Bảo Loadout (57 Vũ Khí, 54 Bảo Ngọc, 54 Chiến Hồn)
 * Gồm 39 Thần Thoại Độc Nhất Toàn Server (9 gốc + 30 v1.3) & 56 Thần Thoại Không Độc Nhất (6 v1.1 + 50 v1.3).
 */
export const EQUIPMENT_CATALOG = [
  // 23 Vũ Khí (Weapons)
  { item_id: 'weapon_common_1', item_name: 'Thiết Mộc Trọng Kiếm', item_type: 'weapon', rarity: 'Phàm Phẩm', rarity_key: 'common', element: 'Kim', bonus_atk: 150, bonus_def: 0, bonus_spd: 0, bonus_hp: 0, bonus_crit: 5.0, hax_skill: null, hax_description: 'Tăng +5% tỉ lệ bạo kích cơ bản.', drop_rate: 60.0, is_unique: false },
  { item_id: 'weapon_common_2', item_name: 'Thanh Trúc Linh Cung', item_type: 'weapon', rarity: 'Phàm Phẩm', rarity_key: 'common', element: 'Mộc', bonus_atk: 120, bonus_def: 0, bonus_spd: 50, bonus_hp: 0, bonus_crit: 0.0, hax_skill: null, hax_description: 'Đòn đánh tăng nhẹ +8% sát thương khi SPD cao hơn địch.', drop_rate: 60.0, is_unique: false },
  { item_id: 'weapon_common_3', item_name: 'Hắc Thiết Song Đao', item_type: 'weapon', rarity: 'Phàm Phẩm', rarity_key: 'common', element: 'Hỏa', bonus_atk: 140, bonus_def: 0, bonus_spd: 30, bonus_hp: 0, bonus_crit: 0.0, hax_skill: null, hax_description: '15% xác suất chém bồi thêm 25% ATK.', drop_rate: 60.0, is_unique: false },
  { item_id: 'weapon_common_4', item_name: 'Toái Thạch Cự Phủ', item_type: 'weapon', rarity: 'Phàm Phẩm', rarity_key: 'common', element: 'Thổ', bonus_atk: 160, bonus_def: 80, bonus_spd: -20, bonus_hp: 0, bonus_crit: 0.0, hax_skill: null, hax_description: 'Bổ sung phòng thủ và Xuyên 10% DEF địch.', drop_rate: 60.0, is_unique: false },
  { item_id: 'weapon_common_5', item_name: 'Xích Đồng Trường Thương', item_type: 'weapon', rarity: 'Phàm Phẩm', rarity_key: 'common', element: 'Hỏa', bonus_atk: 145, bonus_def: 0, bonus_spd: 35, bonus_hp: 0, bonus_crit: 3.0, hax_skill: null, hax_description: 'Đòn đầu trận tăng +15% sát thương.', drop_rate: 60.0, is_unique: false },
  { item_id: 'weapon_common_6', item_name: 'Băng Tinh Song Chủy', item_type: 'weapon', rarity: 'Phàm Phẩm', rarity_key: 'common', element: 'Thủy', bonus_atk: 130, bonus_def: 0, bonus_spd: 55, bonus_hp: 0, bonus_crit: 4.0, hax_skill: null, hax_description: 'Giảm 5% SPD đối thủ trong 2 hiệp đầu.', drop_rate: 60.0, is_unique: false },

  { item_id: 'weapon_rare_1', item_name: 'Tử Điện Lôi Minh Thương', item_type: 'weapon', rarity: 'Linh Phẩm', rarity_key: 'rare', element: 'Lôi', bonus_atk: 320, bonus_def: 0, bonus_spd: 0, bonus_hp: 0, bonus_crit: 8.0, hax_skill: null, hax_description: '15% tỉ lệ gây Tê Liệt khiến đối thủ mất lượt.', drop_rate: 25.0, is_unique: false },
  { item_id: 'weapon_rare_2', item_name: 'U Hỏa Nhiễm Huyết Kiếm', item_type: 'weapon', rarity: 'Linh Phẩm', rarity_key: 'rare', element: 'Hỏa', bonus_atk: 350, bonus_def: 0, bonus_spd: 0, bonus_hp: 0, bonus_crit: 0.0, hax_skill: null, hax_description: 'Gây Thiêu Đốt rút 5% HP địch mỗi hiệp.', drop_rate: 25.0, is_unique: false },
  { item_id: 'weapon_rare_3', item_name: 'Hàn Băng Thần Châm', item_type: 'weapon', rarity: 'Linh Phẩm', rarity_key: 'rare', element: 'Thủy', bonus_atk: 280, bonus_def: 0, bonus_spd: 120, bonus_hp: 0, bonus_crit: 0.0, hax_skill: null, hax_description: 'Đầu trận giảm 10% SPD đối thủ trong 2 hiệp.', drop_rate: 25.0, is_unique: false },
  { item_id: 'weapon_rare_4', item_name: 'Bạch Hạc Vũ Phiến', item_type: 'weapon', rarity: 'Linh Phẩm', rarity_key: 'rare', element: 'Quang', bonus_atk: 300, bonus_def: 150, bonus_spd: 0, bonus_hp: 0, bonus_crit: 0.0, hax_skill: null, hax_description: 'Tăng 10% tỉ lệ né tránh sát thương.', drop_rate: 25.0, is_unique: false },
  { item_id: 'weapon_rare_5', item_name: 'Thanh Phong Ngọc Tiêu', item_type: 'weapon', rarity: 'Linh Phẩm', rarity_key: 'rare', element: 'Mộc', bonus_atk: 310, bonus_def: 80, bonus_spd: 110, bonus_hp: 0, bonus_crit: 0.0, hax_skill: null, hax_description: 'Mỗi đòn đánh hồi phục 5% HP tối đa bản thân.', drop_rate: 25.0, is_unique: false },
  { item_id: 'weapon_rare_6', item_name: 'Huyền Thiết Trảm Mã Đao', item_type: 'weapon', rarity: 'Linh Phẩm', rarity_key: 'rare', element: 'Thổ', bonus_atk: 360, bonus_def: 100, bonus_spd: 0, bonus_hp: 0, bonus_crit: 6.0, hax_skill: null, hax_description: 'Xuyên 18% DEF của đối thủ.', drop_rate: 25.0, is_unique: false },

  { item_id: 'weapon_epic_1', item_name: 'Thần Mộc Thiên Cương Trượng', item_type: 'weapon', rarity: 'Tiên Phẩm', rarity_key: 'epic', element: 'Mộc', bonus_atk: 600, bonus_def: 200, bonus_spd: 0, bonus_hp: 0, bonus_crit: 0.0, hax_skill: null, hax_description: 'Hồi máu bằng 15% sát thương gây ra.', drop_rate: 14.0, is_unique: false },
  { item_id: 'weapon_epic_2', item_name: 'Vạn Kiếp Huyết Ma Đao', item_type: 'weapon', rarity: 'Tiên Phẩm', rarity_key: 'epic', element: 'Ám', bonus_atk: 680, bonus_def: 0, bonus_spd: 0, bonus_hp: 0, bonus_crit: 15.0, hax_skill: null, hax_description: 'Sát thương bạo kích tăng lên x2.2.', drop_rate: 14.0, is_unique: false },
  { item_id: 'weapon_epic_3', item_name: 'Cực Băng Huyền Minh Cung', item_type: 'weapon', rarity: 'Tiên Phẩm', rarity_key: 'epic', element: 'Thủy', bonus_atk: 620, bonus_def: 0, bonus_spd: 250, bonus_hp: 0, bonus_crit: 0.0, hax_skill: null, hax_description: '25% tỉ lệ Đóng Băng đối thủ 1 lượt.', drop_rate: 14.0, is_unique: false },
  { item_id: 'weapon_epic_4', item_name: 'Thái Hư Trảm Tiên Kiếm', item_type: 'weapon', rarity: 'Tiên Phẩm', rarity_key: 'epic', element: 'Kim', bonus_atk: 650, bonus_def: 0, bonus_spd: 0, bonus_hp: 0, bonus_crit: 0.0, hax_skill: null, hax_description: 'Xuyên 30% DEF của mục tiêu.', drop_rate: 14.0, is_unique: false },
  { item_id: 'weapon_epic_5', item_name: 'Thiên Lôi Phá Ma Kích', item_type: 'weapon', rarity: 'Tiên Phẩm', rarity_key: 'epic', element: 'Lôi', bonus_atk: 640, bonus_def: 0, bonus_spd: 200, bonus_hp: 0, bonus_crit: 12.0, hax_skill: null, hax_description: '25% tỉ lệ gây Choáng 1 hiệp & xuyên 25% khiên chắn.', drop_rate: 14.0, is_unique: false },
  { item_id: 'weapon_epic_6', item_name: 'Nguyệt Ảnh Lưu Ly Cầm', item_type: 'weapon', rarity: 'Tiên Phẩm', rarity_key: 'epic', element: 'Quang', bonus_atk: 590, bonus_def: 180, bonus_spd: 220, bonus_hp: 0, bonus_crit: 0.0, hax_skill: null, hax_description: 'Giảm 18% sát thương địch trong 2 hiệp kế tiếp sau mỗi đòn.', drop_rate: 14.0, is_unique: false },

  { item_id: 'weapon_mythic_1', item_name: '« Tru Tiên Diệt Thần Kiếm »', item_type: 'weapon', rarity: 'Thần Thoại', rarity_key: 'mythic', element: 'Hỗn Độn', bonus_atk: 720, bonus_def: 0, bonus_spd: 300, bonus_hp: 0, bonus_crit: 18.0, hax_skill: 'Tuyệt Diệt Bất Tử', hax_description: 'Xuyên 100% khiên chắn và vô hiệu hóa cơ chế Bất Tử / Trùng Sinh của đối thủ trong 3 lượt đầu.', drop_rate: 1.0, is_unique: true },
  { item_id: 'weapon_mythic_2', item_name: '« Cửu Thiên Lôi Đình Cổ Thần Thương »', item_type: 'weapon', rarity: 'Thần Thoại', rarity_key: 'mythic', element: 'Lôi', bonus_atk: 740, bonus_def: 280, bonus_spd: 320, bonus_hp: 0, bonus_crit: 0.0, hax_skill: 'Lôi Thần Trấn Áp', hax_description: 'Khai trận cướp 40% SPD của đối thủ chuyển hóa trực tiếp thành ATK suốt trận.', drop_rate: 1.0, is_unique: true },
  { item_id: 'weapon_mythic_3', item_name: '« Hồng Mông Hỗn Độn Trượng »', item_type: 'weapon', rarity: 'Thần Thoại', rarity_key: 'mythic', element: 'Hỗn Độn', bonus_atk: 750, bonus_def: 350, bonus_spd: 300, bonus_hp: 0, bonus_crit: 0.0, hax_skill: 'Hỗn Độn Nghịch Đảo', hax_description: '35% xác suất biến toàn bộ sát thương nhận vào thành máu hồi phục và phản đòn 100% (thẳng máu, bỏ qua khiên).', drop_rate: 1.0, is_unique: true },
  { item_id: 'weapon_mythic_4', item_name: '« Thái Cổ Phần Thiên Kiếm »', item_type: 'weapon', rarity: 'Thần Thoại', rarity_key: 'mythic', element: 'Hỏa', bonus_atk: 740, bonus_def: 0, bonus_spd: 280, bonus_hp: 0, bonus_crit: 16.0, hax_skill: 'Phần Thiên Trảm', hax_description: 'Xuyên 55% DEF & thiêu đốt 8% HP tối đa địch mỗi hiệp.', drop_rate: 1.0, is_unique: false },
  { item_id: 'weapon_mythic_5', item_name: '« U Minh Phệ Hồn Liêm »', item_type: 'weapon', rarity: 'Thần Thoại', rarity_key: 'mythic', element: 'Ám', bonus_atk: 730, bonus_def: 160, bonus_spd: 310, bonus_hp: 0, bonus_crit: 14.0, hax_skill: 'Đoạt Hồn Tịch Diệt', hax_description: 'Hút 25% sát thương thành HP; địch dưới 20% HP có 40% tỉ lệ kết liễu tức thì.', drop_rate: 1.0, is_unique: false },

  // 21 Bảo Ngọc (Gems)
  { item_id: 'gem_common_1', item_name: 'Thanh Linh Ngọc', item_type: 'gem', rarity: 'Phàm Phẩm', rarity_key: 'common', element: 'Mộc', bonus_atk: 0, bonus_def: 120, bonus_spd: 0, bonus_hp: 500, bonus_crit: 0.0, hax_skill: null, hax_description: 'Hồi phục 3% HP tối đa ở cuối mỗi hiệp.', drop_rate: 60.0, is_unique: false },
  { item_id: 'gem_common_2', item_name: 'Hỏa Tinh Thạch', item_type: 'gem', rarity: 'Phàm Phẩm', rarity_key: 'common', element: 'Hỏa', bonus_atk: 80, bonus_def: 80, bonus_spd: 0, bonus_hp: 0, bonus_crit: 0.0, hax_skill: null, hax_description: 'Kháng hiệu ứng thiêu đốt / độc 20%.', drop_rate: 60.0, is_unique: false },
  { item_id: 'gem_common_3', item_name: 'Hoàng Thổ Bích', item_type: 'gem', rarity: 'Phàm Phẩm', rarity_key: 'common', element: 'Thổ', bonus_atk: 0, bonus_def: 150, bonus_spd: 0, bonus_hp: 300, bonus_crit: 0.0, hax_skill: null, hax_description: 'Giảm cố định 6% sát thương nhận vào.', drop_rate: 60.0, is_unique: false },
  { item_id: 'gem_common_4', item_name: 'Lam Thủy Châu', item_type: 'gem', rarity: 'Phàm Phẩm', rarity_key: 'common', element: 'Thủy', bonus_atk: 0, bonus_def: 100, bonus_spd: 0, bonus_hp: 600, bonus_crit: 0.0, hax_skill: null, hax_description: 'Hồi phục nhẹ 2% HP mỗi hiệp.', drop_rate: 60.0, is_unique: false },
  { item_id: 'gem_common_5', item_name: 'Bạch Ngọc Hộ Phù', item_type: 'gem', rarity: 'Phàm Phẩm', rarity_key: 'common', element: 'Quang', bonus_atk: 0, bonus_def: 130, bonus_spd: 0, bonus_hp: 550, bonus_crit: 0.0, hax_skill: null, hax_description: 'Đầu trận nhận lớp khiên 350 HP.', drop_rate: 60.0, is_unique: false },

  { item_id: 'gem_rare_1', item_name: 'Huyền Quy Hộ Tâm Kính', item_type: 'gem', rarity: 'Linh Phẩm', rarity_key: 'rare', element: 'Thủy', bonus_atk: 0, bonus_def: 320, bonus_spd: 0, bonus_hp: 1500, bonus_crit: 0.0, hax_skill: null, hax_description: 'Giảm 10% sát thương nhận từ đòn bạo kích.', drop_rate: 25.0, is_unique: false },
  { item_id: 'gem_rare_2', item_name: 'Phù Dung Lưu Ly Bảo Ngọc', item_type: 'gem', rarity: 'Linh Phẩm', rarity_key: 'rare', element: 'Mộc', bonus_atk: 0, bonus_def: 280, bonus_spd: 0, bonus_hp: 1800, bonus_crit: 0.0, hax_skill: null, hax_description: 'Hồi phục 5% HP tối đa mỗi hiệp.', drop_rate: 25.0, is_unique: false },
  { item_id: 'gem_rare_3', item_name: 'Tử Kim Thần Thuẫn Thạch', item_type: 'gem', rarity: 'Linh Phẩm', rarity_key: 'rare', element: 'Kim', bonus_atk: 0, bonus_def: 350, bonus_spd: 0, bonus_hp: 1200, bonus_crit: 0.0, hax_skill: null, hax_description: 'Đầu trận nhận lớp khiên 800 HP.', drop_rate: 25.0, is_unique: false },
  { item_id: 'gem_rare_4', item_name: 'Bích Hải Triều Sinh Châu', item_type: 'gem', rarity: 'Linh Phẩm', rarity_key: 'rare', element: 'Thủy', bonus_atk: 0, bonus_def: 300, bonus_spd: 0, bonus_hp: 2000, bonus_crit: 0.0, hax_skill: null, hax_description: 'Kháng 30% hiệu ứng làm chậm & khống chế.', drop_rate: 25.0, is_unique: false },
  { item_id: 'gem_rare_5', item_name: 'Lôi Linh Tinh Thạch', item_type: 'gem', rarity: 'Linh Phẩm', rarity_key: 'rare', element: 'Lôi', bonus_atk: 0, bonus_def: 290, bonus_spd: 90, bonus_hp: 1600, bonus_crit: 0.0, hax_skill: null, hax_description: 'Khi bị đánh có 15% phản giật làm chậm địch 15% SPD.', drop_rate: 25.0, is_unique: false },

  { item_id: 'gem_epic_1', item_name: 'Cửu Tiêu Bất Diệt Ngọc', item_type: 'gem', rarity: 'Tiên Phẩm', rarity_key: 'epic', element: 'Kim', bonus_atk: 0, bonus_def: 650, bonus_spd: 0, bonus_hp: 4000, bonus_crit: 0.0, hax_skill: null, hax_description: 'Giảm cố định 25% toàn bộ sát thương gánh chịu.', drop_rate: 14.0, is_unique: false },
  { item_id: 'gem_epic_2', item_name: 'Vạn Niên Hàn Băng Châu', item_type: 'gem', rarity: 'Tiên Phẩm', rarity_key: 'epic', element: 'Thủy', bonus_atk: 0, bonus_def: 620, bonus_spd: 0, bonus_hp: 3800, bonus_crit: 0.0, hax_skill: null, hax_description: 'Phản lại 30% sát thương băng khi bị tấn công (thẳng máu, bỏ qua khiên).', drop_rate: 14.0, is_unique: false },
  { item_id: 'gem_epic_3', item_name: 'Thái Cực Bát Quái Ngọc Bội', item_type: 'gem', rarity: 'Tiên Phẩm', rarity_key: 'epic', element: 'Quang', bonus_atk: 0, bonus_def: 680, bonus_spd: 0, bonus_hp: 4200, bonus_crit: 0.0, hax_skill: null, hax_description: 'Kháng 50% mọi trạng thái khống chế.', drop_rate: 14.0, is_unique: false },
  { item_id: 'gem_epic_4', item_name: 'Phượng Hoàng Huyết Tinh', item_type: 'gem', rarity: 'Tiên Phẩm', rarity_key: 'epic', element: 'Hỏa', bonus_atk: 0, bonus_def: 600, bonus_spd: 0, bonus_hp: 4500, bonus_crit: 0.0, hax_skill: null, hax_description: 'Máu dưới 30% tự động hồi 35% HP (1 lần/trận).', drop_rate: 14.0, is_unique: false },
  { item_id: 'gem_epic_5', item_name: 'Huyền Mộc Trường Sinh Châu', item_type: 'gem', rarity: 'Tiên Phẩm', rarity_key: 'epic', element: 'Mộc', bonus_atk: 0, bonus_def: 610, bonus_spd: 0, bonus_hp: 4400, bonus_crit: 0.0, hax_skill: null, hax_description: 'Hồi 9% HP tối đa/hiệp & kháng 35% độc/thiêu đốt.', drop_rate: 14.0, is_unique: false },
  { item_id: 'gem_epic_6', item_name: 'U Minh Hắc Diệu Thạch', item_type: 'gem', rarity: 'Tiên Phẩm', rarity_key: 'epic', element: 'Ám', bonus_atk: 150, bonus_def: 630, bonus_spd: 0, bonus_hp: 3900, bonus_crit: 0.0, hax_skill: null, hax_description: 'Khi HP hoặc khiên giảm dưới 50%, tăng +20% ATK hết trận.', drop_rate: 14.0, is_unique: false },

  { item_id: 'gem_mythic_1', item_name: '« Bất Hủ Thần Hoàng Ngọc »', item_type: 'gem', rarity: 'Thần Thoại', rarity_key: 'mythic', element: 'Thổ', bonus_atk: 200, bonus_def: 720, bonus_spd: 0, bonus_hp: 4800, bonus_crit: 0.0, hax_skill: 'Kim Thân Hộ Mệnh', hax_description: 'Chặn đứng đòn chí tử tại 1 HP và miễn nhiễm 100% sát thương trong 2 lượt kế tiếp.', drop_rate: 1.0, is_unique: true },
  { item_id: 'gem_mythic_2', item_name: '« Vạn Tượng Quy Nhất Châu »', item_type: 'gem', rarity: 'Thần Thoại', rarity_key: 'mythic', element: 'Quang', bonus_atk: 0, bonus_def: 730, bonus_spd: 250, bonus_hp: 4600, bonus_crit: 0.0, hax_skill: 'Kính Hoa Thủy Nguyệt', hax_description: 'Phản hồi 75% sát thương nhận vào dội ngược lại đối thủ (thẳng máu, bỏ qua DEF & khiên).', drop_rate: 1.0, is_unique: true },
  { item_id: 'gem_mythic_3', item_name: '« Thiên Hồ Hóa Thần Ngọc »', item_type: 'gem', rarity: 'Thần Thoại', rarity_key: 'mythic', element: 'Hỗn Độn', bonus_atk: 0, bonus_def: 750, bonus_spd: 200, bonus_hp: 5000, bonus_crit: 0.0, hax_skill: 'Thần Hồ Diễm Hộ', hax_description: 'Đầu trận tạo khiên bằng 100% HP tối đa; khi khiên còn tồn tại, giảm 50% sát thương địch.', drop_rate: 1.0, is_unique: true },
  { item_id: 'gem_mythic_4', item_name: '« Thương Hải Băng Tâm Ngọc »', item_type: 'gem', rarity: 'Thần Thoại', rarity_key: 'mythic', element: 'Thủy', bonus_atk: 0, bonus_def: 740, bonus_spd: 180, bonus_hp: 4800, bonus_crit: 0.0, hax_skill: 'Hàn Băng Tuyệt Vực', hax_description: 'Giảm 30% sát thương nhận vào & 25% tỉ lệ đóng băng kẻ tấn công.', drop_rate: 1.0, is_unique: false },
  { item_id: 'gem_mythic_5', item_name: '« Hỗn Nguyên Càn Khôn Ấn »', item_type: 'gem', rarity: 'Thần Thoại', rarity_key: 'mythic', element: 'Thổ', bonus_atk: 180, bonus_def: 760, bonus_spd: 0, bonus_hp: 5000, bonus_crit: 0.0, hax_skill: 'Càn Khôn Hộ Thể', hax_description: 'Đầu trận nhận khiên 75% HP tối đa & chặn kết liễu tức thì 1 lần/trận.', drop_rate: 1.0, is_unique: false },

  // 21 Chiến Hồn (Souls)
  { item_id: 'soul_common_1', item_name: 'Dã Lang Chiến Hồn', item_type: 'soul', rarity: 'Phàm Phẩm', rarity_key: 'common', element: 'Ám', bonus_atk: 50, bonus_def: 0, bonus_spd: 60, bonus_hp: 0, bonus_crit: 0.0, hax_skill: null, hax_description: 'Tăng +6% sát thương khi SPD bằng hoặc cao hơn đối thủ.', drop_rate: 60.0, is_unique: false },
  { item_id: 'soul_common_2', item_name: 'Thanh Phong Linh Hồn', item_type: 'soul', rarity: 'Phàm Phẩm', rarity_key: 'common', element: 'Mộc', bonus_atk: 0, bonus_def: 30, bonus_spd: 80, bonus_hp: 0, bonus_crit: 0.0, hax_skill: null, hax_description: 'Thân pháp linh hoạt, tăng +5% tỉ lệ né tránh.', drop_rate: 60.0, is_unique: false },
  { item_id: 'soul_common_3', item_name: 'Linh Hồ Ấu Hồn', item_type: 'soul', rarity: 'Phàm Phẩm', rarity_key: 'common', element: 'Quang', bonus_atk: 40, bonus_def: 0, bonus_spd: 70, bonus_hp: 0, bonus_crit: 0.0, hax_skill: null, hax_description: 'Tăng +4% tỉ lệ bạo kích.', drop_rate: 60.0, is_unique: false },
  { item_id: 'soul_common_4', item_name: 'Man Ngưu Thú Hồn', item_type: 'soul', rarity: 'Phàm Phẩm', rarity_key: 'common', element: 'Thổ', bonus_atk: 0, bonus_def: 100, bonus_spd: 40, bonus_hp: 0, bonus_crit: 0.0, hax_skill: null, hax_description: 'Giảm 5% sát thương nhận vào.', drop_rate: 60.0, is_unique: false },
  { item_id: 'soul_common_5', item_name: 'Xích Hồ Ấu Hồn', item_type: 'soul', rarity: 'Phàm Phẩm', rarity_key: 'common', element: 'Hỏa', bonus_atk: 55, bonus_def: 0, bonus_spd: 65, bonus_hp: 0, bonus_crit: 0.0, hax_skill: null, hax_description: 'Tăng +5% tỉ lệ bạo kích.', drop_rate: 60.0, is_unique: false },

  { item_id: 'soul_rare_1', item_name: 'Tấn Lôi Ưng Hồn', item_type: 'soul', rarity: 'Linh Phẩm', rarity_key: 'rare', element: 'Lôi', bonus_atk: 100, bonus_def: 0, bonus_spd: 180, bonus_hp: 0, bonus_crit: 0.0, hax_skill: null, hax_description: 'Tăng +15% SPD hiệu dụng & +15% sát thương đòn đầu trận.', drop_rate: 25.0, is_unique: false },
  { item_id: 'soul_rare_2', item_name: 'Minh Giới U Hồn', item_type: 'soul', rarity: 'Linh Phẩm', rarity_key: 'rare', element: 'Ám', bonus_atk: 0, bonus_def: 120, bonus_spd: 150, bonus_hp: 0, bonus_crit: 0.0, hax_skill: null, hax_description: 'Đòn đánh hút 10% máu theo sát thương gây ra.', drop_rate: 25.0, is_unique: false },
  { item_id: 'soul_rare_3', item_name: 'Cuồng Bạo Hùng Hồn', item_type: 'soul', rarity: 'Linh Phẩm', rarity_key: 'rare', element: 'Thổ', bonus_atk: 200, bonus_def: 0, bonus_spd: 130, bonus_hp: 0, bonus_crit: 0.0, hax_skill: null, hax_description: 'HP dưới 50% tăng +20% sát thương.', drop_rate: 25.0, is_unique: false },
  { item_id: 'soul_rare_4', item_name: 'Thải Điệp Mộng Hồn', item_type: 'soul', rarity: 'Linh Phẩm', rarity_key: 'rare', element: 'Mộc', bonus_atk: 0, bonus_def: 80, bonus_spd: 190, bonus_hp: 0, bonus_crit: 0.0, hax_skill: null, hax_description: '15% xác suất ru ngủ đối thủ 1 hiệp.', drop_rate: 25.0, is_unique: false },
  { item_id: 'soul_rare_5', item_name: 'Hàn Giao Thủy Hồn', item_type: 'soul', rarity: 'Linh Phẩm', rarity_key: 'rare', element: 'Thủy', bonus_atk: 0, bonus_def: 110, bonus_spd: 170, bonus_hp: 0, bonus_crit: 0.0, hax_skill: null, hax_description: 'Đầu trận giảm 12% ATK địch trong 2 hiệp.', drop_rate: 25.0, is_unique: false },

  { item_id: 'soul_epic_1', item_name: 'Thương Khung Thần Long Hồn', item_type: 'soul', rarity: 'Tiên Phẩm', rarity_key: 'epic', element: 'Quang', bonus_atk: 300, bonus_def: 200, bonus_spd: 380, bonus_hp: 0, bonus_crit: 0.0, hax_skill: null, hax_description: 'Mỗi hiệp tăng 5% ATK (cộng dồn tối đa 5 lần).', drop_rate: 14.0, is_unique: false },
  { item_id: 'soul_epic_2', item_name: 'Cửu U Minh Xà Hồn', item_type: 'soul', rarity: 'Tiên Phẩm', rarity_key: 'epic', element: 'Ám', bonus_atk: 250, bonus_def: 0, bonus_spd: 400, bonus_hp: 0, bonus_crit: 0.0, hax_skill: null, hax_description: 'Đầu trận tẩm kịch độc rút 8% HP tối đa địch mỗi lượt.', drop_rate: 14.0, is_unique: false },
  { item_id: 'soul_epic_3', item_name: 'Thánh Quang Kỳ Lân Hồn', item_type: 'soul', rarity: 'Tiên Phẩm', rarity_key: 'epic', element: 'Quang', bonus_atk: 0, bonus_def: 400, bonus_spd: 360, bonus_hp: 0, bonus_crit: 0.0, hax_skill: null, hax_description: 'Tự động hóa giải 1 hiệu ứng xấu mỗi hiệp.', drop_rate: 14.0, is_unique: false },
  { item_id: 'soul_epic_4', item_name: 'Huyết Ngục Ma Lang Hồn', item_type: 'soul', rarity: 'Tiên Phẩm', rarity_key: 'epic', element: 'Hỏa', bonus_atk: 320, bonus_def: 0, bonus_spd: 420, bonus_hp: 0, bonus_crit: 0.0, hax_skill: null, hax_description: 'Hút máu bằng 25% sát thương gây ra.', drop_rate: 14.0, is_unique: false },
  { item_id: 'soul_epic_5', item_name: 'Kim Sí Thiên Điêu Hồn', item_type: 'soul', rarity: 'Tiên Phẩm', rarity_key: 'epic', element: 'Kim', bonus_atk: 290, bonus_def: 0, bonus_spd: 430, bonus_hp: 0, bonus_crit: 0.0, hax_skill: null, hax_description: '25% né đòn đánh & tăng +15% sát thương đòn kế tiếp sau khi né.', drop_rate: 14.0, is_unique: false },
  { item_id: 'soul_epic_6', item_name: 'Bất Tử Chu Tước Hồn', item_type: 'soul', rarity: 'Tiên Phẩm', rarity_key: 'epic', element: 'Hỏa', bonus_atk: 280, bonus_def: 220, bonus_spd: 370, bonus_hp: 0, bonus_crit: 0.0, hax_skill: null, hax_description: 'Chặn đòn chí tử 1 lần/trận giữ lại 20% HP tối đa.', drop_rate: 14.0, is_unique: false },

  { item_id: 'soul_mythic_1', item_name: '« Cửu Vĩ Thiên Tiên Hồn »', item_type: 'soul', rarity: 'Thần Thoại', rarity_key: 'mythic', element: 'Hỗn Độn', bonus_atk: 350, bonus_def: 300, bonus_spd: 450, bonus_hp: 0, bonus_crit: 0.0, hax_skill: 'Mị Hoặc Chúng Sinh', hax_description: '40% xác suất mỗi hiệp Mị Hoặc đối thủ tự đánh mình; nếu địch kháng được sẽ tự chuyển thành đốt 10% HP chuẩn (thẳng máu, bỏ qua khiên) & giảm 20% ATK địch (2 hiệp).', drop_rate: 1.0, is_unique: true },
  { item_id: 'soul_mythic_2', item_name: '« Thái Sơ Thời Không Ma Thần Hồn »', item_type: 'soul', rarity: 'Thần Thoại', rarity_key: 'mythic', element: 'Không Gian', bonus_atk: 380, bonus_def: 280, bonus_spd: 460, bonus_hp: 0, bonus_crit: 0.0, hax_skill: 'Thời Không Đình Chỉ', hax_description: 'Ngưng đọng thời gian 1 lần/trận, tung liên hoàn 2 lượt không gián đoạn.', drop_rate: 1.0, is_unique: true },
  { item_id: 'soul_mythic_3', item_name: '« Luân Hồi Bất Diệt Chiến Hồn »', item_type: 'soul', rarity: 'Thần Thoại', rarity_key: 'mythic', element: 'Luân Hồi', bonus_atk: 360, bonus_def: 320, bonus_spd: 470, bonus_hp: 0, bonus_crit: 0.0, hax_skill: 'Sinh Mệnh Nghịch Chuyển', hax_description: 'Khi HP tụt dưới 20% (còn sống), hoán đổi ngay % máu hiện tại với đối thủ (1 lần/trận).', drop_rate: 1.0, is_unique: true },
  { item_id: 'soul_mythic_4', item_name: '« Thái Bạch Kiếm Tiên Hồn »', item_type: 'soul', rarity: 'Thần Thoại', rarity_key: 'mythic', element: 'Kim', bonus_atk: 390, bonus_def: 220, bonus_spd: 450, bonus_hp: 0, bonus_crit: 0.0, hax_skill: 'Vạn Kiếm Quy Tông', hax_description: 'Mỗi 2 hiệp tung thêm kiếm khí 70% ATK xuyên 50% DEF.', drop_rate: 1.0, is_unique: false },
  { item_id: 'soul_mythic_5', item_name: '« Tinh Tú Huyền Nữ Hồn »', item_type: 'soul', rarity: 'Thần Thoại', rarity_key: 'mythic', element: 'Quang', bonus_atk: 310, bonus_def: 360, bonus_spd: 460, bonus_hp: 0, bonus_crit: 0.0, hax_skill: 'Tinh Quang Chúc Phúc', hax_description: 'Miễn nhiễm Choáng/Đóng Băng/Mị Hoặc & hồi 10% HP tối đa/hiệp.', drop_rate: 1.0, is_unique: false },
  ...V13_NEW_EQUIPMENT,
  ...V17_NEW_EQUIPMENT,
].map((item) => ({
  ...item,
  is_unique: Boolean(item.is_unique || MYTHIC_UNIQUE_ITEM_IDS.has(item.item_id)),
  display_rarity_key: (item.is_unique || MYTHIC_UNIQUE_ITEM_IDS.has(item.item_id)) ? 'unique_supreme' : item.rarity_key,
  drop_rate: RARITY_TIERS[item.rarity_key]?.dropRate ?? item.drop_rate,
  icon: itemEmoji(item.item_id),
  emoji_key: itemEmojiKey(item.item_id),
  element_icon: elementEmoji(item.element),
  file: item.file || `items/${item.item_id}.png`,
}));

export const EQUIPMENT_BY_ID = Object.fromEntries(EQUIPMENT_CATALOG.map((item) => [item.item_id, item]));

/**
 * Toàn bộ 41 Linh Thú chia đúng 4 bậc phẩm cấp (10 Phàm / 10 Linh / 10 Tiên / 10 Thần Thoại) + Cửu Vĩ Hồng Hồ độc quyền Fuyumi
 */
export const PET_CATALOG = [
  // 10 Phàm Phẩm (5 cũ cân bằng + 5 mới)
  { pet_type: 'hoa_thach_nham_nham', pet_name: 'Hóa Thạch Nham Nham Thú', element: 'Thổ', rarity: 'Phàm Phẩm', rarity_key: 'common', base_atk: 120, base_def: 180, base_spd: 100, hax_skill: 'Hóa Đá', hax_description: '20% tỉ lệ hóa đá kẻ tấn công 1 hiệp khi bị đánh.', image_file: 'pets/hoa_thach_nham_nham.png', is_starter: true, is_exclusive_fuyumi: false },
  { pet_type: 'thuy_tinh_huyen_ngao', pet_name: 'Thủy Tinh Huyền Ngao', element: 'Thủy', rarity: 'Phàm Phẩm', rarity_key: 'common', base_atk: 150, base_def: 240, base_spd: 140, hax_skill: 'Nghịch Lưu Phản Xạ', hax_description: 'Phản lại 25% sát thương nhận vào (thẳng máu, bỏ qua khiên).', image_file: 'pets/thuy_tinh_huyen_ngao.png', is_starter: false, is_exclusive_fuyumi: false },
  { pet_type: 'thao_moc_linh_vien', pet_name: 'Thảo Mộc Linh Viên', element: 'Mộc', rarity: 'Phàm Phẩm', rarity_key: 'common', base_atk: 170, base_def: 220, base_spd: 160, hax_skill: 'Đất Mẹ Che Chở', hax_description: 'Đầu trận tạo khiên chắn bằng 25% HP tối đa.', image_file: 'pets/thao_moc_linh_vien.png', is_starter: false, is_exclusive_fuyumi: false },
  { pet_type: 'thanh_truc_tien_loc', pet_name: 'Thanh Trúc Tiên Lộc', element: 'Mộc', rarity: 'Phàm Phẩm', rarity_key: 'common', base_atk: 180, base_def: 200, base_spd: 190, hax_skill: 'Linh Mộc Hồi Xuân', hax_description: 'Hồi phục 8% HP tối đa mỗi hiệp.', image_file: 'pets/thanh_truc_tien_loc.png', is_starter: false, is_exclusive_fuyumi: false },
  { pet_type: 'thiet_giap_xich_giac', pet_name: 'Thiết Giáp Xích Giác Thú', element: 'Kim', rarity: 'Phàm Phẩm', rarity_key: 'common', base_atk: 190, base_def: 260, base_spd: 150, hax_skill: 'Phản Chấn Thần Lực', hax_description: 'Phản hồi 30% sát thương nhận vào (thẳng máu, bỏ qua khiên).', image_file: 'pets/thiet_giap_xich_giac.png', is_starter: false, is_exclusive_fuyumi: false },
  { pet_type: 'kim_giap_tue_lan', pet_name: 'Kim Giáp Tuế Lân', element: 'Kim', rarity: 'Phàm Phẩm', rarity_key: 'common', base_atk: 190, base_def: 230, base_spd: 150, hax_skill: 'Giáp Sắt Kiên Cố', hax_description: 'Giảm 15% sát thương nhận vào trong 2 hiệp đầu.', image_file: 'pets/kim_giap_tue_lan.png', is_starter: false, is_exclusive_fuyumi: false },
  { pet_type: 'hoa_linh_tieu_ho', pet_name: 'Hỏa Linh Tiểu Hồ', element: 'Hỏa', rarity: 'Phàm Phẩm', rarity_key: 'common', base_atk: 220, base_def: 150, base_spd: 210, hax_skill: 'Đốm Lửa Nhỏ', hax_description: 'Đòn đánh thiêu đốt thêm 4% HP tối đa địch trong 2 hiệp.', image_file: 'pets/hoa_linh_tieu_ho.png', is_starter: false, is_exclusive_fuyumi: false },
  { pet_type: 'phong_vu_tieu_tuoc', pet_name: 'Phong Vũ Tiểu Tước', element: 'Lôi', rarity: 'Phàm Phẩm', rarity_key: 'common', base_atk: 180, base_def: 140, base_spd: 250, hax_skill: 'Cánh Gió Nhanh Nhẹn', hax_description: 'Tăng 12% tỉ lệ né tránh đòn đánh địch.', image_file: 'pets/phong_vu_tieu_tuoc.png', is_starter: false, is_exclusive_fuyumi: false },
  { pet_type: 'nguyet_anh_thao_tho', pet_name: 'Nguyệt Ảnh Thảo Thỏ', element: 'Quang', rarity: 'Phàm Phẩm', rarity_key: 'common', base_atk: 170, base_def: 190, base_spd: 220, hax_skill: 'Ánh Trăng Dịu Êm', hax_description: 'Đầu trận tạo khiên 10% HP tối đa & tăng +8% Crit.', image_file: 'pets/nguyet_anh_thao_tho.png', is_starter: false, is_exclusive_fuyumi: false },
  { pet_type: 'u_linh_tieu_mieu', pet_name: 'U Linh Tiểu Miêu', element: 'Ám', rarity: 'Phàm Phẩm', rarity_key: 'common', base_atk: 210, base_def: 160, base_spd: 210, hax_skill: 'Vuốt Bóng Đêm', hax_description: 'Hút máu bằng 12% sát thương gây ra.', image_file: 'pets/u_linh_tieu_mieu.png', is_starter: false, is_exclusive_fuyumi: false },

  // 10 Linh Phẩm (5 cũ cân bằng + 5 mới)
  { pet_type: 'bang_tuyet_ho', pet_name: 'Băng Tuyết Hồ', element: 'Thủy', rarity: 'Linh Phẩm', rarity_key: 'rare', base_atk: 310, base_def: 330, base_spd: 340, hax_skill: 'Băng Phong', hax_description: '25% tỉ lệ đóng băng đối thủ 1 hiệp.', image_file: 'pets/bang_tuyet_ho.png', is_starter: false, is_exclusive_fuyumi: false },
  { pet_type: 'viem_nguc_khuyen', pet_name: 'Viêm Ngục Khuyển', element: 'Hỏa', rarity: 'Linh Phẩm', rarity_key: 'rare', base_atk: 340, base_def: 300, base_spd: 320, hax_skill: 'Cuồng Nộ', hax_description: 'HP dưới 35% kích hoạt Cuồng Nộ x1.75 sát thương.', image_file: 'pets/viem_nguc_khuyen.png', is_starter: false, is_exclusive_fuyumi: false },
  { pet_type: 'xich_xa_hoa_long', pet_name: 'Xích Xà Hỏa Long', element: 'Hỏa', rarity: 'Linh Phẩm', rarity_key: 'rare', base_atk: 350, base_def: 280, base_spd: 330, hax_skill: 'Hỏa Độc Huyết', hax_description: 'Gây độc rút 7% HP tối đa đối thủ mỗi hiệp (bỏ qua khiên).', image_file: 'pets/xich_xa_hoa_long.png', is_starter: false, is_exclusive_fuyumi: false },
  { pet_type: 'bach_kim_ho_tu', pet_name: 'Bạch Kim Hổ Tử', element: 'Kim', rarity: 'Linh Phẩm', rarity_key: 'rare', base_atk: 370, base_def: 290, base_spd: 330, hax_skill: 'Phá Giáp Trảm', hax_description: 'Đòn đánh Xuyên 35% DEF của mục tiêu.', image_file: 'pets/bach_kim_ho_tu.png', is_starter: false, is_exclusive_fuyumi: false },
  { pet_type: 'hai_duong_tien_ngu', pet_name: 'Hải Dương Tiên Ngư', element: 'Thủy', rarity: 'Linh Phẩm', rarity_key: 'rare', base_atk: 290, base_def: 360, base_spd: 340, hax_skill: 'Thanh Tẩy Linh Triều', hax_description: 'Xóa sạch khiên chắn và 1 buff có lợi của đối thủ ở hiệp 1 và mỗi 3 hiệp.', image_file: 'pets/hai_duong_tien_ngu.png', is_starter: false, is_exclusive_fuyumi: false },
  { pet_type: 'thanh_long_au_xa', pet_name: 'Thanh Long Ấu Xà', element: 'Mộc', rarity: 'Linh Phẩm', rarity_key: 'rare', base_atk: 310, base_def: 320, base_spd: 330, hax_skill: 'Sinh Mệnh Trường Thanh', hax_description: 'Hồi 10% HP tối đa mỗi hiệp & tăng +5% DEF/hiệp (tối đa 4 tầng).', image_file: 'pets/thanh_long_au_xa.png', is_starter: false, is_exclusive_fuyumi: false },
  { pet_type: 'hoang_tho_thach_su', pet_name: 'Hoàng Thổ Thạch Sư', element: 'Thổ', rarity: 'Linh Phẩm', rarity_key: 'rare', base_atk: 290, base_def: 390, base_spd: 260, hax_skill: 'Sơn Nhạc Bất Động', hax_description: 'Đầu trận tạo khiên 40% HP; khi còn khiên giảm 20% sát thương nhận vào.', image_file: 'pets/hoang_tho_thach_su.png', is_starter: false, is_exclusive_fuyumi: false },
  { pet_type: 'tu_dien_linh_ung', pet_name: 'Tử Điện Linh Ưng', element: 'Lôi', rarity: 'Linh Phẩm', rarity_key: 'rare', base_atk: 340, base_def: 270, base_spd: 380, hax_skill: 'Lôi Ảnh Đột Kích', hax_description: '25% tỉ lệ gây Choáng (Tê Liệt) đối thủ 1 hiệp.', image_file: 'pets/tu_dien_linh_ung.png', is_starter: false, is_exclusive_fuyumi: false },
  { pet_type: 'bach_ngoc_thien_nga', pet_name: 'Bạch Ngọc Thiên Nga', element: 'Quang', rarity: 'Linh Phẩm', rarity_key: 'rare', base_atk: 300, base_def: 330, base_spd: 340, hax_skill: 'Lông Vũ Thanh Khiết', hax_description: 'Tự động hóa giải 1 hiệu ứng bất lợi mỗi hiệp & hồi 6% HP.', image_file: 'pets/bach_ngoc_thien_nga.png', is_starter: false, is_exclusive_fuyumi: false },
  { pet_type: 'huyet_nguyet_linh_dieu', pet_name: 'Huyết Nguyệt Linh Diều', element: 'Ám', rarity: 'Linh Phẩm', rarity_key: 'rare', base_atk: 360, base_def: 280, base_spd: 340, hax_skill: 'Huyết Ấn Ám Sát', hax_description: 'Khi địch dưới 50% HP, sát thương gây ra tăng thêm +30%.', image_file: 'pets/huyet_nguyet_linh_dieu.png', is_starter: false, is_exclusive_fuyumi: false },

  // 10 Tiên Phẩm (4 cũ cân bằng + 6 mới)
  { pet_type: 'linh_mieu_hoa_tien', pet_name: 'Linh Miêu Hoa Tiên', element: 'Mộc', rarity: 'Tiên Phẩm', rarity_key: 'epic', base_atk: 390, base_def: 370, base_spd: 480, hax_skill: 'Gai Mộc Trói Chân', hax_description: 'Phong ấn toàn bộ kỹ năng HAX đối thủ trong 2 lượt đầu.', image_file: 'pets/linh_mieu_hoa_tien.png', is_starter: false, is_exclusive_fuyumi: false },
  { pet_type: 'hoa_diem_ho', pet_name: 'Hỏa Diễm Hồ', element: 'Hỏa', rarity: 'Tiên Phẩm', rarity_key: 'epic', base_atk: 460, base_def: 350, base_spd: 440, hax_skill: 'Thiêu Hồn', hax_description: 'Đòn đánh Xuyên 50% DEF của đối thủ.', image_file: 'pets/hoa_diem_ho.png', is_starter: false, is_exclusive_fuyumi: false },
  { pet_type: 'man_da_la_linh_thu', pet_name: 'Mạn Đà La Linh Thú', element: 'Mộc', rarity: 'Tiên Phẩm', rarity_key: 'epic', base_atk: 430, base_def: 410, base_spd: 420, hax_skill: 'Ký Sinh Hút Máu', hax_description: 'Gây thêm sát thương bằng 15% HP hiện tại của địch và hút về bản thân.', image_file: 'pets/man_da_la_linh_thu.png', is_starter: false, is_exclusive_fuyumi: false },
  { pet_type: 'kim_si_dieu_hoang', pet_name: 'Kim Sí Điêu Hoàng', element: 'Kim', rarity: 'Tiên Phẩm', rarity_key: 'epic', base_atk: 450, base_def: 380, base_spd: 470, hax_skill: 'Mù Lòa Thái Dương', hax_description: 'Khiến đối thủ đánh trượt 55% trong 2 hiệp đầu.', image_file: 'pets/kim_si_dieu_hoang.png', is_starter: false, is_exclusive_fuyumi: false },
  { pet_type: 'huyen_vu_linh_quy', pet_name: 'Huyền Vũ Linh Quy', element: 'Thủy', rarity: 'Tiên Phẩm', rarity_key: 'epic', base_atk: 360, base_def: 490, base_spd: 370, hax_skill: 'Huyền Vũ Thần Giáp', hax_description: 'Giảm 25% mọi sát thương gánh chịu & phản lại 35% sát thương (thẳng máu, bỏ qua khiên).', image_file: 'pets/huyen_vu_linh_quy.png', is_starter: false, is_exclusive_fuyumi: false },
  { pet_type: 'thai_am_ngoc_tho', pet_name: 'Thái Âm Ngọc Thỏ', element: 'Quang', rarity: 'Tiên Phẩm', rarity_key: 'epic', base_atk: 410, base_def: 400, base_spd: 460, hax_skill: 'Nguyệt Hoa Huyễn Cảnh', hax_description: '30% né hoàn toàn đòn đánh & phản công ngay 80% ATK.', image_file: 'pets/thai_am_ngoc_tho.png', is_starter: false, is_exclusive_fuyumi: false },
  { pet_type: 'dia_long_nham_vuong', pet_name: 'Địa Long Nham Vương', element: 'Thổ', rarity: 'Tiên Phẩm', rarity_key: 'epic', base_atk: 440, base_def: 450, base_spd: 350, hax_skill: 'Địa Chấn Nghiền Nát', hax_description: 'Đòn đánh phá 50% khiên chắn địch & giảm 20% DEF địch 2 hiệp.', image_file: 'pets/dia_long_nham_vuong.png', is_starter: false, is_exclusive_fuyumi: false },
  { pet_type: 'cuu_thien_loi_phuong', pet_name: 'Cửu Thiên Lôi Phượng', element: 'Lôi', rarity: 'Tiên Phẩm', rarity_key: 'epic', base_atk: 460, base_def: 350, base_spd: 470, hax_skill: 'Lôi Kiếp Liên Hoàn', hax_description: '30% xác suất tung thêm 1 đòn sét phụ 60% ATK xuyên 30% DEF.', image_file: 'pets/cuu_thien_loi_phuong.png', is_starter: false, is_exclusive_fuyumi: false },
  { pet_type: 'minh_gioi_u_ho', pet_name: 'Minh Giới U Hồ', element: 'Ám', rarity: 'Tiên Phẩm', rarity_key: 'epic', base_atk: 450, base_def: 360, base_spd: 450, hax_skill: 'U Minh Hấp Hồn', hax_description: 'Hút 22% sát thương thành HP & giảm 40% hiệu quả hồi máu địch 3 hiệp.', image_file: 'pets/minh_gioi_u_ho.png', is_starter: false, is_exclusive_fuyumi: false },
  { pet_type: 'tu_kim_bach_trach', pet_name: 'Tử Kim Bạch Trạch', element: 'Kim', rarity: 'Tiên Phẩm', rarity_key: 'epic', base_atk: 430, base_def: 410, base_spd: 440, hax_skill: 'Thiên Cơ Nhìn Thấu', hax_description: 'Tăng +20% tỉ lệ Crit & đòn Crit xuyên 45% DEF đối thủ.', image_file: 'pets/tu_kim_bach_trach.png', is_starter: false, is_exclusive_fuyumi: false },

  // 10 Thần Thoại (6 cũ cân bằng + 4 mới)
  { pet_type: 'chu_tuoc_au_dieu', pet_name: 'Chu Tước Ấu Điểu', element: 'Hỏa', rarity: 'Thần Thoại', rarity_key: 'mythic', base_atk: 530, base_def: 450, base_spd: 530, hax_skill: 'Niết Bàn Tái Sinh', hax_description: 'Hồi sinh với 55% HP tối đa 1 lần mỗi trận.', image_file: 'pets/chu_tuoc_au_dieu.png', is_starter: false, is_exclusive_fuyumi: false },
  { pet_type: 'han_bang_ky_lan', pet_name: 'Hàn Băng Kỳ Lân', element: 'Thủy', rarity: 'Thần Thoại', rarity_key: 'mythic', base_atk: 510, base_def: 550, base_spd: 480, hax_skill: 'Hàn Khí Giáp', hax_description: 'Giảm 45% sát thương bạo kích và 15% sát thương thường nhận vào.', image_file: 'pets/han_bang_ky_lan.png', is_starter: false, is_exclusive_fuyumi: false },
  { pet_type: 'loi_dinh_kim_ho', pet_name: 'Lôi Đình Kim Hồ', element: 'Lôi', rarity: 'Thần Thoại', rarity_key: 'mythic', base_atk: 560, base_def: 420, base_spd: 600, hax_skill: 'Lôi Quang Tốc', hax_description: 'Luôn giành quyền xuất chiêu đầu tiên & tăng +15% tỉ lệ Crit.', image_file: 'pets/loi_dinh_kim_ho.png', is_starter: false, is_exclusive_fuyumi: false },
  { pet_type: 'u_minh_lang_vuong', pet_name: 'U Minh Lang Vương', element: 'Ám', rarity: 'Thần Thoại', rarity_key: 'mythic', base_atk: 560, base_def: 440, base_spd: 540, hax_skill: 'Tuyệt Mệnh Trảm', hax_description: 'HP đối thủ dưới 25% có 45% tỉ lệ kết liễu tức thì.', image_file: 'pets/u_minh_lang_vuong.png', is_starter: false, is_exclusive_fuyumi: false },
  { pet_type: 'tinh_khong_da_thao', pet_name: 'Tinh Không Dạ Thao', element: 'Hư Không', rarity: 'Thần Thoại', rarity_key: 'mythic', base_atk: 520, base_def: 480, base_spd: 540, hax_skill: 'Hư Không Hỗn Loạn', hax_description: '35% xác suất khiến đối thủ hỗn loạn tự tấn công bản thân.', image_file: 'pets/tinh_khong_da_thao.png', is_starter: false, is_exclusive_fuyumi: false },
  { pet_type: 'quang_minh_thanh_thu', pet_name: 'Quang Minh Thánh Thú', element: 'Quang', rarity: 'Thần Thoại', rarity_key: 'mythic', base_atk: 500, base_def: 540, base_spd: 510, hax_skill: 'Thánh Quang Hóa Giải', hax_description: 'Miễn nhiễm 100% Choáng/Mù/Mị Hoặc/Cướp Tốc/Khóa HAX/Độc/Đốt.', image_file: 'pets/quang_minh_thanh_thu.png', is_starter: false, is_exclusive_fuyumi: false },
  { pet_type: 'thanh_de_moc_long', pet_name: 'Thanh Đế Mộc Long', element: 'Mộc', rarity: 'Thần Thoại', rarity_key: 'mythic', base_atk: 500, base_def: 520, base_spd: 510, hax_skill: 'Thái Cổ Sinh Linh', hax_description: 'Hồi 14% HP/hiệp + tích +8% ATK/hiệp (tối đa 5 tầng); miễn nhiễm độc/đốt.', image_file: 'pets/thanh_de_moc_long.png', is_starter: false, is_exclusive_fuyumi: false },
  { pet_type: 'hoang_thien_ky_lan', pet_name: 'Hoàng Thiên Kỳ Lân', element: 'Thổ', rarity: 'Thần Thoại', rarity_key: 'mythic', base_atk: 510, base_def: 560, base_spd: 470, hax_skill: 'Bất Động Sơn Hà', hax_description: 'Đầu trận khiên 65% HP; khi khiên vỡ phát nổ gây 20% HP tối đa ST chuẩn (thẳng máu, bỏ qua khiên).', image_file: 'pets/hoang_thien_ky_lan.png', is_starter: false, is_exclusive_fuyumi: false },
  { pet_type: 'thai_duong_kim_o', pet_name: 'Thái Dương Kim Ô', element: 'Hỏa', rarity: 'Thần Thoại', rarity_key: 'mythic', base_atk: 570, base_def: 430, base_spd: 540, hax_skill: 'Chân Hỏa Phần Thiên', hax_description: 'Xuyên 65% DEF + thiêu đốt 10% HP tối đa địch mỗi hiệp (thẳng máu, bỏ qua khiên).', image_file: 'pets/thai_duong_kim_o.png', is_starter: false, is_exclusive_fuyumi: false },
  { pet_type: 'nguyet_than_cuu_vy_bach', pet_name: 'Nguyệt Thần Bạch Vĩ Hồ', element: 'Hư Không', rarity: 'Thần Thoại', rarity_key: 'mythic', base_atk: 530, base_def: 470, base_spd: 560, hax_skill: 'Thời Không Hoán Ảnh', hax_description: '1 lần/trận khi HP < 35%, giải hiệu ứng xấu, hồi 30% HP & thêm 1 lượt.', image_file: 'pets/nguyet_than_cuu_vy_bach.png', is_starter: false, is_exclusive_fuyumi: false },
  ...V13_NEW_PETS,
  ...V17_NEW_PETS,

  // Bộ Tối Thượng Thần Thoại Độc Nhất
  { pet_type: 'cuu_vi_hong_ho', pet_name: 'Cửu Vĩ Hồng Hồ', element: 'Hỗn Độn', rarity: 'Tối Thượng Thần Thoại', rarity_key: 'supreme', base_atk: 99999, base_def: 99999, base_spd: 99999, hax_skill: 'Cửu Vĩ Hộ Thể (HAX Bất Tử)', hax_description: 'Bất tử trước 3 đòn đầu và phản lại 100% sát thương gốc (thẳng máu, bỏ qua khiên).', image_file: 'pets/cuu_vi_hong_ho_transparent.png', is_starter: false, is_exclusive_fuyumi: true },
].map((p) => ({
  ...p,
  is_unique: Boolean(p.is_unique || MYTHIC_UNIQUE_PET_TYPES.has(p.pet_type)),
  display_rarity_key: p.is_exclusive_fuyumi ? 'supreme' : (p.is_unique || MYTHIC_UNIQUE_PET_TYPES.has(p.pet_type)) ? 'unique_supreme' : p.rarity_key,
  drop_rate: p.is_exclusive_fuyumi ? 0 : p.rarity_key === 'mythic' ? 0.6 : p.rarity_key === 'epic' ? 14.0 : p.rarity_key === 'rare' ? 25.0 : 60.4,
  icon: petEmoji(p.pet_type, em('cuu_vi_hong_ho')),
  emoji_key: petEmojiKey(p.pet_type),
  element_icon: elementEmoji(p.element),
  base_hp: p.base_hp || Math.max(500, 1000 + p.base_def * 5),
  base_power: p.base_power || (p.base_atk * 3 + p.base_def * 2 + p.base_spd * 2 + 50),
}));

export const PET_BY_TYPE = Object.fromEntries(PET_CATALOG.map((p) => [p.pet_type, p]));

export const STARTER_PET = PET_BY_TYPE.hoa_thach_nham_nham;

export function createStarterPetObject() {
  return {
    name: STARTER_PET.pet_name,
    type: STARTER_PET.pet_type,
    pet_type: STARTER_PET.pet_type,
    rarity: STARTER_PET.rarity,
    element: STARTER_PET.element,
    hax_skill: STARTER_PET.hax_skill,
    hax_desc: STARTER_PET.hax_description,
    level: 1,
    star: 1,
    atk: STARTER_PET.base_atk,
    def: STARTER_PET.base_def,
    spd: STARTER_PET.base_spd,
    power: STARTER_PET.base_power,
    enchant_grade: 'D',
    enchant_pity: 0,
    base_atk: STARTER_PET.base_atk,
    base_def: STARTER_PET.base_def,
    base_spd: STARTER_PET.base_spd,
    bonus_atk: 0,
    bonus_def: 0,
    bonus_spd: 0,
    bonus_hp: 0,
    icon: STARTER_PET.icon,
    equipment: {
      weapon: null,
      gem: null,
      soul: null,
    },
  };
}

/**
 * 4 Cấp Nhẫn Cưới Tiên Lữ (/marry & /shop)
 */
export const MARRY_RINGS = [
  { item_id: 'ring_common', name: 'Thanh Ngọc Đồng Tâm Giới', rarity: 'Phàm Phẩm', rarity_key: 'common', price: 500, exp_bonus_pct: 5, power_bonus_pct: 5, icon: ringEmoji('ring_common'), description: 'Nhẫn ngọc bích cơ bản: +5% EXP & +5% Chiến Lực đôi.' },
  { item_id: 'ring_rare', name: 'Lưu Ly Bích Hải Giới', rarity: 'Linh Phẩm', rarity_key: 'rare', price: 2000, exp_bonus_pct: 10, power_bonus_pct: 10, icon: ringEmoji('ring_rare'), description: 'Nhẫn lưu ly xanh biển: +10% EXP & +10% Chiến Lực đôi.' },
  { item_id: 'ring_epic', name: 'Tử Tiêu Phượng Hoàng Giới', rarity: 'Tiên Phẩm', rarity_key: 'epic', price: 6000, exp_bonus_pct: 15, power_bonus_pct: 15, icon: ringEmoji('ring_epic'), description: 'Nhẫn vàng hồng phượng hoàng: +15% EXP & +15% Chiến Lực đôi.' },
  { item_id: 'ring_mythic', name: 'Cửu Vĩ Vĩnh Kết Thần Giới', rarity: 'Thần Thoại', rarity_key: 'mythic', price: 18000, exp_bonus_pct: 20, power_bonus_pct: 20, icon: ringEmoji('ring_mythic'), description: 'Thần giới Cửu Vĩ tối thượng: +20% EXP & +20% Chiến Lực đôi.' },
];

export const MARRY_RING_BY_ID = Object.fromEntries(MARRY_RINGS.map((r) => [r.item_id, r]));

export const MARRY_RING_RANK = {
  ring_common: 1,
  ring_rare: 2,
  ring_epic: 3,
  ring_mythic: 4,
};

/**
 * Giá bán thẳng trong /shop cho Linh Thú & Pháp Bảo bậc Phàm Phẩm / Linh Phẩm
 * (Loại trừ Cửu Vĩ Hồng Hồ, Tiên Phẩm & Thần Thoại độc quyền Gacha /roll)
 */
export const SHOP_PET_PRICES = { common: 300, rare: 900 };
export const SHOP_EQUIPMENT_PRICES = { common: 250, rare: 750 };

export const SHOP_PETS = PET_CATALOG
  .filter((p) => !p.is_exclusive_fuyumi && (p.rarity_key === 'common' || p.rarity_key === 'rare'))
  .map((p) => ({
    ...p,
    price: SHOP_PET_PRICES[p.rarity_key] || 300,
  }));

export const SHOP_EQUIPMENT = EQUIPMENT_CATALOG
  .filter((it) => it.rarity_key === 'common' || it.rarity_key === 'rare')
  .map((it) => ({
    ...it,
    price: SHOP_EQUIPMENT_PRICES[it.rarity_key] || 250,
  }));

/**
 * Vật phẩm tiêu hao / nâng cấp bán thẳng trong /shop
 */
export const SHOP_CONSUMABLES = [
  { item_id: 'gacha_ticket_equip', name: 'Vé Rèn Pháp Bảo', category: 'consumable', price: 50, icon: em('gacha_ticket_equip'), description: 'Dùng thay 50 Linh Thạch khi quay Gacha Pháp Bảo (/roll).' },
  { item_id: 'gacha_ticket_pet', name: 'Vé Triệu Hồi Linh Thú', category: 'consumable', price: 50, icon: em('gacha_ticket_pet'), description: 'Dùng thay 50 Linh Thạch khi quay Gacha Linh Thú (/roll).' },
  { item_id: 'gacha_ticket_domain', name: 'Vé Khai Mở Linh Vực', category: 'consumable', price: 60, icon: em('gacha_ticket_domain', em('su_gacha_dice')), description: 'Dùng thay 60 Linh Thạch khi quay Gacha Linh Vực • Thần Thức • Thần Cảnh (/roll loai:domain).' },
  { item_id: 'pet_star_stone', name: 'Tinh Thạch Nâng Sao', category: 'consumable', price: 100, icon: em('pet_star_stone'), description: 'Nguyên liệu đột phá cấp Sao (1 -> 10 Sao) cho Linh Thú (/linhthu).' },
  { item_id: 'tower_reset_card', name: 'Thẻ Reset Lượt Đi Tháp', category: 'consumable', price: 200, daily_limit: 5, max_stack: 15, icon: em('tower_reset_card'), description: 'Hồi ngay 5/5 lượt khiêu chiến Tháp Thí Luyện trong ngày (/nhiemvu hanh_dong:reset). Giới hạn mua 5/ngày, tối đa 15 thẻ trong túi.' },
  { item_id: 'enchant_stone', name: 'Đá Khắc Ấn', category: 'consumable', price: 150, daily_limit: 5, max_stack: 99, icon: em('enchant_stone'), description: 'Đá Khắc Ấn dùng để cường hóa Phẩm Chất D→C→B→A→S cho Linh Thú & Pháp Bảo (/enchant). Giới hạn mua 5/ngày trong Shop; săn thêm tại Boss Tháp mỗi 5 tầng.' },
  { item_id: 'title_rename_card', name: 'Thẻ Đổi Danh Hiệu Tu Tiên', category: 'consumable', price: 300, icon: em('title_rename_card'), description: 'Đổi danh hiệu hiển thị tùy chỉnh trên /profile.' },
  { item_id: 'food_survival_pill', name: 'Hộ Mệnh Linh Đan', category: 'consumable', price: 180, daily_limit: 10, max_stack: 99, icon: em('food_survival_pill'), description: 'Thức ăn khám phá Loại A (/explorer): Tăng +8% tỉ lệ sống sót cho Linh Thú trong suốt chuyến thám hiểm.' },
  { item_id: 'food_yield_tea', name: 'Tụ Bảo Tiên Trà', category: 'consumable', price: 220, daily_limit: 10, max_stack: 99, icon: em('food_yield_tea'), description: 'Thức ăn khám phá Loại B (/explorer): Tăng +18% tổng sản lượng Linh Thạch thu hoạch nếu sống sót trở về.' },
  { item_id: 'food_speed_fruit', name: 'Ngự Phong Tốc Quả', category: 'consumable', price: 250, daily_limit: 10, max_stack: 99, icon: em('food_speed_fruit'), description: 'Thức ăn khám phá Loại C (/explorer): Rút gọn 25% thời gian di chuyển của chuyến khám phá.' },
  { item_id: 'explorer_revive_elixir', name: 'Cửu Chuyển Hoàn Hồn Lộ', category: 'consumable', price: 2500, daily_limit: 3, max_stack: 10, icon: em('explorer_revive_elixir'), description: 'Linh dược hồi sinh chuyên dụng: Hồi phục hoàn toàn Linh Thú Độc Nhất bị trọng thương khi khám phá (/explorer).' },
  { item_id: 'potion_luck_minor', name: 'Tiểu Vận Linh Lộ', category: 'consumable', price: 1200, max_stack: 50, icon: em('su_sparkle'), is_luck_potion: true, luck_bonus_pct: 20, charges: 40, description: 'Tăng +20% Luck cho 40 lượt /roll hoặc Đổ Thạch (VD: 0.5% -> 0.6%, cộng dồn với /gieoque). Dùng /equip ma_id:potion_luck_minor để uống.' },
  { item_id: 'potion_luck_major', name: 'Thiên Cơ Thụy Lộ', category: 'consumable', price: 3200, max_stack: 50, icon: em('su_realm_star'), is_luck_potion: true, luck_bonus_pct: 40, charges: 60, description: 'Tăng +40% Luck cho 60 lượt /roll hoặc Đổ Thạch (VD: 0.5% -> 0.7%, cộng dồn với /gieoque). Dùng /equip ma_id:potion_luck_major để uống.' },
  { item_id: 'potion_luck_supreme', name: 'Hồng Mông Khí Vận Dịch', category: 'consumable', price: 6800, max_stack: 50, icon: em('dao_ap_crest'), is_luck_potion: true, luck_bonus_pct: 60, charges: 80, description: 'Tăng +60% Luck cho 80 lượt /roll hoặc Đổ Thạch (VD: 0.65% -> 1.04%, cộng dồn với /gieoque). Dùng /equip ma_id:potion_luck_supreme để uống.' },
  ...buildV17ShopConsumables(),
];

export const SPECIAL_CONSUMABLES = [
  { item_id: 'enchant_stone_absolute', name: 'Thiên Đạo Tuyệt Ấn Thạch', category: 'consumable', price: 0, price_tt: 40, max_stack: 50, icon: em('enchant_stone_absolute'), description: 'Đá Khắc Ấn Tuyệt Đối (rơi 5% từ /explorer, 25% khi bật Bùa Tuyệt Ấn, hoặc 40 TT Shop Đặc Biệt): Đảm bảo nâng bậc Khắc Ấn thành công 100% ở mọi bậc D→S.' },
  { item_id: 'pill_ess_1', name: 'Linh Quả Thanh Tâm Đan', category: 'consumable', price: 0, max_stack: 999, icon: em('pill_ess_1', em('su_level_up')), is_pet_exp_pill: true, pet_exp: 1200, description: 'Đan dược luyện từ /luyendan (28 Linh Quả + 56 LT): Tăng +1.200 EXP trực tiếp cho Linh Thú trong /upgrade (không nhận buff EXP từ Role/Cảnh Giới).' },
  { item_id: 'pill_ess_2', name: 'Hồng Mông Tạo Hóa Đan', category: 'consumable', price: 0, max_stack: 999, icon: em('pill_ess_2', em('su_level_up')), is_pet_exp_pill: true, pet_exp: 3000, description: 'Đan dược thượng cổ luyện từ /luyendan (56 Linh Quả + 84 LT): Tăng +3.000 EXP trực tiếp cho Linh Thú trong /upgrade (không nhận buff EXP từ Role/Cảnh Giới).' },
  { item_id: 'frame_unlock_token', name: 'Lệnh Bài Khung Viền Độc Bản (Cũ)', category: 'consumable', price: 0, max_stack: 10, icon: em('frame_unlock_token'), description: 'Đã nâng cấp thành Khung Viền Độc Bản Hoàng Kim trong Quầy Viền Avatar (/shop).' },
  ...buildV17SpecialConsumables(),
];

export const SHOP_CONSUMABLE_BY_ID = Object.fromEntries(SHOP_CONSUMABLES.map((c) => [c.item_id, c]));
export const ALL_CONSUMABLES = [...SHOP_CONSUMABLES, ...SPECIAL_CONSUMABLES];
export const ALL_CONSUMABLE_BY_ID = Object.fromEntries(ALL_CONSUMABLES.map((c) => [c.item_id, c]));

/**
 * Danh mục 29 Khung Viền Avatar (/shop Quầy Viền Avatar + Shop Đặc Biệt + /equip)
 */
export const AVATAR_FRAMES = [
  { frame_id: 'default', name: 'Khung Mặc Định (Theo Cảnh Giới)', rarity: 'Mặc Định', rarity_key: 'common', price: 0, token_required: false, description: 'Tự động nâng cấp khung theo cảnh giới tu luyện (hoặc Hồ Hoàng Kim cho Tiểu thư).' },
  ...V15_AVATAR_FRAME_SPECS.map((f) => ({
    ...f,
    token_required: true,
  })),
  ...V17_AVATAR_FRAMES.map((f) => ({
    ...f,
    token_required: true,
  })),
];

export const AVATAR_FRAME_BY_ID = Object.fromEntries(AVATAR_FRAMES.map((f) => [f.frame_id, f]));

/**
 * Cấu hình Hệ Thống Gia Tộc (/giatoc) & Clan Wars 24H
 */
export const CLAN_CREATE_MIN_LEVEL = 20;
export const CLAN_CREATE_COST = 1000;
export const CLAN_WAR_MIN_BET = 500;
export const CLAN_WAR_DURATION_HOURS = 24;

export const CLAN_LEVEL_CONFIG = [
  { level: 1, maxMembers: 10, upgradeCost: 2000, expBonusPct: 2, ltBonusPct: 2 },
  { level: 2, maxMembers: 15, upgradeCost: 4000, expBonusPct: 4, ltBonusPct: 4 },
  { level: 3, maxMembers: 20, upgradeCost: 8000, expBonusPct: 6, ltBonusPct: 6 },
  { level: 4, maxMembers: 25, upgradeCost: 14000, expBonusPct: 8, ltBonusPct: 8 },
  { level: 5, maxMembers: 30, upgradeCost: 22000, expBonusPct: 10, ltBonusPct: 10 },
  { level: 6, maxMembers: 34, upgradeCost: 32000, expBonusPct: 12, ltBonusPct: 12 },
  { level: 7, maxMembers: 38, upgradeCost: 45000, expBonusPct: 14, ltBonusPct: 14 },
  { level: 8, maxMembers: 42, upgradeCost: 60000, expBonusPct: 16, ltBonusPct: 16 },
  { level: 9, maxMembers: 46, upgradeCost: 80000, expBonusPct: 18, ltBonusPct: 18 },
  { level: 10, maxMembers: 50, upgradeCost: null, expBonusPct: 20, ltBonusPct: 20 },
];

export function getClanLevelConfig(level) {
  const lvl = Math.min(10, Math.max(1, Number(level) || 1));
  return CLAN_LEVEL_CONFIG.find((c) => c.level === lvl) || CLAN_LEVEL_CONFIG[0];
}

/**
 * Toàn bộ 21 Role Quyền Năng Đơn Năng (1 chức năng) bán thẳng trong /shop (7d / 30d / Vĩnh Viễn)
 * đồng thời nằm ở nhóm Phàm Phẩm (60.5%) trong Gacha Role (/roll loai:role).
 */
export const SHOP_ROLE_PACKAGES = [
  { role_id: '1573186019858317422', name: '« Linh Âm Hồ Ca »', rarity: 'Phàm Phẩm', rarity_key: 'common', perk: `${em('su_sparkle')} Ưu Tiên Voice, Soundboard & Âm Ngoại`, prices: { '7d': 220, '30d': 700, permanent: 2200 } },
  { role_id: '1573186024048173076', name: '« Phong Thanh Hộ Pháp »', rarity: 'Phàm Phẩm', rarity_key: 'common', perk: `${em('su_arena')} Quyền Di Chuyển Voice`, prices: { '7d': 350, '30d': 1100, permanent: 3500 } },
  { role_id: '1573186028196462613', name: '« Lôi Âm Tôn Giả »', rarity: 'Phàm Phẩm', rarity_key: 'common', perk: `${em('su_thunder_hax')} Quyền Ưu Tiên Nói Voice`, prices: { '7d': 200, '30d': 650, permanent: 2000 } },
  { role_id: '1573186032289980416', name: '« Tịch Tĩnh Tán Nhân »', rarity: 'Phàm Phẩm', rarity_key: 'common', perk: `${em('su_shield_def')} Quyền Tắt Tiếng Voice`, prices: { '7d': 350, '30d': 1100, permanent: 3500 } },
  { role_id: '1573186036585201726', name: '« Bế Tức Chân Nhân »', rarity: 'Phàm Phẩm', rarity_key: 'common', perk: `${em('su_shield_def')} Quyền Tắt Tai Nghe Voice`, prices: { '7d': 350, '30d': 1100, permanent: 3500 } },
  { role_id: '1573186040716468316', name: '« Huyễn Diện Đạo Quân »', rarity: 'Phàm Phẩm', rarity_key: 'common', perk: `${em('title_rename_card')} Tự Do Đổi Biệt Danh`, prices: { '7d': 180, '30d': 600, permanent: 1800 } },
  { role_id: '1573186045468614687', name: '« Định Danh Sứ Giả »', rarity: 'Phàm Phẩm', rarity_key: 'common', perk: `${em('title_rename_card')} Quản Lý Biệt Danh`, prices: { '7d': 320, '30d': 1000, permanent: 3200 } },
  { role_id: '1573186049289756712', name: '« Thần Hành Cốt Cách »', rarity: 'Phàm Phẩm', rarity_key: 'common', perk: `${em('su_thunder_hax')} Miễn Chờ Chat Chậm`, prices: { '7d': 150, '30d': 500, permanent: 1500 } },
  { role_id: '1573186053500833802', name: '« Họa Đồ Linh Sư »', rarity: 'Phàm Phẩm', rarity_key: 'common', perk: `${em('su_sakura')} Đăng Ảnh Kênh Giới Hạn`, prices: { '7d': 150, '30d': 500, permanent: 1500 } },
  { role_id: '1573186057778888745', name: '« Vạn Tượng Linh Hồ »', rarity: 'Phàm Phẩm', rarity_key: 'common', perk: `${em('su_sparkle')} Dùng Emoji Ngoại Server`, prices: { '7d': 200, '30d': 650, permanent: 2000 } },
  { role_id: '1573186061860077568', name: '« Thần Phù Thượng Quan »', rarity: 'Phàm Phẩm', rarity_key: 'common', perk: `${em('su_realm_star')} Dùng Sticker Ngoại`, prices: { '7d': 150, '30d': 500, permanent: 1500 } },
  { role_id: '1573186066134073394', name: '« Khai Sơn Tiên Phong »', rarity: 'Phàm Phẩm', rarity_key: 'common', perk: `${em('su_wiki_scroll')} Tạo Chủ Đề Công Khai`, prices: { '7d': 120, '30d': 400, permanent: 1200 } },
  { role_id: '1573186070206742578', name: '« Mật Tàng Hộ Vệ »', rarity: 'Phàm Phẩm', rarity_key: 'common', perk: `${em('su_wiki_scroll')} Tạo Chủ Đề Kín`, prices: { '7d': 140, '30d': 450, permanent: 1400 } },
  { role_id: '1573186074153324608', name: '« Trấn Thư Pháp Vương »', rarity: 'Phàm Phẩm', rarity_key: 'common', perk: `${em('su_pin_sigil')} Quyền Ghim Tin Nhắn`, prices: { '7d': 220, '30d': 720, permanent: 2200 } },
  { role_id: '1573186078402158776', name: '« Huyễn Âm Tiên Cô »', rarity: 'Phàm Phẩm', rarity_key: 'common', perk: `${em('su_medal_role')} Dùng Bảng Âm Thanh`, prices: { '7d': 150, '30d': 500, permanent: 1500 } },
  { role_id: '1573186082768560198', name: '« Cửu Châu Diễn Âm »', rarity: 'Phàm Phẩm', rarity_key: 'common', perk: `${em('su_medal_role')} Dùng Âm Ngoại Server`, prices: { '7d': 180, '30d': 600, permanent: 1800 } },
  { role_id: '1573186087088554085', name: '« Linh Hồn Tu Luyện »', rarity: 'Phàm Phẩm', rarity_key: 'common', perk: `${em('su_level_up')} Buff +15% EXP`, prices: { '7d': 400, '30d': 1200, permanent: 4000 } },
  { role_id: '1573186091094245416', name: '« Tài Vận Hanh Thông »', rarity: 'Phàm Phẩm', rarity_key: 'common', perk: `${em('su_linhthach')} Buff +20% Daily LT`, prices: { '7d': 450, '30d': 1400, permanent: 4500 } },
  { role_id: '1573186095120908329', name: '« Tiêu Dao Khách »', rarity: 'Phàm Phẩm', rarity_key: 'common', perk: `${em('su_sparkle')} Phát Trực Tiếp HD 1080p`, prices: { '7d': 160, '30d': 520, permanent: 1600 } },
  { role_id: '1573186099663343747', name: '« Trảm Phong Kiếm Khách »', rarity: 'Phàm Phẩm', rarity_key: 'common', perk: `${em('su_crossed_swords')} Gửi Tin Nhắn Giọng Nói TTS`, prices: { '7d': 150, '30d': 500, permanent: 1500 } },
  { role_id: '1573186103664574524', name: '« Thần Thông Thấu Thị »', rarity: 'Phàm Phẩm', rarity_key: 'common', perk: `${em('su_wiki_scroll')} Đọc Lịch Sử Kênh Lưu Trữ`, prices: { '7d': 180, '30d': 600, permanent: 1800 } },
];

export const SHOP_ROLE_BY_ID = Object.fromEntries(SHOP_ROLE_PACKAGES.map((r) => [r.role_id, r]));

/**
 * 14 Role Đa Năng (2–4 chức năng) nhận qua Gacha Role (/roll loai:role)
 */
export const MULTI_PERK_ROLES = [
  // 8 Role Linh Phẩm (25% — 2 chức năng)
  { role_id: '1573577773279219763', name: '« Song Tuyệt Kiếm Khách »', rarity: 'Linh Phẩm', rarity_key: 'rare', perk: `${em('su_thunder_hax')}${em('su_pin_sigil')} Miễn Slowmode & Ghim Tin Nhắn`, prices: { '7d': 500, '30d': 1600, permanent: 5000 } },
  { role_id: '1573577776454434899', name: '« Huyễn Ảnh Linh Tôn »', rarity: 'Linh Phẩm', rarity_key: 'rare', perk: `${em('su_sparkle')}${em('su_sparkle')} Đổi Nick, Emoji/Sticker Ngoại & +10% EXP`, prices: { '7d': 500, '30d': 1600, permanent: 5000 } },
  { role_id: '1573577779621138542', name: '« Lôi Vũ Hộ Pháp »', rarity: 'Linh Phẩm', rarity_key: 'rare', perk: `${uiEm('ui_voice_mic')}${uiEm('ui_announce_horn')} Di Chuyển & Ưu Tiên Nói Voice`, prices: { '7d': 500, '30d': 1600, permanent: 5000 } },
  { role_id: '1573577782380728410', name: '« Hàn Ngọc Tiên Tử »', rarity: 'Linh Phẩm', rarity_key: 'rare', perk: `${em('su_sparkle')}${uiEm('ui_speaker_sound')} Stream HD, Soundboard Ngoại & +10% Daily LT`, prices: { '7d': 500, '30d': 1600, permanent: 5000 } },
  { role_id: '1573577786218651688', name: '« Mật Các Trưởng Lão »', rarity: 'Linh Phẩm', rarity_key: 'rare', perk: `${uiEm('ui_chat_bubble')}${em('su_sparkle')} Thread Kín/Mở, Kênh Ẩn & +12% EXP`, prices: { '7d': 500, '30d': 1600, permanent: 5000 } },
  { role_id: '1573577788965781504', name: '« Kim Tiền Đạo Nhân »', rarity: 'Linh Phẩm', rarity_key: 'rare', perk: `${em('su_linhthach')}${em('su_pin_sigil')} Buff +25% Daily LT & Giảm 5% Giá Shop`, prices: { '7d': 500, '30d': 1600, permanent: 5000 } },
  { role_id: '1573577794091225108', name: '« Chiến Hồn Tiên Phong »', rarity: 'Linh Phẩm', rarity_key: 'rare', perk: `${em('su_crossed_swords')}${em('su_thunder_hax')} Buff +8% Chiến Lực Pet & Miễn Slowmode`, prices: { '7d': 500, '30d': 1600, permanent: 5000 } },
  { role_id: '1573577796742152314', name: '« Thiên Âm Nhạc Sư »', rarity: 'Linh Phẩm', rarity_key: 'rare', perk: `${uiEm('ui_music_note')}${uiEm('ui_announce_horn')} Ưu Tiên Voice, Âm Ngoại & +12% EXP`, prices: { '7d': 500, '30d': 1600, permanent: 5000 } },
  // 6 Role Tiên Phẩm (14% — 3–4 chức năng)
  { role_id: '1573577799539892314', name: '« Cửu Tiêu Phong Vương »', rarity: 'Tiên Phẩm', rarity_key: 'epic', perk: `${uiEm('ui_wind_spd')}${uiEm('ui_mute_voice')} Move/Mute Voice, Miễn Slowmode & +20% EXP`, prices: { '7d': 1000, '30d': 3200, permanent: 10000 } },
  { role_id: '1573577805286080523', name: '« Thái Hư Chân Quân »', rarity: 'Tiên Phẩm', rarity_key: 'epic', perk: `${em('su_pin_sigil')}${em('su_pin_sigil')} Quản Lý Nick, Ghim Tin, Thread Kín & +20% Daily LT`, prices: { '7d': 1000, '30d': 3200, permanent: 10000 } },
  { role_id: '1573577808867762186', name: '« Vạn Bảo Tài Thần »', rarity: 'Tiên Phẩm', rarity_key: 'epic', perk: `${uiEm('ui_coin_gold')}${em('su_sparkle')} +35% Daily LT, Giảm 10% Shop/Roll & Emoji/Sticker`, prices: { '7d': 1000, '30d': 3200, permanent: 10000 } },
  { role_id: '1573577811786993756', name: '« Bát Hoang Chiến Thần »', rarity: 'Tiên Phẩm', rarity_key: 'epic', perk: `${em('su_el_hoa')}${em('su_crossed_swords')} +15% Chiến Lực Pet, +20% EXP, Ghim & Slowmode`, prices: { '7d': 1000, '30d': 3200, permanent: 10000 } },
  { role_id: '1573577814437789797', name: '« Hồng Trần Tiên Lữ »', rarity: 'Tiên Phẩm', rarity_key: 'epic', perk: `${em('su_sakura')} Stream/Sound/Emoji • +25% EXP • +10% Pet`, prices: { '7d': 1000, '30d': 3200, permanent: 10000 } },
  { role_id: '1573577816690401401', name: '« Tinh Hà Pháp Vương »', rarity: 'Tiên Phẩm', rarity_key: 'epic', perk: `${em('su_realm_star')}${em('su_shield_def')} Move/Mute/Deafen Voice, Ghim Tin & +25% EXP`, prices: { '7d': 1000, '30d': 3200, permanent: 10000 } },
];

/**
 * 5 Role Tối Thượng Thần Thoại (0.5% — 5+ chức năng) trong Gacha Role
 */
export const SUPREME_ROLES = [
  { role_id: '1573185998857183253', name: '« Cửu Vĩ Tối Thượng Thần Hồ »', rarity: 'Thần Thoại', rarity_key: 'mythic', perk: `${em('su_shield_def')} Full Voice/Chat • +70% EXP & Daily LT • +25% Pet`, prices: { '7d': 2500, '30d': 8000, permanent: 25000 } },
  { role_id: '1573186003101941830', name: '« SuMi Đệ Nhất Khách Tôn »', rarity: 'Thần Thoại', rarity_key: 'mythic', perk: `${uiEm('ui_crown_king')} Full Voice/Chat • +60% EXP & Daily LT • +20% Pet`, prices: { '7d': 2500, '30d': 8000, permanent: 25000 } },
  { role_id: '1573186007262695644', name: '« Vạn Cổ Chí Tôn »', rarity: 'Thần Thoại', rarity_key: 'mythic', perk: `${em('su_realm_star')} Voice/Thread VIP • +50% EXP & Daily LT • +18% Pet`, prices: { '7d': 2500, '30d': 8000, permanent: 25000 } },
  { role_id: '1573186011478102096', name: '« Sáng Thế Thần Quân »', rarity: 'Thần Thoại', rarity_key: 'mythic', perk: `${em('su_sparkle')} Voice/Thread VIP • x2.5 Daily LT • -15% Shop`, prices: { '7d': 2500, '30d': 8000, permanent: 25000 } },
  { role_id: '1573186015785521265', name: '« Cửu Vĩ Yêu Hậu »', rarity: 'Thần Thoại', rarity_key: 'mythic', perk: `${em('su_sakura')} Voice/Chat VIP • +80% EXP • +15% Pet`, prices: { '7d': 2500, '30d': 8000, permanent: 25000 } },
];

/**
 * Quyền Discord thực tế (decoded từ Server SuMi Family) của toàn bộ 40 Role Quyền Năng & 8 Level Roles
 */
export const ROLE_DISCORD_PERMS_BY_ID = {
  // 21 Role Phàm Phẩm
  '1573186019858317422': 'Ưu Tiên Nói Voice, Dùng Soundboard & Âm Thanh Ngoại Server',
  '1573186024048173076': 'Di Chuyển Thành Viên Voice (Move)',
  '1573186028196462613': 'Ưu Tiên Nói Voice (Priority Speaker)',
  '1573186032289980416': 'Tắt Mic Thành Viên Voice (Mute Members)',
  '1573186036585201726': 'Tắt Tai Nghe Thành Viên Voice (Deafen Members)',
  '1573186040716468316': 'Tự Đổi Biệt Danh (Change Nickname)',
  '1573186045468614687': 'Tự Đổi & Quản Lý Biệt Danh Khác (Manage Nicknames)',
  '1573186049289756712': 'Miễn Chờ Chat Chậm (Bypass Slowmode)',
  '1573186053500833802': 'Nhúng Link & Gửi Ảnh/File (Embed Links, Attach Files)',
  '1573186057778888745': 'Thả Biểu Cảm & Dùng Emoji Ngoại Server',
  '1573186061860077568': 'Dùng Sticker Ngoại Server',
  '1573186066134073394': 'Tạo & Nhắn Trong Thread Công Khai',
  '1573186070206742578': 'Tạo & Nhắn Trong Thread Kín',
  '1573186074153324608': 'Ghim Tin Nhắn (Pin Messages)',
  '1573186078402158776': 'Dùng Bảng Âm Thanh (Soundboard)',
  '1573186082768560198': 'Dùng Soundboard & Âm Thanh Ngoại Server',
  '1573186087088554085': 'Không cấp quyền Discord (thuần Buff Tu Tiên)',
  '1573186091094245416': 'Không cấp quyền Discord (thuần Buff Tu Tiên)',
  '1573186095120908329': 'Phát Trực Tiếp Video HD 1080p (Stream)',
  '1573186099663343747': 'Gửi Tin Nhắn Giọng Nói TTS (Send TTS)',
  '1573186103664574524': 'Xem Kênh & Đọc Lịch Sử Kênh Lưu Trữ',
  // 8 Role Linh Phẩm
  '1573577773279219763': 'Ghim Tin Nhắn (Pin), Miễn Chờ Chat Chậm (Bypass Slowmode)',
  '1573577776454434899': 'Tự Đổi Biệt Danh, Dùng Emoji & Sticker Ngoại Server',
  '1573577779621138542': 'Di Chuyển Thành Viên Voice (Move), Ưu Tiên Nói Voice',
  '1573577782380728410': 'Stream Video HD, Dùng Soundboard & Âm Thanh Ngoại Server',
  '1573577786218651688': 'Tạo Thread Công Khai & Kín, Đọc Lịch Sử Kênh Lưu Trữ',
  '1573577788965781504': 'Thả Biểu Cảm, Dùng Emoji Ngoại Server',
  '1573577794091225108': 'Nhúng Link, Gửi Ảnh/File, Miễn Chờ Chat Chậm (Bypass Slowmode)',
  '1573577796742152314': 'Ưu Tiên Nói Voice, Dùng Soundboard & Âm Thanh Ngoại Server',
  // 6 Role Tiên Phẩm
  '1573577799539892314': 'Di Chuyển & Tắt Mic Voice (Move/Mute), Miễn Chờ Chat Chậm (Bypass Slowmode)',
  '1573577805286080523': 'Đổi & Quản Lý Biệt Danh Khác, Ghim Tin Nhắn, Tạo Thread Kín',
  '1573577808867762186': 'Nhúng Link, Gửi Ảnh/File, Dùng Emoji & Sticker Ngoại Server',
  '1573577811786993756': 'Stream Video HD, Ghim Tin Nhắn, Miễn Chờ Chat Chậm (Bypass Slowmode)',
  '1573577814437789797': 'Stream Video HD, Soundboard & Âm Ngoại Server, Emoji & Sticker Ngoại Server',
  '1573577816690401401': 'Di Chuyển/Tắt Mic/Tắt Tai Nghe Voice (Move/Mute/Deafen), Ghim Tin Nhắn',
  // 5 Role Thần Thoại
  '1573185998857183253': 'Full Voice (Move/Mute/Deafen/Ưu tiên/Stream HD/Soundboard & Âm ngoại), Full Chat/Thread (Ghim, Miễn Slowmode, Quản lý/Tạo Thread công khai & kín, Quản lý biệt danh, TTS, Ảnh/Link, Emoji & Sticker ngoại, Đọc lịch sử)',
  '1573186003101941830': 'Full Voice (Move/Mute/Deafen/Ưu tiên/Stream HD/Soundboard & Âm ngoại), Full Chat/Thread (Ghim, Miễn Slowmode, Quản lý/Tạo Thread công khai & kín, Quản lý biệt danh, TTS, Ảnh/Link, Emoji & Sticker ngoại, Đọc lịch sử)',
  '1573186007262695644': 'Voice (Move/Mute/Deafen/Ưu tiên/Stream HD), Chat/Thread (Ghim, Miễn Slowmode, Quản lý/Tạo Thread công khai & kín, Quản lý biệt danh, Ảnh/Link, Emoji & Sticker ngoại)',
  '1573186011478102096': 'Voice (Move/Ưu tiên/Stream HD), Chat/Thread (Ghim, Miễn Slowmode, Tạo Thread công khai & kín, Quản lý biệt danh, Ảnh/Link, Emoji & Sticker ngoại)',
  '1573186015785521265': 'Voice (Move/Mute/Stream HD/Soundboard & Âm ngoại), Chat/Thread (Ghim, Miễn Slowmode, Tạo Thread công khai & kín, Đổi biệt danh, Ảnh/Link, Emoji & Sticker ngoại)',
};

export const LEVEL_ROLE_DISCORD_PERMS = {
  5: 'Gửi Ảnh/File (Attach Files)',
  10: 'Phát Trực Tiếp (Stream)',
  20: 'Dùng Emoji Nitro Ngoại Server & Lập Gia Tộc',
  35: 'Nhúng Liên Kết (Embed Links)',
  45: 'Dùng Sticker Ngoại Server',
  60: 'Gửi Tin Nhắn Thoại (Voice Message)',
  80: 'Dùng Bảng Âm Thanh (Soundboard)',
  100: 'Dùng Âm Thanh Ngoại Server (External Sounds)',
};

export const GACHA_ROLE_CATALOG = [
  ...SHOP_ROLE_PACKAGES,
  ...MULTI_PERK_ROLES,
  ...SUPREME_ROLES,
].map((r) => ({
  ...r,
  discord_perms: ROLE_DISCORD_PERMS_BY_ID[r.role_id] || 'Quyền hạn Role theo cấu hình server',
  tier_icon: roleTierEmoji(r.rarity_key),
  tier_emoji_key: roleTierEmojiKey(r.rarity_key),
}));

export const ROLE_BY_ID = Object.fromEntries(GACHA_ROLE_CATALOG.map((r) => [r.role_id, r]));

/**
 * Phân tầng thời hạn khi quay /roll loai:role:
 * 40% 7 ngày | 30% 30 ngày | 18% 60 ngày | 10% 90 ngày | 2% Vĩnh Viễn
 */
export const ROLE_GACHA_DURATION_TIERS = [
  { key: 'permanent', label: 'Vĩnh Viễn', days: null, pct: 2, isPermanent: true },
  { key: '90d', label: '90 Ngày', days: 90, pct: 10, isPermanent: false },
  { key: '60d', label: '60 Ngày', days: 60, pct: 18, isPermanent: false },
  { key: '30d', label: '30 Ngày', days: 30, pct: 30, isPermanent: false },
  { key: '7d', label: '7 Ngày', days: 7, pct: 40, isPermanent: false },
];

/**
 * Bảng Buff nội tại cộng dồn cho 8 Level Roles (theo cấp thực tế) + 2 Role Đơn Buff + 14 Role Đa Năng + 5 Role Tối Thượng
 */
export const LEVEL_ROLE_BUFF_CONFIG = [
  { level: 100, expPct: 50, dailyLtPct: 50, petPowerPct: 20, label: '« 100・Hỗn Độn Chúa Tể »' },
  { level: 80, expPct: 30, dailyLtPct: 25, petPowerPct: 12, label: '« 80・Chi Linh Thánh Đế »' },
  { level: 60, expPct: 20, dailyLtPct: 15, petPowerPct: 8, label: '« 60・Thiên Hồ Viễn Cổ »' },
  { level: 45, expPct: 15, dailyLtPct: 10, petPowerPct: 5, label: '« 45・Huyễn Linh Thú »' },
  { level: 35, expPct: 12, dailyLtPct: 10, petPowerPct: 0, label: '« 35・Yêu Hồ Nguyệt Ảnh »' },
  { level: 20, expPct: 8, dailyLtPct: 5, petPowerPct: 0, label: '« 20・ Linh Cáo Tinh Anh »' },
  { level: 10, expPct: 5, dailyLtPct: 0, petPowerPct: 0, label: '« 10・Linh Cáo Học Giả »' },
  { level: 5, expPct: 3, dailyLtPct: 0, petPowerPct: 0, label: '« 5・U Linh Chớm Nở »' },
];

export const ROLE_BUFF_CONFIG = {
  // Single-perk buff roles
  '1573186087088554085': { expPct: 15 }, // « Linh Hồn Tu Luyện »
  '1573186091094245416': { dailyLtPct: 20 }, // « Tài Vận Hanh Thông »
  // Multi-perk Linh Phẩm
  '1573577776454434899': { expPct: 10 }, // « Huyễn Ảnh Linh Tôn »
  '1573577782380728410': { dailyLtPct: 10 }, // « Hàn Ngọc Tiên Tử »
  '1573577786218651688': { expPct: 12 }, // « Mật Các Trưởng Lão »
  '1573577788965781504': { dailyLtPct: 25, shopDiscountPct: 5 }, // « Kim Tiền Đạo Nhân »
  '1573577794091225108': { petPowerPct: 8 }, // « Chiến Hồn Tiên Phong »
  '1573577796742152314': { expPct: 12 }, // « Thiên Âm Nhạc Sư »
  // Multi-perk Tiên Phẩm
  '1573577799539892314': { expPct: 20 }, // « Cửu Tiêu Phong Vương »
  '1573577805286080523': { dailyLtPct: 20 }, // « Thái Hư Chân Quân »
  '1573577808867762186': { dailyLtPct: 35, shopDiscountPct: 10, gachaDiscountPct: 10 }, // « Vạn Bảo Tài Thần »
  '1573577811786993756': { expPct: 20, petPowerPct: 15 }, // « Bát Hoang Chiến Thần »
  '1573577814437789797': { expPct: 25, petPowerPct: 10 }, // « Hồng Trần Tiên Lữ »
  '1573577816690401401': { expPct: 25 }, // « Tinh Hà Pháp Vương »
  // 5 Supreme Roles
  '1573185998857183253': { expPct: 70, dailyLtPct: 70, petPowerPct: 25 }, // « Cửu Vĩ Tối Thượng Thần Hồ »
  '1573186003101941830': { expPct: 60, dailyLtPct: 60, petPowerPct: 20 }, // « SuMi Đệ Nhất Khách Tôn »
  '1573186007262695644': { expPct: 50, dailyLtPct: 50, petPowerPct: 18 }, // « Vạn Cổ Chí Tôn »
  '1573186011478102096': { dailyLtPct: 150, shopDiscountPct: 15 }, // « Sáng Thế Thần Quân » (x2.5 = +150% Daily LT)
  '1573186015785521265': { expPct: 80, petPowerPct: 15 }, // « Cửu Vĩ Yêu Hậu »
};

export function formatRoleBuffText(roleId) {
  const cfg = ROLE_BUFF_CONFIG[String(roleId || '')];
  if (!cfg) return 'Không có Buff chỉ số (thuần quyền Discord)';
  const parts = [];
  if (cfg.expPct) parts.push(`+${cfg.expPct}% EXP`);
  if (cfg.dailyLtPct) {
    parts.push(cfg.dailyLtPct >= 100 ? `x${(1 + cfg.dailyLtPct / 100).toFixed(1).replace(/\.0$/, '')} Daily LT (+${cfg.dailyLtPct}%)` : `+${cfg.dailyLtPct}% Daily LT`);
  }
  if (cfg.petPowerPct) parts.push(`+${cfg.petPowerPct}% Chiến Lực Pet`);
  if (cfg.shopDiscountPct) parts.push(`Giảm ${cfg.shopDiscountPct}% Giá Shop`);
  if (cfg.gachaDiscountPct) parts.push(`Giảm ${cfg.gachaDiscountPct}% Giá Roll`);
  return parts.length ? parts.join(' • ') : 'Không có Buff chỉ số';
}

export function formatRoleBuffDetailedText(roleId) {
  const cfg = ROLE_BUFF_CONFIG[String(roleId || '')];
  if (!cfg) return 'Không có Buff Tu Tiên (thuần Quyền Discord)';
  const parts = [];
  if (cfg.expPct) parts.push(`+${cfg.expPct}% EXP (Chat, Voice & /job)`);
  if (cfg.dailyLtPct) {
    const jobLtPct = Math.round(cfg.dailyLtPct * 0.25);
    const multTag = cfg.dailyLtPct >= 100 ? `x${(1 + cfg.dailyLtPct / 100).toFixed(1).replace(/\.0$/, '')} ` : '';
    parts.push(`${multTag}+${cfg.dailyLtPct}% Daily LT (+${cfg.dailyLtPct}% /daily & +${jobLtPct}% /job)`);
  }
  if (cfg.petPowerPct) parts.push(`+${cfg.petPowerPct}% Chiến Lực Pet (ATK/DEF/SPD)`);
  if (cfg.shopDiscountPct) parts.push(`Giảm ${cfg.shopDiscountPct}% Giá Shop (cộng dồn tối đa 25%)`);
  if (cfg.gachaDiscountPct) parts.push(`Giảm ${cfg.gachaDiscountPct}% Giá /roll (cộng dồn tối đa 20%)`);
  return parts.length ? parts.join(' • ') : 'Không có Buff Tu Tiên (thuần Quyền Discord)';
}

/**
 * Danh mục Background Profile & Namecard (/rank) — 15 Background AI 2:1 + 5 Background Pinterest
 */
export const BACKGROUND_CATALOG = [
  { bg_id: 'default_background.png', name: 'Đạo Cảnh Mặc Định', rarity: 'Mặc Định', rarity_key: 'common', price: 0, file: 'default_background.png', available: true },
  { bg_id: 'bg_01_night_sakura.png', name: 'Đêm Hoa Anh Đào Tĩnh Mịch', rarity: 'Phàm Phẩm', rarity_key: 'common', price: 300, file: 'backgrounds/bg_01_night_sakura.png', available: true },
  { bg_id: 'bg_02_bamboo_mist.png', name: 'Rừng Trúc Sương Đêm', rarity: 'Phàm Phẩm', rarity_key: 'common', price: 300, file: 'backgrounds/bg_02_bamboo_mist.png', available: true },
  { bg_id: 'bg_03_obsidian_lantern.png', name: 'Phố Đèn Lồng Hắc Ngọc', rarity: 'Phàm Phẩm', rarity_key: 'common', price: 300, file: 'backgrounds/bg_03_obsidian_lantern.png', available: true },
  { bg_id: 'bg_04_moonlit_lake.png', name: 'Hồ Nguyệt Ảnh Tĩnh Lặng', rarity: 'Linh Phẩm', rarity_key: 'rare', price: 800, file: 'backgrounds/bg_04_moonlit_lake.png', available: true },
  { bg_id: 'bg_05_frost_glacier.png', name: 'Băng Cung Huyền Tuyết', rarity: 'Linh Phẩm', rarity_key: 'rare', price: 800, file: 'backgrounds/bg_05_frost_glacier.png', available: true },
  { bg_id: 'bg_06_jade_library.png', name: 'Tàng Kinh Các Cổ Tịch', rarity: 'Linh Phẩm', rarity_key: 'rare', price: 800, file: 'backgrounds/bg_06_jade_library.png', available: true },
  { bg_id: 'bg_07_thunder_peak.png', name: 'Lôi Đình Tuyệt Đỉnh', rarity: 'Linh Phẩm', rarity_key: 'rare', price: 800, file: 'backgrounds/bg_07_thunder_peak.png', available: true },
  { bg_id: 'bg_08_amethyst_palace.png', name: 'Tử Tiêu Tiên Điện', rarity: 'Tiên Phẩm', rarity_key: 'epic', price: 1800, file: 'backgrounds/bg_08_amethyst_palace.png', available: true },
  { bg_id: 'bg_09_crimson_phoenix.png', name: 'Phượng Hoàng Tàn Diệm', rarity: 'Tiên Phẩm', rarity_key: 'epic', price: 1800, file: 'backgrounds/bg_09_crimson_phoenix.png', available: true },
  { bg_id: 'bg_10_celestial_lotus.png', name: 'Liên Hoa Tiên Trì', rarity: 'Tiên Phẩm', rarity_key: 'epic', price: 1800, file: 'backgrounds/bg_10_celestial_lotus.png', available: true },
  { bg_id: 'bg_11_starry_nebula.png', name: 'Tinh Hà Vô Cực', rarity: 'Tiên Phẩm', rarity_key: 'epic', price: 1800, file: 'backgrounds/bg_11_starry_nebula.png', available: true },
  { bg_id: 'bg_12_kitsune_shrine.png', name: 'Thần Điện Cửu Vĩ Nguyệt Quang', rarity: 'Thần Thoại', rarity_key: 'mythic', price: 4000, file: 'backgrounds/bg_12_kitsune_shrine.png', available: true },
  { bg_id: 'bg_13_chaos_void.png', name: 'Hỗn Độn Thái Sơ Giới', rarity: 'Thần Thoại', rarity_key: 'mythic', price: 4000, file: 'backgrounds/bg_13_chaos_void.png', available: true },
  { bg_id: 'bg_14_golden_dragon.png', name: 'Cửu Thiên Kim Long Vân Hải', rarity: 'Thần Thoại', rarity_key: 'mythic', price: 4000, file: 'backgrounds/bg_14_golden_dragon.png', available: true },
  { bg_id: 'bg_15_fuyumi_paradise.png', name: 'Vĩnh Kết Thiên Hồ Tiên Cảnh', rarity: 'Thần Thoại', rarity_key: 'mythic', price: 4000, file: 'backgrounds/bg_15_fuyumi_paradise.png', available: true },
  { bg_id: 'bg_pin_1_starry_cloud.jpg', name: 'Mây Đêm Tinh Tú Cổ Điển', rarity: 'Linh Phẩm', rarity_key: 'rare', price: 600, file: 'backgrounds/bg_pin_1_starry_cloud.jpg', available: true },
  { bg_id: 'bg_pin_2_arcane_astrology.jpg', name: 'Pháp Trận Chiêm Tinh Tử Kim', rarity: 'Tiên Phẩm', rarity_key: 'epic', price: 1500, file: 'backgrounds/bg_pin_2_arcane_astrology.jpg', available: true },
  { bg_id: 'bg_pin_3_celestial_moon.jpg', name: 'Ngân Hà Trăng Sáng Pastel', rarity: 'Tiên Phẩm', rarity_key: 'epic', price: 1500, file: 'backgrounds/bg_pin_3_celestial_moon.jpg', available: true },
  { bg_id: 'bg_pin_4_lantern_blossom.jpg', name: 'Hoa Đăng Tiên Cảnh Ấm Áp', rarity: 'Linh Phẩm', rarity_key: 'rare', price: 800, file: 'backgrounds/bg_pin_4_lantern_blossom.jpg', available: true },
  { bg_id: 'bg_pin_5_witch_spirit.jpg', name: 'Linh Hồn Ma Nhỏ Bí Ngô', rarity: 'Linh Phẩm', rarity_key: 'rare', price: 700, file: 'backgrounds/bg_pin_5_witch_spirit.jpg', available: true },
];

export const BACKGROUND_BY_ID = Object.fromEntries(BACKGROUND_CATALOG.map((b) => [b.bg_id, b]));

/**
 * Bảng Buff EXP & Linh Thạch khi trang bị Viền Avatar (/shop -> frames) hoặc Ảnh Nền (/shop -> backgrounds).
 * Mỗi món cộng riêng theo phẩm chất (đeo cả Viền + Ảnh Nền Thần Thoại cộng dồn tối đa +20% EXP & +20% LT).
 * Mặc định (0 LT) không cộng buff.
 */
export const COSMETIC_BUFF_BY_RARITY = {
  common: { expPct: 2, ltPct: 2 },
  rare: { expPct: 4, ltPct: 4 },
  epic: { expPct: 7, ltPct: 7 },
  mythic: { expPct: 10, ltPct: 10 },
};

export function getCosmeticBuffByRarity(rarityKey, isPaid = true) {
  if (!isPaid) return { expPct: 0, ltPct: 0 };
  const rk = String(rarityKey || '').trim().toLowerCase();
  return COSMETIC_BUFF_BY_RARITY[rk] || { expPct: 0, ltPct: 0 };
}

export function computeCosmeticBuffTotals(avatarFrame = 'default', backgroundUrl = 'default_background.png') {
  const fId = String(avatarFrame || 'default').trim();
  let frameExpPct = 0;
  let frameLtPct = 0;
  let frameName = 'Khung Mặc Định';
  let frameRarity = 'Mặc Định';

  if (fId === 'celestial_fox_gold') {
    frameExpPct = COSMETIC_BUFF_BY_RARITY.mythic.expPct;
    frameLtPct = COSMETIC_BUFF_BY_RARITY.mythic.ltPct;
    frameName = 'Hồ Hoàng Kim';
    frameRarity = 'Thần Thoại';
  } else if (fId && fId !== 'default') {
    const fMeta = AVATAR_FRAME_BY_ID[fId];
    if (fMeta && Number(fMeta.price || 0) > 0) {
      const b = getCosmeticBuffByRarity(fMeta.rarity_key, true);
      frameExpPct = b.expPct;
      frameLtPct = b.ltPct;
      frameName = fMeta.name;
      frameRarity = fMeta.rarity;
    }
  }

  const rawBg = String(backgroundUrl || 'default_background.png').trim();
  let bgExpPct = 0;
  let bgLtPct = 0;
  let bgName = 'Đạo Cảnh Mặc Định';
  let bgRarity = 'Mặc Định';

  if (rawBg.includes('celestial_palace_pink')) {
    bgExpPct = COSMETIC_BUFF_BY_RARITY.mythic.expPct;
    bgLtPct = COSMETIC_BUFF_BY_RARITY.mythic.ltPct;
    bgName = 'Thiên Cung Cửu Vĩ';
    bgRarity = 'Thần Thoại';
  } else if (rawBg && rawBg !== 'default_background.png') {
    const strippedBg = rawBg.replace(/^assets\//i, '').replace(/^backgrounds\//i, '');
    const bgMeta = BACKGROUND_BY_ID[rawBg]
      || BACKGROUND_BY_ID[strippedBg]
      || BACKGROUND_CATALOG.find((b) => b.file === rawBg || `assets/${b.file}` === rawBg);
    if (bgMeta && Number(bgMeta.price || 0) > 0) {
      const b = getCosmeticBuffByRarity(bgMeta.rarity_key, true);
      bgExpPct = b.expPct;
      bgLtPct = b.ltPct;
      bgName = bgMeta.name;
      bgRarity = bgMeta.rarity;
    }
  }

  return {
    frameId: fId || 'default',
    frameName,
    frameRarity,
    frameExpPct,
    frameLtPct,
    bgId: rawBg || 'default_background.png',
    bgName,
    bgRarity,
    bgExpPct,
    bgLtPct,
    expPct: frameExpPct + bgExpPct,
    ltPct: frameLtPct + bgLtPct,
  };
}

/**
 * Hệ thống Phẩm Chất Khắc Ấn (Enchant D -> C -> B -> A -> S) cho Linh Thú & Pháp Bảo (v1.2)
 * Mặc định lúc quay Gacha/mua Shop chỉ rơi từ D -> A (0% S); hạng S chỉ đạt qua cường hóa (/enchant).
 */
export const ENCHANT_GRADE_ORDER = ['D', 'C', 'B', 'A', 'S'];

export const ENCHANT_GRADES = {
  D: { grade: 'D', label: 'Hạng D', bonusPct: 0, multiplier: 1.00, dropWeight: 40, color: '#94a3b8', emoji: gradeEmoji('D'), emoji_key: gradeEmojiKey('D') },
  C: { grade: 'C', label: 'Hạng C', bonusPct: 8, multiplier: 1.08, dropWeight: 32, color: '#22c55e', emoji: gradeEmoji('C'), emoji_key: gradeEmojiKey('C') },
  B: { grade: 'B', label: 'Hạng B', bonusPct: 18, multiplier: 1.18, dropWeight: 20, color: '#3b82f6', emoji: gradeEmoji('B'), emoji_key: gradeEmojiKey('B') },
  A: { grade: 'A', label: 'Hạng A', bonusPct: 32, multiplier: 1.32, dropWeight: 8, color: '#a855f7', emoji: gradeEmoji('A'), emoji_key: gradeEmojiKey('A') },
  S: { grade: 'S', label: 'Hạng S', bonusPct: 50, multiplier: 1.50, dropWeight: 0, color: '#f59e0b', emoji: gradeEmoji('S'), emoji_key: gradeEmojiKey('S') },
};

export const ENCHANT_UPGRADE_CONFIG = {
  D: { next: 'C', stones: 1, lt: 50, baseRate: 85, pityStep: 5 },
  C: { next: 'B', stones: 2, lt: 100, baseRate: 65, pityStep: 5 },
  B: { next: 'A', stones: 4, lt: 250, baseRate: 45, pityStep: 5 },
  A: { next: 'S', stones: 8, lt: 500, baseRate: 20, pityStep: 5 },
  S: null,
};

export function normalizeEnchantGrade(raw) {
  const g = String(raw || 'D').trim().toUpperCase();
  return ENCHANT_GRADES[g] ? g : 'D';
}

export function getEnchantMultiplier(rawGrade) {
  const g = normalizeEnchantGrade(rawGrade);
  return ENCHANT_GRADES[g]?.multiplier || 1.0;
}

export function getEnchantBonusPct(rawGrade) {
  const g = normalizeEnchantGrade(rawGrade);
  return ENCHANT_GRADES[g]?.bonusPct || 0;
}

export function rollDefaultEnchantGrade(rng = Math.random) {
  const r = rng() * 100;
  if (r < 40) return 'D';
  if (r < 72) return 'C';
  if (r < 92) return 'B';
  return 'A';
}

export function getEnchantUpgradeQuote(currentGrade, pityCount = 0) {
  const g = normalizeEnchantGrade(currentGrade);
  const cfg = ENCHANT_UPGRADE_CONFIG[g];
  if (!cfg) return null;
  const pity = Math.max(0, Number(pityCount) || 0);
  const effectiveRate = Math.min(100, cfg.baseRate + pity * cfg.pityStep);
  return {
    from: g,
    to: cfg.next,
    stones: cfg.stones,
    lt: cfg.lt,
    baseRate: cfg.baseRate,
    pityCount: pity,
    pityBonusPct: pity * cfg.pityStep,
    effectiveRate,
  };
}

/**
 * Hệ thống Nghề Tu Tiên & Hợp Đồng Tuần (/job & /nhiemvu, v1.3)
 */
export const JOB_DAILY_LIMIT = 8;
export const JOB_COOLDOWN_MS = 60 * 60 * 1000;

export const JOBS_CATALOG = [
  {
    job_id: 'quet_san',
    name: 'Quét Dọn Sân Tiên Điện',
    icon: `${uiEm('ui_refresh')}`,
    ltMin: 55,
    ltMax: 80,
    exp: 30,
    summary: 'Nhẹ nhàng, sạch sẽ, không bỏ sót góc khuất.',
    stories: [
      'Cầm chổi trúc quét sạch lá hoa anh đào rụng đầy sân Tiên Điện.',
      'Lau bóng lan can bạch ngọc trước cổng lớn SuMi Family.',
    ],
  },
  {
    job_id: 'rua_bat',
    name: 'Rửa Bát Yến Tiệc',
    icon: `${em('su_sprout')}`,
    ltMin: 60,
    ltMax: 80,
    exp: 30,
    summary: 'Phụ bếp Tiên Điện dọn dẹp sau đại tiệc.',
    stories: [
      'Rửa sạch hàng trăm chén ngọc Lưu Ly sau buổi tiệc linh tửu.',
      'Sắp xếp lại bộ ấm trà Phượng Hoàng sáng bóng như mới.',
    ],
  },
  {
    job_id: 'tuoi_cay',
    name: 'Tưới Cây Thảo Dược',
    icon: `${em('su_sprout')}`,
    ltMin: 65,
    ltMax: 90,
    exp: 35,
    summary: 'Chăm sóc vườn Linh Dược quý của Tiểu thư Fuyumi.',
    stories: [
      'Múc nước suối Thanh Tuyền tưới đều vườn Tuyết Liên nghìn năm.',
      'Nhổ cỏ dại và bắt sâu cho khóm Nhân Sâm Thần Địa.',
    ],
  },
  {
    job_id: 'giao_trasua',
    name: 'Giao Trà Sữa SuMi',
    icon: `${em('su_el_thuy')}`,
    ltMin: 70,
    ltMax: 95,
    exp: 40,
    summary: 'Shipper tốc độ cao khắp các sảnh SuMi.',
    stories: [
      'Cưỡi gió giao 10 ly Trà Sữa Trân Châu Đường Đen tới sảnh Voice trước khi đá tan!',
      'Giao đơn đặc biệt cho trưởng lão đúng giờ hẹn và được tip thêm.',
    ],
  },
  {
    job_id: 'cau_ca',
    name: 'Câu Cá Linh Trì',
    icon: `${em('su_sprout')}`,
    ltMin: 75,
    ltMax: 105,
    exp: 45,
    summary: 'Thả cần bên hồ Nguyệt Ảnh săn Cá Chép Vàng.',
    stories: [
      'Giật lên một chú Cá Chép Vàng vảy óng ánh giữa làn sương sớm.',
      'Thu hoạch giỏ Tôm Tích Băng phục vụ bữa tối Tiên Điện.',
    ],
  },
  {
    job_id: 'tuan_tra',
    name: 'Tuần Tra Đêm Sơn Môn',
    icon: `${em('daily_shop_emblem')}`,
    ltMin: 85,
    ltMax: 120,
    exp: 50,
    summary: 'Canh giữ kết giới Sơn Môn suốt đêm thanh vắng.',
    stories: [
      'Thắp sáng lồng đèn đi tuần dọc trường lang bảo vệ kết giới Hồ Tộc.',
      'Phát hiện và xua đuổi vài yêu quái nhỏ lén lút ngoài bìa rừng.',
    ],
  },
];

export const JOB_BY_ID = Object.fromEntries(JOBS_CATALOG.map((j) => [j.job_id, j]));

export const WEEKLY_CONTRACTS_CONFIG = {
  jobs: { target: 15, rewardLt: 450, rewardStones: 2, label: 'Hoàn thành 15 ca Làm Việc (/job)' },
  wins: { target: 25, rewardLt: 550, rewardStones: 3, label: 'Thắng 25 trận Battle / Tháp' },
  exp: { target: 10000, rewardLt: 500, rewardStones: 2, label: 'Tích lũy 10.000 EXP trong tuần' },
  bonus: { rewardLt: 700, rewardStones: 5, label: 'Thưởng Hoàn Tất 3/3 Hợp Đồng Tuần' },
};

// =========================================================================
// HỆ THỐNG LINH VỰC • THẦN THỨC • THẦN CẢNH (v1.3 + v1.7)
// =========================================================================
export const DOMAIN_ELEMENTS = V13_DOMAIN_ELEMENTS;

export const DOMAIN_CATALOG = [...V13_DOMAINS, ...V17_DOMAINS].map((d) => ({
  ...d,
  entity_kind: 'domain',
  id: d.domain_id,
  is_unique: Boolean(d.is_unique || MYTHIC_UNIQUE_DOMAIN_IDS.has(d.domain_id)),
  display_rarity_key: d.is_exclusive_fuyumi ? 'supreme' : (d.is_unique || MYTHIC_UNIQUE_DOMAIN_IDS.has(d.domain_id)) ? 'unique_supreme' : d.rarity_key,
  drop_rate: d.is_exclusive_fuyumi ? 0 : (RARITY_TIERS[d.rarity_key]?.dropRate ?? 0),
  icon: domainEmoji(d.domain_id, em('su_realm_star')),
  emoji_key: domainEmojiKey(d.domain_id),
  file: d.file || `domains/${d.domain_id}.png`,
}));

export const DOMAIN_BY_ID = Object.fromEntries(DOMAIN_CATALOG.map((d) => [d.domain_id, d]));

export const DIVINE_SENSE_CATALOG = [...V13_DIVINE_SENSES, ...V17_DIVINE_SENSES].map((s) => ({
  ...s,
  entity_kind: 'sense',
  id: s.sense_id,
  is_unique: Boolean(s.is_unique || MYTHIC_UNIQUE_SENSE_IDS.has(s.sense_id)),
  display_rarity_key: s.is_exclusive_fuyumi ? 'supreme' : (s.is_unique || MYTHIC_UNIQUE_SENSE_IDS.has(s.sense_id)) ? 'unique_supreme' : s.rarity_key,
  drop_rate: s.is_exclusive_fuyumi ? 0 : (RARITY_TIERS[s.rarity_key]?.dropRate ?? 0),
  icon: senseEmoji(s.sense_id, em('su_sparkle')),
  emoji_key: senseEmojiKey(s.sense_id),
  file: s.file || `domains/${s.sense_id}.png`,
}));

export const DIVINE_SENSE_BY_ID = Object.fromEntries(DIVINE_SENSE_CATALOG.map((s) => [s.sense_id, s]));

export const DIVINE_REALM_CATALOG = [...V13_DIVINE_REALMS, ...V17_DIVINE_REALMS].map((r) => ({
  ...r,
  entity_kind: 'realm',
  id: r.realm_id,
  is_unique: Boolean(r.is_unique || MYTHIC_UNIQUE_REALM_IDS.has(r.realm_id)),
  display_rarity_key: r.is_exclusive_fuyumi ? 'supreme' : (r.is_unique || MYTHIC_UNIQUE_REALM_IDS.has(r.realm_id)) ? 'unique_supreme' : r.rarity_key,
  drop_rate: r.is_exclusive_fuyumi ? 0 : (RARITY_TIERS[r.rarity_key]?.dropRate ?? 0),
  icon: realmEmojiById(r.realm_id, em('su_arena')),
  emoji_key: realmEmojiKeyById(r.realm_id),
  file: r.file || `domains/${r.realm_id}.png`,
}));

export const DIVINE_REALM_BY_ID = Object.fromEntries(DIVINE_REALM_CATALOG.map((r) => [r.realm_id, r]));

// =========================================================================
// NÔNG TRẠI THỜI GIAN THỰC (/farm) & ĐỔI QUÀ (/exchange) (v1.3)
// =========================================================================
const FARM_SEED_PRICING = {
  seed_linh_thao: {
    plot_type: 'linh_dien', plot_label: 'Linh Điền', cost_lt: 88, growth_hours: 6, care_interval_hours: 2, wilt_hours: 4.5, reward_lt: 145, reward_essence: 15, min_care_recommended: 1,
  },
  seed_tien_thao: {
    plot_type: 'linh_dien', plot_label: 'Linh Điền', cost_lt: 220, growth_hours: 12, care_interval_hours: 4, wilt_hours: 7, reward_lt: 390, reward_essence: 40, min_care_recommended: 2,
  },
  seed_than_moc: {
    plot_type: 'linh_dien', plot_label: 'Linh Điền', cost_lt: 550, growth_hours: 24, care_interval_hours: 6, wilt_hours: 12, reward_lt: 1050, reward_essence: 110, min_care_recommended: 2,
  },
  egg_linh_thu: {
    plot_type: 'linh_cac', plot_label: 'Linh Các', cost_lt: 132, growth_hours: 6, care_interval_hours: 2, wilt_hours: 4.5, reward_lt: 220, reward_essence: 22, min_care_recommended: 1,
  },
  egg_tien_thu: {
    plot_type: 'linh_cac', plot_label: 'Linh Các', cost_lt: 330, growth_hours: 12, care_interval_hours: 4, wilt_hours: 7, reward_lt: 580, reward_essence: 60, min_care_recommended: 2,
  },
  egg_than_thu: {
    plot_type: 'linh_cac', plot_label: 'Linh Các', cost_lt: 825, growth_hours: 24, care_interval_hours: 6, wilt_hours: 12, reward_lt: 1600, reward_essence: 165, min_care_recommended: 2,
  },
};

export const FARM_SEEDS = V13_FARM_ASSETS
  .filter((a) => FARM_SEED_PRICING[a.uid])
  .map((a) => {
    const pricing = FARM_SEED_PRICING[a.uid];
    return {
      seed_id: a.uid,
      name: a.name,
      ...pricing,
      care_window: a.care_window,
      reward_summary: `Giá ${pricing.cost_lt.toLocaleString('vi-VN')} LT → Thu ${pricing.reward_lt.toLocaleString('vi-VN')} LT + ${pricing.reward_essence} Linh Quả`,
      icon: farmEmoji(a.uid, pricing.plot_type === 'linh_dien' ? `${em('su_sprout')}` : `${em('su_pet_paw')}`),
      file: `farm/${a.uid}.png`,
    };
  });

export const FARM_SEED_BY_ID = Object.fromEntries(FARM_SEEDS.map((s) => [s.seed_id, s]));

export const EXCHANGE_ITEMS = [
  { exchange_id: 'exchange_lt_500', name: 'Túi 500 Linh Thạch', cost_essence: 120, reward_kind: 'linh_thach', reward_amount: 500, icon: em('su_linhthach'), description: 'Quy đổi 120 Linh Quả Tiên Giới lấy ngay 500 Linh Thạch.' },
  { exchange_id: 'enchant_stone', name: 'Đá Khắc Ấn', cost_essence: 35, reward_kind: 'inventory', item_id: 'enchant_stone', reward_amount: 1, max_stack: 99, icon: em('enchant_stone'), description: 'Cường hóa Khắc Ấn D→S cho Linh Thú & Pháp Bảo (túi tối đa 99).' },
  { exchange_id: 'pet_star_stone', name: 'Tinh Thạch Nâng Sao', cost_essence: 45, reward_kind: 'inventory', item_id: 'pet_star_stone', reward_amount: 1, icon: em('pet_star_stone'), description: 'Nguyên liệu đột phá cấp Sao cho Linh Thú.' },
  { exchange_id: 'tower_reset_card', name: 'Thẻ Tẩy Tủy Tháp Thí Luyện', cost_essence: 90, reward_kind: 'inventory', item_id: 'tower_reset_card', reward_amount: 1, max_stack: 15, icon: em('tower_reset_card'), description: 'Hồi đầy 5/5 lượt khiêu chiến Tháp trong ngày (túi tối đa 15).' },
  { exchange_id: 'gacha_ticket_equip', name: 'Vé Triệu Hồi Pháp Bảo', cost_essence: 50, reward_kind: 'inventory', item_id: 'gacha_ticket_equip', reward_amount: 1, icon: em('gacha_ticket_equip'), description: 'Dùng miễn phí 1 lượt /roll loai:equipment.' },
  { exchange_id: 'gacha_ticket_pet', name: 'Vé Triệu Hồi Linh Thú', cost_essence: 50, reward_kind: 'inventory', item_id: 'gacha_ticket_pet', reward_amount: 1, icon: em('gacha_ticket_pet'), description: 'Dùng miễn phí 1 lượt /roll loai:pet.' },
  { exchange_id: 'gacha_ticket_domain', name: 'Vé Khai Mở Linh Vực', cost_essence: 65, reward_kind: 'inventory', item_id: 'gacha_ticket_domain', reward_amount: 1, icon: em('su_gacha_dice'), description: 'Dùng miễn phí 1 lượt /roll loai:domain.' },
  { exchange_id: 'farm_slot_unlock', name: 'Mở Khóa Ô Canh Tác (#5 → #8)', cost_essence: 300, reward_kind: 'farm_slot', reward_amount: 1, max_slots: 8, icon: farmEmoji('farm_essence'), description: 'Mở rộng nông trại từ 4 ô lên tối đa 8 ô (4 Linh Điền + 4 Linh Các, tối đa 4 lần mở).' },
];

export const EXCHANGE_ITEM_BY_ID = Object.fromEntries(EXCHANGE_ITEMS.map((it) => [it.exchange_id, it]));
