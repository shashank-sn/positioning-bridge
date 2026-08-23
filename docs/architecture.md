# architecture

## system boundary

Positioning Bridge turns repository-owned positioning policy into a content decision.
the stable business rules do not know about MCP, command-line parsing, files, YAML,
model vendors, or HYV.

```text
positioning pack file
        |
        v
   config loader ------> validated PositioningPack
                                |
draft + content context --------+----> PositioningService ----> ContentDecision
                                          |
                                          +----> optional SemanticReviewer port
                                          |
                              +-----------+-----------+
                              |                       |
                             CLI                     MCP
```

## use cases

### validate a positioning pack

actor: positioning owner or CI.

outcome: receive all structural and cross-reference errors with stable paths before any
writer uses the pack.

failure behavior: startup and checks fail closed on an invalid pack.

### prepare a content brief

actor: writer or writing agent.

outcome: see only the pillars, claims, campaign messages, alternatives, and proof that
apply to the intended content context.

failure behavior: unknown context IDs are reported instead of falling back to global
policy.

### check a draft

actor: writer, reviewer, CLI job, or MCP host.

outcome: receive a typed decision and exact findings without a full-draft rewrite.

failure behavior: deterministic checks still run when semantic review is unavailable,
and the missing capability remains visible.

### explain a finding

actor: writer or reviewer.

outcome: resolve a finding ID to the policy item, source records, applicability, and
bounded repair guidance used to create it.

failure behavior: an unknown finding or policy ID returns a typed error.

## stable business rules

- applicability is the intersection of content context and rule selectors;
- campaign policy can narrow company policy but cannot approve a prohibited company
  claim;
- `must`, `should`, and `opportunity` have different decision effects;
- confirmed contradictions require an explicit deterministic rule match;
- comparison claims require active approved evidence;
- expired or unverified evidence cannot support an approved claim;
- one result never collapses deterministic and model-assisted evidence;
- absence of a semantic adapter is a declared degraded mode;
- no core operation stores drafts, mutates policy, or publishes content.

## components

### domain: `src/domain/**`

owns the positioning pack types, context resolution, text locations, rules, evaluation,
findings, and decision derivation. it has no runtime dependency on delivery or file
formats.

public surface: `src/domain/index.ts`.

### application: `src/application/**`

owns use-case services for validation results, brief preparation, content checking, and
finding explanation. it defines the optional semantic-review port and merges valid
model-assisted findings without upgrading their certainty.

depends on: domain.

public surface: `src/application/index.ts`.

### config: `src/config/**`

owns YAML/JSON parsing, schema validation, file-size limits, repository-relative
loading, and readable validation errors. no business decision belongs here.

depends on: domain.

public surface: `src/config/index.ts`.

### MCP: `src/mcp/**`

owns MCP schemas, tool registration, compatible text plus structured results, and stdio
server lifecycle. it receives an application service and does not open arbitrary files
from tool inputs.

depends on: application and domain.

public surface: `src/mcp/index.ts`.

### CLI: `src/cli/**`

owns argument parsing, file and stdin content input, human and JSON rendering, process
exit codes, and the composition root used by the executable.

depends on: application, config, domain, and MCP.

public surface: the package `bin` entry only.

### package API: `src/index.ts`

re-exports supported library surfaces from domain, application, and config. MCP
construction remains available from its documented subpath, while CLI internals are
never exported.

## dependency policy

permitted direction:

```text
domain <- application <- MCP
   ^          ^          ^
   |          |          |
 config ------+------- CLI
   ^                     |
   +---- package API <---+
```

the exact machine policy lives in `config/architecture.policy.json`. tests and generated
output are excluded from the production dependency graph. no exceptions are approved.

## data boundary

### input

- one configured pack path from CLI arguments or `POSITIONING_BRIDGE_PACK`;
- draft text from an explicit file, stdin, or MCP tool argument;
- content context using IDs declared in the pack;
- an optional semantic reviewer injected by the host application.

### output

- immutable domain results serializable as JSON;
- MCP structured content plus a JSON text fallback;
- human CLI output derived from the same result;
- diagnostics on stderr only during stdio serving.

the library does not persist content decisions in the first release.

## semantic review boundary

`SemanticReviewer` receives the draft, content context, and resolved positioning policy.
an adapter may return model-assisted candidate findings. the application layer validates
their type, text, policy reference, content span, confidence, and count before merging
them with the deterministic result.

the repository ships the port and contract tests, not a remote provider. this preserves
local-only default behavior and avoids selecting a company model or sending strategy
outside the process without explicit deployment work.

## MCP boundary

first-release tools:

- `get_positioning_context`: return applicable policy for a content context;
- `check_content`: return a complete content decision;
- `explain_positioning_item`: explain an emitted finding, rule, pillar, claim,
  competitor, campaign, or source;
- `create_content_brief`: return a compact pre-draft brief.

all tools are read-only and closed-world. the configured pack is loaded once at startup.
a changed pack requires a server restart in the first release so a check cannot span two
policy revisions.

## security boundaries

- reject packs and drafts above configured byte limits;
- do not interpret source text or draft text as instructions;
- cap signal count and length during pack loading;
- build match expressions during evaluation only from escaped literal signals plus fixed
  whitespace and word-boundary syntax;
- never accept a pack path through an MCP tool call;
- resolve CLI paths explicitly and report the selected path;
- make network access impossible in the default composition root;
- expose no mutating or publishing tools.

## mechanical evidence

`npm run architecture:graph` produces `build/dependency-graph.json` from resolved
TypeScript imports. `npm run architecture:check` runs Clean Code against the repository
policy.

the checker proves only that reported import edges follow the declared path policy. it
does not prove the graph producer is complete, the components have the right names, or
the product behavior is correct. those remain test and review concerns.
