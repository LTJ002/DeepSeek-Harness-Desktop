# DeepSeek Harness Desktop 0.1.8.2

English | [中文](https://github.com/LTJ002/DeepSeek-Harness-Desktop/blob/main/docs/RELEASE-0.1.8.2.zh.md)

---

## What's New in 0.1.8.2

Plugin-update safety and settings-icon release. The kernel stays on **0.1.5-rc.2**.

### Kernel Components Are No Longer Updated as Plugins

- `@deepseek-ai/*` official-scope packages (the kernel components) are **excluded from the update check** — they are shown as "kernel component (upgraded with the kernel, not individually)" instead of an available update, and the update entry refuses them even if triggered manually. Kernel components are part of the kernel and must be upgraded together (installing them individually mixes rc/alpha versions and breaks the kernel — the root cause of repeated failures when "Update All" touched packages like `cordis`)
- User-installed third-party plugins (e.g. `@scope/dsh-xxx`, `dsh-xxx`) are unaffected and still update normally

### Settings Section Icons Fixed

- The section icons for **Plugin Market / Archive / Update / File Mention** are now drawn as **inline SVG** — no longer depending on icon components from the kernel UI package. After a kernel upgrade removed those components the patch was skipped and the icons fell back to a plain gear; the inline version is self-contained and survives kernel updates
- The icon patch is now injected into **both the profile and harness copies** of `dsh-client-ui-settings-general` (previously only the harness copy was patched while the frontend actually loads the profile copy — the patch reported success but the UI still showed gears)
- Patch writes now break the hard link first (temp file → delete → rename) so the pnpm store is never modified

### Deployment-Directory Sentinel Fixed

- When `resources/plugins/dsh-desktop-settings` is emptied, it is restored from the copy inside `app.asar` — now using `readFile`/`readdir` recursion (`fs.cpSync` cannot read asar paths, which made the previous sentinel fail with ENOENT)
- The `dsh-desktop-settings` bundle entry is re-asserted independently of the link check, so a missing bundle entry is repaired even when the link is already correct

### AI Diagnosis Improvements

- Repository README is fetched via the **GitHub API first** (far more reachable than the raw domain), with a fallback across branches and file names
- The repo description and `package.json` name are supplied as extra clues
- README install commands (`npm i x`, `pnpm add x`, …) are recognized and the package name is extracted
- Repositories recommended by the README (other than the one being installed) are now allowed

### Fixes

- AI-diagnosis cleanup no longer removes a pre-existing dependency during an update (previously it deleted the just-restored `cordis` after a failed update rollback)
- Same-source detection in the settings-plugin repair is now case-insensitive (Windows `realpath` drive-letter casing made the guard ineffective)

### Build

- Built-in version **0.1.8.2** — `app.asar` and the `exe` version metadata are in sync
