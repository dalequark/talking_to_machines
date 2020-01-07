const BUTTON_PIN = 23;

const Gpio = require('onoff').Gpio;
const {Leds, Color} = require('./Leds');
const led = new Gpio(LED_PIN, 'out');
const button = new Gpio(BUTTON_PIN, 'in', 'rising', {debounceTimeout: 10});

function getRandomInt(max) {
	return Math.floor(Math.random() * Math.floor(max));
  }

const colors = [Colors.RED, Colors.BLUE, Colors.CYAN, Colors.YELLOW, Colors.WHITE, Colors.PURPLE];

button.watch((err, value) => {
	console.log("Got button press");
	leds.update(color[getRandomInt(colors.length)]);
});

const leds = Leds();

leds.reset();

