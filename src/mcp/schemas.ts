import { z } from "zod";

export const ContentContextSchema = z
  .object({
    audienceId: z.string().min(1).max(96),
    channelId: z.string().min(1).max(96),
    funnelStageId: z.string().min(1).max(96),
    localeId: z.string().min(1).max(96),
    campaignId: z.string().min(1).max(96).optional(),
  })
  .strict();

export const GetContextInputSchema = z
  .object({
    context: ContentContextSchema,
  })
  .strict();

export const CheckContentInputSchema = z
  .object({
    content: z.string().max(200_000),
    context: ContentContextSchema,
    semantic: z.enum(["auto", "disabled"]).default("auto"),
  })
  .strict();

export const ExplainItemInputSchema = z
  .object({
    id: z.string().min(1).max(96),
  })
  .strict();

export const ToolOutputSchema = z
  .object({
    result: z.record(z.string(), z.json()),
  })
  .strict();
