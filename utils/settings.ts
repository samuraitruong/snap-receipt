import AsyncStorage from '@react-native-async-storage/async-storage';

const OCR_MODE_KEY = '@snap_receipt:ocr_mode';
const SHOP_NAME_KEY = '@snap_receipt:shop_name';
const PRINT_MARGIN_KEY = '@snap_receipt:print_margin_mm';
const PRINT_TEMPLATE_KEY = '@snap_receipt:print_template';
const AUTO_PRINTER_KEY = '@snap_receipt:auto_printer';
const AUTO_SAVE_KEY = '@snap_receipt:auto_save';
const EPSON_PRINTER_MAC_KEY = '@snap_receipt:epson_printer_mac';
const IMAGE_OPTIMIZATION_KEY = '@snap_receipt:image_optimization';
const IMAGE_OPTIMIZATION_QUALITY_KEY = '@snap_receipt:image_optimization_quality';
const IMAGE_OPTIMIZATION_RESIZE_WIDTH_KEY = '@snap_receipt:image_optimization_resize_width';
const PRINT_COPIES_KEY = '@snap_receipt:print_copies';
const PRINTER_TYPE_KEY = '@snap_receipt:printer_type';
const CAMERA_ZOOM_KEY = '@snap_receipt:camera_zoom';
const MULTI_PAGE_CAPTURE_KEY = '@snap_receipt:multi_page_capture';

export type OCRMode = 'vision' | 'generative';
export type PrintTemplateId = 'classic' | 'compact' | 'kitchen';
export type PrinterType = 'system' | 'pos';

/**
 * Get the current OCR mode preference
 */
export async function getOCRMode(): Promise<OCRMode> {
  try {
    const mode = await AsyncStorage.getItem(OCR_MODE_KEY);
    return (mode as OCRMode) || 'generative'; // Default to generative
  } catch (error) {
    console.error('Error getting OCR mode:', error);
    return 'generative';
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

/**
 * Get the Auto Save setting
 */
export async function getAutoSave(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(AUTO_SAVE_KEY);
    return value === 'true'; // Default to false
  } catch (error) {
    console.error('Error getting auto save setting:', error);
    return false;
  }
}

/**
 * Set the Auto Save setting
 */
export async function setAutoSave(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(AUTO_SAVE_KEY, enabled ? 'true' : 'false');
  } catch (error) {
    console.error('Error setting auto save setting:', error);
  }
}

/**
 * Get saved Epson printer MAC address
 */
export async function getEpsonPrinterMac(): Promise<string | null> {
  try {
    return (await AsyncStorage.getItem(EPSON_PRINTER_MAC_KEY)) || null;
  } catch (error) {
    console.error('Error getting Epson printer MAC:', error);
    return null;
  }
}

/**
 * Save Epson printer MAC address
 */
export async function setEpsonPrinterMac(mac: string | null): Promise<void> {
  try {
    if (mac) {
      await AsyncStorage.setItem(EPSON_PRINTER_MAC_KEY, mac);
    } else {
      await AsyncStorage.removeItem(EPSON_PRINTER_MAC_KEY);
    }
  } catch (error) {
    console.error('Error setting Epson printer MAC:', error);
  }
}

/**
 * Get the Image Optimization setting
 */
export async function getImageOptimization(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(IMAGE_OPTIMIZATION_KEY);
    return value === 'true'; // Default to false
  } catch (error) {
    console.error('Error getting image optimization setting:', error);
    return false;
  }
}

/**
 * Set the Image Optimization setting
 */
export async function setImageOptimization(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(IMAGE_OPTIMIZATION_KEY, enabled ? 'true' : 'false');
  } catch (error) {
    console.error('Error setting image optimization setting:', error);
  }
}

/**
 * Get the Image Optimization Quality (0-100)
 */
export async function getImageOptimizationQuality(): Promise<number> {
  try {
    const value = await AsyncStorage.getItem(IMAGE_OPTIMIZATION_QUALITY_KEY);
    const parsed = value ? parseFloat(value) : NaN;
    return isNaN(parsed) ? 70 : Math.max(10, Math.min(100, parsed)); // Default 70, range 10-100
  } catch (error) {
    console.error('Error getting image optimization quality:', error);
    return 70;
  }
}

