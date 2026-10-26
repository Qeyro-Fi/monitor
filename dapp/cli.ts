#!/usr/bin/env node
import { makeClient, readSnapshot } from "./oracle.js";
import { ConfigError, loadConfig, type Config } from "./config.js";
import { alertText } from "./format.js";
import { jsonLogger } from "./log.js";
import { Monitor, abortableSleep, runLoop } from "./monitor.js";
import { deliverAll, hostOf } from "./notify.js";
import { FileState } from "./state.js";
import type { Alert, Context } from "./types.js";

const HELP = `qeyro-monitor: watch the QEYRO FI Threat Oracle and send alerts

Usage: qeyro-monitor <command>

  run              Poll the oracle forever; send an alert when something changes
  once             Read the oracle once and print the snapshot as JSON (no alerts)
  check-config     Validate the environment and the RPC, then exit
  send-test-alert  Send one clearly-labelled alert to every webhook

Environment
  RPC_URL                 JSON-RPC endpoint                         (required)
  ORACLE_ADDRESS          ThreatOracle contract                     (required)
  WEBHOOK_URLS            comma-separated https URLs                (optional; without it alerts are only logged)
  WEBHOOK_FORMAT          generic | slack | discord                 (default generic)
  POLL_SECONDS            seconds between polls                     (default 30)
  STATE_FILE              where the last snapshot is kept           (default state.json)
  EXPECTED_CHAIN_ID       refuse to run on any other chain          (optional)
  RPC_FAILURE_THRESHOLD   failed polls before an "unreachable" alert (default 3)
  ANNOUNCE_START          true = send an alert on the first run     (default false)
`;

async function connect(cfg: Config) {
  const client = makeClient(cfg.rpcUrl);
  const chainId = await client.getChainId();
  if (cfg.expectedChainId !== undefined && cfg.expectedChainId !== chainId) {
    throw new ConfigError(`RPC reports chain ${chainId} but EXPECTED_CHAIN_ID is ${cfg.expectedChainId}; refusing to continue`);
  }
  const code = await client.getCode({ address: cfg.oracle });
  if (!code || code === "0x") throw new ConfigError(`no contract at ORACLE_ADDRESS on chain ${chainId}`);
  return { client, chainId };
}

async function main() {
  const cmd = process.argv[2] ?? "help";
  if (cmd === "help" || cmd === "--help" || cmd === "-h") return void console.log(HELP);
  if (!["run", "once", "check-config", "send-test-alert"].includes(cmd)) throw new ConfigError(`unknown command "${cmd}". Run with --help.`);

  const cfg = loadConfig(process.env);
  const { client, chainId } = await connect(cfg);
  const ctx: Context = { oracle: cfg.oracle, chainId };

  if (cmd === "check-config") {
    const s = await readSnapshot(client, cfg.oracle);
    console.log(`ok: chain ${chainId}, oracle level ${s.level} (${s.levelName}), ${s.fresh ? "fresh" : "STALE"}, ${cfg.webhookUrls.length} webhook(s): ${cfg.webhookUrls.map(hostOf).join(", ") || "none"}`);
    return;
  }
  if (cmd === "once") {
    console.log(JSON.stringify(await readSnapshot(client, cfg.oracle), null, 2));
    return;
  }

  const notifyOpts = { format: cfg.format, retries: 3, timeoutMs: 8_000, backoffMs: 1_000 };
  const send = (alerts: Alert[]) => deliverAll(cfg.webhookUrls, alerts, ctx, notifyOpts);

  if (cmd === "send-test-alert") {
    if (cfg.webhookUrls.length === 0) throw new ConfigError("WEBHOOK_URLS is empty: nothing to send to");
    const a: Alert = { kind: "started", severity: "info", at: Math.floor(Date.now() / 1000), title: "QEYRO FI monitor: connectivity check", detail: "This is a manual check message. It does not mean the threat level changed." };
    console.log(alertText(a, ctx));
    const results = await send([a]);
    for (const r of results) console.log(`${r.target}: ${r.ok ? "delivered" : `FAILED (${r.error})`} after ${r.attempts} attempt(s)`);
    if (results.some((r) => !r.ok)) process.exitCode = 1;
    return;
  }

  const monitor = new Monitor({
    read: () => readSnapshot(client, cfg.oracle),
    send,
    state: new FileState(cfg.stateFile, (m) => jsonLogger("warn", m)),
    now: () => Math.floor(Date.now() / 1000),
    log: jsonLogger,
    ctx,
    rpcFailureThreshold: cfg.rpcFailureThreshold,
    announceStart: cfg.announceStart,
  });
  const ac = new AbortController();
  for (const sig of ["SIGINT", "SIGTERM"] as const) process.on(sig, () => ac.abort());
  jsonLogger("info", "monitor started", { oracle: cfg.oracle, chainId, pollSeconds: cfg.pollSeconds, webhooks: cfg.webhookUrls.map(hostOf), format: cfg.format });
  await runLoop(monitor, cfg.pollSeconds * 1000, ac.signal, abortableSleep);
  jsonLogger("info", "monitor stopped");
}

main().catch((e: unknown) => {
  const m = e instanceof ConfigError ? e.message : (e as { shortMessage?: string; message?: string }).shortMessage ?? (e as Error).message ?? String(e);
  console.error(`error: ${m}`);
  process.exit(1);
});
