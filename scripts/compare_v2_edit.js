import fs from 'fs';

const v2 = JSON.parse(fs.readFileSync('C:/Users/Fuyumi-ASUSF16/.gemini/antigravity/scratch/sumi-profile-backend/automod_fubel_v2_live.json', 'utf8'));
const edit = JSON.parse(fs.readFileSync('C:/Users/Fuyumi-ASUSF16/.gemini/antigravity/scratch/sumi-profile-backend/automod_fubel_edit_live.json', 'utf8'));

for (let i = 1; i <= 11; i++) {
  const id = `conChild_fubel_${i}`;
  const nV2 = v2.find(e => e.id === id);
  const nEdit = edit.find(e => e.id === id);
  const valV2 = nV2?.data?.data?.comparison_value;
  const valEdit = nEdit?.data?.data?.comparison_value;
  console.log(`${id}: identical?`, valV2 === valEdit, 'length:', valV2?.length);
}
