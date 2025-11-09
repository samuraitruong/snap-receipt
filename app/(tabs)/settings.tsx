import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getAutoPrinter, getAutoSave, getEpsonPrinterMac, getImageOptimization, getImageOptimizationQuality, getImageOptimizationResizeWidth, getOCRMode, getPrintCopies, getPrintMargin, getPrintTemplate, getShopName, OCRMode, setAutoPrinter, setAutoSave, setEpsonPrinterMac, setImageOptimization, setImageOptimizationQuality, setImageOptimizationResizeWidth, setOCRMode, setPrintCopies, setPrintMargin, setPrintTemplate, setShopName, type PrintTemplateId } from '@/utils/settings';
import { formatDateTime } from '@/utils/printer';
import * as Print from 'expo-print';
import { useEffect, useRef, useState } from 'react';
import { Alert, findNodeHandle, Platform, ScrollView, StyleSheet, Switch, TextInput, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
// Lazy require WebView to avoid dependency issues if not installed
let WebView: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  WebView = require('react-native-webview').WebView;
} catch (e) {
  WebView = null;
}

const TEMPLATE_OPTIONS: Array<{ id: PrintTemplateId; name: string; desc: string; icon: string }> = [
  { id: 'classic', name: 'Classic', desc: 'Balanced layout with headings', icon: 'description' },
  { id: 'compact', name: 'Compact', desc: 'Tight spacing for small paper', icon: 'text-fields' },
  { id: 'kitchen', name: 'Kitchen', desc: 'Large text, minimal styling', icon: 'print' },
];

