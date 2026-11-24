/**
 * Standard test fixtures for SuMi Profile & Battle Backend test suite.
 */

export const FIXTURE_USERS = {
  fuyumi: {
    userId: '757091869183311872',
    username: 'Fuyumi 🌸',
    isStaff: true,
    staffRolePos: 141, // >= 137 cutoff
    roleName: '« 100 • Hỗn Độn Chúa Tể »',
    level: 100,
    realm: 'VII. Hỗn Độn Chúa Tể',
    linhThach: 999999,
    pet: {
      name: 'Cửu Vĩ Hồng Hồ',
      type: 'cuu_vi_hong_ho',
      rarity: 'Tối Thượng Thần Thoại',
      element: 'Hỗn Độn',
      hax_skill: 'Cửu Vĩ Hộ Thể (HAX Bất Tử)',
      level: 99,
      star: 10,
      atk: 101069,
      def: 101049,
      spd: 100949,
      power: 10009709,
    },
    equipment: {
      weaponId: 'weapon_mythic_1',
      gemId: 'gem_mythic_3',
      soulId: 'soul_mythic_1',
    },
  },

  hanabiraMei: {
    userId: '1429509324845092875', // Discord live ID (pos=124, « Chấp Pháp Linh Hồ »)
    discordLiveId: '1429509324845092875',
    legacyId: '1172824949774360636',
    aliasIds: ['1429509324845092875', '1172824949774360636', '1319208351543660565'],
    username: 'Hanabira Mei',
    isStaff: false,
    staffRolePos: 124, // < 137 cutoff (« Chấp Pháp Linh Hồ »)
    roleName: '« Chấp Pháp Linh Hồ »',
    level: 1,
    realm: 'I. Luyện Khí Sơ Kỳ',
    linhThach: 0,
    pet: {
      name: 'Hóa Thạch Nham Nham Thú',
      type: 'hoa_thach_nham_nham',
      rarity: 'Phàm Phẩm',
      element: 'Thổ',
      level: 1,
      star: 1,
      atk: 120,
      def: 180,
      spd: 100,
      power: 970,
    },
  },

  defaultUser: {
    userId: '123456789012345678',
    username: 'Tu Sĩ #5678',
    level: 1,
    realm: 'I. Luyện Khí Sơ Kỳ',
    linhThach: 0,
  },
};

export const MOCK_ITEMS = {
  weaponMythic: {
    item_id: 'weapon_mythic_1',
    item_name: '« Tru Tiên Diệt Thần Kiếm »',
    item_type: 'weapon',
    slot: 'weapon',
    rarity: 'Than Thoai',
    element: 'Hỗn Độn',
    bonus_atk: 720,
    bonus_def: 0,
    bonus_spd: 300,
    bonus_hp: 0,
    bonus_crit: 18,
    hax_skill: 'Tuyệt Diệt Bất Tử',
    hax_description: 'Đòn đánh xuyên qua 100% khiên chắn và vô hiệu hóa hoàn toàn cơ chế Bất Tử / Trùng Sinh của đối phương trong 3 lượt đầu!',
    icon: '⚔️',
  },
  gemMythic: {
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
  soulMythic: {
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
  weaponEpic: {
    item_id: 'weapon_epic_1',
    item_name: '« Thanh Vân Kiếm »',
    item_type: 'weapon',
    slot: 'weapon',
    rarity: 'Cực Phẩm',
    element: 'Phong',
    bonus_atk: 180,
    bonus_def: 0,
    bonus_spd: 50,
    bonus_hp: 0,
    bonus_crit: 5,
    icon: '⚔️',
  },
};

export const BATTLE_FIXTURES = {
  validBattlePayload: {
    attackerId: '757091869183311872',
    defenderId: '1429509324845092875', // Discord live ID
    options: {
      maxTurns: 30,
    },
  },
  elementalClash: {
    attackerElement: 'Kim',
    defenderElement: 'Moc',
    advantageMultiplier: 1.3,
  },
};

export const EXPECTED_WIKI_CATEGORIES = [
  'overview',
  'realms',
  'battle',
  'equipment',
  'pets',
  'economy',
];
