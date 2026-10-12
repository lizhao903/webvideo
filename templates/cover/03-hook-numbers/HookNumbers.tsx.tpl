import { CoverShell } from "../CoverShell";
import "./HookNumbers.css";

/**
 * Cover 03 · 钩子 · 数字反差（前 → 后）
 *
 * 单点钩子：两张并排卡片 + 大数字 + 中间 arrow，把"前 vs 后"的量化反差
 * 直接砸到脸上。第 2 张卡片用 accent 边框 + accent 数字色高亮。
 * 适合有可量化 ROI / 时间反差 / 效率提升的视频。
 *
 * 复用本模板时请替换 6 处 {{PLACEHOLDER}}：
 *   {{NUM_BEFORE}}          左卡片的数字（大），1~3 位
 *                           示例："30"
 *   {{UNIT_BEFORE}}         左卡片的单位（小字跟在数字后），1~4 字符
 *                           示例："min"
 *   {{LABEL_BEFORE}}        左卡片的 label（场景描述），3~6 字
 *                           示例："一次引导"
 *   {{NUM_AFTER}}           右卡片的数字（大），1~3 位
 *                           示例："3"
 *   {{UNIT_AFTER}}          右卡片的单位（小字跟在数字后），1~4 字符
 *                           示例："min"
 *   {{LABEL_AFTER}}         右卡片的 label（场景描述），3~6 字
 *                           示例："之后每次"
 *   {{CAPTION_PRE}}         底部 caption 普通色部分，4~8 字
 *                           示例："训一次 · 之后"
 *   {{CAPTION_EM}}          底部 caption 高亮部分（accent + 衬底），4~7 字
 *                           示例："每周自动跑"
 *
 * 数字真实性是这张封面的灵魂 —— **不要伪造数字**。如果项目实际 ROI 是
 * 30 → 3 这种 10× 倍数，效果最好；3 → 1 这种 3× 倍数也行；< 2× 的反
 * 差换 04 / 05 变体。
 */
export default function HookNumbers() {
  return (
    <CoverShell>
      <div className="cv3-stage">
        <div className="cv3-card cv3-card-before">
          <div className="cv3-num">{{NUM_BEFORE}}<span className="cv3-unit">{{UNIT_BEFORE}}</span></div>
          <div className="cv3-label">{{LABEL_BEFORE}}</div>
          <div className="cv3-bar cv3-bar-long" aria-hidden />
        </div>

        <div className="cv3-arrow" aria-hidden>
          <svg viewBox="0 0 140 60" width="140" height="60">
            <path
              d="M10 30 L120 30"
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
              strokeLinecap="round"
            />
            <path
              d="M108 18 L126 30 L108 42"
              fill="none"
              stroke="currentColor"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        <div className="cv3-card cv3-card-after">
          <div className="cv3-num">{{NUM_AFTER}}<span className="cv3-unit">{{UNIT_AFTER}}</span></div>
          <div className="cv3-label">{{LABEL_AFTER}}</div>
          <div className="cv3-bar cv3-bar-short" aria-hidden />
        </div>
      </div>

      <div className="cv3-caption">
        {{CAPTION_PRE}}<span className="cv3-em">{{CAPTION_EM}}</span>
      </div>
    </CoverShell>
  );
}
