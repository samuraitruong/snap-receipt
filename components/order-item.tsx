import { ThemedText } from '@/components/themed-text';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { type ReceiptRecord } from '@/utils/database';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

interface OrderItemProps {
  receipt: ReceiptRecord;
  onPress: (receipt: ReceiptRecord) => void;
  cardBackground?: string;
  borderColor?: string;
  secondaryText?: string;
  tintColor?: string;
}

/**
 * Format time from SQLite UTC datetime to local time string
 */
function formatTime(dateStr: string): string {
  try {
    // SQLite datetime('now') returns UTC time in format "YYYY-MM-DD HH:MM:SS"
    // We need to treat it as UTC and convert to local time for display
    let dateStrWithTz = dateStr.trim();
    
    // Check if it already has timezone info (Z at end, or timezone offset like +11:00 or -05:00)
    const hasTimezone = dateStrWithTz.endsWith('Z') || 
                        /[+-]\d{2}:?\d{2}$/.test(dateStrWithTz);
    
    if (!hasTimezone) {
      // SQLite format: "YYYY-MM-DD HH:MM:SS" - convert to ISO format and treat as UTC
      if (dateStrWithTz.includes(' ')) {
        // Replace space with T and add Z for UTC
        dateStrWithTz = dateStrWithTz.replace(' ', 'T') + 'Z';
      } else if (dateStrWithTz.includes('T') && !dateStrWithTz.endsWith('Z')) {
        // ISO format without timezone - add Z
        dateStrWithTz = dateStrWithTz + 'Z';
      }
    }
    
    const date = new Date(dateStrWithTz);
    // Check if date is valid
    if (isNaN(date.getTime())) {
      console.warn('Invalid date string:', dateStr);
      return '';
    }
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  } catch (error) {
    console.error('Error formatting time:', error, dateStr);
    return '';
  }
}

export function OrderItem({ 
  receipt, 
  onPress, 
  cardBackground, 
  borderColor, 
  secondaryText,
  tintColor 
}: OrderItemProps) {
  return (
    <TouchableOpacity
      onPress={() => onPress(receipt)}
      style={[
        styles.receiptCard, 
        cardBackground && { backgroundColor: cardBackground },
        borderColor && { borderColor }
      ]}
    >
      <View style={styles.receiptHeader}>
        <View style={styles.receiptInfo}>
          <View style={styles.receiptTopRow}>
            <ThemedText style={styles.receiptTotal}>${receipt.total_price.toFixed(2)}</ThemedText>
            {receipt.created_at && (
              <ThemedText style={[styles.receiptTimeText, secondaryText && { color: secondaryText }]}>
                {formatTime(receipt.created_at)}
              </ThemedText>
            )}
          </View>
          {receipt.order_number && (
            <ThemedText style={[styles.receiptOrder, secondaryText && { color: secondaryText }]}>
              Order #{receipt.order_number}
            </ThemedText>
          )}
        </View>
        <IconSymbol 
          name="chevron.right" 
          size={20} 
          color={secondaryText || '#999999'} 
        />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  receiptCard: {
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  receiptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  receiptInfo: {
    flex: 1,
  },
  receiptTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  receiptTotal: {
    fontSize: 18,
    fontWeight: '700',
  },
  receiptOrder: {
    fontSize: 11,
    marginTop: 2,
  },
  receiptTimeText: {
    fontSize: 12,
  },
});

