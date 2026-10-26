import type { Severity } from "./types.js";

export const LEVEL_NAMES = ["Nominal", "Early Warning", "Elevated", "High", "Critical", "Emergency"] as const;

export const levelName = (level: number): string => LEVEL_NAMES[level] ?? `Unknown (${level})`;

/** How loudly to announce a level. Level 3+ is "act now" territory for most hook policies. */
export function levelSeverity(level: number): Severity {
  if (level >= 4) return "critical";
  if (level >= 2) return "warning";
  return "info";
}
