/**
 * 
 * local directory: /Users/birgit/gb-nightly/gutenberg/
 * remote directory: /files/2020/11/
 * 
 */

const ftp = require("basic-ftp");

module.exports = (async () => {

    example();

    async function example() {
        const client = new ftp.Client(timeout = 30000);
        client.ftp.verbose = true;
        
        try{
            await client.access({
                host: process.env.FTPhost,
                user: process.env.FTPuser,
                password: process.env.FTPpass,
                port: process.env.FTPport,
                secure: true
            });
            console.log(await client.list());
            await client.uploadFrom(`../gutenberg/gutenberg.zip`, `/files/2020/11/gutenberg.zip`);
        }
        catch(err) {
            console.log(err);
        }
        client.close();
    }
});
