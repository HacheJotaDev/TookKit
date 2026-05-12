import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.hjtoolsx.app',
  appName: 'HJTools X',
  webDir: 'out',
  bundledWebRuntime: false,
  server: {
    url: 'https://hjtoolsx.vercel.app',
    androidScheme: 'https',
    cleartext: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#0a0a0b',
      showSpinner: false,
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
    },
  },
  android: {
    allowMixedContent: true,
    backgroundColor: '#0a0a0b',
  },
};

export default config;
