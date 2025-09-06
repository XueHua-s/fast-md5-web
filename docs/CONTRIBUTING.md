# 贡献指南 / Contributing Guide

[English](#english) | [中文](#中文)

---

## 中文

### 📋 提交 Pull Request 规则

感谢您对 `fast-md5-web` 项目的贡献！请按照以下步骤提交您的更改：

#### 🔄 基本流程

1. **Fork 仓库**
   - 点击项目页面右上角的 "Fork" 按钮
   - 将仓库 fork 到您的个人 GitHub 账户

2. **克隆到本地**
   ```bash
   git clone https://github.com/YOUR_USERNAME/rust-wasm-calculate-file-md5.git
   cd rust-wasm-calculate-file-md5
   ```

3. **设置上游仓库**
   ```bash
   git remote add upstream https://github.com/XueHua-s/rust-wasm-calculate-file-md5.git
   ```

4. **保持同步**
   ```bash
   git fetch upstream
   git checkout main
   git merge upstream/main
   ```

#### 🌿 分支策略

- **功能开发 / 缺陷修复** → 提交到 `main` 分支
- **文档更改 / 优化** → 提交到 `docs` 分支

#### 📝 提交规范

**提交信息格式：**
```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

**类型 (type)：**
- `feat`: 新功能
- `fix`: 缺陷修复  
- `docs`: 文档更改
- `style`: 代码格式化（不影响功能）
- `refactor`: 重构代码（不是新功能也不是缺陷修复）
- `perf`: 性能优化
- `test`: 添加或修改测试
- `chore`: 构建过程或辅助工具的变动

**示例：**
```
feat(worker): add file handle management to prevent NotReadableError

- Implement file read slot limiting
- Add retry mechanism for failed file reads  
- Prevent file handle exhaustion during large batch processing

Fixes #123
```

#### 🚀 提交步骤

1. **创建功能分支**
   ```bash
   git checkout -b feature/your-feature-name
   # 或者对于修复
   git checkout -b fix/issue-description
   ```

2. **进行更改并测试**
   ```bash
   # 安装依赖
   pnpm install
   
   # 代码检查
   pnpm run lint
   pnpm run type-check
   
   # 格式化代码
   pnpm run format
   
   # 构建项目
   pnpm run build
   ```

3. **提交更改**
   ```bash
   git add .
   git commit -m "feat: your descriptive commit message"
   ```

4. **推送到您的 fork**
   ```bash
   git push origin feature/your-feature-name
   ```

5. **创建 Pull Request**
   - 进入您 fork 的仓库页面
   - 点击 "Compare & pull request"
   - 选择正确的目标分支：
     - 代码更改 → `main`
     - 文档更改 → `docs`
   - 填写 PR 模板

#### 📋 Pull Request 模板

```markdown
## 📝 更改类型
- [ ] 🐛 Bug 修复
- [ ] ✨ 新功能
- [ ] 📚 文档更新
- [ ] 🎨 代码风格
- [ ] ♻️ 重构
- [ ] ⚡ 性能优化
- [ ] ✅ 测试

## 📖 更改描述
简要描述您的更改...

## 🔗 相关问题
关闭 #(issue编号)

## 🧪 测试
- [ ] 代码通过所有现有测试
- [ ] 添加了新测试（如果适用）
- [ ] 手动测试通过

## 📸 截图（如果适用）
添加截图来说明您的更改

## ✅ 检查清单
- [ ] 代码遵循项目风格指南
- [ ] 进行了自我代码审查
- [ ] 注释了复杂的代码区域
- [ ] 更新了相关文档
```

#### 🔍 代码审查

- 维护者将审查您的 PR
- 请及时回应反馈和建议
- 根据需要进行修改
- 审查通过后将被合并

#### 📞 需要帮助？

如果您有任何问题：
- 查看现有的 [Issues](https://github.com/XueHua-s/rust-wasm-calculate-file-md5/issues)
- 创建新的 Issue 进行讨论
- 通过 GitHub Discussion 寻求帮助

---

## English

### 📋 Pull Request Submission Rules

Thank you for contributing to the `fast-md5-web` project! Please follow these steps to submit your changes:

#### 🔄 Basic Workflow

1. **Fork the Repository**
   - Click the "Fork" button in the top right corner of the project page
   - Fork the repository to your personal GitHub account

2. **Clone Locally**
   ```bash
   git clone https://github.com/YOUR_USERNAME/rust-wasm-calculate-file-md5.git
   cd rust-wasm-calculate-file-md5
   ```

3. **Set Upstream Remote**
   ```bash
   git remote add upstream https://github.com/XueHua-s/rust-wasm-calculate-file-md5.git
   ```

4. **Stay Synced**
   ```bash
   git fetch upstream
   git checkout main
   git merge upstream/main
   ```

#### 🌿 Branching Strategy

- **Feature Development / Bug Fixes** → Submit to `main` branch
- **Documentation Changes / Optimizations** → Submit to `docs` branch

#### 📝 Commit Convention

**Commit Message Format:**
```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code formatting (no functional changes)
- `refactor`: Code refactoring (neither new feature nor bug fix)
- `perf`: Performance improvements
- `test`: Adding or modifying tests
- `chore`: Build process or auxiliary tool changes

**Example:**
```
feat(worker): add file handle management to prevent NotReadableError

- Implement file read slot limiting
- Add retry mechanism for failed file reads  
- Prevent file handle exhaustion during large batch processing

Fixes #123
```

#### 🚀 Submission Steps

1. **Create Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   # or for fixes
   git checkout -b fix/issue-description
   ```

2. **Make Changes and Test**
   ```bash
   # Install dependencies
   pnpm install
   
   # Code checking
   pnpm run lint
   pnpm run type-check
   
   # Format code
   pnpm run format
   
   # Build project
   pnpm run build
   ```

3. **Commit Changes**
   ```bash
   git add .
   git commit -m "feat: your descriptive commit message"
   ```

4. **Push to Your Fork**
   ```bash
   git push origin feature/your-feature-name
   ```

5. **Create Pull Request**
   - Go to your forked repository page
   - Click "Compare & pull request"
   - Select the correct target branch:
     - Code changes → `main`
     - Documentation changes → `docs`
   - Fill out the PR template

#### 📋 Pull Request Template

```markdown
## 📝 Change Type
- [ ] 🐛 Bug fix
- [ ] ✨ New feature
- [ ] 📚 Documentation update
- [ ] 🎨 Code style
- [ ] ♻️ Refactoring
- [ ] ⚡ Performance optimization
- [ ] ✅ Tests

## 📖 Description
Brief description of your changes...

## 🔗 Related Issues
Closes #(issue number)

## 🧪 Testing
- [ ] Code passes all existing tests
- [ ] Added new tests (if applicable)
- [ ] Manual testing passed

## 📸 Screenshots (if applicable)
Add screenshots to illustrate your changes

## ✅ Checklist
- [ ] Code follows project style guidelines
- [ ] Performed self-review of code
- [ ] Commented complex code areas
- [ ] Updated relevant documentation
```

#### 🔍 Code Review

- Maintainers will review your PR
- Please respond to feedback and suggestions promptly
- Make modifications as needed
- Will be merged after review approval

#### 📞 Need Help?

If you have any questions:
- Check existing [Issues](https://github.com/XueHua-s/rust-wasm-calculate-file-md5/issues)
- Create a new Issue for discussion
- Seek help through GitHub Discussions

---

## 🙏 致谢 / Acknowledgments

感谢所有为这个项目做出贡献的开发者！
Thanks to all developers who contribute to this project!