import type {
  Campaign,
  MessageReference,
  PositioningPack,
  Selector,
} from "../domain/index.js";
import type { PackIssue } from "./errors.js";

type CatalogKey = "audiences" | "channels" | "funnelStages" | "locales";

function findDuplicates(values: readonly string[]): readonly string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates].sort();
}

function checkIds(
  values: readonly string[],
  allowed: ReadonlySet<string>,
  path: string,
  issues: PackIssue[],
): void {
  for (const value of values) {
    if (!allowed.has(value)) {
      issues.push({ path, message: `unknown ID '${value}'` });
    }
  }
}

function checkSelector(
  selector: Selector | undefined,
  path: string,
  catalogs: Readonly<Record<CatalogKey | "campaigns", ReadonlySet<string>>>,
  issues: PackIssue[],
): void {
  if (selector === undefined) return;
  checkIds(
    selector.audienceIds ?? [],
    catalogs.audiences,
    `${path}.audienceIds`,
    issues,
  );
  checkIds(selector.channelIds ?? [], catalogs.channels, `${path}.channelIds`, issues);
  checkIds(
    selector.funnelStageIds ?? [],
    catalogs.funnelStages,
    `${path}.funnelStageIds`,
    issues,
  );
  checkIds(selector.localeIds ?? [], catalogs.locales, `${path}.localeIds`, issues);
  checkIds(
    selector.campaignIds ?? [],
    catalogs.campaigns,
    `${path}.campaignIds`,
    issues,
  );
}

function checkMessageReference(
  reference: MessageReference,
  path: string,
  pillars: ReadonlySet<string>,
  claims: ReadonlySet<string>,
  issues: PackIssue[],
): void {
  const allowed = reference.kind === "pillar" ? pillars : claims;
  if (!allowed.has(reference.id)) {
    issues.push({ path, message: `unknown ${reference.kind} ID '${reference.id}'` });
  }
}

function checkCampaign(
  campaign: Campaign,
  index: number,
  catalogs: Readonly<Record<CatalogKey, ReadonlySet<string>>>,
  pillars: ReadonlySet<string>,
  claims: ReadonlySet<string>,
  sources: ReadonlySet<string>,
  issues: PackIssue[],
): void {
  const path = `campaigns.${index}`;
  checkIds(campaign.audienceIds, catalogs.audiences, `${path}.audienceIds`, issues);
  checkIds(campaign.channelIds, catalogs.channels, `${path}.channelIds`, issues);
  checkIds(
    campaign.funnelStageIds,
    catalogs.funnelStages,
    `${path}.funnelStageIds`,
    issues,
  );
  checkIds(campaign.localeIds, catalogs.locales, `${path}.localeIds`, issues);
  checkIds(campaign.sourceIds, sources, `${path}.sourceIds`, issues);
  const groups = ["mustInclude", "shouldInclude", "opportunities"] as const;
  for (const group of groups) {
    campaign[group].forEach((reference, referenceIndex) => {
      checkMessageReference(
        reference,
        `${path}.${group}.${referenceIndex}`,
        pillars,
        claims,
        issues,
      );
    });
    const keys = campaign[group].map(
      (reference) => `${reference.kind}:${reference.id}`,
    );
    for (const duplicate of findDuplicates(keys)) {
      issues.push({
        path: `${path}.${group}`,
        message: `duplicate reference '${duplicate}'`,
      });
    }
  }
  campaign.prohibited.forEach((reference, referenceIndex) => {
    checkMessageReference(
      reference,
      `${path}.prohibited.${referenceIndex}`,
      pillars,
      claims,
      issues,
    );
  });
  const prohibitedKeys = campaign.prohibited.map(
    (reference) => `${reference.kind}:${reference.id}`,
  );
  for (const duplicate of findDuplicates(prohibitedKeys)) {
    issues.push({
      path: `${path}.prohibited`,
      message: `duplicate reference '${duplicate}'`,
    });
  }
  const carryKeys = new Set(
    groups.flatMap((group) =>
      campaign[group].map((reference) => `${reference.kind}:${reference.id}`),
    ),
  );
  for (const prohibited of prohibitedKeys) {
    if (carryKeys.has(prohibited)) {
      issues.push({
        path: `${path}.prohibited`,
        message: `reference '${prohibited}' cannot be both carried and prohibited`,
      });
    }
  }
}

