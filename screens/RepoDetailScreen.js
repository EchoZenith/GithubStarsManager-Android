import { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Image, Linking, Platform, BackHandler, InteractionManager, Dimensions
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import Markdown from 'react-native-markdown-display';
import SyntaxHighlighter from 'react-native-syntax-highlighter';
import { vs2015 } from 'react-syntax-highlighter/styles/hljs';
import { fetchReadme, TokenExpiredError } from '../services/github';
import { getGitHubToken } from '../services/database';

const SCREEN_WIDTH = Dimensions.get('window').width;

// 检测是否为 SVG 图片链接（React Native Image 组件不支持 SVG）
function isSvgUrl(url) {
  return /\.svg(\?|#|$)/i.test(url) || /\/svg(\?|#|$)/i.test(url);
}

// SVG 图片占位组件：点击后在系统浏览器中打开原始 SVG 文件
function SvgImage({ uri, alt }) {
  return (
    <TouchableOpacity
      style={svgStyles.container}
      onPress={() => Linking.openURL(uri)}
      activeOpacity={0.7}
    >
      <View style={svgStyles.placeholder}>
        <Ionicons name="image-outline" size={28} color="#999" />
        <Text style={svgStyles.placeholderText} numberOfLines={1}>
          {alt || 'SVG 图片'}
        </Text>
        <View style={svgStyles.badge}>
          <Ionicons name="open-outline" size={12} color="#fff" />
          <Text style={svgStyles.badgeText}>浏览器查看</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const svgStyles = StyleSheet.create({
  container: {
    width: '100%',
    marginBottom: 12,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e1e4e8',
  },
  placeholder: {
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f6f8fa',
    gap: 4,
  },
  placeholderText: {
    fontSize: 13,
    color: '#666',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0366d6',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 3,
  },
  badgeText: {
    fontSize: 11,
    color: '#fff',
  },
});

// 根据图片设备像素自动计算合适的高度，避免固定宽高比导致 SVG 徽章变形
function ReadmeImage({ src, alt }) {
  const [dimensions, setDimensions] = useState(null);
  const isSvg = isSvgUrl(src);

  if (isSvg) {
    return <SvgImage uri={src} alt={alt} />;
  }

  return (
    <Image
      source={{ uri: src }}
      style={[
        readmeImageStyles.image,
        dimensions
          ? { width: '100%', height: dimensions.height, aspectRatio: undefined }
          : { width: '100%', height: 220 },
      ]}
      resizeMode="contain"
      onLoad={(e) => {
        const { width, height } = e.nativeEvent.source;
        if (width && height) {
          const maxWidth = SCREEN_WIDTH - 56;
          const ratio = Math.min(maxWidth / width, 1);
          setDimensions({ width: maxWidth, height: height * ratio });
        }
      }}
    />
  );
}

const readmeImageStyles = StyleSheet.create({
  image: {
    maxWidth: '100%',
    borderRadius: 6,
    marginBottom: 12,
  },
});

function preprocessMarkdown(markdown, repoFullName, defaultBranch) {
  if (!markdown) return markdown;

  const [owner, repo] = repoFullName.split('/');
  const branch = defaultBranch || 'main';
  const rawBaseUrl = `https://raw.githubusercontent.com/${owner}/${repo}/${branch}`;
  const githubBaseUrl = `https://github.com/${owner}/${repo}/blob/${branch}`;

  let processed = markdown;

  // Remove <picture> and <source> tags, keep their content
  processed = processed.replace(/<picture[^>]*>/gi, '');
  processed = processed.replace(/<\/picture>/gi, '');
  processed = processed.replace(/<source[^>]*\/?>/gi, '');

  // Convert <a><img>...</a> to markdown link-wrapped image first
  processed = processed.replace(
    /<a\s+[^>]*href=["']([^"']*)["'][^>]*>\s*(<img[^>]*>)\s*<\/a>/gi,
    (match, href, imgTag) => {
      const srcMatch = imgTag.match(/src\s*=\s*["']([^"']*)["']/i);
      const altMatch = imgTag.match(/alt\s*=\s*["']([^"']*)["']/i);
      const src = srcMatch ? srcMatch[1] : '';
      const alt = altMatch ? altMatch[1] : 'image';
      return `[![${alt}](${src})](${href})`;
    }
  );

  // Convert remaining standalone HTML <img> tags to markdown image syntax
  processed = processed.replace(
    /<img\s+[^>]*src\s*=\s*["']([^"']*)["'][^>]*\/?>/gi,
    (match, src) => {
      const altMatch = match.match(/alt\s*=\s*["']([^"']*)["']/i);
      const alt = altMatch ? altMatch[1] : 'image';
      return `![${alt}](${src})`;
    }
  );

  // Convert remaining HTML <a> tags to markdown link syntax
  processed = processed.replace(
    /<a\s+[^>]*href\s*=\s*["']([^"']*)["'][^>]*>([^<]*)<\/a>/gi,
    (match, href, text) => `[${text.trim()}](${href})`
  );

  // Strip remaining HTML tags
  processed = processed.replace(/<[^>]*>/g, '');

  // Resolve relative URLs in markdown images (![alt](url)) and links ([text](url))
  processed = processed.replace(
    /(!)?\[([^\]]*)\]\(([^)]+)\)/g,
    (match, isImage, text, url) => {
      if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('mailto:')) {
        return match;
      }
      const baseUrl = isImage ? rawBaseUrl : githubBaseUrl;
      const cleanUrl = url.replace(/^(\.\/|\/)/, '');
      const resolvedUrl = `${baseUrl}/${cleanUrl}`;
      return `${isImage || ''}[${text}](${resolvedUrl})`;
    }
  );

  return processed;
}

function detectLanguage(content) {
  const firstLine = content.split('\n')[0].trim();
  const knownLanguages = {
    js: 'javascript', jsx: 'javascript', mjs: 'javascript',
    ts: 'typescript', tsx: 'typescript',
    py: 'python', rb: 'ruby', rs: 'rust', go: 'go',
    java: 'java', kt: 'kotlin', swift: 'swift',
    c: 'c', cpp: 'cpp', cs: 'csharp',
    html: 'xml', htm: 'xml', xml: 'xml',
    css: 'css', scss: 'css', less: 'css',
    sh: 'bash', bash: 'bash', zsh: 'bash', powershell: 'powershell',
    json: 'json', yml: 'yaml', yaml: 'yaml',
    sql: 'sql', php: 'php', r: 'r', dart: 'dart',
    diff: 'diff', dockerfile: 'dockerfile', graphql: 'graphql',
  };
  const ext = firstLine.replace('```', '').toLowerCase();
  return knownLanguages[ext] || ext || 'bash';
}

const markdownStyles = {
  body: {
    color: '#24292e',
    fontSize: 15,
    lineHeight: 24,
    padding: 16,
  },
  heading1: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: 20,
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e4e8',
  },
  heading2: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 18,
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e4e8',
  },
  heading3: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 6,
  },
  heading4: {
    fontSize: 15,
    fontWeight: '600',
    marginTop: 14,
    marginBottom: 4,
  },
  paragraph: {
    marginBottom: 12,
  },
  list_item: {
    marginBottom: 4,
  },
  bullet_list: {
    paddingLeft: 24,
    marginBottom: 12,
  },
  ordered_list: {
    paddingLeft: 24,
    marginBottom: 12,
  },
  code_inline: {
    backgroundColor: 'rgba(27,31,35,0.05)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13,
    color: '#d73a4a',
  },
  code_block: {
    backgroundColor: '#f6f8fa',
    padding: 12,
    borderRadius: 6,
    marginBottom: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13,
  },
  fence: {
    backgroundColor: '#f6f8fa',
    padding: 12,
    borderRadius: 6,
    marginBottom: 12,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 13,
  },
  blockquote: {
    paddingLeft: 12,
    color: '#6a737d',
    borderLeftWidth: 4,
    borderLeftColor: '#dfe2e5',
    marginBottom: 12,
  },
  link: {
    color: '#0366d6',
    textDecorationLine: 'underline',
  },
  table: {
    borderWidth: 1,
    borderColor: '#dfe2e5',
    borderRadius: 4,
    marginBottom: 12,
  },
  thead: {
    backgroundColor: '#f6f8fa',
  },
  th: {
    padding: 6,
    borderWidth: 1,
    borderColor: '#dfe2e5',
    fontWeight: '600',
  },
  td: {
    padding: 6,
    borderWidth: 1,
    borderColor: '#dfe2e5',
  },
  hr: {
    backgroundColor: '#e1e4e8',
    height: 1,
    marginVertical: 20,
  },
  image: {
    maxWidth: '100%',
    height: undefined,
    borderRadius: 6,
    marginBottom: 12,
  },
};

