# governance

## bootstrap model

the project starts with a maintainer-led model. maintainers merge changes, cut releases,
handle security reports, and protect the product boundaries in
[the requirements](docs/plans/2026-08-23-positioning-bridge-requirements.md).

## decisions

- bug fixes follow the existing requirements and tests;
- public schema, certainty, privacy, transport, and dependency-direction changes need an
  architecture decision under `docs/adr/`;
- positioning strategy remains company-owned data, not project policy;
- a model output cannot approve its own elevation from review evidence to deterministic
  enforcement.

## becoming a maintainer

maintainers may invite a contributor after sustained, high-quality work across code,
tests, documentation, review, and community conduct. access follows least privilege and
can be removed for inactivity, security risk, or conduct violations.

## conflicts

a maintainer with a personal or commercial conflict must disclose it and avoid being the
sole reviewer. security reports and conduct reports should be handled by someone who is
not the subject of the report.

this file must name remote repository owners and release administrators before the first
public release. the local project does not invent those identities.
