import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

const execute = promisify(execFile);
const root = process.cwd();
let input = process.argv[2];
if (input === undefined) {
  const metadata = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  input = `${String(metadata.name).replace(/^@/u, "").replace("/", "-")}-${String(metadata.version)}.tgz`;
  const packCache = await mkdtemp(
    path.join(tmpdir(), "positioning-bridge-pack-cache-"),
  );
  try {
    await execute("npm", ["pack", "--cache", packCache], { cwd: root });
  } finally {
    await rm(packCache, { recursive: true, force: true });
  }
}
const tarball = path.resolve(root, input);
const metadata = await stat(tarball);
if (!metadata.isFile()) throw new Error(`tarball is not a file: ${tarball}`);

const listing = await execute("tar", ["-tzf", tarball], { cwd: root });
const files = listing.stdout.trim().split("\n");
const required = new Set([
  "package/package.json",
  "package/README.md",
  "package/LICENSE",
  "package/CHANGELOG.md",
  "package/dist/cli/main.js",
  "package/dist/index.js",
  "package/schemas/positioning-pack.schema.json",
]);
for (const file of files) {
  if (
    file === "package/package.json" ||
    file === "package/README.md" ||
    file === "package/LICENSE" ||
    file === "package/CHANGELOG.md" ||
    file.startsWith("package/dist/") ||
    file.startsWith("package/schemas/")
  ) {
    continue;
  }
  throw new Error(`unexpected file in package: ${file}`);
}
for (const file of required) {
  if (!files.includes(file))
    throw new Error(`required package file is missing: ${file}`);
}

const installRoot = await mkdtemp(path.join(tmpdir(), "positioning-bridge-install-"));
try {
  await writeFile(
    path.join(installRoot, "package.json"),
    JSON.stringify({ private: true, type: "module" }),
    "utf8",
  );
  await execute(
    "npm",
    [
      "install",
      tarball,
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--cache",
      path.join(installRoot, "npm-cache"),
    ],
    { cwd: installRoot },
  );

  const binary = path.join(installRoot, "node_modules", ".bin", "positioning-bridge");
  const help = await execute(binary, ["--help"], { cwd: installRoot });
  if (!help.stdout.includes("positioning-bridge 0.1.0") || help.stderr !== "") {
    throw new Error("installed package binary failed its help check");
  }
  const validation = await execute(
    binary,
    ["validate", "--pack", path.join(root, "examples/acme/positioning.yaml")],
    { cwd: installRoot },
  );
  if (!validation.stdout.startsWith("valid:") || validation.stderr !== "") {
    throw new Error("installed package binary failed its validation check");
  }

  const packageJson = JSON.parse(
    await readFile(
      path.join(installRoot, "node_modules", "positioning-bridge", "package.json"),
      "utf8",
    ),
  );
  if (packageJson.version !== "0.1.0") {
    throw new Error(
      `installed unexpected package version ${String(packageJson.version)}`,
    );
  }
  const library = await import(
    pathToFileURL(
      path.join(installRoot, "node_modules", "positioning-bridge", "dist", "index.js"),
    ).href
  );
  if (typeof library.PositioningService !== "function") {
    throw new Error("installed package does not export PositioningService");
  }

  const transport = new StdioClientTransport({
    command: binary,
    args: ["serve", "--pack", path.join(root, "examples/acme/positioning.yaml")],
    cwd: installRoot,
    stderr: "pipe",
  });
  let diagnostics = "";
  transport.stderr?.on("data", (chunk) => {
    diagnostics += String(chunk);
  });
  const client = new Client({
    name: "positioning-bridge-package-smoke",
    version: "1.0.0",
  });
  try {
    await client.connect(transport);
    const { tools } = await client.listTools();
    if (tools.length !== 4) {
      throw new Error(
        `installed MCP server exposed ${tools.length} tools instead of 4`,
      );
    }
  } finally {
    await client.close();
  }
  if (diagnostics.trim().length > 0) {
    throw new Error(`installed MCP server wrote diagnostics: ${diagnostics}`);
  }
} finally {
  await rm(installRoot, { recursive: true, force: true });
}

process.stdout.write(
  `package smoke passed: ${files.length} expected files, clean install, binary, library export, and MCP handshake\n`,
);
