import { access, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { parseDocument } from "yaml";

const root = process.cwd();
const required = [
  "README.md",
  "LICENSE",
  "CHANGELOG.md",
  "CODE_OF_CONDUCT.md",
  "CONTRIBUTING.md",
  "GOVERNANCE.md",
  "SECURITY.md",
  "SUPPORT.md",
  "docs/architecture.md",
  "docs/positioning-pack.md",
  "docs/mcp.md",
  "docs/hyv-integration.md",
  "docs/operations.md",
  "docs/testing.md",
  "examples/acme/positioning.yaml",
  ".github/workflows/ci.yml",
  ".github/workflows/dependency-review.yml",
  ".github/workflows/publish.yml",
  ".github/CODEOWNERS",
  ".github/dependabot.yml",
  ".github/release.yml",
];
const errors = [];
const excludedDirectories = new Set([
  ".git",
  "build",
  "coverage",
  "dist",
  "node_modules",
]);

async function findMarkdownFiles(directory) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && excludedDirectories.has(entry.name)) continue;
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...(await findMarkdownFiles(entryPath)));
    else if (entry.isFile() && entry.name.endsWith(".md")) {
      output.push(path.relative(root, entryPath));
    }
  }
  return output;
}

for (const file of required) {
  try {
    await access(path.join(root, file));
  } catch {
    errors.push(`missing required documentation file: ${file}`);
  }
}

const markdownFiles = (await findMarkdownFiles(root)).sort();
for (const file of markdownFiles) {
  let text;
  try {
    text = await readFile(path.join(root, file), "utf8");
  } catch {
    continue;
  }
  if (/\b(?:TODO|TBD|FIXME)\b/u.test(text)) {
    errors.push(`${file} contains an unresolved work marker`);
  }
  if (
    /<repository-url>|(?:after|once) a (?:public )?(?:GitHub )?remote exists/iu.test(
      text,
    )
  ) {
    errors.push(`${file} contains a pre-remote placeholder`);
  }
  const linkPattern = /\[[^\]]+\]\(([^)]+)\)/gu;
  for (const match of text.matchAll(linkPattern)) {
    const target = match[1]?.split("#", 1)[0];
    if (
      target === undefined ||
      target.length === 0 ||
      /^(?:https?:|mailto:)/u.test(target)
    ) {
      continue;
    }
    try {
      await access(path.resolve(root, path.dirname(file), decodeURI(target)));
    } catch {
      errors.push(`${file} has a broken local link: ${target}`);
    }
  }
}

const yamlFiles = required.filter(
  (file) => file.endsWith(".yml") || file.endsWith(".yaml"),
);
for (const file of yamlFiles) {
  try {
    const text = await readFile(path.join(root, file), "utf8");
    const document = parseDocument(text, { uniqueKeys: true });
    for (const error of document.errors) {
      errors.push(`${file} has invalid YAML: ${error.message}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown read error";
    errors.push(`${file} could not be checked: ${message}`);
  }
}

for (const [file, fragments] of [
  [
    ".github/workflows/ci.yml",
    [
      "npm audit --audit-level=moderate",
      "npm run verify",
      "npm run smoke:package",
      "npm run typecheck",
      "npm test",
      "npm run build",
    ],
  ],
  [".github/workflows/dependency-review.yml", ["actions/dependency-review-action@"]],
  [
    ".github/workflows/publish.yml",
    [
      "actions: read",
      "id-token: write",
      "fetch-depth: 0",
      "persist-credentials: false",
      "github.event.release.tag_name",
      "git merge-base --is-ancestor",
      "gh run list --workflow ci.yml",
      "package-manager-cache: false",
      "npm audit --audit-level=moderate",
      "npm run smoke:package",
      "npm publish --access public",
    ],
  ],
]) {
  const text = await readFile(path.join(root, file), "utf8");
  for (const fragment of fragments) {
    if (!text.includes(fragment)) {
      errors.push(`${file} is missing required CI step: ${fragment}`);
    }
  }
  for (const match of text.matchAll(/uses:\s+[^@\s]+@([^\s#]+)/gu)) {
    if (!/^[0-9a-f]{40}$/u.test(match[1] ?? "")) {
      errors.push(`${file} has a GitHub Action that is not pinned to a commit SHA`);
    }
  }
}

const packageMetadata = JSON.parse(
  await readFile(path.join(root, "package.json"), "utf8"),
);
const verifyScript = String(packageMetadata.scripts?.verify ?? "");
for (const command of [
  "format:check",
  "lint",
  "typecheck",
  "test:coverage",
  "schema:check",
  "architecture:check",
  "docs:check",
  "smoke:stdio",
]) {
  if (!verifyScript.includes(command)) {
    errors.push(`package.json verify script is missing ${command}`);
  }
}

if (errors.length > 0) {
  process.stderr.write(`${errors.join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`checked ${markdownFiles.length} documentation files\n`);
}
