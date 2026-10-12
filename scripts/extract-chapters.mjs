#!/usr/bin/env node
/**
 * Extract chapter timestamps from `video-out/timings.json` + chapter titles
 * from `presentation/src/registry/chapters.ts`, emit `chapters.md` in the
 * project root.
 *
 * Format: "HH:MM:SS <title>" — one chapter per line. Compatible with
 * YouTube / Bilibili / 视频号 chapter markers.
 *
 * 用法：node scripts/extract-chapters.mjs <slug>
 *
 * 前置：项目已跑过 render-video.mjs，video-out/timings.json 已存在。
 *
 * 章节起点 = 该章第一个 step (step 0) 的 `time` 字段。脚本会校验每个
 * 章节时长 >= 5s（用户硬约束）—— 太短的章节会警告但不阻塞输出。
 */
import { readFile, writeFile, stat, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..", "..", "..");
// scripts/ 安装到 ~/.claude/skills 时是软链，无法用 __dirname 推断 repo 根 ——
// 改用 cwd 兜底：调用者从 web-video repo 根跑就行。
const REPO_ROOT = (await (async () => {
  // 优先用 cwd，因为 scripts 软链时 __dirname 解析到 SKILLS repo
  const cwd = process.cwd();
  try {
    await stat(path.join(cwd, "projects"));
    return cwd;
  } catch {
    return ROOT;
  }
})());

const PROJECTS_DIR = path.join(REPO_ROOT, "projects");

const args = process.argv.slice(2);
const slug = args.find((a) => !a.startsWith("--"));
if (!slug) {
  console.error("用法: node scripts/extract-chapters.mjs <slug>");
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

const projDir = await findProject(slug);
const timingsPath = path.join(projDir, "video-out", "timings.json");
const registryPath = path.join(
  projDir,
  "presentation",
  "src",
  "registry",
  "chapters.ts",
);
const outPath = path.join(projDir, "chapters.md");

// 读 timings.json
let timings;
try {
  timings = JSON.parse(await readFile(timingsPath, "utf8")).timings;
} catch (e) {
  console.error(`✗ 无法读 ${timingsPath}`);
  console.error(`  请先跑：./render-video.sh ${slug}`);
  process.exit(1);
}

// 读 chapters.ts —— 用 regex 抽 id + title（不动 React 编译）
const registrySrc = await readFile(registryPath, "utf8");
const chapterEntries = [...registrySrc.matchAll(
  /id:\s*["']([^"']+)["'][,\s\S]*?title:\s*["']([^"']+)["']/g,
)].map((m) => ({ id: m[1], title: m[2] }));
if (chapterEntries.length === 0) {
  console.error(`✗ 在 ${registryPath} 没找到任何 id/title 对`);
  process.exit(1);
}
const titleById = Object.fromEntries(chapterEntries.map((c) => [c.id, c.title]));

// 章节起点 = 该章 step 0（or 第一个出现的 step）的 time
const seen = new Set();
const chapters = [];
for (const t of timings) {
  if (seen.has(t.chapter)) continue;
  seen.add(t.chapter);
  chapters.push({
    id: t.chapter,
    title: titleById[t.chapter] ?? t.chapter,
    start: t.time,
  });
}

if (chapters.length < 3) {
  console.warn(
    `⚠️  只有 ${chapters.length} 个章节 —— YouTube chapter marker 需要至少 3 个`,
  );
}

// 校验每章 ≥ 5s（用户硬约束）
const tail = timings[timings.length - 1]?.time ?? 0;
const totalEnd = Math.max(tail, chapters[chapters.length - 1]?.start ?? 0) + 1;
for (let i = 0; i < chapters.length; i++) {
  const start = chapters[i].start;
  const end = chapters[i + 1]?.start ?? totalEnd;
  const dur = end - start;
  if (dur < 5) {
    console.warn(
      `⚠️  章节 ${chapters[i].id} 时长 ${dur.toFixed(1)}s < 5s —— ` +
        `平台会拒；请考虑合并到相邻章节`,
    );
  }
}

// 第一个时间戳必须是 00:00（YouTube 规则）
if (chapters[0].start > 0.5) {
  console.warn(
    `⚠️  第一章起点 ${chapters[0].start.toFixed(1)}s 不是 00:00 —— ` +
      `YouTube 会拒；建议强制为 0`,
  );
  chapters[0].start = 0;
}

function hms(secs) {
  const t = Math.max(0, Math.floor(secs));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const body = chapters.map((c) => `${hms(c.start)} ${c.title}`).join("\n") + "\n";
await writeFile(outPath, body);

console.log(`✓ ${chapters.length} 个章节 → ${outPath}`);
console.log("");
console.log(body.trimEnd());
