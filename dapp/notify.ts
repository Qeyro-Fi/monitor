import { buildPayload, type PayloadFormat } from "./format.js";
import type { Alert, Context } from "./types.js";

export interface NotifyOptions {
  format: PayloadFormat;
  retries: number;
  timeoutMs: number;
  backoffMs: number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
}

export interface DeliveryResult {
  /** Host only. The full URL is a secret (it often contains a token). */
  target: string;
  ok: boolean;
  attempts: number;
  error?: string;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Host name for logs. Never log the full webhook URL. */
export function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return "invalid-url";
  }
}

async function postOnce(url: string, body: string, o: NotifyOptions): Promise<{ ok: boolean; retry: boolean; error?: string }> {
  const f = o.fetchImpl ?? fetch;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), o.timeoutMs);
  try {
    // redirect: "error" so a webhook cannot bounce us to an internal address or leak the body elsewhere.
    const res = await f(url, { method: "POST", headers: { "content-type": "application/json" }, body, signal: ctl.signal, redirect: "error" });
    if (res.ok) return { ok: true, retry: false };
    // 5xx and 429 are worth retrying; other 4xx mean the request itself is wrong.
    const retry = res.status >= 500 || res.status === 429;
    return { ok: false, retry, error: `HTTP ${res.status}` };
  } catch (e) {
    const aborted = (e as { name?: string }).name === "AbortError";
    return { ok: false, retry: true, error: aborted ? "timed out" : "network error" };
  } finally {
    clearTimeout(timer);
  }
}

/** Deliver one alert to one webhook with retries. Never throws and never exposes the URL. */
export async function deliver(url: string, alert: Alert, ctx: Context, o: NotifyOptions): Promise<DeliveryResult> {
  const body = JSON.stringify(buildPayload(o.format, alert, ctx));
  const sleep = o.sleep ?? defaultSleep;
  let last: { ok: boolean; retry: boolean; error?: string } = { ok: false, retry: false };
  let attempts = 0;
  for (let i = 0; i <= o.retries; i++) {
    attempts++;
    last = await postOnce(url, body, o);
    if (last.ok || !last.retry) break;
    if (i < o.retries) await sleep(o.backoffMs * 2 ** i);
  }
  return { target: hostOf(url), ok: last.ok, attempts, error: last.ok ? undefined : last.error };
}

/** Deliver every alert to every webhook. Returns one result per (alert, webhook). */
export async function deliverAll(urls: string[], alerts: Alert[], ctx: Context, o: NotifyOptions): Promise<DeliveryResult[]> {
  const results: DeliveryResult[] = [];
  for (const a of alerts) for (const u of urls) results.push(await deliver(u, a, ctx, o));
  return results;
}
