/**
 * Leveled server logging.
 *
 * Bare `console.*` gave every debug line the same weight as a crash, and there
 * was no way to quiet one without silencing all of them. Everything in `src/`
 * logs through this module; the threshold comes from `LOG_LEVEL` in `.env`
 * (debug | info | warn | error, default info).
 */
export type LogLevel = "debug" | "info" | "warn" | "error";

const ORDER: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

function threshold(): number {
  const raw = (process.env.LOG_LEVEL || "info").toLowerCase();
  return ORDER[raw as LogLevel] ?? ORDER.info;
}

function emit(level: LogLevel, args: unknown[]): void {
  if (ORDER[level] < threshold()) return;
  const line = `[${new Date().toISOString()}] [${level.toUpperCase()}]`;
  // warn/error keep their stream so they land on stderr when the process dies.
  const sink = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  sink(line, ...args);
}

export const log = {
  debug: (...args: unknown[]) => emit("debug", args),
  info: (...args: unknown[]) => emit("info", args),
  warn: (...args: unknown[]) => emit("warn", args),
  error: (...args: unknown[]) => emit("error", args),
};
