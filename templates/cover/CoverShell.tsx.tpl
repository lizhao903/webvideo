import type { ReactNode } from "react";
import "./cover-base.css";

interface CoverShellProps {
  children: ReactNode;
}

/**
 * Shared frame for all cover variants —— eyebrow（左上）、底部主标、
 * 右下 grid 装饰。变体只填充 children 即"中心舞台"内容。
 *
 * 复用本模板时请替换 2 处 {{PLACEHOLDER}}：
 *   {{EYEBROW_TEXT}}        左上角小字 brand chip，建议 ≤ 14 字（含空格 + dot）
 *                           示例："AGENT TRAINING · 第二阶段"
 *   {{FOOTER_TITLE}}        底部主标主词，3~6 字（中文）
 *                           示例："手把手带 Agent"
 *   {{FOOTER_SUBTITLE}}     底部主标副词，5~10 字（中文）
 *                           示例："学会你的工作流程"
 *
 * 修改 CoverShell 是**整套 5 张封面共用的修改** —— 改完所有变体一起变。
 * 个别变体的中心舞台样式请改对应变体的 .css（前缀 .cv1- ~ .cv5-）。
 *
 * 比例：URL 带 ?ratio=<r> 时 root 挂 .cv-base-root--<r> 修饰类，5 种
 * 支持值（16x9 是缺省）：
 *   16x9 (1920×1080)         — 默认，横屏主战场
 *   4x3  (1440×1080)         — 公众号 / 小红书横版
 *   9x16 (1080×1920)         — 抖音 / Reels / Shorts / 小红书竖屏
 *   3x4  (1080×1440)         — 小红书 / Pinterest 竖版
 *   1x1  (1080×1080)         — IG / 朋友圈 / 视频号方形
 * render-covers.mjs 按项目 .orientation 自动选组合（landscape: 16x9+4x3；
 * portrait: 9x16+3x4+1x1；square: 1x1+4x3）。
 */
type CoverRatio = "16x9" | "4x3" | "9x16" | "3x4" | "1x1";
const VALID_RATIOS: CoverRatio[] = ["16x9", "4x3", "9x16", "3x4", "1x1"];

function getCoverRatio(): CoverRatio {
  if (typeof window === "undefined") return "16x9";
  const v = new URLSearchParams(window.location.search).get("ratio");
  return (VALID_RATIOS as string[]).includes(v ?? "")
    ? (v as CoverRatio)
    : "16x9";
}

export function CoverShell({ children }: CoverShellProps) {
  const ratio = getCoverRatio();
  const rootClass =
    ratio === "16x9"
      ? "cv-base-root"
      : `cv-base-root cv-base-root--${ratio}`;
  return (
    <div className={rootClass} data-ratio={ratio}>
      <div className="cv-base-eyebrow">
        <span className="cv-base-eyebrow-dot" />
        <span>{{EYEBROW_TEXT}}</span>
      </div>

      {children}

      <div className="cv-base-footer">
        <span className="cv-base-footer-title">{{FOOTER_TITLE}}</span>
        <span className="cv-base-footer-rule" />
        <span className="cv-base-footer-sub">{{FOOTER_SUBTITLE}}</span>
      </div>

      <div className="cv-base-grid" aria-hidden />
    </div>
  );
}
