# category research: positioning policy for content workflows

date: 2026-08-23

## decision

build Positioning Bridge as a local-first, open-source policy engine with an MCP
delivery surface. a company maintains a versioned positioning pack. writers send a draft
plus its intended audience, channel, funnel stage, and campaign. the engine returns
typed findings tied to exact policy entries and source records.

the product should not act like a generic brand score. it should distinguish:

- an explicit contradiction from a possible semantic conflict;
- a required message that is absent from an optional opportunity;
- an approved competitive claim from unsupported superiority language;
- a current source from stale, private, or unverified evidence;
- deterministic proof from model-assisted judgment.

## research method

the research used five lenses and an adversarial pass:

1. positioning frameworks and message architecture;
2. enterprise content-governance products;
3. open-source prose and policy engines;
4. the current MCP protocol and TypeScript SDK;
5. contradiction-detection reliability and model-judge failure modes;
6. direct competitors and substitutes that could make the project unnecessary.

product pages are evidence of advertised capability, not independent proof of product
quality. research and protocol claims use primary sources where available. source access
dates are recorded below.

## evidence by lens

### 1. positioning is relational and contextual

April Dunford's public introduction describes positioning through connected components
including competitive alternatives, market category, differentiated value, and target
customer segmentation. the useful implementation consequence is a graph of related
claims, audiences, alternatives, proof, and context selectors rather than a flat list of
preferred phrases.

