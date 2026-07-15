# Plan: `dist update-page` Command

## Context
The distribute-nightly CLI automates building and distributing Gutenberg Nightly. The Gutenberg Nightly WordPress page (page ID 15137) currently requires manual updates after each build. This command will auto-update the page's "dynamic zone" (a Group block with anchor `dynamic-zone`) via the WP REST API as the final step of each build.

## HTTP Client
Use Node.js built-in `fetch` (stable in Node 22.12.0, which is installed). No new dependency needed. Cleaner than wrapping `curl` via shelljs for REST API calls with JSON bodies and auth headers.

## New Files

### 1. `utils/wordpress.js` (~40 lines)
Thin WP REST API wrapper exporting `{ wpGet, wpPost }`.
- Reads `WP_API_URL`, `WP_USER`, `WP_APP_PASSWORD` from `process.env`
- Basic Auth: `Buffer.from('user:password').toString('base64')`
- Both functions include auth headers (needed for `?context=edit`)
- Throws on non-OK responses with status details

### 2. `templates/dynamic-zone.js` (~50 lines)
Exports `buildDynamicZone(vars)` — returns the block markup string for the dynamic zone. Pure template, easy to edit if layout changes.

### 3. `utils/update-page.js` (~120 lines)
The main command. Exported as async IIFE (matching git.js/sftp.js pattern).

**Step 1 — Collect dynamic values:**
| Variable | Source |
|---|---|
| `buildDate` | `new Date().toLocaleDateString(...)` → "March 19, 2026" |
| `nightlyVersion` | line-reader on `../gutenberg/gutenberg.php` Version field, formatted as `v-X.Y.YYYYMMDD` |
| `stableVersion` | First two segments of version string → `22.9` |
| `nightlyDownloadUrl` | `shell.exec('gh release view ...')` or constructed URL |
| `nightlyGitHubUrl` | `https://github.com/bph/gutenberg/releases/tag/{stableVersion}-nightly` |
| `stableReleaseUrl` | `https://wordpress.org/plugins/gutenberg/` (static) |
| `whatsNewUrl` | Fetch RSS from `make.wordpress.org/core/tag/gutenberg-new/feed/`, regex-match title with stable version |
| `weekendEditionUrl/Title` | `GET /wp/v2/posts?categories=64&per_page=1` on gutenbergtimes.com |
| `podcastUrl/Title` | `GET /wp/v2/podcast?per_page=1` on gutenbergtimes.com |

**Error handling:** Weekend Edition, Podcast, and whatsNewUrl fetches are wrapped in try/catch — on failure, log a yellow warning and use fallback values (generic links to the relevant sections). The page GET/POST calls fail hard with a clear error.

**Step 2 — Generate markup:** Call `buildDynamicZone(vars)`

**Step 3 — Replace dynamic zone on page:**
- `GET /wp/v2/pages/15137?context=edit` (returns `content.raw`)
- Regex replace: `<!-- wp:group {"anchor":"dynamic-zone"} -->...<!-- /wp:group -->`
- `POST /wp/v2/pages/15137` with `{ content: newContent }`

**Step 4 — Log success** with page URL in green.

## Modified Files

### 4. `utils/cli.js`
Add `'update-page'` to the `commands` object.

### 5. `index.js`
Add `require('./utils/update-page')` and route `input.includes('update-page')`.

### 6. `startend.js`
Add `runCommand('dist update-page', distributeNightlyDir)` after the `dist now` line.

## Implementation Order
1. `utils/wordpress.js`
2. `templates/dynamic-zone.js`
3. `utils/update-page.js`
4. `utils/cli.js` (one-liner)
5. `index.js` (two lines)
6. `startend.js` (one line)

## Verification
1. Run `dist update-page` standalone to test the page update in isolation
2. Verify the page content at https://gutenbergtimes.com/need-a-zip-from-master/
3. Then run the full `startend.js` flow to confirm integration
