# Simple Agentic AI Chrome Plugin

This Chrome extension demonstrates a simple implementation of an agentic AI system that helps extract and process product information from various e-commerce websites (currently supports Amazon). It showcases how AI can interact with web content through a structured workflow.

## Purpose

E-commerce websites typically display product prices without including taxes, which are only shown at checkout. This creates a common pain point for shoppers who want to know the total cost upfront without going through the checkout process. For example, on Amazon, you would need to:
1. Add the item to cart
2. Proceed to checkout
3. Enter delivery address
4. Review the order

Only then would you see the final price including taxes. This plugin solves this problem by:
- Extracting the base price directly from the product page
- Calculating estimated taxes based on the delivery location
- Showing the total cost (including taxes) instantly

This saves time and helps make informed purchasing decisions without the need to go through the checkout process.

## How It Works

The extension uses a combination of web scraping and AI to calculate taxes. Here's the process:

1. **Information Extraction**:
   - `get_product_info()`: Orchestrates the entire process and calls other functions
        - `findTitle()`: Extracts the product name from the page
        - `findPrice()`: Gets the product price from various possible locations
        - `findAddress()`: Retrieves the delivery address from the page

2. **Location Determination**:
   - `determine_delivery_location()`: Uses the extracted address to identify the delivery province
   - Currently supports all Canadian provinces and territories

3. **Product Classification**:
   - `determine_product_type()`: Analyzes the product to classify it as either grocery or non-grocery
   - This affects the tax rate applied (groceries have different tax rates)

4. **Tax Calculation**:
   - `calculate_tax()`: Applies the appropriate tax rate based on:
     - Province of delivery
     - Product type (grocery/non-grocery)
     - Base price
   - Supports different tax rates for:
     - Basic goods (groceries)
     - Standard goods
     - Special cases (e.g., books in Ontario)

5. **Result Display**:
   - Shows the base price
   - Displays the applicable tax rate
   - Calculates and shows the tax amount
   - Presents the total price including taxes

## Features

- Extracts product information from web pages
- Displays product name, price, description, and delivery address
- Works on multiple e-commerce websites
- Clean and user-friendly interface
- Implements an agentic AI workflow for information processing

## AI Workflow

The extension implements a simple agentic AI workflow that follows this pattern:

```
Query1 → LLM Response → Tool Call:Tool Result → Query2 → LLM Response → Tool Call:Tool Result → Query3 → LLM Response → Result
```

Each query maintains context from all previous interactions, allowing the AI to build upon previous knowledge and responses. This creates a chain of thought process where:

1. Initial query is made to the LLM
2. LLM analyzes the request and determines necessary actions like calling a local javascript function
3. Tools (javascript functions) are called based on LLM's decision
4. Results are processed and fed back into the next query
5. Process continues until final result is achieved

## Technology Stack

- **LLM**: Google Gemini Flash 2.0
- **IDE**: Cursor (AI-powered code editor)
- **Tools Used**:
  - [Chrome Extension APIs](https://developer.chrome.com/docs/extensions/reference/)
  - [Google Gemini Flash 2.0 API](https://ai.google.dev/)
  - [Cursor AI](https://cursor.sh/)

## Setup

1. Clone this repository
2. Copy `config.template.js` to `config.js`
3. Add your Google Gemini API key in `config.js`
4. Open Chrome and go to `chrome://extensions/`
5. Enable "Developer mode" in the top right corner and open Console - helps debugging
6. Click "Load unpacked" and select the directory containing these files

## Usage

1. Navigate to any product page on an e-commerce website (Amazon Canada)
2. Click the extension icon in your Chrome toolbar
3. Click the "Calculate Tax" button
4. The extracted information and calculated tax will be displayed in the popup window

## Files Structure

- `manifest.json`: Extension configuration file
- `popup.html`: The popup interface
- `popup.js`: Popup functionality and AI workflow implementation
- `content.js`: Content script for extracting information
- `config.js`: API configuration (create from config.template.js)
- `images/`: Directory containing extension icons

## Note

The extension uses common CSS selectors to find product information. It may not work on all websites if they use custom or non-standard HTML structures. The effectiveness depends on the website's structure and how the information is presented. 