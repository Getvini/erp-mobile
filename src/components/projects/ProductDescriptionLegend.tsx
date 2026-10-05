import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Share } from 'react-native';
import { Feather } from '@expo/vector-icons';

const PIPELINE = [
  { title: 'Upload', body: 'Chọn file .pdf hoặc .docx cho từng sản phẩm.' },
  { title: 'Trích xuất chữ', body: 'Hệ thống đọc chữ trong file và đưa vào ô "Nội dung trích xuất".' },
  { title: 'Bạn kiểm tra và sửa', body: 'Nội dung trong ô này mới là bản chuẩn, không phải file gốc.' },
  { title: 'PM duyệt', body: 'Chỉ PM phụ trách duyệt. Mỗi lần duyệt tạo một phiên bản mới.' },
  { title: 'QC đối chiếu', body: 'QC luôn dùng phiên bản đã duyệt mới nhất của dự án.' },
];

const QC_USES = [
  'Tên sản phẩm',
  'Nội dung trích xuất (đúng như đang hiển thị sau khi bạn sửa)',
  'Chú thích (viết yêu cầu "phải nêu…" ở đây nếu cần)',
];

const QC_IGNORES = [
  'File gốc đã upload (chỉ để lưu trữ và xem lại)',
  'Tài liệu bổ sung (chỉ để tham khảo, QC không đọc)',
  'Hình ảnh nằm trong file, trừ trang PDF là ảnh/scan nguyên trang',
  'Nội dung ở header, footer, text box của file Word',
];

const CHECK_TYPES = [
  {
    label: 'Sai giá trị',
    body: 'Số liệu, tên, thuộc tính, điều kiện hoặc phạm vi khác với bản chuẩn, hoặc nói quá mức bản chuẩn cho phép.',
  },
  {
    label: 'Dễ gây hiểu nhầm',
    body: 'Đúng chữ nhưng người xem dễ hiểu thành điều khác, ví dụ bỏ điều kiện khuyến mãi hoặc gán ưu đãi sang sản phẩm khác.',
  },
  {
    label: 'Thiếu thông tin bắt buộc',
    body: 'Bản chuẩn ghi rõ "phải nêu" một điều kiện hoặc khuyến cáo, nhưng kịch bản nói về chủ đề đó mà không nêu.',
  },
  {
    label: 'Chưa đối chiếu được',
    body: 'Kịch bản nhắc đến nội dung không có trong bản chuẩn. Đây không phải lỗi, nhưng QC không có căn cứ để kết luận.',
  },
];

const WARNINGS = [
  {
    sign: 'File có nhiều cột/bảng phức tạp…',
    meaning: 'File có bảng hoặc dòng chia từ 3 cột trở lên. Mọi file có bảng đều hiện cảnh báo này.',
    action: 'Đọc lại từng dòng, đặc biệt thuộc tính nào đang thuộc sản phẩm nào.',
  },
  {
    sign: 'Trang N: chữ không đọc rõ / cần kiểm tra',
    meaning: 'AI đọc ảnh nhưng không chắc. Phần không rõ bị bỏ khỏi nội dung, không được đoán.',
    action: 'Mở file gốc, bổ sung phần còn thiếu bằng tay.',
  },
  {
    sign: 'Chỉ xử lý 80 trang đầu / Trang bị bỏ qua',
    meaning: 'Các trang vượt giới hạn không được đọc, nên không có trong bản chuẩn.',
    action: 'Cắt file theo sản phẩm hoặc chỉ giữ trang cần thiết rồi upload lại.',
  },
  {
    sign: 'AI đã loại N dòng',
    meaning: 'Sau khi bấm AI formatting, AI bỏ các dòng nó cho là watermark hoặc không liên quan. AI không sửa chữ.',
    action: 'Mở danh sách dòng bị loại, nếu có thông tin sản phẩm thì bấm Hủy và không áp dụng.',
  },
];

const EXTERNAL_AI_PROMPT = [
  'Bạn là công cụ chuyển đổi tài liệu, không phải biên tập viên. Đọc tài liệu đính kèm và chép lại toàn bộ thông tin mô tả sản phẩm thành văn bản thuần.',
  '',
  'Quy tắc:',
  '1. Chép nguyên văn từng chữ, từng con số, đơn vị và dấu phân cách (1.200 khác 1,2). Không tóm tắt, không diễn giải, không dịch, không sửa chính tả.',
  '2. Mỗi sản phẩm một khối riêng, bắt đầu bằng tên sản phẩm. Thuộc tính viết dạng "Tên thuộc tính: giá trị", mỗi thuộc tính một dòng.',
  '3. Không chuyển thuộc tính của sản phẩm này sang sản phẩm khác. Nếu không chắc thuộc sản phẩm nào, ghi [KHÔNG CHẮC: ...].',
  '4. Chữ không đọc rõ thì ghi [KHÔNG RÕ], tuyệt đối không đoán.',
  '5. Giữ nguyên điều kiện, thời hạn, khuyến cáo đi kèm giá hoặc khuyến mãi.',
  '6. Bỏ watermark, số trang, header, footer, logo. Không thêm nhận xét.',
].join('\n');

