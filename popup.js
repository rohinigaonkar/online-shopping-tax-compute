import config from './config.js';

const apiKey = config.GEMINI_API_KEY;
document.addEventListener('DOMContentLoaded', function() {
  const extractButton = document.getElementById('extractButton');
  
  // Listen for messages from the content script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'UPDATE_PRODUCT_DISPLAY') {
      updateProductDisplay(message.data);
    } else if (message.type === 'UPDATE_TAX_DISPLAY') {
      updateTaxDisplay(message.data);
    } else if (message.type === 'SET_ERROR_STATE') {
      setErrorState();
    }
  });
  
  extractButton.addEventListener('click', async () => {
    try {
      // Show loading state
      updatePopup({
        ProductName: 'Processing...',
        ProductPrice: 'Processing...',
        taxInfo: null
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
        ProductName: 'Error occurred',
        ProductPrice: '-',
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

    // Update product information section
    updateProductDisplay(info);

    // Update tax information section
    if (info.taxInfo) {
      updateTaxDisplay(info.taxInfo);
    } else {
      setLoadingState();
    }
  } catch (error) {
    console.error("Error updating popup:", error);
    setErrorState();
  }
}

function updateProductDisplay(info) {
  document.getElementById('productName').textContent = info.ProductName || 'Processing...';
  document.getElementById('productPrice').textContent = info.ProductPrice || 'Processing...';
}

function updateTaxDisplay(taxInfo) {
  try {
    // Format tax rate with percentage
    const formattedRate = `${((taxInfo.rate || 0) * 100).toFixed(1)}%`;
    document.getElementById('taxRate').textContent = formattedRate;

    // Format monetary values with currency symbol and 2 decimal places
    const formattedAmount = `$${(taxInfo.amount || 0).toFixed(2)}`;
    document.getElementById('taxAmount').textContent = formattedAmount;

    const formattedTotal = `$${(taxInfo.total || 0).toFixed(2)}`;
    document.getElementById('totalAmount').textContent = formattedTotal;

    // Remove any loading or error states
    removeLoadingState();
  } catch (error) {
    console.error("Error updating tax display:", error);
    setErrorState();
  }
}

function setLoadingState() {
  const loadingText = 'Processing...';
  document.getElementById('taxRate').textContent = loadingText;
  document.getElementById('taxAmount').textContent = loadingText;
  document.getElementById('totalAmount').textContent = loadingText;

  // Add loading class for styling
  ['taxRate', 'taxAmount', 'totalAmount'].forEach(id => {
    document.getElementById(id).classList.add('processing');
  });
}

function setErrorState() {
  const errorText = 'Error';
  document.getElementById('taxRate').textContent = errorText;
  document.getElementById('taxAmount').textContent = errorText;
  document.getElementById('totalAmount').textContent = errorText;

  // Add error class for styling
  ['taxRate', 'taxAmount', 'totalAmount'].forEach(id => {
    document.getElementById(id).classList.add('error');
  });
}

function removeLoadingState() {
  // Remove loading and error classes
  ['taxRate', 'taxAmount', 'totalAmount'].forEach(id => {
    const element = document.getElementById(id);
    element.classList.remove('processing', 'error');
  });
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
        //console.log("Found address in location slot:", address);
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
            //console.log("Found address using selector:", selector, ":", text);
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
        //console.log("Found address from postal code/province:", address);
        return address;
      }

      //console.log("No address found in the page");
      return null;
    }

    const productInfo = {
      ProductName: findTitle(),
      ProductPrice: findPrice(),
      DeliveryAddress: findAddress()
    };

    // Log the extracted information for debugging
    //console.log('Extracted Product Information:', productInfo);
    
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

      //console.log("Processing address:", address);

      // Call Gemini API to determine province
      const apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

      const prompt = `Given this delivery address: "${address}", determine which Canadian province or territory it belongs to. 
      If the address contains a province name or code, use that. If not, try to infer from city names or postal codes. Respond with ONLY the province code (ON, QC, BC, AB, MB, SK, NS, NB, NL, PE, YT, NT, NU) or "Unknown" if you cannot determine it. Do not include any other text or explanation. `;

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
      
      //console.log("Determined province code:", provinceCode);
      
      // Validate the province code
      const validProvinces = ['ON', 'QC', 'BC', 'AB', 'MB', 'SK', 'NS', 'NB', 'NL', 'PE', 'YT', 'NT', 'NU'];
      return validProvinces.includes(provinceCode) ? provinceCode : 'Unknown';
    } catch (error) {
      console.error("Error in determine_delivery_location:", error);
      return 'Unknown';
    }
  }

  async function determine_product_type(productInfo) {
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

      // Call Gemini API to determine if product is grocery
      const apiUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';
      
      const prompt = `Based on the provided product name, identify if the product is a grocery item. ONLY provide response in a one word - True OR False. Where if the product is a grocery item, return TRUE. If the product is not a grocery item or you are unsure, return FALSE.

      Product name: "${productName}"`;

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

      //console.log(`Prompt "${prompt}"`);

      const data = await response.json();
      const result = data.candidates[0].content.parts[0].text.trim().toLowerCase() === 'true';
      //console.log(`Product type determination for "${productName}", is Grocery?: ${result}`);
      return result;

    } catch (error) {
      console.error("Error in determine_product_type:", error);
      return false;
    }
  }

  function calculate_tax(isGrocery, province, productPrice) {
    // Add detailed logging of input parameters
    //console.log("calculate_tax received parameters:", {
    //  isGrocery,
    //  isGroceryType: typeof isGrocery,
    //  province,
    //  productPrice
    //});

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
    const provinceRates = taxRates[province] || taxRates['Unknown'];
    const rate = provinceRates[isGrocery ? 'grocery' : 'nonGrocery'];
    
    // Add logging for rate selection
    //console.log("Rate selection:", {
    //  province,
    //  isGrocery,
    //  selectedRate: rate,
    //  availableRates: taxRates[province]
    //});

    //console.log(`Tax rate for ${province}, ${isGrocery ? 'Grocery' : 'Non-Grocery'}: ${rate}`);
    
    // Handle undefined or null productPrice
    if (!productPrice) {
      console.error("Product price is undefined or null");
      return `${rate},0,0`;
    }

    // Extract numeric price value
    const numericPrice = parseFloat(productPrice.toString().replace(/[^0-9.-]+/g, ''));
    
    // Handle invalid price
    if (isNaN(numericPrice)) {
      console.error("Invalid product price:", productPrice);
      return `${rate},0,0`;
    }
    
    // Calculate tax amount
    const taxAmount = numericPrice * rate;
    
    // Return comma-separated string values: rate,taxAmount,total
    return `${rate},${taxAmount},${numericPrice + taxAmount}`;
  }

  // Define UI update functions in the content script context
  function updateProductDisplay(info) {
    chrome.runtime.sendMessage({
      type: 'UPDATE_PRODUCT_DISPLAY',
      data: info
    });
  }

  function updateTaxDisplay(taxInfo) {
    chrome.runtime.sendMessage({
      type: 'UPDATE_TAX_DISPLAY',
      data: taxInfo
    });
  }

  function setErrorState() {
    chrome.runtime.sendMessage({
      type: 'SET_ERROR_STATE'
    });
  }

  function display_results(taxRate, taxAmount, totalAmount, productPrice, productName) {
    try {
      // Format the values for display
      const formattedPrice = productPrice ? (productPrice.startsWith('$') ? productPrice : `$${productPrice}`) : 'N/A';
      const rate = parseFloat(taxRate);
      const amount = parseFloat(taxAmount);
      const total = parseFloat(totalAmount);

      // Create the result object for the popup
      const results = {
        ProductName: productName || 'N/A',
        ProductPrice: formattedPrice,
        DeliveryAddress: 'N/A', // Not needed for final display
        taxInfo: {
          rate: rate,
          amount: amount,
          total: total
        }
      };

      // Update UI using the content script functions
      updateProductDisplay(results);
      updateTaxDisplay(results.taxInfo);

      // Return formatted string for logging
      return `Tax calculation complete:
        Product Information:
        - Name: ${productName || 'N/A'}
        - Price: ${formattedPrice}
        
        Tax Information:
        - Rate: ${(rate * 100).toFixed(1)}%
        - Amount: $${amount.toFixed(2)}
        
        Total Amount: $${total.toFixed(2)}`;
    } catch (error) {
      console.error("Error in display_results:", error);
      setErrorState();
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
    //console.log("Calling function:", funcName, "with params:", params);
    if (funcName in functionMap) {
      let functionParams;
      
      // Handle parameters based on function name
      if (funcName === "calculate_tax" && typeof params === 'string') {
        functionParams = params.split(',').map(param => {
          const trimmedParam = param.trim();
          // Convert string 'true'/'false' to boolean for isGrocery
          if (trimmedParam === 'true') return true;
          if (trimmedParam === 'false') return false;
          // Try to convert to number for price
          const num = parseFloat(trimmedParam);
          return isNaN(num) ? trimmedParam : num;
        });
        //console.log("Processed calculate_tax parameters:", functionParams);
      } else if (funcName === "display_results") {
        // For display_results, keep parameters as simple string values
        functionParams = typeof params === 'string' ? params.split(',').map(param => param.trim()) : [params];
      } else {
        functionParams = [params];
      }

      const func = functionMap[funcName];
      const result = await func(...functionParams);
      
      // Special handling for get_product_info result
      if (funcName === "get_product_info") {
        try {
          const productInfo = JSON.parse(result);
          //console.log("Parsed product info:", productInfo);
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
    FUNCTION_CALL: javascript_function_name|input \n

    where javascript_function_name is the name of the following: \n
    1. get_product_info It gets the active tab, extracts information from the page and returns ProductName, DeliveryAddress, and ProductPrice  \n
    2. determine_product_type(ProductName) It determines if the product is a grocery item or not and returns a boolean isGrocery \n
    3. determine_delivery_location(DeliveryAddress) It takes the delivery address as input and returns the Province code only. Only call this function, do not try to infer the province from the address.\n
    4. calculate_tax(isGrocery, Province, ProductPrice) It calculates the tax amount based on the product type and province and returns an object with rate, amount, and total \n
    5. display_results(TaxRate, TaxAmount, TotalAmount, ProductPrice, ProductName) It updates the product information and tax calculation results in the Chrome extension popup user interface for the end user \n

    DO NOT include multiple responses. Give ONE response at a time. Send input in the correct order of the function parameters and in the correct format.`;

    let current_query = "I have an ecommerce product web page opened, help me calculate estimated taxes on this product and display the results in the Chrome extension popup user interface for the end user.";
    let iteration = 0;
    const maxIterations = 5; 
    let lastResponse = null;
    let iterationResponse = [];
    let iterationResult = null;
    let lastFunctionName = null;
    let lastParams = null;

    //console.log(system_prompt);

    while (iteration < maxIterations) {
      console.log(`\n --- Iteration ${iteration + 1} ---`);
      
      if (lastResponse === null) {
        current_query = current_query + "  What should I do next?";
        //console.log(current_query);
      } else {
        current_query = current_query + "\n\n" + iterationResponse.join(" ");
        current_query = current_query + "  What should I do next?";
        //console.log(current_query);
      }

      //console.log(current_query);

      const prompt = `${system_prompt} Query: ${current_query}`;
      //console.log(prompt);

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

      if (responseText.startsWith("FUNCTION_CALL:")) {
        const [, functionInfo] = responseText.split(":", 2);
        const [funcName, params] = functionInfo.split("|", 2).map(x => x.trim());
        //console.log("Function name:", funcName);
        lastFunctionName = funcName;
        lastParams = params;
        iterationResult = await functionCaller(funcName, params);
      } 
      
      //else if (responseText.startsWith("FINAL_ANSWER:")) {
      //  console.log("\n=== Agent Execution Complete ===");
      //  break;
      //}

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
          // Parse the comma-separated values from display_results
          const [taxRate, taxAmount, totalAmount, productPrice, productName] = lastParams.split(',').map(param => param.trim());
          
          finalResult = {
            ProductName: productName || 'N/A',
            ProductPrice: productPrice ? (productPrice.startsWith('$') ? productPrice : `$${productPrice}`) : 'N/A',
            DeliveryAddress: 'N/A',
            taxInfo: {
              rate: parseFloat(taxRate),
              amount: parseFloat(taxAmount),
              total: parseFloat(totalAmount)
            }
          };
        } else {
          finalResult = lastParams;
        }
        
        console.log("Final result:", finalResult);
        console.log("\n=== Agent Execution Complete ===");
        // No need to call updatePopup here since we're already sending messages
      } catch (error) {
        console.error("Error processing final results:", error);
      }
    }
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    return 'Unable to calculate product taxes information at this time.';
  }
}

