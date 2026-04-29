# GithubStarsManager

一个使用 React Native (Expo) 构建的移动端应用，用于管理和浏览你在 GitHub 上星标的仓库，支持 AI 智能分析，所有数据均存储在本地。

## 功能

- **同步星标仓库** — 通过 GitHub API 一键同步所有星标仓库
- **智能分类** — 根据编程语言和关键词自动对仓库进行分类
- **分类管理** — 手动创建/编辑/删除分类，并调整仓库所属分类
- **AI 分析** — 批量对仓库进行 AI 智能分析，自动生成摘要、标签和平台识别
- **README 阅读器** — 基于 WebView 的 README 渲染，支持 GitHub 风格样式、代码高亮、RST 图片指令和自适应高度
- **数据统计** — 查看各分类下的仓库数量分布
- **版本检查** — 内置版本更新检查
- **本地存储** — 所有数据保存在本地 SQLite 数据库中

## 技术栈

| 技术 | 用途 |
|------|------|
| [React Native](https://reactnative.dev/) 0.81 | 跨平台移动框架 |
| [Expo](https://expo.dev/) SDK 54 | 开发工具链与原生模块管理 |
| [expo-sqlite](https://docs.expo.dev/versions/latest/sdk/sqlite/) | 本地数据持久化 |
| [react-native-webview](https://github.com/react-native-webview/react-native-webview) | README 渲染容器 |
| [marked](https://marked.js.org/) | Markdown 转 HTML |
| [highlight.js](https://highlightjs.org/) | WebView 内代码语法高亮 |
| [@expo/vector-icons](https://docs.expo.dev/guides/icons/) | UI 图标系统 |

## 快速开始

### 前置条件

- Node.js >= 18
- npm 或 yarn
- GitHub 个人访问令牌（Personal Access Token）

### 获取 GitHub Token

1. 访问 [GitHub Settings > Developer settings > Personal access tokens](https://github.com/settings/tokens)
2. 点击 **Generate new token (classic)**
3. 勾选 `repo` 和 `user` 权限范围
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
├── assets/                  # 应用图标与静态资源
├── components/              # 可复用组件
│   ├── RepoItem.js          # 仓库列表项卡片
│   ├── ScreenTransition.js  # 页面切换动画
│   └── TokenInput.js        # GitHub Token 输入组件
├── constants/
│   └── theme.js             # 设计系统 Token（颜色、间距、阴影）
├── screens/                 # 页面
│   ├── HomeScreen.js        # 首页：仓库列表与分类浏览
│   ├── RepoDetailScreen.js  # 仓库详情与 README 阅读器
│   ├── CategoryManageScreen.js # 分类管理（增删改查）
│   ├── SettingsScreen.js    # 设置：Token、分类管理入口、统计、AI 配置
│   ├── StatsScreen.js       # 数据统计
│   └── AiConfigScreen.js    # AI 服务提供商配置
├── services/                # 业务逻辑
│   ├── github.js            # GitHub API 封装
│   ├── database.js          # SQLite 数据库操作
│   ├── categorizer.js       # 自动分类引擎
│   ├── ai.js                # AI 服务集成（支持多提供商）
│   └── markdownRenderer.js  # Markdown 转 HTML 渲染器
├── App.js                   # 应用入口与页面路由
├── app.json                 # Expo 配置
└── package.json             # 依赖管理
```

## 自动分类

应用内置了基于编程语言和关键词的自动分类引擎：

| 分类 | 匹配逻辑 |
|------|---------|
| Web 应用 | HTML/CSS/JS/TS + Web 相关关键词 |
| 移动应用 | Java/Kotlin/Dart/Swift + 移动相关关键词 |
| 桌面应用 | C++/C#/Go/Rust/Zig + 桌面相关关键词 |
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

## AI 分析

应用支持通过可配置的 AI 提供商（兼容 OpenAI 接口）对仓库进行智能分析：

- **摘要生成** — 自动为仓库生成简洁的中文摘要
- **标签提取** — 提取仓库相关的技术标签
- **平台识别** — 识别目标平台（iOS、Android、Web、桌面端等）
- **批量分析** — 支持全部分析、仅分析未分析的、重新分析失败的三种模式
- **中途停止** — 批量分析过程中可随时停止
- **结果缓存** — AI 分析结果存储在本地，支持离线查看

## 致谢

感谢 [AmintaCCCP/GithubStarsManager](https://github.com/AmintaCCCP/GithubStarsManager) 仓库提供的灵感与参考。

## 许可证

[MIT](LICENSE)
