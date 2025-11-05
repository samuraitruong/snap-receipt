# App Icon Design Guide for Snap Receipt

## Icon Specifications

### iOS Icon
- **Size:** 1024x1024 pixels
- **Format:** PNG
- **Location:** `./assets/images/icon.png`
- **Requirements:**
  - No transparency (must have solid background)
  - Square format (will be automatically rounded by iOS)
  - No text or words
  - Simple, recognizable design

### Android Icon
- **Size:** 1024x1024 pixels (foreground)
- **Format:** PNG
- **Location:** `./assets/images/android-icon-foreground.png`
- **Background:** `./assets/images/android-icon-background.png`
- **Monochrome:** `./assets/images/android-icon-monochrome.png` (for themed icons)

## Design Concept

### Theme: Receipt + Camera
The icon should represent:
1. **Receipt** - The main purpose of the app
2. **Camera** - The capture functionality
3. **Modern/Professional** - Clean, trustworthy design

### Color Scheme
- **Primary Color:** #0A7EA4 (Ocean Blue - already used in app)
- **Background:** #FFFFFF (white) or gradient
- **Accent:** #E6F4FE (light blue) or complementary colors

### Design Ideas

#### Option 1: Receipt with Camera Icon
- A stylized receipt document with a camera icon overlay
- Clean, minimal design
- Blue gradient background

#### Option 2: Camera with Receipt Stripes
- Camera icon with receipt lines/pattern inside
- Modern, app-like aesthetic

#### Option 3: Receipt with Scan Lines
- Receipt paper with scan effect lines
- Represents OCR/digitization

#### Option 4: Receipt + Camera Combined
- Creative combination of receipt and camera elements
- Single, cohesive icon

## Design Recommendations

1. **Use vector graphics** (Illustrator, Figma, Sketch) and export to PNG
2. **Keep it simple** - recognizable at small sizes (32x32px)
3. **Avoid details** - too much detail gets lost at small sizes
4. **Test at different sizes** - ensure it looks good at 16x16, 32x32, 64x64, 128x128, 256x256, 512x512, 1024x1024
5. **Use high contrast** - ensure visibility on various backgrounds
6. **Follow platform guidelines:**
   - iOS: No rounded corners, no shadows, no effects
   - Android: Can use adaptive icon with layers

## Current Icon Status

The app currently uses placeholder icons. You need to:
1. Design a new icon following the specifications above
2. Replace `./assets/images/icon.png` with your 1024x1024 icon
3. Replace Android adaptive icon files if needed
4. Update splash screen icon if desired

## Tools for Icon Design

- **Figma** - Free, web-based, excellent for icon design
- **Adobe Illustrator** - Professional vector design
- **Sketch** - Mac-only, popular for app design
- **Canva** - Simpler option with templates
- **Icon generators** - Online tools like IconKitchen, AppIcon.co

## Quick Icon Generation

You can use online tools like:
- https://appicon.co - Generate all sizes from one icon
- https://icon.kitchen - Android adaptive icon generator
- https://www.appicon.build - iOS and Android icon generator

## Next Steps

1. Design your icon (1024x1024px)
2. Save as `./assets/images/icon.png`
3. Generate Android adaptive icons if needed
4. Test the icon by running the app
5. Update splash screen if desired




