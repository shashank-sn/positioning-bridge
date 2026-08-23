import { Buffer } from "node:buffer";
import { deriveDecision, severityFor, sortFindings } from "./decision.js";
import { resolvePositioningContext } from "./context.js";
import { findSignalMatches, firstSignalMatch } from "./text.js";
import type {
  Campaign,
  CampaignProhibition,
  Competitor,
  ContentContext,
  ContentDecision,
  Finding,
  FindingEvidence,
  FindingType,
  MessageCoverage,
  PositioningClaim,
  PositioningPack,
  PositioningPillar,
  PositioningRule,
  SourceRecord,
  TextLocation,
} from "./model.js";

export const DEFAULT_MAX_CONTENT_BYTES = 200_000;

export interface EvaluationOptions {
  readonly now?: Date;
  readonly maxContentBytes?: number;
}

export class ContentEvaluationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContentEvaluationError";
  }
}

function dateOnly(now: Date): string {
  return now.toISOString().slice(0, 10);
}

export function sourceIsActive(source: SourceRecord, now: Date): boolean {
  return (
    source.status === "approved" &&
    (source.expiresAt === undefined || source.expiresAt >= dateOnly(now))
  );
}

export function evidenceForSourceIds(
  pack: PositioningPack,
  sourceIds: readonly string[],
  now: Date,
): readonly FindingEvidence[] {
  return sourceIds
    .map((sourceId) => {
      const source = pack.sources.find(({ id }) => id === sourceId);
      if (source === undefined)
        throw new Error(`validated pack is missing source '${sourceId}'`);
      return {
        sourceId,
        label: source.label,
        status: source.status,
        visibility: source.visibility,
        active: sourceIsActive(source, now),
        ...(source.uri === undefined ? {} : { uri: source.uri }),
        ...(source.expiresAt === undefined ? {} : { expiresAt: source.expiresAt }),
      } satisfies FindingEvidence;
    })
    .sort((left, right) => left.sourceId.localeCompare(right.sourceId));
}

export type MessageSupport =
  { readonly active: true } | { readonly active: false; readonly rationale: string };

export function claimSupport(
  pack: PositioningPack,
  claim: PositioningClaim,
  now: Date,
): MessageSupport {
  if (claim.status !== "approved") {
    return {
      active: false,
      rationale: `Claim status is '${claim.status}', not approved.`,
    };
  }
  if (claim.expiresAt !== undefined && claim.expiresAt < dateOnly(now)) {
    return {
      active: false,
      rationale: `Claim approval expired on ${claim.expiresAt}.`,
    };
  }
  if (!evidenceForSourceIds(pack, claim.sourceIds, now).some(({ active }) => active)) {
    return {
      active: false,
      rationale: "Every linked source is draft, deprecated, or expired.",
    };
  }
  return { active: true };
}

export function messageSupport(
  pack: PositioningPack,
  item: PositioningPillar | PositioningClaim,
  now: Date,
): MessageSupport {
  if ("statement" in item) return claimSupport(pack, item, now);
  if (!evidenceForSourceIds(pack, item.sourceIds, now).some(({ active }) => active)) {
    return {
      active: false,
      rationale: "Every linked source is draft, deprecated, or expired.",
    };
  }
  return { active: true };
}

function findingId(
  type: FindingType,
  policyId: string,
  location?: TextLocation,
): string {
  return `${type}:${policyId}:${location?.start ?? "document"}`;
}

function itemForReference(
  pack: PositioningPack,
  reference: Pick<MessageCoverage, "kind" | "id">,
): PositioningPillar | PositioningClaim {
  const collection = reference.kind === "pillar" ? pack.pillars : pack.claims;
  const item = collection.find(({ id }) => id === reference.id);
  if (item === undefined)
    throw new Error(`validated pack is missing ${reference.kind} '${reference.id}'`);
  return item;
}

