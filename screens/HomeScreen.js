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
import { useTheme } from '../constants/ThemeContext';
import { useTranslation } from '../i18n';

export default function HomeScreen({ onTokenExpired, onOpenSettings, onOpenRepoDetail }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncInfo, setSyncInfo] = useState('');
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiProgress, setAiProgress] = useState({ current: 0, total: 0, label: '' });
  const cancelAiRef = useRef(false);

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
        } catch { }
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
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>{t('home.loadingData')}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={colors.background === '#0d1117' ? 'light' : 'dark'} />
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.headerTop}>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{t('home.title')}</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[styles.headerBtn, { backgroundColor: colors.background }]}
              onPress={handleSync}
              disabled={syncing}
            >
              <Ionicons name={syncing ? 'sync' : 'cloud-download'} size={22} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.headerBtn, { backgroundColor: aiAnalyzing ? colors.accentRed + '20' : colors.accentPurple + '15' }]}
              onPress={handleAiAnalyze}
            >
              <Ionicons name={aiAnalyzing ? 'close' : 'sparkles'} size={22} color={aiAnalyzing ? colors.accentRed : colors.accentPurple} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.headerBtn, { backgroundColor: colors.background }]}
              onPress={onOpenSettings}
            >
              <Ionicons name="settings-outline" size={22} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>
        {syncInfo ? (
          <Text style={[styles.syncInfo, { color: colors.accent }]}>{syncInfo}</Text>
        ) : null}
      </View>

      {aiAnalyzing ? (
        <View style={[styles.aiProgressBar, { backgroundColor: colors.accentPurple + '12' }]}>
          <ActivityIndicator size="small" color={colors.accentPurple} />
          <Text style={[styles.aiProgressText, { color: colors.accentPurple }]}>
            {t('home.aiProgress', { current: aiProgress.current, total: aiProgress.total })}
          </Text>
          <Text style={[styles.aiProgressLabel, { color: colors.textMuted }]} numberOfLines={1}>{aiProgress.label}</Text>
        </View>
      ) : null}

      <View style={[styles.categoryTabs, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <TouchableOpacity
            style={[styles.categoryTab, { backgroundColor: colors.categoryTab }, selectedCategory === null && { backgroundColor: colors.categoryTabActive }]}
            onPress={() => onSelectCategory(null)}
          >
            <Text style={[{ color: colors.textSecondary, fontSize: 13, fontWeight: '500' }, selectedCategory === null && styles.categoryTabTextActive]}>
              {t('home.allTab')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.categoryTab, { backgroundColor: colors.categoryTab }, selectedCategory === 0 && { backgroundColor: colors.categoryTabActive }]}
            onPress={() => onSelectCategory(0)}
          >
            <Text style={[{ color: colors.textSecondary, fontSize: 13, fontWeight: '500' }, selectedCategory === 0 && styles.categoryTabTextActive]}>
              {t('home.uncategorized')}
            </Text>
          </TouchableOpacity>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[styles.categoryTab, { backgroundColor: colors.categoryTab }, selectedCategory === cat.id && { backgroundColor: colors.categoryTabActive }]}
              onPress={() => onSelectCategory(cat.id)}
            >
              <View style={[styles.categoryDot, { backgroundColor: cat.color }]} />
              <Text style={[{ color: colors.textSecondary, fontSize: 13, fontWeight: '500' }, selectedCategory === cat.id && styles.categoryTabTextActive]}>
                {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{currentCategoryName}</Text>
        <Text style={[styles.sectionCount, { color: colors.textMuted }]}>{t('home.count', { count: repos.length })}</Text>
      </View>

      {syncing ? (
        <View style={[styles.syncingBar, { backgroundColor: colors.primary }]}>
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
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="star-outline" size={48} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              {selectedCategory === 0 ? t('home.noUncategorized') : t('home.noRepos')}
            </Text>
          </View>
        }
        contentContainerStyle={repos.length === 0 ? styles.emptyContainer : styles.listContent}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, fontSize: 14 },
  header: {
    paddingTop: Platform.OS === 'ios' ? 50 : 32, paddingBottom: 12,
    paddingHorizontal: 16, borderBottomWidth: 1,
  },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: 24, fontWeight: '700', letterSpacing: -0.5 },
  headerActions: { flexDirection: 'row', gap: 8 },
  headerBtn: { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  syncInfo: { marginTop: 8, fontSize: 12 },
  categoryTabs: { paddingVertical: 12, paddingLeft: 16, borderBottomWidth: 1 },
  categoryTab: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, marginRight: 8, borderRadius: 999 },
  categoryTabText: { fontSize: 13, color: '#fff', fontWeight: '500' },
  categoryTabTextActive: { color: '#fff' },
  categoryDot: { width: 8, height: 8, borderRadius: 4, marginRight: 4 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '600' },
  sectionCount: { fontSize: 13 },
  syncingBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, gap: 8 },
  syncingText: { color: '#fff', fontSize: 13, fontWeight: '500' },
  aiProgressBar: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 16, gap: 8 },
  aiProgressText: { fontSize: 13, fontWeight: '500' },
  aiProgressLabel: { fontSize: 12, flex: 1 },
  listContent: { paddingBottom: 40 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 80 },
  emptyText: { marginTop: 12, fontSize: 14, textAlign: 'center', lineHeight: 20 },
});