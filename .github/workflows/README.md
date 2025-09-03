# GitHub Actions Workflows

## NPM Publish and Release

这个工作流用于自动化发布npm包到npmjs.org并创建GitHub Release。

### 功能特性

- 🚀 支持手动触发发布流程
- 📦 自动版本管理（major、minor、patch）
- 🔄 自动更新package.json中的版本号
- 📤 发布到NPM registry
- 🏷️ 创建GitHub Release和Tag
- 🦀 支持Rust WASM构建
- ⚡ 使用pnpm作为包管理器

### 使用方法

1. 在GitHub仓库页面，点击 "Actions" 标签
2. 选择 "NPM Publish and Release" 工作流
3. 点击 "Run workflow" 按钮
4. 选择版本类型：
   - **major**: 主版本号 (1.0.0 → 2.0.0)
   - **minor**: 次版本号 (1.0.0 → 1.1.0)
   - **patch**: 补丁版本号 (1.0.0 → 1.0.1)
5. 点击 "Run workflow" 开始发布流程

### 必需的Secrets

在仓库设置中配置以下secrets：

- `NPM_PUBLISH_TOKEN`: NPM发布令牌，用于发布包到npmjs.org

### 工作流程

1. **检出代码**: 获取最新的代码
2. **设置环境**: 配置Node.js、pnpm、Rust和wasm-pack
3. **安装依赖**: 安装项目依赖
4. **版本管理**: 根据选择的类型更新版本号
5. **构建项目**: 编译Rust WASM和TypeScript代码
6. **运行测试**: 如果存在测试则运行（可选）
7. **发布NPM**: 将包发布到npmjs.org
8. **推送更改**: 将版本更新推送到GitHub
9. **创建Release**: 创建GitHub Release和Tag

### 注意事项

- 确保你有仓库的写入权限
- NPM_PUBLISH_TOKEN需要有发布权限
- 工作流会自动提交版本更改到main分支
- 每次发布都会创建一个新的Git tag和GitHub Release