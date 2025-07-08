async function getAiReportedIssues(details) {
    // OPENAI_API_KEY is found in secrets.js
    const query = `${details.brand} ${details.title}`.trim();
    const cacheKey = `openai_${query}`;
    const cachedData = getFromCache(cacheKey, OPENAI_CACHE_EXPIRATION_MS);
    if (cachedData) {
        return cachedData;
    }

    if (!OPENAI_API_KEY) {
        console.error("OpenAI API Key is missing. Check secrets.js");
        return { issues: [] };
    }

    const prompt = `
        Analyze user reviews and technical forums for the product "${query}".
        List up to 3 of the most specific, verifiable, and frequently reported negative issues.
        Prioritize problems with numbers, percentages, or specific component names (e.g., "battery life drops 20% in a year", "keyboard fails after 18 months").
        For perfumes, focus on longevity ('fades after 1-2 hours') or batch issues.
        If no verifiable issues are widely reported, return an empty issues array.
        Respond in JSON: {"issues": ["issue 1", "issue 2"]}
    `;

    const endpoint = 'https://api.openai.com/v1/chat/completions';

    try {
        console.log("Fetching OpenAI for reported issues...");
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: "gpt-3.5-turbo",
                messages: [{ role: "user", content: prompt }],
                temperature: 0.1,
                max_tokens: 150
            })
        });

        if (!response.ok) {
            console.error("OpenAI API request failed:", response.status, await response.text());
            return { issues: [] };
        }

        const data = await response.json();
        const content = data.choices[0].message.content;

        const jsonMatch = content.match(/\{.*\}/s);
        if (jsonMatch) {
            const result = JSON.parse(jsonMatch[0]);
            setInCache(cacheKey, result);
            return result;
        }

        const emptyResult = { issues: [] };
        setInCache(cacheKey, emptyResult);
        return emptyResult;

    } catch (error) {
        console.error("Error fetching OpenAI reported issues:", error);
        return { issues: [] };
    }
}
