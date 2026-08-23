export type OutputFormat = "human" | "json";

export type CliCommand =
  | { readonly name: "help" }
  | { readonly name: "version" }
  | { readonly name: "init"; readonly output: string }
  | { readonly name: "validate"; readonly pack: string; readonly format: OutputFormat }
  | {
      readonly name: "check";
      readonly pack: string;
      readonly contentPath?: string;
      readonly stdin: boolean;
      readonly audienceId: string;
      readonly channelId: string;
      readonly funnelStageId: string;
      readonly localeId?: string;
      readonly campaignId?: string;
      readonly semantic: "auto" | "disabled";
      readonly format: OutputFormat;
    }
  | { readonly name: "serve"; readonly pack: string };

export class CliUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CliUsageError";
  }
}

function parseFlags(args: readonly string[]): ReadonlyMap<string, string | true> {
  const flags = new Map<string, string | true>();
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index];
    if (token === undefined || !token.startsWith("--")) {
      throw new CliUsageError(`unexpected argument '${token ?? ""}'`);
    }
    if (flags.has(token)) throw new CliUsageError(`duplicate option '${token}'`);
    if (["--json", "--stdin"].includes(token)) {
      flags.set(token, true);
      continue;
    }
    const value = args[index + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new CliUsageError(`option '${token}' needs a value`);
    }
    flags.set(token, value);
    index += 1;
  }
  return flags;
}

function value(
  flags: ReadonlyMap<string, string | true>,
  name: string,
  fallback?: string,
): string {
  const found = flags.get(name) ?? fallback;
  if (typeof found !== "string" || found.length === 0) {
    throw new CliUsageError(`missing required option '${name}'`);
  }
  return found;
}

function optionalValue(
  flags: ReadonlyMap<string, string | true>,
  name: string,
): string | undefined {
  const found = flags.get(name);
  return typeof found === "string" ? found : undefined;
}

function ensureKnown(
  flags: ReadonlyMap<string, string | true>,
  allowed: readonly string[],
): void {
  for (const name of flags.keys()) {
    if (!allowed.includes(name)) throw new CliUsageError(`unknown option '${name}'`);
  }
}

export function parseArguments(
  argv: readonly string[],
  environment: NodeJS.ProcessEnv = process.env,
): CliCommand {
  const command = argv[0];
  if (
    command === undefined ||
    command === "help" ||
    command === "--help" ||
    command === "-h"
  ) {
    return { name: "help" };
  }
  if (command === "--version" || command === "version") return { name: "version" };
  const flags = parseFlags(argv.slice(1));
  const packFallback = environment.POSITIONING_BRIDGE_PACK;

  if (command === "init") {
    ensureKnown(flags, ["--output"]);
    return {
      name: "init",
      output: optionalValue(flags, "--output") ?? "positioning-bridge.yaml",
    };
  }
  if (command === "validate") {
    ensureKnown(flags, ["--pack", "--json"]);
    return {
      name: "validate",
      pack: value(flags, "--pack", packFallback),
      format: flags.has("--json") ? "json" : "human",
    };
  }
  if (command === "serve") {
    ensureKnown(flags, ["--pack"]);
    return { name: "serve", pack: value(flags, "--pack", packFallback) };
  }
  if (command === "check") {
    ensureKnown(flags, [
      "--pack",
      "--content",
      "--stdin",
      "--audience",
      "--channel",
      "--funnel-stage",
      "--locale",
      "--campaign",
      "--semantic",
      "--json",
    ]);
    const contentPath = optionalValue(flags, "--content");
    const stdin = flags.has("--stdin");
    if ((contentPath === undefined) === !stdin) {
      throw new CliUsageError("choose exactly one of '--content' or '--stdin'");
    }
    const semantic = optionalValue(flags, "--semantic") ?? "auto";
    if (semantic !== "auto" && semantic !== "disabled") {
      throw new CliUsageError("option '--semantic' must be 'auto' or 'disabled'");
    }
    const campaignId = optionalValue(flags, "--campaign");
    const localeId = optionalValue(flags, "--locale");
    return {
      name: "check",
      pack: value(flags, "--pack", packFallback),
      ...(contentPath === undefined ? {} : { contentPath }),
      stdin,
      audienceId: value(flags, "--audience"),
      channelId: value(flags, "--channel"),
      funnelStageId: value(flags, "--funnel-stage"),
      ...(localeId === undefined ? {} : { localeId }),
      ...(campaignId === undefined ? {} : { campaignId }),
      semantic,
      format: flags.has("--json") ? "json" : "human",
    };
  }
  throw new CliUsageError(`unknown command '${command}'`);
}
