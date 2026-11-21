/**
 * src/data/catalog.js
 * Danh mục chuẩn (Single Source of Truth) cho 45 Pháp Bảo Loadout, 21 Linh Thú (4 Phẩm Cấp + Độc Quyền Fuyumi),
 * Pet Tân Thủ Mặc Định, và các mốc Level Role của SuMi Family.
 */

import {
  em,
  tierEmoji,
  tierEmojiKey,
  itemEmoji,
  itemEmojiKey,
  petEmoji,
  petEmojiKey,
  ringEmoji,
  elementEmoji,
} from '../config/emojiHelper.js';

export const FUYUMI_USER_ID = '757091869183311872';
export const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || 'https://sumi-profile-backend.onrender.com').replace(/\/$/, '');

export const RARITY_TIERS = {
  common: { key: 'common', label: 'Phàm Phẩm', dbKey: 'Pham Pham', dropRate: 60.0, color: '#94a3b8', colorDec: 9741496, emoji: tierEmoji('common'), emoji_key: tierEmojiKey('common') },
  rare: { key: 'rare', label: 'Linh Phẩm', dbKey: 'Linh Pham', dropRate: 25.0, color: '#3b82f6', colorDec: 3900150, emoji: tierEmoji('rare'), emoji_key: tierEmojiKey('rare') },
  epic: { key: 'epic', label: 'Tiên Phẩm', dbKey: 'Tien Pham', dropRate: 14.0, color: '#a855f7', colorDec: 11032055, emoji: tierEmoji('epic'), emoji_key: tierEmojiKey('epic') },
  mythic: { key: 'mythic', label: 'Thần Thoại', dbKey: 'Than Thoai', dropRate: 1.0, color: '#f59e0b', colorDec: 16096779, emoji: tierEmoji('mythic'), emoji_key: tierEmojiKey('mythic') },
  supreme: { key: 'supreme', label: 'Tối Thượng Thần Thoại', dbKey: 'Tối Thượng Thần Thoại', dropRate: 0.0, color: '#ec4899', colorDec: 15485081, emoji: tierEmoji('supreme'), emoji_key: tierEmojiKey('supreme') },
};

export function normalizeRarityKey(raw) {
  if (!raw) return 'common';
  const s = String(raw).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (s.includes('toi thuong') || s.includes('supreme')) return 'supreme';
  if (s.includes('than thoai') || s.includes('mythic')) return 'mythic';
  if (s.includes('tien pham') || s.includes('cuc pham') || s.includes('epic')) return 'epic';
  if (s.includes('linh pham') || s.includes('hiem') || s.includes('rare')) return 'rare';
  return 'common';
}

export function formatRarityLabel(raw) {
  const key = normalizeRarityKey(raw);
  return RARITY_TIERS[key]?.label || 'Phàm Phẩm';
}

export const LEVEL_ROLE_MILESTONES = [
  { level: 5, roleId: '1038406122417176586', name: '« 5・U Linh Chớm Nở »' },
  { level: 15, roleId: '1038405196662976562', name: '« 15・Linh Cáo Học Giả »' },
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
]);

/**
 * Toàn bộ 45 Pháp Bảo Loadout (15 Vũ Khí, 15 Bảo Ngọc, 15 Chiến Hồn)
 */
