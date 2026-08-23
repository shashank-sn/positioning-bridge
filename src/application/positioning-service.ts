import {
  deriveDecision,
  evaluateContent,
  evidenceForSourceIds,
  resolvePositioningContext,
  sortFindings,
  sourceIsActive,
  type BriefMessage,
  type BriefRule,
  type ContentBrief,
  type ContentContext,
  type ContentDecision,
  type ExplainedItem,
  type Finding,
  type MessageCoverage,
  type PositioningItemKind,
  type PositioningPack,
  type RequirementLevel,
  type ResolvedPositioningContext,
  type TextLocation,
} from "../domain/index.js";
import type {
  SemanticFindingCandidate,
  SemanticReviewer,
} from "./semantic-reviewer.js";

export interface CheckContentInput {
  readonly content: string;
  readonly context: ContentContext;
  readonly semantic?: "auto" | "disabled";
}

export interface PositioningServiceOptions {
  readonly now?: () => Date;
  readonly semanticReviewer?: SemanticReviewer;
}

export class PositioningItemNotFoundError extends Error {
  readonly itemId: string;

  constructor(itemId: string) {
    super(`unknown positioning item '${itemId}'`);
    this.name = "PositioningItemNotFoundError";
    this.itemId = itemId;
  }
}

function sourceIdsForItem(item: ExplainedItem["item"]): readonly string[] {
  if ("sourceIds" in item) return item.sourceIds;
  return [item.id];
}

function messageFromCoverage(
  pack: PositioningPack,
  coverage: MessageCoverage,
): BriefMessage {
  const collection = coverage.kind === "pillar" ? pack.pillars : pack.claims;
  const item = collection.find(({ id }) => id === coverage.id);
  if (item === undefined) throw new Error(`validated pack is missing '${coverage.id}'`);
  return {
    id: item.id,
    kind: coverage.kind,
    name: item.name,
    message: "thesis" in item ? `${item.thesis} ${item.value}` : item.statement,
    sourceIds: item.sourceIds,
  };
}

function levelGroup(
  pack: PositioningPack,
  requirements: readonly MessageCoverage[],
  level: RequirementLevel,
): readonly BriefMessage[] {
  return requirements
    .filter(({ requirement }) => requirement === level)
    .map((coverage) => messageFromCoverage(pack, coverage));
}

function locationForCandidate(
  content: string,
  candidate: SemanticFindingCandidate,
): TextLocation | undefined {
  if (candidate.start === undefined && candidate.end === undefined) return undefined;
  if (
    candidate.start === undefined ||
    candidate.end === undefined ||
    !Number.isInteger(candidate.start) ||
    !Number.isInteger(candidate.end) ||
    candidate.start < 0 ||
    candidate.end <= candidate.start ||
    candidate.end > content.length
  ) {
    throw new Error(
      `semantic finding for '${candidate.policyId}' has an invalid content span`,
    );
  }
  const before = content.slice(0, candidate.start);
  const lastBreak = before.lastIndexOf("\n");
  return {
    start: candidate.start,
    end: candidate.end,
    line: before.split("\n").length,
    column: candidate.start - lastBreak,
    quote: content.slice(candidate.start, candidate.end),
  };
}

function sourceIdsForPolicy(
  pack: PositioningPack,
  policyId: string,
): readonly string[] {
  const collections = [
    pack.pillars,
    pack.claims,
    pack.competitors,
    pack.campaigns,
    pack.rules,
  ] as const;
  for (const collection of collections) {
    const item = collection.find(({ id }) => id === policyId);
    if (item !== undefined) return item.sourceIds;
  }
  throw new Error(`semantic finding references unknown policy '${policyId}'`);
}

