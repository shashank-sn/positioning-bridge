import { McpServer } from "@modelcontextprotocol/server";
import { serveStdio, type StdioServerHandle } from "@modelcontextprotocol/server/stdio";
import type { PositioningService } from "../application/index.js";
import type { ContentContext } from "../domain/index.js";
import {
  CheckContentInputSchema,
  CheckContentOutputSchema,
  CreateBriefOutputSchema,
  ExplainItemInputSchema,
  ExplainItemOutputSchema,
  GetContextInputSchema,
  GetContextOutputSchema,
} from "./schemas.js";
import { toolResult } from "./result.js";

const READ_ONLY_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const;

function toContentContext(context: {
  readonly audienceId: string;
  readonly channelId: string;
  readonly funnelStageId: string;
  readonly localeId: string;
  readonly campaignId?: string | undefined;
}): ContentContext {
  return {
    audienceId: context.audienceId,
    channelId: context.channelId,
    funnelStageId: context.funnelStageId,
    localeId: context.localeId,
    ...(context.campaignId === undefined ? {} : { campaignId: context.campaignId }),
  };
}

export function createMcpServer(service: PositioningService): McpServer {
  const server = new McpServer(
    { name: "positioning-bridge", version: "0.1.0" },
    {
      capabilities: { tools: {} },
      instructions:
        "Check message policy before voice editing. Findings are evidence-backed; model-assisted findings still need human review.",
    },
  );

  server.registerTool(
    "get_positioning_context",
    {
      title: "Get applicable positioning context",
      description:
        "Return the pillars, claims, competitors, campaign, rules, and requirements that apply to one explicit content context.",
      inputSchema: GetContextInputSchema,
      outputSchema: GetContextOutputSchema,
      annotations: READ_ONLY_ANNOTATIONS,
    },
    ({ context }) => toolResult(service.getContext(toContentContext(context))),
  );

  server.registerTool(
    "create_content_brief",
    {
      title: "Create a positioning brief",
      description:
        "Return a bounded pre-draft brief with mandatory, recommended, optional, approved, and prohibited messages for one context.",
      inputSchema: GetContextInputSchema,
      outputSchema: CreateBriefOutputSchema,
      annotations: READ_ONLY_ANNOTATIONS,
    },
    ({ context }) => toolResult(service.createBrief(toContentContext(context))),
  );

  server.registerTool(
    "check_content",
    {
      title: "Check content positioning",
      description:
        "Check a draft for explicit contradictions, missing messages, unsupported claims, stale evidence, disclosures, campaign drift, and positioning opportunities.",
      inputSchema: CheckContentInputSchema,
      outputSchema: CheckContentOutputSchema,
      annotations: READ_ONLY_ANNOTATIONS,
    },
    async ({ content, context, semantic }) =>
      toolResult(
        await service.checkContent({
          content,
          context: toContentContext(context),
          semantic,
        }),
      ),
  );

  server.registerTool(
    "explain_positioning_item",
    {
      title: "Explain a positioning item",
      description:
        "Resolve a stable policy ID or emitted finding ID to its complete item, applicability, repair guidance, and current source evidence.",
      inputSchema: ExplainItemInputSchema,
      outputSchema: ExplainItemOutputSchema,
      annotations: READ_ONLY_ANNOTATIONS,
    },
    ({ id, context }) => toolResult(service.explainItem(id, toContentContext(context))),
  );

  return server;
}

export function servePositioningBridgeStdio(
  service: PositioningService,
  onerror: (error: Error) => void = (error) => {
    console.error(`positioning-bridge MCP error: ${error.message}`);
  },
): StdioServerHandle {
  return serveStdio(() => createMcpServer(service), { onerror });
}