const CHECKLIST = [
  'Đọc lại từng con số: giá, %, dung tích, hạn dùng, điều kiện và thời hạn khuyến mãi.',
  'Mỗi sản phẩm một mục riêng, thuộc tính không bị lẫn sang sản phẩm bên cạnh.',
  'Không còn dấu [KHÔNG RÕ] hoặc [KHÔNG CHẮC] trong nội dung.',
  'Điều kiện hoặc khuyến cáo bắt buộc khi truyền thông đã được viết rõ (ví dụ "Phải nêu: …").',
  'Nếu dùng AI formatting, đã mở danh sách dòng bị loại và không mất thông tin cần thiết.',
];

const BEST_PRACTICES = [
  'Soạn file .docx chỉ gồm chữ, mỗi sản phẩm một khối, thuộc tính viết dạng "Tên thuộc tính: giá trị".',
  'Chỉ upload file .pdf hoặc .docx. File .doc cũ cần lưu lại thành .docx trước.',
  'Nếu dùng bảng, điền "—" vào ô trống. Hệ thống bỏ ô trống khi đọc, các giá trị còn lại có thể bị dồn sang sai cột.',
  'Mỗi sản phẩm một mục riêng trong form. Không dồn nhiều sản phẩm vào một file khi chúng có thuộc tính khác nhau.',
];

const EXTERNAL_AI_TIPS = [
  'Dùng AI ngoài (ChatGPT, Claude, Gemini…) để chép tài liệu thành văn bản, lưu thành .docx hoặc .pdf rồi mới upload.',
  'Yêu cầu AI chép nguyên văn, không tóm tắt. Dùng prompt mẫu bên dưới.',
  'AI ngoài cũng có thể đọc sai số. Luôn đối chiếu lại các con số với tài liệu gốc trước khi gửi duyệt.',
];

const AVOID = [
  'PDF scan mờ, ảnh chụp màn hình hoặc chụp bằng điện thoại.',
  'Thông tin quan trọng chỉ nằm trong hình minh họa của trang có chữ. Hệ thống không đọc ảnh trong các trang này.',
  'Trang nhiều cột hoặc nhiều khối đè lên ảnh nền, vì thứ tự đọc dễ bị đảo.',
];

