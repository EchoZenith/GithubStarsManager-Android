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

export default function StatsScreen({ onGoBack }) {
  const [stats, setStats] = useState({ repos: 0, categories: 0 });
  const [categoryStats, setCategoryStats] = useState([]);
  const [loading, setLoading] = useState(true);
  const goBackRef = useRef(onGoBack);
  goBackRef.current = onGoBack;

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
    <View style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={onGoBack}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>数据统计</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView style={styles.scroll}>
        <View style={styles.overviewRow}>
          <View style={styles.overviewCard}>
            <Ionicons name="star" size={32} color="#f0ad4e" />
            <Text style={styles.overviewNumber}>{stats.repos}</Text>
            <Text style={styles.overviewLabel}>星标仓库</Text>
          </View>
          <View style={styles.overviewCard}>
            <Ionicons name="folder" size={32} color="#0366d6" />
            <Text style={styles.overviewNumber}>{stats.categories}</Text>
            <Text style={styles.overviewLabel}>分类</Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Ionicons name="bar-chart" size={16} color="#555" />
          <Text style={styles.sectionHeaderText}>各分类仓库数量</Text>
        </View>

        {categoryStats.map((cat) => (
          <View key={cat.id} style={styles.catRow}>
            <View style={styles.catLeft}>
              <View style={[styles.catDot, { backgroundColor: cat.color }]} />
              <Text style={styles.catName}>{cat.name}</Text>
            </View>
            <View style={styles.catBarWrap}>
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
            <Text style={styles.catCount}>{cat.repo_count}</Text>
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
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#fff',
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
    paddingBottom: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e8e8e8',
  },
  backBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  scroll: {
    flex: 1,
  },
  overviewRow: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
  },
  overviewCard: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 24,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  overviewNumber: {
    fontSize: 32,
    fontWeight: '700',
    color: '#1a1a1a',
    marginTop: 10,
  },
  overviewLabel: {
    fontSize: 13,
    color: '#888',
    marginTop: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 6,
  },
  sectionHeaderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
  },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 10,
  },
  catLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 80,
    gap: 6,
  },
  catDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  catName: {
    fontSize: 13,
    color: '#333',
    fontWeight: '500',
  },
  catBarWrap: {
    flex: 1,
    height: 8,
    backgroundColor: '#eee',
    borderRadius: 4,
    overflow: 'hidden',
  },
  catBar: {
    height: 8,
    borderRadius: 4,
  },
  catCount: {
    fontSize: 13,
    color: '#888',
    fontWeight: '600',
    width: 30,
    textAlign: 'right',
  },
});
