import { Clipboard as RNClipboard } from 'react-native';

// Safe clipboard copier that falls back gracefully across expo-clipboard and react-native
export const copyTextToClipboard = async (text: string): Promise<boolean> => {
  if (!text) return false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ExpoClipboard = require('expo-clipboard');
    if (ExpoClipboard?.setStringAsync) {
      await ExpoClipboard.setStringAsync(text);
      return true;
    }
  } catch {
    // ExpoClipboard native module missing in running binary
  }

  try {
    if (RNClipboard?.setString) {
      RNClipboard.setString(text);
      return true;
    }
  } catch {}

  return false;
};
