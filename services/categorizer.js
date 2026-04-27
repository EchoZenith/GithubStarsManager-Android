// 语言 → 分类 的映射表
// 根据仓库主要编程语言直接映射到对应的分类
const languageCategoryMap = {
  'HTML': 'Web应用', 'CSS': 'Web应用', 'JavaScript': 'Web应用',
  'TypeScript': 'Web应用', 'Vue': 'Web应用', 'Svelte': 'Web应用',
  'PHP': 'Web应用', 'Ruby': 'Web应用', 'Elixir': 'Web应用',
  'Python': 'AI/机器学习', 'Jupyter Notebook': 'AI/机器学习',
  'R': '数据分析', 'Julia': '数据分析',
  'Java': '移动应用', 'Kotlin': '移动应用', 'Dart': '移动应用',
  'Swift': '移动应用', 'Objective-C': '移动应用',
  'C++': '桌面应用', 'C#': '桌面应用', 'Go': '桌面应用',
  'Rust': '桌面应用', 'C': '桌面应用', 'Zig': '桌面应用',
  'SQL': '数据库', 'PLpgSQL': '数据库',
  'Shell': '开发工具', 'Dockerfile': '开发工具', 'Makefile': '开发工具',
  'CMake': '开发工具', 'PowerShell': '开发工具',
};

// 关键词规则：每个分类关联一组关键词，与仓库名称/描述匹配
// 关键词越长代表越精确，匹配时按关键词长度加权
const keywordRules = [
  { category: 'AI/机器学习', keywords: ['ai', 'artificial intelligence', 'machine learning', 'deep learning', 'neural', 'llm', 'gpt', 'transformer', 'pytorch', 'tensorflow', 'keras', 'openai', 'langchain', 'rag', 'embedding', 'stable diffusion', 'huggingface', 'nlp', 'computer vision', 'reinforcement learning', 'generative'] },
  { category: 'Web应用', keywords: ['web', 'website', 'api', 'rest', 'graphql', 'frontend', 'backend', 'fullstack', 'react', 'next.js', 'nuxt', 'express', 'django', 'flask', 'spring', 'laravel', 'rails', 'http', 'server', 'middleware', 'cors', 'websocket'] },
  { category: '移动应用', keywords: ['mobile', 'android', 'ios', 'flutter', 'react native', 'swiftui', 'jetpack', 'compose', 'app', 'pwa'] },
  { category: '桌面应用', keywords: ['desktop', 'electron', 'tauri', 'qt', 'gtk', 'winui', 'wpf', 'cli', 'terminal', 'tui'] },
  { category: '数据库', keywords: ['database', 'sql', 'nosql', 'redis', 'postgresql', 'mysql', 'mongodb', 'sqlite', 'cassandra', 'dynamodb', 'elasticsearch', 'orm', 'prisma', 'sequelize'] },
  { category: '开发工具', keywords: ['devtool', 'developer tool', 'ide', 'editor', 'vscode', 'plugin', 'extension', 'compiler', 'linter', 'formatter', 'debugger', 'docker', 'kubernetes', 'k8s', 'ci/cd', 'github action', 'automation', 'scaffold', 'boilerplate', 'template', 'sdk', 'library', 'framework', 'package'] },
  { category: '安全工具', keywords: ['security', 'hack', 'penetration', 'vulnerability', 'exploit', 'encrypt', 'decrypt', 'auth', 'oauth', 'jwt', 'firewall', 'malware', 'ransomware', 'cve', 'bug bounty', 'sast', 'dast'] },
  { category: '游戏', keywords: ['game', 'gaming', 'unity', 'unreal', 'godot', 'sprite', 'animation', 'physics engine', '3d', 'webgl', 'opengl', 'vulkan', 'shader'] },
  { category: '设计工具', keywords: ['design', 'ui', 'ux', 'figma', 'sketch', 'svg', 'icon', 'font', 'typography', 'color', 'theme', 'animation', 'css', 'tailwind', 'bootstrap', 'material'] },
  { category: '效率工具', keywords: ['productivity', 'utility', 'tool', 'workflow', 'automation', 'clipboard', 'note', 'todo', 'calendar', 'password', 'manager', 'sync'] },
  { category: '教育学习', keywords: ['tutorial', 'course', 'learn', 'education', 'documentation', 'book', 'cheatsheet', 'roadmap', 'example', 'demo', 'guide', 'awesome', 'awesome-'] },
  { category: '社交网络', keywords: ['social', 'chat', 'messaging', 'forum', 'community', 'blog', 'feed', 'timeline', 'notification', 'follower', 'friend'] },
  { category: '数据分析', keywords: ['data', 'analytics', 'visualization', 'dashboard', 'chart', 'statistics', 'etl', 'big data', 'spark', 'hadoop', 'pandas', 'numpy', 'scipy', 'tableau', 'metabase', 'superset'] },
];

