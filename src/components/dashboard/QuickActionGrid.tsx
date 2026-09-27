import React from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather, Ionicons } from '@expo/vector-icons';
import { BrandColors } from '@/constants/colors';
import { canAccessOpportunities, canAccessCustomers, canAccessContracts, isManagementRole } from '@/utils/rbac';
import { formatVND } from '@/utils/formatters';

interface QuickActionGridProps {
  userRole?: string;
  totalDebt?: number;
}

interface ActionItem {
  id: string;
  label: string;
  iconName: string;
  iconType: 'feather' | 'ionicons';
  iconColor: string;
  bgColor: string;
  badge?: string;
  onPress: () => void;
}

export const QuickActionGrid: React.FC<QuickActionGridProps> = ({
  userRole,
  totalDebt = 0,
}) => {
  const router = useRouter();
  // List of all potential quick actions with permission checks
  const allPossibleActions: (ActionItem & { isAllowed: boolean })[] = [
    {
      id: 'opp_pipeline',
      label: 'Cơ hội',
      iconName: 'trending-up',
      iconType: 'feather',
      iconColor: '#8B5CF6',
      bgColor: '#F3E8FF',
      onPress: () => router.push('/opportunities' as any),
      isAllowed: canAccessOpportunities(userRole),
    },
    {
      id: 'contracts',
      label: 'Hợp đồng',
      iconName: 'document-text-outline',
      iconType: 'ionicons',
      iconColor: '#2563EB',
      bgColor: '#EFF6FF',
      onPress: () => router.push('/contracts' as any),
      isAllowed: canAccessContracts(userRole),
    },
    {
      id: 'payment_requests',
      label: 'Đề xuất chi',
      iconName: 'receipt-outline',
      iconType: 'ionicons',
      iconColor: '#EA580C',
      bgColor: '#FFEDD5',
      onPress: () => router.push('/payment-requests' as any),
      isAllowed: true,
    },
    {
      id: 'finance_debts',
      label: 'Công nợ HĐ',
      iconName: 'card-outline',
      iconType: 'ionicons',
      iconColor: '#D97706',
      bgColor: '#FEF3C7',
      badge: totalDebt > 0 ? 'Nợ' : undefined,
      onPress: () => router.push('/finance' as any),
      isAllowed: isManagementRole(userRole) || canAccessContracts(userRole),
    },
    {
      id: 'create_opp',
      label: 'Tạo Cơ hội',
      iconName: 'plus',
      iconType: 'feather',
      iconColor: BrandColors.primary,
      bgColor: '#FFF4EA',
      onPress: () => router.push('/opportunities/create' as any),
      isAllowed: canAccessOpportunities(userRole),
    },
    {
      id: 'customers',
      label: 'Khách hàng',
      iconName: 'people-outline',
      iconType: 'ionicons',
      iconColor: '#10B981',
      bgColor: '#ECFDF5',
      onPress: () => router.push('/customers' as any),
      isAllowed: canAccessCustomers(userRole),
    },
    {
      id: 'projects',
      label: 'Dự án',
      iconName: 'briefcase-outline',
      iconType: 'ionicons',
      iconColor: '#3B82F6',
      bgColor: '#EFF6FF',
      onPress: () => router.push('/projects' as any),
      isAllowed: true,
    },
    {
      id: 'tasks',
      label: 'Nhiệm vụ',
      iconName: 'checkbox-outline',
      iconType: 'ionicons',
      iconColor: '#F59E0B',
      bgColor: '#FFFBEB',
      onPress: () => router.push('/tasks' as any),
      isAllowed: true,
    },
    {
      id: 'acceptances',
      label: 'Nghiệm thu',
      iconName: 'checkmark-done-circle-outline',
      iconType: 'ionicons',
      iconColor: '#059669',
      bgColor: '#ECFDF5',
      onPress: () => router.push('/acceptances' as any),
      isAllowed: true,
    },
    {
      id: 'notif',
      label: 'Thông báo',
      iconName: 'notifications-outline',
      iconType: 'ionicons',
      iconColor: '#EC4899',
      bgColor: '#FDF2F8',
      onPress: () => router.push('/notifications' as any),
      isAllowed: true,
    },
    {
      id: 'profile',
      label: 'Hồ sơ',
      iconName: 'person-outline',
      iconType: 'ionicons',
      iconColor: '#10B981',
      bgColor: '#ECFDF5',
      onPress: () => router.push('/profile' as any),
      isAllowed: true,
    },
    {
      id: 'explore',
      label: 'Tất cả',
      iconName: 'grid-outline',
      iconType: 'ionicons',
      iconColor: '#6366F1',
      bgColor: '#EEF2FF',
      onPress: () => router.push('/explore'),
      isAllowed: true,
    },
  ];

  // Only show actions allowed for current user's role
  const actions = allPossibleActions.filter((item) => item.isAllowed);

  return (
    <View className="bg-surface rounded-2xl px-3 py-4 mb-4 border border-border shadow-xs">
      <View className="flex-row justify-between items-center px-1 mb-3.5">
        <Text className="text-[15px] font-bold text-text-primary tracking-tight">Tiện ích truy cập nhanh</Text>
      </View>

      <View className="flex-row flex-wrap">
        {actions.map((item) => (
          <TouchableOpacity
            key={item.id}
            className="w-1/4 items-center py-2 px-0.5"
            onPress={item.onPress}
            activeOpacity={0.7}
          >
            <View className="w-[50px] h-[50px] rounded-2xl justify-center items-center mb-1.5 relative" style={{ backgroundColor: item.bgColor }}>
              {item.iconType === 'feather' ? (
                <Feather name={item.iconName as any} size={22} color={item.iconColor} />
              ) : (
                <Ionicons name={item.iconName as any} size={22} color={item.iconColor} />
              )}

              {item.badge ? (
                <View className="absolute -top-1 -right-1.5 bg-danger px-1 py-0.5 rounded-lg border-[1.5px] border-surface">
                  <Text className="text-[9px] font-extrabold text-white">{item.badge}</Text>
                </View>
              ) : null}
            </View>

            <Text className="text-xs font-semibold text-slate-700 text-center leading-4" numberOfLines={2}>
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};
