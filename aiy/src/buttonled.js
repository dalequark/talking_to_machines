const BUTTON_PIN = 23;

const Gpio = require('onoff').Gpio;
const {Leds, Channel, Color} = require('./Leds');
const button = new Gpio(BUTTON_PIN, 'in', 'rising', {debounceTimeout: 10});

const colors = [Color.RED, Color.BLUE, Color.CYAN, Color.YELLOW, Color.WHITE, Color.PURPLE];

const leds = new Leds();
leds.reset();

let i = 0;
button.watch((err, value) => {
	console.log("Got button press");
	if (i % 2 == 0) {
		leds.update(Leds.rgbOn(colors[i%colors.length]));
	}
	else {
		console.log("Turning leds off");
		leds.update(Leds.rgbOff());
	}
	i++;
});

