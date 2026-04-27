import * as SQLite from 'expo-sqlite';

let db = null;
let initPromise = null;

// 初始化数据库：建表 + 首次运行时插入默认分类
export async function initDatabase() {
  if (initPromise) return initPromise;
  initPromise = (async () => {
    db = await SQLite.openDatabaseAsync('github_stars.db');

    // 分类表
    await db.execAsync(
      `CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        color TEXT NOT NULL DEFAULT '#0366d6',
        sort_order INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );`
    );

    // 星标仓库表
    await db.execAsync(
      `CREATE TABLE IF NOT EXISTS starred_repos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        repo_id INTEGER UNIQUE NOT NULL,
        full_name TEXT NOT NULL,
        description TEXT,
        html_url TEXT NOT NULL,
        language TEXT,
        stargazers_count INTEGER DEFAULT 0,
        forks_count INTEGER DEFAULT 0,
        owner_avatar_url TEXT,
        owner_login TEXT,
        default_branch TEXT DEFAULT 'main',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );`
    );

    // 兼容旧数据库：给已有表添加 default_branch 列（如已存在则静默忽略）
    try {
      await db.execAsync('ALTER TABLE starred_repos ADD COLUMN default_branch TEXT DEFAULT \'main\'');
    } catch (e) {
      // Column already exists, ignore
    }

    // 仓库-分类 多对多关联表
    await db.execAsync(
      `CREATE TABLE IF NOT EXISTS repo_categories (
        repo_id INTEGER NOT NULL,
        category_id INTEGER NOT NULL,
        PRIMARY KEY (repo_id, category_id),
        FOREIGN KEY (repo_id) REFERENCES starred_repos(id) ON DELETE CASCADE,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
      );`
    );

    // 应用设置 KV 表
    await db.execAsync(
      `CREATE TABLE IF NOT EXISTS app_settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );`
    );

    // 首次运行时插入 13 个默认分类
    const existingCount = await db.getFirstAsync('SELECT COUNT(*) AS count FROM categories');
    if (existingCount.count === 0) {
      const defaultCategories = [
        ['Web应用', '#0366d6'],
        ['移动应用', '#28a745'],
        ['桌面应用', '#d73a4a'],
        ['数据库', '#6f42c1'],
        ['AI/机器学习', '#e36209'],
        ['开发工具', '#19b5a0'],
        ['安全工具', '#f0ad4e'],
        ['游戏', '#8b5cf6'],
        ['设计工具', '#1abc9c'],
        ['效率工具', '#3498db'],
        ['教育学习', '#9b59b6'],
        ['社交网络', '#e67e22'],
        ['数据分析', '#2c3e50'],
      ];
      for (let i = 0; i < defaultCategories.length; i++) {
        await db.runAsync(
          'INSERT OR IGNORE INTO categories (name, color, sort_order) VALUES (?, ?, ?)',
          defaultCategories[i][0],
          defaultCategories[i][1],
          i
        );
      }
    }
  })();
  return initPromise;
}

// 安全的字符串转换，防止 null/undefined 存入 DB
function safeStr(value) {
  if (value == null) return null;
  if (typeof value === 'string') return value;
  return String(value);
}

// 安全的整数转换
function safeInt(value) {
  if (value == null) return 0;
  const n = Number(value);
  return Number.isFinite(n) ? Math.floor(n) : 0;
}

// === 通用设置（KV 存储） ===
export async function getSetting(key) {
  await initDatabase();
  const row = await db.getFirstAsync(
    'SELECT value FROM app_settings WHERE key = ?',
    safeStr(key)
  );
  return row?.value ?? null;
}

export async function setSetting(key, value) {
  await initDatabase();
  await db.runAsync(
    'INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)',
    safeStr(key),
    safeStr(value)
  );
}

export async function deleteSetting(key) {
  await initDatabase();
  await db.runAsync('DELETE FROM app_settings WHERE key = ?', safeStr(key));
}

// === Token 相关 ===
export async function getGitHubToken() {
  return await getSetting('github_token');
}

export async function setGitHubToken(token) {
  await setSetting('github_token', token);
}

export async function clearGitHubToken() {
  await deleteSetting('github_token');
}

