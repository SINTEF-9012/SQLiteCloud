var express = require('express'),
    compression = require('compression'),
    morgan = require('morgan'),
    async = require('async'),
    cors = require('cors'),
    basicAuth = require('basic-auth-connect'),
    httpProxy = require('http-proxy'),
    _ = require('lodash');

var privateKey = require('./privateKey')();



var app = express();

app.use(compression());
app.use(morgan('short'));
app.use(cors());
app.use(basicAuth(function(user, pass) {
    // We literally do not care about the username
    // Only the privateKey is checked
    // The username is still logged by morgan,
    // so it's not totally useless
    return pass === privateKey;
}));

var leafs = [{
    path: 'http://localhost:8082/leaf'
},
{
    path: 'http://localhost:8080/leaf'
}];

leafs.forEach(function(leaf) {

    var proxy = httpProxy.createProxyServer();
    proxy.on('error', function(err, req, res) {
        console.log('Error while contacting '+leaf.path);
        console.log('This leaf is removed');
        _.pull(leafs, leaf);
        res.status(502).json({error: err});
    });

    leaf.proxy = proxy;
});

var dispatchGet = function(req, res) {
    var selectedLeaf = _.sample(leafs);
    if (!selectedLeaf) {
        res.status(503).json({error: "No leaf server is available"});
    }
    selectedLeaf.proxy.web(req, res, {target: selectedLeaf.path});
};

app.get('/', dispatchGet)
   .get('/dump', dispatchGet)
   .get(/^\/(get|all)$/, dispatchGet);

var serverHostName = process.env.HTTP_HOSTNAME || '0.0.0.0';
var serverPort = process.env.HTTP_PORT || 8081;

var server = app.listen(serverPort, serverHostName, function() {
    console.log("Server started on http://"+serverHostName+":"+serverPort+"/");
});
