/**
 * dist update-page
 * Updates the dynamic zone on the Gutenberg Nightly page (ID 15137)
 * via the WordPress REST API.
 */
const shell = require('shelljs');
const { yellow: y, green: g } = require('chalk');
const lineReader = require('line-reader');
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
        const re = new RegExp(`<item>\\s*<title>([^<]*${stableVersion.replace('.', '\\.')}[^<]*)</title>\\s*<link>([^<]+)</link>`);
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
        // Use major.minor only (e.g. "22.7" from "22.7.1")
        const stableParts = wpOrgData.version.split('.');
        stableVersion = `${stableParts[0]}.${stableParts[1]}`;
        console.log(`Stable Gutenberg version (from WP.org): ${stableVersion}`);
    } catch (err) {
        console.log(`${y('Warning: Could not fetch stable version from WP.org:')} ${err.message}`);
        // Fallback: use nightly major.minor minus 1
        const parts = fullVersion.split('.');
        stableVersion = `${parts[0]}.${parseInt(parts[1]) - 1}`;
        console.log(`${y('Using fallback stable version:')} ${stableVersion}`);
    }

    // Nightly release tag uses the stable version
    const nightlyGitHubUrl = `https://github.com/${nightlyFork}/releases/tag/${stableVersion}-nightly`;

    // Get the download URL from the GitHub release
    let nightlyDownloadUrl;
    const ghResult = shell.exec(
        `gh release view ${stableVersion}-nightly --repo ${nightlyFork} --json assets --jq '.assets[0].url'`,
        { silent: true }
    );
    if (ghResult.code === 0 && ghResult.stdout.trim()) {
        nightlyDownloadUrl = ghResult.stdout.trim();
    } else {
        nightlyDownloadUrl = `https://github.com/${nightlyFork}/releases/download/${stableVersion}-nightly/gutenberg.zip`;
    }

    const stableReleaseUrl = 'https://wordpress.org/plugins/gutenberg/';

    // Fetch optional values (with fallbacks)
    const [whatsNewUrl, weekendEdition, podcast] = await Promise.all([
        fetchWhatsNewUrl(stableVersion),
        fetchWeekendEdition(),
        fetchPodcast(),
    ]);

    const vars = {
        buildDate,
        nightlyVersion,
        nightlyDownloadUrl,
        nightlyGitHubUrl,
        stableVersion,
        stableReleaseUrl,
        whatsNewUrl,
        ...weekendEdition,
        ...podcast,
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

    // Step 4 — Log success
    console.log(`${g('Page updated successfully!')}`);
    console.log(`${g('https://gutenbergtimes.com/need-a-zip-from-master/')}`);
});
