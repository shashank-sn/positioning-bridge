import type { CallToolResult } from "@modelcontextprotocol/server";

function asJsonObject(value: unknown): Record<string, unknown> {
  const parsed = JSON.parse(JSON.stringify(value)) as unknown;
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new TypeError("MCP tool output must be a JSON object");
  }
  return parsed as Record<string, unknown>;
}

export function toolResult(value: unknown): CallToolResult {
  const result = asJsonObject(value);
  const structuredContent = { result };
  return {
    content: [{ type: "text", text: JSON.stringify(structuredContent) }],
    structuredContent,
  };
}
