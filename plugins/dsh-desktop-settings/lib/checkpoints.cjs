// dsh-desktop-settings / DeepSeek Harness — 对话与文件联动回滚：核心引擎（CJS，宿主/Electron 双端共用）
// 阶段0调研结论（详见 docs/REWIND-RESEARCH.md）：
//   - DSH 0.1.0-rc.6 基于 Cordis（@deepseek-ai/cordis），插件通过 apply(ctx)/ctx.on 注册。
//   - 可用钩子：`session/event`（所有持久化事件）、`tools/execute`（任意工具执行前，可 prepend 阻塞）、
//     `fs/write-intent` / `fs/edit-intent`（文件写/改意图 waterfall）、`agent/pre-step`。
//   - 工具链路：write 走 ctx.waterfall("fs/write-intent")；edit/str_replace 走 "fs/edit-intent"；
//     bash/pwsh 等 shell 不经过 fs 事件，因此用 tools/execute 做“首个工具执行前建检查点”。
//   - 对话存储：session.jsonl.zstd（帧=zstd(JSONL)），header 含 id/cwd；用户消息为 agent/inbox/spliced，
//     user/message 的 data.id 为消息 ID。桌面端已有按 messageId 截断会话的实现。
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync, execFile } = require('child_process');

const EXCLUDED_DIRS = new Set(['.git', 'node_modules', '.dsh']);
const META_FILE = 'index.json';
const REGULAR_KEEP = 50;
const GUARD_KEEP = 10;
const MAX_DIFF_BYTES = 512 * 1024; // diff 全文/行统计上限
const LCS_LINES_MAX = 2000;        // 行级 LCS 上限（行数乘积超过则只给大小统计）
const LOCK_RETRIES = 50;
const LOCK_RETRY_MS = 100;

class RewindError extends Error {
  constructor(message, code = 'REWIND') {
    super(message);
    this.code = code;
  }
}

