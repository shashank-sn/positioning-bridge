# security policy

## supported versions

security fixes are made on the latest released minor version. before a public release,
the current `main` branch is the only supported revision.

## report a vulnerability

do not open a public issue.

once a GitHub remote exists, maintainers must enable private vulnerability reporting and
publish that URL here before the first public release. until then, report through the
same private channel that supplied this repository. include the affected version,
impact, reproduction, and any suggested mitigation. do not include real company
positioning or draft content unless it is required and approved for disclosure.

maintainers should acknowledge a complete report within five business days, confirm
severity and scope, prepare a fix and advisory, and credit the reporter unless they ask
to remain anonymous.

## security boundaries

- default runtime behavior is local-only and makes no network request;
- MCP tools are read-only and cannot choose a pack path;
- the server stores no draft content;
- pack and draft sizes are capped;
- signals are literals instead of executable regular expressions;
- structured pack references are validated before startup;
- remote transports and model providers need separate threat review.

Positioning Bridge checks supplied policy. it does not prove an external fact, legal
claim, customer permission, or source authenticity.
