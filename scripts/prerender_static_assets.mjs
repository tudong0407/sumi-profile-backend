import {
  prerenderAllStaticAssets,
  warmMythicUniqueCards,
  getPrerenderStatus,
} from '../src/services/staticAssetCacheService.js';

async function main() {
  const force = process.argv.includes('--force');
  const includePng = process.argv.includes('--all-formats');
  const formats = includePng ? ['webp', 'png'] : ['webp'];
  const t0 = Date.now();
  const res = await prerenderAllStaticAssets({
    formats,
    force,
    logger: (m) => console.log(m),
  });
  let uniqueWarmed = 0;
  try {
    uniqueWarmed = await warmMythicUniqueCards('webp');
  } catch (err) {
    console.warn('[Prerender] Unique card warm skipped/partial:', err.message);
  }
  const dt = Date.now() - t0;
  console.log('PRERENDER_DONE:', JSON.stringify({ ...res, uniqueWarmed, ms: dt, status: getPrerenderStatus() }));
}

main().catch((err) => {
  console.error('PRERENDER_ERR:', err);
  process.exit(1);
});
