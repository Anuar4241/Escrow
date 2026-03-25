import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.revorus.escrow',
  appName: 'Revorus Escrow',
  webDir: 'out',
  // Static assets are bundled in the APK — no remote server needed.
  // API calls from the JS code will target NEXT_PUBLIC_BACKEND_URL at build time.
};

export default config;
