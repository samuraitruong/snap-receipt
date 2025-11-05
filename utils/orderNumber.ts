const STARTING_ORDER_NUMBER = 100;

// Get Redis configuration from environment variables
const REDIS_URL = process.env.EXPO_PUBLIC_UPSTASH_REDIS_REST_URL || '';
const REDIS_TOKEN = process.env.EXPO_PUBLIC_UPSTASH_REDIS_REST_TOKEN || '';
const PREFIX = process.env.EXPO_PUBLIC_UPSTASH_PREFIX || 'dev';

/**
 * Check if Redis is configured
 */
function isRedisConfigured(): boolean {
  return !!(REDIS_URL && REDIS_TOKEN);
}

/**
 * Make a REST API call to Upstash Redis
 * Uses Upstash REST API format: POST {URL} with command and args
 */
async function redisCommand(command: string, args: any[] = []): Promise<any> {
  if (!isRedisConfigured()) {
    throw new Error('Redis not configured');
  }

  // Build the command array for Upstash REST API
  // Format: [command, arg1, arg2, ...]
  const commandArray = [command.toUpperCase(), ...args];

  const response = await fetch(REDIS_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${REDIS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commandArray),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Redis API error: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  // Upstash REST API returns the result directly or wrapped
  if (data && typeof data === 'object' && 'result' in data) {
    return data.result;
  }
  return data;
}

/**
 * Get the current date as YYYY-MM-DD string
 */
function getCurrentDate(): string {
  const now = new Date();
  return now.toISOString().split('T')[0]; // Returns YYYY-MM-DD
}

/**
 * Build Redis key with format: prefix_date_counter
 */
function buildRedisKey(date: string): string {
  return `${PREFIX}_${date}_counter`;
}

/**
 * Get the current order number from Redis
 * If it's a new day, the key will be different and return STARTING_ORDER_NUMBER
 */
export async function getCurrentOrderNumber(): Promise<number> {
  try {
    if (!isRedisConfigured()) {
      // Fallback to starting number if Redis not configured
      return STARTING_ORDER_NUMBER;
    }

    const currentDate = getCurrentDate();
    const key = buildRedisKey(currentDate);
    
    // Get current counter value using GET command
    const value = await redisCommand('GET', [key]);
    
    if (value === null || value === undefined) {
      // First time today, initialize with starting number
      await redisCommand('SET', [key, STARTING_ORDER_NUMBER]);
      return STARTING_ORDER_NUMBER;
    }
    
    return parseInt(value, 10);
  } catch (error) {
    console.error('Error getting order number from Redis:', error);
    return STARTING_ORDER_NUMBER;
  }
}

/**
 * Get the next order number and increment it in Redis
 * This should be called when creating a new receipt
 * Uses Redis INCR for atomic increment
 * Key format: prefix_date_counter (e.g., dev_2024-01-15_counter)
 */
export async function getNextOrderNumber(): Promise<number> {
  try {
    if (!isRedisConfigured()) {
      // Fallback if Redis not configured
      return STARTING_ORDER_NUMBER;
    }

    const currentDate = getCurrentDate();
    const key = buildRedisKey(currentDate);
    
    // Check if key exists
    const currentValue = await redisCommand('GET', [key]);
    
    if (currentValue === null || currentValue === undefined) {
      // First receipt of the day
      // Set to STARTING_ORDER_NUMBER - 1 so that when we INCR, it becomes STARTING_ORDER_NUMBER
      await redisCommand('SET', [key, STARTING_ORDER_NUMBER - 1]);
    }
    
    // Atomically increment the counter using INCR
    // This ensures thread-safety across multiple devices/users
    const newValue = await redisCommand('INCR', [key]);
    
    return parseInt(newValue, 10);
  } catch (error) {
    console.error('Error getting next order number from Redis:', error);
    return STARTING_ORDER_NUMBER;
  }
}

/**
 * Reset order number manually (for testing or admin purposes)
 */
export async function resetOrderNumber(): Promise<void> {
  try {
    if (!isRedisConfigured()) {
      return;
    }

    const currentDate = getCurrentDate();
    const key = buildRedisKey(currentDate);
    
    await redisCommand('SET', [key, STARTING_ORDER_NUMBER]);
  } catch (error) {
    console.error('Error resetting order number in Redis:', error);
  }
}

