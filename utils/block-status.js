/**
 * dist block-status
 * Reads block.json files from the local Gutenberg checkout, detects experiment
 * gates by parsing block-library/src/index.js and lib/experimental/editor-settings.php,
 * compares against the WordPress Core block directory list (via a single
 * GitHub API call), and writes a classified snapshot to data/block-status.json.
 *
 * Tiers:
 *   - experiments  : block registration is gated on a `window.__experimentalEnable*`
 *                    global (i.e. behind the Experiments toggle)
 *   - plugin-only  : has top-level __experimental, not gated, not in Core
 *   - pending-core : no experimental flags, in Gutenberg but not in Core
 *   - core         : present in both Gutenberg and Core (or only in Core)
 *
 * Non-fatal: any error logs a warning and returns null so the build continues.
 */
const fs = require('fs');
const path = require('path');
const { yellow: y, green: g } = require('chalk');

const GUTENBERG_ROOT = path.resolve(__dirname, '../../gutenberg');
const GUTENBERG_BLOCKS_DIR = path.join(GUTENBERG_ROOT, 'packages/block-library/src');
const BLOCK_LIBRARY_INDEX = path.join(GUTENBERG_BLOCKS_DIR, 'index.js');
const EDITOR_SETTINGS_PHP = path.join(GUTENBERG_ROOT, 'lib/experimental/editor-settings.php');
const EXPERIMENTS_LOAD_PHP = path.join(GUTENBERG_ROOT, 'lib/experimental/experiments/load.php');
const CORE_BLOCKS_API = 'https://api.github.com/repos/WordPress/wordpress-develop/contents/src/wp-includes/blocks?ref=trunk';
const DATA_DIR = path.resolve(__dirname, '../data');
const OUTPUT_FILE = path.join(DATA_DIR, 'block-status.json');

function readGutenbergBlocks() {
    const entries = fs.readdirSync(GUTENBERG_BLOCKS_DIR, { withFileTypes: true });
    const blocks = [];
    for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const blockJsonPath = path.join(GUTENBERG_BLOCKS_DIR, entry.name, 'block.json');
        if (!fs.existsSync(blockJsonPath)) continue;
        try {
            const json = JSON.parse(fs.readFileSync(blockJsonPath, 'utf8'));
            blocks.push({ dir: entry.name, json });
        } catch (err) {
            console.log(`${y('Warning: Could not parse')} ${entry.name}/block.json: ${err.message}`);
        }
    }
    return blocks;
}

async function fetchCoreBlockDirs() {
    const headers = { 'User-Agent': 'gutenberg-times-nightly' };
    if (process.env.GITHUB_TOKEN) {
        headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    }
    const res = await fetch(CORE_BLOCKS_API, { headers });
    if (!res.ok) {
        throw new Error(`GitHub API ${res.status}: ${res.statusText}`);
    }
    const items = await res.json();
    return new Set(items.filter(i => i.type === 'dir').map(i => i.name));
}

/**
 * Parses block-library/src/index.js to find blocks gated behind
 * `if ( window?.__experimentalEnable<Name> ) { blocks.push( <id> ); ... }`.
 * Returns Map<dirName, globalName>.
 */
