function extractProductDetails(document) {
    let details = { title: '', gtin: '', mpn: '', brand: '', price: '', currency: '', country: '' };
    const { hostname } = document.location;

    const tld = hostname.split('.').pop();
    const countryMap = { 'com': 'us', 'de': 'de', 'uk': 'uk', 'fr': 'fr', 'ca': 'ca', 'it': 'it', 'es': 'es', 'au': 'au', 'jp': 'jp', 'ro': 'ro' };
    let countryCode = countryMap[tld] || '';
    if (hostname.includes('.co.uk')) countryCode = 'uk';
    details.country = countryCode;

    const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of jsonLdScripts) {
        try {
            const jsonData = JSON.parse(script.textContent);
            const productData = jsonData['@type'] === 'Product' ? jsonData : (jsonData['@graph'] || []).find(item => item['@type'] === 'Product');
            if (productData) {
                details.title = productData.name || details.title;
                details.gtin = productData.gtin13 || productData.gtin12 || productData.gtin8 || productData.gtin || details.gtin;
                details.mpn = productData.mpn || details.mpn;
                if (productData.brand && typeof productData.brand === 'object') {
                    details.brand = productData.brand.name || details.brand;
                } else {
                    details.brand = productData.brand || details.brand;
                }
                if (productData.offers) {
                    const offer = Array.isArray(productData.offers) ? productData.offers[0] : productData.offers;
                    details.currency = offer.priceCurrency || '';
                    details.price = offer.price || '';
                }
                if (details.title && details.brand && details.currency && details.price) break;
            }
        } catch (e) { /* Ignore parsing errors */ }
    }

    if (!details.title) {
        details.title = document.querySelector('meta[property="og:title"]')?.content || document.title;
    }
    if (!details.brand) {
        details.brand = document.querySelector('meta[property="product:brand"]')?.content || '';
    }
    if (!details.currency) {
        details.currency = document.querySelector('meta[property="product:price:currency"]')?.content || '';
    }
    if (!details.price) {
        details.price = document.querySelector('meta[property="product:price:amount"]')?.content || '';
    }
    if (!details.gtin) {
        details.gtin = document.querySelector('meta[property="product:retailer_item_id"]')?.content || '';
    }
    if (!details.mpn) {
        details.mpn = document.querySelector('meta[property="product:mfr_part_no"]')?.content || '';
    }

    if (hostname.includes('amazon.')) {
        // Brand
        if (!details.brand) {
            const bylineInfo = document.querySelector('#bylineInfo');
            if (bylineInfo && bylineInfo.innerText.includes('Visit the')) {
                details.brand = bylineInfo.innerText.replace('Visit the', '').replace('Store', '').trim();
            }
        }
        // Title
        const productTitleElement = document.querySelector('#productTitle');
        if (productTitleElement) {
            details.title = productTitleElement.innerText.trim();
        }
        // Price (only look in the main price block)
        const priceBlock = document.querySelector('#corePrice_desktop .a-price, #price .a-price, .priceToPay .a-price');
        if (priceBlock && (!details.price || !details.currency)) {
            const priceText = priceBlock.innerText.replace(/\s/g, ''); // Remove all whitespace
            const priceMatch = priceText.match(/([$€£])([\d,.]+)/);
            if (priceMatch && priceMatch[2]) {
                details.price = priceMatch[2];
                const currencySymbolMap = { '€': 'EUR', '$': 'USD', '£': 'GBP' };
                details.currency = currencySymbolMap[priceMatch[1]] || '';
            }
        }
    } else {
        if (!details.price) {
            const priceElements = document.querySelectorAll('[class*="price"], [id*="price"], [data-testid*="price"]');
            for (const el of priceElements) {
                const text = el.innerText;
                if (text) {
                    const priceMatch = text.match(/([$€£]|USD|EUR|GBP|RON|lei)?\s*([\d,.]*[\d])/i);
                    if (priceMatch && priceMatch[2]) {
                        details.price = priceMatch[2];
                        const currencySymbol = priceMatch[1] || '';
                        const currencyMap = { '€': 'EUR', '$': 'USD', '£': 'GBP', 'lei': 'RON', 'ron': 'RON' };
                        details.currency = currencyMap[currencySymbol.toLowerCase()] || currencySymbol.toUpperCase() || details.currency;
                        break;
                    }
                }
            }
        }
    }

    let cleanedTitle = details.title;
    cleanedTitle = cleanedTitle.replace(/on .*?\..*|\|.*$/g, '');
    cleanedTitle = cleanedTitle.replace(/\[.*?\]/g, '').replace(/\(.*?\)/g, '').trim();
    const delimiters = [':', '|', ' - '];
    for (const delimiter of delimiters) {
        if (cleanedTitle.includes(delimiter)) {
            cleanedTitle = cleanedTitle.split(delimiter)[0].trim();
        }
    }
    details.title = cleanedTitle;

    return details;
}


