# Implementation Plan: Move Gutenberg Nightly Distribution to GitHub Actions

**Repo:** `bph/distribute-nightly` · **Companion repo:** `bph/gutenberg` (fork of `WordPress/gutenberg`) **Goal:** The nightly routine currently runs on a local Mac via `node startend.js`. The Mac is going offline; the routine must run unattended in the cloud. Chosen host: **GitHub Actions scheduled workflow** in `bph/distribute-nightly`.

This plan was produced in a Claude.ai conversation (July 2026\) that analyzed the repo, its git history, and live data on `bph/gutenberg`. Artifacts are embedded in full at the bottom. Sections 1–3 give Claude Code the context and reasoning; section 4 is the task list.

---

## 1\. How the current routine works (discovered from code)

`startend.js` is the orchestrator. One run does:

1. `git fetch upstream --no-tags` in the sibling `../gutenberg` clone  
2. `getNightlyVersion()`: read major.minor from the **latest release tag** on `bph/gutenberg`, append today's `YYYYMMDD` (e.g. `23.6.20260710`)  
3. Write that version into `gutenberg.php`, commit ("version bump to X")  
4. `git merge upstream/trunk`; if the **only** conflicted file is `gutenberg.php`, auto-resolve with `git checkout --ours` (keep the stamped version); any other conflict → exit(1)  
5. `NO_CHECKS=true npm run build:plugin-zip`  
6. `dist now` → `utils/git.js` (push fork, compare file version vs release tag, create new release **or** `gh release upload --clobber` the zip) \+ `utils/sftp.js` (upload zip to gutenbergtimes.com via SFTP)  
7. `dist update-page` → `utils/update-page.js` (update the Nightly page via WP REST API, fetch stable/RC versions, then `open()` a browser to eyeball the result)

Directory layout assumption: `distribute-nightly/` and `gutenberg/` are **siblings**; scripts use `../gutenberg/` paths. The `dist` command is the npm bin of this package.

## 2\. Key discoveries and decisions

### D1 — Host on GitHub Actions (decision)

Free for public repos, cron built in (`on: schedule`), `gh` CLI and Node preinstalled, encrypted secrets, and Gutenberg itself builds on GitHub-hosted runners. Rejected alternatives: VPS with cron (works unchanged but is a server to maintain), Render/Railway cron jobs.

### D2 — Runners are ephemeral, so the workflow recreates local state (decision)

The Mac had a long-lived clone with an `upstream` remote. Runners start empty every run, so the workflow checks out both repos side by side, re-adds the upstream remote, and syncs fork ← upstream each run. Direction of sync is strictly one-way: `WordPress/gutenberg` is only ever **read** (fetch/pull); all writes (push, releases, tags) target `bph/gutenberg`. The fine-grained PAT is scoped to `bph/gutenberg` only, so writing elsewhere is impossible even in a bug.

### D3 — Run `startend.js` unchanged rather than reimplement it (decision)

A first workflow draft reimplemented sync/stamp/build as YAML steps and got the version stamping wrong. Corrected approach: the workflow only prepares the environment (checkouts, remotes, Node from `gutenberg/.nvmrc`, `npm ci` in both repos, `npm install -g .` to provide the `dist` bin) and then runs `node startend.js`. Same code path locally and in CI.

### D4 — The version-jump mechanism was fragile (discovery) → make it explicit (decision)

The nightly major.minor jumps (e.g. 23.5 → 23.6) when the next Gutenberg RC ships. The **decision** lives in `utils/git.js`: `if (fileVersion > nightlyVersion) → gh release create '${fileVersion}-nightly'`. The **signal** historically came from upstream's RC version-bump commit flowing into `gutenberg.php` via the merge.

Git archaeology: commit 2026-03-19 ("automate nightly version bump and merge conflict resolution") added the daily stamp commit \+ `--ours` conflict resolution; commit 2026-03-28 ("fix version mismatch across nightly scripts") changed `getNightlyVersion()` to derive from the release tag. Together these create a circularity (file version derived from tag can never exceed the tag) and the `--ours` resolution discards upstream's RC bump. Jumps still happened (fork history shows 23.4→23.5 around Jun 9–11 and 23.5→23.6 on Jun 24, 2026\) but with a telltale **missing stamp commit on Jun 10** — the RC-day run appears to go through an irregular/conflict path. Unattended, this risks a permanently stuck version.

