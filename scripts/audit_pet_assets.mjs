/**
 * scripts/audit_pet_assets.mjs
 * Kiểm tra toàn bộ 90 Linh Thú tiêu chuẩn + Cửu Vĩ Hồng Hồ:
 * - Kích thước ảnh gốc trong assets/pets/*.png
 * - Alpha transparency ở 4 góc & viền
 * - Chỉ số độ nét (Laplacian edge energy) để phát hiện ảnh mờ
 * - Icon trong assets/pets/icons/*.png
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { PET_CATALOG } from '../src/data/catalog.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

function measureSharpnessAndBounds(data, w, h) {
  let minX = w, minY = h, maxX = -1, maxY = -1;
  let opaqueCount = 0;
  const lum = new Float32Array(w * h);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const a = data[idx + 3];
      lum[y * w + x] = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
      if (a > 24) {
        opaqueCount++;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  let lapSum = 0;
  let lapSqSum = 0;
  let lapCount = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = (y * w + x) * 4;
      if (data[idx + 3] < 80) continue;
      const c = lum[y * w + x];
      const lap = lum[(y - 1) * w + x] + lum[(y + 1) * w + x] + lum[y * w + (x - 1)] + lum[y * w + (x + 1)] - 4 * c;
      lapSum += lap;
      lapSqSum += lap * lap;
      lapCount++;
    }
  }
  const mean = lapCount > 0 ? lapSum / lapCount : 0;
  const variance = lapCount > 0 ? (lapSqSum / lapCount) - mean * mean : 0;

  return {
    opaquePct: Number(((opaqueCount / (w * h)) * 100).toFixed(1)),
    lapVar: Number(variance.toFixed(1)),
    bbox: maxX >= minX ? { minX, minY, maxX, maxY, w: maxX - minX + 1, h: maxY - minY + 1 } : null,
  };
}

export async function runAudit() {
  const pets = PET_CATALOG.filter((p) => !p.is_exclusive_fuyumi);
  const fuyumi = PET_CATALOG.find((p) => p.is_exclusive_fuyumi);
  const allTargets = [...pets, ...(fuyumi ? [fuyumi] : [])];

  const rows = [];
  for (const p of allTargets) {
    const fileName = p.pet_type === 'cuu_vi_hong_ho' ? 'cuu_vi_hong_ho_transparent.png' : `${p.pet_type}.png`;
    const fp = path.join(ROOT, 'assets/pets', fileName);
    const icp = path.join(ROOT, 'assets/pets/icons', `${p.pet_type}.png`);
    if (!fs.existsSync(fp)) {
      rows.push({ pet_type: p.pet_type, name: p.pet_name, status: 'MISSING_FILE', w: 0, h: 0 });
      continue;
    }
    const stat = fs.statSync(fp);
    const img = await loadImage(fp);
    const cv = createCanvas(img.width, img.height);
    const ctx = cv.getContext('2d');
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, img.width, img.height).data;
    const cornerAlphas = [
      data[3],
      data[(img.width - 1) * 4 + 3],
      data[((img.height - 1) * img.width) * 4 + 3],
      data[((img.height * img.width) - 1) * 4 + 3],
    ];
    const metrics = measureSharpnessAndBounds(data, img.width, img.height);
    const nonSquare = img.width !== img.height;
    const lowRes = img.width < 512 || img.height < 512;
    const opaqueBg = Math.max(...cornerAlphas) > 25;
    const missingIcon = p.pet_type !== 'cuu_vi_hong_ho' && !fs.existsSync(icp);

    rows.push({
      pet_type: p.pet_type,
      name: p.pet_name,
      rarity: p.rarity_key,
      element: p.element,
      w: img.width,
      h: img.height,
      kb: Number((stat.size / 1024).toFixed(1)),
      cornerAlphaMax: Math.max(...cornerAlphas),
      lapVar: metrics.lapVar,
      opaquePct: metrics.opaquePct,
      hasIcon: fs.existsSync(icp),
      lowRes,
      nonSquare,
      opaqueBg,
      missingIcon,
    });
  }

  const lowResList = rows.filter((r) => r.lowRes);
  const nonSquareList = rows.filter((r) => !r.lowRes && r.nonSquare);
  const opaqueBgList = rows.filter((r) => r.opaqueBg);
  const missingIconList = rows.filter((r) => r.missingIcon);
  const lowSharpness512 = rows.filter((r) => !r.lowRes && r.lapVar < 120).sort((a, b) => a.lapVar - b.lapVar);

  console.log(`=== PET ASSET AUDIT (${rows.length} total: ${pets.length} standard + 1 Fuyumi) ===`);
  console.log(`Low-res (<512): ${lowResList.length}`);
  console.log(`Non-square (>=512): ${nonSquareList.length}`);
  console.log(`Opaque corner background: ${opaqueBgList.length}`);
  console.log(`Missing mini icon: ${missingIconList.length}`);
  console.log(`Low-lapVar (<120) among >=512: ${lowSharpness512.length}`);

  if (lowResList.length) {
    console.log('\n--- LOW-RES LIST ---');
    lowResList.forEach((r) => console.log(`${r.pet_type.padEnd(32)} | ${r.name.padEnd(32)} | ${r.w}x${r.h} | lap=${r.lapVar} | ${r.element}`));
  }
  if (nonSquareList.length) {
    console.log('\n--- NON-SQUARE (>=512) LIST ---');
    nonSquareList.forEach((r) => console.log(`${r.pet_type.padEnd(32)} | ${r.name.padEnd(32)} | ${r.w}x${r.h} | lap=${r.lapVar}`));
  }
  if (opaqueBgList.length) {
    console.log('\n--- OPAQUE BG LIST ---');
    opaqueBgList.forEach((r) => console.log(`${r.pet_type.padEnd(32)} | cornerAlphaMax=${r.cornerAlphaMax} | ${r.w}x${r.h}`));
  }
  if (lowSharpness512.length) {
    console.log('\n--- LOW SHARPNESS (>=512, lapVar < 120) ---');
    lowSharpness512.slice(0, 15).forEach((r) => console.log(`${r.pet_type.padEnd(32)} | lap=${r.lapVar} | ${r.w}x${r.h} | ${r.kb}KB`));
  }

  return { rows, lowResList, nonSquareList, opaqueBgList, missingIconList, lowSharpness512 };
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  runAudit().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
