#!/usr/bin/env node

/**
 * distribute-nightly 
 * Steps to distribute the zip from master to GitHub and Gutenberg Times
 * 
 * @author Birgit Pauli-Haack <birgit.pauli@gmail.com>
 */
const init = require('./utils/init');
const cli  = require('./utils/cli');
const log  = require('./utils/log');
const git  = require('./utils/git');
const test = require('./utils/test');
const sftp = require('./utils/sftp');
const input = cli.input;
const flags = cli.flags;
const { clear, debug } = flags;

(async () =>{
    init({ clear });
    input.includes(`help`) && cli.showHelp(0);
    
    input.includes(`test`) && await test();

    if (input.includes(`git`)) {
        await git();
    }

    if (input.includes(`now`)) {
        await git();
        await sftp();
    }

    input.includes(`sftp`) && await sftp();

    debug && log(flags);

  
})();