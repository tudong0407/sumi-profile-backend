# Workspace Guardrails — `sumi-profile-backend`

## Handoff & Project Scope Rule
1. **Pre-Read on New Chats:** When starting a new chat or task related to `SuMi`, `Nhiễm Nhiễm`, `BotGhost`, Discord commands/events, or `sumi-profile-backend`, ALWAYS read the top sections of `C:\Users\Fuyumi-ASUSF16\.gemini\antigravity\scratch\Handoff_BotGhost_DiscordSuMi.md` first, and concisely update it upon task completion.
2. **Strict Scope:** ONLY modify `Handoff_BotGhost_DiscordSuMi.md` for tasks related to Discord, Bot `Nhiễm Nhiễm`, BotGhost, Discord commands/events, or `sumi-profile-backend`.
3. **Unrelated Projects:** For any project unrelated to Discord / Bot `Nhiễm Nhiễm` (e.g., an e-commerce website or standalone app), NEVER write to `Handoff_BotGhost_DiscordSuMi.md`; instead create and update a dedicated `Handoff_<ProjectName>.md` inside that project's directory.

## Combat & HAX Full-Integrity Checklist (Mandatory for Any Pet / Pháp Bảo / Linh Vực / Battle Engine Edit)
1. **Exact ID & Registry Parity:** Every `pet_type` in `PET_CATALOG` and `item_id` in `EQUIPMENT_CATALOG` must be wired by exact ID in `V13_PET_HAX` / `V13_EQUIP_HAX`, `haxEngine.js`, `statsCompiler.js`, or `domainEngine.js`, and every property key in `V13_*_HAX` must be executed in both 1v1 (`battleService.js`) and Team (`teamBattleService.js`).
2. **Use Shared Helpers (Never Duplicate):**
   - Cleanse: `cleanseCombatantDebuffs()` (covers all 10 debuff types: `Choáng`, `Mù`, `Trúng Độc`, `Thiêu Đốt`, `Giảm Hồi Máu`, `Giảm ATK`, `Phá Giáp`, `Giảm SPD`, `Giảm ST`, `Giảm Chính Xác`).
   - True Damage Resistance: `getTrueDamageResistPct()` (combines Bảo Ngọc + Linh Vực).
   - Dynamic Turn Order: `getEffectiveCombatSpd()` recomputed at the start of every turn in `battleService.js` and `teamBattleService.js`.
   - Domain Synergy Equipment: `getEquipDomainBonuses()` in `domainEngine.js` must match catalog descriptions 1:1.
   - Deferred On-Hit Effects: Pass `{ deferOnHitEffects: true }` to `triggerAttackPhase()` and apply only when `!damageRecv.nullified`.
3. **Zero Hidden/Truncated Battle Logs:** Never use `[0]` on `healSources` or `startTags`; always record `absorbedByShield` in 1v1 logs (`*(khiên chặn X)*`).
4. **Zero Unicode Windows Emojis:** Keep `src/services/**` and `src/data/**` free of Unicode pictographs; use `emojiHelper.js` tags only.
5. **Mandatory Verification Gate:** Run `node --test tests/tier1-features/hax-full-integrity.test.js` (must pass with 0 failures) before any commit or Render deploy.
