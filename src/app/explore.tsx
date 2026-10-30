import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { BrandColors } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import BottomNavBar from '@/components/BottomNavBar';
import {
  canAccessCustomers,
  canAccessContracts,
  canAccessFinance,
  canAccessJobs,
  canAccessOpportunities,
  canAccessReferralPartners,
  canAccessServiceCatalog,
  canAccessTeams,
  canAccessUsers,
  canAccessVendors,
} from '@/utils/rbac';

const MODULES = [
  {
    id: 'projects',
    title: 'Quản lý Dự án',
    desc: 'Theo dõi dự án.',
    icon: 'briefcase-outline' as const,
    color: BrandColors.primary,
    badge: 'Cốt lõi',
  },
  {
    id: 'tasks',
    title: 'Công việc',
    desc: 'Quản lý công việc cá nhân, tiến độ thực hiện, giao task và cập nhật trạng thái.',
    icon: 'checkbox-outline' as const,
    color: '#F59E0B',
    badge: 'Công việc',
  },
  {
    id: 'opportunities',
    title: 'Cơ hội',
    desc: 'Theo dõi cơ hội.',
    icon: 'trending-up-outline' as const,
    color: '#8B5CF6',
    badge: 'Kinh doanh',
  },
  {
    id: 'customers',
    title: 'Khách hàng',
    desc: 'Hồ sơ khách hàng.',
    icon: 'people-outline' as const,
    color: '#10B981',
    badge: 'Kinh doanh',
  },
  {
    id: 'contracts',
    title: 'Hợp đồng & Phụ lục',
    desc: 'Quản lý danh sách hợp đồng và phụ lục phát sinh.',
    icon: 'document-text-outline' as const,
    color: '#3B82F6',
    badge: 'Pháp lý',
  },
  {
    id: 'acceptances',
    title: 'Yêu cầu Nghiệm thu',
    desc: 'Quản lý, tạo yêu cầu và phê duyệt các biên bản nghiệm thu',
    icon: 'checkmark-done-circle-outline' as const,
    color: '#059669',
    badge: 'Dự án',
  },
  {
    id: 'finance',
    title: 'Tài chính & Công nợ',
    desc: 'Theo dõi các đợt thanh toán, công nợ phải thu/phải trả và dòng tiền dự án.',
    icon: 'card-outline' as const,
    color: '#F59E0B',
    badge: 'Kế toán',
  },
  // {
  //   id: 'teams',
  //   title: 'Đội dự án',
  //   desc: 'Cơ cấu đội nhóm theo dự án, vai trò thành viên, tải công việc và Team Lead.',
  //   icon: 'people-circle-outline' as const,
  //   color: '#EC4899',
  //   badge: 'Nhân sự',
  // },
  {
    id: 'users',
    title: 'Nhân sự nội bộ',
    desc: 'Quản lý nhân sự.',
    icon: 'id-card-outline' as const,
    color: '#DB2777',
    badge: 'Nhân sự',
  },
  {
    id: 'services',
    title: 'Dịch vụ',
    desc: 'Danh mục dịch vụ.',
    icon: 'pricetags-outline' as const,
    color: '#0EA5E9',
    badge: 'Danh mục',
  },
  {
    id: 'service-packages',
    title: 'Gói dịch vụ',
    desc: 'Thiết kế và quản lý các gói dịch vụ.',
    icon: 'cube-outline' as const,
    color: '#8B5CF6',
    badge: 'Danh mục',
  },
  {
    id: 'jobs',
    title: 'Hạng mục công việc',
    desc: 'Thiết kế và quản lý các hạng mục công việc.',
    icon: 'list-outline' as const,
    color: '#14B8A6',
    badge: 'Danh mục',
  },
  {
    id: 'vendors',
    title: 'Vendors',
    desc: 'Quản lý vendor.',
    icon: 'storefront-outline' as const,
    color: '#F97316',
    badge: 'Đối tác',
  },
  {
    id: 'referral-partners',
    title: 'Đối tác giới thiệu',
    desc: 'Quản lý các đối tác.',
    icon: 'share-social-outline' as const,
    color: '#0891B2',
    badge: 'Đối tác',
  },
  {
    id: 'announcements',
    title: 'Bảng tin công ty',
    desc: 'Thông báo nội bộ.',
    icon: 'megaphone-outline' as const,
    color: '#6366F1',
    badge: 'Nội bộ',
  },
  {
    id: 'documents',
    title: 'Kho biểu mẫu & tài liệu',
    desc: 'Thư viện biểu mẫu.',
    icon: 'folder-open-outline' as const,
    color: '#64748B',
    badge: 'Tài liệu',
  },
  {
    id: 'notifications',
    title: 'Thông báo',
    desc: 'Danh sách thông báo.',
    icon: 'notifications-outline' as const,
    color: '#6366F1',
    badge: 'Real-time',
  },
  {
    id: 'chat',
    title: 'Trò chuyện',
    desc: 'Nhắn tin.',
    icon: 'chatbubbles-outline' as const,
    color: '#F38820',
    badge: 'Real-time',
  },
  {
    id: 'settings',
    title: 'Cài đặt hệ thống & QC',
    desc: 'Cấu hình bảo mật sinh trắc học, thông báo, AI QC đối chiếu sản phẩm và xóa bộ nhớ cache.',
    icon: 'settings-outline' as const,
    color: '#EA580C',
    badge: 'Hệ thống',
  },
  {
    id: 'profile',
    title: 'Hồ sơ cá nhân',
    desc: 'Quản lý thông tin tài khoản, vai trò cá nhân và cài đặt ứng dụng.',
    icon: 'person-outline' as const,
    color: '#10B981',
    badge: 'Tài khoản',
  },
];

