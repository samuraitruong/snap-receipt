import AsyncStorage from '@react-native-async-storage/async-storage';

const OCR_MODE_KEY = '@snap_receipt:ocr_mode';

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

