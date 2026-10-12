#!/usr/bin/env node
/**
 * check-chapters.mjs — 章节代码硬规则静态 lint。
 *
 * 把原本散在 CHAPTER-CRAFT.md Part 6/7 + COVER.md Part 5/6、靠 subagent /
 * 人工逐项核查的几条**确定性**红线，下沉成一个无依赖的 node 脚本：
 *
 *   1. narrations.ts 长度 ↔ 章节 .tsx 的 step 渲染数一致（音频不漂的唯一真相源）
 *   2. 手机字号红线：portrait / square 项目 font-size < 24px 一律报红
 *      （landscape 用 16px 信息级提示，不报红）
 *   3. 反 AI 味：章节里出现 emoji 直接报红
 *   4. 反 AI 味：紫 / 粉系 linear/radial-gradient（AI slop 标志）报红
 *   5. description.md（若存在）≤ 250 字
 *   6. online-font-import：章节 / 本地覆盖入口里引在线字体
 *      （fonts.googleapis.com / fonts.gstatic.com 的 @import / <link>）——
 *      程序化渲染（render-video.mjs）在沙箱/离线会失败/掉字/加载延迟。
 *      默认 warning，--strict 升 error（与现有红线一致）。
 *   7. self-id-selector：章节 CSS 里用裸全局选择器（无本章 .xx- 前缀，
 *      如 .title / .card / h1 / body）写规则，会泄漏到别的章节。warning。
 *
 * 用法：
 *   node check-chapters.mjs [presentation-dir] [--strict]
 *     - presentation-dir 缺省 = ./presentation；也可直接传项目根（自动找 presentation/）
 *     - 默认 advisory：永远 exit 0，仅打印 ✓ / ⚠
 *     - --strict：任一条红线不过 → exit 1（CI 门禁 / Phase 2.4 完工自检想硬卡时用）
 *
 * 不替代人的审美判断（节奏 / 视觉气质 / 内容取舍仍要人/agent 看），只兜
 * 「机器能确定性判定」的那几条，省下逐章把规则读进上下文的开销。
 */
import { readFile, readdir, stat, lstat } from "node:fs/promises";
import path from "node:path";

const argv = process.argv.slice(2);
const strict = argv.includes("--strict");
const posArg = argv.find((a) => !a.startsWith("--"));

// ---- 解析 presentation 目录 ----
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

