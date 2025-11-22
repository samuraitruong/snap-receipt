import { ReceiptData } from './ocr';
import { PrintTemplateId } from './settings';

/**
 * Calculate subtotal and GST from total (GST is 10% inclusive)
 */
export function calculateTotals(total: number) {
  const subtotal = total * (100 / 110);
  const gst = total * (10 / 110);
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    gst: Math.round(gst * 100) / 100,
    total: total,
  };
}

/**
 * Format date/time for printing (removes non-printable characters)
 */
export function formatDateTime(): string {
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
  // Use space instead of dash to avoid non-printable character issues
  return `${weekday}, ${day}/${month}/${year} ${timeStr}`;
}

/**
 * Get template-specific formatting settings
 */
export function getTemplateSettings(template: PrintTemplateId) {
  switch (template) {
    case 'compact':
      return {
        lineWidth: 40, // Smaller width for compact
        feedLinesBeforeItems: 0,
        feedLinesAfterItems: 0,
        feedLinesBeforeTotals: 1,
        feedLinesAfterTotals: 1,
        feedLinesBeforeFooter: 1,
        feedLinesAfterFooter: 2,
        dividerChar: '-',
      };
    case 'kitchen':
      return {
        lineWidth: 44, // Larger width for kitchen
        feedLinesBeforeItems: 1,
        feedLinesAfterItems: 1,
        feedLinesBeforeTotals: 2,
        feedLinesAfterTotals: 1,
        feedLinesBeforeFooter: 2,
        feedLinesAfterFooter: 3,
        dividerChar: '=',
      };
    case 'classic':
    default:
      return {
        lineWidth: 42, // Standard width for classic
        feedLinesBeforeItems: 0,
        feedLinesAfterItems: 0,
        feedLinesBeforeTotals: 1,
        feedLinesAfterTotals: 0,
        feedLinesBeforeFooter: 1,
        feedLinesAfterFooter: 3,
        dividerChar: '=',
      };
  }
}

export type ReceiptLine = {
  text: string;
  textWithoutPrice: string;
  price: string | null;
  quantity: string | null;
  isIndented: boolean;
  isTotalLine: boolean;
  hasPrice: boolean;
  key: string;
};

/**
 * Print receipt manually as text (fallback when addViewShot fails)
 * Supports templates: classic, compact, kitchen
 */
