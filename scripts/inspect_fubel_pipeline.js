import fs from 'fs';

const tree = JSON.parse(fs.readFileSync('C:/Users/Fuyumi-ASUSF16/.gemini/antigravity/scratch/sumi-profile-backend/automod_fubel_tree.json', 'utf8'));

const nodes = tree.filter(e => !e.source);
const edges = tree.filter(e => e.source && e.target);

// Find trigger
const trigger = nodes.find(n => n.type === 'trigger' || n.data?.data?.type === 'trigger');
console.log('Trigger node:', trigger.id, trigger.data?.data);

// Let's traverse the chain starting from trigger
let visited = new Set();
let curr = trigger.id;

while (curr) {
  visited.add(curr);
  const node = nodes.find(n => n.id === curr);
  const d = node?.data?.data || {};
  const opts = node?.data?.node_options || {};
  
  if (d.type === 'maths' || opts.title === 'Manipulate some text') {
    console.log(`[${node.id}] Manipulate: ${d.text_operation} | text: "${d.text}" | match: "${d.match_text}" | replace: "${d.replace_text}" | store: ${d.variable_name}`);
  } else if (d.type === 'condition') {
    console.log(`[${node.id}] Condition: ${opts.title} | base: ${d.base_value}`);
  } else if (d.type === 'variable') {
    console.log(`[${node.id}] Variable: ${d.variable_name} = "${d.variable_value}"`);
  } else {
    console.log(`[${node.id}] Type: ${d.type || node.type} | Title: ${opts.title}`);
  }

  // Find next connected edge (non-condition branch)
  const outEdges = edges.filter(e => e.source === curr);
  if (outEdges.length === 0) break;
  if (outEdges.length === 1) {
    curr = outEdges[0].target;
  } else {
    console.log(`Multiple branches from ${curr}:`, outEdges.map(e => e.target));
    break;
  }
}