function coverageFinding(
  pack: PositioningPack,
  coverage: MessageCoverage,
  item: PositioningPillar | PositioningClaim,
  now: Date,
): Finding {
  const isOpportunity = coverage.requirement === "opportunity";
  const type: FindingType = isOpportunity
    ? "positioning_opportunity"
    : "missing_message";
  const severity = coverageSeverity(coverage);
  const message =
    coverage.requirement === "must"
      ? `Required message '${item.name}' is missing.`
      : `${coverage.requirement === "should" ? "Recommended message" : "Positioning opportunity"} '${item.name}' is missing.`;
  const approvedMessage =
    "thesis" in item ? `${item.thesis} ${item.value}` : item.statement;
  return {
    id: findingId(type, item.id),
    type,
    severity,
    certainty: "confirmed",
    policyId: item.id,
    message,
    rationale: `The active context marks this ${coverage.kind} as ${coverage.requirement}.`,
    evidence: evidenceForSourceIds(pack, item.sourceIds, now),
    suggestion: `Cover this approved message in the writer's own words: ${approvedMessage}`,
  };
}

function coverageSeverity(coverage: MessageCoverage): Finding["severity"] {
  return coverage.requirement === "must" ? "warning" : "suggestion";
}

function staleEvidenceFinding(
  pack: PositioningPack,
  policyId: string,
  sourceIds: readonly string[],
  now: Date,
  location?: TextLocation,
  severity: Finding["severity"] = "warning",
  rationale = "Every linked source is draft, deprecated, or expired.",
): Finding {
  return {
    id: findingId("stale_evidence", policyId, location),
    type: "stale_evidence",
    severity,
    certainty: "confirmed",
    policyId,
    message: `Policy '${policyId}' has no active approved evidence.`,
    rationale,
    evidence: evidenceForSourceIds(pack, sourceIds, now),
    ...(location === undefined ? {} : { location }),
    suggestion: "Verify and approve current evidence before using this message.",
  };
}

function missingQualifierFinding(
  pack: PositioningPack,
  claim: PositioningClaim,
  location: TextLocation,
  missingStatements: readonly string[],
  now: Date,
): Finding {
  const plural = missingStatements.length === 1 ? "qualifier" : "qualifiers";
  return {
    id: findingId("unsupported_claim", claim.id, location),
    type: "unsupported_claim",
    severity: severityFor(claim.enforcement),
    certainty: "confirmed",
    policyId: claim.id,
    message: `Approved claim '${claim.name}' is missing required ${plural}.`,
    rationale: `The approved scope requires: ${missingStatements.join(" | ")}`,
    evidence: evidenceForSourceIds(pack, claim.sourceIds, now),
    location,
    suggestion: `Add the approved ${plural}: ${missingStatements.join(" | ")}`,
  };
}

function comparisonSignals(competitor: Competitor): readonly string[] {
  return competitor.aliases.flatMap((alias) => [
    `than ${alias}`,
    `versus ${alias}`,
    `vs ${alias}`,
    `vs. ${alias}`,
    `compared to ${alias}`,
    `compared with ${alias}`,
  ]);
}

function locationsOverlap(left: TextLocation, right: TextLocation): boolean {
  return left.start < right.end && right.start < left.end;
}

function unregisteredComparisonFindings(
  pack: PositioningPack,
  competitor: Competitor,
  claims: readonly PositioningClaim[],
  content: string,
  now: Date,
): readonly Finding[] {
  const configuredLocations = claims
    .filter(({ competitorId }) => competitorId === competitor.id)
    .flatMap((claim) =>
      findSignalMatches(content, claim.signals).map(({ location }) => location),
    );
  return findSignalMatches(content, comparisonSignals(competitor))
    .filter(
      ({ location }) =>
        !configuredLocations.some((configured) =>
          locationsOverlap(location, configured),
        ),
    )
    .map(({ location }) => ({
      id: findingId("unsupported_claim", competitor.id, location),
      type: "unsupported_claim" as const,
      severity: severityFor(competitor.unapprovedComparisonEnforcement),
      certainty: "confirmed" as const,
      policyId: competitor.id,
      message: `Detected an unregistered comparison against '${competitor.name}'.`,
      rationale:
        "No configured claim signal authorizes this comparison in the active context.",
      evidence: evidenceForSourceIds(pack, competitor.sourceIds, now),
      location,
      suggestion:
        "Remove the comparison or add an approved, qualified, evidence-backed claim to the positioning pack.",
    }));
}

