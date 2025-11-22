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

import { extractTokenUsage, recordAPIUsage } from './aiCostTracker';

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

export interface ReceiptCustomer {
  name?: string;
  phone?: string;
}

export interface ReceiptData {
  items: ReceiptItem[];
  total: number; // Total price (GST inclusive)
  customer?: ReceiptCustomer; // Optional customer info
}

/**
 * Extract and format receipt directly from image(s) using Google Generative AI
 * Sends image(s) directly to Gemini (no Vision API needed)
 * This is more efficient than the two-step process
 * Supports single image or multiple images for multi-page receipts
 */
export async function extractReceiptFromImageWithGenerativeAI(
  base64Image: string | string[],
  isMultiPage: boolean = false
): Promise<ReceiptData> {
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
   - Extract the price shown on the line EXACTLY as printed (this is the line total, already including quantity when quantity is shown)
   - NEVER attempt to calculate or divide a unit price—just copy the printed line amount
   - If the same product name appears multiple times with different modifiers or prices, each is a SEPARATE item
   - Example: If you see "Burger" with "no onions" and "$10.00", and "Burger" with "extra cheese" and "$12.00", list them as two separate items
   - IMPORTANT: Only extract what you see - do not add or modify anything

4. Modifiers - CRITICAL RULES:
   - ONLY extract modifiers that are EXPLICITLY visible in the receipt image
   - DO NOT add modifiers that are not visible in the receipt
   - DO NOT infer or assume modifiers based on product names
   - DO NOT add modifiers just because a product might commonly have them
   - Modifiers can appear in different formats:
     * On the same line as the product (e.g., "Burger - no onions")
     * On a separate line below the product (e.g., "Family Pack"  with "2 X Grilled Flake" below it)
     * Indented or visually associated with the product above
   - IMPORTANT: If text appears below a product item WITHOUT its own price, it is likely a modifier of that product
   - Quantity-based modifiers (like "2x Grilled Flake", "2 X Grilled Flake", "3x Large") should be extracted as-is, including the quantity
   - Modifiers should be text-only (no prices, no dollar amounts)
   - The price belongs to the main product, NOT to individual modifiers
   - If a product has NO modifiers visible in the receipt image, you MUST omit the modifiers field completely (do not include an empty array)
   - Only include modifiers if they are clearly written/printed on the receipt
   - Distinguish modifiers from separate items: If text has its own price on the same line, it's a separate item, not a modifier

5. Menu Accuracy & Validation:
   - Some POS layouts show reference menus or modifiers on side panels—IGNORE these unless they are clearly part of the purchased items list.
   - NEVER invent random menu entries; only capture lines that belong to the actual purchased items.
   - After extracting all items, calculate the sum of the item prices (each price already includes its quantity).
   - That calculated sum MUST match the Total amount identified in section 2 (allow a tolerance of ±$0.01 for rounding).
   - If the numbers do not match, re-check the items and fix mistakes before returning the JSON.

6. Customer Information (OPTIONAL):
   - If the receipt clearly shows a customer name and/or phone number (e.g., loyalty info), capture it.
   - Only record details that are explicitly printed on the receipt (e.g., "Customer: Jane Doe", "Phone: 0400 123 456").
   - Do NOT invent or infer customer details that are not visible.
   - Return customer info under a "customer" object with "name" and/or "phone" keys.
   - If only one field is present, include just that field. If no customer info exists, omit the "customer" object entirely.

7. Return Format:
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
       "total": 110.00,
       "customer": {
         "name": "Jane Doe",
         "phone": "0400 123 456"
       }
     }
   - All prices should be numbers (not strings)
   - All quantities should be numbers (not strings)
   - Product names should be strings
   - Modifiers should be an array of strings (or omit if empty)
   - The "customer" object is optional and should only be present when at least one customer field exists

Example JSON output (only include modifiers if they are visible in the receipt, and only include customer info when it exists on the receipt):
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
      "name": "Family Flake Pack",
      "quantity": 1,
      "price": 55.20,
      "modifiers": ["2 X Grilled Flake"]
    },
    {
      "name": "FRIES",
      "quantity": 3,
      "price": 15.50
    }
  ],
  "total": 110.00,
  "customer": {
    "name": "Jane Doe",
    "phone": "0400 123 456"
  }
}

Note: In the example above, modifiers are only shown IF they are visible in the receipt. If FRIES had no modifiers visible, do not add any modifiers field for it.
Note: The "Family Flake Pack" example shows how to handle modifiers that appear on separate lines below the main item (like "2 X Grilled Flake"). These should be extracted as modifiers, not as separate items.