export default function ExploreScreen() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();

  const handleModulePress = (moduleId: string) => {
    if (!isAuthenticated) {
      router.push('/(auth)/login');
      return;
    }

    const role = user?.role;

    switch (moduleId) {
      case 'projects':
        router.push('/projects' as any);
        break;

      case 'tasks':
        router.push('/tasks' as any);
        break;

      case 'opportunities':
        if (canAccessOpportunities(role)) {
          router.push('/opportunities' as any);
        } else {
          Alert.alert(
            'Giới hạn quyền truy cập',
            'Phân hệ Quản lý Cơ hội chỉ dành cho Ban giám đốc và Bộ phận Kinh doanh.'
          );
        }
        break;

      case 'customers':
        if (canAccessCustomers(role)) {
          router.push('/customers' as any);
        } else {
          Alert.alert(
            'Giới hạn quyền truy cập',
            'Phân hệ Khách hàng chỉ dành cho Ban giám đốc và Bộ phận Kinh doanh.'
          );
        }
        break;

      case 'contracts':
        if (canAccessContracts(role)) {
          router.push('/contracts' as any);
        } else {
          Alert.alert(
            'Giới hạn quyền truy cập',
            'Phân hệ Hợp đồng chỉ dành cho Ban giám đốc và Bộ phận Kinh doanh.'
          );
        }
        break;

      case 'acceptances':
        router.push('/acceptances' as any);
        break;

      case 'finance':
        if (canAccessFinance(role)) {
          router.push('/finance' as any);
        } else {
          Alert.alert(
            'Giới hạn quyền truy cập',
            'Phân hệ Tài chính chỉ dành cho Ban giám đốc và Bộ phận Kế toán.'
          );
        }
        break;

      case 'teams':
        router.push('/teams' as any);
        break;

      case 'users':
        if (canAccessUsers(role)) {
          router.push('/users' as any);
        } else {
          Alert.alert(
            'Giới hạn quyền truy cập',
            'Phân hệ Nhân sự nội bộ chỉ dành cho Ban giám đốc (BOD/ADMIN).'
          );
        }
        break;

      case 'services':
        if (canAccessServiceCatalog(role)) {
          router.push('/services' as any);
        } else {
          Alert.alert(
            'Giới hạn quyền truy cập',
            'Phân hệ Dịch vụ niêm yết chỉ dành cho Ban giám đốc và Bộ phận Kinh doanh.'
          );
        }
        break;

      case 'service-packages':
        if (canAccessServiceCatalog(role)) {
          router.push('/service-packages' as any);
        } else {
          Alert.alert(
            'Giới hạn quyền truy cập',
            'Phân hệ Gói dịch vụ chỉ dành cho Ban giám đốc và Bộ phận Kinh doanh.'
          );
        }
        break;

      case 'jobs':
        if (canAccessJobs(role)) {
          router.push('/jobs' as any);
        } else {
          Alert.alert(
            'Giới hạn quyền truy cập',
            'Phân hệ Hạng mục công việc chỉ dành cho Ban giám đốc, Kinh doanh và PM.'
          );
        }
        break;

      case 'vendors':
        if (canAccessVendors(role)) {
          router.push('/vendors' as any);
        } else {
          Alert.alert(
            'Giới hạn quyền truy cập',
            'Phân hệ Nhà cung cấp chỉ dành cho Ban giám đốc (BOD/ADMIN).'
          );
        }
        break;

      case 'referral-partners':
        if (canAccessReferralPartners(role)) {
          router.push('/referral-partners' as any);
        } else {
          Alert.alert(
            'Giới hạn quyền truy cập',
            'Phân hệ Đối tác giới thiệu chỉ dành cho Ban giám đốc và Bộ phận Kinh doanh.'
          );
        }
        break;

      case 'announcements':
        router.push('/announcements' as any);
        break;

      case 'documents':
        router.push('/documents' as any);
        break;

      case 'notifications':
        router.push('/notifications' as any);
        break;

      case 'chat':
        router.push('/chat' as any);
        break;

      case 'settings':
        router.push('/settings' as any);
        break;

      case 'profile':
        router.push('/profile' as any);
        break;

      default:
        break;
    }
  };

  const isModuleLocked = (moduleId: string): boolean => {
    if (!isAuthenticated) return false;
    const role = user?.role;
    if (moduleId === 'opportunities') return !canAccessOpportunities(role);
    if (moduleId === 'customers') return !canAccessCustomers(role);
    if (moduleId === 'contracts') return !canAccessContracts(role);
    if (moduleId === 'finance') return !canAccessFinance(role);
    // Phase P2 — Danh mục & Đối tác ngoài
    if (moduleId === 'services' || moduleId === 'service-packages') {
      return !canAccessServiceCatalog(role);
    }
    if (moduleId === 'vendors') return !canAccessVendors(role);
    if (moduleId === 'referral-partners') return !canAccessReferralPartners(role);
    // Phase P3 — Quản trị hành chính & nội bộ
    if (moduleId === 'teams' || moduleId === 'jobs') return !canAccessTeams(role);
    if (moduleId === 'users') return !canAccessUsers(role);
    return false;
  };

  // Filter modules to hide restricted ones for the current user role
  const visibleModules = MODULES.filter((item) => !isModuleLocked(item.id));

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      <ScrollView contentContainerClassName="px-[18px] pb-6" showsVerticalScrollIndicator={false}>
        {/* Header with Getvini Brand Emblem */}
        <View className="flex-row items-center justify-between py-[18px]">
          <View className="flex-1 pr-3">
            <Text className="text-[22px] font-extrabold text-slate-900">Hệ sinh thái ERP</Text>
            <Text className="mt-1 text-[13px] leading-[19px] text-slate-500">
              Toàn bộ các phân hệ chức năng chuyên sâu phục vụ chuyển đổi số doanh nghiệp
            </Text>
          </View>
          <View className="h-12 w-12 items-center justify-center rounded-2xl bg-white p-2 shadow-sm border border-slate-100">
            <Image
              source={require('@/assets/images/logo.png')}
              style={{ width: '100%', height: '100%' }}
              contentFit="contain"
            />
          </View>
        </View>

        {/* Auth prompt if not logged in */}
        {!isAuthenticated && (
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
                  Đăng nhập để xem và thao tác trên dữ liệu doanh nghiệp thực tế.
                </Text>
              </View>
            </View>
            <Ionicons name="arrow-forward" size={18} color={BrandColors.primary} />
          </TouchableOpacity>
        )}

        {/* Modules List */}
        <View className="gap-3">
          {visibleModules.map((item) => {
            return (
              <TouchableOpacity
                key={item.id}
                className="rounded-[18px] border border-slate-200 bg-white p-4"
                onPress={() => handleModulePress(item.id)}
                activeOpacity={0.75}
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
                      <View className="ml-1.5 rounded-md px-2 py-0.5" style={{ backgroundColor: item.color + '20' }}>
                        <Text className="text-[11px] font-bold" style={{ color: item.color }}>{item.badge}</Text>
                      </View>
                    </View>
                    <Text className="mt-0.5 text-xs leading-[18px] text-slate-500">{item.desc}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* Bottom Nav */}
      <BottomNavBar />
    </SafeAreaView>
  );
}
