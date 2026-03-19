/**
 * Block markup template for the dynamic zone on the Gutenberg Nightly page.
 * Pure template — easy to edit if the layout changes.
 */

function buildDynamicZone(vars) {
    return `<!-- wp:group {"layout":{"type":"constrained"},"anchor":"dynamic-zone","hideFromFeed":true} -->
<div id="dynamic-zone" class="wp-block-group">
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
<ul><li><a href="${vars.whatsNewUrl}">What's new in Gutenberg ${vars.stableVersion}?</a></li></ul>
<!-- /wp:list -->
</div>
<!-- /wp:column -->
</div>
<!-- /wp:columns -->
</div>
<!-- /wp:group -->`;
}

module.exports = { buildDynamicZone };