/**
 * Set the Image Optimization Quality (0-100)
 */
export async function setImageOptimizationQuality(quality: number): Promise<void> {
  try {
    const clamped = Math.max(10, Math.min(100, quality));
    await AsyncStorage.setItem(IMAGE_OPTIMIZATION_QUALITY_KEY, String(clamped));
  } catch (error) {
    console.error('Error setting image optimization quality:', error);
  }
}

/**
 * Get the Image Optimization Resize Width (pixels)
 */
export async function getImageOptimizationResizeWidth(): Promise<number> {
  try {
    const value = await AsyncStorage.getItem(IMAGE_OPTIMIZATION_RESIZE_WIDTH_KEY);
    const parsed = value ? parseFloat(value) : NaN;
    return isNaN(parsed) ? 1024 : Math.max(256, Math.min(4096, parsed)); // Default 1024, range 256-4096
  } catch (error) {
    console.error('Error getting image optimization resize width:', error);
    return 1024;
  }
}

/**
 * Set the Image Optimization Resize Width (pixels)
 */
export async function setImageOptimizationResizeWidth(width: number): Promise<void> {
  try {
    const clamped = Math.max(256, Math.min(4096, width));
    await AsyncStorage.setItem(IMAGE_OPTIMIZATION_RESIZE_WIDTH_KEY, String(clamped));
  } catch (error) {
    console.error('Error setting image optimization resize width:', error);
  }
}

/**
 * Get the number of print copies
 */
export async function getPrintCopies(): Promise<number> {
  try {
    const value = await AsyncStorage.getItem(PRINT_COPIES_KEY);
    const parsed = value ? parseInt(value, 10) : NaN;
    return isNaN(parsed) || parsed < 1 ? 1 : Math.min(10, parsed); // Default 1, max 10
  } catch (error) {
    console.error('Error getting print copies:', error);
    return 1;
  }
}

/**
 * Set the number of print copies
 */
export async function setPrintCopies(copies: number): Promise<void> {
  try {
    const clamped = Math.max(1, Math.min(10, copies));
    await AsyncStorage.setItem(PRINT_COPIES_KEY, String(clamped));
  } catch (error) {
    console.error('Error setting print copies:', error);
  }
}

/**
 * Get the printer type preference (system or POS)
 */
export async function getPrinterType(): Promise<PrinterType> {
  try {
    const value = await AsyncStorage.getItem(PRINTER_TYPE_KEY);
    if (value === 'system' || value === 'pos') {
      return value as PrinterType;
    }
    return 'pos'; // Default to POS printer
  } catch (error) {
    console.error('Error getting printer type:', error);
    return 'pos';
  }
}

/**
 * Set the printer type preference
 */
export async function setPrinterType(type: PrinterType): Promise<void> {
  try {
    await AsyncStorage.setItem(PRINTER_TYPE_KEY, type);
  } catch (error) {
    console.error('Error setting printer type:', error);
  }
}

/**
 * Get the camera zoom level preference
 */
export async function getCameraZoom(): Promise<number> {
  try {
    const value = await AsyncStorage.getItem(CAMERA_ZOOM_KEY);
    if (value !== null) {
      const parsed = parseFloat(value);
      if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
        return parsed;
      }
    }
    return 0.75; // Default to 0.75
  } catch (error) {
    console.error('Error getting camera zoom:', error);
    return 0.75;
  }
}

/**
 * Set the camera zoom level preference
 */
export async function setCameraZoom(zoom: number): Promise<void> {
  try {
    const clamped = Math.max(0, Math.min(1, zoom));
    await AsyncStorage.setItem(CAMERA_ZOOM_KEY, String(clamped));
  } catch (error) {
    console.error('Error setting camera zoom:', error);
  }
}

/**
 * Get the multi-page capture setting
 */
export async function getMultiPageCapture(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(MULTI_PAGE_CAPTURE_KEY);
    return value === 'true'; // Default to false
  } catch (error) {
    console.error('Error getting multi-page capture setting:', error);
    return false;
  }
}

/**
 * Set the multi-page capture setting
 */
export async function setMultiPageCapture(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(MULTI_PAGE_CAPTURE_KEY, enabled ? 'true' : 'false');
  } catch (error) {
    console.error('Error setting multi-page capture setting:', error);
  }
}

