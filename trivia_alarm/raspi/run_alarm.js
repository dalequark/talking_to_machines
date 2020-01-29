
const uuidv1 = require('uuid/v1');
const DialogflowStream = require('../../js_utils/DialogflowStream');
const cron = require('node-cron');
const moment = require('moment');
const textToSpeech = require('@google-cloud/text-to-speech');
const dotenv = require('dotenv');
const keypress = require('keypress');

dotenv.config()

let button;

if (process.env.RASPI) {
	const Gpio = require('onoff').Gpio;
	button = new Gpio(parseInt(process.env.BUTTON_PIN), 'in', 'rising', {debounceTimeout: 10});
}

async function createAlarmSound() {
    const ssml = `
    <speak>
        <audio src="https://actions.google.com/sounds/v1/alarms/bugle_tune.ogg"></audio>
        This is your alarm. It's time to wake up.
    </speak>`;
    return await tts(ssml);
}

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

async function handleResponse(dfStream, audio, queryResult) {
    const intent = queryResult.intent.displayName;
    const alarmTime = queryResult.parameters["fields"]["time"] ? queryResult.parameters["fields"]["time"]["stringValue"] : null;

    if (intent == LIST_ALARM) {
        let textIn = "You don't have an alarm set";
        if (currentAlarmMoment) {
            console.log(`Current alarm string is ${currentAlarmMoment}`);
            textIn = `
            <speak>
                You have an alarm set for <say-as interpret-as="time">${currentAlarmMoment.hour()}:${currentAlarmMoment.minute()}</say-as>
            </speak>
            `;
        }
        // If we're listing the alarm, create a local audio response
        // rather than play the one returned from dialogflow
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
    if (queryResult.diagnosticInfo && queryResult.diagnosticInfo["fields"]["end_conversation"]["boolValue"]) {
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