source:
[April Dunford, an introduction to positioning](https://www.aprildunford.com/post/an-introduction-to-positioning)

### 2. current products centralize brand context but remain platform-bound

- Jasper IQ stores brand voice, knowledge, audiences, style guidance, visual standards,
  and product context. Jasper says its style guide can flag violations and suggest
  replacements.
- WRITER combines knowledge retrieval, company sources, brand governance, agents, and
  connectors. its Knowledge Graph product advertises source citations and
  competitive-differentiation use cases.
- Grammarly provides brand tones, style rules, snippets, and knowledge surfaced while
  employees write.
- Frontify provides a brand source of truth, structured guidelines, assets, templates,
  and a conversational brand assistant.
- Acrolinx advertises terminology, tone, messaging, and guideline enforcement inside
  authoring workflows.

these products validate demand for in-workflow guidance. the reviewed public material
does not expose an open, repository-owned positioning policy format with MCP-native
checks, rule-level evidence, deterministic degraded mode, and provider-neutral
execution.

sources:

- [Jasper IQ help](https://help.jasper.ai/hc/en-us/articles/18618654325787-Jasper-IQ)
- [Jasper Brand IQ](https://www.jasper.ai/brand-iq)
- [WRITER Knowledge Graph](https://writer.com/product/graph-based-rag/)
- [WRITER Knowledge Graph management](https://support.writer.com/articles/6965386512-how-to-create-and-manage-a-knowledge-graph)
- [Grammarly Business resources](https://www.grammarly.com/business/resources)
- [Frontify product overview](https://www.frontify.com/en/product-overview)
- [Acrolinx introductory brochure](https://www.acrolinx.com/wp-content/uploads/2024/07/meet-acrolinx-introductory-brochure.pdf)

### 3. open-source analogues prove useful mechanics, not this product contract

Vale demonstrates that prose rules can be declarative, version-controlled,
location-aware, and CI-friendly. its conditional rules also show the value of explicit
antecedent-consequent checks.

Open Policy Agent separates policy decisions from enforcement and accepts structured
data as input. its bundle model shows why positioning policy should be versioned
independently from every consuming editor or agent.

Positioning Bridge should borrow the policy mechanics without importing a general policy
language. marketers need named pillars, claims, proof, campaigns, alternatives, and
readable selectors. requiring Rego or another generic language would move the burden to
specialists and weaken the domain model.

sources:

- [Vale introduction](https://errata-ai-vale.mintlify.app/introduction)
- [Vale conditional rules](https://errata-ai-vale.mintlify.app/reference/rules/conditional)
- [Open Policy Agent overview](https://www.openpolicyagent.org/docs)
- [Open Policy Agent bundles](https://www.openpolicyagent.org/docs/management-bundles)

### 4. MCP supports a clean delivery boundary

the stable TypeScript SDK v2 implements the 2026-07-28 protocol and replaces the older
monolithic package. MCP tools can declare input and output schemas and return structured
content. stdio is the right first transport for local writer tools. Streamable HTTP is a
later deployment surface with authentication, Origin validation, and localhost-binding
requirements.

the first release should expose read-only checks over stdio. it should return structured
results and the same JSON in a text block for compatibility. no tool should mutate the
positioning pack.

sources:

- [MCP TypeScript server package](https://www.npmjs.com/package/%40modelcontextprotocol/server)
- [MCP TypeScript server guide](https://github.com/modelcontextprotocol/typescript-sdk/blob/main/docs/server.md)
- [MCP SDK 2026-07-28 stdio support guide](https://ts.sdk.modelcontextprotocol.io/v2/migration/support-2026-07-28)
- [MCP tools specification](https://modelcontextprotocol.io/specification/2025-06-18/server/tools)
- [MCP Streamable HTTP specification](https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/specification/2026-07-28/basic/transports/streamable-http.mdx)

### 5. semantic contradiction detection needs an uncertainty boundary

ContraDoc reports that strong language models still struggle with nuanced,
context-dependent contradictions in long documents. separate work on model judges
documents position and task-dependent bias. a content-governance system cannot turn one
model label into mechanical proof.

the safe contract is:

- deterministic checks can report `confirmed` when an explicit repository rule matched;
- optional semantic adapters report `model_assisted` with confidence, policy evidence,
  and the exact draft span;
- missing semantic capability is visible as `not_run`, never presented as a passed
  semantic check;
- model-assisted findings default to review unless a person or an explicit deterministic
  rule confirms them.

sources:

- [ContraDoc, NAACL 2024](https://aclanthology.org/2024.naacl-long.362/)
- [Judging the Judges](https://arxiv.org/abs/2406.07791)

### 6. direct substitutes reveal the product wedge

Stride describes context governance for conflicting ICP, messaging, and positioning
documents. the important distinction is where the decision happens. Positioning Bridge
is aimed at the draft-review boundary: a small, inspectable pack is evaluated in any MCP
host, CLI, or CI job before publication.

source: [Stride](https://www.usestride.ai/)

## contradiction map

| tension                                                                                             | evidence                                                                                              | design response                                                                                          |
| --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| central rules improve consistency, but universal messages make content generic                      | enterprise products support shared brand context; positioning varies by audience and buying situation | every requirement can be scoped by audience, channel, funnel stage, campaign, and locale                 |
| semantic models catch paraphrases, but contradiction labels remain unreliable                       | ContraDoc and model-judge research show contextual and evaluation failures                            | keep deterministic and model-assisted evidence separate; model output does not silently block            |
| completeness is useful, but forcing every pillar into every asset produces bloated copy             | positioning components are connected, while individual content has a bounded job                      | declare `must`, `should`, and `opportunity` requirements per context; never maximize raw coverage        |
| one score is easy to report, but it hides why a draft failed                                        | style products market aggregate control and analytics                                                 | return typed findings and a decision; do not ship a composite brand score                                |
| exact phrases are reliable, but writers use natural paraphrases                                     | prose linters are deterministic but pattern-bound                                                     | support explicit signals in v1 and a provider interface for semantic review without changing core policy |
| remote models improve recall, but company positioning can be sensitive                              | enterprise products emphasize access controls and isolated knowledge                                  | local-only by default; external semantic review is opt-in and disclosed in every result                  |
| competitive contrast sharpens positioning, but unsupported superiority creates legal and trust risk | positioning is relative to alternatives; brand governance products include compliance controls        | competitor claims require an approved claim record, qualifiers, evidence, and optional expiry            |

## recommended product contract

### positioning pack

a YAML or JSON document containing:

- metadata and a schema version;
- named audiences, channels, funnel stages, and locales;
- source records with verification state and optional expiry;
- positioning pillars with a thesis, value, proof, signals, and context selectors;
- claims with status, qualifiers, evidence, and explicit prohibited variants;
- competitive alternatives and approved differentiators;
- campaign narratives with mandatory and optional message references;
- deterministic rules for contradictions, required disclosures, and prohibited language.

### content decision

one check returns:

- `pass`, `needs_revision`, or `blocked`;
- the pack identity and version used;
- the exact context evaluated;
- deterministic and semantic capability status;
- sorted findings with type, severity, certainty, location, evidence, and a bounded
  suggestion;
- coverage by required message ID;
- unresolved questions that need a human decision.

### product surfaces

1. a TypeScript library for pack loading, validation, context resolution, and
   evaluation;
2. a CLI for `init`, `validate`, `check`, and `serve`;
3. an MCP server exposing pack context, checks, finding explanations, and a draft brief;
4. repository examples, JSON Schema, tests, CI, security guidance, and OSS governance.

## rejected approaches

### generic RAG over a messaging document

retrieval can surface nearby text but cannot tell callers which rules are mandatory,
which evidence is approved, or whether a missing result means pass, bad retrieval, or
absent policy.

### a single LLM prompt and score

this is fast to demo and weak to govern. prompt text is hard to diff semantically,
findings are unstable, and a number hides uncertainty.

### a full hosted brand platform

that exceeds the requested bridge. the useful first boundary is a local engine and MCP
surface that can fit existing company workflows.

### embedding HYV

HYV owns voice and linguistic patterns. Positioning Bridge owns message policy and
evidence. integration should be composition in a workflow, not a package dependency.

## unknowns to validate after the first release

- which semantic provider contract gives the best cross-company portability;
- whether teams prefer one repository per company or multiple packs in one repository;
- which authoring hosts preserve MCP structured output well enough for inline
  suggestions;
- how often evidence expiry and ownership fields change real publishing decisions;
- whether campaign-level adoption reports are valuable without becoming a misleading
  score.

## source access record

all linked sources were accessed on 2026-08-23. current product and protocol behavior
can change. the repository should pin tested SDK versions and treat market comparisons
as dated research rather than permanent claims.
