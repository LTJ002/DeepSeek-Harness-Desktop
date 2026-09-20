# DeepSeek Harness 桌面版 0.1.8.2

[English](https://github.com/LTJ002/DeepSeek-Harness-Desktop/blob/main/docs/RELEASE-0.1.8.2.en.md) | 中文

---

## 0.1.8.2 更新内容

插件更新安全与设置图标修复版。内核保持 **0.1.5-rc.2** 不变。

### 内核组件不再作为插件更新

- `@deepseek-ai/*` 官方 scope 的包（内核组件）**不再参与插件更新检查**——显示为「内核组件（随内核整体升级，不单独更新）」而非可更新，更新入口即使被手动触发也会拒绝。内核组件是内核的一部分，必须整体升级（单独安装会造成 rc/alpha 版本混装、内核组件互相不兼容——这正是「全部更新」碰到 `cordis` 等包时反复失败的根因）
- 用户自装的第三方插件（如 `@scope/dsh-xxx`、`dsh-xxx`）不受影响，仍可正常更新

### 设置分区图标修复

- **插件市场 / 归档管理 / 更新 / 文件提及** 分区的图标改为**内联 SVG** 绘制——不再依赖内核 UI 包的图标组件。内核升级移除那些组件后补丁会被跳过、图标退化为齿轮；内联版本自包含，内核升级不受影响
- 图标补丁现在**同时注入 profile 与 harness 两处副本**（此前只注入 harness，而前端实际加载 profile 副本——补丁报告成功但界面仍是齿轮）
- 补丁写入改为**断开硬链接**方式（临时文件 → 删除 → 重命名），不再污染 pnpm store

### 部署目录哨兵修复

- `resources/plugins/dsh-desktop-settings` 被清空时从 `app.asar` 内置副本恢复——改用 `readFile`/`readdir` 递归复制（`fs.cpSync` 无法读取 asar 路径，此前哨兵因此以 ENOENT 失败）
- `dsh-desktop-settings` 的 bundles 条目独立重新断言，link 正确但 bundles 缺失时也会被修复

### AI 诊断增强

- 优先通过 **GitHub API** 获取仓库 README（可达性远优于 raw 域名），并回退多分支多文件名
- 新增仓库简介与 `package.json` 包名作为线索
- 识别 README 里的安装命令（`npm i x`、`pnpm add x` 等）并提取包名
- 允许 README 推荐的其它仓库（不再限制必须同仓库）

### 修复

- AI 诊断清理在更新场景不再误删原有依赖（此前会在更新 cordis 失败、回滚已恢复原版本后又被清理删除）
- 设置插件修复的同源检测改为大小写不敏感比较（Windows `realpath` 盘符大小写差异曾使该防御失效）

### 构建

- 内置版本 **0.1.8.2**——`app.asar` 与 `exe` 版本元数据同步
