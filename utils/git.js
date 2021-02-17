/**
 * Dealing with all GitHub stuff. 
 * 1. from the /gutenberg directory, push all changes to GitHub bph/gutenberg fork
 * 2. Compare the tags of the form to the tags of the wordpress/gutenberg. 
 *    If it's they have the same tag, we only upload newly build gutenberg.zip 
 *    to an existing release. If Gutenberg stable has higher tag than the 
 *    nightly we will create a new release tag and upload the asset. 
 * 
 * Directory structure: 
 * gb-nightly
 *      /gutenberg - bph/gutenberg = Form
 *      /distribute-nightly - bph/distribute-nightly = CLI
 * each with their own repo. 
 */
const shell = require('shelljs');
const { yellow: y, green: g } = require('chalk');

const upstream = 'wordpress/gutenberg';
const nightlyFork = 'bph/gutenberg';
const releaseAsset = '../gutenberg/gutenberg.zip';
const releaseNotes = '../gutenberg/nightlyrelease.md';

module.exports = (async () => {

    // First step is 
    // push changes to the github repo
    console.log(`Pushing all changes to github repo`);
    const pushtogithub = shell.exec(`cd ../gutenberg && git push origin master && cd ../distribute-nightly`);
    console.log(pushtogithub);
    console.log(`GitHub repo updated`);

    //I match up the tags for comparison. First nightly, then WordPress (upstream)
    // `gh release list -L 1 -R ${upstream}`
    // https://cli.github.com/manual/gh_release_list
    
    const ngtytag = shell.exec(`gh release list -L 1 -R ${nightlyFork}`);
    const nightlytag = ngtytag.split('\t')[2];
    const gbnightlytag = nightlytag.substring(0,4);
    
    console.log(`Nightly Tag: ${gbnightlytag}`);

    const upstreamtag = shell.exec(`gh release list -L 1 -R ${upstream}`);
    const lasttag = upstreamtag.split('\t')[2];
    const wptag = lasttag.substring(1,4);
    
    console.log(`WordPress Tag: ${wptag}`)

    if (parseInt(wptag) > parseInt(nightlytag)) {
       console.log(`${g(`Create a new release`)}`);
       const newrelease = shell.exec(`gh release create '${wptag}-nightly' '${releaseAsset}' --repo ${nightlyFork} --title 'Gutenberg Nightly' -F '${releaseNotes}'`);
       console.log(`${g(`New release created.`)}`)
       console.log(newrelease.stdout);
       console.log(newrelease.stderr);

    } 
    
    else { 
        console.log(`${y(`Will update the current asset for ${nightlytag}`)}`);
        const updateAsset = shell.exec(`gh release upload ${nightlytag} ${releaseAsset} --repo ${nightlyFork} --clobber`);
        console.log(`${g(`${releaseAsset} uploaded`)}`);
        console.log(updateAsset.stdout);
        console.log(updateAsset.stderr);

    }
  
});