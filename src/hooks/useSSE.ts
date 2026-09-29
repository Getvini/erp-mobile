import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus, Platform } from 'react-native';
import EventSource from 'react-native-sse';
import { useAuth } from '../context/AuthContext';
import { apiService } from '../services/api';
import { sseEventBus } from '../services/sseEventBus';
import { EVENT_TO_TAGS_MAP, getEntityTagForEvent, isProjectLifecycleEvent, isTeamMemberEvent } from '../constants/events';

const DEFAULT_API_URL =
  process.env.EXPO_PUBLIC_API_URL ||
  Platform.select({
    android: 'http://10.0.2.2:3000/api',
    default: 'http://localhost:3000/api',
  });

/**
 * Custom hook to manage Server-Sent Events (SSE) for erp-mobile.
 * Connects to /notifications/stream and handles automatic UI refresh & AppState lifecycle.
 */
export const useSSE = () => {
  const { user } = useAuth();
  const eventSourceRef = useRef<EventSource | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  useEffect(() => {
    if (!user) {
      if (eventSourceRef.current) {
        console.log('🔌 [SSE Mobile] User logged out, closing connection.');
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      return;
    }

    const connectSSE = async () => {
      // Close existing connection if any
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      const cookieHeader = apiService.getCookieHeader();
      const baseApi = DEFAULT_API_URL.replace(/\/$/, '');
      const sseUrl = `${baseApi}/notifications/stream`;

      console.log('📡 [SSE Mobile] Connecting to:', sseUrl);

      try {
        const es = new EventSource(sseUrl, {
          headers: cookieHeader ? { Cookie: cookieHeader } : {},
          pollingInterval: 10000,
        });

        eventSourceRef.current = es;

        es.addEventListener('open', () => {
          console.log('✅ [SSE Mobile] Connection established');
        });

        es.addEventListener('message', (event: any) => {
          if (!event.data) return;

          try {
            const payload = JSON.parse(event.data);

            // 1. Handle Module Events (Data Refresh Signals)
            if (payload.__isModuleEvent) {
              console.log(`⚡ [SSE Mobile] Module Event received: ${payload.event}`, payload.data);

              const tags = EVENT_TO_TAGS_MAP[payload.event] || [];

              // Emit specific event name (e.g. 'quotation_updated')
              sseEventBus.emit(payload.event, payload.data);

              // Emit tag invalidation signals (e.g. 'Opportunities', 'Quotations')
              tags.forEach((tag) => sseEventBus.emit(`invalidate_${tag}`, payload));

              // Delta Web 28-09-2026: invalidation theo id entity cụ thể.
              // Kênh: `invalidate_<Tag>_<id>` (ví dụ `invalidate_Projects_proj-1`).
              const entityTag = getEntityTagForEvent(payload.event);
              const entityId = payload.data?.id;
              if (entityTag && entityId) {
                sseEventBus.emit(`invalidate_${entityTag}_${entityId}`, payload);
                if (isProjectLifecycleEvent(payload.event)) {
                  sseEventBus.emit(`invalidate_PauseHistory_${entityId}`, payload);
                }
              }

              // `team_member_*` invalidate theo teamId (không theo id thành viên).
              if (isTeamMemberEvent(payload.event)) {
                const teamId = payload.data?.teamId || payload.data?.team?.id;
                if (teamId) {
                  sseEventBus.emit(`invalidate_Teams_${teamId}`, payload);
                }
              }

              sseEventBus.emit('module_event', payload);
              return;
            }

            // 2. Handle Standard Notifications
            console.log('🔔 [SSE Mobile] Notification received:', payload);
            sseEventBus.emit('notification', payload);
          } catch (err) {
            console.log('❌ [SSE Mobile] Error parsing message payload:', err);
          }
        });

        es.addEventListener('error', (event: any) => {
          if (event.type === 'error') {
            console.log('⚠️ [SSE Mobile] Connection error/disconnected. EventSource will retry...');
          }
        });
      } catch (error) {
        console.log('💥 [SSE Mobile] Failed to initialize EventSource:', error);
      }
    };

    // Initial connection when screen is active & authenticated
    if (appStateRef.current === 'active') {
      connectSSE();
    }

    // Handle AppState lifecycle (Close on background, reconnect on foreground)
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (
        appStateRef.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        console.log('📱 [SSE Mobile] App foregrounded -> Reconnecting SSE');
        connectSSE();
      } else if (nextAppState.match(/inactive|background/)) {
        console.log('📱 [SSE Mobile] App backgrounded -> Closing SSE connection to save battery');
        if (eventSourceRef.current) {
          eventSourceRef.current.close();
          eventSourceRef.current = null;
        }
      }
      appStateRef.current = nextAppState;
    });

    return () => {
      subscription.remove();
      if (eventSourceRef.current) {
        console.log('🔌 [SSE Mobile] Cleaning up EventSource connection');
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
    };
  }, [user]);
};
