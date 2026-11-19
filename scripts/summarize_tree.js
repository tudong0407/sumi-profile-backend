import fs from 'fs';

const elements = JSON.parse(fs.readFileSync('C:/Users/Fuyumi-ASUSF16/.gemini/antigravity/scratch/sumi-profile-backend/ai_mention_tree.json', 'utf8'));

console.log('Total elements:', elements.length);
const nodes = elements.filter(e => !e.source);
const edges = elements.filter(e => e.source);
console.log('Nodes:', nodes.length, 'Edges:', edges.length);

nodes.forEach(n => {
  const d = n.data?.data || {};
  const opts = n.data?.node_options || {};
  const title = opts.title || d.name || n.id;
  const type = d.type || n.type;
  let str = `[${n.id}] type=${type} title="${title}"`;
  if (d.matches_pattern) str += ` | pattern=${d.matches_pattern.slice(0, 60)}`;
  if (d.base_value) str += ` | base=${d.base_value.slice(0, 40)}`;
  if (d.action_type) str += ` | action_type=${d.action_type}`;
  if (d.action) str += ` | action=${d.action}`;
  console.log(str);
});
