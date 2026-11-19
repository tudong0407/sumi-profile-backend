import fs from 'fs';

const tree = JSON.parse(fs.readFileSync('C:/Users/Fuyumi-ASUSF16/.gemini/antigravity/scratch/sumi-profile-backend/automod_fubel_tree.json', 'utf8'));

// Filter all string manipulation nodes
const smNodes = tree.filter(e => e.data?.data?.type === 'string_manipulation');

console.log('Total string_manipulation nodes:', smNodes.length);

const rules = [];
smNodes.forEach(n => {
  const d = n.data?.data || {};
  rules.push({
    id: n.id,
    op: d.text_operation,
    text: d.text,
    match: d.match_text,
    replace: d.replace_text,
    var: d.variable_name
  });
});

fs.writeFileSync('C:/Users/Fuyumi-ASUSF16/.gemini/antigravity/scratch/sumi-profile-backend/scripts/sm_rules.json', JSON.stringify(rules, null, 2));
console.log('Wrote sm_rules.json with', rules.length, 'rules');
