import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

const repositoryRoot = process.cwd();
const configPath = ts.findConfigFile(
  repositoryRoot,
  ts.sys.fileExists,
  "tsconfig.build.json",
);
if (configPath === undefined) throw new Error("tsconfig.build.json was not found");

const config = ts.readConfigFile(configPath, ts.sys.readFile);
if (config.error !== undefined) {
  throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, "\n"));
}
const parsed = ts.parseJsonConfigFileContent(
  config.config,
  ts.sys,
  path.dirname(configPath),
);
if (parsed.errors.length > 0) {
  throw new Error(
    parsed.errors
      .map((error) => ts.flattenDiagnosticMessageText(error.messageText, "\n"))
      .join("\n"),
  );
}

const program = ts.createProgram({
  rootNames: parsed.fileNames,
  options: parsed.options,
});
const edges = new Map();

function relative(fileName) {
  return path.relative(repositoryRoot, fileName).split(path.sep).join("/");
}

function moduleSpecifier(node) {
  if (
    (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
    node.moduleSpecifier
  ) {
    return ts.isStringLiteral(node.moduleSpecifier)
      ? node.moduleSpecifier.text
      : undefined;
  }
  if (
    ts.isCallExpression(node) &&
    node.expression.kind === ts.SyntaxKind.ImportKeyword &&
    node.arguments.length === 1 &&
    ts.isStringLiteral(node.arguments[0])
  ) {
    return node.arguments[0].text;
  }
  return undefined;
}

for (const sourceFile of program.getSourceFiles()) {
  const from = relative(sourceFile.fileName);
  if (sourceFile.isDeclarationFile || !from.startsWith("src/")) continue;
  const visit = (node) => {
    const specifier = moduleSpecifier(node);
    if (specifier?.startsWith(".")) {
      const resolved = ts.resolveModuleName(
        specifier,
        sourceFile.fileName,
        parsed.options,
        ts.sys,
      ).resolvedModule;
      if (resolved !== undefined) {
        const to = relative(resolved.resolvedFileName);
        if (to.startsWith("src/") && from !== to)
          edges.set(`${from}\0${to}`, { from, to });
      }
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sourceFile, visit);
}

const graph = {
  schema_version: "1.0.0",
  edges: [...edges.values()].sort(
    (left, right) =>
      left.from.localeCompare(right.from) || left.to.localeCompare(right.to),
  ),
};
await mkdir(path.join(repositoryRoot, "build"), { recursive: true });
await writeFile(
  path.join(repositoryRoot, "build", "dependency-graph.json"),
  `${JSON.stringify(graph, null, 2)}\n`,
  "utf8",
);
process.stdout.write(`generated ${graph.edges.length} dependency edges\n`);
