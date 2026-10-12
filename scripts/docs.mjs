#!/usr/bin/env node
/**
 * docs.mjs — 离线 docs 查询（灵感来自 HyperFrames `docs <topic>` 的 DX）。
 *
 * `node docs.mjs <topic>` 把对应 reference 的**关键段落**打印到终端，
 * 让 agent / 人不必打开整份长 md 就能拿到这一步最该看的内容。
 *
 * 设计：
 *   - topic → 文件的稳定映射表（TOPICS）
 *   - 每个 topic 可声明 sections：要抓的 markdown 标题关键词（不分级模糊匹配）
 *     抓不到 sections 时回退打印文件前 N 行
 *   - 默认每个命中段落最多打印 SECTION_MAX_LINES 行，避免刷屏；--full 全量
 *
 * 用法：
 *   node docs.mjs --list                # 列所有 topic
 *   node docs.mjs chapter               # 抓 CHAPTER-CRAFT.md 的关键段
 *   node docs.mjs cover --full          # 抓 COVER.md 全部命中段，不截断
 *   node docs.mjs script "TTS"          # 额外用 "TTS" 过滤想要的标题
 *
 * 零新依赖（纯 Node）。只读 references/，不写任何文件。
 */
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REF_DIR = path.resolve(__dirname, "..", "references");
const SECTION_MAX_LINES = 60;

/**
 * topic → { file, aliases, sections }
 * sections = 想抓的标题里的关键词（小写模糊匹配标题文本）。
 * 缺省抓不到时回退打印开头。
 */
const TOPICS = {
  script: {
    file: "SCRIPT-STYLE.md",
    aliases: ["script-style", "口播稿", "稿子"],
    blurb: "文章 → B 站风口播稿规则",
    sections: ["最高原则", "8 条原则", "去 AI 味", "TTS 友好", "orientation", "念出来"],
  },
  outline: {
    file: "OUTLINE-FORMAT.md",
    aliases: ["outline-format", "大纲"],
    blurb: "outline.md 字段 spec + 信息池 + 切分",
    sections: ["字段约定", "信息池", "Step 列表", "章节切分", "素材清单", "自检"],
  },
  chapter: {
    file: "CHAPTER-CRAFT.md",
    aliases: ["chapter-craft", "craft", "章节"],
    blurb: "实现单章单一入口：原则/视觉/字号/反AI味/代码红线/自检",
    sections: [
      "不是 PPT",
      "视觉演示",
      "逐步揭示",
      "双源",
      "字号下限",
      "竖屏",
      "避免 AI 味",
      "代码层",
      "完工自检",
    ],
  },
  theme: {
    file: "THEMES.md",
    aliases: ["themes", "主题"],
    blurb: "token 契约 + 内置主题 + 造主题流程",
    sections: ["内置主题", "完整 token 契约", "必填", "创作新主题", "font-size", "反模式"],
  },
  audio: {
    file: "AUDIO.md",
    aliases: ["voice", "tts", "音频"],
    blurb: "narrations→segments→mmx 合成 + 退化路径",
    sections: ["run_in_background", "命名约定", "标准流程", "最小契约", "故障排查"],
  },
  record: {
    file: "RECORDING.md",
    aliases: ["recording", "录屏", "录制"],
    blurb: "程序化渲染 / Auto 一镜到底 / 手动录屏",
    sections: ["程序化渲染", "Auto 模式", "手动录屏", "模式速查", "FAQ"],
  },
  cover: {
    file: "COVER.md",
    aliases: ["covers", "分发", "封面"],
    blurb: "分发包：5 变体封面 + description + chapters",
    sections: [
      "为什么",
      "5 种变体",
      "单变量原则",
      "反 AI 味",
      "渲染流程",
      "description.md 写作",
      "chapters.md",
      "完工",
      "中文流量",
    ],
  },
  examples: {
    file: "EXAMPLES/README.md",
    aliases: ["example"],
    blurb: "章节结构示意（不是抄袭模板）",
    sections: [],
  },
};

function resolveTopic(name) {
  const key = name.toLowerCase();
  if (TOPICS[key]) return [key, TOPICS[key]];
  for (const [k, v] of Object.entries(TOPICS)) {
    if (v.aliases?.includes(key)) return [k, v];
  }
  return [null, null];
}

async function listTopics() {
  console.log("Topics (node docs.mjs <topic>):\n");
  const pad = Math.max(...Object.keys(TOPICS).map((k) => k.length));
  for (const [k, v] of Object.entries(TOPICS)) {
    console.log(`  ${k.padEnd(pad)}  ${v.file.padEnd(20)} ${v.blurb}`);
  }
  console.log("\nFlags: --full (不截断段落)   |   docs.mjs <topic> <filter> 额外过滤标题");
}

/** 把 md 切成 [{heading, level, lines:[]}]；标题行本身计入该段。 */
function splitSections(txt) {
  const out = [];
  let cur = { heading: null, level: 0, lines: [] };
  for (const line of txt.split("\n")) {
    const m = line.match(/^(#{1,6})\s+(.+?)\s*$/);
    if (m) {
      if (cur.heading !== null || cur.lines.length) out.push(cur);
      cur = { heading: m[2].trim(), level: m[1].length, lines: [line] };
    } else {
      cur.lines.push(line);
    }
  }
  out.push(cur);
  return out;
}

async function showTopic(topicKey, topic, filter, full) {
  const filePath = path.join(REF_DIR, topic.file);
  let txt;
  try {
    txt = await readFile(filePath, "utf8");
  } catch {
    console.error(`✗ 找不到 ${topic.file}`);
    process.exit(1);
  }

  const header = `── ${topicKey}  →  references/${topic.file} ──`;
  console.log(header);
  console.log(topic.blurb + "\n");

  const wanted = (topic.sections || []).map((s) => s.toLowerCase());
  const sections = splitSections(txt);

  // 没声明 sections，或文件无标题 → 打印开头
  if (!wanted.length) {
    const head = txt.split("\n").slice(0, full ? Infinity : SECTION_MAX_LINES);
    console.log(head.join("\n"));
    return;
  }

  let matched = 0;
  for (const sec of sections) {
    if (sec.heading === null) continue;
    const h = sec.heading.toLowerCase();
    const hit = wanted.some((w) => h.includes(w));
    const passFilter = !filter || h.includes(filter.toLowerCase());
    if (!hit || !passFilter) continue;
    matched++;
    const body = full ? sec.lines : sec.lines.slice(0, SECTION_MAX_LINES);
    console.log(body.join("\n"));
    if (!full && sec.lines.length > SECTION_MAX_LINES) {
      console.log(`  … (+${sec.lines.length - SECTION_MAX_LINES} 行，--full 看全部)`);
    }
    console.log("");
  }

  if (!matched) {
    console.log(`(无匹配段落${filter ? `（filter="${filter}"）` : ""}，打印文件开头)\n`);
    console.log(txt.split("\n").slice(0, SECTION_MAX_LINES).join("\n"));
  }
  console.log(`\n→ 全文：references/${topic.file}`);
}

async function main() {
  const argv = process.argv.slice(2);
  const full = argv.includes("--full");
  const pos = argv.filter((a) => !a.startsWith("--"));

  if (argv.includes("--list") || pos.length === 0) {
    await listTopics();
    return;
  }

  const [topicKey, topic] = resolveTopic(pos[0]);
  if (!topic) {
    console.error(`✗ 未知 topic: "${pos[0]}"\n`);
    await listTopics();
    process.exit(1);
  }
  await showTopic(topicKey, topic, pos[1], full);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
