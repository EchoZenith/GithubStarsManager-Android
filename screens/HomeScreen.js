import { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator, RefreshControl,
  ScrollView, Platform, BackHandler
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import RepoItem from '../components/RepoItem';
import { fetchStarredRepos, TokenExpiredError, fetchReadme } from '../services/github';
import {
  initDatabase, getAllCategories, saveRepos, getAllRepos, getReposByCategory,
  getUncategorizedRepos, getGitHubToken, batchSetRepoCategories,
  getUnanalyzedRepos, getFailedAnalysisRepos, saveAiAnalysis,
  getActiveAiConfig, migrateOldAiConfig,
} from '../services/database';
import { runAutoCategorize } from '../services/categorizer';
import { analyzeRepository } from '../services/ai';
import { colors, spacing, borderRadius, shadows } from '../constants/theme';
import { useTranslation } from '../i18n';

// 首页：仓库列表、分类标签栏、同步入口
export default function HomeScreen({ onTokenExpired, onOpenSettings, onOpenRepoDetail }) {
  const { t } = useTranslation();
  const [categories, setCategories] = useState([]);
  // selectedCategory: null=全部, 0=未分类, >0=具体分类 ID
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncInfo, setSyncInfo] = useState('');
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiProgress, setAiProgress] = useState({ current: 0, total: 0, label: '' });
  const cancelAiRef = useRef(false);

  // 按分类加载仓库列表
  const loadRepos = useCallback(async (catId) => {
    if (catId === null || catId === undefined) {
      const allRepos = await getAllRepos();
      setRepos(allRepos);
    } else if (catId === 0) {
      const uncatRepos = await getUncategorizedRepos();
      setRepos(uncatRepos);
    } else {
      const catRepos = await getReposByCategory(catId);
      setRepos(catRepos);
    }
  }, []);

  // 加载所有数据：分类 + 仓库列表
  const loadData = useCallback(async () => {
    try {
      await initDatabase();
      const cats = await getAllCategories();
      setCategories(cats);
      await loadRepos(selectedCategory);
    } catch (e) {
      console.error('load data failed:', e);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, loadRepos]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Android 硬件返回按钮退出应用
  useEffect(() => {
    const onBackPress = () => {
      Alert.alert(t('app.exitTitle'), t('app.exitMessage'), [
        { text: t('app.cancel'), style: 'cancel' },
        { text: t('app.exit'), style: 'destructive', onPress: () => BackHandler.exitApp() },
      ]);
      return true;
    };
    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, []);

  const onSelectCategory = async (catId) => {
    setSelectedCategory(catId);
    await loadRepos(catId);
  };

  // 从 GitHub 同步星标仓库，保存到本地后执行自动分类
  const handleSync = async () => {
    const token = await getGitHubToken();
    if (!token) {
      onTokenExpired();
      return;
    }
    setSyncing(true);
    setSyncInfo(t('home.syncInProgress'));
    try {
      const reposData = await fetchStarredRepos(token);
      const count = await saveRepos(reposData);
      const cats = await getAllCategories();
      await runAutoCategorize(cats, getUncategorizedRepos, batchSetRepoCategories);
      setSyncInfo(t('home.syncDone', { count, total: reposData.length }));
      setCategories(cats);
      await loadRepos(selectedCategory);
      setTimeout(() => setSyncInfo(''), 3000);
    } catch (e) {
      if (e instanceof TokenExpiredError) {
        onTokenExpired();
      } else {
        Alert.alert(t('home.syncFailed'), e.message);
      }
    } finally {
      setSyncing(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await handleSync();
    } finally {
      setRefreshing(false);
    }
  };

  const handleRepoLongPress = () => {
    Alert.alert(t('home.manageCategory'), t('home.manageCategoryMsg'), [
      { text: t('app.cancel'), style: 'cancel' },
      { text: t('app.go'), onPress: onOpenSettings },
    ]);
  };

  const handleAiAnalyze = () => {
    if (aiAnalyzing) {
      cancelAiRef.current = true;
      return;
    }
    Alert.alert(t('home.aiBatchTitle'), t('home.aiBatchMessage'), [
      { text: t('app.cancel'), style: 'cancel' },
      { text: t('home.aiAll'), onPress: () => runAiBatch('all') },
      { text: t('home.aiUnanalyzed'), onPress: () => runAiBatch('unanalyzed') },
      { text: t('home.aiFailed'), onPress: () => runAiBatch('failed') },
    ]);
  };

  const runAiBatch = async (mode) => {
    const config = await getActiveAiConfig();
    if (!config) {
      Alert.alert(t('app.confirm'), t('home.aiNoConfig'));
      return;
    }

    let targetRepos;
    if (mode === 'all') {
      targetRepos = await getAllRepos();
    } else if (mode === 'unanalyzed') {
      targetRepos = await getUnanalyzedRepos();
    } else {
      targetRepos = await getFailedAnalysisRepos();
    }

    if (targetRepos.length === 0) {
      Alert.alert(t('app.confirm'), t('home.aiNoRepos'));
      return;
    }

    cancelAiRef.current = false;
    setAiAnalyzing(true);
    setAiProgress({ current: 0, total: targetRepos.length, label: t('home.aiPreparing') });

    let success = 0;
    let fail = 0;
    for (let i = 0; i < targetRepos.length; i++) {
      if (cancelAiRef.current) break;
      const repo = targetRepos[i];
      setAiProgress({ current: i + 1, total: targetRepos.length, label: repo.full_name });
      try {
        const token = await getGitHubToken();
        let readmeContent = null;
        try {
          readmeContent = await fetchReadme(token, repo.full_name);
        } catch {
        }
        const result = await analyzeRepository(repo, readmeContent);
        await saveAiAnalysis(repo.repo_id, result.summary, result.tags, result.platforms);
        success++;
      } catch {
        await saveAiAnalysis(repo.repo_id, null, [], []);
        fail++;
      }
    }

    const wasCancelled = cancelAiRef.current;
    setAiAnalyzing(false);
    setAiProgress({ current: 0, total: 0, label: '' });
    await loadRepos(selectedCategory);
    const failedStr = fail > 0 ? t('home.aiFailSuffix', { count: fail }) : '';
    if (wasCancelled) {
      Alert.alert(t('home.aiStopped'), t('home.aiStoppedResult', { success, failed: failedStr }));
    } else {
      Alert.alert(t('home.aiCompleted'), t('home.aiCompletedResult', { success, failed: failedStr }));
    }
  };

  const currentCategoryName = selectedCategory === null
    ? t('home.allRepos')
    : selectedCategory === 0
      ? t('home.uncategorized')
      : categories.find(c => c.id === selectedCategory)?.name || t('home.allRepos');

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0366d6" />
        <Text style={styles.loadingText}>{t('home.loadingData')}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>{t('home.title')}</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={styles.headerBtn}
              onPress={handleSync}
              disabled={syncing}
            >
              <Ionicons
                name={syncing ? 'sync' : 'cloud-download'}
                size={22}
                color="#0366d6"
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.headerBtn, { backgroundColor: aiAnalyzing ? '#fde8e8' : '#f5f0ff' }]}
              onPress={handleAiAnalyze}
            >
              <Ionicons
                name={aiAnalyzing ? 'close' : 'sparkles'}
                size={22}
                color={aiAnalyzing ? '#d73a4a' : '#8b5cf6'}
              />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.headerBtn}
              onPress={onOpenSettings}
            >
              <Ionicons name="settings-outline" size={22} color="#0366d6" />
            </TouchableOpacity>
          </View>
        </View>
        {syncInfo ? (
          <Text style={styles.syncInfo}>{syncInfo}</Text>
        ) : null}
      </View>

      {aiAnalyzing ? (
        <View style={styles.aiProgressBar}>
          <ActivityIndicator size="small" color="#8b5cf6" />
          <Text style={styles.aiProgressText}>
            {t('home.aiProgress', { current: aiProgress.current, total: aiProgress.total })}
          </Text>
          <Text style={styles.aiProgressLabel} numberOfLines={1}>{aiProgress.label}</Text>
        </View>
      ) : null}

      <View style={styles.categoryTabs}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <TouchableOpacity
            style={[
              styles.categoryTab,
              selectedCategory === null && styles.categoryTabActive,
            ]}
            onPress={() => onSelectCategory(null)}
          >
            <Text
              style={[
                styles.categoryTabText,
                selectedCategory === null && styles.categoryTabTextActive,
              ]}
            >
              {t('home.allTab')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.categoryTab,
              selectedCategory === 0 && styles.categoryTabActive,
            ]}
            onPress={() => onSelectCategory(0)}
          >
            <Text
              style={[
                styles.categoryTabText,
                selectedCategory === 0 && styles.categoryTabTextActive,
              ]}
            >
              {t('home.uncategorized')}
            </Text>
          </TouchableOpacity>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.categoryTab,
                selectedCategory === cat.id && styles.categoryTabActive,
              ]}
              onPress={() => onSelectCategory(cat.id)}
            >
              <View
                style={[styles.categoryDot, { backgroundColor: cat.color }]}
              />
              <Text
                style={[
                  styles.categoryTabText,
                  selectedCategory === cat.id && styles.categoryTabTextActive,
                ]}
              >
                {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{currentCategoryName}</Text>
        <Text style={styles.sectionCount}>{t('home.count', { count: repos.length })}</Text>
      </View>

      {syncing ? (
        <View style={styles.syncingBar}>
          <ActivityIndicator size="small" color="#fff" />
          <Text style={styles.syncingText}>{t('home.syncing')}</Text>
        </View>
      ) : null}

      <FlatList
        data={repos}
        renderItem={({ item }) => (
          <RepoItem
            item={item}
            showCategory={selectedCategory === null || selectedCategory === 0}
            onPress={onOpenRepoDetail}
            onLongPress={handleRepoLongPress}
          />
        )}
        keyExtractor={(item) => String(item.id)}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="star-outline" size={48} color="#ccc" />
            <Text style={styles.emptyText}>
              {selectedCategory === 0
                ? t('home.noUncategorized')
                : t('home.noRepos')}
            </Text>
          </View>
        }
        contentContainerStyle={repos.length === 0 ? styles.emptyContainer : styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  loadingText: {
    marginTop: spacing.md,
    color: colors.textMuted,
    fontSize: 14,
  },
  header: {
    backgroundColor: colors.surface,
    paddingTop: Platform.OS === 'ios' ? 50 : spacing.xxxl,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: -0.5,
  },
  headerActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: borderRadius.md,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  syncInfo: {
    marginTop: spacing.sm,
    fontSize: 12,
    color: colors.accent,
  },
  categoryTabs: {
    backgroundColor: colors.surface,
    paddingVertical: spacing.md,
    paddingLeft: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  categoryTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    marginRight: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.categoryTab,
  },
  categoryTabActive: {
    backgroundColor: colors.categoryTabActive,
  },
  categoryTabText: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  categoryTabTextActive: {
    color: '#fff',
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: spacing.xs,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  sectionCount: {
    fontSize: 13,
    color: colors.textMuted,
  },
  syncingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  syncingText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '500',
  },
  aiProgressBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f0ff',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  aiProgressText: {
    color: colors.accentPurple,
    fontSize: 13,
    fontWeight: '500',
  },
  aiProgressLabel: {
    color: colors.accentPurple,
    fontSize: 11,
    flex: 1,
    textAlign: 'right',
  },
  listContent: {
    paddingTop: spacing.xs,
    paddingBottom: spacing.xxl,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 80,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
  },
  emptyText: {
    marginTop: spacing.lg,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
});
