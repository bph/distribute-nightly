const welcome = require('cli-welcome');
const pkg = require('../package.json');
const unhandled = require('cli-handle-unhandled');
const env = require('dotenv').config();

module.exports = ({ clear = true }) => {
    unhandled();
    welcome({
        title: 'distribute-nightly ',
        tagline: 'by Birgit Pauli-Haack',
        description: pkg.description,
        version: pkg.version,
        bgcolor:'#6cc24a',
        color: '#000000',
        bold: true, 
        clear,

    })
}