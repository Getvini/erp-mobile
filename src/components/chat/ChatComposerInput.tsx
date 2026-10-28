import React, { useMemo } from 'react';
import {
  Platform,
  StyleProp,
  Text,
  TextInput,
  TextInputProps,
  TextStyle,
  View,
} from 'react-native';
import type { ComposerTokenRange } from '@/utils/chatComposerTokens';

interface ChatComposerInputProps extends Omit<TextInputProps, 'style' | 'value'> {
  value: string;
  ranges: ComposerTokenRange[];
  style?: StyleProp<TextStyle>;
}

export const ChatComposerInput: React.FC<ChatComposerInputProps> = ({
  value,
  ranges,
  style,
  ...inputProps
}) => {
  const pieces = useMemo(() => {
    const result: Array<{ text: string; token?: ComposerTokenRange }> = [];
    let cursor = 0;
    ranges
      .filter((range) => range.start >= cursor && range.end <= value.length)
      .sort((a, b) => a.start - b.start)
      .forEach((range) => {
        if (range.start > cursor) result.push({ text: value.slice(cursor, range.start) });
        result.push({ text: value.slice(range.start, range.end), token: range });
        cursor = range.end;
      });
    if (cursor < value.length) result.push({ text: value.slice(cursor) });
    return result;
  }, [ranges, value]);

  const sharedTextStyle: TextStyle = {
    fontSize: 14,
    lineHeight: 20,
    paddingVertical: Platform.OS === 'ios' ? 8 : 4,
  };

  return (
    <View style={{ flex: 1, position: 'relative' }}>
      {value.length > 0 && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            justifyContent: 'center',
          }}
        >
          <Text style={[sharedTextStyle, style, { color: '#0F172A' }]}>
            {pieces.map((piece, index) => (
              <Text
                key={`${piece.token?.id || 'text'}-${index}`}
                style={
                  piece.token
                    ? {
                        color: piece.token.type === 'user' ? '#1D4ED8' : '#EA580C',
                        backgroundColor: piece.token.type === 'user' ? '#DBEAFE' : '#FFEDD5',
                        fontWeight: '700',
                      }
                    : undefined
                }
              >
                {piece.text}
              </Text>
            ))}
          </Text>
        </View>
      )}
      <TextInput
        {...inputProps}
        value={value}
        selectionColor="#F38820"
        cursorColor="#F38820"
        style={[sharedTextStyle, style, value ? { color: 'transparent' } : { color: '#0F172A' }]}
      />
    </View>
  );
};

