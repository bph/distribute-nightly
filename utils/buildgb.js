const shell = require('shelljs');

module.exports = (async () => {
    const changeDir = shell.exec(`cd ../gutenberg`);
    const fetchUpstream = shell.exec(`git fetch upstream`);
    console.log(changeDir);
    console.log(fetchUpstream);
    // now we are in the gutenberg directory... 
    // 
});