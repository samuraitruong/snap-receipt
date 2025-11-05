# OCR Setup Guide

This app uses Google Cloud Vision API for OCR text extraction. Currently, it's configured to use demo text for testing purposes.

## Setup Google Cloud Vision API (Optional)

To enable real OCR functionality:

### 1. Get a Google Cloud Vision API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Cloud Vision API**:
   - Navigate to "APIs & Services" > "Library"
   - Search for "Cloud Vision API"
   - Click "Enable"

### 2. Create an API Key

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "API Key"
3. Copy your API key
4. (Optional) Restrict the API key to Cloud Vision API for security

### 3. Configure the API Key

Create a `.env` file in the root directory:

```env
EXPO_PUBLIC_GOOGLE_VISION_API_KEY=your_api_key_here
```

Or you can directly edit `utils/ocr.ts` and replace the `GOOGLE_VISION_API_KEY` constant.

### 4. Restart the App

After setting the API key, restart your Expo development server:

```bash
npm start
```

## Current Behavior

- **Without API Key**: The app uses demo receipt text for testing
- **With API Key**: The app extracts real text from captured images using Google Cloud Vision API

## Cost

Google Cloud Vision API has a free tier:
- First 1,000 requests per month are free
- After that, $1.50 per 1,000 requests

For testing and development, the free tier should be sufficient.

## Alternative OCR Solutions

If you prefer not to use Google Cloud Vision API, you can:

1. Use other cloud OCR services (AWS Textract, Azure Computer Vision, etc.)
2. Implement a custom OCR solution
3. Modify `utils/ocr.ts` to use your preferred OCR service

