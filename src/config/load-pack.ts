import { readFile, stat } from "node:fs/promises";
import { extname, resolve } from "node:path";
import { parseDocument } from "yaml";
import type { PositioningPack } from "../domain/index.js";
import { PackValidationError, type PackIssue } from "./errors.js";
import { PositioningPackSchema } from "./schema.js";
import { validatePackReferences } from "./validate-pack.js";

export const DEFAULT_MAX_PACK_BYTES = 1_048_576;

export interface LoadPackOptions {
  readonly maxBytes?: number;
}

function structuralIssues(error: {
  readonly issues: readonly unknown[];
}): readonly PackIssue[] {
  return error.issues.map((issue) => {
    const typed = issue as {
      readonly path: readonly PropertyKey[];
      readonly message: string;
    };
    return {
      path: typed.path.length === 0 ? "pack" : typed.path.map(String).join("."),
      message: typed.message,
    };
  });
}

function parseYaml(text: string): unknown {
  const document = parseDocument(text, { uniqueKeys: true });
  if (document.errors.length > 0) {
    throw new PackValidationError(
      "invalid YAML positioning pack",
      document.errors.map((error) => ({ path: "pack", message: error.message })),
    );
  }
  return document.toJS({ maxAliasCount: 0 });
}

function parseText(text: string, extension: string): unknown {
  try {
    if (extension === ".yaml" || extension === ".yml") return parseYaml(text);
    if (extension === ".json") return JSON.parse(text) as unknown;
  } catch (error) {
    if (error instanceof PackValidationError) throw error;
    const message = error instanceof Error ? error.message : "unknown parse error";
    throw new PackValidationError("invalid positioning pack", [
      { path: "pack", message },
    ]);
  }
  throw new PackValidationError("unsupported positioning pack format", [
    { path: "pack", message: "use a .yaml, .yml, or .json file" },
  ]);
}

export function parsePack(
  text: string,
  extension: ".yaml" | ".yml" | ".json",
): PositioningPack {
  const raw = parseText(text, extension);
  const parsed = PositioningPackSchema.safeParse(raw);
  if (!parsed.success) {
    throw new PackValidationError(
      "positioning pack failed schema validation",
      structuralIssues(parsed.error),
    );
  }
  const pack = parsed.data as PositioningPack;
  const issues = validatePackReferences(pack);
  if (issues.length > 0) {
    throw new PackValidationError("positioning pack has invalid references", issues);
  }
  return pack;
}

export async function loadPack(
  path: string,
  options: LoadPackOptions = {},
): Promise<PositioningPack> {
  const absolutePath = resolve(path);
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_PACK_BYTES;
  const metadata = await stat(absolutePath);
  if (!metadata.isFile()) {
    throw new PackValidationError("positioning pack path is not a file", [
      { path: "pack", message: absolutePath },
    ]);
  }
  if (metadata.size > maxBytes) {
    throw new PackValidationError("positioning pack exceeds the size limit", [
      { path: "pack", message: `${metadata.size} bytes exceeds ${maxBytes} bytes` },
    ]);
  }
  const text = await readFile(absolutePath, "utf8");
  return parsePack(
    text,
    extname(absolutePath).toLowerCase() as ".yaml" | ".yml" | ".json",
  );
}
