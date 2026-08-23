---
title: Keep public documentation valid inside the npm tarball
category: release-engineering
tags:
  - npm
  - documentation
  - release-integrity
date: 2026-08-23
---

# Keep public documentation valid inside the npm tarball

## Problem

The repository README and OSS documents linked to local files that were absent from the
npm tarball. The links worked in a clone and failed after installation. The package
smoke test checked executable behavior but did not inspect packaged Markdown links.

## Root cause

The release allowlist and documentation checker described different public surfaces.
`package.json#files` excluded some linked documents, while the docs check ran only
against the repository tree.

## Fix

- include every public document and example referenced by packaged Markdown;
- derive the expected manifest version from `package.json` instead of embedding a second
  version string;
- extract only after the tarball allowlist is validated and reject symlinks;
- run the local-link checker again against the extracted tarball;
- complete a clean install, CLI check, library import, and MCP handshake from that same
  artifact.

## Verification

Run:

```bash
npm run docs:check
npm run smoke:package
```

The smoke test must report the expected file count and pass every artifact-level check.
A repository-only documentation pass is insufficient release evidence.

## Related files

- `scripts/check-docs.mjs`
- `scripts/smoke-package.mjs`
- [`../../package.json`](../../package.json)
