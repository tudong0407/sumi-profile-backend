/**
 * Facade module cho Pet Battle Simulation Service
 * Cung cấp hàm mô phỏng chiến đấu theo đúng hợp đồng PROJECT.md
 */
export {
  simulateBattle,
  getCachedBattleReport,
  loadBattleReport,
  cacheBattleReport,
  getCachedBattleFrame,
  setCachedBattleFrame,
  getBattleFrameMeta,
  getBattleLogPayload,
  renderBattleLogHtml,
  renderSingleBattleTurnOnDemand,
  renderAllBattleTurnsOnDemand,
  buildAdaptiveFrames,
  withCanvasRenderSlot,
  renderBattleCardQueued,
} from './battleEngine/battleService.js';
export { compileCombatant } from './battleEngine/statsCompiler.js';
export { getElementalAdvantage, normalizeElement, NGU_HANH_CYCLE } from './battleEngine/elementalMatrix.js';
export { hasHax } from './battleEngine/haxEngine.js';
