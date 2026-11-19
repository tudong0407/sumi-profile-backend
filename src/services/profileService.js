import { supabase } from '../config/supabase.js';

export const ROLE_PERKS_MAP = {
  '1473419957655175169': '⚔️ Trảm Quyết Tối Thượng',
  '100_hon_don_chua_te': '⚔️ Trảm Quyết Tối Thượng',
  '1468649836856344689': '🛡️ Kháng Timeout & Hộ Thể',
  'cuu_vi_toi_thuong': '🛡️ Kháng Timeout & Hộ Thể',
  'linh_am_ho_ca': '🎵 Triệu Hồi Hát Live & Tâm Sự',
  'phong_thanh_ho_phap': '🎙️ Quyền Di Chuyển Voice',
  '1264915703438381099': '🎙️ Quyền Di Chuyển Voice',
  'loi_am_ton_gia': '📢 Quyền Ưu Tiên Nói Voice',
  'tich_tinh_tan_nhan': '🔇 Quyền Tắt Tiếng Voice',
  'be_tuc_chan_nhan': '🎧 Quyền Tắt Tai Nghe Voice',
  'huyen_dien_dao_quan': '🎭 Tự Do Đổi Biệt Danh',
  'dinh_danh_su_gia': '🏷️ Quản Lý Biệt Danh',
  'than_hanh_cot_cach': '⚡ Miễn Chờ Chat Chậm',
  'hoa_do_linh_su': '🖼️ Đăng Ảnh Kênh Giới Hạn',
  'van_tuong_linh_ho': '✨ Dùng Emoji Ngoại Server',
  'than_phu_thuong_quan': '🌟 Dùng Sticker Ngoại',
  'khai_son_tien_phong': '💬 Tạo Chủ Đề Công Khai',
  'mat_tang_ho_ve': '🔒 Tạo Chủ Đề Kín',
  'tran_thu_phap_vuong': '📌 Quyền Ghim Tin Nhắn',
  '1027173664069795921': '📌 Quyền Ghim Tin Nhắn',
  'huyen_am_tien_co': '🔊 Dùng Bảng Âm Thanh',
  'cuu_chau_dien_am': '🎶 Dùng Âm Ngoại Server',
  'linh_hon_tu_luyen': '📈 Buff +15% EXP Solo',
  'tai_van_hanh_thong': '💎 Buff +20% Linh Thạch',
  'tieu_dao_khach': '📺 Phát Trực Tiếp HD 1080p',
  'tram_phong_kiem_khach': '🗣️ Gửi Tin Nhắn Giọng Nói TTS',
};

/**
 * Tra cứu đặc quyền của Role
 */
export function getRolePerkByName(roleName, roleId) {
  if (roleId && ROLE_PERKS_MAP[roleId]) return ROLE_PERKS_MAP[roleId];
  if (!roleName) return '✨ Đặc Quyền Tu Tiên';
  const clean = roleName.toLowerCase();
  if (clean.includes('hỗn độn')) return '⚔️ Trảm Quyết Tối Thượng';
  if (clean.includes('cửu vĩ')) return '🛡️ Kháng Timeout & Hộ Thể';
  if (clean.includes('phong thanh')) return '🎙️ Quyền Di Chuyển Voice';
  if (clean.includes('thần hành')) return '⚡ Miễn Chờ Chat Chậm';
  if (clean.includes('trấn thư')) return '📌 Quyền Ghim Tin Nhắn';
  if (clean.includes('linh âm')) return '🎵 Triệu Hồi Hát Live & Tâm Sự';
  if (clean.includes('họa đồ')) return '🖼️ Đăng Ảnh Kênh Giới Hạn';
  if (clean.includes('vạn tượng')) return '✨ Dùng Emoji Ngoại Server';
  if (clean.includes('tiêu dao')) return '📺 Phát Trực Tiếp HD 1080p';
  return '✨ Quyền Năng Tiên Giới';
}

/**
 * Tính Cảnh Giới tu tiên dựa trên cấp độ
 * @param {number} level 
 * @returns {string} Tên cảnh giới
 */
export function getRealmByLevel(level) {
  const lvl = Number(level) || 1;
  if (lvl >= 100) return 'VII. Hỗn Độn Chúa Tể';
  if (lvl >= 90) return 'VI. Đại Thừa Vô Cực';
  if (lvl >= 80) return 'V. Hóa Thần Tiên Tôn';
  if (lvl >= 60) return 'IV. Nguyên Anh Chân Quân';
  if (lvl >= 40) return 'III. Kim Đan Đại Đạo';
  if (lvl >= 20) return 'II. Trúc Cơ Đạo Cảnh';
  return 'I. Luyện Khí Sơ Kỳ';
}

