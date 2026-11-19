import fs from 'fs';

// Load live trees
const v2 = JSON.parse(fs.readFileSync('C:/Users/Fuyumi-ASUSF16/.gemini/antigravity/scratch/sumi-profile-backend/automod_fubel_v2_live.json', 'utf8'));

// Pattern 1 (Upgraded forward with filler words, repetition, telex besl/bezzl)
// ZERO {m,n} braces! Length <= 500
const fuyumiName = '(?:[fƒｆ]+|[pрｐ]+[hнｈ]+)(?:[uvwｗ]+(?:y+[uvwｗ]*[mмｍ]+[i1!|]*|m+[i1!|]*)|y+[uvwｗ]*[mмｍ]+[i1!|]*)';
const separator = '(?:[^a-z0-9\\s]|\\s+(?:\\S+\\s+)?|\\s*)';
const insultBell = '(?:[b86]|13)+[e3€]+[sｓzxх]*[l1iｌ]+[sｓ]?';
const insultBeo = '(?:[b86]|13)+[e3€]+(?:[o0ơờớởỡợ]|[uv])+[12345sｓ]?';
const insultLep = '[l1iｌ]+[e3€]+[pрｐ][sｓ]?';
const insultMap = '(?:[mмｍ][aâ@4]+[pрｐ]|[fƒｆ][aâ@4]+[tтｔ])';

const upgraded_p1 = `(?:^|[^a-z0-9âơờớởỡợ\\u0370-\\u04ff\\uff10-\\uff5a])${fuyumiName}${separator}(?:${insultBell}|${insultBeo}|${insultLep}|${insultMap})(?:$|[^a-z0-9âơờớởỡợ\\u0370-\\u04ff\\uff10-\\uff5a])`;

// Pattern 6 (Upgraded short & glued forms with besl support)
// e.g. fubel, fubesl, fuyumibesl, fu-besl, fym_besl
const upgraded_p6 = `(?:[fƒｆ]+|[pрｐ]+[hнｈ]+)(?:[uvwｗ]+(?:y+[uvwｗ]*(?:[mмｍ]+[i1!|]*)?)?|y+[uvwｗ]*[mмｍ]+[i1!|]*)[^a-z0-9\\s]*(?:(?:[b86]|13)+[e3€]+(?:[sｓzxх]*[l1iｌ]+|[o0ơờớởỡợ]+|[uv]+)|(?:[b86]|13)+[e3€]+[!|](?:$|[^a-z0-9âơờớởỡợ\\u0370-\\u04ff\\uff10-\\uff5a])|[l1iｌ]+[e3€]+[pрｐ])`;

// Pattern 8 (Upgraded reverse with filler words & telex besl/bezzl)
const upgraded_p8 = `(?:^|[^a-z0-9âơờớởỡợ\\u0370-\\u04ff\\uff10-\\uff5a])(?:${insultBell}|${insultBeo}|${insultLep}|${insultMap})${separator}${fuyumiName}(?:$|[^a-z0-9âơờớởỡợ\\u0370-\\u04ff\\uff10-\\uff5a])`;

console.log('upgraded_p1 length:', upgraded_p1.length, 'no braces?', !/[{}]/.test(upgraded_p1));
console.log('upgraded_p6 length:', upgraded_p6.length, 'no braces?', !/[{}]/.test(upgraded_p6));
console.log('upgraded_p8 length:', upgraded_p8.length, 'no braces?', !/[{}]/.test(upgraded_p8));

// Build pattern dictionary with upgraded ones
const patterns = {};
for (let i = 1; i <= 11; i++) {
  const id = `conChild_fubel_${i}`;
  let val = v2.find(e => e.id === id)?.data?.data?.comparison_value;
  if (i === 1) val = upgraded_p1;
  if (i === 6) val = upgraded_p6;
  if (i === 8) val = upgraded_p8;
  patterns[id] = new RegExp(val, 'i');
}

function check(str) {
  for (const [id, re] of Object.entries(patterns)) {
    if (re.test(str)) return id;
  }
  return null;
}

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
  'fuyumi map',
  'fubel',
  'fubesl',
  'fumap',
  'fym bell',
  'fym besl',
  'fymi bell',
  'fymi besl',
  'bell fuuyumiii',
  'besl fuyumi',
  'bell ii fuuyumiii',
  'besl_fuyumi',
  'beo fuyumi',
  'lep fuyumi'
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
  'fuyumi oi giup minh voi',
  'bell reo mung giang sinh'
];

console.log('\n--- EVALUATING POSITIVES ---');
let failedPos = 0;
positiveCases.forEach(tc => {
  const matched = check(tc);
  if (!matched) {
    console.log(`❌ MISSED: "${tc}"`);
    failedPos++;
  } else {
    console.log(`✅ MATCHED by ${matched}: "${tc}"`);
  }
});

console.log('\n--- EVALUATING NEGATIVES ---');
let failedNeg = 0;
negativeCases.forEach(tc => {
  const matched = check(tc);
  if (matched) {
    console.log(`❌ FALSE POSITIVE by ${matched}: "${tc}"`);
    failedNeg++;
  } else {
    console.log(`✅ PASSED (clean): "${tc}"`);
  }
});

console.log(`\nFinal Score: Positives ${positiveCases.length - failedPos}/${positiveCases.length}, Negatives ${negativeCases.length - failedNeg}/${negativeCases.length}`);
