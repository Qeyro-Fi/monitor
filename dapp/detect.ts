import { levelName, levelSeverity } from "./levels.js";
import type { Alert, Snapshot } from "./types.js";

const fmtTime = (s: number) => new Date(s * 1000).toISOString().replace("T", " ").slice(0, 19) + " UTC";

/**
 * Compare the previous snapshot with the current one and describe what changed.
 * Pure: no I/O, no clock. `now` only stamps the alerts.
 *
 * With no previous snapshot nothing is reported (we have nothing to compare to); the caller decides
 * whether to announce that monitoring started.
 */
export function detect(prev: Snapshot | undefined, cur: Snapshot, now: number): Alert[] {
  if (!prev) return [];
  const out: Alert[] = [];
  const base = { at: now, snapshot: cur };

  if (cur.level > prev.level) {
    out.push({
      ...base,
      kind: "level_raised",
      severity: levelSeverity(cur.level),
      title: `Threat level raised to ${cur.level} (${levelName(cur.level)})`,
      detail: `Was ${prev.level} (${levelName(prev.level)}). Evidence ${cur.evidenceHash}. Source: ${cur.sourceURI || "none given"}.`,
    });
  } else if (cur.level < prev.level) {
    out.push({
      ...base,
      kind: "level_lowered",
      // Coming down from a high level is still worth a second look.
      severity: cur.level >= 3 ? "warning" : "info",
      title: `Threat level lowered to ${cur.level} (${levelName(cur.level)})`,
      detail: `Was ${prev.level} (${levelName(prev.level)}). Evidence ${cur.evidenceHash}. Source: ${cur.sourceURI || "none given"}.`,
    });
  } else if (cur.lastUpdate > prev.lastUpdate) {
    out.push({
      ...base,
      kind: "level_refreshed",
      severity: "info",
      title: `Threat level ${cur.level} (${levelName(cur.level)}) re-confirmed`,
      detail: `Attesters refreshed the oracle at ${fmtTime(cur.lastUpdate)} without changing the level.`,
    });
  }

  if (prev.fresh && !cur.fresh) {
    out.push({
      ...base,
      kind: "became_stale",
      // A stale oracle at a high level means fail-closed hooks are restricting accounts on old data.
      severity: cur.level >= 3 ? "critical" : "warning",
      title: "Oracle data is stale",
      detail: `No update since ${fmtTime(cur.lastUpdate)} (max age ${cur.maxAge}s). Fail-closed hooks treat this as a threat; fail-open hooks ignore it. Level shown is ${cur.level}.`,
    });
  } else if (!prev.fresh && cur.fresh) {
    out.push({
      ...base,
      kind: "became_fresh",
      severity: "info",
      title: "Oracle data is fresh again",
      detail: `Last update ${fmtTime(cur.lastUpdate)}.`,
    });
  }

  if (cur.proposalCount > prev.proposalCount) {
    const n = cur.proposalCount - prev.proposalCount;
    out.push({
      ...base,
      kind: "new_proposal",
      severity: "info",
      title: n === 1 ? `New oracle proposal #${cur.proposalCount}` : `${n} new oracle proposals (#${prev.proposalCount + 1} to #${cur.proposalCount})`,
      detail: "An attester opened a proposal. It changes nothing until the threshold of attesters agrees and someone executes it.",
    });
  }

  if (cur.threshold !== prev.threshold || cur.attesters !== prev.attesters) {
    out.push({
      ...base,
      kind: "quorum_changed",
      // Who may change the level is the oracle's root of trust, so any change deserves attention.
      severity: "warning",
      title: `Attester quorum changed to ${cur.threshold} of ${cur.attesters}`,
      detail: `Was ${prev.threshold} of ${prev.attesters}. Check that this was an intended admin action.`,
    });
  }
  return out;
}
