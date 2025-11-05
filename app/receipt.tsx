import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import { ReceiptData } from '@/utils/ocr';
import { Image } from 'expo-image';
import * as Print from 'expo-print';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';

export default function ReceiptScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const imageUri = params.imageUri ? decodeURIComponent(params.imageUri as string) : null;
  const extractedText = params.extractedText ? decodeURIComponent(params.extractedText as string) : '';
  const extractedDataType = params.extractedDataType as 'json' | 'text' | undefined;
  const orderNumber = params.orderNumber ? params.orderNumber as string : null;
  const [isPrinting, setIsPrinting] = useState(false);
  const [showImage, setShowImage] = useState(false);

  // Theme colors for dark mode support
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({ light: '#E5E5E5', dark: '#333333' }, 'text');
  const cardBackground = useThemeColor({ light: '#FFFFFF', dark: '#1C1C1E' }, 'background');
  const secondaryText = useThemeColor({ light: '#666666', dark: '#999999' }, 'text');
  const tertiaryText = useThemeColor({ light: '#333333', dark: '#CCCCCC' }, 'text');
  const tintColor = useThemeColor({ light: '#007AFF', dark: '#0A84FF' }, 'tint');

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

  // Calculate subtotal and GST from total (GST is 10% inclusive)
  const calculateTotals = (total: number) => {
    const subtotal = total * (100 / 110);
    const gst = total * (10 / 110);
    return {
      subtotal: Math.round(subtotal * 100) / 100,
      gst: Math.round(gst * 100) / 100,
      total: total,
    };
  };

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

  const handlePrint = async () => {
    try {
      setIsPrinting(true);
      
      // Generate HTML for the receipt
      const html = isJson && receiptData 
        ? generateReceiptHTMLFromJSON(receiptData, orderNumber)
        : filteredReceiptLines 
          ? generateReceiptHTML(filteredReceiptLines, orderNumber)
          : '<html><body>No receipt data available</body></html>';
      
      // Print the receipt
      await Print.printAsync({
        html,
        orientation: Print.Orientation.portrait,
        paperSize: [148, 210], // A5 size in mm (width x height)
        margins: {
          left: 8,
          top: 8,
          right: 8,
          bottom: 8,
        },
      });
    } catch (error) {
      console.error('Print error:', error);
      Alert.alert('Print Error', 'Failed to print receipt. Please try again.');
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

  const generateReceiptHTMLFromJSON = (receiptData: ReceiptData, orderNum: string | null): string => {
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

    const totals = calculateTotals(receiptData.total);

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
              margin: 8mm 10mm;
            }
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: 'Courier New', monospace;
              margin: 0;
              padding: 8mm 10mm;
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
            <div class="receipt-title">RECEIPT</div>
            <div class="divider"></div>
          </div>
          
          <div style="text-align: center; margin-bottom: 12px;">
            <div class="shop-name">Pappa's Ocean Catch</div>
            ${orderNum ? `<div class="order-number">Order #: ${escapeHTML(orderNum)}</div>` : ''}
            <div class="date-time">${escapeHTML(dateTimeStr)}</div>
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
  }>, orderNum: string | null): string => {
    const currentDate = new Date();
    // Format: "Wed, 25/11/2025 - 11:50 AM"
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
              margin: 8mm 10mm;
            }
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: 'Courier New', monospace;
              margin: 0;
              padding: 8mm 10mm;
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
            <div class="receipt-title">RECEIPT</div>
            <div class="divider"></div>
          </div>
          
          <div style="text-align: center; margin-bottom: 12px;">
            <div class="shop-name">Pappa's Ocean Catch</div>
            ${orderNum ? `<div class="order-number">Order #: ${escapeHTML(orderNum)}</div>` : ''}
            <div class="date-time">${escapeHTML(dateTimeStr)}</div>
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
      <View style={[styles.header, { backgroundColor, borderBottomColor: borderColor }]}>
        <TouchableOpacity onPress={() => router.back()} style={[styles.backButton, { backgroundColor: tintColor + '20' }]}>
          <IconSymbol name="chevron.left" size={24} color={tintColor} />
        </TouchableOpacity>
        <ThemedText type="title" style={styles.title}>Receipt</ThemedText>
        <TouchableOpacity 
          onPress={handlePrint} 
          style={[styles.printButton, { backgroundColor: tintColor + '20' }]}
          disabled={isPrinting}
        >
          <IconSymbol 
            name="printer.fill" 
            size={24} 
            color={isPrinting ? secondaryText : tintColor} 
          />
        </TouchableOpacity>
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

        <ThemedView style={[styles.receiptContainer, { backgroundColor: cardBackground }]}>
          <View style={styles.receiptHeader}>
            <ThemedText type="subtitle" style={styles.receiptTitle}>RECEIPT</ThemedText>
            <View style={[styles.divider, { backgroundColor: borderColor }]} />
          </View>

          {/* Shop Information Section */}
          <View style={styles.shopInfoSection}>
            <ThemedText type="subtitle" style={styles.shopName}>Pappa's Ocean Catch</ThemedText>
            {orderNumber && (
              <ThemedText style={[styles.orderNumber, { color: tertiaryText }]}>Order #: {orderNumber}</ThemedText>
            )}
            <ThemedText style={[styles.dateTime, { color: secondaryText }]}>
              {(() => {
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
                return `${weekday}, ${day}/${month}/${year} - ${timeStr}`;
              })()}
            </ThemedText>
            <View style={[styles.divider, { backgroundColor: borderColor }]} />
          </View>

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
        </ThemedView>
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
    paddingTop: 60,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
  },
  printButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
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
});

