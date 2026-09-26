import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { ErrorBoundaryProps } from 'expo-router';

export function ScreenErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  const handleRetry = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
    retry();
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-900 justify-center items-center p-6">
      <View className="w-full max-w-sm bg-slate-800 border border-slate-700 rounded-2xl p-6 items-center shadow-xl">
        <View className="w-14 h-14 rounded-full bg-red-500/10 justify-center items-center mb-4 border border-red-500/20">
          <Feather name="alert-triangle" size={28} color="#EF4444" />
        </View>

        <Text className="text-lg font-bold text-white text-center mb-2">
          Đã xảy ra lỗi không mong muốn
        </Text>

        <Text className="text-xs text-slate-400 text-center mb-6 leading-5">
          Rất tiếc, ứng dụng gặp sự cố hệ thống. Bạn có thể bấm nút bên dưới để thử lại hoặc khởi động lại ứng dụng.
        </Text>

        {__DEV__ && (
          <View className="w-full bg-slate-950 p-3 rounded-lg border border-slate-800 mb-6 max-h-32">
            <Text className="text-[11px] font-mono text-red-400" numberOfLines={4}>
              {error.toString()}
            </Text>
          </View>
        )}

        <TouchableOpacity
          className="w-full min-h-12 bg-blue-600 active:bg-blue-700 py-3.5 rounded-xl flex-row items-center justify-center gap-2 shadow-sm"
          onPress={handleRetry}
          activeOpacity={0.8}
        >
          <Feather name="refresh-cw" size={16} color="#FFFFFF" />
          <Text className="text-sm font-bold text-white">Thử lại ngay</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
