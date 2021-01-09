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
const input = cli.input;
const flags = cli.flags;
const { clear, debug } = flags;

(async () =>{
    init({ clear });
    input.includes(`help`) && cli.showHelp(0);

    await git();

    debug && log(flags);

  
})();