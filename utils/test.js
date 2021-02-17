const shell = require('shelljs');
const { yellow: y, green: g, blue: b } = require('chalk');

const upstream = 'wordpress/gutenberg';
const nightlyFork = 'bph/gutenberg';

module.exports = (async () => {
        console.log(`I am test`);
        console.log(process.env);

        console.log(`${b(`Testing version comparison`)}`); 

        const ngtytag = shell.exec(`gh release list -L 1 -R ${nightlyFork}`);
        const nightlytag = ngtytag.split('\t')[2];
        const gbnightlytag = nightlytag.substring(0,4);
        
        console.log(`Nightly Tag: ${gbnightlytag}`);
    
        const upstreamtag = shell.exec(`gh release list -L 1 -R ${upstream}`);
        const lasttag = upstreamtag.split('\t')[2];
        const wptag = lasttag.substring(1,5);
        
        console.log(`WordPress Tag: ${wptag}`)
        if (parseInt(wptag) > parseInt(nightlytag)){
            console.log(`${g(`Create a new release`)}`);
        }
        else { 
                console.log(`${y(`Will update the current asset for ${nightlytag}`)}`);
        }    

    });