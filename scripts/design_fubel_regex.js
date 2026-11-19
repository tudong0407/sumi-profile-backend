import fs from 'fs';

// Existing patterns in automod_fubel_tree.json
const tree = JSON.parse(fs.readFileSync('C:/Users/Fuyumi-ASUSF16/.gemini/antigravity/scratch/sumi-profile-backend/automod_fubel_tree.json', 'utf8'));

const p1 = tree.find(e => e.id === 'conChild_fubel_1')?.data?.data?.comparison_value;
const p6 = tree.find(e => e.id === 'conChild_fubel_6')?.data?.data?.comparison_value;

console.log('Original p1 length:', p1.length);
console.log('Original p6 length:', p6.length);

// Test cases to catch
const positiveCases = [
  'fuuyumiii ii  bell',
  'FuyumiBesl',
  'fuyumi besl',
  'fuyumi bezzl',
  'fuyumi bexl',
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
  'fuyumi-besl'
];

// Negative cases (MUST NOT MATCH)
const negativeCases = [
  'fuyumi oi',
  'fuyumi xinh dep',
  'fuyumi de thuong qua',
  'fuyumi oi to bao nay',
  'chiec chuong bell reo vang',
  'fuyumi i love you',
  'fuyumi la nhat',
  'fuyumi la so mot'
];

console.log('Loaded test cases');
