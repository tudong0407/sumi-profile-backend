import fs from 'fs';

const tree = JSON.parse(fs.readFileSync('C:/Users/Fuyumi-ASUSF16/.gemini/antigravity/scratch/sumi-profile-backend/automod_fubel_tree.json', 'utf8'));

const edges = tree.filter(e => e.source && e.target);

for (let i = 1; i <= 11; i++) {
  const id = `conChild_fubel_${i}`;
  const out = edges.filter(e => e.source === id);
  console.log(`${id} targets:`, out.map(e => `${e.target} (${e.sourceHandle || 'def'} -> ${e.targetHandle || 'def'})`));
}
