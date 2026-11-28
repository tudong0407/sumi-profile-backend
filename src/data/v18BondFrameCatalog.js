/**
 * src/data/v18BondFrameCatalog.js
 * Zero-import helper danh sách 41 Khung Avatar Chân Thần (frame_bond_<pet_type>)
 * Dùng chung cho cả catalog.js và v18PetBondCatalog.js mà không gây circular ESM dependency.
 */

export const PET_BOND_FRAME_PET_TYPES = [
  'hon_don_chi_to_long',
  'thai_so_cuu_phuong_hoang',
  'van_kiem_de_ton_ho',
  'bac_hai_huyen_vu_de',
  'thoi_khong_than_tinh_ho',
  'thai_cuc_thanh_quang_thu',
  'cuu_u_do_than_diem_lang',
  'thanh_de_van_co_long',
  'cuu_thien_loi_de_ho',
  'hoang_thien_ban_co_lan',
  'hong_mong_nguyen_phuong',
  'thai_so_van_tuong_ho',
  'phan_thien_kim_o_de',
  'xich_diem_chuc_long_vuong',
  'bach_de_tru_tien_ung',
  'thai_bach_thien_kiem_lan',
  'thuong_hai_bang_phuong',
  'huyen_minh_co_long_vuong',
  'tinh_ha_hu_khong_long',
  'vo_cuc_nguyet_anh_diep',
  'cuu_tieu_thanh_loan',
  'nhat_nguyet_thien_ma_de',
  'vinh_da_huyet_nha_hoang',
  'u_minh_man_chau_ho',
  'van_hoa_linh_loc_vuong',
  'thai_at_co_moc_phuong',
  'tu_tieu_thien_loi_long',
  'loi_hoang_kim_dieu',
  'hau_tho_tran_nhac_quy',
  'huyen_hoang_thach_su',
  'hong_mong_cuu_vy_tien',
  'huyet_nguyet_thien_lang_nu',
  'xich_diem_phuong_hoang_co',
  'bach_de_kiem_ho_quan',
  'thuong_hai_long_nu',
  'tu_tieu_loi_ho_quan',
  'van_hoa_linh_loc_co',
  'thai_am_ngoc_tho_tien',
  'tinh_ha_nguyet_mieu_co',
  'hoang_thien_ky_lan_quan',
  'cuu_vi_hong_ho',
];

export function buildV18BondAvatarFrames(petByType = {}) {
  return PET_BOND_FRAME_PET_TYPES.map((petType) => {
    const petMeta = petByType[petType] || {};
    const cleanTitle = String(petMeta.pet_name || petType).replace(/[«»]/g, '').trim();
    const isFuyumi = petType === 'cuu_vi_hong_ho';
    return {
      frame_id: `frame_bond_${petType}`,
      pet_type: petType,
      name: isFuyumi
        ? 'Hồng Mông Đế Nữ • Vĩnh Hằng Thủ Hộ Khung'
        : `Khung Chân Thần • ${cleanTitle}`,
      price: 0,
      rarity: 'Chân Thần',
      rarity_key: 'supreme',
      category: 'bond_exclusive',
      is_bond_exclusive: true,
      token_required: false,
      unlock_desc: isFuyumi
        ? 'Đạt Thiện Cảm Bậc 10/10 (Vĩnh Hằng Thủ Hộ) cùng Cửu Vĩ Hồng Hồ.'
        : `Tiến hóa Chân Thần & đạt Thiện Cảm Bậc 10/10 cùng ${cleanTitle}.`,
      description: isFuyumi
        ? 'Khung Chân Thần độc quyền mở khóa khi Cửu Vĩ Hồng Hồ đạt Bậc 10/10 (+50% LT Điểm danh/Nghề & +50% EXP Chat/Voice).'
        : `Khung Chân Thần độc quyền mở khóa khi ${cleanTitle} Tiến Hóa & đạt Bậc 10/10 (+50% LT Điểm danh/Nghề & +50% EXP Chat/Voice).`,
      buffs: { ltPct: 50, expPct: 50 },
      buff_desc: '+50% LT (Điểm danh & Nghề) • +50% EXP (Chat & Voice)',
      image_path: `frames/frame_bond_${petType}.png`,
    };
  });
}
