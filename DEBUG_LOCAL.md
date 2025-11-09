# Local Development Build Guide

## Quick Start for Android Debugging

Since `react-native-esc-pos-printer` is a native module, you **cannot use Expo Go**. You need a development build.

## Step-by-Step: Install Debug Build on Phone

### Method 1: Build and Install via USB (Easiest - Recommended)

1. **Connect your phone to your computer via USB**

2. **Enable USB Debugging on your phone**:
   - Go to Settings → About Phone
   - Tap "Build Number" 7 times to enable Developer Options
   - Go to Settings → Developer Options
   - Enable "USB Debugging"

3. **Verify your phone is connected**:
   ```bash
   adb devices
   ```
   You should see your device listed. If not, authorize the USB debugging prompt on your phone.

4. **Build and install directly to your phone**:
   ```bash
   npm run android
   # OR
   npx expo run:android
   ```
   This will:
   - Build the debug APK
   - Install it on your connected phone automatically
   - Start the Metro bundler

5. **Open the app on your phone** - it will automatically connect to Metro!

### Method 2: Build APK and Transfer Manually

1. **Build the debug APK**:
   ```bash
   npm run build:android:local
   ```

2. **Find the APK file**:
   - Location: `android/app/build/outputs/apk/debug/app-debug.apk`
   - Or check: `android/app/build/outputs/apk/` folder

3. **Transfer APK to your phone** (choose one method):
   
   **Option A: Via USB**
   - Copy `app-debug.apk` to your phone's Downloads folder
   - On your phone, open Files app → Downloads
   - Tap the APK file to install
   
   **Option B: Via Email/Cloud**
   - Email the APK to yourself
   - Download it on your phone
   - Tap to install
   
   **Option C: Via ADB (if USB connected)**
   ```bash
   adb install android/app/build/outputs/apk/debug/app-debug.apk
   ```

4. **Enable "Install from Unknown Sources"** (if needed):
   - Go to Settings → Security
   - Enable "Install from Unknown Sources" or "Install Unknown Apps"
   - Allow your file manager/email app to install apps
   - On newer Android: Settings → Apps → Special Access → Install Unknown Apps

5. **Install the APK**:
   - Tap the APK file on your phone
   - Tap "Install"
   - Wait for installation to complete

6. **Start the dev server**:
   ```bash
   npm start
   # OR
   npx expo start --dev-client
   ```

7. **Open the app on your phone** - it will automatically connect to Metro!

### Method 3: Using EAS Build (Cloud Build)

1. **Build development build in the cloud**:
   ```bash
   eas build --platform android --profile development
   ```

2. **Download the APK** from the EAS dashboard

3. **Install on your phone** (same as Method 2, step 3-5)

4. **Start dev server**:
   ```bash
   npx expo start --dev-client
   ```

5. **Open the app** - it will connect automatically!

## After Installation: Daily Debugging

Once the debug build is installed on your phone:

1. **Start Metro bundler**:
   ```bash
   npm start
   # OR
   npx expo start --dev-client
   ```

2. **Open the app on your phone** - it will automatically connect!

3. **For code changes**:
   - JavaScript/TypeScript: Just reload (shake device → "Reload" or press `r` in terminal)
   - Native changes: Rebuild with `npm run android`

## Troubleshooting

### "snapreceipt://expo-development-client" link doesn't work
- ✅ This is a **deep link**, not a QR code - you can't scan it
- ✅ You need to **install the debug APK first** (see methods above)
- ✅ After installation, the app will connect automatically when you open it
- ✅ The deep link is just for reference - ignore it

### App won't connect to Metro
- Make sure your phone and computer are on the **same WiFi network**
- Or use USB with port forwarding:
  ```bash
  adb reverse tcp:8081 tcp:8081
  ```
- Check Metro is running: `npm start` or `npx expo start --dev-client`

### Can't find the APK file
- Check: `android/app/build/outputs/apk/debug/app-debug.apk`
- If folder doesn't exist, run the build command first:
  ```bash
  npm run build:android:local
  ```

### "Install from Unknown Sources" not found
- On newer Android versions, it's per-app
- Go to Settings → Apps → Special Access → Install Unknown Apps
- Enable for your file manager/email app

### ADB not found
- Install Android SDK Platform Tools
- Or use Android Studio (includes ADB)
- Or use Method 2 (manual transfer) instead

## Speed Comparison

- **Expo Go**: ❌ Won't work (native modules not supported)
- **Debug Build**: ✅ Fast (~2-5 minutes first time, instant after)
- **Release Build**: ⚠️ Slow (~10-20 minutes, optimized)

For debugging, always use **debug builds**!

## Quick Reference

```bash
# Build and install via USB (easiest)
npm run android

# Build APK only (for manual install)
npm run build:android:local

# Start dev server (after app is installed)
npm start

# Check connected devices
adb devices

# Install APK via ADB
adb install android/app/build/outputs/apk/debug/app-debug.apk
```
