var spawn = require('child_process').spawn;
var https = require('https');
var Bacon = require('baconjs');
var _ = require('lodash');

var HOUMIO_SITEKEY = process.env.HOUMIO_SITEKEY;
var HOUMIO_SCENEID = process.env.HOUMIO_SCENEID;

var beaconScanCmd = spawn('./ibeacon_scan_debug', ['-b']);

function splitLines(bufferedData) {
	return Bacon.fromArray(bufferedData.toString('utf-8').split('\n'));
}

function isNotEmpty(line) {
	return !_.isEmpty(line);
}

var scannedBeaconsStream = Bacon.fromEventTarget(beaconScanCmd.stdout, 'data')
	.flatMap(splitLines)
	.filter(isNotEmpty)
	.skipDuplicates();

scannedBeaconsStream.take(1).onValue(applyScene);

function applyScene() {

	console.log('Scanned known BLE advertisement message. Applying scene...');

	var options = {
		method: 'PUT',
		hostname: 'houm.herokuapp.com',
		path: '/api/site/' + HOUMIO_SITEKEY + '/scene/apply',
		headers: {
			'Content-Type': 'application/json'
		}
	};

	var req = https.request(options, function(res) {
		console.log('STATUS: ' + res.statusCode);
	});
	req.write(JSON.stringify({
		_id: HOUMIO_SCENEID
	}));
	req.end();
}
