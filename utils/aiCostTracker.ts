/**
 * AI Cost Tracker Utility
 * 
 * Tracks AI API usage and costs for Google Gemini API
 * Estimates costs based on token usage or request/response sizes
 * Uses Turso (cloud SQLite) database for storage
 */

import { createClient } from '@libsql/client/web';
import { getLocalDateString } from './database';

const TURSO_URL = process.env.EXPO_PUBLIC_TURSO_URL || '';
const TURSO_TOKEN = process.env.EXPO_PUBLIC_TURSO_TOKEN || '';

/**
 * Check if database is configured
 */
function isDatabaseConfigured(): boolean {
  return !!(TURSO_URL && TURSO_TOKEN);
}

/**
 * Get database client
 */
function getClient() {
  if (!isDatabaseConfigured()) {
    throw new Error('Turso database not configured. Please set EXPO_PUBLIC_TURSO_URL and EXPO_PUBLIC_TURSO_TOKEN');
  }
  return createClient({
    url: TURSO_URL,
    authToken: TURSO_TOKEN,
  });
}

// Google Gemini API pricing (as of 2024)
// These are approximate rates - check Google AI Studio for current pricing
const GEMINI_PRICING = {
  'gemini-pro': {
    input: 0.0005 / 1000,  // $0.0005 per 1K tokens
    output: 0.0015 / 1000, // $0.0015 per 1K tokens
  },
  'gemini-1.5-pro': {
    input: 0.00125 / 1000,  // $0.00125 per 1K tokens
    output: 0.005 / 1000,   // $0.005 per 1K tokens
  },
  'gemini-1.5-flash': {
    input: 0.075 / 1000,     // $0.075 per 1M tokens (very cheap)
    output: 0.30 / 1000,     // $0.30 per 1M tokens
  },
};

// Default pricing if model not found
const DEFAULT_PRICING = {
  input: 0.001 / 1000,   // $0.001 per 1K tokens
  output: 0.002 / 1000,  // $0.002 per 1K tokens
};

export interface TokenUsage {
  promptTokens?: number;
  candidatesTokens?: number;
  totalTokens?: number;
}

export interface APIUsage {
  id?: number;
  timestamp: number;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number;
  requestSize?: number; // bytes
  responseSize?: number; // bytes
  date?: string;
  created_at?: string;
}

/**
 * Extract token usage from Google Gemini API response
 */
