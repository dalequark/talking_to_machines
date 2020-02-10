
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

const uuidv1 = require('uuid/v1');
const DialogflowStream = require('../../js_utils/DialogflowStream');
const cron = require('node-cron');
const moment = require('moment');
const textToSpeech = require('@google-cloud/text-to-speech');
const dotenv = require('dotenv');
const keypress = require('keypress');

dotenv.config()

let button;

// If we're running on an AIY Voice Kit with a Raspbery Pi,
// configure the pushbutton.
if (process.env.RASPI) {
	const Gpio = require('onoff').Gpio;
	button = new Gpio(parseInt(process.env.BUTTON_PIN), 'in', 'rising', {debounceTimeout: 10});
}

// Calls the Text-to-Speech API to create audio data that can be played as an alarm sound.
async function createAlarmSound() {
    // SSML, or "Speech Synthesis Markup Language", is a way of specifying how text should
    // be converted to speech. Here, we use it to include a bugle sound along with 
    // a spoken message ("It's time to wake up...")
    const ssml = `
    <speak>
        <audio src="https://actions.google.com/sounds/v1/alarms/bugle_tune.ogg"></audio>
        This is your alarm. It's time to wake up.
    </speak>`;
    return await tts(ssml);
}

// Set an alarm to ring at time specified in timeString. dfStream
// gives this function access to the speaker. alarmSound should be 
// audio data that can be played through the speaker at alarm time.
function setCronAlarm(timeString, dfStream, alarmSound) {
    console.log("Setting an alarm for " + timeString);
    // Set an alarm to ring every day at the specified time
    currentAlarmMoment = moment(timeString);
    currentAlarm = cron.schedule(`${currentAlarmMoment.second()} ${currentAlarmMoment.minute()} ${currentAlarmMoment.hour()} * * *`,
        async () => {
            console.log("Hello this is your alarm wake up!");
            await dfStream.playAudio(alarmSound, 1);
        });
}

function deleteAlarm() {
    // Delete the existing alarm
    currentAlarm.destroy();
    currentAlarm = null;
    currentAlarmMoment = null;
}

// Given ssml (https://developers.google.com/assistant/actions/reference/ssml),
// calls the Text-to-Speech API and returns an audio data response.
async function tts(ssml) {
    const ttsClient = new textToSpeech.TextToSpeechClient();
    // Construct the request
    const request = {
        input: { ssml: ssml },
        voice: { languageCode: 'en-US', name: "en-US-Wavenet-D" },
        audioConfig: { audioEncoding: 'LINEAR16', sample_rate_hertz: 24000},
    };
    const [response] = await ttsClient.synthesizeSpeech(request);
    return response["audioContent"];
}

// Function that decides how to respond once a Dialogflow intent is matched.
async function handleResponse(dfStream, audio, queryResult) {
    const intent = queryResult.intent.displayName;
    // Check if the user mentioned a specific alarm time in their request
    const alarmTime = queryResult.parameters["fields"]["time"] ? queryResult.parameters["fields"]["time"]["stringValue"] : null;

    if (intent == LIST_ALARM) {
        let textIn = "You don't have an alarm set";
        if (currentAlarmMoment) {
            console.log(`Current alarm string is ${currentAlarmMoment}`);
            // If the user asks what time their alarm is set for, we need to
            // generate a response locally since alarm time (currentAlarmMoment)
            // is stored locally.
            textIn = `
            <speak>
                You have an alarm set for <say-as interpret-as="time">${currentAlarmMoment.hour()}:${currentAlarmMoment.minute()}</say-as>
            </speak>
            `;
        }
        // Instead of playing the audio response we get from Dialogflow,
        // we'll convert the text we generated above into speech and
        // play that instead.
        audio = await tts(textIn);
    }

    if (intent == SET_ALARM && alarmTime) {
        setCronAlarm(alarmTime, dfStream, alarmSound);
    }

    if (intent == DELETE_ALARM) {
        deleteAlarm();
    }

    if (intent == LIST_ALARM) {
    	await dfStream.playAudio(audio, 1);
    }
    else {
    	await dfStream.playAudio(audio, 1);
    }
    // The "end_conversation" flag lets us know whether we should expect
    // the user to keep speaking after we play or response or whether
    // the conversation is over and we can close the stream.
    if (queryResult.diagnosticInfo && queryResult.diagnosticInfo["fields"]["end_conversation"]) {
    	return false;
    }
    return true;
}

let currentAlarm;
let currentAlarmMoment;
let alarmSound;

const SET_ALARM = "setAlarm";
const LIST_ALARM = "listAlarm";
const DELETE_ALARM = "deleteAlarm";

async function stream() {

    console.log('Listening, press Ctrl+C to stop.');

    // Create a new id for this session
    const sessionId = uuidv1();

    // Create a dialogflow stream that times out after 3 seconds
    const stream = new DialogflowStream(process.env.ALARM_PROJECT_ID, 3000);

    let conversing = true;
    while (conversing) {
        const res = await stream.getAudio(sessionId);
        if (res["audio"]) {
            conversing = await handleResponse(stream, res["audio"], res["queryResult"]);
        } else {
            conversing = false;
        }
    }
}

async function main() {
	let inPress = false;
	console.log("Creating alarm sound from TTS API...");
	alarmSound = await createAlarmSound();
	console.log("Done");
	if (process.env.RASPI) {
		console.log("On Raspberry Pi, waiting for button press");
		button.watch(async (err, val) => {
			console.log("Got button press");
			if (inPress)	return;
			inPress = true;
			if (err) {
				console.log(err);
				return;
			}
			console.log("recording");
			await stream();
			console.log("done recording");
			inPress = false;
		});
	}
    
	keypress(process.stdin);
	process.stdin.on('keypress', async function (ch, key) {
		console.log("Got key press");
		if (inPress)	return;
		inPress = true;
		console.log("recording");
		await stream();
		console.log("done recording");
		inPress = false;
	    });
	}

	main();
