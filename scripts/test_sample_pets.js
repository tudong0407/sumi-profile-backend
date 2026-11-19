import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { renderProfileCard } from '../src/canvas/profileRenderer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../');
const OUTPUT_DIR = path.join(PROJECT_ROOT, 'output');

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Danh sách 5 Linh Thú mẫu thuộc 5 nguyên tố khác nhau (Hỏa, Thủy/Băng, Lôi/Kim, Mộc, Ám/Hư Không)
const SAMPLE_PETS = [
  {
    pet_type: 'hoa_diem_ho',
    pet_name: 'Hỏa Diễm Hồ',
    element: 'Hỏa',
    rarity: 'Cực Phẩm',
    icon: '🔥',
    hax_skill: 'Thiêu Hồn Diễm Giáp',
    atk: 1450,
    def: 980,
    spd: 1210,
    power: 12500,
    level: 45,
    user: {
      user_id: '100000000000000001',
      username: 'Viêm Hỏa Tiên Tôn 🔥',
      custom_title: 'Chúa Tể Lửa Đỏ Vô Tận',
      realm: 'IV. Hóa Thần Cảnh',
      level: 48,
    }
  },
  {
    pet_type: 'bang_tuyet_ho',
    pet_name: 'Băng Tuyết Hồ',
    element: 'Thủy',
    rarity: 'Hiếm',
    icon: '❄️',
    hax_skill: 'Băng Phong Vạn Dặm',
    atk: 950,
    def: 1250,
    spd: 1100,
    power: 10800,
    level: 38,
    user: {
      user_id: '100000000000000002',
      username: 'Băng Cơ Ngọc Cốt ❄️',
      custom_title: 'Hàn Băng Thần Nữ',
      realm: 'III. Kim Đan Viên Mãn',
      level: 35,
    }
  },
  {
    pet_type: 'loi_dinh_kim_ho',
    pet_name: 'Lôi Đình Kim Hồ',
    element: 'Lôi',
    rarity: 'Thần Thoại',
    icon: '⚡',
    hax_skill: 'Lôi Quang Cực Tốc (HAX)',
    atk: 1820,
    def: 890,
    spd: 2100,
    power: 18900,
    level: 60,
    user: {
      user_id: '100000000000000003',
      username: 'Cửu Thiên Lôi Đế ⚡',
      custom_title: 'Chưởng Khống Vạn Kiếp Thiên Lôi',
      realm: 'V. Luyện Hư Cảnh',
      level: 62,
    }
  },
  {
    pet_type: 'thanh_truc_tien_loc',
    pet_name: 'Thanh Trúc Tiên Lộc',
    element: 'Mộc',
    rarity: 'Hiếm',
    icon: '🦌',
    hax_skill: 'Linh Mộc Hồi Xuân',
    atk: 880,
    def: 1420,
    spd: 1150,
    power: 11200,
    level: 40,
    user: {
      user_id: '100000000000000004',
      username: 'Trúc Lâm Dược Sư 🌿',
      custom_title: 'Đại Tông Sư Đan Đạo',
      realm: 'III. Kim Đan Cảnh',
      level: 39,
    }
  },
  {
    pet_type: 'u_minh_lang_vuong',
    pet_name: 'U Minh Lang Vương',
    element: 'Ám',
    rarity: 'Thần Thoại',
    icon: '🐺',
    hax_skill: 'Tuyệt Mệnh Thần Trảm',
    atk: 1980,
    def: 1120,
    spd: 1650,
    power: 19400,
    level: 65,
    user: {
      user_id: '100000000000000005',
      username: 'Dạ Lang Dạ Thần 🌑',
      custom_title: 'Hắc Dạ U Minh Chi Chủ',
      realm: 'VI. Hợp Thể Cảnh',
      level: 68,
    }
  }
];

