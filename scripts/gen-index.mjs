#!/usr/bin/env node
/**
 * gen-index.mjs — 从 references/ 目录自动生成机器可读索引（llms.txt + references/INDEX.md）。
 *
 * 灵感来自 HyperFrames 的 `llms.txt`：给 agent 一份稳定、可定位的导航，
 * 让它不用通读所有长 md 就能判断「这一步该读哪个文件 / 哪一段」。
 *
 * 数据来源（全部已存在的事实，零硬编码内容）：
 *   1. references/*.md 目录列表 + 每个文件首个一级标题（# ...）
 *   2. 本脚本内置的 PHASE_HINT 表 —— 固化 SKILL.md「各阶段文件读取指南」里
 *      已写明的「何时读」（这是方法论的稳定事实，不是凭空造的）
 *
 * 产出（两份，内容同源）：
 *   - <skill>/llms.txt              机器优先：扁平、好 grep
 *   - <skill>/references/INDEX.md   人也能读的等价表格
 *
 * 用法：
 *   node gen-index.mjs            # 写 llms.txt + references/INDEX.md
 *   node gen-index.mjs --check    # 只校验是否最新（不写盘）；不一致 exit 1
 *   node gen-index.mjs --stdout   # 打印 llms.txt 到终端，不写盘
 *
 * 零新依赖（纯 Node）。不改任何已有文件，只写自己产出的两份。
 */
