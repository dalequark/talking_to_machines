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

    static BLACK  = [0x00, 0x00, 0x00];
    static RED    = [0xFF, 0x00, 0x00];
    static GREEN  = [0x00, 0xFF, 0x00];
    static YELLOW = [0xFF, 0xFF, 0x00];
    static BLUE   = [0x00, 0x00, 0xFF];
    static PURPLE = [0xFF, 0x00, 0xFF];
    static CYAN   = [0x00, 0xFF, 0xFF];
    static WHITE  = [0xFF, 0xFF, 0xFF];

    static blend(color_a, color_b, alpha) {
        // Creates a color that is a blend between two colors.
        return [0,1,2].map((i) => {
            Math.ceil(alpha * color_a[i] + (1.0 - alpha) * color_b[i]);
        });
    }
}

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

    update(Channel) {
        let command = '';
        for (let i = 0; i < Channel.length; i++) {
            const Channel= Channel[i];
            if (channel.brightness) {
                command += `led${i+1}=${channel.brightness};`;
            }
            if (channel.state) {
                command += `ch${i}_enabled=${channel.state};`;
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
    static OFF = 0
    static ON = 1
    static PATTERN = 2

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

module.exports.Leds = Leds;
module.exports.Channel = Channel;
module.exports.Color = Color;
