import fs from 'fs';

const tree = JSON.parse(fs.readFileSync('C:/Users/Fuyumi-ASUSF16/.gemini/antigravity/scratch/sumi-profile-backend/automod_fubel_tree.json', 'utf8'));

console.log('Total elements in automod_fubel_tree:', tree.length);

const conditions = tree.filter(e => e.data?.data?.type === 'condition' || e.data?.data?.matches_pattern);

console.log('Condition count:', conditions.length);

conditions.forEach((c, idx) => {
  const d = c.data?.data || {};
  const opts = c.data?.node_options || {};
  console.log(`\n--- Condition #${idx + 1} [ID: ${c.id}] Title: "${opts.title || ''}" ---`);
  console.log(`comparison_type: ${d.comparison_type}`);
  console.log(`base_value: ${d.base_value}`);
  console.log(`matches_pattern: ${d.matches_pattern}`);
  console.log(`comparison_value: ${d.comparison_value}`);
});
