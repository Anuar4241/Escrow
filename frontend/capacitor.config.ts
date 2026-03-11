import type { CapacitorConfig } from '@capacitor/cli';

const isProd = process.env.NODE_ENV === 'production';

const config: CapacitorConfig = {
  appId: 'com.revorus.escrow',
  appName: 'Revorus Escrow',
  webDir: 'out', // Fallback dir (required field)
  server: {
    // Dev: forwards to local Next.js server. Prod: set to your deployed URL.
    url: isProd ? 'https://revorus-escrow.vercel.app' : 'http://10.0.2.2:3000',
    cleartext: !isProd,
    androidScheme: 'https',
  },
};

export default config;