function semanticFinding(
  pack: PositioningPack,
  content: string,
  candidate: SemanticFindingCandidate,
  appliedPolicyIds: ReadonlySet<string>,
  now: Date,
): Finding {
  if (
    candidate.type !== "contradiction" &&
    candidate.type !== "positioning_opportunity"
  ) {
    throw new Error(
      `semantic finding has unsupported type '${String(candidate.type)}'`,
    );
  }
  for (const [field, value] of [
    ["message", candidate.message],
    ["rationale", candidate.rationale],
  ] as const) {
    if (
      typeof value !== "string" ||
      value.trim().length === 0 ||
      value.length > 4_000
    ) {
      throw new Error(`semantic finding has invalid ${field}`);
    }
  }
  if (
    candidate.suggestion !== undefined &&
    (typeof candidate.suggestion !== "string" ||
      candidate.suggestion.trim().length === 0 ||
      candidate.suggestion.length > 4_000)
  ) {
    throw new Error("semantic finding has invalid suggestion");
  }
  if (!appliedPolicyIds.has(candidate.policyId)) {
    throw new Error(
      `semantic finding references inapplicable policy '${candidate.policyId}'`,
    );
  }
  if (
    !Number.isFinite(candidate.confidence) ||
    candidate.confidence < 0 ||
    candidate.confidence > 1
  ) {
    throw new Error(
      `semantic finding for '${candidate.policyId}' has invalid confidence`,
    );
  }
  const location = locationForCandidate(content, candidate);
  const severity =
    candidate.type === "positioning_opportunity" ? "suggestion" : "warning";
  return {
    id: `${candidate.type}:${candidate.policyId}:${location?.start ?? "document"}:semantic`,
    type: candidate.type,
    severity,
    certainty: "model_assisted",
    policyId: candidate.policyId,
    message: candidate.message,
    rationale: candidate.rationale,
    evidence: evidenceForSourceIds(
      pack,
      sourceIdsForPolicy(pack, candidate.policyId),
      now,
    ),
    ...(location === undefined ? {} : { location }),
    ...(candidate.suggestion === undefined ? {} : { suggestion: candidate.suggestion }),
    confidence: candidate.confidence,
  };
}

function findItem(pack: PositioningPack, itemId: string): ExplainedItem | undefined {
  const groups: readonly [PositioningItemKind, readonly ExplainedItem["item"][]][] = [
    ["source", pack.sources],
    ["pillar", pack.pillars],
    ["claim", pack.claims],
    ["competitor", pack.competitors],
    ["campaign", pack.campaigns],
    ["rule", pack.rules],
  ];
  for (const [kind, collection] of groups) {
    const item = collection.find(({ id }) => id === itemId);
    if (item !== undefined) return { kind, id: itemId, item, evidence: [] };
  }
  return undefined;
}

export class PositioningService {
  readonly #pack: PositioningPack;
  readonly #now: () => Date;
  readonly #semanticReviewer: SemanticReviewer | undefined;

  constructor(pack: PositioningPack, options: PositioningServiceOptions = {}) {
    this.#pack = pack;
    this.#now = options.now ?? (() => new Date());
    this.#semanticReviewer = options.semanticReviewer;
  }

  get pack(): PositioningPack {
    return this.#pack;
  }

