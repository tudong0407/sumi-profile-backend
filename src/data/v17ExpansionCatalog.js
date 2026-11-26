/**
 * src/data/v17ExpansionCatalog.js
 * Danh mục mở rộng Ver 1.7 (Staging — không public trước khi đủ toàn bộ asset ảnh):
 * - +60 Pet Thần Thoại mới (20 Tối Thượng Linh Thú + 10 Tối Thượng Thú Nhân + 30 Thần Thoại thường) -> Tổng 151 Pets
 * - 40 Thông số Tiến Hóa Tối Thượng Chân Thần (V17_PET_EVOLUTIONS: 10 gốc + 20 Linh Thú + 10 Thú Nhân) & 40 Ultimate tái kích hoạt
 * - +99 Pháp Bảo Thần Thoại mới (33 Vũ Khí + 33 Bảo Ngọc + 33 Chiến Hồn) -> Tổng 264 Pháp Bảo
 * - +101 Lãnh Địa Thần Thoại mới (35 Linh Vực + 33 Thần Thức + 33 Thần Cảnh) -> Tổng 66 Vực + 49 Thức + 49 Cảnh
 * - 9 Khung Viền Avatar mới (4 Shop thường 2.200–4.000 LT + 4 Shop Đặc Biệt 10–20 TT + 1 Kỷ Niệm 25 TT)
 * - 9 Vật phẩm mới (/shop & Shop Đặc Biệt & /explorer & /tienhoa)
 */
import { em } from '../config/emojiHelper.js';

export const V17_NEW_PETS = [
  {
    "pet_type": "hong_mong_nguyen_phuong",
    "pet_name": "« Hồng Mông Nguyên Phượng »",
    "element": "Hỗn Độn",
    "rarity": "Tối Thượng",
    "rarity_key": "mythic",
    "is_unique": true,
    "is_kemonomimi": false,
    "base_atk": 585,
    "base_def": 573,
    "base_spd": 585,
    "hax_skill": "Hồng Mông Tẩy Lễ",
    "hax_description": "Mỗi 2 hiệp tự thanh tẩy 1 debuff & chuyển 12% ST nhận vào thành Khiên Hỗn Độn; tăng +18% xuyên kháng.",
    "image_file": "pets/hong_mong_nguyen_phuong.webp",
    "is_starter": false,
    "is_exclusive_fuyumi": false,
    "drop_rate": 0.65,
    "base_hp": 3865,
    "base_power": 4121,
    "hax_config": {
      "label": "Hồng Mông Tẩy Lễ",
      "turnCleanseInterval": 2,
      "absorbDmgAsShieldPct": 0.14,
      "defPiercePct": 0.45
    }
  },
  {
    "pet_type": "thai_so_van_tuong_ho",
    "pet_name": "« Thái Sơ Vạn Tượng Hồ »",
    "element": "Hỗn Độn",
    "rarity": "Tối Thượng",
    "rarity_key": "mythic",
    "is_unique": true,
    "is_kemonomimi": false,
    "base_atk": 590,
    "base_def": 570,
    "base_spd": 595,
    "hax_skill": "Vạn Tượng Đảo Ảnh",
    "hax_description": "Sao chép 25% chỉ số mạnh nhất của đối thủ trong 3 hiệp đầu & phản 15% ST chuẩn mỗi khi bị khống chế.",
    "image_file": "pets/thai_so_van_tuong_ho.webp",
    "is_starter": false,
    "is_exclusive_fuyumi": false,
    "drop_rate": 0.65,
    "base_hp": 3850,
    "base_power": 4150,
    "hax_config": {
      "label": "Vạn Tượng Đảo Ảnh",
      "dodgePct": 0.24,
      "reflectPct": 0.4,
      "defPiercePct": 0.42
    }
  },
  {
    "pet_type": "phan_thien_kim_o_de",
    "pet_name": "« Phần Thiên Kim Ô Đế »",
    "element": "Hỏa",
    "rarity": "Tối Thượng",
    "rarity_key": "mythic",
    "is_unique": true,
    "is_kemonomimi": false,
    "base_atk": 605,
    "base_def": 508,
    "base_spd": 585,
    "hax_skill": "Tam Túc Kim Dương",
    "hax_description": "Đòn đánh thiêu đốt 5% MaxHP/hiệp (không thể giảm bởi DEF) và giảm 35% Hồi Máu địch trong 2 hiệp.",
    "image_file": "pets/phan_thien_kim_o_de.webp",
    "is_starter": false,
    "is_exclusive_fuyumi": false,
    "drop_rate": 0.65,
    "base_hp": 3540,
    "base_power": 4051,
    "hax_config": {
      "label": "Tam Túc Kim Dương",
      "burnOnHitPct": 0.08,
      "burnIgnoresShield": true,
      "enemyHealRedPct": 0.4
    }
  },
  {
    "pet_type": "xich_diem_chuc_long_vuong",
    "pet_name": "« Xích Diễm Chúc Long Vương »",
    "element": "Hỏa",
    "rarity": "Tối Thượng",
    "rarity_key": "mythic",
    "is_unique": true,
    "is_kemonomimi": false,
    "base_atk": 595,
    "base_def": 513,
    "base_spd": 595,
    "hax_skill": "Chúc Chiếu Phá Ám",
    "hax_description": "Bỏ qua 40% Né Tránh và tăng +28% sát thương lên mục tiêu đang có Khiên hoặc Ẩn Thân.",
    "image_file": "pets/xich_diem_chuc_long_vuong.webp",
    "is_starter": false,
    "is_exclusive_fuyumi": false,
    "drop_rate": 0.65,
    "base_hp": 3565,
    "base_power": 4051,
    "hax_config": {
      "label": "Chúc Chiếu Phá Ám",
      "critDodgeIgnorePct": 0.4,
      "antiShieldDmgBonusPct": 0.28,
      "defPiercePct": 0.45
    }
  },
  {
    "pet_type": "bach_de_tru_tien_ung",
    "pet_name": "« Bạch Đế Tru Tiên Ưng »",
    "element": "Kim",
    "rarity": "Tối Thượng",
    "rarity_key": "mythic",
    "is_unique": true,
    "is_kemonomimi": false,
    "base_atk": 610,
    "base_def": 505,
    "base_spd": 585,
    "hax_skill": "Lăng Tiêu Trảm Giáp",
    "hax_description": "Mỗi đòn đánh cắt vĩnh viễn 8% DEF địch (tối đa 32%) & tăng +20% Sát Thương Bạo Kích.",
    "image_file": "pets/bach_de_tru_tien_ung.webp",
    "is_starter": false,
    "is_exclusive_fuyumi": false,
    "drop_rate": 0.65,
    "base_hp": 3525,
    "base_power": 4060,
    "hax_config": {
      "label": "Lăng Tiêu Trảm Giáp",
      "defDebuffPerHitPct": 0.08,
      "defDebuffMaxTotal": 0.32,
      "flatCritPct": 0.18
    }
  },
  {
    "pet_type": "thai_bach_thien_kiem_lan",
    "pet_name": "« Thái Bạch Thiên Kiếm Lân »",
    "element": "Kim",
    "rarity": "Tối Thượng",
    "rarity_key": "mythic",
    "is_unique": true,
    "is_kemonomimi": false,
    "base_atk": 615,
    "base_def": 503,
    "base_spd": 595,
    "hax_skill": "Kiếm Cốt Phản Chấn",
    "hax_description": "Giảm 20% ST nhận từ đòn Bạo Kích & lập tức phản trảm 95% ATK xuyên 50% DEF khi bị đánh trúng.",
    "image_file": "pets/thai_bach_thien_kiem_lan.webp",
    "is_starter": false,
    "is_exclusive_fuyumi": false,
    "drop_rate": 0.65,
    "base_hp": 3515,
    "base_power": 4091,
    "hax_config": {
      "label": "Kiếm Cốt Phản Chấn",
      "critDmgRedPct": 0.25,
      "reflectPct": 0.45,
      "defPiercePct": 0.45
    }
  },
  {
    "pet_type": "thuong_hai_bang_phuong",
    "pet_name": "« Thương Hải Băng Phượng »",
    "element": "Thủy",
    "rarity": "Tối Thượng",
    "rarity_key": "mythic",
    "is_unique": true,
    "is_kemonomimi": false,
    "base_atk": 540,
    "base_def": 603,
    "base_spd": 555,
    "hax_skill": "Hàn Sương Phong Mạch",
    "hax_description": "Mỗi đòn làm chậm -15% SPD địch (cộng dồn 2 tầng) và có 28% đóng băng buff hồi máu của địch.",
    "image_file": "pets/thuong_hai_bang_phuong.webp",
    "is_starter": false,
    "is_exclusive_fuyumi": false,
    "drop_rate": 0.65,
    "base_hp": 4015,
    "base_power": 3986,
    "hax_config": {
      "label": "Hàn Sương Phong Mạch",
      "ccProc": {
        "chance": 0.28,
        "kind": "freeze",
        "skill": "Hàn Sương Phong Mạch"
      },
      "enemyHealRedPct": 0.3
    }
  },
  {
    "pet_type": "huyen_minh_co_long_vuong",
    "pet_name": "« Huyền Minh Cổ Long Vương »",
    "element": "Thủy",
    "rarity": "Tối Thượng",
    "rarity_key": "mythic",
    "is_unique": true,
    "is_kemonomimi": false,
    "base_atk": 545,
    "base_def": 600,
    "base_spd": 565,
    "hax_skill": "Hải Triều Tịnh Hóa",
    "hax_description": "Đầu mỗi 2 hiệp tự tạo Khiên 16% MaxHP & xóa 1 hiệu ứng Độc/Thiêu Đốt trên bản thân.",
    "image_file": "pets/huyen_minh_co_long_vuong.webp",
    "is_starter": false,
    "is_exclusive_fuyumi": false,
    "drop_rate": 0.65,
    "base_hp": 4000,
    "base_power": 4015,
    "hax_config": {
      "label": "Hải Triều Tịnh Hóa",
      "startShieldPct": 0.55,
      "turnCleanseInterval": 2,
      "dmgRedPct": 0.2
    }
  },
  {
    "pet_type": "tinh_ha_hu_khong_long",
    "pet_name": "« Tinh Hà Hư Không Long »",
    "element": "Hư Không",
    "rarity": "Tối Thượng",
    "rarity_key": "mythic",
    "is_unique": true,
    "is_kemonomimi": false,
    "base_atk": 575,
    "base_def": 543,
    "base_spd": 595,
    "hax_skill": "Tinh Dịch Xuyên Vực",
    "hax_description": "Có 25% Né đòn hoàn toàn; mỗi khi Né thành công lập tức cướp 12% ATK địch trong 2 hiệp & hồi 8% MaxHP.",
    "image_file": "pets/tinh_ha_hu_khong_long.webp",
    "is_starter": false,
    "is_exclusive_fuyumi": false,
    "drop_rate": 0.65,
    "base_hp": 3715,
    "base_power": 4051,
    "hax_config": {
      "label": "Tinh Dịch Xuyên Vực",
      "dodgePct": 0.26,
      "stealAtkPerHitPct": 0.06,
      "stealAtkMaxStacks": 3,
      "turnHealPct": 0.06
    }
  },
  {
    "pet_type": "vo_cuc_nguyet_anh_diep",
    "pet_name": "« Vô Cực Nguyệt Ảnh Điệp »",
    "element": "Hư Không",
    "rarity": "Tối Thượng",
    "rarity_key": "mythic",
    "is_unique": true,
    "is_kemonomimi": false,
    "base_atk": 565,
    "base_def": 548,
    "base_spd": 605,
    "hax_skill": "Mộng Cảnh Đoạn Nhịp",
    "hax_description": "Giảm 25% hiệu lực debuff DoT (Độc/Thiêu Đốt) nhận vào & 30% khiến địch đánh hụt vào ảo ảnh.",
    "image_file": "pets/vo_cuc_nguyet_anh_diep.webp",
    "is_starter": false,
    "is_exclusive_fuyumi": false,
    "drop_rate": 0.65,
    "base_hp": 3740,
    "base_power": 4051,
    "hax_config": {
      "label": "Mộng Cảnh Đoạn Nhịp",
      "dotResistPct": 0.35,
      "blindTurns": 2,
      "ccProc": {
        "chance": 0.25,
        "kind": "sleep",
        "skill": "Mộng Cảnh Đoạn Nhịp"
      }
    }
  },
  {
    "pet_type": "cuu_tieu_thanh_loan",
    "pet_name": "« Cửu Tiêu Thánh Loan »",
    "element": "Quang",
    "rarity": "Tối Thượng",
    "rarity_key": "mythic",
    "is_unique": true,
    "is_kemonomimi": false,
    "base_atk": 550,
    "base_def": 570,
    "base_spd": 575,
    "hax_skill": "Thánh Vũ Hộ Mệnh",
    "hax_description": "Mỗi hiệp hồi 7% MaxHP & tăng +15% hiệu quả Khiên; khi HP dưới 40% tự thanh tẩy toàn bộ debuff 1 lần/trận.",
    "image_file": "pets/cuu_tieu_thanh_loan.webp",
    "is_starter": false,
    "is_exclusive_fuyumi": false,
    "drop_rate": 0.65,
    "base_hp": 3850,
    "base_power": 3990,
    "hax_config": {
      "label": "Thánh Vũ Hộ Mệnh",
      "turnHealPct": 0.08,
      "startShieldPct": 0.4,
      "emergencyHealPct": 0.3,
      "emergencyThreshold": 0.4,
      "emergencyDefBonusPct": 0.15
    }
  },
  {
    "pet_type": "nhat_nguyet_thien_ma_de",
    "pet_name": "« Nhật Nguyệt Thiên Mã Đế »",
    "element": "Quang",
    "rarity": "Tối Thượng",
    "rarity_key": "mythic",
    "is_unique": true,
    "is_kemonomimi": false,
    "base_atk": 555,
    "base_def": 568,
    "base_spd": 585,
    "hax_skill": "Quang Tốc Phá Trận",
    "hax_description": "Tăng +18% SPD gốc & đòn đầu tiên mỗi 2 hiệp gây thêm 14% MaxHP sát thương Quang Minh xuyên 60% DEF.",
    "image_file": "pets/nhat_nguyet_thien_ma_de.webp",
    "is_starter": false,
    "is_exclusive_fuyumi": false,
    "drop_rate": 0.65,
    "base_hp": 3840,
    "base_power": 4021,
    "hax_config": {
      "label": "Quang Tốc Phá Trận",
      "earlySpdBonusTurns": 3,
      "earlySpdBonusPct": 0.22,
      "every2TurnStrike": {
        "atkRatio": 0.78,
        "defPierce": 0.6,
        "label": "Quang Tốc Phá Trận"
      }
    }
  },
  {
    "pet_type": "vinh_da_huyet_nha_hoang",
    "pet_name": "« Vĩnh Dạ Huyết Nha Hoàng »",
    "element": "Ám",
    "rarity": "Tối Thượng",
    "rarity_key": "mythic",
    "is_unique": true,
    "is_kemonomimi": false,
    "base_atk": 605,
    "base_def": 503,
    "base_spd": 590,
    "hax_skill": "Huyết Ấn Phệ Hồn",
    "hax_description": "Hút 20% sát thương gây ra thành HP & mỗi đòn đặt 1 ấn Huyết Khô giảm 15% phòng thủ hồi phục địch.",
    "image_file": "pets/vinh_da_huyet_nha_hoang.webp",
    "is_starter": false,
    "is_exclusive_fuyumi": false,
    "drop_rate": 0.65,
    "base_hp": 3515,
    "base_power": 4051,
    "hax_config": {
      "label": "Huyết Ấn Phệ Hồn",
      "lifestealPct": 0.24,
      "enemyHealRedPct": 0.4
    }
  },
  {
    "pet_type": "u_minh_man_chau_ho",
    "pet_name": "« U Minh Mạn Châu Hồ »",
    "element": "Ám",
    "rarity": "Tối Thượng",
    "rarity_key": "mythic",
    "is_unique": true,
    "is_kemonomimi": false,
    "base_atk": 610,
    "base_def": 500,
    "base_spd": 600,
    "hax_skill": "Bỉ Ngạn Mê Hồn",
    "hax_description": "Giảm 18% ATK & 15% Bạo Kích của địch trong 3 hiệp đầu; đòn đánh có 30% gây Nguyền Rủa trừ 6% HP/hiệp.",
    "image_file": "pets/u_minh_man_chau_ho.webp",
    "is_starter": false,
    "is_exclusive_fuyumi": false,
    "drop_rate": 0.65,
    "base_hp": 3500,
    "base_power": 4080,
    "hax_config": {
      "label": "Bỉ Ngạn Mê Hồn",
      "startAtkDebuffPct": 0.2,
      "startAtkDebuffTurns": 3,
      "burnOnHitPct": 0.07
    }
  },
  {
    "pet_type": "van_hoa_linh_loc_vuong",
    "pet_name": "« Vạn Hoa Linh Lộc Vương »",
    "element": "Mộc",
    "rarity": "Tối Thượng",
    "rarity_key": "mythic",
    "is_unique": true,
    "is_kemonomimi": false,
    "base_atk": 545,
    "base_def": 588,
    "base_spd": 570,
    "hax_skill": "Bách Hoa Giải Độc",
    "hax_description": "Miễn nhiễm 50% sát thương Độc/Thiêu Đốt & mỗi 2 hiệp hồi 12% MaxHP kèm xóa 1 debuff.",
    "image_file": "pets/van_hoa_linh_loc_vuong.webp",
    "is_starter": false,
    "is_exclusive_fuyumi": false,
    "drop_rate": 0.65,
    "base_hp": 3940,
    "base_power": 4001,
    "hax_config": {
      "label": "Bách Hoa Giải Độc",
      "dotResistPct": 0.5,
      "turnHealPct": 0.09,
      "turnCleanseInterval": 2
    }
  },
  {
    "pet_type": "thai_at_co_moc_phuong",
    "pet_name": "« Thái Ất Cổ Mộc Phượng »",
    "element": "Mộc",
    "rarity": "Tối Thượng",
    "rarity_key": "mythic",
    "is_unique": true,
    "is_kemonomimi": false,
    "base_atk": 535,
    "base_def": 593,
    "base_spd": 580,
    "hax_skill": "Sinh Cơ Bất Tuyệt",
    "hax_description": "Gieo Độc Dây Leo 5% MaxHP/hiệp xuyên giáp & chuyển hóa 40% ST Độc gây ra thành Khiên cho bản thân.",
    "image_file": "pets/thai_at_co_moc_phuong.webp",
    "is_starter": false,
    "is_exclusive_fuyumi": false,
    "drop_rate": 0.65,
    "base_hp": 3965,
    "base_power": 4001,
    "hax_config": {
      "label": "Sinh Cơ Bất Tuyệt",
      "poisonPct": 0.07,
      "absorbDmgAsShieldPct": 0.24
    }
  },
  {
    "pet_type": "tu_tieu_thien_loi_long",
    "pet_name": "« Tử Tiêu Thiên Lôi Long »",
    "element": "Lôi",
    "rarity": "Tối Thượng",
    "rarity_key": "mythic",
    "is_unique": true,
    "is_kemonomimi": false,
    "base_atk": 590,
    "base_def": 490,
    "base_spd": 625,
    "hax_skill": "Tử Lôi Phá Thuẫn",
    "hax_description": "Gây thêm +45% sát thương lên Khiên của địch & có 25% gây Tê Liệt giảm 25% SPD địch 2 hiệp.",
    "image_file": "pets/tu_tieu_thien_loi_long.webp",
    "is_starter": false,
    "is_exclusive_fuyumi": false,
    "drop_rate": 0.65,
    "base_hp": 3450,
    "base_power": 4050,
    "hax_config": {
      "label": "Tử Lôi Phá Thuẫn",
      "antiShieldDmgBonusPct": 0.35,
      "ccProc": {
        "chance": 0.26,
        "kind": "stun",
        "skill": "Tử Lôi Phá Thuẫn"
      }
    }
  },
  {
    "pet_type": "loi_hoang_kim_dieu",
    "pet_name": "« Lôi Hoàng Kim Điêu »",
    "element": "Lôi",
    "rarity": "Tối Thượng",
    "rarity_key": "mythic",
    "is_unique": true,
    "is_kemonomimi": false,
    "base_atk": 595,
    "base_def": 488,
    "base_spd": 635,
    "hax_skill": "Thiểm Điện Tiên Thủ",
    "hax_description": "Khởi trận tăng +30% SPD trong 2 hiệp đầu & đòn đánh luôn kích thêm 1 tia sét phụ 45% ATK bỏ qua Né.",
    "image_file": "pets/loi_hoang_kim_dieu.webp",
    "is_starter": false,
    "is_exclusive_fuyumi": false,
    "drop_rate": 0.65,
    "base_hp": 3440,
    "base_power": 4081,
    "hax_config": {
      "label": "Thiểm Điện Tiên Thủ",
      "earlySpdBonusTurns": 2,
      "earlySpdBonusPct": 0.3,
      "extraStrike": {
        "chance": 0.32,
        "atkRatio": 0.55,
        "defPierce": 0.5,
        "label": "Thiểm Điện Tiên Thủ"
      }
    }
  },
  {
    "pet_type": "hau_tho_tran_nhac_quy",
    "pet_name": "« Hậu Thổ Trấn Nhạc Quy »",
    "element": "Thổ",
    "rarity": "Tối Thượng",
    "rarity_key": "mythic",
    "is_unique": true,
    "is_kemonomimi": false,
    "base_atk": 525,
    "base_def": 648,
    "base_spd": 515,
    "hax_skill": "Bất Động Sơn Nhạc",
    "hax_description": "Giảm 25% toàn bộ sát thương chuẩn (True Damage) & phản 22% sát thương trực tiếp nhận vào.",
    "image_file": "pets/hau_tho_tran_nhac_quy.webp",
    "is_starter": false,
    "is_exclusive_fuyumi": false,
    "drop_rate": 0.65,
    "base_hp": 4240,
    "base_power": 3951,
    "hax_config": {
      "label": "Bất Động Sơn Nhạc",
      "trueDmgResistPct": 0.25,
      "reflectPct": 0.38,
      "dmgRedPct": 0.22
    }
  },
  {
    "pet_type": "huyen_hoang_thach_su",
    "pet_name": "« Huyền Hoàng Thạch Sư »",
    "element": "Thổ",
    "rarity": "Tối Thượng",
    "rarity_key": "mythic",
    "is_unique": true,
    "is_kemonomimi": false,
    "base_atk": 530,
    "base_def": 645,
    "base_spd": 525,
    "hax_skill": "Hoàng Kim Phá Địa",
    "hax_description": "Chuyển hóa 35% DEF thành ATK cộng thêm khi tấn công & nhận Khiên 18% MaxHP mỗi 3 hiệp.",
    "image_file": "pets/huyen_hoang_thach_su.webp",
    "is_starter": false,
    "is_exclusive_fuyumi": false,
    "drop_rate": 0.65,
    "base_hp": 4225,
    "base_power": 3980,
    "hax_config": {
      "label": "Hoàng Kim Phá Địa",
      "startShieldPct": 0.6,
      "shieldActiveAtkBonusPct": 0.2
    }
  },
  {
    "pet_type": "hong_mong_cuu_vy_tien",
    "pet_name": "« Hồng Mông Cửu Vĩ Tiên »",
    "element": "Hỗn Độn",
    "rarity": "Tối Thượng",
    "rarity_key": "mythic",
    "is_unique": true,
    "is_kemonomimi": true,
    "archetype": "Hồ Ly Bán Nhân (Nữ)",
    "base_atk": 595,
    "base_def": 568,
    "base_spd": 585,
    "hax_skill": "Hồng Mông Mị Ấn",
    "hax_description": "Giảm 20% ATK địch & chuyển 15% ST gây ra thành Khiên Hỗn Độn; tăng +18% Xuyên Kháng.",
    "image_file": "pets/hong_mong_cuu_vy_tien.webp",
    "is_starter": false,
    "is_exclusive_fuyumi": false,
    "drop_rate": 0.65,
    "base_hp": 3840,
    "base_power": 4141,
    "hax_config": {
      "label": "Hồng Mông Mị Ấn",
      "startAtkDebuffPct": 0.2,
      "startAtkDebuffTurns": 3,
      "absorbDmgAsShieldPct": 0.2,
      "defPiercePct": 0.45
    }
  },
  {
    "pet_type": "huyet_nguyet_thien_lang_nu",
    "pet_name": "« Huyết Nguyệt Thiên Lang Nữ »",
    "element": "Ám",
    "rarity": "Tối Thượng",
    "rarity_key": "mythic",
    "is_unique": true,
    "is_kemonomimi": true,
    "archetype": "Lang Nhân Bán Nhân (Nữ — Chuẩn Mẫu Duyệt)",
    "base_atk": 605,
    "base_def": 503,
    "base_spd": 600,
    "hax_skill": "Huyết Nguyệt Phệ Hồn",
    "hax_description": "Hút 22% ST gây ra thành HP & mỗi đòn đặt ấn Huyết Hoa giảm 20% Hồi Máu địch (cộng dồn 2 tầng).",
    "image_file": "pets/huyet_nguyet_thien_lang_nu.webp",
    "is_starter": false,
    "is_exclusive_fuyumi": false,
    "drop_rate": 0.65,
    "base_hp": 3515,
    "base_power": 4071,
    "hax_config": {
      "label": "Huyết Nguyệt Phệ Hồn",
      "lifestealPct": 0.26,
      "enemyHealRedPct": 0.42
    }
  },
  {
    "pet_type": "xich_diem_phuong_hoang_co",
    "pet_name": "« Xích Diễm Phượng Hoàng Cơ »",
    "element": "Hỏa",
    "rarity": "Tối Thượng",
    "rarity_key": "mythic",
    "is_unique": true,
    "is_kemonomimi": true,
    "archetype": "Phượng Nhân Bán Nhân (Nữ)",
    "base_atk": 600,
    "base_def": 510,
    "base_spd": 585,
    "hax_skill": "Niết Bàn Diệm Vũ",
    "hax_description": "Đòn đánh gây Thiêu Đốt 5% MaxHP/hiệp xuyên giáp & hồi sinh 1 lần với 35% HP kèm Khiên Lửa 20% MaxHP.",
    "image_file": "pets/xich_diem_phuong_hoang_co.webp",
    "is_starter": false,
    "is_exclusive_fuyumi": false,
    "drop_rate": 0.65,
    "base_hp": 3550,
    "base_power": 4040,
    "hax_config": {
      "label": "Niết Bàn Diệm Vũ",
      "burnOnHitPct": 0.08,
      "reviveHpPct": 0.38,
      "reviveShieldPct": 0.2
    }
  },
  {
    "pet_type": "bach_de_kiem_ho_quan",
    "pet_name": "« Bạch Đế Kiếm Hổ Quân »",
    "element": "Kim",
    "rarity": "Tối Thượng",
    "rarity_key": "mythic",
    "is_unique": true,
    "is_kemonomimi": true,
    "archetype": "Bạch Hổ Bán Nhân (Nam)",
    "base_atk": 615,
    "base_def": 503,
    "base_spd": 595,
    "hax_skill": "Bạch Đế Kiếm Ý",
    "hax_description": "Xuyên 30% DEF & tăng +25% Sát Thương Bạo Kích; mỗi đòn Bạo Kích cắt thêm 10% Khiên địch.",
    "image_file": "pets/bach_de_kiem_ho_quan.webp",
    "is_starter": false,
    "is_exclusive_fuyumi": false,
    "drop_rate": 0.65,
    "base_hp": 3515,
    "base_power": 4091,
    "hax_config": {
      "label": "Bạch Đế Kiếm Ý",
      "defPiercePct": 0.5,
      "flatCritPct": 0.2,
      "critShieldPiercePct": 0.65
    }
  },
  {
    "pet_type": "thuong_hai_long_nu",
    "pet_name": "« Thương Hải Long Nữ »",
    "element": "Thủy",
    "rarity": "Tối Thượng",
    "rarity_key": "mythic",
    "is_unique": true,
    "is_kemonomimi": true,
    "archetype": "Long Nhân Bán Nhân (Nữ)",
    "base_atk": 540,
    "base_def": 603,
    "base_spd": 555,
    "hax_skill": "Thương Hải Băng Tâm",
    "hax_description": "Đầu mỗi 2 hiệp dựng Khiên 18% MaxHP & thanh tẩy 1 debuff Độc/Thiêu Đốt; làm chậm -15% SPD địch.",
    "image_file": "pets/thuong_hai_long_nu.webp",
    "is_starter": false,
    "is_exclusive_fuyumi": false,
    "drop_rate": 0.65,
    "base_hp": 4015,
    "base_power": 3986,
    "hax_config": {
      "label": "Thương Hải Băng Tâm",
      "startShieldPct": 0.58,
      "turnCleanseInterval": 2,
      "startSpdDebuffPct": 0.16
    }
  },
  {
    "pet_type": "tu_tieu_loi_ho_quan",
    "pet_name": "« Tử Tiêu Lôi Hồ Quân »",
    "element": "Lôi",
    "rarity": "Tối Thượng",
    "rarity_key": "mythic",
    "is_unique": true,
    "is_kemonomimi": true,
    "archetype": "Lôi Hồ Bán Nhân (Nam)",
    "base_atk": 590,
    "base_def": 490,
    "base_spd": 635,
    "hax_skill": "Tử Tiêu Tật Điện",
    "hax_description": "Tăng +22% SPD gốc & mỗi đòn gây thêm +40% ST lên Khiên địch kèm 22% tỷ lệ gây Choáng 1 hiệp.",
    "image_file": "pets/tu_tieu_loi_ho_quan.webp",
    "is_starter": false,
    "is_exclusive_fuyumi": false,
    "drop_rate": 0.65,
    "base_hp": 3450,
    "base_power": 4070,
    "hax_config": {
      "label": "Tử Tiêu Tật Điện",
      "antiShieldDmgBonusPct": 0.32,
      "ccProc": {
        "chance": 0.25,
        "kind": "stun",
        "skill": "Tử Tiêu Tật Điện"
      },
      "earlySpdBonusTurns": 2,
      "earlySpdBonusPct": 0.22
    }
  },
  {
    "pet_type": "van_hoa_linh_loc_co",
    "pet_name": "« Vạn Hoa Linh Lộc Cơ »",
    "element": "Mộc",
    "rarity": "Tối Thượng",
    "rarity_key": "mythic",
    "is_unique": true,
    "is_kemonomimi": true,
    "archetype": "Lộc Nhân Bán Nhân (Nữ)",
    "base_atk": 545,
    "base_def": 588,
    "base_spd": 570,
    "hax_skill": "Anh Hoa Tịnh Thế",
    "hax_description": "Mỗi hiệp hồi 8% MaxHP, giảm 40% sát thương Độc/Thiêu Đốt & mỗi 3 hiệp xóa 1 debuff cho phe ta.",
    "image_file": "pets/van_hoa_linh_loc_co.webp",
    "is_starter": false,
    "is_exclusive_fuyumi": false,
    "drop_rate": 0.65,
    "base_hp": 3940,
    "base_power": 4001,
    "hax_config": {
      "label": "Anh Hoa Tịnh Thế",
      "turnHealPct": 0.08,
      "dotResistPct": 0.45,
      "turnCleanseInterval": 3
    }
  },
  {
    "pet_type": "thai_am_ngoc_tho_tien",
    "pet_name": "« Thái Âm Ngọc Thố Tiên »",
    "element": "Quang",
    "rarity": "Tối Thượng",
    "rarity_key": "mythic",
    "is_unique": true,
    "is_kemonomimi": true,
    "archetype": "Thố Nhân Bán Nhân (Nữ)",
    "base_atk": 545,
    "base_def": 573,
    "base_spd": 585,
    "hax_skill": "Nguyệt Quang Hộ Mệnh",
    "hax_description": "Tăng +20% Kháng ST & +16% Né Tránh; mỗi lần Né hoặc hồi HP tăng +12% ATK (tối đa 36%).",
    "image_file": "pets/thai_am_ngoc_tho_tien.webp",
    "is_starter": false,
    "is_exclusive_fuyumi": false,
    "drop_rate": 0.65,
    "base_hp": 3865,
    "base_power": 4001,
    "hax_config": {
      "label": "Nguyệt Quang Hộ Mệnh",
      "dmgRedPct": 0.22,
      "dodgePct": 0.18,
      "atkStackPct": 0.06,
      "atkStackMax": 4
    }
  },
  {
    "pet_type": "tinh_ha_nguyet_mieu_co",
    "pet_name": "« Tinh Hà Nguyệt Miêu Cơ »",
    "element": "Hư Không",
    "rarity": "Tối Thượng",
    "rarity_key": "mythic",
    "is_unique": true,
    "is_kemonomimi": true,
    "archetype": "Miêu Nhân Bán Nhân (Nữ)",
    "base_atk": 570,
    "base_def": 545,
    "base_spd": 595,
    "hax_skill": "Tinh Ảnh Ảo Mộng",
    "hax_description": "Có 26% Né đòn hoàn toàn & 30% phản ngược 1 debuff vừa nhận về phía kẻ địch.",
    "image_file": "pets/tinh_ha_nguyet_mieu_co.webp",
    "is_starter": false,
    "is_exclusive_fuyumi": false,
    "drop_rate": 0.65,
    "base_hp": 3725,
    "base_power": 4040,
    "hax_config": {
      "label": "Tinh Ảnh Ảo Mộng",
      "dodgePct": 0.26,
      "reflectPct": 0.32,
      "dodgeCounterAtkRatio": 0.7,
      "dodgeCounterLabel": "Tinh Ảnh Ảo Mộng"
    }
  },
  {
    "pet_type": "hoang_thien_ky_lan_quan",
    "pet_name": "« Hoàng Thiên Kỳ Lân Quân »",
    "element": "Thổ",
    "rarity": "Tối Thượng",
    "rarity_key": "mythic",
    "is_unique": true,
    "is_kemonomimi": true,
    "archetype": "Kỳ Lân Bán Nhân (Nam)",
    "base_atk": 535,
    "base_def": 643,
    "base_spd": 525,
    "hax_skill": "Kỳ Lân Trấn Sơn",
    "hax_description": "Giảm 25% ST chuẩn nhận vào & chuyển 35% DEF thành ATK cộng thêm khi phản kích hoặc tấn công.",
    "image_file": "pets/hoang_thien_ky_lan_quan.webp",
    "is_starter": false,
    "is_exclusive_fuyumi": false,
    "drop_rate": 0.65,
    "base_hp": 4215,
    "base_power": 3991,
    "hax_config": {
      "label": "Kỳ Lân Trấn Sơn",
      "trueDmgResistPct": 0.25,
      "startShieldPct": 0.62,
      "reflectPct": 0.35
    }
  },
  {
    "pet_type": "kim_linh_kiem_dieu",
    "pet_name": "Kim Linh Kiếm Điêu",
    "element": "Kim",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "is_kemonomimi": false,
    "base_atk": 590,
    "base_def": 493,
    "base_spd": 570,
    "hax_skill": "Phong Nhận Trảm",
    "hax_description": "Xuyên 25% DEF & tăng +15% Bạo Kích.",
    "image_file": "pets/kim_linh_kiem_dieu.webp",
    "is_starter": false,
    "is_exclusive_fuyumi": false,
    "drop_rate": 0.65,
    "base_hp": 3465,
    "base_power": 3946,
    "hax_config": {
      "label": "Phong Nhận Trảm",
      "defPiercePct": 0.35,
      "flatCritPct": 0.15
    }
  },
  {
    "pet_type": "bach_ngoc_kiem_ho",
    "pet_name": "Bạch Ngọc Kiếm Hổ",
    "element": "Kim",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "is_kemonomimi": false,
    "base_atk": 595,
    "base_def": 490,
    "base_spd": 580,
    "hax_skill": "Bạch Hổ Phá Thuẫn",
    "hax_description": "Gây thêm +35% sát thương lên Khiên chắn địch.",
    "image_file": "pets/bach_ngoc_kiem_ho.webp",
    "is_starter": false,
    "is_exclusive_fuyumi": false,
    "drop_rate": 0.65,
    "base_hp": 3450,
    "base_power": 3975,
    "hax_config": {
      "label": "Bạch Hổ Phá Thuẫn",
      "antiShieldDmgBonusPct": 0.32,
      "defPiercePct": 0.35
    }
  },
  {
    "pet_type": "thien_cuong_kim_bao",
    "pet_name": "Thiên Cương Kim Báo",
    "element": "Kim",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "is_kemonomimi": false,
    "base_atk": 600,
    "base_def": 488,
    "base_spd": 570,
    "hax_skill": "Cương Nha Truy Kích",
    "hax_description": "Tăng +14% SPD & 22% đánh bồi thêm đòn 55% ATK.",
    "image_file": "pets/thien_cuong_kim_bao.webp",
    "is_starter": false,
    "is_exclusive_fuyumi": false,
    "drop_rate": 0.65,
    "base_hp": 3440,
    "base_power": 3966,
    "hax_config": {
      "label": "Cương Nha Truy Kích",
      "extraStrike": {
        "chance": 0.24,
        "atkRatio": 0.55,
        "defPierce": 0.35,
        "label": "Cương Nha Truy Kích"
      }
    }
  },
  {
    "pet_type": "linh_kim_phuong_vu",
    "pet_name": "Linh Kim Phượng Vũ",
    "element": "Kim",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "is_kemonomimi": false,
    "base_atk": 590,
    "base_def": 493,
    "base_spd": 580,
    "hax_skill": "Kim Vũ Tán Xạ",
    "hax_description": "Mỗi đòn giảm 10% DEF địch 2 hiệp & +12% Chính Xác.",
    "image_file": "pets/linh_kim_phuong_vu.webp",
    "is_starter": false,
    "is_exclusive_fuyumi": false,
    "drop_rate": 0.65,
    "base_hp": 3465,
    "base_power": 3966,
    "hax_config": {
      "label": "Kim Vũ Tán Xạ",
      "defDebuffPerHitPct": 0.1,
      "defDebuffMaxTotal": 0.3,
      "flatAccuracyBonus": 0.12
    }
  },
  {
    "pet_type": "bich_ngoc_linh_ho",
    "pet_name": "Bích Ngọc Linh Hồ",
    "element": "Mộc",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "is_kemonomimi": false,
    "base_atk": 525,
    "base_def": 575,
    "base_spd": 555,
    "hax_skill": "Linh Diệp Tịnh Hóa",
    "hax_description": "Mỗi 2 hiệp hồi 8% MaxHP & giảm 20% ST Độc/Thiêu Đốt.",
    "image_file": "pets/bich_ngoc_linh_ho.webp",
    "is_starter": false,
    "is_exclusive_fuyumi": false,
    "drop_rate": 0.65,
    "base_hp": 3875,
    "base_power": 3885,
    "hax_config": {
      "label": "Linh Diệp Tịnh Hóa",
      "turnHealPct": 0.08,
      "dotResistPct": 0.35
    }
  },
  {
    "pet_type": "xuan_lam_thanh_loc",
    "pet_name": "Xuân Lâm Thanh Lộc",
    "element": "Mộc",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "is_kemonomimi": false,
    "base_atk": 530,
    "base_def": 573,
    "base_spd": 565,
    "hax_skill": "Xuân Phong Hộ Thể",
    "hax_description": "Khởi trận tạo Khiên 18% MaxHP & tăng +15% hiệu quả Hồi Máu.",
    "image_file": "pets/xuan_lam_thanh_loc.webp",
    "is_starter": false,
    "is_exclusive_fuyumi": false,
    "drop_rate": 0.65,
    "base_hp": 3865,
    "base_power": 3916,
    "hax_config": {
      "label": "Xuân Phong Hộ Thể",
      "startShieldPct": 0.35,
      "turnHealPct": 0.07
    }
  },
  {
    "pet_type": "thien_dang_moc_xa",
    "pet_name": "Thiên Đằng Mộc Xà",
    "element": "Mộc",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "is_kemonomimi": false,
    "base_atk": 520,
    "base_def": 578,
    "base_spd": 555,
    "hax_skill": "Cổ Đằng Triền Thân",
    "hax_description": "Gieo Độc 4% MaxHP/hiệp (2 hiệp) & giảm 12% SPD địch.",
    "image_file": "pets/thien_dang_moc_xa.webp",
    "is_starter": false,
    "is_exclusive_fuyumi": false,
    "drop_rate": 0.65,
    "base_hp": 3890,
    "base_power": 3876,
    "hax_config": {
      "label": "Cổ Đằng Triền Thân",
      "poisonPct": 0.07,
      "startSpdDebuffPct": 0.14
    }
  },
  {
    "pet_type": "bang_tam_tuyet_ho",
    "pet_name": "Băng Tâm Tuyết Hồ",
    "element": "Thủy",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "is_kemonomimi": false,
    "base_atk": 530,
    "base_def": 585,
    "base_spd": 550,
    "hax_skill": "Tuyết Vực Hàn Khí",
    "hax_description": "Giảm 15% ATK địch 2 hiệp & tăng +16% Kháng Bạo Kích.",
    "image_file": "pets/bang_tam_tuyet_ho.webp",
    "is_starter": false,
    "is_exclusive_fuyumi": false,
    "drop_rate": 0.65,
    "base_hp": 3925,
    "base_power": 3910,
    "hax_config": {
      "label": "Tuyết Vực Hàn Khí",
      "startAtkDebuffPct": 0.16,
      "startAtkDebuffTurns": 3,
      "critDmgRedPct": 0.22
    }
  },
  {
    "pet_type": "lam_hai_giao_long",
    "pet_name": "Lam Hải Giao Long",
    "element": "Thủy",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "is_kemonomimi": false,
    "base_atk": 535,
    "base_def": 583,
    "base_spd": 540,
    "hax_skill": "Thương Lãng Xung Kích",
    "hax_description": "Đòn đánh xuyên 20% Khiên & hồi 6% MaxHP bản thân.",
    "image_file": "pets/lam_hai_giao_long.webp",
    "is_starter": false,
    "is_exclusive_fuyumi": false,
    "drop_rate": 0.65,
    "base_hp": 3915,
    "base_power": 3901,
    "hax_config": {
      "label": "Thương Lãng Xung Kích",
      "shieldPiercePct": 0.45,
      "turnHealPct": 0.06
    }
  },
  {
    "pet_type": "ngoc_lo_linh_hac",
    "pet_name": "Ngọc Lộ Linh Hạc",
    "element": "Thủy",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "is_kemonomimi": false,
    "base_atk": 525,
    "base_def": 588,
    "base_spd": 550,
    "hax_skill": "Cam Lộ Tẩy Trần",
    "hax_description": "Mỗi 3 hiệp xóa 1 debuff & dựng Khiên 15% MaxHP.",
    "image_file": "pets/ngoc_lo_linh_hac.webp",
    "is_starter": false,
    "is_exclusive_fuyumi": false,
    "drop_rate": 0.65,
    "base_hp": 3940,
    "base_power": 3901,
    "hax_config": {
      "label": "Cam Lộ Tẩy Trần",
      "turnCleanseInterval": 3,
      "startShieldPct": 0.35
    }
  },
  {
    "pet_type": "xich_hoa_linh_ho",
    "pet_name": "Xích Hỏa Linh Hồ",
    "element": "Hỏa",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "is_kemonomimi": false,
    "base_atk": 585,
    "base_def": 495,
    "base_spd": 570,
    "hax_skill": "Hồng Liên Phần Tâm",
    "hax_description": "Đòn đánh gây Thiêu Đốt 4% MaxHP/hiệp & giảm 25% Hồi Máu địch.",
    "image_file": "pets/xich_hoa_linh_ho.webp",
    "is_starter": false,
    "is_exclusive_fuyumi": false,
    "drop_rate": 0.65,
    "base_hp": 3475,
    "base_power": 3935,
    "hax_config": {
      "label": "Hồng Liên Phần Tâm",
      "burnOnHitPct": 0.07,
      "enemyHealRedPct": 0.32
    }
  },
  {
    "pet_type": "viem_vuong_hoa_su",
    "pet_name": "Viêm Vương Hỏa Sư",
    "element": "Hỏa",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "is_kemonomimi": false,
    "base_atk": 590,
    "base_def": 493,
    "base_spd": 580,
    "hax_skill": "Liệt Diệm Cuồng Trảo",
    "hax_description": "Tăng +18% ATK khi HP dưới 60% & xuyên 20% DEF.",
    "image_file": "pets/viem_vuong_hoa_su.webp",
    "is_starter": false,
    "is_exclusive_fuyumi": false,
    "drop_rate": 0.65,
    "base_hp": 3465,
    "base_power": 3966,
    "hax_config": {
      "label": "Liệt Diệm Cuồng Trảo",
      "lowHpThreshold": 0.6,
      "lowHpBonusDmgPct": 0.2,
      "defPiercePct": 0.32
    }
  },
  {
    "pet_type": "chu_diem_thien_dieu",
    "pet_name": "Chu Diễm Thiên Điểu",
    "element": "Hỏa",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "is_kemonomimi": false,
    "base_atk": 580,
    "base_def": 498,
    "base_spd": 570,
    "hax_skill": "Diệm Vũ Liên Kích",
    "hax_description": "Mỗi 2 hiệp bắn thêm 1 luồng lửa 60% ATK bỏ qua Né.",
    "image_file": "pets/chu_diem_thien_dieu.webp",
    "is_starter": false,
    "is_exclusive_fuyumi": false,
    "drop_rate": 0.65,
    "base_hp": 3490,
    "base_power": 3926,
    "hax_config": {
      "label": "Diệm Vũ Liên Kích",
      "every2TurnStrike": {
        "atkRatio": 0.68,
        "defPierce": 0.35,
        "label": "Diệm Vũ Liên Kích"
      }
    }
  },
  {
    "pet_type": "hoang_ngoc_ky_lan",
    "pet_name": "Hoàng Ngọc Kỳ Lân",
    "element": "Thổ",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "is_kemonomimi": false,
    "base_atk": 515,
    "base_def": 630,
    "base_spd": 510,
    "hax_skill": "Ngọc Thạch Hộ Tâm",
    "hax_description": "Khởi trận dựng Khiên 22% MaxHP & giảm 15% ST chuẩn.",
    "image_file": "pets/hoang_ngoc_ky_lan.webp",
    "is_starter": false,
    "is_exclusive_fuyumi": false,
    "drop_rate": 0.65,
    "base_hp": 4150,
    "base_power": 3875,
    "hax_config": {
      "label": "Ngọc Thạch Hộ Tâm",
      "startShieldPct": 0.48,
      "trueDmgResistPct": 0.18
    }
  },
  {
    "pet_type": "son_nhac_thach_hung",
    "pet_name": "Sơn Nhạc Thạch Hùng",
    "element": "Thổ",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "is_kemonomimi": false,
    "base_atk": 520,
    "base_def": 628,
    "base_spd": 500,
    "hax_skill": "Trấn Sơn Phản Kích",
    "hax_description": "Tăng +20% DEF & phản 16% sát thương nhận vào.",
    "image_file": "pets/son_nhac_thach_hung.webp",
    "is_starter": false,
    "is_exclusive_fuyumi": false,
    "drop_rate": 0.65,
    "base_hp": 4140,
    "base_power": 3866,
    "hax_config": {
      "label": "Trấn Sơn Phản Kích",
      "dmgRedPct": 0.22,
      "reflectPct": 0.3
    }
  },
  {
    "pet_type": "kim_sa_dia_long",
    "pet_name": "Kim Sa Địa Long",
    "element": "Thổ",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "is_kemonomimi": false,
    "base_atk": 510,
    "base_def": 633,
    "base_spd": 510,
    "hax_skill": "Lưu Sa Trầm Trệ",
    "hax_description": "Giảm 15% SPD địch & tăng +15% DEF bản thân mỗi 2 hiệp.",
    "image_file": "pets/kim_sa_dia_long.webp",
    "is_starter": false,
    "is_exclusive_fuyumi": false,
    "drop_rate": 0.65,
    "base_hp": 4165,
    "base_power": 3866,
    "hax_config": {
      "label": "Lưu Sa Trầm Trệ",
      "startSpdDebuffPct": 0.16,
      "dmgRedPct": 0.2
    }
  },
  {
    "pet_type": "thanh_loi_linh_bao",
    "pet_name": "Thanh Lôi Linh Báo",
    "element": "Lôi",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "is_kemonomimi": false,
    "base_atk": 575,
    "base_def": 475,
    "base_spd": 610,
    "hax_skill": "Tật Lôi Đột Kích",
    "hax_description": "Tăng +18% SPD & +15% Bạo Kích trong 3 hiệp đầu.",
    "image_file": "pets/thanh_loi_linh_bao.webp",
    "is_starter": false,
    "is_exclusive_fuyumi": false,
    "drop_rate": 0.65,
    "base_hp": 3375,
    "base_power": 3945,
    "hax_config": {
      "label": "Tật Lôi Đột Kích",
      "earlySpdBonusTurns": 3,
      "earlySpdBonusPct": 0.18,
      "flatCritPct": 0.15
    }
  },
  {
    "pet_type": "tu_dien_cuu_ung",
    "pet_name": "Tử Điện Cửu Ưng",
    "element": "Lôi",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "is_kemonomimi": false,
    "base_atk": 580,
    "base_def": 473,
    "base_spd": 620,
    "hax_skill": "Tử Điện Phá Giáp",
    "hax_description": "Đòn đánh xuyên 28% Khiên & 18% gây Choáng 1 hiệp.",
    "image_file": "pets/tu_dien_cuu_ung.webp",
    "is_starter": false,
    "is_exclusive_fuyumi": false,
    "drop_rate": 0.65,
    "base_hp": 3365,
    "base_power": 3976,
    "hax_config": {
      "label": "Tử Điện Phá Giáp",
      "shieldPiercePct": 0.45,
      "ccProc": {
        "chance": 0.22,
        "kind": "stun",
        "skill": "Tử Điện Phá Giáp"
      }
    }
  },
  {
    "pet_type": "loi_van_thien_ho",
    "pet_name": "Lôi Vân Thiên Hồ",
    "element": "Lôi",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "is_kemonomimi": false,
    "base_atk": 570,
    "base_def": 478,
    "base_spd": 610,
    "hax_skill": "Lôi Quang Áp Chế",
    "hax_description": "Mỗi khi ra đòn trước địch gây thêm 10% MaxHP ST sét phụ.",
    "image_file": "pets/loi_van_thien_ho.webp",
    "is_starter": false,
    "is_exclusive_fuyumi": false,
    "drop_rate": 0.65,
    "base_hp": 3390,
    "base_power": 3936,
    "hax_config": {
      "label": "Lôi Quang Áp Chế",
      "extraStrike": {
        "chance": 0.25,
        "atkRatio": 0.5,
        "defPierce": 0.35,
        "label": "Lôi Quang Áp Chế"
      }
    }
  },
  {
    "pet_type": "cuong_loi_chi_lang",
    "pet_name": "Cuồng Lôi Chiến Lang",
    "element": "Lôi",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "is_kemonomimi": false,
    "base_atk": 575,
    "base_def": 475,
    "base_spd": 620,
    "hax_skill": "Bạo Lôi Liên Trảm",
    "hax_description": "Tăng +22% Sát Thương Bạo Kích & giảm 12% SPD địch.",
    "image_file": "pets/cuong_loi_chi_lang.webp",
    "is_starter": false,
    "is_exclusive_fuyumi": false,
    "drop_rate": 0.65,
    "base_hp": 3375,
    "base_power": 3965,
    "hax_config": {
      "label": "Bạo Lôi Liên Trảm",
      "flatCritPct": 0.18,
      "startSpdDebuffPct": 0.14
    }
  },
  {
    "pet_type": "thien_quang_bach_hac",
    "pet_name": "Thiên Quang Bạch Hạc",
    "element": "Quang",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "is_kemonomimi": false,
    "base_atk": 540,
    "base_def": 553,
    "base_spd": 560,
    "hax_skill": "Tịnh Quang Hộ Trì",
    "hax_description": "Mỗi 2 hiệp hồi 9% MaxHP & tăng +12% Kháng ST.",
    "image_file": "pets/thien_quang_bach_hac.webp",
    "is_starter": false,
    "is_exclusive_fuyumi": false,
    "drop_rate": 0.65,
    "base_hp": 3765,
    "base_power": 3896,
    "hax_config": {
      "label": "Tịnh Quang Hộ Trì",
      "turnHealPct": 0.08,
      "dmgRedPct": 0.16
    }
  },
  {
    "pet_type": "kim_quang_linh_tho",
    "pet_name": "Kim Quang Linh Thố",
    "element": "Quang",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "is_kemonomimi": false,
    "base_atk": 530,
    "base_def": 558,
    "base_spd": 570,
    "hax_skill": "Nguyệt Quang Linh Đan",
    "hax_description": "Tăng +14% Né Tránh & tự xóa 1 debuff khi HP dưới 55%.",
    "image_file": "pets/kim_quang_linh_tho.webp",
    "is_starter": false,
    "is_exclusive_fuyumi": false,
    "drop_rate": 0.65,
    "base_hp": 3790,
    "base_power": 3896,
    "hax_config": {
      "label": "Nguyệt Quang Linh Đan",
      "dodgePct": 0.18,
      "emergencyHealPct": 0.25,
      "emergencyThreshold": 0.55,
      "emergencyDefBonusPct": 0.1
    }
  },
  {
    "pet_type": "thanh_huy_thien_su",
    "pet_name": "Thánh Huy Thiên Sư",
    "element": "Quang",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "is_kemonomimi": false,
    "base_atk": 535,
    "base_def": 555,
    "base_spd": 560,
    "hax_skill": "Quang Minh Phá Tà",
    "hax_description": "Gây thêm +25% ST lên mục tiêu hệ Ám/Hư Không & xuyên 20% DEF.",
    "image_file": "pets/thanh_huy_thien_su.webp",
    "is_starter": false,
    "is_exclusive_fuyumi": false,
    "drop_rate": 0.65,
    "base_hp": 3775,
    "base_power": 3885,
    "hax_config": {
      "label": "Quang Minh Phá Tà",
      "defPiercePct": 0.35,
      "bonusTrueAtkPct": 0.12
    }
  },
  {
    "pet_type": "da_anh_linh_mieu",
    "pet_name": "Dạ Ảnh Linh Miêu",
    "element": "Ám",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "is_kemonomimi": false,
    "base_atk": 600,
    "base_def": 483,
    "base_spd": 585,
    "hax_skill": "Ám Dạ Thích Sát",
    "hax_description": "Tăng +20% Bạo Kích & gây thêm +20% ST khi địch dưới 50% HP.",
    "image_file": "pets/da_anh_linh_mieu.webp",
    "is_starter": false,
    "is_exclusive_fuyumi": false,
    "drop_rate": 0.65,
    "base_hp": 3415,
    "base_power": 3986,
    "hax_config": {
      "label": "Ám Dạ Thích Sát",
      "flatCritPct": 0.18,
      "executeHpPct": 0.2,
      "executeChance": 0.32
    }
  },
  {
    "pet_type": "huyet_nguyet_u_lang",
    "pet_name": "Huyết Nguyệt U Lang",
    "element": "Ám",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "is_kemonomimi": false,
    "base_atk": 590,
    "base_def": 488,
    "base_spd": 575,
    "hax_skill": "Huyết Nha Phệ Thực",
    "hax_description": "Hút 16% ST gây ra thành HP & giảm 20% Hồi Máu địch.",
    "image_file": "pets/huyet_nguyet_u_lang.webp",
    "is_starter": false,
    "is_exclusive_fuyumi": false,
    "drop_rate": 0.65,
    "base_hp": 3440,
    "base_power": 3946,
    "hax_config": {
      "label": "Huyết Nha Phệ Thực",
      "lifestealPct": 0.2,
      "enemyHealRedPct": 0.3
    }
  },
  {
    "pet_type": "minh_diep_huyen_ho",
    "pet_name": "Minh Điệp Huyền Hồ",
    "element": "Ám",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "is_kemonomimi": false,
    "base_atk": 595,
    "base_def": 485,
    "base_spd": 585,
    "hax_skill": "U Điệp Trớ Chú",
    "hax_description": "Giảm 15% ATK địch & gieo Nguyền Rủa 4% MaxHP/hiệp.",
    "image_file": "pets/minh_diep_huyen_ho.webp",
    "is_starter": false,
    "is_exclusive_fuyumi": false,
    "drop_rate": 0.65,
    "base_hp": 3425,
    "base_power": 3975,
    "hax_config": {
      "label": "U Điệp Trớ Chú",
      "startAtkDebuffPct": 0.16,
      "startAtkDebuffTurns": 2,
      "burnOnHitPct": 0.06
    }
  },
  {
    "pet_type": "tinh_linh_nguyet_mieu",
    "pet_name": "Tinh Linh Nguyệt Miêu",
    "element": "Hư Không",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "is_kemonomimi": false,
    "base_atk": 560,
    "base_def": 528,
    "base_spd": 580,
    "hax_skill": "Tinh Ảnh Biến Ảo",
    "hax_description": "Tăng +18% Né Tránh & mỗi lần Né tăng +12% ATK 2 hiệp.",
    "image_file": "pets/tinh_linh_nguyet_mieu.webp",
    "is_starter": false,
    "is_exclusive_fuyumi": false,
    "drop_rate": 0.65,
    "base_hp": 3640,
    "base_power": 3946,
    "hax_config": {
      "label": "Tinh Ảnh Biến Ảo",
      "dodgePct": 0.2,
      "atkStackPct": 0.05,
      "atkStackMax": 3
    }
  },
  {
    "pet_type": "hu_vo_ngan_xa",
    "pet_name": "Hư Vô Ngân Xà",
    "element": "Hư Không",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "is_kemonomimi": false,
    "base_atk": 550,
    "base_def": 533,
    "base_spd": 590,
    "hax_skill": "Thứ Nguyên Xuyên Thích",
    "hax_description": "Bỏ qua 30% DEF & 25% Khiên chắn của đối thủ.",
    "image_file": "pets/hu_vo_ngan_xa.webp",
    "is_starter": false,
    "is_exclusive_fuyumi": false,
    "drop_rate": 0.65,
    "base_hp": 3665,
    "base_power": 3946,
    "hax_config": {
      "label": "Thứ Nguyên Xuyên Thích",
      "defPiercePct": 0.4,
      "shieldPiercePct": 0.35
    }
  },
  {
    "pet_type": "ngan_ha_linh_yen",
    "pet_name": "Ngân Hà Linh Yến",
    "element": "Hư Không",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "is_kemonomimi": false,
    "base_atk": 555,
    "base_def": 530,
    "base_spd": 580,
    "hax_skill": "Ngân Hà Chuyển Vị",
    "hax_description": "Tăng +16% SPD & 25% phản 1 debuff về phía địch.",
    "image_file": "pets/ngan_ha_linh_yen.webp",
    "is_starter": false,
    "is_exclusive_fuyumi": false,
    "drop_rate": 0.65,
    "base_hp": 3650,
    "base_power": 3935,
    "hax_config": {
      "label": "Ngân Hà Chuyển Vị",
      "dodgePct": 0.18,
      "reflectPct": 0.28
    }
  },
  {
    "pet_type": "khong_gian_thien_ho",
    "pet_name": "Không Gian Thiên Hồ",
    "element": "Hư Không",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "is_kemonomimi": false,
    "base_atk": 560,
    "base_def": 528,
    "base_spd": 590,
    "hax_skill": "Kính Hoa Đảo Chiếu",
    "hax_description": "Phản 18% ST từ đòn đầu tiên mỗi 2 hiệp & tăng +15% Kháng ST chuẩn.",
    "image_file": "pets/khong_gian_thien_ho.webp",
    "is_starter": false,
    "is_exclusive_fuyumi": false,
    "drop_rate": 0.65,
    "base_hp": 3640,
    "base_power": 3966,
    "hax_config": {
      "label": "Kính Hoa Đảo Chiếu",
      "reflectPct": 0.3,
      "trueDmgResistPct": 0.18
    }
  }
];

