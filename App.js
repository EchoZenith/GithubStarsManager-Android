import { useState, useEffect } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { initDatabase, getGitHubToken } from './services/database';
import TokenInput from './components/TokenInput';
import HomeScreen from './screens/HomeScreen';
import SettingsScreen from './screens/SettingsScreen';
import RepoDetailScreen from './screens/RepoDetailScreen';
import CategoryManageScreen from './screens/CategoryManageScreen';

export default function App() {
  // 当前显示的页面：loading / token_input / home / settings / repo_detail / category_manage
  const [screen, setScreen] = useState('loading');
  const [selectedRepo, setSelectedRepo] = useState(null);

  // 启动时检查是否已存在 Token，决定进入首页或 Token 输入页
  useEffect(() => {
    checkToken();
  }, []);

  const checkToken = async () => {
    try {
      await initDatabase();
      const token = await getGitHubToken();
      setScreen(token ? 'home' : 'token_input');
    } catch (e) {
      console.error('初始化失败:', e);
      setScreen('token_input');
    }
  };

  const handleTokenSaved = () => {
    setScreen('home');
  };

  const handleTokenExpired = () => {
    setScreen('token_input');
  };

  const handleOpenRepoDetail = (repo) => {
    setSelectedRepo(repo);
    setScreen('repo_detail');
  };

  const handleCloseRepoDetail = () => {
    setSelectedRepo(null);
    setScreen('home');
  };

  // 根据 screen 状态渲染对应页面
  if (screen === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0366d6" />
        <Text style={styles.loadingText}>启动中...</Text>
      </View>
    );
  }

  if (screen === 'token_input') {
    return <TokenInput onTokenSaved={handleTokenSaved} />;
  }

  if (screen === 'settings') {
    return (
      <SettingsScreen
        onGoBack={() => setScreen('home')}
        onTokenExpired={handleTokenExpired}
      />
    );
  }

  if (screen === 'repo_detail' && selectedRepo) {
    return (
      <RepoDetailScreen
        repo={selectedRepo}
        onGoBack={handleCloseRepoDetail}
      />
    );
  }

  if (screen === 'category_manage') {
    return (
      <CategoryManageScreen
        onGoBack={() => setScreen('home')}
      />
    );
  }

  return (
    <HomeScreen
      onTokenExpired={handleTokenExpired}
      onOpenSettings={() => setScreen('settings')}
      onOpenRepoDetail={handleOpenRepoDetail}
      onOpenCategoryManage={() => setScreen('category_manage')}
    />
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    color: '#888',
    fontSize: 14,
  },
});
