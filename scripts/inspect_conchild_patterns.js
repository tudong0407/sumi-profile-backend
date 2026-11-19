import fs from 'fs';

const tree = JSON.parse(fs.readFileSync('C:/Users/Fuyumi-ASUSF16/.gemini/antigravity/scratch/sumi-profile-backend/automod_fubel_tree.json', 'utf8'));

for (let i = 1; i <= 11; i++) {
  const id = `conChild_fubel_${i}`;
  const node = tree.find(e => e.id === id);
  if (!node) {
    console.log(`Node ${id} not found`);
    continue;
  }
  const d = node.data?.data || {};
  console.log(`\n=================== ${id} ===================`);
  console.log('comparison_type:', d.comparison_type);
  console.log('matches_pattern:', d.matches_pattern);
  console.log('comparison_value:', d.comparison_value);
  console.log('length of pattern:', (d.matches_pattern || d.comparison_value || '').length);
}
