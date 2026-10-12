import { CoverShell } from "../CoverShell";
import "./HeroSkill.css";

/**
 * Cover 05 · 视觉 · 单一名词 hero
 *
 * 单点钩子：把视频要"赌"的那 1 个名词做成超大字（带 stroke 阴影），
 * 上下各一行短陈述把它锚定到使用场景。**全封面只有 1 个 hero 词**，
 * 视觉信息量最干脆。
 * 适合主题能浓缩成 1 个英文 / 中文名词的视频（"Skill" / "Memory"
 * / "Workflow" / "搜索增强" / "记忆"...）。
 *
 * 复用本模板时请替换 3 处 {{PLACEHOLDER}}：
 *   {{PREFIX_TEXT}}         hero 上方的引导句（普通字），8~14 字
 *                           示例："教 Agent 一次 → 沉淀成"
 *   {{HERO_WORD}}           中心 hero 词，**1 个**英文词或中文词
 *                           示例："Skill"
 *   {{SUB_TEXT}}            hero 下方的承诺 / 结果句（普通字），8~14 字
 *                           示例："之后每周自动跑，3 分钟搞定"
 *
 * HERO_WORD 重复出现在 .cv5-hero-shadow（描边阴影）和 .cv5-hero-main
 * （实色）—— 两个 span 内容必须完全一致，否则 stroke 阴影对不齐。
 *
 * 字号 460px 是按 4~6 字符（英文 Skill / Memory / Workflow）算的；
 * 如果用中文 1~2 字（"技能" / "记忆"），调到 560~640px 更撑得起场面。
 */
export default function HeroSkill() {
  return (
    <CoverShell>
      <div className="cv5-stage">
        <div className="cv5-prefix">{{PREFIX_TEXT}}</div>
        <div className="cv5-hero">
          <span className="cv5-hero-shadow" aria-hidden>{{HERO_WORD}}</span>
          <span className="cv5-hero-main">{{HERO_WORD}}</span>
        </div>
        <div className="cv5-sub">{{SUB_TEXT}}</div>
      </div>
    </CoverShell>
  );
}