**Fix (patched `startend.js` below):** `getNightlyVersion()` now computes the next version (with the 23.9→24.0 rollover rule) and checks `gh release list -R WordPress/gutenberg` for a `v<next>.0-rc*` prerelease. If it exists, stamp the next version; `git.js`'s create-release branch then fires by design. If the check fails (network/rate limit), log a warning and keep the current version — the jump simply happens on the next run. Logic verified against four scenarios: normal jump, no-RC-yet, 23.9→24.0 rollover, and the legacy `23.0.-nightly` tag format.

### D5 — Headless runner has no browser (discovery) → guard `open()` (decision)

`utils/update-page.js` line \~215 calls `await open('https://gutenbergtimes.com/need-a-zip-from-master/')` so a human can eyeball the page. On a runner this errors and fails the step. GitHub sets `CI=true` automatically, so guard it: `if (!process.env.CI) await open('https://gutenbergtimes.com/need-a-zip-from-master/');` The eyeball check is replaced by the job summary \+ issue comment (D6).

### D6 — Observability replaces "watch it run" (decision)

- GitHub emails the repo owner automatically on scheduled-workflow **failure** (zero setup)  
- A **job summary** (`$GITHUB_STEP_SUMMARY`) renders version, zip size, release link, page link on each run's page  
- A **public notification chain**: the workflow comments on a pinned "Nightly build log" issue on `bph/gutenberg` — ✅ with version \+ download \+ run-log links on success, ❌ with run-log link on failure. Anyone can subscribe to that one issue. (Chosen over Discussions because issue comments work with plain `gh`; Discussions need GraphQL.)

## 3\. Manual prerequisites (human, not Claude Code)

1. **Fine-grained PAT:** GitHub → Settings → Developer settings → Fine-grained tokens. Resource owner `bph`, repository access only `bph/gutenberg`, permissions **Contents: R/W** and **Issues: R/W**. Max expiry is 1 year — set a renewal reminder.  
2. **Secrets** on `bph/distribute-nightly` (Settings → Secrets and variables → Actions): `NIGHTLY_PAT`, `FTPHOST`, `FTPPORT`, `FTPUSER`, `FTPPASS`, `WP_API_URL`, `WP_USER`, `WP_APP_PASSWORD`.  
3. **Pinned issue** "Nightly build log" on `bph/gutenberg`; note its number.

## 4\. Tasks for Claude Code (in `bph/distribute-nightly`)

- [ ] **T1.** Create `.github/workflows/nightly.yml` with the content in Artifact A. Set `NIGHTLY_ISSUE` to the real pinned-issue number (placeholder is `'1'`).  
- [ ] **T2.** Replace `startend.js` with Artifact B. Diff against the current file first — **only `getNightlyVersion()` should differ**; if anything else changed upstream since this plan was written, port the new function into the current file instead of overwriting.  
- [ ] **T3.** In `utils/update-page.js`, wrap the `await open(...)` call in `if (!process.env.CI) { ... }`.  
- [ ] **T4.** Sanity checks: `node --check startend.js`; confirm `package.json` has the `dist` bin entry (needed for `npm install -g .` in the workflow); confirm `gutenberg`'s `.nvmrc` path assumption (`gutenberg/.nvmrc` relative to workspace root).  
- [ ] **T5.** Commit with a message referencing this plan; do **not** enable/trigger the schedule until the human confirms secrets are in place.

## 5\. Test plan

1. With secrets set, trigger via **Run workflow** (workflow\_dispatch). Expect: fork synced, zip built, asset clobbered on the current `-nightly` release, SFTP upload, page updated, ✅ issue comment, job summary populated.  
2. Check gutenbergtimes.com/need-a-zip-from-master/ shows today's date and correct versions.  
3. Run a second manual run the same day — the stamp commit may be a no-op; verify behavior (known edge: committing an unchanged file can throw; observe and fix if it aborts the run).  
4. First real jump test happens when the next RC (23.7) ships: look for the log line `RC for 23.7 found upstream — jumping nightly version 23.6 -> 23.7` and a new `23.7-nightly` release created by `git.js`.  
5. After a week of green scheduled runs, decommission the Mac routine (or keep it as documented fallback — both environments run the identical scripts).

## 6\. Known risks / open items

