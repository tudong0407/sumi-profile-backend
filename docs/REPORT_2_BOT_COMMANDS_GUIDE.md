# CẨM NANG TOÀN TẬP DANH SÁCH LỆNH BOT NHIỄM NHIỄM VÀ HƯỚNG DẪN SỬ DỤNG
## TRỢ LÝ LINH HỒ AI • 🦊 𝗦𝘂𝗠𝗶 𝗙𝗮𝗺𝗶𝗹𝘆 DISCORD SERVER

---

- **Tên Bot:** Nhiễm Nhiễm (Discord Application ID: `916469360401453067`)
- **Server phục vụ:** 🦊 𝗦𝘂𝗠𝗶 𝗙𝗮𝗺𝗶𝗹𝘆 (Guild ID: `1026096141273661450`)
- **Tiên Chủ sáng lập:** Tiểu thư Fuyumi (`757091869183311872`)
- **Nền tảng cấu hình:** BotGhost Cloud Platform (Flow Builder & Custom Events)
- **Máy chủ xử lý Canvas & API:** `https://sumi-profile-backend.onrender.com`
- **Tác giả:** Đội ngũ Kỹ sư Chuyên trách Hệ thống (`worker_reporter_gen2`)
- **Phiên bản tài liệu:** v1.0.0 — Cập nhật ngày 20/11/2026

---

## MỤC LỤC TỔNG QUAN

