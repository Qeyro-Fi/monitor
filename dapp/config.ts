import { isAddress, type Address } from "viem";
import { FORMATS, type PayloadFormat } from "./format.js";

export interface Config {
  rpcUrl: string;
  oracle: Address;
  expectedChainId?: number;
  pollSeconds: number;
  webhookUrls: string[];
  format: PayloadFormat;
  stateFile: string;
  /** Consecutive failed polls before announcing that the RPC is unreachable. */
  rpcFailureThreshold: number;
  announceStart: boolean;
}

export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

const LOCAL = new Set(["localhost", "127.0.0.1", "[::1]"]);

/** https only, except for localhost where plain http is fine (local receivers, development). */
export function validateWebhookUrl(raw: string): string {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new ConfigError("a WEBHOOK_URLS entry is not a valid URL");
  }
  if (u.protocol === "https:") return raw;
  if (u.protocol === "http:" && LOCAL.has(u.hostname)) return raw;
  throw new ConfigError(`a WEBHOOK_URLS entry (${u.host}) must use https`);
}

function int(env: Record<string, string | undefined>, key: string, def: number, min: number, max: number): number {
  const raw = env[key];
  if (raw === undefined || raw === "") return def;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < min || n > max) throw new ConfigError(`${key} must be an integer between ${min} and ${max}`);
  return n;
}

export function loadConfig(env: Record<string, string | undefined>): Config {
  const rpcUrl = env.RPC_URL?.trim();
  if (!rpcUrl || !/^https?:\/\//.test(rpcUrl)) throw new ConfigError("RPC_URL must be an http(s) URL");
  const oracle = env.ORACLE_ADDRESS?.trim();
  if (!oracle || !isAddress(oracle)) throw new ConfigError("ORACLE_ADDRESS must be a valid address");

  const format = (env.WEBHOOK_FORMAT?.trim() || "generic") as PayloadFormat;
  if (!FORMATS.includes(format)) throw new ConfigError(`WEBHOOK_FORMAT must be one of: ${FORMATS.join(", ")}`);

  const webhookUrls = (env.WEBHOOK_URLS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map(validateWebhookUrl);

  let expectedChainId: number | undefined;
  if (env.EXPECTED_CHAIN_ID) {
    expectedChainId = Number(env.EXPECTED_CHAIN_ID);
    if (!Number.isInteger(expectedChainId) || expectedChainId <= 0) throw new ConfigError("EXPECTED_CHAIN_ID must be a positive integer");
  }
  return {
    rpcUrl,
    oracle,
    expectedChainId,
    pollSeconds: int(env, "POLL_SECONDS", 30, 1, 3600),
    webhookUrls,
    format,
    stateFile: env.STATE_FILE?.trim() || "state.json",
    rpcFailureThreshold: int(env, "RPC_FAILURE_THRESHOLD", 3, 1, 100),
    announceStart: env.ANNOUNCE_START === "true",
  };
}
