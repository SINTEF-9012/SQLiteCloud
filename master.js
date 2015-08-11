var express = require('express'),
    compression = require('compression'),
    morgan = require('morgan'),
    cors = require('cors'),
    basicAuth = require('basic-auth-connect'),
    rwlock = require('rwlock'),
    request = require('request'),
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

var lock = new rwlock();

var leafs = [{
    path: 'http://localhost:8082/leaf'
},
{
    path: 'http://localhost:8080/leaf'
}];

var dispatchGet = function(req, res, release) {
    var selectedLeaf = _.sample(leafs);
    if (!selectedLeaf) {
        res.status(503).json({error: "No leaf server is available"});
        release();
        return;
    }

    var stream = request.get(selectedLeaf.path+req.url).auth(req.user, privateKey, true);

    stream.on('error', function(err) {
        console.log('Error while contacting '+selectedLeaf.path);
        console.log('This leaf is removed');

        _.pull(leafs, selectedLeaf);


        if (req.nbDispatchRetry > 3) {
            console.log('3 retries and still no one leaf server is available')
            res.status(503).json({error: "No leaf server is available"});
            release();
            return;
        }

        console.log('We will try again');
        req.nbDispatchRetry = ++req.nbDispatchRetry || 1;
        dispatchGet(req, res, release);
        
    }).on('response', function(response) {
        stream.pipe(res);
        release();
    });
};

var lockDispatchGet = function(req, res) {
    lock.readLock(function(release) {
        dispatchGet(req, res, release);
    });
};


var dispatchPost = function(req, res, release) {
    // todo
};

var lockDispatchPost = function(req, res) {
    lock.writeLock(function(release) {
        dispatchPost(req, res, release);
    });
};

app.get('/', lockDispatchGet)
   .get('/dump', lockDispatchGet)
   .get(/^\/(get|all)$/, lockDispatchGet);

var serverHostName = process.env.HTTP_HOSTNAME || '0.0.0.0';
var serverPort = process.env.HTTP_PORT || 8081;

var server = app.listen(serverPort, serverHostName, function() {
    console.log("Server started on http://"+serverHostName+":"+serverPort+"/");
});
