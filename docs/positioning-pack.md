# positioning pack reference

a positioning pack is the repository-owned source of truth evaluated by Positioning
Bridge. YAML is the normal authoring format. JSON uses the same fields.

start with [the fictional Acme pack](../examples/acme/positioning.yaml) or run:

```bash
positioning-bridge init --output company-positioning.yaml
```

## metadata

| field           | meaning                                  |
| --------------- | ---------------------------------------- |
| `schemaVersion` | must be `"1"`                            |
| `id`            | stable lowercase pack ID                 |
| `name`          | display name                             |
| `version`       | company-owned policy revision            |
| `defaultLocale` | one ID declared under `contexts.locales` |
| `description`   | optional scope note                      |

changing `version` is a company governance decision. the engine reports the exact
version used for every check.

## context catalogs

`contexts` declares valid audiences, channels, funnel stages, and locales. a check must
name one ID from each catalog. a campaign is optional.

```yaml
contexts:
  audiences:
    - id: security-leader
      name: Security leader
  channels:
    - id: landing-page
      name: Landing page
  funnelStages:
    - id: consideration
      name: Consideration
  locales:
    - id: en
      name: English
```

selectors use `audienceIds`, `channelIds`, `funnelStageIds`, `campaignIds`, and
`localeIds`. all present fields must match. omitted fields match every value in that
dimension.

## sources

sources preserve provenance separately from the message that cites them.

```yaml
sources:
  - id: source.security-page
    label: Public security page
    status: approved
    visibility: public
    uri: https://example.com/security
    verifiedAt: 2026-08-01
    expiresAt: 2027-02-01
```

`status` is `approved`, `draft`, or `deprecated`. `visibility` is `public` or
`internal`. an active source is approved and not past `expiresAt`. the engine does not
fetch `uri` or prove the source is true. the positioning owner approves that state.

## pillars

a pillar connects one thesis to customer value. `signals` are literal phrases the
deterministic engine can recognize across case and whitespace changes.

```yaml
pillars:
  - id: pillar.control
    name: Company control
    thesis: Positioning policy stays under company control.
    value: Writers use current decisions without searching old decks.
    signals:
      - policy stays under company control
      - current positioning policy
    sourceIds:
      - source.positioning
    requirement:
      level: must
      selectors:
        channelIds:
          - landing-page
```

requirement levels behave differently:

- `must`: absence produces a warning and `needs_revision`;
- `should`: absence produces a suggestion without failing the draft;
- `opportunity`: absence produces a positioning opportunity without failing the draft.

the tool does not reward adding every pillar. only applicable requirements are checked.

## claims

claims carry status, enforcement, evidence, and optional competitive context.

```yaml
claims:
  - id: claim.no-training
    name: No training on customer content
    statement: The product does not train on submitted customer content.
    kind: fact
    status: approved
    enforcement: warn
    signals:
      - does not train on submitted customer content
    sourceIds:
      - source.security-page
    qualifiers:
      - statement: Applies to the standard hosted product.
        signals:
          - standard hosted product
```

`kind` is `fact`, `comparison`, `superlative`, `customer`, or `roadmap`. `status` is
`approved`, `review_required`, or `prohibited`. `enforcement` is `block`, `warn`, or
`suggest`.

comparison claims need `competitorId`. expiry can be set on the claim and its sources.
each qualifier is an approved statement plus literal signals that must appear whenever
the claim appears. using an approved claim without its qualifier produces an
unsupported-claim finding at the claim's configured enforcement. using an approved claim
with no active approved evidence produces a stale-evidence finding.

briefs recommend only messages with active approved support. if a required pillar or
claim is expired or all of its sources are inactive, the brief omits it and the content
check returns `stale_evidence` instead of telling the writer to add it. an absent
`should` or `opportunity` message remains suggestive even when the claim's use
enforcement is stricter.

## competitors

competitors model the customer's alternative, including non-product alternatives such as
spreadsheets or an internal workflow.

```yaml
competitors:
  - id: competitor.manual-process
    name: Manual review
    category: Internal process
    aliases:
      - manual review
      - review spreadsheet
    unapprovedComparisonEnforcement: block
    sourceIds:
      - source.competitive-review
```

approved differentiation lives in claims with `kind: comparison` and the matching
`competitorId`. that keeps the wording, proof, qualifier, status, and expiry in one
place. `unapprovedComparisonEnforcement` controls the result when bounded comparison
language such as `than <alias>`, `versus <alias>`, or `compared with <alias>` does not
overlap a configured claim signal.

## campaigns

a campaign narrows the company policy for one bounded narrative.

```yaml
campaigns:
  - id: campaign.launch
    name: Policy launch
    narrative: Move positioning from static decks into the writing decision.
    desiredAction: Run a draft through the local check.
    audienceIds: [platform-leader]
    channelIds: [landing-page]
    funnelStageIds: [consideration]
    localeIds: [en]
    sourceIds: [source.positioning]
    mustInclude:
      - kind: pillar
        id: pillar.control
    shouldInclude: []
    opportunities: []
    prohibited:
      - kind: claim
        id: claim.unapproved-comparison
        enforcement: block
```

campaign requirements can strengthen a general requirement. they cannot weaken a company
prohibition. `mustInclude`, `shouldInclude`, and `opportunities` may reference only
approved claims; a campaign cannot promote a review-required or prohibited claim.
`prohibited` entries make an existing pillar or claim invalid only inside that campaign.
they also suppress any company-level carry requirement for that message while the
campaign is active. each entry chooses `block`, `warn`, or `suggest`, and appears in the
pre-draft brief before it can reach a content check.

## deterministic rules

rules encode assertions the company is willing to enforce exactly.

```yaml
rules:
  - id: rule.training-contradiction
    name: Customer-content training contradiction
    type: contradiction
    description: Approved policy says submitted content is not used for training.
    enforcement: block
    triggerSignals:
      - trains on customer content
    sourceIds:
      - source.security-page
    suggestion: Use the approved no-training claim with its qualifier.
```

rule types:

- `contradiction`: explicit conflict with a positioning decision;
- `prohibited_language`: wording or a claim the company has prohibited;
- `required_disclosure`: one trigger requires at least one `requiredSignals` match;
- `campaign_drift`: explicit language that breaks an applicable campaign narrative.

signals are literals, not regular expressions. this keeps policy readable and avoids
unsafe pattern execution. nuanced paraphrases belong to an optional semantic adapter and
remain model-assisted.

## validation

validation rejects malformed data, duplicate IDs, reused policy IDs, unknown source and
context references, missing comparison competitors, invalid campaign references, and
invalid disclosure rules.

```bash
positioning-bridge validate --pack company-positioning.yaml
```

the machine contract is
[the generated JSON Schema](../schemas/positioning-pack.schema.json).
