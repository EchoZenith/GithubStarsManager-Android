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
import { useTranslation } from '../i18n';

export default function SettingsScreen({ onGoBack, onTokenExpired, onOpenAiConfig, onOpenStats, onOpenCategoryManage }) {
  const { t, lang, setLang } = useTranslation();
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
      Alert.alert(t('settings.verifyTitle'), t('settings.verifySuccess'));
    } catch (e) {
      Alert.alert(t('settings.verifyFailTitle'), e.message);
    } finally {
      setVerifying(false);
    }
  };

  const handleClearToken = () => {
    Alert.alert(
      t('settings.clearTitle'),
      t('settings.clearMessage'),
      [
        { text: t('app.cancel'), style: 'cancel' },
        {
          text: t('settings.clear'),
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
      Alert.alert(t('settings.checkUpdate'), result.error);
    } else if (result.hasUpdate) {
      Alert.alert(
        t('settings.updateTitle'),
        t('settings.updateMessage', { current: result.currentVersion, latest: result.latestVersion, body: result.releaseBody || result.releaseName || '' }),
        [
          { text: t('app.cancel'), style: 'cancel' },
          {
            text: t('settings.updateDownload'),
            onPress: () => {
              if (result.releaseUrl) {
                Linking.openURL(result.releaseUrl);
              }
            },
          },
        ]
      );
    } else {
      Alert.alert(t('settings.checkUpdate'), result.message || t('settings.noUpdate'));
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
        <Text style={styles.headerTitle}>{t('settings.title')}</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView style={styles.scroll}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.githubAccount')}</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <Ionicons name="key" size={20} color="#0366d6" />
              <Text style={styles.rowLabel}>{t('settings.accessToken')}</Text>
            </View>
            <Text style={styles.tokenText}>
              {token ? maskedToken : t('settings.notSet')}
            </Text>
            <View style={styles.tokenActions}>
              <TouchableOpacity
                style={styles.tokenBtn}
                onPress={handleChangeToken}
              >
                <Ionicons name="create" size={16} color="#fff" />
                <Text style={styles.tokenBtnText}>
                  {token ? t('settings.change') : t('settings.set')}
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
                        <Text style={[styles.tokenBtnText, styles.tokenBtnTextOutline]}>{t('settings.verify')}</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.tokenBtn, styles.tokenBtnDanger]}
                    onPress={handleClearToken}
                  >
                    <Ionicons name="trash" size={16} color="#fff" />
                    <Text style={styles.tokenBtnText}>{t('settings.clear')}</Text>
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
                <Text style={styles.aboutLabel}>{t('settings.stats')}</Text>
              </View>
              <View style={styles.aboutRight}>
                <Text style={styles.aboutValue}>{t('settings.statsCount', { count: repoCount })}</Text>
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
                <Text style={styles.aboutLabel}>{t('settings.categoryManage')}</Text>
              </View>
              <View style={styles.aboutRight}>
                <Text style={styles.aboutValue}>{t('settings.categoryCount', { count: categoryCount })}</Text>
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
                <Text style={styles.aboutLabel}>{t('settings.aiConfig')}</Text>
              </View>
              <View style={styles.aboutRight}>
                {aiProviders.length > 0 ? (
                  <Text style={styles.aboutValue}>{t('settings.aiConfigCount', { count: aiProviders.length })}</Text>
                ) : null}
                <Ionicons name="chevron-forward" size={18} color="#ccc" />
              </View>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.language')}</Text>
          <View style={styles.card}>
            <TouchableOpacity style={styles.langRow} onPress={() => setLang('zh')}>
              <Text style={[styles.langText, lang === 'zh' && styles.langTextActive]}>{t('settings.languageZh')}</Text>
              {lang === 'zh' ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null}
            </TouchableOpacity>
            <View style={styles.langDivider} />
            <TouchableOpacity style={styles.langRow} onPress={() => setLang('en')}>
              <Text style={[styles.langText, lang === 'en' && styles.langTextActive]}>{t('settings.languageEn')}</Text>
              {lang === 'en' ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.about')}</Text>
          <TouchableOpacity
            style={styles.card}
            onPress={handleCheckUpdate}
            disabled={checkingUpdate}
            activeOpacity={0.7}
          >
            <View style={styles.aboutRow}>
              <View style={styles.aboutLeft}>
                <Ionicons name="information-circle-outline" size={20} color="#555" />
                <Text style={styles.aboutLabel}>{t('settings.version')}</Text>
              </View>
              <View style={styles.aboutRight}>
                {checkingUpdate ? (
                  <ActivityIndicator size="small" color="#0366d6" />
                ) : updateInfo && updateInfo.hasUpdate ? (
                  <View style={styles.updateBadge}>
                    <Text style={styles.updateBadgeText}>{t('settings.updateAvailable')}</Text>
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
  langRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  langText: {
    fontSize: 15,
    color: colors.textPrimary,
  },
  langTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  langDivider: {
    height: 1,
    backgroundColor: colors.borderLight,
  },
});
