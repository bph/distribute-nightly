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
//const upstream = 'wordpress/gutenberg';
const nightlyFork = 'bph/gutenberg';
const releaseAsset = '../gutenberg/gutenberg.zip';
const releaseNotes = '../distribute-nightly/nightlyrelease.md';
    
module.exports = (async () => {

    // First step is 
    // push changes to the github repo
    console.log(`Pushing all changes to github repo`);
    const pushtogithub = shell.exec(`cd ../gutenberg && git push origin trunk && cd ../distribute-nightly`);
    console.log(pushtogithub.stderr);
    console.log(`GitHub repo updated`);

    //I match up the tags for comparison. First nightly, then WordPress (upstream)
    // `gh release list -L 1 -R ${upstream}`
    // https://cli.github.com/manual/gh_release_list
    
    const ngtytag = shell.exec(`gh release list -L 1 -R ${nightlyFork}`);
    if (ngtytag.code !== 0 || !ngtytag.stdout.trim()) {
        console.error('Failed to get GitHub releases:', ngtytag.stderr);
        return;
    }
    const nightlytag = ngtytag.split('\t')[2];
   // const gbnightlytag = nightlytag.substring(0,4);
    

    await new Promise((resolve, reject) => {
        lineReader.eachLine('../gutenberg/gutenberg.php', function(line){
            if (line.includes('Version')) {
                 let versionraw = line;
                 let pos = versionraw.indexOf("Version: ") + 9;
                 let endstring = versionraw.length;
                 const version = versionraw.slice(pos, endstring);
                 // Extract major.minor (e.g. "23.0" from "23.0.20260328")
                 const versionParts = version.match(/(\d+\.\d+)/);
                 const fileVersion = versionParts ? versionParts[1] : version;
                 const tagVersion = nightlytag.match(/(\d+\.\d+)/);
                 const nightlyVersion = tagVersion ? tagVersion[1] : nightlytag;
                 console.log(`gb version from file ${fileVersion}`)
                 console.log(`latest nightly version ${nightlyVersion}`);

                if (fileVersion > nightlyVersion)
                     {
                        console.log(`${g(` New version` )}`);
                        console.log(`${g(`Create a new release`)}`);
                        const newrelease = shell.exec(`gh release create '${fileVersion}-nightly' '${releaseAsset}' --repo ${nightlyFork} --title 'Gutenberg Nightly' -F '${releaseNotes}'`);
                        console.log(`${g(`New release created.`)}`)
                        console.log(newrelease.stdout);
                    } else {
                        console.log(`${y(`Updating the current asset for ${nightlytag}`)}`);
                        const updateAsset = shell.exec(`gh release upload ${nightlytag} ${releaseAsset} --repo ${nightlyFork} --clobber`);
                        console.log(`${g(`${releaseAsset} uploaded`)}`);
                        console.log(updateAsset.stdout);
                    }
                return false;
            }
        }, function(err) {
            if (err) reject(err);
            else resolve();
        });
    });

});