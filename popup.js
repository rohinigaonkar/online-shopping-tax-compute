import config from './config.js';

const apiKey = config.GEMINI_API_KEY;
document.addEventListener('DOMContentLoaded', function() {
  const extractButton = document.getElementById('extractButton');
  
  // Listen for messages from the content script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'UPDATE_POPUP') {
      updatePopup(message.data);
    }
  });
  
  extractButton.addEventListener('click', async () => {
    try {
      // Show loading state
      updatePopup({
        ProductName: 'Calculating taxes...',
        ProductPrice: 'Please wait',
        DeliveryAddress: 'Processing...',
        taxInfo: {
          rate: 0,
          amount: 0,
          total: 0
        }
      });

      // Get the active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      // Execute content script to extract information
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: calculateTaxes,
        args: [apiKey]
      });
    } catch (error) {
      console.error('Error:', error);
      updatePopup({
        ProductName: 'Error: Extension error',
        ProductPrice: '-',
        DeliveryAddress: '-',
        taxInfo: {
          rate: 0,
          amount: 0,
          total: 0
        }
      });
    }
  });
}); 



function updatePopup(productInfo) {
  try {
    // Parse product info if it's a string
    let info;
    if (typeof productInfo === 'string') {
      try {
        info = JSON.parse(productInfo);
      } catch (parseError) {
        console.error("Error parsing product info:", parseError);
        info = productInfo;
      }
    } else {
      info = productInfo;
    }

    // Update product information
    document.getElementById('productName').textContent = info.ProductName || info.name || '-';
    document.getElementById('productPrice').textContent = info.ProductPrice || info.price || '-';
    document.getElementById('deliveryAddress').textContent = info.DeliveryAddress || info.address || '-';

    // Update tax information if available
    if (info.taxInfo) {
      document.getElementById('taxRate').textContent = `${((info.taxInfo.rate || 0) * 100).toFixed(1)}%`;
      document.getElementById('taxAmount').textContent = `$${((info.taxInfo.amount || 0)).toFixed(2)}`;
      document.getElementById('totalAmount').textContent = `$${((info.taxInfo.total || 0)).toFixed(2)}`;
    }
  } catch (error) {
    console.error("Error updating popup:", error);
  }
}

