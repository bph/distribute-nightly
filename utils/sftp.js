/**
 * gutenbergtimes.com
 * local directory: /Users/pauli/gb-nightly/gutenberg/
 * remote directory: /srv/htdocs/wp-content/uploads/2020/11
 * Hosted at Pressable starting Dec 2023
 */

let Client = require('ssh2-sftp-client');
let path = require('path'); //new
const localdir = process.env.localDir;
const remotedir = '/srv/htdocs/wp-content/uploads/2020/11/';
const releaseAsset = 'gutenberg.zip';

const config = {
    host: process.env.FTPhost,
    port: process.env.FTPport,
    username: process.env.FTPuser,
    password: process.env.FTPpass
};

module.exports = (async () => {

    let sftp = new Client();

    try {
        await sftp.connect(config);
        const data = await sftp.put(`${localdir}${releaseAsset}`, `${remotedir}${releaseAsset}`);
        console.log(data, 'data: ');
    } catch (err) {
        console.error(err, 'catch error');
        await sftp.end().catch(() => {});
        process.exitCode = 1;
        return;
    }

    await sftp.end();
});
