import { supabase } from '../config/supabase.js';
import {
  FUYUMI_USER_ID,
  PET_BY_TYPE,
  STARTER_PET,
  createStarterPetObject,
  formatRarityLabel,
  LEVEL_ROLE_BUFF_CONFIG,
  ROLE_BUFF_CONFIG,
} from '../data/catalog.js';
import { computeMarriageBuffs } from './marryService.js';

export const ROLE_PERKS_MAP = {
  '1473419957655175169': '⚔️ Trảm Quyết Tối Thượng',
  '100_hon_don_chua_te': '⚔️ Trảm Quyết Tối Thượng',
  '1573185998857183253': '🛡️ Kháng Timeout & Hộ Thể',
  '1468649836856344689': '🛡️ Kháng Timeout & Hộ Thể',
  'cuu_vi_toi_thuong': '🛡️ Kháng Timeout & Hộ Thể',
  '1573186003101941830': '👑 Quản Trị Voice & Chat Danh Dự',
  'sumi_de_nhat_khach_ton': '👑 Quản Trị Voice & Chat Danh Dự',
  '1573186007262695644': '🌌 Bá Chủ Voice & Thread',
  'van_co_chi_ton': '🌌 Bá Chủ Voice & Thread',
  '1573186011478102096': '✨ Sáng Thế & Buff x2.5 Linh Thạch',
  'sang_the_than_quan': '✨ Sáng Thế & Buff x2.5 Linh Thạch',
  '1573186015785521265': '🌸 Huy Hiệu Độc Tôn & Buff +80% EXP',
  'cuu_vi_yeu_hau': '🌸 Huy Hiệu Độc Tôn & Buff +80% EXP',
  '1573186019858317422': '🎵 Triệu Hồi Hát Live & Tâm Sự',
  'linh_am_ho_ca': '🎵 Triệu Hồi Hát Live & Tâm Sự',
  '1573186024048173076': '🎙️ Quyền Di Chuyển Voice',
  'phong_thanh_ho_phap': '🎙️ Quyền Di Chuyển Voice',
  '1264915703438381099': '🎙️ Quyền Di Chuyển Voice',
  '1573186028196462613': '📢 Quyền Ưu Tiên Nói Voice',
  'loi_am_ton_gia': '📢 Quyền Ưu Tiên Nói Voice',
  '1573186032289980416': '🔇 Quyền Tắt Tiếng Voice',
  'tich_tinh_tan_nhan': '🔇 Quyền Tắt Tiếng Voice',
  '1573186036585201726': '🎧 Quyền Tắt Tai Nghe Voice',
  'be_tuc_chan_nhan': '🎧 Quyền Tắt Tai Nghe Voice',
  '1573186040716468316': '🎭 Tự Do Đổi Biệt Danh',
  'huyen_dien_dao_quan': '🎭 Tự Do Đổi Biệt Danh',
  '1573186045468614687': '🏷️ Quản Lý Biệt Danh',
  'dinh_danh_su_gia': '🏷️ Quản Lý Biệt Danh',
  '1573186049289756712': '⚡ Miễn Chờ Chat Chậm',
  'than_hanh_cot_cach': '⚡ Miễn Chờ Chat Chậm',
  '1573186053500833802': '🖼️ Đăng Ảnh Kênh Giới Hạn',
  'hoa_do_linh_su': '🖼️ Đăng Ảnh Kênh Giới Hạn',
  '1573186057778888745': '✨ Dùng Emoji Ngoại Server',
  'van_tuong_linh_ho': '✨ Dùng Emoji Ngoại Server',
  '1573186061860077568': '🌟 Dùng Sticker Ngoại',
  'than_phu_thuong_quan': '🌟 Dùng Sticker Ngoại',
  '1573186066134073394': '💬 Tạo Chủ Đề Công Khai',
  'khai_son_tien_phong': '💬 Tạo Chủ Đề Công Khai',
  '1573186070206742578': '🔒 Tạo Chủ Đề Kín',
  'mat_tang_ho_ve': '🔒 Tạo Chủ Đề Kín',
  '1573186074153324608': '📌 Quyền Ghim Tin Nhắn',
  'tran_thu_phap_vuong': '📌 Quyền Ghim Tin Nhắn',
  '1027173664069795921': '📌 Quyền Ghim Tin Nhắn',
  '1573186078402158776': '🔊 Dùng Bảng Âm Thanh',
  'huyen_am_tien_co': '🔊 Dùng Bảng Âm Thanh',
  '1573186082768560198': '🎶 Dùng Âm Ngoại Server',
  'cuu_chau_dien_am': '🎶 Dùng Âm Ngoại Server',
  '1573186087088554085': '📈 Buff +15% EXP Solo',
  'linh_hon_tu_luyen': '📈 Buff +15% EXP Solo',
  '1573186091094245416': '💎 Buff +20% Linh Thạch',
  'tai_van_hanh_thong': '💎 Buff +20% Linh Thạch',
  '1573186095120908329': '📺 Phát Trực Tiếp HD 1080p',
  'tieu_dao_khach': '📺 Phát Trực Tiếp HD 1080p',
  '1573186099663343747': '🗣️ Gửi Tin Nhắn Giọng Nói TTS',
  'tram_phong_kiem_khach': '🗣️ Gửi Tin Nhắn Giọng Nói TTS',
  '1573186103664574524': '👁️ Đọc Lịch Sử Kênh Lưu Trữ',
  'than_thong_thau_thi': '👁️ Đọc Lịch Sử Kênh Lưu Trữ',
  // 14 Multi-Perk Roles (2-4 chức năng)
  '1573577773279219763': '⚡📌 Miễn Slowmode & Ghim Tin Nhắn',
  '1573577776454434899': '🎭✨ Đổi Nick, Emoji/Sticker Ngoại & +10% EXP',
  '1573577779621138542': '🎙️📢 Di Chuyển & Ưu Tiên Nói Voice',
  '1573577782380728410': '📺🔊 Stream HD, Soundboard Ngoại & +10% Daily LT',
  '1573577786218651688': '💬👁️ Thread Kín/Mở, Kênh Ẩn & +12% EXP',
  '1573577788965781504': '💎🏷️ Buff +25% Daily LT & Giảm 5% Giá Shop',
  '1573577794091225108': '⚔️⚡ Buff +8% Chiến Lực Pet & Miễn Slowmode',
  '1573577796742152314': '🎵📢 Ưu Tiên Voice, Âm Ngoại & +12% EXP',
  '1573577799539892314': '🌬️🔇 Move/Mute Voice, Miễn Slowmode & +20% EXP',
  '1573577805286080523': '🏷️📌 Quản Lý Nick, Ghim Tin, Thread Kín & +20% Daily LT',
  '1573577808867762186': '💰✨ +35% Daily LT, Giảm 10% Shop/Roll & Emoji/Sticker',
  '1573577811786993756': '🔥⚔️ +15% Chiến Lực Pet, +20% EXP, Ghim & Slowmode',
  '1573577814437789797': '🌸💫 +25% EXP, +10% Chiến Lực, Stream HD & Sound/Emoji',
  '1573577816690401401': '🌌🛡️ Move/Mute/Deafen Voice, Ghim Tin & +25% EXP',
};

