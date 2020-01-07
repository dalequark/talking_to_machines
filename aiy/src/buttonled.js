const BUTTON_PIN = 23;
const LED_PIN = 25;

const fs = require('fs');
const Gpio = require('onoff').Gpio;
const led = new Gpio(LED_PIN, 'out');
const button = new Gpio(BUTTON_PIN, 'in', 'rising', {debounceTimeout: 10});
const path = require('path');

button.watch((err, value) => {
	console.log("Got button press");
	led.writeSync(value);
	});


const DEVICE_PATH = '/sys/class/leds/ktd202x:led1/device/';

function device_file(prop) {
	return path.join(DEVICE_PATH, prop);
}

function write(path, data) {
	fs.writeFileSync(path, data);	
}

function update(channels) {
	let command = '';
	for (let i = 0; i < channels.length; i++) {
		const channel = channels[i];
		if (channel["brightness"]) {
			command += `led${i+1}=${channel["brightness"]};`;
		}
		if (channel["state"]) {
			command += `ch${i}_enabled=${channel["state"]};`;
		}
	}
	if (command) {
		write(device_file("registers"), command);
	}
}

function rgb_off() {
	
}

function reset() {
	write(device_file("reset"), 1);
}

let channels = [
	{"brightness" : 0, "state" : 0},
	{"brightness" : 0, "state" : 0},
	{"brightness" : 0xFF, "state" : 1}
];

reset(channels);
update(channels);
