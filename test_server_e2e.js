import http from 'http';
import app from './src/server.js';

const PORT = 3456;

function isValidPng(buffer) {
  if (!buffer || buffer.length < 8) return false;
  const pngMagic = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
  return pngMagic.every((byte, idx) => buffer[idx] === byte);
}

async function runE2ETests() {
  console.log('====================================================');
  console.log('🌐 KIỂM THỬ TÍCH HỢP HTTP SERVER E2E (EXPRESS)');
  console.log('====================================================\n');

  const server = http.createServer(app);
  await new Promise(resolve => server.listen(PORT, resolve));
  console.log(`[E2E] Server test đã lắng nghe trên port ${PORT}`);

  let passed = 0;
  let total = 0;

  try {
    // TEST 1: Root endpoint GET /
    total++;
    console.log('[Test 1] Kiểm tra GET / (API Info)...');
    const resRoot = await fetch(`http://localhost:${PORT}/`);
    const rootJson = await resRoot.json();
    if (resRoot.status === 200 && rootJson.service && rootJson.endpoints) {
      console.log('✅ [Test 1 ĐẠT] GET / phản hồi danh mục endpoints chuẩn xác');
      passed++;
    } else {
      throw new Error(`GET / thất bại: HTTP ${resRoot.status}`);
    }

    // TEST 2: Health check endpoint GET /health
    total++;
    console.log('\n[Test 2] Kiểm tra GET /health...');
    const resHealth = await fetch(`http://localhost:${PORT}/health`);
    const healthJson = await resHealth.json();
    if (resHealth.status === 200 && healthJson.status === 'healthy') {
      console.log('✅ [Test 2 ĐẠT] /health phản hồi 200 OK:', healthJson.service);
      passed++;
    } else {
      throw new Error(`Health check thất bại: HTTP ${resHealth.status}`);
    }

    // TEST 3: GET Profile PNG trực tiếp
    total++;
    console.log('\n[Test 3] Kiểm tra GET /api/profile/757091869183311872 (PNG)...');
    const resPng = await fetch(`http://localhost:${PORT}/api/profile/757091869183311872`);
    const contentType = resPng.headers.get('content-type');
    const buffer = Buffer.from(await resPng.arrayBuffer());

    if (resPng.status === 200 && contentType?.includes('image/png') && isValidPng(buffer)) {
      console.log(`✅ [Test 3 ĐẠT] Trả về Content-Type: ${contentType}, kích thước: ${(buffer.length / 1024).toFixed(2)} KB`);
      passed++;
    } else {
      throw new Error(`Profile PNG thất bại: HTTP ${resPng.status}, content-type: ${contentType}`);
    }

    // TEST 4: GET Profile với đuôi .png (Discord bot / Webhook format)
    total++;
    console.log('\n[Test 4] Kiểm tra GET /api/profile/757091869183311872.png (Đuôi mở rộng)...');
    const resExtPng = await fetch(`http://localhost:${PORT}/api/profile/757091869183311872.png`);
    const extContentType = resExtPng.headers.get('content-type');
    const extBuffer = Buffer.from(await resExtPng.arrayBuffer());

    if (resExtPng.status === 200 && extContentType?.includes('image/png') && isValidPng(extBuffer)) {
      console.log(`✅ [Test 4 ĐẠT] Phân giải đuôi .png chính xác thành user Fuyumi!`);
      passed++;
    } else {
      throw new Error(`Profile .png thất bại: HTTP ${resExtPng.status}`);
    }

    // TEST 5: GET Profile JSON format
    total++;
    console.log('\n[Test 5] Kiểm tra GET /api/profile/757091869183311872?format=json...');
    const resJson = await fetch(`http://localhost:${PORT}/api/profile/757091869183311872?format=json`);
    const profileJson = await resJson.json();

    if (resJson.status === 200 && profileJson.success && profileJson.data?.user_id === '757091869183311872') {
      console.log('✅ [Test 5 ĐẠT] Trả về JSON profile chính xác cho Fuyumi:', profileJson.data.username);
      console.log(`   Linh thú: ${profileJson.data.pet?.name} (Hệ: ${profileJson.data.pet?.element})`);
      passed++;
    } else {
      throw new Error(`Profile JSON thất bại: ${JSON.stringify(profileJson)}`);
    }

    // TEST 6: GET Profile với Query Overrides (cho BotGhost Custom Events)
    total++;
    console.log('\n[Test 6] Kiểm tra GET /api/profile/999888?format=json&username=TuSĩGhost&title=BáchChiến...');
    const resOverride = await fetch(`http://localhost:${PORT}/api/profile/999888?format=json&username=TuS%C4%A9Ghost&title=B%C3%A1chChi%E1%BA%BFn`);
    const overrideJson = await resOverride.json();

    if (resOverride.status === 200 && overrideJson.data?.username === 'TuSĩGhost' && overrideJson.data?.custom_title === 'BáchChiến') {
      console.log('✅ [Test 6 ĐẠT] Ghi đè tham số từ Query String thành công:', overrideJson.data.username);
      passed++;
    } else {
      throw new Error(`Override thất bại: ${JSON.stringify(overrideJson)}`);
    }

    // TEST 7: POST /api/profile/render (Custom payload)
    total++;
    console.log('\n[Test 7] Kiểm tra POST /api/profile/render (Payload tùy biến)...');
    const customPayload = {
      user_id: '8888888888',
      username: 'Thử Nghiệm Custom 🦊',
      level: 42,
      exp: 15000,
      next_level_exp: 25000,
      linh_thach: 9999,
      max_role_slots: 3,
      pet: {
        name: 'Hỏa Diễm Hồ',
        rarity: 'Cực Phẩm',
        element: 'Hỏa',
        hax_skill: 'Thiêu Hồn',
        hax_desc: 'Bỏ qua 50% giáp',
        level: 25,
        star: 4,
        power: 45000,
        atk: 5000,
        def: 3000,
        spd: 4000,
        icon: '🔥',
      },
      equipped_roles: [
        { slot: 1, name: '« Hỏa Diễm Chân Nhân »', perk: '🔥 Hỏa Ngục Trảm' },
        { slot: 2, name: '« Phong Thanh Hộ Pháp »', perk: '🎙️ Di Chuyển Voice' },
      ],
    };

    const resCustom = await fetch(`http://localhost:${PORT}/api/profile/render`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(customPayload),
    });
    const customBuffer = Buffer.from(await resCustom.arrayBuffer());

    if (resCustom.status === 200 && isValidPng(customBuffer)) {
      console.log(`✅ [Test 7 ĐẠT] Render thành công từ payload tùy biến, kích thước: ${(customBuffer.length / 1024).toFixed(2)} KB`);
      passed++;
    } else {
      throw new Error(`POST /render thất bại: HTTP ${resCustom.status}`);
    }

    // TEST 8: GET /api/rank/757091869183311872.png (Thẻ Rank Mini PNG)
    total++;
    console.log('\n[Test 8] Kiểm tra GET /api/rank/757091869183311872.png (Rank Mini PNG)...');
    const resRankPng = await fetch(`http://localhost:${PORT}/api/rank/757091869183311872.png`);
    const rankContentType = resRankPng.headers.get('content-type');
    const rankBuffer = Buffer.from(await resRankPng.arrayBuffer());

    if (resRankPng.status === 200 && rankContentType?.includes('image/png') && isValidPng(rankBuffer)) {
      console.log(`✅ [Test 8 ĐẠT] Thẻ Rank Mini PNG trả về Content-Type: ${rankContentType}, kích thước: ${(rankBuffer.length / 1024).toFixed(2)} KB`);
      passed++;
    } else {
      throw new Error(`Rank Mini PNG thất bại: HTTP ${resRankPng.status}`);
    }

    // TEST 9: GET /api/rank/757091869183311872?format=json (Rank Mini JSON)
    total++;
    console.log('\n[Test 9] Kiểm tra GET /api/rank/757091869183311872?format=json...');
    const resRankJson = await fetch(`http://localhost:${PORT}/api/rank/757091869183311872?format=json`);
    const rankJson = await resRankJson.json();

    if (resRankJson.status === 200 && rankJson.success && rankJson.data?.user_id === '757091869183311872') {
      console.log('✅ [Test 9 ĐẠT] Trả về JSON Rank Mini chính xác cho Fuyumi: Lv.' + rankJson.data.level);
      passed++;
    } else {
      throw new Error(`Rank Mini JSON thất bại: ${JSON.stringify(rankJson)}`);
    }

    // TEST 10: POST /api/rank/render (Render Rank tùy biến)
    total++;
    console.log('\n[Test 10] Kiểm tra POST /api/rank/render (Payload Rank tùy biến)...');
    const resCustomRank = await fetch(`http://localhost:${PORT}/api/rank/render`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: '111222333',
        username: 'Đạo Sĩ Luyện Khí',
        level: 15,
        exp: 3400,
        next_level_exp: 5000,
        realm: 'I. Luyện Khí Hậu Kỳ',
        custom_title: 'Tu Chân Giả',
        linh_thach: 1250,
      }),
    });
    const customRankBuffer = Buffer.from(await resCustomRank.arrayBuffer());

    if (resCustomRank.status === 200 && isValidPng(customRankBuffer)) {
      console.log(`✅ [Test 10 ĐẠT] Render thành công Thẻ Rank từ payload tùy biến, kích thước: ${(customRankBuffer.length / 1024).toFixed(2)} KB`);
      passed++;
    } else {
      throw new Error(`POST /api/rank/render thất bại: HTTP ${resCustomRank.status}`);
    }

  } finally {
    server.close();
    console.log('\n[E2E] Đã đóng test server');
  }

  console.log('====================================================');
  console.log(`KẾT QUẢ E2E: ${passed}/${total} BÀI KIỂM THỬ THÀNH CÔNG 🎉`);
  console.log('====================================================');

  if (passed !== total) {
    process.exit(1);
  }
}

runE2ETests();