1. [GIỚI THIỆU TỔNG QUAN HỆ THỐNG LỆNH](#1-giới-thiệu-tổng-quan-hệ-thống-lệnh)
2. [BẢNG TRA CỨU NHANH DANH MỤC LỆNH DISCORD](#2-bảng-tra-cứu-nhanh-danh-mục-lệnh-discord)
3. [HƯỚNG DẪN CHI TIẾT CÁC LỆNH CỐT LÕI](#3-hướng-dẫn-chi-tiết-các-lệnh-cốt-lõi)
   - [3.1. Lệnh `/profile` — Thẻ Hồ Sơ Tu Tiên Toàn Cảnh (1000x500 HD)](#31-lệnh-profile--thẻ-hồ-sơ-tu-tiên-toàn-cảnh-1000x500-hd)
   - [3.2. Lệnh `/rank` — Thẻ Thứ Hạng Tu Tiên Mini (1000x205 HD)](#32-lệnh-rank--thẻ-thứ-hạng-tu-tiên-mini-1000x205-hd)
   - [3.3. Lệnh `/wiki` — Tra Cứu Cẩm Nang Tu Tiên 5 Chuyên Mục](#33-lệnh-wiki--tra-cứu-cẩm-nang-tu-tiên-5-chuyên-mục)
   - [3.4. Lệnh `/battle` & API Đấu Trường Linh Thú Ngũ Hành](#34-lệnh-battle--api-đấu-trường-linh-thú-ngũ-hành)
   - [3.5. Các Lệnh Phụ Trợ & Tính Năng Tiên Giới Đi Kèm](#35-các-lệnh-phụ-trợ--tính-năng-tiên-giới-đi-kèm)
4. [QUY CHẾ PHÂN QUYỀN VÀ BẢO VỆ AUTOMOD (STAFF VS NON-STAFF)](#4-quy-chế-phân-quyền-và-bảo-vệ-automod-staff-vs-non-staff)
5. [HƯỚNG DẪN CẤU HÌNH BOTGHOST BUILDER & FLOW API](#5-hướng-dẫn-cấu-hình-botghost-builder--flow-api)
6. [XỬ LÝ SỰ CỐ VÀ CÂU HỎI THƯỜNG GẶP (FAQ)](#6-xử-lý-sự-cố-và-câu-hỏi-thường-gặp-faq)

---

## 1. GIỚI THIỆU TỔNG QUAN HỆ THỐNG LỆNH

Trợ lý Linh Hồ AI **Nhiễm Nhiễm** (`916469360401453067`) được tích hợp sâu vào hệ sinh thái Discord **🦊 𝗦𝘂𝗠𝗶 𝗙𝗮𝗺𝗶𝗹𝘆** (`1026096141273661450`). Hệ thống lệnh của bot vận hành theo tiêu chuẩn Slash Commands (`/`) thế hệ mới của Discord, kết hợp linh hoạt giữa:
- **Giao diện người dùng Discord:** Các lệnh slash có menu gợi ý (Autocomplete/Choices), hỗ trợ mention đối tượng trực quan và phản hồi qua Rich Embeds hoặc ảnh Canvas HD.
- **BotGhost Gateway:** Điều phối luồng tương tác, phân giải biến ngữ cảnh (`{interaction_user}`, `{option_user}`) và kích hoạt các khối gọi API Backend (`api_action`).
- **Backend Render Service (`sumi-profile-backend`):** Tiếp nhận dữ liệu, tính toán ma trận ngũ hành/chỉ số và kết xuất đồ họa bằng engine `@napi-rs/canvas` với tốc độ cực nhanh (trung bình dưới 70ms).

---

## 2. BẢNG TRA CỨU NHANH DANH MỤC LỆNH DISCORD

| Lệnh Slash | Tham Số Tùy Chọn | Quyền Hạn | Định Dạng Phản Hồi | Mô Tả Chức Năng |
|---|---|:---:|---|---|
| **`/profile`** | `[user]` (User Mention / ID) | Mọi thành viên | Ảnh Canvas PNG `1000x500` | Xuất Thẻ Tiên Đạo 6 tầng: Cảnh giới, Pet, 3 Slot Trang Bị Loadout, Role Đeo, Tình Duyên, Linh Thạch. |
| **`/rank`** | `[user]` (User Mention / ID) | Mọi thành viên | Ảnh Canvas PNG `1000x205` | Xuất Thẻ Mini Rank: Thứ hạng server, Cấp độ, Thanh tiến trình EXP tu luyện, Cảnh giới và Danh hiệu. |
| **`/wiki`** | `[chuyen_muc]` (6 Choices) | Mọi thành viên | Discord Rich Embed (Hồng `#ec4899`) | Tra cứu Cẩm Nang Tu Tiên: 7 Cảnh giới, 27+ Pet, 45 Món Trang Bị Loadout, Đấu Trường Ngũ Hành, Kinh Tế. |
| **`/battle`** | `[doi_thu]` (Bắt buộc) | Mọi thành viên | Rich Embed + Combat Log | Khiêu chiến Đấu Trường Linh Thú: Đấu lượt tự động, tính tương khắc ngũ hành, buff trang bị và 30 kỹ năng HAX. |
| **`/boost`** | Không | Đạt điều kiện | Tin nhắn thông báo + Role Buff | Kích hoạt "Cộng Minh Thần Thú" khi pet trang bị đủ 3 món, nhận buff +50% EXP tu luyện và +20% Linh Thạch. |
| **`/daily`** | Không | Mọi thành viên | Rich Embed phần thưởng | Điểm danh tu luyện mỗi ngày nhận 100 - 500 Linh Thạch, duy trì streak 7 ngày nhận rương bạo kích. |
| **`/clan`** | `[hanh_dong]`, `[ten]` | Kim Đan trở lên | Rich Embed Gia Tộc | Quản lý Gia Tộc, xem ngân khố bang, cống hiến Linh Thạch và phát động khiêu chiến Clan Wars 24H. |

---

## 3. HƯỚNG DẪN CHI TIẾT CÁC LỆNH CỐT LÕI

### 3.1. Lệnh `/profile` — Thẻ Hồ Sơ Tu Tiên Toàn Cảnh (1000x500 HD)

#### A. Mục đích & Phạm vi sử dụng
Hiển thị toàn diện thành tựu tu tiên, vị thế môn phái, sức mạnh linh thú và bộ trang bị loadout của tu sĩ dưới dạng một tác phẩm nghệ thuật Canvas HD sắc nét.

#### B. Cú pháp & Tham số
```
/profile [user]
```
- `[user]` *(Tùy chọn)*: Người dùng Discord bạn muốn xem hồ sơ (có thể gõ `@mention` hoặc dán trực tiếp Discord Snowflake ID). Nếu để trống, bot mặc định hiển thị hồ sơ của chính người gọi lệnh.

#### C. Cấu trúc 6 tầng nội dung trên Thẻ Profile 1000x500
1. **Header & Thông tin Tu sĩ (Góc trên trái):**
   - Khung avatar huyền ảo (Avatar Frame tùy biến theo cảnh giới).
   - Tên người dùng và Biệt danh môn phái (đã làm sạch chống lỗi NUL byte).
   - Cảnh giới tu tiên hiện tại (từ *I. Luyện Khí Sơ Kỳ* đến *VII. Hỗn Độn Chúa Tể*).
   - Danh xưng độc bản (Custom Title), Cấp độ tu luyện và Thanh tiến trình EXP.
2. **Khu vực Tình Duyên & Gia Tộc (Góc dưới trái):**
   - Thông tin Đạo Lữ (nhẫn kết hôn 💍, liên kết tâm linh với bạn đời).
   - Tông Môn / Gia Tộc (Huy hiệu Bang, Cấp độ Bang, Vị trí Bang chủ / Thành viên).
   - Số dư Linh Thạch tích lũy và Chuỗi điểm danh (Streak).
3. **Khu vực Linh Thú Bản Mệnh (Trung tâm - Phải):**
   - Minh họa Chibi sắc nét của Linh Thú đang xuất chiến (46 loại pet chibi).
   - Tên linh thú, Hệ nguyên tố (Kim, Mộc, Thổ, Thủy, Hỏa, Lôi, Ám, Quang, Hỗn Độn).
   - Cấp độ pet, Phẩm cấp sao (1-10 Sao) và Tuyệt kỹ HAX bản mệnh.
   - 3 chỉ số cốt lõi: **Công (ATK)**, **Thủ (DEF)**, **Tốc (SPD)** và **Chiến Lực Tổng Thể**.
4. **Khu vực 3 Ô Trang Bị Loadout (Góc dưới phải):**
   - **Ô 1 — ⚔️ Vũ Khí:** Biểu tượng 34px, Tên vũ khí (rộng 72px), Chỉ số cộng dồn (`+ATK`, `+SPD`, `+Crit`).
   - **Ô 2 — 💎 Bảo Ngọc:** Biểu tượng 34px, Tên bảo ngọc, Chỉ số cộng dồn (`+DEF`, `+SPD`, `+HP`).
   - **Ô 3 — 🦊 Chiến Hồn:** Biểu tượng 34px, Tên linh hồn, Chỉ số cộng dồn (`+ATK`, `+DEF`, `+SPD`) và Thiên phú ẩn.
5. **Hàng Khay Role Đeo (Role Slots — Góc trên phải):**
   - Hiển thị 2 đến 5 huy hiệu Role cao quý nhất mà người chơi đang trang bị.
   - Thể hiện đặc quyền role (ví dụ: *⚔️ Trảm Quyết Tối Thượng*, *🛡️ Kháng Timeout*, *⚡ Miễn Chờ Chat*).

#### D. Ví dụ thực tế
- Xem chính mình:
  ```
  /profile
  ```
- Xem hồ sơ Tiên Chủ Fuyumi:
  ```
  /profile user:@Fuyumi 🌸
  ```
- Endpoint Backend trực tiếp:
  ```
  GET https://sumi-profile-backend.onrender.com/api/profile/757091869183311872.png
  ```

---

### 3.2. Lệnh `/rank` — Thẻ Thứ Hạng Tu Tiên Mini (1000x205 HD)

#### A. Mục đích & Điểm nổi bật
Dành cho những cuộc đàm đạo nhanh trên kênh chat công cộng, hiển thị gọn gàng vị thế tu tiên mà không chiếm quá nhiều diện tích màn hình.

#### B. Cú pháp & Tham số
```
/rank [user]
```
- `[user]` *(Tùy chọn)*: Tu sĩ cần kiểm tra thứ hạng. Mặc định là bản thân.

#### C. Nội dung hiển thị
- Kích thước chuẩn: `1000 x 205` pixels.
- Avatar hình tròn kèm khung viền năng lượng.
- Tên tu sĩ, Cảnh giới, Thứ hạng toàn server (Server Rank #).
- Cấp độ hiện tại và Thanh tiến trình EXP trực quan (Tỷ lệ % kinh nghiệm đạt được so với mốc đột phá).
- Huy hiệu Gia tộc và số dư Linh Thạch.

#### D. Ví dụ thực tế
```
/rank user:@Tu Sĩ Ngoại Môn
```
- Endpoint Backend trực tiếp:
  ```
  GET https://sumi-profile-backend.onrender.com/api/rank/757091869183311872.png
  ```

---

### 3.3. Lệnh `/wiki` — Tra Cứu Cẩm Nang Tu Tiên 5 Chuyên Mục

#### A. Mục đích & Thiết kế
Cung cấp toàn thư kiến thức về tiên giới SuMi Family cho tân thủ và các tu sĩ lão làng. Giao diện được thiết kế dạng Discord Embed với tông màu hồng hoa anh đào `#ec4899` thương hiệu.

#### B. Cú pháp & Tùy chọn chuyên mục
```
/wiki [chuyen_muc]
```
Menu lựa chọn `[chuyen_muc]` gồm 6 giá trị:
1. `all` *(Mặc định nếu để trống)*: Tóm lược toàn bộ 5 chuyên mục tu tiên.
2. `beginner`: **Khởi Đầu Tu Tiên** — 7 Cảnh giới, cơ chế EXP chat/voice, thẻ profile & rank.
3. `pets`: **Hệ Thống Linh Thú** — 27+ Linh thú, 4 phẩm cấp, bảng kỹ năng HAX và công thức tính lực chiến.
4. `equipment`: **45 Món Trang Bị Loadout** — Cấu trúc 3 ô trang bị, tỷ lệ rèn đúc và 9 Tuyệt kỹ Thần Thoại.
5. `battle`: **Đấu Trường & Ngũ Hành** — Ma trận tương khắc 9 hệ, dị tố Lôi/Ám/Quang/Hỗn Độn, quy tắc tính lượt.
6. `economy`: **Kinh Tế & Gia Tộc** — Linh Thạch, điểm danh nhận quà, Gia tộc và Clan Wars 24H.

#### C. Minh họa nội dung phản hồi mẫu trên Discord
```
╔══════════════════════════════════════════════════════════════════╗
║ 🦊 CẨM NANG TU TIÊN SU MI FAMILY                                ║
║ Hướng dẫn tân thủ & Toàn thư tiên giới • Bot Nhiễm Nhiễm         ║
╠══════════════════════════════════════════════════════════════════╣
║ 📜 Khởi Đầu Tu Tiên: 7 Cảnh giới từ Luyện Khí đến Hỗn Độn Chúa Tể║
║ 🐾 Hệ Thống Linh Thú: 27+ Chiến Pet Ngũ Hành & Kỹ Năng HAX      ║
║ ⚔️ 45 Món Trang Bị: Vũ Khí, Bảo Ngọc, Chiến Hồn & 9 HAX Thần Thoại║
║ 🥋 Đấu Trường Ngũ Hành: Kim-Mộc-Thổ-Thủy-Hỏa-Lôi-Ám-Quang-Hỗn Độn║
║ 💎 Kinh Tế Gia Tộc: Tích lũy Linh Thạch & Đấu Bang Phái 24H     ║
╠══════════════════════════════════════════════════════════════════╣
║ 🦊 𝗦𝘂𝗠𝗶 𝗙𝗮𝗺𝗶𝗹𝘆 • Cẩm Nang Tu Tiên                                ║
╚══════════════════════════════════════════════════════════════════╝
```

---

### 3.4. Lệnh `/battle` & API Đấu Trường Linh Thú Ngũ Hành

#### A. Quy chế Đấu Trường
- **Cú pháp:**
  ```
  /battle doi_thu:@Tu Sĩ Thách Đấu
  ```
- **Thời lượng:** Giới hạn tối đa **20 - 30 lượt đấu**. Nếu hết số lượt mà hai bên chưa gục ngã, hệ thống sẽ căn cứ vào **% Máu còn lại** để xác định người chiến thắng.
- **Thứ tự xuất chiêu:**
  1. Đấu sĩ sở hữu kỹ năng HAX `Lôi Quang Tốc` (như Lôi Đình Kim Hồ) luôn ra đòn trước tiên.
  2. Trường hợp thông thường: Bên nào có chỉ số **Final SPD** (sau khi cộng gộp trang bị) cao hơn sẽ chiếm thế chủ động xuất chiêu đầu tiên mỗi hiệp.

#### B. Ma trận Tương Khắc & Tác Động Sát Thương
- **Khắc hệ Ngũ Hành:** Đạt lợi thế +30% Sát thương (`x1.30`) khi đánh đúng hệ bị khắc; chịu phạt -20% Sát thương (`x0.80`) khi đánh hệ khắc chế mình.
- **Dị tố Lôi:** Gây +30% Sát thương lên hệ Thủy và hệ Kim.
- **Dị tố Ám & Quang:** Tương sát đối kháng, gây thêm +25% sát thương chí mạng lẫn nhau.
- **Hệ Hỗn Độn (Cửu Vĩ Hồng Hồ của Fuyumi):** Miễn nhiễm hoàn toàn với tương khắc thông thường, đòn đánh chuyển thành **Sát Thương Chuẩn (+20% True Damage bỏ qua giáp)** và giảm **15%** mọi sát thương gánh chịu.

#### C. Tích hợp Backend API (`POST /api/battle/simulate`)
- **Tuyến đường:** `POST https://sumi-profile-backend.onrender.com/api/battle/simulate`
- **Request Body (JSON):**
  ```json
  {
    "attackerId": "757091869183311872",
    "defenderId": "1429509324845092875",
    "options": {
      "maxTurns": 20
    }
  }
  ```
- **Response Format (JSON):**
  ```json
  {
    "success": true,
    "winner": {
      "id": "757091869183311872",
      "name": "Fuyumi 🌸",
      "pet": "Cửu Vĩ Hồng Hồ"
    },
    "loser": {
      "id": "1429509324845092875",
      "name": "Hanabira Mei",
      "pet": "Băng Tuyết Hồ"
    },
    "turns": [
      {
        "turn": 1,
        "actor": "attacker",
        "action": "attack",
        "damage": 38500,
        "isCrit": true,
        "elementAdvantage": "CHAOS_TRUE_DAMAGE",
        "haxTriggered": "« Tru Tiên Diệt Thần Kiếm » Tuyệt Diệt Bất Tử",
        "attackerHp": 104165,
        "defenderHp": 0
      }
    ],
    "summary": "Fuyumi 🌸 cùng Cửu Vĩ Hồng Hồ đã áp đảo hoàn toàn đối thủ chỉ sau 1 hiệp thi đấu xuất sắc!"
  }
  ```

---

### 3.5. Các Lệnh Phụ Trợ & Tính Năng Tiên Giới Đi Kèm

#### A. Lệnh `/boost` — Cộng Minh Thần Thú
- **Điều kiện kích hoạt:** Linh thú trang bị đủ cả 3 ô Loadout (Vũ Khí + Bảo Ngọc + Chiến Hồn).
- **Lợi ích:** Kích hoạt vầng hào quang quanh thẻ Profile, tăng vĩnh viễn +50% EXP khi chat/voice và tăng +20% tỷ lệ rơi Linh Thạch.

#### B. Lệnh `/daily` — Điểm Danh Tu Luyện
- Điểm danh mỗi 24 giờ nhận từ 100 đến 500 Linh Thạch.
- Duy trì chuỗi ngày liên tục (Streak): Đạt mốc 7 ngày, 30 ngày và 100 ngày nhận rương ngọc bảo khí chứa phôi trang bị Thần Thoại.

#### C. Lệnh `/clan` — Quản Lý Gia Tộc & Đại Chiến Bang Phái
- Đạt cảnh giới **Kim Đan Đại Đạo (Lv.40)** trở lên có thể thành lập Tông Môn / Bang Hội riêng.
- **Clan Wars 24H:** Hai bang phái cược Linh Thạch và bước vào chu kỳ 24 giờ giao đấu điểm chiến lực để đoạt toàn bộ ngân khố cược của đối phương.

---

## 4. QUY CHẾ PHÂN QUYỀN VÀ BẢO VỆ AUTOMOD (STAFF VS NON-STAFF)

Hệ thống bot Nhiễm Nhiễm tuân thủ tuyệt đối quy định an ninh máy chủ và phân cấp quyền lực tiên giới theo chuẩn thiết kế `sumi-discord-roles`:

```
                           [TIÊN CHỦ TỐI CAO]
                       Fuyumi (757091869183311872)
                       Role pos=141 | Owner Server
                       Miễn trừ Automod Tuyệt Đối
                                    │
                                    ▼
                     [RANH GIỚI BẢO VỆ AUTOMOD]
                  Mốc Cắt: pos >= 137 (Huyền Thiên Hồ Sứ)
                                    │
            ┌───────────────────────┴───────────────────────┐
            ▼                                               ▼
     [NHÓM QUẢN TRỊ VIÊN]                          [NHÓM ĐỆ TỬ & DÂN CƯ]
• pos >= 137 (Huyền Thiên, Cửu Vĩ)             • pos < 137 (Chấp Pháp, Tiểu Băng Hồ)
• Miễn Timeout, Miễn Chat Chậm                 • Chịu Giám Sát Automod 100%
• Kháng lọc từ khóa nhạy cảm                   • Vi phạm: Mute / Timeout tức thì
• Ví dụ: Fuyumi, Quản Trị Cấp Cao               • Ví dụ: Hanabira Mei (pos=124)
```

### 4.1. Tiêu Chí Phân Quyền Staff (`pos >= 137`)
- **Vai trò áp dụng:** `ADMINISTRATOR` và các Role thần thánh có `position >= 137` (bao gồm `« Huyền Thiên Hồ Sứ »`, `« Cửu Vĩ Tối Thượng Thần Hồ »`, `« 100 • Hỗn Độn Chúa Tể »`).
- **Đặc quyền an ninh:** Được thêm vào danh sách trắng (`Exemption Condition`), không bị bot Nhiễm Nhiễm quét cảnh cáo, không bị tự động xóa tin nhắn hoặc áp đặt thời gian chờ (Slowmode).

### 4.2. Quy Chế Non-Staff (`pos < 137`)
- **Lưu ý cốt tử:** Dù nắm giữ role có quyền quản lý thành viên như `MODERATE_MEMBERS` (ví dụ: `« Chấp Pháp Linh Hồ »` vị trí 124, `« Tiểu Băng Hồ »` vị trí 123), nếu vị trí **dưới 137**, tài khoản vẫn hoàn toàn là **Non-staff** đối với bộ lọc kiểm duyệt Automod.
- **Tài khoản Hanabira Mei (`1429509324845092875`):** Nắm role `pos=124`, phải tuân thủ nghiêm ngặt mọi quy tắc kiểm duyệt nội dung, tốc độ chat và điều lệ phòng chống spam.

---

## 5. HƯỚNG DẪN CẤU HÌNH BOTGHOST BUILDER & FLOW API

Để tích hợp và duy trì hệ thống lệnh trên bảng điều khiển BotGhost (`dashboard.botghost.com`), các kỹ sư vận hành cần nắm vững quy trình cấu hình khối lệnh chuẩn hóa:

### 5.1. Cấu trúc Khối Lệnh `/profile` trên BotGhost Flow
1. **Trigger Block (Slash Command):**
   - Command Name: `profile`
   - Description: `Xem thẻ hồ sơ tu tiên HD của bạn hoặc đạo hữu`
   - Option: `user` (Type: User, Required: `false`).
2. **Action Block (Send HTTP Request / `api_action`):**
   - Method: `GET`
   - Target URL (sử dụng token ngữ cảnh an toàn):
     ```text
     https://sumi-profile-backend.onrender.com/api/profile/{option_user}.png?fallback_id={interaction_user}&username={option_user_username}&fallback_name={interaction_user_username}&avatar={option_user_avatar}&fallback_avatar={interaction_user_avatar}
     ```
   - Chú ý Pacing: Luôn đặt độ trễ nghỉ 1.0 - 2.0 giây (`Pacing Delay`) giữa các lần gọi liên hoàn để tránh chạm ngưỡng Cloudflare Rate Limit.
3. **Response Block (Discord Embed):**
   - Tiêu đề: `🦊 SU MI FAMILY • HỒ SƠ TU TIÊN`
   - Màu sắc: `#ec4899` (Decimal `15485081`)
   - Image URL: Sử dụng kết quả ảnh trả về từ khối API Backend.

### 5.2. Cấu trúc Khối Lệnh `/wiki` trên BotGhost Flow
1. **Trigger Block:**
   - Command Name: `wiki`
   - Option: `chuyen_muc` (Type: String, Required: `false`, Choices: `all`, `beginner`, `pets`, `equipment`, `battle`, `economy`).
2. **Action Block (Direct Embed Response):**
   - Gửi Embed hiển thị tức thì theo chuyên mục được chọn hoặc toàn văn cẩm nang, đảm bảo phản hồi tức thì dưới 100ms mà không phụ thuộc vào độ trễ mạng bên ngoài.

### 5.3. Tiêu Chuẩn Lưu Trữ & Kiểm Tra An Toàn (Validation Guardrails)
- Khi chỉnh sửa luồng lệnh trên BotGhost Redux State, bắt buộc kiểm tra:
  - `cbValidateSave: true`
  - `builderSaveRequired: false`
  - Chuỗi Regex lọc không vượt quá 500 ký tự và không dùng ngoặc nhọn `{m,n}` gây lỗi parser BotGhost.

---

## 6. XỬ LÝ SỰ CỐ VÀ CÂU HỎI THƯỜNG GẶP (FAQ)

### Q1: Tại sao gõ `/profile` nhưng ảnh hiển thị mất vài giây mới tải lên?
> **Trả lời:** Backend được triển khai trên nền tảng đám mây Render. Nếu hệ thống ở trạng thái ngủ (Cold Start sau một khoảng thời gian dài không có truy cập), máy chủ cần từ 15-30 giây để khởi động lại instance. Sau khi đã hoạt động, thời gian render mỗi thẻ chỉ mất từ 40ms đến 70ms.

### Q2: Tại sao tên trang bị của tôi dài nhưng không bị cắt thành dấu ba chấm?
> **Trả lời:** Nhờ bản nâng cấp Milestone M1 & M2, khung chữ đã được tối ưu từ 54px lên **72px**, đồng thời thu nhỏ icon thumbnail còn **34px** và tinh chỉnh cỡ chữ tỉ lệ vàng. Mọi danh xưng Thần Thoại như `« Tru Tiên Diệt Thần Kiếm »` đều được bảo toàn trọn vẹn.

### Q3: Làm thế nào để pet của tôi sở hữu kỹ năng HAX trong đấu trường `/battle`?
> **Trả lời:** Có hai cách chính:
> 1. Triệu hồi hoặc bồi dưỡng các thần thú quý hiếm đạt phẩm cấp **Tiên Phẩm** hoặc **Thần Thoại** (sở hữu HAX nội tại bẩm sinh).
> 2. Đúc và trang bị các món trong bộ **9 Trang Bị Thần Thoại** (Vũ khí, Bảo ngọc, Chiến hồn) để mở khóa những năng lực phá vỡ quy tắc như xuyên khiên, phản đòn 100%, hoặc mị hoặc đối thủ tự sát.
