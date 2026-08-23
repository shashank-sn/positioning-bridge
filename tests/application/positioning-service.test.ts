import { describe, expect, it } from "vitest";
import {
  PositioningItemNotFoundError,
  PositioningService,
  type SemanticFindingCandidate,
  type SemanticReviewer,
} from "../../src/application/index.js";
import { campaignContext, considerationContext, validPack } from "../fixtures/pack.js";

const now = (): Date => new Date("2026-08-23T00:00:00.000Z");

describe("PositioningService", () => {
  it("creates a context-specific brief", () => {
    const service = new PositioningService(validPack, { now });
    const brief = service.createBrief(considerationContext);

    expect(brief.mustCarry.map(({ id }) => id)).toEqual(["pillar.control"]);
    expect(brief.shouldCarry.map(({ id }) => id)).toEqual(["claim.no-training"]);
    expect(brief.approvedClaims.map(({ id }) => id)).toContain("claim.no-training");
    expect(brief.approvedClaims.map(({ id }) => id)).not.toContain(
      "claim.stale-alignment",
    );
    expect(brief.avoid).toContainEqual(
      expect.objectContaining({
        id: "claim.only-tool",
        type: "prohibited_claim",
      }),
    );

    expect(
      new PositioningService(validPack, { now }).createBrief(campaignContext).avoid,
    ).toContainEqual(
      expect.objectContaining({
        id: "claim.rival-speed",
        type: "campaign_prohibited_message",
      }),
    );

    const approvedComparisonPack = {
      ...validPack,
      claims: validPack.claims.map((claim) =>
        claim.id === "claim.rival-speed"
          ? {
              ...claim,
              status: "approved" as const,
              qualifiers: ["Applies only to the approved benchmark scope."],
            }
          : claim,
      ),
    };
    const campaignBrief = new PositioningService(approvedComparisonPack, {
      now,
    }).createBrief(campaignContext);
    expect(campaignBrief.approvedClaims.map(({ id }) => id)).not.toContain(
      "claim.rival-speed",
    );
  });

  it("explains an item with current evidence", () => {
    const service = new PositioningService(validPack, { now });
    const explanation = service.explainItem("claim.no-training");

    expect(explanation.kind).toBe("claim");
    expect(explanation.evidence).toContainEqual(
      expect.objectContaining({ sourceId: "source.security", active: true }),
    );
    expect(() => service.explainItem("missing")).toThrow(PositioningItemNotFoundError);

    const source = service.explainItem("source.security");
    expect(source).toMatchObject({
      kind: "source",
      evidence: [expect.objectContaining({ sourceId: "source.security" })],
    });
  });

  it("keeps semantic candidates model-assisted and non-blocking", async () => {
    const reviewer: SemanticReviewer = {
      id: "test-reviewer",
      review() {
        return Promise.resolve([
          {
            type: "contradiction",
            policyId: "pillar.control",
            message: "Possible paraphrased conflict.",
            rationale: "The wording may imply outside control.",
            start: 0,
            end: 7,
            confidence: 0.82,
          },
        ]);
      },
    };
    const service = new PositioningService(validPack, {
      now,
      semanticReviewer: reviewer,
    });
    const result = await service.checkContent({
      content:
        "Outside control, while the current positioning policy stays under company control.",
      context: considerationContext,
    });

    expect(result.decision).toBe("needs_revision");
    expect(result.capabilities.semantic).toBe("completed");
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        certainty: "model_assisted",
        severity: "warning",
        confidence: 0.82,
      }),
    );
  });

  it("reports invalid adapter output as failed without losing deterministic checks", async () => {
    const reviewer: SemanticReviewer = {
      id: "broken-reviewer",
      review() {
        return Promise.resolve([
          {
            type: "contradiction",
            policyId: "missing-policy",
            message: "Bad finding",
            rationale: "Bad reference",
            confidence: 1,
          },
        ]);
      },
    };
    const service = new PositioningService(validPack, {
      now,
      semanticReviewer: reviewer,
    });
    const result = await service.checkContent({
      content: "Our current positioning policy stays under company control.",
      context: considerationContext,
    });

    expect(result.decision).toBe("pass");
    expect(result.capabilities).toMatchObject({ semantic: "failed" });
    expect(result.capabilities.semanticDetail).toContain("inapplicable policy");
  });

  it("lets callers disable a configured semantic reviewer", async () => {
    let called = false;
    const reviewer: SemanticReviewer = {
      id: "test-reviewer",
      review() {
        called = true;
        return Promise.resolve([]);
      },
    };
    const service = new PositioningService(validPack, {
      now,
      semanticReviewer: reviewer,
    });
    const result = await service.checkContent({
      content: "Our current positioning policy stays under company control.",
      context: considerationContext,
      semantic: "disabled",
    });

    expect(called).toBe(false);
    expect(result.capabilities.semanticDetail).toContain("disabled");
  });

  it("accepts bounded semantic opportunities across every applicable policy kind", async () => {
    const reviewer: SemanticReviewer = {
      id: "policy-kind-reviewer",
      review() {
        return Promise.resolve(
          ["competitor.rival-suite", "campaign.launch", "rule.launch-drift"].map(
            (policyId) => ({
              type: "positioning_opportunity" as const,
              policyId,
              message: `Opportunity for ${policyId}`,
              rationale: "The policy is applicable to this campaign context.",
              suggestion: "Consider the approved positioning decision.",
              confidence: 0.7,
            }),
          ),
        );
      },
    };
    const result = await new PositioningService(validPack, {
      now,
      semanticReviewer: reviewer,
    }).checkContent({
      content: "The current positioning policy stays under company control.",
      context: campaignContext,
    });

    expect(result.capabilities.semantic).toBe("completed");
    expect(
      result.findings.filter(({ certainty }) => certainty === "model_assisted"),
    ).toHaveLength(3);
    expect(
      result.findings.filter(({ certainty }) => certainty === "model_assisted"),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ policyId: "competitor.rival-suite" }),
        expect.objectContaining({ policyId: "campaign.launch" }),
        expect.objectContaining({ policyId: "rule.launch-drift" }),
      ]),
    );
  });

  it("fails semantic review visibly for invalid spans, confidence, and non-errors", async () => {
    const candidates = [
      {
        type: "contradiction" as const,
        policyId: "pillar.control",
        message: "Invalid span",
        rationale: "The adapter returned only one offset.",
        start: 0,
        confidence: 0.5,
      },
      {
        type: "contradiction" as const,
        policyId: "pillar.control",
        message: "Invalid confidence",
        rationale: "Confidence is outside the public contract.",
        confidence: 2,
      },
      {
        type: "contradiction" as const,
        policyId: "pillar.control",
        message: "",
        rationale: "The adapter returned an empty message.",
        confidence: 0.5,
      },
    ];

    for (const candidate of candidates) {
      const reviewer: SemanticReviewer = {
        id: "invalid-reviewer",
        review: () => Promise.resolve([candidate]),
      };
      const result = await new PositioningService(validPack, {
        now,
        semanticReviewer: reviewer,
      }).checkContent({
        content: "The current positioning policy stays under company control.",
        context: considerationContext,
      });
      expect(result.capabilities.semantic).toBe("failed");
    }

    const rejected: SemanticReviewer = {
      id: "rejected-reviewer",
      // External adapters can reject with non-Error values despite the contract.
      // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
      review: () => Promise.reject("adapter disconnected"),
    };
    const result = await new PositioningService(validPack, {
      now,
      semanticReviewer: rejected,
    }).checkContent({
      content: "The current positioning policy stays under company control.",
      context: considerationContext,
    });
    expect(result.capabilities.semanticDetail).toContain(
      "unknown semantic review error",
    );
  });

  it("bounds semantic adapter output", async () => {
    const candidate: SemanticFindingCandidate = {
      type: "positioning_opportunity",
      policyId: "pillar.control",
      message: "Bounded opportunity",
      rationale: "The provider repeated one otherwise valid candidate.",
      confidence: 0.5,
    };
    const reviewer: SemanticReviewer = {
      id: "unbounded-reviewer",
      review: () => Promise.resolve(Array.from({ length: 201 }, () => candidate)),
    };
    const result = await new PositioningService(validPack, {
      now,
      semanticReviewer: reviewer,
    }).checkContent({
      content: "The current positioning policy stays under company control.",
      context: considerationContext,
    });

    expect(result.capabilities.semantic).toBe("failed");
    expect(result.capabilities.semanticDetail).toContain("more than 200 findings");
  });
});
