# Snap Receipt 📸

A modern mobile application for capturing, processing, and formatting receipts using OCR and AI technologies.

## Introduction

Snap Receipt is a React Native application built with Expo that simplifies receipt management for businesses. The app allows users to capture receipt photos using their device's camera, extract text using advanced OCR technology, and format receipts into clean, print-ready documents.

The app is designed to replace manual receipt entry processes, providing businesses with a fast and accurate way to digitize and format receipt information. It supports both quick text extraction and AI-powered formatting, making it suitable for various business needs.

## Project Objectives

### Primary Objectives

1. **Receipt Digitization**
   - Capture high-quality receipt images using device camera
   - Support both camera capture and gallery image selection
   - Extract text from receipt images using OCR technology

2. **Intelligent Text Processing**
   - Provide two OCR modes:
     - **Vision AI**: Fast text extraction using Google Cloud Vision API
     - **Generative AI**: AI-powered formatting with product modifiers and proper alignment
   - Automatically extract product quantities, names, and prices
   - Identify and format product modifiers (e.g., "no onions", "extra cheese")

3. **Receipt Formatting**
   - Format receipts with proper alignment (product names left, prices right)
   - Calculate GST (10% inclusive) and subtotal from total amount
   - Display quantities in "Nx" format (e.g., "2x Product Name")
   - Indent product modifiers for better readability

4. **Print-Ready Output**
   - Generate print-ready receipts in A5 format
   - Support proper margins and formatting for receipt printers
   - Include shop information, order numbers, and date/time stamps

5. **Order Management**
   - Generate unique order numbers starting from 100
   - Daily reset of order numbers
   - Persistent storage using Upstash Redis
   - Environment-based prefixing for multi-environment support

### Technical Objectives

- **Cross-Platform**: Built with React Native and Expo for iOS and Android support
- **Modern Architecture**: Uses Expo Router for file-based routing
- **Cloud Integration**: Integrates with Google Cloud Vision API and Google Generative AI
- **Scalable Backend**: Uses Upstash Redis for distributed order number management
- **User Experience**: Clean, intuitive UI with toggle between OCR modes

## Features

- 📸 Camera capture and gallery image selection
- 🔍 OCR text extraction with Google Cloud Vision API
- 🤖 AI-powered receipt formatting with Google Generative AI
- 📊 Automatic GST calculation (10% inclusive)
- 📄 Print-ready A5 receipt format
- 🔢 Daily-resetting order numbers with Redis
- 🎨 Clean, modern user interface
- ⚙️ Toggle between Vision AI and Generative AI modes

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.
