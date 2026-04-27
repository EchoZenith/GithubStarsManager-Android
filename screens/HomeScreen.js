import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  Alert, ActivityIndicator, RefreshControl,
  ScrollView, Platform, BackHandler
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import RepoItem from '../components/RepoItem';
import { fetchStarredRepos, TokenExpiredError } from '../services/github';
import {
  initDatabase, getAllCategories, saveRepos, getAllRepos, getReposByCategory,
  getUncategorizedRepos, getGitHubToken, batchSetRepoCategories
} from '../services/database';
import { runAutoCategorize } from '../services/categorizer';

// 首页：仓库列表、分类标签栏、同步入口
export default function HomeScreen({ onTokenExpired, onOpenSettings, onOpenRepoDetail, onOpenCategoryManage }) {
  const [categories, setCategories] = useState([]);
  // selectedCategory: null=全部, 0=未分类, >0=具体分类 ID
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [repos, setRepos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncInfo, setSyncInfo] = useState('');

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
      console.error('加载数据失败:', e);
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
      Alert.alert('退出应用', '确定要退出吗？', [
        { text: '取消', style: 'cancel' },
        { text: '退出', style: 'destructive', onPress: () => BackHandler.exitApp() },
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
    setSyncInfo('正在从 GitHub 获取星标仓库...');
    try {
      const reposData = await fetchStarredRepos(token);
      const count = await saveRepos(reposData);
      const cats = await getAllCategories();
      await runAutoCategorize(cats, getUncategorizedRepos, batchSetRepoCategories);
      setSyncInfo(`同步完成，新增 ${count} 个仓库（共 ${reposData.length} 个）`);
      setCategories(cats);
      await loadRepos(selectedCategory);
      setTimeout(() => setSyncInfo(''), 3000);
    } catch (e) {
      if (e instanceof TokenExpiredError) {
        onTokenExpired();
      } else {
        Alert.alert('同步失败', e.message);
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

  // 长按仓库时提示去分类管理页操作
  const handleRepoLongPress = () => {
    Alert.alert('管理分类', '请前往分类管理页面设置仓库分类', [
      { text: '取消', style: 'cancel' },
      { text: '前往', onPress: onOpenCategoryManage },
    ]);
  };

  const currentCategoryName = selectedCategory === null
    ? '全部仓库'
    : selectedCategory === 0
      ? '未分类'
      : categories.find(c => c.id === selectedCategory)?.name || '全部仓库';

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0366d6" />
        <Text style={styles.loadingText}>加载中...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>GitHub Stars</Text>
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
              style={styles.headerBtn}
              onPress={onOpenCategoryManage}
            >
              <Ionicons name="folder-open" size={22} color="#0366d6" />
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
              全部
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
              未分类
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
        <Text style={styles.sectionCount}>{repos.length} 个仓库</Text>
      </View>

      {syncing ? (
        <View style={styles.syncingBar}>
          <ActivityIndicator size="small" color="#fff" />
          <Text style={styles.syncingText}>同步中...</Text>
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
                ? '没有未分类的仓库'
                : '暂无仓库数据\n点击右上角 ☁️ 按钮从 GitHub 同步'}
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
    backgroundColor: '#f5f5f5',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#888',
    fontSize: 14,
  },
  header: {
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
    paddingBottom: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e8e8e8',
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#f0f7ff',
  },
  syncInfo: {
    marginTop: 6,
    fontSize: 12,
    color: '#28a745',
  },
  categoryTabs: {
    backgroundColor: '#fff',
    paddingVertical: 10,
    paddingLeft: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  categoryTab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginRight: 8,
    borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  categoryTabActive: {
    backgroundColor: '#0366d6',
  },
  categoryTabText: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  categoryTabTextActive: {
    color: '#fff',
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 5,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  sectionCount: {
    fontSize: 13,
    color: '#999',
  },
  syncingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0366d6',
    paddingVertical: 6,
    gap: 8,
  },
  syncingText: {
    color: '#fff',
    fontSize: 13,
  },
  listContent: {
    paddingBottom: 20,
  },
  emptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
    lineHeight: 20,
  },
});
