/* eslint-disable require-jsdoc */
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

/* jshint esversion: 8 */
'use strict';

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const {WebhookClient} = require('dialogflow-fulfillment');

process.env.DEBUG = 'dialogflow:*'; // enables lib debugging statements
admin.initializeApp(functions.config().firebase);
const db = admin.firestore();

const WELCOME_MESSAGE = `Good morning! Good morning! Wake up! 
It\'s time to answer some trivia questions.`;

const NUM_QUESTIONS = 3;

// TODO: Add users. For now, we'll use a dummy id.
const USER_ID = '3HGBBSXFlwArhH5MbvHb';

function extractNumber(answer) {
  const result = answer.match(/\d+/);
  return result ? result[0] : null;
}

async function getQuestionsAnsweredIndex(userId) {
  return 1;
//   const userDoc = await db.collection('users').doc(userId).get();
//   if (!userDoc.exists) {
//     console.log(
//         `Error: user documemt ${userId} doesn't exist in collection "users"`);
//     return -1;
//   }
//   return userDoc.data().questionIndex;
}

async function updateQuestionsAnsweredIndex(userId, index) {
//   await db.collection('users').doc(userId).update({
//     'questionIndex': index,
//   });
}

async function getQuestion() {
  let questionIndex = await getQuestionsAnsweredIndex(USER_ID);
  console.log(`Got question index ${questionIndex}`);

  let question =
    await db.collection('trivia').doc((questionIndex+1).toString()).get();

  if (!question.exists) {
    // This means we've run out of questions and need to wrap around.
    console.log('Ran out of questions, needed to wrap');
    questionIndex = 0;
    question =
        await db.collection('trivia').doc((questionIndex+1).toString()).get();
  }

  console.log(`Pulled question ${question.data().question} with answer ${question.data().answer}`);
  await updateQuestionsAnsweredIndex(USER_ID, questionIndex+1);

  return question ? question.data() : null;
}

exports.dialogflowFirebaseFulfillment =
functions.https.onRequest((request, response) => {
  const agent = new WebhookClient({request, response});


  function setQuestionContext(question) {
    const oldContext = agent.context.get('quiz_data');
    console.log('Setting question context. Old context was ', oldContext);
    console.log(`Setting question context with new question ${question.question}`);
    console.log(`Setting question context with qusetions correct ${ oldContext ? oldContext.parameters.questions_correct : 0}`);
    const questionsCorrect =
        oldContext ? oldContext.parameters.questions_correct : 0;
    agent.context.set({
      name: 'quiz_data',
      lifespan: 99,
      parameters: {
        question: question ? question.question : null,
        answer: question ? question.answer : null,
        questions_correct: questionsCorrect,
      },
    });
  }

  async function askQuestion(agent) {
    console.log('Hello from Ask Question');

    const lastState = agent.parameters.lastState;
    console.log(`Last state was ${lastState}`);

    if (!lastState) {
      // Set up the first question
      const question = await getQuestion();
      setQuestionContext(question);
      console.log('Adding message to agent');
      agent.add(`${WELCOME_MESSAGE}
      You're first question is ${question.question}`);
      return;
    }

    const context = agent.context.get('quiz_data');
    console.log('In ask question, got context ', context);

    if (context.parameters.questions_correct == NUM_QUESTIONS) {
      agent.context.delete('quiz_data');
      agent.context.set('trivia-done');
      agent.add('Some dummy text');
      agent.setFollowupEvent({
        'name': 'quiz-done',
        'languageCode': 'en',
      },
      );
      return;
    }

    if (lastState == 'Snooze') {
      agent.add(`No time for snoozing! ${context.parameters.question}`);
      return;
    }

    if (lastState == 'Next Question') {
      const question = await getQuestion();
      setQuestionContext(question);
      agent.add(`No problem. 
      I'll get you a new question. ${question.question}`);
      return;
    }

    if (lastState == 'No Number') {
      agent.add(`What's that? Remember to answer with a number. 
      ${context.parameters.question}`);
      return;
    }

    if (lastState == 'Wrong Answer') {
      agent.add(`Sorry, wrong answer. ${context.parameters.question}`);
      return;
    }

    if (lastState == 'Right Answer') {
      const question = await getQuestion();
      setQuestionContext(question);
      agent.add(`That's right! Your next question is ${question.question}`);
      return;
    }

    agent.add('Got to question-1 in a weird way. We should never get here!');
  }

  function snooze(agent) {
    console.log('Hello from Snooze');
    // If user tries to snooze, pop them back to question-1.
    agent.add('Some dummy text');
    agent.setFollowupEvent({
      'name': 'ask-question',
      'parameters': {
        'lastState': 'Snooze',
      },
      'languageCode': 'en',
    },
    );
  }

  function nextQuestion(agent) {
    console.log('Hello from Next Question');
    agent.add('Some dummy text');
    agent.setFollowupEvent({
      'name': 'ask-question',
      'parameters': {
        'lastState': 'Next Question',
      },
      'languageCode': 'en',
    },
    );
  }

  function answerQuestion(agent) {
    console.log(`In question answer with user query ${agent.query}`);

    const userAnswer = extractNumber(agent.query);

    console.log(`Got user answer ${userAnswer}`);

    let lastState = 'Mystery State';

    const context = agent.context.get('quiz_data');

    console.log('Got context ', context);

    if (!userAnswer) {
      lastState = 'No Number';
      console.log('Got no user answer');
    } else if (context.parameters.answer == userAnswer) {
      console.log(`User got the right answer`);

      lastState = 'Right Answer';
      agent.context.set({
        name: 'quiz_data',
        lifespan: 99,
        parameters: {
          question: context.parameters.question,
          answer: context.parameters.answer,
          questions_correct: context.parameters.questions_correct + 1,
        },
      });
    } else {
      console.log(`User gave the wrong answer: ${userAnswer} vs correct ${context.parameters.answer}`);
      lastState = 'Wrong Answer';
    }
    console.log(`Setting follow up event with last state ${lastState}`);
    agent.add('Some dummy text');
    agent.setFollowupEvent({
      'name': 'ask-question',
      'parameters': {
        'lastState': lastState,
      },
      'languageCode': 'en',
    },
    );
  }

  // Map Dialogflow intent names to their matching functions
  const intentMap = new Map();
  intentMap.set('Ask Question', askQuestion);
  intentMap.set('Snooze', snooze);
  intentMap.set('Next Question', nextQuestion);
  intentMap.set('Answer Question', answerQuestion);
  agent.handleRequest(intentMap);
});
