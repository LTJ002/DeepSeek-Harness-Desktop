# DeepSeek Harness Desktop 0.1.8.1

English | [中文](https://github.com/LTJ002/DeepSeek-Harness-Desktop/blob/main/docs/RELEASE-0.1.8.1.zh.md)

---

## What's New in 0.1.8.1

Plugin-install safety release. The kernel stays on **0.1.5-rc.2** — this update hardens the desktop shell's plugin install / update pipeline.

### Plugin Install Safety

- **Static import precheck** — a freshly installed plugin is imported in an isolated sandbox *before* the kernel is restarted for verification. Plugins importing an export the kernel no longer provides (e.g. `installSettingsSection` from `@deepseek-ai/dsh-settings` — a common breakage after kernel upgrades) are rolled back immediately: **the kernel never crashes and the session stays available throughout the installation** (previously the kernel crash-looped while loading such a plugin)
- **Post-install verification hardened** — the soft verification used to treat a Chromium error page ("This site can't be reached") as success, so an incompatible plugin could be reported as installed and only rolled back on the next cold start. Verification now recognizes error-page text, probes the local service API, and requires a 3-second stability window
- **Auto-rollback is now visible** — when startup fails because of a recently installed/updated plugin, the automatic rollback is reported in the task panel and toast (with plugin name and rollback action) instead of silently removing the plugin

### Plugin Update Defenses

- **Built-in plugin protection** — built-in desktop plugins (including the settings plugin that provides the Plugin Market / MCP / Archive / Update sections) are never removed by rollback or cleanup. Fixes a case where a failed `cordis` update rolled back into **uninstalling the package entirely** and pulled the settings plugin out of the bundle list, making those settings sections disappear
- **Settings plugin self-wipe defense** — the settings-plugin repair routine no longer risks emptying its own source directory when the profile uses a `link:` dependency (same-source detection + symlink-aware deletion + non-empty source check)
- **Bundle sanity-check protection** — the startup bundle-conflict heal step now only removes user-side entries; built-in entries are never auto-removed

### Update Mis-click Guards

- **Cross-prerelease-line updates are no longer reported** — with the stable line installed (e.g. `0.1.5-rc.2`), alpha-line versions such as `0.1.6-alpha.2` are no longer shown as "update available" (mixing rc/alpha components in one kernel is a known way to break startup)
- **Update entry interception** — even if an update is triggered, targets that cross prerelease lines or downgrade the package are refused (explicitly pinned versions are still honored)

### Fixes

- AI-diagnosis rollback now carries the pre-install version (previously it could "restore" the version that had just been installed)
- Local `file:` dependencies (compat shims) are no longer misreported as updatable — clicking update would have overwritten local fixes
- `DeepSeek-V41-Flash` → `DeepSeek-V4.1-Flash` name fix re-applied after the rc.2 kernel upgrade

### Build

- Built-in version **0.1.8.1** — `app.asar` and the `exe` version metadata are in sync
