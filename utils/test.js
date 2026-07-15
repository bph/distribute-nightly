/**
 * dist test — preflight check for the nightly pipeline.
 * Verifies all credentials without writing anything:
 *   1. GitHub: read access to bph/gutenberg releases (GITHUB_TOKEN / gh auth)
 *   2. SFTP: connect + disconnect (FTPhost / FTPport / FTPuser / FTPpass)
 *   3. WordPress REST API: authenticated GET (WP_API_URL / WP_USER / WP_APP_PASSWORD)
 * Exits non-zero if any probe fails. Run after every PAT/credential renewal.
 */
const shell = require('shelljs');
const Client = require('ssh2-sftp-client');
const { wpGet } = require('./wordpress');

const nightlyFork = 'bph/gutenberg';

module.exports = (async () => {
    let failed = false;

    console.log(`Preflight 1/3: GitHub access to ${nightlyFork}...`);
    const gh = shell.exec(`gh release list -L 1 -R ${nightlyFork}`, { silent: true });
    if (gh.code === 0 && gh.stdout.trim()) {
        console.log(`  OK — latest release tag: ${gh.stdout.trim().split('\t')[2]}`);
    } else {
        console.log(`  FAILED: ${gh.stderr.trim() || 'no releases returned'}`);
        failed = true;
    }

    console.log('Preflight 2/3: SFTP connection...');
    const sftp = new Client();
    try {
        await sftp.connect({
            host: process.env.FTPhost,
            port: process.env.FTPport,
            username: process.env.FTPuser,
            password: process.env.FTPpass,
        });
        await sftp.end();
        console.log('  OK — connected and disconnected');
    } catch (err) {
        console.log(`  FAILED: ${err.message}`);
        failed = true;
    }

    console.log('Preflight 3/3: WordPress REST API...');
    try {
        const me = await wpGet('/wp/v2/users/me?context=edit');
        console.log(`  OK — authenticated as ${me.name || me.slug}`);
    } catch (err) {
        console.log(`  FAILED: ${err.message}`);
        failed = true;
    }

    if (failed) {
        console.log('Preflight FAILED — fix the credentials above before running the nightly.');
        process.exit(1);
    }
    console.log('Preflight passed — all credentials working.');
});