export const V17_PET_EVOLUTIONS = {
  "hon_don_chi_to_long": {
    "base_pet_type": "hon_don_chi_to_long",
    "evolved_name": "Hỗn Độn Chi Tổ Long (Chân Thần)",
    "element": "Hỗn Độn",
    "evo_image_file": "pets/hon_don_chi_to_long_evo.webp",
    "evo_emoji_key": "hon_don_chi_to_long_evo",
    "stat_mult": {
      "atk": 1.38,
      "def": 1.38,
      "spd": 1.36,
      "hp": 1.4
    },
    "ultimate": {
      "id": "ult_hon_don_khai_thien",
      "name": "Hồng Mông Khai Thiên Phá",
      "difficulty": "extreme",
      "cooldownTurns": 6,
      "trigger": {
        "kind": "dmgDealtAndTaken",
        "pctMaxHp": 2.6
      },
      "effect": {
        "trueMaxHpDmgPct": 0.38,
        "stripAllBuffs": true,
        "addLinhMach": 1
      },
      "desc": "Tích đủ 260% MaxHP tổng ST gây+nhận → Giáng 38% MaxHP ST chuẩn xuyên 100% Khiên/DEF + xóa toàn bộ buff địch + +1 Linh Mạch (CD 6)."
    }
  },
  "thai_so_cuu_phuong_hoang": {
    "base_pet_type": "thai_so_cuu_phuong_hoang",
    "evolved_name": "Thái Sơ Cửu Phượng Hoàng (Chân Thần)",
    "element": "Hỏa",
    "evo_image_file": "pets/thai_so_cuu_phuong_hoang_evo.webp",
    "evo_emoji_key": "thai_so_cuu_phuong_hoang_evo",
    "stat_mult": {
      "atk": 1.4,
      "def": 1.32,
      "spd": 1.38,
      "hp": 1.34
    },
    "ultimate": {
      "id": "ult_niet_ban_phan_thien",
      "name": "Niết Bàn Phần Thiên Diệm",
      "difficulty": "hard",
      "cooldownTurns": 5,
      "trigger": {
        "kind": "burnStacksOrRevive",
        "stacks": 5
      },
      "effect": {
        "trueMaxHpDmgPct": 0.28,
        "healMaxHpPct": 0.2
      },
      "desc": "Tích 5 lần Thiêu Đốt hoặc ngay sau khi Hồi Sinh → Kích nổ 28% MaxHP ST chuẩn + hồi 20% MaxHP (CD 5)."
    }
  },
  "van_kiem_de_ton_ho": {
    "base_pet_type": "van_kiem_de_ton_ho",
    "evolved_name": "Vạn Kiếm Đế Tôn Hổ (Chân Thần)",
    "element": "Kim",
    "evo_image_file": "pets/van_kiem_de_ton_ho_evo.webp",
    "evo_emoji_key": "van_kiem_de_ton_ho_evo",
    "stat_mult": {
      "atk": 1.4,
      "def": 1.32,
      "spd": 1.38,
      "hp": 1.34
    },
    "ultimate": {
      "id": "ult_tru_tien_cuu_kiem",
      "name": "Tru Tiên Cửu Kiếm Trận",
      "difficulty": "extreme",
      "cooldownTurns": 5,
      "trigger": {
        "kind": "critsOrDmgDealt",
        "crits": 4,
        "pctMaxHp": 2.4
      },
      "effect": {
        "atkDmgPct": 2.2,
        "shieldPierce": 1,
        "defDebuffPct": 0.35,
        "defDebuffTurns": 2
      },
      "desc": "Tích 4 Bạo Kích hoặc gây 240% MaxHP ST → Trảm 220% ATK xuyên 100% Khiên & giảm 35% DEF địch 2 hiệp (CD 5)."
    }
  },
  "bac_hai_huyen_vu_de": {
    "base_pet_type": "bac_hai_huyen_vu_de",
    "evolved_name": "Bắc Hải Huyền Vũ Đế (Chân Thần)",
    "element": "Thủy",
    "evo_image_file": "pets/bac_hai_huyen_vu_de_evo.webp",
    "evo_emoji_key": "bac_hai_huyen_vu_de_evo",
    "stat_mult": {
      "atk": 1.3,
      "def": 1.4,
      "spd": 1.32,
      "hp": 1.4
    },
    "ultimate": {
      "id": "ult_bac_hai_bang_phong",
      "name": "Bắc Hải Băng Phong Giới",
      "difficulty": "hard",
      "cooldownTurns": 5,
      "trigger": {
        "kind": "dmgTaken",
        "pctMaxHp": 1.8
      },
      "effect": {
        "freezeTurns": 1,
        "shieldMaxHpPct": 0.4,
        "atkDmgPct": 1.45
      },
      "desc": "Gánh 180% MaxHP ST (tính cả Khiên) → Đóng Băng địch 1 hiệp + dựng Khiên 40% MaxHP + giáng 145% ATK (CD 5)."
    }
  },
  "thoi_khong_than_tinh_ho": {
    "base_pet_type": "thoi_khong_than_tinh_ho",
    "evolved_name": "Thời Không Thần Tinh Hồ (Chân Thần)",
    "element": "Hư Không",
    "evo_image_file": "pets/thoi_khong_than_tinh_ho_evo.webp",
    "evo_emoji_key": "thoi_khong_than_tinh_ho_evo",
    "stat_mult": {
      "atk": 1.36,
      "def": 1.34,
      "spd": 1.4,
      "hp": 1.34
    },
    "ultimate": {
      "id": "ult_nghich_chuyen_can_khon",
      "name": "Nghịch Chuyển Càn Khôn",
      "difficulty": "extreme",
      "cooldownTurns": 6,
      "trigger": {
        "kind": "turnsOrDodges",
        "turns": 6,
        "dodges": 3
      },
      "effect": {
        "restoreMissingHpPct": 0.25,
        "atkDmgPct": 1.85,
        "ignoreDmgRed": true
      },
      "desc": "Sinh tồn 6 hiệp hoặc Né/Thanh Tẩy 3 lần → Đảo ngược 25% HP đã mất + đánh thưởng 185% ATK xuyên giảm ST (CD 6)."
    }
  },
  "thai_cuc_thanh_quang_thu": {
    "base_pet_type": "thai_cuc_thanh_quang_thu",
    "evolved_name": "Thái Cực Thánh Quang Thú (Chân Thần)",
    "element": "Quang",
    "evo_image_file": "pets/thai_cuc_thanh_quang_thu_evo.webp",
    "evo_emoji_key": "thai_cuc_thanh_quang_thu_evo",
    "stat_mult": {
      "atk": 1.32,
      "def": 1.38,
      "spd": 1.36,
      "hp": 1.38
    },
    "ultimate": {
      "id": "ult_thai_cuc_tinh_the",
      "name": "Thái Cực Tịnh Thế Quang",
      "difficulty": "easy",
      "cooldownTurns": 4,
      "trigger": {
        "kind": "healsOrCleanses",
        "count": 4
      },
      "effect": {
        "cleanseAll": true,
        "healMaxHpPct": 0.18,
        "dmgRedPct": 0.2,
        "dmgRedTurns": 2
      },
      "desc": "Tích 4 lần hồi HP hoặc thanh tẩy → Xóa 100% debuff + hồi 18% MaxHP + +20% Kháng ST 2 hiệp (CD 4)."
    }
  },
  "cuu_u_do_than_diem_lang": {
    "base_pet_type": "cuu_u_do_than_diem_lang",
    "evolved_name": "Cửu U Đồ Thần Diêm Lang (Chân Thần)",
    "element": "Ám",
    "evo_image_file": "pets/cuu_u_do_than_diem_lang_evo.webp",
    "evo_emoji_key": "cuu_u_do_than_diem_lang_evo",
    "stat_mult": {
      "atk": 1.4,
      "def": 1.3,
      "spd": 1.38,
      "hp": 1.34
    },
    "ultimate": {
      "id": "ult_cuu_u_huyet_nguyet",
      "name": "Cửu U Huyết Nguyệt Trảm",
      "difficulty": "hard",
      "cooldownTurns": 5,
      "trigger": {
        "kind": "dmgOrLowEnemyHp",
        "pctMaxHp": 2,
        "enemyHpLt": 0.45
      },
      "effect": {
        "drainEnemyCurrHpPct": 0.24,
        "atkDmgPct": 1.5
      },
      "desc": "Gây 200% MaxHP ST hoặc địch <45% HP → Hút 24% CurrentHP địch thành HP + chém 150% ATK (CD 5)."
    }
  },
  "thanh_de_van_co_long": {
    "base_pet_type": "thanh_de_van_co_long",
    "evolved_name": "Thanh Đế Vạn Cổ Long (Chân Thần)",
    "element": "Mộc",
    "evo_image_file": "pets/thanh_de_van_co_long_evo.webp",
    "evo_emoji_key": "thanh_de_van_co_long_evo",
    "stat_mult": {
      "atk": 1.32,
      "def": 1.38,
      "spd": 1.35,
      "hp": 1.4
    },
    "ultimate": {
      "id": "ult_van_co_than_moc",
      "name": "Vạn Cổ Thần Mộc Lâm",
      "difficulty": "easy",
      "cooldownTurns": 4,
      "trigger": {
        "kind": "shieldTurnsOrHeal",
        "turns": 4,
        "healPctMaxHp": 0.8
      },
      "effect": {
        "poisonPct": 0.06,
        "poisonTurns": 2,
        "shieldMaxHpPct": 0.25
      },
      "desc": "Giữ Khiên 4 hiệp hoặc hồi 80% MaxHP → Gieo Độc Cổ 6% MaxHP/hiệp (2 hiệp) + dựng Khiên 25% MaxHP (CD 4)."
    }
  },
  "cuu_thien_loi_de_ho": {
    "base_pet_type": "cuu_thien_loi_de_ho",
    "evolved_name": "Cửu Thiên Lôi Đế Hồ (Chân Thần)",
    "element": "Lôi",
    "evo_image_file": "pets/cuu_thien_loi_de_ho_evo.webp",
    "evo_emoji_key": "cuu_thien_loi_de_ho_evo",
    "stat_mult": {
      "atk": 1.36,
      "def": 1.3,
      "spd": 1.4,
      "hp": 1.32
    },
    "ultimate": {
      "id": "ult_cuu_thien_loi_dinh",
      "name": "Cửu Thiên Lôi Đình Phạt",
      "difficulty": "easy",
      "cooldownTurns": 4,
      "trigger": {
        "kind": "firstStrikesOrStuns",
        "count": 5
      },
      "effect": {
        "atkDmgPct": 1.75,
        "ignoreDodge": true,
        "spdStealPct": 0.2,
        "stunChance": 0.4
      },
      "desc": "Ra đòn trước 5 lần → Sét đánh 175% ATK bỏ qua Né + cướp 20% SPD + 40% Choáng 1 hiệp (CD 4)."
    }
  },
  "hoang_thien_ban_co_lan": {
    "base_pet_type": "hoang_thien_ban_co_lan",
    "evolved_name": "Hoàng Thiên Bàn Cổ Lân (Chân Thần)",
    "element": "Thổ",
    "evo_image_file": "pets/hoang_thien_ban_co_lan_evo.webp",
    "evo_emoji_key": "hoang_thien_ban_co_lan_evo",
    "stat_mult": {
      "atk": 1.3,
      "def": 1.4,
      "spd": 1.3,
      "hp": 1.4
    },
    "ultimate": {
      "id": "ult_ban_co_tran_nhac",
      "name": "Bàn Cổ Trấn Nhạc Ấn",
      "difficulty": "hard",
      "cooldownTurns": 5,
      "trigger": {
        "kind": "dmgTaken",
        "pctMaxHp": 1.5
      },
      "effect": {
        "trueMaxHpDmgPct": 0.26,
        "shieldMaxHpPct": 0.45
      },
      "desc": "Hấp thụ 150% MaxHP ST → Chấn Địa chuẩn 26% MaxHP + tái tạo 45% MaxHP Khiên Bàn Cổ (CD 5)."
    }
  },
  "hong_mong_nguyen_phuong": {
    "base_pet_type": "hong_mong_nguyen_phuong",
    "evolved_name": "Hồng Mông Nguyên Phượng (Chân Thần)",
    "element": "Hỗn Độn",
    "evo_image_file": "pets/hong_mong_nguyen_phuong_evo.webp",
    "evo_emoji_key": "hong_mong_nguyen_phuong_evo",
    "is_kemonomimi": false,
    "stat_mult": {
      "atk": 1.38,
      "def": 1.38,
      "spd": 1.36,
      "hp": 1.4
    },
    "ultimate": {
      "id": "ult_hong_mong_nguyen_phuong",
      "name": "Khai Nguyên Đạo Diệm",
      "difficulty": "extreme",
      "cooldownTurns": 6,
      "trigger": {
        "kind": "dmgDealtAndTaken",
        "pctMaxHp": 2.5
      },
      "effect": {
        "trueMaxHpDmgPct": 0.34,
        "stripAllBuffs": true,
        "healMaxHpPct": 0.18,
        "addLinhMach": 1
      },
      "desc": "Khai Nguyên Đạo Diệm (Cực Khó): Tích đủ 250% MaxHP tổng ST gây+nhận → Đốt sạch toàn bộ Khiên địch + giáng 34% MaxHP ST chuẩn + hồi 22% MaxHP (CD 6)."
    }
  },
  "thai_so_van_tuong_ho": {
    "base_pet_type": "thai_so_van_tuong_ho",
    "evolved_name": "Thái Sơ Vạn Tượng Hồ (Chân Thần)",
    "element": "Hỗn Độn",
    "evo_image_file": "pets/thai_so_van_tuong_ho_evo.webp",
    "evo_emoji_key": "thai_so_van_tuong_ho_evo",
    "is_kemonomimi": false,
    "stat_mult": {
      "atk": 1.38,
      "def": 1.38,
      "spd": 1.36,
      "hp": 1.4
    },
    "ultimate": {
      "id": "ult_thai_so_van_tuong_ho",
      "name": "Vạn Tượng Quy Khư",
      "difficulty": "extreme",
      "cooldownTurns": 6,
      "trigger": {
        "kind": "critsOrDmgDealt",
        "crits": 4,
        "pctMaxHp": 2.35
      },
      "effect": {
        "trueMaxHpDmgPct": 0.34,
        "stripAllBuffs": true,
        "healMaxHpPct": 0.18,
        "addLinhMach": 1
      },
      "desc": "Vạn Tượng Quy Khư (Cực Khó): Đánh 5 đòn hoặc kích phản đòn 3 lần → Đánh cắp 20% ATK/DEF địch 2 hiệp + bùng nổ 32% MaxHP ST Hỗn Độn chuẩn (CD 6)."
    }
  },
  "phan_thien_kim_o_de": {
    "base_pet_type": "phan_thien_kim_o_de",
    "evolved_name": "Phần Thiên Kim Ô Đế (Chân Thần)",
    "element": "Hỏa",
    "evo_image_file": "pets/phan_thien_kim_o_de_evo.webp",
    "evo_emoji_key": "phan_thien_kim_o_de_evo",
    "is_kemonomimi": false,
    "stat_mult": {
      "atk": 1.4,
      "def": 1.32,
      "spd": 1.38,
      "hp": 1.34
    },
    "ultimate": {
      "id": "ult_phan_thien_kim_o_de",
      "name": "Cửu Nhật Phần Thương Khung",
      "difficulty": "hard",
      "cooldownTurns": 5,
      "trigger": {
        "kind": "burnStacksOrRevive",
        "stacks": 4
      },
      "effect": {
        "atkDmgPct": 2.15,
        "shieldPierce": 0.75,
        "burnPct": 0.08,
        "burnTurns": 2
      },
      "desc": "Cửu Nhật Phần Thương Khung (Khó): Tích 5 tầng Thiêu Đốt hoặc gây 210% MaxHP ST → Triệu hồi 9 mặt trời giáng 230% ATK xuyên 70% Khiên + cấm Hồi Máu 2 hiệp (CD 5)."
    }
  },
  "xich_diem_chuc_long_vuong": {
    "base_pet_type": "xich_diem_chuc_long_vuong",
    "evolved_name": "Xích Diễm Chúc Long Vương (Chân Thần)",
    "element": "Hỏa",
    "evo_image_file": "pets/xich_diem_chuc_long_vuong_evo.webp",
    "evo_emoji_key": "xich_diem_chuc_long_vuong_evo",
    "is_kemonomimi": false,
    "stat_mult": {
      "atk": 1.4,
      "def": 1.32,
      "spd": 1.38,
      "hp": 1.34
    },
    "ultimate": {
      "id": "ult_xich_diem_chuc_long_vuong",
      "name": "Chúc Long Phá Trú Dạ",
      "difficulty": "hard",
      "cooldownTurns": 5,
      "trigger": {
        "kind": "dmgOrLowEnemyHp",
        "pctMaxHp": 1.95,
        "enemyHpLt": 0.45
      },
      "effect": {
        "atkDmgPct": 2.15,
        "shieldPierce": 0.75,
        "burnPct": 0.08,
        "burnTurns": 2
      },
      "desc": "Chúc Long Phá Trú Dạ (Khó): Đánh trúng 4 lần vào mục tiêu có buff/khiên → Phá hủy 100% Khiên + gây 210% ATK + Thiêu Đốt chuẩn 8% MaxHP/hiệp trong 2 hiệp (CD 5)."
    }
  },
  "bach_de_tru_tien_ung": {
    "base_pet_type": "bach_de_tru_tien_ung",
    "evolved_name": "Bạch Đế Tru Tiên Ưng (Chân Thần)",
    "element": "Kim",
    "evo_image_file": "pets/bach_de_tru_tien_ung_evo.webp",
    "evo_emoji_key": "bach_de_tru_tien_ung_evo",
    "is_kemonomimi": false,
    "stat_mult": {
      "atk": 1.4,
      "def": 1.32,
      "spd": 1.38,
      "hp": 1.34
    },
    "ultimate": {
      "id": "ult_bach_de_tru_tien_ung",
      "name": "Thiên Hình Vạn Nhận Trảm",
      "difficulty": "extreme",
      "cooldownTurns": 6,
      "trigger": {
        "kind": "critsOrDmgDealt",
        "crits": 4,
        "pctMaxHp": 2.35
      },
      "effect": {
        "atkDmgPct": 2.3,
        "shieldPierce": 1,
        "defDebuffPct": 0.32,
        "defDebuffTurns": 2
      },
      "desc": "Thiên Hình Vạn Nhận Trảm (Cực Khó): Tích 4 Bạo Kích hoặc cắt đủ 24% DEF địch → Chém liên kích 240% ATK xuyên 100% DEF & Khiên + gây Chảy Máu 7% MaxHP (CD 5)."
    }
  },
  "thai_bach_thien_kiem_lan": {
    "base_pet_type": "thai_bach_thien_kiem_lan",
    "evolved_name": "Thái Bạch Thiên Kiếm Lân (Chân Thần)",
    "element": "Kim",
    "evo_image_file": "pets/thai_bach_thien_kiem_lan_evo.webp",
    "evo_emoji_key": "thai_bach_thien_kiem_lan_evo",
    "is_kemonomimi": false,
    "stat_mult": {
      "atk": 1.4,
      "def": 1.32,
      "spd": 1.38,
      "hp": 1.34
    },
    "ultimate": {
      "id": "ult_thai_bach_thien_kiem_lan",
      "name": "Thái Bạch Kiếm Vực Phá",
      "difficulty": "hard",
      "cooldownTurns": 5,
      "trigger": {
        "kind": "burnStacksOrRevive",
        "stacks": 4
      },
      "effect": {
        "atkDmgPct": 2.3,
        "shieldPierce": 1,
        "defDebuffPct": 0.32,
        "defDebuffTurns": 2
      },
      "desc": "Thái Bạch Kiếm Vực Phá (Khó): Phản đòn 3 lần hoặc tích 190% MaxHP ST → Bùng phát bão kiếm 215% ATK bỏ qua Khiên + nhận Bất Bại Giảm 35% ST 2 hiệp (CD 5)."
    }
  },
  "thuong_hai_bang_phuong": {
    "base_pet_type": "thuong_hai_bang_phuong",
    "evolved_name": "Thương Hải Băng Phượng (Chân Thần)",
    "element": "Thủy",
    "evo_image_file": "pets/thuong_hai_bang_phuong_evo.webp",
    "evo_emoji_key": "thuong_hai_bang_phuong_evo",
    "is_kemonomimi": false,
    "stat_mult": {
      "atk": 1.3,
      "def": 1.4,
      "spd": 1.32,
      "hp": 1.4
    },
    "ultimate": {
      "id": "ult_thuong_hai_bang_phuong",
      "name": "Tuyệt Đối Linh Độ Vũ",
      "difficulty": "hard",
      "cooldownTurns": 5,
      "trigger": {
        "kind": "dmgOrLowEnemyHp",
        "pctMaxHp": 1.95,
        "enemyHpLt": 0.45
      },
      "effect": {
        "freezeTurns": 1,
        "shieldMaxHpPct": 0.38,
        "atkDmgPct": 1.85
      },
      "desc": "Tuyệt Đối Linh Độ Vũ (Khó): Tích 4 lần làm chậm/đóng băng hoặc chịu 160% MaxHP ST → Đóng Băng 1 hiệp + ST chuẩn 26% MaxHP + thanh tẩy toàn bộ Thiêu Đốt/Độc (CD 5)."
    }
  },
  "huyen_minh_co_long_vuong": {
    "base_pet_type": "huyen_minh_co_long_vuong",
    "evolved_name": "Huyền Minh Cổ Long Vương (Chân Thần)",
    "element": "Thủy",
    "evo_image_file": "pets/huyen_minh_co_long_vuong_evo.webp",
    "evo_emoji_key": "huyen_minh_co_long_vuong_evo",
    "is_kemonomimi": false,
    "stat_mult": {
      "atk": 1.3,
      "def": 1.4,
      "spd": 1.32,
      "hp": 1.4
    },
    "ultimate": {
      "id": "ult_huyen_minh_co_long_vuong",
      "name": "Huyền Minh Hải Khiếu",
      "difficulty": "easy",
      "cooldownTurns": 4,
      "trigger": {
        "kind": "firstStrikesOrStuns",
        "count": 4
      },
      "effect": {
        "freezeTurns": 1,
        "shieldMaxHpPct": 0.38,
        "atkDmgPct": 1.85
      },
      "desc": "Huyền Minh Hải Khiếu (Dễ–Vừa): Tích 4 lần tạo Khiên hoặc thanh tẩy 2 debuff → Xóa 2 buff địch + dựng Khiên 38% MaxHP + giáng 185% ATK sóng băng (CD 4)."
    }
  },
  "tinh_ha_hu_khong_long": {
    "base_pet_type": "tinh_ha_hu_khong_long",
    "evolved_name": "Tinh Hà Hư Không Long (Chân Thần)",
    "element": "Hư Không",
    "evo_image_file": "pets/tinh_ha_hu_khong_long_evo.webp",
    "evo_emoji_key": "tinh_ha_hu_khong_long_evo",
    "is_kemonomimi": false,
    "stat_mult": {
      "atk": 1.36,
      "def": 1.34,
      "spd": 1.4,
      "hp": 1.34
    },
    "ultimate": {
      "id": "ult_tinh_ha_hu_khong_long",
      "name": "Tinh Hà Vẫn Lạc Vực",
      "difficulty": "extreme",
      "cooldownTurns": 6,
      "trigger": {
        "kind": "turnsOrDodges",
        "turns": 5,
        "dodges": 3
      },
      "effect": {
        "restoreMissingHpPct": 0.24,
        "trueMaxHpDmgPct": 0.32,
        "ignoreDmgRed": true
      },
      "desc": "Tinh Hà Vẫn Lạc Vực (Cực Khó): Né 3 lần hoặc tích 5 hiệp sinh tồn → Xé không gian giáng 35% MaxHP ST chuẩn bỏ qua Khiên + Né 100% đòn kế tiếp (CD 6)."
    }
  },
  "vo_cuc_nguyet_anh_diep": {
    "base_pet_type": "vo_cuc_nguyet_anh_diep",
    "evolved_name": "Vô Cực Nguyệt Ảnh Điệp (Chân Thần)",
    "element": "Hư Không",
    "evo_image_file": "pets/vo_cuc_nguyet_anh_diep_evo.webp",
    "evo_emoji_key": "vo_cuc_nguyet_anh_diep_evo",
    "is_kemonomimi": false,
    "stat_mult": {
      "atk": 1.36,
      "def": 1.34,
      "spd": 1.4,
      "hp": 1.34
    },
    "ultimate": {
      "id": "ult_vo_cuc_nguyet_anh_diep",
      "name": "Vô Cực Huyễn Nguyệt Chú",
      "difficulty": "hard",
      "cooldownTurns": 5,
      "trigger": {
        "kind": "dmgOrLowEnemyHp",
        "pctMaxHp": 1.95,
        "enemyHpLt": 0.45
      },
      "effect": {
        "restoreMissingHpPct": 0.24,
        "trueMaxHpDmgPct": 0.32,
        "ignoreDmgRed": true
      },
      "desc": "Vô Cực Huyễn Nguyệt Chú (Khó): Tích 4 lần địch đánh hụt/kháng debuff hoặc 5 hiệp → Phản ngược 100% debuff sang địch + gây Mù & Giảm 30% ST địch 2 hiệp + 200% ATK (CD 5)."
    }
  },
  "cuu_tieu_thanh_loan": {
    "base_pet_type": "cuu_tieu_thanh_loan",
    "evolved_name": "Cửu Tiêu Thánh Loan (Chân Thần)",
    "element": "Quang",
    "evo_image_file": "pets/cuu_tieu_thanh_loan_evo.webp",
    "evo_emoji_key": "cuu_tieu_thanh_loan_evo",
    "is_kemonomimi": false,
    "stat_mult": {
      "atk": 1.32,
      "def": 1.38,
      "spd": 1.36,
      "hp": 1.38
    },
    "ultimate": {
      "id": "ult_cuu_tieu_thanh_loan",
      "name": "Cửu Tiêu Thánh Quang Lâm",
      "difficulty": "easy",
      "cooldownTurns": 4,
      "trigger": {
        "kind": "firstStrikesOrStuns",
        "count": 4
      },
      "effect": {
        "cleanseAll": true,
        "healMaxHpPct": 0.2,
        "dmgRedPct": 0.2,
        "dmgRedTurns": 2,
        "atkDmgPct": 1.65
      },
      "desc": "Cửu Tiêu Thánh Quang Lâm (Dễ–Vừa): Tích 4 lần hồi HP hoặc tạo Khiên → Thanh tẩy toàn bộ debuff phe ta + hồi 22% MaxHP + tăng +25% ATK & +20% Kháng ST 2 hiệp (CD 4)."
    }
  },
  "nhat_nguyet_thien_ma_de": {
    "base_pet_type": "nhat_nguyet_thien_ma_de",
    "evolved_name": "Nhật Nguyệt Thiên Mã Đế (Chân Thần)",
    "element": "Quang",
    "evo_image_file": "pets/nhat_nguyet_thien_ma_de_evo.webp",
    "evo_emoji_key": "nhat_nguyet_thien_ma_de_evo",
    "is_kemonomimi": false,
    "stat_mult": {
      "atk": 1.32,
      "def": 1.38,
      "spd": 1.36,
      "hp": 1.38
    },
    "ultimate": {
      "id": "ult_nhat_nguyet_thien_ma_de",
      "name": "Nhật Nguyệt Thần Quang Trảm",
      "difficulty": "hard",
      "cooldownTurns": 5,
      "trigger": {
        "kind": "burnStacksOrRevive",
        "stacks": 4
      },
      "effect": {
        "cleanseAll": true,
        "healMaxHpPct": 0.2,
        "dmgRedPct": 0.2,
        "dmgRedTurns": 2,
        "atkDmgPct": 1.65
      },
      "desc": "Nhật Nguyệt Thần Quang Trảm (Khó): Ra đòn trước địch 4 lần → Lao xuyên chiến trường gây 220% ATK bỏ qua Né & Khiên + hóa giải 2 buff địch + tăng +25% SPD 2 hiệp (CD 5)."
    }
  },
  "vinh_da_huyet_nha_hoang": {
    "base_pet_type": "vinh_da_huyet_nha_hoang",
    "evolved_name": "Vĩnh Dạ Huyết Nha Hoàng (Chân Thần)",
    "element": "Ám",
    "evo_image_file": "pets/vinh_da_huyet_nha_hoang_evo.webp",
    "evo_emoji_key": "vinh_da_huyet_nha_hoang_evo",
    "is_kemonomimi": false,
    "stat_mult": {
      "atk": 1.4,
      "def": 1.3,
      "spd": 1.38,
      "hp": 1.34
    },
    "ultimate": {
      "id": "ult_vinh_da_huyet_nha_hoang",
      "name": "Vĩnh Dạ Huyết Dực Táng",
      "difficulty": "hard",
      "cooldownTurns": 5,
      "trigger": {
        "kind": "dmgOrLowEnemyHp",
        "pctMaxHp": 1.95,
        "enemyHpLt": 0.45
      },
      "effect": {
        "drainEnemyCurrHpPct": 0.22,
        "trueMaxHpDmgPct": 0.24,
        "healReductionPct": 0.45,
        "healReductionTurns": 2
      },
      "desc": "Vĩnh Dạ Huyết Dực Táng (Khó): Tích 4 ấn Huyết Khô hoặc hút đủ 60% MaxHP → Nổ ấn gây 28% MaxHP ST chuẩn + hút 50% lượng ST đó thành HP + cấm Hồi Máu 2 hiệp (CD 5)."
    }
  },
  "u_minh_man_chau_ho": {
    "base_pet_type": "u_minh_man_chau_ho",
    "evolved_name": "U Minh Mạn Châu Hồ (Chân Thần)",
    "element": "Ám",
    "evo_image_file": "pets/u_minh_man_chau_ho_evo.webp",
    "evo_emoji_key": "u_minh_man_chau_ho_evo",
    "is_kemonomimi": false,
    "stat_mult": {
      "atk": 1.4,
      "def": 1.3,
      "spd": 1.38,
      "hp": 1.34
    },
    "ultimate": {
      "id": "ult_u_minh_man_chau_ho",
      "name": "Hoàng Tuyền Bỉ Ngạn Khai",
      "difficulty": "extreme",
      "cooldownTurns": 6,
      "trigger": {
        "kind": "critsOrDmgDealt",
        "crits": 4,
        "pctMaxHp": 2.35
      },
      "effect": {
        "drainEnemyCurrHpPct": 0.22,
        "trueMaxHpDmgPct": 0.24,
        "healReductionPct": 0.45,
        "healReductionTurns": 2
      },
      "desc": "Hoàng Tuyền Bỉ Ngạn Khai (Cực Khó): Tích 5 lần gây Nguyền Rủa/debuff hoặc địch <50% HP → Khai hoa Bỉ Ngạn gây 32% MaxHP ST chuẩn + Giảm 35% ATK địch 2 hiệp + hồi 18% MaxHP (CD 6)."
    }
  },
  "van_hoa_linh_loc_vuong": {
    "base_pet_type": "van_hoa_linh_loc_vuong",
    "evolved_name": "Vạn Hoa Linh Lộc Vương (Chân Thần)",
    "element": "Mộc",
    "evo_image_file": "pets/van_hoa_linh_loc_vuong_evo.webp",
    "evo_emoji_key": "van_hoa_linh_loc_vuong_evo",
    "is_kemonomimi": false,
    "stat_mult": {
      "atk": 1.32,
      "def": 1.38,
      "spd": 1.35,
      "hp": 1.4
    },
    "ultimate": {
      "id": "ult_van_hoa_linh_loc_vuong",
      "name": "Vạn Hoa Tịnh Thế Trận",
      "difficulty": "easy",
      "cooldownTurns": 4,
      "trigger": {
        "kind": "shieldTurnsOrHeal",
        "turns": 4,
        "healPctMaxHp": 0.75
      },
      "effect": {
        "cleanseAll": true,
        "healMaxHpPct": 0.22,
        "shieldMaxHpPct": 0.28,
        "poisonPct": 0.06,
        "poisonTurns": 2
      },
      "desc": "Vạn Hoa Tịnh Thế Trận (Dễ–Vừa): Tích 4 lần hồi HP hoặc thanh tẩy → Thanh tẩy toàn bộ debuff + hồi 24% MaxHP + dựng Khiên Hoa 30% MaxHP phản 25% ST (CD 4)."
    }
  },
  "thai_at_co_moc_phuong": {
    "base_pet_type": "thai_at_co_moc_phuong",
    "evolved_name": "Thái Ất Cổ Mộc Phượng (Chân Thần)",
    "element": "Mộc",
    "evo_image_file": "pets/thai_at_co_moc_phuong_evo.webp",
    "evo_emoji_key": "thai_at_co_moc_phuong_evo",
    "is_kemonomimi": false,
    "stat_mult": {
      "atk": 1.32,
      "def": 1.38,
      "spd": 1.35,
      "hp": 1.4
    },
    "ultimate": {
      "id": "ult_thai_at_co_moc_phuong",
      "name": "Thái Ất Trường Sinh Kiếp",
      "difficulty": "hard",
      "cooldownTurns": 5,
      "trigger": {
        "kind": "dmgOrLowEnemyHp",
        "pctMaxHp": 1.95,
        "enemyHpLt": 0.45
      },
      "effect": {
        "cleanseAll": true,
        "healMaxHpPct": 0.22,
        "shieldMaxHpPct": 0.28,
        "poisonPct": 0.06,
        "poisonTurns": 2
      },
      "desc": "Thái Ất Trường Sinh Kiếp (Khó): Gieo đủ 4 tầng Độc hoặc hấp thụ 120% MaxHP bằng Khiên → Rút 25% MaxHP địch (xuyên Khiên) + dựng Khiên 35% MaxHP + +20% DEF 2 hiệp (CD 5)."
    }
  },
  "tu_tieu_thien_loi_long": {
    "base_pet_type": "tu_tieu_thien_loi_long",
    "evolved_name": "Tử Tiêu Thiên Lôi Long (Chân Thần)",
    "element": "Lôi",
    "evo_image_file": "pets/tu_tieu_thien_loi_long_evo.webp",
    "evo_emoji_key": "tu_tieu_thien_loi_long_evo",
    "is_kemonomimi": false,
    "stat_mult": {
      "atk": 1.36,
      "def": 1.3,
      "spd": 1.4,
      "hp": 1.32
    },
    "ultimate": {
      "id": "ult_tu_tieu_thien_loi_long",
      "name": "Tử Tiêu Cửu Kiếp Lôi",
      "difficulty": "hard",
      "cooldownTurns": 5,
      "trigger": {
        "kind": "dmgTaken",
        "pctMaxHp": 1.7
      },
      "effect": {
        "atkDmgPct": 2,
        "ignoreDodge": true,
        "shieldPierce": 0.8,
        "spdStealPct": 0.22,
        "stunChance": 0.4
      },
      "desc": "Tử Tiêu Cửu Kiếp Lôi (Khó): Đánh vỡ Khiên địch hoặc gây 190% MaxHP ST → Giáng 9 tia Tử Lôi gây 225% ATK bỏ qua Né & Khiên + 45% Choáng 1 hiệp (CD 5)."
    }
  },
  "loi_hoang_kim_dieu": {
    "base_pet_type": "loi_hoang_kim_dieu",
    "evolved_name": "Lôi Hoàng Kim Điêu (Chân Thần)",
    "element": "Lôi",
    "evo_image_file": "pets/loi_hoang_kim_dieu_evo.webp",
    "evo_emoji_key": "loi_hoang_kim_dieu_evo",
    "is_kemonomimi": false,
    "stat_mult": {
      "atk": 1.36,
      "def": 1.3,
      "spd": 1.4,
      "hp": 1.32
    },
    "ultimate": {
      "id": "ult_loi_hoang_kim_dieu",
      "name": "Lôi Hoàng Phá Không Trảm",
      "difficulty": "easy",
      "cooldownTurns": 4,
      "trigger": {
        "kind": "shieldTurnsOrHeal",
        "turns": 4,
        "healPctMaxHp": 0.75
      },
      "effect": {
        "atkDmgPct": 2,
        "ignoreDodge": true,
        "shieldPierce": 0.8,
        "spdStealPct": 0.22,
        "stunChance": 0.4
      },
      "desc": "Lôi Hoàng Phá Không Trảm (Dễ–Vừa): Ra đòn trước địch 4 lần → Bùng nổ tốc độ gây 195% ATK xuyên 60% DEF + cướp 25% SPD 2 hiệp + chắc chắn Bạo Kích (CD 4)."
    }
  },
  "hau_tho_tran_nhac_quy": {
    "base_pet_type": "hau_tho_tran_nhac_quy",
    "evolved_name": "Hậu Thổ Trấn Nhạc Quy (Chân Thần)",
    "element": "Thổ",
    "evo_image_file": "pets/hau_tho_tran_nhac_quy_evo.webp",
    "evo_emoji_key": "hau_tho_tran_nhac_quy_evo",
    "is_kemonomimi": false,
    "stat_mult": {
      "atk": 1.3,
      "def": 1.4,
      "spd": 1.3,
      "hp": 1.4
    },
    "ultimate": {
      "id": "ult_hau_tho_tran_nhac_quy",
      "name": "Hậu Thổ Thiên Trụ Ấn",
      "difficulty": "hard",
      "cooldownTurns": 5,
      "trigger": {
        "kind": "dmgOrLowEnemyHp",
        "pctMaxHp": 1.95,
        "enemyHpLt": 0.45
      },
      "effect": {
        "trueMaxHpDmgPct": 0.26,
        "shieldMaxHpPct": 0.45,
        "dmgRedPct": 0.25,
        "dmgRedTurns": 2
      },
      "desc": "Hậu Thổ Thiên Trụ Ấn (Khó): Gánh chịu 170% MaxHP ST → Dựng Khiên 48% MaxHP + giảm 40% ST chuẩn nhận vào 2 hiệp + giáng 25% MaxHP ST chuẩn (CD 5)."
    }
  },
  "huyen_hoang_thach_su": {
    "base_pet_type": "huyen_hoang_thach_su",
    "evolved_name": "Huyền Hoàng Thạch Sư (Chân Thần)",
    "element": "Thổ",
    "evo_image_file": "pets/huyen_hoang_thach_su_evo.webp",
    "evo_emoji_key": "huyen_hoang_thach_su_evo",
    "is_kemonomimi": false,
    "stat_mult": {
      "atk": 1.3,
      "def": 1.4,
      "spd": 1.3,
      "hp": 1.4
    },
    "ultimate": {
      "id": "ult_huyen_hoang_thach_su",
      "name": "Huyền Hoàng Băng Sơn Hống",
      "difficulty": "easy",
      "cooldownTurns": 4,
      "trigger": {
        "kind": "firstStrikesOrStuns",
        "count": 4
      },
      "effect": {
        "trueMaxHpDmgPct": 0.26,
        "shieldMaxHpPct": 0.45,
        "dmgRedPct": 0.25,
        "dmgRedTurns": 2
      },
      "desc": "Huyền Hoàng Băng Sơn Hống (Dễ–Vừa): Tích 4 hiệp giữ Khiên hoặc gây 175% MaxHP ST → Gầm chấn địa gây 200% (ATK + 50% DEF) + làm Choáng 35% + tái tạo 30% MaxHP Khiên (CD 4)."
    }
  },
  "hong_mong_cuu_vy_tien": {
    "base_pet_type": "hong_mong_cuu_vy_tien",
    "evolved_name": "Hồng Mông Cửu Vĩ Tiên (Chân Thần)",
    "element": "Hỗn Độn",
    "evo_image_file": "pets/hong_mong_cuu_vy_tien_evo.webp",
    "evo_emoji_key": "hong_mong_cuu_vy_tien_evo",
    "is_kemonomimi": true,
    "stat_mult": {
      "atk": 1.38,
      "def": 1.38,
      "spd": 1.36,
      "hp": 1.4
    },
    "ultimate": {
      "id": "ult_hong_mong_cuu_vy_tien",
      "name": "Cửu Vĩ Hồng Mông Giới",
      "difficulty": "extreme",
      "cooldownTurns": 6,
      "trigger": {
        "kind": "turnsOrDodges",
        "turns": 5,
        "dodges": 3
      },
      "effect": {
        "trueMaxHpDmgPct": 0.34,
        "stripAllBuffs": true,
        "healMaxHpPct": 0.18,
        "addLinhMach": 1
      },
      "desc": "Cửu Vĩ Hồng Mông Giới (Cực Khó): Tích đủ 250% MaxHP tổng ST gây+nhận → Xóa toàn bộ buff & Khiên địch + giáng 35% MaxHP ST Hỗn Độn chuẩn + hồi 20% MaxHP (CD 6)."
    }
  },
  "huyet_nguyet_thien_lang_nu": {
    "base_pet_type": "huyet_nguyet_thien_lang_nu",
    "evolved_name": "Huyết Nguyệt Thiên Lang Nữ (Chân Thần)",
    "element": "Ám",
    "evo_image_file": "pets/huyet_nguyet_thien_lang_nu_evo.webp",
    "evo_emoji_key": "huyet_nguyet_thien_lang_nu_evo",
    "is_kemonomimi": true,
    "stat_mult": {
      "atk": 1.4,
      "def": 1.3,
      "spd": 1.38,
      "hp": 1.34
    },
    "ultimate": {
      "id": "ult_huyet_nguyet_thien_lang_nu",
      "name": "Bỉ Ngạn Huyết Nguyệt Táng",
      "difficulty": "hard",
      "cooldownTurns": 5,
      "trigger": {
        "kind": "dmgOrLowEnemyHp",
        "pctMaxHp": 1.95,
        "enemyHpLt": 0.45
      },
      "effect": {
        "drainEnemyCurrHpPct": 0.22,
        "trueMaxHpDmgPct": 0.24,
        "healReductionPct": 0.45,
        "healReductionTurns": 2
      },
      "desc": "Bỉ Ngạn Huyết Nguyệt Táng (Khó): Tích 4 ấn Huyết Hoa hoặc địch <45% HP → Khai hoa Bỉ Ngạn gây 30% MaxHP ST chuẩn + hút 50% lượng ST thành HP + cấm Hồi Máu 2 hiệp (CD 5)."
    }
  },
  "xich_diem_phuong_hoang_co": {
    "base_pet_type": "xich_diem_phuong_hoang_co",
    "evolved_name": "Xích Diễm Phượng Hoàng Cơ (Chân Thần)",
    "element": "Hỏa",
    "evo_image_file": "pets/xich_diem_phuong_hoang_co_evo.webp",
    "evo_emoji_key": "xich_diem_phuong_hoang_co_evo",
    "is_kemonomimi": true,
    "stat_mult": {
      "atk": 1.4,
      "def": 1.32,
      "spd": 1.38,
      "hp": 1.34
    },
    "ultimate": {
      "id": "ult_xich_diem_phuong_hoang_co",
      "name": "Phần Thiên Phượng Vũ Khúc",
      "difficulty": "hard",
      "cooldownTurns": 5,
      "trigger": {
        "kind": "dmgTaken",
        "pctMaxHp": 1.7
      },
      "effect": {
        "atkDmgPct": 2.15,
        "shieldPierce": 0.75,
        "burnPct": 0.08,
        "burnTurns": 2
      },
      "desc": "Phần Thiên Phượng Vũ Khúc (Khó): Tích 5 tầng Thiêu Đốt hoặc ngay sau khi Hồi Sinh → Triệu hồi Phượng Hoàng thiêu đốt 29% MaxHP ST chuẩn + xóa 2 buff địch + hồi 18% MaxHP (CD 5)."
    }
  },
  "bach_de_kiem_ho_quan": {
    "base_pet_type": "bach_de_kiem_ho_quan",
    "evolved_name": "Bạch Đế Kiếm Hổ Quân (Chân Thần)",
    "element": "Kim",
    "evo_image_file": "pets/bach_de_kiem_ho_quan_evo.webp",
    "evo_emoji_key": "bach_de_kiem_ho_quan_evo",
    "is_kemonomimi": true,
    "stat_mult": {
      "atk": 1.4,
      "def": 1.32,
      "spd": 1.38,
      "hp": 1.34
    },
    "ultimate": {
      "id": "ult_bach_de_kiem_ho_quan",
      "name": "Bạch Đế Cửu Kiếm Trảm",
      "difficulty": "extreme",
      "cooldownTurns": 6,
      "trigger": {
        "kind": "turnsOrDodges",
        "turns": 5,
        "dodges": 3
      },
      "effect": {
        "atkDmgPct": 2.3,
        "shieldPierce": 1,
        "defDebuffPct": 0.32,
        "defDebuffTurns": 2
      },
      "desc": "Bạch Đế Cửu Kiếm Trảm (Cực Khó): Tích 4 Bạo Kích hoặc gây 230% MaxHP ST → Bạch Hổ & 9 kiếm giáng 235% ATK xuyên 100% DEF/Khiên + giảm 30% DEF địch 2 hiệp (CD 5)."
    }
  },
  "thuong_hai_long_nu": {
    "base_pet_type": "thuong_hai_long_nu",
    "evolved_name": "Thương Hải Long Nữ (Chân Thần)",
    "element": "Thủy",
    "evo_image_file": "pets/thuong_hai_long_nu_evo.webp",
    "evo_emoji_key": "thuong_hai_long_nu_evo",
    "is_kemonomimi": true,
    "stat_mult": {
      "atk": 1.3,
      "def": 1.4,
      "spd": 1.32,
      "hp": 1.4
    },
    "ultimate": {
      "id": "ult_thuong_hai_long_nu",
      "name": "Thương Hải Băng Long Giới",
      "difficulty": "hard",
      "cooldownTurns": 5,
      "trigger": {
        "kind": "dmgOrLowEnemyHp",
        "pctMaxHp": 1.95,
        "enemyHpLt": 0.45
      },
      "effect": {
        "freezeTurns": 1,
        "shieldMaxHpPct": 0.38,
        "atkDmgPct": 1.85
      },
      "desc": "Thương Hải Băng Long Giới (Khó): Tích 4 lần dựng Khiên hoặc gánh 165% MaxHP ST → Đóng Băng địch 1 hiệp + dựng Khiên 40% MaxHP + giáng 200% ATK sóng băng (CD 5)."
    }
  },
  "tu_tieu_loi_ho_quan": {
    "base_pet_type": "tu_tieu_loi_ho_quan",
    "evolved_name": "Tử Tiêu Lôi Hồ Quân (Chân Thần)",
    "element": "Lôi",
    "evo_image_file": "pets/tu_tieu_loi_ho_quan_evo.webp",
    "evo_emoji_key": "tu_tieu_loi_ho_quan_evo",
    "is_kemonomimi": true,
    "stat_mult": {
      "atk": 1.36,
      "def": 1.3,
      "spd": 1.4,
      "hp": 1.32
    },
    "ultimate": {
      "id": "ult_tu_tieu_loi_ho_quan",
      "name": "Tử Tiêu Thần Lôi Phạt",
      "difficulty": "easy",
      "cooldownTurns": 4,
      "trigger": {
        "kind": "firstStrikesOrStuns",
        "count": 4
      },
      "effect": {
        "atkDmgPct": 2,
        "ignoreDodge": true,
        "shieldPierce": 0.8,
        "spdStealPct": 0.22,
        "stunChance": 0.4
      },
      "desc": "Tử Tiêu Thần Lôi Phạt (Dễ–Vừa): Ra đòn trước địch 4 lần → Cửu Vĩ Lôi Hồ giáng sét 200% ATK bỏ qua Né & Khiên + cướp 25% SPD 2 hiệp + 40% Choáng (CD 4)."
    }
  },
  "van_hoa_linh_loc_co": {
    "base_pet_type": "van_hoa_linh_loc_co",
    "evolved_name": "Vạn Hoa Linh Lộc Cơ (Chân Thần)",
    "element": "Mộc",
    "evo_image_file": "pets/van_hoa_linh_loc_co_evo.webp",
    "evo_emoji_key": "van_hoa_linh_loc_co_evo",
    "is_kemonomimi": true,
    "stat_mult": {
      "atk": 1.32,
      "def": 1.38,
      "spd": 1.35,
      "hp": 1.4
    },
    "ultimate": {
      "id": "ult_van_hoa_linh_loc_co",
      "name": "Bách Hoa Trường Sinh Ấn",
      "difficulty": "easy",
      "cooldownTurns": 4,
      "trigger": {
        "kind": "shieldTurnsOrHeal",
        "turns": 4,
        "healPctMaxHp": 0.75
      },
      "effect": {
        "cleanseAll": true,
        "healMaxHpPct": 0.22,
        "shieldMaxHpPct": 0.28,
        "poisonPct": 0.06,
        "poisonTurns": 2
      },
      "desc": "Bách Hoa Trường Sinh Ấn (Dễ–Vừa): Tích 4 lần hồi HP hoặc thanh tẩy → Thanh tẩy 100% debuff + hồi 24% MaxHP + dựng Khiên Hoa 30% MaxHP phản 25% ST (CD 4)."
    }
  },
  "thai_am_ngoc_tho_tien": {
    "base_pet_type": "thai_am_ngoc_tho_tien",
    "evolved_name": "Thái Âm Ngọc Thố Tiên (Chân Thần)",
    "element": "Quang",
    "evo_image_file": "pets/thai_am_ngoc_tho_tien_evo.webp",
    "evo_emoji_key": "thai_am_ngoc_tho_tien_evo",
    "is_kemonomimi": true,
    "stat_mult": {
      "atk": 1.32,
      "def": 1.38,
      "spd": 1.36,
      "hp": 1.38
    },
    "ultimate": {
      "id": "ult_thai_am_ngoc_tho_tien",
      "name": "Thái Âm Thánh Nguyệt Quang",
      "difficulty": "easy",
      "cooldownTurns": 4,
      "trigger": {
        "kind": "healsOrCleanses",
        "count": 4
      },
      "effect": {
        "cleanseAll": true,
        "healMaxHpPct": 0.2,
        "dmgRedPct": 0.2,
        "dmgRedTurns": 2,
        "atkDmgPct": 1.65
      },
      "desc": "Thái Âm Thánh Nguyệt Quang (Dễ–Vừa): Tích 4 lần hồi HP hoặc Né → Hồi 20% MaxHP + xóa toàn bộ debuff + giáng đòn Thánh Quang 190% ATK xuyên 60% DEF (CD 4)."
    }
  },
  "tinh_ha_nguyet_mieu_co": {
    "base_pet_type": "tinh_ha_nguyet_mieu_co",
    "evolved_name": "Tinh Hà Nguyệt Miêu Cơ (Chân Thần)",
    "element": "Hư Không",
    "evo_image_file": "pets/tinh_ha_nguyet_mieu_co_evo.webp",
    "evo_emoji_key": "tinh_ha_nguyet_mieu_co_evo",
    "is_kemonomimi": true,
    "stat_mult": {
      "atk": 1.36,
      "def": 1.34,
      "spd": 1.4,
      "hp": 1.34
    },
    "ultimate": {
      "id": "ult_tinh_ha_nguyet_mieu_co",
      "name": "Tinh Hà Nghịch Chuyển",
      "difficulty": "extreme",
      "cooldownTurns": 6,
      "trigger": {
        "kind": "critsOrDmgDealt",
        "crits": 4,
        "pctMaxHp": 2.35
      },
      "effect": {
        "restoreMissingHpPct": 0.24,
        "trueMaxHpDmgPct": 0.32,
        "ignoreDmgRed": true
      },
      "desc": "Tinh Hà Nghịch Chuyển (Cực Khó): Né 3 lần hoặc sinh tồn 5 hiệp → Đảo ngược 25% HP đã mất + giáng 33% MaxHP ST Hư Không chuẩn bỏ qua Khiên + tăng 40% Né 1 hiệp (CD 6)."
    }
  },
  "hoang_thien_ky_lan_quan": {
    "base_pet_type": "hoang_thien_ky_lan_quan",
    "evolved_name": "Hoàng Thiên Kỳ Lân Quân (Chân Thần)",
    "element": "Thổ",
    "evo_image_file": "pets/hoang_thien_ky_lan_quan_evo.webp",
    "evo_emoji_key": "hoang_thien_ky_lan_quan_evo",
    "is_kemonomimi": true,
    "stat_mult": {
      "atk": 1.3,
      "def": 1.4,
      "spd": 1.3,
      "hp": 1.4
    },
    "ultimate": {
      "id": "ult_hoang_thien_ky_lan_quan",
      "name": "Hoàng Thiên Trấn Nhạc Phá",
      "difficulty": "hard",
      "cooldownTurns": 5,
      "trigger": {
        "kind": "burnStacksOrRevive",
        "stacks": 4
      },
      "effect": {
        "trueMaxHpDmgPct": 0.26,
        "shieldMaxHpPct": 0.45,
        "dmgRedPct": 0.25,
        "dmgRedTurns": 2
      },
      "desc": "Hoàng Thiên Trấn Nhạc Phá (Khó): Gánh 160% MaxHP ST hoặc Khiên bị vỡ → Dựng ngay Khiên 45% MaxHP + giáng 27% MaxHP ST chuẩn + tăng 25% DEF 2 hiệp (CD 5)."
    }
  }
};