function ruleFinding(
  pack: PositioningPack,
  rule: PositioningRule,
  location: TextLocation,
  now: Date,
): Finding {
  const typeByRule: Readonly<Record<PositioningRule["type"], FindingType>> = {
    contradiction: "contradiction",
    prohibited_language: "prohibited_language",
    required_disclosure: "required_disclosure",
    campaign_drift: "campaign_drift",
  };
  const type = typeByRule[rule.type];
  return {
    id: findingId(type, rule.id, location),
    type,
    severity: severityFor(rule.enforcement),
    certainty: "confirmed",
    policyId: rule.id,
    message: rule.name,
    rationale: rule.description,
    evidence: evidenceForSourceIds(pack, rule.sourceIds, now),
    location,
    ...(rule.suggestion === undefined ? {} : { suggestion: rule.suggestion }),
  };
}

function claimFinding(
  pack: PositioningPack,
  claim: PositioningClaim,
  location: TextLocation,
  now: Date,
): Finding | undefined {
  if (claim.status === "approved") return undefined;
  const statusLabel = claim.status === "prohibited" ? "prohibited" : "not approved";
  return {
    id: findingId("unsupported_claim", claim.id, location),
    type: "unsupported_claim",
    severity: severityFor(claim.enforcement),
    certainty: "confirmed",
    policyId: claim.id,
    message: `Detected ${statusLabel} claim '${claim.name}'.`,
    rationale: claim.statement,
    evidence: evidenceForSourceIds(pack, claim.sourceIds, now),
    location,
    suggestion:
      claim.status === "prohibited"
        ? "Remove this claim or replace it with an active approved claim."
        : "Send this claim for evidence and positioning review before publication.",
  };
}

function campaignProhibitionFinding(
  pack: PositioningPack,
  campaign: Campaign,
  prohibition: CampaignProhibition,
  item: PositioningPillar | PositioningClaim,
  location: TextLocation,
  now: Date,
): Finding {
  const sourceIds = [...new Set([...campaign.sourceIds, ...item.sourceIds])];
  return {
    id: findingId("campaign_drift", item.id, location),
    type: "campaign_drift",
    severity: severityFor(prohibition.enforcement),
    certainty: "confirmed",
    policyId: item.id,
    message: `Campaign '${campaign.name}' prohibits '${item.name}'.`,
    rationale: "The active campaign explicitly excludes this message.",
    evidence: evidenceForSourceIds(pack, sourceIds, now),
    location,
    suggestion: "Remove this message or replace it with an approved campaign message.",
  };
}