export function computeRoleBuffTotalsFromList(roleIds = [], userLevel = 1) {
  const lvl = Number(userLevel) || 1;
  const seen = new Set();
  let expBonusPct = 0;
  let dailyLtBonusPct = 0;
  let petPowerBonusPct = 0;
  let shopDiscountPct = 0;
  let gachaDiscountPct = 0;

  const levelBuff = LEVEL_ROLE_BUFF_CONFIG.find((c) => lvl >= c.level);
  if (levelBuff) {
    expBonusPct += Number(levelBuff.expPct || 0);
    dailyLtBonusPct += Number(levelBuff.dailyLtPct || 0);
    petPowerBonusPct += Number(levelBuff.petPowerPct || 0);
  }

  for (const rid of roleIds || []) {
    const clean = String(rid || '').trim();
    if (!clean || seen.has(clean)) continue;
    seen.add(clean);
    const cfg = ROLE_BUFF_CONFIG[clean];
    if (!cfg) continue;
    expBonusPct += Number(cfg.expPct || 0);
    dailyLtBonusPct += Number(cfg.dailyLtPct || 0);
    petPowerBonusPct += Number(cfg.petPowerPct || 0);
    shopDiscountPct += Number(cfg.shopDiscountPct || 0);
    gachaDiscountPct += Number(cfg.gachaDiscountPct || 0);
  }

  return {
    expBonusPct,
    dailyLtBonusPct,
    petPowerBonusPct,
    shopDiscountPct: Math.min(25, shopDiscountPct),
    gachaDiscountPct: Math.min(20, gachaDiscountPct),
  };
}