export const EQUIPMENT_CATALOG = [
  // 15 Vũ Khí (Weapons)
  { item_id: 'weapon_common_1', item_name: 'Thiết Mộc Trọng Kiếm', item_type: 'weapon', rarity: 'Phàm Phẩm', rarity_key: 'common', element: 'Kim', bonus_atk: 150, bonus_def: 0, bonus_spd: 0, bonus_hp: 0, bonus_crit: 5.0, hax_skill: null, hax_description: 'Tăng +5% tỉ lệ bạo kích cơ bản.', drop_rate: 60.0, is_unique: false },
  { item_id: 'weapon_common_2', item_name: 'Thanh Trúc Linh Cung', item_type: 'weapon', rarity: 'Phàm Phẩm', rarity_key: 'common', element: 'Mộc', bonus_atk: 120, bonus_def: 0, bonus_spd: 50, bonus_hp: 0, bonus_crit: 0.0, hax_skill: null, hax_description: 'Tăng tốc xuất chiêu ổn định.', drop_rate: 60.0, is_unique: false },
  { item_id: 'weapon_common_3', item_name: 'Hắc Thiết Song Đao', item_type: 'weapon', rarity: 'Phàm Phẩm', rarity_key: 'common', element: 'Hỏa', bonus_atk: 140, bonus_def: 0, bonus_spd: 30, bonus_hp: 0, bonus_crit: 0.0, hax_skill: null, hax_description: 'Đòn đánh nhanh, gọn, ổn định.', drop_rate: 60.0, is_unique: false },
  { item_id: 'weapon_common_4', item_name: 'Toái Thạch Cự Phủ', item_type: 'weapon', rarity: 'Phàm Phẩm', rarity_key: 'common', element: 'Thổ', bonus_atk: 160, bonus_def: 80, bonus_spd: -20, bonus_hp: 0, bonus_crit: 0.0, hax_skill: null, hax_description: 'Bổ sung phòng thủ, đánh đổi nhẹ tốc độ.', drop_rate: 60.0, is_unique: false },
  { item_id: 'weapon_rare_1', item_name: 'Tử Điện Lôi Minh Thương', item_type: 'weapon', rarity: 'Linh Phẩm', rarity_key: 'rare', element: 'Lôi', bonus_atk: 320, bonus_def: 0, bonus_spd: 0, bonus_hp: 0, bonus_crit: 8.0, hax_skill: null, hax_description: '15% tỉ lệ gây Tê Liệt khiến đối thủ mất lượt.', drop_rate: 25.0, is_unique: false },
  { item_id: 'weapon_rare_2', item_name: 'U Hỏa Nhiễm Huyết Kiếm', item_type: 'weapon', rarity: 'Linh Phẩm', rarity_key: 'rare', element: 'Hỏa', bonus_atk: 350, bonus_def: 0, bonus_spd: 0, bonus_hp: 0, bonus_crit: 0.0, hax_skill: null, hax_description: 'Gây Thiêu Đốt rút 5% HP địch mỗi hiệp.', drop_rate: 25.0, is_unique: false },
  { item_id: 'weapon_rare_3', item_name: 'Hàn Băng Thần Châm', item_type: 'weapon', rarity: 'Linh Phẩm', rarity_key: 'rare', element: 'Thủy', bonus_atk: 280, bonus_def: 0, bonus_spd: 120, bonus_hp: 0, bonus_crit: 0.0, hax_skill: null, hax_description: 'Giảm 10% tốc độ ra đòn của đối thủ.', drop_rate: 25.0, is_unique: false },
  { item_id: 'weapon_rare_4', item_name: 'Bạch Hạc Vũ Phiến', item_type: 'weapon', rarity: 'Linh Phẩm', rarity_key: 'rare', element: 'Quang', bonus_atk: 300, bonus_def: 150, bonus_spd: 0, bonus_hp: 0, bonus_crit: 0.0, hax_skill: null, hax_description: 'Tăng 10% tỉ lệ né tránh sát thương.', drop_rate: 25.0, is_unique: false },
  { item_id: 'weapon_epic_1', item_name: 'Thần Mộc Thiên Cương Trượng', item_type: 'weapon', rarity: 'Tiên Phẩm', rarity_key: 'epic', element: 'Mộc', bonus_atk: 600, bonus_def: 200, bonus_spd: 0, bonus_hp: 0, bonus_crit: 0.0, hax_skill: null, hax_description: 'Hồi máu bằng 15% sát thương gây ra.', drop_rate: 14.0, is_unique: false },
  { item_id: 'weapon_epic_2', item_name: 'Vạn Kiếp Huyết Ma Đao', item_type: 'weapon', rarity: 'Tiên Phẩm', rarity_key: 'epic', element: 'Ám', bonus_atk: 680, bonus_def: 0, bonus_spd: 0, bonus_hp: 0, bonus_crit: 15.0, hax_skill: null, hax_description: 'Sát thương bạo kích tăng lên x2.2.', drop_rate: 14.0, is_unique: false },
  { item_id: 'weapon_epic_3', item_name: 'Cực Băng Huyền Minh Cung', item_type: 'weapon', rarity: 'Tiên Phẩm', rarity_key: 'epic', element: 'Thủy', bonus_atk: 620, bonus_def: 0, bonus_spd: 250, bonus_hp: 0, bonus_crit: 0.0, hax_skill: null, hax_description: '25% tỉ lệ Đóng Băng đối thủ 1 lượt.', drop_rate: 14.0, is_unique: false },
  { item_id: 'weapon_epic_4', item_name: 'Thái Hư Trảm Tiên Kiếm', item_type: 'weapon', rarity: 'Tiên Phẩm', rarity_key: 'epic', element: 'Kim', bonus_atk: 650, bonus_def: 0, bonus_spd: 0, bonus_hp: 0, bonus_crit: 0.0, hax_skill: null, hax_description: 'Bỏ qua 30% giáp DEF của mục tiêu.', drop_rate: 14.0, is_unique: false },
  { item_id: 'weapon_mythic_1', item_name: '« Tru Tiên Diệt Thần Kiếm »', item_type: 'weapon', rarity: 'Thần Thoại', rarity_key: 'mythic', element: 'Kim', bonus_atk: 720, bonus_def: 0, bonus_spd: 300, bonus_hp: 0, bonus_crit: 18.0, hax_skill: 'Tuyệt Diệt Bất Tử', hax_description: 'Xuyên 100% khiên chắn và vô hiệu hóa cơ chế Bất Tử / Trùng Sinh của đối thủ trong 3 lượt đầu.', drop_rate: 1.0, is_unique: true },
  { item_id: 'weapon_mythic_2', item_name: '« Cửu Thiên Lôi Đình Cổ Thần Thương »', item_type: 'weapon', rarity: 'Thần Thoại', rarity_key: 'mythic', element: 'Lôi', bonus_atk: 740, bonus_def: 280, bonus_spd: 320, bonus_hp: 0, bonus_crit: 0.0, hax_skill: 'Lôi Thần Trấn Áp', hax_description: 'Khai trận cướp 40% SPD của đối thủ chuyển hóa trực tiếp thành ATK suốt trận.', drop_rate: 1.0, is_unique: true },
  { item_id: 'weapon_mythic_3', item_name: '« Hồng Mông Hỗn Độn Trượng »', item_type: 'weapon', rarity: 'Thần Thoại', rarity_key: 'mythic', element: 'Hỗn Độn', bonus_atk: 750, bonus_def: 350, bonus_spd: 300, bonus_hp: 0, bonus_crit: 0.0, hax_skill: 'Hỗn Độn Nghịch Đảo', hax_description: '35% xác suất biến toàn bộ sát thương nhận vào thành máu hồi phục và phản đòn 100%.', drop_rate: 1.0, is_unique: true },

  // 15 Bảo Ngọc (Gems)
  { item_id: 'gem_common_1', item_name: 'Thanh Linh Ngọc', item_type: 'gem', rarity: 'Phàm Phẩm', rarity_key: 'common', element: 'Mộc', bonus_atk: 0, bonus_def: 120, bonus_spd: 0, bonus_hp: 500, bonus_crit: 0.0, hax_skill: null, hax_description: 'Hồi phục nhẹ sinh lực sau trận.', drop_rate: 60.0, is_unique: false },
  { item_id: 'gem_common_2', item_name: 'Hỏa Tinh Thạch', item_type: 'gem', rarity: 'Phàm Phẩm', rarity_key: 'common', element: 'Hỏa', bonus_atk: 80, bonus_def: 80, bonus_spd: 0, bonus_hp: 0, bonus_crit: 0.0, hax_skill: null, hax_description: 'Kháng hiệu ứng thiêu đốt 20%.', drop_rate: 60.0, is_unique: false },
  { item_id: 'gem_common_3', item_name: 'Hoàng Thổ Bích', item_type: 'gem', rarity: 'Phàm Phẩm', rarity_key: 'common', element: 'Thổ', bonus_atk: 0, bonus_def: 150, bonus_spd: 0, bonus_hp: 300, bonus_crit: 0.0, hax_skill: null, hax_description: 'Gia cố phòng thủ cơ bản.', drop_rate: 60.0, is_unique: false },
  { item_id: 'gem_common_4', item_name: 'Lam Thủy Châu', item_type: 'gem', rarity: 'Phàm Phẩm', rarity_key: 'common', element: 'Thủy', bonus_atk: 0, bonus_def: 100, bonus_spd: 0, bonus_hp: 600, bonus_crit: 0.0, hax_skill: null, hax_description: 'Bổ sung sinh lực tối đa ổn định.', drop_rate: 60.0, is_unique: false },
  { item_id: 'gem_rare_1', item_name: 'Huyền Quy Hộ Tâm Kính', item_type: 'gem', rarity: 'Linh Phẩm', rarity_key: 'rare', element: 'Thủy', bonus_atk: 0, bonus_def: 320, bonus_spd: 0, bonus_hp: 1500, bonus_crit: 0.0, hax_skill: null, hax_description: 'Giảm 10% sát thương nhận từ đòn bạo kích.', drop_rate: 25.0, is_unique: false },
  { item_id: 'gem_rare_2', item_name: 'Phù Dung Lưu Ly Bảo Ngọc', item_type: 'gem', rarity: 'Linh Phẩm', rarity_key: 'rare', element: 'Mộc', bonus_atk: 0, bonus_def: 280, bonus_spd: 0, bonus_hp: 1800, bonus_crit: 0.0, hax_skill: null, hax_description: 'Hồi phục 5% HP tối đa mỗi hiệp.', drop_rate: 25.0, is_unique: false },
  { item_id: 'gem_rare_3', item_name: 'Tử Kim Thần Thuẫn Thạch', item_type: 'gem', rarity: 'Linh Phẩm', rarity_key: 'rare', element: 'Kim', bonus_atk: 0, bonus_def: 350, bonus_spd: 0, bonus_hp: 1200, bonus_crit: 0.0, hax_skill: null, hax_description: 'Đầu trận nhận lớp khiên 800 HP.', drop_rate: 25.0, is_unique: false },
  { item_id: 'gem_rare_4', item_name: 'Bích Hải Triều Sinh Châu', item_type: 'gem', rarity: 'Linh Phẩm', rarity_key: 'rare', element: 'Thủy', bonus_atk: 0, bonus_def: 300, bonus_spd: 0, bonus_hp: 2000, bonus_crit: 0.0, hax_skill: null, hax_description: 'Kháng 30% hiệu ứng làm chậm & khống chế.', drop_rate: 25.0, is_unique: false },
  { item_id: 'gem_epic_1', item_name: 'Cửu Tiêu Bất Diệt Ngọc', item_type: 'gem', rarity: 'Tiên Phẩm', rarity_key: 'epic', element: 'Kim', bonus_atk: 0, bonus_def: 650, bonus_spd: 0, bonus_hp: 4000, bonus_crit: 0.0, hax_skill: null, hax_description: 'Giảm cố định 25% toàn bộ sát thương gánh chịu.', drop_rate: 14.0, is_unique: false },
  { item_id: 'gem_epic_2', item_name: 'Vạn Niên Hàn Băng Châu', item_type: 'gem', rarity: 'Tiên Phẩm', rarity_key: 'epic', element: 'Thủy', bonus_atk: 0, bonus_def: 620, bonus_spd: 0, bonus_hp: 3800, bonus_crit: 0.0, hax_skill: null, hax_description: 'Phản lại 30% sát thương băng khi bị tấn công.', drop_rate: 14.0, is_unique: false },
  { item_id: 'gem_epic_3', item_name: 'Thái Cực Bát Quái Ngọc Bội', item_type: 'gem', rarity: 'Tiên Phẩm', rarity_key: 'epic', element: 'Quang', bonus_atk: 0, bonus_def: 680, bonus_spd: 0, bonus_hp: 4200, bonus_crit: 0.0, hax_skill: null, hax_description: 'Miễn dịch 50% mọi trạng thái khống chế.', drop_rate: 14.0, is_unique: false },
  { item_id: 'gem_epic_4', item_name: 'Phượng Hoàng Huyết Tinh', item_type: 'gem', rarity: 'Tiên Phẩm', rarity_key: 'epic', element: 'Hỏa', bonus_atk: 0, bonus_def: 600, bonus_spd: 0, bonus_hp: 4500, bonus_crit: 0.0, hax_skill: null, hax_description: 'Máu dưới 30% tự động hồi 35% HP (1 lần/trận).', drop_rate: 14.0, is_unique: false },
  { item_id: 'gem_mythic_1', item_name: '« Bất Hủ Thần Hoàng Ngọc »', item_type: 'gem', rarity: 'Thần Thoại', rarity_key: 'mythic', element: 'Thổ', bonus_atk: 200, bonus_def: 720, bonus_spd: 0, bonus_hp: 4800, bonus_crit: 0.0, hax_skill: 'Kim Thân Hộ Mệnh', hax_description: 'Chặn đứng đòn chí tử tại 1 HP và miễn nhiễm 100% sát thương trong 2 lượt kế tiếp.', drop_rate: 1.0, is_unique: true },
  { item_id: 'gem_mythic_2', item_name: '« Vạn Tượng Quy Nhất Châu »', item_type: 'gem', rarity: 'Thần Thoại', rarity_key: 'mythic', element: 'Quang', bonus_atk: 0, bonus_def: 730, bonus_spd: 250, bonus_hp: 4600, bonus_crit: 0.0, hax_skill: 'Kính Hoa Thủy Nguyệt', hax_description: 'Phản hồi 75% sát thương nhận vào dội ngược lại đối thủ (bỏ qua giáp DEF).', drop_rate: 1.0, is_unique: true },
  { item_id: 'gem_mythic_3', item_name: '« Thiên Hồ Hóa Thần Ngọc »', item_type: 'gem', rarity: 'Thần Thoại', rarity_key: 'mythic', element: 'Hỗn Độn', bonus_atk: 0, bonus_def: 750, bonus_spd: 200, bonus_hp: 5000, bonus_crit: 0.0, hax_skill: 'Thần Hồ Diễm Hộ', hax_description: 'Đầu trận tạo khiên bằng 100% HP tối đa; khi khiên còn tồn tại, giảm 50% sát thương địch.', drop_rate: 1.0, is_unique: true },

  // 15 Chiến Hồn (Souls)
  { item_id: 'soul_common_1', item_name: 'Dã Lang Chiến Hồn', item_type: 'soul', rarity: 'Phàm Phẩm', rarity_key: 'common', element: 'Ám', bonus_atk: 50, bonus_def: 0, bonus_spd: 60, bonus_hp: 0, bonus_crit: 0.0, hax_skill: null, hax_description: 'Tăng nhẹ tốc độ xuất chiêu.', drop_rate: 60.0, is_unique: false },
  { item_id: 'soul_common_2', item_name: 'Thanh Phong Linh Hồn', item_type: 'soul', rarity: 'Phàm Phẩm', rarity_key: 'common', element: 'Mộc', bonus_atk: 0, bonus_def: 30, bonus_spd: 80, bonus_hp: 0, bonus_crit: 0.0, hax_skill: null, hax_description: 'Thân pháp linh hoạt, tăng SPD.', drop_rate: 60.0, is_unique: false },
  { item_id: 'soul_common_3', item_name: 'Linh Hồ Ấu Hồn', item_type: 'soul', rarity: 'Phàm Phẩm', rarity_key: 'common', element: 'Quang', bonus_atk: 40, bonus_def: 0, bonus_spd: 70, bonus_hp: 0, bonus_crit: 0.0, hax_skill: null, hax_description: 'Tăng nhẹ cả tấn công và tốc độ.', drop_rate: 60.0, is_unique: false },
  { item_id: 'soul_common_4', item_name: 'Man Ngưu Thú Hồn', item_type: 'soul', rarity: 'Phàm Phẩm', rarity_key: 'common', element: 'Thổ', bonus_atk: 0, bonus_def: 100, bonus_spd: 40, bonus_hp: 0, bonus_crit: 0.0, hax_skill: null, hax_description: 'Tăng độ vững chãi phòng ngự.', drop_rate: 60.0, is_unique: false },
  { item_id: 'soul_rare_1', item_name: 'Tấn Lôi Ưng Hồn', item_type: 'soul', rarity: 'Linh Phẩm', rarity_key: 'rare', element: 'Lôi', bonus_atk: 100, bonus_def: 0, bonus_spd: 180, bonus_hp: 0, bonus_crit: 0.0, hax_skill: null, hax_description: 'Tăng 15% ưu tiên ra đòn trước.', drop_rate: 25.0, is_unique: false },
  { item_id: 'soul_rare_2', item_name: 'Minh Giới U Hồn', item_type: 'soul', rarity: 'Linh Phẩm', rarity_key: 'rare', element: 'Ám', bonus_atk: 0, bonus_def: 120, bonus_spd: 150, bonus_hp: 0, bonus_crit: 0.0, hax_skill: null, hax_description: 'Đòn đánh hút 10% máu đối thủ.', drop_rate: 25.0, is_unique: false },
  { item_id: 'soul_rare_3', item_name: 'Cuồng Bạo Hùng Hồn', item_type: 'soul', rarity: 'Linh Phẩm', rarity_key: 'rare', element: 'Thổ', bonus_atk: 200, bonus_def: 0, bonus_spd: 130, bonus_hp: 0, bonus_crit: 0.0, hax_skill: null, hax_description: 'Càng ít máu sát thương càng cao.', drop_rate: 25.0, is_unique: false },
  { item_id: 'soul_rare_4', item_name: 'Thải Điệp Mộng Hồn', item_type: 'soul', rarity: 'Linh Phẩm', rarity_key: 'rare', element: 'Mộc', bonus_atk: 0, bonus_def: 80, bonus_spd: 190, bonus_hp: 0, bonus_crit: 0.0, hax_skill: null, hax_description: '15% xác suất ru ngủ đối thủ 1 hiệp.', drop_rate: 25.0, is_unique: false },
  { item_id: 'soul_epic_1', item_name: 'Thương Khung Thần Long Hồn', item_type: 'soul', rarity: 'Tiên Phẩm', rarity_key: 'epic', element: 'Quang', bonus_atk: 300, bonus_def: 200, bonus_spd: 380, bonus_hp: 0, bonus_crit: 0.0, hax_skill: null, hax_description: 'Mỗi hiệp tăng 5% ATK (cộng dồn tối đa 5 lần).', drop_rate: 14.0, is_unique: false },
  { item_id: 'soul_epic_2', item_name: 'Cửu U Minh Xà Hồn', item_type: 'soul', rarity: 'Tiên Phẩm', rarity_key: 'epic', element: 'Ám', bonus_atk: 250, bonus_def: 0, bonus_spd: 400, bonus_hp: 0, bonus_crit: 0.0, hax_skill: null, hax_description: 'Đầu trận tẩm kịch độc rút 8% HP tối đa địch mỗi lượt.', drop_rate: 14.0, is_unique: false },
  { item_id: 'soul_epic_3', item_name: 'Thánh Quang Kỳ Lân Hồn', item_type: 'soul', rarity: 'Tiên Phẩm', rarity_key: 'epic', element: 'Quang', bonus_atk: 0, bonus_def: 400, bonus_spd: 360, bonus_hp: 0, bonus_crit: 0.0, hax_skill: null, hax_description: 'Tự động hóa giải 1 hiệu ứng xấu mỗi hiệp.', drop_rate: 14.0, is_unique: false },
  { item_id: 'soul_epic_4', item_name: 'Huyết Ngục Ma Lang Hồn', item_type: 'soul', rarity: 'Tiên Phẩm', rarity_key: 'epic', element: 'Hỏa', bonus_atk: 320, bonus_def: 0, bonus_spd: 420, bonus_hp: 0, bonus_crit: 0.0, hax_skill: null, hax_description: 'Hút máu bằng 25% sát thương gây ra.', drop_rate: 14.0, is_unique: false },
  { item_id: 'soul_mythic_1', item_name: '« Cửu Vĩ Thiên Tiên Hồn »', item_type: 'soul', rarity: 'Thần Thoại', rarity_key: 'mythic', element: 'Hỗn Độn', bonus_atk: 350, bonus_def: 300, bonus_spd: 450, bonus_hp: 0, bonus_crit: 0.0, hax_skill: 'Mị Hoặc Chúng Sinh', hax_description: '40% xác suất mỗi hiệp Mị Hoặc đối thủ, ép đối phương tự đánh chính mình.', drop_rate: 1.0, is_unique: true },
  { item_id: 'soul_mythic_2', item_name: '« Thái Sơ Thời Không Ma Thần Hồn »', item_type: 'soul', rarity: 'Thần Thoại', rarity_key: 'mythic', element: 'Không Gian', bonus_atk: 380, bonus_def: 280, bonus_spd: 460, bonus_hp: 0, bonus_crit: 0.0, hax_skill: 'Thời Không Đình Chỉ', hax_description: 'Ngưng đọng thời gian 1 lần/trận, tung liên hoàn 2 lượt không gián đoạn.', drop_rate: 1.0, is_unique: true },
  { item_id: 'soul_mythic_3', item_name: '« Luân Hồi Bất Diệt Chiến Hồn »', item_type: 'soul', rarity: 'Thần Thoại', rarity_key: 'mythic', element: 'Luân Hồi', bonus_atk: 360, bonus_def: 320, bonus_spd: 470, bonus_hp: 0, bonus_crit: 0.0, hax_skill: 'Sinh Mệnh Nghịch Chuyển', hax_description: 'Khi HP tụt dưới 20%, hoán đổi ngay % máu hiện tại với đối thủ.', drop_rate: 1.0, is_unique: true },
].map((item) => ({
  ...item,
  icon: itemEmoji(item.item_id),
  emoji_key: itemEmojiKey(item.item_id),
  element_icon: elementEmoji(item.element),
}));