function dshHomeOf(env = process.env) {
  return env.DSH_HOME || path.join(os.homedir(), '.dsh');
}
function workspaceRoot(cwd) {
  if (typeof cwd !== 'string' || cwd.trim() === '') throw new RewindError('缺少工作区路径（cwd）');
  return path.resolve(cwd);
}
function relOf(root, abs) {
  return path.relative(workspaceRoot(root), abs).split(path.sep).join('/');
}
/** 路径安全：绝对化 + 前缀校验 + 真实路径（符号链接）校验。 */
function assertInside(root, relOrAbs) {
  const rootAbs = workspaceRoot(root);
  const abs = path.isAbsolute(relOrAbs) ? path.resolve(relOrAbs) : path.resolve(rootAbs, relOrAbs);
  if (abs !== rootAbs && !abs.startsWith(rootAbs + path.sep)) {
    throw new RewindError(`路径越界: ${relOrAbs}`, 'REWIND_PATH');
  }
  try {
    const realRoot = fs.realpathSync(rootAbs);
    const realAbs = fs.realpathSync(abs);
    if (realAbs !== realRoot && !realAbs.startsWith(realRoot + path.sep)) {
      throw new RewindError(`符号链接指向工作区外: ${relOrAbs}`, 'REWIND_PATH');
    }
  } catch (error) {
    if (error instanceof RewindError) throw error;
    if (error.code !== 'ENOENT') throw error; // 目标尚不存在：前缀校验已足够
  }
  return abs;
}
function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}
function sha256File(file) {
  return sha256(fs.readFileSync(file));
}
function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}
function atomicWrite(file, text) {
  const tmp = `${file}.tmp-${process.pid}-${Date.now()}`;
  fs.writeFileSync(tmp, text, 'utf8');
  fs.renameSync(tmp, file);
}
function withLockSync(root, fn) {
  const lock = path.join(root, `${META_FILE}.lock`);
  for (let attempt = 0; attempt < LOCK_RETRIES; attempt++) {
    try {
      const fd = fs.openSync(lock, 'wx');
      try {
        return fn();
      } finally {
        fs.closeSync(fd);
        try { fs.unlinkSync(lock); } catch {}
      }
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      const end = Date.now() + LOCK_RETRY_MS;
      while (Date.now() < end) { /* 短窗口自旋等待锁释放 */ }
    }
  }
  throw new RewindError('检查点元数据锁超时（另一进程正在写入）', 'REWIND_LOCK');
}
function walkWorkspace(root, excludeAbs) {
  const out = [];
  const rootAbs = workspaceRoot(root);
  const walk = (dir) => {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (EXCLUDED_DIRS.has(entry.name)) continue;
        if (excludeAbs && abs === excludeAbs) continue;
        walk(abs);
      } else if (entry.isFile() || entry.isSymbolicLink()) {
        out.push(abs);
      }
    }
  };
  walk(rootAbs);
  return out.sort();
}
/** 让出事件循环一帧：避免大工作区遍历/哈希同步阻塞调用方进程（主进程/宿主管道）。 */
function yieldLoop() {
  return new Promise((resolve) => setImmediate(resolve));
}
// ---------- 会话日志读取（zstd 多帧，供预览标注“该消息修改的文件”） ----------
const ZSTD_MAGIC = 4247762216;
function scanZstdFrames(buf) {
  const frames = [];
  let offset = 0;
  while (offset < buf.length) {
    const start = offset;
    if (buf.length - offset < 4) break;
    if (buf.readUInt32LE(offset) !== ZSTD_MAGIC) throw new Error(`invalid frame magic at ${offset}`);
    offset += 4;
    if (buf.length - offset < 1) break;
    const descriptor = buf.readUInt8(offset++);
    const contentSizeFlag = descriptor >>> 6;
    const singleSegment = (descriptor & 32) !== 0;
    const checksum = (descriptor & 4) !== 0;
    const dictionaryFlag = descriptor & 3;
    const dictionaryBytes = dictionaryFlag === 3 ? 4 : dictionaryFlag;
    const contentSizeBytes = contentSizeFlag === 0 ? (singleSegment ? 1 : 0) : (1 << contentSizeFlag);
    const headerBytes = (singleSegment ? 0 : 1) + dictionaryBytes + contentSizeBytes;
    if (buf.length - offset < headerBytes) break;
    offset += headerBytes;
    let complete = true;
    for (;;) {
      if (buf.length - offset < 3) { complete = false; break; }
      const blockHeader = buf.readUIntLE(offset, 3);
      offset += 3;
      const lastBlock = (blockHeader & 1) !== 0;
      const blockType = (blockHeader >>> 1) & 3;
      const blockSize = blockHeader >>> 3;
      if (blockType === 3) throw new Error("reserved block type");
      const payloadBytes = blockType === 1 ? 1 : blockSize;
      if (buf.length - offset < payloadBytes) { complete = false; break; }
      offset += payloadBytes;
      if (lastBlock) break;
    }
    if (!complete) break;
    if (checksum) {
      if (buf.length - offset < 4) break;
      offset += 4;
    }
    frames.push({ start, end: offset });
  }
  return frames;
}
function readSessionLog(file) {
  const zlib = require('zlib');
  const buf = fs.readFileSync(file);
  const text = Buffer.concat(scanZstdFrames(buf).map((f) => zlib.zstdDecompressSync(buf.subarray(f.start, f.end)))).toString('utf8');
  return text.split('\n').filter((l) => l.trim()).map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter((e) => e !== null);
}
async function walkWorkspaceAsync(root, excludeAbs) {
  const out = [];
  const rootAbs = workspaceRoot(root);
  const walk = async (dir) => {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (EXCLUDED_DIRS.has(entry.name)) continue;
        if (excludeAbs && abs === excludeAbs) continue;
        await walk(abs);
      } else if (entry.isFile() || entry.isSymbolicLink()) {
        out.push(abs);
      }
      if ((out.length & 255) === 0) await yieldLoop();
    }
  };
  await walk(rootAbs);
  return out.sort();
}
function entryOf(root, abs) {
  const rel = relOf(root, abs);
  let st;
  try { st = fs.lstatSync(abs); } catch { return null; }
  if (st.isSymbolicLink()) {
    return { rel, type: 'symlink', size: 0, mtimeMs: 0, hash: '', symlink: fs.readlinkSync(abs) };
  }
  if (!st.isFile()) return null;
  return { rel, type: 'file', size: st.size, mtimeMs: Math.floor(st.mtimeMs), hash: '' };
}
function currentManifest(root, useGitManifest, excludeAbs) {
  const files = useGitManifest ? currentGitFiles(root) : walkWorkspace(root, excludeAbs);
  const manifest = { root: workspaceRoot(root), files: [] };
  for (const abs of files) {
    const entry = entryOf(root, abs);
    if (entry) manifest.files.push(entry);
  }
  manifest.files.sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));
  return manifest;
}
async function currentManifestAsync(root, useGitManifest, excludeAbs) {
  const files = useGitManifest ? await currentGitFiles(root) : await walkWorkspaceAsync(root, excludeAbs);
  const manifest = { root: workspaceRoot(root), files: [] };
  for (const abs of files) {
    const entry = entryOf(root, abs);
    if (entry) manifest.files.push(entry);
    if ((manifest.files.length & 255) === 0) await yieldLoop();
  }
  manifest.files.sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));
  return manifest;
}
function runGit(root, args, extraEnv) {
  // 异步 git（execFile）：不在事件循环里同步阻塞——大仓库 add/commit 在 harness/主进程里
  // 同步执行会卡死对话输入与发送（此前 spawnSync）。
  return new Promise((resolve, reject) => {
    execFile('git', args, {
      cwd: workspaceRoot(root), encoding: 'utf8', windowsHide: true,
      maxBuffer: 128 * 1024 * 1024,
      timeout: 30000,
      env: extraEnv ? { ...process.env, ...extraEnv } : process.env
    }, (error, stdout, stderr) => {
      if (error) {
        if (error.code === 'ENOENT') {
          reject(new RewindError(`git 执行失败: ${error.message}`, 'GIT_EXEC'));
          return;
        }
        // 非零退出：execFile 的 error.code 即退出码
        resolve({ status: typeof error.code === 'number' ? error.code : 1, stdout: stdout || '', stderr: stderr || '', error });
      } else {
        resolve({ status: 0, stdout: stdout || '', stderr: stderr || '', error: null });
      }
    });
  });
}
async function gitAvailable(root) {
  try {
    const res = await runGit(root, ['rev-parse', '--is-inside-work-tree']);
    return res.status === 0 && String(res.stdout).trim() === 'true';
  } catch { return false; }
}
async function currentGitFiles(root) {
  const out = [];
  const tracked = await runGit(root, ['ls-files', '-z']);
  const others = await runGit(root, ['ls-files', '--others', '--exclude-standard', '-z']);
  for (const text of [tracked, others]) {
    if (text.status !== 0) continue;
    for (const rel of String(text.stdout || '').split('\0')) {
      if (!rel) continue;
      out.push(path.join(workspaceRoot(root), rel));
    }
  }
  return out.sort();
}

