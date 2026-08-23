import { access, readFile } from "node:fs/promises";
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
  "examples/acme/positioning.yaml",
  ".github/workflows/ci.yml",
  ".github/workflows/dependency-review.yml",
  ".github/dependabot.yml",
  ".github/release.yml",
];
const errors = [];

for (const file of required) {
  try {
    await access(path.join(root, file));
  } catch {
    errors.push(`missing required documentation file: ${file}`);
  }
}

const markdownFiles = required.filter((file) => file.endsWith(".md"));
for (const file of markdownFiles) {
  let text;
  try {
    text = await readFile(path.join(root, file), "utf8");
  } catch {
    continue;
  }
  if (/\b(?:TODO|TBD)\b/u.test(text)) errors.push(`${file} contains TODO or TBD`);
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

if (errors.length > 0) {
  process.stderr.write(`${errors.join("\n")}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`checked ${markdownFiles.length} documentation files\n`);
}
