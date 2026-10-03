import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Android packaging. The built `dist` directory is bundled into the APK, so the
 * installed application does not need a development server. Only public
 * configuration is present here; no privileged credential is bundled.
 */
const config: CapacitorConfig = {
  appId: 'in.sutra.demo',
  appName: 'Sutra',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  },
  server: {
    androidScheme: 'https',
    // No `url` is set: the application loads bundled assets.
  },
  plugins: {
    Camera: {
      // Camera permission text is declared in the Android manifest.
      presentationStyle: 'fullscreen',
    },
  },
};

export default config;
