import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { renderProfileCard } from './src/canvas/profileRenderer.js';
import { getProfileData } from './src/services/profileService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runTests() {
  console.log('====================================================');
  console.log('🌸 KHỞI ĐỘNG KIỂM THỬ PROFILE CANVAS BACKEND (V8.6)');
  console.log('====================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  // Helper kiểm tra PNG Header (Magic number: 89 50 4E 47 0D 0A 1A 0A)
  function isValidPng(buffer) {
    if (!buffer || buffer.length < 8) return false;
    const pngMagic = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
    return pngMagic.every((byte, idx) => buffer[idx] === byte);
  }

  // TEST 1: Render Thẻ Profile của Cửu Vĩ Tiên Chủ Fuyumi (757091869183311872)
  totalTests++;
  try {
    console.log('[Test 1] Đang lấy dữ liệu và render profile của Tiểu thư Fuyumi (757091869183311872)...');
    const fuyumiData = await getProfileData('757091869183311872');
    
    const startTime = Date.now();
    const buffer = await renderProfileCard(fuyumiData);
    const duration = Date.now() - startTime;

    if (!isValidPng(buffer)) {
      throw new Error('Dữ liệu kết xuất không phải là PNG hợp lệ!');
    }

    const outputPath = path.join(__dirname, 'test_profile_fuyumi.png');
    fs.writeFileSync(outputPath, buffer);

    console.log(`✅ [Test 1 ĐẠT] Render thành công thẻ Fuyumi trong ${duration}ms!`);
    console.log(`   Kích thước file: ${(buffer.length / 1024).toFixed(2)} KB`);
    console.log(`   Linh thú: ${fuyumiData.pet.name} (Hệ: ${fuyumiData.pet.element}, HAX: ${fuyumiData.pet.hax_skill})`);
    console.log(`   Số Role trang bị: ${fuyumiData.equipped_roles.length} slots`);
    console.log(`   Đã lưu tại: ${outputPath}`);
    passedTests++;
  } catch (err) {
    console.error('❌ [Test 1 THẤT BẠI]:', err);
  }

  // TEST 2: Render Thẻ Profile Thành Viên Mặc Định (Tu Sĩ Thường)
  totalTests++;
  try {
    console.log('\n[Test 2] Đang render profile Tu Sĩ Mặc Định (ID: 999888777666555444)...');
    const defaultData = await getProfileData('999888777666555444');
    
    const startTime = Date.now();
    const buffer = await renderProfileCard(defaultData);
    const duration = Date.now() - startTime;

    if (!isValidPng(buffer)) {
      throw new Error('Dữ liệu kết xuất không phải là PNG hợp lệ!');
    }

    const outputPath = path.join(__dirname, 'test_profile_default.png');
    fs.writeFileSync(outputPath, buffer);

    console.log(`✅ [Test 2 ĐẠT] Render thành công thẻ mặc định trong ${duration}ms!`);
    console.log(`   Kích thước file: ${(buffer.length / 1024).toFixed(2)} KB`);
    console.log(`   Linh thú: ${defaultData.pet.name} (Hệ: ${defaultData.pet.element}, HAX: ${defaultData.pet.hax_skill})`);
    console.log(`   Đã lưu tại: ${outputPath}`);
    passedTests++;
  } catch (err) {
    console.error('❌ [Test 2 THẤT BẠI]:', err);
  }

  // TEST 3: Kiểm thử Edge Cases (Dữ liệu rỗng, số cực lớn, chuỗi cực dài)
  totalTests++;
  try {
    console.log('\n[Test 3] Kiểm thử Edge Cases (Null values, extreme numbers, long unicode)...');
    const edgeData = {
      user_id: '111111111111111111',
      username: '🦊 Tu Sĩ Có Tên Vô Cùng Dài Vượt Quá Giới Hạn Khung Thẻ Profile 🌸⚡💎',
      custom_title: 'Đại Năng Tối Thượng Của Vạn Giới Không Gian Đa Chiều',
      realm: 'VII. Hỗn Độn Chúa Tể',
      level: 999,
      exp: 999999999999,
      next_level_exp: 1000000000000,
      linh_thach: 888888888888,
      max_role_slots: 5,
      clan: null,
      married: null,
      pet: null,
      equipped_roles: [],
    };

    const startTime = Date.now();
    const buffer = await renderProfileCard(edgeData);
    const duration = Date.now() - startTime;

    if (!isValidPng(buffer)) {
      throw new Error('Edge case render không tạo ra PNG hợp lệ!');
    }

    const outputPath = path.join(__dirname, 'test_profile_edge_case.png');
    fs.writeFileSync(outputPath, buffer);

    console.log(`✅ [Test 3 ĐẠT] Xử lý mượt mà Edge Cases trong ${duration}ms!`);
    console.log(`   Kích thước file: ${(buffer.length / 1024).toFixed(2)} KB`);
    console.log(`   Đã lưu tại: ${outputPath}`);
    passedTests++;
  } catch (err) {
    console.error('❌ [Test 3 THẤT BẠI]:', err);
  }

  // TEST 4: Tải ảnh từ URL không hợp lệ (Kiểm tra timeout & fallback không gây crash)
  totalTests++;
  try {
    console.log('\n[Test 4] Kiểm thử Fallback an toàn khi URL ảnh bị lỗi 404 / timeout...');
    const failData = {
      user_id: '999999',
      username: 'Tu Sĩ Mạng Yếu',
      avatar_url: 'http://127.0.0.1:59999/non_existent_avatar.png', // URL không thể kết nối
      background_url: 'http://127.0.0.1:59999/non_existent_bg.png',
      level: 10,
    };

    const startTime = Date.now();
    const buffer = await renderProfileCard(failData);
    const duration = Date.now() - startTime;

    if (!isValidPng(buffer)) {
      throw new Error('Fallback render không tạo ra PNG hợp lệ!');
    }

    console.log(`✅ [Test 4 ĐẠT] Fallback an toàn hoàn tất trong ${duration}ms!`);
    passedTests++;
  } catch (err) {
    console.error('❌ [Test 4 THẤT BẠI]:', err);
  }

  console.log('\n====================================================');
  console.log(`KẾT QUẢ KIỂM THỬ: ${passedTests}/${totalTests} BÀI TEST THÀNH CÔNG 🎉`);
  console.log('====================================================');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runTests();
