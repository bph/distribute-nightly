/**
 * dist update-page
 * Updates the dynamic zone on the Gutenberg Nightly page (ID 15137)
 * via the WordPress REST API.
 */
const shell = require('shelljs');
const { yellow: y, green: g } = require('chalk');
const lineReader = require('line-reader');
const open = require('open');
const { wpGet, wpPost } = require('./wordpress');
const { buildDynamicZone } = require('../templates/dynamic-zone');

const PAGE_ID = 15137;
const nightlyFork = 'bph/gutenberg';

function getVersionFromFile() {
    return new Promise((resolve, reject) => {
        lineReader.eachLine('../gutenberg/gutenberg.php', function (line) {
            if (line.includes('Version:')) {
                const pos = line.indexOf('Version: ') + 9;
                const version = line.slice(pos).trim();
                resolve(version);
                return false;
            }
        }, function (err) {
            if (err) reject(err);
        });
    });
}

async function fetchWhatsNewUrl(stableVersion) {
    try {
        const res = await fetch('https://make.wordpress.org/core/tag/gutenberg-new/feed/');
        const xml = await res.text();
        // Use major.minor for feed title matching (e.g. "22.8" from "22.8.1")
        const majorMinor = stableVersion.split('.').slice(0, 2).join('.');
        const re = new RegExp(`<item>\\s*<title>([^<]*${majorMinor.replace('.', '\\.')}[^<]*)</title>\\s*<link>([^<]+)</link>`);
        const match = xml.match(re);
        if (match) return match[2].trim();
    } catch (err) {
        console.log(`${y('Warning: Could not fetch What\'s New URL:')} ${err.message}`);
    }
    return `https://make.wordpress.org/core/tag/gutenberg-new/`;
}

async function fetchWeekendEdition() {
    try {
        const posts = await wpGet('/wp/v2/posts?categories=64&per_page=1');
        if (posts.length > 0) {
            return { weekendEditionTitle: posts[0].title.rendered, weekendEditionUrl: posts[0].link };
        }
    } catch (err) {
        console.log(`${y('Warning: Could not fetch Weekend Edition:')} ${err.message}`);
    }
    return { weekendEditionTitle: 'Weekend Edition', weekendEditionUrl: 'https://gutenbergtimes.com/category/weekend-edition/' };
}

async function fetchPodcast() {
    try {
        const episodes = await wpGet('/wp/v2/podcast?per_page=1');
        if (episodes.length > 0) {
            return { podcastTitle: episodes[0].title.rendered, podcastUrl: episodes[0].link };
        }
    } catch (err) {
        console.log(`${y('Warning: Could not fetch Podcast:')} ${err.message}`);
    }
    return { podcastTitle: 'Gutenberg Changelog', podcastUrl: 'https://gutenbergtimes.com/podcast/' };
}

async function fetchRcRelease(stableVersion) {
    try {
        // Next version after current stable (e.g., 22.7 → 22.8)
        const parts = stableVersion.split('.');
        let major = parseInt(parts[0]);
        let minor = parseInt(parts[1]) + 1;
        if (minor > 9) { major += 1; minor = 0; }
        const nextVersion = `${major}.${minor}`;

        const result = shell.exec(
            `gh release list -R WordPress/gutenberg -L 10 --json tagName,name,isPrerelease --jq '[.[] | select(.isPrerelease)]'`,
            { silent: true }
        );
        if (result.code !== 0) return null;

        const prereleases = JSON.parse(result.stdout);
        // Find the latest RC for the next version
        const rc = prereleases.find(r => r.tagName.startsWith(`v${nextVersion}.0-rc`));
        if (!rc) return null;

        // Extract RC number from tag like "v22.8.0-rc.1"
        const rcMatch = rc.tagName.match(/rc\.?(\d+)/);
        const rcNum = rcMatch ? rcMatch[1] : '1';

        console.log(`Found RC: ${rc.name} (${rc.tagName})`);
        return {
            rcVersion: nextVersion,
            rcNum,
            rcUrl: `https://github.com/WordPress/gutenberg/releases/tag/${rc.tagName}`,
        };
    } catch (err) {
        console.log(`${y('Warning: Could not check for RC releases:')} ${err.message}`);
        return null;
    }
}

