exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const { email } = JSON.parse(event.body);

    // For simplicity, just return a message. In production, integrate with email service.
    const message = `Password reset link sent to ${email}. (Note: This is a placeholder. Implement actual email sending.)`;

    return {
        statusCode: 200,
        body: JSON.stringify({ message })
    };
};