# Product Information Extractor Chrome Extension

This Chrome extension helps you extract product information from various e-commerce websites. It can identify and display product names, prices, descriptions, and delivery addresses.

## Features

- Extracts product information from web pages
- Displays product name, price, description, and delivery address
- Works on multiple e-commerce websites
- Clean and user-friendly interface

## Installation

1. Download or clone this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the directory containing these files

## Usage

1. Navigate to any product page on an e-commerce website
2. Click the extension icon in your Chrome toolbar
3. Click the "Extract Information" button
4. The extracted information will be displayed in the popup window

## Files Structure

- `manifest.json`: Extension configuration file
- `popup.html`: The popup interface
- `popup.js`: Popup functionality
- `content.js`: Content script for extracting information
- `images/`: Directory containing extension icons

## Note

The extension uses common CSS selectors to find product information. It may not work on all websites if they use custom or non-standard HTML structures. The effectiveness depends on the website's structure and how the information is presented. 