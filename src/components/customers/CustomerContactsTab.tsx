import React, { memo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

interface CustomerContactsTabProps {
  phone?: string;
  email?: string;
  onCall: (phone?: string) => void;
  onEmail: (email?: string) => void;
}

function CustomerContactsTab({ phone, email, onCall, onEmail }: CustomerContactsTabProps) {
  if (!phone && !email) {
    return (
      <View className="rounded-2xl border border-slate-200 bg-white px-5 py-10 items-center">
        <Feather name="user-x" size={36} color="#CBD5E1" />
        <Text className="mt-3 text-sm font-bold text-slate-600">Chưa có thông tin liên hệ</Text>
        <Text className="mt-1 text-xs text-slate-400 text-center">
          Cập nhật số điện thoại hoặc email trong hồ sơ khách hàng.
        </Text>
      </View>
    );
  }

  return (
    <View className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <View className="flex-row items-center gap-3 border-b border-slate-100 pb-3">
        <View className="h-12 w-12 items-center justify-center rounded-xl bg-orange-50 border border-orange-100">
          <Feather name="user" size={22} color="#F38820" />
        </View>
        <View className="flex-1">
          <Text className="text-sm font-extrabold text-slate-900">Liên hệ chính</Text>
          <Text className="mt-0.5 text-xs text-slate-400">Thông tin liên hệ trên hồ sơ khách hàng</Text>
        </View>
      </View>

      {phone ? (
        <TouchableOpacity
          className="mt-3 min-h-[48px] flex-row items-center rounded-xl bg-emerald-50 px-3"
          onPress={() => onCall(phone)}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={`Gọi ${phone}`}
        >
          <Feather name="phone" size={18} color="#059669" />
          <View className="ml-3 flex-1">
            <Text className="text-[10px] font-bold uppercase text-emerald-600">Số điện thoại</Text>
            <Text className="mt-0.5 text-sm font-bold text-emerald-800">{phone}</Text>
          </View>
          <Feather name="external-link" size={16} color="#059669" />
        </TouchableOpacity>
      ) : null}

      {email ? (
        <TouchableOpacity
          className="mt-3 min-h-[48px] flex-row items-center rounded-xl bg-blue-50 px-3"
          onPress={() => onEmail(email)}
          activeOpacity={0.75}
          accessibilityRole="button"
          accessibilityLabel={`Gửi email tới ${email}`}
        >
          <Feather name="mail" size={18} color="#2563EB" />
          <View className="ml-3 flex-1">
            <Text className="text-[10px] font-bold uppercase text-blue-600">Email</Text>
            <Text className="mt-0.5 text-sm font-bold text-blue-800" numberOfLines={1}>{email}</Text>
          </View>
          <Feather name="external-link" size={16} color="#2563EB" />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

export default memo(CustomerContactsTab);