import { readFile, readdir, writeFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SKILL_ROOT = path.resolve(__dirname, "..");
const REF_DIR = path.join(SKILL_ROOT, "references");

const argv = process.argv.slice(2);
const checkOnly = argv.includes("--check");
const toStdout = argv.includes("--stdout");

/**
 * 固化 SKILL.md「各阶段文件读取指南」+「相关资源」两张表里已写明的
 * 「何时读」。key = references 下的文件名 / 子目录名。
 * 这是方法论的稳定事实层；正文一行用途从文件首个标题动态取。
 */
const PHASE_HINT = {
  "SCRIPT-STYLE.md": {
    when: "Phase 1.2 内容编写 · 必读",
    use: "文章→B站风口播稿规则、去AI味五类、TTS友好文本三类清洗、按 orientation 调节奏",
  },
  "OUTLINE-FORMAT.md": {
    when: "Phase 1.2 内容编写 · 必读",
    use: "outline.md 字段 spec、章节/step 切分、章节首段「信息池」、素材清单格式",
  },
  "CHAPTER-CRAFT.md": {
    when: "Phase 2.4 实现单章 · 每章单一必读入口（×N 次）",
    use: "十条原则 / 开工5问 / 关系→动作决策树 / 视觉工具箱 / 手机字号阈值 / 反AI味 / 代码红线 / 完工自检",
  },
  "THEMES.md": {
    when: "Checkpoint Plan 选主题 / 造主题 / 切主题时",
    use: "完整 token 契约 + 内置主题清单 + 创作新主题流程 + font-size token 建议",
  },
  "AUDIO.md": {
    when: "Phase 3 音频合成时才读",
    use: "MiniMax/indextts CLI、narrations→segments→mmx 流程、subagent 长任务严禁 run_in_background、合成前核 TTS 友好文本",
  },
  "RECORDING.md": {
    when: "Phase 4 录屏+后期时才读",
    use: "程序化渲染 render-video / Auto 模式 ?auto=1 一镜到底 / 手动录屏三路径 + 后期工具",
  },
  "COVER.md": {
    when: "Phase 5 分发包 · 单一必读入口",
    use: "5变体AB策略 / 单变量原则 / 反AI味 / 渲染流程 / description 4段式 / chapters.md 格式 / 中文流量打法",
  },
  EXAMPLES: {
    when: "可选 —— 卡壳时翻「形」，不是抄袭模板",
    use: "章节结构示意：hook-chapter / list-reveal / case-tech-review",
  },
};

/** 读文件首个一级标题（# ...）；取不到则回退到文件名。 */
async function firstHeading(filePath) {
  const txt = await readFile(filePath, "utf8");
  for (const line of txt.split("\n")) {
    const m = line.match(/^#\s+(.+?)\s*$/);
    if (m) return m[1].trim();
  }
  return path.basename(filePath);
}

/** 扫 references/：收集 *.md 文件 + 一层子目录（如 EXAMPLES）。 */
async function collectEntries() {
  const names = (await readdir(REF_DIR)).sort();
  const entries = [];
  for (const name of names) {
    if (name.startsWith(".")) continue; // 跳过 .DS_Store / INDEX 自身在下方过滤
    const full = path.join(REF_DIR, name);
    const st = await stat(full);
    if (st.isDirectory()) {
      entries.push({ name, kind: "dir", title: `${name}/`, rel: `references/${name}/` });
    } else if (name.endsWith(".md")) {
      if (name === "INDEX.md") continue; // 自己产出的，不索引自己
      const title = await firstHeading(full);
      entries.push({ name, kind: "file", title, rel: `references/${name}` });
    }
  }
  return entries;
}

function renderLlmsTxt(entries) {
  const lines = [];
  lines.push("# webvideo — references index (llms.txt)");
  lines.push("");
  lines.push("把一篇文章/口播稿做成点击驱动的网页视频演示。下面是 references/ 的");
  lines.push("机器可读索引：agent 按「何时读」定位文件，不必通读所有长 md。");
  lines.push("");
  lines.push("> 本文件由 scripts/gen-index.mjs 自动生成 —— 不要手改，跑脚本重生成。");
  lines.push("> 一行用途取自各文件首个标题 + SKILL.md「各阶段文件读取指南」。");
  lines.push("");
  lines.push("## Files");
  lines.push("");
  for (const e of entries) {
    const hint = PHASE_HINT[e.name] || { when: "—", use: "" };
    lines.push(`- [${e.rel}] ${e.title}`);
    lines.push(`  when: ${hint.when}`);
    lines.push(`  use:  ${hint.use || e.title}`);
    lines.push("");
  }
  lines.push("## Phase → file map");
  lines.push("");
  lines.push("- Phase 1.2 内容编写: references/SCRIPT-STYLE.md + references/OUTLINE-FORMAT.md");
  lines.push("- Checkpoint Plan 选主题: themes/*/theme.json (+ references/THEMES.md)");
  lines.push("- Phase 2.4 实现单章 (×N): references/CHAPTER-CRAFT.md");
  lines.push("- Phase 3 音频合成: references/AUDIO.md");
  lines.push("- Phase 4 录屏+后期: references/RECORDING.md");
  lines.push("- Phase 5 分发包: references/COVER.md");
  lines.push("");
  lines.push("## Offline docs CLI");
  lines.push("");
  lines.push("无需通读 —— 抓某文件关键段落到终端：");
  lines.push("  node scripts/docs.mjs <topic>     # topic: script|outline|chapter|theme|audio|record|cover|examples");
  lines.push("  node scripts/docs.mjs --list      # 列所有 topic");
  lines.push("");
  return lines.join("\n");
}

function renderIndexMd(entries) {
  const lines = [];
  lines.push("<!-- 由 scripts/gen-index.mjs 自动生成，勿手改；改 references/ 后重跑脚本。-->");
  lines.push("");
  lines.push("# References 索引");
  lines.push("");
  lines.push("`references/` 下每个文件的一行用途 + 「何时读」，让 agent 不通读就能定位。");
  lines.push("等价的机器可读扁平版见仓库根 [`llms.txt`](../llms.txt)。");
  lines.push("");
  lines.push("| 文件 | 标题 | 何时读 | 用途 |");
  lines.push("|---|---|---|---|");
  for (const e of entries) {
    const hint = PHASE_HINT[e.name] || { when: "—", use: "" };
    const link = e.kind === "dir" ? `\`${e.rel}\`` : `[\`${e.rel}\`](${e.name})`;
    lines.push(`| ${link} | ${e.title} | ${hint.when} | ${hint.use || e.title} |`);
  }
  lines.push("");
  lines.push("## 离线 docs 查询");
  lines.push("");
  lines.push("不想开文件读全文时，把某主题的关键段落抓到终端：");
  lines.push("");
  lines.push("```bash");
  lines.push("node scripts/docs.mjs --list          # 列所有 topic → 文件映射");
  lines.push("node scripts/docs.mjs chapter         # 打印 CHAPTER-CRAFT.md 的开头/原则段");
  lines.push("node scripts/docs.mjs cover           # 打印 COVER.md 的关键段");
  lines.push("```");
  lines.push("");
  return lines.join("\n");
}

async function main() {
  const entries = await collectEntries();
  const llms = renderLlmsTxt(entries);
  const indexMd = renderIndexMd(entries);

  if (toStdout) {
    process.stdout.write(llms);
    return;
  }

  const llmsPath = path.join(SKILL_ROOT, "llms.txt");
  const indexPath = path.join(REF_DIR, "INDEX.md");

  if (checkOnly) {
    let stale = false;
    for (const [p, want] of [[llmsPath, llms], [indexPath, indexMd]]) {
      let cur = null;
      try { cur = await readFile(p, "utf8"); } catch { /* missing */ }
      if (cur !== want) {
        stale = true;
        console.error(`✗ stale or missing: ${path.relative(SKILL_ROOT, p)}`);
      }
    }
    if (stale) {
      console.error("→ run: node scripts/gen-index.mjs");
      process.exit(1);
    }
    console.log("✓ llms.txt + references/INDEX.md 是最新的");
    return;
  }

  await writeFile(llmsPath, llms, "utf8");
  await writeFile(indexPath, indexMd, "utf8");
  console.log(`✓ wrote ${path.relative(SKILL_ROOT, llmsPath)} (${entries.length} entries)`);
  console.log(`✓ wrote ${path.relative(SKILL_ROOT, indexPath)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
