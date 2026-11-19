import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { renderProfileCard } from './src/canvas/profileRenderer.js';
import { renderRankCard } from './src/canvas/rankRenderer.js';
import { getProfileData } from './src/services/profileService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BRAIN_DIR = 'C:/Users/Fuyumi-ASUSF16/.gemini/antigravity/brain/6c4e030b-fb59-4575-8414-9779337f61d9';

async function runTests() {
  console.log('🚀 Bắt đầu kiểm thử Render Thẻ Profile & Thẻ Rank Mini...');
  const outDir = path.join(__dirname, 'output');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  // 1. Thẻ Profile Fuyumi (1000x500)
  const fuyumiData = await getProfileData('757091869183311872');
  console.time('⚡ Render Profile Fuyumi');
  const fuyumiProfileBuf = await renderProfileCard(fuyumiData);
  console.timeEnd('⚡ Render Profile Fuyumi');
  const profileOutLocal = path.join(outDir, 'test_profile_fuyumi_v2.png');
  const profileOutBrain = path.join(BRAIN_DIR, 'test_profile_fuyumi_v2.png');
  fs.writeFileSync(profileOutLocal, fuyumiProfileBuf);
  fs.writeFileSync(profileOutBrain, fuyumiProfileBuf);
  console.log(`✅ Đã lưu Thẻ Profile Fuyumi v2: ${profileOutLocal} (${(fuyumiProfileBuf.length / 1024).toFixed(1)} KB)`);

  // 2. Thẻ Rank Mini Fuyumi (1000x205)
  console.time('⚡ Render Rank Mini Fuyumi');
  const fuyumiRankBuf = await renderRankCard(fuyumiData);
  console.timeEnd('⚡ Render Rank Mini Fuyumi');
  const rankOutLocal = path.join(outDir, 'test_rank_fuyumi.png');
  const rankOutBrain = path.join(BRAIN_DIR, 'test_rank_fuyumi.png');
  fs.writeFileSync(rankOutLocal, fuyumiRankBuf);
  fs.writeFileSync(rankOutBrain, fuyumiRankBuf);
  console.log(`✅ Đã lưu Thẻ Rank Mini Fuyumi: ${rankOutLocal} (${(fuyumiRankBuf.length / 1024).toFixed(1)} KB)`);

  // 3. Thẻ Profile Tu Sĩ Mặc Định (1000x500)
  const defaultData = await getProfileData('123456789012345678');
  console.time('⚡ Render Profile Default');
  const defaultProfileBuf = await renderProfileCard(defaultData);
  console.timeEnd('⚡ Render Profile Default');
  const defaultProfileOutBrain = path.join(BRAIN_DIR, 'test_profile_default_v2.png');
  fs.writeFileSync(defaultProfileOutBrain, defaultProfileBuf);

  // 4. Thẻ Rank Mini Tu Sĩ Mặc Định (1000x205)
  console.time('⚡ Render Rank Mini Default');
  const defaultRankBuf = await renderRankCard(defaultData);
  console.timeEnd('⚡ Render Rank Mini Default');
  const defaultRankOutBrain = path.join(BRAIN_DIR, 'test_rank_default.png');
  fs.writeFileSync(defaultRankOutBrain, defaultRankBuf);

  console.log('🎉 Hoàn thành 100% kiểm thử kết xuất!');
}

runTests().catch(err => {
  console.error('❌ Lỗi kiểm thử:', err);
  process.exit(1);
});
