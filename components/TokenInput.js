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
import { useTheme } from '../constants/ThemeContext';
import { useTranslation } from '../i18n';

export default function TokenInput({ onTokenSaved, onBack }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [token, setToken] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [visible, setVisible] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  useEffect(() => {
    const onBackPress = () => {
      if (onBack) {
        onBack();
        return true;
      }
      Alert.alert(t('app.exitTitle'), t('app.exitMessage'), [
        { text: t('app.cancel'), style: 'cancel' },
        { text: t('app.exit'), style: 'destructive', onPress: () => BackHandler.exitApp() },
      ]);
      return true;
    };
    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, [onBack]);

  const handleVerify = async () => {
    const trimmed = token.trim();
    if (!trimmed) {
      Alert.alert(t('common.confirm'), t('tokenInput.emptyToken'));
      return;
    }
    setVerifying(true);
    try {
      await fetchStarredRepos(trimmed);
      await setGitHubToken(trimmed);
      onTokenSaved();
    } catch (e) {
      Alert.alert(t('tokenInput.verifyFailed'), e.message);
    } finally {
      setVerifying(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <StatusBar style="dark" />
      {onBack ? (
        <View style={[styles.topBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <TouchableOpacity style={styles.topBarBack} onPress={onBack}>
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.topBarTitle, { color: colors.textPrimary }]}>{t('tokenInput.title')}</Text>
          <View style={styles.topBarBack} />
        </View>
      ) : null}
      <View style={styles.content}>
        <View style={[styles.iconWrap, { backgroundColor: colors.primary + '15' }]}>
          <Ionicons name="logo-github" size={64} color={colors.primary} />
        </View>
        <Text style={[styles.title, { color: colors.textPrimary }]}>GitHub Stars</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          {t('tokenInput.subtitle')}
        </Text>

        <View style={[styles.inputWrap, { borderColor: colors.border }]}>
          <TextInput
            style={[styles.input, { color: colors.textPrimary }]}
            value={token}
            onChangeText={setToken}
            placeholder={t('tokenInput.placeholder')}
            placeholderTextColor={colors.textMuted}
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
              color={colors.textMuted}
            />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.verifyBtn, { backgroundColor: colors.primary }, (!token.trim() || verifying) && { opacity: 0.6 }]}
          onPress={handleVerify}
          disabled={!token.trim() || verifying}
        >
          {verifying ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color="#fff" />
              <Text style={styles.verifyBtnText}>{t('tokenInput.save')}</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.helpBtn}
          onPress={() => setShowHelp(!showHelp)}
        >
          <Ionicons name="help-circle-outline" size={16} color={colors.primary} />
          <Text style={[styles.helpBtnText, { color: colors.primary }]}>{t('tokenInput.helpTitle')}</Text>
          <Ionicons
            name={showHelp ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={colors.primary}
          />
        </TouchableOpacity>

        {showHelp ? (
          <View style={[styles.helpPanel, { backgroundColor: colors.surfaceHover, borderColor: colors.border }]}>
            <Text style={[styles.helpStep, { color: colors.textSecondary }]}>{t('tokenInput.step1')}</Text>
            <Text style={[styles.helpStep, { color: colors.textSecondary }]}>{t('tokenInput.step2')}</Text>
            <Text style={[styles.helpStep, { color: colors.textSecondary }]}>{t('tokenInput.step3')}</Text>
            <Text style={[styles.helpStep, { color: colors.textSecondary }]}>{t('tokenInput.step4')}</Text>
            <TouchableOpacity
              style={styles.helpLink}
              onPress={() => Linking.openURL('https://github.com/settings/tokens')}
            >
              <Ionicons name="open-outline" size={14} color={colors.primary} />
              <Text style={[styles.helpLinkText, { color: colors.primary }]}>{t('tokenInput.gotoGithub')}</Text>
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
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
    paddingBottom: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    marginTop: 20,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 20,
  },
  inputWrap: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    marginTop: 24,
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    fontSize: 15,
    paddingVertical: 14,
  },
  eyeBtn: {
    padding: 8,
  },
  verifyBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: 14,
    gap: 8,
  },
  verifyBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  helpBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
    gap: 6,
  },
  helpBtnText: {
    fontSize: 14,
  },
  helpPanel: {
    width: '100%',
    borderRadius: 10,
    borderWidth: 1,
    padding: 16,
    marginTop: 14,
    gap: 10,
  },
  helpStep: {
    fontSize: 13,
    lineHeight: 20,
  },
  helpLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  helpLinkText: {
    fontSize: 13,
    fontWeight: '500',
  },
});
