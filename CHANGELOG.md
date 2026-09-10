# 更新日志

v0.1.7
2026-09-10
● 桌面端版本 0.1.7（内核保持官方 0.1.5-rc.1）：桌面端外壳与内核各自独立编号——「软件更新」页的「当前版本」显示桌面端 0.1.7、「内核」显示实际的内核版本 0.1.5-rc.1（由 harness/package.json 读取，未改动）
● 英文模式下 A 类译文补齐：基于 JS lexer 的 i18n 审计脚本对 client.js 所有 `t()` / `tr()` 调用做了全量 key 命中核查，结果为 A=0（每个被调用的中文字面量都已经在英文字典里有对应条目）；B=340 处仍为裸写中文（其中约 1/3 来自页面内嵌的 CHANGELOG 历史块、约 220 处是状态/确认/日志短句），本轮先保证英文模式下不再有任何 A 类回退为中文，再视用户决定是否继续处理 B 类
● 「V41 → V4.1」的运行时证据：上一轮已把内核 dsh-llm-deepseek 的 DEFAULT_MODELS[0].name 改为 `DeepSeek-V4.1-Flash` 并同步源码包，但用户反馈仍见 V41。现通过运行内核的实时反射拿到 DEFAULT_MODELS 实际值：`[{id:"deepseek-flash",name:"DeepSeek-V4.1-Flash"}, {id:"deepseek-v4-flash",name:"DeepSeek-V4-Flash"}, {id:"deepseek-v4-pro",name:"DeepSeek-V4-Pro"}, {id:"deepseek-v4-flash-vision-exp",name:"DeepSeek-V4-Flash-Vision-Exp"}]`，「含 V41? false / 含 V4.1? true」。仓库全量 grep `V41` 仅命中 PDF.js cmap base64 串与 mermaid 编译产物里的 JS 变量名 `$V41` 等占位符，皆非模型名；client.js 内嵌的 CHANGELOG 历史块仅提到旧模型名 `DeepSeek-V4-Flash-Vision-Exp`、不含 V41。故 V41 字符串在本仓库与运行内核任何被加载的代码里均不存在——用户实际看到的「V41」应来自浏览器/模型选择器缓存中的某次旧渲染，硬刷新或新建会话即可看到 V4.1
● 启动页 bundle 加载锁死 `Failed to load plugins ... bundle script /plugins/??...&rev=<hash> failed to load` 的根因修复：v0.1.6 之前 `findExistingDshWeb` 用 `-match 'dsh' -and -match '\sweb(\s|$)'` 过滤候选内核——但**打包版内核路径 `E:\DeepSeekHarness\resources\harness\lib\bin.js` 字面不含 `dsh`**，过滤恒命中 0 条，函数直接返回 null；与此同时，旧版本某次强杀/卸载半路崩后 `taskkill /T /F` 没把孙进程清干净，留下监听 127.0.0.1 随机端口的孤儿内核（实测 pid=22704，父进程 7220 已不存在；`desktop-running.json` 缺失 + `harness.log` 无新 `dsh web start` 行——说明本轮根本没起新内核），主进程下次启动走 `findExistingDshWeb` 时探测到该端口并直接复用，窗口连过去加载的是孤儿在旧 `node_modules` 快照下生成的 bundle，`framedHash("combo", ...)` 输出 `rev=e9a5316a0e18` **每次启动都锁死**。两处同步修复：① 过滤器改为 `bin\.js -and \s--profile\s+web(\s|$)`，与 `HARNESS_WRITER_QUERY`（L317）一致，打包版与源码包两条路径都精确命中；② 新增孤儿检测——候选内核的 `ParentProcessId` 不在当前 `Get-CimInstance Win32_Process` 返回的存活 PID 表里即为孤儿，`taskkill /T /F` 杀除、不复用、继续走 `startHarness` 自起新内核；同时 `findExistingDshWeb` 的返回 JSON 多带 `ppid` 字段以供判定。修后用现有过滤条件（`bin\.js` + `--profile web`）实测可命中打包版内核、且孤儿场景下 `harness.log` 会打印 `[desktop] 发现孤儿 dsh web 内核 pid=... 杀除并自起新内核`。**发布前必修**：v0.1.6 已修过同款 `killDshWebWriters*` 的字面 `dsh` 过滤（见 v0.1.6 第 5 条），但 `findExistingDshWeb` 这一处漏改了

