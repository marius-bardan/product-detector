const GOOGLE_CACHE_EXPIRATION_MS = 6 * 60 * 60 * 1000; // 6 hours
const OPENAI_CACHE_EXPIRATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function getFromCache(key, expirationMs) {
    const cached = sessionStorage.getItem(key);
    if (!cached) {
        return null;
    }

    const { timestamp, data } = JSON.parse(cached);
    if (Date.now() - timestamp > expirationMs) {
        sessionStorage.removeItem(key);
        return null;
    }
    console.log(`Cache hit for key: ${key}`);
    return data;
}

function setInCache(key, data) {
    const item = {
        timestamp: Date.now(),
        data: data
    };
    sessionStorage.setItem(key, JSON.stringify(item));
    console.log(`Cached data for key: ${key}`);
}