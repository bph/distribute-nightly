const meow = require('meow');
const meowHelp = require('cli-meow-help');

const flags = {
    clear: {
        type: `boolean`,
        default: true,
        alias: `c`,
        desc: `Clear the console`,
    },
    debug: {
        type: `boolean`,
        default: false,
        alias: `d`,
        desc: `Show debug info`,
    },
    version: {
        type: `boolean`,
        default: false,
        alias: `v`,
        desc: `Show version information`
    }
}

const commands = {
    help: {
        desc: `Print help info`,
    },
    test: {
        type: `boolean`,
        default: false,
        desc: 'runs test.js file'
    },
    now: {
        type: `boolean`,
        default: false,
        desc: `distributes the release asset`
    },
    sftp: {
        type: `boolean`,
        default: false,
        desc: `uploads gutenberg.zip to Gutenberg Times`
    },
    'update-page': {
        type: `boolean`,
        default: false,
        desc: `updates the Gutenberg Nightly page via WP REST API`
    }

}

const helpText = meowHelp({
    name: `dist`,
    flags, 
    commands,
})

const options = {
    inferType: true,
    description: false,
    hardRejection: false,
    flags,
}

module.exports = meow(helpText, options)