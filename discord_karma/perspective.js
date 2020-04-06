/**
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

 /* Example usage of some features of the Perspective API */
var googleapis = require('googleapis');

require('dotenv').config();

DISCOVERY_URL = 'https://commentanalyzer.googleapis.com/$discovery/rest?version=v1alpha1';

// Some attributes to try out
attributes = ["TOXICITY", "SEVERE_TOXICITY", "IDENTITY_ATTACK", "INSULT",
"PROFANITY", "THREAT", "SEXUALLY_EXPLICIT", "FLIRTATION", "SPAM", "ATTACK_ON_AUTHOR", 
"ATTACK_ON_COMMENTER", "INCOHERENT", "INFLAMMATORY", "OBSCENE", "SPAM", "UNSUBSTANTIAL"];

async function analyzeText(text) {
    let analyzer = new googleapis.commentanalyzer_v1alpha1.Commentanalyzer();

    let req = { comment: {text: text}, requestedAttributes: {'INCOHERENT': {}}};
    
    let res = await analyzer.comments.analyze({
        key: process.env.PERSPECTIVE_API_KEY, 
        resource: req}
    )

    return res['data']['attributeScores'];
}

async function main() {
    let score = await analyzeText("Gobbledy Gobbledy ding dong");
    console.log(score);
}

main();