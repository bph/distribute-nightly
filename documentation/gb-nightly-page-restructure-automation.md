# Implementation Plan: Gutenberg Nightly Page Restructure & Automation
## Overview
Two parallel workstreams:
1. **Page restructure** — split the current single page into three focused pages in WordPress
2. **Automation** — extend the existing `distribute-nightly` CLI to auto-update Page 1 on each build
---
## Workstream 1: Page Restructure
### Step 1 — Create the two new pages
Create two new WordPress pages (as drafts first):
**Page 2:** "How to Install & Update Gutenberg Nightly"
- Slug: `/gutenberg-nightly-install-guide/`
- Content to move from current page:
  - "How to install Gutenberg Nightly" (Steps 1–3)
  - "How do I get updates?" section including the Git Updater instructions, cache note, and the Git Updater free/PRO side note
**Page 3:** "Gutenberg Nightly – History & Project Updates"
- Slug: `/gutenberg-nightly-history/`
- Content to move from current page:
  - "What other people wrote about Gutenberg Nightly" section
  - The full "Project Updates" chronological log (Day 1 through present)
  - The origin story paragraph at the bottom
### Step 2 — Restructure Page 1 (current page)
Keep the slug `/need-a-zip-from-master/` as-is (existing links and SEO equity preserved).
**Static content to keep on Page 1:**
- Intro paragraph (who it's for, the problem it solves)
- The Playground URL paragraph
- "If your site doesn't update right away…" / Refresh Cache note
- "Join us at the Discussion board" paragraph
- "Updates are made possible via Git Updater" paragraph
- "Note: The version tag of the Gutenberg Nightly will always be one decimal ahead…" paragraph
**Wrap all dynamic content in a named Group block** (see Workstream 2).
**Add a simple navigation section** at the bottom with links to the two new pages.
### Step 3 — Cross-link the pages
Add a brief navigation block at the bottom of each page linking to the others:
- → [How to Install & Update Gutenberg Nightly]
- → [Project History & Updates]
---
## Workstream 2: Automation of Page 1
### The Dynamic Zone
On Page 1, wrap the following blocks in a single `core/group` block and give it an HTML anchor of `dynamic-zone`:
```
<!-- wp:group {"anchor":"dynamic-zone"} -->
  [date paragraph]              ← "March 2, 2026"
  [links list]                  ← Latest Weekend Edition + Latest podcast episode
  [columns block]
    [left column]
      [Download button]         ← "Download Gutenberg Nightly" + URL
      [version paragraph]       ← "v-22.8.20260302"
      [GitHub link paragraph]   ← "Also available on GitHub" + URL
    [right column]
      [Gutenberg stable button] ← "Gutenberg 22.6" + URL
      [What's new list]         ← "What's new in Gutenberg 22.6? (25 Feb)"
<!-- /wp:group -->
```
This is the **only section the automation will ever touch**.
### Dynamic Values (inputs to the template)
All of these are already known to the CLI at build time:
| Variable | Example | Source |
|---|---|---|
| `buildDate` | `March 2, 2026` | System date at build time |
| `nightlyVersion` | `v-22.8.20260302` | Constructed from stable version + date |
| `nightlyDownloadUrl` | GitHub release asset URL | GitHub CLI / API |
| `nightlyGitHubUrl` | GitHub release page URL | GitHub CLI |
| `stableVersion` | `22.6` | Read from `gutenberg.php` or GitHub API |
| `stableReleaseUrl` | WordPress.org or GitHub release URL | Known URL pattern |
| `whatsNewUrl` | make.wordpress.org post URL | Fetched or manually set |
| `weekendEditionTitle` | Latest post title | WordPress REST API on gutenbergtimes.com |
| `weekendEditionUrl` | Latest post URL | WordPress REST API |
| `podcastTitle` | Latest episode title | WordPress REST API or RSS feed |
| `podcastUrl` | Latest episode URL | WordPress REST API or RSS feed |
### CLI Extension — New Command: `dist update-page`
**Step 1 — Collect dynamic values**
```js
- buildDate: format today's date as "Month D, YYYY"
- nightlyVersion: already set in gutenberg.php
- nightlyDownloadUrl: from GitHub release (already created by CLI)
- nightlyGitHubUrl: constructed from repo + tag
- stableVersion: read from gutenberg.php header
- weekendEditionUrl + title: GET /wp/v2/posts?categories=[id]&per_page=1
- podcastUrl + title: GET /wp/v2/podcast?per_page=1 (or parse RSS)
- whatsNewUrl: hardcoded per release OR fetched from make.wordpress.org RSS
```
**Step 2 — Generate block markup from template**
Store a template file in the repo at `templates/dynamic-zone.js`:
```js
export function buildDynamicZone(vars) {
  return `<!-- wp:group {"anchor":"dynamic-zone"} -->
<!-- wp:paragraph -->
<p><strong>${vars.buildDate}</strong></p>
<!-- /wp:paragraph -->
<!-- wp:list -->
<ul>
  <li><strong>Latest Weekend Edition:</strong> <a href="${vars.weekendEditionUrl}">${vars.weekendEditionTitle}</a></li>
  <li><strong>Latest podcast episode:</strong> <a href="${vars.podcastUrl}">${vars.podcastTitle}</a></li>
</ul>
<!-- /wp:list -->
<!-- wp:columns -->
<!-- wp:column -->
<!-- wp:buttons -->
<!-- wp:button {"url":"${vars.nightlyDownloadUrl}"} -->
<div class="wp-block-button"><a href="${vars.nightlyDownloadUrl}">Download Gutenberg Nightly</a></div>
<!-- /wp:button -->
<!-- /wp:buttons -->
<!-- wp:paragraph -->
<p>${vars.nightlyVersion}<br/><a href="${vars.nightlyGitHubUrl}">Also available on GitHub</a></p>
<!-- /wp:paragraph -->
<!-- /wp:column -->
<!-- wp:column -->
<!-- wp:buttons -->
<!-- wp:button {"url":"${vars.stableReleaseUrl}"} -->
<div class="wp-block-button"><a href="${vars.stableReleaseUrl}">Gutenberg ${vars.stableVersion}</a></div>
<!-- /wp:button -->
<!-- /wp:buttons -->
<!-- wp:list -->
<ul><li><a href="${vars.whatsNewUrl}">What's new in Gutenberg ${vars.stableVersion}?</a></li></ul>
<!-- /wp:list -->
<!-- /wp:column -->
<!-- /wp:columns -->
<!-- /wp:group -->`;
}
```
**Step 3 — Fetch current page content and replace the dynamic zone**
```js
// 1. GET the current page content
const page = await wpApi.get('/wp/v2/pages/15137');
// 2. Replace the dynamic zone using the anchor as boundary marker
const newContent = page.content.raw.replace(
  /<!-- wp:group \\{"anchor":"dynamic-zone"\\} -->[\\s\\S]*?<!-- \\/wp:group -->/,
  buildDynamicZone(vars)
);
// 3. POST the updated content back
await wpApi.post('/wp/v2/pages/15137', { content: newContent });
```
**Step 4 — Authenticate with WordPress REST API**
Use an Application Password (generated once in WP Admin → Profile → Application Passwords).
Store credentials in the CLI's existing `.env` or config file:
```
WP_API_URL=https://gutenbergtimes.com/wp-json
WP_USER=birgit
WP_APP_PASSWORD=xxxx xxxx xxxx xxxx xxxx xxxx
```
### File Structure Changes in the CLI repo
```
distribute-nightly/
  templates/
    dynamic-zone.js       ← NEW: block markup template
  src/
    commands/
      update-page.js      ← NEW: the new CLI command
    api/
      wordpress.js        ← NEW: thin WP REST API wrapper
      github.js           ← existing
  .env.example            ← add WP_API_URL, WP_USER, WP_APP_PASSWORD
```
### Integration into the existing build flow
Add `update-page` as the final step in the `dist now` command:
```
1. git merge upstream/trunk
2. Version bump in gutenberg.php
3. npm run build:plugin-zip
4. GitHub CLI: create/update release + upload gutenberg.zip
5. SFTP: upload zip to gutenbergtimes.com
6. [NEW] dist update-page   ← updates Page 1 via WP REST API
7. Open browser windows for verification
```
---
## Prerequisites / Things to Prepare Before the Session
- [ ] Generate a WordPress Application Password: WP Admin → Users → Profile → Application Passwords
- [ ] Decide on `whatsNewUrl` strategy: auto-fetch from make.wordpress.org RSS, or pass as a CLI argument per build?
- [ ] Confirm the Weekend Edition category ID and Podcast post-type slug in the WP REST API
- [ ] Create the two new draft pages manually in WP Admin before the coding session
- [ ] Manually add `anchor: "dynamic-zone"` to the Group block wrapping the dynamic section on Page 1