import React from 'react';
import { View, Text, TouchableOpacity, Linking, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

interface ContactActionGroupProps {
  phone?: string;
  email?: string;
}

export function ContactActionGroup({ phone, email }: ContactActionGroupProps) {
  const handleCall = () => {
    if (!phone) {
      Alert.alert('Thông báo', 'Chưa có số điện thoại liên hệ.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Linking.openURL(`tel:${phone.replace(/[^0-9+]/g, '')}`);
  };

  const handleEmail = () => {
    if (!email) {
      Alert.alert('Thông báo', 'Chưa có địa chỉ email liên hệ.');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Linking.openURL(`mailto:${email}`);
  };

  return (
    <View className="flex-row items-center gap-2 my-1">
      {/* Call Button */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={handleCall}
        disabled={!phone}
        className={`flex-1 flex-row items-center justify-center gap-1.5 py-2 px-3 rounded-xl border min-h-[44px] ${
          phone
            ? 'bg-emerald-50 border-emerald-200'
            : 'bg-slate-100 border-slate-200 opacity-50'
        }`}
      >
        <Feather name="phone-call" size={14} color={phone ? '#059669' : '#94A3B8'} />
        <Text
          className={`text-xs font-bold ${
            phone ? 'text-emerald-700' : 'text-slate-400'
          }`}
          numberOfLines={1}
        >
          {phone || 'Gọi điện'}
        </Text>
      </TouchableOpacity>

      {/* Email Button */}
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={handleEmail}
        disabled={!email}
        className={`flex-1 flex-row items-center justify-center gap-1.5 py-2 px-3 rounded-xl border min-h-[44px] ${
          email
            ? 'bg-blue-50 border-blue-200'
            : 'bg-slate-100 border-slate-200 opacity-50'
        }`}
      >
        <Feather name="mail" size={14} color={email ? '#2563EB' : '#94A3B8'} />
        <Text
          className={`text-xs font-bold ${
            email ? 'text-blue-700' : 'text-slate-400'
          }`}
          numberOfLines={1}
        >
          {email || 'Gửi Email'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}