export async function computeRoleBuffTotals(userId, userLevel = 1, extraRoleIds = [], now = new Date()) {
  const combined = [...(Array.isArray(extraRoleIds) ? extraRoleIds : [...(extraRoleIds || [])])];
  if (supabase && userId) {
    try {
      const { data: equipped } = await supabase
        .from('user_roles')
        .select('role_id, is_permanent, expires_at')
        .eq('user_id', userId)
        .eq('is_equipped', true);
      for (const r of equipped || []) {
        if (r.is_permanent || !r.expires_at || new Date(r.expires_at) > now) {
          combined.push(r.role_id);
        }
      }
    } catch {
      // non-blocking
    }
  }
  return computeRoleBuffTotalsFromList(combined, userLevel);
}

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
  return Math.floor(60 * Math.pow(lvl, 1.45));
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
    marry_ring_id: null,
    married: null,
    pet: {
      name: 'Cửu Vĩ Hồng Hồ',
      type: 'cuu_vi_hong_ho',
      pet_type: 'cuu_vi_hong_ho',
      rarity: 'Tối Thượng Thần Thoại',
      element: 'Hỗn Độn',
      hax_skill: 'Cửu Vĩ Hộ Thể (HAX Bất Tử)',
      hax_desc: 'Bất tử 3 đòn đầu, phản lại 100% sát thương gốc',
      level: 99,
      star: 10,
      atk: 101069,
      def: 101049,
      spd: 100949,
      power: 10009709,
      icon: '🦊',
      equipment: {
        weapon: {
          item_id: 'weapon_mythic_1',
          item_name: '« Tru Tiên Diệt Thần Kiếm »',
          item_type: 'weapon',
          slot: 'weapon',
          rarity: 'Than Thoai',
          element: 'Kim',
          bonus_atk: 720,
          bonus_def: 0,
          bonus_spd: 300,
          bonus_hp: 0,
          bonus_crit: 18,
          hax_skill: 'Tuyệt Diệt Bất Tử',
          hax_description: 'Đòn đánh xuyên qua 100% khiên chắn và vô hiệu hóa hoàn toàn cơ chế Bất Tử / Trùng Sinh của đối phương trong 3 lượt đầu!',
          icon: '⚔️',
        },
        gem: {
          item_id: 'gem_mythic_3',
          item_name: '« Thiên Hồ Hóa Thần Ngọc »',
          item_type: 'gem',
          slot: 'gem',
          rarity: 'Than Thoai',
          element: 'Hon Don',
          bonus_atk: 0,
          bonus_def: 750,
          bonus_spd: 200,
          bonus_hp: 5000,
          bonus_crit: 0,
          hax_skill: 'Thần Hồ Diễm Hộ',
          hax_description: 'Đầu trận tạo khiên hộ thể bằng 100% máu tối đa; khi khiên còn tồn tại, mọi đòn tấn công của đối phương bị giảm 50% uy lực!',
          icon: '🦊',
        },
        soul: {
          item_id: 'soul_mythic_1',
          item_name: '« Cửu Vĩ Thiên Tiên Hồn »',
          item_type: 'soul',
          slot: 'soul',
          rarity: 'Than Thoai',
          element: 'Hon Don',
          bonus_atk: 350,
          bonus_def: 300,
          bonus_spd: 450,
          bonus_hp: 0,
          bonus_crit: 0,
          hax_skill: 'Mị Hoặc Chúng Sinh',
          hax_description: 'Mỗi hiệp đấu có 40% xác suất Mị Hoặc đối thủ, ép nó tự tung đòn đánh mạnh nhất vào chính bản thân nó thay vì đánh Pet!',
          icon: '🦊',
        },
      },
    },
    equipped_roles: [
      { slot: 1, role_id: '1473419957655175169', name: '« 100 • Hỗn Độn Chúa Tể »', perk: '⚔️ Trảm Quyết Tối Thượng', rarity: 'mythic' },
      { slot: 2, role_id: '1573185998857183253', name: '« Cửu Vĩ Tối Thượng Thần Hồ »', perk: '🛡️ Kháng Timeout & Hộ Thể', rarity: 'mythic' },
      { slot: 3, role_id: '1573186024048173076', name: '« Phong Thanh Hộ Pháp »', perk: '🎙️ Di Chuyển Voice', rarity: 'rare' },
      { slot: 4, role_id: '1573186049289756712', name: '« Thần Hành Cốt Cách »', perk: '⚡ Miễn Chờ Chat Chậm', rarity: 'epic' },
      { slot: 5, role_id: '1573186074153324608', name: '« Trấn Thư Pháp Vương »', perk: '📌 Ghim Tin Nhắn', rarity: 'legendary' },
    ],
  };
}

