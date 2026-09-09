import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { SessionStorage } from './session-manager';

const KEY = 'readlens.auth.v1';
const options = {
  keychainService: 'readlens.assessment.auth',
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export const secureSessionStorage: SessionStorage = {
  async read() {
    return Platform.OS === 'web' ? null : SecureStore.getItemAsync(KEY, options);
  },
  async write(value) {
    if (Platform.OS === 'web') throw new Error('Live authentication requires the mobile app.');
    await SecureStore.setItemAsync(KEY, value, options);
  },
  async remove() {
    if (Platform.OS !== 'web') await SecureStore.deleteItemAsync(KEY, options);
  },
};
