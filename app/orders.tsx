import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import { getAvailableDates, getReceiptsByDate, initDatabase, type ReceiptRecord } from '@/utils/database';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Lazy require DateTimePicker to avoid dependency issues if not installed
let DateTimePicker: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  DateTimePicker = require('@react-native-community/datetimepicker').default;
} catch (e) {
  DateTimePicker = null;
}

export default function OrdersScreen() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [receipts, setReceipts] = useState<ReceiptRecord[]>([]);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerValue, setDatePickerValue] = useState(new Date());
  const insets = useSafeAreaInsets();

  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const borderColor = useThemeColor({ light: '#E5E5E5', dark: '#333333' }, 'text');
  const cardBackground = useThemeColor({ light: '#FFFFFF', dark: '#1C1C1E' }, 'background');
  const secondaryText = useThemeColor({ light: '#666666', dark: '#999999' }, 'text');
  const tintColor = useThemeColor({ light: '#007AFF', dark: '#0A84FF' }, 'tint');

  useEffect(() => {
    const load = async () => {
      try {
        await initDatabase();
        const dates = await getAvailableDates();
        setAvailableDates(dates);
        if (dates.length > 0 && !dates.includes(selectedDate)) {
          setSelectedDate(dates[0]);
        }
      } catch (e) {
        console.error('Error loading dates:', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    const loadReceipts = async () => {
      try {
        const data = await getReceiptsByDate(selectedDate);
        setReceipts(data);
      } catch (e) {
        console.error('Error loading receipts:', e);
        setReceipts([]);
      }
    };
    if (selectedDate) {
      loadReceipts();
    }
  }, [selectedDate]);

  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
  };

  const handleDatePickerChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowDatePicker(false);
    }
    if (event.type === 'set' && selectedDate) {
      const dateStr = selectedDate.toISOString().split('T')[0];
      setSelectedDate(dateStr);
      setDatePickerValue(selectedDate);
    } else if (Platform.OS === 'ios') {
      if (selectedDate) {
        const dateStr = selectedDate.toISOString().split('T')[0];
        setSelectedDate(dateStr);
        setDatePickerValue(selectedDate);
      }
    }
  };

  const openDatePicker = () => {
    setDatePickerValue(new Date(selectedDate));
    setShowDatePicker(true);
  };

  const handleReceiptPress = (receipt: ReceiptRecord) => {
    try {
      const data = JSON.parse(receipt.receipt_data);
      router.push({
        pathname: '/receipt',
        params: {
          imageUri: '',
          extractedText: encodeURIComponent(data.extractedText || ''),
          extractedDataType: data.isJson ? 'json' : 'text',
          orderNumber: receipt.order_number || '',
          isExistingReceipt: 'true',
        },
      });
    } catch (e) {
      Alert.alert('Error', 'Failed to load receipt data');
    }
  };

  const formatDate = (dateStr: string): string => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const formatTime = (dateStr: string): string => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const formatCompactDate = (dateStr: string): string => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  const getPreviousDate = (): string | null => {
    if (!selectedDate || availableDates.length === 0) return null;
    const currentIndex = availableDates.indexOf(selectedDate);
    if (currentIndex > 0) {
      return availableDates[currentIndex - 1];
    }
    return null;
  };

  const getNextDate = (): string | null => {
    if (!selectedDate || availableDates.length === 0) return null;
    const currentIndex = availableDates.indexOf(selectedDate);
    if (currentIndex < availableDates.length - 1) {
      return availableDates[currentIndex + 1];
    }
    return null;
  };

  const handlePreviousDate = () => {
    const prevDate = getPreviousDate();
    if (prevDate) {
      setSelectedDate(prevDate);
    }
  };

  const handleNextDate = () => {
    const nextDate = getNextDate();
    if (nextDate) {
      setSelectedDate(nextDate);
    }
  };

  const totalNetSales = receipts.reduce((sum, receipt) => sum + receipt.total_price, 0);

  return (
    <ThemedView style={styles.container}>
      <View style={[
        styles.header, 
        { 
          backgroundColor, 
          borderBottomColor: borderColor,
          paddingTop: Platform.OS === 'android' ? Math.max(insets.top, 16) : 60,
        }
      ]}>
        <TouchableOpacity 
          onPress={() => router.back()} 
          style={[styles.backButton, { backgroundColor: tintColor + '20' }]}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <IconSymbol name="chevron.left" size={24} color={tintColor} />
        </TouchableOpacity>
        <ThemedText type="title" style={styles.title}>Orders</ThemedText>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
        {/* Compact Date Selector */}
        <View style={[styles.dateSelector, { backgroundColor: cardBackground, borderColor }]}>
          <TouchableOpacity
            onPress={handlePreviousDate}
            disabled={!getPreviousDate()}
            style={[
              styles.navButton,
              { backgroundColor: tintColor + '15' },
              !getPreviousDate() && styles.navButtonDisabled
            ]}
          >
            <IconSymbol 
              name="chevron.left" 
              size={18} 
              color={getPreviousDate() ? tintColor : secondaryText} 
            />
          </TouchableOpacity>
          
          <TouchableOpacity 
            onPress={openDatePicker}
            style={styles.dateDisplay}
            activeOpacity={0.7}
          >
            <ThemedText style={styles.dateDisplayText}>{formatCompactDate(selectedDate)}</ThemedText>
            <IconSymbol name="calendar" size={16} color={tintColor} />
          </TouchableOpacity>
          
          <TouchableOpacity
            onPress={handleNextDate}
            disabled={!getNextDate()}
            style={[
              styles.navButton,
              { backgroundColor: tintColor + '15' },
              !getNextDate() && styles.navButtonDisabled
            ]}
          >
            <IconSymbol 
              name="chevron.right" 
              size={18} 
              color={getNextDate() ? tintColor : secondaryText} 
            />
          </TouchableOpacity>
        </View>

        {showDatePicker && DateTimePicker && (
          <DateTimePicker
            value={datePickerValue}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleDatePickerChange}
            maximumDate={new Date()}
          />
        )}

        {/* Total Net Sales */}
        {receipts.length > 0 && (
          <View style={[styles.statsCard, { backgroundColor: cardBackground, borderColor }]}>
            <View style={styles.statsRow}>
              <ThemedText style={styles.statsLabel}>Total Net Sales</ThemedText>
              <ThemedText style={[styles.statsValue, { color: tintColor }]}>
                ${totalNetSales.toFixed(2)}
              </ThemedText>
            </View>
            <ThemedText style={[styles.statsSubtext, { color: secondaryText }]}>
              {receipts.length} {receipts.length === 1 ? 'order' : 'orders'}
            </ThemedText>
          </View>
        )}

        {/* Receipts List */}
        {loading ? (
          <ThemedText style={styles.emptyText}>Loading...</ThemedText>
        ) : receipts.length === 0 ? (
          <ThemedText style={styles.emptyText}>No receipts found for this date</ThemedText>
        ) : (
          <View style={styles.receiptsList}>
            {receipts.map((receipt) => (
              <TouchableOpacity
                key={receipt.id}
                onPress={() => handleReceiptPress(receipt)}
                style={[styles.receiptCard, { backgroundColor: cardBackground, borderColor }]}
              >
                <View style={styles.receiptHeader}>
                  <View style={styles.receiptInfo}>
                    <ThemedText style={styles.receiptTotal}>${receipt.total_price.toFixed(2)}</ThemedText>
                    {receipt.order_number && (
                      <ThemedText style={[styles.receiptOrder, { color: secondaryText }]}>
                        Order #{receipt.order_number}
                      </ThemedText>
                    )}
                  </View>
                  <View style={styles.receiptTime}>
                    {receipt.created_at && (
                      <ThemedText style={[styles.receiptTimeText, { color: secondaryText }]}>
                        {formatTime(receipt.created_at)}
                      </ThemedText>
                    )}
                    <IconSymbol name="chevron.right" size={20} color={secondaryText} />
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
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
    paddingVertical: 12,
    borderBottomWidth: 1,
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    gap: 16,
  },
  dateSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    gap: 12,
  },
  navButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navButtonDisabled: {
    opacity: 0.4,
  },
  dateDisplay: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  dateDisplayText: {
    fontSize: 15,
    fontWeight: '600',
  },
  statsCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  statsLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  statsValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  statsSubtext: {
    fontSize: 12,
    marginTop: 2,
  },
  receiptsList: {
    gap: 12,
  },
  receiptCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  receiptHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  receiptInfo: {
    flex: 1,
  },
  receiptTotal: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  receiptOrder: {
    fontSize: 12,
  },
  receiptTime: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  receiptTimeText: {
    fontSize: 12,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 40,
    opacity: 0.6,
  },
});

