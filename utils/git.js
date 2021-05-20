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
const lineReader = require('line-reader');
const open = require('open');

const upstream = 'wordpress/gutenberg';
const nightlyFork = 'bph/gutenberg';
const releaseAsset = '../gutenberg/gutenberg.zip';
const releaseNotes = '../distribute-nightly/nightlyrelease.md';

module.exports = (async () => {

    // First step is 
    // push changes to the github repo
    console.log(`Pushing all changes to github repo`);
    const pushtogithub = shell.exec(`cd ../gutenberg && git push origin trunk && cd ../distribute-nightly`);
    console.log(pushtogithub);
    console.log(`GitHub repo updated`);

    //I match up the tags for comparison. First nightly, then WordPress (upstream)
    // `gh release list -L 1 -R ${upstream}`
    // https://cli.github.com/manual/gh_release_list
    
    const ngtytag = shell.exec(`gh release list -L 1 -R ${nightlyFork}`);
    const nightlytag = ngtytag.split('\t')[2];
    const gbnightlytag = nightlytag.substring(0,4);
    const refSite = 'https://icodeforapurpose.com/wp-admin/options-general.php?page=git-updater';
    const nightlySite = 'https://gutenbergtimes.com/wp-admin/post.php?post=15137&action=edit';
    
    console.log(`Nightly Tag: ${gbnightlytag}`);

    const upstreamtag = shell.exec(`gh release list -L 1 -R ${upstream}`);
    const lasttag = upstreamtag.split('\t')[2];
    const wptag = lasttag.substring(1,4);
    
    console.log(`WordPress Tag: ${wptag}`)


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
                        console.log(`${g(`Create a new release`)}`);
                        const newrelease = shell.exec(`gh release create '${version.slice(0,5)}-nightly' '${releaseAsset}' --repo ${nightlyFork} --title 'Gutenberg Nightly' -F '${releaseNotes}'`);
                        console.log(`${g(`New release created.`)}`)
                        console.log(newrelease.stdout);
                        console.log(newrelease.stderr);
                    } else {
                        console.log(`${y(`Updating the current asset for ${nightlytag}`)}`);
                        const updateAsset = shell.exec(`gh release upload ${nightlytag} ${releaseAsset} --repo ${nightlyFork} --clobber`);
                        console.log(`${g(`${releaseAsset} uploaded`)}`);
                        console.log(updateAsset.stdout);
                        console.log(updateAsset.stderr);
                    }
                return false;
          }
        });
        // and we open two websites 1) to update the page on GT and test a reference site. 

        await open(refSite);

        await open(nightlySite);
  
});