async function calculateTaxes(apiKey) {
  // Define all functions within the execution context
  function get_product_info() {
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

    function findPrice() {
      const priceSelectors = [
        '#priceblock_ourprice',
        '#priceblock_dealprice',
        '.a-price .a-offscreen',
        '.a-price-whole',
        '.a-price .a-text-price',
        '.a-price .a-text-normal',
        '.a-price .a-text-bold',
        '#price_inside_buybox',
        '#priceblock_ourprice',
        '#priceblock_dealprice',
        '#productTitle + div .a-price',
        '#productTitle + div .a-price-whole',
        '#productDetails_techSpec_section_1 .a-price',
        '#productDetails_techSpec_section_1 .a-price-whole'
      ];

      const elements = Array.from(document.querySelectorAll('*'));
      const purchaseElement = elements.find(el => el.textContent.includes('One time purchase'));
      if (purchaseElement) {
        const priceElement = purchaseElement.parentElement.querySelector('.a-price .a-offscreen') ||
                           purchaseElement.parentElement.querySelector('.a-price-whole') ||
                           purchaseElement.parentElement.querySelector('.a-price .a-text-price');
        if (priceElement) {
          const price = priceElement.textContent.trim();
          if (price && price.includes('$')) return price;
        }
      }

      for (const selector of priceSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          const text = element.textContent.trim();
          if (text && text.includes('$') && /\d/.test(text)) {
            return text;
          }
        }
      }

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

    function findAddress() {
      // First try to find the delivery address in the location slot
      const locationElement = document.querySelector('#nav-global-location-slot');
      if (locationElement) {
        const address = locationElement.textContent.trim();
        console.log("Found address in location slot:", address);
        return address;
      }

      // Try to find delivery address in common elements
      const addressSelectors = [
        '#nav-global-location-popup-link',
        '#nav-global-location',
        '[class*="location"]',
        '[class*="delivery"]',
        '[class*="shipping"]',
        '[id*="location"]',
        '[id*="delivery"]',
        '[id*="shipping"]',
        '.a-section .a-text-bold:contains("Delivery")',
        '.a-section .a-text-bold:contains("Shipping")'
      ];

      for (const selector of addressSelectors) {
        const element = document.querySelector(selector);
        if (element) {
          const text = element.textContent.trim();
          if (text && text.length > 0) {
            console.log("Found address using selector:", selector, ":", text);
            return text;
          }
        }
      }

      // Try to find postal code or province in the page
      const postalCodeRegex = /[A-Z]\d[A-Z]\s?\d[A-Z]\d/;
      const provinceRegex = /(ON|QC|BC|AB|MB|SK|NS|NB|NL|PE|YT|NT|NU)/;
      
      const pageText = document.body.textContent;
      const postalCodeMatch = pageText.match(postalCodeRegex);
      const provinceMatch = pageText.match(provinceRegex);
      
      if (postalCodeMatch || provinceMatch) {
        const address = `${postalCodeMatch ? postalCodeMatch[0] : ''} ${provinceMatch ? provinceMatch[0] : ''}`.trim();
        console.log("Found address from postal code/province:", address);
        return address;
      }

      console.log("No address found in the page");
      return null;
    }

    const productInfo = {
      ProductName: findTitle(),
      ProductPrice: findPrice(),
      DeliveryAddress: findAddress()
    };

    // Log the extracted information for debugging
    console.log('Extracted Product Information:', productInfo);
    
    // Return a string representation of the object for better visibility
    return JSON.stringify(productInfo);
  }

  async function determine_delivery_location(productInfo) {
    try {
      let address;
      
      // Handle different input types
      if (typeof productInfo === 'string') {
        try {
          // Try to parse as JSON first
          const parsedInfo = JSON.parse(productInfo);
          address = parsedInfo.DeliveryAddress;
        } catch (parseError) {
          // If parsing fails, assume productInfo is the address string
          address = productInfo;
        }
      } else if (typeof productInfo === 'object') {
        address = productInfo.DeliveryAddress;
      }
      
      if (!address) {
        console.error("No delivery address found");
        return 'Unknown';
      }

      console.log("Processing address:", address);

      // Call Gemini API to determine province
      const apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

      const prompt = `Given this delivery address: "${address}", determine which Canadian province or territory it belongs to. 
      Respond with ONLY the province code (ON, QC, BC, AB, MB, SK, NS, NB, NL, PE, YT, NT, NU) or "Unknown" if you cannot determine it.
      Do not include any other text or explanation.
      If the address contains a province name or code, use that. If not, try to infer from city names or postal codes.`;

      const response = await fetch(`${apiUrl}?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }]
        })
      });

      const data = await response.json();
      const provinceCode = data.candidates[0].content.parts[0].text.trim();
      
      console.log("Determined province code:", provinceCode);
      
      // Validate the province code
      const validProvinces = ['ON', 'QC', 'BC', 'AB', 'MB', 'SK', 'NS', 'NB', 'NL', 'PE', 'YT', 'NT', 'NU'];
      return validProvinces.includes(provinceCode) ? provinceCode : 'Unknown';
    } catch (error) {
      console.error("Error in determine_delivery_location:", error);
      return 'Unknown';
    }
  }

  function determine_product_type(productInfo) {
    try {
      // Handle both string and object inputs
      let info;
      if (typeof productInfo === 'string') {
        try {
          info = JSON.parse(productInfo);
        } catch (parseError) {
          // If parsing fails, assume productInfo is the product name string
          info = { ProductName: productInfo };
        }
      } else {
        info = productInfo;
      }

      const productName = info.ProductName;
      
      if (!productName) return false;
      const groceryKeywords = ['food', 'grocery', 'produce', 'meat', 'dairy', 'vegetable', 'fruit'];
      return groceryKeywords.some(keyword => productName.toLowerCase().includes(keyword));
    } catch (error) {
      console.error("Error in determine_product_type:", error);
      return false;
    }
  }

  function calculate_tax(isGrocery, province, productPrice) {
    // Tax rates for different provinces and territories
    const taxRates = {
      // 5% GST provinces and territories
      'AB': { grocery: 0, nonGrocery: 0.05 },  // Alberta
      'BC': { grocery: 0, nonGrocery: 0.05 },  // British Columbia
      'MB': { grocery: 0, nonGrocery: 0.05 },  // Manitoba
      'NT': { grocery: 0, nonGrocery: 0.05 },  // Northwest Territories
      'NU': { grocery: 0, nonGrocery: 0.05 },  // Nunavut
      'QC': { grocery: 0, nonGrocery: 0.05 },  // Quebec
      'SK': { grocery: 0, nonGrocery: 0.05 },  // Saskatchewan
      'YT': { grocery: 0, nonGrocery: 0.05 },  // Yukon

      // 13% HST provinces
      'ON': { grocery: 0, nonGrocery: 0.13 },  // Ontario

      // 15% HST provinces
      'NB': { grocery: 0, nonGrocery: 0.15 },  // New Brunswick
      'NL': { grocery: 0, nonGrocery: 0.15 },  // Newfoundland and Labrador
      'NS': { grocery: 0, nonGrocery: 0.15 },  // Nova Scotia
      'PE': { grocery: 0, nonGrocery: 0.15 },  // Prince Edward Island

      // Default rate (if province is unknown)
      'Unknown': { grocery: 0, nonGrocery: 0.13 }
    };

    // Get the appropriate rate based on province and product type
    const rate = taxRates[province]?.[isGrocery ? 'grocery' : 'nonGrocery'] || 0.13;
    
    // Handle undefined or null productPrice
    if (!productPrice) {
      console.error("Product price is undefined or null");
      return {
        rate: rate,
        amount: 0,
        total: 0
      };
    }

    // Extract numeric price value
    const numericPrice = parseFloat(productPrice.toString().replace(/[^0-9.-]+/g, ''));
    
    // Handle invalid price
    if (isNaN(numericPrice)) {
      console.error("Invalid product price:", productPrice);
      return {
        rate: rate,
        amount: 0,
        total: 0
      };
    }
    
    // Calculate tax amount
    const taxAmount = numericPrice * rate;
    
    // Log the tax calculation details for debugging
    console.log(`Tax Calculation:
      Province: ${province}
      Is Grocery: ${isGrocery}
      Tax Rate: ${(rate * 100).toFixed(1)}%
      Product Price: $${numericPrice.toFixed(2)}
      Tax Amount: $${taxAmount.toFixed(2)}`);
    
    return {
      rate: rate,
      amount: taxAmount,
      total: numericPrice + taxAmount
    };
  }

  function display_results(taxInfo, productInfo) {
    try {
      // Handle undefined or null taxInfo
      if (!taxInfo) {
        console.error("Tax information is undefined or null");
        return "Error: Tax information not available";
      }

      // Parse product info if it's a string
      let info;
      if (typeof productInfo === 'string') {
        try {
          info = JSON.parse(productInfo);
        } catch (parseError) {
          console.error("Error parsing product info:", parseError);
          info = {
            ProductName: 'Unknown Product',
            ProductPrice: '$0.00',
            DeliveryAddress: 'Unknown Address'
          };
        }
      } else {
        info = productInfo || {
          ProductName: 'Unknown Product',
          ProductPrice: '$0.00',
          DeliveryAddress: 'Unknown Address'
        };
      }
      
      // Create a combined result object
      const results = {
        ProductName: info.ProductName || 'Unknown Product',
        ProductPrice: info.ProductPrice || '$0.00',
        DeliveryAddress: info.DeliveryAddress || 'Unknown Address',
        taxInfo: {
          rate: taxInfo.rate || 0,
          amount: taxInfo.amount || 0,
          total: taxInfo.total || 0
        }
      };

      // Send message to popup to update the UI
      chrome.runtime.sendMessage({
        type: 'UPDATE_POPUP',
        data: results
      });

      // Return formatted string for logging
      return `Tax Calculation Results:
        Product: ${results.ProductName}
        Price: ${results.ProductPrice}
        Delivery Address: ${results.DeliveryAddress}
        Tax Rate: ${((results.taxInfo.rate || 0) * 100).toFixed(1)}%
        Tax Amount: $${((results.taxInfo.amount || 0)).toFixed(2)}
        Total Amount: $${((results.taxInfo.total || 0)).toFixed(2)}`;
    } catch (error) {
      console.error("Error in display_results:", error);
      return "Error displaying results";
    }
  }

  // Define the function map within the execution context
  const functionMap = {
    "get_product_info": get_product_info,
    "determine_product_type": determine_product_type,
    "determine_delivery_location": determine_delivery_location,
    "calculate_tax": calculate_tax,
    "display_results": display_results
  };

  // Function to call functions from the map
  async function functionCaller(funcName, params) {
    console.log("Calling function:", funcName, "with params:", params);
    if (funcName in functionMap) {
      let functionParams;
      
      // Handle comma-separated parameters for specific functions
      if (funcName === "calculate_tax" && typeof params === 'string') {
        functionParams = params.split(',').map(param => {
          // Convert string 'true'/'false' to boolean for isGrocery
          if (param.trim() === 'true') return true;
          if (param.trim() === 'false') return false;
          // Try to convert to number for price
          const num = parseFloat(param);
          return isNaN(num) ? param.trim() : num;
        });
      } else {
        functionParams = [params];
      }

      const func = functionMap[funcName];
      const result = await func(...functionParams);
      
      // Special handling for get_product_info result
      if (funcName === "get_product_info") {
        try {
          const productInfo = JSON.parse(result);
          console.log("Parsed product info:", productInfo);
          return result;
        } catch (error) {
          console.error("Error parsing product info:", error);
          return result;
        }
      }
      
      return result;
    } else {
      return `Function ${funcName} not found`;
    }
  }

  try {
    const apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
    
    const system_prompt = `You are a tax calculator agent solving problems in iterations. Respond with following format: \n
    1. FUNCTION_CALL: javascript_function_name|input \n
    2. RESPONSE: formatted response to the user's request \n

    where javascript_function_name is the name of the following: \n
    1. get_product_info It gets the active tab, extracts information from the page and returns ProductName, DeliveryAddress, and ProductPrice  \n
    2. determine_product_type(ProductName) It determines if the product is a grocery item or not and returns a boolean isGrocery \n
    3. determine_delivery_location(DeliveryAddress) It determines the province from the delivery address and returns the Province \n
    4. calculate_tax(isGrocery, Province, ProductPrice) It calculates the tax amount based on the product type and province and returns an object with rate, amount, and total \n
    5. display_results(taxInfo, ProductPrice, ProductName) It displays the tax calculation results and product information in the popup \n

    DO NOT include multiple responses. Give ONE response at a time.`;

    let current_query = "I have an ecommerce product web page opened, help me calculate estimated taxes on this product.";
    let iteration = 0;
    const maxIterations = 5; 
    let lastResponse = null;
    let iterationResponse = [];
    let iterationResult = null;
    let lastFunctionName = null;
    let lastParams = null;

    while (iteration < maxIterations) {
      console.log(`\n--- Iteration ${iteration + 1} ---`);
      
      if (lastResponse === null) {
        current_query = current_query + "  What should I do next?";
        console.log(current_query);
      } else {
        current_query = current_query + "\n\n" + iterationResponse.join(" ");
        current_query = current_query + "  What should I do next?";
        console.log(current_query);
      }

      const prompt = `${system_prompt} Query: ${current_query}`;
      console.log(prompt);

      const response = await fetch(`${apiUrl}?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }]
        })
      });

      const data = await response.json();
      const responseText = data.candidates[0].content.parts[0].text;
      console.log(responseText);

      if (responseText.startsWith("1. FUNCTION_CALL:")) {
        const [, functionInfo] = responseText.split(":", 2);
        const [funcName, params] = functionInfo.split("|", 2).map(x => x.trim());
        console.log("Function name:", funcName);
        lastFunctionName = funcName;
        lastParams = params;
        iterationResult = await functionCaller(funcName, params);
      } else if (responseText.startsWith("FINAL_ANSWER:")) {
        console.log("\n=== Agent Execution Complete ===");
        break;
      }

      console.log(`Result: ${iterationResult}`);
      lastResponse = iterationResult;
      
      if (lastFunctionName && lastParams) {
        iterationResponse.push(`In the ${iteration + 1} iteration you called ${lastFunctionName} with ${lastParams} parameters, and the function returned ${iterationResult}.`);
      } else {
        iterationResponse.push(`In the ${iteration + 1} iteration, the response was: ${responseText}`);
      }
      
      iteration++;
    }

    // After the while loop ends, update the popup with the final results
    if (lastFunctionName === "display_results") {
      try {
        let finalResult;
        if (typeof lastParams === 'string') {
          finalResult = JSON.parse(lastParams);
        } else {
          finalResult = lastParams;
        }
        
        if (iterationResult && typeof iterationResult === 'object') {
          finalResult.taxInfo = iterationResult;
        } else if (typeof iterationResult === 'string') {
          try {
            finalResult.taxInfo = JSON.parse(iterationResult);
          } catch (error) {
            console.error("Error parsing iteration result:", error);
          }
        }
        
        console.log("Updating popup with final result:", finalResult);
        updatePopup(finalResult);
      } catch (error) {
        console.error("Error updating popup with final results:", error);
      }
    }
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    return 'Unable to calculate product taxes information at this time.';
  }
}