/**
 * Tính số Slot Role Quyền Năng mở khóa theo cấp độ
 * @param {number} level
 * @returns {number} 1..5
 */
export function getMaxRoleSlotsByLevel(level) {
  const lvl = Number(level) || 1;
  if (lvl >= 80) return 5;
  if (lvl >= 60) return 4;
  if (lvl >= 40) return 3;
  if (lvl >= 20) return 2;
  return 1;
}

/**
 * Trả về hồ sơ Tân Thủ Chuẩn (Lv.1, 0 EXP, 0 Linh Thạch + Pet Phàm Phẩm khởi đầu Hóa Thạch Nham Nham Thú)
 * @param {string} userId
 */
export function createBeginnerProfile(userId) {
  const shortId = String(userId || '0000').slice(-4);
  const lvl = 1;
  const nextExp = getExpForNextLevel(lvl);

  return {
    user_id: userId,
    username: `Tu Sĩ #${shortId}`,
    discriminator: '0',
    avatar_url: 'assets/default_avatar.png',
    avatar_frame: 'default',
    background_url: 'assets/default_background.png',
    bio: 'Một vị tu sĩ mới bước vào tiên giới SuMi Family',
    custom_title: 'Tân Thủ Nhập Đạo',
    realm: getRealmByLevel(lvl),
    level: lvl,
    exp: 0,
    next_level_exp: nextExp,
    linh_thach: 0,
    max_role_slots: 1,
    streak: 0,
    clan: null,
    married: null,
    pet: createStarterPetObject(),
    equipped_roles: [],
  };
}

/**
 * Alias tương thích ngược -> trả về hồ sơ Tân Thủ Chuẩn Lv.1 (đã gỡ bỏ dữ liệu giả Lv.18)
 * @param {string} userId
 */
export function getDefaultUserMock(userId) {
  return createBeginnerProfile(userId);
}

const inFlightInitPromises = new Map();

/**
 * Nhận diện đúng biến placeholder chưa được BotGhost thay thế (ví dụ: {event_user_display_name}, {user_displayName[option_user]}, {option_user})
 * mà vẫn chấp nhận các tên hiển thị trang trí có ngoặc nhọn như {Kitsune} hoặc {🌸 Alice 🌸}.
 */
