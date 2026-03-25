exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const { email, password } = JSON.parse(event.body);

    // Hardcoded credentials (insecure, but as per user request)
    const adminEmail = '14022025lm@gmail.com';
    const adminPassword = 'admin8000meylev?lovers';

    if (email === adminEmail && password === adminPassword) {
        // Simple token, in production use JWT
        const token = 'admin-token-' + Date.now();
        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, token })
        };
    } else {
        return {
            statusCode: 401,
            body: JSON.stringify({ success: false, message: 'Invalid credentials' })
        };
    }
};