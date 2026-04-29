import { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, Linking,
  Platform, KeyboardAvoidingView, BackHandler
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { setGitHubToken } from '../services/database';
import { fetchStarredRepos } from '../services/github';
import { colors } from '../constants/theme';

// Token 输入页：输入/验证 GitHub Personal Access Token
export default function TokenInput({ onTokenSaved, onBack }) {
  const [token, setToken] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [visible, setVisible] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  // Android 硬件返回按钮
  useEffect(() => {
    const onBackPress = () => {
      if (onBack) {
        onBack();
        return true;
      }
      Alert.alert('退出应用', '确定要退出吗？', [
        { text: '取消', style: 'cancel' },
        { text: '退出', style: 'destructive', onPress: () => BackHandler.exitApp() },
      ]);
      return true;
    };
    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [onBack]);

  // 验证 Token：调用 GitHub API 确认有效后再保存
  const handleVerify = async () => {
    const trimmed = token.trim();
    if (!trimmed) {
      Alert.alert('提示', '请输入 GitHub Token');
      return;
    }
    setVerifying(true);
    try {
      await fetchStarredRepos(trimmed);
      await setGitHubToken(trimmed);
      onTokenSaved();
    } catch (e) {
      Alert.alert('验证失败', e.message);
    } finally {
      setVerifying(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style="dark" />
      {onBack ? (
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.topBarBack} onPress={onBack}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.topBarTitle}>设置 Token</Text>
          <View style={styles.topBarBack} />
        </View>
      ) : null}
      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Ionicons name="logo-github" size={64} color="#0366d6" />
        </View>
        <Text style={styles.title}>GitHub Stars</Text>
        <Text style={styles.subtitle}>
          请输入你的 GitHub Personal Access Token 以同步星标仓库
        </Text>

        <View style={styles.inputWrap}>
          <TextInput
            style={styles.input}
            value={token}
            onChangeText={setToken}
            placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
            placeholderTextColor="#bbb"
            secureTextEntry={!visible}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={styles.eyeBtn}
            onPress={() => setVisible(!visible)}
          >
            <Ionicons
              name={visible ? 'eye-off' : 'eye'}
              size={20}
              color="#999"
            />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.verifyBtn, (!token.trim() || verifying) && styles.verifyBtnDisabled]}
          onPress={handleVerify}
          disabled={!token.trim() || verifying}
        >
          {verifying ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={styles.verifyBtnText}>验证并保存</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.helpBtn}
          onPress={() => setShowHelp(!showHelp)}
        >
          <Ionicons name="help-circle-outline" size={16} color="#0366d6" />
          <Text style={styles.helpBtnText}>如何创建 GitHub Token？</Text>
          <Ionicons
            name={showHelp ? 'chevron-up' : 'chevron-down'}
            size={16}
            color="#0366d6"
          />
        </TouchableOpacity>

        {showHelp ? (
          <View style={styles.helpPanel}>
            <Text style={styles.helpStep}>
              1. 访问 GitHub Settings → Developer settings → Personal access tokens
            </Text>
            <Text style={styles.helpStep}>
              2. 点击 "Generate new token (classic)"
            </Text>
            <Text style={styles.helpStep}>
              3. 选择权限范围：repo 和 user
            </Text>
            <Text style={styles.helpStep}>
              4. 复制生成的 token 并粘贴到上方输入框
            </Text>
            <TouchableOpacity
              style={styles.helpLink}
              onPress={() => Linking.openURL('https://github.com/settings/tokens')}
            >
              <Ionicons name="open-outline" size={14} color="#0366d6" />
              <Text style={styles.helpLinkText}>前往 GitHub 生成 Token</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
    paddingBottom: 10,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e8e8e8',
  },
  topBarBack: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBarTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  iconWrap: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#f0f7ff',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
    paddingHorizontal: 10,
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    backgroundColor: '#fff',
    marginBottom: 16,
  },
  input: {
    flex: 1,
    padding: 14,
    fontSize: 14,
    color: '#333',
  },
  eyeBtn: {
    padding: 14,
  },
  verifyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0366d6',
    padding: 16,
    borderRadius: 12,
    width: '100%',
    gap: 8,
  },
  verifyBtnDisabled: {
    backgroundColor: '#99c9ff',
  },
  verifyBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  helpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    gap: 4,
  },
  helpBtnText: {
    fontSize: 13,
    color: '#0366d6',
  },
  helpPanel: {
    width: '100%',
    backgroundColor: '#f0f7ff',
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#d0e3ff',
  },
  helpStep: {
    fontSize: 13,
    color: '#444',
    lineHeight: 20,
    marginBottom: 8,
    paddingLeft: 4,
  },
  helpLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#0366d6',
    gap: 6,
  },
  helpLinkText: {
    fontSize: 13,
    color: '#0366d6',
    fontWeight: '500',
  },
});