v0.1.6
2026-09-05
● 内核升级：harness 由 0.1.2-alpha.2 升级到 0.1.2-rc.1（官方 npm 包），适配 rc.1 精简后的依赖结构；新功能含会话流折叠、token 用量/耗时显示、全文回合导航、子代理模型选择、实验性 Inspector 与 Web Preview 等
● web profile 依赖重写与修复：补充 peer 依赖；修复 koffi 未提升、pnpm store 版本不一致（ERR_PNPM_UNEXPECTED_STORE）、CLI/SDK bundle 误入导致的 duplicate loader
● 插件安装策略：git 源自动解析最新 release tag、加载验证失败自动备用源、构建脚本 allowBuilds 自动授权；卸载改进（先结束进程、robocopy 空目录镜像删除、无残留）
● 归档与回滚：恢复归档修复（dsh-workspace 补 unarchiveSession，幂等恢复）；热回滚 URL 拼接修复（serverUrl 含 token 导致请求从未到达——热回滚首次真正可用）；超时 15s+重试+READONLY 分支；消息提取异步化（7.9s→200ms）+缓存；已归档/未归档分组联动；系统注入消息过滤
● 归档静默失败根因修复：清场命令长期空转——打包版内核命令行为 `<resources>\harness\lib\bin.js --profile web …`（含 web、不含字面量 dsh），旧过滤条件 `-match 'dsh' -and -match '\sweb(\s|$)'` 两个正则必须同时命中故恒为空（实测 0 命中，harness.log 一个月 0 次"已终止 dsh web 写入进程"），改为按 `node.exe + bin.js + --profile web` 识别（实测精确命中内核 pid，不误伤 MCP 子进程与 node -e 桥接）；`serverProc` 为空（复用驻留/外部内核）时改按服务端口清场，否则第②步为空操作；rename 改退避重试（0/120/300/800/400/600ms）；失败回收本次新建的空回收站目录并把真实 errno 透出界面（EPERM=句柄占用、ENOENT=列表过期），不再 `catch {}` 静默；`restoreTrashSession`/`deleteTrashSession` 同步清理空壳项目目录与批次目录
● 检查点：适配 rc.1 tool/call 格式修复「未修改任何文件」；消息被截断时降级整体恢复；大工作区快照修复（排除 .m2-repo/.gradle、120s 超时、关 autocrlf、错误压缩——修复检查点超时阻断 AI 工具）；预览=恢复范围一致（untracked 如实显示、gitignored 回滚保留）；ACTIVE_TURN 保护；guard 独立预览
● 插件与安全：卸载防线（内核/bundle 标「系统」禁卸，默认插件豁免）；卸载联动清理 MCP 服务器条目；插件更新生效验证（pnpm added 0 假成功如实报错）；市场「禁用」→「屏蔽」
● 进程清理：退出时 taskkill /T /F 结束内核进程树，无孤儿进程
● 打包/部署一致性：打包期 no-console 补丁固化，源码打包→安装→启动与部署版逐字节一致
● 会话回滚失效根因修复（rc.1 会话格式分代）：内核 dsh-session-persistence-jsonl 按 Session 格式版本命名日志——version 0 为 `session.jsonl.zstd`（原始名、无版本号），version N≥1 为 `session.vN.jsonl.zstd`，rc.1 内核当前写 v3；而桌面端所有会话文件定位都硬编码无版本号的旧名（walkSessionFiles / repairAllSessions / walkTrashSessionFiles / deleteSessionFile / deleteTrashSession / restoreTrashSession 共 6 处）。内核升级后，回滚/删除/修复全部作用在早已停更的僵尸文件上——磁盘旧文件被截断、内核真正读取的 v3 分毫未动，用户看到的现象正是「点回滚毫无反应」，且旧文件被截成空壳后更不易察觉；仅有 v3 的会话在桌面端还完全不可见。现统一按会话目录选取最高版本日志（同目录多代去重），实测会话列表由 37 个恢复为 40 个（找回 3 个此前不可见的会话）
● 会话回滚内存同步修复：热截断探测返回 OFFLINE/NO_MESSAGE/NO_SPLICE/NO_FILE 时走的磁盘路径缺少内存卸载——磁盘已截断而内核仍持有完整日志，主窗口刷新后对话毫无变化；更糟的是后续任何写入都会把内存里的旧内容重新落盘，回滚被静默撤销（数据复活）。现该路径统一先调用 `/enh/dispose-session` 卸载内存会话（走内核 sessions store，不依赖插件侧 liveSessions、幂等且只影响该会话）再截断磁盘，并在日志中记录 code 便于诊断
● 插件更新失效根因修复（pnpm 发布年龄门槛 + 假更新）：pnpm 11 默认开启 minimumReleaseAge（1440 分钟 = 24 小时发布年龄门槛），`pnpm add <pkg>@latest` 在 latest 发布于窗口内时会把版本「静默回退」到上一个够老的版本——无报错、退出码 0、added 0，于是更新看似成功而版本原地不动，而更新检测仍按 dist-tags.latest 报「可更新」，用户点更新永远消不掉（实测 @upstash/context7-mcp：latest=4.0.7 发布仅 20 小时，在全新空项目里 `@latest` 也只装到 4.0.6）。修复分两侧：① 检测侧做发布年龄感知——读 packument 的 time 算出「当前真正可安装的最新稳定版」（installableVersion），只有它高于已装版本才报可更新；仍在窗口内的最新版单独列为「暂受发布年龄门槛保护」并给出解锁时间，从根上消灭假更新；② 更新侧改按精确版本安装（pnpm 视精确版本为用户的明确意图，会自动写入 minimumReleaseAgeExclude 放行），不再依赖 @latest。默认尊重该门槛，但门槛条目提供「立即更新」逐条显式放行（含二次确认与风险说明），不做静默绕过；窗口过后自动回到可更新列表
● 插件更新检查性能：发布年龄判定改为惰性取数——先用便宜的 `dist-tags.latest` 探一下，只有它确实高于已装版本时才拉完整 packument 判断门槛（完整 packument 含全部历史版本与发布时间，实测平均 33 KB/个，211 个依赖全拉就是 ~7 MB/次，而检查在启动时与每 24 小时各跑一次；绝大多数依赖已是最新，不必付这笔开销）
● 插件更新卡片不刷新修复：`dsh:plugin-update-check` 原先忽略入参恒返回缓存，而更新成功后缓存被置空、接口又只返回 {pending:true}，前端 fetch 逻辑显式丢弃 pending 结果 ⇒「有 N 个插件可更新」卡片无论如何都不刷新，手动「重新检查」也形同虚设。现接口新增 force 参数（preload 与界面半同步透传），手动「重新检查」与每次更新完成后都强制真查一次
● 修复「点回滚没反应」的反馈丢失（回滚执行成功但界面无任何提示）：RollbackSection / DeleteSection 的无感刷新用 `{ data, refreshing: false }` **整体替换** state，把 `status` 一并抹掉，而 `doRollback` / `doDelete` / `doUnarchive` / `doUnarchiveAll` / `doRestore` / `doRestoreAll` 都是「先 setStatus 再 load()」——成功与失败提示活不过几百毫秒，用户看到的就是"点了没反应"（实测 09-10 19:18 的一次回滚磁盘上确实生效：会话日志 46 KB → 367 B、并移除了该轮新建文件 E:\个人项目\photography\.dsh-tool-test\toolcheck.md，但界面上毫无反馈）。现改为 `{...prev, data, ...}` 保留 status/error。另新增**回滚结果页面级横幅**：回滚成功后主进程 `win.webContents.reload()` 整页刷新，宿主设置弹窗随之关闭、RollbackSection 卸载，用户只看到"重新加载了一下"。（先做过「刷新后自动重开设置面板」，但那条路要先命中宿主设置入口的内部 DOM `button[aria-haspopup="dialog"]`，宿主一改版即静默失效——实测未命中，用户复现的正是"只是重新加载页面"。）现改为**页面级**渲染横幅：只依赖 `document.body`，刷新后一定能看到，显示 ✔/✖ + **目标会话（用户才能确认回滚的是谁）** + 完整结果（长文件清单默认折叠、可展开）+ 「打开归档管理 / 关闭」按钮，成功横幅 30 秒自动收起、失败横幅保留。**时序要点**：结果由主进程在整页刷新后**延时 2s** 才写入 localStorage（`stashRollbackNoticeDeferred`，为让写入落在刷新后的新文档上），因此读取必须**轮询**（只在启动时读一次会必然漏掉）；另外点击回滚时会在调用 IPC **之前**把「目标会话 + 位置」写进 localStorage（此刻还没开始导航，写入一定有效），成功分支里也会先自行写一份结果作兜底；两条都拿不到时约 12s 后显示「未收到回滚结果，请打开归档管理确认」，**绝不静默**。回归 `tmp/verify-notice-reopen.cjs` 覆盖 5 种情况：启动前已有的新鲜结果 / **启动后 2s 才落地（主进程真实时序）** / 全部过期 / 无任何记录 / **只有目标而结果始终不来（兜底文案）**
● 回滚确认框补上破坏性量级提示：此前只说「会删除该消息及其后的内容，并撤销对应的文件改动」，而用户选「第 1 条」时实际等效于**清空整个会话**——对话记录全删、本会话对工作区的全部文件改动被撤销（实测一次撤销了 34 个文件修改、删除了 31 个本轮新建的源文件）。现在把所选位置译成人话（「第 N 条之前」/「最后一轮」/「整个会话」），命中第一个节点时额外用一段话说明这等效于清空整个会话、涉及文件可能有几十个
● 文案与布局修正：回收站描述、MCP 状态词统一、回滚页计数口径、头部样式；插件「暂受发布年龄门槛保护」卡片改为面向用户的白话文案——去掉 pnpm / 发布年龄门槛 / 防投毒 等内部术语，标题改为「有 N 个插件的新版本刚发布，先等 24 小时再更新」，每条拆成三行（插件名 /「已装 X → 新版本 Y」/「新版本 N 小时前发布，约 M 小时后可以更新」），按钮由「仍要更新」改为「立即更新」，脚注分两句说明用意；并**明确写出「应用只会自动检查有没有新版本，不会自己安装——每次更新都要你点一下」**（文案初稿用了「自动更新」一词，会让用户以为存在后台自动安装，而 main.js 实际是启动后 + 每 24 小时仅检查提示、安装只能由界面按钮触发）；二次确认弹窗改为直白说明「跳过观察期＝可能把含未知恶意代码的版本直接装进环境」，并给出「等着就行，观察期满会出现在上方可更新列表，到时点一下就能装」的替代路径
● 插件市场与 AI 诊断修复（同为「状态只写不清理」缺陷 + 一处必然失败的传参）：① 市场卡片「装一次就永久卡死」——`installRepo` 失败时把 `busy[repo]` 写成「✖ + 600 字 pnpm 日志」且**全文件无任何清理点**（只有 4 处写入、0 处删除），而卡片按钮是 `disabled: pluginBusy || !!status`，于是某插件装失败一次后它的「安装」按钮就永久变灰、标签变成一大段原始日志，只能重载页面才能恢复；现新增 `clearBusy`，成功与全失败两条路径都清理，长日志改写入可滚动的日志区（保留 1500 字并写明「常规安装失败，正在启动 AI 诊断」）。② 手动「AI 安装」按钮**从未真正生效**——`onClick: aiInstallPkg` 会把 React 事件对象当成包名传进 IPC，结构化克隆失败抛 could not be cloned，用户看到的是「✖ AI 安装调用失败」；现改为显式传包名，并把市场页/已安装页两份重复实现合并为一份（避免改一处漏一处）。③ 手动「AI 安装」现登记为后台任务并传入 job（`trackPluginJob('ai', pkg, (job) => aiInstallPlugin(pkg, job))`）：此前不传 job ⇒ 最长 10 分钟的 AI 诊断进度只存在于设置页日志里，用户中途关掉设置页就彻底丢失，右下角任务面板也是空的；同时补上任务类型→文案映射表（原先 `mode === 'add' ? '安装' : '卸载'` 的二元判断会把新类型显示成「卸载」）。④ AI 诊断可用性改为**点击前预判**：新增 `dsh:ai-install-ready`（preload 同步暴露），没配好模型服务时按钮直接置灰并说明原因，不再让用户点下去白等十分钟才被告知；相应把 `未配置 AI 服务密钥：请在 ~/.dsh/.credentials.yaml 配置…OPENCODE_GO_API_KEY / DEEPSEEK_API_KEY` 这类内部术语换成「还没有可用的 AI 服务，无法自动诊断。请先在设置里配置一个模型服务，再回来重试。」⑤「重新检查」失败不再静默：原先只在 `r.ok` 分支写日志，断网/超时时按钮转完一圈什么都不说，现失败/检查中/「已是最新」三种结果都有反馈。⑥ 空输入兜底：粘贴了无法识别的内容、或什么都没填就点「安装」时说明正确格式，而非毫无反应。回归 `tmp/verify-plugin-fixes.cjs`（16 项：源码级守门 + 用事件对象点按钮、断言传出的是字符串包名）
● 冗余与死代码清理（纯重构，无行为变更）：**设置页界面半**抽出两个公共渲染函数——`renderPluginFeedback()`（安装日志 + 清除日志按钮 + AI 诊断入口 + AI 进度）与 `renderRestartCard()`（插件变更后重启提示）。这两块原先在「插件市场」与「已安装插件」两个 Tab 各写一份：前者逐字相同，后者**样式还不一致**（一处 `nowrap` + 省略号 + `flexShrink`，一处裸 `S.row` + 13px 小字号，同一件事在相邻两个 Tab 长得不一样），改一处必漏另一处——本轮「AI 安装」卡片正是两边带着同一个 bug。另删除 2 处 `if (r && r.ok) { /* 注释 */ }` 的空判断占位（改写为单分支）与词典里 15 条**从未被任何 `t()` 引用的死译文**（其中 5 条属于此前已移除的「视觉 API 密钥」入口）。**主进程**删除 10 处确证死代码：`killDshWebWritersSync`（29 行，已被异步版 `killDshWebWritersAsync` 取代）、`scanClientMcp`（28 行，扫描 Claude Desktop/Cursor/VS Code/Cline/Windsurf 配置，实际生效来源是 `~/.claude.json` 与 opencode，保留一段说明注释而不是静默删除）、`githubReleaseTarball`（4 行包装，调用点早已内联 `rel.tagTarball`）、`userTextFromLine`、`DOWNLOAD_HEAD_RETRY`，以及「退出后延迟杀」废弃方案的残留状态（`HARNESS_RESIDENT_MS` / `HARNESS_REUSE_WINDOW_MS` / `lastExitTime` / `harnessResidentTimer` / `residentProc` —— 该设计已废弃，延迟杀用 unref 定时器、应用退出后永不触发，故这些常量与"永不非空"的清理分支都属误导性残留；退出清场简化为 `const treeRoot = serverProc`，复用驻留内核的情形由 `killLocalPortOwner(port)` 按端口兜底）。清理后两个文件的确证死声明均为 **0**（main.js 用 1104 个声明、client.js 用 373 个声明的全量引用计数核验），回归 `tmp/verify-plugin-fixes.cjs` 扩到 **30 项**并新增「查重守门」（重复块只能有 1 份实现 + N 个调用点，防止重新长出来）与「两个 Tab 都渲染出公共块」的运行时断言，`smoke-client.cjs` 4×2 个 Tab 组合全过
● 修正内核内置 provider 的默认模型名（`DeepSeek-V41-Flash` → `DeepSeek-V4.1-Flash`）：该名字硬编码在内核包 `resources/harness/node_modules/@deepseek-ai/dsh-llm-deepseek/lib/index.js` 的 `DEFAULT_MODELS` 首项（`{ id: "deepseek-flash", name: "DeepSeek-V41-Flash" }`，第 1844 行），是 `deepseek-official` 这条内置 provider 路由的默认模型目录——同数组另外三项分别写作 `DeepSeek-V4-Flash` / `DeepSeek-V4-Pro` / `DeepSeek-V4-Flash-Vision-Exp`，唯独首项少了一个点号，用户在模型选择器里看到的就是这个「V41」。经核查**属上游内核自带文案、非本仓库引入**：运行安装版与源码包该文件逐字节一致（同为内核 0.1.5-rc.1），桌面端 `main.js` / 设置页 `client.js` 全文 grep `V41` 命中 0 处。现按用户要求改为 `DeepSeek-V4.1-Flash`，运行版与源码包两侧同步（md5 一致 `2b35cabe5918e5a0945bc8fbdd810561`），文件为 ESM（`node --check` 以 `.mjs` 复核两侧语法通过），且改动为**原地编辑**、inode 未变（该文件链接数为 2，避免断链导致运行内核仍加载旧内容）。包内另有 3 处 `V41` 仅存在于 `.d.ts` JSDoc 注释与 `README.md` / `README.zh.md` 的说明表格里，属纯文档、不影响运行时，未改动
● 「已安装插件」页：修正"装什么都变成系统插件"的判定缺陷 + 内核自带组件折叠。**缺陷**：系统身份判定是 `isCorePkg(d) || (plugins.bundles.includes(d) && !defaultPlugins.includes(d))`，而主进程在安装「bundle 类」插件时会**自动把它写进** `dsh.profile.bundles`（main.js「安装的是 bundle 插件时，把它加入 dsh.profile.bundles，否则重启后 bundle 层不会生效」），于是用户自己装的 bundle 插件（实测 `toto-the-cat`）一旦装上就永久带「系统」徽章、没有任何卸载入口；后端 `uninstallPlugin` 的 `isProtectedCorePkg(pkg) || installedBundles.includes(pkg)` 同样拒绝卸载。而该防线原本想挡的是「内核隐式依赖」（cordis / dsh-web-frontend 等不在插件依赖登记里、dependents 检查覆盖不到），bundle 这一条既多余（卸载路径本就会 `syncBundleAfterUninstall` 把它移出 bundles，连"仅在 bundle 层、不在 dependencies"的分支都专门处理了）又与 main.js「用户自由卸载」的既定原则冲突。现**收窄为真内核三项**：`@deepseek-ai/*` 全部、无 scope 的内核裸依赖（commander / open / node-addon-require-builtin）、以及设置页插件自身 `dsh-desktop-settings`（profile 以 `link:` 引用，卸掉会直接丢掉设置界面）；界面半与 main.js 同步改（`installedBundles` 变量随之删除）。实测当前 profile 213 个依赖里，改前只有 1 个（`@upstash/context7-mcp`）能卸载、212 个显示「系统」，改后用户装的 `toto-the-cat` 恢复卸载入口。**折叠**：profile 的 dependencies 实际含 207 个 `@deepseek-ai/*`，全量平铺会把用户自己的插件淹掉——现把「已安装依赖」与「已启用的 Bundle 层」各自拆成「你装的」（直接平铺）与「系统组件（N）」（默认折叠，`▸/▾` 可展开）两段，折叠态不渲染任何系统条目；顺带把「已安装依赖」的单行渲染抽成 `renderDepRow` / `renderBundleRow`（原先依赖区与 bundle 区各写一份，样式与按钮必然漂移），系统条目不再出现「更新」按钮（内核包不归插件页管，误更新会直接打断应用），行内文案由「依赖」改为「内核自带」。i18n 同步：新增 `系统组件（{n}）` / `内核自带` / `没有你安装的插件` 译文，并把原先裸写的 `卸载中…`（2 处）、`系统组件，不允许卸载`、`bundle 层为应用内置组件，不允许卸载` 收进 `t()`。回归 `tmp/verify-system-group.cjs`（31 项：源码级守门 + 运行时用 8 条模拟依赖断言"用户插件有卸载入口、系统条目默认不渲染、展开后可见且无更新入口"，折叠态徽章数 0 → 展开态 9）
● 安装/更新多源切换补强（registry 自动回退）：此前更新检查走国内镜像（npmmirror）而安装走官方 npm 源，国内网络下会出现「检查有更新、点安装却网络失败」且不自动换源。现官方源网络类失败（ERR_PNPM_FETCH / ETIMEDOUT / ECONNRESET / DNS / 证书）时自动切换 npmmirror 镜像重试一次（与官方内容同步，仅换下载源），秒级完成并在日志注明「已自动切换国内镜像源重试成功」；回退位置放在 AI 诊断之前（更快更直接）。包来源类型的多源回退（GitHub release 下载包 / tag tarball / main·master 分支 tarball / github: / git+https 共 6 种 + 市场仓库匹配）与 AI 诊断换源此前已具备、保持不变；更新场景仍禁止切换到其它仓库源（防「更新变换源」把 npm 包换成同名仓库代码）
● 安装成功但不兼容的兜底（启动失败自动回滚最近插件变更）：装后软验证通过不代表冷启动没问题——验证与冷启动存在行为差异，坏插件可能在下次启动才崩（历史案例：bundle 冲突 duplicate loader entry id）。新增变更快照机制：安装/更新成功后写 `~/.dsh/cache/last-plugin-change.json`（包名/操作/旧版本/时间）；应用冷启动失败时读取，30 分钟窗口内自动回滚该变更（更新→恢复旧版本；新装→卸载并移出 bundles）后重试启动一次，仍失败才报错；回滚失败时清记录避免启动循环。与既有防线形成完整链条：装后软验证回滚（加载即崩）→ bundle 冲突预检（装上即冲突）→ 启动自愈（配置已写坏）→ 启动失败回滚（冷启动不兼容）
● AI 诊断优化：① **历史轮次传递**——3 轮自动修复原先每轮只带当轮日志，AI 不知前几轮试过什么、可能重复同样的无效方案；现把已尝试方案（action/env/command）随提示词一并发给 AI 并注明「均失败，不要重复建议」。② **危险环境变量黑名单**——`sanitizeAiEnv` 原先允许 AI 设置任意合法命名的环境变量，其中 NODE_OPTIONS / NODE_PATH / LD_PRELOAD / DYLD_INSERT_LIBRARIES 可在后续 pnpm 调用中注入代码执行、PATH / PATHEXT / COMSPEC 可劫持命令解析；现全部拦截（提示词同步注明不允许），构成对 AI 输出（含潜在提示词注入）的防御
● 归档管理补全（回滚归档 UI 入口）：回滚会话时被移出的「本轮新建文件」（存于 `~/.dsh/rollback-trash`，保留目录结构与 `_meta.json` 元数据）此前只有后端 IPC、没有界面入口，误回滚后无法在界面找回。现于「归档管理 → 回收站」页新增「回滚归档」区块：按批次列出可恢复文件（悬停显示原完整路径），点「恢复」按元数据放回原工作区位置（跨卷自动复制回退），随列表 20s 自动刷新；preload 暴露 `rollbackTrashList` / `rollbackTrashRestore`，i18n 同步（回归：文件移动失败不再静默、空目录自动清理、同批成功文件绝不误删）
● 冗余清理：bundle 冲突检测的三处重复扫描逻辑（安装预检 `precheckBundleConflict` / 更新预检 / 启动自愈 `sanityCheckBundles` 各自实现一遍）合并为单一核心 `findBundleConflicts`（按声明顺序扫描、返回冲突三元组）——安装预检改为「追加到末位后检测自身冲突」，启动自愈改为「全量检测后移除冲突项」；全量引用计数核验（main.js 709 个声明 / client.js 222 个声明）确证死代码 0 处
● 桌面端与内核版本号各自独立（修正此前「内核统一为 0.1.7」的错误表述）：桌面端外壳为 0.1.7，内核保持官方 0.1.5-rc.1（`harness/package.json` 未改动）——「软件更新」页「当前版本」显示桌面端 0.1.7、「内核」显示实际读取的 0.1.5-rc.1

