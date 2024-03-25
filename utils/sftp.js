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

 //previous version
module.exports = (async () => {
    
    let sftp = new Client();
    
    await sftp.connect(config)
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


//ChatCPT version 1
/* module.exports = async () => {
    let sftp = new Client();
    try {
        await sftp.connect(config);
        const localPath = path.join(localdir, releaseAsset);
        const remotePath = path.join(remotedir, releaseAsset);
        const data = await sftp.put(localPath, remotePath);
        console.log(data, 'Upload Successful: ');
    } catch (err) {
        console.error(err, 'Error during SFTP operation');
    } finally {
        try {
            await sftp.end();
        } catch (closeError) {
            console.error(closeError, 'Error closing SFTP connection');
        }
    }
}*/

//ChatGPT version 2 after npm update 
/*
module.exports = async () => {
  let sftp = new Client();
  try {
      await sftp.connect(config);
      const localPath = path.join(localdir, releaseAsset);
      const remotePath = path.join(remotedir, releaseAsset);
      const data = await sftp.put(localPath, remotePath);
      console.log(data, 'Upload Successful: ');
  } catch (err) {
      console.error(err, 'Error during SFTP operation');
  } finally {
      try {
          await sftp.end();
      } catch (closeError) {
          console.error(closeError, 'Error closing SFTP connection');
      }
  }
};
*/