export const V17_PET_HAX = Object.fromEntries(
  V17_NEW_PETS.map((p) => [p.pet_type, p.hax_config])
);

export const V17_NEW_EQUIPMENT = [
  {
    "item_id": "weapon_unique_11",
    "item_name": "« Thái Sơ Hỗn Độn Chiến Kích »",
    "item_type": "weapon",
    "rarity": "Tối Thượng",
    "rarity_key": "mythic",
    "element": "Hỗn Độn",
    "bonus_atk": 785,
    "bonus_def": 140,
    "bonus_spd": 335,
    "bonus_hp": 0,
    "bonus_crit": 19,
    "hax_skill": "Thái Sơ Phá Vạn Thuẫn",
    "hax_description": "Xuyên 70% Khiên, 56% DEF & +14% ST Bạo Kích chuẩn.",
    "drop_rate": 0.65,
    "is_unique": true,
    "file": "items/weapon_unique_11.webp"
  },
  {
    "item_id": "weapon_unique_12",
    "item_name": "« Phần Nhật Chu Tước Thần Kiếm »",
    "item_type": "weapon",
    "rarity": "Tối Thượng",
    "rarity_key": "mythic",
    "element": "Hỏa",
    "bonus_atk": 790,
    "bonus_def": 110,
    "bonus_spd": 330,
    "bonus_hp": 0,
    "bonus_crit": 18,
    "hax_skill": "Chu Tước Phần Thần Diệm",
    "hax_description": "Xuyên 58% DEF & thiêu đốt 10.5% HP tối đa địch bỏ qua Khiên.",
    "drop_rate": 0.65,
    "is_unique": true,
    "file": "items/weapon_unique_12.webp"
  },
  {
    "item_id": "weapon_unique_13",
    "item_name": "« Vạn Kiếp Bạch Đế Long Thương »",
    "item_type": "weapon",
    "rarity": "Tối Thượng",
    "rarity_key": "mythic",
    "element": "Kim",
    "bonus_atk": 780,
    "bonus_def": 130,
    "bonus_spd": 350,
    "bonus_hp": 0,
    "bonus_crit": 19,
    "hax_skill": "Tinh Không Đế Nhận",
    "hax_description": "35% tung thêm đòn 70% ATK xuyên 60% Khiên & cướp 25% SPD.",
    "drop_rate": 0.65,
    "is_unique": true,
    "file": "items/weapon_unique_13.webp"
  },
  {
    "item_id": "weapon_unique_14",
    "item_name": "« Bắc Hải Tuyệt Đống Băng Trượng »",
    "item_type": "weapon",
    "rarity": "Tối Thượng",
    "rarity_key": "mythic",
    "element": "Thủy",
    "bonus_atk": 775,
    "bonus_def": 155,
    "bonus_spd": 335,
    "bonus_hp": 0,
    "bonus_crit": 18,
    "hax_skill": "Huyết Nguyệt Đoạn Hồi",
    "hax_description": "Hút 28% ST, giảm 55% Hồi Máu & kết liễu địch <22% HP (38%).",
    "drop_rate": 0.65,
    "is_unique": true,
    "file": "items/weapon_unique_14.webp"
  },
  {
    "item_id": "weapon_unique_15",
    "item_name": "« Tinh Không Đoạn Giới Thần Cung »",
    "item_type": "weapon",
    "rarity": "Tối Thượng",
    "rarity_key": "mythic",
    "element": "Hư Không",
    "bonus_atk": 785,
    "bonus_def": 140,
    "bonus_spd": 335,
    "bonus_hp": 0,
    "bonus_crit": 19,
    "hax_skill": "Thái Sơ Phá Vạn Thuẫn",
    "hax_description": "Xuyên 70% Khiên, 56% DEF & +14% ST Bạo Kích chuẩn.",
    "drop_rate": 0.65,
    "is_unique": true,
    "file": "items/weapon_unique_15.webp"
  },
  {
    "item_id": "weapon_unique_16",
    "item_name": "« Cửu Tiêu Lôi Đình Thần Đao »",
    "item_type": "weapon",
    "rarity": "Tối Thượng",
    "rarity_key": "mythic",
    "element": "Lôi",
    "bonus_atk": 790,
    "bonus_def": 110,
    "bonus_spd": 330,
    "bonus_hp": 0,
    "bonus_crit": 18,
    "hax_skill": "Chu Tước Phần Thần Diệm",
    "hax_description": "Xuyên 58% DEF & thiêu đốt 10.5% HP tối đa địch bỏ qua Khiên.",
    "drop_rate": 0.65,
    "is_unique": true,
    "file": "items/weapon_unique_16.webp"
  },
  {
    "item_id": "weapon_unique_17",
    "item_name": "« Vĩnh Dạ Huyết Nguyệt Ma Liêm »",
    "item_type": "weapon",
    "rarity": "Tối Thượng",
    "rarity_key": "mythic",
    "element": "Ám",
    "bonus_atk": 780,
    "bonus_def": 130,
    "bonus_spd": 350,
    "bonus_hp": 0,
    "bonus_crit": 19,
    "hax_skill": "Tinh Không Đế Nhận",
    "hax_description": "35% tung thêm đòn 70% ATK xuyên 60% Khiên & cướp 25% SPD.",
    "drop_rate": 0.65,
    "is_unique": true,
    "file": "items/weapon_unique_17.webp"
  },
  {
    "item_id": "weapon_mythic_23",
    "item_name": "« Thái Bạch Ngân Phong Kiếm »",
    "item_type": "weapon",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "element": "Kim",
    "bonus_atk": 745,
    "bonus_def": 100,
    "bonus_spd": 300,
    "bonus_hp": 0,
    "bonus_crit": 16,
    "hax_skill": "Kiếm Khí Xuyên Giáp",
    "hax_description": "Xuyên 52% DEF & +12% ST lên Khiên địch.",
    "drop_rate": 0.65,
    "is_unique": false,
    "file": "items/weapon_mythic_23.webp"
  },
  {
    "item_id": "weapon_mythic_24",
    "item_name": "« Phá Quân Kim Lân Kích »",
    "item_type": "weapon",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "element": "Kim",
    "bonus_atk": 750,
    "bonus_def": 80,
    "bonus_spd": 310,
    "bonus_hp": 0,
    "bonus_crit": 16,
    "hax_skill": "Liệt Diệm Phá Thuẫn",
    "hax_description": "Xuyên 55% Khiên & thiêu đốt 8% HP tối đa địch/hiệp.",
    "drop_rate": 0.65,
    "is_unique": false,
    "file": "items/weapon_mythic_24.webp"
  },
  {
    "item_id": "weapon_mythic_25",
    "item_name": "« Lăng Tiêu Bạch Vũ Cung »",
    "item_type": "weapon",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "element": "Kim",
    "bonus_atk": 735,
    "bonus_def": 130,
    "bonus_spd": 315,
    "bonus_hp": 0,
    "bonus_crit": 15,
    "hax_skill": "Liên Hoàn Thần Kích",
    "hax_description": "28% tung liên kích phụ 65% ATK xuyên 45% DEF.",
    "drop_rate": 0.65,
    "is_unique": false,
    "file": "items/weapon_mythic_25.webp"
  },
  {
    "item_id": "weapon_mythic_26",
    "item_name": "« Thanh Đế Bích Ngọc Kiếm »",
    "item_type": "weapon",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "element": "Mộc",
    "bonus_atk": 740,
    "bonus_def": 120,
    "bonus_spd": 305,
    "bonus_hp": 0,
    "bonus_crit": 17,
    "hax_skill": "Phệ Linh Tịch Diệt",
    "hax_description": "Hút 24% ST thành HP & Giảm 42% Hồi Máu địch.",
    "drop_rate": 0.65,
    "is_unique": false,
    "file": "items/weapon_mythic_26.webp"
  },
  {
    "item_id": "weapon_mythic_27",
    "item_name": "« Vạn Hoa Linh Mộc Phiến »",
    "item_type": "weapon",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "element": "Mộc",
    "bonus_atk": 730,
    "bonus_def": 150,
    "bonus_spd": 310,
    "bonus_hp": 0,
    "bonus_crit": 15,
    "hax_skill": "Thanh Quang Đoạn Buff",
    "hax_description": "Xóa 1 buff địch mỗi 2 hiệp & +16% ST chuẩn phụ.",
    "drop_rate": 0.65,
    "is_unique": false,
    "file": "items/weapon_mythic_27.webp"
  },
  {
    "item_id": "weapon_mythic_28",
    "item_name": "« Xuân Phong Lục Trúc Tiêu »",
    "item_type": "weapon",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "element": "Mộc",
    "bonus_atk": 745,
    "bonus_def": 110,
    "bonus_spd": 320,
    "bonus_hp": 0,
    "bonus_crit": 16,
    "hax_skill": "Băng Lôi Chấn Nhiếp",
    "hax_description": "26% gây Choáng 1 hiệp & giảm 18% SPD địch.",
    "drop_rate": 0.65,
    "is_unique": false,
    "file": "items/weapon_mythic_28.webp"
  },
  {
    "item_id": "weapon_mythic_29",
    "item_name": "« Hàn Sương Tuyết Liên Kiếm »",
    "item_type": "weapon",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "element": "Thủy",
    "bonus_atk": 745,
    "bonus_def": 100,
    "bonus_spd": 300,
    "bonus_hp": 0,
    "bonus_crit": 16,
    "hax_skill": "Kiếm Khí Xuyên Giáp",
    "hax_description": "Xuyên 52% DEF & +12% ST lên Khiên địch.",
    "drop_rate": 0.65,
    "is_unique": false,
    "file": "items/weapon_mythic_29.webp"
  },
  {
    "item_id": "weapon_mythic_30",
    "item_name": "« Thương Hải Long Cung Thương »",
    "item_type": "weapon",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "element": "Thủy",
    "bonus_atk": 750,
    "bonus_def": 80,
    "bonus_spd": 310,
    "bonus_hp": 0,
    "bonus_crit": 16,
    "hax_skill": "Liệt Diệm Phá Thuẫn",
    "hax_description": "Xuyên 55% Khiên & thiêu đốt 8% HP tối đa địch/hiệp.",
    "drop_rate": 0.65,
    "is_unique": false,
    "file": "items/weapon_mythic_30.webp"
  },
  {
    "item_id": "weapon_mythic_31",
    "item_name": "« Bích Ba Lưu Ly Phiến »",
    "item_type": "weapon",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "element": "Thủy",
    "bonus_atk": 735,
    "bonus_def": 130,
    "bonus_spd": 315,
    "bonus_hp": 0,
    "bonus_crit": 15,
    "hax_skill": "Liên Hoàn Thần Kích",
    "hax_description": "28% tung liên kích phụ 65% ATK xuyên 45% DEF.",
    "drop_rate": 0.65,
    "is_unique": false,
    "file": "items/weapon_mythic_31.webp"
  },
  {
    "item_id": "weapon_mythic_32",
    "item_name": "« Xích Diễm Hồng Liên Kiếm »",
    "item_type": "weapon",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "element": "Hỏa",
    "bonus_atk": 740,
    "bonus_def": 120,
    "bonus_spd": 305,
    "bonus_hp": 0,
    "bonus_crit": 17,
    "hax_skill": "Phệ Linh Tịch Diệt",
    "hax_description": "Hút 24% ST thành HP & Giảm 42% Hồi Máu địch.",
    "drop_rate": 0.65,
    "is_unique": false,
    "file": "items/weapon_mythic_32.webp"
  },
  {
    "item_id": "weapon_mythic_33",
    "item_name": "« Liệt Nhật Kim Ô Đao »",
    "item_type": "weapon",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "element": "Hỏa",
    "bonus_atk": 730,
    "bonus_def": 150,
    "bonus_spd": 310,
    "bonus_hp": 0,
    "bonus_crit": 15,
    "hax_skill": "Thanh Quang Đoạn Buff",
    "hax_description": "Xóa 1 buff địch mỗi 2 hiệp & +16% ST chuẩn phụ.",
    "drop_rate": 0.65,
    "is_unique": false,
    "file": "items/weapon_mythic_33.webp"
  },
  {
    "item_id": "weapon_mythic_34",
    "item_name": "« Phần Thành Hỏa Long Trượng »",
    "item_type": "weapon",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "element": "Hỏa",
    "bonus_atk": 745,
    "bonus_def": 110,
    "bonus_spd": 320,
    "bonus_hp": 0,
    "bonus_crit": 16,
    "hax_skill": "Băng Lôi Chấn Nhiếp",
    "hax_description": "26% gây Choáng 1 hiệp & giảm 18% SPD địch.",
    "drop_rate": 0.65,
    "is_unique": false,
    "file": "items/weapon_mythic_34.webp"
  },
  {
    "item_id": "weapon_mythic_35",
    "item_name": "« Hoàng Thiên Trấn Nhạc Chùy »",
    "item_type": "weapon",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "element": "Thổ",
    "bonus_atk": 745,
    "bonus_def": 100,
    "bonus_spd": 300,
    "bonus_hp": 0,
    "bonus_crit": 16,
    "hax_skill": "Kiếm Khí Xuyên Giáp",
    "hax_description": "Xuyên 52% DEF & +12% ST lên Khiên địch.",
    "drop_rate": 0.65,
    "is_unique": false,
    "file": "items/weapon_mythic_35.webp"
  },
  {
    "item_id": "weapon_mythic_36",
    "item_name": "« Hậu Thổ Huyền Hoàng Thương »",
    "item_type": "weapon",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "element": "Thổ",
    "bonus_atk": 750,
    "bonus_def": 80,
    "bonus_spd": 310,
    "bonus_hp": 0,
    "bonus_crit": 16,
    "hax_skill": "Liệt Diệm Phá Thuẫn",
    "hax_description": "Xuyên 55% Khiên & thiêu đốt 8% HP tối đa địch/hiệp.",
    "drop_rate": 0.65,
    "is_unique": false,
    "file": "items/weapon_mythic_36.webp"
  },
  {
    "item_id": "weapon_mythic_37",
    "item_name": "« Bàn Thạch Khai Địa Kiếm »",
    "item_type": "weapon",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "element": "Thổ",
    "bonus_atk": 735,
    "bonus_def": 130,
    "bonus_spd": 315,
    "bonus_hp": 0,
    "bonus_crit": 15,
    "hax_skill": "Liên Hoàn Thần Kích",
    "hax_description": "28% tung liên kích phụ 65% ATK xuyên 45% DEF.",
    "drop_rate": 0.65,
    "is_unique": false,
    "file": "items/weapon_mythic_37.webp"
  },
  {
    "item_id": "weapon_mythic_38",
    "item_name": "« Tử Tiêu Lôi Quang Kiếm »",
    "item_type": "weapon",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "element": "Lôi",
    "bonus_atk": 740,
    "bonus_def": 120,
    "bonus_spd": 305,
    "bonus_hp": 0,
    "bonus_crit": 17,
    "hax_skill": "Phệ Linh Tịch Diệt",
    "hax_description": "Hút 24% ST thành HP & Giảm 42% Hồi Máu địch.",
    "drop_rate": 0.65,
    "is_unique": false,
    "file": "items/weapon_mythic_38.webp"
  },
  {
    "item_id": "weapon_mythic_39",
    "item_name": "« Cuồng Lôi Phá Vân Thương »",
    "item_type": "weapon",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "element": "Lôi",
    "bonus_atk": 730,
    "bonus_def": 150,
    "bonus_spd": 310,
    "bonus_hp": 0,
    "bonus_crit": 15,
    "hax_skill": "Thanh Quang Đoạn Buff",
    "hax_description": "Xóa 1 buff địch mỗi 2 hiệp & +16% ST chuẩn phụ.",
    "drop_rate": 0.65,
    "is_unique": false,
    "file": "items/weapon_mythic_39.webp"
  },
  {
    "item_id": "weapon_mythic_40",
    "item_name": "« Lôi Đình Song Nguyệt Luân »",
    "item_type": "weapon",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "element": "Lôi",
    "bonus_atk": 745,
    "bonus_def": 110,
    "bonus_spd": 320,
    "bonus_hp": 0,
    "bonus_crit": 16,
    "hax_skill": "Băng Lôi Chấn Nhiếp",
    "hax_description": "26% gây Choáng 1 hiệp & giảm 18% SPD địch.",
    "drop_rate": 0.65,
    "is_unique": false,
    "file": "items/weapon_mythic_40.webp"
  },
  {
    "item_id": "weapon_mythic_41",
    "item_name": "« Thánh Quang Lưu Ly Kiếm »",
    "item_type": "weapon",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "element": "Quang",
    "bonus_atk": 745,
    "bonus_def": 100,
    "bonus_spd": 300,
    "bonus_hp": 0,
    "bonus_crit": 16,
    "hax_skill": "Kiếm Khí Xuyên Giáp",
    "hax_description": "Xuyên 52% DEF & +12% ST lên Khiên địch.",
    "drop_rate": 0.65,
    "is_unique": false,
    "file": "items/weapon_mythic_41.webp"
  },
  {
    "item_id": "weapon_mythic_42",
    "item_name": "« Nhật Diệu Thiên Luân Trượng »",
    "item_type": "weapon",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "element": "Quang",
    "bonus_atk": 750,
    "bonus_def": 80,
    "bonus_spd": 310,
    "bonus_hp": 0,
    "bonus_crit": 16,
    "hax_skill": "Liệt Diệm Phá Thuẫn",
    "hax_description": "Xuyên 55% Khiên & thiêu đốt 8% HP tối đa địch/hiệp.",
    "drop_rate": 0.65,
    "is_unique": false,
    "file": "items/weapon_mythic_42.webp"
  },
  {
    "item_id": "weapon_mythic_43",
    "item_name": "« Thái Dương Thánh Vũ Cung »",
    "item_type": "weapon",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "element": "Quang",
    "bonus_atk": 735,
    "bonus_def": 130,
    "bonus_spd": 315,
    "bonus_hp": 0,
    "bonus_crit": 15,
    "hax_skill": "Liên Hoàn Thần Kích",
    "hax_description": "28% tung liên kích phụ 65% ATK xuyên 45% DEF.",
    "drop_rate": 0.65,
    "is_unique": false,
    "file": "items/weapon_mythic_43.webp"
  },
  {
    "item_id": "weapon_mythic_44",
    "item_name": "« U Minh Bỉ Ngạn Kiếm »",
    "item_type": "weapon",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "element": "Ám",
    "bonus_atk": 740,
    "bonus_def": 120,
    "bonus_spd": 305,
    "bonus_hp": 0,
    "bonus_crit": 17,
    "hax_skill": "Phệ Linh Tịch Diệt",
    "hax_description": "Hút 24% ST thành HP & Giảm 42% Hồi Máu địch.",
    "drop_rate": 0.65,
    "is_unique": false,
    "file": "items/weapon_mythic_44.webp"
  },
  {
    "item_id": "weapon_mythic_45",
    "item_name": "« Huyết Ảnh Đoạt Hồn Trảo »",
    "item_type": "weapon",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "element": "Ám",
    "bonus_atk": 730,
    "bonus_def": 150,
    "bonus_spd": 310,
    "bonus_hp": 0,
    "bonus_crit": 15,
    "hax_skill": "Thanh Quang Đoạn Buff",
    "hax_description": "Xóa 1 buff địch mỗi 2 hiệp & +16% ST chuẩn phụ.",
    "drop_rate": 0.65,
    "is_unique": false,
    "file": "items/weapon_mythic_45.webp"
  },
  {
    "item_id": "weapon_mythic_46",
    "item_name": "« Tinh Hà Nguyệt Ảnh Kiếm »",
    "item_type": "weapon",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "element": "Hư Không",
    "bonus_atk": 745,
    "bonus_def": 110,
    "bonus_spd": 320,
    "bonus_hp": 0,
    "bonus_crit": 16,
    "hax_skill": "Băng Lôi Chấn Nhiếp",
    "hax_description": "26% gây Choáng 1 hiệp & giảm 18% SPD địch.",
    "drop_rate": 0.65,
    "is_unique": false,
    "file": "items/weapon_mythic_46.webp"
  },
  {
    "item_id": "weapon_mythic_47",
    "item_name": "« Hư Không Thứ Nguyên Phiến »",
    "item_type": "weapon",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "element": "Hư Không",
    "bonus_atk": 745,
    "bonus_def": 100,
    "bonus_spd": 300,
    "bonus_hp": 0,
    "bonus_crit": 16,
    "hax_skill": "Kiếm Khí Xuyên Giáp",
    "hax_description": "Xuyên 52% DEF & +12% ST lên Khiên địch.",
    "drop_rate": 0.65,
    "is_unique": false,
    "file": "items/weapon_mythic_47.webp"
  },
  {
    "item_id": "weapon_mythic_48",
    "item_name": "« Ngân Hà Tinh Đẩu Trượng »",
    "item_type": "weapon",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "element": "Hư Không",
    "bonus_atk": 750,
    "bonus_def": 80,
    "bonus_spd": 310,
    "bonus_hp": 0,
    "bonus_crit": 16,
    "hax_skill": "Liệt Diệm Phá Thuẫn",
    "hax_description": "Xuyên 55% Khiên & thiêu đốt 8% HP tối đa địch/hiệp.",
    "drop_rate": 0.65,
    "is_unique": false,
    "file": "items/weapon_mythic_48.webp"
  },
  {
    "item_id": "gem_unique_11",
    "item_name": "« Thái Sơ Hỗn Độn Linh Châu »",
    "item_type": "gem",
    "rarity": "Tối Thượng",
    "rarity_key": "mythic",
    "element": "Hỗn Độn",
    "bonus_atk": 180,
    "bonus_def": 810,
    "bonus_spd": 195,
    "bonus_hp": 5300,
    "bonus_crit": 0,
    "hax_skill": "Hỗn Độn Bất Phá Châu",
    "hax_description": "Đầu trận Khiên 95% HP, giảm 28% ST chuẩn & hồi 8% HP/hiệp.",
    "drop_rate": 0.65,
    "is_unique": true,
    "file": "items/gem_unique_11.webp"
  },
  {
    "item_id": "gem_unique_12",
    "item_name": "« Bất Diệt Kim Ô Thần Ấn »",
    "item_type": "gem",
    "rarity": "Tối Thượng",
    "rarity_key": "mythic",
    "element": "Hỏa",
    "bonus_atk": 165,
    "bonus_def": 800,
    "bonus_spd": 205,
    "bonus_hp": 5250,
    "bonus_crit": 0,
    "hax_skill": "Vạn Pháp Tịnh Thế Ấn",
    "hax_description": "Miễn nhiễm 85% Khống Chế, thanh tẩy 1 debuff/hiệp & miễn nhiễm Độc/Đốt.",
    "drop_rate": 0.65,
    "is_unique": true,
    "file": "items/gem_unique_12.webp"
  },
  {
    "item_id": "gem_unique_13",
    "item_name": "« Vạn Kiếm Quy Tông Đạo Kính »",
    "item_type": "gem",
    "rarity": "Tối Thượng",
    "rarity_key": "mythic",
    "element": "Kim",
    "bonus_atk": 175,
    "bonus_def": 795,
    "bonus_spd": 215,
    "bonus_hp": 5200,
    "bonus_crit": 0,
    "hax_skill": "Phản Kính Tuyệt Thế Châu",
    "hax_description": "Phản 72% ST nhận vào (bỏ qua khiên) & +20% Né Tránh.",
    "drop_rate": 0.65,
    "is_unique": true,
    "file": "items/gem_unique_13.webp"
  },
  {
    "item_id": "gem_unique_14",
    "item_name": "« Thương Hải Huyền Băng Ngọc Tỷ »",
    "item_type": "gem",
    "rarity": "Tối Thượng",
    "rarity_key": "mythic",
    "element": "Thủy",
    "bonus_atk": 170,
    "bonus_def": 805,
    "bonus_spd": 190,
    "bonus_hp": 5250,
    "bonus_crit": 0,
    "hax_skill": "Cửu U Bất Tử Hồn Ngọc",
    "hax_description": "Hồi sinh 58% HP kèm Khiên 38% HP (1 lần/trận) & đốt 7% HP địch.",
    "drop_rate": 0.65,
    "is_unique": true,
    "file": "items/gem_unique_14.webp"
  },
  {
    "item_id": "gem_unique_15",
    "item_name": "« Tinh Không Vô Cực Bảo Châu »",
    "item_type": "gem",
    "rarity": "Tối Thượng",
    "rarity_key": "mythic",
    "element": "Hư Không",
    "bonus_atk": 180,
    "bonus_def": 810,
    "bonus_spd": 195,
    "bonus_hp": 5300,
    "bonus_crit": 0,
    "hax_skill": "Hỗn Độn Bất Phá Châu",
    "hax_description": "Đầu trận Khiên 95% HP, giảm 28% ST chuẩn & hồi 8% HP/hiệp.",
    "drop_rate": 0.65,
    "is_unique": true,
    "file": "items/gem_unique_15.webp"
  },
  {
    "item_id": "gem_unique_16",
    "item_name": "« Cửu Tiêu Thánh Quang Đạo Bích »",
    "item_type": "gem",
    "rarity": "Tối Thượng",
    "rarity_key": "mythic",
    "element": "Quang",
    "bonus_atk": 165,
    "bonus_def": 800,
    "bonus_spd": 205,
    "bonus_hp": 5250,
    "bonus_crit": 0,
    "hax_skill": "Vạn Pháp Tịnh Thế Ấn",
    "hax_description": "Miễn nhiễm 85% Khống Chế, thanh tẩy 1 debuff/hiệp & miễn nhiễm Độc/Đốt.",
    "drop_rate": 0.65,
    "is_unique": true,
    "file": "items/gem_unique_16.webp"
  },
  {
    "item_id": "gem_unique_17",
    "item_name": "« Cửu U Mạn Châu Hồn Châu »",
    "item_type": "gem",
    "rarity": "Tối Thượng",
    "rarity_key": "mythic",
    "element": "Ám",
    "bonus_atk": 175,
    "bonus_def": 795,
    "bonus_spd": 215,
    "bonus_hp": 5200,
    "bonus_crit": 0,
    "hax_skill": "Phản Kính Tuyệt Thế Châu",
    "hax_description": "Phản 72% ST nhận vào (bỏ qua khiên) & +20% Né Tránh.",
    "drop_rate": 0.65,
    "is_unique": true,
    "file": "items/gem_unique_17.webp"
  },
  {
    "item_id": "gem_mythic_23",
    "item_name": "« Thái Bạch Kiếm Tâm Ngọc »",
    "item_type": "gem",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "element": "Kim",
    "bonus_atk": 140,
    "bonus_def": 760,
    "bonus_spd": 160,
    "bonus_hp": 5000,
    "bonus_crit": 0,
    "hax_skill": "Bất Hoại Thần Thuẫn",
    "hax_description": "Đầu trận tạo Khiên 82% HP & giảm 24% ST nhận vào.",
    "drop_rate": 0.65,
    "is_unique": false,
    "file": "items/gem_mythic_23.webp"
  },
  {
    "item_id": "gem_mythic_24",
    "item_name": "« Kim Cương Bất Hoại Ấn »",
    "item_type": "gem",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "element": "Kim",
    "bonus_atk": 110,
    "bonus_def": 750,
    "bonus_spd": 175,
    "bonus_hp": 5100,
    "bonus_crit": 0,
    "hax_skill": "Tịnh Tâm Đạo Ngọc",
    "hax_description": "Hồi 11% HP/hiệp & giảm 70% sát thương Độc/Đốt.",
    "drop_rate": 0.65,
    "is_unique": false,
    "file": "items/gem_mythic_24.webp"
  },
  {
    "item_id": "gem_mythic_25",
    "item_name": "« Bạch Đế Hộ Mệnh Bội »",
    "item_type": "gem",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "element": "Kim",
    "bonus_atk": 150,
    "bonus_def": 745,
    "bonus_spd": 185,
    "bonus_hp": 4950,
    "bonus_crit": 0,
    "hax_skill": "Hỗn Nguyên Phản Chấn",
    "hax_description": "Phản 58% ST nhận vào (thẳng máu, bỏ qua khiên) & kháng 55% Khống Chế.",
    "drop_rate": 0.65,
    "is_unique": false,
    "file": "items/gem_mythic_25.webp"
  },
  {
    "item_id": "gem_mythic_26",
    "item_name": "« Thanh Đế Trường Sinh Châu »",
    "item_type": "gem",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "element": "Mộc",
    "bonus_atk": 130,
    "bonus_def": 755,
    "bonus_spd": 170,
    "bonus_hp": 5050,
    "bonus_crit": 0,
    "hax_skill": "Thanh Tẩy Lưu Ly",
    "hax_description": "Kháng 70% Khống Chế, tự hóa giải 1 debuff/hiệp & giảm 25% ST chuẩn.",
    "drop_rate": 0.65,
    "is_unique": false,
    "file": "items/gem_mythic_26.webp"
  },
  {
    "item_id": "gem_mythic_27",
    "item_name": "« Vạn Hoa Bích Ngọc Bội »",
    "item_type": "gem",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "element": "Mộc",
    "bonus_atk": 160,
    "bonus_def": 740,
    "bonus_spd": 195,
    "bonus_hp": 4900,
    "bonus_crit": 0,
    "hax_skill": "Hư Không Ảnh Bích",
    "hax_description": "Tăng +22% Né Tránh & dựng Khiên 55% HP đầu trận.",
    "drop_rate": 0.65,
    "is_unique": false,
    "file": "items/gem_mythic_27.webp"
  },
  {
    "item_id": "gem_mythic_28",
    "item_name": "« Thái Ất Linh Diệp Kính »",
    "item_type": "gem",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "element": "Mộc",
    "bonus_atk": 145,
    "bonus_def": 765,
    "bonus_spd": 165,
    "bonus_hp": 5000,
    "bonus_crit": 0,
    "hax_skill": "Thái Ất Bất Diệt Ngọc",
    "hax_description": "Chặn đòn chí tử tại 15% HP (1 lần/trận) & giảm 38% ST Bạo Kích.",
    "drop_rate": 0.65,
    "is_unique": false,
    "file": "items/gem_mythic_28.webp"
  },
  {
    "item_id": "gem_mythic_29",
    "item_name": "« Hàn Băng Lưu Ly Châu »",
    "item_type": "gem",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "element": "Thủy",
    "bonus_atk": 140,
    "bonus_def": 760,
    "bonus_spd": 160,
    "bonus_hp": 5000,
    "bonus_crit": 0,
    "hax_skill": "Bất Hoại Thần Thuẫn",
    "hax_description": "Đầu trận tạo Khiên 82% HP & giảm 24% ST nhận vào.",
    "drop_rate": 0.65,
    "is_unique": false,
    "file": "items/gem_mythic_29.webp"
  },
  {
    "item_id": "gem_mythic_30",
    "item_name": "« Bích Hải Long Châu Bội »",
    "item_type": "gem",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "element": "Thủy",
    "bonus_atk": 110,
    "bonus_def": 750,
    "bonus_spd": 175,
    "bonus_hp": 5100,
    "bonus_crit": 0,
    "hax_skill": "Tịnh Tâm Đạo Ngọc",
    "hax_description": "Hồi 11% HP/hiệp & giảm 70% sát thương Độc/Đốt.",
    "drop_rate": 0.65,
    "is_unique": false,
    "file": "items/gem_mythic_30.webp"
  },
  {
    "item_id": "gem_mythic_31",
    "item_name": "« Tuyết Vực Thanh Tâm Ngọc »",
    "item_type": "gem",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "element": "Thủy",
    "bonus_atk": 150,
    "bonus_def": 745,
    "bonus_spd": 185,
    "bonus_hp": 4950,
    "bonus_crit": 0,
    "hax_skill": "Hỗn Nguyên Phản Chấn",
    "hax_description": "Phản 58% ST nhận vào (thẳng máu, bỏ qua khiên) & kháng 55% Khống Chế.",
    "drop_rate": 0.65,
    "is_unique": false,
    "file": "items/gem_mythic_31.webp"
  },
  {
    "item_id": "gem_mythic_32",
    "item_name": "« Xích Viêm Chu Tước Bội »",
    "item_type": "gem",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "element": "Hỏa",
    "bonus_atk": 130,
    "bonus_def": 755,
    "bonus_spd": 170,
    "bonus_hp": 5050,
    "bonus_crit": 0,
    "hax_skill": "Thanh Tẩy Lưu Ly",
    "hax_description": "Kháng 70% Khống Chế, tự hóa giải 1 debuff/hiệp & giảm 25% ST chuẩn.",
    "drop_rate": 0.65,
    "is_unique": false,
    "file": "items/gem_mythic_32.webp"
  },
  {
    "item_id": "gem_mythic_33",
    "item_name": "« Phần Thiên Hỏa Tinh Châu »",
    "item_type": "gem",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "element": "Hỏa",
    "bonus_atk": 160,
    "bonus_def": 740,
    "bonus_spd": 195,
    "bonus_hp": 4900,
    "bonus_crit": 0,
    "hax_skill": "Hư Không Ảnh Bích",
    "hax_description": "Tăng +22% Né Tránh & dựng Khiên 55% HP đầu trận.",
    "drop_rate": 0.65,
    "is_unique": false,
    "file": "items/gem_mythic_33.webp"
  },
  {
    "item_id": "gem_mythic_34",
    "item_name": "« Hồng Liên Tịnh Hỏa Ấn »",
    "item_type": "gem",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "element": "Hỏa",
    "bonus_atk": 145,
    "bonus_def": 765,
    "bonus_spd": 165,
    "bonus_hp": 5000,
    "bonus_crit": 0,
    "hax_skill": "Thái Ất Bất Diệt Ngọc",
    "hax_description": "Chặn đòn chí tử tại 15% HP (1 lần/trận) & giảm 38% ST Bạo Kích.",
    "drop_rate": 0.65,
    "is_unique": false,
    "file": "items/gem_mythic_34.webp"
  },
  {
    "item_id": "gem_mythic_35",
    "item_name": "« Hậu Thổ Sơn Hà Bích »",
    "item_type": "gem",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "element": "Thổ",
    "bonus_atk": 140,
    "bonus_def": 760,
    "bonus_spd": 160,
    "bonus_hp": 5000,
    "bonus_crit": 0,
    "hax_skill": "Bất Hoại Thần Thuẫn",
    "hax_description": "Đầu trận tạo Khiên 82% HP & giảm 24% ST nhận vào.",
    "drop_rate": 0.65,
    "is_unique": false,
    "file": "items/gem_mythic_35.webp"
  },
  {
    "item_id": "gem_mythic_36",
    "item_name": "« Huyền Hoàng Trấn Hồn Ấn »",
    "item_type": "gem",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "element": "Thổ",
    "bonus_atk": 110,
    "bonus_def": 750,
    "bonus_spd": 175,
    "bonus_hp": 5100,
    "bonus_crit": 0,
    "hax_skill": "Tịnh Tâm Đạo Ngọc",
    "hax_description": "Hồi 11% HP/hiệp & giảm 70% sát thương Độc/Đốt.",
    "drop_rate": 0.65,
    "is_unique": false,
    "file": "items/gem_mythic_36.webp"
  },
  {
    "item_id": "gem_mythic_37",
    "item_name": "« Hoàng Ngọc Hộ Thân Châu »",
    "item_type": "gem",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "element": "Thổ",
    "bonus_atk": 150,
    "bonus_def": 745,
    "bonus_spd": 185,
    "bonus_hp": 4950,
    "bonus_crit": 0,
    "hax_skill": "Hỗn Nguyên Phản Chấn",
    "hax_description": "Phản 58% ST nhận vào (thẳng máu, bỏ qua khiên) & kháng 55% Khống Chế.",
    "drop_rate": 0.65,
    "is_unique": false,
    "file": "items/gem_mythic_37.webp"
  },
  {
    "item_id": "gem_mythic_38",
    "item_name": "« Tử Lôi Ngưng Điện Châu »",
    "item_type": "gem",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "element": "Lôi",
    "bonus_atk": 130,
    "bonus_def": 755,
    "bonus_spd": 170,
    "bonus_hp": 5050,
    "bonus_crit": 0,
    "hax_skill": "Thanh Tẩy Lưu Ly",
    "hax_description": "Kháng 70% Khống Chế, tự hóa giải 1 debuff/hiệp & giảm 25% ST chuẩn.",
    "drop_rate": 0.65,
    "is_unique": false,
    "file": "items/gem_mythic_38.webp"
  },
  {
    "item_id": "gem_mythic_39",
    "item_name": "« Lôi Đình Phá Tà Kính »",
    "item_type": "gem",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "element": "Lôi",
    "bonus_atk": 160,
    "bonus_def": 740,
    "bonus_spd": 195,
    "bonus_hp": 4900,
    "bonus_crit": 0,
    "hax_skill": "Hư Không Ảnh Bích",
    "hax_description": "Tăng +22% Né Tránh & dựng Khiên 55% HP đầu trận.",
    "drop_rate": 0.65,
    "is_unique": false,
    "file": "items/gem_mythic_39.webp"
  },
  {
    "item_id": "gem_mythic_40",
    "item_name": "« Cửu Thiên Điện Quang Bội »",
    "item_type": "gem",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "element": "Lôi",
    "bonus_atk": 145,
    "bonus_def": 765,
    "bonus_spd": 165,
    "bonus_hp": 5000,
    "bonus_crit": 0,
    "hax_skill": "Thái Ất Bất Diệt Ngọc",
    "hax_description": "Chặn đòn chí tử tại 15% HP (1 lần/trận) & giảm 38% ST Bạo Kích.",
    "drop_rate": 0.65,
    "is_unique": false,
    "file": "items/gem_mythic_40.webp"
  },
  {
    "item_id": "gem_mythic_41",
    "item_name": "« Thánh Quang Bạch Liên Châu »",
    "item_type": "gem",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "element": "Quang",
    "bonus_atk": 140,
    "bonus_def": 760,
    "bonus_spd": 160,
    "bonus_hp": 5000,
    "bonus_crit": 0,
    "hax_skill": "Bất Hoại Thần Thuẫn",
    "hax_description": "Đầu trận tạo Khiên 82% HP & giảm 24% ST nhận vào.",
    "drop_rate": 0.65,
    "is_unique": false,
    "file": "items/gem_mythic_41.webp"
  },
  {
    "item_id": "gem_mythic_42",
    "item_name": "« Nhật Nguyệt Tịnh Tâm Kính »",
    "item_type": "gem",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "element": "Quang",
    "bonus_atk": 110,
    "bonus_def": 750,
    "bonus_spd": 175,
    "bonus_hp": 5100,
    "bonus_crit": 0,
    "hax_skill": "Tịnh Tâm Đạo Ngọc",
    "hax_description": "Hồi 11% HP/hiệp & giảm 70% sát thương Độc/Đốt.",
    "drop_rate": 0.65,
    "is_unique": false,
    "file": "items/gem_mythic_42.webp"
  },
  {
    "item_id": "gem_mythic_43",
    "item_name": "« Kim Quang Hộ Pháp Ấn »",
    "item_type": "gem",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "element": "Quang",
    "bonus_atk": 150,
    "bonus_def": 745,
    "bonus_spd": 185,
    "bonus_hp": 4950,
    "bonus_crit": 0,
    "hax_skill": "Hỗn Nguyên Phản Chấn",
    "hax_description": "Phản 58% ST nhận vào (thẳng máu, bỏ qua khiên) & kháng 55% Khống Chế.",
    "drop_rate": 0.65,
    "is_unique": false,
    "file": "items/gem_mythic_43.webp"
  },
  {
    "item_id": "gem_mythic_44",
    "item_name": "« Huyết Nguyệt U Hồn Bội »",
    "item_type": "gem",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "element": "Ám",
    "bonus_atk": 130,
    "bonus_def": 755,
    "bonus_spd": 170,
    "bonus_hp": 5050,
    "bonus_crit": 0,
    "hax_skill": "Thanh Tẩy Lưu Ly",
    "hax_description": "Kháng 70% Khống Chế, tự hóa giải 1 debuff/hiệp & giảm 25% ST chuẩn.",
    "drop_rate": 0.65,
    "is_unique": false,
    "file": "items/gem_mythic_44.webp"
  },
  {
    "item_id": "gem_mythic_45",
    "item_name": "« Dạ Ảnh Thôn Quang Châu »",
    "item_type": "gem",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "element": "Ám",
    "bonus_atk": 160,
    "bonus_def": 740,
    "bonus_spd": 195,
    "bonus_hp": 4900,
    "bonus_crit": 0,
    "hax_skill": "Hư Không Ảnh Bích",
    "hax_description": "Tăng +22% Né Tránh & dựng Khiên 55% HP đầu trận.",
    "drop_rate": 0.65,
    "is_unique": false,
    "file": "items/gem_mythic_45.webp"
  },
  {
    "item_id": "gem_mythic_46",
    "item_name": "« Tinh Vân Nguyệt Hoa Châu »",
    "item_type": "gem",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "element": "Hư Không",
    "bonus_atk": 145,
    "bonus_def": 765,
    "bonus_spd": 165,
    "bonus_hp": 5000,
    "bonus_crit": 0,
    "hax_skill": "Thái Ất Bất Diệt Ngọc",
    "hax_description": "Chặn đòn chí tử tại 15% HP (1 lần/trận) & giảm 38% ST Bạo Kích.",
    "drop_rate": 0.65,
    "is_unique": false,
    "file": "items/gem_mythic_46.webp"
  },
  {
    "item_id": "gem_mythic_47",
    "item_name": "« Hư Không Phá Huyễn Kính »",
    "item_type": "gem",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "element": "Hư Không",
    "bonus_atk": 140,
    "bonus_def": 760,
    "bonus_spd": 160,
    "bonus_hp": 5000,
    "bonus_crit": 0,
    "hax_skill": "Bất Hoại Thần Thuẫn",
    "hax_description": "Đầu trận tạo Khiên 82% HP & giảm 24% ST nhận vào.",
    "drop_rate": 0.65,
    "is_unique": false,
    "file": "items/gem_mythic_47.webp"
  },
  {
    "item_id": "gem_mythic_48",
    "item_name": "« Ngân Hà Định Tinh Ấn »",
    "item_type": "gem",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "element": "Hư Không",
    "bonus_atk": 110,
    "bonus_def": 750,
    "bonus_spd": 175,
    "bonus_hp": 5100,
    "bonus_crit": 0,
    "hax_skill": "Tịnh Tâm Đạo Ngọc",
    "hax_description": "Hồi 11% HP/hiệp & giảm 70% sát thương Độc/Đốt.",
    "drop_rate": 0.65,
    "is_unique": false,
    "file": "items/gem_mythic_48.webp"
  },
  {
    "item_id": "soul_unique_11",
    "item_name": "« Hồng Mông Nguyên Thủy Thần Hồn »",
    "item_type": "soul",
    "rarity": "Tối Thượng",
    "rarity_key": "mythic",
    "element": "Hỗn Độn",
    "bonus_atk": 475,
    "bonus_def": 405,
    "bonus_spd": 355,
    "bonus_hp": 0,
    "bonus_crit": 16,
    "hax_skill": "Thần Hồn Khai Thiên",
    "hax_description": "Xuyên 54% DEF, tích +7% ATK/hiệp (5 tầng) & hồi 7% HP/hiệp.",
    "drop_rate": 0.65,
    "is_unique": true,
    "file": "items/soul_unique_11.webp"
  },
  {
    "item_id": "soul_unique_12",
    "item_name": "« Chúc Long Phần Thiên Đế Hồn »",
    "item_type": "soul",
    "rarity": "Tối Thượng",
    "rarity_key": "mythic",
    "element": "Hỏa",
    "bonus_atk": 480,
    "bonus_def": 395,
    "bonus_spd": 350,
    "bonus_hp": 0,
    "bonus_crit": 17,
    "hax_skill": "Bất Tử Đế Hồn",
    "hax_description": "Hồi sinh 58% HP + đốt 10% HP tối đa địch bỏ qua Khiên.",
    "drop_rate": 0.65,
    "is_unique": true,
    "file": "items/soul_unique_12.webp"
  },
  {
    "item_id": "soul_unique_13",
    "item_name": "« Vạn Kiếm Thiên Tôn Chiến Hồn »",
    "item_type": "soul",
    "rarity": "Tối Thượng",
    "rarity_key": "mythic",
    "element": "Kim",
    "bonus_atk": 470,
    "bonus_def": 410,
    "bonus_spd": 365,
    "bonus_hp": 0,
    "bonus_crit": 16,
    "hax_skill": "Cửu Thiên Kiếm Tôn Hồn",
    "hax_description": "Mỗi 2 hiệp giáng kiếm khí 85% ATK xuyên 65% DEF & 60% Khiên.",
    "drop_rate": 0.65,
    "is_unique": true,
    "file": "items/soul_unique_13.webp"
  },
  {
    "item_id": "soul_unique_14",
    "item_name": "« Bắc Minh Băng Đế Thần Hồn »",
    "item_type": "soul",
    "rarity": "Tối Thượng",
    "rarity_key": "mythic",
    "element": "Thủy",
    "bonus_atk": 485,
    "bonus_def": 390,
    "bonus_spd": 355,
    "bonus_hp": 0,
    "bonus_crit": 17,
    "hax_skill": "Vĩnh Dạ Tu La Đế Hồn",
    "hax_description": "Hút 32% ST, giảm 55% Hồi Máu & kết liễu <22% HP (36%).",
    "drop_rate": 0.65,
    "is_unique": true,
    "file": "items/soul_unique_14.webp"
  },
  {
    "item_id": "soul_unique_15",
    "item_name": "« Tinh Không Chủ Tể Chiến Hồn »",
    "item_type": "soul",
    "rarity": "Tối Thượng",
    "rarity_key": "mythic",
    "element": "Hư Không",
    "bonus_atk": 475,
    "bonus_def": 405,
    "bonus_spd": 355,
    "bonus_hp": 0,
    "bonus_crit": 16,
    "hax_skill": "Thần Hồn Khai Thiên",
    "hax_description": "Xuyên 54% DEF, tích +7% ATK/hiệp (5 tầng) & hồi 7% HP/hiệp.",
    "drop_rate": 0.65,
    "is_unique": true,
    "file": "items/soul_unique_15.webp"
  },
  {
    "item_id": "soul_unique_16",
    "item_name": "« Vĩnh Dạ Huyết Hoàng Ma Hồn »",
    "item_type": "soul",
    "rarity": "Tối Thượng",
    "rarity_key": "mythic",
    "element": "Ám",
    "bonus_atk": 480,
    "bonus_def": 395,
    "bonus_spd": 350,
    "bonus_hp": 0,
    "bonus_crit": 17,
    "hax_skill": "Bất Tử Đế Hồn",
    "hax_description": "Hồi sinh 58% HP + đốt 10% HP tối đa địch bỏ qua Khiên.",
    "drop_rate": 0.65,
    "is_unique": true,
    "file": "items/soul_unique_16.webp"
  },
  {
    "item_id": "soul_mythic_22",
    "item_name": "« Bạch Hổ Phá Quân Hồn »",
    "item_type": "soul",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "element": "Kim",
    "bonus_atk": 445,
    "bonus_def": 375,
    "bonus_spd": 320,
    "bonus_hp": 0,
    "bonus_crit": 12,
    "hax_skill": "Chiến Hồn Phá Quân",
    "hax_description": "Tích +6% ATK/hiệp (tối đa 5 tầng) & xuyên 48% DEF.",
    "drop_rate": 0.65,
    "is_unique": false,
    "file": "items/soul_mythic_22.webp"
  },
  {
    "item_id": "soul_mythic_23",
    "item_name": "« Kim Giáp Thiên Tướng Hồn »",
    "item_type": "soul",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "element": "Kim",
    "bonus_atk": 430,
    "bonus_def": 390,
    "bonus_spd": 315,
    "bonus_hp": 0,
    "bonus_crit": 10,
    "hax_skill": "Thánh Hồn Trường Thanh",
    "hax_description": "Hồi 9% HP/hiệp & tự thanh tẩy 1 debuff mỗi 2 hiệp.",
    "drop_rate": 0.65,
    "is_unique": false,
    "file": "items/soul_mythic_23.webp"
  },
  {
    "item_id": "soul_mythic_24",
    "item_name": "« Kiếm Hoàng Ngưng Sương Hồn »",
    "item_type": "soul",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "element": "Kim",
    "bonus_atk": 440,
    "bonus_def": 365,
    "bonus_spd": 345,
    "bonus_hp": 0,
    "bonus_crit": 14,
    "hax_skill": "Ảo Ảnh Kiếm Hồn",
    "hax_description": "Tăng +26% Né Tránh & phản kích 75% ATK (xuyên 40% DEF) khi né.",
    "drop_rate": 0.65,
    "is_unique": false,
    "file": "items/soul_mythic_24.webp"
  },
  {
    "item_id": "soul_mythic_25",
    "item_name": "« Thanh Đế Hoa Tiên Hồn »",
    "item_type": "soul",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "element": "Mộc",
    "bonus_atk": 450,
    "bonus_def": 360,
    "bonus_spd": 330,
    "bonus_hp": 0,
    "bonus_crit": 15,
    "hax_skill": "Tu La Huyết Hồn",
    "hax_description": "Hút 26% ST thành HP & giảm 45% Hồi Máu địch.",
    "drop_rate": 0.65,
    "is_unique": false,
    "file": "items/soul_mythic_25.webp"
  },
  {
    "item_id": "soul_mythic_26",
    "item_name": "« Mộc Long Trường Sinh Hồn »",
    "item_type": "soul",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "element": "Mộc",
    "bonus_atk": 435,
    "bonus_def": 385,
    "bonus_spd": 335,
    "bonus_hp": 0,
    "bonus_crit": 12,
    "hax_skill": "Lôi Đế Chiến Ý",
    "hax_description": "Cướp 28% SPD đầu trận & 26% gây Choáng 1 hiệp.",
    "drop_rate": 0.65,
    "is_unique": false,
    "file": "items/soul_mythic_26.webp"
  },
  {
    "item_id": "soul_mythic_27",
    "item_name": "« Bách Thảo Dược Vương Hồn »",
    "item_type": "soul",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "element": "Mộc",
    "bonus_atk": 425,
    "bonus_def": 395,
    "bonus_spd": 310,
    "bonus_hp": 0,
    "bonus_crit": 10,
    "hax_skill": "Huyền Giáp Bảo Hồn",
    "hax_description": "Giảm 26% ST nhận vào & phản 40% ST (bỏ qua khiên).",
    "drop_rate": 0.65,
    "is_unique": false,
    "file": "items/soul_mythic_27.webp"
  },
  {
    "item_id": "soul_mythic_28",
    "item_name": "« Thương Hải Long Vương Hồn »",
    "item_type": "soul",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "element": "Thủy",
    "bonus_atk": 445,
    "bonus_def": 375,
    "bonus_spd": 320,
    "bonus_hp": 0,
    "bonus_crit": 12,
    "hax_skill": "Chiến Hồn Phá Quân",
    "hax_description": "Tích +6% ATK/hiệp (tối đa 5 tầng) & xuyên 48% DEF.",
    "drop_rate": 0.65,
    "is_unique": false,
    "file": "items/soul_mythic_28.webp"
  },
  {
    "item_id": "soul_mythic_29",
    "item_name": "« Tuyết Nữ Hàn Băng Hồn »",
    "item_type": "soul",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "element": "Thủy",
    "bonus_atk": 430,
    "bonus_def": 390,
    "bonus_spd": 315,
    "bonus_hp": 0,
    "bonus_crit": 10,
    "hax_skill": "Thánh Hồn Trường Thanh",
    "hax_description": "Hồi 9% HP/hiệp & tự thanh tẩy 1 debuff mỗi 2 hiệp.",
    "drop_rate": 0.65,
    "is_unique": false,
    "file": "items/soul_mythic_29.webp"
  },
  {
    "item_id": "soul_mythic_30",
    "item_name": "« Huyền Quy Trấn Hải Hồn »",
    "item_type": "soul",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "element": "Thủy",
    "bonus_atk": 440,
    "bonus_def": 365,
    "bonus_spd": 345,
    "bonus_hp": 0,
    "bonus_crit": 14,
    "hax_skill": "Ảo Ảnh Kiếm Hồn",
    "hax_description": "Tăng +26% Né Tránh & phản kích 75% ATK (xuyên 40% DEF) khi né.",
    "drop_rate": 0.65,
    "is_unique": false,
    "file": "items/soul_mythic_30.webp"
  },
  {
    "item_id": "soul_mythic_31",
    "item_name": "« Xích Đế Viêm Hoàng Hồn »",
    "item_type": "soul",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "element": "Hỏa",
    "bonus_atk": 450,
    "bonus_def": 360,
    "bonus_spd": 330,
    "bonus_hp": 0,
    "bonus_crit": 15,
    "hax_skill": "Tu La Huyết Hồn",
    "hax_description": "Hút 26% ST thành HP & giảm 45% Hồi Máu địch.",
    "drop_rate": 0.65,
    "is_unique": false,
    "file": "items/soul_mythic_31.webp"
  },
  {
    "item_id": "soul_mythic_32",
    "item_name": "« Hỏa Phượng Niết Bàn Hồn »",
    "item_type": "soul",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "element": "Hỏa",
    "bonus_atk": 435,
    "bonus_def": 385,
    "bonus_spd": 335,
    "bonus_hp": 0,
    "bonus_crit": 12,
    "hax_skill": "Lôi Đế Chiến Ý",
    "hax_description": "Cướp 28% SPD đầu trận & 26% gây Choáng 1 hiệp.",
    "drop_rate": 0.65,
    "is_unique": false,
    "file": "items/soul_mythic_32.webp"
  },
  {
    "item_id": "soul_mythic_33",
    "item_name": "« Dung Nham Chiến Thần Hồn »",
    "item_type": "soul",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "element": "Hỏa",
    "bonus_atk": 425,
    "bonus_def": 395,
    "bonus_spd": 310,
    "bonus_hp": 0,
    "bonus_crit": 10,
    "hax_skill": "Huyền Giáp Bảo Hồn",
    "hax_description": "Giảm 26% ST nhận vào & phản 40% ST (bỏ qua khiên).",
    "drop_rate": 0.65,
    "is_unique": false,
    "file": "items/soul_mythic_33.webp"
  },
  {
    "item_id": "soul_mythic_34",
    "item_name": "« Bàn Cổ Thần Lực Hồn »",
    "item_type": "soul",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "element": "Thổ",
    "bonus_atk": 445,
    "bonus_def": 375,
    "bonus_spd": 320,
    "bonus_hp": 0,
    "bonus_crit": 12,
    "hax_skill": "Chiến Hồn Phá Quân",
    "hax_description": "Tích +6% ATK/hiệp (tối đa 5 tầng) & xuyên 48% DEF.",
    "drop_rate": 0.65,
    "is_unique": false,
    "file": "items/soul_mythic_34.webp"
  },
  {
    "item_id": "soul_mythic_35",
    "item_name": "« Kỳ Lân Trấn Địa Hồn »",
    "item_type": "soul",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "element": "Thổ",
    "bonus_atk": 430,
    "bonus_def": 390,
    "bonus_spd": 315,
    "bonus_hp": 0,
    "bonus_crit": 10,
    "hax_skill": "Thánh Hồn Trường Thanh",
    "hax_description": "Hồi 9% HP/hiệp & tự thanh tẩy 1 debuff mỗi 2 hiệp.",
    "drop_rate": 0.65,
    "is_unique": false,
    "file": "items/soul_mythic_35.webp"
  },
  {
    "item_id": "soul_mythic_36",
    "item_name": "« Hậu Thổ Hoàng Hậu Hồn »",
    "item_type": "soul",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "element": "Thổ",
    "bonus_atk": 440,
    "bonus_def": 365,
    "bonus_spd": 345,
    "bonus_hp": 0,
    "bonus_crit": 14,
    "hax_skill": "Ảo Ảnh Kiếm Hồn",
    "hax_description": "Tăng +26% Né Tránh & phản kích 75% ATK (xuyên 40% DEF) khi né.",
    "drop_rate": 0.65,
    "is_unique": false,
    "file": "items/soul_mythic_36.webp"
  },
  {
    "item_id": "soul_mythic_37",
    "item_name": "« Lôi Đế Chấn Thiên Hồn »",
    "item_type": "soul",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "element": "Lôi",
    "bonus_atk": 450,
    "bonus_def": 360,
    "bonus_spd": 330,
    "bonus_hp": 0,
    "bonus_crit": 15,
    "hax_skill": "Tu La Huyết Hồn",
    "hax_description": "Hút 26% ST thành HP & giảm 45% Hồi Máu địch.",
    "drop_rate": 0.65,
    "is_unique": false,
    "file": "items/soul_mythic_37.webp"
  },
  {
    "item_id": "soul_mythic_38",
    "item_name": "« Tử Điện Lôi Long Hồn »",
    "item_type": "soul",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "element": "Lôi",
    "bonus_atk": 435,
    "bonus_def": 385,
    "bonus_spd": 335,
    "bonus_hp": 0,
    "bonus_crit": 12,
    "hax_skill": "Lôi Đế Chiến Ý",
    "hax_description": "Cướp 28% SPD đầu trận & 26% gây Choáng 1 hiệp.",
    "drop_rate": 0.65,
    "is_unique": false,
    "file": "items/soul_mythic_38.webp"
  },
  {
    "item_id": "soul_mythic_39",
    "item_name": "« Lôi Mẫu Thiên Uy Hồn »",
    "item_type": "soul",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "element": "Lôi",
    "bonus_atk": 425,
    "bonus_def": 395,
    "bonus_spd": 310,
    "bonus_hp": 0,
    "bonus_crit": 10,
    "hax_skill": "Huyền Giáp Bảo Hồn",
    "hax_description": "Giảm 26% ST nhận vào & phản 40% ST (bỏ qua khiên).",
    "drop_rate": 0.65,
    "is_unique": false,
    "file": "items/soul_mythic_39.webp"
  },
  {
    "item_id": "soul_mythic_40",
    "item_name": "« Đại Nhật Kim Thân Hồn »",
    "item_type": "soul",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "element": "Quang",
    "bonus_atk": 445,
    "bonus_def": 375,
    "bonus_spd": 320,
    "bonus_hp": 0,
    "bonus_crit": 12,
    "hax_skill": "Chiến Hồn Phá Quân",
    "hax_description": "Tích +6% ATK/hiệp (tối đa 5 tầng) & xuyên 48% DEF.",
    "drop_rate": 0.65,
    "is_unique": false,
    "file": "items/soul_mythic_40.webp"
  },
  {
    "item_id": "soul_mythic_41",
    "item_name": "« Thiên Sứ Thánh Quang Hồn »",
    "item_type": "soul",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "element": "Quang",
    "bonus_atk": 430,
    "bonus_def": 390,
    "bonus_spd": 315,
    "bonus_hp": 0,
    "bonus_crit": 10,
    "hax_skill": "Thánh Hồn Trường Thanh",
    "hax_description": "Hồi 9% HP/hiệp & tự thanh tẩy 1 debuff mỗi 2 hiệp.",
    "drop_rate": 0.65,
    "is_unique": false,
    "file": "items/soul_mythic_41.webp"
  },
  {
    "item_id": "soul_mythic_42",
    "item_name": "« Nguyệt Hoa Tiên Tử Hồn »",
    "item_type": "soul",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "element": "Quang",
    "bonus_atk": 440,
    "bonus_def": 365,
    "bonus_spd": 345,
    "bonus_hp": 0,
    "bonus_crit": 14,
    "hax_skill": "Ảo Ảnh Kiếm Hồn",
    "hax_description": "Tăng +26% Né Tránh & phản kích 75% ATK (xuyên 40% DEF) khi né.",
    "drop_rate": 0.65,
    "is_unique": false,
    "file": "items/soul_mythic_42.webp"
  },
  {
    "item_id": "soul_mythic_43",
    "item_name": "« Tu La Huyết Chiến Hồn »",
    "item_type": "soul",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "element": "Ám",
    "bonus_atk": 450,
    "bonus_def": 360,
    "bonus_spd": 330,
    "bonus_hp": 0,
    "bonus_crit": 15,
    "hax_skill": "Tu La Huyết Hồn",
    "hax_description": "Hút 26% ST thành HP & giảm 45% Hồi Máu địch.",
    "drop_rate": 0.65,
    "is_unique": false,
    "file": "items/soul_mythic_43.webp"
  },
  {
    "item_id": "soul_mythic_44",
    "item_name": "« U Đô Quỷ Đế Hồn »",
    "item_type": "soul",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "element": "Ám",
    "bonus_atk": 435,
    "bonus_def": 385,
    "bonus_spd": 335,
    "bonus_hp": 0,
    "bonus_crit": 12,
    "hax_skill": "Lôi Đế Chiến Ý",
    "hax_description": "Cướp 28% SPD đầu trận & 26% gây Choáng 1 hiệp.",
    "drop_rate": 0.65,
    "is_unique": false,
    "file": "items/soul_mythic_44.webp"
  },
  {
    "item_id": "soul_mythic_45",
    "item_name": "« Hắc Dạ Ảnh Sát Hồn »",
    "item_type": "soul",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "element": "Ám",
    "bonus_atk": 425,
    "bonus_def": 395,
    "bonus_spd": 310,
    "bonus_hp": 0,
    "bonus_crit": 10,
    "hax_skill": "Huyền Giáp Bảo Hồn",
    "hax_description": "Giảm 26% ST nhận vào & phản 40% ST (bỏ qua khiên).",
    "drop_rate": 0.65,
    "is_unique": false,
    "file": "items/soul_mythic_45.webp"
  },
  {
    "item_id": "soul_mythic_46",
    "item_name": "« Tinh Tú Huyễn Tiên Hồn »",
    "item_type": "soul",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "element": "Hư Không",
    "bonus_atk": 445,
    "bonus_def": 375,
    "bonus_spd": 320,
    "bonus_hp": 0,
    "bonus_crit": 12,
    "hax_skill": "Chiến Hồn Phá Quân",
    "hax_description": "Tích +6% ATK/hiệp (tối đa 5 tầng) & xuyên 48% DEF.",
    "drop_rate": 0.65,
    "is_unique": false,
    "file": "items/soul_mythic_46.webp"
  },
  {
    "item_id": "soul_mythic_47",
    "item_name": "« Thời Không Thủ Hộ Hồn »",
    "item_type": "soul",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "element": "Hư Không",
    "bonus_atk": 430,
    "bonus_def": 390,
    "bonus_spd": 315,
    "bonus_hp": 0,
    "bonus_crit": 10,
    "hax_skill": "Thánh Hồn Trường Thanh",
    "hax_description": "Hồi 9% HP/hiệp & tự thanh tẩy 1 debuff mỗi 2 hiệp.",
    "drop_rate": 0.65,
    "is_unique": false,
    "file": "items/soul_mythic_47.webp"
  },
  {
    "item_id": "soul_mythic_48",
    "item_name": "« Hư Không Tinh Hồ Hồn Ảnh »",
    "item_type": "soul",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "element": "Hư Không",
    "bonus_atk": 440,
    "bonus_def": 365,
    "bonus_spd": 345,
    "bonus_hp": 0,
    "bonus_crit": 14,
    "hax_skill": "Ảo Ảnh Kiếm Hồn",
    "hax_description": "Tăng +26% Né Tránh & phản kích 75% ATK (xuyên 40% DEF) khi né.",
    "drop_rate": 0.65,
    "is_unique": false,
    "file": "items/soul_mythic_48.webp"
  }
];

