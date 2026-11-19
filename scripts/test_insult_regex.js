import fs from 'fs';

const elements = JSON.parse(fs.readFileSync('C:/Users/Fuyumi-ASUSF16/.gemini/antigravity/scratch/sumi-profile-backend/ai_mention_tree.json', 'utf8'));

// Find $else_other_c2a and act_other_wait_ai
const oldEdge = elements.find(e => e.id === 'e_others_to_ai_wait');
console.log('Old edge:', oldEdge);

// The pattern to match insults targeting bot or Fuyumi:
const insultPattern = "\\b(tuất|tuat)\\b|vô dụng|vo dung|làm (j|gì|gi) đ(c|ược)|lam (j|gi) d(c|uoc)|chủ (zà|già)|chu (za|gia)|bot (rác|rac|ngu|cùi|cui|lỏ|lo|chó|cho|óc|oc)|con bot|óc (chó|cho|bò|bo)|\\b(sủa|sua)\\b|\\b(mõm|mom)\\b|ngậm mồm|câm m|thách (m|mày|may)|thach (m|may)|đồ vô tích sự|m làm j";

console.log('Pattern length:', insultPattern.length);
console.log('Regex valid?', new RegExp(insultPattern, 'i') ? 'YES' : 'NO');
console.log('Contains { or }?', /[{}]/.test(insultPattern) ? 'YES' : 'NO');

// Test against actual messages from the user's screenshot:
const testMessages = [
  'con tuất bot đi chung vs chủ zà',
  'm làm j đc t à=))',
  'vô dụng đó làm j đc t đâu',
  'đúng tuất',
  'chào bạn Nhiễm Nhiễm nha',
  'hôm nay bạn thế nào rồi',
  'Tiểu thư Fuyumi xinh đẹp quá'
];

testMessages.forEach(msg => {
  const isMatch = new RegExp(insultPattern, 'i').test(msg);
  console.log(`Msg: "${msg}" -> Match insult? ${isMatch}`);
});
