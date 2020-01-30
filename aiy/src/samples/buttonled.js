// Copyright 2020 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

const BUTTON_PIN = 23;

const Gpio = require('onoff').Gpio;
const {Leds, Channel, Color} = require('../Leds');
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

