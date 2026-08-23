export type RequirementLevel = "must" | "should" | "opportunity";
export type Enforcement = "block" | "warn" | "suggest";
export type SourceStatus = "approved" | "draft" | "deprecated";
export type SourceVisibility = "public" | "internal";
export type ClaimStatus = "approved" | "review_required" | "prohibited";
export type ClaimKind = "fact" | "comparison" | "superlative" | "customer" | "roadmap";
export type RuleType =
  "contradiction" | "prohibited_language" | "required_disclosure" | "campaign_drift";

export interface ContextDefinition {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
}

export interface ContextCatalog {
  readonly audiences: readonly ContextDefinition[];
  readonly channels: readonly ContextDefinition[];
  readonly funnelStages: readonly ContextDefinition[];
  readonly locales: readonly ContextDefinition[];
}

export interface Selector {
  readonly audienceIds?: readonly string[];
  readonly channelIds?: readonly string[];
  readonly funnelStageIds?: readonly string[];
  readonly campaignIds?: readonly string[];
  readonly localeIds?: readonly string[];
}

export interface SourceRecord {
  readonly id: string;
  readonly label: string;
  readonly status: SourceStatus;
  readonly visibility: SourceVisibility;
  readonly uri?: string;
  readonly verifiedAt?: string;
  readonly expiresAt?: string;
  readonly notes?: string;
}

export interface MessageRequirement {
  readonly level: RequirementLevel;
  readonly selectors?: Selector;
}

export interface PositioningPillar {
  readonly id: string;
  readonly name: string;
  readonly thesis: string;
  readonly value: string;
  readonly signals: readonly string[];
  readonly sourceIds: readonly string[];
  readonly requirement?: MessageRequirement;
}

export interface PositioningClaim {
  readonly id: string;
  readonly name: string;
  readonly statement: string;
  readonly kind: ClaimKind;
  readonly status: ClaimStatus;
  readonly enforcement: Enforcement;
  readonly signals: readonly string[];
  readonly sourceIds: readonly string[];
  readonly competitorId?: string;
  readonly qualifiers?: readonly string[];
  readonly expiresAt?: string;
  readonly requirement?: MessageRequirement;
}

export interface Competitor {
  readonly id: string;
  readonly name: string;
  readonly category: string;
  readonly aliases: readonly string[];
  readonly notes?: string;
  readonly sourceIds: readonly string[];
}

export interface MessageReference {
  readonly kind: "pillar" | "claim";
  readonly id: string;
}

export interface CampaignProhibition extends MessageReference {
  readonly enforcement: Enforcement;
}

export interface Campaign {
  readonly id: string;
  readonly name: string;
  readonly narrative: string;
  readonly desiredAction: string;
  readonly audienceIds: readonly string[];
  readonly channelIds: readonly string[];
  readonly funnelStageIds: readonly string[];
  readonly localeIds: readonly string[];
  readonly sourceIds: readonly string[];
  readonly mustInclude: readonly MessageReference[];
  readonly shouldInclude: readonly MessageReference[];
  readonly opportunities: readonly MessageReference[];
  readonly prohibited: readonly CampaignProhibition[];
}

export interface PositioningRule {
  readonly id: string;
  readonly name: string;
  readonly type: RuleType;
  readonly description: string;
  readonly enforcement: Enforcement;
  readonly triggerSignals: readonly string[];
  readonly requiredSignals?: readonly string[];
  readonly selectors?: Selector;
  readonly sourceIds: readonly string[];
  readonly suggestion?: string;
}

export interface PositioningPack {
  readonly schemaVersion: "1";
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly description?: string;
  readonly defaultLocale: string;
  readonly contexts: ContextCatalog;
  readonly sources: readonly SourceRecord[];
  readonly pillars: readonly PositioningPillar[];
  readonly claims: readonly PositioningClaim[];
  readonly competitors: readonly Competitor[];
  readonly campaigns: readonly Campaign[];
  readonly rules: readonly PositioningRule[];
}

export interface ContentContext {
  readonly audienceId: string;
  readonly channelId: string;
  readonly funnelStageId: string;
  readonly localeId: string;
  readonly campaignId?: string;
}

