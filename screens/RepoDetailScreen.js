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

export default function RepoDetailScreen({ repo, onGoBack }) {
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
        const html = renderReadme(markdown, repo.full_name, repo.default_branch);
        setReadmeHtml(html);
      }
    } catch (e) {
      if (e instanceof TokenExpiredError) {
        setError('Token 已过期，请返回设置页面重新输入');
      } else {
        setError(e.message || '加载 README 失败');
      }
    } finally {
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
      <Text style={styles.loadingText}>正在加载 README...</Text>
    </View>
  ) : error ? (
    <View style={styles.readmePlaceholder}>
      <Ionicons name="alert-circle-outline" size={36} color="#d73a4a" />
      <Text style={styles.errorText}>{error}</Text>
    </View>
  ) : readmeHtml === null ? (
    <View style={styles.readmePlaceholder}>
      <Ionicons name="document-text-outline" size={36} color="#ccc" />
      <Text style={styles.emptyText}>该仓库没有 README 文件</Text>
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
                {repo.description || '暂无描述'}
              </Text>
            </View>
          </View>
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{repo.stargazers_count}</Text>
              <Text style={styles.statLabel}>Stars</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{repo.forks_count}</Text>
              <Text style={styles.statLabel}>Forks</Text>
            </View>
            {repo.language ? (
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{repo.language}</Text>
                <Text style={styles.statLabel}>Language</Text>
              </View>
            ) : null}
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{repo.owner_login}</Text>
              <Text style={styles.statLabel}>Owner</Text>
            </View>
          </View>
        </View>

        {aiSummary ? (
          <View style={styles.aiCard}>
            <View style={styles.aiCardHeader}>
              <Ionicons name="sparkles" size={16} color="#8b5cf6" />
              <Text style={styles.aiCardTitle}>AI 分析</Text>
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
            <Text style={styles.aiAnalyzeText}>AI 分析此仓库</Text>
          </TouchableOpacity>
        ) : null}

        {aiLoading ? (
          <View style={styles.aiAnalyzeBtn}>
            <ActivityIndicator size="small" color="#8b5cf6" />
            <Text style={styles.aiAnalyzeText}>AI 分析中...</Text>
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
          <Text style={styles.readmeTitle}>README.md</Text>
        </View>

        {readmeContent}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
    paddingBottom: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e8e8e8',
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
    color: '#1a1a1a',
    textAlign: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  infoCard: {
    backgroundColor: '#fff',
    margin: 12,
    marginBottom: 0,
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ownerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  infoText: {
    flex: 1,
  },
  repoName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0366d6',
    marginBottom: 4,
  },
  repoDesc: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  statLabel: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
  readmeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 6,
  },
  readmeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
  },
  readmePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 12,
    backgroundColor: '#fff',
    minHeight: 200,
  },
  loadingText: {
    marginTop: 10,
    color: '#888',
    fontSize: 14,
  },
  errorText: {
    marginTop: 10,
    color: '#d73a4a',
    fontSize: 14,
    textAlign: 'center',
  },
  emptyText: {
    marginTop: 10,
    color: '#999',
    fontSize: 14,
  },
  webViewWrap: {
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#fff',
  },
  aiCard: {
    backgroundColor: '#f5f0ff',
    marginHorizontal: 12,
    marginTop: 12,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#e8dfff',
  },
  aiCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  aiCardTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#8b5cf6',
  },
  aiSummary: {
    fontSize: 14,
    color: '#333',
    lineHeight: 20,
  },
  aiTagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    gap: 6,
  },
  aiTag: {
    backgroundColor: '#e8dfff',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  aiTagText: {
    fontSize: 11,
    color: '#8b5cf6',
    fontWeight: '500',
  },
  aiPlatformsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 6,
    gap: 4,
  },
  aiPlatform: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  aiPlatformText: {
    fontSize: 11,
    color: '#555',
  },
  aiAnalyzeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 12,
    marginTop: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e8dfff',
    backgroundColor: '#faf8ff',
    gap: 6,
  },
  aiAnalyzeText: {
    fontSize: 14,
    color: '#8b5cf6',
    fontWeight: '500',
  },
  aiErrorCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginTop: 8,
    gap: 6,
  },
  aiErrorText: {
    flex: 1,
    fontSize: 12,
    color: '#d73a4a',
    lineHeight: 16,
  },
});