// ---------------- 快照提供者 ----------------
class CopySnapshotProvider {
  name = 'copy';
  constructor(storeRootDir) { this.engineRoot = storeRootDir; this.storeDir = path.join(storeRootDir, 'snapshots'); }
  snapshotDir(id) { return path.join(this.storeDir, id); }
  excludedIn(root) {
    const engineRootAbs = path.resolve(this.engineRoot);
    const rootAbs = workspaceRoot(root);
    return engineRootAbs !== rootAbs && engineRootAbs.startsWith(rootAbs + path.sep) ? engineRootAbs : null;
  }
  async createSnapshot(root) {
    const id = `cp-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`;
    const dir = ensureDir(this.snapshotDir(id));
    const filesDir = ensureDir(path.join(dir, 'files'));
    const manifest = { version: 1, provider: 'copy', root: workspaceRoot(root), files: [] };
    let n = 0;
    for (const abs of await walkWorkspaceAsync(root, this.excludedIn(root))) {
      const entry = entryOf(root, abs);
      if (!entry) continue;
      const rel = entry.rel;
      if (entry.type === 'symlink') {
        manifest.files.push({ ...entry, symlink: fs.readlinkSync(abs) });
        continue;
      }
      const target = path.join(filesDir, ...rel.split('/'));
      ensureDir(path.dirname(target));
      fs.copyFileSync(abs, target);
      entry.hash = sha256File(abs);
      manifest.files.push(entry);
      if ((++n & 255) === 0) await yieldLoop();
    }
    atomicWrite(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2));
    return { provider: this.name, id, ref: `copy:${id}` };
  }
  async manifestFor(root, ref) {
    if (ref === 'current') return currentManifestAsync(root, false, this.excludedIn(root));
    const m = ref.match(/^copy:([A-Za-z0-9_-]+)$/);
    if (!m) throw new RewindError(`非法 copy 快照引用: ${ref}`);
    return JSON.parse(fs.readFileSync(path.join(this.snapshotDir(m[1]), 'manifest.json'), 'utf8'));
  }
  async readContent(root, ref, entry) {
    if (ref === 'current') return fs.readFileSync(assertInside(root, entry.rel));
    const m = ref.match(/^copy:([A-Za-z0-9_-]+)$/);
    if (!m) throw new RewindError(`非法 copy 快照引用: ${ref}`);
    const file = path.join(this.snapshotDir(m[1]), 'files', ...entry.rel.split('/'));
    return fs.readFileSync(assertInside(this.snapshotDir(m[1]), file));
  }
  async restoreSnapshot(root, ref) {
    const manifest = await this.manifestFor(root, ref);
    const desired = new Map(manifest.files.map((entry) => [entry.rel, entry]));
    for (const abs of await walkWorkspaceAsync(root, this.excludedIn(root))) {
      const rel = relOf(root, abs);
      if (!desired.has(rel)) fs.rmSync(abs, { force: true });
      await yieldLoop();
    }
    for (const entry of desired.values()) {
      const abs = assertInside(root, entry.rel);
      ensureDir(path.dirname(abs));
      try { fs.rmSync(abs, { recursive: true, force: true }); } catch {}
      if (entry.type === 'symlink') {
        fs.symlinkSync(entry.symlink || '', abs);
        continue;
      }
      const content = await this.readContent(root, ref, entry);
      fs.writeFileSync(abs, content);
    }
  }
  deleteSnapshot(ref) {
    const m = ref.match(/^copy:([A-Za-z0-9_-]+)$/);
    if (m) fs.rmSync(this.snapshotDir(m[1]), { recursive: true, force: true });
  }
}
class GitSnapshotProvider {
  name = 'git';
  constructor(engineRoot) { this.engineRoot = engineRoot; }
  excludedIn(root) {
    const engineRootAbs = path.resolve(this.engineRoot);
    const rootAbs = workspaceRoot(root);
    return engineRootAbs !== rootAbs && engineRootAbs.startsWith(rootAbs + path.sep) ? engineRootAbs : null;
  }
  available(root) { return gitAvailable(root); }
  async createSnapshot(root) {
    const tmpIndex = path.join(os.tmpdir(), `dsh-rewind-index-${process.pid}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`);
    const env = { GIT_INDEX_FILE: tmpIndex };
    try {
      await runGit(root, ['read-tree', 'HEAD'], env); // 无 HEAD 的仓库允许失败
      const add = await runGit(root, ['add', '-A', '--', '.'], env);
      if (add.status !== 0) throw new RewindError(`git add 失败: ${add.stderr || add.stdout}`);
      const treeRes = await runGit(root, ['write-tree'], env);
      if (treeRes.status !== 0) throw new RewindError(`git write-tree 失败: ${treeRes.stderr}`);
      const tree = String(treeRes.stdout).trim();
      const commitRes = await runGit(root, ['commit-tree', tree, '-m', `dsh-rewind checkpoint ${new Date().toISOString()}`], env);
      if (commitRes.status !== 0) throw new RewindError(`git commit-tree 失败: ${commitRes.stderr}`);
      const sha = String(commitRes.stdout).trim();
      return { provider: this.name, id: `git-${sha.slice(0, 12)}`, ref: `git:${sha}` };
    } finally {
      try { fs.rmSync(tmpIndex, { force: true }); } catch {}
    }
  }
  async manifestFor(root, ref) {
    if (ref === 'current') return currentManifestAsync(root, true, this.excludedIn(root));
    const m = ref.match(/^git:([0-9a-fA-F]{40})$/);
    if (!m) throw new RewindError(`非法 git 快照引用: ${ref}`);
    const sha = m[1];
    const files = [];
    const tree = await runGit(root, ['ls-tree', '-r', '-l', '-z', sha]);
    if (tree.status !== 0) throw new RewindError(`git ls-tree 失败: ${tree.stderr}`);
    for (const line of String(tree.stdout || '').split('\0')) {
      if (!line) continue;
      const parts = line.split(/\s+/); // <mode> <type> <object> <size>\t<rel>
      if (parts.length < 4) continue;
      const [mode, type, object] = parts;
      const rel = line.slice(line.indexOf('\t') + 1);
      const size = Number(parts[3] || 0);
      files.push({
        rel, type: mode === '120000' ? 'symlink' : 'file',
        size, mtimeMs: 0, hash: '', gitSha: object
      });
    }
    return { version: 1, provider: 'git', root: workspaceRoot(root), files };
  }
  async readContent(root, ref, entry) {
    if (ref === 'current') return fs.readFileSync(assertInside(root, entry.rel));
    const m = ref.match(/^git:([0-9a-fA-F]{40})$/);
    if (!m) throw new RewindError(`非法 git 快照引用: ${ref}`);
    // 二进制安全：不用 runGit 的 utf8 解码
    const res = await new Promise((resolve) => {
      execFile('git', ['cat-file', 'blob', `${m[1]}:${entry.rel}`], {
        cwd: workspaceRoot(root), windowsHide: true, maxBuffer: 128 * 1024 * 1024, timeout: 30000
      }, (err, stdout, stderr) => resolve({ err, stdout: Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout || ''), stderr: stderr || '' }));
    });
    if (res.err && res.err.code !== 0 && !res.stdout.length) {
      throw new RewindError(`git cat-file 失败: ${String(res.stderr || res.err.message || '')}`);
    }
    return res.stdout;
  }
  async restoreSnapshot(root, ref) {
    const sha = ref.replace(/^git:/, '');
    const manifest = await this.manifestFor(root, ref);
    const desired = new Set(manifest.files.map((entry) => entry.rel));
    const before = await walkWorkspaceAsync(root, this.excludedIn(root));
    const tmpIndex = path.join(os.tmpdir(), `dsh-rewind-restore-${process.pid}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`);
    const env = { GIT_INDEX_FILE: tmpIndex };
    try {
      const read = await runGit(root, ['read-tree', sha], env);
      if (read.status !== 0) throw new RewindError(`git read-tree 失败: ${read.stderr}`);
      const checkout = await runGit(root, ['checkout-index', '-a', '-f'], env);
      if (checkout.status !== 0) throw new RewindError(`git checkout-index 失败: ${checkout.stderr}`);
    } finally {
      try { fs.rmSync(tmpIndex, { force: true }); } catch {}
    }
    // 删除“检查点之后新增 / 检查点里已删除”的文件；只删快照创建前已存在的路径，
    // 避免误删 checkout-index 刚从快照写回、但在真实 index 里尚不属于 tracked 的文件。
    for (const abs of before) {
      const rel = relOf(root, abs);
      if (!desired.has(rel)) fs.rmSync(abs, { force: true });
      await yieldLoop();
    }
  }
  deleteSnapshot() { /* Git 对象留在对象库中，由用户 gc；不主动删除 */ }
  /**
  * 直接对比 git 快照与当前工作区：一次 `git diff` 拿到变更文件列表，
  * 不再逐文件 cat-file / 哈希——大工作区预览从数十秒降到毫秒级。
  * @returns 与 {@link diffManifests} 同形的 diffs（无 patch，预览用）。
  */
  diffCurrent(root, ref) {
    const sha = ref.replace(/^git:/, '');
    return (async () => {
      const name = await runGit(root, ['diff', '--name-status', '-z', sha]);
      const num = await runGit(root, ['diff', '--numstat', sha]);
      const statusByPath = new Map();
      const parts = String(name.stdout || '').split('\0');
      for (let i = 0; i + 1 < parts.length; i += 2) {
        const st = parts[i][0];
        const p = parts[i + 1];
        if (!p) continue;
        statusByPath.set(p, st === 'A' ? 'added' : st === 'D' ? 'deleted' : 'modified');
      }
      const diffs = [];
      for (const line of String(num.stdout || '').split('\n')) {
        if (!line.trim()) continue;
        const m = /^(\d+|-)\t(\d+|-)\t(.+)$/.exec(line);
        if (!m) continue;
        const path = m[3];
        const status = statusByPath.get(path) || 'modified';
        const add = m[1] === '-' ? null : Number(m[1]);
        const del = m[2] === '-' ? null : Number(m[2]);
        const diff = { path, status, beforeSize: undefined, afterSize: undefined };
        if (add !== null && del !== null) diff.lineChanges = { added: add, removed: del };
        diffs.push(diff);
      }
      for (const [p, status] of statusByPath) {
        if (!diffs.some((d) => d.path === p)) diffs.push({ path: p, status, beforeSize: undefined, afterSize: undefined });
      }
      diffs.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
      return diffs;
    })();
  }
}

