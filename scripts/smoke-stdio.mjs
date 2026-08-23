import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

const execute = promisify(execFile);
const root = process.cwd();
const cliPath = `${root}/dist/cli/main.js`;
const packPath = `${root}/examples/acme/positioning.yaml`;

const help = await execute(process.execPath, [cliPath, "--help"], { cwd: root });
if (!help.stdout.includes("positioning-bridge 0.1.0") || help.stderr !== "") {
  throw new Error("built CLI help smoke check failed");
}

const validation = await execute(
  process.execPath,
  [cliPath, "validate", "--pack", packPath],
  { cwd: root },
);
if (!validation.stdout.startsWith("valid:") || validation.stderr !== "") {
  throw new Error("built CLI validation smoke check failed");
}

const transport = new StdioClientTransport({
  command: process.execPath,
  args: [cliPath, "serve", "--pack", packPath],
  cwd: root,
  stderr: "pipe",
});
let serverDiagnostics = "";
transport.stderr?.on("data", (chunk) => {
  serverDiagnostics += String(chunk);
});
const client = new Client({
  name: "positioning-bridge-smoke",
  version: "1.0.0",
});

try {
  await client.connect(transport);
  const { tools } = await client.listTools();
  if (tools.length !== 4) {
    throw new Error(`expected 4 MCP tools, received ${tools.length}`);
  }
  const response = await client.callTool({
    name: "get_positioning_context",
    arguments: {
      context: {
        audienceId: "platform-leader",
        channelId: "landing-page",
        funnelStageId: "consideration",
        localeId: "en",
      },
    },
  });
  const result = response.structuredContent?.result;
  if (
    typeof result !== "object" ||
    result === null ||
    !("packId" in result) ||
    result.packId !== "acme-positioning"
  ) {
    throw new Error("MCP context smoke check returned an unexpected result");
  }
} finally {
  await client.close();
}

if (serverDiagnostics.trim().length > 0) {
  throw new Error(
    `MCP server wrote diagnostics during a valid call: ${serverDiagnostics}`,
  );
}

process.stdout.write("built CLI and MCP stdio smoke checks passed\n");