export function isUnresolvedBotGhostVar(val) {
  if (typeof val !== 'string') return false;
  const s = val.trim();
  if (!s.startsWith('{') || !s.endsWith('}')) return false;
  return /^\{(?:event_|user_|option_|server_|channel_|member_|target_|time_|encode_text|BGVAR_|isBot\b|[a-z0-9_]+\.[a-z0-9_.]+)/i.test(s);
}

/**
 * Chọn giá trị hợp lệ đầu tiên (không rỗng và không phải biến BotGhost chưa resolve)
 */
export function pickCleanDisplayValue(...candidates) {
  for (const raw of candidates) {
    if (typeof raw !== 'string') continue;
    const trimmed = raw.trim();
    if (trimmed && !isUnresolvedBotGhostVar(trimmed)) {
      return trimmed;
    }
  }
  return null;
}

/**
 * Tự động khởi tạo hồ sơ tân thủ Lv.1 + Pet Phàm Phẩm mặc định trong Supabase nếu chưa tồn tại.
 * Bảo toàn 100% dữ liệu Tiểu thư Fuyumi (757091869183311872).
 * Khử trùng lặp đồng thời (in-flight coalescing) theo userId để không bao giờ nhân đôi Pet khởi đầu.
 * @param {string} userId
 * @param {{ username?: string|null, fallbackUsername?: string|null, avatarUrl?: string|null }} meta
 */
export async function ensureUserInitialized(userId, meta = {}) {
  const cleanId = sanitizeUserId(userId);
  if (!cleanId || !/^[0-9]{17,20}$/.test(cleanId)) {
    return { user: null, initializedNewUser: false };
  }
  if (!supabase) {
    return { user: null, initializedNewUser: false };
  }

  if (inFlightInitPromises.has(cleanId)) {
    return inFlightInitPromises.get(cleanId);
  }

  const run = (async () => {
    const { data: existingUser } = await supabase
      .from('users')
      .select('*')
      .eq('user_id', cleanId)
      .maybeSingle();

    let userRow = existingUser;
    let initializedNewUser = false;

    const cleanNameRaw = pickCleanDisplayValue(meta.username, meta.fallbackUsername);
    const cleanName = cleanNameRaw ? cleanNameRaw.slice(0, 100) : null;
    const rawAvatarCandidate = pickCleanDisplayValue(meta.avatarUrl);
    const cleanAvatar = rawAvatarCandidate && (/^https?:\/\//i.test(rawAvatarCandidate) || rawAvatarCandidate.startsWith('assets/'))
      ? rawAvatarCandidate
      : null;

    if (!userRow) {
      if (cleanId === FUYUMI_USER_ID) {
        return { user: null, initializedNewUser: false };
      }
      const shortId = cleanId.slice(-4);
      const insertPayload = {
        user_id: cleanId,
        username: cleanName || `Tu Sĩ #${shortId}`,
        discriminator: '0',
        avatar_url: cleanAvatar || 'assets/default_avatar.png',
        exp: 0,
        level: 1,
        linh_thach: 0,
        avatar_frame: 'default',
        background_url: 'assets/default_background.png',
        bio: 'Một vị tu sĩ mới bước vào tiên giới SuMi Family',
        custom_title: 'Tân Thủ Nhập Đạo',
        max_role_slots: 1,
        clan_id: null,
        streak: 0,
        total_voice_minutes: 0,
      };

      const { data: created, error: insertErr } = await supabase
        .from('users')
        .upsert(insertPayload, { onConflict: 'user_id', ignoreDuplicates: true })
        .select('*')
        .maybeSingle();

      if (insertErr) {
        console.warn(`[ProfileService] ensureUserInitialized insert error for ${cleanId}:`, insertErr.message);
      }

      if (created) {
        userRow = created;
        initializedNewUser = true;
      } else {
        const { data: refetched } = await supabase.from('users').select('*').eq('user_id', cleanId).maybeSingle();
        userRow = refetched || insertPayload;
      }
    } else if (cleanId !== FUYUMI_USER_ID) {
      // Cập nhật nhẹ username/avatar thật nếu đang là placeholder
      const patch = {};
      if (cleanName && (!userRow.username || userRow.username.startsWith('Tu Sĩ '))) {
        patch.username = cleanName;
      }
      if (cleanAvatar && (!userRow.avatar_url || userRow.avatar_url === 'assets/default_avatar.png')) {
        patch.avatar_url = cleanAvatar;
      }
      if (Object.keys(patch).length > 0) {
        patch.updated_at = new Date().toISOString();
        const { data: updated } = await supabase
          .from('users')
          .update(patch)
          .eq('user_id', cleanId)
          .select('*')
          .maybeSingle();
        if (updated) userRow = updated;
      }
    }

    // Đảm bảo mọi thành viên (trừ Fuyumi đã có Cửu Vĩ Hồng Hồ) đều có ít nhất Pet Phàm Phẩm khởi đầu
    if (cleanId !== FUYUMI_USER_ID) {
      const { data: existingPets } = await supabase
        .from('user_pets')
        .select('pet_id')
        .eq('user_id', cleanId)
        .eq('is_active', true)
        .limit(1);

      if (!existingPets || existingPets.length === 0) {
        const { error: petErr } = await supabase.from('user_pets').insert({
          user_id: cleanId,
          pet_name: STARTER_PET.pet_name,
          pet_type: STARTER_PET.pet_type,
          pet_rarity: STARTER_PET.rarity,
          element: STARTER_PET.element,
          hax_skill: STARTER_PET.hax_skill,
          hax_description: STARTER_PET.hax_description,
          level: 1,
          exp: 0,
          star: 1,
          atk: STARTER_PET.base_atk,
          def: STARTER_PET.base_def,
          spd: STARTER_PET.base_spd,
          power_score: STARTER_PET.base_power,
          is_active: true,
        });
        if (petErr) {
          console.warn(`[ProfileService] Starter pet seed error for ${cleanId}:`, petErr.message);
        }
      }
    }

    return { user: userRow, initializedNewUser };
  })();

  inFlightInitPromises.set(cleanId, run);
  try {
    return await run;
  } finally {
    inFlightInitPromises.delete(cleanId);
  }
}

/**
 * Làm sạch và chuẩn hóa userId từ Discord mention, query string hoặc path param
 * Hỗ trợ các định dạng:
 * - Pure snowflake ID: '757091869183311872'
 * - Mention format: '<@757091869183311872>', '<@!757091869183311872>'
 * - File extension format: '757091869183311872.png', '<@757091869183311872>.png'
 * - URL encoded: '%3C@757091869183311872%3E'
 * - Placeholder format: '{option_user}' -> ''
 * @param {string} input
 * @returns {string} clean ID
 */
export function sanitizeUserId(input) {
  if (!input) return '';
  let str = String(input).trim();
  try {
    str = decodeURIComponent(str);
  } catch (e) {}

  // Strip file extensions first (e.g. <@757091869183311872>.png or 757091869183311872.png)
  str = str.replace(/\.(png|jpe?g|webp|json)$/i, '').trim();

  // Strip Discord mention: <@123456789012345678> or <@!123456789012345678>
  const mentionMatch = str.match(/<@!?([0-9]{17,20})>/);
  if (mentionMatch) {
    return mentionMatch[1];
  }

  // Any 17-20 digit snowflake ID
  const match = str.match(/[0-9]{17,20}/);
  if (match) {
    return match[0];
  }

  // If BotGhost variable wasn't replaced (e.g. {option_user})
  if (str.startsWith('{') && str.endsWith('}')) {
    return '';
  }

  return str.replace(/[<@!>]/g, '').trim();
}

/**
 * Lấy dữ liệu hồ sơ từ Supabase hoặc Mock
 * @param {string} userId 
 * @param {Object} overrides Tham số ghi đè tùy chọn từ query param hoặc API
 * @returns {Promise<Object>}
 */
export async function getProfileData(userId, overrides = {}) {
  const cleanId = sanitizeUserId(userId);
  let baseProfile = null;

  // 1. Kiểm tra nếu có Supabase client hoạt động
  if (supabase) {
    try {
      const [
        { data: user, error: userErr },
        { data: pet },
        { data: equippedItems, error: equipErr },
        { data: roles },
      ] = await Promise.all([
        supabase.from('users').select('*').eq('user_id', cleanId).single(),
        supabase.from('user_pets').select('*').eq('user_id', cleanId).eq('is_active', true).limit(1).maybeSingle(),
        supabase.from('v_user_equipped_items').select('*').eq('user_id', cleanId),
        supabase.from('user_roles').select('*').eq('user_id', cleanId).eq('is_equipped', true).order('equipped_slot', { ascending: true }),
      ]);

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

        // Biên dịch Equipped Items từ view v_user_equipped_items (Weapon, Gem, Soul)
        const equipment = {
          weapon: null,
          gem: null,
          soul: null,
        };
        let bonusAtk = 0;
        let bonusDef = 0;
        let bonusSpd = 0;
        let bonusHp = 0;

        if (!equipErr && Array.isArray(equippedItems)) {
          for (const item of equippedItems) {
            // Guard: Chỉ ghi nhận các vật phẩm đang thực sự được trang bị vào slot (bỏ qua unequipped item có slot == null)
            if (!item.slot) continue;
            const slotKey = String(item.slot).toLowerCase().trim();
            if (['weapon', 'gem', 'soul'].includes(slotKey)) {
              equipment[slotKey] = {
                item_id: item.item_id,
                item_name: item.item_name,
                item_type: item.item_type,
                slot: slotKey,
                rarity: item.rarity,
                element: item.element,
                bonus_atk: Number(item.bonus_atk) || 0,
                bonus_def: Number(item.bonus_def) || 0,
                bonus_spd: Number(item.bonus_spd) || 0,
                bonus_hp: Number(item.bonus_hp) || 0,
                bonus_crit: Number(item.bonus_crit) || 0,
                hax_skill: item.hax_skill || null,
                hax_description: item.hax_description || null,
                icon: item.icon || (slotKey === 'weapon' ? '⚔️' : slotKey === 'gem' ? '💎' : '🦊'),
              };
              bonusAtk += Number(item.bonus_atk) || 0;
              bonusDef += Number(item.bonus_def) || 0;
              bonusSpd += Number(item.bonus_spd) || 0;
              bonusHp += Number(item.bonus_hp) || 0;
            }
          }
        }

        // Ghép married data & Buff Tiên Lữ
        let marriedData = null;
        if (user.marry_user_id) {
          const mBuffs = computeMarriageBuffs(user.marry_ring_id || 'ring_common', user.marry_date);
          marriedData = {
            user_id: user.marry_user_id,
            username: user.marry_username || `ID: ${user.marry_user_id}`,
            date: user.marry_date,
            date_formatted: mBuffs.date_formatted,
            ring_id: mBuffs.ring_id,
            ring_name: mBuffs.ring_name,
            ring_rarity: mBuffs.ring_rarity,
            days: mBuffs.married_days,
            streak_tier: mBuffs.streak_tier,
            exp_bonus_pct: mBuffs.total_exp_bonus_pct,
            power_bonus_pct: mBuffs.total_power_bonus_pct,
            is_anniversary_day: mBuffs.is_anniversary_day,
          };
        }

        let petData = null;
        if (pet) {
          const catalogPet = PET_BY_TYPE[pet.pet_type] || null;
          const baseAtk = Number(pet.atk) || 0;
          const baseDef = Number(pet.def) || 0;
          const baseSpd = Number(pet.spd) || 0;
          const finalAtk = baseAtk + bonusAtk;
          const finalDef = baseDef + bonusDef;
          const finalSpd = baseSpd + bonusSpd;
          const basePower = Number(pet.power_score) || (baseAtk * 3 + baseDef * 2 + baseSpd * 2 + (pet.level || 1) * 50);
          const bonusPower = (bonusAtk * 3) + (bonusDef * 2) + (bonusSpd * 2) + Math.floor(bonusHp * 0.5);
          const rawTotalPower = basePower + bonusPower;
          const couplePowerPct = marriedData?.power_bonus_pct || 0;
          const couplePowerBonus = couplePowerPct > 0 ? Math.round(rawTotalPower * (couplePowerPct / 100)) : 0;

          petData = {
            name: pet.pet_name,
            type: pet.pet_type,
            pet_type: pet.pet_type,
            rarity: formatRarityLabel(pet.pet_rarity || catalogPet?.rarity || 'Phàm Phẩm'),
            element: pet.element || catalogPet?.element || 'Thổ',
            hax_skill: catalogPet?.hax_skill || pet.hax_skill || null,
            hax_desc: catalogPet?.hax_description || pet.hax_description || null,
            level: Number(pet.level) || 1,
            star: Number(pet.star) || 1,
            atk: finalAtk,
            def: finalDef,
            spd: finalSpd,
            power: rawTotalPower + couplePowerBonus,
            couple_power_bonus_pct: couplePowerPct,
            base_atk: baseAtk,
            base_def: baseDef,
            base_spd: baseSpd,
            bonus_atk: bonusAtk,
            bonus_def: bonusDef,
            bonus_spd: bonusSpd,
            bonus_hp: bonusHp,
            equipment,
            icon: catalogPet?.icon || pet.icon || (pet.pet_type === 'cuu_vi_hong_ho' ? '🦊' : '🐾'),
          };
        } else if (cleanId !== FUYUMI_USER_ID) {
          // Mọi tu sĩ chưa có pet active đều mặc định xuất trận với Pet Phàm Phẩm khởi đầu
          petData = createStarterPetObject();
          petData.equipment = equipment;
        }

        // Lọc bỏ role thuê tạm đã hết hạn
        const nowDate = new Date();
        const validRoles = (roles || []).filter((r) => r.is_permanent || !r.expires_at || new Date(r.expires_at) > nowDate);
        const equippedRoles = validRoles.map(r => ({
          slot: r.equipped_slot,
          role_id: r.role_id,
          name: r.role_name,
          perk: r.role_perk || getRolePerkByName(r.role_name, r.role_id),
          rarity: r.is_permanent ? 'mythic' : 'rare',
        }));

        const userLvlNum = Number(user.level) || 1;
        const roleBuffs = computeRoleBuffTotalsFromList(validRoles.map((r) => r.role_id), userLvlNum);
        if (petData && roleBuffs.petPowerBonusPct > 0) {
          petData.role_power_bonus_pct = roleBuffs.petPowerBonusPct;
          petData.power = Math.round(petData.power * (1 + roleBuffs.petPowerBonusPct / 100));
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
          realm: getRealmByLevel(userLvlNum),
          level: userLvlNum,
          exp: Number(user.exp) || 0,
          next_level_exp: getExpForNextLevel(userLvlNum),
          linh_thach: Number(user.linh_thach) || 0,
          max_role_slots: Number(user.max_role_slots) || 1,
          streak: Number(user.streak) || 0,
          marry_ring_id: marriedData?.ring_id || user.marry_ring_id || null,
          clan: clanData,
          married: marriedData,
          pet: petData,
          equipped_roles: equippedRoles,
          role_pet_power_bonus_pct: roleBuffs.petPowerBonusPct,
          role_buffs: roleBuffs,
        };
      }
    } catch (e) {
      console.warn(`[ProfileService] Supabase query failed for user ${cleanId}:`, e.message);
    }
  }

  // 2. Fallback nếu không có Supabase hoặc chưa tạo user trong DB
  const isMockUser = !baseProfile;
  if (!baseProfile) {
    if (cleanId === '757091869183311872') {
      baseProfile = getFuyumiProfileMock();
    } else {
      baseProfile = getDefaultUserMock(cleanId);
    }
  }

  // 3. Áp dụng các giá trị ghi đè (từ query params như username, avatar, v.v.)
  if (overrides.username) {
    baseProfile.username = overrides.username;
  } else if (overrides.fallback_name && overrides.is_fallback_user) {
    if (isMockUser || !baseProfile.username || baseProfile.username.startsWith('Tu Sĩ ')) {
      baseProfile.username = overrides.fallback_name;
    }
  }

  if (overrides.avatar || overrides.avatar_url) {
    baseProfile.avatar_url = overrides.avatar || overrides.avatar_url;
  } else if (overrides.fallback_avatar && overrides.is_fallback_user) {
    if (isMockUser || !baseProfile.avatar_url || baseProfile.avatar_url === 'assets/default_avatar.png') {
      baseProfile.avatar_url = overrides.fallback_avatar;
    }
  }

  if (overrides.custom_title || overrides.title) baseProfile.custom_title = overrides.custom_title || overrides.title;
  if (overrides.background_url || overrides.bg) baseProfile.background_url = overrides.background_url || overrides.bg;

  return baseProfile;
}
