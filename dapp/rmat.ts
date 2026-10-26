import type { Alert, Context } from "./types.js";

export type PayloadFormat = "generic" | "slack" | "discord";
export const FORMATS: PayloadFormat[] = ["generic", "slack", "discord"];

const DISCORD_LIMIT = 2000;
const ICON = { info: "[info]", warning: "[warning]", critical: "[CRITICAL]" } as const;

/** Human-readable text, shared by the chat formats and the console log. */
export function alertText(a: Alert, ctx: Context): string {
  const lines = [`${ICON[a.severity]} ${a.title}`, a.detail, `Oracle ${ctx.oracle} on chain ${ctx.chainId}`];
  return lines.join("\n");
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : s.slice(0, max - 1) + "…";
}

/** Build the JSON body a webhook receives. */
export function buildPayload(format: PayloadFormat, a: Alert, ctx: Context): unknown {
  switch (format) {
    case "slack":
      return { text: alertText(a, ctx) };
    case "discord":
      return { content: truncate(alertText(a, ctx), DISCORD_LIMIT) };
    case "generic":
      return {
        kind: a.kind,
        severity: a.severity,
        title: a.title,
        detail: a.detail,
        at: a.at,
        oracle: ctx.oracle,
        chainId: ctx.chainId,
        level: a.snapshot?.level,
        fresh: a.snapshot?.fresh,
        lastUpdate: a.snapshot?.lastUpdate,
        evidenceHash: a.snapshot?.evidenceHash,
        sourceURI: a.snapshot?.sourceURI,
      };
  }
}
