const fuyumiName = '(?:[fƒｆ]+|[pрｐ]+[hнｈ]+)(?:[uvwｗ]+(?:y+[uvwｗ]*[mмｍ]+[i1!|]*|m+[i1!|]*)|y+[uvwｗ]*[mмｍ]+[i1!|]*)';
const separator = '(?:[^a-z0-9\\s]|\\s+(?:\\S+\\s+)?|\\s*)';
const insultBell = '(?:[b86]|13)+[e3€]+[sｓzxх]*[l1iｌ]+[sｓ]?';
const insultBeo = '(?:[b86]|13)+[e3€]+(?:[o0ơờớởỡợ]|[uv])+[12345sｓ]?';
const insultLep = '[l1iｌ]+[e3€]+[pрｐ][sｓ]?';
const insultMap = '(?:[mмｍ][aâ@4]+[pрｐ]|[fƒｆ][aâ@4]+[tтｔ])';

const fullForwardPattern = `(?:^|[^a-z0-9âơờớởỡợ\\u0370-\\u04ff\\uff10-\\uff5a])${fuyumiName}${separator}(?:${insultBell}|${insultBeo}|${insultLep}|${insultMap})(?:$|[^a-z0-9âơờớởỡợ\\u0370-\\u04ff\\uff10-\\uff5a])`;
const reForward = new RegExp(fullForwardPattern, 'i');

const abbreviations = [
  'fubel',
  'fubesl',
  'fumap',
  'fu beo',
  'fu bell',
  'fu besl',
  'fym bell',
  'fym besl',
  'fymi bell',
  'fymi besl'
];

abbreviations.forEach(abbr => {
  console.log(`"${abbr}":`, reForward.test(abbr) ? '✅ MATCHED' : '❌ NOT MATCHED');
});
