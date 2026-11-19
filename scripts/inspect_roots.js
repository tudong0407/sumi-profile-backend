import fs from 'fs';

const tree = JSON.parse(fs.readFileSync('C:/Users/Fuyumi-ASUSF16/.gemini/antigravity/scratch/sumi-profile-backend/automod_fubel_tree.json', 'utf8'));

const nodes = tree.filter(e => !e.source);
console.log('Nodes count:', nodes.length);

const types = {};
nodes.forEach(n => {
  const t = n.type || n.data?.data?.type || 'unknown';
  types[t] = (types[t] || 0) + 1;
});
console.log('Node types:', types);

// Find nodes that have no incoming edges
const edges = tree.filter(e => e.source && e.target);
const targets = new Set(edges.map(e => e.target));
const rootNodes = nodes.filter(n => !targets.has(n.id));
console.log('Root nodes (no incoming edges):', rootNodes.map(n => ({ id: n.id, type: n.type, data_type: n.data?.data?.type, title: n.data?.node_options?.title })));
