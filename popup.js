document.addEventListener('DOMContentLoaded', function() {
  const extractButton = document.getElementById('extractButton');
  
  extractButton.addEventListener('click', async () => {
    try {
      // Get the active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Execute content script to extract information
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        function: extractProductInfo
      }, (results) => {
        if (chrome.runtime.lastError) {
          console.error('Error:', chrome.runtime.lastError);
          updatePopup({
            name: 'Error: Could not access page',
            price: '-',
            address: '-'
          });
          return;
        }
        
        if (results && results[0]) {
          const productInfo = results[0].result;
          console.log('Received product info:', productInfo);
          updatePopup(productInfo);
        } else {
          console.error('No results received');
          updatePopup({
            name: 'Error: No data found',
            price: '-',
            address: '-'
          });
        }
      });
    } catch (error) {
      console.error('Error:', error);
      updatePopup({
        name: 'Error: Extension error',
        price: '-',
        address: '-'
      });
    }
  });
});

function updatePopup(productInfo) {
  document.getElementById('productName').textContent = productInfo.name || '-';
  document.getElementById('productPrice').textContent = productInfo.price || '-';
  document.getElementById('deliveryAddress').textContent = productInfo.address || '-';
}

function extractProductInfo() {
  // Function to find title
  function findTitle() {
    const possibleTitleSelectors = [
      '#productTitle',
      '.product-title',
      '.titleSection',
      'h1',
      '[class*="title"]',
      '[class*="product-title"]'
    ];
    
    for (const selector of possibleTitleSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        const text = element.textContent.trim();
        if (text && text.length > 0) return text;
      }
    }
    return null;
  }

  // Function to find price
  function findPrice() {
    // Try to find the main product price section
    const priceSelectors = [
      // Look for price in the main product section
      '#priceblock_ourprice',
      '#priceblock_dealprice',
      '.a-price .a-offscreen',
      '.a-price-whole',
      '.a-price .a-text-price',
      '.a-price .a-text-normal',
      '.a-price .a-text-bold',
      // Look for price in the product details section
      '#price_inside_buybox',
      '#priceblock_ourprice',
      '#priceblock_dealprice',
      // Look for price in the product title section
      '#productTitle + div .a-price',
      '#productTitle + div .a-price-whole',
      // Look for price in the product details
      '#productDetails_techSpec_section_1 .a-price',
      '#productDetails_techSpec_section_1 .a-price-whole'
    ];

    // First try to find price near "One time purchase"
    const elements = Array.from(document.querySelectorAll('*'));
    const purchaseElement = elements.find(el => el.textContent.includes('One time purchase'));
    if (purchaseElement) {
      // Look for price in the same section
      const priceElement = purchaseElement.parentElement.querySelector('.a-price .a-offscreen') ||
                         purchaseElement.parentElement.querySelector('.a-price-whole') ||
                         purchaseElement.parentElement.querySelector('.a-price .a-text-price');
      if (priceElement) {
        const price = priceElement.textContent.trim();
        if (price && price.includes('$')) return price;
      }
    }

    // If not found, try the specific price selectors
    for (const selector of priceSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        const text = element.textContent.trim();
        // Only return if it's a valid price (contains $ and numbers)
        if (text && text.includes('$') && /\d/.test(text)) {
          return text;
        }
      }
    }

    // If still not found, try to find any price in the main product section
    const mainProductSection = document.querySelector('#productTitle')?.parentElement;
    if (mainProductSection) {
      const priceElements = mainProductSection.querySelectorAll('.a-price, [class*="price"]');
      for (const element of priceElements) {
        const text = element.textContent.trim();
        if (text && text.includes('$') && /\d/.test(text)) {
          return text;
        }
      }
    }

    return null;
  }

  // Function to find address
  function findAddress() {
    // Try the specific selector first
    const locationElement = document.querySelector('#nav-global-location-slot');
    if (locationElement) return locationElement.textContent.trim();

    // Try alternative location selectors
    const locationSelectors = [
      '[class*="location"]',
      '[class*="delivery"]',
      '[class*="shipping"]',
      '[id*="location"]',
      '[id*="delivery"]'
    ];

    for (const selector of locationSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        const text = element.textContent.trim();
        if (text && text.length > 0) return text;
      }
    }
    return null;
  }

  const result = {
    name: findTitle(),
    price: findPrice(),
    address: findAddress()
  };

  // Log the results for debugging
  console.log('Extracted Information:', result);
  return result;
} 