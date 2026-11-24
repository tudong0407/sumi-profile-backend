/**
 * scripts/install_v1_6_1_assets.mjs
 * Chuyển đổi 12 ảnh PNG Lò Luyện Đan & Đan Dược sang WebP (768x768, q=85)
 * trong assets/alchemy/*.webp.
 *
 * Usage:
 *   node scripts/install_v1_6_1_assets.mjs --dir "D:\Files\Botghost - Nhiem Nhiem\Full AI Gen\SuMi_v1_6_1_LuyenDan"
 */

import fs from 'node:fs';
import path from 'node:path';
import { createCanvas, loadImage } from '@napi-rs/canvas';

const EXPECTED_FILES = [
  'furnace_lv1',
  'furnace_lv2',
  'furnace_lv3',
  'furnace_lv4',
  'furnace_lv5',
  'furnace_exploded',
  'pill_t1',
  'pill_t2',
  'pill_t3',
  'pill_t4',
  'pill_ess_1',
  'pill_ess_2',
];

const DEST_DIR = path.resolve('assets', 'alchemy');

function getArgDir() {
  const idx = process.argv.indexOf('--dir');
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
  return 'D:\\Files\\Botghost - Nhiem Nhiem\\Full AI Gen\\SuMi_v1_6_1_LuyenDan';
}

async function convertToWebp(srcPath, destPath, width = 768, height = 768, quality = 85) {
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
  const srcDir = getArgDir();
  if (!fs.existsSync(srcDir)) {
    throw new Error(`Source directory not found: ${srcDir}`);
  }

  let totalBytes = 0;
  let installed = 0;
  const missing = [];

  for (const base of EXPECTED_FILES) {
    const candidates = [`${base}.png`, `${base}.webp`, `${base}.jpg`, `${base}.jpeg`];
    const found = candidates
      .map((name) => path.join(srcDir, name))
      .find((p) => fs.existsSync(p));
    if (!found) {
      missing.push(`${base}.png`);
      continue;
    }
    const dest = path.join(DEST_DIR, `${base}.webp`);
    const bytes = await convertToWebp(found, dest, 768, 768, 85);
    totalBytes += bytes;
    installed += 1;
    console.log(`  [OK] ${path.basename(found)} -> assets/alchemy/${base}.webp (${(bytes / 1024).toFixed(1)} KB)`);
  }

  console.log(`\n[install_v1_6_1_assets] Installed ${installed}/${EXPECTED_FILES.length} files (${(totalBytes / 1024).toFixed(1)} KB total).`);
  if (missing.length > 0) {
    console.warn(`[install_v1_6_1_assets] Missing (${missing.length}): ${missing.join(', ')}`);
  }
}

main().catch((err) => {
  console.error('[install_v1_6_1_assets] FAILED:', err);
  process.exit(1);
});
