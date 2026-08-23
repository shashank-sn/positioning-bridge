import type { TextLocation } from "./model.js";

export interface SignalMatch {
  readonly signal: string;
  readonly location: TextLocation;
}

function escapeRegularExpression(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function signalPattern(signal: string): RegExp {
  const parts = signal.trim().split(/\s+/u).map(escapeRegularExpression);
  const first = signal.trim()[0] ?? "";
  const last = signal.trim().at(-1) ?? "";
  const startBoundary = /[\p{L}\p{N}_]/u.test(first) ? "(?<![\\p{L}\\p{N}_])" : "";
  const endBoundary = /[\p{L}\p{N}_]/u.test(last) ? "(?![\\p{L}\\p{N}_])" : "";
  return new RegExp(`${startBoundary}${parts.join("\\s+")}${endBoundary}`, "giu");
}

function locate(content: string, start: number, quote: string): TextLocation {
  const before = content.slice(0, start);
  const line = before.split("\n").length;
  const lastBreak = before.lastIndexOf("\n");
  const column = start - lastBreak;
  return { start, end: start + quote.length, line, column, quote };
}

export function findSignalMatches(
  content: string,
  signals: readonly string[],
): readonly SignalMatch[] {
  const matches: SignalMatch[] = [];
  for (const signal of signals) {
    const pattern = signalPattern(signal);
    for (const match of content.matchAll(pattern)) {
      matches.push({ signal, location: locate(content, match.index, match[0]) });
    }
  }
  return matches.sort(
    (left, right) =>
      left.location.start - right.location.start ||
      left.signal.localeCompare(right.signal),
  );
}

export function firstSignalMatch(
  content: string,
  signals: readonly string[],
): SignalMatch | undefined {
  return findSignalMatches(content, signals)[0];
}
