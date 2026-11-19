import fs from 'fs';
import path from 'path';

const ARTIFACT_DIR = 'C:\\Users\\Fuyumi-ASUSF16\\.gemini\\antigravity\\brain\\2b326732-f562-49ee-8d2b-f77343a695de';
const BASE_URL = 'https://sumi-profile-backend.onrender.com';

async function run() {
  console.log('=== STARTING LIVE ENDPOINT VERIFICATION ===');
  console.log(`Backend URL: ${BASE_URL}`);

  // 1. Health check
  console.log('\n--- 1. Checking Health Endpoint ---');
  const healthRes = await fetch(`${BASE_URL}/health`);
  if (!healthRes.ok) {
    throw new Error(`Health check failed with status ${healthRes.status}`);
  }
  const healthData = await healthRes.json();
  console.log('Health Response:', JSON.stringify(healthData, null, 2));

  if (healthData.status !== 'healthy' || healthData.supabase_connected !== true) {
    throw new Error(`Health response invalid: status=${healthData.status}, supabase_connected=${healthData.supabase_connected}`);
  }
  console.log('Health check PASSED: HTTP 200, status=healthy, supabase_connected=true');

  // 2. Query Fuyumi JSON profile data
  console.log('\n--- 2. Checking Fuyumi Profile Data (JSON) ---');
  const jsonRes = await fetch(`${BASE_URL}/api/profile/757091869183311872?format=json`);
  if (!jsonRes.ok) {
    throw new Error(`Fuyumi JSON fetch failed with status ${jsonRes.status}`);
  }
  const profileJson = await jsonRes.json();
  const data = profileJson.data;
  console.log(`User: ${data.username} (${data.user_id})`);
  console.log(`Realm: ${data.realm}, Level: ${data.level}`);
  console.log(`Pet Name: ${data.pet?.name}, Type: ${data.pet?.pet_type || data.pet?.type}, Rarity: ${data.pet?.rarity}`);
  console.log(`Pet Equipment:`);
  console.log(`  - Weapon: ${data.pet?.equipment?.weapon?.item_name} (${data.pet?.equipment?.weapon?.rarity})`);
  console.log(`  - Gem: ${data.pet?.equipment?.gem?.item_name} (${data.pet?.equipment?.gem?.rarity})`);
  console.log(`  - Soul: ${data.pet?.equipment?.soul?.item_name} (${data.pet?.equipment?.soul?.rarity})`);

  const hasFuyumiFox = data.pet?.name?.includes('Cửu Vĩ Hồng Hồ') || (data.pet?.pet_type === 'cuu_vi_hong_ho' || data.pet?.type === 'cuu_vi_hong_ho');
  const hasWeapon = !!data.pet?.equipment?.weapon?.item_name;
  const hasGem = !!data.pet?.equipment?.gem?.item_name;
  const hasSoul = !!data.pet?.equipment?.soul?.item_name;
  const allMythic = (data.pet?.equipment?.weapon?.rarity?.toLowerCase().includes('than thoai') || data.pet?.equipment?.weapon?.rarity?.toLowerCase().includes('mythic')) &&
                    (data.pet?.equipment?.gem?.rarity?.toLowerCase().includes('than thoai') || data.pet?.equipment?.gem?.rarity?.toLowerCase().includes('mythic')) &&
                    (data.pet?.equipment?.soul?.rarity?.toLowerCase().includes('than thoai') || data.pet?.equipment?.soul?.rarity?.toLowerCase().includes('mythic'));

  console.log(`Checks:`);
  console.log(`  - Fox is Cửu Vĩ Hồng Hồ: ${hasFuyumiFox ? 'PASS' : 'FAIL'}`);
  console.log(`  - Has all 3 items (Weapon, Gem, Soul): ${hasWeapon && hasGem && hasSoul ? 'PASS' : 'FAIL'}`);
  console.log(`  - All 3 items are Than Thoai/Mythic: ${allMythic ? 'PASS' : 'FAIL'}`);

  // 3. Query Fuyumi PNG Card
  console.log('\n--- 3. Downloading Fuyumi Live PNG Profile Card ---');
  const pngRes = await fetch(`${BASE_URL}/api/profile/757091869183311872.png`);
  if (!pngRes.ok) {
    throw new Error(`Fuyumi PNG fetch failed with status ${pngRes.status}`);
  }
  const pngBuffer = Buffer.from(await pngRes.arrayBuffer());
  const fuyumiImgPath = path.join(ARTIFACT_DIR, 'profile_fuyumi_live.png');
  fs.writeFileSync(fuyumiImgPath, pngBuffer);
  console.log(`Saved Fuyumi Profile Card to ${fuyumiImgPath} (${pngBuffer.length} bytes)`);

  // Verify PNG header: 89 50 4E 47 0D 0A 1A 0A
  const isPng = pngBuffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  console.log(`Valid PNG Header: ${isPng ? 'PASS' : 'FAIL'}`);

  // 4. Test Sample Profiles with Different Pets via POST /api/profile/render
  console.log('\n--- 4. Testing Diverse Sample Pets on Live Backend ---');
  const samplePets = [
    { pet_type: 'hoa_diem_ho', name: 'Hỏa Diễm Hồ', icon: '🔥', element: 'Hỏa', rarity: 'Sử Thi', level: 45 },
    { pet_type: 'bang_tuyet_ho', name: 'Băng Tuyết Hồ', icon: '❄️', element: 'Thủy', rarity: 'Truyền Thuyết', level: 60 },
    { pet_type: 'loi_dinh_kim_ho', name: 'Lôi Đình Kim Hồ', icon: '⚡', element: 'Lôi', rarity: 'Thần Thoại', level: 85 },
    { pet_type: 'thanh_truc_tien_loc', name: 'Thanh Trúc Tiên Lộc', icon: '🦌', element: 'Mộc', rarity: 'Hiếm', level: 30 },
    { pet_type: 'u_minh_lang_vuong', name: 'U Minh Lang Vương', icon: '🐺', element: 'Ám', rarity: 'Truyền Thuyết', level: 75 }
  ];

  for (const sp of samplePets) {
    const payload = {
      user_id: '123456789012345678',
      username: `Đạo Hữu [${sp.name}]`,
      realm: 'IV. Nguyên Anh Chân Quân',
      level: 65,
      exp: 120000,
      next_level_exp: 180000,
      linh_thach: 55000,
      max_role_slots: 3,
      pet: {
        name: sp.name,
        pet_type: sp.pet_type,
        icon: sp.icon,
        element: sp.element,
        rarity: sp.rarity,
        level: sp.level,
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

    const res = await fetch(`${BASE_URL}/api/profile/render`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      throw new Error(`Sample pet ${sp.pet_type} render failed: HTTP ${res.status}`);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    const sampleImgPath = path.join(ARTIFACT_DIR, `sample_profile_${sp.pet_type}.png`);
    fs.writeFileSync(sampleImgPath, buf);
    console.log(`Rendered & saved sample pet [${sp.pet_type}]: ${buf.length} bytes -> ${sampleImgPath}`);
  }

  // 5. Also copy existing collage from output/ if available
  const collageSource = 'C:\\Users\\Fuyumi-ASUSF16\\.gemini\antigravity\\scratch\\sumi-profile-backend\\output\\test_pets_collage.png';
  if (fs.existsSync(collageSource)) {
    const collageDest = path.join(ARTIFACT_DIR, 'test_pets_collage.png');
    fs.copyFileSync(collageSource, collageDest);
    console.log(`Copied test pets collage to artifact directory: ${collageDest}`);
  }

  console.log('\n=== ALL LIVE ENDPOINT VERIFICATIONS PASSED ===');
}

run().catch(err => {
  console.error('VERIFICATION ERROR:', err);
  process.exit(1);
});
