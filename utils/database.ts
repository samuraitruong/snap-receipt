/**
 * Database utility for saving receipts to Turso (LibSQL)
 */

import { createClient } from '@libsql/client/web';

const TURSO_URL = process.env.EXPO_PUBLIC_TURSO_URL || '';
const TURSO_TOKEN = process.env.EXPO_PUBLIC_TURSO_TOKEN || '';

/**
 * Get local date string in YYYY-MM-DD format (not UTC)
 * This ensures dates are saved based on the user's local timezone
 */
export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

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

/**
 * Initialize database - create receipts table if it doesn't exist
 */
export async function initDatabase(): Promise<void> {
  if (!isDatabaseConfigured()) {
    console.log('Database not configured, skipping initialization');
    return;
  }

  try {
    const client = getClient();
    await client.execute(`
      CREATE TABLE IF NOT EXISTS receipts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        total_price REAL NOT NULL,
        receipt_data TEXT NOT NULL,
        order_number TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      )
    `);
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}

/**
 * Receipt data structure
 */
export interface ReceiptRecord {
  id?: number;
  date: string; // ISO date string
  total_price: number;
  receipt_data: string; // JSON stringified receipt data
  order_number?: string;
  created_at?: string;
}

/**
 * Save a receipt to the database
 */
export async function saveReceipt(receipt: Omit<ReceiptRecord, 'id' | 'created_at'>): Promise<number> {
  if (!isDatabaseConfigured()) {
    throw new Error('Database not configured');
  }

  try {
    const client = getClient();
    const result = await client.execute({
      sql: `
        INSERT INTO receipts (date, total_price, receipt_data, order_number)
        VALUES (?, ?, ?, ?)
      `,
      args: [
        receipt.date,
        receipt.total_price,
        receipt.receipt_data,
        receipt.order_number || null,
      ],
    });
    
    return Number(result.lastInsertRowid);
  } catch (error) {
    console.error('Error saving receipt:', error);
    throw error;
  }
}

/**
 * Get receipts by date
 */
export async function getReceiptsByDate(date: string): Promise<ReceiptRecord[]> {
  if (!isDatabaseConfigured()) {
    return [];
  }

  try {
    const client = getClient();
    const result = await client.execute({
      sql: `
        SELECT * FROM receipts 
        WHERE date(date) = date(?)
        ORDER BY created_at DESC
      `,
      args: [date],
    });

    return result.rows.map(row => ({
      id: Number(row.id),
      date: String(row.date),
      total_price: Number(row.total_price),
      receipt_data: String(row.receipt_data),
      order_number: row.order_number ? String(row.order_number) : undefined,
      created_at: row.created_at ? String(row.created_at) : undefined,
    }));
  } catch (error) {
    console.error('Error getting receipts by date:', error);
    return [];
  }
}

/**
 * Get last N receipts for today
 */
export async function getTodayReceipts(limit: number = 5): Promise<ReceiptRecord[]> {
  if (!isDatabaseConfigured()) {
    return [];
  }

  try {
    const today = getLocalDateString();
    const client = getClient();
    const result = await client.execute({
      sql: `
        SELECT * FROM receipts 
        WHERE date(date) = date(?)
        ORDER BY created_at DESC
        LIMIT ?
      `,
      args: [today, limit],
    });

    return result.rows.map(row => ({
      id: Number(row.id),
      date: String(row.date),
      total_price: Number(row.total_price),
      receipt_data: String(row.receipt_data),
      order_number: row.order_number ? String(row.order_number) : undefined,
      created_at: row.created_at ? String(row.created_at) : undefined,
    }));
  } catch (error) {
    console.error('Error getting today receipts:', error);
    return [];
  }
}

/**
 * Get last N receipts from any date, ordered by most recent first
 */
export async function getRecentReceipts(limit: number = 5): Promise<ReceiptRecord[]> {
  if (!isDatabaseConfigured()) {
    return [];
  }

  try {
    const client = getClient();
    const result = await client.execute({
      sql: `
        SELECT * FROM receipts 
        ORDER BY created_at DESC
        LIMIT ?
      `,
      args: [limit],
    });

    return result.rows.map(row => ({
      id: Number(row.id),
      date: String(row.date),
      total_price: Number(row.total_price),
      receipt_data: String(row.receipt_data),
      order_number: row.order_number ? String(row.order_number) : undefined,
      created_at: row.created_at ? String(row.created_at) : undefined,
    }));
  } catch (error) {
    console.error('Error getting recent receipts:', error);
    return [];
  }
}

/**
 * Get all receipts ordered by date descending
 */
export async function getAllReceipts(): Promise<ReceiptRecord[]> {
  if (!isDatabaseConfigured()) {
    return [];
  }

  try {
    const client = getClient();
    const result = await client.execute({
      sql: `
        SELECT * FROM receipts 
        ORDER BY date DESC, created_at DESC
      `,
    });

    return result.rows.map(row => ({
      id: Number(row.id),
      date: String(row.date),
      total_price: Number(row.total_price),
      receipt_data: String(row.receipt_data),
      order_number: row.order_number ? String(row.order_number) : undefined,
      created_at: row.created_at ? String(row.created_at) : undefined,
    }));
  } catch (error) {
    console.error('Error getting all receipts:', error);
    return [];
  }
}

/**
 * Get unique dates that have receipts
 */
export async function getAvailableDates(): Promise<string[]> {
  if (!isDatabaseConfigured()) {
    return [];
  }

  try {
    const client = getClient();
    const result = await client.execute({
      sql: `
        SELECT DISTINCT date(date) as date
        FROM receipts
        ORDER BY date DESC
      `,
    });

    return result.rows.map(row => String(row.date));
  } catch (error) {
    console.error('Error getting available dates:', error);
    return [];
  }
}

