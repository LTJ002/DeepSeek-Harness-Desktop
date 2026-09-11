# DeepSeek Harness 桌面版

[English](README.md) | 中文

## 项目简介

DeepSeek Harness 桌面版（`dsh-desktop`）是一款 Windows 桌面应用，将 `dsh web` 的 Web 界面封装为原生 Electron 桌面应用。

- 双击启动，自动拉起内置 `dsh web` 服务，在原生窗口打开界面
- 完全自包含：内置 Electron 43 + Node.js 22 + 完整 `@deepseek-ai/dsh` 包，不依赖系统 Node.js
- 与命令行版共享 `~/.dsh`（profile / 会话 / 存储全部通用）
- 默认工作目录：`%USERPROFILE%\DeepSeekHarness`

当前版本：**0.1.8**（内核 **0.1.5-rc.2**）

## 界面截图

![DeepSeek Harness 桌面版](docs/images/screenshot.png)

## 项目结构

```
dsh-desktop/
├── main.js                 # Electron 主进程：窗口与内核生命周期、插件安装/回滚、自愈补丁
├── preload.js              # 渲染进程桥：窗口控制、插件任务、设置页通信
├── app/                    # 渲染层页面（loading / error / mcp / plugins / settings）
├── build/                  # 打包脚本与资源（do-pack、NSIS、rcedit、图标、补丁工具）
├── harness/                # 随包分发的 dsh 内核（lib + node_modules）
├── runtime/                # 随包分发的 Node.js 22 与 pnpm
├── plugins/                # 内置桌面插件（dsh-desktop-settings）
├── patches/                # 内核补丁资源
├── docs/                   # 发布说明与文档
└── dist/                   # 打包产物（Setup / Portable）
```

## 功能特性

### 桌面端扩展

| 功能 | 说明 |
| --- | --- |
| MCP 自动检测 | 扫描 MCP 配置并同步到桌面端 |
| 插件市场 | 内置 pnpm，免环境安装/更新插件 |
| 插件安装安全 | 静态导入预检（不兼容插件在内核重启**之前**即回滚，安装期间会话保持可用）、装后验证加固、启动被坏插件阻断时自动回滚并明确提示 |
| 检查更新 | 从 GitHub Releases 检测新版本 |
| 对话与文件联动回滚 | `/rewind` 命令、消息悬停回滚、双击 Esc |
| 全屏 | F11 进入/退出全屏 |
| 窗口自动重连 | 内核重启后自动重连，不再灰屏卡死 |
| 黑框修复 | 子进程（git/pnpm/node）不再弹出黑色控制台窗口 |
| 日志体验 | 插件安装日志自动收起，一键清除 |

> 安装包**不预装任何插件**——需要的插件从内置插件市场按需安装。与当前内核不兼容的插件会被自动检测并回滚，不会破坏应用。

## 安装与下载（v0.1.8）

| 产物 | 说明 | 下载 |
| --- | --- | --- |
| DeepSeek.Harness.Setup.0.1.8.exe | 安装版：按用户安装（无需管理员），创建开始菜单与桌面快捷方式 | [下载](https://github.com/LTJ002/DeepSeek-Harness-Desktop/releases/download/v0.1.8/DeepSeek.Harness.Setup.0.1.8.exe) |
| DeepSeek.Harness.0.1.8.Portable.exe | 便携版：绿色免安装，自解压到 exe 旁运行 | [下载](https://github.com/LTJ002/DeepSeek-Harness-Desktop/releases/download/v0.1.8/DeepSeek.Harness.0.1.8.Portable.exe) |

> GitHub Release：https://github.com/LTJ002/DeepSeek-Harness-Desktop/releases/tag/v0.1.8

### 便携版说明

- 首次运行显示"正在初始化"进度窗口，解压完成后自动启动
- 绿色免安装，不写注册表，解压位置 = exe 所在位置

## 快捷键

| 按键 | 功能 |
| --- | --- |
| `F11` | 进入/退出全屏 |
| `Esc` | 退出全屏 |
| 输入框为空时双击 `Esc` | 打开"对话回滚" |

## 运行日志

- 桌面端日志：`%APPDATA%\DeepSeek Harness\harness.log`
- Harness 数据目录：`~/.dsh`

## 发布说明

- 全部版本：https://github.com/LTJ002/DeepSeek-Harness-Desktop/releases
- 0.1.8：[English](docs/RELEASE-0.1.8.en.md) | [中文](docs/RELEASE-0.1.8.zh.md)

## 开源协议

本项目基于 MIT 协议的 [deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) 二次开发，遵循 [MIT License](LICENSE)。
