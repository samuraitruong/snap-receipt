/**
 * OCR Utility for extracting text from images
 * 
 * To use Google Cloud Vision API:
 * 1. Get an API key from Google Cloud Console
 * 2. Enable the Vision API
 * 3. Set your API key in environment variables or replace the placeholder below
 * 
 * To use Google Generative AI:
 * 1. Get an API key from Google AI Studio
 * 2. Set EXPO_PUBLIC_GOOGLE_AI_KEY in environment variables
 * 3. Optionally set EXPO_PUBLIC_MODEL_ID (default: gemini-pro)
 *    Available models: gemini-pro, gemini-1.5-pro, gemini-1.5-flash, etc.
 */

const GOOGLE_VISION_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_VISION_API_KEY || '';
const GOOGLE_AI_KEY = process.env.EXPO_PUBLIC_GOOGLE_AI_KEY || '';
const MODEL_ID = process.env.EXPO_PUBLIC_MODEL_ID || 'gemini-pro';

/**
 * Extract text from image using Google Cloud Vision API
 */
export async function extractTextWithGoogleVision(base64Image: string): Promise<string> {
  if (!GOOGLE_VISION_API_KEY || GOOGLE_VISION_API_KEY === '') {
    throw new Error('Google Vision API key not configured. Please set EXPO_PUBLIC_GOOGLE_VISION_API_KEY');
  }

  try {
    const response = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: [{
            image: { content: base64Image },
            features: [{ type: 'TEXT_DETECTION', maxResults: 1 }]
          }]
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Google Vision API error: ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    const extractedText = data.responses[0]?.fullTextAnnotation?.text || '';
    
    if (!extractedText && data.responses[0]?.error) {
      throw new Error(`OCR Error: ${JSON.stringify(data.responses[0].error)}`);
    }

    return extractedText;
  } catch (error) {
    console.error('Google Vision API Error:', error);
    throw error;
  }
}


/**
 * Format receipt text using Google Generative AI
 * Takes raw OCR text and formats it nicely with products and modifiers
 */
export async function formatReceiptWithGenerativeAI(rawText: string): Promise<string> {
  if (!GOOGLE_AI_KEY || GOOGLE_AI_KEY === '') {
    throw new Error('Google AI key not configured. Please set EXPO_PUBLIC_GOOGLE_AI_KEY');
  }

  if (!rawText || rawText.trim() === '') {
    throw new Error('No text provided to format');
  }

  try {
    console.log('Formatting receipt with Generative AI, model:', MODEL_ID);
    console.log('Raw text length:', rawText.length);
    const prompt = `You are a receipt formatting assistant. Format the following receipt text into a clean, readable format with proper alignment.

CRITICAL FORMATTING RULES:
1. Store Information: DO NOT include store name, address, date, or time - these will be added by the app. Start directly with product items.

2. Total Identification:
   - The "Total" label and amount appears at the TOP of the receipt (before product items)
   - This Total line is NOT a product item - it is a summary line
   - DO NOT include the Total line as a product item
   - Identify this Total amount and use it ONLY for calculating Subtotal and GST
   - Skip the Total line and start listing actual product items

3. Product Items - Basic Format:
   - Each product/item on its own line
   - ALWAYS extract and display quantity if present (e.g., "1x", "2x", "3x" before the product name)
   - Format: "1x PRODUCT NAME" or "2x PRODUCT NAME" or "3x PRODUCT NAME"
   - Product name with quantity on the LEFT
   - Price on the RIGHT (aligned to the right side)
   - Use consistent spacing (at least 20-30 spaces between name and price)
   - Prices should ONLY appear on the main product line, NEVER on modifier lines

4. Product Items - Multiple Items with Same Name:
   - If the same product name appears multiple times with different modifiers or prices, each is a SEPARATE item
   - List each occurrence separately with its own quantity and price
   - Example: If you see "Burger" with "no onions" and "$10.00", and "Burger" with "extra cheese" and "$12.00", list them as two separate items

5. Modifiers:
   - If a product has modifiers (like "no onions", "extra cheese", "add bacon"), list them as indented sub-items using 2 spaces
   - Modifiers should be text-only (no prices, no dollar amounts)
   - The price belongs to the main product line above the modifiers, NOT to individual modifiers
   - Each modifier on its own line, indented under the product
6. Summary Section:
   - The TOTAL price already includes GST (10% inclusive)
   - Calculate Subtotal and GST from the Total amount found at the top of the receipt
   - Formula: Subtotal = Total × (100/110), GST = Total × (10/110)
   - Example: If Total is $110.00, then Subtotal = $100.00 and GST = $10.00
   - Display Subtotal and GST at the bottom (label left, amount right)
   - Use "GST" label, NOT "Tax"
   - DO NOT display "Total" or "TOTAL" at the bottom - only show Subtotal and GST

7. Return ONLY the formatted receipt text, no explanations or comments

Example format:
1x BURGER                        $10.99
  - No onions
  - Extra cheese

2x BURGER                        $12.50
  - Add bacon
  - Extra cheese

3x FRIES                         $15.50

Subtotal:                      $90.91
GST:                            $9.09

KEY POINTS:
- ALWAYS include quantity (1x, 2x, 3x, etc.) before product names
- If the same product appears multiple times with different modifiers or prices, list each separately
- The Total line at the top is NOT a product - skip it and use it only for calculation
- Prices go on the main product line, NOT on modifier lines
- Modifiers are indented text-only lines below the product

Raw receipt text:
${rawText}

Formatted receipt:`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_ID}:generateContent?key=${GOOGLE_AI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }]
        })
      }
    );

    // Get response text first to check if it's empty
    const responseText = await response.text();
    console.log('AI API response status:', response.status, response.statusText);
    console.log('AI API response length:', responseText?.length || 0);
    
    if (!response.ok) {
      // Try to parse error data, but handle if it's not valid JSON
      let errorData;
      try {
        errorData = responseText ? JSON.parse(responseText) : { error: 'Unknown error' };
      } catch (parseError) {
        errorData = { 
          error: `HTTP ${response.status}: ${response.statusText}`,
          message: responseText || 'No error details available'
        };
      }
      throw new Error(`Google AI API error (${response.status}): ${JSON.stringify(errorData)}`);
    }

    // Check if response is empty
    if (!responseText || responseText.trim() === '') {
      throw new Error('Empty response from Google AI API');
    }

    // Parse JSON response
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse AI response:', responseText);
      throw new Error(`Invalid JSON response from AI API: ${parseError}`);
    }

    // Check for errors in response
    if (data.error) {
      throw new Error(`Google AI API error: ${JSON.stringify(data.error)}`);
    }

    const formattedText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    if (!formattedText) {
      // Check if there's an error in the response
      if (data.candidates?.[0]?.finishReason === 'SAFETY' || data.candidates?.[0]?.finishReason === 'RECITATION') {
        throw new Error(`Content blocked by safety filter (finishReason: ${data.candidates[0].finishReason})`);
      }
      throw new Error('No formatted text returned from AI. Response: ' + JSON.stringify(data));
    }

    return formattedText.trim();
  } catch (error) {
    console.error('Google Generative AI Error:', error);
    throw error;
  }
}