export type PositioningItemKind =
  "source" | "pillar" | "claim" | "competitor" | "campaign" | "rule";

export interface TextLocation {
  readonly start: number;
  readonly end: number;
  readonly line: number;
  readonly column: number;
  readonly quote: string;
}

export interface FindingEvidence {
  readonly sourceId: string;
  readonly label: string;
  readonly status: SourceStatus;
  readonly visibility: SourceVisibility;
  readonly active: boolean;
  readonly uri?: string;
  readonly expiresAt?: string;
}

export type FindingType =
  | "contradiction"
  | "missing_message"
  | "unsupported_claim"
  | "stale_evidence"
  | "required_disclosure"
  | "prohibited_language"
  | "campaign_drift"
  | "positioning_opportunity";
export type FindingSeverity = "error" | "warning" | "suggestion";
export type FindingCertainty = "confirmed" | "model_assisted";

export interface Finding {
  readonly id: string;
  readonly type: FindingType;
  readonly severity: FindingSeverity;
  readonly certainty: FindingCertainty;
  readonly policyId: string;
  readonly message: string;
  readonly rationale: string;
  readonly evidence: readonly FindingEvidence[];
  readonly location?: TextLocation;
  readonly suggestion?: string;
  readonly confidence?: number;
}

export interface MessageCoverage {
  readonly id: string;
  readonly kind: "pillar" | "claim";
  readonly requirement: RequirementLevel;
  readonly matched: boolean;
  readonly matchedSignals: readonly string[];
  readonly sourceIds: readonly string[];
}

export interface CapabilityStatus {
  readonly deterministic: "completed";
  readonly semantic: "completed" | "not_run" | "failed";
  readonly semanticDetail: string;
}

export interface ContentDecision {
  readonly decision: "pass" | "needs_revision" | "blocked";
  readonly pack: {
    readonly id: string;
    readonly name: string;
    readonly version: string;
    readonly schemaVersion: "1";
  };
  readonly context: ContentContext;
  readonly capabilities: CapabilityStatus;
  readonly appliedPolicyIds: readonly string[];
  readonly coverage: readonly MessageCoverage[];
  readonly findings: readonly Finding[];
}

export interface ResolvedPositioningContext {
  readonly packId: string;
  readonly packVersion: string;
  readonly context: ContentContext;
  readonly campaign?: Campaign;
  readonly pillars: readonly PositioningPillar[];
  readonly claims: readonly PositioningClaim[];
  readonly competitors: readonly Competitor[];
  readonly rules: readonly PositioningRule[];
  readonly requirements: readonly MessageCoverage[];
  readonly sourceIds: readonly string[];
  readonly appliedPolicyIds: readonly string[];
}

export interface ContentBrief {
  readonly packId: string;
  readonly packVersion: string;
  readonly context: ContentContext;
  readonly campaign?: {
    readonly id: string;
    readonly name: string;
    readonly narrative: string;
    readonly desiredAction: string;
  };
  readonly mustCarry: readonly BriefMessage[];
  readonly shouldCarry: readonly BriefMessage[];
  readonly opportunities: readonly BriefMessage[];
  readonly approvedClaims: readonly BriefClaim[];
  readonly avoid: readonly BriefRule[];
  readonly sourceIds: readonly string[];
}

export interface BriefMessage {
  readonly id: string;
  readonly kind: "pillar" | "claim";
  readonly name: string;
  readonly message: string;
  readonly sourceIds: readonly string[];
}

export interface BriefClaim {
  readonly id: string;
  readonly statement: string;
  readonly qualifiers: readonly string[];
  readonly competitorId?: string;
  readonly sourceIds: readonly string[];
}

export interface BriefRule {
  readonly id: string;
  readonly type: RuleType | "prohibited_claim" | "campaign_prohibited_message";
  readonly description: string;
  readonly suggestion?: string;
  readonly sourceIds: readonly string[];
}

export interface ExplainedItem {
  readonly kind: PositioningItemKind;
  readonly id: string;
  readonly item:
    | SourceRecord
    | PositioningPillar
    | PositioningClaim
    | Competitor
    | Campaign
    | PositioningRule;
  readonly evidence: readonly FindingEvidence[];
}
