const BUTTON_PIN = 23;

const Gpio = require('onoff').Gpio;
const {Leds, Channel, Color} = require('./Leds');
const button = new Gpio(BUTTON_PIN, 'in', 'rising', {debounceTimeout: 10});

function getRandomInt(max) {
	return Math.floor(Math.random() * Math.floor(max));
  }

const colors = [Color.RED, Color.BLUE, Color.CYAN, Color.YELLOW, Color.WHITE, Color.PURPLE];

const leds = new Leds();

leds.reset();

button.watch((err, value) => {
	console.log("Got button press");
	leds.update(colors[getRandomInt(colors.length)]);
});