async function runSampleTests() {
  console.log('====================================================');
  console.log('🐾 KIỂM THỬ RENDER DYNAMIC PET CHO 5 LINH THÚ MẪU');
  console.log('====================================================\n');

  const renderedBuffers = [];

  for (const petCfg of SAMPLE_PETS) {
    const profileData = {
      user_id: petCfg.user.user_id,
      username: petCfg.user.username,
      custom_title: petCfg.user.custom_title,
      realm: petCfg.user.realm,
      level: petCfg.user.level,
      exp: 15400,
      next_level_exp: 25000,
      linh_thach: 99999,
      max_role_slots: 5,
      pet: {
        name: petCfg.pet_name,
        type: petCfg.pet_type,
        pet_type: petCfg.pet_type,
        rarity: petCfg.rarity,
        element: petCfg.element,
        hax_skill: petCfg.hax_skill,
        level: petCfg.level,
        star: 5,
        atk: petCfg.atk,
        def: petCfg.def,
        spd: petCfg.spd,
        power: petCfg.power,
        icon: petCfg.icon,
        equipment: {
          weapon: {
            item_name: '« Thanh Vân Kiếm »',
            rarity: 'Cuc Pham',
            bonus_atk: 250,
            icon: '⚔️'
          },
          gem: {
            item_name: '« Bích Ngọc Châu »',
            rarity: 'Hiem',
            bonus_def: 180,
            icon: '🔮'
          },
          soul: null
        }
      },
      equipped_roles: [
        { slot: 1, role_id: 'bach_ngoc', name: '« Bạch Ngọc Tu Sĩ »', perk: '💎 +20% EXP', rarity: 'rare' }
      ]
    };

    const start = Date.now();
    const buffer = await renderProfileCard(profileData);
    const duration = Date.now() - start;

    const outName = `test_pet_${petCfg.pet_type}.png`;
    const outPath = path.join(OUTPUT_DIR, outName);
    fs.writeFileSync(outPath, buffer);
    renderedBuffers.push({ cfg: petCfg, buffer, path: outPath });

    console.log(`✅ [${petCfg.element}] Rendered ${petCfg.pet_name} (${petCfg.pet_type}) in ${duration}ms -> ${(buffer.length / 1024).toFixed(1)} KB`);
  }

  // Tạo Collage 1 cột hoặc lưới 2 cột
  console.log('\n🎨 Đang tạo collage tổng hợp 5 thẻ mẫu...');
  const cardW = 1000;
  const cardH = 500;
  const scale = 0.5; // Thu nhỏ 50% để collage gọn gàng (500x250 mỗi thẻ)
  const thumbW = cardW * scale;
  const thumbH = cardH * scale;
  const gap = 16;
  const padding = 20;

  // Lưới 2 cột x 3 dòng (thẻ 5 căn giữa hoặc đặt 5 thẻ)
  const cols = 2;
  const rows = Math.ceil(renderedBuffers.length / cols);
  const collageW = padding * 2 + cols * thumbW + (cols - 1) * gap;
  const collageH = padding * 2 + rows * thumbH + (rows - 1) * gap + 50; // +50px tiêu đề

  const collageCanvas = createCanvas(collageW, collageH);
  const ctx = collageCanvas.getContext('2d');

  // Nền tối thanh lịch
  ctx.fillStyle = '#0a0815';
  ctx.fillRect(0, 0, collageW, collageH);

  // Tiêu đề Collage
  ctx.font = 'bold 22px "Segoe UI", Arial, sans-serif';
  ctx.fillStyle = '#f472b6';
  ctx.textAlign = 'center';
  ctx.fillText('🐾 BỘ SƯU TẬP LINH THÚ CHIẾN PET TIÊN GIỚI - SUMI FAMILY', collageW / 2, padding + 22);

  for (let i = 0; i < renderedBuffers.length; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = padding + col * (thumbW + gap);
    const y = padding + 50 + row * (thumbH + gap);

    const img = await loadImage(renderedBuffers[i].buffer);
    ctx.drawImage(img, 0, 0, cardW, cardH, x, y, thumbW, thumbH);

    // Viền nhẹ quanh thẻ
    ctx.strokeStyle = 'rgba(244, 114, 182, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, thumbW, thumbH);
  }

  const collageBuffer = collageCanvas.toBuffer('image/png');
  const collagePath = path.join(OUTPUT_DIR, 'test_pets_collage.png');
  fs.writeFileSync(collagePath, collageBuffer);

  console.log(`🎉 [Collage Hoàn Tất] Đã lưu tại: ${collagePath} (${(collageBuffer.length / 1024).toFixed(1)} KB)`);
}

runSampleTests().catch(err => {
  console.error('❌ Lỗi khi chạy test sample pets:', err);
  process.exit(1);
});