  getContext(context: ContentContext): ResolvedPositioningContext {
    return resolvePositioningContext(this.#pack, context);
  }

  createBrief(context: ContentContext): ContentBrief {
    const resolved = this.getContext(context);
    const now = this.#now();
    const campaign = resolved.campaign;
    const campaignAvoid: readonly BriefRule[] =
      campaign?.prohibited.map((prohibition) => {
        const collection =
          prohibition.kind === "pillar" ? resolved.pillars : resolved.claims;
        const item = collection.find(({ id }) => id === prohibition.id);
        if (item === undefined) {
          throw new Error(`validated pack is missing '${prohibition.id}'`);
        }
        return {
          id: item.id,
          type: "campaign_prohibited_message",
          description:
            "thesis" in item ? `${item.thesis} ${item.value}` : item.statement,
          suggestion: "Use an approved campaign message instead.",
          sourceIds: [...new Set([...campaign.sourceIds, ...item.sourceIds])].sort(),
        };
      }) ?? [];
    const campaignProhibitedIds = new Set(campaignAvoid.map(({ id }) => id));
    const approvedClaims = resolved.claims
      .filter(
        (claim) =>
          claim.status === "approved" &&
          !campaignProhibitedIds.has(claim.id) &&
          (claim.expiresAt === undefined ||
            claim.expiresAt >= now.toISOString().slice(0, 10)) &&
          claim.sourceIds.some((sourceId) => {
            const source = this.#pack.sources.find(({ id }) => id === sourceId);
            return source !== undefined && sourceIsActive(source, now);
          }),
      )
      .map((claim) => ({
        id: claim.id,
        statement: claim.statement,
        qualifiers: claim.qualifiers ?? [],
        ...(claim.competitorId === undefined
          ? {}
          : { competitorId: claim.competitorId }),
        sourceIds: claim.sourceIds,
      }));
    return {
      packId: this.#pack.id,
      packVersion: this.#pack.version,
      context,
      ...(resolved.campaign === undefined
        ? {}
        : {
            campaign: {
              id: resolved.campaign.id,
              name: resolved.campaign.name,
              narrative: resolved.campaign.narrative,
              desiredAction: resolved.campaign.desiredAction,
            },
          }),
      mustCarry: levelGroup(this.#pack, resolved.requirements, "must"),
      shouldCarry: levelGroup(this.#pack, resolved.requirements, "should"),
      opportunities: levelGroup(this.#pack, resolved.requirements, "opportunity"),
      approvedClaims,
      avoid: [
        ...campaignAvoid,
        ...resolved.claims
          .filter(
            ({ id, status }) =>
              status === "prohibited" && !campaignProhibitedIds.has(id),
          )
          .map((claim) => ({
            id: claim.id,
            type: "prohibited_claim" as const,
            description: claim.statement,
            suggestion: "Use an active approved claim instead.",
            sourceIds: claim.sourceIds,
          })),
        ...resolved.rules
          .filter(({ type }) => type !== "required_disclosure")
          .map((rule) => ({
            id: rule.id,
            type: rule.type,
            description: rule.description,
            ...(rule.suggestion === undefined ? {} : { suggestion: rule.suggestion }),
            sourceIds: rule.sourceIds,
          })),
      ].sort((left, right) => left.id.localeCompare(right.id)),
      sourceIds: resolved.sourceIds,
    };
  }

  explainItem(itemId: string): ExplainedItem {
    const explained = findItem(this.#pack, itemId);
    if (explained === undefined) throw new PositioningItemNotFoundError(itemId);
    return {
      ...explained,
      evidence: evidenceForSourceIds(
        this.#pack,
        sourceIdsForItem(explained.item),
        this.#now(),
      ),
    };
  }

  async checkContent(input: CheckContentInput): Promise<ContentDecision> {
    const now = this.#now();
    const deterministic = evaluateContent(this.#pack, input.content, input.context, {
      now,
    });
    if (input.semantic === "disabled") {
      return {
        ...deterministic,
        capabilities: {
          deterministic: "completed",
          semantic: "not_run",
          semanticDetail: "Semantic review was disabled by the caller.",
        },
      };
    }
    if (this.#semanticReviewer === undefined) return deterministic;

    try {
      const positioning = this.getContext(input.context);
      const candidates = await this.#semanticReviewer.review({
        content: input.content,
        context: input.context,
        positioning,
      });
      if (candidates.length > 200) {
        throw new Error("semantic reviewer returned more than 200 findings");
      }
      const applied = new Set(deterministic.appliedPolicyIds);
      const semanticFindings = candidates.map((candidate) =>
        semanticFinding(this.#pack, input.content, candidate, applied, now),
      );
      const findings = sortFindings([...deterministic.findings, ...semanticFindings]);
      return {
        ...deterministic,
        decision: deriveDecision(findings),
        capabilities: {
          deterministic: "completed",
          semantic: "completed",
          semanticDetail: `Semantic review completed with '${this.#semanticReviewer.id}'.`,
        },
        findings,
      };
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : "unknown semantic review error";
      return {
        ...deterministic,
        capabilities: {
          deterministic: "completed",
          semantic: "failed",
          semanticDetail: `Semantic review failed: ${detail}`,
        },
      };
    }
  }
}
