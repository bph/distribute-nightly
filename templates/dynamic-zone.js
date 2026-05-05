/**
 * Block markup template for the dynamic zone on the Gutenberg Nightly page.
 * Pure template — easy to edit if the layout changes.
 */

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function renderBlockListItem(b) {
    return `<li><code>${escapeHtml(b.name)}</code> — ${escapeHtml(b.title)}</li>`;
}

function renderGroup({ label, blocks }) {
    const items = blocks.map(renderBlockListItem).join('\n');
    return `<li>${escapeHtml(label)}
<ul>
${items}
</ul>
</li>`;
}

function renderFlatList(blocks) {
    return `<!-- wp:list -->
<ul>
${blocks.map(renderBlockListItem).join('\n')}
</ul>
<!-- /wp:list -->`;
}

function renderBlockStatusSection(blockStatus) {
    if (!blockStatus || !Array.isArray(blockStatus.blocks)) return '';
    const items = blockStatus.blocks.filter(b => b.tier !== 'core' && !b.deprecated);
    if (items.length === 0) return '';

    const pluginOnly = items.filter(b => b.tier === 'plugin-only');
    const pendingCore = items.filter(b => b.tier === 'pending-core');
    const experiments = items.filter(b => b.tier === 'experiments');

    // Experiment blocks grouped by their human label, preserving first-seen order.
    const byExperiment = new Map();
    for (const b of experiments) {
        const label = b.experimentLabel || b.experiment || 'Experiments';
        if (!byExperiment.has(label)) byExperiment.set(label, []);
        byExperiment.get(label).push(b);
    }

    const sections = [];

    if (pluginOnly.length) {
        sections.push(`
<!-- wp:heading {"level":4} -->
<h4 class="wp-block-heading">Plugin-only</h4>
<!-- /wp:heading -->
${renderFlatList(pluginOnly)}`);
    }

    if (pendingCore.length) {
        sections.push(`
<!-- wp:heading {"level":4} -->
<h4 class="wp-block-heading">Pending Core sync</h4>
<!-- /wp:heading -->
${renderFlatList(pendingCore)}`);
    }

    if (byExperiment.size) {
        const groupItems = [...byExperiment.entries()]
            .map(([label, blocks]) => renderGroup({ label, blocks }))
            .join('\n');
        sections.push(`
<!-- wp:heading {"level":4} -->
<h4 class="wp-block-heading">On the Gutenberg Experiments page</h4>
<!-- /wp:heading -->
<!-- wp:paragraph -->
<p>To use any of these blocks, open <strong>Gutenberg → Experiments</strong> in wp-admin and turn on the matching toggle.</p>
<!-- /wp:paragraph -->
<!-- wp:list -->
<ul>
${groupItems}
</ul>
<!-- /wp:list -->`);
    }

    return `
<!-- wp:heading {"level":3,"anchor":"blocks-not-in-core"} -->
<h3 class="wp-block-heading" id="blocks-not-in-core">Blocks not yet in WordPress Core</h3>
<!-- /wp:heading -->
<!-- wp:paragraph -->
<p>${items.length} blocks ship in the Gutenberg plugin but are not in WordPress Core trunk.</p>
<!-- /wp:paragraph -->${sections.join('')}`;
}

function buildDynamicZone(vars) {
    return `<!-- wp:group {"layout":{"type":"constrained"},"anchor":"dynamic-zone","hideFromFeed":true} -->
<div id="dynamic-zone" class="wp-block-group">
<!-- wp:paragraph -->
<p><strong>${vars.buildDate}</strong></p>
<!-- /wp:paragraph -->
<!-- wp:list -->
<ul>
<li>🙌 <strong>Latest Weekend Edition:</strong> <a href="${vars.weekendEditionUrl}">${vars.weekendEditionTitle}</a></li>
<li>🎙️ <strong>Latest podcast episode:</strong> <a href="${vars.podcastUrl}">${vars.podcastTitle}</a></li>${vars.rcRelease ? `
<li>🧪 <a href="${vars.rcRelease.rcUrl}">Gutenberg ${vars.rcRelease.rcVersion} RC ${vars.rcRelease.rcNum}</a> is available for testing.</li>` : ''}
</ul>
<!-- /wp:list -->
<!-- wp:columns -->
<div class="wp-block-columns">
<!-- wp:column -->
<div class="wp-block-column">
<!-- wp:buttons -->
<div class="wp-block-buttons">
<!-- wp:button -->
<div class="wp-block-button"><a class="wp-block-button__link" href="${vars.nightlyDownloadUrl}">Download Gutenberg Nightly</a></div>
<!-- /wp:button -->
</div>
<!-- /wp:buttons -->
<!-- wp:paragraph -->
<p>${vars.nightlyVersion}<br><a href="${vars.nightlyGitHubUrl}">Also available on GitHub</a></p>
<!-- /wp:paragraph -->
</div>
<!-- /wp:column -->
<!-- wp:column -->
<div class="wp-block-column">
<!-- wp:buttons -->
<div class="wp-block-buttons">
<!-- wp:button -->
<div class="wp-block-button"><a class="wp-block-button__link" href="${vars.stableReleaseUrl}">Gutenberg ${vars.stableVersion}</a></div>
<!-- /wp:button -->
</div>
<!-- /wp:buttons -->
<!-- wp:list -->
<ul><li><a href="${vars.whatsNewUrl}">What's new in Gutenberg ${vars.stableMajorMinor}?</a></li>${vars.patchReleases.map(p => `
<li><a href="${p.url}">v${p.version}</a></li>`).join('')}</ul>
<!-- /wp:list -->
</div>
<!-- /wp:column -->
</div>
<!-- /wp:columns -->${renderBlockStatusSection(vars.blockStatus)}
</div>
<!-- /wp:group -->`;
}

module.exports = { buildDynamicZone };
