import { z } from "zod";

const id = z
  .string()
  .min(1)
  .max(96)
  .regex(
    /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/,
    "use a lowercase stable ID with dots, dashes, or underscores",
  );
const shortText = z.string().trim().min(1).max(240);
const longText = z.string().trim().min(1).max(4_000);
const date = z.iso.date();
const signal = z
  .string()
  .trim()
  .min(2)
  .max(160)
  .refine((value) => !value.includes("\n"), "signals must be one line");
const signalList = z.array(signal).min(1).max(80);
const idList = z.array(id).min(1).max(100);

const ContextDefinitionSchema = z
  .object({
    id,
    name: shortText,
    description: longText.optional(),
  })
  .strict();

const SelectorSchema = z
  .object({
    audienceIds: idList.optional(),
    channelIds: idList.optional(),
    funnelStageIds: idList.optional(),
    campaignIds: idList.optional(),
    localeIds: idList.optional(),
  })
  .strict();

const SourceSchema = z
  .object({
    id,
    label: shortText,
    status: z.enum(["approved", "draft", "deprecated"]),
    visibility: z.enum(["public", "internal"]),
    uri: z.url().max(2_000).optional(),
    verifiedAt: date.optional(),
    expiresAt: date.optional(),
    notes: longText.optional(),
  })
  .strict();

const RequirementSchema = z
  .object({
    level: z.enum(["must", "should", "opportunity"]),
    selectors: SelectorSchema.optional(),
  })
  .strict();

const PillarSchema = z
  .object({
    id,
    name: shortText,
    thesis: longText,
    value: longText,
    signals: signalList,
    sourceIds: idList,
    requirement: RequirementSchema.optional(),
  })
  .strict();

const ClaimSchema = z
  .object({
    id,
    name: shortText,
    statement: longText,
    kind: z.enum(["fact", "comparison", "superlative", "customer", "roadmap"]),
    status: z.enum(["approved", "review_required", "prohibited"]),
    enforcement: z.enum(["block", "warn", "suggest"]),
    signals: signalList,
    sourceIds: idList,
    competitorId: id.optional(),
    qualifiers: z.array(shortText).max(20).optional(),
    expiresAt: date.optional(),
    requirement: RequirementSchema.optional(),
  })
  .strict();

const CompetitorSchema = z
  .object({
    id,
    name: shortText,
    category: shortText,
    aliases: signalList,
    notes: longText.optional(),
    sourceIds: idList,
  })
  .strict();

const MessageReferenceSchema = z
  .object({
    kind: z.enum(["pillar", "claim"]),
    id,
  })
  .strict();

const CampaignProhibitionSchema = MessageReferenceSchema.extend({
  enforcement: z.enum(["block", "warn", "suggest"]),
}).strict();

const CampaignSchema = z
  .object({
    id,
    name: shortText,
    narrative: longText,
    desiredAction: longText,
    audienceIds: idList,
    channelIds: idList,
    funnelStageIds: idList,
    localeIds: idList,
    sourceIds: idList,
    mustInclude: z.array(MessageReferenceSchema).max(100),
    shouldInclude: z.array(MessageReferenceSchema).max(100),
    opportunities: z.array(MessageReferenceSchema).max(100),
    prohibited: z.array(CampaignProhibitionSchema).max(100),
  })
  .strict();

const RuleSchema = z
  .object({
    id,
    name: shortText,
    type: z.enum([
      "contradiction",
      "prohibited_language",
      "required_disclosure",
      "campaign_drift",
    ]),
    description: longText,
    enforcement: z.enum(["block", "warn", "suggest"]),
    triggerSignals: signalList,
    requiredSignals: signalList.optional(),
    selectors: SelectorSchema.optional(),
    sourceIds: idList,
    suggestion: longText.optional(),
  })
  .strict()
  .superRefine((rule, context) => {
    if (rule.type === "required_disclosure" && rule.requiredSignals === undefined) {
      context.addIssue({
        code: "custom",
        path: ["requiredSignals"],
        message: "required-disclosure rules need requiredSignals",
      });
    }
    if (rule.type !== "required_disclosure" && rule.requiredSignals !== undefined) {
      context.addIssue({
        code: "custom",
        path: ["requiredSignals"],
        message: "requiredSignals are only valid for required-disclosure rules",
      });
    }
  });

export const PositioningPackSchema = z
  .object({
    schemaVersion: z.literal("1"),
    id,
    name: shortText,
    version: shortText,
    description: longText.optional(),
    defaultLocale: id,
    contexts: z
      .object({
        audiences: z.array(ContextDefinitionSchema).min(1).max(100),
        channels: z.array(ContextDefinitionSchema).min(1).max(100),
        funnelStages: z.array(ContextDefinitionSchema).min(1).max(100),
        locales: z.array(ContextDefinitionSchema).min(1).max(100),
      })
      .strict(),
    sources: z.array(SourceSchema).min(1).max(1_000),
    pillars: z.array(PillarSchema).max(1_000),
    claims: z.array(ClaimSchema).max(1_000),
    competitors: z.array(CompetitorSchema).max(500),
    campaigns: z.array(CampaignSchema).max(500),
    rules: z.array(RuleSchema).max(2_000),
  })
  .strict();

export const positioningPackJsonSchema = z.toJSONSchema(PositioningPackSchema, {
  target: "draft-2020-12",
  unrepresentable: "throw",
});