v0.1.5
2026-08-31
● 内核升级：harness 由 0.1.1-rc.2 升级到 0.1.2-alpha.2（官方 npm 包），适配 alpha.2 的会话格式迁移与沙箱/原生层重构
● 修复 Electron 主进程直接 spawn 的 harness 被 job object 回收（启动即 code=1 无输出）：改为 node -e 桥接进程 + detached 启动，输出重定向文件由主进程轮询
● 修复 harness 输出 URL 识别：alpha.2 的 web 服务带 token 认证，extractUrl 现捕获完整 URL（含 ?token=...），probe 对 401/403 视为服务健康
● 修复 alpha.2 页面标记变化：__DSH_BOOT__ 已移除，兼容检测 __ModuleLoader__，避免误判驻留 harness 失效而反复冷启动
● 修复 MCP 自动同步每次启动误触发 reload：配置序列化 key 顺序不稳定导致每次判定“更新 N 个”，反复杀掉刚启动的 harness，改为仅写回配置不热重载
● 修复 settings navicon 补丁兼容性：alpha.2 客户端图标导出改名，补丁注入前检测图标存在性，缺失则跳过（避免 ESM 加载崩溃）
● 内核依赖适配：移除官方 alpha.2 未发布的 3 个 experimental 依赖；pnpm 改用 node-linker=hoisted 布局并清理旧版残留，确保 loader 顶层解析正常
● 移除与 alpha.2 不兼容的插件：dsh-at-file、dsh-smooth-stream（依赖未发布的 dsh-client-runtime）、dsh-better-sidebar、dsh-vision-toolkit（依赖旧版 dsh-settings API）
● 升级记录：DeepSeekHarness内核升级记录.md 全流程复验（内核替换 / 依赖重装 / profile 对齐 / 冷启动验证）

