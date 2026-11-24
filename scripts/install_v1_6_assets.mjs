/**
 * scripts/install_v1_6_assets.mjs
 * Chuyển đổi 31 tài nguyên PNG/GIF từ D:\Files\Botghost - Nhiem Nhiem\Full AI Gen\SuMi_v1_6_PNG_GIF
 * sang WebP/GIF chuẩn nhẹ bằng @napi-rs/canvas trong assets/shop/, assets/stones/, assets/fortune/.
 */

import fs from 'node:fs';
import path from 'node:path';
import { createCanvas, loadImage } from '@napi-rs/canvas';

const SRC_ROOT = 'D:\\Files\\Botghost - Nhiem Nhiem\\Full AI Gen\\SuMi_v1_6_PNG_GIF';
const DEST_ROOT = path.resolve('assets');

async function convertToWebp(srcPath, destPath, width, height, quality) {
  await fs.promises.mkdir(path.dirname(destPath), { recursive: true });
  const img = await loadImage(srcPath);
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  const scale = Math.max(width / img.width, height / img.height);
  const drawW = img.width * scale;
  const drawH = img.height * scale;
  ctx.drawImage(img, (width - drawW) / 2, (height - drawH) / 2, drawW, drawH);
  const webpBuf = await canvas.encode('webp', quality);
  await fs.promises.writeFile(destPath, webpBuf);
  return webpBuf.length;
}

async function main() {
  let totalBytes = 0;
  let count = 0;

  // 1. 3 Luck Potions -> assets/shop/*.webp (512x512)
  const shopDir = path.join(SRC_ROOT, 'shop');
  for (const file of fs.readdirSync(shopDir).filter((f) => f.endsWith('.png'))) {
    const outName = file.replace(/\.png$/i, '.webp');
    const bytes = await convertToWebp(
      path.join(shopDir, file),
      path.join(DEST_ROOT, 'shop', outName),
      512,
      512,
      86,
    );
    totalBytes += bytes;
    count += 1;
  }

  // 2. 20 Rough Stones -> assets/stones/*.webp (512x512)
  const stonesDir = path.join(SRC_ROOT, 'stones');
  for (const file of fs.readdirSync(stonesDir).filter((f) => f.endsWith('.png'))) {
    const outName = file.replace(/\.png$/i, '.webp');
    const bytes = await convertToWebp(
      path.join(stonesDir, file),
      path.join(DEST_ROOT, 'stones', outName),
      512,
      512,
      84,
    );
    totalBytes += bytes;
    count += 1;
  }

  // 3. 6 Fortune Cards (768x1024 WebP) + oracle_shake.webp (800x600) + oracle_shake.gif
  const fqDir = path.join(SRC_ROOT, 'gieoque');
  await fs.promises.mkdir(path.join(DEST_ROOT, 'fortune'), { recursive: true });
  for (const file of fs.readdirSync(fqDir)) {
    const src = path.join(fqDir, file);
    if (file === 'oracle_shake.gif') {
      const dest = path.join(DEST_ROOT, 'fortune', 'oracle_shake.gif');
      await fs.promises.copyFile(src, dest);
      const st = await fs.promises.stat(dest);
      totalBytes += st.size;
      count += 1;
    } else if (file === 'oracle_shake.png') {
      const bytes = await convertToWebp(src, path.join(DEST_ROOT, 'fortune', 'oracle_shake.webp'), 800, 600, 84);
      totalBytes += bytes;
      count += 1;
    } else if (file.endsWith('.png')) {
      const outName = file.replace(/\.png$/i, '.webp');
      const bytes = await convertToWebp(src, path.join(DEST_ROOT, 'fortune', outName), 768, 1024, 86);
      totalBytes += bytes;
      count += 1;
    }
  }

  console.log(`[install_v1_6_assets] Installed ${count} files cleanly (${(totalBytes / (1024 * 1024)).toFixed(2)} MB total).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
