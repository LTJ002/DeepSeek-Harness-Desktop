# Patches（超越 `harness/node_modules` 的安装副本修复）

这些改动位于 `harness/node_modules/@deepseek-ai/*`（被 `.gitignore` 忽略，不进仓库主树），
但它们修复了真实的运行期 bug，因此以 patch 形式存档，供打包/重装后重新应用，或提交给上游
`deepseek-harness` 仓库的 `packages/` 源码。

应用方式（在 `harness/node_modules` 目录下）：
```
git apply patches/01-glob-exclude-node_modules.patch
git apply patches/02-grant-write-access-denied-hint.patch
git apply patches/03-dsh-workspace-unarchive-session.patch
```

## 01-glob-exclude-node_modules.patch

- 目标：`@deepseek-ai/dsh-tool-fs-search`（glob 工具）
- 问题：glob 用 `rg --files --no-ignore --hidden` 会把 `node_modules` 全量遍历，大工程里
  `**/*.md` 之类全量通配实测 20s~50s+，超过工具 30s 超时被中止。
- 修复：新增 `GLOB_DEPENDENCY_EXCLUDES`（默认 `node_modules`），与 VCS 目录一样用两个
  `--glob=!**/name` 排除。实测 art-design-pro `**/*.md` 从 2.7s → 0.14s。

## 02-grant-write-access-denied-hint.patch

- 目标：`@deepseek-ai/dsh-sandbox-windows-acl`（Windows ACL 沙箱）
- 问题：工作区目录由旧系统账号所有（无 WRITE_DAC）时，`grantWrite` 的
  `SetNamedSecurityInfoW` 返回 Win32 5，报错只是 `SetNamedSecurityInfoW failed (Win32 5)`，
  完全没有提示原因。
- 修复：在 `SetNamedSecurityInfoW` 返回 `ERROR_ACCESS_DENIED` 时，报错附带所有权说明与
  修复命令（`icacls <dir> /setowner <current-user> /T /C`）。
- 注意：`types-CNjZgO4h.js` 为构建产物，重新打包后文件名可能变化，需对 `lib/types-*.js` 匹配应用。

## 03-dsh-workspace-unarchive-session.patch

- 目标：`@deepseek-ai/dsh-workspace`（工作区注册表，`lib/index.js` + `lib/types/index.js`）
- 问题：工作区侧边栏"归档会话"把 sessionId 加入 `archivedSessionIds` 后会话从列表隐藏，
  但**没有取消归档（恢复）的方法**——回滚页面的恢复按钮只能报"工作区服务不可用"。
- 修复：新增 `unarchiveSession(sessionId)`（从归档集合移除，会话恢复原位置）。
- 注意：运行中的 harness 从 `~/.dsh/profiles/web/node_modules`（pnpm 布局）加载该包，
  本机需对 profile 下 `.pnpm/**/@deepseek-ai/dsh-workspace/lib/index.js` 全部副本应用同一改动。

## 说明

- 上述改动已同步应用到运行程序 `D:\DeepSeekHarness\resources\harness\node_modules` 与
  源码 `D:\npm-global\node_modules\@deepseek-ai\dsh-desktop\harness\node_modules`。
- edit/write 的 v0.4 koffi-shim 修复（`harness/lib/koffi-shim.mjs`、
  `harness/lib/no-console-patch.cjs`、`main.js`）已直接提交进本仓库主树，见提交 `aef5bce`。
- 桌面插件 `plugins/dsh-desktop-settings`（检查点/回滚 UI/消息磁盘兜底/归档恢复等）为仓库主树
  文件，直接随提交发布。