v0.1.4.4
2026-08-27
· 修复 AI 生成期间切换文件/项目卡顿：检查点快速去重——工作区相对最近一次检查点无变化时直接复用（`git diff --quiet` 秒级判断），跳过全量 git add/commit 与文件拷贝，大幅降低生成期间磁盘 IO

v0.1.4.3
2026-08-25
· 修复 edit/write：覆盖已有文件 / 编辑时报错「Unexpected character '(' in type specifier」——koffi-shim 升级 v0.4，lib.func 参数透传保留原型串调用形式
· 修复 glob 全量通配超时/中止：默认排除 node_modules 遍历，实测大工程提速 20 倍以上（此前 `**/*.md` 需 20s~50s，触发 30s 超时）
· 修复 pwsh / 受限沙箱启动即崩：grantWrite 报错增强，明确提示工作区目录归属问题与修复命令（icacls /setowner /T /C）
· 修复检查点/工作区级回滚从未生效：sessionIdentity 改读 session.header.cwd（此前恒为 null，检查点从未创建）
· 修复回滚页面消息列表加载：离线/历史会话 zstd 磁盘直读兜底，「回滚到第 N 条之前」选项恢复可用
· 修复回滚目标下拉框点开空白：原生 select 改为按钮 + 内联菜单，消息预加载、加载失败可点重试
· 新增已归档会话恢复：工作区侧边栏「归档会话」的会话在回滚页面显示「已归档」标识，支持单个 / 全部恢复（workspaceRegistry.unarchiveSession）
· 新增回收站「全部恢复」：一键恢复所有归档会话（删除进回收站的会话，恢复后回到回滚页面与会话列表）
· 优化回滚页面 UI：相对时间（刚刚/N 分钟前/昨天）、保护检查点徽章、统计信息、卡片信息分层
· 归档 node_modules 修复补丁（patches/01-03）并整理 .gitignore、清理调试残留与冗余备份
· 修复检查点预览卡死且无预览效果：git 快照预览改为一条 `git diff` 直出真实变更（此前逐文件 cat-file + 哈希，大工作区实测 30~46 秒 → 现在 <1 秒），预览面板内联显示在被预览检查点下方并带消息摘要/会话/时间上下文
· 修复对话输入框卡死/无法输入、发送延迟：检查点引擎全部异步分片（遍历/哈希让出事件循环），git 操作全部改异步 execFile（此前同步 spawnSync 每次建检查点都会阻塞 harness 事件循环数秒）
· 修复检查点页按钮常驻「刷新中」：loading 状态正确清除；IPC 增加 30 秒超时保护（异常时明确报错而非无限转圈）
· 预览区分「该消息修改的文件」：解析会话同轮工具调用标注「← 该消息修改」；消息未修改任何文件时隐藏「确认回滚」按钮并折叠展示无关差异
· 修复快照创建/恢复遇到「文件 + 同名文件夹」异常叠加态的容错：父路径为文件时先移除再建目录，恢复不再中断
· 代码清理：移除死代码（同步 walkWorkspace/currentManifest/spawnSync）并去重 zstd 会话读取器（净删约 100 行）
· 修复更新检测对 4 段版本号（如 0.1.4.2）识别失败的问题：compareSemver 支持任意 4 段版本与预发布后缀比较
· 版本号统一为 0.1.4.3（tag、包体、更新日志、发布说明一致）