KEY POINTS:
- Extract the Total from the TOP of the receipt (it's the final total price)
- The Total already includes GST (10% inclusive)
- Extract quantity as a number (1 if not shown)
- Extract price as a number without $ sign
- CRITICAL: Only extract modifiers that are ACTUALLY VISIBLE in the receipt image
- CRITICAL: Pay special attention to text that appears below a product item - if it has no price, it's likely a modifier
- CRITICAL: Quantity-based modifiers (like "2x Grilled Flake", "2 X Grilled Flake") should be captured as modifiers, not separate items
- DO NOT add modifiers that are not in the receipt - if you don't see them, don't include them
- If a product has no visible modifiers, omit the modifiers field completely
- Each product with different modifiers or price is a separate item
- Return ONLY the JSON, no other text
- Be strict: only parse what you see, don't add anything
- Customer info is optional; include it ONLY when name and/or phone are clearly printed
- Verify that the sum of item prices equals the receipt total before responding

JSON response:`;

    // Handle single or multiple images
    const images = Array.isArray(base64Image) ? base64Image : [base64Image];
    
    // Build parts array with prompt and all images
    const parts: any[] = [{ text: prompt }];
    
    // Add all images to the parts array
    for (const img of images) {
      let imageData = img;
      let mimeType = 'image/jpeg'; // default
      
      // Check if image is a data URL
      if (img.startsWith('data:')) {
        const mimeMatch = img.match(/data:([^;]+);base64,/);
        if (mimeMatch) {
          mimeType = mimeMatch[1];
          imageData = img.split(',')[1];
        }
      }
      
      parts.push({
        inline_data: {
          mime_type: mimeType,
          data: imageData
        }
      });
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_ID}:generateContent?key=${GOOGLE_AI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: parts
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

    // Extract token usage from API response
    const tokenUsage = extractTokenUsage(data);
    if (tokenUsage) {
      console.log('AI API Token Usage:', {
        promptTokens: tokenUsage.promptTokens,
        candidatesTokens: tokenUsage.candidatesTokens,
        totalTokens: tokenUsage.totalTokens,
      });
    }

    // Record API usage and cost
    try {
      const requestSize = JSON.stringify({
        contents: [{
          parts: parts.map((p, i) => 
            i === 0 ? p : { inline_data: { mime_type: 'image/jpeg', data: '...' } }
          )
        }]
      }).length;
      const responseSize = responseText.length;
      
      // Calculate total image size for better estimation if token usage is not available
      const totalImageSize = images.reduce((sum, img) => {
        const imgData = img.startsWith('data:') ? img.split(',')[1] : img;
        return sum + imgData.length;
      }, 0);
      
      const usage = await recordAPIUsage(
        MODEL_ID,
        tokenUsage,
        requestSize,
        responseSize,
        prompt.length, // Pass prompt text length
        totalImageSize // Pass total image size for better estimation
      );
      
      console.log('AI API Cost:', {
        model: usage.model,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        totalTokens: usage.totalTokens,
        estimatedCost: `$${usage.estimatedCost.toFixed(6)}`,
      });
    } catch (costError) {
      console.warn('Failed to record API usage:', costError);
      // Don't fail the request if cost tracking fails
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
      if (receiptData.customer !== undefined) {
        if (
          receiptData.customer === null ||
          typeof receiptData.customer !== 'object' ||
          Array.isArray(receiptData.customer)
        ) {
          throw new Error('Invalid JSON structure: customer must be an object when provided');
        }
        if (
          receiptData.customer.name !== undefined &&
          typeof receiptData.customer.name !== 'string'
        ) {
          throw new Error('Invalid JSON structure: customer.name must be a string');
        }
        if (
          receiptData.customer.phone !== undefined &&
          typeof receiptData.customer.phone !== 'string'
        ) {
          throw new Error('Invalid JSON structure: customer.phone must be a string');
        }
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
 * Sends image(s) directly to Generative AI (no Vision API needed)
 * Supports single or multiple images for multi-page receipts
 */
export async function extractAndFormatWithGenerativeAI(
  base64Image: string | string[],
  isMultiPage: boolean = false
): Promise<ReceiptData> {
  return await extractReceiptFromImageWithGenerativeAI(base64Image, isMultiPage);
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
 * Supports single or multiple images for multi-page receipts
 */
export async function extractTextFromImageWithMode(
  base64Image: string | string[], 
  mode: 'vision' | 'generative',
  isMultiPage: boolean = false
): Promise<string | ReceiptData> {
  if (mode === 'generative') {
    return await extractAndFormatWithGenerativeAI(base64Image, isMultiPage);
  } else {
    // Vision mode only supports single image
    const singleImage = Array.isArray(base64Image) ? base64Image[0] : base64Image;
    return await extractTextFromImage(singleImage);
  }
}

