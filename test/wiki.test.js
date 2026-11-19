/**
 * test/wiki.test.js
 * Bộ 14 bài kiểm thử tích hợp HTTP E2E cho endpoint GET /api/wiki
 * Bản quyền: 🦊𝗦𝘂𝗠𝗶 𝗙𝗮𝗺𝗶𝗹𝘆 (1026096141273661450)
 */

import http from 'http';
import app from '../src/server.js';
import { VALID_CATEGORIES } from '../src/services/wikiService.js';

const PORT = 3458;

async function runWikiTests() {
  console.log('====================================================');
  console.log('🦊 KIỂM THỬ TÍCH HỢP WIKI API E2E (14 TEST CASES)');
  console.log('====================================================\n');

  const server = http.createServer(app);
  await new Promise(resolve => server.listen(PORT, resolve));
  console.log(`[Wiki Test] Test server đang lắng nghe tại http://localhost:${PORT}`);

  let passed = 0;
  let total = 0;

  try {
    // TEST 1: Root endpoint GET / chứa catalog wiki
    total++;
    console.log('\n[Test 1] Kiểm tra GET / (Root Catalog có endpoint wiki)...');
    const res1 = await fetch(`http://localhost:${PORT}/`);
    const json1 = await res1.json();
    if (res1.status === 200 && json1.endpoints && json1.endpoints.wiki) {
      console.log('✅ [Test 1 ĐẠT] Root catalog chứa endpoint wiki:', json1.endpoints.wiki);
      passed++;
    } else {
      throw new Error(`[Test 1] Thất bại: status=${res1.status}, endpoints.wiki=${json1.endpoints?.wiki}`);
    }

    // TEST 2: GET /api/wiki mặc định trả về 5 chuyên mục
    total++;
    console.log('\n[Test 2] Kiểm tra GET /api/wiki (Mặc định)...');
    const res2 = await fetch(`http://localhost:${PORT}/api/wiki`);
    const json2 = await res2.json();
    if (
      res2.status === 200 &&
      json2.success === true &&
      Array.isArray(json2.categories) &&
      json2.categories.length === 5 &&
      json2.total_categories === 5
    ) {
      console.log('✅ [Test 2 ĐẠT] GET /api/wiki trả về đủ 5 chuyên mục tu tiên');
      passed++;
    } else {
      throw new Error(`[Test 2] Thất bại: status=${res2.status}, categories count=${json2.categories?.length}`);
    }

    // TEST 3: GET /api/wiki?category=all
    total++;
    console.log('\n[Test 3] Kiểm tra GET /api/wiki?category=all...');
    const res3 = await fetch(`http://localhost:${PORT}/api/wiki?category=all`);
    const json3 = await res3.json();
    if (res3.status === 200 && json3.success === true && json3.categories.length === 5) {
      console.log('✅ [Test 3 ĐẠT] Query category=all trả về đầy đủ 5 chuyên mục');
      passed++;
    } else {
      throw new Error(`[Test 3] Thất bại: status=${res3.status}`);
    }

    // TEST 4: GET /api/wiki?category=beginner
    total++;
    console.log('\n[Test 4] Kiểm tra GET /api/wiki?category=beginner...');
    const res4 = await fetch(`http://localhost:${PORT}/api/wiki?category=beginner`);
    const json4 = await res4.json();
    if (
      res4.status === 200 &&
      json4.success === true &&
      json4.category === 'beginner' &&
      json4.data.id === 'beginner' &&
      json4.data.title.includes('Khởi Đầu') &&
      json4.data.sections.length >= 3
    ) {
      console.log('✅ [Test 4 ĐẠT] Chuyên mục beginner trả về đúng cấu trúc và nội dung cảnh giới');
      passed++;
    } else {
      throw new Error(`[Test 4] Thất bại: status=${res4.status}, data=${JSON.stringify(json4.data)}`);
    }

    // TEST 5: GET /api/wiki?category=pets
    total++;
    console.log('\n[Test 5] Kiểm tra GET /api/wiki?category=pets...');
    const res5 = await fetch(`http://localhost:${PORT}/api/wiki?category=pets`);
    const json5 = await res5.json();
    if (
      res5.status === 200 &&
      json5.success === true &&
      json5.category === 'pets' &&
      json5.data.id === 'pets' &&
      json5.data.title.includes('Linh Thú') &&
      json5.data.fields.some(f => f.value.includes('Cửu Vĩ Hồng Hồ'))
    ) {
      console.log('✅ [Test 5 ĐẠT] Chuyên mục pets trả về đúng linh thú và kỹ năng HAX');
      passed++;
    } else {
      throw new Error(`[Test 5] Thất bại: status=${res5.status}`);
    }

    // TEST 6: GET /api/wiki?category=equipment
    total++;
    console.log('\n[Test 6] Kiểm tra GET /api/wiki?category=equipment...');
    const res6 = await fetch(`http://localhost:${PORT}/api/wiki?category=equipment`);
    const json6 = await res6.json();
    if (
      res6.status === 200 &&
      json6.success === true &&
      json6.category === 'equipment' &&
      json6.data.id === 'equipment' &&
      json6.data.title.includes('45 Món Trang Bị') &&
      json6.data.fields.some(f => f.value.includes('Tru Tiên Diệt Thần Kiếm'))
    ) {
      console.log('✅ [Test 6 ĐẠT] Chuyên mục equipment trả về 45 trang bị & 9 HAX Thần Thoại');
      passed++;
    } else {
      throw new Error(`[Test 6] Thất bại: status=${res6.status}`);
    }

    // TEST 7: GET /api/wiki?category=battle
    total++;
    console.log('\n[Test 7] Kiểm tra GET /api/wiki?category=battle...');
    const res7 = await fetch(`http://localhost:${PORT}/api/wiki?category=battle`);
    const json7 = await res7.json();
    if (
      res7.status === 200 &&
      json7.success === true &&
      json7.category === 'battle' &&
      json7.data.id === 'battle' &&
      json7.data.title.includes('Đấu Trường') &&
      json7.data.fields.some(f => f.value.includes('Hỗn Độn'))
    ) {
      console.log('✅ [Test 7 ĐẠT] Chuyên mục battle trả về ngũ hành tương khắc và hệ Hỗn Độn');
      passed++;
    } else {
      throw new Error(`[Test 7] Thất bại: status=${res7.status}`);
    }

    // TEST 8: GET /api/wiki?category=economy
    total++;
    console.log('\n[Test 8] Kiểm tra GET /api/wiki?category=economy...');
    const res8 = await fetch(`http://localhost:${PORT}/api/wiki?category=economy`);
    const json8 = await res8.json();
    if (
      res8.status === 200 &&
      json8.success === true &&
      json8.category === 'economy' &&
      json8.data.id === 'economy' &&
      json8.data.title.includes('Kinh Tế') &&
      json8.data.fields.some(f => f.value.includes('Thiên Hồ Thần Tộc'))
    ) {
      console.log('✅ [Test 8 ĐẠT] Chuyên mục economy trả về Linh Thạch và Bang Chiến 24H');
      passed++;
    } else {
      throw new Error(`[Test 8] Thất bại: status=${res8.status}`);
    }

    // TEST 9: GET /api/wiki?category=invalid_xyz (404 Not Found)
    total++;
    console.log('\n[Test 9] Kiểm tra GET /api/wiki?category=invalid_xyz (Chuyên mục không tồn tại)...');
    const res9 = await fetch(`http://localhost:${PORT}/api/wiki?category=invalid_xyz`);
    const json9 = await res9.json();
    if (
      res9.status === 404 &&
      json9.success === false &&
      json9.error === 'Category not found' &&
      Array.isArray(json9.valid_categories) &&
      json9.valid_categories.length === 5
    ) {
      console.log('✅ [Test 9 ĐẠT] Phản hồi 404 chính xác kèm danh sách valid_categories:', json9.valid_categories);
      passed++;
    } else {
      throw new Error(`[Test 9] Thất bại: status=${res9.status}, body=${JSON.stringify(json9)}`);
    }

    // TEST 10: GET /api/wiki?category=%20%20BEGINNER%20%20 (Chuẩn hóa chữ hoa và khoảng trắng)
    total++;
    console.log('\n[Test 10] Kiểm tra GET /api/wiki?category=  BEGINNER  (Khoảng trắng & Chữ hoa)...');
    const res10 = await fetch(`http://localhost:${PORT}/api/wiki?category=%20%20BEGINNER%20%20`);
    const json10 = await res10.json();
    if (res10.status === 200 && json10.success === true && json10.category === 'beginner') {
      console.log('✅ [Test 10 ĐẠT] Chuẩn hóa trim() và toLowerCase() chính xác thành beginner');
      passed++;
    } else {
      throw new Error(`[Test 10] Thất bại: status=${res10.status}, category=${json10.category}`);
    }

    // TEST 11: GET /api/wiki?category= (Chuỗi rỗng)
    total++;
    console.log('\n[Test 11] Kiểm tra GET /api/wiki?category= (Chuỗi rỗng)...');
    const res11 = await fetch(`http://localhost:${PORT}/api/wiki?category=`);
    const json11 = await res11.json();
    if (res11.status === 200 && json11.success === true && json11.categories.length === 5) {
      console.log('✅ [Test 11 ĐẠT] Fallback an toàn về toàn bộ 5 chuyên mục khi query rỗng');
      passed++;
    } else {
      throw new Error(`[Test 11] Thất bại: status=${res11.status}`);
    }

    // TEST 12: GET /api/wiki?cat=pets (Bí danh tham số ?cat=...)
    total++;
    console.log('\n[Test 12] Kiểm tra GET /api/wiki?cat=pets (Alias param ?cat=)...');
    const res12 = await fetch(`http://localhost:${PORT}/api/wiki?cat=pets`);
    const json12 = await res12.json();
    if (res12.status === 200 && json12.success === true && json12.category === 'pets') {
      console.log('✅ [Test 12 ĐẠT] Hỗ trợ alias tham số ?cat= tương đương ?category=');
      passed++;
    } else {
      throw new Error(`[Test 12] Thất bại: status=${res12.status}`);
    }

    // TEST 13: GET /api/wiki?category=<script>alert(1)</script> (Anti XSS / Injection)
    total++;
    console.log('\n[Test 13] Kiểm tra GET /api/wiki?category=<script>alert(1)</script> (XSS Sanitization)...');
    const res13 = await fetch(`http://localhost:${PORT}/api/wiki?category=%3Cscript%3Ealert(1)%3C/script%3E`);
    const json13 = await res13.json();
    if (res13.status === 404 && json13.success === false && json13.error === 'Category not found') {
      console.log('✅ [Test 13 ĐẠT] Chặn an toàn payload độc hại, trả 404 không leak stack trace');
      passed++;
    } else {
      throw new Error(`[Test 13] Thất bại: status=${res13.status}`);
    }

    // TEST 14: Header Validation (Content-Type UTF-8 & Cache-Control max-age)
    total++;
    console.log('\n[Test 14] Kiểm tra Headers HTTP (Content-Type UTF-8 & Cache-Control)...');
    const res14 = await fetch(`http://localhost:${PORT}/api/wiki`);
    const contentType = res14.headers.get('content-type');
    const cacheControl = res14.headers.get('cache-control');
    if (
      contentType &&
      contentType.includes('application/json') &&
      contentType.includes('utf-8') &&
      cacheControl &&
      cacheControl.includes('public') &&
      cacheControl.includes('max-age=300')
    ) {
      console.log(`✅ [Test 14 ĐẠT] Headers hợp lệ:\n   Content-Type: ${contentType}\n   Cache-Control: ${cacheControl}`);
      passed++;
    } else {
      throw new Error(`[Test 14] Thất bại: content-type=${contentType}, cache-control=${cacheControl}`);
    }

  } catch (err) {
    console.error('\n❌ LỖI TRONG QUÁ TRÌNH KIỂM THỬ WIKI:', err.message);
  } finally {
    server.close();
    console.log('\n[Wiki Test] Đã đóng test server');
    console.log('====================================================');
    console.log(`KẾT QUẢ KIỂM THỬ WIKI: ${passed}/${total} BÀI TEST THÀNH CÔNG 🎉`);
    console.log('====================================================');

    if (passed === total && total === 14) {
      process.exit(0);
    } else {
      process.exit(1);
    }
  }
}

runWikiTests();
