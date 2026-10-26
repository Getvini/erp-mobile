import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Linking,
  Alert,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { BrandColors } from '@/constants/colors';
import { getSafeAudio } from '@/utils/safeAudio';

interface AudioMessagePlayerProps {
  uri: string;
  isMe?: boolean;
  onLongPress?: () => void;
}

const AudioMessagePlayerComponent: React.FC<AudioMessagePlayerProps> = ({
  uri,
  isMe = false,
  onLongPress,
}) => {
  const soundRef = useRef<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [durationMillis, setDurationMillis] = useState<number>(0);
  const [positionMillis, setPositionMillis] = useState<number>(0);

  useEffect(() => {
    return () => {
      if (soundRef.current) {
        soundRef.current.unloadAsync?.().catch(() => {});
      }
    };
  }, []);

  const formatMillis = (millis: number) => {
    const totalSeconds = Math.max(0, Math.floor(millis / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  const onPlaybackStatusUpdate = (status: any) => {
    if (!status?.isLoaded) {
      if (status?.error) {
        setIsPlaying(false);
        setIsLoading(false);
      }
      return;
    }

    setIsPlaying(!!status.isPlaying);
    setPositionMillis(status.positionMillis || 0);
    if (status.durationMillis) {
      setDurationMillis(status.durationMillis);
    }

    if (status.didJustFinish) {
      setIsPlaying(false);
      setPositionMillis(0);
      soundRef.current?.setPositionAsync?.(0).catch(() => {});
    }
  };

  const handleTogglePlay = async () => {
    const Audio = getSafeAudio();
    if (!Audio) {
      // Graceful fallback when native audio module is not compiled into dev client
      Haptics.selectionAsync().catch(() => {});
      if (uri) {
        try {
          await Linking.openURL(uri);
        } catch {
          Alert.alert('Tệp âm thanh', uri);
        }
      }
      return;
    }

    try {
      Haptics.selectionAsync().catch(() => {});

      if (!soundRef.current) {
        setIsLoading(true);
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
        });

        const { sound } = await Audio.Sound.createAsync(
          { uri },
          { shouldPlay: true },
          onPlaybackStatusUpdate
        );
        soundRef.current = sound;
        setIsLoading(false);
        setIsPlaying(true);
      } else {
        if (isPlaying) {
          await soundRef.current.pauseAsync();
        } else {
          if (positionMillis >= durationMillis && durationMillis > 0) {
            await soundRef.current.setPositionAsync(0);
          }
          await soundRef.current.playAsync();
        }
      }
    } catch {
      setIsLoading(false);
      setIsPlaying(false);
    }
  };

  const progressPercent =
    durationMillis > 0 ? Math.min(100, (positionMillis / durationMillis) * 100) : 0;

  const btnBgColor = isMe ? '#FFFFFF' : BrandColors.primary;
  const btnIconColor = isMe ? BrandColors.primary : '#FFFFFF';
  const trackBgColor = isMe ? 'rgba(255,255,255,0.3)' : '#E2E8F0';
  const progressBgColor = isMe ? '#FFFFFF' : BrandColors.primary;
  const textColor = isMe ? '#FFFFFF' : '#64748B';

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.playBtn, { backgroundColor: btnBgColor }]}
        onPress={handleTogglePlay}
        disabled={isLoading}
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

      <TouchableOpacity
        activeOpacity={0.85}
        onLongPress={onLongPress}
        delayLongPress={250}
        style={styles.waveformWrap}
      >
        <View style={[styles.trackBar, { backgroundColor: trackBgColor }]}>
          <View
            style={[
              styles.progressBar,
              { width: `${progressPercent}%`, backgroundColor: progressBgColor },
            ]}
          />
        </View>

        <View style={styles.timeRow}>
          <Text style={[styles.timeText, { color: textColor }]}>
            {formatMillis(positionMillis)}
          </Text>
          <Text style={[styles.timeText, { color: textColor }]}>
            {durationMillis > 0 ? formatMillis(durationMillis) : 'Ghi âm'}
          </Text>
        </View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 2,
    gap: 10,
    minWidth: 200,
  },
  playBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  waveformWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  trackBar: {
    height: 5,
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timeText: {
    fontSize: 11,
    fontWeight: '500',
  },
});

export const AudioMessagePlayer = React.memo(AudioMessagePlayerComponent);