v0.1.4
2026-08-22
· 插件更新检测多来源支持：github: / git+ssh / git+https / tar.gz 归档全部可检测（此前 github: 源误判为 npm 查询失败）；GitHub 改用 Atom feed 检测，不再受 API 限流 403 影响
· 插件更新按钮修复：preload 补齐 pluginUpdateCheck 桥接，检测结果正常推送前端（此前按钮永不显示）；git 源检测 6 秒快速超时、检查中自动重试、首次检查提前至启动 5 秒
· 新增「全部更新」按钮：可更新卡片上一键串行更新全部插件（单个更新仍在已安装页）
· 更新失败回滚优化：更新插件失败时恢复更新前的原版本（此前直接卸载整个插件）；新装失败仍为卸载清理
· 插件市场已安装识别修复：GitHub 标签与 npm 包名大小写/前缀差异（Anionex/dsh-vision-toolkit ↔ @anionex/dsh-vision-toolkit）归一化匹配，已安装正确显示「已安装」
· 禁用管理优化：恢复仅撤销禁用状态、不再自动重新下载；市场被禁用插件显示「已禁用」，恢复统一在「禁用」页
· 已安装页依赖名可点击：GitHub 源跳仓库、npm 源跳 npmjs 包页
· 移除「软件更新」页冗余的视觉 API 密钥入口——视觉工具自带设置页完整配置（API 地址/模型/密钥保存）
· 打包/部署一致性：打包流程固化 no-console 补丁（黑窗口修复 + 启动自愈），源码打包→安装→启动与部署版逐字节一致
· harness 内核与依赖对齐 0.1.1-rc.2（package.json/锁文件/node_modules 与部署版一致）；清理旧版残留（lib.rc6/嵌套目录）与冗余备份目录
· 版本号统一为 0.1.4（内置 asar 与 exe 元数据同步）
· 内核更新（0.1.1-rc.1）：DeepSeek 适配器新增多模态视觉模型 DeepSeek-V4-Flash-Vision-Exp；修复输入框 @ 引用前编辑的布局问题、Bubblewrap 沙箱受限进程可经 /proc/<pid>/root 绕过限制的漏洞；优化会话 Markdown 表格自适应、99.x% 缓存命中率精度显示、子代理会话标题切换；ask_user_question 支持多行输入与 Shift+Enter 换行
· 内核更新（0.1.1-rc.2）：DeepSeek 适配器优先通过 Files API 上传图像并可复用已上传文件；图像预处理按模型要求自动缩放并转换格式

