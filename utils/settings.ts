import AsyncStorage from '@react-native-async-storage/async-storage';

const OCR_MODE_KEY = '@snap_receipt:ocr_mode';
const SHOP_NAME_KEY = '@snap_receipt:shop_name';
const PRINT_MARGIN_KEY = '@snap_receipt:print_margin_mm';
const PRINT_TEMPLATE_KEY = '@snap_receipt:print_template';
const AUTO_PRINTER_KEY = '@snap_receipt:auto_printer';

export type OCRMode = 'vision' | 'generative';
export type PrintTemplateId = 'classic' | 'compact' | 'kitchen';

/**
 * Get the current OCR mode preference
 */
export async function getOCRMode(): Promise<OCRMode> {
  try {
    const mode = await AsyncStorage.getItem(OCR_MODE_KEY);
    return (mode as OCRMode) || 'vision'; // Default to vision
  } catch (error) {
    console.error('Error getting OCR mode:', error);
    return 'vision';
  }
}

/**
 * Set the OCR mode preference
 */
export async function setOCRMode(mode: OCRMode): Promise<void> {
  try {
    await AsyncStorage.setItem(OCR_MODE_KEY, mode);
  } catch (error) {
    console.error('Error setting OCR mode:', error);
  }
}

/**
 * Get the Auto Printer setting
 */
export async function getAutoPrinter(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(AUTO_PRINTER_KEY);
    return value === 'true'; // Default to false
  } catch (error) {
    console.error('Error getting auto printer setting:', error);
    return false;
  }
}

/**
 * Set the Auto Printer setting
 */
export async function setAutoPrinter(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(AUTO_PRINTER_KEY, enabled ? 'true' : 'false');
  } catch (error) {
    console.error('Error setting auto printer setting:', error);
  }
}

/**
 * Get the shop name for printing header
 */
export async function getShopName(): Promise<string> {
  try {
    const value = await AsyncStorage.getItem(SHOP_NAME_KEY);
    return value || '';
  } catch (error) {
    console.error('Error getting shop name:', error);
    return '';
  }
}

/**
 * Set the shop name for printing header
 */
export async function setShopName(name: string): Promise<void> {
  try {
    await AsyncStorage.setItem(SHOP_NAME_KEY, name);
  } catch (error) {
    console.error('Error setting shop name:', error);
  }
}

/**
 * Get the print margin (mm) applied to all sides
 */
export async function getPrintMargin(): Promise<number> {
  try {
    const value = await AsyncStorage.getItem(PRINT_MARGIN_KEY);
    const parsed = value ? parseFloat(value) : NaN;
    return isNaN(parsed) ? 8 : parsed; // default 8mm
  } catch (error) {
    console.error('Error getting print margin:', error);
    return 8;
  }
}

/**
 * Set the print margin (mm) applied to all sides
 */
export async function setPrintMargin(mm: number): Promise<void> {
  try {
    await AsyncStorage.setItem(PRINT_MARGIN_KEY, String(mm));
  } catch (error) {
    console.error('Error setting print margin:', error);
  }
}

/**
 * Get selected print template id
 */
export async function getPrintTemplate(): Promise<PrintTemplateId> {
  try {
    const value = await AsyncStorage.getItem(PRINT_TEMPLATE_KEY);
    if (value === 'compact' || value === 'kitchen' || value === 'classic') return value;
    return 'classic';
  } catch (error) {
    console.error('Error getting print template:', error);
    return 'classic';
  }
}

/**
 * Set selected print template id
 */
export async function setPrintTemplate(id: PrintTemplateId): Promise<void> {
  try {
    await AsyncStorage.setItem(PRINT_TEMPLATE_KEY, id);
  } catch (error) {
    console.error('Error setting print template:', error);
  }
}