export async function printReceiptAsText(
  printer: any,
  PrinterConstants: any,
  receiptData: ReceiptData | null,
  filteredReceiptLines: ReceiptLine[] | null,
  orderNumber: string | null,
  shopName: string,
  template: PrintTemplateId = 'classic',
  isPaid: boolean = false
): Promise<void> {
  const settings = getTemplateSettings(template);
  const lineWidth = settings.lineWidth;
  const divider = settings.dividerChar.repeat(lineWidth);
  const formatColumns = (left: string, right?: string) => {
    const leftText = left || '';
    const rightText = right || '';
    if (!rightText) {
      return `${leftText}\n`;
    }
    const padding = Math.max(1, lineWidth - leftText.length - rightText.length);
    const spaces = padding > 0 ? ' '.repeat(padding) : ' ';
    return `${leftText}${spaces}${rightText}\n`;
  };

  try {
    // Set alignment to center for header
    if (printer.addTextAlign && typeof printer.addTextAlign === 'function' && PrinterConstants) {
      try {
        await printer.addTextAlign(PrinterConstants.ALIGN_CENTER);
      } catch (e) {
        console.warn('[PRINTER] Text alignment failed (continuing anyway):', e);
      }
    }

    // Print divider
    await printer.addText(`${divider}\n`);
    await printer.addFeedLine(settings.feedLinesBeforeItems);

    // Print shop name
    await printer.addText(`${shopName || 'Pappa\'s Ocean Catch'}\n`);
    await printer.addFeedLine(1);

    const dateTimeStr = formatDateTime();
    const customerDetails = receiptData?.customer;
    const customerNameText = customerDetails?.name ? `Customer: ${customerDetails.name}` : '';
    const customerPhoneText = customerDetails?.phone ? `Phone: ${customerDetails.phone}` : '';
    const orderLineText = orderNumber ? `Order #: ${orderNumber}` : '';

    if (orderLineText || customerNameText) {
      await printer.addText(formatColumns(orderLineText, customerNameText || undefined));
    }

    await printer.addText(formatColumns(dateTimeStr, customerPhoneText || undefined));
    
    // Print payment status
    const paymentStatusText = isPaid ? 'PAID' : 'Unpaid';
    await printer.addText(formatColumns('', paymentStatusText));
    
    await printer.addFeedLine(settings.feedLinesAfterItems);

    // Print divider
    await printer.addText(`${divider}\n`);
    await printer.addFeedLine(1);

    // Set alignment to left for items
    if (printer.addTextAlign && typeof printer.addTextAlign === 'function' && PrinterConstants) {
      try {
        await printer.addTextAlign(PrinterConstants.ALIGN_LEFT);
      } catch (e) {
        console.warn('[PRINTER] Text alignment failed (continuing anyway):', e);
      }
    }

    // Print items
    if (receiptData && receiptData.items) {
      // Print from JSON data
      for (const item of receiptData.items) {
        const quantityText = item.quantity > 1 ? `${item.quantity}x ` : '';
        const nameText = item.name;
        const priceText = `$${item.price.toFixed(2)}`;

        // Calculate padding for alignment with right margin
        const leftPart = `${quantityText}${nameText}`;
        const padding = Math.max(1, lineWidth - leftPart.length - priceText.length);
        const paddedLine = `${leftPart}${' '.repeat(padding)}${priceText}\n`;

        await printer.addText(paddedLine);

        // Print modifiers if any
        if (item.modifiers && item.modifiers.length > 0) {
          for (const modifier of item.modifiers) {
            await printer.addText(`  ${modifier}\n`);
          }
        }
      }

      // Print totals
      await printer.addFeedLine(settings.feedLinesBeforeTotals);
      await printer.addText(`${settings.dividerChar.repeat(Math.min(lineWidth, 24))}\n`);

      const totals = calculateTotals(receiptData.total);
      const subtotalLine = `Subtotal:${' '.repeat(lineWidth - 8 - totals.subtotal.toFixed(2).length - 1)}$${totals.subtotal.toFixed(2)}\n`;
      await printer.addText(subtotalLine);

      const gstLine = `GST:${' '.repeat(lineWidth - 4 - totals.gst.toFixed(2).length - 1)}$${totals.gst.toFixed(2)}\n`;
      await printer.addText(gstLine);

      const totalLine = `Total:${' '.repeat(lineWidth - 6 - totals.total.toFixed(2).length - 1)}$${totals.total.toFixed(2)}\n`;
      await printer.addText(totalLine);
    } else if (filteredReceiptLines && filteredReceiptLines.length > 0) {
      // Print from parsed text lines
      const productLines = filteredReceiptLines.filter(line => !line.isTotalLine);
      const totalLines = filteredReceiptLines.filter(line => line.isTotalLine);

      // Sort total lines: Subtotal first, GST second, Total last
      const sortedTotalLines = [...totalLines].sort((a, b) => {
        const aText = a.text.toUpperCase();
        const bText = b.text.toUpperCase();
        if (aText.startsWith('SUBTOTAL')) return -1;
        if (bText.startsWith('SUBTOTAL')) return 1;
        if (aText.startsWith('GST')) return -1;
        if (bText.startsWith('GST')) return 1;
        if (aText.startsWith('TOTAL')) return 1;
        if (bText.startsWith('TOTAL')) return -1;
        return 0;
      });

      // Print product lines
      for (const line of productLines) {
        if (line.isIndented) {
          await printer.addText(`  ${line.text}\n`);
        } else if (line.hasPrice) {
          const quantityText = line.quantity ? `${line.quantity}x ` : '';
          const nameText = line.textWithoutPrice;
          const priceText = line.price || '';

          const leftPart = `${quantityText}${nameText}`;
          const padding = Math.max(1, lineWidth - leftPart.length - priceText.length);
          const paddedLine = `${leftPart}${' '.repeat(padding)}${priceText}\n`;

          await printer.addText(paddedLine);
        } else {
          await printer.addText(`${line.text}\n`);
        }
      }

      // Print totals
      if (sortedTotalLines.length > 0) {
        await printer.addFeedLine(settings.feedLinesBeforeTotals);
        await printer.addText(`${settings.dividerChar.repeat(Math.min(lineWidth, 24))}\n`);

        for (const line of sortedTotalLines) {
          if (line.hasPrice) {
            const label = line.textWithoutPrice;
            const priceText = line.price || '';

            const padding = Math.max(1, lineWidth - label.length - priceText.length);
            const paddedLine = `${label}${' '.repeat(padding)}${priceText}\n`;

            await printer.addText(paddedLine);
          } else {
            await printer.addText(`${line.text}\n`);
          }
        }
      }
    }

    // Print footer
    await printer.addFeedLine(settings.feedLinesBeforeFooter);
    await printer.addText(`${divider}\n`);

    if (printer.addTextAlign && typeof printer.addTextAlign === 'function' && PrinterConstants) {
      try {
        await printer.addTextAlign(PrinterConstants.ALIGN_CENTER);
      } catch (e) {
        console.warn('[PRINTER] Text alignment failed (continuing anyway):', e);
      }
    }

    await printer.addText('Thank you for your purchase!\n');
    await printer.addFeedLine(settings.feedLinesAfterFooter);
  } catch (error: any) {
    console.error('[PRINTER] Error in printReceiptAsText:', error);
    throw error;
  }
}

