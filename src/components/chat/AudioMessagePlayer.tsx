import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Linking,
  Alert,
  GestureResponderEvent,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { BrandColors } from '@/constants/colors';
import { getSafeAudio } from '@/utils/safeAudio';

interface AudioMessagePlayerProps {
  uri: string;
  fileName?: string;
  isMe?: boolean;
  onLongPress?: () => void;
}

export const normalizeAudioPlaybackUrl = (url: string) => {
  if (!url || typeof url !== 'string') return '';
  if (url.includes('res.cloudinary.com')) {
    return url.replace(/\.(3gp|3gpp|amr)($|\?)/i, '.mp3$2');
  }
  return url;
};

const AudioMessagePlayerComponent: React.FC<AudioMessagePlayerProps> = ({
  uri,
  fileName,
  isMe = false,
  onLongPress,
}) => {
  const playerRef = useRef<any>(null);
  const statusSubRef = useRef<any>(null);

  const playableUri = useMemo(() => normalizeAudioPlaybackUrl(uri), [uri]);

  // Parse duration hint from fileName (e.g. "Tin nhắn thoại (5s)" => 5)
  const initialDuration = useMemo(() => {
    if (!fileName) return 0;
    const match = fileName.match(/\((\d+)\s*s\)/i);
    return match ? parseInt(match[1], 10) : 0;
  }, [fileName]);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [durationSeconds, setDurationSeconds] = useState<number>(initialDuration);
  const [positionSeconds, setPositionSeconds] = useState<number>(0);
  const [trackWidth, setTrackWidth] = useState<number>(0);

  useEffect(() => {
    return () => {
      if (statusSubRef.current) {
        statusSubRef.current.remove?.();
        statusSubRef.current = null;
      }
      if (playerRef.current) {
        try {
          playerRef.current.pause();
          playerRef.current.remove();
        } catch {}
        playerRef.current = null;
      }
    };
  }, []);

  const formatSeconds = (seconds: number) => {
    const totalSeconds = Math.max(0, Math.floor(seconds));
    const minutes = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const handleTogglePlay = async () => {
    const Audio = getSafeAudio();
    if (!Audio) {
      // Graceful fallback when native audio module is not compiled into dev client
      Haptics.selectionAsync().catch(() => {});
      if (playableUri) {
        try {
          await Linking.openURL(playableUri);
        } catch {
          Alert.alert('Tệp âm thanh', playableUri);
        }
      }
      return;
    }

    try {
      Haptics.selectionAsync().catch(() => {});

      if (!playerRef.current) {
        setIsLoading(true);
        await Audio.setAudioModeAsync({
          playsInSilentMode: true,
          shouldPlayInBackground: false,
          allowsRecording: false,
        }).catch(() => {});

        const player = Audio.createAudioPlayer(playableUri, { updateInterval: 250 });
        playerRef.current = player;

        const sub = player.addListener('playbackStatusUpdate', (status) => {
          if (!status?.isLoaded) {
            if (status?.error) {
              setIsPlaying(false);
              setIsLoading(false);
            }
            return;
          }

          setIsPlaying(Boolean(status.playing));
          if (typeof status.currentTime === 'number') {
            setPositionSeconds(status.currentTime);
          }
          if (typeof status.duration === 'number' && status.duration > 0) {
            setDurationSeconds(status.duration);
          }
          if (status.isLoaded) {
            setIsLoading(false);
          }

          if (status.didJustFinish) {
            setIsPlaying(false);
            setPositionSeconds(0);
            player.seekTo(0).catch(() => {});
          }
        });
        statusSubRef.current = sub;

        player.play();
        setIsPlaying(true);
      } else {
        if (isPlaying) {
          playerRef.current.pause();
          setIsPlaying(false);
        } else {
          if (positionSeconds >= durationSeconds && durationSeconds > 0) {
            await playerRef.current.seekTo(0);
          }
          playerRef.current.play();
          setIsPlaying(true);
        }
      }
    } catch {
      setIsLoading(false);
      setIsPlaying(false);
    }
  };

  const handleSeek = (e: GestureResponderEvent) => {
    if (durationSeconds <= 0 || !playerRef.current) return;
    const { locationX } = e.nativeEvent;
    if (trackWidth > 0) {
      const pct = Math.max(0, Math.min(1, locationX / trackWidth));
      const targetSec = pct * durationSeconds;
      setPositionSeconds(targetSec);
      playerRef.current.seekTo(targetSec).catch(() => {});
    }
  };

const WAVEFORM_BARS = [
  3, 4, 6, 10, 14, 8, 12, 16, 11, 9, 15, 18, 13, 10, 15, 17, 12, 8, 13, 16, 10, 7, 5, 3
];

  const effectiveDuration = durationSeconds > 0 ? durationSeconds : initialDuration;
  const progressRatio = effectiveDuration > 0 ? Math.min(1, positionSeconds / effectiveDuration) : 0;
  const activeBarCount = Math.round(progressRatio * WAVEFORM_BARS.length);

  const displayTime =
    isPlaying || positionSeconds > 0
      ? formatSeconds(positionSeconds)
      : formatSeconds(effectiveDuration);

  const btnBgColor = isMe ? '#FFFFFF' : BrandColors.primary;
  const btnIconColor = isMe ? BrandColors.primary : '#FFFFFF';
  const activeBarColor = isMe ? '#FFFFFF' : BrandColors.primary;
  const inactiveBarColor = isMe ? 'rgba(255,255,255,0.4)' : '#CBD5E1';
  const timerTextColor = isMe ? '#FFFFFF' : '#475569';

  return (
    <TouchableOpacity
      activeOpacity={0.92}
      onLongPress={onLongPress}
      delayLongPress={250}
      style={styles.container}
    >
      {/* Nút Play / Pause hình tròn chuẩn thiết kế */}
      <TouchableOpacity
        style={[styles.playBtn, { backgroundColor: btnBgColor }]}
        onPress={handleTogglePlay}
        disabled={isLoading}
        activeOpacity={0.8}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={btnIconColor} />
        ) : (
          <Feather
            name={isPlaying ? 'pause' : 'play'}
            size={16}
            color={btnIconColor}
            style={!isPlaying ? { marginLeft: 2 } : undefined}
          />
        )}
      </TouchableOpacity>

      {/* Dải sóng âm thanh Waveform (nhấn để tua) */}
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={handleSeek}
        onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
        hitSlop={{ top: 10, bottom: 10, left: 4, right: 4 }}
        style={styles.waveformWrap}
      >
        {WAVEFORM_BARS.map((h, idx) => {
          const isActive = idx < activeBarCount;
          return (
            <View
              key={idx}
              style={{
                width: 2.5,
                height: h,
                borderRadius: 1.5,
                backgroundColor: isActive ? activeBarColor : inactiveBarColor,
              }}
            />
          );
        })}
      </TouchableOpacity>

      {/* Thời gian hiển thị (mm:ss) */}
      <Text style={[styles.timeText, { color: timerTextColor }]}>
        {displayTime}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 2,
    paddingHorizontal: 2,
    minWidth: 210,
    maxWidth: 260,
  },
  playBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2,
  },
  waveformWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 24,
    paddingVertical: 2,
  },
  timeText: {
    fontSize: 12,
    fontWeight: '700',
    minWidth: 28,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
});

export const AudioMessagePlayer = React.memo(AudioMessagePlayerComponent);
