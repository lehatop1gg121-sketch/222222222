/**
 * Netlify Serverless Function — прокси к Piston API
 * Endpoint: POST /.netlify/functions/compile
 * Body: { files: [{ name, content }] }
 */

const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
};

exports.handler = async function(event) {
    // Браузер сначала шлёт OPTIONS (CORS preflight) — отвечаем 200
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers: CORS_HEADERS, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Method Not Allowed' }) };
    }

    let body;
    try {
        body = JSON.parse(event.body);
    } catch (e) {
        return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Invalid JSON' }) };
    }

    const { files } = body;
    if (!files || !Array.isArray(files)) {
        return { statusCode: 400, headers: CORS_HEADERS, body: JSON.stringify({ error: 'Missing files array' }) };
    }

    try {
        // Получаем версию Java
        let javaVersion = '15.0.2';
        try {
            const rtRes = await fetch('https://emkc.org/api/v2/piston/runtimes');
            if (rtRes.ok) {
                const runtimes = await rtRes.json();
                const jv = runtimes.find(r => r.language === 'java');
                if (jv) javaVersion = jv.version;
            }
        } catch { /* используем дефолтную */ }

        // Запускаем через Piston
        const response = await fetch('https://emkc.org/api/v2/piston/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ language: 'java', version: javaVersion, files })
        });

        if (response.status === 429) {
            return { statusCode: 429, headers: CORS_HEADERS, body: JSON.stringify({ error: 'RATE_LIMIT' }) };
        }
        if (!response.ok) {
            return { statusCode: response.status, headers: CORS_HEADERS, body: JSON.stringify({ error: `HTTP_${response.status}` }) };
        }

        const data = await response.json();
        return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify(data) };

    } catch (err) {
        return { statusCode: 500, headers: CORS_HEADERS, body: JSON.stringify({ error: err.message }) };
    }
};
