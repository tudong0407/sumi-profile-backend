import fs from 'fs';
import path from 'path';

const stateDir = 'C:/Users/Fuyumi-ASUSF16/.gemini/antigravity/brain/4a161628-aab0-4439-a614-0ea963d59d98/scratch/.agents/teamwork/worker_live_deploy_gen3';
if (!fs.existsSync(stateDir)) {
  fs.mkdirSync(stateDir, { recursive: true });
}

const briefing = `# BRIEFING — 2026-11-20T05:17:00Z

## Mission
Git push to origin main to trigger Render deploy, verify all live Render endpoints, perform live Discord / BotGhost verification, and compile full evidence report.

## 🔒 My Identity
- Archetype: worker_live_deploy_gen3
- Roles: implementer, qa, specialist
- Working directory: C:\\Users\\Fuyumi-ASUSF16\\.gemini\\antigravity\\scratch\\sumi-profile-backend
- State folder: C:\\Users\\Fuyumi-ASUSF16\\.gemini\\antigravity\\brain\\4a161628-aab0-4439-a614-0ea963d59d98\\scratch\\.agents\\teamwork\\worker_live_deploy_gen3
- Original parent: 722ff690-2399-4747-ab65-4bd6c4439ada
- Milestone: M5 / Live Real-World Deployment & Verification

## 🔒 Key Constraints
- Test thực tế: Git push to main, verify live Render host (https://sumi-profile-backend.onrender.com).
- Verify 4 live endpoints: /health, /api/wiki, /api/battle/simulate, /api/profile/757091869183311872.png.
- Verify live Discord / BotGhost on Guild 1026096141273661450 via CDP port 9222.
- Automod exemption >= 137, Fuyumi 757091869183311872 full skip, Hanabira Mei pos 124 < 137 non-staff.
- DO NOT CHEAT: Genuine HTTP requests, real image validation, real git push.
- Evidence output to docs/LIVE_VERIFICATION_EVIDENCE.md and handoff.md.

## Current Parent
- Conversation ID: 722ff690-2399-4747-ab65-4bd6c4439ada
- Updated: 2026-11-20T05:17:00Z

## Task Summary
- **What to build**: Git push and verify live production endpoints & Discord bot integration.
- **Success criteria**: All live endpoints return 200/expected payloads, live PNG valid 1000x500 with items, CDP inspection logged.
- **Interface contracts**: PROJECT.md interface contracts.
- **Code layout**: PROJECT.md code layout.

## Key Decisions Made
- Push origin main to trigger Render auto-deploy.
- Wait for Render build to finish, poll /health.
- Save live profile PNG to disk, check signature 89 50 4E 47 and dimensions.

## Loaded Skills
- **Source**: C:\\Users\\Fuyumi-ASUSF16\\.gemini\\config\\skills\\sumi-discord-roles\\SKILL.md
- **Core methodology**: Discord role hierarchy for SuMi Family (1026096141273661450), cutoff >= 137.
- **Source**: C:\\Users\\Fuyumi-ASUSF16\\.gemini\\config\\skills\\botghost-builder\\SKILL.md
- **Core methodology**: BotGhost builder patterns, CDP inspection on port 9222, regex bounds, pacing rest blocks.

## Change Tracker
- **Files modified**: None yet
- **Build status**: Ready to test
- **Pending issues**: None

## Quality Status
- **Build/test result**: Ready
- **Lint status**: Clean
- **Tests added/modified**: Live real-world verification suite

## Artifact Index
- docs/LIVE_VERIFICATION_EVIDENCE.md — Live verification evidence
`;

fs.writeFileSync(path.join(stateDir, 'BRIEFING.md'), briefing, 'utf-8');
console.log('BRIEFING.md written successfully');