/**
 * Tính EXP cần cho cấp độ tiếp theo
 * @param {number} level 
 * @returns {number} EXP cần đạt
 */
export function getExpForNextLevel(level) {
  const lvl = Number(level) || 1;
  if (lvl >= 100) return 500000;
  return Math.floor(100 * Math.pow(lvl, 1.8));
}

/**
 * Trả về Mock Data chuẩn cho Tiểu thư Fuyumi (757091869183311872)
 */
export function getFuyumiProfileMock() {
  return {
    user_id: '757091869183311872',
    username: 'Fuyumi 🌸',
    discriminator: '0',
    avatar_url: 'assets/fuyumi_avatar.png',
    avatar_frame: 'celestial_fox_gold',
    background_url: 'assets/celestial_palace_pink.png',
    bio: 'Cửu Vĩ Tiên Chủ • Người sáng lập và bảo hộ SuMi Family',
    custom_title: 'Cửu Vĩ Tiên Chủ',
    realm: 'VII. Hỗn Độn Chúa Tể',
    level: 100,
    exp: 450000,
    next_level_exp: 500000,
    linh_thach: 999999,
    max_role_slots: 5,
    streak: 100,
    clan: {
      clan_id: 'thien_ho_than_toc',
      clan_name: 'Thiên Hồ Thần Tộc',
      clan_tag: '🦊TH',
      clan_level: 5,
      is_leader: true,
    },
    married: {
      user_id: '511187329889861651',
      username: 'Ngài_Ấy 💍',
      status: 'Đã kết hôn',
    },
    pet: {
      name: 'Cửu Vĩ Hồng Hồ',
      type: 'cuu_vi_hong_ho',
      rarity: 'Tối Thượng Thần Thoại',
      element: 'Hỗn Độn',
      hax_skill: 'Cửu Vĩ Hộ Thể (HAX Bất Tử)',
      hax_desc: 'Bất tử 3 đòn đầu, phản lại 100% sát thương gốc',
      level: 99,
      star: 10,
      atk: 99999,
      def: 99999,
      spd: 99999,
      power: 9999999,
      icon: '🦊',
    },
    equipped_roles: [
      { slot: 1, role_id: '1473419957655175169', name: '« 100 • Hỗn Độn Chúa Tể »', perk: '⚔️ Trảm Quyết Tối Thượng', rarity: 'mythic' },
      { slot: 2, role_id: '1468649836856344689', name: '« Cửu Vĩ Tối Thượng Thần Hồ »', perk: '🛡️ Kháng Timeout & Hộ Thể', rarity: 'mythic' },
      { slot: 3, role_id: '1264915703438381099', name: '« Phong Thanh Hộ Pháp »', perk: '🎙️ Di Chuyển Voice', rarity: 'rare' },
      { slot: 4, role_id: 'than_hanh_cot_cach', name: '« Thần Hành Cốt Cách »', perk: '⚡ Miễn Chờ Chat Chậm', rarity: 'epic' },
      { slot: 5, role_id: '1027173664069795921', name: '« Trấn Thư Pháp Vương »', perk: '📌 Ghim Tin Nhắn', rarity: 'legendary' },
    ],
  };
}

/**
 * Trả về Mock Data mặc định cho user thường
 * @param {string} userId 
 */
export function getDefaultUserMock(userId) {
  const shortId = (userId || '1234').slice(-4);
  const lvl = 18;
  const currentExp = 2800;
  const nextExp = getExpForNextLevel(lvl);

  return {
    user_id: userId,
    username: `Tu Sĩ #${shortId}`,
    discriminator: '0',
    avatar_url: 'assets/default_avatar.png',
    avatar_frame: 'default',
    background_url: 'assets/default_background.png',
    bio: 'Một vị tu sĩ đang tu luyện tại SuMi Family',
    custom_title: 'Đệ Tử Ngoại Môn',
    realm: getRealmByLevel(lvl),
    level: lvl,
    exp: currentExp,
    next_level_exp: nextExp,
    linh_thach: 1250,
    max_role_slots: 2,
    streak: 7,
    clan: {
      clan_id: 'ho_ly_mon',
      clan_name: 'Hồ Ly Tông Môn',
      clan_tag: '🌸HL',
      clan_level: 2,
      is_leader: false,
    },
    married: null,
    pet: {
      name: 'Băng Tuyết Hồ',
      type: 'bang_tuyet_ho',
      rarity: 'Hiếm',
      element: 'Thủy / Băng',
      hax_skill: 'Băng Phong (Đóng Băng)',
      hax_desc: '35% tỉ lệ đóng băng đối thủ 1 hiệp',
      level: 15,
      star: 3,
      atk: 450,
      def: 380,
      spd: 520,
      power: 3250,
      icon: '❄️',
    },
    equipped_roles: [
      { slot: 1, role_id: 'phong_thanh', name: '« Phong Thanh Hộ Pháp »', perk: '🎙️ Di Chuyển Voice', rarity: 'rare' },
    ],
  };
}

