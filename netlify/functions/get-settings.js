const fetch = require('node-fetch');

exports.handler = async (event) => {
    const owner = 'gothtag';
    const repo = 'gothslol';
    const path = 'settings.json';
    const token = process.env.GITHUB_TOKEN;

    if (!token) {
        console.error('GITHUB_TOKEN not provided');
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'GITHUB_TOKEN not configured' })
        };
    }

    try {
        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
            headers: {
                'Authorization': `token ${token}`,
                'User-Agent': 'Netlify Function'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('GitHub get-settings error', response.status, errorText);
            return {
                statusCode: response.status,
                body: JSON.stringify({ error: errorText || 'GitHub API error' })
            };
        }

        const data = await response.json();
        const content = Buffer.from(data.content, 'base64').toString('utf-8');
        return {
            statusCode: 200,
            body: content
        };
    } catch (e) {
        console.error('get-settings unexpected error', e);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: e.message || 'Internal error' })
        };
    }
};