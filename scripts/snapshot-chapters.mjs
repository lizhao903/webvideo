#!/usr/bin/env node
/**
 * snapshot-chapters.mjs —— 章节时间轴视觉自检（原型 / contact-sheet）。
 *
 * 灵感来自 HeyGen HyperFrames CLI 的 `snapshot`：把时间轴的每个关键帧抓成
 * PNG，再拼成一张 contact-sheet 供人 / 视觉模型一眼审阅。这里把它落到本
 * skill 的「点击驱动伪视频」上 —— 每个全局 step 独占整屏，正好一帧一张图。
 *
 * 它是 check-chapters.mjs 的**视觉补充**：
 *   · check-chapters.mjs 纯文本规则（step 数 / 字号 / emoji / 渐变），不看画面
 *   · snapshot-chapters.mjs 真把每个 step 渲出来截图，看「画面到底长啥样」
 *
 * 行为：
 *   1. 解析 presentation 项目（默认 ./presentation，也吃项目根 → 自动找 presentation/）
 *   2. 读 .orientation 决定 viewport：
 *        landscape → 1920×1080   portrait → 1080×1920   square → 1080×1080
 *   3. 从 src/registry/chapters.ts 拿章节顺序 + id，
 *      从各章 src/chapters/<dir>/narrations.ts 数 step 数（与 check-chapters 同口径）
 *   4. Playwright headless 连已经在跑的 dev server（默认 localhost:5174）。
 *      逐章逐 step 截图 —— 用 localStorage 注入 useStepper 的游标后 reload 定位，
 *      STORAGE_KEY 从项目自己的 src/hooks/useStepper.ts 抠（每个项目不同）。
 *   5. 截图落到 <presentation>/snapshots/<chapter-id>/step-NN.png，
 *      再生成一张纯 HTML+img 的 contact-sheet：<presentation>/snapshots/index.html
 *      （零新依赖，不引 sharp；网格按章节分组）
 *   6. 末尾打印每章 narrations step 数 ↔ 实际截图数是否一致。
 *
 * 用法：
 *   node snapshot-chapters.mjs [presentation-dir] [--port 5174] [--scale 0.5]
 *     - presentation-dir 缺省 = ./presentation（也可传项目根，自动找 presentation/）
 *     - --port  dev server 端口（缺省 5174，对齐 scaffold / render-covers）
 *     - --scale contact-sheet 里缩略图相对原始尺寸的倍率（缺省 0.25，仅影响 HTML 展示，PNG 仍是全尺寸）
 *
 * 前置：该项目 dev server 已经在跑（在 web-video 仓库里：./start.sh <slug>）。
 *
 * 依赖 Playwright（./install.sh 会装进本 skill 的 scripts/node_modules），按以下顺序找：
 *   1) 普通 import "playwright"（若运行环境的 node_modules 里有）
 *   2) $WEBVIDEO_PLAYWRIGHT_DIR / 本脚本所在目录 / <cwd>/scripts 下的 node_modules
 *   3) 都没有 → 提示跑 ./install.sh，然后退出
 */
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// ─────────────────────────────────────────────────────────────
// CLI 参数（风格对齐 render-covers.mjs / check-chapters.mjs）
// ─────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const posArg = argv.find((a) => !a.startsWith("--"));

let port = 5174;
const portIdx = argv.indexOf("--port");
if (portIdx >= 0) port = parseInt(argv[portIdx + 1], 10);

let scale = 0.25;
const scaleIdx = argv.indexOf("--scale");
if (scaleIdx >= 0) {
  const v = parseFloat(argv[scaleIdx + 1]);
  if (Number.isFinite(v) && v > 0 && v <= 1) scale = v;
}

const ORIENTATIONS = {
  landscape: { width: 1920, height: 1080 },
  portrait: { width: 1080, height: 1920 },
  square: { width: 1080, height: 1080 },
};

// ─────────────────────────────────────────────────────────────
// 解析 presentation 目录（与 check-chapters.mjs 同逻辑）
// ─────────────────────────────────────────────────────────────
async function isDir(p) {
  try {
    return (await stat(p)).isDirectory();
  } catch {
    return false;
  }
}
async function resolvePresentation(arg) {
  const base = path.resolve(arg || "./presentation");
  if (await isDir(path.join(base, "src", "chapters"))) return base;
  const nested = path.join(base, "presentation");
  if (await isDir(path.join(nested, "src", "chapters"))) return nested;
  throw new Error(
    `找不到 presentation（需含 src/chapters/）：试过 ${base} 和 ${nested}`,
  );
}