// === 分类 CRUD ===
export async function getAllCategories() {
  await initDatabase();
  return await db.getAllAsync(
    'SELECT * FROM categories ORDER BY sort_order ASC, created_at ASC'
  );
}

export async function addCategory(name, color = '#0366d6') {
  await initDatabase();
  const maxOrder = await db.getFirstAsync(
    'SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM categories'
  );
  const result = await db.runAsync(
    'INSERT INTO categories (name, color, sort_order) VALUES (?, ?, ?)',
    safeStr(name),
    safeStr(color),
    safeInt(maxOrder?.next_order ?? 0)
  );
  return result.lastInsertRowId;
}

export async function updateCategory(id, name, color) {
  await initDatabase();
  await db.runAsync(
    'UPDATE categories SET name = ?, color = ? WHERE id = ?',
    safeStr(name),
    safeStr(color),
    safeInt(id)
  );
}

export async function deleteCategory(id) {
  await initDatabase();
  await db.runAsync('DELETE FROM repo_categories WHERE category_id = ?', safeInt(id));
  await db.runAsync('DELETE FROM categories WHERE id = ?', safeInt(id));
}

// === 仓库数据同步 ===
// 将 GitHub API 返回的仓库列表保存到本地，已存在则跳过（INSERT OR IGNORE）
// 并更新 default_branch 字段以保持最新
export async function saveRepos(repos) {
  await initDatabase();
  let insertedCount = 0;
  const errors = [];
  for (const repo of repos) {
    try {
      await db.runAsync(
        `INSERT OR IGNORE INTO starred_repos
          (repo_id, full_name, description, html_url, language, stargazers_count, forks_count, owner_avatar_url, owner_login, default_branch)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        safeInt(repo?.id),
        safeStr(repo?.full_name),
        safeStr(repo?.description),
        safeStr(repo?.html_url),
        safeStr(repo?.language),
        safeInt(repo?.stargazers_count),
        safeInt(repo?.forks_count),
        safeStr(repo?.owner?.avatar_url),
        safeStr(repo?.owner?.login),
        safeStr(repo?.default_branch || 'main')
      );

      // 更新已有记录的 default_branch（之前同步的可能没有此字段）
      await db.runAsync(
        `UPDATE starred_repos SET default_branch = ? WHERE repo_id = ? AND default_branch != ?`,
        safeStr(repo?.default_branch || 'main'),
        safeInt(repo?.id),
        safeStr(repo?.default_branch || 'main')
      );

      insertedCount++;
    } catch (e) {
      errors.push({ repo: repo?.full_name, error: e.message });
    }
  }
  if (errors.length > 0) {
    console.warn('saveRepos errors:', errors.slice(0, 5));
  }
  return insertedCount;
}

// === 仓库查询（含分类关联） ===
// 通过 LEFT JOIN 将仓库与其所属分类合并成一条结果
// 最终用 formatRepoRows 按 repo_id 聚合多个分类

// 将单行中的分类信息（cat_id:::cat_name:::cat_color）解析为对象
function formatRepoRow(row) {
  if (!row) return row;
  const categories = row.categories_raw
    ? row.categories_raw.split('|||').filter(Boolean).map(part => {
      const [id, name, color] = part.split(':::');
      return { id: Number(id), name, color };
    })
    : [];
  return {
    ...row,
    categories,
    category_name: categories.length > 0 ? categories[0].name : null,
    category_color: categories.length > 0 ? categories[0].color : null,
  };
}

// 将 LEFT JOIN 产生的多行合并，同一仓库的多个分类拼接到一个字段中
function formatRepoRows(rows) {
  const map = new Map();
  for (const row of rows) {
    const key = row.repo_id;
    if (!map.has(key)) {
      map.set(key, { ...row, categories_raw: '' });
    }
    if (row.cat_id) {
      const existing = map.get(key);
      existing.categories_raw += `${row.cat_id}:::${row.cat_name || ''}:::${row.cat_color || ''}|||`;
    }
  }
  return Array.from(map.values()).map(formatRepoRow);
}

// 基础 SELECT 语句，包含仓库字段 + 关联的分类字段
const REPO_SELECT =
  `SELECT r.id, r.repo_id, r.full_name, r.description, r.html_url,
          r.language, r.stargazers_count, r.forks_count,
          r.owner_avatar_url, r.owner_login, r.default_branch, r.created_at,
          rc.category_id AS cat_id, c.name AS cat_name, c.color AS cat_color`;

export async function getAllRepos() {
  await initDatabase();
  const rows = await db.getAllAsync(
    `${REPO_SELECT}
     FROM starred_repos r
     LEFT JOIN repo_categories rc ON r.id = rc.repo_id
     LEFT JOIN categories c ON rc.category_id = c.id
     ORDER BY r.created_at DESC`
  );
  return formatRepoRows(rows);
}

export async function getReposByCategory(categoryId) {
  await initDatabase();
  const rows = await db.getAllAsync(
    `${REPO_SELECT}
     FROM starred_repos r
     INNER JOIN repo_categories rc ON r.id = rc.repo_id
     LEFT JOIN categories c ON rc.category_id = c.id
     WHERE rc.category_id = ?
     ORDER BY r.created_at DESC`,
    safeInt(categoryId)
  );
  return formatRepoRows(rows);
}

export async function getUncategorizedRepos() {
  await initDatabase();
  const rows = await db.getAllAsync(
    `${REPO_SELECT}
     FROM starred_repos r
     LEFT JOIN repo_categories rc ON r.id = rc.repo_id
     LEFT JOIN categories c ON rc.category_id = c.id
     WHERE rc.repo_id IS NULL
     ORDER BY r.created_at DESC`
  );
  return formatRepoRows(rows);
}

// === 仓库-分类 关联操作 ===
export async function getRepoCategories(repoId) {
  await initDatabase();
  return await db.getAllAsync(
    `SELECT c.id, c.name, c.color
     FROM repo_categories rc
     JOIN categories c ON rc.category_id = c.id
     WHERE rc.repo_id = ?
     ORDER BY c.sort_order ASC`,
    safeInt(repoId)
  );
}

// 先删后插：清除旧关联后重新设置（用于手动调整分类）
export async function setRepoCategories(repoId, categoryIds) {
  await initDatabase();
  await db.runAsync('DELETE FROM repo_categories WHERE repo_id = ?', safeInt(repoId));
  for (const catId of categoryIds) {
    if (catId == null) continue;
    await db.runAsync(
      'INSERT OR IGNORE INTO repo_categories (repo_id, category_id) VALUES (?, ?)',
      safeInt(repoId),
      safeInt(catId)
    );
  }
}

export async function addRepoCategory(repoId, categoryId) {
  await initDatabase();
  await db.runAsync(
    'INSERT OR IGNORE INTO repo_categories (repo_id, category_id) VALUES (?, ?)',
    safeInt(repoId),
    safeInt(categoryId)
  );
}

export async function removeRepoCategory(repoId, categoryId) {
  await initDatabase();
  await db.runAsync(
    'DELETE FROM repo_categories WHERE repo_id = ? AND category_id = ?',
    safeInt(repoId),
    safeInt(categoryId)
  );
}

// 批量设置仓库分类（用于自动分类引擎）
export async function batchSetRepoCategories(assignments) {
  await initDatabase();
  let count = 0;
  for (const { repoId, categoryIds } of assignments) {
    if (!categoryIds || categoryIds.length === 0) continue;
    try {
      for (const catId of categoryIds) {
        await db.runAsync(
          'INSERT OR IGNORE INTO repo_categories (repo_id, category_id) VALUES (?, ?)',
          safeInt(repoId),
          safeInt(catId)
        );
      }
      count++;
    } catch (e) {
      console.warn('batchSetRepoCategories error:', repoId, e.message);
    }
  }
  return count;
}

// === 统计查询 ===
export async function getRepoCountByCategory() {
  await initDatabase();
  return await db.getAllAsync(
    `SELECT c.id, c.name, c.color, COUNT(rc.repo_id) AS repo_count
     FROM categories c
     LEFT JOIN repo_categories rc ON c.id = rc.category_id
     GROUP BY c.id
     ORDER BY c.sort_order ASC`
  );
}

export async function getTotalRepoCount() {
  await initDatabase();
  const result = await db.getFirstAsync(
    'SELECT COUNT(*) AS count FROM starred_repos'
  );
  return result?.count ?? 0;
}
