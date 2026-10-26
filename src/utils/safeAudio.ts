// Safe lazy wrapper for expo-av to prevent native module crashes
// when running on builds without ExponentAV
import { requireOptionalNativeModule } from 'expo-modules-core';

let cachedAudio: any = undefined;

export const getSafeAudio = (): any => {
  if (cachedAudio !== undefined) {
    return cachedAudio;
  }
  try {
    // Check if the native module ExponentAV actually exists before requiring expo-av
    let hasNativeAV: any = null;
    try {
      hasNativeAV = requireOptionalNativeModule('ExponentAV');
    } catch {
      hasNativeAV = null;
    }

    if (!hasNativeAV) {
      cachedAudio = null;
      return null;
    }

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const expoAv = require('expo-av');
    if (expoAv && expoAv.Audio) {
      cachedAudio = expoAv.Audio;
      return cachedAudio;
    }
  } catch {
    // Native module ExponentAV not installed in running client build
  }
  cachedAudio = null;
  return null;
};

export const isAudioSupported = (): boolean => {
  return getSafeAudio() !== null;
};
