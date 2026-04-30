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
import { useTheme } from '../constants/ThemeContext';
import { useTranslation } from '../i18n';

export default function SettingsScreen({ onGoBack, onTokenExpired, onOpenAiConfig, onOpenStats, onOpenCategoryManage }) {
  const { t, lang, setLang } = useTranslation();
  const { colors, spacing, borderRadius, shadows, mode, toggleTheme } = useTheme();
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
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style="dark" />
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.backBtn} onPress={onGoBack}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{t('settings.title')}</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView style={styles.scroll}>
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{t('settings.theme')}</Text>
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <TouchableOpacity style={styles.langRow} onPress={() => toggleTheme('light')}>
              <Text style={[styles.langText, { color: colors.textPrimary }, mode === 'light' && { color: colors.primary, fontWeight: '600' }]}>{t('settings.themeLight')}</Text>
              {mode === 'light' ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null}
            </TouchableOpacity>
            <View style={styles.langDivider} />
            <TouchableOpacity style={styles.langRow} onPress={() => toggleTheme('dark')}>
              <Text style={[styles.langText, { color: colors.textPrimary }, mode === 'dark' && { color: colors.primary, fontWeight: '600' }]}>{t('settings.themeDark')}</Text>
              {mode === 'dark' ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.githubAccount')}</Text>
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <View style={styles.row}>
              <Ionicons name="key" size={20} color={colors.primary} />
              <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>{t('settings.accessToken')}</Text>
            </View>
            <Text style={[styles.tokenText, { color: colors.textMuted }]}>
              {token ? maskedToken : t('settings.notSet')}
            </Text>
            <View style={styles.tokenActions}>
              <TouchableOpacity
                style={[styles.tokenBtn, { backgroundColor: colors.primary }]}
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
                    style={[styles.tokenBtn, styles.tokenBtnOutline, { borderColor: colors.primary }]}
                    onPress={handleVerifyToken}
                    disabled={verifying}
                  >
                    {verifying ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <>
                        <Ionicons name="checkmark" size={16} color={colors.primary} />
                        <Text style={[styles.tokenBtnText, styles.tokenBtnTextOutline, { color: colors.primary }]}>{t('settings.verify')}</Text>
                      </>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.tokenBtn, { backgroundColor: colors.accentRed }]}
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
          <TouchableOpacity style={[styles.card, { backgroundColor: colors.surface }]} onPress={onOpenStats} activeOpacity={0.7}>
            <View style={styles.aboutRow}>
              <View style={styles.aboutLeft}>
                <Ionicons name="stats-chart" size={20} color={colors.accent} />
                <Text style={[styles.aboutLabel, { color: colors.textPrimary }]}>{t('settings.stats')}</Text>
              </View>
              <View style={styles.aboutRight}>
                <Text style={[styles.aboutValue, { color: colors.textMuted }]}>{t('settings.statsCount', { count: repoCount })}</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </View>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <TouchableOpacity style={[styles.card, { backgroundColor: colors.surface }]} onPress={onOpenCategoryManage} activeOpacity={0.7}>
            <View style={styles.aboutRow}>
              <View style={styles.aboutLeft}>
                <Ionicons name="folder-open" size={20} color={colors.accent} />
                <Text style={[styles.aboutLabel, { color: colors.textPrimary }]}>{t('settings.categoryManage')}</Text>
              </View>
              <View style={styles.aboutRight}>
                <Text style={[styles.aboutValue, { color: colors.textMuted }]}>{t('settings.categoryCount', { count: categoryCount })}</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </View>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <TouchableOpacity style={[styles.card, { backgroundColor: colors.surface }]} onPress={onOpenAiConfig} activeOpacity={0.7}>
            <View style={styles.aboutRow}>
              <View style={styles.aboutLeft}>
                <Ionicons name="sparkles" size={20} color={colors.accentPurple} />
                <Text style={[styles.aboutLabel, { color: colors.textPrimary }]}>{t('settings.aiConfig')}</Text>
              </View>
              <View style={styles.aboutRight}>
                {aiProviders.length > 0 ? (
                  <Text style={[styles.aboutValue, { color: colors.textMuted }]}>{t('settings.aiConfigCount', { count: aiProviders.length })}</Text>
                ) : null}
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </View>
            </View>
          </TouchableOpacity>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{t('settings.language')}</Text>
          <View style={[styles.card, { backgroundColor: colors.surface }]}>
            <TouchableOpacity style={styles.langRow} onPress={() => setLang('zh')}>
              <Text style={[styles.langText, { color: colors.textPrimary }, lang === 'zh' && { color: colors.primary, fontWeight: '600' }]}>{t('settings.languageZh')}</Text>
              {lang === 'zh' ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null}
            </TouchableOpacity>
            <View style={styles.langDivider} />
            <TouchableOpacity style={styles.langRow} onPress={() => setLang('en')}>
              <Text style={[styles.langText, { color: colors.textPrimary }, lang === 'en' && { color: colors.primary, fontWeight: '600' }]}>{t('settings.languageEn')}</Text>
              {lang === 'en' ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null}
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textMuted }]}>{t('settings.about')}</Text>
          <TouchableOpacity
            style={[styles.card, { backgroundColor: colors.surface }]}
            onPress={handleCheckUpdate}
            disabled={checkingUpdate}
            activeOpacity={0.7}
          >
            <View style={styles.aboutRow}>
              <View style={styles.aboutLeft}>
                <Ionicons name="information-circle-outline" size={20} color={colors.textSecondary} />
                <Text style={[styles.aboutLabel, { color: colors.textPrimary }]}>{t('settings.version')}</Text>
              </View>
              <View style={styles.aboutRight}>
                {checkingUpdate ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : updateInfo && updateInfo.hasUpdate ? (
                  <View style={styles.updateBadge}>
                    <Text style={styles.updateBadgeText}>{t('settings.updateAvailable')}</Text>
                  </View>
                ) : null}
                <Text style={[styles.aboutValue, { color: colors.textMuted }]}>{Constants.expoConfig?.version || '1.0.0'}</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
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
    backgroundColor: '#f0f4f8',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    paddingTop: Platform.OS === 'ios' ? 50 : 32,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
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
    color: '#0f172a',
  },
  scroll: {
    flex: 1,
  },
  section: {
    marginTop: 20,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 8,
    marginLeft: 4,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  rowLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#0f172a',
  },
  tokenText: {
    fontSize: 13,
    color: '#94a3b8',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 12,
  },
  tokenActions: {
    flexDirection: 'row',
    gap: 8,
  },
  tokenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0366d6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    gap: 4,
  },
  tokenBtnOutline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#0366d6',
  },
  tokenBtnDanger: {
    backgroundColor: '#ef4444',
  },
  tokenBtnText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },
  tokenBtnTextOutline: {
    color: '#0366d6',
  },
  aboutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  aboutLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  aboutRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  aboutLabel: {
    fontSize: 15,
    color: '#0f172a',
  },
  aboutValue: {
    fontSize: 15,
    color: '#94a3b8',
  },
  updateBadge: {
    backgroundColor: '#fff3cd',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
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
    paddingVertical: 12,
  },
  langText: {
    fontSize: 15,
    color: '#0f172a',
  },
  langTextActive: {
    color: '#0366d6',
    fontWeight: '600',
  },
  langDivider: {
    height: 1,
    backgroundColor: '#f1f5f9',
  },
});
