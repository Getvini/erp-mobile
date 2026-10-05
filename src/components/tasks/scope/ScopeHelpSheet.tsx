import React from 'react';
import { ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

interface HelpSection {
  title: string;
  lines: string[];
}

const SECTIONS: HelpSection[] = [
  {
    title: 'Cách chọn phạm vi quét',
    lines: [
      'Mỗi kịch bản và mỗi vùng tự chọn đều có một mã định danh nhỏ ở góc ô đầu tiên trên bảng (ví dụ R5C1, K1).',
      'Chọn kịch bản: chạm vào kịch bản để bật/tắt việc quét.',
      'Vẽ vùng: kéo trên bảng để tạo vùng mới (mã K1, K2...). Dùng chế độ Mở rộng để nới một vùng hoặc kịch bản có sẵn thay vì tạo cái mới.',
    ],
  },
  {
    title: 'Ba công cụ',
    lines: [
      'Chọn kịch bản: chạm vào kịch bản trên bảng để bật/tắt quét.',
      'Vẽ vùng: kéo một ngón để tạo hoặc mở rộng vùng quét tự chọn. Có thể chạm ô đầu rồi chạm ô cuối. Khi đang vẽ, bảng không cuộn được, hãy dùng các nút mũi tên hoặc chuyển sang Chỉ xem.',
      'Chỉ xem: duyệt bảng, không thay đổi gì.',
    ],
  },
  {
    title: 'Vùng mới hay mở rộng?',
    lines: [
      'Vùng mới: mỗi lần vẽ tạo một vùng riêng, có mã định danh mới (K1, K2...). Đây là mặc định.',
      'Mở rộng vùng: vùng vừa vẽ được gộp vào vùng đang chọn. Nếu chưa chọn vùng nào, hãy bắt đầu kéo từ bên trong vùng hoặc kịch bản cần nới; kịch bản gốc sẽ được thay bằng vùng mở rộng.',
    ],
  },
  {
    title: 'Danh sách kịch bản',
    lines: [
      'Mã nhỏ bên trái (ví dụ R5C1) là định danh của kịch bản, cũng hiện ở góc ô đầu tiên trên bảng.',
      'Chạm vào tên để nhảy tới kịch bản trên bảng.',
      'Nhấn giữ một kịch bản để chỉ giữ lại kịch bản này trong sheet, hoặc chọn/bỏ cả dải kịch bản liên tiếp tính từ kịch bản vừa chạm.',
      'Chọn hết và Bỏ chọn hết áp dụng cho tất cả kịch bản của sheet đang xem.',
    ],
  },
  {
    title: 'Vùng tự chọn',
    lines: [
      'Mỗi vùng có một mã cố định (K1, K2...) dùng để nhận diện vùng trong kết quả chính tả và QC.',
      'Chạm vào một vùng trên bảng ở công cụ Vẽ vùng để chọn nó, sau đó sửa toạ độ trực tiếp để mở rộng hoặc thu hẹp, hoặc vẽ thêm ở chế độ Mở rộng.',
      'Vùng ghi Mở rộng từ kịch bản đang thay thế kịch bản gốc, kịch bản đó sẽ không bị quét hai lần.',
      'Nhập toạ độ dạng A1:D20 hoặc Sheet1!A1:D20 rồi bấm Thêm để tạo vùng mà không cần vẽ.',
    ],
  },
  {
    title: 'Thao tác nhanh',
    lines: [
      'Hoàn tác và Làm lại: hai nút ở thanh công cụ, tối đa 50 bước.',
      'Xoá vùng: nút thùng rác ở hàng vùng.',
      'Đổi sheet: thanh tab phía trên bảng, vuốt ngang để xem thêm.',
      'Đóng: nút X hoặc nút quay lại của hệ điều hành. Nếu đang chọn một vùng, quay lại lần đầu sẽ bỏ chọn vùng.',
    ],
  },
];

interface ScopeHelpSheetProps {
  visible: boolean;
  onClose: () => void;
}

export default function ScopeHelpSheet({ visible, onClose }: ScopeHelpSheetProps) {
  if (!visible) return null;
  return (
    <View className="absolute inset-0 z-30 bg-slate-900/40 justify-end">
      <TouchableOpacity className="flex-1" activeOpacity={1} onPress={onClose} accessibilityLabel="Đóng hướng dẫn" />
      <View className="bg-surface rounded-t-3xl max-h-[80%] px-5 pt-4 pb-6">
        <View className="flex-row items-center justify-between pb-3">
          <Text className="text-base font-extrabold text-text-primary">Hướng dẫn</Text>
          <TouchableOpacity
            onPress={onClose}
            accessibilityLabel="Đóng hướng dẫn"
            className="w-10 h-10 items-center justify-center"
          >
            <Feather name="x" size={20} color="#64748b" />
          </TouchableOpacity>
        </View>
        <ScrollView>
          {SECTIONS.map((section) => (
            <View key={section.title} className="pb-4 gap-1.5">
              <Text className="text-sm font-bold text-text-primary">{section.title}</Text>
              {section.lines.map((line) => (
                <Text key={line} className="text-xs leading-5 text-text-secondary">
                  {line}
                </Text>
              ))}
            </View>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}
