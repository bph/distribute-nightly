/**
 * sftp -o Port=2222 live.f5534b71-d1e9-4b6f-a86f-fa78778ad9cf@appserver.live.f5534b71-d1e9-4b6f-a86f-fa78778ad9cf.drush.in
 * 
 */

const ftp = require("basic-ftp");

module.exports = (async () => {

    example();

    async function example() {
        const client = new ftp.Client();
        client.ftp.verbose = true;
        
        try{
            await client.access({
                host: process.env.FTPhost,
                user: process.env.FTPuser,
                password: process.env.FTPpass,
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
