import { OrderItem } from '@/components/order-item';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getRecentReceipts, getTodayReceipts, initDatabase, type ReceiptRecord } from '@/utils/database';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Platform, ScrollView, StyleSheet, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [todayReceipts, setTodayReceipts] = useState<ReceiptRecord[]>([]);
  const [recentReceipts, setRecentReceipts] = useState<ReceiptRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const loadTodayReceipts = async () => {
    try {
      setLoading(true);
      await initDatabase();
      const today = await getTodayReceipts(5);
      setTodayReceipts(today);
      
      // If no orders for today, load recent orders from any date
      if (today.length === 0) {
        const recent = await getRecentReceipts(5);
        setRecentReceipts(recent);
      } else {
        setRecentReceipts([]);
      }
    } catch (error) {
      console.error('Error loading receipts:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load receipts when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadTodayReceipts();
    }, [])
  );

  return (
    <ThemedView style={styles.container}>
      <ScrollView 
        contentContainerStyle={[
          styles.content,
          { paddingTop: Platform.OS === 'ios' ? Math.max(insets.top + 8, 24) : 24 }
        ]}
      >
        <View style={styles.header}>
          <ThemedText type="title" style={styles.title}>
            Today's Orders
          </ThemedText>
          {todayReceipts.length > 0 && (
            <TouchableOpacity onPress={() => router.push('/orders')}>
              <ThemedText style={[styles.viewAllText, { color: Colors[colorScheme ?? 'light'].tint }]}>
                View All
              </ThemedText>
            </TouchableOpacity>
          )}
        </View>

        {loading ? (
          <View style={styles.emptyContainer}>
            <ThemedText style={styles.emptyText}>Loading orders...</ThemedText>
          </View>
        ) : todayReceipts.length > 0 ? (
          <View style={styles.ordersList}>
            {todayReceipts.map((receipt) => (
              <OrderItem
                key={receipt.id}
                receipt={receipt}
                onPress={(receipt) => {
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
                    console.error('Error opening receipt:', e);
                  }
                }}
                cardBackground="rgba(10, 126, 164, 0.1)"
                borderColor="rgba(10, 126, 164, 0.2)"
                secondaryText={Colors[colorScheme ?? 'light'].text}
              />
            ))}
          </View>
        ) : (
          <>
            {/* No orders banner */}
            <View style={[styles.noOrdersBanner, { backgroundColor: Colors[colorScheme ?? 'light'].tint + '15', borderColor: Colors[colorScheme ?? 'light'].tint + '30' }]}>
              <IconSymbol 
                name="doc.text.fill" 
                size={24} 
                color={Colors[colorScheme ?? 'light'].tint} 
              />
              <ThemedText style={[styles.noOrdersText, { color: Colors[colorScheme ?? 'light'].tint }]}>
                No orders found for today
              </ThemedText>
            </View>

            {/* Recent orders section */}
            {recentReceipts.length > 0 ? (
              <View style={styles.recentSection}>
                <View style={styles.recentHeader}>
                  <ThemedText type="subtitle" style={styles.recentTitle}>
                    Recent Orders
                  </ThemedText>
                  <TouchableOpacity onPress={() => router.push('/orders')}>
                    <ThemedText style={[styles.viewAllText, { color: Colors[colorScheme ?? 'light'].tint }]}>
                      View All
                    </ThemedText>
                  </TouchableOpacity>
                </View>
                <View style={styles.ordersList}>
                  {recentReceipts.map((receipt) => (
                    <OrderItem
                      key={receipt.id}
                      receipt={receipt}
                      onPress={(receipt) => {
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
                          console.error('Error opening receipt:', e);
                        }
                      }}
                      cardBackground="rgba(10, 126, 164, 0.1)"
                      borderColor="rgba(10, 126, 164, 0.2)"
                      secondaryText={Colors[colorScheme ?? 'light'].text}
                    />
                  ))}
                </View>
              </View>
            ) : (
              <View style={styles.emptyContainer}>
                <IconSymbol 
                  name="doc.text.fill" 
                  size={64} 
                  color={Colors[colorScheme ?? 'light'].tint} 
                />
                <ThemedText style={styles.emptyTitle}>No orders found</ThemedText>
                <ThemedText style={styles.emptyMessage}>
                  Scan your first receipt to get started
                </ThemedText>
                <TouchableOpacity 
                  style={[styles.scanButton, { backgroundColor: Colors[colorScheme ?? 'light'].tint }]}
                  onPress={() => router.push('/(tabs)/capture')}
                >
                  <IconSymbol name="camera.fill" size={20} color="#fff" />
                  <ThemedText style={styles.scanButtonText}>Scan Order Now</ThemedText>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '600',
  },
  ordersList: {
    gap: 12,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 24,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyMessage: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.7,
    marginBottom: 32,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.6,
  },
  scanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  scanButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  noOrdersBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  noOrdersText: {
    fontSize: 16,
    fontWeight: '600',
  },
  recentSection: {
    gap: 12,
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  recentTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
});
