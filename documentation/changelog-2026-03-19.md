# Changes — March 19, 2026

## New command: `dist update-page`
- Auto-updates the Gutenberg Nightly page (ID 15137) via the WordPress REST API
- Replaces the "dynamic zone" Group block content with current build info
- New files: `utils/wordpress.js` (WP REST API wrapper), `utils/update-page.js` (command logic), `templates/dynamic-zone.js` (block markup template)
- Added `update-page` to CLI commands in `utils/cli.js` and routing in `index.js`
- Integrated as final step in `startend.js` after `dist now`

## Dynamic zone content
- Build date, nightly version, stable Gutenberg version (fetched from WordPress.org API)
- Latest Weekend Edition post (from gutenbergtimes.com REST API, category 64)
- Latest podcast episode (from gutenbergtimes.com `/wp/v2/podcast`)
- What's New link (fetched from make.wordpress.org RSS feed)
- Download button with GitHub release asset URL
- "Also available on GitHub" link
- RC release detection: if an RC exists on WordPress/gutenberg for the next version, a list item with a link to the RC release is added automatically
- Emojis: 🙌 for Weekend Edition, 🎙️ for podcast, 🧪 for RC

## Automated nightly version bump
- `startend.js` now reads the upstream milestone from `upstream/trunk:gutenberg.php`, bumps minor version by 1, appends today's date (e.g., `22.9` upstream becomes `23.0.20260319`)
- Commits the version change automatically — no more manual editing of `gutenberg.php`

## Automatic merge conflict resolution
- When merging `upstream/trunk` causes a conflict only in `gutenberg.php`, the script resolves it by keeping the nightly version (`--ours`) and continues
- If conflicts exist in other files, the script stops and asks for manual resolution

## Bug fixes and improvements
- Fixed `git.js`: wrapped `lineReader.eachLine` in a Promise so GitHub release creation/upload output appears in correct order before SFTP and update-page steps
- Changed `git.js` to open the front-end page URL instead of the block editor after build
- Stable Gutenberg version is now fetched from the WordPress.org plugin API instead of being derived from `gutenberg.php` (which contains the nightly version)
