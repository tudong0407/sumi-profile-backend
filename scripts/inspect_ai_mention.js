import fs from 'fs';
import LZString from 'lz-string';

const rawFile = 'C:/Users/Fuyumi-ASUSF16/.gemini/antigravity/brain/6c4e030b-fb59-4575-8414-9779337f61d9/.system_generated/steps/8498/output.txt';
const content = fs.readFileSync(rawFile, 'utf8');
const match = content.match(/"compressed_tree":"([^"]+)"/);

if (!match) {
  console.log('No compressed_tree found');
  process.exit(1);
}

const compressed = match[1];
const decompressed = LZString.decompressFromBase64(compressed);
const parsed = JSON.parse(decompressed);

console.log('Nodes count:', parsed.nodes?.length);
console.log('Edges count:', parsed.edges?.length);

fs.writeFileSync('C:/Users/Fuyumi-ASUSF16/.gemini/antigravity/scratch/sumi-profile-backend/ai_mention_tree.json', JSON.stringify(parsed, null, 2));

console.log('Saved ai_mention_tree.json');
// Print node labels and action types
parsed.nodes?.forEach(n => {
  console.log(`Node: id=${n.id}, type=${n.type}, label=${n.data?.label || n.data?.name || n.data?.title || ''}, action=${n.data?.action_type || ''}`);
});