export function extractTokenUsage(data: any): TokenUsage | null {
  try {
    // Google Gemini API includes usageMetadata in the response
    const usageMetadata = data.usageMetadata;
    if (usageMetadata) {
      return {
        promptTokens: usageMetadata.promptTokenCount || 0,
        candidatesTokens: usageMetadata.candidatesTokenCount || 0,
        totalTokens: usageMetadata.totalTokenCount || 0,
      };
    }
    
    // Fallback: check for usage field (some API versions)
    const usage = data.usage;
    if (usage) {
      return {
        promptTokens: usage.prompt_tokens || usage.promptTokens || 0,
        candidatesTokens: usage.completion_tokens || usage.candidatesTokens || 0,
        totalTokens: usage.total_tokens || usage.totalTokens || 0,
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error extracting token usage:', error);
    return null;
  }
}

/**
 * Estimate tokens from text/image size
 * Rough estimation: 1 token ≈ 4 characters for text
 * For images: estimate based on image size (very rough)
 */
export function estimateTokensFromSize(
  promptText: string,
  imageBase64?: string
): { inputTokens: number; outputTokens: number } {
  // Estimate input tokens
  let inputTokens = Math.ceil(promptText.length / 4); // ~4 chars per token
  
  // Estimate image tokens (very rough - actual tokens depend on resolution, not file size)
  // Gemini processes images in 256x256 tiles, each tile = 256 tokens
  // For a typical receipt image:
  // - If 1024x2048 pixels = 4x8 tiles = 32 tiles = ~8,192 tokens
  // - If 512x1024 pixels = 2x4 tiles = 8 tiles = ~2,048 tokens
  // - We estimate based on file size as a proxy for resolution
  if (imageBase64) {
    const imageSize = imageBase64.length;
    // Base64 is ~33% larger than binary, so estimate actual image size
    const estimatedImageSize = (imageSize * 3) / 4;
    
    // Very rough estimate: assume ~1-2KB per tile
    // For a 100KB image, estimate ~50-100 tiles = ~12,800-25,600 tokens
    // This is conservative - actual tokens may be higher for high-res images
    const estimatedTiles = Math.ceil(estimatedImageSize / 2000); // ~2KB per tile
    const imageTokens = estimatedTiles * 256; // 256 tokens per tile
    
    inputTokens += imageTokens;
    
    console.log('Image token estimation:', {
      imageSizeBytes: estimatedImageSize,
      estimatedTiles,
      estimatedImageTokens: imageTokens,
      note: 'Actual tokens depend on image resolution, not file size. This is a rough estimate.'
    });
  }
  
  // Estimate output tokens (JSON response, typically 200-500 tokens)
  const outputTokens = 300; // Average estimate for receipt JSON
  
  return { inputTokens, outputTokens };
}

/**
 * Calculate cost based on token usage and model
 */
export function calculateCost(
  inputTokens: number,
  outputTokens: number,
  model: string = 'gemini-pro'
): number {
  const pricing = GEMINI_PRICING[model as keyof typeof GEMINI_PRICING] || DEFAULT_PRICING;
  
  const inputCost = inputTokens * pricing.input;
  const outputCost = outputTokens * pricing.output;
  
  return inputCost + outputCost;
}

/**
 * Record API usage to database
 */
export async function recordAPIUsage(
  model: string,
  tokenUsage: TokenUsage | null,
  requestSize?: number,
  responseSize?: number,
  promptTextLength?: number,
  totalImageSize?: number
): Promise<APIUsage> {
  if (!isDatabaseConfigured()) {
    console.warn('Database not configured, skipping API usage recording');
    // Return a mock usage object
    return {
      timestamp: Date.now(),
      model,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      estimatedCost: 0,
      requestSize,
      responseSize,
    };
  }

  let inputTokens = 0;
  let outputTokens = 0;
  let totalTokens = 0;
  
  if (tokenUsage) {
    // Use actual token counts from API (includes image tokens in promptTokens)
    inputTokens = tokenUsage.promptTokens || 0;
    outputTokens = tokenUsage.candidatesTokens || 0;
    totalTokens = tokenUsage.totalTokens || 0;
    
    console.log('Using API token counts (includes image tokens):', {
      inputTokens,
      outputTokens,
      totalTokens,
      note: 'promptTokens already includes both text prompt and image tokens'
    });
  } else {
    // Estimate if token usage not available
    // Use provided prompt text and image size for better estimation
    const promptText = promptTextLength ? 'x'.repeat(promptTextLength) : '';
    const imageBase64 = totalImageSize ? 'x'.repeat(Math.floor(totalImageSize * 4 / 3)) : undefined; // Approximate base64 size
    const estimated = estimateTokensFromSize(promptText, imageBase64);
    inputTokens = estimated.inputTokens;
    outputTokens = estimated.outputTokens;
    totalTokens = inputTokens + outputTokens;
    
    console.warn('Token usage not available from API, using estimation:', {
      inputTokens,
      outputTokens,
      totalTokens,
      promptLength: promptTextLength || 0,
      imageSize: totalImageSize || 0,
      note: 'This is a rough estimate. Actual tokens may vary significantly, especially for images.'
    });
  }
  
  const estimatedCost = calculateCost(inputTokens, outputTokens, model);
  const timestamp = Date.now();
  const date = getLocalDateString();
  
  try {
    const client = getClient();
    const result = await client.execute({
      sql: `
        INSERT INTO ai_usage (
          timestamp, date, model, input_tokens, output_tokens, 
          total_tokens, estimated_cost, request_size, response_size
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      args: [
        timestamp,
        date,
        model,
        inputTokens,
        outputTokens,
        totalTokens,
        estimatedCost,
        requestSize || null,
        responseSize || null,
      ],
    });
    
    return {
      id: Number(result.lastInsertRowid),
      timestamp,
      model,
      inputTokens,
      outputTokens,
      totalTokens,
      estimatedCost,
      requestSize,
      responseSize,
      date,
    };
  } catch (error) {
    console.error('Error recording API usage:', error);
    // Return usage object even if database save fails
    return {
      timestamp,
      model,
      inputTokens,
      outputTokens,
      totalTokens,
      estimatedCost,
      requestSize,
      responseSize,
      date,
    };
  }
}

/**
 * Get daily usage for today
 */
export async function getDailyUsage(): Promise<APIUsage[]> {
  if (!isDatabaseConfigured()) {
    return [];
  }

  try {
    const today = getLocalDateString();
    const client = getClient();
    const result = await client.execute({
      sql: `
        SELECT * FROM ai_usage 
        WHERE date = ?
        ORDER BY timestamp DESC
      `,
      args: [today],
    });

    return result.rows.map(row => ({
      id: Number(row.id),
      timestamp: Number(row.timestamp),
      model: String(row.model),
      inputTokens: Number(row.input_tokens),
      outputTokens: Number(row.output_tokens),
      totalTokens: Number(row.total_tokens),
      estimatedCost: Number(row.estimated_cost),
      requestSize: row.request_size ? Number(row.request_size) : undefined,
      responseSize: row.response_size ? Number(row.response_size) : undefined,
      date: String(row.date),
      created_at: row.created_at ? String(row.created_at) : undefined,
    }));
  } catch (error) {
    console.error('Error getting daily usage:', error);
    return [];
  }
}

/**
 * Get total usage statistics
 */
export async function getTotalUsage(): Promise<{
  totalRequests: number;
  totalTokens: number;
  totalCost: number;
  byModel: Record<string, { requests: number; tokens: number; cost: number }>;
}> {
  if (!isDatabaseConfigured()) {
    return {
      totalRequests: 0,
      totalTokens: 0,
      totalCost: 0,
      byModel: {},
    };
  }

  try {
    const client = getClient();
    
    // Get total stats
    const totalResult = await client.execute({
      sql: `
        SELECT 
          COUNT(*) as total_requests,
          SUM(total_tokens) as total_tokens,
          SUM(estimated_cost) as total_cost
        FROM ai_usage
      `,
    });

    const totalRow = totalResult.rows[0];
    const totalRequests = Number(totalRow.total_requests) || 0;
    const totalTokens = Number(totalRow.total_tokens) || 0;
    const totalCost = Number(totalRow.total_cost) || 0;

    // Get stats by model
    const byModelResult = await client.execute({
      sql: `
        SELECT 
          model,
          COUNT(*) as requests,
          SUM(total_tokens) as tokens,
          SUM(estimated_cost) as cost
        FROM ai_usage
        GROUP BY model
      `,
    });

    const byModel: Record<string, { requests: number; tokens: number; cost: number }> = {};
    byModelResult.rows.forEach(row => {
      byModel[String(row.model)] = {
        requests: Number(row.requests) || 0,
        tokens: Number(row.tokens) || 0,
        cost: Number(row.cost) || 0,
      };
    });

    return {
      totalRequests,
      totalTokens,
      totalCost,
      byModel,
    };
  } catch (error) {
    console.error('Error getting total usage:', error);
    return {
      totalRequests: 0,
      totalTokens: 0,
      totalCost: 0,
      byModel: {},
    };
  }
}

/**
 * Get today's cost summary
 */
export async function getTodayCostSummary(): Promise<{
  requests: number;
  tokens: number;
  cost: number;
}> {
  if (!isDatabaseConfigured()) {
    return {
      requests: 0,
      tokens: 0,
      cost: 0,
    };
  }

  try {
    const today = getLocalDateString();
    const client = getClient();
    const result = await client.execute({
      sql: `
        SELECT 
          COUNT(*) as requests,
          SUM(total_tokens) as tokens,
          SUM(estimated_cost) as cost
        FROM ai_usage
        WHERE date = ?
      `,
      args: [today],
    });

    const row = result.rows[0];
    return {
      requests: Number(row.requests) || 0,
      tokens: Number(row.tokens) || 0,
      cost: Number(row.cost) || 0,
    };
  } catch (error) {
    console.error('Error getting today cost summary:', error);
    return {
      requests: 0,
      tokens: 0,
      cost: 0,
    };
  }
}

/**
 * Clear all usage data
 */
export async function clearUsageData(): Promise<void> {
  if (!isDatabaseConfigured()) {
    console.warn('Database not configured, cannot clear usage data');
    return;
  }

  try {
    const client = getClient();
    await client.execute({
      sql: 'DELETE FROM ai_usage',
    });
    console.log('AI usage data cleared successfully');
  } catch (error) {
    console.error('Error clearing usage data:', error);
    throw error;
  }
}
