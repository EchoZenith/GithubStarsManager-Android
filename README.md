# GithubStarsManager

一个使用 React Native (Expo) 构建的移动端应用，用于管理和浏览你在 GitHub 上星标的仓库。

## 功能

- **同步星标仓库** — 通过 GitHub API 一键同步你所有星标的仓库
- **智能分类** — 自动根据仓库的语言、描述等特征对仓库进行分类
- **分类管理** — 手动调整仓库分类，支持拖拽排序
- **搜索筛选** — 按分类快速筛选仓库
- **数据本地存储** — 所有数据保存在本地 SQLite 数据库中，无需担心隐私问题

## 技术栈

| 技术 | 用途 |
|------|------|
| [React Native](https://reactnative.dev/) 0.81 | 跨平台移动框架 |
| [Expo](https://expo.dev/) SDK 54 | 开发工具链与原生模块管理 |
| [expo-sqlite](https://docs.expo.dev/versions/latest/sdk/sqlite/) | 本地数据持久化 |
| [react-native-markdown-display](https://github.com/iamacup/react-native-markdown-display) | Markdown 渲染 |
| [react-native-syntax-highlighter](https://github.com/conorhastings/react-native-syntax-highlighter) | 代码语法高亮 |
| [@expo/vector-icons](https://docs.expo.dev/guides/icons/) | UI 图标系统 |

## 快速开始

### 前置条件

- Node.js >= 18
- npm 或 yarn
- GitHub 个人访问令牌（Personal Access Token）

### 获取 GitHub Token

1. 访问 [GitHub Settings > Developer settings > Personal access tokens](https://github.com/settings/tokens)
2. 点击 **Generate new token (classic)**
3. 勾选 `repo`  `user` 权限范围
4. 生成并复制 Token

### 安装与运行

```bash
# 克隆仓库
git clone https://github.com/EchoZenith/GithubStarsManager-Android.git
cd GithubStarsManager-Android

# 安装依赖
npm install

# 启动开发服务器
npx expo start

# 或在 Android 设备/模拟器上直接运行
npx expo run:android
```

首次启动时会提示输入 GitHub Token，粘贴后即可开始同步仓库。

## 项目结构

```
GithubStarsManager/
├── assets/              # 应用图标与静态资源
│   ├── icon.png         # 主图标
│   ├── adaptive-icon.png # Android 自适应图标
│   ├── splash-icon.png  # 启动页图标
│   └── favicon.png      # Web 图标
├── components/          # 可复用组件
│   ├── RepoItem.js      # 仓库列表项
│   └── TokenInput.js    # Token 输入组件
├── screens/             # 页面
│   ├── HomeScreen.js    # 首页：仓库列表与分类浏览
│   ├── RepoDetailScreen.js # 仓库详情与 README 展示
│   ├── CategoryManageScreen.js # 分类管理
│   └── SettingsScreen.js # 设置页
├── services/            # 业务逻辑
│   ├── github.js        # GitHub API 封装
│   ├── database.js      # SQLite 数据库操作
│   └── categorizer.js   # 自动分类引擎
├── App.js               # 应用入口与路由
├── app.json             # Expo 配置
└── package.json         # 依赖管理
```

## 自动分类

应用内置了基于语言和关键词的自动分类引擎，支持 13 个分类：

| 分类 | 匹配逻辑 |
|------|---------|
| Web 应用 | HTML/CSS/JS/TS + 相关关键词 |
| 移动应用 | Java/Kotlin/Dart/Swift + 相关关键词 |
| 桌面应用 | C++/C#/Go/Rust/Zig + 相关关键词 |
| AI/机器学习 | Python + 机器学习相关关键词 |
| 数据库 | SQL + 数据库相关关键词 |
| 开发工具 | Shell/Dockerfile + 工具类关键词 |
| 安全工具 | 安全相关关键词 |
| 游戏 | 游戏开发相关关键词 |
| 设计工具 | UI/UX 相关关键词 |
| 效率工具 | 效率工具类关键词 |
| 教育学习 | Awesome/教程/文档类关键词 |
| 社交网络 | 社交/通讯类关键词 |
| 数据分析 | R/Julia + 数据分析类关键词 |

## 致谢

感谢 [AmintaCCCP/GithubStarsManager](https://github.com/AmintaCCCP/GithubStarsManager) 仓库提供的灵感与参考。

## 许可证

[MIT](LICENSE)
