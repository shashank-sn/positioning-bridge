import { z } from "zod";

const IdSchema = z.string().min(1).max(96);
const EnforcementSchema = z.enum(["block", "warn", "suggest"]);
const RequirementLevelSchema = z.enum(["must", "should", "opportunity"]);
const RuleTypeSchema = z.enum([
  "contradiction",
  "prohibited_language",
  "required_disclosure",
  "campaign_drift",
]);

export const ContentContextSchema = z
  .object({
    audienceId: IdSchema,
    channelId: IdSchema,
    funnelStageId: IdSchema,
    localeId: IdSchema,
    campaignId: IdSchema.optional(),
  })
  .strict();

const SelectorSchema = z
  .object({
    audienceIds: z.array(IdSchema).optional(),
    channelIds: z.array(IdSchema).optional(),
    funnelStageIds: z.array(IdSchema).optional(),
    campaignIds: z.array(IdSchema).optional(),
    localeIds: z.array(IdSchema).optional(),
  })
  .strict();

const SourceRecordSchema = z
  .object({
    id: IdSchema,
    label: z.string(),
    status: z.enum(["approved", "draft", "deprecated"]),
    visibility: z.enum(["public", "internal"]),
    uri: z.string().optional(),
    verifiedAt: z.string().optional(),
    expiresAt: z.string().optional(),
    notes: z.string().optional(),
  })
  .strict();

const MessageRequirementSchema = z
  .object({ level: RequirementLevelSchema, selectors: SelectorSchema.optional() })
  .strict();

const PillarSchema = z
  .object({
    id: IdSchema,
    name: z.string(),
    thesis: z.string(),
    value: z.string(),
    signals: z.array(z.string()),
    sourceIds: z.array(IdSchema),
    requirement: MessageRequirementSchema.optional(),
  })
  .strict();

const ClaimQualifierSchema = z
  .object({ statement: z.string(), signals: z.array(z.string()) })
  .strict();

const ClaimSchema = z
  .object({
    id: IdSchema,
    name: z.string(),
    statement: z.string(),
    kind: z.enum(["fact", "comparison", "superlative", "customer", "roadmap"]),
    status: z.enum(["approved", "review_required", "prohibited"]),
    enforcement: EnforcementSchema,
    signals: z.array(z.string()),
    sourceIds: z.array(IdSchema),
    competitorId: IdSchema.optional(),
    qualifiers: z.array(ClaimQualifierSchema).optional(),
    expiresAt: z.string().optional(),
    requirement: MessageRequirementSchema.optional(),
  })
  .strict();

const CompetitorSchema = z
  .object({
    id: IdSchema,
    name: z.string(),
    category: z.string(),
    aliases: z.array(z.string()),
    unapprovedComparisonEnforcement: EnforcementSchema,
    notes: z.string().optional(),
    sourceIds: z.array(IdSchema),
  })
  .strict();

const MessageReferenceSchema = z
  .object({ kind: z.enum(["pillar", "claim"]), id: IdSchema })
  .strict();

const CampaignSchema = z
  .object({
    id: IdSchema,
    name: z.string(),
    narrative: z.string(),
    desiredAction: z.string(),
    audienceIds: z.array(IdSchema),
    channelIds: z.array(IdSchema),
    funnelStageIds: z.array(IdSchema),
    localeIds: z.array(IdSchema),
    sourceIds: z.array(IdSchema),
    mustInclude: z.array(MessageReferenceSchema),
    shouldInclude: z.array(MessageReferenceSchema),
    opportunities: z.array(MessageReferenceSchema),
    prohibited: z.array(
      MessageReferenceSchema.extend({ enforcement: EnforcementSchema }).strict(),
    ),
  })
  .strict();

const RuleSchema = z
  .object({
    id: IdSchema,
    name: z.string(),
    type: RuleTypeSchema,
    description: z.string(),
    enforcement: EnforcementSchema,
    triggerSignals: z.array(z.string()),
    requiredSignals: z.array(z.string()).optional(),
    selectors: SelectorSchema.optional(),
    sourceIds: z.array(IdSchema),
    suggestion: z.string().optional(),
  })
  .strict();

const FindingEvidenceSchema = z
  .object({
    sourceId: IdSchema,
    label: z.string(),
    status: z.enum(["approved", "draft", "deprecated"]),
    visibility: z.enum(["public", "internal"]),
    active: z.boolean(),
    uri: z.string().optional(),
    expiresAt: z.string().optional(),
  })
  .strict();

const TextLocationSchema = z
  .object({
    start: z.number().int().nonnegative(),
    end: z.number().int().positive(),
    line: z.number().int().positive(),
    column: z.number().int().positive(),
    quote: z.string(),
  })
  .strict();

const FindingTypeSchema = z.enum([
  "contradiction",
  "missing_message",
  "unsupported_claim",
  "stale_evidence",
  "required_disclosure",
  "prohibited_language",
  "campaign_drift",
  "positioning_opportunity",
]);

const FindingSchema = z
  .object({
    id: z.string(),
    type: FindingTypeSchema,
    severity: z.enum(["error", "warning", "suggestion"]),
    certainty: z.enum(["confirmed", "model_assisted"]),
    policyId: IdSchema,
    message: z.string(),
    rationale: z.string(),
    evidence: z.array(FindingEvidenceSchema),
    location: TextLocationSchema.optional(),
    suggestion: z.string().optional(),
    confidence: z.number().min(0).max(1).optional(),
  })
  .strict();

