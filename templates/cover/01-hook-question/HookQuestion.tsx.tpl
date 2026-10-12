import { CoverShell } from "../CoverShell";
import "./HookQuestion.css";

/**
 * Cover 01 · 钩子 · 疑问式 + 巨问号
 *
 * 单点钩子：一句**反问**把痛点说穿 + 巨大旋转问号做视觉冲击。
 * 适合"痛点广泛、受众没意识到自己有这问题"的认知科普类视频。
 *
 * 复用本模板时请替换 3 处 {{PLACEHOLDER}}：
 *   {{QUOTE_LINE_1}}        反问的第 1 行，建议 5~10 字
 *                           示例："同样一件事，"
 *   {{QUOTE_LINE_2_PRE}}    第 2 行的开头（普通色），3~6 字
 *                           示例："跟 Agent 说过"
 *   {{QUOTE_LINE_2_EM}}     第 2 行的高亮短语（accent 色 + 衬底），2~5 字
 *                           示例："好多次"
 *   {{QUOTE_LINE_3_PRE}}    第 3 行的开头（普通色），4~7 字
 *                           示例："结果还是"
 *   {{QUOTE_LINE_3_EM}}     第 3 行的高亮短语（accent 色 + 衬底），2~4 字
 *                           示例："不一样"
 *
 * 反问必须以"？"收尾。问号本体在右侧 .cv1-mark 已经画了视觉巨型版，
 * 文字句末也加个？保持节奏。
 */
export default function HookQuestion() {
  return (
    <CoverShell>
      <div className="cv1-stage">
        <div className="cv1-mark" aria-hidden>?</div>
        <div className="cv1-quote">
          {{QUOTE_LINE_1}}
          <br />
          {{QUOTE_LINE_2_PRE}}<span className="cv1-em">{{QUOTE_LINE_2_EM}}</span>，
          <br />
          {{QUOTE_LINE_3_PRE}}<span className="cv1-em">{{QUOTE_LINE_3_EM}}</span>？
        </div>
      </div>
    </CoverShell>
  );
}
