/**
 * Thin WP REST API wrapper.
 * Reads WP_API_URL, WP_USER, WP_APP_PASSWORD from process.env
 */

const apiUrl = process.env.WP_API_URL;
const user = process.env.WP_USER;
const appPassword = process.env.WP_APP_PASSWORD;

function authHeaders() {
    const token = Buffer.from(`${user}:${appPassword}`).toString('base64');
    return {
        'Authorization': `Basic ${token}`,
        'Content-Type': 'application/json',
    };
}

async function wpGet(endpoint) {
    const url = `${apiUrl}${endpoint}`;
    const res = await fetch(url, { headers: authHeaders() });
    if (!res.ok) {
        const body = await res.text();
        throw new Error(`WP API GET ${url} failed (${res.status}): ${body}`);
    }
    return res.json();
}

async function wpPost(endpoint, data) {
    const url = `${apiUrl}${endpoint}`;
    const res = await fetch(url, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(data),
    });
    if (!res.ok) {
        const body = await res.text();
        throw new Error(`WP API POST ${url} failed (${res.status}): ${body}`);
    }
    return res.json();
}

module.exports = { wpGet, wpPost };
