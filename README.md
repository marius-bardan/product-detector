```
secrets.js

// IMPORTANT: Replace these placeholder values with your actual credentials.

const GOOGLE_API_KEY = 'YOUR_API_KEY';
const SEARCH_ENGINE_ID = 'YOUR_SEARCH_ENGINE_ID';
const OPENAI_API_KEY = 'YOUR_OPENAI_API_KEY';
```

# Google API Key and Search Engine ID
1. Go to the Programmable Search Engine page: https://programmablesearchengine.google.com/

2. Click Add to create a new search engine.

3. Give your search engine a name (e.g., "Price Finder").

4. Under "Search settings", make sure the "Search the entire web" toggle is turned ON.

5. Click Create.

6. After it's created, click on Control Panel.

7. In the left menu, go to Search features.

8. Under the Advanced tab, scroll down to "Page Restrictions".

9. Click Add.

10. For the "Schema.org Type", enter Product. Click Save.

11. Go back to the Basics tab in the main settings. You will find the Search engine ID. Copy this ID.

12. Paste this ID into the secrets.js file. Also paste your Google API Key.
    
# OpenAI API Key
1. Go to the OpenAI API keys page: https://platform.openai.com/api-keys

2. Click + Create new secret key.

3. Give it a name (e.g., "Product Finder Extension") and click Create secret key.

4. Copy the key immediately. You will not be able to see it again.

5. Paste this key into the secrets.js file.


# Load the Extension in Chrome
1. Open Chrome and navigate to chrome://extensions.

2. If you have the old version, click Remove to delete it.

3. In the top-right corner, ensure Developer mode is enabled.

4. Click the Load unpacked button.

5. Select the product-detector-extension folder with the updated files.
