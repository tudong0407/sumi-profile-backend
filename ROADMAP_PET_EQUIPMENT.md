# ⚔️ KẾ HOẠCH PHÁT TRIỂN: HỆ THỐNG TRANG BỊ LINH THÚ (PET EQUIPMENT & BUILDS)

> **Ghi nhận ý tưởng của Chủ nhân tối cao Tiểu thư Fuyumi (`757091869183311872`)**  
> Dành cho Trợ lý Linh Hồ AI **Nhiễm Nhiễm (`916469360401453067`)** trên **🦊 𝗦𝘂𝗠𝗶 𝗙𝗮𝗺𝗶𝗹𝘆 (`1026096141273661450`)**.

---

## 1. Mục Tiêu & Tầm Nhìn
Tạo chiều sâu chiến thuật cho hệ thống Linh Thú (`user_pets`), biến mỗi pet thành một thực thể chiến đấu độc nhất vô nhị. Người chơi (tu sĩ) không chỉ nuôi dưỡng và nâng cấp thú cưng mà còn có thể thu thập, rèn đúc trang bị để xây dựng các "Build" cá nhân hóa cho pet:
- **Build Đấu Sĩ / Phản Đòn** (Tanker / Bruiser)
- **Build Bạo Kích / Sát Thương Đột Biến** (Assassin / Critical Burst)
- **Build Tốc Độ / Khống Chế** (Speed Blitz / Control)
- **Build Hỗ Trợ / Hồi Phục** (Support / Regeneration Buffer)

Hệ thống bổ trợ trực tiếp cho các tính năng:
- Chiến đấu PvP / Bang Chiến (`clan_wars`).
- Tăng sức mạnh /buff cho chủ nhân (`/boost`).

---

## 2. Các Loại Trang Bị Cốt Lõi (Item Types)

### 2.1. Pháp Khí / Vũ Khí Linh Thú (Pet Weapons)
- **Công dụng**: Tăng trực tiếp chỉ số tấn công cơ bản (`ATK`) và chỉ số bạo kích (`Crit Rate / Crit DMG`).
- **Phân loại**:
  - *Kiếm / Đao Tiên*: Tăng mạnh sát thương vật lý và xuyên giáp linh lực.
  - *Pháp Trượng / Linh Châu*: Tăng sát thương kỹ năng nguyên tố và giảm hồi chiêu skill.
  - *Vuốt Cào Linh Thú*: Tăng tốc độ đánh và áp dụng hiệu ứng chảy máu/độc tính.
- **Cơ chế đặc biệt**: Khảm ấn linh văn hoặc cường hóa từ `+1` đến `+15`.

### 2.2. Bảo Ngọc Định Mệnh (Pet Sacred Gems)
- **Công dụng**: Khảm vào trang bị hoặc khảm trực tiếp vào 3-4 ô Ngọc Mạch của Linh Thú để gia tăng chỉ số phụ bản đặc biệt.
- **Phân loại Ngọc**:
  - *Hồng Ngọc (Ruby)*: Tăng sinh lực tối đa (`HP`) và hấp thụ sát thương.
  - *Lam Ngọc (Sapphire)*: Tăng linh lực (`MP/Energy`) và kháng hiệu ứng khống chế.
  - *Hoàng Ngọc (Topaz)*: Tăng phòng thủ cứng (`DEF`) và phản đòn cận chiến.
  - *Lục Ngọc (Emerald)*: Tăng tốc độ né tránh (`Dodge/AGI`) và cơ động.
  - *Tử Ngọc (Amethyst)*: Chuyển hóa sát thương gây ra thành hồi máu (Hút máu / Lifesteal).

### 2.3. Chiến Hồn / Linh Hồn Thức Tỉnh (Pet Soul / Battle Spirits)
- **Công dụng**: Linh hồn của thượng cổ thần thú dung hợp vào pet, kích hoạt Thiên Phú Ẩn (Passive Skill) và diện mạo ánh hào quang (Aura Effect).
- **Phân loại**:
  - *Thanh Long Hồn*: Tấn công kèm sấm sét chuỗi, gây tê liệt diện rộng.
  - *Bạch Hổ Hồn*: Càng ít máu sát thương càng bùng nổ, miễn tử 1 lần trong trận chiến.
  - *Chu Tước Hồn*: Hồi sinh từ tro tàn với 30% HP và thiêu đốt kẻ địch xung quanh.
  - *Huyền Vũ Hồn*: Tạo khiên hộ thể tương đương 50% HP tối đa khi bị tấn công nặng.
  - *Cửu Vĩ Thiên Hồ Hồn (Độc quyền SuMi)*: Mê hoặc mục tiêu trong 2 lượt, tăng 25% exp và linh thạch nhận được cho chủ nhân.

---

## 3. Tích Hợp Lệnh `/boost` & Chiến Đấu (Combat & Buff Integration)

### 3.1. Lệnh `/boost`
- Khi trang bị đủ bộ (Vũ Khí + Bảo Ngọc + Chiến Hồn), Linh Thú đạt trạng thái **"Cộng Minh Thần Thú"**.
- Tu sĩ kích hoạt `/boost` để nhận các hiệu ứng:
  - Tăng tỷ lệ nhận Linh Thạch khi chat / tương tác.
  - Tăng EXP tu luyện cảnh giới lên đến +50%.
  - Thêm hiệu ứng huy hiệu đặc biệt trên thẻ `/profile` và `/rank`.

### 3.2. Đấu Trường Linh Thú (Pet Arena)
- Cho phép người chơi ghép trận 1v1 hoặc 3v3 giữa các Pet.
- Hệ thống chiến đấu tự động dựa trên tốc độ, combo kỹ năng trang bị và khắc chế thuộc tính giữa các Build.

---

## 4. Kiến Trúc Dữ Liệu Dự Kiến (Database Design Proposal)

```sql
-- Bảng trang bị và vật phẩm linh thú
CREATE TABLE public.pet_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    item_type VARCHAR(20) NOT NULL CHECK (item_type IN ('weapon', 'gem', 'soul')),
    rarity VARCHAR(20) NOT NULL DEFAULT 'common' CHECK (rarity IN ('common', 'rare', 'epic', 'legendary', 'mythic')),
    stats_bonus JSONB NOT NULL DEFAULT '{}'::jsonb, -- {"atk": 150, "crit": 0.08}
    passive_effect JSONB DEFAULT NULL,              -- {"trigger": "on_hit", "effect": "burn"}
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bảng trang bị người chơi sở hữu và gán cho Pet
CREATE TABLE public.user_pet_equipment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id VARCHAR(64) NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
    pet_id UUID NOT NULL REFERENCES public.user_pets(id) ON DELETE CASCADE,
    weapon_item_id UUID REFERENCES public.pet_items(id) ON DELETE SET NULL,
    gem_slots JSONB DEFAULT '[]'::jsonb, -- Mảng UUID các ngọc đã khảm
    soul_item_id UUID REFERENCES public.pet_items(id) ON DELETE SET NULL,
    enhancement_level INT DEFAULT 0 CHECK (enhancement_level BETWEEN 0 AND 15),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_pet_equipment UNIQUE (pet_id)
);
```

---

*Tài liệu được khởi tạo và lưu trữ tự động trong repository `sumi-profile-backend` nhằm chuẩn bị cho Sprint tiếp theo.*
