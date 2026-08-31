# DeepSeek Harness 桌面版 0.1.5

[English Release Notes](https://github.com/LTJ002/DeepSeek-Harness-Desktop/releases/tag/v0.1.5) | 中文

---

## 0.1.5 更新内容

- **内核升级到 0.1.2-alpha.2**：harness 由 0.1.1-rc.2 升级至官方 npm 最新 alpha（会话格式迁移、沙箱与原生层重构），版本检测/冷启动适配完成
- **修复 Electron 主进程启动 harness 被回收**：直接 spawn 的长时子进程被 job object 回收（启动即退出），改为 node 桥接进程 + detached 启动 + 文件输出轮询，启动稳定
- **修复 token 认证页面无法打开**：alpha.2 的 web 服务带 token 保护，URL 识别现捕获完整地址（含 ?token=...），探测对 401/403 视为服务健康
- **修复反复冷启动**：alpha.2 页面标记变化（__DSH_BOOT__ → __ModuleLoader__）兼容检测，避免误判驻留 harness 失效
- **修复 MCP 同步误触发重启**：配置序列化不稳定导致每次启动判定“更新 N 个”并杀掉刚启动的 harness，改为仅写回配置不热重载
- **插件兼容调整**：移除与 alpha.2 不兼容的预装插件（dsh-vision-toolkit、dsh-at-file、dsh-better-sidebar、dsh-smooth-stream），仅预装 dsh-anchored-standard

## 下载

- `DeepSeek Harness Setup 0.1.5.0.exe` — 安装版（选择安装目录，开始菜单/桌面快捷方式，静默添加 Defender 排除）
- `DeepSeek Harness 0.1.5.0 Portable.exe` — 便携版（解压到 exe 旁的 `app`，版本不符自动重新解压）
