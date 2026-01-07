# Apkifyit 🚀

**Apkifyit** is a professional, high-performance tool designed for converting ZIP files into signed and aligned APKs. Built with a focus on privacy and security, all processing is handled locally within the environment.

🔗 **Live Demo:** [https://curvy-taxis-say.lindy.site](https://curvy-taxis-say.lindy.site)

## ✨ Features

- **Batch Conversion**: Upload and process multiple ZIP files simultaneously.
- **Keystore Manager**: Save and load custom signing profiles (Keystore file, Alias, Passwords) locally in your browser.
- **APK Optimization**: Built-in **Zipalign** support to reduce RAM usage on Android devices.
- **Signature Verification**: Automatically extracts and displays the **SHA-256 hash** of the generated APK.
- **Modern UI**: Clean, "calm and competent" interface with smooth animations and Light/Dark mode support.
- **Drag-and-Drop**: Intuitive file handling with a full-screen drop overlay.

## 🔒 Strictly Offline & Private

Apkifyit is designed to be **completely self-contained**:
1. **No External APIs**: Conversion is done entirely on the server using local binaries. Your files are never sent to third-party cloud services.
2. **Auto-Cleanup**: Original ZIPs and generated APKs are deleted from the server's temporary storage immediately after conversion.
3. **Local Execution**: The app can be run on a physical machine with zero internet connection.

## 🛠 Local Setup (Strictly Offline)

To run Apkifyit on your own machine:

### Prerequisites
- **Node.js**: Version 18 or higher.
- **Java (JDK)**: Version 11 or higher (required for APK signing).
- **uber-apk-signer**: The project expects `uber-apk-signer.jar` to be available at the path specified in `app/api/convert/route.ts`.

### Installation
1. Clone the repository:
   ```bash
   git clone <your-repo-url>
   cd apkifyit-app
   ```

2. Install dependencies:
   ```bash
   npm install
   # or
   bun install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## 🚀 Deployment

### Vercel
1. Push the code to a private GitHub repository.
2. Connect the repository to Vercel.
3. **Note**: Ensure the deployment environment has Java installed. You may need to use a custom build image or include the `uber-apk-signer.jar` and a portable JRE in your repository.

## 🛠 Tech Stack
- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS + shadcn/ui
- **Animations**: Framer Motion
- **Backend**: Node.js + uber-apk-signer
- **Icons**: Lucide React

---
Built with ❤️ for developers who value privacy and efficiency.
