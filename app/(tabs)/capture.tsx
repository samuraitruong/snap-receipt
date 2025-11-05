import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { extractTextFromImageWithMode } from '@/utils/ocr';
import { getCurrentOrderNumber, getNextOrderNumber } from '@/utils/orderNumber';
import { getOCRMode } from '@/utils/settings';
import { CameraType, CameraView, useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, StyleSheet, TouchableOpacity, View } from 'react-native';

const { width, height } = Dimensions.get('window');

export default function CaptureScreen() {
  const [facing, setFacing] = useState<CameraType>('back');
  const [permission, requestPermission] = useCameraPermissions();
  const [image, setImage] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [currentOrderNumber, setCurrentOrderNumber] = useState<number | null>(null);
  const [zoom, setZoom] = useState(0);
  const cameraRef = useRef<CameraView>(null);

  // Load current order number on mount
  useEffect(() => {
    const loadCurrentOrderNumber = async () => {
      try {
        const orderNum = await getCurrentOrderNumber();
        setCurrentOrderNumber(orderNum);
      } catch (error) {
        console.error('Error loading current order number:', error);
      }
    };
    loadCurrentOrderNumber();
  }, []);

  if (!permission) {
    return <View />;
  }

  if (!permission.granted) {
    return (
      <ThemedView style={styles.permissionContainer}>
        <View style={styles.permissionContent}>
          <IconSymbol name="camera.fill" size={80} color="#0a7ea4" />
          <ThemedText type="title" style={styles.permissionTitle}>
            Camera Access Needed
          </ThemedText>
          <ThemedText style={styles.permissionMessage}>
            We need your permission to use the camera to capture receipts
          </ThemedText>
          <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
            <ThemedText style={styles.permissionButtonText}>Grant Permission</ThemedText>
          </TouchableOpacity>
        </View>
      </ThemedView>
    );
  }

  const clampZoom = (z: number) => Math.max(0, Math.min(1, z));
  const increaseZoom = () => setZoom(prev => clampZoom(prev + 0.1));
  const decreaseZoom = () => setZoom(prev => clampZoom(prev - 0.1));

  const takePicture = async () => {
    if (cameraRef.current) {
      try {
        // Request base64 directly from camera to avoid file reading issues
        const photo = await cameraRef.current.takePictureAsync({
          base64: true,
          quality: 0.9,
        });
        if (photo) {
          // If we have base64, use it directly; otherwise use URI
          if (photo.base64) {
            processImageWithBase64(photo.base64);
          } else {
            processImage(photo.uri);
          }
        }
      } catch (error) {
        Alert.alert('Error', 'Failed to take picture');
        console.error(error);
      }
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant permission to access your photos');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 1,
      base64: true, // Request base64 directly to avoid file reading issues
    });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      // If we have base64, use it directly; otherwise use URI
      if (asset.base64) {
        processImageWithBase64(asset.base64, asset.uri);
      } else {
        processImage(asset.uri);
      }
    }
  };


  const processImageWithBase64 = async (base64Image: string, imageUri?: string) => {
    setProcessing(true);
    setImage(imageUri || null);

    try {
      console.log('Processing image with base64, length:', base64Image.length);

      // Get the current OCR mode preference
      const ocrMode = await getOCRMode();
      console.log('Using OCR mode:', ocrMode);

      // Extract text using the selected OCR mode
      const extractedData = await extractTextFromImageWithMode(base64Image, ocrMode);

          // Get the next order number for this receipt
          const orderNumber = await getNextOrderNumber();
          
          // Update the current order number display
          setCurrentOrderNumber(orderNumber);

          // Navigate to receipt view with extracted data
          // For generative mode, pass JSON string; for vision mode, pass text string
          const extractedDataString = typeof extractedData === 'string' 
            ? extractedData 
            : JSON.stringify(extractedData);
          
          router.push({
            pathname: '/receipt',
            params: {
              imageUri: imageUri ? encodeURIComponent(imageUri) : '',
              extractedText: encodeURIComponent(extractedDataString || 'No text extracted'),
              extractedDataType: ocrMode === 'generative' ? 'json' : 'text',
              orderNumber: orderNumber.toString(),
            },
          });
    } catch (error: any) {
      console.error('OCR Error:', error);
      const errorMessage = error?.message || 'Failed to process image';
      Alert.alert('Error', errorMessage);
      
      // Get order number even if OCR fails
      const orderNumber = await getNextOrderNumber();
      
      // Update the current order number display
      setCurrentOrderNumber(orderNumber);
      
      // Still navigate to receipt view even if OCR fails
      router.push({
        pathname: '/receipt',
        params: { 
          imageUri: imageUri ? encodeURIComponent(imageUri) : '',
          extractedText: encodeURIComponent('Failed to extract text: ' + errorMessage),
          orderNumber: orderNumber.toString(),
        },
      });
    } finally {
      setProcessing(false);
    }
  };

  const processImage = async (imageUri: string) => {
    setProcessing(true);
    setImage(imageUri);

    try {
      // Convert image to base64 for OCR processing
      let base64Image = '';
      
      console.log('Processing image URI:', imageUri);
      
      // Check if it's already a data URI
      if (imageUri.startsWith('data:image')) {
        const base64Match = imageUri.match(/^data:image\/\w+;base64,(.+)$/);
        base64Image = base64Match ? base64Match[1] : '';
      } else {
        // Try to read the file using FileSystem
        try {
          // Check if file exists first
          const fileInfo = await FileSystem.getInfoAsync(imageUri);
          if (!fileInfo.exists) {
            throw new Error('Image file does not exist at: ' + imageUri);
          }
          
          // Read as base64
          const base64 = await FileSystem.readAsStringAsync(imageUri, {
            encoding: 'base64',
          });
          base64Image = base64;
        } catch (fileError: any) {
          console.error('File read error:', fileError);
          
          // On iOS, sometimes the URI needs to be handled differently
          // Try without file:// prefix if it exists
          if (imageUri.startsWith('file://')) {
            try {
              const normalizedUri = imageUri.replace('file://', '');
              const fileInfo = await FileSystem.getInfoAsync(normalizedUri);
              if (fileInfo.exists) {
                const base64 = await FileSystem.readAsStringAsync(normalizedUri, {
                  encoding: 'base64',
                });
                base64Image = base64;
              } else {
                throw new Error('Image file does not exist');
              }
            } catch (normalizedError) {
              throw new Error('Could not read image file. Please try taking the picture again.');
            }
          } else {
            throw new Error('Could not read image file. Please try again.');
          }
        }
      }

      if (!base64Image) {
        throw new Error('Could not convert image to base64');
      }

      console.log('Image converted to base64, length:', base64Image.length);

      // Use the base64 processing function
      await processImageWithBase64(base64Image, imageUri);
    } catch (error: any) {
      console.error('Image processing error:', error);
      const errorMessage = error?.message || 'Failed to process image';
      Alert.alert('Error', errorMessage);
      
      // Get order number even if processing fails
      const orderNumber = await getNextOrderNumber();
      
      // Still navigate to receipt view even if processing fails
      router.push({
        pathname: '/receipt',
        params: { 
          imageUri: encodeURIComponent(imageUri), 
          extractedText: encodeURIComponent('Failed to process image: ' + errorMessage),
          orderNumber: orderNumber.toString(),
        },
      });
      setProcessing(false);
    }
  };

  const toggleCameraFacing = () => {
    setFacing(current => (current === 'back' ? 'front' : 'back'));
  };

  return (
    <ThemedView style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={facing}
        mode="picture"
        zoom={zoom}
      >
        <View style={styles.overlay}>
          {/* Scan Frame at Top */}
          <View style={styles.scanFrameContainer}>
            <View style={styles.scanFrame}>
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />
            </View>
          </View>

          {/* Bottom Controls */}
          <View style={styles.bottomControls}>
            <View style={styles.controlRow}>
              {/* Gallery Button - Smaller */}
              <TouchableOpacity 
                style={[styles.actionButton, styles.galleryButton, styles.smallButton]} 
                onPress={pickImage}
                activeOpacity={0.8}
              >
                <IconSymbol name="photo.fill" size={20} color="#fff" />
              </TouchableOpacity>

              {/* Capture Button - Bigger */}
              <View style={styles.captureButtonWrapper}>
                <TouchableOpacity 
                  style={[styles.captureButtonContainer, processing && styles.captureButtonDisabled]} 
                  onPress={takePicture}
                  disabled={processing}
                  activeOpacity={0.8}
                >
                  <View style={styles.captureButton}>
                    {processing ? (
                      <ActivityIndicator color="#fff" size="large" />
                    ) : (
                      <View style={styles.captureButtonInner}>
                        <View style={styles.captureButtonPulse} />
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
                {currentOrderNumber !== null && (
                  <ThemedText style={styles.orderNumberLabel}>
                    Order #{currentOrderNumber}
                  </ThemedText>
                )}
              </View>

              {/* Flip Button - Smaller */}
              <View style={styles.rightButtons}>
                <TouchableOpacity 
                  style={[styles.actionButton, styles.flipButton, styles.smallButton]} 
                  onPress={toggleCameraFacing}
                  activeOpacity={0.8}
                >
                  <IconSymbol name="arrow.triangle.2.circlepath.camera.fill" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Vertical Zoom Controls - compact, on right side */}
          <View style={styles.zoomVertical}>
            <TouchableOpacity 
              style={[styles.actionButton, styles.zoomButton, styles.zoomMiniButton]} 
              onPress={increaseZoom}
              activeOpacity={0.8}
            >
              <IconSymbol name="plus.magnifyingglass" size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.actionButton, styles.zoomButton, styles.zoomMiniButton]} 
              onPress={decreaseZoom}
              activeOpacity={0.8}
            >
              <IconSymbol name="minus.magnifyingglass" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </CameraView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  permissionContent: {
    alignItems: 'center',
    maxWidth: 400,
  },
  permissionTitle: {
    marginTop: 24,
    marginBottom: 12,
    fontSize: 24,
    fontWeight: 'bold',
  },
  permissionMessage: {
    textAlign: 'center',
    fontSize: 16,
    marginBottom: 32,
    opacity: 0.7,
  },
  permissionButton: {
    backgroundColor: '#0a7ea4',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
    minWidth: 200,
    alignItems: 'center',
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  scanFrameContainer: {
    position: 'absolute',
    top: height * 0.1,
    left: width * 0.075,
    right: width * 0.075,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanFrame: {
    width: width * 0.85,
    height: height * 0.55,
    position: 'relative',
    borderWidth: 2,
    borderColor: 'rgba(10, 126, 164, 0.6)',
    borderRadius: 16,
    backgroundColor: 'rgba(10, 126, 164, 0.1)',
  },
  corner: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderColor: '#0a7ea4',
  },
  topLeft: {
    top: -2,
    left: -2,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 16,
  },
  topRight: {
    top: -2,
    right: -2,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 16,
  },
  bottomLeft: {
    bottom: -2,
    left: -2,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 16,
  },
  bottomRight: {
    bottom: -2,
    right: -2,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 16,
  },
  bottomControls: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: 20,
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: 'transparent',
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  actionButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 50,
    width: 56,
    height: 56,
  },
  smallButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  galleryButton: {
    backgroundColor: '#FF6B6B',
    shadowColor: '#FF6B6B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  flipButton: {
    backgroundColor: '#4ECDC4',
    shadowColor: '#4ECDC4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  rightButtons: {
    alignItems: 'center',
    gap: 8,
  },
  zoomVertical: {
    position: 'absolute',
    right: 20,
    bottom: 120,
    gap: 10,
    alignItems: 'center',
  },
  zoomButton: {
    backgroundColor: '#0a7ea4',
    shadowColor: '#0a7ea4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  zoomMiniButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
      captureButtonWrapper: {
        alignItems: 'center',
        marginHorizontal: 16,
      },
      captureButtonContainer: {
        alignItems: 'center',
      },
      orderNumberLabel: {
        marginTop: 8,
        fontSize: 12,
        fontWeight: '600',
        color: '#fff',
        textShadowColor: 'rgba(0, 0, 0, 0.3)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
      },
  captureButton: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#0a7ea4',
    borderWidth: 6,
    borderColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0a7ea4',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
  },
  captureButtonDisabled: {
    opacity: 0.6,
  },
  captureButtonInner: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonPulse: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#0a7ea4',
  },
  message: {
    textAlign: 'center',
    paddingBottom: 10,
  },
});

