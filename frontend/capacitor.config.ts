import type { CapacitorConfig } from "@capacitor/cli";

const serverUrl = process.env.CAPACITOR_SERVER_URL;

const config: CapacitorConfig = {
  appId: "com.revorus.escrow",
  appName: "Revorus Escrow",
  webDir: "capacitor-shell",
  ...(serverUrl
    ? {
        server: {
          url: serverUrl,
          cleartext: serverUrl.startsWith("http://"),
          androidScheme: "https",
        },
      }
    : {}),
};

export default config;
