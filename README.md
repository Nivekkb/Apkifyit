# DroidForge Studio 🚀

**DroidForge Studio** is a professional, high-performance platform for turning DroidForge Studio bundles into signed and aligned APKs. It can compile source bundles into APKs (including WebView-based apps) when the Android SDK + Gradle are installed. Built with a focus on privacy and security, all processing is handled locally within the environment.

🔗 **WEB UI Preview ** [https://curvy-taxis-say.lindy.site](https://curvy-taxis-say.lindy.site)

## ✨ Features

- **Batch Conversion**: Upload and process multiple ZIP files simultaneously.
- **Keystore Manager**: Save and load custom signing profiles (Keystore file, Alias, Passwords) locally in your browser.
- **APK Optimization**: Built-in **Zipalign** support to reduce RAM usage on Android devices.
- **Signature Verification**: Automatically extracts and displays the **SHA-256 hash** of the generated APK.
- **Modern UI**: Clean, "calm and competent" interface with smooth animations and Light/Dark mode support.
- **Drag-and-Drop**: Intuitive file handling with a full-screen drop overlay.
- **WebView Bundles**: If your ZIP includes `web/index.html`, it will be bundled into the APK and loaded at runtime.
- **Unified Studio**: The Studio UI now lives at `/` and the Build Engine UI at `/build`.

## 🔒 No keys ever leave local
**Setup for zipaign does require temporary connection with api**

DroidForge Studio is designed to be **completely self-contained**:

1. **No External APIs**: Conversions run locally using bundled or system binaries.
Noothing is uploaded, nothing leaves your mahcine.

2. **Temporary Storage**: FIles are only written to temporary directories during processing and are immediately
removed after completion.

3. **Works Offline**: The app can be run on a physical machine with zero internet connection.

## 🛠 Local Setup (Strictly Offline)

To run DroidForge Studio on your own machine:

## 🔧 Environment Variables
- `APKSIGNER_JAR` (preferred): Absolute path to `uber-apk-signer.jar`.
- `APK_SIGNER_JAR` (fallback): Alternative variable name supported by the server.

### Prerequisites
- **Node.js**: Version 18 or higher.
- **Java (JDK)**: Version 17 or higher (required for Gradle compile + APK signing).
- **uber-apk-signer**: Set the JAR path via `APKSIGNER_JAR` (preferred) or `APK_SIGNER_JAR`, or place `uber-apk-signer.jar` one level above the repo root.
- **Android SDK + Gradle (for bundle compilation)**: Set `ANDROID_HOME` or `ANDROID_SDK_ROOT`, and ensure `gradle` is on `PATH` (or set `GRADLE_HOME` / `GRADLE_CMD`).

### Installation
1. Clone the repository:
   ```bash
   git clone <github.com/Nivekkb/apkifiyitl>
   cd "DroidForge Studio"
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   bun install
   ```

3. Start the development server:
   ```bash
   # optional: set once in .env.local
   # APKSIGNER_JAR=/absolute/path/to/uber-apk-signer.jar
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🚀 Deployment

### Vercel
1. Push the code to a private GitHub repository.
2. Connect the repository to Vercel.
3. **Note**: Ensure the deployment environment has Java installed. For bundle compilation, also provide Android SDK + Gradle in the runtime image.

## 🛠 Tech Stack
- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS + shadcn/ui
- **Animations**: Framer Motion
- **Backend**: Node.js + uber-apk-signer + Gradle (optional)
- **Icons**: Lucide React

---
Built with ❤️ for developers who value privacy and efficiency.
