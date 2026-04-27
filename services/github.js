import Constants from 'expo-constants';

const GITHUB_API_URL = 'https://api.github.com';
// 用于检查更新的仓库地址，从 app.json extra 中读取
const APP_REPO = Constants.expoConfig?.extra?.appRepo || 'EchoZenith/GithubStarsManager-Android';
// 当前版本号从 app.json 中读取（version 字段）
const CURRENT_VERSION = Constants.expoConfig?.version || '1.0.0';

// 自定义错误类型：Token 过期或无效时抛出，供上层 UI 捕获后跳转 Token 输入页
class TokenExpiredError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TokenExpiredError';
  }
}

export { TokenExpiredError };

// 构建 GitHub API 请求头
function buildHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github.v3+json',
  };
}

// 分页获取用户所有星标仓库（每页 100 条，自动翻页直到取完）
export async function fetchStarredRepos(token) {
  if (!token) {
    throw new TokenExpiredError('请先输入 GitHub Token');
  }

  let allRepos = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await fetch(
      `${GITHUB_API_URL}/user/starred?per_page=100&page=${page}`,
      {
        method: 'GET',
        headers: buildHeaders(token),
      }
    );

    if (response.status === 401) {
      throw new TokenExpiredError('GitHub Token 已过期或无效，请重新输入');
    }

    if (!response.ok) {
      throw new Error(`GitHub API 错误！状态码: ${response.status}`);
    }

    const data = await response.json();
    if (data.length === 0) {
      hasMore = false;
    } else {
      allRepos = allRepos.concat(data);
      page++;
    }
  }

  return allRepos;
}

// 获取仓库的 README 原始内容（raw 格式直接返回 markdown 文本）
export async function fetchReadme(token, fullName) {
  if (!token) {
    throw new TokenExpiredError('请先输入 GitHub Token');
  }

  const response = await fetch(
    `${GITHUB_API_URL}/repos/${fullName}/readme`,
    {
      method: 'GET',
      headers: {
        ...buildHeaders(token),
        Accept: 'application/vnd.github.raw',
      },
    }
  );

  if (response.status === 401) {
    throw new TokenExpiredError('GitHub Token 已过期或无效，请重新输入');
  }

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`获取 README 失败！状态码: ${response.status}`);
  }

  return await response.text();
}

// 检查应用更新：对比当前版本与 GitHub Releases 最新版本号
export async function checkUpdate(token) {
  try {
    const headers = {
      Accept: 'application/vnd.github.v3+json',
    };
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(
      `${GITHUB_API_URL}/repos/${APP_REPO}/releases/latest`,
      {
        method: 'GET',
        headers,
      }
    );

    if (response.status === 404) {
      return { hasUpdate: false, error: null, message: '未找到发布版本' };
    }

    if (!response.ok) {
      return { hasUpdate: false, error: '检查更新失败', message: null };
    }

    const data = await response.json();
    const latestVersion = data.tag_name.replace(/^v/, '');
    const currentParts = CURRENT_VERSION.split('.').map(Number);
    const latestParts = latestVersion.split('.').map(Number);

    // 逐段比较版本号（major.minor.patch）
    let hasUpdate = false;
    for (let i = 0; i < Math.max(currentParts.length, latestParts.length); i++) {
      const cur = currentParts[i] || 0;
      const lat = latestParts[i] || 0;
      if (lat > cur) { hasUpdate = true; break; }
      if (lat < cur) break;
    }

    return {
      hasUpdate,
      currentVersion: CURRENT_VERSION,
      latestVersion,
      releaseUrl: data.html_url,
      releaseName: data.name || data.tag_name,
      releaseBody: data.body ? data.body.split('\n').slice(0, 5).join('\n') : '',
      publishedAt: data.published_at,
      error: null,
      message: hasUpdate
        ? `发现新版本 v${latestVersion}`
        : '已是最新版本',
    };
  } catch (e) {
    return { hasUpdate: false, error: e.message || '网络错误', message: null };
  }
}