let PRES;
try {
  PRES = await resolvePresentation(posArg);
} catch (e) {
  console.error(`❌ ${e.message}`);
  process.exit(2);
}

// ─────────────────────────────────────────────────────────────
// orientation → viewport
// ─────────────────────────────────────────────────────────────
async function readOrientation(dir) {
  try {
    const o = (await readFile(path.join(dir, ".orientation"), "utf8")).trim();
    if (o in ORIENTATIONS) return o;
  } catch {}
  try {
    const src = await readFile(path.join(dir, "src", "stage.config.ts"), "utf8");
    const m = src.match(
      /ORIENTATION\s*[:=]\s*["'](landscape|portrait|square)["']/,
    );
    if (m) return m[1];
  } catch {}
  return "landscape";
}
const orientation = await readOrientation(PRES);
const { width, height } = ORIENTATIONS[orientation];

// ─────────────────────────────────────────────────────────────
// STORAGE_KEY —— useStepper.ts 里每个项目不同，必须抠出来
// ─────────────────────────────────────────────────────────────
async function readStorageKey(dir) {
  try {
    const src = await readFile(
      path.join(dir, "src", "hooks", "useStepper.ts"),
      "utf8",
    );
    const m = src.match(/STORAGE_KEY\s*=\s*["'`]([^"'`]+)["'`]/);
    if (m) return m[1];
  } catch {}
  return null;
}
const storageKey = await readStorageKey(PRES);
if (!storageKey) {
  console.error(
    "❌ 没在 src/hooks/useStepper.ts 找到 STORAGE_KEY —— 无法定位 step。" +
      "确认这是一个本 skill scaffold 出来的项目。",
  );
  process.exit(2);
}

// ─────────────────────────────────────────────────────────────
// 章节列表：registry/chapters.ts 给顺序 + id + narrations 来源目录，
// 各章 narrations.ts 给 step 数（计数口径与 check-chapters.mjs 一致）。
// ─────────────────────────────────────────────────────────────
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1");
}
function countNarrations(src) {
  const noComment = stripComments(src);
  const m = noComment.match(/narrations[^=]*=\s*\[([\s\S]*?)\]\s*;/);
  if (!m) return null;
  const strs = m[1].match(
    /"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/g,
  );
  return strs ? strs.length : 0;
}

/**
 * 解析 registry/chapters.ts：从 import 行建「本地名 → narrations 目录」，
 * 再从 CHAPTERS 数组里按出现顺序抓 id + 用的是哪个 narrations 变量。
 * 这样 id（决定 audio / 截图子目录命名）和 step 数都来自代码真相源。
 */
async function readChapters(dir) {
  const regPath = path.join(dir, "src", "registry", "chapters.ts");
  const src = await readFile(regPath, "utf8");
  const noComment = stripComments(src);

  // import { narrations as fooNarrations } from "../chapters/01-foo/narrations";
  const importDirByName = new Map();
  for (const m of noComment.matchAll(
    /import\s*\{[^}]*\bnarrations\s+as\s+(\w+)[^}]*\}\s*from\s*["']([^"']+narrations)["']/g,
  )) {
    importDirByName.set(m[1], path.dirname(m[2]));
  }

  // CHAPTERS 数组体
  const arrM = noComment.match(/CHAPTERS[^=]*=\s*\[([\s\S]*)\]\s*;/);
  if (!arrM) throw new Error(`解析不出 CHAPTERS 数组：${regPath}`);
  const body = arrM[1];

  // 逐个 { ... } 对象块，抓 id + narrations: 变量名
  const chapters = [];
  const objRe = /\{([\s\S]*?)\}/g;
  let om;
  while ((om = objRe.exec(body))) {
    const block = om[1];
    const idM = block.match(/\bid\s*:\s*["'`]([^"'`]+)["'`]/);
    const narM = block.match(/\bnarrations\s*:\s*(\w+)/);
    if (!idM || !narM) continue;
    const id = idM[1];
    const varName = narM[1];
    const relDir = importDirByName.get(varName);
    if (!relDir) continue;
    const narFile = path.join(dir, "src", relDir.replace(/^\.\.\//, ""), "narrations.ts");
    chapters.push({ id, varName, narFile });
  }
  return chapters;
}

let chapters;
try {
  chapters = await readChapters(PRES);
} catch (e) {
  console.error(`❌ ${e.message}`);
  process.exit(2);
}
if (chapters.length === 0) {
  console.error("❌ 没从 registry/chapters.ts 解析出任何章节");
  process.exit(2);
}

// 给每章补 step 数
for (const c of chapters) {
  try {
    c.steps = countNarrations(await readFile(c.narFile, "utf8"));
  } catch {
    c.steps = null;
  }
}

console.log(`快照 ${PRES}`);
console.log(`方向: ${orientation}  viewport: ${width}×${height}`);
console.log(`STORAGE_KEY: ${storageKey}`);
console.log(`章节数: ${chapters.length}`);
console.log(
  `各章 step（narrations）: ${chapters
    .map((c) => `${c.id}=${c.steps ?? "?"}`)
    .join(", ")}\n`,
);

// ─────────────────────────────────────────────────────────────
// dev server 健康检查（对齐 render-covers.mjs）
// ─────────────────────────────────────────────────────────────
try {
  const res = await fetch(`http://localhost:${port}/`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
} catch (e) {
  console.error(`✗ 端口 ${port} 没响应。请先把该项目的 dev server 跑起来。`);
  console.error(`   detail: ${e.message}`);
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────
// Playwright 解析：import → $WEBVIDEO_PLAYWRIGHT_DIR → skill 自带 scripts/ → cwd/scripts
// （install.sh 会在 skill 的 scripts/ 下 npm install playwright）
// ─────────────────────────────────────────────────────────────
async function loadChromium() {
  // 1) 普通解析（运行环境 node_modules 里有的话）
  try {
    const pw = await import("playwright");
    return pw.chromium;
  } catch {}
  // 2) 依次从候选目录解析：环境变量 > 本脚本所在目录 > 当前目录下的 scripts/
  const dirs = [
    process.env.WEBVIDEO_PLAYWRIGHT_DIR,
    path.dirname(fileURLToPath(import.meta.url)),
    path.join(process.cwd(), "scripts"),
  ].filter(Boolean);
  for (const d of dirs) {
    try {
      const pw = createRequire(path.join(d, "package.json"))("playwright");
      if (pw?.chromium) return pw.chromium;
    } catch {}
  }
  return null;
}

const chromium = await loadChromium();
if (!chromium) {
  console.error("✗ 找不到 Playwright。两种修法：");
  console.error("   a) 在 skill 根目录跑：./install.sh（会在 scripts/ 下装 playwright + chromium）");
  console.error("   b) 或指定已有安装：WEBVIDEO_PLAYWRIGHT_DIR=<含 node_modules/playwright 的目录> node ...");
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────
// 截图主循环
// ─────────────────────────────────────────────────────────────
const outRoot = path.join(PRES, "snapshots");
await mkdir(outRoot, { recursive: true });

console.log("启 Chromium（headless）...");
const browser = await chromium.launch({ headless: true });

const pad2 = (n) => String(n).padStart(2, "0");
const results = []; // { id, expected, shot:[{step, file}] }

try {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  // 先开一次首页，拿到同源 origin 才能写 localStorage
  await page.goto(`http://localhost:${port}/`, { waitUntil: "domcontentloaded" });

  for (let ci = 0; ci < chapters.length; ci++) {
    const c = chapters[ci];
    const n = c.steps ?? 0;
    console.log(`\n▸ ${c.id}  (${n} step)`);
    if (n <= 0) {
      console.log("  · 没有 narration step，跳过");
      results.push({ id: c.id, expected: n, shot: [] });
      continue;
    }
    const chDir = path.join(outRoot, c.id);
    await mkdir(chDir, { recursive: true });
    const shot = [];

    for (let step = 0; step < n; step++) {
      // 注入游标 → reload 定位（useStepper 启动时读 localStorage[STORAGE_KEY]）
      await page.evaluate(
        ([key, cur]) => window.localStorage.setItem(key, cur),
        [storageKey, JSON.stringify({ chapter: ci, step })],
      );
      await page.goto(`http://localhost:${port}/`, {
        waitUntil: "networkidle",
      });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(500); // 等入场动画落定
      const rel = path.join(c.id, `step-${pad2(step)}.png`);
      const outPath = path.join(outRoot, rel);
      process.stdout.write(`  → step ${step} ... `);
      await page.screenshot({
        path: outPath,
        fullPage: false,
        clip: { x: 0, y: 0, width, height },
      });
      console.log(`✓ ${rel}`);
      shot.push({ step, file: rel });
    }
    results.push({ id: c.id, expected: n, shot });
  }

  await context.close();
} finally {
  await browser.close();
}

// ─────────────────────────────────────────────────────────────
// contact-sheet：纯 HTML + img 网格，零新依赖
// ─────────────────────────────────────────────────────────────
const thumbW = Math.round(width * scale);
const totalShots = results.reduce((s, r) => s + r.shot.length, 0);
const stamp = new Date().toISOString().replace("T", " ").slice(0, 19);

const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
  }[c]));

const sections = results
  .map((r) => {
    const cells = r.shot
      .map(
        (s) => `      <figure class="cell">
        <img loading="lazy" src="${esc(s.file)}" alt="${esc(r.id)} step ${s.step}" />
        <figcaption>step ${s.step}</figcaption>
      </figure>`,
      )
      .join("\n");
    const mismatch =
      r.expected !== r.shot.length
        ? ` <span class="bad">⚠ narrations ${r.expected} ≠ 截图 ${r.shot.length}</span>`
        : ` <span class="ok">✓ ${r.shot.length} 帧</span>`;
    return `    <section>
      <h2>${esc(r.id)}${mismatch}</h2>
      <div class="grid">
${cells || '        <p class="empty">（无 step）</p>'}
      </div>
    </section>`;
  })
  .join("\n");

const html = `<!doctype html>
<html lang="zh">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>snapshot · ${esc(path.basename(path.dirname(PRES)) || "presentation")}</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 24px;
    background: #0d0f12; color: #e6e8ec;
    font: 14px/1.5 -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif;
  }
  header { margin-bottom: 24px; }
  h1 { font-size: 18px; margin: 0 0 6px; }
  .meta { color: #8b909a; font-size: 13px; }
  h2 { font-size: 15px; margin: 28px 0 10px; border-bottom: 1px solid #23262c; padding-bottom: 6px; }
  .ok { color: #4ec07a; font-weight: 400; font-size: 12px; }
  .bad { color: #e2655a; font-weight: 600; font-size: 12px; }
  .grid {
    display: grid; gap: 14px;
    grid-template-columns: repeat(auto-fill, minmax(${thumbW}px, 1fr));
  }
  .cell { margin: 0; }
  .cell img {
    width: 100%; height: auto; display: block;
    border: 1px solid #23262c; border-radius: 6px; background: #000;
  }
  figcaption { color: #8b909a; font-size: 12px; margin-top: 4px; }
  .empty { color: #5a5f68; }
</style>
</head>
<body>
  <header>
    <h1>章节快照 contact-sheet</h1>
    <div class="meta">
      ${esc(PRES)}<br />
      方向 ${esc(orientation)} · ${width}×${height} · 共 ${chapters.length} 章 / ${totalShots} 帧 · 生成于 ${esc(stamp)}
    </div>
  </header>
${sections}
</body>
</html>
`;

const sheetPath = path.join(outRoot, "index.html");
await writeFile(sheetPath, html, "utf8");

// ─────────────────────────────────────────────────────────────
// 末尾：每章 step 数 ↔ 截图数一致性（与 check-chapters 互补）
// ─────────────────────────────────────────────────────────────
console.log("\n── 一致性核对（narrations step 数 ↔ 实际截图数）──");
let mismatches = 0;
for (const r of results) {
  if (r.expected === r.shot.length) {
    console.log(`  ✓ ${r.id}: ${r.shot.length} 帧`);
  } else {
    mismatches += 1;
    console.log(
      `  ⚠ ${r.id}: narrations ${r.expected} ≠ 截图 ${r.shot.length}`,
    );
  }
}

console.log(`\n✅ 完成，contact-sheet → ${sheetPath}`);
console.log(`   截图根目录 → ${outRoot}`);
if (mismatches > 0) {
  console.log(
    `⚠ ${mismatches} 章 step 数与截图数不符（多半是 step guard 漂移，` +
      `配合 node check-chapters.mjs 看具体哪一步）`,
  );
}
