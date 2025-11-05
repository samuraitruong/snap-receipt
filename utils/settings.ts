import AsyncStorage from '@react-native-async-storage/async-storage';

const OCR_MODE_KEY = '@snap_receipt:ocr_mode';
const AUTO_PRINTER_KEY = '@snap_receipt:auto_printer';

export type OCRMode = 'vision' | 'generative';

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

