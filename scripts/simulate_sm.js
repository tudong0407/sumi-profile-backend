import fs from 'fs';

const rules = JSON.parse(fs.readFileSync('C:/Users/Fuyumi-ASUSF16/.gemini/antigravity/scratch/sumi-profile-backend/scripts/sm_rules.json', 'utf8'));

function simulate(input) {
  let vars = {
    message_content: input,
    norm_msg: input,
    clean_msg: input
  };

  rules.forEach((r, idx) => {
    let srcText = r.text || '';
    // Replace variable placeholders in srcText
    for (const [k, v] of Object.entries(vars)) {
      if (v !== undefined) {
        srcText = srcText.replaceAll(`{${k}}`, v);
      }
    }

    let out = srcText;
    if (r.op === 'lowercase') {
      out = srcText.toLowerCase();
    } else if (r.op === 'replace') {
      let rep = r.replace ?? '';
      for (const [k, v] of Object.entries(vars)) {
        if (v !== undefined) {
          rep = rep.replaceAll(`{${k}}`, v);
        }
      }
      try {
        if (r.match) {
          const re = new RegExp(r.match, 'g');
          out = srcText.replace(re, rep);
        }
      } catch (e) {
        out = srcText.replaceAll(r.match, rep);
      }
    }

    if (r.var) {
      vars[r.var] = out;
    }
  });

  return vars;
}

const tests = [
  'fuuyumiii ii  bell',
  'FuyumiBesl',
  'fuyumi bell',
  'fuyumi besl'
];

tests.forEach(t => {
  const res = simulate(t);
  console.log(`\nInput: "${t}"`);
  console.log(`norm_msg: "${res.norm_msg}"`);
});
