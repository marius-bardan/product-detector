async function main() {
    if (sessionStorage.getItem('productDetectorClosed')) {
        return;
    }

    const existingBox = document.getElementById('product-detector-box');
    if (existingBox) {
        existingBox.remove();
    }

    const displayBox = document.createElement('div');
    displayBox.id = 'product-detector-box';

    const contentWrapper = document.createElement('div');
    contentWrapper.id = 'product-detector-content';
    contentWrapper.textContent = 'checking...';

    const controlsWrapper = document.createElement('div');
    controlsWrapper.id = 'product-detector-controls';

    const debugToggle = document.createElement('button');
    debugToggle.id = 'product-detector-debug-toggle';
    debugToggle.innerHTML = '&#9881;'; // Gear icon
    debugToggle.onclick = () => {
        const detailsContainer = document.getElementById('product-details-container');
        if (detailsContainer) {
            detailsContainer.classList.toggle('hidden');
        }
    };

    const dragHandle = document.createElement('div');
    dragHandle.id = 'product-detector-drag-handle';
    dragHandle.innerHTML = `&#x2630;`;

    const closeButton = document.createElement('button');
    closeButton.id = 'product-detector-close-button';
    closeButton.innerHTML = '&times;';
    closeButton.onclick = () => {
        displayBox.remove();
        sessionStorage.setItem('productDetectorClosed', 'true');
    };

    controlsWrapper.appendChild(debugToggle);
    controlsWrapper.appendChild(dragHandle);
    controlsWrapper.appendChild(closeButton);
    displayBox.appendChild(contentWrapper);
    displayBox.appendChild(controlsWrapper);
    document.body.appendChild(displayBox);

    makeDraggable(displayBox, dragHandle);

    const status = await getProductPageStatus(document);
    let contentHTML = `<div id="product-details-container" class="hidden">`;
    contentHTML += `is product page: ${status.result}<br>(${status.reason})`;

    if (status.result) {
        displayBox.classList.add('is-product');
        const { title, gtin, mpn, brand, currency, price } = status.details;
        contentHTML += `<br><br>--- Product Details ---`;
        contentHTML += `<br><b>Title:</b> <span class="truncate-text">${title || 'Not found'}</span>`;
        contentHTML += `<br><b>Brand:</b> <span class="truncate-text">${brand || 'Not found'}</span>`;
        contentHTML += `<br><b>Price:</b> ${price || 'Not found'}`;
        contentHTML += `<br><b>Currency:</b> ${currency || 'Not found'}`;
        contentHTML += `<br><b>GTIN:</b> ${gtin || 'Not found'}`;
        contentHTML += `<br><b>MPN:</b> ${mpn || 'Not found'}`;
        contentHTML += `</div>`; // Close details container

        // --- Tabbed UI for Alternatives ---
        contentHTML += `--- Analysis ---`;
        contentHTML += `
            <div class="tabs">
                <button class="tab-button active" data-tab="search-tab">Alternatives</button>
                <button class="tab-button" data-tab="ai-tab">Reported Issues</button>
            </div>
            <div id="search-tab" class="tab-content active"><i>Fetching prices...</i></div>
            <div id="ai-tab" class="tab-content"><i>Asking AI...</i></div>
        `;
        contentWrapper.innerHTML = contentHTML;

        document.querySelectorAll('.tab-button').forEach(button => {
            button.addEventListener('click', (e) => {
                const tabId = e.target.dataset.tab;
                document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
                e.target.classList.add('active');
                document.getElementById(tabId).classList.add('active');

                if (tabId === 'ai-tab' && !e.target.dataset.loaded) {
                    e.target.dataset.loaded = 'true'; // Mark as loaded
                    getAiReportedIssues(status.details).then(data => {
                        const aiTab = document.getElementById('ai-tab');
                        aiTab.innerHTML = renderAiIssues(data);
                    });
                }
            });
        });

        getGooglePriceAlternatives(status.details).then(offers => {
            const searchTab = document.getElementById('search-tab');
            searchTab.innerHTML = renderPriceTable(offers, currency, document.location.hostname);
        });

    } else {
        contentHTML += `</div>`;
        displayBox.classList.add('not-product');
        contentWrapper.innerHTML = contentHTML;
    }
}

