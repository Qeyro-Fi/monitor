import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import type { State } from "./types.js";

export const emptyState = (): State => ({ version: 1, rpcFailures: 0, rpcDown: false });

export interface StateStore {
  load(): State;
  save(s: State): void;
}

/** Keeps the last snapshot on disk so a restart does not re-announce what was already announced. */
export class FileState implements StateStore {
  constructor(private readonly path: string, private readonly warn: (m: string) => void = () => {}) {}

  load(): State {
    if (!existsSync(this.path)) return emptyState();
    try {
      const s = JSON.parse(readFileSync(this.path, "utf8")) as State;
      if (s.version !== 1 || typeof s.rpcFailures !== "number") throw new Error("unexpected shape");
      return s;
    } catch {
      // Keep the unreadable file for inspection and start clean rather than crash-looping.
      const aside = `${this.path}.corrupt-${Date.now()}`;
      try {
        renameSync(this.path, aside);
      } catch {
        /* best effort */
      }
      this.warn(`state file was unreadable; moved aside and starting fresh`);
      return emptyState();
    }
  }

  save(s: State): void {
    // Write then rename: a crash mid-write cannot leave a half-written state file.
    const tmp = `${this.path}.tmp`;
    writeFileSync(tmp, JSON.stringify(s, null, 2));
    renameSync(tmp, this.path);
  }
}

export class MemoryState implements StateStore {
  private s: State = emptyState();
  load(): State {
    return structuredClone(this.s);
  }
  save(s: State): void {
    this.s = structuredClone(s);
  }
}
