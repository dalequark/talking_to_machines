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
const trivia = require('./trivia');

process.env.DEBUG = 'dialogflow:*'; // enables lib debugging statements
admin.initializeApp(functions.config().firebase);
const db = admin.firestore();

// Set this to whatever message you want to play when
// the trivia game begins.
const WELCOME_MESSAGE = `Good morning! Good morning! Wake up! 
It\'s time to answer some trivia questions.`;

// Total number of questions until the user "wins"
const NUM_QUESTIONS = 3;

// Given an answer, extracts the number. For example,
// given "The answer is 15", this fn returns the number
// 15 or null, if no number is found.
function extractNumber(answer) {
  const result = answer.match(/\d+/);
  return result ? result[0] : null;
}

exports.dialogflowFirebaseFulfillment =
functions.https.onRequest((request, response) => {
  const agent = new WebhookClient({request, response});


  // Returns trivia question in increasing hardness as the
  // game goes on.
  function getQuestion() {
    // Get the # of questions the user has answered corrrectly already
    // from the context.
    const questionNum = agent.context.get('quiz_data') ? agent.context.get('quiz_data').questions_correct + 1 : 1;
    
    / Start the first third questions easy, then medium, then difficult
    if (questionNum / NUM_QUESTIONS <= 1/3)  return trivia.getEasyQuestion();
    if (questionNum / NUM_QUESTIONS <= 2/3)  return trivia.getMediumQuestion();
    return trivia.getHardQuestion();
  }

  // We store information about the current trivia question, it's answer,
  // and the number of questions answered correctly so far 
  // in the Agent's context. This function takes a question
  // and stoers it in the context.
  function setQuestionContext(question) {
    const oldContext = agent.context.get('quiz_data');
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

  // Intent handler responsible for asking trivia questions.
  // This Intent can be triggered through code or in a 
  // fallback from one of the other Intent handlers.
  async function askQuestion(agent) {

    // Because askQuestion can be triggered
    // from other Intent handlers, we use lastState to
    // keep track of how we got here. Did the user
    // just get the last question wrong? Right? Did they
    // try to snooze?
    const lastState = agent.parameters.lastState;
    console.log(`Last state was ${lastState}`);

    // If we're just beginning the quiz game, there's no
    // prior state.
    if (!lastState) {
      // Set up the first question. 
      
      // No context should exist yet, but if it does,
      // delete it.
      agent.context.delete('quiz_data');
      const question = getQuestion();
      setQuestionContext(question);
      agent.add(`${WELCOME_MESSAGE}
        Your first question is ${question.question}`);
      return;
    }

    // If the quiz game isn't just starting, we should have
    // already asked a question which is stored in context.
    const context = agent.context.get('quiz_data');

    if (context.parameters.questions_correct == NUM_QUESTIONS) {
      // If the user answered NUM_QUESTIONS questions correctly,
      // we're done! Trigger the Quiz Done intent.
      agent.context.set('trivia-done');
      agent.setFollowupEvent({
        'name': 'quiz-done',
        'languageCode': 'en',
      },
      );
      return;
    }

    // If the user tries to snooze, don't let them!
    if (lastState == 'Snooze') {
      agent.add(`No time for snoozing! ${context.parameters.question}`);
      return;
    }

    // If the user doesn't know the answer, get them a new question
    if (lastState == 'Next Question') {
      const question = getQuestion();
      setQuestionContext(question);
      agent.add(`No problem. 
      I'll get you a new question. ${question.question}`);
      return;
    }

    // If the user doesn't respond with a number, ask the question
    // again and remind them need to answer with a number.
    if (lastState == 'No Number') {
      agent.add(`What's that? Remember to answer with a number. 
      ${context.parameters.question}`);
      return;
    }

    // If the user gives the wrong answer, let them try again.
    if (lastState == 'Wrong Answer') {
      agent.add(`Sorry, wrong answer. ${context.parameters.question}`);
      return;
    }

    // If the user gives ther ight answer, congratulate them and pull
    // a new question.
    if (lastState == 'Right Answer') {
      const question = getQuestion();
      setQuestionContext(question);
      agent.add(`That's right! Your next question is ${question.question}`);
      return;
    }

    agent.add('Got to question answer in a weird way. We should never get here!');
  }

  // Handler for the Snooze Intent
  function snooze(agent) {
    console.log('Hello from Snooze');
    // If user tries to snooze, ignore their request and ask
    // the current trivia question again
    agent.setFollowupEvent({
      'name': 'ask-question',
      'parameters': {
        'lastState': 'Snooze',
      },
      'languageCode': 'en',
    },
    );
  }

  // Handler from the Next Question intent
  function nextQuestion(agent) {
    agent.setFollowupEvent({
      'name': 'ask-question',
      'parameters': {
        'lastState': 'Next Question',
      },
      'languageCode': 'en',
    },
    );
  }

  // Handler for the answerQuestion intent. Since we made this
  // Intent a fallback, this function will run whenever no other
  // Intent (Snooze, Later, etc) was matched.
  function answerQuestion(agent) {

    const userAnswer = extractNumber(agent.query);

    // Placeholder. We should always overwrite this value.
    let lastState = 'Mystery State';

    const context = agent.context.get('quiz_data');

    // Set state to No Number when the user didn't answer
    // with a number
    if (!userAnswer) {
      lastState = 'No Number';
    } else if (context.parameters.answer == userAnswer) {
      console.log(`User got the right answer`);

      lastState = 'Right Answer';
      // Update the number of questions the user got correct
      // in the agent context.
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

    // After identifying which case we're in above, invoke
    // the Ask Question Intent.
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
