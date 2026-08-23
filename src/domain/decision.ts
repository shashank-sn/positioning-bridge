import type { Enforcement, Finding, FindingSeverity } from "./model.js";

export function severityFor(enforcement: Enforcement): FindingSeverity {
  if (enforcement === "block") return "error";
  if (enforcement === "warn") return "warning";
  return "suggestion";
}

const severityRank: Readonly<Record<FindingSeverity, number>> = {
  error: 0,
  warning: 1,
  suggestion: 2,
};

export function sortFindings(findings: readonly Finding[]): readonly Finding[] {
  return [...findings].sort(
    (left, right) =>
      severityRank[left.severity] - severityRank[right.severity] ||
      left.type.localeCompare(right.type) ||
      left.policyId.localeCompare(right.policyId) ||
      (left.location?.start ?? -1) - (right.location?.start ?? -1),
  );
}

export function deriveDecision(
  findings: readonly Finding[],
): "pass" | "needs_revision" | "blocked" {
  if (findings.some(({ severity }) => severity === "error")) return "blocked";
  if (findings.some(({ severity }) => severity === "warning")) return "needs_revision";
  return "pass";
}
