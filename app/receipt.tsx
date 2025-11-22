import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import { getLocalDateString, getReceiptById, initDatabase, saveReceipt, updateReceiptPaymentStatus } from '@/utils/database';
import { ReceiptData } from '@/utils/ocr';
import { calculateTotals, formatDateTime, printReceiptAsText } from '@/utils/printer';
import { getAutoPrinter, getAutoSave, getEpsonPrinterMac, getPrintCopies, getPrintMargin, getPrintTemplate, getPrinterType, getShopName, type PrintTemplateId } from '@/utils/settings';
import { Image } from 'expo-image';
import * as Print from 'expo-print';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, TouchableOpacity, View, findNodeHandle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ReceiptScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const imageUri = params.imageUri ? decodeURIComponent(params.imageUri as string) : null;
  const extractedText = params.extractedText ? decodeURIComponent(params.extractedText as string) : '';
  const extractedDataType = params.extractedDataType as 'json' | 'text' | undefined;
  const orderNumber = params.orderNumber ? params.orderNumber as string : null;
  const receiptId = params.receiptId ? Number(params.receiptId) : null;
  const isExistingReceipt = params.isExistingReceipt === 'true' || (Array.isArray(params.isExistingReceipt) && params.isExistingReceipt[0] === 'true');
  const initialPaidStatus = params.isPaid === 'true' || (Array.isArray(params.isPaid) && params.isPaid[0] === 'true');
  const [isPrinting, setIsPrinting] = useState(false);
  const [isEpsonPrinting, setIsEpsonPrinting] = useState(false);
  const [isPrintingToAll, setIsPrintingToAll] = useState(false);
  const [isTestPrinting, setIsTestPrinting] = useState(false);
  const [showDebugInfo, setShowDebugInfo] = useState(false);
  const printViewRef = useRef<View>(null);
  const autoPrintAttemptedRef = useRef(false);
  const mismatchAlertShownRef = useRef(false);

  // Optional discovery hook wrapper: use library hook when available, else no-op
  let useDiscovery: () => { start: (params?: any) => void; isDiscovering: boolean; printers: any[] };
  let DiscoveryPortType: any = null;
  let PrinterConstants: any = null;
  let moduleAvailable = false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('react-native-esc-pos-printer');
    if (mod && mod.usePrintersDiscovery) {
      useDiscovery = mod.usePrintersDiscovery as any;
      // Get DiscoveryPortType constants for WiFi/LAN support
      if (mod.DiscoveryPortType) {
        DiscoveryPortType = mod.DiscoveryPortType;
      } else if (mod.DiscoveryFilterOption) {
        DiscoveryPortType = mod.DiscoveryFilterOption;
      }
      // Get PrinterConstants for alignment constants
      if (mod.PrinterConstants) {
        PrinterConstants = mod.PrinterConstants;
      }
      moduleAvailable = true;
      console.log('Epson module loaded successfully');
    } else {
      useDiscovery = () => ({ start: () => {}, isDiscovering: false, printers: [] });
      console.warn('Epson module found but usePrintersDiscovery not available');
    }
  } catch (e) {
    useDiscovery = () => ({ start: () => {}, isDiscovering: false, printers: [] });
    console.warn('Epson module not found:', e);
  }
  const { start: startDiscovery, isDiscovering, printers } = useDiscovery();
  
  // Log discovery status
  useEffect(() => {
    if (moduleAvailable) {
      console.log('Epson discovery status:', { isDiscovering, printerCount: printers?.length || 0 });
    }
  }, [isDiscovering, printers, moduleAvailable]);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(isExistingReceipt);
  const [shopName, setShopName] = useState<string>('');
  const [printMargin, setPrintMargin] = useState<number>(8);
  const [template, setTemplate] = useState<PrintTemplateId>('classic');
  const [printerType, setPrinterType] = useState<'system' | 'pos'>('pos');
  const [showImage, setShowImage] = useState(false);
  const [isPaid, setIsPaid] = useState(initialPaidStatus);
  const insets = useSafeAreaInsets();

  // Theme colors for dark mode support
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({ light: '#E5E5E5', dark: '#333333' }, 'text');
  const cardBackground = useThemeColor({ light: '#FFFFFF', dark: '#1C1C1E' }, 'background');
  const secondaryText = useThemeColor({ light: '#666666', dark: '#999999' }, 'text');
  const tertiaryText = useThemeColor({ light: '#333333', dark: '#CCCCCC' }, 'text');
  const tintColor = useThemeColor({ light: '#007AFF', dark: '#0A84FF' }, 'tint');

  // Load printing preferences and initialize database
  useEffect(() => {
    const loadPrefs = async () => {
      try {
        const [name, margin, tpl, printerTypeValue] = await Promise.all([
          getShopName(),
          getPrintMargin(),
          getPrintTemplate(),
          getPrinterType(),
        ]);
        setShopName(name);
        setPrintMargin(margin);
        setTemplate(tpl);
        setPrinterType(printerTypeValue);
        
        // Initialize database
        await initDatabase();
        
        // Load payment status from database if viewing existing receipt
        if (isExistingReceipt && receiptId) {
          try {
            const receipt = await getReceiptById(receiptId);
            if (receipt && receipt.is_paid !== undefined) {
              setIsPaid(receipt.is_paid);
            }
          } catch (e) {
            console.error('Error loading payment status:', e);
          }
        }
      } catch (e) {
        // ignore
      }
    };
    loadPrefs();
    // Reset auto-print flag when receipt screen loads
    autoPrintAttemptedRef.current = false;
  }, [isExistingReceipt, receiptId]);

  // Start discovery for test printing to first printer - search for both Bluetooth and WiFi/LAN printers
  useEffect(() => {
    if (moduleAvailable && startDiscovery) {
      try {
        // Search for all port types (Bluetooth, WiFi/LAN TCP, USB)
        const discoveryParams = DiscoveryPortType ? {
          filterOption: {
            portType: DiscoveryPortType.PORTTYPE_ALL || 0, // 0 = PORTTYPE_ALL
          },
        } : undefined;
        startDiscovery(discoveryParams);
        console.log('Started Epson printer discovery (Bluetooth + WiFi/LAN)');
      } catch (e) {
        console.error('Failed to start discovery:', e);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleEpsonPrint = async (isAutoPrint: boolean = false) => {
    let target: string | null = null;
    let deviceName: string = 'Printer';
    let step = 'initialization';
    
    try {
      // Step 1: Get saved default printer first, then fall back to discovered printers
      step = 'finding printer';
      console.log(`[RECEIPT PRINT] Step: ${step}`);
      const savedPrinterMac = await getEpsonPrinterMac();
      
      // Prefer saved default printer if available
      if (savedPrinterMac) {
        // Check if saved printer is in the discovered list
        const savedPrinter = printers?.find(p => p.target === savedPrinterMac);
        if (savedPrinter) {
          target = savedPrinterMac;
          deviceName = savedPrinter.deviceName || savedPrinter.name || 'Printer';
          console.log(`[RECEIPT PRINT] Using saved default printer: ${deviceName} (target: ${target})`);
        } else {
          // Saved printer not found in discovery, but try to use it anyway
          target = savedPrinterMac;
          deviceName = 'Printer';
          console.log(`[RECEIPT PRINT] Using saved default printer (not in discovery list): ${target}`);
        }
      }
      
      // Fall back to first discovered printer if no default is set
      if (!target && printers && printers.length > 0) {
        target = printers[0]?.target;
        deviceName = printers[0]?.deviceName || printers[0]?.name || 'Printer';
        console.log(`[RECEIPT PRINT] Using first discovered printer: ${deviceName} (target: ${target})`);
      }
      
      if (!target) {
        console.error('[RECEIPT PRINT] No printer target found');
        Alert.alert(
          'No Printers Found',
          'No printers were discovered. Make sure:\n\n1. Bluetooth/WiFi is enabled on your device\n2. The printer is powered on\n3. For Bluetooth: printer is in pairing/discovery mode and within range\n4. For WiFi/LAN: printer is on the same network\n\nDiscovery runs automatically in the background.'
        );
        return;
      }

      // Step 2: Try to load the module
      step = 'loading printer module';
      console.log(`[RECEIPT PRINT] Step: ${step}`);
      let Printer: any = null;
      let PrinterConstants: any = null;
      try {
        const mod: any = await import('react-native-esc-pos-printer').catch(() => null);
        Printer = mod?.Printer;
        PrinterConstants = mod?.PrinterConstants;
        console.log(`[RECEIPT PRINT] Module loaded: Printer=${!!Printer}, PrinterConstants=${!!PrinterConstants}`);
      } catch (e) {
        console.error('[RECEIPT PRINT] Failed to import Epson module:', e);
      }

      if (!Printer) {
        console.error('[RECEIPT PRINT] Printer module not found');
        Alert.alert(
          'Printer Module Not Found', 
          'The Epson printer module is not included in this build. Make sure you:\n\n1. Installed react-native-esc-pos-printer\n2. Rebuilt the app with npx expo run:android\n3. Not using Expo Go (use a development build)'
        );
        return;
      }

      // Step 3: Get view tag
      step = 'getting view tag';
      console.log(`[RECEIPT PRINT] Step: ${step}`);
      const viewTag = findNodeHandle(printViewRef.current);
      if (!viewTag) {
        console.error('[RECEIPT PRINT] View tag not found - printable view not ready');
        Alert.alert('Printer', 'Printable view not ready. Please wait a moment and try again.');
        return;
      }
      console.log(`[RECEIPT PRINT] View tag obtained: ${viewTag}`);

      setIsEpsonPrinting(true);
      const printerInfo = printers?.find(p => p.target === target);
      const printerDeviceName = printerInfo?.deviceName || printerInfo?.name || deviceName;
      
      // Ensure deviceName is a valid non-empty string
      const validDeviceName = printerDeviceName && printerDeviceName.trim() !== '' ? printerDeviceName.trim() : 'Printer';
      console.log(`[RECEIPT PRINT] Starting print to printer: ${validDeviceName} (target: ${target})`);
      console.log('[RECEIPT PRINT] Full printer info:', JSON.stringify(printerInfo, null, 2));
      
      // Validate target
      if (!target || target.trim() === '') {
        throw new Error('Invalid printer target');
      }
      
      // Get number of copies to print (only for auto-print, manual always prints 1 copy)
      const printCopies = isAutoPrint ? await getPrintCopies() : 1;
      console.log(`[RECEIPT PRINT] Printing ${printCopies} copy/copies (${isAutoPrint ? 'auto-print' : 'manual'})`);
      
      // Step 4: Create printer instance
      step = 'creating printer instance';
      console.log(`[RECEIPT PRINT] Step: ${step}`);
      const printer = new Printer({
        target: target.trim(),
        deviceName: validDeviceName,
      });
      console.log(`[RECEIPT PRINT] Printer instance created successfully`);
      
      // Step 5: Connect to printer
      step = 'connecting to printer';
      console.log(`[RECEIPT PRINT] Step: ${step}`);
      try {
        await printer.connect(5000); // 5 second timeout
        console.log(`[RECEIPT PRINT] Connected with timeout parameter`);
      } catch (connectError: any) {
        console.log(`[RECEIPT PRINT] Connect with timeout failed:`, connectError);
        // If connect with timeout fails, try without timeout
        if (connectError?.message?.includes('parameter') || connectError?.message?.includes('invalid')) {
          console.log('[RECEIPT PRINT] Retrying connect without timeout parameter');
          await printer.connect();
          console.log(`[RECEIPT PRINT] Connected without timeout parameter`);
        } else {
          throw connectError;
        }
      }
      
      // Print multiple copies
      for (let copy = 1; copy <= printCopies; copy++) {
        if (printCopies > 1) {
          console.log(`[RECEIPT PRINT] Printing copy ${copy} of ${printCopies}`);
        }
        
        // Step 6: Try to capture view and add to print buffer, fallback to manual text if it fails
        step = 'capturing view and adding to print buffer';
        console.log(`[RECEIPT PRINT] Step: ${step}`);
        console.log(`[RECEIPT PRINT] View tag: ${viewTag}, Width: 80mm`);
        
        let useManualTextPrint = false;
        try {
          await Printer.addViewShot(printer, {
            viewNode: viewTag,
            width: 80, // 80mm paper width
          });
          console.log(`[RECEIPT PRINT] View captured and added to print buffer`);
        } catch (viewShotError: any) {
          console.warn(`[RECEIPT PRINT] addViewShot failed:`, viewShotError);
          const errorMsg = viewShotError?.message || String(viewShotError) || '';
          // If it's an invalid parameter error (common with WiFi/LAN printers), use manual text printing
          if (errorMsg.includes('invalid parameter') || errorMsg.includes('invalid') || errorMsg.includes('parameter')) {
            console.log(`[RECEIPT PRINT] Falling back to manual text printing (addViewShot not supported for this printer type)`);
            useManualTextPrint = true;
          } else {
            // Re-throw if it's a different error
            throw viewShotError;
          }
        }
        
        // If addViewShot failed, use manual text printing
        if (useManualTextPrint) {
          step = 'printing receipt manually as text';
          console.log(`[RECEIPT PRINT] Step: ${step}`);
          await printReceiptAsText(printer, PrinterConstants, receiptData, filteredReceiptLines, orderNumber, shopName, template, isPaid);
          console.log(`[RECEIPT PRINT] Receipt printed manually as text`);
        }
        
        // Step 7: Add paper cut command after each copy
        step = 'adding paper cut';
        console.log(`[RECEIPT PRINT] Step: ${step} (copy ${copy} of ${printCopies})`);
        try {
          await printer.addCut();
          console.log(`[RECEIPT PRINT] Paper cut command added for copy ${copy}`);
        } catch (cutError: any) {
          console.warn(`[RECEIPT PRINT] Paper cut command failed (continuing anyway):`, cutError);
          // Continue even if cut fails - some printers handle it differently
        }
        
        // Step 8: Send data to printer after each copy (includes cut command)
        step = 'sending data to printer';
        console.log(`[RECEIPT PRINT] Step: ${step} (copy ${copy} of ${printCopies})`);
        await printer.sendData();
        console.log(`[RECEIPT PRINT] Data sent successfully for copy ${copy}`);
        
        // Add feed line between copies (except after last copy)
        if (copy < printCopies) {
          await printer.addFeedLine(2);
        }
      }
      
      // Step 9: Disconnect
      step = 'disconnecting from printer';
      console.log(`[RECEIPT PRINT] Step: ${step}`);
      await printer.disconnect();
      console.log(`[RECEIPT PRINT] Disconnected successfully`);
      
      // Print successful - no alert needed (silent success)
      setIsEpsonPrinting(false);
    } catch (error: any) {
      console.error(`[RECEIPT PRINT] Error at step: ${step}`);
      console.error('[RECEIPT PRINT] Error object:', error);
      console.error('[RECEIPT PRINT] Error type:', typeof error);
      console.error('[RECEIPT PRINT] Error constructor:', error?.constructor?.name);
      console.error('[RECEIPT PRINT] Error keys:', Object.keys(error || {}));
      console.error('[RECEIPT PRINT] Full error details:', {
        message: error?.message,
        code: error?.code,
        name: error?.name,
        stack: error?.stack,
        toString: error?.toString?.(),
        userInfo: error?.userInfo,
        nativeError: error?.nativeError,
        target,
        deviceName,
        step,
        printers: printers?.map(p => ({ target: p.target, name: p.name, ipAddress: p.ipAddress, deviceType: p.deviceType })),
      });
      
      // Try to get native error details
      let nativeErrorDetails = '';
      try {
        if (error?.nativeError) {
          nativeErrorDetails = `\nNative Error: ${JSON.stringify(error.nativeError)}`;
        }
        if (error?.userInfo) {
          nativeErrorDetails += `\nUser Info: ${JSON.stringify(error.userInfo)}`;
        }
      } catch (e) {
        // ignore
      }
      
      setIsEpsonPrinting(false);
      
      // Extract error message from various possible formats
      let errorMessage = 'Unknown error';
      if (error?.message) {
        errorMessage = error.message;
      } else if (error?.code) {
        errorMessage = `Error code: ${error.code}`;
      } else if (error?.name) {
        errorMessage = `Error: ${error.name}`;
      } else if (error?.toString) {
        errorMessage = error.toString();
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error) {
        try {
          errorMessage = JSON.stringify(error);
        } catch (e) {
          errorMessage = String(error);
        }
      }
      
      const errorTarget = target || 'N/A';
      const errorDevice = deviceName || 'N/A';
      const printerInfo = printers?.find(p => p.target === target);
      const errorIP = printerInfo?.ipAddress || 'N/A';
      const errorPort = printerInfo?.port || 'N/A';
      const errorType = printerInfo?.ipAddress ? 'WiFi/LAN' : 'Bluetooth';
      
      Alert.alert(
        'Print Failed', 
        `Failed at step: ${step}\n\nError: ${errorMessage}${nativeErrorDetails}\n\nDebug Info:\nTarget: ${errorTarget}\nDevice: ${errorDevice}\nIP: ${errorIP}\nPort: ${errorPort}\nType: ${errorType}\n\nPlease check console logs for full error details.\n\nTroubleshooting:\n1. Printer is powered on\n2. Printer is connected (Bluetooth/WiFi)\n3. Printer is in range\n4. For WiFi: printer is on same network\n5. View is rendered (try scrolling or waiting a moment)\n6. Check console logs for more details`
      );
    }
  };

  const handlePrintToAllPrinters = async () => {
    if (!printers || printers.length === 0) {
      Alert.alert(
        'No Printers Found',
        'No printers were discovered. Make sure:\n\n1. Bluetooth/WiFi is enabled on your device\n2. The printer is powered on\n3. For Bluetooth: printer is in pairing/discovery mode and within range\n4. For WiFi/LAN: printer is on the same network\n\nDiscovery runs automatically in the background.'
      );
      return;
    }

    // Try to load the module
    let Printer: any = null;
    try {
      const mod: any = await import('react-native-esc-pos-printer').catch(() => null);
      Printer = mod?.Printer;
    } catch (e) {
      console.error('Failed to import Epson module:', e);
    }

    if (!Printer) {
      Alert.alert(
        'Printer Module Not Found', 
        'The Epson printer module is not included in this build. Make sure you:\n\n1. Installed react-native-esc-pos-printer\n2. Rebuilt the app with npx expo run:android\n3. Not using Expo Go (use a development build)'
      );
      return;
    }

    const viewTag = findNodeHandle(printViewRef.current);
    if (!viewTag) {
      Alert.alert('Printer', 'Printable view not ready.');
      return;
    }

    setIsPrintingToAll(true);
    const results: Array<{ printer: string; success: boolean; error?: string }> = [];

    // Print to all printers sequentially
    for (const printerInfo of printers) {
      try {
        const deviceName = printerInfo.deviceName || printerInfo.name || 'Printer';
        const validDeviceName = deviceName && deviceName.trim() !== '' ? deviceName.trim() : 'Printer';
        const validTarget = printerInfo.target && printerInfo.target.trim() !== '' ? printerInfo.target.trim() : null;
        
        if (!validTarget) {
          throw new Error('Invalid printer target');
        }
        
        console.log(`Printing to printer: ${validDeviceName} (target: ${validTarget})`);
        
        // Create printer instance and use addViewShot
        const printer = new Printer({
          target: validTarget,
          deviceName: validDeviceName,
        });
        
        // Connect to printer (timeout is optional)
        try {
          await printer.connect(5000); // 5 second timeout
        } catch (connectError: any) {
          // If connect with timeout fails, try without timeout
          if (connectError?.message?.includes('parameter') || connectError?.message?.includes('invalid')) {
            console.log('Retrying connect without timeout parameter');
            await printer.connect();
          } else {
            throw connectError;
          }
        }
        
        // Get number of copies to print
        const printCopies = await getPrintCopies();
        console.log(`Printing ${printCopies} copy/copies to printer: ${validDeviceName}`);
        
        // Print multiple copies
        for (let copy = 1; copy <= printCopies; copy++) {
          if (printCopies > 1) {
            console.log(`Printing copy ${copy} of ${printCopies} to printer: ${validDeviceName}`);
          }
          
          // Capture view and add to print buffer
          await Printer.addViewShot(printer, {
            viewNode: viewTag,
            width: 80, // 80mm paper width
          });
          
          // Add cut after each copy
          try {
            await printer.addCut();
            console.log(`Cut command added for copy ${copy}`);
          } catch (cutError: any) {
            console.warn(`Cut command failed (continuing anyway):`, cutError);
          }
          
          // Send data to printer (includes cut command)
          await printer.sendData();
          
          // Add feed line between copies (except after last copy)
          if (copy < printCopies) {
            await printer.addFeedLine(2);
          }
        }
        
        // Disconnect
        await printer.disconnect();
        
        results.push({ printer: deviceName, success: true });
        console.log(`Successfully printed to ${deviceName}`);
      } catch (error: any) {
        const deviceName = printerInfo.deviceName || printerInfo.name || printerInfo.target;
        const errorMessage = error?.message || String(error) || 'Unknown error';
        console.error(`Failed to print to ${deviceName}:`, error);
        results.push({ printer: deviceName, success: false, error: errorMessage });
      }
    }

    setIsPrintingToAll(false);

    // Show summary
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    
    if (successCount === results.length) {
      Alert.alert('Success', `Receipt printed to all ${successCount} printer(s).`);
    } else if (successCount > 0) {
      const failedPrinters = results.filter(r => !r.success).map(r => `• ${r.printer}`).join('\n');
      Alert.alert(
        'Partial Success',
        `Printed to ${successCount} of ${results.length} printer(s).\n\nFailed printers:\n${failedPrinters}`
      );
    } else {
      const failedPrinters = results.map(r => `• ${r.printer}: ${r.error || 'Unknown error'}`).join('\n');
      Alert.alert(
        'Print Failed',
        `Failed to print to all printers:\n\n${failedPrinters}\n\nPlease check:\n\n1. Printers are powered on\n2. Printers are connected (Bluetooth/WiFi)\n3. Printers are in range`
      );
    }
  };

  const handleSimpleTestPrint = async () => {
    let target: string | null = null;
    let deviceName: string = 'Printer';
    
    // Get saved default printer first, then fall back to discovered printers
    const savedPrinterMac = await getEpsonPrinterMac();
    
    // Prefer saved default printer if available
    if (savedPrinterMac) {
      const savedPrinter = printers?.find(p => p.target === savedPrinterMac);
      if (savedPrinter) {
        target = savedPrinterMac;
        deviceName = savedPrinter.deviceName || savedPrinter.name || 'Printer';
        console.log('Using saved default printer for test:', deviceName);
      } else {
        target = savedPrinterMac;
        deviceName = 'Printer';
        console.log('Using saved default printer (not in discovery list) for test:', target);
      }
    }
    
    // Fall back to first discovered printer if no default is set
    if (!target && printers && printers.length > 0) {
      target = printers[0]?.target;
      deviceName = printers[0]?.deviceName || printers[0]?.name || 'Printer';
      console.log('Using first discovered printer for test:', deviceName);
    }
    
    if (!target) {
      Alert.alert(
        'No Printers Found',
        'No printers were discovered. Make sure:\n\n1. Bluetooth/WiFi is enabled on your device\n2. The printer is powered on\n3. For Bluetooth: printer is in pairing/discovery mode and within range\n4. For WiFi/LAN: printer is on the same network\n\nDiscovery runs automatically in the background.'
      );
      return;
    }

      // Try to load the module
      let Printer: any = null;
      let PrinterConstants: any = null;
      try {
        const mod: any = await import('react-native-esc-pos-printer').catch(() => null);
        Printer = mod?.Printer;
        PrinterConstants = mod?.PrinterConstants;
      } catch (e) {
        console.error('Failed to import Epson module:', e);
      }

      if (!Printer) {
        Alert.alert(
          'Printer Module Not Found', 
          'The Epson printer module is not included in this build. Make sure you:\n\n1. Installed react-native-esc-pos-printer\n2. Rebuilt the app with npx expo run:android\n3. Not using Expo Go (use a development build)'
        );
        return;
      }

      if (!PrinterConstants) {
        Alert.alert(
          'PrinterConstants Not Found', 
          'PrinterConstants is not available. Make sure you have the latest version of react-native-esc-pos-printer.'
        );
        return;
      }

      setIsTestPrinting(true);
      
      // Ensure deviceName is a valid non-empty string
      const validDeviceName = deviceName && deviceName.trim() !== '' ? deviceName.trim() : 'Printer';
      console.log(`[TEST PRINT] Starting test print to printer: ${validDeviceName} (target: ${target})`);
      console.log('[TEST PRINT] Full printer info:', JSON.stringify(printers?.find(p => p.target === target), null, 2));
      
      // Validate target
      if (!target || target.trim() === '') {
        throw new Error('Invalid printer target');
      }
      
      let printer: any = null;
      let step = 'initialization';
      
      try {
        // Step 1: Create printer instance
        step = 'creating printer instance';
        console.log(`[TEST PRINT] Step: ${step}`);
        printer = new Printer({
          target: target.trim(),
          deviceName: validDeviceName,
        });
        console.log(`[TEST PRINT] Printer instance created successfully`);
        
        // Step 2: Connect to printer
        step = 'connecting to printer';
        console.log(`[TEST PRINT] Step: ${step}`);
        try {
          await printer.connect(5000); // 5 second timeout
          console.log(`[TEST PRINT] Connected with timeout parameter`);
        } catch (connectError: any) {
          console.log(`[TEST PRINT] Connect with timeout failed:`, connectError);
          // If connect with timeout fails, try without timeout
          if (connectError?.message?.includes('parameter') || connectError?.message?.includes('invalid')) {
            console.log('[TEST PRINT] Retrying connect without timeout parameter');
            await printer.connect();
            console.log(`[TEST PRINT] Connected without timeout parameter`);
          } else {
            throw new Error(`Connection failed: ${connectError?.message || connectError?.toString() || JSON.stringify(connectError)}`);
          }
        }
        
        // Step 3: Add text alignment (optional - skip if not supported)
        step = 'adding text alignment';
        console.log(`[TEST PRINT] Step: ${step}`);
        try {
          if (printer.addTextAlign && typeof printer.addTextAlign === 'function') {
            await printer.addTextAlign(PrinterConstants.ALIGN_CENTER);
            console.log(`[TEST PRINT] Text alignment set to center`);
          } else {
            console.log(`[TEST PRINT] addTextAlign not available, skipping alignment`);
          }
        } catch (alignError: any) {
          console.warn(`[TEST PRINT] Text alignment failed (continuing anyway):`, alignError);
          // Continue without alignment
        }
      
      // Step 4: Add header text
      step = 'adding header text';
      console.log(`[TEST PRINT] Step: ${step}`);
      await printer.addText('========================\n');
      await printer.addText('PRINTER TEST\n');
      await printer.addText('========================\n');
      await printer.addFeedLine(1);
      
      // Step 5: Add debug info
      step = 'adding debug info';
      console.log(`[TEST PRINT] Step: ${step}`);
      try {
        if (printer.addTextAlign && typeof printer.addTextAlign === 'function') {
          await printer.addTextAlign(PrinterConstants.ALIGN_LEFT);
          console.log(`[TEST PRINT] Text alignment set to left`);
        }
      } catch (alignError: any) {
        console.warn(`[TEST PRINT] Text alignment failed (continuing anyway):`, alignError);
        // Continue without alignment
      }
      await printer.addText(`Device: ${validDeviceName}\n`);
      await printer.addText(`Target: ${target}\n`);
      const printerInfo = printers?.find(p => p.target === target);
      if (printerInfo) {
        if (printerInfo.ipAddress) {
          await printer.addText(`IP: ${printerInfo.ipAddress}\n`);
        }
        if (printerInfo.port) {
          await printer.addText(`Port: ${printerInfo.port}\n`);
        }
        await printer.addText(`Type: ${printerInfo.ipAddress ? 'WiFi/LAN' : 'Bluetooth'}\n`);
      }
      const currentDate = new Date();
      await printer.addText(`Date: ${currentDate.toLocaleString()}\n`);
      await printer.addFeedLine(1);
      await printer.addText('This is a test print.\n');
      await printer.addText('If you see this, the printer is working!\n');
      await printer.addFeedLine(1);
      try {
        if (printer.addTextAlign && typeof printer.addTextAlign === 'function') {
          await printer.addTextAlign(PrinterConstants.ALIGN_CENTER);
          console.log(`[TEST PRINT] Text alignment set to center`);
        }
      } catch (alignError: any) {
        console.warn(`[TEST PRINT] Text alignment failed (continuing anyway):`, alignError);
        // Continue without alignment
      }
      await printer.addText('========================\n');
      
      // Add bottom margin with multiple feed lines before cutting
      await printer.addFeedLine(3);
      
      // Step 6: Add paper cut command (before sending data)
      step = 'adding paper cut';
      console.log(`[TEST PRINT] Step: ${step}`);
      try {
        await printer.addCut();
        console.log(`[TEST PRINT] Paper cut command added`);
      } catch (cutError: any) {
        console.warn(`[TEST PRINT] Paper cut command failed (continuing anyway):`, cutError);
        // Continue even if cut fails - some printers handle it differently
      }
      
      // Step 7: Send data to printer (includes cut command)
      step = 'sending data to printer';
      console.log(`[TEST PRINT] Step: ${step}`);
      await printer.sendData();
      console.log(`[TEST PRINT] Data sent successfully`);
      
      // Step 8: Disconnect
      step = 'disconnecting from printer';
      console.log(`[TEST PRINT] Step: ${step}`);
      await printer.disconnect();
      console.log(`[TEST PRINT] Disconnected successfully`);
      
      Alert.alert('Success', 'Test print sent to printer successfully!');
      setIsTestPrinting(false);
    } catch (error: any) {
      console.error(`[TEST PRINT] Error at step: ${step}`);
      console.error('[TEST PRINT] Error object:', error);
      console.error('[TEST PRINT] Error type:', typeof error);
      console.error('[TEST PRINT] Error constructor:', error?.constructor?.name);
      console.error('[TEST PRINT] Error keys:', Object.keys(error || {}));
      console.error('[TEST PRINT] Full error details:', {
        message: error?.message,
        code: error?.code,
        name: error?.name,
        stack: error?.stack,
        toString: error?.toString?.(),
        userInfo: error?.userInfo,
        nativeError: error?.nativeError,
        target,
        deviceName,
        step,
        printers: printers?.map(p => ({ target: p.target, name: p.name, ipAddress: p.ipAddress, deviceType: p.deviceType })),
      });
      
      // Try to get native error details
      let nativeErrorDetails = '';
      try {
        if (error?.nativeError) {
          nativeErrorDetails = `\nNative Error: ${JSON.stringify(error.nativeError)}`;
        }
        if (error?.userInfo) {
          nativeErrorDetails += `\nUser Info: ${JSON.stringify(error.userInfo)}`;
        }
      } catch (e) {
        // ignore
      }
      
      setIsTestPrinting(false);
      
      // Extract error message from various possible formats
      let errorMessage = 'Unknown error';
      if (error?.message) {
        errorMessage = error.message;
      } else if (error?.code) {
        errorMessage = `Error code: ${error.code}`;
      } else if (error?.name) {
        errorMessage = `Error: ${error.name}`;
      } else if (error?.toString) {
        errorMessage = error.toString();
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error) {
        try {
          errorMessage = JSON.stringify(error);
        } catch (e) {
          errorMessage = String(error);
        }
      }
      
      const errorTarget = target || 'N/A';
      const errorDevice = deviceName || 'N/A';
      const printerInfo = printers?.find(p => p.target === target);
      const errorIP = printerInfo?.ipAddress || 'N/A';
      const errorPort = printerInfo?.port || 'N/A';
      const errorType = printerInfo?.ipAddress ? 'WiFi/LAN' : 'Bluetooth';
      
      Alert.alert(
        'Test Print Failed', 
        `Failed at step: ${step}\n\nError: ${errorMessage}${nativeErrorDetails}\n\nDebug Info:\nTarget: ${errorTarget}\nDevice: ${errorDevice}\nIP: ${errorIP}\nPort: ${errorPort}\nType: ${errorType}\n\nPlease check console logs for full error details.\n\nTroubleshooting:\n1. Printer is powered on\n2. Printer is connected (Bluetooth/WiFi)\n3. Printer is in range\n4. For WiFi: printer is on same network\n5. Check console logs for more details`
      );
    }
  };

  // Parse JSON data or text data
  const parseReceiptData = (): { receiptData: ReceiptData | null; isJson: boolean } => {
    if (extractedDataType === 'json' || (!extractedDataType && extractedText.trim().startsWith('{'))) {
      try {
        const data = JSON.parse(extractedText);
        if (data && typeof data === 'object' && Array.isArray(data.items) && typeof data.total === 'number') {
          return { receiptData: data as ReceiptData, isJson: true };
        }
      } catch (e) {
        console.error('Failed to parse JSON data:', e);
      }
    }
    return { receiptData: null, isJson: false };
  };

  const { receiptData, isJson } = parseReceiptData();
  const displayDateTime = formatDateTime();
  const customerInfo = receiptData?.customer;
  const hasCustomerInfo = !!(customerInfo && (customerInfo.name || customerInfo.phone));
  const itemsTotal = useMemo(() => {
    if (!receiptData) return 0;
    return receiptData.items.reduce((sum, item) => {
      const price = typeof item.price === 'number' ? item.price : 0;
      return sum + price;
    }, 0);
  }, [receiptData]);
  const totalMismatchThreshold = 0.05;
  const mismatchDifference = receiptData ? itemsTotal - receiptData.total : 0;
  const hasTotalMismatch = receiptData ? Math.abs(mismatchDifference) > totalMismatchThreshold : false;
  const mismatchDifferenceDisplay = `${mismatchDifference >= 0 ? '+' : ''}${mismatchDifference.toFixed(2)}`;

  const formatReceiptText = (text: string) => {
    // Split text into lines and format as receipt
    // Handle indentation for modifiers (lines starting with spaces or tabs)
    // Handle right-aligned prices
    // Extract and display quantities (1x, 2x, 3x format)
    const lines = text.split('\n');
    return lines.map((line, index) => {
      const trimmed = line.trim();
      if (!trimmed) return null;
      
      // Check if line is indented (modifier)
      const isIndented = line !== trimmed && (line.startsWith('  ') || line.startsWith('\t'));
      
      // Check if line contains price (has $ sign and could be right-aligned)
      const hasPrice = /\$\d+\.?\d*/.test(trimmed);
      
      // Check if it's a total line (Total, TOTAL, Subtotal, GST, Tax)
      const isTotalLine = /^(Total|TOTAL|Subtotal|GST|Tax):/i.test(trimmed);
      
      // Extract quantity if present (format: "1x", "2x", "3x", etc.)
      const quantityMatch = trimmed.match(/^(\d+)x\s+/i);
      const quantity = quantityMatch ? quantityMatch[1] : null;
      
      // Extract price if present
      const priceMatch = trimmed.match(/\$[\d,]+\.?\d*/);
      const price = priceMatch ? priceMatch[0] : null;
      
      // Remove quantity and price from text to get product name
      let textWithoutPrice = trimmed;
      if (price) {
        textWithoutPrice = textWithoutPrice.replace(price, '').trim();
      }
      if (quantity) {
        textWithoutPrice = textWithoutPrice.replace(/^\d+x\s+/i, '').trim();
      }
      
      return {
        text: trimmed,
        textWithoutPrice,
        price,
        quantity,
        isIndented,
        isTotalLine,
        hasPrice,
        key: `line-${index}`,
      };
    }).filter(Boolean) as Array<{ 
      text: string; 
      textWithoutPrice: string;
      price: string | null;
      quantity: string | null;
      isIndented: boolean; 
      isTotalLine: boolean;
      hasPrice: boolean;
      key: string;
    }>;
  };

  // Use JSON data if available, otherwise parse text
  const receiptLines = isJson && receiptData ? null : formatReceiptText(extractedText || '');
  
  // Filter out duplicate Total/TOTAL lines - keep only the last one (if multiple exist)
  // The AI should now output Total only at the bottom, but this ensures we keep the correct one
  const filteredReceiptLines = (() => {
    if (!receiptLines) return null;
    
    const totalLines = receiptLines.filter(line => line.isTotalLine && /^(Total|TOTAL):/i.test(line.text));
    
    // If there are multiple Total/TOTAL lines, remove duplicates
    if (totalLines.length > 1) {
      // Keep only the last Total line (the one at the bottom)
      const lastTotalIndex = receiptLines.map((line, idx) => ({
        line,
        idx,
        isTotal: line.isTotalLine && /^(Total|TOTAL):/i.test(line.text)
      }))
      .filter(item => item.isTotal)
      .pop()?.idx;
      
      return receiptLines.filter((line, index) => {
        if (line.isTotalLine && /^(Total|TOTAL):/i.test(line.text)) {
          return index === lastTotalIndex;
        }
        return true;
      });
    }
    
    return receiptLines;
  })();

  useEffect(() => {
    if (hasTotalMismatch && receiptData) {
      if (!mismatchAlertShownRef.current) {
        Alert.alert(
          'Receipt Needs Attention',
          `Items add up to $${itemsTotal.toFixed(2)}, but the receipt total is $${receiptData.total.toFixed(2)}.\n\nPlease re-check or retake the photo before printing.`
        );
        mismatchAlertShownRef.current = true;
      }
    } else {
      mismatchAlertShownRef.current = false;
    }
  }, [hasTotalMismatch, receiptData, itemsTotal]);

  const handleSave = async (silent: boolean = false) => {
    if (isSaving || isSaved || isExistingReceipt) return;
    
    try {
      setIsSaving(true);
      
      const today = getLocalDateString();
      const total = receiptData?.total || 0;
      const receiptDataJson = JSON.stringify({
        receiptData: receiptData || null,
        receiptLines: filteredReceiptLines || null,
        isJson: !!receiptData,
        extractedText,
        orderNumber,
      });
      
      await saveReceipt({
        date: today,
        total_price: total,
        receipt_data: receiptDataJson,
        order_number: orderNumber || undefined,
        is_paid: isPaid,
      });
      
      setIsSaved(true);
      if (!silent) {
        Alert.alert('Success', 'Receipt saved successfully');
      }
    } catch (error: any) {
      console.error('Save error:', error);
      if (!silent) {
        Alert.alert('Save Error', 'Failed to save receipt. Please try again.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Auto-save if enabled (after receipt data is parsed)
  // Skip auto-save for existing receipts
  useEffect(() => {
    if (isExistingReceipt) {
      // Existing receipt is already saved, skip auto-save
      return;
    }
    const autoSaveIfEnabled = async () => {
      try {
        const autoSave = await getAutoSave();
        if (autoSave && !isSaved && !isSaving && (receiptData || (filteredReceiptLines && filteredReceiptLines.length > 0))) {
          await handleSave(true);
        }
      } catch (e) {
        // ignore
      }
    };
    // Only auto-save after receipt data is parsed
    if (receiptData || (filteredReceiptLines && filteredReceiptLines.length > 0)) {
      autoSaveIfEnabled();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receiptData, filteredReceiptLines, isSaved, isSaving, isExistingReceipt]);

  // Auto-print if enabled (after receipt is processed and saved)
  useEffect(() => {
    if (isExistingReceipt) {
      // Skip auto-print for existing receipts
      autoPrintAttemptedRef.current = true;
      return;
    }
    const autoPrintIfEnabled = async () => {
      // Prevent multiple auto-print attempts
      if (autoPrintAttemptedRef.current) {
        return;
      }
      try {
        const autoPrint = await getAutoPrinter();
        if (hasTotalMismatch) {
          console.warn('[AUTO PRINT] Skipped because items total does not match receipt total.');
          return;
        }
        // Wait for receipt data to be processed and saved before auto-printing
        if (autoPrint && isSaved && !isEpsonPrinting && (receiptData || (filteredReceiptLines && filteredReceiptLines.length > 0))) {
          autoPrintAttemptedRef.current = true;
          // Small delay to ensure view is rendered
          setTimeout(async () => {
            try {
              await handleEpsonPrint(true); // Pass true for auto-print
            } catch (e) {
              console.error('Auto-print error:', e);
              // Error message is already shown in handleEpsonPrint
            }
          }, 500);
        }
      } catch (e) {
        console.error('Auto-print check error:', e);
      }
    };
    // Only auto-print after receipt is saved and data is ready
    if (!hasTotalMismatch && isSaved && (receiptData || (filteredReceiptLines && filteredReceiptLines.length > 0))) {
      autoPrintIfEnabled();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSaved, isExistingReceipt, isEpsonPrinting, receiptData, filteredReceiptLines, hasTotalMismatch]);

  const handlePrint = async () => {
    try {
      setIsPrinting(true);
      
      // Generate HTML for the receipt
      const html = isJson && receiptData 
        ? generateReceiptHTMLFromJSON(receiptData, orderNumber, isPaid)
        : filteredReceiptLines 
          ? generateReceiptHTML(filteredReceiptLines, orderNumber, isPaid)
          : '<html><body>No receipt data available</body></html>';
      
      // Print the receipt
      await Print.printAsync({
        html,
        orientation: Print.Orientation.portrait,
        margins: {
          left: printMargin,
          top: printMargin,
          right: printMargin,
          bottom: printMargin,
        },
      });
    } catch (error: any) {
      // Check if error is due to user cancellation
      const errorMessage = error?.message || String(error) || '';
      const isCancellation = 
        errorMessage.toLowerCase().includes('cancel') ||
        errorMessage.toLowerCase().includes('did not complete') ||
        errorMessage.toLowerCase().includes('user cancel') ||
        errorMessage.toLowerCase().includes('aborted');
      
      if (isCancellation) {
        // Silently handle cancellation - user intentionally cancelled
        console.log('Print cancelled by user');
      } else {
        // Show error for actual print failures
        console.error('Print error:', error);
        Alert.alert('Print Error', 'Failed to print receipt. Please try again.');
      }
    } finally {
      setIsPrinting(false);
    }
  };

  const escapeHTML = (str: string): string => {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  const generateReceiptHTMLFromJSON = (receiptData: ReceiptData, orderNum: string | null, paid: boolean): string => {
    const dateTimeStr = formatDateTime();
    const totals = calculateTotals(receiptData.total);
    const customerDetails = receiptData.customer;
    const hasCustomerDetails = !!(customerDetails && (customerDetails.name || customerDetails.phone));
    const customerInfoHTML = hasCustomerDetails
      ? `<div class="customer-info">
          <div class="customer-label">Customer</div>
          ${customerDetails?.name ? `<div class="customer-name">${escapeHTML(customerDetails.name)}</div>` : ''}
          ${customerDetails?.phone ? `<div class="customer-phone">${escapeHTML(customerDetails.phone)}</div>` : ''}
        </div>`
      : '';

    let productsHTML = '';
    receiptData.items.forEach(item => {
      const quantityHTML = item.quantity > 1 ? `<span style="color: #0a7ea4; font-weight: bold;">${item.quantity}x</span> ` : '';
      productsHTML += `<div style="display: flex; justify-content: space-between; margin: 3px 0; font-size: 13px;">
        <span style="font-size: 13px; font-weight: 600;">${quantityHTML}${escapeHTML(item.name)}</span>
        <span style="font-weight: 500;">$${item.price.toFixed(2)}</span>
      </div>`;
      
      // Add modifiers
      if (item.modifiers && item.modifiers.length > 0) {
        item.modifiers.forEach(modifier => {
          productsHTML += `<div style="padding-left: 15px; font-size: 9px; color: #666; font-style: italic; margin: 2px 0;">${escapeHTML(modifier)}</div>`;
        });
      }
    });

    const totalsHTML = `
      <div style="display: flex; justify-content: space-between; margin: 3px 0; font-size: 11px; margin-top: 10px; padding-top: 6px; border-top: 1px solid #E5E5E5;">
        <span>Subtotal:</span>
        <span>$${totals.subtotal.toFixed(2)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; margin: 3px 0; font-size: 11px;">
        <span>GST:</span>
        <span>$${totals.gst.toFixed(2)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; margin: 3px 0; font-size: 13px; font-weight: bold;">
        <span>Total:</span>
        <span>$${totals.total.toFixed(2)}</span>
      </div>
    `;

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            @page {
              size: A5 portrait;
              margin: ${printMargin}mm;
            }
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: 'Courier New', monospace;
              margin: 0;
              padding: ${printMargin}mm;
              font-size: 11px;
              line-height: 1.5;
              width: 100%;
            }
            .receipt-header {
              text-align: center;
              margin-bottom: 12px;
            }
            .receipt-title {
              font-size: 16px;
              font-weight: bold;
              letter-spacing: 2px;
              margin-bottom: 8px;
            }
            .shop-info {
              text-align: center;
              margin-bottom: 12px;
            }
            .shop-name {
              font-size: 14px;
              font-weight: bold;
              color: #0a7ea4;
              margin-bottom: 6px;
            }
            .order-number {
              font-size: 12px;
              font-weight: 600;
              margin-bottom: 6px;
            }
            .date-time {
              font-size: 10px;
              color: #666;
              margin: 2px 0;
            }
            .order-customer-row {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              gap: 16px;
              margin-top: 8px;
              text-align: left;
            }
            .order-info {
              flex: 1;
            }
            .customer-info {
              min-width: 140px;
              text-align: right;
            }
            .customer-label {
              font-size: 10px;
              letter-spacing: 0.5px;
              text-transform: uppercase;
              color: #666;
              margin-bottom: 2px;
            }
            .customer-name {
              font-size: 12px;
              font-weight: 600;
            }
            .customer-phone {
              font-size: 11px;
              color: #666;
            }
            .divider {
              border-top: 1px solid #E5E5E5;
              margin: 10px 0;
            }
            .products-section {
              margin: 12px 0;
            }
            .totals-section {
              margin-top: 12px;
              padding-top: 8px;
              border-top: 1px solid #E5E5E5;
            }
            .footer {
              text-align: center;
              margin-top: 15px;
              font-size: 9px;
              color: #666;
              font-style: italic;
            }
          </style>
        </head>
        <body>
          <div class="receipt-header">
            <div class="divider"></div>
          </div>
          
          <div class="shop-info">
            <div class="shop-name">${escapeHTML(shopName || 'Pappas Ocean Catch')}</div>
            <div class="order-customer-row">
              <div class="order-info">
                ${orderNum ? `<div class="order-number">Order #: ${escapeHTML(orderNum)}</div>` : ''}
                <div class="date-time">${escapeHTML(dateTimeStr)}</div>
              </div>
              ${customerInfoHTML}
            </div>
            <div style="margin: 8px 0; text-align: center;">
              <span style="display: inline-block; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: bold; ${paid ? 'background-color: #D1FAE5; color: #065F46;' : 'background-color: #FEE2E2; color: #991B1B;'}">
                ${paid ? 'PAID' : 'Unpaid'}
              </span>
            </div>
            <div class="divider"></div>
          </div>
          
          <div class="products-section">
            ${productsHTML}
          </div>
          
          <div class="totals-section">
            ${totalsHTML}
          </div>
          
          <div class="footer">
            Thank you for your purchase!
          </div>
        </body>
      </html>
    `;
  };

  const generateReceiptHTML = (lines: Array<{ 
    text: string; 
    textWithoutPrice: string;
    price: string | null;
    quantity: string | null;
    isIndented: boolean; 
    isTotalLine: boolean;
    hasPrice: boolean;
    key: string;
  }>, orderNum: string | null, paid: boolean): string => {
    const dateTimeStr = formatDateTime();

    const productLines = lines.filter(line => !line.isTotalLine);
    const totalLines = lines.filter(line => line.isTotalLine);

    // Sort total lines: Subtotal first, GST second, Total last
    const sortedTotalLines = [...totalLines].sort((a, b) => {
      const aText = a.text.toUpperCase();
      const bText = b.text.toUpperCase();
      
      // Subtotal comes first
      if (aText.startsWith('SUBTOTAL')) return -1;
      if (bText.startsWith('SUBTOTAL')) return 1;
      
      // GST comes second
      if (aText.startsWith('GST')) return -1;
      if (bText.startsWith('GST')) return 1;
      
      // Total comes last
      if (aText.startsWith('TOTAL')) return 1;
      if (bText.startsWith('TOTAL')) return -1;
      
      // Keep original order for other items
      return 0;
    });

    let productsHTML = '';
    productLines.forEach(line => {
      if (line.isIndented) {
        productsHTML += `<div style="padding-left: 15px; font-size: 9px; color: #666; font-style: italic; margin: 2px 0;">${escapeHTML(line.text)}</div>`;
      } else if (line.hasPrice) {
        const quantityHTML = line.quantity ? `<span style="color: #0a7ea4; font-weight: bold;">${escapeHTML(line.quantity)}x</span> ` : '';
        productsHTML += `<div style="display: flex; justify-content: space-between; margin: 3px 0; font-size: 11px;">
          <span>${quantityHTML}${escapeHTML(line.textWithoutPrice)}</span>
          <span style="font-weight: 500;">${escapeHTML(line.price || '')}</span>
        </div>`;
      } else {
        productsHTML += `<div style="margin: 2px 0; font-size: 11px;">${escapeHTML(line.text)}</div>`;
      }
    });

    let totalsHTML = '';
    sortedTotalLines.forEach(line => {
      const isTotal = /^TOTAL:/i.test(line.text);
      const fontSize = isTotal ? '13px' : '11px';
      const fontWeight = isTotal ? 'bold' : 'normal';
      
      if (line.hasPrice) {
        totalsHTML += `<div style="display: flex; justify-content: space-between; margin: 3px 0; font-size: ${fontSize}; font-weight: ${fontWeight}; ${isTotal ? 'margin-top: 10px; padding-top: 6px; border-top: 1px solid #E5E5E5;' : ''}">
          <span>${escapeHTML(line.textWithoutPrice)}</span>
          <span>${escapeHTML(line.price || '')}</span>
        </div>`;
      } else {
        totalsHTML += `<div style="margin: 3px 0; font-size: ${fontSize}; font-weight: ${fontWeight};">${escapeHTML(line.text)}</div>`;
      }
    });

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            @page {
              size: A5 portrait;
              margin: ${printMargin}mm;
            }
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: 'Courier New', monospace;
              margin: 0;
              padding: ${printMargin}mm;
              font-size: 11px;
              line-height: 1.5;
              width: 100%;
            }
            .receipt-header {
              text-align: center;
              margin-bottom: 12px;
            }
            .receipt-title {
              font-size: 16px;
              font-weight: bold;
              letter-spacing: 2px;
              margin-bottom: 8px;
            }
            .shop-name {
              font-size: 14px;
              font-weight: bold;
              color: #0a7ea4;
              margin-bottom: 6px;
            }
            .order-number {
              font-size: 12px;
              font-weight: 600;
              margin-bottom: 6px;
            }
            .date-time {
              font-size: 10px;
              color: #666;
              margin: 2px 0;
            }
            .divider {
              border-top: 1px solid #E5E5E5;
              margin: 10px 0;
            }
            .products-section {
              margin: 12px 0;
            }
            .totals-section {
              margin-top: 12px;
              padding-top: 8px;
              border-top: 1px solid #E5E5E5;
            }
            .footer {
              text-align: center;
              margin-top: 15px;
              font-size: 9px;
              color: #666;
              font-style: italic;
            }
          </style>
        </head>
        <body>
          <div class="receipt-header">
            <div class="divider"></div>
          </div>
          
          <div style="text-align: center; margin-bottom: 12px;">
            <div class="shop-name">${escapeHTML(shopName || 'Pappas Ocean Catch')}</div>
            ${orderNum ? `<div class="order-number">Order #: ${escapeHTML(orderNum)}</div>` : ''}
            <div class="date-time">${escapeHTML(dateTimeStr)}</div>
            <div style="margin: 8px 0;">
              <span style="display: inline-block; padding: 4px 12px; border-radius: 4px; font-size: 12px; font-weight: bold; ${paid ? 'background-color: #D1FAE5; color: #065F46;' : 'background-color: #FEE2E2; color: #991B1B;'}">
                ${paid ? 'PAID' : 'Unpaid'}
              </span>
            </div>
            <div class="divider"></div>
          </div>
          
          <div class="products-section">
            ${productsHTML}
          </div>
          
          <div class="totals-section">
            ${totalsHTML}
          </div>
          
          <div class="footer">
            Thank you for your purchase!
          </div>
        </body>
      </html>
    `;
  };

  return (
    <ThemedView style={styles.container}>
      <View style={[
        styles.header, 
        { 
          backgroundColor, 
          borderBottomColor: borderColor,
          paddingTop: Platform.OS === 'android' ? Math.max(insets.top + 16, 32) : Math.max(insets.top + 16, 80),
        }
      ]}>
        <TouchableOpacity 
          onPress={() => router.back()} 
          style={[styles.backButton, { backgroundColor: tintColor + '20' }]}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <IconSymbol name="chevron.left" size={24} color={tintColor} />
        </TouchableOpacity>
        <ThemedText type="title" style={styles.title}>Receipt</ThemedText>
        <View style={styles.headerActions}>
          <TouchableOpacity 
            onPress={async () => {
              const newPaidStatus = !isPaid;
              const previousPaidStatus = isPaid;
              setIsPaid(newPaidStatus);
              // Update database if this is an existing receipt
              if (isExistingReceipt && receiptId) {
                try {
                  await updateReceiptPaymentStatus(receiptId, newPaidStatus);
                } catch (e) {
                  console.error('Error updating payment status:', e);
                  // Revert on error
                  setIsPaid(previousPaidStatus);
                  Alert.alert('Error', 'Failed to update payment status');
                }
              }
            }} 
            style={[styles.paidButton, { backgroundColor: (isPaid ? '#4CAF50' : '#DC2626') + '20' }]}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <IconSymbol 
              name={isPaid ? "checkmark.circle.fill" : "xmark.circle.fill"} 
              size={24} 
              color={isPaid ? '#4CAF50' : '#DC2626'} 
            />
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => handleSave(false)} 
            style={[styles.saveButton, { backgroundColor: (isSaved || isExistingReceipt ? '#4CAF50' : tintColor) + '20' }]}
            disabled={isSaving || isSaved || isExistingReceipt}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <IconSymbol 
              name={isSaved || isExistingReceipt ? "checkmark.circle.fill" : "square.and.arrow.down.fill"} 
              size={24} 
              color={isSaved || isExistingReceipt ? '#4CAF50' : (isSaving ? secondaryText : tintColor)} 
            />
          </TouchableOpacity>
          {printerType === 'system' ? (
            <TouchableOpacity 
              onPress={handlePrint} 
              style={[styles.printButton, { backgroundColor: tintColor + '20' }]}
              disabled={isPrinting}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <IconSymbol 
                name="printer.fill" 
                size={24} 
                color={isPrinting ? secondaryText : tintColor} 
              />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              onPress={() => handleEpsonPrint(false)} 
              style={[styles.printButton, { backgroundColor: tintColor + '20' }]}
              disabled={isEpsonPrinting}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <IconSymbol 
                name="printer.fill" 
                size={24} 
                color={isEpsonPrinting ? tintColor + '80' : tintColor} 
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {imageUri && (
          <View style={styles.imageToggleContainer}>
            <TouchableOpacity 
              onPress={() => setShowImage(!showImage)} 
              style={[styles.imageToggleButton, { backgroundColor: tintColor + '20' }]}
            >
              <IconSymbol 
                name={showImage ? "eye.slash.fill" : "eye.fill"} 
                size={18} 
                color={tintColor} 
              />
              <ThemedText style={[styles.imageToggleText, { color: tintColor }]}>
                {showImage ? 'Hide Image' : 'Show Image'}
              </ThemedText>
            </TouchableOpacity>
            {showImage && (
              <View style={[styles.imageContainer, { backgroundColor: cardBackground }]}>
                <Image source={{ uri: imageUri }} style={styles.image} contentFit="contain" />
              </View>
            )}
          </View>
        )}

        <View ref={printViewRef} style={[styles.receiptContainer, { backgroundColor: cardBackground }]}>
          <View style={styles.receiptHeader}>
            <View style={[styles.divider, { backgroundColor: borderColor }]} />
          </View>

          {/* Shop Information Section */}
          <View style={styles.shopInfoSection}>
            <ThemedText type="subtitle" style={styles.shopName}>Pappa's Ocean Catch</ThemedText>
            <View style={styles.orderCustomerRow}>
              <View style={styles.orderInfo}>
                {orderNumber && (
                  <ThemedText style={[styles.orderNumber, { color: tertiaryText }]}>Order: #{orderNumber}</ThemedText>
                )}
                <ThemedText style={[styles.dateTime, { color: secondaryText }]}>
                  {displayDateTime}
                </ThemedText>
              </View>
              {hasCustomerInfo && (
                <View style={styles.customerInfo}>
                  <ThemedText style={[styles.customerLabel, { color: secondaryText }]}>Customer</ThemedText>
                  {customerInfo?.name && (
                    <ThemedText style={styles.customerName}>{customerInfo.name}</ThemedText>
                  )}
                  {customerInfo?.phone && (
                    <ThemedText style={[styles.customerPhone, { color: secondaryText }]}>{customerInfo.phone}</ThemedText>
                  )}
                </View>
              )}
            </View>
            <View style={[styles.divider, { backgroundColor: borderColor }]} />
            {/* Payment Status */}
            <View style={styles.paymentStatusContainer}>
              <View style={[styles.paymentStatusBadge, { backgroundColor: isPaid ? '#D1FAE5' : '#FEE2E2' }]}>
                <ThemedText style={[styles.paymentStatusText, { color: isPaid ? '#065F46' : '#991B1B' }]}>
                  {isPaid ? 'PAID' : 'Unpaid'}
                </ThemedText>
              </View>
            </View>
          </View>
          {hasTotalMismatch && receiptData && (
            <View style={[styles.warningBanner, { borderColor: '#F5C2C7', backgroundColor: '#FDECEA' }]}>
              <IconSymbol name="exclamationmark.triangle.fill" size={18} color="#C53030" />
              <View style={{ flex: 1 }}>
                <ThemedText style={styles.warningTitle}>Totals don’t match</ThemedText>
                <ThemedText style={[styles.warningText, { color: '#822727' }]}>
                  Items sum ${itemsTotal.toFixed(2)} vs receipt total ${receiptData.total.toFixed(2)} ({mismatchDifferenceDisplay}).
                  Please double-check or retake the photo. Auto-print is paused.
                </ThemedText>
              </View>
            </View>
          )}

          <View style={styles.receiptBody}>
            {isJson && receiptData ? (
              <>
                {/* Render items from JSON data */}
                {receiptData.items.map((item, index) => (
                  <View key={`item-${index}`}>
                    <View style={styles.receiptLineContainer}>
                      <View style={styles.receiptLineWithPrice}>
                        <View style={styles.receiptLineTextContainer}>
                          {item.quantity > 1 && (
                            <ThemedText style={[styles.receiptQuantity, { color: '#0a7ea4' }]}>{item.quantity}x</ThemedText>
                          )}
                          <ThemedText style={styles.receiptItemName}>{item.name}</ThemedText>
                        </View>
                        <ThemedText style={styles.receiptLinePrice}>${item.price.toFixed(2)}</ThemedText>
                      </View>
                    </View>
                    {/* Render modifiers */}
                    {item.modifiers && item.modifiers.length > 0 && item.modifiers.map((modifier, modIndex) => (
                      <View key={`modifier-${index}-${modIndex}`} style={[styles.receiptLineContainer, styles.receiptLineIndented]}>
                        <ThemedText style={[styles.receiptLine, styles.receiptLineIndentedText, { color: secondaryText }]}>
                          {modifier}
                        </ThemedText>
                      </View>
                    ))}
                  </View>
                ))}
                <View style={[styles.divider, { backgroundColor: borderColor }]} />
                {/* Render totals */}
                {(() => {
                  const totals = calculateTotals(receiptData.total);
                  return (
                    <>
                      <View style={[styles.receiptLineContainer, styles.receiptTotalLine, { borderTopColor: borderColor }]}>
                        <View style={styles.receiptLineWithPrice}>
                          <ThemedText style={[styles.receiptLineText, styles.receiptTotalLabel]}>Subtotal:</ThemedText>
                          <ThemedText style={[styles.receiptLinePrice, styles.receiptTotalPrice]}>${totals.subtotal.toFixed(2)}</ThemedText>
                        </View>
                      </View>
                      <View style={styles.receiptLineContainer}>
                        <View style={styles.receiptLineWithPrice}>
                          <ThemedText style={[styles.receiptLineText, styles.receiptTotalLabel]}>GST:</ThemedText>
                          <ThemedText style={[styles.receiptLinePrice, styles.receiptTotalPrice]}>${totals.gst.toFixed(2)}</ThemedText>
                        </View>
                      </View>
                      <View style={styles.receiptLineContainer}>
                        <View style={styles.receiptLineWithPrice}>
                          <ThemedText style={[styles.receiptLineText, styles.receiptTotalLabel]}>Total:</ThemedText>
                          <ThemedText style={[styles.receiptLinePrice, styles.receiptTotalPrice]}>${totals.total.toFixed(2)}</ThemedText>
                        </View>
                      </View>
                    </>
                  );
                })()}
              </>
            ) : filteredReceiptLines && filteredReceiptLines.length > 0 ? (
              <>
                {filteredReceiptLines.filter(line => !line.isTotalLine).map((line) => (
                  <View key={line.key} style={[
                    styles.receiptLineContainer,
                    line.isIndented && styles.receiptLineIndented
                  ]}>
                    {line.hasPrice && !line.isIndented ? (
                      <View style={styles.receiptLineWithPrice}>
                        <View style={styles.receiptLineTextContainer}>
                          {line.quantity && (
                            <ThemedText style={[styles.receiptQuantity, { color: '#0a7ea4' }]}>{line.quantity}x</ThemedText>
                          )}
                          <ThemedText style={styles.receiptLineText}>{line.textWithoutPrice}</ThemedText>
                        </View>
                        {line.price && (
                          <ThemedText style={styles.receiptLinePrice}>{line.price}</ThemedText>
                        )}
                      </View>
                    ) : (
                      <ThemedText style={[
                        styles.receiptLine,
                        line.isIndented && [styles.receiptLineIndentedText, { color: secondaryText }]
                      ]}>
                        {line.text}
                      </ThemedText>
                    )}
                  </View>
                ))}
                {filteredReceiptLines.filter(line => line.isTotalLine).length > 0 && (
                  <View style={[styles.divider, { backgroundColor: borderColor }]} />
                )}
                {(() => {
                  // Sort total lines: Subtotal first, GST second, Total last
                  const totalLines = filteredReceiptLines.filter(line => line.isTotalLine);
                  const sortedTotalLines = [...totalLines].sort((a, b) => {
                    const aText = a.text.toUpperCase();
                    const bText = b.text.toUpperCase();
                    
                    // Subtotal comes first
                    if (aText.startsWith('SUBTOTAL')) return -1;
                    if (bText.startsWith('SUBTOTAL')) return 1;
                    
                    // GST comes second
                    if (aText.startsWith('GST')) return -1;
                    if (bText.startsWith('GST')) return 1;
                    
                    // Total comes last
                    if (aText.startsWith('TOTAL')) return 1;
                    if (bText.startsWith('TOTAL')) return -1;
                    
                    // Keep original order for other items
                    return 0;
                  });
                  return sortedTotalLines;
                })().map((line) => (
                  <View key={line.key} style={[
                    styles.receiptLineContainer,
                    line.isTotalLine && [styles.receiptTotalLine, { borderTopColor: borderColor }]
                  ]}>
                    {line.hasPrice ? (
                      <View style={styles.receiptLineWithPrice}>
                        <ThemedText style={[
                          styles.receiptLineText,
                          line.isTotalLine && styles.receiptTotalLabel
                        ]}>
                          {line.textWithoutPrice}
                        </ThemedText>
                        {line.price && (
                          <ThemedText style={[
                            styles.receiptLinePrice,
                            line.isTotalLine && styles.receiptTotalPrice
                          ]}>
                            {line.price}
                          </ThemedText>
                        )}
                      </View>
                    ) : (
                      <ThemedText style={[
                        styles.receiptLine,
                        line.isTotalLine && styles.receiptTotalLabel
                      ]}>
                        {line.text}
                      </ThemedText>
                    )}
                  </View>
                ))}
              </>
            ) : (
              <ThemedText style={styles.emptyText}>No text extracted from image</ThemedText>
            )}
          </View>

          <View style={[styles.divider, { backgroundColor: borderColor }]} />
          <View style={styles.receiptFooter}>
            <ThemedText style={[styles.footerText, { color: secondaryText }]}>Thank you for your purchase!</ThemedText>
          </View>
        </View>

        {/* Debug Info Section - Collapsible, hidden by default */}
        {printers && printers.length > 0 && (
          <View style={[styles.debugSection, { marginTop: 16, backgroundColor: tintColor + '10', borderRadius: 8, borderWidth: 1, borderColor: tintColor + '20', overflow: 'hidden' }]}>
            <TouchableOpacity 
              onPress={() => setShowDebugInfo(!showDebugInfo)}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12 }}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                <IconSymbol 
                  name={showDebugInfo ? "chevron.down" : "chevron.right"} 
                  size={16} 
                  color={tintColor} 
                />
                <ThemedText style={[styles.debugTitle, { color: tintColor }]}>
                  Printer Debug Info
                </ThemedText>
              </View>
              <ThemedText style={[styles.debugText, { fontSize: 11, color: secondaryText, marginLeft: 8 }]}>
                {printers.length} printer{printers.length > 1 ? 's' : ''}
              </ThemedText>
            </TouchableOpacity>
            {showDebugInfo && printers[0] && (
              <View style={{ padding: 12, paddingTop: 0, gap: 4 }}>
                {(() => {
                  const p = printers[0];
                  const isWiFi = p.ipAddress && p.ipAddress.trim() !== '';
                  return (
                    <>
                      <ThemedText style={[styles.debugText, { fontSize: 11, fontFamily: 'monospace' }]}>
                        Device Name: {p.deviceName || 'N/A'}
                      </ThemedText>
                      <ThemedText style={[styles.debugText, { fontSize: 11, fontFamily: 'monospace' }]}>
                        Name: {p.name || 'N/A'}
                      </ThemedText>
                      <ThemedText style={[styles.debugText, { fontSize: 11, fontFamily: 'monospace' }]}>
                        Target: {p.target || 'N/A'}
                      </ThemedText>
                      {isWiFi && (
                        <>
                          <ThemedText style={[styles.debugText, { fontSize: 11, fontFamily: 'monospace' }]}>
                            IP Address: {p.ipAddress || 'N/A'}
                          </ThemedText>
                          <ThemedText style={[styles.debugText, { fontSize: 11, fontFamily: 'monospace' }]}>
                            Port: {p.port || 'N/A (default: 9100)'}
                          </ThemedText>
                        </>
                      )}
                      <ThemedText style={[styles.debugText, { fontSize: 11, fontFamily: 'monospace' }]}>
                        Type: {isWiFi ? 'WiFi/LAN' : 'Bluetooth'}
                      </ThemedText>
                      <ThemedText style={[styles.debugText, { fontSize: 11, fontFamily: 'monospace' }]}>
                        Device Type: {p.deviceType || 'N/A'}
                      </ThemedText>
                      <ThemedText style={[styles.debugText, { fontSize: 11, fontFamily: 'monospace' }]}>
                        Total Printers: {printers.length}
                      </ThemedText>
                    </>
                  );
                })()}
                
                {/* Simple Test Print Button */}
                <TouchableOpacity 
                  onPress={handleSimpleTestPrint} 
                  style={[styles.printToAllButton, { backgroundColor: tintColor, borderColor: tintColor, marginTop: 12 }]}
                  disabled={isTestPrinting}
                >
                  <IconSymbol 
                    name="checkmark.circle.fill" 
                    size={20} 
                    color="#fff" 
                  />
                  <ThemedText style={styles.printToAllButtonText}>
                    {isTestPrinting ? 'Printing Test...' : 'Simple Test Print (Text Only)'}
                  </ThemedText>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* Print to All Printers Button - Show when multiple printers are found */}
        {printers && printers.length > 1 && (
          <TouchableOpacity
            onPress={handlePrintToAllPrinters}
            style={[styles.printToAllButton, { backgroundColor: tintColor, borderColor: tintColor }]}
            disabled={isPrintingToAll}
          >
            <IconSymbol 
              name="printer.fill" 
              size={20} 
              color="#fff" 
            />
            <ThemedText style={styles.printToAllButtonText}>
              {isPrintingToAll ? `Printing to ${printers.length} printers...` : `Print to All Printers (${printers.length})`}
            </ThemedText>
          </TouchableOpacity>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    minHeight: 56,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  paidButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  saveButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  printButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  imageToggleContainer: {
    marginBottom: 8,
  },
  imageToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  imageToggleText: {
    fontSize: 14,
    fontWeight: '500',
  },
  imageContainer: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    overflow: 'hidden',
    marginBottom: 8,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  receiptContainer: {
    borderRadius: 8,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  receiptHeader: {
    alignItems: 'center',
    marginBottom: 16,
  },
  receiptTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    letterSpacing: 2,
    marginBottom: 8,
  },
  shopInfoSection: {
    alignItems: 'center',
    marginBottom: 16,
    paddingVertical: 12,
    alignSelf: 'stretch',
    width: '100%',
  },
  shopName: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#0a7ea4',
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  dateTime: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12,
  },
  paymentStatusContainer: {
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  paymentStatusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  paymentStatusText: {
    fontSize: 13,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  orderCustomerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    width: '100%',
    marginTop: 8,
  },
  orderInfo: {
    flex: 1,
    alignItems: 'flex-start',
    gap: 4,
  },
  customerInfo: {
    minWidth: 140,
    alignItems: 'flex-end',
    gap: 4,
  },
  customerLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'right',
  },
  customerName: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'right',
  },
  customerPhone: {
    fontSize: 14,
    textAlign: 'right',
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 16,
  },
  warningTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  warningText: {
    fontSize: 12,
    lineHeight: 18,
  },
  divider: {
    width: '100%',
    height: 1,
    marginVertical: 12,
  },
  receiptBody: {
    marginVertical: 8,
  },
  receiptLineContainer: {
    marginVertical: 2,
  },
  receiptLine: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'monospace',
  },
  receiptLineWithPrice: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  receiptLineTextContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  receiptQuantity: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'monospace',
    fontWeight: '600',
    marginRight: 8,
  },
  receiptLineText: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'monospace',
    flex: 1,
  },
  receiptItemName: {
    fontSize: 16,
    lineHeight: 22,
    fontFamily: 'monospace',
    fontWeight: '600',
    flex: 1,
  },
  receiptLinePrice: {
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'monospace',
    fontWeight: '500',
    marginLeft: 8,
  },
  receiptLineIndented: {
    paddingLeft: 20,
  },
  receiptLineIndentedText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  receiptTotalLine: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
  },
  receiptTotalLabel: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  receiptTotalPrice: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  receiptFooter: {
    alignItems: 'center',
    marginTop: 8,
  },
  footerText: {
    fontSize: 12,
    fontStyle: 'italic',
  },
  printToAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 16,
    marginBottom: 8,
  },
  printToAllButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  debugSection: {
    borderWidth: 1,
    borderColor: 'rgba(10, 126, 164, 0.2)',
  },
  debugTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  debugText: {
    fontSize: 11,
    fontFamily: 'monospace',
    opacity: 0.8,
  },
});