export function evaluateContent(
  pack: PositioningPack,
  content: string,
  context: ContentContext,
  options: EvaluationOptions = {},
): ContentDecision {
  const maxContentBytes = options.maxContentBytes ?? DEFAULT_MAX_CONTENT_BYTES;
  const contentBytes = Buffer.byteLength(content, "utf8");
  if (contentBytes > maxContentBytes) {
    throw new ContentEvaluationError(
      `content is ${contentBytes} bytes; the limit is ${maxContentBytes} bytes`,
    );
  }
  const now = options.now ?? new Date();
  const resolved = resolvePositioningContext(pack, context);
  const findings = new Map<string, Finding>();

  const coverage = resolved.requirements.map((requirement) => {
    const item = itemForReference(pack, requirement);
    const matches = findSignalMatches(content, item.signals);
    const output: MessageCoverage = {
      ...requirement,
      matched: matches.length > 0,
      matchedSignals: [...new Set(matches.map(({ signal }) => signal))].sort(),
    };
    const support = messageSupport(pack, item, now);
    if (!support.active) {
      if (!("statement" in item) || item.status === "approved") {
        const finding = staleEvidenceFinding(
          pack,
          item.id,
          item.sourceIds,
          now,
          matches[0]?.location,
          matches.length > 0 && "statement" in item
            ? severityFor(item.enforcement)
            : coverageSeverity(output),
          support.rationale,
        );
        findings.set(finding.id, finding);
      }
      return output;
    }
    if (matches.length === 0) {
      const finding = coverageFinding(pack, output, item, now);
      findings.set(finding.id, finding);
    }
    return output;
  });

  for (const claim of resolved.claims) {
    const match = firstSignalMatch(content, claim.signals);
    if (match === undefined) continue;
    const unsupported = claimFinding(pack, claim, match.location, now);
    if (unsupported !== undefined) findings.set(unsupported.id, unsupported);
    if (claim.status === "approved") {
      const missingQualifiers = (claim.qualifiers ?? []).filter(
        ({ signals }) => firstSignalMatch(content, signals) === undefined,
      );
      if (missingQualifiers.length > 0) {
        const qualifierFinding = missingQualifierFinding(
          pack,
          claim,
          match.location,
          missingQualifiers.map(({ statement }) => statement),
          now,
        );
        findings.set(qualifierFinding.id, qualifierFinding);
      }
    }
    const support = claimSupport(pack, claim, now);
    if (claim.status === "approved" && !support.active) {
      const stale = staleEvidenceFinding(
        pack,
        claim.id,
        claim.sourceIds,
        now,
        match.location,
        severityFor(claim.enforcement),
        support.rationale,
      );
      if (!findings.has(stale.id)) findings.set(stale.id, stale);
    }
  }

  for (const competitor of resolved.competitors) {
    for (const finding of unregisteredComparisonFindings(
      pack,
      competitor,
      resolved.claims,
      content,
      now,
    )) {
      findings.set(finding.id, finding);
    }
  }

  for (const pillar of resolved.pillars) {
    const match = firstSignalMatch(content, pillar.signals);
    if (
      match !== undefined &&
      !evidenceForSourceIds(pack, pillar.sourceIds, now).some(({ active }) => active)
    ) {
      const stale = staleEvidenceFinding(
        pack,
        pillar.id,
        pillar.sourceIds,
        now,
        match.location,
      );
      if (!findings.has(stale.id)) findings.set(stale.id, stale);
    }
  }

  for (const rule of resolved.rules) {
    const trigger = firstSignalMatch(content, rule.triggerSignals);
    if (trigger === undefined) continue;
    if (
      rule.type === "required_disclosure" &&
      rule.requiredSignals !== undefined &&
      firstSignalMatch(content, rule.requiredSignals) !== undefined
    ) {
      continue;
    }
    const finding = ruleFinding(pack, rule, trigger.location, now);
    findings.set(finding.id, finding);
    if (!evidenceForSourceIds(pack, rule.sourceIds, now).some(({ active }) => active)) {
      const stale = staleEvidenceFinding(
        pack,
        rule.id,
        rule.sourceIds,
        now,
        trigger.location,
      );
      findings.set(stale.id, stale);
    }
  }

  if (resolved.campaign !== undefined) {
    for (const prohibition of resolved.campaign.prohibited) {
      const item = itemForReference(pack, prohibition);
      const match = firstSignalMatch(content, item.signals);
      if (match === undefined) continue;
      const finding = campaignProhibitionFinding(
        pack,
        resolved.campaign,
        prohibition,
        item,
        match.location,
        now,
      );
      findings.set(finding.id, finding);
    }
  }

  if (
    resolved.campaign !== undefined &&
    !evidenceForSourceIds(pack, resolved.campaign.sourceIds, now).some(
      ({ active }) => active,
    )
  ) {
    const stale = staleEvidenceFinding(
      pack,
      resolved.campaign.id,
      resolved.campaign.sourceIds,
      now,
    );
    findings.set(stale.id, stale);
  }

  const sortedFindings = sortFindings([...findings.values()]);
  return {
    decision: deriveDecision(sortedFindings),
    pack: {
      id: pack.id,
      name: pack.name,
      version: pack.version,
      schemaVersion: pack.schemaVersion,
    },
    context,
    capabilities: {
      deterministic: "completed",
      semantic: "not_run",
      semanticDetail:
        "No semantic reviewer was configured; model-assisted checks were not run.",
    },
    applicablePolicies: resolved.applicablePolicies,
    appliedPolicyIds: resolved.appliedPolicyIds,
    coverage,
    findings: sortedFindings,
  };
}
