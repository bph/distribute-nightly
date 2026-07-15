# Gutenberg Nightly → GitHub Actions: Revised Implementation Plan

Supersedes the task list (section 4) and test plan (section 5) of `IMPLEMENTATION-PLAN.md`, based on the 2026-07-15 grilling session (9 decisions). Working directory: `/Users/pauli/gb-nightly/distribute-nightly`.

**Headline change vs. the original plan: Artifact B is discarded.** The current `startend.js` is kept as-is (its version-jump semantics are correct — verified against live release data this morning: 23.6 → 23.7 jumped correctly when v23.6.0-rc.1 shipped). Only targeted fixes are applied.

## Code changes

### 1. Shared rollover helper (Decision 1b)
- Create `utils/version.js` exporting a next-version helper with the rollover rule (`minor > 9 → major+1, minor=0`).
- Use it in `startend.js:52-53` (currently bare `minor += 1` → would produce `23.10`) and in `utils/update-page.js:74-78` (replace inline copy).
- Fixes the ~Nov 2026 time bomb: `git.js:60` compares versions with string `>`, and `"23.10" > "23.9"` is false → releases would silently stop.

### 2. package.json cleanup (Decision 2)
- Bin block reduced to `"dist": "index.js"` (remove `"distribute-nightly "` with trailing space — hard-fails modern npm — and `"test"` which shadows the Unix command).
- Keep the workflow's `npm install -g .` approach.

### 3. Remove chalk + credential echo (Decision 3)
- Strip `require('chalk')` and unwrap `${y(...)}`/`${g(...)}`/`${b(...)}` to plain strings in: `utils/test.js`, `utils/git.js`, `utils/buildgb.js`, `utils/update-page.js`, `utils/block-status.js`.
- Remove `console.log(process.env.FTPuser)` from `test.js` (no credentials in public CI logs).

### 4. Preflight command (Decision 5)
- Rewrite `utils/test.js` as a secrets/connectivity preflight: (a) `gh` auth check against `bph/gutenberg`, (b) SFTP connect + disconnect, (c) authenticated WP REST GET. Exit non-zero on any failure.
- Validates all 8 secrets in ~30s; the button to press after each annual PAT renewal.

### 5. Guard `open()` for headless CI (original T3, unchanged)
- `utils/update-page.js:215`: wrap `await open(...)` in `if (!process.env.CI) { ... }`.

### 6. Workflow `.github/workflows/nightly.yml` (Artifact A + Decisions 4, 7, 8, 9)
Based on the plan's Artifact A, with these changes:
- **Env:** single `GITHUB_TOKEN: ${{ secrets.NIGHTLY_PAT }}` (no `GH_TOKEN` line — gh CLI falls back to `GITHUB_TOKEN`; `block-status.js`'s raw `fetch()` requires this exact name; matches local `.env`).
- **Concurrency:** `group: nightly-distribution`, `cancel-in-progress: false` (queue, never overlap, never cancel mid-SFTP).
- **Dispatch input:** `mode: preflight | full` (default `full`; cron always full). Preflight runs `dist test` and stops before any production write.
- **Keep-alive step** (last, `if: always()`): re-enable own schedule via `gh api -X PUT .../workflows/nightly.yml/enable` using `GH_TOKEN: ${{ github.token }}` at step level + `permissions: actions: write` — defeats GitHub's 60-day scheduled-workflow auto-disable (nightly commits go to `bph/gutenberg`, so `distribute-nightly` looks inactive).
- Job summary + success/failure issue comments as in Artifact A; `NIGHTLY_ISSUE` must be the real pinned-issue number before merge (placeholder `'1'` is a blocker).

### 7. Reset-fork recovery workflow (Decision 6)
- New `.github/workflows/reset-fork.yml`, **`workflow_dispatch`-only** (never scheduled): force-push `upstream/trunk` → `bph/gutenberg` trunk. Releases/tags/zips are untouched by a branch reset; only disposable stamp/merge commits are lost.
- This replaces any standing local clone as the multi-file-merge-conflict recovery path. No local gutenberg checkout needs to be maintained.

### 8. Sanity checks + commit (original T4/T5)
- `node --check` on all changed files; verify `gutenberg/.nvmrc` path assumption in the workflow.
- Commit referencing the plan. **Do not enable the schedule** until prerequisites and Stage 0/1 pass.

## Manual prerequisites (human — updated)
1. Fine-grained PAT scoped to `bph/gutenberg` only: Contents R/W + Issues R/W (+ renewal reminder).
2. **Enable Issues on the `bph/gutenberg` fork** (Settings → Features — off by default on forks; without it the whole notification chain is dead on arrival, including failure notices).
3. Create pinned "Nightly build log" issue; put its number in `NIGHTLY_ISSUE`.
4. Set the 8 secrets on `bph/distribute-nightly`: `NIGHTLY_PAT`, `FTPHOST`, `FTPPORT`, `FTPUSER`, `FTPPASS`, `WP_API_URL`, `WP_USER`, `WP_APP_PASSWORD`.

## Staged rollout (Decision 9 — replaces old test plan)
- **Stage 0 — preflight:** Run workflow with `mode: preflight`. Writes nothing; proves secrets, checkouts, auth.
- **Stage 1 — shadow run:** First `mode: full` run on a day the Mac routine already ran. Expected: same version computed, no-op stamp commit, asset clobbered with equivalent zip, page rewritten with same values. Any diff = CI bug caught with hours-old restorable ground truth.
- **Stage 2 — go live:** Enable schedule (05:00 UTC), watch a week of green runs, then decommission the Mac routine. Verify the next real version jump (23.7 → 23.8, when v23.7.0-rc ships ~late Aug) via the jump log line + new `23.8-nightly` release.

## Out of scope / accepted risks
- Multi-file merge conflicts still fail the run by design → ❌ issue comment → human runs reset-fork workflow.
- `fetch-depth: 0` slowness accepted for merge correctness (optimize later if needed).
- PAT expiry ≤ 1 year → calendar reminder + preflight run after renewal.