function LegendSection({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <View className="border-t border-blue-100">
      <TouchableOpacity
        onPress={() => setOpen((prev) => !prev)}
        className="flex-row items-center justify-between gap-2 px-3 py-2.5"
        activeOpacity={0.7}
      >
        <Text className="text-xs font-bold text-slate-900 flex-1">{title}</Text>
        <Feather name={open ? 'chevron-up' : 'chevron-down'} size={14} color="#64748B" />
      </TouchableOpacity>
      {open && <View className="px-3 pb-3 gap-2">{children}</View>}
    </View>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <View className="gap-1">
      {items.map((item) => (
        <View key={item} className="flex-row items-start gap-1.5">
          <Text className="text-[11px] text-slate-700">•</Text>
          <Text className="text-[11px] text-slate-700 flex-1 leading-4">{item}</Text>
        </View>
      ))}
    </View>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <View className="rounded-lg border border-slate-200 p-2.5 gap-1.5">{children}</View>;
}

export default function ProductDescriptionLegend({ defaultOpen = false }: { defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);

  const sharePrompt = () => {
    Share.share({ message: EXTERNAL_AI_PROMPT }).catch(() => undefined);
  };

  return (
    <View className="mb-3 overflow-hidden rounded-xl border border-blue-200 bg-blue-50/40">
      <TouchableOpacity
        onPress={() => setOpen((prev) => !prev)}
        className="flex-row items-center gap-2 px-3 py-2.5"
        activeOpacity={0.7}
      >
        <Feather name="info" size={15} color="#2563EB" />
        <Text className="text-xs font-bold text-blue-800 flex-1 leading-4">
          Chú giải: thông tin chuẩn được QC dùng như thế nào và cách chuẩn bị file
        </Text>
        <Feather name={open ? 'chevron-up' : 'chevron-down'} size={15} color="#3B82F6" />
      </TouchableOpacity>

      {open && (
        <View className="bg-white">
          <LegendSection title="Luồng xử lý" defaultOpen>
            {PIPELINE.map((step, index) => (
              <View key={step.title} className="flex-row items-start gap-2">
                <View className="w-4 h-4 mt-0.5 rounded-full bg-blue-100 items-center justify-center">
                  <Text className="text-[10px] font-bold text-blue-700">{index + 1}</Text>
                </View>
                <Text className="text-[11px] text-slate-700 flex-1 leading-4">
                  <Text className="font-bold text-slate-900">{step.title}.</Text> {step.body}
                </Text>
              </View>
            ))}
          </LegendSection>

          <LegendSection title="QC đọc gì từ bản chuẩn">
            <View className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-2.5 gap-1.5">
              <View className="flex-row items-center gap-1.5">
                <Feather name="check-circle" size={13} color="#047857" />
                <Text className="text-[11px] font-bold text-emerald-700">QC dùng</Text>
              </View>
              <BulletList items={QC_USES} />
            </View>
            <View className="rounded-lg border border-rose-200 bg-rose-50/50 p-2.5 gap-1.5">
              <View className="flex-row items-center gap-1.5">
                <Feather name="x-circle" size={13} color="#BE123C" />
                <Text className="text-[11px] font-bold text-rose-700">QC không dùng</Text>
              </View>
              <BulletList items={QC_IGNORES} />
            </View>
            <Text className="text-[11px] text-slate-500 leading-4">
              Vì QC chỉ đọc chữ, một con số sai hoặc thiếu ở đây sẽ làm QC báo nhầm hoặc bỏ sót lỗi ở kịch bản.
              Sửa bản chuẩn sau khi đã duyệt thì phải gửi duyệt lại; QC tiếp tục dùng phiên bản cũ cho đến khi bản mới được duyệt.
            </Text>
          </LegendSection>

          <LegendSection title="QC đối chiếu theo ý nghĩa, không dò chữ trùng khớp">
            {CHECK_TYPES.map((item) => (
              <Text key={item.label} className="text-[11px] text-slate-700 leading-4">
                <Text className="font-bold text-slate-900">{item.label}.</Text> {item.body}
              </Text>
            ))}
            <Text className="text-[11px] text-slate-500 leading-4">
              Cách viết khác nhau nhưng cùng nghĩa (20% và 20 phần trăm, 500ml và 0,5l, khác ngôn ngữ) không bị tính là lỗi.
              Các con số trong kịch bản mà bản chuẩn không có sẽ được đánh dấu để QC soát từng số.
            </Text>
          </LegendSection>

          <LegendSection title="Cảnh báo bạn có thể gặp sau khi upload">
            {WARNINGS.map((item) => (
              <View
                key={item.sign}
                className="flex-row items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5"
              >
                <Feather name="alert-triangle" size={13} color="#D97706" style={{ marginTop: 2 }} />
                <View className="flex-1 gap-0.5">
                  <Text className="text-[11px] font-bold text-amber-800 leading-4">{item.sign}</Text>
                  <Text className="text-[11px] text-slate-700 leading-4">{item.meaning}</Text>
                  <Text className="text-[11px] text-amber-800 leading-4">
                    <Text className="font-bold">Cần làm:</Text> {item.action}
                  </Text>
                </View>
              </View>
            ))}
          </LegendSection>

          <LegendSection title="Khuyến nghị để QC chính xác nhất">
            <Card>
              <View className="flex-row items-center gap-1.5">
                <Feather name="file-text" size={13} color="#059669" />
                <Text className="text-[11px] font-bold text-slate-900 flex-1 leading-4">
                  Cách tốt nhất: tự soạn tay hoặc chuẩn hóa file trước khi upload
                </Text>
              </View>
              <BulletList items={BEST_PRACTICES} />
            </Card>

            <Card>
              <View className="flex-row items-center gap-1.5">
                <Feather name="zap" size={13} color="#059669" />
                <Text className="text-[11px] font-bold text-slate-900 flex-1 leading-4">
                  Tài liệu gốc là ảnh, slide, Excel hoặc brochure nhiều cột: nhờ AI bên ngoài chuyển sang văn bản
                </Text>
              </View>
              <BulletList items={EXTERNAL_AI_TIPS} />

              <View className="rounded-lg border border-slate-200 bg-slate-50">
                <View className="flex-row items-center justify-between gap-2 border-b border-slate-200 px-2.5 py-1.5">
                  <Text className="text-[11px] font-bold text-slate-600">Prompt mẫu cho AI ngoài</Text>
                  <TouchableOpacity
                    onPress={sharePrompt}
                    className="flex-row items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1"
                    activeOpacity={0.7}
                  >
                    <Feather name="share-2" size={11} color="#334155" />
                    <Text className="text-[11px] font-bold text-slate-700">Chia sẻ</Text>
                  </TouchableOpacity>
                </View>
                <Text selectable className="px-2.5 py-2 text-[11px] text-slate-700 leading-4">
                  {EXTERNAL_AI_PROMPT}
                </Text>
              </View>
            </Card>

            <Card>
              <Text className="text-[11px] font-bold text-slate-900">Nên tránh</Text>
              <BulletList items={AVOID} />
            </Card>
          </LegendSection>

          <LegendSection title="Trước khi bấm gửi duyệt">
            {CHECKLIST.map((item) => (
              <View key={item} className="flex-row items-start gap-2">
                <Feather name="check-circle" size={13} color="#059669" style={{ marginTop: 2 }} />
                <Text className="text-[11px] text-slate-700 flex-1 leading-4">{item}</Text>
              </View>
            ))}
          </LegendSection>
        </View>
      )}
    </View>
  );
}