// ---------------- 差异计算 ----------------
function lineDiff(aText, bText) {
  const a = aText.replace(/\r\n/g, '\n').split('\n');
  const b = bText.replace(/\r\n/g, '\n').split('\n');
  if (a.length * b.length > LCS_LINES_MAX * LCS_LINES_MAX) return null;
  const n = a.length, m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const patch = [];
  let added = 0, removed = 0;
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) { i++; j++; continue; }
    if (dp[i + 1][j] >= dp[i][j + 1]) { removed++; patch.push(`-${a[i]}`); i++; }
    else { added++; patch.push(`+${b[j]}`); j++; }
  }
  while (i < n) { removed++; patch.push(`-${a[i]}`); i++; }
  while (j < m) { added++; patch.push(`+${b[j]}`); j++; }
  return { added, removed, patch: patch.join('\n') };
}
function contentHash(provider, root, ref, entry) {
  if (entry.hash) return entry.hash;
  if (ref === 'current') {
    const abs = assertInside(root, entry.rel);
    return fs.existsSync(abs) ? sha256File(abs) : '';
  }
  if (provider.name === 'git' && entry.gitSha) return entry.gitSha;
  return sha256(provider.readContent(root, ref, entry));
}
async function diffManifests(provider, root, fromRef, fromManifest, toRef, toManifest) {
  const a = new Map(fromManifest.files.map((entry) => [entry.rel, entry]));
  const b = new Map(toManifest.files.map((entry) => [entry.rel, entry]));
  const diffs = [];
  let n = 0;
  for (const rel of new Set([...a.keys(), ...b.keys()])) {
    const x = a.get(rel);
    const y = b.get(rel);
    let status;
    if (!x) status = 'added';
    else if (!y) status = 'deleted';
    else {
      const sameSize = x.size === y.size;
      const sameMtime = x.mtimeMs === y.mtimeMs;
      if (sameSize && sameMtime) continue;
      const hx = contentHash(provider, root, fromRef, x);
      const hy = contentHash(provider, root, toRef, y);
      if (hx === hy) continue;
      status = 'modified';
    }
    const diff = {
      path: rel,
      status,
      beforeSize: x ? x.size : undefined,
      afterSize: y ? y.size : undefined
    };
    if (status === 'modified') {
      const bx = provider.readContent(root, fromRef, x);
      const by = provider.readContent(root, toRef, y);
      if (bx.length <= MAX_DIFF_BYTES && by.length <= MAX_DIFF_BYTES) {
        const ld = lineDiff(bx.toString('utf8'), by.toString('utf8'));
        if (ld) {
          diff.lineChanges = { added: ld.added, removed: ld.removed };
          if (ld.patch.length <= MAX_DIFF_BYTES) diff.patch = ld.patch;
        }
      }
    }
    diffs.push(diff);
    if ((++n & 63) === 0) await yieldLoop();
  }
  diffs.sort((p, q) => (p.path < q.path ? -1 : p.path > q.path ? 1 : 0));
  return diffs;
}
function planSignature(diffs) {
  return JSON.stringify(diffs.map((d) => [d.path, d.status, d.beforeSize ?? 0, d.afterSize ?? 0]));
}

