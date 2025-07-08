async function getGooglePriceAlternatives(details) {
    // GOOGLE_API_KEY and SEARCH_ENGINE_ID are found in secrets.js

    let query = '';
    if (details.gtin) {
        query = details.gtin;
    } else {
        let queryParts = [];
        if (details.brand) {
            queryParts.push(details.brand);
        }
        if (details.title) {
            if (!details.brand || !details.title.toLowerCase().includes(details.brand.toLowerCase())) {
                queryParts.push(details.title);
            } else {
                queryParts.push(details.title);
            }
        }
        if (details.mpn) {
            queryParts.push(details.mpn);
        }
        query = queryParts.join(' ');
    }

    if (!query) return [];

    const cacheKey = `google_${query}_${details.country}`;
    const cachedData = getFromCache(cacheKey, GOOGLE_CACHE_EXPIRATION_MS);
    if (cachedData) {
        return cachedData;
    }

    if (!GOOGLE_API_KEY || !SEARCH_ENGINE_ID) {
        console.error("Google API Key or Search Engine ID is missing. Check secrets.js");
        return [];
    }

    const endpoint = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${SEARCH_ENGINE_ID}&q=${encodeURIComponent(query)}&gl=${details.country}`;

    try {
        console.log(`Fetching Google: ${endpoint}`);
        const response = await fetch(endpoint);
        if (!response.ok) {
            console.error("Google API request failed:", response.status, await response.text());
            return [];
        }
        const data = await response.json();

        const irrelevantKeywords = ['review', 'vs', 'forum', 'guide', 'manual', 'support'];
        const filteredItems = (data.items || []).filter(item => {
            const lowerCaseTitle = item.title.toLowerCase();
            return !irrelevantKeywords.some(keyword => lowerCaseTitle.includes(keyword));
        });

        setInCache(cacheKey, filteredItems);
        return filteredItems;
    } catch (error) {
        console.error("Error fetching Google price alternatives:", error);
        return [];
    }
}