export const V17_EQUIP_HAX = {
  "weapon_unique_11": {
    "shieldPiercePct": 0.7,
    "defPiercePct": 0.56,
    "critBonusTrueAtkPct": 0.14
  },
  "weapon_unique_12": {
    "defPiercePct": 0.58,
    "burnOnHitPct": 0.105,
    "burnIgnoresShield": true
  },
  "weapon_unique_13": {
    "extraStrike": {
      "chance": 0.35,
      "atkRatio": 0.7,
      "shieldPierce": 0.6,
      "label": "Tinh Không Đế Nhận"
    },
    "startSpdStealPct": 0.25
  },
  "weapon_unique_14": {
    "lifestealPct": 0.28,
    "enemyHealRedPct": 0.55,
    "executeHpPct": 0.22,
    "executeChance": 0.38
  },
  "weapon_unique_15": {
    "shieldPiercePct": 0.7,
    "defPiercePct": 0.56,
    "critBonusTrueAtkPct": 0.14
  },
  "weapon_unique_16": {
    "defPiercePct": 0.58,
    "burnOnHitPct": 0.105,
    "burnIgnoresShield": true
  },
  "weapon_unique_17": {
    "extraStrike": {
      "chance": 0.35,
      "atkRatio": 0.7,
      "shieldPierce": 0.6,
      "label": "Tinh Không Đế Nhận"
    },
    "startSpdStealPct": 0.25
  },
  "weapon_mythic_23": {
    "defPiercePct": 0.52,
    "antiShieldDmgBonusPct": 0.12
  },
  "weapon_mythic_24": {
    "shieldPiercePct": 0.55,
    "burnOnHitPct": 0.08
  },
  "weapon_mythic_25": {
    "extraStrike": {
      "chance": 0.28,
      "atkRatio": 0.65,
      "defPierce": 0.45,
      "label": "Liên Hoàn Thần Kích"
    }
  },
  "weapon_mythic_26": {
    "lifestealPct": 0.24,
    "enemyHealRedPct": 0.42
  },
  "weapon_mythic_27": {
    "stripEnemyBuffInterval": 2,
    "bonusTrueAtkPct": 0.16
  },
  "weapon_mythic_28": {
    "ccProc": {
      "chance": 0.26,
      "kind": "stun",
      "skill": "Băng Lôi Chấn Nhiếp"
    },
    "startSpdDebuffPct": 0.18
  },
  "weapon_mythic_29": {
    "defPiercePct": 0.52,
    "antiShieldDmgBonusPct": 0.12
  },
  "weapon_mythic_30": {
    "shieldPiercePct": 0.55,
    "burnOnHitPct": 0.08
  },
  "weapon_mythic_31": {
    "extraStrike": {
      "chance": 0.28,
      "atkRatio": 0.65,
      "defPierce": 0.45,
      "label": "Liên Hoàn Thần Kích"
    }
  },
  "weapon_mythic_32": {
    "lifestealPct": 0.24,
    "enemyHealRedPct": 0.42
  },
  "weapon_mythic_33": {
    "stripEnemyBuffInterval": 2,
    "bonusTrueAtkPct": 0.16
  },
  "weapon_mythic_34": {
    "ccProc": {
      "chance": 0.26,
      "kind": "stun",
      "skill": "Băng Lôi Chấn Nhiếp"
    },
    "startSpdDebuffPct": 0.18
  },
  "weapon_mythic_35": {
    "defPiercePct": 0.52,
    "antiShieldDmgBonusPct": 0.12
  },
  "weapon_mythic_36": {
    "shieldPiercePct": 0.55,
    "burnOnHitPct": 0.08
  },
  "weapon_mythic_37": {
    "extraStrike": {
      "chance": 0.28,
      "atkRatio": 0.65,
      "defPierce": 0.45,
      "label": "Liên Hoàn Thần Kích"
    }
  },
  "weapon_mythic_38": {
    "lifestealPct": 0.24,
    "enemyHealRedPct": 0.42
  },
  "weapon_mythic_39": {
    "stripEnemyBuffInterval": 2,
    "bonusTrueAtkPct": 0.16
  },
  "weapon_mythic_40": {
    "ccProc": {
      "chance": 0.26,
      "kind": "stun",
      "skill": "Băng Lôi Chấn Nhiếp"
    },
    "startSpdDebuffPct": 0.18
  },
  "weapon_mythic_41": {
    "defPiercePct": 0.52,
    "antiShieldDmgBonusPct": 0.12
  },
  "weapon_mythic_42": {
    "shieldPiercePct": 0.55,
    "burnOnHitPct": 0.08
  },
  "weapon_mythic_43": {
    "extraStrike": {
      "chance": 0.28,
      "atkRatio": 0.65,
      "defPierce": 0.45,
      "label": "Liên Hoàn Thần Kích"
    }
  },
  "weapon_mythic_44": {
    "lifestealPct": 0.24,
    "enemyHealRedPct": 0.42
  },
  "weapon_mythic_45": {
    "stripEnemyBuffInterval": 2,
    "bonusTrueAtkPct": 0.16
  },
  "weapon_mythic_46": {
    "ccProc": {
      "chance": 0.26,
      "kind": "stun",
      "skill": "Băng Lôi Chấn Nhiếp"
    },
    "startSpdDebuffPct": 0.18
  },
  "weapon_mythic_47": {
    "defPiercePct": 0.52,
    "antiShieldDmgBonusPct": 0.12
  },
  "weapon_mythic_48": {
    "shieldPiercePct": 0.55,
    "burnOnHitPct": 0.08
  },
  "gem_unique_11": {
    "startShieldPct": 0.95,
    "trueDmgResistPct": 0.28,
    "turnHealPct": 0.08
  },
  "gem_unique_12": {
    "ccResistPct": 0.85,
    "turnCleanse": 1,
    "dotImmune": true
  },
  "gem_unique_13": {
    "reflectPct": 0.72,
    "dodgePct": 0.2
  },
  "gem_unique_14": {
    "reviveHpPct": 0.58,
    "reviveShieldPct": 0.38,
    "reflectBurnPct": 0.07
  },
  "gem_unique_15": {
    "startShieldPct": 0.95,
    "trueDmgResistPct": 0.28,
    "turnHealPct": 0.08
  },
  "gem_unique_16": {
    "ccResistPct": 0.85,
    "turnCleanse": 1,
    "dotImmune": true
  },
  "gem_unique_17": {
    "reflectPct": 0.72,
    "dodgePct": 0.2
  },
  "gem_mythic_23": {
    "startShieldPct": 0.82,
    "dmgRedPct": 0.24
  },
  "gem_mythic_24": {
    "turnHealPct": 0.11,
    "dotResistPct": 0.7
  },
  "gem_mythic_25": {
    "reflectPct": 0.58,
    "ccResistPct": 0.55
  },
  "gem_mythic_26": {
    "ccResistPct": 0.7,
    "turnCleanse": 1,
    "trueDmgResistPct": 0.25
  },
  "gem_mythic_27": {
    "dodgePct": 0.22,
    "startShieldPct": 0.55
  },
  "gem_mythic_28": {
    "cheatDeathHpPct": 0.15,
    "critDmgRedPct": 0.38
  },
  "gem_mythic_29": {
    "startShieldPct": 0.82,
    "dmgRedPct": 0.24
  },
  "gem_mythic_30": {
    "turnHealPct": 0.11,
    "dotResistPct": 0.7
  },
  "gem_mythic_31": {
    "reflectPct": 0.58,
    "ccResistPct": 0.55
  },
  "gem_mythic_32": {
    "ccResistPct": 0.7,
    "turnCleanse": 1,
    "trueDmgResistPct": 0.25
  },
  "gem_mythic_33": {
    "dodgePct": 0.22,
    "startShieldPct": 0.55
  },
  "gem_mythic_34": {
    "cheatDeathHpPct": 0.15,
    "critDmgRedPct": 0.38
  },
  "gem_mythic_35": {
    "startShieldPct": 0.82,
    "dmgRedPct": 0.24
  },
  "gem_mythic_36": {
    "turnHealPct": 0.11,
    "dotResistPct": 0.7
  },
  "gem_mythic_37": {
    "reflectPct": 0.58,
    "ccResistPct": 0.55
  },
  "gem_mythic_38": {
    "ccResistPct": 0.7,
    "turnCleanse": 1,
    "trueDmgResistPct": 0.25
  },
  "gem_mythic_39": {
    "dodgePct": 0.22,
    "startShieldPct": 0.55
  },
  "gem_mythic_40": {
    "cheatDeathHpPct": 0.15,
    "critDmgRedPct": 0.38
  },
  "gem_mythic_41": {
    "startShieldPct": 0.82,
    "dmgRedPct": 0.24
  },
  "gem_mythic_42": {
    "turnHealPct": 0.11,
    "dotResistPct": 0.7
  },
  "gem_mythic_43": {
    "reflectPct": 0.58,
    "ccResistPct": 0.55
  },
  "gem_mythic_44": {
    "ccResistPct": 0.7,
    "turnCleanse": 1,
    "trueDmgResistPct": 0.25
  },
  "gem_mythic_45": {
    "dodgePct": 0.22,
    "startShieldPct": 0.55
  },
  "gem_mythic_46": {
    "cheatDeathHpPct": 0.15,
    "critDmgRedPct": 0.38
  },
  "gem_mythic_47": {
    "startShieldPct": 0.82,
    "dmgRedPct": 0.24
  },
  "gem_mythic_48": {
    "turnHealPct": 0.11,
    "dotResistPct": 0.7
  },
  "soul_unique_11": {
    "defPiercePct": 0.54,
    "atkStackPct": 0.07,
    "atkStackMax": 5,
    "turnHealPct": 0.07
  },
  "soul_unique_12": {
    "reviveHpPct": 0.58,
    "burnOnHitPct": 0.1,
    "burnIgnoresShield": true
  },
  "soul_unique_13": {
    "every2TurnStrike": {
      "atkRatio": 0.85,
      "defPierce": 0.65,
      "shieldPierce": 0.6,
      "label": "Cửu Thiên Kiếm Tôn"
    }
  },
  "soul_unique_14": {
    "lifestealPct": 0.32,
    "enemyHealRedPct": 0.55,
    "executeHpPct": 0.22,
    "executeChance": 0.36
  },
  "soul_unique_15": {
    "defPiercePct": 0.54,
    "atkStackPct": 0.07,
    "atkStackMax": 5,
    "turnHealPct": 0.07
  },
  "soul_unique_16": {
    "reviveHpPct": 0.58,
    "burnOnHitPct": 0.1,
    "burnIgnoresShield": true
  },
  "soul_mythic_22": {
    "atkStackPct": 0.06,
    "atkStackMax": 5,
    "defPiercePct": 0.48
  },
  "soul_mythic_23": {
    "turnHealPct": 0.09,
    "turnCleanseInterval": 2
  },
  "soul_mythic_24": {
    "dodgePct": 0.26,
    "dodgeCounterAtkRatio": 0.75,
    "dodgeCounterDefPierce": 0.4,
    "dodgeCounterLabel": "Ảo Ảnh Kiếm Hồn"
  },
  "soul_mythic_25": {
    "lifestealPct": 0.26,
    "enemyHealRedPct": 0.45
  },
  "soul_mythic_26": {
    "startSpdStealPct": 0.28,
    "ccProc": {
      "chance": 0.26,
      "kind": "stun",
      "skill": "Lôi Đế Chiến Ý"
    }
  },
  "soul_mythic_27": {
    "dmgRedPct": 0.26,
    "reflectPct": 0.4
  },
  "soul_mythic_28": {
    "atkStackPct": 0.06,
    "atkStackMax": 5,
    "defPiercePct": 0.48
  },
  "soul_mythic_29": {
    "turnHealPct": 0.09,
    "turnCleanseInterval": 2
  },
  "soul_mythic_30": {
    "dodgePct": 0.26,
    "dodgeCounterAtkRatio": 0.75,
    "dodgeCounterDefPierce": 0.4,
    "dodgeCounterLabel": "Ảo Ảnh Kiếm Hồn"
  },
  "soul_mythic_31": {
    "lifestealPct": 0.26,
    "enemyHealRedPct": 0.45
  },
  "soul_mythic_32": {
    "startSpdStealPct": 0.28,
    "ccProc": {
      "chance": 0.26,
      "kind": "stun",
      "skill": "Lôi Đế Chiến Ý"
    }
  },
  "soul_mythic_33": {
    "dmgRedPct": 0.26,
    "reflectPct": 0.4
  },
  "soul_mythic_34": {
    "atkStackPct": 0.06,
    "atkStackMax": 5,
    "defPiercePct": 0.48
  },
  "soul_mythic_35": {
    "turnHealPct": 0.09,
    "turnCleanseInterval": 2
  },
  "soul_mythic_36": {
    "dodgePct": 0.26,
    "dodgeCounterAtkRatio": 0.75,
    "dodgeCounterDefPierce": 0.4,
    "dodgeCounterLabel": "Ảo Ảnh Kiếm Hồn"
  },
  "soul_mythic_37": {
    "lifestealPct": 0.26,
    "enemyHealRedPct": 0.45
  },
  "soul_mythic_38": {
    "startSpdStealPct": 0.28,
    "ccProc": {
      "chance": 0.26,
      "kind": "stun",
      "skill": "Lôi Đế Chiến Ý"
    }
  },
  "soul_mythic_39": {
    "dmgRedPct": 0.26,
    "reflectPct": 0.4
  },
  "soul_mythic_40": {
    "atkStackPct": 0.06,
    "atkStackMax": 5,
    "defPiercePct": 0.48
  },
  "soul_mythic_41": {
    "turnHealPct": 0.09,
    "turnCleanseInterval": 2
  },
  "soul_mythic_42": {
    "dodgePct": 0.26,
    "dodgeCounterAtkRatio": 0.75,
    "dodgeCounterDefPierce": 0.4,
    "dodgeCounterLabel": "Ảo Ảnh Kiếm Hồn"
  },
  "soul_mythic_43": {
    "lifestealPct": 0.26,
    "enemyHealRedPct": 0.45
  },
  "soul_mythic_44": {
    "startSpdStealPct": 0.28,
    "ccProc": {
      "chance": 0.26,
      "kind": "stun",
      "skill": "Lôi Đế Chiến Ý"
    }
  },
  "soul_mythic_45": {
    "dmgRedPct": 0.26,
    "reflectPct": 0.4
  },
  "soul_mythic_46": {
    "atkStackPct": 0.06,
    "atkStackMax": 5,
    "defPiercePct": 0.48
  },
  "soul_mythic_47": {
    "turnHealPct": 0.09,
    "turnCleanseInterval": 2
  },
  "soul_mythic_48": {
    "dodgePct": 0.26,
    "dodgeCounterAtkRatio": 0.75,
    "dodgeCounterDefPierce": 0.4,
    "dodgeCounterLabel": "Ảo Ảnh Kiếm Hồn"
  }
};

