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
  const playerRef = useRef<any>(null);
  const statusSubRef = useRef<any>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [durationSeconds, setDurationSeconds] = useState<number>(0);
  const [positionSeconds, setPositionSeconds] = useState<number>(0);

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

      if (!playerRef.current) {
        setIsLoading(true);
        await Audio.setAudioModeAsync({
          playsInSilentMode: true,
          shouldPlayInBackground: false,
          allowsRecording: false,
        }).catch(() => {});

        const player = Audio.createAudioPlayer(uri, { updateInterval: 250 });
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

  const progressPercent =
    durationSeconds > 0 ? Math.min(100, (positionSeconds / durationSeconds) * 100) : 0;

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
            {formatSeconds(positionSeconds)}
          </Text>
          <Text style={[styles.timeText, { color: textColor }]}>
            {durationSeconds > 0 ? formatSeconds(durationSeconds) : 'Ghi âm'}
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
