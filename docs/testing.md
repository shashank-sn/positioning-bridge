# testing and evidence

`config/test-plan.json` separates unit, acceptance, integration, and human-facing QA.
`PASS` means the named repository check has run for the current change. `INAPPLICABLE`
means that test shape cannot add evidence for those requirements. `NOT_RUN` stays open.

## automated evidence map

| requirements  | behavior                                                               | evidence                                                                                    |
| ------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| PB-001–PB-004 | pack parsing, schema, references, evidence, and invalid configurations | `tests/config/load-pack.test.ts`                                                            |
| PB-010–PB-013 | context selection, campaign scope, requirements, and applicability     | `tests/domain/evaluate.test.ts`, `tests/cli/main.test.ts`                                   |
| PB-020–PB-024 | decisions, finding contracts, suggestions, and stable output           | `tests/domain/evaluate.test.ts`                                                             |
| PB-030–PB-033 | deterministic, degraded, and model-assisted boundaries                 | `tests/application/positioning-service.test.ts`, `tests/domain/evaluate.test.ts`            |
| PB-040–PB-043 | comparisons, qualifiers, evidence expiry, and campaign narrowing       | `tests/config/load-pack.test.ts`, `tests/domain/evaluate.test.ts`                           |
| PB-050        | dependency direction and prohibited coupling                           | `npm run architecture:check`                                                                |
| PB-051–PB-055 | CLI contracts, MCP schemas, parity, and stdio handshake                | `tests/cli`, `tests/mcp`, `tests/integration/surface-parity.test.ts`, `npm run smoke:stdio` |
| PB-060–PB-064 | local execution, explicit paths, limits, literal input, and read-only  | `tests/cli`, `tests/domain/evaluate.test.ts`, `tests/integration/surface-parity.test.ts`    |
| PB-070        | OSS document integrity                                                 | `npm run docs:check`                                                                        |
| PB-071        | CI definition and live supported-runtime execution                     | `npm run docs:check`, [release evidence](release-evidence.md)                               |
| PB-072        | exact tarball allowlist, links, install, CLI, library, and MCP         | `npm run smoke:package`                                                                     |
| PB-073        | independent README quick start                                         | human check; intentionally `NOT_RUN` in `config/test-plan.json`                             |

`npm run verify` runs formatting, lint, type checking, coverage, schema drift,
architecture, documentation, build, and stdio checks. `npm run smoke:package` then tests
the exact packed artifact. CI repeats both and runs the supported Node.js matrix.

the first public `main` run and its exact commit are recorded in
[release evidence](release-evidence.md). pull requests also run dependency review.

## release boundary

Automated checks do not prove that a real company's positioning is correct or that a
writer finds every suggestion useful. A product marketer must approve the positioning
pack. A writer must judge the content experience. An independent host walkthrough stays
separate from automated test evidence.
