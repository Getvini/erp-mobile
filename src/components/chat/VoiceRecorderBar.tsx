import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Animated,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrandColors } from '@/constants/colors';
import { getSafeAudio } from '@/utils/safeAudio';

interface VoiceRecorderBarProps {
  onSendAudio: (uri: string, durationSeconds: number) => Promise<void>;
  onCancel: () => void;
}

export const VoiceRecorderBar: React.FC<VoiceRecorderBarProps> = ({
  onSendAudio,
  onCancel,
}) => {
  const insets = useSafeAreaInsets();
  const recordingRef = useRef<any>(null);
  const [seconds, setSeconds] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Pulse animation for recording dot
  useEffect(() => {
    let anim: Animated.CompositeAnimation | null = null;
    if (isRecording && !isPaused) {
      anim = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.2,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      );
      anim.start();
    } else {
      pulseAnim.setValue(1);
    }
    return () => {
      anim?.stop();
    };
  }, [isRecording, isPaused, pulseAnim]);

  // Timer counter
  useEffect(() => {
    let timer: any = null;
    if (isRecording && !isPaused) {
      timer = setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isRecording, isPaused]);

  // Start recording on mount
  useEffect(() => {
    startRecording();
    return () => {
      cancelRecordingInternal();
    };
  }, []);

  const startRecording = async () => {
    try {
      const Audio = getSafeAudio();
      if (!Audio) {
        Alert.alert(
          'Ghi âm giọng nói',
          'Thiết bị chưa tích hợp module ghi âm native (ExpoAudio). Bạn có thể gửi file âm thanh qua tính năng đính kèm tệp.'
        );
        onCancel();
        return;
      }

      const permission = await Audio.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Quyền ghi âm',
          'Vui lòng cấp quyền truy cập micro trong cài đặt để ghi âm tin nhắn giọng nói.'
        );
        onCancel();
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
      }).catch(() => {});

      // Cấu hình chuẩn MPEG-4 AAC (.m4a) cho cả Android và iOS để Web giải mã native
      const recordingOptions = {
        ...Audio.RecordingPresets.HIGH_QUALITY,
        extension: '.m4a',
        android: {
          ...Audio.RecordingPresets.HIGH_QUALITY?.android,
          extension: '.m4a',
          outputFormat: 'mpeg4',
          audioEncoder: 'aac',
        },
      };

      const recorder = new Audio.AudioModule.AudioRecorder(recordingOptions as any);
      await recorder.prepareToRecordAsync();
      recorder.record();
      recordingRef.current = recorder;
      setIsRecording(true);
      setIsPaused(false);
      setSeconds(0);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    } catch (err: any) {
      Alert.alert('Lỗi', err.message || 'Không thể bắt đầu ghi âm');
      onCancel();
    }
  };

  const cancelRecordingInternal = async () => {
    try {
      if (recordingRef.current) {
        await recordingRef.current.stop().catch(() => {});
        recordingRef.current = null;
      }
    } catch {}
  };

  const handleCancel = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    await cancelRecordingInternal();
    onCancel();
  };

  const handleTogglePause = async () => {
    if (!recordingRef.current) return;
    try {
      Haptics.selectionAsync().catch(() => {});
      if (isPaused) {
        recordingRef.current.record();
        setIsPaused(false);
      } else {
        recordingRef.current.pause();
        setIsPaused(true);
      }
    } catch {}
  };

  const handleSend = async () => {
    if (!recordingRef.current || isSending) return;
    try {
      setIsSending(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

      const recorder = recordingRef.current;
      await recorder.stop();
      const uri = recorder.uri;
      recordingRef.current = null;

      if (!uri) {
        Alert.alert('Lỗi', 'Không lấy được tệp âm thanh ghi âm.');
        onCancel();
        return;
      }

      await onSendAudio(uri, seconds);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (err: any) {
      Alert.alert('Lỗi', err.message || 'Gửi tin nhắn thoại thất bại');
      onCancel();
    } finally {
      setIsSending(false);
    }
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {/* Nút hủy / xóa */}
      <TouchableOpacity
        style={styles.cancelBtn}
        onPress={handleCancel}
        disabled={isSending}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Feather name="trash-2" size={20} color="#EF4444" />
      </TouchableOpacity>

      {/* Hiển thị thời gian & hiệu ứng chấm đỏ */}
      <View style={styles.statusWrap}>
        <Animated.View
          style={[styles.recordingDot, { opacity: pulseAnim }]}
        />
        <Text style={styles.timerText}>{formatTimer(seconds)}</Text>
        <Text style={styles.hintText}>
          {isPaused ? 'Đã tạm dừng' : 'Đang ghi âm...'}
        </Text>
      </View>

      {/* Tạm dừng / Tiếp tục */}
      <TouchableOpacity
        style={styles.pauseBtn}
        onPress={handleTogglePause}
        disabled={isSending}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Feather
          name={isPaused ? 'play' : 'pause'}
          size={18}
          color="#64748B"
        />
      </TouchableOpacity>

      {/* Gửi */}
      <TouchableOpacity
        style={styles.sendBtn}
        onPress={handleSend}
        disabled={isSending}
      >
        {isSending ? (
          <ActivityIndicator size="small" color="#FFFFFF" />
        ) : (
          <Feather name="send" size={18} color="#FFFFFF" />
        )}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 12,
  },
  cancelBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  recordingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
  },
  timerText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    fontVariant: ['tabular-nums'],
  },
  hintText: {
    fontSize: 12,
    color: '#64748B',
  },
  pauseBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: BrandColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: BrandColors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
});
