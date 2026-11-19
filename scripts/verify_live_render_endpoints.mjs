import fs from 'fs';
import path from 'path';

const BASE_URL = 'https://sumi-profile-backend.onrender.com';
const artifactsDir = path.resolve('tests/artifacts');
if (!fs.existsSync(artifactsDir)) {
  fs.mkdirSync(artifactsDir, { recursive: true });
}

async function verifyAll() {
  const results = {
    timestamp: new Date().toISOString(),
    host: BASE_URL,
    tests: {}
  };

  console.log(`=== STARTING LIVE RENDER ENDPOINT VERIFICATION ===`);
  console.log(`Target: ${BASE_URL}`);

  // Test 1: GET /health
  console.log('\n--- 1. Testing GET /health ---');
  const t1Start = Date.now();
  const res1 = await fetch(`${BASE_URL}/health`);
  const data1 = await res1.json();
  const t1Duration = Date.now() - t1Start;
  console.log(`HTTP ${res1.status} (${t1Duration}ms)`);
  console.log(JSON.stringify(data1, null, 2));

  results.tests.health = {
    status: res1.status,
    durationMs: t1Duration,
    headers: Object.fromEntries(res1.headers.entries()),
    payload: data1,
    verified: res1.status === 200 && data1.status === 'healthy' && data1.supabase_connected === true
  };

  // Test 2a: GET /api/wiki
  console.log('\n--- 2a. Testing GET /api/wiki (All categories) ---');
  const t2aStart = Date.now();
  const res2a = await fetch(`${BASE_URL}/api/wiki`);
  const data2a = await res2a.json();
  const t2aDuration = Date.now() - t2aStart;
  console.log(`HTTP ${res2a.status} (${t2aDuration}ms)`);
  console.log(`Title: ${data2a.title}`);
  console.log(`Categories count: ${data2a.categories?.length}`);
  const catIds = data2a.categories?.map(c => c.id) || [];
  console.log(`Category IDs: ${catIds.join(', ')}`);

  const expectedCats = ['beginner', 'pets', 'equipment', 'battle', 'economy'];
  const hasAll5Cats = expectedCats.every(c => catIds.includes(c));
  console.log(`All 5 categories present: ${hasAll5Cats}`);

  results.tests.wikiAll = {
    status: res2a.status,
    durationMs: t2aDuration,
    payload: {
      success: data2a.success,
      title: data2a.title,
      categoriesCount: data2a.categories?.length,
      categories: data2a.categories?.map(c => ({ id: c.id, title: c.title, sectionsCount: c.sections?.length }))
    },
    verified: res2a.status === 200 && data2a.success === true && hasAll5Cats
  };

  // Test 2b: GET /api/wiki?category=equipment
  console.log('\n--- 2b. Testing GET /api/wiki?category=equipment ---');
  const t2bStart = Date.now();
  const res2b = await fetch(`${BASE_URL}/api/wiki?category=equipment`);
  const data2b = await res2b.json();
  const t2bDuration = Date.now() - t2bStart;
  console.log(`HTTP ${res2b.status} (${t2bDuration}ms)`);
  console.log(`Category ID: ${data2b.category}`);
  console.log(`Category Title: ${data2b.data?.title}`);
  console.log(`Sections count: ${data2b.data?.sections?.length}`);

  const hasEquipmentData = data2b.success === true && data2b.category === 'equipment' && data2b.data?.id === 'equipment';

  results.tests.wikiCategoryFilter = {
    status: res2b.status,
    durationMs: t2bDuration,
    payload: {
      success: data2b.success,
      category: data2b.category,
      categoryTitle: data2b.data?.title,
      sectionsCount: data2b.data?.sections?.length,
      firstSection: data2b.data?.sections?.[0]?.heading
    },
    verified: res2b.status === 200 && hasEquipmentData
  };

  // Test 3: POST /api/battle/simulate
  console.log('\n--- 3. Testing POST /api/battle/simulate ---');
  const battlePayload = {
    attackerId: '757091869183311872',
    defenderId: '1468649836856344689'
  };
  const t3Start = Date.now();
  const res3 = await fetch(`${BASE_URL}/api/battle/simulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(battlePayload)
  });
  const data3 = await res3.json();
  const t3Duration = Date.now() - t3Start;
  console.log(`HTTP ${res3.status} (${t3Duration}ms)`);
  console.log(`Winner: ${data3.winner?.name} (${data3.winner?.id})`);
  console.log(`Loser: ${data3.loser?.name} (${data3.loser?.id})`);
  console.log(`Turns count: ${data3.turns?.length}`);
  console.log(`Total turns: ${data3.battleSummary?.totalTurns || data3.turns?.length}`);
  console.log(`Summary: ${data3.summary}`);

  // Inspect turns for HAX and element advantage
  const haxTurns = data3.turns?.filter(t => t.haxTriggered || t.action === 'hax_skill' || (t.details && t.details.includes('HAX')));
  const elementTurns = data3.turns?.filter(t => t.elementAdvantage || (t.details && (t.details.includes('khắc chế') || t.details.includes('bị khắc'))));
  console.log(`Turns with HAX: ${haxTurns?.length}`);
  console.log(`Turns with Element Advantage: ${elementTurns?.length}`);
  if (data3.turns?.[0]) {
    console.log('Turn 1 sample:', JSON.stringify(data3.turns[0]));
  }

  results.tests.battleSimulate = {
    status: res3.status,
    durationMs: t3Duration,
    payload: {
      success: data3.success,
      winner: data3.winner,
      loser: data3.loser,
      turnsCount: data3.turns?.length,
      sampleTurn: data3.turns?.[0],
      haxTurnsCount: haxTurns?.length,
      elementAdvantageTurnsCount: elementTurns?.length,
      summary: data3.summary
    },
    verified: res3.status === 200 && data3.success === true && !!data3.winner && (data3.turns?.length > 0)
  };

  // Test 4: GET /api/profile/757091869183311872.png
  console.log('\n--- 4. Testing GET /api/profile/757091869183311872.png ---');
  const t4Start = Date.now();
  const res4 = await fetch(`${BASE_URL}/api/profile/757091869183311872.png`);
  const t4Duration = Date.now() - t4Start;
  console.log(`HTTP ${res4.status} (${t4Duration}ms)`);
  const contentType = res4.headers.get('content-type');
  console.log(`Content-Type: ${contentType}`);

  const imageBuffer = Buffer.from(await res4.arrayBuffer());
  const imageSize = imageBuffer.length;
  console.log(`Image Size: ${imageSize} bytes (${(imageSize / 1024).toFixed(1)} KB)`);

  // Verify PNG signature: 89 50 4E 47 0D 0A 1A 0A
  const sig = imageBuffer.slice(0, 8);
  const isPng = sig[0] === 0x89 && sig[1] === 0x50 && sig[2] === 0x4E && sig[3] === 0x47 &&
                sig[4] === 0x0D && sig[5] === 0x0A && sig[6] === 0x1A && sig[7] === 0x0A;
  console.log(`PNG Magic Signature [89 50 4E 47]: ${isPng ? 'VALID' : 'INVALID'}`);

  // Verify Dimensions from IHDR chunk (bytes 16-24: 4 bytes width, 4 bytes height)
  const width = imageBuffer.readUInt32BE(16);
  const height = imageBuffer.readUInt32BE(20);
  console.log(`Parsed Dimensions: ${width}x${height} px (Expected: 1000x500 px)`);

  const savePath = path.join(artifactsDir, 'live_profile_757091869183311872.png');
  fs.writeFileSync(savePath, imageBuffer);
  console.log(`Saved live PNG to: ${savePath}`);

  // Also query profile JSON to inspect loadout items
  const res4Json = await fetch(`${BASE_URL}/api/profile/757091869183311872?format=json`);
  const profileJson = await res4Json.json();
  const petEquipment = profileJson.data?.pet?.equipment;
  console.log(`Equipped items in profile JSON:`, JSON.stringify(petEquipment, null, 2));

  const hasAll3Slots = petEquipment?.weapon?.item_id && petEquipment?.gem?.item_id && petEquipment?.soul?.item_id;
  console.log(`All 3 loadout slots equipped: ${!!hasAll3Slots}`);

  results.tests.profilePng = {
    status: res4.status,
    durationMs: t4Duration,
    contentType,
    imageSizeBytes: imageSize,
    pngSignatureValid: isPng,
    dimensions: `${width}x${height}`,
    savedPath: savePath,
    equippedItems: petEquipment,
    verified: res4.status === 200 && contentType.includes('image/png') && isPng && width === 1000 && height === 500 && !!hasAll3Slots
  };

  const allPassed = Object.values(results.tests).every(t => t.verified);
  results.allPassed = allPassed;
  console.log(`\n=== ALL 4 LIVE RENDER TESTS PASSED: ${allPassed ? 'YES ✅' : 'NO ❌'} ===\n`);

  fs.writeFileSync(path.join(artifactsDir, 'live_render_verification_results.json'), JSON.stringify(results, null, 2));
  return results;
}

verifyAll().catch(console.error);
