import { StyleSheet, Text, View, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// 仓库列表项卡片组件：显示仓库头像、名称、描述、星标数、Fork 数、分类标签
export default function RepoItem({ item, onPress, onLongPress, showCategory }) {
  const categories = item.categories || [];

  return (
    <TouchableOpacity
      style={styles.repoItem}
      onPress={() => onPress?.(item)}
      onLongPress={() => onLongPress?.(item)}
    >
      <View style={styles.header}>
        {item.owner_avatar_url ? (
          <Image
            source={{ uri: item.owner_avatar_url }}
            style={styles.avatar}
          />
        ) : null}
        <View style={styles.headerText}>
          <Text style={styles.repoName}>{item.full_name}</Text>
          {item.language ? (
            <Text style={styles.language}>{item.language}</Text>
          ) : null}
        </View>
      </View>
      <Text style={styles.repoDesc} numberOfLines={2}>
        {item.description || '暂无描述'}
      </Text>
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Ionicons name="star" size={14} color="#f0ad4e" />
          <Text style={styles.stat}>{item.stargazers_count}</Text>
        </View>
        <View style={styles.statItem}>
          <Ionicons name="git-branch-outline" size={14} color="#555" />
          <Text style={styles.stat}>{item.forks_count}</Text>
        </View>
      </View>
      {showCategory && categories.length > 0 ? (
        <View style={styles.badgesRow}>
          {categories.map((cat) => (
            <View
              key={cat.id}
              style={[styles.categoryBadge, { backgroundColor: cat.color || '#0366d6' }]}
            >
              <Text style={styles.categoryBadgeText}>{cat.name}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  repoItem: {
    backgroundColor: '#fff',
    padding: 14,
    marginVertical: 5,
    marginHorizontal: 12,
    borderRadius: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 8,
  },
  headerText: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  repoName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#0366d6',
    flex: 1,
  },
  language: {
    fontSize: 12,
    color: '#888',
    marginLeft: 8,
  },
  repoDesc: {
    marginTop: 4,
    color: '#666',
    fontSize: 13,
    lineHeight: 18,
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    gap: 4,
  },
  stat: {
    fontSize: 13,
    color: '#555',
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8,
    gap: 6,
  },
  categoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  categoryBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '500',
  },
});
