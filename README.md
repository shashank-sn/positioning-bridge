# Positioning Bridge

Positioning Bridge checks whether a draft carries the right company messages for its
actual audience, channel, funnel stage, locale, and campaign.

the company keeps one versioned positioning pack. writers use the same policy through a
CLI, MCP host, or TypeScript library. every finding points to the exact pillar, claim,
rule, campaign, and source that caused it.

Positioning Bridge complements [Hold Your Voice](docs/hyv-integration.md). it checks
message policy and evidence. HYV checks voice and linguistic patterns. neither result is
proof that a claim is true or that a human should publish the draft.

## what it catches

- required positioning messages missing from a specific content context;
- explicit contradictions against approved company policy;
- prohibited or still-unapproved claims;
- competitive comparisons without an active approved claim;
- expired, draft, or deprecated proof;
- required disclosures and campaign-specific drift;
- optional places where a message can become stronger without bloating the draft.

there is no composite brand score. a result is `pass`, `needs_revision`, or `blocked`,
with typed findings underneath it.

## quick start

requirements: Node.js 20 or newer and npm.

```bash
npm install
npm run build
node dist/cli/main.js validate --pack examples/acme/positioning.yaml
```

check the passing example:

```bash
node dist/cli/main.js check \
  --pack examples/acme/positioning.yaml \
  --content examples/acme/drafts/pass.md \
  --audience platform-leader \
  --channel landing-page \
  --funnel-stage consideration \
  --campaign campaign.launch
```

the command exits `0` for `pass`, `1` for `needs_revision` or `blocked`, and `2` for a
usage or configuration error. use `--json` for automation.

create a company starter pack without overwriting an existing file:

```bash
node dist/cli/main.js init --output company-positioning.yaml
```

## connect an MCP host

build the package, then give the host an absolute pack path:

```json
{
  "mcpServers": {
    "positioning-bridge": {
      "command": "node",
      "args": [
        "/absolute/path/to/positioning-bridge/dist/cli/main.js",
        "serve",
        "--pack",
        "/absolute/path/to/company-positioning.yaml"
      ]
    }
  }
}
```

the server loads one pack at startup and exposes four read-only tools:

- `get_positioning_context`
- `create_content_brief`
- `check_content`
- `explain_positioning_item`

restart the MCP process after changing the pack. see [the MCP guide](docs/mcp.md) for
tool contracts and current host setup notes.

## pack model

a pack contains context catalogs, source records, pillars, claims, competitors,
campaigns, and deterministic rules. IDs are stable and references are checked before the
server starts.

the complete reference lives in [docs/positioning-pack.md](docs/positioning-pack.md).
editors can use the generated [JSON Schema](schemas/positioning-pack.schema.json). the
[fictional Acme pack](examples/acme/positioning.yaml) exercises every first-release
concept.

## certainty boundary

confirmed contradictions come from explicit pack rules. an optional `SemanticReviewer`
adapter can find paraphrases and contextual conflicts, but those findings stay labeled
`model_assisted` and cannot block by themselves.

the repository ships the semantic adapter interface, not a remote model provider.
default runtime behavior performs no network request and stores no submitted draft. if
no adapter is configured, every result says semantic review was `not_run`.

## library use

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

MCP construction is available from `positioning-bridge/mcp`.

## repository map

- `src/domain`: pure policy and decision logic;
- `src/application`: use cases and the semantic-review port;
- `src/config`: YAML/JSON loading and validation;
- `src/mcp`: MCP v2 tools and stdio serving;
- `src/cli`: commands, rendering, and process composition;
- `docs/research`: dated market and standards research;
- `docs/plans`: requirements and implementation contract.

the dependency direction is executable in
[`config/architecture.policy.json`](config/architecture.policy.json).

## development

```bash
npm ci
npm run verify
npm run smoke:package
```

`npm run verify` runs formatting, linting, strict type checks, coverage, schema drift,
the import-graph architecture policy, documentation links, and a production build.
`npm run smoke:package` packs the current version, audits its file allowlist, installs
it with a clean temporary cache, and checks the installed binary, library export, and
MCP stdio handshake.

read [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md), and
[GOVERNANCE.md](GOVERNANCE.md) before opening a change.

## status

`0.1.0` is a complete local-first foundation. it does not include a hosted control
plane, web UI, remote model provider, CMS crawler, publication workflow, or performance
analytics. those boundaries are deliberate and recorded in
[ADR 0001](docs/adr/0001-domain-policy-core.md).

## license

[MIT](LICENSE)
