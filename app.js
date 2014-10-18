var spawn = require('child_process').spawn;
var https = require('https');
var Bacon = require('baconjs');
var _ = require('lodash');

var HOUMIO_SITEKEY = process.env.HOUMIO_SITEKEY;
var HOUMIO_SCENEID = process.env.HOUMIO_SCENEID;
var OUTER_DOOR_BLE_UUID = process.env.OUTER_DOOR_BLE_UUID;
var INNER_DOOR_BLE_UUID = process.env.INNER_DOOR_BLE_UUID;
var IS_DEBUG_SCAN = process.env.IS_DEBUG_SCAN && process.env.IS_DEBUG_SCAN === 'on' ? true : false || false;
var IS_DEBUG_LOGGING = process.env.IS_DEBUG_LOGGING && process.env.IS_DEBUG_LOGGING === 'on' ? true : false || false;

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

function isAmongMonitoredUuids(uuid) {
	return uuid === OUTER_DOOR_BLE_UUID || uuid === INNER_DOOR_BLE_UUID;
}

function decorateWithTimestamp(uuid) {
	return {
		uuid: uuid,
		timestamp: Date.now()
	};
}

function isWithinSameDoorOpeningSession(previous, current, quietPeriodMs) {
	return current.timestamp - previous.timestamp < REQUIRED_QUIET_PERIODS_MS;
}

function isDuplicateDuringSameDoorOpeningSession(quietPeriodMs) {
	return function(previous, current) {
		return previous.uuid === current.uuid && isWithinSameDoorOpeningSession(previous, current, quietPeriodMs);
	}
}

function hasQuietPeriodPassed(quietPeriodMs) {
	return function(bleAdMessagesWithTime) {
		return bleAdMessagesWithTime.current.timestamp - bleAdMessagesWithTime.previous.timestamp >= quietPeriodMs;
	}
}

function toHumanReadable(uuidWithTimestamp) {
	var door = uuidWithTimestamp.uuid === OUTER_DOOR_BLE_UUID ? 'Outer door' : 'Inner door';
	return door + ' / ' + (new Date(uuidWithTimestamp.timestamp));
}

function debugLog(prefix, mappingFunc) {
	return function(val) {
		if (IS_DEBUG_LOGGING) {
			console.log('[' + prefix + ']', mappingFunc ? mappingFunc(val) : val);
		}
	}
}

function applyScene() {

	console.log('Entry detected. Applying scene...');

	var options = {
		method: 'PUT',
		hostname: 'houm.herokuapp.com',
		path: '/api/site/' + HOUMIO_SITEKEY + '/scene/apply',
		headers: {
			'Content-Type': 'application/json'
		}
	};

	var req = https.request(options, function(res) {
		if (res.statusCode === 200) {
			console.log('Scene applied successfully.')
		} else {
			console.log('Applying scene failed. Status code: ' + res.statusCode);
		}
	});
	req.write(JSON.stringify({
		_id: HOUMIO_SCENEID
	}));
	req.end();
}

var processToSpawn = IS_DEBUG_SCAN ? './ibeacon_scan_debug' : './ibeacon_scan';

console.log('Debug logging: ' + IS_DEBUG_LOGGING);
console.log('Debug scan: ' + IS_DEBUG_SCAN);
console.log('Turning on BLE device and starting entry detection...');
var beaconScanCmd = spawn(processToSpawn, ['-b']);
var allBeaconUuidStream = Bacon.fromEventTarget(beaconScanCmd.stdout, 'data')
	.flatMap(splitLines)
	.filter(isNotEmpty)
	.map(toUUID);

allBeaconUuidStream.take(1).onValue(function() {
	console.log('Entry detection in progress.');
});

var monitoredBeaconUuidAndTimestampStream = allBeaconUuidStream
	.filter(isAmongMonitoredUuids)
	.map(decorateWithTimestamp)
	.doAction(debugLog('ALL MONITORED', toHumanReadable))
	.skipDuplicates(isDuplicateDuringSameDoorOpeningSession(REQUIRED_QUIET_PERIODS_MS))
	.doAction(debugLog('NO DUPLICATES', toHumanReadable));

var monitoredBeaconUuidAndTimestampWithPreviousStream = monitoredBeaconUuidAndTimestampStream.skip(1)
	.zip(monitoredBeaconUuidAndTimestampStream, function(current, previous) {
		return {
			current: current,
			previous: previous
		};
	});

var quietPeriodControlStream = Bacon.once(true)
	.merge(monitoredBeaconUuidAndTimestampWithPreviousStream.map(hasQuietPeriodPassed(REQUIRED_QUIET_PERIODS_MS)));

var applySceneStream = quietPeriodControlStream
	.zip(monitoredBeaconUuidAndTimestampWithPreviousStream, function(hasQuietPeriodPassed, uuidsAndTimestamps) {
		return hasQuietPeriodPassed && uuidsAndTimestamps.previous.uuid === OUTER_DOOR_BLE_UUID && uuidsAndTimestamps.current.uuid === INNER_DOOR_BLE_UUID && 
			isWithinSameDoorOpeningSession(uuidsAndTimestamps.previous, uuidsAndTimestamps.current);
	})
	.filter(_.identity);

applySceneStream.onValue(applyScene);
