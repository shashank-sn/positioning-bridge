# Positioning Bridge

[![ci](https://github.com/shashank-sn/positioning-bridge/actions/workflows/ci.yml/badge.svg)](https://github.com/shashank-sn/positioning-bridge/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/positioning-bridge.svg)](https://www.npmjs.com/package/positioning-bridge)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Positioning Bridge checks whether a draft carries the right company messages for its
audience, channel, funnel stage, locale, and campaign.

a company keeps one versioned positioning pack. writers use the same policy through a
CLI, MCP host, or TypeScript library. every result names the exact pillar, claim, rule,
campaign, competitor, and source that caused it.

## what it checks

| company decision                                         | draft result                            |
| -------------------------------------------------------- | --------------------------------------- |
| required positioning pillar is absent                    | `missing_message`                       |
| draft conflicts with an explicit policy rule             | `contradiction`                         |
| claim is prohibited, unapproved, unqualified, or expired | `unsupported_claim` or `stale_evidence` |
| named competitor comparison has no registered claim      | `unsupported_claim`                     |
| disclosure is missing after its trigger                  | `required_disclosure`                   |
| draft breaks the active campaign narrative               | `campaign_drift`                        |
| optional message could make the position clearer         | `positioning_opportunity`               |

the decision is `pass`, `needs_revision`, or `blocked`. there is no composite brand
score. deterministic and model-assisted evidence stay labeled separately.

## install

requirements: Node.js 22 or newer and npm.

```bash
npm install --global positioning-bridge@0.1.0
positioning-bridge init --output company-positioning.yaml
positioning-bridge validate --pack company-positioning.yaml
```

the starter pack is deliberately fictional. replace it with company-approved policy
before using its results in a content workflow.

## run the source example

```bash
git clone https://github.com/shashank-sn/positioning-bridge.git
cd positioning-bridge
npm ci
npm run build
node dist/cli/main.js validate --pack examples/acme/positioning.yaml
```

check the passing fictional draft:

```bash
node dist/cli/main.js check \
  --pack examples/acme/positioning.yaml \
  --content examples/acme/drafts/pass.md \
  --audience platform-leader \
  --channel landing-page \
  --funnel-stage consideration \
  --campaign campaign.launch
```

check from stdin and keep the structured result:

```bash
printf '%s\n' 'Acme trains on customer content.' | node dist/cli/main.js check \
  --pack examples/acme/positioning.yaml \
  --stdin \
  --audience platform-leader \
  --channel landing-page \
  --funnel-stage consideration \
  --json
```

the command exits `0` for `pass`, `1` for `needs_revision` or `blocked`, and `2` for a
usage or configuration error. omitted locale uses the pack's `defaultLocale`.

create a starter pack without overwriting an existing file:

```bash
node dist/cli/main.js init --output company-positioning.yaml
```

the project is open source on GitHub under the MIT license. npm releases use exact
versions so a writer and an MCP host can run the same policy engine.

## connect an MCP host

after the global install, give the host the absolute pack path:

```json
{
  "mcpServers": {
    "positioning-bridge": {
      "command": "positioning-bridge",
      "args": ["serve", "--pack", "/absolute/path/to/company-positioning.yaml"]
    }
  }
}
```

the server loads one pack at startup and exposes four read-only tools:

- `get_positioning_context` returns applicable policy plus structured reasons;
- `create_content_brief` returns required, approved, prohibited, and disclosure policy;
- `check_content` returns the decision, coverage, capabilities, and typed findings;
- `explain_positioning_item` accepts a policy or emitted finding ID plus context.

restart the process after changing the pack. the [MCP guide](docs/mcp.md) contains the
tool inputs, outputs, Codex command, and writer sequence.

## positioning pack

a pack contains:

- context catalogs for audiences, channels, funnel stages, and locales;
- evidence sources with approval, visibility, verification, and expiry state;
- pillars and approved, review-required, or prohibited claims;
- named competitors and enforcement for unregistered comparisons;
- campaign narratives, desired actions, required messages, and exclusions;
- deterministic contradiction, disclosure, language, and campaign rules.

IDs are stable and every reference is validated before the server starts. see the
[pack reference](docs/positioning-pack.md), generated
[JSON Schema](schemas/positioning-pack.schema.json), and complete fictional
[Acme pack](examples/acme/positioning.yaml).

## certainty and safety boundary

confirmed contradictions come from explicit deterministic rules. an optional
`SemanticReviewer` can report paraphrases and contextual conflicts. those findings stay
`model_assisted`, default to human review, and cannot block by themselves.

default runtime behavior:

- makes no network request;
- stores no submitted draft;
- loads only the configured pack path;
- caps pack and content size;
- exposes no policy mutation or publishing tool.

Positioning Bridge checks supplied policy and supplied evidence state. it does not prove
an external fact, legal approval, customer permission, or source authenticity.

## use with Hold Your Voice

Positioning Bridge and [Hold Your Voice](docs/hyv-integration.md) remain separate gates.
Positioning Bridge checks message policy and evidence. HYV checks voice and linguistic
patterns. neither package imports the other, and neither result is publication approval.

## TypeScript library

```bash
npm install positioning-bridge@0.1.0
```

```ts
import { PositioningService, loadPack } from "positioning-bridge";

const pack = await loadPack("./company-positioning.yaml");
const service = new PositioningService(pack);
const result = await service.checkContent({
  content: "draft text",
  context: {
    audienceId: "primary-buyer",
    channelId: "website",
    funnelStageId: "consideration",
    localeId: "en",
  },
});
```

MCP construction is exported from `positioning-bridge/mcp`. the JSON Schema is exported
from `positioning-bridge/schema`.

## development and verification

```bash
npm ci
npm run verify
npm run smoke:package
```

`npm run verify` checks formatting, linting, strict types, tests and coverage, schema
drift, architecture direction, documentation links, production build, and a live stdio
handshake. `npm run smoke:package` packs the exact version, checks its allowlist and
Markdown links, installs it in a clean temporary project, then checks its binary,
library export, example validation, and MCP handshake.

the component boundaries live in [architecture.md](docs/architecture.md) and the
executable [architecture policy](config/architecture.policy.json). release operations
live in [operations.md](docs/operations.md).

## project status

`0.1.0` is the local-first foundation. it does not include a hosted control plane, web
UI, remote model provider, CMS crawler, content-publication workflow, or performance
analytics. those boundaries are recorded in
[ADR 0001](docs/adr/0001-domain-policy-core.md).

read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a change. use
[GitHub Issues](https://github.com/shashank-sn/positioning-bridge/issues) for
reproducible bugs and bounded feature requests. use
[GitHub Discussions](https://github.com/shashank-sn/positioning-bridge/discussions) for
setup and design questions. report vulnerabilities through the private route in
[SECURITY.md](SECURITY.md).

MIT licensed. see [LICENSE](LICENSE).
