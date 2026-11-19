import pg from 'pg';
import fs from 'fs';

const { Client } = pg;

const password = 'TXU4k3VtkkFMAKl7';
const projectRef = 'lfvtysacdoadtvskqgkt';

const connectionString = `postgresql://postgres:${encodeURIComponent(password)}@db.${projectRef}.supabase.co:5432/postgres`;

const sql = `
-- 1. Bảng Danh Mục Vật Phẩm Trang Bị
CREATE TABLE IF NOT EXISTS pet_items (
    item_id VARCHAR(50) PRIMARY KEY,
    item_name VARCHAR(100) NOT NULL,
    item_type VARCHAR(30) NOT NULL, -- 'weapon', 'gem', 'soul'
    rarity VARCHAR(30) NOT NULL,    -- 'Pham Pham', 'Linh Pham', 'Tien Pham', 'Than Thoai'
    element VARCHAR(30) NOT NULL,
    bonus_atk INT DEFAULT 0,
    bonus_def INT DEFAULT 0,
    bonus_spd INT DEFAULT 0,
    bonus_hp INT DEFAULT 0,
    bonus_crit NUMERIC(5,2) DEFAULT 0,
    hax_skill VARCHAR(100) DEFAULT NULL,
    hax_description TEXT DEFAULT NULL,
    drop_rate NUMERIC(5,2) NOT NULL, -- 60.0, 25.0, 14.0, 1.0
    icon VARCHAR(10) DEFAULT '⚔️'
);

-- 2. Bảng Túi Đồ & Trang Bị Của Người Chơi
CREATE TABLE IF NOT EXISTS user_pet_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(32) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    item_id VARCHAR(50) NOT NULL REFERENCES pet_items(item_id),
    equipped_to_pet VARCHAR(50) DEFAULT NULL, -- NULL nếu trong túi, hoặc mã pet đang đeo
    slot VARCHAR(20) DEFAULT NULL,            -- 'weapon', 'gem', 'soul'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. View Tổng Hợp Trang Bị Của Người Chơi
CREATE OR REPLACE VIEW v_user_equipped_items AS
SELECT 
    upi.id AS user_item_id,
    upi.user_id,
    upi.equipped_to_pet,
    upi.slot,
    pi.item_id,
    pi.item_name,
    pi.item_type,
    pi.rarity,
    pi.element,
    pi.bonus_atk,
    pi.bonus_def,
    pi.bonus_spd,
    pi.bonus_hp,
    pi.bonus_crit,
    pi.hax_skill,
    pi.hax_description,
    pi.icon
FROM user_pet_items upi
JOIN pet_items pi ON upi.item_id = pi.item_id;

-- 4. Seed Danh Sách 45 Món Trang Bị Chuẩn
INSERT INTO pet_items (item_id, item_name, item_type, rarity, element, bonus_atk, bonus_def, bonus_spd, bonus_hp, bonus_crit, hax_skill, hax_description, drop_rate, icon) VALUES
-- 15 Vũ Khí (Weapons)
('weapon_common_1', 'Thiết Mộc Trọng Kiếm', 'weapon', 'Pham Pham', 'Kim', 150, 0, 0, 0, 5.0, NULL, NULL, 60.0, '🗡️'),
('weapon_common_2', 'Thanh Trúc Linh Cung', 'weapon', 'Pham Pham', 'Moc', 120, 0, 50, 0, 0.0, NULL, 'Tăng nhẹ tốc xuất chiêu', 60.0, '🏹'),
('weapon_common_3', 'Hắc Thiết Song Đao', 'weapon', 'Pham Pham', 'Hoa', 140, 0, 30, 0, 0.0, NULL, 'Đòn đánh thường đánh nhanh', 60.0, '⚔️'),
('weapon_common_4', 'Toái Thạch Cự Phủ', 'weapon', 'Pham Pham', 'Tho', 160, 80, -20, 0, 0.0, NULL, 'Nặng nề nhưng đầm tay', 60.0, '🪓'),
('weapon_rare_1', 'Tử Điện Lôi Minh Thương', 'weapon', 'Linh Pham', 'Loi', 320, 0, 0, 0, 8.0, NULL, '15% tỉ lệ gây Tê Liệt (mất lượt)', 25.0, '🔱'),
('weapon_rare_2', 'U Hỏa Nhiễm Huyết Kiếm', 'weapon', 'Linh Pham', 'Hoa', 350, 0, 0, 0, 0.0, NULL, 'Gây Thiêu Đốt rút 5% HP địch mỗi hiệp', 25.0, '🗡️'),
('weapon_rare_3', 'Hàn Băng Thần Châm', 'weapon', 'Linh Pham', 'Thuy', 280, 0, 120, 0, 0.0, NULL, 'Giảm 10% Tốc độ của đối thủ', 25.0, '🪡'),
('weapon_rare_4', 'Bạch Hạc Vũ Phiến', 'weapon', 'Linh Pham', 'Quang', 300, 150, 0, 0, 0.0, NULL, 'Tăng 10% tỉ lệ né tránh sát thương', 25.0, '🪭'),
('weapon_epic_1', 'Thần Mộc Thiên Cương Trượng', 'weapon', 'Tien Pham', 'Moc', 600, 200, 0, 0, 0.0, NULL, 'Hồi máu bằng 15% sát thương gây ra', 14.0, '🦯'),
('weapon_epic_2', 'Vạn Kiếp Huyết Ma Đao', 'weapon', 'Tien Pham', 'Am', 680, 0, 0, 0, 15.0, NULL, 'Sát thương bạo kích tăng lên x2.2', 14.0, '🗡️'),
('weapon_epic_3', 'Cực Băng Huyền Minh Cung', 'weapon', 'Tien Pham', 'Thuy', 620, 0, 250, 0, 0.0, NULL, '25% tỉ lệ Đóng Băng đối thủ 1 lượt', 14.0, '🏹'),
('weapon_epic_4', 'Thái Hư Trảm Tiên Kiếm', 'weapon', 'Tien Pham', 'Kim', 650, 0, 0, 0, 0.0, NULL, 'Bỏ qua 30% giáp DEF của mục tiêu', 14.0, '⚔️'),
('weapon_mythic_1', '« Tru Tiên Diệt Thần Kiếm »', 'weapon', 'Than Thoai', 'Kim', 720, 0, 300, 0, 18.0, 'Tuyệt Diệt Bất Tử', 'Đòn đánh xuyên qua 100% khiên chắn và vô hiệu hóa hoàn toàn cơ chế Bất Tử / Trùng Sinh của đối phương trong 3 lượt đầu!', 1.0, '⚔️'),
('weapon_mythic_2', '« Cửu Thiên Lôi Đình Cổ Thần Thương »', 'weapon', 'Than Thoai', 'Loi', 740, 280, 320, 0, 0.0, 'Lôi Thần Trấn Áp', 'Khai trận triệu hồi thiên lôi cướp đoạt 40% Tốc SPD của đối thủ chuyển thành ATK cho pet của mình suốt trận!', 1.0, '🔱'),
('weapon_mythic_3', '« Hồng Mông Hỗn Độn Trượng »', 'weapon', 'Than Thoai', 'Hon Don', 750, 350, 300, 0, 0.0, 'Hỗn Độn Nghịch Đảo', '35% xác suất mỗi khi ra đòn sẽ chuyển toàn bộ sát thương của đối thủ thành máu hồi phục cho bản thân, đồng thời phản đòn 100%!', 1.0, '🦯'),

-- 15 Bảo Ngọc (Gems)
('gem_common_1', 'Thanh Linh Ngọc', 'gem', 'Pham Pham', 'Moc', 0, 120, 0, 500, 0.0, NULL, 'Hồi máu nhẹ sau trận', 60.0, '💎'),
('gem_common_2', 'Hỏa Tinh Thạch', 'gem', 'Pham Pham', 'Hoa', 80, 80, 0, 0, 0.0, NULL, 'Kháng hiệu ứng bỏng 20%', 60.0, '🔥'),
('gem_common_3', 'Hoàng Thổ Bích', 'gem', 'Pham Pham', 'Tho', 0, 150, 0, 300, 0.0, NULL, 'Gia cố lớp phòng ngự', 60.0, '🪨'),
('gem_common_4', 'Lam Thủy Châu', 'gem', 'Pham Pham', 'Thuy', 0, 100, 0, 600, 0.0, NULL, 'Mát mẻ dịu êm', 60.0, '💧'),
('gem_rare_1', 'Huyền Quy Hộ Tâm Kính', 'gem', 'Linh Pham', 'Thuy', 0, 320, 0, 1500, 0.0, NULL, 'Giảm 10% sát thương nhận từ bạo kích', 25.0, '🐢'),
('gem_rare_2', 'Phù Dung Lưu Ly Bảo Ngọc', 'gem', 'Linh Pham', 'Moc', 0, 280, 0, 1800, 0.0, NULL, 'Hồi phục 5% HP tối đa mỗi hiệp đấu', 25.0, '🌸'),
('gem_rare_3', 'Tử Kim Thần Thuẫn Thạch', 'gem', 'Linh Pham', 'Kim', 0, 350, 0, 1200, 0.0, NULL, 'Đầu trận nhận 1 lớp khiên 800 HP', 25.0, '🛡️'),
('gem_rare_4', 'Bích Hải Triều Sinh Châu', 'gem', 'Linh Pham', 'Thuy', 0, 300, 0, 2000, 0.0, NULL, 'Kháng 30% hiệu ứng làm chậm & khống chế', 25.0, '🌊'),
('gem_epic_1', 'Cửu Tiêu Bất Diệt Ngọc', 'gem', 'Tien Pham', 'Kim', 0, 650, 0, 4000, 0.0, NULL, 'Giảm cố định 25% toàn bộ sát thương gánh chịu', 14.0, '✨'),
('gem_epic_2', 'Vạn Niên Hàn Băng Châu', 'gem', 'Tien Pham', 'Thuy', 0, 620, 0, 3800, 0.0, NULL, 'Khi bị tấn công, phản lại 30% sát thương băng', 14.0, '❄️'),
('gem_epic_3', 'Thái Cực Bát Quái Ngọc Bội', 'gem', 'Tien Pham', 'Quang', 0, 680, 0, 4200, 0.0, NULL, 'Miễn dịch 50% mọi trạng thái khống chế', 14.0, '☯️'),
('gem_epic_4', 'Phượng Hoàng Huyết Tinh', 'gem', 'Tien Pham', 'Hoa', 0, 600, 0, 4500, 0.0, NULL, 'Máu dưới 30% tự động hồi 35% HP (1 lần/trận)', 14.0, '🩸'),
('gem_mythic_1', '« Bất Hủ Thần Hoàng Ngọc »', 'gem', 'Than Thoai', 'Tho', 200, 720, 0, 4800, 0.0, 'Kim Thân Hộ Mệnh', 'Khi chịu đòn đánh chí tử dẫn đến tử vong, chặn đứng cái chết giữ lại 1 HP và miễn nhiễm 100% sát thương trong 2 lượt tiếp theo!', 1.0, '👑'),
('gem_mythic_2', '« Vạn Tượng Quy Nhất Châu »', 'gem', 'Than Thoai', 'Quang', 0, 730, 250, 4600, 0.0, 'Kính Hoa Thủy Nguyệt', 'Chuyển hóa 75% toàn bộ sát thương nhận vào thành sát thương phản phệ dội ngược lại đối thủ (bỏ qua giáp DEF của địch)!', 1.0, '🔮'),
('gem_mythic_3', '« Thiên Hồ Hóa Thần Ngọc »', 'gem', 'Than Thoai', 'Hon Don', 0, 750, 200, 5000, 0.0, 'Thần Hồ Diễm Hộ', 'Đầu trận tạo khiên hộ thể bằng 100% máu tối đa; khi khiên còn tồn tại, mọi đòn tấn công của đối phương bị giảm 50% uy lực!', 1.0, '🦊'),

-- 15 Chiến Hồn (Souls)
('soul_common_1', 'Dã Lang Chiến Hồn', 'soul', 'Pham Pham', 'Am', 50, 0, 60, 0, 0.0, NULL, 'Tăng nhẹ tốc độ di chuyển', 60.0, '🐺'),
('soul_common_2', 'Thanh Phong Linh Hồn', 'soul', 'Pham Pham', 'Moc', 0, 30, 80, 0, 0.0, NULL, 'Thân pháp nhẹ nhàng uyển chuyển', 60.0, '🍃'),
('soul_common_3', 'Linh Hồ Ấu Hồn', 'soul', 'Pham Pham', 'Quang', 40, 0, 70, 0, 0.0, NULL, 'Cắt đuôi đối thủ', 60.0, '🐾'),
('soul_common_4', 'Man Ngưu Thú Hồn', 'soul', 'Pham Pham', 'Tho', 0, 100, 40, 0, 0.0, NULL, 'Chân đứng vững chãi', 60.0, '🐂'),
('soul_rare_1', 'Tấn Lôi Ưng Hồn', 'soul', 'Linh Pham', 'Loi', 100, 0, 180, 0, 0.0, NULL, 'Tăng 15% tỉ lệ ra đòn trước tiên', 25.0, '🦅'),
('soul_rare_2', 'Minh Giới U Hồn', 'soul', 'Linh Pham', 'Am', 0, 120, 150, 0, 0.0, NULL, 'Đòn đánh hút 10% máu đối thủ', 25.0, '👻'),
('soul_rare_3', 'Cuồng Bạo Hùng Hồn', 'soul', 'Linh Pham', 'Tho', 200, 0, 130, 0, 0.0, NULL, 'Càng ít máu thì đòn đánh càng đau', 25.0, '🐻'),
('soul_rare_4', 'Thải Điệp Mộng Hồn', 'soul', 'Linh Pham', 'Moc', 0, 80, 190, 0, 0.0, NULL, '15% xác suất ru ngủ đối phương 1 hiệp', 25.0, '🦋'),
('soul_epic_1', 'Thương Khung Thần Long Hồn', 'soul', 'Tien Pham', 'Quang', 300, 200, 380, 0, 0.0, NULL, 'Mỗi hiệp đấu tăng vĩnh viễn 5% ATK (cộng dồn 5 lần)', 14.0, '🐉'),
('soul_epic_2', 'Cửu U Minh Xà Hồn', 'soul', 'Tien Pham', 'Am', 250, 0, 400, 0, 0.0, NULL, 'Đầu trận tẩm Kịch Độc rút 8% HP tối đa của địch mỗi lượt', 14.0, '🐍'),
('soul_epic_3', 'Thánh Quang Kỳ Lân Hồn', 'soul', 'Tien Pham', 'Quang', 0, 400, 360, 0, 0.0, NULL, 'Tự động hóa giải 1 hiệu ứng xấu mỗi hiệp', 14.0, '🦄'),
('soul_epic_4', 'Huyết Ngục Ma Lang Hồn', 'soul', 'Tien Pham', 'Hoa', 320, 0, 420, 0, 0.0, NULL, 'Hút máu bằng 25% sát thương gây ra', 14.0, '🐺'),
('soul_mythic_1', '« Cửu Vĩ Thiên Tiên Hồn »', 'soul', 'Than Thoai', 'Hon Don', 350, 300, 450, 0, 0.0, 'Mị Hoặc Chúng Sinh', 'Mỗi hiệp đấu có 40% xác suất Mị Hoặc đối thủ, ép nó tự tung đòn đánh mạnh nhất vào chính bản thân nó thay vì đánh Pet!', 1.0, '🦊'),
('soul_mythic_2', '« Thái Sơ Thời Không Ma Thần Hồn »', 'soul', 'Than Thoai', 'Khong Gian', 380, 280, 460, 0, 0.0, 'Thời Không Đình Chỉ', 'Trong trận đấu, kích hoạt Ngưng Đọng Thời Gian 1 lần, cho phép pet của bạn ra đòn liên tiếp 2 lượt không gián đoạn!', 1.0, '⏳'),
('soul_mythic_3', '« Luân Hồi Bất Diệt Chiến Hồn »', 'soul', 'Than Thoai', 'Luan Hoi', 360, 320, 470, 0, 0.0, 'Sinh Mệnh Nghịch Chuyển', 'Khi máu pet tụt xuống dưới 20%, ngay lập tức hoán đổi % lượng máu hiện tại của bản thân với đối thủ (lật ngược tình thế ngoạn mục)!', 1.0, '🔄')
ON CONFLICT (item_id) DO UPDATE SET
    item_name = EXCLUDED.item_name,
    item_type = EXCLUDED.item_type,
    rarity = EXCLUDED.rarity,
    element = EXCLUDED.element,
    bonus_atk = EXCLUDED.bonus_atk,
    bonus_def = EXCLUDED.bonus_def,
    bonus_spd = EXCLUDED.bonus_spd,
    bonus_hp = EXCLUDED.bonus_hp,
    bonus_crit = EXCLUDED.bonus_crit,
    hax_skill = EXCLUDED.hax_skill,
    hax_description = EXCLUDED.hax_description,
    drop_rate = EXCLUDED.drop_rate,
    icon = EXCLUDED.icon;

-- 5. Trang bị Full Set Thần Thoại Tối Thượng cho Tiểu thư Fuyumi (757091869183311872)
-- Xóa trang bị cũ nếu có
DELETE FROM user_pet_items WHERE user_id = '757091869183311872';

-- Thêm 3 trang bị Thần Thoại vào túi và gắn vào Cửu Vĩ Hồng Hồ
INSERT INTO user_pet_items (user_id, item_id, equipped_to_pet, slot) VALUES
('757091869183311872', 'weapon_mythic_1', 'cuu_vi_hong_ho', 'weapon'),
('757091869183311872', 'gem_mythic_3', 'cuu_vi_hong_ho', 'gem'),
('757091869183311872', 'soul_mythic_1', 'cuu_vi_hong_ho', 'soul');
`;

async function main() {
  console.log('Connecting to Supabase PostgreSQL pooler...');
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected successfully!');

    console.log('Executing schema_pet_equipment.sql...');
    await client.query(sql);
    console.log('Schema executed successfully!');

    // Verify pet_items count
    const itemsRes = await client.query('SELECT count(*) FROM pet_items;');
    console.log('Total pet_items in DB:', itemsRes.rows[0].count);

    // Verify Fuyumi equipped items
    const fuyumiItems = await client.query('SELECT * FROM v_user_equipped_items WHERE user_id = $1;', ['757091869183311872']);
    console.log('Fuyumi equipped items count:', fuyumiItems.rows.length);
    console.log('Fuyumi items detail:', fuyumiItems.rows.map(r => ({
      slot: r.slot,
      name: r.item_name,
      rarity: r.rarity,
      hax: r.hax_skill,
      icon: r.icon
    })));

    await client.end();
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

main();
