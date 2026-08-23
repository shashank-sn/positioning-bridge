import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stringify } from "yaml";
import { describe, expect, it } from "vitest";
import {
  PackValidationError,
  loadPack,
  parsePack,
  positioningPackJsonSchema,
  validatePackReferences,
} from "../../src/config/index.js";
import type { PositioningPack } from "../../src/domain/index.js";
import { validPack } from "../fixtures/pack.js";

type DeepMutable<T> = T extends readonly (infer Item)[]
  ? DeepMutable<Item>[]
  : T extends object
    ? { -readonly [Key in keyof T]: DeepMutable<T[Key]> }
    : T;

describe("positioning pack loading", () => {
  it("loads the same contract from JSON and YAML", () => {
    const json = parsePack(JSON.stringify(validPack), ".json");
    const yaml = parsePack(stringify(validPack), ".yaml");

    expect(json).toEqual(validPack);
    expect(yaml).toEqual(validPack);
  });

  it("rejects malformed syntax and unsupported formats", () => {
    expect(() => parsePack("{", ".json")).toThrow(PackValidationError);
    expect(() => parsePack("a: 1", ".yaml")).toThrow(PackValidationError);
    expect(() => parsePack("x", ".json")).toThrow(PackValidationError);
  });

  it("rejects duplicate YAML keys", () => {
    expect(() =>
      parsePack("schemaVersion: '1'\nschemaVersion: '1'\n", ".yaml"),
    ).toThrow(/invalid YAML positioning pack/);
  });

  it("reports missing references with a stable path", () => {
    const pack = structuredClone(validPack) as unknown as {
      pillars: { sourceIds: string[] }[];
    };
    pack.pillars[0]?.sourceIds.push("source.missing");

    expect(validatePackReferences(pack as never)).toContainEqual({
      path: "pillars.0.sourceIds",
      message: "unknown ID 'source.missing'",
    });
  });

  it("rejects comparison claims without a competitor", () => {
    const pack = structuredClone(validPack) as unknown as {
      claims: { kind: string; competitorId?: string }[];
    };
    delete pack.claims[1]?.competitorId;

    expect(validatePackReferences(pack as never)).toContainEqual({
      path: "claims.1.competitorId",
      message: "comparison claims need a competitorId",
    });
  });

  it("exports a Draft 2020-12 JSON Schema", () => {
    expect(positioningPackJsonSchema).toMatchObject({
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
    });
  });

  it("loads regular files and rejects directories, oversized packs, and extensions", async () => {
    const directory = await mkdtemp(join(tmpdir(), "positioning-pack-test-"));
    const jsonPath = join(directory, "positioning.json");
    const textPath = join(directory, "positioning.txt");
    const oversizedPath = join(directory, "oversized.yaml");
    const nestedDirectory = join(directory, "nested");
    await writeFile(jsonPath, JSON.stringify(validPack), "utf8");
    await writeFile(textPath, "plain text", "utf8");
    await writeFile(oversizedPath, "x".repeat(11), "utf8");
    await mkdir(nestedDirectory);

    await expect(loadPack(jsonPath)).resolves.toEqual(validPack);
    await expect(loadPack(nestedDirectory)).rejects.toThrow(
      "positioning pack path is not a file",
    );
    await expect(loadPack(oversizedPath, { maxBytes: 10 })).rejects.toThrow(
      "positioning pack exceeds the size limit",
    );
    await expect(loadPack(textPath)).rejects.toThrow(
      "unsupported positioning pack format",
    );
  });

  it("reports duplicate IDs and references across every policy catalog", () => {
    const pack = structuredClone(validPack) as DeepMutable<PositioningPack>;
    const claim = pack.claims[0];
    const competitor = pack.competitors[0];
    const campaign = pack.campaigns[0];
    const rule = pack.rules[0];
    if (
      claim === undefined ||
      claim.requirement === undefined ||
      competitor === undefined ||
      campaign === undefined ||
      rule === undefined
    ) {
      throw new Error("test fixture is missing required policy items");
    }
    pack.contexts.audiences.push({ id: "platform-leader", name: "Duplicate" });
    pack.defaultLocale = "missing-locale";
    claim.id = "pillar.control";
    claim.competitorId = "competitor.missing";
    claim.requirement.selectors = {
      audienceIds: ["audience.missing"],
      channelIds: ["channel.missing"],
      funnelStageIds: ["stage.missing"],
      localeIds: ["locale.missing"],
      campaignIds: ["campaign.missing"],
    };
    competitor.sourceIds.push("source.missing");
    campaign.sourceIds.push("source.missing");
    campaign.audienceIds.push("audience.missing");
    campaign.channelIds.push("channel.missing");
    campaign.funnelStageIds.push("stage.missing");
    campaign.localeIds.push("locale.missing");
    campaign.mustInclude.push({ kind: "claim", id: "claim.missing" });
    campaign.opportunities.push({ kind: "pillar", id: "pillar.missing" });
    campaign.prohibited.push({
      kind: "claim",
      id: "claim.missing",
      enforcement: "block",
    });
    campaign.prohibited.push(campaign.prohibited[0]!);
    campaign.mustInclude.push({ kind: "claim", id: "claim.rival-speed" });
    const existingShould = campaign.shouldInclude[0];
    if (existingShould === undefined) {
      throw new Error("test fixture is missing a campaign should requirement");
    }
    campaign.shouldInclude.push(existingShould);
    rule.sourceIds.push("source.missing");
    rule.selectors = { campaignIds: ["campaign.missing"] };

    const issues = validatePackReferences(pack);
    expect(issues.map(({ path }) => path)).toEqual(
      expect.arrayContaining([
        "contexts.audiences",
        "defaultLocale",
        "items",
        "claims.0.competitorId",
        "claims.0.requirement.selectors.audienceIds",
        "claims.0.requirement.selectors.channelIds",
        "claims.0.requirement.selectors.funnelStageIds",
        "claims.0.requirement.selectors.localeIds",
        "claims.0.requirement.selectors.campaignIds",
        "competitors.0.sourceIds",
        "campaigns.0.sourceIds",
        "campaigns.0.mustInclude.1",
        "campaigns.0.opportunities.1",
        "campaigns.0.prohibited.1",
        "campaigns.0.prohibited",
        "campaigns.0.shouldInclude",
        "rules.0.sourceIds",
        "rules.0.selectors.campaignIds",
      ]),
    );
    expect(issues).toContainEqual({
      path: "campaigns.0.prohibited",
      message:
        "reference 'claim:claim.rival-speed' cannot be both carried and prohibited",
    });
  });

  it("requires qualifiers on approved comparison and superlative claims", () => {
    const pack = structuredClone(validPack) as DeepMutable<PositioningPack>;
    const comparison = pack.claims.find(({ id }) => id === "claim.rival-speed");
    if (comparison === undefined) throw new Error("test fixture claim is missing");
    comparison.status = "approved";
    comparison.qualifiers = [];

    expect(validatePackReferences(pack)).toContainEqual({
      path: "claims.1.qualifiers",
      message: "approved comparison and superlative claims need a qualifier",
    });
  });

  it("rejects required messages that would approve a non-approved claim", () => {
    const pack = structuredClone(validPack) as DeepMutable<PositioningPack>;
    const campaign = pack.campaigns[0];
    const prohibited = pack.claims.find(({ id }) => id === "claim.only-tool");
    const reviewRequired = pack.claims.find(({ id }) => id === "claim.rival-speed");
    if (
      campaign === undefined ||
      prohibited === undefined ||
      reviewRequired === undefined
    ) {
      throw new Error("test fixture is missing claim-policy cases");
    }
    campaign.mustInclude.push({ kind: "claim", id: prohibited.id });
    campaign.shouldInclude.push({ kind: "claim", id: reviewRequired.id });
    prohibited.requirement = { level: "must" };

    expect(validatePackReferences(pack)).toEqual(
      expect.arrayContaining([
        {
          path: "claims.3.requirement",
          message: "only approved claims can be required messages",
        },
        {
          path: "campaigns.0.mustInclude.1",
          message:
            "campaign messages can only carry approved claims; 'claim.only-tool' is prohibited",
        },
        {
          path: "campaigns.0.shouldInclude.1",
          message:
            "campaign messages can only carry approved claims; 'claim.rival-speed' is review_required",
        },
      ]),
    );
  });
});
