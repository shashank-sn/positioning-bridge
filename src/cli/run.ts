import { readFile, stat, writeFile } from "node:fs/promises";
import { stringify } from "yaml";
import { PositioningService } from "../application/index.js";
import { PackValidationError, loadPack } from "../config/index.js";
import {
  ContentEvaluationError,
  DEFAULT_MAX_CONTENT_BYTES,
  type ContentDecision,
} from "../domain/index.js";
import { servePositioningBridgeStdio } from "../mcp/index.js";
import { CliUsageError, parseArguments } from "./arguments.js";
import { defaultPack } from "./default-pack.js";
import { HELP_TEXT, renderDecision, renderValidation } from "./render.js";

export interface CliIo {
  readonly stdout: (text: string) => void;
  readonly stderr: (text: string) => void;
  readonly readStdin: () => Promise<string>;
}

async function readContent(path: string): Promise<string> {
  const metadata = await stat(path);
  if (!metadata.isFile()) {
    throw new CliUsageError(`content path is not a file: ${path}`);
  }
  if (metadata.size > DEFAULT_MAX_CONTENT_BYTES) {
    throw new ContentEvaluationError(
      `content is ${metadata.size} bytes; the limit is ${DEFAULT_MAX_CONTENT_BYTES} bytes`,
    );
  }
  return readFile(path, "utf8");
}

function decisionExitCode(result: ContentDecision): number {
  return result.decision === "pass" ? 0 : 1;
}

function renderError(error: unknown): string {
  if (error instanceof PackValidationError) {
    return [
      error.message,
      ...error.issues.map(({ path, message }) => `- ${path}: ${message}`),
    ].join("\n");
  }
  return error instanceof Error ? error.message : "unknown error";
}

export async function runCli(
  argv: readonly string[],
  io: CliIo,
  environment: NodeJS.ProcessEnv = process.env,
): Promise<number> {
  try {
    const command = parseArguments(argv, environment);
    if (command.name === "help") {
      io.stdout(HELP_TEXT.trimEnd());
      return 0;
    }
    if (command.name === "version") {
      io.stdout("0.1.0");
      return 0;
    }
    if (command.name === "init") {
      await writeFile(command.output, stringify(defaultPack, { lineWidth: 88 }), {
        encoding: "utf8",
        flag: "wx",
      });
      io.stdout(`created ${command.output}`);
      return 0;
    }

    const pack = await loadPack(command.pack);
    if (command.name === "validate") {
      io.stdout(
        command.format === "json"
          ? JSON.stringify(pack, null, 2)
          : renderValidation(pack),
      );
      return 0;
    }
    const service = new PositioningService(pack);
    if (command.name === "serve") {
      servePositioningBridgeStdio(service, (error) =>
        io.stderr(`MCP error: ${error.message}`),
      );
      return 0;
    }

    const content = command.stdin
      ? await io.readStdin()
      : await readContent(command.contentPath as string);
    const campaignContext =
      command.campaignId === undefined ? {} : { campaignId: command.campaignId };
    const result = await service.checkContent({
      content,
      context: {
        audienceId: command.audienceId,
        channelId: command.channelId,
        funnelStageId: command.funnelStageId,
        localeId: command.localeId,
        ...campaignContext,
      },
      semantic: command.semantic,
    });
    io.stdout(
      command.format === "json"
        ? JSON.stringify(result, null, 2)
        : renderDecision(result),
    );
    return decisionExitCode(result);
  } catch (error) {
    io.stderr(renderError(error));
    return 2;
  }
}
