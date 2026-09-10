# DeepSeek Harness Desktop 0.1.7

English | [中文](https://github.com/LTJ002/DeepSeek-Harness-Desktop/blob/main/docs/RELEASE-0.1.7.zh.md)

---

## What's New in 0.1.7

### Startup Reliability

- **Orphan kernel detection & removal** — a kernel filter bug (`bin.js` + `--profile web` never matched on packaged installs) made the app miss leftover kernels from a previous hard kill, then reuse them and load a stale `node_modules` bundle snapshot (`rev` hash frozen across restarts, "Failed to load plugins"). The filter is fixed and orphan candidates (parent PID no longer alive) are killed instead of reused
- **White-screen root cause fixed** — every service restart issued a new `dsh-auth-*` cookie and browsers kept them all (70 accumulated over a month); the window sent them all, the auth layer failed, and the server returned an empty `text/plain` page. Historical auth cookies are now pruned to the latest one on every connect
- **Window URL cache-busting** — each window load appends a timestamp parameter, so a stale cached HTML snapshot (referencing an old bundle `rev`) can no longer be served
- **MCP runtime path auto-correction** — stdio MCP `command` entries pointing at an old install path (`...\resources\runtime\node.exe`) are automatically corrected to the current install on startup (survives moving or reinstalling the app)

### Kernel

- Kernel upgraded to **0.1.5-rc.1** (official npm): session-log v3 format support (rollback / delete / repair now operate on the live file, recovering 3 previously invisible sessions), MCP client updates, and adapter fixes
- **Model name fix**: `DeepSeek-V41-Flash` → `DeepSeek-V4.1-Flash` (upstream text typo, corrected in both the runtime kernel and the release package)

### Plugin Install / Update

- **Bundle conflict precheck** — before a bundle plugin is enabled, its `cordis.patch.yml` entry ids are checked against the existing bundle tree; conflicts (e.g. duplicate `code-runtime`) are rejected with an explanation instead of crashing startup with `duplicate loader entry id`
- **Startup self-heal** — the active bundle list is scanned on every start; conflicting entries are removed automatically, so a config already written bad recovers on its own
- **Uninstall leaves nothing behind** — uninstalling now also removes the plugin's offline preload copy (previously it was silently copied back into the profile by the offline-preload path on the next start — the reason uninstalled plugins kept coming back) and prunes now-empty scope directories
- **Registry auto-fallback** — when the official npm registry fails with network-class errors (timeout / reset / DNS / certificate), the install retries once against the npmmirror mirror automatically (previously update checks used the mirror while installs used the official registry, so "update available" could fail to install on slow networks)
- **Startup-failure auto-rollback** — every successful install/update is snapshotted; if the app then fails to cold-start within 30 minutes (incompatibility that the post-install soft verification missed), the change is rolled back automatically (update → previous version, new install → uninstall) and startup is retried once
- No plugins are pre-bundled in the installer (`preloaded-plugins` is empty); default-plugin auto-install list is cleared, so nothing is silently installed or reinstalled

### Recovery & Diagnostics

- **AI diagnosis improvements** — previously tried fixes (action / env / command) are now passed to the model so the 3 rounds don't repeat the same ineffective suggestion; dangerous environment variables (`NODE_OPTIONS`, `NODE_PATH`, `PATH`, `LD_PRELOAD`, …) suggested by the model are rejected (prompt-injection defense)
- **Redundant bundle-conflict scanners merged** into a single `findBundleConflicts` core (install precheck / update precheck / startup self-heal share it); full declaration-reference audit reports zero dead code

### Archive & Rollback

- **Rollback archive UI** — files moved out during a rollback (newly created files, stored in `~/.dsh/rollback-trash` with directory structure and metadata) can now be listed and restored to their original location from the Recycle Bin page (cross-volume copy fallback included)
- File moves during rollback are no longer silent on failure: cross-volume moves fall back to copy + delete, failed moves are reported in the result, and same-batch already-archived files are never deleted by cleanup
- Checkpoint / rollback sections fully localized in English mode

### Plugins & MCP

- **In-app MCP server management** — add / **edit** / delete MCP servers directly in Settings → Plugins & MCP (no more hand-editing `cordis.patch.yml` or depending on Claude Code / opencode configs being present): stdio (command + args) and streamable-http (URL + **Headers**) supported, with **hot reload** so changes take effect immediately
- **"Everything becomes a system plugin" fixed** — only real kernel components (`@deepseek-ai/*`, a few bare core deps, the settings plugin itself) are badged "System"; user-installed bundle plugins (e.g. `toto-the-cat`) keep their uninstall entry
- System components in "Installed plugins" are **collapsed by default** (click to expand) — the ~200 kernel dependency rows no longer bury your own plugins

### Misc

- **Completion sound restored** — plugin install / update / uninstall completion chime works again (Chromium autoplay policy is now lifted via `autoplay-policy=no-user-gesture-required`, plus an AudioContext resume fallback, since the completion chime plays right after a window reload)
- **English localization completed** — every `t()` key now has an English entry (previously several fell back to Chinese); bare Chinese strings in the checkpoint, rollback, archive, plugin-market and MCP UI were wrapped and translated
- Version display clarified: desktop 0.1.7 / kernel 0.1.5-rc.1 (each numbered independently)

## Downloads

- `DeepSeek.Harness.Setup.0.1.7.0.exe` — Installer (choose install directory, Start Menu / desktop shortcuts, silent Defender exclusion)
- `DeepSeek.Harness.0.1.7.0.Portable.exe` — Portable (extracts to `app\` beside the exe, auto re-extracts on version mismatch)

Upgrading from 0.1.6: install over the existing copy. Config and sessions live in `~/.dsh` and are untouched.
