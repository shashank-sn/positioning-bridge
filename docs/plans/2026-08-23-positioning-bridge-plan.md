---
title: Positioning Bridge implementation plan
status: implementation-ready
date: 2026-08-23
requirements: docs/plans/2026-08-23-positioning-bridge-requirements.md
architecture: docs/architecture.md
---

# Positioning Bridge implementation plan

## delivery decision

build one TypeScript package targeting supported Node.js LTS releases. use the stable
MCP TypeScript server SDK v2 for a stdio server, Zod for runtime contracts and JSON
Schema generation, YAML for human-owned packs, Vitest for tests, and the TypeScript
compiler for import-graph resolution.

the first repository release is `0.1.0`. it is local-first, has no runtime
model-provider dependency, and exposes a semantic-review port for controlled host
integrations.

## implementation unit 1: repository and public contracts

goal: create a reproducible package with supported entry points and failing contract
tests.

files:

- `package.json`, `package-lock.json`, `tsconfig*.json`;
- `src/domain/model.ts`, `src/domain/index.ts`;
- `src/index.ts`;
- `tests/contracts/pack.test.ts`.

approach:

- define readonly domain types for packs, sources, selectors, messages, claims,
  competitors, campaigns, rules, contexts, findings, and decisions;
- keep IDs as validated strings instead of speculative class wrappers;
- export only documented surfaces.

dependencies: none beyond build and schema tooling.

test scenarios: minimal valid pack, full valid pack, serialization stability, public
export smoke test.

verification: `npm run typecheck`; focused contract tests.

## implementation unit 2: pack parsing and validation

goal: load YAML or JSON safely and reject every invalid reference before serving.

files:

- `src/config/schema.ts`, `src/config/load-pack.ts`, `src/config/errors.ts`,
  `src/config/index.ts`;
- `schemas/positioning-pack.schema.json`;
- `tests/config/*.test.ts`.

approach:

- parse by file extension with a strict byte limit;
- validate structure with Zod;
- run cross-reference validation for unique IDs, selector values, evidence, campaign
  references, and claim relationships;
- precompile literal and phrase signals into normalized forms;
- produce path-specific errors without echoing full sensitive content.

dependencies: unit 1.

test scenarios: valid YAML and JSON, duplicate IDs, missing sources, invalid selectors,
stale-only approved claim, oversized pack, malformed syntax, unsafe pattern length.

verification: focused config tests and generated-schema consistency test.

## implementation unit 3: deterministic policy engine

goal: derive applicable policy, coverage, typed findings, and a decision without network
or model calls.

files:

- `src/domain/context.ts`, `src/domain/text.ts`, `src/domain/evaluate.ts`,
  `src/domain/decision.ts`;
- `tests/domain/*.test.ts`, `tests/fixtures/*.yaml`.

approach:

- validate context IDs and resolve selectors;
- locate literal phrase signals with line, column, and character offsets;
- evaluate required-message coverage;
- match explicit contradiction, prohibited-language, disclosure, and campaign rules;
- detect configured comparative claims and verify active evidence;
- return stable IDs and sorting;
- derive decisions from enforcement and requirement levels without a composite score.

dependencies: units 1 and 2 contracts.

test scenarios: acceptance examples A1-A7 plus overlapping signals, punctuation/case
normalization, repeated matches, expiry boundary, campaign narrowing, and empty drafts.

verification: domain unit tests, mutation-oriented negative fixtures, property tests for
stable ordering where useful.

## implementation unit 4: application services and semantic port

goal: expose one use-case API shared by every delivery adapter.

files:

- `src/application/positioning-service.ts`, `src/application/semantic-reviewer.ts`,
  `src/application/index.ts`;
- `tests/application/*.test.ts`.

approach:

- provide `getContext`, `createBrief`, `checkContent`, and `explainItem`;
- accept an optional `SemanticReviewer` dependency;
- validate candidate semantic findings against applicable policy IDs and content spans;
- retain `model_assisted` certainty and surface adapter errors as degraded capability,
  not a false pass.

dependencies: unit 3.

test scenarios: deterministic-only status, fake semantic adapter, invalid model
references, adapter exception, brief consistency, explanation evidence.

verification: application tests and acceptance A7.

## implementation unit 5: CLI

goal: make the system usable without MCP and provide deterministic exit codes.

files:

- `src/cli/main.ts`, `src/cli/arguments.ts`, `src/cli/render.ts`;
- `tests/cli/*.test.ts`.

approach:

- commands: `init`, `validate`, `check`, and `serve`;
- accept content by file or stdin and context as flags;
- support human and JSON output;
- exit 0 for pass, 1 for needs revision or blocked, and 2 for usage/configuration
  errors;
- write server diagnostics only to stderr.

dependencies: units 2-4 and MCP unit for `serve`.

test scenarios: help, init without overwrite, valid check, blocked check, stdin, JSON
parity, invalid context, invalid pack.

verification: spawned-process integration tests and package-bin smoke test.

## implementation unit 6: MCP server

goal: expose the application contract through a current, read-only stdio server.

files:

- `src/mcp/server.ts`, `src/mcp/schemas.ts`, `src/mcp/result.ts`, `src/mcp/index.ts`;
- `tests/mcp/*.test.ts`.