const CoverageSchema = z
  .object({
    id: IdSchema,
    kind: z.enum(["pillar", "claim"]),
    requirement: RequirementLevelSchema,
    matched: z.boolean(),
    matchedSignals: z.array(z.string()),
    sourceIds: z.array(IdSchema),
  })
  .strict();

const ApplicablePolicySchema = z
  .object({
    policyId: IdSchema,
    kind: z.enum(["pillar", "claim", "competitor", "campaign", "rule"]),
    reasons: z.array(
      z
        .object({
          basis: z.enum([
            "global",
            "selector_match",
            "campaign_reference",
            "claim_reference",
            "active_campaign",
          ]),
          detail: z.string(),
        })
        .strict(),
    ),
  })
  .strict();

const ResolvedContextSchema = z
  .object({
    packId: IdSchema,
    packVersion: z.string(),
    context: ContentContextSchema,
    campaign: CampaignSchema.optional(),
    pillars: z.array(PillarSchema),
    claims: z.array(ClaimSchema),
    competitors: z.array(CompetitorSchema),
    rules: z.array(RuleSchema),
    requirements: z.array(CoverageSchema),
    sourceIds: z.array(IdSchema),
    applicablePolicies: z.array(ApplicablePolicySchema),
    appliedPolicyIds: z.array(IdSchema),
  })
  .strict();

const BriefMessageSchema = z
  .object({
    id: IdSchema,
    kind: z.enum(["pillar", "claim"]),
    name: z.string(),
    message: z.string(),
    sourceIds: z.array(IdSchema),
  })
  .strict();

const BriefRuleSchema = z
  .object({
    id: IdSchema,
    type: z.union([
      RuleTypeSchema,
      z.enum(["prohibited_claim", "campaign_prohibited_message"]),
    ]),
    enforcement: EnforcementSchema,
    description: z.string(),
    triggerSignals: z.array(z.string()),
    requiredSignals: z.array(z.string()).optional(),
    suggestion: z.string().optional(),
    sourceIds: z.array(IdSchema),
  })
  .strict();

const ContentBriefSchema = z
  .object({
    packId: IdSchema,
    packVersion: z.string(),
    context: ContentContextSchema,
    campaign: z
      .object({
        id: IdSchema,
        name: z.string(),
        narrative: z.string(),
        desiredAction: z.string(),
      })
      .strict()
      .optional(),
    mustCarry: z.array(BriefMessageSchema),
    shouldCarry: z.array(BriefMessageSchema),
    opportunities: z.array(BriefMessageSchema),
    approvedClaims: z.array(
      z
        .object({
          id: IdSchema,
          statement: z.string(),
          qualifiers: z.array(ClaimQualifierSchema),
          competitorId: IdSchema.optional(),
          sourceIds: z.array(IdSchema),
        })
        .strict(),
    ),
    avoid: z.array(BriefRuleSchema),
    disclosures: z.array(BriefRuleSchema),
    sourceIds: z.array(IdSchema),
  })
  .strict();

const ContentDecisionSchema = z
  .object({
    decision: z.enum(["pass", "needs_revision", "blocked"]),
    pack: z
      .object({
        id: IdSchema,
        name: z.string(),
        version: z.string(),
        schemaVersion: z.literal("1"),
      })
      .strict(),
    context: ContentContextSchema,
    capabilities: z
      .object({
        deterministic: z.literal("completed"),
        semantic: z.enum(["completed", "not_run", "failed"]),
        semanticDetail: z.string(),
      })
      .strict(),
    applicablePolicies: z.array(ApplicablePolicySchema),
    appliedPolicyIds: z.array(IdSchema),
    coverage: z.array(CoverageSchema),
    findings: z.array(FindingSchema),
  })
  .strict();

const ExplainedItemSchema = z
  .object({
    requestedId: z.string(),
    kind: z.enum(["source", "pillar", "claim", "competitor", "campaign", "rule"]),
    id: IdSchema,
    item: z.union([
      SourceRecordSchema,
      PillarSchema,
      ClaimSchema,
      CompetitorSchema,
      CampaignSchema,
      RuleSchema,
    ]),
    evidence: z.array(FindingEvidenceSchema),
    finding: z
      .object({
        type: FindingTypeSchema,
        certainty: z.enum(["confirmed", "model_assisted"]),
        locationStart: z.number().int().nonnegative().optional(),
        applicability: ApplicablePolicySchema.optional(),
        repairGuidance: z.string(),
      })
      .strict()
      .optional(),
  })
  .strict();

export const GetContextInputSchema = z
  .object({ context: ContentContextSchema })
  .strict();

export const CheckContentInputSchema = z
  .object({
    content: z.string().max(200_000),
    context: ContentContextSchema,
    semantic: z.enum(["auto", "disabled"]).default("auto"),
  })
  .strict();

export const ExplainItemInputSchema = z
  .object({ id: z.string().min(1).max(240), context: ContentContextSchema })
  .strict();

export const GetContextOutputSchema = z
  .object({ result: ResolvedContextSchema })
  .strict();
export const CreateBriefOutputSchema = z
  .object({ result: ContentBriefSchema })
  .strict();
export const CheckContentOutputSchema = z
  .object({ result: ContentDecisionSchema })
  .strict();
export const ExplainItemOutputSchema = z
  .object({ result: ExplainedItemSchema })
  .strict();
