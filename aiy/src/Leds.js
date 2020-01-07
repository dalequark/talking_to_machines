// Unofficial JS version of https://github.com/google/aiyprojects-raspbian/blob/aiyprojects/src/aiy/leds.py 

class Color {

    static blend(color_a, color_b, alpha) {
        // Creates a color that is a blend between two colors.
        return [0,1,2].map((i) => {
            Math.ceil(alpha * color_a[i] + (1.0 - alpha) * color_b[i]);
        });
    }
}

Color.BLACK  = [0x00, 0x00, 0x00];
Color.RED    = [0xFF, 0x00, 0x00];
Color.GREEN  = [0x00, 0xFF, 0x00];
Color.YELLOW = [0xFF, 0xFF, 0x00];
Color.BLUE   = [0x00, 0x00, 0xFF];
Color.PURPLE = [0xFF, 0x00, 0xFF];
Color.CYAN   = [0x00, 0xFF, 0xFF];
Color.WHITE  = [0xFF, 0xFF, 0xFF];

module.exports.Color = Color;

class Leds {
    /* Class to control the KTD LED driver chip in the button used with the
    Vision and Voice Bonnet. */
}

Leds.Channel = class {

    constructor(state, brightness) {
        if (![Channel.OFF, Channel.ON, Channel.Pattern].includes(state)) {
            throw "State must be 0, 1, or 2.";
        }
        if (brightness < 0 || brightness > 255) {
            throw "Brightness must be in range [0,,255]";
        }
        self.state = state;
        self.brightness = brightness;
    }

}

static rgb(state, rgb) {
	// Creates a configuration for the RGB channels: 0 (red), 1 (green), 2 (blue).
	return [
	    Leds.Channel(state, rgb[0]),
	    Leds.Channel(state, rgb[1]),
	    Leds.Channel(state, rgb[2])
	]
}

static rgb_off() {
	// Creates an "off" configuration for the button's RGB LED.
	return Leds.rgb(Leds.Channel.OFF, Color.BLACK);
}

static rgb_on(rgb) {
	// Creates an "on" configuration for the button's RGB LED.
	return Leds.rgb(Leds.Channel.ON, rgb);
}


function reset() {
	write(device_file("reset"), 1);
}

Leds.Channel.OFF = 0;
Leds.Channel.ON = 1;
Leds.Channel.PATTERN = 2;
