import { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator, ScrollView, Platform, Linking, BackHandler
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import {
  getGitHubToken, clearGitHubToken,
  getTotalRepoCount,
  getAllCategories,
  getAiProviders,
} from '../services/database';
import { fetchStarredRepos, checkUpdate } from '../services/github';
import TokenInput from '../components/TokenInput';
import { colors, spacing, borderRadius, shadows } from '../constants/theme';

export default function SettingsScreen({ onGoBack, onTokenExpired, onOpenAiConfig, onOpenStats, onOpenCategoryManage }) {
  const [token, setToken] = useState(null);
  const [repoCount, setRepoCount] = useState(0);
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [aiProviders, setAiProviders] = useState([]);
  const [categoryCount, setCategoryCount] = useState(0);
  const goBackRef = useRef(onGoBack);
  goBackRef.current = onGoBack;

  const loadSettings = async () => {
    const savedToken = await getGitHubToken();
    setToken(savedToken);
    const total = await getTotalRepoCount();
    setRepoCount(total);
    const aList = await getAiProviders();
    setAiProviders(aList);
    const cats = await getAllCategories();
    setCategoryCount(cats.length);
  };

  useEffect(() => {
    loadSettings();
  }, []);

  // Android 硬件返回按钮
  useEffect(() => {
    const onBackPress = () => {
      goBackRef.current();
      return true;
    };
    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, []);

  const handleChangeToken = () => {
    setShowTokenInput(true);
  };

  // 验证当前 Token 是否仍然有效
  const handleVerifyToken = async () => {
    setVerifying(true);
    try {
      await fetchStarredRepos(token);
      Alert.alert('验证成功', 'Token 有效');
    } catch (e) {
      Alert.alert('验证失败', e.message);
    } finally {
      setVerifying(false);
    }
  };

  // 清除 Token（需用户确认）
  const handleClearToken = () => {
    Alert.alert(
      '清除 Token',
      '确定要清除 GitHub Token 吗？清除后需要重新输入才能同步数据。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '清除',
          style: 'destructive',
          onPress: async () => {
            await clearGitHubToken();
            onTokenExpired();
          },
        },
      ]
    );
  };

  const handleTokenSaved = async () => {
    setShowTokenInput(false);
    await loadSettings();
  };

  // 检查 GitHub Releases 是否有新版本
  const handleCheckUpdate = async () => {
    setCheckingUpdate(true);
    setUpdateInfo(null);
    const savedToken = await getGitHubToken();
    const result = await checkUpdate(savedToken);
    setUpdateInfo(result);
    setCheckingUpdate(false);

    if (result.error) {
      Alert.alert('检查更新', result.error);
    } else if (result.hasUpdate) {
      Alert.alert(
        '发现新版本',
        `当前版本：v${result.currentVersion}\n最新版本：v${result.latestVersion}\n\n${result.releaseName || ''}\n\n${result.releaseBody ? result.releaseBody : ''}`,
        [
          { text: '取消', style: 'cancel' },
          {
            text: '前往下载',
            onPress: () => {
              if (result.releaseUrl) {
                Linking.openURL(result.releaseUrl);
              }
            },
          },
        ]
      );
    } else {
      Alert.alert('检查更新', result.message || '已是最新版本');
    }
  };

  if (showTokenInput) {
    return <TokenInput onTokenSaved={handleTokenSaved} onBack={() => setShowTokenInput(false)} />;
  }

  const maskedToken = token
    ? token.slice(0, 8) + '••••••••' + token.slice(-4)
    : '';

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onGoBack}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>设置</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView style={styles.scroll}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>GitHub 账号</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <Ionicons name="key" size={20} color="#0366d6" />
              <Text style={styles.rowLabel}>访问令牌</Text>
            </View>
            <Text style={styles.tokenText}>
              {token ? maskedToken : '未设置'}
            </Text>
            <View style={styles.tokenActions}>
              <TouchableOpacity
                style={styles.tokenBtn}
                onPress={handleChangeToken}
              >
                <Ionicons name="create" size={16} color="#fff" />
                <Text style={styles.tokenBtnText}>
                  {token ? '修改' : '设置'}
                </Text>
              </TouchableOpacity>
              {token ? (
                <>
                  <TouchableOpacity
                    style={[styles.tokenBtn, styles.tokenBtnOutline]}
                    onPress={handleVerifyToken}
                    disabled={verifying}
                  >
                    {verifying ? (
                      <ActivityIndicator size="small" color="#0366d6" />
                    ) : (
                      <>
                        <Ionicons name="checkmark" size={16} color="#0366d6" />
                        <Text style={[styles.tokenBtnText, styles.tokenBtnTextOutline]}>验证</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.tokenBtn, styles.tokenBtnDanger]}
                    onPress={handleClearToken}
                  >
                    <Ionicons name="trash" size={16} color="#fff" />
                    <Text style={styles.tokenBtnText}>清除</Text>
                  </TouchableOpacity>
                </>
              ) : null}
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <TouchableOpacity style={styles.card} onPress={onOpenStats} activeOpacity={0.7}>
            <View style={styles.aboutRow}>
              <View style={styles.aboutLeft}>
                <Ionicons name="stats-chart" size={20} color="#28a745" />
                <Text style={styles.aboutLabel}>数据统计</Text>
              </View>
              <View style={styles.aboutRight}>
                <Text style={styles.aboutValue}>{repoCount} 仓库</Text>
                <Ionicons name="chevron-forward" size={18} color="#ccc" />
              </View>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <TouchableOpacity style={styles.card} onPress={onOpenCategoryManage} activeOpacity={0.7}>
            <View style={styles.aboutRow}>
              <View style={styles.aboutLeft}>
                <Ionicons name="folder-open" size={20} color="#19b5a0" />
                <Text style={styles.aboutLabel}>分类管理</Text>
              </View>
              <View style={styles.aboutRight}>
                <Text style={styles.aboutValue}>{categoryCount} 个</Text>
                <Ionicons name="chevron-forward" size={18} color="#ccc" />
              </View>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <TouchableOpacity style={styles.card} onPress={onOpenAiConfig} activeOpacity={0.7}>
            <View style={styles.aboutRow}>
              <View style={styles.aboutLeft}>
                <Ionicons name="sparkles" size={20} color="#8b5cf6" />
                <Text style={styles.aboutLabel}>AI 配置</Text>
              </View>
              <View style={styles.aboutRight}>
                {aiProviders.length > 0 ? (
                  <Text style={styles.aboutValue}>{aiProviders.length} 个</Text>
                ) : null}
                <Ionicons name="chevron-forward" size={18} color="#ccc" />
              </View>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>关于</Text>
          <TouchableOpacity
            style={styles.card}
            onPress={handleCheckUpdate}
            disabled={checkingUpdate}
            activeOpacity={0.7}
          >
            <View style={styles.aboutRow}>
              <View style={styles.aboutLeft}>
                <Ionicons name="information-circle-outline" size={20} color="#555" />
                <Text style={styles.aboutLabel}>版本</Text>
              </View>
              <View style={styles.aboutRight}>
                {checkingUpdate ? (
                  <ActivityIndicator size="small" color="#0366d6" />
                ) : updateInfo && updateInfo.hasUpdate ? (
                  <View style={styles.updateBadge}>
                    <Text style={styles.updateBadgeText}>有新版本</Text>
                  </View>
                ) : null}
                <Text style={styles.aboutValue}>{Constants.expoConfig?.version || '1.0.0'}</Text>
                <Ionicons name="chevron-forward" size={18} color="#ccc" />
              </View>
            </View>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    paddingTop: Platform.OS === 'ios' ? 50 : spacing.xxxl,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  scroll: {
    flex: 1,
  },
  section: {
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textMuted,
    marginBottom: spacing.sm,
    marginLeft: spacing.xs,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  tokenText: {
    fontSize: 13,
    color: colors.textMuted,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: spacing.md,
  },
  tokenActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  tokenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.sm,
    gap: spacing.xs,
  },
  tokenBtnOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  tokenBtnDanger: {
    backgroundColor: colors.accentRed,
  },
  tokenBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },
  tokenBtnTextOutline: {
    color: colors.primary,
  },
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  aboutLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  aboutRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  aboutLabel: {
    fontSize: 15,
    color: colors.textPrimary,
  },
  aboutValue: {
    fontSize: 15,
    color: colors.textMuted,
  },
  updateBadge: {
    backgroundColor: '#fff3cd',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  updateBadgeText: {
    fontSize: 11,
    color: '#856404',
    fontWeight: '500',
  },
});
