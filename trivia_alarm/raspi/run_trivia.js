
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
const dotenv = require('dotenv');

dotenv.config()

async function handleResponse(dfStream, audio, queryResult) {
    await dfStream.playAudio(audio, 1);
    if (queryResult.diagnosticInfo && queryResult.diagnosticInfo["fields"]["end_conversation"]) {
    	return false;
    }
    return true;
}

async function stream() {

    console.log('Listening, press Ctrl+C to stop.');

    // Create a new id for this session
    const sessionId = uuidv1();

    const stream = new DialogflowStream(process.env.TRIVIA_PROJECT_ID);
    const res = await stream.getAudioFromTextInput(sessionId, "Let's play trivia");
    await handleResponse(stream, res["audio"], res["queryResult"]);

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

stream();