export const V17_DOMAINS = [
  {
    "domain_id": "domain_unique_6",
    "name": "« Cửu Kiếp Tru Tiên Kiếm Vực »",
    "element": "Kiếm Vực",
    "rarity": "Tối Thượng",
    "rarity_key": "mythic",
    "is_unique": true,
    "base_energy": 7,
    "enemy_active_debuff_pierce": 0.6,
    "enemy_buff_suppression": 0.05,
    "buffs": {
      "defPiercePct": 0.34,
      "shieldPiercePct": 0.32
    },
    "debuffs": {
      "defReductionPct": 0.32,
      "shieldDecayPct": 0.22
    },
    "buff_desc": "+34% Xuyên DEF & +32% Xuyên Khiên. + Áp Chế 5% Buff Vực địch.",
    "debuff_desc": "Giảm 32% DEF & Bào Mòn 22% Khiên/hiệp (Xuyên Kháng Vực 60%).",
    "is_domain": true,
    "category": "domain",
    "dao_ap": {
      "durationTurns": 3,
      "scaleFactor": 1.28,
      "label": "Đạo Áp • Cửu Kiếp Tru Tiên Kiếm Vực"
    },
    "file": "domains/domain_unique_6.webp"
  },
  {
    "domain_id": "domain_unique_7",
    "name": "« Thái Sơ Vạn Kiếm Thần Vực »",
    "element": "Kiếm Vực",
    "rarity": "Tối Thượng",
    "rarity_key": "mythic",
    "is_unique": true,
    "base_energy": 7,
    "enemy_active_debuff_pierce": 0.6,
    "enemy_buff_suppression": 0.05,
    "buffs": {
      "defPiercePct": 0.32,
      "haxDamageBonusPct": 0.24
    },
    "debuffs": {
      "defReductionPct": 0.3,
      "critTakenBonusPct": 0.24
    },
    "buff_desc": "+32% Xuyên DEF & +24% uy lực HAX. + Áp Chế 5% Buff Vực địch.",
    "debuff_desc": "Giảm 30% DEF & +24% ST Bạo Kích nhận (Xuyên Kháng Vực 60%).",
    "is_domain": true,
    "category": "domain",
    "dao_ap": {
      "durationTurns": 3,
      "scaleFactor": 1.28,
      "label": "Đạo Áp • Thái Sơ Vạn Kiếm Thần Vực"
    },
    "file": "domains/domain_unique_7.webp"
  },
  {
    "domain_id": "domain_unique_8",
    "name": "« Tinh Hà Kính Nguyệt Huyễn Vực »",
    "element": "Huyễn Vực",
    "rarity": "Tối Thượng",
    "rarity_key": "mythic",
    "is_unique": true,
    "base_energy": 7,
    "enemy_active_debuff_pierce": 0.6,
    "enemy_buff_suppression": 0.05,
    "buffs": {
      "haxProcBonusPct": 0.26,
      "dodgeBonusPct": 0.16
    },
    "debuffs": {
      "accuracyDownPct": 0.26,
      "haxFailPct": 0.2
    },
    "buff_desc": "+26% xác suất HAX & +16% Né Tránh. + Áp Chế 5% Buff Vực địch.",
    "debuff_desc": "Giảm 26% Chính Xác & Giảm 20% Tỉ Lệ HAX (Xuyên Kháng Vực 60%).",
    "is_domain": true,
    "category": "domain",
    "dao_ap": {
      "durationTurns": 3,
      "scaleFactor": 1.28,
      "label": "Đạo Áp • Tinh Hà Kính Nguyệt Huyễn Vực"
    },
    "file": "domains/domain_unique_8.webp"
  },
  {
    "domain_id": "domain_unique_9",
    "name": "« Cửu Thiên Mộng Điệp Thần Vực »",
    "element": "Huyễn Vực",
    "rarity": "Tối Thượng",
    "rarity_key": "mythic",
    "is_unique": true,
    "base_energy": 7,
    "enemy_active_debuff_pierce": 0.6,
    "enemy_buff_suppression": 0.05,
    "buffs": {
      "haxProcBonusPct": 0.24,
      "reflectResistPct": 0.44
    },
    "debuffs": {
      "accuracyDownPct": 0.24,
      "enemyShieldCapReductionPct": 0.3
    },
    "buff_desc": "+24% xác suất HAX & giảm 44% Phản Đòn. + Áp Chế 5% Buff Vực địch.",
    "debuff_desc": "Giảm 24% Chính Xác & Giảm 30% Khiên Tạo Mới (Xuyên Kháng Vực 60%).",
    "is_domain": true,
    "category": "domain",
    "dao_ap": {
      "durationTurns": 3,
      "scaleFactor": 1.28,
      "label": "Đạo Áp • Cửu Thiên Mộng Điệp Thần Vực"
    },
    "file": "domains/domain_unique_9.webp"
  },
  {
    "domain_id": "domain_unique_10",
    "name": "« Hồng Mông Chu Thiên Thần Trận »",
    "element": "Trận Vực",
    "rarity": "Tối Thượng",
    "rarity_key": "mythic",
    "is_unique": true,
    "base_energy": 7,
    "enemy_active_debuff_pierce": 0.6,
    "enemy_buff_suppression": 0.05,
    "buffs": {
      "shieldStrengthBonusPct": 0.34,
      "controlResistPct": 0.36
    },
    "debuffs": {
      "healReductionPct": 0.36,
      "defReductionPct": 0.22
    },
    "buff_desc": "+34% Độ Dày Khiên & +36% Kháng Khống Chế. + Áp Chế 5% Buff Vực địch.",
    "debuff_desc": "Giảm 36% Hồi Máu & Giảm 22% DEF (Xuyên Kháng Vực 60%).",
    "is_domain": true,
    "category": "domain",
    "dao_ap": {
      "durationTurns": 3,
      "scaleFactor": 1.28,
      "label": "Đạo Áp • Hồng Mông Chu Thiên Thần Trận"
    },
    "file": "domains/domain_unique_10.webp"
  },
  {
    "domain_id": "domain_unique_11",
    "name": "« Vô Cực Âm Dương Càn Khôn Trận »",
    "element": "Trận Vực",
    "rarity": "Tối Thượng",
    "rarity_key": "mythic",
    "is_unique": true,
    "base_energy": 7,
    "enemy_active_debuff_pierce": 0.6,
    "enemy_buff_suppression": 0.05,
    "buffs": {
      "trueDmgResistPct": 0.3,
      "shieldStrengthBonusPct": 0.3
    },
    "debuffs": {
      "enemyShieldCapReductionPct": 0.34,
      "haxFailPct": 0.18
    },
    "buff_desc": "Giảm 30% ST Chuẩn & +30% Độ Dày Khiên. + Áp Chế 5% Buff Vực địch.",
    "debuff_desc": "Giảm 34% Khiên Tạo Mới & Giảm 18% Tỉ Lệ HAX (Xuyên Kháng Vực 60%).",
    "is_domain": true,
    "category": "domain",
    "dao_ap": {
      "durationTurns": 3,
      "scaleFactor": 1.28,
      "label": "Đạo Áp • Vô Cực Âm Dương Càn Khôn Trận"
    },
    "file": "domains/domain_unique_11.webp"
  },
  {
    "domain_id": "domain_unique_12",
    "name": "« Cửu U Bỉ Ngạn Đế Minh Vực »",
    "element": "Minh Vực",
    "rarity": "Tối Thượng",
    "rarity_key": "mythic",
    "is_unique": true,
    "base_energy": 7,
    "enemy_active_debuff_pierce": 0.6,
    "enemy_buff_suppression": 0.05,
    "buffs": {
      "lifestealPct": 0.22,
      "haxDamageBonusPct": 0.2
    },
    "debuffs": {
      "dotMaxHpPct": 0.09,
      "healReductionPct": 0.35
    },
    "buff_desc": "+22% Hút Máu & +20% uy lực HAX. + Áp Chế 5% Buff Vực địch.",
    "debuff_desc": "Rút 9% HP tối đa/hiệp & Giảm 35% Hồi Máu (Xuyên Kháng Vực 60%).",
    "is_domain": true,
    "category": "domain",
    "dao_ap": {
      "durationTurns": 3,
      "scaleFactor": 1.28,
      "label": "Đạo Áp • Cửu U Bỉ Ngạn Đế Minh Vực"
    },
    "file": "domains/domain_unique_12.webp"
  },
  {
    "domain_id": "domain_unique_13",
    "name": "« Hoàng Tuyền Luân Hồi Minh Vực »",
    "element": "Minh Vực",
    "rarity": "Tối Thượng",
    "rarity_key": "mythic",
    "is_unique": true,
    "base_energy": 7,
    "enemy_active_debuff_pierce": 0.6,
    "enemy_buff_suppression": 0.05,
    "buffs": {
      "lifestealPct": 0.2,
      "shieldPiercePct": 0.32
    },
    "debuffs": {
      "maxHpCutPct": 0.14,
      "dotMaxHpPct": 0.07
    },
    "buff_desc": "+20% Hút Máu & +32% Xuyên Khiên. + Áp Chế 5% Buff Vực địch.",
    "debuff_desc": "Cắt 14% Trần HP Tối Đa & rút 7% HP/hiệp (Xuyên Kháng Vực 60%).",
    "is_domain": true,
    "category": "domain",
    "dao_ap": {
      "durationTurns": 3,
      "scaleFactor": 1.28,
      "label": "Đạo Áp • Hoàng Tuyền Luân Hồi Minh Vực"
    },
    "file": "domains/domain_unique_13.webp"
  },
  {
    "domain_id": "domain_unique_14",
    "name": "« Cửu Phẩm Kim Liên Thánh Vực »",
    "element": "Thánh Vực",
    "rarity": "Tối Thượng",
    "rarity_key": "mythic",
    "is_unique": true,
    "base_energy": 7,
    "enemy_active_debuff_pierce": 0.6,
    "enemy_buff_suppression": 0.05,
    "buffs": {
      "trueDmgResistPct": 0.32,
      "critResistPct": 0.36
    },
    "debuffs": {
      "critTakenBonusPct": 0.28,
      "defReductionPct": 0.24
    },
    "buff_desc": "Giảm 32% ST Chuẩn & 36% ST Bạo Kích. + Áp Chế 5% Buff Vực địch.",
    "debuff_desc": "Địch nhận +28% ST Bạo Kích & Giảm 24% DEF (Xuyên Kháng Vực 60%).",
    "is_domain": true,
    "category": "domain",
    "dao_ap": {
      "durationTurns": 3,
      "scaleFactor": 1.28,
      "label": "Đạo Áp • Cửu Phẩm Kim Liên Thánh Vực"
    },
    "file": "domains/domain_unique_14.webp"
  },
  {
    "domain_id": "domain_unique_15",
    "name": "« Thái Cổ Thiên Đế Tịnh Vực »",
    "element": "Thánh Vực",
    "rarity": "Tối Thượng",
    "rarity_key": "mythic",
    "is_unique": true,
    "base_energy": 7,
    "enemy_active_debuff_pierce": 0.6,
    "enemy_buff_suppression": 0.05,
    "buffs": {
      "cleansePerTurn": 1,
      "controlResistPct": 0.42
    },
    "debuffs": {
      "healReductionPct": 0.34,
      "shieldDecayPct": 0.22
    },
    "buff_desc": "Thanh tẩy 1 debuff/hiệp & +42% Kháng Khống Chế. + Áp Chế 5% Buff Vực địch.",
    "debuff_desc": "Giảm 34% Hồi Máu & Bào Mòn 22% Khiên/hiệp (Xuyên Kháng Vực 60%).",
    "is_domain": true,
    "category": "domain",
    "dao_ap": {
      "durationTurns": 3,
      "scaleFactor": 1.28,
      "label": "Đạo Áp • Thái Cổ Thiên Đế Tịnh Vực"
    },
    "file": "domains/domain_unique_15.webp"
  },
  {
    "domain_id": "domain_mythic_11",
    "name": "« Bạch Đế Lăng Tiêu Kiếm Vực »",
    "element": "Kiếm Vực",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "base_energy": 6,
    "enemy_active_debuff_pierce": 0.56,
    "enemy_buff_suppression": 0,
    "buffs": {
      "defPiercePct": 0.34,
      "shieldPiercePct": 0.32
    },
    "debuffs": {
      "defReductionPct": 0.32,
      "shieldDecayPct": 0.22
    },
    "buff_desc": "+34% Xuyên DEF & +32% Xuyên Khiên.",
    "debuff_desc": "Giảm 32% DEF & Bào Mòn 22% Khiên/hiệp (Xuyên Kháng Vực 56%).",
    "is_domain": true,
    "category": "domain",
    "dao_ap": {
      "durationTurns": 2,
      "scaleFactor": 1.24,
      "label": "Đạo Áp • Bạch Đế Lăng Tiêu Kiếm Vực"
    },
    "file": "domains/domain_mythic_11.webp"
  },
  {
    "domain_id": "domain_mythic_12",
    "name": "« Hàn Sương Tuyết Kiếm Vực »",
    "element": "Kiếm Vực",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "base_energy": 6,
    "enemy_active_debuff_pierce": 0.56,
    "enemy_buff_suppression": 0,
    "buffs": {
      "defPiercePct": 0.32,
      "haxDamageBonusPct": 0.24
    },
    "debuffs": {
      "defReductionPct": 0.3,
      "critTakenBonusPct": 0.24
    },
    "buff_desc": "+32% Xuyên DEF & +24% uy lực HAX.",
    "debuff_desc": "Giảm 30% DEF & +24% ST Bạo Kích nhận (Xuyên Kháng Vực 56%).",
    "is_domain": true,
    "category": "domain",
    "dao_ap": {
      "durationTurns": 2,
      "scaleFactor": 1.24,
      "label": "Đạo Áp • Hàn Sương Tuyết Kiếm Vực"
    },
    "file": "domains/domain_mythic_12.webp"
  },
  {
    "domain_id": "domain_mythic_13",
    "name": "« Tử Lôi Kiếm Ngục Thần Vực »",
    "element": "Kiếm Vực",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "base_energy": 6,
    "enemy_active_debuff_pierce": 0.56,
    "enemy_buff_suppression": 0,
    "buffs": {
      "defPiercePct": 0.34,
      "shieldPiercePct": 0.32
    },
    "debuffs": {
      "defReductionPct": 0.32,
      "shieldDecayPct": 0.22
    },
    "buff_desc": "+34% Xuyên DEF & +32% Xuyên Khiên.",
    "debuff_desc": "Giảm 32% DEF & Bào Mòn 22% Khiên/hiệp (Xuyên Kháng Vực 56%).",
    "is_domain": true,
    "category": "domain",
    "dao_ap": {
      "durationTurns": 2,
      "scaleFactor": 1.24,
      "label": "Đạo Áp • Tử Lôi Kiếm Ngục Thần Vực"
    },
    "file": "domains/domain_mythic_13.webp"
  },
  {
    "domain_id": "domain_mythic_14",
    "name": "« Xích Viêm Phần Kiếm Vực »",
    "element": "Kiếm Vực",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "base_energy": 6,
    "enemy_active_debuff_pierce": 0.56,
    "enemy_buff_suppression": 0,
    "buffs": {
      "defPiercePct": 0.32,
      "haxDamageBonusPct": 0.24
    },
    "debuffs": {
      "defReductionPct": 0.3,
      "critTakenBonusPct": 0.24
    },
    "buff_desc": "+32% Xuyên DEF & +24% uy lực HAX.",
    "debuff_desc": "Giảm 30% DEF & +24% ST Bạo Kích nhận (Xuyên Kháng Vực 56%).",
    "is_domain": true,
    "category": "domain",
    "dao_ap": {
      "durationTurns": 2,
      "scaleFactor": 1.24,
      "label": "Đạo Áp • Xích Viêm Phần Kiếm Vực"
    },
    "file": "domains/domain_mythic_14.webp"
  },
  {
    "domain_id": "domain_mythic_15",
    "name": "« Thanh Phong Vô Ảnh Kiếm Vực »",
    "element": "Kiếm Vực",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "base_energy": 6,
    "enemy_active_debuff_pierce": 0.56,
    "enemy_buff_suppression": 0,
    "buffs": {
      "defPiercePct": 0.34,
      "shieldPiercePct": 0.32
    },
    "debuffs": {
      "defReductionPct": 0.32,
      "shieldDecayPct": 0.22
    },
    "buff_desc": "+34% Xuyên DEF & +32% Xuyên Khiên.",
    "debuff_desc": "Giảm 32% DEF & Bào Mòn 22% Khiên/hiệp (Xuyên Kháng Vực 56%).",
    "is_domain": true,
    "category": "domain",
    "dao_ap": {
      "durationTurns": 2,
      "scaleFactor": 1.24,
      "label": "Đạo Áp • Thanh Phong Vô Ảnh Kiếm Vực"
    },
    "file": "domains/domain_mythic_15.webp"
  },
  {
    "domain_id": "domain_mythic_16",
    "name": "« Nguyệt Ảnh Đào Hoa Huyễn Vực »",
    "element": "Huyễn Vực",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "base_energy": 6,
    "enemy_active_debuff_pierce": 0.56,
    "enemy_buff_suppression": 0,
    "buffs": {
      "haxProcBonusPct": 0.24,
      "reflectResistPct": 0.44
    },
    "debuffs": {
      "accuracyDownPct": 0.24,
      "enemyShieldCapReductionPct": 0.3
    },
    "buff_desc": "+24% xác suất HAX & giảm 44% Phản Đòn.",
    "debuff_desc": "Giảm 24% Chính Xác & Giảm 30% Khiên Tạo Mới (Xuyên Kháng Vực 56%).",
    "is_domain": true,
    "category": "domain",
    "dao_ap": {
      "durationTurns": 2,
      "scaleFactor": 1.24,
      "label": "Đạo Áp • Nguyệt Ảnh Đào Hoa Huyễn Vực"
    },
    "file": "domains/domain_mythic_16.webp"
  },
  {
    "domain_id": "domain_mythic_17",
    "name": "« Lưu Ly Kính Giới Huyễn Vực »",
    "element": "Huyễn Vực",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "base_energy": 6,
    "enemy_active_debuff_pierce": 0.56,
    "enemy_buff_suppression": 0,
    "buffs": {
      "haxProcBonusPct": 0.26,
      "dodgeBonusPct": 0.16
    },
    "debuffs": {
      "accuracyDownPct": 0.26,
      "haxFailPct": 0.2
    },
    "buff_desc": "+26% xác suất HAX & +16% Né Tránh.",
    "debuff_desc": "Giảm 26% Chính Xác & Giảm 20% Tỉ Lệ HAX (Xuyên Kháng Vực 56%).",
    "is_domain": true,
    "category": "domain",
    "dao_ap": {
      "durationTurns": 2,
      "scaleFactor": 1.24,
      "label": "Đạo Áp • Lưu Ly Kính Giới Huyễn Vực"
    },
    "file": "domains/domain_mythic_17.webp"
  },
  {
    "domain_id": "domain_mythic_18",
    "name": "« Tinh Vân Mê Tung Huyễn Vực »",
    "element": "Huyễn Vực",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "base_energy": 6,
    "enemy_active_debuff_pierce": 0.56,
    "enemy_buff_suppression": 0,
    "buffs": {
      "haxProcBonusPct": 0.24,
      "reflectResistPct": 0.44
    },
    "debuffs": {
      "accuracyDownPct": 0.24,
      "enemyShieldCapReductionPct": 0.3
    },
    "buff_desc": "+24% xác suất HAX & giảm 44% Phản Đòn.",
    "debuff_desc": "Giảm 24% Chính Xác & Giảm 30% Khiên Tạo Mới (Xuyên Kháng Vực 56%).",
    "is_domain": true,
    "category": "domain",
    "dao_ap": {
      "durationTurns": 2,
      "scaleFactor": 1.24,
      "label": "Đạo Áp • Tinh Vân Mê Tung Huyễn Vực"
    },
    "file": "domains/domain_mythic_18.webp"
  },
  {
    "domain_id": "domain_mythic_19",
    "name": "« Hải Thị Bích Ba Huyễn Vực »",
    "element": "Huyễn Vực",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "base_energy": 6,
    "enemy_active_debuff_pierce": 0.56,
    "enemy_buff_suppression": 0,
    "buffs": {
      "haxProcBonusPct": 0.26,
      "dodgeBonusPct": 0.16
    },
    "debuffs": {
      "accuracyDownPct": 0.26,
      "haxFailPct": 0.2
    },
    "buff_desc": "+26% xác suất HAX & +16% Né Tránh.",
    "debuff_desc": "Giảm 26% Chính Xác & Giảm 20% Tỉ Lệ HAX (Xuyên Kháng Vực 56%).",
    "is_domain": true,
    "category": "domain",
    "dao_ap": {
      "durationTurns": 2,
      "scaleFactor": 1.24,
      "label": "Đạo Áp • Hải Thị Bích Ba Huyễn Vực"
    },
    "file": "domains/domain_mythic_19.webp"
  },
  {
    "domain_id": "domain_mythic_20",
    "name": "« Huyễn Hồ Thiên Mộng Vực »",
    "element": "Huyễn Vực",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "base_energy": 6,
    "enemy_active_debuff_pierce": 0.56,
    "enemy_buff_suppression": 0,
    "buffs": {
      "haxProcBonusPct": 0.24,
      "reflectResistPct": 0.44
    },
    "debuffs": {
      "accuracyDownPct": 0.24,
      "enemyShieldCapReductionPct": 0.3
    },
    "buff_desc": "+24% xác suất HAX & giảm 44% Phản Đòn.",
    "debuff_desc": "Giảm 24% Chính Xác & Giảm 30% Khiên Tạo Mới (Xuyên Kháng Vực 56%).",
    "is_domain": true,
    "category": "domain",
    "dao_ap": {
      "durationTurns": 2,
      "scaleFactor": 1.24,
      "label": "Đạo Áp • Huyễn Hồ Thiên Mộng Vực"
    },
    "file": "domains/domain_mythic_20.webp"
  },
  {
    "domain_id": "domain_mythic_21",
    "name": "« Cửu Cung Tinh Tượng Thần Trận »",
    "element": "Trận Vực",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "base_energy": 6,
    "enemy_active_debuff_pierce": 0.56,
    "enemy_buff_suppression": 0,
    "buffs": {
      "shieldStrengthBonusPct": 0.34,
      "controlResistPct": 0.36
    },
    "debuffs": {
      "healReductionPct": 0.36,
      "defReductionPct": 0.22
    },
    "buff_desc": "+34% Độ Dày Khiên & +36% Kháng Khống Chế.",
    "debuff_desc": "Giảm 36% Hồi Máu & Giảm 22% DEF (Xuyên Kháng Vực 56%).",
    "is_domain": true,
    "category": "domain",
    "dao_ap": {
      "durationTurns": 2,
      "scaleFactor": 1.24,
      "label": "Đạo Áp • Cửu Cung Tinh Tượng Thần Trận"
    },
    "file": "domains/domain_mythic_21.webp"
  },
  {
    "domain_id": "domain_mythic_22",
    "name": "« Ngũ Hành Quy Nguyên Đại Trận »",
    "element": "Trận Vực",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "base_energy": 6,
    "enemy_active_debuff_pierce": 0.56,
    "enemy_buff_suppression": 0,
    "buffs": {
      "trueDmgResistPct": 0.3,
      "shieldStrengthBonusPct": 0.3
    },
    "debuffs": {
      "enemyShieldCapReductionPct": 0.34,
      "haxFailPct": 0.18
    },
    "buff_desc": "Giảm 30% ST Chuẩn & +30% Độ Dày Khiên.",
    "debuff_desc": "Giảm 34% Khiên Tạo Mới & Giảm 18% Tỉ Lệ HAX (Xuyên Kháng Vực 56%).",
    "is_domain": true,
    "category": "domain",
    "dao_ap": {
      "durationTurns": 2,
      "scaleFactor": 1.24,
      "label": "Đạo Áp • Ngũ Hành Quy Nguyên Đại Trận"
    },
    "file": "domains/domain_mythic_22.webp"
  },
  {
    "domain_id": "domain_mythic_23",
    "name": "« Tứ Tượng Tỏa Thiên Thần Trận »",
    "element": "Trận Vực",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "base_energy": 6,
    "enemy_active_debuff_pierce": 0.56,
    "enemy_buff_suppression": 0,
    "buffs": {
      "shieldStrengthBonusPct": 0.34,
      "controlResistPct": 0.36
    },
    "debuffs": {
      "healReductionPct": 0.36,
      "defReductionPct": 0.22
    },
    "buff_desc": "+34% Độ Dày Khiên & +36% Kháng Khống Chế.",
    "debuff_desc": "Giảm 36% Hồi Máu & Giảm 22% DEF (Xuyên Kháng Vực 56%).",
    "is_domain": true,
    "category": "domain",
    "dao_ap": {
      "durationTurns": 2,
      "scaleFactor": 1.24,
      "label": "Đạo Áp • Tứ Tượng Tỏa Thiên Thần Trận"
    },
    "file": "domains/domain_mythic_23.webp"
  },
  {
    "domain_id": "domain_mythic_24",
    "name": "« Hà Đồ Lạc Thư Đạo Trận »",
    "element": "Trận Vực",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "base_energy": 6,
    "enemy_active_debuff_pierce": 0.56,
    "enemy_buff_suppression": 0,
    "buffs": {
      "trueDmgResistPct": 0.3,
      "shieldStrengthBonusPct": 0.3
    },
    "debuffs": {
      "enemyShieldCapReductionPct": 0.34,
      "haxFailPct": 0.18
    },
    "buff_desc": "Giảm 30% ST Chuẩn & +30% Độ Dày Khiên.",
    "debuff_desc": "Giảm 34% Khiên Tạo Mới & Giảm 18% Tỉ Lệ HAX (Xuyên Kháng Vực 56%).",
    "is_domain": true,
    "category": "domain",
    "dao_ap": {
      "durationTurns": 2,
      "scaleFactor": 1.24,
      "label": "Đạo Áp • Hà Đồ Lạc Thư Đạo Trận"
    },
    "file": "domains/domain_mythic_24.webp"
  },
  {
    "domain_id": "domain_mythic_25",
    "name": "« Lôi Hỏa Bát Quái Thần Trận »",
    "element": "Trận Vực",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "base_energy": 6,
    "enemy_active_debuff_pierce": 0.56,
    "enemy_buff_suppression": 0,
    "buffs": {
      "shieldStrengthBonusPct": 0.34,
      "controlResistPct": 0.36
    },
    "debuffs": {
      "healReductionPct": 0.36,
      "defReductionPct": 0.22
    },
    "buff_desc": "+34% Độ Dày Khiên & +36% Kháng Khống Chế.",
    "debuff_desc": "Giảm 36% Hồi Máu & Giảm 22% DEF (Xuyên Kháng Vực 56%).",
    "is_domain": true,
    "category": "domain",
    "dao_ap": {
      "durationTurns": 2,
      "scaleFactor": 1.24,
      "label": "Đạo Áp • Lôi Hỏa Bát Quái Thần Trận"
    },
    "file": "domains/domain_mythic_25.webp"
  },
  {
    "domain_id": "domain_mythic_26",
    "name": "« U Minh Quỷ Hỏa Thần Vực »",
    "element": "Minh Vực",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "base_energy": 6,
    "enemy_active_debuff_pierce": 0.56,
    "enemy_buff_suppression": 0,
    "buffs": {
      "lifestealPct": 0.2,
      "shieldPiercePct": 0.32
    },
    "debuffs": {
      "maxHpCutPct": 0.14,
      "dotMaxHpPct": 0.07
    },
    "buff_desc": "+20% Hút Máu & +32% Xuyên Khiên.",
    "debuff_desc": "Cắt 14% Trần HP Tối Đa & rút 7% HP/hiệp (Xuyên Kháng Vực 56%).",
    "is_domain": true,
    "category": "domain",
    "dao_ap": {
      "durationTurns": 2,
      "scaleFactor": 1.24,
      "label": "Đạo Áp • U Minh Quỷ Hỏa Thần Vực"
    },
    "file": "domains/domain_mythic_26.webp"
  },
  {
    "domain_id": "domain_mythic_27",
    "name": "« Huyết Nguyệt Tu La Minh Vực »",
    "element": "Minh Vực",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "base_energy": 6,
    "enemy_active_debuff_pierce": 0.56,
    "enemy_buff_suppression": 0,
    "buffs": {
      "lifestealPct": 0.22,
      "haxDamageBonusPct": 0.2
    },
    "debuffs": {
      "dotMaxHpPct": 0.09,
      "healReductionPct": 0.35
    },
    "buff_desc": "+22% Hút Máu & +20% uy lực HAX.",
    "debuff_desc": "Rút 9% HP tối đa/hiệp & Giảm 35% Hồi Máu (Xuyên Kháng Vực 56%).",
    "is_domain": true,
    "category": "domain",
    "dao_ap": {
      "durationTurns": 2,
      "scaleFactor": 1.24,
      "label": "Đạo Áp • Huyết Nguyệt Tu La Minh Vực"
    },
    "file": "domains/domain_mythic_27.webp"
  },
  {
    "domain_id": "domain_mythic_28",
    "name": "« Băng Uyên U Tuyền Minh Vực »",
    "element": "Minh Vực",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "base_energy": 6,
    "enemy_active_debuff_pierce": 0.56,
    "enemy_buff_suppression": 0,
    "buffs": {
      "lifestealPct": 0.2,
      "shieldPiercePct": 0.32
    },
    "debuffs": {
      "maxHpCutPct": 0.14,
      "dotMaxHpPct": 0.07
    },
    "buff_desc": "+20% Hút Máu & +32% Xuyên Khiên.",
    "debuff_desc": "Cắt 14% Trần HP Tối Đa & rút 7% HP/hiệp (Xuyên Kháng Vực 56%).",
    "is_domain": true,
    "category": "domain",
    "dao_ap": {
      "durationTurns": 2,
      "scaleFactor": 1.24,
      "label": "Đạo Áp • Băng Uyên U Tuyền Minh Vực"
    },
    "file": "domains/domain_mythic_28.webp"
  },
  {
    "domain_id": "domain_mythic_29",
    "name": "« Vạn Hồn Khấp Huyết Minh Vực »",
    "element": "Minh Vực",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "base_energy": 6,
    "enemy_active_debuff_pierce": 0.56,
    "enemy_buff_suppression": 0,
    "buffs": {
      "lifestealPct": 0.22,
      "haxDamageBonusPct": 0.2
    },
    "debuffs": {
      "dotMaxHpPct": 0.09,
      "healReductionPct": 0.35
    },
    "buff_desc": "+22% Hút Máu & +20% uy lực HAX.",
    "debuff_desc": "Rút 9% HP tối đa/hiệp & Giảm 35% Hồi Máu (Xuyên Kháng Vực 56%).",
    "is_domain": true,
    "category": "domain",
    "dao_ap": {
      "durationTurns": 2,
      "scaleFactor": 1.24,
      "label": "Đạo Áp • Vạn Hồn Khấp Huyết Minh Vực"
    },
    "file": "domains/domain_mythic_29.webp"
  },
  {
    "domain_id": "domain_mythic_30",
    "name": "« Dạ Tuyền Phệ Nguyệt Minh Vực »",
    "element": "Minh Vực",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "base_energy": 6,
    "enemy_active_debuff_pierce": 0.56,
    "enemy_buff_suppression": 0,
    "buffs": {
      "lifestealPct": 0.2,
      "shieldPiercePct": 0.32
    },
    "debuffs": {
      "maxHpCutPct": 0.14,
      "dotMaxHpPct": 0.07
    },
    "buff_desc": "+20% Hút Máu & +32% Xuyên Khiên.",
    "debuff_desc": "Cắt 14% Trần HP Tối Đa & rút 7% HP/hiệp (Xuyên Kháng Vực 56%).",
    "is_domain": true,
    "category": "domain",
    "dao_ap": {
      "durationTurns": 2,
      "scaleFactor": 1.24,
      "label": "Đạo Áp • Dạ Tuyền Phệ Nguyệt Minh Vực"
    },
    "file": "domains/domain_mythic_30.webp"
  },
  {
    "domain_id": "domain_mythic_31",
    "name": "« Lưu Ly Tịnh Thế Thánh Vực »",
    "element": "Thánh Vực",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "base_energy": 6,
    "enemy_active_debuff_pierce": 0.56,
    "enemy_buff_suppression": 0,
    "buffs": {
      "trueDmgResistPct": 0.32,
      "critResistPct": 0.36
    },
    "debuffs": {
      "critTakenBonusPct": 0.28,
      "defReductionPct": 0.24
    },
    "buff_desc": "Giảm 32% ST Chuẩn & 36% ST Bạo Kích.",
    "debuff_desc": "Địch nhận +28% ST Bạo Kích & Giảm 24% DEF (Xuyên Kháng Vực 56%).",
    "is_domain": true,
    "category": "domain",
    "dao_ap": {
      "durationTurns": 2,
      "scaleFactor": 1.24,
      "label": "Đạo Áp • Lưu Ly Tịnh Thế Thánh Vực"
    },
    "file": "domains/domain_mythic_31.webp"
  },
  {
    "domain_id": "domain_mythic_32",
    "name": "« Phượng Hoàng Thánh Quang Vực »",
    "element": "Thánh Vực",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "base_energy": 6,
    "enemy_active_debuff_pierce": 0.56,
    "enemy_buff_suppression": 0,
    "buffs": {
      "cleansePerTurn": 1,
      "controlResistPct": 0.42
    },
    "debuffs": {
      "healReductionPct": 0.34,
      "shieldDecayPct": 0.22
    },
    "buff_desc": "Thanh tẩy 1 debuff/hiệp & +42% Kháng Khống Chế.",
    "debuff_desc": "Giảm 34% Hồi Máu & Bào Mòn 22% Khiên/hiệp (Xuyên Kháng Vực 56%).",
    "is_domain": true,
    "category": "domain",
    "dao_ap": {
      "durationTurns": 2,
      "scaleFactor": 1.24,
      "label": "Đạo Áp • Phượng Hoàng Thánh Quang Vực"
    },
    "file": "domains/domain_mythic_32.webp"
  },
  {
    "domain_id": "domain_mythic_33",
    "name": "« Bạch Ngọc Dao Trì Tiên Vực »",
    "element": "Thánh Vực",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "base_energy": 6,
    "enemy_active_debuff_pierce": 0.56,
    "enemy_buff_suppression": 0,
    "buffs": {
      "trueDmgResistPct": 0.32,
      "critResistPct": 0.36
    },
    "debuffs": {
      "critTakenBonusPct": 0.28,
      "defReductionPct": 0.24
    },
    "buff_desc": "Giảm 32% ST Chuẩn & 36% ST Bạo Kích.",
    "debuff_desc": "Địch nhận +28% ST Bạo Kích & Giảm 24% DEF (Xuyên Kháng Vực 56%).",
    "is_domain": true,
    "category": "domain",
    "dao_ap": {
      "durationTurns": 2,
      "scaleFactor": 1.24,
      "label": "Đạo Áp • Bạch Ngọc Dao Trì Tiên Vực"
    },
    "file": "domains/domain_mythic_33.webp"
  },
  {
    "domain_id": "domain_mythic_34",
    "name": "« Thái Dương Thánh Điện Vực »",
    "element": "Thánh Vực",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "base_energy": 6,
    "enemy_active_debuff_pierce": 0.56,
    "enemy_buff_suppression": 0,
    "buffs": {
      "cleansePerTurn": 1,
      "controlResistPct": 0.42
    },
    "debuffs": {
      "healReductionPct": 0.34,
      "shieldDecayPct": 0.22
    },
    "buff_desc": "Thanh tẩy 1 debuff/hiệp & +42% Kháng Khống Chế.",
    "debuff_desc": "Giảm 34% Hồi Máu & Bào Mòn 22% Khiên/hiệp (Xuyên Kháng Vực 56%).",
    "is_domain": true,
    "category": "domain",
    "dao_ap": {
      "durationTurns": 2,
      "scaleFactor": 1.24,
      "label": "Đạo Áp • Thái Dương Thánh Điện Vực"
    },
    "file": "domains/domain_mythic_34.webp"
  },
  {
    "domain_id": "domain_mythic_35",
    "name": "« Thiên Âm Thánh Vũ Tịnh Vực »",
    "element": "Thánh Vực",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "base_energy": 6,
    "enemy_active_debuff_pierce": 0.56,
    "enemy_buff_suppression": 0,
    "buffs": {
      "trueDmgResistPct": 0.32,
      "critResistPct": 0.36
    },
    "debuffs": {
      "critTakenBonusPct": 0.28,
      "defReductionPct": 0.24
    },
    "buff_desc": "Giảm 32% ST Chuẩn & 36% ST Bạo Kích.",
    "debuff_desc": "Địch nhận +28% ST Bạo Kích & Giảm 24% DEF (Xuyên Kháng Vực 56%).",
    "is_domain": true,
    "category": "domain",
    "dao_ap": {
      "durationTurns": 2,
      "scaleFactor": 1.24,
      "label": "Đạo Áp • Thiên Âm Thánh Vũ Tịnh Vực"
    },
    "file": "domains/domain_mythic_35.webp"
  }
];

