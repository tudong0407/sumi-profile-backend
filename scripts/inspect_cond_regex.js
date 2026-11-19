import fs from 'fs';

const tree = JSON.parse(fs.readFileSync('C:/Users/Fuyumi-ASUSF16/.gemini/antigravity/scratch/sumi-profile-backend/automod_fubel_tree.json', 'utf8'));

const condRegex = tree.find(e => e.id === 'cond_fubel_regex');
console.log('cond_fubel_regex node:', JSON.stringify(condRegex, null, 2));

// Check outgoing edges from cond_fubel_regex
const edges = tree.filter(e => e.source === 'cond_fubel_regex' || e.target === 'cond_fubel_regex');
console.log('\nEdges related to cond_fubel_regex:', JSON.stringify(edges, null, 2));