function renderPriceTable(offers, pageCurrency, currentHostname) {
    if (offers.length === 0) return `<br>No other offers found.`;

    const processedOffers = {};

    offers.forEach(offer => {
        const pagemap = offer.pagemap || {};
        const siteName = (offer.displayLink || '').replace(/^www\./, '');
        const offerList = pagemap.offer || [];

        if (currentHostname.includes(siteName)) {
            return;
        }

        let bestPrice = Infinity;
        let offerCurrency = '';

        if (offerList.length > 0) {
            offerList.forEach(o => {
                const price = parseFloat(String(o.price).replace(/[^0-9.]/g, ''));
                if (!isNaN(price) && price < bestPrice) {
                    bestPrice = price;
                    offerCurrency = o.pricecurrency;
                }
            });
        }

        if (bestPrice === Infinity) {
            return;
        }

        if (pageCurrency && offerCurrency && pageCurrency.toUpperCase() !== offerCurrency.toUpperCase()) {
            return;
        }

        if (!processedOffers[siteName] || bestPrice < processedOffers[siteName].price) {
            processedOffers[siteName] = {
                link: offer.link,
                title: offer.title,
                price: bestPrice,
                currency: offerCurrency,
                icon: pagemap.cse_thumbnail?.[0]?.src || pagemap.cse_image?.[0]?.src || ''
            };
        }
    });

    const finalOffers = Object.values(processedOffers).sort((a, b) => a.price - b.price);

    if (finalOffers.length === 0) return `<br>No other offers found in the same currency.`;

    let tableHTML = '<table class="price-table">';
    finalOffers.slice(0, 10).forEach(offer => {
        tableHTML += `
            <tr>
                <td class="icon-cell"><img src="${offer.icon}" alt="${offer.link.split('/')[2]} icon"></td>
                <td><a href="${offer.link}" target="_blank" title="${offer.title}">${offer.link.split('/')[2].replace(/^www\./, '')}</a></td>
                <td class="price-cell">${offer.price} ${offer.currency || ''}</td>
            </tr>
        `;
    });
    tableHTML += '</table>';

    return tableHTML;
}

function renderAiIssues(data) {
    if (!data || !data.issues?.length) {
        return `<br>Couldn't find any verifiable reported issues with this product.`;
    }

    let listHTML = '<ul class="analysis-list">';
    data.issues.forEach(issue => {
        listHTML += `<li>${issue}</li>`;
    });
    listHTML += '</ul>';

    return listHTML;
}


function makeDraggable(element, handle) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    handle.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
        e.preventDefault();
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
        e.preventDefault();
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        element.style.top = (element.offsetTop - pos2) + "px";
        element.style.left = (element.offsetLeft - pos1) + "px";
    }

    function closeDragElement() {
        document.onmouseup = null;
        document.onmousemove = null;
    }
}

// Monkey-patch history.pushState to detect SPA navigations
(function() {
    var pushState = history.pushState;
    history.pushState = function() {
        pushState.apply(history, arguments);
        window.dispatchEvent(new Event('pushstate'));
        window.dispatchEvent(new Event('locationchange'));
    };

    var replaceState = history.replaceState;
    history.replaceState = function() {
        replaceState.apply(history, arguments);
        window.dispatchEvent(new Event('replacestate'));
        window.dispatchEvent(new Event('locationchange'));
    };

    window.addEventListener('popstate', function() {
        window.dispatchEvent(new Event('locationchange'));
    });

    window.addEventListener('locationchange', function() {
        console.log('URL changed, re-running detector.');
        setTimeout(() => main(), 500);
    });
})();

main();