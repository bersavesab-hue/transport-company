import type { GameState } from "../core/domain/model.js";

const SAVE_KEY = "transport_company_save_v1";

export class BrowserSaveRepository {
  load(): GameState | null {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      return raw ? (JSON.parse(raw) as GameState) : null;
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
  }
}
