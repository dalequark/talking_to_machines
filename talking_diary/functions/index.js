// Copyright 2020 Google LLC

// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at

//     https://www.apache.org/licenses/LICENSE-2.0

// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/**
 * Tip: Sign In should not happen in the Default Welcome Intent, instead
 * later in the conversation.
 * See `Action discovery` docs:
 * https://developers.google.com/actions/discovery/implicit#action_discovery
 */

"use strict";

const { dialogflow, SignIn } = require("actions-on-google");
const admin = require("firebase-admin");
const functions = require("firebase-functions");
const dotenv = require("dotenv");
const uuid = require("uuid/v4");
const analyze = require("./analyze");

dotenv.config();
admin.initializeApp();

const auth = admin.auth();
const db = admin.firestore();
db.settings({ timestampsInSnapshots: true });

const dbs = {
  user: db.collection("user")
};

const app = dialogflow({
  clientId: process.env.CLIENT_ID,
  debug: true
});

app.middleware(async conv => {
  const { email } = conv.user;
  if (!conv.data.uid && email) {
    try {
      conv.data.uid = (await auth.getUserByEmail(email)).uid;
    } catch (e) {
      if (e.code !== "auth/user-not-found") {
        throw e;
      }
      // If the user is not found, create a new Firebase auth user
      // using the email obtained from the Google Assistant
      conv.data.uid = (await auth.createUser({ email })).uid;
    }
  }
  if (conv.data.uid) {
    conv.user.ref = dbs.user.doc(conv.data.uid);
  }
});

app.intent("Default Welcome Intent", async conv => {
  // Account Linking is only supported for verified users
  // https://developers.google.com/actions/assistant/guest-users
  if (conv.user.verification !== "VERIFIED") {
    return conv.close(
      `Hi! You'll need to be a verified user to use this sample`
    );
  }
  const { payload } = conv.user.profile;
  const name = payload ? ` ${payload.given_name}` : "";
  conv.ask(`Welcome back, ${name}!`);

  conv.ask(`Do you want to tell me about your day?`);
});

app.intent("Default Welcome Intent - yes", async conv => {
  conv.followup("how-day-going");
});

app.intent("How Day Going - fallback", async conv => {
  if (!conv.user.ref) {
    return conv.ask(new SignIn(`to save your diary entries.`));
  }

  // Create a new diary entry
  conv.data.diary_entry_id = uuid();
  const entry = conv.user.ref.collection("diary").doc(conv.data.diary_entry_id);

  await entry.set({
    date: new Date(),
    day_going: conv.query
  });

  conv.followup("day-highlight");
});

app.intent("Day Highlight - fallback", async conv => {
  const entry = conv.user.ref.collection("diary").doc(conv.data.diary_entry_id);
  await entry.update({
    highlight: conv.query
  });
  conv.followup("day-lowlight");
});

app.intent("Day Lowlight - fallback", async conv => {
  const entry = conv.user.ref.collection("diary").doc(conv.data.diary_entry_id);
  await entry.update({
    lowlight: conv.query
  });
  conv.followup("end-diary");
});

app.intent("Get Trends", async conv => {
  if (!conv.user.ref) {
    return conv.ask(new SignIn(`To show you your daily trends`));
  } else {
    return conv.close(`TODO: Implement get trends function`);
  }
});

app.intent("Get Sign In", async (conv, params, signin) => {
  if (signin.status !== "OK") {
    return conv.close(`Couldn't sign in. Let's try again next time.`);
  }
  conv.followup("How Day Going - fallback");
});

exports.dialogflowFirebaseFulfillment = functions.https.onRequest(app);

exports.analyzeEntry = functions.firestore
  .document("user/{userId}/diary/{entryId}")
  .onUpdate(async (change, context) => {
    // Start analysis only after the last diary entry, `lowlight`, is created
    if (!change.after.data()["lowlight"]) {
      return;
    }
    const data = [
      change.after.data()["day_going"],
      change.after.data()["highlight"],
      change.after.data()["lowlight"]
    ].join("\n");

    const entities = await analyze.getEntitySentiment(data);

    if (entities) {
      return change.after.ref.update({
        analysis: entities
      });
    }
  });
