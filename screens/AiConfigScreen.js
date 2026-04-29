import { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, StyleSheet, TouchableOpacity, ScrollView,
  Alert, ActivityIndicator, Platform, BackHandler
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { getAiProviders, saveAiProviders, migrateOldAiConfig } from '../services/database';
import { verifyAiConfig } from '../services/ai';
import { colors } from '../constants/theme';

const DEFAULT_ENDPOINTS = [
  { name: 'DeepSeek', endpoint: 'https://api.deepseek.com', model: 'deepseek-v4-flash' },
  { name: 'OpenAI', endpoint: 'https://api.openai.com/v1', model: 'gpt-3.5-turbo' },
  { name: '硅基流动', endpoint: 'https://api.siliconflow.cn/v1', model: 'deepseek-ai/DeepSeek-V3' },
  { name: '自定义', endpoint: '', model: '' },
];

export default function AiConfigScreen({ onGoBack }) {
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [formName, setFormName] = useState('');
  const [formEndpoint, setFormEndpoint] = useState('');
  const [formModel, setFormModel] = useState('');
  const [formKey, setFormKey] = useState('');
  const [keyVisible, setKeyVisible] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [showPreset, setShowPreset] = useState(false);
  const goBackRef = useRef(onGoBack);
  goBackRef.current = onGoBack;

  const loadProviders = async () => {
    await migrateOldAiConfig();
    const list = await getAiProviders();
    setProviders(list);
    setLoading(false);
  };

  useEffect(() => {
    loadProviders();
  }, []);

  useEffect(() => {
    const onBackPress = () => {
      goBackRef.current();
      return true;
    };
    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setFormName('');
    setFormEndpoint('');
    setFormModel('');
    setFormKey('');
    setKeyVisible(false);
    setShowPreset(false);
  };

  const openNewForm = () => {
    resetForm();
    setShowPreset(true);
  };

  const openEditForm = (p) => {
    setEditingId(p.id);
    setFormName(p.name);
    setFormEndpoint(p.endpoint);
    setFormModel(p.model);
    setFormKey(p.apiKey);
    setShowPreset(false);
  };

  const applyPreset = (preset) => {
    setFormName(preset.name);
    setFormEndpoint(preset.endpoint);
    setFormModel(preset.model);
    setShowPreset(false);
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      Alert.alert('提示', '请输入名称');
      return;
    }
    if (!formKey.trim()) {
      Alert.alert('提示', '请输入 API Key');
      return;
    }
    if (!formEndpoint.trim()) {
      Alert.alert('提示', '请输入 API Endpoint');
      return;
    }

    let updated;
    if (editingId) {
      updated = providers.map(p =>
        p.id === editingId
          ? { ...p, name: formName.trim(), endpoint: formEndpoint.trim(), model: formModel.trim(), apiKey: formKey.trim() }
          : p
      );
    } else {
      const newProvider = {
        id: Date.now().toString(),
        name: formName.trim(),
        endpoint: formEndpoint.trim(),
        model: formModel.trim(),
        apiKey: formKey.trim(),
        active: providers.length === 0,
      };
      updated = [...providers, newProvider];
    }
    await saveAiProviders(updated);
    setProviders(updated);
    resetForm();
  };

  const handleDelete = (id) => {
    const target = providers.find(p => p.id === id);
    Alert.alert('删除', `确定要删除「${target.name}」吗？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          const remaining = providers.filter(p => p.id !== id);
          if (target.active && remaining.length > 0) {
            remaining[0].active = true;
          }
          await saveAiProviders(remaining);
          setProviders(remaining);
          if (editingId === id) resetForm();
        },
      },
    ]);
  };

  const handleSetActive = async (id) => {
    const updated = providers.map(p => ({ ...p, active: p.id === id }));
    await saveAiProviders(updated);
    setProviders(updated);
  };

  const handleVerify = async () => {
    if (!editingId) {
      Alert.alert('提示', '请先保存当前配置');
      return;
    }
    const p = providers.find(pr => pr.id === editingId);
    if (!p) return;
    setVerifying(true);
    try {
      await verifyAiConfig(p.apiKey, p.endpoint, p.model);
      Alert.alert('验证成功', '连接有效');
    } catch (e) {
      Alert.alert('验证失败', e.message);
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#8b5cf6" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={onGoBack}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>AI 配置</Text>
        <TouchableOpacity style={styles.headerBtn} onPress={openNewForm}>
          <Ionicons name="add" size={26} color="#8b5cf6" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} keyboardShouldPersistTaps="handled">

        {showPreset ? (
          <View style={styles.presetRow}>
            {DEFAULT_ENDPOINTS.map((preset) => (
              <TouchableOpacity
                key={preset.name}
                style={styles.presetBtn}
                onPress={() => applyPreset(preset)}
              >
                <Text style={styles.presetBtnText}>{preset.name}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        {(editingId !== null || formName || formKey || showPreset) ? (
          <View style={styles.formCard}>
            <Text style={styles.formTitle}>{editingId ? '编辑' : '新增'} Provider</Text>
            <Text style={styles.fieldLabel}>名称</Text>
            <TextInput
              style={styles.input}
              value={formName}
              onChangeText={setFormName}
              placeholder="例如 DeepSeek、OpenAI"
              placeholderTextColor="#bbb"
            />
            <Text style={styles.fieldLabel}>API Endpoint</Text>
            <TextInput
              style={styles.input}
              value={formEndpoint}
              onChangeText={setFormEndpoint}
              placeholder="https://api.deepseek.com"
              placeholderTextColor="#bbb"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.fieldLabel}>模型名称</Text>
            <TextInput
              style={styles.input}
              value={formModel}
              onChangeText={setFormModel}
              placeholder="deepseek-chat"
              placeholderTextColor="#bbb"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Text style={styles.fieldLabel}>API Key</Text>
            <View style={styles.keyRow}>
              <TextInput
                style={styles.keyInput}
                value={formKey}
                onChangeText={setFormKey}
                placeholder="sk-xxxxxxxxxxxxxxxx"
                placeholderTextColor="#bbb"
                secureTextEntry={!keyVisible}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setKeyVisible(!keyVisible)}>
                <Ionicons name={keyVisible ? 'eye-off' : 'eye'} size={20} color="#999" />
              </TouchableOpacity>
            </View>
            <View style={styles.formActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={resetForm}>
                <Text style={styles.cancelBtnText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
                <Text style={styles.saveBtnText}>{editingId ? '更新' : '添加'}</Text>
              </TouchableOpacity>
              {editingId ? (
                <TouchableOpacity
                  style={[styles.saveBtn, { backgroundColor: '#8b5cf6' }]}
                  onPress={handleVerify}
                  disabled={verifying}
                >
                  {verifying ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.saveBtnText}>验证</Text>
                  )}
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        ) : null}

        {providers.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="sparkles" size={48} color="#ddd" />
            <Text style={styles.emptyText}>暂无 AI 配置</Text>
            <Text style={styles.emptySubtext}>点击右上角 + 添加</Text>
          </View>
        ) : (
          providers.map((p) => {
            const isEditing = editingId === p.id;
            return (
              <TouchableOpacity
                key={p.id}
                style={[styles.providerItem, isEditing && styles.providerItemActive]}
                onPress={() => openEditForm(p)}
                activeOpacity={0.7}
              >
                <View style={styles.providerLeft}>
                  <TouchableOpacity
                    style={[styles.radio, p.active && styles.radioActive]}
                    onPress={() => handleSetActive(p.id)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    {p.active ? <View style={styles.radioDot} /> : null}
                  </TouchableOpacity>
                  <View style={styles.providerInfo}>
                    <View style={styles.providerNameRow}>
                      <Text style={styles.providerName}>{p.name}</Text>
                      {p.active ? (
                        <View style={styles.activeBadge}>
                          <Text style={styles.activeBadgeText}>使用中</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.providerDetail} numberOfLines={1}>{p.model}</Text>
                    <Text style={styles.providerDetail} numberOfLines={1}>{p.endpoint}</Text>
                  </View>
                </View>
                <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDelete(p.id)}>
                  <Ionicons name="trash-outline" size={18} color="#d73a4a" />
                </TouchableOpacity>
              </TouchableOpacity>
            );
          })
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', paddingTop: Platform.OS === 'ios' ? 50 : 40,
    paddingBottom: 10, paddingHorizontal: 8,
    borderBottomWidth: 1, borderBottomColor: '#e8e8e8',
  },
  headerBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '600', color: '#1a1a1a' },
  scroll: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  presetRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12,
  },
  presetBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#f0ecff', borderWidth: 1, borderColor: '#e0d8ff',
  },
  presetBtnText: { fontSize: 13, color: '#8b5cf6', fontWeight: '500' },
  formCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12,
    elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1, shadowRadius: 3,
  },
  formTitle: { fontSize: 16, fontWeight: '600', color: '#1a1a1a', marginBottom: 12 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: '#666', marginBottom: 6, marginTop: 8 },
  input: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 10, padding: 12,
    fontSize: 15, color: '#333', backgroundColor: '#fafafa',
  },
  keyRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: '#ddd', borderRadius: 10, backgroundColor: '#fafafa',
  },
  keyInput: { flex: 1, padding: 12, fontSize: 15, color: '#333' },
  eyeBtn: { padding: 12 },
  formActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  cancelBtn: {
    flex: 1, padding: 14, borderRadius: 10, alignItems: 'center',
    borderWidth: 1, borderColor: '#ddd',
  },
  cancelBtnText: { fontSize: 15, color: '#666', fontWeight: '500' },
  saveBtn: {
    flex: 1, padding: 14, borderRadius: 10, alignItems: 'center', backgroundColor: '#0366d6',
  },
  saveBtnText: { fontSize: 15, color: '#fff', fontWeight: '600' },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 16, color: '#999', marginTop: 12 },
  emptySubtext: { fontSize: 13, color: '#ccc', marginTop: 4 },
  providerItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8,
    elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 2,
  },
  providerItemActive: {
    borderWidth: 1.5, borderColor: '#8b5cf6',
  },
  providerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  radio: {
    width: 22, height: 22, borderRadius: 11, borderWidth: 2,
    borderColor: '#ccc', justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  radioActive: { borderColor: '#8b5cf6' },
  radioDot: {
    width: 12, height: 12, borderRadius: 6, backgroundColor: '#8b5cf6',
  },
  providerInfo: { flex: 1 },
  providerNameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  providerName: { fontSize: 15, fontWeight: '600', color: '#333' },
  activeBadge: {
    backgroundColor: '#f0ecff', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8,
  },
  activeBadgeText: { fontSize: 10, color: '#8b5cf6', fontWeight: '600' },
  providerDetail: { fontSize: 12, color: '#999', marginTop: 2 },
  deleteBtn: { padding: 8 },
});
