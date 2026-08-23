# ADR 0001: use a domain-specific positioning policy core

status: accepted

date: 2026-08-23

## context

the product needs inspectable messaging decisions inside different writing tools.
generic retrieval can surface relevant context but cannot prove applicability or
distinguish missing retrieval from a pass. a single model prompt can catch paraphrases
but produces unstable judgments and creates a provider and privacy dependency.

## decision

use a domain-specific, versioned positioning pack and a pure evaluation core.

the core owns contextual selectors, message requirements, evidence state, explicit
contradiction signals, comparison policy, findings, and decisions. MCP and CLI are
delivery adapters. optional semantic review enters through an application port and
remains visibly model-assisted.

## consequences

- pack authors must structure positioning decisions instead of uploading arbitrary
  strategy documents;
- deterministic behavior is testable, diffable, and available offline;
- nuanced paraphrase detection is limited until a semantic adapter is configured;
- provider choices can change without changing the pack or domain result;
- HYV can remain a separate downstream voice gate.

## rejected alternatives

- a vector database over unstructured brand documents;
- Rego or another general-purpose policy language as the authoring surface;
- a hosted model as the only evaluator;
- embedding Positioning Bridge inside HYV.
