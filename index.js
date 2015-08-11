var express = require('express'),
    compression = require('compression'),
    morgan = require('morgan'),
    request = require('request'),
    cors = require('cors'),
    bodyParser = require('body-parser'),
    sqlite3 = require('sqlite3').verbose(),
    async = require('async'),
    basicAuth = require('basic-auth-connect'),
    child_process = require('child_process'),
    fs = require("fs");

var sqliteDbPath = process.env.DB_PATH || "SqliteCloud.db";

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

var db = new sqlite3.Database(sqliteDbPath);

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
    // This could be sensitive data but it's not like exposing
    // SQLite to internet was safe to begin with

    fs.stat(sqliteDbPath, function(err, stats){
        var data = {
            date: new Date(),
            memory: process.memoryUsage(),
            uptime: process.uptime()
        };
        if (err) {
            data.size = 0;
        } else {
            data.atime = stats.atime;
            data.ctime = stats.ctime;
            data.mtime = stats.mtime;
            data.size = stats.size
        }
        res.json(data);
    });
});

var dumpWorker = async.queue(function(task, callback) {
    task(callback);
}, Math.min(Math.round(process.env.NB_WORKERS || 2), 1));

var dumpTimeout = Math.min(Math.round(process.env.DUMP_TIMEOUT || 30000), 0);

app.get('/dump', function(req, res) {
    dumpWorker.push(function(callback) {
        var dumpProcess = child_process.spawn('sqlite3', [sqliteDbPath, '.dump'], {
            timeout: dumpTimeout
        });

        res.contentType('text/plain');
        dumpProcess.stdout.pipe(res);
        dumpProcess.on('exit', callback);
        dumpProcess.on('error', function(err){
            res.contentType('application/json');
            res.status(500).json({
                error: err
            });
            callback();
        })
    });
});


var execute = function(sql, method, params, res) {

    console.log("Executing "+method+": "+sql.slice(0, 80));

    var callback = function(err, data) {
        if (err) {
            res.status(500).json({error: err});
        } else if (data) {
            res.json(data);
        } else {
            res.json({status: 'ok'});
        }
    };

    if (method === 'exec' || !params) {
        db[method](sql, callback);
    } else {
        db[method](sql, params, callback);
    }
};

app.get(/^\/(get|all)$/, function(req, res) {
    var sql = req.query.sql;

    if (!sql) {
        res.status(400).json({error: 'The SQL command is missing'});
        return;
    }

    if (/^\s*(create|update|delete)\s+/i.test(sql)) {
        res.status(400).json({error: 'Use POST to change the database'});
        return;
    }

    delete req.query.sql;

    var method = req.url.match(/^\/(get|all)/)[1];
    execute(sql, method, req.query, res);
});

var textParser = bodyParser.text();
var jsonParser = bodyParser.json();

app.post(/^\/(exec|get|all|run)$/, jsonParser, textParser, function(req, res){
    var sql = typeof req.body === 'object' ? req.body.sql : req.body;

    if (!sql) {
        res.status(400).json({error: 'The SQL command is missing'});
        return;
    }

    var method = req.url.match(/^\/(exec|get|all|run)/)[1];
    execute(sql, method, req.body.params, res);
});

var serverHostName = process.env.HTTP_HOSTNAME || '0.0.0.0';
var serverPort = process.env.HTTP_PORT || 8080;

var server = app.listen(serverPort, serverHostName, function() {
    console.log("Server started on http://"+serverHostName+":"+serverPort+"/");
});
