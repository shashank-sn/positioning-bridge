import type {
  ApplicablePolicy,
  ApplicablePolicyKind,
  ApplicabilityReason,
  Campaign,
  ContentContext,
  MessageCoverage,
  MessageReference,
  PositioningClaim,
  PositioningPack,
  PositioningPillar,
  RequirementLevel,
  ResolvedPositioningContext,
  Selector,
} from "./model.js";

interface MutableApplicablePolicy {
  readonly policyId: string;
  readonly kind: ApplicablePolicyKind;
  readonly reasons: ApplicabilityReason[];
}

function policyKey(kind: ApplicablePolicyKind, policyId: string): string {
  return `${kind}:${policyId}`;
}

function addApplicability(
  policies: Map<string, MutableApplicablePolicy>,
  kind: ApplicablePolicyKind,
  policyId: string,
  reason: ApplicabilityReason,
): void {
  const key = policyKey(kind, policyId);
  const existing = policies.get(key);
  if (existing === undefined) {
    policies.set(key, { policyId, kind, reasons: [reason] });
    return;
  }
  if (
    !existing.reasons.some(
      ({ basis, detail }) => basis === reason.basis && detail === reason.detail,
    )
  ) {
    existing.reasons.push(reason);
  }
}

function selectorReason(
  kind: "pillar" | "claim" | "rule",
  policyId: string,
  selector: Selector | undefined,
  context: ContentContext,
): ApplicabilityReason {
  const fields = [
    ["audienceIds", "audienceId"],
    ["channelIds", "channelId"],
    ["funnelStageIds", "funnelStageId"],
    ["campaignIds", "campaignId"],
    ["localeIds", "localeId"],
  ] as const;
  const matches =
    selector === undefined
      ? []
      : fields.flatMap(([selectorField, contextField]) =>
          selector[selectorField] === undefined
            ? []
            : [`${contextField} '${String(context[contextField])}'`],
        );
  if (matches.length === 0) {
    return {
      basis: "global",
      detail: `${kind} '${policyId}' has no limiting context selector.`,
    };
  }
  return {
    basis: "selector_match",
    detail: `${kind} '${policyId}' matched ${matches.join(", ")}.`,
  };
}

function finalizeApplicability(
  policies: ReadonlyMap<string, MutableApplicablePolicy>,
): readonly ApplicablePolicy[] {
  return [...policies.values()]
    .map(({ policyId, kind, reasons }) => ({
      policyId,
      kind,
      reasons: [...reasons].sort(
        (left, right) =>
          left.basis.localeCompare(right.basis) ||
          left.detail.localeCompare(right.detail),
      ),
    }))
    .sort(
      (left, right) =>
        left.policyId.localeCompare(right.policyId) ||
        left.kind.localeCompare(right.kind),
    );
}

export class ContentContextError extends Error {
  readonly field: keyof ContentContext;
  readonly value: string;

  constructor(field: keyof ContentContext, value: string, message: string) {
    super(message);
    this.name = "ContentContextError";
    this.field = field;
    this.value = value;
  }
}

function includesOrAll(
  values: readonly string[] | undefined,
  value: string | undefined,
): boolean {
  if (values === undefined) return true;
  return value !== undefined && values.includes(value);
}

export function matchesSelector(
  selector: Selector | undefined,
  context: ContentContext,
): boolean {
  if (selector === undefined) return true;
  return (
    includesOrAll(selector.audienceIds, context.audienceId) &&
    includesOrAll(selector.channelIds, context.channelId) &&
    includesOrAll(selector.funnelStageIds, context.funnelStageId) &&
    includesOrAll(selector.localeIds, context.localeId) &&
    includesOrAll(selector.campaignIds, context.campaignId)
  );
}

function requireKnown(
  field: keyof ContentContext,
  value: string,
  entries: readonly { readonly id: string }[],
): void {
  if (!entries.some(({ id }) => id === value)) {
    throw new ContentContextError(field, value, `unknown ${field} '${value}'`);
  }
}

