# changelog

this project follows [Semantic Versioning](https://semver.org/).

## 0.1.0 - 2026-08-23

### added

- versioned YAML and JSON positioning packs with generated JSON Schema;
- contextual pillars, claims, competitors, campaigns, sources, and deterministic rules;
- campaign-owned prohibited messages with explicit enforcement and brief visibility;
- evidence-backed `pass`, `needs_revision`, and `blocked` decisions without a composite
  score;
- explicit degraded-mode and model-assisted certainty boundaries;
- CLI commands for initialization, validation, checking, and MCP serving;
- four read-only MCP v2 tools over stdio;
- architecture policy, tests, coverage, CI, docs, examples, and OSS governance.
- clean-install tarball allowlist, binary, library, and MCP handshake checks.
- stable applicability explanations for every resolved policy;
- qualifier-aware approved claims and configurable enforcement for unapproved competitor
  comparisons;
- campaign validation that prevents non-approved claims from entering carry
  requirements;
- support-aware briefs that never recommend expired or inactive pillars and claims;
- campaign narrowing that suppresses company carry requirements for prohibited messages;
- complete, tool-specific MCP output schemas and finding-ID explanations;
- public-repository metadata, reporting routes, supported Node.js CI lanes, and
  immutable GitHub Action references.
