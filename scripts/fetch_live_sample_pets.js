import fs from 'fs';
import path from 'path';

const ARTIFACT_DIR = 'C:\\Users\\Fuyumi-ASUSF16\\.gemini\\antigravity\\brain\\2b326732-f562-49ee-8d2b-f77343a695de';
const BASE_URL = 'https://sumi-profile-backend.onrender.com';

const testPets = [
  { pet_type: 'hoa_diem_ho', name: 'Hỏa Diễm Hồ', icon: '🔥', element: 'Hỏa', rarity: 'Sử Thi', level: 45 },
  { pet_type: 'bang_tuyet_ho', name: 'Băng Tuyết Hồ', icon: '❄️', element: 'Thủy', rarity: 'Truyền Thuyết', level: 60 },
  { pet_type: 'loi_dinh_kim_ho', name: 'Lôi Đình Kim Hồ', icon: '⚡', element: 'Lôi', rarity: 'Thần Thoại', level: 85 },
  { pet_type: 'thanh_truc_tien_loc', name: 'Thanh Trúc Tiên Lộc', icon: '🦌', element: 'Mộc', rarity: 'Hiếm', level: 30 },
  { pet_type: 'u_minh_lang_vuong', name: 'U Minh Lang Vương', icon: '🐺', element: 'Ám', rarity: 'Truyền Thuyết', level: 75 }
];

async function main() {
  console.log('Fetching live profile cards with different pets from:', BASE_URL);

  for (const pet of testPets) {
    const payload = {
      user_id: '123456789012345678',
      username: `Đạo Hữu [${pet.name}]`,
      custom_title: 'Tu Sĩ Tiên Giới',
      realm: 'IV. Nguyên Anh Chân Quân',
      level: 65,
      exp: 120000,
      next_level_exp: 180000,
      linh_thach: 55000,
      max_role_slots: 3,
      pet: {
        name: pet.name,
        pet_type: pet.pet_type,
        icon: pet.icon,
        element: pet.element,
        rarity: pet.rarity,
        level: pet.level,
        atk: 2500,
        def: 1800,
        spd: 1200,
        hax_skill: 'Thiên Phú Thần Thú',
        equipment: {
          weapon: { item_name: '« Bích Huyết Kiếm »', rarity: 'Hiem', icon: '⚔️', bonus_atk: 150 },
          gem: { item_name: '« Linh Bích Ngọc »', rarity: 'Hiem', icon: '💎', bonus_def: 120 }
        }
      },
      equipped_roles: [
        { slot: 1, name: '« Huyền Thiên Hồ Sứ »', perk: '🛡️ Kháng Timeout & Hộ Thể', rarity: 'mythic' },
        { slot: 2, name: '« Chấp Pháp Linh Hồ »', perk: '⚡ Miễn Chờ Chat Chậm', rarity: 'rare' }
      ]
    };

    const res = await fetch(`${BASE_URL}/api/profile/render?t=${Date.now()}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      console.error(`Failed to render ${pet.pet_type}: HTTP ${res.status}`);
      continue;
    }

    const buf = Buffer.from(await res.arrayBuffer());
    const outPath = path.join(ARTIFACT_DIR, `live_sample_${pet.pet_type}.png`);
    fs.writeFileSync(outPath, buf);
    console.log(`Saved live card for [${pet.pet_type}]: ${buf.length} bytes -> ${outPath}`);
  }
}

main().catch(console.error);
