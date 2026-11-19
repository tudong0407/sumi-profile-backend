# 🌸 SuMi Family - Profile & Canvas Backend (Bước 1)

Backend kết xuất thẻ hồ sơ Profile đa tầng chuẩn HD (1000 x 500 px) và cơ sở dữ liệu Supabase cho Trợ lý Linh Hồ AI **Nhiễm Nhiễm (`916469360401453067`)** trên máy chủ **🦊 𝗦𝘂𝗠𝗶 𝗙𝗮𝗺𝗶𝗹𝘆 (`1026096141273661450`)**, thuộc quyền sở hữu của **Tiểu thư Fuyumi (`757091869183311872`)**.

---

## 📁 Cấu Trúc Dự Án

```
sumi-profile-backend/
├── schema.sql                 # Toàn bộ PostgreSQL Schema cho Supabase (5 bảng + views + seeds)
├── package.json               # Cấu hình dự án ES Module & dependencies
├── .env.example               # Mẫu cấu hình môi trường
├── .env                       # Cấu hình môi trường nội bộ
├── test_render.js             # Bộ test render trực tiếp ra file ảnh PNG
├── test_server_e2e.js         # Bộ test tích hợp HTTP API Server Express E2E
├── test_profile_fuyumi.png    # Ảnh kết xuất mẫu của Tiểu thư Fuyumi
├── test_profile_default.png   # Ảnh kết xuất mẫu của Tu Sĩ thường
├── test_profile_edge_case.png # Ảnh kết xuất mẫu kiểm thử trường hợp biên
└── src/
    ├── config/
    │   └── supabase.js        # Khởi tạo Supabase client (kèm chế độ fallback mock offline)
    ├── services/
    │   └── profileService.js  # Nghiệp vụ truy vấn hồ sơ, tính Cảnh Giới, EXP, Pet, Roles
    ├── canvas/
    │   ├── drawUtils.js       # Tiện ích đồ họa bo góc, cánh hoa đào, avatar procedural, khử ký tự lỗi
    │   └── profileRenderer.js # Render đồ họa Canvas 1000x500 6 tầng tuyệt mỹ
    └── server.js              # Express REST API Server
```

---

## 🗄️ Database Supabase Schema (`schema.sql`)

Bao gồm 5 bảng dữ liệu hoàn chỉnh:
1. `clans`: Gia tộc tu tiên, cấp độ bang, ngân khố, tộc trưởng.
2. `users`: Người dùng, kinh nghiệm (EXP), linh thạch, cảnh giới, danh hiệu, kết hôn, khung avatar.
3. `user_roles`: Túi đồ 110 roles, quản lý hạn dùng (1-90 ngày hoặc vĩnh viễn), 5 slots trang bị (`equipped_slot`).
4. `user_pets`: Linh thú chiến pet, chỉ số chiến lực (ATK, DEF, SPD, Power Score), độ hiếm.
5. `clan_wars`: Gia tộc chiến 24h, điểm tương tác, cược linh thạch, xác định bang thắng cuộc.

---

## 🚀 Khởi Chạy & Kiểm Thử

### Cài đặt dependencies
```bash
npm install
```

### Chạy toàn bộ kiểm thử (Canvas Render + HTTP E2E)
```bash
npm test
```

### Chạy API Server
```bash
npm start
```
- Health Check: `GET http://localhost:3000/health`
- Profile Fuyumi (PNG): `GET http://localhost:3000/api/profile/757091869183311872`
- Profile JSON: `GET http://localhost:3000/api/profile/757091869183311872?format=json`
- Custom Profile Render: `POST http://localhost:3000/api/profile/render`
