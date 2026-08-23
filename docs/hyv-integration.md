# HYV integration

Positioning Bridge and HYV solve separate failures.

| gate               | owns                                                                  | does not prove                        |
| ------------------ | --------------------------------------------------------------------- | ------------------------------------- |
| source approval    | facts, proof, permission, expiry                                      | positioning coverage or voice         |
| Positioning Bridge | message coverage, explicit contradictions, claim status, campaign fit | factual truth or writer voice         |
| HYV                | voice profile and linguistic pattern checks                           | claim support or positioning strategy |
| human approval     | publication judgment and exceptions                                   | future source validity                |

## recommended order

1. retrieve approved facts and proof.
2. create a context-specific Positioning Bridge brief.
3. draft the content.
4. run Positioning Bridge and repair message-policy findings.
5. run HYV on the repaired draft.
6. re-run source, legal, and human approval checks after the final edit.

do not let a HYV pass override a positioning contradiction. do not let a Positioning
Bridge pass claim the draft matches a person's voice. both tools are diagnostics inside
a larger approval workflow.

## local workflow example

```bash
positioning-bridge check \
  --pack company-positioning.yaml \
  --content draft.md \
  --audience primary-buyer \
  --channel website \
  --funnel-stage consideration

hyv final-check draft.md
```

the packages do not import each other. an agent or workflow composes their CLI or MCP
surfaces and keeps the results separate.
