const shell = require('shelljs');
const { yellow: y, green: g, blue: b } = require('chalk');
const lineReader = require('line-reader');

const upstream = 'wordpress/gutenberg';
const nightlyFork = 'bph/gutenberg';

module.exports = (async () => {
        console.log(`I am test`);
        console.log(process.env.FTPuser);

        console.log(`${b(`Testing version comparison`)}`); 

        const ngtytag = shell.exec(`gh release list -L 1 -R ${nightlyFork}`);
        const nightlytag = ngtytag.split('\t')[2];
        const gbnightlytag = nightlytag.substring(0,4);
        
        console.log(`Nightly Tag: ${gbnightlytag}`);
    
        const upstreamtag = shell.exec(`gh release list -L 1 -R ${upstream}`);
        const lasttag = upstreamtag.split('\t')[2];
        const wptag = lasttag.substring(1,5);
        
        console.log(`WordPress Tag: ${wptag}`);
    
        if (parseInt(wptag) > parseInt(nightlytag)){
            console.log(`${g(`Create a new release`)}`);
        }
        else { 
                console.log(`${y(`Will update the current asset for ${nightlytag}`)}`);
        }    

        console.log(`finding  the right version from gutenberg.php`);
     
        //we read the file until we come to the line with the version. 
       lineReader.eachLine('../gutenberg/gutenberg.php', function(line){
            if (line.includes('Version')) {
                 let versionraw = line;
                 console.log(versionraw);
                 let pos = versionraw.indexOf("Version: ") + 9;
                 let endstring = versionraw.length;
                 const version = versionraw.slice(pos, endstring);
                 console.log(`gb version from file ${version.slice(0,5)}`)
                 console.log(`latest nightly version ${nightlytag.slice(0,5)}`);

            if (version.slice(0,5) > nightlytag.slice(0,5))
                     {
                        console.log(`true - new version `);
                    } else {
                        console.log(` false update asset`);
        
                    }
                return false;
          }
        });


    });