# DeepSeek Harness Desktop 0.1.8

English | [中文](https://github.com/LTJ002/DeepSeek-Harness-Desktop/blob/main/docs/RELEASE-0.1.8.zh.md)

---

## What's New in 0.1.8

### Plugin Install Reliability

- **Static import precheck** — a freshly installed plugin is now imported in an isolated sandbox (junctioned `node_modules`) *before* the kernel is restarted for post-install verification. A plugin that imports an export the kernel no longer provides (e.g. `installSettingsSection` from `@deepseek-ai/dsh-settings` — a common breakage after kernel upgrades) is rolled back immediately, so the kernel never crashes and **the session stays available throughout the installation** (previously the kernel crash-looped while loading such a plugin, leaving the app unusable until the automatic rollback finished)
- **Post-install verification hardened** — the soft verification (restart the kernel, then inspect the page) used to treat a Chromium error page ("This site can't be reached") as success: the crash produced no plugin-failure markers in the page text, so the plugin was reported as installed successfully and was only rolled back on the next cold start. Verification now also matches Chromium error-page text, probes the local service API for liveness, and requires a 3-second stability window — a kernel that dies seconds after boot can no longer slip through
- **Auto-rollback is now visible** — when startup fails because of a recently installed/updated plugin, the automatic rollback is registered as a visible task; the task panel and the corner toast now report it (with the plugin name and the rollback action) instead of silently removing the plugin

### Kernel

- Kernel upgraded to **0.1.5-rc.2** (official npm): feedback submission (like / dislike) is confirmed in a dialog before being recorded and keeps the entered text if submission fails; delivered-file card layout, conversation spacing, and code-file icons refined
- The `DeepSeek-V41-Flash` → `DeepSeek-V4.1-Flash` name fix has been re-applied after the rc.2 kernel upgrade (the upstream typo comes back with each official kernel package)

### Web Profile

- All 200 `@deepseek-ai/*` profile dependencies upgraded to **0.1.5-rc.2** in lockstep with the kernel (no more mixed rc.1 / rc.2 runtime)

### Build

- Built-in version **0.1.8** — `app.asar` and the `exe` version metadata are in sync
