import { CoverShell } from "../CoverShell";
import "./HookStatement.css";

/**
 * Cover 02 · 钩子 · 第一/第二阶段陈述对照
 *
 * 单点钩子：用 numbered 列表把"前后阶段 / 旧新方式 / 错对做法"对照出来，
 * 第 2 行高亮 = 视频的真主题。底部 caption 一句话锚定。
 * 适合内容有清晰二分结构的视频。
 *
 * 复用本模板时请替换 5 处 {{PLACEHOLDER}}：
 *   {{STAGE_1_NAME}}        第 1 行的阶段名（短），3~5 字
 *                           示例："第一阶段"
 *   {{STAGE_1_VERB}}        第 1 行的动作描述（大字 hero），3~6 字
 *                           示例："教它记。"
 *   {{STAGE_2_NAME}}        第 2 行的阶段名（短），3~5 字
 *                           示例："第二阶段"
 *   {{STAGE_2_VERB}}        第 2 行的动作描述（高亮 + 大字 hero），3~6 字
 *                           示例："教它做。"
 *   {{CAPTION_TEXT}}        底部 caption（视频"今天讲哪一段"），≤ 8 字
 *                           示例："今天讲第二阶段"
 *
 * 句末是否带句号由文案风格决定 —— 都带或都不带，**别一行带一行不带**。
 */
export default function HookStatement() {
  return (
    <CoverShell>
      <div className="cv2-stage">
        <div className="cv2-line cv2-line-muted">
          <span className="cv2-num">1</span>
          <span className="cv2-stage-name">{{STAGE_1_NAME}}</span>
          <span className="cv2-verb">{{STAGE_1_VERB}}</span>
        </div>
        <div className="cv2-line cv2-line-active">
          <span className="cv2-num">2</span>
          <span className="cv2-stage-name">{{STAGE_2_NAME}}</span>
          <span className="cv2-verb">{{STAGE_2_VERB}}</span>
        </div>
        <div className="cv2-caption">{{CAPTION_TEXT}}</div>
      </div>
    </CoverShell>
  );
}
