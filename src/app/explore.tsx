import React, { useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import BottomNavBar from '@/components/BottomNavBar';
import { BrandColors } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import {
  canAccessAcceptance,
  canAccessContracts,
  canAccessCustomers,
  canAccessFinance,
  canAccessJobs,
  canAccessOpportunities,
  canAccessReferralPartners,
  canAccessServiceCatalog,
  canAccessSettings,
  canAccessTeams,
  canAccessUsers,
  canAccessVendors,
} from '@/utils/rbac';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface ModuleChild {
  id: string;
  title: string;
  route: string;
  icon: IconName;
}

interface ModuleItem {
  id: string;
  title: string;
  desc: string;
  icon: IconName;
  color: string;
  badge: string;
  route?: string;
  children?: ModuleChild[];
  utility?: boolean;
}

const MODULES: ModuleItem[] = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    desc: 'Tổng quan vận hành, công việc, dự án và các chỉ số theo vai trò.',
    icon: 'grid-outline',
    color: BrandColors.primary,
    badge: 'Tổng quan',
    route: '/',
  },
  {
    id: 'opportunities',
    title: 'Cơ hội',
    desc: 'Theo dõi phễu bán hàng, báo giá và phê duyệt cơ hội kinh doanh.',
    icon: 'trending-up-outline',
    color: '#8B5CF6',
    badge: 'Kinh doanh',
    route: '/opportunities',
  },
  {
    id: 'contracts',
    title: 'Hợp đồng',
    desc: 'Quản lý hợp đồng, điều khoản thanh toán và phụ lục phát sinh.',
    icon: 'document-text-outline',
    color: '#3B82F6',
    badge: 'Pháp lý',
    route: '/contracts',
  },
  {
    id: 'customers',
    title: 'Khách hàng',
    desc: 'Hồ sơ khách hàng, lịch sử giao dịch và cơ hội hợp tác.',
    icon: 'people-outline',
    color: '#10B981',
    badge: 'Kinh doanh',
    route: '/customers',
  },
  {
    id: 'projects',
    title: 'Dự án',
    desc: 'Theo dõi tiến độ, phân công, xét duyệt và nghiệm thu dự án.',
    icon: 'briefcase-outline',
    color: BrandColors.primary,
    badge: 'Cốt lõi',
    route: '/projects',
  },
  {
    id: 'tasks',
    title: 'Công việc',
    desc: 'Quản lý công việc cá nhân, giao việc và cập nhật trạng thái.',
    icon: 'checkbox-outline',
    color: '#F59E0B',
    badge: 'Công việc',
    route: '/tasks',
  },
  {
    id: 'acceptances',
    title: 'Nghiệm thu',
    desc: 'Tạo, theo dõi và phê duyệt các yêu cầu nghiệm thu dịch vụ.',
    icon: 'checkmark-done-circle-outline',
    color: '#059669',
    badge: 'Dự án',
    route: '/acceptances',
  },
  {
    id: 'payment-requests',
    title: 'Yêu cầu thanh toán',
    desc: 'Tạo và theo dõi đề xuất chi, tạm ứng và chứng từ thanh toán.',
    icon: 'wallet-outline',
    color: '#EA580C',
    badge: 'Thanh toán',
    route: '/payment-requests',
  },
  {
    id: 'payments',
    title: 'Thanh toán',
    desc: 'Tổng quan tài chính, nghiệm thu, hóa đơn VAT và lộ trình thanh toán.',
    icon: 'card-outline',
    color: '#D97706',
    badge: 'Tài chính',
    children: [
      { id: 'finance-overview', title: 'Tổng quan', route: '/finance/overview', icon: 'pie-chart-outline' },
      { id: 'acceptance-minutes', title: 'Biên bản nghiệm thu', route: '/finance/acceptance-minutes', icon: 'document-attach-outline' },
      { id: 'vat-invoices', title: 'Hóa đơn VAT', route: '/finance/vat-invoices', icon: 'receipt-outline' },
      { id: 'finance', title: 'Lộ trình thanh toán', route: '/finance', icon: 'cash-outline' },
    ],
  },
  {
    id: 'service-packages',
    title: 'Gói dịch vụ',
    desc: 'Gói combo dịch vụ theo mẫu, số lượng mặc định và giá vốn.',
    icon: 'cube-outline',
    color: '#8B5CF6',
    badge: 'Danh mục',
    route: '/service-packages',
  },
  {
    id: 'services',
    title: 'Dịch vụ',
    desc: 'Danh mục dịch vụ, cấu hình hạng mục và giá vốn tự động.',
    icon: 'pricetags-outline',
    color: '#0EA5E9',
    badge: 'Danh mục',
    route: '/services',
  },
  {
    id: 'jobs',
    title: 'Hạng mục công việc',
    desc: 'Giá vốn, Vinicoin, nhóm nghề và tiêu chí nghiệm thu QC.',
    icon: 'list-outline',
    color: '#14B8A6',
    badge: 'Danh mục',
    route: '/jobs',
  },
  {
    id: 'teams',
    title: 'Đội dự án',
    desc: 'Cơ cấu đội nhóm, vai trò thành viên, tải công việc và Team Lead.',
    icon: 'people-circle-outline',
    color: '#EC4899',
    badge: 'Nhân sự',
    route: '/teams',
  },
  {
    id: 'users',
    title: 'Nhân sự',
    desc: 'Danh bạ nhân sự, vai trò hệ thống, hợp đồng lao động và công việc.',
    icon: 'id-card-outline',
    color: '#DB2777',
    badge: 'Nhân sự',
    route: '/users',
  },
  {
    id: 'vendors',
    title: 'Vendor',
    desc: 'Hồ sơ nhà cung cấp và giá mua ngoài theo hạng mục.',
    icon: 'storefront-outline',
    color: '#F97316',
    badge: 'Đối tác',
    route: '/vendors',
  },
  {
    id: 'referral-partners',
    title: 'Đối tác',
    desc: 'Mạng lưới đối tác giới thiệu, hợp đồng và hoa hồng.',
    icon: 'share-social-outline',
    color: '#0891B2',
    badge: 'Đối tác',
    route: '/referral-partners',
  },
  {
    id: 'documents',
    title: 'Kho tài liệu',
    desc: 'Thư viện biểu mẫu, phiên bản và lịch sử tệp dùng chung.',
    icon: 'folder-open-outline',
    color: '#64748B',
    badge: 'Tài liệu',
    route: '/documents',
  },
  {
    id: 'settings',
    title: 'Cài đặt',
    desc: 'Cấu hình hệ thống, bảo mật, thông báo và kiểm soát chất lượng.',
    icon: 'settings-outline',
    color: '#EA580C',
    badge: 'Hệ thống',
    route: '/settings',
  },
  {
    id: 'announcements',
    title: 'Bảng tin công ty',
    desc: 'Thông báo nội bộ, sự kiện, bình luận và thống kê người đã đọc.',
    icon: 'megaphone-outline',
    color: '#6366F1',
    badge: 'Nội bộ',
    route: '/announcements',
    utility: true,
  },
  {
    id: 'notifications',
    title: 'Thông báo',
    desc: 'Nhận cập nhật công việc và tương tác theo thời gian thực.',
    icon: 'notifications-outline',
    color: '#6366F1',
    badge: 'Real-time',
    route: '/notifications',
    utility: true,
  },
  {
    id: 'profile',
    title: 'Hồ sơ cá nhân',
    desc: 'Quản lý thông tin tài khoản và cài đặt ứng dụng cá nhân.',
    icon: 'person-outline',
    color: '#10B981',
    badge: 'Tài khoản',
    route: '/profile',
    utility: true,
  },
];

