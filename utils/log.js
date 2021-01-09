const alert = require('cli-alerts');

module.exports = (info) => {
    alert({
        type: `warning`,
        name: `Debug log`,
        msg: ``,
    })

    console.log(info);
    console.log();
}