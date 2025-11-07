import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getAutoPrinter, getAutoSave, getEpsonPrinterMac, getOCRMode, getPrintMargin, getPrintTemplate, getShopName, OCRMode, setAutoPrinter, setAutoSave, setEpsonPrinterMac, setOCRMode, setPrintMargin, setPrintTemplate, setShopName, type PrintTemplateId } from '@/utils/settings';
import * as Print from 'expo-print';
import { useEffect, useRef, useState } from 'react';
import { Alert, findNodeHandle, NativeModules, Platform, ScrollView, StyleSheet, Switch, TextInput, TouchableOpacity, View } from 'react-native';
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
  const [autoPrinter, setAutoPrinterState] = useState(false);
  const [autoSave, setAutoSaveState] = useState(false);
  const [ocrMode, setOcrModeState] = useState<OCRMode>('generative');
  const [template, setTemplateState] = useState<PrintTemplateId>('classic');
  const [loading, setLoading] = useState(true);
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [epsonMac, setEpsonMac] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isEpsonPrinting, setIsEpsonPrinting] = useState(false);
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

  useEffect(() => {
    const load = async () => {
      try {
        const [name, margin, auto, save, mode, tpl, savedMac] = await Promise.all([
          getShopName(),
          getPrintMargin(),
          getAutoPrinter(),
          getAutoSave(),
          getOCRMode(),
          getPrintTemplate(),
          getEpsonPrinterMac(),
        ]);
        setShopNameState(name);
        setPrintMarginState(margin);
        setAutoPrinterState(auto);
        setAutoSaveState(save);
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

  const handleToggleAuto = async (value: boolean) => {
    setAutoPrinterState(value);
    await setAutoPrinter(value);
  };

  const handleToggleAutoSave = async (value: boolean) => {
    setAutoSaveState(value);
    await setAutoSave(value);
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
      // Try to load the module
      let EpsonModule: any = null;
      try {
        const mod: any = await import('react-native-esc-pos-printer').catch(() => null);
        EpsonModule = mod?.EscPosPrinter;
      } catch (e) {
        console.error('Failed to import Epson module:', e);
      }

      // Also try checking NativeModules (for release builds)
      if (!EpsonModule && NativeModules && 'EscPosPrinter' in NativeModules) {
        EpsonModule = NativeModules.EscPosPrinter;
      }

      if (!EpsonModule) {
        Alert.alert(
          'Printer Module Not Found',
          'The Epson printer module is not included in this build. Make sure you:\n\n1. Installed react-native-esc-pos-printer\n2. Rebuilt the app with npx expo run:android\n3. Not using Expo Go (use a development build)'
        );
        return;
      }

      if (!printer?.target) {
        Alert.alert('Invalid Printer', 'Printer information is missing. Please scan again.');
        return;
      }

      setConnecting(true);
      console.log(`Connecting to printer: ${printer.name || printer.target}`);
      
      const device = await EpsonModule.connect(printer.target);
      const mac = device?.target || printer?.target;
      
      if (mac) {
        await setEpsonPrinterMac(mac);
        setEpsonMac(mac);
        console.log(`Successfully connected to printer: ${mac}`);
        Alert.alert('Success', `Connected to ${printer.name || mac}`);
      } else {
        Alert.alert('Connection Failed', 'Could not get printer MAC address');
      }
    } catch (e: any) {
      console.error('Connection error:', e);
      Alert.alert('Connection Failed', `Failed to connect to printer: ${e?.message || 'Unknown error'}`);
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
      if (!target) {
        Alert.alert(
          'No Printers Found',
          'No printers were discovered. Make sure:\n\n1. Bluetooth/WiFi is enabled on your device\n2. The printer is powered on\n3. For Bluetooth: printer is in pairing/discovery mode and within range\n4. For WiFi/LAN: printer is on the same network\n\nDiscovery runs automatically in the background.'
        );
        return;
      }

      // Try to load the module
      let EpsonModule: any = null;
      try {
        const mod: any = await import('react-native-esc-pos-printer').catch(() => null);
        EpsonModule = mod?.EscPosPrinter;
      } catch (e) {
        console.error('Failed to import Epson module:', e);
      }

      // Also try checking NativeModules (for release builds)
      if (!EpsonModule && NativeModules && 'EscPosPrinter' in NativeModules) {
        EpsonModule = NativeModules.EscPosPrinter;
      }

      if (!EpsonModule) {
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
      console.log(`Printing preview to printer: ${discoveredPrinters[0]?.name || target}`);
      
      // Based on the library example (PrintFromView)
      // Try different API methods
      if (typeof EpsonModule.printFromView === 'function') {
        await EpsonModule.printFromView(target, viewTag, 80);
      } else if (EpsonModule.prototype && typeof EpsonModule.prototype.printFromView === 'function') {
        const printer = new EpsonModule(target, 80);
        await printer.printFromView(viewTag);
        await printer.close?.();
      } else if (typeof EpsonModule === 'function') {
        // Try constructor approach
        const printer = new EpsonModule(target, 80);
        await printer.init?.();
        await printer.printFromView?.(viewTag);
        await printer.close?.();
      } else {
        Alert.alert('Printer', 'printFromView API not available. Check library version.');
      }
      
      Alert.alert('Success', 'Print job sent to printer');
      setIsEpsonPrinting(false);
    } catch (error: any) {
      console.error('Epson print error:', error);
      setIsEpsonPrinting(false);
      Alert.alert('Printer Error', `Failed to print: ${error?.message || 'Unknown error'}`);
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
  
  // Generate current date/time
  const currentDate = new Date();
  const weekday = currentDate.toLocaleDateString('en-US', { weekday: 'short' });
  const day = currentDate.getDate().toString().padStart(2, '0');
  const month = (currentDate.getMonth() + 1).toString().padStart(2, '0');
  const year = currentDate.getFullYear();
  const timeStr = currentDate.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: true
  });
  const dateTimeStr = `${weekday}, ${day}/${month}/${year} - ${timeStr}`;
  
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