// ---------------- 检查点引擎 ----------------
class CheckpointEngine {
  constructor(options = {}) {
    this.home = options.home || dshHomeOf();
    this.root = path.join(this.home, 'checkpoints');
    this.keepRegular = options.keepRegular ?? REGULAR_KEEP;
    this.keepGuard = options.keepGuard ?? GUARD_KEEP;
    this.copy = new CopySnapshotProvider(this.root);
    this.git = new GitSnapshotProvider(this.root);
    this.metaCache = null; // { mtimeMs, size, meta }：按文件 mtime 失效，兼容另一进程写入
  }
  loadMeta() {
    const file = path.join(this.root, META_FILE);
    try {
      const st = fs.statSync(file);
      const stamp = { mtimeMs: Math.floor(st.mtimeMs), size: st.size };
      if (this.metaCache && this.metaCache.mtimeMs === stamp.mtimeMs && this.metaCache.size === stamp.size) {
        return this.metaCache.meta;
      }
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
      if (Array.isArray(parsed.checkpoints)) {
        this.metaCache = { ...stamp, meta: parsed };
        return parsed;
      }
    } catch {}
    this.metaCache = null;
    return { version: 1, checkpoints: [] };
  }
  saveMeta(meta) {
    ensureDir(this.root);
    withLockSync(this.root, () => atomicWrite(path.join(this.root, META_FILE), JSON.stringify(meta, null, 2)));
    this.metaCache = null; // 下次 loadMeta 按新 mtime 重建
  }
  providerFor(name) { return name === 'git' ? this.git : this.copy; }
  list(filter = {}) {
    let records = this.loadMeta().checkpoints;
    if (filter.type) records = records.filter((r) => r.type === filter.type);
    if (filter.sessionId) records = records.filter((r) => r.sessionId === filter.sessionId);
    if (filter.cwd) records = records.filter((r) => r.root === workspaceRoot(filter.cwd));
    return records.sort((a, b) => b.createdAt - a.createdAt);
  }
  async createCheckpoint(bind) {
    const root = workspaceRoot(bind.cwd);
    const provider = (await this.git.available(root)) ? this.git : this.copy;
    const snap = await provider.createSnapshot(root);
    const record = {
      id: `ck-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`,
      type: bind.type === 'guard' ? 'guard' : 'regular',
      provider: provider.name,
      ref: snap.ref,
      root,
      sessionId: bind.sessionId ?? null,
      messageId: bind.messageId ?? null,
      turn: bind.turn ?? null,
      summary: bind.summary ?? null,
      createdAt: Date.now()
    };
    const meta = this.loadMeta();
    meta.checkpoints.push(record);
    this.prune(meta);
    this.saveMeta(meta);
    return record;
  }
  async ensureCheckpoint(bind) {
    if (bind.messageId) {
      const found = this.list({ sessionId: bind.sessionId }).find((r) => r.messageId === bind.messageId);
      if (found) return found;
    }
    return this.createCheckpoint(bind);
  }
  getById(id) { return this.loadMeta().checkpoints.find((r) => r.id === id) || null; }
  latestGuard() {
    return this.list({ type: 'guard' })[0] || null;
  }
  deleteCheckpoint(id) {
    const meta = this.loadMeta();
    const idx = meta.checkpoints.findIndex((r) => r.id === id);
    if (idx === -1) return false;
    const [record] = meta.checkpoints.splice(idx, 1);
    this.providerFor(record.provider).deleteSnapshot(record.ref);
    this.saveMeta(meta);
    return true;
  }
  prune(meta) {
    const regular = meta.checkpoints.filter((r) => r.type !== 'guard');
    const guards = meta.checkpoints.filter((r) => r.type === 'guard');
    const drop = [];
    for (const stale of regular.slice(this.keepRegular)) drop.push(stale);
    for (const stale of guards.slice(this.keepGuard)) drop.push(stale);
    if (!drop.length) return;
    meta.checkpoints = meta.checkpoints.filter((r) => !drop.includes(r));
    for (const stale of drop) this.providerFor(stale.provider).deleteSnapshot(stale.ref);
  }
  async preview(id) {
    const record = this.getById(id);
    if (!record) throw new RewindError('未找到该检查点');
    const provider = this.providerFor(record.provider);
    let diffs;
    if (provider.name === 'git') {
      // git 快照：一条 git diff 直出变更列表（此前逐文件 cat-file + 哈希，大工作区卡数十秒）
      diffs = await provider.diffCurrent(record.root, record.ref);
    } else {
      const from = await provider.manifestFor(record.root, record.ref);
      const to = await provider.manifestFor(record.root, 'current');
      diffs = await diffManifests(provider, record.root, record.ref, from, 'current', to);
    }
    return {
      checkpoint: record,
      provider: record.provider,
      diffs,
      total: diffs.length,
      signature: planSignature(diffs),
      // 该消息同轮工具调用触及的文件（相对根路径）——供预览标注「该消息修改」
      sessionFiles: record.sessionId ? this.sessionTouchedFiles(record.sessionId, record.messageId) : []
    };
  }
  async execute(id, expectedSignature) {
    const plan = await this.preview(id);
    // 陈旧计划检测：对比用户确认时看到的那份预览签名；确认后工作区再变化则失效
    if (typeof expectedSignature === 'string' && plan.signature !== expectedSignature) {
      throw new RewindError('工作区在预览后发生了变化，回滚计划已失效，请重新预览', 'REWIND_STALE');
    }
    const guard = await this.createCheckpoint({
      cwd: plan.checkpoint.root,
      sessionId: plan.checkpoint.sessionId,
      type: 'guard',
      summary: `保护检查点（回滚 ${id} 前）`
    });
    const provider = this.providerFor(plan.checkpoint.provider);
    await provider.restoreSnapshot(plan.checkpoint.root, plan.checkpoint.ref);
    return { ok: true, guard, checkpoint: plan.checkpoint, diffs: plan.diffs };
  }
  async undoLatest(guardId) {
    const guard = guardId ? this.getById(guardId) : this.latestGuard();
    if (!guard || guard.type !== 'guard') throw new RewindError('没有可用的保护检查点');
    const provider = this.providerFor(guard.provider);
    await provider.restoreSnapshot(guard.root, guard.ref);
    return { ok: true, guard };
  }
  /**
  * 读取该会话在指定用户消息之后（同轮）工具调用触及的文件路径，
  * 供预览区分「这条消息改了什么」与「工作区整体变化」。
  * @returns 相对工作区根（无法确定时保留原始形式）的去重路径列表
  */
  sessionTouchedFiles(sessionId, messageId) {
    try {
      const sessionsRoot = path.join(this.home, 'sessions');
      if (!fs.existsSync(sessionsRoot)) return [];
      for (const wsDir of fs.readdirSync(sessionsRoot, { withFileTypes: true })) {
        if (!wsDir.isDirectory()) continue;
        const wsPath = path.join(sessionsRoot, wsDir.name);
        for (const sessDir of fs.readdirSync(wsPath, { withFileTypes: true })) {
          if (!sessDir.isDirectory()) continue;
          const file = path.join(wsPath, sessDir.name, 'session.jsonl.zstd');
          if (!fs.existsSync(file)) continue;
          try {
            const events = readSessionLog(file);
            if (!events.length) continue;
            const header = events[0];
            if (!header || (header.id !== sessionId && header.header?.id !== sessionId)) continue;
            const startIdx = messageId
              ? events.findIndex((e) => e.type === 'user/message' && e.data && e.data.id === messageId)
              : -1;
            const files = new Set();
            for (let i = startIdx >= 0 ? startIdx : 0; i < events.length; i++) {
              const e = events[i];
              if (startIdx >= 0 && e.type === 'user/message' && i > startIdx && e.data && e.data.id !== messageId) break;
              if (e.type !== 'assistant/message' || !Array.isArray(e.data && e.data.message && e.data.message.content)) continue;
              for (const b of e.data.message.content) {
                if (!b || b.type !== 'tool-call' || !b.name || !b.input) continue;
                const raw = b.input.file_path || b.input.path || (b.input.paths && b.input.paths[0]);
                if (typeof raw !== 'string' || !raw) continue;
                const norm = raw.replace(/\\/g, '/');
                files.add(norm.startsWith('/') ? norm : norm);
              }
            }
            return [...files];
          } catch {}
        }
      }
    } catch {}
    return [];
  }
}

module.exports = {
  RewindError,
  CheckpointEngine,
  createCheckpointEngine: (options) => new CheckpointEngine(options),
  assertInside,
  workspaceRoot,
  dshHomeOf,
  REGULAR_KEEP,
  GUARD_KEEP
};