v0.1.3.1
2026-08-21
· 新增：插件禁用名单——插件市场可禁用插件（安装按钮变「恢复」，避免误装），「禁用」页统一管理；卸载的默认插件不再强制装回（自由卸载）
· 优化：归档管理拆分「检查点」独立页（回滚 | 检查点 | 回收站），列表与按钮布局不再换行错位
· 修复：安装/卸载插件时弹出终端框——pnpm 子进程窗口隐藏
· 修复：回收站/回滚/检查点操作结果消息永久残留——8 秒后自动消失
· 修复：归档时间显示为 UTC 原始格式——改为本地时间显示
· 优化：启动自动清理的空会话直接删除，不再移入回收站堆积垃圾记录
· 修复：检查点列表无感刷新——刷新不闪屏、操作结果消息不再丢失

v0.1.3
2026-08-20
· 内核升级 0.1.0-rc.8：增强多模态支持（DeepSeek 原生图片请求、/goal、/plan 图文输入、@ 菜单引用文件和会话）；Claude Code 与 Codex 子代理可按需安装为 Profile Bundle（Codex 支持非交互权限模式与多命名实例）；Windows PTY 支持持久 PowerShell 会话；修复图片载荷过大导致模型请求失败、取消流式生成后回复前缀丢失、OpenAI 兼容网关调用失败；优化 web_search 并发、子代理报告及时唤醒、SQLite 读写与分叉性能（存储格式不兼容）
· 修复：系统托盘图标四角黑边——新增二值化透明通道托盘图标（16x16/32x32 @2x），去除半透明像素避免 HICON 转换黑化，托盘创建不再二次缩放，按 DPI 自动选高分辨率表示
· 修复：最小化通知气泡图标模糊——改用 32x32 高清图标
· 修复：dsh-desktop-settings 升级后 client bundle 缺失导致启动失败，恢复 client.js 并补齐会话记录时间戳（updatedAt/prevJob）自动收起逻辑
· 修复：skill-filesystem 内核升级后 chokidar 依赖缺失，补装 chokidar@5.0.0
· 修复：内核升级后偶发「Failed to load plugins / bundle script failed to load」（升级期历史故障，已验证全部 client bundle 加载正常）
· 修复：窗口加载环境时最大化后灰色未响应/假死——内核重启换端口后窗口停留在旧地址，主进程自动重连（10 秒防抖），无需手动重启
· 修复：安装失败的默认插件每次启动重复安装拖慢启动——失败后记录标记不再重试，安装任务延迟到启动完成之后执行
· 优化：插件安装日志自动收起窗口由 5 分钟缩短至 60 秒，「链接/命令安装」与「已安装」页日志新增「清除日志」按钮
· 优化：默认插件改为离线预打包（preloaded-plugins），全新环境安装免联网、大幅缩短首次启动时间

