import { describe, expect, it } from "vitest";
import {
  ContentContextError,
  ContentEvaluationError,
  evidenceForSourceIds,
  evaluateContent,
  findSignalMatches,
  resolvePositioningContext,
  sourceIsActive,
} from "../../src/domain/index.js";
import { campaignContext, considerationContext, validPack } from "../fixtures/pack.js";

const now = new Date("2026-08-23T00:00:00.000Z");

describe("deterministic positioning evaluation", () => {
  it("reports a required message without inventing replacement copy", () => {
    const result = evaluateContent(
      validPack,
      "A short product page.",
      considerationContext,
      {
        now,
      },
    );

    expect(result.decision).toBe("needs_revision");
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        type: "missing_message",
        policyId: "pillar.control",
        certainty: "confirmed",
        severity: "warning",
      }),
    );
    expect(
      result.findings.find(({ policyId }) => policyId === "pillar.control")?.suggestion,
    ).toContain("Cover this approved message");
  });

  it("keeps absent optional messages as suggestions on a passing draft", () => {
    const result = evaluateContent(
      validPack,
      "Our current positioning policy stays under company control.",
      considerationContext,
      { now },
    );

    expect(result.decision).toBe("pass");
    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          policyId: "claim.no-training",
          severity: "suggestion",
        }),
        expect.objectContaining({
          policyId: "pillar.evidence",
          severity: "suggestion",
        }),
      ]),
    );
  });

  it("blocks an explicit contradiction at the exact draft location", () => {
    const content = "Fast setup.\nIt trains on customer content by default.";
    const result = evaluateContent(validPack, content, considerationContext, { now });
    const finding = result.findings.find(
      ({ policyId }) => policyId === "rule.training-contradiction",
    );

    expect(result.decision).toBe("blocked");
    expect(finding).toMatchObject({
      type: "contradiction",
      severity: "error",
      certainty: "confirmed",
      location: { line: 2, column: 4, quote: "trains on customer content" },
    });
    expect(finding?.evidence[0]).toMatchObject({
      sourceId: "source.security",
      active: true,
    });
  });

  it("flags a configured competitive claim that still needs review", () => {
    const result = evaluateContent(
      validPack,
      "The current positioning policy stays under company control. We are twice as fast as RivalSuite.",
      considerationContext,
      { now },
    );

    expect(result.decision).toBe("needs_revision");
    expect(result.findings).toContainEqual(
      expect.objectContaining({
        type: "unsupported_claim",
        policyId: "claim.rival-speed",
        severity: "warning",
      }),
    );
  });

  it("does not treat expired proof as active support", () => {
    const result = evaluateContent(
      validPack,
      "Our current positioning policy stays under company control and delivers 99.9% message alignment.",
      considerationContext,
      { now },
    );

    expect(result.findings).toContainEqual(
      expect.objectContaining({
        type: "stale_evidence",
        policyId: "claim.stale-alignment",
        severity: "warning",
      }),
    );
  });

  it("changes applicability with content context", () => {
    const blogContext = {
      ...considerationContext,
      audienceId: "developer",
      channelId: "blog",
      funnelStageId: "awareness",
    };
    const landing = resolvePositioningContext(validPack, considerationContext);
    const blog = resolvePositioningContext(validPack, blogContext);

    expect(landing.requirements.map(({ id }) => id)).toContain("pillar.control");
    expect(blog.requirements.map(({ id }) => id)).not.toContain("pillar.control");
  });

  it("reports semantic review as not run", () => {
    const result = evaluateContent(
      validPack,
      "Our current positioning policy stays under company control.",
      considerationContext,
      { now },
    );

    expect(result.capabilities).toEqual({
      deterministic: "completed",
      semantic: "not_run",
      semanticDetail:
        "No semantic reviewer was configured; model-assisted checks were not run.",
    });
  });

  it("requires a disclosure only when its trigger is present", () => {
    const missing = evaluateContent(
      validPack,
      "Our current positioning policy stays under company control. Read this customer story.",
      considerationContext,
      { now },
    );
    const present = evaluateContent(
      validPack,
      "Our current positioning policy stays under company control. This customer story is used with permission.",
      considerationContext,
      { now },
    );

    expect(missing.findings).toContainEqual(
      expect.objectContaining({
        type: "required_disclosure",
        policyId: "rule.story-disclosure",
      }),
    );
    expect(present.findings).not.toContainEqual(
      expect.objectContaining({ policyId: "rule.story-disclosure" }),
    );
  });

  it("applies campaign drift rules only to the selected campaign", () => {
    const content =
      "Our current positioning policy stays under company control. A generic AI writer.";
    const campaign = evaluateContent(validPack, content, campaignContext, { now });
    const general = evaluateContent(validPack, content, considerationContext, { now });

    expect(campaign.findings).toContainEqual(
      expect.objectContaining({
        type: "campaign_drift",
        policyId: "rule.launch-drift",
      }),
    );
    expect(general.findings).not.toContainEqual(
      expect.objectContaining({ policyId: "rule.launch-drift" }),
    );
  });

  it("enforces a campaign-owned prohibited message", () => {
    const content =
      "The current positioning policy stays under company control. Acme is twice as fast as RivalSuite.";
    const campaign = evaluateContent(validPack, content, campaignContext, { now });
    const general = evaluateContent(validPack, content, considerationContext, { now });

    expect(campaign.decision).toBe("blocked");
    expect(campaign.findings).toContainEqual(
      expect.objectContaining({
        type: "campaign_drift",
        policyId: "claim.rival-speed",
        severity: "error",
      }),
    );
    expect(general.decision).toBe("needs_revision");
    expect(general.findings).not.toContainEqual(
      expect.objectContaining({ type: "campaign_drift" }),
    );
  });

  it("matches whole signal phrases without substring false positives", () => {
    expect(findSignalMatches("breakfast", ["fast"])).toHaveLength(0);
    expect(findSignalMatches("Fast setup", ["fast"])).toHaveLength(1);
    expect(
      findSignalMatches("policy  stays\nunder company control", [
        "policy stays under company control",
      ]),
    ).toHaveLength(1);
  });

  it("rejects unknown context values and oversized content", () => {
    expect(() =>
      resolvePositioningContext(validPack, {
        ...considerationContext,
        channelId: "email",
      }),
    ).toThrow(ContentContextError);
    expect(() =>
      evaluateContent(validPack, "12345", considerationContext, {
        now,
        maxContentBytes: 4,
      }),
    ).toThrow(ContentEvaluationError);
  });

  it("returns stable findings for the same input", () => {
    const content = "Guaranteed results from the only positioning tool.";
    const first = evaluateContent(validPack, content, considerationContext, { now });
    const second = evaluateContent(validPack, content, considerationContext, { now });

    expect(first).toEqual(second);
    expect(first.findings.map(({ severity }) => severity).slice(0, 2)).toEqual([
      "error",
      "error",
    ]);
    expect(first.findings).toContainEqual(
      expect.objectContaining({
        policyId: "claim.only-tool",
        suggestion: "Remove this claim or replace it with an active approved claim.",
      }),
    );
  });

  it("reports stale pillar, rule, and campaign evidence independently", () => {
    const pack = {
      ...validPack,
      sources: validPack.sources.map((source) =>
        source.id === "source.positioning"
          ? { ...source, status: "deprecated" as const }
          : source,
      ),
    };
    const result = evaluateContent(
      pack,
      "The current positioning policy stays under company control. A generic AI writer with guaranteed results.",
      campaignContext,
      { now },
    );

    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "stale_evidence",
          policyId: "pillar.control",
        }),
        expect.objectContaining({
          type: "stale_evidence",
          policyId: "rule.guarantee",
        }),
        expect.objectContaining({
          type: "stale_evidence",
          policyId: "campaign.launch",
        }),
      ]),
    );
  });

  it("validates campaign identity, applicability, and stronger campaign requirements", () => {
    expect(() =>
      resolvePositioningContext(validPack, {
        ...considerationContext,
        campaignId: "campaign.missing",
      }),
    ).toThrow("unknown campaignId");
    expect(() =>
      resolvePositioningContext(validPack, {
        ...campaignContext,
        audienceId: "developer",
      }),
    ).toThrow("does not apply to audienceId");

    const pack = {
      ...validPack,
      campaigns: validPack.campaigns.map((campaign) => ({
        ...campaign,
        mustInclude: [
          ...campaign.mustInclude,
          { kind: "claim" as const, id: "claim.no-training" },
        ],
      })),
    };
    expect(
      resolvePositioningContext(pack, campaignContext).requirements.find(
        ({ id }) => id === "claim.no-training",
      )?.requirement,
    ).toBe("must");
  });

  it("handles source boundaries and guards impossible missing references", () => {
    expect(
      sourceIsActive(
        {
          id: "source.no-expiry",
          label: "Current source",
          status: "approved",
          visibility: "internal",
          verifiedAt: "2026-08-23",
        },
        now,
      ),
    ).toBe(true);
    expect(
      sourceIsActive(
        {
          id: "source.draft",
          label: "Draft source",
          status: "draft",
          visibility: "internal",
          verifiedAt: "2026-08-23",
        },
        now,
      ),
    ).toBe(false);
    expect(() => evidenceForSourceIds(validPack, ["source.missing"], now)).toThrow(
      "validated pack is missing source",
    );
  });
});
