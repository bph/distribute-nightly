/**
 * 
 * local directory: /Users/birgit/gb-nightly/gutenberg/
 * remote directory: /files/2020/11/
 * 
 */

let Client = require('ssh2-sftp-client');
const localdir = '/Users/birgit/gb-nightly/gutenberg/';
const remotedir = '/files/2020/11/';
const releaseAsset = 'gutenberg.zip';

const config = {
    host: process.env.FTPhost,
    port: process.env.FTPport,
    username: process.env.FTPuser,
    password: process.env.FTPpass
}


module.exports = (async () => {
    
    let sftp = new Client();
    
    sftp.connect(config)
        .then(() => {
         return sftp.put(`${localdir}${releaseAsset}`, `${remotedir}${releaseAsset}`);
    }).then(data => {
      console.log(data, 'data: ');
    }).then(() => {
       sftp.end();
      })
    .catch(err => {
      console.log(err, 'catch error');
    });
});
