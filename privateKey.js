
module.exports = function() {
    // It's very secure by default
    var privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
        privateKey = require('generate-password').generate({
            length: 30,
            numbers: true
        });

        console.log("-----------------------------------------------------\n"+
            "Generated private key: "+privateKey+
            "\n-----------------------------------------------------\n");
    }
    return privateKey;
};
