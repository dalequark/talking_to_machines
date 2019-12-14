const language = require('@google-cloud/language');

process.env.GOOGLE_APPLICATION_CREDENTIALS = 'key.json';

// Return entity sentiment from text
// eslint-disable-next-line require-jsdoc
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
