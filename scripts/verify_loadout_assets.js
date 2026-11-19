import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadImage } from '@napi-rs/canvas';
import { ALL_45_ITEMS } from './generate_all_loadout_assets.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../');
const ITEMS_DIR = path.join(PROJECT_ROOT, 'assets', 'items');

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

async function verifyAll() {
  console.log(`[Verify] Bắt đầu kiểm thử toàn diện 45 file ảnh trang bị tại: ${ITEMS_DIR}`);
  let passCount = 0;
  const errors = [];

  for (const item of ALL_45_ITEMS) {
    const filename = `${item.item_id}.png`;
    const filePath = path.join(ITEMS_DIR, filename);

    // 1. Kiểm tra tồn tại
    if (!fs.existsSync(filePath)) {
      errors.push(`[MISSING] File không tồn tại: ${filename}`);
      continue;
    }

    // 2. Kiểm tra dung lượng
    const stat = fs.statSync(filePath);
    if (stat.size < 50000) {
      errors.push(`[SIZE_LOW] File ${filename} có dung lượng quá nhỏ: ${stat.size} bytes`);
      continue;
    }

    // 3. Kiểm tra Magic Bytes PNG
    const fd = fs.openSync(filePath, 'r');
    const header = Buffer.alloc(8);
    fs.readSync(fd, header, 0, 8, 0);
    fs.closeSync(fd);

    if (!header.equals(PNG_MAGIC)) {
      errors.push(`[NOT_PNG] Header của ${filename} không khớp chuẩn PNG`);
      continue;
    }

    // 4. Kiểm tra kích thước chính xác 512x512 pixels bằng Image Loader
    const imgBuffer = fs.readFileSync(filePath);
    const img = await loadImage(imgBuffer);
    if (img.width !== 512 || img.height !== 512) {
      errors.push(`[BAD_DIM] File ${filename} có kích thước ${img.width}x${img.height}, mong đợi 512x512`);
      continue;
    }

    passCount++;
  }

  console.log(`\n======================================================`);
  console.log(`[Verify Result] Đã kiểm tra ${ALL_45_ITEMS.length} vật phẩm.`);
  console.log(`[Verify Result] Đạt chuẩn 100%: ${passCount}/${ALL_45_ITEMS.length}`);
  if (errors.length > 0) {
    console.error(`[Verify Result] Phát hiện ${errors.length} lỗi:`);
    errors.forEach(e => console.error(e));
    process.exit(1);
  } else {
    console.log(`[Verify Result] TẤT CẢ 45 FILE ĐỀU HỢP LỆ VÀ ĐẠT CHUẨN 512x512 PNG!`);
    console.log(`======================================================`);
  }
}

verifyAll().catch(err => {
  console.error('[Verify] Exception:', err);
  process.exit(1);
});