- **`fetch-depth: 0`** on the Gutenberg checkout is slow (\~minutes, large repo) but safest for merge behavior. Optimization (shallow \+ `--update-shallow`) possible later if run time bothers.  
- **PAT expiry** (≤1 year) will cause auth failures — the failure comment/email will surface it, but a calendar reminder is better.  
- **Same-day rerun no-op commit** edge case (test step 3).  
- **Multi-file merge conflicts** still exit(1) by design — the failure notification chain covers it; resolution stays a human call.  
- The `dist` bin requires `npm install -g .`; if the runner PATH misbehaves, fallback is replacing `dist` calls in `startend.js` with `node index.js`.

---

## Artifact A — `.github/workflows/nightly.yml`

\# Distribute Gutenberg Nightly

\# Place in bph/distribute-nightly at: .github/workflows/nightly.yml

\#

\# The heavy lifting is done by startend.js — this workflow just recreates

\# the environment it expects (side-by-side repos, upstream remote, node,

\# gh auth, the \`dist\` command) and adds notifications around it.

\#

\# Required secrets on bph/distribute-nightly:

\#   NIGHTLY\_PAT       Fine-grained PAT for bph/gutenberg (Contents \+ Issues: R/W)

\#   FTPHOST, FTPPORT, FTPUSER, FTPPASS

\#   WP\_API\_URL, WP\_USER, WP\_APP\_PASSWORD

\#

\# One-time: create a pinned "Nightly build log" issue on bph/gutenberg

\# and set its number in NIGHTLY\_ISSUE below.

name: Distribute Gutenberg Nightly

on:

  schedule:

    \- cron: '0 5 \* \* \*'      \# daily 05:00 UTC — adjust to taste

  workflow\_dispatch:          \# manual "Run workflow" button

env:

  NIGHTLY\_ISSUE: '1'                       \# pinned issue number on bph/gutenberg

  GH\_TOKEN: ${{ secrets.NIGHTLY\_PAT }}     \# auth for all gh CLI calls

  \# Secrets consumed by dist now / dist update-page (spawned by startend.js)

  localDir: ../gutenberg/

  FTPhost: ${{ secrets.FTPHOST }}

  FTPport: ${{ secrets.FTPPORT }}

  FTPuser: ${{ secrets.FTPUSER }}

  FTPpass: ${{ secrets.FTPPASS }}

  WP\_API\_URL: ${{ secrets.WP\_API\_URL }}

  WP\_USER: ${{ secrets.WP\_USER }}

  WP\_APP\_PASSWORD: ${{ secrets.WP\_APP\_PASSWORD }}

