# contributor instructions

- treat `docs/plans/2026-08-23-positioning-bridge-requirements.md` as the product
  contract.
- preserve the dependency direction in `config/architecture.policy.json`.
- keep deterministic and model-assisted evidence separate in types, tests, and prose.
- do not add network access, policy mutation, publishing, or a HYV dependency without a
  new architecture decision.
- add a behavior-level test before changing an evaluation decision.
- run `npm run verify` before calling a revision complete.
