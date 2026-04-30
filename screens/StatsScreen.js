import { useState, useEffect, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Platform, BackHandler
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import {
  getAllCategories, getTotalRepoCount,
  getRepoCountByCategory,
} from '../services/database';
import { useTheme } from '../constants/ThemeContext';
import { useTranslation } from '../i18n';

export default function StatsScreen({ onGoBack }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [stats, setStats] = useState({ repos: 0, categories: 0 });
  const [categoryStats, setCategoryStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const goBackRef = useRef(onGoBack);

  useEffect(() => {
    goBackRef.current = onGoBack;
  });

  useEffect(() => {
    const load = async () => {
      const cats = await getAllCategories();
      const total = await getTotalRepoCount();
      setStats({ repos: total, categories: cats.length });
      const counts = await getRepoCountByCategory();
      setCategoryStats(counts);
      setLoading(false);
    };
    load();
  }, []);

  useEffect(() => {
    const onBackPress = () => {
      goBackRef.current();
      return true;
    };
    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style="dark" />
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity style={styles.backBtn} onPress={onGoBack}>
          <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{t('stats.title')}</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView style={styles.scroll}>
        <View style={styles.overviewRow}>
          <View style={[styles.overviewCard, { backgroundColor: colors.surface }]}>
            <Ionicons name="star" size={32} color="#f0ad4e" />
            <Text style={[styles.overviewNumber, { color: colors.textPrimary }]}>{stats.repos}</Text>
            <Text style={[styles.overviewLabel, { color: colors.textSecondary }]}>{t('stats.totalRepos')}</Text>
          </View>
          <View style={[styles.overviewCard, { backgroundColor: colors.surface }]}>
            <Ionicons name="folder" size={32} color={colors.primary} />
            <Text style={[styles.overviewNumber, { color: colors.textPrimary }]}>{stats.categories}</Text>
            <Text style={[styles.overviewLabel, { color: colors.textSecondary }]}>{t('stats.categoriesLabel')}</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Ionicons name="bar-chart" size={16} color={colors.textSecondary} />
          <Text style={[styles.sectionHeaderText, { color: colors.textPrimary }]}>{t('stats.categoryDist')}</Text>
        </View>

        {categoryStats.map((cat) => (
          <View key={cat.id} style={[styles.catRow, { backgroundColor: colors.surface, borderBottomColor: colors.borderLight }]}>
            <View style={styles.catLeft}>
              <View style={[styles.catDot, { backgroundColor: cat.color }]} />
              <Text style={[styles.catName, { color: colors.textPrimary }]}>{cat.name}</Text>
            </View>
            <View style={[styles.catBarWrap, { backgroundColor: colors.borderLight }]}>
              <View
                style={[
                  styles.catBar,
                  {
                    width: stats.repos > 0 ? `${(cat.repo_count / stats.repos) * 100}%` : '0%',
                    backgroundColor: cat.color,
                  },
                ]}
              />
            </View>
            <Text style={[styles.catCount, { color: colors.textSecondary }]}>{cat.repo_count}</Text>
          </View>
        ))}

        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  scroll: {
    flex: 1,
    padding: 16,
  },
  overviewRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  overviewCard: {
    flex: 1,
    alignItems: 'center',
    padding: 20,
    borderRadius: 12,
  },
  overviewNumber: {
    fontSize: 28,
    fontWeight: '700',
    marginTop: 8,
  },
  overviewLabel: {
    fontSize: 13,
    marginTop: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  sectionHeaderText: {
    fontSize: 15,
    fontWeight: '600',
  },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    marginBottom: 6,
    borderBottomWidth: 1,
  },
  catLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 100,
  },
  catDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  catName: {
    fontSize: 13,
    fontWeight: '500',
  },
  catBarWrap: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    marginHorizontal: 10,
    overflow: 'hidden',
  },
  catBar: {
    height: '100%',
    borderRadius: 3,
  },
  catCount: {
    fontSize: 13,
    fontWeight: '600',
    width: 30,
    textAlign: 'right',
  },
});
