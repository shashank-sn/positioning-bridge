import { Buffer } from "node:buffer";
import { deriveDecision, severityFor, sortFindings } from "./decision.js";
import { resolvePositioningContext } from "./context.js";
import { findSignalMatches, firstSignalMatch } from "./text.js";
import type {
  Campaign,
  CampaignProhibition,
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
  const severity = coverage.requirement === "must" ? "warning" : "suggestion";
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

function staleEvidenceFinding(
  pack: PositioningPack,
  policyId: string,
  sourceIds: readonly string[],
  now: Date,
  location?: TextLocation,
): Finding {
  return {
    id: findingId("stale_evidence", policyId, location),
    type: "stale_evidence",
    severity: "warning",
    certainty: "confirmed",
    policyId,
    message: `Policy '${policyId}' has no active approved evidence.`,
    rationale: "Every linked source is draft, deprecated, or expired.",
    evidence: evidenceForSourceIds(pack, sourceIds, now),
    ...(location === undefined ? {} : { location }),
    suggestion: "Verify and approve current evidence before using this message.",
  };
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

function claimIsActive(
  pack: PositioningPack,
  claim: PositioningClaim,
  now: Date,
): boolean {
  if (claim.expiresAt !== undefined && claim.expiresAt < dateOnly(now)) return false;
  return evidenceForSourceIds(pack, claim.sourceIds, now).some(({ active }) => active);
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
    if (matches.length === 0) {
      const finding = coverageFinding(pack, output, item, now);
      findings.set(finding.id, finding);
    } else if (
      !evidenceForSourceIds(pack, item.sourceIds, now).some(({ active }) => active)
    ) {
      const finding = staleEvidenceFinding(
        pack,
        item.id,
        item.sourceIds,
        now,
        matches[0]?.location,
      );
      findings.set(finding.id, finding);
    }
    return output;
  });

  for (const claim of resolved.claims) {
    const match = firstSignalMatch(content, claim.signals);
    if (match === undefined) continue;
    const unsupported = claimFinding(pack, claim, match.location, now);
    if (unsupported !== undefined) findings.set(unsupported.id, unsupported);
    if (claim.status === "approved" && !claimIsActive(pack, claim, now)) {
      const stale = staleEvidenceFinding(
        pack,
        claim.id,
        claim.sourceIds,
        now,
        match.location,
      );
      findings.set(stale.id, stale);
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
      findings.set(stale.id, stale);
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
    appliedPolicyIds: resolved.appliedPolicyIds,
    coverage,
    findings: sortedFindings,
  };
}
