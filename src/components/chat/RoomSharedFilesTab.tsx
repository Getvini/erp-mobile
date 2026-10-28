import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Image,
  StyleSheet,
  Linking,
  Dimensions,
  Modal,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ChatMessage, ChatAttachment } from '@/services/chatService';
import { BrandColors } from '@/constants/colors';
import { formatDateToDDMMYYYY } from '@/utils/formatters';
import { getFileNameFromUrl } from '@/utils/fileDetector';

interface RoomSharedFilesTabProps {
  messages: ChatMessage[];
}

type SubTab = 'media' | 'files' | 'links';

interface ExtractedLink {
  id: string;
  url: string;
  senderName: string;
  createdAt: string;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const GRID_ITEM_SIZE = (SCREEN_WIDTH - 48) / 3;

export const RoomSharedFilesTab: React.FC<RoomSharedFilesTabProps> = ({ messages }) => {
  const [activeTab, setActiveTab] = useState<SubTab>('media');
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // 1. Phân loại hình ảnh / video
  const mediaList = useMemo(() => {
    const list: { id: string; url: string; name?: string; createdAt: string }[] = [];
    messages.forEach((msg) => {
      if (msg.attachments && msg.attachments.length > 0) {
        msg.attachments.forEach((att, idx) => {
          const isImg =
            att.type === 'image' ||
            /\.(png|jpe?g|webp|gif)$/i.test(att.name || att.url || '') ||
            (att.type && att.type.startsWith('image/'));
          if (isImg && att.url) {
            list.push({
              id: `${msg.id}_${idx}`,
              url: att.url,
              name: att.name,
              createdAt: msg.createdAt,
            });
          }
        });
      }
    });
    return list;
  }, [messages]);

  // 2. Phân loại tài liệu
  const filesList = useMemo(() => {
    const list: {
      id: string;
      url: string;
      name: string;
      size?: number;
      type?: string;
      senderName: string;
      createdAt: string;
    }[] = [];

    messages.forEach((msg) => {
      if (msg.attachments && msg.attachments.length > 0) {
        msg.attachments.forEach((att, idx) => {
          const isImg =
            att.type === 'image' ||
            /\.(png|jpe?g|webp|gif)$/i.test(att.name || att.url || '') ||
            (att.type && att.type.startsWith('image/'));
          if (!isImg && att.url) {
            list.push({
              id: `${msg.id}_${idx}`,
              url: att.url,
              name: getFileNameFromUrl(att.url, att.name),
              size: att.size,
              type: att.type,
              senderName: msg.sender?.fullName || 'Thành viên',
              createdAt: msg.createdAt,
            });
          }
        });
      }
    });
    return list;
  }, [messages]);

  // 3. Phân loại đường dẫn web (Links)
  const linksList = useMemo(() => {
    const list: ExtractedLink[] = [];
    const urlRegex = /(https?:\/\/[^\s]+)/gi;

    messages.forEach((msg) => {
      if (msg.content) {
        const matches = msg.content.match(urlRegex);
        if (matches) {
          matches.forEach((u, idx) => {
            list.push({
              id: `${msg.id}_link_${idx}`,
              url: u,
              senderName: msg.sender?.fullName || 'Thành viên',
              createdAt: msg.createdAt,
            });
          });
        }
      }
    });
    return list;
  }, [messages]);

  const handleOpenUrl = (url: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Linking.openURL(url).catch(() => {});
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <View style={styles.container}>
      {/* Tab Switcher */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'media' && styles.tabItemActive]}
          onPress={() => {
            Haptics.selectionAsync();
            setActiveTab('media');
          }}
        >
          <Feather
            name="image"
            size={16}
            color={activeTab === 'media' ? BrandColors.primary : '#64748B'}
          />
          <Text
            style={[styles.tabLabel, activeTab === 'media' && styles.tabLabelActive]}
          >
            Ảnh ({mediaList.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'files' && styles.tabItemActive]}
          onPress={() => {
            Haptics.selectionAsync();
            setActiveTab('files');
          }}
        >
          <Feather
            name="file-text"
            size={16}
            color={activeTab === 'files' ? BrandColors.primary : '#64748B'}
          />
          <Text
            style={[styles.tabLabel, activeTab === 'files' && styles.tabLabelActive]}
          >
            Tài liệu ({filesList.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabItem, activeTab === 'links' && styles.tabItemActive]}
          onPress={() => {
            Haptics.selectionAsync();
            setActiveTab('links');
          }}
        >
          <Feather
            name="link"
            size={16}
            color={activeTab === 'links' ? BrandColors.primary : '#64748B'}
          />
          <Text
            style={[styles.tabLabel, activeTab === 'links' && styles.tabLabelActive]}
          >
            Liên kết ({linksList.length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      <View style={styles.content}>
        {activeTab === 'media' && (
          mediaList.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Feather name="image" size={40} color="#CBD5E1" />
              <Text style={styles.emptyText}>Chưa có hình ảnh nào được gửi</Text>
            </View>
          ) : (
            <FlatList
              data={mediaList}
              keyExtractor={(item) => item.id}
              numColumns={3}
              scrollEnabled={false}
              contentContainerStyle={styles.mediaGrid}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.gridThumbWrap}
                  activeOpacity={0.8}
                  onPress={() => setPreviewImage(item.url)}
                >
                  <Image source={{ uri: item.url }} style={styles.gridThumb} />
                </TouchableOpacity>
              )}
            />
          )
        )}

        {activeTab === 'files' && (
          filesList.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Feather name="file-text" size={40} color="#CBD5E1" />
              <Text style={styles.emptyText}>Chưa có tài liệu đính kèm nào</Text>
            </View>
          ) : (
            <FlatList
              data={filesList}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.fileRow}
                  activeOpacity={0.7}
                  onPress={() => handleOpenUrl(item.url)}
                >
                  <View style={styles.fileIconWrap}>
                    <Feather name="file" size={20} color={BrandColors.primary} />
                  </View>
                  <View style={styles.fileInfo}>
                    <Text style={styles.fileName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.fileMeta}>
                      {item.senderName} • {formatFileSize(item.size)} •{' '}
                      {formatDateToDDMMYYYY(item.createdAt)}
                    </Text>
                  </View>
                  <Feather name="download" size={18} color="#94A3B8" />
                </TouchableOpacity>
              )}
            />
          )
        )}

        {activeTab === 'links' && (
          linksList.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Feather name="link-2" size={40} color="#CBD5E1" />
              <Text style={styles.emptyText}>Chưa có liên kết web nào</Text>
            </View>
          ) : (
            <FlatList
              data={linksList}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.linkRow}
                  activeOpacity={0.7}
                  onPress={() => handleOpenUrl(item.url)}
                >
                  <View style={styles.linkIconWrap}>
                    <Feather name="globe" size={18} color="#0284C7" />
                  </View>
                  <View style={styles.linkInfo}>
                    <Text style={styles.linkUrl} numberOfLines={1}>
                      {item.url}
                    </Text>
                    <Text style={styles.linkMeta}>
                      Gửi bởi {item.senderName} • {formatDateToDDMMYYYY(item.createdAt)}
                    </Text>
                  </View>
                  <Feather name="external-link" size={16} color="#94A3B8" />
                </TouchableOpacity>
              )}
            />
          )
        )}
      </View>

      {/* Image Preview Modal */}
      <Modal visible={!!previewImage} transparent animationType="fade">
        <View style={styles.previewBackdrop}>
          <TouchableOpacity
            style={styles.previewCloseBtn}
            onPress={() => setPreviewImage(null)}
          >
            <Feather name="x" size={26} color="#FFFFFF" />
          </TouchableOpacity>
          {previewImage && (
            <Image
              source={{ uri: previewImage }}
              style={styles.previewFullImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    backgroundColor: '#F8FAFC',
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  tabItemActive: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 2,
    borderBottomColor: BrandColors.primary,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748B',
  },
  tabLabelActive: {
    fontWeight: '700',
    color: BrandColors.primary,
  },
  content: {
    padding: 12,
    minHeight: 140,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  emptyText: {
    fontSize: 13,
    color: '#94A3B8',
  },
  mediaGrid: {
    gap: 6,
  },
  gridThumbWrap: {
    width: GRID_ITEM_SIZE,
    height: GRID_ITEM_SIZE,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#E2E8F0',
    margin: 3,
  },
  gridThumb: {
    width: '100%',
    height: '100%',
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
    gap: 12,
  },
  fileIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: '#FFF7ED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0F172A',
    marginBottom: 2,
  },
  fileMeta: {
    fontSize: 11,
    color: '#94A3B8',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F8FAFC',
    gap: 12,
  },
  linkIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#F0F9FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkInfo: {
    flex: 1,
  },
  linkUrl: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0284C7',
    marginBottom: 2,
  },
  linkMeta: {
    fontSize: 11,
    color: '#94A3B8',
  },
  previewBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewCloseBtn: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  previewFullImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * 1.3,
  },
});
