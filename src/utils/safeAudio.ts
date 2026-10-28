// Safe lazy wrapper for expo-audio to prevent native module crashes
// when running on builds without ExpoAudio
import { requireOptionalNativeModule } from 'expo-modules-core';

export type ExpoAudioType = typeof import('expo-audio');

let cachedAudio: ExpoAudioType | null | undefined = undefined;

export const getSafeAudio = (): ExpoAudioType | null => {
  if (cachedAudio !== undefined) {
    return cachedAudio;
  }
  try {
    // Check if the native module ExpoAudio actually exists before requiring expo-audio
    let hasNativeAudio: any = null;
    try {
      hasNativeAudio = requireOptionalNativeModule('ExpoAudio');
    } catch {
      hasNativeAudio = null;
    }

    if (!hasNativeAudio) {
      cachedAudio = null;
      return null;
    }

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const expoAudio: ExpoAudioType = require('expo-audio');
    if (expoAudio) {
      cachedAudio = expoAudio;
      return cachedAudio;
    }
  } catch {
    // Native module ExpoAudio not installed in running client build
  }
  cachedAudio = null;
  return null;
};

export const isAudioSupported = (): boolean => {
  return getSafeAudio() !== null;
};
