const dialogflow = require('dialogflow');
const common = require('@google-cloud/common');
const record = require('node-record-lpcm16');
const uuidv1 = require('uuid/v1');
const pump = require('pump');
const Transform = require('readable-stream').Transform;
const fs = require('fs');
const Speaker = require('speaker');
const { PassThrough } = require('stream');

const projectId = process.env.PROJECT_ID;
const sessionClient = new dialogflow.SessionsClient();

const encoding = "LINEAR16";
const sampleRateHertz = 16000;
const languageCode = "en-US";

async function startTrivia(sessionId) {
    // Create a new session
    const sessionClient = new dialogflow.SessionsClient();
    const sessionPath = sessionClient.sessionPath(projectId, sessionId);

    // Kickoff with a request for trivia, so that the bot starts by
    // talking instead of the human
    const request = {
        session: sessionPath,
        queryInput: {
        text: {
            // The query to send to the dialogflow agent
            text: "Let's play trivia",
            // The language used by the client (en-US)
            languageCode: 'en-US',
        },
        },
        outputAudioConfig: {
            audioEncoding: `OUTPUT_AUDIO_ENCODING_LINEAR_16`,
            sampleRateHertz
        },
    };

    // Send request and log result
    const responses = await sessionClient.detectIntent(request);
    console.log(`Fulfillment text: ${responses[0].queryResult.fulfillmentText}`);
    return responses[0].outputAudio;
}

function makeInitialStreamRequestArgs(sessionId) {
    // Initial request for Dialogflow setup
    const sessionPath = sessionClient.sessionPath(projectId, sessionId);
    return {
        session: sessionPath,
        queryInput: {
            audioConfig: {
                audioEncoding: encoding,
                sampleRateHertz: sampleRateHertz,
                languageCode: languageCode,
            },
            singleUtterance: true,
        },
        outputAudioConfig: {
            audioEncoding: `OUTPUT_AUDIO_ENCODING_LINEAR_16`,
            sampleRateHertz,
        },
    };
}

function getAudio(sessionId) {
    const detectStream = sessionClient
        .streamingDetectIntent()
        .on('error', console.error)

    const recording = record
        .record({
            sampleRateHertz: 16000,
            threshold: 0,
            verbose: false,
            recordProgram: 'arecord', // Try also "arecord" or "sox"
            silence: '10.0',
        });

    const recordingStream = recording.stream()
        .on('error', console.error);
    
    const pumpStream = pump(
        recordingStream,
        // Format the audio stream into the request format.
        new Transform({
            objectMode: true,
            transform: (obj, _, next) => {
                next(null, { inputAudio: obj });
            },
        }),
        detectStream
    );

    return new Promise(resolve => {
        let silent = true

        // Try to get them to say stuff
        detectStream.on('data', data => {
            if (data.recognitionResult) {
                silent = false
                console.log(
                    `Intermediate transcript: ${data.recognitionResult.transcript}`
                );
                if (data.recognitionResult.isFinal) {
                    console.log("Got final result");
                    recording.stop();
                }
            } 
            if (data.queryResult) {
                console.log(`Fulfillment text: ${data.queryResult.fulfillmentText}`);
            }
            if (data.outputAudio && data.outputAudio.length) {
                resolve(data.outputAudio);
                pumpStream.end();
            }
        });

        detectStream.write(makeInitialStreamRequestArgs(sessionId));

        // ... or resolve after 5 seconds if they say nothing
        // setTimeout(() => {
        //     if (silent) {
        //         detectStream.end();
        //         // recording.stop();
        //         // pumpStream.end();
        //         resolve();
        //     }
        // }, 5000);
    })
}

function playAudio(audioBuffer) {
    return new Promise(resolve => {
        // Setup the speaker for playing audio
        const speaker = new Speaker({
            channels: 1,
            bitDepth: 16,
            sampleRate: sampleRateHertz,
        });
        
        speaker.on("close", () => {
            resolve();
        });

        // Setup the audio stream, feed the audio buffer in
        const audioStream = new PassThrough();
        audioStream.pipe(speaker);
        audioStream.end(audioBuffer);
    })
}

async function stream() {
    console.log('Listening, press Ctrl+C to stop.');
    // Create a new id for this session
    const sessionId = uuidv1();

    const welcomeAudio = await startTrivia(sessionId);
    await playAudio(welcomeAudio);

    let conversing = true;
    while (conversing) {
        const audio = await getAudio(sessionId);
        if (audio) {
            await playAudio(audio);
        } else {
            conversing = false
        }
    }
}

stream();