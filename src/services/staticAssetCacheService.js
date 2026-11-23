/**
 * src/services/staticAssetCacheService.js
 * Pre-render 98 Static Cards (1 Element Chart + 41 Pets incl. cuu_vi_hong_ho + 56 non-unique Equipment)
 * + RAM Owner-Keyed Cache cho 9 Thần Thoại Độc Nhất + Short Data-Hash Cache cho /profile & /rank.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import {
  PET_CATALOG,
  EQUIPMENT_CATALOG,
  MYTHIC_UNIQUE_ITEM_IDS,
  FUYUMI_USER_ID,
} from '../data/catalog.js';
import { LATEST_VERSION } from '../data/changelogs.js';
import { getWikiItemDetail } from './wikiService.js';
import {
  renderElementalChart,
  renderWikiItemCard,
  renderWikiPetCard,
} from '../canvas/wikiRenderer.js';

export const STATIC_CACHE_VERSION = LATEST_VERSION;
export const CACHE_DIR = path.resolve('cache', 'prerendered');
export const MANIFEST_PATH = path.join(CACHE_DIR, 'manifest.json');

const staticRamCache = new Map();
const inFlightStatic = new Map();
const uniqueRamCache = new Map();
const inFlightUnique = new Map();
const dynamicRamCache = new Map();

const STATIC_RAM_CACHE_MAX = 48;
const UNIQUE_RAM_CACHE_MAX = 20;
const DYNAMIC_CACHE_MAX = 15;
const DYNAMIC_CACHE_TTL_MS = 15000;

let prerenderState = {
  version: STATIC_CACHE_VERSION,
  total: 1 + PET_CATALOG.length + EQUIPMENT_CATALOG.filter((i) => !i.is_unique).length,
  ready: 0,
  uniqueWarmed: 0,
  running: false,
  lastCompletedAt: null,
  lastError: null,
};

function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

function readManifest() {
  try {
    if (!fs.existsSync(MANIFEST_PATH)) return null;
    return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  } catch {
    return null;
  }
}

function writeManifest(meta) {
  ensureCacheDir();
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(meta, null, 2), 'utf8');
}

function clearDiskCacheIfStale(force = false) {
  ensureCacheDir();
  const manifest = readManifest();
  if (!force && manifest?.version === STATIC_CACHE_VERSION) {
    return false;
  }
  for (const file of fs.readdirSync(CACHE_DIR)) {
    if (file.endsWith('.webp') || file.endsWith('.png') || file === 'manifest.json') {
      try {
        fs.unlinkSync(path.join(CACHE_DIR, file));
      } catch {
        // ignore
      }
    }
  }
  staticRamCache.clear();
  return true;
}

export function getStaticAssetManifestEntries() {
  const nonUniqueItems = EQUIPMENT_CATALOG.filter((it) => !it.is_unique);
  return {
    total: 1 + PET_CATALOG.length + nonUniqueItems.length,
    chart: { key: 'element_chart', filenameBase: 'element_chart' },
    pets: PET_CATALOG.map((p) => ({
      pet_type: p.pet_type,
      pet: p,
      filenameBase: `pet_${p.pet_type}`,
    })),
    items: nonUniqueItems.map((it) => ({
      item_id: it.item_id,
      item: {
        ...it,
        slot_label: it.item_type === 'weapon' ? 'Vũ Khí' : it.item_type === 'gem' ? 'Bảo Ngọc' : 'Chiến Hồn',
      },
      filenameBase: `item_${it.item_id}`,
    })),
  };
}

function setStaticRam(key, buf) {
  if (!buf) return;
  if (staticRamCache.has(key)) staticRamCache.delete(key);
  staticRamCache.set(key, buf);
  while (staticRamCache.size > STATIC_RAM_CACHE_MAX) {
    const oldest = staticRamCache.keys().next().value;
    if (!oldest) break;
    staticRamCache.delete(oldest);
  }
}

async function getOrBuildStaticFile(ramKey, filenameBase, format, renderFn) {
  const fmt = format === 'png' ? 'png' : 'webp';
  const fullKey = `${ramKey}:${fmt}`;

  if (staticRamCache.has(fullKey)) {
    return staticRamCache.get(fullKey);
  }

  ensureCacheDir();
  const filePath = path.join(CACHE_DIR, `${filenameBase}.${fmt}`);
  const manifest = readManifest();
  if (manifest?.version === STATIC_CACHE_VERSION && fs.existsSync(filePath)) {
    try {
      const diskBuf = fs.readFileSync(filePath);
      if (diskBuf?.length > 100) {
        setStaticRam(fullKey, diskBuf);
        return diskBuf;
      }
    } catch {
      // fall through to render
    }
  }

  if (inFlightStatic.has(fullKey)) {
    return inFlightStatic.get(fullKey);
  }

  const job = (async () => {
    const buf = await renderFn(fmt);
    try {
      ensureCacheDir();
      fs.writeFileSync(filePath, buf);
    } catch (err) {
      console.warn(`[StaticCache] Write failed for ${filePath}:`, err.message);
    }
    setStaticRam(fullKey, buf);
    return buf;
  })().finally(() => {
    inFlightStatic.delete(fullKey);
  });

  inFlightStatic.set(fullKey, job);
  return job;
}

export async function getStaticElementChartBuffer(format = 'webp') {
  return getOrBuildStaticFile(
    'element_chart',
    'element_chart',
    format,
    (fmt) => renderElementalChart({ format: fmt }),
  );
}

export async function getStaticPetCardBuffer(petData, format = 'webp') {
  const cleanType = String(petData?.pet_type || '').trim();
  return getOrBuildStaticFile(
    `pet:${cleanType}`,
    `pet_${cleanType}`,
    format,
    (fmt) => renderWikiPetCard(petData, { format: fmt }),
  );
}

export async function getStaticNonUniqueItemCardBuffer(itemData, format = 'webp') {
  const cleanId = String(itemData?.item_id || '').trim();
  return getOrBuildStaticFile(
    `item:${cleanId}`,
    `item_${cleanId}`,
    format,
    (fmt) => renderWikiItemCard(itemData, { format: fmt }),
  );
}

export async function getCachedUniqueItemCard(itemData, format = 'webp') {
  const fmt = format === 'png' ? 'png' : 'webp';
  const itemId = String(itemData?.item_id || '').trim();
  const cacheKey = `${itemId}:${fmt}`;
  const ownerKey = itemData?.current_owner?.user_id
    ? `${itemData.current_owner.user_id}:${itemData.current_owner.username || ''}`
    : 'unowned';

  const hit = uniqueRamCache.get(cacheKey);
  if (hit && hit.ownerKey === ownerKey && hit.buffer) {
    return hit.buffer;
  }

  const flightKey = `${cacheKey}:${ownerKey}`;
  if (inFlightUnique.has(flightKey)) {
    return inFlightUnique.get(flightKey);
  }

  const job = (async () => {
    const buf = await renderWikiItemCard(itemData, { format: fmt });
    if (uniqueRamCache.has(cacheKey)) uniqueRamCache.delete(cacheKey);
    uniqueRamCache.set(cacheKey, {
      ownerKey,
      buffer: buf,
      updatedAt: Date.now(),
    });
    while (uniqueRamCache.size > UNIQUE_RAM_CACHE_MAX) {
      const oldest = uniqueRamCache.keys().next().value;
      if (!oldest) break;
      uniqueRamCache.delete(oldest);
    }
    return buf;
  })().finally(() => {
    inFlightUnique.delete(flightKey);
  });

  inFlightUnique.set(flightKey, job);
  return job;
}

export function invalidateUniqueItemCard(itemId) {
  const clean = String(itemId || '').trim();
  if (!clean || !MYTHIC_UNIQUE_ITEM_IDS.has(clean)) return false;
  uniqueRamCache.delete(`${clean}:webp`);
  uniqueRamCache.delete(`${clean}:png`);
  return true;
}

export function clearUniqueItemCardsCache() {
  uniqueRamCache.clear();
}

export function computeDynamicDataHash(data) {
  try {
    return crypto.createHash('sha1').update(JSON.stringify(data || {})).digest('hex');
  } catch {
    return String(Date.now());
  }
}

export async function getOrRenderDynamicCard(cacheKey, dataHash, renderFn, ttlMs = DYNAMIC_CACHE_TTL_MS) {
  const now = Date.now();
  const existing = dynamicRamCache.get(cacheKey);
  if (existing && existing.hash === dataHash && (now - existing.createdAt) < ttlMs) {
    dynamicRamCache.delete(cacheKey);
    dynamicRamCache.set(cacheKey, existing);
    return existing.buffer;
  }

  const buffer = await renderFn();
  if (dynamicRamCache.has(cacheKey)) dynamicRamCache.delete(cacheKey);
  dynamicRamCache.set(cacheKey, { hash: dataHash, buffer, createdAt: Date.now() });
  while (dynamicRamCache.size > DYNAMIC_CACHE_MAX) {
    const oldest = dynamicRamCache.keys().next().value;
    if (!oldest) break;
    dynamicRamCache.delete(oldest);
  }
  return buffer;
}

function yieldImmediate() {
  return new Promise((resolve) => setImmediate(resolve));
}

export async function prerenderAllStaticAssets(options = {}) {
  const formats = Array.isArray(options.formats) && options.formats.length ? options.formats : ['webp'];
  const force = Boolean(options.force);
  const log = typeof options.logger === 'function' ? options.logger : () => {};

  const cleared = clearDiskCacheIfStale(force);
  if (cleared) log(`[StaticCache] Cleared stale disk cache for v${STATIC_CACHE_VERSION}`);

  const entries = getStaticAssetManifestEntries();
  prerenderState = {
    ...prerenderState,
    version: STATIC_CACHE_VERSION,
    total: entries.total,
    ready: 0,
    running: true,
    lastError: null,
  };

  let renderedCount = 0;
  try {
    for (const fmt of formats) {
      const chartPath = path.join(CACHE_DIR, `${entries.chart.filenameBase}.${fmt}`);
      if (!force && readManifest()?.version === STATIC_CACHE_VERSION && fs.existsSync(chartPath)) {
        renderedCount += 1;
      } else {
        const buf = await renderElementalChart({ format: fmt });
        fs.writeFileSync(chartPath, buf);
        setStaticRam(`element_chart:${fmt}`, buf);
        renderedCount += 1;
      }
      if (fmt === formats[0]) prerenderState.ready = renderedCount;
      await yieldImmediate();

      for (const pEntry of entries.pets) {
        const pPath = path.join(CACHE_DIR, `${pEntry.filenameBase}.${fmt}`);
        if (force || readManifest()?.version !== STATIC_CACHE_VERSION || !fs.existsSync(pPath)) {
          const buf = await renderWikiPetCard(pEntry.pet, { format: fmt });
          fs.writeFileSync(pPath, buf);
          setStaticRam(`pet:${pEntry.pet_type}:${fmt}`, buf);
        }
        if (fmt === formats[0]) {
          renderedCount = Math.min(entries.total, renderedCount + 1);
          prerenderState.ready = renderedCount;
        }
        await yieldImmediate();
      }

      for (const iEntry of entries.items) {
        const iPath = path.join(CACHE_DIR, `${iEntry.filenameBase}.${fmt}`);
        if (force || readManifest()?.version !== STATIC_CACHE_VERSION || !fs.existsSync(iPath)) {
          const buf = await renderWikiItemCard(iEntry.item, { format: fmt });
          fs.writeFileSync(iPath, buf);
          setStaticRam(`item:${iEntry.item_id}:${fmt}`, buf);
        }
        if (fmt === formats[0]) {
          renderedCount = Math.min(entries.total, renderedCount + 1);
          prerenderState.ready = renderedCount;
        }
        await yieldImmediate();
      }
    }

    writeManifest({
      version: STATIC_CACHE_VERSION,
      total: entries.total,
      formats,
      generatedAt: new Date().toISOString(),
    });
    prerenderState.ready = entries.total;
    prerenderState.lastCompletedAt = new Date().toISOString();
    log(`[StaticCache] Prerendered ${entries.total} static cards (${formats.join(',')}) for v${STATIC_CACHE_VERSION}`);
    return {
      success: true,
      version: STATIC_CACHE_VERSION,
      total: entries.total,
      formats,
      cacheDir: CACHE_DIR,
    };
  } catch (err) {
    prerenderState.lastError = err.message;
    throw err;
  } finally {
    prerenderState.running = false;
  }
}

export async function warmMythicUniqueCards(format = 'webp') {
  let warmed = 0;
  for (const itemId of MYTHIC_UNIQUE_ITEM_IDS) {
    try {
      const detail = await getWikiItemDetail(itemId);
      if (detail?.success && detail.data) {
        await getCachedUniqueItemCard(detail.data, format);
        warmed += 1;
        prerenderState.uniqueWarmed = warmed;
      }
    } catch (err) {
      console.warn(`[StaticCache] Warm unique card ${itemId} failed:`, err.message);
    }
    await yieldImmediate();
  }
  return warmed;
}

export function warmStaticAssetsInBackground() {
  if (process.env.SKIP_PRERENDER_WARM === '1' || process.env.NODE_ENV === 'test') {
    return Promise.resolve({ skipped: true });
  }
  if (prerenderState.running) {
    return Promise.resolve({ alreadyRunning: true });
  }
  return (async () => {
    try {
      if (process.env.PRERENDER_WARM_ALL === '1') {
        const res = await prerenderAllStaticAssets({
          formats: ['webp'],
          force: false,
          logger: (msg) => console.log(msg),
        });
        await warmMythicUniqueCards('webp');
        return res;
      }
      // Nhẹ RAM & khởi động Render: chỉ dựng sẵn biểu đồ Ngũ Hành; các thẻ Wiki dựng on-demand & cache LRU + đĩa
      await getStaticElementChartBuffer('webp');
      prerenderState.ready = Math.max(prerenderState.ready, 1);
      prerenderState.lastCompletedAt = new Date().toISOString();
      return { success: true, lightweight: true, ready: prerenderState.ready };
    } catch (err) {
      console.warn('[StaticCache] Background warm failed:', err.message);
      return { success: false, error: err.message };
    }
  })();
}

export function getPrerenderStatus() {
  const entries = getStaticAssetManifestEntries();
  let diskWebpCount = 0;
  try {
    if (fs.existsSync(CACHE_DIR)) {
      diskWebpCount = fs.readdirSync(CACHE_DIR).filter((f) => f.endsWith('.webp')).length;
    }
  } catch {
    diskWebpCount = 0;
  }
  return {
    version: STATIC_CACHE_VERSION,
    manifestVersion: readManifest()?.version || null,
    totalStaticCards: entries.total,
    diskWebpCount,
    staticRamEntries: staticRamCache.size,
    uniqueRamEntries: uniqueRamCache.size,
    dynamicRamEntries: dynamicRamCache.size,
    running: prerenderState.running,
    ready: prerenderState.ready,
    uniqueWarmed: prerenderState.uniqueWarmed,
    lastCompletedAt: prerenderState.lastCompletedAt,
    lastError: prerenderState.lastError,
  };
}
