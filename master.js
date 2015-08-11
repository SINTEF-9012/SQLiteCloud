var express = require('express'),
    compression = require('compression'),
    morgan = require('morgan'),
    async = require('async'),
    cors = require('cors'),
    basicAuth = require('basic-auth-connect'),
    httpProxy = require('http-proxy');

var privateKey = require('./privateKey')();

var proxy = httpProxy.createProxyServer();

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

app.get('/', function(req, res) {
    proxy.web(req, res, { target: 'http://localhost:8080' });
});

var serverHostName = process.env.HTTP_HOSTNAME || '0.0.0.0';
var serverPort = process.env.HTTP_PORT || 8088;

var server = app.listen(serverPort, serverHostName, function() {
    console.log("Server started on http://"+serverHostName+":"+serverPort+"/");
});
