import { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Image, Linking, Platform, BackHandler, InteractionManager
} from 'react-native';
import { WebView } from 'react-native-webview';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { fetchReadme, TokenExpiredError } from '../services/github';
import { getGitHubToken, getAiAnalysis, saveAiAnalysis } from '../services/database';
import { analyzeRepository } from '../services/ai';
import { renderReadme } from '../services/markdownRenderer';
import { colors, spacing, borderRadius, shadows } from '../constants/theme';
import { useTranslation } from '../i18n';

export default function RepoDetailScreen({ repo, onGoBack }) {
  const { t } = useTranslation();
  const [readmeHtml, setReadmeHtml] = useState(null);
  const [readmeRaw, setReadmeRaw] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [aiSummary, setAiSummary] = useState(null);
  const [aiTags, setAiTags] = useState([]);
  const [aiPlatforms, setAiPlatforms] = useState([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [webViewHeight, setWebViewHeight] = useState(1);
  const webViewRef = useRef(null);
  const goBackRef = useRef(onGoBack);
  goBackRef.current = onGoBack;

  useEffect(() => {
    const onBackPress = () => {
      goBackRef.current();
      return true;
    };
    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    InteractionManager.runAfterInteractions(() => {
      loadReadme();
    });
  }, []);

  const loadReadme = async () => {
    try {
      const token = await getGitHubToken();
      const markdown = await fetchReadme(token, repo.full_name);
      setReadmeRaw(markdown);
      if (markdown) {
        setTimeout(() => {
          try {
            const html = renderReadme(markdown, repo.full_name, repo.default_branch);
            setReadmeHtml(html);
          } catch {
            setError(t('repoDetail.renderFailed'));
          }
          setLoading(false);
        }, 50);
      } else {
        setLoading(false);
      }
    } catch (e) {
      if (e instanceof TokenExpiredError) {
        setError(t('repoDetail.tokenExpired'));
      } else {
        setError(e.message || t('repoDetail.loadFailed'));
      }
      setLoading(false);
    }
  };

  // 加载已有 AI 分析结果
  useEffect(() => {
    (async () => {
      const cached = await getAiAnalysis(repo.repo_id);
      if (cached) {
        setAiSummary(cached.summary);
        setAiTags(cached.tags);
        setAiPlatforms(cached.platforms);
      }
    })();
  }, [repo.repo_id]);

  // 调用 AI 分析仓库
  const handleAiAnalyze = async () => {
    setAiLoading(true);
    setAiError(null);
    try {
      const result = await analyzeRepository(repo, readmeRaw);
      setAiSummary(result.summary);
      setAiTags(result.tags || []);
      setAiPlatforms(result.platforms || []);
      await saveAiAnalysis(repo.repo_id, result.summary, result.tags, result.platforms);
    } catch (e) {
      setAiError(e.message);
    } finally {
      setAiLoading(false);
    }
  };

  const openInBrowser = () => {
    if (repo.html_url) {
      Linking.openURL(repo.html_url);
    }
  };

  const handleWebViewMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'link' && data.url) {
        Linking.openURL(data.url);
      } else if (data.type === 'height' && data.height > 0) {
        setWebViewHeight(data.height);
      }
    } catch { }
  };

  const readmeContent = loading ? (
    <View style={styles.readmePlaceholder}>
      <ActivityIndicator size="large" color="#0366d6" />
      <Text style={styles.loadingText}>{t('repoDetail.loading')}</Text>
    </View>
  ) : error ? (
    <View style={styles.readmePlaceholder}>
      <Ionicons name="alert-circle-outline" size={36} color={colors.accentRed} />
      <Text style={styles.errorText}>{error}</Text>
    </View>
  ) : readmeHtml === null ? (
    <View style={styles.readmePlaceholder}>
      <Ionicons name="document-text-outline" size={36} color={colors.textMuted} />
      <Text style={styles.emptyText}>{t('repoDetail.noReadme')}</Text>
    </View>
  ) : (
    <View style={styles.webViewWrap}>
      <WebView
        ref={webViewRef}
        source={{ html: readmeHtml }}
        originWhitelist={['*']}
        javaScriptEnabled={true}
        onMessage={handleWebViewMessage}
        style={{ height: webViewHeight, width: '100%' }}
        scrollEnabled={false}
        onError={() => { }}
      />
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={onGoBack}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {repo.full_name}
        </Text>
        <TouchableOpacity style={styles.headerBtn} onPress={openInBrowser}>
          <Ionicons name="open-outline" size={22} color="#0366d6" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            {repo.owner_avatar_url ? (
              <Image
                source={{ uri: repo.owner_avatar_url }}
                style={styles.ownerAvatar}
              />
            ) : null}
            <View style={styles.infoText}>
              <Text style={styles.repoName}>{repo.full_name}</Text>
              <Text style={styles.repoDesc} numberOfLines={3}>
                {repo.description || t('repoDetail.noDesc')}
              </Text>
            </View>
          </View>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{repo.stargazers_count}</Text>
              <Text style={styles.statLabel}>{t('repoDetail.stars')}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{repo.forks_count}</Text>
              <Text style={styles.statLabel}>{t('repoDetail.forks')}</Text>
            </View>
            {repo.language ? (
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{repo.language}</Text>
                <Text style={styles.statLabel}>{t('repoDetail.language')}</Text>
              </View>
            ) : null}
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{repo.owner_login}</Text>
              <Text style={styles.statLabel}>{t('repoDetail.owner')}</Text>
            </View>
          </View>
        </View>

        {aiSummary ? (
          <View style={styles.aiCard}>
            <View style={styles.aiCardHeader}>
              <Ionicons name="sparkles" size={16} color="#8b5cf6" />
              <Text style={styles.aiCardTitle}>{t('repoDetail.aiCardTitle')}</Text>
            </View>
            <Text style={styles.aiSummary}>{aiSummary}</Text>
            {aiTags.length > 0 ? (
              <View style={styles.aiTagsRow}>
                {aiTags.map((tag, i) => (
                  <View key={i} style={styles.aiTag}>
                    <Text style={styles.aiTagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            {aiPlatforms.length > 0 ? (
              <View style={styles.aiPlatformsRow}>
                <Ionicons name="logo-apple" size={13} color="#666" />
                {aiPlatforms.map((p, i) => (
                  <View key={i} style={styles.aiPlatform}>
                    <Text style={styles.aiPlatformText}>{p}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        {!aiSummary && !aiLoading ? (
          <TouchableOpacity style={styles.aiAnalyzeBtn} onPress={handleAiAnalyze}>
            <Ionicons name="sparkles" size={16} color="#8b5cf6" />
            <Text style={styles.aiAnalyzeText}>{t('repoDetail.aiAnalyze')}</Text>
          </TouchableOpacity>
        ) : null}

        {aiLoading ? (
          <View style={styles.aiAnalyzeBtn}>
            <ActivityIndicator size="small" color="#8b5cf6" />
            <Text style={styles.aiAnalyzeText}>{t('repoDetail.aiAnalyzing')}</Text>
          </View>
        ) : null}

        {aiError ? (
          <View style={styles.aiErrorCard}>
            <Ionicons name="alert-circle-outline" size={14} color="#d73a4a" />
            <Text style={styles.aiErrorText}>{aiError}</Text>
          </View>
        ) : null}

        <View style={styles.readmeHeader}>
          <Ionicons name="book" size={16} color="#555" />
          <Text style={styles.readmeTitle}>{t('repoDetail.readme')}</Text>
        </View>

        {readmeContent}
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
    paddingHorizontal: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xxxl,
  },
  infoCard: {
    backgroundColor: colors.surface,
    margin: spacing.lg,
    marginBottom: 0,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    ...shadows.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ownerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: spacing.md,
  },
  infoText: {
    flex: 1,
  },
  repoName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  repoDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  statLabel: {
    fontSize: 11,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  readmeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  readmeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  readmePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xxxl,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: borderRadius.lg,
    backgroundColor: colors.surface,
    minHeight: 200,
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.textMuted,
    fontSize: 14,
  },
  errorText: {
    marginTop: spacing.md,
    color: colors.accentRed,
    fontSize: 14,
    textAlign: 'center',
  },
  emptyText: {
    marginTop: spacing.md,
    color: colors.textMuted,
    fontSize: 14,
  },
  webViewWrap: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
  aiCard: {
    backgroundColor: '#f5f0ff',
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderRadius: borderRadius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: '#e8dfff',
  },
  aiCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm,
  },
  aiCardTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.accentPurple,
  },
  aiSummary: {
    fontSize: 14,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  aiTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  aiTag: {
    backgroundColor: '#e8dfff',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.md,
  },
  aiTagText: {
    fontSize: 11,
    color: colors.accentPurple,
    fontWeight: '500',
  },
  aiPlatformsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  aiPlatform: {
    backgroundColor: colors.borderLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.sm,
  },
  aiPlatformText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  aiAnalyzeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: '#e8dfff',
    backgroundColor: '#faf8ff',
    gap: spacing.xs,
  },
  aiAnalyzeText: {
    fontSize: 14,
    color: colors.accentPurple,
    fontWeight: '500',
  },
  aiErrorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    gap: spacing.xs,
  },
  aiErrorText: {
    flex: 1,
    fontSize: 12,
    color: colors.accentRed,
    lineHeight: 16,
  },
});
