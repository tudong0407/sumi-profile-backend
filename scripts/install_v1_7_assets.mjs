/**
 * scripts/install_v1_7_assets.mjs
 * Kiểm kê & cài đặt bộ ảnh Ver 1.7 từ thư mục staging (--source <dir>) vào assets/{pets,items,domains,shop,frames}:
 * - Mặc định chạy chế độ audit (chỉ kiểm kê ảnh đã có & còn thiếu cho +60 Pet, 40 Pet Evolved _evo.webp, +99 Pháp Bảo, +101 Lãnh Địa, 9 Viền, 9 Vật phẩm mới).
 * - Khi có --source <dir> --apply: tự động chuẩn hóa & chép WebP/PNG vào đúng thư mục assets/.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import {
  PET_CATALOG,
  EQUIPMENT_CATALOG,
  DOMAIN_CATALOG,
  DIVINE_SENSE_CATALOG,
  DIVINE_REALM_CATALOG,
  V17_PET_EVOLUTIONS,
  AVATAR_FRAMES,
  ALL_CONSUMABLES,
} from '../src/data/catalog.js';

const SHOP_ITEM_IDS = new Set([
  ...ALL_CONSUMABLES.map((c) => c.item_id),
  'red_gold_crystal',
]);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ASSETS_ROOT = path.resolve(__dirname, '../assets');

export function auditV17Assets() {
  const missing = {
    pets_base: [],
    pets_evolved: [],
    equipment: [],
    domains: [],
    senses: [],
    realms: [],
    frames: [],
    consumables: [],
  };

  for (const p of PET_CATALOG) {
    if (p.is_exclusive_fuyumi) continue;
    const rel = p.image_file || `pets/${p.pet_type}.png`;
    const baseNoExt = rel.replace(/\.(png|webp)$/i, '');
    const exists = fs.existsSync(path.join(ASSETS_ROOT, `${baseNoExt}.png`))
      || fs.existsSync(path.join(ASSETS_ROOT, `${baseNoExt}.webp`));
    if (!exists) missing.pets_base.push(p.pet_type);
  }

  for (const [petType, evo] of Object.entries(V17_PET_EVOLUTIONS)) {
    const evoRel = evo.evo_image_file || `pets/${petType}_evo.webp`;
    if (!fs.existsSync(path.join(ASSETS_ROOT, evoRel))) {
      missing.pets_evolved.push(petType);
    }
  }

  for (const it of EQUIPMENT_CATALOG) {
    const base = `items/${it.item_id}`;
    const exists = fs.existsSync(path.join(ASSETS_ROOT, `${base}.png`))
      || fs.existsSync(path.join(ASSETS_ROOT, `${base}.webp`));
    if (!exists) missing.equipment.push(it.item_id);
  }

  for (const d of DOMAIN_CATALOG) {
    if (d.is_exclusive_fuyumi) continue;
    const base = `domains/${d.domain_id}`;
    if (!fs.existsSync(path.join(ASSETS_ROOT, `${base}.png`)) && !fs.existsSync(path.join(ASSETS_ROOT, `${base}.webp`))) {
      missing.domains.push(d.domain_id);
    }
  }

  for (const s of DIVINE_SENSE_CATALOG) {
    if (s.is_exclusive_fuyumi) continue;
    const base = `domains/${s.sense_id}`;
    if (!fs.existsSync(path.join(ASSETS_ROOT, `${base}.png`)) && !fs.existsSync(path.join(ASSETS_ROOT, `${base}.webp`))) {
      missing.senses.push(s.sense_id);
    }
  }

  for (const r of DIVINE_REALM_CATALOG) {
    if (r.is_exclusive_fuyumi) continue;
    const base = `domains/${r.realm_id}`;
    if (!fs.existsSync(path.join(ASSETS_ROOT, `${base}.png`)) && !fs.existsSync(path.join(ASSETS_ROOT, `${base}.webp`))) {
      missing.realms.push(r.realm_id);
    }
  }

  for (const f of AVATAR_FRAMES) {
    if (!f.file || f.frame_id === 'default') continue;
    if (!fs.existsSync(path.join(ASSETS_ROOT, f.file))) {
      missing.frames.push(f.frame_id);
    }
  }

  for (const c of ALL_CONSUMABLES) {
    if (c.item_id === 'frame_unlock_token') continue;
    const base = `shop/${c.item_id}`;
    const exists = fs.existsSync(path.join(ASSETS_ROOT, `${base}.png`))
      || fs.existsSync(path.join(ASSETS_ROOT, `${base}.webp`));
    if (!exists) missing.consumables.push(c.item_id);
  }

  return {
    assets_root: ASSETS_ROOT,
    counts: Object.fromEntries(Object.entries(missing).map(([k, v]) => [k, v.length])),
    missing,
  };
}

export async function installFromStagingDir(sourceDir, options = {}) {
  const apply = Boolean(options.apply);
  const webpQuality = Number(options.webpQuality || 88);
  const absSource = path.resolve(sourceDir);
  if (!fs.existsSync(absSource)) {
    throw new Error(`Staging asset directory not found: ${absSource}`);
  }

  const copied = [];
  let srcBytes = 0;
  let dstBytes = 0;
  const subdirs = ['pets', 'items', 'domains', 'shop', 'frames'];
  for (const sub of subdirs) {
    const srcSub = path.join(absSource, sub);
    if (!fs.existsSync(srcSub)) continue;
    for (const file of fs.readdirSync(srcSub).sort()) {
      if (!/\.(png|webp)$/i.test(file)) continue;
      const stem = file.replace(/\.(png|webp)$/i, '');
      const targetSub = (sub === 'items' && SHOP_ITEM_IDS.has(stem)) ? 'shop' : sub;
      const targetFile = targetSub === 'frames' ? file : `${stem}.webp`;
      const srcFile = path.join(srcSub, file);
      const dstDir = path.join(ASSETS_ROOT, targetSub);
      const dstFile = path.join(dstDir, targetFile);
      const st = fs.statSync(srcFile);
      srcBytes += st.size;

      if (apply) {
        if (!fs.existsSync(dstDir)) fs.mkdirSync(dstDir, { recursive: true });
        if (targetSub === 'frames') {
          fs.copyFileSync(srcFile, dstFile);
          dstBytes += st.size;
        } else {
          // Chuyển sang WebP lossy q=88 (giữ 100% alpha trong suốt) để nhẹ hơn ~65% so với WebP lossless/PNG
          const img = await loadImage(srcFile);
          const canvas = createCanvas(img.width, img.height);
          canvas.getContext('2d').drawImage(img, 0, 0);
          const outBuf = await canvas.encode('webp', webpQuality);
          fs.writeFileSync(dstFile, outBuf);
          dstBytes += outBuf.length;
        }
      }
      copied.push(`${targetSub}/${targetFile}`);
    }
  }

  return {
    mode: apply ? 'apply' : 'dry-run',
    copied_count: copied.length,
    source_mb: Number((srcBytes / 1024 / 1024).toFixed(2)),
    installed_mb: Number((dstBytes / 1024 / 1024).toFixed(2)),
    copied,
  };
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (isCli) {
  const args = process.argv.slice(2);
  const srcIdx = args.indexOf('--source');
  const apply = args.includes('--apply');
  if (srcIdx !== -1 && args[srcIdx + 1]) {
    installFromStagingDir(args[srcIdx + 1], { apply })
      .then((res) => console.log('[install_v1_7_assets]', res))
      .catch((err) => {
        console.error('[install_v1_7_assets] ERROR:', err);
        process.exit(1);
      });
  } else {
    const audit = auditV17Assets();
    console.log('[install_v1_7_assets] AUDIT:', audit.counts);
  }
}
