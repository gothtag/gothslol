const fetch = require('node-fetch');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const settings = JSON.parse(event.body);

    // GitHub repo details
    const owner = 'gothtag';
    const repo = 'gothslol';
    const path = 'settings.json';
    const token = process.env.GITHUB_TOKEN;

    if (!token) {
        return { statusCode: 500, body: 'GitHub token not set' };
    }

    // Get current file
    let sha;
    try {
        const getResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
            headers: { Authorization: `token ${token}` }
        });
        const fileData = await getResponse.json();
        sha = fileData.sha;
    } catch (e) {
        // File doesn't exist, create new
    }

    const content = Buffer.from(JSON.stringify(settings, null, 2)).toString('base64');

    const body = {
        message: 'Update settings',
        content,
        ...(sha && { sha })
    };

    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`, {
        method: 'PUT',
        headers: {
            Authorization: `token ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
    });

    if (response.ok) {
        return { statusCode: 200, body: JSON.stringify({ success: true }) };
    } else {
        return { statusCode: 500, body: JSON.stringify({ success: false }) };
    }
};