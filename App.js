import { useState, useEffect } from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { initDatabase, getGitHubToken } from './services/database';
import TokenInput from './components/TokenInput';
import ScreenTransition from './components/ScreenTransition';
import HomeScreen from './screens/HomeScreen';
import SettingsScreen from './screens/SettingsScreen';
import RepoDetailScreen from './screens/RepoDetailScreen';
import CategoryManageScreen from './screens/CategoryManageScreen';
import AiConfigScreen from './screens/AiConfigScreen';
import StatsScreen from './screens/StatsScreen';

export default function App() {
  // 当前显示的页面：loading / token_input / home / settings / repo_detail / category_manage
  const [screen, setScreen] = useState('loading');
  const [selectedRepo, setSelectedRepo] = useState(null);
  const [prevScreen, setPrevScreen] = useState('home');

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

  const handleOpenCategoryManage = (fromScreen) => {
    setPrevScreen(fromScreen);
    setScreen('category_manage');
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
    return (
      <ScreenTransition id="token_input">
        <TokenInput onTokenSaved={handleTokenSaved} />
      </ScreenTransition>
    );
  }

  if (screen === 'settings') {
    return (
      <ScreenTransition id="settings">
        <SettingsScreen
          onGoBack={() => setScreen('home')}
          onTokenExpired={handleTokenExpired}
          onOpenAiConfig={() => setScreen('ai_config')}
          onOpenStats={() => setScreen('stats')}
          onOpenCategoryManage={() => handleOpenCategoryManage('settings')}
        />
      </ScreenTransition>
    );
  }

  if (screen === 'repo_detail' && selectedRepo) {
    return (
      <ScreenTransition id="repo_detail">
        <RepoDetailScreen
          repo={selectedRepo}
          onGoBack={handleCloseRepoDetail}
        />
      </ScreenTransition>
    );
  }

  if (screen === 'category_manage') {
    return (
      <ScreenTransition id="category_manage">
        <CategoryManageScreen
          onGoBack={() => setScreen(prevScreen)}
        />
      </ScreenTransition>
    );
  }

  if (screen === 'ai_config') {
    return (
      <ScreenTransition id="ai_config">
        <AiConfigScreen
          onGoBack={() => setScreen('settings')}
        />
      </ScreenTransition>
    );
  }

  if (screen === 'stats') {
    return (
      <ScreenTransition id="stats">
        <StatsScreen
          onGoBack={() => setScreen('settings')}
        />
      </ScreenTransition>
    );
  }

  return (
    <ScreenTransition id="home">
      <HomeScreen
        onTokenExpired={handleTokenExpired}
        onOpenSettings={() => setScreen('settings')}
        onOpenRepoDetail={handleOpenRepoDetail}
      />
    </ScreenTransition>
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
