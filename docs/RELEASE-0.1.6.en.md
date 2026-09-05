English | [中文](https://github.com/LTJ002/DeepSeek-Harness-Desktop/blob/main/docs/RELEASE-0.1.6.zh.md)

---
## What's New in 0.1.6

### Kernel

- **Kernel upgraded to 0.1.2-rc.1** (official npm): adapted to the trimmed dependency structure (46 packages removed); new features include collapsed streaming output, token usage & duration display, full-text turn navigation, subagent model selection, ACP standard capabilities, experimental Inspector & Web Preview, and bidirectional send_message
- Web profile dependency tree rewritten (peer deps restored); fixed koffi hoisting, pnpm store version mismatch, and duplicate loader caused by stray CLI/SDK bundles
- Plugin install strategy: git sources now resolve the latest release tag (avoids stale default-branch code), automatic fallback sources on load-verification failure, automatic allowBuilds authorization for git build scripts
- Uninstall improvements: app process terminated before uninstall, robocopy empty-dir mirroring for recursive removal (supports long .pnpm paths), no resources leftovers

### Archive & Rollback (major fixes)

- **Unarchive fixed** — dsh-workspace was missing unarchiveSession, so "Restore" always failed with "workspace service unavailable"; now implemented with idempotent restore
- **Hot-rollback URL fix** — serverUrl carries a `?token=` query that broke path concatenation, so hot-rollback requests never reached plugin routes; **hot rollback now actually works for the first time since launch**
- Hot-rollback reliability: timeout 4s→15s, one automatic retry, new READONLY branch (dispose session, then disk rollback) — large sessions no longer fall back to a full service restart
- Rollback page performance: user-message extraction is now async frame-by-frame (130 messages: 7.9s→200ms) with mtime-based caching, no longer starving the kernel event loop
- Rollback result notices survive page reloads; rollback list split into Archived / Active groups synced with the workspace (20s polling); dropdown restyled (monospace indices, 40-char preview, full text on hover)
- System-injected messages (runtime snapshots / subagent messages / system-reminders) now show as "(system-injected message)" instead of raw internal text

### Checkpoints (conversation ↔ file rollback)

- Adapted to rc.1 session format (file arguments moved to tool/call events): fixed preview always showing "this message modified no files"; when the message was truncated by an earlier rollback, degrades to whole-workspace restore from the checkpoint
- **Large-workspace snapshot fix**: git snapshots now exclude build caches (.m2-repo / .gradle), timeout 30s→120s, autocrlf disabled (kills the CRLF warning flood), condensed error output — fixes checkpoint-creation timeouts that **blocked all AI tool calls** in large Java/Maven projects; those directories are preserved untouched on restore
- Preview now matches restore exactly: untracked new files appear in the preview (previously invisible but silently deleted); gitignored files (.env, build artifacts) are preserved on rollback
- ACTIVE_TURN guard: checkpoint rollback is refused while any session is still generating (consistent with message rollback) instead of silently killing the in-flight reply
- Guard checkpoints get their own preview semantics: "restoring it undoes that rollback's file changes; conversation untouched"

### Plugins & Safety

- **Uninstall guard**: kernel dependencies and bundle layers in "Installed plugins" are badged "System" and cannot be uninstalled (accidental removal would break startup); default plugins are unaffected
- **Uninstall cleanup**: MCP server entries in cordis.patch.yml referencing the removed package are now removed together — no more zombie configs
- Plugin update verification: pnpm's occasional "added 0" false success (version unchanged) is now reported honestly as "update not applied" with the reason
- Market "Disable" on uninstalled items renamed to "Block" (distinct from default-plugin disabling); misleading buttons removed

### Misc

- Kernel process tree force-terminated on quit (taskkill /T /F) — no more orphan node processes after exit
- Pack/deploy consistency: source → package → install → run is byte-identical to the deployed build (no-console patch baked into the pack pipeline)
- Copy & layout fixes: trash description, MCP status wording, rollback counters

## Downloads

- `DeepSeek.Harness.Setup.0.1.6.0.exe` — Installer (choose install directory, Start Menu / desktop shortcuts, silent Defender exclusion)
- `DeepSeek.Harness.0.1.6.0.Portable.exe` — Portable (extracts to `app\` beside the exe, auto re-extracts on version mismatch)

Upgrading from 0.1.5: install over the existing copy. Config and sessions live in `~/.dsh` and are untouched.
