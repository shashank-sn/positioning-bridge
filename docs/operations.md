# operations

## runtime contract

- Node.js 20 or newer;
- one YAML or JSON pack per process;
- stdio MCP transport;
- 1 MiB pack limit;
- 200,000-byte content limit;
- no default network access or draft persistence.

the pack is immutable for the life of the server process. restart after every approved
policy update. that guarantees one check cannot resolve half its rules from one revision
and half from another.

## CI gate

```bash
npm ci
npm run verify
npm run smoke:package
```

`verify` checks formatting, linting, strict types, tests and coverage, generated schema
drift, architecture direction, documentation links, and the production build.

## content decisions

| decision         | process meaning                                      |
| ---------------- | ---------------------------------------------------- |
| `pass`           | no error or warning finding; suggestions may remain  |
| `needs_revision` | at least one warning needs repair or explicit review |
| `blocked`        | at least one explicit policy is configured to block  |

model-assisted findings default to warnings or suggestions. they cannot create `blocked`
without a separate deterministic policy match.

## policy update sequence

1. edit the pack in a branch.
2. update its company-owned `version`.
3. validate every source status, qualifier, and expiry.
4. run example drafts for expected pass and failure decisions.
5. obtain positioning-owner approval.
6. merge and restart consuming MCP processes.

the project does not maintain a decision ledger in the first release. save CLI JSON in
the calling workflow when an audit record is required, with the same privacy controls as
the draft.

## release checklist

1. update `package.json` and `CHANGELOG.md` with the same version.
2. run `npm ci && npm run verify`.
3. run `npm run smoke:package` to pack and install the exact tarball in a temporary
   directory.
4. confirm its installed binary, example validation, library export, file allowlist, and
   stdio MCP handshake all pass.
5. create a signed Git tag only after those checks pass.
6. publish to npm only after package ownership, provenance, and the GitHub remote are
   configured by a maintainer.

the local repository does not assume a GitHub owner, npm owner, support address, or
release credential.

## semantic adapters

embedding applications can inject the exported `SemanticReviewer` interface. an adapter
must return policy IDs, bounded content spans, a rationale, and confidence. the service
rejects unknown or inapplicable policy references and invalid spans.

deployment owners decide which provider receives content. they must document data
retention, regional processing, model version, timeout, failure behavior, and human
review before enabling network-backed semantics.
