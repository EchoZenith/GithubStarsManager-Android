import { useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../constants/ThemeContext';
import { useTranslation } from '../i18n';

function RepoItemContent({ item, showCategory, colors, spacing, borderRadius }) {
  const { t } = useTranslation();
  const categories = item.categories || [];

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        {item.owner_avatar_url ? (
          <Image source={{ uri: item.owner_avatar_url }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Ionicons name="person" size={14} color={colors.textMuted} />
          </View>
        )}
        <View style={styles.headerText}>
          <Text style={styles.repoName} numberOfLines={1}>{item.full_name}</Text>
          {item.language ? (
            <View style={styles.langDot}>
              <View style={[styles.langDotInner, { backgroundColor: getLangColor(item.language) }]} />
              <Text style={styles.language}>{item.language}</Text>
            </View>
          ) : null}
        </View>
      </View>

      <Text style={styles.repoDesc} numberOfLines={2}>
        {item.description || t('common.noDesc')}
      </Text>

      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Ionicons name="star" size={13} color={colors.accentAmber} />
          <Text style={styles.stat}>{formatCount(item.stargazers_count)}</Text>
        </View>
        <View style={styles.statItem}>
          <Ionicons name="git-branch-outline" size={13} color={colors.textMuted} />
          <Text style={styles.stat}>{formatCount(item.forks_count)}</Text>
        </View>
      </View>

      {showCategory && categories.length > 0 ? (
        <View style={styles.badgesRow}>
          {categories.map((cat) => (
            <View key={cat.id} style={[styles.categoryBadge, { backgroundColor: cat.color || colors.primary }]}>
              <Text style={styles.categoryBadgeText}>{cat.name}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export default function RepoItem({ item, onPress, onLongPress, showCategory }) {
  const { colors, spacing, borderRadius } = useTheme();
  const { t } = useTranslation();
  const categories = item.categories || [];
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, { toValue: 0.97, useNativeDriver: true, speed: 50 }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 50 }).start();
  };

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={() => onPress?.(item)}
      onLongPress={() => onLongPress?.(item)}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View style={[styles.wrapper, { transform: [{ scale: scaleAnim }] }]}>
        <View style={[styles.card, { backgroundColor: colors.surface }]}>
          <View style={[styles.header, { marginBottom: 8 }]}>
            {item.owner_avatar_url ? (
              <Image source={{ uri: item.owner_avatar_url }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatarPlaceholder, { backgroundColor: colors.borderLight }]}>
                <Ionicons name="person" size={14} color={colors.textMuted} />
              </View>
            )}
            <View style={styles.headerText}>
              <Text style={[styles.repoName, { color: colors.primary }]} numberOfLines={1}>{item.full_name}</Text>
              {item.language ? (
                <View style={styles.langDot}>
                  <View style={[styles.langDotInner, { backgroundColor: getLangColor(item.language) }]} />
                  <Text style={[styles.language, { color: colors.textMuted }]}>{item.language}</Text>
                </View>
              ) : null}
            </View>
          </View>

          <Text style={[styles.repoDesc, { color: colors.textSecondary }]} numberOfLines={2}>
            {item.description || t('common.noDesc')}
          </Text>

          <View style={[styles.statsRow, { marginTop: 12, gap: 16 }]}>
            <View style={styles.statItem}>
              <Ionicons name="star" size={13} color={colors.accentAmber} />
              <Text style={[styles.stat, { color: colors.textSecondary }]}>{formatCount(item.stargazers_count)}</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="git-branch-outline" size={13} color={colors.textMuted} />
              <Text style={[styles.stat, { color: colors.textSecondary }]}>{formatCount(item.forks_count)}</Text>
            </View>
          </View>

          {showCategory && categories.length > 0 ? (
            <View style={[styles.badgesRow, { borderTopColor: colors.borderLight, marginTop: 12, paddingTop: 12, gap: 6 }]}>
              {categories.map((cat) => (
                <View key={cat.id} style={[styles.categoryBadge, { backgroundColor: cat.color || colors.primary }]}>
                  <Text style={styles.categoryBadgeText}>{cat.name}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

function getLangColor(lang) {
  const map = {
    JavaScript: '#f1e05a', TypeScript: '#3178c6', Python: '#3572a5',
    Java: '#b07219', Go: '#00add8', Rust: '#dea584', Ruby: '#701516',
    C: '#555555', 'C++': '#f34b7d', 'C#': '#178600', Swift: '#f05138',
    Kotlin: '#a97bff', Dart: '#00b4ab', Shell: '#89e051', HTML: '#e34c26',
    CSS: '#563d7c', Vue: '#41b883', PHP: '#4f5d95', Scala: '#c22d40',
  };
  return map[lang] || '#8b8b8b';
}

function formatCount(n) {
  if (!n) return '0';
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n);
}

const styles = StyleSheet.create({
  wrapper: {
    marginHorizontal: 16,
    marginVertical: 4,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
  },
  avatarPlaceholder: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 12,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
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
  langDot: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  langDotInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 4,
  },
  language: {
    fontSize: 12,
    color: '#94a3b8',
  },
  repoDesc: {
    marginTop: 4,
    color: '#475569',
    fontSize: 13,
    lineHeight: 19,
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 16,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  stat: {
    fontSize: 13,
    color: '#475569',
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    gap: 6,
  },
  categoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  categoryBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '500',
  },
});
