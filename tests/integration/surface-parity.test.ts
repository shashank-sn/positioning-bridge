import { mkdtemp, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport } from "@modelcontextprotocol/server";
import { stringify } from "yaml";
import { expect, it } from "vitest";
import { PositioningService } from "../../src/application/index.js";
import { runCli, type CliIo } from "../../src/cli/run.js";
import { createMcpServer } from "../../src/mcp/index.js";
import { considerationContext, validPack } from "../fixtures/pack.js";

const now = (): Date => new Date("2026-08-23T00:00:00.000Z");

it("keeps library, CLI JSON, and MCP results equal without persisting a draft", async () => {
  const directory = await mkdtemp(join(tmpdir(), "positioning-surface-parity-"));
  const packPath = join(directory, "positioning.yaml");
  const content = "The current positioning policy stays under company control.";
  await writeFile(packPath, stringify(validPack), "utf8");
  const filesBefore = await readdir(directory);
  const stdout: string[] = [];
  const io: CliIo = {
    stdout: (text) => stdout.push(text),
    stderr: (text) => {
      throw new Error(text);
    },
    readStdin: () => Promise.resolve(content),
  };
  const expected = await new PositioningService(validPack, { now }).checkContent({
    content,
    context: considerationContext,
    semantic: "disabled",
  });

  expect(
    await runCli(
      [
        "check",
        "--pack",
        packPath,
        "--stdin",
        "--audience",
        considerationContext.audienceId,
        "--channel",
        considerationContext.channelId,
        "--funnel-stage",
        considerationContext.funnelStageId,
        "--locale",
        considerationContext.localeId,
        "--semantic",
        "disabled",
        "--json",
      ],
      io,
      {},
    ),
  ).toBe(0);
  const cliResult: unknown = JSON.parse(stdout[0] ?? "{}");
  expect(cliResult).toEqual(expected);

  const server = createMcpServer(new PositioningService(validPack, { now }));
  const client = new Client({ name: "surface-parity-test", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  try {
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    const response = await client.callTool({
      name: "check_content",
      arguments: {
        content,
        context: considerationContext,
        semantic: "disabled",
      },
    });
    const mcpResult = (response.structuredContent as { result: unknown }).result;
    expect(mcpResult).toEqual(expected);
    expect(mcpResult).toEqual(cliResult);
  } finally {
    await client.close();
    await server.close();
  }

  expect(await readdir(directory)).toEqual(filesBefore);
});
