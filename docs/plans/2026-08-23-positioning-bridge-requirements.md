---
title: Positioning Bridge requirements
status: requirements-only
date: 2026-08-23
owner: project maintainers
---

# Positioning Bridge requirements

## goal capsule

companies should be able to encode positioning decisions once and give every writer the
same evidence-backed review inside their existing AI or editor workflow.

Positioning Bridge accepts a company positioning pack, a draft, and content context. it
reports contradictions, missing required messages, unsupported competitive claims, stale
evidence, and bounded opportunities to strengthen the message. it complements HYV
without depending on it.

## scope classification

deep. this is a new domain model, policy engine, CLI, MCP server, public package
contract, documentation set, and open-source repository.

## actors

### positioning owner

usually product marketing, brand, or a founder. they maintain the pack, evidence,
campaign narratives, and enforcement levels.

### content writer

uses an MCP host or CLI while drafting. they need specific findings without losing their
argument, voice, or format.

### reviewer

decides whether model-assisted findings and exceptions are acceptable before
publication.

### workflow maintainer

connects the server to an editor, agent, CI job, or HYV workflow and needs stable
machine-readable output.

## product contract

### source of truth

PB-001. the repository-owned positioning pack is the only policy source evaluated by the
core engine.

PB-002. every pillar, approved claim, competitive differentiator, and campaign message
must have a stable ID.

PB-003. every externally checkable claim must point to at least one source record.
sources expose verification state and optional expiry.

PB-004. pack validation must reject duplicate IDs, missing references, invalid
selectors, invalid enforcement levels, and approved claims without evidence.

### contextual requirements

PB-010. callers provide content plus an explicit context containing audience, channel,
funnel stage, campaign, and locale where applicable.

PB-011. rules and messages can select any combination of those context fields.

PB-012. a message can be `must`, `should`, or `opportunity`. absence of an opportunity
must never fail a check.

PB-013. the engine must report which rules were applicable and why.

### findings and decisions

PB-020. a check returns `pass`, `needs_revision`, or `blocked`; no composite positioning
score is returned.

PB-021. findings are typed as contradiction, missing message, unsupported claim, stale
evidence, required disclosure, prohibited language, campaign drift, or positioning
opportunity.

PB-022. every finding contains a stable rule or message ID, severity, certainty,
rationale, evidence references, and a location when draft text triggered it.

PB-023. suggestions describe the message to add or repair. they must not replace the
whole draft or invent proof.

PB-024. results are deterministic and stably sorted for the same pack, context, and
content when semantic review is disabled.

### certainty and degraded modes

PB-030. deterministic and model-assisted findings are labeled separately.

PB-031. semantic review is optional. when unavailable or disabled, the result must say
`not_run` and name which checks were not performed.

PB-032. model-assisted findings default to human review and cannot silently become
confirmed deterministic failures.

PB-033. only explicit deterministic pack rules may create a confirmed contradiction.

### competitive and campaign policy

PB-040. a comparative or superiority claim requires an approved claim record, named
alternative when relevant, qualifiers, evidence, and an unexpired status.

PB-041. prohibited competitor claims must be detectable with exact signals and produce a
blocking finding when configured to block.

PB-042. campaigns can declare a narrative, audience, desired action, required messages,
optional messages, prohibited messages, and proof references.

PB-043. campaign rules inherit company policy and may narrow it. they may not silently
approve a company-level prohibited claim.

### interfaces

PB-050. the core library must not depend on MCP, a model provider, a network transport,
or HYV.

PB-051. the CLI must support pack initialization, validation, draft checking, and MCP
stdio serving.

PB-052. MCP tools must expose structured input and output schemas and use read-only,
closed-world annotations.

PB-053. MCP must expose: applicable positioning context, content checking, finding
explanation, and a pre-draft content brief.

PB-054. the check command and MCP check tool must use the same application service and
return the same domain result.

PB-055. process diagnostics go to stderr so stdio protocol output remains clean.

### privacy and safety

PB-060. default execution performs no network requests and stores no submitted draft.