function resolveCampaign(
  pack: PositioningPack,
  context: ContentContext,
): Campaign | undefined {
  if (context.campaignId === undefined) return undefined;
  const campaign = pack.campaigns.find(({ id }) => id === context.campaignId);
  if (campaign === undefined) {
    throw new ContentContextError(
      "campaignId",
      context.campaignId,
      `unknown campaignId '${context.campaignId}'`,
    );
  }
  const constraints: readonly [keyof ContentContext, string, readonly string[]][] = [
    ["audienceId", context.audienceId, campaign.audienceIds],
    ["channelId", context.channelId, campaign.channelIds],
    ["funnelStageId", context.funnelStageId, campaign.funnelStageIds],
    ["localeId", context.localeId, campaign.localeIds],
  ];
  for (const [field, value, allowed] of constraints) {
    if (!allowed.includes(value)) {
      throw new ContentContextError(
        field,
        value,
        `campaign '${campaign.id}' does not apply to ${field} '${value}'`,
      );
    }
  }
  return campaign;
}

function requirementRank(level: RequirementLevel): number {
  if (level === "must") return 3;
  if (level === "should") return 2;
  return 1;
}

function requirementKey(reference: MessageReference): string {
  return `${reference.kind}:${reference.id}`;
}

interface MutableRequirement {
  readonly id: string;
  readonly kind: "pillar" | "claim";
  level: RequirementLevel;
  readonly sourceIds: readonly string[];
}

function itemForReference(
  reference: MessageReference,
  pillars: readonly PositioningPillar[],
  claims: readonly PositioningClaim[],
): PositioningPillar | PositioningClaim {
  const item =
    reference.kind === "pillar"
      ? pillars.find(({ id }) => id === reference.id)
      : claims.find(({ id }) => id === reference.id);
  if (item === undefined) {
    throw new Error(`validated pack is missing ${requirementKey(reference)}`);
  }
  return item;
}

function setRequirement(
  requirements: Map<string, MutableRequirement>,
  reference: MessageReference,
  level: RequirementLevel,
  item: PositioningPillar | PositioningClaim,
): void {
  const key = requirementKey(reference);
  const existing = requirements.get(key);
  if (existing === undefined) {
    requirements.set(key, {
      id: reference.id,
      kind: reference.kind,
      level,
      sourceIds: item.sourceIds,
    });
    return;
  }
  if (requirementRank(level) > requirementRank(existing.level)) existing.level = level;
}

function addCampaignRequirements(
  campaign: Campaign,
  requirements: Map<string, MutableRequirement>,
  pillars: readonly PositioningPillar[],
  claims: readonly PositioningClaim[],
): void {
  const groups: readonly [readonly MessageReference[], RequirementLevel][] = [
    [campaign.mustInclude, "must"],
    [campaign.shouldInclude, "should"],
    [campaign.opportunities, "opportunity"],
  ];
  for (const [references, level] of groups) {
    for (const reference of references) {
      setRequirement(
        requirements,
        reference,
        level,
        itemForReference(reference, pillars, claims),
      );
    }
  }
}

