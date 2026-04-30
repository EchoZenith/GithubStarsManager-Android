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
import { useTheme } from '../constants/ThemeContext';
import { useTranslation } from '../i18n';

export default function RepoDetailScreen({ repo, onGoBack }) {
  const { t } = useTranslation();
  const { colors, spacing, borderRadius, shadows, mode } = useTheme();
  const [readmeHtml, setReadmeHtml] = useState(null);
  const [readmeRaw, setReadmeRaw] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [aiSummary, setAiSummary] = useState(null);
  const [aiTags, setAiTags] = useState([]);
  const [aiPlatforms, setAiPlatforms] = useState([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [webViewReady, setWebViewReady] = useState(false);
  const [webViewHeight, setWebViewHeight] = useState(0);
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
            const html = renderReadme(markdown, repo.full_name, repo.default_branch, mode === 'dark');
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

  useEffect(() => {
    if (readmeRaw) {
      setWebViewReady(false);
      setWebViewHeight(0);
      const html = renderReadme(readmeRaw, repo.full_name, repo.default_branch, mode === 'dark');
      setReadmeHtml(html);
    }
  }, [mode]);

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
        setWebViewReady(true);
      }
    } catch { }
  };

  const readmeContent = loading ? (
    <View style={[styles.readmePlaceholder, { backgroundColor: colors.surface }]}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={[styles.loadingText, { color: colors.textMuted }]}>{t('repoDetail.loading')}</Text>
    </View>
  ) : error ? (
    <View style={[styles.readmePlaceholder, { backgroundColor: colors.surface }]}>
      <Ionicons name="alert-circle-outline" size={36} color={colors.accentRed} />
      <Text style={[styles.errorText, { color: colors.accentRed }]}>{error}</Text>
    </View>
  ) : readmeHtml === null ? (
    <View style={[styles.readmePlaceholder, { backgroundColor: colors.surface }]}>
      <Ionicons name="document-text-outline" size={36} color={colors.textMuted} />
      <Text style={[styles.emptyText, { color: colors.textMuted }]}>{t('repoDetail.noReadme')}</Text>
    </View>
  ) : !webViewReady ? (
    <View style={[styles.webViewWrap, { backgroundColor: colors.surface, minHeight: 200 }]}>
      <View style={[styles.readmePlaceholder, { backgroundColor: 'transparent', minHeight: 200 }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>{t('repoDetail.loading')}</Text>
      </View>
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, opacity: 0, overflow: 'hidden' }}>
        <WebView
          ref={webViewRef}
          source={{ html: readmeHtml }}
          originWhitelist={['*']}
          javaScriptEnabled={true}
          onMessage={handleWebViewMessage}
          style={{ height: 1, width: '100%', backgroundColor: 'transparent' }}
          scrollEnabled={false}
          onError={() => { }}
        />
      </View>
    </View>
  ) : (
    <View style={[styles.webViewWrap, { backgroundColor: colors.surface }]}>
      <WebView
        source={{ html: readmeHtml }}
        originWhitelist={['*']}
        javaScriptEnabled={true}
        onMessage={handleWebViewMessage}
        style={{ height: webViewHeight, width: '100%', backgroundColor: 'transparent' }}
        scrollEnabled={false}
        onError={() => { }}
      />
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={colors.background === '#0d1117' ? 'light' : 'dark'} />
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.headerBtn} onPress={onGoBack}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
          {repo.full_name}
        </Text>
        <TouchableOpacity style={styles.headerBtn} onPress={openInBrowser}>
          <Ionicons name="open-outline" size={22} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={[styles.infoCard, { backgroundColor: colors.surface }]}>
          <View style={styles.infoRow}>
            {repo.owner_avatar_url ? (
              <Image source={{ uri: repo.owner_avatar_url }} style={styles.ownerAvatar} />
            ) : null}
            <View style={styles.infoText}>
              <Text style={[styles.repoName, { color: colors.primary }]}>{repo.full_name}</Text>
              <Text style={[styles.repoDesc, { color: colors.textSecondary }]} numberOfLines={3}>
                {repo.description || t('repoDetail.noDesc')}
              </Text>
            </View>
          </View>
          <View style={[styles.statsRow, { borderTopColor: colors.borderLight }]}>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.textPrimary }]}>{repo.stargazers_count}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>{t('repoDetail.stars')}</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.textPrimary }]}>{repo.forks_count}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>{t('repoDetail.forks')}</Text>
            </View>
            {repo.language ? (
              <View style={styles.statItem}>
                <Text style={[styles.statValue, { color: colors.textPrimary }]}>{repo.language}</Text>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>{t('repoDetail.language')}</Text>
              </View>
            ) : null}
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: colors.textPrimary }]}>{repo.owner_login}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>{t('repoDetail.owner')}</Text>
            </View>
          </View>
        </View>

        {aiSummary ? (
          <View style={[styles.aiCard, { backgroundColor: colors.accentPurple + '12', borderColor: colors.accentPurple + '30' }]}>
            <View style={styles.aiCardHeader}>
              <Ionicons name="sparkles" size={16} color={colors.accentPurple} />
              <Text style={[styles.aiCardTitle, { color: colors.accentPurple }]}>{t('repoDetail.aiCardTitle')}</Text>
            </View>
            <Text style={[styles.aiSummary, { color: colors.textPrimary }]}>{aiSummary}</Text>
            {aiTags.length > 0 ? (
              <View style={styles.aiTagsRow}>
                {aiTags.map((tag, i) => (
                  <View key={i} style={[styles.aiTag, { backgroundColor: colors.accentPurple + '15' }]}>
                    <Text style={[styles.aiTagText, { color: colors.accentPurple }]}>{tag}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            {aiPlatforms.length > 0 ? (
              <View style={styles.aiPlatformsRow}>
                <Ionicons name="logo-apple" size={13} color={colors.textSecondary} />
                {aiPlatforms.map((p, i) => (
                  <View key={i} style={[styles.aiPlatform, { backgroundColor: colors.borderLight }]}>
                    <Text style={[styles.aiPlatformText, { color: colors.textSecondary }]}>{p}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}

        {!aiSummary && !aiLoading ? (
          <TouchableOpacity style={[styles.aiAnalyzeBtn, { borderColor: colors.accentPurple + '30', backgroundColor: colors.accentPurple + '8' }]} onPress={handleAiAnalyze}>
            <Ionicons name="sparkles" size={16} color={colors.accentPurple} />
            <Text style={[styles.aiAnalyzeText, { color: colors.accentPurple }]}>{t('repoDetail.aiAnalyze')}</Text>
          </TouchableOpacity>
        ) : null}

        {aiLoading ? (
          <View style={[styles.aiAnalyzeBtn, { borderColor: colors.accentPurple + '30', backgroundColor: colors.accentPurple + '8' }]}>
            <ActivityIndicator size="small" color={colors.accentPurple} />
            <Text style={[styles.aiAnalyzeText, { color: colors.accentPurple }]}>{t('repoDetail.aiAnalyzing')}</Text>
          </View>
        ) : null}

        {aiError ? (
          <View style={styles.aiErrorCard}>
            <Ionicons name="alert-circle-outline" size={14} color={colors.accentRed} />
            <Text style={[styles.aiErrorText, { color: colors.accentRed }]}>{aiError}</Text>
          </View>
        ) : null}

        <View style={styles.readmeHeader}>
          <Ionicons name="book" size={16} color={colors.textSecondary} />
          <Text style={[styles.readmeTitle, { color: colors.textSecondary }]}>{t('repoDetail.readme')}</Text>
        </View>

        {readmeContent}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 50 : 32, paddingBottom: 12, paddingHorizontal: 8,
    borderBottomWidth: 1,
  },
  headerBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { flex: 1, fontSize: 16, fontWeight: '600', textAlign: 'center' },
  scroll: { flex: 1 },
  scrollContent: { paddingBottom: 32 },
  infoCard: { margin: 16, marginBottom: 0, borderRadius: 14, padding: 16 },
  infoRow: { flexDirection: 'row', alignItems: 'center' },
  ownerAvatar: { width: 44, height: 44, borderRadius: 22, marginRight: 12 },
  infoText: { flex: 1 },
  repoName: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  repoDesc: { fontSize: 13, lineHeight: 18 },
  statsRow: { flexDirection: 'row', marginTop: 16, paddingTop: 12, borderTopWidth: 1, justifyContent: 'space-around' },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 14, fontWeight: '600' },
  statLabel: { fontSize: 11, marginTop: 4 },
  readmeHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, gap: 4 },
  readmeTitle: { fontSize: 14, fontWeight: '600' },
  readmePlaceholder: { justifyContent: 'center', alignItems: 'center', padding: 32, marginHorizontal: 16, marginBottom: 12, borderRadius: 14, minHeight: 200 },
  loadingText: { marginTop: 12, fontSize: 14 },
  errorText: { marginTop: 12, fontSize: 14, textAlign: 'center' },
  emptyText: { marginTop: 12, fontSize: 14 },
  webViewWrap: { marginHorizontal: 16, marginBottom: 12, borderRadius: 14, overflow: 'hidden' },
  aiCard: { marginHorizontal: 16, marginTop: 12, borderRadius: 14, padding: 16, borderWidth: 1 },
  aiCardHeader: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  aiCardTitle: { fontSize: 13, fontWeight: '600' },
  aiSummary: { fontSize: 14, lineHeight: 20 },
  aiTagsRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8, gap: 4 },
  aiTag: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10 },
  aiTagText: { fontSize: 11, fontWeight: '500' },
  aiPlatformsRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 4, gap: 4 },
  aiPlatform: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  aiPlatformText: { fontSize: 11 },
  aiAnalyzeBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginHorizontal: 16, marginTop: 12, padding: 12, borderRadius: 10, borderWidth: 1, gap: 4 },
  aiAnalyzeText: { fontSize: 14, fontWeight: '500' },
  aiErrorCard: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 8, gap: 4 },
  aiErrorText: { flex: 1, fontSize: 12, lineHeight: 16 },
});