module.exports = (async () => {
    console.log('Updating Gutenberg Nightly page...');

    // Step 1 — Collect dynamic values
    const fullVersion = await getVersionFromFile();
    // fullVersion is like "23.0.20260319" — this is the nightly version
    const nightlyVersion = `v-${fullVersion}`;
    const buildDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
    });

    // Stable version comes from WordPress.org, not gutenberg.php
    let stableVersion;
    try {
        const wpOrgRes = await fetch('https://api.wordpress.org/plugins/info/1.2/?action=plugin_information&request[slug]=gutenberg');
        const wpOrgData = await wpOrgRes.json();
        stableVersion = wpOrgData.version;
        console.log(`Stable Gutenberg version (from WP.org): ${stableVersion}`);
    } catch (err) {
        console.log(`${y('Warning: Could not fetch stable version from WP.org:')} ${err.message}`);
        // Fallback: use nightly major.minor minus 1
        const parts = fullVersion.split('.');
        stableVersion = `${parts[0]}.${parseInt(parts[1]) - 1}`;
        console.log(`${y('Using fallback stable version:')} ${stableVersion}`);
    }

    // Get the actual nightly release tag from GitHub (e.g. "23.0.-nightly")
    const tagResult = shell.exec(
        `gh release list -L 1 -R ${nightlyFork} --json tagName --jq '.[0].tagName'`,
        { silent: true }
    );
    const nightlyTag = tagResult.code === 0 ? tagResult.stdout.trim() : '';
    const nightlyGitHubUrl = `https://github.com/${nightlyFork}/releases/tag/${nightlyTag}`;

    // Get the download URL from the GitHub release
    let nightlyDownloadUrl;
    const ghResult = shell.exec(
        `gh release view ${nightlyTag} --repo ${nightlyFork} --json assets --jq '.assets[0].url'`,
        { silent: true }
    );
    if (ghResult.code === 0 && ghResult.stdout.trim()) {
        nightlyDownloadUrl = ghResult.stdout.trim();
    } else {
        nightlyDownloadUrl = `https://github.com/${nightlyFork}/releases/download/${nightlyTag}/gutenberg.zip`;
    }

    const stableReleaseUrl = 'https://wordpress.org/plugins/gutenberg/';

    // Fetch optional values (with fallbacks)
    const [whatsNewUrl, weekendEdition, podcast, rcRelease] = await Promise.all([
        fetchWhatsNewUrl(stableVersion),
        fetchWeekendEdition(),
        fetchPodcast(),
        fetchRcRelease(stableVersion),
    ]);

    // major.minor only for "What's new" link (e.g. "22.8" from "22.8.1")
    const stableParts = stableVersion.split('.');
    const stableMajorMinor = stableParts.slice(0, 2).join('.');
    // Patch release info (e.g. "22.8.1" — only when third component > 0)
    const patchRelease = stableParts.length > 2 && parseInt(stableParts[2]) > 0
        ? { version: stableVersion, url: `https://github.com/WordPress/gutenberg/releases/tag/v${stableVersion}` }
        : null;

    const vars = {
        buildDate,
        nightlyVersion,
        nightlyDownloadUrl,
        nightlyGitHubUrl,
        stableVersion,
        stableMajorMinor,
        stableReleaseUrl,
        whatsNewUrl,
        patchRelease,
        ...weekendEdition,
        ...podcast,
        rcRelease,
    };

    console.log(`Build date: ${buildDate}`);
    console.log(`Nightly version: ${nightlyVersion}`);
    console.log(`Stable version: ${stableVersion}`);

    // Step 2 — Generate markup
    const dynamicZone = buildDynamicZone(vars);

    // Step 3 — Replace dynamic zone on page
    const page = await wpGet(`/wp/v2/pages/${PAGE_ID}?context=edit`);
    const rawContent = page.content.raw;

    const dynamicZoneRegex = /<!-- wp:group \{.*?"anchor":"dynamic-zone".*?\} -->\s*<div [^>]*>[\s\S]*?<\/div>\s*<!-- \/wp:group -->/;

    if (!dynamicZoneRegex.test(rawContent)) {
        throw new Error('Could not find the dynamic-zone group block on the page. Make sure the anchor "dynamic-zone" is set on the Group block.');
    }

    const newContent = rawContent.replace(dynamicZoneRegex, dynamicZone);

    await wpPost(`/wp/v2/pages/${PAGE_ID}`, { content: newContent });

    // Step 4 — Log success and open page
    console.log(`${g('Page updated successfully!')}`);
    console.log(`${g('https://gutenbergtimes.com/need-a-zip-from-master/')}`);
    await open('https://gutenbergtimes.com/need-a-zip-from-master/');
});