export function resolvePositioningContext(
  pack: PositioningPack,
  context: ContentContext,
): ResolvedPositioningContext {
  requireKnown("audienceId", context.audienceId, pack.contexts.audiences);
  requireKnown("channelId", context.channelId, pack.contexts.channels);
  requireKnown("funnelStageId", context.funnelStageId, pack.contexts.funnelStages);
  requireKnown("localeId", context.localeId, pack.contexts.locales);
  const campaign = resolveCampaign(pack, context);
  const applicability = new Map<string, MutableApplicablePolicy>();

  const pillars = pack.pillars.filter(
    ({ requirement }) =>
      requirement === undefined || matchesSelector(requirement.selectors, context),
  );
  const claims = pack.claims.filter(
    ({ requirement }) =>
      requirement === undefined || matchesSelector(requirement.selectors, context),
  );
  for (const pillar of pillars) {
    addApplicability(
      applicability,
      "pillar",
      pillar.id,
      selectorReason("pillar", pillar.id, pillar.requirement?.selectors, context),
    );
  }
  for (const claim of claims) {
    addApplicability(
      applicability,
      "claim",
      claim.id,
      selectorReason("claim", claim.id, claim.requirement?.selectors, context),
    );
  }
  const campaignReferences = campaign
    ? [
        ...campaign.mustInclude,
        ...campaign.shouldInclude,
        ...campaign.opportunities,
        ...campaign.prohibited,
      ]
    : [];
  for (const reference of campaignReferences) {
    if (reference.kind === "pillar") {
      const item = pack.pillars.find(({ id }) => id === reference.id);
      if (item !== undefined && !pillars.some(({ id }) => id === item.id))
        pillars.push(item);
    } else {
      const item = pack.claims.find(({ id }) => id === reference.id);
      if (item !== undefined && !claims.some(({ id }) => id === item.id))
        claims.push(item);
    }
    addApplicability(applicability, reference.kind, reference.id, {
      basis: "campaign_reference",
      detail: `Active campaign '${campaign?.id ?? ""}' references this ${reference.kind}.`,
    });
  }

  const rules = pack.rules.filter(({ selectors }) =>
    matchesSelector(selectors, context),
  );
  for (const rule of rules) {
    addApplicability(
      applicability,
      "rule",
      rule.id,
      selectorReason("rule", rule.id, rule.selectors, context),
    );
  }
  const requirements = new Map<string, MutableRequirement>();
  for (const pillar of pillars) {
    if (pillar.requirement !== undefined) {
      setRequirement(
        requirements,
        { kind: "pillar", id: pillar.id },
        pillar.requirement.level,
        pillar,
      );
    }
  }
  for (const claim of claims) {
    if (claim.requirement !== undefined) {
      setRequirement(
        requirements,
        { kind: "claim", id: claim.id },
        claim.requirement.level,
        claim,
      );
    }
  }
  if (campaign !== undefined) {
    addCampaignRequirements(campaign, requirements, pillars, claims);
    for (const prohibition of campaign.prohibited) {
      requirements.delete(requirementKey(prohibition));
    }
  }

  const competitors = [...pack.competitors];
  for (const competitor of competitors) {
    const referencingClaims = claims
      .filter(({ competitorId }) => competitorId === competitor.id)
      .map(({ id }) => id)
      .sort();
    if (referencingClaims.length === 0) {
      addApplicability(applicability, "competitor", competitor.id, {
        basis: "global",
        detail: `Competitor '${competitor.id}' is available for unapproved comparison checks.`,
      });
    } else {
      for (const claimId of referencingClaims) {
        addApplicability(applicability, "competitor", competitor.id, {
          basis: "claim_reference",
          detail: `Applicable claim '${claimId}' references this competitor.`,
        });
      }
    }
  }
  if (campaign !== undefined) {
    addApplicability(applicability, "campaign", campaign.id, {
      basis: "active_campaign",
      detail: `Campaign '${campaign.id}' matches the supplied audience, channel, funnel stage, and locale.`,
    });
  }
  const requirementOutput: MessageCoverage[] = [...requirements.values()]
    .map(({ id, kind, level, sourceIds }) => ({
      id,
      kind,
      requirement: level,
      matched: false,
      matchedSignals: [],
      sourceIds,
    }))
    .sort((left, right) =>
      `${left.kind}:${left.id}`.localeCompare(`${right.kind}:${right.id}`),
    );

  const applicablePolicies = finalizeApplicability(applicability);
  const appliedPolicyIds = applicablePolicies.map(({ policyId }) => policyId).sort();
  const sourceIds = new Set<string>();
  for (const item of [...pillars, ...claims, ...competitors, ...rules]) {
    for (const sourceId of item.sourceIds) sourceIds.add(sourceId);
  }
  if (campaign !== undefined) {
    for (const sourceId of campaign.sourceIds) sourceIds.add(sourceId);
  }

  return {
    packId: pack.id,
    packVersion: pack.version,
    context,
    ...(campaign === undefined ? {} : { campaign }),
    pillars: [...pillars].sort((left, right) => left.id.localeCompare(right.id)),
    claims: [...claims].sort((left, right) => left.id.localeCompare(right.id)),
    competitors: [...competitors].sort((left, right) =>
      left.id.localeCompare(right.id),
    ),
    rules: [...rules].sort((left, right) => left.id.localeCompare(right.id)),
    requirements: requirementOutput,
    sourceIds: [...sourceIds].sort(),
    applicablePolicies,
    appliedPolicyIds,
  };
}