async function getProductPageStatus(document) {
    const defaultResponse = (reason) => ({ result: false, reason, details: {} });
    if (!document || !document.location) { return defaultResponse("A valid document object was not provided."); }
    const details = extractProductDetails(document);

    // --- Primary Detection: Metadata ---
    if (document.querySelector('meta[property="og:type"][content="product"]')) { return { result: true, reason: "Found og:type='product' meta tag.", details }; }
    if (document.querySelector('[itemscope][itemtype*="schema.org/Product"]')) { return { result: true, reason: "Found schema.org/Product microdata.", details }; }
    const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of jsonLdScripts) {
        try {
            const jsonData = JSON.parse(script.textContent);
            if (jsonData['@type'] === 'Product' || (jsonData['@graph'] && jsonData['@graph'].some(item => item['@type'] === 'Product'))) {
                return { result: true, reason: "Found 'Product' type in JSON-LD schema.", details };
            }
        } catch (e) { /* Ignore */ }
    }

    const { hostname, pathname } = document.location;
    const siteRules = {
        'amazon': { urlPatterns: [/\/dp\//i], domSelectors: ['#addToCart_feature_div', '#buyNow_feature_div', 'input#add-to-cart-button', '#productTitle'] },
        'nike.com': { urlPatterns: [/\/t\//i], domSelectors: ['[data-test="add-to-cart"]', '[data-test="add-to-bag"]'] },
        'www.walmart.com': { urlPatterns: [/\/ip\//i], domSelectors: ['button[data-testid="add-to-cart-button"]'] },
        'www.target.com': { urlPatterns: [/\/p\//i], domSelectors: ['[data-test="shippingATCButton"]', '[data-test*="AddToCart"] button'] },
        'www.apple.com': { urlPatterns: [/\/shop\/buy/i], domSelectors: ['[data-autom="add-to-cart"]', '.as-productorder-addtocart'] },
        'shopify': { urlPatterns: [/\/products\//i], domSelectors: ['[name="add"]', 'button[type="submit"][name="add"]', '[data-section-type="product"]'] }
    };
    const genericUrlPatterns = [ /\/products?\//i, /\/p\//i, /\/shop\//i, /\/item\//i, /\/detail/i ];
    const genericDomSelectors = ['[class*="add-to-cart"]', '[class*="addtocart"]', '[data-test*="add-to-cart"]'];
    const genericButtonTexts = ['add to bag', 'add to basket', 'adaugă în coș'];

    let applicableRule = null;
    const normalizedHostname = hostname.replace(/^www\./, '');
    if (normalizedHostname.startsWith('amazon.')) {
        applicableRule = siteRules['amazon'];
    } else if (normalizedHostname === 'nike.com') {
        applicableRule = siteRules['nike.com'];
    } else {
        applicableRule = siteRules[normalizedHostname];
    }

    let urlMatch = false; let urlReason = ''; let isGenericMatch = false;

    if (applicableRule) { for (const pattern of applicableRule.urlPatterns) { if (pattern.test(pathname)) { urlMatch = true; urlReason = `Site-specific URL pattern matched: ${pattern}`; break; } } }
    if (!urlMatch) { const shopifyRule = siteRules['shopify']; for (const pattern of shopifyRule.urlPatterns) { if (pattern.test(pathname)) { urlMatch = true; isGenericMatch = true; urlReason = `Generic Shopify pattern matched: ${pattern}`; break; } } }
    if (!urlMatch) { for (const pattern of genericUrlPatterns) { if (pattern.test(pathname)) { urlMatch = true; isGenericMatch = true; urlReason = `Generic URL pattern matched: ${pattern}`; break; } } }

    if (urlMatch) {
        const selectorsToCheck = isGenericMatch ? genericDomSelectors : (applicableRule ? applicableRule.domSelectors : []);
        for (const selector of selectorsToCheck) {
            if (document.querySelector(selector)) { return { result: true, reason: `${urlReason} & found DOM element: '${selector}'`, details }; }
        }
    }

    let priceElementFound = details.price !== '';
    let cartButtonFound = false;

    if (!priceElementFound) {
        const priceElements = document.querySelectorAll('[class*="price"], [id*="price"], [data-test*="price"]');
        for (const el of priceElements) {
            if (/[€$£]\s*\d+/.test(el.innerText)) {
                priceElementFound = true;
                break;
            }
        }
    }

    const allButtons = document.querySelectorAll('button, input[type="submit"], input[type="button"], a[role="button"]');
    for (const button of allButtons) {
        const buttonText = (button.innerText || button.value || '').toLowerCase();
        for (const text of genericButtonTexts) {
            if (buttonText.includes(text)) {
                cartButtonFound = true;
                break;
            }
        }
        if(cartButtonFound) break;
    }

    if (priceElementFound && cartButtonFound) {
        return { result: true, reason: "Generic DOM analysis (found price and cart button).", details };
    }

    return defaultResponse("No product indicators found.");
}
