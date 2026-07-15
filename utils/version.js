/**
 * Shared version math for the nightly scripts.
 * Gutenberg minor versions run 0–9, then roll over: 23.9 → 24.0.
 */
function nextMajorMinor(major, minor) {
    let nextMajor = major;
    let nextMinor = minor + 1;
    if (nextMinor > 9) {
        nextMajor += 1;
        nextMinor = 0;
    }
    return { major: nextMajor, minor: nextMinor };
}

module.exports = { nextMajorMinor };