export function validatePackReferences(pack: PositioningPack): readonly PackIssue[] {
  const issues: PackIssue[] = [];
  const catalogs = {
    audiences: new Set(pack.contexts.audiences.map(({ id }) => id)),
    channels: new Set(pack.contexts.channels.map(({ id }) => id)),
    funnelStages: new Set(pack.contexts.funnelStages.map(({ id }) => id)),
    locales: new Set(pack.contexts.locales.map(({ id }) => id)),
  } as const;
  const sources = new Set(pack.sources.map(({ id }) => id));
  const pillars = new Set(pack.pillars.map(({ id }) => id));
  const claims = new Set(pack.claims.map(({ id }) => id));
  const competitors = new Set(pack.competitors.map(({ id }) => id));
  const campaigns = new Set(pack.campaigns.map(({ id }) => id));

  const catalogPairs = Object.entries(pack.contexts) as readonly [
    CatalogKey,
    readonly { readonly id: string }[],
  ][];
  for (const [key, entries] of catalogPairs) {
    for (const duplicate of findDuplicates(entries.map(({ id }) => id))) {
      issues.push({ path: `contexts.${key}`, message: `duplicate ID '${duplicate}'` });
    }
  }
  if (!catalogs.locales.has(pack.defaultLocale)) {
    issues.push({
      path: "defaultLocale",
      message: `unknown locale ID '${pack.defaultLocale}'`,
    });
  }

  const itemGroups = [
    ["sources", pack.sources],
    ["pillars", pack.pillars],
    ["claims", pack.claims],
    ["competitors", pack.competitors],
    ["campaigns", pack.campaigns],
    ["rules", pack.rules],
  ] as const;
  const allItemIds = itemGroups.flatMap(([kind, entries]) =>
    entries.map(({ id }) => ({ id, kind })),
  );
  for (const duplicate of findDuplicates(allItemIds.map(({ id }) => id))) {
    const kinds = allItemIds
      .filter(({ id }) => id === duplicate)
      .map(({ kind }) => kind)
      .join(", ");
    issues.push({
      path: "items",
      message: `ID '${duplicate}' is reused across ${kinds}`,
    });
  }

  pack.pillars.forEach((pillar, index) => {
    checkIds(pillar.sourceIds, sources, `pillars.${index}.sourceIds`, issues);
    checkSelector(
      pillar.requirement?.selectors,
      `pillars.${index}.requirement.selectors`,
      { ...catalogs, campaigns },
      issues,
    );
  });
  pack.claims.forEach((claim, index) => {
    checkIds(claim.sourceIds, sources, `claims.${index}.sourceIds`, issues);
    if (claim.competitorId !== undefined && !competitors.has(claim.competitorId)) {
      issues.push({
        path: `claims.${index}.competitorId`,
        message: `unknown competitor ID '${claim.competitorId}'`,
      });
    }
    if (claim.kind === "comparison" && claim.competitorId === undefined) {
      issues.push({
        path: `claims.${index}.competitorId`,
        message: "comparison claims need a competitorId",
      });
    }
    if (
      claim.status === "approved" &&
      (claim.kind === "comparison" || claim.kind === "superlative") &&
      (claim.qualifiers === undefined || claim.qualifiers.length === 0)
    ) {
      issues.push({
        path: `claims.${index}.qualifiers`,
        message: "approved comparison and superlative claims need a qualifier",
      });
    }
    checkSelector(
      claim.requirement?.selectors,
      `claims.${index}.requirement.selectors`,
      { ...catalogs, campaigns },
      issues,
    );
  });
  pack.competitors.forEach((competitor, index) => {
    checkIds(competitor.sourceIds, sources, `competitors.${index}.sourceIds`, issues);
  });
  pack.campaigns.forEach((campaign, index) => {
    checkCampaign(campaign, index, catalogs, pillars, claims, sources, issues);
  });
  pack.rules.forEach((rule, index) => {
    checkIds(rule.sourceIds, sources, `rules.${index}.sourceIds`, issues);
    checkSelector(
      rule.selectors,
      `rules.${index}.selectors`,
      { ...catalogs, campaigns },
      issues,
    );
  });

  return issues;
}
