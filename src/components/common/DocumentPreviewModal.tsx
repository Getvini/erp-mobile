import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Clipboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import * as Linking from 'expo-linking';
import * as Haptics from 'expo-haptics';
import {
  detectFileType,
  getFileMeta,
  getDocumentViewerUrl,
  getFileNameFromUrl,
} from '@/utils/fileDetector';

export interface DocumentPreviewModalProps {
  visible: boolean;
  url: string;
  fileName?: string;
  onClose: () => void;
}

export const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({
  visible,
  url,
  fileName = '',
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [copied, setCopied] = useState(false);
  const webViewRef = useRef<any>(null);

  if (!url) return null;

  const displayName = getFileNameFromUrl(url, fileName);
  const fileType = detectFileType(url, displayName);
  const meta = getFileMeta(fileType);
  const viewerUrl = getDocumentViewerUrl(url);

  const handleClose = () => {
    setIsLoading(true);
    setHasError(false);
    onClose();
  };

  const handleOpenExternal = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Thông báo', 'Không thể mở liên kết này.');
      }
    } catch {
      Alert.alert('Lỗi', 'Không thể mở tài liệu.');
    }
  };

  const handleCopyLink = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Clipboard.setString(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleReload = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setHasError(false);
    setIsLoading(true);
    webViewRef.current?.reload();
  };

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {/* TOOLBAR */}
        <View style={styles.toolbar}>
          <View style={styles.toolbarLeft}>
            <View style={[styles.iconBox, { backgroundColor: meta.bgColor, borderColor: meta.borderColor }]}>
              <Feather name={meta.icon as any} size={16} color={meta.color} />
            </View>
            <View style={styles.titleCol}>
              <Text style={styles.fileTitle} numberOfLines={1}>{displayName}</Text>
              <View style={styles.badgeRow}>
                <View style={[styles.badge, { backgroundColor: meta.bgColor }]}>
                  <Text style={[styles.badgeText, { color: meta.color }]}>{meta.ext}</Text>
                </View>
                <Text style={styles.badgeLabel}>{meta.label}</Text>
              </View>
            </View>
          </View>
          <View style={styles.toolbarRight}>
            <TouchableOpacity style={styles.iconBtn} onPress={handleCopyLink} activeOpacity={0.7}>
              <Feather name={copied ? 'check' : 'copy'} size={16} color={copied ? '#16A34A' : '#64748B'} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn} onPress={handleOpenExternal} activeOpacity={0.7}>
              <Feather name="external-link" size={16} color="#64748B" />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.iconBtn, styles.closeBtn]} onPress={handleClose} activeOpacity={0.7}>
              <Feather name="x" size={17} color="#334155" />
            </TouchableOpacity>
          </View>
        </View>

        {/* WEBVIEW */}
        <View style={styles.webviewContainer}>
          <WebView
            ref={webViewRef}
            source={{ uri: viewerUrl }}
            style={styles.webview}
            onLoadStart={() => { setIsLoading(true); setHasError(false); }}
            onLoadEnd={() => setIsLoading(false)}
            onError={() => { setIsLoading(false); setHasError(true); }}
            startInLoadingState={false}
            scalesPageToFit
            javaScriptEnabled
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
          />
          {isLoading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#F38820" />
              <Text style={styles.loadingText}>Đang tải tài liệu...</Text>
            </View>
          )}
          {hasError && !isLoading && (
            <View style={styles.errorContainer}>
              <View style={styles.errorCard}>
                <View style={styles.errorIconBox}>
                  <Feather name="alert-circle" size={28} color="#DC2626" />
                </View>
                <Text style={styles.errorTitle}>Không thể tải tài liệu</Text>
                <Text style={styles.errorDesc}>
                  Trình xem trực tuyến không tải được. Thử mở bằng ứng dụng ngoài.
                </Text>
                <View style={styles.errorActions}>
                  <TouchableOpacity style={styles.reloadBtn} onPress={handleReload} activeOpacity={0.8}>
                    <Feather name="refresh-cw" size={14} color="#FFFFFF" />
                    <Text style={styles.reloadBtnText}>Thử lại</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.externalBtn} onPress={handleOpenExternal} activeOpacity={0.8}>
                    <Feather name="external-link" size={14} color="#2563EB" />
                    <Text style={styles.externalBtnText}>Mở ngoài</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          )}
        </View>

        {/* BOTTOM URL BAR */}
        <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
          <Text style={styles.bottomHint} numberOfLines={1}>{url}</Text>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  toolbar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#FFFFFF', paddingHorizontal: 12, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#E2E8F0', gap: 8,
  },
  toolbarLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0 },
  iconBox: { width: 36, height: 36, borderRadius: 9, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  titleCol: { flex: 1, minWidth: 0 },
  fileTitle: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  badge: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 },
  badgeText: { fontSize: 9, fontWeight: '800' },
  badgeLabel: { fontSize: 10, color: '#64748B' },
  toolbarRight: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0 },
  iconBtn: { width: 34, height: 34, borderRadius: 8, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  closeBtn: { marginLeft: 2 },
  webviewContainer: { flex: 1, backgroundColor: '#F1F5F9' },
  webview: { flex: 1, backgroundColor: '#F1F5F9' },
  loadingOverlay: { ...StyleSheet.absoluteFill, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: 13, color: '#64748B', fontWeight: '500' },
  errorContainer: { ...StyleSheet.absoluteFill, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorCard: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 24, alignItems: 'center', gap: 10,
    borderWidth: 1, borderColor: '#E2E8F0', width: '100%', maxWidth: 320,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  errorIconBox: { width: 56, height: 56, borderRadius: 14, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  errorTitle: { fontSize: 15, fontWeight: '700', color: '#0F172A', textAlign: 'center' },
  errorDesc: { fontSize: 12, color: '#64748B', textAlign: 'center', lineHeight: 18 },
  errorActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  reloadBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F38820', paddingHorizontal: 16, paddingVertical: 9, borderRadius: 9 },
  reloadBtnText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  externalBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE', paddingHorizontal: 16, paddingVertical: 9, borderRadius: 9 },
  externalBtnText: { fontSize: 13, fontWeight: '700', color: '#2563EB' },
  bottomBar: { backgroundColor: '#1E293B', paddingHorizontal: 14, paddingTop: 8 },
  bottomHint: { fontSize: 10, color: '#64748B', fontFamily: 'monospace' },
});