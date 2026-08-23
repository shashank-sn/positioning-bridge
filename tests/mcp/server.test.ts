import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/server";
import { afterEach, describe, expect, it } from "vitest";
import { PositioningService } from "../../src/application/index.js";
import { createMcpServer } from "../../src/mcp/index.js";
import { toolResult } from "../../src/mcp/result.js";
import { campaignContext, considerationContext, validPack } from "../fixtures/pack.js";

interface ConnectedPair {
  readonly client: Client;
  readonly server: ReturnType<typeof createMcpServer>;
}

const connected: ConnectedPair[] = [];

async function connect(): Promise<ConnectedPair> {
  const service = new PositioningService(validPack, {
    now: () => new Date("2026-08-23T00:00:00.000Z"),
  });
  const server = createMcpServer(service);
  const client = new Client({ name: "positioning-bridge-test", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  const pair = { client, server };
  connected.push(pair);
  return pair;
}

afterEach(async () => {
  while (connected.length > 0) {
    const pair = connected.pop();
    await pair?.client.close();
    await pair?.server.close();
  }
});

describe("Positioning Bridge MCP server", () => {
  it("advertises four read-only, closed-world tools", async () => {
    const { client } = await connect();
    const { tools } = await client.listTools();

    expect(tools.map(({ name }) => name).sort()).toEqual([
      "check_content",
      "create_content_brief",
      "explain_positioning_item",
      "get_positioning_context",
    ]);
    for (const tool of tools) {
      expect(tool.annotations).toMatchObject({
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      });
      expect(tool.outputSchema).toBeDefined();
    }
  });

  it("returns output-schema-valid structured content and a text fallback", async () => {
    const { client } = await connect();
    const response = await client.callTool({
      name: "check_content",
      arguments: {
        content: "The current positioning policy stays under company control.",
        context: considerationContext,
        semantic: "disabled",
      },
    });
    const structured = response.structuredContent as { result: { decision: string } };

    expect(structured.result.decision).toBe("pass");
    expect(response.content[0]).toMatchObject({ type: "text" });
    expect(
      JSON.parse(
        response.content[0]?.type === "text" ? response.content[0].text : "{}",
      ),
    ).toEqual(response.structuredContent);
  });

  it("keeps MCP and the application service on the same result contract", async () => {
    const { client } = await connect();
    const content = "It trains on customer content.";
    const expected = await new PositioningService(validPack, {
      now: () => new Date("2026-08-23T00:00:00.000Z"),
    }).checkContent({ content, context: considerationContext, semantic: "disabled" });
    const response = await client.callTool({
      name: "check_content",
      arguments: { content, context: considerationContext, semantic: "disabled" },
    });

    expect((response.structuredContent as { result: unknown }).result).toEqual(
      expected,
    );
  });

  it("returns applicable context, brief, and evidence explanations", async () => {
    const { client } = await connect();
    const context = await client.callTool({
      name: "get_positioning_context",
      arguments: { context: considerationContext },
    });
    const brief = await client.callTool({
      name: "create_content_brief",
      arguments: { context: considerationContext },
    });
    const explanation = await client.callTool({
      name: "explain_positioning_item",
      arguments: { id: "claim.no-training" },
    });

    expect(
      (context.structuredContent as { result: { packId: string } }).result.packId,
    ).toBe("acme-positioning");
    expect(
      (brief.structuredContent as { result: { mustCarry: { id: string }[] } }).result
        .mustCarry,
    ).toContainEqual(expect.objectContaining({ id: "pillar.control" }));
    expect(
      (explanation.structuredContent as { result: { kind: string } }).result.kind,
    ).toBe("claim");
  });

  it("preserves an explicit campaign in MCP context conversion", async () => {
    const { client } = await connect();
    const response = await client.callTool({
      name: "get_positioning_context",
      arguments: { context: campaignContext },
    });

    expect(
      (
        response.structuredContent as {
          result: { campaign: { id: string } };
        }
      ).result.campaign.id,
    ).toBe("campaign.launch");
  });

  it("rejects non-object tool output before it reaches the protocol", () => {
    expect(() => toolResult(null)).toThrow("MCP tool output must be a JSON object");
    expect(() => toolResult([])).toThrow("MCP tool output must be a JSON object");
  });
});
