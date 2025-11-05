/**
 * OCR Utility for extracting text from images
 * 
 * To use Google Cloud Vision API:
 * 1. Get an API key from Google Cloud Console
 * 2. Enable the Vision API
 * 3. Set your API key in environment variables or replace the placeholder below
 * 
 * To use Google Generative AI (Recommended - more efficient):
 * 1. Get an API key from Google AI Studio
 * 2. Set EXPO_PUBLIC_GOOGLE_AI_KEY in environment variables
 * 3. Optionally set EXPO_PUBLIC_MODEL_ID (default: gemini-pro)
 *    Available models: gemini-pro, gemini-1.5-pro, gemini-1.5-flash, etc.
 *    Note: Generative AI can now receive images directly - no Vision API needed!
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
 * Receipt data structure returned by AI
 */
export interface ReceiptItem {
  name: string;
  quantity: number;
  price: number; // Price as a number (without $ sign)
  modifiers?: string[]; // Optional array of modifier strings
}

export interface ReceiptData {
  items: ReceiptItem[];
  total: number; // Total price (GST inclusive)
}

/**
 * Extract and format receipt directly from image using Google Generative AI
 * Sends image directly to Gemini (no Vision API needed)
 * This is more efficient than the two-step process
 */
export async function extractReceiptFromImageWithGenerativeAI(base64Image: string): Promise<ReceiptData> {
  if (!GOOGLE_AI_KEY || GOOGLE_AI_KEY === '') {
    throw new Error('Google AI key not configured. Please set EXPO_PUBLIC_GOOGLE_AI_KEY');
  }

  try {
    console.log('Extracting receipt directly from image with Generative AI, model:', MODEL_ID);
    
    const prompt = `You are a receipt parsing assistant. Analyze this receipt image and extract structured data, returning it as JSON.

CRITICAL EXTRACTION RULES - STRICT PARSING ONLY:
- ONLY extract information that is EXPLICITLY visible in the receipt image
- DO NOT add, infer, or assume any information that is not in the receipt
- DO NOT modify items or add modifiers that are not visible
- Parse exactly what you see, nothing more, nothing less

1. Store Information: DO NOT include store name, address, date, or time - ignore these completely.

2. Total Identification:
   - The "Total" label and amount appears at the TOP of the receipt (before product items)
   - This Total line is NOT a product item - it is a summary line with the final total price
   - CRITICAL: Identify and extract the Total amount from the top of the receipt
   - This Total price already INCLUDES GST (10% GST is included in the total)
   - Extract the numeric value of the total (e.g., if you see "$110.00" or "Total: $110.00", extract 110.00)

3. Product Items:
   - Extract each product/item as a separate entry
   - ALWAYS extract quantity if present (e.g., "1x", "2x", "3x" before the product name)
   - If no quantity is shown, assume quantity is 1
   - Extract the product name EXACTLY as it appears in the receipt (without quantity prefix)
   - DO NOT modify product names or add information that is not visible
   - Extract the price as a numeric value (without $ sign, e.g., "10.99" not "$10.99")
   - If the same product name appears multiple times with different modifiers or prices, each is a SEPARATE item
   - Example: If you see "Burger" with "no onions" and "$10.00", and "Burger" with "extra cheese" and "$12.00", list them as two separate items
   - IMPORTANT: Only extract what you see - do not add or modify anything

4. Modifiers - CRITICAL RULES:
   - ONLY extract modifiers that are EXPLICITLY visible in the receipt image
   - DO NOT add modifiers that are not visible in the receipt
   - DO NOT infer or assume modifiers based on product names
   - DO NOT add modifiers just because a product might commonly have them
   - If a product has modifiers visible in the receipt (like "no onions", "extra cheese", "add bacon"), extract them as an array
   - Modifiers should be text-only (no prices, no dollar amounts)
   - The price belongs to the main product, NOT to individual modifiers
   - If a product has NO modifiers visible in the receipt image, you MUST omit the modifiers field completely (do not include an empty array)
   - Only include modifiers if they are clearly written/printed on the receipt

5. Return Format:
   - Return ONLY valid JSON, no explanations or comments
   - Use this exact structure:
     {
       "items": [
         {
           "name": "Product Name",
           "quantity": 1,
           "price": 10.99,
           "modifiers": ["No onions", "Extra cheese"]
         }
       ],
       "total": 110.00
     }
   - All prices should be numbers (not strings)
   - All quantities should be numbers (not strings)
   - Product names should be strings
   - Modifiers should be an array of strings (or omit if empty)

Example JSON output (only include modifiers if they are visible in the receipt):
{
  "items": [
    {
      "name": "BURGER",
      "quantity": 1,
      "price": 10.99,
      "modifiers": ["No onions", "Extra cheese"]
    },
    {
      "name": "BURGER",
      "quantity": 2,
      "price": 12.50,
      "modifiers": ["Add bacon", "Extra cheese"]
    },
    {
      "name": "FRIES",
      "quantity": 3,
      "price": 15.50
    }
  ],
  "total": 110.00
}

Note: In the example above, modifiers are only shown IF they are visible in the receipt. If FRIES had no modifiers visible, do not add any modifiers field for it.

KEY POINTS:
- Extract the Total from the TOP of the receipt (it's the final total price)
- The Total already includes GST (10% inclusive)
- Extract quantity as a number (1 if not shown)
- Extract price as a number without $ sign
- CRITICAL: Only extract modifiers that are ACTUALLY VISIBLE in the receipt image
- DO NOT add modifiers that are not in the receipt - if you don't see them, don't include them
- If a product has no visible modifiers, omit the modifiers field completely
- Each product with different modifiers or price is a separate item
- Return ONLY the JSON, no other text
- Be strict: only parse what you see, don't add anything

JSON response:`;

    // Determine mime type from base64 string (assuming it might have data URL prefix)
    let imageData = base64Image;
    let mimeType = 'image/jpeg'; // default
    
    // Check if base64Image is a data URL
    if (base64Image.startsWith('data:')) {
      const mimeMatch = base64Image.match(/data:([^;]+);base64,/);
      if (mimeMatch) {
        mimeType = mimeMatch[1];
        imageData = base64Image.split(',')[1];
      }
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_ID}:generateContent?key=${GOOGLE_AI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              {
                text: prompt
              },
              {
                inline_data: {
                  mime_type: mimeType,
                  data: imageData
                }
              }
            ]
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

    const aiResponseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    if (!aiResponseText) {
      // Check if there's an error in the response
      if (data.candidates?.[0]?.finishReason === 'SAFETY' || data.candidates?.[0]?.finishReason === 'RECITATION') {
        throw new Error(`Content blocked by safety filter (finishReason: ${data.candidates[0].finishReason})`);
      }
      throw new Error('No response text returned from AI. Response: ' + JSON.stringify(data));
    }

    // Parse the JSON response
    let receiptData: ReceiptData;
    try {
      // Clean the response text - remove any markdown code blocks if present
      let cleanedText = aiResponseText.trim();
      // Remove markdown code blocks if present
      if (cleanedText.startsWith('```')) {
        cleanedText = cleanedText.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }
      
      receiptData = JSON.parse(cleanedText);
      
      // Validate the structure
      if (!receiptData || typeof receiptData !== 'object') {
        throw new Error('Invalid JSON structure: root is not an object');
      }
      if (!Array.isArray(receiptData.items)) {
        throw new Error('Invalid JSON structure: items is not an array');
      }
      if (typeof receiptData.total !== 'number') {
        throw new Error('Invalid JSON structure: total is not a number');
      }
      
      // Validate items
      receiptData.items.forEach((item, index) => {
        if (!item.name || typeof item.name !== 'string') {
          throw new Error(`Invalid item at index ${index}: name is missing or not a string`);
        }
        if (typeof item.quantity !== 'number' || item.quantity < 1) {
          throw new Error(`Invalid item at index ${index}: quantity is missing or invalid`);
        }
        if (typeof item.price !== 'number' || item.price < 0) {
          throw new Error(`Invalid item at index ${index}: price is missing or invalid`);
        }
        if (item.modifiers && !Array.isArray(item.modifiers)) {
          throw new Error(`Invalid item at index ${index}: modifiers is not an array`);
        }
      });
      
    } catch (parseError) {
      console.error('Failed to parse AI JSON response:', aiResponseText);
      throw new Error(`Failed to parse JSON response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
    }

    return receiptData;
  } catch (error) {
    console.error('Google Generative AI Error:', error);
    throw error;
  }
}

/**
 * Extract and format receipt using Google Generative AI
 * Sends image directly to Generative AI (no Vision API needed)
 */
export async function extractAndFormatWithGenerativeAI(base64Image: string): Promise<ReceiptData> {
  return await extractReceiptFromImageWithGenerativeAI(base64Image);
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
 * Returns ReceiptData for 'generative' mode, or raw text string for 'vision' mode
 */
export async function extractTextFromImageWithMode(
  base64Image: string, 
  mode: 'vision' | 'generative'
): Promise<string | ReceiptData> {
  if (mode === 'generative') {
    return await extractAndFormatWithGenerativeAI(base64Image);
  } else {
    return await extractTextFromImage(base64Image);
  }
}