export default function SettingsScreen() {
  const colorScheme = useColorScheme();
  const insets = useSafeAreaInsets();
  const [shopName, setShopNameState] = useState('');
  const [printMargin, setPrintMarginState] = useState<number>(8);
  const [printCopies, setPrintCopiesState] = useState<number>(1);
  const [autoPrinter, setAutoPrinterState] = useState(false);
  const [autoSave, setAutoSaveState] = useState(false);
  const [imageOptimization, setImageOptimizationState] = useState(false);
  const [imageOptimizationQuality, setImageOptimizationQualityState] = useState<number>(70);
  const [imageOptimizationResizeWidth, setImageOptimizationResizeWidthState] = useState<number>(1024);
  const [ocrMode, setOcrModeState] = useState<OCRMode>('generative');
  const [template, setTemplateState] = useState<PrintTemplateId>('classic');
  const [loading, setLoading] = useState(true);
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [epsonMac, setEpsonMac] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isEpsonPrinting, setIsEpsonPrinting] = useState(false);
  const [isTestPrinting, setIsTestPrinting] = useState(false);
  const previewViewRef = useRef<View>(null);
  
  // Use the library's discovery hook - it handles everything automatically
  let useDiscovery: () => { start: (params?: any) => void; isDiscovering: boolean; printers: any[] };
  let DiscoveryPortType: any = null;
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
      moduleAvailable = true;
      console.log('Epson module loaded successfully in Settings');
    } else {
      useDiscovery = () => ({ start: () => {}, isDiscovering: false, printers: [] });
      console.warn('Epson module found but usePrintersDiscovery not available');
    }
  } catch (e) {
    useDiscovery = () => ({ start: () => {}, isDiscovering: false, printers: [] });
    console.warn('Epson module not found in Settings:', e);
  }
  const { start: startDiscovery, isDiscovering, printers: discoveredPrinters } = useDiscovery();
  
  // Log discovery status
  useEffect(() => {
    if (moduleAvailable) {
      console.log('Epson discovery status in Settings:', { isDiscovering, printerCount: discoveredPrinters?.length || 0 });
    }
  }, [isDiscovering, discoveredPrinters, moduleAvailable]);

  // Auto-set first discovered printer as default if no default is set
  useEffect(() => {
    const autoSetDefaultPrinter = async () => {
      // Only auto-set if:
      // 1. Discovery is complete (not discovering)
      // 2. Printers are found
      // 3. No default printer is currently saved
      if (!isDiscovering && discoveredPrinters && discoveredPrinters.length > 0 && !epsonMac) {
        const firstPrinter = discoveredPrinters[0];
        if (firstPrinter?.target) {
          try {
            await setEpsonPrinterMac(firstPrinter.target);
            setEpsonMac(firstPrinter.target);
            console.log(`Auto-set default printer: ${firstPrinter.name || firstPrinter.target}`);
          } catch (e) {
            console.error('Failed to auto-set default printer:', e);
          }
        }
      }
    };
    autoSetDefaultPrinter();
  }, [isDiscovering, discoveredPrinters, epsonMac]);

  useEffect(() => {
    const load = async () => {
      try {
        const [name, margin, copies, auto, save, imgOpt, imgOptQuality, imgOptResize, mode, tpl, savedMac] = await Promise.all([
          getShopName(),
          getPrintMargin(),
          getPrintCopies(),
          getAutoPrinter(),
          getAutoSave(),
          getImageOptimization(),
          getImageOptimizationQuality(),
          getImageOptimizationResizeWidth(),
          getOCRMode(),
          getPrintTemplate(),
          getEpsonPrinterMac(),
        ]);
        setShopNameState(name);
        setPrintMarginState(margin);
        setPrintCopiesState(copies);
        setAutoPrinterState(auto);
        setAutoSaveState(save);
        setImageOptimizationState(imgOpt);
        setImageOptimizationQualityState(imgOptQuality);
        setImageOptimizationResizeWidthState(imgOptResize);
        setOcrModeState(mode);
        setTemplateState(tpl);
        setEpsonMac(savedMac);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Auto-start discovery when hook is available - search for both Bluetooth and WiFi/LAN printers
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
        console.log('Started Epson printer discovery automatically (Bluetooth + WiFi/LAN)');
      } catch (e) {
        console.error('Failed to start discovery:', e);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaveShopName = async (value: string) => {
    setShopNameState(value);
    await setShopName(value.trim());
  };

  const handleSaveMargin = async (value: string) => {
    const n = parseFloat(value);
    const mm = isNaN(n) ? 0 : Math.max(0, Math.min(30, n));
    setPrintMarginState(mm);
    await setPrintMargin(mm);
  };

  const handleSavePrintCopies = async (value: string) => {
    const n = parseInt(value, 10);
    const copies = isNaN(n) || n < 1 ? 1 : Math.max(1, Math.min(10, n));
    setPrintCopiesState(copies);
    await setPrintCopies(copies);
  };

  const handleToggleAuto = async (value: boolean) => {
    setAutoPrinterState(value);
    await setAutoPrinter(value);
  };

  const handleToggleAutoSave = async (value: boolean) => {
    setAutoSaveState(value);
    await setAutoSave(value);
  };

  const handleToggleImageOptimization = async (value: boolean) => {
    setImageOptimizationState(value);
    await setImageOptimization(value);
  };

  const handleSaveImageOptimizationQuality = async (value: string) => {
    const n = parseFloat(value);
    const quality = isNaN(n) ? 70 : Math.max(10, Math.min(100, n));
    setImageOptimizationQualityState(quality);
    await setImageOptimizationQuality(quality);
  };

  const handleSaveImageOptimizationResizeWidth = async (value: string) => {
    const n = parseFloat(value);
    const width = isNaN(n) ? 1024 : Math.max(256, Math.min(4096, n));
    setImageOptimizationResizeWidthState(width);
    await setImageOptimizationResizeWidth(width);
  };

  const handleOCRModeChange = async (value: boolean) => {
    const newMode: OCRMode = value ? 'generative' : 'vision';
    setOcrModeState(newMode);
    await setOCRMode(newMode);
  };

  const handleSelectTemplate = async (id: PrintTemplateId) => {
    setTemplateState(id);
    await setPrintTemplate(id);
  };

  // Manual scan trigger - just restarts the discovery hook
  const scanEpsonPrinters = () => {
    if (moduleAvailable && startDiscovery) {
      try {
        // Search for all port types (Bluetooth, WiFi/LAN TCP, USB)
        const discoveryParams = DiscoveryPortType ? {
          filterOption: {
            portType: DiscoveryPortType.PORTTYPE_ALL || 0, // 0 = PORTTYPE_ALL
          },
        } : undefined;
        startDiscovery(discoveryParams);
        console.log('Restarted Epson printer discovery (Bluetooth + WiFi/LAN)');
      } catch (e) {
        console.error('Failed to restart discovery:', e);
        Alert.alert('Scan Failed', 'Could not restart discovery. Make sure Bluetooth/WiFi is enabled.');
      }
    } else {
      Alert.alert(
        'Printer Module Not Found',
        'The Epson printer module is not included in this build. Make sure you:\n\n1. Installed react-native-esc-pos-printer\n2. Rebuilt the app with npx expo run:android\n3. Not using Expo Go (use a development build)'
      );
    }
  };

  const connectEpson = async (printer: any) => {
    try {
      if (!printer?.target) {
        Alert.alert('Invalid Printer', 'Printer information is missing. Please scan again.');
        return;
      }

      setConnecting(true);
      console.log(`Setting default printer: ${printer.name || printer.target}`);
      
      // For setting default printer, we just need to save the target
      // No need to actually connect - connection happens when printing
      const target = printer.target;
      
      if (target) {
        await setEpsonPrinterMac(target);
        setEpsonMac(target);
        console.log(`Successfully set default printer: ${printer.name || target}`);
        Alert.alert('Success', `Default printer set to ${printer.name || target}`);
      } else {
        Alert.alert('Failed', 'Could not get printer target');
      }
    } catch (e: any) {
      console.error('Error setting default printer:', e);
      Alert.alert('Failed', `Failed to set default printer: ${e?.message || 'Unknown error'}`);
    } finally {
      setConnecting(false);
    }
  };

  // Build preview HTML whenever inputs change
  useEffect(() => {
    const html = buildPreviewHtml({ shopName, margin: printMargin, template });
    setPreviewHtml(html);
  }, [shopName, printMargin, template]);

  const handlePreviewPrint = async () => {
    try {
      setIsPrinting(true);
      await Print.printAsync({
        html: previewHtml,
        orientation: Print.Orientation.portrait,
        margins: {
          left: printMargin,
          top: printMargin,
          right: printMargin,
          bottom: printMargin,
        },
      });
    } catch (error: any) {
      const errorMessage = error?.message || String(error) || '';
      const isCancellation = 
        errorMessage.toLowerCase().includes('cancel') ||
        errorMessage.toLowerCase().includes('did not complete') ||
        errorMessage.toLowerCase().includes('user cancel') ||
        errorMessage.toLowerCase().includes('aborted');
      
      if (!isCancellation) {
        console.error('Print error:', error);
        Alert.alert('Print Error', 'Failed to print preview. Please try again.');
      }
    } finally {
      setIsPrinting(false);
    }
  };

  const handlePreviewEpsonPrint = async () => {
    try {
      // Check if printers are available from the hook
      const target = discoveredPrinters && discoveredPrinters.length > 0 && discoveredPrinters[0]?.target;
      const deviceName = discoveredPrinters && discoveredPrinters.length > 0 ? (discoveredPrinters[0]?.deviceName || discoveredPrinters[0]?.name || 'Printer') : 'Printer';
      if (!target) {
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

      const viewTag = findNodeHandle(previewViewRef.current);
      if (!viewTag) {
        Alert.alert('Printer', 'Printable view not ready.');
        return;
      }

      setIsEpsonPrinting(true);
      
      // Ensure deviceName is a valid non-empty string
      const validDeviceName = deviceName && deviceName.trim() !== '' ? deviceName.trim() : 'Printer';
      console.log(`Printing preview to printer: ${validDeviceName} (target: ${target})`);
      
      // Validate target
      if (!target || target.trim() === '') {
        throw new Error('Invalid printer target');
      }
      
      // Create printer instance and use addViewShot
      const printer = new Printer({
        target: target.trim(),
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
      
      // Capture view and add to print buffer
      await Printer.addViewShot(printer, {
        viewNode: viewTag,
        width: 80, // 80mm paper width
      });
      
      // Send data to printer
      await printer.sendData();
      
      // Add cut
      await printer.addCut();
      
      // Disconnect
      await printer.disconnect();
      
      Alert.alert('Success', 'Print job sent to printer');
      setIsEpsonPrinting(false);
    } catch (error: any) {
      console.error('Epson print error:', error);
      setIsEpsonPrinting(false);
      Alert.alert('Printer Error', `Failed to print: ${error?.message || 'Unknown error'}`);
    }
  };

  const handleSimpleTestPrint = async () => {
    let target: string | null = null;
    let deviceName: string = 'Printer';
    
    // Check if printers are available from the hook
    target = discoveredPrinters && discoveredPrinters.length > 0 && discoveredPrinters[0]?.target;
    deviceName = discoveredPrinters && discoveredPrinters.length > 0 ? (discoveredPrinters[0]?.deviceName || discoveredPrinters[0]?.name || 'Printer') : 'Printer';
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
    console.log('[TEST PRINT] Full printer info:', JSON.stringify(discoveredPrinters?.find(p => p.target === target), null, 2));
    
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
      const printerInfo = discoveredPrinters?.find(p => p.target === target);
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
      await printer.addFeedLine(2);
      try {
        if (printer.addTextAlign && typeof printer.addTextAlign === 'function') {
          await printer.addTextAlign(PrinterConstants.ALIGN_CENTER);
        }
      } catch (alignError: any) {
        console.warn(`[TEST PRINT] Text alignment failed (continuing anyway):`, alignError);
        // Continue without alignment
      }
      await printer.addText('========================\n');
      await printer.addFeedLine(1);
      
      // Step 6: Send data to printer
      step = 'sending data to printer';
      console.log(`[TEST PRINT] Step: ${step}`);
      await printer.sendData();
      console.log(`[TEST PRINT] Data sent successfully`);
      
      // Step 7: Add cut
      step = 'adding paper cut';
      console.log(`[TEST PRINT] Step: ${step}`);
      await printer.addCut();
      
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
        printers: discoveredPrinters?.map(p => ({ target: p.target, name: p.name, ipAddress: p.ipAddress, deviceType: p.deviceType })),
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
      const printerInfo = discoveredPrinters?.find(p => p.target === target);
      const errorIP = printerInfo?.ipAddress || 'N/A';
      const errorPort = printerInfo?.port || 'N/A';
      const errorType = printerInfo?.ipAddress ? 'WiFi/LAN' : 'Bluetooth';
      
      Alert.alert(
        'Test Print Failed', 
        `Failed at step: ${step}\n\nError: ${errorMessage}${nativeErrorDetails}\n\nDebug Info:\nTarget: ${errorTarget}\nDevice: ${errorDevice}\nIP: ${errorIP}\nPort: ${errorPort}\nType: ${errorType}\n\nPlease check console logs for full error details.\n\nTroubleshooting:\n1. Printer is powered on\n2. Printer is connected (Bluetooth/WiFi)\n3. Printer is in range\n4. For WiFi: printer is on same network\n5. Check console logs for more details`
      );
    }
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView 
        contentContainerStyle={[
          styles.content,
          { paddingTop: Platform.OS === 'ios' ? Math.max(insets.top + 8, 24) : 24 }
        ]}
      >
        <ThemedText type="title" style={styles.title}>Settings</ThemedText>

        {/* OCR Mode */}
        <View style={styles.card}>
          <ThemedText type="subtitle" style={styles.cardTitle}>OCR Mode</ThemedText>
          <View style={styles.rowBetween}>
            <View style={styles.rowLeft}>
              <IconSymbol 
                name={ocrMode === 'vision' ? 'text.viewfinder' : 'sparkles'} 
                size={20} 
                color={Colors[colorScheme ?? 'light'].tint} 
              />
              <View style={styles.settingText}>
                <ThemedText style={styles.label}>
                  {ocrMode === 'vision' ? 'Vision AI' : 'Generative AI'}
                </ThemedText>
                <ThemedText style={styles.description}>
                  {ocrMode === 'vision' 
                    ? 'Fast text extraction using Vision API'
                    : 'AI-powered formatting with product modifiers'}
                </ThemedText>
              </View>
            </View>
            <Switch
              value={ocrMode === 'generative'}
              onValueChange={handleOCRModeChange}
              trackColor={{ false: '#767577', true: Colors[colorScheme ?? 'light'].tint }}
              thumbColor={ocrMode === 'generative' ? '#fff' : '#f4f3f4'}
            />
          </View>
        </View>

        {/* Cost Optimization */}
        <View style={styles.card}>
          <ThemedText type="subtitle" style={styles.cardTitle}>Cost Optimization</ThemedText>
          <View style={styles.rowBetween}>
            <View style={styles.rowLeft}>
              <IconSymbol 
                name="chart.line.downtrend.xyaxis" 
                size={20} 
                color={Colors[colorScheme ?? 'light'].tint} 
              />
              <View style={styles.settingText}>
                <ThemedText style={styles.label}>Image Optimization</ThemedText>
                <ThemedText style={styles.description}>
                  Resize and reduce image quality before sending to AI to reduce token costs
                </ThemedText>
              </View>
            </View>
            <Switch
              value={imageOptimization}
              onValueChange={handleToggleImageOptimization}
              trackColor={{ false: '#767577', true: Colors[colorScheme ?? 'light'].tint }}
              thumbColor={imageOptimization ? '#fff' : '#f4f3f4'}
            />
          </View>
          
          {imageOptimization && (
            <>
              <ThemedText style={[styles.label, { marginTop: 16 }]}>Quality (%)</ThemedText>
              <TextInput
                keyboardType="numeric"
                value={String(imageOptimizationQuality)}
                onChangeText={(t) => setImageOptimizationQualityState(t === '' ? 70 : parseFloat(t) || 70)}
                onBlur={() => handleSaveImageOptimizationQuality(String(imageOptimizationQuality))}
                style={styles.input}
                placeholder="70"
              />
              <ThemedText style={[styles.description, { marginTop: 4 }]}>
                Lower values reduce file size and token costs (10-100, default: 70)
              </ThemedText>

              <ThemedText style={[styles.label, { marginTop: 16 }]}>Resize Width (px)</ThemedText>
              <TextInput
                keyboardType="numeric"
                value={String(imageOptimizationResizeWidth)}
                onChangeText={(t) => setImageOptimizationResizeWidthState(t === '' ? 1024 : parseFloat(t) || 1024)}
                onBlur={() => handleSaveImageOptimizationResizeWidth(String(imageOptimizationResizeWidth))}
                style={styles.input}
                placeholder="1024"
              />
              <ThemedText style={[styles.description, { marginTop: 4 }]}>
                Maximum width in pixels (256-4096, default: 1024). Height scales proportionally.
              </ThemedText>
            </>
          )}
        </View>

        {/* Shop Info */}
        <View style={styles.card}>
          <ThemedText type="subtitle" style={styles.cardTitle}>Shop Info</ThemedText>
          <ThemedText style={styles.label}>Shop name</ThemedText>
          <TextInput
            placeholder="Enter shop name"
            value={shopName}
            onChangeText={setShopNameState}
            onBlur={() => handleSaveShopName(shopName)}
            style={styles.input}
          />
        </View>

        {/* Printing */}
        <View style={styles.card}>
          <ThemedText type="subtitle" style={styles.cardTitle}>Printing</ThemedText>

          <View style={styles.rowBetween}>
            <View style={styles.rowLeft}>
              <IconSymbol name="printer.fill" size={20} color="#0a7ea4" />
              <ThemedText style={styles.label}>Auto Printer</ThemedText>
            </View>
            <Switch value={autoPrinter} onValueChange={handleToggleAuto} />
          </View>

          <View style={[styles.rowBetween, { marginTop: 16 }]}>
            <View style={styles.rowLeft}>
              <IconSymbol name="square.and.arrow.down.fill" size={20} color="#0a7ea4" />
              <ThemedText style={styles.label}>Auto Save</ThemedText>
            </View>
            <Switch value={autoSave} onValueChange={handleToggleAutoSave} />
          </View>

          <ThemedText style={[styles.label, { marginTop: 16 }]}>Margin (mm)</ThemedText>
          <TextInput
            keyboardType="numeric"
            value={String(printMargin)}
            onChangeText={(t) => setPrintMarginState(t === '' ? 0 : parseFloat(t) || 0)}
            onBlur={() => handleSaveMargin(String(printMargin))}
            style={styles.input}
          />

          <ThemedText style={[styles.label, { marginTop: 16 }]}>Print Copies</ThemedText>
          <TextInput
            keyboardType="numeric"
            value={String(printCopies)}
            onChangeText={(t) => setPrintCopiesState(t === '' ? 1 : parseInt(t, 10) || 1)}
            onBlur={() => handleSavePrintCopies(String(printCopies))}
            style={styles.input}
          />
          <ThemedText style={[styles.previewHint, { marginTop: 4 }]}>Number of copies to print (1-10). Applies to auto-print too.</ThemedText>
        </View>

        {/* Templates */}
        <View style={styles.card}>
          <ThemedText type="subtitle" style={styles.cardTitle}>Template</ThemedText>
          <View style={styles.templateList}>
            {TEMPLATE_OPTIONS.map(opt => (
              <TouchableOpacity key={opt.id} style={[styles.templateItem, template === opt.id && styles.templateItemActive]} onPress={() => handleSelectTemplate(opt.id)}>
                <IconSymbol name={opt.icon as any} size={20} color={template === opt.id ? '#fff' : '#0a7ea4'} />
                <View style={styles.templateText}>
                  <ThemedText style={[styles.templateName, template === opt.id && styles.templateNameActive]}>{opt.name}</ThemedText>
                  <ThemedText style={[styles.templateDesc, template === opt.id && styles.templateDescActive]}>
                    {opt.desc}
                  </ThemedText>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Preview */}
        <View style={styles.card}>
          <ThemedText type="subtitle" style={styles.cardTitle}>Print Preview</ThemedText>
          <View ref={previewViewRef} style={styles.previewContainer}>
            {!!previewHtml && WebView ? (
              <WebView
                originWhitelist={["*"]}
                source={{ html: previewHtml }}
                style={styles.preview}
                automaticallyAdjustContentInsets
              />
            ) : (
              <View style={[styles.preview, { alignItems: 'center', justifyContent: 'center' }] }>
                <ThemedText style={{ opacity: 0.7, fontSize: 12 }}>
                  Install 'react-native-webview' to enable live preview
                </ThemedText>
              </View>
            )}
          </View>
          <ThemedText style={styles.previewHint}>Preview approximates thermal output. Actual printer may vary.</ThemedText>
          {(discoveredPrinters && discoveredPrinters.length > 0) && (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <TouchableOpacity 
                onPress={handlePreviewPrint} 
                style={[styles.button, { backgroundColor: Colors[colorScheme ?? 'light'].tint + '20', flex: 1 }]}
                disabled={isPrinting}
              >
                <IconSymbol 
                  name="printer.fill" 
                  size={18} 
                  color={isPrinting ? '#999' : Colors[colorScheme ?? 'light'].tint} 
                />
                <ThemedText style={[styles.buttonText, { color: isPrinting ? '#999' : Colors[colorScheme ?? 'light'].tint, marginLeft: 6 }]}>
                  {isPrinting ? 'Printing...' : 'Test Print'}
                </ThemedText>
              </TouchableOpacity>
              <TouchableOpacity 
                onPress={handlePreviewEpsonPrint} 
                style={[styles.button, { backgroundColor: Colors[colorScheme ?? 'light'].tint + '20', flex: 1 }]}
                disabled={isEpsonPrinting}
              >
                <IconSymbol 
                  name="antenna.radiowaves.left.and.right" 
                  size={18} 
                  color={isEpsonPrinting ? '#999' : Colors[colorScheme ?? 'light'].tint} 
                />
                <ThemedText style={[styles.buttonText, { color: isEpsonPrinting ? '#999' : Colors[colorScheme ?? 'light'].tint, marginLeft: 6 }]}>
                  {isEpsonPrinting ? 'Printing...' : 'Test Epson'}
                </ThemedText>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Epson Printer (Bluetooth & WiFi/LAN) */}
        <View style={styles.card}>
          <ThemedText type="subtitle" style={styles.cardTitle}>Epson Printer (Bluetooth & WiFi/LAN)</ThemedText>
          <ThemedText style={styles.noteText}>
            {epsonMac ? `Saved printer: ${epsonMac}` : 'No printer saved'}
            {moduleAvailable && ` | ${isDiscovering ? 'Scanning...' : 'Ready'} | Found: ${discoveredPrinters?.length || 0}`}
          </ThemedText>
          <View style={styles.rowBetween}>
            <TouchableOpacity onPress={scanEpsonPrinters} style={[styles.button, { backgroundColor: Colors[colorScheme ?? 'light'].tint + '20' }]} disabled={isDiscovering}>
              <ThemedText style={[styles.buttonText, { color: Colors[colorScheme ?? 'light'].tint }]}>
                {isDiscovering ? 'Scanning...' : 'Refresh Scan'}
              </ThemedText>
            </TouchableOpacity>
            {epsonMac && (
              <TouchableOpacity onPress={async () => { await setEpsonPrinterMac(null); setEpsonMac(null); }} style={[styles.buttonOutline, { borderColor: Colors[colorScheme ?? 'light'].tint }]}>
                <ThemedText style={[styles.buttonText, { color: Colors[colorScheme ?? 'light'].tint }]}>Clear Saved</ThemedText>
              </TouchableOpacity>
            )}
          </View>
          {discoveredPrinters && discoveredPrinters.length > 0 ? (
            <>
              <View style={{ gap: 8, marginTop: 8 }}>
                {discoveredPrinters.map((p) => {
                  // Determine connection type: WiFi/LAN if IP address is present, otherwise Bluetooth
                  const isWiFi = p.ipAddress && p.ipAddress.trim() !== '';
                  const connectionType = isWiFi ? 'WiFi/LAN' : 'Bluetooth';
                  const displayName = p.deviceName || p.name || p.target;
                  const displayInfo = isWiFi && p.ipAddress ? `${displayName} (${p.ipAddress})` : displayName;
                  return (
                    <TouchableOpacity key={p.target} onPress={() => connectEpson(p)} style={[styles.buttonOutline, { borderColor: Colors[colorScheme ?? 'light'].tint }]} disabled={connecting}>
                      <ThemedText style={[styles.buttonText, { color: Colors[colorScheme ?? 'light'].tint }]}>
                        {connecting ? 'Connecting…' : `[${connectionType}] ${displayInfo}`}
                      </ThemedText>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Debug Info Section */}
              {discoveredPrinters.length > 0 && (
                <View style={[styles.debugSection, { marginTop: 12, padding: 12, backgroundColor: Colors[colorScheme ?? 'light'].tint + '10', borderRadius: 8 }]}>
                  <ThemedText style={[styles.label, { marginBottom: 8 }]}>Debug Info (First Printer):</ThemedText>
                  {discoveredPrinters[0] && (() => {
                    const p = discoveredPrinters[0];
                    const isWiFi = p.ipAddress && p.ipAddress.trim() !== '';
                    return (
                      <View style={{ gap: 4 }}>
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
                      </View>
                    );
                  })()}
                </View>
              )}

              {/* Simple Test Print Button */}
              <TouchableOpacity 
                onPress={handleSimpleTestPrint} 
                style={[styles.button, { backgroundColor: Colors[colorScheme ?? 'light'].tint, marginTop: 12 }]}
                disabled={isTestPrinting}
              >
                <IconSymbol 
                  name="checkmark.circle.fill" 
                  size={18} 
                  color="#fff" 
                />
                <ThemedText style={[styles.buttonText, { color: '#fff', marginLeft: 6 }]}>
                  {isTestPrinting ? 'Printing Test...' : 'Simple Test Print (Text Only)'}
                </ThemedText>
              </TouchableOpacity>
            </>
          ) : moduleAvailable && !isDiscovering ? (
            <ThemedText style={[styles.noteText, { marginTop: 8 }]}>
              No printers found. Make sure Bluetooth/WiFi is enabled and the printer is on and discoverable (on the same network for WiFi/LAN).
            </ThemedText>
          ) : moduleAvailable && isDiscovering ? (
            <ThemedText style={[styles.noteText, { marginTop: 8 }]}>Scanning for printers (Bluetooth & WiFi/LAN)...</ThemedText>
          ) : null}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(10, 126, 164, 0.2)',
    backgroundColor: 'rgba(10, 126, 164, 0.06)',
  },
  cardTitle: {
    marginBottom: 12,
    fontSize: 18,
  },
  label: {
    marginBottom: 8,
    fontSize: 14,
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(10, 126, 164, 0.3)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    marginRight: 12,
  },
  settingText: {
    flex: 1,
  },
  description: {
    fontSize: 12,
    opacity: 0.7,
    marginTop: 2,
  },
  noteText: {
    fontSize: 12,
    opacity: 0.7,
    marginBottom: 8,
  },
  button: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonOutline: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  templateList: {
    gap: 10,
  },
  templateItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(10, 126, 164, 0.25)',
    borderRadius: 10,
    backgroundColor: '#fff',
  },
  templateItemActive: {
    backgroundColor: '#0a7ea4',
    borderColor: '#0a7ea4',
  },
  templateText: {
    flex: 1,
  },
  templateName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0a7ea4',
  },
  templateNameActive: {
    color: '#fff',
  },
  templateDesc: {
    fontSize: 12,
    color: '#4f6b78',
  },
  templateDescActive: {
    color: 'rgba(255,255,255,0.9)',
  },
  previewContainer: {
    height: 320,
    borderWidth: 1,
    borderColor: 'rgba(10, 126, 164, 0.2)',
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  preview: {
    flex: 1,
    backgroundColor: '#fff',
  },
  previewHint: {
    marginTop: 8,
    fontSize: 12,
    opacity: 0.7,
  },
  debugSection: {
    borderWidth: 1,
    borderColor: 'rgba(10, 126, 164, 0.2)',
  },
  debugText: {
    fontSize: 11,
    fontFamily: 'monospace',
    opacity: 0.8,
  },
});

function buildPreviewHtml({ shopName, margin, template }: { shopName: string; margin: number; template: PrintTemplateId }): string {
  const tpl = template || 'classic';
  // Template styles
  const sizes = tpl === 'compact' ? { base: 10, title: 14, line: 11 } : tpl === 'kitchen' ? { base: 12, title: 18, line: 14 } : { base: 11, title: 16, line: 13 };
  const spacing = tpl === 'compact' ? { item: 2, section: 8 } : tpl === 'kitchen' ? { item: 5, section: 12 } : { item: 3, section: 10 };

  const escapeHTML = (str: string): string => {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  const defaultShopName = 'Pappas Ocean Catch';
  const safeShop = escapeHTML(shopName || defaultShopName);
  
  // Generate current date/time using utility
  const dateTimeStr = formatDateTime();
  
  // Mock order number
  const mockOrderNumber = '12345';

  const items = [
    { name: 'FISH & CHIPS', qty: 1, price: 12.5 },
    { name: 'CALAMARI', qty: 2, price: 9.0 },
    { name: 'COKE 375ML', qty: 1, price: 3.5 },
  ];
  const subtotal = items.reduce((s, i) => s + i.price, 0);
  const gst = subtotal * (10 / 110);
  const total = subtotal;

  const itemsHtml = items
    .map(i => `<div style="display:flex;justify-content:space-between;margin:${spacing.item}px 0;font-size:${sizes.line}px;"><span>${i.qty > 1 ? `<b style=\"color:#0a7ea4\">${i.qty}x</b> ` : ''}${escapeHTML(i.name)}</span><span><b>$${i.price.toFixed(2)}</b></span></div>`) 
    .join('');

  return `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8">
      <style>
        @page { size: A5 portrait; margin: ${margin}mm; }
        * { margin:0; padding:0; box-sizing: border-box; }
        body { font-family: 'Courier New', monospace; padding: ${margin}mm; font-size: ${sizes.base}px; line-height: 1.5; }
        .receipt-header { text-align:center; margin-bottom: ${spacing.section}px; }
        .divider { border-top:1px solid #E5E5E5; margin:${spacing.section}px 0; }
        .shop-name { font-weight:bold; color:#0a7ea4; margin-bottom: 6px; font-size: ${sizes.base + 3}px; }
        .order-number { font-weight:600; margin-bottom: 6px; font-size: ${sizes.base + 1}px; }
        .date-time { color:#666; margin: 2px 0; font-size: ${sizes.base - 1}px; }
        .footer { text-align:center; margin-top:${spacing.section}px; font-size:${sizes.base - 2}px; color:#666; font-style:italic; }
      </style>
    </head>
    <body>
      <div class="receipt-header">
        <div class="divider"></div>
      </div>
      
      <div style="text-align: center; margin-bottom: ${spacing.section}px;">
        <div class="shop-name">${safeShop}</div>
        <div class="order-number">Order #: ${mockOrderNumber}</div>
        <div class="date-time">${dateTimeStr}</div>
        <div class="divider"></div>
      </div>
      
      ${itemsHtml}
      <div class="divider"></div>
      <div style="display:flex;justify-content:space-between;margin:${spacing.item}px 0;">
        <span>Subtotal:</span><span>$${subtotal.toFixed(2)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin:${spacing.item}px 0;">
        <span>GST:</span><span>$${gst.toFixed(2)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;margin:${spacing.item}px 0;font-weight:bold;">
        <span>Total:</span><span>$${total.toFixed(2)}</span>
      </div>
      <div class="divider"></div>
      <div class="footer">Thank you for your purchase!</div>
    </body>
  </html>`;
}




