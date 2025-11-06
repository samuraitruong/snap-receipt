import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getAutoPrinter, getAutoSave, getEpsonPrinterMac, getOCRMode, getPrintMargin, getPrintTemplate, getShopName, OCRMode, setAutoPrinter, setAutoSave, setEpsonPrinterMac, setOCRMode, setPrintMargin, setPrintTemplate, setShopName, type PrintTemplateId } from '@/utils/settings';
import { useEffect, useState } from 'react';
import { NativeModules, Platform, ScrollView, StyleSheet, Switch, TextInput, TouchableOpacity, View } from 'react-native';
// Prefer the library's discovery hook when available
// It requires the native module to be installed and Android build
// eslint-disable-next-line @typescript-eslint/no-var-requires
import { usePrintersDiscovery } from 'react-native-esc-pos-printer';
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
  const [ocrMode, setOcrModeState] = useState<OCRMode>('vision');
  const [template, setTemplateState] = useState<PrintTemplateId>('classic');
  const [loading, setLoading] = useState(true);
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [epsonMac, setEpsonMac] = useState<string | null>(null);
  const [printers, setPrinters] = useState<any[]>([]);
  const [connecting, setConnecting] = useState(false);
  // Pick discovery hook or a noop fallback to keep hook order stable
  const useDiscovery: () => { start: () => void; isDiscovering: boolean; printers: any[] } =
    typeof usePrintersDiscovery === 'function'
      ? (usePrintersDiscovery as any)
      : (() => ({ start: () => {}, isDiscovering: false, printers: [] }));
  const { start, isDiscovering, printers: discoveredPrinters } = useDiscovery();

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

  // Auto-start discovery on Android builds when hook is available
  useEffect(() => {
    try { start && start(); } catch {}
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

  const scanEpsonPrinters = async () => {
    try {
      if (!NativeModules || !('EscPosPrinter' in NativeModules)) {
        alert('Epson printer module not available. Install the library and rebuild the app.');
        return;
      }
      const mod: any = await import('react-native-esc-pos-printer').catch(() => null);
      const EpsonModule = mod?.EscPosPrinter as any;
      if (!EpsonModule) {
        alert('Epson module not installed in this build.');
        return;
      }
      const list = await EpsonModule.discover();
      setPrinters(Array.isArray(list) ? list : []);
    } catch (e) {
      console.error('Scan error:', e);
      alert('Failed to scan printers');
    }
  };

  const connectEpson = async (printer: any) => {
    try {
      if (!NativeModules || !('EscPosPrinter' in NativeModules)) {
        alert('Epson printer module not available. Install the library and rebuild the app.');
        return;
      }
      const mod: any = await import('react-native-esc-pos-printer').catch(() => null);
      const EpsonModule = mod?.EscPosPrinter as any;
      if (!EpsonModule) {
        alert('Epson module not installed in this build.');
        return;
      }
      setConnecting(true);
      const device = await EpsonModule.connect(printer.target);
      const mac = device?.target || printer?.target;
      if (mac) {
        await setEpsonPrinterMac(mac);
        setEpsonMac(mac);
        alert(`Connected to ${printer.name || mac}`);
      }
    } catch (e) {
      console.error('Connection error:', e);
      alert('Failed to connect');
    } finally {
      setConnecting(false);
    }
  };

  // Build preview HTML whenever inputs change
  useEffect(() => {
    const html = buildPreviewHtml({ shopName, margin: printMargin, template });
    setPreviewHtml(html);
  }, [shopName, printMargin, template]);

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

      {/* Epson Printer (Bluetooth) */}
      <View style={styles.card}>
          <ThemedText type="subtitle" style={styles.cardTitle}>Epson Printer (Bluetooth)</ThemedText>
          <ThemedText style={styles.noteText}>{epsonMac ? `Saved printer: ${epsonMac}` : 'No printer saved'}</ThemedText>
          <View style={styles.rowBetween}>
            <TouchableOpacity onPress={scanEpsonPrinters} style={[styles.button, { backgroundColor: Colors[colorScheme ?? 'light'].tint + '20' }]}>
              <ThemedText style={[styles.buttonText, { color: Colors[colorScheme ?? 'light'].tint }]}>Scan Printers</ThemedText>
            </TouchableOpacity>
            {epsonMac && (
              <TouchableOpacity onPress={async () => { await setEpsonPrinterMac(null); setEpsonMac(null); }} style={[styles.buttonOutline, { borderColor: Colors[colorScheme ?? 'light'].tint }]}>
                <ThemedText style={[styles.buttonText, { color: Colors[colorScheme ?? 'light'].tint }]}>Clear Saved</ThemedText>
              </TouchableOpacity>
            )}
          </View>
          {(discoveredPrinters.length > 0 || printers.length > 0) && (
            <View style={{ gap: 8, marginTop: 8 }}>
              {(discoveredPrinters.length > 0 ? discoveredPrinters : printers).map((p) => (
                <TouchableOpacity key={p.target} onPress={() => connectEpson(p)} style={[styles.buttonOutline, { borderColor: Colors[colorScheme ?? 'light'].tint }]} disabled={connecting}>
                  <ThemedText style={[styles.buttonText, { color: Colors[colorScheme ?? 'light'].tint }]}>{connecting ? 'Connecting…' : `Connect: ${p.name || p.target}`}</ThemedText>
                </TouchableOpacity>
              ))}
            </View>
          )}
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
          <View style={styles.previewContainer}>
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

  const safeShop = (shopName || '').replace(/[&<>"']/g, s => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[s] as string));

  const items = [
    { name: 'FISH & CHIPS', qty: 1, price: 12.5 },
    { name: 'CALAMARI', qty: 2, price: 9.0 },
    { name: 'COKE 375ML', qty: 1, price: 3.5 },
  ];
  const subtotal = items.reduce((s, i) => s + i.price, 0);
  const gst = subtotal * (10 / 110);
  const total = subtotal;

  const itemsHtml = items
    .map(i => `<div style="display:flex;justify-content:space-between;margin:${spacing.item}px 0;font-size:${sizes.line}px;"><span>${i.qty > 1 ? `<b style=\"color:#0a7ea4\">${i.qty}x</b> ` : ''}${i.name}</span><span><b>$${i.price.toFixed(2)}</b></span></div>`) 
    .join('');

  return `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8">
      <style>
        @page { size: A5 portrait; margin: ${margin}mm; }
        * { margin:0; padding:0; box-sizing: border-box; }
        body { font-family: 'Courier New', monospace; padding: ${margin}mm; font-size: ${sizes.base}px; }
        .hdr { text-align:center; margin-bottom: ${spacing.section}px; }
        .title { font-size: ${sizes.title}px; font-weight: bold; letter-spacing: 2px; margin-bottom: 6px; }
        .shop { font-weight:bold; color:#0a7ea4; margin-bottom: 4px; }
        .divider { border-top:1px solid #E5E5E5; margin:${spacing.section}px 0; }
        .footer { text-align:center; margin-top:${spacing.section}px; font-size:${sizes.base - 2}px; color:#666; font-style:italic; }
      </style>
    </head>
    <body>
      <div class="hdr">
        <div class="title">RECEIPT</div>
        ${safeShop ? `<div class="shop">${safeShop}</div>` : ''}
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
      <div class="footer">Preview only</div>
    </body>
  </html>`;
}




