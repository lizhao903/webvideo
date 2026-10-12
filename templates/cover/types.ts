import type { ComponentType } from "react";

/**
 * Cover 变体定义。registry.ts 把所有变体列成 CoverDef[]，
 * App.tsx 的 CoverMode() 按 URL ?cover=<id> 查找对应变体渲染。
 *
 * 本文件**不需要任何替换**，复用时直接 cp 即可。
 */
export interface CoverDef {
  /** URL slug + 输出 PNG 文件名（不带扩展名）。kebab-case，如 "01-hook-question" */
  id: string;
  /** 变化变量描述（A/B 测试记录用，仅文档作用） */
  variant: string;
  /** 假设：为什么觉得这一版会赢（A/B 测试结论复盘时对照用） */
  hypothesis: string;
  Component: ComponentType;
}
