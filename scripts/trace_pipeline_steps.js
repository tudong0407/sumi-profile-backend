import fs from 'fs';

const tree = JSON.parse(fs.readFileSync('C:/Users/Fuyumi-ASUSF16/.gemini/antigravity/scratch/sumi-profile-backend/automod_fubel_tree.json', 'utf8'));

const nodes = tree.filter(e => !e.source);
const edges = tree.filter(e => e.source && e.target);

let curr = 'root';
const visited = new Set();

const pipeline = [];

while (curr) {
  visited.add(curr);
  const node = nodes.find(n => n.id === curr);
  const d = node?.data?.data || {};
  const opts = node?.data?.node_options || {};

  pipeline.push({
    id: curr,
    type: d.type || node?.type,
    title: opts.title,
    text_operation: d.text_operation,
    text: d.text,
    match_text: d.match_text,
    replace_text: d.replace_text,
    variable_name: d.variable_name,
    variable_value: d.variable_value,
    base_value: d.base_value
  });

  const outEdges = edges.filter(e => e.source === curr && !e.target.startsWith('conChild') && e.target !== '$else');
  if (outEdges.length === 0) break;
  // If multiple, follow the main action edge
  const mainEdge = outEdges.find(e => e.sourceHandle === 'action' || !e.sourceHandle) || outEdges[0];
  curr = mainEdge.target;
  if (visited.has(curr)) break;
}

console.log(`Pipeline steps count: ${pipeline.length}`);
pipeline.forEach((step, idx) => {
  if (step.text_operation) {
    console.log(`[${idx}] ${step.id}: op=${step.text_operation} | text=${step.text} | match=${step.match_text} | rep=${step.replace_text} | store=${step.variable_name}`);
  } else {
    console.log(`[${idx}] ${step.id}: type=${step.type} | title=${step.title} | var=${step.variable_name}`);
  }
});
