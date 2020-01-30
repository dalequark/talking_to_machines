
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

const dialogflow = require('dialogflow');
const record = require('node-record-lpcm16');
const pump = require('pump');
const Transform = require('readable-stream').Transform;
const Speaker = require('speaker');
const { PassThrough } = require('stream');

const encoding = "LINEAR16";
const sampleRateHertz = 24000;
const micSampleRate = 16000;
const languageCode = "en-US";

class DialogflowStream {

    constructor(projectId, recordingProgram='sox', timeout=null) {
        this.sessionClient = new dialogflow.SessionsClient();
        this.projectId = projectId;
        this.timeout = timeout;
    	this.recordingProgram = recordingProgram;
    }

    _makeInitialStreamRequestArgs(sessionId) {
        // Initial request for Dialogflow setup
        const sessionPath = this.sessionClient.sessionPath(this.projectId, sessionId);
        return {
            session: sessionPath,
            queryInput: {
                audioConfig: {
                    audioEncoding: encoding,
                    sampleRateHertz: micSampleRate,
                    languageCode: languageCode,
                },
                singleUtterance: true,
            },
            outputAudioConfig: {
                audioEncoding: `OUTPUT_AUDIO_ENCODING_LINEAR_16`,
                sampleRateHertz: sampleRateHertz
            },
        };
    }

    getAudioFromTextInput(sessionId, text) {
        // Create a new session
        const sessionClient = new dialogflow.SessionsClient();
        const sessionPath = sessionClient.sessionPath(this.projectId, sessionId);

        // Kickoff with a request for trivia, so that the bot starts by
        // talking instead of the human
        const request = {
            session: sessionPath,
            queryInput: {
            text: {
                // The query to send to the dialogflow agent
                text: text,
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
        return new Promise(resolve => {
            sessionClient.detectIntent(request).then(responses => {
                console.log(`Fulfillment text: ${responses[0].queryResult.fulfillmentText}`);
                resolve(responses.length ? {"audio": responses[0].outputAudio, "queryResult": responses[0].queryResult} : {}); 
            }).catch((err) => {
                console.log("Error!", err);
                resolve({});

            });
        });
    }

    getAudio(sessionId) {
        const detectStream = this.sessionClient
            .streamingDetectIntent()
            .on('error', console.error)
    
        const recording = record
            .record({
                sampleRateHertz: micSampleRate,
                threshold: 0,
                verbose: false,
                recordProgram: this.recordingProgram, // Try also "arecord" or "sox"
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
    
        let queryResult;
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
                        console.log("Result Is Final");
                        recording.stop();
                    }
                } 
                if (data.queryResult) {
                    console.log(`Fulfillment text: ${data.queryResult.fulfillmentText}`);
                    queryResult = data.queryResult;
                }
                if (data.outputAudio && data.outputAudio.length) {
                    pumpStream.end();
                    resolve({"audio" : data.outputAudio, "queryResult" : queryResult});
                }
            });
    
            detectStream.write(this._makeInitialStreamRequestArgs(sessionId));
    
           // ... or resolve after 5 seconds if they say nothing
           if (this.timeout) {
                setTimeout(() => {
                    if (silent) {
                        recording.stop();
                        resolve({});
                    }
                }, this.timeout);
           }
        })
    }

    playAudio(audioBuffer, channels=1) {
        return new Promise(resolve => {
            // Setup the speaker for playing audio
            const speaker = new Speaker({
                channels: channels,
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

}

module.exports = DialogflowStream;
