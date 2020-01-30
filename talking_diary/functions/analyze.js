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

const language = require('@google-cloud/language');

process.env.GOOGLE_APPLICATION_CREDENTIALS = 'key.json';

// Return entity sentiment from text
exports.getEntitySentiment = async function getEntitySentiment(text) {
    // Instantiates a client
    const client = new language.LanguageServiceClient();

    const document = {
      content: text,
      type: 'PLAIN_TEXT',
    };

    // Detects the sentiment of the text
    const [result] = await client.analyzeEntitySentiment({document});

    return result.entities.map((entry) => {
        return {
            'name': entry['name'],
            'sentiment': entry['sentiment']['score'],
            'magnitude': entry['sentiment']['magnitude'],
        };
    });
    return result.entities;
};