export const V17_DIVINE_SENSES = [
  {
    "sense_id": "sense_unique_3",
    "name": "« Thái Sơ Thiên Nhãn Thần Thức »",
    "rarity": "Tối Thượng",
    "rarity_key": "mythic",
    "is_unique": true,
    "bonus_energy": 5,
    "buff_boost_pct": 0.19,
    "clash_resist_chance": 0.68,
    "extra_enemy_drain": 0,
    "desc": "+5 Linh Mạch tối đa, +19% Cường Hóa Buff Vực & 68% Kháng Trừ Linh Mạch Khắc Vực.",
    "is_sense": true,
    "category": "sense",
    "file": "domains/sense_unique_3.webp"
  },
  {
    "sense_id": "sense_unique_4",
    "name": "« Hồng Mông Đạo Tâm Thần Thức »",
    "rarity": "Tối Thượng",
    "rarity_key": "mythic",
    "is_unique": true,
    "bonus_energy": 6,
    "buff_boost_pct": 0.19,
    "clash_resist_chance": 0.68,
    "extra_enemy_drain": 0,
    "desc": "+6 Linh Mạch tối đa, +19% Cường Hóa Buff Vực & 68% Kháng Trừ Linh Mạch Khắc Vực.",
    "is_sense": true,
    "category": "sense",
    "file": "domains/sense_unique_4.webp"
  },
  {
    "sense_id": "sense_unique_5",
    "name": "« Tinh Không Toàn Tri Thần Thức »",
    "rarity": "Tối Thượng",
    "rarity_key": "mythic",
    "is_unique": true,
    "bonus_energy": 5,
    "buff_boost_pct": 0.19,
    "clash_resist_chance": 0.68,
    "extra_enemy_drain": 0,
    "desc": "+5 Linh Mạch tối đa, +19% Cường Hóa Buff Vực & 68% Kháng Trừ Linh Mạch Khắc Vực.",
    "is_sense": true,
    "category": "sense",
    "file": "domains/sense_unique_5.webp"
  },
  {
    "sense_id": "sense_unique_6",
    "name": "« Cửu Chuyển Chân Hồn Thần Thức »",
    "rarity": "Tối Thượng",
    "rarity_key": "mythic",
    "is_unique": true,
    "bonus_energy": 6,
    "buff_boost_pct": 0.19,
    "clash_resist_chance": 0.68,
    "extra_enemy_drain": 0,
    "desc": "+6 Linh Mạch tối đa, +19% Cường Hóa Buff Vực & 68% Kháng Trừ Linh Mạch Khắc Vực.",
    "is_sense": true,
    "category": "sense",
    "file": "domains/sense_unique_6.webp"
  },
  {
    "sense_id": "sense_unique_7",
    "name": "« Vĩnh Hằng Tịnh Giác Thần Thức »",
    "rarity": "Tối Thượng",
    "rarity_key": "mythic",
    "is_unique": true,
    "bonus_energy": 5,
    "buff_boost_pct": 0.19,
    "clash_resist_chance": 0.68,
    "extra_enemy_drain": 0,
    "desc": "+5 Linh Mạch tối đa, +19% Cường Hóa Buff Vực & 68% Kháng Trừ Linh Mạch Khắc Vực.",
    "is_sense": true,
    "category": "sense",
    "file": "domains/sense_unique_7.webp"
  },
  {
    "sense_id": "sense_mythic_5",
    "name": "« Kiếm Tâm Thông Minh Thức »",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "bonus_energy": 4,
    "buff_boost_pct": 0.17,
    "clash_resist_chance": 0.48,
    "extra_enemy_drain": 0,
    "desc": "+4 Linh Mạch tối đa, +17% Cường Hóa Buff Vực & 48% Kháng Trừ Linh Mạch Khắc Vực.",
    "is_sense": true,
    "category": "sense",
    "file": "domains/sense_mythic_5.webp"
  },
  {
    "sense_id": "sense_mythic_6",
    "name": "« Phượng Minh Thần Giác Thức »",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "bonus_energy": 4,
    "buff_boost_pct": 0.16,
    "clash_resist_chance": 0.48,
    "extra_enemy_drain": 0,
    "desc": "+4 Linh Mạch tối đa, +16% Cường Hóa Buff Vực & 48% Kháng Trừ Linh Mạch Khắc Vực.",
    "is_sense": true,
    "category": "sense",
    "file": "domains/sense_mythic_6.webp"
  },
  {
    "sense_id": "sense_mythic_7",
    "name": "« Băng Tâm Minh Kính Thức »",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "bonus_energy": 4,
    "buff_boost_pct": 0.17,
    "clash_resist_chance": 0.48,
    "extra_enemy_drain": 0,
    "desc": "+4 Linh Mạch tối đa, +17% Cường Hóa Buff Vực & 48% Kháng Trừ Linh Mạch Khắc Vực.",
    "is_sense": true,
    "category": "sense",
    "file": "domains/sense_mythic_7.webp"
  },
  {
    "sense_id": "sense_mythic_8",
    "name": "« Tử Tiêu Lôi Nhãn Thức »",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "bonus_energy": 4,
    "buff_boost_pct": 0.16,
    "clash_resist_chance": 0.48,
    "extra_enemy_drain": 0,
    "desc": "+4 Linh Mạch tối đa, +16% Cường Hóa Buff Vực & 48% Kháng Trừ Linh Mạch Khắc Vực.",
    "is_sense": true,
    "category": "sense",
    "file": "domains/sense_mythic_8.webp"
  },
  {
    "sense_id": "sense_mythic_9",
    "name": "« Thanh Liên Tịnh Thức »",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "bonus_energy": 4,
    "buff_boost_pct": 0.17,
    "clash_resist_chance": 0.48,
    "extra_enemy_drain": 0,
    "desc": "+4 Linh Mạch tối đa, +17% Cường Hóa Buff Vực & 48% Kháng Trừ Linh Mạch Khắc Vực.",
    "is_sense": true,
    "category": "sense",
    "file": "domains/sense_mythic_9.webp"
  },
  {
    "sense_id": "sense_mythic_10",
    "name": "« Hậu Thổ Định Tâm Thức »",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "bonus_energy": 4,
    "buff_boost_pct": 0.16,
    "clash_resist_chance": 0.48,
    "extra_enemy_drain": 0,
    "desc": "+4 Linh Mạch tối đa, +16% Cường Hóa Buff Vực & 48% Kháng Trừ Linh Mạch Khắc Vực.",
    "is_sense": true,
    "category": "sense",
    "file": "domains/sense_mythic_10.webp"
  },
  {
    "sense_id": "sense_mythic_11",
    "name": "« Đại Nhật Huệ Nhãn Thức »",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "bonus_energy": 4,
    "buff_boost_pct": 0.17,
    "clash_resist_chance": 0.48,
    "extra_enemy_drain": 0,
    "desc": "+4 Linh Mạch tối đa, +17% Cường Hóa Buff Vực & 48% Kháng Trừ Linh Mạch Khắc Vực.",
    "is_sense": true,
    "category": "sense",
    "file": "domains/sense_mythic_11.webp"
  },
  {
    "sense_id": "sense_mythic_12",
    "name": "« U Minh Thông Linh Thức »",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "bonus_energy": 4,
    "buff_boost_pct": 0.16,
    "clash_resist_chance": 0.48,
    "extra_enemy_drain": 0,
    "desc": "+4 Linh Mạch tối đa, +16% Cường Hóa Buff Vực & 48% Kháng Trừ Linh Mạch Khắc Vực.",
    "is_sense": true,
    "category": "sense",
    "file": "domains/sense_mythic_12.webp"
  },
  {
    "sense_id": "sense_mythic_13",
    "name": "« Ngân Hà Tinh Giác Thức »",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "bonus_energy": 4,
    "buff_boost_pct": 0.17,
    "clash_resist_chance": 0.48,
    "extra_enemy_drain": 0,
    "desc": "+4 Linh Mạch tối đa, +17% Cường Hóa Buff Vực & 48% Kháng Trừ Linh Mạch Khắc Vực.",
    "is_sense": true,
    "category": "sense",
    "file": "domains/sense_mythic_13.webp"
  },
  {
    "sense_id": "sense_mythic_14",
    "name": "« Thái Cực Minh Đạo Thức »",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "bonus_energy": 4,
    "buff_boost_pct": 0.16,
    "clash_resist_chance": 0.48,
    "extra_enemy_drain": 0,
    "desc": "+4 Linh Mạch tối đa, +16% Cường Hóa Buff Vực & 48% Kháng Trừ Linh Mạch Khắc Vực.",
    "is_sense": true,
    "category": "sense",
    "file": "domains/sense_mythic_14.webp"
  },
  {
    "sense_id": "sense_mythic_15",
    "name": "« Bạch Hổ Sát Ý Thức »",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "bonus_energy": 4,
    "buff_boost_pct": 0.17,
    "clash_resist_chance": 0.48,
    "extra_enemy_drain": 0,
    "desc": "+4 Linh Mạch tối đa, +17% Cường Hóa Buff Vực & 48% Kháng Trừ Linh Mạch Khắc Vực.",
    "is_sense": true,
    "category": "sense",
    "file": "domains/sense_mythic_15.webp"
  },
  {
    "sense_id": "sense_mythic_16",
    "name": "« Chu Tước Linh Diệm Thức »",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "bonus_energy": 4,
    "buff_boost_pct": 0.16,
    "clash_resist_chance": 0.48,
    "extra_enemy_drain": 0,
    "desc": "+4 Linh Mạch tối đa, +16% Cường Hóa Buff Vực & 48% Kháng Trừ Linh Mạch Khắc Vực.",
    "is_sense": true,
    "category": "sense",
    "file": "domains/sense_mythic_16.webp"
  },
  {
    "sense_id": "sense_mythic_17",
    "name": "« Huyền Vũ Trường Lưu Thức »",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "bonus_energy": 4,
    "buff_boost_pct": 0.17,
    "clash_resist_chance": 0.48,
    "extra_enemy_drain": 0,
    "desc": "+4 Linh Mạch tối đa, +17% Cường Hóa Buff Vực & 48% Kháng Trừ Linh Mạch Khắc Vực.",
    "is_sense": true,
    "category": "sense",
    "file": "domains/sense_mythic_17.webp"
  },
  {
    "sense_id": "sense_mythic_18",
    "name": "« Thanh Long Ngộ Đạo Thức »",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "bonus_energy": 4,
    "buff_boost_pct": 0.16,
    "clash_resist_chance": 0.48,
    "extra_enemy_drain": 0,
    "desc": "+4 Linh Mạch tối đa, +16% Cường Hóa Buff Vực & 48% Kháng Trừ Linh Mạch Khắc Vực.",
    "is_sense": true,
    "category": "sense",
    "file": "domains/sense_mythic_18.webp"
  },
  {
    "sense_id": "sense_mythic_19",
    "name": "« Kỳ Lân Thụy Quang Thức »",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "bonus_energy": 4,
    "buff_boost_pct": 0.17,
    "clash_resist_chance": 0.48,
    "extra_enemy_drain": 0,
    "desc": "+4 Linh Mạch tối đa, +17% Cường Hóa Buff Vực & 48% Kháng Trừ Linh Mạch Khắc Vực.",
    "is_sense": true,
    "category": "sense",
    "file": "domains/sense_mythic_19.webp"
  },
  {
    "sense_id": "sense_mythic_20",
    "name": "« Nguyệt Hoa Linh Mâu Thức »",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "bonus_energy": 4,
    "buff_boost_pct": 0.16,
    "clash_resist_chance": 0.48,
    "extra_enemy_drain": 0,
    "desc": "+4 Linh Mạch tối đa, +16% Cường Hóa Buff Vực & 48% Kháng Trừ Linh Mạch Khắc Vực.",
    "is_sense": true,
    "category": "sense",
    "file": "domains/sense_mythic_20.webp"
  },
  {
    "sense_id": "sense_mythic_21",
    "name": "« Thiên Cơ Toán Pháp Thức »",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "bonus_energy": 4,
    "buff_boost_pct": 0.17,
    "clash_resist_chance": 0.48,
    "extra_enemy_drain": 0,
    "desc": "+4 Linh Mạch tối đa, +17% Cường Hóa Buff Vực & 48% Kháng Trừ Linh Mạch Khắc Vực.",
    "is_sense": true,
    "category": "sense",
    "file": "domains/sense_mythic_21.webp"
  },
  {
    "sense_id": "sense_mythic_22",
    "name": "« Phá Vọng Lưu Ly Thức »",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "bonus_energy": 4,
    "buff_boost_pct": 0.16,
    "clash_resist_chance": 0.48,
    "extra_enemy_drain": 0,
    "desc": "+4 Linh Mạch tối đa, +16% Cường Hóa Buff Vực & 48% Kháng Trừ Linh Mạch Khắc Vực.",
    "is_sense": true,
    "category": "sense",
    "file": "domains/sense_mythic_22.webp"
  },
  {
    "sense_id": "sense_mythic_23",
    "name": "« Lôi Âm Tỉnh Hồn Thức »",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "bonus_energy": 4,
    "buff_boost_pct": 0.17,
    "clash_resist_chance": 0.48,
    "extra_enemy_drain": 0,
    "desc": "+4 Linh Mạch tối đa, +17% Cường Hóa Buff Vực & 48% Kháng Trừ Linh Mạch Khắc Vực.",
    "is_sense": true,
    "category": "sense",
    "file": "domains/sense_mythic_23.webp"
  },
  {
    "sense_id": "sense_mythic_24",
    "name": "« Kim Ô Chúc Chiếu Thức »",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "bonus_energy": 4,
    "buff_boost_pct": 0.16,
    "clash_resist_chance": 0.48,
    "extra_enemy_drain": 0,
    "desc": "+4 Linh Mạch tối đa, +16% Cường Hóa Buff Vực & 48% Kháng Trừ Linh Mạch Khắc Vực.",
    "is_sense": true,
    "category": "sense",
    "file": "domains/sense_mythic_24.webp"
  },
  {
    "sense_id": "sense_mythic_25",
    "name": "« Vạn Điệp Mộng Thức »",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "bonus_energy": 4,
    "buff_boost_pct": 0.17,
    "clash_resist_chance": 0.48,
    "extra_enemy_drain": 0,
    "desc": "+4 Linh Mạch tối đa, +17% Cường Hóa Buff Vực & 48% Kháng Trừ Linh Mạch Khắc Vực.",
    "is_sense": true,
    "category": "sense",
    "file": "domains/sense_mythic_25.webp"
  },
  {
    "sense_id": "sense_mythic_26",
    "name": "« Thương Khung Long Nhãn Thức »",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "bonus_energy": 4,
    "buff_boost_pct": 0.16,
    "clash_resist_chance": 0.48,
    "extra_enemy_drain": 0,
    "desc": "+4 Linh Mạch tối đa, +16% Cường Hóa Buff Vực & 48% Kháng Trừ Linh Mạch Khắc Vực.",
    "is_sense": true,
    "category": "sense",
    "file": "domains/sense_mythic_26.webp"
  },
  {
    "sense_id": "sense_mythic_27",
    "name": "« Thái Ất Nguyên Thần Thức »",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "bonus_energy": 4,
    "buff_boost_pct": 0.17,
    "clash_resist_chance": 0.48,
    "extra_enemy_drain": 0,
    "desc": "+4 Linh Mạch tối đa, +17% Cường Hóa Buff Vực & 48% Kháng Trừ Linh Mạch Khắc Vực.",
    "is_sense": true,
    "category": "sense",
    "file": "domains/sense_mythic_27.webp"
  },
  {
    "sense_id": "sense_mythic_28",
    "name": "« Bất Động Kim Cương Thức »",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "bonus_energy": 4,
    "buff_boost_pct": 0.16,
    "clash_resist_chance": 0.48,
    "extra_enemy_drain": 0,
    "desc": "+4 Linh Mạch tối đa, +16% Cường Hóa Buff Vực & 48% Kháng Trừ Linh Mạch Khắc Vực.",
    "is_sense": true,
    "category": "sense",
    "file": "domains/sense_mythic_28.webp"
  },
  {
    "sense_id": "sense_mythic_29",
    "name": "« Hư Vô Kính Tâm Thức »",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "bonus_energy": 4,
    "buff_boost_pct": 0.17,
    "clash_resist_chance": 0.48,
    "extra_enemy_drain": 0,
    "desc": "+4 Linh Mạch tối đa, +17% Cường Hóa Buff Vực & 48% Kháng Trừ Linh Mạch Khắc Vực.",
    "is_sense": true,
    "category": "sense",
    "file": "domains/sense_mythic_29.webp"
  },
  {
    "sense_id": "sense_mythic_30",
    "name": "« Huyết Nguyệt Minh Giác Thức »",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "bonus_energy": 4,
    "buff_boost_pct": 0.16,
    "clash_resist_chance": 0.48,
    "extra_enemy_drain": 0,
    "desc": "+4 Linh Mạch tối đa, +16% Cường Hóa Buff Vực & 48% Kháng Trừ Linh Mạch Khắc Vực.",
    "is_sense": true,
    "category": "sense",
    "file": "domains/sense_mythic_30.webp"
  },
  {
    "sense_id": "sense_mythic_31",
    "name": "« Cửu Tiêu Tiên Vận Thức »",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "bonus_energy": 4,
    "buff_boost_pct": 0.17,
    "clash_resist_chance": 0.48,
    "extra_enemy_drain": 0,
    "desc": "+4 Linh Mạch tối đa, +17% Cường Hóa Buff Vực & 48% Kháng Trừ Linh Mạch Khắc Vực.",
    "is_sense": true,
    "category": "sense",
    "file": "domains/sense_mythic_31.webp"
  },
  {
    "sense_id": "sense_mythic_32",
    "name": "« Vạn Pháp Quy Nhất Thức »",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "bonus_energy": 4,
    "buff_boost_pct": 0.16,
    "clash_resist_chance": 0.48,
    "extra_enemy_drain": 0,
    "desc": "+4 Linh Mạch tối đa, +16% Cường Hóa Buff Vực & 48% Kháng Trừ Linh Mạch Khắc Vực.",
    "is_sense": true,
    "category": "sense",
    "file": "domains/sense_mythic_32.webp"
  }
];

