const fuyumiName = '(?:[fƒｆ]+|[pрｐ]+[hнｈ]+)(?:[uvwｗ]+(?:y+[uvwｗ]*[mмｍ]+[i1!|]*|m+[i1!|]*)|y+[uvwｗ]*[mмｍ]+[i1!|]*)';
const separator = '(?:[^a-z0-9\\s]|\\s+(?:\\S+\\s+)?|\\s*)';
const insultBell = '(?:[b86]|13)+[e3€]+[sｓzxх]*[l1iｌ]+[sｓ]?';
const insultBeo = '(?:[b86]|13)+[e3€]+(?:[o0ơờớởỡợ]|[uv])+[12345sｓ]?';
const insultLep = '[l1iｌ]+[e3€]+[pрｐ][sｓ]?';
const insultMap = '(?:[mмｍ][aâ@4]+[pрｐ]|[fƒｆ][aâ@4]+[tтｔ])';

const fullForwardPattern = `(?:^|[^a-z0-9âơờớởỡợ\\u0370-\\u04ff\\uff10-\\uff5a])${fuyumiName}${separator}(?:${insultBell}|${insultBeo}|${insultLep}|${insultMap})(?:$|[^a-z0-9âơờớởỡợ\\u0370-\\u04ff\\uff10-\\uff5a])`;
const fullReversePattern = `(?:^|[^a-z0-9âơờớởỡợ\\u0370-\\u04ff\\uff10-\\uff5a])(?:${insultBell}|${insultBeo}|${insultLep}|${insultMap})${separator}${fuyumiName}(?:$|[^a-z0-9âơờớởỡợ\\u0370-\\u04ff\\uff10-\\uff5a])`;

console.log('Forward Pattern length:', fullForwardPattern.length);
console.log('Reverse Pattern length:', fullReversePattern.length);

const reForward = new RegExp(fullForwardPattern, 'i');
const reReverse = new RegExp(fullReversePattern, 'i');

function testMatches(str) {
  return reForward.test(str) || reReverse.test(str);
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
  // Reverse cases
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

let posFailed = 0;
positiveCases.forEach(tc => {
  const ok = testMatches(tc);
  if (!ok) {
    console.log(`❌ POS FAILED: "${tc}"`);
    posFailed++;
  }
});

let negFailed = 0;
negativeCases.forEach(tc => {
  const bad = testMatches(tc);
  if (bad) {
    console.log(`❌ NEG FAILED (false positive): "${tc}"`);
    negFailed++;
  }
});

console.log(`Result: Pos Failed: ${posFailed}/${positiveCases.length}, Neg Failed: ${negFailed}/${negativeCases.length}`);
