export type LogLevel = "info" | "warn" | "error";

export interface Logger {
  (level: LogLevel, msg: string, fields?: Record<string, unknown>): void;
}

/** One JSON object per line, easy for journald, Docker and log shippers. */
export const jsonLogger: Logger = (level, msg, fields) => {
  const line = JSON.stringify({ t: new Date().toISOString(), level, msg, ...fields });
  (level === "info" ? console.log : console.error)(line);
};

export const silentLogger: Logger = () => {};
