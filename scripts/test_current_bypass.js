import fs from 'fs';

const tree = JSON.parse(fs.readFileSync('C:/Users/Fuyumi-ASUSF16/.gemini/antigravity/scratch/sumi-profile-backend/automod_fubel_tree.json', 'utf8'));

const testCases = [
  'fuuyumiii ii  bell',
  'FuyumiBesl',
  'fuyumi besl',
  'fuyumi bezzl',
  'fuyumiii ii bell',
  'fuyumi bell',
  'fuuyumiii bell'
];

const patterns = [];
for (let i = 1; i <= 11; i++) {
  const node = tree.find(e => e.id === `conChild_fubel_${i}`);
  const val = node.data?.data?.comparison_value;
  patterns.push({ id: `conChild_fubel_${i}`, regex: new RegExp(val, 'i'), val });
}

testCases.forEach(tc => {
  console.log(`\nTesting: "${tc}"`);
  let matched = false;
  patterns.forEach(p => {
    if (p.regex.test(tc)) {
      console.log(`  MATCHED by ${p.id}`);
      matched = true;
    }
  });
  if (!matched) {
    console.log(`  >>> BYPASSED! NOT MATCHED!`);
  }
});
