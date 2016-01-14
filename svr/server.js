var fs = require('fs');
var path = require('path');
var http = require('http');
var args = require('optimist').argv;
var MongoClient = require('mongodb').MongoClient;
var ObjectId = require('mongodb').ObjectId;

// Parse command line arguments
var help = 'USAGE: ' + args.$0 + ' [-f FILES_DIRECTORY] [-p PORT_NO]'
if(args.h || args.help) {
    console.log(help);
    process.exit(0);
}

var filesDir = './files/';
var port = 8080;
if(args.f) {
    filesDir = args.f + '/';
}
if(args.p) {
    port = +args.p;
}

var reInterestGroups = /api\/interest_groups$/;
var reInterestGroup = /api\/interest_group\/([^\/]+)$/i;
var reCongressmen = /api\/congressmen$/;
var reCongressman = /api\/congressman\/([^\/]+)$/;
var reBills = /api\/bills$/;
var reList = [reInterestGroups, reInterestGroup, reCongressmen, reCongressman, reBills]
var dbUrl = 'mongodb://localhost:27017/mipdata'


// Server
var server = http.createServer(function(req, res) {
    console.log('Received request for ' + req.url);
    var match = null;
    var reMatch = null;
    if(req.url.startsWith('/api')) {
        for(var i = 0; i < reList.length; i++) {
            match = req.url.match(reList[i]);
            reMatch = reList[i];
            if(match !== null) break;
        }
        if(match !== null) {
            MongoClient.connect(dbUrl, function(err, db) {
                if(err) {
                    console.error('Unable to connect to database.');
                    res.writeHead(500, {'Content-Type': 'text/html'});
                    res.end('<h1><center>ERROR 500: Unable to access database</center></h1>');
                }
                else {
                    apiResponse(res, db, match, reMatch);
                }
            });
        }
        else {
            res.writeHead(404, {'Content-Type': 'text/html'});
            res.end('<h1><center>ERROR 404: No such api call</center></h1>');
        }
    }
    else {
        var filePath = filesDir + req.url;
        fs.stat(filePath, makeStatCallback(res, req, filePath, false));
    }
});

server.listen(port);
console.log('Serving on http://localhost:' + port + '/...');

function apiResponse(res, db, match, reMatch) {
    res.writeHead(200, {'Content-Type': 'application/json'});
    if(reMatch === reInterestGroups) {
        var cursor = db.collection('interest_groups').find();
        var groupNames = [];
        cursor.each(function(err, doc) {
            if(doc === null) {
                res.end(JSON.stringify(groupNames));
                db.close();
            }
            else {
                groupNames.push({'name': doc.name, 'id': doc._id}); 
            }
        });
    }
    else if(reMatch === reInterestGroup) {
        var interestGroupId = ObjectId(match[1]);
        db.collection('interest_groups').findOne({'_id': interestGroupId}, function(err, doc) {
            if(err || doc === null) {
                res.end('{}');
            }
            else {
                res.end(JSON.stringify(doc));
            }
            db.close();
        });
    }
    else if(reMatch === reCongressmen) {
        var cursor = db.collection('congressmen').find();
        var congressmenNames = [];
        cursor.each(function(err, doc) {
            if(doc === null) {
                res.end(JSON.stringify(congressmenNames));
                db.close();
            }
            else {
                congressmenNames.push({'name': doc.name, '_id': doc._id});
            }
        });
    }
    else if(reMatch === reCongressman) {
        var congressmanId = ObjectId(match[1]);
        db.collection('congressmen').findOne({'_id': congressmanId}, function(err, doc) {
            if(err || doc === null) {
                res.end('{}');
            }
            else {
                res.end(JSON.stringify(doc));
            }
            db.close();
        });
    }
    else if(reMatch == reBills) {
        var cursor = db.collection('bills').find();
        var billNames = [];
        cursor.each(function(err, doc) {
            if(doc === null) {
                res.end(JSON.stringify(billNames));
                db.close();
            }
            else {
                billNames.push({'name': doc.name, '_id': doc._id});
            }
        });
    }
    else {
        db.close();
    }
}

function makeStatCallback(res, req, filePath, isIndexed) {
    return function(err, stats) {
        if(!err) {
            if(!isIndexed && stats.isDirectory()) {
                filePath += '/index.html';
                fs.stat(filePath, makeStatCallback(res, req, filePath, true));
                return;
            }
            if(stats.isFile()) {
                respondFile(res, filePath);
            }
        }
        else {
            respond404(res, req);
        }
    };
}

function respond404(res, req) {
    console.log('Unable to find file');
    res.writeHead(404, {'Content-Type': 'text/html'});
    res.end('<h1><center>ERROR 404: File Not Found</center></h1>Unable to find <b>' + req.url.substring(1) + '</b> on server.');
}

function respondFile(res, filePath) {
    fs.readFile(filePath, function(err, content) {
        if(err) {
            console.error('Unable to serve file');
            res.writeHead(500, {'Content-Type': 'text/html'});
            res.end('<h1><center>ERROR 500: Unable to serve file</center></h1>Unable to serve <b>' +
                    req.url.substring(1) + '</b>. Try again later.');
            return;
        }
        console.log('Sending file...');
        res.writeHead(200, {'Content-Type': getMimetype(filePath)});
        res.end(content, 'utf-8');
    }); }

function getMimetype(filePath) {
    switch(path.extname(filePath)) {
        case '.html':
        case '.html':
            return 'text/html';
        case '.jpeg':
        case '.jpg':
            return 'image/jpeg';
        case '.png':
            return 'image/png';
        case '.css':
            return 'text/css';
        case '.js':
            return 'application/javascript';
        case '.pdf':
            return 'application/pdf';
        default:
            return 'text/plain';
    }
}

