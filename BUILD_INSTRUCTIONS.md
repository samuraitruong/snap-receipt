# Building APK for Android Testing

## Prerequisites

1. **Expo Account**: You need a free Expo account
2. **EAS CLI**: Already installed globally
3. **Android Device**: For testing

## Step 1: Login to Expo

```bash
eas login
```

This will prompt you to login with your Expo account (create one at https://expo.dev if needed).

## Step 2: Build APK

### Option A: Build Preview APK (Recommended for Testing)

```bash
eas build --platform android --profile preview
```

This will:
- Build an APK file (not AAB)
- Allow you to install directly on your device
- Work without Google Play Store

### Option B: Build Production APK

```bash
eas build --platform android --profile production
```

## Step 3: Download the APK

After the build completes (usually 10-20 minutes):

1. You'll get a link to download the APK
2. Or visit https://expo.dev/accounts/[your-account]/projects/snap-receipt/builds
3. Download the APK file

## Step 4: Install on Android Device

### Method 1: Direct Download (Easiest)

1. Open the build link on your Android device
2. Tap "Download" on the APK file
3. Allow installation from unknown sources if prompted
4. Tap the downloaded APK to install

### Method 2: Transfer via USB/Email

1. Download the APK on your computer
2. Transfer to your Android device (USB, email, cloud storage)
3. On your Android device, open the file manager
4. Navigate to the APK file
5. Tap to install (you may need to enable "Install from Unknown Sources" in Settings)

### Method 3: Using ADB (Advanced)

```bash
adb install path/to/your-app.apk
```

## Quick Start Commands

```bash
# 1. Login (first time only)
eas login

# 2. Build APK
eas build --platform android --profile preview

# 3. Wait for build to complete (check terminal or expo.dev)

# 4. Download and install on device
```

## Troubleshooting

### Build Fails
- Make sure you're logged in: `eas login`
- Check that all required assets (icons) exist
- Verify app.json configuration

### APK Won't Install
- Enable "Install from Unknown Sources" in Android Settings
- Check that the APK is for the correct architecture (arm64-v8a is most common)
- Make sure you have enough storage space

### Need to Update APK
- Just run `eas build` again - it will create a new build
- The package name stays the same, so you can update directly

## Local Development Build (Alternative)

If you want to build locally without EAS:

```bash
# Install dependencies
npm install

# Start development server
npx expo start

# In another terminal, build APK (requires Android SDK)
npx expo run:android --variant release
```

Note: Local builds require Android Studio and Android SDK setup.

## Environment Variables

If you have API keys (GOOGLE_AI_KEY, etc.), you can set them in EAS Build:

```bash
eas build:configure
```

Then add environment variables in eas.json or through the EAS dashboard.

