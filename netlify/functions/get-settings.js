const fetch = require('node-fetch');

exports.handler = async (event) => {
    const owner = 'gothtag';
    const repo = 'gothslol';
    const path = 'settings.json';

    try {
        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`);
        const data = await response.json();
        const content = Buffer.from(data.content, 'base64').toString('utf-8');
        return {
            statusCode: 200,
            body: content
        };
    } catch (e) {
        return {
            statusCode: 200,
            body: JSON.stringify({}) // Default empty
        };
    }
};