// 重写 react-native-markdown-display 的默认渲染规则
const renderRules = {
  // 自定义图片渲染：支持 SVG 占位，普通图片自动计算尺寸
  image: (node, children, parent, styles) => {
    const { src, alt } = node.attributes;
    return (
      <ReadmeImage
        key={node.key}
        src={src}
        alt={alt}
      />
    );
  },
  link: (node, children, parent, styles) => {
    const { href } = node.attributes;
    const childrenArr = Array.isArray(children) ? children : [children];
    const hasOnlyText = childrenArr.every(
      child => typeof child === 'string' || typeof child === 'number' || child === null
    );
    if (hasOnlyText) {
      return (
        <TouchableOpacity key={node.key} onPress={() => Linking.openURL(href)}>
          <Text style={styles.link}>{children}</Text>
        </TouchableOpacity>
      );
    }
    return (
      <TouchableOpacity key={node.key} onPress={() => Linking.openURL(href)}>
        {children}
      </TouchableOpacity>
    );
  },
  fence: (node, children, parent, styles) => {
    const lang = node.sourceInfo ? node.sourceInfo.split(/\s+/)[0] : '';
    const code = node.content;
    const language = detectLanguage(lang || code);
    return (
      <View key={node.key} style={codeBlockStyles.wrapper}>
        {lang ? (
          <View style={codeBlockStyles.langBar}>
            <Text style={codeBlockStyles.langText}>{lang}</Text>
          </View>
        ) : null}
        <SyntaxHighlighter
          highlighter="highlightjs"
          style={vs2015}
          PreTag={ScrollView}
          CodeTag={ScrollView}
          fontFamily={Platform.OS === 'ios' ? 'Menlo' : 'monospace'}
          fontSize={12}
          customStyle={{
            padding: 12,
            margin: 0,
            borderBottomLeftRadius: 8,
            borderBottomRightRadius: 8,
          }}
        >
          {code}
        </SyntaxHighlighter>
      </View>
    );
  },
};