/**
 * Extract and format text using Google Generative AI (Vision + Formatting)
 * This uses Vision API to extract text, then Generative AI to format it
 */
export async function extractAndFormatWithGenerativeAI(base64Image: string): Promise<string> {
  // First extract text using Vision API
  if (!GOOGLE_VISION_API_KEY || GOOGLE_VISION_API_KEY === '') {
    throw new Error('Google Vision API key not configured. Please set EXPO_PUBLIC_GOOGLE_VISION_API_KEY');
  }

  let rawText = '';
  try {
    rawText = await extractTextWithGoogleVision(base64Image);
    if (!rawText || rawText.trim() === '') {
      throw new Error('No text extracted from image. Please try again with a clearer image.');
    }
  } catch (error) {
    console.error('Vision API failed:', error);
    throw new Error(`Failed to extract text from image: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Then format it using Generative AI
  if (!GOOGLE_AI_KEY || GOOGLE_AI_KEY === '') {
    throw new Error('Google AI key not configured. Please set EXPO_PUBLIC_GOOGLE_AI_KEY');
  }

  try {
    return await formatReceiptWithGenerativeAI(rawText);
  } catch (error) {
    console.error('Generative AI formatting failed:', error);
    throw new Error(`Failed to format receipt: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Main OCR function - uses Google Vision API to extract text from image
 */
export async function extractTextFromImage(base64Image: string): Promise<string> {
  if (!GOOGLE_VISION_API_KEY || GOOGLE_VISION_API_KEY === '') {
    throw new Error('Google Vision API key not configured. Please set EXPO_PUBLIC_GOOGLE_VISION_API_KEY');
  }

  try {
    const extractedText = await extractTextWithGoogleVision(base64Image);
    if (!extractedText || extractedText.trim() === '') {
      throw new Error('No text extracted from image. Please try again with a clearer image.');
    }
    return extractedText;
  } catch (error) {
    console.error('Google Vision API failed:', error);
    throw new Error(`Failed to extract text from image: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Extract text with mode selection
 */
export async function extractTextFromImageWithMode(
  base64Image: string, 
  mode: 'vision' | 'generative'
): Promise<string> {
  if (mode === 'generative') {
    return await extractAndFormatWithGenerativeAI(base64Image);
  } else {
    return await extractTextFromImage(base64Image);
  }
}

