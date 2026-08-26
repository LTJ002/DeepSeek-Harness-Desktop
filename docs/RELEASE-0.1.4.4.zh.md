# DeepSeek Harness 桌面版 0.1.4.4

[English Release Notes](https://github.com/LTJ002/DeepSeek-Harness-Desktop/releases/tag/v0.1.4.4) | 中文

---

## 0.1.4.4 更新内容

- **修复 AI 生成期间切换文件/项目卡顿**：检查点快速去重——工作区相对最近一次检查点无变化时直接复用（`git diff --quiet` 秒级判断），跳过全量 `git add -A`/`commit-tree` 与文件拷贝，大幅降低生成期间的磁盘 IO，切换文件/项目恢复流畅

## 下载

- `DeepSeek.Harness.0.1.4.4.Setup.exe` —— 安装版（选择安装目录，开始菜单/桌面快捷方式，静默加入 Defender 排除）
- `DeepSeek.Harness.0.1.4.4.Portable.exe` —— 便携版（解压到 exe 旁的 `app\`，版本不符自动重新解压）
