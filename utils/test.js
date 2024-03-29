const shell = require('shelljs');
const { yellow: y, green: g, blue: b } = require('chalk');
const lineReader = require('line-reader');

const upstream = 'wordpress/gutenberg';
const nightlyFork = 'bph/gutenberg';

module.exports = (async () => {
        console.log(`I am test`);
        console.log(process.env.FTPuser);

        console.log(`${y(`Testing version comparison`)}`); 

        const ngtytag = shell.exec(`gh release list -L 1 -R ${nightlyFork}`);
        // TODO needs code if the status is NON-200 ie: 401 Unauthorized body: "{\"message\":\"Bad credentials\"
        // I updated my GitHub Token and needed to login via access token again: gh auth login -h github.com
        const nightlytag = ngtytag.split('\t')[2];
       
        //we read the file until we come to the line with the version. 
       lineReader.eachLine('../gutenberg/gutenberg.php', function(line){
            if (line.includes('Version')) {
                 let versionraw = line;
                 //console.log(versionraw);
                 let pos = versionraw.indexOf("Version: ") + 9;
                 let endstring = versionraw.length;
                 const version = versionraw.slice(pos, endstring);
                 console.log(`Local GB v. ${version.slice(0,5)}`)
                 console.log(`Latest GitHub v. ${nightlytag.slice(0,5)}`);

            if (version.slice(0,5) > nightlytag.slice(0,5))
                     {
                        console.log(`${g(` New version` )}`);
                    } else {
                        console.log(`${b(` Update asset` )}`);
        
                    }
                return false;
          }
        });


    });