PB-061. the pack path is explicit. the server must not discover or read arbitrary
company files beyond that configured path.

PB-062. content and pack size limits must fail with actionable errors.

PB-063. untrusted text inside the draft or source descriptions is data, never executable
instruction.

PB-064. the first release exposes no tool that mutates policy or publishes content.

### open-source repository

PB-070. the repository includes a clear README, MIT license, contribution guide, code of
conduct, security policy, support policy, changelog, architecture record, examples, and
release notes template.

PB-071. CI runs formatting, linting, type checks, unit tests, integration tests, package
checks, and dependency review where supported.

PB-072. the package declares supported Node.js versions, uses reproducible dependency
locking, and contains only expected release files.

PB-073. documentation contains a complete quick start for a local MCP host and a
CLI-only workflow.

## acceptance examples

### A1: required message is absent

given a campaign that requires `pillar.security-control`, when a draft contains no
configured signal for that pillar, the result is `needs_revision` with a missing-message
finding, the pillar ID, its approved message, evidence references, and no invented copy.

### A2: optional message is absent

given an applicable opportunity message, when it is absent, the result contains a
suggestion but does not change a passing decision.

### A3: explicit contradiction

given a policy that prohibits saying the product trains on customer data, when the draft
contains a configured matching assertion, the result is `blocked`, certainty is
`confirmed`, and the exact text span is returned.

### A4: unsupported superiority claim

given a draft that says the product is faster than a named competitor, when no active
approved comparison supports it, the result is `blocked` or `needs_revision` according
to the configured enforcement level and identifies the missing claim policy.

### A5: expired proof

given an otherwise approved claim whose only evidence has expired, when that claim is
used, the result names the stale evidence and does not label the claim supported.

### A6: context changes applicability

given the same draft checked once as a product page and once as a support article, only
rules whose selectors match each context apply. both outputs list the resolved rules.

### A7: semantic review unavailable

given no semantic adapter, a check still runs all deterministic checks and reports
semantic status `not_run`. it never claims that semantic contradictions passed.

### A8: CLI and MCP parity

given the same pack, draft, and context, CLI JSON and MCP structured content contain the
same domain decision and findings.

### A9: invalid pack

given a claim with a missing evidence reference, both CLI validation and server startup
fail with a path-specific validation error.

### A10: HYV composition

given a content workflow that runs Positioning Bridge and then HYV, neither package
imports the other. the documentation explains that message policy and voice checks are
independent gates.

## explicit non-goals

- generating full articles, posts, or campaigns;
- deciding whether positioning strategy is commercially correct;
- proving external facts beyond the supplied evidence state;
- crawling company drives, websites, or CMS instances;
- measuring campaign performance or revenue attribution;
- managing visual identity, grammar, or author voice;
- automatic publication, approval, or policy mutation;
- a hosted multi-tenant control plane in the first release;
- a universal brand or content quality score.

## human spot checks

1. a product marketer reviews whether the example pack matches how messaging decisions
   are actually maintained.
2. a writer reviews whether findings are specific without turning the draft into a
   message checklist.
3. an OSS maintainer reviews setup, contribution, security, and release documentation.
4. a user runs one MCP check in their preferred host after local repository delivery.

## approach options

### option A: generic document retrieval

store messaging documents and return relevant chunks. quickest, but it cannot provide
deterministic applicability, enforcement, or pass semantics.

### option B: domain-specific positioning policy engine

define a small schema and evaluation engine, then expose it through CLI and MCP. this is
the recommended approach because the company can inspect, diff, test, and version every
decision.

### option C: hosted AI reviewer

send every draft and a long strategy prompt to a managed model. strongest demo recall,
but it creates privacy, cost, provider, and reliability dependencies before the domain
contract is stable.

## recommendation

build option B. add a narrow semantic-provider port so model-assisted review can be
introduced without changing the core result types or allowing it to impersonate
deterministic evidence.

## outstanding questions

none block the first release. the initial defaults are one pack per server process, YAML
as the human format with JSON support, English signals, local stdio transport, and
optional semantic review behind an interface.
