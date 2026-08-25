# DeepSeek Harness 桌面版 0.1.4.2

[English Release Notes](https://github.com/LTJ002/DeepSeek-Harness-Desktop/releases/tag/v0.1.4.2) | 中文

---

## 0.1.4.2 更新内容

- **修复 edit/write 覆盖/编辑报错**：覆盖已有文件或编辑时报「Unexpected character '(' in type specifier」——koffi-shim 升级 v0.4，`lib.func` 参数透传保留原型串调用形式，新建/覆盖/编辑全部恢复正常

- **修复 glob 全量通配超时**：默认排除 `node_modules` 遍历，大工程 `**/*.md` 之类通配实测提速 20 倍以上，不再触发 30 秒超时中止

- **修复 pwsh / 受限沙箱启动即崩**：`grantWrite` 报错增强，遇到目录归属问题（无 WRITE_DAC）时明确提示原因与修复命令（`icacls <dir> /setowner <user> /T /C`）

- **修复检查点/工作区级回滚从未生效**：`sessionIdentity` 改读 `session.header.cwd`（此前恒为 null，检查点从未创建，备份/工作区级回滚一直静默失效）

- **修复回滚页面消息列表**：离线/历史会话改从磁盘直读会话文件（zstd 多帧解压）兜底，「回滚到第 N 条之前」选项恢复可用

- **修复回滚目标下拉框点开空白**：原生 select 改为按钮 + 内联菜单（普通渲染、消息预加载、加载失败可点重试），不再出现空白下拉

- **新增已归档会话恢复**：工作区侧边栏「归档会话」的会话在回滚页面显示「已归档」标识，支持单个/全部恢复（`workspaceRegistry.unarchiveSession`），恢复后回到会话列表

- **新增回收站「全部恢复」**：一键恢复所有归档（删除进回收站）的会话

- **优化回滚页面 UI**：相对时间（刚刚/N 分钟前/昨天）、保护检查点徽章、统计信息、卡片信息分层

- **工程整理**：归档 `harness/node_modules` 修复补丁（`patches/01-03`），整理 `.gitignore`，清理调试残留与冗余备份文件

## 下载

- `DeepSeek.Harness.0.1.4.2.Setup.exe` —— 安装版（选择安装目录，开始菜单/桌面快捷方式，静默加入 Defender 排除）
- `DeepSeek.Harness.0.1.4.2.Portable.exe` —— 便携版（解压到 exe 旁的 `app\`，版本不符自动重新解压）
