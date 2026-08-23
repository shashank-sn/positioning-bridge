import type { ContentDecision, PositioningPack } from "../domain/index.js";

export const HELP_TEXT = `positioning-bridge 0.1.0

usage:
  positioning-bridge init [--output positioning-bridge.yaml]
  positioning-bridge validate --pack <path> [--json]
  positioning-bridge check --pack <path> (--content <path> | --stdin) \\
    --audience <id> --channel <id> --funnel-stage <id> [--locale <id>] \\
    [--campaign <id>] [--semantic auto|disabled] [--json]
  positioning-bridge serve --pack <path>
`;

export function renderValidation(pack: PositioningPack): string {
  return `valid: ${pack.name} (${pack.id}@${pack.version}, schema ${pack.schemaVersion})`;
}

export function renderDecision(result: ContentDecision): string {
  const lines = [
    `${result.decision}: ${result.pack.id}@${result.pack.version}`,
    `semantic: ${result.capabilities.semantic} (${result.capabilities.semanticDetail})`,
  ];
  for (const finding of result.findings) {
    const location = finding.location
      ? ` line ${finding.location.line}, column ${finding.location.column}`
      : "";
    lines.push(
      `[${finding.severity}] ${finding.type} ${finding.policyId}${location}: ${finding.message}`,
    );
    if (finding.suggestion !== undefined)
      lines.push(`  suggestion: ${finding.suggestion}`);
  }
  if (result.findings.length === 0) lines.push("no findings");
  return lines.join("\n");
}
