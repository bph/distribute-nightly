
const shell = require('shelljs');
const { yellow: y, green: g } = require('chalk');


module.exports = (async () => {

    const upstream = 'wordpress/gutenberg';
    const nightlyFork = 'bph/gutenberg';
    const releaseAsset = '../gutenberg/gutenberg.zip';
    const releaseNotes = '../gutenberg/nightlyrelease.md';

    //I match up the tags for comparison. First nightly, then WordPress (upstream)
    // `gh release list -L 1 -R ${upstream}`
    // https://cli.github.com/manual/gh_release_list
    
    const ngtytag = shell.exec(`gh release list -L 1 -R ${nightlyFork}`);
    const nightlytag = ngtytag.split('\t')[2];
    const gbnightlytag = nightlytag.substring(0,5);
    
    console.log(`Nightly Tag: ${gbnightlytag}`);

    const upstreamtag = shell.exec(`gh release list -L 1 -R ${upstream}`);
    const lasttag = upstreamtag.split('\t')[2];
    const wptag = lasttag.substring(1,6);
    
    console.log(`WordPress Tag: ${wptag}`)

    if (wptag > nightlytag) {
       console.log(`${g(`Create a new release`)}`);
       const newrelease = shell.exec(`gh release create '${wptag}-nightly' '${releaseAsset}' --repo ${nightlyFork} --title 'Gutenberg Nightly' -F '${releaseNotes}'`);
       console.log(`${g(`New release created.`)}`)
       console.log(newrelease.stdout);
       console.log(newrelease.stderr);

    } else { 
        console.log(`${y(`Will update the current asset for ${nightlytag}`)}`);
        const updateAsset = shell.exec(`gh release upload ${nightlytag} ${releaseAsset} --repo ${nightlyFork} --clobber`);
        console.log(`${g(`${releaseAsset} uploaded`)}`);
        console.log(updateAsset.stdout);
        console.log(updateAsset.stderr);

    }
  
});