jobs:

  nightly:

    runs-on: ubuntu-latest

    timeout-minutes: 90

    steps:

      \# ── 1\. Side-by-side layout: ./distribute-nightly and ./gutenberg ──

      \- name: Checkout distribute-nightly

        uses: actions/checkout@v4

        with:

          path: distribute-nightly

      \- name: Checkout bph/gutenberg fork

        uses: actions/checkout@v4

        with:

          repository: bph/gutenberg

          token: ${{ secrets.NIGHTLY\_PAT }}

          path: gutenberg

          ref: trunk

          fetch-depth: 0        \# full history so merge behaves like your local clone

      \- name: Configure git identity and upstream remote

        working-directory: gutenberg

        run: |

          git config user.name  "gutenberg-nightly-bot"

          git config user.email "pauli@gutenbergtimes.com"

          git remote add upstream https://github.com/WordPress/gutenberg.git

      \# ── 2\. Toolchain ──────────────────────────────────────────────

      \- name: Set up Node (from Gutenberg's .nvmrc)

        uses: actions/setup-node@v4

        with:

          node-version-file: gutenberg/.nvmrc

          cache: npm

          cache-dependency-path: gutenberg/package-lock.json

      \- name: Install dependencies and the \`dist\` command

        working-directory: distribute-nightly

        run: |

          npm ci

          npm install \-g .     \# provides the \`dist\` bin that startend.js calls

      \- name: Install Gutenberg build dependencies

        working-directory: gutenberg

        run: npm ci

      \# ── 3\. Run your routine, unchanged ────────────────────────────

      \#     startend.js: stamp version from latest release tag \+ date,

      \#     commit, merge upstream/trunk (auto-resolve gutenberg.php),

      \#     build zip, dist now (push+release+sftp), dist update-page.

      \- name: Run startend.js

        working-directory: distribute-nightly

        run: node startend.js

      \# ── 4\. Job summary on the run page ────────────────────────────

      \- name: Write job summary

        if: always()

        run: |

          VERSION=$(grep \-oP 'Version:\\s\*\\K\\S+' gutenberg/gutenberg.php || echo "unknown")

          ZIPSIZE=$(du \-h gutenberg/gutenberg.zip 2\>/dev/null | cut \-f1 || echo "n/a")

          TAG=$(gh release list \-L 1 \-R bph/gutenberg \--json tagName \--jq '.\[0\].tagName' || echo "n/a")

          {

            echo "\#\# Gutenberg Nightly — ${{ job.status }}"

            echo ""

            echo "| | |"

            echo "|---|---|"

            echo "| Version | \\\`$VERSION\\\` |"

            echo "| Zip size | $ZIPSIZE |"

            echo "| Release | \[$TAG\](https://github.com/bph/gutenberg/releases/tag/$TAG) |"

            echo "| Page | \[need-a-zip-from-master\](https://gutenbergtimes.com/need-a-zip-from-master/) |"

          } \>\> "$GITHUB\_STEP\_SUMMARY"

      \# ── 5\. Public notification chain on pinned issue ───────────────

      \- name: Comment on build-log issue (success)

        if: success()

        run: |

          VERSION=$(grep \-oP 'Version:\\s\*\\K\\S+' gutenberg/gutenberg.php)

          TAG=$(gh release list \-L 1 \-R bph/gutenberg \--json tagName \--jq '.\[0\].tagName')

          gh issue comment "$NIGHTLY\_ISSUE" \-R bph/gutenberg \--body \\

            "✅ \*\*Nightly $VERSION\*\* built and distributed. \[Download\](https://github.com/bph/gutenberg/releases/tag/$TAG) · \[Run log\](${{ github.server\_url }}/${{ github.repository }}/actions/runs/${{ github.run\_id }})"

      \- name: Comment on build-log issue (failure)

        if: failure()

        run: |

          gh issue comment "$NIGHTLY\_ISSUE" \-R bph/gutenberg \--body \\

            "❌ \*\*Nightly build failed\*\* on $(date \-u \+%Y-%m-%d). \[Run log\](${{ github.server\_url }}/${{ github.repository }}/actions/runs/${{ github.run\_id }})"

## Artifact B — patched `startend.js`

// Import necessary modules

const { execSync } \= require('child\_process');

const path \= require('path');

const fs \= require('fs');

// Get the current date in MM/DD format

const currentDate \= new Date();

const formattedDate \= \`${currentDate.getMonth() \+ 1}/${currentDate.getDate()}\`;

// Get today's date as YYYYMMDD for the nightly version

const year \= currentDate.getFullYear();

const month \= String(currentDate.getMonth() \+ 1).padStart(2, '0');

const day \= String(currentDate.getDate()).padStart(2, '0');

const dateStamp \= \`${year}${month}${day}\`;

// Define a function to execute a command

function runCommand(command, cwd \= process.cwd()) {

    try {

        console.log(\`Running command: ${command} in directory: ${cwd}\`);

        execSync(command, { stdio: 'inherit', cwd });

    } catch (error) {

        console.error(\`Error executing command: ${command}\`);

        console.error(error.message);

        process.exit(1); // Exit the process with an error code

    }

}

// Get the nightly version: start from the latest release tag on bph/gutenberg,

// then jump to the next major.minor as soon as its RC exists on WordPress/gutenberg.

// This makes the version jump an explicit, deliberate step (previously it relied

// on upstream's version-bump commit surviving the merge into gutenberg.php).

function getNightlyVersion() {

    const result \= execSync('gh release list \-L 1 \-R bph/gutenberg', { encoding: 'utf8' }).trim();

    if (\!result) {

        throw new Error('Could not get latest release from bph/gutenberg');

    }

    // Tag is in the third tab-separated column, e.g. "23.0.-nightly"

    const tag \= result.split('\\t')\[2\];

    const match \= tag.match(/(\\d+)\\.(\\d+)/);

    if (\!match) {

        throw new Error(\`Could not parse version from release tag: ${tag}\`);

    }

    let major \= parseInt(match\[1\]);

    let minor \= parseInt(match\[2\]);

    // Next version after the current nightly (same rollover rule as fetchRcRelease:

    // e.g. 23.9 \-\> 24.0)

    let nextMajor \= major;

    let nextMinor \= minor \+ 1;

    if (nextMinor \> 9\) {

        nextMajor \+= 1;

        nextMinor \= 0;

    }

    const nextVersion \= \`${nextMajor}.${nextMinor}\`;

    // Has the next version's RC been published upstream? If yes, jump.

    // Non-fatal: if the check fails (network, rate limit), stay on the

    // current version — worst case the jump happens on the next run.

    try {

        const rcs \= execSync(

            \`gh release list \-R WordPress/gutenberg \-L 10 \--json tagName,isPrerelease \--jq '\[.\[\] | select(.isPrerelease)\]\[\].tagName'\`,

            { encoding: 'utf8' }

        );

        if (rcs.includes(\`v${nextVersion}.0-rc\`)) {

            console.log(\`RC for ${nextVersion} found upstream — jumping nightly version ${major}.${minor} \-\> ${nextVersion}\`);

            major \= nextMajor;

            minor \= nextMinor;

        }

    } catch (err) {

        console.log(\`Warning: could not check upstream for RC releases (${err.message}) — keeping ${major}.${minor}\`);

    }

    return \`${major}.${minor}.${dateStamp}\`;

}

// Update the Version field in gutenberg.php

function updateVersionInFile(gutenbergDir, newVersion) {

    const filePath \= path.join(gutenbergDir, 'gutenberg.php');

    let content \= fs.readFileSync(filePath, 'utf8');

    content \= content.replace(/(\\\* Version:\\s\*)\\S+/, \`$1${newVersion}\`);

    fs.writeFileSync(filePath, content, 'utf8');

}

// Main function to run the sequence of commands

function main() {

    const rootDir \= process.cwd(); // Assuming this script is run from the root directory

    // Navigate to gutenberg directory and fetch upstream

    const gutenbergDir \= path.resolve(rootDir, '../gutenberg');

    runCommand('git fetch upstream \--no-tags', gutenbergDir);

    // Step 1: Determine nightly version from latest release tag, plus today's date

    const nightlyVersion \= getNightlyVersion();

    console.log(\`Nightly version: ${nightlyVersion}\`);

    // Step 2: Update gutenberg.php with the nightly version and commit

    updateVersionInFile(gutenbergDir, nightlyVersion);

    execSync('git add gutenberg.php', { cwd: gutenbergDir });

    execSync(\`git commit \-m 'version bump to ${nightlyVersion}' \--no-verify\`, { stdio: 'inherit', cwd: gutenbergDir });

    console.log(\`Version updated to ${nightlyVersion}\`);

    // Step 3: Merge upstream/trunk

    // If the merge conflicts only in gutenberg.php (version bump), resolve by keeping ours

    const mergeMessage \= \`prep build ${formattedDate}\`;

    try {

        execSync(\`git merge upstream/trunk \-m '${mergeMessage}' \--no-verify\`, { stdio: 'inherit', cwd: gutenbergDir });

    } catch (mergeError) {

        console.log('Merge conflict detected — checking if it is only in gutenberg.php...');

        const conflicted \= execSync('git diff \--name-only \--diff-filter=U', { cwd: gutenbergDir }).toString().trim();

        if (conflicted \=== 'gutenberg.php') {

            console.log('Resolving gutenberg.php conflict by keeping nightly version...');

            execSync('git checkout \--ours gutenberg.php', { stdio: 'inherit', cwd: gutenbergDir });

            execSync('git add gutenberg.php', { stdio: 'inherit', cwd: gutenbergDir });

            execSync(\`git commit \--no-verify \-m '${mergeMessage}'\`, { stdio: 'inherit', cwd: gutenbergDir });

            console.log('Merge conflict resolved automatically.');

        } else {

            console.error(\`Merge conflict in unexpected files: ${conflicted}\`);

            console.error('Please resolve manually and re-run.');

            process.exit(1);

        }

    }

    // Build the plugin zip with NO\_CHECKS=true

    runCommand('NO\_CHECKS=true npm run build:plugin-zip', gutenbergDir);

    // Navigate to distribute-nightly directory and run dist now

    const distributeNightlyDir \= path.resolve(rootDir, '../distribute-nightly');

    runCommand('dist now \--no-clear', distributeNightlyDir);

    // Update the Gutenberg Nightly page via WP REST API

    runCommand('dist update-page \--no-clear', distributeNightlyDir);

}

// Execute the main function

main();\`\`\`  