/**
 * Lấy dữ liệu hồ sơ từ Supabase hoặc Mock
 * @param {string} userId 
 * @param {Object} overrides Tham số ghi đè tùy chọn từ query param hoặc API
 * @returns {Promise<Object>}
 */
export async function getProfileData(userId, overrides = {}) {
  const cleanId = String(userId || '0').replace(/\.(png|jpe?g|webp|json)$/i, '');
  let baseProfile = null;

  // 1. Kiểm tra nếu có Supabase client hoạt động
  if (supabase) {
    try {
      const { data: user, error: userErr } = await supabase
        .from('users')
        .select('*')
        .eq('user_id', cleanId)
        .single();

      if (!userErr && user) {
        // Lấy Clan nếu có
        let clanData = null;
        if (user.clan_id) {
          const { data: clan } = await supabase
            .from('clans')
            .select('*')
            .eq('clan_id', user.clan_id)
            .single();
          if (clan) {
            clanData = {
              clan_id: clan.clan_id,
              clan_name: clan.clan_name,
              clan_tag: clan.clan_tag,
              clan_level: clan.clan_level,
              is_leader: clan.leader_id === user.user_id,
            };
          }
        }

        // Lấy Active Pet
        let petData = null;
        const { data: pet } = await supabase
          .from('user_pets')
          .select('*')
          .eq('user_id', cleanId)
          .eq('is_active', true)
          .limit(1)
          .maybeSingle();

        if (pet) {
          petData = {
            name: pet.pet_name,
            type: pet.pet_type,
            rarity: pet.pet_rarity || 'Thường',
            element: pet.element || 'Kim',
            hax_skill: pet.hax_skill || null,
            hax_desc: pet.hax_description || null,
            level: pet.level,
            star: pet.star || 1,
            atk: pet.atk,
            def: pet.def,
            spd: pet.spd,
            power: pet.power_score || (pet.atk * 3 + pet.def * 2 + pet.spd * 2 + pet.level * 50),
            icon: pet.pet_type === 'cuu_vi_hong_ho' ? '🦊' : (pet.icon || '🐾'),
          };
        }

        // Lấy Equipped Roles
        const { data: roles } = await supabase
          .from('user_roles')
          .select('*')
          .eq('user_id', cleanId)
          .eq('is_equipped', true)
          .order('equipped_slot', { ascending: true });

        const equippedRoles = (roles || []).map(r => ({
          slot: r.equipped_slot,
          role_id: r.role_id,
          name: r.role_name,
          perk: r.role_perk || getRolePerkByName(r.role_name, r.role_id),
          rarity: r.is_permanent ? 'mythic' : 'rare',
        }));

        // Ghép married data
        let marriedData = null;
        if (user.marry_user_id) {
          marriedData = {
            user_id: user.marry_user_id,
            username: user.marry_username || `ID: ${user.marry_user_id}`,
            date: user.marry_date,
          };
        }

        baseProfile = {
          user_id: user.user_id,
          username: user.username,
          discriminator: user.discriminator || '0',
          avatar_url: user.avatar_url,
          avatar_frame: user.avatar_frame,
          background_url: user.background_url,
          bio: user.bio,
          custom_title: user.custom_title,
          realm: user.custom_title || getRealmByLevel(user.level),
          level: user.level,
          exp: user.exp,
          next_level_exp: getExpForNextLevel(user.level),
          linh_thach: user.linh_thach,
          max_role_slots: user.max_role_slots || 1,
          streak: user.streak || 0,
          clan: clanData,
          married: marriedData,
          pet: petData,
          equipped_roles: equippedRoles,
        };
      }
    } catch (e) {
      console.warn(`[ProfileService] Supabase query failed for user ${cleanId}:`, e.message);
    }
  }

  // 2. Fallback nếu không có Supabase hoặc chưa tạo user trong DB
  if (!baseProfile) {
    if (cleanId === '757091869183311872') {
      baseProfile = getFuyumiProfileMock();
    } else {
      baseProfile = getDefaultUserMock(cleanId);
    }
  }

  // 3. Áp dụng các giá trị ghi đè (từ query params như username, avatar, v.v.)
  if (overrides.username) baseProfile.username = overrides.username;
  if (overrides.avatar || overrides.avatar_url) baseProfile.avatar_url = overrides.avatar || overrides.avatar_url;
  if (overrides.custom_title || overrides.title) baseProfile.custom_title = overrides.custom_title || overrides.title;
  if (overrides.background_url || overrides.bg) baseProfile.background_url = overrides.background_url || overrides.bg;

  return baseProfile;
}