export const V17_DIVINE_REALMS = [
  {
    "realm_id": "realm_unique_3",
    "name": "« Hồng Mông Tịch Diệt Thần Cảnh »",
    "rarity": "Tối Thượng",
    "rarity_key": "mythic",
    "is_unique": true,
    "debuff_boost_pct": 0.28,
    "extra_debuffs": {
      "maxHpCutPct": 0.23,
      "shieldDecayPct": 0.22
    },
    "desc": "Tăng +28% Cường Hóa Debuff Vực, Cắt 23% Trần HP Tối Đa & Bào Mòn 22% Khiên/hiệp!",
    "is_realm": true,
    "category": "realm",
    "file": "domains/realm_unique_3.webp"
  },
  {
    "realm_id": "realm_unique_4",
    "name": "« Vĩnh Hằng Băng Phong Thần Cảnh »",
    "rarity": "Tối Thượng",
    "rarity_key": "mythic",
    "is_unique": true,
    "debuff_boost_pct": 0.28,
    "extra_debuffs": {
      "defReductionPct": 0.27,
      "healReductionPct": 0.4
    },
    "desc": "Tăng +28% Cường Hóa Debuff Vực, Giảm 27% DEF & Giảm 40% Hồi Máu địch!",
    "is_realm": true,
    "category": "realm",
    "file": "domains/realm_unique_4.webp"
  },
  {
    "realm_id": "realm_unique_5",
    "name": "« Cửu Kiếp Thiên Phạt Thần Cảnh »",
    "rarity": "Tối Thượng",
    "rarity_key": "mythic",
    "is_unique": true,
    "debuff_boost_pct": 0.28,
    "extra_debuffs": {
      "maxHpCutPct": 0.23,
      "shieldDecayPct": 0.22
    },
    "desc": "Tăng +28% Cường Hóa Debuff Vực, Cắt 23% Trần HP Tối Đa & Bào Mòn 22% Khiên/hiệp!",
    "is_realm": true,
    "category": "realm",
    "file": "domains/realm_unique_5.webp"
  },
  {
    "realm_id": "realm_unique_6",
    "name": "« Thôn Thiên Hư Vô Thần Cảnh »",
    "rarity": "Tối Thượng",
    "rarity_key": "mythic",
    "is_unique": true,
    "debuff_boost_pct": 0.28,
    "extra_debuffs": {
      "defReductionPct": 0.27,
      "healReductionPct": 0.4
    },
    "desc": "Tăng +28% Cường Hóa Debuff Vực, Giảm 27% DEF & Giảm 40% Hồi Máu địch!",
    "is_realm": true,
    "category": "realm",
    "file": "domains/realm_unique_6.webp"
  },
  {
    "realm_id": "realm_unique_7",
    "name": "« Bỉ Ngạn Đoạn Hồn Thần Cảnh »",
    "rarity": "Tối Thượng",
    "rarity_key": "mythic",
    "is_unique": true,
    "debuff_boost_pct": 0.28,
    "extra_debuffs": {
      "maxHpCutPct": 0.23,
      "shieldDecayPct": 0.22
    },
    "desc": "Tăng +28% Cường Hóa Debuff Vực, Cắt 23% Trần HP Tối Đa & Bào Mòn 22% Khiên/hiệp!",
    "is_realm": true,
    "category": "realm",
    "file": "domains/realm_unique_7.webp"
  },
  {
    "realm_id": "realm_mythic_5",
    "name": "« Kiếm Sát Phá Giáp Thần Cảnh »",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "debuff_boost_pct": 0.25,
    "extra_debuffs": {
      "healReductionPct": 0.36,
      "shieldDecayPct": 0.18
    },
    "desc": "Tăng +25% Cường Hóa Debuff Vực, Giảm 36% Hồi Máu & Bào Mòn 18% Khiên/hiệp.",
    "is_realm": true,
    "category": "realm",
    "file": "domains/realm_mythic_5.webp"
  },
  {
    "realm_id": "realm_mythic_6",
    "name": "« Phần Thiên Liệt Diệm Cảnh »",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "debuff_boost_pct": 0.25,
    "extra_debuffs": {
      "defReductionPct": 0.25,
      "critTakenBonusPct": 0.2
    },
    "desc": "Tăng +25% Cường Hóa Debuff Vực, Giảm 25% DEF & khiến địch nhận +20% ST Bạo Kích.",
    "is_realm": true,
    "category": "realm",
    "file": "domains/realm_mythic_6.webp"
  },
  {
    "realm_id": "realm_mythic_7",
    "name": "« Hàn Uyên Trì Trệ Thần Cảnh »",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "debuff_boost_pct": 0.25,
    "extra_debuffs": {
      "dotMaxHpPct": 0.08,
      "haxFailPct": 0.18
    },
    "desc": "Tăng +25% Cường Hóa Debuff Vực, Đốt 8% HP/hiệp & Giảm 18% Tỉ Lệ HAX địch.",
    "is_realm": true,
    "category": "realm",
    "file": "domains/realm_mythic_7.webp"
  },
  {
    "realm_id": "realm_mythic_8",
    "name": "« Tử Lôi Trấn Áp Thần Cảnh »",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "debuff_boost_pct": 0.25,
    "extra_debuffs": {
      "maxHpCutPct": 0.2
    },
    "desc": "Tăng +25% Cường Hóa Debuff Vực, Cắt 20% Trần HP Tối Đa của đối thủ!",
    "is_realm": true,
    "category": "realm",
    "file": "domains/realm_mythic_8.webp"
  },
  {
    "realm_id": "realm_mythic_9",
    "name": "« Vạn Độc Thực Hồn Thần Cảnh »",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "debuff_boost_pct": 0.25,
    "extra_debuffs": {
      "healReductionPct": 0.36,
      "shieldDecayPct": 0.18
    },
    "desc": "Tăng +25% Cường Hóa Debuff Vực, Giảm 36% Hồi Máu & Bào Mòn 18% Khiên/hiệp.",
    "is_realm": true,
    "category": "realm",
    "file": "domains/realm_mythic_9.webp"
  },
  {
    "realm_id": "realm_mythic_10",
    "name": "« Trọng Lực Sơn Băng Cảnh »",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "debuff_boost_pct": 0.25,
    "extra_debuffs": {
      "defReductionPct": 0.25,
      "critTakenBonusPct": 0.2
    },
    "desc": "Tăng +25% Cường Hóa Debuff Vực, Giảm 25% DEF & khiến địch nhận +20% ST Bạo Kích.",
    "is_realm": true,
    "category": "realm",
    "file": "domains/realm_mythic_10.webp"
  },
  {
    "realm_id": "realm_mythic_11",
    "name": "« Thánh Phạt Tịnh Hóa Cảnh »",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "debuff_boost_pct": 0.25,
    "extra_debuffs": {
      "dotMaxHpPct": 0.08,
      "haxFailPct": 0.18
    },
    "desc": "Tăng +25% Cường Hóa Debuff Vực, Đốt 8% HP/hiệp & Giảm 18% Tỉ Lệ HAX địch.",
    "is_realm": true,
    "category": "realm",
    "file": "domains/realm_mythic_11.webp"
  },
  {
    "realm_id": "realm_mythic_12",
    "name": "« Huyết Hải Khô Kiệt Cảnh »",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "debuff_boost_pct": 0.25,
    "extra_debuffs": {
      "maxHpCutPct": 0.2
    },
    "desc": "Tăng +25% Cường Hóa Debuff Vực, Cắt 20% Trần HP Tối Đa của đối thủ!",
    "is_realm": true,
    "category": "realm",
    "file": "domains/realm_mythic_12.webp"
  },
  {
    "realm_id": "realm_mythic_13",
    "name": "« Thứ Nguyên Phá Toái Cảnh »",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "debuff_boost_pct": 0.25,
    "extra_debuffs": {
      "healReductionPct": 0.36,
      "shieldDecayPct": 0.18
    },
    "desc": "Tăng +25% Cường Hóa Debuff Vực, Giảm 36% Hồi Máu & Bào Mòn 18% Khiên/hiệp.",
    "is_realm": true,
    "category": "realm",
    "file": "domains/realm_mythic_13.webp"
  },
  {
    "realm_id": "realm_mythic_14",
    "name": "« Phong Linh Khóa Mạch Cảnh »",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "debuff_boost_pct": 0.25,
    "extra_debuffs": {
      "defReductionPct": 0.25,
      "critTakenBonusPct": 0.2
    },
    "desc": "Tăng +25% Cường Hóa Debuff Vực, Giảm 25% DEF & khiến địch nhận +20% ST Bạo Kích.",
    "is_realm": true,
    "category": "realm",
    "file": "domains/realm_mythic_14.webp"
  },
  {
    "realm_id": "realm_mythic_15",
    "name": "« Bạch Hổ Uy Hiếp Thần Cảnh »",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "debuff_boost_pct": 0.25,
    "extra_debuffs": {
      "dotMaxHpPct": 0.08,
      "haxFailPct": 0.18
    },
    "desc": "Tăng +25% Cường Hóa Debuff Vực, Đốt 8% HP/hiệp & Giảm 18% Tỉ Lệ HAX địch.",
    "is_realm": true,
    "category": "realm",
    "file": "domains/realm_mythic_15.webp"
  },
  {
    "realm_id": "realm_mythic_16",
    "name": "« Kim Ô Chước Nhiệt Cảnh »",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "debuff_boost_pct": 0.25,
    "extra_debuffs": {
      "maxHpCutPct": 0.2
    },
    "desc": "Tăng +25% Cường Hóa Debuff Vực, Cắt 20% Trần HP Tối Đa của đối thủ!",
    "is_realm": true,
    "category": "realm",
    "file": "domains/realm_mythic_16.webp"
  },
  {
    "realm_id": "realm_mythic_17",
    "name": "« Bích Hải Trầm Luân Cảnh »",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "debuff_boost_pct": 0.25,
    "extra_debuffs": {
      "healReductionPct": 0.36,
      "shieldDecayPct": 0.18
    },
    "desc": "Tăng +25% Cường Hóa Debuff Vực, Giảm 36% Hồi Máu & Bào Mòn 18% Khiên/hiệp.",
    "is_realm": true,
    "category": "realm",
    "file": "domains/realm_mythic_17.webp"
  },
  {
    "realm_id": "realm_mythic_18",
    "name": "« Lôi Ngục Tê Liệt Cảnh »",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "debuff_boost_pct": 0.25,
    "extra_debuffs": {
      "defReductionPct": 0.25,
      "critTakenBonusPct": 0.2
    },
    "desc": "Tăng +25% Cường Hóa Debuff Vực, Giảm 25% DEF & khiến địch nhận +20% ST Bạo Kích.",
    "is_realm": true,
    "category": "realm",
    "file": "domains/realm_mythic_18.webp"
  },
  {
    "realm_id": "realm_mythic_19",
    "name": "« Cổ Đằng Triền Sát Cảnh »",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "debuff_boost_pct": 0.25,
    "extra_debuffs": {
      "dotMaxHpPct": 0.08,
      "haxFailPct": 0.18
    },
    "desc": "Tăng +25% Cường Hóa Debuff Vực, Đốt 8% HP/hiệp & Giảm 18% Tỉ Lệ HAX địch.",
    "is_realm": true,
    "category": "realm",
    "file": "domains/realm_mythic_19.webp"
  },
  {
    "realm_id": "realm_mythic_20",
    "name": "« Hoàng Sa Vùi Lấp Cảnh »",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "debuff_boost_pct": 0.25,
    "extra_debuffs": {
      "maxHpCutPct": 0.2
    },
    "desc": "Tăng +25% Cường Hóa Debuff Vực, Cắt 20% Trần HP Tối Đa của đối thủ!",
    "is_realm": true,
    "category": "realm",
    "file": "domains/realm_mythic_20.webp"
  },
  {
    "realm_id": "realm_mythic_21",
    "name": "« Phán Quyết Quang Ngục Cảnh »",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "debuff_boost_pct": 0.25,
    "extra_debuffs": {
      "healReductionPct": 0.36,
      "shieldDecayPct": 0.18
    },
    "desc": "Tăng +25% Cường Hóa Debuff Vực, Giảm 36% Hồi Máu & Bào Mòn 18% Khiên/hiệp.",
    "is_realm": true,
    "category": "realm",
    "file": "domains/realm_mythic_21.webp"
  },
  {
    "realm_id": "realm_mythic_22",
    "name": "« Dạ Mị Nhiếp Hồn Cảnh »",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "debuff_boost_pct": 0.25,
    "extra_debuffs": {
      "defReductionPct": 0.25,
      "critTakenBonusPct": 0.2
    },
    "desc": "Tăng +25% Cường Hóa Debuff Vực, Giảm 25% DEF & khiến địch nhận +20% ST Bạo Kích.",
    "is_realm": true,
    "category": "realm",
    "file": "domains/realm_mythic_22.webp"
  },
  {
    "realm_id": "realm_mythic_23",
    "name": "« Tinh Vẫn Trọng Áp Cảnh »",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "debuff_boost_pct": 0.25,
    "extra_debuffs": {
      "dotMaxHpPct": 0.08,
      "haxFailPct": 0.18
    },
    "desc": "Tăng +25% Cường Hóa Debuff Vực, Đốt 8% HP/hiệp & Giảm 18% Tỉ Lệ HAX địch.",
    "is_realm": true,
    "category": "realm",
    "file": "domains/realm_mythic_23.webp"
  },
  {
    "realm_id": "realm_mythic_24",
    "name": "« Đoạn Đạo Phá Thuẫn Cảnh »",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "debuff_boost_pct": 0.25,
    "extra_debuffs": {
      "maxHpCutPct": 0.2
    },
    "desc": "Tăng +25% Cường Hóa Debuff Vực, Cắt 20% Trần HP Tối Đa của đối thủ!",
    "is_realm": true,
    "category": "realm",
    "file": "domains/realm_mythic_24.webp"
  },
  {
    "realm_id": "realm_mythic_25",
    "name": "« Hồng Liên Nghiệp Hỏa Cảnh »",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "debuff_boost_pct": 0.25,
    "extra_debuffs": {
      "healReductionPct": 0.36,
      "shieldDecayPct": 0.18
    },
    "desc": "Tăng +25% Cường Hóa Debuff Vực, Giảm 36% Hồi Máu & Bào Mòn 18% Khiên/hiệp.",
    "is_realm": true,
    "category": "realm",
    "file": "domains/realm_mythic_25.webp"
  },
  {
    "realm_id": "realm_mythic_26",
    "name": "« Tuyết Bão Phong Thiên Cảnh »",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "debuff_boost_pct": 0.25,
    "extra_debuffs": {
      "defReductionPct": 0.25,
      "critTakenBonusPct": 0.2
    },
    "desc": "Tăng +25% Cường Hóa Debuff Vực, Giảm 25% DEF & khiến địch nhận +20% ST Bạo Kích.",
    "is_realm": true,
    "category": "realm",
    "file": "domains/realm_mythic_26.webp"
  },
  {
    "realm_id": "realm_mythic_27",
    "name": "« Cửu U Trớ Chú Thần Cảnh »",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "debuff_boost_pct": 0.25,
    "extra_debuffs": {
      "dotMaxHpPct": 0.08,
      "haxFailPct": 0.18
    },
    "desc": "Tăng +25% Cường Hóa Debuff Vực, Đốt 8% HP/hiệp & Giảm 18% Tỉ Lệ HAX địch.",
    "is_realm": true,
    "category": "realm",
    "file": "domains/realm_mythic_27.webp"
  },
  {
    "realm_id": "realm_mythic_28",
    "name": "« Nhật Thực Ám Diệt Cảnh »",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "debuff_boost_pct": 0.25,
    "extra_debuffs": {
      "maxHpCutPct": 0.2
    },
    "desc": "Tăng +25% Cường Hóa Debuff Vực, Cắt 20% Trần HP Tối Đa của đối thủ!",
    "is_realm": true,
    "category": "realm",
    "file": "domains/realm_mythic_28.webp"
  },
  {
    "realm_id": "realm_mythic_29",
    "name": "« Khô Mộc Hút Linh Cảnh »",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "debuff_boost_pct": 0.25,
    "extra_debuffs": {
      "healReductionPct": 0.36,
      "shieldDecayPct": 0.18
    },
    "desc": "Tăng +25% Cường Hóa Debuff Vực, Giảm 36% Hồi Máu & Bào Mòn 18% Khiên/hiệp.",
    "is_realm": true,
    "category": "realm",
    "file": "domains/realm_mythic_29.webp"
  },
  {
    "realm_id": "realm_mythic_30",
    "name": "« Bạo Lôi Oanh Đỉnh Cảnh »",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "debuff_boost_pct": 0.25,
    "extra_debuffs": {
      "defReductionPct": 0.25,
      "critTakenBonusPct": 0.2
    },
    "desc": "Tăng +25% Cường Hóa Debuff Vực, Giảm 25% DEF & khiến địch nhận +20% ST Bạo Kích.",
    "is_realm": true,
    "category": "realm",
    "file": "domains/realm_mythic_30.webp"
  },
  {
    "realm_id": "realm_mythic_31",
    "name": "« Kính Vỡ Mê Hồn Cảnh »",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "debuff_boost_pct": 0.25,
    "extra_debuffs": {
      "dotMaxHpPct": 0.08,
      "haxFailPct": 0.18
    },
    "desc": "Tăng +25% Cường Hóa Debuff Vực, Đốt 8% HP/hiệp & Giảm 18% Tỉ Lệ HAX địch.",
    "is_realm": true,
    "category": "realm",
    "file": "domains/realm_mythic_31.webp"
  },
  {
    "realm_id": "realm_mythic_32",
    "name": "« Quy Khư Tịch Diệt Cảnh »",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "is_unique": false,
    "debuff_boost_pct": 0.25,
    "extra_debuffs": {
      "maxHpCutPct": 0.2
    },
    "desc": "Tăng +25% Cường Hóa Debuff Vực, Cắt 20% Trần HP Tối Đa của đối thủ!",
    "is_realm": true,
    "category": "realm",
    "file": "domains/realm_mythic_32.webp"
  }
];

