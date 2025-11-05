import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getOCRMode, OCRMode, setOCRMode } from '@/utils/settings';
import { useEffect, useState } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const [ocrMode, setOcrMode] = useState<OCRMode>('vision');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadOCRMode();
  }, []);

  const loadOCRMode = async () => {
    try {
      const mode = await getOCRMode();
      setOcrMode(mode);
    } catch (error) {
      console.error('Error loading OCR mode:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleModeChange = async (value: boolean) => {
    const newMode: OCRMode = value ? 'generative' : 'vision';
    setOcrMode(newMode);
    await setOCRMode(newMode);
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <IconSymbol 
            name="doc.text.fill" 
            size={80} 
            color={Colors[colorScheme ?? 'light'].tint} 
          />
        </View>
        
        <ThemedText type="title" style={styles.title}>
          Snap Receipt
        </ThemedText>
        
        <ThemedText style={styles.description}>
          Capture receipts and extract text automatically
        </ThemedText>
        
        <View style={styles.settingsContainer}>
          <ThemedText type="subtitle" style={styles.settingsTitle}>
            OCR Mode
          </ThemedText>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <IconSymbol 
                name={ocrMode === 'vision' ? 'text.viewfinder' : 'sparkles'} 
                size={20} 
                color={Colors[colorScheme ?? 'light'].tint} 
              />
              <View style={styles.settingText}>
                <ThemedText style={styles.settingLabel}>
                  {ocrMode === 'vision' ? 'Vision AI' : 'Generative AI'}
                </ThemedText>
                <ThemedText style={styles.settingDescription}>
                  {ocrMode === 'vision' 
                    ? 'Fast text extraction using Vision API'
                    : 'AI-powered formatting with product modifiers'}
                </ThemedText>
              </View>
            </View>
            <Switch
              value={ocrMode === 'generative'}
              onValueChange={handleModeChange}
              trackColor={{ false: '#767577', true: Colors[colorScheme ?? 'light'].tint }}
              thumbColor={ocrMode === 'generative' ? '#fff' : '#f4f3f4'}
            />
          </View>
        </View>

        <View style={styles.instructions}>
          <ThemedText type="subtitle" style={styles.instructionsTitle}>
            How to use:
          </ThemedText>
          <View style={styles.step}>
            <IconSymbol name="camera.fill" size={24} color={Colors[colorScheme ?? 'light'].tint} />
            <ThemedText style={styles.stepText}>
              Go to the Capture tab to take a photo of your receipt
            </ThemedText>
          </View>
          <View style={styles.step}>
            <IconSymbol name="text.viewfinder" size={24} color={Colors[colorScheme ?? 'light'].tint} />
            <ThemedText style={styles.stepText}>
              The app will extract text using {ocrMode === 'vision' ? 'Vision AI' : 'Generative AI'}
            </ThemedText>
          </View>
          <View style={styles.step}>
            <IconSymbol name="doc.text.fill" size={24} color={Colors[colorScheme ?? 'light'].tint} />
            <ThemedText style={styles.stepText}>
              View your receipt in a formatted display
            </ThemedText>
          </View>
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  iconContainer: {
    marginBottom: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 40,
    opacity: 0.7,
  },
  instructions: {
    width: '100%',
    maxWidth: 400,
    gap: 16,
  },
  instructionsTitle: {
    marginBottom: 8,
    fontSize: 20,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  stepText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  settingsContainer: {
    width: '100%',
    maxWidth: 400,
    marginBottom: 32,
    padding: 16,
    backgroundColor: 'rgba(10, 126, 164, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(10, 126, 164, 0.2)',
  },
  settingsTitle: {
    marginBottom: 12,
    fontSize: 18,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginRight: 12,
  },
  settingText: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 12,
    opacity: 0.7,
  },
});