export const EQUIPMENT_BY_ID = Object.fromEntries(EQUIPMENT_CATALOG.map((item) => [item.item_id, item]));

/**
 * Toàn bộ 21 Linh Thú chia đúng 4 bậc phẩm cấp (5 Phàm / 5 Linh / 4 Tiên / 6 Thần Thoại) + Cửu Vĩ Hồng Hồ độc quyền Fuyumi
 */
export const PET_CATALOG = [
  // 5 Phàm Phẩm (Starter yếu nhất: Hóa Thạch Nham Nham Thú 120/180/100)
  { pet_type: 'hoa_thach_nham_nham', pet_name: 'Hóa Thạch Nham Nham Thú', element: 'Thổ', rarity: 'Phàm Phẩm', rarity_key: 'common', base_atk: 120, base_def: 180, base_spd: 100, hax_skill: 'Hóa Đá', hax_description: 'Hóa đá đối thủ 1 hiệp khi bị tấn công.', image_file: 'pets/hoa_thach_nham_nham.png', is_starter: true, is_exclusive_fuyumi: false },
  { pet_type: 'thuy_tinh_huyen_ngao', pet_name: 'Thủy Tinh Huyền Ngao', element: 'Thủy', rarity: 'Phàm Phẩm', rarity_key: 'common', base_atk: 160, base_def: 260, base_spd: 140, hax_skill: 'Nghịch Lưu Phản Xạ', hax_description: 'Phản lại 60% sát thương phép nhận vào.', image_file: 'pets/thuy_tinh_huyen_ngao.png', is_starter: false, is_exclusive_fuyumi: false },
  { pet_type: 'thao_moc_linh_vien', pet_name: 'Thảo Mộc Linh Viên', element: 'Mộc', rarity: 'Phàm Phẩm', rarity_key: 'common', base_atk: 180, base_def: 240, base_spd: 170, hax_skill: 'Đất Mẹ Che Chở', hax_description: 'Đầu trận tạo khiên chắn bằng 50% HP tối đa.', image_file: 'pets/thao_moc_linh_vien.png', is_starter: false, is_exclusive_fuyumi: false },
  { pet_type: 'thanh_truc_tien_loc', pet_name: 'Thanh Trúc Tiên Lộc', element: 'Mộc', rarity: 'Phàm Phẩm', rarity_key: 'common', base_atk: 190, base_def: 220, base_spd: 210, hax_skill: 'Linh Mộc Hồi Xuân', hax_description: 'Hồi phục 25% HP tối đa mỗi hiệp.', image_file: 'pets/thanh_truc_tien_loc.png', is_starter: false, is_exclusive_fuyumi: false },
  { pet_type: 'thiet_giap_xich_giac', pet_name: 'Thiết Giáp Xích Giác Thú', element: 'Kim', rarity: 'Phàm Phẩm', rarity_key: 'common', base_atk: 200, base_def: 280, base_spd: 150, hax_skill: 'Phản Chấn Thần Lực', hax_description: 'Phản hồi 80% sát thương vật lý nhận vào.', image_file: 'pets/thiet_giap_xich_giac.png', is_starter: false, is_exclusive_fuyumi: false },

  // 5 Linh Phẩm
  { pet_type: 'bang_tuyet_ho', pet_name: 'Băng Tuyết Hồ', element: 'Thủy', rarity: 'Linh Phẩm', rarity_key: 'rare', base_atk: 350, base_def: 390, base_spd: 420, hax_skill: 'Băng Phong', hax_description: '35% tỉ lệ đóng băng đối thủ 1 hiệp.', image_file: 'pets/bang_tuyet_ho.png', is_starter: false, is_exclusive_fuyumi: false },
  { pet_type: 'viem_nguc_khuyen', pet_name: 'Viêm Ngục Khuyển', element: 'Hỏa', rarity: 'Linh Phẩm', rarity_key: 'rare', base_atk: 380, base_def: 320, base_spd: 350, hax_skill: 'Cuồng Nộ', hax_description: 'HP dưới 30% kích hoạt Cuồng Nộ x3 sát thương.', image_file: 'pets/viem_nguc_khuyen.png', is_starter: false, is_exclusive_fuyumi: false },
  { pet_type: 'xich_xa_hoa_long', pet_name: 'Xích Xà Hỏa Long', element: 'Hỏa', rarity: 'Linh Phẩm', rarity_key: 'rare', base_atk: 420, base_def: 310, base_spd: 390, hax_skill: 'Hỏa Độc Huyết', hax_description: 'Đối thủ mất 15% HP tối đa mỗi hiệp.', image_file: 'pets/xich_xa_hoa_long.png', is_starter: false, is_exclusive_fuyumi: false },
  { pet_type: 'bach_kim_ho_tu', pet_name: 'Bạch Kim Hổ Tử', element: 'Kim', rarity: 'Linh Phẩm', rarity_key: 'rare', base_atk: 490, base_def: 360, base_spd: 430, hax_skill: 'Phá Giáp Trảm', hax_description: 'Xuyên 100% lớp phòng ngự DEF của mục tiêu.', image_file: 'pets/bach_kim_ho_tu.png', is_starter: false, is_exclusive_fuyumi: false },
  { pet_type: 'hai_duong_tien_ngu', pet_name: 'Hải Dương Tiên Ngư', element: 'Thủy', rarity: 'Linh Phẩm', rarity_key: 'rare', base_atk: 320, base_def: 440, base_spd: 460, hax_skill: 'Thanh Tẩy Linh Triều', hax_description: 'Xóa sạch khiên chắn và buff có lợi của đối thủ.', image_file: 'pets/hai_duong_tien_ngu.png', is_starter: false, is_exclusive_fuyumi: false },

  // 4 Tiên Phẩm
  { pet_type: 'linh_mieu_hoa_tien', pet_name: 'Linh Miêu Hoa Tiên', element: 'Mộc', rarity: 'Tiên Phẩm', rarity_key: 'epic', base_atk: 390, base_def: 350, base_spd: 490, hax_skill: 'Gai Mộc Trói Chân', hax_description: 'Phong ấn toàn bộ kỹ năng HAX đối thủ trong 2 lượt đầu.', image_file: 'pets/linh_mieu_hoa_tien.png', is_starter: false, is_exclusive_fuyumi: false },
  { pet_type: 'hoa_diem_ho', pet_name: 'Hỏa Diễm Hồ', element: 'Hỏa', rarity: 'Tiên Phẩm', rarity_key: 'epic', base_atk: 450, base_def: 280, base_spd: 410, hax_skill: 'Thiêu Hồn', hax_description: 'Đòn đánh bỏ qua 50% giáp DEF của đối thủ.', image_file: 'pets/hoa_diem_ho.png', is_starter: false, is_exclusive_fuyumi: false },
  { pet_type: 'man_da_la_linh_thu', pet_name: 'Mạn Đà La Linh Thú', element: 'Mộc', rarity: 'Tiên Phẩm', rarity_key: 'epic', base_atk: 430, base_def: 360, base_spd: 410, hax_skill: 'Ký Sinh Hút Máu', hax_description: 'Gây thêm sát thương bằng 30% HP hiện tại của địch và hút về bản thân.', image_file: 'pets/man_da_la_linh_thu.png', is_starter: false, is_exclusive_fuyumi: false },
  { pet_type: 'kim_si_dieu_hoang', pet_name: 'Kim Sí Điêu Hoàng', element: 'Kim', rarity: 'Tiên Phẩm', rarity_key: 'epic', base_atk: 470, base_def: 380, base_spd: 520, hax_skill: 'Mù Lòa Thái Dương', hax_description: 'Khiến đối thủ đánh trượt 70% trong 2 hiệp.', image_file: 'pets/kim_si_dieu_hoang.png', is_starter: false, is_exclusive_fuyumi: false },

  // 6 Thần Thoại
  { pet_type: 'chu_tuoc_au_dieu', pet_name: 'Chu Tước Ấu Điểu', element: 'Hỏa', rarity: 'Thần Thoại', rarity_key: 'mythic', base_atk: 520, base_def: 360, base_spd: 480, hax_skill: 'Niết Bàn Tái Sinh', hax_description: 'Hồi sinh với 50% HP tối đa 1 lần mỗi trận.', image_file: 'pets/chu_tuoc_au_dieu.png', is_starter: false, is_exclusive_fuyumi: false },
  { pet_type: 'han_bang_ky_lan', pet_name: 'Hàn Băng Kỳ Lân', element: 'Thủy', rarity: 'Thần Thoại', rarity_key: 'mythic', base_atk: 510, base_def: 480, base_spd: 450, hax_skill: 'Hàn Khí Giáp', hax_description: 'Giảm 40% sát thương nhận từ đòn bạo kích.', image_file: 'pets/han_bang_ky_lan.png', is_starter: false, is_exclusive_fuyumi: false },
  { pet_type: 'loi_dinh_kim_ho', pet_name: 'Lôi Đình Kim Hồ', element: 'Lôi', rarity: 'Thần Thoại', rarity_key: 'mythic', base_atk: 560, base_def: 310, base_spd: 580, hax_skill: 'Lôi Quang Tốc', hax_description: 'Luôn giành quyền xuất chiêu đầu tiên bất kể lực chiến.', image_file: 'pets/loi_dinh_kim_ho.png', is_starter: false, is_exclusive_fuyumi: false },
  { pet_type: 'u_minh_lang_vuong', pet_name: 'U Minh Lang Vương', element: 'Ám', rarity: 'Thần Thoại', rarity_key: 'mythic', base_atk: 540, base_def: 370, base_spd: 490, hax_skill: 'Tuyệt Mệnh Trảm', hax_description: 'HP đối thủ dưới 25% có 50% tỉ lệ kết liễu tức thì.', image_file: 'pets/u_minh_lang_vuong.png', is_starter: false, is_exclusive_fuyumi: false },
  { pet_type: 'tinh_khong_da_thao', pet_name: 'Tinh Không Dạ Thao', element: 'Hư Không', rarity: 'Thần Thoại', rarity_key: 'mythic', base_atk: 500, base_def: 420, base_spd: 510, hax_skill: 'Hư Không Hỗn Loạn', hax_description: '35% xác suất khiến đối thủ hỗn loạn tự tấn công bản thân.', image_file: 'pets/tinh_khong_da_thao.png', is_starter: false, is_exclusive_fuyumi: false },
  { pet_type: 'quang_minh_thanh_thu', pet_name: 'Quang Minh Thánh Thú', element: 'Quang', rarity: 'Thần Thoại', rarity_key: 'mythic', base_atk: 480, base_def: 490, base_spd: 480, hax_skill: 'Thánh Quang Hóa Giải', hax_description: 'Miễn nhiễm 100% mọi hiệu ứng khống chế và HAX bất lợi.', image_file: 'pets/quang_minh_thanh_thu.png', is_starter: false, is_exclusive_fuyumi: false },

  // Độc Quyền Tiểu Thư Fuyumi
  { pet_type: 'cuu_vi_hong_ho', pet_name: 'Cửu Vĩ Hồng Hồ', element: 'Hỗn Độn', rarity: 'Tối Thượng Thần Thoại', rarity_key: 'supreme', base_atk: 99999, base_def: 99999, base_spd: 99999, hax_skill: 'Cửu Vĩ Hộ Thể (HAX Bất Tử)', hax_description: 'Bất tử trước 3 đòn đầu và phản lại 100% sát thương gốc. Độc quyền Tiểu thư Fuyumi.', image_file: 'pets/cuu_vi_hong_ho_transparent.png', is_starter: false, is_exclusive_fuyumi: true },
].map((p) => ({
  ...p,
  drop_rate: p.is_exclusive_fuyumi ? 0 : p.rarity_key === 'mythic' ? 1.0 : p.rarity_key === 'epic' ? 14.0 : p.rarity_key === 'rare' ? 25.0 : 60.0,
  icon: petEmoji(p.pet_type, em('su_fox_mascot')),
  emoji_key: petEmojiKey(p.pet_type),
  element_icon: elementEmoji(p.element),
  base_hp: Math.max(500, 1000 + p.base_def * 5),
  base_power: p.base_atk * 3 + p.base_def * 2 + p.base_spd * 2 + 50,
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
  { item_id: 'gacha_ticket_equip', name: 'Vé Rèn Pháp Bảo', category: 'consumable', price: 50, icon: em('su_ticket_equip'), description: 'Dùng thay 50 Linh Thạch khi quay Gacha Pháp Bảo (/roll).' },
  { item_id: 'gacha_ticket_pet', name: 'Vé Triệu Hồi Linh Thú', category: 'consumable', price: 50, icon: em('su_ticket_pet'), description: 'Dùng thay 50 Linh Thạch khi quay Gacha Linh Thú (/roll).' },
  { item_id: 'pet_star_stone', name: 'Tinh Thạch Nâng Sao', category: 'consumable', price: 100, icon: em('su_star_stone'), description: 'Nguyên liệu đột phá cấp Sao (1 -> 10 Sao) cho Linh Thú (/linhthu).' },
  { item_id: 'title_rename_card', name: 'Thẻ Đổi Danh Hiệu Tu Tiên', category: 'consumable', price: 300, icon: em('su_title_card'), description: 'Đổi danh hiệu hiển thị tùy chỉnh trên /profile.' },
  { item_id: 'frame_unlock_token', name: 'Lệnh Bài Khung Viền Độc Bản', category: 'consumable', price: 800, icon: em('su_frame_token'), description: 'Mở khóa khung viền Avatar đặc biệt trên /profile & /rank.' },
];

export const SHOP_CONSUMABLE_BY_ID = Object.fromEntries(SHOP_CONSUMABLES.map((c) => [c.item_id, c]));

/**
 * Khung viền Avatar có thể mở khóa qua Lệnh Bài Khung Viền Độc Bản
 */
export const AVATAR_FRAMES = [
  { frame_id: 'default', name: 'Khung Mặc Định (Theo Cảnh Giới)', token_required: false, description: 'Tự động nâng cấp khung theo cảnh giới tu luyện.' },
  { frame_id: 'jade_lotus', name: 'Ngọc Bích Liên Hoa', token_required: true, description: 'Viền ngọc bích phát sáng dịu kèm đài hoa sen thanh khiết.' },
  { frame_id: 'amethyst_celestial', name: 'Tử Tinh Huyền Nguyệt', token_required: true, description: 'Viền tử tinh tím thẫm điểm xuyết tinh tú huyền ảo.' },
  { frame_id: 'crimson_phoenix', name: 'Phượng Hoàng Xích Diệm', token_required: true, description: 'Viền xích diệm rực cháy ánh lửa phượng hoàng vàng cam.' },
  { frame_id: 'frost_crystal', name: 'Hàn Băng Lưu Ly', token_required: true, description: 'Viền băng tinh pha lê xanh ngọc lạnh lẽo sắc bén.' },
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
 * đồng thời nằm ở nhóm Phàm Phẩm (60%) trong Gacha Role (/roll loai:role).
 */
export const SHOP_ROLE_PACKAGES = [
  { role_id: '1573186019858317422', name: '« Linh Âm Hồ Ca »', rarity: 'Phàm Phẩm', rarity_key: 'common', perk: `${em('su_sparkle')} Triệu Hồi Hát Live & Tâm Sự`, prices: { '7d': 220, '30d': 700, permanent: 2200 } },
  { role_id: '1573186024048173076', name: '« Phong Thanh Hộ Pháp »', rarity: 'Phàm Phẩm', rarity_key: 'common', perk: `${em('su_arena')} Quyền Di Chuyển Voice`, prices: { '7d': 350, '30d': 1100, permanent: 3500 } },
  { role_id: '1573186028196462613', name: '« Lôi Âm Tôn Giả »', rarity: 'Phàm Phẩm', rarity_key: 'common', perk: `${em('su_thunder_hax')} Quyền Ưu Tiên Nói Voice`, prices: { '7d': 200, '30d': 650, permanent: 2000 } },
  { role_id: '1573186032289980416', name: '« Tịch Tĩnh Tán Nhân »', rarity: 'Phàm Phẩm', rarity_key: 'common', perk: `${em('su_shield_def')} Quyền Tắt Tiếng Voice`, prices: { '7d': 350, '30d': 1100, permanent: 3500 } },
  { role_id: '1573186036585201726', name: '« Bế Tức Chân Nhân »', rarity: 'Phàm Phẩm', rarity_key: 'common', perk: `${em('su_shield_def')} Quyền Tắt Tai Nghe Voice`, prices: { '7d': 350, '30d': 1100, permanent: 3500 } },
  { role_id: '1573186040716468316', name: '« Huyễn Diện Đạo Quân »', rarity: 'Phàm Phẩm', rarity_key: 'common', perk: `${em('su_title_card')} Tự Do Đổi Biệt Danh`, prices: { '7d': 180, '30d': 600, permanent: 1800 } },
  { role_id: '1573186045468614687', name: '« Định Danh Sứ Giả »', rarity: 'Phàm Phẩm', rarity_key: 'common', perk: `${em('su_title_card')} Quản Lý Biệt Danh`, prices: { '7d': 320, '30d': 1000, permanent: 3200 } },
  { role_id: '1573186049289756712', name: '« Thần Hành Cốt Cách »', rarity: 'Phàm Phẩm', rarity_key: 'common', perk: `${em('su_thunder_hax')} Miễn Chờ Chat Chậm`, prices: { '7d': 150, '30d': 500, permanent: 1500 } },
  { role_id: '1573186053500833802', name: '« Họa Đồ Linh Sư »', rarity: 'Phàm Phẩm', rarity_key: 'common', perk: `${em('su_sakura')} Đăng Ảnh Kênh Giới Hạn`, prices: { '7d': 150, '30d': 500, permanent: 1500 } },
  { role_id: '1573186057778888745', name: '« Vạn Tượng Linh Hồ »', rarity: 'Phàm Phẩm', rarity_key: 'common', perk: `${em('su_sparkle')} Dùng Emoji Ngoại Server`, prices: { '7d': 200, '30d': 650, permanent: 2000 } },
  { role_id: '1573186061860077568', name: '« Thần Phù Thượng Quan »', rarity: 'Phàm Phẩm', rarity_key: 'common', perk: `${em('su_realm_star')} Dùng Sticker Ngoại`, prices: { '7d': 150, '30d': 500, permanent: 1500 } },
  { role_id: '1573186066134073394', name: '« Khai Sơn Tiên Phong »', rarity: 'Phàm Phẩm', rarity_key: 'common', perk: `${em('su_wiki_scroll')} Tạo Chủ Đề Công Khai`, prices: { '7d': 120, '30d': 400, permanent: 1200 } },
  { role_id: '1573186070206742578', name: '« Mật Tàng Hộ Vệ »', rarity: 'Phàm Phẩm', rarity_key: 'common', perk: `${em('su_wiki_scroll')} Tạo Chủ Đề Kín`, prices: { '7d': 140, '30d': 450, permanent: 1400 } },
  { role_id: '1573186074153324608', name: '« Trấn Thư Pháp Vương »', rarity: 'Phàm Phẩm', rarity_key: 'common', perk: `${em('su_pin_sigil')} Quyền Ghim Tin Nhắn`, prices: { '7d': 220, '30d': 720, permanent: 2200 } },
  { role_id: '1573186078402158776', name: '« Huyễn Âm Tiên Cô »', rarity: 'Phàm Phẩm', rarity_key: 'common', perk: `${em('su_medal_role')} Dùng Bảng Âm Thanh`, prices: { '7d': 150, '30d': 500, permanent: 1500 } },
  { role_id: '1573186082768560198', name: '« Cửu Châu Diễn Âm »', rarity: 'Phàm Phẩm', rarity_key: 'common', perk: `${em('su_medal_role')} Dùng Âm Ngoại Server`, prices: { '7d': 180, '30d': 600, permanent: 1800 } },
  { role_id: '1573186087088554085', name: '« Linh Hồn Tu Luyện »', rarity: 'Phàm Phẩm', rarity_key: 'common', perk: `${em('su_level_up')} Buff +15% EXP Solo`, prices: { '7d': 400, '30d': 1200, permanent: 4000 } },
  { role_id: '1573186091094245416', name: '« Tài Vận Hanh Thông »', rarity: 'Phàm Phẩm', rarity_key: 'common', perk: `${em('su_linhthach')} Buff +20% Linh Thạch`, prices: { '7d': 450, '30d': 1400, permanent: 4500 } },
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
  { role_id: '1573577773279219763', name: '« Song Tuyệt Kiếm Khách »', rarity: 'Linh Phẩm', rarity_key: 'rare', perk: '⚡📌 Miễn Slowmode & Ghim Tin Nhắn', prices: { '7d': 500, '30d': 1600, permanent: 5000 } },
  { role_id: '1573577776454434899', name: '« Huyễn Ảnh Linh Tôn »', rarity: 'Linh Phẩm', rarity_key: 'rare', perk: '🎭✨ Đổi Nick, Emoji/Sticker Ngoại & +10% EXP', prices: { '7d': 500, '30d': 1600, permanent: 5000 } },
  { role_id: '1573577779621138542', name: '« Lôi Vũ Hộ Pháp »', rarity: 'Linh Phẩm', rarity_key: 'rare', perk: '🎙️📢 Di Chuyển & Ưu Tiên Nói Voice', prices: { '7d': 500, '30d': 1600, permanent: 5000 } },
  { role_id: '1573577782380728410', name: '« Hàn Ngọc Tiên Tử »', rarity: 'Linh Phẩm', rarity_key: 'rare', perk: '📺🔊 Stream HD, Soundboard Ngoại & +10% Daily LT', prices: { '7d': 500, '30d': 1600, permanent: 5000 } },
  { role_id: '1573577786218651688', name: '« Mật Các Trưởng Lão »', rarity: 'Linh Phẩm', rarity_key: 'rare', perk: '💬👁️ Thread Kín/Mở, Kênh Ẩn & +12% EXP', prices: { '7d': 500, '30d': 1600, permanent: 5000 } },
  { role_id: '1573577788965781504', name: '« Kim Tiền Đạo Nhân »', rarity: 'Linh Phẩm', rarity_key: 'rare', perk: '💎🏷️ Buff +25% Daily LT & Giảm 5% Giá Shop', prices: { '7d': 500, '30d': 1600, permanent: 5000 } },
  { role_id: '1573577794091225108', name: '« Chiến Hồn Tiên Phong »', rarity: 'Linh Phẩm', rarity_key: 'rare', perk: '⚔️⚡ Buff +8% Chiến Lực Pet & Miễn Slowmode', prices: { '7d': 500, '30d': 1600, permanent: 5000 } },
  { role_id: '1573577796742152314', name: '« Thiên Âm Nhạc Sư »', rarity: 'Linh Phẩm', rarity_key: 'rare', perk: '🎵📢 Ưu Tiên Voice, Âm Ngoại & +12% EXP', prices: { '7d': 500, '30d': 1600, permanent: 5000 } },
  // 6 Role Tiên Phẩm (14% — 3–4 chức năng)
  { role_id: '1573577799539892314', name: '« Cửu Tiêu Phong Vương »', rarity: 'Tiên Phẩm', rarity_key: 'epic', perk: '🌬️🔇 Move/Mute Voice, Miễn Slowmode & +20% EXP', prices: { '7d': 1000, '30d': 3200, permanent: 10000 } },
  { role_id: '1573577805286080523', name: '« Thái Hư Chân Quân »', rarity: 'Tiên Phẩm', rarity_key: 'epic', perk: '🏷️📌 Quản Lý Nick, Ghim Tin, Thread Kín & +20% Daily LT', prices: { '7d': 1000, '30d': 3200, permanent: 10000 } },
  { role_id: '1573577808867762186', name: '« Vạn Bảo Tài Thần »', rarity: 'Tiên Phẩm', rarity_key: 'epic', perk: '💰✨ +35% Daily LT, Giảm 10% Shop/Roll & Emoji/Sticker', prices: { '7d': 1000, '30d': 3200, permanent: 10000 } },
  { role_id: '1573577811786993756', name: '« Bát Hoang Chiến Thần »', rarity: 'Tiên Phẩm', rarity_key: 'epic', perk: '🔥⚔️ +15% Chiến Lực Pet, +20% EXP, Ghim & Slowmode', prices: { '7d': 1000, '30d': 3200, permanent: 10000 } },
  { role_id: '1573577814437789797', name: '« Hồng Trần Tiên Lữ »', rarity: 'Tiên Phẩm', rarity_key: 'epic', perk: '🌸💫 +25% EXP, +10% Chiến Lực, Stream HD & Sound/Emoji', prices: { '7d': 1000, '30d': 3200, permanent: 10000 } },
  { role_id: '1573577816690401401', name: '« Tinh Hà Pháp Vương »', rarity: 'Tiên Phẩm', rarity_key: 'epic', perk: '🌌🛡️ Move/Mute/Deafen Voice, Ghim Tin & +25% EXP', prices: { '7d': 1000, '30d': 3200, permanent: 10000 } },
];

/**
 * 5 Role Tối Thượng Thần Thoại (1% — 5+ chức năng) trong Gacha Role
 */
export const SUPREME_ROLES = [
  { role_id: '1573185998857183253', name: '« Cửu Vĩ Tối Thượng Thần Hồ »', rarity: 'Thần Thoại', rarity_key: 'mythic', perk: '🛡️ Kháng Timeout, Full Voice/Chat, +70% EXP/LT & +25% Pet', prices: { '7d': 2500, '30d': 8000, permanent: 25000 } },
  { role_id: '1573186003101941830', name: '« SuMi Đệ Nhất Khách Tôn »', rarity: 'Thần Thoại', rarity_key: 'mythic', perk: '👑 Quản Trị Voice/Chat, +60% EXP/LT & +20% Pet', prices: { '7d': 2500, '30d': 8000, permanent: 25000 } },
  { role_id: '1573186007262695644', name: '« Vạn Cổ Chí Tôn »', rarity: 'Thần Thoại', rarity_key: 'mythic', perk: '🌌 Bá Chủ Voice/Thread, +50% EXP/LT & +18% Pet', prices: { '7d': 2500, '30d': 8000, permanent: 25000 } },
  { role_id: '1573186011478102096', name: '« Sáng Thế Thần Quân »', rarity: 'Thần Thoại', rarity_key: 'mythic', perk: '✨ Full Voice/Thread, Buff x2.5 Daily LT & Giảm 15% Shop', prices: { '7d': 2500, '30d': 8000, permanent: 25000 } },
  { role_id: '1573186015785521265', name: '« Cửu Vĩ Yêu Hậu »', rarity: 'Thần Thoại', rarity_key: 'mythic', perk: '🌸 Huy Hiệu Độc Tôn, Buff +80% EXP & +15% Chiến Lực Pet', prices: { '7d': 2500, '30d': 8000, permanent: 25000 } },
];

export const GACHA_ROLE_CATALOG = [
  ...SHOP_ROLE_PACKAGES,
  ...MULTI_PERK_ROLES,
  ...SUPREME_ROLES,
];

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
  { level: 15, expPct: 5, dailyLtPct: 0, petPowerPct: 0, label: '« 15・Linh Cáo Học Giả »' },
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
