#!/usr/bin/env node
/**
 * Render each cover variant to PNG at one or more of 5 ratios:
 *   16x9 (1920×1080) · 4x3 (1440×1080) · 9x16 (1080×1920) ·
 *   3x4 (1080×1440) · 1x1 (1080×1080)
 *
 *   1) Reads cover ids from presentation/src/covers/registry.ts
 *   2) Playwright headless visits localhost:<port>/?cover=<id>&ratio=<r>
 *   3) Waits for fonts to load + 600ms paint stabilize
 *   4) Captures screenshot to projects/<slug>/cover/<id>[.suffix].png
 *      - 16:9 → cover/<id>.png        （和老版本兼容，不带后缀）
 *      - 4:3  → cover/<id>-4x3.png
 *      - 9:16 → cover/<id>-9x16.png   （竖版 / 抖音 / Reels / Shorts / 小红书）
 *      - 3:4  → cover/<id>-3x4.png    （小红书竖版 / Pinterest）
 *      - 1:1  → cover/<id>-1x1.png    （IG / 朋友圈 / 视频号方形）
 *
 * 用法：
 *   node scripts/render-covers.mjs <slug> [--port 5174] [--ratio <r>|both]
 *
 * --ratio 缺省 = "both" —— 按项目 .orientation 自动选组合：
 *   landscape: 16x9 + 4x3
 *   portrait : 9x16 + 3x4 + 1x1
 *   square   : 1x1 + 4x3
 *
 * 也可以单独指定 16x9 / 4x3 / 9x16 / 3x4 / 1x1。
 *
 * 前置：该项目的 dev server 已经在跑（./start.sh <slug>）。
 */
import { chromium } from "playwright";
import { mkdir, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PROJECTS_DIR = path.join(ROOT, "projects");

const RATIOS = {
  "16x9": { width: 1920, height: 1080, suffix: "" },
  "4x3": { width: 1440, height: 1080, suffix: "-4x3" },
  "9x16": { width: 1080, height: 1920, suffix: "-9x16" },
  "3x4": { width: 1080, height: 1440, suffix: "-3x4" },
  "1x1": { width: 1080, height: 1080, suffix: "-1x1" },
};

// 每种 orientation 下 --ratio=both 默认跑哪几套
const ORIENTATION_DEFAULTS = {
  landscape: ["16x9", "4x3"],
  portrait: ["9x16", "3x4", "1x1"],
  square: ["1x1", "4x3"],
};

const args = process.argv.slice(2);
const slug = args.find((a) => !a.startsWith("--"));
let port = 5174;
const portIdx = args.indexOf("--port");
if (portIdx >= 0) port = parseInt(args[portIdx + 1], 10);

let ratioArg = "both";
const ratioIdx = args.indexOf("--ratio");
if (ratioIdx >= 0) ratioArg = args[ratioIdx + 1];

if (!slug) {
  console.error(
    "用法: node scripts/render-covers.mjs <slug> [--port 5174] [--ratio 16x9|4x3|9x16|3x4|1x1|both]",
  );
  process.exit(1);
}

async function findProject(s) {
  try {
    const direct = path.join(PROJECTS_DIR, s, "presentation");
    await stat(direct);
    return path.join(PROJECTS_DIR, s);
  } catch {}
  for (const cat of await readdir(PROJECTS_DIR, { withFileTypes: true })) {
    if (!cat.isDirectory()) continue;
    try {
      const nested = path.join(PROJECTS_DIR, cat.name, s, "presentation");
      await stat(nested);
      return path.join(PROJECTS_DIR, cat.name, s);
    } catch {}
  }
  throw new Error(`找不到项目 ${s}`);
}

async function readOrientation(candidates) {
  for (const c of candidates) {
    try {
      const raw = await readFile(c, "utf8");
      const v = raw.trim();
      if (v in ORIENTATION_DEFAULTS) return v;
    } catch {}
  }
  return "landscape"; // 老项目无 .orientation
}

const projDir = await findProject(slug);
const presDir = path.join(projDir, "presentation");
const orientation = await readOrientation([
  path.join(presDir, ".orientation"),
  path.join(projDir, ".orientation"),
]);

// 解析 --ratio
let selectedRatios = null;
if (ratioArg === "both") {
  selectedRatios = ORIENTATION_DEFAULTS[orientation];
} else if (ratioArg in RATIOS) {
  selectedRatios = [ratioArg];
}
if (!selectedRatios) {
  console.error(
    `✗ 未知 --ratio: ${ratioArg}（可选: 16x9 / 4x3 / 9x16 / 3x4 / 1x1 / both）`,
  );
  process.exit(1);
}

const registryPath = path.join(presDir, "src", "covers", "registry.ts");
const outDir = path.join(projDir, "cover");
await mkdir(outDir, { recursive: true });

const registrySrc = await readFile(registryPath, "utf8");
const ids = [...registrySrc.matchAll(/id:\s*["']([^"']+)["']/g)].map(
  (m) => m[1],
);
if (ids.length === 0) {
  console.error(`✗ 没在 ${registryPath} 找到任何 cover id`);
  process.exit(1);
}
console.log(`找到 ${ids.length} 个 cover:`, ids.join(", "));
console.log(`项目 orientation: ${orientation}`);
console.log(`渲染比例: ${selectedRatios.join(" + ")}`);

// 健康检查
try {
  const res = await fetch(`http://localhost:${port}/`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
} catch (e) {
  console.error(`✗ 端口 ${port} 没响应。请先 ./start.sh ${slug}`);
  console.error(`   detail: ${e.message}`);
  process.exit(1);
}

console.log("启 Chromium（headless）...");
const browser = await chromium.launch({ headless: true });

try {
  for (const ratio of selectedRatios) {
    const { width, height, suffix } = RATIOS[ratio];
    console.log(`\n▶ ratio=${ratio} viewport=${width}×${height}`);
    const context = await browser.newContext({
      viewport: { width, height },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();

    for (const id of ids) {
      const url = `http://localhost:${port}/?cover=${encodeURIComponent(id)}&ratio=${ratio}`;
      process.stdout.write(`  → ${id}${suffix} ... `);
      await page.goto(url, { waitUntil: "networkidle" });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(600);
      const outPath = path.join(outDir, `${id}${suffix}.png`);
      await page.screenshot({
        path: outPath,
        fullPage: false,
        clip: { x: 0, y: 0, width, height },
      });
      console.log(`✓ ${outPath}`);
    }

    await context.close();
  }
} finally {
  await browser.close();
}

console.log(`\n✅ 完成，输出到 ${outDir}`);
