# Gutenberg Nightly v2.0 — Planning Notes

**Status:** Decided, not yet implemented. Target: next version of the nightly automation.

## The Problem

On 2026-04-20, the nightly workflow failed during `npm run build:plugin-zip` with:

```
npm error notsup Required: {"node":"^20.19.0 || ^22.13.0 || >=24"}
npm error notsup Actual:   {"npm":"10.9.0","node":"v22.12.0"}
```

Local Node was v22.12.0. The failure came from a **transitive dependency** — not Gutenberg itself (whose `engines.node` is only `>=20.19.0`). Some package deep in the tree required `^22.13.0 || >=24` when on Node 22.x.

Manual fix: `nvm use v22.13.0` and rerun. Works, but breaks fully automated/cron-driven runs.

## Why `engines.node` from gutenberg/package.json Isn't Enough

Checking only Gutenberg's own `engines.node` would have passed (v22.12 ≥ 20.19). The stricter constraint lives inside a transitive dep and only surfaces when `npm install` / `npm run` runs. Any pre-flight check that parses only the top-level `package.json` will miss this class of error.

## Decision

Add a shell wrapper script that ensures Node LTS is active before invoking `startend.js`.

**File:** `/Users/pauli/gb-nightly/distribute-nightly/run-nightly.sh`

```bash
#!/usr/bin/env bash
set -e
source ~/.nvm/nvm.sh
nvm install --lts > /dev/null
nvm use --lts
node "$(dirname "$0")/startend.js"
```

Make it executable (`chmod +x run-nightly.sh`) and invoke it instead of `node startend.js`.

## Rationale

- **Self-healing:** `nvm install --lts` is a no-op if the latest LTS is already installed. It only downloads when a new LTS drops (every few months). Daily overhead is ~1–2s (just a network check).
- **No manual intervention:** Eliminates the manual `nvm use` step that currently blocks unattended runs.
- **Uses LTS, not `.nvmrc`:** Gutenberg's `.nvmrc` is pinned to `20`. That's still supported, but LTS (currently Node 24.x) satisfies the `>=24` branch of the constraint, giving more headroom against future transitive bumps.
- **Separation of concerns:** `startend.js` stays pure Node; shell handles environment. Avoids the awkwardness of invoking nvm (a shell function) from Node's `execSync`.

## Alternatives Considered

| Option | Why not |
| --- | --- |
| Pre-flight check in `startend.js` that parses `engines.node` | Misses transitive dep constraints (the actual cause here). |
| `nvm use --lts` only (no install) | Fails when a new LTS drops unless someone runs `nvm install --lts` manually. |
| Pin to an exact Node version in a config file | Requires manual bumps. Drifts over time. |
| Run npm in dry-run to let npm check | Adds a full install roundtrip per run. Overkill. |

## Open Questions for Next Iteration

- Should the wrapper also verify `npm` version? The Gutenberg constraint was `npm >=10.2.3` — current LTS ships with npm ≥ 10, but worth confirming.
- Should we log which Node version was selected for a given nightly build (in the release notes)?
- If cron-driving this on a remote host, is nvm installed there? Path may differ (`~/.nvm/nvm.sh` vs. system install). See [Gutenberg Nightly on Unraid: Setup Guide](./unraid-setup-guide.md) for the planned deployment target.

## Related Docs

- [Gutenberg Nightly on Unraid: Setup Guide](./unraid-setup-guide.md) — docker + cron deployment plan for unattended nightly builds.

## Context / History

- **Trigger:** Node v22.12 → v22.13 transitive bump on 2026-04-20.
- **Related script:** `startend.js` also had a `git commit` bug where re-running with no diff exited with code 1. Fixed by adding a "nothing to commit" guard (already shipped).
- **Related change:** `startend.js` now detects upstream RCs and auto-bumps the nightly minor version (e.g., `23.0` → `23.1` when `v23.0.0-rc.1` tagged). Also already shipped.