approach:

- register the four tools in `docs/architecture.md`;
- use Zod input and output schemas;
- set read-only and closed-world annotations;
- return structured content plus a JSON text block;
- construct the pack and service once before connecting stdio;
- do not accept or resolve pack paths inside tools.

dependencies: unit 4 and stable `@modelcontextprotocol/server` v2.

test scenarios: tool discovery, structured output validation, unknown IDs, content
limits, CLI/MCP parity, stdout cleanliness.

verification: in-process MCP transport tests and a spawned stdio handshake.

## implementation unit 7: usable examples and documentation

goal: let a new company go from clone to first check without reading source code.

files:

- `examples/acme/positioning.yaml`, `examples/acme/drafts/*.md`;
- `README.md`, `docs/positioning-pack.md`, `docs/mcp.md`, `docs/hyv-integration.md`,
  `docs/operations.md`;
- MCP client configuration snippets for Codex, Claude Desktop, and generic hosts where
  verified.

approach:

- use a fictional company and clearly invented proof records;
- document the smallest pack, the complete schema, failure meanings, privacy, restarts,
  and exit codes;
- show workflow order: source/fact approval, Positioning Bridge, HYV, human publication
  approval.

dependencies: units 1-6.

test scenarios: every documented command runs; example pass and fail outputs match
expectations; links resolve.

verification: docs smoke script and manual quick-start pass.

## implementation unit 8: OSS and repository operations

goal: make the local Git repository ready for public collaboration and a later remote
push.

files:

- `LICENSE`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md`, `SUPPORT.md`,
  `GOVERNANCE.md`, `CHANGELOG.md`;
- `.github/workflows/ci.yml`, issue templates, pull-request template, Dependabot and
  release configuration;
- `.editorconfig`, `.gitignore`, `.npmrc`, `AGENTS.md`.

approach:

- MIT license;
- minimal governance appropriate for a new project;
- reproducible CI on supported Node versions;
- least-privilege workflow permissions and pinned major action releases;
- package allowlist through `files` and `npm pack --dry-run`.

dependencies: all implementation units.

test scenarios: package content audit, workflow syntax parse, license and links, clean
install from tarball.

verification: `npm pack --dry-run`; install tarball into a temporary directory; run CLI
help and example validation.

## implementation unit 9: architecture, review, and final repository

goal: qualify the exact Git revision and leave one clean local commit.

files:

- `scripts/dependency-graph.mjs`, `build/dependency-graph.json`;
- `.clean-code/commands.json` or the repository verification policy selected during
  setup;
- review and audit artifacts under ignored `build/evidence/`.

approach:

- generate a resolved import graph with the TypeScript compiler;
- run the repository architecture policy;
- run formatter, linter, typecheck, unit, integration, docs, package, and clean-install
  checks;
- conduct blocking review, security pass, and simplification pass;
- initialize Git and commit only after final checks pass.

dependencies: units 1-8.

test scenarios: forbidden dependency fixture makes architecture check fail; final graph
passes; dirty-tree and package allowlist checks are understood.

verification: Clean Code verification bundle, review result, `git diff --check`,
`git status --short`, final commit ID.

## verification contract

| requirement   | hard gate                                            | review signal                    | human gate                                               |
| ------------- | ---------------------------------------------------- | -------------------------------- | -------------------------------------------------------- |
| PB-001-PB-004 | schema and cross-reference test suite                | pack usability review            | product marketer pack review                             |
| PB-010-PB-013 | selector matrix tests                                | applicability explanation review | writer context check                                     |
| PB-020-PB-024 | domain acceptance tests and stable snapshots         | finding usefulness review        | writer finding review                                    |
| PB-030-PB-033 | semantic-port contract tests                         | uncertainty-language review      | semantic findings remain approval-bound                  |
| PB-040-PB-043 | claim, expiry, competitor, and campaign fixtures     | legal-risk boundary review       | company approves real claims                             |
| PB-050-PB-055 | architecture check, CLI/MCP parity and stdio tests   | public API review                | one real host smoke test after handoff                   |
| PB-060-PB-064 | network-free default, size, path, and mutation tests | threat review                    | deployment owner approves future network adapters        |
| PB-070-PB-073 | docs, CI parse, pack, and tarball install checks     | OSS review                       | maintainer chooses remote repository and npm publication |

## definition of done

- all acceptance examples A1-A10 have automated coverage or an explicit human gate;
- architecture check passes against the final import graph;
- all repository scripts pass from a clean install;
- package tarball contains only intended public files and works when installed
  elsewhere;
- README quick start is executed exactly as written;
- no network request occurs in default runtime behavior;
- no blocking review or security finding remains;
- a local Git repository has one verified initial commit;
- remote creation, push, npm publication, hosted control plane, and human company-policy
  approval remain outside this stopping point.

## scope boundaries

the plan does not include a web UI, database, hosted transport, authentication server,
model vendor, CMS crawler, analytics dashboard, HYV dependency, or publication workflow.

## deferred to implementation

- exact command-line parsing library: prefer no dependency if bounded parsing stays
  readable;
- exact schema export mechanism: use Zod-native JSON Schema when it preserves required
  metadata, otherwise generate through a small script;
- import graph script details: use TypeScript resolution rather than regex parsing.
