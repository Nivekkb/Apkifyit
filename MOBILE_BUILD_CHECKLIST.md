# DroidForge Studio Mobile Build Checklist (Android)

## 1) Build the web bundle
- Use a static export or build output that matches your Capacitor config.
- Current config: `webDir: "out"`.

Commands (choose one):
- If you use Next export: `npm run build && npm run export`
- If you choose static output later: ensure it writes to `out/`

## 2) Sync howCapacitor
- `npx cap sync android`

## 3) Open Android Studio
- `npx cap open android`

## 4) Configure signing
- In Android Studio: Build > Generate Signed Bundle / APK
- Use your keystore from DroidForge Studio if desired.

## 5) Test on device
- Run on emulator or USB device
- Verify: login, preview, build queue, downloads

## 6) Release checklist
- Version bump in `android/app/build.gradle`
- Update app icon / splash
- Verify permissions and network access
- Test crash-free session

---

Notes:
- WebContainer preview is experimental in WebView; verify performance.
- Avoid Cordova-only plugins. Prefer official Capacitor plugins.
