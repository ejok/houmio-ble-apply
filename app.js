var spawn = require('child_process').spawn;
var https = require('https');
var Bacon = require('baconjs');
var _ = require('lodash');

var HOUMIO_SITEKEY = process.env.HOUMIO_SITEKEY;
var HOUMIO_SCENEID = process.env.HOUMIO_SCENEID;
var OUTER_DOOR_BLE_UUID = process.env.OUTER_DOOR_BLE_UUID;
var INNER_DOOR_BLE_UUID = process.env.INNER_DOOR_BLE_UUID;

// quiet period separates door opening events from each other. that is needed
// as the BLE stickers may report quite many door opening events when a person
// enters to appartment.
var REQUIRED_QUIET_PERIODS_MS = 15 * 1000;

function splitLines(bufferedData) {
	return Bacon.fromArray(bufferedData.toString('utf-8').split('\n'));
}

function isNotEmpty(line) {
	return !_.isEmpty(line);
}

function toUUID(scanRow) {
	return scanRow.split(' ')[0];
}

function isAmongMonitoredUUIDs(uuid) {
	return uuid === OUTER_DOOR_BLE_UUID || uuid === INNER_DOOR_BLE_UUID;
}

function decorateWithTimestamp(uuid) {
	return {
		uuid: uuid,
		timestamp: Date.now()
	};
}

function hasQuietPeriodPassed(quietPeriodMs) {
	return function(bleAdMessagesWithTime) {
		return bleAdMessagesWithTime.current.timestamp - bleAdMessagesWithTime.previous.timestamp >= quietPeriodMs;
	}
}

function applyScene() {

	console.log('Someone is coming, turn on the lights!');

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

var beaconScanCmd = spawn('./ibeacon_scan_debug', ['-b']);
var scannedBleUUIDStream = Bacon.fromEventTarget(beaconScanCmd.stdout, 'data')
	.flatMap(splitLines)
	.filter(isNotEmpty)
	.map(toUUID)
	.filter(isAmongMonitoredUUIDs)
	.map(decorateWithTimestamp);

var scannedBleUUIDWithPreviousStream = scannedBleUUIDStream.skip(1)
	.zip(scannedBleUUIDStream, function(current, previous) {
		return {
			current: current,
			previous: previous
		};
	});

var quietPeriodControlStream = Bacon.once(true)
	.merge(scannedBleUUIDWithPreviousStream.map(hasQuietPeriodPassed(REQUIRED_QUIET_PERIODS_MS)));

var applySceneStream = quietPeriodControlStream
	.zip(scannedBleUUIDWithPreviousStream, function(hasQuietPeriodPassed, bleAdMessages) {
		return hasQuietPeriodPassed && bleAdMessages.previous.uuid === OUTER_DOOR_BLE_UUID && bleAdMessages.current.uuid === INNER_DOOR_BLE_UUID;
	})
	.filter(_.identity);

applySceneStream.onValue(applyScene);
