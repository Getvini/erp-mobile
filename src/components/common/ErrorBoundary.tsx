import React, { useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { ErrorBoundaryProps } from 'expo-router';

export function ScreenErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    console.error('[ScreenErrorBoundary] Original screen error:', error);
  }, [error]);

  const handleRetry = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    retry();
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.card}>
        <View style={styles.icon}>
          <Feather name="alert-triangle" size={28} color="#EF4444" />
        </View>

        <Text style={styles.title}>
          Đã xảy ra lỗi không mong muốn
        </Text>

        <Text style={styles.description}>
          Rất tiếc, ứng dụng gặp sự cố hệ thống. Bạn có thể bấm nút bên dưới để thử lại hoặc khởi động lại ứng dụng.
        </Text>

        {__DEV__ && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText} numberOfLines={4}>
              {error.toString()}
            </Text>
          </View>
        )}

        <TouchableOpacity
          style={styles.retry}
          onPress={handleRetry}
          activeOpacity={0.8}
        >
          <Feather name="refresh-cw" size={16} color="#FFFFFF" />
          <Text style={styles.retryText}>Thử lại ngay</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// Fallback dùng style tĩnh để vẫn render được khi màn hình lỗi trong lớp CSS interop.
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0F172A', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 384, backgroundColor: '#1E293B', borderWidth: 1, borderColor: '#334155', borderRadius: 16, padding: 24, alignItems: 'center' },
  icon: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#EF44441A', justifyContent: 'center', alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: '#EF444433' },
  title: { fontSize: 18, fontWeight: '700', color: '#FFFFFF', textAlign: 'center', marginBottom: 8 },
  description: { fontSize: 12, color: '#94A3B8', textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  errorBox: { width: '100%', backgroundColor: '#020617', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#1E293B', marginBottom: 24, maxHeight: 128 },
  errorText: { fontSize: 12, color: '#F87171' },
  retry: { width: '100%', minHeight: 48, backgroundColor: '#2563EB', paddingVertical: 14, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  retryText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
});
