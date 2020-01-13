// Copyright 2020 Google Inc.

// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at

//     http://www.apache.org/licenses/LICENSE-2.0

// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// APIs to control the button (and button LED) that's attached to the Vision
// Bonnet and Voice Bonnet/HAT's button connector.
// JS version of https://github.com/google/aiyprojects-raspbian/blob/aiyprojects/src/aiy/board.py

// Unofficial JS version of https://github.com/google/aiyprojects-raspbian/blob/aiyprojects/src/aiy/leds.py

const path = require("path");
const fs = require("fs");

const DEVICE_PATH = '/sys/class/leds/ktd202x:led1/device/';

function _write(path, data) {
    fs.writeFileSync(path, data);
}

function _deviceFile(prop) {
	return path.join(DEVICE_PATH, prop);
}

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


    static rgb(state, rgb) {
        // Creates a configuration for the RGB Channel: 1 (red), 2 (green), 3 (blue).
        return [
            new Channel(state, rgb[0]),
            new Channel(state, rgb[1]),
            new Channel(state, rgb[2])
        ]
    }

    static rgbOff() {
        // Creates an "off" configuration for the button's RGB LED.
        return Leds.rgb(Channel.OFF, Color.BLACK);
    }

    static rgbOn(rgb) {
        // Creates an "on" configuration for the button's RGB LED.
        return Leds.rgb(Channel.ON, rgb);
    }

    update(channels) {
        let command = '';
        for (let i = 0; i < channels.length; i++) {
            const channel= channels[i];
            if (channel.brightness != null) {
                command += `led${i+1}=${channel.brightness};`;
            }
            if (channel.state != null) {
                command += `ch${i+1}_enable=${channel.state};`;
            }
        }
        if (command) {
           _write(_deviceFile("registers"), command);
        }
    }

    reset() {
       _write(_deviceFile("reset"), 1);
    }
}

class Channel{
    constructor(state, brightness) {
        if (![Channel.OFF, Channel.ON, Channel.Pattern].includes(state)) {
            throw "State must be 0, 1, or 2.";
        }
        if (brightness < 0 || brightness > 255) {
            throw "Brightness must be in range [0,,255]";
        }
        this.state = state;
        this.brightness = brightness;
    }
}

Channel.OFF = 0
Channel.ON = 1
Channel.PATTERN = 2


module.exports.Leds = Leds;
module.exports.Channel = Channel;
module.exports.Color = Color;
