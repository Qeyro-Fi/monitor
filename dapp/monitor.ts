import { detect } from "./detect.js";
import { alertText } from "./format.js";
import type { Logger } from "./log.js";
import { deliverAll, type DeliveryResult } from "./notify.js";
import type { StateStore } from "./state.js";
import type { Alert, Context, Snapshot } from "./types.js";

export interface MonitorDeps {
  read: () => Promise<Snapshot>;
  /** Deliver alerts; resolves with one result per (alert, webhook). Empty array = no webhooks configured. */
  send: (alerts: Alert[]) => Promise<DeliveryResult[]>;
  state: StateStore;
  now: () => number;
  log: Logger;
  ctx: Context;
  rpcFailureThreshold: number;
  announceStart: boolean;
}

/**
 * One poll of the oracle. Delivery is at-least-once: if every webhook rejected an alert the saved
 * snapshot is not advanced, so the same change is detected and retried on the next poll. If no
 * webhook is configured, alerts are only logged and the snapshot always advances.
 */
export class Monitor {
  constructor(private readonly d: MonitorDeps) {}

  async tick(): Promise<Alert[]> {
    const { d } = this;
    const st = d.state.load();
    let cur: Snapshot;
    try {
      cur = await d.read();
    } catch (e) {
      return this.onReadFailure(st, e);
    }

    const alerts: Alert[] = [];
    if (st.rpcDown) {
      alerts.push({ kind: "rpc_recovered", severity: "info", at: d.now(), title: "RPC reachable again", detail: `The monitor can read the oracle again (block ${cur.blockNumber}).`, snapshot: cur });
    }
    if (!st.last && d.announceStart) {
      alerts.push({ kind: "started", severity: "info", at: d.now(), title: `Monitoring started at level ${cur.level} (${cur.levelName})`, detail: `Oracle ${cur.fresh ? "fresh" : "STALE"}, quorum ${cur.threshold} of ${cur.attesters}.`, snapshot: cur });
    }
    alerts.push(...detect(st.last, cur, d.now()));

    let advance = true;
    if (alerts.length > 0) {
      for (const a of alerts) d.log(a.severity === "info" ? "info" : "warn", alertText(a, d.ctx).split("\n")[0], { kind: a.kind });
      const results = await d.send(alerts);
      // Hold back only when we tried to notify someone and nobody got anything.
      if (results.length > 0 && !results.some((r) => r.ok)) {
        advance = false;
        d.log("error", "no webhook accepted the alert; will retry on the next poll", { targets: [...new Set(results.map((r) => r.target))] });
      } else {
        for (const r of results.filter((x) => !x.ok)) d.log("warn", "a webhook did not accept the alert", { target: r.target, error: r.error, attempts: r.attempts });
      }
    }

    d.state.save({ version: 1, last: advance ? cur : st.last, rpcFailures: 0, rpcDown: advance ? false : st.rpcDown });
    return alerts;
  }

  private async onReadFailure(st: ReturnType<StateStore["load"]>, e: unknown): Promise<Alert[]> {
    const { d } = this;
    const failures = st.rpcFailures + 1;
    const msg = (e as { shortMessage?: string; message?: string }).shortMessage ?? (e as Error).message ?? "read failed";
    d.log("warn", "could not read the oracle", { failures, error: msg });
    const alerts: Alert[] = [];
    let rpcDown = st.rpcDown;
    if (failures >= d.rpcFailureThreshold && !st.rpcDown) {
      alerts.push({
        kind: "rpc_unreachable",
        severity: "critical",
        at: d.now(),
        title: "Cannot read the oracle",
        detail: `${failures} polls in a row failed (${msg}). Threat level changes will not be reported until this recovers. The last known level was ${st.last?.level ?? "unknown"}.`,
      });
      const results = await d.send(alerts);
      // Same at-least-once rule: only mark it announced if someone received it (or nobody is configured).
      rpcDown = results.length === 0 || results.some((r) => r.ok);
    }
    d.state.save({ ...st, rpcFailures: failures, rpcDown });
    return alerts;
  }
}

export async function runLoop(m: Monitor, intervalMs: number, signal: AbortSignal, sleep: (ms: number, s: AbortSignal) => Promise<void>): Promise<void> {
  while (!signal.aborted) {
    await m.tick();
    await sleep(intervalMs, signal);
  }
}

export const abortableSleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    if (signal.aborted) return resolve();
    const t = setTimeout(done, ms);
    function done() {
      signal.removeEventListener("abort", done);
      clearTimeout(t);
      resolve();
    }
    signal.addEventListener("abort", done, { once: true });
  });

export { deliverAll };
