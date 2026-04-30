import { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Alert, ActivityIndicator, Platform, BackHandler
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import {
  getAllCategories, addCategory, updateCategory, deleteCategory,
  getUncategorizedRepos, batchSetRepoCategories, getRepoCountByCategory
} from '../services/database';
import { runAutoCategorize } from '../services/categorizer';
import { useTheme } from '../constants/ThemeContext';
import { useTranslation } from '../i18n';

// 可选的颜色列表（给分类标签选择用）
const CAT_COLORS = ['#0366d6', '#28a745', '#d73a4a', '#6f42c1', '#e36209', '#19b5a0', '#f0ad4e', '#8b5cf6', '#1abc9c', '#3498db', '#9b59b6', '#e67e22', '#2c3e50'];

// 分类管理页：查看/新增/编辑/删除分类
export default function CategoryManageScreen({ onGoBack }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [categories, setCategories] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const goBackRef = useRef(onGoBack);
  goBackRef.current = onGoBack;

  // 表单状态
  const [showForm, setShowForm] = useState(false);
  const [editingCat, setEditingCat] = useState(null);
  const [formName, setFormName] = useState('');
  const [formColor, setFormColor] = useState(CAT_COLORS[0]);

  // 加载分类列表及各分类的仓库数量
  const loadData = async () => {
    const cats = await getAllCategories();
    setCategories(cats);
    const counts = await getRepoCountByCategory();
    const statsMap = {};
    for (const c of counts) {
      statsMap[c.id] = c.repo_count;
    }
    setStats(statsMap);
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, []);

  // Android 硬件返回按钮
  useEffect(() => {
    const onBackPress = () => {
      goBackRef.current();
      return true;
    };
    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, []);

  const openAddForm = () => {
    setEditingCat(null);
    setFormName('');
    setFormColor(CAT_COLORS[0]);
    setShowForm(true);
  };

  const openEditForm = (cat) => {
    setEditingCat(cat);
    setFormName(cat.name);
    setFormColor(cat.color);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingCat(null);
    setFormName('');
  };

  // 保存分类：新增时自动触发未分类仓库的自动归类
  const handleSave = async () => {
    const trimmed = formName.trim();
    if (!trimmed) {
      Alert.alert(t('common.confirm'), t('categoryManage.nameRequired'));
      return;
    }
    try {
      if (editingCat) {
        await updateCategory(editingCat.id, trimmed, formColor);
      } else {
        await addCategory(trimmed, formColor);
        // 新增分类后自动将未分类仓库匹配到新分类
        const cats = await getAllCategories();
        await runAutoCategorize(cats, getUncategorizedRepos, batchSetRepoCategories);
      }
      closeForm();
      await loadData();
    } catch (e) {
      Alert.alert(t('common.confirm'), e.message || t('categoryManage.saveFailed'));
    }
  };

  // 删除分类（该分类下的仓库变为未分类）
  const handleDelete = (cat) => {
    Alert.alert(
      t('categoryManage.deleteTitle'),
      t('categoryManage.deleteConfirm', { name: cat.name }),
      [
        { text: t('app.cancel'), style: 'cancel' },
        {
          text: t('app.delete'),
          style: 'destructive',
          onPress: async () => {
            await deleteCategory(cat.id);
            await loadData();
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={colors.background === '#0d1117' ? 'light' : 'dark'} />
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.headerBtn} onPress={onGoBack}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{t('categoryManage.title')}</Text>
        <TouchableOpacity style={styles.headerBtn} onPress={openAddForm}>
          <Ionicons name="add" size={26} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={[styles.scroll, { backgroundColor: colors.background }]}>

        {showForm ? (
          <View style={[styles.formCard, { backgroundColor: colors.surface }]}>
            <Text style={[styles.formTitle, { color: colors.textPrimary }]}>
              {editingCat ? t('categoryManage.editCategory') : t('categoryManage.newCategory')}
            </Text>
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{t('categoryManage.nameLabel')}</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.background, borderColor: colors.border, color: colors.textPrimary }]}
              value={formName}
              onChangeText={setFormName}
              placeholder={t('categoryManage.inputPlaceholder')}
              placeholderTextColor={colors.textMuted}
              autoFocus
            />
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{t('categoryManage.colorLabel')}</Text>
            <View style={styles.colorPicker}>
              {CAT_COLORS.map((color) => (
                <TouchableOpacity
                  key={color}
                  onPress={() => setFormColor(color)}
                  style={[
                    styles.colorOption,
                    { backgroundColor: color },
                    formColor === color && { borderColor: colors.textPrimary },
                  ]}
                />
              ))}
            </View>
            <View style={styles.formActions}>
              <TouchableOpacity style={[styles.cancelBtn, { borderColor: colors.border }]} onPress={closeForm}>
                <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>{t('app.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveBtn, { backgroundColor: colors.primary }]} onPress={handleSave}>
                <Text style={styles.saveBtnText}>
                  {editingCat ? t('app.update') : t('categoryManage.saveBtn')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {categories.map((cat) => (
          <View key={cat.id} style={[styles.catItem, { backgroundColor: colors.surface }]}>
            <View style={styles.catItemLeft}>
              <View style={[styles.catDot, { backgroundColor: cat.color }]} />
              <View style={styles.catItemInfo}>
                <Text style={[styles.catItemName, { color: colors.textPrimary }]}>{cat.name}</Text>
                <Text style={[styles.catItemCount, { color: colors.textMuted }]}>
                  {t('categoryManage.repoCount', { count: stats[cat.id] || 0 })}
                </Text>
              </View>
            </View>
            <View style={styles.catItemActions}>
              <TouchableOpacity
                style={styles.catActionBtn}
                onPress={() => openEditForm(cat)}
              >
                <Ionicons name="pencil" size={18} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.catActionBtn}
                onPress={() => handleDelete(cat)}
              >
                <Ionicons name="trash" size={18} color={colors.accentRed} />
              </TouchableOpacity>
            </View>
          </View>
        ))}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 50 : 40, paddingBottom: 10,
    paddingHorizontal: 8, borderBottomWidth: 1,
  },
  headerBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 17, fontWeight: '600' },
  scroll: { flex: 1, paddingHorizontal: 16, paddingTop: 12 },
  formCard: { borderRadius: 12, padding: 16, marginBottom: 12 },
  formTitle: { fontSize: 16, fontWeight: '600', marginBottom: 12 },
  fieldLabel: { fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 8 },
  input: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 15 },
  colorPicker: { flexDirection: 'row', gap: 10, marginBottom: 8, flexWrap: 'wrap' },
  colorOption: { width: 36, height: 36, borderRadius: 18, borderWidth: 3, borderColor: 'transparent' },
  formActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 10, alignItems: 'center', borderWidth: 1 },
  cancelBtnText: { fontSize: 15, fontWeight: '500' },
  saveBtn: { flex: 1, padding: 14, borderRadius: 10, alignItems: 'center' },
  saveBtnText: { fontSize: 15, color: '#fff', fontWeight: '600' },
  catItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: 12, padding: 14, marginBottom: 8 },
  catItemLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  catDot: { width: 14, height: 14, borderRadius: 7, marginRight: 12 },
  catItemInfo: { flex: 1 },
  catItemName: { fontSize: 15, fontWeight: '500' },
  catItemCount: { fontSize: 12, marginTop: 2 },
  catItemActions: { flexDirection: 'row', gap: 8 },
  catActionBtn: { padding: 6 },
});
