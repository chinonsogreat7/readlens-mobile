import { Platform } from 'react-native';

export const demoMode = process.env.EXPO_PUBLIC_DEMO_MODE === 'true';
export const apiConfig = {
  baseUrl: process.env.EXPO_PUBLIC_API_URL || 'https://dev.api.readlens.app/api/v1',
  username: process.env.EXPO_PUBLIC_BASIC_AUTH_USERNAME || '',
  password: process.env.EXPO_PUBLIC_BASIC_AUTH_PASSWORD || '',
};
export const liveConfigurationError =
  !demoMode &&
  (Platform.OS === 'web'
    ? 'Use the iOS or Android app to sign in securely. The browser is available for the sample-data preview only.'
    : !apiConfig.username || !apiConfig.password
      ? 'Add the supplied Basic Auth credentials to .env, then restart Expo to connect to Readlens.'
      : undefined);
