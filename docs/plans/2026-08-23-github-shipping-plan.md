---
title: Positioning Bridge GitHub shipping plan
status: implementation-ready
date: 2026-08-23
requirements: docs/plans/2026-08-23-positioning-bridge-requirements.md
architecture: docs/architecture.md
---

# Positioning Bridge GitHub shipping plan

## objective

publish the verified Positioning Bridge source to a public GitHub repository with an
accurate README, current runtime support, traceable applicability output, working CI,
and named maintenance and security routes.

## scope boundaries

this shipment creates and configures the source repository. it does not publish the npm
package, create a GitHub release, send company content to a hosted service, or mark the
four real-world human spot checks complete.

## implementation unit 1: close product-contract gaps

goal: make PB-013 machine-verifiable instead of relying on callers to infer why a policy
was applied.

files: `src/domain/model.ts`, `src/domain/context.ts`, evaluator and service tests,
public documentation.

approach: return a stable applicability record for every applied pillar, claim,
competitor, campaign, and rule. each record names its policy kind and the global,
selector, campaign, or claim-reference reason that made it applicable.

verification: a behavior-level selector and campaign test, stable repeat output, CLI
JSON and MCP parity, full verification.

## implementation unit 2: public repository contract

goal: remove every pre-remote placeholder and make the repository usable from its public
URL.

files: `README.md`, `package.json`, `CONTRIBUTING.md`, `SECURITY.md`, `SUPPORT.md`,
`GOVERNANCE.md`, `.github/CODEOWNERS`, operations and changelog documentation.

approach: add exact clone and setup commands, repository metadata, owner and support
links, private vulnerability reporting, current Node.js support, and a concise project
status boundary.

verification: documentation link and placeholder checks across every tracked Markdown
file, package metadata inspection, and the README quick start run exactly as written.

## implementation unit 3: release and CI hardening

goal: prove the GitHub revision with least-privilege automation and a clean package.

files: GitHub workflows, documentation checker, package smoke test, Clean Code evidence.

approach: test currently supported Node versions, pin GitHub Actions to reviewed
revisions, keep dependency review on pull requests, and bind package and protocol smoke
tests to the final revision.

verification: `npm run verify`, `npm run smoke:package`, `npm audit`, mutation probes,
Clean Code trace, verification, review, and audit receipt.

## implementation unit 4: GitHub delivery

goal: leave the public default branch at the exact verified revision and confirm its
automation.

files: Git history and GitHub repository settings.

approach: commit the bounded changes, create `shashank-sn/positioning-bridge` as a
public repository, push `main`, enable Discussions and private vulnerability reporting,
then watch all triggered checks.

verification: remote default-branch SHA equals the local commit, the public README is
read back from GitHub, CI is green, repository visibility is public, and the local
worktree is clean.

## verification contract

| requirement | hard gate                                       | review signal                   | human boundary                          |
| ----------- | ----------------------------------------------- | ------------------------------- | --------------------------------------- |
| PB-013      | applicability behavior tests and CLI/MCP parity | explanation clarity review      | writer reviews a real pack later        |
| PB-070      | full Markdown and OSS-file checks               | README and governance review    | maintainer owns future community policy |
| PB-071      | live GitHub workflow run                        | least-privilege workflow review | no manual result is inferred            |
| PB-072      | current Node matrix and exact tarball smoke     | package metadata review         | npm publication remains separate        |
| PB-073      | README commands run from a clean clone          | newcomer setup review           | preferred-host check remains open       |

## definition of done

- no blocking product, documentation, security, package, or release finding remains;
- README commands work from a clean clone at the public URL;
- all deterministic checks and the exact tarball smoke pass at the shipped revision;
- the public GitHub `main` SHA equals the verified local SHA;
- GitHub CI is green and the public README renders from `main`;
- unperformed real-world spot checks stay explicit in the final audit receipt.
