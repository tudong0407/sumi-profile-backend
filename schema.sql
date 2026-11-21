-- ==============================================================================
-- SUMI FAMILY (1026096141273661450) - SUPABASE POSTGRESQL SCHEMA SPECIFICATION
-- Bot: Nhiễm Nhiễm (916469360401453067)
-- Chủ nhân tối cao: Tiểu thư Fuyumi (757091869183311872)
-- Hệ thống: Profile Canvas • Đốt EXP Linh Thạch • 110 Roles Quyền Năng • Gia Tộc Chiến • 20 Chiến Pet Ngũ Hành & HAX
-- ==============================================================================

-- Bật extension mở rộng nếu cần
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. BẢNG GIA TỘC (CLANS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clans (
    clan_id VARCHAR(50) PRIMARY KEY,
    clan_name VARCHAR(100) NOT NULL UNIQUE,
    clan_tag VARCHAR(10) DEFAULT NULL,
    clan_icon_url TEXT DEFAULT NULL,
    leader_id VARCHAR(32) NOT NULL,
    clan_level INT DEFAULT 1 CHECK (clan_level BETWEEN 1 AND 10),
    clan_treasury BIGINT DEFAULT 0 CHECK (clan_treasury >= 0),
    total_exp BIGINT DEFAULT 0 CHECK (total_exp >= 0),
    max_members INT DEFAULT 10 CHECK (max_members >= 5),
    description VARCHAR(500) DEFAULT 'Một gia tộc tu tiên tại SuMi Family',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 2. BẢNG DANH MỤC 20 LINH THÚ CHIẾN PET TOÀN TIÊN GIỚI (PETS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pets (
    pet_type VARCHAR(50) PRIMARY KEY,
    pet_name VARCHAR(100) NOT NULL,
    element VARCHAR(30) NOT NULL, -- 'Hỏa', 'Thủy', 'Mộc', 'Lôi', 'Kim', 'Thổ', 'Ám', 'Quang', 'Hỗn Độn'
    rarity VARCHAR(30) DEFAULT 'Cổ Đại Thần Thoại',
    base_atk INT DEFAULT 100 CHECK (base_atk >= 0),
    base_def INT DEFAULT 100 CHECK (base_def >= 0),
    base_spd INT DEFAULT 100 CHECK (base_spd >= 0),
    hax_skill VARCHAR(100) NOT NULL, -- Kỹ năng phá cách lật kèo
    hax_description TEXT NOT NULL,
    icon VARCHAR(10) DEFAULT '🐾',
    prompt_ai TEXT, -- Prompt AI chuẩn đồ họa 8K tạo ảnh
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 3. BẢNG NGƯỜI DÙNG (USERS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    user_id VARCHAR(32) PRIMARY KEY,
    username VARCHAR(100) DEFAULT 'Tu Sĩ Ẩn Danh',
    discriminator VARCHAR(10) DEFAULT '0',
    avatar_url TEXT DEFAULT NULL,
    exp BIGINT DEFAULT 0 CHECK (exp >= 0),
    level INT DEFAULT 1 CHECK (level >= 1),
    linh_thach BIGINT DEFAULT 0 CHECK (linh_thach >= 0),
    avatar_frame VARCHAR(100) DEFAULT 'default',
    background_url TEXT DEFAULT 'default_background.png',
    bio VARCHAR(200) DEFAULT 'Một vị tu sĩ của SuMi Family',
    custom_title VARCHAR(100) DEFAULT 'Tân Thủ Nhập Đạo',
    max_role_slots INT DEFAULT 1 CHECK (max_role_slots BETWEEN 1 AND 5),
    marry_user_id VARCHAR(32) DEFAULT NULL,
    marry_username VARCHAR(100) DEFAULT NULL,
    marry_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    marry_ring_id VARCHAR(50) DEFAULT NULL,
    clan_id VARCHAR(50) DEFAULT NULL REFERENCES clans(clan_id) ON DELETE SET NULL,
    streak INT DEFAULT 0 CHECK (streak >= 0),
    last_daily TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    last_chat_exp_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    voice_joined_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    total_voice_minutes INT DEFAULT 0 CHECK (total_voice_minutes >= 0),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 4. BẢNG TÚI ĐỒ ROLE CỦA NGƯỜI DÙNG (USER_ROLES)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_roles (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(32) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    role_id VARCHAR(32) NOT NULL,
    role_name VARCHAR(100) NOT NULL,
    role_perk VARCHAR(100) DEFAULT NULL,
    is_permanent BOOLEAN DEFAULT FALSE,
    expires_at TIMESTAMP WITH TIME ZONE NULL,
    is_equipped BOOLEAN DEFAULT FALSE,
    equipped_slot INT NULL CHECK (equipped_slot BETWEEN 1 AND 5),
    obtained_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_equipped_slot 
ON user_roles(user_id, equipped_slot) 
WHERE equipped_slot IS NOT NULL;

-- ------------------------------------------------------------------------------
-- 5. BẢNG LINH THÚ CHIẾN PET NGƯỜI DÙNG SỞ HỮU (USER_PETS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_pets (
    pet_id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(32) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    pet_name VARCHAR(100) NOT NULL,
    pet_type VARCHAR(50) NOT NULL REFERENCES pets(pet_type) ON UPDATE CASCADE ON DELETE RESTRICT,
    pet_rarity VARCHAR(30) DEFAULT 'Cổ Đại Thần Thoại',
    element VARCHAR(30) DEFAULT 'Kim',
    hax_skill VARCHAR(100) DEFAULT NULL,
    hax_description TEXT DEFAULT NULL,
    level INT DEFAULT 1 CHECK (level >= 1),
    exp BIGINT DEFAULT 0 CHECK (exp >= 0),
    star INT DEFAULT 1 CHECK (star BETWEEN 1 AND 10),
    atk INT DEFAULT 10 CHECK (atk >= 0),
    def INT DEFAULT 10 CHECK (def >= 0),
    spd INT DEFAULT 10 CHECK (spd >= 0),
    power_score BIGINT DEFAULT 100 CHECK (power_score >= 0),
    is_active BOOLEAN DEFAULT TRUE,
    image_url TEXT DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tự động tính power_score nếu không truyền hoặc bằng 0
CREATE OR REPLACE FUNCTION fn_calc_pet_power()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.power_score IS NULL OR NEW.power_score = 0 THEN
        NEW.power_score := (NEW.atk * 3 + NEW.def * 2 + NEW.spd * 2 + NEW.level * 50);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_calc_pet_power ON user_pets;
CREATE TRIGGER trg_calc_pet_power
BEFORE INSERT OR UPDATE ON user_pets
FOR EACH ROW EXECUTE FUNCTION fn_calc_pet_power();

-- ------------------------------------------------------------------------------
-- 6. BẢNG GIA TỘC CHIẾN (CLAN_WARS - 24H)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clan_wars (
    war_id BIGSERIAL PRIMARY KEY,
    challenger_clan_id VARCHAR(50) NOT NULL REFERENCES clans(clan_id) ON DELETE CASCADE,
    target_clan_id VARCHAR(50) NOT NULL REFERENCES clans(clan_id) ON DELETE CASCADE,
    bet_amount BIGINT NOT NULL DEFAULT 1000 CHECK (bet_amount >= 0),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'cancelled')),
    start_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    challenger_score BIGINT DEFAULT 0 CHECK (challenger_score >= 0),
    target_score BIGINT DEFAULT 0 CHECK (target_score >= 0),
    winner_clan_id VARCHAR(50) NULL REFERENCES clans(clan_id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- 7. CHỈ MỤC TỐI ƯU TRUY VẤN (INDEXES)
-- ------------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_users_clan_id ON users(clan_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_equipped ON user_roles(user_id, is_equipped) WHERE is_equipped = TRUE;
CREATE INDEX IF NOT EXISTS idx_user_pets_user_id ON user_pets(user_id);
CREATE INDEX IF NOT EXISTS idx_user_pets_active ON user_pets(user_id, is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_clan_wars_status ON clan_wars(status);

-- ------------------------------------------------------------------------------
-- 7b. BẢNG PHASE 2 & PHASE 3 (SHOP_SELECTIONS, MARRY_PROPOSALS, CLAN_JOIN_REQUESTS)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS shop_selections (
    user_id VARCHAR(32) PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
    category VARCHAR(30) NOT NULL,
    item_id VARCHAR(100) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS marry_proposals (
    id BIGSERIAL PRIMARY KEY,
    proposer_id VARCHAR(32) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    proposer_name VARCHAR(100) NOT NULL,
    target_id VARCHAR(32) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    target_name VARCHAR(100) NOT NULL,
    ring_id VARCHAR(50) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected','expired','cancelled')),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marry_proposals_target_status ON marry_proposals(target_id, status);
CREATE INDEX IF NOT EXISTS idx_marry_proposals_proposer_status ON marry_proposals(proposer_id, status);

CREATE TABLE IF NOT EXISTS clan_join_requests (
    id BIGSERIAL PRIMARY KEY,
    clan_id VARCHAR(50) NOT NULL REFERENCES clans(clan_id) ON DELETE CASCADE,
    user_id VARCHAR(32) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    username VARCHAR(100) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected','cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clan_join_requests_clan_status ON clan_join_requests(clan_id, status);

-- ------------------------------------------------------------------------------
-- 8. VIEW TỔNG HỢP PROFILE TOÀN DIỆN (V_USER_FULL_PROFILE)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_user_full_profile AS
SELECT 
    u.user_id,
    u.username,
    u.discriminator,
    u.avatar_url,
    u.exp,
    u.level,
    u.linh_thach,
    u.avatar_frame,
    u.background_url,
    u.bio,
    u.custom_title,
    u.max_role_slots,
    u.marry_user_id,
    u.marry_username,
    u.marry_date,
    u.clan_id,
    c.clan_name,
    c.clan_level,
    c.leader_id = u.user_id AS is_clan_leader,
    p.pet_id,
    p.pet_name,
    p.pet_type,
    p.pet_rarity,
    p.element AS pet_element,
    p.hax_skill AS pet_hax_skill,
    p.hax_description AS pet_hax_desc,
    p.level AS pet_level,
    p.star AS pet_star,
    p.atk AS pet_atk,
    p.def AS pet_def,
    p.spd AS pet_spd,
    p.power_score AS pet_power
FROM users u
LEFT JOIN clans c ON u.clan_id = c.clan_id
LEFT JOIN user_pets p ON u.user_id = p.user_id AND p.is_active = TRUE;

-- ------------------------------------------------------------------------------
-- 9. SEED DỮ LIỆU DANH MỤC 20 LINH THÚ CHIẾN PET & ĐẶC QUYỀN FUYUMI
-- ------------------------------------------------------------------------------
INSERT INTO pets (pet_type, pet_name, element, rarity, base_atk, base_def, base_spd, hax_skill, hax_description, icon)
VALUES
    -- Đặc quyền Tiểu thư Fuyumi
    ('cuu_vi_hong_ho', 'Cửu Vĩ Hồng Hồ', 'Hỗn Độn', 'Tối Thượng Thần Thoại', 99999, 99999, 99999, 'Cửu Vĩ Hộ Thể (HAX Bất Tử)', 'Bất tử trước 3 đòn đầu, phản lại 100% sát thương gốc', '🦊'),
    -- 5 Phàm Phẩm (Starter yếu nhất: Hóa Thạch Nham Nham Thú 120/180/100)
    ('hoa_thach_nham_nham', 'Hóa Thạch Nham Nham Thú', 'Thổ', 'Phàm Phẩm', 120, 180, 100, 'Hóa Đá', 'Hóa đá đối thủ 1 hiệp khi bị tấn công', '🗿'),
    ('thuy_tinh_huyen_ngao', 'Thủy Tinh Huyền Ngao', 'Thủy', 'Phàm Phẩm', 160, 260, 140, 'Nghịch Lưu Phản Xạ', 'Phản lại 60% sát thương phép', '🐢'),
    ('thao_moc_linh_vien', 'Thảo Mộc Linh Viên', 'Mộc', 'Phàm Phẩm', 180, 240, 170, 'Đất Mẹ Che Chở', 'Tạo khiên chắn bằng 50% máu tối đa', '🐒'),
    ('thanh_truc_tien_loc', 'Thanh Trúc Tiên Lộc', 'Mộc', 'Phàm Phẩm', 190, 220, 210, 'Linh Mộc Hồi Xuân', 'Hồi 25% máu mỗi hiệp cho bản thân', '🦌'),
    ('thiet_giap_xich_giac', 'Thiết Giáp Xích Giác Thú', 'Kim', 'Phàm Phẩm', 200, 280, 150, 'Phản Chấn Thần Lực', 'Phản 80% sát thương vật lý', '🦏'),
    -- 5 Linh Phẩm
    ('bang_tuyet_ho', 'Băng Tuyết Hồ', 'Thủy', 'Linh Phẩm', 350, 390, 420, 'Băng Phong', '35% tỉ lệ đóng băng đối thủ 1 hiệp', '❄️'),
    ('viem_nguc_khuyen', 'Viêm Ngục Khuyển', 'Hỏa', 'Linh Phẩm', 380, 320, 350, 'Cuồng Nộ', 'Máu càng thấp sát thương tăng gấp 3', '🐕'),
    ('xich_xa_hoa_long', 'Xích Xà Hỏa Long', 'Hỏa', 'Linh Phẩm', 420, 310, 390, 'Hỏa Độc Huyết', 'Đối phương mất 15% máu tối đa mỗi hiệp', '🐉'),
    ('bach_kim_ho_tu', 'Bạch Kim Hổ Tử', 'Kim', 'Linh Phẩm', 490, 360, 430, 'Phá Giáp Trảm', 'Đòn đánh kế tiếp xuyên 100% mọi lớp phòng ngự', '🐅'),
    ('hai_duong_tien_ngu', 'Hải Dương Tiên Ngư', 'Thủy', 'Linh Phẩm', 320, 440, 460, 'Thanh Tẩy Linh Triều', 'Xóa bỏ toàn bộ hiệu ứng có lợi của đối thủ', '🐟'),
    -- 4 Tiên Phẩm
    ('linh_mieu_hoa_tien', 'Linh Miêu Hoa Tiên', 'Mộc', 'Tiên Phẩm', 390, 350, 490, 'Gai Mộc Trói Chân', 'Khóa không cho đối thủ kích hoạt kỹ năng đặc biệt trong 2 lượt', '🐱'),
    ('hoa_diem_ho', 'Hỏa Diễm Hồ', 'Hỏa', 'Tiên Phẩm', 450, 280, 410, 'Thiêu Hồn', 'Bỏ qua 50% giáp của đối thủ', '🔥'),
    ('man_da_la_linh_thu', 'Mạn Đà La Linh Thú', 'Mộc', 'Tiên Phẩm', 430, 360, 410, 'Ký Sinh Hút Máu', 'Gây sát thương bằng 30% máu đối thủ và hút về cho mình', '🌺'),
    ('kim_si_dieu_hoang', 'Kim Sí Điêu Hoàng', 'Kim', 'Tiên Phẩm', 470, 380, 520, 'Mù Lòa Thái Dương', 'Khiến đối thủ đánh trượt 70% trong 2 hiệp', '🦅'),
    -- 6 Thần Thoại
    ('chu_tuoc_au_dieu', 'Chu Tước Ấu Điểu', 'Hỏa', 'Thần Thoại', 520, 360, 480, 'Niết Bàn Tái Sinh', 'Hồi sinh 50% máu 1 lần mỗi trận', '🪶'),
    ('han_bang_ky_lan', 'Hàn Băng Kỳ Lân', 'Thủy', 'Thần Thoại', 510, 480, 450, 'Hàn Khí Giáp', 'Giảm 40% sát thương từ đòn đánh bạo kích', '🦄'),
    ('loi_dinh_kim_ho', 'Lôi Đình Kim Hồ', 'Lôi', 'Thần Thoại', 560, 310, 580, 'Lôi Quang Tốc', 'Luôn luôn được đánh trước bất kể lực chiến', '⚡'),
    ('u_minh_lang_vuong', 'U Minh Lang Vương', 'Ám', 'Thần Thoại', 540, 370, 490, 'Tuyệt Mệnh Trảm', 'Nếu máu đối phương dưới 25%, 50% kết liễu ngay lập tức', '🐺'),
    ('tinh_khong_da_thao', 'Tinh Không Dạ Thao', 'Hư Không', 'Thần Thoại', 500, 420, 510, 'Hư Không Hỗn Loạn', 'Khiến đối thủ tự đánh chính mình trong 1 hiệp', '🌌'),
    ('quang_minh_thanh_thu', 'Quang Minh Thánh Thú', 'Quang', 'Thần Thoại', 480, 490, 480, 'Thánh Quang Hóa Giải', 'Miễn nhiễm 100% mọi hiệu ứng xấu và HAX', '✨')
ON CONFLICT (pet_type) DO UPDATE SET
    pet_name = EXCLUDED.pet_name,
    element = EXCLUDED.element,
    rarity = EXCLUDED.rarity,
    base_atk = EXCLUDED.base_atk,
    base_def = EXCLUDED.base_def,
    base_spd = EXCLUDED.base_spd,
    hax_skill = EXCLUDED.hax_skill,
    hax_description = EXCLUDED.hax_description,
    icon = EXCLUDED.icon;

-- ------------------------------------------------------------------------------
-- 10. DỮ LIỆU KHỞI TẠO ĐẶC QUYỀN: TIỂU THƯ FUYUMI & THIÊN HỒ THẦN TỘC
-- ------------------------------------------------------------------------------
INSERT INTO clans (clan_id, clan_name, clan_tag, leader_id, clan_level, clan_treasury, total_exp, max_members, description)
VALUES (
    'thien_ho_than_toc',
    'Thiên Hồ Thần Tộc',
    '🦊TH',
    '757091869183311872',
    5,
    99999999,
    15000000,
    50,
    'Gia tộc tối thượng của Cửu Vĩ Tiên Chủ Fuyumi tại SuMi Family'
) ON CONFLICT (clan_id) DO UPDATE SET 
    clan_level = EXCLUDED.clan_level,
    clan_treasury = EXCLUDED.clan_treasury;

INSERT INTO users (
    user_id, username, discriminator, avatar_url, exp, level, 
    linh_thach, avatar_frame, background_url, bio, custom_title, 
    max_role_slots, marry_user_id, marry_username, marry_date, clan_id, streak
) VALUES (
    '757091869183311872',
    'Fuyumi 🌸',
    '0',
    'assets/fuyumi_avatar.png',
    450000,
    100,
    999999,
    'celestial_fox_gold',
    'assets/celestial_palace_pink.png',
    'Cửu Vĩ Tiên Chủ • Người sáng lập và bảo hộ SuMi Family',
    'Cửu Vĩ Tiên Chủ',
    5,
    NULL,
    NULL,
    NULL,
    'thien_ho_than_toc',
    100
) ON CONFLICT (user_id) DO UPDATE SET 
    level = EXCLUDED.level,
    exp = EXCLUDED.exp,
    linh_thach = EXCLUDED.linh_thach,
    max_role_slots = EXCLUDED.max_role_slots;

-- Pet Thần Thoại Cổ Đại duy nhất của Fuyumi
INSERT INTO user_pets (
    user_id, pet_name, pet_type, pet_rarity, element, hax_skill, hax_description,
    level, star, atk, def, spd, power_score, is_active
) VALUES (
    '757091869183311872',
    'Cửu Vĩ Hồng Hồ',
    'cuu_vi_hong_ho',
    'Tối Thượng Thần Thoại',
    'Hỗn Độn',
    'Cửu Vĩ Hộ Thể (HAX Bất Tử)',
    'Bất tử trước 3 đòn đầu, phản lại 100% sát thương gốc',
    99,
    10,
    99999,
    99999,
    99999,
    9999999,
    TRUE
) ON CONFLICT DO NOTHING;

-- 5 Role Quyền Năng đã trang bị trên 5 Slot của Fuyumi (Discord Snowflake IDs từ SuMi Family)
INSERT INTO user_roles (user_id, role_id, role_name, role_perk, is_permanent, is_equipped, equipped_slot)
VALUES 
    ('757091869183311872', '1473419957655175169', '« 100 • Hỗn Độn Chúa Tể »', '⚔️ Trảm Quyết Tối Thượng', TRUE, TRUE, 1),
    ('757091869183311872', '1573185998857183253', '« Cửu Vĩ Tối Thượng Thần Hồ »', '🛡️ Kháng Timeout & Hộ Thể', TRUE, TRUE, 2),
    ('757091869183311872', '1573186024048173076', '« Phong Thanh Hộ Pháp »', '🎙️ Di Chuyển Voice', TRUE, TRUE, 3),
    ('757091869183311872', '1573186049289756712', '« Thần Hành Cốt Cách »', '⚡ Miễn Chờ Chat Chậm', TRUE, TRUE, 4),
    ('757091869183311872', '1573186074153324608', '« Trấn Thư Pháp Vương »', '📌 Ghim Tin Nhắn', TRUE, TRUE, 5)
ON CONFLICT (user_id, equipped_slot) WHERE equipped_slot IS NOT NULL DO UPDATE SET
    role_name = EXCLUDED.role_name,
    role_id = EXCLUDED.role_id,
    role_perk = EXCLUDED.role_perk;
