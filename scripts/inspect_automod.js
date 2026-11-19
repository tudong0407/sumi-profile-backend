import fs from 'fs';
import LZString from 'lz-string';

const rawFile = 'C:/Users/Fuyumi-ASUSF16/.gemini/antigravity/brain/6c4e030b-fb59-4575-8414-9779337f61d9/.system_generated/steps/8520/output.txt';
const content = fs.readFileSync(rawFile, 'utf8');
const match = content.match(/"compressed_tree":"([^"]+)"/);

if (!match) {
  console.log('No compressed_tree found');
  process.exit(1);
}

const compressed = match[1];
const decompressed = LZString.decompressFromBase64(compressed);
const parsed = JSON.parse(decompressed);

fs.writeFileSync('C:/Users/Fuyumi-ASUSF16/.gemini/antigravity/scratch/sumi-profile-backend/automod_fubel_tree.json', JSON.stringify(parsed, null, 2));

console.log('Automod Fubel v2 elements:', parsed.length);
const nodes = parsed.filter(e => !e.source);
nodes.forEach(n => {
  const d = n.data?.data || {};
  const opts = n.data?.node_options || {};
  const title = opts.title || d.name || n.id;
  const type = d.type || n.type;
  let str = `[${n.id}] type=${type} title="${title}"`;
  if (d.matches_pattern) str += ` | pattern=${d.matches_pattern.slice(0, 80)}`;
  if (d.base_value) str += ` | base=${d.base_value.slice(0, 40)}`;
  if (d.timeout) str += ` | timeout=${JSON.stringify(d.timeout)}`;
  console.log(str);
});
