# security policy

## supported versions

security fixes are made on the latest version published to npm. repository-only changes
are unsupported until they are included in a release.

## report a vulnerability

do not open a public issue.

use
[GitHub private vulnerability reporting](https://github.com/shashank-sn/positioning-bridge/security/advisories/new).
the report is visible to the repository maintainer and security collaborators, not the
public issue tracker. include the affected version, impact, reproduction, and any
suggested mitigation. do not include real company positioning or draft content unless it
is required and approved for disclosure.

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