function parseExperimentGates() {
    const dirToGate = new Map();
    if (!fs.existsSync(BLOCK_LIBRARY_INDEX)) return dirToGate;
    const src = fs.readFileSync(BLOCK_LIBRARY_INDEX, 'utf8');

    // Map JS identifier → directory from `import * as <id> from './<dir>';`
    const idToDir = new Map();
    const importRe = /import\s+\*\s+as\s+(\w+)\s+from\s+['"]\.\/([\w-]+)['"]/g;
    for (const m of src.matchAll(importRe)) {
        idToDir.set(m[1], m[2]);
    }

    const gateRe = /if\s*\(\s*window\?\.__experimentalEnable(\w+)\s*\)\s*\{([\s\S]*?)\}/g;
    for (const m of src.matchAll(gateRe)) {
        const globalName = `__experimentalEnable${m[1]}`;
        const pushRe = /blocks\.push\(\s*(\w+)\s*\)/g;
        for (const p of m[2].matchAll(pushRe)) {
            const dir = idToDir.get(p[1]);
            if (dir) dirToGate.set(dir, globalName);
        }
    }
    return dirToGate;
}

/**
 * Parses lib/experimental/editor-settings.php to map a `window.__experimentalEnable*`
 * global to its experiment slug as used in `gutenberg_is_experiment_enabled('slug')`.
 * Returns Map<globalName, slug>.
 */
function parseExperimentSlugs() {
    const globalToSlug = new Map();
    if (!fs.existsSync(EDITOR_SETTINGS_PHP)) return globalToSlug;
    const src = fs.readFileSync(EDITOR_SETTINGS_PHP, 'utf8');
    const re = /gutenberg_is_experiment_enabled\(\s*['"]([\w-]+)['"]\s*\)[\s\S]*?window\.(\w+)\s*=/g;
    for (const m of src.matchAll(re)) {
        globalToSlug.set(m[2], m[1]);
    }
    return globalToSlug;
}

/**
 * Parses lib/experimental/experiments/load.php to map an experiment slug
 * to its human-readable label as shown on the wp-admin Experiments page.
 * Returns Map<slug, label>.
 */
function parseExperimentLabels() {
    const slugToLabel = new Map();
    if (!fs.existsSync(EXPERIMENTS_LOAD_PHP)) return slugToLabel;
    const src = fs.readFileSync(EXPERIMENTS_LOAD_PHP, 'utf8');
    const re = /'id'\s*=>\s*'([\w-]+)'\s*,\s*'label'\s*=>\s*__\(\s*'([^']+)'/g;
    for (const m of src.matchAll(re)) {
        slugToLabel.set(m[1], m[2]);
    }
    return slugToLabel;
}

function classify(block, coreDirs, dirToGate, globalToSlug, slugToLabel) {
    const { json, dir } = block;
    const inCore = coreDirs.has(dir);
    const gate = dirToGate.get(dir);
    const hasUnderscoreExperimental = json.__experimental === true || typeof json.__experimental === 'string';
    const deprecated = (json.description || '').toLowerCase().includes('deprecated');

    let tier;
    let experiment = null;
    let experimentLabel = null;
    if (gate) {
        tier = 'experiments';
        experiment = globalToSlug.get(gate) || gate;
        experimentLabel = slugToLabel.get(experiment) || null;
    } else if (hasUnderscoreExperimental && !inCore) {
        tier = 'plugin-only';
    } else if (!inCore) {
        tier = 'pending-core';
    } else {
        tier = 'core';
    }

    return {
        name: json.name || `core/${dir}`,
        title: json.title || dir,
        category: json.category || null,
        tier,
        experiment,
        experimentLabel,
        deprecated,
    };
}

async function getBlockStatus() {
    try {
        const gutenbergBlocks = readGutenbergBlocks();
        const dirToGate = parseExperimentGates();
        const globalToSlug = parseExperimentSlugs();
        const slugToLabel = parseExperimentLabels();
        const coreDirs = await fetchCoreBlockDirs();

        const blocks = gutenbergBlocks
            .map(b => classify(b, coreDirs, dirToGate, globalToSlug, slugToLabel))
            .sort((a, b) => a.name.localeCompare(b.name));

        const summary = blocks.reduce((acc, b) => {
            acc[b.tier] = (acc[b.tier] || 0) + 1;
            return acc;
        }, {});

        if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(blocks, null, 2));

        console.log(`${g('Block status:')} ${blocks.length} blocks scanned`);
        for (const tier of ['experiments', 'plugin-only', 'pending-core', 'core']) {
            console.log(`  ${tier}: ${summary[tier] || 0}`);
        }
        console.log(`  written to ${path.relative(process.cwd(), OUTPUT_FILE)}`);

        return { blocks, summary };
    } catch (err) {
        console.log(`${y('Warning: block-status step failed:')} ${err.message}`);
        return null;
    }
}

module.exports = getBlockStatus;
