import fs from 'fs';

const tree = JSON.parse(fs.readFileSync('C:/Users/Fuyumi-ASUSF16/.gemini/antigravity/scratch/sumi-profile-backend/automod_fubel_tree.json', 'utf8'));

// Find start / trigger
const nodes = tree.filter(e => !e.source);
const edges = tree.filter(e => e.source && e.target);

console.log('All nodes count:', nodes.length);

// Trace from entry or list actions
nodes.forEach(n => {
  const d = n.data?.data || {};
  if (d.type === 'trigger' || n.type === 'trigger') {
    console.log('TRIGGER:', n.id, n.data?.node_options?.title);
  }
});

// Let's find predecessors of cond_fubel_regex
function getPredecessors(nodeId) {
  const preds = [];
  edges.forEach(e => {
    if (e.target === nodeId) {
      preds.push({ from: e.source, handle: e.sourceHandle, toHandle: e.targetHandle });
    }
  });
  return preds;
}

let curr = 'cond_fubel_regex';
console.log('Predecessors chain backwards:');
for (let step = 0; step < 15; step++) {
  const preds = getPredecessors(curr);
  if (preds.length === 0) break;
  const p = preds[0];
  const node = nodes.find(n => n.id === p.from);
  const d = node?.data?.data || {};
  console.log(`Step ${step + 1}: ${p.from} (${node?.data?.node_options?.title || node?.type}) -> ${curr}`);
  if (d.variable_name) console.log(`   var: ${d.variable_name} = ${d.variable_value?.slice(0, 50)}`);
  if (d.text) console.log(`   text: ${d.text?.slice(0, 50)}`);
  curr = p.from;
}