const codeBlockStyles = StyleSheet.create({
  wrapper: {
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 8,
    overflow: 'hidden',
  },
  langBar: {
    backgroundColor: '#2d2d2d',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  langText: {
    color: '#999',
    fontSize: 11,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});

export default function RepoDetailScreen({ repo, onGoBack }) {
  const [readme, setReadme] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const goBackRef = useRef(onGoBack);
  goBackRef.current = onGoBack;

  useEffect(() => {
    const onBackPress = () => {
      goBackRef.current();
      return true;
    };
    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    InteractionManager.runAfterInteractions(() => {
      loadReadme();
    });
  }, []);

  const loadReadme = async () => {
    try {
      const token = await getGitHubToken();
      const markdown = await fetchReadme(token, repo.full_name);
      const cleaned = markdown ? preprocessMarkdown(markdown, repo.full_name, repo.default_branch) : null;
      setReadme(cleaned);
    } catch (e) {
      if (e instanceof TokenExpiredError) {
        setError('Token 已过期，请返回设置页面重新输入');
      } else {
        setError(e.message || '加载 README 失败');
      }
    } finally {
      setLoading(false);
    }
  };

  const openInBrowser = () => {
    if (repo.html_url) {
      Linking.openURL(repo.html_url);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={onGoBack}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {repo.full_name}
        </Text>
        <TouchableOpacity style={styles.headerBtn} onPress={openInBrowser}>
          <Ionicons name="open-outline" size={22} color="#0366d6" />
        </TouchableOpacity>
      </View>

      <View style={styles.infoCard}>
        <View style={styles.infoRow}>
          {repo.owner_avatar_url ? (
            <Image
              source={{ uri: repo.owner_avatar_url }}
              style={styles.ownerAvatar}
            />
          ) : null}
          <View style={styles.infoText}>
            <Text style={styles.repoName}>{repo.full_name}</Text>
            <Text style={styles.repoDesc} numberOfLines={3}>
              {repo.description || '暂无描述'}
            </Text>
          </View>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{repo.stargazers_count}</Text>
            <Text style={styles.statLabel}>Stars</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{repo.forks_count}</Text>
            <Text style={styles.statLabel}>Forks</Text>
          </View>
          {repo.language ? (
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{repo.language}</Text>
              <Text style={styles.statLabel}>Language</Text>
            </View>
          ) : null}
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{repo.owner_login}</Text>
            <Text style={styles.statLabel}>Owner</Text>
          </View>
        </View>
      </View>

      <View style={styles.readmeHeader}>
        <Ionicons name="book" size={16} color="#555" />
        <Text style={styles.readmeTitle}>README.md</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#0366d6" />
          <Text style={styles.loadingText}>正在加载 README...</Text>
        </View>
      ) : error ? (
        <View style={styles.loadingContainer}>
          <Ionicons name="alert-circle-outline" size={36} color="#d73a4a" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : readme === null ? (
        <View style={styles.loadingContainer}>
          <Ionicons name="document-text-outline" size={36} color="#ccc" />
          <Text style={styles.emptyText}>该仓库没有 README 文件</Text>
        </View>
      ) : (
        <ScrollView style={styles.markdownScroll}>
          <Markdown style={markdownStyles} rules={renderRules}>
            {readme}
          </Markdown>
        </ScrollView>
      )}
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
    paddingBottom: 10,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e8e8e8',
  },
  headerBtn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    textAlign: 'center',
  },
  infoCard: {
    backgroundColor: '#fff',
    margin: 12,
    marginBottom: 0,
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ownerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  infoText: {
    flex: 1,
  },
  repoName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0366d6',
    marginBottom: 4,
  },
  repoDesc: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
  },
  statsRow: {
    flexDirection: 'row',
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  statLabel: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
  readmeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 6,
  },
  readmeTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    color: '#888',
    fontSize: 14,
  },
  errorText: {
    marginTop: 10,
    color: '#d73a4a',
    fontSize: 14,
    textAlign: 'center',
  },
  emptyText: {
    marginTop: 10,
    color: '#999',
    fontSize: 14,
  },
  markdownScroll: {
    flex: 1,
    backgroundColor: '#fff',
    marginHorizontal: 12,
    marginBottom: 12,
    borderRadius: 12,
  },
});
