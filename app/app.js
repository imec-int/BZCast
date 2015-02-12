#!/usr/bin/env node

var express = require('express');
var http = require('http')
var path = require('path');
var chromecast = require('chromecast')();
var utils = require('./utils');
var config = require('./config');
var FLAGS = require('./flags');
var socketio = require('socket.io');
var url = require('url');
var text2speech = require('./acapelavaas');

// parsing some data from the receiver url:
var receiverUrl = url.parse(config.chromecastApp.receiverurl);

var app = express();

app.configure(function(){
	app.set('port', receiverUrl.port?receiverUrl.port:80); // run express webserver on the port specified by the receiver url
	app.set('views', __dirname + '/views');
	app.set('view engine', 'jade');
	app.use(express.favicon());
	app.use(express.logger('dev'));
	app.use(express.bodyParser());
	app.use(express.methodOverride());
	app.use(express.cookieParser('webdial123456789987654321'));
	app.use(express.session());
	app.use(app.router);
	app.use(require('stylus').middleware(__dirname + '/public'));
	app.use(express.static(path.join(__dirname, 'public')));
});

app.configure('development', function(){
	app.use(express.errorHandler());
});

// Webserver:
var server = http.createServer(app).listen(app.get('port'), function(){
	console.log("Express server listening on port " + app.get('port'));
});

// Socket IO
var io = socketio.listen(server);
io.set('log level', 0);

// using the path extracted from the receiver-url in the config.js file so you don't have to do this manually
app.get(receiverUrl.path, function (req, res){
	res.render('receiver', {
		title: 'Receiver',
		Config: {
			APPID: config.chromecastApp.appid,
		}
	});
});






io.sockets.on('connection', function (socket) {
	console.log("> some socket client connected");
});


function connectToChromecastAndRunApp (appid, callback) {
	console.log('> connecting to chromecast');
	chromecast.on('device', function(device){
		device.launch(appid, {v:''}, callback);
	});

	chromecast.discover();
}







app.get('/simulator', function (req, res){
	res.render('simulator', {
		title: 'BZFlag simulator',
		players: ['_robby', 'Sam', 'm4tt'],
		flags: FLAGS
	});
});


app.post('/bzflag', function (req, res){
	// responsd immediatly:
	res.json('thx');

	var action = req.body.action;
	if(!action) return console.log('no action given');

	console.log(req.body);

	switch(action){
		case 'shotfired':
			if(!req.body.player) return console.log('no player given');
			shotFired(req.body.player);
			break;
		case 'flaggrabbed':
			if(!req.body.player) return console.log('no player given');
			if(!req.body.flag) return console.log('no flag given');
			flagGrabbed( req.body.player, req.body.flag );
			break;
		case 'flagdropped':
			if(!req.body.player) return console.log('no player given');
			flagDropped( req.body.player);
			break;
		case 'kill':
			if(!req.body.player) return console.log('no player given');
			if(!req.body.victim) return console.log('no victim given');
			playerKilled( req.body.player, req.body.victim);
			break;
		case 'part':
			if(!req.body.player) return console.log('no player given');
			playerLeft( req.body.player);
			break;
		case 'spawn':
			if(!req.body.player) return console.log('no player given');
			playerSpawn( req.body.player);
			break;
		case 'start':
			gameStart();
			break;
		case 'stop':
			gameStop();
			break;
		case 'gameend':
			gameEnd();
			break;
		case 'servermessage':
			serverMessage();
			break;
	}
});



// *********************
// *** BZFlag Events ***
// *********************

// state:
var players = {};

function addPlayer (playerid) {
	if(players[playerid]) return null; // already added

	players[playerid] = {
		id: playerid,
		name: playerid,
		score: 0,
		kills: 0,
		deaths: 0,
		flagcode: null,
		flagname: null,
		dead: true
	};

	return players[playerid];
}

function removePlayer (playername) {
	if(!players[playername]) return; // already removed

	delete players[playername];
}

function clearPlayerScores () {
	for(var playerid in players){
		players[playerid].kills = 0;
		players[playerid].deaths = 0;
		players[playerid].score = 0;
		players[playerid].flagcode = null;
		players[playerid].flagname = null;
		players[playerid].dead = true;
	}
}


function gameStart(){
	connectToChromecastAndRunApp(config.chromecastApp.appid, function (err) {
		if(err) return console.log(err);
		console.log("> chromecast app is running");

		clearPlayerScores();
		if(!io.sockets) return;
		for(var playerid in players){
			io.sockets.emit( 'player.update', players[playerid] );
		}

		setTimeout(function () {
			text2speech.getMp3( 'Let the games begin', function (err, mp3) {
				if(err) return console.log(err);
				io.sockets.emit( 'playsound', mp3);
			});
		},1000);
	});
}




function playerSpawn(playerid){
	var player = addPlayer(playerid);
	// victim's not dead anymore:
	players[playerid].dead = false;
	io.sockets.emit( 'player.update', players[playerid] );
}

function flagGrabbed(playerid, flagid){
	var flag = FLAGS[flagid];

	players[playerid].flagcode = (flag)?flag.code:flagid;
	players[playerid].flagname = (flag)?flag.name:flagid;
	io.sockets.emit( 'player.update', players[playerid] );

	var playername = config.playerid2playername[playerid];

	if(playername && flag.name){
		text2speech.getMp3( (flag.dangerous?'Watch out! ':'') + playername + ' has ' + flag.name, function (err, mp3) {
			if(err) return console.log(err);
			io.sockets.emit( 'playsound', mp3);
		});
	}
}

function flagDropped(playerid){
	players[playerid].flagcode = null;
	players[playerid].flagname = null;
	io.sockets.emit( 'player.update', players[playerid] );
}

function shotFired(playerid){
	io.sockets.emit( 'shotfired', players[playerid] );
}

function playerKilled(killerid, victimid){
	// victim looses flag:
	players[victimid].flagcode = null;
	players[victimid].flagname = null;

	// victem dies:
	players[victimid].dead = true;

	// victim looses points:
	players[victimid].deaths++;
	players[victimid].score = players[victimid].kills -  players[victimid].deaths;
	io.sockets.emit( 'player.update', players[victimid] );

	// killer wins score:
	players[killerid].kills++;
	players[killerid].score = players[killerid].kills -  players[killerid].deaths;
	io.sockets.emit( 'player.update', players[killerid] );
}

function playerLeft(playerid){
	io.sockets.emit( 'player.remove', playerid );
	removePlayer(playerid);
}

function gameStop (argument) {
	// body...
}

function gameEnd (argument) {
	// body...
}

function serverMessage (argument) {
	// body...
}

