# MCP guide

Positioning Bridge uses the stable MCP TypeScript SDK v2 and serves stdio. the server is
read-only, idempotent, and closed-world. tool calls cannot select another pack path or
write policy.

## start the server

```bash
npm run build
node /absolute/path/to/dist/cli/main.js serve \
  --pack /absolute/path/to/company-positioning.yaml
```

stdio protocol messages use stdout. diagnostics use stderr.

## host configuration

hosts that use the common JSON MCP configuration can start the process with:

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

use absolute paths. restart the process after changing the pack. host configuration
names change over time, so verify the current host documentation before editing a live
config.

the current Codex CLI can add the same stdio server directly:

```bash
codex mcp add positioning-bridge -- \
  node /absolute/path/to/positioning-bridge/dist/cli/main.js serve \
  --pack /absolute/path/to/company-positioning.yaml
```

this command was verified against the local Codex CLI on 2026-08-23. use
`codex mcp get positioning-bridge` to inspect the saved entry.

## tools

### `get_positioning_context`

input: `{ context }`.

returns applicable pillars, claims, competitors, campaign, rules, message requirements,
source IDs, and applied policy IDs. call this before drafting when the writer needs the
approved message space.

### `create_content_brief`

input: `{ context }`.

returns `mustCarry`, `shouldCarry`, `opportunities`, current approved claims, prohibited
claims, campaign-prohibited messages, deterministic rules, the selected campaign
narrative, and source IDs. it does not generate the draft.

### `check_content`

input:

```json
{
  "content": "draft text",
  "context": {
    "audienceId": "platform-leader",
    "channelId": "landing-page",
    "funnelStageId": "consideration",
    "localeId": "en",
    "campaignId": "campaign.launch"
  },
  "semantic": "auto"
}
```

returns the domain decision, capabilities, coverage, and findings. `semantic` can be
`auto` or `disabled`. the default package composition has no semantic provider, so
`auto` reports `not_run` until the embedding application injects one.

### `explain_positioning_item`

input: `{ "id": "claim.no-training" }`.

returns the complete policy item and current evidence state. IDs are unique across
sources, pillars, claims, competitors, campaigns, and rules.

## output compatibility

every tool advertises an output schema and returns the same JSON object in two places:

- `structuredContent.result` for typed clients;
- a serialized JSON text content block for clients that still rely on text.

the CLI and MCP check paths call the same `PositioningService`. parity is covered by an
integration test.

## recommended writer sequence

1. select the real audience, channel, funnel stage, locale, and campaign.
2. call `create_content_brief` before drafting.
3. draft from approved source material.
4. call `check_content` and repair blocking or warning findings.
5. use `explain_positioning_item` when a finding needs evidence.
6. run voice, fact, legal, and human approval gates separately.

## security

the stdio server reads one configured pack during startup. draft text is evaluated in
memory and not persisted. default runtime code performs no network requests.

if a future remote transport is added, it needs authentication, Origin validation,
localhost-safe binding defaults, tenant separation, request limits, and a separate
architecture decision.
