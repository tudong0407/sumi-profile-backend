import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { renderProfileCard } from '../src/canvas/profileRenderer.js';
import { getProfileData } from '../src/services/profileService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../');

async function testLoadout() {
  console.log('====================================================');
  console.log('🛡️ KIỂM THỬ TÍCH HỢP 3 Ô LOADOUT VÀ ASSETS TRANG BỊ');
  console.log('====================================================\n');

  // 1. Kiểm tra profile của Tiểu thư Fuyumi
  console.log('[Test 1] Lấy dữ liệu profile Fuyumi (757091869183311872)...');
  const fuyumiData = await getProfileData('757091869183311872');

  console.log('Pet:', fuyumiData.pet?.name);
  console.log('Trang bị Vũ khí:', fuyumiData.pet?.equipment?.weapon?.item_name, `(${fuyumiData.pet?.equipment?.weapon?.item_id})`);
  console.log('Trang bị Bảo ngọc:', fuyumiData.pet?.equipment?.gem?.item_name, `(${fuyumiData.pet?.equipment?.gem?.item_id})`);
  console.log('Trang bị Chiến hồn:', fuyumiData.pet?.equipment?.soul?.item_name, `(${fuyumiData.pet?.equipment?.soul?.item_id})`);

  if (!fuyumiData.pet?.equipment?.weapon || !fuyumiData.pet?.equipment?.gem || !fuyumiData.pet?.equipment?.soul) {
    throw new Error('Dữ liệu trang bị của Fuyumi thiếu một trong 3 slot!');
  }

  // 2. Render Profile Card của Fuyumi
  console.log('\n[Test 2] Render thẻ profile Fuyumi với Full Set Thần Thoại...');
  const t0 = Date.now();
  const fuyumiBuf = await renderProfileCard(fuyumiData);
  const dur0 = Date.now() - t0;

  const fuyumiOut = path.join(PROJECT_ROOT, 'test_profile_fuyumi_loadout.png');
  fs.writeFileSync(fuyumiOut, fuyumiBuf);
  console.log(`✅ Render thành công trong ${dur0}ms! File: ${fuyumiOut} (${(fuyumiBuf.length / 1024).toFixed(1)} KB)`);

  // 3. Test Render với Mock Set Tiên Phẩm (Epic) & Linh Phẩm (Rare) & Phàm Phẩm (Common)
  console.log('\n[Test 3] Kiểm thử render linh hoạt các cấp bậc khác (Epic, Rare, Common)...');
  const mockMultiTierProfile = JSON.parse(JSON.stringify(fuyumiData));
  mockMultiTierProfile.username = 'Tiên Tử Thử Nghiệm';
  mockMultiTierProfile.pet.equipment = {
    weapon: {
      item_id: 'weapon_epic_4',
      item_name: 'Thái Hư Trảm Tiên Kiếm',
      rarity: 'Tien Pham',
      element: 'Kim',
      bonus_atk: 650,
      icon: '⚔️'
    },
    gem: {
      item_id: 'gem_rare_2',
      item_name: 'Phù Dung Lưu Ly Bảo Ngọc',
      rarity: 'Linh Pham',
      element: 'Moc',
      bonus_def: 280,
      bonus_hp: 1800,
      icon: '🌸'
    },
    soul: {
      item_id: 'soul_common_3',
      item_name: 'Linh Hồ Ấu Hồn',
      rarity: 'Pham Pham',
      element: 'Quang',
      bonus_atk: 40,
      bonus_spd: 70,
      icon: '🐾'
    }
  };

  const t1 = Date.now();
  const multiTierBuf = await renderProfileCard(mockMultiTierProfile);
  const dur1 = Date.now() - t1;

  const multiTierOut = path.join(PROJECT_ROOT, 'test_profile_multitier_loadout.png');
  fs.writeFileSync(multiTierOut, multiTierBuf);
  console.log(`✅ Render thành công thẻ Multi-tier trong ${dur1}ms! File: ${multiTierOut} (${(multiTierBuf.length / 1024).toFixed(1)} KB)`);

  console.log('\n====================================================');
  console.log('🎉 TẤT CẢ CÁC BÀI TEST LOADOUT ĐỀU ĐẠT CHUẨN 100%!');
  console.log('====================================================');
}

testLoadout().catch(err => {
  console.error('❌ Lỗi kiểm thử loadout:', err);
  process.exit(1);
});
