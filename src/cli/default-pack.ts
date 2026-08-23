import type { PositioningPack } from "../domain/index.js";

export const defaultPack: PositioningPack = {
  schemaVersion: "1",
  id: "company-positioning",
  name: "Company positioning",
  version: "0.1",
  description:
    "Replace this fictional starter policy with approved company positioning.",
  defaultLocale: "en",
  contexts: {
    audiences: [{ id: "primary-buyer", name: "Primary buyer" }],
    channels: [{ id: "website", name: "Website" }],
    funnelStages: [{ id: "consideration", name: "Consideration" }],
    locales: [{ id: "en", name: "English" }],
  },
  sources: [
    {
      id: "source.positioning",
      label: "Positioning source pending approval",
      status: "draft",
      visibility: "internal",
      notes: "Set status to approved after the positioning owner verifies this source.",
    },
  ],
  pillars: [
    {
      id: "pillar.primary-value",
      name: "Primary value",
      thesis: "Replace this with the approved positioning thesis.",
      value: "Replace this with the specific customer value.",
      signals: ["approved positioning thesis"],
      sourceIds: ["source.positioning"],
      requirement: {
        level: "must",
        selectors: {
          audienceIds: ["primary-buyer"],
          channelIds: ["website"],
          funnelStageIds: ["consideration"],
          localeIds: ["en"],
        },
      },
    },
  ],
  claims: [],
  competitors: [],
  campaigns: [],
  rules: [],
};
