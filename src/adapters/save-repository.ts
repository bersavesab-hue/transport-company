import type { GameState } from "../core/domain/model.js";
import { CURRENT_SAVE_VERSION } from "../core/version.js";

const SAVE_KEY = "transport_company_save_v1";
const MIGRATION_BACKUP_KEY = "transport_company_save_before_migration";

export class BrowserSaveRepository {
  load(): GameState | null {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const state = JSON.parse(raw) as GameState;
      if (state.saveVersion < CURRENT_SAVE_VERSION && !localStorage.getItem(MIGRATION_BACKUP_KEY)) {
        localStorage.setItem(MIGRATION_BACKUP_KEY, raw);
      }
      return state;
    } catch {
      return null;
    }
  }

  save(state: GameState): void {
    state.updatedAt = new Date().toISOString();
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  }

  clear(): void {
    localStorage.removeItem(SAVE_KEY);
    localStorage.removeItem(MIGRATION_BACKUP_KEY);
  }
}
