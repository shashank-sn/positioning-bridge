import type {
  ContentContext,
  FindingType,
  ResolvedPositioningContext,
} from "../domain/index.js";

export interface SemanticReviewRequest {
  readonly content: string;
  readonly context: ContentContext;
  readonly positioning: ResolvedPositioningContext;
}

export interface SemanticFindingCandidate {
  readonly type:
    | "contradiction"
    | "unsupported_claim"
    | "campaign_drift"
    | "positioning_opportunity";
  readonly policyId: string;
  readonly message: string;
  readonly rationale: string;
  readonly start?: number;
  readonly end?: number;
  readonly suggestion?: string;
  readonly confidence: number;
}

export interface SemanticReviewer {
  readonly id: string;
  review(request: SemanticReviewRequest): Promise<readonly SemanticFindingCandidate[]>;
}

export const SEMANTIC_FINDING_TYPES: ReadonlySet<FindingType> = new Set([
  "contradiction",
  "unsupported_claim",
  "campaign_drift",
  "positioning_opportunity",
]);
