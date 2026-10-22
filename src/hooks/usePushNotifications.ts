import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { notificationService } from '@/services/notificationService';
import { getOrCreateDeviceId, getDeviceDisplayName } from '@/utils/deviceHelper';
import { resolveNotificationDeepLink } from '@/utils/notificationPresenter';

// Nạp an toàn thư viện expo-notifications (tránh crash khi chạy trên Expo Go / dev-client cũ chưa build lại native module)
let Notifications: typeof import('expo-notifications') | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  Notifications = require('expo-notifications');
  if (Notifications && typeof Notifications.setNotificationHandler === 'function') {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  }
} catch (err: any) {
  console.log('📱 [PushNotification] Module native expo-notifications chưa có trong runtime hiện tại:', err?.message || err);
}

/**
 * Hook quản lý vòng đời Push Notification:
 * 1. Xin quyền & lấy Expo Push Token
 * 2. Đăng ký token thiết bị với backend ERP
 * 3. Lắng nghe hành vi bấm vào thông báo và tự động Deep-link (kể cả khi app bị tắt - Cold Start)
 */
export const usePushNotifications = () => {
  const { user } = useAuth();
  const router = useRouter();
  const responseListener = useRef<{ remove: () => void } | null>(null);

  // 1. Đăng ký nhận token & gửi lên server khi user đăng nhập
  useEffect(() => {
    if (!Notifications || !user) return;
    const notificationsApi = Notifications;

    const registerPushToken = async () => {
      try {
        if (!Device.isDevice) {
          console.log('📱 [PushNotification] Thiết bị là Simulator/Emulator, bỏ qua đăng ký token.');
          return;
        }

        // Tạo kênh thông báo trên Android (bắt buộc từ Android 8.0+)
        if (Platform.OS === 'android') {
          await notificationsApi.setNotificationChannelAsync('default', {
            name: 'Thông báo Getvini ERP',
            importance: notificationsApi.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#F38820',
          });
        }

        // Xin quyền nhận thông báo
        const { status: existingStatus } = await notificationsApi.getPermissionsAsync();
        let finalStatus = existingStatus;

        if (existingStatus !== 'granted') {
          const { status } = await notificationsApi.requestPermissionsAsync();
          finalStatus = status;
        }

        if (finalStatus !== 'granted') {
          console.log('⚠️ [PushNotification] Người dùng không cấp quyền thông báo.');
          return;
        }

        // Lấy projectId từ cấu hình Expo/EAS
        const projectId =
          Constants?.expoConfig?.extra?.eas?.projectId ??
          Constants?.easConfig?.projectId;

        const tokenResult = await notificationsApi.getExpoPushTokenAsync({
          projectId: projectId || undefined,
        });

        if (!tokenResult?.data) {
          console.warn('⚠️ [PushNotification] Không lấy được ExpoPushToken.');
          return;
        }

        const deviceId = await getOrCreateDeviceId();
        const deviceName = getDeviceDisplayName();

        console.log(`📡 [PushNotification] Đăng ký token cho user ${user.id}:`, tokenResult.data);

        await notificationService.registerDevice({
          token: tokenResult.data,
          deviceId,
          platform: Platform.OS,
          deviceName,
        });

        console.log('✅ [PushNotification] Đăng ký thiết bị thành công!');
      } catch (error: any) {
        if (error?.message?.includes('googleServicesFile') || error?.message?.includes('FirebaseApp')) {
          console.warn('⚠️ [PushNotification] Chưa cấu hình google-services.json cho Android. Bỏ qua push token cho phiên này (App vẫn hoạt động bình thường với SSE & Socket).');
        } else {
          console.error('💥 [PushNotification] Lỗi trong quá trình đăng ký token:', error);
        }
      }
    };

    registerPushToken();
  }, [user]);

  // 2. Xử lý Deep-Link khi người dùng bấm vào thông báo (Foreground, Background, Cold Start)
  useEffect(() => {
    if (!Notifications) return;
    const notificationsApi = Notifications;

    const handleNotificationResponse = (response: any) => {
      const data = (response?.notification?.request?.content?.data || {}) as Record<string, string | undefined>;
      if (!data || Object.keys(data).length === 0) return;

      console.log('🔔 [PushNotification] Người dùng bấm vào thông báo:', data);

      const deepLink = resolveNotificationDeepLink({
        link: data.link,
        type: data.type,
        relatedEntityType: data.relatedEntityType,
        targetId: data.relatedEntityId || data.targetId || data.id,
      });

      if (deepLink) {
        console.log(`🧭 [PushNotification] Điều hướng tới deep-link: ${deepLink}`);
        router.push(deepLink as any);
      }
    };

    // Lắng nghe khi người dùng bấm vào thông báo lúc app đang chạy (Foreground/Background)
    const sub = notificationsApi.addNotificationResponseReceivedListener(handleNotificationResponse);
    responseListener.current = sub;

    // Xử lý Cold Start: khi app tắt hẳn và được mở lên từ việc bấm thông báo
    notificationsApi.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        handleNotificationResponse(response);
      }
    });

    return () => {
      responseListener.current?.remove();
    };
  }, [router]);
};
