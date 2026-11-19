// Test comprehensive regexes

const positiveCases = [
  'fuuyumiii ii  bell',
  'FuyumiBesl',
  'fuyumi besl',
  'fuyumi bezzl',
  'fuyumi bexl',
  'fuyumi bezl',
  'fuyumi bell',
  'fuuyumiii bell',
  'fuyumiii ii bell',
  'fuyumi ii bell',
  'fuyumi  ii   bell',
  'fuyumi oi bell',
  'fuyumi a bell',
  'fuyumi con bell',
  'fuyumi do bell',
  'fuyumi la bell',
  'fuuyumi besl',
  'fuuyumiii besl',
  'fuyumi beell',
  'fuyumi beessl',
  'fuyumiiiBesl',
  'fuyumi_besl',
  'fuyumi-besl',
  'fuyumi.besl',
  'phuyumi bell',
  'phuyumiii ii bell',
  'fuyumi beo',
  'fuuyumi beo',
  'fuyumi lep',
  'fuyumi map'
];

const negativeCases = [
  'fuyumi oi',
  'fuyumi xinh dep',
  'fuyumi de thuong qua',
  'fuyumi oi to bao nay',
  'chiec chuong bell reo vang',
  'fuyumi i love you',
  'fuyumi la nhat',
  'fuyumi la so mot',
  'em chao fuyumi a',
  'fuyumi oi giup minh voi'
];

// Proposed Regex for Fuyumi -> Insult (covering bell, besl, beo, lep, map, fat)
// Let's craft regexes and test their length and accuracy!

// Pattern A: Focus on Fuyumi + (bell/besl/beo/lep) with middle filler word & telex bypass
// ZERO {m,n} braces!
const fuyumiName = '(?:[fƒｆ]+|[pрｐ]+[hнｈ]+)(?:[uvwｗ]+(?:y+[uvwｗ]*[mмｍ]+[i1!|]*|m+[i1!|]*)|y+[uvwｗ]*[mмｍ]+[i1!|]*)';
const separator = '(?:[^\\w\\s]|\\s+(?:\\S+\\s+)?|\\s*)';
const insultBell = '(?:[b86]|13)+[e3€]+[sｓzxх]*[l1iｌ]+[sｓ]?';
const insultBeo = '(?:[b86]|13)+[e3€]+(?:[o0ơờớởỡợ]|[uv])+[12345sｓ]?';
const insultLep = '[l1iｌ]+[e3€]+[pрｐ][sｓ]?';
const insultMap = '(?:[mмｍ][aâ@4]+[pрｐ]|[fƒｆ][aâ@4]+[tтｔ])';

const fullForwardPattern = `(?:^|[^a-z0-9âơờớởỡợ\\u0370-\\u04ff\\uff10-\\uff5a])${fuyumiName}${separator}(?:${insultBell}|${insultBeo}|${insultLep}|${insultMap})(?:$|[^a-z0-9âơờớởỡợ\\u0370-\\u04ff\\uff10-\\uff5a])`;

console.log('fullForwardPattern length:', fullForwardPattern.length);

const reA = new RegExp(fullForwardPattern, 'i');

console.log('\n--- POSITIVE TESTS ---');
let posFailed = 0;
positiveCases.forEach(tc => {
  const ok = reA.test(tc);
  if (!ok) {
    console.log(`❌ FAILED (not matched): "${tc}"`);
    posFailed++;
  } else {
    console.log(`✅ MATCHED: "${tc}"`);
  }
});

console.log('\n--- NEGATIVE TESTS ---');
let negFailed = 0;
negativeCases.forEach(tc => {
  const bad = reA.test(tc);
  if (bad) {
    console.log(`❌ FALSE POSITIVE: "${tc}"`);
    negFailed++;
  } else {
    console.log(`✅ PASSED (clean): "${tc}"`);
  }
});

console.log(`\nSummary: Positive failed: ${posFailed}/${positiveCases.length}, Negative failed: ${negFailed}/${negativeCases.length}`);
