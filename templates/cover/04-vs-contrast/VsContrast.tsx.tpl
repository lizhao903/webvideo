import { CoverShell } from "../CoverShell";
import "./VsContrast.css";

/**
 * Cover 04 · 视觉 · 双栏反差（X vs Y）
 *
 * 单点钩子：左右两列 + 各自 SVG icon + 中间 VS 圆心，把两个概念辩证地
 * 对比起来。右列用 accent 边框 + accent 色高亮 = 视频要重点讲哪一边。
 * 适合"X vs Y"二选一 / 旧对新辩证视频。
 *
 * 复用本模板时请替换 6 处 {{PLACEHOLDER}}：
 *   {{LEFT_LABEL}}          左列上方小字（动词或介词），2~4 字
 *                           示例："让它"
 *   {{LEFT_QUOTE}}          左列中间引号词（hero），3~6 字（含引号）
 *                           示例："「记什么」"
 *   {{LEFT_TAG}}            左列底部维度标签（mono 字），3 个维度顿号串
 *                           示例："背景 · 习惯 · 偏好"
 *   {{RIGHT_LABEL}}         右列上方小字（与 LEFT_LABEL 对称），2~4 字
 *                           示例："让它"
 *   {{RIGHT_QUOTE}}         右列中间引号词（hero accent 色），3~6 字
 *                           示例："「怎么做」"
 *   {{RIGHT_TAG}}           右列底部维度标签（mono 字），3 个维度顿号串
 *                           示例："起点 · 判断 · 终点"
 *
 * 两个 SVG icon 已经预画好（左侧 = 文档/列表，右侧 = 流程节点链），可以
 * 适配大多数"知识 vs 行动"场景。如果项目主题对 icon 含义有特定需求，
 * 直接改 <svg> 内容，**保持 100×100 viewBox + currentColor stroke**。
 */
export default function VsContrast() {
  return (
    <CoverShell>
      <div className="cv4-stage">
        <div className="cv4-col cv4-col-left">
          <div className="cv4-icon" aria-hidden>
            <svg viewBox="0 0 100 100" width="120" height="120">
              <rect
                x="18"
                y="14"
                width="64"
                height="76"
                rx="6"
                fill="none"
                stroke="currentColor"
                strokeWidth="4"
              />
              <line x1="30" y1="34" x2="70" y2="34" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
              <line x1="30" y1="52" x2="70" y2="52" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
              <line x1="30" y1="70" x2="56" y2="70" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
            </svg>
          </div>
          <div className="cv4-label">{{LEFT_LABEL}}</div>
          <div className="cv4-quote">{{LEFT_QUOTE}}</div>
          <div className="cv4-tag">{{LEFT_TAG}}</div>
        </div>

        <div className="cv4-divider" aria-hidden>
          <span>VS</span>
        </div>

        <div className="cv4-col cv4-col-right">
          <div className="cv4-icon" aria-hidden>
            <svg viewBox="0 0 100 100" width="120" height="120">
              <circle cx="18" cy="50" r="5" fill="currentColor" />
              <circle cx="40" cy="50" r="5" fill="currentColor" />
              <circle cx="62" cy="50" r="5" fill="currentColor" />
              <circle cx="84" cy="50" r="6" fill="currentColor" />
              <path d="M18 50 L84 50" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
              <path d="M76 40 L88 50 L76 60" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="cv4-label">{{RIGHT_LABEL}}</div>
          <div className="cv4-quote">{{RIGHT_QUOTE}}</div>
          <div className="cv4-tag">{{RIGHT_TAG}}</div>
        </div>
      </div>
    </CoverShell>
  );
}