// 文本标准化：转小写 + 去除首尾空格
function normalize(text) {
  return (text || '').toLowerCase().trim();
}

// 关键词评分：遍历关键词列表，匹配到的每个关键词按长度累加得分
function scoreByKeywords(text, keywords) {
  const normalized = normalize(text);
  let score = 0;
  for (const kw of keywords) {
    if (normalized.includes(kw)) {
      score += kw.length;
    }
  }
  return score;
}

// 对单个仓库进行自动分类（返回最多 3 个最匹配的分类）
export function autoCategorize(repo, categories) {
  const lang = repo.language || '';
  const name = repo.full_name || '';
  const desc = repo.description || '';

  const results = [];

  // 遍历所有关键词规则进行评分
  for (const rule of keywordRules) {
    let score = 0;
    // 仓库名称权重 2 倍，描述权重 1 倍
    score += scoreByKeywords(name, rule.keywords) * 2;
    score += scoreByKeywords(desc, rule.keywords);

    // 如果编程语言直接匹配当前分类，加基础分
    const langMatch = languageCategoryMap[lang];
    if (langMatch === rule.category) {
      score += 5;
    }

    if (score > 0) {
      const matched = categories.find(c => c.name === rule.category);
      if (matched) {
        results.push({ category: matched, score });
      }
    }
  }

  // 关键词没匹配到：回退到仅按语言映射分类
  if (results.length === 0) {
    const langCategory = languageCategoryMap[lang];
    if (langCategory) {
      const matched = categories.find(c => c.name === langCategory);
      if (matched) return [matched];
    }
    return [];
  }

  // 按得分排序，取最高分的 60% 以上的分类（最多 3 个）
  results.sort((a, b) => b.score - a.score);
  const maxScore = results[0].score;
  return results
    .filter(r => r.score >= maxScore * 0.6)
    .map(r => r.category)
    .slice(0, 3);
}

// 批量处理多个仓库的自动分类
export function autoCategorizeAll(repos, categories) {
  const results = [];
  for (const repo of repos) {
    const matchedCategories = autoCategorize(repo, categories);
    results.push({
      repoId: repo.id,
      repoName: repo.full_name,
      categoryIds: matchedCategories.map(c => c.id),
      categoryNames: matchedCategories.map(c => c.name),
    });
  }
  return results;
}

// 执行自动分类的完整流程：获取未分类仓库 → 分类匹配 → 批量保存
export async function runAutoCategorize(categories, getUncategorizedRepos, batchSetRepoCategories) {
  const uncategorized = await getUncategorizedRepos();
  if (uncategorized.length === 0) return 0;
  const results = autoCategorizeAll(uncategorized, categories);
  const assignments = results.filter(r => r.categoryIds.length > 0).map(r => ({
    repoId: r.repoId,
    categoryIds: r.categoryIds,
  }));
  if (assignments.length === 0) return 0;
  return await batchSetRepoCategories(assignments);
}
