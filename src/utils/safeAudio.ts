// Safe lazy wrapper for expo-av to prevent native module crashes
// when running on builds without ExponentAV

let cachedAudio: any = undefined;

export const getSafeAudio = (): any => {
  if (cachedAudio !== undefined) {
    return cachedAudio;
  }
  try {
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
