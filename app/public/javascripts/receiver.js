var Receiver = function (options){
	var $messages = $('.messages');
	var $body = $('body');
	var socket = null;
	var players = {}; // will hold all player objects
	var audioEl = $('audio')[0];
	var sounds = [];

	var init = function () {
		initSocket();
	};

	var initSocket = function (){
		if(socket) return; // al geinitialiseerd

		// socket.io initialiseren
		socket = io.connect(window.location.hostname);
		// some debugging statements concerning socket.io
		socket.on('reconnecting', function(seconds){
			console.log('reconnecting in ' + seconds + ' seconds');
		});
		socket.on('reconnect', function(){
			console.log('reconnected');
		});
		socket.on('reconnect_failed', function(){
			console.log('failed to reconnect');
		});

		socket.on('player.update', onPlayerUpdate);
		socket.on('player.remove', onPlayerRemove);
		socket.on('playsound', onPlaySound);
		socket.on('playsounds', onPlaySounds);

		$(audioEl).bind('canplaythrough', onAudioLoaded);
		$(audioEl).bind('ended', onAudioEnded);
	};

	var addPlayer = function(playerdata) {
		var player = new Player(playerdata);
		players[player.id] = player; // add tot players
		var el = player.render();
		$("#players").append( el );
	};

	var onPlayerUpdate = function(playerdata) {
		console.log('updating player:');
		console.log(playerdata);

		if(!players[playerdata.id])
			addPlayer(playerdata);

		players[playerdata.id].update(playerdata);
	};

	var onPlayerRemove = function(playerid) {
		console.log('removing player: ' + playerid);

		players[playerid].remove();
		delete players[playerid];
	};

	var playSound = function (sound) {
		console.log('playSound: ' + sound);
		$(audioEl).attr('src', sound);
		audioEl.load();
	};

	var onAudioLoaded = function () {
		setTimeout(function () {
			console.log("audio loaded, playing");
			audioEl.play();
		},1000);
	};

	var onAudioEnded = function () {
		playNextSound();
	};

	var playNextSound = function () {
		// console.log('playNextSound');
		// console.log(sounds);
		if(sounds.length == 0) return;

		var sound = sounds.shift();
		playSound(sound);
	};

	var onPlaySound = function (sound) {
		playSound(sound);
	};

	var onPlaySounds = function (_sounds) {
		// console.log('onPlaySounds:');
		// console.log(_sounds);
		sounds = _sounds;
		playNextSound();
	};

	return {
		init: init
	};
};

var Player = function (playerdata) {
	var playerdata = playerdata;
	var el;
	var template = $("#player-tmpl");

	var render = function () {
		el = template.tmpl( playerdata );
		return el;
	};

	var update = function (newplayerdata) {
		// id
		// name
		// score
		// kills
		// deaths
		// flagcode
		// flagname
		// dead

		// score changes:
		if(playerdata.score != newplayerdata.score ){
			el.find('.score').html( newplayerdata.score );
			el.find('.killsanddeads').html( newplayerdata.kills + '-' + newplayerdata.deaths );
		}

		// flag changes:
		if(playerdata.flagcode != newplayerdata.flagcode){
			el.find('.flagcode').html( newplayerdata.flagcode );
			el.find('.flagname').html( newplayerdata.flagname );
		}

		// dead changes:
		if(playerdata.dead != newplayerdata.dead){
			if(newplayerdata.dead == true)
				el.addClass('dead');
			else
				el.removeClass('dead');
		}

		playerdata = newplayerdata;
	};

	var remove = function () {
		el.remove();
	};

	return {
		render: render,
		remove: remove,
		update: update,
		id: playerdata.id
	};
};


$(function(){
	var receiver = new Receiver();
	receiver.init();
});

