import fs from 'fs';

const v2 = JSON.parse(fs.readFileSync('C:/Users/Fuyumi-ASUSF16/.gemini/antigravity/scratch/sumi-profile-backend/automod_fubel_v2_live.json', 'utf8'));
const edit = JSON.parse(fs.readFileSync('C:/Users/Fuyumi-ASUSF16/.gemini/antigravity/scratch/sumi-profile-backend/automod_fubel_edit_live.json', 'utf8'));

const fuyumiName = '(?:[fƒｆ]+|[pрｐ]+[hнｈ]+)(?:[uvwｗ]+(?:y+[uvwｗ]*[mмｍ]+[i1!|]*|m+[i1!|]*)|y+[uvwｗ]*[mмｍ]+[i1!|]*)';
const separator = '(?:[^a-z0-9\\s]|\\s+(?:\\S+\\s+)?|\\s*)';
const insultBell = '(?:[b86]|13)+[e3€]+[sｓzxх]*[l1iｌ]+[sｓ]?';
const insultBeo = '(?:[b86]|13)+[e3€]+(?:[o0ơờớởỡợ]|[uv])+[12345sｓ]?';
const insultLep = '[l1iｌ]+[e3€]+[pрｐ][sｓ]?';
const insultMap = '(?:[mмｍ][aâ@4]+[pрｐ]|[fƒｆ][aâ@4]+[tтｔ])';

const upgraded_p1 = `(?:^|[^a-z0-9âơờớởỡợ\\u0370-\\u04ff\\uff10-\\uff5a])${fuyumiName}${separator}(?:${insultBell}|${insultBeo}|${insultLep}|${insultMap})(?:$|[^a-z0-9âơờớởỡợ\\u0370-\\u04ff\\uff10-\\uff5a])`;
const upgraded_p6 = `(?:[fƒｆ]+|[pрｐ]+[hнｈ]+)(?:[uvwｗ]+(?:y+[uvwｗ]*(?:[mмｍ]+[i1!|]*)?)?|y+[uvwｗ]*[mмｍ]+[i1!|]*)[^a-z0-9\\s]*(?:(?:[b86]|13)+[e3€]+(?:[sｓzxх]*[l1iｌ]+|[o0ơờớởỡợ]+|[uv]+)|(?:[b86]|13)+[e3€]+[!|](?:$|[^a-z0-9âơờớởỡợ\\u0370-\\u04ff\\uff10-\\uff5a])|[l1iｌ]+[e3€]+[pрｐ])`;
const upgraded_p8 = `(?:^|[^a-z0-9âơờớởỡợ\\u0370-\\u04ff\\uff10-\\uff5a])(?:${insultBell}|${insultBeo}|${insultLep}|${insultMap})${separator}${fuyumiName}(?:$|[^a-z0-9âơờớởỡợ\\u0370-\\u04ff\\uff10-\\uff5a])`;

function applyUpdates(tree) {
  return tree.map(el => {
    if (el.id === 'conChild_fubel_1' && el.data?.data) {
      return {
        ...el,
        data: {
          ...el.data,
          data: {
            ...el.data.data,
            comparison_value: upgraded_p1
          }
        }
      };
    }
    if (el.id === 'conChild_fubel_6' && el.data?.data) {
      return {
        ...el,
        data: {
          ...el.data,
          data: {
            ...el.data.data,
            comparison_value: upgraded_p6
          }
        }
      };
    }
    if (el.id === 'conChild_fubel_8' && el.data?.data) {
      return {
        ...el,
        data: {
          ...el.data,
          data: {
            ...el.data.data,
            comparison_value: upgraded_p8
          }
        }
      };
    }
    return el;
  });
}

const v2Updated = applyUpdates(v2);
const editUpdated = applyUpdates(edit);

fs.writeFileSync('C:/Users/Fuyumi-ASUSF16/.gemini/antigravity/scratch/sumi-profile-backend/automod_fubel_v2_updated.json', JSON.stringify(v2Updated, null, 2));
fs.writeFileSync('C:/Users/Fuyumi-ASUSF16/.gemini/antigravity/scratch/sumi-profile-backend/automod_fubel_edit_updated.json', JSON.stringify(editUpdated, null, 2));

console.log('Generated automod_fubel_v2_updated.json (elements:', v2Updated.length, ')');
console.log('Generated automod_fubel_edit_updated.json (elements:', editUpdated.length, ')');
