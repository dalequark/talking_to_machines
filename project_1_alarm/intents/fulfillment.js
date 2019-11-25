/**
 * Copyright 2019 Google Inc. All Rights Reserved.
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

'use strict';

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { WebhookClient } = require('dialogflow-fulfillment');

process.env.DEBUG = 'dialogflow:*'; // enables lib debugging statements
admin.initializeApp(functions.config().firebase);
const db = admin.firestore();

const WELCOME_MESSAGE = "Good morning! Good morning! Wake up! It's time to answer some trivia questions.";

exports.dialogflowFirebaseFulfillment = functions.https.onRequest((request, response) => {
    const agent = new WebhookClient({ request, response });

    function writeAlarm(agent) {
        // Get parameter from Dialogflow with the string to add to the database
        const time = agent.parameters.time;

        // Get the database collection 'dialogflow' and document 'agent' and store
        // the document  {entry: "<value of database entry>"} in the 'agent' document
        const dialogflowAgentRef = db.collection('alarms').doc('alarm');
        return db.runTransaction(t => {
            t.set(dialogflowAgentRef, { time: time });
            return Promise.resolve('Write complete');
        }).then(doc => {
            agent.add(`Wrote "${time}" to the Firestore database.`);
        }).catch(err => {
            console.log(`Error writing to Firestore: ${err}`);
            agent.add(`Failed to write "${time}" to the Firestore database.`);
        });
    }

    function readAlarm(agent) {
        // Get the database collection 'dialogflow' and document 'agent'
        const dialogflowAgentDoc = db.collection('alarms').doc('alarm');

        // Get the value of 'entry' in the document and send it to the user
        return dialogflowAgentDoc.get()
            .then(doc => {
                if (!doc.exists) {
                    agent.add('No data found in the database!');
                } else {
                    agent.add(doc.data().time);
                }
                return Promise.resolve('Read complete');
            }).catch(() => {
                agent.add('Error reading entry from the Firestore database.');
                agent.add('Please add a entry to the database first by saying, "Write <your phrase> to the database"');
            });
    }

    function questionOne(agent) {
        console.log("Hello from question one");
        // Get the first question from the DB
        const dialogflowAgentDoc = db.collection('trivia').doc('1');
        // Track how we got to this question... is it because we started the quiz/
        // Because we got the question wrong?
        const lastState = agent.parameters.lastState;

        if (!lastState) {
            return dialogflowAgentDoc.get()
                .then(doc => {
                    if (!doc.exists) {
                        agent.add(`Error: question does not exist`);
                    } else {
                        agent.setContext({
                            name: 'quiz_data',
                            lifespan: 99,
                            parameters: {
                                current_question: doc.data().question,
                                current_answer: doc.data().answer
                            }
                        });
                        agent.add(WELCOME_MESSAGE + `Your first question is: ${doc.data().question}`);
                    }
                    return Promise.resolve('Read complete');
                }).catch(() => {
                    agent.add('Error reading entry from the Firestore database.');
                    agent.add('Please add a entry to the database first by saying, "Write <your phrase> to the database"');
                });
        }

        const context = agent.getContext('quiz_data');

        // We only get sent back to question one if the answer was wrong
        if (lastState == 'question-1.answer') {
            agent.add(`Sorry, wrong answer. ${context.parameters.current_question}`);
            return;
        }

        if (lastState == 'question-1.later') {
            agent.add(`No time for snoozing! ${context.parameters.current_question}`);
            return;
        }

        if (lastState == 'question-1.fallback') {
            agent.add(`Sorry, I didn't get that. ${context.parameters.current_question}`);
            return;
        }

        agent.add('Got to question-1 in a weird way. We should never get here!');

    }

    function questionOneLater(agent) {
        // If user tries to snooze, pop them back to question-1.
        agent.setFollowupEvent({
            "name": "question-1",
            "parameters": {
                "lastState": "question-1.later"
            },
            "languageCode": "en"
        }
        );
    }

    function questionOneFallback(agent) {
        // If user gives an invalid response, pop them back to question-1.
        agent.setFollowupEvent({
                "name": "question-1",
                "parameters": {
                    "lastState": "question-1.fallback"
                },
                "languageCode": "en"
            }
        );
    }

    function questionOneAnswer(agent) {
        const questionContext = agent.getContext('quiz_data');
        const question = questionContext.parameters.current_question;
        const answer = questionContext.parameters.current_answer;

        // Check the user's answer. If it's correct, send them to question-2.
        // Otherwise, send them back to question one.
        agent.setFollowupEvent({
            "name": (agent.parameters.answer == questionContext.parameters.current_answer ? "question-2" : "question-1"),
            "parameters": {
                "lastState": "question-1.answer"
            },
            "languageCode": "en"
        }
        );
        agent.add(`In questionOneAnswer with parameter "${agent.parameters}"`);

    }

    function questionTwo(agent) {

        // Get the second question from the DB
        const dialogflowAgentDoc = db.collection('trivia').doc('2');

        const lastState = agent.parameters.lastState;

        if (lastState == "question-1.answer") {
            return dialogflowAgentDoc.get()
                .then(doc => {
                    if (!doc.exists) {
                        agent.add(`Error: question does not exist`);
                    } else {
                        agent.setContext({
                            name: 'quiz_data',
                            lifespan: 99,
                            parameters: {
                                current_question: doc.data().question,
                                current_answer: doc.data().answer
                            }
                        });
                        agent.add(`Good job! Your second question is: ${doc.data().question}`);
                    }
                    return Promise.resolve('Read complete');
                }).catch(() => {
                    agent.add('Error reading entry from the Firestore database.');
                    agent.add('Please add a entry to the database first by saying, "Write <your phrase> to the database"');
                });
        }

        const context = agent.getContext('quiz_data');

        // We only get sent back to question one if the answer was wrong
        if (lastState == 'question-2.answer') {
            agent.add(`Sorry, wrong answer. ${context.parameters.current_question}`);
            return;
        }

        if (lastState == 'question-2.later') {
            agent.add(`No time for snoozing! ${context.parameters.current_question}`);
            return;
        }

        if (lastState == 'question-2.fallback') {
            agent.add(`Sorry, I didn't get that. ${context.parameters.current_question}`);
            return;
        }

        agent.add('Got to question-2 in a weird way. We should never get here!');

    }

    function questionTwoLater(agent) {
        // If user tries to snooze, pop them back to question-1.
        agent.setFollowupEvent({
            "name": "question-2",
            "parameters": {
                "lastState": "question-2.later"
            },
            "languageCode": "en"
        }
        );
    }

    function questionTwoFallback(agent) {
        // If user gives an invalid response, pop them back to question-2.
        agent.setFollowupEvent({
                "name": "question-2",
                "parameters": {
                    "lastState": "question-2.fallback"
                },
                "languageCode": "en"
            }
        );
    }

    function questionTwoAnswer(agent) {
        const questionContext = agent.getContext('quiz_data');
        const question = questionContext.parameters.current_question;
        const answer = questionContext.parameters.current_answer;

        // Check the user's answer. If it's correct, send them to question-2.
        // Otherwise, send them back to question one.
        agent.setFollowupEvent({
            "name": (agent.parameters.answer == questionContext.parameters.current_answer ? "question-3" : "question-2"),
            "parameters": {
                "lastState": "question-2.answer"
            },
            "languageCode": "en"
        }
        );
        agent.add(`In questionTwoAnswer with parameter "${agent.parameters}"`);

    }

    function questionThree(agent) {

        // Get the second question from the DB
        const dialogflowAgentDoc = db.collection('trivia').doc('3');

        const lastState = agent.parameters.lastState;

        if (lastState == "question-2.answer") {
            return dialogflowAgentDoc.get()
                .then(doc => {
                    if (!doc.exists) {
                        agent.add(`Error: question does not exist`);
                    } else {
                        agent.setContext({
                            name: 'quiz_data',
                            lifespan: 99,
                            parameters: {
                                current_question: doc.data().question,
                                current_answer: doc.data().answer
                            }
                        });
                        agent.add(`Good job! Your third question is: ${doc.data().question}`);
                    }
                    return Promise.resolve('Read complete');
                }).catch(() => {
                    agent.add('Error reading entry from the Firestore database.');
                    agent.add('Please add a entry to the database first by saying, "Write <your phrase> to the database"');
                });
        }

        const context = agent.getContext('quiz_data');

        // We only get sent back to question one if the answer was wrong
        if (lastState == 'question-3.answer') {
            agent.add(`Sorry, wrong answer. ${context.parameters.current_question}`);
            return;
        }

        if (lastState == 'question-3.later') {
            agent.add(`No time for snoozing! ${context.parameters.current_question}`);
            return;
        }

        if (lastState == 'question-3.fallback') {
            agent.add(`Sorry, I didn't get that. ${context.parameters.current_question}`);
            return;
        }

        agent.add('Got to question-3 in a weird way. We should never get here!');

    }

    function questionThreeLater(agent) {
        // If user tries to snooze, pop them back to question-2.
        agent.setFollowupEvent({
            "name": "question-3",
            "parameters": {
                "lastState": "question-3.later"
            },
            "languageCode": "en"
        }
        );
    }

    function questionThreeFallback(agent) {
        // If user gives an invalid response, pop them back to question-3.
      console.log("Hello from question three fallback");
        agent.setFollowupEvent({
                "name": "question-3.answer",
                "languageCode": "en"
            }
        );
    }

    function questionThreeAnswer(agent) {
      	console.log("Hello from question three answer handler");
        const questionContext = agent.getContext('quiz_data');
        const question = questionContext.parameters.current_question;
        const answer = questionContext.parameters.current_answer;

        // Check the user's answer. If it's correct, send them to question-3.
        // Otherwise, send them back to question one.
        agent.setFollowupEvent({
            "name": (agent.parameters.answer == questionContext.parameters.current_answer ? "trivia-done" : "question-3"),
            "parameters": {
                "lastState": "question-3.answer"
            },
            "languageCode": "en"
        }
        );
    }

    // Map from Dialogflow intent names to functions to be run when the intent is matched
    let intentMap = new Map();
    intentMap.set('set-alarm', writeAlarm);
    intentMap.set('question-1', questionOne);
    intentMap.set('question-1.fallback', questionOneFallback);
    intentMap.set('question-1.answer', questionOneAnswer);
    intentMap.set('question-1.later', questionOneLater);
    intentMap.set('question-2', questionTwo);
    intentMap.set('question-2.fallback', questionTwoFallback);
    intentMap.set('question-2.answer', questionTwoAnswer);
    intentMap.set('question-2.later', questionTwoLater);
    intentMap.set('question-3', questionThree);
    intentMap.set('question-3.fallback', questionThreeFallback);
    intentMap.set('question-3.answer', questionThreeAnswer);
    intentMap.set('question-3.later', questionThreeLater);
    agent.handleRequest(intentMap);
});