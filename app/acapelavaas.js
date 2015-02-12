var httpreq = require('httpreq');
var crypto = require('crypto');
var querystring = require('querystring');


var ACCOUNT_LOGIN = 'EVAL_VAAS';
var APPLICATION_LOGIN = 'EVAL_2746119';
var APPLICATION_PASSWORD = '7z5uymzy';

var req_voice = 'saul22k';

var lang = 'EN';
var gender = 'W';
var intonation = 'NORMAL';

exports.getMp3 = function (text, callback) {
	var concathash = text + '-' + lang + '-' + gender + '-' + intonation;
	var key = crypto.createHash('md5').update(concathash).digest('hex'); // zelf te kiezen

	var options = {
		'cl_env': 'PYTHON_2.X',
		'req_snd_id': key,
		'cl_login': ACCOUNT_LOGIN,
		'cl_vers': '1-30',
		'req_err_as_id3': 'yes',
		'req_voice': req_voice,
		'cl_app': APPLICATION_LOGIN,
		'prot_vers': '2',
		'cl_pwd': APPLICATION_PASSWORD,
		// 'req_asw_type': 'STREAM',
	}
	options.req_text = '\\vct=100\\ \\spd=160\\ ' + text;

	httpreq.get('http://vaas.acapela-group.com/Services/Synthesizer', {parameters: options}, function (err, res) {
		if(err) return callback(err);

		var data = querystring.parse(res.body);

		callback(null, data.snd_url);
	});

}