// ---- orientation ----
async function readOrientation(dir) {
  try {
    const o = (await readFile(path.join(dir, ".orientation"), "utf8")).trim();
    if (["landscape", "portrait", "square"].includes(o)) return o;
  } catch {}
  // 兜底：从 stage.config.ts 抠 ORIENTATION
  try {
    const src = await readFile(path.join(dir, "src", "stage.config.ts"), "utf8");
    const m = src.match(/ORIENTATION\s*[:=]\s*["'](landscape|portrait|square)["']/);
    if (m) return m[1];
  } catch {}
  return "landscape";
}
const orientation = await readOrientation(PRES);
const isMobile = orientation === "portrait" || orientation === "square";
const FONT_FLOOR = isMobile ? 24 : 16; // px
const FONT_HARD = isMobile; // mobile 下 < floor 报红；landscape 仅提示

let fails = 0;
const warn = (m) => {
  fails += 1;
  console.log(`  ⚠ ${m}`);
};

// ---- 工具：剥注释 ----
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1"); // 不动 http:// 这类
}

// ---- narrations.ts 元素计数 ----
function countNarrations(src) {
  const noComment = stripComments(src);
  const m = noComment.match(/narrations[^=]*=\s*\[([\s\S]*?)\]\s*;/);
  if (!m) return null;
  const body = m[1];
  // 数顶层字符串字面量（", ', ` 三种，含转义）。元素间只有逗号/空白，
  // 字符串内部的逗号会被整段吞掉，不会误数。
  const strs = body.match(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/g);
  return strs ? strs.length : 0;
}

// ---- 从 .tsx 抽 step guard ----
function stepGuards(src) {
  const noComment = stripComments(src);
  const ns = [...noComment.matchAll(/step\s*===\s*(\d+)/g)].map((m) => Number(m[1]));
  return [...new Set(ns)].sort((a, b) => a - b);
}

// ---- hex → 是否紫/粉 ----
function hexIsPurplePink(hex) {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (h.length !== 6) return false;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  // 紫/粉：红蓝都偏高、绿明显更低
  return r > 110 && b > 110 && g < Math.min(r, b) - 25;
}
const PINKISH_KW = /\b(purple|violet|fuchsia|magenta|orchid|plum|hotpink|deeppink|pink)\b/i;
function gradientIsPurplePink(line) {
  if (!/(linear|radial|conic)-gradient/i.test(line)) return false;
  if (PINKISH_KW.test(line)) return true;
  const hexes = line.match(/#[0-9a-f]{3,8}\b/gi) || [];
  return hexes.some((hx) => hexIsPurplePink(hx.slice(0, 7)));
}

// emoji 范围（常见表情 / 符号 / 旗帜），排除普通中英文标点
const EMOJI_RE =
  /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{1F000}-\u{1F02F}\u{FE0F}\u{1F1E6}-\u{1F1FF}]/u;

// ---- 在线字体检测（rule 6 online-font-import）----
// 命中 fonts.googleapis.com / fonts.gstatic.com 的 @import 或 <link href=...>。
// 程序化渲染（render-video.mjs / Playwright 离线沙箱）下，远程字体常加载失败 /
// 掉字 / 拖慢首帧 —— 应改成本地 @font-face。
const ONLINE_FONT_RE = /fonts\.(?:googleapis|gstatic)\.com/i;
function onlineFontHit(line) {
  if (!ONLINE_FONT_RE.test(line)) return false;
  // 仅当出现在 @import / <link> 这种真会发请求的上下文里才算
  return /@import\b/i.test(line) || /<link\b/i.test(line);
}

// ---- 同名实例选择器泄漏检测（rule 7 self-id-selector）----
// skill 硬规则：每章独立 CSS 前缀（如 .hc- / .rt-）。这里只抓**最常见的泄漏型**，
// 压低误报：
//   a) 裸全局元素选择器：body / html / h1..h6（会改全站）
//   b) 无任何前缀的裸通用类名：.title / .card / .label 等（极易撞别章）
// 先从本章 CSS 里推断主前缀（出现最多的 .xx- / .xxx-），带该前缀的类一律放行。
const BARE_TAG_RE = /^(body|html|h[1-6])(\s|,|\{|:|\.|>|\+|~|$)/;
// 已知高危的"通用名"裸类——直接选 .title 这种几乎必撞
const GENERIC_CLASS_RE =
  /^\.(title|subtitle|heading|card|label|item|row|col|box|panel|wrapper|container|content|text|btn|button|icon|badge|tag|list|grid|header|footer|main|section|active|hidden|hide|show)(\s|,|\{|:|\.|>|\+|~|::|\[|$)/;
// 推断本章主前缀：统计形如 .ab- / .abc- 的类前缀，取出现最多者
function inferPrefix(cssText) {
  const noComment = stripComments(cssText);
  const counts = new Map();
  for (const m of noComment.matchAll(/(?:^|[\s,>+~{])\.([a-z]{2,4})-/gi)) {
    const p = m[1].toLowerCase();
    counts.set(p, (counts.get(p) || 0) + 1);
  }
  let best = null,
    bestN = 0;
  for (const [p, n] of counts) {
    if (n > bestN) {
      best = p;
      bestN = n;
    }
  }
  return best; // 可能为 null（本章没用前缀类）
}
// 取一条选择器行里、{ 之前的选择器片段（粗粒度，够判泄漏型）
function selectorPart(line) {
  const brace = line.indexOf("{");
  return (brace >= 0 ? line.slice(0, brace) : line).trim();
}
// 判断某选择器片段是否是"泄漏型"。prefix 为本章主前缀（可 null）。
function leakySelector(sel, prefix) {
  if (!sel) return null;
  // 拆逗号分组，逐组判
  for (const raw of sel.split(",")) {
    const seg = raw.trim();
    if (!seg) continue;
    // 取该组最左边的"键"token（第一个空格/组合符前），泄漏由根 key 决定
    const key = seg.split(/[\s>+~]/)[0].trim();
    if (!key) continue;
    if (BARE_TAG_RE.test(key)) return key; // 裸全局元素
    if (GENERIC_CLASS_RE.test(key)) {
      // 若该裸类其实带了本章前缀（理论上不会命中 GENERIC，但兜底），放行
      if (prefix && key.toLowerCase().startsWith(`.${prefix}-`)) continue;
      return key;
    }
  }
  return null;
}

// ---- 列章节目录 ----
const chaptersDir = path.join(PRES, "src", "chapters");
const entries = (await readdir(chaptersDir, { withFileTypes: true }))
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

console.log(`检查 ${PRES}`);
console.log(`方向: ${orientation}  字号下限: ${FONT_FLOOR}px (${FONT_HARD ? "红线" : "提示"})`);
console.log(`章节数: ${entries.length}\n`);

for (const name of entries) {
  const dir = path.join(chaptersDir, name);
  const files = await readdir(dir);
  console.log(`▸ ${name}`);

  // narrations
  const narFile = files.find((f) => f === "narrations.ts");
  let M = null;
  if (narFile) {
    M = countNarrations(await readFile(path.join(dir, narFile), "utf8"));
    if (M === null) warn(`narrations.ts 解析不出数组 —— 检查 export const narrations`);
  } else {
    warn(`缺 narrations.ts`);
  }

  // step guards across all .tsx
  const tsxFiles = files.filter((f) => f.endsWith(".tsx"));
  const guards = new Set();
  for (const f of tsxFiles) {
    stepGuards(await readFile(path.join(dir, f), "utf8")).forEach((n) => guards.add(n));
  }
  const gArr = [...guards].sort((a, b) => a - b);
  const maxN = gArr.length ? gArr[gArr.length - 1] : -1;

  // 一致性：max guard N + 1 == M（全显式守卫）或 == M-1（最后一步走默认 return）
  if (M !== null && M >= 0) {
    if (tsxFiles.length === 0) {
      warn(`没有 .tsx，无法核对 step 数`);
    } else if (maxN + 1 > M) {
      warn(
        `step 漂移：代码引用到 step ${maxN}，但 narrations 只有 ${M} 条 ` +
          `→ 多出的 step 没音频。bump narrations 或删该 step`,
      );
    } else if (maxN + 1 < M - 1) {
      warn(
        `step 漂移：narrations ${M} 条，但代码最高只渲到 step ${maxN}` +
          `（+1 个默认 return 也只到 ${maxN + 1}）→ 有孤儿 narration`,
      );
    } else {
      console.log(`  ✓ narrations ${M} 条 ↔ step 0..${Math.max(maxN, M - 1)} 对齐`);
    }
  }

  // 字号 + emoji + 渐变 + 在线字体 + 泄漏选择器：扫 .css 与 .tsx
  const styleFiles = files.filter((f) => f.endsWith(".css"));
  let fontHits = 0,
    emojiHit = false,
    gradHits = 0,
    onlineFontHits = 0,
    leakHits = 0;
  for (const f of [...styleFiles, ...tsxFiles]) {
    const src = await readFile(path.join(dir, f), "utf8");
    const lines = src.split("\n");
    // self-id-selector 只针对 .css，先推断本章主前缀
    const isCss = f.endsWith(".css");
    const prefix = isCss ? inferPrefix(src) : null;
    const noCommentLines = isCss ? stripComments(src).split("\n") : null;
    lines.forEach((ln, i) => {
      // font-size：取声明里最小的 px（clamp/calc 的下限才是可读性瓶颈）
      const fm = ln.match(/font-size\s*:\s*([^;}\n]+)/i);
      if (fm) {
        const pxs = [...fm[1].matchAll(/(\d+(?:\.\d+)?)px/g)].map((x) => Number(x[1]));
        const minPx = pxs.length ? Math.min(...pxs) : null;
        if (minPx !== null && minPx < FONT_FLOOR) {
          fontHits += 1;
          if (FONT_HARD) {
            warn(`${f}:${i + 1} font-size ${minPx}px < ${FONT_FLOOR}px 红线`);
          } else {
            console.log(`  · ${f}:${i + 1} font-size ${minPx}px（landscape 提示，<${FONT_FLOOR}px）`);
          }
        }
      }
      if (!emojiHit && EMOJI_RE.test(ln)) {
        emojiHit = true;
        warn(`${f}:${i + 1} 出现 emoji —— 反 AI 味红线，删掉`);
      }
      if (gradientIsPurplePink(ln)) {
        gradHits += 1;
        warn(`${f}:${i + 1} 紫/粉系渐变 —— 反 AI 味红线`);
      }
      // rule 6：在线字体（章节内自带 @import / <link>）
      if (onlineFontHit(ln)) {
        onlineFontHits += 1;
        warn(
          `${f}:${i + 1} 引在线字体（Google Fonts）—— 程序化渲染会失败/掉字，` +
            `改本地 @font-face`,
        );
      }
      // rule 7：泄漏型选择器（仅 .css，用剥注释后的行判，行号对齐原文件）
      if (isCss && noCommentLines) {
        const ncLn = noCommentLines[i] ?? "";
        // 只在"含选择器且带 {"或"独立选择器行"上判，避免数声明体
        if (ncLn.includes("{")) {
          const hit = leakySelector(selectorPart(ncLn), prefix);
          if (hit) {
            leakHits += 1;
            const fix = prefix ? `.${prefix}-` : "本章 .xx-";
            warn(
              `${f}:${i + 1} 裸全局选择器 "${hit}" 会泄漏到别的章节 —— ` +
                `加本章前缀（${fix}…）`,
            );
          }
        }
      }
    });
  }
  if (
    fontHits === 0 &&
    !emojiHit &&
    gradHits === 0 &&
    onlineFontHits === 0 &&
    leakHits === 0
  ) {
    console.log(
      `  ✓ 无 emoji / 紫粉渐变 / 在线字体 / 泄漏选择器${FONT_HARD ? " / 超小字号" : ""}`,
    );
  }
}

// ---- rule 6 续：本地覆盖的入口文件里的在线字体 ----
// fonts.css / index.html / tokens.css 通常是软链到 shared 脚手架的（shared 的
// fonts.css 故意用 @import 引 Google Fonts，是公认基线，不报）。只有当作者把入口
// **改成了真文件**（覆盖了软链）才扫——那是新引入的、会进 render 的在线字体。
async function isRealFile(p) {
  try {
    return !(await lstat(p)).isSymbolicLink();
  } catch {
    return false;
  }
}
const entryCandidates = [
  path.join(PRES, "src", "styles", "fonts.css"),
  path.join(PRES, "src", "styles", "tokens.css"),
  path.join(PRES, "index.html"),
];
let entryHeaderShown = false;
for (const p of entryCandidates) {
  if (!(await isRealFile(p))) continue; // 软链 → 跳过（用共享基线）
  let txt;
  try {
    txt = await readFile(p, "utf8");
  } catch {
    continue;
  }
  txt.split("\n").forEach((ln, i) => {
    if (onlineFontHit(ln)) {
      if (!entryHeaderShown) {
        console.log(`\n▸ 入口文件（本地覆盖）`);
        entryHeaderShown = true;
      }
      warn(
        `${path.relative(PRES, p)}:${i + 1} 本地覆盖的入口引在线字体 —— ` +
          `程序化渲染会失败/掉字，改本地 @font-face`,
      );
    }
  });
}

// ---- description.md（项目根，presentation 的上一级）----
const projRoot = path.dirname(PRES);
for (const loc of [path.join(projRoot, "description.md"), path.join(PRES, "..", "description.md")]) {
  try {
    const txt = (await readFile(loc, "utf8")).replace(/\s+$/, "");
    const n = [...txt].length; // 按码点数，中文算 1
    console.log(`\n▸ description.md`);
    if (n > 250) warn(`description.md ${n} 字 > 250 上限`);
    else console.log(`  ✓ description.md ${n} 字 ≤ 250`);
    break;
  } catch {}
}

console.log("");
if (fails === 0) {
  console.log("✓ 章节硬规则 lint 全部通过");
  process.exit(0);
}
console.log(`⚠ ${fails} 处红线未过${strict ? "（--strict → exit 1）" : "（advisory，建议修复）"}`);
process.exit(strict ? 1 : 0);
