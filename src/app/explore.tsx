import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { BrandColors } from '@/constants/colors';
import { useAuth } from '@/context/AuthContext';
import BottomNavBar from '@/components/BottomNavBar';
import {
  canAccessCustomers,
  canAccessContracts,
  canAccessFinance,
  canAccessOpportunities,
  isManagementRole,
} from '@/utils/rbac';

const MODULES = [
  {
    id: 'projects',
    title: 'Quản lý Dự án',
    desc: 'Theo dõi tiến độ Kanban, phân công công việc, xét duyệt và nghiệm thu nhiệm vụ.',
    icon: 'briefcase-outline' as const,
    color: BrandColors.primary,
    badge: 'Cốt lõi',
  },
  {
    id: 'tasks',
    title: 'Nhiệm vụ & Công việc',
    desc: 'Quản lý công việc cá nhân, tiến độ thực hiện, giao task và cập nhật trạng thái.',
    icon: 'checkbox-outline' as const,
    color: '#F59E0B',
    badge: 'Công việc',
  },
  {
    id: 'opportunities',
    title: 'Cơ hội & Pipeline',
    desc: 'Theo dõi phễu bán hàng, tỷ lệ thành công, báo giá và phê duyệt cơ hội BOD.',
    icon: 'trending-up-outline' as const,
    color: '#8B5CF6',
    badge: 'Kinh doanh',
  },
  {
    id: 'customers',
    title: 'Khách hàng & CRM',
    desc: 'Hồ sơ đối tác doanh nghiệp, lịch sử giao dịch và cơ hội hợp tác kinh doanh.',
    icon: 'people-outline' as const,
    color: '#10B981',
    badge: 'Kinh doanh',
  },
  {
    id: 'contracts',
    title: 'Hợp đồng & Phụ lục',
    desc: 'Quản lý danh sách hợp đồng, điều khoản thanh toán và phụ lục phát sinh.',
    icon: 'document-text-outline' as const,
    color: '#3B82F6',
    badge: 'Pháp lý',
  },
  {
    id: 'acceptances',
    title: 'Yêu cầu Nghiệm thu',
    desc: 'Quản lý, tạo yêu cầu và phê duyệt các biên bản nghiệm thu hạng mục dịch vụ dự án.',
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
  {
    id: 'teams',
    title: 'Đội ngũ & Nhân sự',
    desc: 'Phân quyền tài khoản (RBAC), phòng ban và đánh giá hiệu suất nhân viên.',
    icon: 'shield-checkmark-outline' as const,
    color: '#EC4899',
    badge: 'Nhân sự',
  },
  {
    id: 'notifications',
    title: 'Thông báo & SSE Live',
    desc: 'Nhận thông báo cập nhật công việc và tương tác theo thời gian thực.',
    icon: 'notifications-outline' as const,
    color: '#6366F1',
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
            'Phân hệ Quản lý Cơ hội & Pipeline chỉ dành cho Ban giám đốc và Bộ phận Kinh doanh.'
          );
        }
        break;

      case 'customers':
        if (canAccessCustomers(role)) {
          router.push('/customers' as any);
        } else {
          Alert.alert(
            'Giới hạn quyền truy cập',
            'Phân hệ Khách hàng & CRM chỉ dành cho Ban giám đốc và Bộ phận Kinh doanh.'
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
        if (isManagementRole(role)) {
          Alert.alert(
            'Phân hệ Đội ngũ & Nhân sự',
            'Tính năng quản lý thành viên đang được phát triển giao diện.'
          );
        } else {
          Alert.alert(
            'Giới hạn quyền truy cập',
            'Phân hệ Quản lý Đội ngũ chỉ dành cho Ban giám đốc.'
          );
        }
        break;

      case 'notifications':
        router.push('/notifications' as any);
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
    if (moduleId === 'teams') return !isManagementRole(role);
    return false;
  };

  // Filter modules to hide restricted ones for the current user role
  const visibleModules = MODULES.filter((item) => !isModuleLocked(item.id));

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      <ScrollView contentContainerClassName="px-[18px] pb-6" showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View className="py-[18px]">
          <Text className="text-[22px] font-extrabold text-slate-900">Hệ sinh thái ERP</Text>
          <Text className="mt-1.5 text-[13px] leading-[19px] text-slate-500">
            Toàn bộ các phân hệ chức năng chuyên sâu phục vụ chuyển đổi số doanh nghiệp
          </Text>
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