export default function ExploreScreen() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const [expandedModuleId, setExpandedModuleId] = useState<string | null>(null);

  const isModuleVisible = (moduleId: string): boolean => {
    if (!isAuthenticated) return true;
    const role = user?.role;
    if (moduleId === 'opportunities') return canAccessOpportunities(role);
    if (moduleId === 'contracts') return canAccessContracts(role);
    if (moduleId === 'customers') return canAccessCustomers(role);
    if (moduleId === 'acceptances') return canAccessAcceptance(role);
    if (moduleId === 'payments') return canAccessFinance(role);
    if (moduleId === 'services' || moduleId === 'service-packages') return canAccessServiceCatalog(role);
    if (moduleId === 'jobs') return canAccessJobs(role);
    if (moduleId === 'teams') return canAccessTeams(role);
    if (moduleId === 'users') return canAccessUsers(role);
    if (moduleId === 'vendors') return canAccessVendors(role);
    if (moduleId === 'referral-partners') return canAccessReferralPartners(role);
    if (moduleId === 'settings') return canAccessSettings(role);
    return true;
  };

  const visibleModules = MODULES.filter((item) => isModuleVisible(item.id));
  const firstUtilityIndex = visibleModules.findIndex((item) => item.utility);

  const navigateTo = (route: string) => {
    if (!isAuthenticated) {
      router.push('/(auth)/login');
      return;
    }
    if (route === '/') {
      router.replace('/');
      return;
    }
    router.push(route as any);
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      <ScrollView contentContainerClassName="px-[18px] pb-6" showsVerticalScrollIndicator={false}>
        <View className="py-[18px]">
          <Text className="text-[22px] font-extrabold text-slate-900">Hệ sinh thái ERP</Text>
          <Text className="mt-1.5 text-[13px] leading-[19px] text-slate-500">
            Các phân hệ được đồng bộ theo quyền truy cập trên hệ thống Web
          </Text>
        </View>

        {!isAuthenticated ? (
          <TouchableOpacity
            className="mb-4 flex-row items-center justify-between rounded-2xl border-[1.5px] border-orange-200 bg-orange-50 p-3.5"
            onPress={() => router.push('/(auth)/login')}
            activeOpacity={0.85}
          >
            <View className="flex-1 flex-row items-center gap-3">
              <Ionicons name="lock-closed" size={20} color={BrandColors.primary} />
              <View className="flex-1">
                <Text className="text-sm font-bold text-primary-dark">Yêu cầu đăng nhập</Text>
                <Text className="mt-0.5 text-xs text-slate-600">
                  Đăng nhập để xem các phân hệ đúng với vai trò của bạn.
                </Text>
              </View>
            </View>
            <Ionicons name="arrow-forward" size={18} color={BrandColors.primary} />
          </TouchableOpacity>
        ) : null}

        <View className="gap-3">
          {visibleModules.map((item, index) => {
            const isExpanded = expandedModuleId === item.id;
            return (
              <React.Fragment key={item.id}>
                {index === firstUtilityIndex ? (
                  <View className="pb-0.5 pt-3">
                    <Text className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                      Tiện ích mobile
                    </Text>
                  </View>
                ) : null}

                <View className="overflow-hidden rounded-[18px] border border-slate-200 bg-white">
                  <TouchableOpacity
                    className="p-4"
                    onPress={() => {
                      if (item.children) {
                        setExpandedModuleId((current) => current === item.id ? null : item.id);
                      } else if (item.route) {
                        navigateTo(item.route);
                      }
                    }}
                    activeOpacity={0.75}
                    accessibilityRole="button"
                    accessibilityState={item.children ? { expanded: isExpanded } : undefined}
                  >
                    <View className="flex-row items-start gap-3.5">
                      <View
                        className="h-12 w-12 items-center justify-center rounded-[14px]"
                        style={{ backgroundColor: item.color + '15' }}
                      >
                        <Ionicons name={item.icon} size={24} color={item.color} />
                      </View>
                      <View className="flex-1">
                        <View className="mb-1 flex-row items-center justify-between">
                          <Text className="flex-1 text-[15px] font-bold text-slate-900">{item.title}</Text>
                          <View className="ml-1.5 flex-row items-center gap-1.5">
                            <View className="rounded-md px-2 py-0.5" style={{ backgroundColor: item.color + '20' }}>
                              <Text className="text-[11px] font-bold" style={{ color: item.color }}>{item.badge}</Text>
                            </View>
                            {item.children ? (
                              <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={17} color="#94A3B8" />
                            ) : null}
                          </View>
                        </View>
                        <Text className="mt-0.5 text-xs leading-[18px] text-slate-500">{item.desc}</Text>
                      </View>
                    </View>
                  </TouchableOpacity>

                  {item.children && isExpanded ? (
                    <View className="border-t border-slate-100 bg-slate-50 px-3 py-2">
                      {item.children.map((child) => (
                        <TouchableOpacity
                          key={child.id}
                          className="min-h-[48px] flex-row items-center gap-3 rounded-xl px-3 py-2.5"
                          onPress={() => navigateTo(child.route)}
                          activeOpacity={0.7}
                        >
                          <View className="h-9 w-9 items-center justify-center rounded-xl bg-white">
                            <Ionicons name={child.icon} size={18} color={item.color} />
                          </View>
                          <Text className="flex-1 text-[13px] font-bold text-slate-700">{child.title}</Text>
                          <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
                        </TouchableOpacity>
                      ))}
                    </View>
                  ) : null}
                </View>
              </React.Fragment>
            );
          })}
        </View>
      </ScrollView>

      <BottomNavBar />
    </SafeAreaView>
  );
}
