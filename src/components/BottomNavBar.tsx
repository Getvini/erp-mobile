import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BrandColors } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import { canAccessCustomers } from '@/utils/rbac';

function BottomNavBarComponent() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { isAuthenticated, user } = useAuth();

  const isDetailPage =
    pathname.includes('/[') ||
    pathname.includes('/projects/') ||
    pathname.includes('/contracts/') ||
    pathname.includes('/tasks/') ||
    pathname.includes('/opportunities/') ||
    pathname.includes('/customers/');

  if (isDetailPage) {
    return null;
  }

  const isHome = pathname === '/' || pathname === '/index';
  const isTasks = pathname === '/tasks' || pathname === '/tasks/index' || pathname === '/tasks/';
  const isProjects = pathname === '/projects' || pathname === '/projects/index' || pathname === '/projects/';
  const isCustomers = pathname === '/customers' || pathname === '/customers/index' || pathname === '/customers/';
  const isProfile = pathname === '/profile' || pathname === '/profile/index' || pathname === '/profile/';

  const navigateTo = (route: string) => {
    if (!isAuthenticated && route !== '/(auth)/login') {
      router.push('/(auth)/login');
      return;
    }
    // Tránh re-mount không cần thiết nếu người dùng nhấn vào chính tab đang đứng
    if (
      (route === '/' && isHome) ||
      (route === '/tasks' && isTasks) ||
      (route === '/projects' && isProjects) ||
      (route === '/customers' && isCustomers) ||
      (route === '/profile' && isProfile)
    ) {
      return;
    }
    router.replace(route as any);
  };

  const hasCustomerAccess = canAccessCustomers(user?.role);

  return (
    <View
      className="flex-row bg-surface border-t border-border pt-2 items-center justify-around shadow-sm"
      style={{ paddingBottom: Math.max(insets.bottom, 10) }}
    >
      {/* 1. Home / Dashboard */}
      <TouchableOpacity
        className="items-center justify-center flex-1 py-0.5"
        onPress={() => navigateTo('/')}
        activeOpacity={0.7}
      >
        <Ionicons
          name={isHome ? 'grid' : 'grid-outline'}
          size={21}
          color={isHome ? BrandColors.primary : BrandColors.slate400}
        />
        <Text className={`text-[10px] mt-[3px] ${isHome ? 'font-bold text-primary' : 'font-medium text-text-secondary'}`}>
          Tổng quan
        </Text>
      </TouchableOpacity>

      {/* 2. Tasks */}
      <TouchableOpacity
        className="items-center justify-center flex-1 py-0.5"
        onPress={() => navigateTo('/tasks')}
        activeOpacity={0.7}
      >
        <Ionicons
          name={isTasks ? 'checkbox' : 'checkbox-outline'}
          size={21}
          color={isTasks ? BrandColors.primary : BrandColors.slate400}
        />
        <Text className={`text-[10px] mt-[3px] ${isTasks ? 'font-bold text-primary' : 'font-medium text-text-secondary'}`}>
          Nhiệm vụ
        </Text>
      </TouchableOpacity>

      {/* 3. Projects */}
      <TouchableOpacity
        className="items-center justify-center flex-1 py-0.5"
        onPress={() => navigateTo('/projects')}
        activeOpacity={0.7}
      >
        <Ionicons
          name={isProjects ? 'briefcase' : 'briefcase-outline'}
          size={21}
          color={isProjects ? BrandColors.primary : BrandColors.slate400}
        />
        <Text className={`text-[10px] mt-[3px] ${isProjects ? 'font-bold text-primary' : 'font-medium text-text-secondary'}`}>
          Dự án
        </Text>
      </TouchableOpacity>

      {/* 4. Customers */}
      {hasCustomerAccess && (
        <TouchableOpacity
          testID="customersTab"
          className="items-center justify-center flex-1 min-h-[48px] py-0.5"
          onPress={() => navigateTo('/customers')}
          activeOpacity={0.7}
        >
          <Ionicons
            name={isCustomers ? 'people' : 'people-outline'}
            size={21}
            color={isCustomers ? BrandColors.primary : BrandColors.slate400}
          />
          <Text className={`text-[10px] mt-[3px] ${isCustomers ? 'font-bold text-primary' : 'font-medium text-text-secondary'}`}>
            Khách hàng
          </Text>
        </TouchableOpacity>
      )}

      {/* 5. Profile */}
      <TouchableOpacity
        className="items-center justify-center flex-1 min-h-[48px] py-0.5"
        onPress={() => navigateTo('/profile')}
        activeOpacity={0.7}
      >
        <Ionicons
          name={isProfile ? 'person' : 'person-outline'}
          size={21}
          color={isProfile ? BrandColors.primary : BrandColors.slate400}
        />
        <Text className={`text-[10px] mt-[3px] ${isProfile ? 'font-bold text-primary' : 'font-medium text-text-secondary'}`}>
          Cá nhân
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const BottomNavBar = React.memo(BottomNavBarComponent);
export default BottomNavBar;
