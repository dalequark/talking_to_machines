
const uuidv1 = require('uuid/v1');
const DialogflowStream = require('./DialogflowStream.js');
const cron = require('node-cron');
const moment = require('moment');
const textToSpeech = require('@google-cloud/text-to-speech');
const keypress = require('keypress');

async function createAlarmSound() {
    const ssml = `
    <speak>
        <audio src="https://actions.google.com/sounds/v1/alarms/bugle_tune.ogg"></audio>
        This is your alarm. It's time to wake up.
    </speak>`;
    return await tts(ssml);
}

function setCronAlarm(timeString, dfStream, alarmSound) {
    // Set an alarm to ring every day at the specified time
    currentAlarmMoment = moment(timeString);
    currentAlarm = cron.schedule(`${currentAlarmMoment.second()} ${currentAlarmMoment.minute()} ${currentAlarmMoment.hour()} * * *`,
        async () => {
            await dfStream.playAudio(alarmSound);
            console.log("Hello! It's your alarm!");
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
        voice: { languageCode: 'en-US', name: "en-US-Standard-E" },
        audioConfig: { audioEncoding: 'LINEAR16', sample_rate_hertz: 16000 },
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

    await dfStream.playAudio(audio);
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

    // Create an alarm sound
    alarmSound = await createAlarmSound();

    // Create a dialogflow stream that times out after 3 seconds
    const stream = new DialogflowStream(process.env.ALARM_PROJECT_ID, 3000);

    let conversing = true;
    while (conversing) {
        const res = await stream.getAudio(sessionId);
        if (res["audio"]) {
            await handleResponse(stream, res["audio"], res["queryResult"]);
        } else {
            conversing = false;
        }
    }
}

async function main() {

    keypress(process.stdin);
    process.stdin.on('keypress', async function (ch, key) {
        // TODO: This pause doesn't seem to be working
        process.stdin.pause();
        await stream();
        process.stdin.resume();
    });
}

main();