v0.1.2
2026-08-19
· 插件一键更新：已安装插件有新版时按钮变为「更新」，点击直接升级（git 源自动拉最新），失败自动 AI 修复或回滚
· 内置默认插件自动安装：新装环境开箱即用，插件配置与开发环境一致（已装则跳过，升级不受影响）
· MCP 自动检测（类似 Claude Code / opencode）：启动时从 ~/.claude.json 与 opencode 配置同步 MCP 服务器，手动配置保留，变化热重载生效
· 「链接 / 命令安装」入口移至插件市场顶部
· 插件配置模板与发布环境对齐，新装用户与开发环境插件列表一致
· 修复：git 黑框（dsh-better-sidebar）；MCP 绝对路径命令误报「命令未找到」

v0.1.1
2026-08-18
· 内核升级 0.1.0-rc.7：LLM 重试机制重构、前端 UI 组件大量更新，全部本地补丁重新应用并验证
· AI 安装：常规安装失败自动接手诊断修复（参数真实生效），插件不兼容直接回滚明确提示，失败自动清理残留
· 插件任务悬浮面板：右下角实时显示安装/卸载/AI 诊断进度、加载动画、可滚动日志，完成 30 秒收起可手动关闭
· 插件安装/卸载完成播放成功/失败提示音
· 归档管理新增「删除」按钮（删除进回收站可恢复），回滚/回收站列表 20 秒自动刷新
· 设置分区专属图标（插件与MCP/归档管理/更新/视觉工具/Token用量）
· 检查更新显示内置版本与内核版本；官方尚未发布安装包时提示"官方尚未发布"，不再误报查询失败
· 插件热更新：安装/卸载后自动软刷新生效，无需重启应用
· 启动提速：Harness 服务驻留复用 + V8 编译缓存，热启动秒开、冷启动不再重复编译 500MB 依赖
· 终端命令提速约 70 倍：修复提示符协议不匹配导致每次命令多等 3.5 秒超时
· 修复每次启动误判异常退出而全量扫描会话的问题，正常退出后启动跳过全量校验
· 修复安装/加载插件、源代码管理 git、LSP 启动时弹出终端黑框
· 修复主进程 IPC 处理器重复注册导致启动报错
· 插件安装/卸载完成或失败时 toast 事件推送即时提示（不依赖轮询）
· 安装成功自动验证插件能否加载，不兼容插件自动回滚并明确提示
· 视觉 API 密钥快速输入：更新分区新增入口，粘贴即保存到 ~/.dsh/.credentials.yaml
· 插件定期更新检查：自动检测已装插件（npm / GitHub / 归档）是否有新版本并提示
· 安装/卸载插件提示弹框改为右上角固定并优化视觉样式
· 设置页新增功能跟随中英文语言切换

v0.1.0
2026-08-16
· 对话与文件联动回滚：检查点/预览/确认/撤销、/rewind 命令、双击 Esc 入口、消息旁无感回滚并回填输入框
· LLM 请求失败时支持手动立即重试
· 插件安装/卸载：关闭设置页不中断、失败自动重试、已安装列表与插件市场无感刷新、GitHub 插件自动登记 bundle
· 会话列表后台异步加载 + 内存缓存，设置页切换不再卡顿
· 正常启动跳过全量会话校验、探测异步化，加快启动
· 设置页跟随中英文语言切换
· 黑白灰主题下明确的选中/启用状态
· F11 全屏保留全部操作入口
· 删除会话无感刷新，移入回收站可找回
· 会话列表持久化缓存：启动/刷新不再全量解压，未变化的会话毫秒级加载
· 回滚/删除/插件卸载全程异步清场，主进程不再被 PowerShell 卡死
· 设置页"回滚"按钮改为无感热回滚，不杀正在运行的会话
