# Patches（超越 `harness/node_modules` 的安装副本修复）

这两处改动位于 `harness/node_modules/@deepseek-ai/*`（被 `.gitignore` 忽略，不进仓库主树），
但它们修复了真实的运行期 bug，因此以 patch 形式存档，供打包/重装后重新应用，或提交给上游
`deepseek-harness` 仓库的 `packages/` 源码。

## 01-glob-exclude-node_modules.patch

- 目标：`@deepseek-ai/dsh-tool-fs-search`（glob 工具）
- 问题：glob 用 `rg --files --no-ignore --hidden` 会把 `node_modules` 全量遍历，大工程里
  `**/*.md` 之类全量通配实测 20s~50s+，超过工具 30s 超时被中止。
- 修复：新增 `GLOB_DEPENDENCY_EXCLUDES`（默认 `node_modules`），与 VCS 目录一样用两个
  `--glob=!**/name` 排除。实测 art-design-pro `**/*.md` 从 2.7s → 0.14s。
- 应用（在 `harness/node_modules` 目录下）：
  ```
  git apply patches/01-glob-exclude-node_modules.patch
  ```

## 02-grant-write-access-denied-hint.patch

- 目标：`@deepseek-ai/dsh-sandbox-windows-acl`（Windows ACL 沙箱）
- 问题：工作区目录由旧系统账号所有（无 WRITE_DAC）时，`grantWrite` 的
  `SetNamedSecurityInfoW` 返回 Win32 5，报错只是 `SetNamedSecurityInfoW failed (Win32 5)`，
  完全没有提示原因。
- 修复：在 `SetNamedSecurityInfoW` 返回 `ERROR_ACCESS_DENIED` 时，报错附带所有权说明与
  修复命令（`icacls <dir> /setowner <current-user> /T /C`）。
- 应用：同上（路径为 `@deepseek-ai/dsh-sandbox-windows-acl/lib/types-CNjZgO4h.js`，注意
  哈希文件名 `types-CNjZgO4h.js` 为构建产物，重新打包后文件名可能变化，需对 `lib/types-*.js` 匹配应用）。

## 说明

- 上述两处已同步应用到运行程序 `E:\DeepSeekHarness\resources\harness\node_modules` 与
  源码 `D:\npm-global\node_modules\@deepseek-ai\dsh-desktop\harness\node_modules`。
- edit/write 的 v0.4 koffi-shim 修复（`harness/lib/koffi-shim.mjs`、
  `harness/lib/no-console-patch.cjs`、`main.js`）已直接提交进本仓库主树，见提交 `aef5bce`。
