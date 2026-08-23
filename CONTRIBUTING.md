# contributing

Positioning Bridge is small on purpose. changes should make positioning policy easier to
inspect, apply, or verify without pulling delivery or model details into the domain
core.

## setup

```bash
git clone https://github.com/shashank-sn/positioning-bridge.git
cd positioning-bridge
npm ci
npm run verify
```

Node.js 22 or newer is required.

## change contract

1. open an issue for a behavior or schema change before implementation.
2. name the requirement and user-visible acceptance example.
3. add a failing behavior-level test.
4. make the smallest change that passes it.
5. run focused tests, then `npm run verify`.
6. update schema, examples, docs, and changelog when the public contract changes.

do not combine deterministic and model-assisted certainty, add default network access,
mutate policy through MCP, publish content, or add a HYV dependency without a new
architecture decision.

## pull requests

keep changes bounded. describe the policy effect, tests, privacy effect, compatibility,
and any human check that remains. every changed line should trace to the request.

maintainers may ask for a changeset to be split when schema, evaluator, provider, and
delivery work are mixed together.

## commits

use direct imperative subjects. sign commits when your normal contribution policy
supports it. by contributing, you agree that your contribution is licensed under the
[MIT License](LICENSE).

## conduct and security

follow [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). report vulnerabilities through the
private process in [SECURITY.md](SECURITY.md), never a public issue.
