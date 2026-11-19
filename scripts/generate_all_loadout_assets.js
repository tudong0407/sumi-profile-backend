import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { renderWeapon } from './asset_generator_weapons.js';
import { renderGem } from './asset_generator_gems.js';
import { renderSoul } from './asset_generator_souls.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../');
const ITEMS_DIR = path.join(PROJECT_ROOT, 'assets', 'items');

if (!fs.existsSync(ITEMS_DIR)) {
  fs.mkdirSync(ITEMS_DIR, { recursive: true });
}

export const ALL_45_ITEMS = [
  // 15 Vũ Khí (Weapons)
  { item_id: 'weapon_common_1', item_name: 'Thiết Mộc Trọng Kiếm', item_type: 'weapon', rarity: 'Pham Pham', element: 'Kim', icon: '🗡️' },
  { item_id: 'weapon_common_2', item_name: 'Thanh Trúc Linh Cung', item_type: 'weapon', rarity: 'Pham Pham', element: 'Moc', icon: '🏹' },
  { item_id: 'weapon_common_3', item_name: 'Hắc Thiết Song Đao', item_type: 'weapon', rarity: 'Pham Pham', element: 'Hoa', icon: '⚔️' },
  { item_id: 'weapon_common_4', item_name: 'Toái Thạch Cự Phủ', item_type: 'weapon', rarity: 'Pham Pham', element: 'Tho', icon: '🪓' },
  { item_id: 'weapon_rare_1', item_name: 'Tử Điện Lôi Minh Thương', item_type: 'weapon', rarity: 'Linh Pham', element: 'Loi', icon: '🔱' },
  { item_id: 'weapon_rare_2', item_name: 'U Hỏa Nhiễm Huyết Kiếm', item_type: 'weapon', rarity: 'Linh Pham', element: 'Hoa', icon: '🗡️' },
  { item_id: 'weapon_rare_3', item_name: 'Hàn Băng Thần Châm', item_type: 'weapon', rarity: 'Linh Pham', element: 'Thuy', icon: '🪡' },
  { item_id: 'weapon_rare_4', item_name: 'Bạch Hạc Vũ Phiến', item_type: 'weapon', rarity: 'Linh Pham', element: 'Quang', icon: '🪭' },
  { item_id: 'weapon_epic_1', item_name: 'Thần Mộc Thiên Cương Trượng', item_type: 'weapon', rarity: 'Tien Pham', element: 'Moc', icon: '🦯' },
  { item_id: 'weapon_epic_2', item_name: 'Vạn Kiếp Huyết Ma Đao', item_type: 'weapon', rarity: 'Tien Pham', element: 'Am', icon: '🗡️' },
  { item_id: 'weapon_epic_3', item_name: 'Cực Băng Huyền Minh Cung', item_type: 'weapon', rarity: 'Tien Pham', element: 'Thuy', icon: '🏹' },
  { item_id: 'weapon_epic_4', item_name: 'Thái Hư Trảm Tiên Kiếm', item_type: 'weapon', rarity: 'Tien Pham', element: 'Kim', icon: '⚔️' },
  { item_id: 'weapon_mythic_1', item_name: '« Tru Tiên Diệt Thần Kiếm »', item_type: 'weapon', rarity: 'Than Thoai', element: 'Kim', icon: '⚔️' },
  { item_id: 'weapon_mythic_2', item_name: '« Cửu Thiên Lôi Đình Cổ Thần Thương »', item_type: 'weapon', rarity: 'Than Thoai', element: 'Loi', icon: '🔱' },
  { item_id: 'weapon_mythic_3', item_name: '« Hồng Mông Hỗn Độn Trượng »', item_type: 'weapon', rarity: 'Than Thoai', element: 'Hon Don', icon: '🦯' },

  // 15 Bảo Ngọc (Gems)
  { item_id: 'gem_common_1', item_name: 'Thanh Linh Ngọc', item_type: 'gem', rarity: 'Pham Pham', element: 'Moc', icon: '💎' },
  { item_id: 'gem_common_2', item_name: 'Hỏa Tinh Thạch', item_type: 'gem', rarity: 'Pham Pham', element: 'Hoa', icon: '🔥' },
  { item_id: 'gem_common_3', item_name: 'Hoàng Thổ Bích', item_type: 'gem', rarity: 'Pham Pham', element: 'Tho', icon: '🪨' },
  { item_id: 'gem_common_4', item_name: 'Lam Thủy Châu', item_type: 'gem', rarity: 'Pham Pham', element: 'Thuy', icon: '💧' },
  { item_id: 'gem_rare_1', item_name: 'Huyền Quy Hộ Tâm Kính', item_type: 'gem', rarity: 'Linh Pham', element: 'Thuy', icon: '🐢' },
  { item_id: 'gem_rare_2', item_name: 'Phù Dung Lưu Ly Bảo Ngọc', item_type: 'gem', rarity: 'Linh Pham', element: 'Moc', icon: '🌸' },
  { item_id: 'gem_rare_3', item_name: 'Tử Kim Thần Thuẫn Thạch', item_type: 'gem', rarity: 'Linh Pham', element: 'Kim', icon: '🛡️' },
  { item_id: 'gem_rare_4', item_name: 'Bích Hải Triều Sinh Châu', item_type: 'gem', rarity: 'Linh Pham', element: 'Thuy', icon: '🌊' },
  { item_id: 'gem_epic_1', item_name: 'Cửu Tiêu Bất Diệt Ngọc', item_type: 'gem', rarity: 'Tien Pham', element: 'Kim', icon: '✨' },
  { item_id: 'gem_epic_2', item_name: 'Vạn Niên Hàn Băng Châu', item_type: 'gem', rarity: 'Tien Pham', element: 'Thuy', icon: '❄️' },
  { item_id: 'gem_epic_3', item_name: 'Thái Cực Bát Quái Ngọc Bội', item_type: 'gem', rarity: 'Tien Pham', element: 'Quang', icon: '☯️' },
  { item_id: 'gem_epic_4', item_name: 'Phượng Hoàng Huyết Tinh', item_type: 'gem', rarity: 'Tien Pham', element: 'Hoa', icon: '🩸' },
  { item_id: 'gem_mythic_1', item_name: '« Bất Hủ Thần Hoàng Ngọc »', item_type: 'gem', rarity: 'Than Thoai', element: 'Tho', icon: '👑' },
  { item_id: 'gem_mythic_2', item_name: '« Vạn Tượng Quy Nhất Châu »', item_type: 'gem', rarity: 'Than Thoai', element: 'Quang', icon: '🔮' },
  { item_id: 'gem_mythic_3', item_name: '« Thiên Hồ Hóa Thần Ngọc »', item_type: 'gem', rarity: 'Than Thoai', element: 'Hon Don', icon: '🦊' },

  // 15 Chiến Hồn (Souls)
  { item_id: 'soul_common_1', item_name: 'Dã Lang Chiến Hồn', item_type: 'soul', rarity: 'Pham Pham', element: 'Am', icon: '🐺' },
  { item_id: 'soul_common_2', item_name: 'Thanh Phong Linh Hồn', item_type: 'soul', rarity: 'Pham Pham', element: 'Moc', icon: '🍃' },
  { item_id: 'soul_common_3', item_name: 'Linh Hồ Ấu Hồn', item_type: 'soul', rarity: 'Pham Pham', element: 'Quang', icon: '🐾' },
  { item_id: 'soul_common_4', item_name: 'Man Ngưu Thú Hồn', item_type: 'soul', rarity: 'Pham Pham', element: 'Tho', icon: '🐂' },
  { item_id: 'soul_rare_1', item_name: 'Tấn Lôi Ưng Hồn', item_type: 'soul', rarity: 'Linh Pham', element: 'Loi', icon: '🦅' },
  { item_id: 'soul_rare_2', item_name: 'Minh Giới U Hồn', item_type: 'soul', rarity: 'Linh Pham', element: 'Am', icon: '👻' },
  { item_id: 'soul_rare_3', item_name: 'Cuồng Bạo Hùng Hồn', item_type: 'soul', rarity: 'Linh Pham', element: 'Tho', icon: '🐻' },
  { item_id: 'soul_rare_4', item_name: 'Thải Điệp Mộng Hồn', item_type: 'soul', rarity: 'Linh Pham', element: 'Moc', icon: '🦋' },
  { item_id: 'soul_epic_1', item_name: 'Thương Khung Thần Long Hồn', item_type: 'soul', rarity: 'Tien Pham', element: 'Quang', icon: '🐉' },
  { item_id: 'soul_epic_2', item_name: 'Cửu U Minh Xà Hồn', item_type: 'soul', rarity: 'Tien Pham', element: 'Am', icon: '🐍' },
  { item_id: 'soul_epic_3', item_name: 'Thánh Quang Kỳ Lân Hồn', item_type: 'soul', rarity: 'Tien Pham', element: 'Quang', icon: '🦄' },
  { item_id: 'soul_epic_4', item_name: 'Huyết Ngục Ma Lang Hồn', item_type: 'soul', rarity: 'Tien Pham', element: 'Hoa', icon: '🐺' },
  { item_id: 'soul_mythic_1', item_name: '« Cửu Vĩ Thiên Tiên Hồn »', item_type: 'soul', rarity: 'Than Thoai', element: 'Hon Don', icon: '🦊' },
  { item_id: 'soul_mythic_2', item_name: '« Thái Sơ Thời Không Ma Thần Hồn »', item_type: 'soul', rarity: 'Than Thoai', element: 'Khong Gian', icon: '⏳' },
  { item_id: 'soul_mythic_3', item_name: '« Luân Hồi Bất Diệt Chiến Hồn »', item_type: 'soul', rarity: 'Than Thoai', element: 'Luan Hoi', icon: '🔄' }
];

async function generateAll() {
  console.log(`[ItemGen] Bắt đầu sinh 45 ảnh trang bị loadout vào thư mục: ${ITEMS_DIR}`);
  const startTime = Date.now();

  let count = 0;
  for (const item of ALL_45_ITEMS) {
    const outFile = path.join(ITEMS_DIR, `${item.item_id}.png`);
    let buf;
    if (item.item_type === 'weapon') {
      buf = renderWeapon(item, outFile);
    } else if (item.item_type === 'gem') {
      buf = renderGem(item, outFile);
    } else if (item.item_type === 'soul') {
      buf = renderSoul(item, outFile);
    }
    fs.writeFileSync(outFile, buf);
    count++;
    console.log(`[ItemGen] [${count}/45] Đã tạo thành công: ${item.item_id}.png (${item.item_name} - ${item.rarity} - ${item.element}) - Size: ${buf.length} bytes`);
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n======================================================`);
  console.log(`[ItemGen] Hoàn tất 100%! Đã sinh đủ ${count}/45 file PNG trong ${duration}s.`);
  console.log(`======================================================`);
}

generateAll().catch(err => {
  console.error('[ItemGen] Lỗi khi sinh ảnh:', err);
  process.exit(1);
});
