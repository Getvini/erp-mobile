import * as Device from 'expo-device';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const DEVICE_ID_KEY = 'erp_device_unique_id';

let cachedDeviceId: string | null = null;
let pendingDeviceIdPromise: Promise<string> | null = null;

/**
 * Lấy hoặc tạo mới UUID duy nhất đại diện cho phần cứng thiết bị này.
 * Lưu trữ an toàn trong SecureStore để giữ nguyên qua các lần mở app.
 */
export const getOrCreateDeviceId = async (): Promise<string> => {
  if (cachedDeviceId) return cachedDeviceId;
  if (pendingDeviceIdPromise) return pendingDeviceIdPromise;

  pendingDeviceIdPromise = (async () => {
    try {
      let deviceId = await SecureStore.getItemAsync(DEVICE_ID_KEY);
      if (!deviceId) {
        deviceId = `${Platform.OS}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        await SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId);
      }
      cachedDeviceId = deviceId;
      return deviceId;
    } catch (error) {
      const fallbackId = `${Platform.OS}-fallback-${Date.now()}`;
      cachedDeviceId = fallbackId;
      return fallbackId;
    } finally {
      pendingDeviceIdPromise = null;
    }
  })();

  return pendingDeviceIdPromise;
};

/**
 * Tên hiển thị thân thiện của thiết bị (vd: "Apple iPhone 15 Pro", "Samsung SM-S928B")
 */
export const getDeviceDisplayName = (): string => {
  const brand = Device.brand ? `${Device.brand} ` : '';
  const model = Device.modelName || Device.deviceName || (Platform.OS === 'ios' ? 'Apple Device' : 'Android Device');
  return `${brand}${model}`.trim();
};