export const V17_AVATAR_FRAMES = [
  {
    "frame_id": "frame_v17_08_frost_vine",
    "name": "Hàn Sương Linh Đằng",
    "rarity": "Linh Phẩm",
    "rarity_key": "rare",
    "price": 2200,
    "source": "shop",
    "file": "frames/frame_v17_08_frost_vine.png",
    "palette": [
      "#38bdf8",
      "#0284c7",
      "#e0f2fe"
    ],
    "description": "Dây băng pha lê sương giá tinh khiết quấn quanh ảnh đại diện."
  },
  {
    "frame_id": "frame_v17_07_jade_leaf",
    "name": "Bích Ngọc Thanh Diệp",
    "rarity": "Tiên Phẩm",
    "rarity_key": "epic",
    "price": 2800,
    "source": "shop",
    "file": "frames/frame_v17_07_jade_leaf.png",
    "palette": [
      "#34d399",
      "#10b981",
      "#fef9c3"
    ],
    "description": "Lá ngọc thanh khiết điểm hoa trắng và giọt sương lưu ly."
  },
  {
    "frame_id": "frame_v17_05_night_dragon",
    "name": "Tinh Dạ Tiểu Long",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "price": 4000,
    "source": "shop",
    "file": "frames/frame_v17_05_night_dragon.png",
    "palette": [
      "#a855f7",
      "#6366f1",
      "#fde047"
    ],
    "description": "Tiểu Long tinh vân đêm trăng cưỡi mây tím cùng pha lê sao."
  },
  {
    "frame_id": "frame_v17_03_rainbow_ribbon",
    "name": "Tinh Hà Ruy Băng",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "price": 4000,
    "source": "shop",
    "file": "frames/frame_v17_03_rainbow_ribbon.png",
    "palette": [
      "#f9a8d4",
      "#93c5fd",
      "#fde68a"
    ],
    "description": "Dải ruy băng lụa bảy sắc đính sao pha lê lấp lánh."
  },
  {
    "frame_id": "frame_v17_09_sapphire_butterfly",
    "name": "Lam Điệp Tinh Lệ",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "price": 0,
    "price_tt": 10,
    "source": "special_shop",
    "file": "frames/frame_v17_09_sapphire_butterfly.png",
    "palette": [
      "#38bdf8",
      "#2563eb",
      "#e0f2fe"
    ],
    "description": "Bướm lam tinh lệ với giọt pha lê lam rủ xuống tuyệt mỹ (Shop Đặc Biệt)."
  },
  {
    "frame_id": "frame_v17_04_lotus_feather",
    "name": "Liên Hoa Vũ Dực",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "price": 0,
    "price_tt": 14,
    "source": "special_shop",
    "file": "frames/frame_v17_04_lotus_feather.png",
    "palette": [
      "#fb7185",
      "#f43f5e",
      "#fde68a"
    ],
    "description": "Sen hồng lông vũ anh đào đính ngọc trai quý phái (Shop Đặc Biệt)."
  },
  {
    "frame_id": "frame_v17_02_azure_dragon",
    "name": "Long Vân Thanh Sơn",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "price": 0,
    "price_tt": 18,
    "source": "special_shop",
    "file": "frames/frame_v17_02_azure_dragon.png",
    "palette": [
      "#38bdf8",
      "#0d9488",
      "#fde047"
    ],
    "description": "Thanh Long cuộn mây lướt đỉnh núi lam dưới vầng nhật nguyệt (Shop Đặc Biệt)."
  },
  {
    "frame_id": "frame_v17_01_moon_fox",
    "name": "Cửu Vĩ Nguyệt Hoa",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "price": 0,
    "price_tt": 20,
    "source": "special_shop",
    "file": "frames/frame_v17_01_moon_fox.png",
    "palette": [
      "#f472b6",
      "#be185d",
      "#fde68a"
    ],
    "description": "Bạch Hồ vầng trăng khuyết vàng hồng cùng dây chuỗi ngọc tinh xảo (Shop Đặc Biệt)."
  },
  {
    "frame_id": "frame_v17_06_crimson_raven",
    "name": "Huyết Nha Thâm Uyên",
    "rarity": "Thần Thoại",
    "rarity_key": "mythic",
    "price": 0,
    "price_tt": 25,
    "source": "special_shop",
    "is_commemorative": true,
    "file": "frames/frame_v17_06_crimson_raven.png",
    "palette": [
      "#e11d48",
      "#7f1d1d",
      "#c084fc"
    ],
    "description": "Khung kỷ niệm Cánh Quạ Đỏ Huyết Cầu cao quý (tặng gói đền bù Role Pet & bán giới hạn Shop Đặc Biệt)."
  }
];

export function buildV17ShopConsumables() {
  return [
    {
      item_id: 'farm_protect_card',
      name: 'Thẻ Bảo Vệ Cây & Trứng',
      category: 'consumable',
      price: 600,
      max_stack: 16,
      icon: em('farm_protect_card', em('su_shield_def')),
      description: 'Tự động kích hoạt khi ô /farm sắp héo: tiêu thụ 1 thẻ để gia hạn thêm +2 giờ (tối đa 1 lần cứu/vụ, kèm DM thông báo). Tối đa 16 thẻ.',
    },
    {
      item_id: 'alchemy_protect_card',
      name: 'Thẻ Bảo Vệ Đan',
      category: 'consumable',
      price: 400,
      max_stack: 8,
      icon: em('alchemy_protect_card', em('su_shield_def')),
      description: 'Tự động kích hoạt khi Lò Luyện Đan sắp cháy/nổ: tiêu thụ 1 thẻ để gia hạn thêm +2 giờ ân hạn (tối đa 1 lần cứu/mẻ, kèm DM thông báo). Tối đa 8 thẻ.',
    },
  ];
}

export function buildV17SpecialConsumables() {
  return [
    {
      item_id: 'farm_auto_card',
      name: 'Thẻ Tự Động Thu/Tưới',
      category: 'consumable',
      price: 0,
      price_tt: 4,
      weekly_limit: 3,
      max_stack: 20,
      icon: em('farm_auto_card', em('su_clock_timer')),
      description: 'Kích hoạt 24 giờ tự động tưới nước (ăn giảm -30p chín) & tự động thu hoạch gửi quà qua DM (không tự mua hạt). Rơi 5% tại /explorer hoặc 4 TT ở Shop Đặc Biệt.',
    },
    {
      item_id: 'farm_growth_med',
      name: 'Thuốc Tăng Trưởng',
      category: 'consumable',
      price: 0,
      price_tt: 4,
      weekly_limit: 4,
      max_stack: 99,
      icon: em('farm_growth_med', em('su_sprout')),
      description: 'Dùng cho 1 đợt /farm đang trồng để rút ngắn -25% thời gian chín toàn bộ các ô (tối đa 1 gói/đợt). Rơi 55% (1–2 gói) tại /explorer.',
    },
    {
      item_id: 'farm_yield_starch',
      name: 'Tinh Bột Tăng Sản Lượng',
      category: 'consumable',
      price: 0,
      price_tt: 4,
      weekly_limit: 4,
      max_stack: 99,
      icon: em('farm_yield_starch', em('su_sparkle')),
      description: 'Dùng cho 1 đợt thu hoạch /farm để tăng +30% Linh Thạch & Linh Quả toàn bộ các ô (tối đa 1 gói/đợt). Rơi 55% (1–2 gói) tại /explorer.',
    },
    {
      item_id: 'chaos_essence_shard',
      name: 'Tinh Hoa Hỗn Độn',
      category: 'consumable',
      price: 0,
      price_tt: 16,
      weekly_limit: 3,
      max_stack: 99,
      icon: em('chaos_essence_shard', em('su_realm_star')),
      description: 'Nguyên liệu chế tạo Hồng Mông Tiến Hóa Tinh (3 Tinh Hoa Hỗn Độn + 1 Pet Thần Thoại thường + 2.500 LT = 1 Hồng Mông). Rơi cố định 0.5% tại /explorer & +1 mỗi 100 tầng Tháp.',
    },
    {
      item_id: 'evo_crystal',
      name: 'Hồng Mông Tiến Hóa Tinh',
      category: 'consumable',
      price: 0,
      price_tt: 120,
      weekly_limit: 1,
      max_stack: 20,
      icon: em('evo_crystal', em('dao_ap_crest')),
      description: 'Vật phẩm tối quý để tiến hóa Pet Tối Thượng (Lv.40 & 8★) lên Tối Thượng Chân Thần (/tienhoa). Chỉ có từ chế tạo 3 Tinh Hoa Hỗn Độn hoặc Shop Đặc Biệt (120 TT, max 1/tuần).',
    },
    {
      item_id: 'mythic_selector_card',
      name: 'Thẻ Chọn Thần Thoại',
      category: 'consumable',
      price: 0,
      price_tt: 55,
      weekly_limit: 1,
      max_stack: 10,
      icon: em('mythic_selector_card', em('su_winner_trophy')),
      description: 'Chọn 1 trong 7 nhóm (Pet / Vũ Khí / Bảo Ngọc / Chiến Hồn / Linh Vực / Thần Thức / Thần Cảnh) để nhận ngẫu nhiên 1 món Thần Thoại thường chưa sở hữu.',
    },
    {
      item_id: 'abs_enchant_charm',
      name: 'Bùa Khắc Ấn Tuyệt Đối',
      category: 'consumable',
      price: 0,
      price_tt: 20,
      weekly_limit: 2,
      max_stack: 20,
      icon: em('abs_enchant_charm', em('enchant_stone_absolute')),
      description: 'Tăng +20% tỉ lệ rơi Thiên Đạo Tuyệt Ấn Thạch (5% -> 25%) cho 5 chuyến /explorer tiếp theo.',
    },
  ];
}
